export class SeedGenerator {
    private static adjectives = [
        'Cosmic', 'Hungry', 'Ancient', 'Silent', 'Golden', 'Broken', 'Hidden', 'Loud',
        'Fuzzy', 'Sharp', 'Cruel', 'Gentle', 'Wild', 'Rapid', 'Slow', 'Deadly',
        'Vivid', 'Dark', 'Bright', 'Neon', 'Dusty', 'Clean', 'Filthy', 'Holy'
    ];

    private static nouns = [
        'Llama', 'Hat', 'Hand', 'Knife', 'Void', 'Star', 'Moon', 'River',
        'Mountain', 'Ocean', 'City', 'Tower', 'Shadow', 'Light', 'Dream', 'Nightmare',
        'Train', 'Ship', 'Plane', 'Road', 'Bridge', 'Gate', 'Key', 'Lock'
    ];

    public static generate(): string {
        const adj1 = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
        const adj2 = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
        const noun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
        return `${adj1}${adj2}${noun}`;
    }
}
