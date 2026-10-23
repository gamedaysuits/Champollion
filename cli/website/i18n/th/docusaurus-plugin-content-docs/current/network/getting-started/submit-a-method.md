---
sidebar_position: 1
title: "ส่ง Method"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: cookbook
  - label: "Measurement rules"
    to: /docs/agents/measurement
    kind: guide
---

# ส่ง Method

> **สรุปสำหรับผู้บริหาร** คู่มือเริ่มต้นแบบทีละขั้นตอนสำหรับการส่ง benchmark run แรกของคุณไปยัง leaderboard ติดตั้ง harness รันกับชุดข้อมูล ตรวจสอบ run card และเผยแพร่ ใช้เวลาเพียง 10 นาทีหากคุณมี API key

คู่มือนี้จะพาคุณผ่านขั้นตอนการส่ง benchmark run แรกไปยัง Network leaderboard

---

## ข้อกำหนดเบื้องต้น

- **Python 3.11+**
- **API key ของ OpenRouter** (หรือเทียบเท่าสำหรับผู้ให้บริการโมเดลของคุณ)
- **วิธีการแปล** — สิ่งใดก็ตามที่สามารถแปลข้อความต้นฉบับได้

```bash
# Install the eval harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

---

## ขั้นตอนที่ 1: รัน Harness

Harness จะให้คะแนน method ของคุณเทียบกับชุดข้อมูลมาตรฐาน:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name
```

| แฟล็ก | การทำงาน |
|---|---|
| `--corpus` | พาธไฟล์คลังข้อมูลหรือ id ของคลังข้อมูลที่ลงทะเบียนไว้ (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug ของโมเดลแบบตรงกันทุกประการ — id เต็มของ OpenRouter (เช่น `google/gemini-3.1-pro-preview`); ระบบจะปฏิเสธชื่อย่อ (alias) และ floating id (`…-latest`) หากใช้ร่วมกับ `--method <plugin dir>` จะเป็นโมเดลที่ส่งต่อไปยังปลั๊กอินของคุณในฐานะ `config.method_model` (ตามรูปแบบการตั้งชื่อใดก็ตามที่ปลั๊กอินของคุณใช้) |
| `-n, --name` | ป้ายกำกับที่มนุษย์อ่านเข้าใจได้สำหรับการรันของคุณ (จะปรากฏบนลีดเดอร์บอร์ด) |
| `--temperature` | Sampling temperature (ค่าเริ่มต้น `0.0`: แบบกำหนดผลลัพธ์แน่นอน ซึ่งเป็นค่าเริ่มต้นเดียวใน `shared/model-defaults.json`) |
| `--publish` | เผยแพร่การ์ดผลการรันไปยังลีดเดอร์บอร์ดเมื่อการรันเสร็จสิ้น |

Harness จะสร้าง **run card** — ไฟล์ JSON แบบ self-contained ที่มีคะแนน, hash ของชุดข้อมูล, model slug และ cryptographic fingerprint ที่เชื่อมโยงผลลัพธ์กับการกำหนดค่าการทดลองที่แน่นอน

---

## ขั้นตอนที่ 2: ตรวจสอบ Run Card ของคุณ

การรันแต่ละครั้งจะเขียนไฟล์สองไฟล์ลงใน `eval/logs/harness/` ได้แก่ บันทึกการรัน `<run-id>.json`
และรายงานที่ได้รับการให้คะแนนแล้ว `<run-id>_report.json` รายงานนี้คือสิ่งที่คุณต้องเผยแพร่
ตรวจสอบรายงานก่อนดำเนินการ:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

ฟิลด์สำคัญในบล็อก `overall` ของรายงาน:
- `corpus_chrf` — chrF++ ระดับคลังข้อมูล (0–100) ซึ่งเป็นเมตริกหลักและการจัดอันดับ โดยมีช่วงความเชื่อมั่น (CI) แบบ bootstrap 95% คือ `confidence_intervals.corpus_chrf` และลายเซ็น sacreBLEU คือ `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) และ `primary_metric`
  (`"chrf_plus_plus"`) — มาตรฐานที่ใช้ในการให้คะแนนรายงาน
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — เมตริกมาตรฐานอื่นๆ ซึ่งแสดงอยู่ข้างๆ chrF++ และไม่นำมารวมกันเด็ดขาด
- `exact_match_rate` — ค่าการวินิจฉัย: สัดส่วนของการแปลที่สมบูรณ์แบบ
- `confidence_intervals` — ช่วงความเชื่อมั่นแบบ bootstrap สำหรับเมตริกด้านบน
- `total_cost_usd` — ค่าใช้จ่ายในการรัน (`null` เมื่อโมเดลไม่มีการระบุราคาเผยแพร่ไว้ เช่น โมเดลภายในเครื่อง และจะไม่รายงานเป็น $0 เด็ดขาด)

รายงานยังบันทึกสิ่งที่บอกกับโมเดลไว้ในรูปแบบพอยน์เตอร์
(`instructions`: ชื่อไฟล์ coaching และ SHA-256, SHA-256 ของ system prompt,
และตำแหน่งของข้อความเต็ม ซึ่งก็คือบันทึกการรันบนเครื่องของคุณ) การ์ดการรัน
ที่จะส่งไปยังลีดเดอร์บอร์ดจะถูกประกอบขึ้นจากรายงานนี้ โดยจะเพิ่ม method card
และลายนิ้วมือสำหรับการทำซ้ำ (reproducibility fingerprint) เข้าไปด้วย พร้อมทั้งขึ้นต้นด้วย
chrF++ และ CI เดียวกันนี้ ค่า `composite` และ `quality_tier` ของการ์ดจะเป็น `null` เนื่องจากทั้งสอง
[เลิกใช้งานแล้ว](/docs/network/specifications/scoring#how-runs-are-scored) (รายงานที่
เขียนขึ้นก่อนหน้ามาตรฐานอาจมี `published_composite` ซึ่งเป็นค่าผสมแบบเก่า เลิกใช้งานแล้ว และไม่นำมาเปรียบเทียบกับ chrF++)
`mt-eval publish <report> --dry-run` จะแสดงผลการ์ดตรงตามรูปแบบที่จะเผยแพร่จริง
ดูสคีมาได้ที่ [ข้อกำหนด Run Card](/docs/network/specifications/run-card)

---

## ขั้นตอนที่ 3: ส่ง

การเผยแพร่จะเขียนข้อมูลไปยังลีดเดอร์บอร์ด**จริง (live)** ดังนั้นจึงต้องระบุ
`--prod` อย่างชัดเจน — หากไม่มี harness จะปฏิเสธและแจ้งให้คุณทราบ พรีวิวดูก่อน:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

หากต้องการเผยแพร่โดยตรงจากการรัน ให้เพิ่ม `--publish --prod` ใน `mt-eval run` หากขั้นตอนการ
เผยแพร่ล้มเหลว คะแนนของการรันจะยังคงถูกบันทึกไว้ และ harness จะแสดงคำสั่งสำหรับลองใหม่อย่างแม่นยำ
การตั้งค่า `MT_EVAL_ALLOW_PROD=1` ในสภาพแวดล้อมจะเทียบเท่ากับ `--prod` สำหรับสคริปต์

:::note[API สำหรับส่งข้อมูลและการอัปโหลดผ่านเว็บยังไม่เปิดใช้งาน]
เอนด์พอยต์ `POST https://champollion.dev/api/leaderboard/submit` และ UI
สำหรับอัปโหลดขึ้นลีดเดอร์บอร์ดอยู่ในแผนงานแล้วแต่**ยังไม่ได้พัฒนา** จนกว่าจะเปิดให้ใช้งาน
ช่องทางเดียวที่สามารถส่งข้อมูลได้คือ `mt-eval publish` (ไม่มีการรับส่งผ่าน pull request)
:::

---

## ขั้นตอนถัดไป

1. การส่งของคุณจะได้รับการตรวจสอบความถูกต้อง (แฮชของชุดข้อมูล, ความสมบูรณ์ของการ์ดผลการรัน)
2. ผลลัพธ์จะปรากฏบนลีดเดอร์บอร์ดในฐานะ **Self-benchmarked** (ระดับความน่าเชื่อถือ 1)
3. สถานะ **Champollion Verified** ได้มาจากการให้คะแนนผลลัพธ์ที่คุณส่งใหม่อีกครั้งเทียบกับคลังข้อมูลที่ตรึงค่า SHA ไว้ เครื่องมือให้คะแนนซ้ำเป็นคำสั่งของผู้ดูแลที่สั่งรันด้วยตนเอง ไม่มีระบบใดสั่งรันเมื่อมีการส่งและไม่มีการตั้งเวลาทำงาน ดังนั้นในปัจจุบัน ทุกแถวจึงยังคงเป็น Self-benchmarked ([ระดับการยืนยัน](/docs/network/leaderboard/rules#verification-tiers))
4. ตำแหน่งบนลีดเดอร์บอร์ดแบบเปิดไม่ได้ทำให้สิทธิ์ใดๆ ถูกโอนย้าย สิทธิ์ในวิธีการจะโอนย้ายภายใต้ข้อกำหนดรางวัลที่ระบุไว้ของการแข่งขันแบบปิด ซึ่งเผยแพร่ก่อนที่จะมีใครเข้าร่วมเท่านั้น ([ความเป็นเจ้าของและข้อกำหนด](/docs/network/sovereignty/ownership-transfer))

---

## ดูเพิ่มเติม

- [Harness Usage](/docs/network/specifications/harness) — เอกสารอ้างอิง CLI แบบเต็ม
- [Leaderboard Rules](/docs/network/leaderboard/rules) — เกณฑ์การส่งและนโยบายป้องกันการโกง
- [Building a Method](/docs/network/specifications/methods) — โปรโตคอล TranslationMethod
- [Datasets](/docs/network/leaderboard/datasets) — ชุดข้อมูลสำหรับการประเมินที่มีอยู่
