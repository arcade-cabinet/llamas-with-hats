import {
    AbstractMesh,
    Color3,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    Scene,
    SceneLoader,
    StandardMaterial,
    Vector3
} from '@babylonjs/core';
import { gameEngine } from '../logic/GameEngine';

export interface LlamaProps {
    scene: Scene;
    name: string;
    position: Vector3;
    rotation: number; // Y rotation
    isMainChar: boolean; // Carl/Paul vs background llamas
}

export const createLlama = async ({
    scene,
    name,
    position,
    rotation,
    isMainChar,
}: LlamaProps): Promise<AbstractMesh> => {
    const id = name.toLowerCase();
    const fileName = `${id}.glb`; // carl.glb or paul.glb

    try {
        const result = await SceneLoader.ImportMeshAsync(
            '',
            '/assets/models/characters/',
            fileName,
            scene
        );

        const root = result.meshes[0];
        root.id = id;
        root.name = name;

        // Normalize scale (GLBs might be huge/tiny)
        root.scaling = new Vector3(0.5, 0.5, 0.5);
        root.position = position;
        root.rotationQuaternion = null; // Allow Euler rotation
        root.rotation.y = rotation;

        // Shadows
        result.meshes.forEach(m => {
            m.receiveShadows = true;
            // ShadowGenerator would need to include these
        });

        // Register with Game Engine ECS if it's a main character
        if (isMainChar) {
            gameEngine.spawnEntity({
                id: id,
                type: id, // carl or paul
                name: name,
                mesh: root,
                position: position,
                behavior: 'idle',
            });

            // Physics body for interaction
            if (scene.isPhysicsEnabled()) {
                const physicsRoot = MeshBuilder.CreateBox(`${id}_physics`, { width: 0.8, height: 1.5, depth: 1.2 }, scene);
                physicsRoot.position = new Vector3(position.x, 0.75, position.z);
                physicsRoot.isVisible = false;

                // Link visuals to physics root?
                // For now, let's keep them separate but synced via ECS, or parent them if Havok supports compound child transforms well.
                // Simpler approach: Parent root to physicsRoot
                root.setParent(physicsRoot);
                root.position = new Vector3(0, -0.75, 0);
                root.rotation.y = rotation;

                new PhysicsAggregate(physicsRoot, PhysicsShapeType.BOX, { mass: 50, restitution: 0.1, friction: 0.5 }, scene);
                return physicsRoot;
            }
        }

        return root;
    } catch (error) {
        console.warn(`Failed to load ${fileName}, falling back to placeholder`, error);

        // Fallback placeholder
        const placeholder = MeshBuilder.CreateBox(id, { height: 1.5, width: 0.5, depth: 1 }, scene);
        placeholder.position = position;
        placeholder.rotation.y = rotation;
        const mat = new StandardMaterial(`${id}Mat`, scene);
        mat.diffuseColor = id === 'carl' ? new Color3(0.5, 0.2, 0.2) : new Color3(0.8, 0.8, 0.7);
        placeholder.material = mat;

        if (isMainChar) {
            gameEngine.spawnEntity({
                id: id,
                type: id,
                name: name,
                mesh: placeholder,
                position: position,
                behavior: 'idle',
            });
        }

        return placeholder;
    }
};
