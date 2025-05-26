// frontend/js/api.js - API Client for Backend Communication

class APIClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.token = localStorage.getItem('authToken');
    }

    // Helper method to make HTTP requests
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add authorization header if token exists
        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            // Handle different response scenarios
            if (response.status === 401) {
                // Token expired or invalid
                this.clearAuth();
                window.location.href = '/login';
                throw new Error('Authentication required');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            // Handle empty responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return response;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Authentication methods
    setAuth(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    clearAuth() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    isAuthenticated() {
        return !!this.token;
    }

    // Auth API endpoints
    async signup(userData) {
        const response = await this.request('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        if (response.access_token) {
            this.setAuth(response.access_token);
        }
        
        return response;
    }

    async login(credentials) {
        const response = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (response.access_token) {
            this.setAuth(response.access_token);
        }
        
        return response;
    }

    async logout() {
        try {
            await this.request('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.warn('Logout request failed:', error);
        } finally {
            this.clearAuth();
        }
    }

    async getCurrentUser() {
        return await this.request('/api/auth/me');
    }

    // Resume API endpoints
    async getResumes() {
        return await this.request('/api/resumes/');
    }

    async getResume(resumeId) {
        return await this.request(`/api/resumes/${resumeId}`);
    }

    async createResume(resumeData) {
        return await this.request('/api/resumes/', {
            method: 'POST',
            body: JSON.stringify(resumeData)
        });
    }

    async updateResume(resumeId, resumeData) {
        return await this.request(`/api/resumes/${resumeId}`, {
            method: 'PUT',
            body: JSON.stringify(resumeData)
        });
    }

    async deleteResume(resumeId) {
        return await this.request(`/api/resumes/${resumeId}`, {
            method: 'DELETE'
        });
    }

    async downloadResumePDF(resumeId) {
        const response = await this.request(`/api/resumes/${resumeId}/pdf`);
        return response; // This returns the fetch Response object for file handling
    }

    // Customization API endpoints
    async customizeResume(customizationData) {
        return await this.request('/api/customize/', {
            method: 'POST',
            body: JSON.stringify(customizationData)
        });
    }

    async previewCustomizedResume(tempResumeId) {
        const response = await this.request(`/api/customize/preview/${tempResumeId}`);
        return response; // Returns fetch Response for PDF handling
    }

    async saveCustomizedResume(tempResumeId) {
        return await this.request(`/api/customize/save-customized/${tempResumeId}`, {
            method: 'POST'
        });
    }

    // Health check
    async healthCheck() {
        return await this.request('/api/health');
    }
}

// Utility functions for handling file downloads
export class FileHandler {
    static async downloadPDF(response, filename = 'resume.pdf') {
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

    static async blobToDataURL(response) {
        if (response instanceof Response) {
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }
        return null;
    }
}

// Create and export a global API client instance
const apiClient = new APIClient();
export default apiClient;

// Make it available globally for non-module scripts
window.apiClient = apiClient;
window.FileHandler = FileHandler;