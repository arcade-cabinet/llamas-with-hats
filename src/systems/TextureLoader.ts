// TextureLoader - PBR texture loading and room-type-to-texture mapping
// Loads AmbientCG PBR texture sets and creates BabylonJS PBRMaterials
//
// Texture files follow the convention:
//   /assets/textures/{path}_color.jpg
//   /assets/textures/{path}_normal.jpg
//   /assets/textures/{path}_roughness.jpg
//   /assets/textures/{path}_ao.jpg

import {
  Scene,
  PBRMaterial,
  Texture,
  Color3,
} from '@babylonjs/core';

// ============================================
// Texture path prefix (relative to public root)
// ============================================

const TEXTURE_BASE = `${import.meta.env.BASE_URL}assets/textures/`;

// ============================================
// Room-type-to-texture mapping
// ============================================

export interface TextureMapping {
  floor: string;
  wall: string;
}

/**
 * Maps room identifiers (from room.id or room.name) to texture paths.
 * Keys are matched as substrings against the room id/name, so
 * "kitchen_0" matches the "kitchen" entry.
 */
const ROOM_TEXTURE_MAP: Record<string, TextureMapping> = {
  living_room:  { floor: 'floors/wood/oak_planks',             wall: 'walls/wallpaper/textured_white' },
  lounge:       { floor: 'floors/wood/oak_planks',             wall: 'walls/wallpaper/textured_white' },
  kitchen:      { floor: 'floors/linoleum/kitchen_mixed',      wall: 'walls/tile/white_subway' },
  bedroom:      { floor: 'floors/carpet/beige_residential',    wall: 'walls/wallpaper/subtle_texture' },
  bathroom:     { floor: 'floors/tile/checkered_marble',       wall: 'walls/tile/white_square' },
  hallway:      { floor: 'floors/wood/pine_planks',            wall: 'walls/plaster/white_plaster' },
  corridor:     { floor: 'floors/wood/pine_planks',            wall: 'walls/plaster/white_plaster' },
  basement:     { floor: 'floors/concrete/dark_polished',      wall: 'walls/concrete/cracked_concrete' },
  storage:      { floor: 'floors/concrete/dark_polished',      wall: 'walls/concrete/cracked_concrete' },
  closet:       { floor: 'floors/concrete/dark_polished',      wall: 'walls/concrete/cracked_concrete' },
  dining:       { floor: 'floors/wood/herringbone_parquet',    wall: 'walls/wallpaper/textured_white' },
  office:       { floor: 'floors/wood/oak_planks',             wall: 'walls/plaster/worn_painted_wall' },
  study:        { floor: 'floors/wood/oak_planks',             wall: 'walls/plaster/worn_painted_wall' },
};

const DEFAULT_TEXTURES: TextureMapping = {
  floor: 'floors/wood/pine_planks',
  wall: 'walls/plaster/white_plaster',
};

/**
 * Determine texture mapping for a room by examining its id and name.
 * Matches room type keywords as substrings (e.g. "room_kitchen_0" matches "kitchen").
 */
export function getTexturesForRoom(roomId: string, roomName?: string): TextureMapping {
  const identifier = `${roomId}_${roomName ?? ''}`.toLowerCase();

  for (const [key, mapping] of Object.entries(ROOM_TEXTURE_MAP)) {
    if (identifier.includes(key)) {
      return mapping;
    }
  }

  return DEFAULT_TEXTURES;
}

/**
 * Resolve a texture mapping from an explicit material/texture string
 * (from SceneDefinition floor.material or walls.material/texture fields).
 * If the string looks like a path (contains '/'), use it directly.
 * Otherwise treat it as a keyword for the room mapping.
 */
export function resolveTexturePath(materialHint: string | undefined): string | null {
  if (!materialHint) return null;
  if (materialHint.includes('/')) {
    return materialHint;
  }
  // Try as a room-type keyword
  const mapping = ROOM_TEXTURE_MAP[materialHint.toLowerCase()];
  return mapping ? mapping.floor : null;
}

// ============================================
// Material cache (avoids duplicate loads per scene)
// ============================================

const materialCache = new Map<string, PBRMaterial>();

/**
 * Flush the material cache. Call when disposing a scene.
 */
export function clearTextureCache(): void {
  materialCache.clear();
}

// ============================================
// PBR Material creation
// ============================================

export interface PBRTextureOptions {
  /** Texture path prefix relative to the textures directory, e.g. "floors/wood/oak_planks" */
  texturePath: string;
  /** Unique name for the material */
  name: string;
  /** BabylonJS scene */
  scene: Scene;
  /** UV tiling scale for U (horizontal). Default 1. */
  uScale?: number;
  /** UV tiling scale for V (vertical). Default 1. */
  vScale?: number;
  /** Optional tint color to multiply with the albedo texture */
  tintColor?: Color3;
  /** Metallic value override (default 0 for non-metal surfaces) */
  metallic?: number;
  /** Roughness value override (default 1) */
  roughness?: number;
}

/**
 * Create a PBRMaterial with albedo, normal, roughness, and AO textures
 * loaded from the given path prefix. Handles missing maps gracefully --
 * BabylonJS Texture constructor loads asynchronously and silently fails
 * on 404, so the material degrades to flat PBR if files are absent.
 *
 * Returns null if the scene is disposed or an unexpected error occurs.
 */
export function createPBRMaterial(options: PBRTextureOptions): PBRMaterial | null {
  const {
    texturePath,
    name,
    scene,
    uScale = 1,
    vScale = 1,
    tintColor,
    metallic = 0,
    roughness = 1,
  } = options;

  // Check cache -- use getScene() to verify the material has not been disposed
  const cacheKey = `${texturePath}_${uScale}_${vScale}_${tintColor?.toHexString() ?? 'none'}`;
  const cached = materialCache.get(cacheKey);
  if (cached && cached.getScene() === scene) {
    return cached;
  }

  try {
    const mat = new PBRMaterial(name, scene);

    const basePath = `${TEXTURE_BASE}${texturePath}`;

    // Albedo / color map
    const albedo = new Texture(`${basePath}_color.jpg`, scene);
    albedo.uScale = uScale;
    albedo.vScale = vScale;
    mat.albedoTexture = albedo;

    // Tint: apply color multiplier to the albedo
    if (tintColor) {
      mat.albedoColor = tintColor;
    }

    // Normal / bump map
    const normal = new Texture(`${basePath}_normal.jpg`, scene);
    normal.uScale = uScale;
    normal.vScale = vScale;
    mat.bumpTexture = normal;
    // Reduce bump strength slightly so normals are not overpowering at game camera distance
    mat.bumpTexture.level = 0.8;

    // Roughness map (stored in the green channel of metallicTexture for PBR workflow)
    const roughnessTex = new Texture(`${basePath}_roughness.jpg`, scene);
    roughnessTex.uScale = uScale;
    roughnessTex.vScale = vScale;
    mat.metallicTexture = roughnessTex;
    mat.useRoughnessFromMetallicTextureAlpha = false;
    mat.useRoughnessFromMetallicTextureGreen = true;

    // Base metallic/roughness values
    mat.metallic = metallic;
    mat.roughness = roughness;

    // Ambient occlusion (may not exist for all texture sets)
    const ao = new Texture(`${basePath}_ao.jpg`, scene);
    ao.uScale = uScale;
    ao.vScale = vScale;
    mat.ambientTexture = ao;

    materialCache.set(cacheKey, mat);
    return mat;
  } catch (err) {
    console.warn(`[TextureLoader] Failed to create PBR material for "${texturePath}":`, err);
    return null;
  }
}

// ============================================
// Convenience helpers for floor and wall materials
// ============================================

/**
 * Create a PBR floor material. UV tiling is based on room dimensions
 * so that texture density stays consistent regardless of room size.
 * Assumes approximately 2 world units per texture tile.
 */
export function createFloorMaterial(
  scene: Scene,
  texturePath: string,
  roomWidth: number,
  roomHeight: number,
  tintColor?: Color3,
): PBRMaterial | null {
  const tileDensity = 2; // world units per tile repeat
  return createPBRMaterial({
    texturePath,
    name: `floor_pbr_${texturePath.replace(/\//g, '_')}`,
    scene,
    uScale: roomWidth / tileDensity,
    vScale: roomHeight / tileDensity,
    tintColor,
    metallic: 0,
    roughness: 1,
  });
}

/**
 * Create a PBR wall material. UV tiling is based on wall length
 * so the texture scales horizontally and tiles vertically based on wall height.
 * Assumes approximately 2 world units per texture tile.
 */
export function createWallMaterial(
  scene: Scene,
  texturePath: string,
  wallLength: number,
  wallHeight: number,
  tintColor?: Color3,
): PBRMaterial | null {
  const tileDensity = 2;
  return createPBRMaterial({
    texturePath,
    name: `wall_pbr_${texturePath.replace(/\//g, '_')}`,
    scene,
    uScale: wallLength / tileDensity,
    vScale: wallHeight / tileDensity,
    tintColor,
    metallic: 0,
    roughness: 1,
  });
}
