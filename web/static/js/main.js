/**
 * Eternal Voice - Main Application Entry Point
 * Orchestrates navigation, state management, and module initialization.
 * Load this file LAST in base.html.
 */

class EternalVoiceApp {
    constructor() {
        this.isInitialized = false;
        this.modules = new Map();
        this.currentUser = null;

        this.state = {
            currentPage: 'dashboard',
            activeProfile: null,
            isOnline: navigator.onLine,
            isLoading: false
        };

        this.userPreferences = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        console.log('🚀 Initializing Eternal Voice Application...');

        try {
            this.showLoadingScreen();

            // 1. Load preferences first (needed for theme)
            await this.loadUserPreferences();

            // 2. Initialize core systems
            await this.initializeCoreModules();

            // 3. Initialize the current page (Dashboard by default)
            await this.initializePageModules();

            // 4. Setup global listeners
            this.setupGlobalEvents();

            this.hideLoadingScreen();
            this.isInitialized = true;
            console.log('✅ Eternal Voice Application initialized successfully');

            this.dispatchEvent('appReady');

            // Listen for data updates to refresh UI
            document.addEventListener('eternalVoice:profilesUpdated', (e) => {
                console.log('🔄 Data Update:', e.detail);
                if (this.modules.has('dashboard') && typeof this.modules.get('dashboard').refresh === 'function') {
                    this.modules.get('dashboard').refresh();
                }
            });

        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            this.showErrorScreen(error);
        }
    }

    async initializeCoreModules() {
        console.log('🔧 Initializing core modules...');
        this.initializeAPIClient();
        this.initializeNotifications();
        this.initializeNavigation();
        this.initializeTheme();
    }

    initializeAPIClient() {
        console.log('✅ API client ready');
    }

    initializeNotifications() {
        // Ensure global notification helpers exist
        if (!window.showNotification) {
            window.showNotification = (m) => alert(m);
            window.showError = (m) => alert('Error: ' + m);
            window.showSuccess = (m) => alert(m);
            window.showInfo = (m) => alert(m);
        }
        console.log('✅ Notification system ready');
    }

    initializeNavigation() {
        // Listen for internal navigation events
        document.addEventListener('eternalVoice:pageChanged', (e) => {
            const newPage = e.detail.to ?? e.detail.page;
            if (newPage) this.handlePageChange(newPage);
        });
        console.log('✅ Navigation system ready');
    }

    initializeTheme() {
        const savedTheme = (localStorage.getItem('eternalVoicePreferences') && (() => {
            try { return JSON.parse(localStorage.getItem('eternalVoicePreferences')).theme; } catch(e){ return null; }
        })()) || 'light';
        
        this.applyTheme(savedTheme);
        
        // Bind theme toggle button
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-theme-toggle]')) this.toggleTheme();
        });
        console.log('✅ Theme manager ready');
    }

    async loadUserPreferences() {
        try {
            const pref = localStorage.getItem('eternalVoicePreferences');
            if (pref) {
                this.userPreferences = JSON.parse(pref);
            } else {
                this.userPreferences = this.getDefaultPreferences();
                this.saveUserPreferences();
            }
        } catch (err) {
            console.warn('Failed to load user preferences:', err);
            this.userPreferences = this.getDefaultPreferences();
        }
    }

    getDefaultPreferences() {
        return {
            theme: 'light',
            ttsEnabled: true,
            autoPlayAudio: false,
            language: 'en',
            notifications: true,
            dataRetention: '30days'
        };
    }

    saveUserPreferences() {
        try {
            localStorage.setItem('eternalVoicePreferences', JSON.stringify(this.userPreferences));
        } catch (err) {
            console.warn('Failed to save user preferences:', err);
        }
    }

    // ---------------------------------------------------------
    // PAGE MODULE INITIALIZATION (Crucial Logic)
    // ---------------------------------------------------------
    async initializePageModules() {
        const page = this.state.currentPage;
        console.log(`📄 Initializing module for page: ${page}`);

        switch (page) {
            case 'dashboard':
                if (window.dashboardManager && typeof window.dashboardManager.initialize === 'function') {
                    this.modules.set('dashboard', window.dashboardManager);
                    await window.dashboardManager.initialize();
                }
                break;

            case 'profiles':
                if (window.profilesManager) {
                    this.modules.set('profiles', window.profilesManager);
                    
                    // 👇 FIX: Explicitly tell ProfilesManager to start looking for the HTML
                    console.log("👉 Triggering ProfilesManager.initialize()...");
                    if (typeof window.profilesManager.initialize === 'function') {
                        window.profilesManager.initialize();
                    }
                } else {
                    console.error("❌ ProfilesManager not found! Is profiles.js loaded?");
                }
                break;

            default:
                // Attempt lazy load for other pages
                const managerName = `${page}Manager`;
                const manager = window[managerName];
                if (manager && typeof manager.initialize === 'function') {
                    this.modules.set(page, manager);
                    manager.initialize();
                }
                break;
        }
    }

    // ---------------------------------------------------------
    // EVENT HANDLING
    // ---------------------------------------------------------
    setupGlobalEvents() {
        window.addEventListener('online', () => {
            this.setState({ isOnline: true });
            this.dispatchEvent('connectionRestored');
        });
        window.addEventListener('offline', () => {
            this.setState({ isOnline: false });
            this.dispatchEvent('connectionLost');
        });
        window.addEventListener('beforeunload', () => this.saveApplicationState());
        
        // Error Boundary
        window.addEventListener('error', (event) => this.handleGlobalError(event.error || event));
        window.addEventListener('unhandledrejection', (event) => this.handleGlobalError(event.reason || event));
    }

    handlePageChange(newPage) {
        // 👇 FIX: Stop Infinite Loop / Stack Overflow
        // If we are already initialized and on the target page, do nothing.
        if (this.isInitialized && this.state.currentPage === newPage) {
            return;
        }

        console.log(`🔄 Navigating to: ${newPage}`);
        const oldPage = this.state.currentPage;
        
        // 1. Update State
        this.setState({ currentPage: newPage });
        
        // 2. Initialize the specific logic for this new page
        this.initializePageModules();
        
        // 3. Broadcast change
        this.dispatchEvent('pageChanged', { from: oldPage, to: newPage });
    }

    setState(newState) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };
        this.dispatchEvent('stateChanged', { oldState, newState: this.state });
        this.updateUI();
    }

    updateUI() {
        if (this.state.isLoading) document.body.classList.add('loading'); 
        else document.body.classList.remove('loading');
        
        if (this.state.isOnline) { 
            document.body.classList.remove('offline'); 
            document.body.classList.add('online'); 
        } else { 
            document.body.classList.remove('online'); 
            document.body.classList.add('offline'); 
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (this.userPreferences) {
            this.userPreferences.theme = theme;
            this.saveUserPreferences();
        }
    }

    toggleTheme() {
        const currentTheme = this.userPreferences?.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    showLoadingScreen() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    hideLoadingScreen() {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.style.opacity = '1';
        }, 500);
    }

    showErrorScreen(error) {
        const appContainer = document.getElementById('app');
        if (!appContainer) return;
        
        appContainer.innerHTML = `
            <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
                    <h1 class="text-2xl font-bold text-gray-800 mb-2">Application Error</h1>
                    <p class="text-gray-600 mb-4">We encountered an error starting the application.</p>
                    <div class="bg-red-50 rounded-lg p-4 mb-6 text-left">
                        <code class="text-sm text-red-700">${(error?.message) ? this.escapeHtml(error.message) : String(error)}</code>
                    </div>
                    <button onclick="window.location.reload()" class="btn btn-primary w-full">Reload</button>
                </div>
            </div>
        `;
    }

    handleGlobalError(error) {
        console.error('Global Error:', error);
        // Ignore network errors in UI (usually handled by API module)
        if (error && error.type === 'NETWORK_ERROR') return;
        
        if (window.showError) window.showError(`Application Error: ${error?.message || 'Unknown error'}`);
    }

    saveApplicationState() {
        try {
            const stateToSave = { 
                currentPage: this.state.currentPage, 
                activeProfile: this.state.activeProfile, 
                timestamp: Date.now() 
            };
            sessionStorage.setItem('eternalVoiceState', JSON.stringify(stateToSave));
        } catch (err) {
            console.warn('Failed to save state:', err);
        }
    }

    dispatchEvent(eventName, detail = {}) {
        const evt = new CustomEvent(`eternalVoice:${eventName}`, { detail: { timestamp: Date.now(), ...detail }});
        document.dispatchEvent(evt);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ---------------------------------------------------------
// BOOTSTRAP
// ---------------------------------------------------------

// Create global instance
const eternalVoiceApp = new EternalVoiceApp();
window.eternalVoiceApp = eternalVoiceApp;

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded, bootstrapping application...');
    eternalVoiceApp.initialize();
});

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = eternalVoiceApp;
}

console.log('✅ Main application module loaded');