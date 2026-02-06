import { useCallback, useEffect, useState } from 'react';
import { persistenceManager } from '../../core/PersistenceManager';

export interface GameState {
    isStarted: boolean;
    horrorLevel: number;
    currentDialogueIndex: number;
    currentDialogue: any | null;
    isDialogueActive: boolean;
    spawnedObjects: any[];
    removedObjects: string[];
    // Stats
    hunger: number;
    // Visual effects
    screenShake: boolean;
    bloodSplatter: boolean;
    dramaticZoom: boolean;
    changeSky: boolean;
    llamaReaction: boolean;
}

export const useGameState = () => {
    const [state, setState] = useState<GameState>({
        isStarted: false,
        horrorLevel: 0,
        currentDialogueIndex: -1,
        currentDialogue: null,
        isDialogueActive: false,
        spawnedObjects: [],
        removedObjects: [],
        hunger: 0,
        screenShake: false,
        bloodSplatter: false,
        dramaticZoom: false,
        changeSky: false,
        llamaReaction: false,
    });

    useEffect(() => {
        const saved = persistenceManager.load();
        if (saved && saved.gameState) {
            setState(prev => ({
                ...prev,
                ...saved.gameState
            }));
        }
    }, []);

    const setHorrorLevel = useCallback((level: number) => {
        setState(prev => {
            const next = { ...prev, horrorLevel: level };
            persistenceManager.save(next);
            return next;
        });
    }, []);

    // ... other setters would go here for a full implementation, 
    // but for now we focus on what's needed for the engine integration.

    return {
        state,
        setHorrorLevel,
        setState // Expose setter for flexibility during restoration
    };
};
