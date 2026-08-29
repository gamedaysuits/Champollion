---
sidebar_position: 4
title: Language Card Specification
description: "Canonical schema for Champollion's per-language configuration cards."
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# Language Card Specification

> **Single source of truth.** This document defines the canonical shape of
> every language card. A card asserts only what a cited source asserts: a
> field no source asserts is **omitted, not null** — a missing field means
> "no source spoke", never "there is nothing to know". The machine-checkable
> schema ships as `shared/schemas/language-card.schema.json` in the npm
> package, and the [canonical example below](#canonical-template) is
> generated from the live corpus on every site build, so this page cannot
> drift from the cards it describes.

## The 2026-08 atlas rebuild — what changed in this schema

The card corpus is now **build output**: every card is projected from a store
of pinned upstream snapshots, and rebuilt — never edited — when a fact
changes. Four things about the shape changed with that rebuild:

1. **Disputed fields carry an attribution envelope.** Where cited sources
   genuinely disagree, the field is not a flat value but
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment`, and any field a new source turns
   disputed. Consumers should read cards through the published adapter
   (`normalizeCard()` in the npm package) rather than assuming flat values —
   `display()` resolves an envelope to its agreed value and deliberately
   returns nothing on a genuine dispute rather than electing a winner.

2. **Renamed fields.** `endonym` replaced `nativeName` · `codeAliases`
   replaced `aliases` · `scripts[]` (all attested scripts) replaced the flat
   `script`, with the primary script derived from the card's maximal BCP 47
   tag · `endangerment` (every source's assessment, on that source's own
   scale) replaced the single `vitality` object · `isoLanguageType` and
   `isoScope` now carry ISO 639-3's own words ("Living", "Macrolanguage")
   rather than initials. New fields: `modality` ("spoken"/"signed", derived
   from Glottolog's ancestry), `glottologBucket` (Glottolog's non-genealogical
   buckets, kept out of the family slot), `locale`/`localeScoped`.

3. **Unasserted fields are omitted, not null.** A field no source asserts is
   absent from the card. The earlier rule ("every card MUST contain every
   top-level field, even when null") is retired: an empty value on a public
   surface reads as a claim that there is nothing to know, which is not the
   same as not having looked.

4. **Locale cards exist.** Alongside the language cards, locale projections
   (`fra-CA`, `cmn-Hant`) carry their language's facts resolved for a
   territory or script, identified by a `locale: {language, region, script}`
   block. A locale is not a language: exclude locales from language counts by
   that block.

## Design Principles

1. **Source everything.** Every factual claim traces to a named, versioned,
   primary source. Unsourced claims are unverifiable claims. The
   `_fieldSources` map (and per-field `source` annotations in sub-objects)
   make provenance explicit.

2. **Preserve disagreement.** When authorities disagree (one source says
   50,000 speakers, another says 20,000), the card stores *both* with source
   attribution — the envelope shape above. We do not average, resolve, or
   pick sides. Users can navigate the nuance.

3. **Absent means unasserted.** A missing field means no source asserts a
   value. When a property genuinely doesn't apply (e.g., grammatical gender
   for a language without it), the cited value says so explicitly rather than
   being blank.

4. **Rebuilt, never patched.** Cards are projected from pinned sources by a
   deterministic build. A fact defect is fixed at its source handler and the
   corpus rebuilt — no in-place edits, no merge-only enrichment layer.

---

## Three-Layer Architecture

| Layer | Location | Purpose |
|-------|----------|---------|
| **Language cards** | `shared/language-cards/<code>.json` | Per-language configuration: identity, classification, resources, everything |
| **Genus cards** | `shared/language-cards/genera/<genus>.json` | Shared runtime properties for related languages (curated, not auto-generated) |
| **Language tree** | `shared/language-cards/language-tree.json` | Full Glottolog hierarchy — reference data for Lab UI and language discovery |

---

## Inheritance Model

> **Largely historical since the atlas rebuild.** No language card on disk
> carries `extends` any more — every card is fully materialized by the build,
> because inherited prose was uncitable (a family-level claim wore a
> language-level address). The mechanism itself survives in one place: the
> npm package's offline bundle ships locale cards as compact `extends` deltas
> against their language, resolved by the same merge described here.

When a card sets `"extends": "family-dravidian"`, the runtime merges the parent
card into the child using `_deepMerge()` (in `lib/registers.js`). This lets
genus cards define shared registers, formality systems, and gender guidance that
flow down to all member languages — without duplicating data across hundreds of
individual cards.

### Merge Semantics

| Child value | Behavior | Why |
|-------------|----------|-----|
| `null` | Inherit from parent | `null` means "I don't define this" — parent's value flows through |
| Non-null | Override parent | Child's data is more specific — takes priority |
| Nested object | Recursive merge | Child fields override, parent fields preserved |
| Array | Replace entirely | Arrays don't merge item-by-item — child array wins |

### Identity Fields (Never Inherited)

Some fields belong to the card itself and must NEVER be inherited from a parent:

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

Even if a parent card defines `aliases: ["macro-code"]`, a child card will NOT
inherit those aliases. These fields are always the child's own values (including
`null` if unset).

**Why:** Without this rule, every Cree language would inherit `aliases: ["cre"]`
from the macrolanguage parent, making every variety an alias of the macro.

### Example: How a Cree Card Resolves

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

At runtime, `getLanguageCard("crk")` returns a merged object with genus-cree's
registers + family-algic's properties (if any) + crk's own identity and metadata.

### Genus Card Template

Genus cards live in `shared/language-cards/genera/` and define shared properties
for a language group. They follow the same schema as regular cards but with
different conventions:

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**Key rule:** Genus cards must ONLY contain data that is genuinely shared across
the entire group and sourced from authoritative references. If a formality system
varies between members, it belongs on the individual cards, not the genus.

## Canonical Example \{#canonical-template}

> **Generated, not written.** Everything in this section is derived from the
> live corpus at build time: the full `crk` (Plains Cree) card, byte-for-byte,
> plus a `fra-CA` locale excerpt. When the corpus is rebuilt, the next site
> build re-derives this page. There is no hand-maintained template left to
> fall out of date — the previous one drifted a whole schema generation
> behind the cards and was retired on 2026-08-16.

The example shows the **on-disk shape** — what you get if you open the file.
Consumers should still read cards through the published adapter
(`normalizeCard()` in the npm package): it resolves envelopes, bridges the
pre-cutover names, and derives the display-only values (primary script,
vitality tier) that the raw card deliberately does not carry.

What to notice while reading:

1. **Attribution envelopes.** `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag`, and
   `politenessDistinction` each carry `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   has `"agreement": "incommensurable"`: its sources assess on different
   scales, so each value names its `scale` instead of being converted onto a
   winner's.

2. **Omitted means unasserted.** The card has no `iso639_1` (Plains Cree has
   no ISO 639-1 code) and no `phonologicalInventory` (no ingested source
   asserts one) — those fields are simply absent, never `null` or `[]`.

3. **Provenance is a first-class layer.** `_fieldSources` maps every field to
   the source(s) that asserted it, with `champollion-derived-v1` marking
   values Champollion computed. `_card` stamps the card's type, id, revision,
   and which fields the correction lane may touch; `_atlas` stamps the corpus
   release.

4. **No run results.** Nothing on the card is a measured score of method
   output — chrF, FST acceptance rates, and their kin are run results keyed
   by (method, dataset, metric) and live on the leaderboard. The card only
   asserts that resources *exist* (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### A locale card is a projection, not a language \{#locale-card-example}

Beside the language cards sit locale cards (`fra-CA`, `cmn-Hant`): a
language's facts **resolved for a territory or script**, identified by their
`locale` block — never by code shape. A locale card inherits its language's
facts, resolves the script- and territory-scoped ones (`script`,
`localeScoped`), and is **not a language**: exclude locale cards from every
language count and per-language listing by that `locale` block.

<CardSpecExample variant="locale" />

---

## Field Reference \{#field-reference}

Two conventions apply to every table below:

- **"envelope"** means an attribution envelope — `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}` — carrying *every* source's
  claim. A field listed as `envelope` may appear as a flat value on cards
  where only one source speaks (for example, Glottolog-only languoids carry a
  flat `name`); consumers must handle both, which is what the published
  adapter does.
- No field is required beyond `code` and `name`; everything else is
  **omitted when no source asserts it**. Each field's asserting source(s)
  are recorded per-card in `_fieldSources`, so the tables describe the
  *kind* of source rather than pinning versions that would drift.

### § 1. Identity Fields

| Field | Shape | Notes |
|-------|-------|-------|
| `code` | `string` | **Required.** The card ID and filename. ISO 639-3 for language cards (`crk`); Glottolog-only languoids carry their glottocode; locale cards carry a locale code (`fra-CA`). |
| `name` | envelope | **Required.** English reference name (ISO 639-3 registry, LinguaMeta, Glottolog). |
| `endonym` | envelope | Replaced `nativeName`. What speakers call the language, in the language (LinguaMeta, Wikidata). Absent when no source asserts one — an endonym is never invented or transliterated by us. |
| `alternateNames` | `string[]` | Other attested English names. |
| `iso639_1` | `string` | Present only when a two-letter ISO 639-1 code exists (`fra` → `"fr"`). |
| `isoScope` | `string` | ISO 639-3's own words — `"Individual"`, `"Macrolanguage"`, `"Special"` (replaced the `"I"`/`"M"`/`"S"` initials). |
| `isoLanguageType` | `string` | Replaced `isoType`. ISO 639-3's own words — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | The macrolanguage this language belongs to (`crk` → `"cre"`). ISO 639-3 macrolanguage mappings. |
| `macrolanguageMembers` | `string[]` | On macrolanguage hub cards: the individual member codes (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | On macrolanguage cards: members whose tags the BCP 47 registries fold into this macrolanguage's tag (CLDR alias table + SIL langtags, each attributed). |
| `supersededCodes` | `string[]` | Retired ISO 639-3 codes that SIL now directs to this language — recorded on the successor so corpora published under an old code still resolve. |
| `codeAliases` | `string[]` | Replaced `aliases`. Code-level identifiers that resolve to this card. |
| `bcp47` | `string` | The language's BCP 47 tag as asserted (LinguaMeta). |
| `bcp47Tag` | envelope | Champollion-derived: the RFC 5646 tag (shortest ISO 639 code wins). |
| `bcp47FullTag` | envelope | The maximal language–script–region form (CLDR likelySubtags + SIL langtags). The adapter derives the **primary script** from this tag. |
| `modality` | `string` | `"spoken"` or `"signed"`, derived from Glottolog's ancestry. Writing is an orthography attribute, not a modality — an unwritten language is still fully spoken or signed. |
| `locale` | `object` | **Locale cards only.** `{language, region, script, publishedTag, source, note}` — THE locale identity. Exclude locale cards from language counts by this block, never by code shape. |
| `localeScoped` | `object` | Locale cards only: values resolved for the locale's territory/script (e.g. `scriptName`, `cldrOfficialStatus`). |

### § 2. Classification Fields

| Field | Shape | Notes |
|-------|-------|-------|
| `glottocode` | `string` | Glottolog's identifier for this languoid (`crk` → `"plai1258"`). Glottolog-only languoids — languages Glottolog records that ISO 639-3 does not — use the glottocode as their card `code`. |
| `classification` | `object` | Container for the placement fields below. Each is independently sourced and independently omitted — an isolate, or a language filed in a Glottolog bucket, legitimately carries only part of this object. |
| `classification.family` | envelope | The top-level family each classification authority asserts. Glottolog and WALS are separate taxonomies that do not always agree, so both are kept and attributed. Lint rule R5 checks the Glottolog value inside the envelope against Glottolog's own tree: WALS may disagree with Glottolog, but Glottolog may not be misquoted. Isolates carry no family at all. |
| `classification.familyGlottocode` | `string` | Glottocode of that top-level family (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | WALS's intermediate classification node (`crk` → `"Algonquian"`). A WALS concept, **not** a Glottolog one — Glottolog publishes an arbitrary-depth tree with no genus level — so it is present only where WALS codes the language. |
| `classification.ancestry` | `string[]` | Glottolog's descent path as ancestor glottocodes, root first (`["algi1248", …, "plai1264"]`). The order **is** the claim: this is a path, never an alphabetized set. |
| `classification.glottologBucket` | `string` | Glottolog's non-genealogical buckets — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Kept out of the family slot because a bucket classifies by kind, not descent: a card with a bucket has no family, and that is the honest result. |
| `isIsolate` | `boolean` | Whether Glottolog classifies this language as an isolate. |

The pre-cutover card also carried a `genusGlottocode`. It is retired along
with the category error that produced it: the genus is WALS's concept, and
dressing it in a Glottolog identifier asserted a tree node Glottolog does not
have. The Glottolog hierarchy is carried by `ancestry` instead.

### § 3. Geography Fields

| Field | Shape | Notes |
|-------|-------|-------|
| `macroarea` | `string` | Glottolog's macroarea — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` or `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Glottolog's representative point. A point, not a territory: it places the language on a map and claims nothing about range or boundaries. |
| `countries` | `string[]` | ISO 3166-1 alpha-2 codes of the countries Glottolog associates with the language (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | An official status some territory grants the language, as CLDR records it (carried via LinguaMeta) — `"Official"`, `"Regional official"`. On a locale card, the status resolved for *that locale's* territory sits in `localeScoped.cldrOfficialStatus`. |

The pre-cutover `regions` array (per-country speaker breakdowns with admin
codes) and `arealContext` (Sprachbund membership) are retired: no ingested
source asserts them, and unsourced curation does not survive a rebuild.
Region-level speaker claims can return the day a citable source lands in the
pipeline; until then, absence is the honest state.

### § 4. Writing System Fields

| Field | Shape | Notes |
|-------|-------|-------|
| `scripts` | `string[]` | Replaced the flat `script`. **All** attested ISO 15924 codes (`crk` → `["Cans", "Latn"]`), unordered — never read `scripts[0]` as "the" script. The primary script is derived by the adapter from `bcp47FullTag`'s maximal tag. |
| `scriptNames` | `string[]` | Champollion-derived display names for `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Replaced `dir`. The source's own words — `"left-to-right"` / `"right-to-left"` (was `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: the script so canonical for the language that BCP 47 tags omit it (`fra` → `"Latn"`). |
| `script` | `string` | **Locale cards only**: the locale-resolved script (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Language cards carry no flat script field. |

A language with no attested writing simply has **no `scripts` field** —
absence means no source asserted a script, not a claim that the language is
"unwritten". (Sign languages are the largest such group: no notation system
has community-standard adoption for everyday literacy.)

### § 5. Demographic & Vitality Fields

| Field | Shape | Notes |
|-------|-------|-------|
| `speakerEstimates` | envelope | Every source's estimate, attributed. Values may be exact counts or the source's own range strings (`"10000-99999"`), with the source's caveats carried verbatim in `note`. `"agreement": "conflicting"` is common — showing the conflict *is* the product; nothing is averaged or elected. |
| `endangerment` | envelope | Replaced the single `vitality` object. Every source's assessment **on that source's own scale** — each value carries a `scale` field, and `"agreement": "incommensurable"` is the norm because ELCat, Glottolog AES, and LinguaMeta vocabularies are not translations of each other. The adapter derives one display *vitality tier* from a single named source per the declared authority order; that tier is display-only — the full attributed set stays on the card. |

A *displayed* speaker count anywhere in Champollion must match one of the
cited `speakerEstimates` entries or carry explicit `champollion-derived`
provenance — enforced by the card-integrity rules.

### § 5.5 Documentation & Digital Presence Fields

| Field | Shape | Notes |
|-------|-------|-------|
| `documentation` | `object` | Replaced `documentationDepth`. Glottolog's record of how well-described the language is, in Glottolog's own terms. |
| `documentation.medLevel` | `string` | Glottolog's Most Extensive Description level, verbatim — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | The bibliographic key of that most extensive description in Glottolog's reference catalogue. |
| `documentation.firstDocumented` | `number` | Glottolog's own first-year-of-documentation column, verbatim — moved here from the pre-cutover top-level field. Present on only a few hundred languages, and the sparseness is itself worth knowing. |
| `documentation.lastDocumented` | `number` | Glottolog's last-year-of-documentation column, verbatim — present on roughly a thousand languages. |
| `wikipediaEdition` | `object` | Replaced `digitalPresence`. `{site, url, name}` — an open Wikipedia edition exists in this language (`afr` → `af.wikipedia.org`). Existence only, deliberately **without article counts**: several editions are largely bot-generated, and a huge edition is not "better documented" than a small one in any sense a translator can use. |
| `dialectCount` | `number` | Glottolog's own `child_dialect_count` column, verbatim — direct child dialects only, not the whole subtree. This is Glottolog's assertion, not our arithmetic: an earlier rule stamped it `champollion-derived` and made thousands of cards take credit for Glottolog's count. |

The rest of the pre-cutover `digitalPresence` block (Common Voice hours,
Tatoeba sentence counts) is retired until those sources land in the pipeline —
the Tatoeba corpus itself already appears where it belongs, as a parallel
corpus under `resources.corpora` (§ 9).

### § 6. Formality, Register & Gender Fields

The projected corpus carries exactly one field here — the cited fact:

| Field | Shape | Notes |
|-------|-------|-------|
| `politenessDistinction` | envelope | Whether the language grammaticalises politeness in second-person forms. Attributed across Grambank GB415 (binary: absent/present) and WALS 45A (four levels: no distinction / binary / multiple / pronouns avoided). Those are different scales, so each value names its `scale` and the envelope reports them as **incommensurable** rather than as a disagreement. |

**The register system is configuration, not a card fact.** The pre-cutover
corpus stored `formality` prose and `registers` prompts on nearly eighteen
hundred cards each — almost all of it generated from the same two sources
above, then carried as though it were hand-curated configuration. The atlas
keeps the fact; the configuration surfaces — `formality`, `registers`,
`gender`, `codeSwitching` — remain part of the **npm package's curated
schema** (`language-card.schema.json`), live on the curated genus/family hub
cards, and reach the CLI through the register system's `extends` merge
described in the [Inheritance Model](#inheritance-model). They are not
projected atlas fields: no card in the projected corpus carries them, and the
atlas build will never write them. The guidance in
[Writing Good Register Presets](#writing-good-register-presets) applies to
that curated lane.

### § 7. Linguistic Profile Fields

| Field | Shape | Notes |
|-------|-------|-------|
| `typologicalProfile` | `object` | One key per ingested typological feature, each value the source's own coding, each key present only where the source codes this language. Booleans come from Grambank features, category strings from WALS chapters; the decision registry names the exact upstream parameter for every key. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — counts computed by Champollion over a cited PHOIBLE inventory (PHOIBLE publishes one row per segment and asserts no counts), so every value carries `champollion-derived` provenance. **PHOIBLE is the sole tone authority** (lint R1): Grambank has no tone feature, and nothing else on the card may claim tonality. |
| `numeralSystem` | `object` | `{base}` — the numeral base, verbatim from Chan's *Numeral Systems of the World's Languages* (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; nearly a hundred distinct values). Absent when Chan's own base column is empty — about half the surveyed languages — because a previous generator filled the blank with `"decimal"` and invented values for two thousand languages. |
| `pluralCategories` | `string[]` | The cardinal plural categories CLDR states for this language — Arabic distinguishes `["zero", "one", "two", "few", "many", "other"]`, French three of them, Chinese one. Read from the keys of CLDR's own rule set, so it is CLDR's claim, not our derivation. Replaced the pre-cutover `rules.plurals.categories`; an i18n pipeline needs it to know how many plural forms a message must supply. |

The `typologicalProfile` keys currently projected, with their upstream
parameters:

- **WALS chapters** (category strings, WALS's own value labels): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Grambank features** (booleans): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083),
  `marksPresentTense` (GB084)

The pre-cutover `linguisticChallenges` and `contactInfluences` blocks are not
projected — researched prose with no ingested source stays on the npm
package's curated schema, like the register surfaces in § 6 (the
[Contact Influence Types](#contact-influence-types) tables below serve that
lane). The `rules` block is retired: what was citable in it survives as
`pluralCategories` here and the script fields in § 4.

### § 8. Encyclopedic Fields

Retired from cards. The pre-cutover `encyclopedic` (history and dialect
essays, institutional links), `culturalAphorism`, and `varieties` blocks were
hand-curated prose at card grain, which the rebuild deletes by design. The
membership facts that `varieties` gestured at are now cited identity fields
(§ 1 `macrolanguageMembers` and `canonicalisedMembers`), and per-variety tool
coverage is answered by each member's own card (`methodSupport`,
`resources`). A representative saying may return through a community
contribution lane with consent and citation; it will not return as an
uncited card field.

### § 9. Digital Resource Fields

Everything in this section asserts **existence and capability, never
quality**: that a resource is published and who publishes it — never that it
is good, complete, or usable, and never a measured score. Any measured score
of method output is a run result keyed by (method, dataset, metric), lives on
the leaderboard, and is forbidden on cards (lint R3).

| Field | Shape | Notes |
|-------|-------|-------|
| `resources` | `object` | Container: each subfield below is an independently sourced list, omitted when no source asserts it. |
| `resources.fsts` | `object[]` | Published finite-state morphological analysers: `{name, url, publisher, license, licenceEstablished, archived}`. The licence travels with each entry rather than being assumed uniform across a catalogue — licence boundaries need the actual terms. For a polysynthetic language an FST is frequently the only structural check that exists at all. |
| `resources.corpora` | `object[]` | Parallel corpora attesting this language: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Stated through **pairs**, because a parallel corpus attests a language only through a pair — "covers Swahili" without saying against what answers a question nobody asked. Existence and size, never quality. |
| `resources.monolingualCorpora` | `object[]` | Monolingual corpora — kept separate from `corpora` so "has a corpus" never means two incomparable things. |
| `resources.speech` | `object[]` | Published speech resources. Existence only. |
| `resources.keyboards` | `object[]` | Published keyboard layouts. Plain but load-bearing: for an orthography needing characters no standard layout produces, a layout is the difference between the language being typable and not. |
| `resources.typology` | `object[]` | Typological datasets that *code* this language, with extent: `{dataset, featuresCoded, datasetFeatureTotal}`. Existence and extent, never content — what a feature says stays off the card until a person writes the parameter map that accepts it (the accepted ones surface in § 7's `typologicalProfile`). The feature counts are our arithmetic, so they carry `champollion-derived` provenance. |
| `lexicalResources` | `object` | Container for lexical existence facts. |
| `lexicalResources.datasets` | `object[]` | Published wordlists with their coverage: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Published dictionaries — existence, never quality, and **directed** where the publisher directs them: a dictionary that goes one way is a different resource from one that goes the other. Entries are not uniform in shape (a CLDF dataset knows its entry count; a repository knows its pair and direction); each names its own source, and licence and archived state travel per entry. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Champollion-computed counts over CLICS³: concepts attested for this language, and forms that map to two or more distinct concepts. `champollion-derived`. |
| `methodSupport` | `object` | Which translation methods cover this language — capability, never a score. Shape: `{total, byTier, named, truncated}`. English carries thousands of method edges and the median language a couple dozen, so the card holds the *shape* of the evidence — `total` plus `byTier` counts per confidence tier (`fetched`, `partially-confirmed`, `model-card-declared`) — and names only the strongest entries (each `{value, variant, source, confidence}`), capped. Registry **services** are always named in full, above the cap, so a service's absence from `named` is a real answer; a model-card entry's absence only means "not among the strongest", and every edge stays queryable in the atlas store. |
| `metricModelSupport` | envelope | Evaluation metric models that publish coverage of this language, with the model identifier a harness loads (`masakhane/africomet-mtl`). Drives real behavior — COMET model selection — and is still capability, never a score. |

**Folded into the fields above:** the pre-cutover `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`), and `databaseCoverage` (→
`resources.typology` plus `lexicalResources` — a database entry is now a
cited coverage fact with extent, not a boolean).

**Retired from cards:** `omt1600`, `evalDatasets`, `pipelineReadiness`, and
`metricPlugins` — none is asserted by an ingested source, and a readiness
tier is a judgement, not a citation.

**Curated, not projected:** the eval-standard declaration surfaces
(`evalStandard`, `evalMetrics`, `evalPack`) stay in the npm package's curated
schema. They tell the evaluation harness which external referee package
scores a language (referees, not contestants — the harness core ships no
language-specific scorer code); the harness reads them off a card when
present, but no card in the projected corpus currently carries them, and the
atlas build does not write them. The same holds for the `install` block the
harness's FST installer reads from `resources.fsts[]` entries
(`get_fst_install_info()` in `language_cards.py`): the projected entries
carry existence facts only.

### § 10. Provenance Fields

| Field | Shape | Notes |
|-------|-------|-------|
| `_fieldSources` | `object` | On every card. Maps every field path on the card (`"classification.family"`, `"coordinates.lat"`) to the sorted source ids that asserted it (`["glottolog-v5.3", "wals-v2020.5"]`). Values Champollion computed carry `champollion-derived-v1`. Source ids are versioned — `grambank-v1.0.3`, `iso639-3-20260715` — so every claim traces to the exact release that made it. |
| `coverage` | `object` | On every card, and **computed by the projector, not asserted by any source**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — how many distinct sources speak about this language, how many card components carry a value out of how many exist to be filled, and how many values a source positively recorded as *absent* (looked and said no — a different fact from never having looked). This is what lets a thin card say **why** it is thin instead of looking neglected. |
| `_card` | `object` | The card's own metadata: `{type, id, revision, correctableFields}`. `type` is `"language"` or `"locale"` (method and corpus cards ride the same projector); `revision` is a content hash, so any change to the card's content changes it; `correctableFields` lists the field paths carrying values — the fields the correction lane may touch. |
| `_atlas` | `object` | `{version}` — the corpus release stamp (`"unreleased"` between releases). Deliberately a release id, **not** a build timestamp: a timestamp would make two builds from identical pins differ by the calendar, destroying the property that lets anyone check the atlas — same pins in, same bytes out. |

The pre-cutover provenance block is retired wholesale: `dataSources`
(superseded by the per-field `_fieldSources` map), `supportTier` (a computed
judgement, replaced by the neutral `coverage` counts), `_generated` (the
whole corpus is generated; the stamp is `_card.revision` plus
`_atlas.version`), `humanReviewed` and `notes` (curation that belongs to
lanes with their own records), and the top-level
`firstDocumented`/`lastDocumented` (moved into `documentation` in § 5.5,
where their source actually asserts them).

---

## Language Code Policy

Champollion uses **ISO 639-3** as the canonical identifier. Other standard codes
are registered as aliases and resolve to the ISO 639-3 code at runtime.

| Priority | Standard | Example | Field | Use |
|----------|----------|---------|-------|-----|
| 1 (canonical) | ISO 639-3 | `crk` | `code` | Card filename, config keys, API params |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Accepted in CLI, resolved to ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Accepted in CLI, resolved to ISO 639-3 |
| Reference | Glottocode | `plai1258` | `glottocode` | Classification only, not for runtime |

**Resolution order:** When a user provides a code:
1. Direct match on `card.code` → found
2. Match on `card.codeAliases[]` → found, return the canonical card
3. Match on `card.iso639_1` → found (fallback)
4. Not found → error

### Migration History: ISO 639-1 → ISO 639-3

Prior to v8, card filenames used ISO 639-1 codes where available (`fr.json`,
`de.json`, `ja.json`). In the 639-3 migration, all cards were renamed to their
ISO 639-3 equivalents:

| Before | After | Why |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3 is canonical |
| `de.json` | `deu.json` | 639-3 is canonical |
| `zh.json` | `cmn.json` | Macrolanguage → default individual |
| `ar.json` | `arb.json` | Macrolanguage → Modern Standard Arabic |
| `ms.json` | `zsm.json` | Macrolanguage → Standard Malay |

**What happened to the old codes?**
- The old 639-1 code is in `card.iso639_1`
- The old 639-1 code is in `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` returns `"fra"` at runtime — backwards compatible
- Users can still write `"fr"` in their config — it resolves transparently

**What changed architecturally:**
- `_deepMerge()` now skips `null` values (inherits from parent)
- `_deepMerge()` now has an identity field set (code, extends, aliases never inherited)
- `formality.default` is now derived from register `isDefault: true` flags
- 205 Grambank-derived cards got structural `formality.default` fix
- 38 genus/family/macrolanguage cards provide inheritance targets

---

## Edge Cases

### Sign Languages
Sign languages (e.g., ASE — American Sign Language) are legitimate languages
with ISO 639-3 codes. They have geography and speaker counts but:
- `modality` is `"signed"` — the card's positive assertion of what the
  language *is*; the absence of a writing system is a separate fact
- `scripts` is typically absent (no notation system has community-standard
  adoption), though `"Sgnw"` (SignWriting) appears where a source asserts it
- `textDirection` is absent
- `linguisticChallenges` should address spatial grammar, classifiers, etc.

### Ancient & Historical Languages
Languages like Latin (`lat`, isoLanguageType `"Historical"`) and Sanskrit
(`san`) are still used in specific contexts (liturgical, academic) but have
no native speakers:
- `isoLanguageType` carries ISO's own status word (`"Ancient"`,
  `"Historical"`, `"Extinct"`) — the card never softens or overrides it
- `endangerment` and `speakerEstimates` report whatever the cited sources
  actually assess, caveats verbatim (L2-community counts stay labeled as
  their sources label them)
- `firstDocumented` / `lastDocumented` locate them in time

### Constructed Languages
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, etc.:
- `classification` may be absent — Glottolog files conlangs under a
  non-genealogical bucket, and the bucket is never displayed as a family
- `contactInfluences` reflects the source material (e.g., Esperanto draws on Romance, Germanic, Slavic)
- `endangerment` is unusual — growing speaker community but no native homeland

### Macrolanguages
Arabic (`ara`), Chinese (`zho`), Cree (`cre`), Quechua (`que`) are macrolanguages
that encompass multiple individual languages:
- `isoScope: "Macrolanguage"` — a navigation hub, never a benchmark target
- `macrolanguageMembers` lists the individual member codes;
  `canonicalisedMembers` records which members the BCP 47 registries fold
  into the macrolanguage's tag (each registry attributed)
- `methodSupport` reflects what the *macrolanguage card* supports (usually the standardized variety)
- Individual members have their own cards, carrying `macrolanguage` back to the hub

### Languages Without Standardized Orthography
Many languages (especially oral-tradition languages) have no standardized
writing system, or have competing orthographies:
- `scripts`, `scriptNames`, and `textDirection` are absent — no source
  asserted a script, which is not the same claim as "unwritten"
- `notes` should explain the orthographic situation
- `linguisticChallenges` should note how this affects MT (e.g., no training data)

### Diglossia
Languages like Arabic (MSA vs. dialects) or Guaraní (Jopará vs. pure Guaraní):
- `codeSwitching` captures the mixed-variety situation
- `registers` can offer presets for different levels
- `varieties` can list the diglossic pair

---

## Contact Influence Types

| Type | Meaning | Example |
|------|---------|---------|
| `superstrate` | Dominant language imposed on a community | French → English (post-1066) |
| `substrate` | Native language influencing an imposed language | Celtic → English |
| `adstrate` | Neighboring language with mutual influence | Norse → English |
| `learned_borrowing` | Borrowings through education/scholarship | Latin → English |
| `lexical_borrowing` | Direct vocabulary loans through contact | Spanish → Filipino |
| `relexification` | Wholesale vocabulary replacement | Portuguese → Papiamentu |

## Contact Influence Depths

| Depth | Meaning |
|-------|---------|
| `light` | A few loanwords, minimal structural impact |
| `moderate` | Significant vocabulary in specific domains |
| `heavy` | Pervasive vocabulary and some structural features |
| `structural` | Grammar, syntax, and phonology affected |
| `defining` | Core identity shaped by contact (creoles, mixed languages) |

---

## Writing Good Register Presets

**Good preset prompts:**
- Name the formality feature explicitly (e.g., "해요체", "vous-form", "siz-form")
- Explain the specific pronoun or verb form to use
- Give context for when this register is appropriate
- Mention script considerations if applicable

**Don't** put gender-inclusive guidance in the preset prompt. Gender guidance
belongs in `card.gender.inclusiveGuidance` — it's injected separately.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### Preset Naming Convention

Preset keys should be descriptive and lowercase-hyphenated:
- T-V languages: `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- Speech levels: `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- Neutral: `professional`, `neutral-professional`
- Code-switching: `taglish-professional`, `pure-filipino`

---

## How Card Facts Get Updated

Cards are **build output** — a deterministic projection from pinned upstream
snapshots. There is no per-card enrichment procedure any more: the hand-run
`enrich-*` script lane is retired, and an edit made directly to a card file
is deleted by the next build. To change a fact:

1. **Register the decision.** Every field is one row in the build's decision
   registry: which upstream parameter feeds it, how it projects, and what an
   absent value means.
2. **Fix the ingest layer.** A wrong value is a defect in the source handler
   (or a stale upstream pin), never something to patch on the card.
3. **Rebuild and cut over.** The build re-projects every card from the pinned
   snapshots; gates refuse partial builds, null/empty values, and cards that
   fail the integrity rules.

### Conflict Handling

When sources disagree:
1. **Store all of them** with source attribution — that is what the
   attribution envelope is for
2. **Do NOT average** or pick sides — `consensus` appears only when the
   sources actually agree
3. **Carry each source's caveats** verbatim in that value's `note`
4. A single value for display or computation is **derived by the adapter**
   from the declared authority order — the card itself keeps the full spread

---

## Validation

Run the linter after any rebuild:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR Checklist

When submitting a change that touches the cards (remember: change the build,
not the card):

- [ ] The fix lives in an ingest handler or the decision registry — no card
      file is hand-edited
- [ ] Fields carry only source-asserted values — nothing padded to `null` or
      `[]` to "complete" a card
- [ ] `classification` comes from Glottolog (not hand-built)
- [ ] Every touched field's provenance lands in `_fieldSources`, with
      Champollion-computed values carrying `champollion-derived` provenance
- [ ] No measured score of method output appears anywhere on a card
- [ ] Linter and card-integrity gate pass with no errors

---

## Professional References

| Standard | Maintained By | Our Use |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | Canonical language codes, macrolanguage relationships |
| [Glottolog](https://glottolog.org) | Max Planck Institute | Classification, coordinates, AES endangerment |
| [WALS](https://wals.info) | Max Planck Institute | Genus definitions, typological features |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | Script codes |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | Locale data, plural rules, typography |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | Speaker counts, endonyms, script data |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, speaker estimates, DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | Endangerment classification |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | Philippine language capsules |

See also: [Language Card Citation Procedure](/docs/reference/language-card-citation-procedure)
for detailed source-by-source guidance.
