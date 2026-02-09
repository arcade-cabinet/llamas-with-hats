/**
 * Scene prop creation — meshes, collision registration, and locked door barriers.
 */
import {
  Scene,
  AbstractMesh,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  Color3,
  ShadowGenerator,
} from '@babylonjs/core';
import { createPropMeshAsync } from '../../../systems/PropFactory';
import {
  createCollidersFromProps,
  CollisionSystem,
} from '../../../systems/CollisionSystem';
import type { RoomConfig } from '../../../types/game';
import type { GeneratedLayout } from '../../../systems/LayoutGenerator';

export interface SceneProps {
  propMeshMap: Map<string, AbstractMesh>;
  interactiveMeshes: AbstractMesh[];
}

export function createSceneProps(
  scene: Scene,
  layout: GeneratedLayout,
  allRoomConfigs: Map<string, RoomConfig>,
  shadowGen: ShadowGenerator,
  collisionSystem: CollisionSystem,
): SceneProps {
  const propMeshMap = new Map<string, AbstractMesh>();
  const interactiveMeshes: AbstractMesh[] = [];

  for (const [roomId, roomConfig] of allRoomConfigs) {
    const genRoom = layout.rooms.get(roomId);
    if (!genRoom) continue;

    const worldX = genRoom.worldPosition.x;
    const worldZ = genRoom.worldPosition.z;

    // Prop colliders offset to world coordinates
    const propColliders = createCollidersFromProps(roomConfig.props, roomId);
    for (const collider of propColliders) {
      collider.bounds.minX += worldX;
      collider.bounds.maxX += worldX;
      collider.bounds.minZ += worldZ;
      collider.bounds.maxZ += worldZ;
      collisionSystem.addProp(collider);
    }

    // Prop meshes in world space
    for (const prop of roomConfig.props) {
      createPropMeshAsync(scene, prop.type, prop.interactive, prop.itemDrop).then(mesh => {
        if (mesh) {
          mesh.position.set(worldX + prop.position.x, 0, worldZ + prop.position.z);
          mesh.rotation.y = prop.rotation;
          mesh.scaling.setAll(prop.scale);
          if (mesh instanceof AbstractMesh) {
            shadowGen.addShadowCaster(mesh);
          } else if ('getChildMeshes' in mesh) {
            (mesh as TransformNode).getChildMeshes().forEach(child => {
              shadowGen.addShadowCaster(child);
              child.receiveShadows = true;
            });
          }
          if (prop.itemDrop) {
            propMeshMap.set(prop.itemDrop, mesh);
          }
          if (prop.interactive && mesh instanceof AbstractMesh) {
            interactiveMeshes.push(mesh);
          }
        }
      });
    }

    // Locked door barriers
    for (const exit of roomConfig.exits) {
      if (exit.locked && exit.id) {
        const doorWorldX = worldX + exit.position.x;
        const doorWorldZ = worldZ + exit.position.z;
        collisionSystem.addProp({
          id: `lock_${exit.id}`,
          type: 'lock',
          bounds: {
            minX: doorWorldX - 1.0,
            maxX: doorWorldX + 1.0,
            minZ: doorWorldZ - 1.0,
            maxZ: doorWorldZ + 1.0,
          },
          solid: true,
          interactable: false,
        });

        const lockMarker = MeshBuilder.CreateBox(`lock_marker_${exit.id}`, {
          width: 1.5, height: 0.05, depth: 1.5,
        }, scene);
        const lockMat = new StandardMaterial(`lockMat_${exit.id}`, scene);
        lockMat.diffuseColor = new Color3(0.5, 0.15, 0.15);
        lockMat.emissiveColor = new Color3(0.2, 0.05, 0.05);
        lockMat.alpha = 0.5;
        lockMarker.material = lockMat;
        lockMarker.position.set(doorWorldX, 0.03, doorWorldZ);

        const lockIcon = MeshBuilder.CreateBox(`lock_icon_${exit.id}`, {
          width: 0.25, height: 0.4, depth: 0.15,
        }, scene);
        const lockIconMat = new StandardMaterial(`lockIconMat_${exit.id}`, scene);
        lockIconMat.diffuseColor = new Color3(0.6, 0.4, 0.1);
        lockIconMat.emissiveColor = new Color3(0.15, 0.1, 0.02);
        lockIcon.material = lockIconMat;
        lockIcon.position.set(doorWorldX, 0.6, doorWorldZ);
      }
    }
  }

  return { propMeshMap, interactiveMeshes };
}
