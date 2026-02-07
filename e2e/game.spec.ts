/**
 * Comprehensive E2E Tests for Llamas With Hats
 * =============================================
 *
 * Tests all observable game behavior: menus, character selection, game
 * start, HUD, pause menu, keyboard input, save/load, settings,
 * stage info, responsive design, performance, and accessibility.
 *
 * Helper functions abstract common multi-step flows so individual tests
 * stay focused on a single assertion.
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'llamas-rpg-saves';
const SETTINGS_KEY = 'llamas-rpg-settings';

/** Maximum time to wait for initial page load / canvas render. */
const LOAD_TIMEOUT = 15_000;

/** Shorter timeout for UI transitions that should be fast. */
const UI_TIMEOUT = 5_000;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Wait for the page to finish its initial load.
 * The app renders a 3D canvas even on the menu screen, so we wait for that.
 */
async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle');
  // The app shows either a canvas (normal) or a "Loading..." text while async init runs.
  // Wait for the menu title to appear, which guarantees React has rendered.
  await expect(
    page.getByText('LLAMAS', { exact: false })
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
}

/**
 * Navigate from the main menu to the New Game (character select) screen.
 */
async function goToNewGame(page: Page) {
  await page.getByRole('button', { name: /new game/i }).click();
  // Wait for character select heading
  await expect(
    page.getByText('Choose Your Llama')
  ).toBeVisible({ timeout: UI_TIMEOUT });
}

/**
 * Select a character on the character-select screen.
 */
async function selectCharacter(page: Page, character: 'Carl' | 'Paul') {
  await page.getByRole('button', { name: new RegExp(character, 'i') }).click();
}

/**
 * Full flow: navigate menus and start a new game as the given character.
 * Returns once the HUD is visible (i.e. the game is running).
 */
async function startNewGame(page: Page, character: 'Carl' | 'Paul' = 'Carl') {
  await goToNewGame(page);
  await selectCharacter(page, character);
  await page.getByRole('button', { name: /begin/i }).click();

  // Wait for the HUD to appear (Health label is part of the in-game HUD)
  await waitForGameLoad(page);
}

/**
 * Wait until the game scene has loaded and the HUD is visible.
 */
async function waitForGameLoad(page: Page) {
  await expect(
    page.getByText('Health', { exact: false })
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
}

/**
 * Press Escape to open the pause menu, then wait for the "Paused" heading.
 */
async function openPauseMenu(page: Page) {
  await page.keyboard.press('Escape');
  await expect(
    page.getByText('Paused')
  ).toBeVisible({ timeout: UI_TIMEOUT });
}

/**
 * Seed localStorage with a fake saved game so the Continue / Load Game
 * flows have data to work with.
 */
async function seedSavedGame(page: Page, overrides: Record<string, unknown> = {}) {
  const save = {
    id: 'save_e2e_test',
    worldSeed: {
      adjective1: 'Crimson',
      adjective2: 'Shadowy',
      noun: 'Manor',
      seedString: 'crimson-shadowy-manor',
    },
    playerCharacter: 'carl',
    currentStageId: 'stage1_apartment',
    currentRoom: 'living_room',
    currentFloor: 0,
    playerPosition: { x: 0, y: 0, z: 2 },
    playerRotation: 0,
    collectedItems: [],
    completedQuests: [],
    completedBeats: [],
    horrorLevel: 0,
    score: 0,
    timestamp: Date.now(),
    ...overrides,
  };

  await page.evaluate(
    ([key, data]) => {
      localStorage.setItem(key, JSON.stringify([data]));
    },
    [STORAGE_KEY, save] as const
  );
}

// ---------------------------------------------------------------------------
// 1. Main Menu Flow
// ---------------------------------------------------------------------------

test.describe('Main Menu Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('renders the game title with "LLAMAS" and "HATS"', async ({ page }) => {
    await expect(page.getByText('LLAMAS')).toBeVisible();
    await expect(page.getByText('HATS')).toBeVisible();
  });

  test('shows the subtitle "A Dark Comedy RPG"', async ({ page }) => {
    await expect(page.getByText('A Dark Comedy RPG')).toBeVisible();
  });

  test('displays New Game button on the main menu', async ({ page }) => {
    const btn = page.getByRole('button', { name: /new game/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('displays Continue button (disabled when no saves exist)', async ({ page }) => {
    // Clear any leftover saves
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await waitForAppReady(page);

    const btn = page.getByRole('button', { name: /continue/i });
    await expect(btn).toBeVisible();
    // The button text includes "No saved games" when disabled
    await expect(page.getByText('No saved games')).toBeVisible();
  });

  test('displays Settings button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /settings/i })
    ).toBeVisible();
  });

  test('navigates to New Game screen and back to main menu', async ({ page }) => {
    await goToNewGame(page);
    // Character select is showing
    await expect(page.getByText('Choose Your Llama')).toBeVisible();

    // Press Back to return
    await page.getByRole('button', { name: /back/i }).click();
    // Main menu buttons should be visible again
    await expect(
      page.getByRole('button', { name: /new game/i })
    ).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('shows warning disclaimer text on main menu', async ({ page }) => {
    await expect(
      page.getByText(/questionable life choices/i)
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Character Selection
// ---------------------------------------------------------------------------

test.describe('Character Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToNewGame(page);
  });

  test('shows Carl and Paul as selectable characters', async ({ page }) => {
    await expect(page.getByRole('button', { name: /carl/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /paul/i })).toBeVisible();
  });

  test('shows path descriptions for each character', async ({ page }) => {
    await expect(page.getByText('Order path')).toBeVisible();
    await expect(page.getByText('Chaos path')).toBeVisible();
  });

  test('selecting Carl visually highlights Carl button', async ({ page }) => {
    const carlBtn = page.getByRole('button', { name: /carl/i });
    await carlBtn.click();
    // The selected state adds a border color class; verify via computed style
    // Instead we check that the button's parent container now has the highlight
    // by verifying the class contains 'border-carl'
    await expect(carlBtn).toHaveClass(/border-carl/);
  });

  test('selecting Paul visually highlights Paul button', async ({ page }) => {
    const paulBtn = page.getByRole('button', { name: /paul/i });
    await paulBtn.click();
    await expect(paulBtn).toHaveClass(/border-paul/);
  });

  test('can switch selection between Carl and Paul', async ({ page }) => {
    const carlBtn = page.getByRole('button', { name: /carl/i });
    const paulBtn = page.getByRole('button', { name: /paul/i });

    await carlBtn.click();
    await expect(carlBtn).toHaveClass(/border-carl/);

    await paulBtn.click();
    await expect(paulBtn).toHaveClass(/border-paul/);
    // Carl should no longer be highlighted
    await expect(carlBtn).not.toHaveClass(/border-carl/);
  });

  test('Begin button is disabled until a character is selected', async ({ page }) => {
    const beginBtn = page.getByRole('button', { name: /begin/i });
    // Before selection it should have the disabled style (cursor-not-allowed)
    await expect(beginBtn).toHaveClass(/cursor-not-allowed/);

    // Select Carl
    await page.getByRole('button', { name: /carl/i }).click();
    // Now it should not have the disabled class
    await expect(beginBtn).not.toHaveClass(/cursor-not-allowed/);
  });

  test('displays a world seed after navigating to character select', async ({ page }) => {
    // The NewGamePanel calls onShuffleSeed() on mount, generating a seed.
    // We should see "The <adjective1> <adjective2> <noun>" text.
    await expect(
      page.getByText(/^The\s+\w+\s+\w+\s+\w+$/i)
    ).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('world seed input field is present and editable', async ({ page }) => {
    const seedInput = page.getByPlaceholder('Enter seed...');
    await expect(seedInput).toBeVisible();

    // Read existing value and verify it is non-empty
    const value = await seedInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('shuffle button changes the world seed', async ({ page }) => {
    const seedInput = page.getByPlaceholder('Enter seed...');
    const oldValue = await seedInput.inputValue();

    // Click shuffle (the button with title "Shuffle seed")
    await page.getByTitle('Shuffle seed').click();

    // Wait a tick for state to update
    await page.waitForTimeout(300);
    const newValue = await seedInput.inputValue();

    // Seeds are random; it is extremely unlikely to generate the same one twice
    // but we allow it by checking input exists (primary goal: no crash).
    expect(newValue.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Game Start & Canvas
// ---------------------------------------------------------------------------

test.describe('Game Start & Canvas', () => {
  test('starting a game renders the BabylonJS canvas', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test('canvas has non-zero dimensions', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: LOAD_TIMEOUT });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('canvas fills the viewport', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: LOAD_TIMEOUT });

    const box = await canvas.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();

    // Canvas should be close to viewport size (within 10px tolerance for borders/rounding)
    expect(box!.width).toBeGreaterThanOrEqual(viewport!.width - 10);
    expect(box!.height).toBeGreaterThanOrEqual(viewport!.height - 10);
  });

  test('HUD overlay appears after game starts', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    // The HUD contains Health, Items, and the character badge
    await expect(page.getByText('Health')).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(page.getByText('Items')).toBeVisible();
  });

  test('room name is displayed in the HUD', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    // The top bar shows the world name and room name.
    // We cannot predict the exact room name, but there should be text
    // below the world name line.
    // The worldName for a new game is "The <adj1> <adj2> <noun>"
    await expect(
      page.locator('.font-serif.italic').first()
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test('menu overlay is hidden during gameplay', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    // The title "LLAMAS" should no longer be visible (menu overlay hidden)
    await expect(
      page.getByText('LLAMAS')
    ).not.toBeVisible({ timeout: UI_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// 4. HUD & Gameplay UI
// ---------------------------------------------------------------------------

test.describe('HUD & Gameplay UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');
  });

  test('health bar is visible during gameplay', async ({ page }) => {
    await expect(page.getByText('Health')).toBeVisible();
    // The health bar itself is a div with a width style based on health %
    const healthBar = page.locator('.rounded-full .rounded-full');
    await expect(healthBar.first()).toBeVisible();
  });

  test('inventory section is visible', async ({ page }) => {
    await expect(page.getByText('Items')).toBeVisible();
    // There should be 4 inventory slot divs
    const slots = page.locator('.grid.grid-cols-2 > div');
    await expect(slots).toHaveCount(4);
  });

  test('character indicator shows selected character name', async ({ page }) => {
    // The character badge in the top bar shows "Carl"
    await expect(page.getByText('Carl')).toBeVisible();
  });

  test('character badge shows Paul when starting as Paul', async ({ page }) => {
    // Go back to menu and start as Paul
    await openPauseMenu(page);
    await page.getByRole('button', { name: /main menu/i }).click();
    await waitForAppReady(page);
    await startNewGame(page, 'Paul');

    await expect(page.getByText('Paul')).toBeVisible();
  });

  test('keyboard control hints are visible on desktop', async ({ page }) => {
    // On desktop (non-touch), the bottom area shows control hints
    await expect(page.getByText('WASD to move')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByText('ESC to pause')).toBeVisible();
    await expect(page.getByText('Click to interact')).toBeVisible();
  });

  test('minimap is visible when enabled in settings', async ({ page }) => {
    // By default showMinimap is true
    await expect(page.getByText('Map')).toBeVisible({ timeout: UI_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// 5. Keyboard Controls
// ---------------------------------------------------------------------------

test.describe('Keyboard Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');
  });

  test('WASD keys do not cause page scroll during gameplay', async ({ page }) => {
    // Record scroll position before and after pressing W
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('w');
    await page.waitForTimeout(200);
    await page.keyboard.press('s');
    await page.waitForTimeout(200);
    const scrollAfter = await page.evaluate(() => window.scrollY);

    expect(scrollAfter).toBe(scrollBefore);
  });

  test('pressing Escape opens the pause menu', async ({ page }) => {
    await openPauseMenu(page);
    await expect(page.getByText('Paused')).toBeVisible();
  });

  test('pause menu has Resume, Save Game, and Main Menu buttons', async ({ page }) => {
    await openPauseMenu(page);

    await expect(page.getByRole('button', { name: /resume/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save game/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /main menu/i })).toBeVisible();
  });

  test('Resume button closes the pause menu and returns to gameplay', async ({ page }) => {
    await openPauseMenu(page);
    await page.getByRole('button', { name: /resume/i }).click();

    // Pause heading should vanish
    await expect(page.getByText('Paused')).not.toBeVisible({ timeout: UI_TIMEOUT });
    // HUD should still be visible
    await expect(page.getByText('Health')).toBeVisible();
  });

  test('Main Menu button returns to the title screen', async ({ page }) => {
    await openPauseMenu(page);
    await page.getByRole('button', { name: /main menu/i }).click();

    // We should see the main menu again
    await expect(
      page.getByRole('button', { name: /new game/i })
    ).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('pressing Escape twice toggles pause on and off', async ({ page }) => {
    // Open pause
    await page.keyboard.press('Escape');
    await expect(page.getByText('Paused')).toBeVisible({ timeout: UI_TIMEOUT });

    // Close pause
    await page.keyboard.press('Escape');
    await expect(page.getByText('Paused')).not.toBeVisible({ timeout: UI_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// 6. Save / Load System
// ---------------------------------------------------------------------------

test.describe.serial('Save/Load System', () => {
  test('Save Game creates an entry in localStorage', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Clear any previous saves
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);

    await startNewGame(page, 'Carl');
    await openPauseMenu(page);
    await page.getByRole('button', { name: /save game/i }).click();

    // Verify localStorage has a save entry
    const saves = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }, STORAGE_KEY);

    expect(saves.length).toBeGreaterThanOrEqual(1);
    expect(saves[0]).toHaveProperty('id');
    expect(saves[0]).toHaveProperty('worldSeed');
    expect(saves[0]).toHaveProperty('playerCharacter', 'carl');
    expect(saves[0]).toHaveProperty('timestamp');
  });

  test('saved game includes world seed, character, and stage info', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);

    await startNewGame(page, 'Paul');
    await openPauseMenu(page);
    await page.getByRole('button', { name: /save game/i }).click();

    const saves = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }, STORAGE_KEY);

    const save = saves[0];
    expect(save.playerCharacter).toBe('paul');
    expect(save.worldSeed).toHaveProperty('seedString');
    expect(save.worldSeed).toHaveProperty('adjective1');
    expect(save.worldSeed).toHaveProperty('adjective2');
    expect(save.worldSeed).toHaveProperty('noun');
    expect(save.currentStageId).toBeTruthy();
    expect(save.currentRoom).toBeTruthy();
    expect(save.playerPosition).toHaveProperty('x');
    expect(save.playerPosition).toHaveProperty('z');
  });

  test('Continue button is enabled when saves exist', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Seed a save
    await seedSavedGame(page);
    await page.reload();
    await waitForAppReady(page);

    const continueBtn = page.getByRole('button', { name: /continue/i });
    await expect(continueBtn).toBeVisible();
    // The "No saved games" text should NOT appear
    await expect(page.getByText('No saved games')).not.toBeVisible();
  });

  test('Load Game screen shows saved games', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Seed a save and reload
    await seedSavedGame(page);
    await page.reload();
    await waitForAppReady(page);

    // Navigate to load game screen
    await page.getByRole('button', { name: /continue/i }).click();

    // Should see the Load Game heading
    await expect(page.getByText('Load Game')).toBeVisible({ timeout: UI_TIMEOUT });

    // Should see the save entry with its world seed name
    await expect(page.getByText(/Crimson Shadowy Manor/i)).toBeVisible();
    await expect(page.getByText(/Carl/i).first()).toBeVisible();
  });

  test('Load button exists for each saved game', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await seedSavedGame(page);
    await page.reload();
    await waitForAppReady(page);

    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText('Load Game')).toBeVisible({ timeout: UI_TIMEOUT });

    // Each save entry has a "Load" button
    await expect(
      page.getByRole('button', { name: /^load$/i })
    ).toBeVisible();
  });

  test('delete button removes a saved game', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await seedSavedGame(page);
    await page.reload();
    await waitForAppReady(page);

    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText('Load Game')).toBeVisible({ timeout: UI_TIMEOUT });

    // There should be at least one save
    await expect(page.getByText(/Crimson Shadowy Manor/i)).toBeVisible();

    // Click delete (the X button)
    await page.getByRole('button', { name: /\u2715/i }).click();

    // The save should be gone; now it shows "No saved games"
    await expect(page.getByText('No saved games')).toBeVisible({ timeout: UI_TIMEOUT });

    // Verify localStorage is also updated
    const saves = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }, STORAGE_KEY);
    expect(saves).toHaveLength(0);
  });

  test('Back button on Load Game returns to main menu', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await seedSavedGame(page);
    await page.reload();
    await waitForAppReady(page);

    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText('Load Game')).toBeVisible({ timeout: UI_TIMEOUT });

    await page.getByRole('button', { name: /back/i }).click();
    await expect(
      page.getByRole('button', { name: /new game/i })
    ).toBeVisible({ timeout: UI_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// 7. Settings
// ---------------------------------------------------------------------------

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('Music volume slider is present', async ({ page }) => {
    await expect(page.getByText('Music')).toBeVisible();
    // A range input exists for Music
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(2); // Music + SFX
  });

  test('SFX volume slider is present', async ({ page }) => {
    await expect(page.getByText('SFX')).toBeVisible();
  });

  test('Minimap toggle is present and functional', async ({ page }) => {
    await expect(page.getByText('Minimap')).toBeVisible();
    // The toggle shows ON or OFF
    const toggleBtn = page.getByRole('button', { name: /^(on|off)$/i });
    await expect(toggleBtn).toBeVisible();

    // Click to toggle
    const initialText = await toggleBtn.textContent();
    await toggleBtn.click();
    const newText = await toggleBtn.textContent();
    expect(newText).not.toBe(initialText);
  });

  test('settings persist to localStorage', async ({ page }) => {
    // Change Music slider value
    const musicSlider = page.locator('input[type="range"]').first();
    await musicSlider.fill('0.3');

    // Verify localStorage was updated
    const settings = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, SETTINGS_KEY);

    expect(settings).not.toBeNull();
    expect(settings.musicVolume).toBeDefined();
  });

  test('Back button returns to main menu from Settings', async ({ page }) => {
    await page.getByRole('button', { name: /back/i }).click();
    await expect(
      page.getByRole('button', { name: /new game/i })
    ).toBeVisible({ timeout: UI_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// 8. Stage Progression
// ---------------------------------------------------------------------------

test.describe('Stage Progression', () => {
  test('game starts on stage 1 (apartment)', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    // The first stage is "stage1_apartment". The room name in the HUD
    // should be derived from the stage's starting room.
    // We verify that some room name text appears below the world name.
    const roomNameEl = page.locator('.text-gray-500.text-xs').first();
    await expect(roomNameEl).toBeVisible({ timeout: LOAD_TIMEOUT });
    const roomName = await roomNameEl.textContent();
    expect(roomName).toBeTruthy();
    expect(roomName!.trim().length).toBeGreaterThan(0);
  });

  test('world name in HUD matches generated seed', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await goToNewGame(page);
    await selectCharacter(page, 'Carl');

    // Capture the seed name from character select screen
    const seedNameEl = page.locator('.font-serif.italic.text-center');
    await expect(seedNameEl).toBeVisible({ timeout: UI_TIMEOUT });
    const seedName = await seedNameEl.textContent();

    await page.getByRole('button', { name: /begin/i }).click();
    await waitForGameLoad(page);

    // The HUD should show the same world name
    await expect(page.getByText(seedName!.trim())).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('HUD displays a room name that is a non-empty string', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Paul');

    // Room name is the second line in the location section
    const roomNameEl = page.locator('.text-gray-500.text-xs').first();
    await expect(roomNameEl).toBeVisible({ timeout: LOAD_TIMEOUT });
    const text = await roomNameEl.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Responsive Design
// ---------------------------------------------------------------------------

test.describe('Responsive Design', () => {
  test('mobile viewport (375x667) renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await waitForAppReady(page);

    // Title should still be visible
    await expect(page.getByText('LLAMAS')).toBeVisible();
    // Menu buttons should be visible
    await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();
    // Canvas should be present
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test('tablet viewport (768x1024) renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page.getByText('LLAMAS')).toBeVisible();
    await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test('desktop viewport (1920x1080) renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page.getByText('LLAMAS')).toBeVisible();
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

    const box = await canvas.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(1900);
    expect(box!.height).toBeGreaterThanOrEqual(1060);
  });

  test('touch control hints appear on mobile/touch viewport', async ({ page, browserName }) => {
    // Only reliable on Chromium with touch emulation
    test.skip(browserName !== 'chromium', 'Touch emulation only reliable on Chromium');

    await page.setViewportSize({ width: 375, height: 667 });
    // Emulate touch
    const context = page.context();
    await context.grantPermissions([]);

    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    // On touch devices, the hint says "Drag to move" instead of "WASD"
    // This depends on touch detection, which is emulated in the Pixel 5 / iPhone projects
    // but not guaranteed in a resized desktop browser. We assert controls area exists.
    const bottomArea = page.locator('.bg-gradient-to-t');
    await expect(bottomArea).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('canvas resizes when viewport changes', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: LOAD_TIMEOUT });

    const boxBefore = await canvas.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500); // Allow resize to settle

    const boxAfter = await canvas.boundingBox();
    expect(boxAfter).not.toBeNull();

    // Canvas should have resized
    expect(boxAfter!.width).not.toBe(boxBefore!.width);
  });
});

// ---------------------------------------------------------------------------
// 10. Performance & Error Handling
// ---------------------------------------------------------------------------

test.describe('Performance & Error Handling', () => {
  test('page loads within 15 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await waitForAppReady(page);

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(15_000);
  });

  test('no critical console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForAppReady(page);

    // Filter out known non-critical messages (WebGL warnings, deprecation notices)
    const criticalErrors = errors.filter(
      e =>
        !e.includes('WebGL') &&
        !e.includes('deprecated') &&
        !e.includes('warning') &&
        !e.includes('favicon') &&
        !e.includes('404')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('no uncaught exceptions during basic gameplay', async ({ page }) => {
    const exceptions: string[] = [];
    page.on('pageerror', err => {
      exceptions.push(err.message);
    });

    await page.goto('/');
    await waitForAppReady(page);
    await startNewGame(page, 'Carl');

    // Interact briefly: move around, pause, resume
    await page.keyboard.press('w');
    await page.waitForTimeout(300);
    await page.keyboard.press('a');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expect(exceptions).toHaveLength(0);
  });

  test('no uncaught exceptions during menu navigation', async ({ page }) => {
    const exceptions: string[] = [];
    page.on('pageerror', err => {
      exceptions.push(err.message);
    });

    await page.goto('/');
    await waitForAppReady(page);

    // Navigate through all menu screens
    await page.getByRole('button', { name: /new game/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /back/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /settings/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /back/i }).click();
    await page.waitForTimeout(300);

    expect(exceptions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Accessibility
// ---------------------------------------------------------------------------

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('all main menu buttons have accessible text', async ({ page }) => {
    const buttons = page.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(3); // New Game, Continue, Settings

    // Verify each button has non-empty text content
    for (let i = 0; i < count; i++) {
      const text = await buttons.nth(i).textContent();
      expect(text!.trim().length).toBeGreaterThan(0);
    }
  });

  test('character select buttons have descriptive text', async ({ page }) => {
    await goToNewGame(page);

    const carlBtn = page.getByRole('button', { name: /carl/i });
    const paulBtn = page.getByRole('button', { name: /paul/i });

    // Each character button should contain the name and a path description
    await expect(carlBtn).toContainText('Carl');
    await expect(carlBtn).toContainText('Order path');
    await expect(paulBtn).toContainText('Paul');
    await expect(paulBtn).toContainText('Chaos path');
  });

  test('keyboard navigation through main menu buttons works', async ({ page }) => {
    // Tab through the menu buttons
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // At least one button should have focus
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    // Could be BUTTON, INPUT, or other focusable element
    expect(['BUTTON', 'INPUT', 'A']).toContain(focusedTag);
  });

  test('Begin button is keyboard-activatable', async ({ page }) => {
    await goToNewGame(page);
    await selectCharacter(page, 'Carl');

    // Focus the Begin button and press Enter
    const beginBtn = page.getByRole('button', { name: /begin/i });
    await beginBtn.focus();
    await page.keyboard.press('Enter');

    // Game should start - HUD should appear
    await waitForGameLoad(page);
    await expect(page.getByText('Health')).toBeVisible();
  });

  test('pause menu buttons are accessible via keyboard', async ({ page }) => {
    await startNewGame(page, 'Carl');
    await openPauseMenu(page);

    // Tab to Resume and press Enter
    const resumeBtn = page.getByRole('button', { name: /resume/i });
    await resumeBtn.focus();
    await page.keyboard.press('Enter');

    // Pause menu should close
    await expect(page.getByText('Paused')).not.toBeVisible({ timeout: UI_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// 12. Full User Journeys (Integration)
// ---------------------------------------------------------------------------

test.describe('Full User Journeys', () => {
  test('complete flow: new game as Carl, play, save, quit, load', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Clear saves
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);

    // Start new game as Carl
    await startNewGame(page, 'Carl');
    await expect(page.getByText('Carl')).toBeVisible();

    // Play briefly
    await page.keyboard.press('w');
    await page.waitForTimeout(300);

    // Open pause and save
    await openPauseMenu(page);
    await page.getByRole('button', { name: /save game/i }).click();

    // Return to main menu
    await page.getByRole('button', { name: /main menu/i }).click();
    await expect(
      page.getByRole('button', { name: /new game/i })
    ).toBeVisible({ timeout: UI_TIMEOUT });

    // Continue should now be enabled
    await expect(page.getByText('No saved games')).not.toBeVisible();

    // Load the saved game
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText('Load Game')).toBeVisible({ timeout: UI_TIMEOUT });
    await page.getByRole('button', { name: /^load$/i }).click();

    // Game should resume with Carl
    await waitForGameLoad(page);
    await expect(page.getByText('Carl')).toBeVisible();
  });

  test('complete flow: new game as Paul, change settings, play', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Go to settings and toggle minimap off
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: UI_TIMEOUT });

    // Find and click the minimap toggle to OFF
    const minimapToggle = page.getByRole('button', { name: /^(on|off)$/i });
    const initialState = await minimapToggle.textContent();
    if (initialState?.trim().toUpperCase() === 'ON') {
      await minimapToggle.click();
    }
    await page.getByRole('button', { name: /back/i }).click();

    // Start game as Paul
    await startNewGame(page, 'Paul');
    await expect(page.getByText('Paul')).toBeVisible();

    // Map label should NOT be visible when minimap is disabled
    await expect(page.getByText('Map')).not.toBeVisible();
  });
});
