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
  Light
} from '@babylonjs/core';
import {
  getTexturesForRoom,
  resolveTexturePath,
  createFloorMaterial,
  createWallMaterial,
  clearTextureCache,
} from './TextureLoader';
import {
  SceneDefinition,
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
import { createPropMeshAsync } from './PropFactory';

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

  // Clear cached PBR materials so they are re-created for the next scene
  clearTextureCache();

  currentScene = null;
}

export function getCurrentScene(): LoadedScene | null {
  return currentScene;
}

// ============================================
// Geometry Creation
// ============================================

function createFloor(scene: Scene, def: SceneDefinition, parent: TransformNode): void {
  // Flat-color fallback material
  const floorFallbackMat = new StandardMaterial('floorMat', scene);
  if (def.floor?.color) {
    floorFallbackMat.diffuseColor = new Color3(...def.floor.color);
  } else {
    floorFallbackMat.diffuseColor = new Color3(0.35, 0.25, 0.18);
  }
  floorFallbackMat.specularColor = new Color3(0.05, 0.05, 0.05);

  // Attempt PBR texture: use explicit material/texture hint, then infer from scene id/tags
  let texturePath: string | null = null;
  if (def.floor?.material || def.floor?.texture) {
    texturePath = resolveTexturePath(def.floor.material ?? def.floor.texture);
  }
  if (!texturePath) {
    const roomTextures = getTexturesForRoom(def.id, def.name);
    texturePath = roomTextures.floor;
  }

  // Optional tint from the scene definition color
  const tintColor = def.floor?.color ? new Color3(...def.floor.color) : undefined;

  const floorPBR = texturePath
    ? createFloorMaterial(scene, texturePath, def.bounds.width, def.bounds.height, tintColor)
    : null;

  const floor = MeshBuilder.CreateGround('floor', {
    width: def.bounds.width,
    height: def.bounds.height
  }, scene);
  floor.material = floorPBR ?? floorFallbackMat;
  floor.receiveShadows = true;
  floor.parent = parent;
}

function createWalls(
  scene: Scene,
  def: SceneDefinition,
  parent: TransformNode,
  shadowGen: ShadowGenerator | null
): void {
  // Flat-color fallback material
  const wallFallbackMat = new StandardMaterial('wallMat', scene);
  if (def.walls?.color) {
    wallFallbackMat.diffuseColor = new Color3(...def.walls.color);
  } else {
    wallFallbackMat.diffuseColor = new Color3(0.55, 0.45, 0.38);
  }

  // Resolve wall texture path: explicit hint first, then infer from scene id/tags
  let texturePath: string | null = null;
  if (def.walls?.material || def.walls?.texture) {
    texturePath = resolveTexturePath(def.walls.material ?? def.walls.texture);
  }
  if (!texturePath) {
    const roomTextures = getTexturesForRoom(def.id, def.name);
    texturePath = roomTextures.wall;
  }

  // Optional tint from the scene definition color
  const tintColor = def.walls?.color ? new Color3(...def.walls.color) : undefined;

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
    // Determine the visual length of this wall for UV tiling
    const isHoriz = name === 'north' || name === 'south';
    const wallLength = isHoriz ? def.bounds.width : def.bounds.height;

    if (hasExit) {
      // Create wall with doorway (two segments)
      const segLen = wallLength / 2 - 1;

      // PBR material sized for the segment
      const segPBR = texturePath
        ? createWallMaterial(scene, texturePath, segLen, wallHeight, tintColor)
        : null;
      const segMat = segPBR ?? wallFallbackMat;

      for (const side of [-1, 1]) {
        const wall = MeshBuilder.CreateBox(`wall_${name}_${side}`, {
          width: isHoriz ? segLen : width,
          height: wallHeight,
          depth: isHoriz ? depth : segLen
        }, scene);
        wall.material = segMat;
        wall.position = pos.clone();

        if (isHoriz) {
          wall.position.x = side * (segLen / 2 + 1);
        } else {
          wall.position.z = side * (segLen / 2 + 1);
        }

        wall.parent = parent;
        shadowGen?.addShadowCaster(wall);
      }
    } else {
      // Full-length wall with PBR material
      const wallPBR = texturePath
        ? createWallMaterial(scene, texturePath, wallLength, wallHeight, tintColor)
        : null;
      const wallMat = wallPBR ?? wallFallbackMat;

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
// Prop Mesh Creation (delegates to PropFactory)
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

  // Load all prop meshes in parallel via PropFactory (GLB with procedural fallback)
  const loadPromises = propEntities.map(async (entity) => {
    if (!entity.prop || !entity.transform) return;

    const propType = entity.prop.definition.type;
    const isInteractable = entity.prop.definition.interactable ?? false;

    const mesh = await createPropMeshAsync(scene, propType, isInteractable);
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
  });

  await Promise.all(loadPromises);
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
