/**
 * GameRenderer - 3D rendering component for gameplay
 * ==================================================
 * 
 * Handles Babylon.js scene rendering with collision detection and interaction support.
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
  getTexturesForRoom,
  createFloorMaterial,
  createWallMaterial,
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
  StoryManager 
} from '../../systems/StoryManager';
import {
  getAtmosphereManager,
  AtmosphereManager,
  AtmospherePreset
} from '../../systems/AtmosphereManager';

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
  // Adjacent rooms for rendering context on larger screens
  adjacentRooms?: RoomConfig[];
  // Interaction callbacks
  onDialogue?: (lines: string[], speaker: 'carl' | 'paul') => void;
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
}

export const GameRenderer: React.FC<GameRendererProps> = ({
  playerCharacter,
  currentRoom,
  playerPosition,
  playerRotation,
  opponentPosition,
  opponentRotation,
  onPlayerMove,
  onRoomTransition,
  isPaused,
  adjacentRooms: _adjacentRooms = [],
  onDialogue,
  onInteractionStateChange,
  onItemPickup,
  onLockedDoor,
  onUnlockExit,
  playerInventory = [],
  atmospherePreset = 'cozy',
  screenShake = false,
  bloodSplatter = false,
  dramaticZoom = false
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
  
  // Handle interaction callback
  const handleInteraction = useCallback(() => {
    const interaction = interactionSystemRef.current;
    if (interaction) {
      interaction.interact(playerCharacter);
    }
  }, [playerCharacter]);
  
  // Expose interaction handler globally for input system
  useEffect(() => {
    (window as any).__gameInteract = handleInteraction;
    return () => {
      delete (window as any).__gameInteract;
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
  
  // Room transition - trigger story beats and atmosphere when entering new rooms
  useEffect(() => {
    if (currentRoom?.id) {
      // Check for scene_enter story triggers
      storyManagerRef.current?.checkTrigger('scene_enter', { sceneId: currentRoom.id });
      
      // Play door sound on room transitions
      audioManagerRef.current?.playSound(SoundEffects.DOOR_OPEN);
    }
  }, [currentRoom?.id]);
  
  // Initialize scene
  useEffect(() => {
    if (!canvasRef.current) return;
    
    console.log('GameRenderer: Initializing with collision system');
    
    const engine = new Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true
    });
    engineRef.current = engine;
    
    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.08, 0.05, 0.03, 1);
    
    // Initialize collision system
    const collisionSystem = createCollisionSystem();
    collisionSystemRef.current = collisionSystem;
    
    // Set room bounds for collision
    const hw = currentRoom.width / 2 - 0.5;
    const hh = currentRoom.height / 2 - 0.5;
    collisionSystem.setRoomBounds({
      minX: -hw,
      maxX: hw,
      minZ: -hh,
      maxZ: hh
    });
    
    // Add prop colliders
    const propColliders = createCollidersFromProps(currentRoom.props, currentRoom.id);
    propColliders.forEach(collider => collisionSystem.addProp(collider));
    console.log(`Added ${propColliders.length} prop colliders`);
    
    // Initialize interaction system
    const interactionSystem = createInteractionSystem();
    interactionSystemRef.current = interactionSystem;
    interactionSystem.setCollisionSystem(collisionSystem);
    
    // Track prop meshes by type for removal on pickup
    const propMeshMap = new Map<string, AbstractMesh>();

    // Set up interaction callbacks
    interactionSystem.setCallbacks({
      onDialogue: (lines, speaker) => {
        console.log(`Dialogue [${speaker}]:`, lines);
        onDialogue?.(lines, speaker);
      },
      onItemPickup: (itemId) => {
        console.log(`Item picked up: ${itemId}`);
        // Play pickup sound
        audioManager.playSound(SoundEffects.ITEM_PICKUP);
        // Add to inventory via parent callback
        onItemPickup?.(itemId);
        // Remove the prop mesh from the scene
        const mesh = propMeshMap.get(itemId);
        if (mesh) {
          mesh.dispose();
          propMeshMap.delete(itemId);
        }
        // Remove collider so player can walk through the space
        collisionSystem.removeProp(
          collisionSystem.getAllColliders().find(c => c.itemDrop === itemId)?.id ?? ''
        );
        // Show brief pickup notification via dialogue
        onDialogue?.([`Picked up: ${itemId.replace(/_/g, ' ')}`], playerCharacter);
      },
      onHorrorIncrease: (amount) => {
        console.log(`Horror increased by ${amount}`);
      },
      onUnlock: (lockId) => {
        console.log(`Unlocked: ${lockId}`);
        audioManager.playSound(SoundEffects.DOOR_UNLOCK);
        onUnlockExit?.(lockId);
      }
    });
    
    // ─────────────────────────────────────────────────────────────────────────────
    // PLAYER NAVIGATOR FOR TAP-TO-MOVE
    // ─────────────────────────────────────────────────────────────────────────────
    const playerNavigator = createCharacterNavigator({
      startX: playerPosition.x,
      startZ: playerPosition.z,
      bounds: {
        minX: -hw,
        maxX: hw,
        minZ: -hh,
        maxZ: hh
      },
      maxSpeed: 4,
      obstacles: propColliders
    });
    playerNavigatorRef.current = playerNavigator;
    
    // ─────────────────────────────────────────────────────────────────────────────
    // CLICK/TAP HANDLING - INTERACTIONS AND TAP-TO-MOVE
    // ─────────────────────────────────────────────────────────────────────────────
    // 
    // Desktop: Click on objects to interact, click on ground to move
    // Mobile: Tap on objects to interact, tap on ground to move
    // Uses raycasting to detect what was clicked/tapped
    // ─────────────────────────────────────────────────────────────────────────────
    scene.onPointerObservable.add((pointerInfo) => {
      // Only handle pointer up (click/tap release) to avoid double-triggering
      if (pointerInfo.type !== PointerEventTypes.POINTERUP) {
        return;
      }
      
      // Use scene.pick to raycast from pointer position
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      
      if (pickResult?.hit && pickResult.pickedMesh) {
        const mesh = pickResult.pickedMesh;
        
        // Check if this mesh or its parent has interactive metadata
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
          // Clicked on interactive prop - interact with it
          console.log(`Clicked/tapped on interactive prop: ${propType}`);
          interactionSystem.interactWithProp(propType, playerCharacter, itemDrop);
        } else if (pickResult.pickedPoint) {
          // Clicked on ground/floor - tap to move
          const point = pickResult.pickedPoint;
          const meshName = mesh.name.toLowerCase();
          
          // Only tap-to-move on floor/ground surfaces
          if (meshName.includes('floor') || meshName.includes('ground') || meshName.includes('rug')) {
            console.log(`Tap-to-move: (${point.x.toFixed(2)}, ${point.z.toFixed(2)})`);
            playerNavigator.moveTo(point.x, point.z);
          }
        }
      }
    });
    
    // Determine viewport size from canvas
    const canvas = canvasRef.current;
    const initialViewport = getViewportSize(canvas.clientWidth, canvas.clientHeight);
    viewportSizeRef.current = initialViewport;
    
    // Fixed isometric-style camera (no user rotation)
    const gameCamera = createGameCamera(scene, initialViewport);
    gameCameraRef.current = gameCamera;
    gameCamera.setTarget(playerPosition.x, playerPosition.z);
    
    // ─────────────────────────────────────────────────────────────────────────────
    // EFFECTS, AUDIO, ATMOSPHERE, AND STORY MANAGERS
    // ─────────────────────────────────────────────────────────────────────────────
    
    // Initialize effects manager with scene and camera (for shake, zoom, particles)
    const effectsManager = createEffectsManager(scene, gameCamera.camera);
    effectsManagerRef.current = effectsManager;
    
    // Initialize audio manager (singleton) - init() must be called after user interaction
    const audioManager = getAudioManager();
    audioManagerRef.current = audioManager;
    
    // Initialize Tone.js context (safe to call multiple times)
    audioManager.init().then(() => {
      console.log('Audio manager initialized');
    }).catch(err => {
      console.warn('Audio init failed (will retry on interaction):', err);
    });
    
    // Initialize atmosphere manager (controls fog, lighting, ambient audio)
    const atmosphereManager = getAtmosphereManager();
    atmosphereManagerRef.current = atmosphereManager;
    atmosphereManager.applyToScene(scene);
    atmosphereManager.setAudioManager({
      playMusic: (track, opts) => audioManager.playMusic(track, opts),
      stopMusic: (opts) => audioManager.stopMusic(opts),
      crossfadeMusic: (track, opts) => audioManager.crossfadeMusic(track, opts),
      playSound: (id, opts) => audioManager.playSound(id, opts),
    });

    // Set initial atmosphere from prop or default to cozy
    atmosphereManager.setPreset(atmospherePreset, 0);
    
    // Initialize story manager (singleton)
    const storyManager = getStoryManager();
    storyManagerRef.current = storyManager;
    
    // Set up story callbacks — wires story consequences to game systems
    storyManager.setCallbacks({
      onDialogue: (lines, speaker) => {
        onDialogue?.(lines, speaker);
      },
      onHorrorChange: (newLevel, _delta) => {
        // Map horror level (0-10) to atmosphere presets
        let preset: AtmospherePreset = 'cozy';
        if (newLevel >= 8) preset = 'panic';
        else if (newLevel >= 6) preset = 'dread';
        else if (newLevel >= 4) preset = 'tense';
        else if (newLevel >= 2) preset = 'uneasy';
        atmosphereManager.setPreset(preset, 2000);
      },
      onUnlock: (lockId) => {
        // Unlock exits in the current room by marking them accessible
        console.log(`[Story] Unlocked: ${lockId}`);
        audioManager.playSound(SoundEffects.DOOR_UNLOCK);
        onUnlockExit?.(lockId);
        // Also remove any barrier collider that matches the lock id
        if (collisionSystem) {
          collisionSystem.removeProp(`lock_${lockId}`);
        }
      },
      onLock: (lockId) => {
        console.log(`[Story] Locked: ${lockId}`);
      },
      onSpawn: (entityId, position) => {
        console.log(`[Story] Spawn entity: ${entityId}`, position);
        // Future: dynamically create mesh/collider for the spawned entity
      },
      onDespawn: (entityId) => {
        console.log(`[Story] Despawn entity: ${entityId}`);
        // Remove the entity's collider if it exists
        if (collisionSystem) {
          collisionSystem.removeProp(entityId);
        }
      },
      onBeatComplete: (beatId) => {
        console.log(`[Story] Beat complete: ${beatId}`);
      },
      onEffect: (effectType, params) => {
        switch (effectType) {
          case 'screen_shake':
            effectsManager.shakeCamera(
              (params?.intensity as number) ?? 0.15,
              (params?.duration as number) ?? 500
            );
            break;
          case 'blood_splatter':
            const pos = params?.position as { x: number; y: number; z: number } | undefined;
            effectsManager.spawnBloodSplatter(
              new Vector3(pos?.x ?? 0, pos?.y ?? 1, pos?.z ?? 0)
            );
            break;
          case 'dramatic_zoom':
            effectsManager.zoomCamera(
              (params?.factor as number) ?? 0.6,
              (params?.duration as number) ?? 500,
              (params?.hold as number) ?? 1000
            );
            break;
          case 'atmosphere':
            // Atmosphere transitions from story triggers
            const preset = params?.preset as AtmospherePreset | undefined;
            if (preset) {
              atmosphereManager.setPreset(preset, (params?.duration as number) ?? 1000);
            }
            break;
          case 'atmosphere_pulse':
            // Temporary atmosphere spike
            const pulsePreset = params?.preset as AtmospherePreset | undefined;
            if (pulsePreset) {
              atmosphereManager.pulse(pulsePreset, (params?.duration as number) ?? 2000);
            }
            break;
        }
      },
      onSound: (soundId) => {
        audioManager.playSound(soundId);
      },
    });
    
    // Set character path for story (Carl = 'order', Paul = 'chaos')
    storyManager.setCharacterPath(playerCharacter === 'carl' ? 'order' : 'chaos');
    
    // Trigger scene enter for story beats
    storyManager.checkTrigger('scene_enter', { sceneId: currentRoom.id });
    
    // Lighting — PBR materials are energy-conserving and need higher
    // intensity than legacy StandardMaterial to avoid a dark scene.
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    ambient.intensity = 1.0;
    ambient.groundColor = new Color3(0.25, 0.2, 0.18);

    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.5), scene);
    sun.intensity = 1.2;
    sun.position = new Vector3(8, 12, 8);

    // Environment intensity helps PBR materials receive indirect illumination
    scene.environmentIntensity = 1.0;
    
    // Shadows
    const shadowGen = new ShadowGenerator(1024, sun);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 16;
    shadowGen.darkness = 0.4;
    
    // Create room (propMeshMap populated for pickup removal)
    // Room creation is async because it loads GLB models for props
    createRoom(scene, currentRoom, shadowGen, propMeshMap).catch(err => {
      console.error('Failed to create room:', err);
    });
    
    // Tap-to-move destination marker
    const destMarker = MeshBuilder.CreateDisc('tapDestination', { radius: 0.3, tessellation: 32 }, scene);
    destMarker.rotation.x = Math.PI / 2; // Lay flat
    destMarker.position.y = 0.05;
    destMarker.isVisible = false;
    const destMarkerMat = new StandardMaterial('destMarkerMat', scene);
    destMarkerMat.diffuseColor = new Color3(0.4, 0.8, 0.4);
    destMarkerMat.emissiveColor = new Color3(0.2, 0.5, 0.2);
    destMarkerMat.alpha = 0.6;
    destMarker.material = destMarkerMat;
    
    // Pulse animation for destination marker
    let markerPulse = 0;
    
    // Create characters using unified Character system
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
    
    // Game loop
    let lastTime = performance.now();
    let lastInteractionState: InteractionState | null = null;
    
    engine.runRenderLoop(() => {
      if (isPaused) {
        scene.render();
        return;
      }
      
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      
      const player = playerRef.current;
      const opponent = opponentRef.current;
      
      // Player movement with collision detection
      if (player && collisionSystemRef.current) {
        // Poll input from unified controller (keyboard/gesture/gamepad)
        const getInput = (window as any).__gameGetInput;
        const manualInput = getInput ? getInput() : { x: 0, z: 0 };
        const hasManualInput = manualInput.x !== 0 || manualInput.z !== 0;
        
        // Get tap-to-move input from navigator
        const navigator = playerNavigatorRef.current;
        let navInput = { x: 0, z: 0 };
        
        if (navigator) {
          // Manual input cancels tap-to-move
          if (hasManualInput && navigator.getMode() === 'moveTo') {
            navigator.idle();
            destMarker.isVisible = false;
          }
          
          // Update navigator with current player position
          navigator.setPosition(player.root.position.x, player.root.position.z);
          
          // Get navigator's movement if active
          if (navigator.getMode() === 'moveTo') {
            navigator.update(dt);
            // Convert navigator velocity to input direction
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
              
              // Show and update destination marker
              destMarker.isVisible = true;
              destMarker.position.x = state.targetX;
              destMarker.position.z = state.targetZ;
              
              // Pulse animation
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
        
        // Use manual input if present, otherwise use navigator input
        const input = hasManualInput ? manualInput : navInput;
        const speed = 4;
        
        if (input.x !== 0 || input.z !== 0) {
          const len = Math.sqrt(input.x * input.x + input.z * input.z);
          const nx = input.x / len;
          const nz = input.z / len;
          
          const fromX = player.root.position.x;
          const fromZ = player.root.position.z;
          let toX = fromX + nx * speed * dt;
          let toZ = fromZ + nz * speed * dt;
          
          // Check collision with props
          const moveResult = collisionSystemRef.current.checkMovement(
            fromX, fromZ, toX, toZ, 0.4  // 0.4 = character radius
          );
          
          const newX = moveResult.adjustedX;
          const newZ = moveResult.adjustedZ;
          
          player.setPosition(newX, 0, newZ);
          // Calculate rotation to face movement direction
          player.setTargetRotation(Math.atan2(-nx, -nz));
          
          onPlayerMove(newX, 0, newZ, player.currentRotation);
          
          // Check exits (with locked door support)
          for (const exit of currentRoom.exits) {
            const dx = newX - exit.position.x;
            const dz = newZ - exit.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < 1.2) {
              if (exit.locked) {
                // Check if player has the required key item
                if (exit.requiredItem && playerInventory.includes(exit.requiredItem)) {
                  // Unlock the exit, consume the key item, transition
                  audioManager.playSound(SoundEffects.DOOR_UNLOCK);
                  onUnlockExit?.(exit.id ?? exit.direction);
                  onDialogue?.([`Used ${exit.requiredItem.replace(/_/g, ' ')} to unlock the door.`], playerCharacter);
                  // Do not transition immediately -- let unlock feedback play.
                  // The next frame will see the exit as unlocked and transition.
                } else {
                  // Door is locked and player lacks the key
                  audioManager.playSound(SoundEffects.DOOR_LOCKED);
                  onLockedDoor?.(exit);
                  onDialogue?.(
                    exit.requiredItem
                      ? [`This door is locked. Looks like it needs a ${exit.requiredItem.replace(/_/g, ' ')}.`]
                      : ['This door is locked.'],
                    playerCharacter
                  );
                }
              } else {
                const opposite = { north: 'south', south: 'north', east: 'west', west: 'east' } as const;
                onRoomTransition(exit.targetRoom, opposite[exit.direction]);
              }
              break;
            }
          }
        }
        
        // Update interaction system
        if (interactionSystemRef.current) {
          const interactionState = interactionSystemRef.current.update(
            player.root.position.x,
            player.root.position.z
          );
          
          // Notify parent of interaction state changes
          if (onInteractionStateChange && 
              JSON.stringify(interactionState) !== JSON.stringify(lastInteractionState)) {
            lastInteractionState = interactionState;
            onInteractionStateChange(interactionState);
          }
        }
        
        // Update smooth rotation
        player.update(dt);
        
        // Camera follow player
        if (gameCameraRef.current) {
          gameCameraRef.current.setTarget(player.root.position.x, player.root.position.z);
        }
      }
      
      // Update opponent (AI controlled)
      if (opponent) {
        opponent.setPosition(opponentPosition.x, 0, opponentPosition.z);
        opponent.setTargetRotation(opponentRotation);
        opponent.update(dt);
      }
      
      // Update camera (smooth follow)
      if (gameCameraRef.current) {
        gameCameraRef.current.update();
      }
      
      // Update effects (particles, etc.)
      if (effectsManagerRef.current) {
        effectsManagerRef.current.update(dt);
      }
      
      // Update atmosphere (fog, lighting, ambient audio)
      if (atmosphereManagerRef.current) {
        atmosphereManagerRef.current.update(dt);
      }
      
      scene.render();
    });
    
    // Resize handling - update viewport size for responsive camera
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
          console.log(`Viewport changed to: ${newSize}`);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 50);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      collisionSystemRef.current?.clear();
      playerNavigatorRef.current?.dispose();
      effectsManagerRef.current?.dispose();
      atmosphereManagerRef.current?.dispose();
      clearTextureCache();
      engine.dispose();
    };
  }, [currentRoom.id]);



  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full outline-none touch-none"
    />
  );
};

// Create room geometry with PBR textures based on room type
// propMeshMap is populated with meshes keyed by itemDrop id (for pickup removal)
async function createRoom(
  scene: Scene,
  room: RoomConfig,
  shadowGen: ShadowGenerator,
  propMeshMap?: Map<string, AbstractMesh>
) {
  const root = new TransformNode('room', scene);

  // Resolve PBR textures for this room type
  const textures = getTexturesForRoom(room.id, room.name);

  // Extended ground plane (gives context, room doesn't float)
  const groundMat = new StandardMaterial('ground', scene);
  groundMat.diffuseColor = new Color3(0.15, 0.12, 0.1);
  groundMat.specularColor = new Color3(0, 0, 0);

  const groundExtent = 30;
  const ground = MeshBuilder.CreateGround('ground', {
    width: groundExtent,
    height: groundExtent
  }, scene);
  ground.material = groundMat;
  ground.position.y = -0.02;
  ground.receiveShadows = true;
  ground.parent = root;

  // Room floor -- PBR textured with flat-color fallback
  const floorFallbackMat = new StandardMaterial('floor_fallback', scene);
  floorFallbackMat.diffuseColor = new Color3(0.35, 0.25, 0.18);
  floorFallbackMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const floorPBR = createFloorMaterial(scene, textures.floor, room.width, room.height);

  const floor = MeshBuilder.CreateGround('floor', {
    width: room.width,
    height: room.height
  }, scene);
  floor.material = floorPBR ?? floorFallbackMat;
  floor.receiveShadows = true;
  floor.parent = root;

  // Floor border/rug
  const rugMat = new StandardMaterial('rug', scene);
  rugMat.diffuseColor = new Color3(0.4, 0.28, 0.2);
  const rug = MeshBuilder.CreateGround('rug', {
    width: room.width - 1.5,
    height: room.height - 1.5
  }, scene);
  rug.material = rugMat;
  rug.position.y = 0.01;
  rug.parent = root;

  // Walls -- PBR textured with flat-color fallback
  const wallFallbackMat = new StandardMaterial('wall_fallback', scene);
  wallFallbackMat.diffuseColor = new Color3(0.55, 0.45, 0.38);

  const wallH = 2;
  const exitDirs = room.exits.map(e => e.direction);

  const createWall = (dir: 'north' | 'south' | 'east' | 'west') => {
    const hasExit = exitDirs.includes(dir);
    const isHoriz = dir === 'north' || dir === 'south';
    const length = isHoriz ? room.width : room.height;
    const pos = isHoriz
      ? new Vector3(0, wallH/2, (dir === 'north' ? -1 : 1) * room.height/2)
      : new Vector3((dir === 'west' ? -1 : 1) * room.width/2, wallH/2, 0);

    if (hasExit) {
      const segLen = (length - 2) / 2;
      // For split walls with doorways, create segment-specific PBR material
      const segPBR = createWallMaterial(scene, textures.wall, segLen, wallH);
      const segMat = segPBR ?? wallFallbackMat;

      [-1, 1].forEach(side => {
        const wall = MeshBuilder.CreateBox(`wall_${dir}_${side}`, {
          width: isHoriz ? segLen : 0.2,
          height: wallH,
          depth: isHoriz ? 0.2 : segLen
        }, scene);
        wall.material = segMat;
        wall.position = pos.clone();
        if (isHoriz) wall.position.x = side * (segLen/2 + 1);
        else wall.position.z = side * (segLen/2 + 1);
        wall.parent = root;
        shadowGen.addShadowCaster(wall);
      });
    } else {
      // Full-length wall with PBR material
      const wallPBR = createWallMaterial(scene, textures.wall, length, wallH);
      const wallMat = wallPBR ?? wallFallbackMat;

      const wall = MeshBuilder.CreateBox(`wall_${dir}`, {
        width: isHoriz ? length : 0.2,
        height: wallH,
        depth: isHoriz ? 0.2 : length
      }, scene);
      wall.material = wallMat;
      wall.position = pos;
      wall.parent = root;
      shadowGen.addShadowCaster(wall);
    }
  };

  createWall('north');
  createWall('south');
  createWall('east');
  createWall('west');
  
  // Props - load GLB models when available, fall back to procedural geometry
  const propPromises = room.props.map(async (prop) => {
    const mesh = await createPropMeshAsync(scene, prop.type, prop.interactive, prop.itemDrop);
    if (mesh) {
      mesh.position.set(prop.position.x, 0, prop.position.z);
      mesh.rotation.y = prop.rotation;
      mesh.scaling.setAll(prop.scale);
      mesh.parent = root;
      // Add shadow casters — GLB props return a TransformNode wrapper
      // which doesn't have getBoundingInfo, so add child meshes instead
      if (mesh instanceof AbstractMesh) {
        shadowGen.addShadowCaster(mesh);
      } else if ('getChildMeshes' in mesh) {
        (mesh as TransformNode).getChildMeshes().forEach(child => {
          shadowGen.addShadowCaster(child);
          child.receiveShadows = true;
        });
      }
      // Track pickup-able prop meshes for removal
      if (prop.itemDrop && propMeshMap) {
        propMeshMap.set(prop.itemDrop, mesh);
      }
    }
  });
  await Promise.all(propPromises);
  
  // Exit markers -- locked exits are tinted red, unlocked exits are green
  room.exits.forEach(exit => {
    const isLocked = exit.locked === true;
    const marker = MeshBuilder.CreateBox(`exit_${exit.direction}`, {
      width: 1.5, height: 0.05, depth: 1.5
    }, scene);
    const markerMat = new StandardMaterial(`exitMat_${exit.direction}`, scene);
    if (isLocked) {
      markerMat.diffuseColor = new Color3(0.5, 0.15, 0.15);
      markerMat.emissiveColor = new Color3(0.2, 0.05, 0.05);
    } else {
      markerMat.diffuseColor = new Color3(0.3, 0.5, 0.3);
      markerMat.emissiveColor = new Color3(0.1, 0.15, 0.1);
    }
    markerMat.alpha = 0.5;
    marker.material = markerMat;
    marker.position.set(exit.position.x, 0.03, exit.position.z);
    marker.parent = root;

    // Add a small lock icon (vertical box) above locked exits
    if (isLocked) {
      const lockIcon = MeshBuilder.CreateBox(`lock_${exit.direction}`, {
        width: 0.25, height: 0.4, depth: 0.15
      }, scene);
      const lockMat = new StandardMaterial(`lockMat_${exit.direction}`, scene);
      lockMat.diffuseColor = new Color3(0.6, 0.4, 0.1);
      lockMat.emissiveColor = new Color3(0.15, 0.1, 0.02);
      lockIcon.material = lockMat;
      lockIcon.position.set(exit.position.x, 0.6, exit.position.z);
      lockIcon.parent = root;
    }
  });
  
  return root;
}

// Note: Props are now created via PropFactory from data definitions
// See src/data/props.json for prop definitions
// See src/systems/PropFactory.ts for the factory implementation

export default GameRenderer;
