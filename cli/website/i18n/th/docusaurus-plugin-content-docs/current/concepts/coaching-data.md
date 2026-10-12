---
sidebar_position: 5
title: "ข้อมูลการฝึกสอน"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Coaching Data

Coaching data คือกลไกของ champollion สำหรับสอน LLM เกี่ยวกับภาษาที่ไม่ได้รับการฝึกมา ด้วยการให้กฎไวยากรณ์ พจนานุกรม และหมายเหตุด้านสไตล์ควบคู่ไปกับคำขอแปลแต่ละรายการ คุณสามารถเปลี่ยน LLM เอนกประสงค์ให้กลายเป็นนักแปลที่เข้าใจบริบทสำหรับภาษาใดก็ได้ — รวมถึงภาษาที่ยังไม่มีระบบแปลด้วยเครื่องรองรับเลย

## วิธีการทำงาน

เมื่อคุณตั้งค่า method ของคู่ภาษาเป็น `llm-coached` champollion จะโหลดไฟล์ coaching จาก `.champollion/coaching/<locale>.json` และแทรกเนื้อหาลงใน LLM prompt ทุกรายการในฐานะส่วนหนึ่งของ system message LLM จะเห็นกฎทางภาษาของคุณควบคู่กับคำขอแปล ทำให้ผลลัพธ์เป็นไปตามไวยากรณ์และคำศัพท์ที่คุณกำหนด แทนที่จะเดาเอาเอง

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

เนื้อหา coaching มีสองประเภท:

1. **ข้อมูล Coaching แบบมีโครงสร้าง** (เมธอด `llm-coached`) — กฎไวยากรณ์ พจนานุกรม และหมายเหตุเรื่องสไตล์ในรูปแบบ JSON ซึ่งโหลดมาจาก `.champollion/coaching/<locale>.json` หรือไดเรกทอรี `coaching/` ของปลั๊กอิน โดย `dictionary` ในนี้ยังทำหน้าที่เป็นอภิธานศัพท์ของโปรเจกต์ด้วย: ทุกเมธอด LLM (`llm`, `openai`, `anthropic`, `gemini`, `local`) จะได้รับแจ้งคำศัพท์ในอภิธานศัพท์ที่มีอยู่ในแต่ละแบตช์, DeepL จะส่งข้อมูลดังกล่าวเป็น glossary และ sync จะแจ้งเตือนเมื่อผลลัพธ์ของเมธอดใดๆ ละเว้นคำศัพท์ไป ส่วนกฎไวยากรณ์และหมายเหตุเรื่องสไตล์นั้นจะถูกอ่านโดย `llm-coached` เท่านั้น — บนผู้ให้บริการใดๆ ก็ตาม (`"provider": "openai"`, `"local"`, …)
2. **พรอมต์ Coaching แบบข้อความอิสระ** (ฟิลด์คอนฟิก `coachingFile`) — ไฟล์ข้อความธรรมดา (plain text) ที่มีคำแนะนำเพิ่มเติมสำหรับแทรกเข้าไปใน system prompt ทำงานร่วมกับเมธอด LLM ใดก็ได้ ไม่จำกัดเฉพาะ `llm-coached` กำหนดค่าได้ผ่าน `coachingFile` ในคอนฟิกของคุณหรือ `--coaching-file` บน CLI

ทั้งสองแบบสามารถใช้ร่วมกันได้ eval harness ใช้โครงสร้าง prompt เดียวกันทุกประการ — ดังนั้นคะแนน benchmark จึงสะท้อนถึง prompt ที่ใช้งานจริงในระบบ production

เนื่องจาก coaching data เป็นส่วนหนึ่งของ system message จึงได้รับประโยชน์จาก **prompt caching** — ผู้ให้บริการอย่าง Anthropic และ Google จะ cache system prefix ที่ซ้ำกัน ทำให้คุณจ่ายค่า coaching context เพียงครั้งเดียวต่อ session ไม่ใช่ครั้งเดียวต่อ batch

## รูปแบบไฟล์ Coaching

สร้างไฟล์ JSON หนึ่งไฟล์ต่อหนึ่งโลแคลใน `.champollion/coaching/` ตัวอย่าง
ด้านล่างนี้สำหรับภาษาจำลองภายใต้รหัส `qaa` ซึ่งเป็นรหัสสำหรับใช้งานส่วนบุคคล (private-use code) ที่ไม่มีภาษาจริงใดใช้อยู่: ทุกกฎและคำศัพท์ในนี้เป็นเพียงสิ่งสมมติขึ้น ไม่ใช่ข้อเท็จจริงเกี่ยวกับภาษาใดๆ โปรดเขียนไฟล์ของคุณขึ้นมาเอง โดยถ้าจะให้ดีควรทำร่วมกับผู้ที่พูดภาษานั้น และนำคำศัพท์พจนานุกรมมาจากแหล่งอ้างอิงที่คุณสามารถระบุได้

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
}
```

### ฟิลด์

| ฟิลด์ | ประเภท | จำเป็น | คำอธิบาย |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | ไม่ | อาร์เรย์ของกฎไวยากรณ์ที่แทรกเข้าไปใน system prompt แต่ละกฎควรเป็นคำสั่งที่กระชับและนำไปปฏิบัติได้ซึ่ง LLM สามารถปฏิบัติตามได้ |
| `dictionary` | `object` | ไม่ | แผนที่ key-value ของคำภาษาอังกฤษ → คำในภาษาเป้าหมาย ใช้สำหรับคำศัพท์เฉพาะทางที่ LLM ไม่รู้จัก |
| `style_notes` | `string` | ไม่ | คำแนะนำด้านสไตล์แบบอิสระ (ระดับภาษา น้ำเสียง และรูปแบบความเป็นทางการ) |

ทุกฟิลด์เป็นตัวเลือก — คุณสามารถเริ่มต้นด้วยเพียงพจนานุกรมแล้วเพิ่มกฎไวยากรณ์ภายหลังเมื่อปรับแต่งเพิ่มเติม

## พฤติกรรม Fallback

หากคู่ภาษาถูกกำหนดค่าสำหรับ `llm-coached` แต่ไม่มีไฟล์ coaching สำหรับ locale นั้น champollion จะ **fallback ไปใช้ method `llm` มาตรฐาน** พร้อมแสดงคำเตือนใน console:

```
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
       Falling back to standard LLM method. Create coaching data for better results.
```

ซึ่งหมายความว่าคุณสามารถตั้งค่า `"defaultMethod": "llm-coached"` แบบ global ได้อย่างปลอดภัย — ภาษาที่มี coaching data จะใช้งานได้ทันที และภาษาที่เหลือจะได้รับการแปลด้วย LLM มาตรฐานโดยไม่เกิดข้อผิดพลาด

## เมื่อใดควรใช้ Coaching

| สถานการณ์ | Method ที่แนะนำ |
|----------|-------------------|
| ภาษา Tier 1 (ฝรั่งเศส สเปน เยอรมัน) | `llm` หรือ `google-translate` — LLM รู้จักภาษาเหล่านี้ดีอยู่แล้ว |
| ภาษา Tier 2 (เกาหลี ตุรกี ไทย) | `llm` พร้อม register — LLM รองรับภาษาเหล่านี้ได้อย่างเพียงพอเมื่อมีคำแนะนำด้านสไตล์ |
| ภาษา Tier 3 (Plains Cree, Yoruba, Quechua) | `llm-coached` — LLM ต้องการกฎไวยากรณ์และพจนานุกรม |
| ภาษาสมมติ (Klingon, Sindarin, Kryptonian) | `llm-coached` — LLM มีข้อมูลฝึกบ้างแต่ต้องการการแก้ไข |

## การสร้าง Coaching Data ที่มีคุณภาพ

### กฎไวยากรณ์

เขียนกฎในรูปแบบ **คำสั่ง** ไม่ใช่คำอธิบาย LLM ปฏิบัติตามคำสั่งได้ดีกว่าการตีความทฤษฎีทางภาษาศาสตร์

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### พจนานุกรม

มุ่งเน้นที่ **คำศัพท์เฉพาะทาง** ที่ LLM อาจแปลผิดหรือสร้างขึ้นเอง ไม่จำเป็นต้องใส่คำทั่วไปที่ LLM รู้จักอยู่แล้ว — ให้เน้นที่คำศัพท์เฉพาะของ UI ในแอปพลิเคชันของคุณ

**พจนานุกรมจะถูกตรวจสอบสำหรับทุกเมธอด** ไม่ว่าเมธอดใดจะแปลคู่ภาษานั้น — ไม่ว่าจะเป็นโมเดลแบบโฮสต์, โมเดลของคุณเองผ่าน `local`, DeepL, เอนด์พอยต์ `api` — `champollion sync` จะตรวจสอบสตริงที่แปลแล้วแต่ละรายการเทียบกับพจนานุกรม และแสดงคำเตือน `[TERM]` พร้อมระบุคำศัพท์ใดๆ ที่ไม่ได้ถูกนำมาใช้
มีเพียง `llm-coached` (ในพรอมต์) และ `deepl` (ในฐานะ DeepL glossary) เท่านั้นที่นำคำศัพท์ไป*ปรับใช้*ในระหว่างการแปลด้วย ส่วนสำหรับเมธอดอื่นๆ การตรวจสอบนี้จะบอกให้คุณทราบว่ามีสตริงใดบ้างที่ต้องแก้ไข ตัวอย่างเช่น ด้วยคำสั่ง `champollion sync --method llm-coached
--redo keys:<key>`

### หมายเหตุด้านสไตล์

ระบุให้ชัดเจนเกี่ยวกับระดับภาษา ความเป็นทางการ และรูปแบบที่ใช้:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## การทดสอบการแปลที่ใช้ Coaching

ใช้ [MT Eval Harness](https://github.com/gamedaysuits/Champollion) เพื่อ benchmark การแปลที่ใช้ coaching เทียบกับ reference corpus:

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

# Score the results
mt-eval test eval/logs/run_*.json
```

ซึ่งจะให้คะแนน chrF++, BLEU และ exact match สร้างไฟล์ coaching หลายเวอร์ชันแล้วเปรียบเทียบ — เมตริกเชิงวัตถุวิสัยให้ผลดีกว่าการรีวิวแบบอัตนัย

---

## ดูเพิ่มเติม

- [Translation Methods](/docs/guides/translation-methods) — method llm-coached
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — การใช้ coaching ในทางปฏิบัติ
- [Plugin Specification](/docs/reference/plugin-spec) — การบรรจุ coaching data ใน plugin
- [Quality Gate](/docs/concepts/quality-gate) — วิธีการตรวจสอบการแปลที่ใช้ coaching
- [Configuration](/docs/getting-started/configuration) — การกำหนดค่า coaching แบบรายคู่ภาษา
