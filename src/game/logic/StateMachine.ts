import { Entity } from './ECS';

export type AIState = 'idle' | 'talking' | 'horror_react' | 'evaluating' | 'agitated' | 'stalking';

export interface StateDefinition {
    name: AIState;
    onEnter?: (entity: Entity) => void;
    onUpdate?: (entity: Entity, deltaTime: number) => void;
    onExit?: (entity: Entity) => void;
}

export class StateMachine {
    private entity: Entity;
    private states: Map<AIState, StateDefinition> = new Map();
    private currentState: StateDefinition | null = null;

    constructor(entity: Entity) {
        this.entity = entity;
    }

    public addState(state: StateDefinition) {
        this.states.set(state.name, state);
    }

    public transitionTo(stateName: AIState) {
        if (this.currentState && this.currentState.onExit) {
            this.currentState.onExit(this.entity);
        }

        const nextState = this.states.get(stateName);
        if (nextState) {
            this.currentState = nextState;
            if (this.currentState.onEnter) {
                this.currentState.onEnter(this.entity);
            }
        }
    }

    public update(deltaTime: number) {
        if (this.currentState && this.currentState.onUpdate) {
            this.currentState.onUpdate(this.entity, deltaTime);
        }
    }

    public getCurrentState(): AIState | null {
        return this.currentState ? this.currentState.name : null;
    }
}
