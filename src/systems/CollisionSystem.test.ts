/**
 * Tests for CollisionSystem
 * =========================
 * 
 * Tests for collision detection, prop colliders, and movement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createCollisionSystem, 
  createPropBounds, 
  createCollidersFromProps,
  PROP_COLLISION_SIZES,
  CollisionSystem
} from './CollisionSystem';

describe('PROP_COLLISION_SIZES', () => {
  it('should have default prop size', () => {
    expect(PROP_COLLISION_SIZES['default']).toBeDefined();
    expect(PROP_COLLISION_SIZES['default'].width).toBeGreaterThan(0);
    expect(PROP_COLLISION_SIZES['default'].depth).toBeGreaterThan(0);
  });

  it('should have common furniture sizes', () => {
    expect(PROP_COLLISION_SIZES['couch']).toBeDefined();
    expect(PROP_COLLISION_SIZES['table']).toBeDefined();
    expect(PROP_COLLISION_SIZES['chair']).toBeDefined();
  });

  it('should have reasonable dimensions', () => {
    const couch = PROP_COLLISION_SIZES['couch'];
    expect(couch.width).toBeGreaterThan(1); // Couches are wide
    expect(couch.depth).toBeLessThan(couch.width); // But not as deep
  });
});

describe('createPropBounds', () => {
  it('should create bounds centered on position', () => {
    const bounds = createPropBounds('table', { x: 5, z: 5 });
    const tableSize = PROP_COLLISION_SIZES['table'];
    
    expect(bounds.minX).toBeCloseTo(5 - tableSize.width / 2);
    expect(bounds.maxX).toBeCloseTo(5 + tableSize.width / 2);
    expect(bounds.minZ).toBeCloseTo(5 - tableSize.depth / 2);
    expect(bounds.maxZ).toBeCloseTo(5 + tableSize.depth / 2);
  });

  it('should apply scale', () => {
    const normalBounds = createPropBounds('table', { x: 0, z: 0 }, 0, 1);
    const scaledBounds = createPropBounds('table', { x: 0, z: 0 }, 0, 2);
    
    const normalWidth = normalBounds.maxX - normalBounds.minX;
    const scaledWidth = scaledBounds.maxX - scaledBounds.minX;
    
    expect(scaledWidth).toBeCloseTo(normalWidth * 2);
  });

  it('should swap dimensions for 90 degree rotation', () => {
    const normal = createPropBounds('couch', { x: 0, z: 0 }, 0);
    const rotated = createPropBounds('couch', { x: 0, z: 0 }, Math.PI / 2);
    
    const normalWidth = normal.maxX - normal.minX;
    const normalDepth = normal.maxZ - normal.minZ;
    const rotatedWidth = rotated.maxX - rotated.minX;
    const rotatedDepth = rotated.maxZ - rotated.minZ;
    
    // Width and depth should be swapped (or close due to rounding)
    expect(rotatedWidth).toBeCloseTo(normalDepth, 1);
    expect(rotatedDepth).toBeCloseTo(normalWidth, 1);
  });

  it('should use default size for unknown prop types', () => {
    const bounds = createPropBounds('unknown_prop_xyz', { x: 0, z: 0 });
    const defaultSize = PROP_COLLISION_SIZES['default'];
    
    const width = bounds.maxX - bounds.minX;
    expect(width).toBeCloseTo(defaultSize.width);
  });
});

describe('createCollisionSystem', () => {
  let collision: CollisionSystem;

  beforeEach(() => {
    collision = createCollisionSystem();
  });

  it('should add and remove props', () => {
    collision.addProp({
      id: 'test-prop',
      type: 'table',
      bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
      solid: true,
      interactable: false
    });

    const colliders = collision.getAllColliders();
    expect(colliders).toHaveLength(1);
    expect(colliders[0].id).toBe('test-prop');

    collision.removeProp('test-prop');
    expect(collision.getAllColliders()).toHaveLength(0);
  });

  it('should clear all props', () => {
    collision.addProp({
      id: 'prop-1',
      type: 'table',
      bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
      solid: true,
      interactable: false
    });
    collision.addProp({
      id: 'prop-2',
      type: 'chair',
      bounds: { minX: 2, maxX: 3, minZ: -1, maxZ: 1 },
      solid: true,
      interactable: false
    });

    expect(collision.getAllColliders()).toHaveLength(2);
    
    collision.clear();
    expect(collision.getAllColliders()).toHaveLength(0);
  });

  describe('checkMovement', () => {
    it('should allow movement in empty space', () => {
      collision.setRoomBounds({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
      
      const result = collision.checkMovement(0, 0, 1, 1, 0.4);
      
      expect(result.blocked).toBe(false);
      expect(result.adjustedX).toBeCloseTo(1);
      expect(result.adjustedZ).toBeCloseTo(1);
    });

    it('should block movement into room bounds', () => {
      collision.setRoomBounds({ minX: -5, maxX: 5, minZ: -5, maxZ: 5 });
      
      const result = collision.checkMovement(0, 0, 10, 0, 0.4);
      
      expect(result.blocked).toBe(true);
      expect(result.adjustedX).toBeLessThanOrEqual(5 - 0.4);
    });

    it('should block movement into props', () => {
      collision.setRoomBounds({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
      collision.addProp({
        id: 'blocker',
        type: 'table',
        bounds: { minX: 3, maxX: 5, minZ: -1, maxZ: 1 },
        solid: true,
        interactable: false
      });

      const result = collision.checkMovement(0, 0, 4, 0, 0.4);
      
      expect(result.blocked).toBe(true);
      expect(result.adjustedX).toBeLessThan(3 - 0.4);
    });

    it('should not block movement for non-solid props', () => {
      collision.setRoomBounds({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
      collision.addProp({
        id: 'ghost',
        type: 'table',
        bounds: { minX: 3, maxX: 5, minZ: -1, maxZ: 1 },
        solid: false,
        interactable: true
      });

      const result = collision.checkMovement(0, 0, 4, 0, 0.4);
      
      expect(result.blocked).toBe(false);
    });

    it('should detect nearby interactables', () => {
      collision.setRoomBounds({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
      collision.addProp({
        id: 'interactive',
        type: 'chest',
        bounds: { minX: 1, maxX: 2, minZ: -0.5, maxZ: 0.5 },
        solid: true,
        interactable: true,
        interactionRadius: 2
      });

      const result = collision.checkMovement(0, 0, 0, 0, 0.4);
      
      expect(result.nearInteractable).toBeDefined();
      expect(result.nearInteractable?.id).toBe('interactive');
    });
  });

  describe('pointInCollider', () => {
    it('should detect point inside collider', () => {
      collision.addProp({
        id: 'box',
        type: 'table',
        bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
        solid: true,
        interactable: false
      });

      expect(collision.pointInCollider(1, 1)).not.toBeNull();
      expect(collision.pointInCollider(1, 1)?.id).toBe('box');
    });

    it('should not detect point outside collider', () => {
      collision.addProp({
        id: 'box',
        type: 'table',
        bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
        solid: true,
        interactable: false
      });

      expect(collision.pointInCollider(5, 5)).toBeNull();
    });
  });

  describe('findNearestInteractable', () => {
    it('should find nearest interactable within range', () => {
      collision.addProp({
        id: 'far',
        type: 'chest',
        bounds: { minX: 10, maxX: 11, minZ: 0, maxZ: 1 },
        solid: true,
        interactable: true
      });
      collision.addProp({
        id: 'near',
        type: 'chest',
        bounds: { minX: 2, maxX: 3, minZ: 0, maxZ: 1 },
        solid: true,
        interactable: true
      });

      const nearest = collision.findNearestInteractable(0, 0, 5);
      
      expect(nearest).not.toBeNull();
      expect(nearest?.id).toBe('near');
    });

    it('should return null if no interactables in range', () => {
      collision.addProp({
        id: 'far',
        type: 'chest',
        bounds: { minX: 10, maxX: 11, minZ: 0, maxZ: 1 },
        solid: true,
        interactable: true
      });

      const nearest = collision.findNearestInteractable(0, 0, 2);
      
      expect(nearest).toBeNull();
    });
  });
});

describe('createCollidersFromProps', () => {
  it('should create colliders for all props', () => {
    const props = [
      { type: 'table', position: { x: 0, z: 0 }, rotation: 0, scale: 1, interactive: false },
      { type: 'chair', position: { x: 2, z: 0 }, rotation: 0, scale: 1, interactive: false }
    ];

    const colliders = createCollidersFromProps(props, 'room_1');
    
    expect(colliders).toHaveLength(2);
    expect(colliders[0].type).toBe('table');
    expect(colliders[1].type).toBe('chair');
  });

  it('should mark furniture types as interactable', () => {
    const props = [
      { type: 'bookshelf', position: { x: 0, z: 0 }, rotation: 0, scale: 1, interactive: false },
      { type: 'barrel', position: { x: 2, z: 0 }, rotation: 0, scale: 1, interactive: false }
    ];

    const colliders = createCollidersFromProps(props, 'room_1');
    
    // Bookshelf is in the interactable list
    expect(colliders.find(c => c.type === 'bookshelf')?.interactable).toBe(true);
    // Barrel is not in the interactable list
    expect(colliders.find(c => c.type === 'barrel')?.interactable).toBe(false);
  });

  it('should generate unique IDs', () => {
    const props = [
      { type: 'table', position: { x: 0, z: 0 }, rotation: 0, scale: 1, interactive: false },
      { type: 'table', position: { x: 2, z: 0 }, rotation: 0, scale: 1, interactive: false }
    ];

    const colliders = createCollidersFromProps(props, 'room_1');
    
    expect(colliders[0].id).not.toBe(colliders[1].id);
  });
});
