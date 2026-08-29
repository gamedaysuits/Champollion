---
sidebar_position: 9
title: "คู่มือ: วิธีการแบบวิวัฒนาการ / การค้นหา"
---

# การแปลแบบวิวัฒนาการ / การค้นหาตามการเพิ่มประสิทธิภาพ

> **แนวคิด:** สร้างตัวเลือกการแปลหลายรายการ ให้คะแนนโดยใช้ฟังก์ชันความเหมาะสม (chrF++, การยอมรับของ FST, ความสอดคล้องของการแปลกลับ) กลายพันธุ์ตัวเลือกที่ดีที่สุด แล้วทำซ้ำ — เสมือนการคัดเลือกตามธรรมชาติสำหรับการแปล ตัวที่เหมาะสมที่สุดจะอยู่รอด

:::info[นี่คือ cookbook ไม่ใช่การนำไปใช้งานจริงที่สมบูรณ์]
นี่คือแนวทางที่ทดลองมากที่สุดในชุด cookbook นี้ ยังไม่ได้รับการพิสูจน์สำหรับ MT ในระดับขนาดใหญ่ แต่สถาปัตยกรรมนั้นมีความถูกต้อง และ harness จะให้คะแนนสิ่งที่ผลิตออกมาได้อย่างไม่มีปัญหา
:::

## เมื่อใดควรใช้แนวทางนี้

- คุณมี **ฟังก์ชันการให้คะแนนที่ดี** แต่ไม่มีโมเดลเดียวที่ให้ผลลัพธ์สม่ำเสมอ
- คุณต้องการ **สำรวจพื้นที่ของคำตอบ** ให้กว้างกว่าการสร้างแบบ greedy ครั้งเดียว
- คุณมี **งบประมาณด้านการประมวลผล** สำหรับการสร้างแบบขนานจำนวนมาก (ตัวเลือกหลายสิบรายการต่อข้อมูลนำเข้า)
- คุณสนใจ **งานวิจัยแนวใหม่** — แนวทางนี้ยังไม่ได้รับการสำรวจมากนักสำหรับ MT ที่มีทรัพยากรน้อย

## วิธีการทำงาน

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## โครงสร้างพื้นฐาน

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## การออกแบบฟังก์ชันความเหมาะสม

ฟังก์ชันความเหมาะสมคือหัวใจสำคัญของทั้งหมด ตัวเลือกที่มี:

| เมตริก | สิ่งที่วัด | อัตโนมัติ? |
|--------|-----------------|------------|
| chrF++ เทียบกับข้อมูลอ้างอิง | ความคล้ายคลึงระดับอักขระกับข้อมูลมาตรฐาน | ✅ ใช่ |
| อัตราการยอมรับของ FST | ความถูกต้องทางสัณฐานวิทยา | ✅ ใช่ (หาก FST พร้อมใช้งาน) |
| ความสอดคล้องของการแปลกลับ | การแปลกลับสามารถกู้คืนต้นฉบับได้หรือไม่? | ✅ ใช่ |
| LLM-as-judge | LLM อีกตัวประเมินความคล่องและความถูกต้อง | ✅ ใช่ (แต่มีความคลาดเคลื่อน) |
| การปรากฏของคำศัพท์จากพจนานุกรม | คำศัพท์ที่ทราบปรากฏอย่างถูกต้องหรือไม่? | ✅ ใช่ |

:::tip[รวมสัญญาณหลายอย่างเข้าด้วยกัน]
การรวมเมตริกแบบถ่วงน้ำหนักทำให้ฟังก์ชัน fitness มีความแข็งแกร่งมากกว่าการใช้เมตริกเดียว ซึ่งสะท้อนถึง [คะแนนรวม](/docs/network/leaderboard/rules) ของ harness เอง
:::

## ข้อดีและข้อเสีย

| | |
|---|---|
| ✅ สำรวจคำตอบที่หลากหลาย | ❌ ใช้ทรัพยากรการประมวลผลสูง (N × G API calls) |
| ✅ สามารถค้นพบแนวทางที่โมเดลเดียวไม่สามารถหาได้ | ❌ ต้องการฟังก์ชันความเหมาะสมที่ดี |
| ✅ รองรับการประมวลผลแบบขนาน | ❌ ช้า — ต้องผ่านหลายรุ่นต่อการแปลหนึ่งครั้ง |
| ✅ ไม่ขึ้นกับโมเดลใดโมเดลหนึ่ง | ❌ ผลตอบแทนลดลงหลังจากผ่านไปสองสามรุ่น |

## ใช้ร่วมกับแนวทางอื่นได้ดี

- **[Chained Models](./chained-models)** — ขั้นตอนการกลายพันธุ์เป็นรูปแบบหนึ่งของการเชื่อมโยง
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — การยอมรับของ FST ใช้เป็นสัญญาณความเหมาะสม
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — การปรากฏของคำในพจนานุกรมใช้เป็นสัญญาณความเหมาะสม

## ดูเพิ่มเติม

- [ข้อกำหนด Run Card](/docs/network/specifications/run-card) — ต้นทุนและเวลาแฝงถูกบันทึกต่อรายการ
- [Eval Harness](/docs/network/specifications/harness) — harness ให้คะแนนผลลัพธ์สุดท้ายของคุณ ไม่ใช่กระบวนการ
- [สนับสนุนภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages)
