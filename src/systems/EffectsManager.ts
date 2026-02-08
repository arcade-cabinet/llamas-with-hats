/**
 * Effects Manager
 * ===============
 *
 * Manages instant visual effects in the Babylon.js scene:
 * - Camera shake (additive offset model — works with moving cameras)
 * - Camera zoom animations
 * - Particle systems (blood splatter, sparkles)
 *
 * ## Camera Shake — Additive Offset Model
 *
 * Instead of saving/restoring the camera position (which goes stale when the
 * camera is moving), shake writes to a `shakeOffset` Vector3 on the GameCamera.
 * The Camera.update() method adds this offset to its computed position each frame.
 * This lets multiple systems (shake, bobbing, etc.) stack without conflicts.
 *
 * ## Usage
 *
 * ```ts
 * const effects = createEffectsManager(scene, camera, gameCamera.shakeOffset);
 *
 * effects.shakeCamera(0.15, 500);
 * await effects.zoomCamera(0.6, 500, 1000);
 *
 * effects.spawnBloodSplatter(new Vector3(0, 1, 0));
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
 * Create the effects manager.
 *
 * @param shakeOffset — shared Vector3 from GameCamera. Shake writes here,
 *   Camera.update() reads it each frame and adds it to the final position.
 *   Pass `undefined` for legacy callers (shake will fall back to no-op offset).
 */
export function createEffectsManager(
  scene: Scene,
  camera: SupportedCamera,
  shakeOffset?: Vector3
): EffectsManager {
  let originalFOV: number | null = null;
  let isShaking = false;
  let isZooming = false;

  // Shake state — managed manually per-frame instead of via animation
  let shakeIntensity = 0;
  let shakeDuration = 0;
  let shakeElapsed = 0;

  // The shared shake offset vector (Camera.update adds this to position)
  const offset = shakeOffset ?? Vector3.Zero();

  originalFOV = camera.fov;

  /**
   * Create blood splatter particle system
   */
  function createBloodParticleSystem(position: Vector3): ParticleSystem {
    const ps = new ParticleSystem('bloodSplatter', 100, scene);

    ps.particleTexture = new Texture('/textures/particle.svg', scene);

    ps.emitter = position;
    ps.minEmitBox = new Vector3(-0.1, 0, -0.1);
    ps.maxEmitBox = new Vector3(0.1, 0, 0.1);

    ps.color1 = new Color4(0.7, 0.1, 0.1, 1);
    ps.color2 = new Color4(0.5, 0.05, 0.05, 1);
    ps.colorDead = new Color4(0.3, 0, 0, 0);

    ps.minSize = 0.05;
    ps.maxSize = 0.15;

    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 1.0;

    ps.emitRate = 50;

    ps.direction1 = new Vector3(-1, 2, -1);
    ps.direction2 = new Vector3(1, 3, 1);

    ps.minEmitPower = 1;
    ps.maxEmitPower = 3;

    ps.gravity = new Vector3(0, -9.8, 0);

    ps.targetStopDuration = 0.5;
    ps.disposeOnStop = true;

    return ps;
  }

  /**
   * Create sparkle cleanup particle system
   */
  function createSparkleParticleSystem(position: Vector3): ParticleSystem {
    const ps = new ParticleSystem('sparkles', 50, scene);

    ps.particleTexture = new Texture('/textures/particle.svg', scene);

    ps.emitter = position;
    ps.minEmitBox = new Vector3(-0.2, 0, -0.2);
    ps.maxEmitBox = new Vector3(0.2, 0.1, 0.2);

    ps.color1 = new Color4(1, 1, 0.8, 1);
    ps.color2 = new Color4(0.9, 0.8, 0.5, 1);
    ps.colorDead = new Color4(1, 1, 1, 0);

    ps.minSize = 0.02;
    ps.maxSize = 0.05;

    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.5;

    ps.emitRate = 30;

    ps.direction1 = new Vector3(-0.5, 1, -0.5);
    ps.direction2 = new Vector3(0.5, 2, 0.5);

    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1;

    ps.gravity = new Vector3(0, -2, 0);

    ps.targetStopDuration = 1;
    ps.disposeOnStop = true;

    return ps;
  }

  /**
   * Create zoom animation (FOV-based)
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
    const zoomedFOV = startFOV * zoomFactor;
    const zoomOutFrames = zoomInFrames * 2;

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

      shakeIntensity = intensity;
      shakeDuration = duration / 1000; // convert to seconds
      shakeElapsed = 0;
    },

    async zoomCamera(zoomFactor = 0.6, zoomInDuration = 500, holdDuration = 0) {
      if (isZooming) return;
      isZooming = true;

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

    update(deltaTime: number) {
      // Additive shake: compute per-frame offset, Camera.update() applies it
      if (isShaking) {
        shakeElapsed += deltaTime;
        if (shakeElapsed >= shakeDuration) {
          // Shake finished — clear offset
          isShaking = false;
          offset.set(0, 0, 0);
        } else {
          const decay = 1 - shakeElapsed / shakeDuration;
          offset.set(
            (Math.random() - 0.5) * shakeIntensity * decay,
            (Math.random() - 0.5) * shakeIntensity * 0.5 * decay,
            (Math.random() - 0.5) * shakeIntensity * decay
          );
        }
      }
    },

    dispose() {
      // Clear shake offset
      offset.set(0, 0, 0);
      if (originalFOV !== null) {
        camera.fov = originalFOV;
      }
    },
  };
}

// Type export for consumers
export type { EffectsManager as EffectsManagerType };
