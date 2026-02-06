import { Vector3 } from '@babylonjs/core';

export interface Vehicle {
    position: Vector3;
    velocity: Vector3;
    mass: number;
    maxSpeed: number;
    maxForce: number;
}

export class SteeringBehaviors {

    public static seek(vehicle: Vehicle, target: Vector3): Vector3 {
        // Desired velocity = vector to target at max speed
        const desired = target.subtract(vehicle.position).normalize().scale(vehicle.maxSpeed);
        // Steering = Desired - Velocity
        return desired.subtract(vehicle.velocity);
    }

    public static flee(vehicle: Vehicle, target: Vector3): Vector3 {
        // Desired velocity = vector FROM target at max speed
        const desired = vehicle.position.subtract(target).normalize().scale(vehicle.maxSpeed);
        return desired.subtract(vehicle.velocity);
    }

    public static wander(vehicle: Vehicle, wanderTarget: Vector3, radius: number, distance: number, jitter: number): Vector3 {
        // Add random jitter to wander target
        const randomDisp = new Vector3(
            (Math.random() - 0.5) * jitter,
            0,
            (Math.random() - 0.5) * jitter
        );

        wanderTarget.addInPlace(randomDisp);
        wanderTarget.normalize().scaleInPlace(radius);

        // Project circle in front of vehicle
        const forward = vehicle.velocity.clone().normalize().scale(distance);
        const target = forward.add(wanderTarget);

        return target; // Force in that direction? Actually Steering = target - position? 
        // Simple implementation: Return a force to turn towards the wander point on the circle

        // Let's us simple Seek to the projected point?
        // Actually, wanderTarget should be relative to vehicle.

        // Simpler Wander:
        // Randomly change direction slightly
        return randomDisp.scale(vehicle.maxForce); // Placeholder for robust wander
    }
}

export class SteeringSystem {
    private vehicles: Map<string, Vehicle> = new Map();

    public register(id: string, position: Vector3) {
        this.vehicles.set(id, {
            position: position.clone(),
            velocity: new Vector3(0, 0, 0),
            mass: 1.0,
            maxSpeed: 2.0,
            maxForce: 5.0
        });
    }

    public update(deltaTime: number) {
        const dt = deltaTime / 1000;

        this.vehicles.forEach((vehicle, _id) => {
            // Apply steering forces
            // For now, simple friction/damping

            // Update Position
            const step = vehicle.velocity.scale(dt);
            vehicle.position.addInPlace(step);

            // Sync with ECS/Babylon logic needs to happen outside or via callback
        });
    }

    public getVehicle(id: string) {
        return this.vehicles.get(id);
    }
}
