class AnalyticsDashboard {
    constructor() {
        this.currentProfileId = null;
        this.charts = new Map();
        this.analyticsData = null;
        
        this.initializeEventListeners();
        this.loadProfiles();
    }

    initializeEventListeners() {
        // Profile selection
        document.getElementById('vizProfileSelector').addEventListener('change', (e) => {
            this.selectProfile(e.target.value);
        });

        // Refresh data
        document.getElementById('refreshDataBtn').addEventListener('click', () => {
            if (this.currentProfileId) {
                this.loadAnalyticsData();
            }
        });

        // Timeline range
        document.getElementById('timelineRange').addEventListener('change', () => {
            if (this.currentProfileId) {
                this.loadAnalyticsData();
            }
        });

        // Export buttons
        document.getElementById('exportPDFBtn').addEventListener('click', () => {
            this.exportPDF();
        });

        document.getElementById('exportJSONBtn').addEventListener('click', () => {
            this.exportJSON();
        });

        document.getElementById('exportImageBtn').addEventListener('click', () => {
            this.exportCharts();
        });
    }

    async loadProfiles() {
        try {
            const response = await apiGet('/api/profiles/');
            const selector = document.getElementById('vizProfileSelector');
            
            if (response.success && response.data.length > 0) {
                // Clear existing options except the first one
                while (selector.children.length > 1) {
                    selector.removeChild(selector.lastChild);
                }
                
                // Add profile options
                response.data.forEach(profile => {
                    const option = document.createElement('option');
                    option.value = profile.id;
                    option.textContent = `${profile.name} (${profile.relationship || 'No relationship'})`;
                    selector.appendChild(option);
                });
                
            } else {
                this.showNoDataState();
            }
        } catch (error) {
            console.error('Error loading profiles:', error);
            this.showNoDataState();
        }
    }

    async selectProfile(profileId) {
        if (!profileId) {
            this.resetDashboard();
            return;
        }

        this.currentProfileId = profileId;
        this.showLoadingState();
        
        try {
            await this.loadAnalyticsData();
        } catch (error) {
            console.error('Error loading analytics:', error);
            showNotification('Failed to load analytics data', 'error');
            this.showNoDataState();
        }
    }

    async loadAnalyticsData() {
        if (!this.currentProfileId) return;
        
        try {
            // Show loading state
            this.showLoadingState();
            
            // Load conversation summary
            const summaryResponse = await apiGet(`/api/chat/summary/${this.currentProfileId}`);
            
            // Load persona data
            const personaResponse = await apiGet(`/api/chat/persona/${this.currentProfileId}`);
            
            // Load visualization data
            const vizResponse = await apiGet(`/api/visualize/data/${this.currentProfileId}`);
            
            if (summaryResponse.success && vizResponse.success) {
                this.analyticsData = {
                    summary: summaryResponse.data,
                    persona: personaResponse.success ? personaResponse.data : null,
                    visualization: vizResponse.data
                };
                
                this.displayAnalyticsData();
                this.showAnalyticsContent();
            } else {
                throw new Error('Failed to load analytics data');
            }
            
        } catch (error) {
            console.error('Error loading analytics data:', error);
            this.showNoDataState();
        }
    }

    displayAnalyticsData() {
        this.updateOverviewCards();
        this.createCharts();
        this.updateDetailedInsights();
    }

    updateOverviewCards() {
        const data = this.analyticsData.summary;
        
        document.getElementById('totalConversations').textContent = data.total_messages || 0;
        document.getElementById('wordsAnalyzed').textContent = this.calculateWordCount(data);
        document.getElementById('emotionPatterns').textContent = this.countEmotionPatterns(data);
        document.getElementById('memoryDensity').textContent = this.calculateMemoryDensity(data);
    }

    calculateWordCount(data) {
        if (!data.recent_messages) return 0;
        
        let wordCount = 0;
        data.recent_messages.forEach(msg => {
            wordCount += (msg.user_message || '').split(/\s+/).length;
            wordCount += (msg.ai_response || '').split(/\s+/).length;
        });
        
        return wordCount.toLocaleString();
    }

    countEmotionPatterns(data) {
        if (!data.recent_messages) return 0;
        
        const emotions = new Set();
        data.recent_messages.forEach(msg => {
            if (msg.emotion) emotions.add(msg.emotion);
        });
        
        return emotions.size;
    }

    calculateMemoryDensity(data) {
        // This is a simplified calculation - in a real app, you'd use more sophisticated metrics
        if (!data.total_messages) return '0%';
        
        const density = Math.min(100, Math.max(0, (data.total_messages / 100) * 100));
        return `${Math.round(density)}%`;
    }

    createCharts() {
        this.destroyExistingCharts();
        this.createEmotionTimelineChart();
        this.createWordFrequencyChart();
        this.createEmotionDistributionChart();
        this.createConversationPatternsChart();
    }

    createEmotionTimelineChart() {
        const ctx = document.getElementById('emotionTimelineChart').getContext('2d');
        
        // Sample data - in a real app, this would come from the API
        const data = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
                {
                    label: 'Joy',
                    data: [65, 59, 80, 81, 56, 55],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Sadness',
                    data: [28, 48, 40, 19, 86, 27],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Neutral',
                    data: [45, 25, 36, 48, 25, 42],
                    borderColor: '#6b7280',
                    backgroundColor: 'rgba(107, 114, 128, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };

        const chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        this.charts.set('emotionTimeline', chart);
    }

    createWordFrequencyChart() {
        const ctx = document.getElementById('wordFrequencyChart').getContext('2d');
        
        // Sample data
        const data = {
            labels: ['Love', 'Family', 'Happy', 'Remember', 'Time', 'Life', 'Good', 'Home', 'Friend', 'Hope'],
            datasets: [{
                data: [12, 9, 8, 7, 6, 5, 4, 3, 3, 2],
                backgroundColor: [
                    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };

        const chart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        this.charts.set('wordFrequency', chart);
    }

    createEmotionDistributionChart() {
        const ctx = document.getElementById('emotionDistributionChart').getContext('2d');
        
        const data = {
            labels: ['Joy', 'Neutral', 'Sadness', 'Surprise', 'Fear', 'Anger'],
            datasets: [{
                data: [35, 25, 15, 12, 8, 5],
                backgroundColor: [
                    '#f59e0b', '#6b7280', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        this.charts.set('emotionDistribution', chart);
    }

    createConversationPatternsChart() {
        const ctx = document.getElementById('conversationPatternsChart').getContext('2d');
        
        const data = {
            labels: ['Morning', 'Afternoon', 'Evening', 'Night'],
            datasets: [{
                label: 'Conversation Frequency',
                data: [12, 19, 8, 5],
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                borderColor: '#8b5cf6',
                borderWidth: 2,
                fill: true
            }]
        };

        const chart = new Chart(ctx, {
            type: 'radar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 20
                    }
                }
            }
        });

        this.charts.set('conversationPatterns', chart);
    }

    updateDetailedInsights() {
        this.updateWritingStyleAnalysis();
        this.updateEmotionalProfile();
        this.updateConversationInsights();
    }

    updateWritingStyleAnalysis() {
        const persona = this.analyticsData.persona;
        
        if (persona && persona.writing_style) {
            const style = persona.writing_style;
            
            // Sentence complexity
            const complexity = Math.min(100, (style.avg_sentence_length || 0) * 5);
            document.getElementById('sentenceComplexity').textContent = 
                style.complexity || 'Moderate';
            document.getElementById('complexityBar').style.width = `${complexity}%`;
            
            // Vocabulary diversity
            const diversity = Math.min(100, (style.vocabulary_size || 0) / 10);
            document.getElementById('vocabularyDiversity').textContent = 
                diversity > 70 ? 'Rich' : diversity > 40 ? 'Moderate' : 'Basic';
            document.getElementById('diversityBar').style.width = `${diversity}%`;
            
            // Emotional expressiveness
            const emotionalTone = persona.emotional_tone || {};
            const expressiveness = (emotionalTone.confidence || 0) * 100;
            document.getElementById('emotionalExpressiveness').textContent = 
                expressiveness > 70 ? 'High' : expressiveness > 40 ? 'Moderate' : 'Low';
            document.getElementById('expressivenessBar').style.width = `${expressiveness}%`;
        }
    }

    updateEmotionalProfile() {
        const emotionsContainer = document.getElementById('topEmotions');
        emotionsContainer.innerHTML = '';
        
        const emotions = [
            { name: 'Joy', value: 35, color: 'bg-yellow-100 text-yellow-700' },
            { name: 'Neutral', value: 25, color: 'bg-gray-100 text-gray-700' },
            { name: 'Sadness', value: 15, color: 'bg-blue-100 text-blue-700' },
            { name: 'Surprise', value: 12, color: 'bg-green-100 text-green-700' },
            { name: 'Fear', value: 8, color: 'bg-purple-100 text-purple-700' }
        ];
        
        emotions.forEach(emotion => {
            const emotionElement = document.createElement('div');
            emotionElement.className = 'flex items-center justify-between';
            emotionElement.innerHTML = `
                <span class="px-3 py-1 ${emotion.color} rounded-full text-sm font-medium">${emotion.name}</span>
                <span class="text-sm font-semibold text-gray-700">${emotion.value}%</span>
            `;
            emotionsContainer.appendChild(emotionElement);
        });
    }

    updateConversationInsights() {
        const insightsContainer = document.getElementById('conversationInsights');
        insightsContainer.innerHTML = '';
        
        const insights = [
            "Most conversations happen in the evening",
            "Frequently uses words related to family and memories",
            "Shows high emotional expressiveness in personal topics",
            "Prefers longer, more detailed sentences",
            "Conversation length averages 8-12 messages per session"
        ];
        
        insights.forEach(insight => {
            const insightElement = document.createElement('div');
            insightElement.className = 'flex items-start space-x-2';
            insightElement.innerHTML = `
                <i class="fas fa-check-circle text-green-500 mt-1"></i>
                <span class="text-sm text-gray-700">${insight}</span>
            `;
            insightsContainer.appendChild(insightElement);
        });
    }

    destroyExistingCharts() {
        this.charts.forEach((chart, key) => {
            chart.destroy();
        });
        this.charts.clear();
    }

    showLoadingState() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('analyticsContent').classList.add('hidden');
        document.getElementById('noDataState').classList.add('hidden');
    }

    showAnalyticsContent() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('analyticsContent').classList.remove('hidden');
        document.getElementById('noDataState').classList.add('hidden');
    }

    showNoDataState() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('analyticsContent').classList.add('hidden');
        document.getElementById('noDataState').classList.remove('hidden');
    }

    resetDashboard() {
        this.currentProfileId = null;
        this.analyticsData = null;
        this.destroyExistingCharts();
        this.showNoDataState();
    }

    exportPDF() {
        showNotification('PDF export feature coming soon!', 'info');
        // In a real implementation, you would generate a PDF report
    }

    exportJSON() {
        if (!this.analyticsData) {
            showNotification('No data to export', 'warning');
            return;
        }
        
        try {
            const dataStr = JSON.stringify(this.analyticsData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `analytics-${this.currentProfileId}-${Date.now()}.json`;
            link.click();
            
            showNotification('Analytics data exported successfully', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showNotification('Failed to export data', 'error');
        }
    }

    exportCharts() {
        showNotification('Chart export feature coming soon!', 'info');
        // In a real implementation, you would export chart images
    }
}

// Initialize dashboard when DOM is loaded
let analyticsDashboard;
document.addEventListener('DOMContentLoaded', function() {
    analyticsDashboard = new AnalyticsDashboard();
});