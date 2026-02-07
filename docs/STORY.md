# Llamas With Hats - Story Design Document

## Overview

**Llamas With Hats** is a dark comedy RPG following Carl and Paul, two llamas navigating the aftermath of Paul's increasingly disturbing "accidents." The player experiences the story through either Carl's horrified perspective (Order path) or Paul's oblivious cheerfulness (Chaos path).

---

## The Core Dynamic

### Carl (Order Path)
- **Personality**: Anxious, responsible, desperately trying to maintain normalcy
- **Goal**: Understand what Paul has done and prevent further disasters
- **Horror Response**: Horror level INCREASES as he discovers evidence
- **Dialogue Tone**: Concerned, accusatory, exasperated

### Paul (Chaos Path)  
- **Personality**: Cheerfully oblivious, sees destruction as "creativity"
- **Goal**: Share his "accomplishments" with Carl
- **Horror Response**: Horror level stays LOW (he thinks everything is fine)
- **Dialogue Tone**: Excited, proud, confused by Carl's reactions

---

## Three-Act Structure

### Act I: The Apartment
**Theme**: Discovery of the immediate problem

**Setting**: Carl and Paul's apartment - multiple rooms connected  
**Stakes**: What has Paul done THIS time?

**Order (Carl)**:
- Wake up to strange smells
- Discover blood in the kitchen
- Find evidence trail leading to basement
- Horror reveal: Paul's "art project"

**Chaos (Paul)**:
- Proudly show Carl your "redecorating"
- Explain your creative process
- Get confused when Carl panics
- Offer to make breakfast

**Key Locations**:
- Living Room (start)
- Kitchen (first horror discovery)
- Bedroom (key item)
- Bathroom (optional horror)
- Basement (act climax)
- Foyer (exit to Act II)

### Act II: The Neighborhood
**Theme**: The scope of the problem expands

**Setting**: Streets, shops, other houses  
**Stakes**: This isn't contained to their apartment

**Order (Carl)**:
- Realize Paul has been "busy" around town
- Try to cover up evidence
- Meet neighbors who have "concerns"
- Discover Paul's "community outreach"

**Chaos (Paul)**:
- Give Carl a tour of your projects
- Introduce him to your "new friends"
- Show off your urban improvements
- Can't understand why people are screaming

**Key Locations**:
- Front Yard (transition)
- Neighbor's House (Mrs. Henderson's fate)
- Local Shop (supplies... for what?)
- Park (the "landscaping")
- Abandoned Warehouse (Paul's "studio")

### Act III: The Resolution
**Theme**: Confrontation and consequences

**Setting**: Escalates to surreal locations  
**Stakes**: Can this ever be fixed?

**Order (Carl)**:
- Confront Paul about everything
- Make impossible choices
- Face consequences of inaction
- Multiple endings based on horror level

**Chaos (Paul)**:
- Complete your "masterpiece"
- Help Carl understand your vision
- The logical conclusion of chaos
- Multiple endings based on what you've created

---

## Stage Design Philosophy

### Anchor Rooms
Anchor rooms are **story-critical** locations where major beats occur. They:
- Have fixed relative positions in the stage graph
- Contain required dialogue triggers
- May have locked doors requiring items
- Progress the narrative when entered

### Filler Rooms
Filler rooms are **procedurally placed** between anchors. They:
- Provide exploration space
- May contain optional items
- Have randomized props from templates
- Connect anchors with appropriate atmosphere

### Vertical Progression
Stages can have multiple **floor levels**:
- Level -1: Basement (dark, horror-heavy)
- Level 0: Ground floor (standard)
- Level 1+: Upper floors (sometimes locked)

Vertical transitions use **stairs** that:
- Are physically rendered geometry
- Allow gradual Y-position change
- Connect rooms on different floors
- May be blocked until unlocked

---

## Horror Level System

The **Horror Level** (0-10) tracks Carl's psychological state:

| Level | Name | Effects |
|-------|------|---------|
| 0-2 | Calm | Normal dialogue, standard lighting |
| 3-4 | Uneasy | Anxious dialogue, subtle shadows |
| 5-6 | Disturbed | Paranoid dialogue, flickering lights |
| 7-8 | Horrified | Panicked dialogue, visual distortion |
| 9-10 | Breaking | Dissociative dialogue, reality breaks |

### Horror Triggers
- Entering certain rooms (+1-2)
- Examining evidence (+1-3)
- Paul's "explanations" (+1-2)
- Story beat discoveries (+2-5)

### Horror Effects
- Dialogue changes at thresholds
- Visual atmosphere adjustments
- Character animations change
- Some paths locked/unlocked by horror

---

## Quest Structure

### Main Quests
Required for story progression:
1. **Investigate the Apartment** - Visit key rooms
2. **Find the Basement Key** - Search bedroom
3. **Discover the Truth** - Enter basement
4. **Escape the Apartment** - Reach foyer

### Side Quests
Optional discoveries:
- **Paul's Diary** - Pieces scattered around
- **The Missing Neighbor** - Follow evidence
- **Carl's Stash** - Find his emergency supplies
- **The Recipe Book** - Paul's "cooking notes"

### Hidden Quests
Discovered through specific actions:
- **The Good Ending** - Requires specific choices
- **Paul's Redemption** - High empathy playthrough
- **Carl's Breaking Point** - Maximum horror path

---

## Dialogue System

### Structure
```
DialogueNode {
  id: string
  speaker: 'carl' | 'paul' | 'narrator'
  lines: string[]
  choices?: DialogueChoice[]
  effects?: DialogueEffect[]
  next?: string
}

DialogueChoice {
  text: string
  condition?: Condition
  effects?: DialogueEffect[]
  next: string
}

DialogueEffect {
  type: 'horror' | 'item' | 'unlock' | 'quest'
  params: object
}
```

### Dialogue Triggers
- **Room Entry**: Plays when entering anchor room first time
- **Prop Interaction**: Plays when examining interactive props
- **Proximity**: Plays when near certain objects/areas
- **Quest State**: Plays when quest conditions met

---

## Stage 1 Detailed Design: The Apartment

### Floor Plan
```
                    KITCHEN (-10z)
                        |
                    [archway]
                        |
    BATHROOM (+8z) -- HALLWAY (+10x) -- LIVING ROOM (0,0) -- FOYER (+10z)
        |                |                                      |
    [door]           [door]                                [door-locked]
        |                |                                      |
                    BEDROOM (-8z)                          [OUTSIDE]
                        
    BASEMENT (-4y) connected via stairs from KITCHEN
```

### Room Details

#### Living Room (Anchor - Entry)
- **Size**: 10x8
- **Props**: Couch, coffee table, lamp, bookshelf
- **Story**: Wake up location, first dialogue
- **Exits**: North→Kitchen, East→Hallway, South→Foyer

#### Kitchen (Anchor - Discovery)
- **Size**: 8x6  
- **Props**: Counters, table, suspicious stains
- **Story**: First major horror discovery
- **Exits**: South→Living Room, Down→Basement (locked initially)
- **Trigger**: Blood on ceiling revelation

#### Basement (Anchor - Climax)
- **Size**: 14x12
- **Props**: Paul's "art supplies", storage, THE THING
- **Story**: Act I climax, major horror spike
- **Floor Level**: -1 (4 units below ground)
- **Trigger**: Full reveal of Paul's activities

#### Hallway (Connector)
- **Size**: 3x8
- **Props**: Coat rack, mirror
- **Exits**: West→Living Room, North→Bedroom, South→Bathroom

#### Bedroom (Quest Item)
- **Size**: 10x8
- **Props**: Bed, dresser, nightstand
- **Quest Item**: Basement key (hidden in drawer)
- **Exits**: South→Hallway

#### Bathroom (Optional Horror)
- **Size**: 5x5
- **Props**: Toilet, bathtub, sink, mirror
- **Optional**: Extra horror discovery
- **Exits**: North→Hallway

#### Foyer (Exit - Locked)
- **Size**: 6x6
- **Props**: Coat hooks, doormat
- **Exit**: Front door (locked until Act I complete)
- **Exits**: North→Living Room, South→Outside

---

## Character Mechanics

### Movement
- Speed: 4 units/second walking
- Sprint: 6 units/second (stamina limited)
- Character radius: 0.4 units (collision)

### Interaction
- Range: 1.5 units from prop center
- Prompt appears when in range
- 'E' key / A button to interact
- Some interactions require items

### Collision
- Characters cannot walk through props
- Sliding collision along edges
- Walls are impassable barriers
- Doors may be locked/unlocked

---

## Prop Interaction Examples

### Bookshelf
**Carl**: "My book collection. Paul keeps putting weird things between the pages."
**Horror 5+**: "Wait... this book is bound in something that isn't leather..."

### Fridge
**Carl**: "I'm afraid to look inside."
**Paul**: "The fridge! Full of... ingredients. Fresh ingredients."
**Horror 7+**: "Something in there is still moving."

### Basement Door
**Locked**: "It's locked. I need a key."
**Carl (unlocked)**: "Do I really want to go down there?"
**Paul (unlocked)**: "My workshop! Come see what I've been working on!"

---

## Future Roadmap

### Version 0.2 - Combat System
- Encounter mechanics
- Health/damage
- "Weapons" (Carl's defensive items vs Paul's "tools")

### Version 0.3 - Full Act I
- All Stage 1 rooms complete
- Full dialogue trees
- Multiple mini-endings for Act I

### Version 0.4 - Procedural Generation
- Room template system active
- Filler room generation
- Random prop placement with rules

### Version 0.5 - Act II Preview
- Neighborhood exterior
- First outdoor locations
- Expanded cast (neighbors)

### Version 1.0 - Full Game
- All three acts
- Multiple endings
- Polish and balancing
- Sound design complete
