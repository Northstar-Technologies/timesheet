/**
 * Timesheet Module
 * 
 * Handles timesheet form rendering and interactions.
 * Supports multiple hour types per timesheet with add/edit/remove UX.
 */

const TimesheetModule = {
    currentTimesheet: null,
    currentWeekStart: null,
    
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
    
    // Track which hour types have been added
    addedHourTypes: new Set(),
    
    /**
     * Initialize for a given week
     */
    initForWeek(weekStart) {
        this.currentWeekStart = weekStart;
        this.addedHourTypes.clear();
        document.getElementById('hour-type-rows').innerHTML = '';
        this.updateHourTypeSelector();
        this.updateNoEntriesHint();
    },
    
    /**
     * Get week start date (Sunday) from a date
     */
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay(); // 0 = Sunday
        d.setDate(d.getDate() - day);
        return d.toISOString().split('T')[0];
    },
    
    /**
     * Get current week's Sunday
     */
    getCurrentWeekStart() {
        return this.getWeekStart(new Date());
    },
    
    /**
     * Update the hour type selector to hide already-added types
     */
    updateHourTypeSelector() {
        const selector = document.getElementById('hour-type-selector');
        if (!selector) return;
        
        Array.from(selector.options).forEach(option => {
            if (option.value) {
                option.disabled = this.addedHourTypes.has(option.value);
                option.style.display = this.addedHourTypes.has(option.value) ? 'none' : '';
            }
        });
        
        // Reset selection
        selector.value = '';
    },
    
    /**
     * Update the "no entries" hint visibility
     */
    updateNoEntriesHint() {
        const hint = document.getElementById('no-entries-hint');
        if (hint) {
            hint.style.display = this.addedHourTypes.size === 0 ? 'block' : 'none';
        }
    },
    
    /**
     * Generate date headers HTML
     */
    generateDateHeaders() {
        const startDate = new Date(this.currentWeekStart + 'T00:00:00');
        let html = '';
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dayLabel = this.DAYS[i];
            const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
            html += `<div class="header-cell">${dayLabel}<br><small>${dateLabel}</small></div>`;
        }
        
        return html;
    },
    
    /**
     * Add a new hour type row
     */
    addHourTypeRow(hourType, entries = [], isEditing = true) {
        if (this.addedHourTypes.has(hourType)) {
            return; // Already added
        }
        
        this.addedHourTypes.add(hourType);
        
        const container = document.getElementById('hour-type-rows');
        const startDate = new Date(this.currentWeekStart + 'T00:00:00');
        const label = this.HOUR_TYPES[hourType] || hourType;
        
        // Build entry cells
        let entryCells = '';
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Find existing entry for this date
            const existingEntry = entries.find(e => e.entry_date === dateStr);
            const hours = existingEntry ? existingEntry.hours : '';
            
            entryCells += `
                <div class="entry-cell">
                    <input type="number" 
                           class="entry-input" 
                           data-date="${dateStr}"
                           data-type="${hourType}"
                           min="0" 
                           max="24" 
                           step="0.5"
                           value="${hours}"
                           placeholder="0"
                           ${!isEditing ? 'readonly' : ''}>
                </div>
            `;
        }
        
        const rowHtml = `
            <div class="hour-type-row" data-hour-type="${hourType}" data-editing="${isEditing}">
                <div class="hour-type-row-header">
                    <span class="hour-type-label">${label}</span>
                    <div class="hour-type-actions">
                        <button type="button" class="btn btn-sm btn-ghost edit-row-btn" 
                                onclick="TimesheetModule.toggleEditRow('${hourType}')"
                                style="${isEditing ? 'display:none' : ''}">
                            ✏️ Edit
                        </button>
                        <button type="button" class="btn btn-sm btn-ghost done-row-btn" 
                                onclick="TimesheetModule.toggleEditRow('${hourType}')"
                                style="${!isEditing ? 'display:none' : ''}">
                            ✓ Done
                        </button>
                        <button type="button" class="btn btn-sm btn-danger-ghost remove-row-btn" 
                                onclick="TimesheetModule.removeHourTypeRow('${hourType}')">
                            ✕
                        </button>
                    </div>
                </div>
                <div class="hour-type-row-grid">
                    <div class="entries-grid-row">
                        ${this.generateDateHeaders()}
                    </div>
                    <div class="entries-grid-row entries-row">
                        ${entryCells}
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', rowHtml);
        this.updateHourTypeSelector();
        this.updateNoEntriesHint();
    },
    
    /**
     * Toggle edit mode for a row
     */
    toggleEditRow(hourType) {
        const row = document.querySelector(`.hour-type-row[data-hour-type="${hourType}"]`);
        if (!row) return;
        
        const isEditing = row.dataset.editing === 'true';
        row.dataset.editing = (!isEditing).toString();
        
        // Toggle input readonly
        row.querySelectorAll('.entry-input').forEach(input => {
            input.readOnly = isEditing; // Toggle: was editing, now readonly
        });
        
        // Toggle buttons
        row.querySelector('.edit-row-btn').style.display = isEditing ? '' : 'none';
        row.querySelector('.done-row-btn').style.display = isEditing ? 'none' : '';
    },
    
    /**
     * Remove a hour type row
     */
    removeHourTypeRow(hourType) {
        const row = document.querySelector(`.hour-type-row[data-hour-type="${hourType}"]`);
        if (row) {
            row.remove();
        }
        
        this.addedHourTypes.delete(hourType);
        this.updateHourTypeSelector();
        this.updateNoEntriesHint();
    },
    
    /**
     * Collect all entries from all rows
     */
    collectEntries() {
        const entries = [];
        const inputs = document.querySelectorAll('.hour-type-row .entry-input');
        
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
     * Populate form with existing entries (grouped by hour type)
     */
    populateEntries(entries) {
        // Group entries by hour type
        const byType = {};
        entries.forEach(entry => {
            if (!byType[entry.hour_type]) {
                byType[entry.hour_type] = [];
            }
            byType[entry.hour_type].push(entry);
        });
        
        // Add a row for each hour type
        Object.keys(byType).forEach(hourType => {
            this.addHourTypeRow(hourType, byType[hourType], false); // Not editing by default
        });
    },
    
    /**
     * Collect form data for saving
     */
    collectFormData() {
        return {
            traveled: document.getElementById('traveled').checked,
            has_expenses: document.getElementById('has-expenses').checked,
            reimbursement_needed: document.getElementById('reimbursement-needed').checked,
            reimbursement_type: document.getElementById('reimbursement-type').value,
            reimbursement_amount: parseFloat(document.getElementById('reimbursement-amount').value) || null,
            stipend_date: document.getElementById('stipend-date').value || null,
        };
    },
    
    /**
     * Populate form with timesheet data
     */
    populateForm(timesheet) {
        this.currentTimesheet = timesheet;
        
        document.getElementById('timesheet-id').value = timesheet.id;
        document.getElementById('week-start').value = timesheet.week_start;
        document.getElementById('traveled').checked = timesheet.traveled;
        document.getElementById('has-expenses').checked = timesheet.has_expenses;
        document.getElementById('reimbursement-needed').checked = timesheet.reimbursement_needed;
        
        if (timesheet.reimbursement_type) {
            document.getElementById('reimbursement-type').value = timesheet.reimbursement_type;
        }
        if (timesheet.reimbursement_amount) {
            document.getElementById('reimbursement-amount').value = timesheet.reimbursement_amount;
        }
        if (timesheet.stipend_date) {
            document.getElementById('stipend-date').value = timesheet.stipend_date;
        }
        
        // Show/hide reimbursement section
        this.toggleReimbursementSection();
        
        // Initialize for this week
        this.initForWeek(timesheet.week_start);
        
        // Populate entries (creates rows for each hour type)
        if (timesheet.entries && timesheet.entries.length > 0) {
            this.populateEntries(timesheet.entries);
        }
        
        // Populate attachments
        this.renderAttachments(timesheet.attachments || []);
        
        // Show/hide delete button based on status
        const deleteBtn = document.getElementById('delete-btn');
        deleteBtn.style.display = timesheet.status === 'NEW' ? 'block' : 'none';
        
        // Disable form if not a draft
        this.setFormReadOnly(timesheet.status !== 'NEW');
    },
    
    /**
     * Toggle reimbursement section visibility
     */
    toggleReimbursementSection() {
        const checkbox = document.getElementById('reimbursement-needed');
        const section = document.getElementById('reimbursement-section');
        
        if (checkbox.checked) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    },
    
    /**
     * Render attachments list
     */
    renderAttachments(attachments) {
        const container = document.getElementById('attachments-list');
        container.innerHTML = '';
        
        attachments.forEach(att => {
            container.innerHTML += `
                <div class="attachment-item" data-id="${att.id}">
                    <span>📎 ${att.filename}</span>
                    <button type="button" class="remove-btn" onclick="removeAttachment('${att.id}')">&times;</button>
                </div>
            `;
        });
    },
    
    /**
     * Set form to read-only mode
     */
    setFormReadOnly(readOnly) {
        const form = document.getElementById('timesheet-form');
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            input.disabled = readOnly;
        });
        
        // Hide add controls
        const addRow = document.querySelector('.add-hour-type-row');
        if (addRow) addRow.style.display = readOnly ? 'none' : 'flex';
        
        // Hide action buttons on rows
        document.querySelectorAll('.hour-type-actions').forEach(el => {
            el.style.display = readOnly ? 'none' : 'flex';
        });
        
        // Hide action buttons
        const saveBtn = document.getElementById('save-draft-btn');
        const submitBtn = document.getElementById('submit-btn');
        if (saveBtn) saveBtn.style.display = readOnly ? 'none' : 'block';
        if (submitBtn) submitBtn.style.display = readOnly ? 'none' : 'block';
        
        // Hide upload zone
        document.getElementById('upload-zone').style.display = readOnly ? 'none' : 'block';
    },
    
    /**
     * Clear the form for a new timesheet
     */
    clearForm() {
        this.currentTimesheet = null;
        
        document.getElementById('timesheet-id').value = '';
        const weekStart = this.getCurrentWeekStart();
        document.getElementById('week-start').value = weekStart;
        document.getElementById('traveled').checked = false;
        document.getElementById('has-expenses').checked = false;
        document.getElementById('reimbursement-needed').checked = false;
        document.getElementById('reimbursement-type').value = '';
        document.getElementById('reimbursement-amount').value = '';
        document.getElementById('stipend-date').value = '';
        document.getElementById('new-note').value = '';
        
        document.getElementById('reimbursement-section').classList.add('hidden');
        document.getElementById('attachments-list').innerHTML = '';
        document.getElementById('notes-list').innerHTML = '';
        document.getElementById('delete-btn').style.display = 'none';
        
        // Initialize for current week (clears rows)
        this.initForWeek(weekStart);
        
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
};

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
    // Add hour type button
    const addBtn = document.getElementById('add-hour-type-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const selector = document.getElementById('hour-type-selector');
            const hourType = selector.value;
            
            if (!hourType) {
                return; // No type selected
            }
            
            // Initialize week if not set
            if (!TimesheetModule.currentWeekStart) {
                const weekStartInput = document.getElementById('week-start');
                if (weekStartInput && weekStartInput.value) {
                    TimesheetModule.currentWeekStart = TimesheetModule.getWeekStart(weekStartInput.value);
                } else {
                    TimesheetModule.currentWeekStart = TimesheetModule.getCurrentWeekStart();
                }
            }
            
            TimesheetModule.addHourTypeRow(hourType, [], true);
        });
    }
    
    // Reimbursement toggle
    const checkbox = document.getElementById('reimbursement-needed');
    if (checkbox) {
        checkbox.addEventListener('change', () => TimesheetModule.toggleReimbursementSection());
    }
    
    // Week start change handler
    const weekStartInput = document.getElementById('week-start');
    if (weekStartInput) {
        weekStartInput.addEventListener('change', (e) => {
            const weekStart = TimesheetModule.getWeekStart(e.target.value);
            e.target.value = weekStart;
            
            // Re-initialize for new week (clears existing rows)
            if (confirm('Changing the week will clear existing entries. Continue?')) {
                TimesheetModule.initForWeek(weekStart);
            } else {
                e.target.value = TimesheetModule.currentWeekStart;
            }
        });
    }
});
