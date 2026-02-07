/**
 * Stage Game Renderer
 * ===================
 * 
 * Renders the ENTIRE STAGE at once - all rooms visible in 3D space.
 * Player moves freely through connected rooms without transitions.
 * 
 * This replaces the old room-by-room GameRenderer.
 */

import React, { useEffect, useRef } from 'react';
import {
  Engine,
  Scene,
  Vector3,
  UniversalCamera,
  Color4
} from '@babylonjs/core';
import { CharacterType } from '../../types/game';
import { createCharacter, Character } from '../../systems/Character';
import { 
  renderStage, 
  setupStageLighting, 
  RenderedStage, 
  StageLayout 
} from '../../systems/StageRenderer';

// Import stage layout
import stageData from '../../data/stages/stage1/definition_v2.json';

interface StageGameRendererProps {
  playerCharacter: CharacterType;
  playerPosition: { x: number; y: number; z: number };
  playerRotation: number;
  opponentPosition: { x: number; y: number; z: number };
  opponentRotation: number;
  onPlayerMove: (x: number, y: number, z: number, rotation: number) => void;
  isPaused: boolean;
  cameraHeight?: number;
  cameraDistance?: number;
}

export const StageGameRenderer: React.FC<StageGameRendererProps> = ({
  playerCharacter,
  playerPosition,
  playerRotation,
  opponentPosition,
  opponentRotation,
  onPlayerMove,
  isPaused,
  cameraHeight = 12,
  cameraDistance = 10
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const playerRef = useRef<Character | null>(null);
  const opponentRef = useRef<Character | null>(null);
  const stageRef = useRef<RenderedStage | null>(null);
  const cameraRef = useRef<UniversalCamera | null>(null);
  
  // Initialize scene
  useEffect(() => {
    if (!canvasRef.current) return;
    
    console.log('StageGameRenderer: Initializing');
    
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
    const { shadowGenerator } = setupStageLighting(scene);
    
    // Render the entire stage
    const layout = stageData.layout as unknown as StageLayout;
    const stage = renderStage(scene, layout, shadowGenerator);
    stageRef.current = stage;
    
    console.log('Stage rendered with rooms:', Array.from(stage.rooms.keys()));
    
    // Camera - fixed isometric view of the whole stage
    const camera = new UniversalCamera(
      'stageCamera',
      new Vector3(0, cameraHeight, cameraDistance),
      scene
    );
    camera.setTarget(new Vector3(0, 0, 0));
    camera.fov = 0.8;
    camera.inputs.clear(); // No user control
    cameraRef.current = camera;
    
    // Create characters
    const opponentChar = playerCharacter === 'carl' ? 'paul' : 'carl';
    
    createCharacter({
      scene,
      type: playerCharacter,
      position: new Vector3(playerPosition.x, playerPosition.y, playerPosition.z),
      rotation: playerRotation,
      shadowGenerator,
      controller: 'player'
    }).then(character => {
      playerRef.current = character;
    });
    
    createCharacter({
      scene,
      type: opponentChar,
      position: new Vector3(opponentPosition.x, opponentPosition.y, opponentPosition.z),
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
      
      // Player movement
      if (player && stageRef.current) {
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
          const newY = stageRef.current.getGroundY(newX, newZ);
          
          // Check if new position is walkable
          if (stageRef.current.isWalkable(newX, newY, newZ)) {
            player.setPosition(newX, newY, newZ);
            player.setTargetRotation(Math.atan2(-nx, -nz));
            onPlayerMove(newX, newY, newZ, player.currentRotation);
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
      stageRef.current?.dispose();
      engine.dispose();
    };
  }, []);
  
  // Update opponent position when props change
  useEffect(() => {
    const opponent = opponentRef.current;
    if (opponent) {
      opponent.setPosition(opponentPosition.x, opponentPosition.y, opponentPosition.z);
      opponent.setTargetRotation(opponentRotation);
    }
  }, [opponentPosition.x, opponentPosition.y, opponentPosition.z, opponentRotation]);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full outline-none touch-none"
    />
  );
};

export default StageGameRenderer;
