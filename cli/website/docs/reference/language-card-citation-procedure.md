---
title: Language Card Citation Procedure
sidebar_label: Citation Procedure
---

# Language Card Citation Procedure

*How Champollion ensures every claim on a language card is traceable to a primary source.*

---

## 1. The Problem

Language cards contain factual claims — speaker counts, endangerment status, contact influences, morphological properties, typographic conventions, method support — that **must be verifiable**. Currently:

- The `dataSources` field is a flat array of strings (e.g., `["cldr-48", "glottolog-5.3"]`)
- There is no per-field citation granularity
- Claims like "~2.8M speakers" or "vulnerable" have no traceable provenance
- A reviewer cannot determine which source supports which claim

> [!CAUTION]
> **An unsourced claim is an unverifiable claim.** For a project that positions itself as professionally rigorous, every assertion on a language card must be traceable to a specific, versioned primary source.

---

## 2. Authoritative Sources (Ranked by Priority)

For each type of claim, the following sources are authoritative. **Always prefer the highest-ranked source available.**

### Classification and Identity

| Priority | Source | Covers | License | How to Cite |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | Family, ancestry, glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | ISO codes, macrolanguages | Free | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | Genus definitions, typological features | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | Locale codes, script codes, plural rules | Unicode ToS | `cldr-{version}` |

### Speaker Demographics and Vitality

| Priority | Source | Covers | License | How to Cite |
|---|---|---|---|---|
| 1 | National census data | Official speaker counts | Varies (usually public) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | Speaker estimates, EGIDS | Proprietary (subscription) | `ethnologue-{edition}` |
| 3 | [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | Endangerment status | Free | `unesco-atlas-{year}` |
| 4 | Published academic papers | Regional speaker surveys | Per-paper license | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | Philippine languages | Academic | `katig-{year}` |

> [!WARNING]
> **Never use Wikipedia, LLM-generated text, or self-knowledge as a primary source for demographic claims.** These are secondary/tertiary sources at best. Always trace back to the primary data.

### Method Support (Translation API Coverage)

| Method | Verification Source | How to Verify | How to Cite |
|---|---|---|---|
| Google Translate | [Language list](https://cloud.google.com/translate/docs/languages) | API call or docs page | `google-translate-{date}` |
| DeepL | [Language list](https://www.deepl.com/docs-api/translate-text/) | API call | `deepl-api-{date}` |
| Microsoft Translator | [Language list](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | Docs page | `ms-translator-{date}` |
| LibreTranslate | [Language list](https://libretranslate.com/languages) | API call | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + model card | `nllb-200-{date}` |
| LLM | Always `true` | N/A (quality varies) | `llm-assumed` |

### DLS (Digital Language Support)

| Priority | Source | Covers | How to Cite |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | DLS scores (original 143 tools) | `simons-2022` |
| 2 | Ethnologue 27th+ ed. | DLS scores (expanded 211 tools) | `ethnologue-{edition}-dls` |

### Typography, Plurals, Scripts

| Priority | Source | Covers | How to Cite |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | Plural rules, quote marks, number formatting | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | Script codes | `iso15924-{date}` |
| 3 | Published grammars | Language-specific rules | `{author}-{year}` |

### Contact Influences

| Priority | Source | Covers | How to Cite |
|---|---|---|---|
| 1 | Published historical linguistics papers | Loanword studies, contact history | `{author}-{year}` |
| 2 | Reference grammars | Structural influence descriptions | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | Typological comparisons | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **Contact influence claims are the hardest to source.** Claims like "Spanish superstrate, deep, 1571–1898" require historical linguistics expertise. If a published source cannot be found, mark the claim with `"citation_needed": true` rather than guessing.

---

## 3. Citation Procedure (Step by Step)

### When Creating a New Language Card

1. **Start with auto-populated fields:**
   - Run `node scripts/build-language-tree.mjs --enrich` → populates `classification` from Glottolog
   - Record `"glottolog-{version}"` in `dataSources`

2. **Add CLDR data:**
   - Lookup plural rules, quote marks, script code from CLDR
   - Record `"cldr-{version}"` in `dataSources`

3. **Research speaker demographics:**
   - Check national census data FIRST
   - Cross-reference with Ethnologue (if available)
   - Cross-reference with UNESCO Atlas
   - Record ALL sources consulted in `dataSources`

4. **Verify method support:**
   - Check EACH API's language list (not memory, not assumptions)
   - Record verification date

5. **Research contact influences:**
   - Find published historical linguistics papers
   - Document period, type, depth with citations
   - If no published source exists, add `"citation_needed": true` to the influence entry

6. **Research vitality:**
   - Check Ethnologue for EGIDS
   - Check UNESCO Atlas for endangerment status
   - Note any discrepancies between sources

7. **Populate `dataSources`:**
   - List EVERY source consulted (not just those that provided data)
   - Use the citation format from the tables above

### When Updating an Existing Card

1. **Never change a factual claim without updating `dataSources`**
2. **If you update a speaker count**, remove the old source and add the new one
3. **If you add method support**, verify against the API and record the date
4. **Date-stamp all method support checks** — API coverage changes frequently

---

## 4. Proposed Schema Enhancement: Per-Field Citations

### Current Schema (Flat `dataSources`)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**Problem:** Which fields came from CLDR? Which from Glottolog? Which are uncited?

### Proposed Enhancement: Structured `dataSources`

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### Migration Path

This is a **backwards-compatible** change:
1. Existing cards keep the flat array (still valid)
2. New cards use the structured format
3. Schema validation accepts both formats
4. Migrate existing cards incrementally as they're reviewed

> [!TIP]
> **Validate with a script.** Add a `validate-citations.mjs` script that:
> - Checks every card has at least `classification` and `vitality` sources
> - Flags cards with flat `dataSources` arrays for upgrade
> - Warns on `methodSupport` entries with no date-stamped verification

---

## 5. Quality Checklist

Before merging any language card change, verify:

- [ ] Every speaker count has a source (census or Ethnologue, not Wikipedia)
- [ ] Every UNESCO/EGIDS status has a source
- [ ] Every method support flag was verified against the actual API (not assumed)
- [ ] Every contact influence has a published academic source OR is marked `citation_needed`
- [ ] Classification was auto-populated from Glottolog (not hand-built)
- [ ] `dataSources` lists ALL sources consulted
- [ ] No claim relies solely on LLM-generated knowledge
- [ ] `humanReviewed` is set to the reviewer's identifier and date if a native speaker reviewed

---

## 6. `humanReviewed` Field

The language card schema includes a `humanReviewed` field that is currently `null` on all cards. This field should be populated when a native speaker or qualified linguist reviews the card:

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **Community review is the gold standard.** Automated data and academic papers provide the foundation, but a native speaker's review is the final validation. This is especially critical for:
> - Contact influence claims (community members know what borrowed words are actually used)
> - Vitality assessments (community members know if children are speaking the language)
> - Formality systems (academic descriptions may miss everyday usage patterns)

---

## 7. References for This Procedure

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — Free
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Unicode Terms of Use
5. Ethnologue: https://www.ethnologue.com — Proprietary (subscription)
6. UNESCO Atlas: http://www.unesco.org/languages-atlas/ — Free
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Champollion Language Card Spec: `cli/website/docs/reference/language-card-spec.md`
