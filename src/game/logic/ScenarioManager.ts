
import { Scene, Vector3 } from '@babylonjs/core';
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

    constructor(scene: Scene) {
        this.assetFactory = new AssetFactory(scene);
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

    public reportAction(action: 'EAT' | 'DISPOSE') {
        if (this.currentScenario === 'THE_HUNGER') {
            if (action === 'EAT') {
                this.meatEatenCount++;
                console.log(`Carl fed! Progress: ${this.meatEatenCount}/3`);
            } else if (action === 'DISPOSE') {
                this.meatDisposedCount++;
                console.log(`Paul cleaned! Progress: ${this.meatDisposedCount}/3`);
            }

            this.checkWinCondition();
        }
    }

    private checkWinCondition() {
        if (this.meatEatenCount >= 3) {
            console.log("CARL WINS: The Hunger Satisfied.");
            // Transition or Reset
        } else if (this.meatDisposedCount >= 3) {
            console.log("PAUL WINS: The Apartment is Clean.");
            // Transition or Reset
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
