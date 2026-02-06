# Architecture Overview

## System Design

LlamasWithHatsGame follows a layered architecture separating concerns between React UI, Babylon.js 3D rendering, and game state management.

```
┌─────────────────────────────────────────────────────────┐
│                      React Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐│
│  │  StartMenu  │ │  HUD        │ │  DialogueOverlay    ││
│  └─────────────┘ └─────────────┘ └─────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    App.tsx (Orchestrator)                │
│  - Manages game state via useGameState()                │
│  - Passes callbacks to child components                  │
│  - Conditionally renders overlays                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  BabylonScene.tsx                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Babylon.js Engine + Scene                        │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │
│  │  │ Camera     │ │ Lighting   │ │ WebXR        │  │   │
│  │  └────────────┘ └────────────┘ └──────────────┘  │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │           ApartmentScene                    │  │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────────────┐  │  │   │
│  │  │  │ Floor  │ │ Walls  │ │ Furniture      │  │  │   │
│  │  │  └────────┘ └────────┘ └────────────────┘  │  │   │
│  │  │  ┌────────────────────────────────────┐    │  │   │
│  │  │  │ Dynamic Objects (spawn/remove)     │    │  │   │
│  │  │  └────────────────────────────────────┘    │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────┐     │   │
│  │  │           Llama Characters              │     │   │
│  │  │  ┌────────────┐    ┌────────────┐      │     │   │
│  │  │  │   Carl     │    │   Paul     │      │     │   │
│  │  │  └────────────┘    └────────────┘      │     │   │
│  │  └─────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  useGameState.ts                         │
│  - Central state store                                   │
│  - Action dispatchers                                    │
│  - Effect triggers                                       │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Click on Carl
       │
       ▼
BabylonScene.onPointerDown()
       │
       ▼
App.handleCarlClick()
       │
       ▼
useGameState.triggerNextDialogue()
       │
       ├──► Update currentDialogue
       ├──► Update spawnedObjects/removedObjects
       ├──► Set effect flags (screenShake, etc.)
       ├──► Increment horrorLevel
       │
       ▼
React Re-render
       │
       ├──► DialogueOverlay shows new dialogue
       ├──► HUD updates horror meter
       ├──► BabylonScene useEffect triggers:
       │    ├── Camera shake animation
       │    ├── Particle effects
       │    └── Scene rebuild with new objects
       │
       ▼
Effect cleanup (setTimeout resets flags)
```

## Component Responsibilities

### App.tsx
- **Role**: Application shell and state orchestrator
- **Responsibilities**:
  - Initialize game state hook
  - Handle user interactions (Carl clicks, dialogue dismissal)
  - Manage VR callback state
  - Render conditional overlays (start menu, effects)
  - Inject CSS keyframe animations

### BabylonScene.tsx
- **Role**: 3D rendering controller
- **Responsibilities**:
  - Create and manage Babylon.js Engine/Scene lifecycle
  - Setup ArcRotateCamera with constraints
  - Initialize lighting via SceneSetup
  - Create llama characters via Llama factory
  - Create apartment via ApartmentScene factory
  - Handle pointer events for interaction
  - Setup WebXR for VR support
  - Trigger camera animations (shake, zoom)
  - Respond to game state changes (rebuild scene)

### useGameState.ts
- **Role**: Centralized state management
- **Responsibilities**:
  - Store all game state in single object
  - Provide action functions (startGame, toggleMute, etc.)
  - Process dialogue actions (spawn/remove objects)
  - Manage effect timing (auto-reset after delay)

## Module Boundaries

### Pure Functions (No Side Effects)
- `createLlama()` - Returns TransformNode
- `createApartment()` - Returns TransformNode
- `setupLighting()` - Returns light objects
- `setupFog()` - Configures scene fog

### Stateful Components
- `App` - Game state via hook
- `BabylonScene` - Scene refs, animation state
- `DialogueOverlay` - Typewriter animation state

### Static Data
- `dialogues.ts` - Immutable dialogue array

## Extension Points

### Adding New Object Types
1. Define in `dialogues.ts` action
2. Create mesh in `ApartmentScene.tsx`
3. No changes needed to state management

### Adding New Effects
1. Add flag to `GameState` interface
2. Set flag in `triggerNextDialogue()`
3. Handle in `BabylonScene.tsx` useEffect
4. Reset in timeout

### Adding New Characters
1. Extend `createLlama()` with new options
2. Add to scene in `BabylonScene.tsx`
3. Add dialogue lines as needed
