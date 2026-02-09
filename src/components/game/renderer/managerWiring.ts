/**
 * Manager wiring — connects InteractionSystem, StoryManager, AtmosphereManager,
 * and EffectsManager with their callbacks and cross-references.
 *
 * This is pure setup code (no per-frame logic). Call once during scene init.
 */
import {
  Scene,
  Vector3,
  AbstractMesh,
  TransformNode,
  ShadowGenerator,
} from '@babylonjs/core';
import type { CharacterType } from '../../../types/game';
import type { InteractionSystem } from '../../../systems/InteractionSystem';
import type { CollisionSystem } from '../../../systems/CollisionSystem';
import type { AudioManager } from '../../../systems/AudioManager';
import { SoundEffects } from '../../../systems/AudioManager';
import type { StoryManager } from '../../../systems/StoryManager';
import type { AtmosphereManager } from '../../../systems/AtmosphereManager';
import type { AtmospherePreset } from '../../../systems/AtmosphereManager';
import type { EffectsManager } from '../../../systems/EffectsManager';
import { createPropMeshAsync } from '../../../systems/PropFactory';
import type { StageAtmosphere } from '../../../systems/GameInitializer';
import type { PropsSnapshot } from './types';

interface WireManagersConfig {
  scene: Scene;
  interactionSystem: InteractionSystem;
  collisionSystem: CollisionSystem;
  audioManager: AudioManager;
  storyManager: StoryManager;
  atmosphereManager: AtmosphereManager;
  effectsManager: EffectsManager;
  shadowGen: ShadowGenerator;
  propMeshMap: Map<string, AbstractMesh>;
  propsRef: { current: PropsSnapshot };
  playerCharacter: CharacterType;
  atmospherePreset: AtmospherePreset;
  stageAtmosphere: StageAtmosphere | undefined;
  currentRoomId: string;
}

export function wireManagers(config: WireManagersConfig): void {
  const {
    scene, interactionSystem, collisionSystem, audioManager,
    storyManager, atmosphereManager, effectsManager, shadowGen,
    propMeshMap, propsRef, playerCharacter, atmospherePreset,
    stageAtmosphere, currentRoomId,
  } = config;

  // --- Interaction callbacks ---
  interactionSystem.setCallbacks({
    onDialogue: (lines, speaker) => {
      propsRef.current.onDialogue?.(lines, speaker);
    },
    onDialogueTree: (tree) => {
      propsRef.current.onDialogueTree?.(tree);
    },
    onItemPickup: (itemId) => {
      audioManager.playSound(SoundEffects.ITEM_PICKUP);
      propsRef.current.onItemPickup?.(itemId);
      const mesh = propMeshMap.get(itemId);
      if (mesh) {
        mesh.dispose();
        propMeshMap.delete(itemId);
      }
      collisionSystem.removeProp(
        collisionSystem.getAllColliders().find(c => c.itemDrop === itemId)?.id ?? ''
      );
      propsRef.current.onDialogue?.(
        [`Picked up: ${itemId.replace(/_/g, ' ')}`],
        propsRef.current.playerCharacter
      );
    },
    onHorrorIncrease: () => {},
    onUnlock: (lockId) => {
      audioManager.playSound(SoundEffects.DOOR_UNLOCK);
      propsRef.current.onUnlockExit?.(lockId);
    },
  });

  // --- Atmosphere manager setup ---
  atmosphereManager.applyToScene(scene);
  atmosphereManager.setAudioManager({
    playMusic: (track, opts) => audioManager.playMusic(track, opts),
    stopMusic: (opts) => audioManager.stopMusic(opts),
    crossfadeMusic: (track, opts) => audioManager.crossfadeMusic(track, opts),
    playSound: (id, opts) => audioManager.playSound(id, opts),
  });
  atmosphereManager.setPreset(atmospherePreset, 0);

  // --- Story manager callbacks ---
  storyManager.setCallbacks({
    onDialogue: (lines, speaker) => {
      propsRef.current.onDialogue?.(lines, speaker);
    },
    onHorrorChange: (newLevel, _delta) => {
      let preset: AtmospherePreset = 'cozy';
      if (newLevel >= 8) preset = 'panic';
      else if (newLevel >= 6) preset = 'dread';
      else if (newLevel >= 4) preset = 'tense';
      else if (newLevel >= 2) preset = 'uneasy';
      atmosphereManager.setPreset(preset, 2000);
    },
    onUnlock: (lockId) => {
      audioManager.playSound(SoundEffects.DOOR_UNLOCK);
      propsRef.current.onUnlockExit?.(lockId);
      collisionSystem.removeProp(`lock_${lockId}`);
    },
    onLock: (lockId) => {
      collisionSystem.addProp({
        id: `lock_${lockId}`,
        type: 'lock',
        bounds: { minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 },
        solid: true,
        interactable: false,
      });
    },
    onSpawn: (entityId, position) => {
      const spawnX = position?.x ?? 0;
      const spawnZ = position?.z ?? 0;
      createPropMeshAsync(scene, entityId, true, entityId).then(mesh => {
        if (mesh) {
          mesh.position.set(spawnX, 0, spawnZ);
          if (mesh instanceof AbstractMesh) {
            shadowGen.addShadowCaster(mesh);
          } else if ('getChildMeshes' in mesh) {
            (mesh as TransformNode).getChildMeshes().forEach(child => {
              shadowGen.addShadowCaster(child);
              child.receiveShadows = true;
            });
          }
          propMeshMap.set(entityId, mesh);
          const r = 0.4;
          collisionSystem.addProp({
            id: entityId,
            type: entityId,
            bounds: { minX: spawnX - r, maxX: spawnX + r, minZ: spawnZ - r, maxZ: spawnZ + r },
            solid: false,
            interactable: true,
            itemDrop: entityId,
          });
          effectsManager.spawnSparkles(new Vector3(spawnX, 0.5, spawnZ));
        }
      });
    },
    onDespawn: (entityId) => {
      collisionSystem.removeProp(entityId);
      const mesh = propMeshMap.get(entityId);
      if (mesh) {
        mesh.dispose();
        propMeshMap.delete(entityId);
      }
    },
    onBeatComplete: () => {},
    onStageComplete: () => {
      propsRef.current.onStageComplete?.();
    },
    onEffect: (effectType, params) => {
      switch (effectType) {
        case 'screen_shake':
          effectsManager.shakeCamera(
            (params?.intensity as number) ?? 0.15,
            (params?.duration as number) ?? 500
          );
          break;
        case 'blood_splatter': {
          const pos = params?.position as { x: number; y: number; z: number } | undefined;
          effectsManager.spawnBloodSplatter(
            new Vector3(pos?.x ?? 0, pos?.y ?? 1, pos?.z ?? 0)
          );
          break;
        }
        case 'dramatic_zoom':
          effectsManager.zoomCamera(
            (params?.factor as number) ?? 0.6,
            (params?.duration as number) ?? 500,
            (params?.hold as number) ?? 1000
          );
          break;
        case 'atmosphere': {
          const preset = params?.preset as AtmospherePreset | undefined;
          if (preset) {
            atmosphereManager.setPreset(preset, (params?.duration as number) ?? 1000);
          }
          break;
        }
        case 'atmosphere_pulse': {
          const pulsePreset = params?.preset as AtmospherePreset | undefined;
          if (pulsePreset) {
            atmosphereManager.pulse(pulsePreset, (params?.duration as number) ?? 2000);
          }
          break;
        }
      }
    },
    onSound: (soundId) => {
      audioManager.playSound(soundId);
    },
  });

  storyManager.setCharacterPath(playerCharacter === 'carl' ? 'order' : 'chaos');

  // Wire dialogue-level effects
  storyManager.setEffectsCallbacks({
    onScreenShake: (intensity, duration) => {
      effectsManager.shakeCamera(intensity, duration);
    },
    onHorrorPulse: (intensity) => {
      audioManager.playSound(SoundEffects.HORROR_STING, { volume: intensity });
    },
    onMusicChange: (trackId) => {
      audioManager.crossfadeMusic(trackId, { duration: 2000 });
    },
    onDramaticZoom: (fov, duration) => {
      effectsManager.zoomCamera(fov, duration, 1000);
    },
  });

  // Set initial horror from atmosphere data
  if (stageAtmosphere) {
    const entryOverride = stageAtmosphere.perRoomOverrides?.[currentRoomId];
    const entryHorror = entryOverride?.horrorLevel ?? stageAtmosphere.baseHorrorLevel;
    storyManager.setSceneHorrorLevel(entryHorror);
    if (stageAtmosphere.musicTrack) {
      audioManager.crossfadeMusic(stageAtmosphere.musicTrack, { duration: 1000 });
    }
  }

  storyManager.checkTrigger('scene_enter', { sceneId: currentRoomId });
}
