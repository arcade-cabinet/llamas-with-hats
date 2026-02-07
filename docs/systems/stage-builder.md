# Stage Builder System

The Stage Builder is the core procedural generation system that creates playable stages from JSON definitions.

## Overview

```
Stage Definition (JSON)
         ↓
    buildStage()
         ↓
    BuiltStage
         ↓
  renderBuiltStage()
         ↓
   Babylon.js Scene
```

## Process

### 1. Parse Definition

Read the stage JSON and extract:
- Required anchor rooms (story-critical)
- Generation rules (layout type, connections)
- Floor requirements (basement, ground, etc.)
- Prop density and pools

### 2. Determine Floors

```typescript
// Always have ground floor
floors.push({ level: 0, name: 'Ground Floor', yOffset: 0 });

// Add basement if needed
if (needsBasement) {
  floors.push({ level: -1, name: 'Basement', yOffset: -FLOOR_HEIGHT });
}
```

### 3. Place Anchor Rooms

Anchor rooms are story-critical and placed first:

| Room | Grid Position | Purpose |
|------|--------------|---------|
| Entry | (0, 0) | Player spawn point |
| Kitchen | Calculated | Story beat location |
| Bedroom | Calculated | Story beat location |
| Exit | Max distance | Stage completion |

Position calculation depends on `connectionRules.type`:

```
LINEAR:     Entry → A → B → C → Exit
            (0,0)  (0,-1) (0,-2) (0,-3)

BRANCHING:  Entry at center, rooms branch out
               B
               ↑
            A ← Entry → C
               ↓
               Exit

HUB:        All rooms connect to central hub
            A   B
             \ /
              Hub
             / \
            C   D
```

### 4. Generate Filler Rooms

Fill gaps between anchors:

```typescript
for (let i = 0; i < fillerCount; i++) {
  // Find position adjacent to existing room
  const position = findFillerPosition(grid, floor, rooms, rng);
  
  // Pick random template from allowed list
  const template = rng.pick(fillerTemplates);
  
  // Place room
  const room = placeRoom({ template, purpose: 'filler', ... });
  rooms.set(room.id, room);
}
```

### 5. Create Connections

For each room, check adjacent grid cells:

```typescript
for (const [dir, offset] of Object.entries(DIRECTION_OFFSETS)) {
  const neighborKey = `${floor},${x + offset.x},${z + offset.z}`;
  const neighborId = grid.get(neighborKey);
  
  if (neighborId) {
    // Create bidirectional connection
    room.connections.push({
      direction: dir,
      targetRoomId: neighborId,
      type: determineConnectionType(room, neighbor)
    });
  }
}
```

### 6. Create Boundaries

Boundaries define the physical separation between rooms:

| Type | Visual | Use Case |
|------|--------|----------|
| `wall_door` | Wall with door frame | Interior rooms |
| `wall_archway` | Wall with open arch | Hallways |
| `stairs` | Stepped geometry | Floor transitions |
| `ramp` | Sloped surface | Accessible transitions |
| `open` | No barrier | Exterior areas |

### 7. Connect Floors

Vertical connections are created between floors:

```typescript
function createVerticalConnection(rooms, grid, floors) {
  // Find room with position that has a room below it
  for (const roomId of groundFloor.roomIds) {
    const room = rooms.get(roomId);
    const belowKey = `${-1},${room.gridPosition.x},${room.gridPosition.z}`;
    
    if (grid.has(belowKey)) {
      // Create stairs/ramp connection
      return {
        type: 'stairs',
        heightDifference: FLOOR_HEIGHT,
        ...
      };
    }
  }
}
```

## Grid System

Rooms are placed on a discrete grid:

```
Grid Cell Size: 12 world units
Floor Height: 4 world units

Grid (0,0) → World (0, 0, 0)
Grid (1,0) → World (12, 0, 0)
Grid (0,-1) → World (0, 0, -12)
Grid (1,-1) → World (12, 0, -12)

Floor 0  → Y = 0
Floor -1 → Y = -4
Floor 1  → Y = 4
```

## Room Sizing

Room dimensions are randomized within template bounds:

```typescript
const width = rng.nextInt(template.size.width.min, template.size.width.max);
const height = rng.nextInt(template.size.height.min, template.size.height.max);
```

Rooms can be smaller than grid cells - they're centered in their cell.

## Prop Placement

Props are placed according to template rules:

```typescript
for (const rule of template.propRules) {
  const count = rng.nextInt(rule.count.min, rule.count.max);
  
  for (let i = 0; i < count; i++) {
    const propType = rng.pick(rule.propTypes);
    const position = getPositionForZone(rule.zone, width, height);
    
    props.push({
      type: propType,
      position,
      rotation: calculateRotation(rule),
      interactive: true
    });
  }
}
```

Zones control placement:
- `center` - Middle of room
- `edge` / `wall` - Along walls
- `corner` - In corners
- `random` - Anywhere

## Output: BuiltStage

```typescript
interface BuiltStage {
  definition: StageDefinition;
  seed: string;
  rooms: Map<string, PlacedRoom>;
  boundaries: Boundary[];
  entryRoomId: string;
  exitRoomId: string;
  floors: FloorDefinition[];
  
  // Navigation helpers
  getRoom(id: string): PlacedRoom | undefined;
  getRoomsOnFloor(floor: number): PlacedRoom[];
  getBoundariesForRoom(roomId: string): Boundary[];
  getGroundY(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
}
```

## Usage Example

```typescript
import { buildStage } from './systems/StageBuilder';
import { renderBuiltStage } from './systems/StageSceneBuilder';
import stageDefinition from './data/stages/stage1/definition.json';
import templates from './data/global/templates/rooms.json';

// Generate stage
const builtStage = buildStage(
  stageDefinition as StageDefinition,
  templates.templates as SceneTemplate[],
  'my-seed-123'
);

// Render to Babylon.js
const renderedStage = renderBuiltStage(scene, builtStage, shadowGenerator);

// Use navigation
const groundY = renderedStage.getGroundY(playerX, playerZ);
const canWalk = renderedStage.isWalkable(targetX, targetZ);
```

## Deterministic Generation

Same seed always produces same stage:

```typescript
const rng = createRNG(hashSeed(seed));

// All random decisions use rng
const template = rng.pick(templates);
const width = rng.nextInt(min, max);
const position = rng.pick(candidates);
```

This enables:
- Reproducible worlds from seed strings
- Shareable world codes
- Debugging specific generations
