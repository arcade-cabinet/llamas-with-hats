# Effects & Atmosphere System

## Overview

The game uses a two-part system for visual and audio effects:

1. **EffectsManager** - Instant effects (camera shake, zoom, particles)
2. **AtmosphereManager** - Persistent mood (fog, lighting, ambient audio)

This separation allows instant dramatic effects while maintaining cohesive scene atmosphere.

---

## Atmosphere System

### Philosophy

Instead of a linear "horror level" (0-10), atmosphere uses named presets that coordinate multiple dimensions of mood:

- Fog density and color
- Ambient and accent lighting
- Background music
- Ambient sound effects
- Color grading

### Presets

| Preset | Description | Use Case |
|--------|-------------|----------|
| `cozy` | Warm lighting, gentle ambient, calm music | Safe areas, home |
| `uneasy` | Slightly desaturated, subtle tension | Something's not right |
| `tense` | Darker, more fog, heartbeat ambient | Building dread |
| `dread` | Heavy fog, ominous red lighting, drones | Full horror |
| `panic` | Flickering, red tint, frantic audio | Immediate danger |
| `absurd` | Over-the-top theatrical horror | Dark comedy beats |
| `neutral` | Reset/default | Transitions |

### JSON Definition

```json
{
  "id": "living_room",
  "atmosphere": {
    "preset": "cozy",
    "musicTrack": "apartment_calm",
    "ambientSounds": ["clock_tick", "creak"]
  },
  "triggers": [
    {
      "id": "creepy_corner",
      "type": "proximity",
      "action": {
        "type": "atmosphere",
        "params": { 
          "preset": "uneasy", 
          "duration": 2000,
          "type": "pulse"
        }
      }
    }
  ]
}
```

### Atmosphere Actions

From triggers or story beats:

```typescript
// Permanent transition
{ type: "atmosphere", params: { preset: "tense", duration: 3000 } }

// Temporary pulse (returns to base after duration)
{ type: "atmosphere", params: { preset: "dread", duration: 2000, type: "pulse" } }
```

### API

```typescript
import { getAtmosphereManager } from './systems/AtmosphereManager';

const atmosphere = getAtmosphereManager();

// Apply to Babylon scene
atmosphere.applyToScene(scene);

// Connect audio
atmosphere.setAudioManager({
  playMusic: (track, opts) => audioManager.playMusic(track, opts),
  stopMusic: (opts) => audioManager.stopMusic(opts),
  playSound: (id, opts) => audioManager.playSound(id, opts),
});

// Set preset with transition
atmosphere.setPreset('tense', 2000); // 2 second transition

// Temporary pulse
atmosphere.pulse('panic', 3000); // 3 second pulse

// Layer additional atmosphere
atmosphere.addLayer('blood_discovery', { 
  fogDensity: 0.05,
  accentLight: { enabled: true, color: [0.8, 0.1, 0.1], intensity: 0.5 }
}, 0.5); // 50% blend

// Remove layer
atmosphere.removeLayer('blood_discovery', 1000); // 1 second fade

// Update each frame
atmosphere.update(deltaTime);
```

### Preset Details

Each preset defines:

```typescript
interface AtmosphereState {
  preset: AtmospherePreset;
  
  // Fog
  fogDensity: number;        // 0.005 (light) to 0.04 (heavy)
  fogColor: [r, g, b];       // RGB 0-1
  
  // Lighting
  ambientIntensity: number;  // 0-1
  ambientColor: [r, g, b];
  accentLight: {
    enabled: boolean;
    color: [r, g, b];
    intensity: number;
  };
  
  // Audio
  musicTrack: string | null;
  musicVolume: number;       // 0-1
  ambientSounds: string[];   // Sound IDs to play randomly
  ambientVolume: number;
  
  // Color grading (future)
  colorGrade: {
    saturation: number;      // 0-1
    brightness: number;      // 0-1
    tint: [r, g, b];
  };
  
  particleEffects: string[]; // e.g., 'dust', 'fog_wisps'
}
```

---

## Effects Manager

### Purpose

Handles instant, one-shot effects that don't persist:

- Camera shake
- Dramatic zoom
- Particle bursts

### Camera Shake

Triggered by story beats, interactions, or game events.

```typescript
effects.shakeCamera(intensity, duration);
// intensity: 0.1 (subtle) to 0.3 (violent), default 0.15
// duration: milliseconds, default 500
```

Implementation uses position-based animation (works with UniversalCamera):

```typescript
// Generate keyframes with decaying random offsets
for (let i = 0; i <= frames; i++) {
  const decay = 1 - i / frames;
  const offset = new Vector3(
    (Math.random() - 0.5) * intensity * decay,
    (Math.random() - 0.5) * intensity * 0.5 * decay,  // Less vertical
    (Math.random() - 0.5) * intensity * decay
  );
  keys.push({ frame: i, value: basePosition.add(offset) });
}
```

### Dramatic Zoom

Zooms camera in then back out.

```typescript
effects.zoomCamera(zoomFactor, zoomInDuration, holdDuration);
// zoomFactor: 0.6 = 40% closer, default 0.6
// zoomInDuration: ms to zoom in, default 500
// holdDuration: ms to hold before zooming out, default 0
```

Implementation uses FOV animation:

```typescript
animation.setKeys([
  { frame: 0, value: startFOV },
  { frame: zoomInFrames, value: startFOV * zoomFactor },
  { frame: zoomInFrames + holdFrames, value: startFOV * zoomFactor },
  { frame: totalFrames, value: startFOV },
]);
```

### Blood Splatter

Particle burst with dark comedy cleanup sparkles.

```typescript
effects.spawnBloodSplatter(position);
// Spawns blood particles, then sparkles 1 second later
```

Configuration:
| Property | Value |
|----------|-------|
| Capacity | 100 particles |
| Emit Rate | 50/sec |
| Lifetime | 0.3 - 1.0 sec |
| Colors | Red → Dark Red → Transparent |
| Gravity | -9.8 (falls down) |

### Sparkles

Cleanup effect (dark comedy juxtaposition).

```typescript
effects.spawnSparkles(position);
```

Configuration:
| Property | Value |
|----------|-------|
| Capacity | 50 particles |
| Emit Rate | 30/sec |
| Lifetime | 0.5 - 1.5 sec |
| Colors | Yellow → Golden → White |
| Gravity | -2 (slow fall) |

---

## Integration with GameRenderer

### Initialization

```typescript
// In GameRenderer useEffect:

// Effects for instant actions
const effectsManager = createEffectsManager(scene, camera);
effectsManagerRef.current = effectsManager;

// Atmosphere for persistent mood
const atmosphereManager = getAtmosphereManager();
atmosphereManager.applyToScene(scene);
atmosphereManager.setAudioManager({ playMusic, stopMusic, playSound });
atmosphereManager.setPreset(initialPreset, 0); // Instant set
```

### Game Loop

```typescript
engine.runRenderLoop(() => {
  // ... game logic ...
  
  // Update effects (animations self-manage)
  effectsManager.update(dt);
  
  // Update atmosphere (fog transitions, etc.)
  atmosphereManager.update(dt);
  
  scene.render();
});
```

### Story Callbacks

```typescript
storyManager.setCallbacks({
  onEffect: (effectType, params) => {
    switch (effectType) {
      case 'screen_shake':
        effectsManager.shakeCamera(params.intensity, params.duration);
        break;
      case 'blood_splatter':
        effectsManager.spawnBloodSplatter(new Vector3(params.x, params.y, params.z));
        break;
      case 'dramatic_zoom':
        effectsManager.zoomCamera(params.factor, params.duration, params.hold);
        break;
      case 'atmosphere':
        atmosphereManager.setPreset(params.preset, params.duration);
        break;
      case 'atmosphere_pulse':
        atmosphereManager.pulse(params.preset, params.duration);
        break;
    }
  }
});
```

### React Props

```typescript
// GameRenderer props for external triggers:
interface GameRendererProps {
  screenShake?: boolean;      // Triggers shake when true
  bloodSplatter?: boolean;    // Triggers particles when true
  dramaticZoom?: boolean;     // Triggers zoom when true
  atmospherePreset?: AtmospherePreset;  // Changes atmosphere
}
```

---

## Audio Integration

Atmosphere automatically controls audio through the connected AudioManager:

```typescript
// When preset changes:
if (newPreset.musicTrack !== currentPreset.musicTrack) {
  if (newPreset.musicTrack) {
    audioManager.playMusic(newPreset.musicTrack, { 
      volume: newPreset.musicVolume,
      fadeIn: transitionDuration 
    });
  } else {
    audioManager.stopMusic({ fadeOut: transitionDuration });
  }
}

// Ambient sounds play randomly:
setInterval(() => {
  const sound = randomPick(currentPreset.ambientSounds);
  audioManager.playSound(sound, { volume: currentPreset.ambientVolume });
}, 4000 + random() * 4000);
```

---

## Adding New Effects

### New Particle Effect

1. Add to EffectsManager:
```typescript
function createNewParticleSystem(position: Vector3): ParticleSystem {
  const ps = new ParticleSystem('newEffect', 100, scene);
  // Configure...
  ps.targetStopDuration = 1;
  ps.disposeOnStop = true;
  return ps;
}

// In return object:
spawnNewEffect(position: Vector3) {
  const ps = createNewParticleSystem(position);
  ps.start();
}
```

2. Add to story effect handler if needed.

### New Atmosphere Preset

Add to `ATMOSPHERE_PRESETS` in AtmosphereManager.ts:

```typescript
myNewPreset: {
  preset: 'myNewPreset',
  fogDensity: 0.02,
  fogColor: [0.1, 0.1, 0.15],
  ambientIntensity: 0.4,
  ambientColor: [0.7, 0.7, 0.9],
  accentLight: { enabled: true, color: [0.5, 0.5, 1.0], intensity: 0.3 },
  musicTrack: 'my_music_track',
  musicVolume: 0.5,
  ambientSounds: ['sound1', 'sound2'],
  ambientVolume: 0.4,
  colorGrade: { saturation: 0.9, brightness: 0.9, tint: [0.9, 0.9, 1.0] },
  particleEffects: ['dust'],
}
```

### New Camera Animation

Add method to EffectsManager:

```typescript
newCameraEffect(params) {
  if (isAnimating) return;
  isAnimating = true;
  
  const animation = new Animation(
    'newEffect',
    'propertyToAnimate',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  
  animation.setKeys([/* keyframes */]);
  
  camera.animations = [animation];
  scene.beginAnimation(camera, 0, endFrame, false, 1, () => {
    isAnimating = false;
  });
}
```
