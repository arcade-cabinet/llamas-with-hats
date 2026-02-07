# Game Design Document - Llamas With Hats RPG

## Overview

A dark comedy RPG where players experience the absurdist horror-comedy of Carl and Paul's adventures from the Llamas with Hats web series. Players choose one llama and experience the story from their perspective while the AI controls the other.

---

## Story Structure

### Act 1: The Apartment
**Setting**: Carl and Paul's apartment
**Tone**: Domestic comedy meets horror discovery

| Stage | Name | Carl's Experience | Paul's Experience |
|-------|------|-------------------|-------------------|
| 1.1 | Morning After | Discovers something horrible happened | Cheerfully makes breakfast |
| 1.2 | The Kitchen | Finds suspicious stains | Wonders why Carl is upset |
| 1.3 | The Basement | Horror discovery | Proudly shows his "art project" |

### Act 2: The Town
**Setting**: Small town near the apartment
**Tone**: Expanding consequences

| Stage | Name | Carl's Experience | Paul's Experience |
|-------|------|-------------------|-------------------|
| 2.1 | The Street | Notices missing posters | Waves at familiar faces |
| 2.2 | The Store | Store owner is afraid | Can't understand the hostility |
| 2.3 | Town Hall | Evidence of Paul's activities | "Helping" the mayor |

### Act 3: The Journey
**Setting**: Escape from town consequences
**Tone**: Escalating absurdity

| Stage | Name | Carl's Experience | Paul's Experience |
|-------|------|-------------------|-------------------|
| 3.1 | The Forest | Following trail of destruction | Nature walk |
| 3.2 | The Cave | Ancient horrors awakened | Found a "cool rock" |
| 3.3 | The Boat | Escape attempt | "I got us a boat, Carl!" |

---

## Character Mechanics

### Carl (Order Path)
**Gameplay Focus**: Investigation and horror survival

- **Primary Interaction**: Examine objects, piece together what happened
- **Dialogue Tone**: Increasingly horrified, incredulous
- **Special Ability**: "Notice" - Highlights evidence and clues
- **Health Mechanic**: Sanity meter (depletes near Paul's "projects")

**AI Behavior (when player is Paul)**:
- Tries to clean up
- Attempts damage control
- Follows rules
- Expresses concern

### Paul (Chaos Path)
**Gameplay Focus**: Oblivious puzzle creation

- **Primary Interaction**: "Improve" objects, create problems
- **Dialogue Tone**: Cheerful, helpful, completely oblivious
- **Special Ability**: "Help" - Transforms objects (usually badly)
- **Health Mechanic**: Hunger meter (satisfied by... various things)

**AI Behavior (when player is Carl)**:
- Wanders creating problems
- Brings "gifts" to Carl
- Makes helpful suggestions
- Doesn't understand personal space

---

## Stage Design Philosophy

### Room Types

1. **Entry Rooms**
   - Clear introduction to stage theme
   - Tutorial elements for new mechanics
   - Initial story beat trigger

2. **Hub Rooms**
   - Central navigation point
   - Multiple exits to explore
   - NPC interactions
   - Safe(ish) zone

3. **Discovery Rooms**
   - Evidence/clue placement
   - Story beat triggers
   - Horror reveals (Carl) / Pride moments (Paul)

4. **Exit Rooms**
   - Stage completion trigger
   - Transition narrative
   - Checkpoint before next stage

### Procedural Variation

Each playthrough varies:
- Room layouts within template constraints
- Prop placement
- Optional room count
- Evidence/clue locations
- NPC positioning

Constant elements:
- Story beats happen in order
- Required items always spawn
- Key NPCs always appear
- Exit is always reachable

---

## Dialogue System

### Structure
```
DialoguePair {
  carl: string;      // What Carl says
  paul: string;      // What Paul says
  action?: Effect;   // World change
}
```

### Effect Types
- `spawn_object`: Add item to scene
- `remove_object`: Remove item from scene
- `unlock_exit`: Open locked door
- `trigger_beat`: Advance story
- `screen_shake`: Visual emphasis
- `blood_splatter`: Horror moment
- `dramatic_zoom`: Comedic emphasis

### Sample Dialogue Flow (Stage 1.1)

```
Beat 1: Wake Up
Carl: "Paul, why is there blood on the ceiling?"
Paul: "Good morning Carl! I made pancakes!"
[spawn_object: pancake_plate]

Beat 2: Kitchen Discovery  
Carl: "These don't taste like blueberries, Paul."
Paul: "They're not blueberries! They're much more... organic."
[screen_shake]

Beat 3: The Revelation
Carl: "Paul. Where is the mailman?"
Paul: "He's... around."
[spawn_object: suspicious_box]
```

---

## Horror Level System

### Scale (0-10)

| Level | Visual Effects | Audio | Gameplay |
|-------|----------------|-------|----------|
| 0-2 | Normal lighting | Pleasant ambient | Standard |
| 3-4 | Slightly dim | Subtle tension | Small blood stains |
| 5-6 | Noticeably darker | Dissonant notes | More evidence visible |
| 7-8 | Heavy shadows | Unsettling sounds | Sanity drain zones |
| 9-10 | Near darkness | Full horror score | Maximum chaos |

### Progression
- Starts at stage's base level
- Increases with story beats
- Can fluctuate (comedy relief moments)
- Affects NPC behavior
- Changes music/ambience

---

## Items & Inventory

### Quest Items (Required)
- Keys (various)
- Evidence pieces
- Story-critical objects
- Character-specific tools

### Optional Items
- Health restoration
- Sanity restoration (Carl)
- Hunger satisfaction (Paul)
- Cosmetic accessories

### Interaction Types
1. **Pickup**: Add to inventory
2. **Examine**: Get description/clue
3. **Use**: Apply to world object
4. **Combine**: Merge with other item (future feature)

---

## NPC System

### Behavior Patterns

**Idle**: Stays in place, has passive dialogue
**Patrol**: Follows path, responds to player proximity
**Wander**: Random movement within bounds
**Scripted**: Controlled by story beats
**Flee**: Runs from player (especially Paul)
**Chase**: Pursues player (rare enemies)

### Dialogue States
- **Initial**: First meeting
- **Return**: Subsequent visits
- **Quest**: During active quest
- **Complete**: After quest resolved
- **Fear**: After witnessing Paul's activities

---

## Save System (Planned)

### Save Data
```typescript
{
  worldSeed: WorldSeed;
  playerCharacter: CharacterType;
  currentStage: string;
  currentScene: string;
  playerPosition: Vector3;
  completedBeats: string[];
  collectedItems: string[];
  horrorLevel: number;
  playTime: number;
  timestamp: Date;
}
```

### Save Points
- Auto-save on stage completion
- Auto-save on quit
- Manual save from pause menu
- 3 save slots maximum

---

## Future Features

### Phase 1 (Current)
- [x] Character system
- [x] Camera system
- [x] Input system
- [x] Main menu
- [ ] Stage 1 implementation
- [ ] Basic dialogue
- [ ] Save/load

### Phase 2
- [ ] Multiple stages
- [ ] Full dialogue system
- [ ] NPC AI
- [ ] Sound effects
- [ ] Music

### Phase 3
- [ ] All story acts
- [ ] Achievements
- [ ] Gallery mode
- [ ] New Game+

### Phase 4
- [ ] Additional characters
- [ ] Community seeds
- [ ] Modding support
