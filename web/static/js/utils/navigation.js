// Enhanced navigation system
class NavigationManager {
    constructor() {
        this.currentPage = 'dashboard';
        this.pages = new Map();
        this.isNavigating = false;
        
        this.initializeNavigation();
        this.loadPageTemplates();
    }

    initializeNavigation() {
        // Handle navigation links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-page]');
            if (link) {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.navigateTo(page);
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.handlePopState(e.state.page);
            }
        });

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            const page = this.getPageFromHash();
            if (page && page !== this.currentPage) {
                this.navigateTo(page, false);
            }
        });

        // Initial page load
        const initialPage = this.getPageFromHash() || 'dashboard';
        this.navigateTo(initialPage, false);
    }

    async loadPageTemplates() {
        // Preload page templates for faster navigation
        const pages = ['dashboard', 'profiles', 'upload', 'transcription', 'chat', 'visualization'];
        
        for (const page of pages) {
            try {
                const response = await fetch(`/templates/${page}.html`);
                if (response.ok) {
                    const html = await response.text();
                    this.pages.set(page, html);
                }
            } catch (error) {
                console.warn(`Failed to preload ${page} template:`, error);
            }
        }
    }

    async navigateTo(page, pushState = true) {
        if (this.isNavigating || page === this.currentPage) {
            return;
        }

        this.isNavigating = true;

        try {
            // Update URL
            if (pushState) {
                history.pushState({ page }, '', `#${page}`);
            }

            // Show loading state
            this.showLoading();

            // Update navigation
            this.updateActiveNav(page);

            // Load page content
            await this.loadPageContent(page);

            // Update current page
            this.currentPage = page;

            // Initialize page-specific functionality
            this.initializePageScripts(page);

        } catch (error) {
            console.error('Navigation error:', error);
            this.showErrorPage();
        } finally {
            this.hideLoading();
            this.isNavigating = false;
        }
    }

    updateActiveNav(page) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to current nav item
        const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        // Update page title and breadcrumbs
        this.updatePageMetadata(page);
    }

    updatePageMetadata(page) {
        const pageMetadata = {
            dashboard: {
                title: 'Dashboard',
                breadcrumbs: ['Eternal Voice', 'Dashboard']
            },
            profiles: {
                title: 'Profiles',
                breadcrumbs: ['Eternal Voice', 'Profiles', 'Management']
            },
            upload: {
                title: 'Upload Files',
                breadcrumbs: ['Eternal Voice', 'Upload', 'File Management']
            },
            transcription: {
                title: 'Transcription',
                breadcrumbs: ['Eternal Voice', 'Transcription', 'Audio Processing']
            },
            chat: {
                title: 'Chat',
                breadcrumbs: ['Eternal Voice', 'Chat', 'Conversation']
            },
            visualization: {
                title: 'Analytics',
                breadcrumbs: ['Eternal Voice', 'Analytics', 'Insights']
            }
        };

        const metadata = pageMetadata[page] || {
            title: 'Eternal Voice',
            breadcrumbs: ['Eternal Voice']
        };

        // Update page title
        document.getElementById('pageTitle').textContent = metadata.title;

        // Update breadcrumbs
        this.updateBreadcrumbs(metadata.breadcrumbs);
    }

    updateBreadcrumbs(crumbs) {
        const breadcrumbsContainer = document.getElementById('breadcrumbs');
        if (breadcrumbsContainer) {
            breadcrumbsContainer.innerHTML = crumbs.map((crumb, index) => {
                if (index === crumbs.length - 1) {
                    return `<span class="text-blue-600 font-medium">${crumb}</span>`;
                }
                return `<span class="text-gray-500">${crumb}</span>`;
            }).join(' <span class="text-gray-400 mx-2">></span> ');
        }
    }

    async loadPageContent(page) {
        let html;

        // Check if page is preloaded
        if (this.pages.has(page)) {
            html = this.pages.get(page);
        } else {
            // Fetch page content
            const response = await fetch(`/templates/${page}.html`);
            if (!response.ok) {
                throw new Error(`Page ${page} not found`);
            }
            html = await response.text();
            this.pages.set(page, html);
        }

        // Update main content with fade animation
        const mainContent = document.getElementById('main-content');
        
        // Fade out current content
        mainContent.style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Update content
        mainContent.innerHTML = html;
        
        // Fade in new content
        mainContent.style.opacity = '1';
        mainContent.style.transition = 'opacity 0.3s ease-in-out';
    }

    initializePageScripts(page) {
        // Initialize page-specific JavaScript
        const scripts = {
            dashboard: () => {
                if (typeof dashboardManager !== 'undefined') {
                    dashboardManager.initialize();
                }
            },
            profiles: () => {
                // Profiles manager would be initialized here
                console.log('Initializing profiles page');
            },
            upload: () => {
                if (typeof uploadManager !== 'undefined') {
                    uploadManager.initialize();
                }
            },
            transcription: () => {
                // Transcription manager would be initialized here
                console.log('Initializing transcription page');
            },
            chat: () => {
                if (typeof chatManager !== 'undefined') {
                    chatManager.initialize();
                }
            },
            visualization: () => {
                if (typeof analyticsDashboard !== 'undefined') {
                    analyticsDashboard.initialize();
                }
            }
        };

        if (scripts[page]) {
            scripts[page]();
        }

        // Trigger page loaded event
        this.triggerPageLoaded(page);
    }

    triggerPageLoaded(page) {
        const event = new CustomEvent('pageLoaded', {
            detail: { page }
        });
        document.dispatchEvent(event);
    }

    handlePopState(page) {
        if (page !== this.currentPage) {
            this.navigateTo(page, false);
        }
    }

    getPageFromHash() {
        const hash = window.location.hash.substring(1);
        return hash || 'dashboard';
    }

    showLoading() {
        // You can add a global loading indicator here
        document.body.classList.add('loading');
    }

    hideLoading() {
        document.body.classList.remove('loading');
    }

    showErrorPage() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="fade-in">
                <div class="text-center py-16">
                    <div class="w-24 h-24 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <i class="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-2">Page Load Error</h2>
                    <p class="text-gray-600 mb-6">We couldn't load the requested page. Please try again.</p>
                    <button onclick="navigation.navigateTo('dashboard')" class="btn btn-primary">
                        <i class="fas fa-home mr-2"></i>Return to Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    // Utility method to refresh current page
    refresh() {
        this.navigateTo(this.currentPage, false);
    }

    // Method to get current page
    getCurrentPage() {
        return this.currentPage;
    }

    // Method to check if we're on a specific page
    isCurrentPage(page) {
        return this.currentPage === page;
    }
}

// Global navigation manager
const navigation = new NavigationManager();

// Helper function for programmatic navigation
function navigateTo(page) {
    navigation.navigateTo(page);
}

// Helper function to refresh current page
function refreshPage() {
    navigation.refresh();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { navigation, navigateTo, refreshPage };
}