/**
 * Admin Module
 * 
 * Admin-specific functionality for managing timesheets.
 */

// Store for loaded users
let adminUsers = [];
let payPeriodStatus = null;
let reportPage = 1;
let reportPages = 1;

// REQ-025: Expense type icons
const EXPENSE_TYPE_ICONS = {
    'Car': '🚗',
    'Gas': '⛽',
    'Hotel': '🏨',
    'Flight': '✈️',
    'Food': '🍽️',
    'Parking': '🅿️',
    'Toll': '🛣️',
    'Other': '📄'
};

function formatExpenseType(type) {
    const icon = EXPENSE_TYPE_ICONS[type] || '💰';
    return `${icon} ${type}`;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char]));
}

function populateUserSelect(select, users) {
    if (!select) return;
    select.innerHTML = '<option value=\"\">All Users</option>';
    users.forEach(user => {
        select.innerHTML += `<option value=\"${user.id}\">${user.display_name}</option>`;
    });
}

// REQ-004: Pay Period Configuration
// Anchor date for biweekly pay periods (must be a Sunday)
// Adjust this to match your company's pay period calendar
const PAY_PERIOD_ANCHOR = new Date('2026-01-05'); // First Sunday of a pay period

/**
 * Calculate the current pay period (biweekly).
 * Returns the start and end dates of the current pay period.
 */
function getCurrentPayPeriod() {
    const today = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const msPerWeek = 7 * msPerDay;
    const msPer2Weeks = 14 * msPerDay;
    
    // Calculate days since anchor
    const daysSinceAnchor = Math.floor((today - PAY_PERIOD_ANCHOR) / msPerDay);
    
    // Find which 2-week period we're in
    const periodsElapsed = Math.floor(daysSinceAnchor / 14);
    
    // Calculate start of current pay period
    const periodStart = new Date(PAY_PERIOD_ANCHOR.getTime() + (periodsElapsed * msPer2Weeks));
    
    // End is 13 days later (inclusive), or 14 days for exclusive end
    const periodEnd = new Date(periodStart.getTime() + (13 * msPerDay));
    
    const startISO = periodStart.toISOString().split('T')[0];
    const endISO = periodEnd.toISOString().split('T')[0];

    return {
        start: periodStart,
        end: periodEnd,
        startISO,
        endISO,
        // Week starts (Sundays) in this period
        week1: startISO,
        week2: new Date(periodStart.getTime() + msPerWeek).toISOString().split('T')[0]
    };
}

/**
 * Format pay period for display.
 */
function formatPayPeriod(period) {
    const options = { month: 'short', day: 'numeric' };
    const startStr = period.start.toLocaleDateString('en-US', options);
    const endStr = period.end.toLocaleDateString('en-US', options);
    return `${startStr} - ${endStr}`;
}

async function refreshPayPeriodStatus(period) {
    const confirmBtn = document.getElementById('admin-confirm-pay-period-btn');
    const confirmedBadge = document.getElementById('pay-period-confirmed');
    const exportPayPeriodBtn = document.getElementById('admin-export-pay-period-btn');

    if (!period || !confirmBtn || !confirmedBadge || !exportPayPeriodBtn) {
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Checking...';

    try {
        const data = await API.getPayPeriodStatus(period.startISO, period.endISO);
        payPeriodStatus = data;

        if (data.confirmed && data.pay_period) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '✅ Pay Period Confirmed';
            confirmedBadge.textContent = 'Confirmed';
            confirmedBadge.title = data.pay_period.confirmed_at
                ? `Confirmed ${new Date(data.pay_period.confirmed_at).toLocaleString()}`
                : 'Confirmed';
            confirmedBadge.classList.remove('hidden');
            exportPayPeriodBtn.classList.remove('hidden');
        } else {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '✅ Confirm Pay Period';
            confirmedBadge.classList.add('hidden');
            exportPayPeriodBtn.classList.add('hidden');
        }
    } catch (error) {
        payPeriodStatus = null;
        confirmBtn.disabled = true;
        confirmBtn.textContent = '⚠️ Confirm Pay Period';
        confirmedBadge.classList.add('hidden');
        exportPayPeriodBtn.classList.add('hidden');
        showToast('Failed to load pay period status', 'error');
    }
}

function resetPayPeriodConfirmationUI() {
    const confirmBtn = document.getElementById('admin-confirm-pay-period-btn');
    const confirmedBadge = document.getElementById('pay-period-confirmed');
    const exportPayPeriodBtn = document.getElementById('admin-export-pay-period-btn');

    payPeriodStatus = null;

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '✅ Confirm Pay Period';
    }
    if (confirmedBadge) {
        confirmedBadge.classList.add('hidden');
    }
    if (exportPayPeriodBtn) {
        exportPayPeriodBtn.classList.add('hidden');
    }
}

async function confirmPayPeriod() {
    if (!window.payPeriodFilter) {
        showToast('Select a pay period first', 'warning');
        return;
    }

    if (payPeriodStatus && payPeriodStatus.confirmed) {
        showToast('Pay period is already confirmed', 'info');
        return;
    }

    const message = `Confirm pay period ${formatPayPeriod(window.payPeriodFilter)}?\n\n` +
        'This will lock all timesheets in the period and prevent edits.';
    if (!confirm(message)) {
        return;
    }

    try {
        await API.confirmPayPeriod(
            window.payPeriodFilter.startISO,
            window.payPeriodFilter.endISO
        );
        showToast('Pay period confirmed', 'success');
        await refreshPayPeriodStatus(window.payPeriodFilter);
        loadAdminTimesheets();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

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
        
        let allTimesheets = [];
        
        // REQ-004: Check if pay period filter is active
        if (window.payPeriodFilter) {
            // Fetch both weeks of the pay period
            const params1 = { week_start: window.payPeriodFilter.week1 };
            const params2 = { week_start: window.payPeriodFilter.week2 };
            if (status) { params1.status = status; params2.status = status; }
            if (userId) { params1.user_id = userId; params2.user_id = userId; }
            if (hourType) { params1.hour_type = hourType; params2.hour_type = hourType; }
            
            const [data1, data2] = await Promise.all([
                API.getAdminTimesheets(params1),
                API.getAdminTimesheets(params2)
            ]);
            
            // Combine and deduplicate by ID
            const seen = new Set();
            [...data1.timesheets, ...data2.timesheets].forEach(ts => {
                if (!seen.has(ts.id)) {
                    seen.add(ts.id);
                    allTimesheets.push(ts);
                }
            });
        } else {
            // Normal single-week or no-week filter
            const params = {};
            if (status) params.status = status;
            if (userId) params.user_id = userId;
            if (weekStart) params.week_start = weekStart;
            if (hourType) params.hour_type = hourType;
            
            const data = await API.getAdminTimesheets(params);
            allTimesheets = data.timesheets;
        }
        
        if (allTimesheets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No timesheets found</h3>
                    <p>No timesheets match the current filters.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = allTimesheets.map(ts => `
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
        
        const adminSelect = document.getElementById('admin-filter-user');
        populateUserSelect(adminSelect, adminUsers);

        const reportSelect = document.getElementById('report-filter-user');
        populateUserSelect(reportSelect, adminUsers);
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

async function retrySharepointSync(attachmentId, timesheetId) {
    try {
        await API.retrySharepointSync(attachmentId);
        showToast('SharePoint sync queued', 'info');
        if (timesheetId) {
            openAdminTimesheet(timesheetId);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// Data Report View (REQ-039)
// ==========================================

async function loadAdminReport(page = 1) {
    const body = document.getElementById('report-table-body');
    if (!body) return;

    reportPage = page;
    body.innerHTML = '<tr><td colspan="16">Loading report...</td></tr>';

    const statusEl = document.getElementById('report-filter-status');
    const userEl = document.getElementById('report-filter-user');
    const weekEl = document.getElementById('report-filter-week');
    const hourTypeEl = document.getElementById('report-filter-hourtype');
    const startEl = document.getElementById('report-filter-start');
    const endEl = document.getElementById('report-filter-end');
    const perPageEl = document.getElementById('report-per-page');

    const params = {
        page: reportPage,
        per_page: perPageEl && perPageEl.value ? perPageEl.value : 200,
    };

    if (statusEl && statusEl.value) params.status = statusEl.value;
    if (userEl && userEl.value) params.user_id = userEl.value;
    if (weekEl && weekEl.value) params.week_start = weekEl.value;
    if (hourTypeEl && hourTypeEl.value) params.hour_type = hourTypeEl.value;
    if (startEl && startEl.value) params.start_date = startEl.value;
    if (endEl && endEl.value) params.end_date = endEl.value;

    try {
        const data = await API.getTimesheetReport(params);
        reportPages = data.pages || 1;

        const meta = document.getElementById('report-meta');
        if (meta) {
            meta.textContent = `Showing ${data.rows.length} of ${data.total} entries`;
        }

        if (!data.rows.length) {
            body.innerHTML = '<tr><td colspan="16">No entries found.</td></tr>';
            updateReportPagination();
            return;
        }

        body.innerHTML = data.rows.map(row => `
            <tr>
                <td>${row.employee}</td>
                <td>${row.email || ''}</td>
                <td>${row.week_start || ''}</td>
                <td>${row.entry_date}</td>
                <td>${row.hour_type}</td>
                <td>${row.hours}</td>
                <td>${row.status || ''}</td>
                <td>${row.total_hours}</td>
                <td>${row.payable_hours}</td>
                <td>${row.billable_hours}</td>
                <td>${row.unpaid_hours}</td>
                <td>${row.traveled ? 'Yes' : 'No'}</td>
                <td>${row.expenses ? 'Yes' : 'No'}</td>
                <td>${row.reimbursement}</td>
                <td>${row.attachments}</td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="openReportTimesheet('${row.timesheet_id}')">
                        Open
                    </button>
                </td>
            </tr>
        `).join('');

        updateReportPagination();
    } catch (error) {
        showToast(error.message, 'error');
        body.innerHTML = '<tr><td colspan="16">Failed to load report.</td></tr>';
    }
}

function updateReportPagination() {
    const label = document.getElementById('report-page-label');
    const prevBtn = document.getElementById('report-prev');
    const nextBtn = document.getElementById('report-next');

    if (label) {
        label.textContent = `Page ${reportPage} of ${reportPages}`;
    }
    if (prevBtn) {
        prevBtn.disabled = reportPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = reportPage >= reportPages;
    }
}

function openReportTimesheet(timesheetId) {
    navigateToView('admin');
    openAdminTimesheet(timesheetId);
}

// ==========================================
// Detail View
// ==========================================

function showAdminTimesheetDetail(timesheet) {
    const container = document.getElementById('admin-timesheets-list');
    const isLocked = Boolean(timesheet.pay_period_confirmed);
    
    container.innerHTML = `
        <div class="timesheet-detail">
            <button class="btn btn-back" onclick="loadAdminTimesheets()">← Back to list</button>
            
            <div class="detail-section">
                <h3>
                    ${TimesheetModule.formatWeekRange(timesheet.week_start)}
                    <span class="timesheet-card-status status-${timesheet.status}">${TimesheetModule.formatStatus(timesheet.status)}</span>
                </h3>
            </div>

            <div class="detail-section detail-actions">
                <label class="filter-label">Export Format:</label>
                <select id="admin-detail-export-format" class="form-select">
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel (.xlsx)</option>
                    <option value="pdf">PDF</option>
                </select>
                <button class="btn btn-secondary btn-sm" onclick="exportTimesheetDetail('${timesheet.id}')">
                    📤 Export Timesheet
                </button>
            </div>

            ${isLocked ? `
            <div class="detail-section">
                <div class="readonly-notice">
                    This pay period has been confirmed and is locked.
                </div>
            </div>
            ` : ''}
            
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
                            <span class="value">${formatExpenseType(timesheet.reimbursement_type)}: $${timesheet.reimbursement_amount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            ${timesheet.attachments && timesheet.attachments.length > 0 ? `
            <div class="detail-section">
                <h4>Attachments</h4>
                <div class="attachments-list">
                    ${timesheet.attachments.map(att => {
                        const status = att.sharepoint_sync_status || '';
                        const statusLabel = status === 'PENDING'
                            ? 'Pending'
                            : status === 'SYNCED'
                                ? 'Synced'
                                : status === 'FAILED'
                                    ? 'Failed'
                                    : '';
                        const statusBadge = statusLabel
                            ? `<span class="sync-badge sync-${status.toLowerCase()}">${statusLabel}</span>`
                            : '';
                        const sharepointLink = att.sharepoint_web_url
                            ? `<a href="${att.sharepoint_web_url}" target="_blank" rel="noopener">SharePoint</a>`
                            : '';
                        const errorBadge = att.sharepoint_last_error
                            ? `<span class="sync-error" title="${escapeHtml(att.sharepoint_last_error)}">Error</span>`
                            : '';
                        const retryButton = status === 'FAILED'
                            ? `<button class="btn btn-ghost btn-sm" type="button" onclick="retrySharepointSync('${att.id}', '${timesheet.id}')">Retry</button>`
                            : '';

                        return `
                            <div class="attachment-item attachment-admin">
                                <a href="/api/admin/timesheets/${timesheet.id}/attachments/${att.id}" 
                                   target="_blank" rel="noopener">
                                    ${escapeHtml(att.filename)}${att.reimbursement_type ? ` (${escapeHtml(att.reimbursement_type)})` : ''}
                                </a>
                                <div class="attachment-sync">
                                    ${statusBadge}
                                    ${sharepointLink}
                                    ${retryButton}
                                    ${errorBadge}
                                </div>
                            </div>
                        `;
                    }).join('')}
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
            
            ${!isLocked ? `
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
            ` : ''}
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

    if (window.currentUser && window.currentUser.is_admin) {
        const reportRefreshBtn = document.getElementById('report-refresh-btn');
        if (reportRefreshBtn) {
            reportRefreshBtn.addEventListener('click', () => loadAdminReport(1));
        }

        const reportFilters = [
            'report-filter-status',
            'report-filter-user',
            'report-filter-week',
            'report-filter-hourtype',
            'report-filter-start',
            'report-filter-end',
            'report-per-page',
        ];
        reportFilters.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => loadAdminReport(1));
            }
        });

        const reportClear = document.getElementById('report-clear-filters');
        if (reportClear) {
            reportClear.addEventListener('click', () => {
                const ids = [
                    'report-filter-status',
                    'report-filter-user',
                    'report-filter-week',
                    'report-filter-hourtype',
                    'report-filter-start',
                    'report-filter-end',
                ];
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                const perPageEl = document.getElementById('report-per-page');
                if (perPageEl) perPageEl.value = '200';
                loadAdminReport(1);
            });
        }

        const reportPrev = document.getElementById('report-prev');
        if (reportPrev) {
            reportPrev.addEventListener('click', () => {
                if (reportPage > 1) {
                    loadAdminReport(reportPage - 1);
                }
            });
        }

        const reportNext = document.getElementById('report-next');
        if (reportNext) {
            reportNext.addEventListener('click', () => {
                if (reportPage < reportPages) {
                    loadAdminReport(reportPage + 1);
                }
            });
        }
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
            
            // REQ-004: Clear pay period filter
            window.payPeriodFilter = null;
            const payPeriodBtn = document.getElementById('admin-pay-period-btn');
            if (payPeriodBtn) payPeriodBtn.classList.remove('active');
            const payPeriodDisplay = document.getElementById('pay-period-display');
            if (payPeriodDisplay) payPeriodDisplay.style.display = 'none';
            resetPayPeriodConfirmationUI();
            
            // Remove active state from stat cards and filter buttons
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
            // Clear pay period filter (REQ-004)
            window.payPeriodFilter = null;
            const payPeriodBtn = document.getElementById('admin-pay-period-btn');
            if (payPeriodBtn) payPeriodBtn.classList.remove('active');
            const payPeriodDisplay = document.getElementById('pay-period-display');
            if (payPeriodDisplay) payPeriodDisplay.style.display = 'none';
            resetPayPeriodConfirmationUI();
            
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
            const hourTypeEl = document.getElementById('admin-filter-hourtype');
            if (statusEl) statusEl.value = '';
            if (userEl) userEl.value = '';
            if (hourTypeEl) hourTypeEl.value = '';
            
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
    
    // "Pay Period" quick filter button (REQ-004)
    const payPeriodBtn = document.getElementById('admin-pay-period-btn');
    if (payPeriodBtn) {
        payPeriodBtn.addEventListener('click', () => {
            // Calculate current pay period
            const period = getCurrentPayPeriod();
            
            // Store pay period filter state
            window.payPeriodFilter = period;
            
            // Clear week filter (pay period uses its own logic)
            const weekEl = document.getElementById('admin-filter-week');
            if (weekEl) weekEl.value = '';
            
            // Clear other filters for focused view
            const statusEl = document.getElementById('admin-filter-status');
            const userEl = document.getElementById('admin-filter-user');
            if (statusEl) statusEl.value = '';
            if (userEl) userEl.value = '';
            
            // Remove active state from other controls
            document.querySelectorAll('.stat-card').forEach(card => {
                card.classList.remove('active');
            });
            const thisWeekBtn = document.getElementById('admin-this-week-btn');
            if (thisWeekBtn) thisWeekBtn.classList.remove('active');
            
            // Add active state to pay period button
            payPeriodBtn.classList.add('active');
            
            // Show pay period date range
            const payPeriodDisplay = document.getElementById('pay-period-display');
            if (payPeriodDisplay) {
                payPeriodDisplay.textContent = formatPayPeriod(period);
                payPeriodDisplay.style.display = 'inline';
            }
            
            loadAdminTimesheets();
            refreshPayPeriodStatus(period);
            showToast(`Showing pay period: ${formatPayPeriod(period)}`, 'info');
        });
    }
    
    // Export button
    const exportBtn = document.getElementById('admin-export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportTimesheets);
    }

    const confirmPayPeriodBtn = document.getElementById('admin-confirm-pay-period-btn');
    if (confirmPayPeriodBtn) {
        confirmPayPeriodBtn.addEventListener('click', confirmPayPeriod);
    }

    const exportPayPeriodBtn = document.getElementById('admin-export-pay-period-btn');
    if (exportPayPeriodBtn) {
        exportPayPeriodBtn.addEventListener('click', exportPayPeriodToCSV);
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

function getExportFormat(selectId) {
    const select = document.getElementById(selectId);
    return (select && select.value) ? select.value : 'csv';
}

function triggerExport(url) {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function exportTimesheets() {
    const statusEl = document.getElementById('admin-filter-status');
    const userEl = document.getElementById('admin-filter-user');
    const weekEl = document.getElementById('admin-filter-week');
    const hourTypeEl = document.getElementById('admin-filter-hourtype');

    const params = new URLSearchParams();
    params.set('format', getExportFormat('admin-export-format'));

    if (statusEl && statusEl.value) params.set('status', statusEl.value);
    if (userEl && userEl.value) params.set('user_id', userEl.value);
    if (weekEl && weekEl.value) params.set('week_start', weekEl.value);
    if (hourTypeEl && hourTypeEl.value) params.set('hour_type', hourTypeEl.value);

    if (window.payPeriodFilter) {
        params.set('pay_period_start', window.payPeriodFilter.startISO);
        params.set('pay_period_end', window.payPeriodFilter.endISO);
    }

    showToast('Generating export...', 'info');
    triggerExport(`/api/admin/exports/timesheets?${params.toString()}`);
}

function exportPayPeriodToCSV() {
    if (!window.payPeriodFilter) {
        showToast('Select a pay period first', 'warning');
        return;
    }

    if (!payPeriodStatus || !payPeriodStatus.confirmed) {
        showToast('Confirm the pay period before exporting payroll', 'warning');
        return;
    }

    const params = new URLSearchParams({
        format: getExportFormat('admin-export-format'),
        start_date: window.payPeriodFilter.startISO,
        end_date: window.payPeriodFilter.endISO,
    });

    showToast('Generating payroll export...', 'info');
    triggerExport(`/api/admin/exports/pay-period?${params.toString()}`);
}

function exportTimesheetDetail(timesheetId) {
    const format = getExportFormat('admin-detail-export-format');
    const params = new URLSearchParams({ format });
    showToast('Generating timesheet export...', 'info');
    triggerExport(`/api/admin/exports/timesheets/${timesheetId}?${params.toString()}`);
}
