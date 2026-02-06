import { Vector3 } from '@babylonjs/core';
import { Entity, world } from '../ECS';

export class ProceduralAnimator {
    private static instance: ProceduralAnimator;

    // Config
    private squashAmount = 0.1;
    private tiltAmount = 0.15;
    // @ts-ignore: used for debug/future
    private _lastVelocity: Vector3 = Vector3.Zero();

    private constructor() { }

    public static getInstance() {
        if (!ProceduralAnimator.instance) {
            ProceduralAnimator.instance = new ProceduralAnimator();
        }
        return ProceduralAnimator.instance;
    }

    public update(deltaTime: number) {
        // Query entities that need animation (Carl, Paul, maybe specific props?)
        // For now, let's just animate Carl and Paul
        const actors = world.where((e) => (e.type === 'carl' || e.type === 'paul') && !!e.mesh);

        for (const entity of actors) {
            this.animateEntity(entity, deltaTime);
        }
    }

    private animateEntity(entity: Entity, _dt: number) {
        if (!entity.mesh) return;

        // Get velocity from physics if available, or calculate from position delta?
        // Physics Body is best source if active
        let velocity = Vector3.Zero();


        if (entity.mesh.physicsBody) {
            // Havok V2: getLinearVelocity to ref
            // entity.mesh.physicsBody.getLinearVelocityToRef(velocity);
            // Verify API: Babylon Havok Plugin access.
            // If direct access isn't easy, we can infer from previous position if we tracked it.
            // For now, let's rely on a simplified "Jiggle" based on just moving?
            this._lastVelocity = velocity; // Keep ref for TS
        }

        // Simple Idle Jiggle (Breathing)
        const time = Date.now() / 200;
        const breath = Math.sin(time) * 0.02 * (1 + this.squashAmount); // Use squashAmount
        entity.mesh.scaling.y = 1 + breath;
        entity.mesh.scaling.x = 1 - breath * 0.5; // Preserve volume-ish
        entity.mesh.scaling.z = 1 - breath * 0.5;

        // If moving (we'd need velocity), add tilt.
        // Let's defer velocity-based tilt until we hook up Yuka velocity.
        if (this.tiltAmount > 0) {
            // Placeholder for tilt logic
        }
    }

    public triggerReaction(entityId: string, type: 'jump' | 'shake') {
        const entity = world.where(e => e.id === entityId).first;
        if (!entity || !entity.mesh) return;

        if (type === 'jump') {
            // Squash jump
            // Animation loop handles this or we tween?
        }
    }
}
