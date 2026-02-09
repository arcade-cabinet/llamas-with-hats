/**
 * AI Controller - Opponent Behavior System
 * =========================================
 *
 * High-level AI controller for the opponent llama (Paul or Carl).
 * Uses CharacterNavigator internally for all pathfinding/steering.
 *
 * This is a facade that provides a simple API for the game while
 * delegating actual movement to the shared navigation system.
 *
 * Horror-Level System
 * -------------------
 * The AI adapts its behavior based on a horror level (0-10):
 *   0-2  Normal wander
 *   3-4  Wander with occasional creepy stares at the player
 *   5-6  Aggressive follow (closer distance, faster speed)
 *   7-8  Stalker mode (follow closely, then sudden sprints)
 *   9-10 Doorway ambush (teleport ahead of the player, face them)
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

  // Ground-height callback for multi-floor Y positioning
  private _getGroundY: ((x: number, z: number) => number) | null = null;

  // Callbacks
  private onPositionUpdate: ((x: number, z: number, rotation: number) => void) | null = null;
  private onStateChange: ((state: AIState) => void) | null = null;

  // Horror-level system
  private _horrorLevel: number = 0;
  private _horrorBehaviorTimer: number = 0;
  private _horrorBehaviorCooldown: number = 0;
  private _isStaring: boolean = false;
  private _isSprinting: boolean = false;

  // Track previous player positions for ambush prediction
  private _prevPlayerX: number = 0;
  private _prevPlayerZ: number = 0;
  private _playerVelocityX: number = 0;
  private _playerVelocityZ: number = 0;

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

  // Set ground-height callback for multi-floor Y positioning
  setGetGroundY(fn: (x: number, z: number) => number) {
    this._getGroundY = fn;
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

  // Get current horror level
  getHorrorLevel(): number {
    return this._horrorLevel;
  }

  // Set horror level (0-10) - adjusts AI aggression and creepiness
  setHorrorLevel(level: number) {
    this._horrorLevel = Math.max(0, Math.min(10, level));

    // Reset horror behavior timers when level changes to avoid stale state
    this._horrorBehaviorTimer = 0;
    this._horrorBehaviorCooldown = 0;
    this._isStaring = false;
    this._isSprinting = false;

    // Restore base speed when horror level drops
    this.navigator.setMaxSpeed(this.config.maxSpeed);
  }

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

  // -------------------------------------------------------
  //  Horror-level behavior logic (called before behavior.update)
  // -------------------------------------------------------

  private _updateHorrorBehavior(deltaTime: number): void {
    const hl = this._horrorLevel;

    // Track player velocity for ambush prediction
    this._playerVelocityX = (this._playerX - this._prevPlayerX) / Math.max(deltaTime, 0.001);
    this._playerVelocityZ = (this._playerZ - this._prevPlayerZ) / Math.max(deltaTime, 0.001);
    this._prevPlayerX = this._playerX;
    this._prevPlayerZ = this._playerZ;

    // Tick down cooldown
    if (this._horrorBehaviorCooldown > 0) {
      this._horrorBehaviorCooldown -= deltaTime;
    }

    // ---- Level 0-2: No special behavior (normal wander) ----
    if (hl <= 2) {
      // Ensure base speed in case it was elevated from a previous level
      this.navigator.setMaxSpeed(this.config.maxSpeed);
      return;
    }

    // ---- Level 3-4: Creepy stare ----
    if (hl >= 3 && hl <= 4) {
      this.navigator.setMaxSpeed(this.config.maxSpeed);
      this._updateCreepyStare(deltaTime);
      return;
    }

    // ---- Level 5-6: Aggressive follow ----
    if (hl >= 5 && hl <= 6) {
      this._isSprinting = false;
      this._isStaring = false;
      this._updateAggressiveFollow();
      return;
    }

    // ---- Level 7-8: Stalker mode ----
    if (hl >= 7 && hl <= 8) {
      this._isStaring = false;
      this._updateStalkerMode(deltaTime);
      return;
    }

    // ---- Level 9-10: Doorway ambush ----
    if (hl >= 9) {
      this._isStaring = false;
      this._isSprinting = false;
      this._updateDoorwayAmbush(deltaTime);
      return;
    }
  }

  /**
   * Horror 3-4: Wander normally, but periodically stop and stare at the player
   * for 2-3 seconds before resuming.
   */
  private _updateCreepyStare(deltaTime: number): void {
    if (this._isStaring) {
      // Currently staring - count down the timer
      this._horrorBehaviorTimer -= deltaTime;

      // Face the player while staring by using follow then immediately idling
      // We set idle so the AI stands still, but we update the target
      // so the navigator's last rotation points toward the player.
      this.navigator.updateTarget(this._playerX, this._playerZ);

      if (this._horrorBehaviorTimer <= 0) {
        // Done staring, resume wandering
        this._isStaring = false;
        this._horrorBehaviorCooldown = 4 + Math.random() * 6; // 4-10s before next stare
        this.behavior.setState('wander');
      }
      return;
    }

    // Not currently staring - check if we should start
    if (this._horrorBehaviorCooldown <= 0 && this.behavior.getState() === 'wander') {
      // Initiate a stare
      this._isStaring = true;
      this._horrorBehaviorTimer = 2 + Math.random(); // 2-3 seconds

      // Switch to idle to stop movement, then face the player
      this.behavior.setState('idle');
      this.navigator.updateTarget(this._playerX, this._playerZ);
    }
  }

  /**
   * Horror 5-6: Follow the player with reduced distance and boosted speed.
   * followDistance effectively halved (2 instead of 4), speed 1.3x.
   */
  private _updateAggressiveFollow(): void {
    const aggressiveSpeed = this.config.maxSpeed * 1.3;
    this.navigator.setMaxSpeed(aggressiveSpeed);

    const pos = this.navigator.getPosition();
    const dx = this._playerX - pos.x;
    const dz = this._playerZ - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Aggressive follow threshold: half the normal follow distance
    const aggressiveFollowDist = this.config.followDistance / 2;

    if (dist < aggressiveFollowDist * 4 && this.behavior.getState() !== 'follow') {
      // Much wider detection range; quickly switch to follow
      this.behavior.setState('follow');
    }

    // Stay in follow mode unless the player is extremely far away
    if (this.behavior.getState() === 'follow' && dist > this.config.followDistance * 3) {
      this.behavior.setState('wander');
    }
  }

  /**
   * Horror 7-8: Stalker mode. Alternate between closely following the player
   * and sudden sprints toward them.
   */
  private _updateStalkerMode(deltaTime: number): void {
    const pos = this.navigator.getPosition();
    const dx = this._playerX - pos.x;
    const dz = this._playerZ - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (this._isSprinting) {
      // Sprint phase: move at 2.5x speed toward the player
      const sprintSpeed = this.config.maxSpeed * 2.5;
      this.navigator.setMaxSpeed(sprintSpeed);

      if (this.behavior.getState() !== 'follow') {
        this.behavior.setState('follow');
      }

      this._horrorBehaviorTimer -= deltaTime;

      // End sprint after timer expires or when very close to the player
      if (this._horrorBehaviorTimer <= 0 || dist < this.config.interactionDistance) {
        this._isSprinting = false;
        this._horrorBehaviorCooldown = 3 + Math.random() * 4; // 3-7s cooldown
        this.navigator.setMaxSpeed(this.config.maxSpeed * 1.3);
      }
      return;
    }

    // Stalk phase: follow closely at slightly boosted speed
    this.navigator.setMaxSpeed(this.config.maxSpeed * 1.3);

    if (dist < this.config.followDistance * 3 && this.behavior.getState() !== 'follow') {
      this.behavior.setState('follow');
    }

    // Check if it is time for a sprint burst
    if (this._horrorBehaviorCooldown <= 0 && dist > this.config.interactionDistance && dist < this.config.followDistance * 4) {
      this._isSprinting = true;
      this._horrorBehaviorTimer = 1 + Math.random() * 0.5; // 1-1.5 second sprint burst
    }
  }

  /**
   * Horror 9-10: Doorway ambush. Periodically teleport to a position
   * ahead of where the player is heading, then face the player.
   */
  private _updateDoorwayAmbush(deltaTime: number): void {
    const aggressiveSpeed = this.config.maxSpeed * 1.5;
    this.navigator.setMaxSpeed(aggressiveSpeed);

    const pos = this.navigator.getPosition();
    const dx = this._playerX - pos.x;
    const dz = this._playerZ - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Follow aggressively between ambushes
    if (dist < this.config.followDistance * 4 && this.behavior.getState() !== 'follow' && this.behavior.getState() !== 'idle') {
      this.behavior.setState('follow');
    }

    // Attempt an ambush teleport when off cooldown
    if (this._horrorBehaviorCooldown <= 0) {
      // Predict where the player will be in ~1.5 seconds
      const predictionTime = 1.5;
      let predictedX = this._playerX + this._playerVelocityX * predictionTime;
      let predictedZ = this._playerZ + this._playerVelocityZ * predictionTime;

      // Only ambush if the player is actually moving
      const playerSpeed = Math.sqrt(
        this._playerVelocityX * this._playerVelocityX +
        this._playerVelocityZ * this._playerVelocityZ
      );

      if (playerSpeed > 0.5 && dist > this.config.followDistance) {
        // Add a small random offset so the AI does not land exactly on the player
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDist = 1 + Math.random() * 1.5; // 1-2.5 units away from predicted point
        predictedX += Math.cos(offsetAngle) * offsetDist;
        predictedZ += Math.sin(offsetAngle) * offsetDist;

        // Teleport to the predicted position
        this.navigator.setPosition(predictedX, predictedZ);

        // Face the player after teleport
        this.behavior.setState('idle');
        this.navigator.updateTarget(this._playerX, this._playerZ);

        // Set a short idle so the AI "appears" menacingly before resuming
        this._horrorBehaviorCooldown = 5 + Math.random() * 5; // 5-10s between ambushes
        this._horrorBehaviorTimer = 0.8 + Math.random() * 0.4; // 0.8-1.2s freeze after teleport
      } else {
        // Player not moving fast enough; try again soon
        this._horrorBehaviorCooldown = 1 + Math.random() * 2;
      }
      return;
    }

    // If we just teleported, hold the idle pose briefly
    if (this._horrorBehaviorTimer > 0) {
      this._horrorBehaviorTimer -= deltaTime;
      if (this._horrorBehaviorTimer <= 0) {
        // Resume following after the menacing pause
        this.behavior.setState('follow');
      }
    }
  }

  // Main update loop - call this every frame
  update(deltaTime: number) {
    const oldState = this.behavior.getState();

    // Apply horror-level behavior adjustments before the standard AI update
    this._updateHorrorBehavior(deltaTime);

    // Update AI behavior with player position
    this.behavior.update(deltaTime, this._playerX, this._playerZ);

    // Check for state changes
    const newState = this.behavior.getState();
    if (oldState !== newState) {
      this.onStateChange?.(newState);
    }

    // Apply ground Y from layout so the AI follows elevation on stairs/ramps
    const pos = this.navigator.getPosition();
    if (this._getGroundY) {
      const y = this._getGroundY(pos.x, pos.z);
      this.navigator.setPosition(pos.x, pos.z, y);
    }

    // Notify position update
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
  onPositionUpdate: (x: number, z: number, rotation: number) => void,
  initialHorrorLevel: number = 0
): LlamaAI {
  const ai = new LlamaAI(startX, startZ, roomWidth, roomHeight);
  ai.setPositionCallback(onPositionUpdate);
  if (initialHorrorLevel > 0) {
    ai.setHorrorLevel(initialHorrorLevel);
  }
  return ai;
}
