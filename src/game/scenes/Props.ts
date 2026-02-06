import { Color3, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { gameEngine } from '../logic/GameEngine';

export const spawnApartmentProps = (scene: Scene, horrorLevel: number) => {
    const createMat = (name: string, color: Color3, specular = 0.1) => {
        const mat = new StandardMaterial(name, scene);
        mat.diffuseColor = color;
        mat.specularColor = new Color3(specular, specular, specular);
        if (horrorLevel > 5) {
            mat.diffuseColor = color.scale(1 - (horrorLevel - 5) * 0.1);
        }
        return mat;
    };

    // Floor
    const floor = MeshBuilder.CreateGround("floor", { width: 10, height: 10 }, scene);
    floor.material = createMat("floorMat", new Color3(0.2, 0.2, 0.2));
    gameEngine.spawnEntity({
        type: 'prop',
        mesh: floor,
        position: floor.position
    });

    // Couch
    const couch = MeshBuilder.CreateBox("couch", { width: 2, height: 0.5, depth: 1 }, scene);
    couch.position = new Vector3(0, 0.25, 2);
    couch.material = createMat("couchMat", new Color3(0.5, 0.1, 0.1));
    gameEngine.spawnEntity({
        id: 'couch',
        type: 'prop',
        mesh: couch,
        position: couch.position
    });

    // Lamp
    const lamp = MeshBuilder.CreateCylinder("lamp", { diameter: 0.2, height: 2 }, scene);
    lamp.position = new Vector3(-3, 1, 3);
    lamp.material = createMat("lampMat", new Color3(0.8, 0.8, 0.6));
    gameEngine.spawnEntity({
        id: 'lamp',
        type: 'prop',
        mesh: lamp,
        position: lamp.position
    });
};
