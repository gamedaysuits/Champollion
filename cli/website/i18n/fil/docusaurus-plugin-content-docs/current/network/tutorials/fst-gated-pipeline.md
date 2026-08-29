---
sidebar_position: 6
title: "Cookbook: FST-Gated Translation Pipeline"
description: "Bumuo ng decomposition pipeline na may morphological validation at i-benchmark ito sa Network leaderboard."
related:
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: Dictionary-Augmented LLM"
    to: /docs/network/tutorials/dictionary-augmented-llm
    kind: cookbook
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "Wrap the pipeline for submission"
  - label: "FST"
    to: https://champollion.dev/glossary#term-fst
    kind: glossary
    note: "Finite-state transducer, in plain language"
---

# Cookbook: Pipeline ng Pagsasaling FST-Gated

Bumuo ng multi-stage na pipeline sa pagsasalin na naghahati-hati ng source text, nagsasalin gamit ang LLM, nagva-validate ng mga output gamit ang finite-state transducer (FST), at sumusubok muli kapag tinanggihan ng FST ang mga hindi wastong anyo ng salita. Pagkatapos, ikabit ito sa eval harness at tingnan kung paano ito makakakuha ng score.

**Ang bubuuin ninyo:** Isang pipeline sa pagsasalin para sa Plains Cree na nakakahuli ng mga saling hindi wasto sa morpolohiya *bago* ito mabilang laban sa inyong score.

:::info[Mga Kinakailangan]
- Isang tumatakbong FST binary (hal., ang [GiellaLT/ALTLab Plains Cree analyzer](https://github.com/giellalt/lang-crk) — ipinapamahagi sa pamamagitan ng nightly channel ng GiellaLT, hindi sa mga GitHub release)
- Node.js 20+ (para sa pipeline) at Python 3.10+ (para sa harness)
- Isang OpenRouter API key para sa LLM step
:::

---

## Arkitektura

Ang pipeline ay isang kadena ng mga stage. Bawat stage ay may partikular na gawain. Maaari po ninyo itong buuin sa anumang wika — JavaScript ang gamit ng halimbawang ito, ngunit walang pakialam ang harness kung ano ang nasa loob. Nakikita lamang nito ang manipis na Python adapter sa boundary.

```mermaid
graph TD
    subgraph pipeline ["Your Pipeline (any language)"]
        A["1. Decompose"]
        B["2. Dictionary Lookup"]
        C["3. LLM Translate"]
        D["4. FST Validate"]
        E{"Valid?"}
        F["5. Retry with feedback"]
        G["Return translation"]
    end

    subgraph harness ["Eval Harness (Python)"]
        H["TranslationMethod adapter"]
        I["Score + Run Card"]
    end

    H -->|"entries"| A
    A --> B
    B --> C
    C --> D
    D --> E
    E -->|"✅ Accepted"| G
    E -->|"❌ Rejected"| F
    F --> C
    G -->|"results"| H
    H --> I

    style pipeline fill:#1a1a2e,stroke:#e94560,color:#fff
    style harness fill:#1a1a2e,stroke:#0f3460,color:#fff
```

### Bakit Ang Mga Stage na Ito

| Stage | Ano ang Ginagawa Nito | Bakit Ito Mahalaga |
|-------|-------------|---------------|
| **Decompose** | Hinahati ang mga compound UI string sa mga segment na maisasalin | Nag-eencode ang mga polysynthetic na wika ng buong pangungusap sa iisang salita — kailangan ng LLM ng mas maliliit na unit |
| **Dictionary Lookup** | Tinitingnan ang bilingual dictionary para sa mga kilalang salin | Ipinipilit ang wastong terminolohiya para sa mga kilalang termino sa halip na umasa sa hula ng LLM |
| **LLM Translate** | Ipinapadala ang segment sa isang LLM na may konteksto ng register at grammar | Humahawak ng mga bagong parirala at lumilikha ng matatas na output |
| **FST Validate** | Pinapatakbo ang output sa isang morphological analyzer | Nakakahuli ng mga hindi wastong anyo ng salita — kung tinanggihan ng FST ang isang salita, hindi ito wastong anyo ng salita sa wika |
| **Retry** | Muling ipinapadala ang mga tinanggihang salita kasama ang error feedback ng FST | Nagbibigay sa LLM ng tiyak na impormasyon tungkol sa *bakit* mali ang salita |

---

## Ang Daloy ng Data

Narito ang nangyayari sa isang entry habang dumadaan ito sa pipeline:

```mermaid
sequenceDiagram
    participant H as Harness
    participant P as Pipeline
    participant D as Dictionary
    participant L as LLM (OpenRouter)
    participant F as FST Analyzer

    H->>P: { source: "Welcome to our app" }
    P->>D: Lookup "welcome", "app"
    D-->>P: "welcome" → "tânisi" (known)
    P->>L: Translate "Welcome to our app"<br/>Dictionary: welcome=tânisi<br/>Register: Formal SRO
    L-->>P: "tânisi, pê-kîwêw ôta"
    P->>F: Analyze "tânisi"
    F-->>P: ✅ tânisi+V+AI+Ind+2Sg
    P->>F: Analyze "pê-kîwêw"
    F-->>P: ✅ PV/pê+kîwêw+V+AI+Ind+3Sg
    P->>F: Analyze "ôta"
    F-->>P: ✅ ôta+Ipc
    P-->>H: { predicted: "tânisi, pê-kîwêw ôta" }
```

### Kapag Tinanggihan ng FST

```mermaid
sequenceDiagram
    participant L as LLM
    participant F as FST Analyzer
    participant P as Pipeline

    L-->>P: "tânisi, pekiwew ôta"
    P->>F: Analyze "pekiwew"
    F-->>P: ❌ REJECTED (no analysis)
    Note over P: Missing long vowel diacritic:<br/>"pekiwew" should be "pê-kîwêw"
    P->>L: Retry: "pekiwew" was rejected by FST.<br/>Likely issue: missing SRO diacritics.<br/>Correct SRO uses ê, î, ô, â for long vowels.
    L-->>P: "pê-kîwêw"
    P->>F: Analyze "pê-kîwêw"
    F-->>P: ✅ PV/pê+kîwêw+V+AI+Ind+3Sg
```

---

## Implementasyon

Buuin po ninyo ang anumang kailangan ninyo. Gumagamit ang halimbawang ito ng JavaScript, ngunit maaari ninyong gamitin ang Python, Rust, o anupaman. Walang pakialam ang harness — nakikipag-usap lamang ito sa manipis na Python adapter (ipinapakita sa susunod na seksyon).

### Ang Pipeline

Ang bawat stage ay isang function. Pinagdurugtong ng pipeline ang mga ito.

```javascript title="pipeline.js"
import { lookupDictionary } from './dictionary.js';
import { callLLM } from './llm.js';
import { analyzeWithFST } from './fst.js';

const MAX_RETRIES = 3;

/**
 * Translate a batch of keys through the full pipeline.
 *
 * @param {object} keys - Map of key → source string
 * @param {object} options - { sourceLang, targetLang }
 * @returns {{ translations: object, stats: object }}
 */
export async function translateBatch(keys, options) {
  const translations = {};
  const stats = { total: 0, fstAccepted: 0, retries: 0, dictionaryHits: 0 };

  for (const [key, sourceText] of Object.entries(keys)) {
    stats.total++;
    translations[key] = await translateSingle(sourceText, options, stats);
  }

  return { translations, stats };
}

/**
 * Translate a single string through all pipeline stages.
 */
async function translateSingle(sourceText, options, stats) {

  // ── Stage 1: Decompose ──────────────────────────────────
  // Split compound strings into segments the LLM can handle.
  // For UI strings this is often a no-op, but for longer content
  // it prevents the LLM from losing context in long prompts.
  const segments = decompose(sourceText);

  // ── Stage 2: Dictionary Lookup ──────────────────────────
  // Check each segment against the bilingual dictionary.
  // Known terms are forced — the LLM won't override them.
  const knownTerms = {};
  for (const segment of segments) {
    const entry = lookupDictionary(segment.toLowerCase());
    if (entry) {
      knownTerms[segment] = entry;
      stats.dictionaryHits++;
    }
  }

  // ── Stage 3: LLM Translate ──────────────────────────────
  let translation = await callLLM(sourceText, {
    ...options,
    knownTerms,
    register: 'nêhiyawêwin (Plains Cree). Use SRO orthography. '
            + 'Professional register for educational contexts.',
  });

  // ── Stage 4: FST Validate ──────────────────────────────
  // Split the translation into words and check each one.
  let { accepted, rejected } = await validateWords(translation);

  // ── Stage 5: Retry Loop ─────────────────────────────────
  // If any words were rejected, retry with FST feedback.
  let attempt = 0;
  while (rejected.length > 0 && attempt < MAX_RETRIES) {
    attempt++;
    stats.retries++;

    const feedback = rejected
      .map(w => `"${w}" was rejected by the morphological analyzer`)
      .join('; ');

    translation = await callLLM(sourceText, {
      ...options,
      knownTerms,
      register: 'nêhiyawêwin (Plains Cree). Use SRO orthography.',
      feedback: `Previous attempt had invalid words. ${feedback}. `
              + 'Use correct SRO diacritics (ê, î, ô, â for long vowels). '
              + 'Ensure verb forms match expected conjugation patterns.',
    });

    ({ accepted, rejected } = await validateWords(translation));
  }

  if (rejected.length === 0) stats.fstAccepted++;

  return translation;
}

/**
 * Decompose source text into translatable segments.
 *
 * For simple key-value UI strings, this usually returns the
 * original string as a single segment. For longer content,
 * it splits on sentence boundaries.
 */
function decompose(text) {
  // Simple sentence-boundary split. Replace with your own
  // morphological decomposition for more complex needs.
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);
}

/**
 * Validate each word in a translation against the FST.
 *
 * @returns {{ accepted: string[], rejected: string[] }}
 */
async function validateWords(translation) {
  // Split on whitespace and punctuation, keeping only words
  const words = translation
    .split(/[\s,;:.!?'"()\[\]{}]+/)
    .filter(w => w.length > 0);

  const accepted = [];
  const rejected = [];

  for (const word of words) {
    const analyses = await analyzeWithFST(word);
    if (analyses.length > 0) {
      accepted.push(word);
    } else {
      rejected.push(word);
    }
  }

  return { accepted, rejected };
}
```

### Ang FST Wrapper

I-wrap ang inyong FST binary bilang isang async function. Gumagamit ang halimbawang ito ng HFST-based Plains Cree analyzer ng ALTLab.

```javascript title="fst.js"
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Path to your FST analyzer binary
const FST_PATH = process.env.FST_ANALYZER_PATH || './bin/crk-analyzer';

/**
 * Run a word through the FST morphological analyzer.
 *
 * Returns an array of analyses. Empty array = rejected.
 *
 * Example:
 *   analyzeWithFST("tânisi")
 *   → ["tânisi+V+AI+Ind+2Sg", "tânisi+V+AI+Cnj+2Sg"]
 *
 *   analyzeWithFST("pekiwew")
 *   → []  // rejected — missing diacritics
 *
 * @param {string} word - A single word in SRO orthography
 * @returns {string[]} Array of FST analyses (empty = rejected)
 */
export async function analyzeWithFST(word) {
  try {
    // HFST lookup: pipe the word to stdin, read analyses from stdout
    const { stdout } = await execFileAsync(
      FST_PATH,
      ['--quiet'],
      { input: word + '\n', timeout: 5000 }
    );

    // Parse HFST output: each line is "input\tanalysis\tweight"
    // Lines with "+?" indicate unrecognized forms
    return stdout
      .split('\n')
      .filter(line => line.includes('\t') && !line.includes('+?'))
      .map(line => line.split('\t')[1]);

  } catch (err) {
    // If the FST binary isn't available, log and reject
    console.error(`[WARN] FST analysis failed for "${word}": ${err.message}`);
    return [];
  }
}
```

### Mga Module ng Dictionary at LLM

```javascript title="dictionary.js"
/**
 * Simple bilingual dictionary backed by a JSON file.
 *
 * In production, you'd load from the coaching data directory
 * or query itwêwina (https://itwewina.altlab.app/) via API.
 */
const DICTIONARY = {
  'hello': 'tânisi',
  'welcome': 'tânisi',
  'thank you': 'kinanâskomitin',
  'home': 'kīwēwin',
  'search': 'nānātawāpahtam',
  'settings': 'isi-nākatohkēwin',
  'help': 'nīsōhkamākēwin',
  'back': 'kīwē',
};

/**
 * @param {string} term - Lowercase English term
 * @returns {string|null} Cree translation or null
 */
export function lookupDictionary(term) {
  return DICTIONARY[term] || null;
}
```

```javascript title="llm.js"
/**
 * Call an LLM via OpenRouter for translation.
 */
const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

export async function callLLM(sourceText, options) {
  const { knownTerms = {}, register, feedback } = options;

  // Build the system prompt with register and known terms
  let systemPrompt = `You are translating English to Plains Cree.\n\n`;
  systemPrompt += `Register: ${register}\n\n`;

  if (Object.keys(knownTerms).length > 0) {
    systemPrompt += `Required terminology (use these exact translations):\n`;
    for (const [en, crk] of Object.entries(knownTerms)) {
      systemPrompt += `  "${en}" → "${crk}"\n`;
    }
    systemPrompt += '\n';
  }

  if (feedback) {
    systemPrompt += `IMPORTANT correction from previous attempt:\n${feedback}\n\n`;
  }

  systemPrompt += `Rules:\n`;
  systemPrompt += `- Use Standard Roman Orthography (SRO)\n`;
  systemPrompt += `- Use macron/circumflex for long vowels: ê, î, ô, â\n`;
  systemPrompt += `- Return ONLY the Cree translation, nothing else\n`;

  const response = await fetch(OPENROUTER_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sourceText },
      ],
      temperature: 0.2,
    }),
  });

  const json = await response.json();
  return json.choices[0].message.content.trim();
}
```

---

## Pagkabit sa Harness

Nabuo na ang inyong pipeline. Ngayon, kailangan ninyo itong ikonekta sa eval harness upang ma-benchmark ninyo ito sa leaderboard.

Iisang interface ang sinasalita ng harness: `TranslationMethod`. Isa itong Python protocol na may iisang method. Buuin po ninyo ang anumang nais ninyo sa anumang wika — pagkatapos ay bigyan ito ng manipis na wrapper na ito at makakabit na ito.

```python title="fst_gated_process.py"
"""
TranslationMethod adapter for the FST-gated pipeline.

This thin wrapper connects your pipeline (running as a local
subprocess or HTTP server) to the eval harness. The harness
calls translate() with corpus entries. You call your pipeline.
You return results. That's it.
"""

import time
import subprocess
import json
from mt_eval_harness.config import RunConfig


class FSTGatedProcess:
    """Adapter between the eval harness and your FST-gated pipeline.

    The pipeline runs as a Node.js subprocess. This wrapper:
    1. Receives entries from the harness
    2. Sends them to the pipeline
    3. Returns structured results the harness can score
    """

    def __init__(self, pipeline_url: str = "http://localhost:3001"):
        self.pipeline_url = pipeline_url

    async def translate(
        self,
        entries: list[dict],
        config: RunConfig,
    ) -> list[dict]:
        """Translate a batch of entries through the FST-gated pipeline.

        Args:
            entries: List of corpus entries with 'id' and source text.
            config: Harness run configuration (for context).

        Returns:
            List of result dicts, one per entry.
        """
        import httpx

        results = []

        for entry in entries:
            source_text = entry.get(config.source_field, entry.get("source", ""))
            start = time.monotonic()

            try:
                # Call your pipeline — however it's running
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.pipeline_url}/translate",
                        json={"keys": {str(entry["id"]): source_text}},
                        timeout=30.0,
                    )
                    data = response.json()
                    predicted = data["translations"][str(entry["id"])]

                elapsed = time.monotonic() - start

                results.append({
                    "id": entry["id"],
                    "predicted": predicted,
                    "latency_s": elapsed,
                    "usage": {},  # pipeline doesn't expose token counts
                    "error": None,
                    "tool_calls": [],
                    "tool_call_count": 0,
                    "metadata": data.get("meta", {}),
                })

            except Exception as err:
                results.append({
                    "id": entry["id"],
                    "predicted": "",
                    "latency_s": time.monotonic() - start,
                    "usage": {},
                    "error": str(err),
                    "tool_calls": [],
                    "tool_call_count": 0,
                    "metadata": {},
                })

        return results
```

:::tip[Hindi ninyo kailangan ng HTTP]
Tinatawag ng halimbawa sa itaas ang pipeline sa pamamagitan ng HTTP dahil nasa JavaScript ang pipeline. Kung nasa Python ang inyong pipeline, maaari ninyo itong tawagin nang direkta — hindi kailangan ng server. Ang `TranslationMethod` wrapper ay hangganan lamang ng function. Nasa sa inyo kung ano ang mangyayari sa loob.
:::

### Pagpapatakbo ng Benchmark

Simulan ang inyong pipeline, pagkatapos ay patakbuhin ang harness:

```bash
# Terminal 1: Start the pipeline
node server.js

# Terminal 2: Run the harness with your process
export OPENROUTER_API_KEY="sk-or-v1-..."

python -c "
import asyncio
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run
from fst_gated_process import FSTGatedProcess

async def main():
    config = RunConfig(
        corpus_path='data/your-crk-dev-v1.json',
        source_lang='English',
        target_lang='Plains Cree (nêhiyawêwin, SRO)',
        process_name='fst-gated-v1',
    )
    process = FSTGatedProcess('http://localhost:3001')
    run_log = await execute_run(config, process=process)
    print(f'Results: {run_log.output_path}')

asyncio.run(main())
"
```

O gamitin ang CLI upang ihambing laban sa built-in baseline:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --fst-retries 3 \
  --name fst-gated-v1 \
  --publish
```

---

## Pag-unawa sa Inyong Mga Resulta

Gumagawa ang harness ng **run card** — isang JSON file na may inyong mga score. Narito ang makikita ninyo:

```
═══════════════════════════════════════════════════
  FST-Gated Pipeline v1 — EDTeKLA Dev v1
═══════════════════════════════════════════════════

  chrF++              48.7 / 100
  Exact match         12.1%
  FST acceptance      94.4%
  Composite score     0.52  →  Functional ✓

  436 entries (textbook_dev.json) · 47 retries · $0.18 total cost
═══════════════════════════════════════════════════
```

**Ano ang sinasabi nito sa inyo sa isang tingin:**
- Ang inyong method ay nasa **Functional** tier (0.50–0.70) — makikilala ng isang speaker ang output, karaniwang tama ang pangunahing grammar, ngunit nananatili ang madalas na mga error sa morpolohiya.
- Nahuhuli ng FST ang 94% ng mga salita bilang valid — gumagana ang inyong retry loop.
- 12% ng mga salin ay eksaktong tama — marami pang puwang para mapahusay.

:::info[Mga Antas ng Kalidad]
| Antas | Pinagsama-samang Marka | Ano ang Ibig Sabihin Nito |
|------|-----------|---------------|
| Batayang Antas | 0.00–0.30 | Hilaw na output ng LLM, karamihang halusinadong morphology |
| Umuusbong | 0.30–0.50 | Ilang tamang pattern, hindi maaasahan |
| **Functional** | **0.50–0.70** | **Nakikilala ng isang tagapagsalita. Karaniwang tama ang mahahalagang kategorya.** |
| Maaaring i-deploy | 0.70–0.85 | Angkop para sa draft translation na may pagsusuri ng tao |
| Matatas | 0.85–1.00 | Papalapit sa mahusay na human translation |

Tingnan ang [SCORING_SPEC §5](/docs/network/specifications/scoring#5-quality-tiers) para sa kumpletong mga depinisyon ng tier.
:::

<details>
<summary><strong>Mas Malalim: Ano ang nasa run card?</strong></summary>

Kinukuha ng run card JSON ang lahat tungkol sa evaluation run na ito. Mga pangunahing seksyon:

**Mga Score** — bawat metric na kinompyut ng harness:
```json
{
  "scores": {
    "exact_match_rate": 0.121,
    "chrf_plus_plus": 48.7,
    "fst_acceptance_rate": 0.944,
    "composite_score": 0.52,
    "quality_tier": "functional"
  }
}
```

**Provenance** — kung ano ang gumawa ng mga resultang ito:
```json
{
  "method": {
    "process_name": "fst-gated-v1",
    "model": "google/gemini-2.5-pro",
    "temperature": 0.0
  },
  "corpus": {
    "id": "edtekla-dev-v1",
    "sha256": "a1b2c3..."
  }
}
```

**Mga resulta kada entry** — bawat salin na may indibidwal na score, upang makita ninyo kung saan nahihirapan ang inyong method:
```json
{
  "id": 42,
  "source": "The student completed the assignment",
  "reference": "ôskiniw kî-kîsîhtâw ôhi atoskêwina",
  "predicted": "ôskiniw kî-kîsîhtâw ôhi atoskêwin",
  "chrf": 89.2,
  "exact_match": false,
  "fst_accepted": true
}
```

Ang composite score ay weighted average ng mga available na metric, na may mga weight na tinukoy sa [SCORING_SPEC §4](/docs/network/specifications/scoring#4-composite-score). Kapag hindi available ang isang metric, proporsyonal na nire-redistribute ang weight nito sa natitira.

</details>

---

## Pag-deploy sa Production

May mga score na ang inyong method sa leaderboard. Ngayon, nais ninyo na itong aktuwal na gamitin. Ang seksyong ito ay tungkol sa pag-serve ng inyong pipeline bilang production endpoint na maaaring tawagin ng [champollion](https://champollion.dev).

:::note[Opsyonal ang seksiyong ito]
Ang lahat ng nasa itaas ay tungkol sa pagbuo at pag-benchmark ng inyong paraan. Ang seksiyong ito ay tungkol sa deployment — isang hiwalay na usapin. Maaari kayong magsumite sa leaderboard nang walang dini-deploy na anuman.
:::

### Ang HTTP Server

I-wrap ang inyong pipeline bilang isang Express server na nag-iimplement ng [kontrata ng API method](https://champollion.dev/docs/guides/serving-a-method):

```javascript title="server.js"
import express from 'express';
import { translateBatch } from './pipeline.js';

const app = express();
app.use(express.json());

/**
 * API method contract:
 *
 * Request:  { source_locale, target_locale, method, keys: { "key": "source" } }
 * Response: { translations: { "key": "translated" }, meta: { ... } }
 */
app.post('/translate', async (req, res) => {
  const { source_locale, target_locale, method, keys } = req.body;

  // Validate request
  if (!keys || typeof keys !== 'object') {
    return res.status(400).json({ error: { message: 'Missing keys object' } });
  }

  try {
    const startTime = Date.now();
    const { translations, stats } = await translateBatch(keys, {
      sourceLang: source_locale,
      targetLang: target_locale,
    });

    res.json({
      translations,
      meta: {
        model: 'custom-pipeline/fst-gated-v1',
        method: 'decompose-lookup-translate-validate',
        elapsed_ms: Date.now() - startTime,
        fst_acceptance_rate: stats.fstAccepted / stats.total,
        retries: stats.retries,
      },
    });
  } catch (err) {
    console.error('[ERR] Pipeline failed:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// Health check for connectivity verification
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3001, () => {
  console.log('FST-gated pipeline running on http://localhost:3001');
});
```

### I-configure ang champollion

Ituro ang inyong language pair sa tumatakbong service:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://localhost:3001/translate"
    }
  },
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision."
    }
  }
}
```

```bash
# Run it
export OPENROUTER_API_KEY="sk-or-v1-..."
node server.js &
npx champollion sync
```

### Pag-package Bilang Plugin

Kapag may mga score na ang inyong method, i-package ito upang magamit ng iba:

```json title="crk-fst-gated-v1/method.json"
{
  "name": "crk-fst-gated-v1",
  "type": "api",
  "version": "1.0.0",
  "description": "FST-gated Plains Cree translation with morphological validation",
  "author": "Your Name",

  "config": {
    "endpoint": "https://your-server.example.com/translate"
  },

  "locales": ["crk"],

  "benchmarks": {
    "crk": {
      "date": "2026-06-01T00:00:00Z",
      "corpus_size": 436,
      "exact_match_rate": 0.12,
      "corpus_chrf": 48.7,
      "model": "google/gemini-2.5-pro",
      "harness_version": "2.0"
    }
  },

  "provenance": {
    "resources": [
      { "name": "GiellaLT/ALTLab CRK Analyzer", "license": "AGPL-3.0-or-later", "type": "fst" },
      { "name": "Wolvengrey Dictionary", "license": "none", "type": "dictionary" }
    ],
    "commercialReady": false,
    "flags": ["nc-resource"]
  }
}
```

---

## Pagpapalawak sa Pattern na Ito

Ipinapakita ng cookbook na ito ang isang arkitektura ng pipeline. Maaari ninyo itong iangkop para sa anumang wika o method:

| Variation | Ano ang Nagbabago |
|-----------|-------------|
| **Ibang FST** | Palitan ang binary path. Maaari kayong mag-download ng mga precompiled FST (tulad ng mga `.hfstol` o `lttoolbox` binary) para sa mahigit 100 wika mula sa [GiellaLT GitHub](https://github.com/giellalt) o [Apertium GitHub](https://github.com/apertium). |
| **Walang available na FST** | Alisin ang FST execution stage at gamitin ang [UniMorph flat paradigm files](https://huggingface.co/datasets/unimorph/universal_morphologies) mula sa Hugging Face upang magsagawa ng static database lookup validation ng mga inflected form. |
| **Maramihang LLM** | I-chain ang mga model: isang mabilis na model para sa paunang draft, isang reasoning model para sa mga correction. |
| **Human-in-the-loop** | Magdagdag ng queue stage na humahawak ng mga hindi tiyak na salin para sa expert review bago ibalik. |
| **Fine-tuned model** | Palitan ang OpenRouter call ng isang local model (Ollama, vLLM, atbp.). |
| **Ibang wika** | Baguhin ang dictionary, FST, at register. Nananatiling pareho ang arkitektura. |

Ang pipeline ay isang pattern. Napagpapalit-palit ang mga stage. Buuin ang gumagana para sa inyong wika, patunayan ito sa [leaderboard](https://champollion.dev/leaderboard), at i-deploy ito.

---

## Tingnan Din

- **[Eval Harness](/docs/network/specifications/harness)** — kung paano po patakbuhin ang harness at unawain ang output
- **[Method Interface](/docs/network/specifications/methods)** — ang espesipikasyon ng `TranslationMethod` protocol
- **[Mga Panuntunan ng Leaderboard](/docs/network/leaderboard/rules)** — mga pamantayan sa pagsusumite at mga patakaran laban sa pandaraya (anti-gaming)
- **[Suportahan ang Isang Low-Resource Language](/docs/network/community/low-resource-languages)** — ang mas malawak na konteksto at mga prinsipyo ng data sovereignty ng komunidad
- **[ALTLab](https://altlab.ualberta.ca/)** — ang Alberta Language Technology Lab (Plains Cree FST)
- **[Method Leaderboard](https://champollion.dev/leaderboard)** — isumite po ang inyong mga score
