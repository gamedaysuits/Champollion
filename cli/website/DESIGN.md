# Champollion Design System — "Field Notes / The Living Decipherment"

The visual identity for champollion.dev (one site; the former mtevalarena.org / Arena is merged in as the Network section).
One sentence brief: **science as UI, language as the material** — clarity,
depth, scientific hedging and honesty, expressed through editorial design
that treats scripts, endonyms, and vitality data as the site's living
visual substance. The 2026-06 elevation pass added a display serif
(Fraunces), layered translucency, and a disciplined motion system; the
honesty register (provenance tips, hedged claims, honest contrast) is
untouched and non-negotiable.

Last revised: 2026-06-12 (Landing v3 — "The Translation Field": the
homepage is now a full-viewport experience whose background is the
machine translating real benchmark data, continuously; see §5
"TranslationField/FieldEngine" and §6 "Homepage structure". The Morph
stage was retired from the homepage in this pass; its components remain
in-repo and its particle engine lives on inside the field.)

---

## 1. The mark: the Rosetta fragment

**Files:**
- `static/img/logo.svg` — light-theme navbar variant (ink stone)
- `static/img/logo-dark.svg` — dark-theme navbar variant (carved stone)
- `static/img/favicon.svg` — theme-adaptive via `prefers-color-scheme`
  (dark media block switches to the carved-stone palette)
- `src/components/BrandMark.js` — inline React component (theme-aware via tokens)
- `static/img/champollion-social-card.svg` / `.png` — 1200×630 og:image
  (and the arena sibling pair at `arena/website/static/img/arena-social-card.*`).
  Regenerate the PNGs with `node scripts/generate-social-cards.mjs`
  (headless-Chrome SVG→PNG; respects `CHROME_BIN`).

**What it is.** A stela — a heavy stone slab with a jagged broken
top-right corner — carrying three registers of script, drawn as rows of
incised strokes. The silhouette is deliberately stone, not paper
(wave-2 rework): tapered sides, a flat base, sharp corners, and a
two-facet break. The previous rounded-rectangle + diagonal-corner
geometry read as a generic "document with folded corner" icon at navbar
size; the new asymmetric polygon cannot be mistaken for paper.

**Why.**
- The Rosetta Stone is the project's namesake artifact: one text in three
  scripts, and the broken corner is part of how everyone recognizes it.
  The mark borrows exactly those two facts and nothing else.
- The three registers map to the **vitality triad** (see §2): teal for
  thriving, amber for vulnerable, coral for endangered. The logo literally
  carries the project's central chart legend.
- The strokes are abstract. They are not any real script, so the mark
  never privileges one writing system over another — important for a
  project whose subject is 7,900+ languages.
- **Pure vector paths, no `<text>` elements.** The previous logo set
  glyphs in webfonts (`Inter`, `Noto Sans JP`, `Noto Sans Canadian
  Aboriginal`), which silently fell back to system fonts in favicons and
  social-card rasterizers. The new mark renders identically everywhere.

**Light/dark duality.** In light mode the mark is an **ink stone** (dark
slab, bright registers). In dark mode it stays stone — a **carved slab
seen at night** (wave-3 rework). The earlier dark variant was a white
"paper squeeze" silhouette, which at navbar size read as a paper
document — exactly the misreading the wave-2 silhouette rework existed
to kill. The wave-3 dark mark instead keeps a mid-value stone fill
(`--brand-stone: #414C46`) that separates from the `#101312` page, adds a
lit top-left edge (`--brand-stone-edge: #67746D`) and a brighter fracture
facet (`--brand-stone-break: #8C9A92`) — fresh stone breaks lighter than
weathered surface, so the break edge is the brightest stone value — and
lets the three incised registers carry the full-brightness triad. The
edge highlights are clipped to the silhouette (`clipPath`) so round line
caps never bleed past the outline; in light mode both edge tokens resolve
to `transparent`, so the ink-stone look is unchanged. Verified legible at
192 / 48 / 24 px on dark backgrounds.

**Sizes.** The mark stays legible at 24px (navbar) and 16px (favicon
tab): the silhouette plus three colored rows carry the recognition; no
detail below 2px stroke width exists at those sizes.

Inline usage:

```jsx
import BrandMark from '../components/BrandMark';
<BrandMark size={56} />
```

The component reads `--brand-stone` and `--brand-register-{1,2,3}`
(defined in `src/css/custom.css`), so it recolors with the theme.

---

## 2. Color system

Canonical definitions: `src/css/design-tokens.css` (component tokens) and
`src/css/custom.css` (Infima/theme variables). The arena site mirrors the
same values in `arena/website/src/css/custom.css`.

### The vitality triad (semantic core)

The one chart that matters most on this site is language vitality, so the
palette is built outward from it:

| Role | Light surfaces | Dark surfaces | Token |
|---|---|---|---|
| Teal — thriving | `#0E9594` | `#3FC1C0` | `--vital-safe` |
| Amber — vulnerable | `#C98A04` | `#E8B339` | `--vital-vulnerable` |
| Coral — endangered | `#E2606B` | `#F08A93` | `--vital-endangered` |

Each has `-bg` (tint) and `-border` companions. **Never** repurpose triad
colors for non-vitality semantics on data surfaces — a teal badge next to
the endonym wall must not mean something other than "thriving".
Exception: the brand accent (below) is knowingly the triad's teal, and
the Arena's accent is knowingly the triad's coral; both are used for
chrome (links, buttons), never for data encoding alongside vitality.

### Brand accent (scholarly teal)

| | Light | Dark |
|---|---|---|
| `--ifm-color-primary` / `--accent` | `#0F766E` (4.8:1 on white) | `#3FC1C0` (≈8:1 on ink) |

The Arena keeps its own accent for competitive energy: coral
(`--arena-accent`, `#E2606B` / `#F08A93`).

### Scholarly neutrals (ink / paper)

Faintly green-tinted neutrals so they share an undertone with the teal:

| Layer | Light ("paper") | Dark ("ink") |
|---|---|---|
| Page | `#FBFAF8` | `#101312` |
| Surface | `#F3F1EC` | `#181C1A` |
| Border | `#E5E2D9` | `#2A322E` |
| Text | `#1F2421` | `#E8EAE8` |
| Secondary text | `#5B6661` | `#9AA5A0` |

Component-level surfaces (cards, panels) use the `--surface-0..3`
hierarchy in `design-tokens.css`.

### Categorical scales

The **MT Complexity Index** tiers (`--complexity-*`) are a separate
categorical scale (magenta→slate) used only on trading cards and the
detail panel. They deliberately do not overlap the triad.

### Rules

1. No raw hex in component CSS — reference a token. (Legacy alpha-tinted
   values are being migrated; do not add new ones.)
2. Dark mode is first-class: every token has a tested dark value;
   `colorMode.defaultMode` is dark.
3. Flat surfaces. Gradients only as ≤8% tints fading to transparent
   (page headers), never as decoration.
4. Contrast: body text AA minimum on its actual background, AAA where
   practical. `--text-muted` is decorative-only.

---

## 3. Typography

Two voices, both **self-hosted — no font CDNs at runtime** (woff2 files in
`static/fonts/`, licenses in `static/fonts/LICENSES.md`, preloaded via
`headTags` in docusaurus.config.js):

- **Display: Fraunces Variable** (`--font-display`) — h1–h3 site-wide,
  heroes, the decipherment headline (the homepage H1 *is* the cycling
  word for "language"; non-Latin entries intentionally fall to system
  faces), oversized stat numerals, the footer wordmark, the glossary
  term (italic), `.miniCardRomanized`.
  A wonky old-style serif with optical sizing (`opsz` axis on,
  `font-optical-sizing: auto`): scholarly warmth at display sizes,
  legible at section-heading sizes. Weights via the variable axis
  (headings sit around 600–640); letter-spacing −0.012 to −0.015em.
  h4–h6 stay in the UI face — the serif register is for display, not
  metadata. The navbar wordmark stays in the UI face.
- **UI + prose: Inter Variable** (`--font-body` / `--ifm-font-family-base`).
  Body line-height ≥1.65.
- **Code/data:** JetBrains Mono → Fira Code → monospace.

**Subsetting & payload.** Latin subsets only — three files, ~220 KB woff2
total (Fraunces normal 67 KB + italic 81 KB + Inter 73 KB), `font-display:
swap`, `unicode-range`-scoped. Every other script (syllabics, CJK, Arabic,
Devanagari, Thai…) intentionally falls through to system faces: a site
about 7,900+ languages cannot ship every script, and modern system stacks
render them well. The previous Google-Fonts `@import` is gone from both
sites.

- Type scale tokens: `--text-xs` … `--text-3xl` (see design-tokens.css).
- Endonyms always render in their native script first, romanization
  second, English exonym third — the site's typographic pecking order
  mirrors its politics.

---

## 4. Voice, tone, and the hedging register

The site's credibility *is* the product. Copy rules:

1. **Numbers come with receipts.** Any number a visitor can read should
   have a provenance affordance (`<ProvenanceTip source="…" date="…" />`)
   and a row in `CLAIMS.md`. "Verified on N entries (date)" — never
   "best-in-class".
2. **State the scope of a claim.** "91.5% morphologically valid words
   (494-entry sweep)" not "morphologically correct". "About 200 can"
   not "only we cover the rest".
3. **Concede the counter-metric.** When we show our pipeline winning on
   FST acceptance, we show it *losing* on chrF++ in the same module.
   Honest contrast is the house style.
4. **Mark heuristics as heuristics.** "Marker-based, not a learned
   judgment"; "informational — never part of the composite score".
5. **Don't promise programs that don't exist.** ("Contests and community
   programs are in development. We won't announce them here until
   they're real.")
6. **Plain words for community-facing pages** (/my-language), technical
   precision for researcher-facing pages (/research, specs). Same facts,
   different registers — exactly what the harness measures in MT output.

---

## 5. Spacing, radii, surfaces, motion, components

- **Spacing:** the `--space-*` scale (4/8/12/16/24/32/48). Sections
  breathe: 3–5rem vertical padding on landing surfaces.
- **Radii:** `--radius-sm` 6 / `--radius-md` 10 / `--radius-lg` 14 /
  `--radius-xl` 18. Feature cards/modals are `xl`, cards `lg`, badges
  `sm`, inputs/buttons `md`–14.
- **Surfaces (elevation pass):** landing surfaces use layered
  translucency — `--surface-glass` + `backdrop-filter: blur(8–14px)`
  with an inset top highlight (`--border-subtle`) — over color-field
  sections (soft radial `--accent-subtle` washes) alternating with
  plain paper sections, so the page has rhythm without borders doing
  all the work. Docs pages stay flat.
- **The triad rule:** a 3px hairline gradient teal→amber→coral
  (`.triadRule` in custom.css; also the hero baseline, spoke
  `pageHeader::after`, install-strip top border, and the arena hero).
  Architectural accent only — never a data encoding.

### Motion system

All animation is **transform / opacity / filter only** (compositor-safe,
60fps), 150–700ms, ease tokens (`--ease-out`, `--ease-spring`). Every
animation — CSS *and* the JS that drives DOM churn — is disabled under
`prefers-reduced-motion: reduce`; the reduced state is a finished
composition, not a broken one. Inventory:

| Motion | Where | Reduced-motion fallback |
|---|---|---|
| Decipherment morph (blur+lift word cycle, 2.8s cadence) — the H1 itself; SSR renders the first word, the H1 never entrance-animates (LCP instant) | Hero headline (`WordFlipper`) | Static first word ("language"); cycling stops entirely |
| **The Translation Field** (Landing v3 — the sanctioned rAF canvas layer, decorative only): real corpus sentences drift into a transformation zone, dissolve in a named transition state (sand, mist, petals, embers, water, murmuration — Morph v2 physics, meaning-linked or rotating, never language-linked), travel as particles, and crystallize as the real recorded model output with its run's corpus-level composite chip popping on (`corpus composite N.NN` — the model × pair whole-corpus score, never a per-sentence claim; design decision, composite foregrounded per the design spec). One flow every ~4.8s (jittered) with a min-concurrency floor of 2 on desktop (staggered catch-up spawns, never bursts), 2–3 concurrent (1 on mobile), six lanes — four dodging the navbar/legend plus two traversing the copy band at the ×0.5 copy dim. Pauses dead on `document.hidden` AND when scrolled off-screen (IO) | Hero background (`TranslationField` → `FieldEngine`) | Canvas never mounts; the SSR'd static composition stands — one real frozen flow (source → model output + corpus-composite chip + reference) over the full-bleed gradient field |
| Navbar chrome submission: transparent over the field (blur 0, border 0), solidifying to the glass bar past 0.28·vh scroll (`html[data-field-home]` / `[data-field-scrolled]`, 0.35s background/opacity transitions) | Homepage navbar (`useFieldChrome`) | Attributes still toggle (chrome state, not animation); the CSS transition is disabled |
| Scroll recede: the field fades/lifts over the first 90vh of scroll, the pinned copy over 70vh — CSS scroll-driven animations where supported, rAF scroll fallback for the field layer elsewhere | Hero (`TranslationField` wrapper + `.heroContent`/`.heroScrim`) | No recede animation; normal scrolling |
| Hero rise (staggered fade-up ≤0.24s delays; **not** the H1) | Hero brand/scoreline/subtitle/search/rule | All visible, no animation |
| *(retired surfaces)* The Morph decomposition stage + Morph v2 dissolution layer no longer mount anywhere; `MorphStage.js` / `MorphParticles.js` remain in-repo (the field cannibalized the particle engine) with their truthfulness contracts intact | — | — |
| Bento entrance choreography (`Reveal` per tile, 60ms stagger; hidden state applied only by JS → SSR/no-JS always visible) | All bento tiles | Never hidden, never animated |
| Tile hover lift (≤3px) | All bento tiles | No transform |
| Wall stagger-in, ambient chip cycle (one swap / 2.6s, fade-out → remount fade-in), endangered breathe | Wall tile | All chips static & visible; JS interval never starts |
| Chip hover lift + meta reveal (name + vitality, + speakers only if the dataset has them) | Wall chips | No lift; meta still appears (no transition) |
| Stat count-ups (rAF ~1.1s ease-out, IO-triggered once; SSR/no-JS renders the final value) | Stats tile | Final value, static |
| Glossary term rotation (9s cadence, 320ms opacity/4px dip mid-swap; visible by default) | Glossary tile | One term, static; JS interval never starts |
| Leaderboard live pulse + one-time row shimmer | Leaderboard tile | Dot static, no shimmer |
| Path-card lift + icon spring | Paths row | No transform |
| ProvenanceTip first-view pulse (one soft ring, IO-triggered) | Every ⓘ | Observer never attached |
| Leaderboard row slide-in (45ms stagger, capped at row 14) | /leaderboard | Rows static |
| DetailPanel entrance (scale 0.965 + 48px travel + fade, spring; blurred overlay) | Trading-card panel | No animation |

- **Recurring components:**
  - *ProvenanceTip* (`src/components/ProvenanceTip.js`) — the
    scientific-honesty affordance; ⓘ revealing source + verified date,
    with a one-time soft pulse when first scrolled into view.
  - *Reveal* (`src/components/Reveal.js`) — scroll-triggered entrance
    wrapper; progressive-enhancement contract documented in the file.
  - *WordFlipper* (`src/components/WordFlipper.js`) — the decipherment
    morph; entries carry `lang`/`dir`/`script`, container exposes one
    stable `aria-label`.
  - *TranslationField* (`src/components/TranslationField.js`) — the
    Landing v3 hero background: the machine, translating, continuously
    (the design log §"The Landing v3", binding). Owns the
    decorative canvas (mounted post-hydration, never under reduced
    motion), the SSR'd **frozen flow** (one real source → model output
    + the run's corpus-composite chip + reference; the
    reduced-motion/no-JS composition, and screen-reader-available even
    while the canvas runs), and the always-visible provenance
    **legend** pill ("Real corpus sentences · real model outputs ·
    each chip: that run's whole-corpus composite score" + ⓘ).
    Data: `/data/field.json`, built by
    `plugins/shared-data/generateFieldJson.js` from 13 in-repo harness
    run reports over CC-BY Tatoeba dev corpora — 65 flows, an honest
    2-high/2-mid/1-low chrF++ spread per pair, NC corpora refused by
    construction. CLAIMS.md §"The Translation Field" is binding.
  - *FieldEngine* (`src/components/FieldEngine.js`) — the field's
    canvas scheduler, cannibalized from MorphParticles (text-pixel
    sampling through the real canvas text stack, the six transition
    states' physics, batched fills, typed pools, theme-token palettes
    re-read on `data-theme` flips).
    - **Flow choreography:** drift 2.6s → dissolve 1.5s → converge
      1.3s → crystallize 0.65s (score chip pops ~0.2s after the text
      lands) → hold 3.1s → exit 0.75s. A flow spawns every ~4.8s
      (±jitter); 2–3 concurrent on desktop, 1 on mobile. **Desktop
      min-concurrency floor of 2** (iteration-13 nit (b)): when the
      field would drop below 2 flows, the next spawn is pulled forward
      as a catch-up — never a burst (catch-ups keep a ≥1.6s stagger
      from the previous spawn), and the floor yields to the perf
      degrade level (level 2 / mobile stay at 1). Measured over 30s at
      1440×900 and 1024×768: min 2 / max 3 concurrent, zero
      zero-flow samples. ONE sentence type size (15px / 16.5px mobile)
      and ONE meta size (10.5px mono) for everything in the field;
      depth is alpha only (1 / 0.72 / 0.52, ×0.5 under the pinned
      copy) — never size.
    - **Lanes:** six on desktop (two above the copy clearing the
      navbar, two at the bottom clearing the legend, and two —
      iteration-13 nit (b) — traversing the copy band at ~0.42/0.56·h,
      where spawn()'s existing ×0.5 copy dim keeps the hero text
      winning while the mid-viewport stays alive), computed at fit()
      from the viewport and the `[data-field-avoid]` copy rect;
      allocation order interleaves top/bottom/middle so consecutive
      spawns spread vertically. Mobile runs one top-to-bottom diagonal
      flow with the chip stacked above the target.
    - **The guardrail (Morph v2, unchanged):** dissolution modes are
      meaning-linked (build-time keyword pass, `m` in field.json) or
      rotate aesthetically — never language-linked. Additive blending
      only for luminous modes on dark; light theme stays source-over.
    - **Performance contract:** single rAF loop, pool allocated once
      (3×820 particles cap), one `getImageData` per text sampling,
      zero DOM reads in the loop, DPR ≤2; frame probe degrades to
      2 flows×520 particles at >24ms avg and 1×340 at >34ms
      (`window.__FIELD_STATS`). `document.hidden` and scrolling the
      hero off-screen (IO in TranslationField) stop the loop dead.
      Measured 10.2–13.3ms avg/frame at full concurrency, headless
      Chrome software rendering. Landing chunk 15.1KB gz total
      (index page + field + engine; the Morph no longer ships) +
      4.5KB gz field.json fetched post-paint.
  - *MorphStage / MorphParticles* (`src/components/Morph*.js`) —
    **retired from the homepage** (Landing v3); kept in-repo with
    truthfulness contracts intact. The field reuses their engine
    school; if the Morph returns to a surface, restore its CLAIMS
    section from git history first.
  - *Link cards* (`spoke.module.css .linkCard`) — glass cards for
    doc/spec indexes; hover = accent border, 3px lift.
  - *Contrast panels* (`.contrastPanel`) — paired metric panels for
    honest comparisons; the favored side gets an accent border + soft
    glow only.
  - *Steps* (`.steps`) — numbered onboarding rows; one command each.
  - *Endonym chips* (`index.module.css .chip`) — vitality-tinted,
    endonym first, name second; hover/focus reveals vitality label.
  - *RelatedRail* (`src/components/RelatedRail.js`, mounted via the
    `src/theme/DocItem/Footer` wrapper — wraps, never ejects) — the
    "If this interested you →" onward-links rail at the bottom of every
    doc page, between content and the prev/next paginator. Short triad
    hairline + Fraunces kicker over a grid of compact glass cards
    (kind chip, label, optional one-clause note; ↗ on cross-site URLs).
    Data contract: frontmatter `related:` array of
    `{label, to, kind, note?}` (curated, max 5; `to` accepts internal
    paths, `/glossary#term-…` anchors, and full cross-site URLs used
    sparingly), falling back to up to 4 same-sidebar-category siblings
    so unseeded pages still link onward. Hover = 3px lift + accent
    border (none under reduced motion); single column ≤480px. The
    component + CSS are mirrored at `arena/website/src/components/` —
    keep both copies in sync.

---

## 6. Per-site notes

- **champollion.dev** — hub ("Living Rosetta" homepage) + spokes
  (/translate /arena /languages /my-language /research), docs, blog,
  leaderboard, trading cards. Teal accent.
  - **Homepage structure (Landing v3, 2026-06-12):** a full-viewport
    hero (100svh, running under the transparent navbar) whose
    background IS the Translation Field — real corpus sentences
    becoming real model outputs with real chrF++ chips, full-bleed,
    over a vitality-triad aurora wash, dissolving into the page color
    at its base (the seam). The copy floats pinned over it behind a
    radial page-color scrim (AA preserved at the field's busiest):
    cycling-endonym H1 (SSR'd first word = LCP), "7,959 languages. One
    open scoreboard.", ONE beat of copy, the language search, the triad
    rule. Directly after the field: the five funnels
    (Translator/Challenger/Explorer/Guardian/Researcher path cards
    under a centered eyebrow) — unmissable, then the 12-column bento:
    wall tile (8-col ×2 rows), live-leaderboard tile (4×2), featured
    crk card (4), stats count-ups (4), glossary rotation (4),
    position-piece pull quote (4), install (4), donate-your-tokens (4).
    Surfaces alternate glass and "field" tiles; tiles stack in
    DOM/priority order ≤996px; every tile links onward; every number
    keeps its ProvenanceTip (CLAIMS.md is binding).
  - **Navbar wordmark integrity (iteration-13 nit (a)):** theme-classic
    truncates the title (`text--truncate` + Infima's shrinkable
    `.navbar__brand`), so a crowded item row used to ellipsize the
    wordmark to "cham…" around 1280px. Inverted in custom.css: on
    desktop (≥997px) the brand and items never shrink; the item set
    yields in measured tiers instead — ≤1366px tighter item padding +
    narrower search field (re-expands on focus), ≤1188px tightest
    spacing, icon-scale search (⌘K hint hidden), and the npm link
    hidden (the install path lives in the homepage install tile and
    the footer; GitHub stays). Below 997px Docusaurus collapses to the
    hamburger and the full wordmark stands alone. "champollion"
    renders in full at every width.
  - **Chrome (wave 2 + Landing v3):** the navbar is glass site-wide —
    translucent `--navbar-glass` + 14px blur with the triad hairline as
    its bottom border (docs pages wear the same functional bar). On the
    homepage it submits to the field: transparent at the top
    (`html[data-field-home]`), solidifying back to glass past 0.28·vh
    of scroll (`[data-field-scrolled]`). The footer is a swizzled
    branded close (`src/theme/Footer/`): stela mark + Fraunces
    wordmark, triad rule, compact link rows still driven by
    `themeConfig.footer.links`, install one-liners, copyright. Footer
    stays ink in both themes (`--footer-*` tokens).
- **mtevalarena.org** — same neutrals + teal primary, coral arena
  accent, same mark in the navbar, same self-hosted Fraunces/Inter pair
  and triad-rule baseline (hero carries the elevated identity; coral
  tagline darkens to `#C9444F` on paper for AA). Keeps its own
  structure and documentation hierarchy.
- Social cards are generated from SVG sources (1200×630, dark ink
  background, mark + wordmark + the triad baseline rule). Regenerate
  with headless Chrome: `--headless --screenshot --window-size=1200,630`.
