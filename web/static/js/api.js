/**
 * Eternal Voice - API Communication Module
 * Handles all backend API calls with error handling and authentication
 */
window.API_BASE = "http://127.0.0.1:8000";
class APIClient {
    constructor() {
        this.baseURL = window.API_BASE; // Relative URL for same-origin requests
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        // Request interceptors
        this.requestInterceptors = [];
        
        // Response interceptors
        this.responseInterceptors = [];
        
        // Initialize error handling
        this.setupErrorHandling();
    }

    // Request interceptor
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    // Response interceptor
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    // Setup global error handling
    setupErrorHandling() {
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });

        // Global fetch error handler
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                return await originalFetch(...args);
            } catch (error) {
                console.error('Fetch error:', error);
                this.handleGlobalError(error);
                throw error;
            }
        };
    }

    // Handle global errors
    handleGlobalError(error) {
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            showNotification('Connection error: Unable to reach the server', 'error');
        } else if (error.name === 'AbortError') {
            console.log('Request was aborted');
        } else {
            showNotification(`Network error: ${error.message}`, 'error');
        }
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        // Default options
        const defaultOptions = {
            method: 'GET',
            headers: this.defaultHeaders,
            credentials: 'include', // Include cookies for authentication
            timeout: 30000, // 30 seconds timeout
            ...options
        };

        // Apply request interceptors
        let requestConfig = { url, ...defaultOptions };
        for (const interceptor of this.requestInterceptors) {
            requestConfig = await interceptor(requestConfig);
        }

        // Create abort controller for timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), requestConfig.timeout);
        requestConfig.signal = abortController.signal;

        try {
            const response = await fetch(requestConfig.url, requestConfig);

            // Clear timeout
            clearTimeout(timeoutId);

            // Apply response interceptors
            let responseData = response;
            for (const interceptor of this.responseInterceptors) {
                responseData = await interceptor(responseData);
            }

            return this.handleResponse(responseData);

        } catch (error) {
            clearTimeout(timeoutId);
            return this.handleError(error, endpoint, requestConfig);
        }
    }

    // Handle API response
    async handleResponse(response) {
        // Check if response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get response content type
        const contentType = response.headers.get('content-type');
        
        // Parse response based on content type
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else if (contentType && contentType.includes('text/')) {
            return await response.text();
        } else if (contentType && contentType.includes('audio/')) {
            return await response.blob();
        } else {
            return response;
        }
    }

    // Handle API errors
    handleError(error, endpoint, config) {
        console.error(`API Error [${config.method} ${endpoint}]:`, error);

        // Enhanced error handling based on error type
        if (error.name === 'AbortError') {
            throw {
                type: 'TIMEOUT',
                message: 'Request timeout - please try again',
                endpoint,
                config,
                originalError: error
            };
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw {
                type: 'NETWORK_ERROR',
                message: 'Network connection failed - please check your internet connection',
                endpoint,
                config,
                originalError: error
            };
        } else {
            throw {
                type: 'UNKNOWN_ERROR',
                message: error.message || 'An unexpected error occurred',
                endpoint,
                config,
                originalError: error
            };
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        // Convert params to query string
        const queryString = Object.keys(params).length > 0 
            ? `?${new URLSearchParams(params).toString()}`
            : '';
        
        return this.request(`${endpoint}${queryString}`, {
            method: 'GET'
        });
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // File upload with progress tracking
    async upload(endpoint, formData, onProgress = null) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Progress tracking
            if (onProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        onProgress(percentComplete, event.loaded, event.total);
                    }
                });
            }

            // Load complete
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        resolve(xhr.responseText);
                    }
                } else {
                    reject({
                        type: 'UPLOAD_ERROR',
                        message: `Upload failed with status ${xhr.status}`,
                        status: xhr.status,
                        response: xhr.responseText
                    });
                }
            });

            // Error handling
            xhr.addEventListener('error', () => {
                reject({
                    type: 'UPLOAD_ERROR',
                    message: 'Upload failed due to network error'
                });
            });

            // Abort handling
            xhr.addEventListener('abort', () => {
                reject({
                    type: 'UPLOAD_ABORTED',
                    message: 'Upload was cancelled'
                });
            });

            xhr.open('POST', `${this.baseURL}${endpoint}`);
            xhr.send(formData);
        });
    }

    // Stream request for real-time data
    async stream(endpoint, onData, onError, onComplete) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    if (onComplete) onComplete();
                    break;
                }
                
                const chunk = decoder.decode(value, { stream: true });
                if (onData) onData(chunk);
            }
        } catch (error) {
            if (onError) onError(error);
        }
    }

    // Health check
    async healthCheck() {
        try {
            const response = await this.get('/api/health');
            return {
                healthy: true,
                data: response
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    // Retry mechanism with exponential backoff
    async retryRequest(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries === 0) throw error;
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retryRequest(fn, retries - 1, delay * 2);
        }
    }

    // Batch requests
    async batch(requests) {
        return Promise.all(requests.map(request => 
            this.retryRequest(() => this.request(request.endpoint, request.options))
        ));
    }
}

// Create global API client instance
const apiClient = new APIClient();

// Add request interceptor for authentication
apiClient.addRequestInterceptor(async (config) => {
    // Add authentication token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    // Add request ID for tracking
    config.headers['X-Request-ID'] = generateRequestId();

    return config;
});

// Add response interceptor for error handling
apiClient.addResponseInterceptor(async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        switch (response.status) {
            case 401:
                showNotification('Authentication required - please log in', 'error');
                // Redirect to login or refresh token
                break;
            case 403:
                showNotification('Access forbidden - insufficient permissions', 'error');
                break;
            case 404:
                showNotification('Resource not found', 'error');
                break;
            case 429:
                showNotification('Too many requests - please slow down', 'warning');
                break;
            case 500:
                showNotification('Server error - please try again later', 'error');
                break;
            case 503:
                showNotification('Service unavailable - please try again later', 'error');
                break;
            default:
                showNotification(`Error ${response.status}: ${errorData.message || 'Unknown error'}`, 'error');
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    
    return response;
});

// Utility function to generate unique request ID
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// API Endpoint Definitions
const API_ENDPOINTS = {
    // Health & System
    HEALTH: '/api/health',
    
    // Profiles
    PROFILES: {
        BASE: '/api/profiles',
        GET_ALL: '/api/profiles/',
        GET_BY_ID: (id) => `/api/profiles/${id}`,
        CREATE: '/api/profiles/',
        UPDATE: (id) => `/api/profiles/${id}`,
        DELETE: (id) => `/api/profiles/${id}`
    },
    
    // File Upload
    UPLOAD: {
        MULTIPLE: '/api/upload/multiple',
        SINGLE: '/api/upload/single',
        FILES_BY_PROFILE: (profileId) => `/api/upload/files/${profileId}`,
        DELETE_FILE: (fileId) => `/api/upload/file/${fileId}`,
        PROGRESS: (taskId) => `/api/upload/progress/${taskId}`,
        PROCESS_IMAGE: (fileId) => `/api/upload/process-image/${fileId}`
    },
    
    // Transcription
    TRANSCRIBE: {
        TRANSCRIBE_FILE: (fileId) => `/api/transcribe/${fileId}`,
        BATCH_TRANSCRIBE: (profileId) => `/api/transcribe/batch/${profileId}`,
        PROGRESS: (taskId) => `/api/transcribe/progress/${taskId}`,
        RESULTS: (profileId) => `/api/transcribe/results/${profileId}`
    },
    
    // Chat
    CHAT: {
        SEND_MESSAGE: '/api/chat/message',
        BUILD_PERSONA: (profileId) => `/api/chat/build-persona/${profileId}`,
        HISTORY: (profileId) => `/api/chat/history/${profileId}`,
        SUMMARY: (profileId) => `/api/chat/summary/${profileId}`,
        CLEAR_HISTORY: (profileId) => `/api/chat/history/${profileId}`,
        PERSONA_DATA: (profileId) => `/api/chat/persona/${profileId}`
    },
    
    // Text-to-Speech
    TTS: {
        GENERATE: '/api/tts/generate',
        GET_AUDIO: (audioId) => `/api/tts/audio/${audioId}`,
        GET_VOICES: '/api/tts/voices',
        ENGINE_INFO: '/api/tts/engine-info',
        PREVIEW: '/api/tts/preview',
        DELETE_AUDIO: (audioId) => `/api/tts/audio/${audioId}`
    },
    
    // Visualization
    VISUALIZE: {
        DATA: (profileId) => `/api/visualize/data/${profileId}`
    }
};

// High-level API functions for easy use
const API = {
    // Health check
    async health() {
        return apiClient.get(API_ENDPOINTS.HEALTH);
    },

    // Profile management
    profiles: {
        async getAll() {
            return apiClient.get(API_ENDPOINTS.PROFILES.GET_ALL);
        },
        
        async getById(id) {
            return apiClient.get(API_ENDPOINTS.PROFILES.GET_BY_ID(id));
        },
        
        async create(profileData) {
            return apiClient.post(API_ENDPOINTS.PROFILES.CREATE, profileData);
        },
        
        async update(id, profileData) {
            return apiClient.put(API_ENDPOINTS.PROFILES.UPDATE(id), profileData);
        },
        
        async delete(id) {
            return apiClient.delete(API_ENDPOINTS.PROFILES.DELETE(id));
        }
    },

    // File upload
    upload: {
        async multiple(profileId, files, onProgress = null) {
            const formData = new FormData();
            formData.append('profile_id', profileId);
            
            files.forEach(file => {
                formData.append('files', file);
            });
            
            return apiClient.upload(API_ENDPOINTS.UPLOAD.MULTIPLE, formData, onProgress);
        },
        
        async single(profileId, file) {
            const formData = new FormData();
            formData.append('profile_id', profileId);
            formData.append('file', file);
            
            return apiClient.upload(API_ENDPOINTS.UPLOAD.SINGLE, formData);
        },
        
        async getFiles(profileId) {
            return apiClient.get(API_ENDPOINTS.UPLOAD.FILES_BY_PROFILE(profileId));
        },
        
        async deleteFile(fileId) {
            return apiClient.delete(API_ENDPOINTS.UPLOAD.DELETE_FILE(fileId));
        },
        
        async getProgress(taskId) {
            return apiClient.get(API_ENDPOINTS.UPLOAD.PROGRESS(taskId));
        },
        
        async processImage(fileId) {
            return apiClient.post(API_ENDPOINTS.UPLOAD.PROCESS_IMAGE(fileId));
        }
    },

    // Transcription
    transcription: {
        async transcribeFile(fileId, options = {}) {
            return apiClient.post(API_ENDPOINTS.TRANSCRIBE.TRANSCRIBE_FILE(fileId), options);
        },
        
        async transcribeAll(profileId, options = {}) {
            return apiClient.post(API_ENDPOINTS.TRANSCRIBE.BATCH_TRANSCRIBE(profileId), options);
        },
        
        async getProgress(taskId) {
            return apiClient.get(API_ENDPOINTS.TRANSCRIBE.PROGRESS(taskId));
        },
        
        async getResults(profileId) {
            return apiClient.get(API_ENDPOINTS.TRANSCRIBE.RESULTS(profileId));
        }
    },

    // Chat
    chat: {
        async sendMessage(profileId, message) {
            return apiClient.post(API_ENDPOINTS.CHAT.SEND_MESSAGE, {
                profile_id: profileId,
                user_message: message
            });
        },
        
        async buildPersona(profileId) {
            return apiClient.post(API_ENDPOINTS.CHAT.BUILD_PERSONA(profileId));
        },
        
        async getHistory(profileId, limit = 50) {
            return apiClient.get(API_ENDPOINTS.CHAT.HISTORY(profileId), { limit });
        },
        
        async getSummary(profileId) {
            return apiClient.get(API_ENDPOINTS.CHAT.SUMMARY(profileId));
        },
        
        async clearHistory(profileId) {
            return apiClient.delete(API_ENDPOINTS.CHAT.CLEAR_HISTORY(profileId));
        },
        
        async getPersona(profileId) {
            return apiClient.get(API_ENDPOINTS.CHAT.PERSONA_DATA(profileId));
        }
    },

    // Text-to-Speech
    tts: {
        async generate(chatData) {
            return apiClient.post(API_ENDPOINTS.TTS.GENERATE, chatData);
        },
        
        async getAudio(audioId) {
            return apiClient.get(API_ENDPOINTS.TTS.GET_AUDIO(audioId));
        },
        
        async getVoices() {
            return apiClient.get(API_ENDPOINTS.TTS.GET_VOICES);
        },
        
        async getEngineInfo() {
            return apiClient.get(API_ENDPOINTS.TTS.ENGINE_INFO);
        },
        
        async preview(text) {
            return apiClient.post(API_ENDPOINTS.TTS.PREVIEW, { text });
        },
        
        async deleteAudio(audioId) {
            return apiClient.delete(API_ENDPOINTS.TTS.DELETE_AUDIO(audioId));
        }
    },

    // Visualization
    visualization: {
        async getData(profileId) {
            return apiClient.get(API_ENDPOINTS.VISUALIZE.DATA(profileId));
        }
    },

    // Utility functions
    utils: {
        // Batch multiple API calls
        async batch(requests) {
            return apiClient.batch(requests);
        },
        
        // Retry a failed request
        async retry(fn, retries = 3) {
            return apiClient.retryRequest(fn, retries);
        },
        
        // Health check with retry
        async healthWithRetry(retries = 3) {
            return apiClient.retryRequest(() => apiClient.healthCheck(), retries);
        },
        
        // Check if server is reachable
        async isServerReachable() {
            try {
                const health = await apiClient.healthCheck();
                return health.healthy;
            } catch (error) {
                return false;
            }
        }
    }
};

// Legacy functions for backward compatibility
async function apiGet(endpoint) {
    return apiClient.get(endpoint);
}

async function apiPost(endpoint, data) {
    return apiClient.post(endpoint, data);
}

async function apiPut(endpoint, data) {
    return apiClient.put(endpoint, data);
}

async function apiDelete(endpoint) {
    return apiClient.delete(endpoint);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        APIClient,
        API,
        apiGet,
        apiPost,
        apiPut,
        apiDelete
    };
}

// Global error event listener for unhandled API errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Network status monitoring
window.addEventListener('online', () => {
    showNotification('Connection restored', 'success');
    console.log('Network connection restored');
});

window.addEventListener('offline', () => {
    showNotification('Connection lost - working offline', 'warning');
    console.log('Network connection lost');
});

// Service Worker registration for caching (optional)
/*if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

console.log('✅ API module loaded successfully');*/

// Make API globally available
window.API = API;
window.apiClient = apiClient;