// frontend/js/main.js - Main Application Logic

import apiClient, { FileHandler } from './api.js';

class ResumeCustomizerApp {
    constructor() {
        this.currentUser = null;
        this.resumes = [];
        this.selectedResume = null;
        this.tempResumeId = null;
        
        this.init();
    }

    async init() {
        // Check authentication
        if (!apiClient.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }

        try {
            await this.loadCurrentUser();
            await this.loadResumes();
            this.bindEvents();
            this.updateUI();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('Failed to load application. Please refresh the page.', 'error');
        }
    }

    async loadCurrentUser() {
        try {
            this.currentUser = await apiClient.getCurrentUser();
            this.updateUserInfo();
        } catch (error) {
            console.error('Failed to load user:', error);
            throw error;
        }
    }

    async loadResumes() {
        try {
            this.resumes = await apiClient.getResumes();
            this.renderResumeList();
            
            // Select first resume if available
            if (this.resumes.length > 0 && !this.selectedResume) {
                this.selectResume(this.resumes[0]);
            }
        } catch (error) {
            console.error('Failed to load resumes:', error);
            this.showToast('Failed to load resumes', 'error');
        }
    }

    bindEvents() {
        // Header events
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.handleLogout();
        });

        // Resume management events
        document.getElementById('addResumeBtn')?.addEventListener('click', () => {
            this.showAddResumeModal();
        });

        document.getElementById('createFirstResumeBtn')?.addEventListener('click', () => {
            this.showAddResumeModal();
        });

        // Modal events
        document.getElementById('closeAddResumeModal')?.addEventListener('click', () => {
            this.hideAddResumeModal();
        });

        document.getElementById('cancelAddResume')?.addEventListener('click', () => {
            this.hideAddResumeModal();
        });

        document.getElementById('addResumeForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddResume(e);
        });

        // Customization events
        document.getElementById('customizationForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCustomization(e);
        });

        document.getElementById('modificationPercentage')?.addEventListener('input', (e) => {
            this.updatePercentageDisplay(e.target.value);
        });

        // Preview events
        document.getElementById('downloadBtn')?.addEventListener('click', () => {
            this.handleDownload();
        });

        document.getElementById('saveCustomizedBtn')?.addEventListener('click', () => {
            this.handleSaveCustomized();
        });

        // Modal overlay click to close
        document.getElementById('addResumeModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.hideAddResumeModal();
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAddResumeModal();
            }
        });
    }

    updateUserInfo() {
        const userInfoElement = document.getElementById('userInfo');
        if (userInfoElement && this.currentUser) {
            userInfoElement.textContent = this.currentUser.email;
        }
    }

    renderResumeList() {
        const resumeListElement = document.getElementById('resumeList');
        if (!resumeListElement) return;

        if (this.resumes.length === 0) {
            resumeListElement.innerHTML = `
                <div class="empty-state">
                    <p>No resumes yet. Create your first resume to get started!</p>
                </div>
            `;
            this.showWelcomeState();
            return;
        }

        const resumeItems = this.resumes.map(resume => this.createResumeItem(resume));
        resumeListElement.innerHTML = resumeItems.join('');

        // Bind resume item events
        this.bindResumeItemEvents();
        this.hideWelcomeState();
    }

    createResumeItem(resume) {
        const isActive = this.selectedResume?.id === resume.id;
        const isTemp = resume.resume_type === 'temporary';
        
        return `
            <div class="resume-item ${isActive ? 'active' : ''} ${isTemp ? 'temp' : ''}" 
                 data-resume-id="${resume.id}">
                <div class="resume-info">
                    <h4>${this.escapeHtml(resume.name)}</h4>
                    <p>${isTemp ? 'Temporary' : 'Original'} • ${this.formatDate(resume.updated_at || resume.created_at)}</p>
                </div>
                <div class="resume-actions">
                    ${!isTemp ? `<button class="resume-action-btn" data-action="delete" title="Delete">🗑️</button>` : ''}
                </div>
            </div>
        `;
    }

    bindResumeItemEvents() {
        const resumeItems = document.querySelectorAll('.resume-item');
        resumeItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('resume-action-btn')) {
                    const action = e.target.dataset.action;
                    const resumeId = item.dataset.resumeId;
                    this.handleResumeAction(action, resumeId);
                } else {
                    const resumeId = item.dataset.resumeId;
                    const resume = this.resumes.find(r => r.id === resumeId);
                    if (resume) {
                        this.selectResume(resume);
                    }
                }
            });
        });
    }

    async handleResumeAction(action, resumeId) {
        if (action === 'delete') {
            if (confirm('Are you sure you want to delete this resume? This action cannot be undone.')) {
                try {
                    await apiClient.deleteResume(resumeId);
                    this.showToast('Resume deleted successfully', 'success');
                    await this.loadResumes();
                } catch (error) {
                    console.error('Failed to delete resume:', error);
                    this.showToast('Failed to delete resume', 'error');
                }
            }
        }
    }

    selectResume(resume) {
        this.selectedResume = resume;
        this.updateSelectedResumeInfo();
        this.renderResumeList(); // Re-render to update active state
        this.loadResumePreview(resume.id);
    }

    updateSelectedResumeInfo() {
        const selectedResumeInfo = document.getElementById('selectedResumeInfo');
        if (selectedResumeInfo && this.selectedResume) {
            selectedResumeInfo.innerHTML = `
                <span>📄 ${this.escapeHtml(this.selectedResume.name)}</span>
            `;
        }
    }

    async loadResumePreview(resumeId) {
        try {
            const response = await apiClient.downloadResumePDF(resumeId);
            const blob = await response.blob();
            const pdfUrl = URL.createObjectURL(blob);
            
            this.showPDFPreview(pdfUrl);
        } catch (error) {
            console.error('Failed to load resume preview:', error);
            this.showPDFPlaceholder();
        }
    }

    showPDFPreview(pdfUrl) {
        const pdfPreview = document.getElementById('pdfPreview');
        const pdfPlaceholder = document.getElementById('pdfPlaceholder');
        
        if (pdfPreview && pdfPlaceholder) {
            pdfPreview.src = pdfUrl;
            pdfPreview.classList.remove('hidden');
            pdfPlaceholder.classList.add('hidden');
        }
    }

    showPDFPlaceholder() {
        const pdfPreview = document.getElementById('pdfPreview');
        const pdfPlaceholder = document.getElementById('pdfPlaceholder');
        
        if (pdfPreview && pdfPlaceholder) {
            pdfPreview.classList.add('hidden');
            pdfPlaceholder.classList.remove('hidden');
        }
    }

    showWelcomeState() {
        document.getElementById('welcomeState')?.classList.remove('hidden');
        document.getElementById('customizationInterface')?.classList.add('hidden');
    }

    hideWelcomeState() {
        document.getElementById('welcomeState')?.classList.add('hidden');
        document.getElementById('customizationInterface')?.classList.remove('hidden');
    }

    showAddResumeModal() {
        document.getElementById('addResumeModal')?.classList.remove('hidden');
        document.getElementById('resumeName')?.focus();
    }

    hideAddResumeModal() {
        const modal = document.getElementById('addResumeModal');
        const form = document.getElementById('addResumeForm');
        
        if (modal && form) {
            modal.classList.add('hidden');
            form.reset();
        }
    }

    async handleAddResume(event) {
        const form = event.target;
        const formData = new FormData(form);
        const resumeData = {
            name: formData.get('name').trim(),
            latex_content: formData.get('latex_content').trim()
        };

        if (!this.validateResumeData(resumeData)) {
            return;
        }

        const saveBtn = document.getElementById('saveResumeBtn');
        this.setButtonLoading(saveBtn, true);

        try {
            await apiClient.createResume(resumeData);
            this.showToast('Resume created successfully!', 'success');
            this.hideAddResumeModal();
            await this.loadResumes();
        } catch (error) {
            console.error('Failed to create resume:', error);
            this.showToast('Failed to create resume. Please check your LaTeX code.', 'error');
        } finally {
            this.setButtonLoading(saveBtn, false);
        }
    }

    validateResumeData(resumeData) {
        if (!resumeData.name) {
            this.showToast('Please enter a resume name', 'error');
            return false;
        }

        if (!resumeData.latex_content) {
            this.showToast('Please enter LaTeX content', 'error');
            return false;
        }

        // Basic LaTeX validation
        const requiredPatterns = ['\\documentclass', '\\begin{document}', '\\end{document}'];
        for (const pattern of requiredPatterns) {
            if (!resumeData.latex_content.includes(pattern)) {
                this.showToast(`LaTeX content must include ${pattern}`, 'error');
                return false;
            }
        }

        return true;
    }

    async handleCustomization(event) {
        if (!this.selectedResume) {
            this.showToast('Please select a resume first', 'error');
            return;
        }

        const form = event.target;
        const formData = new FormData(form);
        
        const jobDescription = formData.get('jobDescription')?.trim();
        const sections = Array.from(form.querySelectorAll('input[name="sections"]:checked'))
            .map(input => input.value);
        const modificationPercentage = parseInt(formData.get('modificationPercentage') || '30');

        if (!this.validateCustomizationData(jobDescription, sections)) {
            return;
        }

        const customizationData = {
            resume_id: this.selectedResume.id,
            job_description: jobDescription,
            sections_to_modify: sections,
            modification_percentage: modificationPercentage
        };

        const generateBtn = document.getElementById('generateBtn');
        this.setButtonLoading(generateBtn, true, 'Generating...');

        try {
            const response = await apiClient.customizeResume(customizationData);
            this.tempResumeId = response.temp_resume_id;
            
            if (response.pdf_url) {
                this.showPDFPreview(response.pdf_url);
            }
            
            this.showPreviewActions();
            this.showToast('Resume customized successfully!', 'success');
            
            // Reload resumes to show the temp resume
            await this.loadResumes();
            
        } catch (error) {
            console.error('Failed to customize resume:', error);
            this.showToast('Failed to customize resume. Please try again.', 'error');
        } finally {
            this.setButtonLoading(generateBtn, false, 'Generate Customized Resume');
        }
    }

    validateCustomizationData(jobDescription, sections) {
        if (!jobDescription) {
            this.showToast('Please enter a job description', 'error');
            return false;
        }

        if (sections.length === 0) {
            this.showToast('Please select at least one section to customize', 'error');
            return false;
        }

        return true;
    }

    showPreviewActions() {
        document.getElementById('downloadBtn')?.classList.remove('hidden');
        document.getElementById('saveCustomizedBtn')?.classList.remove('hidden');
    }

    async handleDownload() {
        if (!this.tempResumeId) {
            this.showToast('No customized resume to download', 'error');
            return;
        }

        try {
            const response = await apiClient.previewCustomizedResume(this.tempResumeId);
            await FileHandler.downloadPDF(response, `${this.selectedResume.name}_customized.pdf`);
            this.showToast('Resume downloaded successfully!', 'success');
        } catch (error) {
            console.error('Failed to download resume:', error);
            this.showToast('Failed to download resume', 'error');
        }
    }

    async handleSaveCustomized() {
        if (!this.tempResumeId) {
            this.showToast('No customized resume to save', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveCustomizedBtn');
        this.setButtonLoading(saveBtn, true);

        try {
            await apiClient.saveCustomizedResume(this.tempResumeId);
            this.showToast('Customized resume saved successfully!', 'success');
            await this.loadResumes();
        } catch (error) {
            console.error('Failed to save customized resume:', error);
            this.showToast('Failed to save customized resume', 'error');
        } finally {
            this.setButtonLoading(saveBtn, false);
        }
    }

    async handleLogout() {
        try {
            await apiClient.logout();
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed:', error);
            // Redirect anyway since token is cleared
            window.location.href = '/login';
        }
    }

    updateUI() {
        if (this.resumes.length === 0) {
            this.showWelcomeState();
        } else {
            this.hideWelcomeState();
        }
    }

    updatePercentageDisplay(value) {
        const percentageValueElement = document.getElementById('percentageValue');
        if (percentageValueElement) {
            percentageValueElement.textContent = `${value}%`;
        }
    }

    setButtonLoading(button, isLoading, loadingText = null) {
        if (!button) return;

        const btnText = button.querySelector('.btn-text');
        const btnSpinner = button.querySelector('.btn-spinner');

        if (isLoading) {
            button.disabled = true;
            if (btnText && loadingText) btnText.textContent = loadingText;
            if (btnSpinner) btnSpinner.classList.remove('hidden');
        } else {
            button.disabled = false;
            if (btnText && loadingText) btnText.textContent = loadingText;
            if (btnSpinner) btnSpinner.classList.add('hidden');
        }
    }

    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ResumeCustomizerApp();
});