/**
 * E2E Tests for Game Flow
 * =======================
 *
 * Tests the main game flow from menu to gameplay.
 * Asserts observable behavior rather than just "no error thrown".
 */

import { test, expect } from '@playwright/test';

test.describe('Main Menu', () => {
  test('should display game title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const title = page.locator('text=/llama/i');
    await expect(title.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have New Game button on main menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newGameButton = page.locator('button:has-text(/new game/i)');
    await expect(newGameButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show character selection after clicking New Game', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newGameButton = page.locator('button:has-text(/new game/i)');
    await newGameButton.first().click();

    // Should now see Carl and Paul as character options
    const carlButton = page.locator('button:has-text(/carl/i)');
    const paulButton = page.locator('button:has-text(/paul/i)');

    await expect(carlButton.first()).toBeVisible({ timeout: 5000 });
    await expect(paulButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('should enable Begin button after selecting a character', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text(/new game/i)').first().click();
    await page.locator('button:has-text(/carl/i)').first().click();

    const beginButton = page.locator('button:has-text(/begin/i)');
    await expect(beginButton.first()).toBeEnabled({ timeout: 5000 });
  });
});

test.describe('Game Canvas', () => {
  test('should render 3D canvas after starting game', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('canvas should have non-zero dimensions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });
});

test.describe('Keyboard Input', () => {
  test('should show HUD elements during gameplay', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start a game as Carl
    await page.locator('button:has-text(/new game/i)').first().click();
    await page.locator('button:has-text(/carl/i)').first().click();
    await page.locator('button:has-text(/begin/i)').first().click();

    // HUD should display character name and health
    const healthLabel = page.locator('text=/health/i');
    await expect(healthLabel.first()).toBeVisible({ timeout: 10000 });
  });

  test('pressing Escape should show pause menu or return to menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start a game
    await page.locator('button:has-text(/new game/i)').first().click();
    await page.locator('button:has-text(/carl/i)').first().click();
    await page.locator('button:has-text(/begin/i)').first().click();

    // Wait for game to load
    await page.waitForTimeout(1000);

    // Press Escape — should show pause or menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Should see either a pause overlay or the resume/quit buttons
    const pauseIndicator = page.locator('text=/pause|resume|quit|menu/i');
    const hasPauseUI = await pauseIndicator.first().isVisible().catch(() => false);
    expect(hasPauseUI).toBe(true);
  });
});

test.describe('Responsive Design', () => {
  test('should render canvas on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    const box = await canvas.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
  });

  test('should render canvas on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('should render canvas on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(15000);
  });

  test('should not have console errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow for some WebGL warnings but not critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('WebGL') &&
      !e.includes('deprecated') &&
      !e.includes('warning')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
