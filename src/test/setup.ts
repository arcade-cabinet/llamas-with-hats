/**
 * Test Setup
 * ==========
 * 
 * Global test configuration for Vitest.
 */

import { beforeAll, afterEach, vi } from 'vitest';

// Mock Babylon.js since we're testing in Node
vi.mock('@babylonjs/core', () => ({
  Scene: vi.fn(() => ({
    clearColor: null,
    render: vi.fn(),
    dispose: vi.fn(),
  })),
  Engine: vi.fn(() => ({
    runRenderLoop: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
  Vector3: class Vector3 {
    constructor(public x = 0, public y = 0, public z = 0) {}
    static Zero() { return new Vector3(0, 0, 0); }
    static One() { return new Vector3(1, 1, 1); }
    clone() { return new Vector3(this.x, this.y, this.z); }
    set(x: number, y: number, z: number) {
      this.x = x; this.y = y; this.z = z;
    }
  },
  Color3: class Color3 {
    constructor(public r = 0, public g = 0, public b = 0) {}
  },
  Color4: class Color4 {
    constructor(public r = 0, public g = 0, public b = 0, public a = 1) {}
  },
  TransformNode: vi.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    rotation: { x: 0, y: 0, z: 0 },
    dispose: vi.fn(),
  })),
  MeshBuilder: {
    CreateBox: vi.fn(() => ({
      position: { set: vi.fn() },
      rotation: { y: 0 },
      material: null,
      parent: null,
      dispose: vi.fn(),
    })),
    CreateGround: vi.fn(() => ({
      position: { y: 0 },
      material: null,
      receiveShadows: false,
      parent: null,
      dispose: vi.fn(),
    })),
    CreateCylinder: vi.fn(() => ({
      position: { set: vi.fn() },
      material: null,
      parent: null,
      dispose: vi.fn(),
    })),
    CreateDisc: vi.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0 },
      isVisible: false,
      material: null,
      scaling: { setAll: vi.fn() },
      dispose: vi.fn(),
    })),
  },
  StandardMaterial: vi.fn(() => ({
    diffuseColor: null,
    specularColor: null,
    emissiveColor: null,
    alpha: 1,
  })),
  HemisphericLight: vi.fn(() => ({
    intensity: 0,
    groundColor: null,
  })),
  DirectionalLight: vi.fn(() => ({
    intensity: 0,
    position: { x: 0, y: 0, z: 0 },
  })),
  ShadowGenerator: vi.fn(() => ({
    useBlurExponentialShadowMap: false,
    blurKernel: 0,
    darkness: 0,
    addShadowCaster: vi.fn(),
  })),
  Animation: vi.fn(() => ({
    setKeys: vi.fn(),
  })),
  AbstractMesh: vi.fn(),
  PointerEventTypes: {
    POINTERUP: 1,
    POINTERDOWN: 2,
  },
}));

// Mock Yuka with proper class constructors
vi.mock('yuka', () => {
  class MockVehicle {
    position = { 
      x: 0, y: 0, z: 0, 
      set: function(x: number, y: number, z: number) { 
        this.x = x; this.y = y; this.z = z; 
      }
    };
    velocity = { 
      x: 0, y: 0, z: 0, 
      squaredLength: () => 0, 
      set: function(x: number, y: number, z: number) { 
        this.x = x; this.y = y; this.z = z; 
      }
    };
    maxSpeed = 0;
    maxForce = 0;
    mass = 1;
    steering = { clear: vi.fn(), add: vi.fn() };
  }
  
  class MockGameEntity {
    position = { x: 0, y: 0, z: 0, set: vi.fn() };
    boundingRadius = 0;
  }
  
  class MockEntityManager {
    add = vi.fn();
    update = vi.fn();
    clear = vi.fn();
  }
  
  class MockArriveBehavior {
    target = null;
    constructor(_target?: unknown, _deceleration?: number, _tolerance?: number) {}
  }
  
  class MockWanderBehavior {
    constructor(_radius?: number, _distance?: number, _jitter?: number) {}
  }
  
  class MockFleeBehavior {
    target = null;
    constructor(_target?: unknown, _panicDistance?: number) {}
  }
  
  class MockObstacleAvoidanceBehavior {
    weight = 0;
    dBoxMinLength = 0;
    obstacles: unknown[] = [];
    constructor(_obstacles?: unknown[]) {}
  }
  
  return {
    Vehicle: MockVehicle,
    GameEntity: MockGameEntity,
    EntityManager: MockEntityManager,
    ArriveBehavior: MockArriveBehavior,
    WanderBehavior: MockWanderBehavior,
    FleeBehavior: MockFleeBehavior,
    ObstacleAvoidanceBehavior: MockObstacleAvoidanceBehavior,
  };
});

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Set up any global test utilities
beforeAll(() => {
  // Suppress console.log during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  }
});
