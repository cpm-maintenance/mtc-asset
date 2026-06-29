/**
 * Error Handler Module
 * Centralizes error handling, Sentry reporting, and user-friendly error messages
 * Extracted from app.js
 */

export const errorHandlerModule = {
    handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        this.hasError = true;
        this.errorMessage = this.getUserFriendlyError(error);
        this.errorDetails = error?.message || String(error);
        this.showNotification(this.errorMessage, 'error');
        
        // Send to Sentry
        try {
            if (window.Sentry) {
                window.Sentry.captureException(error, {
                    tags: { context: context || 'unknown' },
                    extra: { userRole: this.userRole, page: this.currentPage }
                });
            }
        } catch (sentryError) {
            console.warn('[Sentry] Failed to capture error:', sentryError);
        }
    },

    getUserFriendlyError(error) {
        if (!error) return 'An unexpected error occurred';
        
        const message = String(error.message || error).toLowerCase();
        
        if (message.includes('network') || message.includes('fetch')) {
            return 'Network error. Please check your connection.';
        }
        if (message.includes('permission') || message.includes('denied')) {
            return 'Access denied. Admin privileges required.';
        }
        if (message.includes('quota') || message.includes('limit')) {
            return 'Rate limit exceeded. Please try again later.';
        }
        if (message.includes('not found') || message.includes('null')) {
            return 'Data not found. Please refresh the page.';
        }
        if (message.includes('auth') || message.includes('login')) {
            return 'Authentication error. Please login again.';
        }
        
        return 'An error occurred. Please try again.';
    },

    clearError() {
        this.hasError = false;
        this.errorMessage = '';
        this.errorDetails = '';
    },
};
