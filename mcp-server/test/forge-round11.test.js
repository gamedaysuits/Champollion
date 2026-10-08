/**
 * Round 11 (school + hospital personas), the MCP side of three forge fixes:
 *
 * 1. forge_split kept saying "relay summary.near_twin_advice … and follow it
 *    before training" after the advice had been followed, on a corpus whose
 *    templates chain so no split can give a twin-free dev set. forge now
 *    marks that verdict final (result.dev_near_twin.verdict.final), and a
 *    registered test set on the two-model route (near_twin[set].two_model);
 *    the hint relays those ONCE, as verdicts, never as steps to repeat.
 * 2. forge_init's note, its next step and the guide gave different orders.
 *    forge owns ONE order (`order` in init --json, `advice.order` in status);
 *    forge_init's and forge_status's hints render it, tool by tool.
 *
 * The helpers are tested directly, then against the REAL nmt-forge when it is
 * reachable (forge-loop.test.js's probe; skipped otherwise).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  forgeTool, initNextHint, initializedStatusHint, splitNearTwinSummary, splitNextHint, stepOrderText,
} from '../src/tools/forge.js';

const FINAL = {
  state: 'no-split-fixes', final: true,
  advice: 'no split fixes this dev set: … Your options: (1) Accept it and train … re-splitting will not change it',
};

const ORDER = [
  { step: 'register', what: 'register the test set', tool: 'forge_register_eval' },
  { step: 'leak-audit', what: 'screen the corpus against it', tool: 'forge_leak_audit' },
  { step: 'prereg', what: 'write the predictions', tool: 'forge_prereg_template → forge_prereg' },
  { step: 'baseline', what: 'only now benchmark', tool: 'run_benchmark' },
  { step: 'split', what: 'carve train/dev', tool: 'forge_split' },
  { step: 'train', what: 'check, then train', tool: 'forge_preflight, then `nmt-forge run` in a terminal' },
];

const inOrder = (text, needles) => {
  const at = needles.map((n) => text.indexOf(n));
  assert.ok(at.every((i) => i >= 0), `missing one of ${needles.join(', ')} in: ${text}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `out of order: ${needles.join(' → ')}`);
};

describe('forge_split: a final verdict is relayed once, never as a step to follow (Round 11)', () => {
  it('a final dev verdict goes to near_twin_verdicts, and the hint stops saying "follow it"', () => {
    const r = { near_twin: {}, dev_near_twin: { near_twin_rows: 91, advice: FINAL.advice, verdict: FINAL },
      near_dupe_carve_check: { chained: true } };
    assert.deepEqual(splitNearTwinSummary(r), { near_twin_verdicts: [FINAL.advice], templates_chain: true });
    const next = splitNextHint(r);
    assert.match(next, /relay summary\.near_twin_verdicts to the user ONCE/);
    assert.match(next, /re-splitting will not change them/);
    assert.match(next, /do not call forge_split again for them/);
    assert.doesNotMatch(next, /follow it before training/);
  });

  it('a registered test set on the two-model route is settled too; open advice is still followed', () => {
    const r = {
      near_twin: {
        'project-test': { near_twin_rows: 30, advice: 'expected for the ALL-DATA model of the two-model route',
          two_model: { clean_to: 'corpus.notwins.jsonl', trained: false } },
        'other-test': { near_twin_rows: 4, advice: 're-split with --near-dupe 0.6' },
      },
      dev_near_twin: null,
    };
    const sum = splitNearTwinSummary(r);
    assert.deepEqual(sum.near_twin_advice, ['re-split with --near-dupe 0.6']);
    assert.deepEqual(sum.near_twin_verdicts, ['expected for the ALL-DATA model of the two-model route']);
    const next = splitNextHint(r);
    assert.match(next, /relay summary\.near_twin_advice to the user and follow it before training/);
    assert.match(next, /relay summary\.near_twin_verdicts to the user ONCE/);
  });

  it('nothing to relay: forge_status, which names the preregistrations before training', () => {
    assert.equal(splitNearTwinSummary({ near_twin: {}, dev_near_twin: null }), null);
    assert.match(splitNextHint({ near_twin: {} }), /^forge_status — you now have a dev set/);
  });
});

describe('one step order: forge_init and forge_status render forge\'s own (Round 11)', () => {
  it('stepOrderText lists each step\'s tool in forge\'s order', () => {
    inOrder(stepOrderText(ORDER), ['forge_register_eval', 'forge_leak_audit', 'forge_prereg',
      'run_benchmark', 'forge_split', 'forge_preflight']);
  });

  it('forge_init\'s next step gives that order — never "the split" first', () => {
    const next = initNextHint({ project: '/p', order: ORDER });
    assert.match(next, /project_dir: "\/p"/);
    inOrder(next, ['forge_register_eval', 'forge_leak_audit', 'forge_prereg', 'run_benchmark', 'forge_split']);
    assert.doesNotMatch(next, /names the split/);
  });

  it('forge_status in state initialized gives the same order', () => {
    const next = initializedStatusHint({ advice: { state: 'initialized', order: ORDER } });
    inOrder(next, ['forge_register_eval', 'forge_leak_audit', 'forge_prereg', 'run_benchmark', 'forge_split']);
    assert.match(next, /Never call forge_discover \/ forge_init again/);
  });

  it('an nmt-forge without the order in its JSON gets NEXT_STEPS.md named, not a copy of the order', () => {
    assert.match(stepOrderText(undefined), /NEXT_STEPS\.md step 2/);
  });

  it('the real nmt-forge: init and status carry the order the hints render', async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-r11-'));
    try {
      const probe = await forgeTool(['status'], { projectDir: dir });
      if (probe.isError) { t.skip('forge CLI not launchable in this environment'); return; }
      const init = await forgeTool(['init', 'qaa', '--no-card', '--name', 'Toylang', '--dir', join(dir, 'p')],
        { projectDir: dir });
      assert.notEqual(init.isError, true, init.content[0].text);
      const r = JSON.parse(init.content[0].text).result;
      // Round 13 (forge): reading the training guardrails is a step of its
      // own, after the baselines and before the split; the hints render it
      // with its tool like every other step.
      assert.deepEqual(r.order.map((s) => s.step), ['register', 'leak-audit', 'prereg', 'baseline', 'guardrails', 'split', 'train']);
      inOrder(initNextHint(r), ['forge_register_eval', 'forge_leak_audit', 'forge_prereg', 'run_benchmark',
        'get_training_guardrails', 'forge_split']);
      const status = await forgeTool(['status'], { projectDir: join(dir, 'p') });
      const s = JSON.parse(status.content[0].text).result;
      assert.equal(s.advice.state, 'initialized');
      assert.deepEqual(s.advice.order, r.order);
      assert.equal(initializedStatusHint(s), initializedStatusHint({ advice: { order: r.order } }));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
