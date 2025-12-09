// Enhanced animation utilities
class AnimationManager {
    constructor() {
        this.animations = new Map();
    }

    // Page transition animations
    async fadeInPage(element, duration = 600) {
        return new Promise((resolve) => {
            element.style.opacity = '0';
            element.style.display = 'block';
            
            let start = null;
            const animate = (timestamp) => {
                if (!start) start = timestamp;
                const progress = timestamp - start;
                const opacity = Math.min(progress / duration, 1);
                
                element.style.opacity = opacity;
                
                if (progress < duration) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    async fadeOutPage(element, duration = 400) {
        return new Promise((resolve) => {
            let start = null;
            const animate = (timestamp) => {
                if (!start) start = timestamp;
                const progress = timestamp - start;
                const opacity = Math.max(1 - progress / duration, 0);
                
                element.style.opacity = opacity;
                
                if (progress < duration) {
                    requestAnimationFrame(animate);
                } else {
                    element.style.display = 'none';
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    // Loading animations
    createLoadingSpinner(container, message = 'Loading...') {
        const spinnerId = 'spinner-' + Date.now();
        const spinnerHTML = `
            <div id="${spinnerId}" class="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
                <div class="text-center">
                    <div class="loading-spinner blue mx-auto mb-4"></div>
                    <p class="text-gray-600">${message}</p>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', spinnerHTML);
        return spinnerId;
    }

    removeLoadingSpinner(spinnerId) {
        const spinner = document.getElementById(spinnerId);
        if (spinner) {
            spinner.remove();
        }
    }

    // Progress bar animations
    animateProgressBar(progressBar, targetValue, duration = 1000) {
        return new Promise((resolve) => {
            const startValue = parseInt(progressBar.style.width) || 0;
            const startTime = performance.now();
            
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function for smooth animation
                const easeProgress = this.easeOutCubic(progress);
                const currentValue = startValue + (targetValue - startValue) * easeProgress;
                
                progressBar.style.width = currentValue + '%';
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    // Easing functions
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // Stagger animations for lists
    staggerElements(elements, delay = 100) {
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                element.style.transition = 'all 0.5s ease-out';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * delay);
        });
    }

    // Pulse animation for attention
    pulseElement(element, count = 3, duration = 500) {
        let iterations = 0;
        
        const pulse = () => {
            element.style.transform = 'scale(1.1)';
            element.style.transition = `transform ${duration/2}ms ease-in-out`;
            
            setTimeout(() => {
                element.style.transform = 'scale(1)';
                
                iterations++;
                if (iterations < count) {
                    setTimeout(pulse, duration);
                }
            }, duration/2);
        };
        
        pulse();
    }

    // Typewriter effect
    async typewriterEffect(element, text, speed = 50) {
        return new Promise((resolve) => {
            element.textContent = '';
            let i = 0;
            
            const type = () => {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                } else {
                    resolve();
                }
            };
            
            type();
        });
    }

    // Confetti celebration
    createConfetti(container, duration = 3000) {
        const confettiCount = 150;
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                top: -10px;
                left: ${Math.random() * 100}%;
                opacity: ${Math.random() * 0.5 + 0.5};
                transform: rotate(${Math.random() * 360}deg);
                z-index: 1000;
            `;
            
            container.appendChild(confetti);
            
            // Animate confetti
            const animation = confetti.animate([
                { transform: `translateY(0px) rotate(0deg)`, opacity: 1 },
                { transform: `translateY(${window.innerHeight}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
            ], {
                duration: duration + Math.random() * 1000,
                easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)'
            });
            
            animation.onfinish = () => confetti.remove();
        }
    }
}

// Global animation manager
const animations = new AnimationManager();

// Utility functions for common animations
function fadeIn(element, duration = 400) {
    return animations.fadeInPage(element, duration);
}

function fadeOut(element, duration = 400) {
    return animations.fadeOutPage(element, duration);
}

function showLoading(message = 'Loading...') {
    return animations.createLoadingSpinner(document.body, message);
}

function hideLoading(spinnerId) {
    animations.removeLoadingSpinner(spinnerId);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { animations, fadeIn, fadeOut, showLoading, hideLoading };
}