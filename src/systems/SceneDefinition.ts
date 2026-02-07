// Scene Definition System - Data-driven scene/area definitions
// Inspired by Daggerfall's approach: JSON DDLs define areas, objects, NPCs, triggers, etc.

import { Vector3 } from '@babylonjs/core';

// ============================================
// Core Entity Types
// ============================================

export interface Transform {
  position: [number, number, number];
  rotation?: [number, number, number]; // Euler angles
  scale?: [number, number, number] | number;
}

// ============================================
// Props & Objects
// ============================================

export type PropType = 
  | 'table' | 'chair' | 'bookshelf' | 'crate' | 'chest' 
  | 'barrel' | 'pillar' | 'rug' | 'lamp' | 'door'
  | 'custom';

export interface PropDefinition {
  id: string;
  type: PropType;
  model?: string; // Custom GLB path
  transform: Transform;
  interactable?: boolean;
  interaction?: InteractionDefinition;
  tags?: string[];
}

// ============================================
// NPCs & Characters
// ============================================

export type CharacterType = 'carl' | 'paul';
export type AIBehavior = 'idle' | 'patrol' | 'follow' | 'wander' | 'scripted';

export interface NPCDefinition {
  id: string;
  character: CharacterType;
  transform: Transform;
  behavior: AIBehavior;
  patrolPath?: [number, number, number][]; // For patrol behavior
  dialogue?: string; // Reference to dialogue tree ID
  interactable?: boolean;
  tags?: string[];
}

// ============================================
// Triggers & Zones
// ============================================

export type TriggerType = 'enter' | 'exit' | 'interact' | 'proximity' | 'timed';
export type TriggerShape = 'box' | 'sphere' | 'cylinder';

export interface TriggerDefinition {
  id: string;
  type: TriggerType;
  shape: TriggerShape;
  transform: Transform;
  size: [number, number, number] | number; // Box dimensions or radius
  action: ActionDefinition;
  once?: boolean; // Only trigger once
  delay?: number; // Delay before action fires (ms)
  tags?: string[];
}

// ============================================
// Actions (what happens when triggers fire)
// ============================================

export type ActionType = 
  | 'transition'  // Move to another scene
  | 'dialogue'    // Start dialogue
  | 'spawn'       // Spawn entity
  | 'despawn'     // Remove entity
  | 'animate'     // Play animation
  | 'sound'       // Play sound
  | 'effect'      // Visual effect
  | 'atmosphere'  // Change atmosphere (mood)
  | 'quest'       // Quest state change
  | 'sequence'    // Multiple actions in order
  | 'conditional' // If/else based on game state
  | 'custom';     // Custom script/callback

export interface ActionDefinition {
  type: ActionType;
  params: Record<string, unknown>;
}

// Specific action params
export interface TransitionAction extends ActionDefinition {
  type: 'transition';
  params: {
    targetScene: string;
    spawnPoint?: string; // Named spawn point in target scene
    direction?: 'north' | 'south' | 'east' | 'west';
    transition?: 'fade' | 'cut' | 'slide';
  };
}

export interface DialogueAction extends ActionDefinition {
  type: 'dialogue';
  params: {
    dialogueId: string;
    speaker?: string;
  };
}

export interface SpawnAction extends ActionDefinition {
  type: 'spawn';
  params: {
    entityType: 'prop' | 'npc' | 'effect';
    definition: PropDefinition | NPCDefinition;
  };
}

export interface SequenceAction extends ActionDefinition {
  type: 'sequence';
  params: {
    actions: ActionDefinition[];
    delays?: number[]; // Delay between each action
  };
}

export interface ConditionalAction extends ActionDefinition {
  type: 'conditional';
  params: {
    condition: ConditionDefinition;
    then: ActionDefinition;
    else?: ActionDefinition;
  };
}

// ============================================
// Conditions (for conditional actions)
// ============================================

export type ConditionType = 
  | 'hasItem'
  | 'questState'
  | 'visited'
  | 'atmosphere'  // Check current atmosphere preset
  | 'and' | 'or' | 'not';

export interface ConditionDefinition {
  type: ConditionType;
  params: Record<string, unknown>;
}

// ============================================
// Interactions
// ============================================

export type InteractionType = 'examine' | 'pickup' | 'use' | 'talk' | 'open';

export interface InteractionDefinition {
  type: InteractionType;
  prompt?: string; // "Press E to examine"
  action: ActionDefinition;
  requirements?: ConditionDefinition;
}

// ============================================
// Scene Exits/Connections
// ============================================

export interface ExitDefinition {
  id: string;
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  targetScene: string;
  targetSpawnPoint?: string;
  position: [number, number, number];
  size?: [number, number, number];
  locked?: boolean;
  lockCondition?: ConditionDefinition;
}

// ============================================
// Spawn Points
// ============================================

export interface SpawnPointDefinition {
  id: string;
  transform: Transform;
  default?: boolean; // Default spawn for this scene
  tags?: string[];
}

// ============================================
// Scene Lighting & Atmosphere
// ============================================

export interface LightDefinition {
  id: string;
  type: 'ambient' | 'directional' | 'point' | 'spot';
  color?: [number, number, number];
  intensity?: number;
  position?: [number, number, number];
  direction?: [number, number, number];
  shadows?: boolean;
}

/** 
 * Atmosphere preset names - controls mood through coordinated
 * fog, lighting, audio, and effects. See AtmosphereManager.
 */
export type AtmospherePreset = 
  | 'cozy'      // Safe, warm, homey
  | 'uneasy'    // Something's not quite right
  | 'tense'     // Building dread
  | 'dread'     // Full horror atmosphere
  | 'panic'     // Immediate danger
  | 'absurd'    // Dark comedy - theatrical horror
  | 'neutral';  // Default/reset

export interface AtmosphereDefinition {
  /** Base atmosphere preset */
  preset?: AtmospherePreset;
  
  /** Override fog settings (optional) */
  fogEnabled?: boolean;
  fogColor?: [number, number, number];
  fogDensity?: number;
  
  /** Override ambient light (optional) */
  ambientColor?: [number, number, number];
  ambientIntensity?: number;
  
  /** Background music track ID */
  musicTrack?: string;
  
  /** Ambient sound IDs to play randomly */
  ambientSounds?: string[];
  
  /** Legacy skybox (unused in indoor scenes) */
  skybox?: string;
}

// ============================================
// Scene Definition (the main DDL)
// ============================================

export interface SceneDefinition {
  id: string;
  name: string;
  description?: string;
  
  // Geometry
  bounds: {
    width: number;
    height: number; // Z dimension (depth)
    ceiling?: number; // Y height
  };
  
  // Visual
  floor?: {
    material?: string;
    texture?: string;
    color?: [number, number, number];
  };
  walls?: {
    material?: string;
    texture?: string;
    color?: [number, number, number];
    height?: number;
  };
  atmosphere?: AtmosphereDefinition;
  lights?: LightDefinition[];
  
  // Content
  props: PropDefinition[];
  npcs: NPCDefinition[];
  triggers: TriggerDefinition[];
  exits: ExitDefinition[];
  spawnPoints: SpawnPointDefinition[];
  
  // Metadata
  tags?: string[];
}

// ============================================
// World Definition (collection of scenes)
// ============================================

export interface WorldDefinition {
  id: string;
  name: string;
  startScene: string;
  startSpawnPoint?: string;
  scenes: SceneDefinition[];
  
  // Global settings
  globalAtmosphere?: AtmosphereDefinition;
  dialogues?: Record<string, unknown>; // Dialogue tree definitions
}

// ============================================
// Helper functions
// ============================================

export function vec3FromArray(arr: [number, number, number]): Vector3 {
  return new Vector3(arr[0], arr[1], arr[2]);
}

export function transformToVec3(transform: Transform): {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
} {
  return {
    position: vec3FromArray(transform.position),
    rotation: transform.rotation 
      ? vec3FromArray(transform.rotation) 
      : Vector3.Zero(),
    scale: transform.scale 
      ? (typeof transform.scale === 'number' 
          ? new Vector3(transform.scale, transform.scale, transform.scale)
          : vec3FromArray(transform.scale))
      : Vector3.One()
  };
}
