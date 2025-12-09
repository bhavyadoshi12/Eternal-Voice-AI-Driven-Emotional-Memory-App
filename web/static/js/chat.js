class ChatManager {
    constructor() {
        this.currentProfileId = null;
        this.conversationHistory = [];
        this.ttsEnabled = true;
        this.isGenerating = false;
        this.audioPlayers = new Map();
        
        this.initializeEventListeners();
        this.loadProfiles();
        this.loadVoiceSettings();
    }

    initializeEventListeners() {
        // Profile selection
        document.getElementById('profileSelector').addEventListener('change', (e) => {
            this.selectProfile(e.target.value);
        });

        // Message input
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', this.handleInputChange.bind(this));
        messageInput.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Send button
        document.getElementById('sendButton').addEventListener('click', () => {
            this.sendMessage();
        });

        // Action buttons
        document.getElementById('buildPersonaBtn').addEventListener('click', () => {
            this.buildPersona();
        });

        document.getElementById('clearChatBtn').addEventListener('click', () => {
            this.clearChat();
        });

        document.getElementById('exportChatBtn').addEventListener('click', () => {
            this.exportConversation();
        });

        // Voice settings
        document.getElementById('ttsToggle').addEventListener('change', (e) => {
            this.ttsEnabled = e.target.checked;
            this.saveVoiceSettings();
        });

        document.getElementById('voiceSelector').addEventListener('change', () => {
            this.saveVoiceSettings();
        });

        document.getElementById('speechRate').addEventListener('input', (e) => {
            this.updateSpeechRate(e.target.value);
        });

        // Suggestions
        document.getElementById('suggestionsBtn').addEventListener('click', () => {
            this.showSuggestions();
        });

        document.getElementById('closeSuggestionsBtn').addEventListener('click', () => {
            this.hideSuggestions();
        });

        // Suggestion buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-btn')) {
                this.useSuggestion(e.target.textContent.trim());
            }
        });

        // Voice settings button
        document.getElementById('voiceSettingsBtn').addEventListener('click', () => {
            this.showVoiceSettings();
        });
    }

    async loadProfiles() {
        try {
            const response = await apiGet('/api/profiles/');
            const selector = document.getElementById('profileSelector');
            
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
                selector.innerHTML = '<option value="">No profiles available</option>';
            }
        } catch (error) {
            console.error('Error loading profiles:', error);
            showNotification('Failed to load profiles', 'error');
        }
    }

    async selectProfile(profileId) {
        if (!profileId) {
            this.resetChatInterface();
            return;
        }

        this.currentProfileId = profileId;
        
        try {
            // Update UI
            this.updateProfileBadge(profileId);
            this.enableChatInterface();
            
            // Load conversation history
            await this.loadConversationHistory();
            
            // Load persona data
            await this.loadPersonaData();
            
            // Load conversation statistics
            await this.loadConversationStats();
            
            showNotification('Profile loaded successfully', 'success');
            
        } catch (error) {
            console.error('Error selecting profile:', error);
            showNotification('Failed to load profile data', 'error');
        }
    }

    updateProfileBadge(profileId) {
        const selector = document.getElementById('profileSelector');
        const selectedOption = selector.options[selector.selectedIndex];
        const profileName = selectedOption ? selectedOption.textContent.split(' (')[0] : 'Unknown';
        
        const badge = document.getElementById('profileBadge');
        badge.classList.remove('hidden');
        badge.querySelector('span').textContent = profileName;
        
        // Show action buttons
        document.getElementById('buildPersonaBtn').classList.remove('hidden');
        document.getElementById('clearChatBtn').classList.remove('hidden');
    }

    enableChatInterface() {
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendButton').disabled = false;
        document.getElementById('welcomeMessage').classList.add('hidden');
    }

    resetChatInterface() {
        this.currentProfileId = null;
        this.conversationHistory = [];
        
        // Reset UI
        document.getElementById('profileBadge').classList.add('hidden');
        document.getElementById('buildPersonaBtn').classList.add('hidden');
        document.getElementById('clearChatBtn').classList.add('hidden');
        document.getElementById('personaDetails').classList.add('hidden');
        document.getElementById('conversationStats').classList.add('hidden');
        
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendButton').disabled = true;
        document.getElementById('welcomeMessage').classList.remove('hidden');
        
        // Clear chat container
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = '';
        chatContainer.appendChild(document.getElementById('welcomeMessage'));
    }

    async loadConversationHistory() {
        try {
            const response = await apiGet(`/api/chat/history/${this.currentProfileId}?limit=50`);
            
            if (response.success) {
                this.conversationHistory = response.data;
                this.renderConversationHistory();
            }
        } catch (error) {
            console.error('Error loading conversation history:', error);
        }
    }

    renderConversationHistory() {
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = '';
        
        if (this.conversationHistory.length === 0) {
            chatContainer.appendChild(document.getElementById('welcomeMessage'));
            return;
        }
        
        this.conversationHistory.forEach(chat => {
            this.addMessageToChat(chat.user_message, 'user', chat.created_at);
            this.addMessageToChat(chat.ai_response, 'assistant', chat.created_at, chat.emotion_detected, chat.id);
        });
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    handleInputChange() {
        const input = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        // Enable send button if there's text
        sendButton.disabled = input.value.trim().length === 0 || this.isGenerating;
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || !this.currentProfileId || this.isGenerating) {
            return;
        }

        // Add user message to chat
        this.addMessageToChat(message, 'user');
        input.value = '';
        this.handleInputChange();
        
        // Show typing indicator
        this.showTypingIndicator();
        this.isGenerating = true;

        try {
            // Send message to backend
            const response = await apiPost('/api/chat/message', {
                profile_id: this.currentProfileId,
                user_message: message
            });

            if (response.success) {
                // Add AI response to chat
                const aiMessage = response.data.response;
                const emotion = response.data.emotion_detected;
                
                this.addMessageToChat(aiMessage, 'assistant', new Date().toISOString(), emotion);
                
                // Generate TTS if enabled
                if (this.ttsEnabled) {
                    await this.generateSpeech(aiMessage, emotion);
                }
                
                // Update conversation stats
                await this.loadConversationStats();
                
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessageToChat('Sorry, I encountered an error. Please try again.', 'assistant', new Date().toISOString(), 'sadness');
            showNotification('Failed to send message', 'error');
        } finally {
            this.hideTypingIndicator();
            this.isGenerating = false;
        }
    }

    addMessageToChat(message, sender, timestamp = null, emotion = null, chatId = null) {
        const chatContainer = document.getElementById('chatContainer');
        
        // Remove welcome message if it's there
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage && welcomeMessage.parentNode) {
            welcomeMessage.remove();
        }
        
        const messageElement = this.createMessageElement(message, sender, timestamp, emotion, chatId);
        chatContainer.appendChild(messageElement);
        
        // Scroll to bottom
        this.scrollToBottom();
        
        // Add to conversation history
        if (sender === 'user') {
            this.conversationHistory.push({
                user_message: message,
                created_at: timestamp || new Date().toISOString()
            });
        } else {
            if (this.conversationHistory.length > 0) {
                const lastChat = this.conversationHistory[this.conversationHistory.length - 1];
                if (lastChat && !lastChat.ai_response) {
                    lastChat.ai_response = message;
                    lastChat.emotion_detected = emotion;
                    lastChat.id = chatId;
                }
            }
        }
    }

    createMessageElement(message, sender, timestamp, emotion, chatId) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        
        const isUser = sender === 'user';
        const bgColor = isUser ? 'bg-blue-500' : 'bg-white';
        const textColor = isUser ? 'text-white' : 'text-gray-800';
        const border = isUser ? '' : 'border border-gray-200';
        
        const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="max-w-3/4 ${isUser ? 'order-2' : 'order-1'}">
                <div class="${bgColor} ${border} ${textColor} rounded-2xl p-4 shadow-sm">
                    <div class="flex items-start space-x-3">
                        ${!isUser ? `
                            <div class="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-robot text-white text-sm"></i>
                            </div>
                        ` : ''}
                        
                        <div class="flex-1 min-w-0">
                            <p class="whitespace-pre-wrap break-words">${this.escapeHtml(message)}</p>
                        </div>
                        
                        ${isUser ? `
                            <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-user text-white text-sm"></i>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="flex items-center space-x-2 mt-2 ${isUser ? 'justify-end' : 'justify-start'}">
                    ${!isUser && emotion ? `
                        <span class="px-2 py-1 text-xs rounded-full ${this.getEmotionColor(emotion)}">${emotion}</span>
                    ` : ''}
                    
                    <span class="text-xs text-gray-500">${time}</span>
                    
                    ${!isUser && this.ttsEnabled ? `
                        <button class="play-audio-btn text-gray-400 hover:text-blue-500 transition-colors" data-chat-id="${chatId}">
                            <i class="fas fa-volume-up text-sm"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add audio playback event listener
        if (!isUser && this.ttsEnabled) {
            const playButton = messageDiv.querySelector('.play-audio-btn');
            if (playButton) {
                playButton.addEventListener('click', () => {
                    this.playAudio(chatId);
                });
            }
        }
        
        return messageDiv;
    }

    showTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        indicator.classList.remove('hidden');
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        indicator.classList.add('hidden');
    }

    scrollToBottom() {
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async generateSpeech(text, emotion) {
        try {
            // In a real implementation, you would call the TTS API here
            // For now, we'll simulate the audio generation
            console.log('Generating speech for:', text.substring(0, 50) + '...');
            
            // Simulate audio generation delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error('Speech generation failed:', error);
        }
    }

    async playAudio(chatId) {
        try {
            // Get audio URL from backend
            const audioUrl = `/api/tts/audio/${chatId}`;
            
            // Create or reuse audio player
            if (!this.audioPlayers.has(chatId)) {
                const audio = new Audio(audioUrl);
                this.audioPlayers.set(chatId, audio);
            }
            
            const audio = this.audioPlayers.get(chatId);
            await audio.play();
            
        } catch (error) {
            console.error('Audio playback failed:', error);
            showNotification('Failed to play audio', 'error');
        }
    }

    async buildPersona() {
        if (!this.currentProfileId) return;
        
        try {
            document.getElementById('personaStatus').classList.remove('hidden');
            
            const response = await apiPost(`/api/chat/build-persona/${this.currentProfileId}`, {});
            
            if (response.success) {
                showNotification('Persona built successfully!', 'success');
                await this.loadPersonaData();
            } else {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error('Persona building failed:', error);
            showNotification('Failed to build persona', 'error');
        } finally {
            document.getElementById('personaStatus').classList.add('hidden');
        }
    }

    async loadPersonaData() {
        if (!this.currentProfileId) return;
        
        try {
            const response = await apiGet(`/api/chat/persona/${this.currentProfileId}`);
            
            if (response.success) {
                this.displayPersonaData(response.data);
            }
        } catch (error) {
            console.error('Failed to load persona data:', error);
        }
    }

    displayPersonaData(personaData) {
        const personaDetails = document.getElementById('personaDetails');
        personaDetails.classList.remove('hidden');
        
        // Writing style
        const writingStyle = personaData.writing_style || {};
        document.getElementById('sentenceLength').textContent = 
            writingStyle.avg_sentence_length ? `${writingStyle.avg_sentence_length} words` : '-';
        document.getElementById('vocabularyComplexity').textContent = 
            writingStyle.complexity || '-';
        document.getElementById('formalityLevel').textContent = 
            writingStyle.formality_indicator?.overall_tone || '-';
        
        // Emotional tone
        const emotionalTone = personaData.emotional_tone || {};
        document.getElementById('primaryEmotion').textContent = 
            emotionalTone.primary_emotion || '-';
        document.getElementById('emotionConfidence').style.width = 
            `${(emotionalTone.confidence || 0) * 100}%`;
        document.getElementById('confidenceValue').textContent = 
            `${Math.round((emotionalTone.confidence || 0) * 100)}%`;
        
        // Common phrases
        const commonPhrases = personaData.common_phrases || [];
        const phrasesContainer = document.getElementById('commonPhrases');
        phrasesContainer.innerHTML = '';
        
        commonPhrases.slice(0, 5).forEach(phrase => {
            const phraseElement = document.createElement('span');
            phraseElement.className = 'px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs';
            phraseElement.textContent = phrase;
            phrasesContainer.appendChild(phraseElement);
        });
    }

    async loadConversationStats() {
        if (!this.currentProfileId) return;
        
        try {
            const response = await apiGet(`/api/chat/summary/${this.currentProfileId}`);
            
            if (response.success) {
                this.displayConversationStats(response.data);
            }
        } catch (error) {
            console.error('Failed to load conversation stats:', error);
        }
    }

    displayConversationStats(stats) {
        const statsContainer = document.getElementById('conversationStats');
        statsContainer.classList.remove('hidden');
        
        document.getElementById('totalMessages').textContent = stats.total_messages || 0;
        document.getElementById('avgResponseTime').textContent = `${stats.avg_response_time || 0}s`;
        document.getElementById('dominantEmotion').textContent = stats.dominant_emotion || '-';
        
        if (stats.conversation_start) {
            const start = new Date(stats.conversation_start);
            const duration = this.formatDuration(start, new Date());
            document.getElementById('conversationDuration').textContent = duration;
        }
    }

    async clearChat() {
        if (!this.currentProfileId) return;
        
        if (!confirm('Are you sure you want to clear all chat history for this profile?')) {
            return;
        }
        
        try {
            const response = await apiDelete(`/api/chat/history/${this.currentProfileId}`);
            
            if (response.success) {
                showNotification('Chat history cleared', 'success');
                this.conversationHistory = [];
                this.renderConversationHistory();
                this.loadConversationStats();
            }
        } catch (error) {
            console.error('Failed to clear chat:', error);
            showNotification('Failed to clear chat history', 'error');
        }
    }

    async exportConversation() {
        if (!this.currentProfileId || this.conversationHistory.length === 0) {
            showNotification('No conversation to export', 'warning');
            return;
        }
        
        try {
            // Create export data
            const exportData = {
                profile_id: this.currentProfileId,
                export_date: new Date().toISOString(),
                conversation: this.conversationHistory
            };
            
            // Create and download file
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `conversation-${this.currentProfileId}-${Date.now()}.json`;
            link.click();
            
            showNotification('Conversation exported successfully', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            showNotification('Failed to export conversation', 'error');
        }
    }

    showSuggestions() {
        document.getElementById('suggestionsModal').classList.remove('hidden');
    }

    hideSuggestions() {
        document.getElementById('suggestionsModal').classList.add('hidden');
    }

    useSuggestion(suggestion) {
        document.getElementById('messageInput').value = suggestion;
        this.handleInputChange();
        this.hideSuggestions();
        document.getElementById('messageInput').focus();
    }

    loadVoiceSettings() {
        const savedSettings = localStorage.getItem('voiceSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.ttsEnabled = settings.ttsEnabled !== false;
            document.getElementById('ttsToggle').checked = this.ttsEnabled;
            
            if (settings.speechRate) {
                document.getElementById('speechRate').value = settings.speechRate;
                this.updateSpeechRate(settings.speechRate);
            }
        }
        
        this.loadAvailableVoices();
    }

    saveVoiceSettings() {
        const settings = {
            ttsEnabled: this.ttsEnabled,
            speechRate: document.getElementById('speechRate').value,
            voice: document.getElementById('voiceSelector').value
        };
        
        localStorage.setItem('voiceSettings', JSON.stringify(settings));
    }

    updateSpeechRate(rate) {
        const rateValue = document.getElementById('rateValue');
        if (rate < 100) rateValue.textContent = 'Slow';
        else if (rate > 200) rateValue.textContent = 'Fast';
        else rateValue.textContent = 'Normal';
        
        this.saveVoiceSettings();
    }

    async loadAvailableVoices() {
        try {
            const response = await apiGet('/api/tts/voices');
            const selector = document.getElementById('voiceSelector');
            
            if (response.success) {
                selector.innerHTML = '<option value="default">Default Voice</option>';
                
                response.data.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.id;
                    option.textContent = `${voice.name} (${voice.gender})`;
                    selector.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load voices:', error);
        }
    }

    showVoiceSettings() {
        // Focus on voice settings section
        document.getElementById('ttsStatus').scrollIntoView({ behavior: 'smooth' });
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getEmotionColor(emotion) {
        const colors = {
            'joy': 'bg-yellow-100 text-yellow-700',
            'sadness': 'bg-blue-100 text-blue-700',
            'anger': 'bg-red-100 text-red-700',
            'fear': 'bg-purple-100 text-purple-700',
            'surprise': 'bg-green-100 text-green-700',
            'neutral': 'bg-gray-100 text-gray-700'
        };
        return colors[emotion] || colors.neutral;
    }

    formatDuration(start, end) {
        const diff = end - start;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
}

// Initialize chat manager when DOM is loaded
let chatManager;
document.addEventListener('DOMContentLoaded', function() {
    chatManager = new ChatManager();
});