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
    reimbursementItems: [], // REQ-028: Track multiple reimbursement line items
    nextReimbursementId: 1, // REQ-028: Counter for unique item IDs
    
    // REQ-028: Expense types for reimbursement dropdown
    EXPENSE_TYPES: {
        'Car': '🚗 Car (Mileage)',
        'Gas': '⛽ Gas',
        'Hotel': '🏨 Hotel',
        'Flight': '✈️ Flight',
        'Food': '🍽️ Food',
        'Parking': '🅿️ Parking',
        'Toll': '🛣️ Toll',
        'Other': '📄 Other'
    },
    
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
    
    // Company-observed holidays (REQ-022)
    // Format: 'YYYY-MM-DD': 'Holiday Name'
    HOLIDAYS: {
        // 2025 Holidays
        '2025-01-01': "New Year's Day",
        '2025-05-26': 'Memorial Day',
        '2025-07-04': 'Independence Day',
        '2025-09-01': 'Labor Day',
        '2025-11-27': 'Thanksgiving',
        '2025-11-28': 'Day After Thanksgiving',
        '2025-12-25': 'Christmas Day',
        '2025-12-26': 'Day After Christmas',
        // 2026 Holidays
        '2026-01-01': "New Year's Day",
        '2026-05-25': 'Memorial Day',
        '2026-07-03': 'Independence Day (Observed)',
        '2026-09-07': 'Labor Day',
        '2026-11-26': 'Thanksgiving',
        '2026-11-27': 'Day After Thanksgiving',
        '2026-12-25': 'Christmas Day',
        // 2027 Holidays
        '2027-01-01': "New Year's Day",
        '2027-05-31': 'Memorial Day',
        '2027-07-05': 'Independence Day (Observed)',
        '2027-09-06': 'Labor Day',
        '2027-11-25': 'Thanksgiving',
        '2027-11-26': 'Day After Thanksgiving',
        '2027-12-24': 'Christmas Eve (Observed)',
        '2027-12-25': 'Christmas Day',
    },

    /**
     * Check if a timesheet status allows editing (REQ-023 / BUG-001)
     * Draft (NEW) and rejected (NEEDS_APPROVAL) timesheets are editable.
     * Submitted and Approved timesheets are read-only.
     * @param {string} status - Timesheet status
     * @returns {boolean} - True if editable
     */
    isTimesheetEditable(status, payPeriodConfirmed = false) {
        if (payPeriodConfirmed) {
            return false;
        }
        return status === 'NEW' || status === 'NEEDS_APPROVAL';
    },
    
    /**
     * Check if a date is a company holiday (REQ-022)
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {boolean}
     */
    isHoliday(dateStr) {
        return dateStr in this.HOLIDAYS;
    },
    
    /**
     * Get holiday name for a date (REQ-022)
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string|null}
     */
    getHolidayName(dateStr) {
        return this.HOLIDAYS[dateStr] || null;
    },
    
    /**
     * Format date as YYYY-MM-DD
     * @param {Date} date
     * @returns {string}
     */
    formatDateISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    
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
        
        // Populate hour type selector based on user role (REQ-013)
        this.populateHourTypeSelector();
        
        // Update header with dates
        this.updateHeaderDates(weekStart);
        
        // Setup add button handler
        this.setupAddButton();
        
        // Show/hide add row controls based on whether week is selected
        this.toggleAddRowControls(!!weekStart);
    },
    
    /**
     * Populate hour type selector based on user's role (REQ-013)
     * Trainees can only select "Training", others get all hour types
     */
    populateHourTypeSelector() {
        const selector = document.getElementById('hour-type-selector');
        if (!selector) return;
        
        // Get allowed hour types from current user (set in window.currentUser)
        const allowedTypes = window.currentUser?.allowed_hour_types || Object.keys(this.HOUR_TYPES);
        
        // Clear existing options (except placeholder)
        selector.innerHTML = '<option value="">Select hour type to add...</option>';
        
        // Add only allowed hour types
        allowedTypes.forEach(type => {
            if (this.HOUR_TYPES[type]) {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = this.HOUR_TYPES[type];
                selector.appendChild(option);
            }
        });
        
        // Show trainee-only message if restricted
        if (allowedTypes.length === 1 && allowedTypes[0] === 'Training') {
            const hint = document.createElement('option');
            hint.disabled = true;
            hint.textContent = '(Trainees can only log Training hours)';
            selector.appendChild(hint);
        }
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
     * Update the table header with actual dates (REQ-022: show holiday indicators)
     */
    updateHeaderDates(weekStart) {
        const header = document.querySelector('.hour-type-header');
        if (!header) return;
        
        const dayCells = header.querySelectorAll('.hour-type-day-cell');
        
        // If no weekStart or invalid, show day names only (no date)
        if (!weekStart) {
            dayCells.forEach((cell, i) => {
                cell.innerHTML = this.DAYS[i];
                cell.classList.remove('holiday-cell');
                cell.removeAttribute('title');
                cell.removeAttribute('data-date');
            });
            return;
        }
        
        const startDate = new Date(weekStart + 'T00:00:00');
        
        // Check if date is valid
        if (isNaN(startDate.getTime())) {
            dayCells.forEach((cell, i) => {
                cell.innerHTML = this.DAYS[i];
                cell.classList.remove('holiday-cell');
                cell.removeAttribute('title');
                cell.removeAttribute('data-date');
            });
            return;
        }
        
        dayCells.forEach((cell, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = this.formatDateISO(date);
            const dayLabel = this.DAYS[i];
            const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
            
            // Store date for holiday warning checks (REQ-022)
            cell.setAttribute('data-date', dateStr);
            
            // Check if this day is a holiday (REQ-022)
            const holidayName = this.getHolidayName(dateStr);
            if (holidayName) {
                cell.innerHTML = `${dayLabel}<br><small>${dateLabel}</small><br><span class="holiday-indicator" title="${holidayName}">🎄</span>`;
                cell.classList.add('holiday-cell');
                cell.setAttribute('title', holidayName);
            } else {
                cell.innerHTML = `${dayLabel}<br><small>${dateLabel}</small>`;
                cell.classList.remove('holiday-cell');
                cell.removeAttribute('title');
            }
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
            
            // Initially disable the button (no type selected)
            newBtn.disabled = !selector.value;
            
            // Enable/disable button based on selector value
            selector.addEventListener('change', () => {
                newBtn.disabled = !selector.value || this.addedHourTypes.has(selector.value);
            });
            
            newBtn.addEventListener('click', () => {
                const hourType = selector.value;
                if (hourType && !this.addedHourTypes.has(hourType)) {
                    this.addHourTypeRow(hourType);
                    selector.value = ''; // Reset selector
                    newBtn.disabled = true; // Disable button after adding
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
        
        // REQ-009: Check if auto-populate is enabled (works for any hour type)
        const autoPopulate = document.getElementById('auto-populate')?.checked || false;
        const shouldAutoFill = autoPopulate && !existingData;
        
        // Create row element
        const row = document.createElement('div');
        row.className = 'hour-type-row editing';
        row.dataset.hourType = hourType;
        
        // Hour type label cell
        let html = `<div class="hour-type-label-cell">${label}</div>`;
        
        // Day input cells
        let autoFillTotal = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Determine value: existingData > autoFill (8h Mon-Fri) > 0
            let value = 0;
            if (existingData) {
                value = existingData[dateStr] || 0;
            } else if (shouldAutoFill && i >= 1 && i <= 5) {
                // Mon=1, Tue=2, Wed=3, Thu=4, Fri=5
                value = 8;
                autoFillTotal += 8;
            }
            
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
                           oninput="TimesheetModule.updateRowTotal('${hourType}')"
                           onblur="TimesheetModule.checkHolidayInput(this)">
                </div>
            `;
        }
        
        // Total cell - calculate initial total
        const initialTotal = existingData 
            ? Object.values(existingData).reduce((sum, val) => sum + (parseFloat(val) || 0), 0) 
            : autoFillTotal;
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
     * Get unique reimbursement types selected in line items (REQ-021)
     */
    getReimbursementTypes() {
        return Array.from(
            new Set(
                this.reimbursementItems
                    .map(item => item.type)
                    .filter(type => type)
            )
        );
    },

    /**
     * Get reimbursement types that have attachments (REQ-021)
     */
    getAttachmentReimbursementTypes() {
        const types = new Set();
        document.querySelectorAll('.attachment-item').forEach(item => {
            const type = item.dataset.reimbursementType;
            if (type) types.add(type);
        });
        return Array.from(types);
    },

    /**
     * Get missing reimbursement attachment types (REQ-021)
     */
    getMissingReimbursementTypes() {
        const needed = this.getReimbursementTypes();
        if (!needed.length) return [];
        const attached = new Set(this.getAttachmentReimbursementTypes());
        return needed.filter(type => !attached.has(type));
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
            reimbursement_amount: reimbursementAmount ? (parseFloat(reimbursementAmount.value) || 0) : 0,
            stipend_date: stipendDate ? (stipendDate.value || null) : null,
            user_notes: userNotes ? userNotes.value : '',
            // REQ-028: Include reimbursement line items
            reimbursement_items: this.reimbursementItems.map(item => ({
                type: item.type,
                amount: item.amount,
                date: item.date,
                notes: item.notes
            })),
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
        if (reimbursementAmount) {
            // REQ-026: Display 0.00 for null/undefined amounts, not empty
            reimbursementAmount.value = timesheet.reimbursement_amount != null ? timesheet.reimbursement_amount : '0.00';
        }
        if (timesheet.stipend_date && stipendDate) {
            stipendDate.value = timesheet.stipend_date;
        }
        
        // Show/hide reimbursement section
        this.toggleReimbursementSection();
        
        // REQ-028: Load reimbursement line items from server
        this.clearReimbursementItems();
        if (timesheet.reimbursement_items && timesheet.reimbursement_items.length > 0) {
            timesheet.reimbursement_items.forEach(item => {
                const newItem = {
                    id: this.nextReimbursementId++,
                    type: item.expense_type || item.type || '',
                    amount: item.amount || 0,
                    date: item.expense_date || item.date || '',
                    notes: item.notes || ''
                };
                this.reimbursementItems.push(newItem);
            });
            this.renderReimbursementItems();
            this.updateReimbursementTotal();
        }
        
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
        
        // Populate admin notes (read-only for users, always visible, blank if empty)
        const adminNotesDisplay = document.getElementById('admin-notes-display');
        if (adminNotesDisplay) {
            adminNotesDisplay.textContent = timesheet.admin_notes || '';
        }
        
        // Update field hours warning
        this.updateFieldHoursWarning();
        
        // REQ-023: Determine if timesheet is editable based on status
        const isEditable = this.isTimesheetEditable(
            timesheet.status,
            Boolean(timesheet.pay_period_confirmed)
        );
        
        // Show/hide delete button based on status (only drafts can be deleted)
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.style.display = timesheet.status === 'NEW' && isEditable ? 'block' : 'none';
        }
        
        // REQ-023: Show read-only notice for non-editable timesheets
        const readonlyNotice = document.getElementById('readonly-notice');
        if (readonlyNotice) {
            if (!isEditable) {
                // Customize message based on status
                const statusMessages = {
                    'SUBMITTED': 'This timesheet has been submitted and is pending review. It cannot be edited.',
                    'APPROVED': 'This timesheet has been approved. It cannot be edited.',
                    'PAY_PERIOD_CONFIRMED': 'This pay period has been confirmed and is locked.'
                };
                if (timesheet.pay_period_confirmed) {
                    readonlyNotice.textContent = statusMessages.PAY_PERIOD_CONFIRMED;
                } else {
                    readonlyNotice.textContent = statusMessages[timesheet.status] || 'This timesheet cannot be edited.';
                }
                readonlyNotice.classList.remove('hidden');
            } else {
                readonlyNotice.classList.add('hidden');
            }
        }
        
        // REQ-023: Disable form if not editable
        this.setFormReadOnly(!isEditable);
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
     * Toggle travel section visibility (REQ-024)
     */
    toggleTravelSection() {
        const checkbox = document.getElementById('traveled');
        const section = document.getElementById('travel-section');
        
        if (checkbox && section) {
            if (checkbox.checked) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        }
    },
    
    /**
     * Update mileage estimate display (REQ-024)
     * IRS standard mileage rate for 2024: $0.67/mile
     */
    updateMileageEstimate() {
        const milesInput = document.getElementById('miles-traveled');
        const methodSelect = document.getElementById('travel-method');
        const estimateDiv = document.getElementById('mileage-estimate');
        const estimateValue = document.getElementById('mileage-estimate-value');
        
        if (!milesInput || !estimateDiv || !estimateValue) return;
        
        const miles = parseFloat(milesInput.value) || 0;
        const method = methodSelect ? methodSelect.value : '';
        
        // Only show estimate for personal car (reimbursable mileage)
        if (method === 'personal_car' && miles > 0) {
            const rate = 0.67; // IRS rate
            const estimate = (miles * rate).toFixed(2);
            estimateValue.textContent = `$${estimate}`;
            estimateDiv.style.display = 'flex';
        } else {
            estimateDiv.style.display = 'none';
        }
    },
    
    /**
     * Toggle expense section visibility (REQ-027)
     */
    toggleExpenseSection() {
        const checkbox = document.getElementById('has-expenses');
        const section = document.getElementById('expense-section');
        
        if (checkbox && section) {
            if (checkbox.checked) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        }
    },
    
    /**
     * Update expense reimbursement notice (REQ-027)
     * Shows helpful notice when employee paid out-of-pocket
     */
    updateExpenseNotice() {
        const paidBySelect = document.getElementById('expense-paid-by');
        const notice = document.getElementById('expense-reimbursement-notice');
        
        if (!paidBySelect || !notice) return;
        
        // Show notice if employee paid (needs reimbursement)
        if (paidBySelect.value === 'employee') {
            notice.style.display = 'flex';
        } else {
            notice.style.display = 'none';
        }
    },
    
    /**
     * Add a new reimbursement line item (REQ-028)
     */
    addReimbursementItem(existingItem = null) {
        const id = existingItem?.id || this.nextReimbursementId++;
        const item = existingItem || {
            id: id,
            type: '',
            amount: 0,
            date: '',
            notes: ''
        };
        
        // Only add to array if it's a new item
        if (!existingItem) {
            this.reimbursementItems.push(item);
        }
        
        this.renderReimbursementItems();
        this.updateReimbursementTotal();
        this.markAsChanged();
    },
    
    /**
     * Remove a reimbursement line item (REQ-028)
     */
    removeReimbursementItem(id) {
        this.reimbursementItems = this.reimbursementItems.filter(item => item.id !== id);
        this.renderReimbursementItems();
        this.updateReimbursementTotal();
        this.markAsChanged();
    },
    
    /**
     * Render all reimbursement line items (REQ-028)
     */
    renderReimbursementItems() {
        const container = document.getElementById('reimbursement-items');
        if (!container) return;
        
        if (this.reimbursementItems.length === 0) {
            container.innerHTML = '<div class="empty-items">No expense items added yet. Click "Add Expense Item" to start.</div>';
            return;
        }
        
        // Build expense type options
        const typeOptions = Object.entries(this.EXPENSE_TYPES)
            .map(([value, label]) => `<option value="${value}">${label}</option>`)
            .join('');
        
        container.innerHTML = this.reimbursementItems.map(item => `
            <div class="reimbursement-item" data-item-id="${item.id}">
                <div class="item-row">
                    <div class="item-field">
                        <label>Type</label>
                        <select class="form-select item-type" onchange="TimesheetModule.updateItemFromInput(${item.id}, 'type', this.value)">
                            <option value="">Select...</option>
                            ${typeOptions}
                        </select>
                    </div>
                    <div class="item-field">
                        <label>Amount ($)</label>
                        <input type="number" class="form-input item-amount" 
                               value="${item.amount || ''}" 
                               step="0.01" min="0" max="10000" 
                               placeholder="0.00"
                               oninput="TimesheetModule.updateItemFromInput(${item.id}, 'amount', this.value)">
                    </div>
                    <div class="item-field">
                        <label>Date</label>
                        <input type="date" class="form-input item-date" 
                               value="${item.date || ''}"
                               onchange="TimesheetModule.updateItemFromInput(${item.id}, 'date', this.value)">
                    </div>
                    <div class="item-field item-notes">
                        <label>Notes</label>
                        <input type="text" class="form-input" 
                               value="${item.notes || ''}" 
                               maxlength="100" 
                               placeholder="Brief description..."
                               oninput="TimesheetModule.updateItemFromInput(${item.id}, 'notes', this.value)">
                    </div>
                    <button type="button" class="btn-remove-item" onclick="TimesheetModule.removeReimbursementItem(${item.id})" title="Remove item">
                        ×
                    </button>
                </div>
            </div>
        `).join('');
        
        // Set the selected type for each item
        this.reimbursementItems.forEach(item => {
            const itemEl = container.querySelector(`[data-item-id="${item.id}"]`);
            if (itemEl && item.type) {
                const typeSelect = itemEl.querySelector('.item-type');
                if (typeSelect) typeSelect.value = item.type;
            }
        });

        this.updateAttachmentTypeOptions();
        this.updateReimbursementAttachmentWarning();
    },
    
    /**
     * Update item data from input change (REQ-028)
     */
    updateItemFromInput(id, field, value) {
        const item = this.reimbursementItems.find(i => i.id === id);
        if (item) {
            if (field === 'amount') {
                item[field] = parseFloat(value) || 0;
            } else {
                item[field] = value;
            }
            this.updateReimbursementTotal();
            this.markAsChanged();
            this.updateAttachmentTypeOptions();
            this.updateReimbursementAttachmentWarning();
        }
    },
    
    /**
     * Update running total display (REQ-028)
     */
    updateReimbursementTotal() {
        const totalEl = document.getElementById('reimbursement-total-value');
        const hiddenAmount = document.getElementById('reimbursement-amount');
        
        const total = this.reimbursementItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        if (totalEl) {
            totalEl.textContent = `$${total.toFixed(2)}`;
        }
        
        // Update hidden field for backward compatibility
        if (hiddenAmount) {
            hiddenAmount.value = total;
        }
        
        // Also update hidden type with first item's type (backward compat)
        const hiddenType = document.getElementById('reimbursement-type');
        if (hiddenType && this.reimbursementItems.length > 0) {
            hiddenType.value = this.reimbursementItems[0].type || '';
        }
    },
    
    /**
     * Clear all reimbursement items (REQ-028)
     */
    clearReimbursementItems() {
        this.reimbursementItems = [];
        this.nextReimbursementId = 1;
        this.renderReimbursementItems();
        this.updateReimbursementTotal();
        this.updateAttachmentTypeOptions();
        this.updateReimbursementAttachmentWarning();
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
                const typeLabel = att.reimbursement_type ? ` (${att.reimbursement_type})` : '';
                container.innerHTML += `
                    <div class="attachment-item" data-id="${att.id}" data-reimbursement-type="${att.reimbursement_type || ''}">
                        <span>📎 ${att.filename}${typeLabel}</span>
                        <button type="button" class="remove-btn" onclick="removeAttachment('${att.id}')">&times;</button>
                    </div>
                `;
            });
        }
        
        // Update field hours warning when attachments change
        this.updateFieldHoursWarning();
        this.updateAttachmentTypeOptions();
        this.updateReimbursementAttachmentWarning();
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
     * Check if user is entering hours on a holiday and warn them (REQ-022)
     * @param {HTMLInputElement} input - The hour input element
     */
    checkHolidayInput(input) {
        const dateStr = input.dataset.date;
        const value = parseFloat(input.value) || 0;
        
        // Only warn if entering non-zero hours on a holiday
        if (value <= 0) return;
        
        const holidayName = this.getHolidayName(dateStr);
        if (!holidayName) return;
        
        // Check if we've already warned for this input (prevent multiple prompts)
        if (input.dataset.holidayWarned === dateStr) return;
        
        // Show confirmation dialog
        const confirmed = confirm(
            `⚠️ Holiday Warning\n\n` +
            `This day is a holiday: ${holidayName}\n\n` +
            `Are you sure you want to enter ${value} hours?`
        );
        
        if (confirmed) {
            // Mark as warned so we don't prompt again for this session
            input.dataset.holidayWarned = dateStr;
        } else {
            // Reset to 0 if cancelled
            input.value = 0;
            this.updateRowTotal(input.dataset.type);
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
     * Set form to read-only mode (REQ-023 / BUG-001)
     * @param {boolean} readOnly - True to make form read-only
     */
    setFormReadOnly(readOnly) {
        const form = document.getElementById('timesheet-form');
        if (!form) return;
        
        // Disable all form inputs
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.disabled = readOnly;
        });
        
        // Hide/show form action buttons (Save Draft, Submit)
        const saveBtn = document.getElementById('save-draft-btn');
        const submitBtn = document.getElementById('submit-btn');
        if (saveBtn) saveBtn.style.display = readOnly ? 'none' : 'inline-flex';
        if (submitBtn) submitBtn.style.display = readOnly ? 'none' : 'inline-flex';
        
        // Hide/show upload zone for attachments
        const uploadZone = document.getElementById('upload-zone');
        if (uploadZone) uploadZone.style.display = readOnly ? 'none' : 'block';
        
        // Hide/show the entire "Add hour type" row (selector + button)
        const addHourTypeRow = document.querySelector('.add-hour-type-row');
        if (addHourTypeRow) addHourTypeRow.style.display = readOnly ? 'none' : 'flex';
        
        // Hide/show auto-populate checkbox group
        const autoPopulateGroup = document.getElementById('auto-populate-group');
        if (autoPopulateGroup) autoPopulateGroup.style.display = readOnly ? 'none' : 'block';
        
        // Hide remove/done/edit buttons on hour type rows
        document.querySelectorAll('.hour-type-row .btn-remove').forEach(btn => {
            btn.style.display = readOnly ? 'none' : 'inline-block';
        });
        document.querySelectorAll('.hour-type-row .btn-done').forEach(btn => {
            btn.style.display = readOnly ? 'none' : 'inline-flex';
        });
        document.querySelectorAll('.hour-type-row .btn-action').forEach(btn => {
            btn.style.display = readOnly ? 'none' : 'inline-flex';
        });
        
        // Hide "Actions" column header when read-only
        const actionsHeader = document.querySelector('.hour-type-header .hour-type-actions-cell');
        if (actionsHeader) actionsHeader.style.visibility = readOnly ? 'hidden' : 'visible';
        
        // Hide reimbursement add/remove buttons (REQ-028)
        const addReimbursementBtn = document.getElementById('add-reimbursement-btn');
        if (addReimbursementBtn) addReimbursementBtn.style.display = readOnly ? 'none' : 'inline-flex';
        
        document.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.style.display = readOnly ? 'none' : 'inline-flex';
        });
        
        // Hide attachment remove buttons
        document.querySelectorAll('.attachment-item .remove-btn').forEach(btn => {
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
        const deleteBtn = document.getElementById('delete-btn');
        
        if (timesheetId) timesheetId.value = '';
        
        // Clear week start - user must select a week first
        if (weekStart) weekStart.value = '';
        if (traveled) traveled.checked = false;
        if (hasExpenses) hasExpenses.checked = false;
        if (reimbursementNeeded) reimbursementNeeded.checked = false;
        if (reimbursementType) reimbursementType.value = 'Car';
        if (reimbursementAmount) reimbursementAmount.value = '0.00';  // REQ-026: Default to 0, not empty
        if (stipendDate) stipendDate.value = '';
        if (userNotes) {
            userNotes.value = '';
            this.updateCharCounter();
        }
        
        if (reimbursementSection) reimbursementSection.classList.add('hidden');
        if (attachmentsList) attachmentsList.innerHTML = '<p id="empty-attachments-text" class="empty-attachments-text">There is nothing attached.</p>';
        
        // Clear admin notes display (section stays visible)
        const adminNotesDisplay = document.getElementById('admin-notes-display');
        if (adminNotesDisplay) adminNotesDisplay.textContent = '';
        
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        // Hide field hours warning
        this.updateFieldHoursWarning();
        this.updateReimbursementAttachmentWarning();
        this.updateAttachmentTypeOptions();
        
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
     * Update reimbursement attachment warning visibility (REQ-021)
     */
    updateReimbursementAttachmentWarning() {
        const warning = document.getElementById('reimbursement-attachments-warning');
        const missingLabel = document.getElementById('reimbursement-attachments-missing');
        if (!warning || !missingLabel) return;

        const missing = this.getMissingReimbursementTypes();
        if (missing.length > 0) {
            missingLabel.textContent = missing.join(', ');
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    },

    /**
     * Update attachment purpose options based on reimbursement items (REQ-021)
     */
    updateAttachmentTypeOptions() {
        const select = document.getElementById('attachment-purpose');
        if (!select) return;

        const currentValue = select.value;
        const types = new Set(this.getReimbursementTypes());
        const attachedTypes = this.getAttachmentReimbursementTypes();
        attachedTypes.forEach(type => types.add(type));

        const options = ['<option value="">Field Hours / General</option>'];
        Array.from(types).sort().forEach(type => {
            options.push(`<option value="${type}">${type} Receipt</option>`);
        });

        select.innerHTML = options.join('');

        if (currentValue && types.has(currentValue)) {
            select.value = currentValue;
        } else {
            select.value = '';
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
        // Only track unsaved changes for new/draft timesheets (editable)
        // Don't show warning for approved, submitted, or other non-editable states
        const isEditable = !this.currentTimesheet || this.currentTimesheet.status === 'NEW';
        
        if (!this.hasUnsavedChanges && isEditable) {
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
    
    // Travel checkbox handler (REQ-024)
    const traveledCheckbox = document.getElementById('traveled');
    if (traveledCheckbox) {
        traveledCheckbox.addEventListener('change', () => {
            TimesheetModule.toggleTravelSection();
            TimesheetModule.markAsChanged();
        });
    }
    
    // Miles traveled input - update estimate (REQ-024)
    const milesInput = document.getElementById('miles-traveled');
    if (milesInput) {
        milesInput.addEventListener('input', () => {
            TimesheetModule.updateMileageEstimate();
            TimesheetModule.markAsChanged();
        });
    }
    
    // Travel method select - update estimate (REQ-024)
    const travelMethod = document.getElementById('travel-method');
    if (travelMethod) {
        travelMethod.addEventListener('change', () => {
            TimesheetModule.updateMileageEstimate();
            TimesheetModule.markAsChanged();
        });
    }
    
    // Has expenses checkbox handler (REQ-027)
    const hasExpensesCheckbox = document.getElementById('has-expenses');
    if (hasExpensesCheckbox) {
        hasExpensesCheckbox.addEventListener('change', () => {
            TimesheetModule.toggleExpenseSection();
            TimesheetModule.markAsChanged();
        });
    }
    
    // Expense paid-by select - update notice (REQ-027)
    const expensePaidBy = document.getElementById('expense-paid-by');
    if (expensePaidBy) {
        expensePaidBy.addEventListener('change', () => {
            TimesheetModule.updateExpenseNotice();
            TimesheetModule.markAsChanged();
        });
    }
    
    // REQ-028: Add Expense Item button handler
    const addReimbursementBtn = document.getElementById('add-reimbursement-btn');
    if (addReimbursementBtn) {
        addReimbursementBtn.addEventListener('click', () => {
            TimesheetModule.addReimbursementItem();
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
        
        // Click handler - default to current week's Sunday if empty
        weekStartInput.addEventListener('click', (e) => {
            if (!e.target.value) {
                // Get current week's Sunday
                const today = new Date();
                const day = today.getDay(); // 0 = Sunday
                const sunday = new Date(today);
                sunday.setDate(today.getDate() - day);
                
                // Format as YYYY-MM-DD
                const year = sunday.getFullYear();
                const month = String(sunday.getMonth() + 1).padStart(2, '0');
                const dayOfMonth = String(sunday.getDate()).padStart(2, '0');
                const defaultDate = `${year}-${month}-${dayOfMonth}`;
                
                e.target.value = defaultDate;
                TimesheetModule.initForWeek(defaultDate);
                TimesheetModule.markAsChanged();
                
                // Open calendar picker for user confirmation
                if (typeof e.target.showPicker === 'function') {
                    // Use setTimeout to ensure the value is set before opening picker
                    setTimeout(() => {
                        e.target.showPicker();
                    }, 0);
                }
            }
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
    
    // Help popup toggle handlers - Attachment Info
    const attachmentHelpBtn = document.getElementById('attachment-help-btn');
    const attachmentHelpClose = document.getElementById('attachment-help-close');
    const attachmentHelpPopup = document.getElementById('attachment-help-popup');
    
    if (attachmentHelpBtn) {
        attachmentHelpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            TimesheetModule.toggleHelpPopup('attachment-help-popup');
        });
    }
    
    if (attachmentHelpClose) {
        attachmentHelpClose.addEventListener('click', () => {
            TimesheetModule.toggleHelpPopup('attachment-help-popup');
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
        // Attachment popup
        if (attachmentHelpPopup && !attachmentHelpPopup.classList.contains('hidden')) {
            if (!attachmentHelpPopup.contains(e.target) && e.target !== attachmentHelpBtn) {
                attachmentHelpPopup.classList.add('hidden');
            }
        }
    });
});
