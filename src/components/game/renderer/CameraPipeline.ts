/**
 * Camera pipeline — CameraIntelligence measurement, CameraAutoHeal adjustment,
 * and PlaytestReporter telemetry, bundled into a single lifecycle.
 */
import type { Scene, Engine } from '@babylonjs/core';
import type { TransformNode } from '@babylonjs/core';
import type { GameCamera } from '../../../systems/Camera';
import {
  createCameraIntelligence,
  CameraIntelligence,
  CameraMetrics,
} from '../../../systems/CameraIntelligence';
import {
  createCameraAutoHeal,
  CameraAutoHeal,
} from '../../../systems/CameraAutoHeal';
import {
  createPlaytestReporter,
  PlaytestReporter,
} from '../../../systems/PlaytestReporter';
import type { CameraTelemetry } from './types';

export interface CameraPipeline {
  /**
   * Attempt lazy initialization once both character roots and camera exist.
   * Safe to call every frame — no-ops after first successful init.
   */
  initIfReady(
    gameCamera: GameCamera,
    playerRoot: TransformNode,
    opponentRoot: TransformNode,
  ): void;

  /** Per-frame measurement, auto-heal, telemetry write. */
  update(
    dt: number,
    engine: Engine,
    gameCamera: GameCamera,
    cameraTelemetryRef: React.MutableRefObject<CameraTelemetry | null> | undefined,
  ): void;

  getPlaytestReporter(): PlaytestReporter | null;
  isInitialized(): boolean;
  dispose(): void;
}

export function createCameraPipeline(
  scene: Scene,
  devAIEnabled: boolean,
  canvas: HTMLCanvasElement | null,
): CameraPipeline {
  let intelligence: CameraIntelligence | null = null;
  let autoHeal: CameraAutoHeal | null = null;
  let reporter: PlaytestReporter | null = null;

  return {
    initIfReady(gameCamera, playerRoot, opponentRoot) {
      if (intelligence) return; // Already initialized
      try {
        intelligence = createCameraIntelligence(scene, gameCamera, playerRoot, opponentRoot);
        autoHeal = createCameraAutoHeal();
        if (devAIEnabled) {
          reporter = createPlaytestReporter();
          if (canvas) {
            reporter.setCanvas(canvas);
          }
        }
      } catch (err) {
        console.error('[CameraPipeline] Failed to init:', err);
      }
    },

    update(dt, engine, gameCamera, cameraTelemetryRef) {
      // Measure camera metrics (throttled internally to every 6 frames)
      let metrics: CameraMetrics | null = null;
      if (intelligence) {
        metrics = intelligence.measure();
      }

      // Evaluate auto-heal and apply adjustment
      if (autoHeal && metrics && gameCamera) {
        const adj = autoHeal.evaluate(metrics, dt);
        gameCamera.setAutoHealAdjustment(adj);
        autoHeal.applyMeshFading(adj.fadeMeshes);

        // Update playtest reporter
        if (reporter) {
          const fps = engine.getFps();
          reporter.setCameraMetrics(metrics);
          reporter.setAutoHealState(adj);
          reporter.tick(dt, fps);
          if (adj.isHealing && adj.healReason !== 'none') {
            reporter.triggerEvent('auto_heal');
          }
        }

        // Write telemetry to ref for React overlay
        if (cameraTelemetryRef) {
          cameraTelemetryRef.current = {
            qualityScore: metrics.qualityScore,
            occlusionPct: metrics.playerVisibility.occlusionPct,
            screenCoverage: metrics.playerVisibility.screenCoverage,
            isHealing: adj.isHealing,
            healReason: adj.healReason,
            fovObjectCount: metrics.objectsInFOV.length,
            fps: engine.getFps(),
            playerAIAction: '',
            playerAIReason: '',
            playerAINext: '',
            opponentAIAction: '',
            opponentAIReason: '',
            opponentAINext: '',
          };
        }
      } else if (metrics && cameraTelemetryRef) {
        // Basic telemetry before auto-heal is ready
        cameraTelemetryRef.current = {
          qualityScore: metrics.qualityScore,
          occlusionPct: metrics.playerVisibility.occlusionPct,
          screenCoverage: metrics.playerVisibility.screenCoverage,
          isHealing: false,
          healReason: 'none',
          fovObjectCount: metrics.objectsInFOV.length,
          fps: engine.getFps(),
          playerAIAction: '',
          playerAIReason: '',
          playerAINext: '',
          opponentAIAction: '',
          opponentAIReason: '',
          opponentAINext: '',
        };
      }
    },

    getPlaytestReporter() {
      return reporter;
    },

    isInitialized() {
      return intelligence !== null;
    },

    dispose() {
      intelligence?.dispose();
      intelligence = null;
      autoHeal?.dispose();
      autoHeal = null;
      reporter?.dispose();
      reporter = null;
    },
  };
}
