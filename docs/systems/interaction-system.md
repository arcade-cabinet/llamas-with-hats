# Interaction System

The interaction system handles player interactions with objects in the game world.

## Interaction Model

Interactions are triggered by **direct click/tap** on objects:

| Platform | Method |
|----------|--------|
| Desktop | Click on object with mouse |
| Mobile | Tap on object |
| Keyboard | Press E when near object (fallback) |

No dedicated interaction buttons are needed on mobile.

## Architecture

```
Player clicks/taps
       ↓
Babylon.js raycasts from pointer
       ↓
Check mesh.metadata.interactive
       ↓
Get propType from metadata
       ↓
InteractionSystem.interactWithProp()
       ↓
Load dialogue from data
       ↓
Display in GameView
```

## Raycasting Setup

In GameRenderer, props are tagged with metadata:

```typescript
mesh.metadata = {
  interactive: true,
  propType: 'couch',
  isPickable: true
};
mesh.isPickable = true;
```

Pointer events trigger raycasting:

```typescript
scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type !== PointerEventTypes.POINTERUP) return;
  
  const pickResult = scene.pick(scene.pointerX, scene.pointerY);
  
  if (pickResult?.hit && pickResult.pickedMesh) {
    const mesh = pickResult.pickedMesh;
    
    if (mesh.metadata?.interactive) {
      const propType = mesh.metadata.propType;
      interactionSystem.interactWithProp(propType, character, horrorLevel);
    }
  }
});
```

## InteractionSystem API

```typescript
interface InteractionSystem {
  // Update player position for proximity detection
  update(playerX: number, playerZ: number): InteractionState;
  
  // Interact with nearest prop (E key fallback)
  interact(character: 'carl' | 'paul', horrorLevel?: number): boolean;
  
  // Interact with specific prop (click/tap)
  interactWithProp(propType: string, character: 'carl' | 'paul', horrorLevel?: number): boolean;
  
  // Trigger story dialogue
  checkStoryTrigger(beatId: string, character: 'carl' | 'paul'): void;
  
  // Configuration
  setCollisionSystem(system: CollisionSystem): void;
  setCallbacks(callbacks: InteractionCallbacks): void;
  getState(): InteractionState;
}
```

## Dialogue Loading

Dialogue is loaded from JSON data:

```typescript
function interactWithProp(propType, character, horrorLevel) {
  // Get dialogue from data module
  const dialogue = getPropDialogue(propType);
  const lines = character === 'carl' ? dialogue.carl : dialogue.paul;
  
  // Add horror lines if horror level is high
  if (horrorLevel >= 3 && dialogue.horror) {
    lines.push(...dialogue.horror);
  }
  
  callbacks.onDialogue(lines, character);
}
```

## Dialogue Data Structure

```json
{
  "dialogues": {
    "couch": {
      "carl": ["It's our couch. Paul sometimes hides things in the cushions."],
      "paul": ["The couch! Perfect for afternoon naps. And hiding snacks."],
      "horror": ["There's something sticky between the cushions..."],
      "prompt": "Examine couch"
    }
  }
}
```

## Horror Level Effects

Horror level affects dialogue:

| Level | Effect |
|-------|--------|
| 0-2 | Normal dialogue only |
| 3+ | Horror lines appended |
| 5+ | Atmospheric effects (TODO) |
| 7+ | Visual distortions (TODO) |

## Proximity Detection (E Key)

For keyboard fallback, proximity is checked each frame:

```typescript
const INTERACTION_RANGE = 1.5;

function update(playerX, playerZ) {
  const nearest = collisionSystem.findNearestInteractable(
    playerX, playerZ, INTERACTION_RANGE
  );
  
  if (nearest) {
    return {
      nearbyInteractable: nearest,
      canInteract: true,
      interactPrompt: getInteractPrompt(nearest.type)
    };
  }
  
  return { canInteract: false };
}
```

## Callbacks

```typescript
interface InteractionCallbacks {
  onDialogue: (lines: string[], speaker: 'carl' | 'paul') => void;
  onItemPickup?: (itemId: string) => void;
  onHorrorIncrease?: (amount: number) => void;
  onUnlock?: (lockId: string) => void;
  onQuestProgress?: (questId: string, progress: number) => void;
}
```

## Usage Example

```typescript
// Setup
const interactionSystem = createInteractionSystem();
interactionSystem.setCollisionSystem(collisionSystem);
interactionSystem.setCallbacks({
  onDialogue: (lines, speaker) => {
    setDialogueLines(lines);
    setDialogueSpeaker(speaker);
    setShowDialogue(true);
  },
  onHorrorIncrease: (amount) => {
    setHorrorLevel(prev => prev + amount);
  }
});

// In pointer handler (click/tap)
scene.onPointerObservable.add((info) => {
  if (info.type === PointerEventTypes.POINTERUP) {
    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (pick?.pickedMesh?.metadata?.interactive) {
      interactionSystem.interactWithProp(
        pick.pickedMesh.metadata.propType,
        playerCharacter,
        horrorLevel
      );
    }
  }
});

// E key fallback (keyboard only)
if (inputMode === 'keyboard' && keyPressed === 'e') {
  interactionSystem.interact(playerCharacter, horrorLevel);
}
```

## Story Beats

Story dialogues can override prop dialogues:

```typescript
// In story.json
{
  "storyBeats": {
    "discover_blood": {
      "carl": ["PAUL! Why is there blood on the ceiling?!"],
      "paul": ["Oh, the kitchen! I was doing some redecorating."],
      "effects": [
        { "type": "horror_increase", "amount": 2 },
        { "type": "unlock", "target": "basement_door" }
      ]
    }
  }
}
```

Triggered by:
- Entering a scene
- Picking up an item
- Reaching a location
- Time elapsed
