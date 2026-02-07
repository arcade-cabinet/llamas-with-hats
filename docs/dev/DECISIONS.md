# Architecture Decisions

Record of significant technical decisions and their rationale.

---

## ADR-001: Yuka for AI Navigation

**Date:** Prior to audit
**Status:** Accepted

### Context
Need AI pathfinding and steering behaviors for NPCs.

### Decision
Use Yuka library for vehicle-based steering behaviors.

### Rationale
- Lightweight library (~50KB)
- Well-documented steering behaviors
- Works well with any 3D engine
- No dependency on Babylon.js navigation mesh

### Consequences
- Good: Easy to implement wander, follow, flee
- Good: Obstacle avoidance built-in
- Bad: Need to sync Yuka positions with Babylon meshes
- Bad: Mock complexity in tests

### Alternatives Considered
- Babylon.js Navigation Mesh: Too heavy for simple needs
- Custom implementation: Too much work
- A* library: Doesn't include steering behaviors

---

## ADR-002: Data-Driven Content Design

**Date:** Prior to audit
**Status:** Accepted

### Context
Need flexible content system for props, dialogues, stages.

### Decision
All game content defined in JSON files, loaded at runtime.

### Rationale
- Separates content from code
- Enables non-programmers to edit content
- Supports procedural generation
- Easy to version control

### Consequences
- Good: Clean separation of concerns
- Good: Easy content iteration
- Bad: Runtime parsing overhead
- Bad: Type safety requires schemas/validation

### Alternatives Considered
- Hardcoded content: Not flexible enough
- Database: Over-engineered for single-player
- YAML: Less universal than JSON

---

## ADR-003: State Flag Effects Pattern

**Date:** Prior to audit
**Status:** Accepted (enhanced with EffectsManager)

### Context
Need to trigger visual effects from game events.

### Decision
Use boolean state flags (screenShake, bloodSplatter) that React observes, with EffectsManager handling Babylon.js integration.

### Rationale
- React-friendly pattern
- Easy to test state changes
- Decouples game logic from rendering

### Implementation
State flags trigger useEffect hooks in GameRenderer that call EffectsManager methods. Both external (prop-based) and internal (story callback) triggers are supported.

---

## ADR-004: Happy-DOM for Tests

**Date:** Prior to audit
**Status:** Accepted

### Context
Need DOM environment for React component tests.

### Decision
Use Happy-DOM instead of JSDOM.

### Rationale
- Faster than JSDOM
- Better compatibility with modern APIs
- Lighter memory footprint

### Consequences
- Good: Fast test execution
- Good: Works well with Vitest
- Bad: Some edge cases may differ from real browsers
- Mitigation: E2E tests with Playwright cover real browsers

---

## ADR-005: Unified Character Navigator

**Date:** Prior to audit
**Status:** Accepted

### Context
Both player (tap-to-move) and AI need pathfinding.

### Decision
Single `CharacterNavigator` class used by both player and AI.

### Rationale
- DRY principle
- Consistent movement feel
- Shared obstacle avoidance

### Consequences
- Good: One system to maintain
- Good: Player and AI feel consistent
- Good: Easy to switch control modes

### Implementation
```typescript
// Same navigator, different modes
playerNav.moveTo(x, z);  // Tap-to-move
aiNav.wander();          // AI behavior
aiNav.follow(playerX, playerZ);  // Chase player
```

---

## ADR-006: Story Dialogues Location

**Date:** 2025-01-XX
**Status:** Accepted

### Context
Story dialogues were hardcoded in `InteractionSystem.ts`.

### Decision
Move to data files: `src/data/stages/{stageId}/story.json`

### Rationale
- Consistent with data-driven design
- Easier for writers to edit
- Supports stage-specific content
- Already have loading mechanism

### Implementation
- Story beats defined in JSON per stage
- StoryManager loads and tracks progression
- InteractionSystem uses prop dialogues from data

---

## ADR-007: Procedural Audio with Tone.js

**Date:** 2025-01-XX
**Status:** Accepted (supersedes sample-based approach)

### Context
Need audio system for sound effects and music.

### Decision
Use Tone.js for real-time procedural audio synthesis instead of pre-recorded samples.

### Rationale
- No audio asset management needed
- Sounds can be parameterized (pitch, volume, duration)
- Procedural audio matches whimsical dark comedy tone
- Smaller bundle size
- Instant iteration on sound design

### Consequences
- Good: Zero audio files to manage
- Good: Sounds are uniquely generated each time
- Good: Easy to adjust sound character in code
- Bad: Requires Tone.js dependency (~100KB)
- Bad: Must call init() after user interaction (browser policy)

### Alternatives Considered (Rejected)
- **Web Audio API raw**: Too low-level, lots of boilerplate
- **Howler.js**: Still needs sample files
- **Pre-recorded samples**: Asset management overhead, larger bundle

### Implementation
```typescript
const audio = getAudioManager();
await audio.init();  // After user interaction

// All sounds synthesized in real-time
audio.playSound('scream');  // Generates descending sawtooth
audio.playMusic('horror_ambient');  // Generates layered drones
```

---

## ADR-008: Atmosphere Presets over Horror Level

**Date:** 2025-01-XX
**Status:** Accepted (supersedes linear horror level)

### Context
The game had a linear "horror level" (0-10) that incremented with story progression. This was too simplistic for a story-driven RPG.

### Decision
Replace with named atmosphere presets that coordinate multiple mood dimensions.

### Presets
- `cozy` - Safe, warm, homey
- `uneasy` - Something's not quite right
- `tense` - Building dread
- `dread` - Full horror atmosphere
- `panic` - Immediate danger
- `absurd` - Dark comedy theatrical horror
- `neutral` - Default/reset

### Rationale
1. **Named presets are more expressive** - "tense" conveys more than "horror level 5"
2. **Multi-dimensional control** - Fog, lighting, audio need coordination
3. **Story-driven** - Different scenes need different moods, not linear progression
4. **Designer-friendly** - JSON `"atmosphere": { "preset": "cozy" }` is clear
5. **Transition support** - Smooth blending between moods

### Consequences
- Good: Rich, coordinated atmosphere control
- Good: Per-scene mood definition in JSON
- Good: Pulse effects for temporary mood spikes
- Good: Layer blending for complex scenes
- Bad: More complex than simple number
- Bad: Preset definitions require careful tuning

### Alternatives Considered (Rejected)
- **Keep horror level**: Too linear, doesn't support varied scenes
- **Multiple numeric axes**: Too complex for designers
- **Per-component settings**: Too scattered, hard to coordinate

### Implementation
```typescript
// In scene JSON
{ "atmosphere": { "preset": "cozy" } }

// From triggers
{ "type": "atmosphere", "params": { "preset": "tense", "duration": 2000 } }

// In code
atmosphereManager.setPreset('dread', 3000);  // 3 second transition
atmosphereManager.pulse('panic', 2000);  // Temporary spike
```

---

## ADR-009: Separate Effects vs Atmosphere Managers

**Date:** 2025-01-XX
**Status:** Accepted

### Context
Visual/audio effects could be handled by one manager or split by concern.

### Decision
Two separate managers:
- **EffectsManager**: Instant, one-shot effects (shake, zoom, particles)
- **AtmosphereManager**: Persistent mood (fog, lighting, ambient audio)

### Rationale
- Different lifecycles: effects are transient, atmosphere persists
- Different triggers: effects from events, atmosphere from scene/story
- Different update patterns: effects self-complete, atmosphere needs continuous updates
- Cleaner separation of concerns

### Consequences
- Good: Clear responsibility boundaries
- Good: Can update atmosphere without retriggering effects
- Good: Effects don't interfere with atmosphere transitions
- Bad: Two systems to initialize and coordinate

### Implementation
```typescript
// Instant effect - fire and forget
effectsManager.shakeCamera(0.15, 500);

// Persistent mood - smooth transition
atmosphereManager.setPreset('tense', 2000);
```

---

## Template for New Decisions

```markdown
## ADR-XXX: Title

**Date:** YYYY-MM-DD
**Status:** Proposed/Accepted/Deprecated/Superseded

### Context
What is the issue that we're seeing that is motivating this decision?

### Decision
What is the change that we're proposing?

### Rationale
Why is this the best choice?

### Consequences
What becomes easier or harder?

### Alternatives Considered
What other options were evaluated?
```
