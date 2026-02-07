/**
 * Atmosphere System
 * =================
 * 
 * Data-driven atmosphere control for scenes. Defines mood through
 * coordinated audio, fog, lighting, and ambient effects.
 * 
 * ## Design Philosophy
 * 
 * Instead of a linear "horror level", atmosphere is a multi-dimensional
 * state defined by named presets that can be:
 * - Set per-scene in JSON definitions
 * - Triggered by prop interactions
 * - Modified by NPC events
 * - Transitioned smoothly over time
 * 
 * ## JSON Definition
 * 
 * ```json
 * {
 *   "atmosphere": {
 *     "preset": "cozy",           // Base atmosphere preset
 *     "fog": { "density": 0.01, "color": [0.1, 0.08, 0.06] },
 *     "ambient": { "color": [0.9, 0.85, 0.7], "intensity": 0.5 },
 *     "music": "apartment_calm",
 *     "ambientSounds": ["clock_tick", "distant_traffic"]
 *   },
 *   "triggers": [
 *     {
 *       "type": "proximity",
 *       "action": {
 *         "type": "atmosphere",
 *         "params": {
 *           "transition": "uneasy",
 *           "duration": 2000
 *         }
 *       }
 *     }
 *   ]
 * }
 * ```
 * 
 * ## Atmosphere Presets
 * 
 * - **cozy**: Warm lighting, gentle ambient, calm music
 * - **uneasy**: Slightly desaturated, subtle tension
 * - **tense**: Darker, fog increases, heartbeat ambient
 * - **dread**: Heavy fog, ominous lighting, dissonant drones
 * - **panic**: Flickering, red tint, frantic audio
 * - **absurd**: Over-the-top comedic horror (for dark comedy beats)
 */

// Note: Audio is handled via AudioManager, not directly via Tone here
import { Scene, Color3, Color4, PointLight, HemisphericLight } from '@babylonjs/core';

// ============================================
// Atmosphere Preset Definitions
// ============================================

export type AtmospherePreset = 
  | 'cozy'      // Safe, warm, homey
  | 'uneasy'    // Something's not quite right
  | 'tense'     // Building dread
  | 'dread'     // Full horror atmosphere
  | 'panic'     // Immediate danger
  | 'absurd'    // Dark comedy - theatrical horror
  | 'neutral';  // Default/reset

export interface AtmosphereState {
  preset: AtmospherePreset;
  
  // Fog
  fogDensity: number;
  fogColor: [number, number, number];
  
  // Lighting
  ambientIntensity: number;
  ambientColor: [number, number, number];
  accentLight: {
    enabled: boolean;
    color: [number, number, number];
    intensity: number;
  };
  
  // Audio
  musicTrack: string | null;
  musicVolume: number;
  ambientSounds: string[];
  ambientVolume: number;
  
  // Effects
  colorGrade: {
    saturation: number;  // 0-1
    brightness: number;  // 0-1
    tint: [number, number, number];
  };
  particleEffects: string[];  // e.g., 'dust', 'fog_wisps', 'embers'
}

// Preset definitions - the "mood library"
const ATMOSPHERE_PRESETS: Record<AtmospherePreset, AtmosphereState> = {
  cozy: {
    preset: 'cozy',
    fogDensity: 0.005,
    fogColor: [0.15, 0.12, 0.1],
    ambientIntensity: 0.6,
    ambientColor: [1.0, 0.95, 0.85],
    accentLight: { enabled: false, color: [1, 1, 1], intensity: 0 },
    musicTrack: 'cozy_ambient',
    musicVolume: 0.4,
    ambientSounds: ['clock_tick'],
    ambientVolume: 0.3,
    colorGrade: { saturation: 1.0, brightness: 1.0, tint: [1, 1, 1] },
    particleEffects: ['dust'],
  },

  uneasy: {
    preset: 'uneasy',
    fogDensity: 0.015,
    fogColor: [0.12, 0.1, 0.08],
    ambientIntensity: 0.5,
    ambientColor: [0.9, 0.85, 0.75],
    accentLight: { enabled: false, color: [1, 1, 1], intensity: 0 },
    musicTrack: 'uneasy_ambient',
    musicVolume: 0.3,
    ambientSounds: ['clock_tick', 'creak'],
    ambientVolume: 0.4,
    colorGrade: { saturation: 0.9, brightness: 0.95, tint: [1, 0.98, 0.95] },
    particleEffects: ['dust'],
  },

  tense: {
    preset: 'tense',
    fogDensity: 0.025,
    fogColor: [0.1, 0.08, 0.06],
    ambientIntensity: 0.4,
    ambientColor: [0.8, 0.75, 0.65],
    accentLight: { enabled: true, color: [0.8, 0.4, 0.3], intensity: 0.2 },
    musicTrack: 'tense_ambient',
    musicVolume: 0.5,
    ambientSounds: ['heartbeat', 'creak', 'whisper'],
    ambientVolume: 0.5,
    colorGrade: { saturation: 0.8, brightness: 0.9, tint: [1, 0.95, 0.9] },
    particleEffects: ['dust', 'fog_wisps'],
  },

  dread: {
    preset: 'dread',
    fogDensity: 0.04,
    fogColor: [0.08, 0.05, 0.05],
    ambientIntensity: 0.25,
    ambientColor: [0.6, 0.5, 0.5],
    accentLight: { enabled: true, color: [0.8, 0.2, 0.1], intensity: 0.4 },
    musicTrack: 'dread_ambient',
    musicVolume: 0.7,
    ambientSounds: ['heartbeat', 'whisper', 'drip', 'wind'],
    ambientVolume: 0.6,
    colorGrade: { saturation: 0.6, brightness: 0.8, tint: [1, 0.9, 0.85] },
    particleEffects: ['fog_wisps', 'embers'],
  },

  panic: {
    preset: 'panic',
    fogDensity: 0.03,
    fogColor: [0.15, 0.05, 0.05],
    ambientIntensity: 0.3,
    ambientColor: [1.0, 0.6, 0.5],
    accentLight: { enabled: true, color: [1.0, 0.3, 0.2], intensity: 0.6 },
    musicTrack: 'panic_ambient',
    musicVolume: 0.8,
    ambientSounds: ['heartbeat'],
    ambientVolume: 0.8,
    colorGrade: { saturation: 1.2, brightness: 1.1, tint: [1, 0.8, 0.8] },
    particleEffects: ['embers'],
  },

  absurd: {
    preset: 'absurd',
    fogDensity: 0.02,
    fogColor: [0.15, 0.1, 0.15],
    ambientIntensity: 0.5,
    ambientColor: [0.9, 0.8, 1.0],
    accentLight: { enabled: true, color: [0.8, 0.3, 0.8], intensity: 0.3 },
    musicTrack: 'absurd_ambient',
    musicVolume: 0.5,
    ambientSounds: ['creak', 'paul_laugh'],
    ambientVolume: 0.5,
    colorGrade: { saturation: 1.1, brightness: 1.0, tint: [1, 0.95, 1] },
    particleEffects: ['dust', 'sparkles'],
  },
  
  neutral: {
    preset: 'neutral',
    fogDensity: 0.01,
    fogColor: [0.1, 0.1, 0.1],
    ambientIntensity: 0.5,
    ambientColor: [1, 1, 1],
    accentLight: { enabled: false, color: [1, 1, 1], intensity: 0 },
    musicTrack: null,
    musicVolume: 0,
    ambientSounds: [],
    ambientVolume: 0,
    colorGrade: { saturation: 1, brightness: 1, tint: [1, 1, 1] },
    particleEffects: [],
  },
};

// ============================================
// Atmosphere Triggers (for JSON definitions)
// ============================================

export interface AtmosphereTrigger {
  type: 'transition' | 'pulse' | 'layer';
  preset?: AtmospherePreset;
  duration?: number;  // Transition time in ms
  intensity?: number; // For pulse effects
  blend?: number;     // For layer blending (0-1)
}

// ============================================
// Atmosphere Manager
// ============================================

export interface AtmosphereManager {
  // State
  getCurrentState(): AtmosphereState;
  getPreset(): AtmospherePreset;
  
  // Transitions
  setPreset(preset: AtmospherePreset, duration?: number): void;
  transitionTo(state: Partial<AtmosphereState>, duration?: number): void;
  
  // Pulses (temporary effects that return to base)
  pulse(preset: AtmospherePreset, duration?: number): void;
  
  // Layering (blend another atmosphere on top)
  addLayer(id: string, state: Partial<AtmosphereState>, blend: number): void;
  removeLayer(id: string, fadeOut?: number): void;
  
  // Scene integration
  applyToScene(scene: Scene): void;
  
  // Audio integration
  setAudioManager(audio: {
    playMusic: (track: string, opts?: { volume?: number; fadeIn?: number }) => void;
    stopMusic: (opts?: { fadeOut?: number }) => void;
    crossfadeMusic: (track: string, opts?: { duration?: number; volume?: number }) => void;
    playSound: (id: string, opts?: { volume?: number }) => void;
  }): void;
  
  // Lifecycle
  update(deltaTime: number): void;
  dispose(): void;
}

export function createAtmosphereManager(): AtmosphereManager {
  let currentState: AtmosphereState = { ...ATMOSPHERE_PRESETS.neutral };
  let targetState: AtmosphereState = { ...currentState };
  let transitionProgress = 1;  // 0 = start, 1 = complete
  let transitionDuration = 0;
  
  // Layers for blending multiple atmosphere effects
  const layers = new Map<string, { state: Partial<AtmosphereState>; blend: number }>();
  
  // Pulse state (temporary override)
  let pulseState: AtmosphereState | null = null;
  let pulseProgress = 1;
  let pulseDuration = 0;
  
  // Scene references
  let sceneRef: Scene | null = null;
  let accentLightRef: PointLight | null = null;
  let ambientLightRef: HemisphericLight | null = null;
  
  // Audio manager reference
  let audioManager: {
    playMusic: (track: string, opts?: { volume?: number; fadeIn?: number }) => void;
    stopMusic: (opts?: { fadeOut?: number }) => void;
    crossfadeMusic: (track: string, opts?: { duration?: number; volume?: number }) => void;
    playSound: (id: string, opts?: { volume?: number }) => void;
  } | null = null;
  
  // Ambient sound loop
  let ambientSoundInterval: number | null = null;
  let currentAmbientSounds: string[] = [];
  
  /**
   * Interpolate between two atmosphere states
   */
  function lerpState(from: AtmosphereState, to: AtmosphereState, t: number): AtmosphereState {
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const lerpColor = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
      lerp(a[0], b[0]),
      lerp(a[1], b[1]),
      lerp(a[2], b[2]),
    ];
    
    return {
      preset: t < 0.5 ? from.preset : to.preset,
      fogDensity: lerp(from.fogDensity, to.fogDensity),
      fogColor: lerpColor(from.fogColor, to.fogColor),
      ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity),
      ambientColor: lerpColor(from.ambientColor, to.ambientColor),
      accentLight: {
        enabled: from.accentLight.enabled || to.accentLight.enabled,
        color: lerpColor(from.accentLight.color, to.accentLight.color),
        intensity: lerp(from.accentLight.intensity, to.accentLight.intensity),
      },
      musicTrack: t < 0.5 ? from.musicTrack : to.musicTrack,
      musicVolume: lerp(from.musicVolume, to.musicVolume),
      ambientSounds: t < 0.5 ? from.ambientSounds : to.ambientSounds,
      ambientVolume: lerp(from.ambientVolume, to.ambientVolume),
      colorGrade: {
        saturation: lerp(from.colorGrade.saturation, to.colorGrade.saturation),
        brightness: lerp(from.colorGrade.brightness, to.colorGrade.brightness),
        tint: lerpColor(from.colorGrade.tint, to.colorGrade.tint),
      },
      particleEffects: t < 0.5 ? from.particleEffects : to.particleEffects,
    };
  }
  
  /**
   * Apply layers to base state
   */
  function computeEffectiveState(): AtmosphereState {
    let state = transitionProgress < 1
      ? lerpState(currentState, targetState, transitionProgress)
      : { ...targetState };
    
    // Apply layers
    for (const [, layer] of layers) {
      state = lerpState(state, { ...state, ...layer.state }, layer.blend);
    }
    
    // Apply pulse
    if (pulseState && pulseProgress < 1) {
      const pulseT = Math.sin(pulseProgress * Math.PI); // Ease in-out
      state = lerpState(state, pulseState, pulseT * 0.5);
    }
    
    return state;
  }
  
  /**
   * Apply atmosphere to Babylon scene
   */
  function applyToSceneInternal(state: AtmosphereState) {
    if (!sceneRef) return;
    
    // Fog
    sceneRef.fogDensity = state.fogDensity;
    sceneRef.fogColor = new Color3(...state.fogColor);
    
    // Ambient light
    if (ambientLightRef) {
      ambientLightRef.intensity = state.ambientIntensity;
      ambientLightRef.diffuse = new Color3(...state.ambientColor);
    }
    
    // Accent light
    if (accentLightRef) {
      accentLightRef.intensity = state.accentLight.enabled ? state.accentLight.intensity : 0;
      accentLightRef.diffuse = new Color3(...state.accentLight.color);
    }
    
    // Clear color (subtle tint)
    const tint = state.colorGrade.tint;
    const brightness = state.colorGrade.brightness;
    sceneRef.clearColor = new Color4(
      0.08 * tint[0] * brightness,
      0.05 * tint[1] * brightness,
      0.03 * tint[2] * brightness,
      1
    );
  }
  
  // Track the last music track to avoid redundant crossfade calls
  let lastMusicTrack: string | null = null;

  /**
   * Update audio to match atmosphere
   */
  function updateAudio(state: AtmosphereState) {
    if (!audioManager) return;

    // Music -- use crossfade for smooth atmosphere transitions
    if (state.musicTrack) {
      if (state.musicTrack !== lastMusicTrack) {
        audioManager.crossfadeMusic(state.musicTrack, {
          duration: 2000,
          volume: state.musicVolume,
        });
        lastMusicTrack = state.musicTrack;
      }
    } else {
      audioManager.stopMusic({ fadeOut: 1000 });
      lastMusicTrack = null;
    }
    
    // Ambient sounds
    if (JSON.stringify(state.ambientSounds) !== JSON.stringify(currentAmbientSounds)) {
      currentAmbientSounds = [...state.ambientSounds];
      
      // Clear existing interval
      if (ambientSoundInterval !== null) {
        clearInterval(ambientSoundInterval);
      }
      
      // Set up new ambient sound loop
      if (currentAmbientSounds.length > 0) {
        const playRandomAmbient = () => {
          if (currentAmbientSounds.length === 0) return;
          const sound = currentAmbientSounds[Math.floor(Math.random() * currentAmbientSounds.length)];
          audioManager?.playSound(sound, { volume: state.ambientVolume });
        };
        
        // Play one immediately, then on interval
        playRandomAmbient();
        ambientSoundInterval = window.setInterval(playRandomAmbient, 4000 + Math.random() * 4000);
      }
    }
  }
  
  return {
    getCurrentState() {
      return computeEffectiveState();
    },
    
    getPreset() {
      return targetState.preset;
    },
    
    setPreset(preset: AtmospherePreset, duration = 1000) {
      const newState = ATMOSPHERE_PRESETS[preset];
      if (!newState) {
        console.warn(`Unknown atmosphere preset: ${preset}`);
        return;
      }
      
      currentState = computeEffectiveState();
      targetState = { ...newState };
      transitionProgress = 0;
      transitionDuration = duration;
      
      // Update audio immediately for responsiveness
      updateAudio(targetState);
    },
    
    transitionTo(state: Partial<AtmosphereState>, duration = 1000) {
      currentState = computeEffectiveState();
      targetState = { ...currentState, ...state };
      transitionProgress = 0;
      transitionDuration = duration;
    },
    
    pulse(preset: AtmospherePreset, duration = 2000) {
      pulseState = ATMOSPHERE_PRESETS[preset] || null;
      pulseProgress = 0;
      pulseDuration = duration;
      
      // Play a sound to emphasize the pulse
      if (preset === 'dread' || preset === 'panic') {
        audioManager?.playSound('whisper', { volume: 0.3 });
      }
    },
    
    addLayer(id: string, state: Partial<AtmosphereState>, blend: number) {
      layers.set(id, { state, blend: Math.max(0, Math.min(1, blend)) });
    },
    
    removeLayer(id: string, fadeOut = 500) {
      const layer = layers.get(id);
      if (layer && fadeOut > 0) {
        // Fade out over time
        const startBlend = layer.blend;
        const startTime = performance.now();
        const fadeStep = () => {
          const elapsed = performance.now() - startTime;
          const t = Math.min(1, elapsed / fadeOut);
          layer.blend = startBlend * (1 - t);
          
          if (t < 1) {
            requestAnimationFrame(fadeStep);
          } else {
            layers.delete(id);
          }
        };
        requestAnimationFrame(fadeStep);
      } else {
        layers.delete(id);
      }
    },
    
    applyToScene(scene: Scene) {
      sceneRef = scene;
      
      // Find or create ambient light
      ambientLightRef = scene.getLightByName('ambient') as HemisphericLight | null;
      
      // Create accent light if needed
      if (!accentLightRef) {
        accentLightRef = new PointLight('atmosphere_accent', new Vector3(0, 2, 0), scene);
        accentLightRef.intensity = 0;
      }
      
      // Enable fog
      scene.fogMode = Scene.FOGMODE_EXP2;
      
      // Apply initial state
      applyToSceneInternal(computeEffectiveState());
    },
    
    setAudioManager(audio) {
      audioManager = audio;
    },
    
    update(deltaTime: number) {
      // Update transition
      if (transitionProgress < 1 && transitionDuration > 0) {
        transitionProgress += (deltaTime * 1000) / transitionDuration;
        transitionProgress = Math.min(1, transitionProgress);
        
        if (transitionProgress >= 1) {
          currentState = { ...targetState };
        }
      }
      
      // Update pulse
      if (pulseProgress < 1 && pulseDuration > 0) {
        pulseProgress += (deltaTime * 1000) / pulseDuration;
        if (pulseProgress >= 1) {
          pulseState = null;
        }
      }
      
      // Apply to scene
      applyToSceneInternal(computeEffectiveState());
    },
    
    dispose() {
      if (ambientSoundInterval !== null) {
        clearInterval(ambientSoundInterval);
        ambientSoundInterval = null;
      }
      
      if (accentLightRef) {
        accentLightRef.dispose();
        accentLightRef = null;
      }
      
      layers.clear();
      sceneRef = null;
      audioManager = null;
    },
  };
}

// Need Vector3 for light positioning
import { Vector3 } from '@babylonjs/core';

// Singleton instance
let atmosphereManagerInstance: AtmosphereManager | null = null;

export function getAtmosphereManager(): AtmosphereManager {
  if (!atmosphereManagerInstance) {
    atmosphereManagerInstance = createAtmosphereManager();
  }
  return atmosphereManagerInstance;
}

/**
 * Reset the atmosphere manager singleton. Call during HMR or scene teardown.
 */
export function resetAtmosphereManager(): void {
  if (atmosphereManagerInstance) {
    atmosphereManagerInstance.dispose();
    atmosphereManagerInstance = null;
  }
}

// ============================================
// JSON Action Handler
// ============================================

/**
 * Handle atmosphere actions from scene triggers
 */
export function handleAtmosphereAction(
  action: AtmosphereTrigger,
  manager: AtmosphereManager = getAtmosphereManager()
): void {
  switch (action.type) {
    case 'transition':
      if (action.preset) {
        manager.setPreset(action.preset, action.duration ?? 1000);
      }
      break;
      
    case 'pulse':
      if (action.preset) {
        manager.pulse(action.preset, action.duration ?? 2000);
      }
      break;
      
    case 'layer':
      if (action.preset) {
        const layerState = ATMOSPHERE_PRESETS[action.preset];
        manager.addLayer(
          `trigger_${Date.now()}`,
          layerState,
          action.blend ?? 0.5
        );
      }
      break;
  }
}
