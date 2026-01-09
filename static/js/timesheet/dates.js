/**
 * Date Utilities Module (REQ-044)
 * 
 * Date formatting, week calculations, and holiday management.
 */

const DateUtils = {
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
        '2025-12-24': 'Christmas Eve',
        '2025-12-25': 'Christmas Day',
        // 2026 Holidays
        '2026-01-01': "New Year's Day",
        '2026-05-25': 'Memorial Day',
        '2026-07-03': 'Independence Day (Observed)',
        '2026-07-04': 'Independence Day',
        '2026-09-07': 'Labor Day',
        '2026-11-26': 'Thanksgiving',
        '2026-11-27': 'Day After Thanksgiving',
        '2026-12-24': 'Christmas Eve',
        '2026-12-25': 'Christmas Day',
        // 2027 Holidays
        '2027-01-01': "New Year's Day",
        '2027-05-31': 'Memorial Day',
        '2027-07-04': 'Independence Day',
        '2027-07-05': 'Independence Day (Observed)',
        '2027-09-06': 'Labor Day',
        '2027-11-25': 'Thanksgiving',
        '2027-11-26': 'Day After Thanksgiving',
        '2027-12-24': 'Christmas Eve (Observed)',
        '2027-12-25': 'Christmas Day',
    },
    
    /**
     * Check if a date is a company holiday
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {boolean}
     */
    isHoliday(dateStr) {
        return dateStr in this.HOLIDAYS;
    },
    
    /**
     * Get holiday name for a date
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string|null}
     */
    getHolidayName(dateStr) {
        return this.HOLIDAYS[dateStr] || null;
    },
    
    /**
     * Format date as YYYY-MM-DD
     * @param {Date|string} date - Date object or string
     * @returns {string}
     */
    formatISO(date) {
        if (typeof date === 'string') {
            // If already ISO format, return as-is
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return date;
            }
            date = new Date(date);
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    /**
     * Parse YYYY-MM-DD string to Date object
     * @param {string} dateStr - Date string
     * @returns {Date}
     */
    parseISO(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    },
    
    /**
     * Get week start date (Sunday) from any date
     * @param {Date|string} date - Date object or YYYY-MM-DD string
     * @returns {string} - Week start in YYYY-MM-DD format
     */
    getWeekStart(date) {
        if (typeof date === 'string') {
            date = this.parseISO(date);
        }
        
        const day = date.getDay(); // 0 = Sunday
        const diff = date.getDate() - day;
        const weekStart = new Date(date);
        weekStart.setDate(diff);
        
        return this.formatISO(weekStart);
    },
    
    /**
     * Get current week's Sunday
     * @returns {string} - Week start in YYYY-MM-DD format
     */
    getCurrentWeekStart() {
        return this.getWeekStart(new Date());
    },
    
    /**
     * Get array of dates for a week starting on given date
     * @param {string} weekStart - Week start in YYYY-MM-DD format
     * @returns {string[]} - Array of 7 dates in YYYY-MM-DD format
     */
    getWeekDates(weekStart) {
        const start = this.parseISO(weekStart);
        const dates = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            dates.push(this.formatISO(date));
        }
        
        return dates;
    },
    
    /**
     * Format week range for display (e.g., "Jan 5 - Jan 11, 2026")
     * @param {string} weekStart - Week start in YYYY-MM-DD format
     * @returns {string}
     */
    formatWeekRange(weekStart) {
        const start = this.parseISO(weekStart);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        
        const options = { month: 'short', day: 'numeric' };
        const startStr = start.toLocaleDateString('en-US', options);
        const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });
        
        return `${startStr} - ${endStr}`;
    },
    
    /**
     * Format date for display (e.g., "Jan 5, 2026")
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string}
     */
    formatDisplay(dateStr) {
        const date = this.parseISO(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    },
    
    /**
     * Format date short (e.g., "1/5")
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string}
     */
    formatShort(dateStr) {
        const date = this.parseISO(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    },
    
    /**
     * Get day of week name
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string}
     */
    getDayName(dateStr) {
        const date = this.parseISO(dateStr);
        return this.DAYS[date.getDay()];
    },
    
    /**
     * Check if date is a weekend (Saturday or Sunday)
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {boolean}
     */
    isWeekend(dateStr) {
        const date = this.parseISO(dateStr);
        const day = date.getDay();
        return day === 0 || day === 6;
    },
    
    /**
     * Get relative date description (e.g., "Today", "Yesterday", "Last Week")
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string}
     */
    getRelativeDescription(dateStr) {
        const date = this.parseISO(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 14) return 'Last week';
        
        return this.formatDisplay(dateStr);
    },
};

// Export for module bundlers (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateUtils;
}
