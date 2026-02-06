export class RandomManager {
    private static instance: RandomManager;
    private _seed: string = '';

    // Xorshift128+ State
    private s0: number = 0;
    private s1: number = 0;
    private s2: number = 0;
    private s3: number = 0;

    private constructor() {
        this.init(Date.now().toString());
    }

    public static getInstance(): RandomManager {
        if (!RandomManager.instance) {
            RandomManager.instance = new RandomManager();
        }
        return RandomManager.instance;
    }

    public init(seed: string) {
        this._seed = seed;
        // Simple hash to initialize state from string
        this.s0 = this.hashString(seed + 'a');
        this.s1 = this.hashString(seed + 'b');
        this.s2 = this.hashString(seed + 'c');
        this.s3 = this.hashString(seed + 'd');
        console.log(`[RandomManager] Initialized with seed: "${seed}"`);
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        // Force positive and ensure non-zero
        return Math.abs(hash) || 1;
    }

    // Xorshift128 implementation
    private next(): number {
        let t = this.s3;
        const s = this.s0;
        this.s3 = this.s2;
        this.s2 = this.s1;
        this.s1 = s;
        t ^= t << 11;
        t ^= t >>> 8;
        this.s0 = t ^ s ^ (s >>> 19);

        // Return float 0-1
        return (this.s0 >>> 0) / 4294967296;
    }

    public get seed(): string {
        return this._seed;
    }

    /**
     * Returns a random float between min (inclusive) and max (exclusive).
     * @param min Default 0
     * @param max Default 1
     */
    public float(min: number = 0, max: number = 1): number {
        return min + this.next() * (max - min);
    }

    /**
     * Returns a random integer between min (inclusive) and max (inclusive).
     */
    public int(min: number, max: number): number {
        return Math.floor(this.float(min, max + 1));
    }

    /**
     * Returns true or false based on probability (0-1).
     */
    public bool(probability: number = 0.5): boolean {
        return this.next() < probability;
    }

    /**
     * Returns a random element from an array.
     */
    public pick<T>(array: T[]): T | undefined {
        if (array.length === 0) return undefined;
        return array[this.int(0, array.length - 1)];
    }
}

export const rng = RandomManager.getInstance();
