/**
 * Eternal Voice - Profiles Manager (Auto-Pilot Version)
 */

class ProfilesManager {
    constructor() {
        this.profiles = [];
        this.isFetching = false;

        this.API_URL = "http://127.0.0.1:8000/api/profiles";

        // Start heartbeat
        this.startHeartbeat();

        // Try to hydrate from local cache immediately
        try {
            const cached = localStorage.getItem('ev_profiles');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.profiles = parsed;
                    console.log('📦 ProfilesManager: hydrated from cache', this.profiles.length);
                    // Attempt to render now if container exists
                    setTimeout(() => this.renderProfiles(), 50);
                    // notify other components
                    window.dispatchEvent(new CustomEvent('profiles:updated', { detail: this.profiles }));
                }
            }
        } catch (e) {
            console.warn('Profiles cache load failed', e);
        }
    }

    // 💓 Heartbeat every 500ms
    startHeartbeat() {
        setInterval(() => {
            const container = document.getElementById("profilesList");
            if (!container) return;

            const content = container.innerText.trim();
            const isEmpty = content.includes("Loading") || content === "";

            // If the profiles container exists but is empty, ensure we load or render
            if (isEmpty) {
                // If we already have profiles cached, render them into the new container
                if (this.profiles && this.profiles.length > 0) {
                    console.log("💓 Heartbeat: profiles cached - rendering into container");
                    this.bindEvents();
                    this.renderProfiles();
                    return;
                }

                // Otherwise fetch from server
                if (!this.isFetching) {
                    console.log("💓 Heartbeat: Fetching profiles...");
                    this.bindEvents();
                    this.loadProfiles();
                }
                return;
            }

            // If container exists and we have profiles but they are not rendered (e.g. after navigation), attempt to render
            if (!isEmpty && this.profiles && this.profiles.length > 0) {
                // Basic heuristic: if the first profile name isn't present in the container text, re-render
                const firstName = this.profiles[0]?.name || '';
                if (firstName && !container.innerText.includes(firstName)) {
                    console.log('💓 Heartbeat: Detected missing rendered profiles, re-rendering');
                    this.renderProfiles();
                }
            }
        }, 500);
    }

    // Manual fallback
    initialize() {
        console.log("🚀 Manual Initialize called");
        this.bindEvents();
        this.loadProfiles();
    }

    bindEvents() {
        if (this._eventsBound) return;

        // Refresh
        document.addEventListener("click", (e) => {
            if (e.target.closest("#refreshProfilesBtn")) {
                this.loadProfiles();
            }

            // DELETE BUTTON
            if (e.target.closest(".delete-profile-btn")) {
                const id = e.target.closest(".delete-profile-btn").dataset.profileId;
                this.deleteProfile(id);
            }
        });

        // Profile creation
        if (!this._submitBound) {
            document.addEventListener("submit", async (e) => {
                if (e.target?.id === "profileForm") {
                    e.preventDefault();
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.disabled = true;
                    try {
                        const result = await this.createProfileFromForm();
                        if (result === "success") {
                            window.showNotification?.("Profile created!", "success");
                        } else if (result && result.error) {
                            window.showNotification?.(result.error, "error");
                        }
                    } finally {
                        if (submitBtn) submitBtn.disabled = false;
                    }
                }
            });
            this._submitBound = true;
        }

        this._eventsBound = true;
    }

    // Fetch all profiles
    async loadProfiles() {
        if (this.isFetching) return;
        this.isFetching = true;

        try {
            console.log("📥 Fetching profiles...");
            const response = await fetch(`${this.API_URL}/`);

            if (!response.ok) throw new Error("Failed to fetch profiles");

            const json = await response.json();

            if (json.success) {
                this.profiles = json.data;
                console.log(`✅ Loaded ${this.profiles.length} profiles`);
                // persist cache
                try {
                    localStorage.setItem('ev_profiles', JSON.stringify(this.profiles));
                } catch (e) {
                    console.warn('Failed to write profiles cache', e);
                }
                // render and notify
                this.renderProfiles();
                // Dispatch both app-specific and global events for compatibility
                try {
                    window.dispatchEvent(new CustomEvent('profiles:updated', { detail: this.profiles }));
                } catch (e) {
                    console.warn('profiles:updated dispatch failed', e);
                }
                try {
                    window.dispatchEvent(new CustomEvent('eternalVoice:profilesUpdated', { detail: this.profiles }));
                } catch (e) {
                    console.warn('eternalVoice:profilesUpdated dispatch failed', e);
                }
            } else {
                console.error("API Error:", json.error);
            }
        } catch (err) {
            console.error("❌ Error loading profiles:", err);
        } finally {
            this.isFetching = false;
        }
    }

    // Render UI
    renderProfiles() {
        const container = document.getElementById("profilesList");
        if (!container) return;

        if (this.profiles.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-users text-gray-400 text-2xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-2">No Profiles Yet</h3>
                    <p class="text-gray-500">Create your first profile to start preserving memories</p>
                </div>`;
            this.loadStatistics();
            return;
        }

        container.innerHTML = this.profiles
            .map(
                (p) => `
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-all mb-3">
                <div class="flex justify-between items-start">
                    <div class="flex items-start space-x-4">
                        <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                            <i class="fas fa-user"></i>
                        </div>
                        <div>
                            <h3 class="font-semibold text-gray-800 text-lg">${this.escapeHtml(
                                p.name
                            )}</h3>
                            <p class="text-sm text-gray-600">${this.escapeHtml(
                                p.relationship || "Unknown"
                            )}</p>
                            <div class="mt-2 flex space-x-4 text-xs text-gray-500">
                                <span class="bg-white px-2 py-1 rounded border border-gray-200">
                                    <i class="fas fa-file-audio mr-1 text-blue-500"></i>${
                                        p.file_count || 0
                                    } Files
                                </span>
                                <span class="bg-white px-2 py-1 rounded border border-gray-200">
                                    <i class="fas fa-comments mr-1 text-green-500"></i>${
                                        p.conversation_count || 0
                                    } Chats
                                </span>
                            </div>
                        </div>
                    </div>

                    <button class="delete-profile-btn p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                        data-profile-id="${p.id}" title="Delete Profile">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `
            )
            .join("");

        this.loadStatistics();
        // emit event so other parts of the app can update (dashboard, upload, etc.)
        try {
            window.dispatchEvent(new CustomEvent('profiles:updated', { detail: this.profiles }));
        } catch (e) {
            console.warn('Failed to dispatch profiles:updated', e);
        }
        try {
            window.dispatchEvent(new CustomEvent('eternalVoice:profilesUpdated', { detail: this.profiles }));
        } catch (e) {
            console.warn('Failed to dispatch eternalVoice:profilesUpdated', e);
        }
    }

    async createProfileFromForm() {
        const form = document.getElementById("profileForm");
        if (!form) return;

        const formData = new FormData(form);
        const payload = {
            name: formData.get("name"),
            relationship: formData.get("relationship"),
            description: formData.get("description"),
            consent_given: !!form.querySelector('input[name="consent_given"]')?.checked,
        };

        if (!payload.name) {
            window.showNotification?.("Name is required", "error");
            return { error: "Name is required" };
        }

        try {
            const response = await fetch(`${this.API_URL}/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const json = await response.json();

            if (json.success) {
                form.reset();
                this.loadProfiles();
                return "success";
            } else {
                return { error: json.error };
            }
        } catch (err) {
            console.error(err);
            return { error: "Network error while creating profile" };
        }
    }

    // FIXED DELETE: removed trailing slash
    async deleteProfile(id) {
        if (!confirm("Delete this profile?")) return;

        try {
            const response = await fetch(`${this.API_URL}/${id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                window.showNotification?.("Profile deleted!", "success");
                this.loadProfiles(); // refresh UI
            }
        } catch (err) {
            console.error("Delete error:", err);
            window.showNotification?.("Failed to delete profile", "error");
        }
    }

    loadStatistics() {
        const el = document.getElementById("totalProfiles");
        if (el) el.textContent = this.profiles.length;
    }

    escapeHtml(text) {
        if (!text) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
}

window.profilesManager = new ProfilesManager();
