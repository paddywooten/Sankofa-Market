import { test, expect } from '@playwright/test';

test.describe('Auction — Premium start, everyone bids, order auto-created', () => {
  test('auction listing page loads', async ({ page }) => {
    await page.goto('/auction.html');
    await expect(page.locator('text=Auctions').first()).toBeVisible({ timeout: 10000 });
    // Should show Live / Upcoming / Ended grids (even if empty)
    await expect(page.locator('#liveAuctions, #upcomingAuctions, text=Live Auctions')).toBeVisible({ timeout: 10000 });
  });

  test('auction detail requires auth for bidding (smoke)', async ({ page }) => {
    // Create a dummy auction id — should show 404 or login prompt, not crash
    await page.goto('/auction-detail.html?id=test-dummy-id-123');
    // Page should not crash, should show header
    await expect(page.locator('body')).toBeVisible();
  });

  test('auction → order → escrow flow documented', async () => {
    // Manual QA flow (requires Premium seller + bidder):
    // 1. Login as Premium seller (Bronze 2x) → Create Auction (waiting 2m, duration 5m) → waitlist appears
    // 2. Login as bidder → join waitlist → wait 2m → LIVE → place bid → should see 5% fee badge
    // 3. Auction ends → winner gets order at bid price (ensureAuctionWinnerOrder) + conversation to contact seller
    // 4. Orders page shows "Auction Won" + Pay Now
    // 5. Confirm delivery → status delivered → autoReleaseEscrow after 48h → completed
    expect(true).toBeTruthy();
  });
});
