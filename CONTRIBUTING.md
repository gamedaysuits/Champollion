# Contributing

> To contribute to this project you will need the [MT Eval Arena](https://github.com/gamedaysuits/Champollion) harness (located in the `arena/` directory). The eval harness is where translation methods are developed, benchmarked, and validated before being deployed through champollion.

Thank you for your interest in contributing to the Champollion translation ecosystem. This is a project about building machine translation for languages that commercial services will never support — and we need many different kinds of help.

## Ways to Contribute

### If you speak a low-resource language

You don't need to be a programmer. You are the most valuable contributor we have.

- **Build reference translations**: We need curated parallel text pairs for benchmarking. If you speak English and a low-resource language, you can create the ground truth that all methods are evaluated against.
- **Review translations**: Every method that claims to produce working translations needs human validation. Bilingual speakers review outputs and tell us whether the computer got it right — and more importantly, *why* it got it wrong.
- **Write coaching data**: Grammar rules, dictionary entries, morphological patterns — these are the linguistic resources that make translation methods work. Your knowledge of how your language works is irreplaceable.

See the [Evaluation Datasets](https://champollion.dev/docs/network/leaderboard/datasets) for the corpus format and quality requirements. **Don't want to write JSON?** No problem. We accept translation sets in spreadsheets (CSV/Excel) or through simple web forms. Reach out, and we'll format the data for you.

### If you're an ML engineer or researcher

- **Build a translation method**: Implement the `TranslationMethod` protocol and benchmark it against standardized corpora. The interface is simple: `async translate(entries, config) → [{id, predicted}]`. What happens inside your method is up to you.
- **Improve metrics**: The composite scoring system has known limitations. Better metrics for morphologically rich languages are an open research question.
- **Run benchmark sweeps**: Systematic evaluation across models, prompts, and configurations produces data that benefits the whole community.

See the [FST-Gated Pipeline tutorial](https://champollion.dev/docs/network/tutorials/fst-gated-pipeline) for a step-by-step example.

### If you're a developer

- **Improve the tooling**: The eval harness and champollion are both open source. Bug fixes, performance improvements, and new features are welcome.
- **Add language support**: Language cards, script converters, and method integrations all need to be built for each new language. See the [Supported Languages](https://champollion.dev/docs/reference/supported-languages) reference.
- **Build the infrastructure**: Cryptographic test set encryption, community review interface, leaderboard — much of the planned infrastructure hasn't been built yet.

### If you represent a language community or governance organization

- **Partner with us on key custody**: We're building cryptographic key custody into the benchmark infrastructure — governance organizations hold the encryption keys for their evaluation datasets. See the [Data Stewardship](https://champollion.dev/docs/network/sovereignty/data-sovereignty) guide.
- **Set terms for benchmark participation**: Terms are set per corpus and per contest by the community that owns the data — there is no universal platform agreement, by design. A community providing a secret test corpus can sponsor a prize contest, and the default template transfers full ownership of the winning method to the language community — so the community owns the resulting technology and everything it might ever earn from it (Champollion is non-commercial and takes no share). See [Ownership & Terms](https://champollion.dev/docs/network/sovereignty/ownership-transfer).

## Our place in the ecosystem (upstream-first policy)

Champollion is a thin, opinionated layer **on top of** the field's standard tools —
not a replacement for them. Two rules keep it that way:

1. **Depend, don't reinvent.** Metric computation and canonical test-set fetching
   use **sacreBLEU** (with reproducible signatures); neural metrics use the
   maintained **COMET / MetricX / XCOMET / CometKiwi** libraries. If a
   well-maintained tool already does it, we take a dependency on it — we do not
   hand-roll our own copy. A PR that reimplements a standard tool will be asked to
   delegate to it instead.
2. **Contribute upstream.** When we produce something genuinely reusable by the
   wider field — a clean test set, a metric, contamination metadata, or a fix to a
   tool we depend on — we send it **upstream** (sacreBLEU, OLDI, COMET, the
   relevant project), not only into our tree. Being a good ecosystem citizen is
   both correct and how we earn credibility with the research community.

Champollion's own code lives strictly **above** the metric/fetch layer: running
the systems under test, governing the data (licenses, contamination lanes,
sovereignty), the public crowd-reported leaderboard, and the mesh. That is where
our contributions belong — and it is what makes us *open, contamination-honest,
crowd-reported MT-eval infrastructure that respects every license and steward's
terms* rather than another metric script.

## Getting Started

### End Users

If you just want to use the Champollion CLI to translate your projects, **you do not need to clone this repository**. Simply run:
```bash
npx champollion init
```

### Core Contributors

If you are developing the infrastructure, translating methods, or running benchmarks, you will need the full monorepo:

1. **Clone the workspace**:
   ```bash
   git clone https://github.com/gamedaysuits/Champollion.git
   cd Champollion
   ```

   This monorepo is the single source for the whole project — `cli/` (champollion CLI), `arena/` (eval harness), `mcp-server/`, and the website all live here, and all contributions land here. There are no mirror repositories to fork or track. Read the [Bridge Guide](https://champollion.dev/docs/guides/bridge) to understand how the components work together.

2. **Set up the eval harness** (Python 3.10+):
   ```bash
   cd arena
   pip install -e .
   ```

3. **Set up champollion** (Node.js 20+):
   ```bash
   cd cli
   npm install
   npm link  # makes the CLI available globally
   ```

### Running Tests

```bash
# champollion CLI
cd cli && npm test

# Eval harness
cd arena && pytest
```

### Git hooks (required: sovereignty + dogfood gates)

This repo ships its hooks in `.githooks/` instead of `.git/hooks/`. **Activate them once per clone:**

```bash
git config core.hooksPath .githooks
```

The `pre-push` hook chains two checks (bypass the whole chain with `git push --no-verify`):

1. **Sovereignty gate** (`scripts/quarantine_gate.sh`) — a **hard block**. NC / no-redistribute corpus content must never enter the open-source set. The blunt rule and the gate's contract are documented in the private planning set (`docs/DATA_BOUNDARIES.md`); the gate script itself ships in `scripts/`.

2. **Champollion dogfood translation gate** (`scripts/champollion_sync_gate.sh`) — we use our own tool: the website locale files are **champollion output, never hand-edited**. On push, this runs `champollion sync` over `cli/website/` (12 target languages; the Arena docs are merged in under `cli/website/docs/network/`) so the translations always match the English source. Sync is incremental — its translation memory means a no-change push re-translates nothing, so cost stays bounded.

   **Provider keys:** the gate reads translation-provider keys from `.env.local` (repo root, then `cli/.env.local` / `arena/.env.local`) and exports them so champollion's loader finds them — `OPENROUTER_API_KEY` is the one both sites use by default; `GOOGLE_TRANSLATE_API_KEY`, `DEEPL_API_KEY`, `MICROSOFT_TRANSLATOR_API_KEY`, and `LIBRETRANSLATE_API_URL` are also honored. (Only translation keys are exported — never the Supabase service key.)

   **Block-then-commit workflow:** if sync regenerates any translation, the push is **aborted** with the list of changed sites. Commit the regenerated locale files and push again:

   ```bash
   git add cli/website                        # the site the gate names
   git commit -m "chore(i18n): champollion-regenerated translations"
   git push
   ```

   **Graceful degradation:** if no key is present, or the network/API is unavailable, the gate prints a warning and **allows** the push (it never bricks pushing). Toggles:
   - `CHAMPOLLION_SYNC_STRICT=1` — turn those warnings into hard blocks.
   - `CHAMPOLLION_SYNC_SKIP=1` — skip the dogfood gate for one push.
   - `CHAMPOLLION_SYNC_TIMEOUT=N` — per-site sync timeout (seconds, default 900).
   - `CHAMPOLLION_SYNC_ARGS="…"` — extra flags passed to `champollion sync`.

   **What it does NOT cover:** champollion translates the Docusaurus i18n JSON (UI strings, navbar/footer, docs `current.json`) and the mirrored `docs/`/`blog/` Markdown. It cannot reach hardcoded English in React/JS components that isn't wrapped for i18n (so it never lands in `code.json`), `docusaurus.config.js` values, or raw HTML attributes — wrap those strings with `<Translate>` / `translate()` so they flow into the locale files.

### Code Style

- **JavaScript**: No build step, no TypeScript, no bundler. Pure ES modules with JSDoc types.
- **Python**: Standard Python conventions. Type hints encouraged.
- **Comments**: Explain *why*, not *what*. Every non-obvious decision should have a comment.
- **Commits**: Descriptive commit messages. Reference issues where applicable.

### Factual claims & citations

Champollion is an **index, not an arbiter**. Any factual claim you add to the
public site or a language card must cite a source that actually states it, and
report what that source measured — no promoting a coded feature bit or one
estimate into an unqualified "fact," and no manufacturing consensus when sources
disagree (show them all, attributed).

- **Derived/aggregated values** carry `champollion-derived` provenance and never
  wear an upstream's name (see `docs/FACT_PROVENANCE_AUDIT.md`).
- **Run results** (chrF/BLEU/COMET/TER, FST acceptance, %-valid) live on the
  leaderboard/edge, never on a language card — enforced by R1–R4 in
  `scripts/card_integrity_gate.sh` (runs in the pre-push hook).
- **Homepage claims** are mirrored in `cli/website/CLAIMS.md`; update the ledger
  in the *same change* as the page. See `docs/audit/claims-audit.md`.

## Submitting Changes

1. Fork this repository — it is the one public home for the project; pull requests are not accepted anywhere else
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes with tests
4. Run the test suite and ensure it passes
5. Submit a pull request with a clear description

For method submissions to the leaderboard, see the [Leaderboard Rules](https://champollion.dev/docs/network/leaderboard/rules).

## Code of Conduct

We are building technology for language communities. Respect for those communities — their data, their governance, their decisions — is non-negotiable. Extractive behavior (scraping community language resources, publishing translations without consent, training models on community data without agreement) is grounds for immediate removal from the project.

## Questions?

Open an issue or start a discussion. We're happy to help you find where your skills can have the most impact.
