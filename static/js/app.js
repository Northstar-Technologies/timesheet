/**
 * Main Application
 * 
 * Entry point for the timesheet application.
 * Handles view switching, data loading, and user interactions.
 */

// ==========================================
// View Management
// ==========================================

function showView(viewId) {
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
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.view === viewId) {
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
    showView('editor');
}

function showEditTimesheetView(timesheet) {
    document.getElementById('editor-title').textContent = 
        timesheet.status === 'NEW' ? 'Edit Timesheet' : 'View Timesheet';
    TimesheetModule.populateForm(timesheet);
    showView('editor');
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
            timesheet = await API.createTimesheet({ week_start: weekStart });
            
            // Update with form data
            const formData = TimesheetModule.collectFormData();
            timesheet = await API.updateTimesheet(timesheet.id, formData);
            
            // Update entries
            const entries = TimesheetModule.collectEntries();
            timesheet = await API.updateEntries(timesheet.id, entries);
        }
        
        showToast('Draft saved successfully', 'success');
        
        // Update form with saved data
        TimesheetModule.populateForm(timesheet);
        
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
            showToast('Timesheet submitted - please upload approval document for field hours', 'warning');
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
    
    if (!timesheetId) {
        showToast('Please save the timesheet first', 'warning');
        return;
    }
    
    try {
        const attachment = await API.uploadAttachment(timesheetId, file);
        
        // Add to attachments list
        const container = document.getElementById('attachments-list');
        container.innerHTML += `
            <div class="attachment-item" data-id="${attachment.id}">
                <span>📎 ${attachment.filename}</span>
                <button type="button" class="remove-btn" onclick="removeAttachment('${attachment.id}')">&times;</button>
            </div>
        `;
        
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
            const view = link.dataset.view;
            
            if (view === 'timesheets') {
                showTimesheetsView();
            } else if (view === 'editor') {
                showNewTimesheetView();
            } else if (view === 'admin') {
                showView('admin');
                if (typeof loadAdminTimesheets === 'function') {
                    loadAdminTimesheets();
                }
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
});
