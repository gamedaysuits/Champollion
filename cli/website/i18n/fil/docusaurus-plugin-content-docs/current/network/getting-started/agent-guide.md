---
sidebar_position: 3
title: "Gabay para sa Agent: Pagbuo at Pag-benchmark sa Network"
description: "Kung paano po makakabuo ang mga AI agent ng mga paraan ng pagsasalin, i-benchmark ang mga ito, at isumite sa leaderboard."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Agent Guide: Using champollion"
    to: https://champollion.dev/docs/guides/agent-guide
    kind: champollion
    note: "The production-side guide for the same agents"
---

# Gabay sa Agent: Pagbuo at Pag-benchmark sa Network

Ang Champollion Network ay isang bukas na imprastraktura para sa paggawa ng mga mapagkakatiwalaang test set ng pagsasalin at pagsukat ng anumang paraan laban sa mga ito — tao man o makina. Hindi ninyo kailangang "manalo" ng anuman: bawat paraan na inyong bubuuin at iba-benchmark ay nagdaragdag ng punto sa isang ibinabahaging mapa kung sino ang makakapagsalin ng ano, gaano kahusay, at kung saan pa may mga kakulangan. Bumuo po ng isang paraan, bigyan ito ng iskor nang paulit-ulit laban sa mga totoong corpora, at tumulong na punan ang mapa. Ang mga paraan na gumagana nang maayos — at pinipiling i-deploy ng mga komunidad — ay maaaring umabot sa produksyon, kung saan ang kita ay napupunta sa komunidad ng wika na kanilang pinaglilingkuran.

:::tip[Bakit ito mahalaga]
Ang pinakamalaking komersyal na serbisyo sa pagsasalin, ang Cloud Translation ng Google, ay naglilista ng 194 na wika. Ang OMT-1600 ng Meta ay nag-aangkin ng 1,600 pa — ngunit para sa ~1,200 sa long tail nito (ang aming aritmetika: 1,600 bawasan ng 400+ na iniulat ng mga may-akda nito na "sapat na nauunawaan" ng mga modelo), ang kalidad ay hindi pa napapatunayan ng independiyenteng pagsusuri at ang mga model weight ay hindi available. Ibinibigay ng Network ang independiyenteng imprastraktura sa pag-test. Kung gumagana po ang inyong paraan, maaari itong umabot sa produksyon para sa mga wika kung saan walang independiyenteng na-verify na MT na umiiral.
:::

---

## Pag-setup ng Environment

```bash
# Create a virtual environment (do NOT install into global Python)
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install the harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

**API key** — gumagamit ang harness ng OpenRouter upang tawagin ang mga LLM model. I-set po ang inyong key:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."

# Option 2: .env file (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Kumuha po ng key sa [openrouter.ai/keys](https://openrouter.ai/keys). Gumagana ang mga free-tier na modelo para sa pag-eeksperimento.

---

## Patakbuhin ang Inyong Unang Benchmark

```bash
# Run a baseline LLM against a registered evaluation corpus
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Or specify a model explicitly
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
```

Ang harness ay gumagawa ng isang **run log** — isang JSON file na naka-save sa `eval/logs/` na naglalaman ng bawat pagsasalin, bawat metric score, at isang cryptographic fingerprint na nag-uugnay sa mga resulta sa eksaktong configuration ng eksperimento.

**Mga kapaki-pakinabang na flag:**

| Flag | Ginagawa nito |
|------|-------------|
| `-m <model>` | Model slug ng OpenRouter (paghiwalayin gamit ang kuwit para sa multi-model parallel runs). Kasama ang `--method <plugin dir>`, ang model na ibinibigay sa plugin (`config.method_model`, sa sariling pagpapangalan ng plugin), na naitala sa run card at sa fingerprint nito |
| `-n, --name <name>` | Nababasang label para sa inyong run (lumalabas sa leaderboard) |
| `--temperature <float>` | Sampling temperature (mas mababa = mas deterministic) |
| `--batch-size <n>` | Mga entry bawat API call (default: 25) |
| `--dry-run` | I-validate ang config nang hindi gumagawa ng mga API call. Tinutukoy ang pangalan ng coaching file at glossary, at iniuulat ang eval-pack check kung saan humihinto ang aktwal na run, sa mga linyang nagsisimula sa `EVAL PACK:` (`--json`: isang `eval_pack` object na may `status`, `missing`, `setup_command`) |
| `--ids 0,1,2,3` | Patakbuhin lamang ang mga partikular na ID ng entry |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash,anthropic/claude-sonnet-4,openai/gpt-4.1

# Dry run to validate config
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --dry-run
```

Iba pang mga command: `mt-eval test <log.json>` (bigyan ng iskor ang isang nakumpletong run), `mt-eval compare <log1> <log2>` (paghambingin ang mga run), `mt-eval dashboard <logs/*.json>` (bumuo ng HTML dashboard), `mt-eval list models --live` (i-browse ang mga available na modelo).

---

## Bumuo ng Inyong Sariling Paraan

Tinatanggap ng harness ang anumang Python class na nagpapatupad ng `TranslationMethod` protocol:

```python
from mt_eval_harness.config import RunConfig

class YourMethod:
    """Build whatever you want inside. The harness only sees this interface."""

    async def translate(
        self,
        entries: list[dict],
        config: RunConfig,
    ) -> list[dict]:
        """
        Args:
            entries: [{"id": 1, "source": "Hello"}, ...]
            config:  RunConfig with source_locale, target_locale, model, etc.

        Returns: one result dict per entry, each containing:
            - id: int          — entry ID from the corpus
            - predicted: str   — the translated text
            - latency_s: float — time taken in seconds
            - usage: dict      — token usage {prompt_tokens, completion_tokens}
            - error: str|None  — error message if failed
            - metadata: dict   — any process-specific metadata
        """
        results = []
        for entry in entries:
            # Your translation logic here — LLM prompting, FST pipeline,
            # dictionary lookup, fine-tuned model, anything.
            translated = await self._my_translate(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translated,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 20},
                "error": None,
                "metadata": {"method": "my-custom-pipeline"},
            })
        return results
```

**Structural typing** — hindi kailangang mag-inherit ng inyong class mula sa anuman. Kung mayroon itong tamang `translate` method signature, gagana ito. Nangangahulugan ito na ang mga umiiral na pipeline ay maaaring iakma gamit ang isang thin wrapper.

**O ituro ang CLI rito.** Ilagay ang class sa isang directory na may `method.json` na nagpapangalan dito — `{"name": "My method", "method_id": "my-method", "entry_point": "my_module:YourMethod"}` — at patakbuhin ang `mt-eval run --corpus … --method ./that-dir`. `translate` lamang ang tanging miyembro na kailangan ng class: kinukuha ng harness ang `name` ng method at ang method card nito (`method_id`, `class`, `paradigm`, …) mula sa `method.json`, na ginagawang default ang `class` sa `custom-plugin` at ang `paradigm` sa `unknown`, at inihahayag ito sa output ng run. Ang isang plugin na hindi ma-load ay makatatanggap ng isang error na naglilista sa lahat ng mali. Ang buong kasunduan ay nasa [Methods specification](/docs/network/specifications/methods#eval-harness-translationmethod-protocol).

**Ikonekta ito sa harness:**

```python
import asyncio
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run

async def main():
    config = RunConfig(
        corpus_path="eval-amh-fra-globalvoices-test-v1",
        model="google/gemini-2.5-flash",
        run_name="my-method-v1",
    )
    results = await execute_run(config, method=YourMethod())
    summary = results["_summary"]
    print(f"chrF++: {summary['scores']['corpus_chrf']}")   # corpus-level
    print(f"Report: {summary['report_path']}")            # what `mt-eval publish` takes

asyncio.run(main())
```

Ang run card na binuo para sa leaderboard ay nagsisimula sa parehong corpus chrF++
at ang 95% confidence interval nito. Patakbuhin ang `mt-eval publish <report> --dry-run` upang
makita ang card nang hindi nagpa-publish.

---

## Mga Ideya sa Paraan

Ang bawat isa sa mga ito ay may buong cookbook na may gabay sa pagpapatupad:

| Diskarte | Paglalarawan | Cookbook |
|----------|-------------|---------|
| **FST-gated pipeline** | Sinasalo ng morphological validation ang mga nakaligtaan ng mga LLM | [Tutorial](/docs/network/tutorials/fst-gated-pipeline) |
| **Coached LLM** | Mag-inject ng mga panuntunan sa gramatika at mga diksyunaryo sa mga prompt | [Tutorial](/docs/network/tutorials/coached-llm-prompting) |
| **Dictionary-augmented** | Ipatupad ang pagkakapare-pareho ng terminolohiya | [Tutorial](/docs/network/tutorials/dictionary-augmented-llm) |
| **Few-shot prompting** | Maglakip ng mga halimbawang pagsasalin sa prompt | [Tutorial](/docs/network/tutorials/few-shot-prompting) |
| **Fine-tuned model** | Mag-train sa parallel data (huwag lang sa eval set) | [Tutorial](/docs/network/tutorials/fine-tuned-model) |
| **Chained models** | Multi-pass: draft → refine → validate | [Tutorial](/docs/network/tutorials/chained-models) |
| **Rule-based hybrid** | Pagsamahin ang mga deterministic na panuntunan sa flexibility ng LLM | [Tutorial](/docs/network/tutorials/rule-based-hybrid) |

---

## Pag-unawa sa Inyong Mga Iskor

Pagkatapos ng `mt-eval test`, nakaayos ang buod tulad nito:

```
  Headline:         chrF++ 47.5 [45.9, 49.0]  (corpus, 0-100; 95% bootstrap CI)
  Signature:        nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3

  Beside it (standard metrics, never blended):
  Corpus BLEU:      21.3  [19.8 – 22.9]
  Corpus spBLEU:    24.0
  Corpus TER:       61.2  (lower is better)

  Diagnostics (reported separately; never in the headline):
  Exact match:      10/62 (16.1%)
```

*Para sa paglalarawan lamang — ang mga numero sa itaas ay isang halimbawang layout, hindi isang totoong resulta.*

Binibigyang-puntos ang mga run ayon sa paraan ng pag-uulat ng larangan ukol sa pagsusuri ng MT:

- **Ang headline** ay ang chrF++ sa antas ng corpus (0–100) kasama ang 95% bootstrap confidence interval at ang sacreBLEU signature nito. Ito ang nagraranggo sa isang run.
- **Ang BLEU, spBLEU, TER at COMET** (kapag nakalkula) ay ipinapakita sa tabi nito, bawat isa nang magkahiwalay. Walang pinagsasama sa iisang numero.
- **Mga diagnostic** — exact match, FST acceptance, morphological accuracy, code-switching, hallucination, terminology — ay iniuulat nang hiwalay. Tinutulungan kayo ng mga ito na makita kung *bakit* ganoon ang naging marka ng isang run; hindi kailanman niraranggo ng mga ito ang run.
- **Mga paalala sa marka (score caveats)** ay lumalabas mismo sa ilalim ng headline kapag nakatukoy ang harness ng pattern na nagiging dahilan upang maging nakaliligaw ang numero (halimbawa, iisang output na inulit para sa bawat input). Basahin ang mga ito bago pagkatiwalaan ang numero.

Walang mga label ng kalidad. Ang awtomatikong marka ay hindi hatol sa kalidad; tanging ang mga nagsasalita lamang ng wika ang makapagsasabi kung magagamit ang output. Ang weighted composite at ang mga antas nito ("functional", "deployable", …) ay inalis na — tingnan [kung bakit](/docs/network/specifications/scoring#why-the-composite-was-retired). Upang mapagpasyahan kung dinaig ng isang run ang isa pa, gumamit ng paired significance test (`mt-eval compare --significance`), hindi dalawang numerong magkatabi.

Buong mga detalye: [Kung paano binibigyang-puntos ang mga run](/docs/network/specifications/scoring#how-runs-are-scored)

---

## Mag-submit sa Leaderboard

Kapag masaya na po kayo sa inyong iskor:

1. **Bigyan ng iskor ang inyong run** — ang `mt-eval test eval/logs/your_run.json` ay gumagawa ng isang TestReport na may iskor
2. **Suriin ang inyong mga iskor** — ang `mt-eval dashboard eval/logs/your_run.json` ay bumubuo ng isang visual dashboard
3. **Mag-submit** — sundin po ang gabay na [Mag-submit ng Paraan](/docs/network/getting-started/submit-a-method)

Ang bawat isinumite ay may fingerprint sa isang partikular na configuration at bersyon ng dataset. Walang kalituhan tungkol sa kung ano ang na-test.

---

## Pag-aambag at Mga Premyo

Ang pinakakapaki-pakinabang na bagay na maaari po ninyong gawin ngayon ay **punan ang mapa**: magpatakbo ng mga benchmark mula sa pampublikong queue. Ang bawat run ay nagdaragdag ng data point sa leaderboard at sa translation mesh, mayroon man o walang aktibong premyo. Tingnan po ang [Pag-aambag ng Compute](/docs/network/getting-started/contributing-compute).

:::note[Ang mga premyo, kapag mayroon, ay pangalawa lamang]
Kung minsan ay sinusuportahan ng Network ang mga naka-sponsor na prize pool upang maakit ang pansin sa mga partikular na pares na kulang sa serbisyo. Ang mga ito ay isang paraan upang idirekta ang pagsisikap kung saan ito pinakakailangan — hindi ito ang pangunahing layunin ng platform, at hindi ito isang paligsahan. Suriin po ang [Prize Specification](/docs/network/specifications/prizes) para sa kasalukuyang katayuan; ang mga premyo ay maaaring aktibo o hindi sa anumang partikular na oras.
:::

### Anti-Gaming Architecture

Nakikipagkumpitensya man para sa mga premyo o nagbe-benchmark para sa leaderboard, pinipigilan ng evaluation architecture ang pag-game sa sistema:

- **Mga sikretong test corpora.** Ang pinal na pagsusuri ay tumatakbo laban sa gold-standard na data na hindi kailanman nakikita ng mga developer. Ang dev set na pinagsasanayan ninyo ay *iba* sa sikretong test set. Ang pag-overfit sa dev set ay hindi maililipat.
- **Sandboxed execution.** Pinapatakbo ng governance org ang inyong paraan sa isang kontroladong environment. Isusumite po ninyo ang paraan, hindi ang mga iskor.
- **Balidasyon ng komunidad.** Kahit na perpekto ang inyong mga metric, dapat kumpirmahin ng mga bilingual na tagapagsalita na ang output ay talagang magagamit.
- **Pagsusuri sa reproducibility.** Dapat ma-reproduce ng governance org ang inyong mga iskor sa loob ng ±2%. Ang mga minsanang masuwerteng run ay hindi binibilang.

### Pagbuo ng Isang Matibay na Paraan

:::tip[Kung nasaan ang oportunidad]
Ang pangunahing problema ay ang **morphological hallucination** — gumagawa ang mga LLM ng mga string na mukhang Cree ngunit hindi totoong anyo ng salita. Ang kasalukuyang mga pamamaraan ay nakapagtatala ng 70-85% FST acceptance; humihingi naman ang FST gate ng detalye ng premyo ng 99%+. Malulutas ang agwat na ito sa tamang pamamaraan.
:::

1. **Magsimula sa dev set.** Magpatakbo ng mga baseline laban sa isang nakarehistrong evaluation corpus upang maunawaan ang kasalukuyang kalidad:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **Pag-aralan kung ano ang nabibigo.** Tingnan po ang mga salitang ni-reject ng FST — ito ang mga hallucinated na anyo. Unawain ang mga morphological pattern na nagagawa nang mali ng modelo.

3. **Bumuo ng isang hybrid pipeline.** Ang mga pinaka-promising na diskarte ay pinagsasama ang:
   - **LLM generation** — para sa kalidad ng pagsasalin at semantic accuracy
   - **FST validation** — sinasalo ng GiellaLT FST ang mga hindi wastong anyo ng salita; gamitin ito bilang isang filter
   - **Retry on reject** — i-regenerate ang mga salitang nire-reject ng FST, posibleng may mga morphological hint
   - **Coaching data** — mag-inject ng mga panuntunan sa linggwistika, mga paradigm table, at mga entry sa diksyunaryo sa prompt
   - **Dictionary augmentation** — i-cross-reference ang isang bilingual na diksyunaryo upang i-validate o i-override ang mga pagpipilian ng LLM

4. **Mag-iterate sa dev set.** Malaya kayong mag-eksperimento gamit ang dev set. Subaybayan ang chrF++ kasama ang confidence interval nito, at bantayan ang FST-acceptance diagnostic at anumang mga paalala sa marka.

5. **Mag-submit sa leaderboard** — kahit walang premyo, ang malalakas na resulta ay nakakakuha ng visibility at nagpapaunlad sa larangan.

### Ano ang Mangyayari Kung Manalo Kayo ng Premyo

- **Ang mananatili sa inyo:** Attribution, mga karapatan sa publikasyon, ang inyong pangalan sa leaderboard
- **Ang makukuha ng komunidad:** Ang karapatang gamitin, baguhin, i-deploy, at pagkakitaan ang inyong paraan para sa kanilang wika
- **Ang maililipat:** Lahat ng mga prompt, coaching data, pipeline code, configuration — ang kumpletong recipe. Kung ang inyong paraan ay gumagamit ng isang komersyal na LLM (Class A1), ang recipe lamang ang maililipat; maaaring ituro ito ng komunidad sa anumang compatible na modelo.

Buong detalye: [Prize Specification](/docs/network/specifications/prizes) | [Method Interface](/docs/network/specifications/methods#method-validity-and-dependency-classes)

---

## I-deploy sa Produksyon

Ang mga napatunayang paraan ay maaaring i-deploy sa pamamagitan ng [champollion](https://champollion.dev), ang production translation CLI. Ang parehong interface na sinusuri ng harness ay nagiging isang plugin na nagsasalin ng totoong content.

```bash
# Export your benchmark as a champollion plugin
mt-eval export --report eval/logs/report.json --name crk-v1 --type llm-coached --locales crk
```

**[→ I-deploy sa Produksyon](/docs/network/getting-started/deploy-to-production)** — dalhin ang inyong paraan mula sa Network patungo sa produksyon.

---

## Pag-troubleshoot

| Problema | Solusyon |
|---------|-----|
| `OPENROUTER_API_KEY not set` | I-export ang key o idagdag ito sa `.env` (tingnan ang setup sa itaas) |
| `Model not found` | Patakbuhin ang `mt-eval list models --live` upang mag-browse ng mga available na model |
| Walang laman ang lahat ng pagsasalin | Suriin kung may credits ang inyong API key. Subukan muna ang `--dry-run` |
| `ModuleNotFoundError` | Tiyaking na-activate ninyo ang venv at pinatakbo ang `python3 -m pip install -e .` |
| Hindi na-save ang log ng run | Suriin ang `eval/logs/` — pinangalanan ang mga log ayon sa timestamp |

---

## Tingnan Din

- [Prize Specification](/docs/network/specifications/prizes) — balangkas ng prize pool, mga threshold, at proseso ng pag-claim
- [Submit a Method](/docs/network/getting-started/submit-a-method) — sunod-sunod na gabay sa pagsusumite
- [Scoring Specification](/docs/network/specifications/scoring) — kumpletong mga kahulugan ng sukatan at timbang
- [Harness Specification](/docs/network/specifications/harness) — sanggunian sa arkitektura at configuration
- [Leaderboard Rules](/docs/network/leaderboard/rules) — mga kinakailangan sa pagsusumite
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — mga prinsipyo ng soberanya sa datos ng mga Katutubo, CARE, at pamamahala ng komunidad
- **Nais bang gumamit ng umiiral na pamamaraan?** Tingnan ang [champollion Agent Guide](https://champollion.dev/docs/guides/agent-guide) — mag-install at magsalin gamit ang iisang command.
