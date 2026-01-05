/**
 * Timesheet Module
 * 
 * Handles timesheet form rendering and interactions.
 */

const TimesheetModule = {
    currentTimesheet: null,
    
    // Hour types with their labels
    HOUR_TYPES: [
        { id: 'Field', label: 'Field Hours' },
        { id: 'Internal', label: 'Internal Hours' },
        { id: 'Training', label: 'Training' },
        { id: 'PTO', label: 'PTO' },
        { id: 'Unpaid', label: 'Unpaid Leave' },
        { id: 'Holiday', label: 'Holiday' },
    ],
    
    // Days of the week (Sunday first)
    DAYS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    
    /**
     * Initialize the entries grid
     */
    initEntriesGrid(weekStart) {
        const grid = document.getElementById('entries-grid');
        grid.innerHTML = '';
        
        // Header row
        grid.innerHTML += '<div class="header-cell row-label">Hour Type</div>';
        
        const startDate = new Date(weekStart + 'T00:00:00');
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dayLabel = this.DAYS[i];
            const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
            grid.innerHTML += `<div class="header-cell">${dayLabel}<br><small>${dateLabel}</small></div>`;
        }
        
        // Hour type rows
        for (const hourType of this.HOUR_TYPES) {
            grid.innerHTML += `<div class="entry-cell row-label">${hourType.label}</div>`;
            
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                
                grid.innerHTML += `
                    <div class="entry-cell">
                        <input type="number" 
                               class="entry-input" 
                               data-date="${dateStr}" 
                               data-type="${hourType.id}"
                               min="0" 
                               max="24" 
                               step="0.5"
                               placeholder="0">
                    </div>
                `;
            }
        }
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
     * Collect entries from the grid
     */
    collectEntries() {
        const entries = [];
        const inputs = document.querySelectorAll('.entry-input');
        
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
     * Populate entries grid with existing data
     */
    populateEntries(entries) {
        // Clear all inputs first
        document.querySelectorAll('.entry-input').forEach(input => {
            input.value = '';
        });
        
        // Fill in values
        entries.forEach(entry => {
            const input = document.querySelector(
                `.entry-input[data-date="${entry.entry_date}"][data-type="${entry.hour_type}"]`
            );
            if (input) {
                input.value = entry.hours;
            }
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
        
        // Initialize entries grid
        this.initEntriesGrid(timesheet.week_start);
        
        // Populate entries
        if (timesheet.entries) {
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
        document.getElementById('week-start').value = this.getCurrentWeekStart();
        document.getElementById('traveled').checked = false;
        document.getElementById('has-expenses').checked = false;
        document.getElementById('reimbursement-needed').checked = false;
        document.getElementById('reimbursement-type').value = 'Car';
        document.getElementById('reimbursement-amount').value = '';
        document.getElementById('stipend-date').value = '';
        document.getElementById('new-note').value = '';
        
        document.getElementById('reimbursement-section').classList.add('hidden');
        document.getElementById('attachments-list').innerHTML = '';
        document.getElementById('notes-list').innerHTML = '';
        document.getElementById('delete-btn').style.display = 'none';
        
        // Initialize grid for current week
        this.initEntriesGrid(this.getCurrentWeekStart());
        
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

// Bind the reimbursement toggle
document.addEventListener('DOMContentLoaded', () => {
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
            TimesheetModule.initEntriesGrid(weekStart);
        });
    }
});
