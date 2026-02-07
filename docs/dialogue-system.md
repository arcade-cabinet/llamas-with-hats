# Dialogue System

## Overview

The dialogue system presents alternating lines between Carl and Paul in a typewriter-animated overlay, with each exchange triggering game events.

## Data Structure

### DialoguePair Interface
```typescript
interface DialoguePair {
  carl: string;                    // Carl's line (displayed first)
  paul: string;                    // Paul's reaction (displayed after delay)
  action?: DialogueAction;         // Optional effect trigger
  objectType?: string;             // Object to spawn/remove
}

type DialogueAction = 
  | 'spawn_object'      // Add object to scene
  | 'remove_object'     // Remove object from scene
  | 'blood_splatter'    // Trigger blood particle effect
  | 'screen_shake'      // Shake camera
  | 'dramatic_zoom';    // Zoom camera toward center
```

### Dialogue Array
Located in `src/data/dialogues.ts`:

```typescript
export const dialogues: DialoguePair[] = [
  {
    carl: "I made us some dinner, Paul.",
    paul: "That's... actually nice of you, Carl. Wait, what is this?",
    action: 'spawn_object',
    objectType: 'table_food'
  },
  // ... 13 more dialogues
];
```

## Current Dialogue Content

| # | Carl Says | Paul Reacts | Action | Object |
|---|-----------|-------------|--------|--------|
| 1 | "I made us some dinner, Paul." | "That's... actually nice of you, Carl. Wait, what is this?" | spawn_object | table_food |
| 2 | "I cleaned up the living room." | "Wait... where's the couch cushion? And why is it damp?" | remove_object | cushion |
| 3 | "I took care of that noise problem." | "Carl... what did you do? There's a box dripping something." | spawn_object | suspicious_box |
| 4 | "The floor needed some... redecorating." | "Why is everything sticky?! This looks like... no. No no no." | blood_splatter | - |
| 5 | "I found a new hat, Paul. Look at it." | "Carl, that's not a hat. That's a traffic cone. Where did you even..." | spawn_object | cone_hat |
| 6 | "I made a friend today." | "Why do I hear rattling from the bathroom? Carl? CARL?!" | screen_shake | - |
| 7 | "The cat was asking too many questions." | "Cats don't ASK QUESTIONS, Carl! Where is Mr. Whiskers?!" | remove_object | cat |
| 8 | "I improved the garden." | "Those aren't tulips, Carl. Those are... I need to sit down." | dramatic_zoom | - |
| 9 | "Dinner is ready. I made your favorite." | "I don't have a favorite that looks like THAT." | spawn_object | mystery_meat |
| 10 | "I organized your sock drawer." | "Those aren't socks. Why do they have fingernails?!" | screen_shake | - |
| 11 | "I was hungry." | "That doesn't explain the screaming I heard earlier!" | blood_splatter | - |
| 12 | "I got us a boat." | "Carl, we live in an apartment. In a desert." | dramatic_zoom | - |
| 13 | "I fixed the sink." | "Why is it making gurgling sounds? Is that... moaning?" | screen_shake | - |
| 14 | "I decorated for the holidays." | "Carl, those aren't ornaments. Those are... I can't do this anymore." | blood_splatter | - |

## Dialogue Flow

### Trigger Sequence
```
1. User clicks Carl
2. handleCarlClick() checks !isDialogueActive
3. triggerNextDialogue() called
4. State updates:
   - currentDialogueIndex++
   - currentDialogue = dialogues[index % length]
   - isDialogueActive = true
   - Process action (spawn/remove/effects)
   - horrorLevel++ (capped at 10)
5. DialogueOverlay renders with new dialogue
6. Typewriter animation starts
```

### Typewriter Animation
```typescript
// Carl's text appears first
let carlIndex = 0;
const carlInterval = setInterval(() => {
  if (carlIndex < dialogue.carl.length) {
    setCarlText(dialogue.carl.slice(0, carlIndex + 1));
    carlIndex++;
  } else {
    clearInterval(carlInterval);
    // After 800ms delay, start Paul's text
    setTimeout(() => {
      setShowPaul(true);
      // Similar interval for Paul...
    }, 800);
  }
}, 50); // 50ms per character = 20 chars/second
```

### Character Timing
- **Carl Speed**: 50ms per character (~20 chars/sec)
- **Paul Delay**: 800ms after Carl finishes
- **Paul Speed**: 40ms per character (~25 chars/sec)
- **Dismiss**: Click anywhere to close

## UI Presentation

### DialogueOverlay Component
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Carl 🎩                                          │   │
│  │                                                  │   │
│  │ "I made us some dinner, Paul.|"                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Paul 🌸                                          │   │
│  │                                                  │   │
│  │ "That's... actually nice of you, Carl.|"        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│              Click anywhere to continue...              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Visual Styling
- **Background**: Gradient from transparent to semi-opaque black
- **Boxes**: Dark brown (`rgba(20, 15, 10, 0.95)`) with colored borders
- **Carl Border**: Green, shifts redder with horror level
- **Paul Border**: Brown/orange, shifts redder with horror level
- **Text**: Georgia serif font, light gray (#e0e0e0)
- **Cursor**: Blinking pipe character (|)

### Horror Level Effects
```typescript
const bloodTint = Math.min(horrorLevel * 10, 80);

// Carl's border shifts from green to blood-red
borderColor: `rgb(${60 + bloodTint}, 100, 60)`

// Paul's border shifts darker
borderColor: `rgb(${139 + bloodTint}, ${69 - bloodTint / 2}, 19)`
```

## State Management

### In useGameState.ts
```typescript
const triggerNextDialogue = useCallback(() => {
  setState(prev => {
    const nextIndex = prev.currentDialogueIndex + 1;
    const dialogue = dialogues[nextIndex % dialogues.length];
    
    // Process spawn/remove actions
    let newSpawned = [...prev.spawnedObjects];
    let newRemoved = [...prev.removedObjects];
    
    if (dialogue.action === 'spawn_object' && dialogue.objectType) {
      newSpawned.push(dialogue.objectType);
    }
    if (dialogue.action === 'remove_object' && dialogue.objectType) {
      newRemoved.push(dialogue.objectType);
    }

    return {
      ...prev,
      currentDialogueIndex: nextIndex,
      currentDialogue: dialogue,
      isDialogueActive: true,
      spawnedObjects: newSpawned,
      removedObjects: newRemoved,
      screenShake: dialogue.action === 'screen_shake',
      bloodSplatter: dialogue.action === 'blood_splatter',
      dramaticZoom: dialogue.action === 'dramatic_zoom',
      horrorLevel: Math.min(10, prev.horrorLevel + 1),
    };
  });

  // Auto-reset effect flags after 1.5 seconds
  setTimeout(() => {
    setState(prev => ({
      ...prev,
      screenShake: false,
      bloodSplatter: false,
      dramaticZoom: false,
    }));
  }, 1500);
}, []);
```

## Adding New Dialogues

### Simple Addition
```typescript
// In dialogues.ts
{
  carl: "I helped the mailman.",
  paul: "Why is there a uniform in the fireplace?!",
  action: 'screen_shake'
}
```

### With New Object Type
1. Add dialogue with new objectType:
```typescript
{
  carl: "I found a pet.",
  paul: "That's a raccoon and it's covered in... something.",
  action: 'spawn_object',
  objectType: 'suspicious_raccoon'
}
```

2. Handle in ApartmentScene.tsx:
```typescript
if (spawnedObjects.includes('suspicious_raccoon')) {
  // Create raccoon mesh...
}
```

## Looping Behavior

Dialogues loop infinitely using modulo:
```typescript
const dialogue = dialogues[nextIndex % dialogues.length];
```

After all 14 dialogues play, it returns to #1 while horror level remains at 10.
