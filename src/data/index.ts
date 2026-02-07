/**
 * Data Module
 * ===========
 * 
 * Central location for loading game data from JSON DDL files.
 * All game content (props, dialogues, stages, etc.) should be defined
 * in JSON files and loaded through this module.
 * 
 * ## Directory Structure
 * 
 * ```
 * src/data/
 * ├── index.ts                    <- This file (exports all data)
 * ├── game.json                   <- Master game definition & stage progression
 * │
 * ├── global/                     <- REUSABLE content across all stages
 * │   ├── props.json              <- Prop mesh/material definitions
 * │   ├── palettes.json           <- Material palettes for rooms
 * │   ├── dialogues/
 * │   │   └── prop-dialogues.json <- Default dialogue for prop interactions
 * │   └── templates/
 * │       └── rooms.json          <- Room templates for procedural gen
 * │
 * └── stages/                     <- STAGE-SPECIFIC content
 *     ├── stage1/
 *     │   ├── definition.json     <- Stage config, story beats, generation rules
 *     │   ├── dialogues/
 *     │   │   └── story.json      <- Stage-specific story dialogues & overrides
 *     │   └── scenes/
 *     │       └── apartment.json  <- Hand-crafted scene definitions
 *     ├── stage2/
 *     │   └── definition.json
 *     └── stage3/
 *         └── definition.json
 * ```
 * 
 * ## Data Loading Strategy
 * 
 * - **Global data**: Loaded once at startup, cached
 * - **Stage data**: Loaded when stage is entered, can be unloaded
 * - **Dialogues**: Merged (stage-specific overrides global)
 * 
 * ## Usage
 * 
 * ```ts
 * import { propDefinitions, propDialogues, getPropDefinition } from '../data';
 * 
 * // Get prop mesh definition
 * const tableDef = getPropDefinition('table');
 * 
 * // Get dialogue for a prop (checks stage overrides first)
 * const dialogue = getPropDialogue('couch', 'stage1_apartment');
 * ```
 */

// Import global JSON data files
import propsData from './global/props.json';
import propDialoguesData from './global/dialogues/prop-dialogues.json';
import gameData from './game.json';
import layoutArchetypesData from './global/templates/layout-archetypes.json';
import roomTemplatesData from './global/templates/rooms.json';

// ============================================
// Type Definitions
// ============================================

export interface PropMeshDefinition {
  type: 'box' | 'cylinder' | 'composite';
  width?: number;
  height?: number;
  depth?: number;
  size?: number;
  diameter?: number;
  diameterTop?: number;
  diameterBottom?: number;
  yOffset?: number;
  position?: [number, number, number];
  color?: [number, number, number];
  emissive?: [number, number, number];
  parts?: PropMeshDefinition[];
}

export interface PropDefinition {
  mesh: PropMeshDefinition;
  material: {
    color: [number, number, number];
    emissive?: [number, number, number];
  };
  collision: {
    radius: number;
  };
}

export interface PropsData {
  props: Record<string, PropDefinition>;
  defaultProp: PropDefinition;
}

export interface PropDialogue {
  carl: string[];
  paul: string[];
  horror?: string[];
  prompt: string;
}

export interface PropDialoguesData {
  dialogues: Record<string, PropDialogue>;
  defaultDialogue: {
    carl: string[];
    paul: string[];
    prompt: string;
  };
}

// ============================================
// Exported Data
// ============================================

// ============================================
// Game Definition
// ============================================

export interface GameDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  characters: Record<string, { id: string; name: string; path: string; description: string; color: string }>;
  paths: Record<string, { id: string; name: string; description: string; playableCharacter: string; aiCharacter: string }>;
  stageProgression: {
    stages: Array<{
      id: string;
      name: string;
      file: string;
      availablePaths: string[];
      unlockCondition: unknown;
      transitions: { next: string | null; conditions: unknown };
    }>;
    startingStage: string;
  };
  globalSettings: unknown;
  globalData: Record<string, string>;
}

/**
 * Master game definition.
 * Contains stage progression, character info, and references to global data.
 */
export const gameDefinition = gameData as unknown as GameDefinition;

// ============================================
// Global Data (Reusable Across Stages)
// ============================================

/**
 * Prop definitions for mesh generation.
 * Contains geometry, material, and collision info for each prop type.
 */
export const propDefinitions = propsData as unknown as PropsData;

/**
 * Default dialogue lines for prop interactions.
 * Keyed by prop type, contains carl/paul lines and horror variants.
 * Stage-specific dialogues can override these.
 */
export const propDialogues = propDialoguesData as unknown as PropDialoguesData;

// ============================================
// Helper Functions
// ============================================

// ============================================
// Stage Data Loading
// ============================================

/**
 * Get the list of all stages in order.
 */
export function getStageList(): Array<{ id: string; name: string; file: string }> {
  return gameDefinition.stageProgression.stages.map(s => ({
    id: s.id,
    name: s.name,
    file: s.file
  }));
}

/**
 * Get the starting stage ID.
 */
export function getStartingStage(): string {
  return gameDefinition.stageProgression.startingStage;
}

/**
 * Get the next stage after a given stage.
 */
export function getNextStage(currentStageId: string): string | null {
  const stage = gameDefinition.stageProgression.stages.find(s => s.id === currentStageId);
  return stage?.transitions.next || null;
}

// ============================================
// Prop Helpers
// ============================================

/**
 * Get prop definition by type, with fallback to default.
 */
export function getPropDefinition(propType: string): PropDefinition {
  return propDefinitions.props[propType] || propDefinitions.defaultProp;
}

// Cache for loaded stage dialogues
const stageDialogueCache = new Map<string, Record<string, PropDialogue>>();

/**
 * Load stage-specific dialogue overrides.
 * Returns empty object if no stage dialogues exist.
 */
async function loadStageDialogues(stageId: string): Promise<Record<string, PropDialogue>> {
  if (stageDialogueCache.has(stageId)) {
    return stageDialogueCache.get(stageId)!;
  }
  
  try {
    // Dynamic import for stage-specific dialogues
    const module = await import(`./stages/${stageId}/dialogues/story.json`);
    const data = module.default;
    
    // Extract prop dialogue overrides if they exist
    const overrides: Record<string, PropDialogue> = {};
    if (data.propOverrides && typeof data.propOverrides === 'object') {
      Object.assign(overrides, data.propOverrides);
    }
    
    stageDialogueCache.set(stageId, overrides);
    return overrides;
  } catch {
    // No stage-specific dialogues
    stageDialogueCache.set(stageId, {});
    return {};
  }
}

/**
 * Get dialogue for a prop type, with fallback to default.
 * Checks stage-specific overrides first if stageId is provided.
 * Replaces {propType} placeholder in default dialogue.
 * 
 * @param propType - The type of prop
 * @param stageId - Optional stage ID to check for overrides
 */
export function getPropDialogue(propType: string, stageId?: string): PropDialogue {
  // Check cached stage-specific overrides synchronously
  if (stageId && stageDialogueCache.has(stageId)) {
    const stageOverrides = stageDialogueCache.get(stageId)!;
    if (stageOverrides[propType]) {
      return stageOverrides[propType];
    }
  }
  
  // Check global prop dialogues
  const dialogue = propDialogues.dialogues[propType];
  if (dialogue) {
    return dialogue;
  }
  
  // Use default with placeholder replacement
  const def = propDialogues.defaultDialogue;
  return {
    carl: def.carl.map(s => s.replace('{propType}', propType)),
    paul: def.paul.map(s => s.replace('{propType}', propType)),
    prompt: def.prompt.replace('{propType}', propType)
  };
}

/**
 * Preload stage dialogues for faster access during gameplay.
 * Call this when loading a stage.
 */
export async function preloadStageDialogues(stageId: string): Promise<void> {
  await loadStageDialogues(stageId);
}

/**
 * Get dialogue async with guaranteed stage override check.
 * Use this when you need to ensure stage overrides are loaded.
 */
export async function getPropDialogueAsync(propType: string, stageId?: string): Promise<PropDialogue> {
  if (stageId) {
    const stageOverrides = await loadStageDialogues(stageId);
    if (stageOverrides[propType]) {
      return stageOverrides[propType];
    }
  }
  
  return getPropDialogue(propType);
}

/**
 * Get interaction prompt for a prop type.
 */
export function getInteractPrompt(propType: string): string {
  return getPropDialogue(propType).prompt;
}

// ============================================
// Character Helpers  
// ============================================

/**
 * Get character info by ID.
 */
export function getCharacter(characterId: string) {
  return gameDefinition.characters[characterId];
}

/**
 * Get path info by ID.
 */
export function getPath(pathId: string) {
  return gameDefinition.paths[pathId];
}

// ============================================
// Layout & Template Data
// ============================================

export interface LayoutArchetype {
  id: string;
  name: string;
  description: string;
  environment: 'interior' | 'exterior' | 'mixed';
  levels: Array<{
    level: number;
    name: string;
    pattern: string;
    totalRooms: { min: number; max: number };
    anchorPositions: Record<string, { x: number; z: number }>;
    fillerZones: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
    verticalConnections: Array<{
      position: { x: number; z: number };
      direction: 'up' | 'down';
      type: string;
    }>;
    gridConfig?: Record<string, unknown>;
  }>;
  connectionRules: {
    defaultType: string;
    hallwayType?: string;
    buildingEntryType?: string;
    secretType?: string;
    maxDoorsPerRoom: number;
  };
}

export interface RoomTemplate {
  id: string;
  type: string;
  size: {
    width: { min: number; max: number };
    height: { min: number; max: number };
    ceiling?: { min: number; max: number };
  };
  connectionPoints: Array<{
    id: string;
    side: string;
    position: string | number;
    allowedConnections: string[];
    required?: boolean;
  }>;
  propRules: Array<{
    propTypes: string[];
    zone: string;
    count: { min: number; max: number };
    faceWall?: boolean;
    faceCenter?: boolean;
    minSpacing?: number;
    cluster?: boolean;
  }>;
  requiredFeatures?: string[];
  tags: string[];
}

export interface MaterialPalette {
  id: string;
  name: string;
  floors: Record<string, { color: number[] }>;
  walls: Record<string, { color: number[] }>;
  propSets: string[];
  lighting: {
    ambient: number[];
    intensity: number;
    shadows: boolean;
  };
}

/**
 * Layout archetypes for procedural generation.
 */
export const layoutArchetypes = (layoutArchetypesData as { archetypes: LayoutArchetype[] }).archetypes;

/**
 * Room templates for procedural generation.
 */
export const roomTemplates = (roomTemplatesData as { templates: RoomTemplate[] }).templates;

/**
 * Material palettes for room theming.
 */
export const materialPalettes = (roomTemplatesData as { palettes: MaterialPalette[] }).palettes;

/**
 * Prop pools by category.
 */
export const propPools = (roomTemplatesData as { propPools: Record<string, string[]> }).propPools;

/**
 * Get a layout archetype by ID.
 */
export function getLayoutArchetype(id: string): LayoutArchetype | undefined {
  return layoutArchetypes.find(a => a.id === id);
}

/**
 * Get a room template by ID.
 */
export function getRoomTemplate(id: string): RoomTemplate | undefined {
  return roomTemplates.find(t => t.id === id);
}

/**
 * Get a material palette by ID.
 */
export function getMaterialPalette(id: string): MaterialPalette | undefined {
  return materialPalettes.find(p => p.id === id);
}

/**
 * Get all templates matching any of the given tags.
 */
export function getTemplatesByTags(tags: string[]): RoomTemplate[] {
  return roomTemplates.filter(t => 
    tags.some(tag => t.tags.includes(tag))
  );
}

// ============================================
// Stage Definition Loading
// ============================================

/**
 * Load a complete stage definition.
 */
export async function loadStageDefinition(stageId: string): Promise<unknown> {
  try {
    // Try the complete definition first
    const module = await import(`./stages/${stageId}/definition_complete.json`);
    return module.default;
  } catch {
    try {
      // Fall back to basic definition
      const module = await import(`./stages/${stageId}/definition.json`);
      return module.default;
    } catch {
      console.error(`Failed to load stage definition for: ${stageId}`);
      return null;
    }
  }
}

/**
 * Load stage-specific dialogues.
 */
export async function loadStageStoryDialogues(stageId: string): Promise<Record<string, unknown>> {
  try {
    const module = await import(`./stages/${stageId}/dialogues/story.json`);
    return module.default;
  } catch {
    return {};
  }
}
