---
sidebar_position: 6
title: "Cookbook: FST-Gated Translation Pipeline"
description: "สร้าง decomposition pipeline พร้อม morphological validation และทดสอบประสิทธิภาพบน Network leaderboard"
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

# Cookbook: FST-Gated Translation Pipeline

สร้าง pipeline การแปลแบบหลายขั้นตอนที่แยกวิเคราะห์ข้อความต้นฉบับ แปลผ่าน LLM ตรวจสอบผลลัพธ์ด้วย finite-state transducer (FST) และลองใหม่เมื่อ FST ปฏิเสธรูปคำที่ไม่ถูกต้อง จากนั้นเชื่อมต่อเข้ากับ eval harness เพื่อดูคะแนน

**สิ่งที่คุณจะสร้าง:** Pipeline การแปลสำหรับภาษา Plains Cree ที่ตรวจจับการแปลที่ผิดหลักสัณฐานวิทยา *ก่อน* ที่จะนับเป็นคะแนนเสีย

:::info[ข้อกำหนดเบื้องต้น]
- FST binary ที่กำลังทำงานอยู่ (เช่น [GiellaLT/ALTLab Plains Cree analyzer](https://github.com/giellalt/lang-crk) — ซึ่งแจกจ่ายผ่านช่องทาง nightly ของ GiellaLT ไม่ใช่ผ่าน GitHub releases)
- Node.js 20+ (สำหรับ pipeline) และ Python 3.10+ (สำหรับ harness)
- OpenRouter API key สำหรับขั้นตอน LLM
:::

---

## สถาปัตยกรรม

Pipeline คือลำดับขั้นตอนที่เชื่อมต่อกัน แต่ละขั้นตอนมีหน้าที่เฉพาะ คุณสามารถสร้างสิ่งนี้ด้วยภาษาใดก็ได้ — ตัวอย่างนี้ใช้ JavaScript แต่ harness ไม่สนใจว่าข้างในใช้อะไร มันมองเห็นเพียง Python adapter บางๆ ที่ขอบเขตเท่านั้น

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

### เหตุผลของแต่ละขั้นตอน

| ขั้นตอน | หน้าที่ | ความสำคัญ |
|-------|-------------|---------------|
| **Decompose** | แยกสตริง UI ที่ซับซ้อนออกเป็นส่วนที่แปลได้ | ภาษาแบบ polysynthetic เข้ารหัสทั้งประโยคไว้ในคำเดียว — LLM ต้องการหน่วยที่เล็กกว่า |
| **Dictionary Lookup** | ค้นหาพจนานุกรมสองภาษาสำหรับคำแปลที่รู้จัก | บังคับใช้คำศัพท์ที่ถูกต้องสำหรับคำที่รู้จัก แทนที่จะพึ่ง LLM เดา |
| **LLM Translate** | ส่งส่วนข้อความไปยัง LLM พร้อมบริบทด้านรูปแบบและไวยากรณ์ | จัดการวลีใหม่และสร้างผลลัพธ์ที่คล่องแคล่ว |
| **FST Validate** | รันผลลัพธ์ผ่านตัววิเคราะห์สัณฐานวิทยา | ตรวจจับรูปคำที่ไม่ถูกต้อง — หาก FST ปฏิเสธคำใด แสดงว่าคำนั้นไม่ใช่รูปคำที่ถูกต้องในภาษานั้น |
| **Retry** | ส่งคำที่ถูกปฏิเสธซ้ำพร้อมข้อมูลป้อนกลับจาก FST | ให้ข้อมูลเฉพาะเจาะจงแก่ LLM เกี่ยวกับ *สาเหตุ* ที่คำนั้นผิด |

---

## การไหลของข้อมูล

นี่คือสิ่งที่เกิดขึ้นกับรายการเดียวขณะที่ไหลผ่าน pipeline:

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

### เมื่อ FST ปฏิเสธ

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

## การนำไปใช้งาน

สร้างอะไรก็ได้ตามต้องการ ตัวอย่างนี้ใช้ JavaScript แต่คุณอาจใช้ Python, Rust หรืออะไรก็ได้ harness ไม่สนใจ — มันคุยกับเพียง Python adapter บางๆ เท่านั้น (แสดงในส่วนถัดไป)

### Pipeline

แต่ละขั้นตอนคือฟังก์ชัน pipeline เชื่อมต่อฟังก์ชันเหล่านั้นเข้าด้วยกัน

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

### FST Wrapper

ห่อ FST binary ของคุณเป็น async function ตัวอย่างนี้ใช้ HFST-based Plains Cree analyzer ของ ALTLab

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

### โมดูล Dictionary และ LLM

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

## การเชื่อมต่อกับ Harness

Pipeline ของคุณสร้างเสร็จแล้ว ตอนนี้คุณต้องเชื่อมต่อกับ eval harness เพื่อทำ benchmark บน leaderboard

harness ใช้อินเทอร์เฟซเดียว: `TranslationMethod` เป็น Python protocol ที่มีเมธอดเดียว สร้างอะไรก็ได้ด้วยภาษาใดก็ได้ — แล้วให้ wrapper บางๆ นี้ และมันก็เชื่อมต่อได้ทันที

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

:::tip[คุณไม่จำเป็นต้องใช้ HTTP]
ตัวอย่างข้างต้นเรียก pipeline ผ่าน HTTP เนื่องจาก pipeline เขียนด้วย JavaScript หาก pipeline ของคุณเขียนด้วย Python คุณสามารถเรียกใช้งานได้โดยตรง — ไม่จำเป็นต้องมี server ตัวห่อ `TranslationMethod` เป็นเพียงขอบเขตของฟังก์ชัน สิ่งที่เกิดขึ้นภายในขึ้นอยู่กับคุณ
:::

### การรัน Benchmark

เริ่ม pipeline ของคุณ จากนั้นรัน harness:

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

หรือใช้ CLI เพื่อเปรียบเทียบกับ baseline ที่มีอยู่:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --fst-retries 3 \
  --name fst-gated-v1 \
  --publish
```

---

## การทำความเข้าใจผลลัพธ์

harness สร้าง **run card** — ไฟล์ JSON ที่มีคะแนนของคุณ นี่คือสิ่งที่คุณจะเห็น:

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

**สิ่งที่บอกคุณได้ทันที:**
- วิธีการของคุณอยู่ในระดับ **Functional** (0.50–0.70) — ผลลัพธ์ที่ผู้พูดภาษานั้นสามารถเข้าใจได้ ไวยากรณ์หลักมักถูกต้อง แต่ยังมีข้อผิดพลาดด้านสัณฐานวิทยาบ่อยครั้ง
- FST ตรวจสอบคำว่าถูกต้อง 94% — retry loop ของคุณทำงานได้
- 12% ของการแปลถูกต้องทุกประการ — ยังมีพื้นที่ให้ปรับปรุงอีกมาก

:::info[ระดับคุณภาพ]
| ระดับ | คะแนนรวม | ความหมาย |
|------|-----------|---------------|
| Baseline | 0.00–0.30 | ผลลัพธ์ดิบจาก LLM ส่วนใหญ่เป็นสัณฐานวิทยาที่ hallucinate ขึ้นมา |
| Emerging | 0.30–0.50 | มีรูปแบบที่ถูกต้องบ้าง แต่ยังไม่น่าเชื่อถือ |
| **Functional** | **0.50–0.70** | **ผู้พูดภาษาสามารถจดจำได้ หมวดหมู่หลักมักถูกต้อง** |
| Deployable | 0.70–0.85 | เหมาะสำหรับการแปลฉบับร่างโดยมีมนุษย์ตรวจสอบ |
| Fluent | 0.85–1.00 | ใกล้เคียงกับการแปลโดยมนุษย์ที่มีความสามารถ |

ดู [SCORING_SPEC §5](/docs/network/specifications/scoring#5-quality-tiers) สำหรับคำจำกัดความระดับทั้งหมด
:::

<details>
<summary><strong>เจาะลึก: มีอะไรอยู่ใน run card?</strong></summary>

run card JSON บันทึกทุกอย่างเกี่ยวกับการรัน evaluation นี้ ส่วนสำคัญ:

**Scores** — ทุก metric ที่ harness คำนวณ:
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

**Provenance** — สิ่งที่สร้างผลลัพธ์เหล่านี้:
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

**ผลลัพธ์รายรายการ** — การแปลทุกรายการพร้อมคะแนนแต่ละรายการ เพื่อให้คุณหาจุดที่วิธีการของคุณมีปัญหา:
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

คะแนน composite คือค่าเฉลี่ยถ่วงน้ำหนักของ metric ที่มีอยู่ โดยมีน้ำหนักที่กำหนดไว้ใน [SCORING_SPEC §4](/docs/network/specifications/scoring#4-composite-score) เมื่อ metric ใดไม่พร้อมใช้งาน น้ำหนักของมันจะถูกกระจายตามสัดส่วนไปยัง metric ที่เหลือ

</details>

---

## การ Deploy สู่ Production

วิธีการของคุณมีคะแนนบน leaderboard แล้ว ตอนนี้คุณต้องการนำไปใช้จริง ส่วนนี้เกี่ยวกับการให้บริการ pipeline ของคุณเป็น production endpoint ที่ [champollion](https://champollion.dev) สามารถเรียกใช้ได้

:::note[ส่วนนี้เป็นตัวเลือก]
ทุกอย่างข้างต้นเกี่ยวกับการสร้างและการวัดประสิทธิภาพวิธีการของคุณ ส่วนนี้เกี่ยวกับการ deploy — ซึ่งเป็นเรื่องที่แยกออกจากกัน คุณสามารถส่งข้อมูลเข้า leaderboard ได้โดยไม่ต้อง deploy สิ่งใดเลย
:::

### HTTP Server

ห่อ pipeline ของคุณเป็น Express server ที่ implement [API method contract](https://champollion.dev/docs/guides/serving-a-method):

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

### กำหนดค่า champollion

ชี้คู่ภาษาของคุณไปยังบริการที่กำลังทำงาน:

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

### การแพ็กเกจเป็น Plugin

เมื่อวิธีการของคุณมีคะแนนแล้ว ให้แพ็กเกจเพื่อให้ผู้อื่นสามารถใช้งานได้:

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

## การขยายรูปแบบนี้

cookbook นี้แสดงสถาปัตยกรรม pipeline แบบหนึ่ง คุณสามารถปรับใช้กับภาษาหรือวิธีการใดก็ได้:

| รูปแบบที่เปลี่ยน | สิ่งที่เปลี่ยนแปลง |
|-----------|-------------|
| **FST ต่างกัน** | เปลี่ยน path ของ binary คุณสามารถดาวน์โหลด FST ที่คอมไพล์แล้ว (เช่น binary `.hfstol` หรือ `lttoolbox`) สำหรับกว่า 100 ภาษาจาก [GiellaLT GitHub](https://github.com/giellalt) หรือ [Apertium GitHub](https://github.com/apertium) |
| **ไม่มี FST** | ลบขั้นตอนการรัน FST ออก และใช้ [UniMorph flat paradigm files](https://huggingface.co/datasets/unimorph/universal_morphologies) จาก Hugging Face เพื่อตรวจสอบรูปคำที่ผันแล้วด้วยการค้นหาฐานข้อมูลแบบ static |
| **LLM หลายตัว** | เชื่อมต่อโมเดลหลายตัว: โมเดลเร็วสำหรับร่างแรก โมเดล reasoning สำหรับการแก้ไข |
| **Human-in-the-loop** | เพิ่มขั้นตอน queue ที่เก็บการแปลที่ไม่แน่ใจไว้รอผู้เชี่ยวชาญตรวจสอบก่อนส่งคืน |
| **โมเดลที่ fine-tune แล้ว** | แทนที่การเรียก OpenRouter ด้วยโมเดลในเครื่อง (Ollama, vLLM เป็นต้น) |
| **ภาษาต่างกัน** | เปลี่ยนพจนานุกรม FST และรูปแบบภาษา สถาปัตยกรรมยังคงเหมือนเดิม |

pipeline คือรูปแบบ ขั้นตอนต่างๆ สามารถสลับเปลี่ยนได้ สร้างสิ่งที่เหมาะกับภาษาของคุณ พิสูจน์บน [leaderboard](https://champollion.dev/leaderboard) และ deploy

---

## ดูเพิ่มเติม

- **[Eval Harness](/docs/network/specifications/harness)** — วิธีการรัน harness และการตีความผลลัพธ์
- **[Method Interface](/docs/network/specifications/methods)** — ข้อกำหนดโปรโตคอล `TranslationMethod`
- **[กฎของ Leaderboard](/docs/network/leaderboard/rules)** — เกณฑ์การส่งผลงานและนโยบายป้องกันการทุจริต
- **[สนับสนุนภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages)** — บริบทในภาพกว้างและหลักการอธิปไตยทางข้อมูล
- **[ALTLab](https://altlab.ualberta.ca/)** — Alberta Language Technology Lab (Plains Cree FST)
- **[Method Leaderboard](https://champollion.dev/leaderboard)** — ส่งคะแนนของคุณ
