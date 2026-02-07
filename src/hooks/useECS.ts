// useECS - React hooks for ECS integration
// Provides reactive access to game entities

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useEntities } from 'miniplex-react';
import { 
  world, 
  archetypes, 
  Entity,
  createPlayerEntity,
  resetWorld 
} from '../systems/ECS';
import { SceneDefinition } from '../systems/SceneDefinition';
import { loadScene, unloadCurrentScene, createCharacterForEntity } from '../systems/SceneLoader';
import { Scene, ShadowGenerator } from '@babylonjs/core';

// ============================================
// Entity Queries as Hooks
// ============================================

export function usePlayer() {
  const players = useEntities(archetypes.player);
  return [...players][0] ?? null;
}

export function useNPCs() {
  return useEntities(archetypes.npcs);
}

export function useProps() {
  return useEntities(archetypes.props);
}

export function useTriggers() {
  return useEntities(archetypes.triggers);
}

export function useInteractablesInRange() {
  return useEntities(archetypes.interactablesInRange);
}

export function useCharacters() {
  return useEntities(archetypes.characters);
}

export function useEntitiesWithTag(tag: string) {
  const all = useEntities(archetypes.withTransform);
  return useMemo(
    () => [...all].filter(e => e.tags?.tags.has(tag)),
    [all, tag]
  );
}

// ============================================
// Scene Management Hook
// ============================================

interface UseSceneManagerOptions {
  babylonScene: Scene | null;
  shadowGenerator?: ShadowGenerator;
}

export function useSceneManager(options: UseSceneManagerOptions) {
  const { babylonScene, shadowGenerator } = options;
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const loadSceneDefinition = useCallback(async (definition: SceneDefinition) => {
    if (!babylonScene) {
      setError(new Error('Babylon scene not initialized'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await loadScene(babylonScene, definition, shadowGenerator);
      setCurrentSceneId(definition.id);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load scene'));
    } finally {
      setIsLoading(false);
    }
  }, [babylonScene, shadowGenerator]);
  
  const unloadScene = useCallback(() => {
    unloadCurrentScene();
    setCurrentSceneId(null);
  }, []);
  
  const transitionTo = useCallback(async (
    definition: SceneDefinition,
    spawnPointId?: string,
    transitionType: 'fade' | 'cut' | 'slide' = 'fade'
  ) => {
    // Apply transition effect
    const transitionDuration = transitionType === 'cut' ? 0 : 300;
    
    if (transitionType === 'fade' && transitionDuration > 0) {
      // Fade out - dispatch event for UI layer to handle
      window.dispatchEvent(new CustomEvent('scene-transition', { 
        detail: { type: 'fade-out', duration: transitionDuration } 
      }));
      await new Promise(resolve => setTimeout(resolve, transitionDuration));
    } else if (transitionType === 'slide' && transitionDuration > 0) {
      window.dispatchEvent(new CustomEvent('scene-transition', { 
        detail: { type: 'slide-out', duration: transitionDuration } 
      }));
      await new Promise(resolve => setTimeout(resolve, transitionDuration));
    }
    
    await loadSceneDefinition(definition);
    
    // Move player to spawn point
    const player = archetypes.player.first;
    if (player && player.transform) {
      const spawnPoint = definition.spawnPoints.find(
        sp => sp.id === spawnPointId || sp.default
      );
      if (spawnPoint) {
        player.transform.x = spawnPoint.transform.position[0];
        player.transform.z = spawnPoint.transform.position[2];
        player.transform.rotationY = spawnPoint.transform.rotation?.[1] ?? 0;
      }
    }
    
    // Fade back in
    if (transitionDuration > 0) {
      const fadeInType = transitionType === 'fade' ? 'fade-in' : 'slide-in';
      window.dispatchEvent(new CustomEvent('scene-transition', { 
        detail: { type: fadeInType, duration: transitionDuration } 
      }));
    }
  }, [loadSceneDefinition]);
  
  return {
    currentSceneId,
    isLoading,
    error,
    loadScene: loadSceneDefinition,
    unloadScene,
    transitionTo
  };
}

// ============================================
// Player Management Hook
// ============================================

interface UsePlayerManagerOptions {
  characterType: 'carl' | 'paul';
  initialPosition: { x: number; z: number };
  sceneId: string;
  babylonScene: Scene | null;
  shadowGenerator?: ShadowGenerator;
}

export function usePlayerManager(options: UsePlayerManagerOptions) {
  const { characterType, initialPosition, sceneId, babylonScene, shadowGenerator } = options;
  const [playerEntity, setPlayerEntity] = useState<Entity | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Create player entity
  useEffect(() => {
    if (!sceneId) return;
    
    const entity = createPlayerEntity(
      characterType,
      initialPosition.x,
      initialPosition.z,
      sceneId
    );
    setPlayerEntity(entity);
    
    return () => {
      if (entity.character?.character) {
        entity.character.character.dispose();
      }
      world.remove(entity);
    };
  }, [characterType, initialPosition.x, initialPosition.z, sceneId]);
  
  // Create character mesh
  useEffect(() => {
    if (!playerEntity || !babylonScene) return;
    
    createCharacterForEntity(babylonScene, playerEntity, shadowGenerator)
      .then(() => setIsReady(true));
  }, [playerEntity, babylonScene, shadowGenerator]);
  
  // Movement
  const movePlayer = useCallback((dx: number, dz: number, dt: number) => {
    if (!playerEntity?.transform || !playerEntity.player) return;
    
    const speed = 4;
    playerEntity.transform.x += dx * speed * dt;
    playerEntity.transform.z += dz * speed * dt;
    
    // Update target rotation
    if (dx !== 0 || dz !== 0) {
      playerEntity.player.targetRotation = Math.atan2(dx, dz);
    }
    
    // Update character mesh
    const character = playerEntity.character?.character;
    if (character) {
      character.setPosition(playerEntity.transform.x, 0, playerEntity.transform.z);
      character.setTargetRotation(playerEntity.player.targetRotation);
      character.update(dt);
      
      playerEntity.player.currentRotation = character.currentRotation;
    }
  }, [playerEntity]);
  
  const getPosition = useCallback(() => {
    if (!playerEntity?.transform) return { x: 0, z: 0, rotation: 0 };
    return {
      x: playerEntity.transform.x,
      z: playerEntity.transform.z,
      rotation: playerEntity.player?.currentRotation ?? 0
    };
  }, [playerEntity]);
  
  return {
    entity: playerEntity,
    isReady,
    movePlayer,
    getPosition
  };
}

// ============================================
// Interaction System Hook
// ============================================

export function useInteractionSystem() {
  const interactables = useInteractablesInRange();
  
  const closestInteractable = useMemo(() => {
    const arr = [...interactables];
    if (arr.length === 0) return null;
    // Return the first one for now (could sort by distance)
    return arr[0];
  }, [interactables]);
  
  const interact = useCallback(() => {
    if (!closestInteractable?.interactable) return null;
    
    // Return the action to be executed by the game system
    return closestInteractable.interactable.action;
  }, [closestInteractable]);
  
  return {
    closestInteractable,
    prompt: closestInteractable?.interactable?.prompt ?? null,
    interact
  };
}

// ============================================
// Trigger System Hook
// ============================================

export function useTriggerSystem(playerPosition: { x: number; z: number }) {
  const triggers = useTriggers();
  const [pendingActions, setPendingActions] = useState<Entity[]>([]);
  
  useEffect(() => {
    const triggered: Entity[] = [];
    
    for (const trigger of triggers) {
      if (!trigger.trigger || !trigger.transform) continue;
      if (trigger.trigger.triggered && trigger.trigger.definition.once) continue;
      
      const def = trigger.trigger.definition;
      const tx = trigger.transform.x;
      const tz = trigger.transform.z;
      
      // Check if player is in trigger zone
      let inZone = false;
      
      if (def.shape === 'sphere') {
        const radius = typeof def.size === 'number' ? def.size : def.size[0];
        const dx = playerPosition.x - tx;
        const dz = playerPosition.z - tz;
        inZone = Math.sqrt(dx * dx + dz * dz) < radius;
      } else if (def.shape === 'box') {
        const size = typeof def.size === 'number' 
          ? [def.size, def.size, def.size] 
          : def.size;
        inZone = Math.abs(playerPosition.x - tx) < size[0] / 2 &&
                 Math.abs(playerPosition.z - tz) < size[2] / 2;
      }
      
      if (inZone && def.type === 'enter' && !trigger.trigger.triggered) {
        triggered.push(trigger);
        trigger.trigger.triggered = true;
      }
    }
    
    if (triggered.length > 0) {
      setPendingActions(triggered);
    }
  }, [playerPosition.x, playerPosition.z, triggers]);
  
  const consumeActions = useCallback(() => {
    const actions = pendingActions.map(t => t.trigger!.definition.action);
    setPendingActions([]);
    return actions;
  }, [pendingActions]);
  
  return {
    pendingActions: pendingActions.length,
    consumeActions
  };
}

// ============================================
// Game Reset
// ============================================

export function useGameReset() {
  return useCallback(() => {
    unloadCurrentScene();
    resetWorld();
  }, []);
}
