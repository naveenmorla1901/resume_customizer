// frontend/js/components/customizer.js - Updated with AI provider selection and better PDF handling

export class Customizer {
    constructor(apiClient, pdfViewer) {
        this.apiClient = apiClient;
        this.pdfViewer = pdfViewer;
        this.availableProviders = {};
        this.defaultProvider = 'claude';
        this.isCustomizing = false;
        this.tempResumeId = null;
        
        this.init();
    }

    async init() {
        try {
            await this.loadAvailableProviders();
            this.bindEvents();
            this.updatePercentageDisplay();
        } catch (error) {
            console.error('Failed to initialize customizer:', error);
        }
    }

    async loadAvailableProviders() {
        console.log('Loading AI providers...');
        
        try {
            const response = await this.apiClient.request('/api/customize/providers');
            console.log('Providers API response:', response);
            
            if (response && response.available_providers) {
                this.availableProviders = response.available_providers;
                this.defaultProvider = response.default_provider;
                console.log('Available providers:', this.availableProviders);
                console.log('Default provider:', this.defaultProvider);
            } else {
                throw new Error('Invalid provider response format');
            }
            
            this.renderProviderSelection();
        } catch (error) {
            console.error('Failed to load AI providers:', error);
            console.warn('Using fallback providers');
            
            // Fallback based on likely available providers
            this.availableProviders = {
                'gemini': 'Google Gemini 2.0 Flash',
                'deepseek': 'DeepSeek Chat'
            };
            this.defaultProvider = 'gemini';
            
            this.renderProviderSelection();
            this.showToast('Using available AI providers. Some providers may not be configured.', 'warning');
        }
    }

    renderProviderSelection() {
        const providerContainer = document.getElementById('aiProviderContainer');
        if (!providerContainer) return;

        console.log('Rendering provider selection with:', this.availableProviders);

        if (!this.availableProviders || Object.keys(this.availableProviders).length === 0) {
            providerContainer.innerHTML = `
                <div class="form-group">
                    <label class="form-label">AI Provider</label>
                    <div class="provider-error">
                        <p>⚠️ No AI providers configured</p>
                        <small>Please check your API keys in the .env file</small>
                    </div>
                </div>
            `;
            return;
        }

        const providerOptions = Object.entries(this.availableProviders)
            .map(([id, name]) => {
                const isDefault = id === this.defaultProvider;
                return `
                    <label class="provider-option">
                        <input type="radio" name="aiProvider" value="${id}" ${isDefault ? 'checked' : ''}>
                        <span class="provider-name">${name}</span>
                    </label>
                `;
            }).join('');

        providerContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">AI Provider</label>
                <div class="provider-selection">
                    ${providerOptions}
                </div>
                <small class="form-help">Choose which AI model to use for customization</small>
            </div>
        `;
        
        console.log('Provider selection rendered successfully');
    }

    bindEvents() {
        // Customization form
        const form = document.getElementById('customizationForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCustomization(e);
            });
        }

        // Percentage slider
        const slider = document.getElementById('modificationPercentage');
        if (slider) {
            slider.addEventListener('input', (e) => {
                this.updatePercentageDisplay(e.target.value);
            });
        }

        // Download and save buttons
        document.getElementById('downloadBtn')?.addEventListener('click', () => {
            this.handleDownload();
        });

        document.getElementById('saveCustomizedBtn')?.addEventListener('click', () => {
            this.handleSaveCustomized();
        });
    }

    async handleCustomization(event) {
        if (this.isCustomizing) {
            this.showToast('Customization already in progress...', 'info');
            return;
        }

        const form = event.target;
        const formData = new FormData(form);
        
        const selectedResume = this.getSelectedResume();
        if (!selectedResume) {
            this.showToast('Please select a resume first', 'error');
            return;
        }

        // Get form data
        const jobDescription = formData.get('jobDescription')?.trim();
        const sections = Array.from(form.querySelectorAll('input[name="sections"]:checked'))
            .map(input => input.value);
        const modificationPercentage = parseInt(formData.get('modificationPercentage') || '30');
        const aiProvider = formData.get('aiProvider') || this.defaultProvider;

        // Validation
        if (!this.validateCustomizationData(jobDescription, sections)) {
            return;
        }

        const customizationData = {
            resume_id: selectedResume.id,
            job_description: jobDescription,
            sections_to_modify: sections,
            modification_percentage: modificationPercentage,
            ai_provider: aiProvider
        };

        this.isCustomizing = true;
        const generateBtn = document.getElementById('generateBtn');
        
        // Show loading state with animation
        this.setButtonLoading(generateBtn, true, 'Generating...');
        this.showLoadingOverlay('Generating customized resume...', aiProvider);
        
        // Show loading state in PDF viewer
        this.pdfViewer.showLoading('Generating customized resume...');

        try {
            console.log('Starting customization with:', customizationData);
            const response = await this.apiClient.request('/api/customize/', {
                method: 'POST',
                body: JSON.stringify(customizationData)
            });

            console.log('Customization response:', response);
            this.tempResumeId = response.temp_resume_id;
            
            // Show success message
            const providerName = this.availableProviders[response.ai_provider_used] || response.ai_provider_used;
            this.showToast(`Resume customized successfully using ${providerName}!`, 'success');
            
            // Load PDF preview with retry logic
            if (response.pdf_url) {
                await this.loadPreviewWithRetry(response.pdf_url);
            } else {
                this.pdfViewer.showPlaceholder();
                this.showToast('PDF generation is processing...', 'info');
            }
            
            this.showPreviewActions();
            
            // Refresh resume list to show temp resume
            if (window.app && window.app.loadResumes) {
                await window.app.loadResumes();
            }
            
        } catch (error) {
            console.error('Customization failed:', error);
            this.pdfViewer.hideLoading();
            this.showToast('Failed to customize resume. Please try again.', 'error');
        } finally {
            this.isCustomizing = false;
            this.setButtonLoading(generateBtn, false, 'Generate Customized Resume');
            this.hideLoadingOverlay();
        }
    }

    async loadPreviewWithRetry(pdfUrl, maxRetries = 5, retryDelay = 2000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Loading PDF preview, attempt ${attempt}/${maxRetries}`);
                
                const response = await this.apiClient.request(pdfUrl);
                
                if (response.ok) {
                    const blob = await response.blob();
                    this.pdfViewer.showPDF(blob, 'customized_resume.pdf');
                    console.log('PDF preview loaded successfully');
                    return;
                } else if (response.status === 403 || response.status === 404) {
                    // Not ready yet, retry
                    if (attempt < maxRetries) {
                        console.log(`PDF not ready (${response.status}), retrying in ${retryDelay/1000}s...`);
                        await this.delay(retryDelay);
                        continue;
                    }
                }
                
                throw new Error(`HTTP ${response.status}`);
                
            } catch (error) {
                console.warn(`PDF preview attempt ${attempt} failed:`, error);
                
                if (attempt < maxRetries) {
                    await this.delay(retryDelay);
                } else {
                    console.error('All PDF preview attempts failed');
                    this.pdfViewer.hideLoading();
                    this.showToast('PDF preview will be available shortly. Try refreshing.', 'warning');
                }
            }
        }
    }

    async handleDownload() {
        if (!this.tempResumeId) {
            this.showToast('No customized resume to download', 'error');
            return;
        }

        try {
            const response = await this.apiClient.request(`/api/customize/preview/${this.tempResumeId}`);
            await this.downloadBlob(response, 'customized_resume.pdf');
            this.showToast('Resume downloaded successfully!', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            this.showToast('Failed to download resume', 'error');
        }
    }

    async handleSaveCustomized() {
        if (!this.tempResumeId) {
            this.showToast('No customized resume to save', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveCustomizedBtn');
        this.setButtonLoading(saveBtn, true, 'Saving...');

        try {
            await this.apiClient.request(`/api/customize/save-customized/${this.tempResumeId}`, {
                method: 'POST'
            });
            
            this.showToast('Customized resume saved successfully!', 'success');
            
            // Refresh resume list
            if (window.app && window.app.loadResumes) {
                await window.app.loadResumes();
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('Failed to save customized resume', 'error');
        } finally {
            this.setButtonLoading(saveBtn, false, 'Save Resume');
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

    updatePercentageDisplay(value = null) {
        const slider = document.getElementById('modificationPercentage');
        const display = document.getElementById('percentageValue');
        
        if (slider && display) {
            const currentValue = value || slider.value;
            display.textContent = `${currentValue}%`;
        }
    }

    getSelectedResume() {
        // This should be implemented to get the currently selected resume
        // For now, assuming it's available globally
        return window.app?.selectedResume || null;
    }

    setButtonLoading(button, isLoading, loadingText = null) {
        if (!button) return;

        const btnText = button.querySelector('.btn-text') || button;
        const btnSpinner = button.querySelector('.btn-spinner');

        if (isLoading) {
            button.disabled = true;
            if (loadingText) btnText.textContent = loadingText;
            if (btnSpinner) btnSpinner.classList.remove('hidden');
            button.classList.add('loading');
        } else {
            button.disabled = false;
            if (loadingText) btnText.textContent = loadingText;
            if (btnSpinner) btnSpinner.classList.add('hidden');
            button.classList.remove('loading');
        }
    }

    async downloadBlob(response, filename) {
        if (response instanceof Response) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
    }

    showToast(message, type = 'success') {
        // Use global toast function if available
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    showLoadingOverlay(message, aiProvider = null) {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        
        if (overlay && loadingText) {
            let displayMessage = message;
            if (aiProvider && this.availableProviders[aiProvider]) {
                displayMessage += ` using ${this.availableProviders[aiProvider]}`;
            }
            
            loadingText.textContent = displayMessage;
            overlay.classList.remove('hidden');
            
            // Add animation class for the spinner
            const spinner = overlay.querySelector('.spinner');
            if (spinner) {
                spinner.classList.add('spinning');
            }
        }
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
            
            // Remove animation class
            const spinner = overlay.querySelector('.spinner');
            if (spinner) {
                spinner.classList.remove('spinning');
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    reset() {
        this.isCustomizing = false;
        this.tempResumeId = null;
        
        // Reset form
        const form = document.getElementById('customizationForm');
        if (form) {
            form.reset();
            // Reset to default provider
            const defaultProviderInput = form.querySelector(`input[name="aiProvider"][value="${this.defaultProvider}"]`);
            if (defaultProviderInput) {
                defaultProviderInput.checked = true;
            }
        }
        
        this.updatePercentageDisplay();
    }
}

export default Customizer;
