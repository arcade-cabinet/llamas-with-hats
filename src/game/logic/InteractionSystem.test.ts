import { Vector3 } from '@babylonjs/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Random
vi.mock('../../core/RandomManager', () => ({
    rng: {
        float: (min = 0, max = 1) => min,
        start: () => { },
        bool: () => false
    }
}));

// Mock Audio
vi.mock('../../core/AudioManager', () => ({
    audioManager: {
        play: vi.fn()
    }
}));

describe('Interaction System', () => {
    let GameEngineClass: any;
    let engine: any;
    let world: any;
    let Entity: any;

    let paul: any;
    let carl: any;
    let food: any;
    let physicsObj: any;

    beforeAll(async () => {
        // Mock Window BEFORE imports
        const listeners: Record<string, Function> = {};
        vi.stubGlobal('window', {
            addEventListener: (e: string, cb: Function) => listeners[e] = cb,
            dispatchEvent: (e: any) => true
        });
        vi.stubGlobal('document', {});
        vi.stubGlobal('KeyboardEvent', class { constructor() { } });

        // Dynamic Imports
        const ecsModule = await import('./ECS');
        world = ecsModule.world;
        Entity = ecsModule.Entity;

        const gameEngineModule = await import('./GameEngine');
        GameEngineClass = gameEngineModule.GameEngine;
    });

    beforeEach(() => {
        // Clear world
        world.entities.forEach((e: any) => world.remove(e));

        // Setup Engine
        engine = GameEngineClass.getInstance();

        // Setup Entities
        paul = world.add({ id: 'paul', position: new Vector3(0, 0, 0) });
        carl = world.add({ id: 'carl', position: new Vector3(2, 0, 0) });

        // Mock Mesh/Physics for props
        const mockMesh = {
            dispose: vi.fn(),
            position: new Vector3(1, 0, 0),
            absolutePosition: new Vector3(1, 0, 0),
            physicsBody: { applyImpulse: vi.fn() }
        };

        food = world.add({ id: 'food1', isFood: true, mesh: mockMesh });

        const mockPhysicsMesh = {
            dispose: vi.fn(),
            position: new Vector3(3, 0, 0),
            absolutePosition: new Vector3(3, 0, 0),
            physicsBody: { applyImpulse: vi.fn() }
        };

        physicsObj = world.add({ id: 'box1', mesh: mockPhysicsMesh });
    });

    it('Paul should clean (dispose) food', () => {
        engine.handleInteraction('food1', 'paul');

        expect(food.mesh?.dispose).toHaveBeenCalled();
        const check = world.where((e: any) => e.id === 'food1').first;
        expect(check).toBeUndefined();
    });

    it('Carl should kick (impulse) physics objects', () => {
        engine.handleInteraction('box1', 'carl');

        expect(physicsObj.mesh?.physicsBody?.applyImpulse).toHaveBeenCalled();
        expect(physicsObj.mesh?.dispose).not.toHaveBeenCalled();
    });

    it('Carl should kick food instead of cleaning it', () => {
        engine.handleInteraction('food1', 'carl');

        expect(food.mesh?.physicsBody?.applyImpulse).toHaveBeenCalled();
        expect(food.mesh?.dispose).not.toHaveBeenCalled();
    });
});
