# Llamas With Hats RPG - Documentation

A dark comedy RPG built with React, Babylon.js, and a data-driven architecture.

## Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
│
├── architecture/                # System design & architecture
│   ├── overview.md              # High-level architecture
│   ├── data-driven-design.md    # DDL/JSON data approach
│   └── coordinate-system.md     # World coordinates & navigation
│
├── systems/                     # Core game systems
│   ├── stage-builder.md         # Procedural stage generation
│   ├── input-controller.md      # Unified input handling
│   ├── interaction-system.md    # Click/tap interactions
│   ├── vertical-transitions.md  # Stairs, ramps, floor connections
│   └── prop-factory.md          # Data-driven prop creation
│
├── audio-system.md              # Procedural audio with Tone.js
├── effects-system.md            # Visual effects & atmosphere
├── dialogue-system.md           # Character dialogue
│
├── data/                        # Data file documentation
│   ├── structure.md             # Directory structure & organization
│   ├── game-definition.md       # game.json schema
│   ├── stage-definition.md      # Stage JSON schema
│   ├── props.md                 # Props data format
│   └── dialogues.md             # Dialogue data format
│
├── dev/                         # Development tracking
│   ├── README.md                # Dev docs index
│   ├── DEVLOG.md                # Chronological history
│   ├── STATUS.md                # Implementation status
│   ├── GAPS.md                  # Known issues
│   ├── ROADMAP.md               # Planned work
│   └── DECISIONS.md             # Architecture decisions
│
└── guides/                      # How-to guides
    ├── adding-props.md          # How to add new props
    ├── adding-stages.md         # How to add new stages
    ├── adding-dialogues.md      # How to add dialogue
    └── mobile-controls.md       # Touch gesture system
```

## Quick Links

### For Designers/Writers
- [Data Structure](data/structure.md) - Where content lives
- [Adding Props](guides/adding-props.md) - Add new furniture/objects
- [Adding Dialogues](guides/adding-dialogues.md) - Write character dialogue
- [Adding Stages](guides/adding-stages.md) - Create new game areas

### For Developers
- [Architecture Overview](architecture/overview.md) - System design
- [Stage Builder](systems/stage-builder.md) - Procedural generation
- [Input Controller](systems/input-controller.md) - Keyboard/touch/gamepad
- [Interaction System](systems/interaction-system.md) - Click/tap to interact
- [Audio System](audio-system.md) - Procedural audio with Tone.js
- [Effects & Atmosphere](effects-system.md) - Visual effects and mood control

### Key Concepts

1. **Data-Driven Design**: All game content (props, dialogues, stages) is defined in JSON files, not code
2. **Procedural Generation**: Stages are built from templates with anchor rooms and filler
3. **Unified Input**: One system handles keyboard, touch gestures, and gamepad
4. **Click/Tap Interactions**: No buttons needed - click/tap objects directly
5. **Procedural Audio**: All sounds synthesized via Tone.js - no sample files needed
6. **Atmosphere Presets**: Named mood presets (cozy, tense, dread, etc.) control fog, lighting, and audio

## Development Tracking

- [Dev Log](dev/DEVLOG.md) - Chronological development history
- [Status](dev/STATUS.md) - Current implementation status
- [Gaps](dev/GAPS.md) - Known issues and missing features
- [Roadmap](dev/ROADMAP.md) - Planned work and priorities
- [Decisions](dev/DECISIONS.md) - Architecture decision records

## Tech Stack

- **React** - UI framework
- **Babylon.js** - 3D rendering engine
- **Tone.js** - Procedural audio synthesis
- **TypeScript** - Type-safe code
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Yuka** - AI navigation
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Core Systems Overview

### Audio System
Procedural sound synthesis - no audio files needed. Footsteps, doors, screams, ambient drones all generated in real-time. See [Audio System](audio-system.md).

### Atmosphere System
Named presets control the scene mood:
- **cozy** - Warm, safe feeling
- **uneasy** - Something's not quite right
- **tense** - Building dread
- **dread** - Full horror atmosphere
- **panic** - Immediate danger
- **absurd** - Dark comedy theatrical horror

Presets coordinate fog, lighting, music, and ambient sounds. See [Effects System](effects-system.md).

### Effects System
Instant visual effects:
- Camera shake
- Dramatic zoom
- Blood splatter particles
- Sparkle cleanup (dark comedy)

### Story System
Beat-based narrative progression:
- Triggers: scene_enter, item_pickup, npc_interact
- Consequences: dialogue, atmosphere change, unlocks, spawns
- Per-stage story data in JSON
