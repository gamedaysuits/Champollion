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
pip install mt-eval-harness
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

| Flag | Ano ang ginagawa nito |
|------|-------------|
| `-m <model>` | OpenRouter model slug (paghiwalayin ng kuwit para sa multi-model parallel runs) |
| `-n, --name <name>` | Nababasa ng tao na label para sa inyong run (lumalabas sa leaderboard) |
| `--temperature <float>` | Sampling temperature (mas mababa = mas deterministic) |
| `--batch-size <n>` | Mga entry bawat API call (default: 25) |
| `--dry-run` | I-validate ang config nang hindi gumagawa ng mga API call |
| `--ids 0,1,2,3` | Patakbuhin lamang ang mga partikular na entry ID |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash,claude-sonnet-4,gpt-4.1

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
    print(f"Composite: {results['scores']['composite']}")

asyncio.run(main())
```

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

Pagkatapos ng isang benchmark run, makikita po ninyo ang output na tulad nito:

```
══════════════════════════════════════════════════
  Composite Score: 0.67 (Functional)
──────────────────────────────────────────────────
  chrF++:              0.72
  FST acceptance:      0.82
  Exact match:         0.31
  Morphological acc.:  0.88
  Semantic score:      0.64
══════════════════════════════════════════════════
```

*Para sa paglalarawan lamang — ang mga numero sa itaas ay isang halimbawang layout, hindi isang totoong resulta.*

Pinagsasama ng composite ang ilang mga metric — character-level accuracy (chrF++), morphological validity (FST acceptance), exact match, morphological accuracy, at semantic preservation — na ang bawat isa ay may tinukoy na timbang. **Ang mga timbang at ang eksaktong composite formula ay matatagpuan sa iisang lugar: ang [Scoring Specification](/docs/network/specifications/scoring), ang nag-iisang pinagmumulan ng katotohanan.** Basahin po ang mga ito mula sa spec sa halip na kopyahin ang mga numero mula sa isang pahina ng gabay — maaari silang magbago, at ang spec ay canonical.

**Mga antas ng kalidad** (tinukoy din sa [Scoring Specification](/docs/network/specifications/scoring)):

| Antas | Composite Range | Ano ang ibig sabihin nito |
|------|----------------|---------------|
| Baseline | 0.00–0.30 | Mas mababa sa [random chance para sa wika](/docs/network/specifications/connection-strength) — bawat ortograpiya ay may nonzero chance floor, at nag-iiba ito ayon sa wika |
| Emerging | 0.30–0.50 | Nagpapakita ng potensyal ngunit hindi pa magagamit |
| Functional | 0.50–0.70 | Magagamit na may post-editing |
| **Deployable** | **0.70–0.85** | **Handa na para sa produksyon na may pagsusuri ng tagapagsalita** |
| Fluent | 0.85–1.00 | Kalidad na malapit sa katutubo (near-native) |

Buong detalye: [Scoring Specification](/docs/network/specifications/scoring)

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

:::tip[Kung saan naroon ang pagkakataon]
Ang pangunahing problema ay ang **morphological hallucination** — ang mga LLM ay gumagawa ng mga string na mukhang Cree ngunit hindi mga totoong anyo ng salita. Ang mga kasalukuyang paraan ay nakakakuha ng 70-85% FST acceptance. Ang mga threshold ng kalidad ay nangangailangan ng 99%+. Ang puwang na ito ay malulutas gamit ang tamang diskarte.
:::

1. **Magsimula sa dev set.** Magpatakbo ng mga baseline laban sa isang rehistradong evaluation corpus upang maunawaan ang kasalukuyang kalidad:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **Pag-aralan kung ano ang nabibigo.** Tingnan po ang mga salitang ni-reject ng FST — ito ang mga hallucinated na anyo. Unawain ang mga morphological pattern na nagagawa nang mali ng modelo.

3. **Bumuo ng isang hybrid pipeline.** Ang mga pinaka-promising na diskarte ay pinagsasama ang:
   - **LLM generation** — para sa kalidad ng pagsasalin at semantic accuracy
   - **FST validation** — sinasalo ng GiellaLT FST ang mga hindi wastong anyo ng salita; gamitin ito bilang isang filter
   - **Retry on reject** — i-regenerate ang mga salitang nire-reject ng FST, posibleng may mga morphological hint
   - **Coaching data** — mag-inject ng mga panuntunan sa linggwistika, mga paradigm table, at mga entry sa diksyunaryo sa prompt
   - **Dictionary augmentation** — i-cross-reference ang isang bilingual na diksyunaryo upang i-validate o i-override ang mga pagpipilian ng LLM

4. **Mag-iterate sa dev set.** Ang dev set ay malaya po ninyong magagamit para mag-eksperimento. I-track ang inyong mga composite, FST acceptance, at chrF++ na iskor.

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
| `Model not found` | Patakbuhin ang `mt-eval list models --live` upang i-browse ang mga available na modelo |
| Walang laman ang lahat ng pagsasalin | Suriin kung may credits ang inyong API key. Subukan muna ang `--dry-run` |
| `ModuleNotFoundError` | Tiyaking na-activate po ninyo ang venv at pinatakbo ang `pip install -e .` |
| Hindi na-save ang run log | Suriin ang `eval/logs/` — ang mga log ay pinapangalanan ayon sa timestamp |

---

## Tingnan Din

- [Prize Specification](/docs/network/specifications/prizes) — framework ng prize pool, mga threshold, at proseso ng pag-claim
- [Mag-submit ng Paraan](/docs/network/getting-started/submit-a-method) — sunud-sunod na gabay sa pagsusumite
- [Scoring Specification](/docs/network/specifications/scoring) — buong mga kahulugan at timbang ng metric
- [Harness Specification](/docs/network/specifications/harness) — sanggunian sa arkitektura at configuration
- [Leaderboard Rules](/docs/network/leaderboard/rules) — mga kinakailangan sa pagsusumite
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — Mga prinsipyo ng Indigenous data sovereignty, CARE, at pamamahala ng komunidad
- **Gusto po bang gumamit ng umiiral na paraan?** Tingnan ang [Gabay sa Agent ng champollion](https://champollion.dev/docs/guides/agent-guide) — mag-install at magsalin gamit ang isang command.
