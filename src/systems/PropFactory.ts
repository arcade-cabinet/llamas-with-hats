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
 * 
 * ## Usage
 * 
 * ```ts
 * const mesh = createPropMesh(scene, 'couch', true);
 * mesh.position.set(x, 0, z);
 * ```
 * 
 * @see src/data/props.json - Prop definitions
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  AbstractMesh,
  TransformNode
} from '@babylonjs/core';
import { getPropDefinition, PropMeshDefinition } from '../data';

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
 * @returns The created mesh, or null if creation failed
 */
export function createPropMesh(
  scene: Scene,
  propType: string,
  interactive: boolean = false
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
      isPickable: true
    };
    mesh.isPickable = true;
    
    // Tag child meshes too
    if ('getChildMeshes' in mesh) {
      (mesh as AbstractMesh).getChildMeshes().forEach(child => {
        child.metadata = { interactive: true, propType, isPickable: true };
        child.isPickable = true;
      });
    }
  }
  
  return mesh;
}

/**
 * Get collision radius for a prop type.
 */
export function getPropCollisionRadius(propType: string): number {
  const definition = getPropDefinition(propType);
  return definition.collision.radius;
}
