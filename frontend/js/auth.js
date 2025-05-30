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
        console.log('Setting up auth event listeners...');
        
        // Form switching
        document.getElementById('showSignup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToSignup();
        });

        document.getElementById('showLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToLogin();
        });

        // Form submissions - using the correct IDs from HTML
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            console.log('Login form found, setting up handlers');
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            console.log('Signup form found, setting up handlers');
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }

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

    switchToSignup() {
        if (this.currentForm === 'signup') return;
        
        const loginCard = document.getElementById('loginCard');
        const signupCard = document.getElementById('signupCard');
        
        if (loginCard && signupCard) {
            loginCard.style.display = 'none';
            signupCard.style.display = 'block';
            signupCard.classList.remove('hidden');
        }
        
        this.currentForm = 'signup';
        this.hideError();
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('full_name')?.focus();
        }, 100);
    }

    switchToLogin() {
        if (this.currentForm === 'login') return;
        
        const loginCard = document.getElementById('loginCard');
        const signupCard = document.getElementById('signupCard');
        
        if (loginCard && signupCard) {
            signupCard.style.display = 'none';
            signupCard.classList.add('hidden');
            loginCard.style.display = 'block';
        }
        
        this.currentForm = 'login';
        this.hideError();
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('email')?.focus();
        }, 100);
    }

    async handleLogin(event) {
        event.preventDefault(); // Prevent form submission
        console.log('Login form submitted');

        const form = event.target;
        const formData = new FormData(form);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        console.log('Login attempt for email:', credentials.email);

        if (!this.validateLoginForm(credentials)) {
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            // Update button state
            submitButton.disabled = true;
            submitButton.textContent = 'Signing in...';
            this.hideError();

            console.log('Making login API call...');
            
            const response = await apiClient.login(credentials);
            
            console.log('Login response:', response);

            this.showSuccess('Login successful! Redirecting...');
            
            // Small delay for UX
            setTimeout(() => {
                this.redirectToApp();
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    async handleSignup(event) {
        event.preventDefault(); // Prevent form submission
        console.log('Signup form submitted');

        const form = event.target;
        const formData = new FormData(form);
        const userData = {
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            password: formData.get('password')
        };

        console.log('Signup attempt for email:', userData.email);

        if (!this.validateSignupForm(userData)) {
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            // Update button state
            submitButton.disabled = true;
            submitButton.textContent = 'Creating account...';
            this.hideError();

            console.log('Making signup API call...');
            
            const response = await apiClient.signup(userData);
            
            console.log('Signup response:', response);

            this.showSuccess('Account created successfully! Redirecting...');
            
            // Small delay for UX
            setTimeout(() => {
                this.redirectToApp();
            }, 1000);
            
        } catch (error) {
            console.error('Signup error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = originalText;
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

    showError(message) {
        console.error('Auth error:', message);
        
        const errorElement = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.classList.remove('hidden');
            errorElement.style.display = 'block';
        }
    }

    hideError() {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.classList.add('hidden');
            errorElement.style.display = 'none';
        }
    }

    showSuccess(message) {
        console.log('Auth success:', message);
        
        // Create a temporary success message or use existing error element with different styling
        const errorElement = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.classList.remove('hidden');
            errorElement.style.display = 'block';
            errorElement.style.backgroundColor = '#d4edda';
            errorElement.style.borderColor = '#c3e6cb';
            errorElement.style.color = '#155724';
        }
    }

    getErrorMessage(error) {
        const message = error.message || error.toString();
        
        if (message.includes('Invalid email or password') || message.includes('Invalid credentials')) {
            return 'Invalid email or password. Please try again.';
        }
        
        if (message.includes('already exists') || message.includes('already registered')) {
            return 'An account with this email already exists. Please try logging in instead.';
        }
        
        if (message.includes('Network') || message.includes('fetch')) {
            return 'Network error. Please check your connection and try again.';
        }
        
        if (message.includes('422')) {
            return 'Please check your input and try again.';
        }
        
        return message || 'An unexpected error occurred. Please try again.';
    }

    redirectToApp() {
        // Redirect to the correct resume customizer app URL
        window.location.href = '/resume-customizer/app';
    }
}

// Initialize auth handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AuthHandler...');
    new AuthHandler();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded
    console.log('DOM already loaded, initializing AuthHandler immediately...');
    new AuthHandler();
}

// Export for external use
export default AuthHandler;
