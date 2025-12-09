class FileUploadManager {
    constructor() {
        this.selectedFiles = [];
        this.selectedProfileId = null;
        this.currentTaskId = null;
        this.progressInterval = null;
        
        this.initializeEventListeners();
        this.loadProfiles();
        this.loadUploadedFiles();
    }

    initializeEventListeners() {
        // File input handling
        document.getElementById('browseButton').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Drag and drop
        const uploadZone = document.getElementById('uploadZone');
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            this.handleFileSelection(e.dataTransfer.files);
        });

        // Upload button
        document.getElementById('uploadButton').addEventListener('click', () => {
            this.startUpload();
        });

        // Quick actions
        document.getElementById('demoFilesBtn').addEventListener('click', () => {
            this.loadDemoFiles();
        });

        document.getElementById('clearFilesBtn').addEventListener('click', () => {
            this.clearAllFiles();
        });

        document.getElementById('refreshFilesBtn').addEventListener('click', () => {
            this.loadUploadedFiles();
        });

        // Profile modal
        document.getElementById('cancelProfileBtn').addEventListener('click', () => {
            this.hideProfileModal();
        });

        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createProfile();
        });
    }

    handleFileSelection(files) {
        if (files.length === 0) return;

        // Convert FileList to Array and validate
        const fileArray = Array.from(files);
        const validFiles = this.validateFiles(fileArray);

        if (validFiles.length > 0) {
            this.selectedFiles = [...this.selectedFiles, ...validFiles];
            this.updateFileList();
            this.showUploadButton();
            
            showNotification(`Added ${validFiles.length} file(s)`, 'success');
        }

        // Reset file input
        document.getElementById('fileInput').value = '';
    }

    validateFiles(files) {
        const validFiles = [];
        const errors = [];

        const allowedTypes = {
            'audio': ['wav', 'mp3', 'm4a', 'flac'],
            'image': ['jpg', 'jpeg', 'png', 'gif'],
            'text': ['txt', 'pdf', 'doc', 'docx']
        };

        const maxSizes = {
            'audio': 50 * 1024 * 1024, // 50MB
            'image': 20 * 1024 * 1024, // 20MB
            'text': 10 * 1024 * 1024   // 10MB
        };

        files.forEach(file => {
            const fileExt = file.name.split('.').pop().toLowerCase();
            let fileType = 'other';

            // Determine file type
            if (allowedTypes.audio.includes(fileExt)) fileType = 'audio';
            else if (allowedTypes.image.includes(fileExt)) fileType = 'image';
            else if (allowedTypes.text.includes(fileExt)) fileType = 'text';

            // Validate type
            if (fileType === 'other') {
                errors.push(`${file.name}: Invalid file type`);
                return;
            }

            // Validate size
            if (file.size > maxSizes[fileType]) {
                errors.push(`${file.name}: File too large (max ${maxSizes[fileType] / (1024 * 1024)}MB)`);
                return;
            }

            validFiles.push({
                file: file,
                type: fileType,
                size: file.size,
                id: Math.random().toString(36).substr(2, 9)
            });
        });

        // Show errors
        if (errors.length > 0) {
            errors.forEach(error => {
                showNotification(error, 'error');
            });
        }

        return validFiles;
    }

    updateFileList() {
        const fileList = document.getElementById('selectedFiles');
        const fileListContainer = document.getElementById('fileList');
        
        if (this.selectedFiles.length === 0) {
            fileListContainer.classList.add('hidden');
            return;
        }

        fileListContainer.classList.remove('hidden');
        fileList.innerHTML = '';

        this.selectedFiles.forEach((fileInfo, index) => {
            const fileElement = this.createFileElement(fileInfo, index);
            fileList.appendChild(fileElement);
        });
    }

    createFileElement(fileInfo, index) {
        const fileElement = document.createElement('div');
        fileElement.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200';
        
        const fileSize = this.formatFileSize(fileInfo.size);
        const fileIcon = this.getFileIcon(fileInfo.type);

        fileElement.innerHTML = `
            <div class="flex items-center space-x-4 flex-1">
                <div class="w-12 h-12 ${this.getFileColor(fileInfo.type)} rounded-xl flex items-center justify-center">
                    <i class="${fileIcon} text-white text-lg"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-800 truncate">${fileInfo.file.name}</p>
                    <p class="text-sm text-gray-500">${fileSize} • ${fileInfo.type.toUpperCase()}</p>
                </div>
            </div>
            <button type="button" class="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors remove-file" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add remove event listener
        fileElement.querySelector('.remove-file').addEventListener('click', () => {
            this.removeFile(index);
        });

        return fileElement;
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileList();
        
        if (this.selectedFiles.length === 0) {
            this.hideUploadButton();
        }
    }

    clearAllFiles() {
        if (this.selectedFiles.length === 0) return;
        
        if (confirm('Are you sure you want to clear all selected files?')) {
            this.selectedFiles = [];
            this.updateFileList();
            this.hideUploadButton();
            showNotification('All files cleared', 'info');
        }
    }

    showUploadButton() {
        document.getElementById('uploadButton').classList.remove('hidden');
    }

    hideUploadButton() {
        document.getElementById('uploadButton').classList.add('hidden');
    }

    async startUpload() {
        if (!this.selectedProfileId) {
            showNotification('Please select a profile first', 'error');
            return;
        }

        if (this.selectedFiles.length === 0) {
            showNotification('Please select files to upload', 'error');
            return;
        }

        // Disable upload button and show progress
        const uploadButton = document.getElementById('uploadButton');
        uploadButton.disabled = true;
        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading...';

        try {
            const formData = new FormData();
            formData.append('profile_id', this.selectedProfileId);

            // Add all files
            this.selectedFiles.forEach(fileInfo => {
                formData.append('files', fileInfo.file);
            });

            const response = await fetch('/api/upload/multiple', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                this.currentTaskId = result.data.task_id;
                this.showProgressSection();
                this.startProgressTracking();
                
                // Clear selected files after successful upload start
                this.selectedFiles = [];
                this.updateFileList();
                this.hideUploadButton();
                
            } else {
                throw new Error(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Upload failed: ' + error.message, 'error');
        } finally {
            // Reset upload button
            uploadButton.disabled = false;
            uploadButton.innerHTML = '<i class="fas fa-upload mr-2"></i>Start Upload';
        }
    }

    showProgressSection() {
        const progressSection = document.getElementById('progressSection');
        progressSection.classList.remove('hidden');
        
        const progressContainer = document.getElementById('uploadProgress');
        progressContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="loading-spinner blue mx-auto mb-3"></div>
                <p class="text-gray-600">Starting upload...</p>
            </div>
        `;
    }

    async startProgressTracking() {
        if (!this.currentTaskId) return;

        this.progressInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/upload/progress/${this.currentTaskId}`);
                const result = await response.json();

                if (result.success) {
                    this.updateProgressDisplay(result.data);
                    
                    // Stop tracking if task is completed or failed
                    if (result.data.status === 'completed' || result.data.status === 'failed') {
                        this.stopProgressTracking();
                        
                        if (result.data.status === 'completed') {
                            showNotification('Upload completed successfully!', 'success');
                            this.loadUploadedFiles(); // Refresh file list
                        } else {
                            showNotification('Upload failed: ' + result.data.message, 'error');
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
        const progressContainer = document.getElementById('uploadProgress');
        
        const progressPercent = Math.round(progress.progress);
        const estimatedTime = progress.estimated_time ? 
            `• ${Math.round(progress.estimated_time / 60)}min remaining` : '';

        progressContainer.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <span class="font-medium text-gray-700">${progress.current_step}</span>
                    <span class="text-sm text-gray-500">${progressPercent}% ${estimatedTime}</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${progressPercent}%"></div>
                </div>
                <div class="text-sm text-gray-600">
                    ${progress.message}
                </div>
                <div class="flex justify-between text-xs text-gray-500">
                    <span>${progress.completed_items} of ${progress.total_items} files</span>
                    <span>Started: ${new Date(progress.start_time).toLocaleTimeString()}</span>
                </div>
            </div>
        `;
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

                // Add "Create New" button
                const newProfileBtn = document.createElement('button');
                newProfileBtn.className = 'btn btn-outline-primary';
                newProfileBtn.innerHTML = '<i class="fas fa-plus mr-2"></i>New Profile';
                newProfileBtn.addEventListener('click', () => this.showProfileModal());
                profileSelection.appendChild(newProfileBtn);

                // Select first profile by default
                if (response.data.length > 0) {
                    this.selectProfile(response.data[0].id);
                }
                
            } else {
                profileSelection.innerHTML = `
                    <div class="text-center w-full py-4">
                        <p class="text-gray-500 mb-3">No profiles found</p>
                        <button class="btn btn-primary" onclick="uploadManager.showProfileModal()">
                            <i class="fas fa-plus mr-2"></i>Create First Profile
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading profiles:', error);
            showNotification('Failed to load profiles', 'error');
        }
    }

    createProfileElement(profile) {
        const profileElement = document.createElement('button');
        profileElement.className = `profile-btn flex items-center space-x-3 px-4 py-3 rounded-xl border-2 transition-all ${
            this.selectedProfileId === profile.id 
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

    selectProfile(profileId) {
        this.selectedProfileId = profileId;
        
        // Update UI
        document.querySelectorAll('.profile-btn').forEach(btn => {
            btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700');
            btn.classList.add('border-gray-200');
        });
        
        document.querySelector(`.profile-btn[onclick*="${profileId}"]`)?.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700');
        
        showNotification('Profile selected', 'info');
    }

    showProfileModal() {
        document.getElementById('profileModal').classList.remove('hidden');
    }

    hideProfileModal() {
        document.getElementById('profileModal').classList.add('hidden');
        document.getElementById('profileForm').reset();
    }

    async createProfile() {
        const form = document.getElementById('profileForm');
        const formData = new FormData(form);
        
        try {
            const profileData = {
                name: formData.get('name'),
                relationship: formData.get('relationship'),
                description: formData.get('description'),
                consent_given: formData.get('consent_given') === 'on'
            };

            const response = await apiPost('/api/profiles/', profileData);
            
            if (response.success) {
                showNotification('Profile created successfully!', 'success');
                this.hideProfileModal();
                this.loadProfiles(); // Reload profiles list
                this.selectProfile(response.data.id); // Select new profile
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Profile creation error:', error);
            showNotification('Failed to create profile: ' + error.message, 'error');
        }
    }

    async loadUploadedFiles() {
        if (!this.selectedProfileId) return;

        try {
            const response = await apiGet(`/api/upload/files/${this.selectedProfileId}`);
            const filesList = document.getElementById('uploadedFilesList');
            
            if (response.success && response.data.length > 0) {
                filesList.innerHTML = response.data.map(file => `
                    <div class="flex items-center justify-between p-4 border-b border-gray-200 last:border-b-0">
                        <div class="flex items-center space-x-4">
                            <div class="w-10 h-10 ${this.getFileColor(file.file_type)} rounded-lg flex items-center justify-center">
                                <i class="${this.getFileIcon(file.file_type)} text-white"></i>
                            </div>
                            <div>
                                <p class="font-medium text-gray-800">${file.filename}</p>
                                <p class="text-sm text-gray-500">
                                    ${this.formatFileSize(file.file_size)} • 
                                    ${new Date(file.upload_date).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-1 text-xs rounded-full ${
                                file.processed 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }">
                                ${file.processed ? 'Processed' : 'Pending'}
                            </span>
                            <button class="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors delete-file" data-file-id="${file.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('');

                // Add delete event listeners
                filesList.querySelectorAll('.delete-file').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const fileId = e.currentTarget.getAttribute('data-file-id');
                        this.deleteFile(fileId);
                    });
                });
            } else {
                filesList.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-folder-open text-gray-300 text-3xl mb-3"></i>
                        <p class="text-gray-500">No files uploaded yet</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading uploaded files:', error);
        }
    }

    async deleteFile(fileId) {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const response = await apiDelete(`/api/upload/file/${fileId}`);
            
            if (response.success) {
                showNotification('File deleted successfully', 'success');
                this.loadUploadedFiles(); // Refresh list
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('File deletion error:', error);
            showNotification('Failed to delete file', 'error');
        }
    }

    loadDemoFiles() {
        // This would load sample files for demonstration
        showNotification('Demo files feature coming soon!', 'info');
    }

    // Utility methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileIcon(fileType) {
        const icons = {
            'audio': 'fas fa-music',
            'image': 'fas fa-image',
            'text': 'fas fa-file-alt',
            'other': 'fas fa-file'
        };
        return icons[fileType] || icons.other;
    }

    getFileColor(fileType) {
        const colors = {
            'audio': 'bg-green-500',
            'image': 'bg-purple-500',
            'text': 'bg-orange-500',
            'other': 'bg-gray-500'
        };
        return colors[fileType] || colors.other;
    }
}

// Helper functions for API calls
async function apiGet(url) {
    const response = await fetch(url);
    return await response.json();
}

async function apiPost(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    return await response.json();
}

async function apiDelete(url) {
    const response = await fetch(url, {
        method: 'DELETE'
    });
    return await response.json();
}

// Initialize upload manager when DOM is loaded
let uploadManager;
document.addEventListener('DOMContentLoaded', function() {
    uploadManager = new FileUploadManager();
});