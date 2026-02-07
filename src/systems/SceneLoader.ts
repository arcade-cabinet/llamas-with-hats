// SceneLoader - Loads scene definitions and creates Babylon.js geometry
// Bridges the gap between JSON DDLs and the rendering engine

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  TransformNode,
  ShadowGenerator,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  SpotLight,
  Light,
  AbstractMesh
} from '@babylonjs/core';
import {
  SceneDefinition,
  PropDefinition,
  ExitDefinition,
  LightDefinition,
  AtmosphereDefinition,
  vec3FromArray
} from './SceneDefinition';
import { 
  archetypes, 
  loadSceneEntities, 
  unloadSceneEntities,
  Entity 
} from './ECS';
import { createCharacter, Character } from './Character';

// ============================================
// Scene Renderer State
// ============================================

interface LoadedScene {
  id: string;
  definition: SceneDefinition;
  rootNode: TransformNode;
  shadowGenerator: ShadowGenerator | null;
  lights: Light[];
}

let currentScene: LoadedScene | null = null;

// ============================================
// Main Scene Loading
// ============================================

export async function loadScene(
  babylonScene: Scene,
  definition: SceneDefinition,
  shadowGenerator?: ShadowGenerator
): Promise<LoadedScene> {
  // Unload previous scene
  if (currentScene) {
    unloadCurrentScene();
  }
  
  const rootNode = new TransformNode(`scene_${definition.id}`, babylonScene);
  
  // Setup atmosphere
  if (definition.atmosphere) {
    applyAtmosphere(babylonScene, definition.atmosphere);
  }
  
  // Create lights
  const lights = createLights(babylonScene, definition.lights ?? [], rootNode);
  
  // Get or create shadow generator
  let shadowGen = shadowGenerator ?? null;
  if (!shadowGen) {
    const dirLight = lights.find(l => l instanceof DirectionalLight) as DirectionalLight | undefined;
    if (dirLight) {
      shadowGen = new ShadowGenerator(1024, dirLight);
      shadowGen.useBlurExponentialShadowMap = true;
      shadowGen.blurKernel = 16;
      shadowGen.darkness = 0.3;
    }
  }
  
  // Create floor
  createFloor(babylonScene, definition, rootNode);
  
  // Create walls
  createWalls(babylonScene, definition, rootNode, shadowGen);
  
  // Create exits
  createExits(babylonScene, definition.exits, rootNode);
  
  // Load entities into ECS
  loadSceneEntities(definition);
  
  // Create prop meshes for ECS entities
  await createPropMeshes(babylonScene, definition.id, rootNode, shadowGen);
  
  currentScene = {
    id: definition.id,
    definition,
    rootNode,
    shadowGenerator: shadowGen,
    lights
  };
  
  return currentScene;
}

export function unloadCurrentScene(): void {
  if (!currentScene) return;
  
  // Unload ECS entities
  unloadSceneEntities(currentScene.id);
  
  // Dispose Babylon nodes
  currentScene.lights.forEach(l => l.dispose());
  currentScene.rootNode.dispose();
  
  currentScene = null;
}

export function getCurrentScene(): LoadedScene | null {
  return currentScene;
}

// ============================================
// Geometry Creation
// ============================================

function createFloor(scene: Scene, def: SceneDefinition, parent: TransformNode): void {
  const floorMat = new StandardMaterial('floorMat', scene);
  
  if (def.floor?.color) {
    floorMat.diffuseColor = new Color3(...def.floor.color);
  } else {
    floorMat.diffuseColor = new Color3(0.35, 0.25, 0.18);
  }
  floorMat.specularColor = new Color3(0.05, 0.05, 0.05);
  
  const floor = MeshBuilder.CreateGround('floor', {
    width: def.bounds.width,
    height: def.bounds.height
  }, scene);
  floor.material = floorMat;
  floor.receiveShadows = true;
  floor.parent = parent;
}

function createWalls(
  scene: Scene, 
  def: SceneDefinition, 
  parent: TransformNode,
  shadowGen: ShadowGenerator | null
): void {
  const wallMat = new StandardMaterial('wallMat', scene);
  
  if (def.walls?.color) {
    wallMat.diffuseColor = new Color3(...def.walls.color);
  } else {
    wallMat.diffuseColor = new Color3(0.55, 0.45, 0.38);
  }
  
  const wallHeight = def.walls?.height ?? 2;
  const hw = def.bounds.width / 2;
  const hh = def.bounds.height / 2;
  
  // Get exit directions
  const exitDirs = new Set(def.exits.map(e => e.direction));
  
  const walls: [string, Vector3, number, number, boolean][] = [
    ['north', new Vector3(0, wallHeight/2, -hh), def.bounds.width, 0.2, exitDirs.has('north')],
    ['south', new Vector3(0, wallHeight/2, hh), def.bounds.width, 0.2, exitDirs.has('south')],
    ['east', new Vector3(hw, wallHeight/2, 0), 0.2, def.bounds.height, exitDirs.has('east')],
    ['west', new Vector3(-hw, wallHeight/2, 0), 0.2, def.bounds.height, exitDirs.has('west')],
  ];
  
  for (const [name, pos, width, depth, hasExit] of walls) {
    if (hasExit) {
      // Create wall with doorway (two segments)
      const segLen = ((name === 'north' || name === 'south') ? def.bounds.width : def.bounds.height) / 2 - 1;
      
      for (const side of [-1, 1]) {
        const wall = MeshBuilder.CreateBox(`wall_${name}_${side}`, {
          width: name === 'north' || name === 'south' ? segLen : width,
          height: wallHeight,
          depth: name === 'north' || name === 'south' ? depth : segLen
        }, scene);
        wall.material = wallMat;
        wall.position = pos.clone();
        
        if (name === 'north' || name === 'south') {
          wall.position.x = side * (segLen / 2 + 1);
        } else {
          wall.position.z = side * (segLen / 2 + 1);
        }
        
        wall.parent = parent;
        shadowGen?.addShadowCaster(wall);
      }
    } else {
      const wall = MeshBuilder.CreateBox(`wall_${name}`, {
        width,
        height: wallHeight,
        depth
      }, scene);
      wall.material = wallMat;
      wall.position = pos;
      wall.parent = parent;
      shadowGen?.addShadowCaster(wall);
    }
  }
}

function createExits(scene: Scene, exits: ExitDefinition[], parent: TransformNode): void {
  const exitMat = new StandardMaterial('exitMat', scene);
  exitMat.diffuseColor = new Color3(0.3, 0.5, 0.3);
  exitMat.emissiveColor = new Color3(0.1, 0.15, 0.1);
  exitMat.alpha = 0.5;
  
  for (const exit of exits) {
    const marker = MeshBuilder.CreateBox(`exit_${exit.id}`, {
      width: exit.size?.[0] ?? 1.5,
      height: 0.05,
      depth: exit.size?.[2] ?? 1.5
    }, scene);
    marker.material = exitMat;
    marker.position = vec3FromArray(exit.position);
    marker.position.y = 0.03;
    marker.parent = parent;
  }
}

// ============================================
// Prop Mesh Creation
// ============================================

async function createPropMeshes(
  scene: Scene,
  sceneId: string,
  parent: TransformNode,
  shadowGen: ShadowGenerator | null
): Promise<void> {
  const propEntities = [...archetypes.props].filter(
    e => e.scene?.sceneId === sceneId
  );
  
  for (const entity of propEntities) {
    if (!entity.prop || !entity.transform) continue;
    
    const mesh = createPropMesh(scene, entity.prop.definition);
    if (mesh) {
      mesh.position.set(entity.transform.x, 0, entity.transform.z);
      mesh.rotation.y = entity.transform.rotationY;
      mesh.scaling.setAll(entity.transform.scale);
      mesh.parent = parent;
      
      if (shadowGen) {
        shadowGen.addShadowCaster(mesh);
      }
      mesh.receiveShadows = true;
      
      // Store reference in entity
      entity.renderable = { node: mesh, visible: true };
    }
  }
}

function createPropMesh(scene: Scene, def: PropDefinition): AbstractMesh | null {
  const mat = new StandardMaterial(`${def.id}_mat`, scene);
  let mesh: AbstractMesh;
  
  switch (def.type) {
    case 'table':
      mat.diffuseColor = new Color3(0.35, 0.25, 0.15);
      mesh = MeshBuilder.CreateBox(def.id, { width: 1, height: 0.7, depth: 0.6 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.35;
      break;
      
    case 'chair':
      mat.diffuseColor = new Color3(0.4, 0.28, 0.18);
      mesh = MeshBuilder.CreateBox(def.id, { width: 0.45, height: 0.8, depth: 0.45 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.4;
      break;
      
    case 'bookshelf':
      mat.diffuseColor = new Color3(0.3, 0.2, 0.12);
      mesh = MeshBuilder.CreateBox(def.id, { width: 1.2, height: 1.8, depth: 0.35 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.9;
      break;
      
    case 'crate':
    case 'chest':
      mat.diffuseColor = new Color3(0.45, 0.32, 0.2);
      mesh = MeshBuilder.CreateBox(def.id, { size: 0.6 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.3;
      break;
      
    case 'barrel':
      mat.diffuseColor = new Color3(0.4, 0.28, 0.16);
      mesh = MeshBuilder.CreateCylinder(def.id, { height: 0.9, diameter: 0.5 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.45;
      break;
      
    case 'pillar':
      mat.diffuseColor = new Color3(0.5, 0.45, 0.4);
      mesh = MeshBuilder.CreateCylinder(def.id, { height: 2, diameter: 0.4 }, scene);
      mesh.material = mat;
      mesh.position.y = 1;
      break;
      
    case 'rug':
      mat.diffuseColor = new Color3(0.4, 0.28, 0.2);
      mesh = MeshBuilder.CreateGround(def.id, { width: 2, height: 3 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.01;
      break;
      
    default:
      mat.diffuseColor = new Color3(0.4, 0.35, 0.3);
      mesh = MeshBuilder.CreateBox(def.id, { size: 0.5 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.25;
  }
  
  return mesh;
}

// ============================================
// Lighting
// ============================================

function createLights(scene: Scene, defs: LightDefinition[], _parent: TransformNode): Light[] {
  const lights: Light[] = [];
  
  // Default lighting if none specified
  if (defs.length === 0) {
    const ambient = new HemisphericLight('defaultAmbient', new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.6;
    ambient.groundColor = new Color3(0.15, 0.1, 0.08);
    lights.push(ambient);
    
    const sun = new DirectionalLight('defaultSun', new Vector3(-0.5, -1, -0.5), scene);
    sun.intensity = 0.8;
    sun.position = new Vector3(8, 12, 8);
    lights.push(sun);
    
    return lights;
  }
  
  for (const def of defs) {
    let light: Light;
    
    switch (def.type) {
      case 'ambient':
        light = new HemisphericLight(def.id, new Vector3(0, 1, 0), scene);
        break;
        
      case 'directional': {
        const dirLight = new DirectionalLight(
          def.id,
          def.direction ? vec3FromArray(def.direction) : new Vector3(-0.5, -1, -0.5),
          scene
        );
        if (def.position) {
          dirLight.position = vec3FromArray(def.position);
        }
        light = dirLight;
        break;
      }
        
      case 'point':
        light = new PointLight(
          def.id,
          def.position ? vec3FromArray(def.position) : Vector3.Zero(),
          scene
        );
        break;
        
      case 'spot':
        light = new SpotLight(
          def.id,
          def.position ? vec3FromArray(def.position) : Vector3.Zero(),
          def.direction ? vec3FromArray(def.direction) : new Vector3(0, -1, 0),
          Math.PI / 4,
          2,
          scene
        );
        break;
        
      default:
        continue;
    }
    
    if (def.color) {
      light.diffuse = new Color3(...def.color);
    }
    if (def.intensity !== undefined) {
      light.intensity = def.intensity;
    }
    
    lights.push(light);
  }
  
  return lights;
}

// ============================================
// Atmosphere
// ============================================

function applyAtmosphere(scene: Scene, atmo: AtmosphereDefinition): void {
  if (atmo.fogEnabled) {
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = atmo.fogDensity ?? 0.02;
    if (atmo.fogColor) {
      scene.fogColor = new Color3(...atmo.fogColor);
    }
  }
  
  if (atmo.ambientColor) {
    scene.ambientColor = new Color3(...atmo.ambientColor);
  }
}

// ============================================
// Character Integration
// ============================================

export async function createCharacterForEntity(
  babylonScene: Scene,
  entity: Entity,
  shadowGen?: ShadowGenerator
): Promise<Character | null> {
  if (!entity.character || !entity.transform) return null;
  
  const character = await createCharacter({
    scene: babylonScene,
    type: entity.character.type,
    position: new Vector3(entity.transform.x, entity.transform.y, entity.transform.z),
    rotation: entity.transform.rotationY,
    shadowGenerator: shadowGen,
    controller: entity.player ? 'player' : entity.ai ? 'ai' : 'none'
  });
  
  entity.character.character = character;
  entity.renderable = { node: character.root, visible: true };
  
  return character;
}
