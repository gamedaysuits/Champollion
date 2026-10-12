#!/usr/bin/env node

/**
 * build-language-tree.mjs
 * ────────────────────────────────────────────────────────────────
 * Phase 1.2: Language Tree of Life
 *
 * Three-layer architecture (see language-tree-design.md):
 *
 *   Layer 1: language-tree.json — Full Glottolog hierarchy as reference data.
 *            Used by Lab UI, contest scoping, language discovery. NOT consumed
 *            by the translation pipeline.
 *
 *   Layer 2: Card enrichment — Adds classification, glottocode, macrolanguage,
 *            and scripts fields to existing language cards.
 *
 *   Layer 3: Genus cards — Curated, NOT auto-generated. Created manually when
 *            we add languages that share runtime properties.
 *
 * Source: Glottolog 5.3 (CC BY 4.0, Max Planck Institute)
 * Classification: WALS-style "genus" for property inheritance
 * Identifiers: ISO 639-3, BCP 47, Glottocode, ISO 15924
 *
 * Sign languages are excluded (non-textual). Creoles and mixed languages
 * are included with substrate/superstrate metadata.
 *
 * Usage:
 *   node scripts/build-language-tree.mjs [--dry-run] [--stats-only] [--enrich]
 *
 * Flags:
 *   --dry-run     Show what would be written without writing files
 *   --stats-only  Print statistics and exit
 *   --enrich      Also enrich existing language cards with classification data
 *
 * Prerequisites:
 *   Download glottolog_languoid.csv.zip from https://glottolog.org/meta/downloads
 *   Extract to cli/data/glottolog/languoid.csv
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOTTOLOG_CSV = path.join(__dirname, '..', 'data', 'glottolog', 'languoid.csv');
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const TREE_OUTPUT = path.join(CARDS_DIR, 'language-tree.json');

const GLOTTOLOG_VERSION = '5.3';
const GLOTTOLOG_LICENSE = 'CC-BY-4.0';
const GLOTTOLOG_URL = 'https://glottolog.org';

// Glottolog files some entries under housekeeping pseudo-families that are
// NOT genealogical language families. Per the Language-Card Boundary
// Invariant (faithfully report what the source ACTUALLY says), cards for
// these languoids assert NO family: family stays null, the bucket
// glottocode is carried machine-readably, and a cited note says what
// Glottolog does say. Each gloss below completes the sentence
// "— <gloss>, not a genealogical language family."
//
// pidg1258 'Pidgin' and mixe1287 'Mixed Language' are included per founder
// direction (2026-07-07): they are meaningful contact-language TYPES, but
// still not genealogical families — the type information is preserved in
// the cited note, never in the family field.
const HOUSEKEEPING_BUCKETS = {
  book1242: {
    name: 'Bookkeeping',
    gloss: 'the housekeeping category for spurious, unattested, or retired entries',
  },
  uncl1493: {
    name: 'Unclassifiable',
    gloss: 'the holding category for languages whose documentation is too limited to establish any genealogical affiliation',
  },
  unat1236: {
    name: 'Unattested',
    gloss: 'the holding category for languages reported to exist but with no attested linguistic data',
  },
  arti1236: {
    name: 'Artificial Language',
    gloss: 'the category for constructed languages, which stand outside genealogical classification',
  },
  spee1234: {
    name: 'Speech Register',
    gloss: 'the category for special-purpose speech registers rather than independently transmitted languages',
  },
  pidg1258: {
    name: 'Pidgin',
    gloss: 'the category for pidgins, contact languages that stand outside tree-model genealogical descent',
  },
  mixe1287: {
    name: 'Mixed Language',
    gloss: 'the category for mixed languages, whose descent from multiple source languages stands outside single-parent genealogical classification',
  },
};

const HOUSEKEEPING_BUCKET_NAMES = new Set(
  Object.values(HOUSEKEEPING_BUCKETS).map(b => b.name));

function bucketClassification(bucketGlottocode) {
  const { name, gloss } = HOUSEKEEPING_BUCKETS[bucketGlottocode];
  return {
    family: null,
    glottologBucket: bucketGlottocode,
    note: `Glottolog ${GLOTTOLOG_VERSION} files this entry under its ` +
      `'${name}' bucket (${bucketGlottocode}) — ${gloss}, not a ` +
      `genealogical language family. No family classification is asserted.`,
    ancestry: [],
  };
}

const dryRun = process.argv.includes('--dry-run');
const statsOnly = process.argv.includes('--stats-only');
const enrichCards = process.argv.includes('--enrich');

// ─── ISO 639-3 Macrolanguage Mappings ──────────────────────────
// Source: https://iso639-3.sil.org/code_tables/macrolanguage_mappings
// These map individual language codes to their macrolanguage umbrella.

const MACROLANGUAGE_MAP = {
  // Cree
  crk: 'cre', csw: 'cre', cwd: 'cre', crm: 'cre', crl: 'cre', crj: 'cre',
  // Arabic
  arb: 'ara', apc: 'ara', arz: 'ara', acm: 'ara', aeb: 'ara', ary: 'ara',
  ars: 'ara', acq: 'ara', ajp: 'ara', ayl: 'ara', ayh: 'ara', shu: 'ara',
  // Chinese
  cmn: 'zho', yue: 'zho', wuu: 'zho', nan: 'zho', hak: 'zho', hsn: 'zho',
  gan: 'zho', czh: 'zho', czo: 'zho', cpx: 'zho', cjy: 'zho', mnp: 'zho',
  // Malay
  zsm: 'msa', ind: 'msa', zlm: 'msa', max: 'msa', meo: 'msa',
  // Quechua
  quz: 'que', qub: 'que', qud: 'que', quf: 'que', qug: 'que', quh: 'que',
  quk: 'que', qul: 'que', qup: 'que', qur: 'que', qus: 'que', quw: 'que',
  qux: 'que', quy: 'que', qva: 'que', qvc: 'que', qve: 'que', qvh: 'que',
  qvi: 'que', qvj: 'que', qvl: 'que', qvm: 'que', qvn: 'que', qvo: 'que',
  qvp: 'que', qvs: 'que', qvw: 'que', qvz: 'que', qwa: 'que', qwc: 'que',
  qwh: 'que', qws: 'que', qxa: 'que', qxc: 'que', qxh: 'que', qxl: 'que',
  qxn: 'que', qxo: 'que', qxp: 'que', qxr: 'que', qxt: 'que', qxu: 'que',
  qxw: 'que',
  // Persian
  pes: 'fas', prs: 'fas',
  // Swahili
  swc: 'swa', swh: 'swa',
  // Latvian
  ltg: 'lav', lvs: 'lav',
  // Norwegian
  nno: 'nor', nob: 'nor',
};

// ─── CSV Parser ────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

async function loadGlottologCSV() {
  if (!fs.existsSync(GLOTTOLOG_CSV)) {
    console.error(`ERROR: Glottolog CSV not found at ${GLOTTOLOG_CSV}`);
    console.error('Download from: https://glottolog.org/meta/downloads');
    console.error('Extract glottolog_languoid.csv.zip to cli/data/glottolog/');
    process.exit(1);
  }
  const rl = createInterface({
    input: createReadStream(GLOTTOLOG_CSV, 'utf-8'),
    crlfDelay: Infinity,
  });
  let headers = null;
  const rows = [];
  for await (const line of rl) {
    if (!headers) { headers = parseCSVLine(line); continue; }
    const fields = parseCSVLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = fields[i] || '';
    rows.push(row);
  }
  return rows;
}

// ─── Tree Builder (Layer 1) ────────────────────────────────────

function buildTree(rows) {
  const byId = new Map();
  for (const row of rows) byId.set(row.id, row);

  // Glottolog pseudo-families — internal housekeeping, not real linguistic families
  const PSEUDO_FAMILY_IDS = new Set([
    'book1242', // Bookkeeping
    'uncl1493', // Unclassifiable
    'unat1236', // Unattested
    'pidg1258', // Pidgin
    'arti1236', // Artificial Language
    'spee1234', // Speech Register
    'mixe1287', // Mixed Language (kept in tree but flagged — see creole handling)
  ]);

  // Find sign language families to exclude (non-textual)
  const SIGN_FAMILY_IDS = new Set();
  for (const row of rows) {
    if (row.name && row.name.toLowerCase().includes('sign') && row.level === 'family' && !row.parent_id) {
      SIGN_FAMILY_IDS.add(row.id);
    }
  }

  const EXCLUDED_FAMILY_IDS = new Set([...PSEUDO_FAMILY_IDS, ...SIGN_FAMILY_IDS]);

  const realRows = rows.filter(r => {
    if (r.bookkeeping === 'True') return false;
    // Exclude sign language families and their descendants
    if (SIGN_FAMILY_IDS.has(r.id)) return false;
    if (SIGN_FAMILY_IDS.has(r.family_id)) return false;
    // Exclude pseudo-family descendants from tree (but keep byId for lookups)
    if (PSEUDO_FAMILY_IDS.has(r.id)) return false;
    if (PSEUDO_FAMILY_IDS.has(r.family_id)) return false;
    return true;
  });

  // Build parent-child index
  const children = new Map();
  for (const row of realRows) {
    if (row.parent_id) {
      if (!children.has(row.parent_id)) children.set(row.parent_id, []);
      children.get(row.parent_id).push(row.id);
    }
  }

  const topFamilies = realRows.filter(r => !r.parent_id && r.level === 'family');
  const isolates = realRows.filter(r => !r.parent_id && r.level === 'language');

  const stats = {
    totalEntries: realRows.length,
    families: realRows.filter(r => r.level === 'family').length,
    languages: realRows.filter(r => r.level === 'language').length,
    dialects: realRows.filter(r => r.level === 'dialect').length,
    topFamilies: topFamilies.length,
    isolates: isolates.length,
    withIso639: realRows.filter(r => r.iso639P3code).length,
    signLanguagesExcluded: SIGN_FAMILY_IDS.size,
    glottologVersion: GLOTTOLOG_VERSION,
  };

  // Build ancestry chain for any node (used for classification)
  function getAncestryChain(glottocode) {
    const chain = [];
    let cur = glottocode;
    while (cur && byId.has(cur)) {
      const row = byId.get(cur);
      chain.unshift({ glottocode: row.id, name: row.name, level: row.level });
      cur = row.parent_id || null;
    }
    return chain;
  }

  // Build tree node (3 levels deep for the JSON output)
  function buildNode(glottocode, depth = 0) {
    const row = byId.get(glottocode);
    if (!row) return null;

    const node = {
      glottocode: row.id,
      name: row.name,
      level: row.level,
    };
    if (row.iso639P3code) node.iso639_3 = row.iso639P3code;
    if (row.latitude && row.longitude) {
      node.lat = parseFloat(row.latitude);
      node.lng = parseFloat(row.longitude);
    }
    if (row.country_ids) {
      node.countries = row.country_ids.split(/\s+/).filter(Boolean);
    }
    const langCount = parseInt(row.child_language_count) || 0;
    if (langCount) node.languageCount = langCount;

    const childIds = children.get(glottocode) || [];
    if (childIds.length > 0 && depth < 3) {
      node.children = childIds
        .map(id => buildNode(id, depth + 1))
        .filter(Boolean)
        .sort((a, b) => {
          const order = { family: 0, language: 1, dialect: 2 };
          return (order[a.level] || 3) - (order[b.level] || 3) || a.name.localeCompare(b.name);
        });
      if (node.children.length === 0) delete node.children;
    } else if (childIds.length > 0) {
      node.descendantCount = childIds.length;
    }
    return node;
  }

  const tree = {
    _meta: {
      description: 'Glottolog language classification tree. Reference data only — not consumed by the translation pipeline.',
      source: GLOTTOLOG_URL,
      version: GLOTTOLOG_VERSION,
      license: GLOTTOLOG_LICENSE,
      generatedAt: new Date().toISOString(),
      notes: 'Sign language families excluded (non-textual). Bookkeeping entries excluded. Tree depth limited to 3 levels — use glottocodes to look up deeper nodes.',
      references: {
        glottolog: 'https://glottolog.org',
        wals: 'https://wals.info',
        ethnologue: 'https://www.ethnologue.com',
        iso639_3: 'https://iso639-3.sil.org',
      },
    },
    stats,
    families: topFamilies
      .sort((a, b) => (parseInt(b.child_language_count) || 0) - (parseInt(a.child_language_count) || 0))
      .map(f => buildNode(f.id)),
    isolates: isolates
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(f => buildNode(f.id)),
  };

  return { tree, byId, children, topFamilies, isolates, stats, getAncestryChain };
}

// ─── Card Enrichment (Layer 2) ─────────────────────────────────

function enrichExistingCards(byId, getAncestryChain) {
  // Build ISO 639-3 → Glottocode lookup
  // Include language-, dialect- AND family-level entries because Glottolog
  // sometimes classifies what ISO 639-3 considers a "language" as a "dialect"
  // (e.g., Norwegian Bokmål nob → norw1259 is dialect-level in Glottolog,
  // Serbian Standard srp → serb1264 is dialect-level) or as a *group*
  // (e.g., Kurdish kur → kurd1259, Dinka din → dink1262, Lenca len →
  // lenc1239 are family-level in Glottolog 5.3). Priority:
  // language > dialect > family, so a group node is only used when no
  // languoid-level match exists.
  const LEVEL_PRIORITY = { language: 3, dialect: 2, family: 1 };
  const isoToGlotto = new Map();
  const isoMatchLevel = new Map();
  for (const [gcode, row] of byId) {
    const prio = LEVEL_PRIORITY[row.level];
    if (!row.iso639P3code || !prio) continue;
    if (prio > (isoMatchLevel.get(row.iso639P3code) ?? 0)) {
      isoToGlotto.set(row.iso639P3code, gcode);
      isoMatchLevel.set(row.iso639P3code, prio);
    }
  }

  // ISO 639-3 macrolanguage → active member codes (M-table SSOT), used as
  // the last-resort classification path for scope-M hub cards whose macro
  // code has no Glottolog languoid at all (bal, bik, din, ful, …): the
  // hub's classification is DERIVED as the family-level ancestry shared by
  // the majority of its members. Stamped 'derived:' per the provenance
  // doctrine (docs/FACT_PROVENANCE_AUDIT.md) — it is a Champollion
  // derivation, not a raw Glottolog assertion.
  const MACRO_TAB = path.join(__dirname, '..', 'data', 'iso639-3', 'iso-639-3-macrolanguages.tab');
  const macroMembers = new Map();
  if (fs.existsSync(MACRO_TAB)) {
    const lines = fs.readFileSync(MACRO_TAB, 'utf-8').split('\n').filter(l => l.trim());
    const header = lines[0].split('\t');
    const mCol = header.indexOf('M_Id');
    const iCol = header.indexOf('I_Id');
    const sCol = header.indexOf('I_Status');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols[sCol]?.trim() !== 'A') continue; // active members only
      const m = cols[mCol]?.trim();
      const member = cols[iCol]?.trim();
      if (!m || !member) continue;
      if (!macroMembers.has(m)) macroMembers.set(m, []);
      macroMembers.get(m).push(member);
    }
  }

  /**
   * Family-level ancestry shared by the majority of a macrolanguage's
   * members: majority top family, then the longest common family-level
   * prefix among the agreeing members. Returns a classification block
   * (family/familyGlottocode[/genus]/ancestry) or null.
   */
  function memberDerivedClassification(members) {
    const chains = [];
    for (const m of members) {
      const g = isoToGlotto.get(m);
      if (!g) continue;
      const famChain = getAncestryChain(g).filter(n => n.level === 'family');
      if (famChain.length) chains.push(famChain);
    }
    if (chains.length === 0) return null;
    const counts = new Map();
    for (const c of chains) counts.set(c[0].glottocode, (counts.get(c[0].glottocode) || 0) + 1);
    const [topCode] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const agreeing = chains.filter(c => c[0].glottocode === topCode);
    let prefix = agreeing[0];
    for (const c of agreeing.slice(1)) {
      let i = 0;
      while (i < prefix.length && i < c.length && prefix[i].glottocode === c[i].glottocode) i++;
      prefix = prefix.slice(0, i);
    }
    if (prefix.length === 0) return null;
    const top = prefix[0];
    const genus = prefix[prefix.length - 1];
    const cls = { family: top.name, familyGlottocode: top.glottocode };
    if (genus.glottocode !== top.glottocode) {
      cls.genus = genus.name;
      cls.genusGlottocode = genus.glottocode;
    }
    cls.ancestry = prefix.map(n => n.name);
    return cls;
  }

  // Macrolanguage → "default individual" for enrichment fallback.
  // When a card uses a macrolanguage code, resolve to the standard/prestige variety
  // so we can look up its Glottolog classification.
  const MACRO_TO_INDIVIDUAL = {
    ara: 'arb',   // Modern Standard Arabic
    zho: 'cmn',   // Mandarin Chinese
    fas: 'pes',   // Iranian Persian
    msa: 'zsm',   // Standard Malay
    swa: 'swh',   // Coastal Swahili
    que: 'quz',   // Cusco Quechua (most documented)
    nor: 'nob',   // Norwegian Bokmål
    cre: 'crk',   // Plains Cree
    lav: 'lvs',   // Standard Latvian
  };

  // BCP 47 / legacy code → ISO 639-3 resolution
  const BCP47_TO_ISO = {
    nb: 'nob',    // Norwegian Bokmål
    sr: 'srp',    // Serbian (not a macrolanguage but Glottolog uses different code)
  };

  // Scan existing cards
  const cardFiles = [];
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip genera directory — those are curated
        if (entry.name !== 'genera') scan(fullPath);
      } else if (entry.name.endsWith('.json') && entry.name !== 'language-tree.json') {
        cardFiles.push(fullPath);
      }
    }
  }
  scan(CARDS_DIR);

  let enriched = 0;
  let skipped = 0;

  for (const filePath of cardFiles) {
    const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Skip family/genus cards
    if (card.type === 'family' || card.type === 'subfamily' || card.type === 'genus') {
      skipped++;
      continue;
    }

    const iso = card.iso639_3 || card.code;

    // Resolve ISO code through multiple fallback paths:
    // 1. Direct ISO → Glottocode lookup
    // 2. BCP 47 legacy code → ISO 639-3 → Glottocode
    // 3. Macrolanguage → default individual → Glottocode
    let resolvedIso = iso;
    if (BCP47_TO_ISO[iso]) resolvedIso = BCP47_TO_ISO[iso];

    let glottocode = card.glottocode || isoToGlotto.get(resolvedIso);

    // If still not found, try macrolanguage resolution
    if (!glottocode && MACRO_TO_INDIVIDUAL[resolvedIso]) {
      const individualIso = MACRO_TO_INDIVIDUAL[resolvedIso];
      glottocode = isoToGlotto.get(individualIso);
      if (glottocode) {
        console.log(`  ℹ️  ${card.code}: Resolved macrolanguage ${resolvedIso} → ${individualIso} → ${glottocode}`);
      }
    }

    // Private-use conlang cards (BCP 47 'x-' codes) are register-only
    // constructs — ISO 639-3 / Glottolog genealogy does not apply to them
    // by definition. Skip silently rather than reporting a gap.
    if (typeof card.code === 'string' && card.code.startsWith('x-')) {
      skipped++;
      continue;
    }

    let classification = null;
    let derivedFromMembers = false;

    // Both spellings: pre-cutover cards carry the registry letter 'M', atlas
    // cards carry the legible word (same precedent as lint-language-cards).
    if (!glottocode && (card.isoScope === 'M' || card.isoScope === 'Macrolanguage')
        && macroMembers.has(iso)) {
      // Macrolanguage hub with no Glottolog languoid of its own — derive
      // the classification shared by its active members (see above).
      classification = memberDerivedClassification(macroMembers.get(iso));
      derivedFromMembers = classification != null;
      if (!classification) {
        console.log(`  ⚠️  ${card.code}: No Glottocode and no classifiable members (iso=${iso})`);
        skipped++;
        continue;
      }
    } else if (!glottocode) {
      console.log(`  ⚠️  ${card.code}: No Glottocode found (iso=${iso})`);
      skipped++;
      continue;
    } else {
      const row = byId.get(glottocode);
      if (!row) {
        console.log(`  ⚠️  ${card.code}: Glottocode ${glottocode} not in Glottolog data`);
        skipped++;
        continue;
      }

      // Build classification from ancestry chain
      const chain = getAncestryChain(glottocode);
      const topFamily = chain.find(n => n.level === 'family');

      // Find "genus" — the lowest family-level node in the chain
      // (the one closest to the language). This approximates WALS genus.
      const familyNodes = chain.filter(n => n.level === 'family');
      const genus = familyNodes.length > 0 ? familyNodes[familyNodes.length - 1] : null;

      // Build classification block
      classification = {};
      if (topFamily && HOUSEKEEPING_BUCKETS[topFamily.glottocode]) {
        // Housekeeping bucket → honest no-family block (see the map's doc
        // comment above). A bucket must never surface as a family.
        classification = bucketClassification(topFamily.glottocode);
      } else if (topFamily) {
        classification.family = topFamily.name;
        classification.familyGlottocode = topFamily.glottocode;
        if (genus && genus.glottocode !== topFamily.glottocode) {
          classification.genus = genus.name;
          classification.genusGlottocode = genus.glottocode;
        }
        // Build full ancestry path for reference
        classification.ancestry = familyNodes.map(n => n.name);
      } else if (chain.length > 0) {
        // No family-level ancestor at all → Glottolog top-level language,
        // i.e. a language isolate. Follow the established card convention
        // (see eus.json): family 'Language isolate', the languoid itself
        // as the genus, and an explicit '(isolate)' ancestry entry.
        const top = chain[0];
        classification.family = 'Language isolate';
        classification.familyGlottocode = top.glottocode;
        classification.genus = top.name;
        classification.genusGlottocode = top.glottocode;
        classification.ancestry = [`${top.name} (isolate)`];
      }
    }

    // Add fields to card
    let modified = false;

    if (!card.glottocode && glottocode) {
      card.glottocode = glottocode;
      modified = true;
    }

    // Repair fabricated glottocode references before merging: a
    // classification glottocode that does not exist in Glottolog at all
    // (e.g. uzb.json's 'karlu1236') is a data bug — drop it so the
    // computed value (when available) can take its place.
    if (card.classification) {
      for (const key of ['familyGlottocode', 'genusGlottocode']) {
        const v = card.classification[key];
        if (v != null && !byId.has(v)) {
          console.log(`  🧹 ${card.code}: dropping ${key}='${v}' (not a Glottolog languoid)`);
          delete card.classification[key];
          modified = true;
        }
      }
    }

    // Repair housekeeping pseudo-families before merging: the historical
    // enrichment wrote Glottolog's housekeeping buckets as if they were real
    // families ("family": "Bookkeeping", "Unclassifiable", …). Drop the
    // tainted block so the computed classification takes its place — the
    // honest no-family block for languoids Glottolog still files under a
    // bucket, or a real family if a Glottolog upgrade has since classified
    // the entry.
    if (card.classification &&
        (HOUSEKEEPING_BUCKET_NAMES.has(card.classification.family) ||
         HOUSEKEEPING_BUCKETS[card.classification.familyGlottocode])) {
      const label = card.classification.family || card.classification.familyGlottocode;
      console.log(`  🧹 ${card.code}: '${label}' is a Glottolog housekeeping bucket, not a family — reclassifying`);
      card.classification = null;
      modified = true;
    }

    if (!card.classification) {
      card.classification = classification;
      modified = true;
    } else if (derivedFromMembers) {
      // Hub cards with no Glottolog languoid of their own: the member
      // derivation is the ONLY verifiable source here, so it replaces any
      // partial/legacy block wholesale — mixing legacy names with derived
      // glottocodes would produce incoherent pairs (e.g. uzb's fabricated
      // 'karlu1236').
      if (JSON.stringify(card.classification) !== JSON.stringify(classification)) {
        card.classification = classification;
        modified = true;
      }
    } else {
      // Merge-fill: complete existing classification blocks that are
      // missing fields (the historical enrichment only wrote the block
      // when absent, leaving e.g. `{ ancestry: [] }` stubs on isolates).
      // The genus name + glottocode are filled as an ATOMIC PAIR: filling
      // a code next to a pre-existing curated name (or vice versa) could
      // pair values that describe different nodes.
      for (const key of ['family', 'familyGlottocode']) {
        if (card.classification[key] == null && classification[key] != null) {
          card.classification[key] = classification[key];
          modified = true;
        }
      }
      if (card.classification.genus == null && card.classification.genusGlottocode == null &&
          classification.genus != null) {
        card.classification.genus = classification.genus;
        card.classification.genusGlottocode = classification.genusGlottocode;
        modified = true;
      }
      if ((!Array.isArray(card.classification.ancestry) || card.classification.ancestry.length === 0) &&
          Array.isArray(classification.ancestry) && classification.ancestry.length > 0) {
        card.classification.ancestry = classification.ancestry;
        modified = true;
      }
    }

    // Member-derived hub classifications carry derivation provenance,
    // never a bare upstream name (docs/FACT_PROVENANCE_AUDIT.md).
    if (derivedFromMembers && modified) {
      if (!card._fieldSources) card._fieldSources = {};
      card._fieldSources.classification =
        `derived:glottolog-${GLOTTOLOG_VERSION}+iso639-3-macrolanguages`;
    }

    // Add macrolanguage if applicable
    if (!card.macrolanguage && MACROLANGUAGE_MAP[iso]) {
      card.macrolanguage = MACROLANGUAGE_MAP[iso];
      modified = true;
    }

    // Add dataSources tracking
    if (!card.dataSources) {
      card.dataSources = [`glottolog-${GLOTTOLOG_VERSION}`];
      modified = true;
    } else if (!card.dataSources.includes(`glottolog-${GLOTTOLOG_VERSION}`)) {
      card.dataSources.push(`glottolog-${GLOTTOLOG_VERSION}`);
      modified = true;
    }

    if (modified) {
      const familyLabel = classification.family ||
        (classification.glottologBucket
          ? `(none — Glottolog '${HOUSEKEEPING_BUCKETS[classification.glottologBucket].name}' bucket)`
          : '(isolate)');
      if (dryRun) {
        console.log(`  🔍 Would enrich ${card.code}: family=${familyLabel}, genus=${classification.genus || '—'}`);
      } else {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
        console.log(`  ✅ ${card.code}: family=${familyLabel}, genus=${classification.genus || '—'}`);
      }
      enriched++;
    } else {
      skipped++;
    }
  }

  return { enriched, skipped };
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Champollion Language Tree Builder');
  console.log(`  Source: Glottolog ${GLOTTOLOG_VERSION} (${GLOTTOLOG_LICENSE})`);
  console.log('  Architecture: Three-layer (tree + identity + genus)');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('Loading Glottolog languoid.csv...');
  const rows = await loadGlottologCSV();
  console.log(`  Loaded ${rows.length} entries\n`);

  console.log('Building language tree...');
  const { tree, byId, children, topFamilies, isolates, stats, getAncestryChain } = buildTree(rows);

  // Print stats
  console.log('\n  STATISTICS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Total languoids:       ${stats.totalEntries.toLocaleString()}`);
  console.log(`  Families (all levels): ${stats.families.toLocaleString()}`);
  console.log(`  Languages:             ${stats.languages.toLocaleString()}`);
  console.log(`  Dialects:              ${stats.dialects.toLocaleString()}`);
  console.log(`  Top-level families:    ${stats.topFamilies}`);
  console.log(`  Language isolates:     ${stats.isolates}`);
  console.log(`  With ISO 639-3:        ${stats.withIso639.toLocaleString()}`);
  console.log(`  Sign families excl.:   ${stats.signLanguagesExcluded}`);

  // Top 20 families
  console.log('\n  TOP 20 LANGUAGE FAMILIES:');
  console.log('  ─────────────────────────────────────────────────');
  const sorted = [...topFamilies]
    .sort((a, b) => (parseInt(b.child_language_count) || 0) - (parseInt(a.child_language_count) || 0))
    .slice(0, 20);
  for (const f of sorted) {
    const langs = parseInt(f.child_language_count) || 0;
    console.log(`  ${f.name.padEnd(35)} ${String(langs).padStart(5)} langs  [${f.id}]`);
  }

  if (statsOnly) {
    console.log('\n  (--stats-only mode, stopping here)');
    return;
  }

  // Layer 1: Write language-tree.json
  if (!dryRun) {
    fs.writeFileSync(TREE_OUTPUT, JSON.stringify(tree, null, 2) + '\n', 'utf-8');
    const sizeMB = (fs.statSync(TREE_OUTPUT).size / 1024 / 1024).toFixed(1);
    console.log(`\n  ✅ Layer 1: language-tree.json written (${sizeMB} MB)`);
  } else {
    console.log('\n  🔍 Layer 1: [DRY RUN] Would write language-tree.json');
  }

  // Layer 2: Enrich existing cards
  if (enrichCards) {
    console.log('\n  Enriching existing cards with classification data...');
    const { enriched, skipped } = enrichExistingCards(byId, getAncestryChain);
    console.log(`\n  Layer 2: ${enriched} cards enriched, ${skipped} skipped`);
  } else {
    console.log('\n  Layer 2: Skipped (run with --enrich to add classification to cards)');
  }

  // Layer 3 reminder
  console.log('\n  Layer 3: Genus cards are curated manually, not auto-generated.');
  console.log('  Create genus cards in shared/language-cards/genera/ as needed.');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  DONE');
  if (dryRun) console.log('  (Dry run — no files were written)');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
