/**
 * Stage Definition System
 * =======================
 * 
 * This module defines the data structures for procedural stage generation.
 * It follows a "Daggerfall-style" approach where game content is defined
 * declaratively in JSON, then assembled procedurally at runtime.
 * 
 * ## Architecture Overview
 * 
 * ```
 * WorldDefinition
 * └── stages[] ─────────────► StageDefinition
 *     ├── story ────────────► StoryBeat[], StageGoal[]
 *     ├── generation ───────► Templates, Palettes, ConnectionRules
 *     ├── props ────────────► QuestItemDef[], PropPools
 *     └── npcs ─────────────► RequiredNPC[], OptionalPools
 * ```
 * 
 * ## Key Concepts
 * 
 * ### Character Paths
 * The game has two playable characters with opposing narrative paths:
 * - **Carl (Order)**: Methodical, rule-following, increasingly horrified by Paul
 * - **Paul (Chaos)**: Oblivious, chaotic, accidentally causes mayhem
 * 
 * When player picks Carl, Yuka AI controls Paul (chaos behavior).
 * When player picks Paul, Yuka AI controls Carl (order behavior).
 * 
 * ### Stages vs Scenes
 * - **Stage**: A macro-level story section (e.g., "The Apartment", "The Town")
 * - **Scene**: A single room/area within a stage (generated from templates)
 * 
 * ### Procedural Generation Flow
 * 1. StageDefinition specifies WHAT is needed (story beats, required scenes)
 * 2. Templates define HOW scenes can be built (size, connections, props)
 * 3. Generator assembles scenes into a connected graph
 * 4. Quest items and NPCs are placed according to rules
 * 
 * @module StageDefinition
 */

// ============================================
// Story & Character Paths
// ============================================

/**
 * The two narrative paths through the game.
 * Each character experiences the story differently.
 * 
 * - `order`: Carl's path - structured, investigative, horror-aware
 * - `chaos`: Paul's path - oblivious, comedic, accidentally destructive
 */
export type CharacterPath = 'order' | 'chaos';

/**
 * A single beat in the story progression.
 * 
 * Story beats are triggered by player actions and drive the narrative forward.
 * They can unlock new areas, spawn items, change atmosphere, etc.
 * 
 * @example
 * ```json
 * {
 *   "id": "discover_blood",
 *   "description": "Player finds blood in the kitchen",
 *   "dialogueId": "stage1_blood_discovery",
 *   "trigger": {
 *     "type": "scene_enter",
 *     "params": { "sceneId": "kitchen" }
 *   },
 *   "consequences": {
 *     "horrorLevelChange": 2,
 *     "unlockExits": ["basement_door"],
 *     "nextBeat": "find_key"
 *   }
 * }
 * ```
 */
export interface StoryBeat {
  /** Unique identifier for this beat */
  id: string;
  
  /** Human-readable description for debugging/editing */
  description: string;
  
  /** ID of dialogue tree to play when this beat triggers */
  dialogueId: string;
  
  /**
   * What causes this beat to trigger.
   * The generator creates appropriate triggers in scenes.
   */
  trigger: {
    /**
     * Type of trigger:
     * - `scene_enter`: Player enters a specific scene
     * - `scene_exit`: Player leaves a specific scene
     * - `item_pickup`: Player picks up a specific item
     * - `npc_interact`: Player talks to an NPC
     * - `time_elapsed`: Certain time passes in stage
     * - `kills_reached`: (For chaos path) Body count threshold
     */
    type: 'scene_enter' | 'scene_exit' | 'item_pickup' | 'npc_interact' | 'time_elapsed' | 'kills_reached';
    
    /** Parameters specific to trigger type */
    params: Record<string, unknown>;
  };
  
  /**
   * What happens after this beat fires.
   * All consequences are optional.
   */
  consequences?: {
    /** Item IDs to spawn in the world */
    spawnItems?: string[];
    
    /** Item IDs to remove from the world */
    despawnItems?: string[];
    
    /** Exit IDs to unlock (previously locked doors) */
    unlockExits?: string[];
    
    /** Change to horror level (+/- integer) */
    horrorLevelChange?: number;
    
    /** ID of the next story beat (for linear progression) */
    nextBeat?: string;

    /** Marks this beat as the stage completion trigger */
    stageComplete?: boolean;
  };
}

/**
 * A goal the player must complete to progress.
 * 
 * Goals can be visible or hidden, required or optional.
 * They're displayed in the HUD and tracked for stage completion.
 * 
 * @example
 * ```json
 * {
 *   "id": "find_basement_key",
 *   "description": "Find the basement key",
 *   "type": "collect_items",
 *   "params": { "items": ["basement_key"] },
 *   "hiddenUntil": "discover_blood"
 * }
 * ```
 */
export interface StageGoal {
  /** Unique identifier */
  id: string;
  
  /** Text shown to player in HUD */
  description: string;
  
  /**
   * Type of goal:
   * - `reach_scene`: Navigate to a specific scene
   * - `collect_items`: Pick up specified items
   * - `interact_npc`: Talk to an NPC
   * - `survive_time`: Stay alive for duration
   * - `eliminate`: (Chaos path) Defeat enemies
   */
  type: 'reach_scene' | 'collect_items' | 'interact_npc' | 'survive_time' | 'eliminate';
  
  /** Parameters specific to goal type */
  params: Record<string, unknown>;
  
  /** If true, not required for stage completion */
  optional?: boolean;
  
  /** Beat ID that must fire before this goal is revealed */
  hiddenUntil?: string;
}

// ============================================
// Procedural Generation Rules
// ============================================

/**
 * Types of scenes that can be generated.
 * Each type has different generation behaviors.
 * 
 * Interior types have walls, ceilings, and enclosed spaces.
 * Exterior types are open and can connect seamlessly.
 */
export type SceneType = 
  | 'interior_room'      // Standard enclosed room
  | 'interior_hallway'   // Narrow connecting space
  | 'interior_stairs'    // Vertical transition
  | 'exterior_street'    // Open outdoor path
  | 'exterior_plaza'     // Open outdoor area
  | 'exterior_alley'     // Narrow outdoor space
  | 'transition';        // Loading zone between areas

/**
 * How two scenes connect to each other.
 * Affects both visual appearance and navigation.
 * 
 * ```
 * wall_door:     [Room A] ─|█|─ [Room B]   (wall with door)
 * wall_archway:  [Room A] ─| |─ [Room B]   (wall with open arch)
 * open:          [Area A] ───── [Area B]   (no separation)
 * stairs:        [Floor 1] ═╗               (vertical)
 *                          ╚═ [Floor 2]
 * ramp:          [Floor 1] ╱╱╱ [Floor 2]   (sloped connection)
 * loading:       [Area A] ▓▓▓ [Area B]     (triggers load)
 * ```
 */
export type ConnectionType = 
  | 'wall_door'      // Scenes separated by wall with door
  | 'wall_archway'   // Scenes separated by wall with open arch
  | 'open'           // No separation (outdoor areas, open floor plans)
  | 'stairs'         // Vertical connection between floors (stepped)
  | 'ramp'           // Vertical connection between floors (smooth slope)
  | 'loading';       // Major transition (triggers scene load)

// ============================================
// Vertical Transition System
// ============================================

/**
 * A vertical transition connects two scenes at different floor levels.
 * 
 * This is the core concept for procedural multi-floor generation:
 * - Define a transition between two scenes (e.g., basement → main floor)
 * - Specify the height difference and transition type
 * - The renderer calculates the required length for stairs/ramps
 * - Characters navigate by moving TOWARD the transition
 * 
 * ## Navigation Without Jumping
 * 
 * Characters don't need a jump button. The input system only provides X/Z
 * movement vectors, and the game handles Y positioning automatically:
 * 
 * - Walk toward the bottom of stairs/ramp → character rises as they ascend
 * - Walk toward the top of stairs/ramp → character descends
 * - The `getGroundY(x, z)` function from the renderer provides smooth interpolation
 * 
 * This works identically across all input methods:
 * - Keyboard (WASD/arrows)
 * - Touch gestures (drag anywhere)
 * - Gamepad (left stick)
 * 
 * ## Geometry Calculations
 * 
 * Use the helper functions to calculate transition geometry:
 * 
 * ```ts
 * // How long does a 3-unit staircase need to be?
 * const length = calculateTransitionLength('stairs', 3.0); // ~5.4 units
 * 
 * // How many steps in a 3-unit staircase?
 * const steps = calculateStairSteps(3.0); // 17 steps at 0.18m each
 * ```
 * 
 * ## Procedural Generation Integration
 * 
 * When the generator needs to connect floors:
 * 
 * 1. **Calculate space requirements**:
 *    ```ts
 *    const heightDiff = targetFloor.y - sourceFloor.y;
 *    const requiredLength = calculateTransitionLength('stairs', heightDiff);
 *    ```
 * 
 * 2. **Choose transition type** based on available space:
 *    - Stairs: More compact, ~1.8:1 run:rise ratio
 *    - Ramps: Require more space, ~3:1 run:rise ratio
 *    - Ladders: Minimal space, but require interaction to use
 * 
 * 3. **Create the transition** using StageRenderer:
 *    ```ts
 *    const transition = createVerticalTransition(scene, {
 *      type: 'stairs',
 *      heightDifference: heightDiff,
 *      width: 1.5,
 *      direction: 'north',
 *      position: { x: 0, z: connectionPoint.z }
 *    });
 *    ```
 * 
 * 4. **Store for runtime navigation**:
 *    ```ts
 *    connection.getGroundY = transition.getGroundY;
 *    connection.bounds = transition.bounds;
 *    ```
 * 
 * @example
 * ```json
 * {
 *   "id": "basement_to_hallway",
 *   "type": "stairs",
 *   "sourceScene": "basement",
 *   "targetScene": "hallway",
 *   "heightDifference": 3.0,
 *   "direction": "north",
 *   "bottomPosition": [0, 0, 4],
 *   "width": 1.5
 * }
 * ```
 * 
 * @see calculateTransitionLength - Calculate required horizontal space
 * @see calculateStairSteps - Calculate number of steps for stairs
 * @see createVerticalTransition - Render the transition in StageRenderer
 */
export interface VerticalTransition {
  /** Unique identifier */
  id: string;
  
  /**
   * Type of vertical transition:
   * - `stairs`: Stepped surface, 2:1 run:rise ratio typical
   * - `ramp`: Smooth slope, 4:1 run:rise for accessibility
   * - `ladder`: Vertical, minimal horizontal space
   * - `elevator`: Instant transition, requires interaction
   */
  type: 'stairs' | 'ramp' | 'ladder' | 'elevator';
  
  /** Scene ID at the bottom of the transition */
  sourceScene: string;
  
  /** Scene ID at the top of the transition */
  targetScene: string;
  
  /**
   * Height difference in world units.
   * Positive = target is above source.
   * Standard room height is ~3.0 units.
   */
  heightDifference: number;
  
  /**
   * Direction the transition faces (from bottom looking up).
   * Determines which wall/edge the transition is placed against.
   */
  direction: 'north' | 'south' | 'east' | 'west';
  
  /**
   * Position of the bottom of the transition in the source scene.
   * [x, y, z] in local scene coordinates.
   */
  bottomPosition: [number, number, number];
  
  /** Width of the transition (perpendicular to direction) */
  width: number;
  
  /**
   * Optional: Override calculated length.
   * If not set, length is calculated from heightDifference and type.
   */
  length?: number;
  
  /** Material/visual style */
  style?: {
    material?: string;
    handrails?: boolean;
    lighting?: boolean;
  };
}

/**
 * Calculate the required length for a vertical transition.
 * 
 * @param type - Transition type
 * @param heightDifference - Height to traverse
 * @returns Required horizontal length
 */
export function calculateTransitionLength(
  type: VerticalTransition['type'],
  heightDifference: number
): number {
  const absHeight = Math.abs(heightDifference);
  
  switch (type) {
    case 'stairs':
      // Standard stair ratio: ~1.8:1 run:rise (comfortable climb)
      // Each step: 0.18m rise, 0.28m run
      return absHeight * 1.8;
      
    case 'ramp':
      // ADA-compliant ramp: 1:12 slope (4.8 degrees)
      // For games, we use 1:4 for more reasonable lengths
      return absHeight * 4;
      
    case 'ladder':
      // Ladders are nearly vertical, minimal horizontal footprint
      return 0.4;
      
    case 'elevator':
      // Elevators have no horizontal traversal
      return 1.0; // Just the cabin size
      
    default:
      return absHeight * 2;
  }
}

/**
 * Calculate the number of steps for a staircase.
 * 
 * @param heightDifference - Total height
 * @param stepHeight - Height per step (default: 0.18m)
 * @returns Number of steps
 */
export function calculateStairSteps(
  heightDifference: number,
  stepHeight: number = 0.18
): number {
  return Math.ceil(Math.abs(heightDifference) / stepHeight);
}

/**
 * A collection of materials for consistent visual theming.
 * 
 * Palettes ensure generated scenes have cohesive aesthetics.
 * Multiple palettes can be available per stage for variety.
 * 
 * @example
 * ```json
 * {
 *   "id": "apartment_worn",
 *   "name": "Worn Apartment",
 *   "floors": {
 *     "primary": { "color": [0.35, 0.28, 0.2] },
 *     "worn": { "color": [0.3, 0.24, 0.18] }
 *   },
 *   "walls": {
 *     "primary": { "color": [0.55, 0.5, 0.45] }
 *   },
 *   "lighting": {
 *     "ambient": [0.9, 0.85, 0.75],
 *     "intensity": 0.6
 *   }
 * }
 * ```
 */
export interface MaterialPalette {
  /** Unique identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Floor material variants */
  floors: {
    /** Main floor material */
    primary: MaterialDef;
    /** Accent areas (rugs, different sections) */
    accent?: MaterialDef;
    /** Damaged/aged variant */
    worn?: MaterialDef;
  };
  
  /** Wall material variants */
  walls: {
    /** Main wall material */
    primary: MaterialDef;
    /** Trim, baseboards, molding */
    trim?: MaterialDef;
    /** Damaged/aged variant */
    damaged?: MaterialDef;
  };
  
  /** Prop pool IDs that fit this palette's aesthetic */
  propSets: string[];
  
  /** Lighting configuration */
  lighting: {
    /** RGB ambient light color (0-1 each) */
    ambient: [number, number, number];
    /** Light intensity multiplier */
    intensity: number;
    /** Whether to enable shadow casting */
    shadows: boolean;
  };
}

/**
 * Definition of a single material's visual properties.
 */
export interface MaterialDef {
  /** RGB color (0-1 each) */
  color: [number, number, number];
  /** Optional texture path */
  texture?: string;
  /** PBR roughness (0 = shiny, 1 = matte) */
  roughness?: number;
  /** PBR metallic (0 = non-metal, 1 = metal) */
  metallic?: number;
}

// ============================================
// Scene Templates (snappable building blocks)
// ============================================

/**
 * A template for procedurally generating scenes.
 * 
 * Templates define the "shape" of a scene:
 * - Size constraints (randomized within bounds)
 * - Where connections can be made (doors, arches)
 * - What props can spawn and where
 * 
 * Templates are tagged for filtering during generation.
 * A stage might only allow certain templates.
 * 
 * @example
 * ```json
 * {
 *   "id": "room_kitchen",
 *   "type": "interior_room",
 *   "size": {
 *     "width": { "min": 6, "max": 10 },
 *     "height": { "min": 6, "max": 8 }
 *   },
 *   "connectionPoints": [
 *     { "id": "south", "side": "south", "position": "center",
 *       "allowedConnections": ["wall_door", "wall_archway"] }
 *   ],
 *   "propRules": [
 *     { "propTypes": ["counter"], "zone": "wall", "count": { "min": 2, "max": 3 } }
 *   ],
 *   "tags": ["kitchen", "apartment"]
 * }
 * ```
 */
export interface SceneTemplate {
  /** Unique identifier */
  id: string;
  
  /** Type of scene this generates */
  type: SceneType;
  
  /**
   * Size constraints for the generated scene.
   * Actual size is randomized within these bounds.
   */
  size: {
    /** Width (X axis) in world units */
    width: { min: number; max: number };
    /** Depth (Z axis) in world units */
    height: { min: number; max: number };
    /** Ceiling height (Y axis) for interiors */
    ceiling?: { min: number; max: number };
  };
  
  /**
   * Points where this scene can connect to others.
   * Each point defines valid connection types and positions.
   */
  connectionPoints: ConnectionPoint[];
  
  /**
   * Rules for procedural prop placement.
   * Each rule specifies what can spawn, where, and how many.
   */
  propRules: PropPlacementRule[];
  
  /**
   * Features that MUST be present in scenes using this template.
   * Used for validation and special scene requirements.
   */
  requiredFeatures?: string[];
  
  /**
   * Tags for filtering templates during generation.
   * Stages can require templates with specific tags.
   */
  tags: string[];
}

/**
 * A point where a scene can connect to another scene.
 * 
 * Connection points are like "sockets" - they define where
 * doors/arches/openings can be placed on a scene's boundary.
 * 
 * ```
 *        north
 *     ┌────●────┐
 *     │         │
 * west●         ●east
 *     │         │
 *     └────●────┘
 *        south
 * ```
 */
export interface ConnectionPoint {
  /** Unique identifier within this template */
  id: string;
  
  /** Which wall/side this connection is on */
  side: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  
  /**
   * Position along the wall:
   * - `center`: Middle of the wall
   * - `left`: Left third of the wall
   * - `right`: Right third of the wall
   * - number: Specific offset from center in world units
   */
  position: 'center' | 'left' | 'right' | number;
  
  /** Connection types allowed at this point */
  allowedConnections: ConnectionType[];
  
  /** Scene types that can connect here (empty = any) */
  allowedSceneTypes?: SceneType[];
  
  /** If true, something MUST connect here (no dead end) */
  required?: boolean;
}

/**
 * Rules for placing props within a scene.
 * 
 * Each rule defines a category of props that can spawn
 * in specific zones with count constraints.
 * 
 * @example
 * ```json
 * {
 *   "propTypes": ["chair", "stool"],
 *   "zone": "corner",
 *   "count": { "min": 0, "max": 2 },
 *   "faceCenter": true,
 *   "minSpacing": 1.5
 * }
 * ```
 */
export interface PropPlacementRule {
  /** Prop type IDs that can satisfy this rule */
  propTypes: string[];
  
  /**
   * Zone within the scene where props spawn:
   * - `center`: Middle area of the room
   * - `edge`: Along the walls (not corners)
   * - `corner`: In the corners
   * - `wall`: Against a wall (tighter than edge)
   * - `random`: Anywhere in the room
   */
  zone: 'center' | 'edge' | 'corner' | 'wall' | 'random';
  
  /** How many props to spawn (randomized within range) */
  count: { min: number; max: number };
  
  /** Minimum distance between props of this rule */
  minSpacing?: number;
  
  /** If true, prop rotates to face nearest wall */
  faceWall?: boolean;
  
  /** If true, prop rotates to face room center */
  faceCenter?: boolean;
  
  /** If true, props spawn in groups rather than spread out */
  cluster?: boolean;
  
  /** Radius of cluster if clustering is enabled */
  clusterRadius?: number;
}

// ============================================
// Quest Items & Special Props
// ============================================

/**
 * Definition of a quest-critical item.
 * 
 * Quest items are special props that:
 * - Have unique interactions (pickup, examine)
 * - Trigger story beats when interacted with
 * - May only spawn after certain conditions
 * 
 * @example
 * ```json
 * {
 *   "id": "basement_key",
 *   "name": "Rusty Key",
 *   "description": "An old key with a tag that says 'BASEMENT'",
 *   "pickupDialogue": "stage1_pickup_key",
 *   "spawnRules": {
 *     "sceneTypes": ["interior_room"],
 *     "zones": ["hidden"],
 *     "requiredBeat": "discover_blood"
 *   }
 * }
 * ```
 */
export interface QuestItemDef {
  /** Unique identifier */
  id: string;
  
  /** Display name shown to player */
  name: string;
  
  /** Description shown when examining */
  description: string;
  
  /** Path to 3D model (optional, uses default if not set) */
  model?: string;
  
  /** Dialogue ID triggered when item is picked up */
  pickupDialogue?: string;
  
  /** Dialogue ID triggered when item is examined (not picked up) */
  examineDialogue?: string;
  
  /** Rules for where/when this item can spawn */
  spawnRules: {
    /** Scene types where this can appear */
    sceneTypes: SceneType[];
    
    /**
     * Placement zones:
     * - `hidden`: Hard to find (behind objects, in containers)
     * - `visible`: Obvious placement (on tables, in open)
     * - `guarded`: Near enemies or hazards
     * - `locked`: Behind locked doors/containers
     */
    zones: ('hidden' | 'visible' | 'guarded' | 'locked')[];
    
    /** Story beat ID that must fire before this spawns */
    requiredBeat?: string;
  };
}

// ============================================
// Stage Definition (the main DDL structure)
// ============================================

/**
 * Complete definition of a game stage.
 * 
 * A stage is a self-contained section of the game with:
 * - Its own story beats and goals
 * - Procedural generation rules
 * - Atmosphere and difficulty settings
 * 
 * Stages are the primary unit of content authoring.
 * Authors define WHAT should happen; the generator builds HOW.
 * 
 * @example
 * ```json
 * {
 *   "id": "stage1_apartment",
 *   "name": "The Morning After",
 *   "path": "both",
 *   "story": {
 *     "beats": [...],
 *     "goals": [...],
 *     "startingBeat": "wake_up",
 *     "completionGoals": ["escape_apartment"]
 *   },
 *   "generation": {
 *     "entryScene": { "templateTags": ["living_room"] },
 *     "exitScene": { "templateTags": ["basement"] },
 *     "connectionRules": { "type": "branching" }
 *   },
 *   "atmosphere": {
 *     "baseHorrorLevel": 2,
 *     "horrorProgression": "increasing"
 *   }
 * }
 * ```
 */
export interface StageDefinition {
  /** Unique identifier */
  id: string;
  
  /** Display name for stage select / loading screens */
  name: string;
  
  /** Brief description of the stage */
  description: string;
  
  /**
   * Which character path this stage belongs to:
   * - `order`: Only Carl plays this stage
   * - `chaos`: Only Paul plays this stage
   * - `both`: Both characters play this stage (different perspectives)
   */
  path: CharacterPath | 'both';
  
  // ─────────────────────────────────────────
  // Story Structure
  // ─────────────────────────────────────────
  
  story: {
    /** All story beats in this stage */
    beats: StoryBeat[];
    
    /** All goals (visible objectives) */
    goals: StageGoal[];
    
    /** Which beat triggers at stage start */
    startingBeat: string;
    
    /** Goal IDs that must be complete to finish stage */
    completionGoals: string[];
  };
  
  // ─────────────────────────────────────────
  // Procedural Generation Configuration
  // ─────────────────────────────────────────
  
  generation: {
    /** Template requirements for the entry scene */
    entryScene: RequiredScene;

    /** Template requirements for the exit scene */
    exitScene: RequiredScene;

    /** Scenes that MUST be generated (story-critical) */
    requiredScenes: RequiredScene[];

    /** Range of optional filler scenes to generate */
    optionalSceneCount: { min: number; max: number };

    /** Template IDs that can be used in this stage */
    allowedTemplates: string[];

    /** Palette IDs to use for this stage */
    palettes: string[];

    /**
     * How scenes connect to each other.
     * Different connection types create different level layouts.
     */
    connectionRules: {
      /**
       * Layout algorithm:
       * - `linear`: A → B → C → D (straight path)
       * - `branching`: Main path with side rooms
       * - `hub`: Central room with spokes
       * - `maze`: Complex interconnected layout
       * - `open`: Outdoor/no walls
       */
      type: 'linear' | 'branching' | 'hub' | 'maze' | 'open';

      /** Maximum dead-end branches allowed */
      maxDeadEnds?: number;

      /** Whether scenes can loop back (creates shortcuts) */
      loopsAllowed?: boolean;

      /** Maximum scenes away from entry */
      maxDistanceFromEntry?: number;
    };

    /**
     * Environment type:
     * - `interior`: Enclosed spaces with walls/ceilings
     * - `exterior`: Open outdoor areas
     * - `mixed`: Both (e.g., building + courtyard)
     */
    environment: 'interior' | 'exterior' | 'mixed';

    /** Default connection type between scenes */
    separation: ConnectionType;
  };

  // ─────────────────────────────────────────
  // Layout Configuration (archetype-driven)
  // ─────────────────────────────────────────

  /**
   * Layout archetype and per-level overrides.
   *
   * If provided, the generator uses this instead of the flat
   * connectionRules to produce multi-level floor plans with
   * distinct patterns per level.
   *
   * The `archetypeId` references a LayoutArchetype from
   * layout-archetypes.json. Per-level overrides in `levels`
   * are merged on top of the archetype's defaults.
   */
  layout?: {
    /** ID of the layout archetype to use */
    archetypeId: string;

    /**
     * Per-level overrides.
     * Each entry is keyed by level number and merged with
     * the archetype's level config. Only specified fields
     * are overridden.
     */
    levelOverrides?: Record<number, Partial<LevelConfig>>;
  };
  
  // ─────────────────────────────────────────
  // Props and Items
  // ─────────────────────────────────────────
  
  props: {
    /**
     * Overall prop density:
     * - `sparse`: Few props, empty feeling
     * - `normal`: Standard furnishing
     * - `cluttered`: Many props, cramped feeling
     */
    density: 'sparse' | 'normal' | 'cluttered';
    
    /** Quest-critical items for this stage */
    questItems: QuestItemDef[];
    
    /** Prop pool IDs to draw decorative props from */
    propPools: string[];
  };
  
  // ─────────────────────────────────────────
  // NPCs
  // ─────────────────────────────────────────
  
  npcs: {
    /** NPCs that MUST appear in this stage */
    required: RequiredNPC[];
    
    /** Optional NPCs randomly added */
    optional: {
      /** NPC pool to draw from */
      pool: string[];
      /** How many optional NPCs to add */
      count: { min: number; max: number };
    };
  };
  
  // ─────────────────────────────────────────
  // Atmosphere
  // ─────────────────────────────────────────
  
  atmosphere: {
    /**
     * Starting horror level (0-10).
     * Affects lighting, fog, ambient sounds.
     */
    baseHorrorLevel: number;
    
    /**
     * How horror level changes over time:
     * - `static`: Stays constant
     * - `increasing`: Gradually gets scarier
     * - `wave`: Alternates between tense and calm
     */
    horrorProgression: 'static' | 'increasing' | 'wave';
    
    /** Ambient sound ID to play */
    ambientSound?: string;

    /** Music track ID to play */
    musicTrack?: string;

    /** Per-room atmosphere overrides keyed by room purpose */
    perRoomOverrides?: Record<string, {
      horrorLevel?: number;
      ambientSound?: string;
      musicTrack?: string;
    }>;
  };
  
  // ─────────────────────────────────────────
  // Meta
  // ─────────────────────────────────────────
  
  /** Expected play time in minutes */
  estimatedDuration: number;
  
  /** Difficulty rating */
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Requirements for a scene that MUST be generated.
 * 
 * Used for entry/exit scenes and story-critical locations.
 * The generator finds a template matching these requirements.
 */
export interface RequiredScene {
  /** Specific template ID to use (mutually exclusive with templateTags) */
  templateId?: string;
  
  /** Pick from templates with ANY of these tags */
  templateTags?: string[];
  
  /** Human-readable purpose (for debugging) */
  purpose: string;
  
  /** Things that must be in this scene */
  mustContain?: {
    /** Quest item IDs */
    questItems?: string[];
    /** NPC IDs */
    npcs?: string[];
    /** Required features (from template) */
    features?: string[];
  };
  
  /** Connection constraints */
  connections?: {
    /** Scene IDs this must connect to */
    mustConnectTo?: string[];
    /** Scene IDs this cannot connect to */
    cannotConnectTo?: string[];
  };
  
  /** Placement hints for the generator */
  placement?: {
    /** Distance (in scenes) from entry */
    distanceFromEntry?: { min: number; max: number };
    /** Preferred position in overall layout */
    preferredZone?: 'early' | 'middle' | 'late';
  };
}

/**
 * An NPC that must appear in the stage.
 */
export interface RequiredNPC {
  /** Character ID (e.g., "carl", "paul") */
  characterId: string;
  
  /** Specific scene ID to place in (null = generator decides) */
  sceneId?: string;
  
  /**
   * AI behavior:
   * - `idle`: Stays in place
   * - `patrol`: Follows a path
   * - `wander`: Moves randomly
   * - `scripted`: Controlled by story beats
   */
  behavior: 'idle' | 'patrol' | 'wander' | 'scripted';
  
  /** Dialogue tree ID when player talks to them */
  dialogueId: string;
  
  /** Whether player can interact with this NPC */
  interactable: boolean;
}

// ============================================
// Layout Archetypes & Per-Level Configuration
// ============================================

/**
 * Layout patterns control how rooms are arranged on a floor level.
 * Each pattern has a distinct spatial signature:
 *
 * ```
 * linear:     [A]→[B]→[C]→[D]         straight corridor
 * branching:  [A]→[B]→[C]→[D]          main path + side rooms
 *                  ↓
 *                 [E]
 * hub:            [N]                   spokes from center
 *             [W]←[H]→[E]
 *                 [S]
 * grid:       [A][B][C]                 rooms at grid cells
 *             [D][E][F]
 * square:     [NW][NE]                  4 corners + optional center
 *               [C]
 *             [SW][SE]
 * l_shape:    [A][B]                    L-turn layout
 *                [C]
 *                [D]
 * radial:     rooms spiral outward from center
 * ```
 */
export type LayoutPattern =
  | 'linear'      // Rooms in a straight line
  | 'branching'   // Main path with side branches
  | 'hub'         // Central room with spokes radiating out
  | 'grid'        // Rooms arranged on a regular grid
  | 'square'      // Four corners around a center
  | 'l_shape'     // L-shaped corridor
  | 'radial';     // Spiral outward from a center room

/**
 * Per-level layout configuration within a stage.
 *
 * Each floor level in a stage can have its own pattern, room count,
 * anchor positions, and filler rules. This allows a stage like
 * "apartment + basement" to use `branching` for the main floor
 * and `linear` for the cramped basement.
 *
 * @example
 * ```json
 * {
 *   "level": 0,
 *   "name": "Main Floor",
 *   "pattern": "branching",
 *   "totalRooms": { "min": 5, "max": 8 },
 *   "anchorRooms": [
 *     { "purpose": "kitchen", "gridPosition": { "x": 0, "z": -1 }, "templateTags": ["kitchen"] }
 *   ],
 *   "fillerRules": {
 *     "allowedTemplates": ["room_small", "hallway_short", "closet"],
 *     "growthStrategy": "adjacent"
 *   }
 * }
 * ```
 */
export interface LevelConfig {
  /** Floor level (0 = ground, -1 = basement, 1 = upstairs, etc.) */
  level: number;

  /** Display name for this floor */
  name: string;

  /** Layout pattern to use for this floor */
  pattern: LayoutPattern;

  /** Target total room count (anchors + fillers) */
  totalRooms: { min: number; max: number };

  /**
   * Anchor rooms that MUST be placed on this floor.
   * These are story-critical or structurally important rooms.
   * Filler count = totalRooms - anchor count.
   */
  anchorRooms: LevelAnchorRoom[];

  /**
   * Rules for placing filler rooms around anchors.
   */
  fillerRules: {
    /** Template IDs allowed for fillers on this level */
    allowedTemplates: string[];

    /**
     * How fillers are placed:
     * - `adjacent`: Grow outward from anchors (good for interiors)
     * - `path`: Fill gaps along the main path between anchors
     * - `ring`: Place fillers in a ring around the center
     */
    growthStrategy: 'adjacent' | 'path' | 'ring';

    /** Palette ID override for fillers (uses stage default if not set) */
    palette?: string;
  };

  /**
   * Vertical connections FROM this level to other levels.
   * E.g., stairs going down from level 0 to level -1.
   */
  verticalConnections: LevelVerticalConnection[];

  /** Palette ID override for this entire level */
  palette?: string;
}

/**
 * An anchor room on a specific floor level.
 * Anchors are placed first, then fillers grow around them.
 */
export interface LevelAnchorRoom {
  /** Purpose/role of this room (entry, kitchen, bedroom, etc.) */
  purpose: string;

  /** Fixed grid position on this floor */
  gridPosition: { x: number; z: number };

  /** Template ID to use (mutually exclusive with templateTags) */
  templateId?: string;

  /** Tags to match templates against */
  templateTags?: string[];

  /** Story beat IDs that trigger in this room */
  storyBeats?: string[];

  /** Quest item IDs that spawn in this room */
  questItems?: string[];

  /** Whether this room serves as the stage entry point */
  isEntry?: boolean;

  /** Whether this room serves as the stage exit point */
  isExit?: boolean;
}

/**
 * A vertical connection between floor levels.
 */
export interface LevelVerticalConnection {
  /** Grid position of the connection on this level */
  gridPosition: { x: number; z: number };

  /** Direction: 'up' to go to a higher level, 'down' to go lower */
  direction: 'up' | 'down';

  /** Target level number */
  targetLevel: number;

  /** Type of vertical transition */
  type: 'stairs' | 'ramp' | 'ladder' | 'elevator';

  /** Whether this connection is locked (requires key/event) */
  locked?: boolean;

  /** Lock ID if locked */
  lockId?: string;
}

/**
 * A layout archetype defines the spatial DNA for a type of environment.
 *
 * Archetypes capture the "feel" of a space:
 * - An apartment uses `branching` with rooms off a hallway
 * - A dungeon uses `linear` with rooms in sequence
 * - A town uses `grid` with streets between buildings
 * - A house uses `hub` (entry hall) with rooms radiating out
 *
 * Stages reference an archetype and can override specific settings.
 * The generator reads the archetype to determine per-level patterns,
 * anchor placement, and filler calculation.
 */
export interface LayoutArchetype {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of the spatial style */
  description: string;

  /** Environment type */
  environment: 'interior' | 'exterior' | 'mixed';

  /** Per-level configurations (the core of the archetype) */
  levels: LevelConfig[];

  /** Connection rules for this archetype */
  connectionRules: {
    /** Default connection type between rooms */
    defaultType: ConnectionType;
    /** Connection type for hallways */
    hallwayType?: ConnectionType;
    /** Connection type for building entries (exterior → interior) */
    buildingEntryType?: ConnectionType;
    /** Connection type for secret passages */
    secretType?: ConnectionType;
    /** Max doors per room */
    maxDoorsPerRoom: number;
  };
}

// ============================================
// Module Composition (for reuse)
// ============================================

/**
 * A reusable generation module.
 * 
 * Modules encapsulate generation rules that can be nested.
 * For example, a "town" module might reuse "house" modules
 * to generate buildings along streets.
 * 
 * ```
 * Town Module
 * ├── Street scenes (from street templates)
 * ├── House Module (instance 1)
 * │   ├── Living room
 * │   ├── Kitchen
 * │   └── Bedroom
 * ├── House Module (instance 2)
 * │   └── ...
 * └── Plaza scene
 * ```
 */
export interface CompositionModule {
  /** Unique identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of what this module generates */
  description: string;
  
  /**
   * What this module produces:
   * - `building`: A single structure
   * - `room_cluster`: A group of connected rooms
   * - `street_block`: A section of outdoor area with buildings
   * - `dungeon_section`: A section of dungeon
   */
  output: 'building' | 'room_cluster' | 'street_block' | 'dungeon_section';
  
  /** Generation rules (subset of StageDefinition.generation) */
  generation: {
    /** Template IDs to use */
    templates: string[];
    /** Connection rules */
    connectionRules: StageDefinition['generation']['connectionRules'];
    /** Indoor or outdoor */
    environment: 'interior' | 'exterior';
    /** How scenes connect */
    separation: ConnectionType;
  };
  
  /** How this module connects to parent modules */
  externalConnections: {
    /** Number of entry points */
    entries: number;
    /** Number of exit points */
    exits: number;
    /** Which sides can have external connections */
    sides: ('north' | 'south' | 'east' | 'west')[];
  };
  
  /** Size bounds for the entire module */
  bounds: {
    width: { min: number; max: number };
    depth: { min: number; max: number };
  };
}

// ============================================
// World Structure
// ============================================

/**
 * Top-level world definition.
 * 
 * Contains all stages, modules, templates, and palettes
 * needed to generate a complete game world.
 */
export interface WorldDefinition {
  /** Unique identifier */
  id: string;
  
  /** Game world name */
  name: string;
  
  /** Stage ordering for each path */
  stages: {
    /** Stage IDs for Carl's playthrough (in order) */
    order: string[];
    /** Stage IDs for Paul's playthrough (in order) */
    chaos: string[];
    /** Stage IDs both characters share */
    shared: string[];
  };
  
  /** Reusable composition modules */
  modules: CompositionModule[];
  
  /** Available material palettes */
  palettes: MaterialPalette[];
  
  /** Available scene templates */
  templates: SceneTemplate[];
  
  /** Prop pools (name → prop type IDs) */
  propPools: Record<string, string[]>;
}

// ============================================
// Generation Seed & RNG
// ============================================

/**
 * Seeds for deterministic generation.
 * Same seeds always produce the same world.
 */
export interface GenerationSeed {
  /** Seed for world-level decisions */
  worldSeed: string;
  /** Seed for stage-level decisions */
  stageSeed: string;
}

/**
 * Hash a string seed into a numeric value.
 * Used to initialize the RNG.
 * 
 * @param seed - String seed to hash
 * @returns Positive 32-bit integer
 */
export function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Create a seeded random number generator.
 * 
 * Uses a linear congruential generator for deterministic
 * pseudo-random numbers. Same seed = same sequence.
 * 
 * @param seed - Numeric seed from hashSeed()
 * @returns RNG object with utility methods
 * 
 * @example
 * ```ts
 * const rng = createRNG(hashSeed("my-world-seed"));
 * const value = rng.next();        // 0.0 to 1.0
 * const roll = rng.nextInt(1, 6);  // 1 to 6
 * const item = rng.pick(items);    // Random item from array
 * ```
 */
export function createRNG(seed: number) {
  let state = seed;
  
  return {
    /**
     * Get next random number between 0 and 1.
     */
    next(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
    
    /**
     * Get random integer in range [min, max] inclusive.
     */
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    
    /**
     * Pick random element from array.
     */
    pick<T>(array: T[]): T {
      return array[Math.floor(this.next() * array.length)];
    },
    
    /**
     * Shuffle array (Fisher-Yates).
     * Returns new array, doesn't modify original.
     */
    shuffle<T>(array: T[]): T[] {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }
  };
}
