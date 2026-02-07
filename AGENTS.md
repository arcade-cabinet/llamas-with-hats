# AGENTS.md - Llamas With Hats RPG

## Project Overview

**Llamas With Hats** is a mobile-first dark comedy top-down RPG. Play as Carl or Paul in procedurally generated stages driven by JSON definitions (DDL). Features data-driven procedural generation, YukaJS AI, Tone.js audio, and responsive UI with Tailwind CSS.

## Tech Stack

- **Build Tool**: Vite 6.x
- **Framework**: React 18.x with TypeScript
- **3D Engine**: Babylon.js 7.x (scene rendering only)
- **UI Framework**: Tailwind CSS 4.x (all UI is React, not Babylon GUI)
- **Audio**: Tone.js (procedural audio, music, SFX)
- **Device Detection**: Capacitor (Device, ScreenOrientation, StatusBar)
- **AI System**: YukaJS 0.7.x for NPC behavior
- **Controls**: NippleJS for touch joystick
- **Procedural Generation**: seedrandom for deterministic worlds
- **Testing**: Vitest + happy-dom (unit), Playwright (E2E)

## Project Structure

```
repo/
├── index.html
├── package.json
├── vite.config.ts
├── postcss.config.js              # Tailwind PostCSS config
├── playwright.config.ts           # E2E test config
├── AGENTS.md
├── docs/
│   ├── README.md                  # Docs index
│   ├── GAME_DESIGN.md             # Game design document
│   ├── STORY.md                   # Story and narrative
│   ├── characters.md              # Character design
│   ├── scene-design.md            # Scene layout reference
│   ├── dialogue-system.md         # Dialogue system docs
│   ├── effects-system.md          # Visual effects docs
│   ├── audio-system.md            # Tone.js audio docs
│   ├── controls-vr.md             # Controls and VR support
│   ├── architecture/
│   │   ├── overview.md            # System architecture overview
│   │   └── data-driven-design.md  # DDL and procedural gen design
│   ├── dev/
│   │   ├── STATUS.md              # Implementation status tracker
│   │   ├── ROADMAP.md             # Development roadmap
│   │   ├── DECISIONS.md           # Architecture decisions
│   │   ├── DEVLOG.md              # Development log
│   │   └── GAPS.md                # Known gaps and todos
│   └── systems/
│       ├── input-controller.md    # Input system docs
│       ├── interaction-system.md  # Interaction system docs
│       └── stage-builder.md       # Stage builder docs
├── e2e/
│   └── game.spec.ts               # E2E test suite
├── public/
│   ├── textures/particle.svg      # Particle effects asset
│   └── assets/
│       ├── models/characters/
│       │   ├── carl.glb           # Carl llama 3D model
│       │   └── paul.glb           # Paul llama 3D model
│       └── sounds/
│           └── horror_ambience.wav
└── src/
    ├── main.tsx                   # React entry point
    ├── index.css                  # Tailwind CSS with custom dark theme
    ├── App.tsx                    # Root: device detection, AI loop, orchestration
    ├── components/
    │   ├── ui/
    │   │   ├── MainMenuScene.tsx  # 3D main menu
    │   │   └── MenuOverlay.tsx    # Full menu system (new game, load, settings)
    │   └── game/
    │       ├── GameView.tsx       # HUD overlay, minimap, dialogue, pause
    │       ├── GameRenderer.tsx   # BabylonJS scene, game loop, movement
    │       └── LayoutGameRenderer.tsx  # Multi-room layout renderer
    ├── hooks/
    │   ├── useRPGGameState.ts     # Save/load, character select, world seeds, room transitions
    │   ├── useDeviceInfo.ts       # Capacitor device detection
    │   ├── useInputController.ts  # Unified keyboard/touch/gamepad input
    │   ├── useAudio.ts            # Audio hook (Tone.js)
    │   ├── useECS.ts              # Entity Component System bindings
    │   ├── useGameState.ts        # Legacy game state
    │   └── useStory.ts            # Story progression hook
    ├── systems/
    │   ├── GameInitializer.ts     # ** ENTRY POINT ** Bridges JSON DDL → runtime game
    │   ├── StageDefinition.ts     # DDL types for procedural generation (1200+ lines)
    │   ├── StageGenerator.ts      # Procedural stage generation from JSON definitions
    │   ├── StageBuilder.ts        # Grid-based room placement, boundaries, nav mesh
    │   ├── StageRenderer.ts       # Renders built stages to BabylonJS meshes
    │   ├── StageSceneBuilder.ts   # Builds BabylonJS scenes from stage definitions
    │   ├── SceneDefinition.ts     # Scene type definitions (SceneDefinition, RoomConfig)
    │   ├── SceneLoader.ts         # BabylonJS scene construction
    │   ├── Character.ts           # Unified GLB model loading for all characters
    │   ├── CharacterNavigator.ts  # Yuka-based navigation (AI + tap-to-move)
    │   ├── Camera.ts              # Fixed responsive isometric camera
    │   ├── AIController.ts        # Facade for Yuka AI behaviors
    │   ├── CollisionSystem.ts     # Prop collision + room bounds
    │   ├── InteractionSystem.ts   # Click/tap interaction with props and NPCs
    │   ├── EffectsManager.ts      # Screen shake, blood splatter, dramatic zoom
    │   ├── AtmosphereManager.ts   # Fog, lighting presets, ambient transitions
    │   ├── AudioManager.ts        # Tone.js audio (music, SFX, ambient)
    │   ├── StoryManager.ts        # Story beat triggers and consequences
    │   ├── PropFactory.ts         # Procedural + GLB prop generation
    │   ├── LayoutGenerator.ts     # Multi-room layout generation
    │   ├── LayoutRenderer.ts      # Multi-room layout rendering
    │   └── ECS.ts                 # Entity Component System
    ├── utils/
    │   ├── worldGenerator.ts      # World seed generation and parsing only
    │   └── worldGenerator.test.ts # Seed tests
    ├── types/
    │   └── game.ts                # Comprehensive type definitions
    ├── test/
    │   └── setup.ts               # Vitest test setup
    └── data/
        ├── game.json              # Global game config
        ├── dialogues.ts           # Dialogue content (TypeScript)
        ├── index.ts               # Data barrel exports
        ├── index.test.ts          # Data loading tests
        ├── global/
        │   ├── props.json         # Shared prop definitions
        │   ├── templates/
        │   │   ├── rooms.json     # Room templates + palettes
        │   │   └── layout-archetypes.json
        │   └── dialogues/
        │       └── prop-dialogues.json
        └── stages/
            ├── stage1/
            │   ├── definition.json    # Stage 1: The Apartment
            │   ├── scenes/            # Per-scene overrides
            │   └── dialogues/story.json
            ├── stage2/
            │   ├── definition.json    # Stage 2: The Neighborhood
            │   └── dialogues/story.json
            └── stage3/
                ├── definition.json    # Stage 3: Downtown
                └── dialogues/story.json
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

## Stage DDL Pipeline (Critical)

This is the core architecture. Understand this before touching game flow.

```
JSON Stage Definition (data/stages/stageN/definition.json)
          │
          ▼
GameInitializer.initializeGame(stageId, character, seed)
          │
          ├── Loads definition.json → StageDefinition type
          ├── Loads room templates from rooms.json
          ├── Loads palettes from rooms.json
          │
          ▼
StageGenerator.generateStage(definition, templates, palettes, seed)
          │
          ├── Creates entry + exit scenes from definition
          ├── Creates required scenes from definition
          ├── Generates optional scenes using allowed templates
          ├── Connects scenes (linear / branching / hub)
          ├── Applies per-room atmosphere overrides
          │
          ▼
GameInstance { stage, currentRoom, transitionTo(), getCurrentRoom() }
          │
          ▼
sceneToRoomConfig() → RoomConfig → GameRenderer
```

**Key types**:
- `StageDefinition` (StageDefinition.ts) - The DDL schema for JSON stage files
- `SceneDefinition` (SceneDefinition.ts) - Generated scene with props, exits, spawn points
- `RoomConfig` (SceneDefinition.ts) - Simplified config passed to GameRenderer
- `GameInstance` (GameInitializer.ts) - Runtime game state with room navigation

**Connection types** (actually implemented in StageGenerator):
- `linear`: A → B → C → D (straight path)
- `branching`: Main path with side rooms
- `hub`: Central room with spokes
- `maze`/`open`: Fall through to `linear` (not yet implemented)

## Stage Definitions

Each stage is a JSON file defining layout, story beats, generation rules, props, NPCs, and atmosphere:

- **Stage 1** (`stage1/`): The Apartment - tutorial level, linear layout, horror level 1-3
- **Stage 2** (`stage2/`): The Neighborhood - suburban exterior, linear layout, horror 3-5
- **Stage 3** (`stage3/`): Downtown - urban mixed, branching layout, horror 5-9

Stage definitions reference templates from `global/templates/rooms.json`. Each template defines size ranges, connection points, prop placement rules, and tags.

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

## Architecture Layers

### UI Layer (React + Tailwind)
All UI is rendered via React components with Tailwind CSS:
- MainMenuScene: 3D background + UI overlay (uses unified Character system)
- MenuOverlay: New game, load, settings menus
- GameView: HUD overlay with joystick, health, minimap, dialogue
- Uses `clsx` for conditional class composition
- Responsive with `isCompact` flag for phone/folded layouts

### Game State Layer (Hooks)
- `useRPGGameState`: Calls `GameInitializer.initializeGame()` on new game, holds `GameInstance` ref, handles room transitions via `game.transitionTo()`
- `useStory`: Story beat progression tracking
- `useAudio`: Tone.js audio management

### Systems Layer
- `GameInitializer`: Bridges JSON → runtime. Entry point for stage loading
- `StageGenerator`: Procedural generation from DDL
- `StoryManager`: Triggers story beats on scene_enter / npc_interact
- `CollisionSystem` / `InteractionSystem`: Gameplay mechanics
- `AtmosphereManager` / `EffectsManager`: Horror ambience

### 3D Layer (Babylon.js)
Pure rendering, no UI:
- GameRenderer: Canvas element, scene setup, render loop
- Handles player movement, camera follow, prop rendering
- Uses unified Character system (no separate character loaders)

### Communication
- `window.__gameGetInput()`: Input controller → 3D scene
- Props passed down: positions, rotations, room config
- Callbacks up: onPlayerMove, onRoomTransition

## World Seeds

Seeds use "Adjective-Adjective-Noun" format for deterministic generation:
```typescript
const seed = generateWorldSeed();
// { adjective1: 'Crimson', adjective2: 'Haunted', noun: 'Manor', seedString: 'Crimson-Haunted-Manor' }
// Same seed + same stage definition = identical world every time
```

Seed functions are in `utils/worldGenerator.ts`. The actual procedural generation happens in `StageGenerator.ts`.

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

## Key Files to Understand

1. **src/systems/GameInitializer.ts** - THE entry point for stage loading. Start here.
2. **src/systems/StageGenerator.ts** - Procedural generation engine
3. **src/systems/StageDefinition.ts** - DDL type definitions (read this to understand JSON schema)
4. **src/hooks/useRPGGameState.ts** - Game state management, calls GameInitializer
5. **src/components/game/GameRenderer.tsx** - 3D rendering and game loop
6. **src/data/stages/*/definition.json** - Stage definitions (the DDL data)
7. **src/data/global/templates/rooms.json** - Room templates and color palettes

## Common Issues & Solutions

### Characters facing wrong direction
- Check MODEL_ROTATION_OFFSET in Character.ts (should be PI/2)
- Check rotation calculation in GameRenderer (should use `atan2(-nx, -nz)`)

### Controls inverted
- W should set z = -1 (into screen), S should set z = +1
- Check useInputController.ts keyboard mapping

### Stage not loading / single room only
- Verify `useRPGGameState.startNewGame()` calls `initializeGame()` (not WorldGenerator)
- Verify `transitionToRoom()` calls `game.transitionTo()` (not worldGen.generateRoomFromId)
- Check that stage definition.json references valid template IDs from rooms.json

### Template not found errors
- All `templateId` values in stage definitions must exist in `data/global/templates/rooms.json`
- All `palettes` values must exist in the palettes array of rooms.json

### Per-room atmosphere not applying
- Stage definition must have `atmosphere.perRoomOverrides` keyed by room purpose
- `StageDefinition.ts` type must include `perRoomOverrides` in atmosphere

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
- Deterministic RNG (seedrandom) for reproducible generation
