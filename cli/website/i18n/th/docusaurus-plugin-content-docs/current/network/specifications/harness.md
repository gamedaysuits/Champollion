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

> **สรุปสำหรับผู้บริหาร** หน้านี้ครอบคลุมการติดตั้ง การกำหนดค่า และการใช้งาน MT evaluation harness — เครื่องมือที่ใช้เปรียบเทียบประสิทธิภาพวิธีการแปลกับ corpus มาตรฐานและสร้าง run card ที่มีคะแนน สำหรับนิยามอย่างเป็นทางการของ metric, schema และโปรโตคอลการประเมิน โปรดดูที่ [Benchmark Specification](/docs/network/specifications/benchmark)

harness รันการทดลองแปลและสร้าง run card โดยจัดการการสร้าง prompt, การเรียก API, การให้คะแนน และการบันทึกผลลัพธ์ — คุณเพียงแค่จัดเตรียม dataset และ model

## การติดตั้ง

**ข้อกำหนด:** Python 3.10+

```bash
pip install mt-eval-harness
```

การดำเนินการนี้จะติดตั้งคำสั่ง `mt-eval`

## การใช้งาน

```bash
mt-eval run --corpus path/to/dataset.json
```

การดำเนินการนี้จะรันทุก entry ใน corpus ผ่าน model ที่กำหนดค่าไว้ (หรือ method plugin), ให้คะแนน output และเขียนไฟล์ run card JSON ไปยัง output directory

## CLI Flags

### `mt-eval run`

| Flag | Required | Default | คำอธิบาย |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | พาธไปยังไฟล์ corpus (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | ไฟล์ข้อความคู่ขนาน (รูปแบบ FLORES+, WMT) |
| `-m, --model` | — | `gemini-pro` | model slug (ชื่อย่อหรือ OpenRouter ID แบบเต็ม) ค้นหาผ่าน `shared/model-aliases.json` ใช้เครื่องหมายจุลภาคคั่นสำหรับการรันหลาย model |
| `-d, --dataset` | — | `all` | ตัวกรอง dataset: `all`, ชื่อ segment หรือช่วง ID |
| `--ids` | — | — | ID ของ entry ที่คั่นด้วยเครื่องหมายจุลภาคสำหรับการประเมิน |
| `--source-lang` | — | `English` | ชื่อภาษาต้นทาง |
| `--target-lang` | — | — | ชื่อภาษาปลายทาง |
| `-p, --prompt` | — | `naive` | เวอร์ชัน prompt (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | พาธไปยังไฟล์ข้อความ coaching prompt |
| `--coaching` | — | — | ข้อความ coaching แบบ inline (string ที่อยู่ในเครื่องหมายคำพูด) |
| `--method` | — | — | พาธไปยัง method plugin directory (ประกอบด้วย `method.json` + Python module) |
| `--method-card` | — | — | พาธไปยัง method card JSON สำหรับ metadata ของ leaderboard |
| `--fst-retries` | — | `0` | จำนวนครั้งที่ลองใหม่สำหรับ FST (เฉพาะ default LLM method เท่านั้น) |
| `--skip-fst` | — | `false` | ข้าม FST quality gate ทั้งหมด |
| `--tools` | — | `false` | เปิดใช้งานโหมด tool-calling |
| `--tools-list` | — | — | ชื่อ tool ที่คั่นด้วยเครื่องหมายจุลภาค |
| `--max-tool-rounds` | — | `8` | จำนวนรอบ tool-calling สูงสุดต่อ entry |
| `--hooks` | — | — | ชื่อ hook หลังการแปล |
| `--style-profile` | — | — | พาธไปยัง style profile JSON เปิดใช้งาน metric ความสอดคล้องของรูปแบบการเขียน (เพื่อให้ข้อมูลเท่านั้น — ไม่นับรวมในคะแนน composite เลย ดูที่ [§ Writing-style and register metrics](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | จำนวน entry ต่อการเรียก API |
| `-c, --concurrency` | — | `8` | การเรียก API แบบขนาน |
| `--max-tokens` | — | `32768` | จำนวน token สูงสุดต่อการเรียก API |
| `--temperature` | — | `0.0` | อุณหภูมิการสุ่ม (0.0 = กำหนดแน่นอน) |
| `--no-cache` | — | `false` | ปิดใช้งานการ cache response |
| `--cache-dir` | — | `eval/cache/harness` | พาธของ cache directory |
| `-o, --output-dir` | — | `eval/logs/harness` | output directory สำหรับ run card และ log |
| `-n, --name` | — | — | ชื่อ run ที่มนุษย์อ่านได้ |
| `--dry-run` | — | `false` | ตรวจสอบการกำหนดค่าโดยไม่เรียก API |
| `--champollion-config` | — | — | พาธไปยัง `champollion.config.json` |
| `--champollion-cards-dir` | — | — | directory ของ language card |
| `--target-lang-code` | — | — | รหัสภาษา BCP-47 |

### คำสั่งย่อยทั้งหมด

คำสั่งย่อยระดับบนสุดทั้งสิบแปดคำสั่ง สร้างขึ้นจาก `mt_eval_harness/cli.py`
เมื่อวันที่ 2026-08-01 ก่อนหน้านั้นส่วนนี้ได้แสดงรายการไว้เจ็ดคำสั่ง และอีกหกคำสั่ง —
รวมถึง `node` ซึ่งเป็นโหนดการให้คะแนนของผู้จัดงานแบบอธิปไตย (sovereign organizer scoring node) — ไม่ได้ถูกบันทึกไว้
**ทั้งที่นี่และในคู่มือ harness**

**รันและให้คะแนน**

| คำสั่งย่อย | หน้าที่ |
|---|---|
| `mt-eval run` | ดำเนินการรันการแปล (แฟล็กตามด้านบน) |
| `mt-eval test <log>` | วิเคราะห์บันทึกการรันที่เสร็จสมบูรณ์ |
| `mt-eval compare <logs…>` | เปรียบเทียบบันทึกการรันหลายรายการ |
| `mt-eval dashboard <logs…>` | สร้างแดชบอร์ด HTML แบบอินเทอร์แอคทีฟ |
| `mt-eval card <run-card>` | พิมพ์การ์ดการรันในรูปแบบที่อ่านง่าย (pretty-print) |

**ค้นหาวิธีการที่เหมาะสม**

| คำสั่งย่อย | หน้าที่ |
|---|---|
| `mt-eval recommend <src> <tgt>` | คำแนะนำวิธีการสำหรับคู่ภาษา — ความพร้อมใช้งานพร้อม **หลักฐานอ้างอิง** ไม่ใช่แค่การจัดอันดับเปล่าๆ |
| `mt-eval corpora --source X --target Y` | แสดงรายการคลังข้อมูลการประเมิน (eval corpora) ที่มีให้สำหรับคู่ภาษา |
| `mt-eval list models\|prompts\|datasets` | แสดงรายการทรัพยากรที่มีอยู่ |

**มีส่วนร่วม**

| คำสั่งย่อย | หน้าที่ |
|---|---|
| `mt-eval publish <report>` | ส่ง TestReport ไปยังกระดานผู้นำ (leaderboard) |
| `mt-eval queue` | รันคิวการประมวลผลของชุมชนที่อยู่บนสุดด้วยคีย์ของคุณเอง — ดู [Contributing Compute](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | แพ็กเกจ TestReport เป็นปลั๊กอินวิธีการของ champollion |
| `mt-eval generate-plugin` | นามแฝง (Alias) สำหรับ `export` |
| `mt-eval export-config` | สร้างสนิปเปต `champollion.config.json` จาก TestReport |

**การแข่งขัน และการจัดการแข่งขันด้วยตัวคุณเอง**

| คำสั่งย่อย | หน้าที่ |
|---|---|
| `mt-eval contest` | จัดการการแข่งขันการประเมิน — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | ร่มสำหรับงานที่ใช้ร่วมกันหลายคู่ภาษา (Multi-pair shared-task edition umbrella): หนึ่งแถวจะจัดกลุ่มการแข่งขัน N รายการต่อคู่ภาษาของรุ่นสไตล์ AmericasNLP และนำค่าเริ่มต้นของนโยบายมาใช้ **เฉพาะการจัดกลุ่มและค่าเริ่มต้นเท่านั้น — ทุกเกต (gate) ยังคงเป็นแบบต่อการแข่งขัน** |
| `mt-eval node` | **โหนดการให้คะแนนของผู้จัดงาน** ดึงข้อมูลเข้า, ตรวจสอบเกตด้วยตัวคัดเลือกสาธารณะ, อนุมัติตามนโยบายการแข่งขัน, ให้คะแนนเทียบกับ **ข้อมูลอ้างอิงลับที่ผู้จัดงานถือครอง**, เผยแพร่เฉพาะคะแนน นี่คือคำสั่งที่อยู่เบื้องหลัง [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) และ [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node) — คลังข้อมูลจะไม่ถูกส่งออกจากเครื่องของผู้จัดงานเลย |

`mt-eval node` มีคำสั่งย่อยของตัวเองสิบเจ็ดคำสั่ง รวมถึงช่องทาง airgap
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) และ
พิธีการดูแลแบบ M-of-N (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`) รัน `mt-eval node --help`; กลไก
อธิปไตย (sovereignty) ได้อธิบายไว้ในสองหน้าที่ลิงก์ไว้ด้านบน

**การตั้งค่า**

| คำสั่งย่อย | หน้าที่ |
|---|---|
| `mt-eval setup` | ติดตั้งการพึ่งพาเสริม (COMET neural metric, FST runtime) |
| `mt-eval logout` | ลบข้อมูลรับรองการตรวจสอบสิทธิ์ที่จัดเก็บไว้ |

### ตัวอย่าง

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
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

ทุกการทดลองจะสร้าง **run card** — เอกสาร JSON ที่มีข้อมูลครบในตัวเอง โครงสร้างระดับบนสุด:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
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

ดูที่ [Run Card Specification](/docs/network/specifications/run-card) สำหรับ schema แบบเต็มพร้อมเอกสารประกอบทุก field

:::info[Schema อ้างอิงหลัก]
[Benchmark Specification](/docs/network/specifications/benchmark) คือแหล่งข้อมูลเดียวที่เชื่อถือได้สำหรับ schema ของ run card สำหรับนิยามของ metric, น้ำหนัก composite และระดับคุณภาพ โปรดดูที่ [Scoring Specification](/docs/network/specifications/scoring) หน้านี้อธิบายวิธีใช้งาน harness ส่วน spec กำหนดความหมายของผลลัพธ์
:::

### บล็อกสำคัญ

**`dataset`** — ระบุว่าใช้ dataset ใด รวมถึง content hash เพื่อผูกผลลัพธ์กับเวอร์ชันที่เฉพาะเจาะจง:

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

**`scores`** — metric รวมสำหรับการรัน:

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

**`totals`** — การติดตามการใช้ token และค่าใช้จ่าย:

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

## Writing-style and register metrics (informational) {#writing-style-and-register-metrics-informational}

harness สามารถประเมินว่าการแปลตรงกับ **register** และ **รูปแบบการเขียน** เป้าหมายหรือไม่ ผ่าน metric plugin `WritingStyleConsistency` (`mt_eval_harness/plugins/writing_style.py`) การแปลอาจถูกต้องทางภาษาศาสตร์แต่ใช้ register ผิด — ภาษาไม่เป็นทางการในเอกสารทางกฎหมาย หรือภาษาทางการในเนื้อหาการตลาด — และ string metric จะไม่สังเกตเห็น แต่ metric เหล่านี้จะตรวจพบ

**สิ่งที่วัด (ต่อ entry):**

| Metric | Scale | ความหมาย |
|--------|-------|---------|
| `style_register_match` | boolean | output ตรงกับ register ที่คาดหวังหรือไม่? เป้าหมายมาจาก field `register` ของ corpus entry (ดู [Benchmark Spec §2.6](/docs/network/specifications/benchmark)) หรือจาก style profile |
| `style_sentence_length_ratio` | float | ความยาวประโยคเฉลี่ยที่คาดการณ์เทียบกับ reference (1.0 = ตรงกัน; ค่าที่เบี่ยงเบน = style drift) |
| `style_formality_score` | 0.0–1.0 | การมีอยู่ของ marker ทางการ/ไม่เป็นทางการ (สรรพนาม T–V, คำย่อ, …) โดยใช้ทรัพยากร marker ตามภาษา |

**ค่ารวม:** `style_consistency_rate` — สัดส่วนของ entry ที่ไม่พบความไม่ตรงกันของ register

เปิดใช้งานเป้าหมายที่กำหนดเองด้วย `--style-profile path/to/profile.json` (เช่น brand-voice profile) หากไม่มี plugin จะใช้ metadata `register` ของแต่ละ corpus entry แทนเมื่อมีข้อมูล

:::caution[ขอบเขตที่ชัดเจน]
metric เหล่านี้มีไว้เพื่อ**ให้ข้อมูลเท่านั้น** — ไม่มีส่วนเกี่ยวข้องกับคะแนน composite และการตรวจจับความเป็นทางการใช้วิธีอิงตัวบ่งชี้ (heuristic) ไม่ใช่การตัดสินจากการเรียนรู้ ให้ใช้เป็นตัวตรวจจับความเบี่ยงเบนของการรักษาระดับภาษา ไม่ใช่คำตัดสินคุณภาพของสไตล์
:::

---

## Fingerprint vs Run Card Hash {#fingerprint-vs-run-card-hash}

harness สร้าง hash ที่แตกต่างกันสองแบบ โดยแต่ละแบบมีวัตถุประสงค์ต่างกัน:

### Fingerprint

**fingerprint** ตอบคำถามว่า: *"การรันนี้สามารถทำซ้ำได้หรือไม่?"*

มันสร้าง hash จากการรวมกันของ input ที่กำหนดการกำหนดค่าการทดลอง — ไม่ใช่ output:

- Dataset SHA-256
- Model slug
- Condition label
- System prompt SHA-256
- Temperature
- Harness version

การรันสองครั้งที่มี fingerprint เหมือนกันใช้การตั้งค่าเดียวกัน ผลลัพธ์ควรเปรียบเทียบได้ (ยกเว้นความไม่แน่นอนของ API)

### Run Card Hash

**run card hash** ตอบคำถามว่า: *"ไฟล์ผลลัพธ์เฉพาะนี้ถูกแก้ไขหรือไม่?"*

มันคือ SHA-256 ของ run card JSON ทั้งหมด (ยกเว้น field `run_card_hash` เอง) หากมี field ใดเปลี่ยนแปลง — คะแนน, timestamp, output เดียว — hash จะเสีย

:::info[เลือกใช้อะไรในสถานการณ์ใด]
ใช้ **fingerprint** เพื่อจัดกลุ่ม run ที่เปรียบเทียบกันได้ (experiment เดียวกัน ต่าง execution) ใช้ **run card hash** เพื่อตรวจสอบความสมบูรณ์ของไฟล์ผลลัพธ์เฉพาะรายการ
:::

---

## การเผยแพร่ไปยัง Leaderboard

หลังจากรันเสร็จสมบูรณ์ ให้ใช้ `mt-eval publish` เพื่อส่ง run card:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

หากไม่ได้ระบุ `--method-card` ระหว่างการรัน `mt-eval publish` จะเปิด interactive wizard (`method_card_wizard.py`) ที่จะแนะนำคุณในการอธิบาย method (ชื่อ, class, tool ที่ใช้ ฯลฯ) output ของ wizard จะถูกฝังใน run card ก่อนการส่ง

### การตรวจสอบด้วยตนเอง

Run card จะถูกบันทึกเป็นไฟล์ JSON ในไดเรกทอรีผลลัพธ์ (`eval/logs/harness/` โดยค่าเริ่มต้น) — ตรวจสอบที่นั่นก่อนเผยแพร่ `mt-eval publish` คือเส้นทางการส่ง ไม่มีการรับ run card ผ่าน PR

:::note[Submission API และการอัปโหลดผ่านเว็บยังไม่พร้อมใช้งาน]
endpoint `POST https://champollion.dev/api/leaderboard/submit` และ UI สำหรับอัปโหลดไปยัง Leaderboard อยู่ในแผนงานแต่**ยังไม่ได้พัฒนา** จนกว่าจะพร้อมใช้งาน เส้นทางการส่งที่ใช้งานได้เพียงทางเดียวคือ `mt-eval publish`
:::

:::warning[การตรวจสอบของ Leaderboard]
Leaderboard จะตรวจสอบ run card ที่ส่งมากับ dataset registry การส่งที่อ้างอิง dataset ที่ไม่รู้จัก หรือมี `run_card_hash` ที่เสียหาย จะถูกปฏิเสธ
:::

:::danger[ห้ามนำข้อมูลประเมินผลไปใช้ฝึกโมเดล]
หากวิธีการของคุณได้เห็นชุดข้อมูลประเมินผลระหว่างการพัฒนา ไม่ว่าจะเป็นข้อมูลฝึก, ตัวอย่าง few-shot, รายการในพจนานุกรม หรือเนื้อหาสำหรับ prompt engineering — การส่งของคุณจะถูก**ตัดสิทธิ์** ดูที่ [MT Evaluation](/docs/network/leaderboard/rules) สำหรับเกณฑ์ที่ทำให้วิธีการดีหรือไม่ดี
:::

---

## ดูเพิ่มเติม

- [MT Evaluation](/docs/network/leaderboard/rules) — ภาพรวม, คุณค่าของ leaderboard และแนวทาง method ที่ดีและไม่ดี
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — รูปแบบ dataset, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — JSON schema แบบเต็ม
- [Building a Method](/docs/network/specifications/methods) — method interface สำหรับการสร้าง method ที่ประเมินได้
- [Method Leaderboard](https://champollion.dev/leaderboard) — คะแนน benchmark แบบ live
- [Benchmark Specification](/docs/network/specifications/benchmark) — โปรโตคอลการประเมิน, รูปแบบ corpus, run card schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT สำหรับ metric, น้ำหนัก composite และระดับคุณภาพ
