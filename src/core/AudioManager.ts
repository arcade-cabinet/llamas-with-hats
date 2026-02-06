import * as Tone from 'tone';

export class AudioManager {
    private static instance: AudioManager;
    private ambiencePlayer: Tone.Player | null = null;
    private isInitialized = false;

    // Procedural Instruments
    private throwSynth: Tone.MembraneSynth | null = null;
    private crunchSynth: Tone.NoiseSynth | null = null;
    private screamSynth: Tone.FMSynth | null = null;

    private constructor() { }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public async initialize() {
        if (this.isInitialized) return;

        await Tone.start();
        console.log('[AudioManager] Audio Context Started');

        // 1. Ambience (Looping Asset)
        const reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).toDestination();
        const filter = new Tone.Filter(2000, "lowpass").connect(reverb);

        // Ambience loads from asset, but logic handles it gracefully
        this.ambiencePlayer = new Tone.Player({
            url: "/assets/sounds/horror_ambience.wav",
            loop: true,
            fadeIn: 2,
            fadeOut: 2,
            autostart: true
        }).connect(filter);

        this.ambiencePlayer.volume.value = -12;

        // 2. Procedural Synths (No external assets required)

        // 'Throw' - Swoosh/Impact
        this.throwSynth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
        }).toDestination();
        this.throwSynth.volume.value = -10;

        // 'Crunch' - Eating/Breaking
        this.crunchSynth = new Tone.NoiseSynth({
            noise: { type: "brown" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).toDestination();
        this.crunchSynth.volume.value = -8;

        // 'Scream' - Carl's Tantrum
        this.screamSynth = new Tone.FMSynth({
            harmonicity: 3,
            modulationIndex: 10,
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.1, decay: 0.5, sustain: 0.5, release: 0.5 },
            modulation: { type: "square" },
            modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 }
        }).connect(reverb); // Reverb implies distance/hallucination
        this.screamSynth.volume.value = -6;

        this.isInitialized = true;
    }

    public setHorrorLevel(level: number) {
        if (!this.ambiencePlayer) return;
        const playbackRate = Math.max(0.5, 1 - (level * 0.05));
        this.ambiencePlayer.playbackRate = playbackRate;
        this.ambiencePlayer.volume.rampTo(-12 + (level * 1.5), 2);
    }

    public stop() {
        this.ambiencePlayer?.stop();
    }

    public play(soundName: string, volume: number = 1.0, _rate: number = 1.0) {
        if (!this.isInitialized) return;
        const now = Tone.now();
        const gain = Tone.gainToDb(volume);

        try {
            switch (soundName) {
                case 'throw':
                    // "Swoosh" sound
                    this.throwSynth?.triggerAttackRelease("C2", "8n", now);
                    if (this.throwSynth) this.throwSynth.volume.rampTo(gain - 10, 0.1);
                    break;
                case 'crunch':
                    // Short noise burst
                    this.crunchSynth?.triggerAttackRelease("16n", now);
                    if (this.crunchSynth) this.crunchSynth.volume.rampTo(gain - 8, 0.1);
                    break;
                case 'speech_carl_scream':
                    // High pitched FM screech
                    this.screamSynth?.triggerAttackRelease("A5", "2n", now);
                    if (this.screamSynth) this.screamSynth.volume.rampTo(gain - 6, 0.1);
                    break;
                default:
                    // Procedural fallback for unknown sounds? Or just silence.
                    // For now, silence.
                    break;
            }
        } catch (e) {
            console.warn(`[AudioManager] Synthesis error:`, e);
        }
    }
}

export const audioManager = AudioManager.getInstance();
