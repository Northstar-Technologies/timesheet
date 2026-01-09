/**
 * State Module (REQ-044)
 * 
 * Centralized application state management for timesheet forms.
 * Provides reactive state updates and event dispatching.
 */

const TimesheetState = {
    // Current data
    currentTimesheet: null,
    currentWeekStart: null,
    addedHourTypes: new Set(),
    reimbursementItems: [],
    hasUnsavedChanges: false,
    
    // Cached DOM references
    _form: null,
    _entriesBody: null,
    
    // Event listeners
    _listeners: {},
    
    /**
     * Initialize state for a new form session
     * @param {string} weekStart - Week start date (YYYY-MM-DD)
     */
    init(weekStart = null) {
        this.currentTimesheet = null;
        this.currentWeekStart = weekStart;
        this.addedHourTypes = new Set();
        this.reimbursementItems = [];
        this.hasUnsavedChanges = false;
        
        this._cacheDOMReferences();
        this.emit('init', { weekStart });
    },
    
    /**
     * Cache commonly used DOM elements
     */
    _cacheDOMReferences() {
        this._form = document.getElementById('timesheet-form');
        this._entriesBody = document.getElementById('entries-body');
    },
    
    /**
     * Load a timesheet into state
     * @param {Object} timesheet - Timesheet data from API
     */
    loadTimesheet(timesheet) {
        this.currentTimesheet = timesheet;
        this.currentWeekStart = timesheet.week_start;
        this.hasUnsavedChanges = false;
        
        // Track which hour types are loaded
        this.addedHourTypes.clear();
        if (timesheet.entries) {
            timesheet.entries.forEach(entry => {
                this.addedHourTypes.add(entry.hour_type);
            });
        }
        
        // Load reimbursement items
        if (timesheet.reimbursement_items) {
            this.reimbursementItems = [...timesheet.reimbursement_items];
        } else {
            this.reimbursementItems = [];
        }
        
        this.emit('timesheetLoaded', { timesheet });
    },
    
    /**
     * Check if the current timesheet is editable
     * @returns {boolean}
     */
    isEditable() {
        if (!this.currentTimesheet) return true; // New timesheet
        
        const status = this.currentTimesheet.status;
        const payPeriodConfirmed = this.currentTimesheet.pay_period_confirmed || false;
        
        // Pay period confirmed = completely locked
        if (payPeriodConfirmed) return false;
        
        // Only NEW and NEEDS_APPROVAL are editable
        return status === 'NEW' || status === 'NEEDS_APPROVAL';
    },
    
    /**
     * Get timesheet ID if exists
     * @returns {string|null}
     */
    getTimesheetId() {
        return this.currentTimesheet?.id || null;
    },
    
    /**
     * Mark as having unsaved changes
     */
    markChanged() {
        if (!this.hasUnsavedChanges) {
            this.hasUnsavedChanges = true;
            this.emit('changed', { hasChanges: true });
        }
    },
    
    /**
     * Clear unsaved changes flag
     */
    clearChanges() {
        this.hasUnsavedChanges = false;
        this.emit('changed', { hasChanges: false });
    },
    
    /**
     * Add an hour type to tracking
     * @param {string} hourType
     */
    addHourType(hourType) {
        this.addedHourTypes.add(hourType);
        this.markChanged();
        this.emit('hourTypeAdded', { hourType });
    },
    
    /**
     * Remove an hour type from tracking
     * @param {string} hourType
     */
    removeHourType(hourType) {
        this.addedHourTypes.delete(hourType);
        this.markChanged();
        this.emit('hourTypeRemoved', { hourType });
    },
    
    /**
     * Check if an hour type is already added
     * @param {string} hourType
     * @returns {boolean}
     */
    hasHourType(hourType) {
        return this.addedHourTypes.has(hourType);
    },
    
    /**
     * Get list of added hour types
     * @returns {string[]}
     */
    getAddedHourTypes() {
        return Array.from(this.addedHourTypes);
    },
    
    // ===== Reimbursement Items =====
    
    /**
     * Add a reimbursement item
     * @param {Object} item - Item data (optional, creates empty if not provided)
     * @returns {Object} - The created item with ID
     */
    addReimbursementItem(item = null) {
        const newItem = item || {
            id: `item-${Date.now()}`,
            description: '',
            amount: null,
            category: 'Other',
        };
        
        if (!newItem.id) {
            newItem.id = `item-${Date.now()}`;
        }
        
        this.reimbursementItems.push(newItem);
        this.markChanged();
        this.emit('reimbursementItemAdded', { item: newItem });
        
        return newItem;
    },
    
    /**
     * Remove a reimbursement item by ID
     * @param {string} itemId
     */
    removeReimbursementItem(itemId) {
        const index = this.reimbursementItems.findIndex(i => i.id === itemId);
        if (index !== -1) {
            const removed = this.reimbursementItems.splice(index, 1)[0];
            this.markChanged();
            this.emit('reimbursementItemRemoved', { item: removed });
        }
    },
    
    /**
     * Update a reimbursement item field
     * @param {string} itemId
     * @param {string} field
     * @param {any} value
     */
    updateReimbursementItem(itemId, field, value) {
        const item = this.reimbursementItems.find(i => i.id === itemId);
        if (item) {
            item[field] = value;
            this.markChanged();
            this.emit('reimbursementItemUpdated', { item, field, value });
        }
    },
    
    /**
     * Get total reimbursement amount
     * @returns {number}
     */
    getReimbursementTotal() {
        return this.reimbursementItems.reduce((sum, item) => {
            return sum + (parseFloat(item.amount) || 0);
        }, 0);
    },
    
    // ===== Event System =====
    
    /**
     * Subscribe to state events
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} - Unsubscribe function
     */
    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
        
        // Return unsubscribe function
        return () => {
            this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
        };
    },
    
    /**
     * Emit an event to all listeners
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emit(event, data = {}) {
        const listeners = this._listeners[event] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`Error in ${event} listener:`, e);
            }
        });
    },
};

// Export for module bundlers (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimesheetState;
}
