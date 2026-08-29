# Champollion-LYSS

**Community language-validation plugins for the [MT Eval Harness](https://github.com/gamedaysuits/Champollion).**

Part of **Champollion** — open-source infrastructure for trustworthy machine
translation across every language, built *with* communities and never scraped from
them. The infrastructure is open-source and singly stewarded; the test sets and the
methods for a community's language belong to that community. LYSS is how a language
community's own validation standard travels into the harness on its own terms.
Explore the wider network at
[champollion.dev/docs/network](https://champollion.dev/docs/network/).

LYSS plugins are the *referee* of MT evaluation: FST-gated linters and semantic
validators that judge whether a translation is **morphologically valid and
meaning-preserving** in the target language — signals that surface metrics
(chrF++, BLEU) cannot see. They live with the **language**, not with any
translation method, so they score every method fairly.

The harness stays strictly **language-neutral**: it ships no language-specific
scorer code. Instead it **fetches and loads** the relevant LYSS plugin on demand,
driven by a language card's `evalMetrics` / `evalStandard` declaration.

This repo is the home for *all* such plugins. Today:

| Language | Plugin module | Metrics |
|----------|---------------|---------|
| Plains Cree (nêhiyawêwin) `crk` | `champollion_lyss.crk` | `lyss-eq` (variant-class equivalence linter), `lyss-sem` (FST-lemma + gloss + content-word overlap) |

## Install

> This package is **code only** — it bundles no FST, gloss, dictionary, or
> corpus content; those are fetched at runtime as separate, separately-licensed
> resources. Use is by written permission (ordinarily granted free for
> noncommercial research, education, and community-benefit use); see
> [LICENSE](LICENSE) and [NOTICE](NOTICE).

```bash
pip install champollion-lyss            # core (linters)
pip install "champollion-lyss[crk]"     # + spaCy for the Cree semantic validator
```

The harness installs this automatically when an evaluation targets a language
whose card declares a LYSS standard (`mt-eval setup --lang crk`).

## Data sovereignty & responsible use

This package ships **code only** — it bundles **no** dictionary, gloss, lexicon, or
corpus data. The Plains Cree validation standard and any Cree language data are
treated as the **property of the nêhiyaw (Plains Cree) language community** and are
offered for **non-commercial, community-benefit** use, aligned with Indigenous data
sovereignty principles. Ownership is split deliberately: Champollion
maintains at most the GENERIC evaluation methodology (the LYSS standard);
the Cree instantiation — the linguistic knowledge it validates against — is
not ours, and models or artifacts built for Cree are governed by the
community (see the Derived-Artifacts Commitment on champollion.dev).
Commercial use of the Cree standard is reserved
pending community consent. The full statement is in the [`NOTICE`](NOTICE) file, which
travels with every redistribution.

Language-specific resources are obtained at runtime — **fetched, never scraped or
bundled**:

- **Glosses → itwêwina API.** The Cree semantic validator fetches glosses per-lemma
  from the public itwêwina API (`itwewina.altlab.app`) and caches them under
  `~/.mt-eval/itwewina-cache/`. The underlying dictionary content (Wolvengrey CW,
  Maskwacîs MD, AECD) is **not openly licensed**: the cache is for your own local use
  only — never commit, redistribute, publish, or bundle it.
- **IP acknowledgment.** Before any gloss is fetched you are shown the terms and must
  acknowledge them. In automation set `CHAMPOLLION_LYSS_ACCEPT_IP=1` (CI / harness
  auto-setup acknowledge automatically; the notice is always printed).
- **FST → downloaded, invoked as a separate tool.** Morphological analysis uses a
  finite-state transducer (e.g. the GiellaLT/ALTLab Plains Cree FST, AGPL) that the
  harness fetches on demand to `~/.mt-eval/fsts/crk/`. It is **never bundled into or
  linked into** this package.
- **Fail honestly.** If the FST, the spaCy model, or the gloss API is unavailable (or
  IP terms are unacknowledged), the affected score is reported as **unavailable** —
  never fabricated or substituted with synthetic data (human-validated data only).
- **Inline grammar facts are cited, not extracted.** The small hand-curated lists in
  the code (optional particles, lemma-synonym pairs, structural words) are
  widely-published, cross-referenced facts of Plains Cree grammar — citable to multiple
  published grammars and lexica, references to published fact, not bulk-extracted data.

## License

**Use by permission only** (interim; SPDX
`LicenseRef-Champollion-Interim-Permission-Required`, see [`LICENSE`](LICENSE)).
The Plains Cree standard is built on ALTLab/GiellaLT infrastructure and published
Cree scholarship, and it encodes decisions that properly belong with the nêhiyaw
language community. Until those consultations have happened, we take the
conservative posture: **written permission is required for any use** — and is
ordinarily granted without charge for noncommercial research, education, and
community-benefit use. No commercial permission is granted at all, pending
community consent. Source-available, not OSI "open source", and deliberately so
for now.

In code terms the package stays independent of the data it fetches and the tools
it invokes: the GiellaLT/ALTLab Cree FST (AGPL) is invoked as a **separate
downloaded tool**, never bundled or linked, and no licensed dictionary/corpus
data is shipped. The permission requirement is a stance about *authority over
the standard*, not a claim that this code embeds ALTLab's.

The MT-Eval Harness this plugs into is AGPL-3.0, and grants an **additional
permission under AGPL §7** allowing the harness to combine with separately-licensed
eval-standard plugins like this one through its public plugin interface — so a
permission-gated plugin and the AGPL harness compose cleanly.

## Monorepo note

Development happens in the Champollion monorepo (`lyss/`). This standalone
repository exists purely as a **license boundary** — the interim
permission-only license must not blur into the monorepo's Apache/AGPL code —
and receives deliberate snapshot updates from the monorepo (there is no
automatic mirroring).
