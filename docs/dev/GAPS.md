# Feature Gaps & Known Issues

Last Updated: 2025-01-XX

This document tracks known feature gaps, stubs, and issues that need implementation.

---

## Completed (Previously Gaps)

### ~~1. Audio System~~ ✅ COMPLETE

Fully implemented with Tone.js procedural audio. No sample files needed.

- [x] Audio manager service (`AudioManager.ts`)
- [x] Procedural sound effects (20+ sounds)
- [x] Procedural music/ambient drones
- [x] Volume controls integration
- [x] React hook (`useAudio.ts`)
- [x] GameRenderer integration

### ~~2. Effects System Integration~~ ✅ COMPLETE

Fully integrated with GameRenderer.

- [x] Camera shake animation (position-based)
- [x] Dramatic zoom animation (FOV-based)
- [x] Blood splatter particle system
- [x] Sparkle cleanup particle system
- [x] GameRenderer wiring
- [x] State flag connections

### ~~3. Story Beat Triggers~~ ✅ COMPLETE

Fully integrated with GameRenderer.

- [x] StoryManager wired to GameRenderer
- [x] Scene transitions trigger `scene_enter` beats
- [x] Atmosphere actions supported
- [x] Sound effect callbacks

### ~~4. Horror Level System~~ ✅ REPLACED

Replaced with proper AtmosphereManager using named presets.

- [x] `cozy`, `uneasy`, `tense`, `dread`, `panic`, `absurd` presets
- [x] Smooth transitions between presets
- [x] Pulse effects for temporary mood changes
- [x] Per-scene atmosphere definitions in JSON
- [x] Trigger-based atmosphere changes

---

## Remaining Gaps

### 1. Stage-Specific Dialogue Loading

**Priority: Medium**
**Status: Implemented but unused**

#### What Exists
- `loadStageDialogues()` in `data/index.ts`
- Dynamic import for `./stages/${stageId}/dialogues/story.json`
- Caching mechanism

#### What's Missing
- [ ] Actual stage dialogue JSON files (beyond stage 1)
- [ ] Integration with InteractionSystem for stage-specific overrides

---

### 2. Enemy/Hostile NPC System

**Priority: Medium**
**Status: Types and filtering exist, no AI behavior**

#### What Exists
- Enemy filtering in `GameInitializer.ts:225-240`
- Hostile behavior types: `'hostile'`, `'chase'`, `'attack'`
- Tags: `'hostile'`, `'enemy'`

#### What's Missing
- [ ] Enemy AI behavior implementation
- [ ] Combat system (if planned)
- [ ] Health/damage system
- [ ] Enemy spawning logic

---

### 3. Item/Inventory System

**Priority: Medium**
**Status: Basic structure exists**

#### What Exists
- `player.inventory` array in state
- `itemDrop` extraction in GameInitializer
- `onItemPickup` callback in InteractionSystem

#### What's Missing
- [ ] Inventory UI component
- [ ] Item usage system
- [ ] Key items for puzzles
- [ ] Item descriptions

---

### 4. Quest System

**Priority: Low**
**Status: Types only**

- `StageGoal` interface exists
- `completedQuests` in save data
- No runtime implementation

---

### 5. Story Data for Remaining Stages

**Priority: Medium**
**Status: Only Stage 1 complete**

#### What Exists
- Stage 1 story data complete
- Story beat format defined

#### What's Missing
- [ ] Stage 2 story beats
- [ ] Stage 3 story beats
- [ ] Stage-specific dialogues

---

### 6. Mobile Gesture Refinement

**Priority: Low**
**Status: Functional but basic**

- Tap-to-move works
- Drag-to-move works
- Missing: pinch zoom, two-finger camera rotate

---

## Code Quality Issues

### Test Coverage Gaps

| Area | Current | Target |
|------|---------|--------|
| Systems | 90% | 95% |
| Hooks | 20% | 80% |
| Components | 0% | 50% |
| Data loaders | 80% | 90% |

### Type Safety Issues

1. `Record<string, unknown>` used in several places instead of proper types
2. Some `any` types in Babylon.js integration
3. Missing strict null checks in some areas

### Performance Concerns

1. No object pooling for particles
2. Stage generation not optimized for large stages
3. No LOD system for props

---

## Issue Template

When adding new gaps, use this format:

```markdown
### N. Feature Name

**Priority: High/Medium/Low**
**Status: Not Started/Stub/Partial**

Brief description of the gap.

#### What Exists
- Bullet points of existing code/types

#### What's Missing
- [ ] Checklist of needed work

#### Files to Create/Modify
- List of files

#### Notes
Any additional context
```
