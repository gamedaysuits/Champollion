---
sidebar_position: 2
title: "คู่มือ: การใช้ Coached LLM Prompting"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# การ Prompt LLM แบบมีการสอนแนะ

> **แนวคิด:** ฉีดกฎไวยากรณ์ พจนานุกรมสองภาษา และหมายเหตุด้านสไตล์เข้าไปใน system prompt ของ LLM โดยตรง ไม่ต้องฝึกหรือ fine-tune — เพียงแค่ความรู้ทางภาษาศาสตร์ที่มีโครงสร้าง ซึ่งช่วยนำทางผลลัพธ์ไปสู่การแปลที่ถูกต้อง

:::info[นี่คือ cookbook ไม่ใช่การ implement ที่สมบูรณ์]
คู่มือนี้อธิบายแนวทางและการตัดสินใจออกแบบที่สำคัญ ปรับใช้ให้เหมาะกับคู่ภาษา ทรัพยากรที่มีอยู่ และเป้าหมายในการประเมินผลของคุณ
:::

## เมื่อใดควรใช้แนวทางนี้

- คุณมี **ความรู้ทางภาษาศาสตร์** เกี่ยวกับภาษาเป้าหมาย (กฎไวยากรณ์ รายการพจนานุกรม ความต้องการด้านสไตล์) แต่ไม่มีข้อมูลคู่ขนานเพียงพอสำหรับการ fine-tune
- คุณต้องการ **ทำซ้ำได้อย่างรวดเร็ว** — การเปลี่ยน prompt ใช้งานได้ภายในไม่กี่วินาที ไม่ต้องฝึกใหม่
- ภาษาเป้าหมายมี **รูปแบบที่ทราบแน่ชัด** ซึ่ง LLM มักทำผิด (การผันตามเพศ รูปแบบอักษร ระดับความสุภาพ)
- คุณต้องการเปรียบเทียบ coached prompting กับ baseline และทำซ้ำในสิ่งที่ได้ผล

## วิธีการทำงาน

1. **รวบรวมข้อมูลการสอนแนะ** — กฎไวยากรณ์ พจนานุกรมสองภาษา และหมายเหตุด้านสไตล์ในไฟล์ JSON ที่มีโครงสร้าง
2. **กำหนดค่า register** — คำนำหน้า system prompt ที่กำหนดภาษา อักษร และโทนเสียง
3. **รัน harness** — ข้อมูลการสอนแนะจะถูกฉีดเข้าไปใน prompt ของ LLM ทุกครั้ง
4. **ตรวจสอบความล้มเหลว** — ดูสิ่งที่ quality gate ปฏิเสธ แล้วเพิ่มกฎเพื่อแก้ไขรูปแบบที่พบ
5. **ทำซ้ำ** — การแก้ไขไฟล์ coaching แต่ละครั้งคือการทดลองใหม่ harness จะติดตามทั้งหมด

## โครงสร้างข้อมูลการสอนแนะ

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## การตัดสินใจออกแบบที่สำคัญ

**ความเฉพาะเจาะจงของกฎ vs. context window:** กฎที่มากขึ้นให้คำแนะนำแก่ LLM มากขึ้น แต่ก็กินพื้นที่ใน context window ที่ใช้สำหรับการแปลจริง เริ่มต้นด้วยกฎที่มีผลกระทบสูง 5–10 ข้อ และเพิ่มเติมเฉพาะเมื่อพบรูปแบบความล้มเหลวที่เฉพาะเจาะจง

**ความครอบคลุมของพจนานุกรม:** คุณไม่จำเป็นต้องมีพจนานุกรมที่สมบูรณ์ — มุ่งเน้นที่คำศัพท์ที่ LLM แปลผิดอย่างสม่ำเสมอ แม้แต่คำที่บังคับใช้ 20–30 คำก็สามารถปรับปรุงความสอดคล้องได้อย่างมาก

**ลำดับของกฎมีความสำคัญ:** วางกฎที่สำคัญที่สุดไว้ก่อน LLM ให้ความสนใจกับคำสั่งที่อยู่ต้นๆ มากกว่า

## การรันการทดลอง

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## ข้อดีและข้อเสีย

| | |
|---|---|
| ✅ ไม่มีต้นทุนการฝึก | ❌ เพดานคุณภาพถูกจำกัดโดยความรู้พื้นฐานของ LLM |
| ✅ ทำซ้ำได้ทันที (เปลี่ยน prompt → รันใหม่) | ❌ context window จำกัดปริมาณการสอนแนะที่ใส่ได้ |
| ✅ ใช้งานได้กับผู้ให้บริการ LLM ทุกราย | ❌ กฎอาจขัดแย้งกัน — การ debug การโต้ตอบของ prompt เป็นศิลปะ |
| ✅ โปร่งใส — คุณสามารถอ่านสิ่งที่ LLM เห็นได้อย่างชัดเจน | ❌ ไม่ได้สร้างความรู้ใหม่ เพียงแค่นำทางความรู้ที่มีอยู่ |

## ใช้ร่วมกับแนวทางอื่นได้ดี

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — การสอนแนะ + การตรวจสอบทางสัณฐานวิทยาจับสิ่งที่การสอนแนะเพียงอย่างเดียวพลาดไป
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — การบังคับใช้คำศัพท์เป็นรูปแบบหนึ่งของการสอนแนะ
- **[Few-Shot Prompting](./few-shot-prompting)** — ตัวอย่าง + กฎร่วมกันมีพลังมากกว่าแต่ละอย่างเพียงลำพัง

## ดูเพิ่มเติม

- [Method Interface](/docs/network/specifications/methods) — รูปแบบข้อมูลการสอนแนะและ TranslationMethod protocol
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — บริบทฉบับสมบูรณ์
- [Eval Harness](/docs/network/specifications/harness) — วิธีการรันการทดลอง
