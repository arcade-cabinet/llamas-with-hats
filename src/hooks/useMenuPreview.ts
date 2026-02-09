import { useEffect, useState } from 'react';
import { initializeGame } from '../systems/GameInitializer';
import { getStartingStage } from '../data';
import type { GeneratedLayout } from '../systems/LayoutGenerator';
import type { RoomConfig, WorldSeed } from '../types/game';

// Fixed seed for menu background — deterministic so the menu always looks the same
const MENU_SEED: WorldSeed = {
  adjective1: 'Dark',
  adjective2: 'Twisted',
  noun: 'House',
  seedString: 'Dark-Twisted-House'
};

export function useMenuPreview() {
  const [menuLayout, setMenuLayout] = useState<GeneratedLayout | null>(null);
  const [menuAllRoomConfigs, setMenuAllRoomConfigs] = useState<Map<string, RoomConfig> | null>(null);
  const [menuRoom, setMenuRoom] = useState<RoomConfig | null>(null);

  useEffect(() => {
    const stageId = getStartingStage();
    initializeGame(stageId, 'carl', MENU_SEED).then(game => {
      if (!game.layout) {
        throw new Error(`Stage "${stageId}" failed to generate a layout — every stage must have a layout`);
      }
      setMenuLayout(game.layout);
      setMenuAllRoomConfigs(game.allRoomConfigs);
      setMenuRoom(game.getCurrentRoom());
    }).catch(e => {
      console.error('[App] Failed to initialize menu layout:', e);
      throw e;
    });
  }, []);

  return { menuLayout, menuAllRoomConfigs, menuRoom };
}
