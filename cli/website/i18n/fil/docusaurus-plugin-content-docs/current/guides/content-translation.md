---
sidebar_position: 5
title: "Pagsasalin ng Nilalaman"
---

# Pagsasalin ng Nilalaman (Markdown)

Isinasalin ng Champollion ang mga Markdown at MDX file, kapwa ang mga field ng front matter at ang body. Ang mga code block, shortcode, at iba pang structured na elemento ay pinoprotektahan mula sa pagsasalin.

Nakalagak ang mga file sa isang **content directory** (`contentDir`). Maaari itong maging anumang folder ng Markdown: ang `content/` ng isang Hugo site, o isang folder ng mga newsletter sa loob ng isang Next.js app. Iba naman ang isang Docusaurus site (isa na may `docusaurus.config.js`): ang `docs/` at `blog/` nito ay isinasalin patungo sa mga `i18n/<locale>/` folder nang walang `contentDir`. Tingnan ang [Framework Integration](/docs/guides/framework-integration).

## Setup

Itakda ang `contentDir` sa inyong config, o ipasa ang `--content-dir` sa command line:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

Sa simula ng pagpapatakbo, tinutukoy ng sync ang folder at sinasabi kung saan mapupunta ang mga salin:

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

Sa isang Hugo site, tinutukoy rin nito ang nakitang ebidensya, halimbawa `Detected framework: Hugo (hugo.toml)`. Itinuturing na nakita ang Hugo kapag mayroong file na `hugo.toml`/`.yaml`/`.yml`/`.json`, ang `config/_default/` folder ng Hugo, isang `config.toml` o `config.yaml` na may setting na para lang sa Hugo tulad ng `baseURL`, isang `archetypes/` folder, o isang `layouts/` folder ng mga template ng Hugo. Hugo man o hindi, isinasalin at pinapangalanan ang mga file sa parehong paraan.

## Kung Saan Napupunta ang mga Salin

Ang bawat salin ay isinusulat **katabi ng source nito**, kung saan idinadagdag ang target locale bago ang extension. Ito ang translation-by-filename convention ng Hugo:

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

Hinahanap din ang mga subfolder, at nananatili ang bawat salin sa folder ng source nito. Pinipili ng inyong app ang file para sa isang locale ayon sa pangalang iyon. Ang isang Next.js page, halimbawa, ay nagbabasa ng `newsletters/2026-10.crk.md` para sa Plains Cree.

**Aling mga file ang itinuturing na mga source.** Bawat `.md` at `.mdx` file sa folder ay isang source, maliban kung nagtatapos ang pangalan nito sa `.<code>.md` (o `.mdx`) at ang `<code>` ay mukhang language code. Ang language code dito ay dalawa o tatlong maliliit na titik, na opsyonal na sinusundan ng script tulad ng `-Hant` at/o rehiyon tulad ng `-BR` o `-419`. Ang mga file na iyon ay itinuturing na mga salin at nilalagpasan. Ang suffix ng source na wika (`launch.en.md`) ay itinuturing pa rin bilang isang source. Isang patibong: ang isang source file na pinangalanang tulad ng `guide.faq.md` ay nagtatapos din sa isang suffix na may dalawa hanggang tatlong titik, kaya napagkakamalan itong isang salin sa "faq" at hindi isinasalin. Palitan ang pangalan nito, halimbawa sa `guide-faq.md`.

## Ano ang Isinasalin

### Front Matter

Sinusuportahan ang parehong YAML (`---`) at TOML (`+++`) delimiter. Bilang default, isinasalin ang mga field na ito:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

Ang lahat ng iba pang field (`date`, `draft`, `tags`, `weight`, `slug`, atbp.) ay kinokopya mula sa source ayon sa orihinal ng mga ito. Maaari ninyong baguhin ang listahan gamit ang `translatableFields` sa inyong config.

### Nilalaman ng Body

Bilang default, hinahati ang body sa mga talata at iba pang top-level block, at isinasalin ang bawat block. Ang mga structured na elemento ay pinoprotektahan ng mga placeholder bago isalin at ibinabalik pagkatapos. Gamit ang `contentSegmentation: "page"`, ang body ay isinasalin bilang isang buong bahagi.

## Proteksiyon sa Block

Dumaraan sa pagsasalin ang mga elementong ito nang hindi ginagalaw:

| Element | Halimbawa | Proteksiyon |
|---------|---------|-----------|
| Mga code block | ``````` ```js ... ``` ``````` | Protektado ang buong block |
| Inline code | `` `variable` `` | Protektado |
| Mga Hugo shortcode | `{{< figure >}}`, `{{% note %}}` | Protektado ang buong block |
| Raw HTML | `<div>`, `<table>` | Protektado |
| Mga link (URL) | `[text](https://...)` | Pinananatili ang URL, isinasalin ang text |
| Interpolation | `{{ .Count }}` | Protektado |

## Kapag Isinalin Muli ang Isang File

Nagtatala ang sync ng fingerprint (SHA-256) ng bawat source file sa `.champollion-content.lock`. I-commit ang file na iyon kasama ng inyong mga salin.

- **Hindi nagbago ang source:** hindi ginagalaw ang salin.
- **Nagbago ang source:** ina-update ang file. Ang mga talatang hindi nagbago ang Ingles ay kinukuha mula sa [Translation Memory](/docs/concepts/translation-memory) nang walang bayad, kaya magbabayad lamang kayo para sa mga talatang nagbago.
- **Isang translation file na walang lock entry** (isang isinulat ninyo nang manu-mano) ay pinapanatili ayon sa dati at itinatala bilang sa inyo. Ang eksepsiyon ay ang isang file na naglalaman pa rin ng mga `[EN] ` marker na isinulat ng isang CLI na mas luma sa 0.5.0, na muling isinasalin.
- **Isang block na tinanggihan ng quality gate, maging noong muling hiningi kasama ang dahilan,** ay nagpapanatili ng source text nito, nang walang marker sa pahina. Mababasa sa lock entry ng pahina ang `pending:<hash>`, at ang pagtanggi ay itinatala sa `.champollion-content.lock`. Hindi na ipapadala ng mga susunod na sync ang block na iyon sa parehong modelo, kaya hindi na ito sisingilin muli. Inililista ng `status` at `verify` ang pahina. Hilingin muli gamit ang `--redo files:<page>`, magdagdag ng isang `fallback` method, o isulat ang talata nang manu-mano (ito ay pinapanatili). Ang isang tinanggihang front-matter field ay nagpapanatili ng source text nito sa parehong paraan, at ang natitirang bahagi ng pahina ay isinusulat. Tingnan ang [Refused Markdown blocks and front-matter fields](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields).

Upang sadyang muling isalin ang isang file, tukuyin ang pangalan nito. Ang path ay ang ipinapakita ng sync, na kaugnay ng content directory:

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## Pagsusuri at Pag-eedit ng mga Salin {#reviewing-and-editing-translations}

Maaaring itama ng isang reviewer ang isinaling Markdown nang direkta sa mismong isinaling file. Pinapanatili ng Champollion ang mga pagtatamang iyon kapag nagbago ang source kalaunan.

1. Patakbuhin ang `champollion sync` at i-commit ang mga salin kasama ang `.champollion-content.lock`.
2. Bubuksan ng reviewer ang isinaling file, halimbawa `newsletters/2026-10.crk.md`, at ie-edit ito. Maaari nilang baguhin ang anumang talata, o isang isinaling front-matter field tulad ng `title` o `description`.
3. Ico-commit ng reviewer ang file. Walang kinakailangang command upang "tanggapin" ang mga pag-edit.

Ang mangyayari sa mga pag-edit sa susunod na `champollion sync`:

| Sitwasyon | Ang ginagawa ng sync |
|---|---|
| Hindi nagbago ang source | Wala. Ang salin ay iniiwan nang eksakto ayon sa kung paano ito iniwan ng reviewer. |
| Nagbago ang source sa **iba pang** mga talata | Ang mga talata at field ng reviewer ay **pinapanatili nang salita-sa-salita** at ang mga nagbagong talata ay isinasalin. Sinasabi ito ng pagpapatakbo, halimbawa `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`. Ang teksto ng reviewer ay nananatiling kanila sa bawat susunod na sync. |
| Ang talata ng source na inedit ng reviewer ay nagbago **rin** | Muling isinasalin ang talatang iyon, dahil isinasalin ng bersyon ng reviewer ang Ingles na wala na ngayon. Nagpi-print ang pagpapatakbo ng babala kasama ang mga salita ng reviewer, upang maaari itong muling ilapat kung angkop pa rin. |
| Nagdagdag, nag-alis, o nagsama ng mga talata ang reviewer, o gumagamit ang pares ng `contentSegmentation: "page"` | Hindi maitutugma ang mga pag-edit bawat talata. Kapag nagbago ang source, ang file ay **iniiwan nang eksakto kung paano ito**, at nagbabala at naglilista ang bawat sync hanggang sa maresolba ito. Alinman sa i-update ito nang manu-mano (ituturing ng susunod na sync ang na-edit na file bilang kasalukuyan), o palitan ito ng machine translation gamit ang `--redo files:<path>`. |

Ang mga pag-edit sa mga code block, whitespace sa pagitan ng mga talata, at mga front-matter field na hindi isinalin (`date`, `tags`, at iba pa) ay hindi pinapanatili kapag muling isinusulat ang file. Ang mga bahaging iyon ay laging nagmumula sa source.

**Sadyang pagpapalit sa mga pag-edit.** Napapalitan lamang ang mga pag-edit kapag tinukoy ninyo ang file. Ibinabalik ng `--redo files:2026-10.md` ang naka-cache na machine translation. Isinasalin itong muli mula sa simula ng `--redo files:2026-10.md --fresh` (o `--retranslate 2026-10.md`). Ang pagpapatakbo na muling nagpoproseso ng lahat ng nilalaman nang hindi tumutukoy ng mga file (`--redo content`, `--force-content`) ay nagpapanatili sa mga pag-edit.

**Kung paano kinikilala ang mga pag-edit.** Sa bawat pagkakataong nagsusulat ang sync ng salin, nagtatala rin ito sa `.champollion-content.lock` ng maikling fingerprint ng bawat talatang isinulat nito. Ang isang talata sa disk na hindi na tumutugma ay binago ng isang tao. Kung mawala ang lock file, hindi makikilala ang mga pag-edit, kaya panatilihin ito sa version control. Ang isang saling isinulat ng mas lumang bersyon ng Champollion ay itinatala sa susunod na sync. Kung ang inyong mga pag-edit dito ay naiiba sa nilalaman ng Translation Memory, kinikilala ang mga ito bilang sa inyo.

Ang teksto ng reviewer ay hindi kailanman iniimbak sa Translation Memory bilang machine output.

:::note[Sinasaklaw lamang ng XLIFF ang mga string file]
Ipinapasa ng `champollion xliff export` ang mga **string file** (mga key at value) ng inyong app sa CAT tool ng isang tagasalin. Tingnan ang [Working with Professional Translators](/docs/guides/professional-translators). Wala pang XLIFF export para sa nilalamang Markdown, kaya sinusuri ang isinaling Markdown sa mismong mga file, tulad ng inilarawan sa itaas.
:::

## Mga Paraang Markdown-Only

:::warning[Google Translate at Markdown]
Ang Google Translate ay **walang kaalaman** tungkol sa mga code block, shortcode, o interpolation variable. Sisirain nito ang structured na nilalamang Markdown. Gumamit ng mga LLM method (`llm` o `llm-coached`) para sa pagsasalin ng nilalaman, dahil tahasan nitong pinoprotektahan ang mga structured na elemento.
:::

Kapag nag-fallback ang pagsasalin ng nilalaman mula sa Google Translate patungo sa isang LLM method, nagla-log ang champollion ng babalang nagpapaliwanag kung bakit.
