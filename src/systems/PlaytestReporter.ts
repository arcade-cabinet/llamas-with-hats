/**
 * PlaytestReporter — Structured Telemetry for AI Playtesting
 * ============================================================
 *
 * Records structured snapshots during `?dev=ai` playtesting.
 *
 * Capture cadence:
 * - Periodic: every 2 seconds
 * - Event-driven: room transitions, goal completions, auto-heal
 *   triggers, AI state changes, quality drops below 0.3
 * - Debounced: minimum 0.5s between event-triggered captures
 *
 * Screenshot capture:
 * - Captures canvas screenshots at a configurable interval (default 5s)
 * - Also captures on event-driven triggers (room transition, quality drop)
 * - Screenshots stored as JPEG data URLs for compactness
 * - Downloadable as a zip or viewable in the console report
 *
 * Exportable as JSON via exportJSON(). Report printed to console
 * when playtest ends.
 */

import type { CameraMetrics } from './CameraIntelligence';
import type { AutoHealAdjustment } from './CameraAutoHeal';
import type { ObjectiveAIState } from './ObjectiveAI';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface AIThought {
  action: string;
  reason: string;
  nextAction: string;
}

export interface ScreenCapture {
  timestamp: number;
  elapsedMs: number;
  trigger: string;
  dataUrl: string;        // JPEG data URL
  qualityScore: number;
  roomId: string;
}

export interface PlaytestSnapshot {
  timestamp: number;
  elapsedMs: number;
  trigger: 'periodic' | 'room_transition' | 'goal_completion' | 'auto_heal' | 'ai_state_change' | 'quality_drop';
  scene: {
    roomId: string;
    stageName: string;
    horrorLevel: number;
  };
  ai: {
    player: AIThought;
    opponent: AIThought;
    playerState: ObjectiveAIState;
    opponentState: ObjectiveAIState;
  };
  camera: {
    qualityScore: number;
    occlusionPct: number;
    screenCoverage: number;
    isHealing: boolean;
    healReason: string;
    fov: number;
    orbitDistance: number;
  };
  fovObjects: Array<{
    name: string;
    category: string;
    distance: number;
    interactive: boolean;
  }>;
  performance: {
    fps: number;
    frameTime: number;
  };
  difficulty: {
    level: number;
  };
  goals: {
    playerCompleted: number;
    opponentCompleted: number;
    totalActive: number;
  };
  /** Index into the screenshots array, if a screenshot was captured with this snapshot */
  screenshotIndex?: number;
}

export interface PlaytestReport {
  sessionId: string;
  startTime: number;
  snapshots: PlaytestSnapshot[];
  screenshots: ScreenCapture[];
  summary: {
    totalDuration: number;
    averageQualityScore: number;
    occlusionEvents: number;
    autoHealEvents: number;
    goalsCompleted: number;
    roomsVisited: number;
    averageFps: number;
    screenshotsCaptured: number;
  };
}

export interface PlaytestReporterConfig {
  /** Interval between automatic screenshots in seconds. Default 5. */
  screenshotInterval?: number;
  /** JPEG quality for screenshots (0-1). Default 0.6 for compactness. */
  screenshotQuality?: number;
  /** Max screenshots to keep in memory. Default 200. */
  maxScreenshots?: number;
  /** Capture screenshots on event triggers too. Default true. */
  screenshotOnEvents?: boolean;
}

export interface PlaytestReporter {
  /** Update timing — call every frame. Handles periodic capture internally. */
  tick(deltaTime: number, fps: number): void;

  /** Provide the canvas element for screenshot capture. */
  setCanvas(canvas: HTMLCanvasElement): void;

  /** Set current scene context (updated on room change). */
  setSceneContext(roomId: string, stageName: string, horrorLevel: number): void;

  /** Set AI thought state (updated from ObjectiveAI). */
  setPlayerAIThought(thought: AIThought, state: ObjectiveAIState): void;
  setOpponentAIThought(thought: AIThought, state: ObjectiveAIState): void;

  /** Set current camera metrics (from CameraIntelligence). */
  setCameraMetrics(metrics: CameraMetrics): void;

  /** Set current auto-heal state (from CameraAutoHeal). */
  setAutoHealState(adj: AutoHealAdjustment): void;

  /** Set difficulty level. */
  setDifficulty(level: number): void;

  /** Set goal counts. */
  setGoalCounts(playerCompleted: number, opponentCompleted: number, totalActive: number): void;

  /** Trigger an event-driven snapshot. */
  triggerEvent(trigger: PlaytestSnapshot['trigger']): void;

  /** Export the full report as JSON string (screenshots as data URLs). */
  exportJSON(): string;

  /** Get the current report data. */
  getReport(): PlaytestReport;

  /** Get all captured screenshots. */
  getScreenshots(): ScreenCapture[];

  /** Download all screenshots as individual files (triggers browser download). */
  downloadScreenshots(): void;

  /** Print summary to console. */
  printSummary(): void;

  /** Get the latest snapshot (for UI display). */
  getLatestSnapshot(): PlaytestSnapshot | null;

  dispose(): void;
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createPlaytestReporter(config?: PlaytestReporterConfig): PlaytestReporter {
  const sessionId = `playtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = performance.now();
  const snapshots: PlaytestSnapshot[] = [];
  const screenshots: ScreenCapture[] = [];

  const PERIODIC_INTERVAL = 2.0; // seconds
  const EVENT_DEBOUNCE = 0.5;    // minimum seconds between event captures
  const SCREENSHOT_INTERVAL = config?.screenshotInterval ?? 5.0;
  const SCREENSHOT_QUALITY = config?.screenshotQuality ?? 0.6;
  const MAX_SCREENSHOTS = config?.maxScreenshots ?? 200;
  const SCREENSHOT_ON_EVENTS = config?.screenshotOnEvents ?? true;

  let periodicTimer = 0;
  let screenshotTimer = 0;
  let lastEventTime = 0;
  let elapsed = 0;

  // Canvas reference for screenshot capture
  let canvas: HTMLCanvasElement | null = null;

  // Current state — updated externally via setters
  let sceneContext = { roomId: '', stageName: '', horrorLevel: 0 };
  let playerAI: AIThought = { action: '', reason: '', nextAction: '' };
  let opponentAI: AIThought = { action: '', reason: '', nextAction: '' };
  let playerAIState: ObjectiveAIState = 'planning';
  let opponentAIState: ObjectiveAIState = 'planning';
  let cameraMetrics: CameraMetrics | null = null;
  let autoHealState: AutoHealAdjustment | null = null;
  let difficultyLevel = 0;
  let goalCounts = { playerCompleted: 0, opponentCompleted: 0, totalActive: 0 };
  let currentFps = 60;
  let currentFrameTime = 16.67;

  // Tracking for summary
  const roomsVisited = new Set<string>();
  let occlusionEventCount = 0;
  let autoHealEventCount = 0;
  let qualityScoreSum = 0;
  let qualityScoreCount = 0;
  let fpsSum = 0;
  let fpsCount = 0;

  /** Capture a screenshot from the canvas. */
  function captureScreenshot(trigger: string): number | undefined {
    if (!canvas || screenshots.length >= MAX_SCREENSHOTS) return undefined;

    try {
      // Use toDataURL on the WebGL canvas — Babylon.js preserves drawing buffer
      const dataUrl = canvas.toDataURL('image/jpeg', SCREENSHOT_QUALITY);

      const capture: ScreenCapture = {
        timestamp: performance.now(),
        elapsedMs: elapsed * 1000,
        trigger,
        dataUrl,
        qualityScore: cameraMetrics?.qualityScore ?? 0,
        roomId: sceneContext.roomId,
      };

      const idx = screenshots.length;
      screenshots.push(capture);
      return idx;
    } catch {
      // Canvas tainted or other security issue — skip silently
      return undefined;
    }
  }

  function captureSnapshot(trigger: PlaytestSnapshot['trigger']): PlaytestSnapshot {
    const snapshot: PlaytestSnapshot = {
      timestamp: performance.now(),
      elapsedMs: elapsed * 1000,
      trigger,
      scene: { ...sceneContext },
      ai: {
        player: { ...playerAI },
        opponent: { ...opponentAI },
        playerState: playerAIState,
        opponentState: opponentAIState,
      },
      camera: {
        qualityScore: cameraMetrics?.qualityScore ?? 0,
        occlusionPct: cameraMetrics?.playerVisibility.occlusionPct ?? 0,
        screenCoverage: cameraMetrics?.playerVisibility.screenCoverage ?? 0,
        isHealing: autoHealState?.isHealing ?? false,
        healReason: autoHealState?.healReason ?? 'none',
        fov: cameraMetrics?.fov ?? 0,
        orbitDistance: cameraMetrics?.orbitDistance ?? 0,
      },
      fovObjects: (cameraMetrics?.objectsInFOV ?? []).slice(0, 10).map(o => ({
        name: o.meshName,
        category: o.category,
        distance: o.distance,
        interactive: o.interactive,
      })),
      performance: {
        fps: currentFps,
        frameTime: currentFrameTime,
      },
      difficulty: {
        level: difficultyLevel,
      },
      goals: { ...goalCounts },
    };

    snapshots.push(snapshot);

    // Track summary stats
    roomsVisited.add(sceneContext.roomId);
    if (cameraMetrics) {
      qualityScoreSum += cameraMetrics.qualityScore;
      qualityScoreCount++;
      if (cameraMetrics.playerVisibility.occlusionPct > 0.4) {
        occlusionEventCount++;
      }
    }
    if (autoHealState?.isHealing) {
      autoHealEventCount++;
    }
    fpsSum += currentFps;
    fpsCount++;

    return snapshot;
  }

  return {
    tick(deltaTime: number, fps: number) {
      elapsed += deltaTime;
      currentFps = fps;
      currentFrameTime = deltaTime * 1000;

      // Periodic capture
      periodicTimer += deltaTime;
      if (periodicTimer >= PERIODIC_INTERVAL) {
        periodicTimer = 0;
        captureSnapshot('periodic');
      }

      // Periodic screenshot capture (separate, longer interval)
      screenshotTimer += deltaTime;
      if (screenshotTimer >= SCREENSHOT_INTERVAL) {
        screenshotTimer = 0;
        const ssIdx = captureScreenshot('periodic');
        // Link to most recent snapshot if timing aligns
        if (ssIdx !== undefined && snapshots.length > 0) {
          snapshots[snapshots.length - 1].screenshotIndex = ssIdx;
        }
      }

      // Auto-detect quality drops
      if (cameraMetrics && cameraMetrics.qualityScore < 0.3) {
        const now = elapsed;
        if (now - lastEventTime >= EVENT_DEBOUNCE) {
          lastEventTime = now;
          const snap = captureSnapshot('quality_drop');
          // Screenshot on quality drops — very useful for debugging
          if (SCREENSHOT_ON_EVENTS) {
            const ssIdx = captureScreenshot('quality_drop');
            if (ssIdx !== undefined) {
              snap.screenshotIndex = ssIdx;
            }
          }
        }
      }
    },

    setCanvas(c: HTMLCanvasElement) {
      canvas = c;
    },

    setSceneContext(roomId: string, stageName: string, horrorLevel: number) {
      sceneContext = { roomId, stageName, horrorLevel };
    },

    setPlayerAIThought(thought: AIThought, state: ObjectiveAIState) {
      playerAI = thought;
      playerAIState = state;
    },

    setOpponentAIThought(thought: AIThought, state: ObjectiveAIState) {
      opponentAI = thought;
      opponentAIState = state;
    },

    setCameraMetrics(metrics: CameraMetrics) {
      cameraMetrics = metrics;
    },

    setAutoHealState(adj: AutoHealAdjustment) {
      autoHealState = adj;
    },

    setDifficulty(level: number) {
      difficultyLevel = level;
    },

    setGoalCounts(playerCompleted: number, opponentCompleted: number, totalActive: number) {
      goalCounts = { playerCompleted, opponentCompleted, totalActive };
    },

    triggerEvent(trigger: PlaytestSnapshot['trigger']) {
      const now = elapsed;
      if (now - lastEventTime < EVENT_DEBOUNCE) return;
      lastEventTime = now;
      const snap = captureSnapshot(trigger);

      // Capture screenshot on event-driven triggers
      if (SCREENSHOT_ON_EVENTS) {
        const ssIdx = captureScreenshot(trigger);
        if (ssIdx !== undefined) {
          snap.screenshotIndex = ssIdx;
        }
      }
    },

    exportJSON(): string {
      // Export without screenshot data URLs to keep JSON manageable
      const report = this.getReport();
      const lightReport = {
        ...report,
        screenshots: report.screenshots.map(s => ({
          ...s,
          dataUrl: `[${s.dataUrl.length} bytes]`, // Replace data URL with size indicator
        })),
      };
      return JSON.stringify(lightReport, null, 2);
    },

    getReport(): PlaytestReport {
      const totalDuration = elapsed;
      return {
        sessionId,
        startTime,
        snapshots: [...snapshots],
        screenshots: [...screenshots],
        summary: {
          totalDuration,
          averageQualityScore: qualityScoreCount > 0 ? qualityScoreSum / qualityScoreCount : 0,
          occlusionEvents: occlusionEventCount,
          autoHealEvents: autoHealEventCount,
          goalsCompleted: goalCounts.playerCompleted + goalCounts.opponentCompleted,
          roomsVisited: roomsVisited.size,
          averageFps: fpsCount > 0 ? fpsSum / fpsCount : 0,
          screenshotsCaptured: screenshots.length,
        },
      };
    },

    getScreenshots(): ScreenCapture[] {
      return [...screenshots];
    },

    downloadScreenshots() {
      if (screenshots.length === 0) {
        console.log('[PlaytestReporter] No screenshots to download');
        return;
      }

      // Download each screenshot as a separate file
      for (let i = 0; i < screenshots.length; i++) {
        const ss = screenshots[i];
        const secs = (ss.elapsedMs / 1000).toFixed(1);
        const filename = `playtest_${sessionId}_${i.toString().padStart(3, '0')}_${secs}s_q${(ss.qualityScore * 100).toFixed(0)}_${ss.trigger}.jpg`;

        const link = document.createElement('a');
        link.href = ss.dataUrl;
        link.download = filename;
        link.click();

        // Stagger downloads to avoid browser throttling
        if (i < screenshots.length - 1) {
          // Small delay between downloads handled by browser queue
        }
      }

      console.log(`[PlaytestReporter] Downloading ${screenshots.length} screenshots`);
    },

    printSummary() {
      const report = this.getReport();
      const s = report.summary;
      console.log(
        `%c[PlaytestReporter] Session ${sessionId} — ${s.totalDuration.toFixed(1)}s`,
        'color: #00bcd4; font-weight: bold'
      );
      console.log(`  Quality: avg ${(s.averageQualityScore * 100).toFixed(0)}%`);
      console.log(`  Occlusion events: ${s.occlusionEvents}`);
      console.log(`  Auto-heal events: ${s.autoHealEvents}`);
      console.log(`  Goals completed: ${s.goalsCompleted}`);
      console.log(`  Rooms visited: ${s.roomsVisited}`);
      console.log(`  Average FPS: ${s.averageFps.toFixed(0)}`);
      console.log(`  Screenshots: ${s.screenshotsCaptured}`);
      console.log(`  Snapshots: ${report.snapshots.length}`);

      // Log screenshots as thumbnails in the console
      if (screenshots.length > 0) {
        console.log(`%c[PlaytestReporter] Screenshots:`, 'color: #00bcd4; font-weight: bold');
        for (let i = 0; i < Math.min(screenshots.length, 20); i++) {
          const ss = screenshots[i];
          const secs = (ss.elapsedMs / 1000).toFixed(1);
          console.log(
            `%c  [${i}] ${secs}s — ${ss.trigger} — quality: ${(ss.qualityScore * 100).toFixed(0)}% — room: ${ss.roomId}`,
            'color: #888'
          );
          // Log the image itself — browsers render data URLs in console
          console.log(
            '%c ',
            `font-size:1px; padding:60px 100px; background: url(${ss.dataUrl}) no-repeat center/contain;`
          );
        }
        if (screenshots.length > 20) {
          console.log(`  ... and ${screenshots.length - 20} more`);
        }
      }

      console.log(`%cFull report (without screenshots):`, 'color: #00bcd4');
      console.log(this.exportJSON());
    },

    getLatestSnapshot(): PlaytestSnapshot | null {
      return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    },

    dispose() {
      this.printSummary();
    },
  };
}
