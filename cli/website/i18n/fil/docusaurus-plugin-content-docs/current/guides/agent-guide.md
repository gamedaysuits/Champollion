---
sidebar_position: 9
title: "Gabay para sa Agent: Paggamit ng champollion"
description: "Paano mai-install, mai-configure, at mapapatakbo ng AI agents ang champollion upang isalin ang mga locale file."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Gabay para sa Agent: Paggamit ng champollion

Ang champollion ay isang CLI tool na nagsasalin ng locale files ng inyong app gamit ang isang command. Ang gabay na ito ay para sa AI agents (o developers na nakikipagtulungan sa AI agents) na nais mabilis na makarating mula sa wala hanggang sa naisaling locale files.

:::tip[Pamilyar na po ba?]
Kung mga command lang ang kailangan ninyo, pumunta sa [CLI Reference](/docs/reference/cli). Kung nais ninyong bumuo at mag-benchmark ng isang paraan ng pagsasalin, tingnan ang [Network Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Pag-setup ng Environment

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**Mga kinakailangan:**
- Node.js 20.11+ (native ESM)
- Isang API key para sa inyong provider ng pagsasalin

**Pag-setup ng API key** — kailangan ng champollion ng hindi bababa sa isang key depende sa mga method na ginagamit ninyo:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Awtomatikong binabasa ng Champollion ang `.env.local` at `.env` (priyoridad: `process.env` → `.env.local` → `.env`). Kumuha ng OpenRouter key sa [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Unang Sync

Awtomatikong tinutukoy ng Champollion ang inyong mga locale file, ang format ng mga ito (JSON, TOML, o YAML), at ang inyong mga target na wika:

```bash
npx champollion sync
```

**Ano ang nangyayari:**
1. Nilo-load ang `champollion.config.json` (o awtomatikong natutukoy ang settings)
2. Ini-scan ang inyong source locale file, at pina-flatten ang nested keys
3. Ikinukumpara sa `.champollion.lock` (SHA-256 hashes ng mga dati nang naisaling value)
4. Tinitingnan ang `.champollion/tm.json` para sa cached translations (Translation Memory)
5. Isinasalin lamang ang **nabago, nawawala, o stale keys** sa pamamagitan ng naka-configure na method
6. Pinapadaan ang bawat translation sa quality gate (5 checks)
7. Isinusulat ang mga pumapasang translation sa target locale file
8. Ina-update ang lock file at TM cache

Sa karaniwang pag-ulit ng run pagkatapos baguhin ang isang key, ang step 4 ay naghahatid ng 142 keys mula sa cache at ang step 5 ay nagsasalin ng 1 key. Ito ang dahilan kung bakit mabilis at mura ang mga susunod na sync.

---

## Configuration

Gumawa ng `champollion.config.json` sa project root ninyo:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

Gumagamit ang mga pair key ng **colon** (`en:fr`), hindi hyphen — nakalaan ang mga hyphen para sa mga regional locale code tulad ng `es-MX`.

Mahahalagang field:

| Field | Layunin | Default |
|-------|---------|---------|
| `inputLocale` | Source language | `en` |
| `languages` | Mga target na wika (array o object) | `[]` |
| `pairs` | Mga override kada pair (mga key na `"src:tgt"`) na may method config | opsyonal |
| `localesDir` | Kung saan matatagpuan ang mga locale file | `./locales` |
| `model` | LLM model para sa mga method na `llm`/`llm-coached` | `google/gemini-3.5-flash` |
| `batchSize` | Mga key kada API call | 80 (LLM); nililimitahan ng Google Translate sa 128 segment/request |
| `jsonConcurrency` | Magkakasabay na pagsasalin ng locale para sa mga JSON key | 50 |
| `contentConcurrency` | Magkakasabay na API call para sa pagsasalin ng content | 48 (Docusaurus docs), 12 (Hugo `contentDir`) |

Buong reference: [Configuration](/docs/getting-started/configuration)

---

## Mga Paraan ng Pagsasalin

| Method | Kailan gagamitin | Gastos | Kailangang API key |
|--------|------------|------|---------------|
| **`llm`** | Pangkalahatang gamit, mahusay para sa mga wikang may maraming resource | Per-token (depende sa model) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | Kapag mayroon kayong grammar rules/dictionary para sa target language | Per-token + coaching context | `OPENROUTER_API_KEY` |
| **`google-translate`** | Mga high-resource language kung saan mahusay gumagana ang GT | $20/million chars | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Custom pipeline na naka-host sa likod ng HTTP endpoint | Tinutukoy ng server | Wala (ang endpoint ang humahawak ng auth) |
| **`plugin`** | Pre-packaged method na naka-install nang lokal | Nag-iiba | Nag-iiba |

Mga detalye: [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods)

---

## Coaching Data

Para sa `llm-coached` pairs, ginagabayan ng coaching data ang LLM gamit ang tahasang kaalamang pangwika. Gumawa ng coaching file:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

I-reference ito sa inyong pair config:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

Tinitiyak ng quality gate na aktuwal na lumilitaw ang dictionary terms sa output — ang mga violation ay nilo-log bilang `[TERM]` warnings.

Mga detalye: [Coaching Data](/docs/concepts/coaching-data)

---

## Quality Gate

Dumaraan ang bawat translation sa limang automated checks bago ito isulat sa disk:

| Check | Ano ang nahuhuli nito | Halimbawa |
|-------|----------------|---------|
| **Walang laman/blank** | Walang ibinalik ang model | `""` |
| **Source echo** | Ibinalik ng model ang English input nang hindi nabago | `"Welcome"` para sa Japanese |
| **Hallucination loop** | Paulit-ulit na trigrams | `"Qo' Qo' Qo' Qo'"` |
| **Length inflation** | Ang output ay 4×+ na mas mahaba kaysa source | 10-char source → 50-char output |
| **Script compliance** | Maling script para sa locale | Latin text para sa Arabic locale |

Nilo-log ang failures na may prefix na `[GATE]`. Walang silent fallbacks — kung nabigo ang translation, ini-uulat ito, hindi tahimik na tinatanggap.

Mga detalye: [Quality Gate](/docs/concepts/quality-gate)

---

## Translation Memory

Ini-cache ng Champollion ang translations sa `.champollion/tm.json`, na naka-key ayon sa source text + locale + method. Sa mga susunod na sync, ang unchanged keys ay inihahatid mula sa cache — walang API call, walang gastos.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

Para i-bypass ang cache para sa isang run: `npx champollion sync --no-tm`

Mga detalye: [Translation Memory](/docs/concepts/translation-memory)

---

## Mga Generated File

Gumagawa ang Champollion ng ilang file sa inyong project. Alamin kung ano ang mga ito upang hindi ninyo aksidenteng mabura o ma-commit ang maling mga file:

| File | Layunin | Git? |
|------|---------|------|
| `.champollion.lock` | Mga SHA-256 hash ng naisaling source values (pagtukoy ng pagbabago) | **Oo** — i-commit ito |
| `.champollion-content.lock` | Pareho, ngunit para sa mga Markdown/MDX content file | **Oo** — i-commit ito |
| `.champollion/` | Internal state directory (cache na `tm.json`, XLIFF exports, backups) | **Hindi** — i-gitignore ito; ang `tm.json` ay isang local cache (tingnan ang [Configuration](/docs/getting-started/configuration)) |
| Mga coaching file na inyong ina-author (hal. `coaching/fr.json`) | Ang inyong kaalamang pangwika | **Oo** — i-commit ang mga ito |
| `champollion.config.json` | Configuration ng proyekto | **Oo** — i-commit ito |

---

## Karaniwang Patterns

**Isalin po ang lahat ng naka-configure na pairs:**
```bash
npx champollion sync
```
Isinasalin po ng Champollion ang lahat ng locales nang sabay-sabay. Sa pamamagitan po ng TM caching, ang mga nabagong keys lamang ang dadaan sa API (ang mga hindi nabagong pairs ay kinukuha mula sa cache, kaya mura lang po ang full sync).

**Isalin lamang po ang mga partikular na pairs:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
Nililimitahan po ng `--pair` ang pagpapatakbo sa mga pinangalanang pair(s); ang mga readiness check at gastos ay nalalapat lamang po sa mga pairs na iyon. Ang pagpapangalan po ng pair na wala sa inyong naka-configure na pair graph ay magdudulot ng malinaw na error (fails loud) kasama ang listahan ng mga naka-configure na pairs — hindi po ito kailanman magiging isang tahimik na no-op.

**Content mode (Markdown/MDX para sa Docusaurus, Hugo, atbp.):**
```bash
npx champollion sync --content-dir ./content
```
Isinasalin ang docs, blog post, at content file kasabay ng locale JSON. Tumatakbo nang magkakasabay ang pagsasalin ng content; i-tune gamit ang `--content-concurrency`.

**Dry run (preview nang hindi nagsusulat):**
```bash
npx champollion sync --dry-run
```

**Puwersahang muling isalin ang specific keys:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Puwersahang muling isalin ang lahat ng content files:**
```bash
npx champollion sync --force-content
```

**Suriin ang translation status:**
```bash
npx champollion status
```
Ipinapakita ang coverage, quality tiers, at plugin info para sa bawat pair.

**Mag-audit para sa untranslated fallbacks:**
```bash
npx champollion audit
```
Inililista ang lahat ng `[EN]` fallback values na kailangang isalin.

---

## Pag-troubleshoot

| Problema | Ayos |
|---------|-----|
| `OPENROUTER_API_KEY not set` | I-export ang key o idagdag ito sa `.env` sa inyong project root |
| `No locale files found` | I-set ang `localesDir` sa config, o tiyaking tumutugma ang inyong locale files sa standard naming (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Nakakuha ang inyong target locale ng Latin text sa halip na inaasahang script — subukan ang ibang model o magdagdag ng coaching data |
| `[GATE] Source echo` | Ibinalik ng model ang English nang hindi nabago — kadalasan itong naaayos ng coaching data o ibang model |
| Naka-cache ang lahat ng translations | Patakbuhin gamit ang `--no-tm` para i-bypass ang cache, o `--force-keys` para sa specific keys |
| Lock file conflicts | Gumagamit ang `.champollion.lock` ng SHA-256 hashes — ligtas ayusin ang merge conflicts sa pamamagitan ng pagpapanatili ng alinmang version, pagkatapos ay muling patakbuhin ang sync |

---

## Ano ang Susunod

- [Quick Start](/docs/getting-started/quick-start) — kumpletong walkthrough sa pagsisimula
- [CLI Reference](/docs/reference/cli) — bawat command at flag
- [How It Works](/docs/how-it-works) — paliwanag sa sync pipeline
- [The Eval Harness Bridge](/docs/guides/bridge) — kung paano kumokonekta ang champollion sa Network
- **Nais ba ninyong bumuo ng sarili ninyong translation method?** Tingnan ang [Network Agent Guide](/docs/network/getting-started/agent-guide) — bumuo ng method, patunayang gumagana ito sa public leaderboard, at makipagkompetensiya para sa premyo kung/kapag may bukas (ang mga premyo ay planadong mekanismo — tingnan ang [Honest Limitations](/docs/network/honest-limitations)).
