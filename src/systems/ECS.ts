/**
 * Entity Component System (ECS)
 * =============================
 * 
 * Central game world using Miniplex for entity management.
 * All game objects (characters, props, triggers) are entities with components.
 * 
 * ## Why ECS?
 * 
 * Traditional OOP approach: deep inheritance hierarchies, tight coupling
 * ECS approach: flat entities, composable components, flexible queries
 * 
 * Example: A "talking lamp" in OOP needs multiple inheritance.
 * In ECS: just add `interactable` and `renderable` components to same entity.
 * 
 * ## Core Concepts
 * 
 * **Entity**: Just an ID with components attached
 * ```ts
 * { id: "prop_42", transform: {...}, renderable: {...}, interactable: {...} }
 * ```
 * 
 * **Component**: Plain data object
 * ```ts
 * interface TransformComponent { x: number; y: number; z: number; rotationY: number; }
 * ```
 * 
 * **Archetype**: Pre-built query for common entity types
 * ```ts
 * archetypes.player      // Entities with player + character + transform
 * archetypes.props       // Entities with prop + transform
 * archetypes.triggers    // Entities with trigger + transform
 * ```
 * 
 * ## Usage
 * 
 * ```ts
 * // Create entities
 * const player = createPlayerEntity('carl', 0, 0, 'scene_1');
 * 
 * // Query entities
 * for (const entity of archetypes.interactables) {
 *   if (entity.interactable.inRange) {
 *     showPrompt(entity.interactable.prompt);
 *   }
 * }
 * 
 * // React integration (with miniplex-react)
 * const npcs = useEntities(archetypes.npcs);
 * ```
 * 
 * ## Component Reference
 * 
 * | Component      | Purpose                           |
 * |----------------|-----------------------------------|
 * | transform      | Position, rotation, scale         |
 * | renderable     | Babylon.js mesh/node reference    |
 * | character      | Carl/Paul character reference     |
 * | player         | Player-controlled entity marker   |
 * | ai             | AI behavior and state             |
 * | prop           | Static prop definition            |
 * | npc            | NPC definition and dialogue       |
 * | trigger        | Trigger zone definition           |
 * | interactable   | Can be interacted with            |
 * | health         | Health points                     |
 * | scene          | Which scene this entity belongs to|
 * | tags           | Arbitrary tags for filtering      |
 * 
 * @module ECS
 */

import { World } from 'miniplex';
import { TransformNode, AbstractMesh } from '@babylonjs/core';
import { Character } from './Character';
import { 
  PropDefinition, 
  NPCDefinition, 
  TriggerDefinition,
  ActionDefinition,
  AIBehavior 
} from './SceneDefinition';

// ============================================
// Component Types
// ============================================

// Transform component - position, rotation, scale
export interface TransformComponent {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
}

// Renderable - has a Babylon.js mesh/node
export interface RenderableComponent {
  node: TransformNode | AbstractMesh | null;
  modelPath?: string;
  visible: boolean;
}

// Character component - for Carl/Paul
export interface CharacterComponent {
  type: 'carl' | 'paul';
  character: Character | null; // Reference to Character system instance
}

// Player controlled
export interface PlayerComponent {
  isPlayer: true;
  targetRotation: number;
  currentRotation: number;
}

// AI controlled
export interface AIComponent {
  behavior: AIBehavior;
  patrolPath?: [number, number, number][];
  patrolIndex?: number;
  targetPosition?: { x: number; z: number };
  thinkTimer?: number;
}

// Interactable
export interface InteractableComponent {
  prompt: string;
  interactionType: 'examine' | 'pickup' | 'use' | 'talk' | 'open';
  action: ActionDefinition;
  inRange: boolean;
}

// Trigger zone
export interface TriggerComponent {
  definition: TriggerDefinition;
  triggered: boolean;
  active: boolean;
}

// Prop
export interface PropComponent {
  definition: PropDefinition;
}

// NPC
export interface NPCComponent {
  definition: NPCDefinition;
  dialogueId?: string;
}

// Health/stats
export interface HealthComponent {
  current: number;
  max: number;
}

// Inventory (for items that can be picked up)
export interface PickupComponent {
  itemId: string;
  itemName: string;
}

// Tags for querying
export interface TagsComponent {
  tags: Set<string>;
}

// Scene membership
export interface SceneComponent {
  sceneId: string;
}

// ============================================
// Entity Type (union of all possible components)
// ============================================

export interface Entity {
  id: string;
  
  // Core
  transform?: TransformComponent;
  renderable?: RenderableComponent;
  scene?: SceneComponent;
  tags?: TagsComponent;
  
  // Character
  character?: CharacterComponent;
  player?: PlayerComponent;
  ai?: AIComponent;
  health?: HealthComponent;
  
  // World objects
  prop?: PropComponent;
  npc?: NPCComponent;
  trigger?: TriggerComponent;
  interactable?: InteractableComponent;
  pickup?: PickupComponent;
}

// ============================================
// Create the World
// ============================================

export const world = new World<Entity>();

// ============================================
// Archetypes (pre-defined queries for common entity types)
// ============================================

export const archetypes = {
  // All entities with transforms
  withTransform: world.with('transform'),
  
  // All renderables
  renderables: world.with('renderable', 'transform'),
  
  // Player entity
  player: world.with('player', 'character', 'transform'),
  
  // AI-controlled entities
  aiControlled: world.with('ai', 'character', 'transform'),
  
  // All characters (player + AI)
  characters: world.with('character', 'transform'),
  
  // Props in scene
  props: world.with('prop', 'transform'),
  
  // NPCs
  npcs: world.with('npc', 'character', 'transform'),
  
  // Triggers
  triggers: world.with('trigger', 'transform'),
  
  // Interactables in range
  interactablesInRange: world.with('interactable', 'transform').where(
    e => e.interactable?.inRange === true
  ),
  
  // All interactables
  interactables: world.with('interactable', 'transform'),
  
  // Pickups
  pickups: world.with('pickup', 'transform'),
  
  // Entities in a specific scene
  inScene: (sceneId: string) => world.with('scene').where(
    e => e.scene?.sceneId === sceneId
  ),
};

// ============================================
// Entity Factory Functions
// ============================================

let entityIdCounter = 0;

function generateId(prefix: string): string {
  return `${prefix}_${++entityIdCounter}`;
}

export function createPlayerEntity(
  characterType: 'carl' | 'paul',
  x: number,
  z: number,
  sceneId: string
): Entity {
  return world.add({
    id: generateId('player'),
    transform: { x, y: 0, z, rotationY: 0, scale: 1 },
    renderable: { node: null, visible: true },
    character: { type: characterType, character: null },
    player: { isPlayer: true, targetRotation: 0, currentRotation: 0 },
    health: { current: 100, max: 100 },
    scene: { sceneId },
    tags: { tags: new Set(['player', characterType]) },
  });
}

export function createNPCEntity(
  definition: NPCDefinition,
  sceneId: string
): Entity {
  return world.add({
    id: generateId('npc'),
    transform: {
      x: definition.transform.position[0],
      y: definition.transform.position[1],
      z: definition.transform.position[2],
      rotationY: definition.transform.rotation?.[1] ?? 0,
      scale: typeof definition.transform.scale === 'number' 
        ? definition.transform.scale 
        : definition.transform.scale?.[0] ?? 1,
    },
    renderable: { node: null, visible: true },
    character: { type: definition.character, character: null },
    ai: {
      behavior: definition.behavior,
      patrolPath: definition.patrolPath,
      patrolIndex: 0,
    },
    npc: { definition, dialogueId: definition.dialogue },
    scene: { sceneId },
    tags: { tags: new Set(definition.tags ?? []) },
    ...(definition.interactable && definition.dialogue ? {
      interactable: {
        prompt: 'Talk',
        interactionType: 'talk' as const,
        action: { type: 'dialogue' as const, params: { dialogueId: definition.dialogue } },
        inRange: false,
      }
    } : {}),
  });
}

export function createPropEntity(
  definition: PropDefinition,
  sceneId: string
): Entity {
  return world.add({
    id: generateId('prop'),
    transform: {
      x: definition.transform.position[0],
      y: definition.transform.position[1],
      z: definition.transform.position[2],
      rotationY: definition.transform.rotation?.[1] ?? 0,
      scale: typeof definition.transform.scale === 'number'
        ? definition.transform.scale
        : definition.transform.scale?.[0] ?? 1,
    },
    renderable: { 
      node: null, 
      modelPath: definition.model,
      visible: true 
    },
    prop: { definition },
    scene: { sceneId },
    tags: { tags: new Set(definition.tags ?? []) },
    ...(definition.interactable && definition.interaction ? {
      interactable: {
        prompt: definition.interaction.prompt ?? 'Interact',
        interactionType: definition.interaction.type,
        action: definition.interaction.action,
        inRange: false,
      }
    } : {}),
  });
}

export function createTriggerEntity(
  definition: TriggerDefinition,
  sceneId: string
): Entity {
  return world.add({
    id: generateId('trigger'),
    transform: {
      x: definition.transform.position[0],
      y: definition.transform.position[1],
      z: definition.transform.position[2],
      rotationY: 0,
      scale: 1,
    },
    trigger: { definition, triggered: false, active: true },
    scene: { sceneId },
    tags: { tags: new Set(definition.tags ?? []) },
  });
}

// ============================================
// Scene Loading
// ============================================

import { SceneDefinition } from './SceneDefinition';

export function loadSceneEntities(sceneDef: SceneDefinition): void {
  const sceneId = sceneDef.id;
  
  // Create prop entities
  for (const prop of sceneDef.props) {
    createPropEntity(prop, sceneId);
  }
  
  // Create NPC entities
  for (const npc of sceneDef.npcs) {
    createNPCEntity(npc, sceneId);
  }
  
  // Create trigger entities
  for (const trigger of sceneDef.triggers) {
    createTriggerEntity(trigger, sceneId);
  }
}

export function unloadSceneEntities(sceneId: string): void {
  const entities = [...archetypes.inScene(sceneId)];
  for (const entity of entities) {
    // Dispose Babylon nodes
    if (entity.renderable?.node) {
      entity.renderable.node.dispose();
    }
    if (entity.character?.character) {
      entity.character.character.dispose();
    }
    world.remove(entity);
  }
}

// ============================================
// Reset
// ============================================

export function resetWorld(): void {
  for (const entity of [...world]) {
    if (entity.renderable?.node) {
      entity.renderable.node.dispose();
    }
    if (entity.character?.character) {
      entity.character.character.dispose();
    }
  }
  world.clear();
  entityIdCounter = 0;
}
