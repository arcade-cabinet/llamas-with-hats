/**
 * CameraAutoHeal — Adaptive Camera Adjustment
 * =============================================
 *
 * Consumes CameraMetrics from CameraIntelligence and produces
 * smoothed adjustments applied to the camera. Extends existing
 * wall collision — never overrides it.
 *
 * Healing triggers (priority order):
 * 1. Character off-screen → raise camera, pull closer, widen FOV
 * 2. Occlusion > 40% → raise, pull closer, widen FOV, fade meshes
 * 3. Quality < 0.5 → gentle raise
 *
 * All values interpolate toward target at healRate and decay back
 * to zero at decayRate. No sudden jumps.
 */

import { AbstractMesh } from '@babylonjs/core';
import type { CameraMetrics } from './CameraIntelligence';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface AutoHealAdjustment {
  heightDelta: number;        // raise camera (positive = up)
  distanceDelta: number;      // pull closer (negative = closer)
  fovDelta: number;           // widen FOV (positive = wider)
  fadeMeshes: AbstractMesh[]; // meshes to make transparent
  isHealing: boolean;
  healReason: 'occlusion' | 'offscreen' | 'zoom' | 'quality' | 'none';
}

export interface CameraAutoHeal {
  /** Evaluate metrics and produce an adjustment. Call once per frame. */
  evaluate(metrics: CameraMetrics, deltaTime: number): AutoHealAdjustment;
  /** Apply mesh fading (call after evaluate). Returns meshes that were faded. */
  applyMeshFading(fadeMeshes: AbstractMesh[]): void;
  /** Restore all faded meshes. Call on dispose. */
  restoreAllMeshes(): void;
  dispose(): void;
}

export interface CameraAutoHealConfig {
  /** Rate at which healing adjustments ramp up (units/s). Default 0.8 */
  healRate?: number;
  /** Rate at which adjustments decay back to zero (units/s). Default 1.5 */
  decayRate?: number;
  /** Occlusion threshold to trigger healing (0-1). Default 0.4 */
  occlusionThreshold?: number;
  /** Quality threshold to trigger healing (0-1). Default 0.5 */
  qualityThreshold?: number;
  /** Alpha for faded meshes. Default 0.3 */
  fadeAlpha?: number;
  /** Rate at which mesh alpha restores (0-1 lerp per frame). Default 0.1 */
  fadeRestoreRate?: number;
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createCameraAutoHeal(config?: CameraAutoHealConfig): CameraAutoHeal {
  const healRate = config?.healRate ?? 0.8;
  const decayRate = config?.decayRate ?? 1.5;
  const occlusionThreshold = config?.occlusionThreshold ?? 0.4;
  const qualityThreshold = config?.qualityThreshold ?? 0.5;
  const fadeAlpha = config?.fadeAlpha ?? 0.3;
  const fadeRestoreRate = config?.fadeRestoreRate ?? 0.1;

  // Current smoothed values
  let currentHeight = 0;
  let currentDistance = 0;
  let currentFov = 0;

  // Target values
  let targetHeight = 0;
  let targetDistance = 0;
  let targetFov = 0;

  // Track faded meshes and their original alpha
  const fadedMeshes = new Map<string, { mesh: AbstractMesh; originalAlpha: number; originalTransparency: number }>();

  /** Smoothly interpolate a value toward a target. */
  function approach(current: number, target: number, rate: number, dt: number): number {
    const diff = target - current;
    if (Math.abs(diff) < 0.001) return target;
    return current + diff * Math.min(1, rate * dt);
  }

  return {
    evaluate(metrics: CameraMetrics, deltaTime: number): AutoHealAdjustment {
      const playerVis = metrics.playerVisibility;
      let healReason: AutoHealAdjustment['healReason'] = 'none';
      const fadeMeshes: AbstractMesh[] = [];

      // Reset targets — decay toward zero unless a condition sets them
      targetHeight = 0;
      targetDistance = 0;
      targetFov = 0;

      // Priority 1: Character off-screen
      if (!playerVis.inFrustum && playerVis.distance < 20) {
        targetHeight = 0.8;
        targetDistance = -2.0;
        targetFov = 0.2;
        healReason = 'offscreen';
      }
      // Priority 2: High occlusion
      else if (playerVis.occlusionPct > occlusionThreshold) {
        const urgency = (playerVis.occlusionPct - occlusionThreshold) / (1 - occlusionThreshold);
        targetHeight = 0.8 * urgency;
        targetDistance = -1.0 * urgency;
        targetFov = 0.06 * urgency;
        healReason = 'occlusion';

        // Collect occluding meshes for fading
        for (const mesh of playerVis.occludingMeshes) {
          if (!mesh.isDisposed()) {
            fadeMeshes.push(mesh);
          }
        }
      }
      // Priority 3: Low quality
      else if (metrics.qualityScore < qualityThreshold) {
        const urgency = (qualityThreshold - metrics.qualityScore) / qualityThreshold;
        targetHeight = 0.24 * urgency;
        healReason = 'quality';
      }

      // Smoothly approach targets (heal) or decay toward zero
      const isHealing = healReason !== 'none';
      const rate = isHealing ? healRate : decayRate;

      currentHeight = approach(currentHeight, targetHeight, rate, deltaTime);
      currentDistance = approach(currentDistance, targetDistance, rate, deltaTime);
      currentFov = approach(currentFov, targetFov, rate, deltaTime);

      return {
        heightDelta: currentHeight,
        distanceDelta: currentDistance,
        fovDelta: currentFov,
        fadeMeshes,
        isHealing,
        healReason,
      };
    },

    applyMeshFading(meshesToFade: AbstractMesh[]) {
      // Track which meshes should currently be faded
      const activeFadeIds = new Set<string>();

      for (const mesh of meshesToFade) {
        if (mesh.isDisposed()) continue;
        const id = mesh.uniqueId.toString();
        activeFadeIds.add(id);

        if (!fadedMeshes.has(id)) {
          // Record original state
          const mat = mesh.material;
          fadedMeshes.set(id, {
            mesh,
            originalAlpha: mat?.alpha ?? 1,
            originalTransparency: mat?.transparencyMode ?? 0,
          });
        }

        // Apply fade
        const mat = mesh.material;
        if (mat) {
          mat.transparencyMode = 2; // ALPHA_BLEND
          mat.alpha = Math.max(fadeAlpha, mat.alpha - 0.05); // Smooth fade down
          if (mat.alpha > fadeAlpha + 0.01) {
            mat.alpha = mat.alpha * 0.9 + fadeAlpha * 0.1; // Lerp to target
          }
        }
      }

      // Restore meshes that are no longer occluding
      for (const [id, record] of fadedMeshes) {
        if (activeFadeIds.has(id)) continue;
        if (record.mesh.isDisposed()) {
          fadedMeshes.delete(id);
          continue;
        }

        const mat = record.mesh.material;
        if (mat) {
          mat.alpha = mat.alpha * (1 - fadeRestoreRate) + record.originalAlpha * fadeRestoreRate;
          if (Math.abs(mat.alpha - record.originalAlpha) < 0.02) {
            mat.alpha = record.originalAlpha;
            mat.transparencyMode = record.originalTransparency;
            fadedMeshes.delete(id);
          }
        } else {
          fadedMeshes.delete(id);
        }
      }
    },

    restoreAllMeshes() {
      for (const [, record] of fadedMeshes) {
        if (record.mesh.isDisposed()) continue;
        const mat = record.mesh.material;
        if (mat) {
          mat.alpha = record.originalAlpha;
          mat.transparencyMode = record.originalTransparency;
        }
      }
      fadedMeshes.clear();
    },

    dispose() {
      this.restoreAllMeshes();
    },
  };
}
