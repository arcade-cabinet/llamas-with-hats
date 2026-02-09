/**
 * Interactive prop glow — pulses emissive color on the nearest interactive mesh.
 */
import { AbstractMesh, StandardMaterial, Color3 } from '@babylonjs/core';

export interface InteractiveGlow {
  update(dt: number, playerX: number, playerZ: number, meshes: AbstractMesh[]): void;
}

const GLOW_RANGE = 2.5;

export function createInteractiveGlow(): InteractiveGlow {
  let glowPulse = 0;
  let lastGlowTarget: AbstractMesh | null = null;

  return {
    update(dt, playerX, playerZ, meshes) {
      glowPulse += dt * 3;

      let closestInteractive: AbstractMesh | null = null;
      let closestDist = GLOW_RANGE;

      for (const mesh of meshes) {
        if (mesh.isDisposed()) continue;
        const dx = mesh.position.x - playerX;
        const dz = mesh.position.z - playerZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < closestDist) {
          closestDist = dist;
          closestInteractive = mesh;
        }
        // Reset emissive on meshes that moved out of range
        if (mesh !== closestInteractive && mesh.material instanceof StandardMaterial) {
          mesh.material.emissiveColor = Color3.Black();
        }
      }

      if (closestInteractive && closestInteractive !== lastGlowTarget) {
        if (lastGlowTarget && !lastGlowTarget.isDisposed() && lastGlowTarget.material instanceof StandardMaterial) {
          lastGlowTarget.material.emissiveColor = Color3.Black();
        }
        lastGlowTarget = closestInteractive;
      } else if (!closestInteractive && lastGlowTarget) {
        if (!lastGlowTarget.isDisposed() && lastGlowTarget.material instanceof StandardMaterial) {
          lastGlowTarget.material.emissiveColor = Color3.Black();
        }
        lastGlowTarget = null;
      }

      if (lastGlowTarget && !lastGlowTarget.isDisposed() && lastGlowTarget.material instanceof StandardMaterial) {
        const pulse = 0.08 + Math.sin(glowPulse) * 0.06;
        lastGlowTarget.material.emissiveColor = new Color3(pulse * 1.5, pulse * 1.2, pulse * 0.5);
      }
    },
  };
}
