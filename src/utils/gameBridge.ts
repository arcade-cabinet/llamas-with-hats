/**
 * Game Bridge — typed module replacing window globals
 * ====================================================
 *
 * Provides a typed, centralized channel between the React input layer
 * (GameView / useInputController) and the Babylon.js render loop
 * (GameRenderer).
 */

export interface GameInput {
  x: number;
  z: number;
  action?: boolean;
  inventory?: boolean;
  pause?: boolean;
}

type InputProvider = () => GameInput;
type InteractionHandler = () => void;

let inputProvider: InputProvider | null = null;
let interactionHandler: InteractionHandler | null = null;

export const GameBridge = {
  setInputProvider(provider: InputProvider) { inputProvider = provider; },
  getInput(): GameInput | null { return inputProvider?.() ?? null; },
  clearInputProvider() { inputProvider = null; },

  setInteractionHandler(handler: InteractionHandler) { interactionHandler = handler; },
  triggerInteraction() { interactionHandler?.(); },
  clearInteractionHandler() { interactionHandler = null; },

  clearAll() { inputProvider = null; interactionHandler = null; },
};
