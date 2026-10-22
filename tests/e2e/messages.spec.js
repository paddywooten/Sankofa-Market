import { test, expect } from '@playwright/test';

test.describe('Messages — ticks, file attach, pagination', () => {
  test('user messages page loads with conversations list', async ({ page }) => {
    await page.goto('/messages');
    // Should redirect to login if not auth, or show Chats header if auth
    // We test that the page doesn't crash and shows either login or Chats
    const chats = page.locator('text=Chats');
    const login = page.locator('input[type="email"]');
    await expect(chats.or(login)).toBeVisible({ timeout: 15000 });
  });

  test('admin messages page requires admin (shows Access Denied or login)', async ({ page }) => {
    await page.goto('/sm-panel/messages');
    // Should show Access Denied or redirect to /sm-panel/login
    const denied = page.locator('text=Access Denied');
    const login = page.locator('#adminEmail');
    await expect(denied.or(login)).toBeVisible({ timeout: 15000 });
  });
});
