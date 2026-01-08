/**
 * Admin Module
 * 
 * Admin-specific functionality for managing timesheets.
 */

// Store for loaded users
let adminUsers = [];

// ==========================================
// Data Loading
// ==========================================

async function loadAdminTimesheets() {
    const container = document.getElementById('admin-timesheets-list');
    if (!container) return; // Guard against missing element
    
    container.innerHTML = '<div class="loading">Loading timesheets...</div>';
    
    try {
        const statusEl = document.getElementById('admin-filter-status');
        const userEl = document.getElementById('admin-filter-user');
        const weekEl = document.getElementById('admin-filter-week');
        const hourTypeEl = document.getElementById('admin-filter-hourtype');
        const status = statusEl ? statusEl.value : '';
        const userId = userEl ? userEl.value : '';
        const weekStart = weekEl ? weekEl.value : '';
        const hourType = hourTypeEl ? hourTypeEl.value : '';
        
        const params = {};
        if (status) params.status = status;
        if (userId) params.user_id = userId;
        if (weekStart) params.week_start = weekStart;
        if (hourType) params.hour_type = hourType;
        
        const data = await API.getAdminTimesheets(params);
        
        if (data.timesheets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No timesheets found</h3>
                    <p>No timesheets match the current filters.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.timesheets.map(ts => `
            <div class="timesheet-card" onclick="openAdminTimesheet('${ts.id}')">
                <div class="timesheet-card-header">
                    <span class="timesheet-card-week">${TimesheetModule.formatWeekRange(ts.week_start)}</span>
                    <span class="timesheet-card-status status-${ts.status}">${TimesheetModule.formatStatus(ts.status)}</span>
                </div>
                <div class="timesheet-card-meta">
                    <span>⏱️ ${ts.totals.total}h total</span>
                    <span>💼 ${ts.totals.billable}h billable</span>
                    <span>💵 ${ts.totals.payable}h payable</span>
                </div>
                <div class="timesheet-card-user">
                    👤 ${ts.user ? ts.user.display_name : 'Unknown User'}
                    ${ts.traveled ? '<span class="travel-badge" title="Traveled this week">✈️</span>' : ''}
                    ${ts.has_expenses ? '<span class="expense-badge" title="Has expenses">💰</span>' : ''}
                </div>
                <div class="admin-actions">
                    ${ts.status === 'SUBMITTED' ? `
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); approveTimesheetAdmin('${ts.id}')">Approve</button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); rejectTimesheetAdmin('${ts.id}')">Needs Attachment</button>
                    ` : ''}
                    ${ts.status === 'APPROVED' ? `
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); unapproveTimesheetAdmin('${ts.id}')">Un-approve</button>
                    ` : ''}
                    ${ts.status === 'NEEDS_APPROVAL' ? `
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); approveTimesheetAdmin('${ts.id}')">Approve</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        showToast(error.message, 'error');
        container.innerHTML = '<div class="empty-state"><p>Error loading timesheets</p></div>';
    }
}

async function loadAdminUsers() {
    try {
        const data = await API.getUsers();
        adminUsers = data.users;
        
        const select = document.getElementById('admin-filter-user');
        if (select) {
            select.innerHTML = '<option value="">All Users</option>';
            adminUsers.forEach(user => {
                select.innerHTML += `<option value="${user.id}">${user.display_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadAdminStats() {
    try {
        // Fetch all timesheets (no filters) to calculate stats
        const data = await API.getAdminTimesheets({});
        const timesheets = data.timesheets || [];
        
        // Calculate counts
        const pendingCount = timesheets.filter(ts => ts.status === 'SUBMITTED').length;
        const needsAttentionCount = timesheets.filter(ts => ts.status === 'NEEDS_APPROVAL').length;
        
        // Approved this week - check if approved within last 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const approvedThisWeek = timesheets.filter(ts => {
            if (ts.status !== 'APPROVED') return false;
            // Use updated_at as the approval timestamp
            const approvedDate = new Date(ts.updated_at || ts.created_at);
            return approvedDate >= oneWeekAgo;
        }).length;
        
        // Update the stat cards
        const pendingEl = document.getElementById('stat-pending');
        const approvedEl = document.getElementById('stat-approved');
        const needsAttentionEl = document.getElementById('stat-needs-attention');
        
        if (pendingEl) pendingEl.textContent = pendingCount;
        if (approvedEl) approvedEl.textContent = approvedThisWeek;
        if (needsAttentionEl) needsAttentionEl.textContent = needsAttentionCount;
        
        // Add pulse effect if needs attention has items
        const attentionCard = document.getElementById('stat-card-attention');
        if (attentionCard) {
            if (needsAttentionCount > 0) {
                attentionCard.classList.add('needs-attention');
            } else {
                attentionCard.classList.remove('needs-attention');
            }
        }
        
        // Add pending indicator if items waiting
        const pendingCard = document.getElementById('stat-card-pending');
        if (pendingCard) {
            if (pendingCount > 0) {
                pendingCard.classList.add('has-pending');
            } else {
                pendingCard.classList.remove('has-pending');
            }
        }
        
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

async function openAdminTimesheet(id) {
    try {
        const timesheet = await API.getAdminTimesheet(id);
        showAdminTimesheetDetail(timesheet);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// Detail View
// ==========================================

function showAdminTimesheetDetail(timesheet) {
    const container = document.getElementById('admin-timesheets-list');
    
    container.innerHTML = `
        <div class="timesheet-detail">
            <button class="btn btn-back" onclick="loadAdminTimesheets()">← Back to list</button>
            
            <div class="detail-section">
                <h3>
                    ${TimesheetModule.formatWeekRange(timesheet.week_start)}
                    <span class="timesheet-card-status status-${timesheet.status}">${TimesheetModule.formatStatus(timesheet.status)}</span>
                </h3>
            </div>
            
            <div class="detail-section">
                <h4>Employee</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Name</label>
                        <span class="value">${timesheet.user?.display_name || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Email</label>
                        <span class="value">${timesheet.user?.email || 'Unknown'}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Hours Summary</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Total Hours</label>
                        <span class="value">${timesheet.totals.total}h</span>
                    </div>
                    <div class="detail-item">
                        <label>Payable Hours</label>
                        <span class="value">${timesheet.totals.payable}h</span>
                    </div>
                    <div class="detail-item">
                        <label>Billable Hours</label>
                        <span class="value">${timesheet.totals.billable}h</span>
                    </div>
                    <div class="detail-item">
                        <label>Unpaid Hours</label>
                        <span class="value">${timesheet.totals.unpaid}h</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Time Entries</h4>
                <div class="admin-grid-wrapper">
                    <div id="admin-entries-grid" class="entries-grid">
                        <!-- Populated below -->
                    </div>
                </div>
            </div>
            
            ${timesheet.traveled || timesheet.has_expenses || timesheet.reimbursement_needed ? `
            <div class="detail-section">
                <h4>Additional Info</h4>
                <div class="detail-grid">
                    ${timesheet.traveled ? '<div class="detail-item"><span class="value">✈️ Traveled this week</span></div>' : ''}
                    ${timesheet.has_expenses ? '<div class="detail-item"><span class="value">💰 Has Expenses</span></div>' : ''}
                    ${timesheet.reimbursement_needed ? `
                        <div class="detail-item">
                            <label>Reimbursement</label>
                            <span class="value">${timesheet.reimbursement_type}: $${timesheet.reimbursement_amount}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            ${timesheet.attachments && timesheet.attachments.length > 0 ? `
            <div class="detail-section">
                <h4>Attachments</h4>
                <div class="attachments-list">
                    ${timesheet.attachments.map(att => `
                        <a href="/api/admin/timesheets/${timesheet.id}/attachments/${att.id}" 
                           class="attachment-item" target="_blank">
                            📎 ${att.filename}
                        </a>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <div class="detail-section">
                <h4>User Notes</h4>
                <div class="user-notes-display">
                    ${timesheet.user_notes || '<span class="empty-note">No notes from employee.</span>'}
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Admin Notes</h4>
                <div class="admin-notes-list">
                    ${(timesheet.notes || []).length > 0 ? 
                        (timesheet.notes || []).map(note => `
                            <div class="note-item">
                                <div class="note-item-header">
                                    <span>${note.author_name || 'Admin'}</span>
                                    <span>${new Date(note.created_at).toLocaleString()}</span>
                                </div>
                                <div class="note-item-content">${note.content}</div>
                            </div>
                        `).join('') 
                        : '<div class="empty-note">No admin notes yet.</div>'
                    }
                </div>
                <div class="form-group" style="margin-top: var(--spacing-md);">
                    <label class="form-label">Add Admin Note</label>
                    <textarea id="admin-note-input" class="form-textarea" rows="3" placeholder="Enter feedback for the employee..."></textarea>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="addAdminNote('${timesheet.id}')">Add Note</button>
            </div>
            
            <div class="form-actions">
                ${timesheet.status === 'SUBMITTED' || timesheet.status === 'NEEDS_APPROVAL' ? `
                    <button class="btn btn-primary" onclick="approveTimesheetAdmin('${timesheet.id}')">Approve Timesheet</button>
                ` : ''}
                ${timesheet.status === 'SUBMITTED' ? `
                    <button class="btn btn-secondary" onclick="rejectTimesheetAdmin('${timesheet.id}')">Request Attachment</button>
                ` : ''}
                ${timesheet.status === 'APPROVED' ? `
                    <button class="btn btn-secondary" onclick="unapproveTimesheetAdmin('${timesheet.id}')">Un-approve</button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Render entries grid (read-only)
    renderAdminEntriesGrid(timesheet);
}

function renderAdminEntriesGrid(timesheet) {
    const grid = document.getElementById('admin-entries-grid');
    if (!grid) return;
    
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const HOUR_TYPES = ['Field', 'Internal', 'Training', 'PTO', 'Unpaid', 'Holiday'];
    
    // Build entries map
    const entriesMap = {};
    (timesheet.entries || []).forEach(e => {
        const key = `${e.entry_date}-${e.hour_type}`;
        entriesMap[key] = e.hours;
    });
    
    const startDate = new Date(timesheet.week_start + 'T00:00:00');
    
    // Calculate day totals (column totals)
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    
    // Header row with Total column
    let html = '<div class="header-cell row-label">Hour Type</div>';
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        html += `<div class="header-cell">${DAYS[i]}<br><small>${date.getMonth() + 1}/${date.getDate()}</small></div>`;
    }
    html += '<div class="header-cell total-column">Total</div>';
    
    // Data rows with row totals
    HOUR_TYPES.forEach(type => {
        html += `<div class="entry-cell row-label">${type}</div>`;
        
        let rowTotal = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const hours = entriesMap[`${dateStr}-${type}`] || 0;
            
            rowTotal += hours;
            dayTotals[i] += hours;
            
            html += `<div class="entry-cell" style="text-align: center;">${hours || '-'}</div>`;
        }
        
        // Row total cell
        html += `<div class="entry-cell total-column">${rowTotal || '-'}</div>`;
    });
    
    // Day Total row (footer with column totals)
    const grandTotal = dayTotals.reduce((sum, val) => sum + val, 0);
    html += '<div class="entry-cell row-label total-row">Day Total</div>';
    for (let i = 0; i < 7; i++) {
        html += `<div class="entry-cell total-row">${dayTotals[i] || '-'}</div>`;
    }
    html += `<div class="entry-cell total-column total-row grand-total">${grandTotal || '-'}</div>`;
    
    grid.innerHTML = html;
}

// ==========================================
// Admin Actions
// ==========================================

async function approveTimesheetAdmin(id) {
    try {
        await API.approveTimesheet(id);
        showToast('Timesheet approved!', 'success');
        loadAdminTimesheets();
        loadAdminStats();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function rejectTimesheetAdmin(id) {
    const reason = prompt('Reason for requesting attachment (optional):');
    
    try {
        await API.rejectTimesheet(id, reason || '');
        showToast('Timesheet marked as needing attachment', 'success');
        loadAdminTimesheets();
        loadAdminStats();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function unapproveTimesheetAdmin(id) {
    try {
        await API.unapproveTimesheet(id);
        showToast('Timesheet un-approved', 'success');
        loadAdminTimesheets();
        loadAdminStats();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function addAdminNote(timesheetId) {
    const input = document.getElementById('admin-note-input');
    const content = input.value.trim();
    
    if (!content) {
        showToast('Please enter a note', 'warning');
        return;
    }
    
    try {
        await API.addAdminNote(timesheetId, content);
        showToast('Note added', 'success');
        input.value = '';
        
        // Reload timesheet to show new note
        openAdminTimesheet(timesheetId);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// Initialization
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Load users for filter dropdown
    if (window.currentUser && window.currentUser.is_admin) {
        loadAdminUsers();
        loadAdminStats(); // Load stats for KPI cards
    }
    
    // Setup filter handlers
    const statusFilter = document.getElementById('admin-filter-status');
    if (statusFilter) {
        statusFilter.addEventListener('change', loadAdminTimesheets);
    }
    
    const userFilter = document.getElementById('admin-filter-user');
    if (userFilter) {
        userFilter.addEventListener('change', loadAdminTimesheets);
    }
    
    const weekFilter = document.getElementById('admin-filter-week');
    if (weekFilter) {
        weekFilter.addEventListener('change', loadAdminTimesheets);
    }
    
    // Hour type filter (REQ-018)
    const hourTypeFilter = document.getElementById('admin-filter-hourtype');
    if (hourTypeFilter) {
        hourTypeFilter.addEventListener('change', loadAdminTimesheets);
    }
    
    // Clear filters button
    const clearFiltersBtn = document.getElementById('admin-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            const statusEl = document.getElementById('admin-filter-status');
            const userEl = document.getElementById('admin-filter-user');
            const weekEl = document.getElementById('admin-filter-week');
            const hourTypeEl = document.getElementById('admin-filter-hourtype');
            
            if (statusEl) statusEl.value = '';
            if (userEl) userEl.value = '';
            if (weekEl) weekEl.value = '';
            if (hourTypeEl) hourTypeEl.value = '';
            
            // Remove active state from stat cards and this week button
            document.querySelectorAll('.stat-card').forEach(card => {
                card.classList.remove('active');
            });
            const thisWeekBtn = document.getElementById('admin-this-week-btn');
            if (thisWeekBtn) thisWeekBtn.classList.remove('active');
            
            loadAdminTimesheets();
        });
    }
    
    // "This Week" quick filter button (REQ-005)
    const thisWeekBtn = document.getElementById('admin-this-week-btn');
    if (thisWeekBtn) {
        thisWeekBtn.addEventListener('click', () => {
            // Calculate current week's Sunday (week start)
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday
            const sunday = new Date(today);
            sunday.setDate(today.getDate() - dayOfWeek);
            
            // Format as YYYY-MM-DD for the date input
            const weekStart = sunday.toISOString().split('T')[0];
            
            // Set the week filter
            const weekEl = document.getElementById('admin-filter-week');
            if (weekEl) {
                weekEl.value = weekStart;
            }
            
            // Clear other filters for focused view
            const statusEl = document.getElementById('admin-filter-status');
            const userEl = document.getElementById('admin-filter-user');
            if (statusEl) statusEl.value = '';
            if (userEl) userEl.value = '';
            
            // Remove active state from stat cards
            document.querySelectorAll('.stat-card').forEach(card => {
                card.classList.remove('active');
            });
            
            // Add active state to this button
            thisWeekBtn.classList.add('active');
            
            loadAdminTimesheets();
            showToast(`Showing timesheets for week of ${TimesheetModule.formatWeekRange(weekStart)}`, 'info');
        });
    }
    
    // Export to CSV button
    const exportBtn = document.getElementById('admin-export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportTimesheetsToCSV);
    }
    
    // Stat card click handlers (quick filters)
    document.querySelectorAll('.stat-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const filterValue = card.dataset.filter;
            const statusEl = document.getElementById('admin-filter-status');
            const userEl = document.getElementById('admin-filter-user');
            const weekEl = document.getElementById('admin-filter-week');
            
            // Clear other filters
            if (userEl) userEl.value = '';
            if (weekEl) weekEl.value = '';
            
            // Set status filter
            if (statusEl) {
                statusEl.value = filterValue;
            }
            
            // Update active state on cards
            document.querySelectorAll('.stat-card').forEach(c => {
                c.classList.remove('active');
            });
            card.classList.add('active');
            
            // Reload timesheets with filter
            loadAdminTimesheets();
        });
    });
});

// ==========================================
// Export Functionality
// ==========================================

async function exportTimesheetsToCSV() {
    try {
        showToast('Generating export...', 'info');
        
        // Get current filters
        const statusEl = document.getElementById('admin-filter-status');
        const userEl = document.getElementById('admin-filter-user');
        const weekEl = document.getElementById('admin-filter-week');
        
        const params = {};
        if (statusEl && statusEl.value) params.status = statusEl.value;
        if (userEl && userEl.value) params.user_id = userEl.value;
        if (weekEl && weekEl.value) params.week_start = weekEl.value;
        
        // Fetch all timesheets matching filters
        const data = await API.getAdminTimesheets(params);
        
        if (data.timesheets.length === 0) {
            showToast('No timesheets to export', 'warning');
            return;
        }
        
        // Build CSV
        const headers = [
            'Employee',
            'Email',
            'Week Start',
            'Status',
            'Total Hours',
            'Payable Hours',
            'Billable Hours',
            'Unpaid Hours',
            'Traveled',
            'Expenses',
            'Reimbursement',
            'Attachments',
            'Created At'
        ];
        
        const rows = data.timesheets.map(ts => [
            ts.user?.display_name || 'Unknown',
            ts.user?.email || '',
            ts.week_start,
            ts.status,
            ts.totals.total,
            ts.totals.payable,
            ts.totals.billable,
            ts.totals.unpaid,
            ts.traveled ? 'Yes' : 'No',
            ts.has_expenses ? 'Yes' : 'No',
            ts.reimbursement_needed ? `${ts.reimbursement_type}: $${ts.reimbursement_amount}` : 'No',
            ts.attachments?.length || 0,
            new Date(ts.created_at).toLocaleDateString()
        ]);
        
        // Convert to CSV string
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `timesheets_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        showToast(`Exported ${data.timesheets.length} timesheets`, 'success');
        
    } catch (error) {
        showToast('Export failed: ' + error.message, 'error');
    }
}
