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
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
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
pip install mt-eval-harness
```

---

## ขั้นตอนที่ 1: รัน Harness

Harness จะให้คะแนน method ของคุณเทียบกับชุดข้อมูลมาตรฐาน:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Flag | หน้าที่ |
|---|---|
| `--corpus` | พาธของไฟล์ corpus หรือ corpus id ที่ลงทะเบียนไว้ (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Model slug — ชื่อย่อ (เช่น `gemini-pro`) หรือ OpenRouter ID แบบเต็ม |
| `-n, --name` | ป้ายชื่อที่อ่านได้สำหรับ run ของคุณ (แสดงบน leaderboard) |
| `--temperature` | Sampling temperature (ค่าต่ำ = ผลลัพธ์แน่นอนกว่า) |
| `--fst-retries` | ไม่บังคับ: จำนวนครั้งที่ลองใหม่สำหรับ FST |
| `--publish` | เผยแพร่ run card ไปยัง leaderboard เมื่อ run เสร็จสิ้น |

Harness จะสร้าง **run card** — ไฟล์ JSON แบบ self-contained ที่มีคะแนน, hash ของชุดข้อมูล, model slug และ cryptographic fingerprint ที่เชื่อมโยงผลลัพธ์กับการกำหนดค่าการทดลองที่แน่นอน

---

## ขั้นตอนที่ 2: ตรวจสอบ Run Card ของคุณ

Run card จะถูกบันทึกไว้ที่ `eval/logs/harness/` ตรวจสอบของคุณก่อนส่ง:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

ฟิลด์สำคัญที่ต้องตรวจสอบ:
- `scores.chrf_plus_plus` — metric คุณภาพหลักของคุณ
- `scores.exact_match_rate` — สัดส่วนของการแปลที่สมบูรณ์แบบ
- `scores.fst_acceptance_rate` — ความถูกต้องทางสัณฐานวิทยา (หากใช้ FST)
- `totals.total_cost_usd` — ค่าใช้จ่ายของ run
- `fingerprint` — hash สำหรับการทำซ้ำการทดลอง

ดู [Run Card Specification](/docs/network/specifications/run-card) สำหรับ schema แบบเต็ม

---

## ขั้นตอนที่ 3: ส่ง

### การเผยแพร่อัตโนมัติ

หากคุณส่ง `--publish` ขณะรัน harness run card ของคุณถูกอัปโหลดไปแล้ว

### การเผยแพร่ด้วยตนเอง

เผยแพร่ run card ใดก็ได้ด้วย harness:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

หากคุณไม่ต้องการใช้ขั้นตอนการเผยแพร่ ให้เปิด pull request ไปยัง
[eval harness repository](https://github.com/gamedaysuits/Champollion)
โดยวาง run card JSON ของคุณไว้ในไดเรกทอรี `results/`

:::note[ยังไม่เปิดใช้งาน submission API และการอัปโหลดผ่านเว็บ]
endpoint `POST https://champollion.dev/api/leaderboard/submit` และ
UI สำหรับอัปโหลดไปยัง Leaderboard อยู่ในแผนงาน แต่**ยังไม่ได้ดำเนินการ** จนกว่าจะพร้อมใช้งาน
เส้นทางการส่งที่ใช้งานได้เพียงอย่างเดียวคือ `mt-eval publish` และการส่ง pull request ไปยัง
harness repo ด้านบน
:::

---

## ขั้นตอนถัดไป

1. ข้อมูลที่คุณส่งมาจะได้รับการตรวจสอบความถูกต้อง (dataset hash, ความสมบูรณ์ของ run card)
2. ผลลัพธ์จะปรากฏบน leaderboard ในสถานะ **Self-benchmarked** (trust tier 1)
3. หากต้องการรับสถานะ **Champollion Verified** โปรดส่ง method ของคุณในรูปแบบ plugin ที่สามารถติดตั้งได้ เพื่อให้ maintainers สามารถทำซ้ำผลลัพธ์ของคุณได้
4. สำหรับ method ของภาษาชนพื้นเมือง: หาก method ของคุณขึ้นสู่อันดับสูงสุด กระบวนการ[โอนกรรมสิทธิ์](/docs/network/sovereignty/ownership-transfer)จะเริ่มต้นขึ้น

---

## ดูเพิ่มเติม

- [Harness Usage](/docs/network/specifications/harness) — เอกสารอ้างอิง CLI แบบเต็ม
- [Leaderboard Rules](/docs/network/leaderboard/rules) — เกณฑ์การส่งและนโยบายป้องกันการโกง
- [Building a Method](/docs/network/specifications/methods) — โปรโตคอล TranslationMethod
- [Datasets](/docs/network/leaderboard/datasets) — ชุดข้อมูลสำหรับการประเมินที่มีอยู่
