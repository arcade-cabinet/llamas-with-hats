/**
 * Unified Input Controller
 * ========================
 * 
 * Handles ALL input methods in one place: keyboard, touch gestures, and gamepad.
 * Automatically detects and switches between input modes.
 * 
 * ## Why Unified?
 * 
 * Previously input was scattered:
 * - Keyboard in GameView.tsx
 * - Joystick in GameView.tsx
 * - Global `window.__gameSetInput` hack
 * 
 * Now there's ONE hook that:
 * - Manages all input sources
 * - Auto-detects mode switches (touch screen → gesture controls)
 * - Provides consistent `getInput()` interface
 * - Handles enable/disable (pause menu)
 * 
 * ## Usage
 * 
 * ```tsx
 * const { 
 *   getInput,           // () => { x, z, action, inventory, pause }
 *   inputMode,          // 'keyboard' | 'touch' | 'gamepad'
 *   showTouchControls,  // boolean - whether touch mode is active
 * } = useInputController({
 *   enabled: !isPaused,
 *   onPause: () => togglePause(),
 *   onAction: () => interact(),
 *   gameContainerRef    // Reference to game container for gesture bounds
 * });
 * 
 * // In game loop
 * const input = getInput();
 * player.move(input.x, input.z);
 * ```
 * 
 * ## Input Mode Detection
 * 
 * - User presses keyboard → switches to 'keyboard' mode
 * - User touches/drags screen → switches to 'touch' mode (gesture-based)
 * - User uses gamepad → switches to 'gamepad' mode
 * 
 * ## Touch Gesture Controls (Mobile)
 * 
 * The touch system uses a "drag anywhere" gesture model instead of a fixed joystick:
 * 
 * 1. **Touch anywhere** on the game area to start (UI buttons are excluded)
 * 2. **Drag in any direction** - the drag vector becomes your movement direction
 * 3. **Keep dragging** - the system uses a trackpad-like model where the "origin"
 *    smoothly follows your finger (smoothing factor: 0.92)
 * 4. **Release to stop** - movement stops immediately, no momentum
 * 
 * ### Why Gestures Over Joystick?
 * 
 * - **Less clumsy**: No need to find and stay within a small joystick zone
 * - **Full screen control**: Use any part of the screen as your control surface
 * - **Natural feel**: Similar to trackpad navigation users are familiar with
 * - **Better for varied screen sizes**: Works equally well on phones and tablets
 * 
 * ### Gesture Configuration
 * 
 * - `deadzone`: 8px - minimum drag distance before movement registers
 * - `maxDistance`: 80px - drag distance for maximum speed (normalized 0-1)
 * - `smoothing`: 0.92 - how quickly the origin follows the finger (higher = smoother)
 * 
 * ### UI Element Exclusion
 * 
 * Touches on UI elements are excluded from gesture capture:
 * - Any `<button>` element
 * - Any element with `data-ui="true"` attribute
 * 
 * ## Vertical Navigation
 * 
 * This input system works seamlessly with the vertical transition system (stairs/ramps).
 * Characters don't need a jump button - they automatically ascend or descend when
 * moving toward vertical transitions. The input simply provides X/Z movement vectors;
 * the game's collision/movement system handles Y positioning based on ground height.
 * 
 * ## Control Mapping
 * 
 * | Input      | Keyboard    | Touch/Mouse    | Gamepad       |
 * |------------|-------------|----------------|---------------|
 * | Move       | WASD/Arrows | Drag anywhere  | Left Stick    |
 * | Interact   | E (nearby)  | Click/Tap obj  | A Button      |
 * | Pause      | Escape      | Menu button    | Start Button  |
 * 
 * Note: Interactions are primarily click/tap based. The E key is a fallback
 * for keyboard users when near an interactable object.
 * 
 * ## Coordinate System
 * 
 * The input values map to the game's coordinate system:
 * - `x`: -1 (left) to +1 (right) - maps to game X axis
 * - `z`: -1 (up/away from camera) to +1 (down/toward camera) - maps to game Z axis
 * 
 * For touch: Screen Y (up/down) maps to game Z (the camera looks from +Z toward -Z)
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
  /** Reference to the game container for gesture detection */
  gameContainerRef?: React.RefObject<HTMLElement>;
}

/**
 * Configuration for gesture sensitivity.
 * These values have been tuned for comfortable mobile gameplay.
 */
const GESTURE_CONFIG = {
  /** 
   * Minimum drag distance to register as movement (pixels).
   * Prevents accidental movement from small touches/taps.
   * Lower = more sensitive, Higher = requires more deliberate drag.
   */
  deadzone: 8,
  
  /** 
   * Drag distance for maximum speed (pixels).
   * Beyond this distance, input is clamped to 1.0.
   * Lower = reach max speed with smaller drags.
   * Higher = more granular speed control.
   */
  maxDistance: 80,
  
  /**
   * Smoothing factor for trackpad-like feel (0-1).
   * The gesture origin point smoothly follows the finger.
   * Higher = smoother/slower response, feels more like a trackpad.
   * Lower = more immediate/direct response.
   * 
   * Formula: newOrigin = oldOrigin * smoothing + fingerPos * (1 - smoothing)
   */
  smoothing: 0.92,
};

export function useInputController(options: UseInputControllerOptions) {
  const { enabled, onPause, onAction, onInventory, gameContainerRef } = options;
  
  const [inputMode, setInputMode] = useState<InputMode>('keyboard');
  const [showTouchControls, setShowTouchControls] = useState(false);
  
  const inputStateRef = useRef<InputState>({ x: 0, z: 0, action: false, inventory: false, pause: false });
  const keysRef = useRef<Set<string>>(new Set());
  
  // Gesture tracking state
  const gestureRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    touchId: -1,
  });
  
  // Get current input state
  const getInput = useCallback(() => {
    return { ...inputStateRef.current };
  }, []);
  
  // Update input state from keyboard
  // Camera looks from +Z toward -Z (camera at +Z, target at origin)
  // In Babylon's right-handed coordinate system:
  // - W/Up = move away from camera = negative Z
  // - S/Down = move toward camera = positive Z
  // - A/Left = move left on screen = negative X
  // - D/Right = move right on screen = positive X
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
      
      // Switch to keyboard mode on any key press
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
  // TOUCH GESTURE HANDLING
  // ─────────────────────────────────────────────────────────────────────────────
  // 
  // Implements a "drag anywhere" gesture model for mobile movement:
  // 
  // 1. Touch down anywhere (except UI) → record start position
  // 2. Drag → calculate vector from start to current position
  // 3. Vector direction = movement direction, magnitude = speed (clamped 0-1)
  // 4. Origin smoothly follows finger for trackpad-like feel
  // 5. Release → immediately stop movement
  //
  // This replaces the traditional fixed-position joystick approach which was
  // clumsy on mobile because users had to find and stay within the joystick zone.
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    
    const container = gameContainerRef?.current || document.body;
    
    /**
     * Handle touch start - begin tracking a gesture.
     * We only track one touch at a time for movement (first touch wins).
     */
    const handleTouchStart = (e: TouchEvent) => {
      // Don't capture touches on UI elements (buttons, etc)
      // Elements can opt-out by being a <button> or having data-ui="true"
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[data-ui]')) {
        return;
      }
      
      switchToMode('touch');
      
      // Only track the first touch for movement (ignore multi-touch)
      if (!gestureRef.current.active && e.touches.length > 0) {
        const touch = e.touches[0];
        gestureRef.current = {
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          currentX: touch.clientX,
          currentY: touch.clientY,
          touchId: touch.identifier,  // Track this specific touch
        };
      }
    };
    
    /**
     * Handle touch move - update movement based on drag vector.
     * 
     * The key insight here is the "trackpad model": instead of measuring
     * absolute distance from the initial touch point, we smoothly move
     * the origin toward the finger. This means:
     * 
     * - Short quick swipes = small movements
     * - Continuous dragging = sustained movement
     * - The user can "reset" by pausing briefly
     */
    const handleTouchMove = (e: TouchEvent) => {
      if (!gestureRef.current.active) return;
      
      // Find our tracked touch (ignore other fingers)
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === gestureRef.current.touchId) {
          gestureRef.current.currentX = touch.clientX;
          gestureRef.current.currentY = touch.clientY;
          
          // Calculate drag delta from (smoothed) start point
          const deltaX = touch.clientX - gestureRef.current.startX;
          const deltaY = touch.clientY - gestureRef.current.startY;
          
          // Calculate distance from origin
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > GESTURE_CONFIG.deadzone) {
            // Beyond deadzone: calculate normalized direction and scaled magnitude
            // Scale goes from 0 at deadzone edge to 1 at maxDistance
            const scale = Math.min(1, (distance - GESTURE_CONFIG.deadzone) / 
              (GESTURE_CONFIG.maxDistance - GESTURE_CONFIG.deadzone));
            
            // Normalize to unit vector
            const nx = deltaX / distance;
            const ny = deltaY / distance;
            
            // Apply to input state with coordinate mapping:
            // Screen coordinates: right = +X, down = +Y
            // Game coordinates: right = +X, toward camera = +Z
            // Our camera looks from +Z toward -Z, so screen down = game +Z
            // INVERTED: Touch controls were reversed - negate both axes
            inputStateRef.current.x = -nx * scale;
            inputStateRef.current.z = -ny * scale;
          } else {
            // Within deadzone: no movement (prevents jitter from small touches)
            inputStateRef.current.x = 0;
            inputStateRef.current.z = 0;
          }
          
          // TRACKPAD MODEL: Smoothly move the origin toward the finger
          // This creates a "relative" feel rather than "absolute" positioning
          // Higher smoothing = origin moves slower = more like a trackpad
          // Lower smoothing = origin moves faster = more like direct control
          gestureRef.current.startX = gestureRef.current.startX * GESTURE_CONFIG.smoothing + touch.clientX * (1 - GESTURE_CONFIG.smoothing);
          gestureRef.current.startY = gestureRef.current.startY * GESTURE_CONFIG.smoothing + touch.clientY * (1 - GESTURE_CONFIG.smoothing);
          
          break;
        }
      }
      
      // Prevent browser scroll/pan gestures while we're handling movement
      e.preventDefault();
    };
    
    /**
     * Handle touch end - stop movement when finger lifts.
     * 
     * We use an immediate stop (no momentum/deceleration) because:
     * 1. It's more predictable for precise positioning
     * 2. It matches keyboard behavior (stop when key released)
     * 3. Momentum in top-down games often feels floaty/imprecise
     */
    const handleTouchEnd = (e: TouchEvent) => {
      if (!gestureRef.current.active) return;
      
      // Check if our tracked touch is still active
      let found = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === gestureRef.current.touchId) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Our touch ended, reset gesture state
        gestureRef.current.active = false;
        gestureRef.current.touchId = -1;
        
        // Immediately stop movement (no momentum/inertia)
        inputStateRef.current.x = 0;
        inputStateRef.current.z = 0;
      }
    };
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
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
        
        // Dead zone
        // Gamepad: up = -y, down = +y → maps to Z: up=-Z, down=+Z (invert Y)
        // Gamepad: right = +x, left = -x → maps to X directly
        const deadzone = 0.15;
        const x = Math.abs(leftX) > deadzone ? leftX : 0;
        const z = Math.abs(leftY) > deadzone ? leftY : 0;
        
        if (x !== 0 || z !== 0) {
          switchToMode('gamepad');
          inputStateRef.current.x = x;
          inputStateRef.current.z = z;
        }
        
        // Buttons
        if (gamepad.buttons[9]?.pressed) { // Start button
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
  
  // No joystick needed - gestures handle touch input directly
  
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
    setShowTouchControls
  };
}
