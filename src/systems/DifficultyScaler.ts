/**
 * DifficultyScaler — Adaptive AI Difficulty
 * ==========================================
 *
 * Tracks player performance metrics and adjusts AI parameters so the
 * opponent provides a challenging but fair experience.
 *
 * ## Metrics Tracked
 *
 * - **Goal completion time**: How quickly the player finishes objectives
 * - **Idle time ratio**: Fraction of time the player isn't moving
 * - **Room transition efficiency**: Rooms visited vs optimal path length
 *
 * ## Output Tuning
 *
 * - `speedMultiplier` — AI movement speed (0.5x easy to 1.5x hard)
 * - `planningDelay` — Seconds AI deliberates before acting (2s easy to 0.3s hard)
 * - `pathfindingAccuracy` — 1.0 = optimal paths, 0.5 = intentional detours
 *
 * ## Usage
 *
 * ```ts
 * const scaler = createDifficultyScaler();
 * // Each frame:
 * scaler.trackFrame(deltaTime, playerIsMoving);
 * // When player completes a goal:
 * scaler.onGoalCompleted(goalId, elapsedSeconds);
 * // Read tuning:
 * const tuning = scaler.getTuning();
 * objectiveAI.setSpeedMultiplier(tuning.speedMultiplier);
 * ```
 */

// ============================================
// Types
// ============================================

export interface DifficultyTuning {
  /** AI movement speed multiplier (0.5 = half speed, 1.5 = fast) */
  speedMultiplier: number;
  /** Seconds AI waits before planning next move */
  planningDelay: number;
  /** 1.0 = always optimal path, 0.5 = takes detours */
  pathfindingAccuracy: number;
}

export interface DifficultyScaler {
  /** Call each frame with delta time and whether player is moving */
  trackFrame(deltaTime: number, playerIsMoving: boolean): void;

  /** Notify when a goal becomes active (starts the timer) */
  onGoalActivated(goalId: string): void;

  /** Notify when a goal is completed (measures time since activation) */
  onGoalCompleted(goalId: string): void;

  /** Notify when player transitions between rooms */
  onRoomTransition(): void;

  /** Get current AI tuning parameters */
  getTuning(): DifficultyTuning;

  /** Get the current difficulty level (0-1, where 0 = easiest, 1 = hardest) */
  getDifficultyLevel(): number;

  /** Reset all metrics */
  reset(): void;
}

// ============================================
// Configuration
// ============================================

export interface DifficultyConfig {
  /** Sliding window size for averaging goal times (default: 5) */
  metricWindow: number;
  /** How quickly difficulty adjusts, 0-1 (default: 0.15) */
  adaptationRate: number;
  /** Minimum difficulty floor (default: 0.1) */
  minDifficulty: number;
  /** Maximum difficulty ceiling (default: 0.95) */
  maxDifficulty: number;
  /** Baseline expected goal time in seconds (default: 30) */
  expectedGoalTime: number;
  /** Baseline expected idle ratio (default: 0.3) */
  expectedIdleRatio: number;
  /** Seconds between difficulty evaluations (default: 10) */
  evalInterval: number;
}

const DEFAULT_CONFIG: DifficultyConfig = {
  metricWindow: 5,
  adaptationRate: 0.15,
  minDifficulty: 0.1,
  maxDifficulty: 0.95,
  expectedGoalTime: 30,
  expectedIdleRatio: 0.3,
  evalInterval: 10,
};

// ============================================
// Implementation
// ============================================

export function createDifficultyScaler(
  initialDifficulty = 0.5,
  configOverrides?: Partial<DifficultyConfig>,
): DifficultyScaler {
  const cfg = { ...DEFAULT_CONFIG, ...configOverrides };
  let difficulty = initialDifficulty;

  // Metric tracking
  let totalTime = 0;
  let idleTime = 0;
  let roomTransitions = 0;
  const goalTimes: number[] = []; // last N goal completion times
  const goalActivationTimes = new Map<string, number>(); // goalId -> activation timestamp

  // Per-evaluation window
  let windowTime = 0;
  let windowIdleTime = 0;

  /**
   * Map difficulty (0-1) to tuning parameters.
   */
  function computeTuning(d: number): DifficultyTuning {
    return {
      // Speed: 0.5 at d=0, 1.0 at d=0.5, 1.5 at d=1
      speedMultiplier: 0.5 + d,
      // Planning delay: 2.0s at d=0, 0.5s at d=0.5, 0.2s at d=1
      planningDelay: 2.0 - 1.8 * d,
      // Pathfinding accuracy: 0.5 at d=0, 1.0 at d=0.7+
      pathfindingAccuracy: Math.min(1.0, 0.5 + d * 0.7),
    };
  }

  /**
   * Evaluate recent performance and adjust difficulty.
   */
  function evaluate(): void {
    let pressureUp = 0;
    let pressureDown = 0;

    // Factor 1: Goal completion speed
    if (goalTimes.length > 0) {
      const avgTime = goalTimes.reduce((a, b) => a + b, 0) / goalTimes.length;
      if (avgTime < cfg.expectedGoalTime * 0.6) {
        // Player is fast — increase difficulty
        pressureUp += 0.3;
      } else if (avgTime > cfg.expectedGoalTime * 1.5) {
        // Player is slow — decrease difficulty
        pressureDown += 0.3;
      }
    }

    // Factor 2: Idle ratio
    const idleRatio = windowTime > 0 ? windowIdleTime / windowTime : 0;
    if (idleRatio > cfg.expectedIdleRatio * 1.5) {
      // Player is idle a lot — they might be stuck
      pressureDown += 0.2;
    } else if (idleRatio < cfg.expectedIdleRatio * 0.5) {
      // Player is very active
      pressureUp += 0.1;
    }

    // Factor 3: Room transition rate (activity indicator)
    const transitionRate = windowTime > 0 ? roomTransitions / (windowTime / 60) : 0;
    if (transitionRate > 4) {
      // Moving between rooms very quickly
      pressureUp += 0.1;
    } else if (transitionRate < 1 && totalTime > 30) {
      // Barely moving between rooms
      pressureDown += 0.1;
    }

    // Apply pressure
    const netPressure = pressureUp - pressureDown;
    difficulty += netPressure * cfg.adaptationRate;
    difficulty = Math.max(cfg.minDifficulty, Math.min(cfg.maxDifficulty, difficulty));

    // Reset window
    windowTime = 0;
    windowIdleTime = 0;
    roomTransitions = 0;
  }

  return {
    trackFrame(deltaTime: number, playerIsMoving: boolean) {
      totalTime += deltaTime;
      windowTime += deltaTime;

      if (!playerIsMoving) {
        idleTime += deltaTime;
        windowIdleTime += deltaTime;
      }

      // Periodic evaluation
      if (windowTime >= cfg.evalInterval) {
        evaluate();
      }
    },

    onGoalActivated(goalId: string) {
      goalActivationTimes.set(goalId, totalTime);
    },

    onGoalCompleted(goalId: string) {
      const activatedAt = goalActivationTimes.get(goalId);
      const elapsed = activatedAt !== undefined ? totalTime - activatedAt : cfg.expectedGoalTime;
      goalActivationTimes.delete(goalId);
      goalTimes.push(elapsed);
      // Keep only last N
      while (goalTimes.length > cfg.metricWindow) {
        goalTimes.shift();
      }
    },

    onRoomTransition() {
      roomTransitions++;
    },

    getTuning(): DifficultyTuning {
      return computeTuning(difficulty);
    },

    getDifficultyLevel(): number {
      return difficulty;
    },

    reset() {
      difficulty = initialDifficulty;
      totalTime = 0;
      idleTime = 0;
      roomTransitions = 0;
      goalTimes.length = 0;
      goalActivationTimes.clear();
      windowTime = 0;
      windowIdleTime = 0;
    },
  };
}
