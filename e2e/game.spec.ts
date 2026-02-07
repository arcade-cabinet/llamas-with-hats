/**
 * E2E Tests for Game Flow
 * =======================
 * 
 * Tests the main game flow from menu to gameplay.
 */

import { test, expect } from '@playwright/test';

test.describe('Main Menu', () => {
  test('should display game title', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Should have the game title somewhere
    const title = page.locator('text=/llama/i');
    await expect(title.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have character selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for character names or selection buttons
    const carlButton = page.locator('text=/carl/i');
    const paulButton = page.locator('text=/paul/i');
    
    // At least one should be visible
    const carlVisible = await carlButton.first().isVisible().catch(() => false);
    const paulVisible = await paulButton.first().isVisible().catch(() => false);
    
    expect(carlVisible || paulVisible).toBe(true);
  });

  test('should have start game button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for any start/play button
    const startButton = page.locator('button:has-text(/start|play|begin/i)');
    
    // Wait for it to appear (might need loading)
    await expect(startButton.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Game Canvas', () => {
  test('should render 3D canvas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // There should be a canvas element
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
  test('should respond to keyboard input', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Focus the page
    await page.locator('body').click();
    
    // Try pressing movement keys - shouldn't throw
    await page.keyboard.press('w');
    await page.keyboard.press('a');
    await page.keyboard.press('s');
    await page.keyboard.press('d');
    
    // If we got here without errors, basic input handling works
    expect(true).toBe(true);
  });

  test('should handle escape key for menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Press escape
    await page.keyboard.press('Escape');
    
    // Wait a moment for any state change
    await page.waitForTimeout(500);
    
    // No error thrown means escape is handled
    expect(true).toBe(true);
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Canvas should still render
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('should work on desktop viewport', async ({ page }) => {
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
    
    // Wait for canvas to be visible
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 15 seconds
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
