/**
 * Camera System
 * =============
 * 
 * Fixed isometric/diorama camera with responsive zoom based on viewport size.
 * The camera has NO user rotation controls - this ensures a consistent visual
 * language and predictable gameplay across the entire game.
 * 
 * ## Design Philosophy
 * 
 * Traditional 3D games let users rotate cameras freely, but this causes:
 * - Disorientation in indoor spaces
 * - Inconsistent screenshot/streaming visuals
 * - Difficulty with fixed camera angles in cutscenes
 * 
 * Instead, we use a fixed "diorama" view like classic isometric RPGs,
 * but with modern responsive adjustments based on screen size.
 * 
 * ## Viewport Responsiveness
 * 
 * ```
 * Phone (< 500px):     Tight zoom, wide FOV, see current room only
 * Tablet (500-900px):  Medium zoom, current room + adjacent glimpses
 * Desktop (900px+):    Classic RPG view, see adjacent rooms
 * Ultrawide (21:9+):   Expanded view, multiple rooms visible
 * ```
 * 
 * ## Camera Angle
 * 
 * The camera looks DOWN and INTO the scene at approximately 36° from horizontal.
 * This creates depth while keeping the floor plan readable.
 * 
 * ```
 *        Camera
 *          ╲
 *           ╲  ~36°
 *            ╲
 *             ▼
 *     ┌───────────────┐
 *     │    Scene      │
 *     │      ●        │ ← Player
 *     └───────────────┘
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
  // Fixed angle looking down and into the scene
  // These values create a classic isometric-like RPG view
  pitch: number;      // Angle down from horizontal (radians)
  height: number;     // Camera Y position
  distance: number;   // Distance back from target on XZ plane
  fov: number;        // Field of view
}

// Viewport-specific camera configurations
const CAMERA_CONFIGS: Record<ViewportSize, CameraConfig> = {
  phone: {
    pitch: Math.PI / 4,      // 45 degrees down
    height: 8,
    distance: 6,
    fov: 0.9,                // Wider FOV to see more on small screen
  },
  tablet: {
    pitch: Math.PI / 4.5,    // Slightly less steep
    height: 10,
    distance: 8,
    fov: 0.8,
  },
  desktop: {
    pitch: Math.PI / 5,      // Classic RPG angle ~36 degrees
    height: 12,
    distance: 10,
    fov: 0.7,
  },
  ultrawide: {
    pitch: Math.PI / 5,
    height: 14,
    distance: 12,
    fov: 0.6,                // Narrower FOV, see more rooms
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
}

export function createGameCamera(scene: Scene, initialSize: ViewportSize = 'desktop'): GameCamera {
  const config = CAMERA_CONFIGS[initialSize];
  
  // Calculate initial camera position
  // Camera looks at origin, positioned behind and above
  const camera = new UniversalCamera(
    'gameCamera',
    new Vector3(0, config.height, config.distance),
    scene
  );
  
  // Point camera at the scene (down and forward)
  camera.setTarget(Vector3.Zero());
  camera.fov = config.fov;
  
  // DISABLE all user input - fixed camera
  camera.inputs.clear();
  
  let currentTarget = { x: 0, z: 0 };
  let currentSize = initialSize;
  let currentConfig = config;
  
  const gameCamera: GameCamera = {
    camera,
    viewportSize: initialSize,
    visibleRadius: VISIBLE_RADIUS[initialSize],
    
    setTarget(x: number, z: number) {
      currentTarget = { x, z };
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
      // Smoothly follow target
      const targetPos = new Vector3(
        currentTarget.x,
        currentConfig.height,
        currentTarget.z + currentConfig.distance
      );
      
      // Lerp camera position for smooth follow
      camera.position = Vector3.Lerp(camera.position, targetPos, 0.1);
      
      // Always look at target point (slightly above ground)
      camera.setTarget(new Vector3(currentTarget.x, 0.5, currentTarget.z));
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
