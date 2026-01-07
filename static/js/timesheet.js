/**
 * Timesheet Module
 * 
 * Handles timesheet form rendering and interactions.
 * Uses the new "Add Row" UX pattern as specified in UI.md
 */

const TimesheetModule = {
    currentTimesheet: null,
    currentWeekStart: null,
    addedHourTypes: new Set(), // Track which hour types have been added
    hasUnsavedChanges: false, // Track if form has unsaved changes
    
    // Hour types with their labels
    HOUR_TYPES: {
        'Field': 'Field Hours',
        'Internal': 'Internal Hours',
        'Training': 'Training',
        'PTO': 'PTO',
        'Unpaid': 'Unpaid Leave',
        'Holiday': 'Holiday',
    },
    
    // Days of the week (Sunday first)
    DAYS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    
    /**
     * Initialize the module for a specific week
     */
    initForWeek(weekStart) {
        this.currentWeekStart = weekStart;
        this.addedHourTypes.clear();
        
        // Clear existing rows
        const rowsContainer = document.getElementById('hour-type-rows');
        if (rowsContainer) {
            rowsContainer.innerHTML = '';
        }
        
        // Update header with dates
        this.updateHeaderDates(weekStart);
        
        // Setup add button handler
        this.setupAddButton();
        
        // Show/hide add row controls based on whether week is selected
        this.toggleAddRowControls(!!weekStart);
    },
    
    /**
     * Show/hide the add row controls (selector and button)
     */
    toggleAddRowControls(show) {
        const addRow = document.querySelector('.add-hour-type-row');
        if (addRow) {
            addRow.style.display = show ? 'flex' : 'none';
        }
    },
    
    /**
     * Update the table header with actual dates
     */
    updateHeaderDates(weekStart) {
        const header = document.querySelector('.hour-type-header');
        if (!header) return;
        
        const dayCells = header.querySelectorAll('.hour-type-day-cell');
        
        // If no weekStart or invalid, show day names only (no date)
        if (!weekStart) {
            dayCells.forEach((cell, i) => {
                cell.innerHTML = this.DAYS[i];
            });
            return;
        }
        
        const startDate = new Date(weekStart + 'T00:00:00');
        
        // Check if date is valid
        if (isNaN(startDate.getTime())) {
            dayCells.forEach((cell, i) => {
                cell.innerHTML = this.DAYS[i];
            });
            return;
        }
        
        dayCells.forEach((cell, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dayLabel = this.DAYS[i];
            const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
            cell.innerHTML = `${dayLabel}<br><small>${dateLabel}</small>`;
        });
    },
    
    /**
     * Setup the add button click handler
     */
    setupAddButton() {
        const addBtn = document.getElementById('add-hour-type-btn');
        const selector = document.getElementById('hour-type-selector');
        
        if (addBtn && selector) {
            // Remove existing listener to prevent duplicates
            addBtn.replaceWith(addBtn.cloneNode(true));
            const newBtn = document.getElementById('add-hour-type-btn');
            
            newBtn.addEventListener('click', () => {
                const hourType = selector.value;
                if (hourType && !this.addedHourTypes.has(hourType)) {
                    this.addHourTypeRow(hourType);
                    selector.value = ''; // Reset selector
                }
            });
        }
    },
    
    /**
     * Add a new hour type row to the table
     */
    addHourTypeRow(hourType, existingData = null) {
        if (this.addedHourTypes.has(hourType)) {
            return; // Already added
        }
        
        this.addedHourTypes.add(hourType);
        
        const rowsContainer = document.getElementById('hour-type-rows');
        if (!rowsContainer) return;
        
        const startDate = new Date(this.currentWeekStart + 'T00:00:00');
        const label = this.HOUR_TYPES[hourType] || hourType;
        
        // Create row element
        const row = document.createElement('div');
        row.className = 'hour-type-row editing';
        row.dataset.hourType = hourType;
        
        // Hour type label cell
        let html = `<div class="hour-type-label-cell">${label}</div>`;
        
        // Day input cells
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const value = existingData ? (existingData[dateStr] || 0) : 0;
            
            html += `
                <div class="hour-type-day-cell">
                    <input type="number" 
                           class="hour-input"
                           data-date="${dateStr}" 
                           data-type="${hourType}"
                           value="${value}"
                           min="0" 
                           max="24" 
                           step="0.5"
                           placeholder="0"
                           oninput="TimesheetModule.updateRowTotal('${hourType}')">
                </div>
            `;
        }
        
        // Total cell - calculate initial total
        const initialTotal = existingData ? Object.values(existingData).reduce((sum, val) => sum + (parseFloat(val) || 0), 0) : 0;
        html += `<div class="hour-type-total-cell" data-total-for="${hourType}">${initialTotal}</div>`;
        
        // Actions cell
        html += `
            <div class="hour-type-actions-cell">
                <button type="button" class="btn-action btn-done" onclick="TimesheetModule.toggleEditRow('${hourType}')">✓ Done</button>
                <button type="button" class="btn-remove" onclick="TimesheetModule.removeHourTypeRow('${hourType}')">&times;</button>
            </div>
        `;
        
        row.innerHTML = html;
        rowsContainer.appendChild(row);
        
        // Update selector to disable this option
        this.updateSelectorOptions();
        
        // Update field hours warning if Field type was added
        if (hourType === 'Field') {
            this.updateFieldHoursWarning();
        }
    },
    
    /**
     * Remove an hour type row
     */
    removeHourTypeRow(hourType) {
        const row = document.querySelector(`.hour-type-row[data-hour-type="${hourType}"]`);
        if (row) {
            row.remove();
            this.addedHourTypes.delete(hourType);
            this.updateSelectorOptions();
            
            // Update field hours warning if Field type was removed
            if (hourType === 'Field') {
                this.updateFieldHoursWarning();
            }
        }
    },
    
    /**
     * Toggle row between editing and locked state
     */
    toggleEditRow(hourType) {
        const row = document.querySelector(`.hour-type-row[data-hour-type="${hourType}"]`);
        if (!row) return;
        
        const isEditing = row.classList.contains('editing');
        const inputs = row.querySelectorAll('.hour-input');
        const actionsCell = row.querySelector('.hour-type-actions-cell');
        
        if (isEditing) {
            // Lock the row
            row.classList.remove('editing');
            row.classList.add('locked');
            inputs.forEach(input => input.disabled = true);
            actionsCell.innerHTML = `
                <button type="button" class="btn-action btn-edit" onclick="TimesheetModule.toggleEditRow('${hourType}')">✏️ Edit</button>
                <button type="button" class="btn-remove" onclick="TimesheetModule.removeHourTypeRow('${hourType}')">&times;</button>
            `;
        } else {
            // Unlock the row
            row.classList.remove('locked');
            row.classList.add('editing');
            inputs.forEach(input => input.disabled = false);
            actionsCell.innerHTML = `
                <button type="button" class="btn-action btn-done" onclick="TimesheetModule.toggleEditRow('${hourType}')">✓ Done</button>
                <button type="button" class="btn-remove" onclick="TimesheetModule.removeHourTypeRow('${hourType}')">&times;</button>
            `;
        }
    },
    
    /**
     * Update selector to show/hide already added options
     */
    updateSelectorOptions() {
        const selector = document.getElementById('hour-type-selector');
        if (!selector) return;
        
        Array.from(selector.options).forEach(option => {
            if (option.value && this.addedHourTypes.has(option.value)) {
                option.disabled = true;
                option.textContent = this.HOUR_TYPES[option.value] + ' (added)';
            } else if (option.value) {
                option.disabled = false;
                option.textContent = this.HOUR_TYPES[option.value];
            }
        });
    },
    
    /**
     * Get week start date (Sunday) from a date
     */
    getWeekStart(date) {
        const d = new Date(date + 'T00:00:00'); // Parse as local time
        const day = d.getDay(); // 0 = Sunday
        d.setDate(d.getDate() - day);
        // Format as YYYY-MM-DD using local date (not UTC)
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${dayOfMonth}`;
    },
    
    /**
     * Get current week's Sunday
     */
    getCurrentWeekStart() {
        return this.getWeekStart(new Date());
    },
    
    /**
     * Collect entries from all rows
     */
    collectEntries() {
        const entries = [];
        const inputs = document.querySelectorAll('.hour-type-row .hour-input');
        
        inputs.forEach(input => {
            const hours = parseFloat(input.value) || 0;
            if (hours > 0) {
                entries.push({
                    entry_date: input.dataset.date,
                    hour_type: input.dataset.type,
                    hours: hours,
                });
            }
        });
        
        return entries;
    },
    
    /**
     * Check if any field hours row exists or has been entered
     */
    hasFieldHours() {
        // Check if Field row exists (even if no hours entered yet)
        if (this.addedHourTypes.has('Field')) {
            return true;
        }
        // Also check entries for saved timesheets
        const entries = this.collectEntries();
        return entries.some(entry => entry.hour_type === 'Field' && entry.hours > 0);
    },
    
    /**
     * Check if any attachments have been uploaded
     */
    hasAttachments() {
        const attachmentsList = document.getElementById('attachments-list');
        if (!attachmentsList) return false;
        return attachmentsList.querySelectorAll('.attachment-item').length > 0;
    },
    
    /**
     * Populate rows with existing entry data
     */
    populateEntries(entries) {
        // Group entries by hour type
        const grouped = {};
        entries.forEach(entry => {
            if (!grouped[entry.hour_type]) {
                grouped[entry.hour_type] = {};
            }
            grouped[entry.hour_type][entry.entry_date] = entry.hours;
        });
        
        // Add rows for each hour type that has data
        Object.keys(grouped).forEach(hourType => {
            this.addHourTypeRow(hourType, grouped[hourType]);
            // Lock the row after populating
            this.toggleEditRow(hourType);
        });
    },
    
    /**
     * Collect form data for saving
     */
    collectFormData() {
        const traveled = document.getElementById('traveled');
        const hasExpenses = document.getElementById('has-expenses');
        const reimbursementNeeded = document.getElementById('reimbursement-needed');
        const reimbursementType = document.getElementById('reimbursement-type');
        const reimbursementAmount = document.getElementById('reimbursement-amount');
        const stipendDate = document.getElementById('stipend-date');
        const userNotes = document.getElementById('user-notes');
        
        return {
            traveled: traveled ? traveled.checked : false,
            has_expenses: hasExpenses ? hasExpenses.checked : false,
            reimbursement_needed: reimbursementNeeded ? reimbursementNeeded.checked : false,
            reimbursement_type: reimbursementType ? reimbursementType.value : '',
            reimbursement_amount: reimbursementAmount ? (parseFloat(reimbursementAmount.value) || null) : null,
            stipend_date: stipendDate ? (stipendDate.value || null) : null,
            user_notes: userNotes ? userNotes.value : '',
        };
    },
    
    /**
     * Populate form with timesheet data
     */
    populateForm(timesheet) {
        this.currentTimesheet = timesheet;
        
        const timesheetId = document.getElementById('timesheet-id');
        const weekStart = document.getElementById('week-start');
        const traveled = document.getElementById('traveled');
        const hasExpenses = document.getElementById('has-expenses');
        const reimbursementNeeded = document.getElementById('reimbursement-needed');
        const reimbursementType = document.getElementById('reimbursement-type');
        const reimbursementAmount = document.getElementById('reimbursement-amount');
        const stipendDate = document.getElementById('stipend-date');
        
        if (timesheetId) timesheetId.value = timesheet.id;
        if (weekStart) weekStart.value = timesheet.week_start;
        if (traveled) traveled.checked = timesheet.traveled;
        if (hasExpenses) hasExpenses.checked = timesheet.has_expenses;
        if (reimbursementNeeded) reimbursementNeeded.checked = timesheet.reimbursement_needed;
        
        if (timesheet.reimbursement_type && reimbursementType) {
            reimbursementType.value = timesheet.reimbursement_type;
        }
        if (timesheet.reimbursement_amount && reimbursementAmount) {
            reimbursementAmount.value = timesheet.reimbursement_amount;
        }
        if (timesheet.stipend_date && stipendDate) {
            stipendDate.value = timesheet.stipend_date;
        }
        
        // Show/hide reimbursement section
        this.toggleReimbursementSection();
        
        // Initialize entries for this week
        this.initForWeek(timesheet.week_start);
        
        // Populate entries
        if (timesheet.entries && timesheet.entries.length > 0) {
            this.populateEntries(timesheet.entries);
        }
        
        // Populate attachments
        this.renderAttachments(timesheet.attachments || []);
        
        // Populate user notes
        const userNotes = document.getElementById('user-notes');
        if (userNotes) {
            userNotes.value = timesheet.user_notes || '';
            this.updateCharCounter();
        }
        
        // Populate admin notes (read-only for users)
        const adminNotesSection = document.getElementById('admin-notes-section');
        const adminNotesDisplay = document.getElementById('admin-notes-display');
        if (adminNotesSection && adminNotesDisplay) {
            if (timesheet.admin_notes) {
                adminNotesDisplay.textContent = timesheet.admin_notes;
                adminNotesSection.classList.remove('hidden');
            } else {
                adminNotesSection.classList.add('hidden');
            }
        }
        
        // Update field hours warning
        this.updateFieldHoursWarning();
        
        // Show/hide delete button based on status
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.style.display = timesheet.status === 'NEW' ? 'block' : 'none';
        }
        
        // Disable form if not a draft
        this.setFormReadOnly(timesheet.status !== 'NEW');
    },
    
    /**
     * Toggle reimbursement section visibility
     */
    toggleReimbursementSection() {
        const checkbox = document.getElementById('reimbursement-needed');
        const section = document.getElementById('reimbursement-section');
        
        if (checkbox && section) {
            if (checkbox.checked) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        }
    },
    
    /**
     * Render attachments list
     */
    renderAttachments(attachments) {
        const container = document.getElementById('attachments-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (attachments.length === 0) {
            container.innerHTML = '<p id="empty-attachments-text" class="empty-attachments-text">There is nothing attached.</p>';
        } else {
            attachments.forEach(att => {
                container.innerHTML += `
                    <div class="attachment-item" data-id="${att.id}">
                        <span>📎 ${att.filename}</span>
                        <button type="button" class="remove-btn" onclick="removeAttachment('${att.id}')">&times;</button>
                    </div>
                `;
            });
        }
        
        // Update field hours warning when attachments change
        this.updateFieldHoursWarning();
    },
    
    /**
     * Update row total when hours change
     */
    updateRowTotal(hourType) {
        const row = document.querySelector(`.hour-type-row[data-hour-type="${hourType}"]`);
        if (!row) return;
        
        const inputs = row.querySelectorAll('.hour-input');
        let total = 0;
        inputs.forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        
        const totalCell = row.querySelector('.hour-type-total-cell');
        if (totalCell) {
            totalCell.textContent = total;
        }
    },
    
    /**
     * Toggle help popup visibility
     */
    toggleHelpPopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (popup.classList.contains('hidden')) {
            popup.classList.remove('hidden');
        } else {
            popup.classList.add('hidden');
        }
    },
    
    /**
     * Set form to read-only mode
     */
    setFormReadOnly(readOnly) {
        const form = document.getElementById('timesheet-form');
        if (!form) return;
        
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            input.disabled = readOnly;
        });
        
        // Hide action buttons
        const saveBtn = document.getElementById('save-draft-btn');
        const submitBtn = document.getElementById('submit-btn');
        if (saveBtn) saveBtn.style.display = readOnly ? 'none' : 'block';
        if (submitBtn) submitBtn.style.display = readOnly ? 'none' : 'block';
        
        // Hide upload zone and add button
        const uploadZone = document.getElementById('upload-zone');
        const addBtn = document.getElementById('add-hour-type-btn');
        const selector = document.getElementById('hour-type-selector');
        
        if (uploadZone) uploadZone.style.display = readOnly ? 'none' : 'block';
        if (addBtn) addBtn.style.display = readOnly ? 'none' : 'flex';
        if (selector) selector.disabled = readOnly;
        
        // Hide remove buttons on rows
        document.querySelectorAll('.hour-type-row .btn-remove').forEach(btn => {
            btn.style.display = readOnly ? 'none' : 'inline-block';
        });
    },
    
    /**
     * Clear the form for a new timesheet
     */
    clearForm() {
        this.currentTimesheet = null;
        
        const timesheetId = document.getElementById('timesheet-id');
        const weekStart = document.getElementById('week-start');
        const traveled = document.getElementById('traveled');
        const hasExpenses = document.getElementById('has-expenses');
        const reimbursementNeeded = document.getElementById('reimbursement-needed');
        const reimbursementType = document.getElementById('reimbursement-type');
        const reimbursementAmount = document.getElementById('reimbursement-amount');
        const stipendDate = document.getElementById('stipend-date');
        const userNotes = document.getElementById('user-notes');
        const reimbursementSection = document.getElementById('reimbursement-section');
        const attachmentsList = document.getElementById('attachments-list');
        const adminNotesSection = document.getElementById('admin-notes-section');
        const deleteBtn = document.getElementById('delete-btn');
        
        if (timesheetId) timesheetId.value = '';
        
        // Clear week start - user must select a week first
        if (weekStart) weekStart.value = '';
        if (traveled) traveled.checked = false;
        if (hasExpenses) hasExpenses.checked = false;
        if (reimbursementNeeded) reimbursementNeeded.checked = false;
        if (reimbursementType) reimbursementType.value = 'Car';
        if (reimbursementAmount) reimbursementAmount.value = '';
        if (stipendDate) stipendDate.value = '';
        if (userNotes) {
            userNotes.value = '';
            this.updateCharCounter();
        }
        
        if (reimbursementSection) reimbursementSection.classList.add('hidden');
        if (attachmentsList) attachmentsList.innerHTML = '<p id="empty-attachments-text" class="empty-attachments-text">There is nothing attached.</p>';
        if (adminNotesSection) adminNotesSection.classList.add('hidden');
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        // Hide field hours warning
        this.updateFieldHoursWarning();
        
        // Initialize with no week selected - hides add controls
        this.initForWeek(null);
        
        // Clear unsaved changes flag
        this.clearChanges();
        
        // Ensure form is editable
        this.setFormReadOnly(false);
    },
    
    /**
     * Format status for display
     */
    formatStatus(status) {
        const labels = {
            'NEW': 'Draft',
            'SUBMITTED': 'Submitted',
            'APPROVED': 'Approved',
            'NEEDS_APPROVAL': 'Needs Upload',
        };
        return labels[status] || status;
    },
    
    /**
     * Format date for display
     */
    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    },
    
    /**
     * Format week range for display
     */
    formatWeekRange(weekStart) {
        const start = new Date(weekStart + 'T00:00:00');
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        
        const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        return `${startStr} - ${endStr}`;
    },
    
    /**
     * Update field hours warning visibility
     */
    updateFieldHoursWarning() {
        const warning = document.getElementById('field-hours-warning');
        if (!warning) return;
        
        const hasField = this.hasFieldHours();
        const hasAttachments = this.hasAttachments();
        
        if (hasField && !hasAttachments) {
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    },
    
    /**
     * Update character counter for user notes
     */
    updateCharCounter() {
        const userNotes = document.getElementById('user-notes');
        const counter = document.getElementById('user-notes-counter');
        if (!userNotes || !counter) return;
        
        const length = userNotes.value.length;
        const max = 255;
        counter.textContent = `${length}/${max}`;
        
        counter.classList.remove('near-limit', 'at-limit');
        if (length >= max) {
            counter.classList.add('at-limit');
        } else if (length >= max * 0.8) {
            counter.classList.add('near-limit');
        }
    },
    
    /**
     * Mark form as having unsaved changes
     */
    markAsChanged() {
        if (!this.hasUnsavedChanges) {
            this.hasUnsavedChanges = true;
            const warning = document.getElementById('unsaved-changes-warning');
            if (warning) {
                warning.classList.remove('hidden');
            }
        }
    },
    
    /**
     * Clear unsaved changes flag
     */
    clearChanges() {
        this.hasUnsavedChanges = false;
        const warning = document.getElementById('unsaved-changes-warning');
        if (warning) {
            warning.classList.add('hidden');
        }
    },
};

// Bind event handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('reimbursement-needed');
    if (checkbox) {
        checkbox.addEventListener('change', () => {
            TimesheetModule.toggleReimbursementSection();
            TimesheetModule.markAsChanged();
        });
    }
    
    // Week start change handler
    const weekStartInput = document.getElementById('week-start');
    if (weekStartInput) {
        weekStartInput.addEventListener('change', (e) => {
            const weekStart = TimesheetModule.getWeekStart(e.target.value);
            e.target.value = weekStart;
            TimesheetModule.initForWeek(weekStart);
            TimesheetModule.markAsChanged();
        });
    }
    
    // User notes character counter + track changes
    const userNotes = document.getElementById('user-notes');
    if (userNotes) {
        userNotes.addEventListener('input', () => {
            TimesheetModule.updateCharCounter();
            TimesheetModule.markAsChanged();
        });
    }
    
    // Listen for hour input changes to update field hours warning and track changes
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('hour-input')) {
            TimesheetModule.updateFieldHoursWarning();
            TimesheetModule.markAsChanged();
        }
    });
    
    // Track changes on all form inputs (checkboxes, selects, etc.)
    document.addEventListener('change', (e) => {
        if (e.target.closest('#timesheet-form')) {
            TimesheetModule.markAsChanged();
        }
    });
    
    // Help popup toggle handlers - Time Code
    const timeCodeHelpBtn = document.getElementById('time-code-help-btn');
    const timeCodeHelpClose = document.getElementById('time-code-help-close');
    const timeCodeHelpPopup = document.getElementById('time-code-help-popup');
    
    if (timeCodeHelpBtn) {
        timeCodeHelpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            TimesheetModule.toggleHelpPopup('time-code-help-popup');
        });
    }
    
    if (timeCodeHelpClose) {
        timeCodeHelpClose.addEventListener('click', () => {
            TimesheetModule.toggleHelpPopup('time-code-help-popup');
        });
    }
    
    // Help popup toggle handlers - Status Definitions
    const statusHelpBtn = document.getElementById('status-help-btn');
    const statusHelpClose = document.getElementById('status-help-close');
    const statusHelpPopup = document.getElementById('status-help-popup');
    
    if (statusHelpBtn) {
        statusHelpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            TimesheetModule.toggleHelpPopup('status-help-popup');
        });
    }
    
    if (statusHelpClose) {
        statusHelpClose.addEventListener('click', () => {
            TimesheetModule.toggleHelpPopup('status-help-popup');
        });
    }
    
    // Close popups when clicking outside
    document.addEventListener('click', (e) => {
        // Time Code popup
        if (timeCodeHelpPopup && !timeCodeHelpPopup.classList.contains('hidden')) {
            if (!timeCodeHelpPopup.contains(e.target) && e.target !== timeCodeHelpBtn) {
                timeCodeHelpPopup.classList.add('hidden');
            }
        }
        // Status popup
        if (statusHelpPopup && !statusHelpPopup.classList.contains('hidden')) {
            if (!statusHelpPopup.contains(e.target) && e.target !== statusHelpBtn) {
                statusHelpPopup.classList.add('hidden');
            }
        }
    });
});
