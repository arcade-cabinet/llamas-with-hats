import { Scene, Vector3 } from '@babylonjs/core';
import { gameEngine } from '../logic/GameEngine';
import { AssetFactory } from './assets/AssetFactory';

export class FoodSpawner {
    private spawnTimer: number = 0;
    private spawnInterval: number = 5000;
    private assetFactory: AssetFactory;

    constructor(scene: Scene) {
        this.assetFactory = new AssetFactory(scene);
    }

    public update(deltaTime: number, horrorLevel: number) {
        // Rate depends on horror level
        // Higher horror = faster spawns (more chaos) or slower (starvation)?
        // Let's say higher horror = faster spawns to feed the beast.
        const currentInterval = Math.max(2000, this.spawnInterval - (horrorLevel * 300));

        this.spawnTimer += deltaTime;

        if (this.spawnTimer >= currentInterval) {
            this.spawnTimer = 0;
            this.spawnFood();
        }
    }

    private spawnFood() {
        // Spawn Procedural Meat (or Hand)
        const id = `food_${Date.now()}`;
        const position = new Vector3(
            (Math.random() - 0.5) * 4,
            3, // Drop from sky
            (Math.random() - 0.5) * 4
        );

        // Randomly choose between Meat and Hand?
        const isHand = Math.random() > 0.7; // 30% chance of hand
        let mesh;

        if (isHand) {
            mesh = this.assetFactory.createSeveredHand(id, position);
        } else {
            mesh = this.assetFactory.createCartoonMeat(id, position);
        }

        // Register to ECS
        gameEngine.spawnEntity({
            id: id,
            type: 'prop',
            mesh: mesh,
            position: position,
            isFood: true
        });
    }
}
