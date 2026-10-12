/**
 * Generates the public Index ("the Catalogue") datasets — a browsable map of
 * EVERYTHING in the Network, distilled at build time from the in-repo SSOTs.
 * Nothing here is hand-authored or hardcoded: it reads the live SSOTs and
 * auto-improves as those land (the sibling chips retagging domains/grades flow
 * straight through). No generated artifact is tracked in git (both outputs are
 * gitignored; see cli/website/.gitignore).
 *
 * INPUTS (first-available wins for the registry; the rest are required SSOTs):
 *   - arena/datasets/registry.json  (or static/registry.json on cold builds)
 *       → benchmark families we RUN (names, languages, license, contamination).
 *   - data/languages.json (the resolved language cards, written earlier in the
 *       shared-data loadContent) → per-language RESOURCES: corpora, models,
 *       FSTs, dictionaries, tools + archive presence (OLAC / PARADISEC / AILLA /
 *       Rosetta / Kaipuleohone) + corpus availability (OPUS / HuggingFace /
 *       Lexibank).
 *   - shared/method-registry.json   → METHODS (MT engines + LLM providers).
 *   - shared/human-services.json    → HUMAN translation services.
 *   - shared/catalogue/external-results.json → the cite-only "unverified" tier
 *       + the run/cite/exclude manifest.
 *
 * OUTPUTS:
 *   - data/catalogue.json       — compact: benchmark families, domain/license/
 *       type aggregates, methods, human services, external results, manifest,
 *       summary totals. (~small; fetched on every Index page load.)
 *   - data/catalogue-langs.json — per-language resource directory (one record
 *       per language with any resource / archive / availability / benchmark
 *       signal). Lazy-fetched by the page's "By language" view.
 *
 * FAIL-SOFT, NEVER SILENT: if the registry is unreachable (a cold cli/website
 * deploy with no monorepo siblings and no static copy), the benchmark sections
 * degrade to empty with a loud console warning and a `degraded` flag in the
 * output — the manifest's run/cite/exclude (from the committed SSOT) still
 * renders, so the page is never blank.
 */

const path = require('path');
const fs = require('fs-extra');

// Canonical archive landing pages (the archivePresence flags carry counts, not
// URLs). ELAR holdings surface through the OLAC aggregation where present.
const ARCHIVE_META = {
  OLAC: { label: 'OLAC (aggregated archives)', url: 'http://www.language-archives.org/' },
  paradisec: { label: 'PARADISEC', url: 'https://catalog.paradisec.org.au/' },
  ailla: { label: 'AILLA', url: 'https://ailla.utexas.org/' },
  rosettaProjectItems: { label: 'The Rosetta Project', url: 'https://rosettaproject.org/' },
  kaipuleohoneItems: { label: 'Kaipuleohone', url: 'https://ling.hawaii.edu/kaipuleohone/' },
};

// list-shaped `resources` items whose `source` begins with one of these are
// universal typological-database pointers (the same WALS/Grambank/Glottolog
// entries repeated across thousands of cards). We fold them into per-language
// boolean flags instead of listing them, to keep the payload meaningful.
const GENERIC_RESOURCE_SOURCES = ['wals', 'grambank', 'glottolog', 'phoible', 'asjp'];

const isGenericRef = (src) =>
  GENERIC_RESOURCE_SOURCES.some((g) => String(src || '').toLowerCase().startsWith(g));

// Card fields are heterogeneous (a count, a boolean, or an object like
// { itemCount, collectionCount, mediaTypes }). The distilled output must hold
// ONLY primitives so nothing is ever rendered as a raw React child.
const strOrNull = (v) =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;
const numOrNull = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
/** A holding/availability value → numeric count, or null when it carries only presence. */
function holdingCount(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v && typeof v === 'object') return numOrNull(v.itemCount) ?? numOrNull(v.count) ?? numOrNull(v.collectionCount);
  return null; // booleans encode presence only
}
/** Is an archive/platform present at all? (number > 0, boolean true, or any object) */
function isPresent(v) {
  if (typeof v === 'number') return v > 0;
  if (typeof v === 'boolean') return v;
  return v != null && typeof v === 'object';
}

/** Most-common value in a list (ties broken by first-seen order). */
function mode(values) {
  const counts = new Map();
  for (const v of values) {
    if (v == null) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = null;
  let bestN = -1;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/** Resolve the registry path: monorepo SSOT first, then the static copy. */
function resolveRegistry({ canonicalRegistry, staticRegistry }) {
  if (fs.existsSync(canonicalRegistry)) return canonicalRegistry;
  if (fs.existsSync(staticRegistry)) return staticRegistry;
  return null;
}

/**
 * Distill the benchmark families we RUN from the corpora registry SSOT.
 * Returns { families, domains, licenses, langBenchmarks, totals } or a degraded
 * shell when the registry is absent.
 */
function distillBenchmarks(registryPath) {
  if (!registryPath) {
    return {
      degraded: true,
      families: [],
      domains: [],
      licenses: [],
      langBenchmarks: new Map(),
      totals: { datasets: 0, pairs: 0, families: 0, languages: 0 },
    };
  }

  const reg = fs.readJsonSync(registryPath);
  const datasets = Array.isArray(reg.datasets) ? reg.datasets : [];
  // Skip quarantined entries — they exist in the registry but must never be
  // presented as rankable benchmarks (improper-subset / fail-safe doctrine).
  const runnable = datasets.filter((d) => d && d.quarantine !== true);

  const families = new Map();
  const domainAgg = new Map();
  const licenseAgg = new Map();
  const langBenchmarks = new Map(); // code -> Map(family -> pairCount)
  const allLangs = new Set();

  const FAMILY_NAMES = {
    flores: 'FLORES-200 / FLORES+',
    tico19: 'TICO-19',
    in22: 'IN22 (Indic)',
    tatoeba: 'Tatoeba (clean bridges)',
    globalvoices: 'GlobalVoices',
    smol: 'SMOL',
    alt: 'ALT (Asian Language Treebank)',
    turkicxwmt: 'TurkicX-WMT',
    wmt24pp: 'WMT24++',
    gamayun: 'Gamayun (TWB)',
    prize: 'Prize / contest sets',
  };

  for (const d of runnable) {
    const fam = d.registry_source || 'other';
    const lp = d.language_pair || {};
    const src = lp.source || null;
    const tgt = lp.target || null;
    const domain = d.domain || 'unspecified';
    const license = d.license || 'unspecified';
    const contam = (d.contamination || 'UNKNOWN').toUpperCase();

    // Family aggregation
    if (!families.has(fam)) {
      families.set(fam, {
        family: fam,
        name: FAMILY_NAMES[fam] || fam,
        datasetCount: 0,
        pairCount: 0,
        gatedCount: 0,
        languages: new Set(),
        domains: new Map(),
        licenses: new Map(),
        contamination: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
        examples: [],
      });
    }
    const F = families.get(fam);
    F.datasetCount += 1;
    F.pairCount += 1; // one dataset == one directed pair in the runnable registry
    if (d.gated === true) F.gatedCount += 1;
    if (src) F.languages.add(src);
    if (tgt) F.languages.add(tgt);
    F.domains.set(domain, (F.domains.get(domain) || 0) + 1);
    F.licenses.set(license, (F.licenses.get(license) || 0) + 1);
    F.contamination[contam in F.contamination ? contam : 'UNKNOWN'] += 1;
    if (F.examples.length < 6) {
      F.examples.push({
        id: d.id,
        name: d.name,
        source: src,
        target: tgt,
        size: d.size ?? null,
        license,
        contamination: contam,
        gated: d.gated === true,
      });
    }

    // Global domain / license aggregation
    if (!domainAgg.has(domain)) domainAgg.set(domain, { domain, datasetCount: 0, families: new Set() });
    domainAgg.get(domain).datasetCount += 1;
    domainAgg.get(domain).families.add(fam);
    if (!licenseAgg.has(license)) licenseAgg.set(license, { license, datasetCount: 0, families: new Set() });
    licenseAgg.get(license).datasetCount += 1;
    licenseAgg.get(license).families.add(fam);

    // Per-language benchmark coverage (both endpoints)
    for (const code of [src, tgt]) {
      if (!code) continue;
      allLangs.add(code);
      if (!langBenchmarks.has(code)) langBenchmarks.set(code, new Map());
      const m = langBenchmarks.get(code);
      m.set(fam, (m.get(fam) || 0) + 1);
    }
  }

  const familiesOut = [...families.values()]
    .map((F) => ({
      family: F.family,
      name: F.name,
      datasetCount: F.datasetCount,
      pairCount: F.pairCount,
      gatedCount: F.gatedCount,
      languageCount: F.languages.size,
      languages: [...F.languages].sort(),
      domains: [...F.domains.entries()].map(([d, n]) => ({ domain: d, count: n })).sort((a, b) => b.count - a.count),
      licenses: [...F.licenses.keys()].sort(),
      primaryLicense: mode([...F.licenses.entries()].flatMap(([k, n]) => Array(n).fill(k))),
      contamination: F.contamination,
      contaminationPosture: posture(F.contamination),
      examples: F.examples,
    }))
    .sort((a, b) => b.datasetCount - a.datasetCount);

  const domainsOut = [...domainAgg.values()]
    .map((d) => ({ domain: d.domain, datasetCount: d.datasetCount, families: [...d.families].sort() }))
    .sort((a, b) => b.datasetCount - a.datasetCount);

  const licensesOut = [...licenseAgg.values()]
    .map((l) => ({ license: l.license, datasetCount: l.datasetCount, families: [...l.families].sort() }))
    .sort((a, b) => b.datasetCount - a.datasetCount);

  return {
    degraded: false,
    registryVersion: reg.registry_version || null,
    families: familiesOut,
    domains: domainsOut,
    licenses: licensesOut,
    langBenchmarks,
    totals: {
      datasets: runnable.length,
      pairs: runnable.length,
      families: familiesOut.length,
      languages: allLangs.size,
      quarantinedSkipped: datasets.length - runnable.length,
    },
  };
}

/** Describe a family's dominant contamination posture for display. */
function posture({ HIGH, MEDIUM, LOW }) {
  const total = HIGH + MEDIUM + LOW;
  if (!total) return 'unknown';
  if (HIGH >= total * 0.5) return 'HIGH — relative-only';
  if (LOW >= total * 0.5) return 'LOW — absolute-eligible';
  return 'mixed — eligibility-gated per dataset';
}

/**
 * Distill per-language resources from the resolved language cards, merging in
 * benchmark coverage. Returns { langs, resourceTypes, archives, totals }.
 */
function distillLanguageResources(languagesFile, langBenchmarks) {
  const cards = fs.readJsonSync(languagesFile);
  const langs = [];
  const resourceTypeAgg = new Map();
  const archiveAgg = new Map();
  let withConcrete = 0;

  for (const card of cards) {
    const code = card.code;
    if (!code) continue;

    const resources = [];
    const flags = {};

    // resources — dict shape: { corpora:[], models:[], fsts:[], tools:[], lexical:[], nlp:[], dictionaries:[], grammars:[] }
    const r = card.resources;
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      for (const [cat, arr] of Object.entries(r)) {
        if (!Array.isArray(arr)) continue;
        for (const it of arr) {
          if (!it || typeof it !== 'object') continue;
          const install = it.install || {};
          // grammars entries are citations ({author, year, title}) — label
          // them "Author (Year). Title" instead of the missing `name`.
          const citationName = it.title
            ? [it.author, it.year ? `(${it.year}).` : null, it.title]
                .filter(Boolean).join(' ')
            : null;
          resources.push({
            cat: strOrNull(cat),
            name: strOrNull(it.name) || strOrNull(citationName),
            type: strOrNull(it.type) || strOrNull(cat),
            url: strOrNull(it.url) || (install.repo ? `https://github.com/${install.repo}` : null),
            license: strOrNull(it.license),
            // default-display "see source for access" when no explicit flag
            access: strOrNull(it.exposure) || strOrNull(it.access) || 'see source for access',
            source: strOrNull(it.source),
          });
        }
      }
    } else if (Array.isArray(r)) {
      // resources — list shape: [{type,name,description,url,source}]
      for (const it of r) {
        if (!it || typeof it !== 'object') continue;
        if (isGenericRef(it.source)) {
          flags.typology = true; // folded: covered by WALS/Grambank/etc.
          continue;
        }
        resources.push({
          cat: 'reference',
          name: strOrNull(it.name),
          type: strOrNull(it.type) || 'reference',
          url: strOrNull(it.url),
          license: strOrNull(it.license),
          access: strOrNull(it.access) || 'see source for access',
          source: strOrNull(it.source),
        });
      }
    }

    // archive presence (named language archives)
    const archives = [];
    const ap = card.archivePresence;
    if (ap && typeof ap === 'object') {
      if (isPresent(ap.olacResourceCount)) {
        archives.push({ archive: 'OLAC', label: ARCHIVE_META.OLAC.label, count: holdingCount(ap.olacResourceCount), url: ARCHIVE_META.OLAC.url });
      }
      for (const key of ['paradisec', 'ailla', 'rosettaProjectItems', 'kaipuleohoneItems']) {
        const v = ap[key];
        if (isPresent(v)) {
          const meta = ARCHIVE_META[key];
          archives.push({ archive: key, label: meta.label, count: holdingCount(v), url: meta.url });
        }
      }
    }

    // corpus availability (data platforms)
    const availability = [];
    const ca = card.corpusAvailability;
    if (ca && typeof ca === 'object') {
      const opus = ca.opus;
      if (opus && typeof opus === 'object' && opus.corpora) {
        availability.push({
          platform: 'OPUS',
          count: numOrNull(opus.corpora),
          names: Array.isArray(opus.corpusNames) ? opus.corpusNames.filter((n) => typeof n === 'string').slice(0, 8) : null,
          url: 'https://opus.nlpl.eu/',
        });
      } else if (opus === true) {
        availability.push({ platform: 'OPUS', count: null, names: null, url: 'https://opus.nlpl.eu/' });
      }
      if (numOrNull(ca.huggingFaceDatasets)) {
        availability.push({
          platform: 'HuggingFace',
          count: numOrNull(ca.huggingFaceDatasets),
          url: `https://huggingface.co/datasets?language=language:${code}`,
        });
      }
      if (numOrNull(ca.lexibankDatasets)) {
        availability.push({ platform: 'Lexibank', count: numOrNull(ca.lexibankDatasets), url: 'https://lexibank.clld.org/' });
      }
    }

    // benchmark coverage (from the registry distillation)
    const benchmarks = [];
    const bm = langBenchmarks.get(code);
    if (bm) {
      for (const [family, pairs] of bm) benchmarks.push({ family, pairs });
      benchmarks.sort((a, b) => b.pairs - a.pairs);
    }

    if (!resources.length && !archives.length && !availability.length && !benchmarks.length) {
      continue;
    }

    // aggregates
    if (resources.length) withConcrete += 1;
    for (const res of resources) {
      const t = res.type || res.cat || 'other';
      resourceTypeAgg.set(t, (resourceTypeAgg.get(t) || 0) + 1);
    }
    for (const a of archives) {
      if (!archiveAgg.has(a.archive)) archiveAgg.set(a.archive, { archive: a.archive, label: a.label, url: a.url, languageCount: 0 });
      archiveAgg.get(a.archive).languageCount += 1;
    }

    // richness: concrete resources weigh most, then benchmarks, then archives
    const richness = resources.length * 5 + benchmarks.length * 3 + availability.length + archives.length;

    langs.push({
      code,
      name: card.name || code,
      endonym: pickEndonym(card.nativeName),
      macroarea: card.macroarea || null,
      vitality: (card.vitality && card.vitality.unescoStatus) || null,
      country: Array.isArray(card.countries) && card.countries.length ? card.countries[0] : null,
      resources,
      archives,
      availability,
      benchmarks,
      flags,
      richness,
    });
  }

  langs.sort((a, b) => b.richness - a.richness || a.name.localeCompare(b.name));

  return {
    langs,
    resourceTypes: [...resourceTypeAgg.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    archives: [...archiveAgg.values()].sort((a, b) => b.languageCount - a.languageCount),
    totals: { languages: langs.length, withConcreteResources: withConcrete },
  };
}

/** First renderable native-name variant (compact, RTL-safe enough for a chip). */
function pickEndonym(nativeName) {
  if (!nativeName) return null;
  const v = String(nativeName).split(/\s*[/;]\s*/).map((s) => s.trim()).filter(Boolean);
  return v[0] || null;
}

/** Slim the method registry for display. */
function distillMethods(methodRegistryFile) {
  if (!methodRegistryFile || !fs.existsSync(methodRegistryFile)) {
    console.warn('[shared-data] ⚠️  catalogue: method-registry.json absent — methods section will be empty.');
    return [];
  }
  const reg = fs.readJsonSync(methodRegistryFile);
  const entries = reg.entries || {};
  return Object.entries(entries).map(([name, e]) => ({
    name,
    kind: e.kind,
    methodClass: e.method_class,
    paradigm: e.paradigm,
    license: e.license || null,
    homepage: e.homepage || null,
    commercialReady: e.commercialReady === true,
    costNote: e.cost_note || null,
  }));
}

/** Pass human services through (the committed SSOT is already public). */
function distillHumanServices(humanServicesFile) {
  if (!humanServicesFile || !fs.existsSync(humanServicesFile)) {
    console.warn('[shared-data] ⚠️  catalogue: human-services.json absent — human services section will be empty.');
    return [];
  }
  const arr = fs.readJsonSync(humanServicesFile);
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => ({
    serviceId: s.service_id,
    displayName: s.display_name,
    providerType: s.provider_type || null,
    source: s.source_lang || null,
    target: s.target_lang || null,
    variety: s.variety || null,
    domains: s.domains || null,
    turnaroundDays: s.turnaround_days ?? null,
    sovereigntyFlags: s.sovereignty_flags || null,
    ncTerms: s.nc_terms || null,
    consentAttested: s.consent_attested === true,
    status: s.status || 'pending',
  }));
}

/**
 * Pass the method-availability INDEX through for display. This is the
 * cite-only superset of the runnable method-registry — every method seen in
 * the external results, with availability / weight-openness / access channels.
 * Hand-curated in the SSOT, so we slim only lightly.
 */
function distillMethodIndex(external) {
  const methods = Array.isArray(external.methods) ? external.methods : [];
  return methods.map((m) => ({
    id: m.id,
    name: m.name,
    org: m.org || null,
    paradigm: m.paradigm || null,
    availability: m.availability,
    weights: m.weights,
    access: Array.isArray(m.access) ? m.access : [],
    license: m.license || null,
    commercialUse: typeof m.commercial_use === 'boolean' ? m.commercial_use : null,
    homepage: m.homepage || null,
    weightsUrl: m.weights_url || null,
    sourceUrl: m.source_url || null,
    runnable: m.runnable_in_champollion === true,
    notes: m.notes || null,
  }));
}

/**
 * Distill the bulk external MT results index (external-mt-index.json — best
 * publicly reported score per (language pair, public test set, metric) across
 * the Helsinki-NLP leaderboards) into:
 *   - a compact at-a-glance summary block for catalogue.json (pair/cell/model
 *     counts, commit pins, and the flores200 chrF++ family-win rollup), and
 *   - a per-language depth map: code → { pairs, best[] } (top best-published
 *     chrF++ results touching that language) for catalogue-langs / DetailPanel.
 * RELATIVE-ONLY honesty travels with both (every indexed test set is public).
 * Fail-soft: absent file → null summary + empty map, loud warning.
 */
function distillExternalMtIndex(externalMtIndexFile) {
  if (!externalMtIndexFile || !fs.existsSync(externalMtIndexFile)) {
    console.warn(
      '[shared-data] ⚠️  catalogue: external-mt-index.json absent — bulk external index ' +
        'summary + per-language best-published blocks will be empty.',
    );
    return { summary: null, byLang: new Map() };
  }
  let idx;
  try {
    idx = fs.readJsonSync(externalMtIndexFile);
  } catch (e) {
    console.warn(`[shared-data] ⚠️  catalogue: external-mt-index.json unreadable (${e.message}).`);
    return { summary: null, byLang: new Map() };
  }

  const models = Array.isArray(idx.models) ? idx.models : [];
  const famPrefixes = Object.keys(idx.family_derivation || {}).sort((a, b) => b.length - a.length);
  const familyOf = (model) => {
    for (const p of famPrefixes) if (model.startsWith(p)) return idx.family_derivation[p];
    return null;
  };

  const HEADLINE_TESTSET = 'flores200-devtest';
  const familyWins = {};
  const byLang = new Map(); // code -> { pairs: Set, candidates: [] }
  let cells = 0;

  for (const [pair, perTestset] of Object.entries(idx.pairs || {})) {
    const [rawSrc, rawTgt] = pair.split('-');
    if (!rawTgt) continue;
    const src = rawSrc.split('_')[0];
    const tgt = rawTgt.split('_')[0];
    for (const [testset, perMetric] of Object.entries(perTestset)) {
      cells += 1;
      const cell = perMetric.chrf_pp || perMetric.bleu;
      if (!cell) continue;
      const metric = perMetric.chrf_pp ? 'chrf_pp' : 'bleu';
      const [mi, value] = cell;
      const model = models[mi] || null;
      const family = model ? familyOf(model) : null;
      if (testset === HEADLINE_TESTSET && perMetric.chrf_pp && family) {
        familyWins[family] = (familyWins[family] || 0) + 1;
      }
      for (const code of new Set([src, tgt])) {
        if (!byLang.has(code)) byLang.set(code, { pairs: new Set(), candidates: [] });
        const entry = byLang.get(code);
        entry.pairs.add(pair);
        // Only chrF++ competes for the "best" slots (comparable scale); a
        // bleu-only cell still counts toward pair coverage above.
        if (metric === 'chrf_pp') {
          entry.candidates.push({ pair, testset, metric, model, family, value });
        }
      }
    }
  }

  const byLangOut = new Map();
  for (const [code, { pairs, candidates }] of byLang) {
    candidates.sort((a, b) => b.value - a.value);
    byLangOut.set(code, {
      pairs: pairs.size,
      best: candidates.slice(0, 3),
    });
  }

  const sources = Array.isArray(idx.sources)
    ? idx.sources.map((s) => ({ name: s.name, repo: s.repo, commit: s.commit, retrieved: s.retrieved }))
    : [];

  return {
    summary: {
      pairs: Object.keys(idx.pairs || {}).length,
      cells,
      models: models.length,
      testsets: Object.keys(idx.contamination_posture || {}),
      sources,
      familyWins: { testset: HEADLINE_TESTSET, metric: 'chrf_pp', wins: familyWins },
      note:
        'Best PUBLISHED score per language pair on public test sets, indexed from the ' +
        'Helsinki-NLP leaderboards (values verbatim, selection champollion-derived). ' +
        'RELATIVE-ONLY: public test sets — an orientation signal, never an absolute ' +
        'quality claim and never ranked against held-out-lane results.',
    },
    byLang: byLangOut,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.canonicalRegistry  arena/datasets/registry.json
 * @param {string} opts.staticRegistry     static/registry.json (cold-build copy)
 * @param {string} opts.languagesFile      data/languages.json (resolved cards)
 * @param {string} opts.methodRegistryFile shared/method-registry.json
 * @param {string} opts.humanServicesFile  shared/human-services.json
 * @param {string} opts.externalResultsFile shared/catalogue/external-results.json
 * @param {string} [opts.externalMtIndexFile] shared/catalogue/external-mt-index.json (bulk best-published index)
 * @param {string} opts.catalogueOut        data/catalogue.json
 * @param {string} opts.langsOut            data/catalogue-langs.json
 */
async function generateCatalogueJson(opts) {
  const {
    canonicalRegistry,
    staticRegistry,
    languagesFile,
    methodRegistryFile,
    humanServicesFile,
    externalResultsFile,
    externalMtIndexFile,
    catalogueOut,
    langsOut,
  } = opts;

  // Freshness: skip when all outputs are newer than every input that exists.
  const inputs = [canonicalRegistry, staticRegistry, languagesFile, methodRegistryFile, humanServicesFile, externalResultsFile, externalMtIndexFile]
    .filter((f) => f && fs.existsSync(f));
  const outsPresent = fs.existsSync(catalogueOut) && fs.existsSync(langsOut);
  if (outsPresent) {
    const outMtimes = [catalogueOut, langsOut]
      .map((f) => fs.statSync(f).mtimeMs);
    const outMtime = Math.min(...outMtimes);
    const newestIn = Math.max(...inputs.map((f) => fs.statSync(f).mtimeMs), 0);
    if (outMtime >= newestIn) {
      return;
    }
  }

  let external = { results: [], manifest: { run: [], cite: [], exclude: [] } };
  if (externalResultsFile && fs.existsSync(externalResultsFile)) {
    external = fs.readJsonSync(externalResultsFile);
  } else {
    console.warn(
      '[shared-data] ⚠️  catalogue: external-results.json absent — external "unverified" tier + ' +
        'run/cite/exclude manifest will be empty.',
    );
  }

  const registryPath = resolveRegistry({ canonicalRegistry, staticRegistry });
  if (!registryPath) {
    console.warn(
      '[shared-data] ⚠️  catalogue: arena/datasets/registry.json and static/registry.json both absent — ' +
        'benchmark sections will be empty (manifest + methods + human services + external + language ' +
        'resources still render). Run ensure-network-artifacts or build inside the monorepo for full data.',
    );
  }
  const bench = distillBenchmarks(registryPath);

  let langData = { langs: [], resourceTypes: [], archives: [], totals: { languages: 0, withConcreteResources: 0 } };
  if (languagesFile && fs.existsSync(languagesFile)) {
    langData = distillLanguageResources(languagesFile, bench.langBenchmarks);
  } else {
    console.warn('[shared-data] ⚠️  catalogue: data/languages.json absent — per-language resource directory will be empty.');
  }

  const methods = distillMethods(methodRegistryFile);
  const humanServices = distillHumanServices(humanServicesFile);
  const methodIndex = distillMethodIndex(external);
  const externalMt = distillExternalMtIndex(externalMtIndexFile);

  // Per-language depth: attach the best-published block to each lang record
  // that participates in any indexed pair (glance = the External tab summary;
  // depth = this, surfaced by the catalogue's language detail panel).
  if (externalMt.byLang.size) {
    for (const lang of langData.langs) {
      const ext = externalMt.byLang.get(lang.code);
      if (ext) lang.externalMt = ext;
    }
  }

  const catalogue = {
    generated: { by: 'generateCatalogueJson.js (build-time, from SSOTs)' },
    degraded: bench.degraded,
    registryVersion: bench.registryVersion || null,
    sources: {
      benchmarks: 'arena/datasets/registry.json',
      languageResources: 'cli/shared/language-cards/* (resolved → data/languages.json)',
      methods: 'shared/method-registry.json',
      humanServices: 'shared/human-services.json',
      external: 'shared/catalogue/external-results.json',
      externalIndex: 'shared/catalogue/external-mt-index.json',
    },
    summary: {
      benchmarkFamilies: bench.families.length,
      datasets: bench.totals.datasets,
      benchmarkLanguages: bench.totals.languages,
      languagesWithResources: langData.totals.languages,
      languagesWithConcreteResources: langData.totals.withConcreteResources,
      methods: methods.length,
      humanServices: humanServices.length,
      externalResults: Array.isArray(external.results) ? external.results.length : 0,
      externalIndexedPairs: externalMt.summary ? externalMt.summary.pairs : 0,
      methodIndex: methodIndex.length,
      excludedFamilies: external.manifest && Array.isArray(external.manifest.exclude) ? external.manifest.exclude.length : 0,
    },
    benchmarks: bench.families,
    benchmarkTotals: bench.totals,
    domains: bench.domains,
    licenses: bench.licenses,
    resourceTypes: langData.resourceTypes,
    archives: langData.archives,
    methods,
    methodIndex,
    humanServices,
    external: Array.isArray(external.results) ? external.results : [],
    externalIndex: externalMt.summary,
    manifest: external.manifest || { run: [], cite: [], exclude: [] },
  };

  await fs.ensureDir(path.dirname(catalogueOut));
  await fs.writeJson(catalogueOut, catalogue);
  await fs.writeJson(langsOut, { generated: catalogue.generated, langs: langData.langs });

  console.log(
    `[shared-data] Wrote catalogue.json (${bench.families.length} families, ` +
      `${bench.totals.datasets} datasets, ${methods.length} methods, ${methodIndex.length} indexed methods, ` +
      `${humanServices.length} human services, ${catalogue.summary.externalResults} external results) ` +
      `and catalogue-langs.json (${langData.langs.length} languages).`,
  );
}

module.exports = { generateCatalogueJson, posture, isGenericRef, pickEndonym };
