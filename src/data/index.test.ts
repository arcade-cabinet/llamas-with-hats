/**
 * Tests for Data Module
 * =====================
 * 
 * Tests for prop definitions, dialogues, and data loading utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  propDefinitions,
  propDialogues,
  gameDefinition,
  getPropDefinition,
  getPropDialogue,
  getInteractPrompt,
  getStageList,
  getStartingStage,
  getNextStage,
  getCharacter,
  getPath
} from './index';

describe('propDefinitions', () => {
  it('should have props object', () => {
    expect(propDefinitions.props).toBeDefined();
    expect(typeof propDefinitions.props).toBe('object');
  });

  it('should have default prop', () => {
    expect(propDefinitions.defaultProp).toBeDefined();
    expect(propDefinitions.defaultProp.mesh).toBeDefined();
    expect(propDefinitions.defaultProp.material).toBeDefined();
    expect(propDefinitions.defaultProp.collision).toBeDefined();
  });

  it('should have common prop types', () => {
    expect(propDefinitions.props['table']).toBeDefined();
    expect(propDefinitions.props['chair']).toBeDefined();
    expect(propDefinitions.props['couch']).toBeDefined();
  });

  it('should have valid mesh definitions', () => {
    const table = propDefinitions.props['table'];
    expect(table.mesh.type).toBeDefined();
    expect(['box', 'cylinder', 'composite']).toContain(table.mesh.type);
  });
});

describe('propDialogues', () => {
  it('should have dialogues object', () => {
    expect(propDialogues.dialogues).toBeDefined();
    expect(typeof propDialogues.dialogues).toBe('object');
  });

  it('should have default dialogue', () => {
    expect(propDialogues.defaultDialogue).toBeDefined();
    expect(propDialogues.defaultDialogue.carl).toBeDefined();
    expect(propDialogues.defaultDialogue.paul).toBeDefined();
    expect(propDialogues.defaultDialogue.prompt).toBeDefined();
  });
});

describe('getPropDefinition', () => {
  it('should return definition for known prop', () => {
    const table = getPropDefinition('table');
    expect(table).toBeDefined();
    expect(table.mesh).toBeDefined();
  });

  it('should return default for unknown prop', () => {
    const unknown = getPropDefinition('completely_unknown_xyz');
    expect(unknown).toBeDefined();
    expect(unknown).toEqual(propDefinitions.defaultProp);
  });
});

describe('getPropDialogue', () => {
  it('should return dialogue for known prop', () => {
    const couchDialogue = getPropDialogue('couch');
    expect(couchDialogue).toBeDefined();
    expect(couchDialogue.carl).toBeDefined();
    expect(couchDialogue.paul).toBeDefined();
    expect(couchDialogue.prompt).toBeDefined();
  });

  it('should return default dialogue with placeholder replacement for unknown prop', () => {
    const unknown = getPropDialogue('mysterious_artifact');
    expect(unknown.prompt).toContain('mysterious_artifact');
  });

  it('should have non-empty dialogue arrays', () => {
    const dialogue = getPropDialogue('table');
    expect(dialogue.carl.length).toBeGreaterThan(0);
    expect(dialogue.paul.length).toBeGreaterThan(0);
  });
});

describe('getInteractPrompt', () => {
  it('should return prompt string for known prop', () => {
    const prompt = getInteractPrompt('couch');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should return prompt with type for unknown prop', () => {
    const prompt = getInteractPrompt('weird_thing');
    expect(prompt).toContain('weird_thing');
  });
});

describe('gameDefinition', () => {
  it('should have required top-level fields', () => {
    expect(gameDefinition.id).toBeDefined();
    expect(gameDefinition.name).toBeDefined();
    expect(gameDefinition.version).toBeDefined();
  });

  it('should have characters', () => {
    expect(gameDefinition.characters).toBeDefined();
    expect(gameDefinition.characters['carl']).toBeDefined();
    expect(gameDefinition.characters['paul']).toBeDefined();
  });

  it('should have paths', () => {
    expect(gameDefinition.paths).toBeDefined();
  });

  it('should have stage progression', () => {
    expect(gameDefinition.stageProgression).toBeDefined();
    expect(gameDefinition.stageProgression.stages).toBeDefined();
    expect(Array.isArray(gameDefinition.stageProgression.stages)).toBe(true);
    expect(gameDefinition.stageProgression.startingStage).toBeDefined();
  });
});

describe('getStageList', () => {
  it('should return array of stages', () => {
    const stages = getStageList();
    expect(Array.isArray(stages)).toBe(true);
    expect(stages.length).toBeGreaterThan(0);
  });

  it('should have required properties for each stage', () => {
    const stages = getStageList();
    stages.forEach(stage => {
      expect(stage.id).toBeDefined();
      expect(stage.name).toBeDefined();
      expect(stage.file).toBeDefined();
    });
  });
});

describe('getStartingStage', () => {
  it('should return a stage ID string', () => {
    const startingStage = getStartingStage();
    expect(typeof startingStage).toBe('string');
    expect(startingStage.length).toBeGreaterThan(0);
  });

  it('should match an existing stage', () => {
    const startingStage = getStartingStage();
    const stages = getStageList();
    const stageIds = stages.map(s => s.id);
    expect(stageIds).toContain(startingStage);
  });
});

describe('getNextStage', () => {
  it('should return next stage or null', () => {
    const stages = getStageList();
    if (stages.length > 0) {
      const next = getNextStage(stages[0].id);
      // Could be null (if last stage) or string (if has next)
      expect(next === null || typeof next === 'string').toBe(true);
    }
  });

  it('should return null for nonexistent stage', () => {
    const next = getNextStage('nonexistent_stage_xyz');
    expect(next).toBeNull();
  });
});

describe('getCharacter', () => {
  it('should return carl character info', () => {
    const carl = getCharacter('carl');
    expect(carl).toBeDefined();
    expect(carl.id).toBe('carl');
    expect(carl.name).toBeDefined();
  });

  it('should return paul character info', () => {
    const paul = getCharacter('paul');
    expect(paul).toBeDefined();
    expect(paul.id).toBe('paul');
    expect(paul.name).toBeDefined();
  });

  it('should return undefined for unknown character', () => {
    const unknown = getCharacter('unknown_character');
    expect(unknown).toBeUndefined();
  });
});

describe('getPath', () => {
  it('should return path info for valid path', () => {
    const paths = gameDefinition.paths;
    const pathIds = Object.keys(paths);
    
    if (pathIds.length > 0) {
      const path = getPath(pathIds[0]);
      expect(path).toBeDefined();
      expect(path.id).toBe(pathIds[0]);
    }
  });

  it('should return undefined for unknown path', () => {
    const unknown = getPath('unknown_path_xyz');
    expect(unknown).toBeUndefined();
  });
});
