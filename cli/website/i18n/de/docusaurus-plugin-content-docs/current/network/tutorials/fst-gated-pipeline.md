---
sidebar_position: 6
title: "Kochbuch: FST-gesteuerte Übersetzungspipeline"
description: "Erstellen Sie eine Decomposition-Pipeline mit morphologischer Validierung und vergleichen Sie diese im Network-Leaderboard."
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

# Cookbook: FST-gesteuerte Übersetzungspipeline

Erstellen Sie eine mehrstufige Übersetzungspipeline, die Quelltext zerlegt, über ein LLM übersetzt, Ausgaben mit einem endlichen Transduktor (FST) validiert und erneut versucht, wenn der FST ungültige Wortformen ablehnt. Binden Sie sie anschließend in das Eval-Harness ein und sehen Sie, welche Bewertung sie erzielt.

**Was Sie erstellen werden:** Eine Übersetzungspipeline für Plains Cree, die morphologisch ungültige Übersetzungen erkennt, *bevor* sie in Ihre Bewertung einfließen.

:::info[Voraussetzungen]
- Eine lauffähige FST-Binärdatei (z. B. der [GiellaLT/ALTLab Plains-Cree-Analysator](https://github.com/giellalt/lang-crk) – vertrieben über den Nightly-Kanal von GiellaLT, nicht über GitHub-Releases)
- Node.js 20+ (für die Pipeline) und Python 3.10+ (für die Evaluierungsumgebung)
- Ein OpenRouter-API-Schlüssel für den LLM-Schritt
:::

---

## Architektur

Die Pipeline ist eine Kette von Stufen. Jede Stufe hat eine bestimmte Aufgabe. Sie können dies in jeder beliebigen Sprache erstellen — dieses Beispiel verwendet JavaScript, aber das Harness interessiert sich nicht für den Inhalt. Es sieht lediglich den schlanken Python-Adapter an der Schnittstelle.

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

### Warum diese Stufen

| Stufe | Was sie tut | Warum sie wichtig ist |
|-------|-------------|---------------|
| **Decompose** | Zerlegt zusammengesetzte UI-Zeichenketten in übersetzbare Segmente | Polysynthetische Sprachen kodieren ganze Sätze in einzelnen Wörtern — das LLM benötigt kleinere Einheiten |
| **Dictionary Lookup** | Prüft ein zweisprachiges Wörterbuch auf bekannte Übersetzungen | Erzwingt korrekte Terminologie für bekannte Begriffe, anstatt sich auf Vermutungen des LLM zu verlassen |
| **LLM Translate** | Sendet das Segment an ein LLM mit Register- und Grammatikkontext | Verarbeitet neuartige Phrasen und erzeugt flüssige Ausgaben |
| **FST Validate** | Führt die Ausgabe durch einen morphologischen Analyzer | Erkennt ungültige Wortformen — wenn der FST ein Wort ablehnt, ist es keine gültige Wortform in der Sprache |
| **Retry** | Sendet abgelehnte Wörter mit dem Fehler-Feedback des FST erneut | Liefert dem LLM konkrete Informationen darüber, *warum* das Wort falsch war |

---

## Der Datenfluss

Folgendes geschieht mit einem einzelnen Eintrag, während er durch die Pipeline fließt:

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

### Wenn der FST ablehnt

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

## Implementierung

Erstellen Sie, was immer Sie möchten. Dieses Beispiel verwendet JavaScript, aber Sie könnten ebenso gut Python, Rust oder etwas anderes verwenden. Das Harness interessiert sich nicht dafür — es kommuniziert nur mit dem schlanken Python-Adapter (im nächsten Abschnitt gezeigt).

### Die Pipeline

Jede Stufe ist eine Funktion. Die Pipeline verkettet sie miteinander.

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

### Der FST-Wrapper

Umhüllen Sie Ihre FST-Binärdatei als asynchrone Funktion. Dieses Beispiel verwendet ALTLabs HFST-basierten Plains-Cree-Analyzer.

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

### Wörterbuch- und LLM-Module

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

## Einbinden in das Harness

Ihre Pipeline ist erstellt. Nun müssen Sie sie mit dem Eval-Harness verbinden, damit Sie sie auf dem Leaderboard benchmarken können.

Das Harness spricht eine einzige Schnittstelle: `TranslationMethod`. Es handelt sich um ein Python-Protokoll mit einer einzigen Methode. Erstellen Sie, was immer Sie möchten, in welcher Sprache auch immer — versehen Sie es anschließend mit diesem schlanken Wrapper, und es lässt sich einbinden.

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

:::tip[Sie benötigen kein HTTP]
Das obige Beispiel ruft die Pipeline über HTTP auf, weil die Pipeline in JavaScript geschrieben ist. Wenn Ihre Pipeline in Python vorliegt, können Sie sie direkt aufrufen – ganz ohne Server. Der `TranslationMethod`-Wrapper ist lediglich eine Funktionsgrenze. Was darin geschieht, bleibt Ihnen überlassen.
:::

### Den Benchmark ausführen

Starten Sie Ihre Pipeline und führen Sie dann das Harness aus:

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

Oder verwenden Sie die CLI, um einen Vergleich mit der integrierten Baseline durchzuführen:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --fst-retries 3 \
  --name fst-gated-v1 \
  --publish
```

---

## Ihre Ergebnisse verstehen

Die Evaluierungsumgebung erzeugt eine **Run-Card** – eine JSON-Datei mit Ihren Werten. Im Überblick (beispielhafte Zahlen, kein Transkript):

```
  Headline     chrF++ 48.7 [47.1, 50.3]   (95% bootstrap CI, sacreBLEU signature recorded)
  Diagnostics  exact match 12.1% · FST acceptance 94.4%
  Cost         436 entries · 47 retries · $0.18 total
```

**Was Ihnen dies auf einen Blick verrät:**
- **chrF++ 48,7** ist die Hauptmetrik: Zeichen-n-Gramm-Überschneidung auf Korpusebene mit den Referenzübersetzungen, auf einer Skala von 0–100. Die Angabe in Klammern ist das 95-%-Konfidenzintervall; ein erneuter Durchlauf oder eine konkurrierende Methode, deren Intervall sich mit Ihrem überschneidet, unterscheidet sich möglicherweise nicht wirklich. Um dies herauszufinden, vergleichen Sie die beiden Durchläufe mit `mt-eval compare --significance`, was einen gepaarten Signifikanztest für chrF++ durchführt.
- **FST-Akzeptanz 94,4 %** ist ein diagnostischer Wert: Das FST akzeptiert 94 % der Ausgabewörter als gültige Formen; Ihre Wiederholungsschleife funktioniert also. Dies sagt nichts darüber aus, ob die Wörter den Ausgangstext übersetzen, weshalb dieser Wert nie in die Hauptmetrik einfließt.
- **Exakte Übereinstimmung 12,1 %** ist ebenfalls ein diagnostischer Wert: Es gibt viel Raum für Verbesserungen.

:::info[Keine Qualitätsbezeichnung bei automatischen Werten]
Die Evaluierungsumgebung versieht einen Wert nicht mit Bezeichnungen wie „funktional“, „einsatzfähig“ oder Ähnlichem. Diese auf zusammengesetzten Werten basierenden Stufen wurden abgeschafft: Dieselbe Zahl bedeutet für verschiedene Sprachen und Evaluierungsdatensätze Unterschiedliches, und nur die Überprüfung durch Sprecher bestätigt die Qualität. Siehe [Wie Durchläufe bewertet werden](/docs/network/specifications/scoring#how-runs-are-scored) und [warum der Gesamtwert abgeschafft wurde](/docs/network/specifications/scoring#why-the-composite-was-retired).
:::

<details>
<summary><strong>Tiefer: Was enthält die Run Card?</strong></summary>

Die Run-Card-JSON erfasst alles über diesen Evaluierungslauf. Wichtige Abschnitte:

**Werte** – jede von der Evaluierungsumgebung berechnete Metrik:
```json
{
  "scores": {
    "scoring_standard": "standard/1",
    "primary_metric": "chrf_plus_plus",
    "chrf_plus_plus": 48.7,
    "confidence_intervals": {
      "corpus_chrf": { "ci_lower": 47.1, "ci_upper": 50.3 }
    },
    "sacrebleu_signatures": {
      "chrf": "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3"
    },
    "exact_match_rate": 0.121,
    "fst_acceptance_rate": 0.944,
    "composite": null,
    "quality_tier": null
  }
}
```

**Provenance** — was diese Ergebnisse erzeugt hat:
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

**Ergebnisse pro Eintrag** — jede Übersetzung mit individuellen Bewertungen, sodass Sie erkennen können, wo Ihre Methode Schwierigkeiten hat:
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

Die Card enthält neben chrF++ auch BLEU, spBLEU und TER (sowie COMET, wenn es berechnet wurde), niemals damit vermischt, und alle Vorbehalte zu den Werten, die von der Evaluierungsumgebung festgestellt wurden. `composite` und `quality_tier` sind auf einer neuen Card immer `null`: Der gewichtete Gesamtwert und seine Stufen sind ausgemustert, und nur Cards, die vor dem Standard veröffentlicht wurden, enthalten noch einen gespeicherten Wert, der als veralteter Gesamtwert (ausgemustert) ausgewiesen wird. Siehe die [Bewertungsspezifikation](/docs/network/specifications/scoring#how-runs-are-scored).

</details>

---

## Bereitstellung in der Produktion

Ihre Methode hat Bewertungen auf dem Leaderboard. Nun möchten Sie sie tatsächlich nutzen. In diesem Abschnitt geht es darum, Ihre Pipeline als Produktions-Endpunkt bereitzustellen, den [champollion](https://champollion.dev) aufrufen kann.

:::note[Dieser Abschnitt ist optional]
Alles Vorstehende befasst sich mit dem Aufbau und Benchmarking Ihrer Methode. Dieser Abschnitt behandelt die Bereitstellung – ein separates Thema. Sie können auch dann am Leaderboard teilnehmen, wenn Sie nichts bereitstellen.
:::

### Der HTTP-Server

Umhüllen Sie Ihre Pipeline als Express-Server, der den [API-Methodenvertrag](https://champollion.dev/docs/guides/serving-a-method) implementiert:

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

### champollion konfigurieren

Richten Sie Ihr Sprachpaar auf den laufenden Dienst aus:

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

### Als Plugin verpacken

Sobald Ihre Methode Bewertungen erzielt hat, verpacken Sie sie, damit andere sie nutzen können:

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

## Dieses Muster erweitern

Dieses Cookbook demonstriert eine Pipeline-Architektur. Sie können sie für jede Sprache oder Methode anpassen:

| Variante | Was sich ändert |
|-----------|-------------|
| **Anderer FST** | Tauschen Sie den Binärpfad aus. Sie können vorkompilierte FSTs (wie `.hfstol`- oder `lttoolbox`-Binärdateien) für über 100 Sprachen vom [GiellaLT GitHub](https://github.com/giellalt) oder [Apertium GitHub](https://github.com/apertium) herunterladen. |
| **Kein FST verfügbar** | Entfernen Sie die FST-Ausführungsstufe und verwenden Sie [UniMorph-Paradigmendateien im Flat-Format](https://huggingface.co/datasets/unimorph/universal_morphologies) von Hugging Face, um eine statische Datenbankabfrage-Validierung flektierter Formen durchzuführen. |
| **Mehrere LLMs** | Verketten Sie Modelle: ein schnelles Modell für den ersten Entwurf, ein Reasoning-Modell für Korrekturen. |
| **Human-in-the-loop** | Fügen Sie eine Warteschlangen-Stufe hinzu, die unsichere Übersetzungen vor der Rückgabe zur Expertenüberprüfung zurückhält. |
| **Feinabgestimmtes Modell** | Ersetzen Sie den OpenRouter-Aufruf durch ein lokales Modell (Ollama, vLLM usw.). |
| **Andere Sprache** | Ändern Sie das Wörterbuch, den FST und das Register. Die Architektur bleibt identisch. |

Die Pipeline ist ein Muster. Die Stufen sind austauschbar. Erstellen Sie, was für Ihre Sprache funktioniert, beweisen Sie es auf dem [Leaderboard](https://champollion.dev/leaderboard), und stellen Sie es bereit.

---

## Siehe auch

- **[Evaluierungsumgebung](/docs/network/specifications/harness)** – wie Sie die Evaluierungsumgebung ausführen und die Ausgabe interpretieren
- **[Methodenschnittstelle](/docs/network/specifications/methods)** – die Protokollspezifikation für `TranslationMethod`
- **[Bestenlisten-Regeln](/docs/network/leaderboard/rules)** – Einreichungskriterien und Richtlinien gegen Manipulation
- **[Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages)** – der breitere Kontext und Prinzipien der Datensouveränität von Gemeinschaften
- **[ALTLab](https://altlab.ualberta.ca/)** – das Alberta Language Technology Lab (Plains-Cree-FST)
- **[Methoden-Bestenliste](https://champollion.dev/leaderboard)** – reichen Sie Ihre Werte ein
