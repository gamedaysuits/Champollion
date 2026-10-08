---
sidebar_position: 3
title: "Konfigurasyon"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Konfigurasyon

Gumagana ang Champollion nang zero-config — awtomatiko nitong natutukoy ang mga locale file, format, at target na wika mula sa inyong project. Para sa mas maraming kontrol, gumawa ng `champollion.config.json` sa root ng inyong project, o patakbuhin ang:

```bash
npx champollion init
```

## Buong Config Reference

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "localesPattern": null,
  "localesLayout": null,
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.8-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "genderGuidance": null,
  "protectedTerms": [],
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[Hindi pa naipapatupad ang typegen]
Kinikilala at pinapanatili ng config loader ang config block na `typegen`, ngunit hindi pa naipapatupad ang TypeScript type generation. Placeholder ito para sa nakaplanong feature. Walang epekto ang pagtatakda ng mga value na ito.
:::


### Mga Field

| Field | Uri | Default | Paglalarawan |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Bersyon ng schema ng config. Palaging `3`. |
| `inputLocale` | `string` | `"en"` | Code ng pinagmulang wika (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Path patungo sa mga locale file. Naglalaman ng isang file bawat wika (`fr.json`) o isang folder bawat wika (`fr/common.json`). Tingnan ang [Mga Layout ng Locale File](#locale-layouts). |
| `localesPattern` | `string` | `null` | Kung saan nakalagak ang mga file ng bawat wika kapag walang tumutugmang anyo, gamit ang `{lang}` at isang opsyonal na `{ns}`: `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. Relative sa root ng proyekto. Pumapalit sa `localesDir`. Tingnan ang [Mga Layout ng Locale File](#locale-layouts). |
| `localesLayout` | `string` | `null` | Nag-o-override sa pagtuklas ng layout: `"flat"` (isang file bawat wika) o `"dir"` (isang folder bawat wika). Kinakailangan lamang kapag parehong umiiral ang `en.json` at `en/`. |
| `defaultNamespace` | `string` | `null` | Sa isang folder-per-language na proyekto na may maraming file, ang file kung saan nagdaragdag ng mga bagong key ang `champollion wrap` (hal. `"common"`). |
| `contentDir` | `string` | `null` | Isang folder ng Markdown/MDX na isasalin: isang Hugo `content/` folder o anumang iba pang folder, tulad ng `./newsletters` sa isang Next.js app. Ang bawat salin ay isinusulat katabi ng source nito bilang `<name>.<locale>.md`, halimbawa `2026-10.md` → `2026-10.crk.md`. Ang mga file na pinangalanan nang `<name>.<code>.md` ay itinuturing bilang mga salin, hindi mga source. Tingnan ang [Pagsasalin ng Nilalaman](/docs/guides/content-translation). |
| `translatableFields` | `string[]` | `null` | I-override ang mga default na translatable na frontmatter field para sa pagsasalin ng nilalaman. Gumagamit ang `null` ng mga built-in na default (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Format ng file: `json`, `toml`, `yaml`, `po` ([gettext](#gettext)), `arb` ([Flutter](#arb)), o `auto` (tutukuyin mula sa extension ng source file; ibinibilang ang `.yml` bilang YAML at pinapanatili ng mga target ang `.yml`). Ang anumang iba pang value ay hihinto nang may error. |
| `model` | `string` | `"google/gemini-3.8-flash"` | Default na modelo para sa mga pamamaraan ng LLM. Isang eksaktong slug ng modelo: ang buong slug ng OpenRouter (`provider/model`). Ang mga maikling alias (`gemini-flash`) at floating id (`~vendor/…`, `…-latest`) ay tinatanggihan, na tinutukoy ang slug na dapat isulat. Gumagamit ang mga direktang provider ng mga payak na pangalan (hal., `gpt-4o`); ang isang OpenRouter slug ng kanilang sariling vendor ay imina-map dito (`openai/gpt-4o` → `gpt-4o`), at ang isa na wala silang modelo ay magpapatigil sa pagpapatakbo bago pa man may maipadala ([Mga Pangalan ng Modelo](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | Temperature ng LLM (0.0–2.0). Mas mababa = mas deterministic. |
| `defaultMethod` | `string` | `"llm"` | Default na pamamaraan ng pagsasalin: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. Ang `local` ay isang OpenAI-compatible na server sa inyong makina (Ollama bilang default). Nao-override ng CLI flag na `--method`. |
| `batchSize` | `number` | `80` | Mga key bawat batch ng pagsasalin. Mas mataas = mas kaunting API call, ngunit mas malalaking prompt. |
| `coachingFile` | `string` | `null` | Path patungo sa isang free-text na file ng coaching prompt (relative sa root ng proyekto). Binabasa ang mga nilalaman sa pagsisimula at iniiniksyon sa system prompt bilang isang `Coaching guidance:` block. |
| `promptContext` | `string` | `null` | String ng konteksto ng aplikasyon na iniiniksyon sa system prompt (hal., "E-commerce product descriptions"). Tumutulong sa modelo na ibagay ang mga salin sa inyong domain. |
| `genderGuidance` | `string` \| `false` | `null` | Kung paano pinangangasiwaan ng mga prompt ng LLM ang gramatikal na kasarian. Pinapanatili ng `null` ang default ng bawat wika mula sa katalogo ng Champollion — para sa Pranses, *écriture inclusive* gamit ang interpunct (`Connecté·e`, `Utilisateur·rice·s`); para sa Aleman, ang anyong may tutuldok (`Benutzer:innen`). Walang ipinapadalang tagubilin sa kasarian ang `false`; ang isang string naman ay nagpapadala ng inyong sarili (hal. `"Use the masculine generic."`). Maitatakda rin bawat wika at bawat pares. Tingnan ang [Gabay sa kasarian](#gender-guidance). |
| `protectedTerms` | `string[]` | `[]` | Mga pangalang dapat panatilihin nang eksakto sa bawat wika: mga tao, kumpanya, produkto (hal. `["Curtis Forbes", "Game Day Suits"]`). Sinasabihan ang modelo na panatilihin ang mga ito, at ang isang value na binubuo lamang ng mga pangalang ito ay hindi kailanman mamarkahan bilang hindi naisalin o maling-script. Naiiba ito sa `noTranslate`, na lumalaktaw sa buong mga **key**. |
| `jsonConcurrency` | `number` | `200` | Pinakamataas na sabay-sabay (parallel) na pagsasalin ng locale para sa pag-sync ng JSON key. Nao-override ng CLI flag na `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Pinakamataas na sabay-sabay na API call para sa pagsasalin ng nilalaman (Markdown/MDX). Nao-override ng CLI flag na `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Prefix ng pananda na ginagamit ng `audit` at `verify` upang matukoy ang mga legacy na hindi pa naisasaling value mula sa mga naunang pagpapatakbo. Hindi isinusulat ng Champollion ang prefix na ito — binabasa lamang ito para sa pagtuklas. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Pangalan ng environment variable para sa API key. I-override para sa mga custom na pangalan ng env var. |
| `minContentRetention` | `number` | `0.35` | Bahagi (fraction) ng mga titik/numero ng source na dapat panatilihin ng isang output bago sumangguni ang [pagsusuri sa pagbura ng nilalaman](/docs/concepts/quality-gate) sa pangalawang signal nito. Maitatakda rin bawat pares at bawat wika. |
| `noTranslate` | `string[]` | `[]` | Mga dot-path key at glob pattern na ang value ay kinokopya sa bawat locale nang verbatim. Tingnan ang [Mga No-Translate Key](#no-translate). Tinatanggap din bilang `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Ituring ang mga source value na walang iba kundi isang `scheme://` URL bilang no-translate. Itakda ang `false` upang ipadala ang mga key na may URL na value sa backend ng pagsasalin. |
| `baseUrl` | `string` | `""` | Base URL para sa pagbuo ng SEO artifact (hreflang, mga sitemap, JSON-LD). |
| `pairs` | `object` | `{}` | Mga override sa pamamaraan, modelo, at kalidad bawat pares. Tingnan ang [Pag-configure ng Pares](#pair-configuration). |
| `languages` | `object` | `{}` | Mga override bawat wika. Tingnan ang [Pag-configure ng Wika](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Direktoryo ng source para sa pag-scan ng lint. `null` = awtomatikong tutukuyin mula sa framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Mga glob pattern na ibubukod sa lint. |
| `lint.minLength` | `number` | `2` | Pinakamababang haba ng string upang mamarkahan bilang hardcoded. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Template ng pattern ng URL para sa pagbuo ng hreflang tag. |
| `seo.pages` | `string[]` | `null` | Tahasang listahan ng pahina para sa SEO. `null` = awtomatikong tutukuyin mula sa mga locale key. |
| `typegen.output` | `string` | `null` | Output path para sa nabuong mga uri ng TypeScript. `null` = naka-disable. |
| `typegen.autoGenerate` | `boolean` | `false` | Awtomatikong muling buuin ang mga uri pagkatapos ng bawat pag-sync. |

## Mga Layout ng Locale File {#locale-layouts}

Binabasa ng Champollion ang inyong mga locale file kung saan na ito iniingatan ng inyong framework. May tatlong anyo.

**Isang file bawat wika** (`flat`). next-intl, vue-i18n, Hugo, karamihan sa mga hand-rolled setup:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**Isang folder bawat wika** (`dir`). i18next at react-i18next, kung saan ang bawat file ay isang *namespace*:

```text
public/locales/
  en/
    common.json      ← source namespaces
    admin/users.json
  fr/
    common.json
    admin/users.json
```

```json title="champollion.config.json"
{ "localesDir": "./public/locales" }
```

Pinipili ng Champollion ang `dir` kapag ang `<localesDir>/<inputLocale>/` ay isang folder ng mga locale file. Ang bawat source file ay isini-sync sa parehong path sa ilalim ng folder ng bawat wika, at ang mga nawawalang file at folder ay nililikha. Ang isang namespace ay maaaring isang nested path (`admin/users`).

**Anumang iba pang anyo** (`localesPattern`). Pangalanan ang path gamit ang `{lang}` at, kung ang isang wika ay may maraming file, ang `{ns}`:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

Maaaring maulit ang `{lang}`, tulad ng sa `"{lang}/app_{lang}.json"`. Maaaring lumabas nang isang beses ang `{ns}` at maaaring sumaklaw sa mga folder. Nagmumula ang format sa extension maliban kung nakatakda ang `format`.

Hinahanap ng `champollion init` ang mga layout na ito para sa inyo. Sinusuri muna nito kung may Flutter app (`pubspec.yaml`, kasama ang `l10n.yaml` kung mayroon) at mga gettext catalog (`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`), at nagsusulat ng `localesPattern` para sa mga iyon. Pagkatapos ay sinusuri nito ang karaniwang folder ng inyong framework (`messages/` para sa next-intl, `public/locales/` pagkatapos ay `locales/` para sa i18next, `src/locales/` para sa vue-i18n, `i18n/` para sa Hugo), pagkatapos ay `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` at `src/i18n`. Ginagamit lamang nito ang isang folder na naglalaman ng file ng inyong pinagmulang wika, at ipinapakita ang nahanap nito. Lumilikha rin ang `init --langs fr,de` ng mga walang lamang target file sa layout na iyon.

:::note[Kung paano nag-sync ang isang wikang may maraming file]
Ang bawat file ay inihahambing, isinasalin, at isinusulat nang mag-isa. Itinatala ng `.champollion.lock` ang mga key bilang `<namespace>::<key>` (`common::nav.home`), at gayundin ang `--force-keys`, mga unit id ng `xliff`, at `sync --dry --json`. Ang isang payak na key sa `--force-keys` ay tumutugma sa key na iyon sa bawat file. Ang mga proyektong may isang file bawat wika ay nagpapanatili ng mga simpleng key, kaya hindi nagbabago ang kanilang lock file.

Ang Translation Memory ay naka-key ayon sa source text, hindi ayon sa file. Ang isang string na lumalabas sa dalawang namespace ay isinasalin nang isang beses bawat wika. Kinukuha ito ng pangalawang file mula sa cache nang walang bayad.
:::

Kung parehong umiiral ang `en.json` at isang may lamang folder na `en/`, hihinto ang Champollion at hihilingin sa inyo na itakda ang `"localesLayout": "flat"` o `"dir"` sa halip na manghula.

### Mga plural key ng i18next {#i18next-plurals}

Iniimbak ng i18next ang mga plural bilang mga magkakapatid na key (sibling keys) na may CLDR suffix: `item_one`, `item_other`. May iba't ibang anyong plural ang mga wika. Gumagamit din ang Pranses at Espanyol ng `_many`, anim na anyo ang gamit ng Arabe, at `_other` lamang sa Hapones. Kapag may ganitong mga key ang isang JSON source file, makukuha ng bawat target nang eksakto ang sariling mga anyo ng wika nito, na binasa mula sa CLDR sa pamamagitan ng JavaScript `Intl.PluralRules` API:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

Pagkatapos ng isang sync, ang `fr.json` ay may `item_one`, `item_many` at `item_other`, at ang `ja.json` ay may `item_other` lamang. Sinasabi ng sync, para sa inyong sariling mga wika, kung aling mga anyo ang idinadagdag o inaalis ng bawat isa.

Ang mga bagong anyo ay isinasalin mula sa `_other` text ng source, ang `_one` mula sa `_one`. Ang `_zero` sa source ay pinapanatili sa bawat wika, dahil hinahanap ito ng i18next para sa bilang na 0 sa lahat ng wika. Kung nagsulat ang isang naunang sync ng anyo na hindi ginagamit ng wika, tulad ng `item_one` sa Hapones, aalisin lamang ito ng sync kapag ipinapakita ng Translation Memory na sync ang gumawa ng value na iyon. Ang value na isinulat nang manu-mano ay pinapanatili. Ang isang key para sa anyong wala sa wika na wala rin sa source (Espanyol na `item_two`) ay hindi kailanman kusang inaalis: pinapangalanan ito ng `verify`, at inaalis ng `sync --prune plural-extras` ang eksaktong mga key na iyon, na inililista ang bawat isa (kasama ang `--dry`, sinasabi nito kung ano ang aalisin nito). Para sa isang wikang walang mga panuntunan sa plural sa CLDR, kinokopya nang isa-sa-isa ang mga anyo ng source, at ipinapaalam ito ng sync.

### Mga mensaheng ICU {#icu}

Ang mga value na nakasulat sa ICU MessageFormat (next-intl, react-intl, vue-i18n, Flutter) ay naghahalo ng code at text:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

Ang text lamang sa loob ng mga branch ang isinasalin. Tinatanggihan ng [quality gate](/docs/concepts/quality-gate) ang isang salin na nagbabago sa anupaman bukod doon:

- mga pangalan ng variable (`count`, `{name}`), na hindi kailanman pinapalitan ng pangalan o inaalis;
- ang mga salitang `plural`, `select` at `selectordinal`, at ang uri ng `{price, number}`;
- mga selector (`=0`, `one`, `other`, `male`). Pinapanatili ng isang `select` ang eksaktong mga opsyon nito. Pinapanatili ng isang `plural` ang mga selector ng source at maaaring magdagdag ng mga kategoryang ginagamit ng target na wika, mula sa CLDR: nagdaragdag ang Pranses ng `many`, ang Polish ng `few` at `many`. Maaaring alisin ang isang kategoryang hindi ginagamit ng wika, tulad ng pagpapanatili lamang ng Hapones sa `other`;
- `#` sa bawat plural branch na mayroon nito, maliban sa `zero`, `one`, `two` at `=N`, kung saan maaaring isulat ng isang wika ang numero bilang salita;
- `offset:N`, mga nested argument, at mga conversion ng printf tulad ng `%s`, `%d` at `%(name)s`.

Sinasabihan ang modelo kung aling mga kategorya ang ginagamit ng target na wika. Ang isang tinanggihang salin ay sinusubukang muli nang isang beses kalakip ang dahilan, halimbawa `ICU keyword 'other' was translated to 'óthér'`. Ayos lang ang apostrophe bago ang isang placeholder (`d'{name}`). Pinapatakbo ng `verify` at `integrity` ang parehong pagsusuri sa mga file na naisulat na. Pinapanatili ng isang payak na `sync` ang isang value na nasa disk na, kaya pinapangalanan ng bawat finding ang command na nag-aayos dito, ang `champollion sync --pair <pair> --redo keys:<key>`. Kapag ang nasirang value ay nagmula sa Translation Memory, inaalis nila ito sa cache, upang maisalin muli ng command na iyon ang key sa halip na ibigay ang parehong text; walang `--fresh` na kailangan.

### Mga catalog ng gettext (.po) {#gettext}

Ituro ang `localesPattern` (o `localesDir`) sa inyong mga catalog:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**Ang source** ay ang catalog ng pinagmulang wika, halimbawa `locale/en/LC_MESSAGES/django.po` mula sa `django-admin makemessages -l en`. Ang `msgid` nito ang text na isasalin kapag walang laman ang `msgstr`. Kapag wala ang catalog na iyon, ang source ay isang template na `.pot`:

- Gamit ang `localesDir`: ang nag-iisang `.pot` sa folder na iyon.
- Gamit ang `localesPattern`: `<name>.pot` sa folder bago ang unang placeholder o sa folder sa itaas nito. Ang `<name>` ay ang namespace (`{ns}`, isang template bawat domain tulad ng `django.pot`), o ang pangalan ng file ng pattern nang walang `{lang}` (`messages.po` → `messages.pot`).
- Gamit ang `localesLayout: "dir"`: walang template na hinahanap. Panatilihin ang source catalog sa `<localesDir>/<source>/`.

Ang dalawang template kung saan isa lang ang inaasahan ay magpapatigil sa pagpapatakbo. Hindi nanghuhula ang Champollion kung alin ang source.

**Mga Key.** Bawat `msgid` ay isang key. Ang isang entry na may `msgctxt` ay naka-key bilang `msgctxt` + U+0004 + `msgid`, ang sariling encoding ng gettext. Ang "Open" na pandiwa at "Open" na pang-uri ay magkahiwalay na mga key at magkahiwalay na mga cache entry. Ipinapakita ng mga report ang separator bilang `␄` (`verb␄Open`), at tinatanggap ito ng `--force-keys "verb␄Open"`. Kung hindi ninyo mai-type ang `␄`, isulat ang `\x04` (`--force-keys 'verb\x04Open'`): parehong gumagana ang mga baybay na ito. Naghihiwalay ang `--force-keys` (at `--redo keys:`) sa mga kuwit; isulat ang kuwit sa loob ng isang msgid bilang `\,` at lagyan ng panipi ang argument: `--redo 'keys:Welcome back\, %(name)s!'`. Ang mga hindi nagbagong entry ay nagmumula sa cache nang walang bayad.

**Kung ano ang isinasalin.** Ang isang entry na may walang lamang `msgstr`, o minarkahan ng `fuzzy`, ay hindi pa naisasalin. Isinasalin ito ng sync at inaalis ang `fuzzy` kasama ang mga previous-msgid line na `#|`. Pinapanatili ang mga komento ng tagasalin (`# …`). Ang mga reference (`#:`), na-extract na komento (`#.`) at mga flag ay nagmumula sa source. Ipinapadala ang mga komentong `#.` at `msgctxt` sa modelo bilang konteksto. Ang mga entry na hindi binago ng sync ay muling isinusulat byte for byte. Ang mga entry na wala na sa source, at ang mga lipas nang entry na `#~`, ay pinapanatili sa dulo.

Ang catalog na nilikha ng Champollion (`init --langs`, o sync para sa isang locale na wala pang catalog) ay nakakakuha ng buong header na isinusulat ng `msginit --no-translator`, na tinatanggap ng `msgfmt -c`: `Project-Id-Version`, `Report-Msgid-Bugs-To` at `POT-Creation-Date` na kinopya mula sa template (ang `PACKAGE VERSION` ay pinapalitan ng pangalan ng folder ng proyekto, at walang `POT-Creation-Date` kung walang petsa ng template), `PO-Revision-Date` (kung kailan ginawa ang file), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit` at `Plural-Forms`. Ang header ng isang umiiral nang catalog ay hindi kailanman muling isinusulat — tanging ang placeholder na `Plural-Forms` o `charset=CHARSET` dito ang pinupunan.

**Mga Plural.** Ang isang entry na may `msgid_plural` ay isinasalin bilang isang ICU plural message (`{n, plural, one {One file} other {%(count)d files}}`), kaya isinusulat ng modelo ang bawat anyo nang sabay-sabay. Pagkatapos ay isinusulat ito sa `msgstr[0]`…`msgstr[n]` sa pamamagitan ng `Plural-Forms` header ng target. Kinukuha ng bawat index ang kategorya ng CLDR ng mga numerong pumipili dito. Ang Ruso na `nplurals=3` ay `one`, `few`, `many`. Kung ang target ay walang `Plural-Forms` header, o ang placeholder lamang ng template, nakukuha nito ang header na isinusulat ng `msginit` para sa wika nito, kaya ang mga `msgstr[]` slot ng catalog ang mismong pinipili ng gettext at Django: Pranses `nplurals=2; plural=(n > 1);`, Aleman `nplurals=2; plural=(n != 1);`, Ruso `nplurals=3; …`. Ang isang wikang walang entry sa `msginit` ay nakakakuha ng header na hinango mula sa CLDR, na sinuri laban sa `Intl.PluralRules` para sa bawat numero hanggang 3,000 at para sa malalaking numero. Kung ang mga panuntunan ng isang wika ay hindi maisulat bilang isang ekspresyon ng gettext, hihinto ang sync at papangalanan ang command na nagsusulat ng header: `msginit --locale=<lang> --input=<template>.pot`. Ang isang anyo na walang slot sa catalog (Pranses na `many`, para sa 1 000 000, sa isang catalog na may dalawang anyo) ay hindi na muling hihingin, mamarkahan, o iuulat bilang nawawala; ang isang catalog na may sariling header ay nagpapanatili nito, at ang mga slot nito ang sinusuri.

**Mga Limitasyon.** Dapat ay UTF-8 ang mga catalog. I-convert ang iba gamit ang `msgconv --to-code=UTF-8`. Ang isang plural msgid na hindi balanse ang mga brace ay hindi maisusulat bilang isang ICU message, kaya iuulat ito at iiwan upang kayo mismo ang magsalin. Patakbuhin pa rin ang `msgfmt --check-format` (Django: `compilemessages`) bago mag-ship. Sinusuri lamang nito ang mga entry na may flag na `#, python-format` (o `c-format`, …): idinadagdag ng `makemessages` ang flag sa mga entry na ine-extract nito na may `%` placeholder, ngunit maaaring wala ito sa isang manu-manong ginawang catalog, at ang mga entry na iyon ay hindi masusuri. Inihahambing ng `champollion verify` ang mga printf placeholder ng bawat entry — pangalan at titik ng uri — anuman ang mga flag nito, at pinapanatili ng sync ang mga flag ng source entry sa bawat entry na isinasalin nito.

### Mga Flutter ARB file (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

Gamitin ang `arb-dir` at `template-arb-file` mula sa inyong `l10n.yaml` kung magkaiba ang mga ito (`assets/i18n/intl_{lang}.arb`). Mga mensahe lamang ang isinasalin. Kapag nagsusulat:

- Ang `@@locale` ay itinatakda sa target sa anyo ng Flutter, na tumutugma sa pangalan ng file (`app_pt_BR.arb` → `"pt_BR"`). Tinatanggihan ng `gen-l10n` ang isang file na ang `@@locale` ay hindi tumutugma sa pangalan nito.
- Ang bawat metadata object na `@key` (mga placeholder, kanilang mga uri, paglalarawan) ay kinokopya mula sa source. Ang isang key na walang metadata sa source ay nagpapanatili sa metadata ng target.
- Sumusunod ang mga key sa pagkakasunod-sunod ng source. Hindi isinasama ang mga hindi naisaling mensahe, kaya nag-fa-fallback ang Flutter sa template.

Ipinapadala ang mga `description` ng mensahe sa modelo bilang konteksto. Ang mga `{name}` placeholder at mga ICU plural ay protektado ng [pagsusuri ng ICU](#icu). Iniulat din ng `verify` at `integrity` ang maling `@@locale` at placeholder metadata na naiiba sa source. Anumang sync na muling sumusulat sa file ay nag-aayos sa pareho: ibinibigay ng `champollion sync --pair en:fr --force` ang bawat hindi nagbagong mensahe mula sa cache.

## Mga No-Translate Key {#no-translate}

May ilang value na may eksaktong iisang tamang rendering sa bawat wika: isang URL, isang
repository path, isang pangalan ng package, isang identifier ng produkto. Ang tamang salin ng
`https://example.org/paper` ay `https://example.org/paper`.

Tinatanggihan ng [quality gate](/docs/concepts/quality-gate) ng Champollion
ang source-echo — isang salin na katulad na katulad ng source nito — dahil karaniwan
itong indikasyon ng pagtanggi ng modelo na gawin ang gawain. Para sa mga key na ito, nagiging
dahilan iyon upang ang tamang sagot ang tanggihan, at walang output na maaaring gawin ang modelo na papasa.
Ang mga mahihinang modelo ay natututong lusutan ang gate sa pamamagitan ng bahagyang pagbago sa value (isang
inimbentong `#fragment`, isang ligaw na trailing slash, isang invisible na zero-width space),
na nagpapadala ng mga sirang link. Ibabalik naman ng mas malalakas na modelo ang value nang walang pagbabago at babagsak
sa gate, kaya nag-e-exit ang `sync` nang non-zero sa bawat pagpapatakbo.

Ideklara ang mga key na iyon sa halip:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Ang isang tumutugmang key ay **kinokopya mula sa source locale nang verbatim** — hindi kailanman ipinapadala sa isang
backend ng pagsasalin, hindi sumasailalim sa quality gate, hindi ibinibilang bilang pagkabigo, at hindi kailanman
sinisingil. Ibinubukod din ito sa pagtatantya ng gastos bago ang pagpapatakbo para sa parehong dahilan.

### Syntax ng pattern

Ang mga pattern ay mga dot-path sa na-flatten na key space, na may dalawang wildcard:

| Pattern | Tumutugma | Hindi tumutugma |
|---------|-----------|-----------------|
| `nav.brand` | `nav.brand` (eksaktong path) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (isang `url` leaf sa anumang lalim) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

Tumutugma ang `*` sa loob ng isang segment; tumutugma ang `**` sa zero o higit pang buong segment.
Ang pattern na walang wildcard ay isang eksaktong key path.

### Pinangangasiwaan ang mga URL bilang default

Dahil ang isang key na may URL na value ay walang tamang kalalabasan sa ilalim ng gate,
ang `noTranslateUrls` ay `true` out of the box: anumang source value na walang iba kundi
isang absolute `scheme://` URL ay itinuturing bilang no-translate nang walang karagdagang pagsasaayos.

Sadyang limitado ang pagtuklas — ang buong trimmed na value ay dapat mismong URL.
Ang prosa na naglalaman lamang ng link (`"Read the paper at https://…"`) ay
normal pa ring isinasalin.

I-off ito gamit ang `"noTranslateUrls": false` kung ang inyong mga URL ay totoong
locale-specific (halimbawa, mga per-language documentation host) — pagkatapos ay ideklara
ang mga hindi locale-specific gamit ang `noTranslate`.

### Pag-aayos at pagpapatupad

Para sa isang no-translate key ay may eksaktong iisang tamang target value, kaya ang anumang
pagkakaiba ay isang depekto. Ipinapatupad ito ng Champollion sa parehong direksyon:

- **Inaayos ito ng `sync`.** Ang isang no-translate key na ang target ay nawawala,
  may `[EN] `-prefix, o binago ay muling isinusulat mula sa source. Hindi iyon nangangailangan ng API
  call, at ito ay idempotent: kapag tumugma na ang mga value, lalaktawan na ng mga susunod na sync ang key
  nang buo.
- **Bumagsak dito ang `verify` at `integrity`.** Ang isang drifted na no-translate key ay
  iniulat bilang `NO-TRANSLATE DRIFT` kalakip ang inaasahan at aktwal na mga value —
  ang mga invisible na character ay naka-escape bilang `\uXXXX`, dahil ang uring iyon ng korapsyon ay
  imposibleng makita sa isang diff. Nag-e-exit ang `champollion integrity` bilang `1`, kaya ang isang
  build na nakakabit dito ay makakahuli ng sirang URL bago pa ito mai-ship.

Kung bumagsak ang `integrity` sa ganitong paraan sa isang proyektong kakasaayos ninyo pa lamang,
nag-uulat ito ng sirang dati nang nasa inyong mga locale file. Patakbuhin ang `champollion sync`
nang isang beses upang ayusin ito.

## Pag-convert ng Script {#script-conversion}

Ang ilang wikang isinasalin ng Champollion ay maaaring *isulat* sa higit sa isang paraan. Palaging gumagana ang modelo sa **working script** ng wika (Latin romanization — SRO para sa Plains Cree, Okrand romanization para sa Klingon), at maaaring muling isulat ng isang deterministic converter ang output sa isang display script. Kung dapat ba itong gawin ay isang desisyong ginagawa ng config — **hindi kailanman isang default**:

| Locale | Working script | Nako-convert sa | Uri |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabics) | Totoong Unicode — **kailangan ng pagpili** |
| `sr` / `srp` (Serbian) | `Latn` | `Cyrl` (Cyrillic) | Totoong Unicode — **kailangan ng pagpili** |
| `tlh` (Klingon) | `Latn` (romanization) | `Piqd` (pIqaD) | PUA — opt-in |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — opt-in |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — opt-in sa pamamagitan ng `"script": "x-kryptonian"` |

**Nangangailangan ng pagpili ang mga pares na may totoong Unicode (crk, sr).** Ang Cree Syllabics at Cyrillic ay ordinaryong Unicode — nagre-render ang mga ito kahit saan — at ang parehong ortograpiya ay totoong ginagamit. Hindi pipili ang Champollion ng sistema ng pagsulat ng isang komunidad para sa isang proyekto: nagtatanong ang `init` kapag pinili ninyo ang wika, at tumatangging tumakbo ang `sync` hanggang sa tukuyin ng config kung alin:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Naka-default sa romanization ang mga PUA script (tlh, x-elvish-s, x-kryptonian).** Ang pIqaD, Tengwar at Kryptonian ay *wala sa Unicode* — naglalabas ang mga converter ng mga Private Use Area codepoint na hindi nagre-render maliban kung maglalakip kayo ng font na nakamapa sa mga codepoint na iyon. Ang romanization lamang ang output na nagre-render kahit saan, kaya ito ang default. Upang ilabas ang display script sa halip:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…at patakbuhin ang `champollion fonts install` upang magkaroon ang inyong site ng font na makakapagpakita nito. Kung ang inyong mga font ay naka-key sa Latin transliteration (maraming font ng conlang ang ganito), panatilihin ang default.

Tinatanggap ng `script` ang isang ISO 15924 code, sa anumang casing (pareho lang ang `"cans"`, `"Cans"` at `"CANS"`). Maaari rin itong itakda bawat pares, na nangingibabaw sa antas ng wika. Ang isang hindi wastong value, o isang script na hindi kayang gawin ng locale, ay magdudulot ng failure sa startup — bago ang anumang API call.

### Mga unmapped na titik at `scriptFallback` {#script-fallback}

Isinasalin lamang ng mga converter kung ano ang tinutukoy ng kanilang ortograpiya at wala nang iba. Walang `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` o `z` ang Klingon romanization — kaya ang output ng modelo na naglalaman ng isang pangngalang pantangi tulad ng "GitHub" ay hindi ganap na mako-convert. Ang Champollion ay **hindi kailanman nagsusulat ng kalahating na-convert na value**: kung mayroong anumang titik na hindi maimapa, ang buong value ay mananatili sa working script, at papangalanan ng babala ang mga titik kasama ang linya sa config na magmamapa sa mga ito.

Kayo ang magdedeklara ng mga pagmamapang iyon:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

Pinapalitan ng bawat panuntunan ang isang sequence sa working-script ng isa na *kayang* imapa ng converter, bago tumakbo ang conversion. Naba-validate ang mga panuntunan sa startup — tinatanggihan ang isang kapalit na hindi rin maaaring maimapa.

Ang Champollion ay naglalabas ng **walang sariling mga panuntunan sa fallback**: ang pag-imbento ng mga ortograpikong adaptasyon, lalo na para sa sistema ng pagsulat ng isang totoong wika, ay hindi desisyon ng isang index. May mga kombensiyon ang mga komunidad at fandom — sinasadyang gamitin ang mga ito bawat proyekto.

### Pag-aayos ng hindi ninanais na conversion {#repair-script}

Bago ang 0.3.0, walang pasubali ang conversion — nakakakuha ng hindi ma-render na output ang mga proyektong nagta-target sa mga PUA locale gusto man nila o hindi. Dalawang tool ang lumulutas dito:

- Ini-scan ng **`champollion repair-script`** ang mga locale na nagsasaad sa config na *off* ang conversion para sa mga PUA codepoint at ibinabalik ang romanization gamit ang sariling reverse table ng converter (`--dry` para mag-preview). Eksaktong bumabaligtad ang pIqaD; nawawalan ng capitalization ang mga pagbabaligtad sa Tengwar at Kryptonian at ipinapaalam ito.
- Bumagsak ang **`champollion integrity`** (exit 1) kapag may nahanap na PUA kung saan naka-off ang conversion — upang mahuli ng isang build gate ang text na hindi ma-render bago ito mai-ship, at pinapangalanan ng ulat ang paraan ng pag-aayos.

Hindi kailanman nangangailangan ng pagkumpuni ang Translation Memory: nag-iimbak ito ng mga pre-conversion na value, kaya ang pag-on o pag-off ng `script:` sa bandang huli ay hindi nangangailangan ng anumang gawain sa cache.

Nalalapat ang script conversion sa mga UI string (mga key-value file at Docusaurus JSON). Hindi kailanman kino-convert ang mga Markdown body — ang isang greedy character converter ay walang ligtas na paraan sa pagdaan sa mga code span, URL at front matter.

## Pair Configuration {#pair-configuration}

Maaaring i-configure nang magkahiwalay ang bawat source→target pair:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-3.1-pro-preview"
    },
    "en:crk": {
      "method": "llm-coached"
    }
  }
}
```

### Mga Pair Field

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `method` | `string` | Pamamaraan ng pagsasalin: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | Pangalan ng isang naka-install na plugin (mula sa `.champollion/methods/`) |
| `model` | `string` | I-override ang default na modelo para sa pares na ito |
| `temperature` | `number` | I-override ang default na temperature para sa pares na ito |
| `batchSize` | `number` | I-override ang default na laki ng batch para sa pares na ito |
| `register` | `string` | Override sa register/tono (preset key o freeform text) |
| `endpoint` | `string` | URL ng remote API endpoint. Kinakailangan kapag ang `method` ay `api`. |
| `coachingFile` | `string` | Path patungo sa isang file ng coaching prompt para sa pares na ito, binabasa nang relative sa proyekto; pinapalitan nito ang anumang hindi gaanong tiyak na coaching, at ang isang file na hindi mabasa ay magpapatigil sa pagpapatakbo |
| `promptContext` | `string` | Konteksto ng aplikasyon para sa pares na ito |
| `genderGuidance` | `string` \| `false` | Tagubilin sa kasarian para sa mga prompt ng pares na ito: inyong sariling text, o `false` para sa wala. Tingnan ang [Gabay sa kasarian](#gender-guidance). |
| `qualityTier` | `string` | Isang label na ibinibigay ninyo sa output ng pares: `standard`, `high`, `research`, `verified`. Hindi sinusukat, at pareho pa ring nagsasalin ang sync anuman ang nakalagay; ipinapakita ito ng `status` (kapag nakatakda lamang) at ina-advertise ito ng `serve` |
| `fallback` | `object` | Isang pangalawang pamamaraan para sa hindi ligtas na maisalin ng pamamaraan ng pares na ito. Tingnan ang [Paraang fallback](#fallback). Inaalis ng `null` ang fallback na nakatakda sa wika. |

### Paraang fallback {#fallback}

Maaaring magsaad ang isang pares ng pangalawang pamamaraan. Ang sariling pamamaraan ng pares ang unang magsasalin. Anumang hindi nito ligtas na maisalin ay pupunta sa fallback nang isang beses:

- **Mga key-value file:** mga key na tinanggihan ng [quality gate](/docs/concepts/quality-gate) (isang nawalang `{name}`, sirang plural, isang dalawang-salitang label na naging talata) at mga key na walang ibinalik ang pamamaraan.
- **Markdown (Hugo content at Docusaurus docs):** mga front-matter field na hindi nito isinama o inalisan ng mga salita, at mga body block na hindi nito isinama sa tugon nito, nasira (nawalan ng protektadong elemento: code, isang HTML tag, isang shortcode) o inalisan ng laman. Sa `page` segmentation, ang buong pahina.

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
    }
  }
}
```

Kapag walang text na maaaring lumabas sa inyong mga makina (isang ospital, isang paaralan, isang komunidad na nagpapanatili ng data ng wika nito on-site), gawing fallback ang isang modelong kayo mismo ang nagpapatakbo. Nagpapadala ang pamamaraang `local` sa isang OpenAI-compatible na server sa makinang ito (Ollama, llama.cpp, vLLM, LM Studio; itinatakda ng `LOCAL_API_BASE` ang address, tingnan ang [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)):

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "local", "model": "<your local model>" }
    }
  }
}
```

Alin ang gagamitin:

- **Isang hosted model** (`llm-coached` na may Gemini model, o isa pang API method) ay kadalasang mas matatag na pangalawang opinyon para sa isang low-resource na wika, at sinisingil bawat request. Gamitin ito kapag maaaring ipadala ang text sa provider na iyon.
- Pinapanatili ng **`local`** ang bawat key sa makinang ito, at ipinapakita ito ng pagtatantya bilang `$0 API cost (runs on this machine)`. Gamitin ito kapag walang anumang maaaring lumabas sa makina, kahit na mas maliit ang modelong maaari ninyong patakbuhin doon.

Dumadaan ang output ng fallback sa parehong quality gate. Ang maisasalin nito ay kina-cache sa ilalim ng sarili nitong pamamaraan sa Translation Memory, kaya itinatala ng cache kung aling pamamaraan ang gumawa ng bawat value. Muli itong ginagamit ng mga susunod na sync sa halip na tanungin muli ang unang pamamaraan; ang `--fresh` o `--retranslate` ay muling magtatanong. Ang hindi maisalin ng alinmang pamamaraan ay mananatili tulad ng kung walang fallback. Ang isang key ay iniiwang hindi naisalin at pinapanatili ang lumang lock entry nito, kaya sinusubukan itong muli ng susunod na sync at inililista ito ng `champollion verify`. Ang isang Markdown block ay isinusulat bilang source na may prefix na `[EN] `, hindi kina-cache, at muling pinoproseso ang file sa susunod na sync. Ang isang block o front-matter field na tinanggihan ng quality gate mula sa parehong pamamaraan ay pinipigilan, hindi na muling ipapadala sa mga ito hanggang sa pangalanan ng `--redo files:<page>` ang pahina ([Mga tinanggihang Markdown block at front-matter field](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Ang isang front-matter field na inalisan ng laman ng parehong pamamaraan, o isang pahinang hindi naisalin ng alinman, ay magdudulot ng failure sa file, tulad ng kung walang fallback.

Tinatanggap ng isang fallback ang parehong mga field tulad ng isang pares: `method` (kinakailangan), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. Nalulutas ito tulad ng isang pares. Ang mga field na hindi nito itinatakda (register, coaching, konteksto ng prompt, …) ay nagmumula sa pares nito. Ang sarili nitong `coachingFile` ay umaabot sa prompt nito at sa cache key nito, at ipinapakita ito ng `champollion status`. Ang writing system ay pag-aari ng pares, kaya tinatanggihan ang `script` at `scriptFallback` sa isang fallback, at gayundin ang sariling `fallback` ng fallback. Ang isang hindi kilalang pamamaraan, o isang fallback na katulad na katulad ng pares nito, ay nagpapatigil sa sync nang may error na nagpapangalan sa pares. Dapat handang tumakbo ang fallback bago magsimula ang sync, tulad ng sariling pamamaraan ng pares (halimbawa, dapat nakatakda ang API key nito).

- **Binabago lamang ng `--method` at `--model` ang sariling pamamaraan ng pares.** Pinapanatili ng fallback kung ano ang nakasaad sa config file.
- **Gastos.** Sinasaklaw lamang ng pagtatantya bago ang pagpapatakbo ang sariling pamamaraan ng pares: walang sinumang nakakaalam nang maaga kung ano ang mabibigo nito. Bawat batch ng fallback ay pinapresyuhan bago ito tumakbo, gamit ang parehong estimator. Gamit ang `--max-cost`, ang isang batch na magdudulot sa pagpapatakbo na lumampas sa cap (ang pagtatantya kasama ang bawat fallback batch sa ngayon) ay lalaktawan, kalakip ang babalang nagpapangalan sa mga key. Gayundin ang isang fallback na ang gastos ay hindi matantya (ang hindi alam ay hindi libre). Mananatiling nabigo ang mga key na iyon, at mag-e-exit ang sync nang non-zero tulad ng anumang bahagyang pagkabigo.
- **Pag-uulat.** Nagpi-print ang `sync` ng isang linya bawat pares, hal. `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`. Sinasabi ng buod ng `--json` bawat pares kung ano ang ginawa ng fallback (`method`, `attempted`, `accepted`, `failed`, `cached`): sa bawat entry ng `locales` para sa mga key-value file, sa `fallback` para sa Docusaurus JSON, at sa `content.fallback` para sa Markdown. Ipinapakita ng `champollion status` ang fallback sa ilalim ng pares nito. Hindi maaaring malaman ng `--dry` kung ano ang mabibigo, kaya wala itong iniuulat tungkol sa fallback.
- **Kapag ang fallback ang sumulat sa karamihan nito.** Kapag higit sa kalahati ng mga bagong salin ng isang pagpapatakbo para sa isang pares (ang mga tinanggap na sagot ng pamamaraan ng pares kasama ang sa fallback) ay nagmula sa fallback, nagdaragdag ang `sync` ng isang babala: ilan sa kabuuan, sa pamamagitan ng aling pamamaraan at modelo, kung bakit hindi ginamit ang mga sagot ng pamamaraan ng pares (binibilang ang bawat dahilan: isang isinaulong pangungusap na inulit para sa iba't ibang source string, labis na paghaba, …), at kung ano ang dapat isaalang-alang — maaaring hindi angkop ang pamamaraan ng pares para sa mga string na ito; suriin kung ano ang naisulat (sinusuri ng `verify` ang istruktura, sinusuri ng isang tagapagsalita ang kahulugan); isang mas matatag na fallback. Nagdadala ang mga entry ng `--json` ng `primaryAccepted` at `primaryReasons` katabi ng `accepted`. Ibinibigay ng `champollion status` ang parehong bahagi para sa mga file ("from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%)"), at sinasabi kapag ito ang karamihan sa text ng locale.
- Ginagamit din ng `champollion serve` ang fallback, sa loob ng mga cap nito na `--max-cost-per-request` / `--max-session-cost`.

## Language Configuration {#language-configuration}

Tumatanggap ang mga wika ng tatlong format:

### Array ng mga code (pinakasimple)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Nakukuha ng bawat wika ang default register nito mula sa built-in register table. Ang mga wikang walang default ay nakakakuha ng `"Professional register."`.

### Object na may mga register string

Maaaring ang value ay isang **preset key** mula sa card ng wika, o custom na register text:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Sinusuri ng Champollion kung tumutugma ang string sa isang preset key sa language card. Kung oo, ginagamit ang buong register prompt mula sa card. Kung hindi, ginagamit ang string nang as-is. Tingnan ang [Mga Sinusuportahang Wika](/docs/reference/supported-languages#language-cards) para sa mga available na preset.

### Object na may buong config

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

Maaari ninyong paghaluin ang shorthand at buong objects sa parehong block.


### Mga Language Field

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `register` | `string` | Mga tagubilin sa estilo/tono. Maaaring isang **preset key** (hal., `casual-tu`, `formal-hapsyo`) o custom na text. Tingnan ang [Mga Language Card](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Pangalan ng wika na nababasa ng tao (para sa pagpapakita ng status) |
| `model` | `string` | I-override ang default na modelo |
| `temperature` | `number` | I-override ang default na temperature |
| `batchSize` | `number` | I-override ang default na laki ng batch |
| `coachingFile` | `string` | Path patungo sa isang file ng coaching prompt para sa wikang ito, binabasa nang relative sa proyekto; pinapalitan nito ang top-level na coaching, at ang isang file na hindi mabasa ay magpapatigil sa pagpapatakbo |
| `promptContext` | `string` | Konteksto ng aplikasyon para sa wikang ito |
| `genderGuidance` | `string` \| `false` | Tagubilin sa kasarian para sa mga prompt ng wikang ito: inyong sariling text, o `false` para sa wala. Tingnan ang [Gabay sa kasarian](#gender-guidance). |
| `maxRetries` | `number` | Pinakamataas na retry budget para sa mga nabigong batch (default: 3) |
| `script` | `string` | ISO 15924 code ng ortograpiyang isinusulat ng Champollion (hal. `"Cans"`, `"Piqd"`). Tingnan ang [Pag-convert ng Script](#script-conversion). |
| `scriptFallback` | `object` | Mga panuntunan sa transliteration para sa mga titik na hindi maimapa ng script converter. Tingnan ang [Pag-convert ng Script](#script-conversion). |
| `endpoint` | `string` | URL ng remote API endpoint, para sa `"method": "api"` |
| `fallback` | `object` | Isang pangalawang pamamaraan para sa hindi ligtas na maisalin ng pamamaraan ng wikang ito. Tingnan ang [Paraang fallback](#fallback). |

:::info[Inheritance chain]
Nare-resolve ang mga setting sa ganitong pagkakasunod-sunod (unang tumugma ang mananaig):

**antas ng pares (pair-level)** → **antas ng wika (language-level)** → **pandaigdigang config (global config)** → **mga default**

Halimbawa, kung nagtatakda ang `pairs["en:fr"]` ng `model`, ino-override nito kapwa ang language-level at global na mga value ng `model`.
:::

### Gabay sa kasarian {#gender-guidance}

Naglalaman ang mga prompt ng LLM ng tagubilin tungkol sa gramatikal na kasarian para sa mga wikang
mayroon nito. Nagmumula ito sa katalogo ng Champollion: humihiling ang Pranses ng *écriture
inclusive* gamit ang interpunct kapag hindi alam ang kasarian ng mambabasa
(`Connecté·e`, hindi `Connecté(e)` o `Connectée`; `Utilisateur·rice·s` sa
plural), ang Aleman ay para sa anyong may tutuldok (`Benutzer:innen`), ang Hapones ay para sa
neutral na `私`. Ipiniprint ito ng `champollion init` katabi ng register ng bawat wika, at
ipinapakita ito ng `champollion status` bawat pares, kasama ang pinagmulan nito.

Pumili ng ibang estilo gamit ang `genderGuidance`, para sa bawat wika o para sa isa:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

Walang ipinapadalang tagubilin sa kasarian ang `false`; pinapalitan naman ng isang string ang nasa katalogo.
Nalalapat ang setting sa mga pamamaraang tumatanggap ng mga tagubilin (ang mga pamamaraan ng LLM); hindi
sinasabihan ang mga machine translation engine (DeepL, Google, …). Ang binagong tagubilin sa
kasarian ay isang kakaibang prompt, kaya mayroon itong sariling mga cache entry: ang
naisalin na ay mananatili sa dating ayos hanggang sa muli ninyo itong isalin (`champollion sync
--redo all`, na iminumungkahi ng sync kapag hawak ng mga file ang naunang estilo).

## Source na Hindi English

Kung hindi English ang inyong source language:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Lock File

Lumilikha ang Champollion ng `.champollion.lock` upang subaybayan ang mga SHA-256 hash ng mga naisaling source value. **I-commit ang file na ito** upang magbahagi ang lahat ng developer ng parehong baseline ng pagsasalin. Sa isang proyektong may isang folder bawat wika, itinatala ang mga key bilang `<namespace>::<key>`.

Bawat target locale, itinatala rin ng lock ang isang fingerprint ng bawat value na isinulat ng sync at ng source text na isinalin nito (upang makilala ang isang value na in-edit ng isang tao, at maiulat ang isang lipas nang salin), ang mga key na hindi natapos ng isang redo (**pending**), at ang mga key na tinanggihan ng quality gate (**held back** mula sa parehong modelo). Kapag mayroon ng alinman sa mga iyon na itatala, kukunin ng file ang version-2 form nito, ang `{"version": 2, "source": {…}, "locales": {…}}`; ang isang version-1 lock (isang payak na key → hash map) ay binabasa tulad ng dati. Ang isang pinalitang manu-manong edit ay pinapanatili sa `.champollion-replaced-edits.jsonl` katabi nito — i-commit ang pareho. Tingnan ang [Quality Gate](/docs/concepts/quality-gate#refused-keys-are-held-back) at [Pag-edit ng mga salin](/docs/guides/professional-translators#editing-key-value-files).

Kapag nagbago ang isang source value, hindi na tumutugma ang hash, at muling isasalin ng champollion ang key na iyon sa susunod na sync.

## `.champollionignore`

Gumawa ng `.champollionignore` sa root ng inyong project upang ibukod ang mga file mula sa pag-scan ng `lint`. Gumagamit ito ng mga glob pattern, tulad ng `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Direktoryong `.champollion/`

Lumilikha ang Champollion ng isang `.champollion/` na direktoryo sa root ng inyong proyekto para sa panloob na estado. Huwag itong isama sa version control — ito ay isang per-machine cache, hindi source ng proyekto. Idinadagdag ng `champollion init` ang linyang ito sa `.gitignore`, na nililikha ang file kung wala pa ito (pati sa isang folder na hindi pa git repository, upang ang susunod na `git init` at `git add --all` ay hindi mag-commit ng cache):

```gitignore
.champollion/
```

I-commit ang mga lock file sa tabi nito (`.champollion.lock`, `.champollion-content.lock`): itinatala ng mga ito kung saang source text ginawa ang bawat salin.

| File | Layunin | I-commit? |
|------|---------|--------|
| `tm.json` | Cache ng Translation Memory — nag-iimbak ng mga naunang salin na naka-key ayon sa source text + locale + pamamaraan | Hindi (lokal na cache) |
| `xliff/*.xliff` | Mga XLIFF export file para sa pagsusuri ng propesyonal na tagasalin | Hindi (panandalian) |
| `methods/` | Mga manifest ng naka-install na method plugin | Hindi pinapansin ng linyang `.champollion/`. Upang ibahagi ang mga naka-install na plugin, palitan ang linyang iyon ng `.champollion/*` at `!.champollion/methods/` |
| `backups/` | Mga pre-wrap backup (nilikha ng `wrap --undo`) | Hindi (safety net) |

Tingnan ang [Translation Memory](/docs/concepts/translation-memory) para sa mga detalye tungkol sa `tm.json` at kung paano ito nakakatipid ng gastos sa API.

---

## Programmatic API

Para sa mga build script at custom integration, direktang mag-import mula sa package:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### Mga Available na Export

| Export | Ginagawa Nito |
|--------|-------------|
| `TranslationMethod` | Base class para sa lahat ng pamamaraan |
| `LLMMethod` | Base class para sa mga pamamaraan ng LLM (OpenRouter) |
| `DirectLLMMethod` | Base class para sa mga direktang LLM provider (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Mga class ng direktang LLM provider |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Mga tradisyonal na MT class |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Coached LLM (OpenRouter + coaching data) |
| `APIMethod` | Remote API client |
| `runSync`, `runContentSync` | Buong sync pipeline |
| `translateWithFallback`, `translateAndValidate` | Pipeline ng isang pares para sa isang batch ng mga key, gaya ng pagpapatakbo rito ng `sync`: cache, pamamaraan, quality gate, cache, pagkatapos ay ang fallback ng pares. Ipasa ang isang pares mula sa `resolvePairs`, ang `tm` mula sa `loadTM`, at ang `cwd`, ang direktoryo ng proyekto: binabasa ng pamamaraan ang key, endpoint, coaching at glossary nito roon, hindi mula sa `process.cwd()` |
| `createFallbackBudget` | Ang `--max-cost` guard para sa mga fallback batch (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | Ang mga file na bumubuo sa bawat locale (flat, folder bawat locale, o `localesPattern`) |
| `resolveConfig`, `resolvePairs` | Paglutas ng config |
| `validateTranslations` | Quality gate |
| `loadCoachingData`, `findDictionaryMatches` | Mga utility sa coaching |

### Custom Provider Extension

I-extend ang `DirectLLMMethod` upang magdagdag ng bagong LLM provider sa ~40 linya:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

Makukuha ninyo ang translate, coaching, retry loops, model validation, quality tiers, at setup help nang walang karagdagang pagpapatupad. Ang HTTP request shape lang ang partikular sa provider. Para sa mga non-LLM adapter na gumagamit ng raw `fetch()`, gamitin ang shared helper na `fetchWithRetry()` mula sa `lib/methods/fetch-with-retry.js` sa halip na magsulat ng sarili ninyong retry loop.

---

## Tingnan Din

- [CLI Reference](/docs/reference/cli) — lahat ng command at flag
- [Translation Methods](/docs/guides/translation-methods) — pagpili at paghahalo ng mga method
- [Translation Memory](/docs/concepts/translation-memory) — caching at pagtitipid sa gastos
- [Paggawa kasama ang mga Propesyonal na Tagasalin](/docs/guides/professional-translators) — XLIFF workflow
- [Plugin Specification](/docs/reference/plugin-spec) — format ng method plugin manifest
- [Architecture](/docs/concepts/architecture) — kung paano magkakaugnay ang mga bahagi
- [Mga Sinusuportahang Wika](/docs/reference/supported-languages) — built-in language support
- [Paano Gumagana ang Sync](/docs/concepts/how-sync-works) — ang translation pipeline
