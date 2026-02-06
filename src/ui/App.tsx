import React, { useCallback, useState } from 'react';
import { rng } from '../core/RandomManager';
import { SeedGenerator } from '../core/SeedGenerator';
import '../styles/App.css';
import { BabylonScene } from './BabylonScene';
import { DialogueOverlay } from './DialogueOverlay';
import { HUD } from './HUD';
import { useGameState } from './hooks/useGameState';

const App: React.FC = () => {
    // Alias 'state' to 'gameState' if needed, or just use 'state'
    const { state, setState } = useGameState();

    const [seed, setSeed] = useState(rng.seed || SeedGenerator.generate());

    const handleStart = useCallback(() => {
        rng.init(seed);
        setState(prev => ({ ...prev, isStarted: true }));
    }, [seed, setState]);

    const handleShuffle = () => {
        setSeed(SeedGenerator.generate());
    };

    const handleDialogueClick = () => {
        // Simple debug interaction
        if (state.isStarted) {
            // This logic usually handled by Scene/Dialogue manager, but kept for debug
            // setHorrorLevel(state.horrorLevel + 1);
        }
    };

    return (
        <div className="game-container">
            <BabylonScene />

            {state.isStarted && (
                <div className="hud-overlay">
                    <HUD horrorLevel={state.horrorLevel} currentGoal={state.currentGoal} />
                    {state.isDialogueActive && <DialogueOverlay active={state.isDialogueActive} text={state.currentDialogue?.text || ""} onClick={handleDialogueClick} />}
                </div>
            )}

            {!state.isStarted && (
                <div className="start-menu-container">
                    <h1 className="start-menu-title">
                        LLAMAS WITH HATS
                    </h1>

                    <div className="seed-container">
                        <input
                            className="seed-input"
                            value={seed}
                            onChange={(e) => setSeed(e.target.value)}
                            placeholder="Enter Seed"
                        />
                        <button className="shuffle-btn" onClick={handleShuffle} title="Random Seed">
                            🎲
                        </button>
                    </div>

                    <div
                        className="start-menu-start-button"
                        onClick={handleStart}
                    >
                        ENTER THE VOID
                    </div>
                </div>
            )}

            <DialogueOverlay
                active={state.isDialogueActive}
                text={state.currentDialogue?.text || ""}
                onClick={handleDialogueClick} // This might need to link to Next Dialogue logic
            />
        </div>
    );
};

export default App;
