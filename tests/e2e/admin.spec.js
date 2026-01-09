/**
 * Admin Dashboard E2E Tests
 * 
 * P0 flows:
 * - Admin login -> View timesheets -> Approve
 * - Admin login -> View timesheets -> Reject
 * - Filter timesheets by status, user, hour type
 */
const { test, expect } = require('./fixtures');

test.describe('Admin Dashboard', () => {
  
  test.describe('Dashboard Access', () => {
    
    test('admin can access admin dashboard', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Click on Admin tab in sidebar
      await page.locator('.sidebar-link[data-view="admin"]').click();
      
      // Admin dashboard view should be visible
      await expect(page.locator('#view-admin')).toBeVisible();
    });
    
    test('non-admin cannot see admin dashboard', async ({ page }) => {
      // Login as trainee
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-trainee').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Admin sidebar link should not be visible for trainee
      await expect(page.locator('a[data-view="admin"]')).not.toBeVisible();
    });
    
    test('support user can access trainee approvals', async ({ page }) => {
      // Login as support
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-support').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Support should see the admin/approvals link
      const adminLink = page.locator('.sidebar-link[data-view="admin"]');
      await expect(adminLink).toBeVisible();
      
      // Click to open
      await adminLink.click();
      await expect(page.locator('#view-admin')).toBeVisible();
    });
    
  });
  
  test.describe('Timesheet List', () => {
    
    test('admin sees timesheets in admin dashboard', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Wait for admin timesheets list to load
      await page.waitForTimeout(1000);
      
      // Should see admin timesheets list
      await expect(page.locator('#admin-timesheets-list')).toBeVisible();
      
      // Loading should complete
      const loading = page.locator('#admin-timesheets-list .loading');
      await expect(loading).not.toBeVisible({ timeout: 10000 });
    });
    
  });
  
  test.describe('Filters', () => {
    
    test('status filter is available', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Find status filter
      const statusFilter = page.locator('#admin-filter-status');
      await expect(statusFilter).toBeVisible();
      
      // Select "Submitted" status
      await statusFilter.selectOption({ value: 'SUBMITTED' });
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
    });
    
    test('user filter is available', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Find user filter
      const userFilter = page.locator('#admin-filter-user');
      await expect(userFilter).toBeVisible();
    });
    
    test('hour type filter is available', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Find hour type filter
      const hourTypeFilter = page.locator('#admin-filter-hourtype');
      await expect(hourTypeFilter).toBeVisible();
      
      // Select "Field Hours"
      await hourTypeFilter.selectOption({ value: 'Field' });
    });
    
    test('reset filters button works', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Apply a filter
      await page.locator('#admin-filter-status').selectOption({ value: 'SUBMITTED' });
      
      // Click reset
      await page.locator('#admin-clear-filters').click();
      
      // Filter should be reset
      await expect(page.locator('#admin-filter-status')).toHaveValue('');
    });
    
  });
  
  test.describe('Stat Cards', () => {
    
    test('stat cards are displayed', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Check stat cards are visible
      await expect(page.locator('#stat-card-pending')).toBeVisible();
      await expect(page.locator('#stat-card-approved')).toBeVisible();
      await expect(page.locator('#stat-card-attention')).toBeVisible();
    });
    
    test('clicking stat card filters by status', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Click "Pending Review" stat card
      await page.locator('#stat-card-pending').click();
      
      // Status filter should update to SUBMITTED
      await expect(page.locator('#admin-filter-status')).toHaveValue('SUBMITTED');
    });
    
  });
  
  test.describe('Quick Filters', () => {
    
    test('this week button filters to current week', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Click "This Week" button
      await page.locator('#admin-this-week-btn').click();
      
      // Week filter should have a value now
      await expect(page.locator('#admin-filter-week')).not.toHaveValue('');
    });
    
    test('pay period button filters to pay period', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-admin').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to admin dashboard
      await page.locator('.sidebar-link[data-view="admin"]').click();
      await page.waitForLoadState('networkidle');
      
      // Click "Pay Period" button
      await page.locator('#admin-pay-period-btn').click();
      
      // Pay period display should be visible
      await expect(page.locator('#pay-period-display')).toBeVisible();
    });
    
  });
  
});
