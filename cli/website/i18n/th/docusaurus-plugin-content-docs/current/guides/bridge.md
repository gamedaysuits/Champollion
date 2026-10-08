---
sidebar_position: 8
title: "The Eval Harness Bridge"
description: "วิธีที่ MT Eval Harness และ champollion ทำงานร่วมกัน — จากงานวิจัยสู่การใช้งานจริงและย้อนกลับ"
related:
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: arena
    note: "The harness specification itself"
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Benchmark coaching data with the harness"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit registers with the harness, mid-cookbook"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
---

# สะพานเชื่อม Eval Harness

champollion และ MT Eval Harness เป็นเครื่องมือสองชิ้นที่แยกจากกัน แต่ก่อตัวเป็นระบบนิเวศเดียวกัน Harness คือที่ที่วิธีการแปล**ได้รับการพิสูจน์** Champollion คือที่ที่วิธีการที่พิสูจน์แล้ว**ถูกนำไปใช้งานจริง** ทั้งสองเชื่อมต่อกันผ่านรูปแบบ plugin ที่ใช้ร่วมกัน

```mermaid
graph LR
    H["MT Eval Harness\n(Python)\nDevelop and benchmark"] -->|"method.json\n+ coaching data"| R["champollion\n(Node.js)\nDeploy and translate"]
    R -->|"Speaker feedback\nimproves the method"| H
```

## กระบวนการ: งานวิจัย → การใช้งานจริง

### 1. สร้างวิธีการใน Harness

Python class ใดก็ตามที่ implement `async translate(entries, config) → [{id, predicted}]` สามารถเชื่อมต่อกับ harness ได้ Harness ไม่สนใจว่าภายในจะทำงานอย่างไร — ไม่ว่าจะเป็น LLM แบบ prompted, โมเดลที่ฝึกเอง, กฎแบบ deterministic หรืออะไรก็ตาม

### 2. ทำ Benchmark

Harness จะให้คะแนนวิธีการของคุณเทียบกับ corpus มาตรฐานด้วย metrics ที่ทำซ้ำได้: chrF++, FST acceptance (สำหรับภาษาที่มีโครงสร้างทางสัณฐานวิทยาซับซ้อน), ความถูกต้องทางสัณฐานวิทยา และการให้คะแนนเชิงความหมาย

### 3. Export เป็น Plugin

เมื่อวิธีการของคุณถึงระดับคุณภาพที่ยอมรับได้ ให้แพ็กเกจเป็น champollion plugin — manifest แบบ `method.json` พร้อม coaching data เสริม

:::info[มีแผนเพิ่ม Export CLI]
ปัจจุบัน คุณต้องสร้างไฟล์ manifest method.json ด้วยตนเอง คำสั่ง `mt-eval export` จะช่วยทำให้กระบวนการนี้เป็นอัตโนมัติ ดูรายละเอียดรูปแบบ plugin แบบเต็มได้ที่ [Method Interface](/docs/network/specifications/methods)
:::

### 4. ติดตั้งใน Champollion

```bash
champollion plugin install ./my-method-plugin/
```

### 5. แปลเนื้อหาจริง

```bash
champollion sync
```

ขณะนี้ method ที่ผ่านการทดสอบแล้วของคุณกำลังสร้างการแปลจริงในสภาพแวดล้อมการใช้งานจริง

## กระบวนการ: การใช้งานจริง → งานวิจัย

การแปลที่ deploy แล้วจะได้รับการตรวจสอบโดยผู้พูดสองภาษา ข้อเสนอแนะของพวกเขาช่วยระบุข้อผิดพลาดที่เกิดขึ้นอย่างเป็นระบบ (รูปแบบกาลที่ผิด, คำศัพท์ที่ขาดหาย, การใช้ภาษาที่ไม่เป็นธรรมชาติ) นักวิจัยจะอัปเดตวิธีการใน harness, ทำ benchmark ใหม่, export ใหม่ และ deploy ใหม่ ระบบเรียนรู้จากการใช้งาน

## รูปแบบ Plugin

manifest `method.json` คือสัญญาระหว่างเครื่องมือทั้งสอง:

```json
{
  "name": "french-formal-v1",
  "type": "llm-coached",
  "version": "1.0.0",
  "description": "Formal-register French (example manifest; the benchmark values are illustrative)",
  "locales": ["fr"],
  "config": {
    "model": "google/gemini-3.8-flash",
    "temperature": 0.3
  },
  "benchmarks": {
    "fr": {
      "corpus_chrf": 72.3,
      "exact_match_rate": 0.42,
      "corpus_size": 500
    }
  }
}
```

ดู [Plugin Specification](/docs/reference/plugin-spec) สำหรับรูปแบบแบบเต็ม

## สิ่งที่สร้างแล้ว vs. ที่วางแผนไว้

| Component | สถานะ |
|-----------|--------|
| TranslationMethod protocol | ✅ สร้างแล้ว |
| Harness benchmark runner | ✅ สร้างแล้ว |
| method.json plugin format | ✅ สร้างแล้ว |
| `champollion plugin install/remove/list` | ✅ สร้างแล้ว |
| Coaching data loading | ✅ สร้างแล้ว |
| `mt-eval export` CLI | 🔲 วางแผนไว้ |
| Community review interface | 🔲 วางแผนไว้ |
| Cryptographic test set evaluation | 🔲 วางแผนไว้ |

## อ่านเพิ่มเติม

- [วิธีการแปลภาษา](/docs/guides/translation-methods) — วิธีการทั้งหมดที่รองรับและหลักการทำงาน
- [ข้อกำหนดปลั๊กอิน](/docs/reference/plugin-spec) — รูปแบบของ method.json
- [การให้บริการวิธีแปลผ่าน API](/docs/guides/serving-a-method) — การโฮสต์วิธีการแปลที่ฝั่งเซิร์ฟเวอร์
- [อธิปไตยเหนือข้อมูล](/docs/network/sovereignty/data-sovereignty) — หลักการอธิปไตยเหนือข้อมูลของชนพื้นเมือง, CARE และการคุ้มครองด้วยการเข้ารหัสลับ
- [สำหรับนักวิจัย MT](/docs/network/leaderboard/rules) — เอกสารประกอบของ eval harness
