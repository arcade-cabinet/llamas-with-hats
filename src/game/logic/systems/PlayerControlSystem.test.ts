import { Vector3 } from '@babylonjs/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Entity, world } from '../ECS';
// We need to mock window BEFORE importing the system if we want to catch the first instance creation properly 
// OR validly handle the singleton nature.

// 1. Define Listeners holder outside
const listeners: Record<string, Function> = {};

// 2. Stub global window immediately (hoisted usually, but explicit here)
vi.stubGlobal('window', {
    addEventListener: (e: string, cb: Function) => {
        listeners[e] = cb;
    },
    dispatchEvent: (e: any) => {
        if (listeners[e.type]) listeners[e.type](e);
        return true;
    }
});
vi.stubGlobal('document', {});
vi.stubGlobal('KeyboardEvent', class {
    constructor(public type: string, public init: any) { }
    get key() { return this.init.key; }
    preventDefault() { }
});

import { PlayerControlSystem } from './PlayerControlSystem';

describe('PlayerControlSystem', () => {
    let system: PlayerControlSystem;
    let entityPaul: Entity;
    let entityCarl: Entity;

    beforeAll(() => {
        // Ensure system is initialized once and listeners attached
        system = PlayerControlSystem.getInstance();
    });

    beforeEach(() => {
        // Clear world
        world.entities.forEach(e => world.remove(e));

        // Add entities
        entityPaul = world.add({ id: 'paul', position: new Vector3(0, 0, 0), vehicle: { velocity: Vector3.Zero(), steering: Vector3.Zero(), mass: 1, maxSpeed: 10, maxForce: 10 } });
        entityCarl = world.add({ id: 'carl', position: new Vector3(0, 0, 0), vehicle: { velocity: Vector3.Zero(), steering: Vector3.Zero(), mass: 1, maxSpeed: 10, maxForce: 10 } });

        // Reset Inputs manually (simulate keyup on everything)
        // Since we don't know what's pressed, we could just rely on tests being clean.
        // Or blindly keyup 'w', 'a', 's', 'd'
        ['w', 'a', 's', 'd', 'arrowup'].forEach(k => {
            const up = new KeyboardEvent('keyup', { key: k });
            window.dispatchEvent(up);
        });
    });

    it('should toggle character', () => {
        const initial = system.activeCharacterId;

        // Simulate Tab
        const tab = new KeyboardEvent('keydown', { key: 'Tab' });
        window.dispatchEvent(tab);

        expect(system.activeCharacterId).not.toBe(initial);

        // Toggle back
        window.dispatchEvent(tab);
        expect(system.activeCharacterId).toBe(initial);
    });

    it('should not apply force if no input', () => {
        // Ensure Paul is active
        if (system.activeCharacterId !== 'paul') {
            const tab = new KeyboardEvent('keydown', { key: 'Tab' });
            window.dispatchEvent(tab);
        }

        system.update(1000);

        // Steering should be zero (or braking)
        expect(entityPaul.vehicle?.steering.length()).toBe(0);
    });

    it('should apply force on input', () => {
        // Ensure Paul is active
        if (system.activeCharacterId !== 'paul') {
            const tab = new KeyboardEvent('keydown', { key: 'Tab' });
            window.dispatchEvent(tab);
        }

        // Simulate KeyDown
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));

        system.update(1000);

        // Should have steering force in Z (forward)
        expect(entityPaul.vehicle?.steering.z).toBeGreaterThan(0);
    });
});
