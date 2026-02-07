/**
 * Stage Generator
 * ===============
 * 
 * Procedural generation engine that converts StageDefinitions into
 * playable scene graphs. This is the core of the content generation pipeline.
 * 
 * ## Generation Pipeline
 * 
 * ```
 * ┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
 * │ StageDefinition │ ──► │   Generator  │ ──► │ GeneratedStage  │
 * │     (JSON)      │     │  + Seed      │     │ (Scene Graph)   │
 * └─────────────────┘     └──────────────┘     └─────────────────┘
 *         │                      │                      │
 *         ▼                      ▼                      ▼
 *   What to build         How to build          Ready to render
 *   - Story beats         - Pick templates      - Scene meshes
 *   - Required scenes     - Connect scenes      - Placed items
 *   - Quest items         - Place props/NPCs    - Trigger zones
 * ```
 * 
 * ## Key Algorithms
 * 
 * ### Scene Connection
 * The generator supports multiple layout algorithms:
 * 
 * **Linear**: Simple corridor-style layout
 * ```
 * [Entry] → [Room A] → [Room B] → [Exit]
 * ```
 * 
 * **Branching**: Main path with optional side rooms
 * ```
 *                    [Side Room]
 *                         │
 * [Entry] → [Room A] → [Hub] → [Room B] → [Exit]
 *                         │
 *                    [Side Room]
 * ```
 * 
 * **Hub**: Central room with spokes
 * ```
 *         [North]
 *            │
 * [West] ── [Hub] ── [East]
 *            │
 *         [South]
 * ```
 * 
 * ### Prop Placement
 * Props are placed using zone-based rules:
 * - `center`: Tables, rugs (focal points)
 * - `edge`: Bookshelves, decorations
 * - `corner`: Lamps, plants
 * - `wall`: Counters, cabinets (flush against wall)
 * 
 * @module StageGenerator
 */

import {
  StageDefinition,
  SceneTemplate,
  MaterialPalette,
  ConnectionPoint,
  ConnectionType,
  RequiredScene,
  QuestItemDef,
  RequiredNPC,
  CompositionModule,
  createRNG,
  hashSeed
} from './StageDefinition';
import {
  SceneDefinition,
  PropDefinition,
  NPCDefinition,
  ExitDefinition,
  SpawnPointDefinition
} from './SceneDefinition';

// ============================================
// Generated Stage Output
// ============================================

/**
 * The output of stage generation.
 * Contains everything needed to load and play the stage.
 */
export interface GeneratedStage {
  /** Unique ID for this generated instance */
  id: string;
  
  /** ID of the StageDefinition used */
  stageDefId: string;
  
  /** Seed used for generation (for reproducibility) */
  seed: string;
  
  /** All generated scene definitions */
  scenes: SceneDefinition[];
  
  /** Scene graph with positions and connections */
  sceneGraph: SceneGraphNode[];
  
  /** ID of the entry scene */
  entrySceneId: string;
  
  /** ID of the exit scene */
  exitSceneId: string;
  
  /** Quest items and their placements */
  questItems: PlacedQuestItem[];
  
  /** NPCs and their placements */
  npcs: PlacedNPC[];
}

/**
 * A node in the scene graph.
 * Tracks scene position in world space and connections to other scenes.
 */
export interface SceneGraphNode {
  /** Scene ID this node represents */
  sceneId: string;
  
  /** World position for multi-scene rendering */
  position: { x: number; z: number };
  
  /** Connections to other scenes */
  connections: SceneConnection[];
}

/**
 * A connection between two scenes.
 */
export interface SceneConnection {
  /** ID of the scene this connects to */
  targetSceneId: string;
  
  /** How the scenes connect (door, archway, etc.) */
  connectionType: ConnectionType;
  
  /** ID of the exit that triggers this connection */
  exitId: string;
  
  /** Direction of travel */
  direction: 'north' | 'south' | 'east' | 'west';
}

/**
 * A quest item placed in the world.
 */
export interface PlacedQuestItem {
  /** The item definition */
  itemDef: QuestItemDef;
  
  /** Scene where it was placed */
  sceneId: string;
  
  /** Position within the scene */
  position: [number, number, number];
}

/**
 * An NPC placed in the world.
 */
export interface PlacedNPC {
  /** The NPC definition */
  npcDef: RequiredNPC;
  
  /** Scene where they were placed */
  sceneId: string;
  
  /** Position within the scene */
  position: [number, number, number];
}

// ============================================
// Generator Context (internal state)
// ============================================

/**
 * Internal state maintained during generation.
 * @internal
 */
interface GeneratorContext {
  /** Seeded random number generator */
  rng: ReturnType<typeof createRNG>;
  
  /** Stage definition being generated */
  stageDef: StageDefinition;
  
  /** Available templates (id → template) */
  templates: Map<string, SceneTemplate>;
  
  /** Available palettes (id → palette) */
  palettes: Map<string, MaterialPalette>;
  
  /** Available composition modules (id → module) */
  modules: Map<string, CompositionModule>;
  
  // ─────────────────────────────────────────
  // State accumulated during generation
  // ─────────────────────────────────────────
  
  /** Generated scenes (id → scene) */
  generatedScenes: Map<string, SceneDefinition>;
  
  /** Scene graph (id → node) */
  sceneGraph: Map<string, SceneGraphNode>;
  
  /** World positions already used (prevents overlap) */
  usedPositions: Set<string>;
  
  // ─────────────────────────────────────────
  // Counters for unique IDs
  // ─────────────────────────────────────────
  
  /** Counter for scene IDs */
  sceneCounter: number;
  
  /** Counter for prop IDs */
  propCounter: number;
}

// ============================================
// Main Generator Function
// ============================================

/**
 * Generate a playable stage from a definition.
 * 
 * This is the main entry point for procedural generation.
 * Given the same inputs and seed, it always produces identical output.
 * 
 * @param stageDef - The stage definition to generate from
 * @param templates - Available scene templates
 * @param palettes - Available material palettes
 * @param modules - Available composition modules
 * @param seed - String seed for deterministic generation
 * @returns Complete generated stage ready for loading
 * 
 * @example
 * ```ts
 * const stage = generateStage(
 *   apartmentStageDef,
 *   allTemplates,
 *   allPalettes,
 *   allModules,
 *   "player-world-seed-123"
 * );
 * 
 * // Load the entry scene
 * await loadScene(babylonScene, stage.scenes[0]);
 * ```
 */
export function generateStage(
  stageDef: StageDefinition,
  templates: SceneTemplate[],
  palettes: MaterialPalette[],
  modules: CompositionModule[],
  seed: string
): GeneratedStage {
  // Initialize context with seeded RNG
  const rng = createRNG(hashSeed(seed + stageDef.id));
  
  const ctx: GeneratorContext = {
    rng,
    stageDef,
    templates: new Map(templates.map(t => [t.id, t])),
    palettes: new Map(palettes.map(p => [p.id, p])),
    modules: new Map(modules.map(m => [m.id, m])),
    generatedScenes: new Map(),
    sceneGraph: new Map(),
    usedPositions: new Set(),
    sceneCounter: 0,
    propCounter: 0,
  };
  
  // ─────────────────────────────────────────
  // Phase 1: Generate required scenes
  // ─────────────────────────────────────────
  
  // Entry scene (where player starts)
  const entryScene = generateRequiredScene(ctx, stageDef.generation.entryScene, 'entry');
  placeSceneInGraph(ctx, entryScene.id, { x: 0, z: 0 });
  
  // Required scenes (story-critical)
  const requiredScenes: SceneDefinition[] = [entryScene];
  for (const req of stageDef.generation.requiredScenes) {
    const scene = generateRequiredScene(ctx, req, req.purpose);
    requiredScenes.push(scene);
  }
  
  // Exit scene (stage completion)
  const exitScene = generateRequiredScene(ctx, stageDef.generation.exitScene, 'exit');
  requiredScenes.push(exitScene);
  
  // ─────────────────────────────────────────
  // Phase 2: Generate filler scenes
  // ─────────────────────────────────────────
  
  const optionalCount = ctx.rng.nextInt(
    stageDef.generation.optionalSceneCount.min,
    stageDef.generation.optionalSceneCount.max
  );
  
  const fillerScenes: SceneDefinition[] = [];
  for (let i = 0; i < optionalCount; i++) {
    const scene = generateFillerScene(ctx);
    fillerScenes.push(scene);
  }
  
  // ─────────────────────────────────────────
  // Phase 3: Connect scenes
  // ─────────────────────────────────────────
  
  const allScenes = [...requiredScenes, ...fillerScenes];
  connectScenes(ctx, allScenes, entryScene.id, exitScene.id);
  
  // ─────────────────────────────────────────
  // Phase 4: Place quest items
  // ─────────────────────────────────────────
  
  const placedItems = placeQuestItems(ctx, stageDef.props.questItems);
  
  // ─────────────────────────────────────────
  // Phase 5: Place NPCs
  // ─────────────────────────────────────────
  
  const placedNPCs = placeNPCs(ctx, stageDef.npcs.required);
  
  // ─────────────────────────────────────────
  // Phase 6: Add story triggers
  // ─────────────────────────────────────────
  
  addStoryTriggers(ctx);
  
  // ─────────────────────────────────────────
  // Return complete generated stage
  // ─────────────────────────────────────────
  
  return {
    id: `${stageDef.id}_${seed}`,
    stageDefId: stageDef.id,
    seed,
    scenes: Array.from(ctx.generatedScenes.values()),
    sceneGraph: Array.from(ctx.sceneGraph.values()),
    entrySceneId: entryScene.id,
    exitSceneId: exitScene.id,
    questItems: placedItems,
    npcs: placedNPCs,
  };
}

// ============================================
// Scene Generation
// ============================================

/**
 * Generate a scene from requirements.
 * Picks a matching template and generates a scene from it.
 * 
 * @internal
 */
function generateRequiredScene(
  ctx: GeneratorContext,
  req: RequiredScene,
  purpose: string
): SceneDefinition {
  // Find matching template
  let template: SceneTemplate;
  
  if (req.templateId) {
    // Specific template requested
    const found = ctx.templates.get(req.templateId);
    if (!found) {
      console.warn(`Template not found: "${req.templateId}" for purpose "${purpose}". Falling back to random template.`);
      const fallback = Array.from(ctx.templates.values());
      template = ctx.rng.pick(fallback);
    } else {
      template = found;
    }
  } else if (req.templateTags) {
    // Find templates matching any tag
    const matching = Array.from(ctx.templates.values()).filter(t =>
      req.templateTags!.some(tag => t.tags.includes(tag))
    );
    if (matching.length === 0) {
      console.warn(`No templates match tags [${req.templateTags.join(', ')}] for purpose "${purpose}". Falling back to random template.`);
      const fallback = Array.from(ctx.templates.values());
      template = ctx.rng.pick(fallback);
    } else {
      template = ctx.rng.pick(matching);
    }
  } else {
    // Pick from allowed templates
    const allowed = ctx.stageDef.generation.allowedTemplates
      .map(id => ctx.templates.get(id))
      .filter((t): t is SceneTemplate => t != null);
    if (allowed.length === 0) {
      console.warn(`No allowed templates resolved for purpose "${purpose}". Falling back to random template.`);
      const fallback = Array.from(ctx.templates.values());
      template = ctx.rng.pick(fallback);
    } else {
      template = ctx.rng.pick(allowed);
    }
  }
  
  return generateSceneFromTemplate(ctx, template, purpose);
}

/**
 * Generate an optional filler scene.
 * These add variety and exploration without being story-critical.
 * 
 * @internal
 */
function generateFillerScene(ctx: GeneratorContext): SceneDefinition {
  const allowed = ctx.stageDef.generation.allowedTemplates
    .map(id => ctx.templates.get(id))
    .filter((t): t is SceneTemplate => t != null);

  let template: SceneTemplate;
  if (allowed.length === 0) {
    console.warn('No allowed templates resolved for filler scene. Falling back to random template.');
    const fallback = Array.from(ctx.templates.values());
    template = ctx.rng.pick(fallback);
  } else {
    template = ctx.rng.pick(allowed);
  }

  return generateSceneFromTemplate(ctx, template, 'filler');
}

/**
 * Generate a scene from a specific template.
 * Handles size randomization, palette selection, and prop placement.
 * 
 * @internal
 */
// Purpose-to-display-name mapping for semantic room names
const ROOM_NAMES: Record<string, string> = {
  entry: 'Living Room',
  kitchen: 'The Kitchen',
  bedroom: 'Master Bedroom',
  bathroom: 'Bathroom',
  hallway: 'Hallway',
  basement_main: 'Basement',
  basement_storage: 'Storage Room',
  exit: 'Basement',
  filler: 'Side Room',
  closet: 'Closet',
  storage: 'Storage',
  // Stage 2
  neighborhood_entry: 'Front Yard',
  street: 'Neighborhood Street',
  neighbor_house: "Neighbor's House",
  park: 'Community Park',
  parking_lot: 'Parking Lot',
  alley: 'Dark Alley',
  // Stage 3
  downtown_entry: 'Downtown',
  city_block: 'City Block',
  dark_alley: 'Dark Alley',
  office: 'Office Building',
  police_station: 'Police Station',
  workshop: "Paul's Workshop",
  restaurant: 'Diner',
  shop: 'Corner Shop',
  plaza: 'Town Plaza',
  highway_onramp: 'Highway On-Ramp',
};

function getSceneName(purpose: string, counter: number): string {
  const baseName = ROOM_NAMES[purpose];
  if (baseName) return baseName;
  // Fallback for unknown purposes: title-case the purpose
  const titleCase = purpose.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return titleCase || `Room ${counter}`;
}

function generateSceneFromTemplate(
  ctx: GeneratorContext,
  template: SceneTemplate,
  purpose: string
): SceneDefinition {
  const sceneId = `scene_${++ctx.sceneCounter}_${purpose}`;

  // Randomize size within template constraints
  const width = ctx.rng.nextInt(template.size.width.min, template.size.width.max);
  const height = ctx.rng.nextInt(template.size.height.min, template.size.height.max);

  // Pick a random palette from stage's allowed palettes
  const paletteId = ctx.rng.pick(ctx.stageDef.generation.palettes);
  const palette = ctx.palettes.get(paletteId) ?? Array.from(ctx.palettes.values())[0];
  if (!ctx.palettes.has(paletteId)) {
    console.warn(`Palette not found: "${paletteId}". Using fallback palette.`);
  }

  // Generate props using template rules
  const props = generateProps(ctx, template, width, height, palette);

  // Create exits (will be filled in during connection phase)
  const exits: ExitDefinition[] = [];

  // Create spawn points at each potential connection
  const spawnPoints: SpawnPointDefinition[] = [
    {
      id: 'default',
      transform: { position: [0, 0, height / 2 - 1] },
      default: true,
    },
  ];

  for (const cp of template.connectionPoints) {
    const pos = getConnectionPointPosition(cp, width, height);
    spawnPoints.push({
      id: `spawn_${cp.side}`,
      transform: { position: pos },
    });
  }

  // Determine atmosphere from per-room overrides or base horror level
  const roomOverride = ctx.stageDef.atmosphere?.perRoomOverrides?.[purpose];
  const horrorLevel = roomOverride?.horrorLevel ?? ctx.stageDef.atmosphere.baseHorrorLevel;

  // Assemble the scene definition
  const scene: SceneDefinition = {
    id: sceneId,
    name: getSceneName(purpose, ctx.sceneCounter),
    description: `Generated ${template.type}`,

    bounds: { width, height },

    floor: { color: palette.floors.primary.color },
    walls: { color: palette.walls.primary.color },

    atmosphere: {
      preset: horrorLevel > 5 ? 'tense'
            : horrorLevel > 2 ? 'uneasy'
            : 'cozy',
      fogEnabled: true,
      fogDensity: 0.01 + (horrorLevel * 0.005),
      ambientColor: palette.lighting.ambient,
      musicTrack: roomOverride?.musicTrack,
    },

    props,
    npcs: [],
    triggers: [],
    exits,
    spawnPoints,

    tags: [purpose, template.type, ...template.tags],
  };

  ctx.generatedScenes.set(sceneId, scene);
  return scene;
}

// ============================================
// Prop Generation
// ============================================

/**
 * Generate props for a scene based on template rules.
 * 
 * @internal
 */
function generateProps(
  ctx: GeneratorContext,
  template: SceneTemplate,
  width: number,
  height: number,
  _palette: MaterialPalette
): PropDefinition[] {
  const props: PropDefinition[] = [];
  const placedPositions: { x: number; z: number }[] = [];
  
  for (const rule of template.propRules) {
    const count = ctx.rng.nextInt(rule.count.min, rule.count.max);
    
    for (let i = 0; i < count; i++) {
      const propType = ctx.rng.pick(rule.propTypes);
      const position = findPropPosition(
        ctx, 
        rule, 
        width, 
        height, 
        placedPositions, 
        rule.minSpacing ?? 1
      );
      
      if (position) {
        placedPositions.push({ x: position[0], z: position[2] });
        
        // Calculate rotation based on rule
        let rotation = 0;
        if (rule.faceWall) {
          rotation = getWallFacingRotation(position[0], position[2], width, height);
        } else if (rule.faceCenter) {
          rotation = Math.atan2(-position[0], -position[2]);
        } else {
          rotation = ctx.rng.next() * Math.PI * 2;
        }
        
        props.push({
          id: `prop_${++ctx.propCounter}`,
          type: propType as any,
          transform: {
            position,
            rotation: [0, rotation, 0],
            scale: 0.9 + ctx.rng.next() * 0.2, // Slight size variation
          },
          tags: [rule.zone],
        });
      }
    }
  }
  
  return props;
}

/**
 * Find a valid position for a prop based on zone and spacing rules.
 * 
 * @internal
 */
function findPropPosition(
  ctx: GeneratorContext,
  rule: { zone: string; cluster?: boolean; clusterRadius?: number },
  width: number,
  height: number,
  existing: { x: number; z: number }[],
  minSpacing: number
): [number, number, number] | null {
  const hw = width / 2 - 1;  // Half width minus wall buffer
  const hh = height / 2 - 1; // Half height minus wall buffer
  
  // Try up to 20 times to find valid position
  for (let attempt = 0; attempt < 20; attempt++) {
    let x: number, z: number;
    
    // Generate position based on zone
    switch (rule.zone) {
      case 'center':
        // Inner 40% of room
        x = (ctx.rng.next() - 0.5) * width * 0.4;
        z = (ctx.rng.next() - 0.5) * height * 0.4;
        break;
        
      case 'edge':
        // Along walls but not corners
        if (ctx.rng.next() > 0.5) {
          x = (ctx.rng.next() > 0.5 ? 1 : -1) * hw;
          z = (ctx.rng.next() - 0.5) * height * 0.8;
        } else {
          x = (ctx.rng.next() - 0.5) * width * 0.8;
          z = (ctx.rng.next() > 0.5 ? 1 : -1) * hh;
        }
        break;
        
      case 'corner':
        // Corner areas
        x = (ctx.rng.next() > 0.5 ? 1 : -1) * hw * 0.9;
        z = (ctx.rng.next() > 0.5 ? 1 : -1) * hh * 0.9;
        break;
        
      case 'wall':
        // Tight against a wall
        const side = ctx.rng.nextInt(0, 3);
        if (side === 0) { x = -hw; z = (ctx.rng.next() - 0.5) * height * 0.8; }
        else if (side === 1) { x = hw; z = (ctx.rng.next() - 0.5) * height * 0.8; }
        else if (side === 2) { x = (ctx.rng.next() - 0.5) * width * 0.8; z = -hh; }
        else { x = (ctx.rng.next() - 0.5) * width * 0.8; z = hh; }
        break;
        
      default: // 'random'
        x = (ctx.rng.next() - 0.5) * width * 0.9;
        z = (ctx.rng.next() - 0.5) * height * 0.9;
    }
    
    // Check minimum spacing from existing props
    const tooClose = existing.some(p => 
      Math.sqrt((p.x - x) ** 2 + (p.z - z) ** 2) < minSpacing
    );
    
    if (!tooClose) {
      return [x, 0, z];
    }
  }
  
  return null; // Couldn't find valid position
}

/**
 * Calculate rotation to face the nearest wall.
 * 
 * @internal
 */
function getWallFacingRotation(
  x: number, 
  z: number, 
  width: number, 
  height: number
): number {
  const hw = width / 2;
  const hh = height / 2;
  
  // Find nearest wall and return rotation to face it
  const distances = [
    { wall: 'west', dist: Math.abs(x + hw), rot: Math.PI / 2 },
    { wall: 'east', dist: Math.abs(x - hw), rot: -Math.PI / 2 },
    { wall: 'north', dist: Math.abs(z + hh), rot: 0 },
    { wall: 'south', dist: Math.abs(z - hh), rot: Math.PI },
  ];
  
  distances.sort((a, b) => a.dist - b.dist);
  return distances[0].rot;
}

// ============================================
// Scene Connection
// ============================================

/**
 * Connect all scenes based on the stage's connection rules.
 * 
 * This is the core level layout algorithm.
 * Different connection types create different gameplay experiences.
 * 
 * @internal
 */
function connectScenes(
  ctx: GeneratorContext,
  scenes: SceneDefinition[],
  entryId: string,
  exitId: string
): void {
  const rules = ctx.stageDef.generation.connectionRules;
  
  switch (rules.type) {
    case 'linear':
      connectLinear(ctx, scenes, entryId, exitId);
      break;
    case 'branching':
      connectBranching(ctx, scenes, entryId, exitId);
      break;
    case 'hub':
      connectHub(ctx, scenes, entryId, exitId);
      break;
    case 'maze':
    case 'open':
      console.warn(`Connection type "${rules.type}" is not yet implemented. Falling back to branching layout.`);
      connectBranching(ctx, scenes, entryId, exitId);
      break;
    default:
      console.warn(`Unknown connection type "${rules.type}". Falling back to linear layout.`);
      connectLinear(ctx, scenes, entryId, exitId);
  }
}

/**
 * Linear connection: Entry → Room A → Room B → ... → Exit
 * 
 * Creates a straightforward path with no branching.
 * Good for tutorial levels or tight narrative sequences.
 * 
 * @internal
 */
function connectLinear(
  ctx: GeneratorContext,
  scenes: SceneDefinition[],
  entryId: string,
  exitId: string
): void {
  // Shuffle middle scenes (entry and exit stay at ends)
  const middle = scenes.filter(s => s.id !== entryId && s.id !== exitId);
  const shuffled = ctx.rng.shuffle(middle);
  
  const order = [
    scenes.find(s => s.id === entryId)!,
    ...shuffled,
    scenes.find(s => s.id === exitId)!,
  ];
  
  // Connect in sequence
  for (let i = 0; i < order.length - 1; i++) {
    const from = order[i];
    const to = order[i + 1];
    
    createConnection(ctx, from, to, 'south', 'north');
    
    // Place in graph (linear = vertical arrangement)
    if (!ctx.sceneGraph.has(from.id)) {
      placeSceneInGraph(ctx, from.id, { x: 0, z: -i * 15 });
    }
    placeSceneInGraph(ctx, to.id, { x: 0, z: -(i + 1) * 15 });
  }
}

/**
 * Branching connection: Main path with side rooms.
 * 
 * Creates a backbone path from entry to exit with optional
 * side rooms branching off. Good for exploration with clear progression.
 * 
 * ```
 *                    [Side Room]
 *                         │
 * [Entry] → [Room A] → [Hub] → [Room B] → [Exit]
 *                         │
 *                    [Side Room]
 * ```
 * 
 * @internal
 */
function connectBranching(
  ctx: GeneratorContext,
  scenes: SceneDefinition[],
  entryId: string,
  exitId: string
): void {
  const backbone: SceneDefinition[] = [];
  const branches: SceneDefinition[] = [];
  
  // Entry and exit are always on backbone
  backbone.push(scenes.find(s => s.id === entryId)!);
  backbone.push(scenes.find(s => s.id === exitId)!);
  
  // Split remaining scenes: 60% backbone, 40% branches
  const rest = scenes.filter(s => s.id !== entryId && s.id !== exitId);
  const backboneCount = Math.ceil(rest.length * 0.6);
  
  const shuffled = ctx.rng.shuffle(rest);
  backbone.push(...shuffled.slice(0, backboneCount));
  branches.push(...shuffled.slice(backboneCount));
  
  // Connect backbone linearly
  connectLinear(ctx, backbone, entryId, exitId);
  
  // Attach branches to random backbone scenes (not entry/exit)
  const attachPoints = backbone.filter(s => s.id !== entryId && s.id !== exitId);
  
  for (const branch of branches) {
    if (attachPoints.length === 0) break;
    
    const attachTo = ctx.rng.pick(attachPoints);
    const direction = ctx.rng.pick(['east', 'west'] as const);
    const opposite = direction === 'east' ? 'west' : 'east';
    
    createConnection(ctx, attachTo, branch, direction, opposite);
    
    // Place branch scene offset from parent
    const parentNode = ctx.sceneGraph.get(attachTo.id)!;
    const offset = direction === 'east' ? 12 : -12;
    placeSceneInGraph(ctx, branch.id, { 
      x: parentNode.position.x + offset, 
      z: parentNode.position.z 
    });
  }
}

/**
 * Hub connection: Central room with spokes.
 * 
 * Creates a central hub room with all other rooms radiating outward.
 * Good for areas with a central gathering point.
 * 
 * ```
 *         [North]
 *            │
 * [West] ── [Hub] ── [East]
 *            │
 *         [South]
 * ```
 * 
 * @internal
 */
function connectHub(
  ctx: GeneratorContext,
  scenes: SceneDefinition[],
  entryId: string,
  exitId: string
): void {
  // First non-entry/exit scene becomes hub
  const hub = scenes.find(s => s.id !== entryId && s.id !== exitId)!;
  const spokes = scenes.filter(s => s.id !== hub.id);
  
  placeSceneInGraph(ctx, hub.id, { x: 0, z: 0 });
  
  const directions: ('north' | 'south' | 'east' | 'west')[] = ['north', 'south', 'east', 'west'];
  const opposites = { north: 'south', south: 'north', east: 'west', west: 'east' } as const;
  const offsets = {
    north: { x: 0, z: -15 },
    south: { x: 0, z: 15 },
    east: { x: 15, z: 0 },
    west: { x: -15, z: 0 },
  };
  
  // Connect entry first (important for player spawn)
  const entryDir = directions.shift()!;
  const entry = spokes.find(s => s.id === entryId)!;
  createConnection(ctx, hub, entry, entryDir, opposites[entryDir]);
  placeSceneInGraph(ctx, entry.id, offsets[entryDir]);
  
  // Connect exit
  const exitDir = directions.shift()!;
  const exit = spokes.find(s => s.id === exitId)!;
  createConnection(ctx, hub, exit, exitDir, opposites[exitDir]);
  placeSceneInGraph(ctx, exit.id, offsets[exitDir]);
  
  // Connect remaining spokes
  const remaining = spokes.filter(s => s.id !== entryId && s.id !== exitId);
  for (let i = 0; i < remaining.length && i < directions.length; i++) {
    const dir = directions[i];
    createConnection(ctx, hub, remaining[i], dir, opposites[dir]);
    placeSceneInGraph(ctx, remaining[i].id, offsets[dir]);
  }
}

/**
 * Create a bidirectional connection between two scenes.
 * Adds exits to both scenes pointing to each other.
 * 
 * @internal
 */
function createConnection(
  ctx: GeneratorContext,
  from: SceneDefinition,
  to: SceneDefinition,
  fromDir: 'north' | 'south' | 'east' | 'west',
  toDir: 'north' | 'south' | 'east' | 'west'
): void {
  const connectionType = ctx.stageDef.generation.separation;
  
  // Add exit to 'from' scene
  const fromExitPos = getExitPosition(fromDir, from.bounds.width, from.bounds.height);
  from.exits.push({
    id: `exit_${fromDir}_to_${to.id}`,
    direction: fromDir,
    targetScene: to.id,
    targetSpawnPoint: `spawn_${toDir}`,
    position: fromExitPos,
  });
  
  // Add exit to 'to' scene (reverse direction)
  const toExitPos = getExitPosition(toDir, to.bounds.width, to.bounds.height);
  to.exits.push({
    id: `exit_${toDir}_to_${from.id}`,
    direction: toDir,
    targetScene: from.id,
    targetSpawnPoint: `spawn_${fromDir}`,
    position: toExitPos,
  });
  
  // Update scene graph with connection info
  const fromNode = ctx.sceneGraph.get(from.id);
  if (fromNode) {
    fromNode.connections.push({
      targetSceneId: to.id,
      connectionType,
      exitId: `exit_${fromDir}_to_${to.id}`,
      direction: fromDir,
    });
  }
}

/**
 * Get the world position of an exit based on direction.
 * 
 * @internal
 */
function getExitPosition(
  direction: 'north' | 'south' | 'east' | 'west',
  width: number,
  height: number
): [number, number, number] {
  switch (direction) {
    case 'north': return [0, 0, -height / 2];
    case 'south': return [0, 0, height / 2];
    case 'east': return [width / 2, 0, 0];
    case 'west': return [-width / 2, 0, 0];
  }
}

/**
 * Get position for a spawn point at a connection point.
 * 
 * @internal
 */
function getConnectionPointPosition(
  cp: ConnectionPoint,
  width: number,
  height: number
): [number, number, number] {
  const offset = typeof cp.position === 'number' ? cp.position : 0;
  
  switch (cp.side) {
    case 'north': return [offset, 0, -height / 2 + 1];
    case 'south': return [offset, 0, height / 2 - 1];
    case 'east': return [width / 2 - 1, 0, offset];
    case 'west': return [-width / 2 + 1, 0, offset];
    default: return [0, 0, 0];
  }
}

/**
 * Place a scene in the world graph at a position.
 * Handles collision detection to prevent overlapping scenes.
 * 
 * @internal
 */
function placeSceneInGraph(
  ctx: GeneratorContext,
  sceneId: string,
  position: { x: number; z: number }
): void {
  const key = `${position.x},${position.z}`;
  
  // If position is taken, find nearby empty spot
  if (ctx.usedPositions.has(key)) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const newKey = `${position.x + dx * 15},${position.z + dz * 15}`;
        if (!ctx.usedPositions.has(newKey)) {
          position = { x: position.x + dx * 15, z: position.z + dz * 15 };
          break;
        }
      }
    }
  }
  
  ctx.usedPositions.add(`${position.x},${position.z}`);
  ctx.sceneGraph.set(sceneId, {
    sceneId,
    position,
    connections: [],
  });
}

// ============================================
// Quest Item Placement
// ============================================

/**
 * Place quest items in appropriate scenes.
 * 
 * Items are placed according to their spawn rules:
 * - Valid scene types
 * - Visibility zone (hidden, visible, guarded, locked)
 * - Required story beat (item only appears after beat fires)
 * 
 * @internal
 */
function placeQuestItems(
  ctx: GeneratorContext,
  items: QuestItemDef[]
): PlacedQuestItem[] {
  const placed: PlacedQuestItem[] = [];
  const scenes = Array.from(ctx.generatedScenes.values());
  
  for (const item of items) {
    // Find scenes matching item's spawn rules
    const validScenes = scenes.filter(s => 
      item.spawnRules.sceneTypes.some(type => s.tags?.includes(type))
    );
    
    if (validScenes.length === 0) continue;
    
    const scene = ctx.rng.pick(validScenes);
    const position: [number, number, number] = [
      (ctx.rng.next() - 0.5) * scene.bounds.width * 0.6,
      0.5, // Slightly above ground for visibility
      (ctx.rng.next() - 0.5) * scene.bounds.height * 0.6,
    ];
    
    // Add as interactive prop to scene
    scene.props.push({
      id: item.id,
      type: 'custom',
      model: item.model,
      transform: { position },
      interactable: true,
      interaction: {
        type: 'pickup',
        prompt: `Pick up ${item.name}`,
        action: {
          type: 'sequence',
          params: {
            actions: [
              item.pickupDialogue 
                ? { type: 'dialogue', params: { dialogueId: item.pickupDialogue } }
                : null,
              { type: 'despawn', params: { entityId: item.id } },
            ].filter(Boolean),
          },
        },
      },
      tags: ['quest_item'],
    });
    
    placed.push({ itemDef: item, sceneId: scene.id, position });
  }
  
  return placed;
}

// ============================================
// NPC Placement
// ============================================

/**
 * Place required NPCs in scenes.
 * 
 * NPCs can be placed in specific scenes (by ID) or let the generator
 * choose appropriate scenes.
 * 
 * @internal
 */
function placeNPCs(
  ctx: GeneratorContext,
  npcs: RequiredNPC[]
): PlacedNPC[] {
  const placed: PlacedNPC[] = [];
  const scenes = Array.from(ctx.generatedScenes.values());
  
  for (const npc of npcs) {
    let scene: SceneDefinition;
    
    if (npc.sceneId) {
      // Specific scene requested
      scene = ctx.generatedScenes.get(npc.sceneId)!;
    } else {
      // Pick a random non-critical scene
      const candidates = scenes.filter(s => 
        !s.tags?.includes('entry') && !s.tags?.includes('exit')
      );
      scene = candidates.length > 0 ? ctx.rng.pick(candidates) : ctx.rng.pick(scenes);
    }
    
    const position: [number, number, number] = [
      (ctx.rng.next() - 0.5) * scene.bounds.width * 0.5,
      0,
      (ctx.rng.next() - 0.5) * scene.bounds.height * 0.5,
    ];
    
    // Add NPC to scene
    const npcDef: NPCDefinition = {
      id: npc.characterId,
      character: npc.characterId as 'carl' | 'paul',
      transform: { position },
      behavior: npc.behavior,
      dialogue: npc.dialogueId,
      interactable: npc.interactable,
    };
    
    scene.npcs.push(npcDef);
    placed.push({ npcDef: npc, sceneId: scene.id, position });
  }
  
  return placed;
}

// ============================================
// Story Trigger Generation
// ============================================

/**
 * Add trigger zones for story beats.
 * 
 * Story beats with `scene_enter` triggers get automatic trigger zones
 * added to their target scenes.
 * 
 * @internal
 */
function addStoryTriggers(ctx: GeneratorContext): void {
  const beats = ctx.stageDef.story.beats;
  
  for (const beat of beats) {
    if (beat.trigger.type === 'scene_enter') {
      const sceneId = beat.trigger.params.sceneId as string;
      const scene = ctx.generatedScenes.get(sceneId);
      
      if (scene) {
        // Add trigger that covers entire scene
        scene.triggers.push({
          id: `trigger_${beat.id}`,
          type: 'enter',
          shape: 'box',
          transform: { position: [0, 0, 0] },
          size: [scene.bounds.width, 2, scene.bounds.height],
          action: {
            type: 'dialogue',
            params: { dialogueId: beat.dialogueId },
          },
          once: true, // Story beats only fire once
          tags: ['story_beat'],
        });
      }
    }
  }
}
