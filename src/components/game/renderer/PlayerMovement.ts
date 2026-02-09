/**
 * Player movement subsystem — acceleration, collision, footsteps, tap-to-move.
 *
 * Extracted from the GameRenderer render loop to isolate movement concerns.
 */
import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import type { Character } from '../../../systems/Character';
import type { GameCamera } from '../../../systems/Camera';
import type { CollisionSystem } from '../../../systems/CollisionSystem';
import type { CharacterNavigator } from '../../../systems/CharacterNavigator';
import type { AudioManager } from '../../../systems/AudioManager';
import { SoundEffects } from '../../../systems/AudioManager';
import type { RenderedLayout } from '../../../systems/LayoutRenderer';
import type { PropsSnapshot } from './types';
import { GameBridge } from '../../../utils/gameBridge';

export interface PlayerMovement {
  /** Per-frame update. Returns the current tracked room ID. */
  update(
    dt: number,
    player: Character,
    gameCamera: GameCamera | null,
    rl: RenderedLayout | null,
    navigator: CharacterNavigator | null,
    propsRef: { current: PropsSnapshot },
    currentTrackedRoom: string,
  ): void;
  dispose(): void;
}

const BASE_SPEED = 4;
const ACCEL_RATE = 14;
const DECEL_RATE = 20;
const FOOTSTEP_INTERVAL = 0.35;
const LOCK_BUMP_COOLDOWN = 2;

export function createPlayerMovement(
  scene: Scene,
  collisionSystem: CollisionSystem,
  audioManager: AudioManager,
): PlayerMovement {
  let currentSpeed = 0;
  let footstepTimer = 0;
  let lastLockBumpTime = 0;

  // Tap-to-move destination marker
  const destMarker = MeshBuilder.CreateDisc('tapDestination', { radius: 0.3, tessellation: 32 }, scene);
  destMarker.rotation.x = Math.PI / 2;
  destMarker.position.y = 0.05;
  destMarker.isVisible = false;
  const destMarkerMat = new StandardMaterial('destMarkerMat', scene);
  destMarkerMat.diffuseColor = new Color3(0.4, 0.8, 0.4);
  destMarkerMat.emissiveColor = new Color3(0.2, 0.5, 0.2);
  destMarkerMat.alpha = 0.6;
  destMarker.material = destMarkerMat;
  let markerPulse = 0;

  return {
    update(dt, player, gameCamera, rl, navigator, propsRef, currentTrackedRoom) {
      if (propsRef.current.devAIEnabled) {
        // Dev AI mode: position from props
        const pp = propsRef.current.playerPosition;
        player.setPosition(pp.x, 0, pp.z);
        player.setTargetRotation(propsRef.current.playerRotation);
        return;
      }

      // Normal mode: poll input from unified controller
      const rawInput = GameBridge.getInput() ?? { x: 0, z: 0 };
      const yaw = gameCamera?.getCameraYaw() ?? 0;
      const sinYaw = Math.sin(yaw);
      const cosYaw = Math.cos(yaw);
      const manualInput = {
        x: -rawInput.x * cosYaw + rawInput.z * sinYaw,
        z: rawInput.x * sinYaw + rawInput.z * cosYaw,
      };
      const hasManualInput = manualInput.x !== 0 || manualInput.z !== 0;

      let navInput = { x: 0, z: 0 };
      if (navigator) {
        if (hasManualInput && navigator.getMode() === 'moveTo') {
          navigator.idle();
          destMarker.isVisible = false;
        }

        navigator.setPosition(player.root.position.x, player.root.position.z);

        if (navigator.getMode() === 'moveTo') {
          navigator.update(dt);
          const pos = navigator.getPosition();
          const state = navigator.getState();
          if (state.targetX !== undefined && state.targetZ !== undefined && !state.arrived) {
            const dx = state.targetX - pos.x;
            const dz = state.targetZ - pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > 0.1) {
              navInput.x = dx / dist;
              navInput.z = dz / dist;
            }
            destMarker.isVisible = true;
            destMarker.position.x = state.targetX;
            destMarker.position.z = state.targetZ;
            markerPulse += dt * 4;
            const scale = 0.8 + Math.sin(markerPulse) * 0.2;
            destMarker.scaling.setAll(scale);
            destMarkerMat.alpha = 0.4 + Math.sin(markerPulse) * 0.2;
          } else {
            destMarker.isVisible = false;
          }
        } else {
          destMarker.isVisible = false;
        }
      }

      const input = hasManualInput ? manualInput : navInput;
      const hasInput = input.x !== 0 || input.z !== 0;

      // Smooth acceleration/deceleration
      if (hasInput) {
        currentSpeed = Math.min(BASE_SPEED, currentSpeed + ACCEL_RATE * dt);
      } else {
        currentSpeed = Math.max(0, currentSpeed - DECEL_RATE * dt);
      }

      if (hasInput && currentSpeed > 0) {
        const len = Math.sqrt(input.x * input.x + input.z * input.z);
        const nx = input.x / len;
        const nz = input.z / len;

        const fromX = player.root.position.x;
        const fromZ = player.root.position.z;
        let toX = fromX + nx * currentSpeed * dt;
        let toZ = fromZ + nz * currentSpeed * dt;

        const moveResult = collisionSystem.checkMovement(fromX, fromZ, toX, toZ, 0.4);
        let newX = moveResult.adjustedX;
        let newZ = moveResult.adjustedZ;

        // Locked door feedback
        if (moveResult.blocked && moveResult.collidedWith?.type === 'lock') {
          const gameTime = performance.now() / 1000;
          if (gameTime - lastLockBumpTime > LOCK_BUMP_COOLDOWN) {
            lastLockBumpTime = gameTime;
            audioManager.playSound(SoundEffects.DOOR_LOCKED, { volume: 0.6 });
            propsRef.current.onDialogue?.(
              ['This door is locked. I need to find a key.'],
              propsRef.current.playerCharacter
            );
          }
        }

        // Layout walkability check
        if (rl && !rl.isWalkable(newX, newZ)) {
          newX = fromX;
          newZ = fromZ;
        }

        const newY = rl ? rl.getGroundY(newX, newZ) : 0;
        player.setPosition(newX, newY, newZ);
        player.setTargetRotation(Math.atan2(-nx, -nz));

        if (gameCamera) {
          gameCamera.setPlayerRotation(player.currentRotation);
        }

        propsRef.current.onPlayerMove(newX, newY, newZ, player.currentRotation);

        // Footstep audio
        footstepTimer += dt;
        if (footstepTimer >= FOOTSTEP_INTERVAL) {
          footstepTimer = 0;
          const roomId = currentTrackedRoom.toLowerCase();
          let sfx: string = SoundEffects.FOOTSTEP_WOOD;
          if (roomId.includes('kitchen') || roomId.includes('bathroom')) {
            sfx = SoundEffects.FOOTSTEP_TILE;
          } else if (roomId.includes('bedroom') || roomId.includes('lounge') || roomId.includes('living')) {
            sfx = SoundEffects.FOOTSTEP_CARPET;
          } else if (roomId.includes('basement') || roomId.includes('storage') || roomId.includes('street') || roomId.includes('alley')) {
            sfx = SoundEffects.FOOTSTEP_STONE;
          }
          audioManager.playSound(sfx, { volume: 0.3 });
        }
      } else {
        footstepTimer = FOOTSTEP_INTERVAL;
      }
    },

    dispose() {
      destMarker.dispose();
    },
  };
}
