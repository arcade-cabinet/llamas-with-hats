/**
 * Unified Character System
 * ========================
 * 
 * Single source of truth for loading and controlling Carl and Paul.
 * Both player and AI use the same Character interface.
 * 
 * ## Why Unified?
 * 
 * Previously we had multiple character creation systems scattered across:
 * - `Llama.tsx` (procedural mesh)
 * - `GameScene.tsx` (GLB loader + procedural fallback)
 * - `BabylonScene.tsx` (another GLB loader)
 * 
 * This created visual inconsistency and maintenance nightmares.
 * Now there's ONE system that:
 * - Loads the GLB models
 * - Handles front-facing rotation offset
 * - Provides smooth rotation interpolation
 * - Works identically for player and AI
 * 
 * ## Usage
 * 
 * ```ts
 * // Create a character
 * const carl = await createCharacter({
 *   scene: babylonScene,
 *   type: 'carl',
 *   position: new Vector3(0, 0, 0),
 *   rotation: 0,
 *   controller: 'player' // or 'ai' or 'none'
 * });
 * 
 * // Move the character
 * carl.setPosition(newX, 0, newZ);
 * carl.setTargetRotation(Math.atan2(dx, dz));
 * 
 * // In game loop - smooth rotation interpolation
 * carl.update(deltaTime);
 * 
 * // Cleanup
 * carl.dispose();
 * ```
 * 
 * ## Model Orientation
 * 
 * GLB models face +X by default. We apply a rotation offset so +Z is forward.
 * This makes movement math intuitive (positive Z = forward in world space).
 * 
 * @module Character
 */

import {
  Scene,
  TransformNode,
  Vector3,
  Animation,
  ShadowGenerator,
  AbstractMesh
} from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';

export type CharacterType = 'carl' | 'paul';
export type ControllerType = 'player' | 'ai' | 'none';

interface CharacterConfig {
  scene: Scene;
  type: CharacterType;
  position: Vector3;
  rotation?: number;
  shadowGenerator?: ShadowGenerator;
  controller?: ControllerType;
}

export interface Character {
  root: TransformNode;
  type: CharacterType;
  controller: ControllerType;
  
  // State
  targetRotation: number;
  currentRotation: number;
  
  // Methods
  setPosition: (x: number, y: number, z: number) => void;
  setRotation: (radians: number) => void;
  setTargetRotation: (radians: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

// Model rotation offset - GLB models face +X by default
// Camera looks from +Z toward -Z, so "forward" visually is -Z
// To make model face -Z when root.rotation.y = 0, we rotate model by +PI/2
// (rotating +90° around Y turns +X toward -Z)
const MODEL_ROTATION_OFFSET = Math.PI / 2;

export async function createCharacter(config: CharacterConfig): Promise<Character> {
  const { scene, type, position, rotation = 0, shadowGenerator, controller = 'none' } = config;
  
  // Create root transform
  const root = new TransformNode(`${type}_root`, scene);
  root.position = position.clone();
  root.rotation.y = rotation;
  
  // Load the GLB model
  const result = await SceneLoader.ImportMeshAsync(
    '',
    `${import.meta.env.BASE_URL}assets/models/characters/${type}.glb`,
    '',
    scene
  );
  
  if (result.meshes.length > 0) {
    const imported = result.meshes[0];
    imported.parent = root;
    
    // Apply rotation offset so model faces +Z (forward)
    imported.rotation.y = MODEL_ROTATION_OFFSET;
    
    // Ensure visibility
    result.meshes.forEach(m => {
      m.isVisible = true;
      m.setEnabled(true);
    });
    
    // Calculate bounds and scale to unit height
    let minY = Infinity, maxY = -Infinity;
    result.meshes.forEach(m => {
      // Only process actual meshes with geometry
      if (m instanceof AbstractMesh && typeof m.getBoundingInfo === 'function') {
        try {
          m.refreshBoundingInfo({});
          const b = m.getBoundingInfo()?.boundingBox;
          if (b) {
            minY = Math.min(minY, b.minimumWorld.y);
            maxY = Math.max(maxY, b.maximumWorld.y);
          }
        } catch {
          // Skip meshes that can't compute bounding info
        }
      }
    });
    
    const height = maxY - minY;
    if (height > 0) {
      const scale = 1 / height;
      imported.scaling.setAll(scale);
      imported.position.y = -minY * scale;
    }
    
    // Setup shadows - only for actual meshes with geometry
    if (shadowGenerator) {
      result.meshes.forEach(m => {
        // Check if this is a real mesh with geometry (not just a transform node)
        const isMesh = m instanceof AbstractMesh && 
                       typeof m.getBoundingInfo === 'function' &&
                       m.getTotalVertices() > 0;
        if (isMesh && m !== imported) {
          shadowGenerator.addShadowCaster(m);
        }
        if (m.receiveShadows !== undefined) {
          m.receiveShadows = true;
        }
      });
    }
  }
  
  // Add idle bob animation
  const bobAnim = new Animation(
    `${type}_bob`,
    'position.y',
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE
  );
  bobAnim.setKeys([
    { frame: 0, value: position.y },
    { frame: 15, value: position.y + 0.03 },
    { frame: 30, value: position.y }
  ]);
  root.animations.push(bobAnim);
  scene.beginAnimation(root, 0, 30, true);
  
  // Character state
  let targetRotation = rotation;
  let currentRotation = rotation;
  
  const character: Character = {
    root,
    type,
    controller,
    
    get targetRotation() { return targetRotation; },
    set targetRotation(v: number) { targetRotation = v; },
    
    get currentRotation() { return currentRotation; },
    set currentRotation(v: number) { currentRotation = v; },
    
    setPosition(x: number, y: number, z: number) {
      root.position.set(x, y, z);
    },
    
    setRotation(radians: number) {
      currentRotation = radians;
      targetRotation = radians;
      root.rotation.y = radians;
    },
    
    setTargetRotation(radians: number) {
      targetRotation = radians;
    },
    
    // Smooth rotation update - call each frame
    update(dt: number) {
      const rotationSpeed = 10; // radians per second
      
      // Calculate shortest rotation path
      let diff = targetRotation - currentRotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      
      // Interpolate
      const maxRotation = rotationSpeed * dt;
      if (Math.abs(diff) < maxRotation) {
        currentRotation = targetRotation;
      } else {
        currentRotation += Math.sign(diff) * maxRotation;
      }
      
      // Normalize
      while (currentRotation > Math.PI) currentRotation -= Math.PI * 2;
      while (currentRotation < -Math.PI) currentRotation += Math.PI * 2;
      
      root.rotation.y = currentRotation;
    },
    
    dispose() {
      root.dispose();
    }
  };
  
  return character;
}

// Convenience function to create both Carl and Paul
export async function createCharacterPair(
  scene: Scene,
  playerType: CharacterType,
  playerPosition: Vector3,
  opponentPosition: Vector3,
  shadowGenerator?: ShadowGenerator
): Promise<{ player: Character; opponent: Character }> {
  const opponentType = playerType === 'carl' ? 'paul' : 'carl';
  
  const [player, opponent] = await Promise.all([
    createCharacter({
      scene,
      type: playerType,
      position: playerPosition,
      controller: 'player',
      shadowGenerator
    }),
    createCharacter({
      scene,
      type: opponentType,
      position: opponentPosition,
      controller: 'ai',
      shadowGenerator
    })
  ]);
  
  return { player, opponent };
}
