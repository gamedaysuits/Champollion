# Champollion

**Source-available infrastructure for trustworthy machine translation across
every language — free for noncommercial use; the evaluation harness and shared
registries are open source.** We build the test sets and the map that make
translation trustworthy:
who can translate what, how good each method is on each kind of text, and where the
gaps still are. It runs on two kinds of benchmark — **public benchmarks** on open
data that map and rank every method cheaply and openly, and **sovereign
benchmarks**, secret test sets that communities create, own, and control, and that
Champollion never sees (the gold standard). The infrastructure itself is
source-available and singly stewarded; what belongs to a community are the test sets for
their language and the methods built for it. Built with professionals and
communities, never scraped from them — they hold the keys. **Every method is
welcome, human and machine.**

**In one line:** Champollion is source-available machine-translation research
and development tooling, free for noncommercial use — crowdsourced evaluation
infrastructure where every method is welcome, every license is respected, and
corpora stay with their stewards.

It is a **non-commercial research project**: nothing here is monetized, and
nothing a community or contributor owns carries any platform claim.

### What it's built on — and what it adds

We stand on the field's standard tools and don't reinvent them. Metric computation
and canonical test-set fetching come from **sacreBLEU**; neural metrics from
**COMET / MetricX / XCOMET / CometKiwi**. We depend on those, never reimplement
them, and send improvements upstream (see [CONTRIBUTING](CONTRIBUTING.md)). Those
are the tape measure. Champollion is the surveying firm built around it:

- **It runs the systems.** A metric tool grades a translation; it never produces
  one. Champollion executes the methods (commercial engines, open models, LLMs raw
  and coached) — and the test-in-Python / ship-in-npm pipeline.
- **It governs the data.** A catalogue with licenses, contamination grades, and
  domains — plus **data stewardship: sealed community corpora that Champollion
  never sees, held under their stewards' own terms (informed by Indigenous data-sovereignty principles — community ownership and control of language data).** Standard
  tools have a flat list of files; we have a governed Index.
- **It says whether a score can be trusted.** Contamination lanes stop memorized
  benchmarks from masquerading as real quality — a metric tool hands you the
  number regardless.
- **It reports in public.** A crowd-contributed leaderboard and a one-line
  `curl | bash` to contribute compute — not a one-person local run that vanishes
  when the terminal closes.
- **It maps the network.** The mesh measures and routes across the graph of
  language pairs, surfacing where coverage is still thin.

The metrics are shared, standard tools; what Champollion adds is the layer
around them — governed data, honest scores, and the mesh.

## Repository Structure

**One project, one repo, one webpage.** This monorepo is the single source for
Champollion: all code, docs, and research live here, and there are no repo
mirrors to keep in sync. Distribution happens through package registries and
the website, not through copies of this tree:

- **npm** — [`champollion`](https://www.npmjs.com/package/champollion) (the CLI)
  and [`champollion-mcp-server`](https://www.npmjs.com/package/champollion-mcp-server)
- **PyPI** — [`mt-eval-harness`](https://pypi.org/project/mt-eval-harness/) (the eval harness)
- **Web** — [champollion.dev](https://champollion.dev), built by Vercel from
  `main` (`cli/website/`)

**No subtree mirrors exist or will be pushed.** The one exception to
one-repo is [`lyss`](https://github.com/gamedaysuits/champollion-LYSS), which
keeps its own repository purely as a license boundary — its interim
permission-only license (see [License](#license)) must not blur into the
monorepo's PolyForm-NC/Apache/AGPL code. Development still happens here in `lyss/`.

| Directory | Description |
|-----------|-------------|
| [`cli/`](cli/) | **Champollion CLI** — i18n translation tool (`npm install champollion`), PolyForm Noncommercial 1.0.0 |
| [`mcp-server/`](mcp-server/) | **MCP server** — `champollion-mcp-server` on npm |
| [`arena/`](arena/) | **MT eval harness** — evaluation harness & leaderboard (`pip install mt-eval-harness`), AGPL |
| [`lyss/`](lyss/) | **champollion-lyss** — standalone Cree eval-standard plugin (FST/gloss validation, fail-honest; code only, no bundled data — FST and glosses are fetched at runtime); own repo + [PyPI](https://pypi.org/project/champollion-lyss/) for its license boundary |
| `crk-translate` | **crk-translate** — Cree (nêhiyawêwin) translation pipeline. **Extracted out of this monorepo (2026-06-23)** to its own repo at `../champollion-crk-translate`; no longer in this tree. Private and experimental |
| [`mt-eval-arena/`](mt-eval-arena/) | **Database infrastructure** — Supabase migrations, data build/upload scripts |
| `arena/scripts/corpora-builder/` | **Corpora Builder** — corpus construction tooling (private; not in the public repo) |
| [`forge/`](forge/) | **nmt-forge** — NMT training suite (guardrails, grammar-cited synthesis, fenced training loop); consumes the harness for ALL scoring, implements zero metrics. PolyForm Noncommercial 1.0.0 |
| `docs/api-service/` | **Champollion Translate API** — design docs only, no code yet (private planning set; not in the public repo) |
| [`shared/`](shared/) | **Cross-runtime data (SSOT)** — model aliases, method registry, and queue-selection vectors loaded by both the Python harness and the JS CLI/MCP server. `shared/licenses.json` is the **CLI-only** license register (card linter, queue generator); the harness keeps its license logic in `arena/mt_eval_harness/license_use.py` over `arena/datasets/registry.json` |
| `docs/` | **Internal planning** — vision, roadmap, working notes (private; not in the public repo) |
| `.vault/` | **Research vault** — early-stage research, landscape analysis; local-only, never published |

## Documentation Map

This project has **three** documentation sets. Each has one canonical location.

(This section said "two" until 2026-07-31 while the rule underneath it said
"three" — and the third set, `references/`, went undeclared for long enough
that two of its files forked against the public site.)

### 1. Champollion — Public Docs (the single champollion.dev site)
📁 [`cli/website/docs/`](cli/website/docs/) — includes the **Network** section
(formerly the MT Eval Arena) under [`cli/website/docs/network/`](cli/website/docs/network/)
🌐 Deploys to: champollion.dev — one Docusaurus build with one nav/search/theme.
The Arena site was merged in and retired (2026-06-20); old `mtevalarena.org/*`
and `champollion.dev/arena/docs/*` URLs 301 to `champollion.dev/docs/network/*`.
👥 Audience: developers using `champollion`, plus researchers, method submitters, and Network users

### 2. Internal & Sensitive — Planning Docs
📁 `docs/` — private; not included in the public repo
📋 Start here: `docs/INDEX.md` (navigation) · `docs/AGENTS.md` (agent guide)
🔒 Never published
👥 Audience: core team only

### 3. Research Library — Source Material
📁 `references/` — private; not included in the public repo
📋 Start here: `references/README.md`
🔒 Never published
👥 Audience: whoever is writing the other two sets

The polished research *input* library: primers (language, linguistics,
tokenizers, semantics), domain briefings (data sovereignty, Indigenous MT
partnerships, Cree history and the Alberta study, MESC) and landscape scans
(competitive, dataset, endangerment frameworks, Philippine languages). It is
where a claim gets researched **before** it is written into a planning doc or a
public page. Promotion runs `.vault/` → `references/` → `docs/` or the public
site.

Public pages derived from it are rewritten outward for readers who arrive
knowing nothing, and the derived copy is the canonical one — see the stamp on
`references/Research Papers/mt-field-briefing.md`.

> **Rule:** Every document has exactly one canonical location in one of the three sets above. Internal docs and `references/` may reference public docs; public docs must never reference either. References are unidirectional: private → public.
>
> Enforced by `scripts/check_docs_integrity.py`.

## License

Champollion is source-available — free for noncommercial use, with open-source
components. The product lanes (CLI, forge, MCP server) are PolyForm
Noncommercial; the protocol-and-verifiability lanes (eval harness, shared
registries, database machinery) are open source (AGPL / Apache-2.0), so the
evaluation standard can spread and the sovereignty machinery can be inspected
by anyone. Commercial licenses for the noncommercial components can be granted
case-by-case (founder decision, 2026-08-17).

- **Arena** (`arena/`): [GNU Affero General Public License v3.0 or later](arena/LICENSE) — public, open-source — **with a §7 Eval-Standard Plugin exception** ([arena/LICENSE-EXCEPTION.md](arena/LICENSE-EXCEPTION.md)) permitting the harness to combine with separately-/noncommercially-licensed eval-standard plugins via the public plugin interface
- **CLI** (`cli/`): [PolyForm Noncommercial License 1.0.0](cli/LICENSE) — source-available, free for noncommercial use; commercial use requires permission; `cli/LICENSE` is authoritative for the published `champollion` npm package (relicensed from Apache-2.0 on 2026-08-17, before any release shipped)
- **forge** (`forge/`): [PolyForm Noncommercial License 1.0.0](forge/LICENSE) — same terms as the CLI (relicensed from AGPL-3.0-or-later on 2026-08-17, before any release shipped)
- **MCP server** (`mcp-server/`): [PolyForm Noncommercial License 1.0.0](mcp-server/LICENSE) — same terms as the CLI; covers the published `champollion-mcp-server` npm package
- **shared** (`shared/`) and **mt-eval-arena** (`mt-eval-arena/`): [Apache License, Version 2.0](shared/LICENSE) — open source
- **lyss** (`lyss/`): [Champollion-LYSS Interim License — use by permission only](lyss/LICENSE) (`LicenseRef-Champollion-Interim-Permission-Required`) — source-available, not OSI; permission is ordinarily granted without charge for noncommercial research, education, and community-benefit use, and **no commercial use** is permitted pending consultation with the nêhiyaw language community; see `lyss/NOTICE` for the data-sovereignty terms
- **crk-translate** (now in its own repo, `../champollion-crk-translate`): GNU Affero General Public License v3.0 — code and FST-derived data (EdTeKLA-derived eval data remains CC BY-NC-SA 4.0; Wolvengrey-derived dictionary data is unlicensed pending permission)

See [LICENSE](LICENSE) for details; the full license register lives in the private planning set (`docs/LICENSING.md`).
