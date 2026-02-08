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
  crossfadeMusic(trackId: string, options?: { duration?: number; volume?: number }): void;

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
  DIALOGUE_BLIP: 'dialogue_blip',

  // Movement
  FOOTSTEP_WOOD: 'footstep_wood',
  FOOTSTEP_CARPET: 'footstep_carpet',
  FOOTSTEP_STONE: 'footstep_stone',
  FOOTSTEP_TILE: 'footstep_tile',

  // Interactions
  DOOR_OPEN: 'door_open',
  DOOR_CLOSE: 'door_close',
  DOOR_LOCKED: 'door_locked',
  DOOR_UNLOCK: 'door_unlock',
  ITEM_PICKUP: 'item_pickup',
  ITEM_DROP: 'item_drop',

  // Horror
  SCREAM: 'scream',
  BLOOD_SPLATTER: 'blood_splatter',
  HEARTBEAT: 'heartbeat',
  WHISPER: 'whisper',
  HORROR_STING: 'horror_sting',

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
  // Atmosphere-specific tracks (used by AtmosphereManager crossfade)
  COZY_AMBIENT: 'cozy_ambient',
  UNEASY_AMBIENT: 'uneasy_ambient',
  TENSE_AMBIENT: 'tense_ambient',
  DREAD_AMBIENT: 'dread_ambient',
  PANIC_AMBIENT: 'panic_ambient',
  ABSURD_AMBIENT: 'absurd_ambient',
} as const;

/**
 * Map of music track IDs to OGG file paths.
 * When a track has an OGG file, the file-based player is used instead of
 * (or layered with) the procedural synth fallback.
 */
const BASE = import.meta.env.BASE_URL;
const TRACK_FILES: Partial<Record<string, string>> = {
  [MusicTracks.HORROR_AMBIENT]: `${BASE}assets/sounds/horror_ambience.ogg`,
  [MusicTracks.APARTMENT_TENSE]: `${BASE}assets/sounds/tense_horror.ogg`,
  [MusicTracks.DREAD_AMBIENT]: `${BASE}assets/sounds/dark_theme.ogg`,
  [MusicTracks.TENSE_AMBIENT]: `${BASE}assets/sounds/tense_horror.ogg`,
  [MusicTracks.UNEASY_AMBIENT]: `${BASE}assets/sounds/spooky_dungeon.ogg`,
  [MusicTracks.PANIC_AMBIENT]: `${BASE}assets/sounds/revenge_theme.ogg`,
  [MusicTracks.CHASE]: `${BASE}assets/sounds/violence_theme.ogg`,
  [MusicTracks.MENU]: `${BASE}assets/sounds/dark_theme.ogg`,
  // Aliases used in stage definition JSON musicTrack fields
  music_uneasy: `${BASE}assets/sounds/spooky_dungeon.ogg`,
  music_tense: `${BASE}assets/sounds/tense_horror.ogg`,
  music_horror: `${BASE}assets/sounds/horror_ambience.ogg`,
  music_dread: `${BASE}assets/sounds/dark_theme.ogg`,
};

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

  // Crossfade state: holds the "outgoing" music during a crossfade
  let crossfadePlayers: Tone.ToneAudioNode[] = [];
  let crossfadeLoop: number | null = null;
  let crossfadeGain: Tone.Gain | null = null;
  let crossfadeTimeout: number | null = null;
  
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
    // Guard against suspended AudioContext — Tone.now() returns 0 or stale
    // times when the context hasn't been resumed by a user gesture, which
    // causes "time must be greater than or equal to" errors in Tone.js.
    if (Tone.getContext().state !== 'running') return;

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

      case SoundEffects.FOOTSTEP_TILE: {
        // Hard click on tile -- short bright tap with metallic ring
        const tileClick = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 }
        }).connect(sfxGain!);
        tileClick.triggerAttackRelease((1200 + Math.random() * 300) * pitch, '64n', now, 0.35 * volume);
        setTimeout(() => tileClick.dispose(), 200);
        // Slight low body thud
        membraneSynth?.triggerAttackRelease((80 + Math.random() * 20) * pitch, '64n', now, 0.15 * volume);
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

      case SoundEffects.DOOR_UNLOCK: {
        // Satisfying key-turn click followed by bolt sliding open
        metalSynth?.triggerAttackRelease('32n', now, 0.25 * volume);
        // Bolt slide
        const bolt = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 }
        }).connect(sfxGain!);
        bolt.frequency.setValueAtTime(300 * pitch, now + 0.12);
        bolt.frequency.linearRampToValueAtTime(150, now + 0.25);
        bolt.triggerAttackRelease('8n', now + 0.12, 0.25 * volume);
        // Confirmation ascending chime
        pluckSynth?.triggerAttack('E5', now + 0.3);
        pluckSynth?.triggerAttack('G5', now + 0.38);
        setTimeout(() => bolt.dispose(), 600);
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

      case SoundEffects.ITEM_DROP: {
        // Dull thud with slight bounce
        membraneSynth?.triggerAttackRelease(65 * pitch, '16n', now, 0.5 * volume);
        // Smaller secondary bounce
        membraneSynth?.triggerAttackRelease(90 * pitch, '32n', now + 0.12, 0.2 * volume);
        // Soft surface noise
        noiseSynth!.noise.type = 'brown';
        noiseSynth?.triggerAttackRelease('32n', now, 0.15 * volume);
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

      case SoundEffects.HORROR_STING: {
        // Sudden dissonant chord -- loud, jarring, cinematic
        const stingReverb = new Tone.Reverb({ decay: 3, wet: 0.5 }).connect(sfxGain!);
        const stingSynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.005, decay: 0.8, sustain: 0.1, release: 1.2 }
        }).connect(stingReverb);
        stingSynth.volume.value = -6;
        // Dissonant cluster: minor second + tritone
        stingSynth.triggerAttackRelease(
          ['C2', 'Db2', 'Gb2', 'C3', 'Db4'],
          '2n', now, 0.6 * volume
        );
        // Metallic crash on top
        metalSynth?.triggerAttackRelease('8n', now, 0.5 * volume);
        // Noise burst for impact
        const stingNoise = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
        }).connect(sfxGain!);
        stingNoise.triggerAttackRelease('16n', now, 0.3 * volume);
        setTimeout(() => {
          stingSynth.dispose();
          stingReverb.dispose();
          stingNoise.dispose();
        }, 3000);
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

      case SoundEffects.DIALOGUE_BLIP: {
        // Text advancement bleep -- short, retro-flavoured chirp
        const blip = new Tone.Synth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }
        }).connect(sfxGain!);
        // Slight random pitch variation keeps repeated blips from sounding robotic
        const blipFreq = (440 + Math.random() * 60) * pitch;
        blip.triggerAttackRelease(blipFreq, '64n', now, 0.18 * volume);
        setTimeout(() => blip.dispose(), 150);
        break;
      }

      // ─────────────────────────────────────────────────────────────────────
      // ATMOSPHERE - Triggered by AtmosphereManager
      // ─────────────────────────────────────────────────────────────────────
      case 'clock_tick': {
        // Percussive clock tick — short square-wave click with fast decay
        const tick = new Tone.Synth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }
        }).connect(sfxGain!);
        tick.triggerAttackRelease(1200 * pitch, '64n', now, 0.25 * volume);
        setTimeout(() => tick.dispose(), 150);
        break;
      }

      default:
        console.warn(`Unknown sound effect: ${id}`);
    }
  }
  
  /**
   * Start ambient music/drone.
   * Prefers file-based OGG playback when a track has a mapped file in TRACK_FILES.
   * Falls back to procedural Tone.js synthesis for unmapped tracks or on load error.
   */
  function startMusic(trackId: string, options: MusicOptions = {}): void {
    if (!initialized) return;

    stopMusicInternal();
    currentMusicTrack = trackId;

    const { volume = 1, fadeIn = 1000 } = options;
    const targetVol = volume * musicVolume * masterVolume;

    musicGain!.gain.setValueAtTime(0, Tone.now());
    musicGain!.gain.linearRampToValueAtTime(muted ? 0 : targetVol, Tone.now() + fadeIn / 1000);

    // ── Try file-based playback first ──
    const filePath = TRACK_FILES[trackId];
    if (filePath) {
      const player = new Tone.Player({
        url: filePath,
        loop: true,
        autostart: false,
        fadeIn: fadeIn / 1000,
        onload: () => {
          // Only start if this track is still current (user may have switched)
          if (currentMusicTrack === trackId) {
            player.start();
          }
        },
        onerror: () => {
          console.warn(`Failed to load music file: ${filePath}, falling back to procedural`);
          // Remove the failed player and fall through to procedural
          const idx = musicPlayers.indexOf(player);
          if (idx !== -1) musicPlayers.splice(idx, 1);
          player.dispose();
          startMusicProcedural(trackId, options);
        },
      }).connect(musicGain!);
      musicPlayers.push(player);
      return;
    }

    // ── No file mapped, use procedural synthesis ──
    startMusicProcedural(trackId, options);
  }

  /**
   * Procedural synthesis fallback for music tracks.
   */
  function startMusicProcedural(trackId: string, options: MusicOptions = {}): void {
    const { fadeIn = 1000 } = options;

    // If startMusic already set currentMusicTrack and gain, don't redo it
    // But if called as fallback from onerror, we need to ensure gain is set
    if (currentMusicTrack !== trackId) {
      currentMusicTrack = trackId;
      const { volume = 1 } = options;
      const targetVol = volume * musicVolume * masterVolume;
      musicGain!.gain.setValueAtTime(0, Tone.now());
      musicGain!.gain.linearRampToValueAtTime(muted ? 0 : targetVol, Tone.now() + fadeIn / 1000);
    }

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

      // ─────────────────────────────────────────────────────────────────────
      // ATMOSPHERE TRACKS - Used by AtmosphereManager for crossfade
      // ─────────────────────────────────────────────────────────────────────

      case MusicTracks.COZY_AMBIENT: {
        // Warm, gentle synth pad with soft melody (apartment living room)
        const warmPad = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 3, decay: 2, sustain: 0.7, release: 4 }
        }).connect(musicGain!);
        warmPad.volume.value = -14;

        // Soft melody voice -- triangle wave, gentle
        const melodyVoice = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.8, decay: 0.6, sustain: 0.3, release: 1.5 }
        }).connect(musicGain!);
        melodyVoice.volume.value = -20;

        // Warm major/add9 chords
        const cozyChords = [
          ['C3', 'E3', 'G3', 'D4'],   // Cadd9
          ['F3', 'A3', 'C4', 'G4'],   // Fadd9
          ['G3', 'B3', 'D4', 'A4'],   // Gadd9
          ['Am3', 'C4', 'E4', 'B4'],  // Am add9
        ];
        // Gentle pentatonic melody notes
        const cozyMelody = ['E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'D5', 'C5'];

        let cozyChordIdx = 0;
        let cozyMelodyIdx = 0;
        let cozyBeat = 0;

        const cozyStep = () => {
          if (!currentMusicTrack) return;

          // Play chord every 8 beats (= every 4 seconds at 500ms interval)
          if (cozyBeat % 8 === 0) {
            warmPad.triggerAttackRelease(cozyChords[cozyChordIdx], '1n');
            cozyChordIdx = (cozyChordIdx + 1) % cozyChords.length;
          }

          // Play melody note every 4 beats, occasionally rest
          if (cozyBeat % 4 === 2 && Math.random() > 0.3) {
            melodyVoice.triggerAttackRelease(cozyMelody[cozyMelodyIdx], '4n');
            cozyMelodyIdx = (cozyMelodyIdx + 1) % cozyMelody.length;
          }

          cozyBeat++;
        };

        cozyStep();
        musicLoop = window.setInterval(cozyStep, 500);
        musicPlayers.push(warmPad, melodyVoice);
        break;
      }

      case MusicTracks.UNEASY_AMBIENT: {
        // Slightly detuned pads with occasional dissonant notes
        const uneasePad1 = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 2.5, decay: 1.5, sustain: 0.6, release: 3 }
        }).connect(musicGain!);
        uneasePad1.volume.value = -16;

        // Second pad slightly detuned (+8 cents) for unease
        const uneasePad2 = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 2.5, decay: 1.5, sustain: 0.6, release: 3 }
        }).connect(musicGain!);
        uneasePad2.volume.value = -18;
        uneasePad2.detune.value = 8;

        // Occasional dissonant note voice
        const dissonantVoice = new Tone.FMSynth({
          harmonicity: 1.5,
          modulationIndex: 2,
          envelope: { attack: 0.5, decay: 1, sustain: 0.2, release: 2 }
        }).connect(musicGain!);
        dissonantVoice.volume.value = -24;

        const uneasyNotes = ['C3', 'Eb3', 'G3', 'Bb3', 'Ab3'];
        // Dissonant accidentals -- tritones and minor seconds
        const dissonantNotes = ['Gb4', 'Db5', 'B4', 'F5'];

        let uneasyIdx = 0;
        let uneasyBeat = 0;

        const uneasyStep = () => {
          if (!currentMusicTrack) return;
          const t = Tone.now();

          if (uneasyBeat % 10 === 0) {
            const note = uneasyNotes[uneasyIdx];
            uneasePad1.triggerAttackRelease(note, '1n', t);
            uneasePad2.triggerAttackRelease(note, '1n', t);
            uneasyIdx = (uneasyIdx + 1) % uneasyNotes.length;
          }

          // Occasional dissonant accent (roughly 20% chance per cycle)
          if (uneasyBeat % 10 === 5 && Math.random() > 0.6) {
            const dNote = dissonantNotes[Math.floor(Math.random() * dissonantNotes.length)];
            dissonantVoice.triggerAttackRelease(dNote, '2n', t);
          }

          uneasyBeat++;
        };

        uneasyStep();
        musicLoop = window.setInterval(uneasyStep, 600);
        musicPlayers.push(uneasePad1, uneasePad2, dissonantVoice);
        break;
      }

      case MusicTracks.TENSE_AMBIENT: {
        // Low drone, heartbeat-like pulse, sparse high notes
        const tenseDrone = new Tone.Oscillator({ type: 'sawtooth', frequency: 45 }).connect(musicGain!);
        tenseDrone.volume.value = -18;
        const tenseDroneFilter = new Tone.Filter({ frequency: 200, type: 'lowpass', rolloff: -24 }).connect(musicGain!);
        tenseDrone.disconnect();
        tenseDrone.connect(tenseDroneFilter);

        // LFO to slowly modulate drone frequency for organic movement
        const tenseLfo = new Tone.LFO({ frequency: 0.07, min: 42, max: 48 }).connect(tenseDrone.frequency);
        tenseLfo.start();

        // Heartbeat-like pulse -- membrane synth for "lub-dub"
        const heartMembrane = new Tone.MembraneSynth({
          pitchDecay: 0.04,
          octaves: 3,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.25 }
        }).connect(musicGain!);
        heartMembrane.volume.value = -14;

        // Sparse high note (glass-like)
        const tenseHighVoice = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.3, decay: 1.5, sustain: 0, release: 2 }
        }).connect(musicGain!);
        tenseHighVoice.volume.value = -22;

        const highNotes = ['Eb5', 'Bb5', 'Gb5', 'C6', 'Ab5'];

        tenseDrone.start();

        let tenseBeat = 0;
        const tenseStep = () => {
          if (!currentMusicTrack) return;
          const t = Tone.now();

          // Heartbeat pulse: lub-dub every ~1.2 seconds (2 beats at 600ms)
          if (tenseBeat % 2 === 0) {
            heartMembrane.triggerAttackRelease(38, '16n', t, 0.5);
            heartMembrane.triggerAttackRelease(32, '16n', t + 0.15, 0.3);
          }

          // Sparse high note every ~6 beats, sometimes skips
          if (tenseBeat % 6 === 3 && Math.random() > 0.5) {
            const note = highNotes[Math.floor(Math.random() * highNotes.length)];
            tenseHighVoice.triggerAttackRelease(note, '2n', t);
          }

          tenseBeat++;
        };

        musicLoop = window.setInterval(tenseStep, 600);
        musicPlayers.push(tenseDrone, tenseDroneFilter, tenseLfo, heartMembrane, tenseHighVoice);
        break;
      }

      case MusicTracks.DREAD_AMBIENT: {
        // Deep rumbling, metallic scrapes, breathing-like oscillation
        // Sub-bass rumble
        const dreadRumble = new Tone.Oscillator({ type: 'sawtooth', frequency: 30 }).connect(musicGain!);
        const dreadRumbleFilter = new Tone.Filter({ frequency: 80, type: 'lowpass', rolloff: -48 }).connect(musicGain!);
        dreadRumble.disconnect();
        dreadRumble.connect(dreadRumbleFilter);
        dreadRumble.volume.value = -12;

        // Secondary rumble an octave up for body
        const dreadRumble2 = new Tone.Oscillator({ type: 'triangle', frequency: 60 }).connect(musicGain!);
        dreadRumble2.volume.value = -20;

        // Breathing-like oscillation via amplitude LFO on noise
        const breathNoise = new Tone.NoiseSynth({
          noise: { type: 'brown' },
          envelope: { attack: 0.5, decay: 0.5, sustain: 1, release: 0.5 }
        });
        const breathFilter = new Tone.Filter({ frequency: 300, type: 'bandpass', Q: 1 }).connect(musicGain!);
        breathNoise.connect(breathFilter);
        breathNoise.volume.value = -20;

        // LFO for breathing -- modulates the filter frequency
        const breathLfo = new Tone.LFO({ frequency: 0.2, min: 150, max: 500 }).connect(breathFilter.frequency);

        // Metallic scrape voice
        const scrapeMetalSynth = new Tone.MetalSynth({
          envelope: { attack: 0.3, decay: 1.5, release: 0.8 },
          harmonicity: 3.1,
          modulationIndex: 16,
          resonance: 2000,
          octaves: 0.5
        }).connect(musicGain!);
        scrapeMetalSynth.volume.value = -26;

        dreadRumble.start();
        dreadRumble2.start();
        breathNoise.triggerAttack();
        breathLfo.start();

        let dreadBeat = 0;
        const dreadStep = () => {
          if (!currentMusicTrack) return;
          const t = Tone.now();

          // Random metallic scrape every ~5 seconds
          if (dreadBeat % 5 === 0 && Math.random() > 0.4) {
            scrapeMetalSynth.triggerAttackRelease('4n', t, 0.3);
          }

          // Occasional sub-frequency shift for unease
          if (dreadBeat % 8 === 0) {
            const newFreq = 28 + Math.random() * 8;
            dreadRumble.frequency.linearRampToValueAtTime(newFreq, t + 2);
          }

          dreadBeat++;
        };

        musicLoop = window.setInterval(dreadStep, 1000);
        musicPlayers.push(dreadRumble, dreadRumbleFilter, dreadRumble2, breathNoise, breathFilter, breathLfo, scrapeMetalSynth);
        break;
      }

      case MusicTracks.PANIC_AMBIENT: {
        // Fast pulse, distorted tones, chaotic
        // Fast pulsing bass
        const panicBass = new Tone.MembraneSynth({
          pitchDecay: 0.01,
          octaves: 2,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.15 }
        }).connect(musicGain!);
        panicBass.volume.value = -8;

        // Distorted lead for chaotic energy
        const panicDist = new Tone.Distortion({ distortion: 0.6, wet: 0.4 }).connect(musicGain!);
        const panicLead = new Tone.FMSynth({
          harmonicity: 5,
          modulationIndex: 20,
          envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.2 }
        }).connect(panicDist);
        panicLead.volume.value = -16;

        // High-pitched alarm-like oscillator
        const panicAlarm = new Tone.Oscillator({ type: 'square', frequency: 800 }).connect(musicGain!);
        panicAlarm.volume.value = -24;
        const alarmLfo = new Tone.LFO({ frequency: 4, min: 600, max: 1000 }).connect(panicAlarm.frequency);

        // Noise bed for chaos
        const panicNoise = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.1 }
        });
        const panicNoiseFilter = new Tone.Filter({ frequency: 3000, type: 'highpass' }).connect(musicGain!);
        panicNoise.connect(panicNoiseFilter);
        panicNoise.volume.value = -28;

        panicAlarm.start();
        alarmLfo.start();
        panicNoise.triggerAttack();

        const panicNotes = ['C2', 'Eb2', 'C2', 'Gb2', 'C2', 'Ab2', 'C2', 'Bb1'];
        const panicLeadNotes = ['C4', 'Eb4', 'Gb4', 'Bb4', 'C5', 'Ab4', 'Gb4', 'Eb4'];

        let panicBeat = 0;
        const panicStep = () => {
          if (!currentMusicTrack) return;
          const t = Tone.now();

          // Driving bass pulse
          panicBass.triggerAttackRelease(panicNotes[panicBeat % panicNotes.length], '32n', t, 0.7);

          // Chaotic lead notes on odd beats
          if (panicBeat % 2 === 1) {
            panicLead.triggerAttackRelease(
              panicLeadNotes[Math.floor(Math.random() * panicLeadNotes.length)],
              '16n', t, 0.4
            );
          }

          // Occasional metal crash
          if (panicBeat % 8 === 7) {
            metalSynth?.triggerAttackRelease('16n', t, 0.4);
          }

          panicBeat++;
        };

        musicLoop = window.setInterval(panicStep, 130); // Fast tempo
        musicPlayers.push(panicBass, panicDist, panicLead, panicAlarm, alarmLfo, panicNoise, panicNoiseFilter);
        break;
      }

      case MusicTracks.ABSURD_AMBIENT: {
        // Silly/whimsical but unsettling -- tuba + music box feel
        // "Tuba" -- low FM synth with bouncy envelope
        const tuba = new Tone.FMSynth({
          harmonicity: 1,
          modulationIndex: 3,
          envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 0.4 },
          modulation: { type: 'triangle' } as any
        }).connect(musicGain!);
        tuba.volume.value = -14;

        // "Music box" -- high plucky metallic sound
        const musicBox = new Tone.PluckSynth({
          attackNoise: 2,
          dampening: 6000,
          resonance: 0.95
        }).connect(musicGain!);
        musicBox.volume.value = -16;

        // Subtle detuned pad underneath for uncanny valley feeling
        const absurdPad = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 2, decay: 1, sustain: 0.5, release: 2 }
        }).connect(musicGain!);
        absurdPad.volume.value = -22;
        absurdPad.detune.value = -15; // Slightly flat for unsettling feel

        // Oom-pah tuba pattern in minor with weird intervals
        const tubaPattern = ['C2', 'G2', 'Eb2', 'G2', 'Ab2', 'G2', 'B1', 'G2'];
        // Music box melody -- nursery-rhyme feel but in minor, with wrong notes
        const boxMelody = ['Eb5', 'G5', 'C6', 'B5', 'Ab5', 'Eb5', 'F#5', 'G5',
                           'C6', 'Eb6', 'D6', 'B5', 'Ab5', 'G5', 'Eb5', 'C5'];

        let absurdBeat = 0;
        let boxNoteIdx = 0;

        const absurdStep = () => {
          if (!currentMusicTrack) return;
          const t = Tone.now();

          // Tuba oom-pah
          tuba.triggerAttackRelease(
            tubaPattern[absurdBeat % tubaPattern.length],
            '8n', t, 0.5
          );

          // Music box melody every other beat
          if (absurdBeat % 2 === 0) {
            musicBox.triggerAttack(boxMelody[boxNoteIdx % boxMelody.length], t);
            boxNoteIdx++;
          }

          // Pad chord changes
          if (absurdBeat % 16 === 0) {
            const padNotes = ['C3', 'Eb3', 'Ab3', 'B3'];
            absurdPad.triggerAttackRelease(
              padNotes[Math.floor(absurdBeat / 16) % padNotes.length],
              '1n', t
            );
          }

          absurdBeat++;
        };

        absurdStep();
        musicLoop = window.setInterval(absurdStep, 300);
        musicPlayers.push(tuba, musicBox, absurdPad);
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
        if (player instanceof Tone.Oscillator || player instanceof Tone.Player) {
          player.stop();
        }
        player.dispose();
      });
      musicPlayers = [];
    }, fadeOut + 100);
    
    currentMusicTrack = null;
  }

  /**
   * Crossfade from the current music track to a new one.
   * The old track fades out while the new one fades in over `duration` ms.
   * If the requested track is already playing, this is a no-op.
   */
  function crossfadeMusicInternal(
    trackId: string,
    options: { duration?: number; volume?: number } = {}
  ): void {
    if (!initialized) return;
    if (trackId === currentMusicTrack) return;
    if (Tone.getContext().state !== 'running') return;

    const duration = options.duration ?? 2000;
    const vol = options.volume ?? 1;
    const now = Tone.now();
    const fadeSeconds = duration / 1000;

    // ── 1. Clean up any previous crossfade still draining ──
    if (crossfadeTimeout !== null) {
      clearTimeout(crossfadeTimeout);
      crossfadeTimeout = null;
    }
    if (crossfadeLoop !== null) {
      clearInterval(crossfadeLoop);
      crossfadeLoop = null;
    }
    crossfadePlayers.forEach(p => {
      if (p instanceof Tone.Oscillator || p instanceof Tone.Player) p.stop();
      p.dispose();
    });
    crossfadePlayers = [];
    crossfadeGain?.dispose();
    crossfadeGain = null;

    // ── 2. Move current music players to crossfade slots to fade out ──
    if (musicPlayers.length > 0) {
      crossfadeGain = new Tone.Gain(muted ? 0 : musicVolume * masterVolume).connect(masterGain!);

      // Re-route existing players through the crossfade gain
      musicPlayers.forEach(p => {
        try { p.disconnect(musicGain!); } catch { /* may not be directly connected */ }
        try { p.connect(crossfadeGain!); } catch { /* LFOs wired to params, etc. */ }
      });
      crossfadePlayers = musicPlayers;
      crossfadeLoop = musicLoop;

      // Fade out the old crossfadeGain
      crossfadeGain.gain.setValueAtTime(muted ? 0 : musicVolume * masterVolume, now);
      crossfadeGain.gain.linearRampToValueAtTime(0, now + fadeSeconds);

      // Dispose old players once the fade completes
      crossfadeTimeout = window.setTimeout(() => {
        if (crossfadeLoop !== null) {
          clearInterval(crossfadeLoop);
          crossfadeLoop = null;
        }
        crossfadePlayers.forEach(p => {
          if (p instanceof Tone.Oscillator || p instanceof Tone.Player) p.stop();
          p.dispose();
        });
        crossfadePlayers = [];
        crossfadeGain?.dispose();
        crossfadeGain = null;
        crossfadeTimeout = null;
      }, duration + 200);
    }

    // ── 3. Reset primary music slots and start new track with fade-in ──
    musicPlayers = [];
    musicLoop = null;
    currentMusicTrack = null;

    // Zero the music gain so startMusic's own fade-in ramp works correctly
    musicGain!.gain.cancelScheduledValues(now);
    musicGain!.gain.setValueAtTime(0, now);

    startMusic(trackId, { volume: vol, fadeIn: duration });
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

    crossfadeMusic(trackId: string, options?: { duration?: number; volume?: number }) {
      crossfadeMusicInternal(trackId, options);
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

      // Clean up any in-progress crossfade
      if (crossfadeTimeout !== null) {
        clearTimeout(crossfadeTimeout);
        crossfadeTimeout = null;
      }
      if (crossfadeLoop !== null) {
        clearInterval(crossfadeLoop);
        crossfadeLoop = null;
      }
      crossfadePlayers.forEach(p => {
        if (p instanceof Tone.Oscillator || p instanceof Tone.Player) p.stop();
        p.dispose();
      });
      crossfadePlayers = [];
      crossfadeGain?.dispose();
      crossfadeGain = null;

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

/**
 * Reset the audio manager singleton. Call during HMR or scene teardown
 * to prevent leaked Tone.js nodes across hot reloads.
 */
export function resetAudioManager(): void {
  if (audioManagerInstance) {
    audioManagerInstance.stopMusic();
    audioManagerInstance = null;
  }
}
