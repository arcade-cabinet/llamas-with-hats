/**
 * Scene lighting setup — ambient light, directional sun, and shadow generator.
 */
import {
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Color3,
} from '@babylonjs/core';

export interface SceneLighting {
  ambient: HemisphericLight;
  sun: DirectionalLight;
  shadowGen: ShadowGenerator;
}

export function createSceneLighting(scene: Scene): SceneLighting {
  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.intensity = 1.0;
  ambient.groundColor = new Color3(0.25, 0.2, 0.18);

  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.5), scene);
  sun.intensity = 1.2;
  sun.position = new Vector3(8, 12, 8);

  scene.environmentIntensity = 1.0;

  const shadowGen = new ShadowGenerator(1024, sun);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel = 16;
  shadowGen.darkness = 0.4;

  return { ambient, sun, shadowGen };
}
