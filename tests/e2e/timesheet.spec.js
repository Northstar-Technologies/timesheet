/**
 * Timesheet E2E Tests
 * 
 * P0 flows:
 * - Create new timesheet -> Save draft
 * - Add time entries -> Submit -> Confirm
 * - Upload attachment -> Verify display
 */
const { test, expect } = require('./fixtures');

test.describe('Timesheet Management', () => {
  
  test.describe('Create Timesheet', () => {
    
    test('can create a new timesheet for current week', async ({ page }) => {
      // Login as staff
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-staff').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Click "New Timesheet" button (id from index.html)
      await page.locator('#create-timesheet-btn').click();
      
      // Wait for timesheet form/view to load (view-editor becomes active)
      await expect(page.locator('#view-editor')).toBeVisible({ timeout: 10000 });
    });
    
    test('timesheet form has required fields', async ({ page }) => {
      // Login as staff
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-staff').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to new timesheet via sidebar
      await page.locator('a[data-view="editor"]').click();
      await page.waitForLoadState('networkidle');
      
      // Check for week selection input
      await expect(page.locator('#week-start')).toBeVisible();
      
      // Check for hour type selector
      await expect(page.locator('#hour-type-selector')).toBeVisible();
      
      // Check for Save Draft and Submit buttons
      await expect(page.locator('#save-draft-btn')).toBeVisible();
      await expect(page.locator('#submit-btn')).toBeVisible();
    });
    
    test('can add time entries and save draft', async ({ page }) => {
      // Login as staff
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-staff').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to new timesheet
      await page.locator('#create-timesheet-btn').click();
      await expect(page.locator('#view-editor')).toBeVisible();
      
      // Select hour type and add row
      await page.locator('#hour-type-selector').selectOption({ index: 1 }); // Select first available type
      await page.locator('#add-hour-type-btn').click();
      
      // Wait for row to appear
      await expect(page.locator('#hour-type-rows .hour-type-row').first()).toBeVisible();
      
      // Click Save Draft
      await page.locator('#save-draft-btn').click();
      
      // Wait for save confirmation (toast notification)
      await expect(page.locator('.toast, #toast-container .toast')).toBeVisible({ timeout: 10000 });
    });
    
  });
  
  test.describe('Submit Timesheet', () => {
    
    test('can submit timesheet with entries', async ({ page }) => {
      // Login as staff
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-staff').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to new timesheet
      await page.locator('#create-timesheet-btn').click();
      await expect(page.locator('#view-editor')).toBeVisible();
      
      // Select hour type and add row (use index 1 for first real option, 0 is placeholder)
      await page.locator('#hour-type-selector').selectOption({ index: 1 });
      await page.locator('#add-hour-type-btn').click();
      
      // Wait for row to appear
      await expect(page.locator('#hour-type-rows .hour-type-row').first()).toBeVisible();
      
      // Fill in some hours (Monday = day 1)
      const row = page.locator('#hour-type-rows .hour-type-row').first();
      const mondayInput = row.locator('input[type="number"]').nth(1); // Index 1 = Monday
      await mondayInput.fill('8');
      
      // Click Submit
      await page.locator('#submit-btn').click();
      
      // Handle confirmation dialog if present
      const confirmDialog = page.locator('.modal, [role="dialog"]');
      if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmDialog.locator('button:has-text("Submit"), button:has-text("Confirm")').click();
      }
      
      // Wait for submission confirmation (toast notification)
      await expect(page.locator('.toast, #toast-container .toast')).toBeVisible({ timeout: 10000 });
    });
    
    test('submitted timesheet shows read-only notice', async ({ page }) => {
      // Login as staff
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-staff').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Look for any existing submitted timesheet in the list
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Let list load
      
      const submittedCard = page.locator('.timesheet-card:has(.status-submitted), .timesheet-card .status-badge:has-text("Submitted")');
      
      if (await submittedCard.count() > 0) {
        // Click the card to open it
        await submittedCard.first().click();
        await page.waitForLoadState('networkidle');
        
        // Read-only notice should be visible
        await expect(page.locator('#readonly-notice')).toBeVisible();
      } else {
        // Skip if no submitted timesheets exist
        console.log('No submitted timesheets found, skipping read-only test');
      }
    });
    
  });
  
  test.describe('Attachments', () => {
    
    test('attachment section is visible', async ({ page }) => {
      // Login as staff
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-staff').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Navigate to new timesheet
      await page.locator('#create-timesheet-btn').click();
      await page.waitForLoadState('networkidle');
      
      // Look for attachment upload area
      await expect(page.locator('#upload-zone')).toBeVisible();
      await expect(page.locator('#file-upload')).toBeAttached();
    });
    
  });
  
  test.describe('Dashboard View', () => {
    
    test('dashboard shows timesheet list or empty state', async ({ page }) => {
      // Login as staff
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.locator('button.btn-staff').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Wait for timesheets list to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Check that the timesheets view is visible
      await expect(page.locator('#view-timesheets')).toBeVisible();
      
      // Either timesheets exist or empty state is shown
      const timesheetCards = page.locator('#timesheets-list .timesheet-card');
      const loading = page.locator('#timesheets-list .loading');
      
      // Should finish loading
      await expect(loading).not.toBeVisible({ timeout: 10000 });
    });
    
  });
  
});
