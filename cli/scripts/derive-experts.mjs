#!/usr/bin/env node

/**
 * derive-experts.mjs
 * ────────────────────────────────────────────────────────────────
 * Populates the `experts` field — the WHO-to-contact index for each
 * language card. Every entry is DERIVED from data already present in
 * the repo: a resource the card cites, an FST maintainer it names, a
 * corpus publisher from corpora-cards. Nothing is invented; every
 * entry carries a `source` field naming the card field/resource it
 * was derived from.
 *
 * Derivation rules (each verified to match real card data):
 *
 *   1. giellalt-fst        resources.fsts[].install.repo owner 'giellalt'
 *                          → GiellaLT (UiT The Arctic University of Norway)
 *   2. apertium-fst        FST repo owner 'apertium' → Apertium project
 *   3. fst-maintainer      resources.fsts[].maintainer named on the card
 *                          → entry verbatim (classified via exact-match table)
 *   4. foundations         encyclopedic.resources.foundations[] → institution
 *   5. altlab-dictionary   dictionary hosted on *.altlab.app / altlab.* →
 *                          ALTLab (University of Alberta) + Arok Wolvengrey
 *                          (dictionary author — named in
 *                          the crk-translate project's dictionary LICENSE_NOTICE.md)
 *   6. commonvoice         digitalPresence.commonVoice → Mozilla Common Voice
 *   7. tatoeba             digitalPresence.tatoeba.sentences > 0 → Tatoeba Project
 *   8. paradisec           archivePresence.paradisec.itemCount > 0 → PARADISEC
 *   9. opus-corpus         resources.corpora[] naming OPUS → OPUS (opus.nlpl.eu)
 *  10. nllb                resources.corpora/models[] naming NLLB-200
 *                          → Meta AI (NLLB Team)
 *  11. helsinki-nlp        resources.models[] naming Helsinki-NLP / opus-mt
 *                          → Helsinki-NLP (University of Helsinki)
 *  12. ai4bharat           resources.models[] naming AI4Bharat / IndicTrans
 *                          → AI4Bharat
 *  13. corpora-card-publisher  evalDatasets[] → corpora-cards/<id>.json
 *                          source.publisher → corpus publisher entry
 *
 * Idempotent: the experts array is fully regenerated from the rules on
 * every run (derived-only field — manual curation belongs in the
 * underlying cited resources, not here). Re-running never duplicates.
 *
 * Usage:
 *   node scripts/derive-experts.mjs
 *   node scripts/derive-experts.mjs --dry-run
 *   node scripts/derive-experts.mjs --lang crk
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const CORPORA_DIR = path.join(CLI_ROOT, 'shared', 'corpora-cards');
const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Known-organization entries (institutional derivations) ────
// Only orgs whose identifying pattern (repo owner, URL, resource name)
// actually appears in card data. Affiliations are public professional
// info about the named org — never guessed for individuals.

const GIELLALT = {
  name: 'GiellaLT',
  type: 'project',
  affiliation: 'UiT The Arctic University of Norway',
  role: 'FST maintainer',
  url: 'https://giellalt.github.io/',
};

const APERTIUM = {
  name: 'Apertium',
  type: 'project',
  affiliation: null,
  role: 'FST maintainer',
  url: 'https://www.apertium.org/',
};

const ALTLAB = {
  name: 'ALTLab (Alberta Language Technology Lab)',
  type: 'institution',
  affiliation: 'University of Alberta',
  role: 'dictionary host',
  url: 'https://altlab.ualberta.ca/',
};

// Named in the crk-translate project's dictionary LICENSE_NOTICE.md as the
// author of "nêhiyawêwin: itwêwina / Cree: Words" (the CW source served by
// the itwêwina dictionary API). Individual researcher names are only added
// when the repo itself names them — this is the one such case today.
const WOLVENGREY = {
  name: 'Arok Wolvengrey',
  type: 'researcher',
  affiliation: null, // not stated in repo data — never guessed
  role: 'dictionary author',
  url: null,
};

const COMMON_VOICE = {
  name: 'Mozilla Common Voice',
  type: 'project',
  affiliation: 'Mozilla Foundation',
  role: 'speech corpus publisher',
  url: 'https://commonvoice.mozilla.org/',
};

const TATOEBA = {
  name: 'Tatoeba Project',
  type: 'community_org',
  affiliation: null,
  role: 'corpus publisher',
  url: 'https://tatoeba.org/',
};

const PARADISEC = {
  name: 'PARADISEC',
  type: 'institution',
  affiliation: null,
  role: 'language archive',
  url: 'https://www.paradisec.org.au/',
};

const OPUS = {
  name: 'OPUS',
  type: 'project',
  affiliation: null,
  role: 'corpus host',
  url: 'https://opus.nlpl.eu/',
};

const NLLB = {
  name: 'Meta AI (NLLB Team)',
  type: 'project',
  affiliation: 'Meta AI',
  role: 'MT model publisher',
  url: 'https://github.com/facebookresearch/fairseq/tree/nllb',
};

const HELSINKI_NLP = {
  name: 'Helsinki-NLP',
  type: 'project',
  affiliation: 'University of Helsinki',
  role: 'MT model publisher',
  url: 'https://huggingface.co/Helsinki-NLP',
};

const AI4BHARAT = {
  name: 'AI4Bharat',
  type: 'project',
  affiliation: 'IIT Madras',
  role: 'MT model publisher',
  url: 'https://ai4bharat.iitm.ac.in/',
};

// ─── FST maintainer classification ─────────────────────────────
// Exact-match table for every maintainer string that appears in card
// data today. The string is taken verbatim from the card; this table
// only assigns the entry `type` (and splits name/affiliation where the
// card itself encodes "Name (Affiliation)").
const MAINTAINER_CLASSIFICATIONS = {
  'Apertium community': { name: 'Apertium community', type: 'project', affiliation: null },
  'Annette Rios (University of Zurich)': { name: 'Annette Rios', type: 'researcher', affiliation: 'University of Zurich' },
  'Michael Gasser (Indiana University)': { name: 'Michael Gasser', type: 'researcher', affiliation: 'Indiana University' },
  'UiT Tromsø / Divvun': { name: 'UiT Tromsø / Divvun', type: 'institution', affiliation: 'UiT The Arctic University of Norway' },
  'Irínlọ́wú (David Adelani et al.)': { name: 'Irínlọ́wú (David Adelani et al.)', type: 'project', affiliation: null },
  'Niger-Volta Language Technologies Institute': { name: 'Niger-Volta Language Technologies Institute', type: 'institution', affiliation: null },
};

/**
 * Classify an unmapped maintainer string (future-proofing — every
 * value in today's data has an exact entry above). Heuristic only:
 * "Name (Affiliation)" → researcher, org keywords → institution,
 * otherwise project.
 */
function classifyMaintainer(maintainer) {
  if (MAINTAINER_CLASSIFICATIONS[maintainer]) return MAINTAINER_CLASSIFICATIONS[maintainer];
  const m = maintainer.match(/^(.+?)\s*\((.+)\)$/);
  if (m && !/et al\.?|community|project|team/i.test(m[2])) {
    return { name: m[1], type: 'researcher', affiliation: m[2] };
  }
  if (/institute|university|academy|laborator|\blab\b|center|centre|council/i.test(maintainer)) {
    return { name: maintainer, type: 'institution', affiliation: null };
  }
  return { name: maintainer, type: 'project', affiliation: null };
}

// ─── Foundation type overrides ─────────────────────────────────
// encyclopedic.resources.foundations[] entries default to 'institution'
// (language academies, councils, university labs). Exact-name overrides
// for entries that are community organizations rather than formal
// institutions.
const FOUNDATION_TYPE_OVERRIDES = {
  'Save the Ifugao Terraces Movement (SITMo)': 'community_org',
};

// ─── Corpora-card lookup (for evalDatasets → publisher) ────────

function loadCorporaCardPublishers() {
  const map = new Map(); // dataset id → { publisher, url }
  if (!fs.existsSync(CORPORA_DIR)) return map;
  for (const f of fs.readdirSync(CORPORA_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const card = JSON.parse(fs.readFileSync(path.join(CORPORA_DIR, f), 'utf-8'));
      if (card.id && card.source?.publisher) {
        map.set(card.id, { publisher: card.source.publisher, url: card.source.url || null });
      }
    } catch { /* skip unparseable */ }
  }
  return map;
}

// ─── Derivation ────────────────────────────────────────────────

/**
 * Derive all expert entries for one card. Returns an array of entries
 * (possibly empty). Each entry: { name, type, affiliation, role, url,
 * orcid, source }. `hits` is a per-rule counter map that gets bumped
 * once per emitted entry.
 */
function deriveExperts(card, corporaPublishers, hits) {
  const entries = [];
  const seen = new Set(); // dedupe key: name + role (lowercased)

  function emit(ruleId, base, source) {
    const key = `${base.name.toLowerCase()}|${base.role.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      name: base.name,
      type: base.type,
      affiliation: base.affiliation ?? null,
      role: base.role,
      url: base.url ?? null,
      orcid: base.orcid ?? null,
      source,
    });
    hits[ruleId] = (hits[ruleId] || 0) + 1;
  }

  const res = (card.resources && !Array.isArray(card.resources)) ? card.resources : {};

  // Rules 1–3: FSTs — repo owners and named maintainers
  for (const fst of res.fsts || []) {
    const repo = fst.install?.repo || '';
    const repoOwner = repo.includes('/')
      ? repo.split('/')[0].toLowerCase()
      : ((fst.url || '').match(/github\.com\/([^/]+)/)?.[1] || '').toLowerCase();

    if (repoOwner === 'giellalt') {
      emit('giellalt-fst', GIELLALT, `resources.fsts[${fst.name}].install.repo=${repo || fst.url}`);
    } else if (repoOwner === 'apertium') {
      emit('apertium-fst', APERTIUM, `resources.fsts[${fst.name}].${repo ? `install.repo=${repo}` : `url=${fst.url}`}`);
    }

    if (fst.maintainer) {
      const cls = classifyMaintainer(fst.maintainer);
      emit('fst-maintainer', { ...cls, role: 'FST maintainer', url: fst.url || null },
        `resources.fsts[${fst.name}].maintainer`);
    }
  }

  // Rule 4: cited foundations / language authorities
  for (const fo of card.encyclopedic?.resources?.foundations || []) {
    if (!fo?.name) continue;
    emit('foundations', {
      name: fo.name,
      type: FOUNDATION_TYPE_OVERRIDES[fo.name] || 'institution',
      affiliation: null,
      role: 'language authority / foundation',
      url: fo.url || null,
    }, 'encyclopedic.resources.foundations');
  }

  // Rule 5: ALTLab-hosted dictionaries (itwêwina)
  for (const dict of card.encyclopedic?.resources?.dictionaries || []) {
    const url = dict?.url || '';
    if (/altlab\.(app|artsrn\.ualberta\.ca)/i.test(url)) {
      emit('altlab-dictionary', ALTLAB, `encyclopedic.resources.dictionaries[${dict.name}]`);
      emit('altlab-dictionary', WOLVENGREY,
        `encyclopedic.resources.dictionaries[${dict.name}] (author named in the crk-translate project's dictionary LICENSE_NOTICE.md)`);
    }
  }

  // Rule 6: Common Voice speech data
  if (card.digitalPresence?.commonVoice) {
    const src = card.digitalPresence.commonVoice.source || 'common-voice';
    emit('commonvoice', COMMON_VOICE, `digitalPresence.commonVoice (${src})`);
  }

  // Rule 7: Tatoeba sentence data
  if (card.digitalPresence?.tatoeba?.sentences > 0) {
    emit('tatoeba', TATOEBA, 'digitalPresence.tatoeba');
  }

  // Rule 8: PARADISEC archive holdings
  if (card.archivePresence?.paradisec?.itemCount > 0) {
    emit('paradisec', PARADISEC, 'archivePresence.paradisec');
  }

  // Rules 9–10: corpora naming OPUS / NLLB
  for (const co of res.corpora || []) {
    const name = co?.name || '';
    if (/^OPUS\b/i.test(name) || /opus\.nlpl\.eu/i.test(co?.url || '')) {
      emit('opus-corpus', OPUS, `resources.corpora[${name}]`);
    }
    if (/NLLB/i.test(name)) {
      emit('nllb', NLLB, `resources.corpora[${name}]`);
    }
  }

  // Rules 10–12: models naming NLLB / Helsinki-NLP / AI4Bharat
  for (const model of res.models || []) {
    const name = model?.name || '';
    const url = model?.url || '';
    if (/NLLB/i.test(name)) {
      emit('nllb', NLLB, `resources.models[${name}]`);
    }
    if (/Helsinki-NLP/i.test(name) || /Helsinki-NLP/i.test(url) || /\bopus-mt\b/i.test(name)) {
      emit('helsinki-nlp', HELSINKI_NLP, `resources.models[${name}]`);
    }
    if (/AI4Bharat|IndicTrans/i.test(name)) {
      emit('ai4bharat', AI4BHARAT, `resources.models[${name}]`);
    }
  }

  // Rule 13: corpus publishers from linked corpora-cards
  for (const dsId of card.evalDatasets || []) {
    const pub = corporaPublishers.get(dsId);
    if (!pub) continue;
    emit('corpora-card-publisher', {
      name: pub.publisher,
      type: 'project',
      affiliation: null,
      role: 'corpus publisher',
      url: pub.url,
    }, `evalDatasets[${dsId}] → corpora-cards/${dsId}.json source.publisher`);
  }

  // Stable order so re-runs produce byte-identical output
  entries.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name) || a.role.localeCompare(b.role));
  return entries;
}

// ─── Main ──────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Experts & Institutions Derivation (fact-based index)');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const corporaPublishers = loadCorporaCardPublishers();
  console.log(`  Corpora-card publishers loaded: ${corporaPublishers.size}`);

  let cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');
  if (SINGLE_LANG) {
    cardFiles = cardFiles.filter(f => f === `${SINGLE_LANG}.json`);
    if (cardFiles.length === 0) {
      console.error(`  Language '${SINGLE_LANG}' not found.`);
      process.exit(1);
    }
  }

  const hits = {};
  let enriched = 0;
  let cleared = 0;
  let totalEntries = 0;

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    const experts = deriveExperts(card, corporaPublishers, hits);
    // Change detection must cover the provenance stamp too — otherwise a run
    // that only needs to (re)write _fieldSources.experts is never persisted.
    const before = JSON.stringify([card.experts ?? null, card._fieldSources?.experts ?? null]);

    if (experts.length > 0) {
      card.experts = experts;
      if (!card._fieldSources) card._fieldSources = {};
      card._fieldSources.experts = 'derived-from-cited-resources';
      enriched++;
      totalEntries += experts.length;
    } else if ('experts' in card) {
      // Derived-only field: drop stale entries when no rule matches anymore
      delete card.experts;
      if (card._fieldSources?.experts) delete card._fieldSources.experts;
      cleared++;
    }

    const after = JSON.stringify([card.experts ?? null, card._fieldSources?.experts ?? null]);
    if (!DRY_RUN && before !== after) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  console.log('\n  PER-RULE HIT COUNTS (entries emitted):');
  console.log('  ─────────────────────────────────────');
  for (const [rule, count] of Object.entries(hits).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule.padEnd(26)} ${count.toLocaleString()}`);
  }

  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards scanned:    ${cardFiles.length.toLocaleString()}`);
  console.log(`  Cards enriched:   ${enriched.toLocaleString()}`);
  console.log(`  Stale cleared:    ${cleared.toLocaleString()}`);
  console.log(`  Expert entries:   ${totalEntries.toLocaleString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
