# Scene Design

## Overview

The 3D environment is a cozy apartment living room that progressively becomes more disturbing as the horror level increases.

## Room Layout

```
                    BACK WALL (z = -5)
    ┌─────────────────────────────────────────────┐
    │                                             │
    │    [Bookshelf]      [Frame1]    [Frame2]   │
    │                                             │
    │                    [Couch]                  │
    │                                             │
L   │                   [Table]                   │   R
E   │                                             │   I
F   │              ════════════════               │   G  [Window]
T   │              ║    RUG      ║               │   H
    │              ════════════════               │   T
W   │                                             │
A   │  [Carl]                    [Paul]    [Lamp]│   W
L   │                                             │   A
L   │        [Cat]                               │   L
    │                                             │   L
    └─────────────────────────────────────────────┘
                    FRONT (z = +5, camera side)
    
    Floor: 10x10 units, centered at origin
```

## Coordinate System

- **Origin**: Center of floor at ground level
- **X-axis**: Left (-) to Right (+)
- **Y-axis**: Up (from floor)
- **Z-axis**: Back (-) to Front (+)

## Static Elements

### Floor
```typescript
const floor = MeshBuilder.CreateGround('floor', {
  width: 10,
  height: 10,
  subdivisions: 20,
}, scene);
// Position: (0, 0, 0)
// Color: Warm wood brown (0.55, 0.35, 0.2)
```

### Walls
| Wall | Size | Position | Rotation |
|------|------|----------|----------|
| Back | 10×4 | (0, 2, -5) | None |
| Left | 10×4 | (-5, 2, 0) | Y: π/2 |
| Right | 10×4 | (5, 2, 0) | Y: -π/2 |

Color: Cream/off-white (0.85, 0.8, 0.7)

### Window (Right Wall)
```typescript
// Frame
const windowFrame = MeshBuilder.CreateBox('windowFrame', {
  width: 2.5, height: 2, depth: 0.15
}, scene);
windowFrame.position = new Vector3(4.95, 2.2, 0);

// Glass (semi-transparent)
const windowGlass = MeshBuilder.CreatePlane('windowGlass', {
  width: 2.2, height: 1.7
}, scene);
windowGlass.material.alpha = 0.4;
windowGlass.position = new Vector3(4.9, 2.2, 0);
```

## Furniture

### Couch
```
Position: (0, -, -3.5)

    ┌─────────────────────────────┐ ← Back (0, 0.6, -3.95)
    │                             │   2.5×0.8×0.2
    │   [Cushion1]   [Cushion2]   │ ← Cushions (removable)
    └─────────────────────────────┘ ← Base (0, 0.2, -3.5)
                                      2.5×0.4×0.9
```
- Color: Dark brown (0.4, 0.25, 0.15)
- Cushions: Slightly lighter, can be removed

### Coffee Table
```
Position: (0, -, -2)

    ╔═══════════════════════╗ ← Top: 1.5×0.08×0.8 at y=0.45
    ║                       ║
    ╠═══╦═══════════╦═══════╣
    ║   ║           ║       ║ ← 4 cylinder legs
    ║   ║           ║       ║   h=0.4, d=0.06
```
- Color: Dark wood (0.35, 0.25, 0.15)

### Lamp
```
Position: (2, -, 1)

        ╱╲
       ╱  ╲    ← Shade: cylinder h=0.4
      ╱    ╲     d_top=0.5, d_bot=0.3
     ╱      ╲    Emissive glow
    ┌────────┐
    │        │
    │   ▓▓   │ ← Stand: cylinder h=1.5
    │   ▓▓   │   d_bot=0.3, d_top=0.1
    └────────┘
```
- Shade: Semi-transparent, emissive warm glow

### Bookshelf
```
Position: (-3.5, -, -4.5)

    ┌─────────────────┐
    │ [books] [books] │ ← Shelf 3
    ├─────────────────┤
    │ [books] [books] │ ← Shelf 2
    ├─────────────────┤
    │ [books] [books] │ ← Shelf 1
    ├─────────────────┤
    │ [books] [books] │ ← Shelf 0
    └─────────────────┘
      Back: 1.2×2×0.05
```
- 4 shelves, 5 books each
- Book colors rotate through 4 options
- Slight random size variation

### Picture Frames
| Frame | Size | Position |
|-------|------|----------|
| Frame 1 | 0.8×0.6 | (-1.5, 2.5, -4.95) |
| Frame 2 | 0.6×0.8 | (1, 2.5, -4.95) |

Pictures darken with horror level:
```typescript
const pictureMat = createMat('pictureMat', 
  new Color3(
    0.6 - horrorLevel * 0.04,
    0.5 - horrorLevel * 0.04,
    0.4
  )
);
```

### Rug
```typescript
// Outer ring
const rug = MeshBuilder.CreateDisc('rug', { radius: 1.8 }, scene);
rug.position = new Vector3(0, 0.01, -1);
rug.rotation.x = Math.PI / 2;

// Inner pattern
const rugInner = MeshBuilder.CreateDisc('rugInner', { radius: 1.4 }, scene);
rugInner.position = new Vector3(0, 0.012, -1);
```
- Two-tone circular rug

## Dynamic Elements

### Cat (Removable)
```
Position: (3, -, -2)
Removed when: removedObjects.includes('cat')

    ╭──╮
    │░░│ ← Head: sphere d=0.2
    ├──┤   with ears
    │▓▓│ ← Body: capsule h=0.35, r=0.12
    │▓▓│
    └──┴─╮ ← Tail: animated cylinder
```
- Animated tail wag (y rotation cycle)
- Brown/tan coloring

### Suspicious Box
```
Position: (-1.5, 0.25, 1)
Spawns when: spawnedObjects.includes('suspicious_box')

    ┌─────────┐
    │  ░░░░░  │ ← Box: 0.6×0.5×0.4
    │  ░░░░░  │   Brown cardboard color
    └─────────┘
      
    At horrorLevel > 4:
      ● ← Drip sphere (blood red)
```

### Traffic Cone
```
Position: (1.5, 0.25, 2)
Spawns when: spawnedObjects.includes('cone_hat')

      ╱╲
     ╱  ╲  ← Cone: h=0.5
    ╱    ╲   d_top=0.05, d_bot=0.25
   ╱______╲  Orange color
```

### Table Food / Mystery Meat
```
Position: (0, 0.51, -2) on table
Spawns when: spawnedObjects.includes('table_food') 
          or spawnedObjects.includes('mystery_meat')

    ╭───────╮
    │  🍖   │ ← Meat: sphere d=0.2, scaled (1.5, 0.6, 1)
    ├───────┤
    │       │ ← Plate: cylinder h=0.03, d=0.4
    └───────┘

mystery_meat is darker red than table_food
```

## Horror Level Effects

### Blood Stains
```typescript
if (horrorLevel > 2) {
  for (let i = 0; i < Math.min(horrorLevel - 2, 5); i++) {
    const stain = MeshBuilder.CreateDisc(`bloodStain${i}`, {
      radius: 0.3 + Math.random() * 0.4,
    }, scene);
    // Random position on floor
    // Dark red color (0.4, 0.05, 0.05)
  }
}
```
- Up to 5 blood stains appear
- Random sizes and positions
- Only visible at horror level 3+

### Lighting Darkening
- Ambient light intensity decreases
- Red ominous light fades in at level 4+
- Fog density increases

### Picture Darkening
Pictures on wall get progressively darker/redder.

## Scene Rebuild

The apartment is rebuilt when `spawnedObjects` or `removedObjects` change:

```typescript
useEffect(() => {
  // Dispose old apartment
  const oldApartment = scene.getTransformNodeByName('apartment');
  if (oldApartment) {
    oldApartment.dispose();
  }

  // Create updated apartment
  createApartment({
    scene,
    spawnedObjects: gameState.spawnedObjects,
    removedObjects: gameState.removedObjects,
    horrorLevel: gameState.horrorLevel,
  });
}, [gameState.spawnedObjects, gameState.removedObjects, gameState.horrorLevel]);
```

## Material Conventions

All materials created via helper:
```typescript
const createMat = (name: string, color: Color3, specular = 0.1) => {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(specular, specular, specular);
  return mat;
};
```

## Future Enhancements

### Potential Additions
- Bathroom door (opens to reveal horrors)
- Kitchen visible through doorway
- Ceiling with hanging fixtures
- More wall decorations (clock, mirror)
- Window with dynamic outdoor scene
- Fireplace with flickering light
