# Character Design & Behavior

## Overview

The game features two llama characters that embody the comedic dynamic from the source material: Carl, the deadpan perpetrator, and Paul, the horrified observer.

## Carl

### Visual Design
- **Body Color**: Gray (`Color3(0.5, 0.5, 0.55)`)
- **Hat**: Green top hat (`Color3(0.2, 0.5, 0.2)`)
- **Position**: Left side of room (`Vector3(-1.5, 0, 0)`)
- **Rotation**: Angled toward center (`Math.PI / 4`)

### Personality
- Deadpan delivery
- Casually describes horrific actions
- Shows no remorse or awareness of wrongdoing
- Helpful tone masking disturbing content

### Behavior
- **Clickable**: Primary interaction target
- **Idle Animation**: Subtle head bob (0.03 units, 2-second cycle)
- **Hat Animation**: Gentle wobble (±0.05 radians)
- **Click Target**: Invisible bounding box for reliable hit detection

### Mesh Composition
```
TransformNode "carl"
├── Capsule "carl-body" (main torso, tilted)
├── Cylinder "carl-neck" (angled forward)
├── Sphere "carl-head" (scaled for elongation)
├── Cylinder "carl-snout"
├── Cylinder "carl-leftEar"
├── Cylinder "carl-rightEar"
├── Sphere "carl-leftEye"
├── Sphere "carl-rightEye"
├── Cylinder "carl-leg0..3" (four legs)
├── Cylinder "carl-hoof0..3" (four hooves)
├── Cylinder "carl-hatBase" (hat brim)
├── Cylinder "carl-hatTop" (hat crown)
├── Cylinder "carl-tail"
└── Box "carl-clickTarget" (invisible, isPickable=true)
```

## Paul

### Visual Design
- **Body Color**: Beige (`Color3(0.95, 0.9, 0.75)`)
- **Hat**: Red top hat with pink flower (`Color3(0.7, 0.2, 0.2)`)
- **Flower**: Pink sphere (`Color3(1, 0.4, 0.6)`)
- **Position**: Right side of room (`Vector3(1.5, 0, 0.5)`)
- **Rotation**: Facing Carl (`-Math.PI / 3`)

### Personality
- Increasingly horrified reactions
- Voice of reason (ignored)
- Exasperated, disbelieving
- Tries to maintain normalcy

### Behavior
- **Non-clickable**: Passive observer
- **Idle Animation**: Same head bob as Carl
- **Hat Animation**: Same wobble as Carl
- **Future Enhancement**: Could add shock animations on events

### Mesh Composition
```
TransformNode "paul"
├── [Same structure as Carl]
├── Cylinder "paul-hatBase"
├── Cylinder "paul-hatTop"
└── Sphere "paul-flower" (unique to Paul)
```

## Llama Factory Function

### Signature
```typescript
interface LlamaProps {
  scene: Scene;
  name: string;
  position: Vector3;
  isCarl: boolean;
  onClick?: () => void;
}

function createLlama(props: LlamaProps): TransformNode
```

### Color Logic
```typescript
const bodyColor = isCarl 
  ? new Color3(0.5, 0.5, 0.55)   // Gray
  : new Color3(0.95, 0.9, 0.75); // Beige

const hatColor = isCarl
  ? new Color3(0.2, 0.5, 0.2)    // Green
  : new Color3(0.7, 0.2, 0.2);   // Red
```

### Animation Setup
```typescript
// Head bob animation
const headBobAnim = new Animation(
  `${name}-headBob`,
  'position.y',
  30,  // FPS
  Animation.ANIMATIONTYPE_FLOAT,
  Animation.ANIMATIONLOOPMODE_CYCLE
);

// Keyframes: original → +0.03 → original
headBobAnim.setKeys([
  { frame: 0, value: head.position.y },
  { frame: 30, value: head.position.y + 0.03 },
  { frame: 60, value: head.position.y },
]);

scene.beginAnimation(head, 0, 60, true);
```

## Character Dimensions

### Body Proportions
| Part | Dimensions |
|------|------------|
| Body | Capsule: height=1.2, radius=0.35 |
| Neck | Cylinder: height=0.8, diameter=0.25 |
| Head | Sphere: diameter=0.4, scaling=(1, 1.3, 0.9) |
| Snout | Cylinder: height=0.25, diameters=0.12/0.15 |
| Ears | Cylinder: height=0.2, diameters=0.02/0.08 |
| Eyes | Sphere: diameter=0.06 |
| Legs | Cylinder: height=0.6, diameter=0.1 |
| Hooves | Cylinder: height=0.08, diameter=0.12 |
| Hat Base | Cylinder: height=0.08, diameter=0.5 |
| Hat Top | Cylinder: height=0.3, diameter=0.28 |
| Tail | Cylinder: height=0.15, diameters=0.02/0.06 |

### Position Offsets (from root)
| Part | Position |
|------|----------|
| Body | (0, 0.8, 0) |
| Neck | (0.3, 1.3, 0) |
| Head | (0.55, 1.75, 0) |
| Snout | (0.75, 1.65, 0) |
| Left Ear | (0.5, 2.0, 0.12) |
| Right Ear | (0.5, 2.0, -0.12) |
| Left Eye | (0.68, 1.82, 0.1) |
| Right Eye | (0.68, 1.82, -0.1) |
| Hat Base | (0.5, 2.05, 0) |
| Hat Top | (0.5, 2.25, 0) |
| Flower (Paul) | (0.6, 2.35, 0.1) |

## Future Enhancements

### Planned Animations
- **Carl "Action" Animation**: Subtle head tilt when speaking
- **Paul "Shock" Animation**: Jump back, ears flatten
- **Walking Cycles**: For scene transitions
- **Exaggerated Reactions**: Paul's increasing distress

### Model Replacement
The primitive-based llamas can be replaced with .glb models:
```typescript
// In createLlama(), optionally load model
const result = await SceneLoader.ImportMeshAsync(
  "",
  "/models/",
  isCarl ? "carl.glb" : "paul.glb",
  scene
);
```

### Lip Sync (Advanced)
Could add mouth movement synced to dialogue length:
```typescript
const mouthOpenAnim = new Animation(/*...*/);
// Trigger when dialogue plays
```
