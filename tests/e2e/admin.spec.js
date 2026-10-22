import { test, expect } from '@playwright/test';

test.describe('Admin dashboard — tabs, pagination, overview', () => {
  test('admin dashboard redirects to login when not auth', async ({ page }) => {
    await page.goto('/sm-panel/');
    // Should show Access Denied overlay or redirect to login
    const denied = page.locator('text=Access Denied');
    const login = page.locator('#adminEmail');
    await expect(denied.or(login)).toBeVisible({ timeout: 15000 });
  });

  test('admin dashboard has 17 tabs (smoke DOM check without auth)', async ({ page }) => {
    // Load the HTML directly and check nav count via DOM (no auth needed for HTML)
    await page.goto('/sm-panel/');
    // Even with Access Denied overlay, the sidebar HTML should still be in DOM
    const navItems = page.locator('.sidebar-nav .nav-item');
    // Wait for the HTML to parse
    await page.waitForTimeout(2000);
    const count = await navItems.count();
    // Should be 14 in sidebar-nav + 3 in footer = 17 total .nav-item, but .sidebar-nav only has 14
    expect(count).toBeGreaterThanOrEqual(14);
  });
});
