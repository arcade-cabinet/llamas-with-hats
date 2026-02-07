/**
 * Effects Manager
 * ===============
 * 
 * Manages instant visual effects in the Babylon.js scene:
 * - Camera shake and zoom animations
 * - Particle systems (blood splatter, sparkles)
 * 
 * NOTE: Atmosphere (fog, lighting, ambient audio) is now handled
 * by AtmosphereManager for data-driven scene moods.
 * 
 * ## Usage
 * 
 * ```ts
 * const effects = createEffectsManager(scene, camera);
 * 
 * // Camera effects
 * effects.shakeCamera(0.15, 500);  // intensity, duration ms
 * await effects.zoomCamera(0.6, 500, 1000);  // factor, in, out ms
 * 
 * // Particles
 * effects.spawnBloodSplatter(new Vector3(0, 1, 0));
 * effects.spawnSparkles(new Vector3(0, 1, 0));
 * 
 * // Cleanup
 * effects.dispose();
 * ```
 */

import {
  Scene,
  UniversalCamera,
  ArcRotateCamera,
  Vector3,
  Animation,
  ParticleSystem,
  Texture,
  Color4,
} from '@babylonjs/core';

export interface EffectsManager {
  // Camera effects
  shakeCamera(intensity?: number, duration?: number): void;
  zoomCamera(zoomFactor?: number, zoomInDuration?: number, holdDuration?: number): Promise<void>;
  
  // Particle effects
  spawnBloodSplatter(position: Vector3): void;
  spawnSparkles(position: Vector3): void;
  
  // Lifecycle
  update(deltaTime: number): void;
  dispose(): void;
}

// Camera type can be either UniversalCamera or ArcRotateCamera
type SupportedCamera = UniversalCamera | ArcRotateCamera;

/**
 * Create the effects manager
 * Supports both UniversalCamera (used in GameRenderer) and ArcRotateCamera
 */
export function createEffectsManager(
  scene: Scene,
  camera: SupportedCamera
): EffectsManager {
  let originalCameraPosition: Vector3 | null = null;
  let originalFOV: number | null = null;
  let isShaking = false;
  let isZooming = false;
  
  // Store original camera values
  originalCameraPosition = camera.position.clone();
  originalFOV = camera.fov;
  
  /**
   * Create blood splatter particle system
   */
  function createBloodParticleSystem(position: Vector3): ParticleSystem {
    const ps = new ParticleSystem('bloodSplatter', 100, scene);
    
    // Use SVG particle texture
    ps.particleTexture = new Texture('/textures/particle.svg', scene);
    
    // Emission
    ps.emitter = position;
    ps.minEmitBox = new Vector3(-0.1, 0, -0.1);
    ps.maxEmitBox = new Vector3(0.1, 0, 0.1);
    
    // Colors - blood red
    ps.color1 = new Color4(0.7, 0.1, 0.1, 1);
    ps.color2 = new Color4(0.5, 0.05, 0.05, 1);
    ps.colorDead = new Color4(0.3, 0, 0, 0);
    
    // Size
    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    
    // Lifetime
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 1.0;
    
    // Emission rate
    ps.emitRate = 50;
    
    // Direction - spray upward
    ps.direction1 = new Vector3(-1, 2, -1);
    ps.direction2 = new Vector3(1, 3, 1);
    
    // Power
    ps.minEmitPower = 1;
    ps.maxEmitPower = 3;
    
    // Gravity
    ps.gravity = new Vector3(0, -9.8, 0);
    
    // Auto-dispose after duration
    ps.targetStopDuration = 0.5;
    ps.disposeOnStop = true;
    
    return ps;
  }
  
  /**
   * Create sparkle cleanup particle system
   */
  function createSparkleParticleSystem(position: Vector3): ParticleSystem {
    const ps = new ParticleSystem('sparkles', 50, scene);
    
    // Use SVG particle texture
    ps.particleTexture = new Texture('/textures/particle.svg', scene);
    
    // Emission
    ps.emitter = position;
    ps.minEmitBox = new Vector3(-0.2, 0, -0.2);
    ps.maxEmitBox = new Vector3(0.2, 0.1, 0.2);
    
    // Colors - golden sparkles
    ps.color1 = new Color4(1, 1, 0.8, 1);
    ps.color2 = new Color4(0.9, 0.8, 0.5, 1);
    ps.colorDead = new Color4(1, 1, 1, 0);
    
    // Size - smaller, delicate
    ps.minSize = 0.02;
    ps.maxSize = 0.05;
    
    // Lifetime - longer float
    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.5;
    
    // Emission rate
    ps.emitRate = 30;
    
    // Direction - gentle upward drift
    ps.direction1 = new Vector3(-0.5, 1, -0.5);
    ps.direction2 = new Vector3(0.5, 2, 0.5);
    
    // Power - gentle
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1;
    
    // Gravity - slow fall
    ps.gravity = new Vector3(0, -2, 0);
    
    // Auto-dispose
    ps.targetStopDuration = 1;
    ps.disposeOnStop = true;
    
    return ps;
  }
  
  /**
   * Create camera shake animation (position-based for UniversalCamera)
   */
  function createShakeAnimation(intensity: number, frames: number): Animation {
    const animation = new Animation(
      'cameraShake',
      'position',
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    const keys: { frame: number; value: Vector3 }[] = [];
    const basePosition = originalCameraPosition!;
    
    for (let i = 0; i <= frames; i++) {
      const decay = 1 - i / frames;
      const offset = new Vector3(
        (Math.random() - 0.5) * intensity * decay,
        (Math.random() - 0.5) * intensity * 0.5 * decay, // Less vertical
        (Math.random() - 0.5) * intensity * decay
      );
      
      keys.push({
        frame: i,
        value: basePosition.add(offset),
      });
    }
    
    // Final frame returns to original
    keys[keys.length - 1] = { frame: frames, value: basePosition.clone() };
    
    animation.setKeys(keys);
    return animation;
  }
  
  /**
   * Create zoom animation (FOV-based for UniversalCamera, works with ArcRotateCamera too)
   */
  function createZoomAnimation(
    zoomFactor: number,
    zoomInFrames: number,
    holdFrames: number
  ): Animation {
    const animation = new Animation(
      'dramaticZoom',
      'fov',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    const startFOV = originalFOV!;
    const zoomedFOV = startFOV * zoomFactor; // Lower FOV = more zoom
    const zoomOutFrames = zoomInFrames * 2; // Slower zoom out
    
    animation.setKeys([
      { frame: 0, value: startFOV },
      { frame: zoomInFrames, value: zoomedFOV },
      { frame: zoomInFrames + holdFrames, value: zoomedFOV },
      { frame: zoomInFrames + holdFrames + zoomOutFrames, value: startFOV },
    ]);
    
    return animation;
  }
  
  return {
    shakeCamera(intensity = 0.15, duration = 500) {
      if (isShaking) return;
      isShaking = true;
      
      // Update original position before shake (camera may have moved)
      originalCameraPosition = camera.position.clone();
      
      const frames = Math.round((duration / 1000) * 60);
      const animation = createShakeAnimation(intensity, frames);
      
      camera.animations = [animation];
      scene.beginAnimation(camera, 0, frames, false, 1, () => {
        isShaking = false;
        // Restore position after shake
        camera.position = originalCameraPosition!.clone();
      });
    },
    
    async zoomCamera(zoomFactor = 0.6, zoomInDuration = 500, holdDuration = 0) {
      if (isZooming) return;
      isZooming = true;
      
      // Store current FOV before zooming
      originalFOV = camera.fov;
      
      const zoomInFrames = Math.round((zoomInDuration / 1000) * 60);
      const holdFrames = Math.round((holdDuration / 1000) * 60);
      const totalFrames = zoomInFrames + holdFrames + zoomInFrames * 2;
      
      const animation = createZoomAnimation(zoomFactor, zoomInFrames, holdFrames);
      
      return new Promise<void>(resolve => {
        camera.animations = [animation];
        scene.beginAnimation(camera, 0, totalFrames, false, 1, () => {
          isZooming = false;
          camera.fov = originalFOV!;
          resolve();
        });
      });
    },
    
    spawnBloodSplatter(position: Vector3) {
      const ps = createBloodParticleSystem(position);
      ps.start();
      
      // Follow up with sparkles after 1 second (dark comedy cleanup)
      setTimeout(() => {
        this.spawnSparkles(position.add(new Vector3(
          (Math.random() - 0.5) * 0.3,
          0,
          (Math.random() - 0.5) * 0.3
        )));
      }, 1000);
    },
    
    spawnSparkles(position: Vector3) {
      const ps = createSparkleParticleSystem(position);
      ps.start();
    },
    
    update(_deltaTime: number) {
      // Currently no per-frame updates needed
      // Particle systems and animations are self-managing
    },
    
    dispose() {
      // Reset camera
      if (originalCameraPosition) {
        camera.position = originalCameraPosition;
      }
      if (originalFOV !== null) {
        camera.fov = originalFOV;
      }
    },
  };
}

// Type export for consumers
export type { EffectsManager as EffectsManagerType };
