
import { Scene, Vector3 } from '@babylonjs/core';
import { audioManager } from '../../core/AudioManager';
import { AssetFactory } from '../scenes/assets/AssetFactory';
import { world } from './ECS';
import { gameEngine } from './GameEngine';

export type ScenarioType = 'THE_HUNGER' | 'THE_EVIDENCE';

export class ScenarioManager {
    private assetFactory: AssetFactory;
    private currentScenario: ScenarioType = 'THE_HUNGER';
    private timer: number = 0;

    // Scenario 1: The Hunger Stats
    private meatSpawnedCount = 0;
    private meatEatenCount = 0;
    private meatDisposedCount = 0;

    // Chaos Goals
    private chaosGoals = [
        { description: "Knock over 3 items", target: 3, current: 0, type: 'KICK' },
        { description: "Eat 3 Hands", target: 3, current: 0, type: 'EAT_HAND' }, // Future
    ];
    private currentChaosGoalIndex = 0;

    constructor(scene: Scene) {
        this.assetFactory = new AssetFactory(scene);
    }

    public get currentGoalDescription(): string {
        const goal = this.chaosGoals[this.currentChaosGoalIndex];
        return goal ? `${goal.description} (${goal.current}/${goal.target})` : "Chaos Reign.";
    }

    public update(deltaTime: number, horrorLevel: number) {
        this.timer += deltaTime;

        switch (this.currentScenario) {
            case 'THE_HUNGER':
                this.updateTheHunger(deltaTime, horrorLevel);
                break;
            case 'THE_EVIDENCE':
                // TODO
                break;
        }
    }

    public reportAction(action: 'EAT' | 'DISPOSE' | 'KICK') {
        if (this.currentScenario === 'THE_HUNGER') {
            if (action === 'EAT') {
                this.meatEatenCount++;
                console.log(`Carl fed! Progress: ${this.meatEatenCount}/3`);
            } else if (action === 'DISPOSE') {
                this.meatDisposedCount++;
                console.log(`Paul cleaned! Progress: ${this.meatDisposedCount}/3`);
            } else if (action === 'KICK') {
                // Check Goal
                const goal = this.chaosGoals[this.currentChaosGoalIndex];
                if (goal && goal.type === 'KICK') {
                    goal.current++;
                    if (goal.current >= goal.target) {
                        this.currentChaosGoalIndex++;
                        audioManager.play('speech_carl_scream', 1.0); // Victory scream?
                    }
                }
            }

            this.checkWinCondition();
        }
    }

    private checkWinCondition() {
        if (this.chaosGoals[this.currentChaosGoalIndex] === undefined) {
            console.log("CARL CHAOS COMPLETE");
        }
    }

    private updateTheHunger(_dt: number, _horrorLevel: number) {
        const foodCount = world.where((e) => !!e.isFood && !e.isRemoved).size;

        // Spawn limit
        if (foodCount < 3 && this.timer > 5000 && this.meatSpawnedCount < 10) {
            this.timer = 0;
            this.spawnPuzzleFood();
        }
    }

    private spawnPuzzleFood() {
        this.meatSpawnedCount++;
        const id = `meat_${Date.now()}`;
        // Random location in the room
        const position = new Vector3(
            (Math.random() - 0.5) * 4,
            4,
            (Math.random() - 0.5) * 4
        );

        // Procedural Meat
        const mesh = this.assetFactory.createCartoonMeat(id, position);

        gameEngine.spawnEntity({
            id: id,
            type: 'prop',
            mesh: mesh,
            position: position,
            isFood: true
        });
    }
}
