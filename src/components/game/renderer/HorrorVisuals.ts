/**
 * Horror visual effects — vignette, color tint, and FOV narrowing driven by horror level.
 */
import { Scene, HemisphericLight, Color3, Color4 } from '@babylonjs/core';
import type { StoryManager } from '../../../systems/StoryManager';
import type { GameCamera } from '../../../systems/Camera';

export interface HorrorVisuals {
  update(dt: number, storyManager: StoryManager, ambient: HemisphericLight, gameCamera: GameCamera | null): void;
}

export function createHorrorVisuals(scene: Scene): HorrorVisuals {
  // Initialize image processing for horror effects
  scene.imageProcessingConfiguration.isEnabled = true;
  scene.imageProcessingConfiguration.toneMappingEnabled = false;
  scene.imageProcessingConfiguration.vignetteEnabled = false;
  scene.imageProcessingConfiguration.vignetteWeight = 0;

  let currentLevel = 0;

  return {
    update(dt, storyManager, ambient, gameCamera) {
      const horrorLevel = storyManager.getHorrorLevel();
      currentLevel += (horrorLevel - currentLevel) * dt * 0.5;

      const imgProc = scene.imageProcessingConfiguration;
      if (currentLevel >= 3) {
        imgProc.vignetteEnabled = true;
        const vignetteStrength = Math.min(1, (currentLevel - 3) / 4);
        imgProc.vignetteWeight = vignetteStrength * 5;
        imgProc.vignetteColor = new Color4(
          0.1 + vignetteStrength * 0.3, 0.05, 0.05, 1
        );
      } else {
        imgProc.vignetteEnabled = false;
      }

      if (currentLevel >= 5) {
        const tintStrength = Math.min(1, (currentLevel - 5) / 3);
        ambient.groundColor = new Color3(
          0.25 + tintStrength * 0.15,
          0.2 - tintStrength * 0.08,
          0.18 - tintStrength * 0.08
        );
      }

      if (currentLevel >= 7 && gameCamera) {
        const fovFactor = 1 - Math.min(0.08, (currentLevel - 7) * 0.025);
        gameCamera.camera.fov *= fovFactor;
      }
    },
  };
}
