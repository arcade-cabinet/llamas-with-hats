/**
 * Unified Input Controller
 * ========================
 *
 * Handles ALL input methods in one place: keyboard, touch joystick, and gamepad.
 * Automatically detects and switches between input modes.
 *
 * ## Touch Controls — Fixed Branded Joystick
 *
 * A fixed-position joystick in the bottom-left corner replaces the old
 * "drag anywhere" gesture model:
 *
 * - **Always visible** on touch devices — outer ring + inner knob
 * - **Direct positional mapping** — distance from center = speed (0-1)
 * - **Dead zone** at 30% radius prevents accidental drift
 * - **Captures only touches starting within joystick bounds** — touches
 *   elsewhere still trigger tap-to-interact (raycasting)
 *
 * ## Input Mode Detection
 *
 * - Keyboard press → 'keyboard' mode
 * - Touch on joystick → 'touch' mode
 * - Gamepad input → 'gamepad' mode
 *
 * ## Coordinate System
 *
 * - `x`: -1 (left) to +1 (right) — maps to game X axis
 * - `z`: -1 (up/away from camera) to +1 (down/toward camera) — maps to game Z axis
 *
 * @module useInputController
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export type InputMode = 'keyboard' | 'touch' | 'gamepad';

interface InputState {
  x: number;
  z: number;
  action: boolean;
  inventory: boolean;
  pause: boolean;
}

interface UseInputControllerOptions {
  enabled: boolean;
  onPause?: () => void;
  onAction?: () => void;
  onInventory?: () => void;
  /** Reference to the game container for touch detection */
  gameContainerRef?: React.RefObject<HTMLElement>;
}

/**
 * Joystick configuration — tuned for the bottom-left fixed joystick.
 */
const JOYSTICK_CONFIG = {
  /** Minimum displacement to register as movement (pixels) */
  deadzone: 8,
  /** Max displacement from center for full speed (pixels) — joystick radius */
  maxDistance: 60,
  /** Capture radius — touches starting within this distance of center are captured (pixels) */
  captureRadius: 80,
};

/**
 * Joystick position state exposed for the visual component in GameView.
 */
export interface JoystickState {
  /** Whether the joystick is actively being touched */
  active: boolean;
  /** Inner knob offset from center (-1 to 1, normalized) */
  knobX: number;
  knobY: number;
}

export function useInputController(options: UseInputControllerOptions) {
  const { enabled, onPause, onAction, onInventory, gameContainerRef } = options;

  const [inputMode, setInputMode] = useState<InputMode>('keyboard');
  const [showTouchControls, setShowTouchControls] = useState(false);

  const inputStateRef = useRef<InputState>({ x: 0, z: 0, action: false, inventory: false, pause: false });
  const keysRef = useRef<Set<string>>(new Set());

  // Joystick tracking state
  const joystickRef = useRef({
    active: false,
    touchId: -1,
    // The joystick center in page coordinates (set by GameView's joystick element)
    centerX: 0,
    centerY: 0,
  });

  // Joystick visual state — exposed for GameView to render the knob position
  const [joystickState, setJoystickState] = useState<JoystickState>({
    active: false, knobX: 0, knobY: 0,
  });

  // Ref to store joystick DOM element position (set by GameView)
  const joystickCenterRef = useRef({ x: 0, y: 0 });

  // Get current input state
  const getInput = useCallback(() => {
    return { ...inputStateRef.current };
  }, []);

  // Set joystick center position (called by GameView when joystick element mounts/resizes)
  const setJoystickCenter = useCallback((x: number, y: number) => {
    joystickCenterRef.current = { x, y };
    joystickRef.current.centerX = x;
    joystickRef.current.centerY = y;
  }, []);

  // Update input state from keyboard
  const updateKeyboardInput = useCallback(() => {
    const keys = keysRef.current;
    let x = 0, z = 0;

    if (keys.has('w') || keys.has('arrowup')) z = -1;
    if (keys.has('s') || keys.has('arrowdown')) z = 1;
    if (keys.has('a') || keys.has('arrowleft')) x = -1;
    if (keys.has('d') || keys.has('arrowright')) x = 1;

    inputStateRef.current.x = x;
    inputStateRef.current.z = z;
  }, []);

  // Detect input mode changes
  const switchToMode = useCallback((mode: InputMode) => {
    if (inputMode !== mode) {
      setInputMode(mode);
      setShowTouchControls(mode === 'touch');
    }
  }, [inputMode]);

  // Keyboard handling
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      switchToMode('keyboard');

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysRef.current.add(key);
        updateKeyboardInput();
        e.preventDefault();
      }

      if (key === 'escape') {
        onPause?.();
        e.preventDefault();
      }

      if (key === 'e') {
        onAction?.();
        e.preventDefault();
      }

      if (key === 'i') {
        onInventory?.();
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysRef.current.delete(key);
        updateKeyboardInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keysRef.current.clear();
    };
  }, [enabled, onPause, onAction, onInventory, switchToMode, updateKeyboardInput]);

  // ─────────────────────────────────────────────────────────────────────────────
  // TOUCH JOYSTICK HANDLING
  // ─────────────────────────────────────────────────────────────────────────────
  //
  // Fixed-position joystick model:
  //
  // 1. Touch starts within captureRadius of joystick center → captured
  // 2. Input = vector from joystick center to touch, normalized and clamped
  // 3. Deadzone at ~30% prevents accidental drift
  // 4. Touches outside joystick → pass through for raycasting/interaction
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const container = gameContainerRef?.current || document.body;

    const handleTouchStart = (e: TouchEvent) => {
      // Don't capture touches on UI elements
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[data-ui]')) {
        return;
      }

      switchToMode('touch');

      // Check if touch starts within joystick capture radius
      if (!joystickRef.current.active && e.touches.length > 0) {
        const touch = e.touches[0];
        const cx = joystickRef.current.centerX;
        const cy = joystickRef.current.centerY;
        const dx = touch.clientX - cx;
        const dy = touch.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= JOYSTICK_CONFIG.captureRadius) {
          joystickRef.current.active = true;
          joystickRef.current.touchId = touch.identifier;

          // Compute initial input from touch position
          updateJoystickInput(touch.clientX, touch.clientY);
          e.preventDefault();
        }
        // Touches outside joystick radius are NOT captured — they fall through
        // to the scene for tap-to-interact raycasting
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!joystickRef.current.active) return;

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === joystickRef.current.touchId) {
          updateJoystickInput(touch.clientX, touch.clientY);
          break;
        }
      }

      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!joystickRef.current.active) return;

      let found = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === joystickRef.current.touchId) {
          found = true;
          break;
        }
      }

      if (!found) {
        joystickRef.current.active = false;
        joystickRef.current.touchId = -1;

        inputStateRef.current.x = 0;
        inputStateRef.current.z = 0;
        setJoystickState({ active: false, knobX: 0, knobY: 0 });
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled, switchToMode, gameContainerRef]);

  /**
   * Compute joystick input from touch position.
   * Direct positional mapping: distance from center = speed.
   */
  function updateJoystickInput(touchX: number, touchY: number) {
    const cx = joystickRef.current.centerX;
    const cy = joystickRef.current.centerY;
    const dx = touchX - cx;
    const dy = touchY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp distance to max
    const clampedDist = Math.min(dist, JOYSTICK_CONFIG.maxDistance);

    // Normalized knob position for visual (-1 to 1)
    const knobX = dist > 0 ? (dx / dist) * (clampedDist / JOYSTICK_CONFIG.maxDistance) : 0;
    const knobY = dist > 0 ? (dy / dist) * (clampedDist / JOYSTICK_CONFIG.maxDistance) : 0;

    setJoystickState({ active: true, knobX, knobY });

    if (dist > JOYSTICK_CONFIG.deadzone) {
      const scale = Math.min(1, (dist - JOYSTICK_CONFIG.deadzone) /
        (JOYSTICK_CONFIG.maxDistance - JOYSTICK_CONFIG.deadzone));

      const nx = dx / dist;
      const ny = dy / dist;

      // Screen coordinates → game coordinates:
      // Screen right (+X) → game +X
      // Screen down (+Y) → game +Z (camera looks from +Z toward -Z)
      inputStateRef.current.x = nx * scale;
      inputStateRef.current.z = ny * scale;
    } else {
      inputStateRef.current.x = 0;
      inputStateRef.current.z = 0;
    }
  }

  // Gamepad detection
  useEffect(() => {
    if (!enabled) return;

    let animationId: number;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();

      for (const gamepad of gamepads) {
        if (!gamepad) continue;

        const leftX = gamepad.axes[0] || 0;
        const leftY = gamepad.axes[1] || 0;

        const deadzone = 0.15;
        const x = Math.abs(leftX) > deadzone ? leftX : 0;
        const z = Math.abs(leftY) > deadzone ? leftY : 0;

        if (x !== 0 || z !== 0) {
          switchToMode('gamepad');
          inputStateRef.current.x = x;
          inputStateRef.current.z = z;
        }

        if (gamepad.buttons[9]?.pressed) {
          onPause?.();
        }
      }

      animationId = requestAnimationFrame(pollGamepad);
    };

    const handleGamepadConnected = () => {
      switchToMode('gamepad');
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    animationId = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      cancelAnimationFrame(animationId);
    };
  }, [enabled, onPause, switchToMode]);

  // Clear input when disabled
  useEffect(() => {
    if (!enabled) {
      inputStateRef.current = { x: 0, z: 0, action: false, inventory: false, pause: false };
      keysRef.current.clear();
    }
  }, [enabled]);

  return {
    getInput,
    inputMode,
    showTouchControls,
    setShowTouchControls,
    /** Joystick visual state — read by GameView to render knob position */
    joystickState,
    /** Set joystick center position — called by GameView when joystick mounts */
    setJoystickCenter,
  };
}
