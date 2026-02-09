/**
 * Room tracking subsystem — detects when the player enters a new room
 * and applies atmosphere, story triggers, audio transitions, and
 * ambient/re-entry dialogue from the StoryManager's narrative data.
 */
import { Scene, Color4 } from '@babylonjs/core';
import type { Character } from '../../../systems/Character';
import type { AudioManager } from '../../../systems/AudioManager';
import { SoundEffects } from '../../../systems/AudioManager';
import type { StoryManager } from '../../../systems/StoryManager';
import type { PlaytestReporter } from '../../../systems/PlaytestReporter';
import type { RenderedLayout } from '../../../systems/LayoutRenderer';
import type { GeneratedLayout } from '../../../systems/LayoutGenerator';
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
  generatedLayout?: GeneratedLayout,
): RoomTracker {
  let currentTrackedRoom = initialRoomId;
  let playtestReporter: PlaytestReporter | null = null;
  // Track rooms the player has visited for re-entry dialogue
  const visitedRooms = new Set<string>();
  visitedRooms.add(initialRoomId);
  // Pending ambient dialogue timer — cleared if the player moves rooms again quickly
  let pendingAmbientTimer: ReturnType<typeof setTimeout> | null = null;
  // Flag: true while a story beat fires dialogue during checkTrigger
  let storyDialogueFired = false;
  // Cross-stage references shown flag (once per stage load)
  let crossStageShown = false;

  /** Resolve room purpose from the generated layout */
  function getRoomPurpose(roomId: string): string {
    return generatedLayout?.rooms.get(roomId)?.purpose ?? roomId;
  }

  return {
    update(player, rl, propsRef) {
      const px = player.root.position.x;
      const pz = player.root.position.z;
      const renderedRoom = rl.getRoomAt(px, pz);

      if (renderedRoom && renderedRoom.id !== currentTrackedRoom) {
        const prevRoom = currentTrackedRoom;
        currentTrackedRoom = renderedRoom.id;
        const isFirstVisit = !visitedRooms.has(renderedRoom.id);
        visitedRooms.add(renderedRoom.id);

        // Cancel any pending ambient dialogue from the previous room
        if (pendingAmbientTimer) {
          clearTimeout(pendingAmbientTimer);
          pendingAmbientTimer = null;
        }

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

        // Story triggers — track whether they produce dialogue
        storyDialogueFired = false;
        const origOnDialogue = propsRef.current.onDialogue;
        propsRef.current.onDialogue = (lines, speaker) => {
          storyDialogueFired = true;
          origOnDialogue?.(lines, speaker);
        };
        storyManager.checkTrigger('scene_exit', { sceneId: prevRoom });
        storyManager.checkTrigger('scene_enter', { sceneId: renderedRoom.id });
        // Restore original callback
        propsRef.current.onDialogue = origOnDialogue;

        // If no story dialogue fired, schedule ambient or re-entry dialogue
        // with a brief delay so it doesn't overlap with door transition effects.
        if (!storyDialogueFired) {
          const roomPurpose = getRoomPurpose(renderedRoom.id);
          const character = propsRef.current.playerCharacter;

          pendingAmbientTimer = setTimeout(() => {
            pendingAmbientTimer = null;
            // Don't show if game is paused or player already in dialogue
            if (propsRef.current.isPaused) return;

            // Cross-stage references (first room enter of a new stage)
            if (!crossStageShown) {
              crossStageShown = true;
              const refs = storyManager.getAllCrossStageReferences(character);
              if (refs.length > 0) {
                // Pick 1-2 random lines to avoid overwhelming the player
                const picked = refs.sort(() => Math.random() - 0.5).slice(0, 2);
                propsRef.current.onDialogue?.(picked, character);
                return;
              }
            }

            // Re-entry dialogue takes priority for rooms already visited
            if (!isFirstVisit) {
              const reEntryLine = storyManager.getReEntryDialogue(roomPurpose, character);
              if (reEntryLine) {
                propsRef.current.onDialogue?.([reEntryLine], character);
                return;
              }
            }

            // Ambient dialogue for first visits (or fallback for re-entries with no re-entry data)
            const ambientLine = storyManager.getAmbientDialogue(roomPurpose, character);
            if (ambientLine) {
              propsRef.current.onDialogue?.([ambientLine], character);
            }
          }, 1500);
        }
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
