---
sidebar_position: 5
title: "นำไปใช้งานจริง"
description: "นำวิธีการที่ผ่านการพิสูจน์แล้วจาก Network มาใช้งานผ่าน champollion"
---

# นำไปใช้งานจริง

คุณพิสูจน์แล้วว่ามันทำงานได้ใน Network ตอนนี้ถึงเวลานำไปใช้งานจริง

Network มีไว้สำหรับ R&D — สร้าง, ทดสอบประสิทธิภาพ, และเปรียบเทียบวิธีการแปล **การนำไปใช้งานจริง** เกิดขึ้นผ่าน [champollion](https://champollion.dev) ซึ่งเป็น CLI สำหรับนักพัฒนา ทั้งสองเชื่อมต่อกันผ่านรูปแบบ plugin ที่ใช้ร่วมกัน

```mermaid
graph LR
    A["Network\n(benchmark)"] -->|"method.json\n+ coaching data"| B["champollion\n(production)"]
    B -->|"Speaker feedback\nimproves the method"| A
```

---

## เส้นทางการนำไปใช้งาน

### 1. ส่งออก Method ของคุณในรูปแบบ Plugin

สร้าง manifest `method.json` ที่รวบรวมผลการทดสอบประสิทธิภาพของคุณ:

```json
{
  "name": "crk-coached-v3",
  "type": "llm-coached",
  "version": "3.0.0",
  "description": "Coached LLM translation for Plains Cree",
  "locales": ["crk"],
  "config": {
    "model": "google/gemini-2.5-flash",
    "temperature": 0.3
  },
  "benchmarks": {
    "crk": {
      "composite_score": 0.67,
      "fst_acceptance": 0.82,
      "corpus_size": 150
    }
  }
}
```

รวม coaching data (กฎไวยากรณ์, พจนานุกรม) ไว้พร้อมกับ manifest ด้วย

### 2. ติดตั้งใน Champollion

```bash
champollion plugin install ./my-method-plugin/
```

### 3. กำหนดค่าคู่ภาษาของคุณ

```json title="champollion.config.json"
{
  "pairs": {
    "en-crk": { "method": "plugin", "plugin": "crk-coached-v3" }
  }
}
```

### 4. แปลเนื้อหาจริง

```bash
npx champollion sync
```

ขณะนี้ method ที่ผ่านการทดสอบแล้วของคุณกำลังสร้างการแปลจริงในสภาพแวดล้อมการใช้งานจริง

---

## สำหรับภาษาของชนพื้นเมือง

วิธีการที่รองรับชุมชนภาษาพื้นเมืองจำเป็นต้องได้รับ**ความยินยอมจากชุมชน**ก่อนการนำไปใช้งานจริงบน production หลักการอธิปไตยทางข้อมูลของชนพื้นเมือง — ความเป็นเจ้าของและการควบคุมข้อมูลภาษาโดยชุมชน — จะเป็นตัวกำหนดแนวทางในการพัฒนา การประเมิน และการ deploy วิธีการแปลภาษา

Method ที่บรรลุระดับ Deployable (0.70+) ไม่ได้หมายความว่าจะนำไปใช้งานโดยอัตโนมัติ — แต่จะนำไปใช้งาน **เมื่อและหากเท่านั้น** ที่องค์กรกำกับดูแลของชุมชนภาษานั้นให้ความยินยอม

ดู [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) และ [Ownership Transfer](/docs/network/sovereignty/ownership-transfer) สำหรับกรอบการกำกับดูแลฉบับสมบูรณ์

---

## ดูเพิ่มเติม

- [The Eval Harness Bridge](https://champollion.dev/docs/guides/bridge) — คำแนะนำโดยละเอียดเกี่ยวกับ pipeline จาก Network ไปยัง champollion
- [Plugin Specification](https://champollion.dev/docs/reference/plugin-spec) — รูปแบบ manifest ของ method.json
- [champollion Agent Guide](https://champollion.dev/docs/guides/agent-guide) — วิธีใช้ champollion สำหรับการแปล
