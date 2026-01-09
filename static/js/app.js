/**
 * Main Application
 * 
 * Entry point for the timesheet application.
 * Handles view switching, data loading, and user interactions.
 */

// ==========================================
// View Management
// ==========================================

function showView(viewId, sidebarViewId = null) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show requested view
    const view = document.getElementById(`view-${viewId}`);
    if (view) {
        view.classList.add('active');
    }
    
    // Update sidebar active state
    // Use sidebarViewId if provided, otherwise match by viewId
    const highlightView = sidebarViewId || viewId;
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.view === highlightView) {
            link.classList.add('active');
        }
    });
}

function showTimesheetsView() {
    showView('timesheets');
    loadTimesheets();
}

function showNewTimesheetView() {
    document.getElementById('editor-title').textContent = 'New Timesheet';
    TimesheetModule.clearForm();
    
    // Show auto-populate checkbox for new timesheets
    const autoPopulateGroup = document.getElementById('auto-populate-group');
    if (autoPopulateGroup) {
        autoPopulateGroup.classList.remove('hidden');
    }
    
    showView('editor');
}

function showEditTimesheetView(timesheet) {
    document.getElementById('editor-title').textContent = 
        timesheet.status === 'NEW' ? 'Edit Timesheet' : 'View Timesheet';
    TimesheetModule.populateForm(timesheet);
    
    // Hide auto-populate checkbox when editing (already has entries)
    const autoPopulateGroup = document.getElementById('auto-populate-group');
    if (autoPopulateGroup) {
        autoPopulateGroup.classList.add('hidden');
    }
    
    // Show editor view but keep "My Timesheets" highlighted in sidebar
    showView('editor', 'timesheets');
}

function showSettingsView() {
    showView('settings');
    if (typeof SettingsModule !== 'undefined') {
        SettingsModule.load();
    }
}

function navigateToView(view) {
    if (view === 'timesheets') {
        showTimesheetsView();
    } else if (view === 'editor' || view === 'new') {
        showNewTimesheetView();
    } else if (view === 'admin') {
        showView('admin');
        if (typeof loadAdminTimesheets === 'function') {
            loadAdminTimesheets();
        }
        if (typeof loadAdminStats === 'function') {
            loadAdminStats();
        }
    } else if (view === 'settings') {
        showSettingsView();
    }
}

// ==========================================
// Data Loading
// ==========================================

async function loadTimesheets() {
    const container = document.getElementById('timesheets-list');
    if (!container) return; // Guard against missing element
    
    container.innerHTML = '<div class="loading">Loading timesheets...</div>';
    
    try {
        const filterEl = document.getElementById('filter-status');
        const status = filterEl ? filterEl.value : '';
        const params = status ? { status } : {};
        const data = await API.getTimesheets(params);
        
        if (data.timesheets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No timesheets yet</h3>
                    <p>Create your first timesheet to get started.</p>
                    <button class="btn btn-primary" onclick="showNewTimesheetView()">
                        + New Timesheet
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.timesheets.map(ts => `
            <div class="timesheet-card" onclick="openTimesheet('${ts.id}')">
                <div class="timesheet-card-header">
                    <span class="timesheet-card-week">${TimesheetModule.formatWeekRange(ts.week_start)}</span>
                    <span class="timesheet-card-status status-${ts.status}">${TimesheetModule.formatStatus(ts.status)}</span>
                </div>
                <div class="timesheet-card-meta">
                    <span>⏱️ ${ts.totals.total}h total</span>
                    <span>💼 ${ts.totals.billable}h billable</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = '<div class="empty-state"><p>Error loading timesheets</p></div>';
    }
}

async function openTimesheet(id) {
    try {
        const timesheet = await API.getTimesheet(id);
        showEditTimesheetView(timesheet);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// Timesheet Actions
// ==========================================

async function saveDraft() {
    const timesheetId = document.getElementById('timesheet-id').value;
    
    try {
        let timesheet;
        
        if (timesheetId) {
            // Update existing
            const formData = TimesheetModule.collectFormData();
            timesheet = await API.updateTimesheet(timesheetId, formData);
            
            // Update entries
            const entries = TimesheetModule.collectEntries();
            timesheet = await API.updateEntries(timesheetId, entries);
        } else {
            // Create new
            const weekStart = document.getElementById('week-start').value;
            const autoPopulate = document.getElementById('auto-populate')?.checked || false;
            
            timesheet = await API.createTimesheet({ 
                week_start: weekStart,
                auto_populate: autoPopulate 
            });
            
            // Update with form data
            const formData = TimesheetModule.collectFormData();
            timesheet = await API.updateTimesheet(timesheet.id, formData);
            
            // Only update entries if not auto-populated (auto-populate creates them on server)
            if (!autoPopulate) {
                const entries = TimesheetModule.collectEntries();
                timesheet = await API.updateEntries(timesheet.id, entries);
            }
            
            // Reload the timesheet to get the server-created entries
            timesheet = await API.getTimesheet(timesheet.id);
        }
        
        showToast('Draft saved successfully', 'success');
        
        // Update form with saved data (including any auto-populated entries)
        TimesheetModule.populateForm(timesheet);
        
        // Hide auto-populate checkbox after timesheet is created
        const autoPopulateGroup = document.getElementById('auto-populate-group');
        if (autoPopulateGroup) {
            autoPopulateGroup.classList.add('hidden');
        }
        
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function submitTimesheet() {
    const timesheetId = document.getElementById('timesheet-id').value;
    
    if (!timesheetId) {
        // Save first
        await saveDraft();
        const newId = document.getElementById('timesheet-id').value;
        if (!newId) return;
    }
    
    // Check if field hours are entered but no attachments
    if (TimesheetModule.hasFieldHours() && !TimesheetModule.hasAttachments()) {
        const proceed = confirm(
            '⚠️ Field Hours Require Approval Document\n\n' +
            'You have entered Field Hours but haven\'t uploaded an approval document.\n\n' +
            'Click "Cancel" to go back and add an attachment.\n' +
            'Click "OK" to submit anyway (you\'ll need to upload later).'
        );
        
        if (!proceed) {
            // Scroll to attachments section
            const attachmentsSection = document.getElementById('upload-zone');
            if (attachmentsSection) {
                attachmentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                attachmentsSection.classList.add('highlight-warning');
                setTimeout(() => attachmentsSection.classList.remove('highlight-warning'), 3000);
            }
            showToast('Please upload an approval document for Field Hours', 'warning');
            return;
        }
    }

    // Check reimbursement items missing attachments (REQ-021)
    const missingReimbursement = TimesheetModule.getMissingReimbursementTypes
        ? TimesheetModule.getMissingReimbursementTypes()
        : [];
    if (missingReimbursement.length > 0) {
        const proceed = confirm(
            '⚠️ Reimbursement Attachments Required\n\n' +
            `Missing attachments for: ${missingReimbursement.join(', ')}\n\n` +
            'Click "Cancel" to add receipts.\n' +
            'Click "OK" to submit anyway (you\'ll need to upload later).'
        );

        if (!proceed) {
            const attachmentsSection = document.getElementById('upload-zone');
            if (attachmentsSection) {
                attachmentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                attachmentsSection.classList.add('highlight-warning');
                setTimeout(() => attachmentsSection.classList.remove('highlight-warning'), 3000);
            }
            showToast('Please attach receipts for reimbursement items', 'warning');
            return;
        }
    }
    
    try {
        const currentId = timesheetId || document.getElementById('timesheet-id').value;
        
        // Save any changes first
        const formData = TimesheetModule.collectFormData();
        await API.updateTimesheet(currentId, formData);
        
        const entries = TimesheetModule.collectEntries();
        await API.updateEntries(currentId, entries);
        
        // Submit
        const timesheet = await API.submitTimesheet(currentId);
        
        if (timesheet.status === 'NEEDS_APPROVAL') {
            showToast('Timesheet submitted - please upload required attachments', 'warning');
        } else {
            showToast('Timesheet submitted successfully!', 'success');
        }
        
        showTimesheetsView();
        
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteTimesheet() {
    const timesheetId = document.getElementById('timesheet-id').value;
    
    if (!timesheetId) {
        showTimesheetsView();
        return;
    }
    
    if (!confirm('Are you sure you want to delete this draft?')) {
        return;
    }
    
    try {
        await API.deleteTimesheet(timesheetId);
        showToast('Draft deleted', 'success');
        showTimesheetsView();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// File Upload
// ==========================================

async function handleFileUpload(file) {
    const timesheetId = document.getElementById('timesheet-id').value;
    const purposeSelect = document.getElementById('attachment-purpose');
    const reimbursementType = purposeSelect ? purposeSelect.value : '';
    
    if (!timesheetId) {
        showToast('Please save the timesheet first', 'warning');
        return;
    }
    
    try {
        const attachment = await API.uploadAttachment(timesheetId, file, reimbursementType);
        
        // Add to attachments list
        const container = document.getElementById('attachments-list');
        const typeLabel = attachment.reimbursement_type ? ` (${attachment.reimbursement_type})` : '';
        container.innerHTML += `
            <div class="attachment-item" data-id="${attachment.id}" data-reimbursement-type="${attachment.reimbursement_type || ''}">
                <span>📎 ${attachment.filename}${typeLabel}</span>
                <button type="button" class="remove-btn" onclick="removeAttachment('${attachment.id}')">&times;</button>
            </div>
        `;
        
        if (typeof TimesheetModule !== 'undefined') {
            TimesheetModule.updateFieldHoursWarning();
            TimesheetModule.updateReimbursementAttachmentWarning();
            TimesheetModule.updateAttachmentTypeOptions();
        }

        showToast('File uploaded', 'success');
        
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function removeAttachment(attachmentId) {
    const timesheetId = document.getElementById('timesheet-id').value;
    
    try {
        await API.deleteAttachment(timesheetId, attachmentId);
        
        // Remove from UI
        const item = document.querySelector(`.attachment-item[data-id="${attachmentId}"]`);
        if (item) item.remove();

        if (typeof TimesheetModule !== 'undefined') {
            TimesheetModule.updateFieldHoursWarning();
            TimesheetModule.updateReimbursementAttachmentWarning();
            TimesheetModule.updateAttachmentTypeOptions();
        }
        
        showToast('Attachment removed', 'success');
        
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// Toast Notifications
// ==========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// ==========================================
// Initialization
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initial navigation (supports deep links like /app#new)
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    if (hash === 'new') {
        showNewTimesheetView();
    } else if (hash === 'admin') {
        showView('admin');
        if (typeof loadAdminTimesheets === 'function') {
            loadAdminTimesheets();
        }
        if (typeof loadAdminStats === 'function') {
            loadAdminStats();
        }
    } else if (hash === 'settings') {
        showSettingsView();
    } else {
        showTimesheetsView();
    }
    
    // Setup filter change handler
    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) {
        filterStatus.addEventListener('change', loadTimesheets);
    }
    
    // Setup sidebar navigation
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToView(link.dataset.view);
        });
    });

    document.querySelectorAll('.user-menu-item[data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToView(link.dataset.view);
            const dropdown = document.getElementById('user-menu-dropdown');
            const trigger = document.getElementById('user-menu-trigger');
            if (dropdown && trigger) {
                dropdown.classList.add('hidden');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // Primary action buttons
    const createBtn = document.getElementById('create-timesheet-btn');
    if (createBtn) {
        createBtn.addEventListener('click', showNewTimesheetView);
    }

    const backBtn = document.getElementById('back-to-list-btn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showTimesheetsView();
        });
    }

    const settingsBackBtn = document.getElementById('settings-back-btn');
    if (settingsBackBtn) {
        settingsBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showTimesheetsView();
        });
    }

    const saveDraftBtn = document.getElementById('save-draft-btn');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', saveDraft);
    }

    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitTimesheet);
    }

    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteTimesheet);
    }
    
    // Setup file upload
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            for (const file of files) {
                await handleFileUpload(file);
            }
            e.target.value = '';
        });
    }
    
    // Setup drag and drop
    const uploadZone = document.getElementById('upload-zone');
    if (uploadZone) {
        uploadZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        
        uploadZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files || []);
            for (const file of files) {
                await handleFileUpload(file);
            }
        });
    }
    
    // ==========================================
    // Hamburger Menu (Mobile Navigation)
    // ==========================================
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (hamburgerBtn && mobileNav) {
        const openMenu = () => {
            hamburgerBtn.classList.add('active');
            mobileNav.classList.remove('hidden');
        };

        const closeMenu = () => {
            hamburgerBtn.classList.remove('active');
            mobileNav.classList.add('hidden');
        };

        // Toggle menu on hamburger click
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mobileNav.classList.contains('hidden')) {
                openMenu();
            } else {
                closeMenu();
            }
        });
        
        // Close menu when a nav link is clicked
        mobileNav.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToView(link.dataset.view);
                closeMenu();
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileNav.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                closeMenu();
            }
        });

        // Swipe gestures for mobile navigation (REQ-038)
        let touchStartX = 0;
        let touchStartY = 0;
        const swipeThreshold = 80;
        const verticalLimit = 60;

        document.addEventListener('touchstart', (e) => {
            if (!window.matchMedia('(max-width: 768px)').matches) {
                return;
            }
            if (!e.touches || e.touches.length !== 1) {
                return;
            }
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!touchStartX || !touchStartY) {
                return;
            }
            const touch = e.changedTouches && e.changedTouches[0];
            if (!touch) {
                return;
            }
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaY) < verticalLimit) {
                if (deltaX > 0 && touchStartX < 40) {
                    openMenu();
                } else if (deltaX < 0) {
                    closeMenu();
                }
            }

            touchStartX = 0;
            touchStartY = 0;
        }, { passive: true });
    }

    // ==========================================
    // User Menu (Settings/Logout)
    // ==========================================
    const userMenuTrigger = document.getElementById('user-menu-trigger');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    if (userMenuTrigger && userMenuDropdown) {
        userMenuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !userMenuDropdown.classList.contains('hidden');
            userMenuDropdown.classList.toggle('hidden', isOpen);
            userMenuTrigger.setAttribute('aria-expanded', String(!isOpen));
        });

        document.addEventListener('click', (e) => {
            if (!userMenuDropdown.contains(e.target) && !userMenuTrigger.contains(e.target)) {
                userMenuDropdown.classList.add('hidden');
                userMenuTrigger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (typeof SettingsModule !== 'undefined') {
        SettingsModule.init();
    }
});
