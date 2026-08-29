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
2. **Gumamit ng model na may mas mataas na rate limit** (hal., ang `google/gemini-3.5-flash` ay may mapagbigay na mga limit)
3. **Gumamit ng mas mura/mas mabilis na method** para sa high-volume pairs — walang rate limit ang Google Translate:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Hindi Natagpuan ang Model / Mga 404 Error

Bina-validate ng mga direct LLM provider (`openai`, `anthropic`, `gemini`) ang inyong model string sa unang paggamit. Kung makakita kayo ng warning:

**"mukhang OpenRouter path"** — Gumagamit kayo ng OpenRouter-format model (`google/gemini-3.5-flash`) sa isang direct provider. Gumagamit ang mga direct provider ng bare model names:

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

O lumipat sa `llm` method upang gamitin ang OpenRouter:
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"ay isang Anthropic/OpenAI/Gemini model"** — Ipinapadala ninyo ang model sa maling provider:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"hindi natagpuan sa available models"** — Maaaring deprecated o maling baybay ang model. Kinukuha ng Champollion ang live model list ng provider at nagmumungkahi ng mga alternatibo. Tingnan ang docs ng provider para sa kasalukuyang mga model name.

:::tip[Nangyayari ang pag-deprecate ng model]
Regular na pinapahinto ng mga provider ang paggamit ng mga pangalan ng model. Kung biglang mabigo ang mga pagsasalin pagkatapos ng update ng provider, tingnan ang output ng `[WARN]` — ipapakita nito sa inyo ang mga kasalukuyang alternatibo.
:::

## Kalidad ng Translation

### Inuulit ng translations ang source language

Nahuhuli ito ng quality gate. Kung ang isang translation ay identical sa English source, nire-reject ito at nire-retry. Kung nagpapatuloy ito:

1. **Suriin ang model** — Mahina ang performance ng ilang model para sa partikular na language pairs
2. **Magdagdag ng register instructions** — Sabihin sa model kung anong wika ang ilalabas:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Sumubok ng ibang model** — Lumipat mula `gpt-4o-mini` patungong `gpt-4o` o `google/gemini-2.5-pro`

### Maling script output (hal., Latin text para sa Japanese)

Nahuhuli ng script compliance check ng quality gate ang karamihan ng kaso. Kung nagpapatuloy ito:

- I-verify na tama ang locale code (`ja`, hindi `jp`)
- Magdagdag ng explicit script instructions sa `register` field:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

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

Kung mapasama ang state ng `.champollion.lock`:

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
Ang pag-delete ng lock file ay nangangahulugang ire-retranslate ng susunod na sync ang lahat ng key, hindi lang ang mga nabago. May implikasyon ito sa gastos sa API para sa malalaking proyekto.
:::

### Pag-retranslate ng mga partikular na key

Kung mali ang individual translations at nais ninyong pilitin ang mga ito na ma-retranslate nang hindi dine-delete ang lock file:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

Ino-override ng `--force-keys` flag ang lock file hash check para sa mga partikular na key na iyon, kaya pinipilit ang re-translation nang hindi naaapektuhan ang anumang ibang key.

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

### Stale translations pagkatapos lumipat ng providers

Kung lumipat kayo mula sa isang translation method patungo sa iba (hal., `llm` patungong `deepl`), maaaring mag-serve pa rin ang TM cache ng lumang translations mula sa nakaraang method para sa mga key na hindi nagbago ang source text. Kasama sa cache key ang method name, kaya awtomatikong nahahawakan ang karamihan ng kaso. Ngunit kung binago ninyo ang `model` sa loob ng parehong method:

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

Tingnan ang [Translation Memory](/docs/concepts/translation-memory) para sa mga detalye tungkol sa cache key design.

## Pag-recover Mula sa Isang Sirang Bersyon {#recover-old-damage}

Ang mga value na isinulat ng isang mas lumang pipeline ay **hindi kailanman nag-aayos sa sarili**: ang kanilang mga manifest hash ay tumutugma sa kasalukuyang source, kaya itinuturing ng `sync` na settled na ang mga ito at hindi na muling makikita ng anumang gate. Kung nag-a-upgrade po kayo ng isang project na nagpatakbo ng mga bersyong pre-0.3.0, ipalagay po ninyo na maaaring may pinsala sa inyong mga locale file at mag-audit po muna:

```bash
champollion integrity
```

Nade-detect ng audit ang mga kilalang damage signature at pinapangalanan ang solusyon para sa bawat isa:

| Nahanap | Ano ito | Solusyon |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Output ng script conversion (pIqaD/Tengwar/Kryptonian) na isinulat noong hindi naman kailangan ang conversion — nagre-render nang blangko | `champollion repair-script` (offline, eksakto para sa pIqaD) |
| `HOLLOWED VALUES` | Ang source na tinanggalan ng mga titik — output mula bago ang content-preservation gate | I-translate muli (tingnan sa ibaba) |
| `NO-TRANSLATE DRIFT` | Isang URL o iba pang verbatim key na "na-translate" | `champollion sync` (naayos nang libre, awtomatiko) |

Para sa mga hollowed value — o anumang locale na hindi na po ninyo pinagkakatiwalaan — i-rebuild po ito:

```bash
champollion sync --pair en:tlh --force
```

Muling iki-queue ng `--force` ang bawat source key para sa mga naka-scope na pair. Ang mga Translation Memory hit ay ise-serve pa rin, ngunit ang bawat nai-serve na hit ay **iva-validate muna laban sa mga kasalukuyang gate** — ang isang naka-cache na value na nire-reject na ngayon ng gate ay aalisin at ire-rebill, kaya ang isang poisoned cache ay nag-aayos sa sarili nito sa halip na pakainin ang rebuild. Idagdag po ang `--no-tm` kung gusto ninyo ng isang ganap na bagong re-bill anuman ang mangyari, at `--max-cost` upang limitahan ang gagastusin sa alinmang paraan.

Iniuulat din ng post-sync verification ang mga signature na ito, kaya ang isang nasirang locale ay malakas na bumabagsak sa `sync` (kasama ang pinangalanang solusyon) sa halip na mai-ship nang tahimik.

### Isang beses na requeue pagkatapos ng mga `--no-tm` cleanup {#one-time-requeue}

Kung ang inyong pag-recover ay gumamit ng `--no-tm`, asahan po ninyo na ang **susunod** na sync ay magki-queue ng isang batch ng mga source-echo key na inakala ninyong settled na. Nagsusulat ang `--no-tm` ng mga value nang hindi ini-stamp ang mga ito sa Translation Memory, at ang isang *unstamped* na value na kapareho ng source nito ay hindi makikilala mula sa isang hindi na-translate — kaya muli itong magki-queue nang isang beses, babalik (kadalasan ay magkapareho), mase-stamp, at magiging settled nang permanente. Ito po ay isang beses na gastos, hindi isang loop. I-preview po nang eksakto kung aling mga key gamit ang:

```bash
champollion sync --dry --list-keys
```

## Hindi Pa Rin Maayos?

- **[Mga GitHub Issue](https://github.com/gamedaysuits/champollion/issues)** — Maghanap sa umiiral na mga issue o mag-file ng bago
- **[Architecture Docs](/docs/concepts/architecture)** — Unawain ang system design
- **[Quality Gate](/docs/concepts/quality-gate)** — Paano gumagana ang validation sa ilalim ng hood
