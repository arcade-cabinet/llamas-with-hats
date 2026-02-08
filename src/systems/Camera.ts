/**
 * Camera System
 * =============
 *
 * Over-the-shoulder 3rd-person camera that follows behind the player.
 * The camera orbits behind the player based on their facing direction,
 * keeping the llama's hat prominently in frame.
 *
 * ## Design Philosophy
 *
 * The camera is positioned behind and slightly above the player, looking
 * at shoulder/head height. This means:
 * - The player sees the back of their llama with its glorious hat
 * - Rooms feel like immersive 3D spaces, not dioramas
 * - Walking through doorways feels like entering a new space
 *
 * ## Camera Positioning
 *
 * ```
 *        Camera
 *          ○
 *         ╱|
 *        ╱ | heightOffset
 *       ╱  |
 *      ╱   ▼
 *     ●────── lookAt (shoulder height)
 *     Player
 *
 *     ←distance→
 * ```
 *
 * The camera orbits behind the player at a fixed offset determined by
 * the player's facing direction (rotation). A damped lag on the rotation
 * creates a cinematic trailing feel.
 *
 * ## Viewport Responsiveness
 *
 * ```
 * Phone (< 500px):     Tight, FOV 1.0, distance 4
 * Tablet (500-900px):  Medium, FOV 0.9, distance 5
 * Desktop (900px+):    Classic, FOV 0.8, distance 6
 * Ultrawide (21:9+):   Wide, FOV 0.7, distance 7
 * ```
 *
 * @module Camera
 */

import {
  Scene,
  UniversalCamera,
  Vector3,
  Matrix
} from '@babylonjs/core';

export type ViewportSize = 'phone' | 'tablet' | 'desktop' | 'ultrawide';

interface CameraConfig {
  distance: number;       // Distance behind player on XZ plane
  heightOffset: number;   // Camera Y above ground
  lookAtHeight: number;   // Y height the camera looks at (shoulder/head)
  fov: number;            // Field of view
}

// Viewport-specific camera configurations — must stay below room ceiling heights (2-3 units)
const CAMERA_CONFIGS: Record<ViewportSize, CameraConfig> = {
  phone: {
    distance: 3.5,
    heightOffset: 1.8,
    lookAtHeight: 0.8,
    fov: 1.0,
  },
  tablet: {
    distance: 4,
    heightOffset: 2.0,
    lookAtHeight: 0.9,
    fov: 0.95,
  },
  desktop: {
    distance: 4.5,
    heightOffset: 2.2,
    lookAtHeight: 1.0,
    fov: 0.9,
  },
  ultrawide: {
    distance: 5,
    heightOffset: 2.4,
    lookAtHeight: 1.0,
    fov: 0.85,
  },
};

// How much of surrounding rooms to show based on viewport
const VISIBLE_RADIUS: Record<ViewportSize, number> = {
  phone: 6,        // Just the current room
  tablet: 10,      // Current room + glimpse of adjacent
  desktop: 14,     // Current room + adjacent rooms
  ultrawide: 20,   // Multiple rooms visible
};

export interface GameCamera {
  camera: UniversalCamera;
  viewportSize: ViewportSize;
  visibleRadius: number;

  setTarget: (x: number, z: number) => void;
  setViewportSize: (size: ViewportSize) => void;
  getVisibleBounds: () => { minX: number; maxX: number; minZ: number; maxZ: number };
  worldToScreen: (worldPos: Vector3) => { x: number; y: number } | null;
  update: () => void;

  /** Set the player's facing direction so the camera orbits behind them */
  setPlayerRotation: (radians: number) => void;
  /** Get the camera's horizontal yaw angle — needed for camera-relative movement */
  getCameraYaw: () => number;
  /** Additive shake offset — written by EffectsManager, applied in update() */
  shakeOffset: Vector3;
  /** Set walkability checker for camera wall-collision prevention */
  setWalkableCheck: (fn: (x: number, z: number) => boolean) => void;
}

export function createGameCamera(scene: Scene, initialSize: ViewportSize = 'desktop'): GameCamera {
  const config = CAMERA_CONFIGS[initialSize];

  // Initial camera position — will be immediately updated in first update() call
  const camera = new UniversalCamera(
    'gameCamera',
    new Vector3(0, config.heightOffset, config.distance),
    scene
  );

  camera.setTarget(Vector3.Zero());
  camera.fov = config.fov;

  // DISABLE all user input — camera auto-follows player
  camera.inputs.clear();

  let currentTarget = { x: 0, z: 0 };
  let currentSize = initialSize;
  let currentConfig = config;

  // Player rotation tracking with damped lag
  let targetPlayerRotation = 0;
  let currentCameraRotation = 0;
  const ROTATION_LAG = 0.06; // Damping factor — lower = more cinematic lag

  // Shake offset (written externally by EffectsManager)
  const shakeOffset = Vector3.Zero();

  // Walkability checker for wall-collision prevention (set from GameRenderer)
  let walkableCheck: ((x: number, z: number) => boolean) | null = null;

  // Minimum camera distance when wall-clipped
  const MIN_DISTANCE = 1.5;

  const gameCamera: GameCamera = {
    camera,
    viewportSize: initialSize,
    visibleRadius: VISIBLE_RADIUS[initialSize],
    shakeOffset,

    setTarget(x: number, z: number) {
      currentTarget = { x, z };
    },

    setPlayerRotation(radians: number) {
      targetPlayerRotation = radians;
    },

    getCameraYaw(): number {
      return currentCameraRotation;
    },

    setWalkableCheck(fn: (x: number, z: number) => boolean) {
      walkableCheck = fn;
    },

    setViewportSize(size: ViewportSize) {
      if (size === currentSize) return;

      currentSize = size;
      currentConfig = CAMERA_CONFIGS[size];
      gameCamera.viewportSize = size;
      gameCamera.visibleRadius = VISIBLE_RADIUS[size];

      camera.fov = currentConfig.fov;
    },

    getVisibleBounds() {
      const r = VISIBLE_RADIUS[currentSize];
      return {
        minX: currentTarget.x - r,
        maxX: currentTarget.x + r,
        minZ: currentTarget.z - r,
        maxZ: currentTarget.z + r,
      };
    },

    worldToScreen(worldPos: Vector3) {
      const engine = scene.getEngine();
      const screenPos = Vector3.Project(
        worldPos,
        Matrix.Identity(),
        scene.getTransformMatrix(),
        camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
      );

      if (screenPos.z < 0 || screenPos.z > 1) return null;
      return { x: screenPos.x, y: screenPos.y };
    },

    update() {
      // Damped rotation following — camera smoothly catches up to player rotation
      // Normalize the angle difference to handle wrapping around ±PI
      let rotDiff = targetPlayerRotation - currentCameraRotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      currentCameraRotation += rotDiff * ROTATION_LAG;

      // Camera orbits BEHIND player:
      // Player facing direction is (-sin(rot), -cos(rot)).
      // "Behind" is the opposite: (+sin(rot), +cos(rot)).
      const orbitX = Math.sin(currentCameraRotation);
      const orbitZ = Math.cos(currentCameraRotation);

      // Start at full distance, reduce if camera would clip through a wall
      let dist = currentConfig.distance;

      if (walkableCheck) {
        // Step along the orbit ray from player toward desired camera position.
        // If the full-distance point is outside walkable area, pull camera closer.
        while (dist > MIN_DISTANCE) {
          const testX = currentTarget.x + orbitX * dist;
          const testZ = currentTarget.z + orbitZ * dist;
          if (walkableCheck(testX, testZ)) break;
          dist -= 0.5; // step inward
        }
      }

      const camX = currentTarget.x + orbitX * dist;
      const camZ = currentTarget.z + orbitZ * dist;

      // When distance is reduced (tight corridors/near walls), raise camera slightly
      // and widen FOV to keep the player visible. Stay below ceiling (~3 units).
      const distRatio = dist / currentConfig.distance; // 1.0 = full distance, <1 = clipped
      const clipAmount = 1 - distRatio; // 0 = no clipping, 1 = fully clipped
      const camY = currentConfig.heightOffset + clipAmount * 0.6; // raise up to +0.6, stays below ceiling
      const targetFov = currentConfig.fov + clipAmount * 0.15; // widen up to +0.15 rad
      camera.fov += (targetFov - camera.fov) * 0.08; // smooth FOV transition

      const targetPos = new Vector3(camX, camY, camZ);

      // Lerp camera position for smooth follow
      camera.position = Vector3.Lerp(camera.position, targetPos, 0.1);

      // Add shake offset (written by EffectsManager)
      camera.position.addInPlace(shakeOffset);

      // Pivot look-at toward ground level as camera goes top-down.
      // At full distance: look at shoulder height. When clipped close: look at feet.
      const lookY = currentConfig.lookAtHeight * (1 - clipAmount * 0.8);
      camera.setTarget(new Vector3(
        currentTarget.x,
        lookY,
        currentTarget.z
      ));
    }
  };

  return gameCamera;
}

// Determine viewport size from screen dimensions
export function getViewportSize(width: number, height: number): ViewportSize {
  const aspectRatio = width / height;
  const minDimension = Math.min(width, height);

  // Ultrawide detection (21:9 or wider)
  if (aspectRatio >= 2.2) {
    return 'ultrawide';
  }

  // Phone (small screens, typically portrait or small landscape)
  if (minDimension < 500 || (width < 768 && height < 500)) {
    return 'phone';
  }

  // Tablet (medium screens)
  if (minDimension < 900 || width < 1200) {
    return 'tablet';
  }

  // Desktop (large screens)
  return 'desktop';
}

// Calculate how many rooms should be loaded based on visible radius
export function getRoomsToLoad(
  currentRoomId: string,
  roomConnections: Map<string, string[]>,
  viewportSize: ViewportSize
): Set<string> {
  const rooms = new Set<string>([currentRoomId]);

  // Phone: just current room
  if (viewportSize === 'phone') {
    return rooms;
  }

  // Get adjacent rooms
  const adjacent = roomConnections.get(currentRoomId) ?? [];

  // Tablet: current + immediate neighbors
  if (viewportSize === 'tablet') {
    adjacent.forEach(id => rooms.add(id));
    return rooms;
  }

  // Desktop/Ultrawide: current + neighbors + their neighbors
  adjacent.forEach(id => {
    rooms.add(id);
    const nextLevel = roomConnections.get(id) ?? [];
    nextLevel.forEach(nextId => rooms.add(nextId));
  });

  return rooms;
}
