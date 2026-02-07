// Procedural world generation using seedrandom
import seedrandom from 'seedrandom';
import { 
  WorldSeed, 
  RoomConfig, 
  PropConfig, 
  RoomExit, 
  ADJECTIVES, 
  NOUNS 
} from '../types/game';

export function generateWorldSeed(): WorldSeed {
  const adj1 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const adj2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  
  return {
    adjective1: adj1,
    adjective2: adj2,
    noun: noun,
    seedString: `${adj1}-${adj2}-${noun}`
  };
}

export function parseWorldSeed(seedString: string): WorldSeed | null {
  const parts = seedString.split('-');
  if (parts.length !== 3) return null;
  
  const [adj1, adj2, noun] = parts;
  
  // Validate words exist in pools (case insensitive)
  const validAdj1 = ADJECTIVES.find(a => a.toLowerCase() === adj1.toLowerCase());
  const validAdj2 = ADJECTIVES.find(a => a.toLowerCase() === adj2.toLowerCase());
  const validNoun = NOUNS.find(n => n.toLowerCase() === noun.toLowerCase());
  
  if (!validAdj1 || !validAdj2 || !validNoun) return null;
  
  return {
    adjective1: validAdj1,
    adjective2: validAdj2,
    noun: validNoun,
    seedString: `${validAdj1}-${validAdj2}-${validNoun}`
  };
}

// Prop types that can be procedurally placed
const PROP_TYPES = [
  'table', 'chair', 'bookshelf', 'lamp', 'rug', 
  'crate', 'barrel', 'torch', 'chest', 'plant',
  'cabinet', 'bed', 'desk', 'mirror', 'painting',
  'candelabra', 'statue', 'pillar', 'bones', 'cobwebs'
];

const INTERACTIVE_PROPS = ['chest', 'crate', 'barrel', 'cabinet'];

export class WorldGenerator {
  private rng: seedrandom.PRNG;
  private seed: WorldSeed;
  private roomCount: number = 0;
  
  constructor(seed: WorldSeed) {
    this.seed = seed;
    this.rng = seedrandom(seed.seedString);
  }
  
  // Get deterministic random number between 0 and 1
  private random(): number {
    return this.rng();
  }
  
  // Get random int in range [min, max]
  private randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
  
  // Get random element from array
  private randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }
  
  // Generate the starting room
  generateStartRoom(): RoomConfig {
    const roomId = 'start';
    this.roomCount = 0;
    
    return this.generateRoom(roomId, true);
  }
  
  // Generate a room with given ID
  generateRoom(roomId: string, isStart: boolean = false): RoomConfig {
    this.roomCount++;
    
    // Room dimensions (slightly larger for diorama view)
    const width = this.randomInt(8, 14);
    const height = this.randomInt(8, 14);
    
    // Generate exits (1-3 exits per room)
    const exitCount = isStart ? this.randomInt(2, 3) : this.randomInt(1, 3);
    const exits = this.generateExits(roomId, exitCount, width, height);
    
    // Generate props (5-12 props per room)
    const propCount = this.randomInt(5, 12);
    const props = this.generateProps(propCount, width, height, exits);
    
    // Generate enemy spawns (0-2 per room, none in start)
    const enemyCount = isStart ? 0 : this.randomInt(0, 2);
    const enemies = this.generateEnemies(enemyCount, width, height);
    
    return {
      id: roomId,
      name: this.generateRoomName(),
      width,
      height,
      exits,
      props,
      enemies
    };
  }
  
  private generateRoomName(): string {
    const prefixes = ['The', 'A', 'An Old', 'The Forgotten', 'The Hidden'];
    const roomTypes = ['Chamber', 'Hall', 'Room', 'Passage', 'Gallery', 'Alcove'];
    
    return `${this.randomChoice(prefixes)} ${this.randomChoice(roomTypes)}`;
  }
  
  private generateExits(
    currentRoom: string, 
    count: number, 
    roomWidth: number, 
    roomHeight: number
  ): RoomExit[] {
    const directions: Array<'north' | 'south' | 'east' | 'west'> = ['north', 'south', 'east', 'west'];
    const shuffled = directions.sort(() => this.random() - 0.5);
    const selectedDirs = shuffled.slice(0, count);
    
    return selectedDirs.map(dir => {
      let x = 0, z = 0;
      
      switch (dir) {
        case 'north':
          x = 0;
          z = -roomHeight / 2 + 0.5;
          break;
        case 'south':
          x = 0;
          z = roomHeight / 2 - 0.5;
          break;
        case 'east':
          x = roomWidth / 2 - 0.5;
          z = 0;
          break;
        case 'west':
          x = -roomWidth / 2 + 0.5;
          z = 0;
          break;
      }
      
      // Generate deterministic connected room ID
      const targetRoom = `room_${currentRoom}_${dir}_${this.roomCount}`;
      
      return {
        direction: dir,
        targetRoom,
        position: { x, z }
      };
    });
  }
  
  private generateProps(
    count: number, 
    roomWidth: number, 
    roomHeight: number,
    exits: RoomExit[]
  ): PropConfig[] {
    const props: PropConfig[] = [];
    const usedPositions: Array<{ x: number; z: number }> = [];
    
    // Reserve exit positions
    exits.forEach(exit => {
      usedPositions.push(exit.position);
    });
    
    // Leave center area more clear for movement
    const margin = 1.5;
    
    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let placed = false;
      
      while (!placed && attempts < 20) {
        // Generate position avoiding center and edges
        let x: number, z: number;
        
        // Bias props toward edges/walls
        if (this.random() < 0.7) {
          // Edge placement
          const edge = this.randomInt(0, 3);
          switch (edge) {
            case 0: // North wall
              x = (this.random() - 0.5) * (roomWidth - 2);
              z = -roomHeight / 2 + margin;
              break;
            case 1: // South wall
              x = (this.random() - 0.5) * (roomWidth - 2);
              z = roomHeight / 2 - margin;
              break;
            case 2: // East wall
              x = roomWidth / 2 - margin;
              z = (this.random() - 0.5) * (roomHeight - 2);
              break;
            default: // West wall
              x = -roomWidth / 2 + margin;
              z = (this.random() - 0.5) * (roomHeight - 2);
              break;
          }
        } else {
          // Random placement (avoiding center)
          x = (this.random() - 0.5) * (roomWidth - 4);
          z = (this.random() - 0.5) * (roomHeight - 4);
          
          // Push away from center
          if (Math.abs(x) < 2) x += (x > 0 ? 2 : -2);
          if (Math.abs(z) < 2) z += (z > 0 ? 2 : -2);
        }
        
        // Check collision with existing positions
        const tooClose = usedPositions.some(pos => 
          Math.abs(pos.x - x) < 1.2 && Math.abs(pos.z - z) < 1.2
        );
        
        if (!tooClose) {
          const propType = this.randomChoice(PROP_TYPES);
          
          props.push({
            type: propType,
            position: { x, z },
            rotation: this.random() * Math.PI * 2,
            scale: 0.8 + this.random() * 0.4,
            interactive: INTERACTIVE_PROPS.includes(propType),
            itemDrop: INTERACTIVE_PROPS.includes(propType) && this.random() < 0.3 
              ? 'mysterious_item' 
              : undefined
          });
          
          usedPositions.push({ x, z });
          placed = true;
        }
        
        attempts++;
      }
    }
    
    return props;
  }
  
  private generateEnemies(
    count: number, 
    roomWidth: number, 
    roomHeight: number
  ): Array<{ type: string; position: { x: number; z: number }; patrolRadius: number }> {
    const enemies: Array<{ type: string; position: { x: number; z: number }; patrolRadius: number }> = [];
    
    for (let i = 0; i < count; i++) {
      // Place enemies in patrol-friendly locations
      const x = (this.random() - 0.5) * (roomWidth - 4);
      const z = (this.random() - 0.5) * (roomHeight - 4);
      
      enemies.push({
        type: 'llama_enemy',
        position: { x, z },
        patrolRadius: 2 + this.random() * 2
      });
    }
    
    return enemies;
  }
  
  // Generate room from ID (for loading adjacent rooms)
  generateRoomFromId(roomId: string): RoomConfig {
    // Use a room-specific seed for deterministic generation
    // Save and restore the instance RNG to avoid side effects
    const savedRng = this.rng;
    this.rng = seedrandom(this.seed.seedString + roomId);
    const room = this.generateRoom(roomId, roomId === 'start');
    this.rng = savedRng;
    return room;
  }
  
  // Get world display name
  getWorldName(): string {
    return `The ${this.seed.adjective1} ${this.seed.adjective2} ${this.seed.noun}`;
  }
}
