/**
 * Audio Hook
 * ==========
 * 
 * React hook for procedural audio playback using Tone.js.
 * 
 * ## Usage
 * 
 * ```tsx
 * function GameComponent() {
 *   const { playSound, playMusic, setVolume, isMuted, toggleMute, init } = useAudio();
 *   
 *   // Initialize on first user interaction
 *   const handleFirstClick = async () => {
 *     await init();
 *   };
 *   
 *   const handleClick = () => {
 *     playSound('ui_click');
 *   };
 *   
 *   useEffect(() => {
 *     playMusic('horror_ambient', { fadeIn: 2000 });
 *     return () => stopMusic({ fadeOut: 1000 });
 *   }, []);
 *   
 *   return (
 *     <button onClick={handleClick}>
 *       {isMuted ? 'Unmute' : 'Mute'}
 *     </button>
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  getAudioManager, 
  AudioManager, 
  SoundOptions, 
  MusicOptions,
  SoundEffects,
  MusicTracks 
} from '../systems/AudioManager';

export interface UseAudioReturn {
  // Initialization
  init: () => Promise<void>;
  isInitialized: boolean;
  
  // Sound effects
  playSound: (id: string, options?: SoundOptions) => void;
  stopAllSounds: () => void;
  
  // Music
  playMusic: (trackId: string, options?: MusicOptions) => void;
  stopMusic: (options?: { fadeOut?: number }) => void;
  
  // Volume
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  setMasterVolume: (volume: number) => void;
  setSFXVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  
  // Mute
  isMuted: boolean;
  toggleMute: () => void;
  
  // State
  isMusicPlaying: boolean;
  currentTrack: string | null;
}

/**
 * Hook for procedural audio playback
 */
export function useAudio(): UseAudioReturn {
  const audioRef = useRef<AudioManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(1);
  const [sfxVolume, setSFXVolumeState] = useState(1);
  const [musicVolume, setMusicVolumeState] = useState(1);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  
  // Get audio manager reference
  useEffect(() => {
    audioRef.current = getAudioManager();
    setIsInitialized(audioRef.current.isInitialized());
    
    // Sync state from manager
    setIsMuted(audioRef.current.isMuted());
    setMasterVolumeState(audioRef.current.getMasterVolume());
    setSFXVolumeState(audioRef.current.getSFXVolume());
    setMusicVolumeState(audioRef.current.getMusicVolume());
    
    return () => {
      // Don't dispose - singleton shared across components
    };
  }, []);
  
  // Initialize Tone.js (must be called after user interaction)
  const init = useCallback(async () => {
    if (audioRef.current) {
      await audioRef.current.init();
      setIsInitialized(true);
    }
  }, []);
  
  // Sound effects
  const playSound = useCallback((id: string, options?: SoundOptions) => {
    audioRef.current?.playSound(id, options);
  }, []);
  
  const stopAllSounds = useCallback(() => {
    audioRef.current?.stopAllSounds();
  }, []);
  
  // Music
  const playMusic = useCallback((trackId: string, options?: MusicOptions) => {
    audioRef.current?.playMusic(trackId, options);
    setIsMusicPlaying(true);
    setCurrentTrack(trackId);
  }, []);
  
  const stopMusic = useCallback((options?: { fadeOut?: number }) => {
    audioRef.current?.stopMusic(options);
    setIsMusicPlaying(false);
    setCurrentTrack(null);
  }, []);
  
  // Volume controls
  const setMasterVolume = useCallback((volume: number) => {
    audioRef.current?.setMasterVolume(volume);
    setMasterVolumeState(volume);
  }, []);
  
  const setSFXVolume = useCallback((volume: number) => {
    audioRef.current?.setSFXVolume(volume);
    setSFXVolumeState(volume);
  }, []);
  
  const setMusicVolume = useCallback((volume: number) => {
    audioRef.current?.setMusicVolume(volume);
    setMusicVolumeState(volume);
  }, []);
  
  // Mute
  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.isMuted()) {
        audioRef.current.unmute();
        setIsMuted(false);
      } else {
        audioRef.current.mute();
        setIsMuted(true);
      }
    }
  }, []);
  
  return {
    init,
    isInitialized,
    playSound,
    stopAllSounds,
    playMusic,
    stopMusic,
    masterVolume,
    sfxVolume,
    musicVolume,
    setMasterVolume,
    setSFXVolume,
    setMusicVolume,
    isMuted,
    toggleMute,
    isMusicPlaying,
    currentTrack,
  };
}

// Re-export constants for convenience
export { SoundEffects, MusicTracks };

/**
 * Play a UI sound effect (convenience function)
 * Can be called outside of React components
 */
export function playUISound(sound: 'click' | 'hover' | 'back' = 'click') {
  const audio = getAudioManager();
  const soundMap = {
    click: SoundEffects.UI_CLICK,
    hover: SoundEffects.UI_HOVER,
    back: SoundEffects.UI_BACK,
  };
  audio.playSound(soundMap[sound], { volume: 0.5 });
}
