import { Vector3 } from '@babylonjs/core';
import { world } from '../ECS';

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
        // Notify GameEngine or Camera?
    }

    public update(_deltaTime: number) {
        // Find active character entity
        const entity = world.where(e => e.id === this.activeCharId).first;
        if (!entity || !entity.mesh) return;

        // Simple movement logic (apply force or direct position?)
        // Better: Apply force to Yuka vehicle if integrated, or physics body

        const speed = 0.1;
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

            // If using Physics
            if (entity.mesh.physicsBody) {
                // Apply force?
                // entity.mesh.physicsBody.applyForce(...)
            } else {
                // Direct translation (fallback)
                entity.mesh.position.addInPlace(moveDir.scale(speed));

                // Rotate to face movement
                const targetPoint = entity.mesh.position.add(moveDir);
                entity.mesh.lookAt(targetPoint);
            }
        }
    }
}
