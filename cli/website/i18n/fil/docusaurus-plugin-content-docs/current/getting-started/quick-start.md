---
sidebar_position: 2
title: "Mabilisang Pagsisimula"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Mabilisang Pagsisimula

Isalin ang inyong unang locale file sa loob ng 60 segundo.

Libre ang CLI para sa di-komersyal na paggamit sa ilalim ng
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); hindi sakop ng lisensyang iyon ang komersyal
na paggamit. Sakop ang isang paaralan, isang pampublikong ospital o klinika, isang kawanggawa, o isang personal na proyekto; hindi sakop
ang storefront ng isang tindahan. Buong ipinapaliwanag ito sa [Sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this).

## 1. Ihanda ang Inyong mga Locale File

Gumawa ng source locale file. Sinusuportahan ng Champollion ang JSON, TOML, YAML, at higit pa — tingnan ang [sanggunian ng CLI](/docs/reference/cli) para sa kumpletong listahan:

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Itakda ang Inyong API Key

Pumili ng provider at itakda ang key:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Kumuha ng libreng Gemini key sa [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Kumuha ng OpenRouter key sa [openrouter.ai](https://openrouter.ai). Para sa opsyon C, pangalanan ang inyong modelo kapag itinatakda ninyo ang proyekto: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (o patakbuhin ang `sync --method local --model llama3.1`).

## 3. Patakbuhin ang Sync

```bash
npx champollion sync
```

:::note[Ita-type ba ninyo, o patatakbuhin ng isang script?]
Ang mga command sa pahinang ito ay ang mga tina-type ninyo: pinapatakbo ng `npx champollion` ang kopyang na-install ng inyong proyekto, o kaya'y ang kinukuha ng npx — ang pinakabagong release sa unang pagkakataon, pagkatapos ay ang naka-cache na kopyang iyon. Ang command na pinapatakbo ng isang script para sa inyo — CI, isang `package.json` script, isang git hook — ay dapat tumukoy sa bersyon nito, `npx --yes champollion@0.6 sync`, upang ang isang bagong release ay hindi kailanman magbago sa kung ano ang pinapatakbo ng build (at pinipigilan ng `--yes` ang npx sa paghinto upang magtanong). Isinasaayos ito sa ganoong paraan ng [gabay sa CI](/docs/guides/ci-cd) at ng [mga pahina ng framework](/docs/integrations/frameworks).
:::

:::tip[Gumagamit ng Gemini?]
Kung pinili ninyo ang Opsyon B (Gemini), idagdag ang `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Gagawin ng Champollion ang:
1. Awtomatikong tutukuyin ang `locales/en.json` bilang source
2. Hahanapin (o hihingin) ang mga target na wika
3. Isasalin ang lahat ng key
4. Isusulat ang `locales/fr.json`, `locales/ja.json`, atbp.
5. Gagawa ng `.champollion.lock` upang subaybayan kung ano ang naisalin na

## 4. Suriin ang mga Resulta

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## Ano ang Susunod na Mangyayari?

Kapag binago ninyo ang isang source string, matutukoy ng champollion ang pagbabago sa pamamagitan ng pagsubaybay sa SHA-256 hash at muling isasalin lamang ang key na iyon sa susunod na sync:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

Ang hindi nabagong key (`hero.subtitle`) ay **nilalaktawan**: ang salin nito ay nasa `locales/fr.json` na, kaya hindi ito ipinapadala saanman at hindi man lang hinahanap — walang tawag, walang gastos, at hindi ibinibilang sa bilang na "served from the cache" ng pagpapatakbo.

Ang **Translation Memory** (`.champollion/tm.json`, awtomatikong binuo sa bawat sync) ay para sa tekstong *nakapila*: isang string na ibinalik ninyo sa dati, ang parehong pangungusap sa ibang file, isang muling pagsasalin ng buong locale (`sync --redo all`). Libreng ibinibigay ang mga iyon mula sa cache, at sinasabi ng linya ng pagpapatakbo kung ilan (`… 0 key(s) sent to the model, 12 served from the cache (free)`). Pinapanatili ang cache bawat paraan, rehistro, at coaching — para sa bawat pares at sa fallback nito. Pagkatapos magpalit ng paraan (halimbawa `local` → `llm`), o baguhin ang teksto ng coaching file (sa pares, sa wika nito, o sa fallback nito), walang muling gagamitin at ipaliliwanag ng pagpapatakbo kung bakit; ang pagpapalit lamang ng modelo ay muling gumagamit ng mga naunang salin. Ang isang pagbabago ay walang muling isinasalin sa sarili nito: tinutukoy ng `sync` ang muling paggawa at ang presyo nito.

## Opsyonal: Gumawa ng Config File

Para sa higit pang kontrol, bumuo ng config file:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

Pinipili ng `--method` at `--model` ang paraan ng pagsasalin at modelo (inililista ng `npx champollion init --help` ang mga paraan); ipinapakita ng init kung alin ang ginagamit ng config.

Iginagabay kayo ng guided wizard sa mga **preset ng rehistro** ng bawat wika — mga paunang ginawang tagubilin sa tono/pormalidad na iniakma sa lingguwistikong sistema nito. May mga T-V preset ang French (vouvoiement vs tutoiement), may mga antas ng pananalita ang Korean (해요체 vs 합쇼체 vs 해체), at may mga opsyon sa keigo ang Japanese (です/ます vs 丁寧語).

O kaya'y manual na gumawa ng config gamit ang mga preset key:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-3.8-flash"
}
```

Patakbuhin ang `npx champollion init` upang tingnan ang mga available na preset para sa bawat wika.

## Opsyonal: Watch Mode

Awtomatikong magsalin kapag nagbago ang inyong source file:

```bash
npx champollion watch
```

## Mga Susunod na Hakbang

- **[Pagsasaayos](/docs/getting-started/configuration)** — Kumpletong sanggunian ng config
- **[Mga Paraan ng Pagsasalin](/docs/guides/translation-methods)** — Piliin ang tamang paraan para sa bawat pares
- **[Translation Memory](/docs/concepts/translation-memory)** — Paano nakakatipid ng pera ang pag-cache sa mga muling pagpapatakbo
- **[Pakikipagtulungan sa mga Propesyonal na Tagasalin](/docs/guides/professional-translators)** — Mag-export ng XLIFF para sa pagsusuri ng tao
- **[Integrasyon sa Framework](/docs/integrations/frameworks)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — I-automate ang mga pagsasalin sa inyong pipeline
- **[Paglutas ng Problema](/docs/guides/troubleshooting)** — Mga karaniwang isyu at solusyon
