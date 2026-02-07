/**
 * Prop Factory
 * ============
 *
 * Loads GLB models for props. Every prop type MUST have a GLB model mapping.
 * There is no procedural fallback — missing or broken models are hard errors.
 *
 * @see public/assets/models/ - GLB model files
 * @see MODEL_MAP below - prop type → model path mapping
 */

import {
  Scene,
  AbstractMesh,
  TransformNode
} from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { getPropDefinition } from '../data';

// ============================================
// Prop Type to GLB Model Mapping
// ============================================

/**
 * Every prop type used in room configs MUST have an entry here.
 * If a prop type is missing, createPropMeshAsync will throw.
 */
const MODEL_MAP: Record<string, string> = {
  // ── Indoor furniture (CC0 from Kenney/Kay Lousberg) ──
  table:           'assets/models/furniture/tables/dining_table.glb',
  chair:           'assets/models/furniture/seating/chair.glb',
  bookshelf:       'assets/models/furniture/storage/bookcase.glb',
  cabinet:         'assets/models/furniture/storage/bookcase_doors.glb',
  dresser:         'assets/models/furniture/storage/dresser.glb',
  couch:           'assets/models/furniture/seating/sofa.glb',
  bed:             'assets/models/furniture/beds/bed_double.glb',
  desk:            'assets/models/furniture/tables/desk.glb',
  lamp:            'assets/models/furniture/lighting/lamp_table.glb',
  tv:              'assets/models/furniture/storage/tv_cabinet.glb',
  stool:           'assets/models/furniture/seating/stool_bar.glb',

  // ── Kitchen (CC0) ──
  fridge:          'assets/models/kitchen/appliances/refrigerator.glb',
  stove:           'assets/models/kitchen/appliances/stove.glb',
  counter:         'assets/models/kitchen/fixtures/counter.glb',

  // ── Bathroom (CC0) ──
  toilet:          'assets/models/bathroom/fixtures/toilet.glb',
  sink:            'assets/models/bathroom/fixtures/sink.glb',
  bathtub:         'assets/models/bathroom/fixtures/bathtub.glb',
  tub:             'assets/models/bathroom/fixtures/bathtub.glb',
  broken_mirror:   'assets/models/bathroom/fixtures/mirror.glb',

  // ── Indoor clutter / storage ──
  crate:           'assets/models/dungeon/props/crate_large.glb',
  barrel:          'assets/models/dungeon/props/barrel.glb',
  chest:           'assets/models/dungeon/props/chest_mini.glb',
  rug:             'assets/models/furniture/tables/coffee_table.glb',
  plant:           'assets/models/nature/plant_bush.glb',
  dead_plant:      'assets/models/nature/stump_old.glb',
  pillar:          'assets/models/props/pillarStone.glb',

  // ── Horror props ──
  bloodstain:      'assets/models/dungeon/props/trap.glb',
  torn_curtain:    'assets/models/dungeon/props/sword_shield_broken.glb',

  // ── Outdoor / graveyard props (CC0 from Kenney) ──
  bench:           'assets/models/graveyard/bench.glb',
  tree:            'assets/models/nature/tree_default_dark.glb',
  fence:           'assets/models/graveyard/fence.glb',
  statue:          'assets/models/nature/statue_column.glb',
  gravestone:      'assets/models/graveyard/gravestone-cross.glb',
  lantern:         'assets/models/graveyard/lantern-glass.glb',
  lightpost:       'assets/models/graveyard/lightpost-single.glb',
  fountain:        'assets/models/props/fountainRound.glb',
  rock:            'assets/models/nature/rock_largeA.glb',
  campfire:        'assets/models/nature/campfire_stones.glb',
  cross:           'assets/models/graveyard/cross.glb',
  pumpkin:         'assets/models/graveyard/pumpkin-carved.glb',
  sign:            'assets/models/nature/sign.glb',
  hedge:           'assets/models/props/hedge.glb',
  log:             'assets/models/nature/log.glb',
  cart:            'assets/models/props/cart.glb',
  iron_fence:      'assets/models/graveyard/iron-fence.glb',
  coffin:          'assets/models/graveyard/coffin.glb',
  crypt:           'assets/models/graveyard/crypt.glb',
  pine:            'assets/models/graveyard/pine.glb',

  // ── Urban / suburban outdoor props ──
  suburban_fence:  'assets/models/outdoor/suburban-fence.glb',
  suburban_tree:   'assets/models/outdoor/suburban-tree-large.glb',
  planter:         'assets/models/outdoor/planter.glb',
  billboard:       'assets/models/outdoor/sign_billboard.glb',
  building_facade: 'assets/models/outdoor/low_buildingA.glb',
  wall_solid:      'assets/models/outdoor/wall_solid.glb',
  debris:          'assets/models/graveyard/debris.glb',
  trash:           'assets/models/graveyard/debris-wood.glb',
};

/**
 * Compute the axis-aligned bounding box extents of a loaded model.
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
 * Load a GLB model for a prop type. Throws on failure — no silent fallbacks.
 *
 * Every prop type MUST have an entry in MODEL_MAP. If a model file is
 * missing or fails to load, this function throws so the error is visible
 * during development and testing.
 */
export async function createPropMeshAsync(
  scene: Scene,
  propType: string,
  interactive: boolean = false,
  itemDrop?: string
): Promise<AbstractMesh> {
  const modelPath = MODEL_MAP[propType];

  if (!modelPath) {
    throw new Error(
      `PropFactory: No GLB model mapped for prop type "${propType}". ` +
      `Add an entry to MODEL_MAP in PropFactory.ts.`
    );
  }

  const lastSlash = modelPath.lastIndexOf('/');
  const rootUrl = '/' + modelPath.substring(0, lastSlash + 1);
  const fileName = modelPath.substring(lastSlash + 1);

  const result = await SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);

  if (result.meshes.length === 0) {
    throw new Error(
      `PropFactory: GLB loaded but contained no meshes for "${propType}" (${modelPath}).`
    );
  }

  const imported = result.meshes[0];

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

  // Scale model to fit prop definition dimensions
  const bounds = measureModelBounds(result.meshes);
  const definition = getPropDefinition(propType);
  const meshDef = definition.mesh;

  let targetWidth  = meshDef.width  || meshDef.size || meshDef.diameter || 1;
  let targetHeight = meshDef.height || meshDef.size || 1;
  let targetDepth  = meshDef.depth  || meshDef.size || meshDef.diameter || 1;

  if (meshDef.type === 'composite' && meshDef.parts && meshDef.parts.length > 0) {
    targetWidth = 0;
    targetHeight = 0;
    targetDepth = 0;
    for (const part of meshDef.parts) {
      targetWidth  = Math.max(targetWidth,  part.width  || part.size || part.diameter || 0.5);
      targetDepth  = Math.max(targetDepth,  part.depth  || part.size || part.diameter || 0.5);
      const partTop = (part.height || part.size || 0.5) + (part.yOffset || 0) + (part.position?.[1] || 0);
      targetHeight = Math.max(targetHeight, partTop);
    }
  }

  const scaleX = targetWidth  / bounds.width;
  const scaleY = targetHeight / bounds.height;
  const scaleZ = targetDepth  / bounds.depth;
  const uniformScale = Math.min(scaleX, scaleY, scaleZ);

  imported.scaling.setAll(uniformScale);
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

    result.meshes.forEach(m => {
      m.metadata = { ...metadata };
      m.isPickable = true;
    });
  }

  return root as unknown as AbstractMesh;
}

/**
 * Get collision radius for a prop type.
 */
export function getPropCollisionRadius(propType: string): number {
  const definition = getPropDefinition(propType);
  return definition.collision.radius;
}
