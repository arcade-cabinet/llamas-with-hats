import { Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { Entity, world } from '../ECS';
import { SteeringSystem } from './SteeringSystem';

describe('SteeringSystem', () => {
    let system: SteeringSystem;
    let entity: Entity;

    beforeEach(() => {
        // Clear world
        world.entities.forEach(e => world.remove(e));

        system = new SteeringSystem();

        // Add entity to world
        entity = world.add({
            id: 'test-entity',
            position: new Vector3(0, 0, 0),
            vehicle: {
                velocity: new Vector3(0, 0, 0),
                steering: new Vector3(0, 0, 0),
                mass: 1.0,
                maxSpeed: 10.0,
                maxForce: 10.0
            }
        });
    });

    it('SEEK should produce force towards target', () => {
        const target = new Vector3(10, 0, 0);
        system.seek(entity, target);

        // Desired velocity is (10,0,0) normalized * maxSpeed(10) = (10,0,0)
        // Steering = Desired - Velocity
        expect(entity.vehicle?.steering.x).toBeGreaterThan(0);
        expect(entity.vehicle?.steering.y).toBe(0);
        expect(entity.vehicle?.steering.z).toBe(0);
    });

    it('FLEE should produce force away from target', () => {
        const target = new Vector3(10, 0, 0);
        system.flee(entity, target);

        // Desired velocity is (0,0,0) - (10,0,0) normalized * maxSpeed = (-1,0,0)*10 = (-10, 0, 0)
        expect(entity.vehicle?.steering.x).toBeLessThan(0);
    });

    it('Update should modify velocity and position', () => {
        // Apply a force manually
        if (entity.vehicle) {
            entity.vehicle.steering.set(10, 0, 0);
        }

        system.update(1000); // 1 second

        // Acceleration = Force(10) / Mass(1) = 10
        // Velocity += Accel * dt(1) = 10
        expect(entity.vehicle?.velocity.x).toBeCloseTo(10);

        // Position += Velocity * dt(1) = 10
        expect(entity.position?.x).toBeCloseTo(10);
    });
});
