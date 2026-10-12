/**
 * publish_report (Round 7): an MCP-only agent can publish an EXISTING report,
 * scores-only if the user wants — behind the same preview + exact
 * acknowledgement as run_benchmark's publish gate (Round 6):
 *   - every call first runs the harness's own `mt-eval publish <report>
 *     --dry-run` and reads WHAT GETS PUBLISHED from it;
 *   - without confirm, that preview (and the exact publish_ack) is the answer;
 *   - only confirm + the exact publish_ack publishes (--yes, --prod for prod);
 *   - a preview the tool cannot read, or a target the harness and this server
 *     disagree on, is a refusal — never a guess.
 *
 * The harness is a stub here (runBounded's contract); the seam tests below
 * pin the flags and the preview wording against the real arena source.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import { publishReport, previewLines, reportPublishFacts } from '../src/tools/publish-report.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ARENA_DIR = resolve(__dirname, '../../arena');

/** What `mt-eval publish <report> --dry-run` prints, in the harness's own words. */
function dryRunOutput({ text = true, prompt = 'published', target = 'PRODUCTION', entries = 50 } = {}) {
  return [
    '============================================================',
    'MT Eval Harness — Publish to Leaderboard',
    '============================================================',
    '',
    '  Submitter:     the account `mt-eval` is signed in to (none checked in a dry run; --anonymous publishes without one)',
    '  Trust:         unverified — listed as self-benchmarked (you ran and scored it; \'verified\' comes only from a reference holder\'s re-scoring or a contest node)',
    '  Score lane:    relative-comparison-only (ungraded contamination — ranks methods against each other on THIS corpus, never as absolute quality; only a corpus graded LOW earns the absolute lane)',
    '  Model:         qwen2.5:7b',
    '  Dataset:       eval-eng-crk-school-v1 (50 entries)',
    '  License:       CC-BY-NC-4.0',
    ...(entries ? [text
      ? `  Entries:       ${entries} rows WITH their source + reference text will be uploaded to the public run_card_entries table (redistribution-cleared (permissive license, open segment))`
      : `  Entries:       ${entries} — sentence text WITHHELD, scores only (owner chose --scores-only)`] : []),
    ...(prompt === 'published' ? ['  Prompt:        the system/coaching prompt (1,204 characters) IS published with the card, also in scores-only mode — pass --redact-coaching to publish only its sha256'] : []),
    ...(prompt === 'redacted' ? ['  Prompt:        REDACTED on the card — only its sha256 is published (--redact-coaching)'] : []),
    '  chrF++:        41.2  (corpus-level)',
    '',
    '  --- DRY RUN: run-card payload (NOT published) ---',
    '{',
    '  "system_prompt_used": "You are a translator…",',
    '  "chrf_plus_plus": 41.2',
    '}',
    '',
    `  DRY RUN complete — nothing was written. Target would be: ${target === 'PRODUCTION' ? 'PRODUCTION' : 'non-prod (staging)'}.`,
    '  Re-run without --dry-run (and with --prod / MT_EVAL_ALLOW_PROD for prod) to publish.',
  ].join('\n');
}

let DIR;
let REPORT;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'mcp-publish-report-'));
  REPORT = join(DIR, 'run_20261004_x_report.json');
  writeFileSync(REPORT, JSON.stringify({ run_id: 'run_20261004_x', entries: new Array(50).fill({ id: 'e' }), overall: {} }));
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state');
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(DIR, { recursive: true, force: true });
});

/** A stub harness: the dry run answers `preview`, the real publish `publish`. */
function harness({ preview = dryRunOutput(), publish = { code: 0, stdout: '  ✓ Published: run card 1f2e…', stderr: '' }, env = {} } = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      isMtEvalInstalled: async () => true,
      env,
      run: async (cmd, args) => {
        calls.push({ cmd, args });
        if (args.includes('--dry-run')) return typeof preview === 'object' ? preview : { code: 0, stdout: preview, stderr: '' };
        return publish;
      },
    },
  };
}

describe('publish_report: the preview', () => {
  it('runs the harness\'s own dry run and answers with WHAT GETS PUBLISHED and the exact words — nothing written', async () => {
    const h = harness();
    const r = await publishReport({ report: REPORT }, h.deps);
    assert.equal(r.isError, false, r.text);
    assert.deepEqual(h.calls.map((c) => c.args), [['publish', REPORT, '--dry-run']]);
    assert.match(r.text, /^PUBLISH PREVIEW — nothing was published\./);
    assert.match(r.text, /Target:  PRODUCTION — the public champollion\.dev leaderboard/);
    assert.match(r.text, /Entries:\s+50 rows WITH their source \+ reference text/);
    assert.match(r.text, /EVERY row WITH its source, reference and model output text goes to the PUBLIC run_card_entries table/);
    assert.match(r.text, /system\/coaching prompt's FULL TEXT is published/);
    assert.match(r.text, /publish_ack: "publish to production: sentence text, prompt published"/);
    assert.doesNotMatch(r.text, /system_prompt_used/, 'the run-card JSON payload is not relayed');
  });

  it('scores_only / redact_coaching reach the harness and change what it says goes public', async () => {
    const h = harness({ preview: dryRunOutput({ text: false, prompt: 'redacted' }) });
    const r = await publishReport({ report: REPORT, scores_only: true, redact_coaching: true }, h.deps);
    assert.deepEqual(h.calls[0].args, ['publish', REPORT, '--scores-only', '--redact-coaching', '--dry-run']);
    assert.match(r.text, /sentence text is WITHHELD — scores only \(owner chose --scores-only\)/);
    assert.match(r.text, /prompt is REDACTED on the card/);
    assert.match(r.text, /publish_ack: "publish to production: scores only, prompt redacted"/);
  });

  it('a report with no rows and no prompt: "scores only, no prompt"', () => {
    const f = reportPublishFacts({ output: dryRunOutput({ entries: 0, prompt: 'none' }), entries: 0,
      target: { prod: true, label: 'PRODUCTION' } });
    assert.equal(f.ack, 'publish to production: scores only, no prompt');
  });

  it('drops the run-card JSON from the harness\'s preview, keeps the lines around it', () => {
    const lines = previewLines(dryRunOutput());
    assert.ok(lines.some((l) => l.includes('Entries:')));
    assert.ok(lines.some((l) => l.includes('Target would be: PRODUCTION')));
    assert.ok(!lines.some((l) => l.includes('"chrf_plus_plus"')));
  });
});

describe('publish_report: the gate', () => {
  it('confirm without publish_ack, or with other words, is REFUSED — nothing published', async () => {
    for (const ack of [undefined, 'publish to production: scores only, prompt published', 'yes']) {
      const h = harness();
      const r = await publishReport({ report: REPORT, confirm: true, publish_ack: ack }, h.deps);
      assert.equal(r.isError, true);
      assert.match(r.text, /^REFUSED — /);
      assert.match(r.text, /publish_ack: "publish to production: sentence text, prompt published"/);
      assert.equal(h.calls.length, 1, 'only the dry run ran');
    }
  });

  it('confirm + the exact words publishes: --yes, --prod for production, the user\'s flags', async () => {
    const h = harness({ preview: dryRunOutput({ text: false }) });
    const r = await publishReport({ report: REPORT, scores_only: true, anonymous: true, confirm: true,
      publish_ack: 'publish to production: scores only, prompt published' }, h.deps);
    assert.equal(r.isError, false, r.text);
    assert.deepEqual(h.calls[0].args, ['publish', REPORT, '--scores-only', '--anonymous', '--dry-run'],
      'the dry run carries --anonymous, so the harness preview names the identity');
    assert.deepEqual(h.calls[1].args, ['publish', REPORT, '--scores-only', '--yes', '--prod', '--anonymous']);
    assert.match(r.text, /^PUBLISHED to PRODUCTION .*\(scores only, prompt published\)/);
    assert.match(r.text, /✓ Published/);
    assert.match(r.text, /get_results/);
  });

  it('a non-production target: no --prod, and the words say non-production', async () => {
    const env = { MT_EVAL_SUPABASE_URL: 'https://staging-branch.supabase.co' };
    const h = harness({ preview: dryRunOutput({ target: 'non-prod' }), env });
    const plan = await publishReport({ report: REPORT }, h.deps);
    assert.match(plan.text, /publish_ack: "publish to non-production: sentence text, prompt published"/);
    const r = await publishReport({ report: REPORT, confirm: true,
      publish_ack: 'publish to non-production: sentence text, prompt published' }, h.deps);
    assert.equal(r.isError, false, r.text);
    assert.ok(!h.calls.at(-1).args.includes('--prod'));
  });

  it('the harness and this server disagreeing about the target is a refusal', async () => {
    const h = harness({ preview: dryRunOutput({ target: 'non-prod' }) }); // env says production
    const r = await publishReport({ report: REPORT }, h.deps);
    assert.equal(r.isError, true);
    assert.match(r.text, /^REFUSED — what this report would publish could not be read .*names a non-production project but this server would publish to PRODUCTION/s);
  });

  it('a preview it cannot read is a refusal, never a guess', async () => {
    let h = harness({ preview: dryRunOutput().replace(/Entries:.*$/m, 'Entries:       50 rows (some new wording)') });
    let r = await publishReport({ report: REPORT }, h.deps);
    assert.equal(r.isError, true);
    assert.match(r.text, /"Entries:" line is not one this tool knows/);
    h = harness({ preview: dryRunOutput().replace(/^.*Entries:.*\n/m, '') });
    r = await publishReport({ report: REPORT }, h.deps);
    assert.match(r.text, /does not say what happens to the report's 50 sentence rows/);
  });

  it('a failed dry run, a failed or stopped publish, a missing report, no harness — each says so', async () => {
    let r = await publishReport({ report: REPORT }, harness({ preview: { code: 1, stdout: '', stderr: 'FileNotFoundError: run log missing' } }).deps);
    assert.match(r.text, /^PUBLISH PREVIEW FAILED — the harness's dry run did not complete \(it exited 1\)/);
    assert.match(r.text, /run log missing/);
    const ok = { report: REPORT, confirm: true, publish_ack: 'publish to production: sentence text, prompt published' };
    r = await publishReport(ok, harness({ publish: { code: 1, stdout: '', stderr: 'Authentication required, but this is a non-interactive shell' } }).deps);
    assert.equal(r.isError, true);
    assert.match(r.text, /^PUBLISH FAILED \(exit 1\)/);
    assert.match(r.text, /Authentication required/);
    r = await publishReport(ok, harness({ publish: { code: null, stdout: '', stderr: '', timedOut: true } }).deps);
    assert.match(r.text, /^PUBLISH DID NOT FINISH within 50s/);
    r = await publishReport({ report: join(DIR, 'nope_report.json') }, harness().deps);
    assert.match(r.text, /^Cannot publish: report not found/);
    const notJson = join(DIR, 'broken_report.json');
    writeFileSync(notJson, '{oops');
    r = await publishReport({ report: notJson }, harness().deps);
    assert.match(r.text, /^Cannot publish: report is not valid JSON/);
    r = await publishReport({ report: REPORT }, { ...harness().deps, isMtEvalInstalled: async () => false });
    assert.match(r.text, /mt-eval is not installed/);
  });
});

describe('publish_report over the protocol', () => {
  let client;
  before(async () => {
    const server = await createServer();
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await server.connect(serverT);
    client = new Client({ name: 'publish-report-test', version: '0.0.0' });
    await client.connect(clientT);
  });
  after(async () => { await client?.close(); });

  it('is served with a strict schema: a misspelled flag is refused by name, never stripped', async () => {
    const { tools } = await client.listTools();
    const t = tools.find((x) => x.name === 'publish_report');
    assert.ok(t, 'publish_report is served');
    assert.equal(t.inputSchema.additionalProperties, false);
    assert.equal(t.inputSchema.properties.confirm.default, false);
    assert.equal(t.inputSchema.properties.scores_only.default, false);
    const res = await client.callTool({ name: 'publish_report', arguments: { report: REPORT, scoresonly: true } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /scoresonly/);
  });
});

describe('publish_report ↔ the real harness (seam)', () => {
  const PUBLISH_PY = join(ARENA_DIR, 'mt_eval_harness', 'publish.py');

  it('the preview wording this tool reads is the wording publish.py prints', (t) => {
    if (!existsSync(PUBLISH_PY)) { t.skip('arena is not in this tree'); return; }
    const src = readFileSync(PUBLISH_PY, 'utf-8');
    for (const s of ['Entries:', 'rows WITH their source + reference text', 'sentence text WITHHELD, scores only',
      'Prompt:', 'REDACTED on the card', 'IS published with the card', 'Target would be:', '--- DRY RUN: run-card payload',
      'Trust:', 'self-benchmarked', 'Score lane:']) {
      assert.ok(src.includes(s), `publish.py no longer prints "${s}" — publish_report would refuse every preview`);
    }
  });

  it('the argv it spawns parses with the real `mt-eval publish` parser', (t) => {
    let ok = false;
    try {
      execFileSync('python3', ['-c', 'import mt_eval_harness.cli'], { cwd: ARENA_DIR, timeout: 30_000, stdio: 'ignore' });
      ok = true;
    } catch { /* not importable */ }
    if (!ok) { t.skip('arena (mt_eval_harness) not importable here'); return; }
    const py = [
      'import sys, json',
      'from mt_eval_harness.cli import build_parser',
      'ns = build_parser().parse_args(json.loads(sys.argv[1]))',
      'print(json.dumps({"command": ns.command, "scores_only": ns.scores_only, "redact": ns.redact_coaching,',
      '                  "dry_run": ns.dry_run, "prod": ns.yes_prod, "yes": ns.yes, "anonymous": ns.anonymous}))',
    ].join('\n');
    const parse = (argv) => JSON.parse(execFileSync('python3', ['-c', py, JSON.stringify(argv)],
      { cwd: ARENA_DIR, encoding: 'utf-8', timeout: 30_000 }).trim().split('\n').pop());
    assert.deepEqual(parse(['publish', REPORT, '--scores-only', '--redact-coaching', '--dry-run']),
      { command: 'publish', scores_only: true, redact: true, dry_run: true, prod: false, yes: false, anonymous: false });
    assert.deepEqual(parse(['publish', REPORT, '--scores-only', '--yes', '--prod', '--anonymous']),
      { command: 'publish', scores_only: true, redact: false, dry_run: false, prod: true, yes: true, anonymous: true });
  });
});

describe('publish_report: trust tier and score lane (Round 8)', () => {
  it('the preview facts relay how the board lists the row', () => {
    const facts = reportPublishFacts({ output: dryRunOutput(), entries: 50, target: { prod: true, label: 'PRODUCTION' } });
    assert.equal(facts.ok, true, facts.error);
    assert.ok(facts.lines.some((l) => /listed with trust unverified — listed as self-benchmarked/.test(l)), facts.lines.join('\n'));
    assert.ok(facts.lines.some((l) => /score lane: relative-comparison-only/.test(l)), facts.lines.join('\n'));
  });

  it('an older harness that does not print them is still readable (no refusal)', () => {
    const old = dryRunOutput().split('\n').filter((l) => !/^\s*(Trust|Score lane):/.test(l)).join('\n');
    const facts = reportPublishFacts({ output: old, entries: 50, target: { prod: true, label: 'PRODUCTION' } });
    assert.equal(facts.ok, true);
    assert.ok(!facts.lines.some((l) => /trust|score lane/.test(l)));
  });
});
