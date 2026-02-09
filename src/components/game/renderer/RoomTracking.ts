/**
 * Room tracking subsystem — detects when the player enters a new room
 * and applies atmosphere, story triggers, and audio transitions.
 */
import { Scene, Color4 } from '@babylonjs/core';
import type { Character } from '../../../systems/Character';
import type { AudioManager } from '../../../systems/AudioManager';
import { SoundEffects } from '../../../systems/AudioManager';
import type { StoryManager } from '../../../systems/StoryManager';
import type { PlaytestReporter } from '../../../systems/PlaytestReporter';
import type { RenderedLayout } from '../../../systems/LayoutRenderer';
import type { PropsSnapshot } from './types';

export interface RoomTracker {
  /** Check if player moved to a new room. Returns the current room ID. */
  update(
    player: Character,
    rl: RenderedLayout,
    propsRef: { current: PropsSnapshot },
  ): string;
  getCurrentRoom(): string;
  setPlaytestReporter(reporter: PlaytestReporter | null): void;
}

export function createRoomTracker(
  scene: Scene,
  initialRoomId: string,
  audioManager: AudioManager,
  storyManager: StoryManager,
): RoomTracker {
  let currentTrackedRoom = initialRoomId;
  let playtestReporter: PlaytestReporter | null = null;

  return {
    update(player, rl, propsRef) {
      const px = player.root.position.x;
      const pz = player.root.position.z;
      const renderedRoom = rl.getRoomAt(px, pz);

      if (renderedRoom && renderedRoom.id !== currentTrackedRoom) {
        const prevRoom = currentTrackedRoom;
        currentTrackedRoom = renderedRoom.id;

        // Update room visibility
        rl.updateRoomVisibility(renderedRoom.id);
        audioManager.playSound(SoundEffects.DOOR_OPEN, { volume: 0.5 });
        propsRef.current.onRoomChange?.(renderedRoom.id);

        // Notify playtest reporter
        if (playtestReporter) {
          playtestReporter.setSceneContext(renderedRoom.id, renderedRoom.id, 0);
          playtestReporter.triggerEvent('room_transition');
        }

        // Brief visual door transition flash
        const prevClearColor = scene.clearColor.clone();
        scene.clearColor = new Color4(0, 0, 0, 1);
        setTimeout(() => {
          if (!scene.isDisposed) scene.clearColor = prevClearColor;
        }, 150);

        // Per-room atmosphere from stage definition
        const atmo = propsRef.current.stageAtmosphere;
        if (atmo && storyManager) {
          const roomOverride = atmo.perRoomOverrides?.[renderedRoom.id];
          const roomHorror = roomOverride?.horrorLevel ?? atmo.baseHorrorLevel;
          storyManager.setSceneHorrorLevel(roomHorror);

          const roomMusic = roomOverride?.musicTrack ?? atmo.musicTrack;
          if (roomMusic) {
            audioManager.crossfadeMusic(roomMusic, { duration: 2000 });
          }

          const roomAmbient = roomOverride?.ambientSound;
          if (roomAmbient) {
            audioManager.playSound(roomAmbient, { volume: 0.3 });
          }
        }

        // Story triggers
        storyManager.checkTrigger('scene_exit', { sceneId: prevRoom });
        storyManager.checkTrigger('scene_enter', { sceneId: renderedRoom.id });
      }

      return currentTrackedRoom;
    },

    getCurrentRoom() {
      return currentTrackedRoom;
    },

    setPlaytestReporter(reporter) {
      playtestReporter = reporter;
    },
  };
}
