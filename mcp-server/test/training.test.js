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

  it('tells an agent to mark a private test set and never read it', () => {
    const answer = trainingGuardrails('private-test-set');
    assert.equal(answer.matched, 1);
    const g = answer.guardrails[0];
    assert.match(g.rule, /--tier local-only/);
    assert.match(g.rule, /never read it yourself/);
    assert.match(g.mistake, /outside AI service/);
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
    // the loop starts at forge_status, proves + packages with forge_export,
    // and ends at serving (a terminal step, never a tool)
    assert.equal(answer.command_order[0].tool, 'forge_status');
    const tools = answer.command_order.map((c) => c.tool).join(' ');
    for (const t of ['forge_discover', 'forge_split', 'forge_leak_audit',
      'forge_prereg_template', 'forge_prereg', 'forge_export', 'forge_lint']) {
      assert.ok(tools.includes(t), `command order missing ${t}`);
    }
    assert.match(answer.command_order.at(-1).tool, /\(terminal\) nmt-forge serve/);
    // a page a pip/npm user can open — never a path inside the source repo
    // (Round 9: it said "forge/docs/FAILURE_TAXONOMY.md in the monorepo")
    assert.match(answer.taxonomy, /https:\/\/champollion\.dev\/docs\/network\/getting-started\/diagnosing-training/);
    const text = formatTrainingGuardrails(answer);
    assert.match(text, /forge_status first/);
    assert.match(text, /diagnosing-training/);
    assert.doesNotMatch(text, /monorepo|FAILURE_TAXONOMY|forge\/docs\//);
    // the predictions come before any benchmark: prereg precedes the baseline
    // step and the split in the command order (Round 9)
    const steps = answer.command_order.map((c) => c.step);
    assert.ok(steps.indexOf('register') < steps.indexOf('screen'));
    assert.ok(steps.indexOf('screen') < steps.indexOf('prereg'));
    assert.ok(steps.indexOf('prereg') < steps.indexOf('baseline'));
    assert.ok(steps.indexOf('prereg') < steps.indexOf('split'));
    assert.ok(tools.includes('forge_compare'));
  });
});

describe('significance wording (Round 7)', () => {
  // The guidance said "a +0.5 chrF++ bump is probably noise" while
  // `mt-eval compare --significance` can call that same Δ significant. Both
  // are true statements about different things; the wording now says so.
  it('the ci guardrail and the agent guide say significant ≠ meaningful, never "probably noise"', async () => {
    const { readFileSync } = await import('node:fs');
    const guide = readFileSync(new URL('../instructions.md', import.meta.url), 'utf-8');
    const ci = formatTrainingGuardrails(trainingGuardrails('ci'));
    for (const [label, text] of [['instructions.md', guide], ['ci guardrail', ci]]) {
      assert.doesNotMatch(text, /probably noise/, label);
      assert.match(text, /significant yet not meaningful/, label);
      assert.match(text, /confidence interval on Δ/, label);
      assert.match(text, /uncorrected for testing several metrics/, label);
      assert.match(text, /mt-eval compare --significance/, label);
    }
  });
});
