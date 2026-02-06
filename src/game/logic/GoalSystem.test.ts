import { AbstractMesh, Scene } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScenarioManager } from './ScenarioManager';

// Mock Random
vi.mock('../../core/RandomManager', () => ({
    rng: { float: () => 0.5, bool: () => false }
}));

// Mock Audio
vi.mock('../../core/AudioManager', () => ({
    audioManager: { play: vi.fn() }
}));

// Mock AssetFactory
vi.mock('../scenes/assets/AssetFactory', () => ({
    AssetFactory: class {
        createCartoonMeat() { return {} as AbstractMesh; }
    }
}));

// Mock GameEngine/World
vi.mock('./GameEngine', () => ({
    gameEngine: { spawnEntity: vi.fn() }
}));

vi.mock('./ECS', () => ({
    world: { where: () => ({ size: 0 }) }
}));

describe('ScenarioManager Goals', () => {
    let scenarioManager: ScenarioManager;

    beforeEach(() => {
        const mockScene = {} as Scene;
        scenarioManager = new ScenarioManager(mockScene);
    });

    it('should track KICK goals', () => {
        // Initial state
        expect(scenarioManager.currentGoalDescription).toContain("Knock over 3 items (0/3)");

        // Kick 1
        scenarioManager.reportAction('KICK');
        expect(scenarioManager.currentGoalDescription).toContain("(1/3)");

        // Kick 3 -> Complete
        scenarioManager.reportAction('KICK');
        scenarioManager.reportAction('KICK');

        // Next Goal
        expect(scenarioManager.currentGoalDescription).toContain("Eat 3 Hands");
    });
});
