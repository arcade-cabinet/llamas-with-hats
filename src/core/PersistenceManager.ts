import { Entity, world } from '../game/logic/ECS';
import { GameState } from '../ui/hooks/useGameState';

const STORAGE_KEY = 'llamas_persistence_v1';

export class PersistenceManager {
    private static instance: PersistenceManager;

    private constructor() { }

    public static getInstance(): PersistenceManager {
        if (!PersistenceManager.instance) {
            PersistenceManager.instance = new PersistenceManager();
        }
        return PersistenceManager.instance;
    }

    public save(gameState: GameState) {
        // We cast to any in map to allow checking properties, but strictly define expected output
        const savedEntities = Array.from(world.entities).filter(e => !!e.id).map((e) => {
            const entity = e as Entity; // Type assertion since Miniplex entities are flexible
            const result: any = {
                id: entity.id,
                isRemoved: entity.isRemoved
            };

            // Mesh vs ECS Position Logic
            if (entity.mesh) {
                result.position = { x: entity.mesh.position.x, y: entity.mesh.position.y, z: entity.mesh.position.z };
                if (entity.mesh.rotationQuaternion) {
                    result.rotation = { x: entity.mesh.rotationQuaternion.x, y: entity.mesh.rotationQuaternion.y, z: entity.mesh.rotationQuaternion.z, w: entity.mesh.rotationQuaternion.w };
                }
            } else if (entity.position) {
                result.position = { x: entity.position.x, y: entity.position.y, z: entity.position.z };
                if (entity.rotation) {
                    result.rotation = { x: entity.rotation.x, y: entity.rotation.y, z: entity.rotation.z, w: entity.rotation.w };
                }
            }

            // Stats
            if (entity.type === 'carl') {
                result.hungerLevel = entity.hungerLevel;
            }

            return result;
        });

        const data = {
            gameState,
            entities: savedEntities,
            timestamp: Date.now()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('[PersistenceManager] Game Saved');
    }

    public load(): { gameState: GameState, entities: any[] } | null {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) return null;

        try {
            return JSON.parse(json);
        } catch (e) {
            console.error('[PersistenceManager] Load failed', e);
            return null;
        }
    }

    public clear() {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export const persistenceManager = PersistenceManager.getInstance();
