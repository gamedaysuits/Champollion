---
sidebar_position: 8
title: "คู่มือ: การเพิ่มข้อมูลด้วย Back-Translation"
---

# การเสริมข้อมูลด้วย Back-Translation

> **แนวคิด:** สร้างข้อมูลคู่ขนานสังเคราะห์โดยการแปลข้อความภาษาเป้าหมายที่มีอยู่กลับไปยังภาษาต้นทาง จากนั้นนำคู่ข้อมูลสังเคราะห์เหล่านี้ไปใช้ฝึกหรือ prompt โมเดลในทิศทางไปข้างหน้า วิธีนี้ช่วยขยาย corpus คู่ขนานของคุณได้อย่างประหยัด — แต่มีข้อควรระวังเกี่ยวกับคุณภาพ

:::info[นี่คือ cookbook ไม่ใช่การ implement ที่สมบูรณ์]
คู่มือนี้อธิบายกลยุทธ์และข้อควรระวังที่สำคัญ Back-translation มีประสิทธิภาพสูง แต่หากไม่ระมัดระวัง อาจขยายข้อผิดพลาดให้รุนแรงขึ้นได้
:::

## เมื่อใดควรใช้แนวทางนี้

- คุณมี **ข้อความภาษาเป้าหมายแบบ monolingual** แต่มีข้อมูลคู่ขนานจำกัด
- คุณต้องการ **ขยาย training corpus** สำหรับ [fine-tuning](./fine-tuned-model) โดยไม่ต้องแปลด้วยมือ
- คุณต้องการ **ตัวอย่าง few-shot เพิ่มเติม** แต่ไม่สามารถรับการแปลจากมนุษย์ได้ทันเวลา
- คุณพร้อมที่จะ **กรองคุณภาพ** ข้อมูลสังเคราะห์อย่างเข้มงวด

## วิธีการทำงาน

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **รวบรวมข้อความ monolingual** — หนังสือ บทความ บทถอดความ และสื่อสังคมออนไลน์ในภาษาเป้าหมาย
2. **Back-translate** — ใช้ LLM หรือ MT API แปลแต่ละประโยคกลับไปยังภาษาต้นทาง
3. **กรองคุณภาพ** — ทำ round-trip (แปลกลับอีกครั้ง) แล้วเปรียบเทียบ คัดเก็บเฉพาะคู่ที่ผล round-trip ≈ ต้นฉบับ
4. **นำ corpus สังเคราะห์ไปใช้** — สำหรับ fine-tuning ตัวอย่าง few-shot หรือข้อมูล coaching

## การกรองคุณภาพ: Round-Trip Test

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## ข้อผิดพลาดสำคัญ: การขยายข้อผิดพลาด

:::warning[Back-translation ขยาย bias ที่มีอยู่ในโมเดล]
หากโมเดล back-translation ของคุณเกิดข้อผิดพลาดซ้ำๆ ในลักษณะเดิม corpus สังเคราะห์ของคุณจะเข้ารหัสข้อผิดพลาดเหล่านั้นว่าเป็น "สิ่งที่ถูกต้อง" ซึ่งก่อให้เกิด feedback loop: เทรนด้วยข้อมูลที่ไม่ดี → ผลิตการแปลที่แย่ลง → สร้างข้อมูลสังเคราะห์ที่แย่ลงไปอีก **กรองคุณภาพอย่างเข้มงวดเสมอ** และผสมข้อมูลสังเคราะห์เข้ากับการแปลที่ผ่านการตรวจสอบโดยมนุษย์
:::

## แหล่งข้อความ Monolingual

- จดหมายข่าว หนังสือพิมพ์ และสิ่งพิมพ์ของชุมชน
- เอกสารราชการในภาษาเป้าหมาย (เช่น Nunavut Hansard สำหรับภาษา Inuktitut)
- สื่อการเรียนการสอนและตำราเรียน
- ตำราศาสนา (มีให้ใช้งานอย่างแพร่หลายสำหรับหลายภาษา)
- สื่อสังคมออนไลน์ (พร้อมการขออนุญาตที่เหมาะสมและการกรองคุณภาพ)
- เสียง/วิดีโอที่ถอดความจากโปรแกรมภาษา

## ข้อดีและข้อเสีย

| | |
|---|---|
| ✅ ขยายข้อมูลฝึกได้อย่างประหยัด | ❌ ขยายข้อผิดพลาดของโมเดลหากไม่ผ่านการกรอง |
| ✅ ใช้ประโยชน์จากข้อความ monolingual ที่มีอยู่มาก | ❌ เพดานคุณภาพถูกจำกัดโดยโมเดล back-translation |
| ✅ สร้างได้ง่ายในปริมาณมาก | ❌ การกรองด้วย round-trip ใช้ทรัพยากรการคำนวณสูง |
| ✅ เสริมการทำงานร่วมกับแนวทางอื่นๆ ได้ดี | ❌ ข้อมูลสังเคราะห์ไม่สามารถทดแทนการแปลจากมนุษย์ได้ |

## ใช้ร่วมกับแนวทางอื่นได้ดี

- **[Fine-Tuned Model](./fine-tuned-model)** — back-translation สร้างข้อมูลฝึกสำหรับ fine-tuning
- **[Corpus Creation](./corpus-creation)** — ข้อมูลสังเคราะห์เสริม corpus ที่สร้างโดยมนุษย์
- **[Coached LLM Prompting](./coached-llm-prompting)** — ตัวอย่างสังเคราะห์สามารถนำไปใช้ในพจนานุกรม coaching ได้

## ดูเพิ่มเติม

- [ชุดข้อมูลสำหรับการประเมิน](/docs/network/leaderboard/datasets) — ข้อมูลสังเคราะห์ต้องไม่ซ้อนทับกับข้อมูลสำหรับการประเมิน
- [กฎของ Leaderboard](/docs/network/leaderboard/rules) — นโยบายการปนเปื้อนของข้อมูล
- [การสนับสนุนภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages)
