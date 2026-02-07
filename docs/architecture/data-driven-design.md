# Data-Driven Design

## Philosophy

The game separates **content** (what) from **code** (how):

| Content (JSON) | Code (TypeScript) |
|----------------|-------------------|
| Prop dimensions | Mesh creation logic |
| Dialogue lines | Dialogue display system |
| Room templates | Room generation algorithm |
| Stage story beats | Story progression system |

**Benefits:**
- Content creators edit JSON, not code
- No recompilation for content changes
- Clear separation of concerns
- Reusable content across stages
- Easy localization

## Data Hierarchy

```
src/data/
│
├── game.json                    # MASTER: Game-wide settings
│   ├── Character definitions
│   ├── Path definitions (order/chaos)
│   ├── Stage progression (linked list)
│   └── Global settings
│
├── global/                      # REUSABLE: Shared across stages
│   ├── props.json               # Prop mesh/material definitions
│   ├── palettes.json            # Material color palettes
│   ├── dialogues/
│   │   └── prop-dialogues.json  # Default prop interactions
│   └── templates/
│       └── rooms.json           # Room templates for generation
│
└── stages/                      # SPECIFIC: Per-stage content
    └── stageN/
        ├── definition.json      # Stage config & generation rules
        ├── dialogues/
        │   └── story.json       # Story beat dialogues
        └── scenes/
            └── *.json           # Hand-crafted scenes
```

## Override System

Stage-specific content **overrides** global content:

```
Request: getPropDialogue('couch', 'stage1_apartment')

1. Check stages/stage1/dialogues/story.json → propOverrides.couch
2. If found, use stage-specific dialogue
3. If not, fall back to global/dialogues/prop-dialogues.json
```

This allows:
- Default prop dialogue globally
- Special dialogue for specific stages
- Gradual horror escalation per stage

## Data Loading

### At Startup
```typescript
// Load once, cache forever
import gameData from './game.json';
import propsData from './global/props.json';
import propDialoguesData from './global/dialogues/prop-dialogues.json';
```

### Per Stage
```typescript
// Load when entering stage
async function loadStage(stageId: string) {
  const definition = await import(`./stages/${stageId}/definition.json`);
  const dialogues = await import(`./stages/${stageId}/dialogues/story.json`);
  return { definition, dialogues };
}
```

### Access Pattern
```typescript
import { getPropDefinition, getPropDialogue, getInteractPrompt } from '../data';

// Get prop mesh definition
const meshDef = getPropDefinition('couch');

// Get dialogue (checks stage overrides)
const dialogue = getPropDialogue('couch', currentStageId);

// Get interaction prompt
const prompt = getInteractPrompt('couch'); // "Examine couch"
```

## Schema Documentation

### Props Schema (`global/props.json`)

```json
{
  "props": {
    "propType": {
      "mesh": {
        "type": "box | cylinder | composite",
        "width": 1.0,
        "height": 1.0,
        "depth": 1.0,
        "yOffset": 0.5,
        "parts": []  // For composite meshes
      },
      "material": {
        "color": [0.35, 0.25, 0.15],
        "emissive": [0, 0, 0]
      },
      "collision": {
        "radius": 0.5
      }
    }
  },
  "defaultProp": { ... }
}
```

### Dialogues Schema (`global/dialogues/prop-dialogues.json`)

```json
{
  "dialogues": {
    "propType": {
      "carl": ["Line 1", "Line 2"],
      "paul": ["Line 1", "Line 2"],
      "horror": ["Scary line at high horror"],
      "prompt": "Examine propType"
    }
  },
  "defaultDialogue": {
    "carl": ["It's a {propType}. Nothing unusual."],
    "paul": ["A {propType}! How delightful!"],
    "prompt": "Examine {propType}"
  }
}
```

### Stage Definition Schema (`stages/stageN/definition.json`)

```json
{
  "id": "stage1_apartment",
  "name": "The Morning After",
  "description": "...",
  "path": "both | order | chaos",
  
  "story": {
    "beats": [...],
    "goals": [...],
    "startingBeat": "wake_up",
    "completionGoals": ["escape_apartment"]
  },
  
  "generation": {
    "entryScene": { "templateTags": [...], "purpose": "entry" },
    "exitScene": { "templateTags": [...], "purpose": "exit" },
    "requiredScenes": [...],
    "optionalSceneCount": { "min": 1, "max": 3 },
    "allowedTemplates": ["room_small", "hallway_short"],
    "connectionRules": {
      "type": "linear | branching | hub | maze",
      "maxDeadEnds": 2,
      "loopsAllowed": false
    },
    "environment": "interior | exterior | mixed",
    "separation": "wall_door | wall_archway | open"
  },
  
  "props": {
    "density": "sparse | normal | cluttered",
    "questItems": [...],
    "propPools": ["apartment_furniture"]
  },
  
  "atmosphere": {
    "baseHorrorLevel": 2,
    "horrorProgression": "static | increasing | wave"
  }
}
```

## Type Safety

All JSON data is typed via TypeScript interfaces:

```typescript
// src/data/index.ts
export interface PropDefinition {
  mesh: PropMeshDefinition;
  material: { color: [number, number, number] };
  collision: { radius: number };
}

export interface PropDialogue {
  carl: string[];
  paul: string[];
  horror?: string[];
  prompt: string;
}

// Type assertion on import
export const propDefinitions = propsData as unknown as PropsData;
```

## Adding Content

### New Prop
1. Add mesh definition to `global/props.json`
2. Add dialogue to `global/dialogues/prop-dialogues.json`
3. Use in room templates or stage definitions

### New Stage
1. Create `stages/stageN/` directory
2. Add `definition.json` with story/generation config
3. Add `dialogues/story.json` for stage-specific dialogue
4. Update `game.json` stage progression

### Stage-Specific Override
1. Open `stages/stageN/dialogues/story.json`
2. Add to `propOverrides` section:
```json
{
  "propOverrides": {
    "couch": {
      "carl": ["Stage-specific line..."],
      "paul": ["Different line..."]
    }
  }
}
```
