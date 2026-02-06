import {
    Animation,
    Color3,
    Color4,
    MeshBuilder,
    ParticleSystem,
    Scene,
    StandardMaterial,
    TransformNode,
    Vector3
} from '@babylonjs/core';
import { gameEngine } from '../logic/GameEngine';
import { spawnApartmentProps } from './Props';

interface ApartmentProps {
    scene: Scene;
    spawnedObjects: string[];
    removedObjects: string[];
    horrorLevel: number;
}

// Creates the cozy/creepy apartment environment
export const createApartment = ({
    scene,
    spawnedObjects,
    removedObjects,
    horrorLevel,
}: ApartmentProps): TransformNode => {
    const apartmentRoot = new TransformNode('apartment', scene);

    // Material helpers
    const createMat = (name: string, color: Color3, specular = 0.1) => {
        const mat = new StandardMaterial(name, scene);
        mat.diffuseColor = color;
        mat.specularColor = new Color3(specular, specular, specular);
        // Darken materials as horror increases
        if (horrorLevel > 5) {
            mat.diffuseColor = color.scale(1 - (horrorLevel - 5) * 0.1);
        }
        return mat;
    };

    // Floor
    const floorMat = createMat('floorMat', new Color3(0.55, 0.35, 0.2), 0.2);
    const floor = MeshBuilder.CreateGround('floor', { width: 10, height: 10, subdivisions: 20 }, scene);
    floor.material = floorMat;
    floor.receiveShadows = true;
    floor.checkCollisions = true;
    floor.parent = apartmentRoot;

    gameEngine.spawnEntity({
        id: 'floor',
        name: 'Floor',
        type: 'prop',
        mesh: floor,
        position: floor.position.clone(),
    });

    // Spawn interior props via ECS
    spawnApartmentProps(scene, horrorLevel);

    // Blood stains based on horror level
    if (horrorLevel > 2) {
        const bloodMat = createMat('bloodMat', new Color3(0.4, 0.05, 0.05), 0.3);
        for (let i = 0; i < Math.min(horrorLevel - 2, 5); i++) {
            const stain = MeshBuilder.CreateDisc(`bloodStain${i}`, {
                radius: 0.3 + Math.random() * 0.4,
            }, scene);
            stain.material = bloodMat;
            stain.position = new Vector3(
                (Math.random() - 0.5) * 6,
                0.01,
                (Math.random() - 0.5) * 6
            );
            stain.rotation.x = Math.PI / 2;
            stain.parent = apartmentRoot;
        }
    }

    // Walls
    const wallMat = createMat('wallMat', new Color3(0.85, 0.8, 0.7));

    // Back wall
    const backWall = MeshBuilder.CreatePlane('backWall', {
        width: 10,
        height: 4,
    }, scene);
    backWall.material = wallMat;
    backWall.position = new Vector3(0, 2, -5);
    backWall.parent = apartmentRoot;

    // Left wall
    const leftWall = MeshBuilder.CreatePlane('leftWall', {
        width: 10,
        height: 4,
    }, scene);
    leftWall.material = wallMat;
    leftWall.position = new Vector3(-5, 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.parent = apartmentRoot;

    // Right wall with window
    const rightWall = MeshBuilder.CreatePlane('rightWall', {
        width: 10,
        height: 4,
    }, scene);
    rightWall.material = wallMat;
    rightWall.position = new Vector3(5, 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.parent = apartmentRoot;

    // Window on right wall
    const windowFrameMat = createMat('windowFrameMat', new Color3(0.3, 0.25, 0.2));
    const windowFrame = MeshBuilder.CreateBox('windowFrame', {
        width: 2.5,
        height: 2,
        depth: 0.15,
    }, scene);
    windowFrame.material = windowFrameMat;
    windowFrame.position = new Vector3(4.95, 2.2, 0);
    windowFrame.rotation.y = Math.PI / 2;
    windowFrame.parent = apartmentRoot;

    // Window glass
    const windowGlassMat = createMat('windowGlassMat', new Color3(0.6, 0.7, 0.9), 0.8);
    windowGlassMat.alpha = 0.4;
    const windowGlass = MeshBuilder.CreatePlane('windowGlass', {
        width: 2.2,
        height: 1.7,
    }, scene);
    windowGlass.material = windowGlassMat;
    windowGlass.position = new Vector3(4.9, 2.2, 0);
    windowGlass.rotation.y = -Math.PI / 2;
    windowGlass.parent = apartmentRoot;

    // SPAWNED OBJECTS based on game events

    // Picture frames on wall
    const frameMat = createMat('frameMat', new Color3(0.25, 0.2, 0.15));

    const frame1 = MeshBuilder.CreateBox('frame1', {
        width: 0.8,
        height: 0.6,
        depth: 0.05,
    }, scene);
    frame1.material = frameMat;
    frame1.position = new Vector3(-1.5, 2.5, -4.95);
    frame1.parent = apartmentRoot;

    // Picture content (becomes darker with horror level)
    const pictureMat1 = createMat('pictureMat1',
        new Color3(0.6 - horrorLevel * 0.04, 0.5 - horrorLevel * 0.04, 0.4)
    );
    if (horrorLevel > 7) {
        pictureMat1.emissiveColor = new Color3(0.1, 0, 0); // Blood glow
    }
    const picture1 = MeshBuilder.CreatePlane('picture1', {
        width: 0.65,
        height: 0.45,
    }, scene);
    picture1.material = pictureMat1;
    picture1.position = new Vector3(-1.5, 2.5, -4.92);
    picture1.parent = apartmentRoot;

    const frame2 = MeshBuilder.CreateBox('frame2', {
        width: 0.6,
        height: 0.8,
        depth: 0.05,
    }, scene);
    frame2.material = frameMat;
    frame2.position = new Vector3(1, 2.5, -4.95);
    frame2.parent = apartmentRoot;

    // Second picture
    const pictureMat2 = createMat('pictureMat2',
        new Color3(0.5, 0.45 - horrorLevel * 0.03, 0.4 - horrorLevel * 0.02)
    );
    const picture2 = MeshBuilder.CreatePlane('picture2', {
        width: 0.45,
        height: 0.65,
    }, scene);
    picture2.material = pictureMat2;
    picture2.position = new Vector3(1, 2.5, -4.92);
    picture2.parent = apartmentRoot;

    // Rug with pattern
    const rugMat = createMat('rugMat', new Color3(0.5, 0.3, 0.25));
    const rug = MeshBuilder.CreateDisc('rug', {
        radius: 1.8,
    }, scene);
    rug.material = rugMat;
    rug.position = new Vector3(0, 0.01, -1);
    rug.rotation.x = Math.PI / 2;
    rug.parent = apartmentRoot;

    // Rug inner pattern
    const rugInnerMat = createMat('rugInnerMat', new Color3(0.6, 0.4, 0.35));
    const rugInner = MeshBuilder.CreateDisc('rugInner', {
        radius: 1.4,
    }, scene);
    rugInner.material = rugInnerMat;
    rugInner.position = new Vector3(0, 0.012, -1);
    rugInner.rotation.x = Math.PI / 2;
    rugInner.parent = apartmentRoot;

    // Bookshelf
    const shelfMat = createMat('shelfMat', new Color3(0.4, 0.3, 0.2));

    const shelfBack = MeshBuilder.CreateBox('shelfBack', {
        width: 1.2,
        height: 2,
        depth: 0.05,
    }, scene);
    shelfBack.material = shelfMat;
    shelfBack.position = new Vector3(-3.5, 1, -4.5);
    shelfBack.parent = apartmentRoot;

    // Shelves
    for (let i = 0; i < 4; i++) {
        const shelf = MeshBuilder.CreateBox(`shelf${i}`, {
            width: 1.2,
            height: 0.05,
            depth: 0.3,
        }, scene);
        shelf.material = shelfMat;
        shelf.position = new Vector3(-3.5, 0.3 + i * 0.55, -4.35);
        shelf.parent = apartmentRoot;
    }

    // Books on shelves
    const bookColors = [
        new Color3(0.6, 0.2, 0.2),
        new Color3(0.2, 0.4, 0.5),
        new Color3(0.5, 0.4, 0.2),
        new Color3(0.3, 0.5, 0.3),
    ];

    for (let shelf = 0; shelf < 3; shelf++) {
        for (let book = 0; book < 5; book++) {
            const bookMat = createMat(`bookMat${shelf}${book}`,
                bookColors[(shelf + book) % bookColors.length]
            );
            const bookMesh = MeshBuilder.CreateBox(`book${shelf}${book}`, {
                width: 0.08 + Math.random() * 0.05,
                height: 0.35 + Math.random() * 0.1,
                depth: 0.2,
            }, scene);
            bookMesh.material = bookMat;
            bookMesh.position = new Vector3(
                -3.9 + book * 0.2,
                0.5 + shelf * 0.55,
                -4.35
            );
            bookMesh.parent = apartmentRoot;
        }
    }

    // SPAWNED OBJECTS based on game events

    // Suspicious box (appears after certain dialogue)
    if (spawnedObjects.includes('suspicious_box')) {
        const boxMat = createMat('suspiciousBoxMat', new Color3(0.4, 0.3, 0.25));
        const suspiciousBox = MeshBuilder.CreateBox('suspiciousBox', {
            width: 0.6,
            height: 0.5,
            depth: 0.4,
        }, scene);
        suspiciousBox.material = boxMat;
        suspiciousBox.position = new Vector3(-1.5, 0.25, 1);
        suspiciousBox.rotation.y = 0.3;
        suspiciousBox.parent = apartmentRoot;

        // Mysterious dripping...
        if (horrorLevel > 4) {
            const dripMat = createMat('dripMat', new Color3(0.5, 0.1, 0.1));
            const drip = MeshBuilder.CreateSphere('drip', { diameter: 0.08 }, scene);
            drip.material = dripMat;
            drip.position = new Vector3(-1.3, 0.1, 1.1);
            drip.parent = apartmentRoot;
        }
    }

    // Cone hat prop
    if (spawnedObjects.includes('cone_hat')) {
        const coneMat = createMat('coneMat', new Color3(1, 0.5, 0));
        const cone = MeshBuilder.CreateCylinder('trafficCone', {
            height: 0.5,
            diameterTop: 0.05,
            diameterBottom: 0.25,
            diameterBottom: 0.25,
        }, scene);
        cone.material = coneMat;
        cone.position = new Vector3(1.5, 0.25, 2);
        cone.parent = apartmentRoot;
    }

    // Mystery meat on table
    if (spawnedObjects.includes('mystery_meat') || spawnedObjects.includes('table_food')) {
        const plateMat = createMat('plateMat', new Color3(0.9, 0.9, 0.85));
        const plate = MeshBuilder.CreateCylinder('plate', {
            height: 0.03,
            diameter: 0.4,
        }, scene);
        plate.material = plateMat;
        plate.position = new Vector3(0, 0.51, -2);
        plate.parent = apartmentRoot;

        const meatMat = createMat('meatMat',
            spawnedObjects.includes('mystery_meat')
                ? new Color3(0.5, 0.2, 0.2)
                : new Color3(0.6, 0.4, 0.3)
        );
        const meat = MeshBuilder.CreateSphere('mysteryMeat', {
            diameter: 0.2,
        }, scene);
        meat.material = meatMat;
        meat.scaling = new Vector3(1.5, 0.6, 1);
        meat.position = new Vector3(0, 0.58, -2);
        meat.parent = apartmentRoot;
    }

    // Cat (if not removed)
    if (!removedObjects.includes('cat')) {
        const catMat = createMat('catMat', new Color3(0.3, 0.25, 0.2));

        // Cat body
        const catBody = MeshBuilder.CreateCapsule('catBody', {
            height: 0.35,
            radius: 0.12,
        }, scene);
        catBody.material = catMat;
        catBody.position = new Vector3(3, 0.15, -2);
        catBody.rotation.z = Math.PI / 2;
        catBody.parent = apartmentRoot;

        // Cat head
        const catHead = MeshBuilder.CreateSphere('catHead', {
            diameter: 0.2,
        }, scene);
        catHead.material = catMat;
        catHead.position = new Vector3(3.2, 0.18, -2);
        catHead.parent = apartmentRoot;

        // Cat ears
        const earMat = createMat('catEarMat', new Color3(0.35, 0.3, 0.25));
        const leftEar = MeshBuilder.CreateCylinder('catLeftEar', {
            height: 0.08,
            diameterTop: 0.01,
            diameterBottom: 0.05,
        }, scene);
        leftEar.material = earMat;
        leftEar.position = new Vector3(3.25, 0.3, -1.95);
        leftEar.parent = apartmentRoot;

        const rightEar = MeshBuilder.CreateCylinder('catRightEar', {
            height: 0.08,
            diameterTop: 0.01,
            diameterBottom: 0.05,
        }, scene);
        rightEar.material = earMat;
        rightEar.position = new Vector3(3.25, 0.3, -2.05);
        rightEar.parent = apartmentRoot;

        // Cat tail
        const tail = MeshBuilder.CreateCylinder('catTail', {
            height: 0.3,
            diameterTop: 0.02,
            diameterBottom: 0.04,
        }, scene);
        tail.material = catMat;
        tail.position = new Vector3(2.75, 0.2, -2);
        tail.rotation.z = -Math.PI / 3;
        tail.parent = apartmentRoot;

        // Animate tail
        const tailAnim = new Animation(
            'catTailWag',
            'rotation.y',
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );
        tailAnim.setKeys([
            { frame: 0, value: 0 },
            { frame: 15, value: 0.3 },
            { frame: 30, value: 0 },
            { frame: 45, value: -0.3 },
            { frame: 60, value: 0 },
        ]);
        tail.animations.push(tailAnim);
        scene.beginAnimation(tail, 0, 60, true);
    }

    // Neighbors (trash bag silhouettes)
    if (spawnedObjects.includes('neighbors')) {
        const bagMat = createMat('bagMat', new Color3(0.05, 0.05, 0.05), 0.5);
        for (let i = 0; i < 3; i++) {
            const neighbor = MeshBuilder.CreateCapsule(`neighbor${i}`, { height: 1.8, radius: 0.4 }, scene);
            neighbor.material = bagMat;
            neighbor.position = new Vector3(-4, 0.9, 5 + i * 1.5);
            neighbor.parent = apartmentRoot;
        }
    }

    // Hand art stapled to the wall
    if (spawnedObjects.includes('hand_art')) {
        const handMat = createMat('handMat', new Color3(0.8, 0.7, 0.6));
        for (let i = 0; i < 6; i++) {
            const hand = MeshBuilder.CreateBox(`hand${i}`, { width: 0.2, height: 0.3, depth: 0.05 }, scene);
            hand.material = handMat;
            hand.position = new Vector3(-4.95, 2.5 + (i % 3) * 0.4, -2 + Math.floor(i / 3) * 0.6);
            hand.rotation.y = Math.PI / 2;
            hand.parent = apartmentRoot;
        }
    }

    // Unity Sculpture (secreting bile)
    if (spawnedObjects.includes('unity_sculpture')) {
        const sculptureMat = createMat('sculptureMat', new Color3(0.3, 0.2, 0.4), 0.6);
        const sculpture = MeshBuilder.CreateTorusKnot('unitySculpture', {
            radius: 0.4,
            tube: 0.15,
            radialSegments: 64,
            tubularSegments: 32,
        }, scene);
        sculpture.material = sculptureMat;
        sculpture.position = new Vector3(3.5, 1.2, 3);
        sculpture.parent = apartmentRoot;

        // Bile drip effect
        const bileMat = createMat('bileMat', new Color3(0.4, 0.5, 0.1));
        const bile = MeshBuilder.CreateSphere('bile', { diameter: 0.12 }, scene);
        bile.material = bileMat;
        bile.position = new Vector3(3.5, 0.5, 3);
        bile.scaling.y = 2;
        bile.parent = apartmentRoot;
    }

    // Hair bowl
    if (spawnedObjects.includes('hair_bowl')) {
        const bowlMat = createMat('bowlMat', new Color3(0.2, 0.2, 0.2));
        const bowl = MeshBuilder.CreateCylinder('hairBowl', { height: 0.15, diameterTop: 0.4, diameterBottom: 0.2 }, scene);
        bowl.material = bowlMat;
        bowl.position = new Vector3(0.5, 0.52, -2.2);
        bowl.parent = apartmentRoot;

        const hairMat = createMat('hairMat', new Color3(0.05, 0.05, 0.05));
        const hair = MeshBuilder.CreateSphere('hairContent', { diameter: 0.35 }, scene);
        hair.material = hairMat;
        hair.position = new Vector3(0.5, 0.6, -2.2);
        hair.scaling.y = 0.5;
        hair.parent = apartmentRoot;
    }

    // Locust Fan
    if (spawnedObjects.includes('locust_fan')) {
        const fanRoot = new TransformNode('locustFan', scene);
        fanRoot.position = new Vector3(0, 3.8, 0);
        fanRoot.parent = apartmentRoot;

        const locustMat = createMat('locustMat', new Color3(0.2, 0.15, 0.1));
        for (let i = 0; i < 4; i++) {
            const blade = MeshBuilder.CreateBox(`blade${i}`, { width: 1.5, height: 0.02, depth: 0.3 }, scene);
            blade.material = locustMat;
            blade.rotation.y = (i * Math.PI) / 2;
            blade.position.x = Math.cos((i * Math.PI) / 2) * 0.75;
            blade.position.z = Math.sin((i * Math.PI) / 2) * 0.75;
            blade.parent = fanRoot;
        }

        // Animate fan
        const fanAnim = new Animation('fanSpin', 'rotation.y', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
        fanAnim.setKeys([{ frame: 0, value: 0 }, { frame: 60, value: Math.PI * 2 }]);
        fanRoot.animations.push(fanAnim);
        scene.beginAnimation(fanRoot, 0, 60, true, 2.0); // Fast spin
    }

    return apartmentRoot;
};

// Create blood splatter particle effect
export const createBloodSplatter = (scene: Scene, position: Vector3) => {
    const particleSystem = new ParticleSystem('bloodSplatter', 100, scene);

    // Create a small emitter mesh
    const emitter = MeshBuilder.CreateSphere('bloodEmitter', { diameter: 0.1 }, scene);
    emitter.position = position;
    emitter.visibility = 0;

    particleSystem.emitter = emitter;
    particleSystem.minEmitBox = new Vector3(-0.1, 0, -0.1);
    particleSystem.maxEmitBox = new Vector3(0.1, 0, 0.1);

    particleSystem.color1 = new Color4(0.7, 0.1, 0.1, 1);
    particleSystem.color2 = new Color4(0.5, 0.05, 0.05, 1);
    particleSystem.colorDead = new Color4(0.3, 0, 0, 0);

    particleSystem.minSize = 0.05;
    particleSystem.maxSize = 0.15;

    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 1;

    particleSystem.emitRate = 50;

    particleSystem.direction1 = new Vector3(-1, 2, -1);
    particleSystem.direction2 = new Vector3(1, 3, 1);

    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;

    particleSystem.gravity = new Vector3(0, -9.8, 0);

    particleSystem.targetStopDuration = 0.5;
    particleSystem.disposeOnStop = true;

    particleSystem.start();

    return particleSystem;
};

// Create sparkle cleanup effect
export const createSparkles = (scene: Scene, position: Vector3) => {
    const particleSystem = new ParticleSystem('sparkles', 50, scene);

    const emitter = MeshBuilder.CreateSphere('sparkleEmitter', { diameter: 0.1 }, scene);
    emitter.position = position;
    emitter.visibility = 0;

    particleSystem.emitter = emitter;
    particleSystem.minEmitBox = new Vector3(-0.5, 0, -0.5);
    particleSystem.maxEmitBox = new Vector3(0.5, 0, 0.5);

    particleSystem.color1 = new Color4(1, 1, 0.8, 1);
    particleSystem.color2 = new Color4(0.9, 0.8, 0.5, 1);
    particleSystem.colorDead = new Color4(1, 1, 1, 0);

    particleSystem.minSize = 0.02;
    particleSystem.maxSize = 0.05;

    particleSystem.minLifeTime = 0.5;
    particleSystem.maxLifeTime = 1.5;

    particleSystem.emitRate = 30;

    particleSystem.direction1 = new Vector3(-0.5, 1, -0.5);
    particleSystem.direction2 = new Vector3(0.5, 2, 0.5);

    particleSystem.minEmitPower = 0.5;
    particleSystem.maxEmitPower = 1;

    particleSystem.gravity = new Vector3(0, -2, 0);

    particleSystem.targetStopDuration = 1;
    particleSystem.disposeOnStop = true;

    particleSystem.start();

    return particleSystem;
};

export default { createApartment, createBloodSplatter, createSparkles };
