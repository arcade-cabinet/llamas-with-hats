# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              REACT UI LAYER                              │
├─────────────────────────────────────────────────────────────────────────┤
│  App.tsx          │  GameView.tsx       │  MenuOverlay.tsx              │
│  Entry point      │  Game HUD overlay   │  Pause/settings menus         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           GAME SYSTEMS LAYER                             │
├─────────────────────────────────────────────────────────────────────────┤
│  useInputController    │  InteractionSystem   │  StageBuilder            │
│  Keyboard/touch/pad    │  Click/tap to talk   │  Procedural generation   │
├────────────────────────┼─────────────────────┼──────────────────────────┤
│  Character             │  CollisionSystem     │  Camera                  │
│  Llama rendering       │  Movement bounds     │  Isometric view          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          RENDERING LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  GameRenderer          │  StageSceneBuilder   │  PropFactory             │
│  Babylon.js scene      │  Rooms & boundaries  │  Data-driven meshes      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  src/data/index.ts     │  JSON DDL Files      │  Type Definitions        │
│  Data access module    │  Props, dialogues    │  TypeScript interfaces   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Data-Driven Design

All game content is defined in JSON files:
- **Props** → `global/props.json`
- **Dialogues** → `global/dialogues/prop-dialogues.json`
- **Stages** → `stages/stageN/definition.json`
- **Templates** → `global/templates/rooms.json`

Code reads data and renders - content creators edit JSON, not TypeScript.

### 2. Separation of Concerns

| Layer | Responsibility | Files |
|-------|---------------|-------|
| Data | Content definitions | `src/data/**/*.json` |
| Systems | Game logic | `src/systems/*.ts` |
| Rendering | Visual output | `src/components/game/*.tsx` |
| UI | Player interface | `src/components/ui/*.tsx` |

### 3. Procedural Generation

Stages are built dynamically from definitions:

```
Stage Definition (JSON)
    ↓
StageBuilder.buildStage()
    ↓
BuiltStage (rooms, boundaries)
    ↓
StageSceneBuilder.renderBuiltStage()
    ↓
Babylon.js Scene (meshes, lights)
```

### 4. Unified Input

One system handles all input methods:

```
useInputController
    ├── Keyboard (WASD, arrows, E key)
    ├── Touch (drag gestures)
    └── Gamepad (sticks, buttons)
           ↓
    Normalized input: { x, z, action, pause }
```

## File Structure

```
src/
├── components/
│   ├── game/
│   │   ├── GameRenderer.tsx    # Main 3D renderer
│   │   ├── GameView.tsx        # Game UI overlay
│   │   └── StageGameRenderer.tsx
│   └── ui/
│       └── MenuOverlay.tsx     # Menus
│
├── data/                       # JSON content
│   ├── index.ts                # Data access module
│   ├── game.json               # Master game config
│   ├── global/                 # Reusable content
│   └── stages/                 # Stage-specific content
│
├── hooks/
│   ├── useInputController.ts   # Input handling
│   ├── useGameState.ts         # Game state management
│   └── useDeviceInfo.ts        # Device detection
│
├── systems/
│   ├── StageBuilder.ts         # Procedural generation
│   ├── StageSceneBuilder.ts    # Stage rendering
│   ├── StageDefinition.ts      # Stage types
│   ├── PropFactory.ts          # Prop mesh creation
│   ├── InteractionSystem.ts    # Click/tap handling
│   ├── CollisionSystem.ts      # Movement collision
│   ├── Character.ts            # Llama characters
│   └── Camera.ts               # Camera control
│
└── types/
    └── game.ts                 # Core type definitions
```

## Data Flow

### Game Initialization

```
1. Load game.json
2. Get starting stage ID
3. Load stage definition
4. Load global templates
5. buildStage() → BuiltStage
6. renderBuiltStage() → Babylon scene
7. Create characters
8. Start game loop
```

### Player Interaction

```
1. Player clicks/taps object
2. Babylon raycasts to find mesh
3. Check mesh.metadata.interactive
4. Get propType from metadata
5. InteractionSystem.interactWithProp()
6. Load dialogue from data
7. Display in GameView
```

### Movement

```
1. useInputController polls input
2. Returns { x, z } direction vector
3. Game loop reads input
4. Apply velocity with collision
5. Update character position
6. Camera follows player
```

## Key Types

### PlacedRoom
A room instance in a generated stage.

```typescript
interface PlacedRoom {
  id: string;
  templateId: string;
  purpose: string;        // 'entry', 'exit', 'kitchen', 'filler'
  isAnchor: boolean;      // Story-critical?
  floor: number;          // 0 = ground, -1 = basement
  gridPosition: { x, z }; // Grid coordinates
  worldPosition: { x, y, z }; // World coordinates
  size: { width, height, ceilingHeight };
  connections: RoomConnection[];
  props: PlacedProp[];
}
```

### Boundary
Connection between two rooms.

```typescript
interface Boundary {
  id: string;
  roomA: string;
  roomB: string;
  transitionType: 'wall_door' | 'wall_archway' | 'stairs' | 'ramp' | 'open';
  worldPosition: { x, y, z };
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  width: number;
  heightDifference?: number;  // For vertical transitions
  locked: boolean;
}
```

### BuiltStage
Complete generated stage ready for rendering.

```typescript
interface BuiltStage {
  definition: StageDefinition;
  seed: string;
  rooms: Map<string, PlacedRoom>;
  boundaries: Boundary[];
  entryRoomId: string;
  exitRoomId: string;
  floors: FloorDefinition[];
  
  getRoom(id: string): PlacedRoom | undefined;
  getRoomsOnFloor(floor: number): PlacedRoom[];
  getGroundY(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
}
```
