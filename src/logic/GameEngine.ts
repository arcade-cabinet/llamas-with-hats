import { AbstractMesh, Scene, Vector3 } from '@babylonjs/core';
import { Entity, world } from './ECS';
import { StateMachine } from './StateMachine';

export class GameEngine {
    private static instance: GameEngine;
    private _scene: Scene | null = null;
    private isProcessing = false;
    private stateMachines: Map<string, StateMachine> = new Map();

    private constructor() { }

    public static getInstance(): GameEngine {
        if (!GameEngine.instance) {
            GameEngine.instance = new GameEngine();
        }
        return GameEngine.instance;
    }

    public setScene(scene: Scene) {
        this._scene = scene;
    }

    public spawnEntity(config: any) {
        const entity = world.add({
            ...config,
        });

        if (entity.id && (entity.type === 'carl' || entity.type === 'paul')) {
            this.setupLlamaStateMachine(entity);
        }

        return entity;
    }

    private setupLlamaStateMachine(entity: Entity) {
        if (!entity.id) return;

        const sm = new StateMachine(entity);

        sm.addState({
            name: 'idle',
            onEnter: (e) => {
                (e as any).wanderTimer = 2000 + Math.random() * 8000;
            },
            onUpdate: (e, dt) => {
                if (e.mesh) {
                    e.mesh.scaling.y = 1 + Math.sin(Date.now() / 1000) * 0.01;
                }

                // Occasional wandering
                if (e.position) {
                    (e as any).wanderTimer -= dt;
                    if ((e as any).wanderTimer <= 0) {
                        const targetX = (Math.random() - 0.5) * 4;
                        const targetZ = (Math.random() - 0.5) * 4;
                        e.position = new Vector3(targetX, e.position.y, targetZ);
                        (e as any).wanderTimer = 5000 + Math.random() * 10000;
                    }
                }
            }
        });

        // Add other states as needed (talking, horror_react etc)

        sm.transitionTo('idle');
        this.stateMachines.set(entity.id, sm);
    }

    public update(deltaTime: number, horrorLevel: number) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Update state machines
        this.stateMachines.forEach(sm => sm.update(deltaTime));

        // Other systems...
        this.behaviorSystem(deltaTime, horrorLevel);

        this.isProcessing = false;
    }

    // System: Handles Llama behavior transitions and idle animations
    private behaviorSystem(deltaTime: number, _horrorLevel: number) {
        const actors = world.where((e): e is Entity & { mesh: AbstractMesh; behavior: string } => !!e.behavior && !!e.mesh);

        for (const entity of actors) {
            const mesh = entity.mesh;
            // Look at camera logic (simplified)
            if (this._scene && this._scene.activeCamera) {
                const camera = this._scene.activeCamera;
                const direction = camera.position.subtract(mesh.position);
                // logic to rotate...
            }
        }
    }
}

export const gameEngine = GameEngine.getInstance();
