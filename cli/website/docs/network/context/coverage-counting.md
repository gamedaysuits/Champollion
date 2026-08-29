---
sidebar_position: 6
title: 'Coverage Counts: How We Count Them'
description: How Champollion counts "languages with machine translation" — the two tiers (any engine vs. deployed service), the SSOT every displayed number is read from, and the refresh discipline. Correction welcome.
---

# Coverage Counts: How We Count Them

> **Executive summary.** When the site says **552 living languages have any machine
> translation** and **196 are served by a deployed service**, those are two different,
> deliberately separate counts. This page defines both tiers, names the single source
> of truth each number is read from at build time, and describes how the lists get
> refreshed. Coverage is a *claim of existence*, never a claim of quality.

## The two tiers

**Tier 1 — any dedicated MT engine ("covered").** A living language counts as covered
if it appears on the published supported-language list of *any* tracked dedicated MT
engine — deployed consumer/API services (Google Translate, Microsoft Translator,
DeepL, LibreTranslate, …) **or** open research models (NLLB-200, OPUS-MT, M2M-100,
MADLAD-400, …). This is the union that lights a dot green on the network map.

**Tier 2 — deployed service ("served").** The stricter cut: the language is on the
list of an engine anyone can actually *use today* as a consumer or API service. An
open research checkpoint you would have to download, host, and serve yourself does
not count here. This is the number that answers "could a speaker translate a webpage
right now, without engineering work?"

The two tiers exist because they answer different questions, and collapsing them
overstates the world's coverage. Both are counted over **ISO 639-3 individual living
languages** only (`isoType: 'L'`).

## Where the numbers come from (nothing hand-typed)

Every displayed count is a **build-time read** of machine SSOTs — no figure on the
site is typed into prose and left to go stale:

1. **The per-engine lists** live in `cli/shared/catalogue/method-coverage.json` —
   one entry per engine, imported *cite-only* from that provider's own published
   supported-language list, with its `source_url` and an `asOf` date. Champollion
   does not audit or reproduce these lists; they are the providers' own claims.
2. **The build intersects** those lists with the living-language index and emits the
   tier counts into the site's build stats (`stats.coverage.dedicatedLiving` for
   tier 1, `stats.coverage.serviceLiving` for tier 2, over `stats.livingTotal`
   living languages).
3. **Pages render the stats**, and a pre-push parity gate fails the build if prose
   and stats ever drift.

## "194 languages" and "187 languages" can both be true

A provider's list and a count of *languages* are not the same object, so each
entry in the SSOT declares which one its number is:

- **`publisher-list-rows`** — the length of the provider's own published list,
  exactly as they publish it. Google's Cloud Translation page lists **194** rows
  for its NMT model; that is the figure this site attributes to Google by name.
- **`champollion-derived-enumeration`** — *our* collapse of that list to distinct
  ISO 639-3 base languages. Those same 194 Google rows are **187** languages,
  because `zh-CN` and `zh-TW` are one language in two scripts, as are `pt-PT`
  and `pt-BR`, and so on. This number is ours, never the provider's.
- **`publisher-stated-headline`** — a total the provider asserts with no list
  published behind it. Nothing may be derived from it.

The gap between the first two is arithmetic, not disagreement, and it runs
through every provider: Microsoft 135 rows → 128 languages, LibreTranslate 49 →
47, NLLB-200's 200 FLORES variants → 196. The map and the tier counts read the
*enumerated list*, never the headline. A pre-push gate fails the build if an
entry's declared basis and its list ever contradict each other.

Note also that a provider may publish several lists. Google's page carries a
separate table for its Translation LLM tier (127 rows as of 2026-08-16) and
states no combined total at all — so "how many languages does Google support?"
has no single published answer, and this site does not invent one.

## Claimed coverage is not quality — and not always deployable

A language on a provider's list means the provider *claims support*, nothing more.
Two honesty notes the site applies everywhere these counts appear:

- **Coverage ≠ quality.** Whether the translations are any good is a separate,
  measured question — that is the entire point of the benchmark network. Quality
  claims live on the leaderboard, keyed by (method, dataset, metric); coverage
  claims live here.
- **Claimed ≠ deployable.** Research breadth models can claim very large language
  counts while their own documentation reports usable quality for a much smaller
  subset. Where a provider publishes such a self-assessment, the site shows the
  claimed count *and* the provider's own deployable/quality figure, each cited to
  the provider's materials.

## The refresh discipline

Provider lists change; the counts must follow, mechanically:

- Each entry in `method-coverage.json` carries its own `asOf` date, and the file
  carries a top-level `asOf` — the date of the last sweep. Surfaces that show
  coverage counts display or link this date.
- A **SOTA sweep** (re-checking every provider's published list, adding newly
  tracked engines) is a periodic maintenance task; the sweep updates the SSOT, and
  every count on the site follows at the next build. Nothing needs to be "remembered"
  in page copy.
- Between sweeps, the counts are exactly as fresh as their `asOf` dates — which is
  why those dates are part of the data, not a footnote convention.

## Correction and debate welcome

If a provider's list has changed, a language is misclassified, or you think a tier
boundary is drawn wrong, tell us — open an issue at
[github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues)
or email [info@champollion.dev](mailto:info@champollion.dev).

---

## Sources

- **Per-engine lists** — `cli/shared/catalogue/method-coverage.json`: each engine's
  own published supported-language list (cite-only; `source_url` + `asOf` per entry).
- **Living-language set** — ISO 639-3 individual living languages (`isoType: 'L'`)
  in the language index built from the cited language cards.
- **Tier counts** — build-emitted `stats.coverage.dedicatedLiving` (tier 1),
  `stats.coverage.serviceLiving` (tier 2), `stats.livingTotal`. Champollion-derived.
- **The population estimate built on these counts** — see
  [The Coverage Gap: How We Estimate It](/docs/network/context/coverage-gap-estimate).
