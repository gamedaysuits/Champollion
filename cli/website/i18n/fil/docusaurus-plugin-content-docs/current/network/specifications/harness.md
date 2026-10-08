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
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Buod para sa Ehekutibo.** Saklaw ng pahinang ito ang installation, configuration, at paggamit ng MT evaluation harness — ang tool na nagbe-benchmark ng mga paraan ng pagsasalin laban sa standardized corpora at gumagawa ng mga run card na may score. Para sa canonical na mga depinisyon ng metrics, schemas, at evaluation protocol, tingnan ang [Benchmark Specification](/docs/network/specifications/benchmark).

Nagpapatakbo ang harness ng mga eksperimento sa pagsasalin at gumagawa ng mga run card. Pinangangasiwaan nito ang prompt construction, API calls, scoring, at result serialization — kayo ang magbibigay ng dataset at model.

## Installation

**Mga requirement:** Python 3.10+

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
|------|---------------|---------|--------------|
| `--corpus` | ✅ | — | Path patungo sa corpus file (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Mga parallel text file (format na FLORES+, WMT) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Eksaktong model slug: ang buong OpenRouter id, o ang sariling eksaktong pangalan ng direktang provider. Walang mga alias at walang mga floating id (`~vendor/…`, `…-latest`): tinatanggihan ang maikling pangalan tulad ng `gemini-pro`, at tinutukoy ng pagtanggi ang slug na dapat isulat. Pinaghihiwalay ng kuwit para sa mga pagpapatakbo na may maraming modelo. Kasama ang `--method local-model`, ito ang modelong patatakbuhin — isang Hugging Face id o isang directory ng modelo — at ito ay kinakailangan: walang default na modelo ang engine na iyon. Kapag may method plugin, ipinapasa ito sa plugin bilang `config.method_model`. Ang iba pang MT engine ay nagsasalin gamit ang sarili nitong modelo at isinasaad ng run na ang `-m` ay hindi ginagamit |
| `-d, --dataset` | — | `all` | Filter ng dataset: `all`, pangalan ng segment, o saklaw ng ID |
| `--ids` | — | — | Mga entry ID na pinaghihiwalay ng kuwit na susuriin |
| `--source-lang` | — | `English` | Pangalan ng source language |
| `--target-lang` | — | — | Pangalan ng target language, ayon sa sinasabi ng prompt. Ang code na ibinigay rito (`sme`) ay pinapangalanan mula sa language card nito ("Northern Sami"), at isinasaad ito ng run header; ang code na walang card na nagpapangalan (isang private-use na `qaa`) ay mananatiling code, na may babala na dadalhin ito ng prompt |
| `-p, --prompt` | — | `naive` | Bersyon ng prompt (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Path patungo sa text file ng coaching prompt. **Pinapalitan** nito ang built-in prompt: matatanggap ng modelo ang file ayon sa pagkakasulat (kasama ang linyang `--target-script`), hindi ang built-in na tagubiling "Translate the given … text to …; output only the translation". Isinasaad ito ng dry run at ng run header sa isang hatol: ✓ kapag pinangalanan ng file ang target language (at sa pamamagitan ng aling pangalan o code), ⚠ kapag hindi nito pinangalanan ang wika o ang code nito, o hindi sinuri kapag walang alam na pangalan o code |
| `--glossary` | — | — | Evaluation glossary (JSON) para sa pagsunod sa terminolohiya; para sa pag-score lamang, hindi kailanman ipinapadala sa modelo |
| `--coaching` | — | — | Inline na coaching text (naka-quote na string) |
| `--method` | — | — | Path patungo sa directory ng method plugin (naglalaman ng `method.json` + Python module), o isang rehistradong MT engine (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Kasama ang `--method local-model`: magpatakbo ng OPUS-MT pair model na ang id ay nagpapangalan ng ibang pares maliban sa corpus (`opus-mt-en-fi` sa isang `eng>sme` na corpus, bilang baseline ng kaugnay na wika). Tinatanggihan kung wala ito; itinatala ito ng run card |
| `--method-card` | — | — | Path patungo sa method card JSON para sa metadata ng leaderboard |
| `--fst-retries` | — | `0` | Bilang ng mga pagsubok muli sa FST (default na LLM method lamang) |
| `--skip-fst` | — | `false` | Mag-score nang walang FST acceptance, kahit na may FST ang wika, at huwag nang magbanggit pa tungkol dito. Minamarkahan ito ng run card bilang hindi kinalkula. Kung wala ang flag na ito, ang nawawalang FST (ang analyzer o ang pyhfst runtime nito) ay hindi rin magpapahinto sa run: magpapatuloy ito, mamarkahan ng run card ang FST acceptance at morpolohiya bilang hindi kinalkula, at tutukuyin ng abiso ang `mt-eval setup --lang <code>`. Pagkatapos ng pag-install na iyon, idaragdag ng `mt-eval test <run log>` ang score ng FST sa natapos na run nang hindi na muling nagsasalin. Walang kusang nagda-download nang mag-isa |
| `--skip-eval-standard` | — | `false` | Mag-score nang wala ang eval-standard metrics ng language card (isang external package). Minamarkahan ang mga ito ng run card bilang hindi kinalkula. Kung wala ang flag na ito, kinakalkula ang mga metric ng isang naka-install na package; ang package na hindi naka-install ay isang opsyonal na add-on — magpapatuloy ang run nang wala ang mga metric nito (minarkahang hindi kinalkula) at tutukuyin ang `python3 -m pip install` na idineklara ng card. Walang ini-install ang isang run |
| `--tools` | — | `false` | Paganahin ang tool-calling mode |
| `--tools-list` | — | — | Mga pangalan ng tool na pinaghihiwalay ng kuwit |
| `--max-tool-rounds` | — | `8` | Pinakamataas na rounds ng tool-calling bawat entry |
| `--hooks` | — | — | Mga pangalan ng post-translation hook |
| `--style-profile` | — | — | Path patungo sa isang style profile JSON. Pinapagana ang mga metric ng pagiging pare-pareho ng estilo ng pagsulat (mga diagnostic — hindi kailanman bahagi ng headline score; tingnan ang [§ Writing-style and register metrics](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Mga entry bawat tawag sa API |
| `-c, --concurrency` | — | `8` | Mga sabay-sabay na tawag sa API |
| `--max-tokens` | — | `32768` | Pinakamataas na token bawat tawag sa API |
| `--temperature` | — | `0.0` | Temperatura ng sampling (0.0 = deterministic) |
| `--no-cache` | — | `false` | Huwag paganahin ang pag-cache ng tugon |
| `--cache-dir` | — | `eval/cache/harness` | Path ng cache directory (tingnan ang [The translation cache](#the-translation-cache)) |
| `--metricx` | — | `false` | Kalkulahin din ang MetricX-24 (Google, Apache-2.0), isang lower-is-better neural error score (0–25), na iniuulat sa tabi ng chrF++ headline at hindi kailanman inihahalo rito. Kinakailangan ang `metricx` extra at ang model code ng Google (tingnan ang [Opt-in neural metrics](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Kasama ang `--metricx`: isa pang MetricX checkpoint (isang xl/xxl, o isang `google/metricx-25-*`) |
| `--fuse` | — | `false` | Kalkulahin din ang FUSE-style comparator, isang hindi sinanay na muling pagpapatupad ng diskarte ng AmericasNLP 2025 FUSE, na iniuulat bilang isang diagnostic comparator, hindi kailanman sa headline. Kinakailangan ang `fuse` extra (tingnan ang [Opt-in neural metrics](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Output directory para sa mga run card at log |
| `-n, --name` | — | — | Nababasa ng taong pangalan ng run |
| `--dry-run` | — | `false` | I-validate ang configuration at corpus nang hindi gumagawa ng mga tawag sa API. Tinutukoy nito ang coaching file at glossary na gagamitin ng run (o `none`), ipinapakita ang prompt (ang built-in nang buo; ang coaching file ayon sa unang linya at sha256 nito, at na pinapalitan nito ang built-in), isinasaad kung nasaan ang translation cache, at pinapatakbo ang kaparehong eval-pack check na ginagawa ng totoong run, na nag-uulat nito sa mga linyang nagsisimula sa `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …`, o `none needed for <language>`) nang hindi nagkakaroon ng error. Isinasaad ng pangalawang linya kung hihinto ang totoong run: ang nawawalang FST ay hindi kailanman magpapahinto rito, habang ang anumang iba pang nawawalang bahagi ay magpapahinto rito. Sa ilalim ng `--json`, dinadala ng buod ang `coaching_file`, `prompt` (ang uri nito, sha256, at haba; ang teksto ng built-in prompt), `glossary_file` at `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | Code ng wika sa BCP-47 |
| `--target-script` | — | — | Ang ISO 15924 script kung saan dapat isulat ang mga salin (`Latn`, `Cans`, …), isa na nakalista sa language card ng target. Hinihingi ito ng prompt ng harness (idinagdag din sa teksto ng coaching file), kaya bahagi ito ng sha256 ng prompt. Para sa wikang isinusulat sa mahigit isang script, tulad ng Plains Cree, gamitin ang script kung saan nakasulat ang inyong mga reference. Kung wala ito, binibilang ng harness ang mga titik ng mga reference ayon sa script (isang aggregate: walang pangungusap na ipinapakita, kaya nalalapat din ito sa isang local-only na corpus) at hinihingi ang script na naglalaman ng 90% o higit pa sa mga ito, na isinasaad sa run header ("references are 100% Latn → prompting for Latn") at itinatala ito sa run log (`config.target_script_source`); ang mga reference na halo-halo ay walang nakukuhang script at may babala kasama ang mga bahagi, at ang isang reference sa kabilang script ay makakakuha ng score na halos zero. Tinatanggihan para sa isang MT engine o isang method plugin, na walang natatanggap na prompt |

`--champollion-config` at `--prompt champollion` ay inalis na sa 0.2.0 at tinatanggihan kalakip ang dahilan. Gayundin ang `--champollion-cards-dir`; itakda ang `MT_EVAL_CARDS_DIR` upang ituro ang harness sa ibang directory ng mga card. Muli nilang binuo ang prompt ng CLI sa Python, at ang kopyang iyon ay nagbago na mula sa CLI. Gumamit ng method plugin (`--method`) upang suriin ang isang paraan ng CLI, at `mt-eval export-config` upang magdala ng resulta pabalik sa isang proyekto ng CLI.

### Mga neural metric na opt-in

Kinakalkula ang COMET tuwing naka-install ang `unbabel-comet` (`mt-eval setup --comet`: humigit-kumulang 300 MB para i-install, at humigit-kumulang 2.3 GB ng modelo sa unang paggamit). Naka-off ang dalawa pang metric maliban kung hihilingin ng isang run, dahil naglo-load ang bawat isa ng malaking modelo. Tulad ng COMET, tumatakbo ang mga ito sa makinang ito (walang bayad sa API, walang tekstong ipinapadala saanman), iniuulat ang mga ito sa tabi ng headline ng chrF++ at hindi kailanman inihahalo rito, at sinasabi ng run card ang "not run" kalakip ang flag na dapat ipasa kapag hindi hiniling ang mga ito.

| Metric | Flag | Ang kailangan nito | Ang konsumo nito |
|--------|------|--------------------|-------------------|
| MetricX-24 (`metricx_score`, mas mababa mas maganda, 0–25) | `--metricx` (checkpoint: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) at model code ng Google, na wala sa PyPI: `python3 -m pip install git+https://github.com/google-research/metricx` | Nagda-download ang default na `google/metricx-24-hybrid-large-v2p6` checkpoint at ang mT5-XL tokenizer ng ilang GB mula sa Hugging Face sa unang paggamit; mabagal ang pag-score sa isang CPU. Kung walang reference, nag-iiskor ito sa reference-free (QE) mode nito |
| FUSE-style comparator (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | Nagda-download ang LaBSE ng humigit-kumulang 1.8 GB sa unang paggamit. Kung walang LaBSE, hindi kinakalkula ang score, at isinasaad ito ng ulat. Hindi ito sinanay (isang unweighted mean ng mga bahagi nito), at ang resulta ay minarkahang `fuse_untrained` |

Sa MCP, tumatanggap ang `run_benchmark` ng `metricx` (kasama ang `metricx_model`) at `fuse`, at kinakailangan ng `comet: true` ang COMET; isinasaad ng plano nito kung naka-install ang bawat isa, at tinatanggihan ang isang nakumpirmang run na humihingi ng isa na hindi kayang kalkulahin ng harness.

Kung ano ang sinusukat ng bawat metric at kung hanggang saan ito mapagkakatiwalaan para sa isang wika ay matatagpuan sa [Pagsusuri](/docs/network/specifications/scoring) at [Pagiging Maaasahan ng Metric](/docs/network/specifications/metric-reliability).

### Ang cache ng pagsasalin

Itinatago ng bawat run ang output ng modelo para sa bawat source sentence sa isang cache (`--cache-dir`, bilang default `eval/cache/harness` sa ilalim ng directory kung saan nagsisimula ang run), upang magamit itong muli nang libre sa muling pagpapatakbo ng parehong setup. Saklaw ng cache key ang modelo, ang prompt ayon sa pagkakasend (ang sha256 nito), ang mga setting na nagpapabago sa mga output, at ang bersyon ng harness, upang hindi kailanman mabigyan ng lumang output ang pagbabago sa alinman sa mga ito. Naglalaman ang cache ng mga kopya ng mga pangungusap ng corpus:

- ipiniprint ng run header at ng dry run kung nasaan ito at kung ilang entry ang nilalaman nito;
- naglalaman ang folder ng isang `.gitignore`, kaya binabalewala ito ng git;
- hindi ito kailanman isinusulat sa isang folder na `mt-eval contest prepare` na minarkahang mailalabas (ang `public/` nito): tinatanggihan ng `mt-eval run` ang naturang `--cache-dir` o `--output-dir` at sa halip ay tinutukoy ang `runs/` folder ng timpalak ([Magpatakbo ng sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest));
- ang isang local-only, selyado, o nangangailangan ng pahintulot na corpus ay nakakakuha ng sarili nitong `protected/<namespace>/` folder, na naka-key ayon sa mga setting ng run, ang sha256 ng corpus, at ang mga tuntunin nito, at ang bawat file doon ay may marka ng corpus sa isang `<file>.champollion.json` sidecar ([Pagpaparehistro ng mga corpus](/docs/network/sovereignty/registering-corpora));
- tanggalin ang folder upang alisin ang mga kopya, o ipasa ang `--no-cache` upang walang panatilihin.

Tinutukoy ng `run_benchmark` ng MCP server ang cache sa plano at sa resulta nito. Para sa file na hawak ninyo, inilalagay nito ang cache sa tabi ng mga resulta ng run (`<corpus folder>/results/cache/`), at para sa isang rehistradong id ng corpus sa sarili nitong folder (`~/.champollion-mcp/cache/harness/`). Ang isang cache na nasa `eval/cache/harness` na sa ilalim ng working directory ng server mula sa mga naunang run ay patuloy na ginagamit, upang hindi mabayaran nang dalawang beses ang mga output nito. Hindi nakadepende ang mga entry nito sa kinaroroonan ng folder, kaya maaari itong ilipat.

### Bawat subcommand

Lahat ng labing-walong top-level subcommand, na nabuo batay sa `mt_eval_harness/cli.py`
noong 2026-08-01. Bago iyon, naglista ang seksyong ito ng pito sa mga ito, at anim —
kabilang ang `node`, ang sovereign organizer scoring node — ay
**hindi idinokumento rito o sa gabay ng harness**.

**Patakbuhin at i-score**

| Subcommand | Ang ginagawa nito |
|---|---|
| `mt-eval run` | Magsagawa ng pagpapatakbo ng pagsasalin (mga flag sa itaas) |
| `mt-eval test <log>` | Suriin ang isang natapos nang run log. Isinusulat ng `-o <path>` ang ulat sa ibang lugar maliban sa `<log>_report.json`, at itinatala ng run log ang path na iyon upang mahanap ito ng `card` at `compare`. Nag-iiskor ang `--glossary <file>` ng terminolohiya batay sa glossary na iyon; itinatala ng ulat ang pangalan at sha256 nito, at isinasaad ng card, `compare`, at preview ng pag-publish kung aling pagsunod sa terminolohiya ng glossary (isang diagnostic) ang na-score |
| `mt-eval compare <reports…>` | Paghambingin ang dalawa o higit pang run (`*_report.json`, o mga run log). Isang row bawat metric (chrF++, BLEU, spBLEU, TER, …), isang column bawat run na may titik A, B, C…, minarkahan ang mga metric na mas mababa mas maganda; idinaragdag ng `--significance` ang mga paired test para sa bawat pares, ang bawat talahanayan ay pinapangalanan ayon sa mga titik ng run, kasama ang 95% CI sa Δ, at isinasaad na ang mga p-value ay bawat metric at hindi naiwasto; pinapalitan ng `--method paired_bootstrap` ang default na approximate randomization para sa Koehn bootstrap ([Kahalagahan](/docs/network/specifications/significance)). Isinusulat ang `comparison-<hash>.json` (ang hash ng mga id ng pinaghambing na run, upang hindi ito ma-overwrite ng isa pang paghahambing) sa tabi ng mga ulat kapag magkasama sila sa iisang folder, kung hindi ay sa `comparisons/` sa pinakamalapit nilang karaniwang folder (hindi kailanman sa sariling folder ng isang run), maliban kung tumukoy ng file ang `-o`. Ang chrF++ test lamang ang nagpapasya kung aling run ang mas mahusay; ipinapakita ang iba pang mga row, hindi ginagamit upang magpasya. Isinasaad na retirado na ang composite ng isang lumang ulat at hindi ito pinaghahambing |
| `mt-eval dashboard <logs…>` | Bumuo ng isang interactive na HTML dashboard |
| `mt-eval card <run log>` | I-pretty-print ang isang run card na nababasa ng tao. Nagmumula ang mga score sa ulat ng run: sa tabi ng log, kung saan itinala ito ng `mt-eval test -o`, o `--report <path>`. Ang isang run na walang natagpuang ulat ay nagpapakita ng NOT SCORED at kung saan ito naghanap, hindi kailanman mga zero. Maaari ding magpasa ng file ng ulat; binabasa ito kasama ang run log na itinatala nito |

**Hanapin ang inyong daan patungo sa isang paraan**

| Subcommand | Ang ginagawa nito |
|---|---|
| `mt-eval recommend <src> <tgt>` | Gabay sa pamamaraan para sa isang pares ng wika — availability at **siniping ebidensya**, hindi isang simpleng ranggo. Maaari ding ibigay ang pares bilang `--source <src> --target <tgt>`, ang anyo na tinatanggap ng `corpora` |
| `mt-eval corpora --source X --target Y` | Ilista ang mga eval corpora na available para sa isang pares. Alinmang flag ay gumagana nang mag-isa: inililista ng `--target Y` ang bawat corpus patungong Y, ng `--source X` ang bawat corpus mula sa X |
| `mt-eval corpora --with-fst` | Ang mga corpus lamang na ang target language ay may FST na itinakda ng harness, upang ma-score ang pagtanggap ng FST. Nakalista ang bawat target kasama kung naka-install ang FST nito sa makinang ito at kung paano ito i-install (`mt-eval setup --lang <code>`, o manual na pag-install para sa ilang format). Pagsamahin ito sa `--source`/`--target`, o gamitin ito nang mag-isa para sa bawat pares. Walang dina-download |
| `mt-eval list models\|prompts\|datasets` | Ilista ang mga available na resource |

**Mag-ambag**

| Subcommand | Ang ginagawa nito |
|---|---|
| `mt-eval publish <report>` | Magsumite ng TestReport sa leaderboard |
| `mt-eval queue` | Patakbuhin ang tuktok ng community compute queue gamit ang sarili ninyong key — tingnan ang [Pag-ambag ng Compute](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | I-package ang isang TestReport bilang isang champollion method plugin |
| `mt-eval generate-plugin` | Alias para sa `export` |
| `mt-eval export-config` | Bumuo ng isang `champollion.config.json` snippet mula sa isang TestReport |

**Mga timpalak, at pagpapatakbo ng isa sa inyong sarili**

| Subcommand | Ang ginagawa nito |
|---|---|
| `mt-eval contest` | Magpatakbo o sumali sa isang **sovereign contest** — ang `prepare`, `register`, `create`, `rank`, `close`, `export` ng tagapag-ayos; ang `qualify` ng kalahok (i-self-score ang pampublikong dev set para sa resibo ng pagpasok; ang qualifier ay chrF++ sa 0–100), `validate` (ensayuhin ang mga pagsusuri ng node nang offline), `submit-model` / `submit-method` (ipasa ang isang modelo o paraan), `status`, `list`. Sinasalihan ang isang timpalak sa pamamagitan ng pagbibigay sa node ng tagapag-ayos ng isang bagay na maaari nitong PATAKBUHIN; ang pag-upload ng mga salin at pag-link ng self-reported na card ay inalis na bilang mga landas ng pagpasok noong 2026-09-06 |
| `mt-eval shared-task` | Umbrella para sa multi-pair shared-task edition: pinapangkat ng isang row ang N per-pair contests ng isang AmericasNLP-style na edisyon at dinadala ang mga default ng patakaran nito. **Pagpapangkat at mga default lamang — ang bawat gate ay nananatiling bawat timpalak** |
| `mt-eval node` | **Ang scoring node ng tagapag-ayos.** Mag-poll ng intake, mag-gate sa pampublikong qualifier, mag-authorize ayon sa patakaran ng timpalak, mag-score laban sa **mga lihim na reference na hawak ng tagapag-ayos**, mag-publish ng mga score lamang. Ito ang command sa likod ng [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) at ang [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node) — hindi kailanman umaalis ang corpus sa makina ng tagapag-ayos |

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

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

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
