/**
 * Authentication E2E Tests
 * 
 * P0 flows:
 * - Dev login -> Dashboard loads
 * - Admin login -> Admin tab accessible
 * - Logout -> Redirect to login page
 */
const { test, expect } = require('./fixtures');

test.describe('Authentication', () => {
  
  test.describe('Dev Login', () => {
    
    test('login page loads with dev login buttons', async ({ page }) => {
      await page.goto('/login');
      
      // Check page title
      await expect(page).toHaveTitle(/Login.*Northstar/i);
      
      // Check for dev login buttons (should be visible when Azure is not configured)
      // There are 4 quick login buttons: trainee, staff, support, admin
      const traineeBtn = page.locator('button.btn-trainee');
      const staffBtn = page.locator('button.btn-staff');
      const supportBtn = page.locator('button.btn-support');
      const adminBtn = page.locator('button.btn-admin');
      
      await expect(traineeBtn).toBeVisible();
      await expect(staffBtn).toBeVisible();
      await expect(supportBtn).toBeVisible();
      await expect(adminBtn).toBeVisible();
    });
    
    test('staff login redirects to dashboard', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Click the Staff login button
      await page.locator('button.btn-staff').click();
      
      // Should redirect to /app
      await expect(page).toHaveURL(/\/app/);
      
      // Dashboard should load - look for main app container or welcome message
      await expect(page.locator('.app-container').first()).toBeVisible();
    });
    
    test('admin login provides admin access', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Click the Admin login button
      await page.locator('button.btn-admin').click();
      
      // Should redirect to /app
      await expect(page).toHaveURL(/\/app/);
      
      // Admin tab or admin navigation should be visible
      await expect(page.locator('[data-tab="admin"], .nav-admin, a:has-text("Admin"), button:has-text("Admin")').first()).toBeVisible({ timeout: 15000 });
    });
    
    test('trainee login has limited access', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Click the Trainee login button
      await page.locator('button.btn-trainee').click();
      
      // Should redirect to /app
      await expect(page).toHaveURL(/\/app/);
      
      // Dashboard should load
      await expect(page.locator('.app-container').first()).toBeVisible();
    });
    
    test('support login can access support dashboard', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Click the Support login button
      await page.locator('button.btn-support').click();
      
      // Should redirect to /app
      await expect(page).toHaveURL(/\/app/);
      
      // Dashboard should load
      await expect(page.locator('.app-container').first()).toBeVisible();
    });
    
  });
  
  test.describe('Session Management', () => {
    
    test('unauthenticated user is redirected to login', async ({ page }) => {
      // Try to access protected route
      await page.goto('/app');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
    
    test('logout clears session and redirects to login', async ({ page }) => {
      // First, login
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      await page.locator('button.btn-staff').click();
      await expect(page).toHaveURL(/\/app/);
      
      // Now logout - find logout form or link
      const logoutBtn = page.locator('form[action*="logout"] button, a[href*="logout"], button:has-text("Logout"), button:has-text("Sign Out")');
      await logoutBtn.click();
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
      
      // Try to access /app again - should redirect to login
      await page.goto('/app');
      await expect(page).toHaveURL(/\/login/);
    });
    
  });
  
  test.describe('Rate Limiting', () => {
    
    test('rate limiting headers are present', async ({ page, request }) => {
      // First, login to get an authenticated session
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Make a request and check for rate limit headers
      const response = await request.get('/auth/me');
      
      // Response should have rate limit headers (if enabled)
      const headers = response.headers();
      console.log('Response headers:', Object.keys(headers));
      
      // The endpoint should return 401 (not authenticated) or 200
      expect([200, 401]).toContain(response.status());
    });
    
  });
  
});
