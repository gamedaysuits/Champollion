---
sidebar_position: 6
title: "Paglutas ng Problema"
---

# Paglutas ng Problema

Mga karaniwang isyu at solusyon para sa champollion.

## API at Pagpapatunay

### "Hindi natagpuan ang OPENROUTER_API_KEY"

Nangangailangan ang Champollion ng API key para sa LLM translation. Itakda ito bilang environment variable:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

O sa isang `.env` file (kung naglo-load ang inyong proyekto ng mga `.env` file):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Kung mayroon lang kayong Google Translate API key, awtomatikong nade-detect ng champollion at ginagamit ang Google Translate bilang default na method. Walang kailangang baguhin sa config.
:::

### "401 Unauthorized" mula sa OpenRouter

Invalid o expired ang inyong API key. I-verify ito sa [openrouter.ai/keys](https://openrouter.ai/keys).

### "429 Too Many Requests" / Paglilimita ng Rate

Hinahawakan ng Champollion ang mga rate limit nang internal gamit ang exponential backoff. Kung patuloy kayong tumatama sa mga rate limit:

1. **Bawasan ang batch size** sa inyong config:
   ```json
   { "batchSize": 15 }
   ```
2. **Gumamit ng model na may mas matataas na rate limit** (hal., may matataas na limitasyon ang `google/gemini-3.8-flash`)
3. **Gumamit ng mas mura/mas mabilis na paraan** para sa mga high-volume pair — walang rate limit ang Google Translate:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Hindi Natagpuan ang Model / Mga 404 Error

Ipinapadala sa mga direktang LLM provider (`openai`, `anthropic`, `gemini`) ang sarili nilang mga pangalan para sa mga model. May OpenRouter-format na id ng sarili nilang vendor na naka-map para sa inyo (`google/gemini-3.8-flash` → `gemini-3.8-flash` sa `gemini`). Kung hihinto ang pagpapatakbo nang may:

**"is an OpenRouter model id … which has no model by that name"** — Gumagamit kayo ng OpenRouter-format na model mula sa ibang vendor (`google/gemini-3.8-flash` kasama ang `openai`). Walang naipadala. Magbanggit ng model ng provider na iyon, gamitin ang method na naglalaman ng model, o lumipat sa `llm` method upang gamitin ang OpenRouter — tinutukoy ng mensahe ang bawat isa, at kung saan itinakda ang model:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

Sinusuri rin ng mga ito ang pangalan ng inyong model sa unang paggamit. Kung may makikita kayong babala:

**"ay isang Anthropic/OpenAI/Gemini model"** — Ipinapadala ninyo ang model sa maling provider:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"hindi natagpuan sa available models"** — Maaaring deprecated o maling baybay ang model. Kinukuha ng Champollion ang live model list ng provider at nagmumungkahi ng mga alternatibo. Tingnan ang docs ng provider para sa kasalukuyang mga model name.

:::tip[Nangyayari ang pag-deprecate ng model]
Regular na pinapahinto ng mga provider ang paggamit ng mga pangalan ng model. Kung biglang mabigo ang mga pagsasalin pagkatapos ng update ng provider, tingnan ang output ng `[WARN]` — ipapakita nito sa inyo ang mga kasalukuyang alternatibo.
:::

### `local`: "could not reach …"

Ang `local` method ay nagpapadala ng mga request sa isang OpenAI-compatible na server sa inyong makina (Ollama, vLLM, LM Studio, llama.cpp). Kapag hindi ito makakonekta, tinutukoy ng error ang address na sinubukan nito at ang setting na pumili rito:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

Nagmumula ang address sa una sa mga ito na nakatakda, sa environment o sa `.env.local` / `.env`: `LOCAL_API_BASE`, pagkatapos ay `OPENAI_API_BASE`, kasunod ang `OPENAI_BASE_URL`. Kung walang nakatakda, ito ang default ng Ollama na `http://localhost:11434/v1`. Simulan ang server, o ayusin ang setting na tinutukoy ng mensahe.

## Kalidad ng Translation

### Inuulit ng translations ang source language

Nahuhuli ito ng quality gate. Kung ang isang translation ay identical sa English source, nire-reject ito at nire-retry. Kung nagpapatuloy ito:

1. **Suriin ang model** — May ilang model na hindi maganda ang performance para sa mga partikular na pares ng wika
2. **Magdagdag ng mga tagubilin sa register** — Sabihin sa model kung anong wika ang dapat gawin:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Sumubok ng ibang model** — Lumipat mula sa `gpt-4o-mini` patungong `gpt-4o` o `google/gemini-3.1-pro-preview`

### Maling script output (hal., Latin text para sa Japanese)

Nahuhuli ng script compliance check ng quality gate ang karamihan ng kaso. Kung nagpapatuloy ito:

- I-verify na tama ang locale code (`ja`, hindi `jp`)
- Magdagdag ng explicit script instructions sa `register` field:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Bigo ang mga pangalan sa pag-verify (hal. "Curtis Forbes" sa Japanese)

Wasto ang mga pangalan sa Latin script, kaya sabihin sa champollion kung ano ang inyong mga pangalan:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

Inaatasan ang model na panatilihin ang mga ito kung paano isinulat, at ang isang value na binubuo lamang ng mga pangalang ito ay hindi kailanman inuulat bilang hindi naisalin o maling script. Kung wala ang listahan, ang isang maikling Latin-script na value sa isang wikang hindi Latin ay magkakaroon ng isang retry na nagtatanong kung ito ba ay isang pangalan o isang label. Kung pananatilihin ito ng model, tatanggapin ito bilang isang pangalan at iki-cache, kaya hindi na ito kailanman muling sisingilin. Hindi ninyo kailangan ang `--no-verify`.

### Mga pattern ng hallucination sa output

Ang mga paulit-ulit na trigram pattern (hal., "hello hello hello") ay nahuhuli ng hallucination loop detector. Kung magulo ang output ngunit pumapasa sa detector:

1. **Bawasan ang batch size** — Nagbibigay ng mas focused na output ang mas maliliit na batch
2. **Gumamit ng mas malakas na model** — Mas kaunti ang hallucination ng mas malalaking model sa mga non-Latin script
3. **Magdagdag ng coaching data** — Ina-anchor ng mga dictionary term ang translation

## Mga Isyu sa File at Format

### "Walang natagpuang locale files"

Awtomatikong nade-detect ng Champollion ang locale files. Kung hindi nito mahanap ang mga ito:

1. **Suriin ang `localesDir`** — Dapat tumuro sa directory na naglalaman ng locale files:
   ```json
   { "localesDir": "./locales" }
   ```
2. **Suriin ang file naming** — Dapat pangalanan ang mga file ayon sa locale code: `en.json`, `fr.json`, atbp.
3. **Suriin ang format** — Mga sinusuportahang format: JSON, nested JSON, YAML, TOML

### Mga conflict sa lock file

Itinatala ng `.champollion.lock` kung sa aling tekstong Ingles ibinatay ang bawat
pagsasalin. Lutasin ang merge conflict dito tulad ng anumang nabuong file: panatilihin ang alinman
sa dalawang panig, patakbuhin ang `npx champollion sync`, at i-commit ang resulta.

:::warning[Hindi muling isasalin ang anuman sa pagbura ng lock]
Kung walang lock, hindi matutukoy ng sync kung aling mga English string ang nagbago simula
nang gawin ang mga umiiral na pagsasalin. Isinasalin lamang nito ang mga key na **nawawala**
mula sa isang target file, at itinatala ang kasalukuyang Ingles bilang bagong baseline. Ang isang
English string na na-edit bago nabura ang lock ay mananatili sa luma nitong pagsasalin,
nang tahimik. Upang sadyang buuing muli ang isang locale, gamitin ang `--force` (i-scope ito gamit
ang `--pair`); muling ginagamit ang mga naka-cache na pagsasalin, kaya tanging ang tekstong hindi pa
nakikita ng cache ang sisingilin.
:::

### Pag-retranslate ng mga partikular na key

Kung mali ang individual translations at nais ninyong pilitin ang mga ito na ma-retranslate nang hindi dine-delete ang lock file:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

Ibinabalewala ng `--force-keys` flag ang pagsusuri sa lock file hash para sa mga partikular na key na iyon, na pumupwersa sa muling pagsasalin nang hindi naaapektuhan ang iba pang key. Ang `--redo keys:hero.title` ay siya ring bagay sa ilalim ng mas bagong pangalan nito. Parehong ibinibigay ang mga ito mula sa Translation Memory kapag hawak nito ang teksto; idagdag ang `--fresh` upang magbayad para sa isang bagong pagsasalin sa halip. Ang isang key na may kuwit (ang gettext msgid ay isang buong pangungusap) ay isinusulat gamit ang `\,`, at naka-quote ang argumento para sa shell: `--redo 'keys:Welcome back\, %(name)s!'`.

### Nag-ulat ang `verify` ng hindi tugmang placeholder (o iba pang sirang value)

Iniuulat ng `champollion verify` (at ng pagsusuring tumatakbo pagkatapos ng bawat sync) ang mga value na sira: isang placeholder na nawala o binago ang pangalan, isang sirang ICU plural, isang value na nabura ang mga titik nito. Ang karaniwang `champollion sync` ay **hindi** nag-aayos sa mga ito. Nasa disk na ang value at sinasabi ng lock entry nito na napapanahon ito, kaya hindi ito ginagalaw ng sync.

Tinutukoy ng bawat finding ang command na nag-aayos sa eksaktong mga key na iyon, halimbawa:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

Patakbuhin ang command na iyon. Kapag ang isang locale ay sumasaklaw sa ilang file, isinusulat ang mga key bilang `<file>::<key>` (halimbawa `common::nav.home`), na muling nagsasalin sa key ng partikular na file na iyon at wala nang iba pa.

Hindi ninyo kailangan ang `--fresh`. Kung ang sirang value ay nagmula sa Translation Memory, inalis na ito ng `verify` mula sa cache, at sinasabi nito: `[TM] Evicted 1 cached translation(s) that produced damaged values`. Pagkatapos ay muling isasalin ng redo ang teksto (o ihahatid ang sarili at naiibang pagsasalin ng cache para dito) sa halip na ihatid muli ang sirang bersyon. Ang isang value na mano-manong in-edit ninuman ay hindi kailanman iki-cache, kaya walang inaalis para dito, at gumagana ang redo sa parehong paraan.

Para sa mga Markdown/MDX content file, gamitin ang `--retranslate` na may path o glob sa halip (hal. `--retranslate docs/intro.md`). Isinasalin nito muli ang mga file na iyon kahit na napapanahon ang mga ito o mano-manong isinalin. Gamitin ang `--files` upang limitahan ang pagpapatakbo sa ilang partikular na content file nang hindi pinipilit ang mga ito.

### Sinisira ng content translation ang code blocks

Hindi ito dapat mangyari — sine-shield ang code blocks bago ang translation. Kung mangyari ito:

1. I-verify na gumagamit ang code block ng standard fencing (triple backticks)
2. Suriin kung may unclosed code blocks sa source Markdown
3. Mag-file ng issue — bug ito sa sentinel shielding system

## Mga Isyu sa CLI

### Hindi nade-detect ng `--watch` ang mga pagbabago

Gumagamit ang file watching ng native `fs.watch` ng Node.js. Mga kilalang isyu:

- **Network drives** — Hindi maaasahang gumagana ang `fs.watch` sa mga NFS/SMB mount
- **Docker volumes** — Gamitin ang polling mode o patakbuhin ang champollion sa loob ng container
- **Malalaking directory** — Minomonitor ng watcher ang `localesDir` nang recursive; maaaring lumampas sa OS limits ang napakalalalim na tree

### Nagpapatakbo ang `npx` ng lumang version

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

O mag-install globally:

```bash
npm install -g champollion
champollion sync
```

## Performance

### Mabagal ang sync para sa maraming wika

Tina-translate ng Champollion ang lahat ng locale nang parallel bilang default. Kung mabagal pa rin ang sync:

1. **Gamitin ang Google Translate para sa high-volume pairs** — 10–50× itong mas mabilis kaysa LLM translation
2. **Taasan ang batch size** (default ay 80):
   ```json
   { "batchSize": 120 }
   ```
3. **I-tune ang concurrency** — Default sa 200 ang JSON locale parallelism at 48 ang content. Kung sinusuportahan ng inyong API provider ang mas mataas na rate limit:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **Gumamit ng mabilis na model** — Ang `gpt-4o-mini` ay mas mabilis nang malaki kaysa `gpt-4o`

### Mataas na gastos sa API

- **Suriin ang batch sizes** — Mas malalaking batch = mas kaunting API calls = mas mababang gastos
- **Gamitin ang Translation Memory** — Naka-on ang TM bilang default. Patakbuhin ang `champollion tm stats` upang i-verify na gumagana ito. Kung makakita kayo ng 0 entries pagkatapos ng maraming sync, maaaring may mali sa permissions ng inyong `.champollion/` directory
- **Gamitin ang prompt caching** — Hinahati ng Champollion ang system/user messages para sa cache hits sa Anthropic at Google models
- **Gamitin ang Google Translate para sa Tier 2 languages** — Tingnan ang [Mag-translate ng 30 Wika](/docs/tutorials/translate-30-languages) cookbook

### Mga pagsasalin pagkatapos magpalit ng model o provider

Ang pagpapalit ng method (hal., `llm` patungong `deepl`), register, o coaching ay nagbibigay ng mga sariwang pagsasalin para sa muling isinalin, dahil kasama ang mga ito sa cache key — ngunit ang karaniwang sync ay walang muling isinasalin sa mga tapos na: `champollion sync --redo all` ang gumagawa nito. Ang pagpapalit ng **model** sa loob ng parehong method ay muling gumagamit sa isinalin ng nakaraang model, nang walang bayad; ipapaalam ito ng sync sa inyo bago ang pagtatantya. Kung nais ninyo ang sariling mga pagsasalin ng bagong model:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

Ang `--fresh-on-model-change` mismo ay binabago lamang ang mga key na isinasalin din naman ng isang pagpapatakbo (mga bago o binago): pagkatapos ng pagpapalit ng model lamang, walang ipinapadala ang karaniwang `sync --fresh-on-model-change`.

Tingnan ang [Translation Memory](/docs/concepts/translation-memory) para sa mga detalye tungkol sa cache key design.

## Pagbawi Mula sa Masamang Bersyon {#recover-old-damage}

Ang mga value na isinulat ng isang mas lumang pipeline ay **hindi kailanman nagkukumpuni sa sarili**: tumutugma ang kanilang mga manifest hash sa kasalukuyang source, kaya itinuturing ng `sync` na ayos na ang mga ito at walang gate na makakakita sa mga ito muli. Kung nag-a-upgrade kayo ng isang proyektong nagpatakbo ng mga bersyong bago ang 0.3.0, asahan na maaaring may sirang nakaimbak sa inyong mga locale file at magsagawa muna ng audit:

```bash
champollion integrity
```

Natutukoy ng audit ang mga kilalang signature ng sira at pinapangalanan ang solusyon para sa bawat isa:

| Finding | Ano ito | Solusyon |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Script conversion output (pIqaD/Tengwar/Kryptonian) na isinulat nang hindi ninanais ang conversion — lumalabas na blangko | `champollion repair-script` (offline, eksakto para sa pIqaD) |
| `HOLLOWED VALUES` | Ang source kung saan nabura ang mga titik nito — output mula bago ang content-preservation gate | Isalin muli (tingnan sa ibaba) |
| `NO-TRANSLATE DRIFT` | Isang URL o iba pang verbatim key na "isinalin" | `champollion sync` (inayos nang libre, awtomatiko) |

Para sa mga hollowed value — o anumang locale na hindi na ninyo pinagkakatiwalaan — buuin itong muli:

```bash
champollion sync --pair en:tlh --force
```

Muling inilalagay ng `--force` sa pila ang bawat source key para sa (mga) naka-scope na pares. Inihahatid pa rin ang mga hit sa Translation Memory, ngunit ang bawat naihatid na hit ay **bineberipika muna laban sa mga kasalukuyang gate** — ang isang naka-cache na value na tinatanggihan na ngayon ng gate ay inaalis at muling sinisingil, upang ang isang kontaminadong cache ay magkumpuni sa sarili nito sa halip na magpasok ng mali sa muling pagbuo. Idagdag ang `--no-tm` kung nais ninyo ng ganap na bagong re-bill anuman ang mangyari, at `--max-cost` upang malimitahan ang gastusin sa alinmang paraan.

Iniuulat din ng beripikasyon pagkatapos ng sync ang mga signature na ito, kaya ang isang sirang locale ay tahasang babagsak sa `sync` (kung saan nakasaad ang solusyon) sa halip na maipadala nang tahimik sa produksyon.

### Isang beses na muling pagpila pagkatapos ng mga paglilinis ng `--no-tm` {#one-time-requeue}

Kung gumamit ang inyong pagbawi ng `--no-tm`, asahan na ang **susunod** na sync ay magpipila ng isang batch ng source-echo key na akala ninyo ay tapos na. Isinusulat ng `--no-tm` ang mga value nang hindi tinatatakan ang mga ito sa Translation Memory, at ang isang *hindi natatakang* value na kapareho ng source nito ay hindi maipagkakaiba sa isang hindi pa naisasalin — kaya muli itong pipila nang isang beses, babalik (kadalasan ay magkapareho), matatatakan, at permanente nang maayos. Isa itong minsanang gastusin, hindi isang loop. I-preview kung aling mga key ang apektado gamit ang:

```bash
champollion sync --dry --list-keys
```

## Hindi Pa Rin Maayos?

- **[Mga GitHub Issue](https://github.com/gamedaysuits/champollion/issues)** — Maghanap sa umiiral na mga issue o mag-file ng bago
- **[Architecture Docs](/docs/concepts/architecture)** — Unawain ang system design
- **[Quality Gate](/docs/concepts/quality-gate)** — Paano gumagana ang validation sa ilalim ng hood
