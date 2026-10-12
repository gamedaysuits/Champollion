/**
 * The server's real surface, over a real MCP client (in-memory transport):
 * the tool list is enumerated from the running server, and the docs an agent
 * or user reads (README.md, instructions.md) must describe exactly that
 * surface. 0.1.x shipped docs saying "24 tools" while the code said
 * otherwise; this is the gate that keeps them honest.
 *
 * Only local, offline tools are CALLED here; the network-touching ones are
 * exercised end to end by the opt-in contract suite (npm run test:contract).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const README = readFileSync(resolve(__dirname, '../README.md'), 'utf-8');
const INSTRUCTIONS = readFileSync(resolve(__dirname, '../instructions.md'), 'utf-8');
// The public docs page for this server (champollion.dev); absent outside the monorepo.
const PUBLIC_PAGE = resolve(__dirname, '../../cli/website/docs/network/getting-started/mcp-server.md');

let client;
let tools;
let STATE;

before(async () => {
  // The job history and the translate TM live under CHAMPOLLION_MCP_HOME —
  // a temp dir here, so a developer's real ~/.champollion-mcp never leaks in.
  STATE = mkdtempSync(join(tmpdir(), 'mcp-surface-'));
  process.env.CHAMPOLLION_MCP_HOME = STATE;
  const server = await createServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  client = new Client({ name: 'surface-test', version: '0.0.0' });
  await client.connect(clientT);
  tools = (await client.listTools()).tools;
});

after(async () => {
  await client?.close();
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(STATE, { recursive: true, force: true });
});

describe('server surface', () => {
  it('serves the north-star tools', () => {
    const names = tools.map((t) => t.name);
    for (const n of ['search_languages', 'get_language', 'language_overview', 'list_contests',
      'get_contest', 'run_benchmark', 'get_run_status', 'forge_status', 'translate']) {
      assert.ok(names.includes(n), `missing tool ${n}`);
    }
  });

  it('README lists every tool in its tables, and no tool that does not exist', () => {
    const names = new Set(tools.map((t) => t.name));
    const documented = new Set([...README.matchAll(/^\|\s*`([a-z_]+)`\s*\|/gm)].map((m) => m[1]));
    for (const n of names) assert.ok(documented.has(n), `README tool tables lack ${n}`);
    for (const d of documented) {
      // Resource/prompt tables use the same row shape; only flag tool-looking rows.
      if (/^(list_|get_|search_|run_|estimate_|forge_|translate|language_)/.test(d)) {
        assert.ok(names.has(d), `README documents a tool the server does not serve: ${d}`);
      }
    }
  });

  it('every stated tool COUNT in the docs matches the server', () => {
    // The public page too (it said "33 tools" when preview_publish made 34 —
    // Round 13); absent outside the monorepo.
    const pub = existsSync(PUBLIC_PAGE) ? [['the public MCP page', readFileSync(PUBLIC_PAGE, 'utf-8')]] : [];
    for (const [label, text] of [['README.md', README], ['instructions.md', INSTRUCTIONS], ...pub]) {
      for (const m of text.matchAll(/\b(\d+)\s+tools\b/g)) {
        assert.equal(Number(m[1]), tools.length, `${label} says "${m[0]}" but the server has ${tools.length}`);
      }
    }
  });

  it('instructions.md (the agent guide) mentions every tool', () => {
    for (const t of tools) assert.ok(INSTRUCTIONS.includes(t.name), `instructions.md never mentions ${t.name}`);
  });

  // The docs show each tool's ARGUMENTS, and these gates keep them equal to
  // the schemas the server registers: a persona read "language" off one tool
  // and passed it to get_metric_reliability, which only knew `target`.
  it('README\'s tool row lists every argument the tool takes', () => {
    for (const t of tools) {
      const row = README.split('\n').find((l) => l.startsWith(`| \`${t.name}\` |`));
      assert.ok(row, `README has no table row for ${t.name}`);
      for (const arg of Object.keys(t.inputSchema.properties ?? {})) {
        assert.ok(row.includes(`\`${arg}\``) || row.includes(`\`${arg}?\``),
          `README row for ${t.name} does not show its argument \`${arg}\``);
      }
    }
  });

  it('instructions.md\'s argument list shows every argument of every tool', () => {
    for (const t of tools) {
      const line = INSTRUCTIONS.split('\n').find((l) => new RegExp(`^${t.name}\\s+\\{`).test(l));
      assert.ok(line, `instructions.md has no "${t.name} { … }" argument line`);
      for (const arg of Object.keys(t.inputSchema.properties ?? {})) {
        assert.match(line, new RegExp(`[{ |,]${arg}\\??[ ,|}]`), `instructions.md: ${t.name} does not show \`${arg}\``);
      }
    }
  });

  it('the public MCP docs page lists every tool with every argument', (t) => {
    if (!existsSync(PUBLIC_PAGE)) { t.skip('public docs not in this tree'); return; }
    const page = readFileSync(PUBLIC_PAGE, 'utf-8');
    const start = page.indexOf('\n### Arguments\n');
    assert.ok(start >= 0, 'the public MCP page has no "### Arguments" section');
    const next = page.indexOf('\n#', start + 1);
    const section = page.slice(start, next < 0 ? undefined : next);
    for (const tool of tools) {
      const row = section.split('\n').find((l) => l.startsWith(`| \`${tool.name}\` |`));
      assert.ok(row, `the public MCP page has no argument row for ${tool.name}`);
      for (const arg of Object.keys(tool.inputSchema.properties ?? {})) {
        assert.ok(row.includes(`\`${arg}\``) || row.includes(`\`${arg}?\``),
          `public MCP page: ${tool.name} does not show \`${arg}\``);
      }
    }
  });

  it('every tool that takes ONE language accepts `language`, beside its original name', () => {
    const own = {
      search_languages: 'query', get_language: 'code', language_overview: 'code',
      get_metric_reliability: 'target', forge_discover: 'code', forge_init: 'code',
    };
    for (const [name, primary] of Object.entries(own)) {
      const props = tools.find((t) => t.name === name).inputSchema.properties;
      assert.ok(props.language, `${name} does not accept \`language\``);
      assert.ok(props[primary], `${name} lost \`${primary}\` — existing callers would break`);
    }
    for (const name of ['list_queue', 'estimate_cost', 'list_contests']) {
      assert.ok(tools.find((t) => t.name === name).inputSchema.properties.language, `${name} lost \`language\``);
    }
  });

  it('get_metric_reliability {"language": "crk"} answers (it was MCP error -32602)', async () => {
    const viaLanguage = await client.callTool({ name: 'get_metric_reliability', arguments: { language: 'crk' } });
    const text = viaLanguage.content[0].text;
    assert.notEqual(viaLanguage.isError, true, text);
    assert.doesNotMatch(text, /-32602|Input validation error/);
    assert.match(text, /crk/);
    const viaTarget = await client.callTool({ name: 'get_metric_reliability', arguments: { target: 'crk' } });
    assert.equal(viaTarget.content[0].text, text, '`target` still works, with the same answer');
  });

  it('a missing language, or two different ones, is a tool error naming both arguments', async () => {
    const none = await client.callTool({ name: 'get_metric_reliability', arguments: {} });
    assert.equal(none.isError, true);
    assert.match(none.content[0].text, /needs a language: pass `language` \(or `target`/);
    const both = await client.callTool({ name: 'get_metric_reliability', arguments: { target: 'iu', language: 'crk' } });
    assert.equal(both.isError, true);
    assert.match(both.content[0].text, /`target` \("iu"\) and `language` \("crk"\)/);
    const same = await client.callTool({ name: 'get_metric_reliability', arguments: { target: 'crk', language: 'CRK' } });
    assert.notEqual(same.isError, true, 'the same language under both names is not a conflict');
  });

  it('search_languages and get_language accept `language` too', async () => {
    const s = await client.callTool({ name: 'search_languages', arguments: { language: 'Atya' } });
    assert.notEqual(s.isError, true);
    assert.match(s.content[0].text, /Ayta/);
    const g = await client.callTool({ name: 'get_language', arguments: { language: 'crk' } });
    assert.notEqual(g.isError, true, g.content[0].text);
    assert.match(g.content[0].text, /Plains Cree/);
  });

  it('descriptions are present and crisp', () => {
    for (const t of tools) {
      assert.ok(t.description && t.description.length > 40, `${t.name} has no real description`);
      assert.ok(t.description.length <= 1100, `${t.name} description is ${t.description.length} chars — trim it`);
    }
  });

  it('run_benchmark defaults to NOT publishing, in the schema the agent sees', () => {
    const rb = tools.find((t) => t.name === 'run_benchmark');
    assert.equal(rb.inputSchema.properties.publish.default, false);
    assert.ok(rb.inputSchema.properties.provider.enum.includes('local'));
    assert.ok(rb.inputSchema.properties.corpus);
  });

  it('search_languages answers "Atya" with the Ayta languages (over the protocol)', async () => {
    const res = await client.callTool({ name: 'search_languages', arguments: { query: 'Atya' } });
    const text = res.content[0].text;
    assert.notEqual(res.isError, true);
    assert.match(text, /No exact match for "Atya" — closest names/);
    assert.match(text, /Ayta/);
    // The six Ayta languages tie; each must say where it is spoken.
    for (const code of ['abc', 'abp', 'ays', 'ayt', 'blx', 'sgb']) {
      assert.match(text, new RegExp(`^${code}  .*\\n {5}where: Philippines \\(PH\\), \\d+\\.\\d{2}°N \\d+\\.\\d{2}°E \\[`, 'm'),
        `${code} carries no location line`);
    }
    assert.match(text, /6 names are equally close/);
  });

  it('translate can target a deployed model, in the schema the agent sees', () => {
    const tr = tools.find((t) => t.name === 'translate');
    for (const arg of ['base_url', 'endpoint', 'project_dir']) {
      assert.ok(tr.inputSchema.properties[arg], `translate lacks ${arg}`);
    }
    assert.ok(tr.inputSchema.properties.method.enum.includes('api'));
    assert.ok(tr.inputSchema.properties.method.enum.includes('local'));
    // No schema default: with project_dir the tool must see "no method given"
    // and run the project's own (a default of "llm" made that impossible).
    assert.equal(tr.inputSchema.properties.method.default, undefined);
    assert.ok(!(tr.inputSchema.required || []).includes('method'));
    assert.equal(tr.inputSchema.additionalProperties, false,
      'unknown arguments must be refused, not stripped');
  });

  it('an argument translate does not know is REFUSED by name, not silently dropped', async () => {
    // The 0.2.0 bug: { endpoint } before the tool had one — stripped, and the
    // call ran on a different local model.
    const res = await client.callTool({
      name: 'translate',
      arguments: { texts: ['hello'], source_language: 'en', target_language: 'crk', method: 'local', model_url: 'http://127.0.0.1:8378/v1' },
    });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /model_url/);
  });

  it('run_benchmark refuses an unknown argument too (it spends)', async () => {
    const rb = tools.find((t) => t.name === 'run_benchmark');
    assert.equal(rb.inputSchema.additionalProperties, false);
    const res = await client.callTool({
      name: 'run_benchmark',
      arguments: { corpus: 'eval-x', provider: 'local', model: 'llama3.1', endpoint: 'http://127.0.0.1:8378/v1', dry_run: true },
    });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /endpoint/);
  });

  it('get_run_status with no jobs is a friendly empty answer', async () => {
    const res = await client.callTool({ name: 'get_run_status', arguments: {} });
    assert.match(res.content[0].text, /No benchmark jobs/);
  });

  it('prompts include the north-star starter', async () => {
    const { prompts } = await client.listPrompts();
    assert.ok(prompts.some((p) => p.name === 'start_language_project'));
  });
});
