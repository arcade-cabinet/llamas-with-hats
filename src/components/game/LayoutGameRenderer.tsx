/**
 * Layout Game Renderer
 * ====================
 *
 * Renders a complete stage using the LayoutGenerator and LayoutRenderer.
 * Supports multi-floor layouts, proper room connections, and story flow.
 *
 * Stage definition is received as a prop — this component has ZERO
 * knowledge of which stage it is rendering.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Engine,
  Scene,
  Vector3,
  UniversalCamera,
  Color4
} from '@babylonjs/core';
import { CharacterType } from '../../types/game';
import { createCharacter, Character } from '../../systems/Character';
import { generateLayout, validateLayout, GeneratedLayout, StageLayoutDefinition } from '../../systems/LayoutGenerator';
import { renderLayout, setupLayoutLighting, RenderedLayout } from '../../systems/LayoutRenderer';

interface LayoutGameRendererProps {
  /** Raw stage definition JSON — passed in by parent, never imported here */
  stageDefinition: Record<string, unknown>;
  playerCharacter: CharacterType;
  playerPosition: { x: number; y: number; z: number };
  playerRotation: number;
  opponentPosition: { x: number; y: number; z: number };
  opponentRotation: number;
  onPlayerMove: (x: number, y: number, z: number, rotation: number) => void;
  onRoomChange?: (roomId: string) => void;
  isPaused: boolean;
  seed?: string;
  cameraHeight?: number;
  cameraDistance?: number;
}

export const LayoutGameRenderer: React.FC<LayoutGameRendererProps> = ({
  stageDefinition,
  playerCharacter,
  playerPosition: _playerPosition,
  playerRotation,
  opponentPosition,
  opponentRotation,
  onPlayerMove,
  onRoomChange,
  isPaused,
  seed = 'default-seed',
  cameraHeight = 12,
  cameraDistance = 10
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const playerRef = useRef<Character | null>(null);
  const opponentRef = useRef<Character | null>(null);
  const layoutRef = useRef<RenderedLayout | null>(null);
  const cameraRef = useRef<UniversalCamera | null>(null);
  const generatedLayoutRef = useRef<GeneratedLayout | null>(null);

  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Initialize scene
  useEffect(() => {
    if (!canvasRef.current) return;


    const engine = new Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true
    });
    engineRef.current = engine;

    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.08, 0.06, 0.05, 1);

    // Setup lighting
    const { shadowGenerator } = setupLayoutLighting(scene);

    // Extract layout generation config from the stage definition
    const stageDef = stageDefinition.generation as unknown as StageLayoutDefinition;

    // Create a wrapper that matches StageLayoutDefinition
    const layoutDef: StageLayoutDefinition = {
      id: stageDefinition.id as string,
      name: stageDefinition.name as string,
      layoutArchetype: stageDef.layoutArchetype || 'apartment_interior',
      levels: stageDef.levels || [],
      connectionRules: stageDef.connectionRules || {
        type: 'branching',
        defaultConnectionType: 'wall_door',
        maxDeadEnds: 2,
        loopsAllowed: false,
        maxDistanceFromEntry: 5
      },
      entryScene: stageDef.entryScene || {
        roomId: 'living_room',
        spawnPoint: { x: 0, z: 2 }
      },
      exitScene: stageDef.exitScene || {
        roomId: 'exit'
      }
    };

    const generated = generateLayout(layoutDef, seed);
    generatedLayoutRef.current = generated;

    // Validate the layout
    const validation = validateLayout(generated);
    if (!validation.valid) {
      console.error('Layout validation failed:', validation.errors);
    } else {
    }

    // Render the layout
    const renderedLayout = renderLayout(scene, generated, shadowGenerator);
    layoutRef.current = renderedLayout;

    // Debug info
    setDebugInfo(`Rooms: ${generated.rooms.size}, Floors: ${generated.levels.length}`);

    // Camera - isometric view
    const camera = new UniversalCamera(
      'layoutCamera',
      new Vector3(0, cameraHeight, cameraDistance),
      scene
    );
    camera.setTarget(new Vector3(0, 0, 0));
    camera.fov = 0.8;
    camera.inputs.clear();
    cameraRef.current = camera;

    // Get entry room spawn point
    const entryRoom = generated.rooms.get(generated.entryRoomId);
    const spawnPos = entryRoom ? {
      x: entryRoom.worldPosition.x + (stageDef.entryScene?.spawnPoint?.x || 0),
      y: entryRoom.worldPosition.y,
      z: entryRoom.worldPosition.z + (stageDef.entryScene?.spawnPoint?.z || 2)
    } : { x: 0, y: 0, z: 2 };

    // Create characters
    const opponentChar = playerCharacter === 'carl' ? 'paul' : 'carl';

    createCharacter({
      scene,
      type: playerCharacter,
      position: new Vector3(spawnPos.x, spawnPos.y, spawnPos.z),
      rotation: playerRotation,
      shadowGenerator,
      controller: 'player'
    }).then(character => {
      playerRef.current = character;
      // Report initial position
      onPlayerMove(spawnPos.x, spawnPos.y, spawnPos.z, 0);
    });

    // Place opponent in the same room initially
    createCharacter({
      scene,
      type: opponentChar,
      position: new Vector3(spawnPos.x + 2, spawnPos.y, spawnPos.z),
      rotation: opponentRotation,
      shadowGenerator,
      controller: 'ai'
    }).then(character => {
      opponentRef.current = character;
    });

    // Game loop
    let lastTime = performance.now();

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
      const layout = layoutRef.current;

      // Player movement
      if (player && layout) {
        const getInput = (window as any).__gameGetInput;
        const input = getInput ? getInput() : { x: 0, z: 0 };
        const speed = 4;

        if (input.x !== 0 || input.z !== 0) {
          const len = Math.sqrt(input.x * input.x + input.z * input.z);
          const nx = input.x / len;
          const nz = input.z / len;

          let newX = player.root.position.x + nx * speed * dt;
          let newZ = player.root.position.z + nz * speed * dt;

          // Get ground Y at new position (handles stairs)
          const newY = layout.getGroundY(newX, newZ);

          // Check if new position is walkable
          if (layout.isWalkable(newX, newZ)) {
            player.setPosition(newX, newY, newZ);
            player.setTargetRotation(Math.atan2(-nx, -nz));
            onPlayerMove(newX, newY, newZ, player.currentRotation);

            // Check which room player is in
            const room = layout.getRoomAt(newX, newZ);
            if (room && room.id !== currentRoom) {
              setCurrentRoom(room.id);
              onRoomChange?.(room.id);

              // Check for story beats
              const genRoom = generatedLayoutRef.current?.rooms.get(room.id);
              if (genRoom?.storyBeats.length) {
              }
            }
          }
        }

        // Update smooth rotation
        player.update(dt);

        // Camera follows player
        if (cameraRef.current) {
          const targetPos = new Vector3(
            player.root.position.x,
            player.root.position.y + cameraHeight,
            player.root.position.z + cameraDistance
          );
          cameraRef.current.position = Vector3.Lerp(
            cameraRef.current.position,
            targetPos,
            0.05
          );
          cameraRef.current.setTarget(new Vector3(
            player.root.position.x,
            player.root.position.y + 0.5,
            player.root.position.z
          ));
        }
      }

      // Update opponent
      if (opponent) {
        opponent.setPosition(opponentPosition.x, opponentPosition.y, opponentPosition.z);
        opponent.setTargetRotation(opponentRotation);
        opponent.update(dt);
      }

      scene.render();
    });

    // Resize handling
    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      layoutRef.current?.dispose();
      engine.dispose();
    };
  }, [stageDefinition, seed]);

  // Update opponent position when props change
  useEffect(() => {
    const opponent = opponentRef.current;
    if (opponent) {
      opponent.setPosition(opponentPosition.x, opponentPosition.y, opponentPosition.z);
      opponent.setTargetRotation(opponentRotation);
    }
  }, [opponentPosition.x, opponentPosition.y, opponentPosition.z, opponentRotation]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full outline-none touch-none"
      />

      {/* Debug overlay */}
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs p-2 rounded font-mono">
        <div>{debugInfo}</div>
        <div>Room: {currentRoom || 'none'}</div>
      </div>
    </div>
  );
};

export default LayoutGameRenderer;
