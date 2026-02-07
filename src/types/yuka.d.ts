// Type declarations for Yuka AI library
declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    divideScalar(s: number): this;
    length(): number;
    squaredLength(): number;
    normalize(): this;
    clone(): Vector3;
    distanceTo(v: Vector3): number;
    squaredDistanceTo(v: Vector3): number;
  }

  export class Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x?: number, y?: number, z?: number, w?: number);
  }

  export class GameEntity {
    uuid: string;
    name: string;
    active: boolean;
    children: GameEntity[];
    parent: GameEntity | null;
    neighbors: GameEntity[];
    neighborhoodRadius: number;
    updateNeighborhood: boolean;
    position: Vector3;
    rotation: Quaternion;
    velocity: Vector3;
    scale: Vector3;
    forward: Vector3;
    up: Vector3;
    boundingRadius: number;
    maxTurnRate: number;
    canActivateTrigger: boolean;
    worldMatrix: any;

    constructor();
    start(): this;
    update(delta: number): this;
    dispose(): this;
    sendMessage(receiver: GameEntity, telegram: any): this;
    handleMessage(telegram: any): boolean;
  }

  export class MovingEntity extends GameEntity {
    maxSpeed: number;
    mass: number;

    getDirection(result: Vector3): Vector3;
    getSpeed(): number;
    getSpeedSquared(): number;
  }

  export class Vehicle extends MovingEntity {
    maxForce: number;
    steering: SteeringManager;
    smoother: Smoother | null;

    constructor();
  }

  export class SteeringManager {
    vehicle: Vehicle;
    behaviors: SteeringBehavior[];

    constructor(vehicle: Vehicle);
    add(behavior: SteeringBehavior): this;
    remove(behavior: SteeringBehavior): this;
    clear(): this;
    calculate(delta: number, result: Vector3): Vector3;
  }

  export class SteeringBehavior {
    active: boolean;
    weight: number;
    
    constructor();
    calculate(vehicle: Vehicle, force: Vector3, delta: number): Vector3;
  }

  export class SeekBehavior extends SteeringBehavior {
    target: Vector3;
    constructor(target?: Vector3);
  }

  export class FleeBehavior extends SteeringBehavior {
    target: Vector3;
    panicDistance: number;
    constructor(target?: Vector3, panicDistance?: number);
  }

  export class ArriveBehavior extends SteeringBehavior {
    target: Vector3;
    deceleration: number;
    tolerance: number;
    constructor(target?: Vector3, deceleration?: number, tolerance?: number);
  }

  export class PursuitBehavior extends SteeringBehavior {
    evader: Vehicle;
    predictionFactor: number;
    constructor(evader?: Vehicle, predictionFactor?: number);
  }

  export class EvadeBehavior extends SteeringBehavior {
    pursuer: Vehicle;
    panicDistance: number;
    predictionFactor: number;
    constructor(pursuer?: Vehicle, panicDistance?: number, predictionFactor?: number);
  }

  export class WanderBehavior extends SteeringBehavior {
    radius: number;
    distance: number;
    jitter: number;
    constructor(radius?: number, distance?: number, jitter?: number);
  }

  export class FollowPathBehavior extends SteeringBehavior {
    path: any;
    nextWaypointDistance: number;
    constructor(path?: any, nextWaypointDistance?: number);
  }

  export class ObstacleAvoidanceBehavior extends SteeringBehavior {
    obstacles: GameEntity[];
    brakingWeight: number;
    dBoxMinLength: number;
    constructor(obstacles?: GameEntity[]);
  }

  export class EntityManager {
    entities: GameEntity[];
    
    constructor();
    add(entity: GameEntity): this;
    remove(entity: GameEntity): this;
    clear(): this;
    update(delta: number): this;
    updateNeighborhood(entity: GameEntity): this;
    sendMessage(sender: GameEntity, receiver: GameEntity, message: string, delay?: number, data?: any): this;
  }

  export class Time {
    _previousTime: number;
    _currentTime: number;
    
    constructor();
    getDelta(): number;
    getElapsed(): number;
    update(): this;
  }

  export class Smoother {
    count: number;
    history: Vector3[];
    
    constructor(count?: number);
    calculate(value: Vector3, average: Vector3): Vector3;
  }

  export class Path {
    loop: boolean;
    
    constructor();
    add(waypoint: Vector3): this;
    clear(): this;
    current(): Vector3;
    advance(): this;
    finished(): boolean;
  }

  export class Graph {
    digraph: boolean;
    
    constructor();
    addNode(node: any): number;
    addEdge(edge: any): this;
    getNode(index: number): any;
    getEdge(from: number, to: number): any;
    getNodes(): any[];
    getEdges(): any[];
    clear(): this;
  }

  export class NavMesh {
    regions: any[];
    graph: Graph;
    
    constructor();
    fromPolygons(polygons: any[]): this;
    findPath(from: Vector3, to: Vector3): Vector3[];
    getClosestRegion(point: Vector3): any;
  }

  export class StateMachine {
    owner: GameEntity;
    currentState: State | null;
    previousState: State | null;
    globalState: State | null;
    
    constructor(owner: GameEntity);
    changeTo(state: State): this;
    revert(): this;
    isInState(state: State): boolean;
    update(): this;
    handleMessage(telegram: any): boolean;
  }

  export class State {
    constructor();
    enter(owner: GameEntity): void;
    execute(owner: GameEntity): void;
    exit(owner: GameEntity): void;
    onMessage(owner: GameEntity, telegram: any): boolean;
  }

  export class Trigger extends GameEntity {
    region: any;
    
    constructor(region?: any);
    check(entity: GameEntity): void;
    execute(entity: GameEntity): void;
  }

  export class TriggerRegion {
    constructor();
    touching(position: Vector3): boolean;
  }

  export class SphericalTriggerRegion extends TriggerRegion {
    position: Vector3;
    radius: number;
    constructor(position?: Vector3, radius?: number);
  }

  export class RectangularTriggerRegion extends TriggerRegion {
    min: Vector3;
    max: Vector3;
    constructor(min?: Vector3, max?: Vector3);
  }
}
