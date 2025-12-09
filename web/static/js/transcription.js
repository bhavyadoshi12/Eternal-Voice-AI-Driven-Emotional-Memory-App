class TranscriptionManager {
    constructor() {
        this.currentProfileId = null;
        this.audioFiles = [];
        this.transcriptions = [];
        this.currentTaskId = null;
        this.progressInterval = null;
        
        this.initializeEventListeners();
        this.loadProfiles();
    }

    initializeEventListeners() {
        // Refresh buttons
        document.getElementById('refreshFilesBtn').addEventListener('click', () => {
            this.loadAudioFiles();
            this.loadTranscriptionResults();
        });

        // Transcribe all button
        document.getElementById('transcribeAllBtn').addEventListener('click', () => {
            this.transcribeAllFiles();
        });

        // Settings changes
        document.getElementById('transcriptionMethod').addEventListener('change', () => {
            this.saveSettings();
        });

        document.getElementById('transcriptionLanguage').addEventListener('change', () => {
            this.saveSettings();
        });

        document.getElementById('backgroundProcessing').addEventListener('change', () => {
            this.saveSettings();
        });

        // Quick actions
        document.getElementById('exportTranscriptsBtn').addEventListener('click', () => {
            this.exportAllTranscripts();
        });

        document.getElementById('clearCompletedBtn').addEventListener('click', () => {
            this.clearCompletedTranscriptions();
        });

        // Modal buttons
        document.getElementById('closeProgressModal').addEventListener('click', () => {
            this.hideProgressModal();
        });

        document.getElementById('closeTranscriptModal').addEventListener('click', () => {
            this.hideTranscriptModal();
        });

        document.getElementById('copyTranscriptBtn').addEventListener('click', () => {
            this.copyTranscript();
        });

        document.getElementById('exportTranscriptBtn').addEventListener('click', () => {
            this.exportCurrentTranscript();
        });
    }

    async loadProfiles() {
        try {
            const response = await apiGet('/api/profiles/');
            const profileSelection = document.getElementById('profileSelection');
            
            if (response.success && response.data.length > 0) {
                profileSelection.innerHTML = '';
                
                response.data.forEach(profile => {
                    const profileElement = this.createProfileElement(profile);
                    profileSelection.appendChild(profileElement);
                });

                // Select first profile by default
                if (response.data.length > 0) {
                    this.selectProfile(response.data[0].id);
                }
                
            } else {
                profileSelection.innerHTML = `
                    <div class="text-center w-full py-4">
                        <p class="text-gray-500 mb-3">No profiles found</p>
                        <a href="#profiles" class="btn btn-primary" data-page="profiles">
                            <i class="fas fa-plus mr-2"></i>Create Profile
                        </a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading profiles:', error);
        }
    }

    createProfileElement(profile) {
        const profileElement = document.createElement('button');
        profileElement.className = `profile-btn flex items-center space-x-3 px-4 py-3 rounded-xl border-2 transition-all ${
            this.currentProfileId === profile.id 
            ? 'border-blue-500 bg-blue-50 text-blue-700' 
            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
        }`;
        
        profileElement.innerHTML = `
            <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <i class="fas fa-user text-white"></i>
            </div>
            <div class="text-left">
                <p class="font-semibold">${profile.name}</p>
                <p class="text-sm opacity-75">${profile.relationship || 'No relationship specified'}</p>
            </div>
        `;

        profileElement.addEventListener('click', () => {
            this.selectProfile(profile.id);
        });

        return profileElement;
    }

    async selectProfile(profileId) {
        this.currentProfileId = profileId;
        
        // Update UI
        document.querySelectorAll('.profile-btn').forEach(btn => {
            btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700');
            btn.classList.add('border-gray-200');
        });
        
        const selectedBtn = document.querySelector(`.profile-btn[onclick*="${profileId}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700');
        }
        
        // Load profile-specific data
        await this.loadAudioFiles();
        await this.loadTranscriptionResults();
        
        showNotification('Profile selected', 'info');
    }

    async loadAudioFiles() {
        if (!this.currentProfileId) return;

        try {
            const response = await apiGet(`/api/upload/files/${this.currentProfileId}`);
            const audioFilesList = document.getElementById('audioFilesList');
            const transcribeAllBtn = document.getElementById('transcribeAllBtn');
            
            if (response.success) {
                this.audioFiles = response.data.filter(file => file.file_type === 'audio');
                
                if (this.audioFiles.length > 0) {
                    audioFilesList.innerHTML = this.audioFiles.map(file => this.createAudioFileElement(file)).join('');
                    transcribeAllBtn.classList.remove('hidden');
                } else {
                    audioFilesList.innerHTML = `
                        <div class="text-center py-8">
                            <div class="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-music text-gray-400 text-2xl"></i>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-700 mb-2">No Audio Files</h3>
                            <p class="text-gray-500">Upload audio files to start transcription</p>
                            <a href="#upload" class="btn btn-primary mt-4" data-page="upload">
                                <i class="fas fa-cloud-upload-alt mr-2"></i>Upload Files
                            </a>
                        </div>
                    `;
                    transcribeAllBtn.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Error loading audio files:', error);
        }
    }

    createAudioFileElement(file) {
        const fileSize = this.formatFileSize(file.file_size);
        const uploadDate = new Date(file.upload_date).toLocaleDateString();
        
        return `
            <div class="audio-file-item flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div class="flex items-center space-x-4 flex-1">
                    <div class="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-music text-white"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-medium text-gray-800 truncate">${file.filename}</h4>
                        <p class="text-sm text-gray-500">${fileSize} • Uploaded ${uploadDate}</p>
                    </div>
                </div>
                
                <div class="flex items-center space-x-3">
                    <span class="px-3 py-1 text-xs rounded-full ${
                        file.processed 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }">
                        ${file.processed ? 'Processed' : 'Pending'}
                    </span>
                    
                    ${!file.processed ? `
                        <button class="transcribe-single-btn btn btn-primary btn-sm" data-file-id="${file.id}">
                            <i class="fas fa-bolt mr-1"></i>Transcribe
                        </button>
                    ` : `
                        <button class="view-transcript-btn btn btn-outline-primary btn-sm" data-file-id="${file.id}">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    async loadTranscriptionResults() {
        if (!this.currentProfileId) return;

        try {
            const response = await apiGet(`/api/transcribe/results/${this.currentProfileId}`);
            const resultsContainer = document.getElementById('transcriptionResults');
            
            if (response.success && response.data.length > 0) {
                this.transcriptions = response.data;
                resultsContainer.innerHTML = this.transcriptions.map(transcript => this.createTranscriptElement(transcript)).join('');
            } else {
                resultsContainer.innerHTML = `
                    <div class="text-center py-8">
                        <div class="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-file-alt text-gray-400 text-2xl"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-700 mb-2">No Transcriptions Yet</h3>
                        <p class="text-gray-500">Transcribe audio files to see results here</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading transcription results:', error);
        }
    }

    createTranscriptElement(transcript) {
        const createdDate = new Date(transcript.created_at).toLocaleDateString();
        const confidence = Math.round((transcript.confidence || 0) * 100);
        const method = transcript.transcription_method === 'whisper_api' ? 'OpenAI API' : 'Local';
        
        return `
            <div class="transcript-item bg-white rounded-xl p-4 border border-gray-200">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <h4 class="font-semibold text-gray-800">Transcription Result</h4>
                        <p class="text-sm text-gray-500">${createdDate} • ${method} • ${confidence}% confidence</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="view-full-btn btn btn-outline-primary btn-sm" data-transcript-id="${transcript.id}">
                            <i class="fas fa-expand mr-1"></i>Full Text
                        </button>
                    </div>
                </div>
                
                <div class="prose max-w-none">
                    <p class="text-gray-700 line-clamp-3">${this.escapeHtml(transcript.cleaned_text || transcript.original_text)}</p>
                </div>
                
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <span class="text-xs text-gray-500">
                        Processing time: ${transcript.processing_time || 0}s
                    </span>
                    <div class="flex space-x-2">
                        <button class="copy-btn text-gray-400 hover:text-blue-500 transition-colors" data-text="${this.escapeHtml(transcript.cleaned_text || transcript.original_text)}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async transcribeSingleFile(fileId) {
        if (!this.currentProfileId) return;

        try {
            const useApi = document.getElementById('transcriptionMethod').value === 'api';
            const language = document.getElementById('transcriptionLanguage').value;
            
            const response = await apiPost(`/api/transcribe/${fileId}`, {
                use_api: useApi,
                language: language
            });

            if (response.success) {
                showNotification('Transcription started', 'success');
                this.currentTaskId = response.data.task_id;
                this.showProgressModal();
                this.startProgressTracking();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Transcription error:', error);
            showNotification('Failed to start transcription: ' + error.message, 'error');
        }
    }

    async transcribeAllFiles() {
        if (!this.currentProfileId) return;

        const unprocessedFiles = this.audioFiles.filter(file => !file.processed);
        if (unprocessedFiles.length === 0) {
            showNotification('All files have been processed', 'info');
            return;
        }

        try {
            const useApi = document.getElementById('transcriptionMethod').value === 'api';
            const language = document.getElementById('transcriptionLanguage').value;
            
            const response = await apiPost(`/api/transcribe/batch/${this.currentProfileId}`, {
                use_api: useApi,
                language: language
            });

            if (response.success) {
                showNotification(`Started transcription for ${unprocessedFiles.length} files`, 'success');
                this.currentTaskId = response.data.task_id;
                this.showProgressOverview();
                this.startProgressTracking();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Batch transcription error:', error);
            showNotification('Failed to start batch transcription: ' + error.message, 'error');
        }
    }

    showProgressModal() {
        const modal = document.getElementById('progressModal');
        const content = document.getElementById('progressModalContent');
        
        content.innerHTML = `
            <div class="text-center">
                <div class="loading-spinner blue mx-auto mb-4"></div>
                <p class="text-gray-600 mb-2">Processing transcription...</p>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div id="modalProgressBar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
                <p id="modalProgressText" class="text-sm text-gray-500 mt-2">Initializing...</p>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }

    hideProgressModal() {
        document.getElementById('progressModal').classList.add('hidden');
        this.stopProgressTracking();
    }

    showProgressOverview() {
        const overview = document.getElementById('progressOverview');
        overview.classList.remove('hidden');
        
        this.updateProgressOverview();
    }

    updateProgressOverview() {
        const processed = this.audioFiles.filter(f => f.processed).length;
        const total = this.audioFiles.length;
        const progress = total > 0 ? (processed / total) * 100 : 0;
        
        document.getElementById('overallProgressBar').style.width = `${progress}%`;
        document.getElementById('processedCount').textContent = processed;
        document.getElementById('pendingCount').textContent = total - processed;
        document.getElementById('currentTask').textContent = 'Batch Transcription';
    }

    async startProgressTracking() {
        if (!this.currentTaskId) return;

        this.progressInterval = setInterval(async () => {
            try {
                const response = await apiGet(`/api/transcribe/progress/${this.currentTaskId}`);
                
                if (response.success) {
                    this.updateProgressDisplay(response.data);
                    
                    // Stop tracking if task is completed or failed
                    if (response.data.status === 'completed' || response.data.status === 'failed') {
                        this.stopProgressTracking();
                        
                        if (response.data.status === 'completed') {
                            showNotification('Transcription completed successfully!', 'success');
                            await this.loadAudioFiles();
                            await this.loadTranscriptionResults();
                            this.updateProgressOverview();
                        } else {
                            showNotification('Transcription failed: ' + response.data.message, 'error');
                        }
                    }
                }
            } catch (error) {
                console.error('Progress tracking error:', error);
            }
        }, 1000);
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    updateProgressDisplay(progress) {
        // Update modal progress
        const modalProgressBar = document.getElementById('modalProgressBar');
        const modalProgressText = document.getElementById('modalProgressText');
        
        if (modalProgressBar && modalProgressText) {
            const progressPercent = Math.round(progress.progress);
            modalProgressBar.style.width = `${progressPercent}%`;
            modalProgressText.textContent = progress.message;
        }
        
        // Update overview progress
        this.updateProgressOverview();
    }

    showTranscriptModal(transcriptId) {
        const transcript = this.transcriptions.find(t => t.id == transcriptId);
        if (!transcript) return;
        
        const modal = document.getElementById('transcriptModal');
        const content = document.getElementById('transcriptContent');
        
        content.innerHTML = `
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 class="font-semibold text-gray-800 mb-2">Transcription Details</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-gray-600">Method:</span>
                        <span class="font-medium">${transcript.transcription_method === 'whisper_api' ? 'OpenAI API' : 'Local'}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Confidence:</span>
                        <span class="font-medium">${Math.round((transcript.confidence || 0) * 100)}%</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Processing Time:</span>
                        <span class="font-medium">${transcript.processing_time || 0}s</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Date:</span>
                        <span class="font-medium">${new Date(transcript.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            <div class="prose max-w-none">
                <h4 class="font-semibold text-gray-800 mb-3">Transcribed Text</h4>
                <div class="bg-white border border-gray-200 rounded-lg p-4">
                    <p class="whitespace-pre-wrap text-gray-700">${this.escapeHtml(transcript.cleaned_text || transcript.original_text)}</p>
                </div>
            </div>
        `;
        
        // Store current transcript for export/copy
        this.currentTranscript = transcript;
        
        modal.classList.remove('hidden');
    }

    hideTranscriptModal() {
        document.getElementById('transcriptModal').classList.add('hidden');
        this.currentTranscript = null;
    }

    copyTranscript() {
        if (!this.currentTranscript) return;
        
        const text = this.currentTranscript.cleaned_text || this.currentTranscript.original_text;
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Transcript copied to clipboard', 'success');
        }).catch(() => {
            showNotification('Failed to copy transcript', 'error');
        });
    }

    exportCurrentTranscript() {
        if (!this.currentTranscript) return;
        
        const data = {
            transcript: this.currentTranscript,
            export_date: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `transcript-${this.currentTranscript.id}-${Date.now()}.json`;
        link.click();
        
        showNotification('Transcript exported successfully', 'success');
    }

    exportAllTranscripts() {
        if (this.transcriptions.length === 0) {
            showNotification('No transcripts to export', 'warning');
            return;
        }
        
        const data = {
            transcripts: this.transcriptions,
            export_date: new Date().toISOString(),
            profile_id: this.currentProfileId
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `all-transcripts-${Date.now()}.json`;
        link.click();
        
        showNotification('All transcripts exported successfully', 'success');
    }

    clearCompletedTranscriptions() {
        showNotification('Clear completed feature coming soon!', 'info');
    }

    saveSettings() {
        const settings = {
            method: document.getElementById('transcriptionMethod').value,
            language: document.getElementById('transcriptionLanguage').value,
            background: document.getElementById('backgroundProcessing').checked
        };
        
        localStorage.setItem('transcriptionSettings', JSON.stringify(settings));
    }

    loadSettings() {
        const saved = localStorage.getItem('transcriptionSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            document.getElementById('transcriptionMethod').value = settings.method || 'api';
            document.getElementById('transcriptionLanguage').value = settings.language || 'en';
            document.getElementById('backgroundProcessing').checked = settings.background !== false;
        }
    }

    // Event delegation for dynamic elements
    delegateEvents() {
        document.addEventListener('click', (e) => {
            // Transcribe single file buttons
            if (e.target.closest('.transcribe-single-btn')) {
                const button = e.target.closest('.transcribe-single-btn');
                const fileId = button.getAttribute('data-file-id');
                this.transcribeSingleFile(fileId);
            }
            
            // View transcript buttons
            if (e.target.closest('.view-transcript-btn')) {
                const button = e.target.closest('.view-transcript-btn');
                const fileId = button.getAttribute('data-file-id');
                // This would need to be implemented to find the transcript for this file
            }
            
            // View full transcript buttons
            if (e.target.closest('.view-full-btn')) {
                const button = e.target.closest('.view-full-btn');
                const transcriptId = button.getAttribute('data-transcript-id');
                this.showTranscriptModal(transcriptId);
            }
            
            // Copy transcript buttons
            if (e.target.closest('.copy-btn')) {
                const button = e.target.closest('.copy-btn');
                const text = button.getAttribute('data-text');
                navigator.clipboard.writeText(text).then(() => {
                    showNotification('Text copied to clipboard', 'success');
                });
            }
        });
    }

    // Utility methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize transcription manager when DOM is loaded
let transcriptionManager;
document.addEventListener('DOMContentLoaded', function() {
    transcriptionManager = new TranscriptionManager();
    transcriptionManager.delegateEvents();
    transcriptionManager.loadSettings();
});