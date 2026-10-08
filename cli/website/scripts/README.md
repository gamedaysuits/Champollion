# Website Build Scripts

## `ensure-network-artifacts.mjs` — Network data, generated at build (not git)

Supabase is the single source of truth. The bulk Network blobs that the site
serves are **produced at build time**, never committed:

| Served path | Produced from | Notes |
|-------------|---------------|-------|
| `static/queue.json` | `arena/scripts/generate_sweep_queue.py` | ~49 MB work-list; gitignored |
| `static/mesh.json` | same generator | the `/mesh` visualization; gitignored |
| `static/registry.json` | byte-identical copy of `arena/datasets/registry.json` | harness remote fallback; gitignored |
| `static/queue-preview.json` | same generator | small; **stays committed** as a safe fallback |
| `data/channel.json`, `data/wall.json` | shared-data plugin, from `languages.json` | endonym datasets; gitignored |

### Production chain (first source that works wins; fail-loud, never silent)

1. **Generate** — if `arena/scripts/generate_sweep_queue.py` + `python3` are
   present (full monorepo / monorepo-rooted Vercel build), run it. It reads the
   corpora registry SSOT + the live Supabase leaderboard and writes all four
   artifacts. Tries the live board first, falls back to `--offline` (structural
   ranking) on a network failure. Force offline with `CHAMPOLLION_QUEUE_OFFLINE=1`.
2. **Copy / Storage** — if Python is absent, copy `arena/datasets/registry.json`
   verbatim (no Python needed); the full `queue.json`/`mesh.json` are then served
   from Supabase Storage via the Vercel rewrite documented in
   `mt-eval-arena/supabase/functions/regenerate-queue/README.md`.
3. **Stub fallback** — last resort: write MINIMAL, valid, clearly-labelled
   placeholder artifacts (loud warning + honest metadata note) so a brand-new
   cold build does not 404 `/queue.json` etc. Replace by generating or seeding
   Storage.

`channel.json`/`wall.json` are distilled by the shared-data plugin from
`languages.json` — from local cards in a full checkout, or from Supabase
(via `build-data-from-supabase.mjs`) on a cold build where cards are absent.

### When it runs

- `npm start` (via `prestart`) and `npm run build` (via `prebuild`).
- **Also called directly from `build-all-locales.mjs`** so `node
  scripts/build-all-locales.mjs <locale>` (which bypasses npm lifecycle hooks)
  still produces the data. Both paths use "ensure" semantics — a no-op when the
  artifacts already exist (pass `--force` to refresh).

## `generate-languages-json.js`

Compiles all language card data into a single static JSON file for the Docusaurus website.

### Data Flow

```
shared/language-cards/*.json       (unified cards — registers, formality, rules, classification)
  ↓
website/scripts/generate-languages-json.js  (merge + inheritance resolution)
  ↓
website/src/data/languages.json    (static output — consumed by React pages)
  ↓
website/src/pages/languages.js     (renders card grid + modals)
```

### When It Runs

- Automatically before `npm start` and `npm run build` (wired in `package.json`)
- Can be run manually: `node website/scripts/generate-languages-json.js`

### What It Does

1. Reads all `.json` files from `shared/language-cards/` (excluding `language-tree.json`)
2. Resolves `extends` inheritance (genus → language)
3. Sorts alphabetically by English name
4. Writes merged output to `website/src/data/languages.json`

### Adding a New Language

When you add a new card (e.g., via `node scripts/generate-language-card.mjs sw`), the website will automatically include it on the next build. No manual wiring needed.
