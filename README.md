# Champollion

**On rails, with guardrails.** Machine translation development and deployment
on rails, built with low-resource and Indigenous language communities in mind.

A project on your own computer takes you, one step at a time, from the files a
community keeps — spreadsheets, Word tables, word lists, Toolbox or LIFT
dictionaries, ELAN transcriptions — to a measured model, and then to your own
translation API or your app's locale files. An AI agent (or you) runs the steps;
the people who hold the language make the calls that matter: where its sentences
may go, what counts as good enough, and what ships. The rails promise process,
not quality: you will know how good a model is, not that it is good — and a first
small community model is usually a measured phrasebook.

**In one line:** source-available MT development tooling, free for noncommercial
use, on an open-source evaluation harness — private test sets, checks for test
sentences copied into training, predictions written before scores, and data
the tools keep where it is unless its holders decide otherwise. Under the rails sits
infrastructure you can plug into but never need: public and sealed benchmarks, a
leaderboard and a cited language index. **Every method is welcome, human and
machine.** Having trouble, or want help? Let's talk: info@champollion.dev.

Champollion takes no share of anything a community earns, and
nothing a community or contributor owns carries any platform claim.

### What the rails add — and what they're built on

The rails are one project format and one journey, the same for every
language: start a project, bring in the files, protect a test set, build,
measure, improve, serve. Each step says what it will do and who decides, and
the next step is always one command (`champollion next`) or one agent tool
call. Underneath, the guardrails are code, not advice:

- **You can't fool yourself.** The test set is fenced off before anything
  trains; near-copies of test sentences are found and kept out of training;
  you write down what you expect before you see a score; every score comes
  with its uncertainty; a fallback never hides inside a measurement.
- **The data's terms travel with it.** Who holds a file, whether it may train
  a model, and whether it may leave this computer are recorded when it comes
  in, carried onto every model and output made from it, and checked before
  anything is sent anywhere. Local-only stays local unless its holders agree.
- **Deployment is the same pipeline.** A served model answers through the
  same method, gates and records it was measured with — what is measured is
  what ships — and an app's locale files are filled from that server.

We stand on the field's standard tools and don't reinvent them. Metric computation
and canonical test-set fetching come from **sacreBLEU**; neural metrics from
**COMET / MetricX / XCOMET / CometKiwi**; models come from the open model
ecosystem. We depend on those, never reimplement them, and send improvements
upstream (see [CONTRIBUTING](CONTRIBUTING.md)).

Under the rails sits infrastructure you can plug into but never need: a
catalogue of datasets with licences and contamination grades, sealed test sets
held under their holders' own terms (none from any community yet), public
benchmarks with a crowd-contributed leaderboard, and a cited language index.

## Repository Structure

**One project, one repo, one webpage.** This monorepo is the single source for
Champollion: all code, docs, and research live here, and there are no repo
mirrors to keep in sync. Distribution happens through package registries and
the website, not through copies of this tree:

- **npm** — [`champollion`](https://www.npmjs.com/package/champollion) (the CLI)
  and [`champollion-mcp-server`](https://www.npmjs.com/package/champollion-mcp-server)
- **PyPI** — [`mt-eval-harness`](https://pypi.org/project/mt-eval-harness/) (the evaluation harness)
  and [`nmt-forge`](https://pypi.org/project/nmt-forge/) (model training)
- **Web** — [champollion.dev](https://champollion.dev), built from
  `cli/website/` and deployed by the maintainers

**No subtree mirrors exist or will be pushed.** The one exception to
one-repo is [`lyss`](lyss/), which ships as its own package
([`champollion-lyss`](https://pypi.org/project/champollion-lyss/) on PyPI)
purely as a license boundary — its interim
permission-only license (see [License](#license)) must not blur into the
monorepo's PolyForm-NC/Apache/AGPL code. Development still happens here in `lyss/`.

| Directory | Description |
|-----------|-------------|
| [`cli/`](cli/) | **Champollion CLI** — the rails: projects, importing a community's files, the next step, deployment, and translating an app's locale files (`npm install champollion`), PolyForm Noncommercial 1.0.0 |
| [`mcp-server/`](mcp-server/) | **MCP server** — the rails for AI agents (six tools by default; a full profile for the rest), `champollion-mcp-server` on npm, PolyForm Noncommercial 1.0.0 |
| [`arena/`](arena/) | **mt-eval-harness** — the evaluation harness every score goes through, and the `translate`/`serve` pipeline a deployment runs on; public benchmarks and the leaderboard are built on it (`python3 -m pip install mt-eval-harness`), AGPL |
| [`lyss/`](lyss/) | **champollion-lyss** — standalone Cree eval-standard plugin (FST/gloss validation, fail-honest; code only, no bundled data — FST and glosses are fetched at runtime); own repo + [PyPI](https://pypi.org/project/champollion-lyss/) for its license boundary |
| `crk-translate` | **crk-translate** — an experimental Cree (nêhiyawêwin) pipeline, kept in a separate private repository since 2026-06-23; not in this tree |
| [`mt-eval-arena/`](mt-eval-arena/) | **Database infrastructure** — Supabase migrations, data build/upload scripts |
| `arena/scripts/corpora-builder/` | **Corpora Builder** — corpus construction tooling (private; not in the public repo) |
| [`forge/`](forge/) | **nmt-forge** — model training on the rails: split and leak checks, preregistration, a fenced training loop, export and serving; scores everything through the harness and implements no metrics of its own. PolyForm Noncommercial 1.0.0 |
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
(formerly the MT Eval Arena) under [`cli/website/docs/reference/leaderboard`](cli/website/docs/reference/leaderboard)
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
partnerships, regional language and education context) and landscape scans
(competitive, dataset, endangerment frameworks, Philippine languages). It is
where a claim gets researched **before** it is written into a planning doc or a
public page. Promotion runs `.vault/` → `references/` → `docs/` or the public
site.

Public pages derived from it are rewritten outward for readers who arrive
knowing nothing, and the derived copy is the canonical one — see the stamp on
`references/Research Papers/mt-field-briefing.md`.

> **Rule:** Every document has exactly one canonical location in one of the three sets above. Internal docs and `references/` may reference public docs; public docs must never reference either. References are unidirectional: private → public.
>
> Checked by a maintainers' script on the private side.

## License

Champollion is source-available — free for noncommercial use, with open-source
components. The product lanes (CLI, forge, MCP server) are PolyForm
Noncommercial; the protocol-and-verifiability lanes (eval harness, shared
registries, database machinery) are open source (AGPL / Apache-2.0), so the
evaluation standard can spread and the sovereignty machinery can be inspected
by anyone. Who is covered, in plain words with examples (a school, a public
hospital or clinic, a charity, a personal or research project — yes; a
for-profit business's product — no): [Who may use this](https://champollion.dev/docs/getting-started/who-may-use-this). That page is a
summary, not legal advice; each component's LICENSE governs.

- **Arena** (`arena/`): [GNU Affero General Public License v3.0 or later](arena/LICENSE) — public, open-source — **with a §7 Eval-Standard Plugin exception** ([arena/LICENSE-EXCEPTION.md](arena/LICENSE-EXCEPTION.md)) permitting the harness to combine with separately-/noncommercially-licensed eval-standard plugins via the public plugin interface
- **CLI** (`cli/`): [PolyForm Noncommercial License 1.0.0](cli/LICENSE) — source-available, free for noncommercial use; commercial use is not covered by this license; `cli/LICENSE` is authoritative for the published `champollion` npm package (relicensed from Apache-2.0 on 2026-08-17, before any release shipped)
- **forge** (`forge/`): [PolyForm Noncommercial License 1.0.0](forge/LICENSE) — same terms as the CLI (relicensed from AGPL-3.0-or-later on 2026-08-17, before any release shipped)
- **MCP server** (`mcp-server/`): [PolyForm Noncommercial License 1.0.0](mcp-server/LICENSE) — same terms as the CLI; covers the published `champollion-mcp-server` npm package
- **shared** (`shared/`) and **mt-eval-arena** (`mt-eval-arena/`): [Apache License, Version 2.0](shared/LICENSE) — open source
- **lyss** (`lyss/`): [Champollion-LYSS Interim License — use by permission only](lyss/LICENSE) (`LicenseRef-Champollion-Interim-Permission-Required`) — source-available, not OSI; permission is ordinarily granted without charge for noncommercial research, education, and community-benefit use, and **no commercial use** is permitted pending consultation with the nêhiyaw language community; see `lyss/NOTICE` for the data-sovereignty terms
- **crk-translate** (a separate private repository): GNU Affero General Public License v3.0 — code and FST-derived data (EdTeKLA-derived eval data remains under EdTeKLA's modified, sovereignty-scoped CC BY-NC-SA 4.0; Wolvengrey dictionary data is not openly licensed and is never redistributed — it is indexed as a cited source, pointer-only)

See [LICENSE](LICENSE) for details; the full license register lives in the private planning set (`docs/LICENSING.md`).
