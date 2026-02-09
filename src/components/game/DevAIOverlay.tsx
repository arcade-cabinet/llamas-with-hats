/**
 * DevAIOverlay - Full Autonomous Playtest Dashboard
 * ==================================================
 *
 * Activated via `?dev=ai` URL parameter. Shows real-time AI state
 * for both llamas during autonomous testing.
 *
 * Dashboard sections:
 * - Both characters' objective states and current goals
 * - Difficulty level and tuning parameters
 * - Interference event log (from DualStoryContext)
 * - Goal tracks with status indicators
 */
import React from 'react';
import { AIState } from '../../systems/AIController';
import type { ObjectiveAIState } from '../../systems/ObjectiveAI';
import type { GoalState } from '../../systems/GoalTracker';
import type { DifficultyTuning } from '../../systems/DifficultyScaler';
import type { BeatTriggerRecord } from '../../systems/DualStoryContext';
import type { CameraTelemetry } from './GameRenderer';

interface DevAIOverlayProps {
  playerAIState: AIState;
  opponentAIState: AIState;
  playerPosition: { x: number; z: number };
  opponentPosition: { x: number; z: number };
  currentRoomName: string;
  // ObjectiveAI state
  playerObjectiveState?: ObjectiveAIState;
  opponentObjectiveState?: ObjectiveAIState;
  playerGoal?: string;
  opponentGoal?: string;
  opponentRoom?: string;
  // Difficulty
  difficultyLevel?: number;
  difficultyTuning?: DifficultyTuning;
  // Goal tracks
  carlGoals?: GoalState[];
  paulGoals?: GoalState[];
  // Interference log
  triggerLog?: ReadonlyArray<BeatTriggerRecord>;
  // Camera telemetry from CameraIntelligence/AutoHeal
  cameraTelemetry?: CameraTelemetry | null;
}

const stateColor: Record<AIState, string> = {
  idle: 'text-gray-400',
  wander: 'text-green-400',
  follow: 'text-yellow-400',
  flee: 'text-red-400',
  interact: 'text-cyan-400',
};

const objectiveStateColor: Record<ObjectiveAIState, string> = {
  planning: 'text-blue-400',
  navigating: 'text-green-400',
  arriving: 'text-yellow-400',
  interacting: 'text-cyan-400',
  waiting: 'text-orange-400',
  wandering: 'text-gray-400',
};

const goalStatusIcon: Record<string, string> = {
  hidden: '\u2591',    // light shade
  active: '\u25CB',    // empty circle
  completed: '\u25CF', // filled circle
  failed: '\u2717',    // cross
};

const goalStatusColor: Record<string, string> = {
  hidden: 'text-gray-600',
  active: 'text-yellow-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

export const DevAIOverlay: React.FC<DevAIOverlayProps> = ({
  playerAIState,
  opponentAIState,
  playerPosition,
  opponentPosition,
  currentRoomName,
  playerObjectiveState,
  opponentObjectiveState,
  playerGoal,
  opponentGoal,
  opponentRoom,
  difficultyLevel,
  difficultyTuning,
  carlGoals,
  paulGoals,
  triggerLog,
  cameraTelemetry,
}) => (
  <div className="absolute top-14 right-3 z-50 pointer-events-none select-none max-h-[calc(100vh-4rem)] overflow-y-auto">
    <div className="bg-black/85 border border-cyan-500/60 rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed min-w-[240px] max-w-[280px]">
      <div className="text-cyan-400 font-bold mb-1 tracking-wider">DEV AI MODE</div>
      <div className="text-gray-500 text-[9px] mb-2">?dev=ai &middot; Objective-Driven &middot; Dual-Track</div>

      {/* Current Room */}
      <div className="border-t border-gray-700 pt-1 mb-1">
        <span className="text-gray-500">Room:</span>{' '}
        <span className="text-gray-300">{currentRoomName}</span>
      </div>

      {/* Difficulty Metrics */}
      {difficultyLevel !== undefined && (
        <div className="border-t border-gray-700 pt-1 mb-1">
          <span className="text-purple-400 font-bold text-[10px]">DIFFICULTY</span>
          <div className="ml-2 flex items-center gap-1">
            <span className="text-gray-500">level:</span>
            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full transition-all"
                style={{ width: `${(difficultyLevel * 100).toFixed(0)}%` }}
              />
            </div>
            <span className="text-gray-400 text-[9px]">{(difficultyLevel * 100).toFixed(0)}%</span>
          </div>
          {difficultyTuning && (
            <div className="ml-2 text-gray-500 text-[9px]">
              spd:{difficultyTuning.speedMultiplier.toFixed(2)}x
              {' '}plan:{difficultyTuning.planningDelay.toFixed(1)}s
              {' '}path:{(difficultyTuning.pathfindingAccuracy * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {/* Camera Intelligence */}
      {cameraTelemetry && (
        <div className="border-t border-gray-700 pt-1 mb-1">
          <span className="text-cyan-400 font-bold text-[10px]">CAMERA</span>
          <div className="ml-2">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">quality:</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    cameraTelemetry.qualityScore > 0.7 ? 'bg-green-500' :
                    cameraTelemetry.qualityScore > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(cameraTelemetry.qualityScore * 100).toFixed(0)}%` }}
                />
              </div>
              <span className="text-gray-400 text-[9px]">
                {(cameraTelemetry.qualityScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-gray-500 text-[9px]">
              occl:{(cameraTelemetry.occlusionPct * 100).toFixed(0)}%
              {' '}cov:{(cameraTelemetry.screenCoverage * 100).toFixed(1)}%
              {' '}fov:{cameraTelemetry.fovObjectCount}
            </div>
            {cameraTelemetry.isHealing && (
              <div className="text-yellow-400 text-[9px]">
                heal: {cameraTelemetry.healReason}
              </div>
            )}
            <div className="text-gray-600 text-[9px]">
              {cameraTelemetry.fps.toFixed(0)} fps
            </div>
          </div>
        </div>
      )}

      {/* AI Thought Process */}
      {cameraTelemetry && (cameraTelemetry.playerAIAction || cameraTelemetry.opponentAIAction) && (
        <div className="border-t border-gray-700 pt-1 mb-1">
          <span className="text-green-400 font-bold text-[10px]">AI THOUGHT</span>
          {cameraTelemetry.playerAIAction && (
            <div className="ml-2 text-[9px]">
              <span className="text-carl">P:</span>{' '}
              <span className="text-gray-400">{cameraTelemetry.playerAIAction}</span>
              {cameraTelemetry.playerAIReason && (
                <div className="ml-2 text-gray-600">{cameraTelemetry.playerAIReason}</div>
              )}
            </div>
          )}
          {cameraTelemetry.opponentAIAction && (
            <div className="ml-2 text-[9px]">
              <span className="text-paul">O:</span>{' '}
              <span className="text-gray-400">{cameraTelemetry.opponentAIAction}</span>
              {cameraTelemetry.opponentAIReason && (
                <div className="ml-2 text-gray-600">{cameraTelemetry.opponentAIReason}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Player Character */}
      <div className="border-t border-gray-700 pt-1 mb-1">
        <span className="text-carl font-bold">Player (Carl)</span>
        <div className="ml-2">
          <span className="text-gray-500">legacy:</span>{' '}
          <span className={stateColor[playerAIState] ?? 'text-gray-400'}>
            {playerAIState}
          </span>
        </div>
        {playerObjectiveState && (
          <div className="ml-2">
            <span className="text-gray-500">objective:</span>{' '}
            <span className={objectiveStateColor[playerObjectiveState] ?? 'text-gray-400'}>
              {playerObjectiveState}
            </span>
          </div>
        )}
        {playerGoal && (
          <div className="ml-2 text-gray-400 text-[9px] truncate max-w-[220px]">
            goal: {playerGoal}
          </div>
        )}
        <div className="ml-2 text-gray-500">
          pos: {playerPosition.x.toFixed(1)}, {playerPosition.z.toFixed(1)}
        </div>
      </div>

      {/* Opponent Character */}
      <div className="border-t border-gray-700 pt-1 mb-1">
        <span className="text-paul font-bold">Opponent (Paul)</span>
        <div className="ml-2">
          <span className="text-gray-500">legacy:</span>{' '}
          <span className={stateColor[opponentAIState] ?? 'text-gray-400'}>
            {opponentAIState}
          </span>
        </div>
        {opponentObjectiveState && (
          <div className="ml-2">
            <span className="text-gray-500">objective:</span>{' '}
            <span className={objectiveStateColor[opponentObjectiveState] ?? 'text-gray-400'}>
              {opponentObjectiveState}
            </span>
          </div>
        )}
        {opponentGoal && (
          <div className="ml-2 text-gray-400 text-[9px] truncate max-w-[220px]">
            goal: {opponentGoal}
          </div>
        )}
        {opponentRoom && (
          <div className="ml-2 text-gray-500">
            room: {opponentRoom}
          </div>
        )}
        <div className="ml-2 text-gray-500">
          pos: {opponentPosition.x.toFixed(1)}, {opponentPosition.z.toFixed(1)}
        </div>
      </div>

      {/* Goal Tracks */}
      {(carlGoals || paulGoals) && (
        <div className="border-t border-gray-700 pt-1 mb-1">
          <span className="text-amber-400 font-bold text-[10px]">GOAL TRACKS</span>
          {carlGoals && carlGoals.length > 0 && (
            <div className="ml-1 mt-0.5">
              <span className="text-carl text-[9px] font-bold">Carl:</span>
              {carlGoals.map(g => (
                <div key={g.def.id} className="ml-2 text-[9px] flex items-center gap-1">
                  <span className={goalStatusColor[g.status] ?? 'text-gray-500'}>
                    {goalStatusIcon[g.status] ?? '?'}
                  </span>
                  <span className={g.status === 'completed' ? 'text-gray-500 line-through' :
                                   g.status === 'failed' ? 'text-red-400/60 line-through' :
                                   g.status === 'active' ? 'text-gray-300' : 'text-gray-600'}>
                    {g.def.description}
                  </span>
                  {g.def.interferenceType && (
                    <span className="text-purple-400/60 text-[8px]">
                      [{g.def.interferenceType}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {paulGoals && paulGoals.length > 0 && (
            <div className="ml-1 mt-0.5">
              <span className="text-paul text-[9px] font-bold">Paul:</span>
              {paulGoals.map(g => (
                <div key={g.def.id} className="ml-2 text-[9px] flex items-center gap-1">
                  <span className={goalStatusColor[g.status] ?? 'text-gray-500'}>
                    {goalStatusIcon[g.status] ?? '?'}
                  </span>
                  <span className={g.status === 'completed' ? 'text-gray-500 line-through' :
                                   g.status === 'failed' ? 'text-red-400/60 line-through' :
                                   g.status === 'active' ? 'text-gray-300' : 'text-gray-600'}>
                    {g.def.description}
                  </span>
                  {g.def.interferenceType && (
                    <span className="text-purple-400/60 text-[8px]">
                      [{g.def.interferenceType}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interference Event Log */}
      {triggerLog && triggerLog.length > 0 && (
        <div className="border-t border-gray-700 pt-1">
          <span className="text-red-400 font-bold text-[10px]">EVENTS</span>
          <div className="ml-1 max-h-[80px] overflow-y-auto">
            {triggerLog.slice(-5).reverse().map((entry, i) => (
              <div key={`${entry.beatId}-${i}`} className="text-[9px] text-gray-500">
                <span className={entry.triggeredBy === 'carl' ? 'text-carl' : 'text-paul'}>
                  {entry.triggeredBy}
                </span>
                {' '}&rarr;{' '}
                <span className="text-gray-400">{entry.beatId}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default DevAIOverlay;
