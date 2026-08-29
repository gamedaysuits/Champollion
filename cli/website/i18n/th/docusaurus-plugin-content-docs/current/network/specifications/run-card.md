---
sidebar_position: 4
title: "ข้อกำหนดการ์ดการรัน"
---

# ข้อกำหนด Run Card

> **สรุปสาระสำคัญ.** Run card คือหน่วยพื้นฐานของการ benchmarking — เอกสาร JSON ที่บันทึกการกำหนดค่าทั้งหมด ผลลัพธ์รายรายการ และคะแนนรวมของการรันการประเมินหนึ่งครั้ง หน้านี้อธิบาย schema, ฟิลด์, กลไก fingerprinting และโครงสร้างคะแนน ดู [Benchmark Specification](/docs/network/specifications/benchmark) สำหรับนิยามที่เป็นมาตรฐาน

Run card คือบันทึกสมบูรณ์ของการรันการประเมินครั้งเดียว ประกอบด้วยทุกสิ่งที่จำเป็นสำหรับการทำความเข้าใจ การทำซ้ำ และการตรวจสอบการทดลอง ได้แก่ การกำหนดค่า คะแนน ผลลัพธ์รายรายการ การใช้งาน token และ metadata ของสภาพแวดล้อม

**เวอร์ชัน Schema:** 2.0

:::info[Schema อ้างอิง]
[Benchmark Specification](/docs/network/specifications/benchmark) คือแหล่งข้อมูลหลักสำหรับ schema ของ run card สำหรับนิยามของ metric, น้ำหนักแบบผสม และระดับคุณภาพ ดูได้ที่ [Scoring Specification](/docs/network/specifications/scoring) หน้านี้บันทึกการใช้งานในปัจจุบัน
:::

---

## ฟิลด์ระดับบนสุด

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 ที่สร้างขึ้นเมื่อเริ่มต้นการรัน |
| `harness_version` | `string` | Semantic version ของ harness ที่สร้าง card นี้ (เช่น `2.0`) |
| `model_slug` | `string` | Model slug ที่ใช้สำหรับการรัน (เช่น `google/gemini-3.1-pro`) |
| `model_id` | `string` | ตัวระบุ model ที่ได้รับการ resolve คืนมาจาก API (เช่น `gemini-3.1-pro-001`) |
| `condition` | `string` | ป้ายกำกับการทดลอง (เช่น `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | timestamp UTC แบบ ISO 8601 เมื่อการรันเริ่มต้น |
| `elapsed_seconds` | `number` | ระยะเวลา wall-clock ของการรันทั้งหมด |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
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

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `api_provider` | `string` | ชื่อผู้ให้บริการ API (เช่น `openrouter`) |
| `temperature` | `number` | อุณหภูมิการสุ่มตัวอย่าง (sampling temperature) |
| `max_tokens` | `number` | จำนวน token สูงสุดต่อ completion |
| `batch_size` | `number` | จำนวนรายการต่อ batch แบบ concurrent |
| `concurrency` | `number` | จำนวนคำขอ API แบบขนานสูงสุด |
| `coaching_file` | `string` | เส้นทางไปยังไฟล์ coaching prompt หากมีการใช้งาน |
| `method_path` | `string` | เส้นทางไปยังไดเรกทอรี method plugin หากมีการใช้งาน |
| `fst_retries` | `number` | จำนวนครั้งที่พยายาม retry ของ FST |

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
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

ทุกฟิลด์ใช้ **camelCase** และเป็นไปตาม schema MethodConfig แบบ canonical (ดู [การสร้าง Method](/docs/network/specifications/methods))
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

| Component | คำอธิบาย |
|-----------|-------------|
| `dataset_sha256` | Hash ของไฟล์ชุดข้อมูล |
| `model_slug` | Model ที่ใช้ |
| `condition` | ป้ายกำกับเงื่อนไขการทดลอง |
| `system_prompt_sha256` | Hash ของ system prompt |
| `temperature` | อุณหภูมิการสุ่มตัวอย่าง (sampling temperature) |
| `harness_version` | เวอร์ชัน harness |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
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

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `total` | `number` | จำนวนรายการทั้งหมดที่ประเมิน |
| `exact_matches` | `number` | รายการที่ output ตรงกับมาตรฐาน gold อย่างสมบูรณ์ |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | รายการที่ตัววิเคราะห์ FST ยอมรับ output |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0.0–1.0) `null` หากไม่มีการใช้ตัววิเคราะห์ FST |
| `chrf_plus_plus` | `number` | คะแนน chrF++ ระดับ corpus (0–100) |
| `errors` | `number` | รายการที่ล้มเหลว (API error, timeout เป็นต้น) |
| `avg_latency_seconds` | `number` | เวลาตอบสนองเฉลี่ยของทุกรายการ |
| `median_latency_seconds` | `number` | เวลาตอบสนองมัธยฐาน |
| `p95_latency_seconds` | `number` | เวลาตอบสนองเปอร์เซ็นไทล์ที่ 95 |

### `by_difficulty`

คะแนนแยกตามระดับความยาก แต่ละ key (จำนวนเต็ม 1–5) มีฟิลด์ metric เดียวกับคะแนนระดับบนสุด

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
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

- [การประเมิน MT](/docs/network/leaderboard/rules) — ภาพรวม คุณค่าของ leaderboard และแนวทาง method ที่ดีและไม่ดี
- [Eval Harness](/docs/network/specifications/harness) — วิธีรันการประเมินและสร้าง run card
- [ชุดข้อมูลการประเมิน](/docs/network/leaderboard/datasets) — รูปแบบชุดข้อมูล, EDTeKLA, FLORES+
- [การสร้าง Method](/docs/network/specifications/methods) — อินเทอร์เฟซ method และข้อกำหนด method card
- [Method Leaderboard](https://champollion.dev/leaderboard) — คะแนน benchmark แบบ live
- [Benchmark Specification](/docs/network/specifications/benchmark) — โปรโตคอลการประเมิน รูปแบบ corpus และ schema ของ run card
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT สำหรับ metric น้ำหนัก composite และระดับคุณภาพ
