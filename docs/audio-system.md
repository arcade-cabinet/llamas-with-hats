# Audio System

## Overview

The game uses **procedural audio synthesis** via Tone.js instead of pre-recorded sample files. This approach:

- Eliminates audio asset management
- Allows real-time sound parameterization
- Matches the whimsical dark comedy tone
- Reduces bundle size
- Enables instant iteration on sound design

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  AudioManager   │────▶│     Tone.js      │
│   (Singleton)   │     │  Web Audio API   │
└────────┬────────┘     └──────────────────┘
         │
         │ setAudioManager()
         ▼
┌─────────────────┐
│AtmosphereManager│──── Controls music/ambient
└─────────────────┘
         │
         │ callbacks
         ▼
┌─────────────────┐
│  StoryManager   │──── Triggers sounds
└─────────────────┘
```

## Initialization

```typescript
import { getAudioManager } from './systems/AudioManager';

const audio = getAudioManager();

// Must be called after user interaction (browser policy)
await audio.init();

// Play sounds
audio.playSound('footstep_wood');
audio.playMusic('horror_ambient', { volume: 0.5, fadeIn: 1000 });
```

## Sound Effects

All sounds are synthesized in real-time. Each has a unique character matching the game's dark comedy tone.

### Movement

| ID | Description | Synthesis |
|----|-------------|-----------|
| `footstep_wood` | Wooden floor step | Membrane synth + triangle knock |
| `footstep_carpet` | Soft carpet step | Brown noise burst |
| `footstep_stone` | Hard stone step | Membrane + metal synth |

### Doors

| ID | Description | Synthesis |
|----|-------------|-----------|
| `door_open` | Creaky door opening | Sawtooth sweep + membrane thunk |
| `door_close` | Heavy door closing | Low membrane + metal click |
| `door_locked` | Frustrated rattle | Metal burst + denied FM tone |

### Items

| ID | Description | Synthesis |
|----|-------------|-----------|
| `item_pickup` | Satisfying pickup | Ascending pluck arpeggio (C5-E5-G5-C6) |

### Horror (Theatrical)

| ID | Description | Synthesis |
|----|-------------|-----------|
| `scream` | Comedic scream | Descending sawtooth with wobbly LFO vibrato |
| `blood_splatter` | Wet splat | Pink noise + random membrane plops |
| `heartbeat` | Tense heartbeat | Dual membrane hits (lub-dub) |
| `whisper` | Creepy whisper | Filtered brown noise with bandpass sweep |

### Ambient

| ID | Description | Synthesis |
|----|-------------|-----------|
| `creak` | Floor/furniture creak | Triangle with pitch bend + distortion |
| `drip` | Water drop | Sine with exponential pitch fall + delay |
| `wind` | Atmospheric wind | Pink noise with lowpass filter sweep |

### Characters

| ID | Description | Synthesis |
|----|-------------|-----------|
| `carl_hmm` | Carl's thoughtful sound | Low triangle wave with pitch contour |
| `paul_laugh` | Paul's unsettling giggle | Erratic square wave bursts |

### UI

| ID | Description | Synthesis |
|----|-------------|-----------|
| `ui_click` | Button click | Pluck synth G5 |
| `ui_hover` | Hover feedback | Quick sine C6 |
| `ui_back` | Back/cancel | Pluck synth C4 |

## Music/Ambient Tracks

Procedural drones and loops for background atmosphere.

| ID | Description | Synthesis |
|----|-------------|-----------|
| `horror_ambient` | Creepy drone | Layered oscillators (55Hz + 82.5Hz) with slow LFO |
| `apartment_calm` | Gentle pads | Minor chord progression (Cm-Ab-Bb-G) |
| `apartment_tense` | Uneasy atmosphere | Similar to calm but with random creaks/whispers |
| `chase_theme` | Frantic pursuit | Driving membrane bass pattern at 150ms intervals |

## API Reference

### AudioManager

```typescript
interface AudioManager {
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
  setMasterVolume(volume: number): void;  // 0-1
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

interface SoundOptions {
  volume?: number;  // 0-1, default 1
  pitch?: number;   // 0.5-2, default 1 (multiplier)
}

interface MusicOptions {
  volume?: number;  // 0-1, default 1
  fadeIn?: number;  // ms, default 0
}
```

### useAudio Hook

```typescript
const {
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
} = useAudio();
```

### Constants

```typescript
import { SoundEffects, MusicTracks } from './systems/AudioManager';

// Sound effect IDs
SoundEffects.FOOTSTEP_WOOD
SoundEffects.DOOR_OPEN
SoundEffects.SCREAM
// ... etc

// Music track IDs
MusicTracks.HORROR_AMBIENT
MusicTracks.APARTMENT_CALM
MusicTracks.CHASE
// ... etc
```

## Integration with Atmosphere

The AtmosphereManager automatically controls audio based on the current preset:

```typescript
// Atmosphere handles this automatically:
atmosphereManager.setPreset('tense', 2000);
// → Plays 'horror_ambient' music
// → Starts random ambient sounds (heartbeat, creak, whisper)

atmosphereManager.setPreset('cozy', 2000);
// → Plays 'apartment_calm' music
// → Starts random ambient sounds (clock_tick)
```

## Adding New Sounds

### New Sound Effect

Add case to `playSoundEffect()` in AudioManager.ts:

```typescript
case 'my_new_sound': {
  // Use existing synths or create new ones
  const synth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
  }).connect(sfxGain!);
  
  synth.triggerAttackRelease('C4', '8n', now, volume);
  
  // Auto-dispose after sound completes
  setTimeout(() => synth.dispose(), 500);
  break;
}
```

Add constant:
```typescript
export const SoundEffects = {
  // ...existing
  MY_NEW_SOUND: 'my_new_sound',
} as const;
```

### New Music Track

Add case to `startMusic()` in AudioManager.ts:

```typescript
case 'my_new_track': {
  const synth = new Tone.PolySynth(Tone.Synth, {
    // Configure...
  }).connect(musicGain!);
  
  const pattern = () => {
    if (!currentMusicTrack) return;
    // Play notes/chords
  };
  
  pattern();
  musicLoop = window.setInterval(pattern, 2000);
  musicPlayers.push(synth);
  break;
}
```

Add constant:
```typescript
export const MusicTracks = {
  // ...existing
  MY_NEW_TRACK: 'my_new_track',
} as const;
```

## Browser Considerations

### Autoplay Policy

Browsers require user interaction before playing audio. Call `audio.init()` in response to a click/tap:

```typescript
const handleStartGame = async () => {
  await audioManager.init();  // Safe after user click
  startGame();
};
```

The AudioManager handles this gracefully - sounds simply won't play until initialized.

### Performance

- Synths are reused where possible (noiseSynth, membraneSynth, etc.)
- One-shot synths auto-dispose after playing
- Music uses intervals, not continuous synthesis
- Gain nodes provide efficient volume control

## Sound Design Philosophy

The audio matches the game's "whimsical dark comedy" tone:

1. **Horror sounds are theatrical** - Screams have wobbly vibrato, blood splatters are over-the-top wet
2. **UI sounds are satisfying** - Plucky, responsive feedback
3. **Ambient is unsettling but not oppressive** - Random creaks, occasional whispers
4. **Character sounds are distinctive** - Carl is contemplative, Paul is erratic
5. **Music supports atmosphere** - Drone-based, responds to preset changes
