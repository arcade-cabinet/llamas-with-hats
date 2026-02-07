/**
 * Story Hook
 * ==========
 * 
 * React hook for story progression and trigger handling.
 * 
 * ## Usage
 * 
 * ```tsx
 * function GameScene() {
 *   const { 
 *     checkTrigger, 
 *     horrorLevel, 
 *     completedBeats,
 *     isCompleted 
 *   } = useStory({
 *     onDialogue: (lines, speaker) => setDialogue({ lines, speaker }),
 *     onHorrorChange: (level) => setHorrorLevel(level),
 *   });
 *   
 *   // Check triggers on scene enter
 *   useEffect(() => {
 *     checkTrigger('scene_enter', { sceneId: currentScene.id });
 *   }, [currentScene]);
 *   
 *   return <div>Horror Level: {horrorLevel}</div>;
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  getStoryManager, 
  StoryManager, 
  StoryCallbacks,
  TriggerType,
  TriggerParams,
  StoryState 
} from '../systems/StoryManager';
import { CharacterPath } from '../systems/StageDefinition';

export interface UseStoryOptions {
  onDialogue?: (lines: string[], speaker: 'carl' | 'paul') => void;
  onHorrorChange?: (newLevel: number, delta: number) => void;
  onUnlock?: (lockId: string) => void;
  onLock?: (lockId: string) => void;
  onSpawn?: (entityId: string, position?: { x: number; z: number }) => void;
  onDespawn?: (entityId: string) => void;
  onSound?: (soundId: string) => void;
  onEffect?: (effectType: string, params?: Record<string, unknown>) => void;
  onBeatComplete?: (beatId: string) => void;
}

export interface UseStoryReturn {
  // Trigger checking
  checkTrigger: (type: TriggerType, params: TriggerParams) => void;
  
  // Manual activation
  activateBeat: (beatId: string) => void;
  
  // State
  horrorLevel: number;
  currentBeat: string | null;
  completedBeats: string[];
  isCompleted: (beatId: string) => boolean;
  
  // Character path
  characterPath: CharacterPath;
  setCharacterPath: (path: CharacterPath) => void;
  
  // Stage loading
  loadStage: (stageId: string) => Promise<void>;
  
  // Save/Load
  getState: () => StoryState;
  loadState: (state: StoryState) => void;
  
  // Reset
  reset: () => void;
}

/**
 * Hook for story progression
 */
export function useStory(options: UseStoryOptions = {}): UseStoryReturn {
  const storyRef = useRef<StoryManager | null>(null);
  const [horrorLevel, setHorrorLevel] = useState(0);
  const [currentBeat, setCurrentBeat] = useState<string | null>(null);
  const [completedBeats, setCompletedBeats] = useState<string[]>([]);
  const [characterPath, setCharacterPathState] = useState<CharacterPath>('order');
  
  // Initialize story manager
  useEffect(() => {
    storyRef.current = getStoryManager();
    
    // Set up callbacks
    const callbacks: StoryCallbacks = {
      onDialogue: options.onDialogue,
      onHorrorChange: (level, delta) => {
        setHorrorLevel(level);
        options.onHorrorChange?.(level, delta);
      },
      onUnlock: options.onUnlock,
      onLock: options.onLock,
      onSpawn: options.onSpawn,
      onDespawn: options.onDespawn,
      onSound: options.onSound,
      onEffect: options.onEffect,
      onBeatComplete: (beatId) => {
        setCompletedBeats(prev => [...prev, beatId]);
        setCurrentBeat(storyRef.current?.getCurrentBeat() ?? null);
        options.onBeatComplete?.(beatId);
      },
    };
    
    storyRef.current.setCallbacks(callbacks);
    
    // Sync initial state
    setHorrorLevel(storyRef.current.getHorrorLevel());
    setCurrentBeat(storyRef.current.getCurrentBeat());
    setCompletedBeats(storyRef.current.getCompletedBeats());
    
    return () => {
      // Don't dispose - singleton shared across components
    };
  }, [
    options.onDialogue,
    options.onHorrorChange,
    options.onUnlock,
    options.onLock,
    options.onSpawn,
    options.onDespawn,
    options.onSound,
    options.onEffect,
    options.onBeatComplete,
  ]);
  
  const checkTrigger = useCallback((type: TriggerType, params: TriggerParams) => {
    storyRef.current?.checkTrigger(type, params);
  }, []);
  
  const activateBeat = useCallback((beatId: string) => {
    storyRef.current?.activateBeat(beatId);
  }, []);
  
  const isCompleted = useCallback((beatId: string) => {
    return storyRef.current?.isCompleted(beatId) ?? false;
  }, []);
  
  const setCharacterPath = useCallback((path: CharacterPath) => {
    storyRef.current?.setCharacterPath(path);
    setCharacterPathState(path);
  }, []);
  
  const loadStage = useCallback(async (stageId: string) => {
    await storyRef.current?.loadStage(stageId);
    setHorrorLevel(storyRef.current?.getHorrorLevel() ?? 0);
    setCurrentBeat(storyRef.current?.getCurrentBeat() ?? null);
    setCompletedBeats(storyRef.current?.getCompletedBeats() ?? []);
  }, []);
  
  const getState = useCallback(() => {
    return storyRef.current?.getState() ?? {
      completedBeats: [],
      currentBeat: null,
      horrorLevel: 0,
      characterPath: 'order' as CharacterPath,
    };
  }, []);
  
  const loadState = useCallback((state: StoryState) => {
    storyRef.current?.loadState(state);
    setHorrorLevel(state.horrorLevel);
    setCurrentBeat(state.currentBeat);
    setCompletedBeats(state.completedBeats);
    setCharacterPathState(state.characterPath);
  }, []);
  
  const reset = useCallback(() => {
    storyRef.current?.reset();
    setHorrorLevel(0);
    setCurrentBeat(null);
    setCompletedBeats([]);
  }, []);
  
  return {
    checkTrigger,
    activateBeat,
    horrorLevel,
    currentBeat,
    completedBeats,
    isCompleted,
    characterPath,
    setCharacterPath,
    loadStage,
    getState,
    loadState,
    reset,
  };
}

// Re-export types
export type { TriggerType, TriggerParams, StoryState };
