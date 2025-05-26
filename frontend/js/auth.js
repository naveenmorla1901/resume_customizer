// frontend/js/auth.js - Authentication Page Logic

import apiClient from './api.js';

class AuthHandler {
    constructor() {
        this.currentForm = 'login';
        this.init();
    }

    init() {
        // Check if already authenticated
        if (apiClient.isAuthenticated()) {
            this.redirectToApp();
            return;
        }

        this.bindEvents();
        this.setupFormValidation();
    }

    bindEvents() {
        // Form switching
        document.getElementById('showSignup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToSignup();
        });

        document.getElementById('showLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToLogin();
        });

        // Form submissions
        document.getElementById('loginFormElement')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e);
        });

        document.getElementById('signupFormElement')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup(e);
        });

        // Error dismissal
        document.getElementById('dismissError')?.addEventListener('click', () => {
            this.hideError();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideError();
            }
        });
    }

    setupFormValidation() {
        // Real-time password validation
        const signupPassword = document.getElementById('signupPassword');
        if (signupPassword) {
            signupPassword.addEventListener('input', (e) => {
                this.validatePassword(e.target);
            });
        }

        // Email validation
        const emailInputs = document.querySelectorAll('input[type="email"]');
        emailInputs.forEach(input => {
            input.addEventListener('blur', (e) => {
                this.validateEmail(e.target);
            });
        });
    }

    validateEmail(input) {
        const email = input.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email && !emailRegex.test(email)) {
            input.setCustomValidity('Please enter a valid email address');
        } else {
            input.setCustomValidity('');
        }
    }

    validatePassword(input) {
        const password = input.value;
        const minLength = 8;
        
        if (password.length > 0 && password.length < minLength) {
            input.setCustomValidity(`Password must be at least ${minLength} characters long`);
        } else {
            input.setCustomValidity('');
        }
    }

    switchToSignup() {
        if (this.currentForm === 'signup') return;
        
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        
        this.animateFormSwitch(loginForm, signupForm);
        this.currentForm = 'signup';
        this.hideError();
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('signupName')?.focus();
        }, 300);
    }

    switchToLogin() {
        if (this.currentForm === 'login') return;
        
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        
        this.animateFormSwitch(signupForm, loginForm);
        this.currentForm = 'login';
        this.hideError();
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('loginEmail')?.focus();
        }, 300);
    }

    animateFormSwitch(hideForm, showForm) {
        hideForm.classList.add('slide-out');
        
        setTimeout(() => {
            hideForm.classList.add('hidden');
            hideForm.classList.remove('slide-out');
            
            showForm.classList.remove('hidden');
            showForm.classList.add('slide-in');
            
            setTimeout(() => {
                showForm.classList.remove('slide-in');
            }, 300);
        }, 300);
    }

    async handleLogin(event) {
        const form = event.target;
        const formData = new FormData(form);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        if (!this.validateLoginForm(credentials)) {
            return;
        }

        this.showLoading('Signing you in...');

        try {
            const response = await apiClient.login(credentials);
            this.showSuccess('Login successful! Redirecting...');
            
            // Small delay for UX
            setTimeout(() => {
                this.redirectToApp();
            }, 1000);
            
        } catch (error) {
            this.hideLoading();
            this.showError(this.getErrorMessage(error));
        }
    }

    async handleSignup(event) {
        const form = event.target;
        const formData = new FormData(form);
        const userData = {
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            password: formData.get('password')
        };

        if (!this.validateSignupForm(userData)) {
            return;
        }

        this.showLoading('Creating your account...');

        try {
            const response = await apiClient.signup(userData);
            this.showSuccess('Account created successfully! Redirecting...');
            
            // Small delay for UX
            setTimeout(() => {
                this.redirectToApp();
            }, 1000);
            
        } catch (error) {
            this.hideLoading();
            this.showError(this.getErrorMessage(error));
        }
    }

    validateLoginForm(credentials) {
        if (!credentials.email?.trim()) {
            this.showError('Please enter your email address');
            return false;
        }

        if (!credentials.password?.trim()) {
            this.showError('Please enter your password');
            return false;
        }

        return true;
    }

    validateSignupForm(userData) {
        if (!userData.full_name?.trim()) {
            this.showError('Please enter your full name');
            return false;
        }

        if (!userData.email?.trim()) {
            this.showError('Please enter your email address');
            return false;
        }

        if (!userData.password?.trim()) {
            this.showError('Please enter a password');
            return false;
        }

        if (userData.password.length < 8) {
            this.showError('Password must be at least 8 characters long');
            return false;
        }

        return true;
    }

    showLoading(message = 'Please wait...') {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const loadingText = loadingSpinner.querySelector('p');

        loginForm.classList.add('hidden');
        signupForm.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
        
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    hideLoading() {
        const loadingSpinner = document.getElementById('loadingSpinner');
        loadingSpinner.classList.add('hidden');
        
        // Show appropriate form
        if (this.currentForm === 'login') {
            document.getElementById('loginForm').classList.remove('hidden');
        } else {
            document.getElementById('signupForm').classList.remove('hidden');
        }
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    hideError() {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    showSuccess(message) {
        // Create a temporary success message
        const successElement = document.createElement('div');
        successElement.className = 'success-message';
        successElement.innerHTML = `<p>${message}</p>`;
        
        const container = document.querySelector('.auth-container');
        container.appendChild(successElement);
        
        // Remove after animation
        setTimeout(() => {
            successElement.remove();
        }, 3000);
    }

    getErrorMessage(error) {
        if (error.message.includes('Invalid email or password')) {
            return 'Invalid email or password. Please try again.';
        }
        
        if (error.message.includes('already exists') || error.message.includes('already registered')) {
            return 'An account with this email already exists. Please try logging in instead.';
        }
        
        if (error.message.includes('Network')) {
            return 'Network error. Please check your connection and try again.';
        }
        
        return error.message || 'An unexpected error occurred. Please try again.';
    }

    redirectToApp() {
        window.location.href = '/app';
    }
}

// Toast notification utility
class Toast {
    static show(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });
        
        // Remove after duration
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// Initialize auth handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthHandler();
});

// Make Toast available globally
window.Toast = Toast;