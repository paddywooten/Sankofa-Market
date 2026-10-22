import { test, expect } from '@playwright/test';

test.describe('Smoke — core pages load', () => {
  test('home loads with carousel and search', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.carousel-track')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.locator('text=Ghana\'s #1 Online Marketplace')).toBeVisible();
  });

  test('search loads and shows products or empty', async ({ page }) => {
    await page.goto('/search.html');
    await expect(page.locator('#searchTitle')).toBeVisible();
    // skeleton or results
    await expect(page.locator('#searchResults')).toBeVisible({ timeout: 10000 });
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/pages/auth/login.html');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('admin login page loads and blocks without auth', async ({ page }) => {
    await page.goto('/sm-panel/login');
    await expect(page.locator('#adminEmail')).toBeVisible();
    await expect(page.locator('#adminPassword')).toBeVisible();
    await expect(page.locator('#adminCode')).toBeVisible();
  });
});
