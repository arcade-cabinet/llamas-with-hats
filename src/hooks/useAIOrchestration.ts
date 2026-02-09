import { useEffect, useRef, useState } from 'react';
import { LlamaAI, AIState, createLlamaAI } from '../systems/AIController';
import { getStoryManager } from '../systems/StoryManager';
import { getGoalTracker } from '../systems/GoalTracker';
import { createRoomPathfinder, type RoomPathfinder } from '../systems/RoomPathfinder';
import { createObjectiveAI, type ObjectiveAI, type ObjectiveAIState } from '../systems/ObjectiveAI';
import { createCharacterNavigator } from '../systems/CharacterNavigator';
import { createDualStoryContext, setDualStoryContext, resetDualStoryContext, type DualStoryContext } from '../systems/DualStoryContext';
import { createDifficultyScaler, type DifficultyScaler } from '../systems/DifficultyScaler';
import type { GeneratedLayout } from '../systems/LayoutGenerator';
import type { RoomConfig } from '../types/game';
import type { StageGoal } from '../systems/GameInitializer';

interface UseAIOrchestrationOptions {
  isPlaying: boolean;
  isPaused: boolean;
  currentRoom: RoomConfig | null;
  layout: GeneratedLayout | null;
  selectedCharacter: 'carl' | 'paul' | null;
  playerPosition: { x: number; y?: number; z: number };
  opponentPosition: { x: number; y?: number; z: number };
  stageGoals: StageGoal[];
  devAIMode: boolean;
  updatePlayerPosition: (x: number, y: number, z: number, rotation: number) => void;
  updateOpponent: (x: number, y: number, z: number, rotation: number) => void;
}

export interface AIOrchestrationState {
  playerAIState: AIState;
  opponentAIState: AIState;
  playerObjectiveState: ObjectiveAIState;
  opponentObjectiveState: ObjectiveAIState;
  objectiveAIRef: React.RefObject<ObjectiveAI | null>;
  playerObjectiveAIRef: React.RefObject<ObjectiveAI | null>;
  dualStoryRef: React.RefObject<DualStoryContext | null>;
  difficultyRef: React.RefObject<DifficultyScaler | null>;
}

export function useAIOrchestration(options: UseAIOrchestrationOptions): AIOrchestrationState {
  const {
    isPlaying, isPaused, currentRoom, layout, selectedCharacter,
    playerPosition, opponentPosition, stageGoals, devAIMode,
    updatePlayerPosition, updateOpponent,
  } = options;

  // AI controller refs
  const aiRef = useRef<LlamaAI | null>(null);
  const playerAIRef = useRef<LlamaAI | null>(null);
  const objectiveAIRef = useRef<ObjectiveAI | null>(null);
  const playerObjectiveAIRef = useRef<ObjectiveAI | null>(null);
  const pathfinderRef = useRef<RoomPathfinder | null>(null);
  const dualStoryRef = useRef<DualStoryContext | null>(null);
  const difficultyRef = useRef<DifficultyScaler | null>(null);
  const lastUpdateRef = useRef<number>(performance.now());

  // AI state tracking for dev overlay
  const [playerAIState, setPlayerAIState] = useState<AIState>('idle');
  const [opponentAIState, setOpponentAIState] = useState<AIState>('idle');
  const [opponentObjectiveState, setOpponentObjectiveState] = useState<ObjectiveAIState>('planning');
  const [playerObjectiveState, setPlayerObjectiveState] = useState<ObjectiveAIState>('planning');

  // Initialize GoalTracker + DualStoryContext when game starts
  useEffect(() => {
    if (isPlaying && stageGoals && stageGoals.length > 0) {
      const tracker = getGoalTracker();
      tracker.loadGoals(stageGoals);
      tracker.refreshVisibility(getStoryManager().getCompletedBeats());

      const dualStory = createDualStoryContext(getStoryManager(), tracker);
      dualStoryRef.current = dualStory;
      setDualStoryContext(dualStory);

      difficultyRef.current = createDifficultyScaler(0.5);

      return () => {
        resetDualStoryContext();
        dualStoryRef.current = null;
        difficultyRef.current?.reset();
        difficultyRef.current = null;
      };
    }
  }, [isPlaying, stageGoals]);

  // Initialize AI when game starts
  useEffect(() => {
    if (isPlaying && currentRoom && layout) {
      const goalTracker = getGoalTracker();

      const pathfinder = createRoomPathfinder(layout);
      pathfinderRef.current = pathfinder;

      // Compute full layout bounds for navigator
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const room of layout.rooms.values()) {
        const hw = room.size.width / 2;
        const hh = room.size.height / 2;
        minX = Math.min(minX, room.worldPosition.x - hw);
        maxX = Math.max(maxX, room.worldPosition.x + hw);
        minZ = Math.min(minZ, room.worldPosition.z - hh);
        maxZ = Math.max(maxZ, room.worldPosition.z + hh);
      }
      const layoutBounds = { minX, maxX, minZ, maxZ };
      const opponentChar = selectedCharacter === 'carl' ? 'paul' : 'carl';

      // --- Opponent ObjectiveAI (always active) ---
      const opponentNav = createCharacterNavigator({
        startX: opponentPosition.x,
        startZ: opponentPosition.z,
        bounds: layoutBounds,
        maxSpeed: 3,
        maxForce: 8,
        walkableCheck: (x, z) => pathfinder.getRoomAtPosition(x, z) !== null,
      });

      aiRef.current = createLlamaAI(
        opponentPosition.x,
        opponentPosition.z,
        currentRoom.width,
        currentRoom.height,
        (x, z, rotation) => {
          updateOpponent(x, 0, z, rotation);
        }
      );
      if (devAIMode) {
        aiRef.current.setStateCallback(setOpponentAIState);
      }

      objectiveAIRef.current = createObjectiveAI({
        character: opponentChar as 'carl' | 'paul',
        navigator: opponentNav,
        goalTracker,
        pathfinder,
        layout,
        legacyAI: aiRef.current,
        planningDelay: 0.5,
        onRoomTransition: (newRoomId, prevRoomId) => {
          const char = opponentChar as 'carl' | 'paul';
          const prevRoom = layout.rooms.get(prevRoomId);
          if (prevRoom) {
            dualStoryRef.current?.characterTrigger(char, 'scene_exit', { sceneId: prevRoom.purpose });
          }
          const newRoom = layout.rooms.get(newRoomId);
          if (newRoom) {
            goalTracker.trackSceneVisit(char, newRoom.purpose);
            dualStoryRef.current?.characterTrigger(char, 'scene_enter', { sceneId: newRoom.purpose });
          }
        },
        onInteraction: (goalState) => {
          const pos = opponentNav.getPosition();
          const roomId = pathfinder.getRoomAtPosition(pos.x, pos.z);
          const room = roomId ? layout.rooms.get(roomId) : null;
          goalTracker.checkGoalCompletion({
            type: goalState.def.type === 'reach_scene' ? 'scene_enter' :
                  goalState.def.type === 'collect_items' ? 'item_pickup' :
                  goalState.def.type === 'interact' ? 'interact' :
                  goalState.def.type === 'reach_exit' ? 'reach_exit' : 'scene_enter',
            character: opponentChar as 'carl' | 'paul',
            params: {
              sceneId: room?.purpose,
              ...goalState.def.params,
            },
          });
        },
        onStateChange: setOpponentObjectiveState,
        onPositionUpdate: (x, y, z, rotation) => {
          updateOpponent(x, y, z, rotation);
        },
      });

      // --- Player AI (dev mode only) ---
      if (devAIMode) {
        const playerNav = createCharacterNavigator({
          startX: playerPosition.x,
          startZ: playerPosition.z,
          bounds: layoutBounds,
          maxSpeed: 4,
          maxForce: 10,
          walkableCheck: (x, z) => pathfinder.getRoomAtPosition(x, z) !== null,
        });

        playerAIRef.current = createLlamaAI(
          playerPosition.x,
          playerPosition.z,
          currentRoom.width,
          currentRoom.height,
          (x, z, rotation) => {
            updatePlayerPosition(x, 0, z, rotation);
          }
        );
        playerAIRef.current.setStateCallback(setPlayerAIState);

        playerObjectiveAIRef.current = createObjectiveAI({
          character: selectedCharacter as 'carl' | 'paul' || 'carl',
          navigator: playerNav,
          goalTracker,
          pathfinder,
          layout,
          planningDelay: 0.3,
          onRoomTransition: (newRoomId, prevRoomId) => {
            const playerChar = selectedCharacter as 'carl' | 'paul' || 'carl';
            const prevRoom = layout.rooms.get(prevRoomId);
            if (prevRoom) {
              dualStoryRef.current?.characterTrigger(playerChar, 'scene_exit', { sceneId: prevRoom.purpose });
            }
            const newRoom = layout.rooms.get(newRoomId);
            if (newRoom) {
              goalTracker.trackSceneVisit(playerChar, newRoom.purpose);
              dualStoryRef.current?.characterTrigger(playerChar, 'scene_enter', { sceneId: newRoom.purpose });
            }
          },
          onInteraction: (goalState) => {
            const pos = playerNav.getPosition();
            const roomId = pathfinder.getRoomAtPosition(pos.x, pos.z);
            const room = roomId ? layout.rooms.get(roomId) : null;
            goalTracker.checkGoalCompletion({
              type: goalState.def.type === 'reach_scene' ? 'scene_enter' :
                    goalState.def.type === 'collect_items' ? 'item_pickup' :
                    goalState.def.type === 'interact' ? 'interact' :
                    goalState.def.type === 'reach_exit' ? 'reach_exit' : 'scene_enter',
              character: selectedCharacter as 'carl' | 'paul' || 'carl',
              params: {
                sceneId: room?.purpose,
                ...goalState.def.params,
              },
            });
          },
          onStateChange: setPlayerObjectiveState,
          onPositionUpdate: (x, y, z, rotation) => {
            updatePlayerPosition(x, y, z, rotation);
          },
        });
      }

      // Wire GoalTracker callbacks
      goalTracker.setCallbacks({
        onGoalActivated: (goalId) => {
          difficultyRef.current?.onGoalActivated(goalId);
        },
        onGoalCompleted: (goalId, character) => {
          objectiveAIRef.current?.onGoalCompleted(goalId);
          playerObjectiveAIRef.current?.onGoalCompleted(goalId);
          goalTracker.refreshVisibility(getStoryManager().getCompletedBeats());
          const playerChar = (selectedCharacter as 'carl' | 'paul') || 'carl';
          if (character === playerChar || !character) {
            difficultyRef.current?.onGoalCompleted(goalId);
          }
        },
        onFireBeat: (beatId, character) => {
          getStoryManager().activateBeat(beatId, character ?? undefined);
        },
      });

      // Fire initial scene_enter for the starting room
      const entryRoom = layout.rooms.get(layout.entryRoomId);
      if (entryRoom) {
        const entryPurpose = entryRoom.purpose;
        const playerChar = (selectedCharacter as 'carl' | 'paul') || 'carl';
        getStoryManager().checkTrigger('scene_enter', { sceneId: entryPurpose });
        goalTracker.trackSceneVisit(playerChar, entryPurpose);
        goalTracker.trackSceneVisit(opponentChar as 'carl' | 'paul', entryPurpose);
        goalTracker.checkGoalCompletion({
          type: 'scene_enter',
          character: playerChar,
          params: { sceneId: entryPurpose },
        });
        goalTracker.refreshVisibility(getStoryManager().getCompletedBeats());
      }

      return () => {
        aiRef.current?.dispose();
        aiRef.current = null;
        objectiveAIRef.current?.dispose();
        objectiveAIRef.current = null;
        pathfinderRef.current = null;
        if (playerAIRef.current) {
          playerAIRef.current.dispose();
          playerAIRef.current = null;
        }
        if (playerObjectiveAIRef.current) {
          playerObjectiveAIRef.current.dispose();
          playerObjectiveAIRef.current = null;
        }
      };
    }
  }, [isPlaying]);

  // Position refs — kept in sync via the effect below so the RAF loop
  // always reads fresh values without capturing stale state in its closure.
  const playerPosRef = useRef({ x: 0, z: 0 });
  const opponentPosRef = useRef({ x: 0, z: 0 });
  const prevPlayerPosRef = useRef({ x: 0, z: 0 });

  // Update AI with player position
  useEffect(() => {
    playerPosRef.current = { x: playerPosition.x, z: playerPosition.z };
    opponentPosRef.current = { x: opponentPosition.x, z: opponentPosition.z };

    if (aiRef.current) {
      aiRef.current.updatePlayerPosition(playerPosition.x, playerPosition.z);
    }
    if (playerAIRef.current) {
      playerAIRef.current.updatePlayerPosition(opponentPosition.x, opponentPosition.z);
    }
  }, [playerPosition.x, playerPosition.z, opponentPosition.x, opponentPosition.z]);

  // AI update loop
  useEffect(() => {
    if (!isPlaying || isPaused) return;

    let animationId: number;

    const updateLoop = () => {
      const now = performance.now();
      const deltaTime = Math.min((now - lastUpdateRef.current) / 1000, 0.1);
      lastUpdateRef.current = now;

      const horrorLevel = getStoryManager().getHorrorLevel();
      if (aiRef.current) {
        aiRef.current.setHorrorLevel(horrorLevel);
      }

      const completedBeats = getStoryManager().getCompletedBeats();
      getGoalTracker().refreshVisibility(completedBeats);

      const pPos = playerPosRef.current;
      const oPos = opponentPosRef.current;

      if (difficultyRef.current) {
        const dx = pPos.x - prevPlayerPosRef.current.x;
        const dz = pPos.z - prevPlayerPosRef.current.z;
        const isMoving = Math.abs(dx) + Math.abs(dz) > 0.01;
        prevPlayerPosRef.current = { x: pPos.x, z: pPos.z };
        difficultyRef.current.trackFrame(deltaTime, isMoving);

        const tuning = difficultyRef.current.getTuning();
        objectiveAIRef.current?.setSpeedMultiplier(tuning.speedMultiplier);
        objectiveAIRef.current?.setPlanningDelay(tuning.planningDelay);
      }

      if (objectiveAIRef.current) {
        objectiveAIRef.current.updatePlayerPosition(pPos.x, pPos.z);
        objectiveAIRef.current.update(deltaTime);
      } else if (aiRef.current) {
        aiRef.current.update(deltaTime);
      }

      if (playerObjectiveAIRef.current) {
        playerObjectiveAIRef.current.updatePlayerPosition(oPos.x, oPos.z);
        playerObjectiveAIRef.current.update(deltaTime);
      } else if (playerAIRef.current) {
        playerAIRef.current.update(deltaTime);
      }

      animationId = requestAnimationFrame(updateLoop);
    };

    animationId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, isPaused]);

  // Update legacy AI bounds on room change
  useEffect(() => {
    if (currentRoom) {
      if (aiRef.current && !objectiveAIRef.current) {
        aiRef.current.updateBounds(currentRoom.width, currentRoom.height);
        aiRef.current.teleport(0, -2);
      }
      if (playerAIRef.current && !playerObjectiveAIRef.current) {
        playerAIRef.current.updateBounds(currentRoom.width, currentRoom.height);
        playerAIRef.current.teleport(0, 2);
      }

      difficultyRef.current?.onRoomTransition();

      const roomPurpose = currentRoom.name?.toLowerCase().replace(/\s+/g, '_');
      if (roomPurpose) {
        getGoalTracker().trackSceneVisit(
          (selectedCharacter as 'carl' | 'paul') || 'carl',
          roomPurpose
        );
        getGoalTracker().checkGoalCompletion({
          type: 'scene_enter',
          character: (selectedCharacter as 'carl' | 'paul') || 'carl',
          params: { sceneId: roomPurpose },
        });
      }
    }
  }, [currentRoom?.id]);

  return {
    playerAIState,
    opponentAIState,
    playerObjectiveState,
    opponentObjectiveState,
    objectiveAIRef,
    playerObjectiveAIRef,
    dualStoryRef,
    difficultyRef,
  };
}
