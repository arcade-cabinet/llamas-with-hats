import {
    ArcRotateCamera,
    Color3,
    Color4,
    Engine,
    HavokPlugin,
    HemisphericLight,
    Scene,
    Vector3
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { useEffect, useRef } from 'react';
import { useGameState } from '../hooks/useGameState';
import { audioManager } from '../logic/AudioManager';
import { world } from '../logic/ECS';
import { gameEngine } from '../logic/GameEngine';
import { createApartment } from '../scenes/ApartmentScene';
import { createLlama } from './Llama';

import '@babylonjs/loaders'; // Enable GLTF loader

export const BabylonScene = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    // Fix: Destructure 'state' and alias to 'gameState'
    const { state: gameState } = useGameState();

    // Initial Setup
    useEffect(() => {
        if (!canvasRef.current) return;

        // Create Engine
        const engine = new Engine(canvasRef.current, true);
        engineRef.current = engine;

        // Create Scene
        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.05, 0.05, 0.05, 1);

        // Enable Physics
        HavokPhysics().then((havok) => {
            const gravity = new Vector3(0, -9.81, 0);
            const physicsPlugin = new HavokPlugin(true, havok);
            scene.enablePhysics(gravity, physicsPlugin);
        });

        // Camera
        const camera = new ArcRotateCamera(
            'camera',
            -Math.PI / 2,
            Math.PI / 2.5,
            8,
            new Vector3(0, 1.5, 0),
            scene
        );
        camera.attachControl(canvasRef.current, true);
        // Limit camera movement
        camera.lowerRadiusLimit = 5;
        camera.upperRadiusLimit = 12;
        camera.lowerBetaLimit = 0.1;
        camera.upperBetaLimit = Math.PI / 2 - 0.1;

        // Lights
        const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
        hemiLight.intensity = 0.6;
        hemiLight.diffuse = new Color3(1, 0.95, 0.9);
        hemiLight.groundColor = new Color3(0.1, 0.1, 0.2);

        // Initialize Game World - Async Asset Loading
        const loadLlamas = async () => {
            await createLlama({
                scene,
                name: 'Carl',
                position: new Vector3(-1.5, 0, 0),
                rotation: Math.PI / 4,
                isMainChar: true,
            });

            await createLlama({
                scene,
                name: 'Paul',
                position: new Vector3(1.5, 0, 0.5),
                rotation: -Math.PI / 4,
                isMainChar: true,
            });
        };
        loadLlamas();

        // Apartment content (floor, walls, props)
        createApartment({
            scene,
            spawnedObjects: gameState.spawnedObjects,
            removedObjects: gameState.removedObjects,
            horrorLevel: gameState.horrorLevel
        });

        // Initialize Audio Manager (First user interaction usually needed for web audio)
        const initAudio = () => {
            audioManager.initialize();
            canvasRef.current?.removeEventListener('click', initAudio);
        };
        canvasRef.current?.addEventListener('click', initAudio);

        // Initialize Game Engine
        gameEngine.setScene(scene);

        // Run render loop
        engine.runRenderLoop(() => {
            const deltaTime = engine.getDeltaTime();
            // Fix: remove 3rd argument
            gameEngine.update(deltaTime, gameState.horrorLevel);
            scene.render();
        });

        // Resize handler
        const handleResize = () => {
            engine.resize();
        };
        window.addEventListener('resize', handleResize);

        // Clean up
        return () => {
            window.removeEventListener('resize', handleResize);
            engine.dispose();
            audioManager.stop();
        };
    }, []); // Run once on mount

    // Watch for Horror Level changes to update environment (Visuals only, logic is in ECS)
    useEffect(() => {
        // Update audio based on horror level
        if (gameState.horrorLevel > 0) {
            audioManager.setHorrorLevel(gameState.horrorLevel);
        }
    }, [gameState.horrorLevel]);

    // Handle click interaction (Raycasting)
    useEffect(() => {
        const scene = gameEngine['_scene']; // Access scene safely if exposed or public
        if (!scene) return;

        const handleClick = (_evt: PointerEvent) => {
            if (scene) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit && pickResult.pickedMesh) {
                    // Check if mesh is interactive
                    // const entityId = pickResult.pickedMesh.name;
                    // gameEngine.handleInteraction(entityId); 
                }
            }
        };

        // Canvas event listener
        canvasRef.current?.addEventListener('pointerdown', handleClick);
        return () => {
            canvasRef.current?.removeEventListener('pointerdown', handleClick);
        };
    }, []);

    // Bridge React state to ECS entities
    useEffect(() => {
        const carl = world.where(e => e.id === 'carl').first;
        const paul = world.where(e => e.id === 'paul').first;

        if (carl) {
            carl.behavior = gameState.isDialogueActive ? 'talking' : (gameState.horrorLevel > 7 ? 'horror_react' : 'idle');
        }
        if (paul) {
            paul.behavior = gameState.isDialogueActive ? 'talking' : (gameState.horrorLevel > 7 ? 'horror_react' : 'idle');
        }
    }, [gameState.isDialogueActive, gameState.horrorLevel]);

    return (
        <canvas
            ref={canvasRef}
            className="game-canvas"
        />
    );
};
