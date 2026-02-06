import { Color3, Engine, FreeCamera, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import React, { useEffect, useRef } from 'react';
import { DialogueOverlay } from './components/DialogueOverlay';
import { HUD } from './components/HUD';
import { useGameState } from './hooks/useGameState';
import { gameEngine } from './logic/GameEngine';
import { spawnApartmentProps } from './scenes/Props';

const App: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { state, setHorrorLevel } = useGameState();

    useEffect(() => {
        if (!canvasRef.current) return;

        const engine = new Engine(canvasRef.current, true);
        const scene = new Scene(engine);

        // Setup Scene
        const camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene);
        camera.setTarget(Vector3.Zero());
        // camera.attachControl(canvasRef.current, true); // Disable control for gameplay?

        const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        gameEngine.setScene(scene);

        // Spawn Llama (Minimal representation)
        const llama = MeshBuilder.CreateBox("carl", { height: 2 }, scene);
        llama.position.y = 1;
        const mat = new StandardMaterial("carlMat", scene);
        mat.diffuseColor = Color3.Red();
        llama.material = mat;

        gameEngine.spawnEntity({
            id: 'carl',
            type: 'carl',
            mesh: llama,
            position: llama.position,
            behavior: 'idle'
        });

        // Spawn Environment
        spawnApartmentProps(scene, state.horrorLevel);

        engine.runRenderLoop(() => {
            gameEngine.update(engine.getDeltaTime(), state.horrorLevel);
            scene.render();
        });

        const resize = () => engine.resize();
        window.addEventListener('resize', resize);

        return () => {
            window.removeEventListener('resize', resize);
            engine.dispose();
        };
    }, []); // Run once on mount

    const handleDialogueClick = () => {
        // Simple logic to test interaction
        setHorrorLevel(state.horrorLevel + 1);
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', outline: 'none' }} />
            <HUD horrorLevel={state.horrorLevel} />

            {/* Start Button / Overlay Mockup */}
            {!state.isStarted && (
                <div
                    className="start-menu-start-button"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '20px',
                        background: 'red',
                        color: 'white',
                        cursor: 'pointer'
                    }}
                    onClick={() => handleDialogueClick()} // Reuse for now
                >
                    Start the Horror
                </div>
            )}

            <DialogueOverlay
                active={true} // Forcing active for test
                text="Carl! There is a dead human in our house!"
                onClick={handleDialogueClick}
            />
        </div>
    );
};

export default App;
