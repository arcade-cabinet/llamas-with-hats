# Input Controller System

The unified input controller handles all input methods through a single interface.

## Overview

```typescript
const { getInput, inputMode, showTouchControls } = useInputController({
  enabled: !isPaused,
  onPause: () => togglePause(),
  onAction: () => handleAction(),
  gameContainerRef
});

// In game loop
const input = getInput();
player.move(input.x, input.z);
```

## Input Modes

| Mode | Detection | Controls |
|------|-----------|----------|
| `keyboard` | Key press | WASD/Arrows + E |
| `touch` | Touch event | Drag gestures |
| `gamepad` | Gamepad connected | Left stick |

Mode switches automatically based on last input type.

## Keyboard Controls

```
Movement:
  W / ↑  = Forward (−Z)
  S / ↓  = Backward (+Z)
  A / ←  = Left (−X)
  D / →  = Right (+X)

Actions:
  E      = Interact (when near object)
  I      = Inventory
  Escape = Pause
```

### Coordinate Mapping

Camera looks from +Z toward −Z (isometric view):

```
        −Z (forward/up on screen)
         ↑
  −X ←───┼───→ +X
         ↓
        +Z (backward/down on screen)
```

## Touch Gesture Controls

Touch uses a "drag anywhere" model instead of a fixed joystick.

### Why Gestures Over Joystick?

- **Less clumsy**: No need to find and stay in joystick zone
- **Full screen**: Use any part of screen as control surface
- **Natural feel**: Similar to trackpad navigation
- **Better for varied screens**: Works on phones and tablets

### How It Works

1. **Touch down** anywhere (except UI buttons)
2. **Drag** in any direction
3. **Direction** = movement direction
4. **Distance** = movement speed (normalized 0-1)
5. **Release** = stop immediately

### Trackpad Model

The touch origin smoothly follows your finger:

```typescript
// Origin moves toward finger position
gestureRef.startX = startX * SMOOTHING + touchX * (1 - SMOOTHING);
gestureRef.startY = startY * SMOOTHING + touchY * (1 - SMOOTHING);
```

This creates a relative feel:
- Short quick swipes = small movements
- Continuous dragging = sustained movement
- Pause briefly = "reset" the origin

### Configuration

```typescript
const GESTURE_CONFIG = {
  deadzone: 8,      // Min drag distance (pixels)
  maxDistance: 80,  // Drag for max speed (pixels)
  smoothing: 0.92   // Origin follow speed (0-1)
};
```

### UI Exclusion

Touches on UI elements are ignored:

```typescript
const target = e.target as HTMLElement;
if (target.closest('button') || target.closest('[data-ui]')) {
  return; // Don't capture this touch
}
```

Mark elements with `data-ui="true"` to exclude from gestures.

## Gamepad Controls

```
Left Stick  = Movement
A Button    = Interact
Start       = Pause
```

Deadzone: 0.15 (15% stick deflection ignored)

## Input State

```typescript
interface InputState {
  x: number;      // -1 to +1, left/right
  z: number;      // -1 to +1, forward/back
  action: boolean;
  inventory: boolean;
  pause: boolean;
}
```

## Visual Feedback (Touch)

When dragging on touch, a direction indicator appears:

```tsx
{touchInput.active && (
  <div className="direction-indicator">
    <svg style={{
      transform: `rotate(${Math.atan2(z, x) * 180 / Math.PI + 90}deg)`,
      opacity: Math.sqrt(x*x + z*z)
    }}>
      <path d="M12 4l-8 8h6v8h4v-8h6z" />
    </svg>
  </div>
)}
```

## Integration with Interactions

Interactions are primarily click/tap based (not button-based):

| Platform | Interact Method |
|----------|-----------------|
| Desktop | Click on object |
| Mobile | Tap on object |
| Keyboard | E key (fallback, proximity-based) |

The input controller only handles:
- Movement direction
- Pause trigger
- E key for keyboard fallback

Click/tap interactions are handled by raycasting in GameRenderer.

## Usage

```typescript
// In a game component
const gameContainerRef = useRef<HTMLDivElement>(null);

const { getInput, inputMode, showTouchControls } = useInputController({
  enabled: !isPaused && !inDialogue,
  onPause: () => setPaused(true),
  gameContainerRef
});

// Poll input in render loop
useEffect(() => {
  const input = getInput();
  
  // Apply movement
  const speed = 4;
  const newX = playerX + input.x * speed * deltaTime;
  const newZ = playerZ + input.z * speed * deltaTime;
  
  setPlayerPosition({ x: newX, z: newZ });
}, []);

// Show appropriate hints
return (
  <div ref={gameContainerRef}>
    {inputMode === 'keyboard' && <span>WASD to move</span>}
    {showTouchControls && <span>Drag to move</span>}
    {inputMode === 'gamepad' && <span>Left stick to move</span>}
  </div>
);
```
