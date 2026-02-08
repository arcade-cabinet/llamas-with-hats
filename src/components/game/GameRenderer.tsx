/**
 * GameRenderer - Layout-based 3D rendering component
 * ===================================================
 *
 * Renders the full multi-room layout using LayoutRenderer. Players walk
 * seamlessly between rooms — no scene rebuild on room transitions.
 *
 * ## Interaction Model
 *
 * Interactions work via direct click/tap on objects:
 * - **Desktop**: Click on interactive objects with mouse
 * - **Mobile**: Tap on interactive objects
 * - **Keyboard fallback**: Press E when near an object
 *
 * Raycasting is used to detect which object was clicked/tapped.
 * Interactive props are marked in the mesh metadata.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  AbstractMesh,
  PointerEventTypes,
} from '@babylonjs/core';
import {
  clearTextureCache,
} from '../../systems/TextureLoader';
import { CharacterType, RoomConfig } from '../../types/game';
import { createCharacter, Character } from '../../systems/Character';
import { createGameCamera, getViewportSize, GameCamera, ViewportSize } from '../../systems/Camera';
import {
  createCollisionSystem,
  createCollidersFromProps,
  CollisionSystem
} from '../../systems/CollisionSystem';
import {
  createInteractionSystem,
  InteractionSystem,
  InteractionState
} from '../../systems/InteractionSystem';
import { createPropMeshAsync } from '../../systems/PropFactory';
import {
  createCharacterNavigator,
  CharacterNavigator
} from '../../systems/CharacterNavigator';
import {
  createEffectsManager,
  EffectsManager
} from '../../systems/EffectsManager';
import {
  getAudioManager,
  AudioManager,
  SoundEffects
} from '../../systems/AudioManager';
import {
  getStoryManager,
  StoryManager,
  NpcDialogueTree
} from '../../systems/StoryManager';
import {
  getAtmosphereManager,
  AtmosphereManager,
  AtmospherePreset
} from '../../systems/AtmosphereManager';
import { renderLayout, RenderedLayout } from '../../systems/LayoutRenderer';
import type { GeneratedLayout } from '../../systems/LayoutGenerator';
import type { StageAtmosphere } from '../../systems/GameInitializer';
import { GameBridge } from '../../utils/gameBridge';

interface GameRendererProps {
  playerCharacter: CharacterType;
  currentRoom: RoomConfig;
  playerPosition: { x: number; y?: number; z: number };
  playerRotation: number;
  opponentPosition: { x: number; y?: number; z: number };
  opponentRotation: number;
  onPlayerMove: (x: number, y: number, z: number, rotation: number) => void;
  onRoomTransition: (roomId: string, direction: 'north' | 'south' | 'east' | 'west') => void;
  isPaused: boolean;
  // Interaction callbacks
  onDialogue?: (lines: string[], speaker: 'carl' | 'paul') => void;
  onDialogueTree?: (tree: NpcDialogueTree) => void;
  onInteractionStateChange?: (state: InteractionState) => void;
  // Item pickup callback -- adds to inventory and shows notification
  onItemPickup?: (itemId: string) => void;
  // Locked door callback -- fired when player attempts a locked exit
  onLockedDoor?: (exit: import('../../types/game').RoomExit) => void;
  // Unlock exit callback -- story/key unlocks an exit by id
  onUnlockExit?: (lockId: string) => void;
  // Player inventory for locked-door checks
  playerInventory?: string[];
  // Initial atmosphere for the scene
  atmospherePreset?: AtmospherePreset;
  // Game state flags for effects
  screenShake?: boolean;
  bloodSplatter?: boolean;
  dramaticZoom?: boolean;
  // Stage completion callback
  onStageComplete?: () => void;
  // Dev AI mode — player positioned from props, skip manual input
  devAIEnabled?: boolean;
  // Layout-based rendering (required — layout must always exist)
  layout: GeneratedLayout;
  allRoomConfigs: Map<string, RoomConfig>;
  seed?: string;
  onRoomChange?: (roomId: string) => void;
  // Stage atmosphere config for per-room horror, audio, and music
  stageAtmosphere?: StageAtmosphere;
}

export const GameRenderer: React.FC<GameRendererProps> = ({
  playerCharacter,
  currentRoom,
  playerPosition,
  playerRotation,
  opponentPosition,
  opponentRotation,
  onPlayerMove,
  onRoomTransition: _unusedRoomTransition,
  isPaused,
  onDialogue,
  onDialogueTree,
  onInteractionStateChange,
  onItemPickup,
  onLockedDoor,
  onUnlockExit,
  playerInventory = [],
  atmospherePreset = 'cozy',
  screenShake = false,
  bloodSplatter = false,
  dramaticZoom = false,
  onStageComplete,
  devAIEnabled = false,
  layout,
  allRoomConfigs,
  seed: _unusedSeed,
  onRoomChange,
  stageAtmosphere
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const playerRef = useRef<Character | null>(null);
  const opponentRef = useRef<Character | null>(null);
  const gameCameraRef = useRef<GameCamera | null>(null);
  const viewportSizeRef = useRef<ViewportSize>('desktop');

  // Collision and interaction systems
  const collisionSystemRef = useRef<CollisionSystem | null>(null);
  const interactionSystemRef = useRef<InteractionSystem | null>(null);

  // Player pathfinding for tap-to-move
  const playerNavigatorRef = useRef<CharacterNavigator | null>(null);

  // Visual and audio effects
  const effectsManagerRef = useRef<EffectsManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const storyManagerRef = useRef<StoryManager | null>(null);
  const atmosphereManagerRef = useRef<AtmosphereManager | null>(null);

  // Layout rendering
  const renderedLayoutRef = useRef<RenderedLayout | null>(null);

  // Keep a ref to latest props so the render loop always reads fresh values
  const propsRef = useRef({
    isPaused, opponentPosition, opponentRotation, playerInventory,
    playerCharacter, onPlayerMove, onDialogue, onDialogueTree,
    onUnlockExit, onLockedDoor, onItemPickup, onInteractionStateChange,
    currentRoom, onStageComplete, devAIEnabled, playerPosition, playerRotation,
    onRoomChange, stageAtmosphere,
  });
  propsRef.current = {
    isPaused, opponentPosition, opponentRotation, playerInventory,
    playerCharacter, onPlayerMove, onDialogue, onDialogueTree,
    onUnlockExit, onLockedDoor, onItemPickup, onInteractionStateChange,
    currentRoom, onStageComplete, devAIEnabled, playerPosition, playerRotation,
    onRoomChange, stageAtmosphere,
  };

  // Handle interaction callback
  const handleInteraction = useCallback(() => {
    const interaction = interactionSystemRef.current;
    if (interaction) {
      interaction.interact(playerCharacter);
    }
  }, [playerCharacter]);

  // Expose interaction handler via GameBridge for input system
  useEffect(() => {
    GameBridge.setInteractionHandler(handleInteraction);
    return () => {
      GameBridge.clearInteractionHandler();
    };
  }, [handleInteraction]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECT TRIGGERS FROM GAME STATE
  // ─────────────────────────────────────────────────────────────────────────────

  // Screen shake effect
  useEffect(() => {
    if (screenShake && effectsManagerRef.current) {
      effectsManagerRef.current.shakeCamera(0.15, 500);
      audioManagerRef.current?.playSound(SoundEffects.SCREAM);
    }
  }, [screenShake]);

  // Blood splatter effect
  useEffect(() => {
    if (bloodSplatter && effectsManagerRef.current && playerRef.current) {
      const pos = playerRef.current.root.position;
      effectsManagerRef.current.spawnBloodSplatter(new Vector3(pos.x, 1, pos.z));
      audioManagerRef.current?.playSound(SoundEffects.BLOOD_SPLATTER);
    }
  }, [bloodSplatter]);

  // Dramatic zoom effect
  useEffect(() => {
    if (dramaticZoom && effectsManagerRef.current) {
      effectsManagerRef.current.zoomCamera(0.6, 500, 1000);
    }
  }, [dramaticZoom]);

  // Atmosphere preset changes
  useEffect(() => {
    if (atmosphereManagerRef.current) {
      atmosphereManagerRef.current.setPreset(atmospherePreset, 1500);
    }
  }, [atmospherePreset]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN SCENE INITIALIZATION — Layout-based multi-room rendering
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!layout || !allRoomConfigs) {
      throw new Error('GameRenderer requires layout and allRoomConfigs — layout generation failed upstream');
    }

    const engine = new Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true
    });
    engineRef.current = engine;

    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.05, 0.03, 0.03, 1);

    // Initialize collision system
    const collisionSystem = createCollisionSystem();
    collisionSystemRef.current = collisionSystem;

    // Set room bounds to full layout extent (no single-room clamping)
    const layoutBounds = getLayoutBounds(layout);
    collisionSystem.setRoomBounds(layoutBounds);

    // Initialize interaction system
    const interactionSystem = createInteractionSystem();
    interactionSystemRef.current = interactionSystem;
    interactionSystem.setCollisionSystem(collisionSystem);

    // Track prop meshes by type for removal on pickup
    const propMeshMap = new Map<string, AbstractMesh>();

    // ─────────────────────────────────────────────────────────────────────────
    // LIGHTING
    // ─────────────────────────────────────────────────────────────────────────
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    ambient.intensity = 1.0;
    ambient.groundColor = new Color3(0.25, 0.2, 0.18);

    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.5), scene);
    sun.intensity = 1.2;
    sun.position = new Vector3(8, 12, 8);

    scene.environmentIntensity = 1.0;

    const shadowGen = new ShadowGenerator(1024, sun);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 16;
    shadowGen.darkness = 0.4;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER LAYOUT GEOMETRY (floors, walls, connections — NO props)
    // ─────────────────────────────────────────────────────────────────────────
    renderLayout(scene, layout, shadowGen, { skipProps: true }).then(renderedLayout => {
      renderedLayoutRef.current = renderedLayout;
      // Initial room visibility — only show starting room + neighbors
      renderedLayout.updateRoomVisibility(currentRoom.id);
      // Give camera the walkability check so it can avoid clipping through walls
      if (gameCameraRef.current) {
        gameCameraRef.current.setWalkableCheck(renderedLayout.isWalkable);
      }
    }).catch(err => {
      console.error('[GameRenderer] Failed to render layout:', err);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE INTERACTIVE PROPS FROM allRoomConfigs (with world-space positions)
    // ─────────────────────────────────────────────────────────────────────────
    for (const [roomId, roomConfig] of allRoomConfigs) {
      const genRoom = layout.rooms.get(roomId);
      if (!genRoom) continue;

      const worldX = genRoom.worldPosition.x;
      const worldZ = genRoom.worldPosition.z;

      // Create prop colliders offset to world coordinates
      const propColliders = createCollidersFromProps(roomConfig.props, roomId);
      for (const collider of propColliders) {
        collider.bounds.minX += worldX;
        collider.bounds.maxX += worldX;
        collider.bounds.minZ += worldZ;
        collider.bounds.maxZ += worldZ;
        collisionSystem.addProp(collider);
      }

      // Create prop meshes in world space
      for (const prop of roomConfig.props) {
        createPropMeshAsync(scene, prop.type, prop.interactive, prop.itemDrop).then(mesh => {
          if (mesh) {
            mesh.position.set(worldX + prop.position.x, 0, worldZ + prop.position.z);
            mesh.rotation.y = prop.rotation;
            mesh.scaling.setAll(prop.scale);
            if (mesh instanceof AbstractMesh) {
              shadowGen.addShadowCaster(mesh);
            } else if ('getChildMeshes' in mesh) {
              (mesh as TransformNode).getChildMeshes().forEach(child => {
                shadowGen.addShadowCaster(child);
                child.receiveShadows = true;
              });
            }
            if (prop.itemDrop) {
              propMeshMap.set(prop.itemDrop, mesh);
            }
            // Track interactive meshes for glow effect
            if (prop.interactive && mesh instanceof AbstractMesh) {
              interactiveMeshes.push(mesh);
            }
          }
        });
      }

      // Place locked door barriers at doorway positions
      for (const exit of roomConfig.exits) {
        if (exit.locked && exit.id) {
          const doorWorldX = worldX + exit.position.x;
          const doorWorldZ = worldZ + exit.position.z;
          collisionSystem.addProp({
            id: `lock_${exit.id}`,
            type: 'lock',
            bounds: {
              minX: doorWorldX - 1.0,
              maxX: doorWorldX + 1.0,
              minZ: doorWorldZ - 1.0,
              maxZ: doorWorldZ + 1.0
            },
            solid: true,
            interactable: false,
          });

          // Visual lock marker
          const lockMarker = MeshBuilder.CreateBox(`lock_marker_${exit.id}`, {
            width: 1.5, height: 0.05, depth: 1.5
          }, scene);
          const lockMat = new StandardMaterial(`lockMat_${exit.id}`, scene);
          lockMat.diffuseColor = new Color3(0.5, 0.15, 0.15);
          lockMat.emissiveColor = new Color3(0.2, 0.05, 0.05);
          lockMat.alpha = 0.5;
          lockMarker.material = lockMat;
          lockMarker.position.set(doorWorldX, 0.03, doorWorldZ);

          const lockIcon = MeshBuilder.CreateBox(`lock_icon_${exit.id}`, {
            width: 0.25, height: 0.4, depth: 0.15
          }, scene);
          const lockIconMat = new StandardMaterial(`lockIconMat_${exit.id}`, scene);
          lockIconMat.diffuseColor = new Color3(0.6, 0.4, 0.1);
          lockIconMat.emissiveColor = new Color3(0.15, 0.1, 0.02);
          lockIcon.material = lockIconMat;
          lockIcon.position.set(doorWorldX, 0.6, doorWorldZ);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERACTION CALLBACKS
    // ─────────────────────────────────────────────────────────────────────────
    const audioManager = getAudioManager();
    audioManagerRef.current = audioManager;

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
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYER NAVIGATOR FOR TAP-TO-MOVE
    // ─────────────────────────────────────────────────────────────────────────
    const playerNavigator = createCharacterNavigator({
      startX: playerPosition.x,
      startZ: playerPosition.z,
      bounds: layoutBounds,
      maxSpeed: 4,
      obstacles: collisionSystem.getAllColliders()
    });
    playerNavigatorRef.current = playerNavigator;

    // ─────────────────────────────────────────────────────────────────────────
    // CLICK/TAP HANDLING
    // ─────────────────────────────────────────────────────────────────────────
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERUP) return;

      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
        // Only pick floor meshes and interactive props — skip walls, ceilings, etc.
        const name = mesh.name.toLowerCase();
        if (name.includes('floor') || name.includes('ground') || name.includes('rug')) return true;
        if (mesh.metadata?.interactive) return true;
        if (mesh.parent && (mesh.parent as AbstractMesh).metadata?.interactive) return true;
        return false;
      });

      if (pickResult?.hit && pickResult.pickedMesh) {
        const mesh = pickResult.pickedMesh;

        let propType: string | null = null;
        let itemDrop: string | undefined = undefined;

        if (mesh.metadata?.interactive) {
          propType = mesh.metadata.propType;
          itemDrop = mesh.metadata.itemDrop;
        } else if (mesh.parent && (mesh.parent as AbstractMesh).metadata?.interactive) {
          propType = (mesh.parent as AbstractMesh).metadata.propType;
          itemDrop = (mesh.parent as AbstractMesh).metadata?.itemDrop;
        }

        if (propType) {
          interactionSystem.interactWithProp(propType, propsRef.current.playerCharacter, itemDrop);
        } else if (pickResult.pickedPoint) {
          const point = pickResult.pickedPoint;
          const meshName = mesh.name.toLowerCase();
          if (meshName.includes('floor') || meshName.includes('ground') || meshName.includes('rug')) {
            playerNavigator.moveTo(point.x, point.z);
          }
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CAMERA
    // ─────────────────────────────────────────────────────────────────────────
    const canvas = canvasRef.current;
    const initialViewport = getViewportSize(canvas.clientWidth, canvas.clientHeight);
    viewportSizeRef.current = initialViewport;

    const gameCamera = createGameCamera(scene, initialViewport);
    gameCameraRef.current = gameCamera;
    gameCamera.setTarget(playerPosition.x, playerPosition.z);

    // ─────────────────────────────────────────────────────────────────────────
    // EFFECTS, AUDIO, ATMOSPHERE, AND STORY MANAGERS
    // ─────────────────────────────────────────────────────────────────────────
    const effectsManager = createEffectsManager(scene, gameCamera.camera, gameCamera.shakeOffset);
    effectsManagerRef.current = effectsManager;

    audioManager.init().catch(() => {});

    const atmosphereManager = getAtmosphereManager();
    atmosphereManagerRef.current = atmosphereManager;
    atmosphereManager.applyToScene(scene);
    atmosphereManager.setAudioManager({
      playMusic: (track, opts) => audioManager.playMusic(track, opts),
      stopMusic: (opts) => audioManager.stopMusic(opts),
      crossfadeMusic: (track, opts) => audioManager.crossfadeMusic(track, opts),
      playSound: (id, opts) => audioManager.playSound(id, opts),
    });
    atmosphereManager.setPreset(atmospherePreset, 0);

    const storyManager = getStoryManager();
    storyManagerRef.current = storyManager;

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

    // Wire dialogue-level effects (screen shake, horror pulse, music, zoom)
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

    // Set initial horror from atmosphere data for the entry room
    if (stageAtmosphere) {
      const entryOverride = stageAtmosphere.perRoomOverrides?.[currentRoom.id];
      const entryHorror = entryOverride?.horrorLevel ?? stageAtmosphere.baseHorrorLevel;
      storyManager.setSceneHorrorLevel(entryHorror);

      // Play stage-level music if defined
      if (stageAtmosphere.musicTrack) {
        audioManager.crossfadeMusic(stageAtmosphere.musicTrack, { duration: 1000 });
      }
    }

    storyManager.checkTrigger('scene_enter', { sceneId: currentRoom.id });

    // ─────────────────────────────────────────────────────────────────────────
    // HORROR VISUAL EFFECTS (vignette, tint, FOV)
    // ─────────────────────────────────────────────────────────────────────────
    scene.imageProcessingConfiguration.isEnabled = true;
    scene.imageProcessingConfiguration.toneMappingEnabled = false;
    scene.imageProcessingConfiguration.vignetteEnabled = false;
    scene.imageProcessingConfiguration.vignetteWeight = 0;
    let currentHorrorVisualLevel = 0;

    // ─────────────────────────────────────────────────────────────────────────
    // INTERACTIVE PROP GLOW — tracks meshes near the player
    // ─────────────────────────────────────────────────────────────────────────
    const interactiveMeshes: AbstractMesh[] = [];
    let glowPulse = 0;
    let lastGlowTarget: AbstractMesh | null = null;

    // ─────────────────────────────────────────────────────────────────────────
    // FOOTSTEP AUDIO — surface-based footstep sounds
    // ─────────────────────────────────────────────────────────────────────────
    let footstepTimer = 0;
    const FOOTSTEP_INTERVAL = 0.35; // seconds between footstep sounds

    // ─────────────────────────────────────────────────────────────────────────
    // MOVEMENT ACCELERATION — smooth ramp-up
    // ─────────────────────────────────────────────────────────────────────────
    let currentSpeed = 0;
    const BASE_SPEED = 4;
    const ACCEL_RATE = 14; // units/s^2 — reaches full speed in ~0.3s
    const DECEL_RATE = 20; // faster deceleration for snappy stops

    // Locked door feedback — cooldown to prevent spam
    let lastLockBumpTime = 0;
    const LOCK_BUMP_COOLDOWN = 2; // seconds between lock bump feedback

    // ─────────────────────────────────────────────────────────────────────────
    // TAP-TO-MOVE DESTINATION MARKER
    // ─────────────────────────────────────────────────────────────────────────
    const destMarker = MeshBuilder.CreateDisc('tapDestination', { radius: 0.3, tessellation: 32 }, scene);
    destMarker.rotation.x = Math.PI / 2;
    destMarker.position.y = 0.05;
    destMarker.isVisible = false;
    const destMarkerMat = new StandardMaterial('destMarkerMat', scene);
    destMarkerMat.diffuseColor = new Color3(0.4, 0.8, 0.4);
    destMarkerMat.emissiveColor = new Color3(0.2, 0.5, 0.2);
    destMarkerMat.alpha = 0.6;
    destMarker.material = destMarkerMat;
    let markerPulse = 0;

    // ─────────────────────────────────────────────────────────────────────────
    // CHARACTERS
    // ─────────────────────────────────────────────────────────────────────────
    const opponentChar = playerCharacter === 'carl' ? 'paul' : 'carl';

    createCharacter({
      scene,
      type: playerCharacter,
      position: new Vector3(playerPosition.x, 0, playerPosition.z),
      rotation: playerRotation,
      shadowGenerator: shadowGen,
      controller: 'player'
    }).then(character => {
      playerRef.current = character;
    });

    createCharacter({
      scene,
      type: opponentChar,
      position: new Vector3(opponentPosition.x, 0, opponentPosition.z),
      rotation: opponentRotation,
      shadowGenerator: shadowGen,
      controller: 'ai'
    }).then(character => {
      opponentRef.current = character;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GAME LOOP
    // ─────────────────────────────────────────────────────────────────────────
    let lastTime = performance.now();
    let lastInteractionState: InteractionState | null = null;
    let currentTrackedRoom = currentRoom.id;

    engine.runRenderLoop(() => {
      if (propsRef.current.isPaused) {
        scene.render();
        return;
      }

      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const player = playerRef.current;
      const opponent = opponentRef.current;
      const rl = renderedLayoutRef.current;

      // Player movement
      if (player && collisionSystemRef.current) {
        if (propsRef.current.devAIEnabled) {
          // ── DEV AI MODE: position from props ──
          const pp = propsRef.current.playerPosition;
          player.setPosition(pp.x, 0, pp.z);
          player.setTargetRotation(propsRef.current.playerRotation);
        } else {
          // ── NORMAL MODE: poll input from unified controller ──
          const rawInput = GameBridge.getInput() ?? { x: 0, z: 0 };
          // Camera-relative movement: project raw input onto camera fwd/right vectors.
          // Player facing direction = (-sin(rot), -cos(rot)).
          // Camera forward = same direction (camera looks where player faces).
          // Camera right = forward rotated 90° clockwise = (-cos(rot), sin(rot)).
          // Raw z=-1 (W) → forward, raw x=+1 (D) → right.
          const yaw = gameCameraRef.current?.getCameraYaw() ?? 0;
          const sinYaw = Math.sin(yaw);
          const cosYaw = Math.cos(yaw);
          const manualInput = {
            x: -rawInput.x * cosYaw + rawInput.z * sinYaw,
            z:  rawInput.x * sinYaw + rawInput.z * cosYaw,
          };
          const hasManualInput = manualInput.x !== 0 || manualInput.z !== 0;

          const navigator = playerNavigatorRef.current;
          let navInput = { x: 0, z: 0 };

          if (navigator) {
            if (hasManualInput && navigator.getMode() === 'moveTo') {
              navigator.idle();
              destMarker.isVisible = false;
            }

            navigator.setPosition(player.root.position.x, player.root.position.z);

            if (navigator.getMode() === 'moveTo') {
              navigator.update(dt);
              const pos = navigator.getPosition();
              const state = navigator.getState();
              if (state.targetX !== undefined && state.targetZ !== undefined && !state.arrived) {
                const dx = state.targetX - pos.x;
                const dz = state.targetZ - pos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist > 0.1) {
                  navInput.x = dx / dist;
                  navInput.z = dz / dist;
                }
                destMarker.isVisible = true;
                destMarker.position.x = state.targetX;
                destMarker.position.z = state.targetZ;
                markerPulse += dt * 4;
                const scale = 0.8 + Math.sin(markerPulse) * 0.2;
                destMarker.scaling.setAll(scale);
                destMarkerMat.alpha = 0.4 + Math.sin(markerPulse) * 0.2;
              } else {
                destMarker.isVisible = false;
              }
            } else {
              destMarker.isVisible = false;
            }
          }

          const input = hasManualInput ? manualInput : navInput;
          const hasInput = input.x !== 0 || input.z !== 0;

          // Smooth acceleration/deceleration
          if (hasInput) {
            currentSpeed = Math.min(BASE_SPEED, currentSpeed + ACCEL_RATE * dt);
          } else {
            currentSpeed = Math.max(0, currentSpeed - DECEL_RATE * dt);
          }

          if (hasInput && currentSpeed > 0) {
            const len = Math.sqrt(input.x * input.x + input.z * input.z);
            const nx = input.x / len;
            const nz = input.z / len;

            const fromX = player.root.position.x;
            const fromZ = player.root.position.z;
            let toX = fromX + nx * currentSpeed * dt;
            let toZ = fromZ + nz * currentSpeed * dt;

            // Check collision with props
            const moveResult = collisionSystemRef.current.checkMovement(
              fromX, fromZ, toX, toZ, 0.4
            );

            let newX = moveResult.adjustedX;
            let newZ = moveResult.adjustedZ;

            // Locked door feedback — play sound and show hint when bumping into a lock barrier
            if (moveResult.blocked && moveResult.collidedWith?.type === 'lock') {
              const gameTime = now / 1000;
              if (gameTime - lastLockBumpTime > LOCK_BUMP_COOLDOWN) {
                lastLockBumpTime = gameTime;
                audioManager.playSound(SoundEffects.DOOR_LOCKED, { volume: 0.6 });
                propsRef.current.onDialogue?.(
                  ['This door is locked. I need to find a key.'],
                  propsRef.current.playerCharacter
                );
              }
            }

            // Layout walkability check — prevents walking through walls / into void
            if (rl && !rl.isWalkable(newX, newZ)) {
              newX = fromX;
              newZ = fromZ;
            }

            // Get ground Y for multi-floor support
            const newY = rl ? rl.getGroundY(newX, newZ) : 0;

            player.setPosition(newX, newY, newZ);
            player.setTargetRotation(Math.atan2(-nx, -nz));

            // Feed player rotation to camera so it orbits behind the player
            if (gameCameraRef.current) {
              gameCameraRef.current.setPlayerRotation(player.currentRotation);
            }

            propsRef.current.onPlayerMove(newX, newY, newZ, player.currentRotation);

            // Footstep audio — play surface-appropriate sound at regular intervals
            footstepTimer += dt;
            if (footstepTimer >= FOOTSTEP_INTERVAL) {
              footstepTimer = 0;
              const roomId = currentTrackedRoom.toLowerCase();
              let sfx: string = SoundEffects.FOOTSTEP_WOOD;
              if (roomId.includes('kitchen') || roomId.includes('bathroom')) {
                sfx = SoundEffects.FOOTSTEP_TILE;
              } else if (roomId.includes('bedroom') || roomId.includes('lounge') || roomId.includes('living')) {
                sfx = SoundEffects.FOOTSTEP_CARPET;
              } else if (roomId.includes('basement') || roomId.includes('storage') || roomId.includes('street') || roomId.includes('alley')) {
                sfx = SoundEffects.FOOTSTEP_STONE;
              }
              audioManager.playSound(sfx, { volume: 0.3 });
            }
          } else {
            footstepTimer = FOOTSTEP_INTERVAL; // Reset so next step sounds immediately
          }
        }

        // Room detection — check which room the player is now in
        if (rl) {
          const px = player.root.position.x;
          const pz = player.root.position.z;
          const renderedRoom = rl.getRoomAt(px, pz);
          if (renderedRoom && renderedRoom.id !== currentTrackedRoom) {
            const prevRoom = currentTrackedRoom;
            currentTrackedRoom = renderedRoom.id;
            // Update room visibility — only show current + adjacent rooms
            rl.updateRoomVisibility(renderedRoom.id);
            audioManager.playSound(SoundEffects.DOOR_OPEN, { volume: 0.5 });
            propsRef.current.onRoomChange?.(renderedRoom.id);

            // Brief visual door transition — flash darken
            const prevClearColor = scene.clearColor.clone();
            scene.clearColor = new Color4(0, 0, 0, 1);
            setTimeout(() => {
              if (!scene.isDisposed) scene.clearColor = prevClearColor;
            }, 150);

            // Apply per-room atmosphere from stage definition
            const atmo = propsRef.current.stageAtmosphere;
            if (atmo && storyManagerRef.current) {
              // Set scene horror level from room override or stage base
              const roomOverride = atmo.perRoomOverrides?.[renderedRoom.id];
              const roomHorror = roomOverride?.horrorLevel ?? atmo.baseHorrorLevel;
              storyManagerRef.current.setSceneHorrorLevel(roomHorror);

              // Crossfade music if room has a specific track
              const roomMusic = roomOverride?.musicTrack ?? atmo.musicTrack;
              if (roomMusic) {
                audioManager.crossfadeMusic(roomMusic, { duration: 2000 });
              }

              // Switch ambient sound if room specifies one
              const roomAmbient = roomOverride?.ambientSound;
              if (roomAmbient) {
                audioManager.playSound(roomAmbient, { volume: 0.3 });
              }
            }

            // Fire story triggers for room change
            if (storyManagerRef.current) {
              storyManagerRef.current.checkTrigger('scene_exit', { sceneId: prevRoom });
              storyManagerRef.current.checkTrigger('scene_enter', { sceneId: renderedRoom.id });
            }
          }
        }

        // Update interaction system
        if (interactionSystemRef.current) {
          const interactionState = interactionSystemRef.current.update(
            player.root.position.x,
            player.root.position.z
          );

          const cb = propsRef.current.onInteractionStateChange;
          if (cb && (
            interactionState.nearbyInteractable !== lastInteractionState?.nearbyInteractable ||
            interactionState.canInteract !== lastInteractionState?.canInteract
          )) {
            lastInteractionState = interactionState;
            cb(interactionState);
          }
        }

        // Interactive prop glow — pulse emissive on nearby interactive props
        glowPulse += dt * 3;
        const px = player.root.position.x;
        const pz = player.root.position.z;
        const GLOW_RANGE = 2.5;

        let closestInteractive: AbstractMesh | null = null;
        let closestDist = GLOW_RANGE;

        for (const mesh of interactiveMeshes) {
          if (mesh.isDisposed()) continue;
          const dx = mesh.position.x - px;
          const dz = mesh.position.z - pz;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < closestDist) {
            closestDist = dist;
            closestInteractive = mesh;
          }
          // Reset emissive on meshes that moved out of range
          if (mesh !== closestInteractive && mesh.material instanceof StandardMaterial) {
            mesh.material.emissiveColor = Color3.Black();
          }
        }

        if (closestInteractive && closestInteractive !== lastGlowTarget) {
          // Clear old glow
          if (lastGlowTarget && !lastGlowTarget.isDisposed() && lastGlowTarget.material instanceof StandardMaterial) {
            lastGlowTarget.material.emissiveColor = Color3.Black();
          }
          lastGlowTarget = closestInteractive;
        } else if (!closestInteractive && lastGlowTarget) {
          if (!lastGlowTarget.isDisposed() && lastGlowTarget.material instanceof StandardMaterial) {
            lastGlowTarget.material.emissiveColor = Color3.Black();
          }
          lastGlowTarget = null;
        }

        if (lastGlowTarget && !lastGlowTarget.isDisposed() && lastGlowTarget.material instanceof StandardMaterial) {
          const pulse = 0.08 + Math.sin(glowPulse) * 0.06;
          lastGlowTarget.material.emissiveColor = new Color3(pulse * 1.5, pulse * 1.2, pulse * 0.5);
        }

        player.update(dt);

        if (gameCameraRef.current) {
          gameCameraRef.current.setTarget(player.root.position.x, player.root.position.z);
        }
      }

      // Update opponent (AI controlled)
      if (opponent) {
        const opp = propsRef.current.opponentPosition;
        opponent.setPosition(opp.x, 0, opp.z);
        opponent.setTargetRotation(propsRef.current.opponentRotation);
        opponent.update(dt);
      }

      // Update camera (smooth follow)
      if (gameCameraRef.current) {
        gameCameraRef.current.update();
      }

      // Update effects
      if (effectsManagerRef.current) {
        effectsManagerRef.current.update(dt);
      }

      // Update atmosphere
      if (atmosphereManagerRef.current) {
        atmosphereManagerRef.current.update(dt);
      }

      // Horror visual effects — progressive screen-space effects
      if (storyManagerRef.current) {
        const horrorLevel = storyManagerRef.current.getHorrorLevel();
        // Smooth transition to target horror level
        currentHorrorVisualLevel += (horrorLevel - currentHorrorVisualLevel) * dt * 0.5;

        const imgProc = scene.imageProcessingConfiguration;
        if (currentHorrorVisualLevel >= 3) {
          // Vignette darkening at horror 3+
          imgProc.vignetteEnabled = true;
          const vignetteStrength = Math.min(1, (currentHorrorVisualLevel - 3) / 4);
          imgProc.vignetteWeight = vignetteStrength * 5;
          imgProc.vignetteColor = new Color4(
            0.1 + vignetteStrength * 0.3,
            0.05,
            0.05,
            1
          );
        } else {
          imgProc.vignetteEnabled = false;
        }

        if (currentHorrorVisualLevel >= 5) {
          // Red tint on ambient light at horror 5+
          const tintStrength = Math.min(1, (currentHorrorVisualLevel - 5) / 3);
          ambient.groundColor = new Color3(
            0.25 + tintStrength * 0.15,
            0.2 - tintStrength * 0.08,
            0.18 - tintStrength * 0.08
          );
        }

        if (currentHorrorVisualLevel >= 7 && gameCameraRef.current) {
          // Subtle FOV narrowing at horror 7+ (creates tunnel vision)
          const fovFactor = 1 - Math.min(0.08, (currentHorrorVisualLevel - 7) * 0.025);
          gameCameraRef.current.camera.fov *= fovFactor;
        }
      }

      scene.render();
    });

    // Resize handling
    const handleResize = () => {
      engine.resize();
      if (canvasRef.current && gameCameraRef.current) {
        const newSize = getViewportSize(
          canvasRef.current.clientWidth,
          canvasRef.current.clientHeight
        );
        if (newSize !== viewportSizeRef.current) {
          viewportSizeRef.current = newSize;
          gameCameraRef.current.setViewportSize(newSize);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderedLayoutRef.current?.dispose();
      renderedLayoutRef.current = null;
      collisionSystemRef.current?.clear();
      playerNavigatorRef.current?.dispose();
      effectsManagerRef.current?.dispose();
      atmosphereManagerRef.current?.dispose();
      clearTextureCache();
      engine.dispose();
    };
  }, [layout, allRoomConfigs]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full outline-none touch-none"
    />
  );
};

/**
 * Compute bounding box encompassing the entire layout for collision system.
 */
function getLayoutBounds(layout: GeneratedLayout) {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const room of layout.rooms.values()) {
    const hw = room.size.width / 2;
    const hh = room.size.height / 2;
    minX = Math.min(minX, room.worldPosition.x - hw);
    maxX = Math.max(maxX, room.worldPosition.x + hw);
    minZ = Math.min(minZ, room.worldPosition.z - hh);
    maxZ = Math.max(maxZ, room.worldPosition.z + hh);
  }

  // Add margin
  return { minX: minX - 2, maxX: maxX + 2, minZ: minZ - 2, maxZ: maxZ + 2 };
}

export default GameRenderer;
