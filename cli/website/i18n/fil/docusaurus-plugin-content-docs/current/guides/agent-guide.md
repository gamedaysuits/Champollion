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
| `inputLocale` | Pinagmulang wika | `en` |
| `languages` | Mga target na wika (array o object) | `[]` |
| `pairs` | Mga override bawat pares (mga key ng `"src:tgt"`) na may config ng pamamaraan | opsyonal |
| `localesDir` | Kung saan nakalagay ang mga locale file | `./locales` |
| `model` | LLM model para sa mga pamamaraang `llm`/`llm-coached` | `google/gemini-3.8-flash` |
| `batchSize` | Mga key bawat API call | 80 (LLM); nililimitahan ng Google Translate sa 128 segment/request |
| `jsonConcurrency` | Mga magkakasabay na pagsasalin ng locale para sa mga JSON key | 50 |
| `contentConcurrency` | Mga magkakasabay na API call para sa pagsasalin ng nilalaman | 48 (mga doc ng Docusaurus), 12 (`contentDir`) |

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

| Pagsusuri | Ang nahuhuli nito | Halimbawa |
|-------|----------------|---------|
| **Walang laman/blangko** | Walang ibinalik ang modelo | `""` |
| **Pag-echo ng pinagmulan** | Ibinalik ng modelo ang input sa Ingles nang walang pagbabago | `"Welcome"` para sa Japanese |
| **Loop ng hallucination** | Mga inuulit na trigram | `"Qo' Qo' Qo' Qo'"` |
| **Paglobo ng haba** | Ang output ay mahigit 4× ng haba ng source (ang eksaktong 4× ay pumapasa) | 10-char na source → 50-char na output |
| **Pagsunod sa script** | Maling script para sa locale | Latin na teksto para sa Arabic na locale |

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
| `.champollion.lock` | Mga SHA-256 hash ng mga isinaling value ng source (pagtukoy ng pagbabago), kasama ang bawat locale: kung ano ang isinulat ng sync, mga key na iniwang nakabinbin ng isang redo, mga key na pinigil pagkatapos ng pagtanggi | **Oo** — i-commit ito |
| `.champollion-replaced-edits.jsonl` | Mga manu-manong na-edit na salin na pinalitan ng isang sync, kasama ang kanilang mga pananalita (isinusulat lamang kapag nangyari iyon) | **Oo** — i-commit ito |
| `.champollion-content.lock` | Pareho rin, ngunit para sa mga Markdown/MDX na content file | **Oo** — i-commit ito |
| `.champollion/` | Internal na direktoryo ng estado (cache ng `tm.json`, mga export ng XLIFF, mga backup) | **Hindi** — i-gitignore ito; ang `tm.json` ay isang lokal na cache (tingnan ang [Konpigurasyon](/docs/getting-started/configuration)) |
| Mga coaching file na inyong isinulat (hal. `coaching/fr.json`) | Ang inyong kaalamang pangwika | **Oo** — i-commit ang mga ito |
| `champollion.config.json` | Konpigurasyon ng proyekto | **Oo** — i-commit ito |

---

## Karaniwang Patterns

**Isalin ang lahat ng na-configure na pares:**
```bash
npx champollion sync
```
Isinasalin ng Champollion ang lahat ng locale nang magkakasabay. Gamit ang pag-cache ng TM, mga nabagong key lamang ang tumatama sa API (ang mga hindi nagbagong pares ay kinukuha mula sa cache, kaya mura ang buong sync).

**Isalin lamang ang mga partikular na pares:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
Nililimitahan ng `--pair` ang pagpapatakbo sa (mga) pinangalanang pares; nalalapat lamang ang mga pagsusuri sa kahandaan at paggastos sa mga pares na iyon. Ang pagpapangalan sa isang pares na wala sa inyong na-configure na pair graph ay magdudulot ng hayagang error kasama ang listahan ng mga na-configure na pares — hindi kailanman magiging tahimik na no-op.

**Kung paano magsulat ng isang pares.** Ang isang pares ng proyekto ay isinusulat sa paraan kung paano ito ini-key ng `champollion.config.json`, `en:fr`. Binabasa rin ng `sync`, `verify` at `serve` ang `en>fr` at `en-fr`, at ang `en-pt-BR` ay itinutugma sa mga pares na inyong na-configure. Ang mga network command (`network register-corpus`, `leaderboard`, `recommend`, `submit`) ay nagsusulat ng isang pares bilang `eng>crk`, ang anyong iniimbak ng leaderboard, at binabasa ang `eng-crk` at `eng:crk` sa parehong paraan. Doon, ang isang pares na may mga gitling lamang ay dapat na dalawang code ng dalawa o tatlong titik (`eng-crk`). Ang isang code na may sariling gitling ay nangangailangan ng `>`: `--pair "eng>pt-BR"`. Ang `eng-pt-BR` ay maaari ding mangahulugang `eng-pt` at `BR`, kaya ito ay tinatanggihan, hindi kailanman hinuhulaan. Sa isang shell, i-quote ang anyong `>`: `--pair "eng>crk"`. Kung hindi naka-quote, ipapadala ng shell ang output sa isang file na pinangalanang `crk`.

**Content mode (isang folder ng Markdown/MDX: isang Hugo `content/` o anumang folder; natatagpuan ang mga doc ng Docusaurus nang wala ito):**
```bash
npx champollion sync --content-dir ./content
```
Isinasalin ang mga doc, post sa blog, at content file kasama ng JSON ng locale. Ang bawat salin ay isinusulat sa tabi ng source nito bilang `<name>.<locale>.md`; ang mga pag-edit na ginawa ng isang reviewer dito ay pinapanatili kapag nagbago ang source sa ibang lugar ([Pagsasalin ng Nilalaman](/docs/guides/content-translation#reviewing-and-editing-translations)). Ang pagsasalin ng nilalaman ay tumatakbo nang magkakasabay; i-tune gamit ang `--content-concurrency`.

**Dry run (preview nang hindi nagsusulat):**
```bash
npx champollion sync --dry-run
```

**Puwersahang muling isalin ang specific keys:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Iproseso muli ang lahat ng content file (muling ginagamit ang naka-cache na teksto, kaya libre ang hindi nagbagong teksto):**
```bash
npx champollion sync --force-content
```

**Isalin nang bago ang mga partikular na content file (sinisingil), o limitahan ang pagpapatakbo sa ilang file:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**Pagpapatakbong mababasa ng makina:** Nagsusulat ang `--json` ng isang JSON object bawat linya (NDJSON), bawat isa ay may `level`: sa stdout, mga mensaheng `info` at `ok`, mga record ng `event` (`"event": "cost"` — ang pagtatantya, bago ang `--max-cost` gate — at isang `"event": "file"` bawat content file at locale), at panghuli ang pansarang `{"level": "summary", "command": "sync", …}`; sa stderr, mga linyang `warn` at `error`, na JSON din. Piliin ang buod batay sa antas nito, hindi kailanman sa posisyon lamang ng linya: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. Ang exit code na `2` ay nangangahulugang bahagya (may natapos na gawain, may nabigo).

Sa pagtatantya (event na `cost`, at `costEstimate` sa buod), ang `totalEstimatedCost` ay `null` tuwing mayroong anumang bahagi na walang alam na presyo — hindi kailanman isang bahagyang kabuuan, hindi kailanman `0` para sa hindi alam; hawak ng `knownEstimatedCost` ang bahaging may presyo, pinapangalanan ng `unknownCost.reason` ang mga pares na walang presyo, at sinasabi ng `unknownCost.notes` kung ano ang wala at kung bakit — `{ subject, pairs, note }`, tulad ng pangalan ng modelo na wala sa listahan ng OpenRouter (isang malamang na typo, kasama ang pinakamalapit na nakalistang mga pangalan), isang nakalistang modelo na walang presyo bawat token, o isang listahan ng presyo na hindi mabasa. Ang isang modelo sa makinang ito (isang endpoint ng `local` o `api` sa `localhost`/`127.0.0.1`/`::1`) ay may presyong `0` na may `"local": true`. Binibilang ng `sentToModel` ng buod ang mga key na ipinadala sa pamamaraan sa pagpapatakbong ito (`tmHits`: kinuha mula sa cache). Ang buod ng isang dry run ay naglalaman ng `preflight: { ready, failures }` — ang `ready: false` ay nangangahulugang ang totoong pagpapatakbo ay hihinto at mag-e-exit nang `1` (isang nawawalang key, o isang model server na kailangan ng pagpapatakbo na hindi sumasagot), bagama't ang mismong dry run ay nag-e-exit nang `0` ([mga exit code](/docs/reference/cli#sync-exit-codes)). Kasama ang `--max-cost`, naglalaman din ito ng `maxCost: { cap, estimatedCost, wouldStop }` — ang `wouldStop: true` (kasama ang `exitCode: 2` at ang `reason`) ay nangangahulugang ang totoong pagpapatakbo ay hihinto sa limitasyon bago ang anumang API call. Ang `realRun: { exitCode, wouldStop, reasons }` ay ang exit code kung saan magtatapos ang totoong pagpapatakbo, ayon sa kayang sabihin ng isang preview: ang preflight at ang cap, kasama ang mag-iiwan dito na bahagya — mga key na pinigil, mga plural na mensahe sa disk na walang anyong ginagamit ng wika na hindi na nito hihilingin muli (binibilang sa `totalPluralGaps` ng dry run). Walang bini-verify ang isang dry run (`verify: { "ran": false }`). Patakbuhin ang dry run gamit ang `--method`/`--model` ng totoong pagpapatakbo: kung wala ang mga ito, sinusuri nito ang pamamaraang pinangalanan ng config.

**Suriin ang katayuan ng pagsasalin:**
```bash
npx champollion status
```
Ipinapakita ang pamamaraan, modelo, saklaw, at impormasyon ng plugin ng bawat pares (isang `qualityTier` lamang kapag nagtakda ang config — isang label, hindi isang sukat).

**Mag-audit para sa untranslated fallbacks:**
```bash
npx champollion audit
```
Inililista ang lahat ng `[EN]` fallback values na kailangang isalin.

---

## Pag-troubleshoot

| Problema | Solusyon |
|---------|-----|
| `OPENROUTER_API_KEY not set` | I-export ang key o idagdag ito sa `.env` sa root ng inyong proyekto |
| `No locale files found` | Itakda ang `localesDir` sa config, o tiyaking tumutugma ang inyong mga locale file sa karaniwang pagpapangalan (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Nakatanggap ang inyong target na locale ng Latin na teksto sa halip na ang inaasahang script — sumubok ng ibang modelo o magdagdag ng coaching data |
| `[GATE] Source echo` | Ibinalik ng modelo ang Ingles nang walang pagbabago — kadalasang naaayos ito ng coaching data o ng ibang modelo |
| Naka-cache ang lahat ng salin | Patakbuhin gamit ang `--no-tm` upang lampasan ang cache, o `--force-keys` para sa mga partikular na key |
| Mga conflict sa lock file | Naglalaman ang `.champollion.lock` ng mga hash — ligtas lutasin ang isang merge conflict sa pamamagitan ng pagpapanatili ng alinmang bersyon, pagkatapos ay muling patakbuhin ang sync. Ang pagpapanatili ng talaan bawat locale ng kabilang panig ay maaaring maging sanhi upang mabasa ang ilang value bilang manu-manong na-edit (pananatilihin at papangalanan sila ng isang maramihang redo; pinapalitan ng `--redo keys:` ang isa) — hindi kailanman ang kabaligtaran |
| Mga key na "pinigil" | Tinanggihan ng quality gate ang sagot ng modelong iyon noon; hindi na ito muling ipinapadala ng isang karaniwang sync (sisingilin nito ang parehong sagot). Muling nagtatanong ang `champollion sync --redo keys:<key>`; o magdagdag ng isang `fallback`, ilista ito sa `noTranslate`, o isulat ito nang manu-mano |

---

## Ano ang Susunod

- [Quick Start](/docs/getting-started/quick-start) — kumpletong walkthrough sa pagsisimula
- [CLI Reference](/docs/reference/cli) — bawat command at flag
- [How It Works](/docs/how-it-works) — paliwanag sa sync pipeline
- [The Eval Harness Bridge](/docs/guides/bridge) — kung paano kumokonekta ang champollion sa Network
- **Nais ba ninyong bumuo ng sarili ninyong translation method?** Tingnan ang [Network Agent Guide](/docs/network/getting-started/agent-guide) — bumuo ng method, patunayang gumagana ito sa public leaderboard, at makipagkompetensiya para sa premyo kung/kapag may bukas (ang mga premyo ay planadong mekanismo — tingnan ang [Honest Limitations](/docs/network/honest-limitations)).
