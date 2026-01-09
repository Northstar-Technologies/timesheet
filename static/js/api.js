/**
 * API Client
 * 
 * Wrapper for all API calls to the Flask backend.
 */

const API = {
    /**
     * Get the CSRF token from the meta tag (REQ-031)
     * @returns {string|null} CSRF token or null if not found
     */
    getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : null;
    },
    
    /**
     * Base fetch wrapper with error handling
     * Automatically includes CSRF token for mutating requests (POST/PUT/DELETE)
     */
    async fetch(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };
        
        // REQ-031: Add CSRF token header for mutating requests
        const method = (options.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            const csrfToken = this.getCSRFToken();
            if (csrfToken) {
                mergedOptions.headers['X-CSRFToken'] = csrfToken;
            }
        }
        
        // Don't set Content-Type for FormData (file uploads)
        if (options.body instanceof FormData) {
            delete mergedOptions.headers['Content-Type'];
        }
        
        try {
            const response = await fetch(url, mergedOptions);
            
            if (response.status === 401) {
                // Redirect to login if unauthorized
                window.location.href = '/auth/login';
                return null;
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'An error occurred');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // ==========================================
    // Timesheets
    // ==========================================
    
    /**
     * Get list of user's timesheets
     */
    async getTimesheets(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `/api/timesheets${queryString ? '?' + queryString : ''}`;
        return this.fetch(url);
    },
    
    /**
     * Get a specific timesheet
     */
    async getTimesheet(id) {
        return this.fetch(`/api/timesheets/${id}`);
    },
    
    /**
     * Create a new timesheet
     */
    async createTimesheet(data) {
        return this.fetch('/api/timesheets', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    
    /**
     * Update a timesheet
     */
    async updateTimesheet(id, data) {
        return this.fetch(`/api/timesheets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    
    /**
     * Delete a timesheet
     */
    async deleteTimesheet(id) {
        return this.fetch(`/api/timesheets/${id}`, {
            method: 'DELETE',
        });
    },
    
    /**
     * Submit a timesheet
     */
    async submitTimesheet(id) {
        return this.fetch(`/api/timesheets/${id}/submit`, {
            method: 'POST',
        });
    },
    
    /**
     * Update time entries
     */
    async updateEntries(id, entries) {
        return this.fetch(`/api/timesheets/${id}/entries`, {
            method: 'POST',
            body: JSON.stringify({ entries }),
        });
    },
    
    /**
     * Upload attachment
     */
    async uploadAttachment(id, file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return this.fetch(`/api/timesheets/${id}/attachments`, {
            method: 'POST',
            body: formData,
        });
    },
    
    /**
     * Delete attachment
     */
    async deleteAttachment(timesheetId, attachmentId) {
        return this.fetch(`/api/timesheets/${timesheetId}/attachments/${attachmentId}`, {
            method: 'DELETE',
        });
    },
    
    /**
     * Add note to timesheet
     */
    async addNote(id, content) {
        return this.fetch(`/api/timesheets/${id}/notes`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    },
    
    // ==========================================
    // Admin
    // ==========================================
    
    /**
     * Get all submitted timesheets (admin)
     */
    async getAdminTimesheets(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `/api/admin/timesheets${queryString ? '?' + queryString : ''}`;
        return this.fetch(url);
    },
    
    /**
     * Get a specific timesheet (admin view)
     */
    async getAdminTimesheet(id) {
        return this.fetch(`/api/admin/timesheets/${id}`);
    },
    
    /**
     * Approve a timesheet
     */
    async approveTimesheet(id) {
        return this.fetch(`/api/admin/timesheets/${id}/approve`, {
            method: 'POST',
        });
    },
    
    /**
     * Reject/mark as needs approval
     */
    async rejectTimesheet(id, reason) {
        return this.fetch(`/api/admin/timesheets/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    },
    
    /**
     * Un-approve a timesheet
     */
    async unapproveTimesheet(id) {
        return this.fetch(`/api/admin/timesheets/${id}/unapprove`, {
            method: 'POST',
        });
    },
    
    /**
     * Add admin note
     */
    async addAdminNote(id, content) {
        return this.fetch(`/api/admin/timesheets/${id}/notes`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    },
    
    /**
     * Get all users (admin)
     */
    async getUsers() {
        return this.fetch('/api/admin/users');
    },

    /**
     * Get pay period confirmation status (admin)
     */
    async getPayPeriodStatus(startDate, endDate) {
        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
        });
        return this.fetch(`/api/admin/pay-periods/status?${params.toString()}`);
    },

    /**
     * Confirm pay period (admin)
     */
    async confirmPayPeriod(startDate, endDate) {
        return this.fetch('/api/admin/pay-periods/confirm', {
            method: 'POST',
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate,
            }),
        });
    },

    // ==========================================
    // User Settings
    // ==========================================

    /**
     * Get current user's notification settings
     */
    async getUserSettings() {
        return this.fetch('/api/users/me/settings');
    },

    /**
     * Update current user's notification settings
     */
    async updateUserSettings(data) {
        return this.fetch('/api/users/me/settings', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};
