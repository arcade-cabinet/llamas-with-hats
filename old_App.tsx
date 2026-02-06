import React, { useCallback } from 'react';
import './App.css';
import { BabylonScene } from './components/BabylonScene';
import { DialogueOverlay } from './components/DialogueOverlay';
import { HUD } from './components/HUD';
import { useGameState } from './hooks/useGameState';

const App: React.FC = () => {
    // Alias 'state' to 'gameState' if needed, or just use 'state'
    const { state, setState } = useGameState();

    const handleStart = useCallback(() => {
        setState(prev => ({ ...prev, isStarted: true }));
        // Initial horror/dialogue trigger could go here
    }, [setState]);

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

            <div className="hud-container">
                <HUD horrorLevel={state.horrorLevel} />
            </div>

            {!state.isStarted && (
                <div
                    className="start-menu-start-button"
                    onClick={handleStart}
                >
                    Start the Horror
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
