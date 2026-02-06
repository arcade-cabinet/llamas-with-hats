import { Color3, Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';

export class AssetFactory {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    private createToonMaterial(name: string, color: Color3): StandardMaterial {
        const mat = new StandardMaterial(name, this.scene);
        mat.diffuseColor = color;
        mat.specularColor = new Color3(0.1, 0.1, 0.1); // Low specular for cartoon feel
        mat.emissiveColor = color.scale(0.2); // Slight emission
        mat.ambientColor = new Color3(1, 1, 1);
        return mat;
    }

    public createCartoonMeat(id: string, position: Vector3): Mesh {
        // Composite mesh: Bone (White Cylinder) + Meat (Red Box/Cylinder)
        const root = new Mesh(id, this.scene);
        root.position = position;

        // Bone
        const bone = MeshBuilder.CreateCylinder("bone", { height: 0.6, diameter: 0.15 }, this.scene);
        bone.rotation.z = Math.PI / 2;
        bone.material = this.createToonMaterial("boneMat", Color3.White());
        bone.parent = root;
        // Outline
        bone.renderOutline = true;
        bone.outlineColor = Color3.Black();
        bone.outlineWidth = 0.02;

        // Meat (Main chunk)
        const meat = MeshBuilder.CreateCylinder("meat", { height: 0.3, diameter: 0.35 }, this.scene);
        meat.rotation.z = Math.PI / 2;
        meat.material = this.createToonMaterial("meatMat", new Color3(0.8, 0.2, 0.2));
        meat.parent = root;
        meat.renderOutline = true;
        meat.outlineColor = Color3.Black();
        meat.outlineWidth = 0.02;

        // Bake transforms for physics? composite physics is tricky. 
        // Simpler: Use a Box aggregate on the root, or sphere.
        // For accurate physics, we might want to merge meshes or use a container.
        // Let's rely on a parent-based aggregate approximation (Box or Cylinder).

        // Physics
        // Havok will compute the cylinder hull from the mesh bounding box automatically if we don't provide a shape.
        new PhysicsAggregate(root, PhysicsShapeType.CYLINDER, { mass: 1, restitution: 0.2 }, this.scene);

        return root;
    }

    public createSeveredHand(id: string, position: Vector3): Mesh {
        const root = new Mesh(id, this.scene);
        root.position = position;

        const skinColor = new Color3(0.9, 0.7, 0.6); // Generic skin tone
        const mat = this.createToonMaterial("skinMat", skinColor);

        // Palm
        const palm = MeshBuilder.CreateBox("palm", { width: 0.3, height: 0.1, depth: 0.35 }, this.scene);
        palm.material = mat;
        palm.parent = root;
        palm.renderOutline = true;
        palm.outlineColor = Color3.Black();
        palm.outlineWidth = 0.01;

        // Fingers
        for (let i = 0; i < 4; i++) {
            const finger = MeshBuilder.CreateCylinder(`finger_${i}`, { height: 0.25, diameter: 0.05 }, this.scene);
            finger.position = new Vector3(-0.1 + (i * 0.07), 0, 0.25);
            finger.rotation.x = Math.PI / 2; // Point forward
            finger.material = mat;
            finger.parent = root;
            finger.renderOutline = true;
            finger.outlineColor = Color3.Black();
            finger.outlineWidth = 0.01;
        }

        // Thumb
        const thumb = MeshBuilder.CreateCylinder("thumb", { height: 0.2, diameter: 0.06 }, this.scene);
        thumb.position = new Vector3(0.15, 0, 0.1);
        thumb.rotation.z = -Math.PI / 4;
        thumb.rotation.x = Math.PI / 2;
        thumb.material = mat;
        thumb.parent = root;
        thumb.renderOutline = true;
        thumb.outlineColor = Color3.Black();
        thumb.outlineWidth = 0.01;

        // Wrist bone (gore)
        const wrist = MeshBuilder.CreateCylinder("wrist", { height: 0.05, diameter: 0.15 }, this.scene);
        wrist.position = new Vector3(0, 0, -0.18);
        wrist.rotation.x = Math.PI / 2;
        const goreMat = this.createToonMaterial("goreMat", new Color3(0.6, 0.0, 0.0));
        wrist.material = goreMat;
        wrist.parent = root;

        // Physics - Approximate as Box
        new PhysicsAggregate(root, PhysicsShapeType.BOX, { mass: 0.5, restitution: 0.1, extents: new Vector3(0.4, 0.2, 0.5) }, this.scene);

        return root;
    }
}
