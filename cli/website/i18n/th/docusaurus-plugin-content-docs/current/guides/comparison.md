---
sidebar_position: 7
title: "การเปรียบเทียบ"
---

# การเปรียบเทียบ Champollion

champollion อยู่ในหมวดหมู่ที่แตกต่างจากเครื่องมือ localization ส่วนใหญ่ นี่คือการเปรียบเทียบอย่างตรงไปตรงมา

## ภาพรวมของตลาด

เครื่องมือ localization ส่วนใหญ่จัดอยู่ในหนึ่งในสามหมวดหมู่นี้:

| หมวดหมู่ | ตัวอย่าง | รูปแบบ |
|----------|----------|-------|
| **Cloud TMS Platforms** | Crowdin, Phrase, Locize, Tolgee | แดชบอร์ด SaaS + นักแปลมนุษย์ + ค่าสมัครรายเดือน |
| **Key Extraction Tools** | i18next-scanner, FormatJS CLI | สแกนซอร์สโค้ดเพื่อค้นหาการเรียกใช้ฟังก์ชันแปลภาษา |
| **CLI Translation Engines** | **champollion** | รันในโปรเจกต์ของคุณ แปลไฟล์โดยตรง ไม่ต้องมีบัญชี cloud |

Champollion คือ **CLI translation engine** — แปลไฟล์ locale ของคุณโดยตรงโดยใช้ backend ที่กำหนดค่าได้ (LLMs, Google Translate, custom plugins) ไม่มีแดชบอร์ด cloud ไม่มีขั้นตอนการทำงานของนักแปลมนุษย์ ไม่มีค่าบริการรายเดือน

---

## การเปรียบเทียบฟีเจอร์

| คุณสมบัติ | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **ทำงานแบบโลคัล (ไม่ต้องใช้บัญชีคลาวด์)** | ✅ | ❌ | ❌ | ❌ |
| **มี dependency น้อยที่สุด** | ✅ | ❌ | ❌ | ❌ |
| **การกำหนดค่า method ตามคู่ภาษา** | ✅ | ❌ | ❌ | ❌ |
| **ระดับภาษาแบบกำหนดเอง** | ✅ | ❌ | ❌ | ❌ |
| **รับรู้บริบทของเนื้อหา (ปกป้อง code block)** | ✅ | ❌ | ❌ | ❌ |
| **รองรับภาษาประดิษฐ์ (Conlang) และการแปลงสคริปต์** | ✅ | ❌ | ❌ | ❌ |
| **สถาปัตยกรรมแบบปลั๊กอิน** | ✅ | ❌ | ❌ | ❌ |
| **การแปล Markdown / เนื้อหา** | ✅ | ✅ | ✅ | ❌ |
| **Translation Memory** | ✅ | ✅ | ✅ | ✅ |
| **การส่งออก/นำเข้า XLIFF** | ✅ | ✅ | ✅ | ❌ |
| **การตรวจสอบ ICU plural** | ✅ | ✅ | ✅ | ❌ |
| **การบังคับใช้คำศัพท์เฉพาะ** | ✅ | ✅ | ✅ | ❌ |
| **เวิร์กโฟลว์สำหรับนักแปลที่เป็นมนุษย์** | อิงตาม XLIFF | ✅ | ✅ | ✅ |
| **การแก้ไขตามบริบท (แบบเห็นภาพ)** | ❌ | ✅ | ✅ | ✅ |
| **การทำงานร่วมกันเป็นทีม** | ❌ | ✅ | ✅ | ✅ |
| **การรองรับรูปแบบไฟล์** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **ราคา** | ฟรีสำหรับการใช้งานที่ไม่ใช่เชิงพาณิชย์ (จ่ายเฉพาะค่า LLM ของคุณ) | เริ่มต้น $0/เดือน | เริ่มต้น $0/เดือน | เริ่มต้น $0/เดือน |

---

## เมื่อใดควรใช้ Champollion

**Champollion เหมาะสมเมื่อ:**

- คุณต้องการ machine translation ที่ฝังอยู่ใน build pipeline โดยตรง ไม่ใช่ขั้นตอนการทำงานแยกต่างหาก
- คุณต้องการควบคุม method แยกตามภาษา (LLM สำหรับบางภาษา, Google Translate สำหรับภาษาอื่น, custom plugins สำหรับที่เหลือ)
- คุณกำลังแปลเป็นภาษาที่ไม่มี API รองรับ (ภาษาพื้นเมือง, ภาษาที่ใกล้สูญหาย, ภาษาประดิษฐ์)
- คุณต้องการผลลัพธ์ script ที่แน่นอน (Cree Syllabics, Klingon pIqaD, Tengwar)
- คุณต้องการหลีกเลี่ยงการผูกติดกับ vendor และ cloud dependencies
- คุณเป็นนักพัฒนาเดี่ยวหรือทีมขนาดเล็กที่ไม่ต้องการแดชบอร์ด TMS เต็มรูปแบบ
- คุณต้องการส่งมอบงานผ่าน XLIFF ให้นักแปลมืออาชีพโดยไม่ต้องสมัครใช้บริการ cloud

**Cloud TMS เหมาะสมกว่าเมื่อ:**

- คุณมีนักแปลมนุษย์มืออาชีพตรวจสอบทุก string (ขั้นตอน XLIFF ของ champollion เรียบง่ายกว่า TMS เต็มรูปแบบ)
- คุณต้องการ translation memory และการจัดการ glossary ข้ามโปรเจกต์
- คุณต้องการ in-context visual editing (ดูตัวอย่างการแปลภายใน UI ของคุณ)
- คุณมีทีมขนาดใหญ่ที่ต้องการการควบคุมการเข้าถึงตามบทบาท
- คุณต้องการรองรับรูปแบบไฟล์มากกว่า 50 รูปแบบ

---

## สิ่งที่ Champollion ทำได้ที่ไม่มีใครทำได้

### 1. Custom Registers

คู่ภาษาทุกคู่จะได้รับคำแนะนำโทนเสียงที่เหมาะสมทางวัฒนธรรมสำหรับ LLM:

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

ไม่มีเครื่องมืออื่นใดที่มาพร้อม language registers ที่กำหนดค่าไว้ล่วงหน้า 47 รายการ หรือให้คุณกำหนด custom registers ต่อโปรเจกต์ได้

### 2. Deterministic Script Converters

Champollion มาพร้อม script converters ในตัว 5 รายการที่ทำงานเป็น post-translation hooks — ไม่ต้องใช้ LLM:

| Locale | การแปลง | ตัวอย่าง |
|--------|-----------|---------|
| `crk` | SRO → Cree Syllabics | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latin → Cyrillic | `Beograd` → `Београд` |
| `tlh` | Romanization → pIqaD | `tlhIngan Hol` → (pIqaD glyphs) |
| `x-elvish-s` | Latin → Tengwar | Sindarin → Tengwar (Mode of Beleriand) |
| `x-kryptonian` | Latin → Kryptonian | Cipher-substitution (requires font) |

เหล่านี้คือ converters แบบ pure lookup-table — แน่นอน, ตรวจสอบได้, ไม่มีความเสี่ยงจาก LLM hallucination

### 3. Content-Aware Shielding

เมื่อแปล Markdown หรือ rich content, Champollion จะป้องกัน:

- Fenced code blocks (` ``` `)
- Inline code (`` ` ` ``)
- Hugo shortcodes (`{{</* */>}}`, `{{%/* */%}}`)
- Interpolation variables (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Raw HTML blocks

สิ่งเหล่านี้จะถูกแทนที่ด้วย Unicode sentinel tokens ก่อนการแปลและคืนค่ากลับหลังจากนั้น LLM จะไม่เห็นโค้ด, shortcodes, หรือตัวแปรของคุณเลย

### 4. Coached Method Plugins

สำหรับภาษาที่ไม่มี API รองรับ คุณสามารถสร้าง coached translation method ได้:

1. เขียนข้อมูล linguistic coaching (กฎไวยากรณ์, คำศัพท์, ตัวอย่าง)
2. รวมเป็น plugin
3. ทดสอบเทียบกับการแปลอ้างอิงโดยใช้ [eval harness](https://github.com/gamedaysuits/Champollion)
4. ติดตั้งในโปรเจกต์ของคุณด้วย `champollion plugin install`

นี่คือวิธีที่ champollion จัดการกับ Plains Cree — และวิธีที่คุณสามารถจัดการกับภาษาใดก็ได้ รวมถึงภาษาที่ยังไม่มีอยู่

---

## สรุป

Champollion ไม่ใช่ตัวแทนของ Crowdin แต่เป็นเครื่องมือที่แตกต่างสำหรับขั้นตอนการทำงานที่แตกต่างกัน หากคุณต้องการนักแปลมนุษย์ ให้ใช้ TMS หากคุณต้องการ CLI ที่แปลไฟล์ของคุณด้วยคำสั่งเดียวและให้คุณควบคุม methods, models, และ registers แยกตามภาษา — ให้ใช้ champollion
