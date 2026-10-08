---
sidebar_position: 4
title: "ข้อกำหนดการ์ดการรัน"
---

# ข้อกำหนด Run Card

> **สรุปสาระสำคัญ.** Run card คือหน่วยพื้นฐานของการ benchmarking — เอกสาร JSON ที่บันทึกการกำหนดค่าทั้งหมด ผลลัพธ์รายรายการ และคะแนนรวมของการรันการประเมินหนึ่งครั้ง หน้านี้อธิบาย schema, ฟิลด์, กลไก fingerprinting และโครงสร้างคะแนน ดู [Benchmark Specification](/docs/network/specifications/benchmark) สำหรับนิยามที่เป็นมาตรฐาน

Run card คือบันทึกสมบูรณ์ของการรันการประเมินครั้งเดียว ประกอบด้วยทุกสิ่งที่จำเป็นสำหรับการทำความเข้าใจ การทำซ้ำ และการตรวจสอบการทดลอง ได้แก่ การกำหนดค่า คะแนน ผลลัพธ์รายรายการ การใช้งาน token และ metadata ของสภาพแวดล้อม

**เวอร์ชัน Schema:** 2.0

:::info[สคีมาอ้างอิงหลัก]
[ข้อกำหนดเบนช์มาร์ก (Benchmark Specification)](/docs/network/specifications/benchmark) คือแหล่งข้อมูลอ้างอิงหลักแหล่งเดียว (single source of truth) สำหรับสคีมาของรันการ์ด สำหรับนิยามของเมตริกและวิธีการให้คะแนนการรัน (คะแนนหลัก chrF++, เมตริกมาตรฐานคู่ขนาน, ข้อมูลวินิจฉัย) โปรดดูที่ [ข้อกำหนดการให้คะแนน (Scoring Specification)](/docs/network/specifications/scoring) หน้านี้ให้ข้อมูลเกี่ยวกับการนำไปใช้งานจริงในปัจจุบัน
:::

---

## ฟิลด์ระดับบนสุด

| ฟิลด์ | ชนิด | คำอธิบาย |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 ที่สร้างขึ้นเมื่อเริ่มต้นการรัน |
| `harness_version` | `string` | Semantic version ของ harness ที่สร้างการ์ดนี้ (เช่น `2.0`) |
| `model_slug` | `string` | Model slug ที่ใช้สำหรับการรัน (เช่น `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | ตัวระบุโมเดลที่ได้รับการแปลงผลลัพธ์ซึ่งส่งกลับมาจาก API (เช่น `gemini-3.1-pro-001`) |
| `condition` | `string` | เลเบลการทดลอง: สิ่งที่ harness บันทึกคือ `naive` (พรอมต์ในตัว), `coached` (มีไฟล์ coaching มาแทนที่) หรือสำหรับปลั๊กอินเมธอด จะเป็นคลาสเมธอดของมัน; เป็นข้อความอิสระ (free text) ดังนั้นการ์ดที่สร้างขึ้นด้วยตนเองอาจระบุว่า `coached-v3` หรือ `few-shot` ไม่ใช่เลเบลแสดงคุณภาพ (ระดับคุณภาพถูกยกเลิกการใช้งานแล้ว; `scores.quality_tier` จะเป็น null ในการ์ดใหม่ทุกใบ) |
| `timestamp` | `string` | การประทับเวลา (timestamp) แบบ ISO 8601 UTC เมื่อเริ่มต้นการรัน |
| `elapsed_seconds` | `number` | ระยะเวลาจริง (wall-clock duration) ของการรันทั้งหมด |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

ระบุชุดข้อมูลการประเมินและยึดไว้กับเวอร์ชันเนื้อหาเฉพาะผ่าน SHA-256

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `id` | `string` | ตัวระบุชุดข้อมูล (เช่น `edtekla-dev-v1`) |
| `version` | `string` | สตริงเวอร์ชันชุดข้อมูล |
| `language_pair` | `string` | ป้ายกำกับสำหรับแสดงผล (เช่น `EN→CRK`) |
| `sha256` | `string` | SHA-256 hash ของเนื้อหาไฟล์ชุดข้อมูล รับประกันข้อมูลที่ใช้จริง |
| `entry_count` | `number` | จำนวนรายการในชุดข้อมูล |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

การกำหนดค่า API และ batching ที่ใช้สำหรับการรันนี้

| ฟิลด์ | ชนิด | คำอธิบาย |
|-------|------|-------------|
| `api_provider` | `string` | สิ่งที่ทำหน้าที่รับส่งข้อความ: ผู้ให้บริการ API สำหรับเส้นทาง LLM ของ harness เอง (`openrouter`, `openai`, `anthropic`, `gemini`, `local`); engine id สำหรับเอนจิน MT (เช่น `google-translate`); สำหรับปลั๊กอินเมธอด จะเป็น `local` เมื่อผู้ดูแลรับรองการส่งข้อมูลแบบโลคัลทั้งหมด (`--attest-local-transport`), นอกเหนือจากนั้นจะเป็น `method-plugin` |
| `temperature` | `number` | Sampling temperature |
| `max_tokens` | `number` | จำนวนโทเค็นสูงสุดต่อการสร้างข้อความเสร็จสิ้น (completion) |
| `batch_size` | `number` | จำนวนรายการต่อแบตช์พร้อมกัน |
| `concurrency` | `number` | คำขอ API แบบคู่ขนานสูงสุด |
| `coaching_file` | `string` | เส้นทางไปยังไฟล์ coaching prompt หากมีการใช้งาน (เป็นบันทึกของรันล็อกเอง; การ์ดที่เผยแพร่จะระบุชื่อ coaching ตามชื่อไฟล์ หรือ `inline coaching` สำหรับข้อความ `--coaching` — จะไม่ใช้เส้นทางแบบโลคัล) |
| `method_path` | `string` | เส้นทางไปยังไดเรกทอรีปลั๊กอินเมธอด หากมีการใช้งาน |
| `fst_retries` | `number` | จำนวนครั้งที่พยายามลองใหม่ของ FST |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[Run Card ที่เผยแพร่แล้วจะมี `method_config`]
เมื่อ run card ถูกเผยแพร่ผ่าน `mt-eval publish` นั้น `publish.py` จะแทรกบล็อก `method_config` ที่ประกอบด้วย MethodConfig แบบ 8 ฟิลด์มาตรฐาน ซึ่งช่วยให้ติดตั้งบน leaderboard ได้โดยไม่มีอุปสรรค — ทุกคนสามารถทำซ้ำ method ได้โดยตรงจาก card ที่เผยแพร่

```json
{
  "method_config": {
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

`qualityTier` จะเป็น `null` เสมอบนการ์ดใหม่: ระดับคุณภาพถูกยกเลิกการใช้งานแล้ว ฟิลด์ทั้งหมดใช้ **camelCase** และเป็นไปตามสคีมา MethodConfig แบบมาตรฐาน (ดูที่ [การสร้างเมธอด](/docs/network/specifications/methods))
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | SHA-256 hash ของ system prompt รวมอยู่ใน fingerprint |
| `system_prompt_used` | `string` | ข้อความ system prompt ฉบับเต็มที่ส่งไปยัง model |

prompt hash เป็นส่วนหนึ่งของ [fingerprint](#fingerprint) — การรันสองครั้งที่มี prompt ต่างกันจะมี fingerprint ต่างกัน แม้ว่าการตั้งค่าอื่นทั้งหมดจะเหมือนกัน

---

## `fingerprint`

ตัวระบุสำหรับการทำซ้ำ การรันสองครั้งที่มี fingerprint เหมือนกันหมายความว่าใช้การตั้งค่าการทดลองเดียวกัน

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `hash` | `string` | SHA-256 hash ของ component ที่เรียงลำดับแล้ว |
| `components` | `object` | ค่า input ที่นำมา hash |

### Component ของ Fingerprint

รายการมาตรฐานอย่างเป็นทางการคือ [Benchmark Specification §3.8](/docs/network/specifications/benchmark#38-fingerprint) สรุปโดยย่อดังนี้:

| คอมโพเนนต์ | คำอธิบาย |
|-----------|-------------|
| `dataset_sha256` | แฮชของไฟล์ชุดข้อมูล |
| `model_slug` | โมเดลที่ใช้ (สำหรับเอนจิน MT หรือปลั๊กอินเมธอด จะเป็นรหัสของเอนจินหรือเมธอด) |
| `condition` | เลเบลเงื่อนไขการทดลอง |
| `system_prompt_sha256` | แฮชของ system prompt |
| `temperature` | Sampling temperature |
| `batch_size`, `tools_enabled` | การทำแบตช์และการใช้เครื่องมือ |
| `harness_version` | เวอร์ชันของ harness |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | เวอร์ชัน 2 (harness 0.2.0 ขึ้นไป): แชนเนล, โฮสต์เอนด์พอยต์ (ผ่านการแฮช), ขีดจำกัดโทเค็น และเวอร์ชันรวมถึงโค้ดแฮชของเมธอด |
| `method_model`, `method_dependencies_sha256` | เวอร์ชัน 2 สำหรับการรันปลั๊กอินเมธอดเท่านั้น: โมเดลที่ส่งมอบให้ปลั๊กอิน (`-m`) และแฮชของ `dependencies` ที่ประกาศไว้ |
| `method_model`, `method_model_sha256` | เวอร์ชัน 2 สำหรับการรัน `--method local-model` เท่านั้น: โมเดลที่โหลด (Hugging Face id หรือชื่อไดเรกทอรี) และแฮชเนื้อหา (สำหรับไดเรกทอรี) หรือ revision (สำหรับ Hugging Face id) |

`fingerprint.version` จะระบุว่าการ์ดถูกแฮชภายใต้รายการใด

### `engine_model`

การรันเอนจิน MT ที่รันโมเดลตามที่ได้รับมอบหมาย (`--method local-model -m <model>`) จะมีข้อมูลโมเดลที่โหลดรวมอยู่ด้วย:

| ฟิลด์ | คำอธิบาย |
|-------|-------------|
| `given` | สิ่งที่ `-m` ระบุไว้ |
| `kind` | `directory` หรือ `hub` (Hugging Face id) |
| `id` | Hugging Face id หรือชื่อไดเรกทอรี (ไม่ใช่เส้นทางแบบโลคัล) |
| `sha256` | สำหรับไดเรกทอรีเท่านั้น: SHA-256 ของรายการไฟล์ในรูปแบบ `sha256sum` |
| `revision` | สำหรับ Hugging Face id เท่านั้น: revision ที่โหลด |
| `family`, `backend` | `opus`, `nllb` หรือ `madlad`; `transformers` หรือ `ctranslate2` |
| `decode` | ความยาวสูงสุดของเอาต์พุต: ความยาวตามที่โมเดลประกาศไว้ หรือกฎของ harness (`max(64, 4 × source tokens)` โทเค็นใหม่ โดยจำกัดไม่เกินตำแหน่งของ decoder) |
| `pair_mismatch` | ปรากฏเฉพาะเมื่อมีการตั้งใจรันโมเดลคู่ภาษา OPUS-MT สำหรับคู่อื่น (`--allow-model-pair-mismatch`) |

`method_config.model` ระบุชื่อโมเดลเดียวกัน (`<id>@<revision>` หรือ `<directory name>@sha256:<hash>`) รันล็อกของ `local-model` ที่ไม่ได้บันทึกโมเดลไว้จะไม่เผยแพร่ข้อมูลใดๆ ออกมา: การ์ดจะระบุว่า `engine_model_unrecorded` และ `mt-eval publish` จะปฏิเสธการ์ดนั้น

### `method_plugin`

การรันปลั๊กอินเมธอด (`--method <plugin dir>`) จะมีข้อมูลที่ระบุตัวตนของปลั๊กอินตามที่รันเนอร์ได้บันทึกไว้ด้วย:

| ฟิลด์ | คำอธิบาย |
|-------|-------------|
| `version` | เวอร์ชันที่ `method.json` ประกาศไว้ (`null` หากไม่ได้ประกาศไว้) |
| `code_sha256` | SHA-256 ของไฟล์ต่างๆ ในปลั๊กอิน (`method.json` และไฟล์ `.py` ซึ่งเป็น manifest รูปแบบ `sha256sum`) |
| `model_given` | โมเดลที่ส่งมอบให้ปลั๊กอินผ่าน `-m/--model` หรือ `null` |
| `models_called`, `models_basis` | โมเดลที่ปลั๊กอินรายงานว่าเรียกใช้ และระบุว่าเป็นการสังเกตจากผลลัพธ์หรือมาจากการประกาศไว้ |
| `dependency_class` | คลาสดีเพนเดนซีที่ `method.json` ประกาศไว้ |
| `dependencies` | รายการ `dependencies` ที่ `method.json` ประกาศไว้ โดยไม่รวมข้อความอิสระ `notes` |
| `dependencies_sha256` | SHA-256 ของรายการที่ประกาศไว้ฉบับเต็ม (คอมโพเนนต์ของ fingerprint) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Fingerprint ≠ Run Card Hash]
fingerprint ระบุ *การกำหนดค่าของการทดลอง* ส่วน `run_card_hash` ตรวจสอบ *ความสมบูรณ์ของไฟล์ผลลัพธ์* ดูรายละเอียดได้ที่ [Fingerprint vs Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash)
:::

---

## `scores`

metric รวมสำหรับการรันทั้งหมด

### คะแนนระดับบนสุด

| ฟิลด์ | ชนิด | คำอธิบาย |
|-------|------|-------------|
| `total` | `number` | จำนวนรายการทั้งหมดที่ได้รับการประเมิน |
| `exact_matches` | `number` | รายการที่เอาต์พุตตรงกับค่ามาตรฐานอ้างอิง (gold standard) พอดีทุกประการ |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | **คำ**ในเอาต์พุตที่ตัววิเคราะห์ FST ยอมรับ ซึ่งรวมผลจากทุกรายการ (ไม่ใช่จำนวนนับของรายการ) เป็น `null` หากไม่ได้ใช้ตัววิเคราะห์ FST |
| `fst_acceptance_rate` | `number` | ค่าเฉลี่ยของอัตราการยอมรับต่อรายการ (คำที่ยอมรับในแต่ละรายการ ÷ คำทั้งหมดของรายการนั้น; เอาต์พุตว่างนับเป็น 0) อยู่ในช่วง 0.0–1.0 ซึ่ง**ไม่ใช่** `fst_accepted` ÷ คำทั้งหมด — อัตราส่วนคำรวมทั้งหมดนั้นคือ `corpus_validity_rate` ของรายงาน ซึ่งแสดงบนรันการ์ดเป็น "Words accepted" และเป็น `null` หากไม่ได้ใช้ตัววิเคราะห์ FST |
| `chrf_plus_plus` | `number` | **เมตริกหลักและเมตริกจัดอันดับ:** chrF++ ระดับคอร์ปัส (sacreBLEU chrF, `word_order=2`) คะแนน 0–100 โดยมี 95% bootstrap CI คือ `confidence_intervals.corpus_chrf` และลายเซ็นคือ `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` บนการ์ดใหม่ทุกใบ การ์ดที่ไม่มีฟิลด์นี้ได้รับการให้คะแนนภายใต้ระบบคะแนนรวมเดิมที่ยกเลิกไปแล้ว (`legacy-composite`) และจะได้รับการตรวจสอบยืนยันตามรูปแบบนั้น |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | เมตริกมาตรฐานที่แสดงควบคู่กับ chrF++ โดยไม่มีการนำมาคำนวณรวมกัน (BLEU คือ `corpus_bleu` ระดับบนสุดของการ์ด; COMET คือ `comet_score` พร้อมด้วย `comet_model` เมื่อมีการคำนวณ) |
| `sacrebleu_signatures` | `object` | ลายเซ็น sacreBLEU ของแต่ละเมตริก sacreBLEU ที่คำนวณได้: `chrf` (คะแนนหลัก), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | ช่วงความเชื่อมั่นแบบบูตสแตรป 95% (95% bootstrap intervals); โดย `corpus_chrf` เป็นของคะแนนหลัก |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **ยกเลิกการใช้งานแล้ว** จะเป็น `null` เสมอบนการ์ดใหม่ การ์ดรุ่นเก่าจะยังคงเก็บค่าเดิมไว้ และส่วนแสดงผลที่ยังคงแสดงคะแนนรวมนี้จะระบุเลเบลเป็น "legacy composite (retired)" |
| `errors` | `number` | รายการที่ล้มเหลว (ข้อผิดพลาดของ API, หมดเวลา ฯลฯ) |
| `avg_latency_seconds` | `number` | เวลาตอบสนองเฉลี่ยจากทุกรายการ |
| `median_latency_seconds` | `number` | มัธยฐานของเวลาตอบสนอง |
| `p95_latency_seconds` | `number` | เวลาตอบสนองที่เปอร์เซ็นไทล์ที่ 95 |

### `by_difficulty`

คะแนนที่จำแนกตามระดับความยาก (difficulty tier) โดยใช้ระดับเป็นคีย์ (`"1"`–`"5"`, `"0"` สำหรับรายการที่ไม่ได้จัดระดับ) ฟิลด์เหล่านี้**ไม่ใช่**ฟิลด์ระดับบนสุด: `avg_chrf` และ `avg_bleu` คือ**ค่าเฉลี่ยต่อประโยค** ของ chrF++ และ BLEU สำหรับรายการในระดับนั้นๆ ในขณะที่ `chrf_plus_plus` และ BLEU ระดับบนสุดเป็นแบบ**ระดับคอร์ปัส** (คำนวณจากทุกเซกเมนต์พร้อมกันในคราวเดียว) ทั้งสองเป็นสถิติคนละประเภทกัน: โดยเฉพาะ BLEU ระดับคอร์ปัสมักมีค่าต่ำกว่าค่าเฉลี่ยของ BLEU ระดับประโยคอย่างมาก ดังนั้นการมีคะแนนหลัก 0.5 ควบคู่กับค่าระดับเทียร์ 10.2 จึงไม่ได้ขัดแย้งกัน ให้เปรียบเทียบระดับเทียร์ระหว่างกันเอง อย่าเปรียบเทียบกับคะแนนหลัก

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

คะแนนแยกตามแหล่งที่มาของรายการ แต่ละ key (เช่น `gold_standard`, `textbook`) มีฟิลด์ metric เดียวกัน

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `score_caveats`

จะมีอยู่เฉพาะเมื่อมีปัจจัยที่จำกัดความหมายของคะแนน แม้คะแนนจะสามารถ
คำนวณได้อย่างถูกต้อง แต่อาจไม่ได้วัดผลตามที่เลเบลของมันระบุไว้
ดังนั้นเงื่อนไขกำกับจึงต้องแสดงควบคู่ไปกับตัวเลขเสมอ: `mt-eval test`, `mt-eval card`,
`mt-eval compare` แดชบอร์ด และหน้าพรีวิว `mt-eval publish` จะพิมพ์ข้อความนี้
ไว้ข้างคะแนนหลัก และ `publish` จะจัดเก็บไว้ที่นี่เพื่อให้ลีดเดอร์บอร์ดนำไปแสดง
ข้อมูลนี้จะไม่เปลี่ยนแปลงคะแนนแต่อย่างใด: คะแนนหลัก chrF++ ยังคงคำนวณตามปกติ
และข้อควรระวังจะระบุถึงสิ่งที่จำกัดคะแนนนั้นหรือจำกัดข้อมูลวินิจฉัยที่แสดงควบคู่กัน

| ฟิลด์ | ชนิด | คำอธิบาย |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` หรือ `near_constant_output` |
| `source` | `string` | ผู้ดำเนินการวัดผล: `nmt-forge` หรือ `mt-eval-harness` |
| `severity` | `string` | `major` (พิจารณาคะแนนหลักควบคู่กับเงื่อนไขนี้) หรือ `minor` |
| `message` | `string` | หนึ่งประโยค ความยาวไม่เกิน 480 อักขระ |

**`train_test_near_twin`** เขียนโดย nmt-forge เมื่อ `nmt-forge export` (หรือ
`evaluate`) ให้คะแนนโมเดล ระบบจะตรวจสอบแถวทดสอบทุกแถวเพื่อดูว่ามีคู่แฝดที่เกือบเหมือนกันทุกประการ
ในข้อมูลการฝึกสอน (training data) หรือไม่ และบันทึกผลลัพธ์ลงในไฟล์ mt-eval ที่สร้างขึ้น
harness จะคัดลอกค่านั้นลงในการ์ด: `near_twin_rows` จาก `n` แถวทดสอบ
มีคู่แฝด (`near_twin_share`) และ `strict_n` แถวไม่มี เมื่อ
มีแถวเหล่านั้นเพียงพอ `strict_corpus_chrf` และ `strict_corpus_chrf_ci`
จะระบุคะแนน chrF++ เฉพาะแถวเหล่านั้น ซึ่งก็คือตัวเลขการสรุปความรู้ทั่วไป (generalization number)
`recall_not_translation` จะเป็น `true` เมื่อมีแถวอย่างน้อยครึ่งหนึ่งที่มีคู่แฝด
ซึ่งในกรณีนี้ แม้คะแนน chrF++ จะได้ 100 ก็เป็นเพียงการวัดว่าโมเดลจำวลี
จากการฝึกสอนได้ดีแค่ไหน ไม่ใช่ความสามารถในการแปล หากการตรวจสอบของ forge ไม่ได้ทำงาน
ข้อควรระวังจะเป็น `minor` และระบุไว้เช่นนั้น การตรวจสอบที่ไม่พบคู่แฝดจะไม่เพิ่มข้อควรระวังใดๆ

**`length_inflation`** วัดผลโดย harness ข้อความนี้จะถูกเพิ่มเมื่อผลลัพธ์เฉลี่ย
มีความยาวมากกว่า 2 เท่าของความยาวอ้างอิง (ขอบเขตการขยายขนาดข้อความของ
[`length_ratio`](/docs/network/specifications/scoring)) หรือเมื่อมีรายการที่ได้รับคะแนนอย่างน้อย
หนึ่งในสี่เป็นเช่นนั้น ตัวอย่าง few-shot ที่รั่วไหล โน้ตข้อความ หรือข้อความที่ซ้ำกัน
จะทำให้เอาต์พุตยาวเกินจริง และคะแนนที่อิงตามข้อมูลอ้างอิงก็จะวัดผลสิ่งเหล่านั้นแทน
ฟิลด์ต่างๆ ประกอบด้วย `mean_length_ratio`, `inflated_entries` จาก `scored_entries`,
`ratio_bound` และ `share_bound`

**`length_deflation`** วัดผลโดย harness เป็นภาพสะท้อนตรงข้ามของ
`length_inflation`: กล่าวคือ เอาต์พุตสั้นกว่าข้อความอ้างอิง**อย่างมาก** จนมีคำตกหล่นหายไป
ข้อความนี้จะถูกเพิ่มเมื่อเอาต์พุตมีความยาวเฉลี่ยน้อยกว่า 0.5 เท่าของความยาว
อ้างอิง (ขอบเขตการตัดทอนข้อความของ
[`length_ratio`](/docs/network/specifications/scoring)) หรือเมื่อมีรายการที่ได้รับคะแนนอย่างน้อย
หนึ่งในสี่เป็นเช่นนั้น ข้อมูลวินิจฉัยบางตัวจะตัดสินเฉพาะคำที่มีอยู่ในเอาต์พุตเท่านั้น
ได้แก่ การยอมรับของ FST และการสลับภาษา (code-switching) ซึ่งระบบที่ละทิ้งคำที่ไม่สามารถ
แปลได้จะได้คะแนนส่วนนี้สูงขึ้น เมื่อการรันมีเมตริกเหล่านี้ตัวใดตัวหนึ่ง ข้อควรระวังจะเป็น
`major` และระบุว่าไม่ควรอ่านค่าเหล่านี้เป็นคุณภาพเมื่อเทียบกับการรันที่แปล
เนื้อหาครบถ้วน คะแนนหลัก chrF++ ให้น้ำหนักกับการจำ (recall) จึงมีการนับคำที่ขาดหายไปด้วย หากไม่มีทั้งสอง
เมตริกดังกล่าว (มีเพียง chrF++ และ exact match เท่านั้น) จะเป็นหมายเหตุระดับ `minor` ฟิลด์ต่างๆ
ประกอบด้วย `mean_length_ratio`, `short_entries` จาก `scored_entries`, `ratio_bound`,
`share_bound` และ `emitted_only_metrics`

**`source_copy`** วัดผลโดย harness ข้อความนี้จะถูกเพิ่มเมื่อผลลัพธ์ที่ได้รับคะแนนอย่างน้อยครึ่งหนึ่ง
เป็นการคัดลอกจากต้นฉบับ (ไม่นำตัวพิมพ์เล็ก-ใหญ่ เครื่องหมายกำกับเสียง และเครื่องหมายวรรคตอนมาพิจารณา)
บรรทัดที่ข้อความอ้างอิงตรงกับต้นฉบับอยู่แล้ว เช่น ชื่อเฉพาะ จะไม่ถูกนำมานับ
เมตริกที่ไม่ได้เปรียบเทียบกับข้อความอ้างอิงอาจยังคงให้คะแนนกับคำที่ถูกคัดลอกมา
ฟิลด์ต่างๆ ประกอบด้วย `copies` จาก `considered_entries`, `copy_share` และ
`share_bound`

**`near_constant_output`** วัดผลโดย harness เกิดจากการสร้างผลลัพธ์เดียว
สำหรับอินพุตที่*แตกต่างกัน*หลายรายการ การเปรียบเทียบเอาต์พุตและต้นฉบับจะไม่พิจารณาตัวพิมพ์เล็ก-ใหญ่
เครื่องหมายวรรคตอน และการเว้นวรรค แต่จะนับเครื่องหมายกำกับเสียง (diacritics) เนื่องจาก
ช่วยแยกแยะความแตกต่างของคำระหว่างสองเอาต์พุต เอาต์พุตจะถือว่าเป็นการซ้ำข้ามต้นฉบับเมื่อมี
ต้นฉบับที่แตกต่างกันอย่างน้อย 3 รายการได้ผลลัพธ์นั้น (หรือ 5 รายการหากมีความยาวหนึ่งหรือสองคำ เนื่องจาก
คำตอบสั้นๆ มีโอกาสเกิดขึ้นซ้ำได้ตามปกติ) เอาต์พุตที่ตรงกับข้อความอ้างอิงของตนเอง
ถือเป็นคำตอบที่ถูกต้องและจะไม่ถูกนำมานับ ข้อควรระวังจะถูกเพิ่มเมื่อการซ้ำ
ครอบคลุมต้นฉบับที่แตกต่างกันอย่างน้อยหนึ่งในสี่ และมีอย่างน้อย 5 รายการขึ้นไป โดยจะมีสถานะ
เป็น `major` เสมอ เมื่อการรันมีเมตริกที่ประเมินเอาต์พุต
โดยไม่เทียบกับข้อความอ้างอิง (การยอมรับของ FST, การสลับภาษา) ข้อความจะระบุชื่อ
เมตริกนั้น: เนื่องจากเมตริกดังกล่าวจะให้คะแนนประโยคที่ถูกต้องทุกครั้งที่ปรากฏขึ้น ฟิลด์ต่างๆ
ประกอบด้วย `repeated_sources` จาก `considered_sources`, `repeat_share`,
`repeated_outputs`, `top_output_sources` และ `top_output_words` (เอาต์พุตที่เกิดซ้ำ
บ่อยที่สุด: จำนวนต้นฉบับที่ได้ผลลัพธ์นี้ และความยาวของมัน), `share_bound`,
`min_repeats`, `min_sources`, `min_sources_short` และ `emitted_only_metrics`
ฟิลด์เหล่านี้เป็นเพียงจำนวนนับเท่านั้น: ข้อควรระวังจะไม่เก็บข้อความของเอาต์พุตโดยตรง

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

ฟิลด์นี้อยู่ในไฟล์ JSON ของรันการ์ดที่จัดเก็บไว้ จึงไม่จำเป็นต้องมีคอลัมน์ในฐานข้อมูล
และไม่ได้เป็นส่วนหนึ่งของ [fingerprint](#fingerprint): โดยเป็นข้อมูลอธิบาย
ผลลัพธ์ ไม่ใช่การทดลอง

---

## `totals`

การติดตามการใช้งาน token และต้นทุนสำหรับการรันทั้งหมด

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `prompt_tokens` | `number` | จำนวน input token ทั้งหมดในทุกการเรียก API |
| `completion_tokens` | `number` | จำนวน output token ทั้งหมด |
| `reasoning_tokens` | `number` | Token ที่ใช้สำหรับการให้เหตุผลแบบ chain-of-thought (ขึ้นอยู่กับ model โดยเป็น 0 สำหรับ model ส่วนใหญ่) |
| `cached_tokens` | `number` | Token ที่ให้บริการจาก prompt cache ของผู้ให้บริการ |
| `total_cost_usd` | `number` | ต้นทุนรวมในหน่วย USD (ตามที่ API รายงาน) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

metadata ของสภาพแวดล้อม runtime สำหรับการทำซ้ำ

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `harness_version` | `string` | เวอร์ชัน harness (สอดคล้องกับ `harness_version` ระดับบนสุด) |
| `harness_git_commit` | `string` | Git commit SHA ของ harness ณ เวลาที่รัน |
| `python_version` | `string` | เวอร์ชัน Python interpreter |
| `sacrebleu_version` | `string` | เวอร์ชัน sacrebleu library (ใช้สำหรับการให้คะแนน chrF++) |
| `os` | `string` | ตัวระบุระบบปฏิบัติการ |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

อาร์เรย์ผลลัพธ์รายรายการ หนึ่ง object ต่อรายการในชุดข้อมูล เรียงตามลำดับ index

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `entry_id` | `integer` | ID ของรายการนี้ใน corpus (ตรงกับ `entries[].id`) |
| `source` | `string` | ข้อความต้นฉบับที่แปล |
| `reference` | `string` | การอ้างอิงมาตรฐาน gold จาก corpus |
| `predicted` | `string` | output จริงของ method |
| `exact_match` | `boolean` | ว่า `predicted` ตรงกับ `reference` อย่างสมบูรณ์หลังการ normalize หรือไม่ |
| `entry_chrf` | `number` | คะแนน chrF++ ระดับประโยคสำหรับรายการนี้ (0–100) |
| `fst_accepted` | `boolean \| null` | ว่าตัววิเคราะห์ FST ยอมรับ output หรือไม่ `null` หากไม่มีการกำหนดค่าตัววิเคราะห์ |
| `fst_analysis` | `string[]` | สตริงการวิเคราะห์ FST สำหรับ output (อาร์เรย์ว่างหากไม่ได้วิเคราะห์หรือถูกปฏิเสธ) |
| `difficulty` | `integer` | ระดับความยากจาก corpus (1–5) |
| `provenance` | `string` | แท็กแหล่งที่มาจาก corpus |
| `latency_seconds` | `number` | เวลาตอบสนองสำหรับรายการแต่ละรายการ |
| `usage` | `object` | การใช้งาน token รายรายการ: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | ข้อความ error หากรายการนี้ล้มเหลว `null` เมื่อสำเร็จ |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `run_card_hash` | `string` | SHA-256 hash ของ run card JSON ทั้งหมด โดยตั้งค่าฟิลด์ `run_card_hash` เป็น `""` ระหว่างการ hash |

นี่คือตราประทับสำหรับตรวจจับการแก้ไข leaderboard จะคำนวณ hash นี้ใหม่เมื่อส่งและปฏิเสธ card ที่ไม่ตรงกัน

**การคำนวณ hash:**

1. Serialize run card เป็น JSON โดยตั้งค่า `run_card_hash` เป็น `""`
2. คำนวณ SHA-256 ของสตริงที่ serialize แล้ว
3. ตั้งค่า `run_card_hash` เป็น hex digest ที่ได้

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[การเจาะลึกรายการ]
run card ที่เผยแพร่แล้วยังเติมข้อมูลในตาราง `run_card_entries` Supabase ซึ่งเก็บผลลัพธ์รายการสำหรับการวิเคราะห์เชิงลึกบน leaderboard ตารางนี้จะถูกเติมข้อมูลโดยอัตโนมัติระหว่าง `mt-eval publish`
:::

---

## ดูเพิ่มเติม

- [การประเมินผล MT](/docs/network/leaderboard/rules) — ภาพรวม คุณค่าของลีดเดอร์บอร์ด และแนวทางเมธอดที่ดี/ไม่ดี
- [Eval Harness](/docs/network/specifications/harness) — วิธีการรันการประเมินผลและสร้างรันการ์ด
- [ชุดข้อมูลการประเมินผล](/docs/network/leaderboard/datasets) — รูปแบบชุดข้อมูล, EDTeKLA, FLORES+
- [การสร้างเมธอด](/docs/network/specifications/methods) — อินเทอร์เฟซของเมธอดและข้อกำหนดของเมธอดการ์ด
- [ลีดเดอร์บอร์ดเมธอด](https://champollion.dev/leaderboard) — คะแนนเบนช์มาร์กแบบสด
- [ข้อกำหนดเบนช์มาร์ก](/docs/network/specifications/benchmark) — โปรโตคอลการประเมินผล รูปแบบคอร์ปัส สคีมาของรันการ์ด
- [ข้อกำหนดการให้คะแนน](/docs/network/specifications/scoring) — แหล่งข้อมูลอ้างอิงหลัก (SSOT) สำหรับเมตริกและวิธีการให้คะแนนการรัน
