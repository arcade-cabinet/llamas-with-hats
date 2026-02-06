import { AbstractMesh, Scene, Vector3 } from '@babylonjs/core';
import { audioManager } from '../../core/AudioManager';
import { rng } from '../../core/RandomManager';
import { Entity, world } from './ECS';
import { ScenarioManager } from './ScenarioManager';
import { StateMachine } from './StateMachine';
import { SteeringSystem } from './ai/SteeringBehaviors';
import { PlayerControlSystem } from './systems/PlayerControlSystem';
import { ProceduralAnimator } from './systems/ProceduralAnimator';

export class GameEngine {
    private static instance: GameEngine;
    private _scene: Scene | null = null;
    private isProcessing = false;

    public get scene(): Scene | null {
        return this._scene;
    }
    private stateMachines: Map<string, StateMachine> = new Map();
    private scenarioManager: ScenarioManager | null = null;
    private steeringSystem: SteeringSystem;
    private proceduralAnimator: ProceduralAnimator;
    private playerControlSystem: PlayerControlSystem;

    private constructor() {
        this.steeringSystem = new SteeringSystem();
        this.proceduralAnimator = ProceduralAnimator.getInstance();
        this.playerControlSystem = PlayerControlSystem.getInstance();
    }

    public static getInstance(): GameEngine {
        if (!GameEngine.instance) {
            GameEngine.instance = new GameEngine();
        }
        return GameEngine.instance;
    }

    public setScene(scene: Scene) {
        this._scene = scene;
        this.scenarioManager = new ScenarioManager(scene);
    }

    public spawnEntity(config: any) {
        const entity = world.add({
            ...config,
        });

        if (entity.id && (entity.type === 'carl' || entity.type === 'paul')) {
            this.setupLlamaStateMachine(entity);
            // Register with Steering
            if (entity.position) {
                this.steeringSystem.register(entity.id, entity.position);
            }
        }

        return entity;
    }

    private setupLlamaStateMachine(entity: Entity) {
        if (!entity.id) return;

        const sm = new StateMachine(entity);

        // Common Idle State
        sm.addState({
            name: 'idle',
            onEnter: (e) => {
                (e as any).wanderTimer = 2000 + rng.float(0, 8000);
            },
            onUpdate: (e, dt) => {
                // Animation bob
                if (e.mesh) {
                    e.mesh.scaling.y = 1 + Math.sin(Date.now() / 1000) * 0.01;
                }

                // NOTE: Movement logic will move to SteeringSystem soon
                // For now, keeping legacy simple wander here until Steering is fully wired to StateMachine

                if (entity.type === 'paul') {
                    // Paul AI: Scold / Cleanup
                    // Search for food
                    const food = world.where((f): f is Entity & { mesh: AbstractMesh; isFood: boolean } => !!f.isFood && !!f.mesh && !f.isRemoved).first;

                    if (food && food.mesh && e.mesh) {
                        // Move to food
                        const dir = food.mesh.position.subtract(e.mesh.position).normalize();
                        const speed = 0.003 * dt;
                        // Store original y to prevent flying
                        const currentY = e.position?.y || 0;
                        e.position = e.mesh.position.add(dir.scale(speed));
                        e.position.y = currentY;

                        // Despawn if close
                        if (Vector3.Distance(e.mesh.position, food.mesh.position) < 1.0) {
                            food.mesh.dispose();
                            world.remove(food);
                            // Audio: Paul logic handled in interaction mostly, but could add "Disgusting" here
                        }
                        return; // Skip wandering if cleaning
                    }
                }

                // Carl / Default Wandering
                if (e.position) {
                    (e as any).wanderTimer -= dt;
                    if ((e as any).wanderTimer <= 0) {
                        const targetX = (rng.float() - 0.5) * 4;
                        const targetZ = (rng.float() - 0.5) * 4;
                        e.position = new Vector3(targetX, e.position.y, targetZ);
                        (e as any).wanderTimer = 5000 + rng.float(0, 10000);
                    }
                }
            }
        });

        sm.transitionTo('idle');
        this.stateMachines.set(entity.id, sm);
    }

    public handleInteraction(entityId: string) {
        // Find entity
        const entity = world.where(e => e.id === entityId).first;
        if (entity && entity.mesh && entity.mesh.physicsBody) {
            const activeChar = this.playerControlSystem.activeCharacterId;
            const isFood = entity.isFood;

            // Paul Logic: Dispose of food/mess
            if (activeChar === 'paul' && isFood) {
                // Audio? "Paul: Disgusting."
                entity.mesh.dispose();
                world.remove(entity);
                this.scenarioManager?.reportAction('DISPOSE');
                return;
            }

            // Carl Logic: Throw / Eat?
            // Existing Throw Logic
            let direction = new Vector3((rng.float() - 0.5) * 2, 5, (rng.float() - 0.5) * 2);

            if (isFood) {
                const carl = world.where(e => e.id === 'carl').first;
                if (carl && carl.mesh) {
                    // Throw towards Carl
                    const dirToCarl = carl.mesh.position.subtract(entity.mesh.position).normalize();
                    direction = dirToCarl.scale(5).add(new Vector3(0, 3, 0)); // Arc it
                }
            }

            entity.mesh.physicsBody.applyImpulse(direction, entity.mesh.absolutePosition);

            // Audio: Throw sound
            audioManager.play('throw', 1.0, rng.float(0.9, 1.1));
        }
    }

    public update(deltaTime: number, horrorLevel: number) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Update state machines
        this.stateMachines.forEach(sm => sm.update(deltaTime));

        // Systems
        this.scenarioManager?.update(deltaTime, horrorLevel);
        this.steeringSystem.update(deltaTime);
        this.proceduralAnimator.update(deltaTime);
        this.playerControlSystem.update(deltaTime);
        this.hungerSystem(deltaTime);

        this.isProcessing = false;
    }

    // System: Increases hunger for Carl over time
    private hungerSystem(deltaTime: number) {
        const carl = world.where(e => e.id === 'carl').first;
        if (!carl) return;

        // Initialize if missing
        if (typeof carl.hungerLevel === 'undefined') {
            carl.hungerLevel = 0;
        }

        // Increase hunger
        const increaseRate = 0.005 * deltaTime; // slightly faster
        carl.hungerLevel = Math.min(100, carl.hungerLevel + increaseRate);

        // Check for Food near Carl
        const foods = world.where((e): e is Entity & { mesh: AbstractMesh; isFood: boolean } => !!e.isFood && !!e.mesh && !e.isRemoved);

        for (const food of foods) {
            if (carl.mesh && food.mesh && carl.mesh.position.subtract(food.mesh.position).length() < 1.5) {
                // EAT IT
                carl.hungerLevel = Math.max(0, carl.hungerLevel - 20);

                // Despawn food logic
                food.mesh.dispose();
                world.remove(food);

                // Trigger 'Crunch' sound
                audioManager.play('crunch', 1.0, rng.float(0.8, 1.2));
            }
        }

        // Trigger Tantrum / Warn
        if (carl.hungerLevel > 80) {
            // Tantrum logic could impulse physics here
            if (rng.bool(0.01)) {
                // Random shake or hop
                if (carl.mesh && carl.mesh.physicsBody) {
                    const impulse = new Vector3((rng.float() - 0.5) * 5, 2, (rng.float() - 0.5) * 5);
                    carl.mesh.physicsBody.applyImpulse(impulse, carl.mesh.absolutePosition);
                    audioManager.play('speech_carl_scream', 0.5); // Occasional scream
                }
            }
        }
    }
}
export const gameEngine = GameEngine.getInstance();
