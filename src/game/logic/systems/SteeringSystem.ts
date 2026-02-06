import { Vector3 } from '@babylonjs/core';
import { rng } from '../../../core/RandomManager';
import { Entity, world } from '../ECS';

export class SteeringSystem {

    public update(deltaTime: number) {
        // Delta time in seconds
        const dt = deltaTime / 1000;

        // Query entities with vehicle component
        const entities = world.where((e) => !!e.vehicle && !!e.position);

        for (const entity of entities) {
            this.updateVehicle(entity, dt);
        }
    }

    private updateVehicle(entity: Entity, dt: number) {
        if (!entity.vehicle || !entity.position) return;

        const { vehicle, position } = entity;

        // 1. Calculate Steering Force (accumulated from behaviors)
        // Ensure steering force doesn't exceed maxForce
        if (vehicle.steering.length() > vehicle.maxForce) {
            vehicle.steering.normalize().scaleInPlace(vehicle.maxForce);
        }

        // 2. Apply Force to Velocity
        // Acceleration = Force / Mass
        const acceleration = vehicle.steering.scale(1 / vehicle.mass);
        vehicle.velocity.addInPlace(acceleration.scale(dt));

        // 3. Limit Speed
        if (vehicle.velocity.length() > vehicle.maxSpeed) {
            vehicle.velocity.normalize().scaleInPlace(vehicle.maxSpeed);
        }

        // 4. Update Position
        // If PhysicsBody exists, we should probably apply force/velocity there instead?
        // Phase 4 said "Havok Physics & Interactions" are done.
        // So if we have a physics body, we should drive it kinematically or via forces.

        if (entity.mesh && entity.mesh.physicsBody) {
            // Apply velocity to Havok body
            // This overrides physics gravity if we set linear velocity directly?
            // Better to apply impulse or force for "True" physics, but for game AI, 
            // setting linear velocity (preserving Y for gravity?) is often more stable.

            // For now, let's assume we drive the character via physics if present.
            // But getting linear velocity from Havok is async/ref based.

            // Hybrid approach: 
            // If we want FULL physics control, we apply forces.
            // If we want "AI" control, we set velocity.

            entity.mesh.physicsBody.setLinearVelocity(vehicle.velocity);

            // Sync Entity Position from Mesh (Physics is truth)
            // entity.position.copyFrom(entity.mesh.position);
        } else {
            // Simple Euler integration for non-physics entities
            position.addInPlace(vehicle.velocity.scale(dt));

            // Sync Mesh to Position
            if (entity.mesh) {
                entity.mesh.position.copyFrom(position);

                // Rotate to face movement
                if (vehicle.velocity.lengthSquared() > 0.001) {
                    entity.mesh.lookAt(position.add(vehicle.velocity));
                }
            }
        }

        // Reset steering for next frame
        vehicle.steering.setAll(0);
    }

    // --- Behaviors ---

    // Seek: Steer towards target
    public seek(entity: Entity, target: Vector3, weight: number = 1.0) {
        if (!entity.vehicle || !entity.position) return;

        const desired = target.subtract(entity.position).normalize().scale(entity.vehicle.maxSpeed);
        const steer = desired.subtract(entity.vehicle.velocity);

        entity.vehicle.steering.addInPlace(steer.scale(weight));
    }

    // Flee: Steer away from target
    public flee(entity: Entity, target: Vector3, weight: number = 1.0) {
        if (!entity.vehicle || !entity.position) return;

        const desired = entity.position.subtract(target).normalize().scale(entity.vehicle.maxSpeed);
        const steer = desired.subtract(entity.vehicle.velocity);

        entity.vehicle.steering.addInPlace(steer.scale(weight));
    }

    // Wander: Random movement
    public wander(entity: Entity, radius: number = 5, jitter: number = 10, weight: number = 1.0) {
        if (!entity.vehicle || !entity.position) return;

        // Initialize wander target if missing
        if (!entity.vehicle.wanderTarget) {
            entity.vehicle.wanderTarget = new Vector3(0, 0, 1);
        }

        // Add jitter
        const randomX = (rng.float() - 0.5) * jitter;
        const randomZ = (rng.float() - 0.5) * jitter;

        entity.vehicle.wanderTarget.x += randomX;
        entity.vehicle.wanderTarget.z += randomZ;

        // Constrain to circle on XZ plane
        entity.vehicle.wanderTarget.normalize().scaleInPlace(radius);



        // Project in front of vehicle
        // Need to convert "Local Wander Target" to "World Space" relative to vehicle heading
        // This is complex without a transform matrix.

        // SIMPLIFIED WANDER:
        // Just pick a random point nearby every few seconds? 
        // No, we want smooth Reynolds wandering.

        // Current Heading
        const forward = entity.vehicle.velocity.clone().normalize();
        if (forward.lengthSquared() < 0.01) forward.set(0, 0, 1);

        // We can just add the constrained random vector to the current heading?
        const desired = forward.scale(5).add(entity.vehicle.wanderTarget).normalize().scale(entity.vehicle.maxSpeed);
        const steer = desired.subtract(entity.vehicle.velocity);

        entity.vehicle.steering.addInPlace(steer.scale(weight));
    }
}
