---
sidebar_position: 6
title: "คู่มือ: การเชื่อมต่อโมเดลแบบลูกโซ่"
---

# โมเดลแบบลูกโซ่ (Multi-Stage Pipeline)

> **แนวคิด:** โมเดล A สร้างการแปลเบื้องต้น → โมเดล B ปรับแก้ → โมเดล C ให้คะแนนหรือตรวจสอบผลลัพธ์ แต่ละขั้นตอนเชี่ยวชาญในสิ่งเดียว ผลลัพธ์ของ pipeline ดีกว่าโมเดลใดโมเดลหนึ่งเพียงลำพัง

:::info[นี่คือ cookbook ไม่ใช่การ implement ที่สมบูรณ์]
คู่มือนี้อธิบายสถาปัตยกรรม pipeline แบบหลายขั้นตอน โดยโมเดลและการตั้งค่า chain ที่เหมาะสมนั้นขึ้นอยู่กับคู่ภาษาและงบประมาณของคุณ
:::

## เมื่อใดควรใช้แนวทางนี้

- โมเดลเดียวให้**คุณภาพที่ไม่สม่ำเสมอ** — ดีกับบางอินพุต แย่กับบางอินพุต
- คุณต้องการ**แยกการสร้างออกจากการตรวจสอบ** — โมเดลหนึ่งสร้าง อีกโมเดลวิจารณ์
- คุณมีงบประมาณสำหรับ**การเรียก API หลายครั้งต่อการแปลหนึ่งครั้ง** (latency และต้นทุนเพิ่มขึ้นเป็นเส้นตรงตามจำนวนขั้นตอน)
- คุณต้องการรวมโมเดลที่มี**จุดแข็งต่างกัน** (เช่น ตัวสร้างที่สร้างสรรค์ + บรรณาธิการที่แม่นยำ)

## วิธีการทำงาน

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## ตัวอย่าง: Three-Stage Pipeline

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## รูปแบบ Chain ที่พบบ่อย

| รูปแบบ | ขั้นตอน | กรณีการใช้งาน |
|---------|--------|----------|
| **Generate → Edit** | Fast LLM → Strong LLM | การปรับปรุงคุณภาพที่คุ้มค่าต้นทุน |
| **Generate → Validate → Retry** | LLM → FST/rules → LLM (retry on failure) | ความถูกต้องทางสัณฐานวิทยา (ดู [FST-Gated](./fst-gated-pipeline)) |
| **Generate → Back-translate → Score** | LLM(en→crk) → LLM(crk→en) → compare | การตรวจสอบความสอดคล้องแบบ round-trip |
| **Ensemble → Vote** | 3 LLMs อิสระ → majority vote | ความทนทานผ่านความหลากหลาย |

## การตัดสินใจออกแบบที่สำคัญ

**งบประมาณ latency:** แต่ละขั้นตอนทำให้ latency เพิ่มขึ้นทวีคูณ chain 3 ขั้นตอนที่ใช้เวลา 2 วินาทีต่อขั้น = 6 วินาทีต่อการแปลหนึ่งครั้ง สำหรับการประเมินแบบ batch นี้ถือว่าเหมาะสม แต่สำหรับการใช้งานแบบ real-time อาจไม่เหมาะ

**ตัวคูณต้นทุน:** 3 ขั้นตอน = ต้นทุน API 3 เท่า ใช้โมเดลที่ถูกกว่าสำหรับขั้นตอนแรก และโมเดลที่มีราคาสูงกว่าสำหรับขั้นตอนที่สำคัญ

**การแพร่กระจายของข้อผิดพลาด:** ผลลัพธ์ที่ไม่ดีจากขั้นตอนที่ 1 อาจทำให้ขั้นตอนที่ 2 เข้าใจผิดได้ ควรรวมต้นฉบับไว้ในทุกขั้นตอนเพื่อให้โมเดลในขั้นตอนหลังสามารถแก้ไขได้

## ข้อดีและข้อเสีย

| | |
|---|---|
| ✅ สามารถรวมจุดแข็งของผู้เชี่ยวชาญแต่ละด้านได้ | ❌ Latency และต้นทุนเพิ่มขึ้นทวีคูณตามจำนวนขั้นตอน |
| ✅ แยกหน้าที่ชัดเจน (สร้าง vs. ตรวจสอบ) | ❌ ดีบักได้ยาก — ขั้นตอนใดที่ทำให้เกิดข้อผิดพลาด? |
| ✅ สลับขั้นตอนแต่ละส่วนได้ง่าย | ❌ การแพร่กระจายของข้อผิดพลาดระหว่างขั้นตอน |
| ✅ การตรวจสอบแบบ round-trip ช่วยตรวจจับ hallucination | ❌ ผลตอบแทนลดลงเมื่อมีมากกว่า 2-3 ขั้นตอน |

## ใช้ร่วมกับแนวทางอื่นได้ดี

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST ในฐานะขั้นตอนการตรวจสอบ
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — การฉีดพจนานุกรมในขั้นตอนการสร้าง
- **[Coached LLM Prompting](./coached-llm-prompting)** — การ coaching ในหนึ่งขั้นตอนหรือมากกว่า

## ดูเพิ่มเติม

- [Eval Harness](/docs/network/specifications/harness) — harness วัดผลลัพธ์ของ pipeline แบบ end-to-end
- [Run Card Specification](/docs/network/specifications/run-card) — latency และต้นทุนถูกบันทึกต่อรายการ
- [รองรับภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages)
