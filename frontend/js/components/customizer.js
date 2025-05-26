// frontend/js/components/customizer.js - Resume Customization Component

export class ResumeCustomizer {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.selectedResume = null;
        this.onCustomizationComplete = null;
    }

    setSelectedResume(resume) {
        this.selectedResume = resume;
        this.updateSelectedResumeDisplay();
    }

    updateSelectedResumeDisplay() {
        const selectedResumeInfo = document.getElementById('selectedResumeInfo');
        if (selectedResumeInfo && this.selectedResume) {
            selectedResumeInfo.innerHTML = `
                <span>📄 ${this.escapeHtml(this.selectedResume.name)}</span>
            `;
        }
    }

    async customizeResume(customizationData) {
        if (!this.selectedResume) {
            throw new Error('No resume selected');
        }

        const requestData = {
            resume_id: this.selectedResume.id,
            ...customizationData
        };

        return await this.apiClient.customizeResume(requestData);
    }

    validateCustomizationData(data) {
        const errors = [];

        if (!data.job_description?.trim()) {
            errors.push('Job description is required');
        }

        if (!data.sections_to_modify || data.sections_to_modify.length === 0) {
            errors.push('At least one section must be selected');
        }

        if (!data.modification_percentage || data.modification_percentage < 10 || data.modification_percentage > 90) {
            errors.push('Modification percentage must be between 10% and 90%');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    getFormData() {
        const form = document.getElementById('customizationForm');
        if (!form) return null;

        const formData = new FormData(form);
        const sections = Array.from(form.querySelectorAll('input[name="sections"]:checked'))
            .map(input => input.value);

        return {
            job_description: formData.get('jobDescription')?.trim(),
            sections_to_modify: sections,
            modification_percentage: parseInt(formData.get('modificationPercentage') || '30')
        };
    }

    resetForm() {
        const form = document.getElementById('customizationForm');
        if (form) {
            form.reset();
            
            // Reset percentage display
            const percentageValue = document.getElementById('percentageValue');
            if (percentageValue) {
                percentageValue.textContent = '30%';
            }

            // Reset default checkboxes
            const defaultSections = ['experience', 'projects', 'skills'];
            defaultSections.forEach(section => {
                const checkbox = form.querySelector(`input[value="${section}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default ResumeCustomizer;