import * as Tone from 'tone';

class AudioManager {
    private static instance: AudioManager;
    private ambiencePlayer: Tone.Player | null = null;
    private isInitialized = false;

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
        console.log('Audio Context Started');

        // Create a reverb for that horror atmosphere
        const reverb = new Tone.Reverb({
            decay: 4,
            wet: 0.3
        }).toDestination();

        // Create a filter to muffle sounds based on horror level later
        const filter = new Tone.Filter(2000, "lowpass").connect(reverb);

        // Initialize Ambience
        this.ambiencePlayer = new Tone.Player({
            url: "/assets/sounds/horror_ambience.wav",
            loop: true,
            fadeIn: 2,
            fadeOut: 2,
            autostart: true
        }).connect(filter);

        // Lower volume initially
        this.ambiencePlayer.volume.value = -12;

        this.isInitialized = true;
    }

    public setHorrorLevel(level: number) {
        if (!this.ambiencePlayer) return;

        // As horror increases, pitch shifts down and volume goes up
        const playbackRate = Math.max(0.5, 1 - (level * 0.05));
        this.ambiencePlayer.playbackRate = playbackRate;

        // Increase volume
        this.ambiencePlayer.volume.rampTo(-12 + (level * 1.5), 2);
    }

    public stop() {
        this.ambiencePlayer?.stop();
    }
}

export const audioManager = AudioManager.getInstance();
