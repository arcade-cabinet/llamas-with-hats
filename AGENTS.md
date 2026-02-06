# AGENTS.md - LlamasWithHatsGame

## Project Overview

**LlamasWithHatsGame** is an interactive 3D browser experience that recreates the absurd, dark-comedy roommate dynamic from the "Llamas with Hats" YouTube series. Built with Vite + React + TypeScript + Babylon.js.

## Tech Stack

- **Build Tool**: Vite 6.x with React plugin
- **Framework**: React 18.x with TypeScript
- **3D Engine**: Babylon.js 7.x (@babylonjs/core, @babylonjs/gui, @babylonjs/loaders)
- **Declarative 3D**: Reactylon 3.x with babel-plugin-reactylon for JSX transforms
- **VR Support**: WebXR via Babylon.js

## Project Structure

```
repo/
├── index.html                 # Entry HTML with viewport setup
├── package.json               # Dependencies and scripts
├── vite.config.ts             # Vite config with Reactylon babel plugin
├── tsconfig.json              # TypeScript configuration
├── AGENTS.md                  # This file
├── docs/                      # Game documentation
│   ├── architecture.md        # System architecture
│   ├── characters.md          # Character design & behavior
│   ├── dialogue-system.md     # Dialogue mechanics
│   ├── scene-design.md        # 3D environment design
│   ├── effects-system.md      # Visual effects & particles
│   └── controls-vr.md         # Controls & VR support
└── src/
    ├── main.tsx               # React entry point
    ├── App.tsx                # Root component, game orchestration
    ├── components/
    │   ├── BabylonScene.tsx   # Main 3D scene controller
    │   ├── Llama.tsx          # Llama character factory
    │   ├── SceneSetup.tsx     # Lighting & atmosphere
    │   ├── StartMenu.tsx      # Title screen overlay
    │   ├── DialogueOverlay.tsx # Typewriter dialogue UI
    │   └── HUD.tsx            # Horror meter & controls
    ├── scenes/
    │   └── ApartmentScene.tsx # Living room environment
    ├── hooks/
    │   └── useGameState.ts    # Central game state management
    ├── data/
    │   └── dialogues.ts       # Dialogue content & actions
    └── types/
        └── reactylon.d.ts     # TypeScript declarations
```

## Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev --host 0.0.0.0 --port 8080

# Type check
pnpm exec tsc --noEmit

# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Lint
pnpm run lint
```

## Key Files

### Entry Points
- `src/main.tsx` - Renders `<App />` into DOM
- `src/App.tsx` - Manages game state, renders scene + UI overlays

### 3D Scene
- `src/components/BabylonScene.tsx` - Creates Babylon.js Engine, Scene, Camera; handles click detection, VR setup
- `src/components/Llama.tsx` - `createLlama()` factory builds llama meshes from primitives
- `src/scenes/ApartmentScene.tsx` - `createApartment()` builds the room, furniture, dynamic objects
- `src/components/SceneSetup.tsx` - `setupLighting()` and `setupFog()` for atmosphere

### UI Overlays
- `src/components/StartMenu.tsx` - "Start the Horror" intro screen
- `src/components/DialogueOverlay.tsx` - Typewriter-animated dialogue boxes
- `src/components/HUD.tsx` - Horror meter, mute toggle, VR button

### State & Data
- `src/hooks/useGameState.ts` - `useGameState()` hook manages all game state
- `src/data/dialogues.ts` - Array of `DialoguePair` objects with actions

## Game Flow

1. **Start Menu** - User clicks "Start the Horror"
2. **Scene Loads** - Apartment renders with Carl and Paul
3. **Interaction Loop**:
   - User clicks Carl
   - `triggerNextDialogue()` advances dialogue index
   - Dialogue displays with typewriter effect
   - Actions trigger (spawn/remove objects, effects)
   - Horror level increases
   - Scene updates (lighting darkens, blood stains appear)
4. **Escalation** - Each interaction increases tension through visual/audio cues

## State Shape

```typescript
interface GameState {
  isStarted: boolean;
  isMuted: boolean;
  currentDialogueIndex: number;
  currentDialogue: DialoguePair | null;
  isDialogueActive: boolean;
  spawnedObjects: string[];      // Objects added to scene
  removedObjects: string[];      // Objects removed from scene
  screenShake: boolean;
  bloodSplatter: boolean;
  dramaticZoom: boolean;
  horrorLevel: number;           // 0-10
}
```

## Adding Content

### New Dialogue
Edit `src/data/dialogues.ts`:
```typescript
{
  carl: "I reorganized the basement.",
  paul: "We don't HAVE a basement, Carl!",
  action: 'screen_shake'
}
```

### New Spawnable Objects
1. Add object type to `dialogues.ts` with `action: 'spawn_object'`
2. Add mesh creation in `ApartmentScene.tsx` under `// SPAWNED OBJECTS`

### New Effects
1. Add action type to `DialoguePair` interface
2. Handle in `useGameState.ts` state update
3. Implement visual in `BabylonScene.tsx` or `App.tsx`

## Performance Notes

- Meshes use `StandardMaterial` for simplicity
- Particle systems auto-dispose after duration
- Scene rebuilds on object changes (could optimize with mesh pooling)
- Shadow generator limited to 1024px for performance

## Browser Support

- Modern browsers with WebGL 2.0
- WebXR VR on compatible devices (Quest, etc.)
- Mobile touch controls work via Babylon.js defaults
