---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/getting-started/configuration
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Buod para sa Ehekutibo.** Saklaw ng pahinang ito ang installation, configuration, at paggamit ng MT evaluation harness — ang tool na nagbe-benchmark ng mga paraan ng pagsasalin laban sa standardized corpora at gumagawa ng mga run card na may score. Para sa canonical na mga depinisyon ng metrics, schemas, at evaluation protocol, tingnan ang [Benchmark Specification](/docs/network/specifications/benchmark).

Nagpapatakbo ang harness ng mga eksperimento sa pagsasalin at gumagawa ng mga run card. Pinangangasiwaan nito ang prompt construction, API calls, scoring, at result serialization — kayo ang magbibigay ng dataset at model.

## Installation

**Mga Kinakailangan:** Python 3.11+

```bash
python3 -m pip install mt-eval-harness
```

Ini-install nito ang `mt-eval` command.

## Paggamit

```bash
mt-eval run --corpus path/to/dataset.json
```

Pinatatakbo nito ang bawat entry sa corpus sa configured model (o method plugin), sinusuri ang score ng outputs, at nagsusulat ng run card JSON file sa output directory.

## CLI Flags

### `mt-eval run`

| Flag | Kinakailangan | Default | Paglalarawan |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Path patungo sa corpus file (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Mga parallel text file (FLORES+, format ng WMT) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Eksaktong slug ng modelo: ang buong id ng OpenRouter, o ang sariling eksaktong pangalan ng isang direktang provider. Walang mga alias at walang mga floating id (`~vendor/…`, `…-latest`): tinatanggihan ang isang maikling pangalan tulad ng `gemini-pro`, at isinasaad sa pagtanggi ang slug na dapat isulat. Pinaghihiwalay ng kuwit para sa mga pagpapatakbong multi-model. Kapag may `--method local-model`, ito ang modelong patatakbuhin — isang Hugging Face id o isang directory ng modelo — at kinakailangan ito: walang default na modelo ang engine na iyon. Kapag may plugin ng pamamaraan, ibinibigay ito sa plugin bilang `config.method_model`. Ang iba pang MT engine ay nagsasalin gamit ang sarili nitong modelo at isinasaad ng pagpapatakbo na hindi ginagamit ang `-m` |
| `-d, --dataset` | — | `all` | Filter ng dataset: `all`, pangalan ng segment, o saklaw ng ID |
| `--ids` | — | — | Mga ID ng entry na pinaghihiwalay ng kuwit na susuriin |
| `--source-lang` | — | `English` | Pangalan ng source language |
| `--target-lang` | — | — | Pangalan ng target language, ayon sa sinasabi ng prompt. Ang isang code na ibinigay rito (`sme`) ay pinapangalanan mula sa language card nito ("Northern Sami"), at isinasaad ito ng header ng pagpapatakbo; ang isang code na walang card na nagpapangalan (isang pribadong gamit na `qaa`) ay mananatiling code, na may babala na dadalhin ito ng prompt |
| `-p, --prompt` | — | `naive` | Bersyon ng prompt (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Path patungo sa text file ng coaching prompt. **Pinapalitan** nito ang built-in na prompt: natatanggap ng modelo ang file nang eksakto sa pagkakasulat (kasama ang linyang `--target-script`), hindi ang built-in na tagubiling "Translate the given … text to …; output only the translation". Isinasaad ito ng dry run at ng header ng pagpapatakbo sa isang pasya: ✓ kapag pinangalanan ng file ang target language (at kung sa aling pangalan o code), ⚠ kapag hindi nito pinangalanan ang wika o ang code nito, o hindi sinuri kapag walang alam na pangalan o code |
| `--glossary` | — | — | Glossary ng pagsusuri (JSON) para sa pagsunod sa terminolohiya; para sa pagmamarka lamang, hindi kailanman ipinapadala sa modelo |
| `--coaching` | — | — | Inline na text ng coaching (naka-quote na string) |
| `--method` | — | — | Path patungo sa directory ng plugin ng pamamaraan (naglalaman ng `method.json` + Python module), o isang nakarehistrong MT engine (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Kapag may `--method local-model`: magpatakbo ng modelo ng pares ng OPUS-MT na ang id ay nagpapangalan ng ibang pares kaysa sa corpus (`opus-mt-en-fi` sa isang corpus na `eng>sme`, bilang baseline ng magkaugnay na wika). Tinatanggihan kung wala ito; itinatala ito ng run card |
| `--method-card` | — | — | Path patungo sa JSON ng method card para sa metadata ng leaderboard |
| `--skip-fst` | — | `false` | Magmarka nang walang FST acceptance, kahit pa may FST ang wika, at huwag nang magsaad ng anupaman tungkol dito. Minamarkahan ito ng run card bilang hindi kinalkula. Kung wala ang flag na ito, ang nawawalang FST (ang analyzer o ang pyhfst runtime nito) ay hindi rin magpapahinto sa pagpapatakbo: magpapatuloy ito, mamarkahan ng run card ang FST acceptance at morpolohiya bilang hindi kinalkula, at papangalanan ng abiso ang `mt-eval setup --lang <code>`. Pagkatapos ng pag-install na iyon, idaragdag ng `mt-eval test <run log>` ang marka ng FST sa natapos na pagpapatakbo nang hindi muling nagsasalin. Walang kusa o sariling nagda-download |
| `--skip-eval-standard` | — | `false` | Magmarka nang wala ang mga metric na eval-standard ng language card (isang panlabas na package). Minamarkahan ang mga ito ng run card bilang hindi kinalkula. Kung wala ang flag na ito, kinakalkula ang mga metric ng isang naka-install na package; ang isang package na hindi naka-install ay isang opsyonal na add-on — magpapatuloy ang pagpapatakbo nang wala ang mga metric nito (minarkahang hindi kinalkula) at papangalanan ang `python3 -m pip install` na idineklara ng card. Walang ini-install ang isang pagpapatakbo |
| `--tools` | — | `false` | Paganahin ang tool-calling mode |
| `--tools-list` | — | — | Mga pangalan ng tool na pinaghihiwalay ng kuwit |
| `--max-tool-rounds` | — | `8` | Pinakamataas na bilang ng mga round ng tool-calling bawat entry |
| `--style-profile` | — | — | Path patungo sa isang style profile JSON. Pinapagana ang mga metric ng writing-style consistency (mga diagnostic — hindi kailanman bahagi ng headline score; tingnan ang [§ Mga metric ng estilo ng pagsulat at rehistro](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Mga entry bawat tawag sa API |
| `-c, --concurrency` | — | `8` | Mga parallel na tawag sa API |
| `--max-tokens` | — | `32768` | Pinakamataas na token bawat tawag sa API |
| `--temperature` | — | `0.0` | Sampling temperature (0.0 = deterministic) |
| `--no-cache` | — | `false` | I-disable ang pag-cache ng tugon |
| `--cache-dir` | — | `eval/cache/harness` | Path ng cache directory (tingnan ang [Ang cache ng pagsasalin](#the-translation-cache)) |
| `--metricx` | — | `false` | Kalkulahin din ang MetricX-24 (Google, Apache-2.0), isang mas-mababa-ay-mas-mahusay na neural error score (0–25), na iniuulat sa tabi ng chrF++ headline at hindi kailanman inihahalo rito. Kinakailangan ang extra na `metricx` at ang code ng modelo ng Google (tingnan ang [Mga opt-in na neural metric](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Kapag may `--metricx`: isa pang MetricX checkpoint (isang xl/xxl, o isang `google/metricx-25-*`) |
| `--fuse` | — | `false` | Kalkulahin din ang FUSE-style comparator, isang hindi sinanay na muling pagpapatupad ng pamamaraang AmericasNLP 2025 FUSE, na iniuulat bilang isang diagnostic comparator, hindi kailanman sa headline. Kinakailangan ang extra na `fuse` (tingnan ang [Mga opt-in na neural metric](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Output directory para sa mga run card at log |
| `-n, --name` | — | — | Pangalan ng pagpapatakbo na nababasa ng tao |
| `--dry-run` | — | `false` | I-validate ang configuration at corpus nang hindi gumagawa ng mga tawag sa API. Pinapangalanan nito ang coaching file at glossary na gagamitin ng pagpapatakbo (o `none`), ipinapakita ang prompt (ang built-in nang buo; ang isang coaching file ayon sa unang linya nito at sha256, at na pinapalitan nito ang built-in), sinasabi kung nasaan ang cache ng pagsasalin, at pinapatakbo ang parehong pagsusuri ng eval-pack na ginagawa ng totoong pagpapatakbo, na iniuulat ito sa mga linyang nagsisimula sa `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …`, o `none needed for <language>`) nang hindi nagkakamali o bumabagsak. Sinasabi ng pangalawang linya kung hihinto ba ang totoong pagpapatakbo: ang nawawalang FST ay hindi kailanman nagpapahinto rito, samantalang ang iba pang nawawalang bahagi ay nagpapahinto rito. Sa ilalim ng `--json`, taglay ng buod ang `coaching_file`, `prompt` (ang uri nito, sha256, at haba; ang teksto ng built-in na prompt), `glossary_file`, at `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | Code ng wika sa BCP-47 |
| `--target-script` | — | — | Ang script sa ISO 15924 kung saan dapat nakasulat ang mga salin (`Latn`, `Cans`, …), isa na nakalista sa language card ng target. Hinihingi ito ng prompt ng harness (idinagdag din sa teksto ng isang coaching file), kaya bahagi ito ng sha256 ng prompt. Para sa isang wikang isinusulat sa mahigit isang script, tulad ng Plains Cree, gamitin ang script kung saan nakasulat ang inyong mga reference. Kung wala ito, binibilang ng harness ang mga titik ng mga reference ayon sa script (isang pinagsama-samang bilang: walang pangungusap na ipinapakita, kaya nalalapat din ito para sa isang local-only na corpus) at hinihingi ang script na naglalaman ng 90% o higit pa sa mga ito, na sinasabi ito sa header ng pagpapatakbo ("references are 100% Latn → prompting for Latn") at itinatala ito sa log ng pagpapatakbo (`config.target_script_source`); ang mga reference na magkahalo ay hindi binibigyan ng script at may babala kasama ang mga bahagdan, at ang isang reference sa kabilang script ay makakakuha ng markang halos sero. Tinatanggihan para sa isang MT engine o isang plugin ng pamamaraan, na hindi nakakatanggap ng prompt |

`--champollion-config` at `--prompt champollion` ay inalis na sa 0.2.0 at tinatanggihan kalakip ang dahilan. Gayundin ang `--champollion-cards-dir`; itakda ang `MT_EVAL_CARDS_DIR` upang ituro ang harness sa ibang directory ng mga card. Muli nilang binuo ang prompt ng CLI sa Python, at ang kopyang iyon ay nagbago na mula sa CLI. Gumamit ng method plugin (`--method`) upang suriin ang isang paraan ng CLI, at `mt-eval export-config` upang magdala ng resulta pabalik sa isang proyekto ng CLI.

### Mga neural metric na opt-in

Kinakalkula ang COMET tuwing naka-install ang `unbabel-comet` (`mt-eval setup --comet`: humigit-kumulang 300 MB para i-install, at humigit-kumulang 2.3 GB ng modelo sa unang paggamit). Naka-off ang dalawa pang metric maliban kung hihilingin ng isang run, dahil naglo-load ang bawat isa ng malaking modelo. Tulad ng COMET, tumatakbo ang mga ito sa makinang ito (walang bayad sa API, walang tekstong ipinapadala saanman), iniuulat ang mga ito sa tabi ng headline ng chrF++ at hindi kailanman inihahalo rito, at sinasabi ng run card ang "not run" kalakip ang flag na dapat ipasa kapag hindi hiniling ang mga ito.

| Metric | Flag | Ang kailangan nito | Ang konsumo nito |
|--------|------|--------------------|-------------------|
| MetricX-24 (`metricx_score`, mas mababa mas maganda, 0–25) | `--metricx` (checkpoint: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) at model code ng Google, na wala sa PyPI: `python3 -m pip install git+https://github.com/google-research/metricx` | Nagda-download ang default na `google/metricx-24-hybrid-large-v2p6` checkpoint at ang mT5-XL tokenizer ng ilang GB mula sa Hugging Face sa unang paggamit; mabagal ang pag-score sa isang CPU. Kung walang reference, nag-iiskor ito sa reference-free (QE) mode nito |
| FUSE-style comparator (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | Nagda-download ang LaBSE ng humigit-kumulang 1.8 GB sa unang paggamit. Kung walang LaBSE, hindi kinakalkula ang score, at isinasaad ito ng ulat. Hindi ito sinanay (isang unweighted mean ng mga bahagi nito), at ang resulta ay minarkahang `fuse_untrained` |

Sa pamamagitan ng MCP (ang buong profile, `--profile full`), tumatanggap ang `run_benchmark` ng `metricx` (kasama ang `metricx_model`) at `fuse`, at kinakailangan ng `comet: true` ang COMET; isinasaad ng plano nito kung naka-install ang bawat isa, at tinatanggihan ang isang nakumpirmang pagpapatakbo na humihiling ng isa na hindi kayang kalkulahin ng harness.

Kung ano ang sinusukat ng bawat metric at kung hanggang saan ito mapagkakatiwalaan para sa isang wika ay matatagpuan sa [Pagsusuri](/docs/network/specifications/scoring) at [Pagiging Maaasahan ng Metric](/docs/network/specifications/metric-reliability).

### Ang cache ng pagsasalin

Itinatago ng bawat run ang output ng modelo para sa bawat source sentence sa isang cache (`--cache-dir`, bilang default `eval/cache/harness` sa ilalim ng directory kung saan nagsisimula ang run), upang magamit itong muli nang libre sa muling pagpapatakbo ng parehong setup. Saklaw ng cache key ang modelo, ang prompt ayon sa pagkakasend (ang sha256 nito), ang mga setting na nagpapabago sa mga output, at ang bersyon ng harness, upang hindi kailanman mabigyan ng lumang output ang pagbabago sa alinman sa mga ito. Naglalaman ang cache ng mga kopya ng mga pangungusap ng corpus:

- ipiniprint ng run header at ng dry run kung nasaan ito at kung ilang entry ang nilalaman nito;
- naglalaman ang folder ng isang `.gitignore`, kaya binabalewala ito ng git;
- hindi ito kailanman isinusulat sa isang folder na `mt-eval contest prepare` na minarkahang mailalabas (ang `public/` nito): tinatanggihan ng `mt-eval run` ang naturang `--cache-dir` o `--output-dir` at sa halip ay tinutukoy ang `runs/` folder ng timpalak ([Magpatakbo ng sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest));
- ang isang local-only, selyado, o nangangailangan ng pahintulot na corpus ay nakakakuha ng sarili nitong `protected/<namespace>/` folder, na naka-key ayon sa mga setting ng run, ang sha256 ng corpus, at ang mga tuntunin nito, at ang bawat file doon ay may marka ng corpus sa isang `<file>.champollion.json` sidecar ([Pagpaparehistro ng mga corpus](/docs/network/sovereignty/registering-corpora));
- tanggalin ang folder upang alisin ang mga kopya, o ipasa ang `--no-cache` upang walang panatilihin.

Pinapangalanan ng `run_benchmark` ng MCP server (buong profile) ang cache sa plano nito at sa resulta nito. Para sa isang file na hawak ninyo, inilalagay nito ang cache sa tabi ng mga resulta ng pagpapatakbo (`<corpus folder>/results/cache/`), at para sa isang nakarehistrong corpus id, sa sarili nitong folder (`~/.champollion-mcp/cache/harness/`). Ang isang cache na nasa `eval/cache/harness` na sa ilalim ng working directory ng server mula sa mga naunang pagpapatakbo ay patuloy na ginagamit, upang hindi mabayaran nang dalawang beses ang mga output nito. Hindi nakadepende ang mga entry nito sa kung nasaan ang folder, kaya maaari itong ilipat.

### Bawat subcommand

Lahat ng dalawampung top-level na subcommand. Ang bawat flag ng bawat isa sa mga ito ay nasa
nabuong [`mt-eval` command reference](/docs/reference/mt-eval); sinasabi sa seksiyong
ito kung para saan ang bawat isa.

**Patakbuhin at i-score**

| Subcommand | Ang ginagawa nito |
|---|---|
| `mt-eval run` | Magsagawa ng pagpapatakbo ng pagsasalin (mga flag sa itaas) |
| `mt-eval test <log>` | Suriin ang isang natapos nang run log. Isinusulat ng `-o <path>` ang ulat sa ibang lugar maliban sa `<log>_report.json`, at itinatala ng run log ang path na iyon upang mahanap ito ng `card` at `compare`. Nag-iiskor ang `--glossary <file>` ng terminolohiya batay sa glossary na iyon; itinatala ng ulat ang pangalan at sha256 nito, at isinasaad ng card, `compare`, at preview ng pag-publish kung aling pagsunod sa terminolohiya ng glossary (isang diagnostic) ang na-score |
| `mt-eval compare <reports…>` | Paghambingin ang dalawa o higit pang run (`*_report.json`, o mga run log). Isang row bawat metric (chrF++, BLEU, spBLEU, TER, …), isang column bawat run na may titik A, B, C…, minarkahan ang mga metric na mas mababa mas maganda; idinaragdag ng `--significance` ang mga paired test para sa bawat pares, ang bawat talahanayan ay pinapangalanan ayon sa mga titik ng run, kasama ang 95% CI sa Δ, at isinasaad na ang mga p-value ay bawat metric at hindi naiwasto; pinapalitan ng `--method paired_bootstrap` ang default na approximate randomization para sa Koehn bootstrap ([Kahalagahan](/docs/network/specifications/significance)). Isinusulat ang `comparison-<hash>.json` (ang hash ng mga id ng pinaghambing na run, upang hindi ito ma-overwrite ng isa pang paghahambing) sa tabi ng mga ulat kapag magkasama sila sa iisang folder, kung hindi ay sa `comparisons/` sa pinakamalapit nilang karaniwang folder (hindi kailanman sa sariling folder ng isang run), maliban kung tumukoy ng file ang `-o`. Ang chrF++ test lamang ang nagpapasya kung aling run ang mas mahusay; ipinapakita ang iba pang mga row, hindi ginagamit upang magpasya. Isinasaad na retirado na ang composite ng isang lumang ulat at hindi ito pinaghahambing |
| `mt-eval dashboard <logs…>` | Bumuo ng isang interactive na HTML dashboard |
| `mt-eval card <run log>` | I-pretty-print ang isang run card na nababasa ng tao. Nagmumula ang mga score sa ulat ng run: sa tabi ng log, kung saan itinala ito ng `mt-eval test -o`, o `--report <path>`. Ang isang run na walang natagpuang ulat ay nagpapakita ng NOT SCORED at kung saan ito naghanap, hindi kailanman mga zero. Maaari ding magpasa ng file ng ulat; binabasa ito kasama ang run log na itinatala nito |

**Gamitin ang isang pamamaraan** (walang minamarkahan)

| Subcommand | Ano ang ginagawa nito |
|---|---|
| `mt-eval translate` | Magsalin ng source-only na input gamit ang isang pamamaraan — ang pipeline ng pagpapatakbo na walang mamarkahan. Nagsusulat ng `.jsonl` o `.tsv` kasama ang mga termino ng input bilang isang set/1 sidecar; ang isang pamamaraan na ang output ay local-only ay nagsusulat lamang sa loob ng proyekto maliban kung pinangalanan ng `--holders-agreed-by` kung sino sa mga may-hawak ng data ang sumang-ayon |
| `mt-eval serve` | Magsilbi ng isang pamamaraan na tumatakbo sa makinang ito (`lexicon`, `local-model`, o isang plugin ng dependency class S o O) sa likod ng kontrata ng champollion `/translate`, mula sa isang deployment/1 file o mga flag, na may opsyonal na gate-chain/1 file na nagsasala sa bawat sagot. Nagba-bind sa 127.0.0.1 bilang default; kailangan ng ibang host ang `$MT_EVAL_SERVE_TOKEN` |

**Hanapin ang inyong daan patungo sa isang paraan**

| Subcommand | Ang ginagawa nito |
|---|---|
| `mt-eval recommend <src> <tgt>` | Gabay sa pamamaraan para sa isang pares ng wika — availability at **siniping ebidensya**, hindi isang simpleng ranggo. Maaari ding ibigay ang pares bilang `--source <src> --target <tgt>`, ang anyo na tinatanggap ng `corpora` |
| `mt-eval corpora --source X --target Y` | Ilista ang mga eval corpora na available para sa isang pares. Alinmang flag ay gumagana nang mag-isa: inililista ng `--target Y` ang bawat corpus patungong Y, ng `--source X` ang bawat corpus mula sa X |
| `mt-eval corpora --with-fst` | Ang mga corpus lamang na ang target language ay may FST na itinakda ng harness, upang ma-score ang pagtanggap ng FST. Nakalista ang bawat target kasama kung naka-install ang FST nito sa makinang ito at kung paano ito i-install (`mt-eval setup --lang <code>`, o manual na pag-install para sa ilang format). Pagsamahin ito sa `--source`/`--target`, o gamitin ito nang mag-isa para sa bawat pares. Walang dina-download |
| `mt-eval list models\|prompts\|datasets` | Ilista ang mga available na resource |

**Mag-ambag**

| Subcommand | Ano ang ginagawa nito |
|---|---|
| `mt-eval publish <report>` | Magsumite ng TestReport sa leaderboard |
| `mt-eval queue` | Patakbuhin ang unahan ng community compute queue gamit ang sarili ninyong key — tingnan ang [Pag-ambag ng Compute](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | I-package ang isang TestReport bilang isang plugin ng pamamaraan ng champollion (isang method/1 `method.json`) |
| `mt-eval generate-plugin` | Alias para sa `export` |
| `mt-eval export-config` | Bumuo ng snippet ng `champollion.config.json` mula sa isang TestReport |

**Mga timpalak, at pagpapatakbo ng isa sa inyong sarili**

| Subcommand | Ano ang ginagawa nito |
|---|---|
| `mt-eval contest` | Magpatakbo o lumahok sa isang **sovereign contest** — ang `prepare`, `register`, `create`, `rank`, `close`, `export` ng organizer; ang `qualify` ng kalahok (magmarka sa sarili ng pampublikong dev set para sa resibo ng pagpasok; ang qualifier ay chrF++ sa 0–100), `validate` (mag-rehearse offline ng mga pagsusuri ng node), `submit-model` / `submit-method` (ipasa ang isang modelo o isang pamamaraan), `status`, `list`. Nilalahukan ang isang paligsahan sa pamamagitan ng pagbibigay sa node ng organizer ng isang bagay na maaari nitong PATAKBUHIN; ang pag-upload ng mga salin at pag-link ng isang card na iniulat sa sarili ay inalis bilang mga paraan ng pagpasok noong 2026-09-06 |
| `mt-eval shared-task` | Payong para sa multi-pair shared-task edition: pinapangkat ng isang hilera ang N bawat pares na paligsahan ng isang multi-pair shared-task edition at dala nito ang mga default na patakaran nito. **Pagpapangkat at mga default lamang — nananatiling bawat paligsahan ang bawat gate** |
| `mt-eval node` | **Ang scoring node ng organizer.** Mag-poll ng intake, mag-gate sa pampublikong qualifier, mag-authorize ayon sa patakaran ng paligsahan, magmarka laban sa **mga lihim na reference na hawak ng organizer**, mag-publish ng mga marka lamang. Ito ang command sa likod ng [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) at ng [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node) — hindi kailanman umaalis ang corpus sa makina ng organizer |

May labing-walong subcommand ang `mt-eval node` sa sarili nito, kabilang ang airgap lane
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) at ang
M-of-N custody ceremony (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Patakbuhin ang `mt-eval node --help`; inilalarawan ang mga mekanismo
ng sovereignty sa dalawang pahinang naka-link sa itaas.

**Setup**

| Subcommand | Ang ginagawa nito |
|---|---|
| `mt-eval setup` | Mag-install ng mga opsyonal na dependency (COMET neural metric, FST runtime) |
| `mt-eval logout` | Alisin ang mga nakaimbak na kredensyal sa pagpapatunay |

### Mga Halimbawa

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline
```

Hindi kailanman muling sumusubok o sumasala ang harness sa isang salin na tinanggihan ng FST: ang FST
acceptance ay isang metric, na minamarkahan kapag ang eval pack ng wika ay mayroong FST. Ang isang
pamamaraan na nagnanais ng mga muling pagsubok na ginagabayan ng FST ay nagsasagawa ng mga ito sa loob ng sarili nitong plugin, tulad ng ipinapakita
sa tutorial ng `fst-gated-pipeline`. (Ang `--fst-retries` at `--hooks` ay hindi kailanman
ikinabit sa anupaman sa command line; parehong tinatanggihan ang mga ito nang may gayong dahilan.)

---

## Run Card Schema

Bawat eksperimento ay gumagawa ng **run card** — isang self-contained na JSON document. Ang top-level structure:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

Tingnan ang [Run Card Specification](/docs/network/specifications/run-card) para sa buong schema na may dokumentasyon para sa bawat field.

:::info[Otoritatibong Schema]
Ang [Benchmark Specification](/docs/network/specifications/benchmark) ang nag-iisang pinagmumulan ng katotohanan para sa schema ng run card. Para sa mga depinisyon ng metric at kung paano iniiskoran ang mga run, tingnan ang [Scoring Specification](/docs/network/specifications/scoring). Idinodokumento ng pahinang ito kung paano gamitin ang harness; binibigyang-kahulugan ng mga spec kung ano ang ibig sabihin ng mga output.
:::

### Mahahalagang Block

**`dataset`** — Tinutukoy kung aling dataset ang ginamit, kabilang ang content hash nito upang maiugnay ang mga resulta sa isang partikular na version:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Aggregate metrics para sa run:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Token usage at cost tracking:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Writing-style at register metrics (pang-impormasyon) {#writing-style-and-register-metrics-informational}

Maaaring suriin ng harness kung tumutugma ang mga translation sa target na **register** at **writing style**, sa pamamagitan ng `WritingStyleConsistency` metric plugin (`mt_eval_harness/plugins/writing_style.py`). Maaaring tama sa wika ang isang translation ngunit mali ang register — impormal na phrasing sa legal document, pormal na boilerplate sa marketing copy — at hindi ito mapapansin ng string metrics. Napapansin ito ng mga metric na ito.

**Ano ang sinusukat (bawat entry):**

| Metric | Scale | Kahulugan |
|--------|-------|---------|
| `style_register_match` | boolean | Tumutugma ba ang output sa inaasahang register? Nagmumula ang target sa `register` field ng corpus entry (tingnan ang [Benchmark Spec §2.6](/docs/network/specifications/benchmark)) o mula sa isang style profile |
| `style_sentence_length_ratio` | float | Predicted vs reference average sentence length (1.0 = tugma; divergence = style drift) |
| `style_formality_score` | 0.0–1.0 | Presensya ng formal/informal markers (T–V pronouns, contractions, …) gamit ang per-language marker resources |

**Aggregate:** `style_consistency_rate` — ang fraction ng entries na walang detected register mismatch.

I-enable ang custom target gamit ang `--style-profile path/to/profile.json` (hal. isang brand-voice profile); kung wala nito, babalik ang plugin sa `register` metadata ng bawat corpus entry kung naroon.

:::caution[Tapat na saklaw]
Ang mga metric na ito ay mga **diagnostic** — hindi kailanman bahagi ng headline score ang mga ito, at ang pagtukoy sa pormalidad ay nakabatay sa marker (isang heuristic), hindi isang natutunang paghatol. Ituring ang mga ito bilang isang drift detector para sa pagsunod sa register, hindi isang hatol sa kalidad ng estilo.
:::

---

## Fingerprint vs Run Card Hash {#fingerprint-vs-run-card-hash}

Gumagawa ang harness ng dalawang magkaibang hash. Magkaiba ang layunin ng mga ito:

### Fingerprint

Sinasagot ng **fingerprint** ang tanong na: *"Maaari bang ma-reproduce ang run na ito?"*

Iniha-hash nito ang kombinasyon ng inputs na tumutukoy sa experiment configuration — hindi ang outputs:

- SHA-256 ng dataset
- Slug ng modelo
- Label ng kondisyon
- SHA-256 ng system prompt
- Temperatura
- Laki ng batch
- Mga pinaganang tool
- Bersyon ng harness

Walong bahagi sa kabuuan: kapansin-pansing binabago ng laki ng batch at tool-calling ang output, kaya bahagi ang mga ito ng pagkakakilanlan ng eksperimento — ang dalawang run sa magkaibang laki ng batch ay **hindi** nagbabahagi ng fingerprint. Tingnan ang
[Benchmark Spec §3.8](/docs/network/specifications/benchmark#38-fingerprint).

Dalawang run na may identical fingerprints ang gumamit ng parehong setup. Dapat maihambing ang kanilang mga resulta (modulo API non-determinism).

### Run Card Hash

Sinasagot ng **run card hash** ang tanong na: *"Napakialaman ba ang partikular na result file na ito?"*

Ito ang SHA-256 ng buong run card JSON (hindi kasama ang mismong `run_card_hash` field). Kung magbabago ang anumang field — score, timestamp, o kahit isang output — masisira ang hash.

:::info[Kailan gagamitin ang alin]
Gamitin ang **fingerprint** upang ipangkat ang magkakahambing na run (parehong experiment, magkakaibang execution). Gamitin ang **run card hash** upang beripikahin ang integridad ng isang partikular na result file.
:::

---

## Pag-publish sa Leaderboard

Pagkatapos kumpletuhin ang isang run, gamitin ang `mt-eval publish` sa `<run-id>_report.json` ng run. Ang pagsulat sa live na leaderboard ay nangangailangan ng tahasang `--prod` (o `MT_EVAL_ALLOW_PROD=1`); ginagawa ng `mt-eval run --publish --prod` ang parehong hakbang nang sabay:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
```

Kung walang `--method-card` na ibinigay habang tumatakbo ang run, maglulunsad ang `mt-eval publish` ng interactive wizard (`method_card_wizard.py`) na gagabay sa inyo sa paglalarawan ng inyong method (pangalan, class, mga tool na ginamit, atbp.). Ang output ng wizard ay ie-embed sa run card bago isumite.

### Manwal na inspeksiyon

Ang mga run card ay sine-save bilang mga JSON file sa output directory (`eval/logs/harness/` bilang default) — siyasatin ang mga ito doon bago i-publish. Ang `mt-eval publish` ang submission path; walang PR-based na pagtanggap ng run card.

:::note[Hindi pa live ang submission API at web upload]
Nakaplano ang isang `POST https://champollion.dev/api/leaderboard/submit` endpoint at Leaderboard upload UI ngunit **hindi pa naipapatupad**. Hangga’t hindi pa nailalabas ang mga ito, ang tanging gumaganang submission path ay `mt-eval publish`.
:::

:::warning[Pag-validate ng Leaderboard]
Vina-validate ng leaderboard ang mga isinumiteng run card laban sa dataset registry. Tinatanggihan ang mga submission na tumutukoy sa hindi kilalang datasets, o may sirang `run_card_hash`.
:::

:::danger[HUWAG MAG-TRAIN sa evaluation data]
Kung nakita na ng inyong method ang evaluation dataset habang nasa development — bilang training data, few-shot examples, dictionary entries, o prompt engineering material — ang inyong submission ay **madidisqualify**. Tingnan ang [MT Evaluation](/docs/network/leaderboard/rules) para malaman kung ano ang bumubuo sa mabuti kumpara sa masamang method.
:::

---

## Tingnan Din

- [MT Evaluation](/docs/network/leaderboard/rules) — pangkalahatang-ideya, proposisyon ng halaga ng leaderboard, at gabay sa mabuti/masamang pamamaraan
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — format ng dataset, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — ang buong JSON schema
- [Building a Method](/docs/network/specifications/methods) — ang interface ng paraan para sa paglikha ng mga masusuring pamamaraan
- [Method Leaderboard](https://champollion.dev/leaderboard) — mga live benchmark score
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluation protocol, format ng corpus, schema ng run card
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT para sa mga metric at kung paano iniiskoran ang mga run
