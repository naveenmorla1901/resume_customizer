// frontend/js/components/resumeList.js - Resume List Component

export class ResumeList {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.resumes = [];
        this.selectedResume = null;
        this.onResumeSelect = null;
        this.onResumeDelete = null;
        this.isLoading = false;
    }

    async loadResumes() {
        this.showLoading();
        
        try {
            this.resumes = await this.apiClient.getResumes();
            this.render();
            
            // Auto-select first resume if none selected
            if (this.resumes.length > 0 && !this.selectedResume) {
                this.selectResume(this.resumes[0]);
            }
            
            return this.resumes;
        } catch (error) {
            console.error('Failed to load resumes:', error);
            this.showError('Failed to load resumes');
            throw error;
        }
    }

    render() {
        const resumeListElement = document.getElementById('resumeList');
        if (!resumeListElement) return;

        if (this.resumes.length === 0) {
            this.renderEmptyState();
            return;
        }

        const resumeItems = this.resumes.map(resume => this.createResumeItem(resume));
        resumeListElement.innerHTML = resumeItems.join('');
        
        this.bindEvents();
    }

    renderEmptyState() {
        const resumeListElement = document.getElementById('resumeList');
        if (resumeListElement) {
            resumeListElement.innerHTML = `
                <div class="empty-state">
                    <p>No resumes yet. Create your first resume to get started!</p>
                </div>
            `;
        }
    }

    createResumeItem(resume) {
        const isActive = this.selectedResume?.id === resume.id;
        const isTemp = resume.resume_type === 'temporary';
        const createdDate = this.formatDate(resume.updated_at || resume.created_at);
        
        return `
            <div class="resume-item ${isActive ? 'active' : ''} ${isTemp ? 'temp' : ''}" 
                 data-resume-id="${resume.id}"
                 role="button"
                 tabindex="0"
                 aria-label="Select ${resume.name}">
                <div class="resume-info">
                    <h4>${this.escapeHtml(resume.name)}</h4>
                    <p>${isTemp ? 'Temporary' : 'Original'} • ${createdDate}</p>
                </div>
                <div class="resume-actions">
                    ${!isTemp ? `
                        <button class="resume-action-btn" 
                                data-action="delete" 
                                data-resume-id="${resume.id}"
                                title="Delete ${resume.name}"
                                aria-label="Delete ${resume.name}">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    bindEvents() {
        const resumeItems = document.querySelectorAll('.resume-item');
        
        resumeItems.forEach(item => {
            // Click event for resume selection
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('resume-action-btn')) {
                    e.stopPropagation();
                    this.handleAction(e.target);
                } else {
                    this.handleResumeClick(item);
                }
            });

            // Keyboard events for accessibility
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleResumeClick(item);
                }
            });
        });

        // Bind action buttons separately for better event handling
        const actionButtons = document.querySelectorAll('.resume-action-btn');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAction(button);
            });
        });
    }

    handleResumeClick(item) {
        const resumeId = item.dataset.resumeId;
        const resume = this.resumes.find(r => r.id === resumeId);
        
        if (resume) {
            this.selectResume(resume);
        }
    }

    async handleAction(button) {
        const action = button.dataset.action;
        const resumeId = button.dataset.resumeId;
        
        if (action === 'delete') {
            await this.handleDelete(resumeId);
        }
    }

    async handleDelete(resumeId) {
        const resume = this.resumes.find(r => r.id === resumeId);
        if (!resume) return;

        const confirmMessage = `Are you sure you want to delete "${resume.name}"? This action cannot be undone.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            await this.apiClient.deleteResume(resumeId);
            
            // Remove from local array
            this.resumes = this.resumes.filter(r => r.id !== resumeId);
            
            // Clear selection if deleted resume was selected
            if (this.selectedResume?.id === resumeId) {
                this.selectedResume = null;
                
                // Auto-select first available resume
                if (this.resumes.length > 0) {
                    this.selectResume(this.resumes[0]);
                }
            }
            
            this.render();
            
            // Trigger callback
            if (this.onResumeDelete) {
                this.onResumeDelete(resumeId);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to delete resume:', error);
            throw error;
        }
    }

    selectResume(resume) {
        if (!resume) return;
        
        this.selectedResume = resume;
        this.render(); // Re-render to update active states
        
        // Trigger callback
        if (this.onResumeSelect) {
            this.onResumeSelect(resume);
        }
    }

    addResume(resume) {
        this.resumes.push(resume);
        this.render();
        
        // Auto-select new resume
        this.selectResume(resume);
    }

    updateResume(updatedResume) {
        const index = this.resumes.findIndex(r => r.id === updatedResume.id);
        if (index !== -1) {
            this.resumes[index] = updatedResume;
            
            // Update selected resume if it's the one being updated
            if (this.selectedResume?.id === updatedResume.id) {
                this.selectedResume = updatedResume;
            }
            
            this.render();
        }
    }

    showLoading() {
        this.isLoading = true;
        const resumeListElement = document.getElementById('resumeList');
        
        if (resumeListElement) {
            resumeListElement.innerHTML = `
                <div class="loading-placeholder">
                    <div class="skeleton"></div>
                    <div class="skeleton"></div>
                    <div class="skeleton"></div>
                </div>
            `;
        }
    }

    showError(message) {
        const resumeListElement = document.getElementById('resumeList');
        
        if (resumeListElement) {
            resumeListElement.innerHTML = `
                <div class="error-state">
                    <p>⚠️ ${message}</p>
                    <button class="btn btn-secondary btn-small" onclick="location.reload()">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    getSelectedResume() {
        return this.selectedResume;
    }

    getResumes() {
        return [...this.resumes];
    }

    hasResumes() {
        return this.resumes.length > 0;
    }

    // Utility methods
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                return 'Today';
            } else if (diffDays === 1) {
                return 'Yesterday';
            } else if (diffDays < 7) {
                return `${diffDays} days ago`;
            } else {
                return date.toLocaleDateString();
            }
        } catch (error) {
            return 'Unknown';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event handlers
    setOnResumeSelect(callback) {
        this.onResumeSelect = callback;
    }

    setOnResumeDelete(callback) {
        this.onResumeDelete = callback;
    }

    // Cleanup
    destroy() {
        this.resumes = [];
        this.selectedResume = null;
        this.onResumeSelect = null;
        this.onResumeDelete = null;
    }
}

export default ResumeList;