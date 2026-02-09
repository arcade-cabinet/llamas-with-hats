/**
 * CameraIntelligence — Camera Quality Measurement System
 * ========================================================
 *
 * Pure measurement layer that reads scene state and produces a
 * CameraMetrics snapshot every 6 frames (~10 Hz at 60 fps).
 *
 * Measures:
 * - Character visibility (frustum + screen coverage)
 * - Occlusion via ray casts from camera to character anchor points
 * - Objects currently in the camera frustum
 * - Composite quality score (0-1)
 *
 * No side effects — only reads scene state.
 */

import {
  Scene,
  Vector3,
  Ray,
  AbstractMesh,
  Frustum,
  TransformNode,
} from '@babylonjs/core';
import type { GameCamera } from './Camera';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface CharacterVisibility {
  inFrustum: boolean;
  screenRect: { left: number; top: number; right: number; bottom: number } | null;
  screenCoverage: number;    // 0-1 fraction of viewport
  occlusionPct: number;      // 0 = fully visible, 1 = fully hidden
  distance: number;          // world units from camera
  occludingMeshes: AbstractMesh[];
}

export interface FOVObject {
  meshName: string;
  category: string;          // 'wall'|'floor'|'prop'|'character'|propType
  distance: number;
  screenCenter: { x: number; y: number };
  interactive: boolean;
}

export interface CameraMetrics {
  timestamp: number;
  playerVisibility: CharacterVisibility;
  opponentVisibility: CharacterVisibility;
  fov: number;
  orbitDistance: number;
  isWallClipped: boolean;
  clipAmount: number;
  objectsInFOV: FOVObject[];
  qualityScore: number;       // 0-1 composite
  qualityBreakdown: {
    playerVisible: number;     // 0-1
    playerCentered: number;    // 0-1
    playerNotOccluded: number; // 0-1
    zoomAppropriate: number;   // 0-1
  };
}

export interface CameraIntelligence {
  /** Measure camera metrics. Returns cached result on non-measurement frames. */
  measure(): CameraMetrics;
  /** Force a fresh measurement regardless of throttle. */
  measureForced(): CameraMetrics;
  /** Get last measured metrics without triggering a new measurement. */
  getLastMetrics(): CameraMetrics;
  dispose(): void;
}

export interface CameraIntelligenceConfig {
  /** Measure every N frames (default 6 = ~10Hz at 60fps) */
  measureInterval?: number;
  /** Max FOV objects to enumerate (default 32) */
  maxFovObjects?: number;
}

// ─────────────────────────────────────────────────────────────────
// Body sample points — offsets from character root for projection
// ─────────────────────────────────────────────────────────────────

const BODY_SAMPLE_OFFSETS: Vector3[] = [
  new Vector3(0, 1.6, 0),    // head
  new Vector3(0, 1.2, 0),    // chest
  new Vector3(0, 0.8, 0),    // hips
  new Vector3(-0.2, 1.3, 0), // left shoulder
  new Vector3(0.2, 1.3, 0),  // right shoulder
  new Vector3(-0.15, 0.1, 0), // left foot edge
  new Vector3(0.15, 0.1, 0),  // right foot edge
  new Vector3(0, 0.4, 0),    // knees
];

/** Anchor points for occlusion ray casts (subset of body samples) */
const OCCLUSION_ANCHORS: Vector3[] = [
  new Vector3(0, 1.6, 0),    // head
  new Vector3(0, 1.2, 0),    // chest
  new Vector3(0, 0.8, 0),    // hips
  new Vector3(-0.2, 1.3, 0), // left shoulder
  new Vector3(0.2, 1.3, 0),  // right shoulder
];

// ─────────────────────────────────────────────────────────────────
// Default empty metrics
// ─────────────────────────────────────────────────────────────────

function emptyVisibility(): CharacterVisibility {
  return {
    inFrustum: false,
    screenRect: null,
    screenCoverage: 0,
    occlusionPct: 1,
    distance: Infinity,
    occludingMeshes: [],
  };
}

function emptyMetrics(): CameraMetrics {
  return {
    timestamp: 0,
    playerVisibility: emptyVisibility(),
    opponentVisibility: emptyVisibility(),
    fov: 0,
    orbitDistance: 0,
    isWallClipped: false,
    clipAmount: 0,
    objectsInFOV: [],
    qualityScore: 0,
    qualityBreakdown: {
      playerVisible: 0,
      playerCentered: 0,
      playerNotOccluded: 0,
      zoomAppropriate: 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function categorizeMesh(mesh: AbstractMesh): string {
  const name = mesh.name.toLowerCase();
  if (name.includes('floor') || name.includes('ground') || name.includes('rug')) return 'floor';
  if (name.includes('wall') || name.includes('ceiling')) return 'wall';
  if (name.includes('carl') || name.includes('paul') || name.includes('llama')) return 'character';
  if (mesh.metadata?.propType) return mesh.metadata.propType;
  return 'prop';
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createCameraIntelligence(
  scene: Scene,
  gameCamera: GameCamera,
  playerRoot: TransformNode,
  opponentRoot: TransformNode,
  config?: CameraIntelligenceConfig,
): CameraIntelligence {
  const measureInterval = config?.measureInterval ?? 6;
  const maxFovObjects = config?.maxFovObjects ?? 32;

  let frameCounter = 0;
  let cached: CameraMetrics = emptyMetrics();

  // Reusable vectors to avoid GC pressure
  const _tmpWorldPos = new Vector3();
  const _tmpRayDir = new Vector3();
  const _frustumPlanes: import('@babylonjs/core').Plane[] = [];

  /** Collect all meshes that belong to a character root (for exclusion predicates). */
  function getCharacterMeshes(root: TransformNode): Set<AbstractMesh> {
    const meshes = new Set<AbstractMesh>();
    if (root instanceof AbstractMesh) meshes.add(root);
    root.getChildMeshes(false).forEach(m => meshes.add(m));
    return meshes;
  }

  /** Measure visibility for one character. */
  function measureVisibility(
    charRoot: TransformNode,
    charMeshes: Set<AbstractMesh>,
  ): CharacterVisibility {
    const cam = gameCamera.camera;
    const camPos = cam.position;
    const rootPos = charRoot.position;

    // Distance from camera
    const distance = Vector3.Distance(camPos, rootPos);

    // Screen projection of body sample points
    const engine = scene.getEngine();
    const vpW = engine.getRenderWidth();
    const vpH = engine.getRenderHeight();

    let minSX = Infinity, maxSX = -Infinity;
    let minSY = Infinity, maxSY = -Infinity;
    let projectedCount = 0;

    for (const offset of BODY_SAMPLE_OFFSETS) {
      _tmpWorldPos.copyFrom(rootPos);
      _tmpWorldPos.addInPlace(offset);

      const screen = gameCamera.worldToScreen(_tmpWorldPos);
      if (screen) {
        minSX = Math.min(minSX, screen.x);
        maxSX = Math.max(maxSX, screen.x);
        minSY = Math.min(minSY, screen.y);
        maxSY = Math.max(maxSY, screen.y);
        projectedCount++;
      }
    }

    const inFrustum = projectedCount >= 3; // at least 3 points visible
    let screenRect: CharacterVisibility['screenRect'] = null;
    let screenCoverage = 0;

    if (inFrustum && projectedCount > 0) {
      screenRect = { left: minSX, top: minSY, right: maxSX, bottom: maxSY };
      const rectW = (maxSX - minSX) / vpW;
      const rectH = (maxSY - minSY) / vpH;
      screenCoverage = Math.max(0, Math.min(1, rectW * rectH));
    }

    // Occlusion ray casts
    let occludedRays = 0;
    const occludingMeshes: AbstractMesh[] = [];
    const seenOccluders = new Set<string>();

    for (const anchor of OCCLUSION_ANCHORS) {
      _tmpWorldPos.copyFrom(rootPos);
      _tmpWorldPos.addInPlace(anchor);

      _tmpRayDir.copyFrom(_tmpWorldPos);
      _tmpRayDir.subtractInPlace(camPos);
      const rayLen = _tmpRayDir.length();
      _tmpRayDir.normalize();

      const ray = new Ray(camPos.clone(), _tmpRayDir.clone(), rayLen);
      const hit = scene.pickWithRay(ray, (mesh) => {
        // Exclude character's own meshes and non-visible meshes
        if (charMeshes.has(mesh)) return false;
        if (!mesh.isVisible || !mesh.isEnabled()) return false;
        // Exclude floors (they're below and shouldn't count as occluders)
        const name = mesh.name.toLowerCase();
        if (name.includes('floor') || name.includes('ground') || name.includes('rug')) return false;
        return true;
      });

      if (hit?.hit && hit.pickedMesh) {
        occludedRays++;
        if (!seenOccluders.has(hit.pickedMesh.uniqueId.toString())) {
          seenOccluders.add(hit.pickedMesh.uniqueId.toString());
          occludingMeshes.push(hit.pickedMesh);
        }
      }
    }

    const occlusionPct = OCCLUSION_ANCHORS.length > 0
      ? occludedRays / OCCLUSION_ANCHORS.length
      : 0;

    return {
      inFrustum,
      screenRect,
      screenCoverage,
      occlusionPct,
      distance,
      occludingMeshes,
    };
  }

  /** Enumerate visible meshes in the camera frustum. */
  function enumerateFOVObjects(): FOVObject[] {
    const cam = gameCamera.camera;
    const camPos = cam.position;

    // Get frustum planes
    const vpMatrix = cam.getViewMatrix().multiply(cam.getProjectionMatrix());
    Frustum.GetPlanesToRef(vpMatrix, _frustumPlanes);

    const objects: FOVObject[] = [];

    for (const mesh of scene.meshes) {
      if (!mesh.isVisible || !mesh.isEnabled()) continue;
      if (objects.length >= maxFovObjects) break;

      // Quick frustum check
      const boundingInfo = mesh.getBoundingInfo();
      if (!boundingInfo) continue;
      if (!boundingInfo.isInFrustum(_frustumPlanes)) continue;

      // Skip very small meshes (markers, particles)
      const extents = boundingInfo.boundingBox.extendSizeWorld;
      if (extents.x + extents.y + extents.z < 0.1) continue;

      const dist = Vector3.Distance(camPos, mesh.absolutePosition);
      const screenCenter = gameCamera.worldToScreen(mesh.absolutePosition);

      objects.push({
        meshName: mesh.name,
        category: categorizeMesh(mesh),
        distance: dist,
        screenCenter: screenCenter ?? { x: 0, y: 0 },
        interactive: !!(mesh.metadata?.interactive),
      });
    }

    // Sort by distance
    objects.sort((a, b) => a.distance - b.distance);
    return objects;
  }

  /** Compute composite quality score. */
  function computeQuality(playerVis: CharacterVisibility): CameraMetrics['qualityBreakdown'] & { total: number } {
    // Player visible in frustum
    const playerVisible = playerVis.inFrustum ? 1 : 0;

    // Player centered — screen center within central 60% of viewport
    let playerCentered = 0;
    if (playerVis.screenRect) {
      const engine = scene.getEngine();
      const vpW = engine.getRenderWidth();
      const vpH = engine.getRenderHeight();
      const centerX = (playerVis.screenRect.left + playerVis.screenRect.right) / 2 / vpW;
      const centerY = (playerVis.screenRect.top + playerVis.screenRect.bottom) / 2 / vpH;
      // Distance from viewport center (0.5, 0.5), mapped to 0-1
      const dx = Math.abs(centerX - 0.5) * 2; // 0 = center, 1 = edge
      const dy = Math.abs(centerY - 0.5) * 2;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
      // Within central 60% → score = 1, outside → decay
      playerCentered = distFromCenter < 0.3 ? 1 : Math.max(0, 1 - (distFromCenter - 0.3) / 0.7);
    }

    // Player not occluded
    const playerNotOccluded = 1 - playerVis.occlusionPct;

    // Zoom appropriate — screen coverage in ideal 3-8% range
    let zoomAppropriate = 0;
    const cov = playerVis.screenCoverage;
    if (cov >= 0.03 && cov <= 0.08) {
      zoomAppropriate = 1;
    } else if (cov < 0.03 && cov > 0) {
      zoomAppropriate = cov / 0.03; // ramp up
    } else if (cov > 0.08 && cov < 0.20) {
      zoomAppropriate = 1 - (cov - 0.08) / 0.12; // ramp down
    }

    // Weighted composite
    const total = 0.35 * playerVisible
      + 0.15 * playerCentered
      + 0.35 * playerNotOccluded
      + 0.15 * zoomAppropriate;

    return { playerVisible, playerCentered, playerNotOccluded, zoomAppropriate, total };
  }

  /** Perform the full measurement. */
  function doMeasure(): CameraMetrics {
    const cam = gameCamera.camera;
    const camPos = cam.position;
    const playerPos = playerRoot.position;

    const playerMeshes = getCharacterMeshes(playerRoot);
    const opponentMeshes = getCharacterMeshes(opponentRoot);

    const playerVisibility = measureVisibility(playerRoot, playerMeshes);
    const opponentVisibility = measureVisibility(opponentRoot, opponentMeshes);

    const orbitDistance = Vector3.Distance(camPos, playerPos);

    // Estimate clip amount from camera config vs actual distance
    // The camera's configured distance is encoded in the orbit, so we
    // approximate clip amount by how much the actual orbit differs from
    // what the camera's FOV suggests.
    const baseDist = 4.5; // desktop default
    const clipAmount = Math.max(0, 1 - orbitDistance / baseDist);
    const isWallClipped = clipAmount > 0.05;

    const objectsInFOV = enumerateFOVObjects();
    const quality = computeQuality(playerVisibility);

    cached = {
      timestamp: performance.now(),
      playerVisibility,
      opponentVisibility,
      fov: cam.fov,
      orbitDistance,
      isWallClipped,
      clipAmount,
      objectsInFOV,
      qualityScore: quality.total,
      qualityBreakdown: {
        playerVisible: quality.playerVisible,
        playerCentered: quality.playerCentered,
        playerNotOccluded: quality.playerNotOccluded,
        zoomAppropriate: quality.zoomAppropriate,
      },
    };

    return cached;
  }

  return {
    measure(): CameraMetrics {
      frameCounter++;
      if (frameCounter >= measureInterval) {
        frameCounter = 0;
        return doMeasure();
      }
      return cached;
    },

    measureForced(): CameraMetrics {
      frameCounter = 0;
      return doMeasure();
    },

    getLastMetrics(): CameraMetrics {
      return cached;
    },

    dispose() {
      // No persistent resources to clean up
    },
  };
}
