/**
 * Round 13 (synthetic researcher, 2026-10-04) — item 2: the publish preview
 * shared a tool with the real publish, so an agent host that asks before
 * every production write blocked the PREVIEW too ("refused as a production
 * deploy") and the user never saw WHAT GETS PUBLISHED.
 *
 * preview_publish is the read-only half: it runs only the harness's dry run,
 * has no confirm or publish_ack (the strict schema refuses them by name), is
 * annotated readOnlyHint, and ends with the exact publish_report call that
 * would publish what it showed. publish_report is annotated as the write.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import { dryRunArgv, previewReport, publishCall, publishReport } from '../src/tools/publish-report.js';

/** What `mt-eval publish <report> --dry-run` prints (the harness's words). */
function dryRun({ text = true } = {}) {
  return [
    '  Model:         qwen2.5:7b',
    text
      ? '  Entries:       50 rows WITH their source + reference text will be uploaded to the public run_card_entries table (redistribution-cleared)'
      : '  Entries:       50 — sentence text WITHHELD, scores only (owner chose --scores-only)',
    '  Prompt:        the system/coaching prompt (1,204 characters) IS published with the card',
    '  --- DRY RUN: run-card payload (NOT published) ---',
    '{',
    '  "chrf_plus_plus": 41.2',
    '}',
    '  DRY RUN complete — nothing was written. Target would be: PRODUCTION.',
  ].join('\n');
}

let DIR;
let REPORT;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'mcp-r13-preview-'));
  REPORT = join(DIR, 'run_20261004_y_report.json');
  writeFileSync(REPORT, JSON.stringify({ entries: new Array(50).fill({ id: 'e' }), overall: {} }));
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state');
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(DIR, { recursive: true, force: true });
});

/** A stub harness that records every argv it is handed. */
function harness(preview = dryRun()) {
  const calls = [];
  return {
    calls,
    deps: {
      isMtEvalInstalled: async () => true,
      env: {},
      run: async (cmd, args) => {
        calls.push(args);
        if (args.includes('--dry-run')) return { code: 0, stdout: preview, stderr: '' };
        return { code: 0, stdout: '  ✓ Published', stderr: '' };
      },
    },
  };
}

describe('preview_publish: read-only by construction', () => {
  it('runs only the harness\'s dry run, whatever it is passed — never --yes, never --prod', async () => {
    for (const params of [
      { report: REPORT },
      { report: REPORT, scores_only: true, redact_coaching: true, anonymous: true },
      // what a caller might try: the function ignores them (the tool's schema refuses them by name)
      { report: REPORT, confirm: true, publish_ack: 'publish to production: sentence text, prompt published' },
    ]) {
      const h = harness();
      const r = await previewReport(params, h.deps);
      assert.equal(r.isError, false, r.text);
      assert.equal(h.calls.length, 1, 'exactly one harness call');
      assert.equal(h.calls[0].at(-1), '--dry-run');
      assert.ok(!h.calls[0].includes('--yes') && !h.calls[0].includes('--prod'), h.calls[0].join(' '));
      assert.match(r.text, /^PUBLISH PREVIEW \(read-only\) — nothing was published; this tool cannot publish\./);
    }
  });

  it('says what goes public and ends with the exact publish_report call (same flags + the exact ack)', async () => {
    const h = harness(dryRun({ text: false }));
    const r = await previewReport({ report: REPORT, scores_only: true }, h.deps);
    assert.match(r.text, /WHAT GETS PUBLISHED/);
    assert.match(r.text, /sentence text is WITHHELD — scores only/);
    assert.match(r.text, /the next call is publish_report, which WRITES to PRODUCTION/);
    const line = r.text.split('\n').find((l) => l.trim().startsWith('publish_report {'));
    assert.ok(line, r.text);
    const args = JSON.parse(line.trim().replace(/^publish_report /, ''));
    assert.deepEqual(args, {
      report: REPORT, scores_only: true, confirm: true,
      publish_ack: 'publish to production: scores only, prompt published',
    });
    // and that call, made, publishes exactly what was previewed
    const h2 = harness(dryRun({ text: false }));
    const pub = await publishReport(args, h2.deps);
    assert.equal(pub.isError, false, pub.text);
    assert.match(pub.text, /^PUBLISHED to PRODUCTION/);
  });

  it('dryRunArgv always ends in --dry-run; publishCall is one JSON-shaped line', () => {
    assert.deepEqual(dryRunArgv('/r.json', { scoresOnly: true, redact: true, anonymous: true }),
      ['publish', '/r.json', '--scores-only', '--redact-coaching', '--anonymous', '--dry-run']);
    assert.equal(publishCall({ path: '/r.json', ack: 'publish to production: scores only, no prompt' }),
      'publish_report { "report": "/r.json", "confirm": true, "publish_ack": "publish to production: scores only, no prompt" }');
  });

  it('a missing report or no harness: an error naming the preview, nothing run', async () => {
    const h = harness();
    let r = await previewReport({ report: join(DIR, 'nope_report.json') }, h.deps);
    assert.equal(r.isError, true);
    assert.match(r.text, /^Cannot preview a publish: report not found/);
    r = await previewReport({ report: REPORT }, { ...h.deps, isMtEvalInstalled: async () => false });
    assert.match(r.text, /no harness to preview a publish with/);
    assert.equal(h.calls.length, 0);
  });

  it('publish_report without confirm still previews (older callers) and points at preview_publish', async () => {
    const h = harness();
    const r = await publishReport({ report: REPORT }, h.deps);
    assert.equal(r.isError, false);
    assert.match(r.text, /^PUBLISH PREVIEW — nothing was published\./);
    assert.match(r.text, /preview_publish gives this same preview from a read-only tool/);
    assert.equal(h.calls.length, 1);
  });
});

describe('preview_publish / publish_report over the protocol', () => {
  let client;
  let tools;
  before(async () => {
    const server = await createServer();
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await server.connect(serverT);
    client = new Client({ name: 'r13-preview-test', version: '0.0.0' });
    await client.connect(clientT);
    tools = (await client.listTools()).tools;
  });
  after(async () => { await client?.close(); });

  it('preview_publish is annotated read-only, publish_report as an open-world write', () => {
    const pv = tools.find((t) => t.name === 'preview_publish');
    assert.ok(pv, 'preview_publish is served');
    assert.equal(pv.annotations?.readOnlyHint, true);
    assert.equal(pv.annotations?.destructiveHint, false);
    assert.equal(pv.annotations?.openWorldHint, false);
    const pub = tools.find((t) => t.name === 'publish_report');
    assert.equal(pub.annotations?.readOnlyHint, false);
    assert.equal(pub.annotations?.destructiveHint, true);
    assert.equal(pub.annotations?.openWorldHint, true);
    // the descriptions say which one a cautious host can allow
    assert.match(pv.description, /READ-ONLY — cannot publish/);
    assert.match(pv.description, /a host can allow this tool on its own/);
    assert.match(pub.description, /WRITES to the public leaderboard/);
    assert.match(pub.description, /call preview_publish \(read-only/);
  });

  it('preview_publish has no confirm or publish_ack — passing one is refused by name, nothing runs', async () => {
    const pv = tools.find((t) => t.name === 'preview_publish');
    assert.equal(pv.inputSchema.additionalProperties, false);
    assert.deepEqual(Object.keys(pv.inputSchema.properties).sort(), ['anonymous', 'redact_coaching', 'report', 'scores_only']);
    for (const extra of [{ confirm: true }, { publish_ack: 'publish to production: sentence text, prompt published' }]) {
      const res = await client.callTool({ name: 'preview_publish', arguments: { report: REPORT, ...extra } });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, new RegExp(Object.keys(extra)[0]));
    }
  });
});
