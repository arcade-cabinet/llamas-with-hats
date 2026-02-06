import { Vector3 } from '@babylonjs/core';
import { Entity, world } from '../ECS';

export class PlayerControlSystem {
    private static instance: PlayerControlSystem;
    private activeCharId: 'carl' | 'paul' = 'paul';
    private inputMap: { [key: string]: boolean } = {};

    public get activeCharacterId() { return this.activeCharId; }

    private constructor() {
        // Setup Input Listeners
        window.addEventListener("keydown", (evt) => {
            this.inputMap[evt.key.toLowerCase()] = true;

            // Toggle Character
            if (evt.key === 'Tab') {
                evt.preventDefault(); // Prevent focus switch
                this.toggleCharacter();
            }
        });

        window.addEventListener("keyup", (evt) => {
            this.inputMap[evt.key.toLowerCase()] = false;
        });
    }

    public static getInstance() {
        if (!PlayerControlSystem.instance) {
            PlayerControlSystem.instance = new PlayerControlSystem();
        }
        return PlayerControlSystem.instance;
    }

    public toggleCharacter() {
        this.activeCharId = this.activeCharId === 'paul' ? 'carl' : 'paul';
        console.log(`Switched control to: ${this.activeCharId}`);
    }

    public update(_deltaTime: number) {
        // Find active character entity
        const entity = world.where(e => e.id === this.activeCharId).first;
        if (!entity || !entity.vehicle) return;

        const moveDir = Vector3.Zero();

        if (this.inputMap["w"] || this.inputMap["arrowup"]) {
            moveDir.z = 1;
        }
        if (this.inputMap["s"] || this.inputMap["arrowdown"]) {
            moveDir.z = -1;
        }
        if (this.inputMap["a"] || this.inputMap["arrowleft"]) {
            moveDir.x = -1;
        }
        if (this.inputMap["d"] || this.inputMap["arrowright"]) {
            moveDir.x = 1;
        }

        if (moveDir.length() > 0) {
            moveDir.normalize();

            // Apply "Seek" force in direction of input
            const desiredVelocity = moveDir.scale(entity.vehicle.maxSpeed);
            const steering = desiredVelocity.subtract(entity.vehicle.velocity);

            entity.vehicle.steering.addInPlace(steering.scale(5));
        } else {
            // Damping 2x velocity
            const braking = entity.vehicle.velocity.clone().scale(-2);
            entity.vehicle.steering.addInPlace(braking);
        }

        // Handle Actions
        if (this.inputMap[" "]) { // Spacebar
            this.inputMap[" "] = false; // consume input

            const targetId = this.findInteractionTarget(entity);

            if (targetId) {
                import('../GameEngine').then(({ gameEngine }) => {
                    gameEngine.handleInteraction(targetId, this.activeCharId);
                });
            }
        }
    }

    private findInteractionTarget(playerEntity: Entity): string | null {
        if (!playerEntity.mesh) return null;

        const candidates = world.where(e => !!e.mesh && (!!e.isFood || (!!e.mesh.physicsBody && e.id !== playerEntity.id)));

        let bestTarget: string | null = null;
        let minDist = 2.0;

        const playerForward = playerEntity.mesh.getDirection(Vector3.Forward());

        for (const candidate of candidates) {
            if (!candidate.mesh) continue;

            const toCandidate = candidate.mesh.position.subtract(playerEntity.mesh.position);
            const dist = toCandidate.length();

            if (dist < minDist) {
                toCandidate.normalize();
                const dot = Vector3.Dot(playerForward, toCandidate);

                if (dot > 0.5) { // Roughly 60 degrees
                    minDist = dist;
                    bestTarget = candidate.id || null;
                }
            }
        }

        return bestTarget;
    }
}
