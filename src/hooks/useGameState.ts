import { useState, useCallback } from 'react';
import { dialogues, DialoguePair } from '../data/dialogues';

export interface GameState {
  isStarted: boolean;
  isMuted: boolean;
  currentDialogueIndex: number;
  currentDialogue: DialoguePair | null;
  isDialogueActive: boolean;
  spawnedObjects: string[];
  removedObjects: string[];
  screenShake: boolean;
  bloodSplatter: boolean;
  dramaticZoom: boolean;
  horrorLevel: number; // 0-10, increases as game progresses
}

export const useGameState = () => {
  const [state, setState] = useState<GameState>({
    isStarted: false,
    isMuted: false,
    currentDialogueIndex: -1,
    currentDialogue: null,
    isDialogueActive: false,
    spawnedObjects: [],
    removedObjects: [],
    screenShake: false,
    bloodSplatter: false,
    dramaticZoom: false,
    horrorLevel: 0,
  });

  const startGame = useCallback(() => {
    setState(prev => ({ ...prev, isStarted: true }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const triggerNextDialogue = useCallback(() => {
    setState(prev => {
      const nextIndex = prev.currentDialogueIndex + 1;
      const dialogue = dialogues[nextIndex % dialogues.length];
      
      // Process action
      let newSpawned = [...prev.spawnedObjects];
      let newRemoved = [...prev.removedObjects];
      
      if (dialogue.action === 'spawn_object' && dialogue.objectType) {
        newSpawned.push(dialogue.objectType);
      }
      if (dialogue.action === 'remove_object' && dialogue.objectType) {
        newRemoved.push(dialogue.objectType);
      }

      return {
        ...prev,
        currentDialogueIndex: nextIndex,
        currentDialogue: dialogue,
        isDialogueActive: true,
        spawnedObjects: newSpawned,
        removedObjects: newRemoved,
        screenShake: dialogue.action === 'screen_shake',
        bloodSplatter: dialogue.action === 'blood_splatter',
        dramaticZoom: dialogue.action === 'dramatic_zoom',
        horrorLevel: Math.min(10, prev.horrorLevel + 1),
      };
    });

    // Reset effects after delay
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        screenShake: false,
        bloodSplatter: false,
        dramaticZoom: false,
      }));
    }, 1500);
  }, []);

  const dismissDialogue = useCallback(() => {
    setState(prev => ({ ...prev, isDialogueActive: false }));
  }, []);

  return {
    state,
    startGame,
    toggleMute,
    triggerNextDialogue,
    dismissDialogue,
  };
};
