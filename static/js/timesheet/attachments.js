/**
 * Attachments Module (REQ-044)
 * 
 * Handles file attachment upload and display.
 * Depends on: TimesheetState, API
 */

const AttachmentsModule = {
    // Allowed file types
    ALLOWED_EXTENSIONS: ['pdf', 'png', 'jpg', 'jpeg', 'gif'],
    MAX_FILE_SIZE: 16 * 1024 * 1024, // 16MB
    
    /**
     * Get list of current attachments
     * @returns {Object[]}
     */
    getAttachments() {
        return TimesheetState.currentTimesheet?.attachments || [];
    },
    
    /**
     * Render attachments list in the UI
     * @param {Object[]} attachments - Array of attachment objects
     */
    render(attachments = null) {
        const list = document.getElementById('attachments-list');
        if (!list) return;
        
        attachments = attachments || this.getAttachments();
        
        if (!attachments || attachments.length === 0) {
            list.innerHTML = '<p class="no-attachments">No attachments uploaded</p>';
            return;
        }
        
        list.innerHTML = attachments.map(att => this._renderAttachment(att)).join('');
        
        // Setup delete handlers if editable
        if (TimesheetState.isEditable()) {
            this._setupDeleteHandlers();
        }
    },
    
    /**
     * Render a single attachment
     * @private
     */
    _renderAttachment(attachment) {
        const isEditable = TimesheetState.isEditable();
        const icon = this._getFileIcon(attachment.filename);
        const size = this._formatFileSize(attachment.file_size);
        const typeLabel = attachment.reimbursement_type ? ` (${attachment.reimbursement_type})` : '';
        
        return `
            <div class="attachment-item" data-id="${attachment.id}" data-reimbursement-type="${attachment.reimbursement_type || ''}">
                <span class="attachment-icon">${icon}</span>
                <a href="/api/timesheets/${TimesheetState.getTimesheetId()}/attachments/${attachment.id}" 
                   target="_blank" 
                   class="attachment-name">
                    ${this._escapeHtml(attachment.filename)}${typeLabel}
                </a>
                <span class="attachment-size">${size}</span>
                ${isEditable ? `
                    <button type="button" class="attachment-delete" title="Delete">×</button>
                ` : ''}
            </div>
        `;
    },
    
    /**
     * Get file icon emoji based on extension
     * @private
     */
    _getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        
        switch (ext) {
            case 'pdf': return '📄';
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif': return '🖼️';
            default: return '📎';
        }
    },
    
    /**
     * Format file size for display
     * @private
     */
    _formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    
    /**
     * Escape HTML to prevent XSS
     * @private
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    /**
     * Setup delete button handlers
     * @private
     */
    _setupDeleteHandlers() {
        document.querySelectorAll('.attachment-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.attachment-item');
                const attachmentId = item?.dataset.id;
                
                if (attachmentId && confirm('Delete this attachment?')) {
                    await this.delete(attachmentId);
                }
            });
        });
    },
    
    /**
     * Validate a file before upload
     * @param {File} file
     * @returns {Object} - { valid: boolean, error?: string }
     */
    validate(file) {
        // Check extension
        const ext = file.name.split('.').pop().toLowerCase();
        if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
            return {
                valid: false,
                error: `File type not allowed. Allowed: ${this.ALLOWED_EXTENSIONS.join(', ')}`
            };
        }
        
        // Check size
        if (file.size > this.MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File too large. Maximum: ${this._formatFileSize(this.MAX_FILE_SIZE)}`
            };
        }
        
        return { valid: true };
    },
    
    /**
     * Upload a file attachment
     * @param {File} file - File to upload
     * @returns {Promise<Object>} - Uploaded attachment data
     */
    async upload(file) {
        const timesheetId = TimesheetState.getTimesheetId();
        if (!timesheetId) {
            throw new Error('Timesheet must be saved before adding attachments');
        }
        
        // Validate
        const validation = this.validate(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        const purposeSelect = document.getElementById('attachment-purpose');
        if (purposeSelect && purposeSelect.value) {
            formData.append('reimbursement_type', purposeSelect.value);
        }
        
        // Upload via API
        const response = await fetch(`/api/timesheets/${timesheetId}/attachments`, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': this._getCsrfToken(),
            },
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
        
        const attachment = await response.json();
        
        // Update state
        if (TimesheetState.currentTimesheet) {
            if (!TimesheetState.currentTimesheet.attachments) {
                TimesheetState.currentTimesheet.attachments = [];
            }
            TimesheetState.currentTimesheet.attachments.push(attachment);
        }
        
        // Re-render
        this.render();
        
        return attachment;
    },
    
    /**
     * Delete an attachment
     * @param {string} attachmentId
     */
    async delete(attachmentId) {
        const timesheetId = TimesheetState.getTimesheetId();
        if (!timesheetId) return;
        
        const response = await fetch(
            `/api/timesheets/${timesheetId}/attachments/${attachmentId}`,
            {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': this._getCsrfToken(),
                },
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Delete failed');
        }
        
        // Update state
        if (TimesheetState.currentTimesheet?.attachments) {
            TimesheetState.currentTimesheet.attachments = 
                TimesheetState.currentTimesheet.attachments.filter(
                    a => a.id !== attachmentId
                );
        }
        
        // Re-render
        this.render();
    },
    
    /**
     * Check if any attachments exist
     * @returns {boolean}
     */
    hasAttachments() {
        return this.getAttachments().length > 0;
    },
    
    /**
     * Get CSRF token from meta tag or cookie
     * @private
     */
    _getCsrfToken() {
        // Try meta tag first
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.content;
        
        // Try cookie
        const match = document.cookie.match(/csrf_token=([^;]+)/);
        return match ? match[1] : '';
    },
    
    /**
     * Setup file input change handler
     */
    setupUploadHandler() {
        const input = document.getElementById('attachment-input');
        if (!input) return;
        
        input.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files.length) return;
            
            for (const file of files) {
                try {
                    await this.upload(file);
                    this._showSuccess(`Uploaded: ${file.name}`);
                } catch (error) {
                    this._showError(error.message);
                }
            }
            
            // Clear input
            input.value = '';
        });
    },
    
    /**
     * Show success message (integrate with toast system)
     * @private
     */
    _showSuccess(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'success');
        } else {
            console.log('✅', message);
        }
    },
    
    /**
     * Show error message (integrate with toast system)
     * @private
     */
    _showError(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            console.error('❌', message);
        }
    },
    
    /**
     * Set readonly mode
     * @param {boolean} readonly
     */
    setReadOnly(readonly) {
        const input = document.getElementById('attachment-input');
        const uploadBtn = document.getElementById('upload-attachment-btn');
        
        if (input) {
            input.disabled = readonly;
        }
        
        if (uploadBtn) {
            uploadBtn.style.display = readonly ? 'none' : 'inline-block';
        }
        
        // Re-render to show/hide delete buttons
        this.render();
    },
};

// Export for module bundlers (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttachmentsModule;
}
