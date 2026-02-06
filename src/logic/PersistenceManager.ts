import { GameState } from '../hooks/useGameState';
import { world } from './ECS';

const STORAGE_KEY = 'llamas_persistence_v1';

export interface SavedState {
    gameState: Partial<GameState>;
    entities: {
        id: string;
        position: { x: number, y: number, z: number };
        rotation?: { x: number, y: number, z: number, w: number };
        isRemoved?: boolean;
    }[];
}

export class PersistenceManager {
    private static instance: PersistenceManager;

    public static getInstance(): PersistenceManager {
        if (!PersistenceManager.instance) {
            PersistenceManager.instance = new PersistenceManager();
        }
        return PersistenceManager.instance;
    }

    public save(gameState: GameState) {
        const savedEntities = Array.from(world.entities).filter(e => !!e.id).map(entity => {
            const result: any = {
                id: entity.id,
                isRemoved: entity.isRemoved
            };

            // Prefer mesh transform if available for accuracy
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
            return result;
        });

        const stateToSave: SavedState = {
            gameState: {
                horrorLevel: gameState.horrorLevel
            },
            entities: savedEntities
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }

    public load(): SavedState | null {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn("Failed to load state", e);
            return null;
        }
    }
}

export const persistenceManager = PersistenceManager.getInstance();
