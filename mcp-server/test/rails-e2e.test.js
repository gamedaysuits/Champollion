/**
 * The rails, walked end to end by a scripted person — no LLM. The "agent"
 * dispatches only on step.mode through the MCP rails profile, driving THIS
 * checkout's champollion CLI and nmt-forge (with the harness), from an empty
 * folder to an evaluated model:
 *
 *   gather (3 files + a word list) → terms asked → test set protected →
 *   workshop → test registered → files combined → leak screen → prediction
 *   → dev split → dictionary floor → train (detached, bounded) → export →
 *   the people judge their prediction → the honest last step.
 *
 * One off-rails edit, as a person might make: the model is the dummy test
 * double (no torch). Every stall a small agent would hit is a test failure
 * here — this walk found three on its first run (a refused export retried
 * forever, a `#` comment read as a quote, a command-less forge state shown
 * as an auto step). The walk itself is test/helpers/scripted-person.mjs —
 * the same one the site's recording is made from. ~1 minute.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pythonReady, walkTheRails } from './helpers/scripted-person.mjs';

const skip = pythonReady();

describe('the rails, end to end', { skip: skip || false }, () => {
  it('a scripted person reaches an evaluated model, every step taken by its mode', async () => {
    const { seen, last, events } = await walkTheRails();
    const tags = seen.map((t) => t.split('/')[0]);
    for (const t of ['add-pairs', 'terms', 'test-file', 'workshop', 'register-test', 'one-corpus', 'screen',
      'predict', 'split', 'floor', 'forge-ready-to-train', 'forge-ready-to-score', 'judge']) {
      assert.ok(tags.includes(t), `the walk never reached ${t}: ${seen.join(' → ')}`);
    }
    assert.ok(seen.includes('predict/ask_user') && seen.includes('judge/ask_user'), 'the people predict and judge');
    assert.ok(seen.includes('forge-ready-to-train/confirm'), 'training is the person\'s yes');
    assert.equal(last.step.id.split(':')[0], 'forge-evaluated-no-model');
    assert.match(last.step.say, /no model to serve/);
    // the floor is measured and the run is compared with it
    assert.ok((last.warnings || []).some((w) => /dictionary floor/.test(w)), JSON.stringify(last.warnings));
    // nothing a tool returned holds a sentence the agent would read
    for (const e of events.filter((x) => x.type === 'tool')) {
      assert.ok(!JSON.stringify(e.result).includes('sees the'), `${e.name} returned a sentence`);
    }
  });

  it('the plan\'s own case — English to Plains Cree, named as a family would — takes the same path', async () => {
    // a real card (its resources shape the rails); the sentences stay invented
    const { seen, last } = await walkTheRails({ to: 'Plains Cree', toName: 'Plains Cree', maxSteps: 60 });
    assert.equal(last.step.id.split(':')[0], 'forge-evaluated-no-model', seen.join(' → '));
    assert.ok((last.warnings || []).some((w) => /^run crk-nmt-cpu-tiny: .*dictionary floor/.test(w)),
      JSON.stringify(last.warnings));
  });
});
