/**
 * Audio Manager - Procedural Audio with Tone.js
 * ==============================================
 * 
 * Whimsical dark comedy audio system using procedural synthesis.
 * No sample files needed - everything is generated in real-time.
 * 
 * ## Sound Design Philosophy
 * 
 * The audio matches the game's tone: unsettling yet comedic.
 * - Footsteps: Slightly off-rhythm, cartoonish
 * - Horror sounds: Over-the-top, almost theatrical
 * - UI: Satisfying clicks and boops
 * - Ambient: Creepy but with a hint of absurdity
 * 
 * ## Usage
 * 
 * ```ts
 * const audio = getAudioManager();
 * 
 * // Must be called after user interaction (browser policy)
 * await audio.init();
 * 
 * // Play procedural sounds
 * audio.playSound('footstep_wood');
 * audio.playSound('scream');
 * audio.playSound('blood_splatter');
 * 
 * // Background music/drone
 * audio.playMusic('horror_ambient');
 * audio.stopMusic();
 * ```
 */

import * as Tone from 'tone';

export interface SoundOptions {
  volume?: number;  // 0-1, default 1
  pitch?: number;   // 0.5-2, default 1 (multiplier)
}

export interface MusicOptions {
  volume?: number;
  fadeIn?: number;
}

export interface AudioManager {
  // Initialization (required before playing)
  init(): Promise<void>;
  isInitialized(): boolean;
  
  // Sound effects
  playSound(id: string, options?: SoundOptions): void;
  stopAllSounds(): void;
  
  // Music/ambient
  playMusic(trackId: string, options?: MusicOptions): void;
  stopMusic(options?: { fadeOut?: number }): void;
  
  // Volume controls
  setMasterVolume(volume: number): void;
  setSFXVolume(volume: number): void;
  setMusicVolume(volume: number): void;
  getMasterVolume(): number;
  getSFXVolume(): number;
  getMusicVolume(): number;
  
  // Mute
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  
  // State
  isMusicPlaying(): boolean;
  getCurrentMusicTrack(): string | null;
  
  // Cleanup
  dispose(): void;
}

// Sound effect IDs
export const SoundEffects = {
  // UI
  UI_CLICK: 'ui_click',
  UI_HOVER: 'ui_hover',
  UI_BACK: 'ui_back',
  
  // Movement
  FOOTSTEP_WOOD: 'footstep_wood',
  FOOTSTEP_CARPET: 'footstep_carpet',
  FOOTSTEP_STONE: 'footstep_stone',
  
  // Interactions
  DOOR_OPEN: 'door_open',
  DOOR_CLOSE: 'door_close',
  DOOR_LOCKED: 'door_locked',
  ITEM_PICKUP: 'item_pickup',
  
  // Horror
  SCREAM: 'scream',
  BLOOD_SPLATTER: 'blood_splatter',
  HEARTBEAT: 'heartbeat',
  WHISPER: 'whisper',
  
  // Ambient
  CREAK: 'creak',
  DRIP: 'drip',
  WIND: 'wind',
  
  // Characters
  CARL_HMM: 'carl_hmm',
  PAUL_LAUGH: 'paul_laugh',
} as const;

// Music track IDs
export const MusicTracks = {
  MENU: 'menu_theme',
  APARTMENT_CALM: 'apartment_calm',
  APARTMENT_TENSE: 'apartment_tense',
  HORROR_AMBIENT: 'horror_ambient',
  CHASE: 'chase_theme',
} as const;

/**
 * Create procedural audio manager using Tone.js
 */
export function createAudioManager(): AudioManager {
  let initialized = false;
  let muted = false;
  let masterVolume = 1;
  let sfxVolume = 1;
  let musicVolume = 1;
  
  // Master output
  let masterGain: Tone.Gain | null = null;
  let sfxGain: Tone.Gain | null = null;
  let musicGain: Tone.Gain | null = null;
  
  // Music state
  let currentMusicTrack: string | null = null;
  let musicPlayers: Tone.ToneAudioNode[] = [];
  let musicLoop: number | null = null;
  
  // Reusable synths for efficiency
  let noiseSynth: Tone.NoiseSynth | null = null;
  let membraneSynth: Tone.MembraneSynth | null = null;
  let metalSynth: Tone.MetalSynth | null = null;
  let pluckSynth: Tone.PluckSynth | null = null;
  let fmSynth: Tone.FMSynth | null = null;
  let amSynth: Tone.AMSynth | null = null;
  
  // Effects
  let reverb: Tone.Reverb | null = null;
  let delay: Tone.FeedbackDelay | null = null;
  let distortion: Tone.Distortion | null = null;
  let filter: Tone.Filter | null = null;
  
  /**
   * Initialize Tone.js context and create instruments
   */
  async function initAudio(): Promise<void> {
    if (initialized) return;
    
    await Tone.start();
    
    // Create gain structure
    masterGain = new Tone.Gain(masterVolume).toDestination();
    sfxGain = new Tone.Gain(sfxVolume).connect(masterGain);
    musicGain = new Tone.Gain(musicVolume).connect(masterGain);
    
    // Create effects
    reverb = new Tone.Reverb({ decay: 2, wet: 0.3 }).connect(sfxGain);
    delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.15 }).connect(sfxGain);
    distortion = new Tone.Distortion({ distortion: 0.4, wet: 0.2 }).connect(sfxGain);
    filter = new Tone.Filter({ frequency: 2000, type: 'lowpass' }).connect(sfxGain);
    
    // Create synths
    noiseSynth = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
    }).connect(filter);
    
    membraneSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 }
    }).connect(sfxGain);
    
    metalSynth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.4, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).connect(reverb);
    
    pluckSynth = new Tone.PluckSynth({
      attackNoise: 1,
      dampening: 4000,
      resonance: 0.9
    }).connect(delay);
    
    fmSynth = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 10,
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 }
    }).connect(reverb);
    
    amSynth = new Tone.AMSynth({
      harmonicity: 2,
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 }
    }).connect(musicGain);
    
    initialized = true;
  }
  
  /**
   * Play procedural sound effect
   */
  function playSoundEffect(id: string, options: SoundOptions = {}): void {
    if (!initialized || muted) return;
    
    const { volume = 1, pitch = 1 } = options;
    
    const now = Tone.now();
    
    switch (id) {
      // ─────────────────────────────────────────────────────────────────────
      // FOOTSTEPS - Slightly cartoonish, varied
      // ─────────────────────────────────────────────────────────────────────
      case SoundEffects.FOOTSTEP_WOOD: {
        const freq = 100 + Math.random() * 50;
        membraneSynth?.triggerAttackRelease(freq * pitch, '32n', now, 0.3 * volume);
        // Add wood knock
        const knock = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
        }).connect(sfxGain!);
        knock.triggerAttackRelease(800 * pitch, '64n', now, 0.2 * volume);
        setTimeout(() => knock.dispose(), 200);
        break;
      }
      
      case SoundEffects.FOOTSTEP_CARPET: {
        noiseSynth!.noise.type = 'brown';
        noiseSynth?.triggerAttackRelease('32n', now, 0.15 * volume);
        break;
      }
      
      case SoundEffects.FOOTSTEP_STONE: {
        const freq = 60 + Math.random() * 30;
        membraneSynth?.triggerAttackRelease(freq * pitch, '16n', now, 0.4 * volume);
        metalSynth?.triggerAttackRelease('32n', now, 0.1 * volume);
        break;
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // DOORS - Creaky and dramatic
      // ─────────────────────────────────────────────────────────────────────
      case SoundEffects.DOOR_OPEN: {
        // Creaky sweep up
        const creak = new Tone.Synth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.1, decay: 0.3, sustain: 0.1, release: 0.2 }
        }).connect(distortion!);
        creak.frequency.setValueAtTime(100, now);
        creak.frequency.exponentialRampToValueAtTime(400 * pitch, now + 0.4);
        creak.triggerAttackRelease('4n', now, 0.2 * volume);
        setTimeout(() => creak.dispose(), 1000);
        // Thunk
        membraneSynth?.triggerAttackRelease(80, '16n', now + 0.3, 0.3 * volume);
        break;
      }
      
      case SoundEffects.DOOR_CLOSE: {
        // Heavy thud
        membraneSynth?.triggerAttackRelease(50 * pitch, '8n', now, 0.5 * volume);
        // Latch click
        metalSynth?.triggerAttackRelease('32n', now + 0.1, 0.2 * volume);
        break;
      }
      
      case SoundEffects.DOOR_LOCKED: {
        // Frustrated rattle
        for (let i = 0; i < 3; i++) {
          metalSynth?.triggerAttackRelease('32n', now + i * 0.08, 0.3 * volume);
        }
        // Denied tone
        fmSynth?.triggerAttackRelease('C3', '8n', now + 0.3, 0.2 * volume);
        break;
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // ITEMS - Satisfying pickups
      // ─────────────────────────────────────────────────────────────────────
      case SoundEffects.ITEM_PICKUP: {
        // Ascending sparkle
        const notes = ['C5', 'E5', 'G5', 'C6'];
        notes.forEach((note, i) => {
          pluckSynth?.triggerAttack(note, now + i * 0.05);
        });
        break;
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // HORROR - Over-the-top theatrical
      // ─────────────────────────────────────────────────────────────────────
      case SoundEffects.SCREAM: {
        // Descending scream - comedically dramatic
        const scream = new Tone.Synth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5 }
        }).connect(reverb!);
        scream.frequency.setValueAtTime(800 * pitch, now);
        scream.frequency.exponentialRampToValueAtTime(200, now + 0.8);
        scream.triggerAttackRelease('1n', now, 0.4 * volume);
        
        // Add wobbly vibrato for comedic effect
        const lfo = new Tone.LFO({ frequency: 15, min: 0.9, max: 1.1 }).start();
        lfo.connect(scream.frequency);
        
        setTimeout(() => { scream.dispose(); lfo.dispose(); }, 2000);
        break;
      }
      
      case SoundEffects.BLOOD_SPLATTER: {
        // Wet splat
        noiseSynth!.noise.type = 'pink';
        noiseSynth?.triggerAttackRelease('8n', now, 0.5 * volume);
        
        // Multiple plops
        for (let i = 0; i < 5; i++) {
          const freq = 100 + Math.random() * 200;
          const time = now + Math.random() * 0.3;
          membraneSynth?.triggerAttackRelease(freq, '32n', time, 0.2 * volume);
        }
        break;
      }
      
      case SoundEffects.HEARTBEAT: {
        // Lub-dub
        membraneSynth?.triggerAttackRelease(40 * pitch, '16n', now, 0.6 * volume);
        membraneSynth?.triggerAttackRelease(35 * pitch, '16n', now + 0.15, 0.4 * volume);
        break;
      }
      
      case SoundEffects.WHISPER: {
        // Breathy noise with filter sweep
        const whisper = new Tone.NoiseSynth({
          noise: { type: 'brown' },
          envelope: { attack: 0.2, decay: 0.5, sustain: 0.3, release: 0.5 }
        });
        const whisperFilter = new Tone.Filter({ frequency: 1000, type: 'bandpass', Q: 2 }).connect(reverb!);
        whisper.connect(whisperFilter);
        whisperFilter.frequency.setValueAtTime(500, now);
        whisperFilter.frequency.linearRampToValueAtTime(2000, now + 0.5);
        whisperFilter.frequency.linearRampToValueAtTime(800, now + 1);
        whisper.triggerAttackRelease('1n', now, 0.3 * volume);
        setTimeout(() => { whisper.dispose(); whisperFilter.dispose(); }, 2000);
        break;
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // AMBIENT - Creepy atmosphere
      // ─────────────────────────────────────────────────────────────────────
      case SoundEffects.CREAK: {
        const creak = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.2, decay: 0.5, sustain: 0.2, release: 0.3 }
        }).connect(distortion!);
        creak.frequency.setValueAtTime(200 + Math.random() * 100, now);
        creak.frequency.linearRampToValueAtTime(300 + Math.random() * 200, now + 0.3);
        creak.frequency.linearRampToValueAtTime(150, now + 0.6);
        creak.triggerAttackRelease('2n', now, 0.15 * volume);
        setTimeout(() => creak.dispose(), 1500);
        break;
      }
      
      case SoundEffects.DRIP: {
        // Water drop
        const drip = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 }
        }).connect(delay!);
        drip.frequency.setValueAtTime(2000 * pitch, now);
        drip.frequency.exponentialRampToValueAtTime(500, now + 0.1);
        drip.triggerAttackRelease('16n', now, 0.3 * volume);
        setTimeout(() => drip.dispose(), 500);
        break;
      }
      
      case SoundEffects.WIND: {
        noiseSynth!.noise.type = 'pink';
        const windFilter = new Tone.Filter({ frequency: 400, type: 'lowpass' }).connect(sfxGain!);
        noiseSynth?.disconnect();
        noiseSynth?.connect(windFilter);
        windFilter.frequency.setValueAtTime(200, now);
        windFilter.frequency.linearRampToValueAtTime(600, now + 1);
        windFilter.frequency.linearRampToValueAtTime(300, now + 2);
        noiseSynth?.triggerAttackRelease('2n', now, 0.2 * volume);
        setTimeout(() => {
          noiseSynth?.disconnect();
          noiseSynth?.connect(filter!);
          windFilter.dispose();
        }, 3000);
        break;
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // CHARACTER SOUNDS - Distinctive voices
      // ─────────────────────────────────────────────────────────────────────
      case SoundEffects.CARL_HMM: {
        // Carl's thoughtful "hmm" - lower, contemplative
        const hmm = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.3 }
        }).connect(reverb!);
        hmm.frequency.setValueAtTime(150, now);
        hmm.frequency.linearRampToValueAtTime(130, now + 0.2);
        hmm.frequency.linearRampToValueAtTime(160, now + 0.4);
        hmm.triggerAttackRelease('2n', now, 0.3 * volume);
        setTimeout(() => hmm.dispose(), 1500);
        break;
      }
      
      case SoundEffects.PAUL_LAUGH: {
        // Paul's unsettling giggle - higher, erratic
        const laugh = new Tone.Synth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
        }).connect(reverb!);
        
        const laughNotes = [400, 500, 450, 550, 400, 600];
        laughNotes.forEach((freq, i) => {
          laugh.triggerAttackRelease(freq * pitch, '16n', now + i * 0.1, 0.2 * volume);
        });
        setTimeout(() => laugh.dispose(), 1500);
        break;
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // UI SOUNDS - Clean and satisfying
      // ─────────────────────────────────────────────────────────────────────
      case SoundEffects.UI_CLICK: {
        pluckSynth?.triggerAttack('G5', now);
        break;
      }
      
      case SoundEffects.UI_HOVER: {
        const hover = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.05, sustain: 0, release: 0.05 }
        }).connect(sfxGain!);
        hover.triggerAttackRelease('C6', '64n', now, 0.1 * volume);
        setTimeout(() => hover.dispose(), 200);
        break;
      }
      
      case SoundEffects.UI_BACK: {
        pluckSynth?.triggerAttack('C4', now);
        break;
      }
      
      default:
        console.warn(`Unknown sound effect: ${id}`);
    }
  }
  
  /**
   * Start ambient music/drone
   */
  function startMusic(trackId: string, options: MusicOptions = {}): void {
    if (!initialized) return;
    
    stopMusicInternal();
    currentMusicTrack = trackId;
    
    const { volume = 1, fadeIn = 1000 } = options;
    const targetVol = volume * musicVolume * masterVolume;
    
    musicGain!.gain.setValueAtTime(0, Tone.now());
    musicGain!.gain.linearRampToValueAtTime(muted ? 0 : targetVol, Tone.now() + fadeIn / 1000);
    
    switch (trackId) {
      case MusicTracks.HORROR_AMBIENT:
      case MusicTracks.APARTMENT_TENSE: {
        // Creepy drone with occasional dissonance
        const drone1 = new Tone.Oscillator({ type: 'sine', frequency: 55 }).connect(musicGain!);
        const drone2 = new Tone.Oscillator({ type: 'triangle', frequency: 82.5 }).connect(musicGain!);
        const lfo = new Tone.LFO({ frequency: 0.1, min: 50, max: 60 }).connect(drone1.frequency);
        
        drone1.volume.value = -12;
        drone2.volume.value = -18;
        
        drone1.start();
        drone2.start();
        lfo.start();
        
        musicPlayers.push(drone1, drone2, lfo);
        
        // Random creepy accents
        musicLoop = window.setInterval(() => {
          if (Math.random() > 0.7) {
            playSoundEffect(SoundEffects.CREAK, { volume: 0.1 });
          }
          if (Math.random() > 0.9) {
            playSoundEffect(SoundEffects.WHISPER, { volume: 0.05 });
          }
        }, 5000);
        break;
      }
      
      case MusicTracks.APARTMENT_CALM:
      case MusicTracks.MENU: {
        // Gentle, slightly unsettling pads
        const pad = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 }
        }).connect(musicGain!);
        pad.volume.value = -15;
        
        const chords = [
          ['C3', 'Eb3', 'G3'],   // Cm
          ['Ab2', 'C3', 'Eb3'],  // Ab
          ['Bb2', 'D3', 'F3'],   // Bb
          ['G2', 'B2', 'D3'],    // G (surprise major)
        ];
        
        let chordIndex = 0;
        const playChord = () => {
          if (!currentMusicTrack) return;
          pad.triggerAttackRelease(chords[chordIndex], '2n');
          chordIndex = (chordIndex + 1) % chords.length;
        };
        
        playChord();
        musicLoop = window.setInterval(playChord, 4000);
        musicPlayers.push(pad);
        break;
      }
      
      case MusicTracks.CHASE: {
        // Frantic percussion and bass
        const bass = new Tone.MembraneSynth({
          pitchDecay: 0.02,
          octaves: 2,
          envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 }
        }).connect(musicGain!);
        bass.volume.value = -8;
        
        let beat = 0;
        const pattern = () => {
          if (!currentMusicTrack) return;
          const now = Tone.now();
          
          // Driving bass pattern
          if (beat % 2 === 0) {
            bass.triggerAttackRelease(40, '16n', now);
          }
          if (beat % 4 === 2) {
            bass.triggerAttackRelease(50, '16n', now);
          }
          
          // Occasional accent
          if (beat % 8 === 7) {
            metalSynth?.triggerAttackRelease('32n', now, 0.3);
          }
          
          beat++;
        };
        
        musicLoop = window.setInterval(pattern, 150);
        musicPlayers.push(bass);
        break;
      }
      
      default:
        console.warn(`Unknown music track: ${trackId}`);
    }
  }
  
  /**
   * Stop music (internal)
   */
  function stopMusicInternal(fadeOut = 500): void {
    if (musicLoop !== null) {
      clearInterval(musicLoop);
      musicLoop = null;
    }
    
    const now = Tone.now();
    musicGain?.gain.linearRampToValueAtTime(0, now + fadeOut / 1000);
    
    setTimeout(() => {
      musicPlayers.forEach(player => {
        if (player instanceof Tone.Oscillator) {
          player.stop();
        }
        player.dispose();
      });
      musicPlayers = [];
    }, fadeOut + 100);
    
    currentMusicTrack = null;
  }
  
  return {
    async init() {
      await initAudio();
    },
    
    isInitialized() {
      return initialized;
    },
    
    playSound(id: string, options?: SoundOptions) {
      playSoundEffect(id, options);
    },
    
    stopAllSounds() {
      // Synths auto-release, nothing to stop immediately
    },
    
    playMusic(trackId: string, options?: MusicOptions) {
      startMusic(trackId, options);
    },
    
    stopMusic(options?: { fadeOut?: number }) {
      stopMusicInternal(options?.fadeOut ?? 500);
    },
    
    setMasterVolume(volume: number) {
      masterVolume = Math.max(0, Math.min(1, volume));
      if (masterGain && !muted) {
        masterGain.gain.value = masterVolume;
      }
    },
    
    setSFXVolume(volume: number) {
      sfxVolume = Math.max(0, Math.min(1, volume));
      if (sfxGain) {
        sfxGain.gain.value = sfxVolume;
      }
    },
    
    setMusicVolume(volume: number) {
      musicVolume = Math.max(0, Math.min(1, volume));
      if (musicGain && !muted) {
        musicGain.gain.value = musicVolume;
      }
    },
    
    getMasterVolume() {
      return masterVolume;
    },
    
    getSFXVolume() {
      return sfxVolume;
    },
    
    getMusicVolume() {
      return musicVolume;
    },
    
    mute() {
      muted = true;
      if (masterGain) {
        masterGain.gain.value = 0;
      }
    },
    
    unmute() {
      muted = false;
      if (masterGain) {
        masterGain.gain.value = masterVolume;
      }
    },
    
    isMuted() {
      return muted;
    },
    
    isMusicPlaying() {
      return currentMusicTrack !== null;
    },
    
    getCurrentMusicTrack() {
      return currentMusicTrack;
    },
    
    dispose() {
      stopMusicInternal(0);
      
      noiseSynth?.dispose();
      membraneSynth?.dispose();
      metalSynth?.dispose();
      pluckSynth?.dispose();
      fmSynth?.dispose();
      amSynth?.dispose();
      
      reverb?.dispose();
      delay?.dispose();
      distortion?.dispose();
      filter?.dispose();
      
      sfxGain?.dispose();
      musicGain?.dispose();
      masterGain?.dispose();
      
      initialized = false;
    }
  };
}

// Singleton instance
let audioManagerInstance: AudioManager | null = null;

/**
 * Get the global audio manager instance
 */
export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = createAudioManager();
  }
  return audioManagerInstance;
}
