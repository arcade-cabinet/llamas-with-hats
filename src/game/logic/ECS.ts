import { AbstractMesh, Quaternion, Vector3 } from '@babylonjs/core';
import { World } from 'miniplex';

export interface Entity {
    id?: string;
    type?: 'carl' | 'paul' | 'prop';
    position?: Vector3;
    rotation?: Quaternion;
    mesh?: AbstractMesh;

    // Logic components
    behavior?: 'idle' | 'talking' | 'horror_react' | 'evaluating' | 'agitated' | 'stalking';
    hungerLevel?: number;
    horrorLevel?: number;
    isFood?: boolean;

    isRemoved?: boolean;
}

export const world = new World<Entity>();
