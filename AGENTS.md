# AGENTS.md - Llamas With Hats RPG

## Project Overview

**Llamas With Hats** is a mobile-first dark comedy top-down RPG. Play as Carl or Paul in procedurally generated dungeons with YukaJS AI opponents. Built with responsive design using Tailwind CSS and Capacitor for native device detection.

## Tech Stack

- **Build Tool**: Vite 6.x
- **Framework**: React 18.x with TypeScript
- **3D Engine**: Babylon.js 7.x (scene rendering only)
- **UI Framework**: Tailwind CSS 4.x (all UI is React, not Babylon GUI)
- **Device Detection**: Capacitor (Device, ScreenOrientation, StatusBar)
- **AI System**: YukaJS 0.7.x for opponent behavior
- **Controls**: NippleJS for touch joystick
- **Procedural Generation**: seedrandom for deterministic worlds

## Project Structure

```
repo/
├── index.html
├── package.json
├── vite.config.ts
├── postcss.config.js          # Tailwind PostCSS config
├── AGENTS.md
├── docs/
│   ├── ARCHITECTURE.md        # Main technical documentation
│   ├── architecture.md        # Legacy architecture overview
│   ├── characters.md          # Character design docs
│   ├── scene-design.md        # Scene layout reference
│   ├── dialogue-system.md     # Dialogue system docs
│   └── effects-system.md      # Visual effects docs
├── public/
│   └── assets/models/characters/
│       ├── carl.glb           # Carl llama 3D model
│       └── paul.glb           # Paul llama 3D model
└── src/
    ├── main.tsx               # Entry point
    ├── index.css              # Tailwind CSS with custom theme
    ├── vite-env.d.ts          # Type declarations
    ├── App.tsx                # Root component with device/AI orchestration
    ├── components/
    │   ├── ui/                # React UI components (Tailwind)
    │   │   └── MainMenuScene.tsx  # 3D main menu (unified Character system)
    │   └── game/              # Game components
    │       ├── GameView.tsx   # HUD overlay + joystick controls
    │       └── GameRenderer.tsx # Pure 3D scene + game loop
    ├── hooks/
    │   ├── useDeviceInfo.ts   # Capacitor device detection + orientation
    │   ├── useInputController.ts # Unified keyboard/touch/gamepad input
    │   ├── useECS.ts          # Entity Component System bindings
    │   └── useRPGGameState.ts # Game state management
    ├── systems/
    │   ├── Character.ts       # UNIFIED character loading (GLB models)
    │   ├── Camera.ts          # Fixed responsive camera
    │   ├── AIController.ts    # YukaJS opponent AI
    │   ├── ECS.ts             # Entity Component System
    │   ├── StageDefinition.ts # Stage DDL types
    │   ├── StageGenerator.ts  # Procedural generation engine
    │   ├── SceneDefinition.ts # Scene type definitions
    │   └── SceneLoader.ts     # Babylon.js scene building
    ├── utils/
    │   └── worldGenerator.ts  # Procedural room generation
    ├── types/
    │   └── game.ts            # Type definitions
    └── data/
        └── dialogues.ts       # Dialogue content
```

## Commands

```bash
pnpm install                           # Install dependencies
pnpm dev --host 0.0.0.0 --port 8080   # Development server
pnpm tscgo --noEmit                    # Type check
pnpm build                             # Production build
pnpm test                              # Run unit tests
pnpm test:watch                        # Watch mode
pnpm test:coverage                     # With coverage
pnpm test:e2e                          # E2E tests (Playwright)
```

## Coordinate System

**CRITICAL**: Understand this before touching movement/rotation code.

```
        -Z (north/into screen)
              ↑
              |
  -X (west) ←─●─→ +X (east)
              |
              ↓
        +Z (south/toward camera)

Camera: Located at (0, height, +Z) looking toward origin
Forward: -Z direction (into the screen)
```

**Movement Mapping**:
- W/Up: Move into screen → z = -1
- S/Down: Move toward camera → z = +1
- A/Left: Move left → x = -1
- D/Right: Move right → x = +1

**Character Rotation**:
- GLB models face +X by default
- MODEL_ROTATION_OFFSET (PI/2) makes model face -Z when rotation.y = 0
- Movement rotation formula: `Math.atan2(-nx, -nz)`

## Architecture

### UI Layer (React + Tailwind)
All UI is rendered via React components with Tailwind CSS:
- MainMenuScene: 3D background + UI overlay (uses unified Character system)
- GameView: HUD overlay with joystick, health, minimap
- Uses `clsx` for conditional class composition
- Responsive with `isCompact` flag for phone/folded layouts

### 3D Layer (Babylon.js)
Pure rendering, no UI:
- GameRenderer: Canvas element, scene setup, render loop
- Handles player movement, camera follow, prop rendering
- Uses unified Character system (no separate character loaders)

### Communication
- `window.__gameGetInput()`: Input controller → 3D scene
- Props passed down: positions, rotations, room config
- Callbacks up: onPlayerMove, onRoomTransition

## Device Detection Hook

```typescript
const device = useDeviceInfo();

// Properties
device.deviceType      // 'phone' | 'foldable-folded' | 'foldable-open' | 'tablet' | 'desktop'
device.orientation     // 'portrait' | 'landscape'
device.requiresLandscape // true for phone/folded foldable
device.isTouchDevice   // Has touch support

// Methods
device.lockToLandscape()  // Lock to landscape (native + web)
device.unlockOrientation() // Remove lock
device.enterFullscreen()   // Request fullscreen
```

## Custom Tailwind Theme

```css
@theme {
  --color-blood: #8B0000;
  --color-wood: #8B4513;
  --color-carl: #3c643c;
  --color-paul: #cd853f;
  --color-shadow: #1a0a0a;
  --color-shadow-light: #2d1515;
}
```

Usage: `bg-blood`, `text-wood`, `border-carl`, etc.

## World Generation

Seeds use "Adjective-Adjective-Noun" format:
```typescript
const seed = { 
  adjective1: 'Crimson', 
  adjective2: 'Haunted', 
  noun: 'Manor' 
};
// Generates deterministic rooms with props, exits, enemies
```

## AI System (YukaJS)

```typescript
const ai = createLlamaAI(x, z, width, height, onUpdate);
ai.updatePlayerPosition(px, pz);
ai.update(deltaTime);
// States: idle → wander → follow/flee → interact
```

## GLB Models

Located in `public/assets/models/characters/`:
- `carl.glb` (~8.5MB) - Gray llama, green hat
- `paul.glb` (~8.5MB) - Beige llama, red/brown hat

Loaded via unified Character system. No fallback procedural meshes.

## Key Files to Understand

1. **src/systems/Character.ts** - THE character loader. Used everywhere.
2. **src/hooks/useInputController.ts** - All input handling
3. **src/systems/Camera.ts** - Fixed responsive camera
4. **src/components/game/GameRenderer.tsx** - Game loop and movement
5. **src/components/ui/MainMenuScene.tsx** - 3D menu

## Common Issues & Solutions

### Characters facing wrong direction
- Check MODEL_ROTATION_OFFSET in Character.ts (should be PI/2)
- Check rotation calculation in GameRenderer (should use `atan2(-nx, -nz)`)
- Menu characters should use rotation = PI/2 to face camera at +X

### Controls inverted
- W should set z = -1 (into screen)
- S should set z = +1 (toward camera)
- Check useInputController.ts keyboard mapping

### Movement math
```typescript
// Correct movement rotation:
player.setTargetRotation(Math.atan2(-nx, -nz));
// This makes character face movement direction
```

## Mobile Considerations

1. **Touch Controls**: NippleJS joystick in bottom-left
2. **Safe Areas**: CSS env() for notched devices
3. **Prevent Overscroll**: `overscroll-behavior: none`
4. **Touch Action**: `touch-action: manipulation` 
5. **No Text Selection**: `user-select: none`
6. **Fullscreen**: Auto-enter on game start (phones)

## Performance

- Canvas uses `adaptToDeviceRatio: true`
- Shadow map: 1024px resolution
- GLB models loaded async
- Resize handler with debounce
