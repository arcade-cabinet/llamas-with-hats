# Development Roadmap

Planned features and implementation priorities.

---

## Phase 1: Core Feature Completion ✅ COMPLETE

**Goal:** Complete all partially implemented systems to functional state.

### 1.1 Audio System ✅ COMPLETE
**Status: DONE - Fully procedural via Tone.js**

- [x] Create `AudioManager.ts` service
- [x] Implement sound effect playback
- [x] Implement background music
- [x] Add volume controls
- [x] Connect to game events (GameRenderer integration)
- [x] ~~Create/source audio files~~ Not needed - procedural audio!

**Note:** Replaced sample-based audio with Tone.js procedural synthesis. No audio files needed.

### 1.2 Effects System Integration ✅ COMPLETE
**Status: DONE - Fully integrated**

- [x] Create `EffectsManager.ts`
- [x] Implement camera shake (Babylon animation)
- [x] Implement dramatic zoom (Babylon animation)
- [x] Implement blood splatter particles
- [x] Implement sparkle particles
- [x] ~~Add horror-level atmosphere changes~~ Moved to AtmosphereManager
- [x] Connect effects to state flags (GameRenderer integration)

### 1.3 Story System Wiring ✅ COMPLETE
**Status: DONE - Fully integrated**

- [x] Create `StoryManager.ts` state machine
- [x] Implement trigger detection
- [x] Implement beat progression
- [x] Implement consequence execution
- [x] Add story progress to save/load
- [x] Create Stage 1 story data
- [x] Connect triggers to game events (GameRenderer integration)
- [x] Atmosphere actions from story triggers

### 1.4 GameRenderer Integration ✅ COMPLETE
**Status: DONE**

- [x] Initialize EffectsManager with scene/camera
- [x] Initialize AudioManager with Tone.js
- [x] Initialize AtmosphereManager
- [x] Wire story triggers to scene transitions
- [x] Wire effects to game state flags
- [x] Wire audio to game events

### 1.5 Atmosphere System ✅ COMPLETE (NEW)
**Status: DONE**

- [x] Create `AtmosphereManager.ts`
- [x] Define named presets (cozy, uneasy, tense, dread, panic, absurd)
- [x] Implement smooth transitions
- [x] Implement pulse effects
- [x] Implement layer blending
- [x] Coordinate fog, lighting, ambient audio
- [x] JSON scene integration
- [x] Replace linear horrorLevel with presets

---

## Phase 2: Content & Polish

**Goal:** Add game content and improve player experience.

### 2.1 Stage Content
**Priority: P1**
**Estimated: 4-6 hours**

- [ ] Create Stage 2 story beats
- [ ] Create Stage 3 story beats
- [ ] Add prop variety
- [ ] Balance room generation
- [ ] Add environmental storytelling

### 2.2 UI Polish
**Priority: P1**
**Estimated: 2-3 hours**

- [ ] Inventory UI component
- [ ] Improved dialogue display
- [ ] Settings menu (volume controls)
- [ ] Loading states
- [ ] Error handling UI

### 2.3 Dialogue Content
**Priority: P1**
**Estimated: 3-4 hours**

- [ ] Stage-specific dialogue variations
- [ ] More prop interaction dialogues
- [ ] Character personality consistency
- [ ] Dark comedy tone throughout

---

## Phase 3: Extended Features

**Goal:** Add nice-to-have features.

### 3.1 Enemy System
**Priority: P2**
**Estimated: 4-6 hours**

- [ ] Enemy AI behaviors
- [ ] Chase/flee mechanics
- [ ] Basic interaction system

### 3.2 Quest System
**Priority: P2**
**Estimated: 3-4 hours**

- [ ] Quest tracking
- [ ] Objective markers
- [ ] Completion rewards

### 3.3 Mobile Improvements
**Priority: P2**
**Estimated: 2-3 hours**

- [ ] Pinch zoom
- [ ] Camera rotation gestures
- [ ] Haptic feedback

---

## Phase 4: Quality & Performance

**Goal:** Improve code quality and performance.

### 4.1 Test Coverage
**Priority: P3**
**Estimated: 4-6 hours**

- [ ] AtmosphereManager tests
- [ ] AudioManager tests (mocked Tone.js)
- [ ] Hook tests (useAudio, useStory)
- [ ] Component tests
- [ ] E2E test expansion

### 4.2 Performance Optimization
**Priority: P3**
**Estimated: 3-4 hours**

- [ ] Object pooling for particles
- [ ] Stage generation optimization
- [ ] Asset loading optimization
- [ ] Memory profiling

### 4.3 Type Safety
**Priority: P3**
**Estimated: 2-3 hours**

- [ ] Remove `any` types
- [ ] Add strict null checks
- [ ] Improve generic types

---

## Timeline (Updated)

```
Week 1: Phase 1 (Core Systems) ✅ COMPLETE
Week 2: Phase 2 (Content, UI, Dialogue)
Week 3: Phase 3 (Enemies, Quests, Mobile)
Week 4: Phase 4 (Tests, Performance, Types)
```

---

## Success Criteria

### Phase 1 Complete When: ✅
- [x] Audio system implemented (procedural)
- [x] All visual effects implemented
- [x] Atmosphere system implemented
- [x] Story beats system implemented
- [x] All tests still passing (138/138)
- [x] Systems integrated with GameRenderer
- [x] ~~Audio assets created/sourced~~ Not needed

### Phase 2 Complete When:
- [ ] Full Stage 1 playable with dialogue
- [ ] UI feels polished
- [ ] Audio enhances atmosphere
- [ ] Multiple stages have story content

### Phase 3 Complete When:
- [ ] At least one enemy type functional
- [ ] Quest tracking visible to player
- [ ] Mobile feels native

### Phase 4 Complete When:
- [ ] 80%+ test coverage
- [ ] No performance issues on mid-range devices
- [ ] Zero `any` types in codebase

---

## Architecture Decisions Made

| Decision | Rationale |
|----------|-----------|
| Tone.js for audio | No asset management, real-time parameters, smaller bundle |
| Named atmosphere presets | More expressive than linear horror level, JSON-friendly |
| Atmosphere replaces horror level | Multi-dimensional mood control, better for story-driven game |
| Separate Effects vs Atmosphere | Instant effects vs persistent mood are different concerns |
| Singleton audio/atmosphere managers | Shared state across components, consistent experience |

---

## Notes

- Phase 1 complete - all core systems implemented and integrated
- Procedural audio eliminates need for audio asset sourcing
- Atmosphere presets are more designer-friendly than numeric horror levels
- Keep each feature minimal viable first
- Write tests alongside implementation
- Update DEVLOG.md with all work done
