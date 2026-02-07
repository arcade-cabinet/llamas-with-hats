/**
 * AI Controller - Opponent Behavior System
 * =========================================
 * 
 * High-level AI controller for the opponent llama (Paul or Carl).
 * Uses CharacterNavigator internally for all pathfinding/steering.
 * 
 * This is a facade that provides a simple API for the game while
 * delegating actual movement to the shared navigation system.
 */

import { 
  createCharacterNavigator, 
  createAIBehavior,
  CharacterNavigator,
  AIBehavior,
  AIBehaviorState
} from './CharacterNavigator';

export type AIState = AIBehaviorState;

interface AIConfig {
  maxSpeed: number;
  maxForce: number;
  wanderRadius: number;
  followDistance: number;
  fleeDistance: number;
  interactionDistance: number;
}

const DEFAULT_CONFIG: AIConfig = {
  maxSpeed: 2,
  maxForce: 5,
  wanderRadius: 3,
  followDistance: 4,
  fleeDistance: 2,
  interactionDistance: 1.5
};

export class LlamaAI {
  private navigator: CharacterNavigator;
  private behavior: AIBehavior;
  private config: AIConfig;
  
  // Callbacks
  private onPositionUpdate: ((x: number, z: number, rotation: number) => void) | null = null;
  private onStateChange: ((state: AIState) => void) | null = null;
  
  constructor(
    startX: number, 
    startZ: number,
    roomWidth: number,
    roomHeight: number,
    config: Partial<AIConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Set bounds with margin
    const margin = 1;
    const bounds = {
      minX: -roomWidth / 2 + margin,
      maxX: roomWidth / 2 - margin,
      minZ: -roomHeight / 2 + margin,
      maxZ: roomHeight / 2 - margin
    };
    
    // Create navigator with AI-appropriate settings
    this.navigator = createCharacterNavigator({
      startX,
      startZ,
      bounds,
      maxSpeed: this.config.maxSpeed,
      maxForce: this.config.maxForce
    });
    
    // Create AI behavior controller
    this.behavior = createAIBehavior({
      navigator: this.navigator,
      followDistance: this.config.followDistance,
      fleeDistance: this.config.fleeDistance,
      interactionDistance: this.config.interactionDistance
    });
  }
  
  // Set callback for position updates
  setPositionCallback(callback: (x: number, z: number, rotation: number) => void) {
    this.onPositionUpdate = callback;
  }
  
  // Set callback for state changes
  setStateCallback(callback: (state: AIState) => void) {
    this.onStateChange = callback;
  }
  
  // Update player (target) position - called each frame by game
  updatePlayerPosition(x: number, z: number) {
    // Player position is passed to behavior.update()
    // Store it for the update call
    this._playerX = x;
    this._playerZ = z;
  }
  private _playerX = 0;
  private _playerZ = 0;
  
  // Get current state
  getState(): AIState {
    return this.behavior.getState();
  }
  
  // Get current position
  getPosition(): { x: number; z: number } {
    const pos = this.navigator.getPosition();
    return { x: pos.x, z: pos.z };
  }
  
  // Get rotation (facing direction)
  getRotation(): number {
    return this.navigator.getPosition().rotation;
  }
  
  // Set AI state manually
  setState(newState: AIState) {
    const oldState = this.behavior.getState();
    this.behavior.setState(newState);
    if (oldState !== newState) {
      this.onStateChange?.(newState);
    }
  }
  
  // Update bounds when room changes
  updateBounds(roomWidth: number, roomHeight: number) {
    const margin = 1;
    this.navigator.updateBounds({
      minX: -roomWidth / 2 + margin,
      maxX: roomWidth / 2 - margin,
      minZ: -roomHeight / 2 + margin,
      maxZ: roomHeight / 2 - margin
    });
  }
  
  // Teleport to position (for room transitions)
  teleport(x: number, z: number) {
    this.navigator.setPosition(x, z);
    this.navigator.idle();
  }
  
  // Main update loop - call this every frame
  update(deltaTime: number) {
    const oldState = this.behavior.getState();
    
    // Update AI behavior with player position
    this.behavior.update(deltaTime, this._playerX, this._playerZ);
    
    // Check for state changes
    const newState = this.behavior.getState();
    if (oldState !== newState) {
      this.onStateChange?.(newState);
    }
    
    // Notify position update
    const pos = this.navigator.getPosition();
    this.onPositionUpdate?.(pos.x, pos.z, pos.rotation);
  }
  
  // Cleanup
  dispose() {
    this.behavior.dispose();
  }
}

// Factory function to create AI controller
export function createLlamaAI(
  startX: number,
  startZ: number,
  roomWidth: number,
  roomHeight: number,
  onPositionUpdate: (x: number, z: number, rotation: number) => void
): LlamaAI {
  const ai = new LlamaAI(startX, startZ, roomWidth, roomHeight);
  ai.setPositionCallback(onPositionUpdate);
  return ai;
}
