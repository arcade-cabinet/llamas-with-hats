/**
 * Prop Factory
 * ============
 *
 * Creates 3D meshes for props based on definitions from JSON data files.
 * This separates prop content (data) from prop rendering (code).
 *
 * ## Data-Driven Approach
 *
 * Prop definitions are loaded from `src/data/props.json`:
 * - Mesh geometry (type, dimensions)
 * - Material properties (color, emissive)
 * - Collision radius
 *
 * The factory reads these definitions and creates Babylon.js meshes.
 * When a GLB model is available for a prop type, it is loaded instead
 * of creating procedural geometry. Procedural geometry serves as a
 * fallback when no model exists or loading fails.
 *
 * ## Usage
 *
 * ```ts
 * // Async (preferred) - loads GLB model when available
 * const mesh = await createPropMeshAsync(scene, 'couch', true);
 * mesh.position.set(x, 0, z);
 *
 * // Sync fallback - always procedural geometry
 * const mesh = createPropMesh(scene, 'couch', true);
 * mesh.position.set(x, 0, z);
 * ```
 *
 * @see src/data/props.json - Prop definitions
 * @see public/assets/models/manifest.json - Available GLB models
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  AbstractMesh,
  TransformNode
} from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { getPropDefinition, PropMeshDefinition } from '../data';

// ============================================
// Prop Type to GLB Model Mapping
// ============================================

/**
 * Maps prop types (used in props.json and room configs) to their
 * corresponding GLB/GLTF model paths under public/assets/models/.
 *
 * Props not listed here will always use procedural geometry.
 */
const MODEL_MAP: Record<string, string> = {
  table:        'assets/models/furniture/tables/dining_table.glb',
  chair:        'assets/models/furniture/seating/chair.glb',
  couch:        'assets/models/furniture/seating/sofa.glb',
  bookshelf:    'assets/models/furniture/storage/bookcase.glb',
  lamp:         'assets/models/furniture/lighting/lamp_floor.glb',
  bed:          'assets/models/furniture/beds/bed_double.glb',
  nightstand:   'assets/models/furniture/tables/nightstand.glb',
  dresser:      'assets/models/furniture/storage/dresser.glb',
  wardrobe:     'assets/models/furniture/storage/wardrobe.glb',
  cabinet:      'assets/models/kitchen/fixtures/cabinet_lower.glb',
  tv:           'assets/models/decor/wall/tv_modern.glb',
  stove:        'assets/models/kitchen/appliances/stove.glb',
  refrigerator: 'assets/models/kitchen/appliances/refrigerator.glb',
  sink:         'assets/models/kitchen/fixtures/sink.glb',
  bathtub:      'assets/models/bathroom/fixtures/bathtub.glb',
  toilet:       'assets/models/bathroom/fixtures/toilet.glb',
  trash_can:    'assets/models/bathroom/fixtures/trashcan.glb',
  barrel:       'assets/models/dungeon/props/barrel.glb',
  chest:        'assets/models/dungeon/props/chest.gltf',
  rug:          'assets/models/decor/floor/rug_rectangle.glb',
  plant:        'assets/models/decor/floor/potted_plant.glb',
  dead_plant:   'assets/models/decor/floor/plant_small_1.glb',
};

/**
 * Create a mesh from a mesh definition.
 */
function createMeshFromDefinition(
  scene: Scene,
  def: PropMeshDefinition,
  name: string,
  interactive: boolean
): AbstractMesh | null {
  let mesh: AbstractMesh | null = null;
  
  // Create material
  const mat = new StandardMaterial(`${name}Mat`, scene);
  if (def.color) {
    mat.diffuseColor = new Color3(def.color[0], def.color[1], def.color[2]);
  }
  if (def.emissive) {
    mat.emissiveColor = new Color3(def.emissive[0], def.emissive[1], def.emissive[2]);
  }
  if (interactive) {
    // Subtle glow for interactive props
    mat.emissiveColor = mat.emissiveColor || new Color3(0.05, 0.04, 0.02);
  }
  
  switch (def.type) {
    case 'box': {
      const options: { width?: number; height?: number; depth?: number; size?: number } = {};
      if (def.size) {
        options.size = def.size;
      } else {
        options.width = def.width || 1;
        options.height = def.height || 1;
        options.depth = def.depth || 1;
      }
      mesh = MeshBuilder.CreateBox(name, options, scene);
      mesh.material = mat;
      if (def.yOffset) mesh.position.y = def.yOffset;
      break;
    }
    
    case 'cylinder': {
      mesh = MeshBuilder.CreateCylinder(name, {
        height: def.height || 1,
        diameter: def.diameter,
        diameterTop: def.diameterTop,
        diameterBottom: def.diameterBottom
      }, scene);
      mesh.material = mat;
      if (def.yOffset) mesh.position.y = def.yOffset;
      break;
    }
    
    case 'composite': {
      // Create a parent node for composite meshes
      const root = new TransformNode(name, scene);
      
      if (def.parts) {
        def.parts.forEach((part, i) => {
          const partMesh = createMeshFromDefinition(scene, part, `${name}_part${i}`, false);
          if (partMesh) {
            if (part.position) {
              partMesh.position.set(part.position[0], part.position[1], part.position[2]);
            }
            partMesh.parent = root;
          }
        });
      }
      
      // Return the root as AbstractMesh (it's a TransformNode but compatible)
      mesh = root as unknown as AbstractMesh;
      break;
    }
  }
  
  return mesh;
}

/**
 * Create a prop mesh from data definitions.
 *
 * @param scene - Babylon.js scene
 * @param propType - Type of prop (e.g., 'couch', 'table')
 * @param interactive - Whether this prop can be interacted with
 * @param itemDrop - Optional item ID that this prop drops when interacted with
 * @returns The created mesh, or null if creation failed
 */
export function createPropMesh(
  scene: Scene,
  propType: string,
  interactive: boolean = false,
  itemDrop?: string
): AbstractMesh | null {
  const definition = getPropDefinition(propType);

  // Create the mesh
  const mesh = createMeshFromDefinition(scene, definition.mesh, propType, interactive);

  if (!mesh) return null;

  // Tag as interactive for raycasting
  if (interactive) {
    mesh.metadata = {
      interactive: true,
      propType: propType,
      isPickable: true,
      itemDrop: itemDrop
    };
    mesh.isPickable = true;

    // Tag child meshes too
    if ('getChildMeshes' in mesh) {
      (mesh as AbstractMesh).getChildMeshes().forEach(child => {
        child.metadata = { interactive: true, propType, isPickable: true, itemDrop };
        child.isPickable = true;
      });
    }
  }

  return mesh;
}

// ============================================
// Async GLB Model Loading
// ============================================

/**
 * Compute the axis-aligned bounding box extents of a loaded model.
 * Returns { width, height, depth } representing the model's world-space
 * dimensions, and { minY } for ground-plane alignment.
 */
function measureModelBounds(meshes: AbstractMesh[]): {
  width: number;
  height: number;
  depth: number;
  minY: number;
} {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const m of meshes) {
    if (!(m instanceof AbstractMesh) || typeof m.getBoundingInfo !== 'function') {
      continue;
    }
    try {
      m.refreshBoundingInfo({});
      const b = m.getBoundingInfo()?.boundingBox;
      if (b) {
        minX = Math.min(minX, b.minimumWorld.x);
        maxX = Math.max(maxX, b.maximumWorld.x);
        minY = Math.min(minY, b.minimumWorld.y);
        maxY = Math.max(maxY, b.maximumWorld.y);
        minZ = Math.min(minZ, b.minimumWorld.z);
        maxZ = Math.max(maxZ, b.maximumWorld.z);
      }
    } catch {
      // Skip meshes that cannot compute bounding info
    }
  }

  return {
    width:  maxX - minX || 1,
    height: maxY - minY || 1,
    depth:  maxZ - minZ || 1,
    minY:   isFinite(minY) ? minY : 0,
  };
}

/**
 * Create a prop mesh asynchronously, loading a GLB model when one is
 * available for the given prop type. Falls back to procedural geometry
 * (createPropMesh) when no model mapping exists or when loading fails.
 *
 * The loaded model is scaled to approximately fit the dimensions
 * specified in the prop definition (props.json), ensuring visual
 * consistency with the collision radii and room layouts.
 *
 * @param scene      - Babylon.js scene
 * @param propType   - Type of prop (e.g., 'couch', 'table')
 * @param interactive - Whether this prop can be interacted with
 * @param itemDrop   - Optional item ID that this prop drops when interacted with
 * @returns The created mesh, or null if creation failed
 */
export async function createPropMeshAsync(
  scene: Scene,
  propType: string,
  interactive: boolean = false,
  itemDrop?: string
): Promise<AbstractMesh | null> {
  const modelPath = MODEL_MAP[propType];

  // No GLB model mapped -- use procedural geometry directly
  if (!modelPath) {
    return createPropMesh(scene, propType, interactive, itemDrop);
  }

  try {
    // Separate directory and filename for SceneLoader
    const lastSlash = modelPath.lastIndexOf('/');
    const rootUrl = '/' + modelPath.substring(0, lastSlash + 1);
    const fileName = modelPath.substring(lastSlash + 1);

    const result = await SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);

    if (result.meshes.length === 0) {
      console.warn(`PropFactory: GLB loaded but no meshes found for "${propType}", falling back to procedural.`);
      return createPropMesh(scene, propType, interactive, itemDrop);
    }

    // The root mesh from the imported GLB
    const imported = result.meshes[0];

    // Create a wrapper TransformNode so we can position/rotate/scale
    // the prop independently of the internal model hierarchy.
    const root = new TransformNode(`${propType}_glb_root`, scene);
    imported.parent = root;

    // Ensure all child meshes are visible and receive shadows
    result.meshes.forEach(m => {
      m.isVisible = true;
      m.setEnabled(true);
      if (m.receiveShadows !== undefined) {
        m.receiveShadows = true;
      }
    });

    // Measure the loaded model's natural bounding box
    const bounds = measureModelBounds(result.meshes);

    // Get target dimensions from the prop definition
    const definition = getPropDefinition(propType);
    const meshDef = definition.mesh;

    // Determine target dimensions from the prop definition.
    // Composite props use approximate extents from their parts.
    let targetWidth  = meshDef.width  || meshDef.size || meshDef.diameter || 1;
    let targetHeight = meshDef.height || meshDef.size || 1;
    let targetDepth  = meshDef.depth  || meshDef.size || meshDef.diameter || 1;

    // For composite meshes, take a rough maximum from parts
    if (meshDef.type === 'composite' && meshDef.parts && meshDef.parts.length > 0) {
      targetWidth = 0;
      targetHeight = 0;
      targetDepth = 0;
      for (const part of meshDef.parts) {
        targetWidth  = Math.max(targetWidth,  part.width  || part.size || part.diameter || 0.5);
        targetDepth  = Math.max(targetDepth,  part.depth  || part.size || part.diameter || 0.5);
        // For height, accumulate the highest point including position offset
        const partTop = (part.height || part.size || 0.5) + (part.yOffset || 0) + (part.position?.[1] || 0);
        targetHeight = Math.max(targetHeight, partTop);
      }
    }

    // Compute uniform scale so the model fits within the target bounding box.
    // We use the axis that requires the most reduction to avoid overflow.
    const scaleX = targetWidth  / bounds.width;
    const scaleY = targetHeight / bounds.height;
    const scaleZ = targetDepth  / bounds.depth;
    const uniformScale = Math.min(scaleX, scaleY, scaleZ);

    imported.scaling.setAll(uniformScale);

    // Align the bottom of the model with y = 0 (ground plane)
    imported.position.y = -bounds.minY * uniformScale;

    // Tag with interactive metadata
    if (interactive) {
      const metadata = {
        interactive: true,
        propType: propType,
        isPickable: true,
        itemDrop: itemDrop
      };

      root.metadata = metadata;

      // Tag every child mesh for raycasting
      result.meshes.forEach(m => {
        m.metadata = { ...metadata };
        m.isPickable = true;
      });
    }

    // Return the root as AbstractMesh (TransformNode is compatible
    // via the same pattern used in createMeshFromDefinition for composites)
    return root as unknown as AbstractMesh;

  } catch (err) {
    console.warn(
      `PropFactory: Failed to load GLB for "${propType}" (${modelPath}), falling back to procedural.`,
      err
    );
    return createPropMesh(scene, propType, interactive, itemDrop);
  }
}

/**
 * Get collision radius for a prop type.
 */
export function getPropCollisionRadius(propType: string): number {
  const definition = getPropDefinition(propType);
  return definition.collision.radius;
}
