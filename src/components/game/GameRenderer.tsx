/**
 * GameRenderer - Layout-based 3D rendering component (orchestrator)
 * =================================================================
 *
 * Thin React wrapper that creates a Babylon.js canvas and delegates to
 * focused subsystem modules in `./renderer/`:
 *
 * - **lighting** — ambient light, sun, shadows
 * - **sceneProps** — prop meshes, collision registration, locked doors
 * - **managerWiring** — interaction, story, atmosphere, effects callbacks
 * - **PlayerMovement** — acceleration, collision, footsteps, tap-to-move
 * - **RoomTracking** — room detection, atmosphere transitions, story triggers
 * - **InteractiveGlow** — emissive pulse on nearby interactive props
 * - **HorrorVisuals** — vignette, color tint, FOV narrowing
 * - **CameraPipeline** — camera intelligence, auto-heal, telemetry
 */
import React, { useEffect, useRef, useCallback } from 'react';
import {
  Engine,
  Scene,
  Vector3,
  Color4,
  AbstractMesh,
  PointerEventTypes,
} from '@babylonjs/core';
import { clearTextureCache } from '../../systems/TextureLoader';
import { CharacterType, RoomConfig } from '../../types/game';
import { createCharacter, Character } from '../../systems/Character';
import { createGameCamera, getViewportSize, GameCamera, ViewportSize } from '../../systems/Camera';
import { createCollisionSystem, CollisionSystem } from '../../systems/CollisionSystem';
import { createInteractionSystem, InteractionSystem, InteractionState } from '../../systems/InteractionSystem';
import { createCharacterNavigator, CharacterNavigator } from '../../systems/CharacterNavigator';
import { createEffectsManager, EffectsManager } from '../../systems/EffectsManager';
import { getAudioManager, AudioManager, SoundEffects } from '../../systems/AudioManager';
import { getStoryManager, StoryManager, NpcDialogueTree } from '../../systems/StoryManager';
import { getAtmosphereManager, AtmosphereManager, AtmospherePreset } from '../../systems/AtmosphereManager';
import { renderLayout, RenderedLayout } from '../../systems/LayoutRenderer';
import type { GeneratedLayout } from '../../systems/LayoutGenerator';
import type { StageAtmosphere } from '../../systems/GameInitializer';
import { GameBridge } from '../../utils/gameBridge';

// Subsystem modules
import { createSceneLighting, SceneLighting } from './renderer/lighting';
import { createSceneProps } from './renderer/sceneProps';
import { wireManagers } from './renderer/managerWiring';
import { createPlayerMovement, PlayerMovement } from './renderer/PlayerMovement';
import { createRoomTracker, RoomTracker } from './renderer/RoomTracking';
import { createInteractiveGlow, InteractiveGlow } from './renderer/InteractiveGlow';
import { createHorrorVisuals, HorrorVisuals } from './renderer/HorrorVisuals';
import { createCameraPipeline, CameraPipeline } from './renderer/CameraPipeline';

// Re-export shared types so existing imports (GameView, App, DevAIOverlay) continue to work
export type { CameraTelemetry } from './renderer/types';
export type { PropsSnapshot } from './renderer/types';

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
  onDialogue?: (lines: string[], speaker: 'carl' | 'paul') => void;
  onDialogueTree?: (tree: NpcDialogueTree) => void;
  onInteractionStateChange?: (state: InteractionState) => void;
  onItemPickup?: (itemId: string) => void;
  onLockedDoor?: (exit: import('../../types/game').RoomExit) => void;
  onUnlockExit?: (lockId: string) => void;
  playerInventory?: string[];
  atmospherePreset?: AtmospherePreset;
  screenShake?: boolean;
  bloodSplatter?: boolean;
  dramaticZoom?: boolean;
  onStageComplete?: () => void;
  devAIEnabled?: boolean;
  layout: GeneratedLayout;
  allRoomConfigs: Map<string, RoomConfig>;
  seed?: string;
  onRoomChange?: (roomId: string) => void;
  stageAtmosphere?: StageAtmosphere;
  cameraTelemetryRef?: React.MutableRefObject<import('./renderer/types').CameraTelemetry | null>;
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
  stageAtmosphere,
  cameraTelemetryRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const playerRef = useRef<Character | null>(null);
  const opponentRef = useRef<Character | null>(null);
  const gameCameraRef = useRef<GameCamera | null>(null);
  const viewportSizeRef = useRef<ViewportSize>('desktop');
  const collisionSystemRef = useRef<CollisionSystem | null>(null);
  const interactionSystemRef = useRef<InteractionSystem | null>(null);
  const playerNavigatorRef = useRef<CharacterNavigator | null>(null);
  const effectsManagerRef = useRef<EffectsManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const storyManagerRef = useRef<StoryManager | null>(null);
  const atmosphereManagerRef = useRef<AtmosphereManager | null>(null);
  const renderedLayoutRef = useRef<RenderedLayout | null>(null);

  // Subsystem refs
  const playerMovementRef = useRef<PlayerMovement | null>(null);
  const roomTrackerRef = useRef<RoomTracker | null>(null);
  const interactiveGlowRef = useRef<InteractiveGlow | null>(null);
  const horrorVisualsRef = useRef<HorrorVisuals | null>(null);
  const cameraPipelineRef = useRef<CameraPipeline | null>(null);
  const lightingRef = useRef<SceneLighting | null>(null);

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
    interactionSystemRef.current?.interact(playerCharacter);
  }, [playerCharacter]);

  useEffect(() => {
    GameBridge.setInteractionHandler(handleInteraction);
    return () => { GameBridge.clearInteractionHandler(); };
  }, [handleInteraction]);

  // ── EFFECT TRIGGERS FROM GAME STATE ──
  useEffect(() => {
    if (screenShake && effectsManagerRef.current) {
      effectsManagerRef.current.shakeCamera(0.15, 500);
      audioManagerRef.current?.playSound(SoundEffects.SCREAM);
    }
  }, [screenShake]);

  useEffect(() => {
    if (bloodSplatter && effectsManagerRef.current && playerRef.current) {
      const pos = playerRef.current.root.position;
      effectsManagerRef.current.spawnBloodSplatter(new Vector3(pos.x, 1, pos.z));
      audioManagerRef.current?.playSound(SoundEffects.BLOOD_SPLATTER);
    }
  }, [bloodSplatter]);

  useEffect(() => {
    if (dramaticZoom && effectsManagerRef.current) {
      effectsManagerRef.current.zoomCamera(0.6, 500, 1000);
    }
  }, [dramaticZoom]);

  useEffect(() => {
    if (atmosphereManagerRef.current) {
      atmosphereManagerRef.current.setPreset(atmospherePreset, 1500);
    }
  }, [atmospherePreset]);

  // ── MAIN SCENE INITIALIZATION ──
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!layout || !allRoomConfigs) {
      throw new Error('GameRenderer requires layout and allRoomConfigs');
    }

    const engine = new Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });
    engineRef.current = engine;

    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.05, 0.03, 0.03, 1);

    // ── Collision & interaction systems ──
    const collisionSystem = createCollisionSystem();
    collisionSystemRef.current = collisionSystem;
    const layoutBounds = getLayoutBounds(layout);
    collisionSystem.setRoomBounds(layoutBounds);

    const interactionSystem = createInteractionSystem();
    interactionSystemRef.current = interactionSystem;
    interactionSystem.setCollisionSystem(collisionSystem);

    // ── Lighting ──
    const lighting = createSceneLighting(scene);
    lightingRef.current = lighting;

    // ── Layout geometry (floors, walls, connections) ──
    renderLayout(scene, layout, lighting.shadowGen, { skipProps: true }).then(rl => {
      renderedLayoutRef.current = rl;
      rl.updateRoomVisibility(currentRoom.id);
      if (gameCameraRef.current) {
        gameCameraRef.current.setWalkableCheck(rl.isWalkable);
      }
    }).catch(err => {
      console.error('[GameRenderer] Failed to render layout:', err);
    });

    // ── Props ──
    const { propMeshMap, interactiveMeshes } = createSceneProps(
      scene, layout, allRoomConfigs, lighting.shadowGen, collisionSystem,
    );

    // ── Audio, story, atmosphere, effects ──
    const audioManager = getAudioManager();
    audioManagerRef.current = audioManager;
    audioManager.init().catch(() => {});

    const canvas = canvasRef.current;
    const initialViewport = getViewportSize(canvas.clientWidth, canvas.clientHeight);
    viewportSizeRef.current = initialViewport;
    const gameCamera = createGameCamera(scene, initialViewport);
    gameCameraRef.current = gameCamera;
    gameCamera.setTarget(playerPosition.x, playerPosition.z);

    const effectsManager = createEffectsManager(scene, gameCamera.camera, gameCamera.shakeOffset);
    effectsManagerRef.current = effectsManager;

    const atmosphereManager = getAtmosphereManager();
    atmosphereManagerRef.current = atmosphereManager;

    const storyManager = getStoryManager();
    storyManagerRef.current = storyManager;

    wireManagers({
      scene, interactionSystem, collisionSystem, audioManager,
      storyManager, atmosphereManager, effectsManager,
      shadowGen: lighting.shadowGen, propMeshMap, propsRef,
      playerCharacter, atmospherePreset, stageAtmosphere, currentRoomId: currentRoom.id,
    });

    // ── Player navigator (tap-to-move) ──
    const playerNavigator = createCharacterNavigator({
      startX: playerPosition.x,
      startZ: playerPosition.z,
      bounds: layoutBounds,
      maxSpeed: 4,
      obstacles: collisionSystem.getAllColliders(),
    });
    playerNavigatorRef.current = playerNavigator;

    // ── Click/tap handling ──
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERUP) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
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

    // ── Subsystems ──
    const playerMovement = createPlayerMovement(scene, collisionSystem, audioManager);
    playerMovementRef.current = playerMovement;

    const roomTracker = createRoomTracker(
      scene, currentRoom.id, audioManager, storyManager,
    );
    roomTrackerRef.current = roomTracker;

    const interactiveGlow = createInteractiveGlow();
    interactiveGlowRef.current = interactiveGlow;

    const horrorVisuals = createHorrorVisuals(scene);
    horrorVisualsRef.current = horrorVisuals;

    const cameraPipeline = createCameraPipeline(scene, devAIEnabled, canvasRef.current);
    cameraPipelineRef.current = cameraPipeline;
    roomTracker.setPlaytestReporter(cameraPipeline.getPlaytestReporter());

    // ── Characters ──
    const opponentChar = playerCharacter === 'carl' ? 'paul' : 'carl';

    createCharacter({
      scene,
      type: playerCharacter,
      position: new Vector3(playerPosition.x, 0, playerPosition.z),
      rotation: playerRotation,
      shadowGenerator: lighting.shadowGen,
      controller: 'player',
    }).then(character => { playerRef.current = character; });

    createCharacter({
      scene,
      type: opponentChar,
      position: new Vector3(opponentPosition.x, 0, opponentPosition.z),
      rotation: opponentRotation,
      shadowGenerator: lighting.shadowGen,
      controller: 'ai',
    }).then(character => { opponentRef.current = character; });

    // ── GAME LOOP ──
    let lastTime = performance.now();
    let lastInteractionState: InteractionState | null = null;

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

      // Player movement + room tracking + interactions
      if (player && collisionSystem) {
        playerMovement.update(
          dt, player, gameCameraRef.current, rl,
          playerNavigatorRef.current, propsRef, roomTracker.getCurrentRoom(),
        );

        if (rl) {
          roomTracker.update(player, rl, propsRef);
        }

        // Interaction system
        const interactionState = interactionSystem.update(
          player.root.position.x, player.root.position.z,
        );
        const cb = propsRef.current.onInteractionStateChange;
        if (cb && (
          interactionState.nearbyInteractable !== lastInteractionState?.nearbyInteractable ||
          interactionState.canInteract !== lastInteractionState?.canInteract
        )) {
          lastInteractionState = interactionState;
          cb(interactionState);
        }

        // Interactive prop glow
        interactiveGlow.update(
          dt, player.root.position.x, player.root.position.z, interactiveMeshes,
        );

        player.update(dt);

        if (gameCameraRef.current) {
          gameCameraRef.current.setTarget(player.root.position.x, player.root.position.z);
        }
      }

      // Opponent update
      if (opponent) {
        const opp = propsRef.current.opponentPosition;
        const oppY = rl ? rl.getGroundY(opp.x, opp.z) : 0;
        opponent.setPosition(opp.x, oppY, opp.z);
        opponent.setTargetRotation(propsRef.current.opponentRotation);
        opponent.update(dt);
      }

      // Camera intelligence + auto-heal (lazy-init when both characters exist)
      if (player && opponent && gameCameraRef.current && !cameraPipeline.isInitialized()) {
        cameraPipeline.initIfReady(gameCameraRef.current, player.root, opponent.root);
        roomTracker.setPlaytestReporter(cameraPipeline.getPlaytestReporter());
      }
      if (gameCameraRef.current) {
        cameraPipeline.update(dt, engine, gameCameraRef.current, cameraTelemetryRef);
      }

      // Camera, effects, atmosphere
      gameCameraRef.current?.update();
      effectsManager.update(dt);
      atmosphereManager.update(dt);

      // Horror visual effects
      if (storyManagerRef.current) {
        horrorVisuals.update(
          dt, storyManagerRef.current, lighting.ambient, gameCameraRef.current,
        );
      }

      scene.render();
    });

    // ── Resize handling ──
    const handleResize = () => {
      engine.resize();
      if (canvasRef.current && gameCameraRef.current) {
        const newSize = getViewportSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
        if (newSize !== viewportSizeRef.current) {
          viewportSizeRef.current = newSize;
          gameCameraRef.current.setViewportSize(newSize);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 50);

    // ── Cleanup ──
    return () => {
      window.removeEventListener('resize', handleResize);
      cameraPipelineRef.current?.dispose();
      cameraPipelineRef.current = null;
      playerMovementRef.current?.dispose();
      playerMovementRef.current = null;
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

/** Compute bounding box encompassing the entire layout for collision system. */
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
  return { minX: minX - 2, maxX: maxX + 2, minZ: minZ - 2, maxZ: maxZ + 2 };
}

export default GameRenderer;
