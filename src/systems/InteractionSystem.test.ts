/**
 * Tests for InteractionSystem
 * ===========================
 * 
 * Tests for player interactions with props and dialogue triggering.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createInteractionSystem, 
  InteractionSystem,
  InteractionCallbacks,
  STORY_DIALOGUES 
} from './InteractionSystem';
import { createCollisionSystem, CollisionSystem } from './CollisionSystem';

// ---------------------------------------------------------------------------
// Mock StoryManager and AchievementSystem singletons
// ---------------------------------------------------------------------------

const mockGetPropOverride = vi.fn().mockReturnValue(null);
const mockGetHorrorLevel = vi.fn().mockReturnValue(0);
const mockCheckTrigger = vi.fn();
const mockGetNpcDialogueTree = vi.fn().mockReturnValue(null);

vi.mock('./StoryManager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./StoryManager')>();
  return {
    ...actual,
    getStoryManager: () => ({
      getPropOverride: mockGetPropOverride,
      getHorrorLevel: mockGetHorrorLevel,
      checkTrigger: mockCheckTrigger,
      getNpcDialogueTree: mockGetNpcDialogueTree,
    }),
  };
});

const mockTrackPropExamined = vi.fn();
const mockTrackNpcInteraction = vi.fn();

vi.mock('./AchievementSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AchievementSystem')>();
  return {
    ...actual,
    getAchievementSystem: () => ({
      trackPropExamined: mockTrackPropExamined,
      trackNpcInteraction: mockTrackNpcInteraction,
    }),
  };
});

describe('createInteractionSystem', () => {
  let interaction: InteractionSystem;
  let collision: CollisionSystem;
  let callbacks: InteractionCallbacks;
  let dialogueHistory: Array<{ lines: string[]; speaker: string }>;
  let horrorIncreases: number[];
  let unlocks: string[];

  beforeEach(() => {
    dialogueHistory = [];
    horrorIncreases = [];
    unlocks = [];

    callbacks = {
      onDialogue: (lines, speaker) => {
        dialogueHistory.push({ lines, speaker });
      },
      onHorrorIncrease: (amount) => {
        horrorIncreases.push(amount);
      },
      onUnlock: (lockId) => {
        unlocks.push(lockId);
      }
    };

    collision = createCollisionSystem();
    collision.setRoomBounds({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });

    interaction = createInteractionSystem();
    interaction.setCollisionSystem(collision);
    interaction.setCallbacks(callbacks);
  });

  describe('update', () => {
    it('should detect nearby interactable', () => {
      collision.addProp({
        id: 'chest',
        type: 'chest',
        bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
        solid: true,
        interactable: true,
        interactionRadius: 1.5
      });

      const state = interaction.update(0.5, 0.5);

      expect(state.canInteract).toBe(true);
      expect(state.nearbyInteractable).not.toBeNull();
      expect(state.interactPrompt).not.toBeNull();
    });

    it('should not detect interactable when out of range', () => {
      collision.addProp({
        id: 'chest',
        type: 'chest',
        bounds: { minX: 5, maxX: 6, minZ: 5, maxZ: 6 },
        solid: true,
        interactable: true,
        interactionRadius: 1.5
      });

      const state = interaction.update(0, 0);

      expect(state.canInteract).toBe(false);
      expect(state.nearbyInteractable).toBeNull();
    });

    it('should return empty state without collision system', () => {
      const standalone = createInteractionSystem();
      standalone.setCallbacks(callbacks);

      const state = standalone.update(0, 0);

      expect(state.canInteract).toBe(false);
      expect(state.nearbyInteractable).toBeNull();
      expect(state.interactPrompt).toBeNull();
    });
  });

  describe('interact', () => {
    it('should trigger dialogue when near interactable', () => {
      collision.addProp({
        id: 'couch',
        type: 'couch',
        bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 1 },
        solid: true,
        interactable: true,
        interactionRadius: 1.5
      });

      interaction.update(1, 0.5);
      const result = interaction.interact('carl');

      expect(result).toBe(true);
      expect(dialogueHistory).toHaveLength(1);
      expect(dialogueHistory[0].speaker).toBe('carl');
    });

    it('should not trigger dialogue when too far', () => {
      collision.addProp({
        id: 'couch',
        type: 'couch',
        bounds: { minX: 5, maxX: 7, minZ: 5, maxZ: 6 },
        solid: true,
        interactable: true,
        interactionRadius: 1.5
      });

      interaction.update(0, 0);
      const result = interaction.interact('carl');

      expect(result).toBe(false);
      expect(dialogueHistory).toHaveLength(0);
    });

    it('should use different dialogue for paul', () => {
      collision.addProp({
        id: 'couch',
        type: 'couch',
        bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 1 },
        solid: true,
        interactable: true,
        interactionRadius: 1.5
      });

      interaction.update(1, 0.5);
      interaction.interact('paul');

      expect(dialogueHistory).toHaveLength(1);
      expect(dialogueHistory[0].speaker).toBe('paul');
    });
  });

  describe('interactWithProp', () => {
    it('should trigger dialogue for known prop type', () => {
      const result = interaction.interactWithProp('couch', 'carl');

      expect(result).toBe(true);
      expect(dialogueHistory).toHaveLength(1);
    });

    it('should use fallback dialogue for unknown prop type', () => {
      const result = interaction.interactWithProp('unknown_thing', 'carl');

      expect(result).toBe(true);
      expect(dialogueHistory).toHaveLength(1);
      // Should have used default dialogue with placeholder replacement
    });

    it('should interact with props successfully', () => {
      // Dialogue variations are now handled by atmosphere system
      const result = interaction.interactWithProp('couch', 'carl');

      expect(result).toBe(true);
      expect(dialogueHistory).toHaveLength(1);
    });

    it('should return false without callbacks', () => {
      const standalone = createInteractionSystem();
      const result = standalone.interactWithProp('couch', 'carl');

      expect(result).toBe(false);
    });
  });

  describe('checkStoryTrigger', () => {
    it('should trigger story dialogue with effects', () => {
      // Find a story dialogue with horror increase
      const beatWithHorror = STORY_DIALOGUES.find(d => 
        d.effects?.some(e => e.type === 'horror_increase')
      );

      if (beatWithHorror) {
        interaction.checkStoryTrigger(beatWithHorror.beatId, 'carl');

        expect(dialogueHistory).toHaveLength(1);
        expect(horrorIncreases.length).toBeGreaterThan(0);
      }
    });

    it('should trigger unlock effects', () => {
      // Find a story dialogue with unlock
      const beatWithUnlock = STORY_DIALOGUES.find(d => 
        d.effects?.some(e => e.type === 'unlock')
      );

      if (beatWithUnlock) {
        interaction.checkStoryTrigger(beatWithUnlock.beatId, 'carl');

        expect(unlocks.length).toBeGreaterThan(0);
      }
    });

    it('should not trigger for unknown beat', () => {
      interaction.checkStoryTrigger('nonexistent_beat', 'carl');

      expect(dialogueHistory).toHaveLength(0);
      expect(horrorIncreases).toHaveLength(0);
    });
  });

  describe('getState', () => {
    it('should return current interaction state', () => {
      collision.addProp({
        id: 'chest',
        type: 'chest',
        bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
        solid: true,
        interactable: true,
        interactionRadius: 1.5
      });

      interaction.update(0.5, 0.5);
      const state = interaction.getState();

      expect(state.canInteract).toBe(true);
      expect(state.nearbyInteractable).not.toBeNull();
    });

    it('should return a copy (not mutable reference)', () => {
      const state1 = interaction.getState();
      const state2 = interaction.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });
});

describe('STORY_DIALOGUES', () => {
  it('should have required structure', () => {
    STORY_DIALOGUES.forEach(dialogue => {
      expect(dialogue.beatId).toBeDefined();
      expect(typeof dialogue.beatId).toBe('string');
      expect(dialogue.carl).toBeDefined();
      expect(Array.isArray(dialogue.carl)).toBe(true);
      expect(dialogue.paul).toBeDefined();
      expect(Array.isArray(dialogue.paul)).toBe(true);
    });
  });

  it('should have unique beat IDs', () => {
    const beatIds = STORY_DIALOGUES.map(d => d.beatId);
    const uniqueIds = new Set(beatIds);
    expect(uniqueIds.size).toBe(beatIds.length);
  });
});

// ---------------------------------------------------------------------------
// Prop Override Integration Tests
// ---------------------------------------------------------------------------

describe('interactWithProp — prop override integration', () => {
  let interaction: InteractionSystem;
  let dialogueHistory: Array<{ lines: string[]; speaker: string }>;
  let callbacks: InteractionCallbacks;

  beforeEach(() => {
    dialogueHistory = [];

    callbacks = {
      onDialogue: (lines, speaker) => {
        dialogueHistory.push({ lines, speaker });
      },
      onDialogueTree: vi.fn(),
    };

    interaction = createInteractionSystem();
    interaction.setCallbacks(callbacks);

    // Reset mocks between tests
    mockGetPropOverride.mockReset().mockReturnValue(null);
    mockGetHorrorLevel.mockReset().mockReturnValue(0);
    mockCheckTrigger.mockReset();
    mockGetNpcDialogueTree.mockReset().mockReturnValue(null);
    mockTrackPropExamined.mockReset();
    mockTrackNpcInteraction.mockReset();
  });

  it('should use prop override character lines instead of generic dialogue', () => {
    mockGetPropOverride.mockReturnValue({
      carl: ['Carl override line 1', 'Carl override line 2'],
      paul: ['Paul override line 1'],
    });

    interaction.interactWithProp('couch', 'carl');

    expect(dialogueHistory).toHaveLength(1);
    expect(dialogueHistory[0].lines).toEqual([
      'Carl override line 1',
      'Carl override line 2',
    ]);
    expect(dialogueHistory[0].speaker).toBe('carl');
  });

  it('should use paul lines from prop override when character is paul', () => {
    mockGetPropOverride.mockReturnValue({
      carl: ['Carl says something'],
      paul: ['Paul override line A', 'Paul override line B'],
    });

    interaction.interactWithProp('couch', 'paul');

    expect(dialogueHistory).toHaveLength(1);
    expect(dialogueHistory[0].lines).toEqual([
      'Paul override line A',
      'Paul override line B',
    ]);
    expect(dialogueHistory[0].speaker).toBe('paul');
  });

  it('should use horror lines when horror level >= 6 and override has horror lines', () => {
    mockGetPropOverride.mockReturnValue({
      carl: ['Normal Carl line'],
      paul: ['Normal Paul line'],
      horror: ['Something is deeply wrong here...', 'The walls are watching.'],
    });
    mockGetHorrorLevel.mockReturnValue(6);

    interaction.interactWithProp('couch', 'carl');

    expect(dialogueHistory).toHaveLength(1);
    expect(dialogueHistory[0].lines).toEqual([
      'Something is deeply wrong here...',
      'The walls are watching.',
    ]);
    expect(dialogueHistory[0].speaker).toBe('carl');
  });

  it('should use character lines when horror level < 6 even if override has horror lines', () => {
    mockGetPropOverride.mockReturnValue({
      carl: ['Normal Carl line'],
      paul: ['Normal Paul line'],
      horror: ['Creepy horror line'],
    });
    mockGetHorrorLevel.mockReturnValue(5);

    interaction.interactWithProp('couch', 'carl');

    expect(dialogueHistory).toHaveLength(1);
    expect(dialogueHistory[0].lines).toEqual(['Normal Carl line']);
  });

  it('should use character lines when horror >= 6 but override has no horror lines', () => {
    mockGetPropOverride.mockReturnValue({
      carl: ['Carl line at high horror'],
      paul: ['Paul line at high horror'],
    });
    mockGetHorrorLevel.mockReturnValue(8);

    interaction.interactWithProp('couch', 'carl');

    expect(dialogueHistory).toHaveLength(1);
    expect(dialogueHistory[0].lines).toEqual(['Carl line at high horror']);
  });

  it('should fall back to generic prop dialogue when getPropOverride returns null', () => {
    mockGetPropOverride.mockReturnValue(null);

    const result = interaction.interactWithProp('couch', 'carl');

    expect(result).toBe(true);
    expect(dialogueHistory).toHaveLength(1);
    // Generic dialogue comes from prop-dialogues.json via getPropDialogue,
    // so the lines should be non-empty but NOT the override lines
    expect(dialogueHistory[0].lines.length).toBeGreaterThan(0);
    expect(dialogueHistory[0].speaker).toBe('carl');
  });

  it('should call trackPropExamined with the prop type', () => {
    interaction.interactWithProp('bookshelf', 'carl');

    expect(mockTrackPropExamined).toHaveBeenCalledTimes(1);
    expect(mockTrackPropExamined).toHaveBeenCalledWith('bookshelf');
  });

  it('should call trackPropExamined for each interaction', () => {
    interaction.interactWithProp('couch', 'carl');
    interaction.interactWithProp('chest', 'paul');

    expect(mockTrackPropExamined).toHaveBeenCalledTimes(2);
    expect(mockTrackPropExamined).toHaveBeenNthCalledWith(1, 'couch');
    expect(mockTrackPropExamined).toHaveBeenNthCalledWith(2, 'chest');
  });

  it('should call trackNpcInteraction when interacting with carl NPC prop', () => {
    mockGetNpcDialogueTree.mockReturnValue({
      id: 'carl_tree',
      character: 'carl',
      tree: { start: { lines: [], options: [] } },
    });

    interaction.interactWithProp('carl', 'carl');

    expect(mockTrackNpcInteraction).toHaveBeenCalledTimes(1);
  });

  it('should call trackNpcInteraction when interacting with paul NPC prop', () => {
    mockGetNpcDialogueTree.mockReturnValue({
      id: 'paul_tree',
      character: 'paul',
      tree: { start: { lines: [], options: [] } },
    });

    interaction.interactWithProp('paul', 'paul');

    expect(mockTrackNpcInteraction).toHaveBeenCalledTimes(1);
  });

  it('should not call trackNpcInteraction for non-NPC props', () => {
    interaction.interactWithProp('couch', 'carl');

    expect(mockTrackNpcInteraction).not.toHaveBeenCalled();
  });
});
