export type GameToastType =
  | 'item_acquired'
  | 'goal_complete'
  | 'goal_failed'
  | 'story_beat'
  | 'area_unlocked'
  | 'achievement';

export interface GameToastData {
  id: number;
  type: GameToastType;
  message: string;
  icon?: string;
  timestamp: number;
}
