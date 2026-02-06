import { AbstractMesh, Scene, Vector3 } from '@babylonjs/core';
import { audioManager } from '../../core/AudioManager';
import { rng } from '../../core/RandomManager';
import { Entity, world } from './ECS';
import { ScenarioManager } from './ScenarioManager';
import { StateMachine } from './StateMachine';
import { PlayerControlSystem } from './systems/PlayerControlSystem';
import { ProceduralAnimator } from './systems/ProceduralAnimator';
import { SteeringSystem } from './systems/SteeringSystem';

export class GameEngine {
    private static instance: GameEngine;
    private _scene: Scene | null = null;
    private isProcessing = false;

    public get scene(): Scene | null {
        return this._scene;
    }
    private stateMachines: Map<string, StateMachine> = new Map();
    public scenarioManager: ScenarioManager | null = null;
    public steeringSystem: SteeringSystem;
    private proceduralAnimator: ProceduralAnimator;
    public playerControlSystem: PlayerControlSystem;

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
            // Initialize Steering/Vehicle Component
            entity.vehicle = {
                velocity: new Vector3(0, 0, 0),
                steering: new Vector3(0, 0, 0),
                mass: 1.0,
                maxSpeed: 2.0,
                maxForce: 5.0
            };

            this.setupLlamaStateMachine(entity);
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
            onUpdate: (e, _dt) => {
                // If this is the Active Player, skip AI behaviors
                if (gameEngine.playerControlSystem.activeCharacterId === e.id) {
                    // Player Control System handles movement
                    return;
                }

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

                    if (food && food.mesh && e.mesh && e.vehicle) {
                        // Steer Seek to food
                        gameEngine.steeringSystem.seek(e, food.mesh.position);

                        // Despawn if close
                        if (Vector3.Distance(e.mesh.position, food.mesh.position) < 1.0) {
                            food.mesh.dispose();
                            world.remove(food);
                            // Audio: Paul logic handled in interaction mostly, but could add "Disgusting" here
                            audioManager.play('crunch', 1.0, rng.float(0.8, 1.2)); // Reuse crunch for clean up?
                        }
                        return; // Skip wandering if cleaning
                    }
                }

                // Carl / Default Wandering
                if (e.position && e.vehicle) {
                    // Chaos Timer
                    const now = Date.now();
                    if (!(e as any).chaosTimer || now > (e as any).chaosTimer) {
                        (e as any).chaosTimer = now + 5000 + rng.float(0, 5000);

                        // Find something to mess with
                        const physicsObjs = world.where(obj => !!obj.mesh?.physicsBody && obj.id !== e.id);
                        let targetToKick = null;
                        for (const obj of physicsObjs) {
                            if (Vector3.Distance(obj.mesh!.position, e.position) < 2.0) {
                                targetToKick = obj;
                                break;
                            }
                        }

                        if (targetToKick && targetToKick.id) {
                            gameEngine.handleInteraction(targetToKick.id, e.id!);
                        }
                    }

                    gameEngine.steeringSystem.wander(e, 5, 10, 1.0);
                }
            }
        });

        sm.transitionTo('idle');
        this.stateMachines.set(entity.id, sm);
    }

    public handleInteraction(targetId: string, sourceId: string) {
        // Find entities
        const target = world.where(e => e.id === targetId).first;

        if (target && target.mesh) {
            const isFood = target.isFood;

            // Paul Logic: Dispose of food/mess
            if (sourceId === 'paul' && isFood) {
                target.mesh.dispose();
                world.remove(target);
                this.scenarioManager?.reportAction('DISPOSE');
                audioManager.play('crunch', 1.0, rng.float(0.8, 1.2)); // Clean crunch
                return;
            }

            // Carl Logic: Throw / Chaos
            if (sourceId === 'carl' && target.mesh.physicsBody) {
                let direction = new Vector3((rng.float() - 0.5) * 2, 5, (rng.float() - 0.5) * 2);

                if (isFood) {
                    // Throw AT someone?
                    const other = world.where(e => e.id === (sourceId === 'carl' ? 'paul' : 'carl')).first;
                    if (other && other.mesh) {
                        const dirToOther = other.mesh.position.subtract(target.mesh.position).normalize();
                        direction = dirToOther.scale(5).add(new Vector3(0, 3, 0));
                    }
                }

                target.mesh.physicsBody.applyImpulse(direction, target.mesh.absolutePosition);
                audioManager.play('throw', 1.0, rng.float(0.9, 1.1));
                this.scenarioManager?.reportAction('KICK');
            }
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
