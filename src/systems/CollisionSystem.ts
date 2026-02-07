/**
 * Collision System
 * ================
 * 
 * Handles collision detection for props, walls, and other obstacles.
 * Props are SOLID - characters cannot walk through them.
 * 
 * ## Collision Types:
 * - Props: Furniture, objects, etc. with bounding boxes
 * - Walls: Room boundaries with openings for doors
 * - Barriers: Invisible blockers (edges, triggers)
 * 
 * ## Usage:
 * ```ts
 * const collision = createCollisionSystem();
 * collision.addProp({ type: 'couch', position: {x: 0, z: 0}, bounds: {w: 2.5, d: 0.9} });
 * 
 * const canMove = collision.checkMovement(fromX, fromZ, toX, toZ, radius);
 * if (canMove.blocked) {
 *   // Use canMove.adjustedX, canMove.adjustedZ for slide collision
 * }
 * ```
 */

export interface CollisionBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PropCollider {
  id: string;
  type: string;
  bounds: CollisionBounds;
  solid: boolean;        // Can't walk through
  interactable: boolean; // Can trigger interaction
  interactionRadius?: number;
  dialogueId?: string;   // What dialogue to trigger
}

export interface MovementResult {
  blocked: boolean;
  adjustedX: number;
  adjustedZ: number;
  collidedWith?: PropCollider;
  nearInteractable?: PropCollider; // Closest interactable within range
}

export interface CollisionSystem {
  // Add/remove colliders
  addProp(prop: PropCollider): void;
  removeProp(id: string): void;
  clear(): void;
  
  // Collision checks
  checkMovement(
    fromX: number, 
    fromZ: number, 
    toX: number, 
    toZ: number, 
    radius: number
  ): MovementResult;
  
  // Check if a point is inside any collider
  pointInCollider(x: number, z: number): PropCollider | null;
  
  // Find nearest interactable within range
  findNearestInteractable(x: number, z: number, maxRange: number): PropCollider | null;
  
  // Room bounds
  setRoomBounds(bounds: CollisionBounds): void;
  
  // Get all colliders (for debug rendering)
  getAllColliders(): PropCollider[];
}

/**
 * Standard prop sizes - used to generate collision bounds
 */
export const PROP_COLLISION_SIZES: Record<string, { width: number; depth: number; height: number }> = {
  // Furniture
  'couch': { width: 2.5, depth: 0.9, height: 0.6 },
  'table': { width: 1.2, depth: 0.8, height: 0.5 },
  'chair': { width: 0.5, depth: 0.5, height: 0.8 },
  'bookshelf': { width: 1.2, depth: 0.4, height: 1.8 },
  'counter': { width: 2.0, depth: 0.6, height: 0.9 },
  'bed': { width: 2.0, depth: 2.4, height: 0.5 },
  'dresser': { width: 1.2, depth: 0.5, height: 0.9 },
  'nightstand': { width: 0.5, depth: 0.5, height: 0.6 },
  'desk': { width: 1.4, depth: 0.7, height: 0.75 },
  
  // Small objects (still have collision)
  'lamp': { width: 0.3, depth: 0.3, height: 1.4 },
  'barrel': { width: 0.5, depth: 0.5, height: 0.9 },
  'crate': { width: 0.6, depth: 0.6, height: 0.6 },
  'chest': { width: 0.8, depth: 0.5, height: 0.5 },
  'pillar': { width: 0.5, depth: 0.5, height: 2.0 },
  
  // Kitchen
  'fridge': { width: 0.9, depth: 0.8, height: 1.8 },
  'stove': { width: 0.8, depth: 0.7, height: 0.9 },
  'sink': { width: 0.8, depth: 0.6, height: 0.9 },
  
  // Bathroom
  'toilet': { width: 0.5, depth: 0.7, height: 0.5 },
  'bathtub': { width: 0.8, depth: 1.8, height: 0.6 },
  
  // Misc
  'plant': { width: 0.4, depth: 0.4, height: 0.8 },
  'trash': { width: 0.35, depth: 0.35, height: 0.5 },
  
  // Default for unknown types
  'default': { width: 0.5, depth: 0.5, height: 0.5 }
};

/**
 * Create collision bounds from prop definition
 */
export function createPropBounds(
  type: string,
  position: { x: number; z: number },
  rotation: number = 0,
  scale: number = 1
): CollisionBounds {
  const size = PROP_COLLISION_SIZES[type] || PROP_COLLISION_SIZES['default'];
  
  // Apply scale
  let w = size.width * scale;
  let d = size.depth * scale;
  
  // Swap width/depth for 90/270 degree rotations
  const normalizedRot = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (normalizedRot > Math.PI / 4 && normalizedRot < 3 * Math.PI / 4 ||
      normalizedRot > 5 * Math.PI / 4 && normalizedRot < 7 * Math.PI / 4) {
    [w, d] = [d, w];
  }
  
  return {
    minX: position.x - w / 2,
    maxX: position.x + w / 2,
    minZ: position.z - d / 2,
    maxZ: position.z + d / 2
  };
}

/**
 * Create the collision system
 */
export function createCollisionSystem(): CollisionSystem {
  const props = new Map<string, PropCollider>();
  let roomBounds: CollisionBounds = {
    minX: -100, maxX: 100,
    minZ: -100, maxZ: 100
  };
  
  // Margin around props for smoother collision
  const COLLISION_MARGIN = 0.05;
  
  return {
    addProp(prop: PropCollider) {
      props.set(prop.id, prop);
    },
    
    removeProp(id: string) {
      props.delete(id);
    },
    
    clear() {
      props.clear();
    },
    
    setRoomBounds(bounds: CollisionBounds) {
      roomBounds = bounds;
    },
    
    getAllColliders() {
      return Array.from(props.values());
    },
    
    checkMovement(
      _fromX: number, 
      _fromZ: number, 
      toX: number, 
      toZ: number, 
      radius: number = 0.4
    ): MovementResult {
      let adjustedX = toX;
      let adjustedZ = toZ;
      let blocked = false;
      let collidedWith: PropCollider | undefined;
      let nearInteractable: PropCollider | undefined;
      let nearestDist = Infinity;
      
      // Note: fromX/fromZ could be used for ray-casting collision in future
      void _fromX; void _fromZ;
      
      // Check room bounds first
      adjustedX = Math.max(roomBounds.minX + radius, Math.min(roomBounds.maxX - radius, adjustedX));
      adjustedZ = Math.max(roomBounds.minZ + radius, Math.min(roomBounds.maxZ - radius, adjustedZ));
      
      if (adjustedX !== toX || adjustedZ !== toZ) {
        blocked = true;
      }
      
      // Check each prop
      for (const prop of props.values()) {
        if (!prop.solid) continue;
        
        const b = prop.bounds;
        
        // Expand bounds by player radius
        const expandedMinX = b.minX - radius - COLLISION_MARGIN;
        const expandedMaxX = b.maxX + radius + COLLISION_MARGIN;
        const expandedMinZ = b.minZ - radius - COLLISION_MARGIN;
        const expandedMaxZ = b.maxZ + radius + COLLISION_MARGIN;
        
        // Check if destination is inside expanded bounds
        if (adjustedX >= expandedMinX && adjustedX <= expandedMaxX &&
            adjustedZ >= expandedMinZ && adjustedZ <= expandedMaxZ) {
          
          blocked = true;
          collidedWith = prop;
          
          // Calculate push-out direction (slide along the prop)
          const overlapLeft = adjustedX - expandedMinX;
          const overlapRight = expandedMaxX - adjustedX;
          const overlapTop = adjustedZ - expandedMinZ;
          const overlapBottom = expandedMaxZ - adjustedZ;
          
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          
          // Push out in the direction of minimum overlap
          if (minOverlap === overlapLeft) {
            adjustedX = expandedMinX - 0.01;
          } else if (minOverlap === overlapRight) {
            adjustedX = expandedMaxX + 0.01;
          } else if (minOverlap === overlapTop) {
            adjustedZ = expandedMinZ - 0.01;
          } else {
            adjustedZ = expandedMaxZ + 0.01;
          }
        }
        
        // Check for nearby interactables
        if (prop.interactable) {
          const centerX = (b.minX + b.maxX) / 2;
          const centerZ = (b.minZ + b.maxZ) / 2;
          const dist = Math.sqrt(
            Math.pow(adjustedX - centerX, 2) + 
            Math.pow(adjustedZ - centerZ, 2)
          );
          
          const interactRange = prop.interactionRadius || 1.5;
          if (dist < interactRange && dist < nearestDist) {
            nearestDist = dist;
            nearInteractable = prop;
          }
        }
      }
      
      return {
        blocked,
        adjustedX,
        adjustedZ,
        collidedWith,
        nearInteractable
      };
    },
    
    pointInCollider(x: number, z: number): PropCollider | null {
      for (const prop of props.values()) {
        if (!prop.solid) continue;
        
        const b = prop.bounds;
        if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
          return prop;
        }
      }
      return null;
    },
    
    findNearestInteractable(x: number, z: number, maxRange: number): PropCollider | null {
      let nearest: PropCollider | null = null;
      let nearestDist = maxRange;
      
      for (const prop of props.values()) {
        if (!prop.interactable) continue;
        
        const b = prop.bounds;
        const centerX = (b.minX + b.maxX) / 2;
        const centerZ = (b.minZ + b.maxZ) / 2;
        const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2));
        
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = prop;
        }
      }
      
      return nearest;
    }
  };
}

/**
 * Create colliders from a room's prop definitions
 */
export function createCollidersFromProps(
  props: Array<{
    type: string;
    position: { x: number; z: number };
    rotation: number;
    scale: number;
    interactive: boolean;
    itemDrop?: string;
  }>,
  roomId: string
): PropCollider[] {
  return props.map((prop, index) => {
    const id = `${roomId}_prop_${index}_${prop.type}`;
    const bounds = createPropBounds(prop.type, prop.position, prop.rotation, prop.scale);
    
    // Interactable props that might have dialogue
    const interactableTypes = [
      'bookshelf', 'chest', 'desk', 'dresser', 
      'fridge', 'stove', 'table', 'bed'
    ];
    
    return {
      id,
      type: prop.type,
      bounds,
      solid: true, // All props are solid by default
      interactable: prop.interactive || interactableTypes.includes(prop.type),
      interactionRadius: 1.5,
      dialogueId: prop.interactive ? `interact_${prop.type}` : undefined
    };
  });
}
