# champollion.dev — the public site

The **one** public Docusaurus site. It hosts the Champollion documentation and,
since the 2026-06-20 merge, the former MT Eval Arena docs under `docs/network/`.
There is no second site — `arena/website` was retired in that merge.

> This file was the stock Docusaurus scaffold README until 2026-07-31, telling
> you to run `yarn deploy` and push to a `gh-pages` branch. That was never how
> this site shipped; following it would have done nothing useful.

## Local development

```bash
npm install
npm start
```

**Never run a build while the dev server is running** — the two fight over
`.docusaurus/` and the build silently emits a broken Arabic locale (404s on
`/ar/`). If it happens: stop the server, `rm -rf .docusaurus`, rebuild.

## Build

```bash
npm run build
```

Builds all 13 locales into `build/`. The build **fails on broken internal
links**, which makes it the main link gate for the docs tree — treat a red
build as a real defect, not a nuisance.

## Deploy

The maintainers deploy champollion.dev (Vercel, prebuilt output). Until
launch, `middleware.js` answers human requests with a coming-soon page and
lets the machine endpoints listed in its `MACHINE_EXEMPT` set through.

## Generated content

Several artifacts under `static/` and `data/` are build output, not source.
Regenerate rather than hand-edit:

| Artifact | Built by |
|---|---|
| `static/llms-full.txt` | `node scripts/build-llms-full.mjs` (`--check` to verify) |
| `static/queue.json`, `mesh.json`, `registry.json` | `node scripts/ensure-network-artifacts.mjs` |
| `data/explainers/glossary.json` | `npm run sync:shared` (run from `cli/`) |
| the site docent's grounding corpus | `node cli/scripts/build-docent-corpus.mjs` |

## Related

- `DESIGN.md` — the design system for this site
- `CLAIMS.md` — every factual number on the site mapped to its in-repo source
- `sidebars.js` — the docs navigation. Fully explicit; the `sidebar_position`
  frontmatter scattered through the docs tree is **not** consulted.
