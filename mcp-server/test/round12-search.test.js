/**
 * Round 12 synthetic personas (hospital qaa / "Atya", Cree school crk),
 * 2026-10-04 — search_languages, the register-corpus command, and the run
 * plan's coaching line.
 *
 *   7.  hospital: search_languages "Atya" in an npm install showed no location
 *       for any of the six Ayta candidates, while the docs promised one. The
 *       server read the bundled fallback (name-only entries) and filled the
 *       six in from champollion.dev's published card tables, whose rows were
 *       uploaded before they carried per-field sources: their locations cannot
 *       be cited, so they are withheld and each line links the language's
 *       Glottolog record (Round 11). Pinned here END TO END on the shape the
 *       npm install actually reads — the CLI's own card cache (~/.champollion/
 *       cards, `{v, code, updatedAt, fetchedAt, card}`) read by the CLI's own
 *       registry in packaged mode, offline — and the docs now say exactly
 *       that: a location only with its source, otherwise the Glottolog link,
 *       per-field sources arriving with the tables' next upload.
 *  11.  hospital: every recommended `champollion network register-corpus`
 *       command left out --role, so the test set was saved with "Role: not
 *       stated". The command registers the community's TEST set, and says so.
 *  12.  school: on a local-only corpus the run plan withholds a coaching
 *       file's first line (right) without saying why, and instructions.md said
 *       the plan shows it. The plan now gives the reason — a coaching file can
 *       be built from the corpus's own sentences — and the docs say the same.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import { registerLocalOnlyCommand, REGISTERED_ROLE } from '../src/tools/register-corpus-hint.js';
import { formatPrivateUseOverview } from '../src/tools/overview.js';
import { trainingGuardrails, formatTrainingGuardrails } from '../src/tools/training.js';
import { promptPlanLines, COACHING_LINE_WITHHELD } from '../src/tools/run-plan.js';
import { runBenchmark } from '../src/tools/harness.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MCP = path.resolve(__dirname, '..');
const REPO = path.resolve(MCP, '..');
const CLI = path.join(REPO, 'cli');
const CARDS = path.join(CLI, 'shared/language-cards');
const BUNDLE = path.join(CLI, 'shared/cards-fallback.json');
const IN_MONOREPO = existsSync(path.join(CLI, 'lib/cards/reader.js')) && existsSync(CARDS);

const read = (p) => readFileSync(p, 'utf-8');
/** A doc's prose with every run of whitespace folded to one space (lines wrap anywhere). */
const flat = (s) => s.replace(/\s+/g, ' ');
/** Docs outside mcp-server/ — present in the monorepo only. */
const DOC = {
  guide: path.join(CLI, 'website/docs/build-mt-for-your-language.md'),
  page: path.join(CLI, 'website/docs/network/getting-started/mcp-server.md'),
  forAgents: path.join(CLI, 'website/src/pages/for-agents.md'),
  llms: path.join(CLI, 'website/static/llms.txt'),
  registering: path.join(CLI, 'website/docs/network/sovereignty/registering-corpora.md'),
  forgeReadme: path.join(REPO, 'forge/README.md'),
  scaffold: path.join(REPO, 'forge/nmt_forge/scaffold.py'),
};
const INSTRUCTIONS = read(path.join(MCP, 'instructions.md'));
const README = read(path.join(MCP, 'README.md'));

const AYTA = ['abc', 'abp', 'ays', 'ayt', 'blx', 'sgb'];

/**
 * ayt exactly as the hospital persona's npm install cached it from
 * champollion.dev's published card tables (its ~/.champollion/cards/ayt.json
 * `card`, Round 12) — a row uploaded before the tables carried per-field
 * sources: a glottocode, countries, a point and a macroarea, and no
 * `_fieldSources`.
 */
const AYT_AS_CACHED = {
  code: 'ayt', name: 'Magbukun Ayta', nativeName: null, iso639_3: 'ayt', iso639_1: null, bcp47: 'ayt',
  glottocode: 'bata1297', isIsolate: false, macroarea: 'Papunesia', modality: 'spoken', isoType: 'L', isoScope: 'I',
  macrolanguage: null, script: 'Latn', scripts: [{ name: 'Latn', source: 'linguameta-452a21ad3dae' }], dir: 'ltr',
  dialectCount: null, culturalAphorism: null, registers: null, rules: null, gender: null,
  endangerment: {
    values: [
      { note: '[Endangerment.Certainty: 0.2]', value: 'endangered', source: 'elcat-v2024.1' },
      { note: 'Bataan Ayta (2845-ayt) = Endangered (40 percent certain, based on the evidence available) [Wurm 2007](cldf:wurm:07:1)',
        value: 'shifting', source: 'glottolog-cldf-v5.3' },
      { value: 'Definitely endangered', source: 'linguameta-452a21ad3dae' },
    ],
    agreement: 'incommensurable',
  },
  classification: {
    genus: null, family: 'Austronesian', ancestry: ['Austronesian', 'Malayo-Polynesian', 'Central Luzon', 'Sambalic'],
    familyGlottocode: 'aust1307', familyAttributions: [{ value: 'Austronesian', source: 'glottolog-v5.3' }],
    ancestryGlottocodes: ['aust1307', 'mala1545', 'cent2080', 'samb1319'],
  },
  vitality: {
    note: 'champollion-derived: one display tier read from a single cited assessment. The full set of assessments stays on `endangerment`.',
    assessedBy: 'elcat-v2024.1', unescoStatus: 'endangered',
  },
  speakerEstimates: [{ count: '100-999', source: 'elcat-v2024.1' }],
  linguisticChallenges: {}, contactInfluences: [], methodSupport: {},
  resources: { typology: [{ dataset: 'barlowhandandfive', featuresCoded: 4, datasetFeatureTotal: 7 }] },
  evalDatasets: [], pipelineReadiness: {}, digitalPresence: {}, corpusAvailability: {}, databaseCoverage: {},
  regions: [{ country: 'PH' }], countries: ['PH'], coordinates: { lat: 14.4153, lng: 120.49 },
  orthographicStatus: 'has-orthography',
  encyclopedic: {
    intro: 'Magbukun Ayta is a language of the Austronesian family, spoken in Philippines. The language is classified as endangered. It is written in the Latin script.',
    intro_sources: ['champollion-derived-v1', 'derived:elcat-v2024.1', 'glottolog-cldf-v5.3', 'glottolog-v5.3', 'linguameta-452a21ad3dae'],
    intro_provenance: 'machine-assembled',
  },
  experts: [], alternateNames: [],
  _remote: { source: 'supabase', updatedAt: '2026-09-27T09:08:54.145+00:00' },
};

/** The other five as the CLI's remote reader rebuilds a row of that upload (no per-field sources). */
async function publishedRowCard(code) {
  const reader = await import(pathToFileURL(path.join(CLI, 'lib/cards/reader.js')).href);
  const { buildCardFromRemote } = await import(pathToFileURL(path.join(CLI, 'lib/cards/remote.js')).href);
  const card = reader.normalizeCard(reader.readCard(code, { dir: CARDS }));
  const updated = '2026-09-27T09:08:54.144+00:00';
  const indexRow = {
    code, name: card.name, native_name: card.nativeName ?? null, glottocode: card.glottocode ?? null,
    macroarea: card.macroarea ?? null, is_isolate: card.isIsolate === true, script: card.script ?? null,
    dir: 'ltr', updated_at: updated,
  };
  const detail = {
    glottocode: indexRow.glottocode, classification: card.classification, speakerEstimates: card.speakerEstimates,
    countries: card.countries, regions: (card.countries ?? []).map((c) => ({ country: c })),
    coordinates: card.coordinates ?? null, alternateNames: Array.isArray(card.alternateNames) ? card.alternateNames : [],
    formality: null,
  };
  return buildCardFromRemote(indexRow, { code, detail, updated_at: updated });
}

/**
 * Search "Atya" the way the hospital persona's npm install did: a child
 * process in which the CLI is in packaged mode (no card directory), offline,
 * with a per-user card cache holding the six published rows — the MCP loads
 * the bundled fallback, and materializeLean fills the six in through the
 * CLI's own registry from that cache. Nothing touches a network.
 */
function searchLikeNpmInstall(cacheDir, home) {
  const child = `
    import { pathToFileURL } from 'node:url';
    const env = await import(pathToFileURL(process.env.R12_CLI + '/lib/cards/env.js').href);
    if (env.hasLocalCardsDir()) throw new Error('premise: the CLI must be in packaged mode');
    // The CLI pinned its card directory at import; the MCP's own loader must
    // not read the same override as "use this corpus".
    delete process.env.CHAMPOLLION_CARDS_DIR;
    const L = await import(pathToFileURL(process.env.R12_MCP + '/src/tools/languages.js').href);
    const index = await L.loadLanguageIndex({ repoDir: '/nonexistent/r12-repo-cards', fallbackFile: process.env.R12_BUNDLE });
    const found = L.findLanguages(index, 'Atya', 10);
    process.stdout.write(L.formatSearchAnswer(found, 'Atya', await L.materializeLean(found.results)));
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', child], {
    encoding: 'utf8', timeout: 120_000,
    env: {
      PATH: process.env.PATH, HOME: home,
      CHAMPOLLION_OFFLINE: '1',
      CHAMPOLLION_CARDS_DIR: '/nonexistent/r12-cards',
      CHAMPOLLION_CARDS_CACHE_DIR: cacheDir,
      // Belt and braces: even a code path that ignored OFFLINE reaches nothing.
      CHAMPOLLION_SUPABASE_URL: 'http://127.0.0.1:9',
      R12_CLI: CLI, R12_MCP: MCP, R12_BUNDLE: BUNDLE,
    },
  });
}

/** The result line for a code, and the indented line under it. */
function block(text, code) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${code}  `));
  return i < 0 ? null : { head: lines[i], detail: lines[i + 1]?.startsWith('     ') ? lines[i + 1].trim() : null };
}

// -- 7. "Atya" in an npm install ---------------------------------------------------

describe('7. search_languages "Atya" on the cards an npm install actually reads', () => {
  let text = '';
  let stderr = '';
  let tmp = null;
  const glottocodes = new Map();

  before(async () => {
    if (!IN_MONOREPO) return;
    tmp = mkdtempSync(path.join(tmpdir(), 'r12-npm-cards-'));
    const cacheDir = path.join(tmp, 'cards');
    mkdirSync(cacheDir, { recursive: true });
    for (const code of AYTA) {
      const card = code === 'ayt' ? AYT_AS_CACHED : await publishedRowCard(code);
      glottocodes.set(code, card.glottocode);
      // The CLI cache's own entry shape (lib/cards/cache.js writeCachedCard).
      writeFileSync(path.join(cacheDir, `${code}.json`), JSON.stringify({
        v: 1, code, updatedAt: card._remote?.updatedAt ?? null, fetchedAt: new Date().toISOString(), card,
      }));
    }
    const r = searchLikeNpmInstall(cacheDir, tmp);
    assert.equal(r.status, 0, `the search child failed:\n${r.stdout}\n${r.stderr}`);
    text = r.stdout;
    stderr = r.stderr;
  });

  after(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }); });

  it('premise: the index is the bundled fallback, as in the persona\'s install', (t) => {
    if (!IN_MONOREPO) { t.skip('the monorepo cli/ is not in this tree'); return; }
    assert.match(stderr, /Loaded \d+ languages from the bundled fallback/);
    assert.equal(glottocodes.get('ayt'), 'bata1297');
  });

  it('each of the six: no uncited location, and a link to its OWN Glottolog record', (t) => {
    if (!IN_MONOREPO) { t.skip('the monorepo cli/ is not in this tree'); return; }
    const urls = new Set();
    for (const code of AYTA) {
      const b = block(text, code);
      assert.ok(b?.detail, `${code} has no second line\n${text}`);
      assert.doesNotMatch(b.detail, /Philippines|°N|°E|macroarea|Papunesia/, `${code}: an uncited location is shown`);
      assert.match(b.detail, /^where: not shown — the published card projection carries no per-field source for it/);
      const g = glottocodes.get(code);
      assert.match(g, /^[a-z0-9]{4}\d{4}$/, `premise: ${code}'s published row carries a glottocode`);
      assert.ok(b.detail.endsWith(`· Glottolog record (glottocode ${g}): https://glottolog.org/resource/languoid/id/${g}`),
        `${code}: ${b.detail}`);
      urls.add(g);
    }
    assert.equal(urls.size, AYTA.length, 'six different records — the links themselves tell the candidates apart');
  });

  it('the head says how to tell them apart, and the note says when the sources arrive', (t) => {
    if (!IN_MONOREPO) { t.skip('the monorepo cli/ is not in this tree'); return; }
    assert.match(text, /6 names are equally close \(distance 0\.5\)\. nothing cited here tells them apart .*each line links the language's Glottolog record by its glottocode, to compare them at the source, and the community knows which variety it speaks/);
    assert.match(text, /they arrive with the tables' next upload/);
  });

  it('a name-only result with nothing cached says so — no location and no link is invented offline', (t) => {
    if (!IN_MONOREPO) { t.skip('the monorepo cli/ is not in this tree'); return; }
    const others = text.split('\n').filter((l) => /^[a-z]{3} {2}/.test(l) && !AYTA.includes(l.slice(0, 3)));
    assert.ok(others.length > 0, 'premise: the search lists other close names');
    for (const head of others) {
      const b = block(text, head.slice(0, 3));
      assert.match(b.head, /— name-only entry in this install's bundled index \(no bundled or cached card on this machine, and none was fetched\); get_language [a-z]{3} fetches the full cited card/);
      assert.equal(b.detail, null);
      assert.doesNotMatch(b.head, /glottolog\.org|where:/);
    }
  });
});

describe('7. the docs say what search shows: a location only with its source, else the Glottolog link', () => {
  // The old promise: a location (with its source) on every result, unconditionally.
  const OLD = [
    /where the language is spoken(?: \([^)]*\))? and its other names, (?:each|every)(?: fact)? with its source/,
    /Each result says where the language is spoken, with its source/,
  ];
  const says = (label, raw) => {
    const s = flat(raw);
    for (const re of OLD) assert.doesNotMatch(s, re, `${label} still promises a location on every result`);
    assert.match(s, /only (?:the facts its card cites|when its card cites a source)/, `${label}: "only with its source"`);
    assert.match(s, /Glottolog record/, `${label}: the link to the source record`);
    assert.match(s, /next upload/, `${label}: when the per-field sources arrive`);
  };

  it('instructions.md', () => says('instructions.md', INSTRUCTIONS));
  it('README.md', () => says('README.md', README));
  it('the guide and the MCP server page', (t) => {
    if (!IN_MONOREPO) { t.skip('the monorepo docs are not in this tree'); return; }
    says('build-mt-for-your-language.md', read(DOC.guide));
    says('mcp-server.md', read(DOC.page));
  });
  it('the agent mirrors make no location promise', (t) => {
    if (!IN_MONOREPO) { t.skip('the monorepo docs are not in this tree'); return; }
    for (const f of [DOC.forAgents, DOC.llms]) {
      for (const re of OLD) assert.doesNotMatch(flat(read(f)), re, f);
    }
  });

  describe('the search_languages tool description', () => {
    let client;
    let state;
    before(async () => {
      state = mkdtempSync(path.join(tmpdir(), 'r12-surface-'));
      process.env.CHAMPOLLION_MCP_HOME = state;
      const server = await createServer();
      const [clientT, serverT] = InMemoryTransport.createLinkedPair();
      await server.connect(serverT);
      client = new Client({ name: 'r12-surface', version: '0.0.0' });
      await client.connect(clientT);
    });
    after(async () => {
      await client?.close();
      delete process.env.CHAMPOLLION_MCP_HOME;
      rmSync(state, { recursive: true, force: true });
    });
    it('says the same', async () => {
      const { tools } = await client.listTools();
      says('search_languages description', tools.find((x) => x.name === 'search_languages').description);
    });
  });
});

// -- 11. the register-corpus command names the role ---------------------------------

describe('11. the recommended register-corpus command registers the set as a TEST set', () => {
  it('the shared command carries --role test', () => {
    assert.equal(REGISTERED_ROLE, 'test');
    assert.match(registerLocalOnlyCommand(), / --role test$/);
    assert.match(registerLocalOnlyCommand({ pair: 'eng-qaa', domain: 'medical' }), /--domain medical --role test$/);
  });

  it('every MCP text that recommends it carries it: the guardrail, the overview (private-use and card)', () => {
    const guard = formatTrainingGuardrails(trainingGuardrails('private-test-set'));
    assert.equal(guard.split(registerLocalOnlyCommand()).length - 1, 2, 'rule and forge line');
    const qaa = formatPrivateUseOverview({ code: 'qaa', source: 'eng' });
    assert.ok(qaa.includes(registerLocalOnlyCommand({ pair: 'eng-qaa' })), qaa);
    assert.match(qaa, /--pair eng-qaa --license "<licence id>" --domain <domain> --role test`/);
  });

  it('the real CLI accepts it, records the role, and names it in the id (no "Role: not stated")', (t) => {
    const bin = path.join(CLI, 'bin/cli.js');
    if (!existsSync(bin)) { t.skip('the champollion CLI is not in this tree'); return; }
    const dir = mkdtempSync(path.join(tmpdir(), 'r12-register-'));
    try {
      const file = path.join(dir, 'nurse checked test.tsv');
      writeFileSync(file, 'Where does it hurt?\tsynthetic reference one\nThank you\tsynthetic reference two\n');
      const cmd = registerLocalOnlyCommand({
        file, name: 'Hospital test set', pair: 'eng-qaa', license: 'cc-by-4.0', domain: 'medical',
      });
      const argv = [...cmd.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
      const r = spawnSync(process.execPath, [bin, ...argv.slice(1)], {
        cwd: dir, encoding: 'utf8', input: '', timeout: 60_000,
        env: { ...process.env, HOME: dir, CHAMPOLLION_OFFLINE: '1' },
      });
      assert.equal(r.status, 0, `the CLI refused the suggested command:\n${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /Saved corpus card: eval-eng-qaa-hospital-test-set-test-v1/);
      assert.match(r.stdout, /Role: {9}test\n/);
      assert.doesNotMatch(r.stdout, /not stated \(add --role/);
      assert.equal(JSON.parse(read(`${file}.champollion.json`)).transmission, 'local-only');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('every documented register-corpus command that registers a test file names its role', (t) => {
    // A full command — one that names the tier or the data file — must say
    // what the set is for. (`champollion register-corpus` mentioned bare, as
    // a command name, is not a command to copy.)
    const docs = [['instructions.md', INSTRUCTIONS], ['README.md', README]];
    if (IN_MONOREPO) {
      for (const k of ['guide', 'page', 'forAgents', 'llms', 'registering', 'forgeReadme']) {
        if (existsSync(DOC[k])) docs.push([k, read(DOC[k])]);
      }
    }
    let seen = 0;
    for (const [label, raw] of docs) {
      for (const m of raw.matchAll(/`(champollion (?:network )?register-corpus[^`]*)`/g)) {
        const cmd = flat(m[1]);
        if (!/--data|--tier (?:local-only|private)/.test(cmd)) continue;
        seen += 1;
        assert.match(cmd, /--role (?:test|dev|train)\b/, `${label}: ${cmd}`);
      }
    }
    assert.ok(seen >= 3, `premise: the docs show the command (${seen} seen)`);
    if (IN_MONOREPO && existsSync(DOC.scaffold)) {
      assert.match(read(DOC.scaffold), /`champollion network register-corpus",\n\s*"\s+--tier local-only --role test`/,
        'nmt-forge init\'s NEXT_STEPS names the role too');
    }
  });
});

// -- 12. the coaching line on a local-only corpus ------------------------------------

describe('12. a coaching file on a local-only corpus: hash shown, first line withheld, and why', () => {
  const coaching = (extra = {}) => ({ status: 'ok', prompt: { kind: 'coaching', sha256: 'e'.repeat(64), chars: 628,
    coaching_file: '/w/coaching.md', names_target: true, builtin: 'You are a translator.', ...extra } });

  it('the plan line gives the reason, never the line — even if a probe returned one', () => {
    const [line] = promptPlanLines(coaching({ first_line: 'You are translating short school communications' }),
      { localOnly: true });
    assert.match(line, /\(628 chars, sha256 e{12}…; its first line is not shown — the corpus is marked local-only, and a coaching file can be built from the corpus's own sentences/);
    assert.ok(line.includes(COACHING_LINE_WITHHELD));
    assert.doesNotMatch(line, /school communications|first line: "/);
  });

  it('off a local-only corpus the first line is shown, with no withheld note', () => {
    const [line] = promptPlanLines(coaching({ first_line: 'Be careful with cases.' }));
    assert.match(line, /; first line: "Be careful with cases\."\)\./);
    assert.doesNotMatch(line, /not shown/);
  });

  it('run_benchmark\'s dry run on a marked file: the probe is told local-only, the plan says why', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'r12-coach-'));
    try {
      const corpus = path.join(dir, 'test.tsv');
      writeFileSync(corpus, 'Hello\tsynthetic one\n');
      writeFileSync(`${corpus}.champollion.json`, JSON.stringify({ transmission: 'local-only' }));
      const coach = path.join(dir, 'coaching.md');
      writeFileSync(coach, 'Translate into Plains Cree.\n');
      let asked = null;
      const plan = await runBenchmark({ corpus, provider: 'local', model: 'stub-1', target_language: 'Plains Cree',
        coaching_file: coach, dry_run: true }, {
        isMtEvalInstalled: async () => true, env: { CHAMPOLLION_MCP_HOME: dir },
        methodRegistry: { entries: { local: { kind: 'llm', default_base_url: 'http://127.0.0.1:11434/v1' } } },
        runPlanProbe: async (input) => {
          asked = input;
          return { status: 'ok', target: { code: 'crk', name: 'Plains Cree', from: 'x', scripts: ['Latn'] }, evalPack: {},
            prompt: { kind: 'coaching', sha256: 'f'.repeat(64), chars: 28, coaching_file: coach,
              first_line: 'Translate into Plains Cree.', names_target: true, builtin: 'You are a translator.',
              target_lang: 'Plains Cree', target_code: 'crk' } };
        },
        localModelWeights: async () => [], forgeOrder: () => [],
      });
      assert.equal(asked.localOnly, true, 'the probe is asked with the mark');
      assert.match(plan, /^Prompt: {3}coaching\.md REPLACES the harness's built-in prompt .*sha256 f{12}…; its first line is not shown — the corpus is marked local-only, and a coaching file can be built from the corpus's own sentences/m);
      assert.doesNotMatch(plan, /first line: "Translate into Plains Cree\."/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('instructions.md says what the plan shows for a local-only corpus, and why', () => {
    const s = flat(INSTRUCTIONS);
    assert.doesNotMatch(s, /A coaching file is shown by its first line and sha256,/);
    assert.match(s, /A coaching file is shown by its length and sha256, plus its first line — except on a corpus marked local-only, where the first line is withheld and the plan says why: a coaching file can be built from the corpus's own sentences/);
  });
});
