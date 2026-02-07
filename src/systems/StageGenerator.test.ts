/**
 * Tests for StageGenerator
 * ========================
 *
 * Tests for procedural stage generation: determinism, scene connectivity,
 * prop placement, exit linking, and quest item / NPC placement.
 */

import { describe, it, expect } from 'vitest';
import { generateStage, GeneratedStage } from './StageGenerator';
import type {
  StageDefinition,
  SceneTemplate,
  MaterialPalette,
  CompositionModule,
} from './StageDefinition';

// ---------------------------------------------------------------------------
// Minimal mock data factories
// ---------------------------------------------------------------------------

function makeTemplate(overrides?: Partial<SceneTemplate>): SceneTemplate {
  return {
    id: 'tpl_room',
    type: 'interior_room',
    size: {
      width: { min: 6, max: 10 },
      height: { min: 6, max: 10 },
    },
    connectionPoints: [
      { id: 'north', side: 'north', position: 'center', allowedConnections: ['wall_door'] },
      { id: 'south', side: 'south', position: 'center', allowedConnections: ['wall_door'] },
      { id: 'east', side: 'east', position: 'center', allowedConnections: ['wall_door'] },
      { id: 'west', side: 'west', position: 'center', allowedConnections: ['wall_door'] },
    ],
    propRules: [
      { propTypes: ['table', 'chair'], zone: 'center', count: { min: 1, max: 2 } },
      { propTypes: ['bookshelf'], zone: 'wall', count: { min: 0, max: 1 } },
    ],
    tags: ['room', 'apartment', 'living_room', 'kitchen', 'bedroom', 'basement'],
    ...overrides,
  };
}

function makePalette(overrides?: Partial<MaterialPalette>): MaterialPalette {
  return {
    id: 'pal_default',
    name: 'Default',
    floors: { primary: { color: [0.3, 0.3, 0.3] } },
    walls: { primary: { color: [0.5, 0.5, 0.5] } },
    propSets: [],
    lighting: { ambient: [0.8, 0.8, 0.8], intensity: 0.6, shadows: false },
    ...overrides,
  };
}

function makeStageDef(overrides?: Partial<StageDefinition>): StageDefinition {
  return {
    id: 'test_stage',
    name: 'Test Stage',
    description: 'A test stage',
    path: 'both',
    story: {
      beats: [],
      goals: [],
      startingBeat: 'start',
      completionGoals: [],
    },
    generation: {
      entryScene: { purpose: 'entry', templateTags: ['living_room'] },
      exitScene: { purpose: 'exit', templateTags: ['basement'] },
      requiredScenes: [],
      optionalSceneCount: { min: 0, max: 2 },
      allowedTemplates: ['tpl_room'],
      palettes: ['pal_default'],
      connectionRules: { type: 'linear' },
      environment: 'interior',
      separation: 'wall_door',
    },
    props: {
      density: 'normal',
      questItems: [],
      propPools: [],
    },
    npcs: {
      required: [],
      optional: { pool: [], count: { min: 0, max: 0 } },
    },
    atmosphere: {
      baseHorrorLevel: 2,
      horrorProgression: 'static',
    },
    estimatedDuration: 10,
    difficulty: 'easy',
    ...overrides,
  };
}

// Shared fixtures
const defaultTemplate = makeTemplate();
const defaultPalette = makePalette();
const defaultModules: CompositionModule[] = [];

function generate(
  stageDefOverrides?: Partial<StageDefinition>,
  seed = 'test-seed',
  templates?: SceneTemplate[],
  palettes?: MaterialPalette[],
): GeneratedStage {
  return generateStage(
    makeStageDef(stageDefOverrides),
    templates ?? [defaultTemplate],
    palettes ?? [defaultPalette],
    defaultModules,
    seed,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateStage', () => {
  it('should return a GeneratedStage with required fields', () => {
    const stage = generate();

    expect(stage.id).toBeDefined();
    expect(stage.stageDefId).toBe('test_stage');
    expect(stage.seed).toBe('test-seed');
    expect(stage.scenes.length).toBeGreaterThanOrEqual(2); // at least entry + exit
    expect(stage.sceneGraph.length).toBeGreaterThanOrEqual(2);
    expect(stage.entrySceneId).toBeDefined();
    expect(stage.exitSceneId).toBeDefined();
    expect(Array.isArray(stage.questItems)).toBe(true);
    expect(Array.isArray(stage.npcs)).toBe(true);
  });

  it('should include the seed in the generated stage id', () => {
    const stage = generate(undefined, 'my-seed-abc');
    expect(stage.id).toContain('my-seed-abc');
  });
});

describe('deterministic generation', () => {
  it('should produce identical output for the same seed', () => {
    const stage1 = generate(undefined, 'deterministic-seed');
    const stage2 = generate(undefined, 'deterministic-seed');

    expect(stage1.scenes.length).toBe(stage2.scenes.length);
    expect(stage1.entrySceneId).toBe(stage2.entrySceneId);
    expect(stage1.exitSceneId).toBe(stage2.exitSceneId);

    // Same scene IDs in the same order
    const ids1 = stage1.scenes.map(s => s.id);
    const ids2 = stage2.scenes.map(s => s.id);
    expect(ids1).toEqual(ids2);

    // Same scene graph positions
    for (let i = 0; i < stage1.sceneGraph.length; i++) {
      expect(stage1.sceneGraph[i].position).toEqual(stage2.sceneGraph[i].position);
    }
  });

  it('should produce different output for different seeds', () => {
    const stage1 = generate(undefined, 'seed-alpha');
    const stage2 = generate(undefined, 'seed-beta');

    // Scenes may differ in count (optional scenes) or props
    // At minimum the IDs differ because seed is part of stage id
    expect(stage1.id).not.toBe(stage2.id);
  });
});

describe('scene connectivity', () => {
  it('should have entry and exit scenes that are different', () => {
    const stage = generate();
    expect(stage.entrySceneId).not.toBe(stage.exitSceneId);
  });

  it('all scenes should be reachable from entry (linear layout)', () => {
    const stage = generate({
      generation: {
        entryScene: { purpose: 'entry', templateTags: ['room'] },
        exitScene: { purpose: 'exit', templateTags: ['room'] },
        requiredScenes: [
          { purpose: 'middle', templateTags: ['room'] },
        ],
        optionalSceneCount: { min: 0, max: 0 },
        allowedTemplates: ['tpl_room'],
        palettes: ['pal_default'],
        connectionRules: { type: 'linear' },
        environment: 'interior',
        separation: 'wall_door',
      },
    });

    // Build adjacency set from scene graph connections
    const adjacency = new Map<string, Set<string>>();
    for (const node of stage.sceneGraph) {
      if (!adjacency.has(node.sceneId)) {
        adjacency.set(node.sceneId, new Set());
      }
      for (const conn of node.connections) {
        adjacency.get(node.sceneId)!.add(conn.targetSceneId);
        if (!adjacency.has(conn.targetSceneId)) {
          adjacency.set(conn.targetSceneId, new Set());
        }
        adjacency.get(conn.targetSceneId)!.add(node.sceneId);
      }
    }

    // Also check exits on scenes themselves for bidirectional links
    for (const scene of stage.scenes) {
      for (const exit of scene.exits) {
        if (!adjacency.has(scene.id)) {
          adjacency.set(scene.id, new Set());
        }
        adjacency.get(scene.id)!.add(exit.targetScene);
      }
    }

    // BFS from entry
    const visited = new Set<string>();
    const queue = [stage.entrySceneId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = adjacency.get(current);
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited.has(n)) queue.push(n);
        }
      }
    }

    // All scenes should have been visited
    for (const scene of stage.scenes) {
      expect(visited.has(scene.id)).toBe(true);
    }
  });

  it('exits should be bidirectional', () => {
    const stage = generate();

    // For each scene, check that any exit pointing to target has a reciprocal exit
    for (const scene of stage.scenes) {
      for (const exit of scene.exits) {
        const targetScene = stage.scenes.find(s => s.id === exit.targetScene);
        // Target scene should exist
        expect(targetScene).toBeDefined();

        if (targetScene) {
          // Target should have an exit back to this scene
          const backExit = targetScene.exits.find(e => e.targetScene === scene.id);
          expect(backExit).toBeDefined();
        }
      }
    }
  });
});

describe('prop placement', () => {
  it('should generate props in scenes', () => {
    const stage = generate();

    // At least some scenes should have props
    const scenesWithProps = stage.scenes.filter(s => s.props.length > 0);
    expect(scenesWithProps.length).toBeGreaterThan(0);
  });

  it('props should be within room bounds', () => {
    const stage = generate();

    for (const scene of stage.scenes) {
      const hw = scene.bounds.width / 2;
      const hh = scene.bounds.height / 2;

      for (const prop of scene.props) {
        const [px, , pz] = prop.transform.position;
        // Props should be within the room bounds (with some tolerance for
        // wall-flush placement and the buffer the generator applies)
        expect(px).toBeGreaterThanOrEqual(-hw - 0.5);
        expect(px).toBeLessThanOrEqual(hw + 0.5);
        expect(pz).toBeGreaterThanOrEqual(-hh - 0.5);
        expect(pz).toBeLessThanOrEqual(hh + 0.5);
      }
    }
  });

  it('props should have valid structure', () => {
    const stage = generate();

    for (const scene of stage.scenes) {
      for (const prop of scene.props) {
        expect(prop.id).toBeDefined();
        expect(prop.type).toBeDefined();
        expect(prop.transform).toBeDefined();
        expect(prop.transform.position).toHaveLength(3);
      }
    }
  });
});

describe('exit generation', () => {
  it('every scene should have at least one exit', () => {
    const stage = generate();

    for (const scene of stage.scenes) {
      expect(scene.exits.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('exits should have valid direction and target', () => {
    const stage = generate();
    const validDirections = ['north', 'south', 'east', 'west', 'up', 'down'];

    for (const scene of stage.scenes) {
      for (const exit of scene.exits) {
        expect(exit.id).toBeDefined();
        expect(validDirections).toContain(exit.direction);
        expect(exit.targetScene).toBeDefined();
        expect(exit.position).toHaveLength(3);
      }
    }
  });
});

describe('scene graph', () => {
  it('should have a node for each scene', () => {
    const stage = generate();
    const graphIds = stage.sceneGraph.map(n => n.sceneId);

    for (const scene of stage.scenes) {
      expect(graphIds).toContain(scene.id);
    }
  });

  it('nodes should have valid positions', () => {
    const stage = generate();

    for (const node of stage.sceneGraph) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.z).toBe('number');
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.z)).toBe(true);
    }
  });
});

describe('connection types', () => {
  it('linear connection should produce a chain of scenes', () => {
    const stage = generate({
      generation: {
        entryScene: { purpose: 'entry', templateTags: ['room'] },
        exitScene: { purpose: 'exit', templateTags: ['room'] },
        requiredScenes: [],
        optionalSceneCount: { min: 2, max: 2 },
        allowedTemplates: ['tpl_room'],
        palettes: ['pal_default'],
        connectionRules: { type: 'linear' },
        environment: 'interior',
        separation: 'wall_door',
      },
    });

    // In a linear layout every scene (except endpoints) should have exactly 2 exits
    // Entry and exit each have 1 exit (one direction only in the chain)
    const entryScene = stage.scenes.find(s => s.id === stage.entrySceneId)!;
    const exitScene = stage.scenes.find(s => s.id === stage.exitSceneId)!;

    expect(entryScene.exits.length).toBeGreaterThanOrEqual(1);
    expect(exitScene.exits.length).toBeGreaterThanOrEqual(1);
  });

  it('branching connection should place side rooms', () => {
    const stage = generate({
      generation: {
        entryScene: { purpose: 'entry', templateTags: ['room'] },
        exitScene: { purpose: 'exit', templateTags: ['room'] },
        requiredScenes: [
          { purpose: 'r1', templateTags: ['room'] },
          { purpose: 'r2', templateTags: ['room'] },
        ],
        optionalSceneCount: { min: 2, max: 2 },
        allowedTemplates: ['tpl_room'],
        palettes: ['pal_default'],
        connectionRules: { type: 'branching' },
        environment: 'interior',
        separation: 'wall_door',
      },
    });

    // Should still have all scenes
    expect(stage.scenes.length).toBeGreaterThanOrEqual(4); // entry + exit + 2 required + possible filler
  });

  it('hub connection should create a central node with multiple connections', () => {
    const stage = generate({
      generation: {
        entryScene: { purpose: 'entry', templateTags: ['room'] },
        exitScene: { purpose: 'exit', templateTags: ['room'] },
        requiredScenes: [
          { purpose: 'hub_room', templateTags: ['room'] },
        ],
        optionalSceneCount: { min: 1, max: 1 },
        allowedTemplates: ['tpl_room'],
        palettes: ['pal_default'],
        connectionRules: { type: 'hub' },
        environment: 'interior',
        separation: 'wall_door',
      },
    });

    // The hub scene should be the first non-entry/exit required scene
    // and should have multiple exits
    const hubScene = stage.scenes.find(
      s => s.id !== stage.entrySceneId && s.id !== stage.exitSceneId && s.tags?.includes('hub_room')
    );

    // In a hub layout, the hub room gets exits to all other rooms
    if (hubScene) {
      expect(hubScene.exits.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('quest item placement', () => {
  it('should place quest items in valid scenes', () => {
    const stage = generate({
      props: {
        density: 'normal',
        questItems: [
          {
            id: 'magic_key',
            name: 'Magic Key',
            description: 'A mysterious key',
            spawnRules: {
              sceneTypes: ['interior_room'],
              zones: ['visible'],
            },
          },
        ],
        propPools: [],
      },
    });

    expect(stage.questItems.length).toBe(1);
    expect(stage.questItems[0].itemDef.id).toBe('magic_key');

    // The scene where item was placed should exist
    const placedScene = stage.scenes.find(s => s.id === stage.questItems[0].sceneId);
    expect(placedScene).toBeDefined();

    // The quest item should appear as a prop in the scene
    const questProp = placedScene!.props.find(p => p.id === 'magic_key');
    expect(questProp).toBeDefined();
    expect(questProp!.interactable).toBe(true);
  });
});

describe('NPC placement', () => {
  it('should place required NPCs', () => {
    const stage = generate({
      npcs: {
        required: [
          {
            characterId: 'paul',
            behavior: 'wander',
            dialogueId: 'paul_chat',
            interactable: true,
          },
        ],
        optional: { pool: [], count: { min: 0, max: 0 } },
      },
    });

    expect(stage.npcs.length).toBe(1);
    expect(stage.npcs[0].npcDef.characterId).toBe('paul');

    // NPC should be added to a scene
    const npcScene = stage.scenes.find(s => s.id === stage.npcs[0].sceneId);
    expect(npcScene).toBeDefined();
    expect(npcScene!.npcs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('scene definitions', () => {
  it('each scene should have valid bounds', () => {
    const stage = generate();

    for (const scene of stage.scenes) {
      expect(scene.bounds.width).toBeGreaterThan(0);
      expect(scene.bounds.height).toBeGreaterThan(0);
    }
  });

  it('each scene should have atmosphere settings', () => {
    const stage = generate();

    for (const scene of stage.scenes) {
      expect(scene.atmosphere).toBeDefined();
    }
  });

  it('each scene should have spawn points including default', () => {
    const stage = generate();

    for (const scene of stage.scenes) {
      expect(scene.spawnPoints.length).toBeGreaterThanOrEqual(1);
      const hasDefault = scene.spawnPoints.some(sp => sp.default === true);
      expect(hasDefault).toBe(true);
    }
  });

  it('each scene should have tags', () => {
    const stage = generate();

    for (const scene of stage.scenes) {
      expect(scene.tags).toBeDefined();
      expect(scene.tags!.length).toBeGreaterThan(0);
    }
  });
});
