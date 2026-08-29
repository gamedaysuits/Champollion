# Language Card Enrichment Pipeline

> **Run order matters.** Scripts must run in the order listed below.
> Each step adds data that subsequent steps may depend on.

---

## Overview

The enrichment pipeline populates the ~8,000 language cards with data from
external authoritative sources. It operates on a **merge-only** principle:
scripts add data but never overwrite existing curated values.

**Every piece of data must carry its source.** The pipeline ensures provenance
at three levels:
1. **`dataSources` array** — card-level list of databases consulted
2. **Inline `source` / `_sources` fields** — per-field attribution within nested objects
3. **`_fieldSources` map** — top-level summary mapping each field to its provenance

```
generate-all-cards.mjs            ← Create initial card skeletons
        ↓
conform-cards-to-spec.mjs         ← Ensure all 47 canonical fields exist
        ↓
enrich-cards-bulk.mjs             ← Glottolog AES + CLDF + Wikidata SPARQL
        ↓
enrich-cards-from-cldr.mjs        ← CLDR typography, plurals, capitalization
        ↓
enrich-from-typology.mjs          ← WALS + Grambank typological features
        ↓
enrich-from-linguameta-phoible.mjs ← LinguaMeta metadata + PHOIBLE phonology
        ↓
enrich-vitality-from-linguameta.mjs ← UNESCO-aligned endangerment statuses
        ↓
enrich-alternate-names.mjs        ← Cross-source name collection
        ↓
enrich-contact-influences.mjs     ← Curated contact history (40+ languages)
        ↓
derive-card-fields.mjs            ← Derive dir, macroarea, supportTier
        ↓
fix-source-attribution.mjs        ← Backfill inline source on older data
        ↓
stamp-field-sources.mjs           ← Generate per-field _fieldSources map
        ↓
lint-language-cards.mjs           ← Validate everything
```

---

## Script Reference

### 0. The 2026-07-12 card-schema additions (forge/DESIGN.md §7, F5)

Four generators populate the schematized resource/convention fields. They run
AFTER the main chain above (they read its outputs) and BEFORE
`stamp-field-sources.mjs` / `lint-language-cards.mjs`. All are idempotent,
support `--dry-run` / `--lang <code>`, own their fields wholesale (they remove
values their inputs no longer support), and skip nothing silently.

```
cleanup-resources.mjs                  ← legacy array resources → keyed object
        ↓                                (prereq for the two resources.* fields)
derive-dictionaries.mjs                ← resources.dictionaries[]  (promotes
        ↓                                encyclopedic.resources.dictionaries +
        ↓                                Lexibank resources.lexical; flags from
        ↓                                shared/curated-dictionary-flags.json)
download-glottolog-grammar-sources.mjs ← fetch pinned glottolog-cldf v5.3
        ↓                                values.csv + sources.bib (~60 MB,
        ↓                                gitignored under data/glottolog/)
enrich-grammars-from-glottolog.mjs     ← resources.grammars[]  (MED citation
        ↓                                records, hhtype grammar/grammar_sketch
        ↓                                only, ≤3 per language)
derive-orthographies.mjs               ← orthographies[]  (scripts[] + status +
        ↓                                shared/curated-orthography-conventions.json)
derive-morphological-synthesis.mjs     ← typologicalProfile.morphologicalSynthesis
                                         (on-card WALS 22A/26A + cited prose;
                                          conflicts → absent; lint R6 enforced)
```

After running, regenerate the fallback bundle (`npm run build:fallback`) —
`test/card-fetch.test.js` gates on its freshness.

### 1. `generate-all-cards.mjs`
**Purpose:** Creates one card per ISO 639-3 code from the SIL registry + Glottolog.
**Run when:** Setting up the card corpus from scratch.
**Idempotent:** No — will overwrite existing cards. Use with caution.
**Source cited:** `iso639-3-2024`, `glottolog-5.3`

```bash
node scripts/generate-all-cards.mjs
```

### 2. `conform-cards-to-spec.mjs`
**Purpose:** Ensures every card has the canonical 47-field shape from `language-card-spec.md`.
Adds missing fields with null/[] defaults. Never changes existing values.
**Run when:** After any schema change or before a release.
**Idempotent:** Yes.

```bash
node scripts/conform-cards-to-spec.mjs              # all cards
node scripts/conform-cards-to-spec.mjs --dry-run     # preview only
node scripts/conform-cards-to-spec.mjs --lang crk    # single card
```

### 3. `enrich-cards-bulk.mjs`
**Purpose:** Enriches cards from three data sources: Glottolog AES (endangerment),
Glottolog CLDF (macroarea, isolate status, documentation dates), and Wikidata SPARQL
(native names, speaker estimates, script codes).
**Run when:** After conformance, or when refreshing from upstream sources.
**Idempotent:** Yes — merge-only, never overwrites.
**Source cited:** `glottolog-aes-5.3`, `glottolog-cldf-5.3`, `wikidata`

```bash
node scripts/enrich-cards-bulk.mjs --source aes       # Glottolog AES endangerment
node scripts/enrich-cards-bulk.mjs --source cldf      # Glottolog CLDF metadata
node scripts/enrich-cards-bulk.mjs --source wikidata  # Wikidata SPARQL (slow: ~5 min)
node scripts/enrich-cards-bulk.mjs                    # All three in sequence
```

**Data files:**
- `data/glottolog/aes-values.csv` — AES endangerment classifications.
  Generated by `derive-aes-values.mjs` from the pinned glottolog-cldf v5.3
  values table (`download-glottolog-med.mjs` fetches it). AES comments are
  multi-line quoted CSV — always parse this file through
  `scripts/lib/csv.mjs`, never line-by-line.
- `data/glottolog/languoid.csv` — Language metadata and coordinates
- `data/glottolog/cldf-languages.csv` — CLDF metadata (macroarea, isolate, dates);
  downloaded (with integrity checks) by `download-glottolog-med.mjs`
- Wikidata SPARQL endpoint — Native names (P1705), speaker counts (P1098), scripts (P282)

### 4. `enrich-cards-from-cldr.mjs`
**Purpose:** Populates `rules` (typography, plurals, capitalization) from Unicode CLDR data.
**Run when:** After bulk enrichment, or when CLDR is updated.
**Idempotent:** Yes.
**Source cited:** `cldr-{version}`
**Requires:** `npm install cldr-core cldr-misc-full` (peer dependencies, not shipped).

```bash
node scripts/enrich-cards-from-cldr.mjs
```

### 5. `enrich-from-typology.mjs` *(NEW)*
**Purpose:** Populates `linguisticChallenges` and `encyclopedic.typology` from WALS
(144 features, 2,442 languages) and Grambank (195 features, 2,326 languages).
**Run when:** After bulk enrichment. Safe to re-run.
**Idempotent:** Yes — merge-only.
**Source cited:** `wals-2024`, `grambank-1.0.3` (embedded inline in challenge text
and as `_sources` on the typology profile)

```bash
node scripts/enrich-from-typology.mjs              # all cards
node scripts/enrich-from-typology.mjs --dry-run    # preview
node scripts/enrich-from-typology.mjs --lang crk   # single card
```

**Data files:**
- `data/wals/values.csv`, `languages.csv`, `codes.csv`, `parameters.csv`
  Source: https://github.com/cldf-datasets/wals — CC BY 4.0
- `data/grambank/values.csv`, `languages.csv`, `codes.csv`, `parameters.csv`
  Source: https://github.com/grambank/grambank v1.0.3 — CC BY 4.0

### 6. `enrich-from-linguameta-phoible.mjs` *(NEW)*
**Purpose:** Enriches from two sources:
- **LinguaMeta** (Google Research, 7,511 languages): bcp47, nativeName, script,
  macrolanguage, speakerEstimates, wikidataDescription
- **PHOIBLE** (2,095 languages): encyclopedic.phonology (consonant/vowel/tone counts)

**Run when:** After bulk enrichment.
**Idempotent:** Yes — merge-only.
**Source cited:** `linguameta-2024` (inline on scripts[], speakerEstimates[]),
`phoible-2.0` (inline as phonology.source)

```bash
node scripts/enrich-from-linguameta-phoible.mjs
node scripts/enrich-from-linguameta-phoible.mjs --dry-run
node scripts/enrich-from-linguameta-phoible.mjs --lang crk
```

**Data files:**
- `data/linguameta/linguameta.tsv`
  Source: https://github.com/google-research/url-nlp/tree/main/linguameta — Apache 2.0
- `data/phoible/phoible-raw.csv`
  Source: https://github.com/phoible/dev — CC BY-SA 3.0

### 7. `enrich-vitality-from-linguameta.mjs` *(NEW)*
**Purpose:** Populates the `vitality` field from LinguaMeta's UNESCO-aligned
endangerment statuses (7,275 languages).
**Run when:** After the LinguaMeta enrichment pass.
**Idempotent:** Yes — only enriches cards with null vitality.
**Source cited:** `linguameta-2024` (inline as vitality.source)

```bash
node scripts/enrich-vitality-from-linguameta.mjs
node scripts/enrich-vitality-from-linguameta.mjs --dry-run
```

### 8. `enrich-alternate-names.mjs` *(NEW)*
**Purpose:** Collects language names from Glottolog, WALS, Grambank, and LinguaMeta.
Adds names that differ from the card's primary `name` as alternateNames.
**Run when:** After all other enrichment passes.
**Idempotent:** Yes — only adds names not already present.

```bash
node scripts/enrich-alternate-names.mjs
node scripts/enrich-alternate-names.mjs --dry-run
```

### 9. `enrich-contact-influences.mjs`
**Purpose:** Adds curated contact influence data for specific languages (currently ~40).
These are hand-researched contact histories with academic citations.
**Run when:** After adding new contact influence research.
**Idempotent:** Yes — skips cards already enriched.
**Source cited:** Per-influence academic citations (e.g., `blust-2013`)

```bash
node scripts/enrich-contact-influences.mjs
```

### 10. `derive-card-fields.mjs`
**Purpose:** Fills fields derivable from existing card data:
- `dir` (writing direction) from `script` code
- `macroarea` from `coordinates` + `countries` (sourced as `derived-from-coordinates`)
- `supportTier` from card completeness
- `_generated.completeness` from populated field count

**Run when:** After ALL enrichment passes complete.
**Idempotent:** Yes.
**Source cited:** `derived-from-script`, `derived-from-coordinates` (tracked in
`_generated.derivedFields`)

```bash
node scripts/derive-card-fields.mjs              # all cards
node scripts/derive-card-fields.mjs --dry-run     # preview
node scripts/derive-card-fields.mjs --lang crk    # single card
```

### 11. `fix-source-attribution.mjs` *(NEW)*
**Purpose:** Retroactively adds inline `source` fields to data populated by
earlier enrichment passes that didn't write inline provenance.
**Run when:** After all enrichment + derivation. Safe to re-run.
**Idempotent:** Yes.

```bash
node scripts/fix-source-attribution.mjs
node scripts/fix-source-attribution.mjs --dry-run
```

### 12. `stamp-field-sources.mjs` *(NEW)*
**Purpose:** Generates a `_fieldSources` map on every card that traces each
populated field to its authoritative source. This is the final provenance layer.
**Run when:** Last step before linting.
**Idempotent:** Yes — always regenerated from current card state.

```bash
node scripts/stamp-field-sources.mjs
node scripts/stamp-field-sources.mjs --dry-run
```

### 13. `lint-language-cards.mjs`
**Purpose:** Validates all cards against quality rules. Reports errors, warnings, and info.
**Run when:** After any enrichment or manual edit. Should be part of CI.

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk   # single card
node scripts/lint-language-cards.mjs --json       # JSON output for CI
```

---

## Source Attribution Policy

Every piece of data on a language card must be traceable. The pipeline ensures this
through three complementary mechanisms:

### 1. `dataSources` (card-level)
Lists every database consulted during enrichment:
```json
"dataSources": ["iso639-3-2024", "glottolog-5.3", "wals-2024", "linguameta-2024"]
```

### 2. Inline `source` / `_sources` (field-level)
Nested objects carry their provenance:
```json
"vitality": { "unescoStatus": "vulnerable", "source": "linguameta-2024" },
"speakerEstimates": [{ "count": 34000, "source": "wikidata" }],
"encyclopedic": { "typology": { "wordOrder": "SOV", "_sources": ["wals-2024"] } }
```

### 3. `_fieldSources` (summary map)
Top-level mapping of every field to its provenance:
```json
"_fieldSources": {
  "code": "iso639-3-2024",
  "classification": "glottolog-5.3",
  "vitality": "linguameta-2024",
  "linguisticChallenges": ["wals-2024", "grambank-1.0.3"]
}
```

> **Citation procedure:** See `references/language-card-citation-procedure.md`
> for the full source hierarchy and quality checklist.

---

## Data Files

| Directory | Contents | Source | License |
|-----------|----------|--------|---------|
| `data/glottolog/` | languoid.csv, aes-values.csv, cldf-languages.csv | Glottolog 5.3 | CC BY 4.0 |
| `data/iso639/` | iso-639-3.tab | SIL International | Free |
| `data/wals/` | values.csv, languages.csv, codes.csv, parameters.csv | WALS (CLDF) | CC BY 4.0 |
| `data/grambank/` | values.csv, languages.csv, codes.csv, parameters.csv | Grambank v1.0.3 | CC BY 4.0 |
| `data/linguameta/` | linguameta.tsv | Google Research | Apache 2.0 |
| `data/phoible/` | phoible-raw.csv | PHOIBLE 2.0 | CC BY-SA 3.0 |
| `data/nllb/` | NLLB-200 language codes | Meta AI | MIT |
| `data/flores/` | FLORES+ language codes | Meta AI | CC BY-SA 4.0 |

---

## Dependency Policy

**We do NOT ship with enrichment dependencies.** The language cards themselves are
the product. External data files and npm packages are used during enrichment but
are NOT included in the published subtree packages.

| Dependency | Used By | Install |
|------------|---------|---------|
| `cldr-core` | enrich-cards-from-cldr.mjs | `npm install cldr-core` |
| `cldr-misc-full` | enrich-cards-from-cldr.mjs | `npm install cldr-misc-full` |
| Glottolog CSV/CLDF | enrich-cards-bulk.mjs | Stored in `data/glottolog/` |
| ISO 639-3 tabs | generate-all-cards.mjs | Stored in `data/iso639/` |
| WALS CLDF | enrich-from-typology.mjs | Stored in `data/wals/` |
| Grambank CLDF | enrich-from-typology.mjs | Stored in `data/grambank/` |
| LinguaMeta TSV | enrich-from-linguameta-phoible.mjs | Stored in `data/linguameta/` |
| PHOIBLE CSV | enrich-from-linguameta-phoible.mjs | Stored in `data/phoible/` |
| NLLB-200 codes | lint-language-cards.mjs | Stored in `data/nllb/` |
| FLORES+ codes | lint-language-cards.mjs | Stored in `data/flores/` |

Data files in `data/` are committed to the repo at the root level (not in subtrees).
npm packages (`cldr-*`) are listed as devDependencies and installed on demand.
