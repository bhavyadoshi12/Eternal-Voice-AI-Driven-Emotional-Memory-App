// Enhanced notification system
class NotificationManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.createContainer();
        }
        this.notificationId = 0;
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'toastContainer';
        this.container.className = 'fixed top-4 right-4 z-50 space-y-2 max-w-sm';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 5000) {
        const id = this.notificationId++;
        const notification = this.createNotificationElement(message, type, id);
        
        this.container.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('opacity-0', 'translate-x-full');
        }, 10);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }

        return id;
    }

    createNotificationElement(message, type, id) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const colors = {
            success: 'bg-green-500 border-green-600',
            error: 'bg-red-500 border-red-600',
            warning: 'bg-yellow-500 border-yellow-600',
            info: 'bg-blue-500 border-blue-600'
        };

        const notification = document.createElement('div');
        notification.id = `notification-${id}`;
        notification.className = `notification transform translate-x-full opacity-0 transition-all duration-300 ease-in-out ${colors[type]} text-white rounded-xl p-4 shadow-lg border`;
        
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="${icons[type]} text-lg"></i>
                <div class="flex-1">
                    <p class="font-medium">${this.escapeHtml(message)}</p>
                </div>
                <button class="text-white hover:text-gray-200 transition-colors" onclick="notifications.remove(${id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        return notification;
    }

    remove(id) {
        const notification = document.getElementById(`notification-${id}`);
        if (notification) {
            notification.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }

    // Progress notification for long-running tasks
    showProgress(message, taskId) {
        const id = this.show(message, 'info', 0); // No auto-remove
        
        const notification = document.getElementById(`notification-${id}`);
        const content = notification.querySelector('div > div');
        
        content.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="loading-spinner small white"></div>
                <div class="flex-1">
                    <p class="font-medium">${this.escapeHtml(message)}</p>
                    <div class="w-full bg-white bg-opacity-30 rounded-full h-1 mt-2">
                        <div class="bg-white h-1 rounded-full progress-bar" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;

        return {
            update: (progress, newMessage = null) => {
                const progressBar = notification.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.style.width = `${progress}%`;
                }
                
                if (newMessage) {
                    const messageElement = notification.querySelector('p');
                    if (messageElement) {
                        messageElement.textContent = newMessage;
                    }
                }
            },
            complete: (successMessage = null) => {
                if (successMessage) {
                    this.updateNotification(id, successMessage, 'success');
                } else {
                    this.remove(id);
                }
            },
            error: (errorMessage) => {
                this.updateNotification(id, errorMessage, 'error');
            },
            id: id
        };
    }

    updateNotification(id, message, type = 'info') {
        const notification = document.getElementById(`notification-${id}`);
        if (notification) {
            const newNotification = this.createNotificationElement(message, type, id);
            notification.parentNode.replaceChild(newNotification, notification);
            
            setTimeout(() => {
                newNotification.classList.remove('opacity-0', 'translate-x-full');
            }, 10);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global notification manager
const notifications = new NotificationManager();

// Helper functions for common use cases
function showNotification(message, type = 'info', duration = 5000) {
    return notifications.show(message, type, duration);
}

function showSuccess(message, duration = 5000) {
    return notifications.success(message, duration);
}

function showError(message, duration = 5000) {
    return notifications.error(message, duration);
}

function showWarning(message, duration = 5000) {
    return notifications.warning(message, duration);
}

function showInfo(message, duration = 5000) {
    return notifications.info(message, duration);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        notifications, 
        showNotification, 
        showSuccess, 
        showError, 
        showWarning, 
        showInfo 
    };
}