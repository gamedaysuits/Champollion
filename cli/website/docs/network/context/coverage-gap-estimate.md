---
sidebar_position: 5
title: 'The Coverage Gap: How We Estimate It'
description: How Champollion justifies the "more than a billion people" figure — the method, the two judgment calls behind it, and why the site deliberately reports a conservative floor. Correction and debate welcome.
---

# The Coverage Gap: How We Estimate It

> **Executive summary.** Champollion's homepage says *more than a billion* people alive today cannot get machine translation into their first language. This page shows the arithmetic behind that phrase, names the two judgment calls that move the number, and explains why we publish a conservative floor rather than the larger raw total. Champollion is an index, not an authority — every figure here is derivable from the public build, and correction is welcome.

## The question we are actually asking

Not "how many languages lack MT," but **how many people cannot get machine translation into their first language.** A person's first language (L1) is the one they think in and would most want to read the news in. Bilingualism does not remove anyone from this count: a Quechua–Spanish bilingual whose first language is Quechua still cannot read a webpage *in Quechua*. So the target population is: everyone whose L1 is one of the living languages that no dedicated MT engine serves.

## How this number is computed

Two ingredients, both in the repository:

1. **Which living languages have MT.** The build intersects the union of nine tracked engines' language lists (Google, Microsoft, DeepL, LibreTranslate, NLLB-200, OPUS-MT, M2M-100, MADLAD-400, Tilde — `shared/catalogue/method-coverage.json`, each list cited and dated) with the ISO 639-3 *individual living* languages (`isoType: 'L'`) in `data/tc-index.json`. Result: **552 living languages covered, 6,525 uncovered**, out of **7,077** living languages total (`stats.coverage.dedicatedLiving` / `uncoveredLiving`).
2. **How many people speak the uncovered ones.** For each uncovered living language we take its `speakerCount` (drawn from the language card's cited estimates) and sum. The build emits this as `stats.coverageGap`. The raw sum over all 6,525 uncovered languages is about **2.9 billion** (`uncoveredSpeakerSumRaw` ≈ 2,974,871,273).

That 2.9 billion is an **upper-ish** figure, and we say so plainly.

### Why the raw sum is not clean

`speakerCount` blends first-language (L1) and total (L1+L2) speakers depending on what each source reports, and a multilingual person can be counted under more than one language. The tell: summing `speakerCount` across *all* 7,082 living languages gives roughly **10.8 billion** — more than the ~8.1 billion people alive (UN World Population Prospects). A clean L1 census cannot exceed world population; this one does, which proves the field is not pure L1.

## Two judgment calls (each moves the number)

**(a) L1-only vs. total counts.** Restricting to first-language speakers would lower the estimate — L2 speakers are, by construction, people who *have* another language. But per-language L1 figures are not uniformly available in the sources we cite, so we cannot apply an L1-only rule everywhere without inventing numbers. Using the blended count pushes the estimate *up*.

**(b) The 777 uncovered languages with no reported count.** Of the 6,525 uncovered living languages, **5,748 carry a speaker figure and 777 do not** (`uncoveredWithCount` / `uncoveredNoCount`). Setting the 777 aside — which is what the raw sum does — *undercounts*, because those are real languages with real (unmeasured) speakers, most of them small and endangered.

So the two errors point in opposite directions: the L1/L2 blend inflates, and the 777-language tail deflates.

## Why we report a floor of "more than a billion"

The plausible range runs from a floor near **1 billion** up to the raw **~2.9 billion**. Even after discounting hard for L2 double-counting *and* setting aside the entire unmeasured 777-language tail, the first-language population of the uncovered languages remains comfortably over one billion. Rather than headline the larger, messier number, the site reports the conservative end. "More than a billion" is the claim we are most confident survives scrutiny.

## What could change it

A sharper estimate needs **per-language L1 speaker figures, each with a citation**, so we could sum L1 directly instead of the L1/L2 blend, and could put a defensible estimate on the 777 currently-uncounted languages. As engines add languages, 552 rises and the gap narrows; as cards gain better-sourced counts, the sum tightens. This is an **ongoing estimate**, recomputed on every build — not a fixed fact.

## Correction and debate welcome

If you have better data, think a decision here is wrong, or can source the missing 777, tell us. That is the point. Open an issue at [github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues) or email [info@champollion.dev](mailto:info@champollion.dev).

---

## Sources

- **Coverage** — `cli/shared/catalogue/method-coverage.json` (nine engines, each list cited and dated) ∩ ISO 639-3 individual living languages in `cli/website/data/tc-index.json`; surfaced as `stats.coverage.dedicatedLiving` / `uncoveredLiving`. Champollion-derived.
- **Speaker sums** — `speakerCount` on `tc-index.json` rows (from each language card's cited `speakerEstimates`), summed by the build into `stats.coverageGap` (`uncoveredSpeakerSumRaw`, `uncoveredWithCount`, `uncoveredNoCount`). Champollion-derived; blends L1/L2 by source.
- **World population** — roughly 8.1 billion (United Nations, *World Population Prospects*), used only as a sanity bound on the speaker sums.

## Where this leads on this site

These numbers are the size of the problem. The site's answer to it starts
at [What Champollion Is](/docs/what-is-champollion); the methodology behind
the covered/uncovered split is in
[how coverage is counted](/docs/network/context/coverage-counting), and the
languages on the wrong side of the line — ranked by who could most
plausibly build an evaluation set next — are published in the
[corpus wish-list](https://champollion.dev/corpus-wishlist.json).
