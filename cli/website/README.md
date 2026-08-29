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

Deployment is **Vercel**, using the prebuilt output. **Always deploy via
`npm run deploy` from `cli/website/`** — it runs `scripts/deploy-prod.sh`,
which pins the working directory and refuses unless the linked `.vercel`
project is `champollion`:

```bash
npm run deploy
```

⚠️ The repo ROOT carries its own `.vercel/` linked to the
**`champollion-preview`** project — a bare `vercel deploy` from the root
silently ships the wrong site. The guard script exists because the two
commands look identical from either directory. (For reference, it runs
`npx vercel build --prod` then `npx vercel deploy --prebuilt --prod
--archive=tgz`.)

Deploying does **not** expose the site. `middleware.js` holds a reviewer-keyed
pre-launch gate that answers every human request with the coming-soon page.
Nine machine endpoints pass through it (`/llms.txt`, `/llms-full.txt`,
`/for-agents.md`, `/queue.json`, `/queue-preview.json`, `/registry.json`,
`/mesh.json`, `/sitemap.xml`, `/run_queue`) so the published packages work
ahead of launch. The set is `MACHINE_EXEMPT` in `middleware.js` — keep this
sentence in sync with it.

To launch, remove the **gate block** from `middleware.js` — not the whole file.
The geo-IP locale defaulting below it must survive. Confirm `/robots.txt` flips
from the middleware's `Disallow: /` back to the committed `static/robots.txt`.

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
