/**
 * Tests for the get_training_guardrails tool logic (src/tools/training.js).
 *
 * Pure content module — no I/O to mock. The tests pin the contract agents
 * rely on: every guardrail carries rule + mistake + tooling, the topic
 * filter works by id and by keyword, and a miss lists the known topics
 * instead of returning silence.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  trainingGuardrails,
  formatTrainingGuardrails,
} from '../src/tools/training.js';

describe('trainingGuardrails', () => {
  it('returns every guardrail with the full contract when unfiltered', () => {
    const answer = trainingGuardrails();
    assert.equal(answer.status, 'ok');
    assert.ok(answer.matched >= 12, `expected ≥12 guardrails, got ${answer.matched}`);
    for (const g of answer.guardrails) {
      assert.ok(g.id && g.name, `guardrail missing id/name: ${JSON.stringify(g)}`);
      assert.ok(g.rule.length > 40, `${g.id}: rule too thin to act on`);
      assert.ok(g.mistake.length > 40, `${g.id}: no mistake story`);
      assert.ok(g.forge.length > 10, `${g.id}: no tooling pointer`);
    }
  });

  it('covers the ten ledger guards plus synthesis and training defaults', () => {
    const ids = new Set(trainingGuardrails().guardrails.map((g) => g.id));
    for (const id of ['discovery', 'split', 'dev-fence', 'leak-audit', 'funnel',
      'conventions', 'coverage', 'strata', 'ci', 'ledger', 'prereg',
      'synthesis', 'training', 'schedule']) {
      assert.ok(ids.has(id), `missing guardrail: ${id}`);
    }
  });

  it('filters by exact id', () => {
    const answer = trainingGuardrails('dev-fence');
    assert.equal(answer.matched, 1);
    assert.equal(answer.guardrails[0].id, 'dev-fence');
  });

  it('filters by keyword across name/rule/mistake', () => {
    const answer = trainingGuardrails('Jaccard');
    assert.ok(answer.matched >= 1);
    assert.ok(answer.guardrails.some((g) => g.id === 'leak-audit'));
  });

  it('a miss names the known topics instead of returning nothing', () => {
    const answer = trainingGuardrails('zzz-nonsense');
    assert.equal(answer.status, 'no-match');
    assert.ok(answer.known_topics.includes('prereg'));
  });
});

describe('formatTrainingGuardrails', () => {
  it('renders rule/mistake/tooling lines per guardrail', () => {
    const text = formatTrainingGuardrails(trainingGuardrails('split'));
    assert.match(text, /Group-disjoint splits/);
    assert.match(text, /RULE: /);
    assert.match(text, /THE MISTAKE IT KILLS: /);
    assert.match(text, /TOOLING: /);
    assert.match(text, /forge/);
  });

  it('renders the miss message with topics', () => {
    const text = formatTrainingGuardrails(trainingGuardrails('zzz'));
    assert.match(text, /No guardrail matches/);
    assert.match(text, /dev-fence/);
  });

  it('states the non-negotiables in the full rendering', () => {
    const text = formatTrainingGuardrails(trainingGuardrails());
    assert.match(text, /do_not_train/);
    assert.match(text, /REAL DATA ONLY/);
    assert.match(text, /round-trip/);
  });

  it('surfaces the command order + forge_* tools + taxonomy pointer', () => {
    const answer = trainingGuardrails();
    assert.ok(Array.isArray(answer.command_order));
    // the loop starts at forge_status and ends at the diagnosis lever
    assert.equal(answer.command_order[0].tool, 'forge_status');
    const tools = answer.command_order.map((c) => c.tool).join(' ');
    for (const t of ['forge_discover', 'forge_split', 'forge_leak_audit',
      'forge_prereg', 'forge_evaluate', 'forge_lint']) {
      assert.ok(tools.includes(t), `command order missing ${t}`);
    }
    assert.match(answer.taxonomy, /FAILURE_TAXONOMY\.md/);
    const text = formatTrainingGuardrails(answer);
    assert.match(text, /forge_status first/);
    assert.match(text, /FAILURE_TAXONOMY\.md/);
  });
});
