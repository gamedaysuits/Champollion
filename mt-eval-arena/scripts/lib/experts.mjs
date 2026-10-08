/**
 * experts.mjs — the WHO-to-contact index, derived at STAGING time from a
 * NORMALIZED card.
 *
 * Ported from cli/scripts/derive-experts.mjs, which read cards raw and wrote
 * experts[] back INTO the card files — forbidden post-cutover (cards are
 * build output). The rules are the same fact-based derivations; the field
 * reads speak the atlas card shape (resources.fsts entries carry
 * {name, url, publisher, license}, not install.repo). Rules whose source
 * fields do not exist on atlas cards (digitalPresence, archivePresence,
 * encyclopedic.resources) simply never fire — no rule invents an entry.
 * Every entry carries a `source` naming the card field it came from.
 */

import fs from 'node:fs';
import path from 'node:path';

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

const OPUS = {
  name: 'OPUS',
  type: 'project',
  affiliation: null,
  role: 'corpus host',
  url: 'https://opus.nlpl.eu/',
};

const TATOEBA = {
  name: 'Tatoeba Project',
  type: 'community_org',
  affiliation: null,
  role: 'corpus publisher',
  url: 'https://tatoeba.org/',
};

// Exact-match classification for maintainer strings that appear in card
// data, with the same heuristic fallback as the original derivation.
const MAINTAINER_CLASSIFICATIONS = {
  'Apertium community': { name: 'Apertium community', type: 'project', affiliation: null },
  'Annette Rios (University of Zurich)': { name: 'Annette Rios', type: 'researcher', affiliation: 'University of Zurich' },
  'Michael Gasser (Indiana University)': { name: 'Michael Gasser', type: 'researcher', affiliation: 'Indiana University' },
  'UiT Tromsø / Divvun': { name: 'UiT Tromsø / Divvun', type: 'institution', affiliation: 'UiT The Arctic University of Norway' },
  'Irínlọ́wú (David Adelani et al.)': { name: 'Irínlọ́wú (David Adelani et al.)', type: 'project', affiliation: null },
  'Niger-Volta Language Technologies Institute': { name: 'Niger-Volta Language Technologies Institute', type: 'institution', affiliation: null },
};

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

/** dataset id → {publisher, url} from the corpora-cards register. */
export function loadCorporaCardPublishers(corporaDir) {
  const map = new Map();
  if (!corporaDir || !fs.existsSync(corporaDir)) return map;
  for (const f of fs.readdirSync(corporaDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const card = JSON.parse(fs.readFileSync(path.join(corporaDir, f), 'utf-8'));
      if (card.id && card.source?.publisher) {
        map.set(card.id, { publisher: card.source.publisher, url: card.source.url || null });
      }
    } catch { /* skip unparseable */ }
  }
  return map;
}

/**
 * All expert entries for one normalized card (config-merged view supplies
 * evalDatasets). Returns [] when no rule matches — nothing is invented.
 */
export function deriveExperts(card, { evalDatasets = [], corporaPublishers } = {}) {
  const entries = [];
  const seen = new Set();

  function emit(base, source) {
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
  }

  const res = (card.resources && !Array.isArray(card.resources)) ? card.resources : {};

  // FSTs — publishers and named maintainers. Atlas fst entries carry
  // {name, url, publisher, maintainer?}.
  for (const fst of res.fsts || []) {
    const publisher = String(fst?.publisher ?? '').toLowerCase();
    const urlOwner = ((fst?.url || '').match(/github\.com\/([^/]+)/)?.[1] || '').toLowerCase();
    if (publisher === 'giellalt' || urlOwner === 'giellalt') {
      emit(GIELLALT, `resources.fsts[${fst.name}].publisher=giellalt`);
    } else if (publisher === 'apertium' || urlOwner === 'apertium') {
      emit(APERTIUM, `resources.fsts[${fst.name}].publisher=apertium`);
    }
    if (fst?.maintainer) {
      const cls = classifyMaintainer(fst.maintainer);
      emit({ ...cls, role: 'FST maintainer', url: fst.url || null },
        `resources.fsts[${fst.name}].maintainer`);
    }
  }

  // Corpora — OPUS-hosted parallel corpora and Tatoeba.
  const corpora = Array.isArray(res.corpora) ? res.corpora : [];
  if (corpora.some((c) => /^corpus:opus:/.test(String(c?.corpusId ?? '')) || /opus\.nlpl\.eu/i.test(String(c?.url ?? '')))) {
    emit(OPUS, 'resources.corpora (OPUS-hosted)');
  }
  const tatoebaHit = corpora.find((c) => /tatoeba/i.test(JSON.stringify(c ?? '')));
  if (tatoebaHit) {
    emit(TATOEBA, `resources.corpora[${tatoebaHit.corpus ?? tatoebaHit.corpusId ?? 'tatoeba'}]`);
  }

  // Corpus publishers from linked corpora-cards (evalDatasets rides the
  // config lane — card-config.json via getLanguageCard).
  for (const dsId of evalDatasets || []) {
    const pub = corporaPublishers?.get(dsId);
    if (!pub) continue;
    emit({
      name: pub.publisher,
      type: 'project',
      affiliation: null,
      role: 'corpus publisher',
      url: pub.url,
    }, `evalDatasets[${dsId}] → corpora-cards/${dsId}.json source.publisher`);
  }

  // Stable order so re-runs produce byte-identical output.
  entries.sort((a, b) => a.type.localeCompare(b.type)
    || a.name.localeCompare(b.name)
    || a.role.localeCompare(b.role));
  return entries;
}
