---
sidebar_position: 3
title: "ภาษาประดิษฐ์ สคริปต์ และอักขรวิธี"
---

# ภาษาสร้าง, อักษร และอักขรวิธี

champollion รองรับภาษาสร้าง (constructed languages) อย่างเต็มรูปแบบผ่าน LLM registers และตัวแปลงอักษรแบบ deterministic คู่มือนี้อธิบายการทำงานของระบบรองรับภาษาสร้าง ฟอนต์ที่จำเป็น และวิธีเพิ่มภาษาของคุณเอง

:::tip[เหตุใด conlang จึงมีความสำคัญ]
Conlang ไม่ใช่แค่ความแปลกใหม่ — แต่เป็นการทดสอบโครงสร้างพื้นฐานเดียวกันกับที่ใช้กับภาษาที่ขาดแคลนทรัพยากรจริงๆ ระบบตรวจสอบคุณภาพ ระบบ coaching และ pipeline การแปลงสคริปต์ทำงานเหมือนกันทุกประการสำหรับทั้ง Klingon และ Plains Cree หาก pipeline ของ conlang คุณทำงานได้ pipeline สำหรับภาษาที่มีทรัพยากรน้อยก็จะทำงานได้เช่นกัน
:::

---

## ภาษาสร้างที่รองรับ

| ภาษา | รหัส | ตัวแปลงอักษร | ต้องการฟอนต์ |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ Romanization → pIqaD | PUA font (เช่น pIqaD qolqoS) |
| Sindarin (Tolkien Elvish) | `x-elvish-s` | ✅ Latin → Tengwar | CSUR PUA font |
| Kryptonian | `x-kryptonian` | ✅ Latin → Kryptonian | PUA font |
| Pirate English | `x-pirate` | ❌ register เท่านั้น | ไม่มี |
| Shakespearean English | `x-shakespeare` | ❌ register เท่านั้น | ไม่มี |
| Yoda-speak | `x-yoda` | ❌ register เท่านั้น | ไม่มี |

รหัสภาษาสร้างใช้คำนำหน้า `x-` ตามข้อกำหนด BCP-47 private-use ยกเว้น Klingon (`tlh`) ซึ่งมีรหัส [ISO 639-3](https://iso639-3.sil.org/code/tlh) ที่กำหนดโดย SIL International

---

## Unicode, PUA และข้อกำหนดด้านฟอนต์

### Private Use Area

Klingon (pIqaD), Sindarin (Tengwar) และ Kryptonian ใช้อักขระ Unicode **Private Use Area (PUA)** PUA คือช่วง U+E000–U+F8FF — codepoints เหล่านี้**ไม่มีการกำหนดมาตรฐาน** [ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) ดูแลรักษาการแมปที่ชุมชนตกลงร่วมกันสำหรับอักษรในจินตนาการ แต่ไม่ได้เป็นส่วนหนึ่งของมาตรฐาน Unicode

ผลกระทบในทางปฏิบัติ:

- ข้อความ PUA จะแสดงเป็น**กล่องว่าง** (□□□) หากไม่ได้โหลดฟอนต์ที่ถูกต้อง
- ฟอนต์ต่างกันอาจแมป glyph ต่างกันไปยัง codepoint PUA เดียวกัน
- champollion ไม่ได้รวม PUA fonts มาด้วย — คุณต้องโหลดเองเอง
- ฟอนต์ระบบจะไม่แสดงอักขระเหล่านี้

### ช่วง PUA แยกตามอักษร

| อักษร | ช่วง PUA | อ้างอิง CSUR |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elvish) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | ขึ้นอยู่กับฟอนต์ | ไม่มีมาตรฐาน CSUR |

### การโหลด PUA Web Fonts

champollion มีคำสั่งในตัวสำหรับดาวน์โหลดและจัดการ PUA web fonts:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

คำสั่ง `fonts install` ดาวน์โหลดจาก repository open-source ที่ผ่านการตรวจสอบ:

| ฟอนต์ | อักษร | สัญญาอนุญาต | แหล่งที่มา |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (พร้อม font exception) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(ผู้ใช้จัดหาเอง)* | Kryptonian | แตกต่างกัน | ไม่มี PUA font open-source ให้ใช้ |

ไดเรกทอรีเอาต์พุตถูกตรวจจับอัตโนมัติจากโครงสร้างโปรเจกต์ของคุณ (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, ค่าเริ่มต้น → `public/fonts/`) แทนที่ด้วย `--dir`

หากคุณต้องการจัดการฟอนต์เอง ให้เพิ่มกฎ `@font-face` ใน CSS ของคุณ:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[การรองรับ Unicode ไม่ได้รับการรับประกัน]
Unicode Consortium ได้[ปฏิเสธอย่างชัดเจน](https://www.unicode.org/faq/private_use.html)ที่จะเข้ารหัสสคริปต์สมมติในมาตรฐาน การกำหนด PUA ดูแลโดยชุมชนและอาจขัดแย้งกันระหว่างการใช้งานฟอนต์ต่างๆ ควรระบุฟอนต์ที่โปรเจกต์ของคุณใช้อย่างชัดเจน และทดสอบการแสดงผลในเบราว์เซอร์ต่างๆ เสมอ
:::

---

## ตัวแปลงอักษร

### หลักการทำงาน

การแปลงระบบการเขียนของ champollion เป็น **hook หลังการแปลภาษา (post-translation hook) ซึ่งจะถูกนำมาใช้เมื่อการกำหนดค่าระบุไว้เท่านั้น**:

1. LLM จะแปลข้อความเป็น **ระบบการเขียนที่ใช้ทำงาน (working script)** (โดยทั่วไปคืออักษรละตินหรือ SRO)
2. [Quality gate](/docs/concepts/quality-gate) จะตรวจสอบความถูกต้องของผลลัพธ์
3. หากการตั้งค่า `script:` ของคู่นั้นระบุระบบการเขียนสำหรับการแสดงผล ตัวแปลงแบบ deterministic จะแปลงข้อความที่ผ่านการตรวจสอบแล้ว — ค่าที่มีตัวอักษรซึ่งตัวแปลงไม่สามารถจับคู่ได้จะคงเดิมไว้ทั้งคำในระบบการเขียนที่ใช้ทำงาน พร้อมแสดงคำเตือนแยกตามคีย์
4. เขียนผลลัพธ์ลงในดิสก์

แนวทางสองขั้นตอนนี้ทำงานได้เพราะ LLM ให้ผลลัพธ์ที่ดีกว่าเมื่อทำงานกับอักษรที่ใช้ Latin เป็นฐาน ตัวแปลง deterministic รับประกันผลลัพธ์อักษรที่ถูกต้องโดยไม่ต้องพึ่งพาความรู้ด้านอักษรของโมเดล (ซึ่งมักไม่น่าเชื่อถือ)

ขั้นตอนที่ 3 จะทำงานหรือไม่นั้นขึ้นอยู่กับการตัดสินใจของแต่ละโปรเจกต์ — ดูที่ [Script Conversion](/docs/getting-started/configuration#script-conversion) ทั้งนี้ระบบการเขียนสำหรับการแสดงผลแบบ PUA (pIqaD, Tengwar, Kryptonian) จะถูกปิดไว้โดยค่าเริ่มต้น เนื่องจากจะไม่สามารถแสดงผลได้เลยหากไม่มีฟอนต์ที่สร้างขึ้นมาโดยเฉพาะ ส่วน crk และ sr จะไม่มีค่าเริ่มต้นใดๆ เลย เนื่องจากอักขรวิธีทั้งสองแบบต่างก็ใช้งานจริง และการตัดสินใจเลือกควรขึ้นอยู่กับโปรเจกต์

### ตัวแปลงทั้งห้า

champollion มาพร้อมตัวแปลงอักษรในตัวห้าตัว:

#### Plains Cree: SRO → Syllabics (`crk`)

Standard Roman Orthography เป็น Canadian Aboriginal Syllabics

```
Input:  "pâ tê ki"    (syllables, a spelling example — not a word)
Output: "ᐹ ᑌ ᑭ"
```

สระเสียงยาวจะใช้เครื่องหมาย circumflex (หรือ macron): ê, î, ô, â การแปลงจะดำเนินการโดย `cree-sro-syllabics` ซึ่งเป็นตัวแปลงที่ดูแลโดยชุมชนและใช้งานโดย itwêwina ของ ALTLab ตัวแทนข้อความ (placeholders), ไวยากรณ์ ICU, แท็ก และ URL จะถูกคงไว้โดยไม่มีการแตะต้อง ดูรายละเอียดไปป์ไลน์ภาษาครีฉบับเต็มได้ที่ [Support a Low-Resource Language](/docs/network/community/low-resource-languages)

#### Serbian: Latin → Cyrillic (`sr`)

การแปลง Latin เป็น Cyrillic แบบ deterministic สำหรับภาษา Serbian

```
Input:  "zdravo"
Output: "здраво"
```

รองรับการแมปตัวอักษร Serbian ทั้งหมด รวมถึง digraphs (lj → љ, nj → њ, dž → џ)

#### Klingon: Romanization → pIqaD (`tlh`)

ระบบ romanization ของ Marc Okrand เป็นอักขระ pIqaD PUA

```
Input:  "tlh gh Q"   (romanized letters, a spelling example — tlh is one letter)
Output: [pIqaD PUA]  (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

การแมป Tengwar แบบ Sindarin mode ของ Tolkien

```
Input:  "la ne mi"   (Latin letters, a spelling example — not a word)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian: Latin → Kryptonian (`x-kryptonian`)

การแมปอักษร Kryptonian จาก fan-lexicon

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### การเรียกใช้ตัวแปลง

กำหนดฟิลด์ `script` เป็นรหัส ISO 15924 ของอักขรวิธีที่คุณต้องการให้เขียน:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

หากไม่มีสิ่งนี้ จะไม่มีการแปลงใดๆ เกิดขึ้น สำหรับ `crk` และ `sr` ฟิลด์นี้เป็นฟิลด์ที่ **จำเป็น (required)** — เนื่องจากอักขรวิธีทั้งสองแบบต่างก็ใช้งานจริง และ `sync` จะไม่เลือกแทนคุณ สำหรับโลแคล PUA จะเป็นการเลือกเปิดใช้งาน (opt-in) เพิ่มเติมจากค่าเริ่มต้นที่เป็นการถอดอักษรเป็นละติน ดูที่ [Script Conversion](/docs/getting-started/configuration#script-conversion)

---

## ภาษาที่ใช้หลายอักษร

ภาษาจริงบางภาษาใช้หลายอักษรที่ยังคงใช้งานอยู่:

| ภาษา | ระบบการเขียน | แนวทางของ champollion |
|----------|---------|-----------------|
| เซอร์เบีย | ละติน + ซิริลลิก | โลแคลเดียว ระบุตัวเลือกชัดเจน: `"script": "Cyrl"` จะแปลง, `"script": "Latn"` จะคงอักษรละตินไว้ |
| ครีที่ราบ (Plains Cree) | SRO (ละติน) + พยางค์ (Syllabics) | โลแคลเดียว ระบุตัวเลือกชัดเจน: `"script": "Cans"` หรือ `"script": "Latn"` |
| จีน | ตัวย่อ + ตัวเต็ม | แยกโค้ดโลแคลออกจากกัน (`zh` เทียบกับ `zh-TW`) พร้อมระดับภาษา (register) ที่แตกต่างกัน |

สำหรับภาษาที่ทั้งสองระบบการเขียนมีไว้สำหรับกลุ่มเป้าหมายเดียวกัน (เซอร์เบีย, ครีที่ราบ) การใช้โลแคลเดียวร่วมกับตัวเลือก `script` ที่ระบุอย่างชัดเจนจะช่วยคงไปป์ไลน์การแปลไว้เพียงชุดเดียว ส่วนภาษาที่ระบบการเขียนมีไว้สำหรับกลุ่มเป้าหมายที่แตกต่างกัน (จีนตัวย่อสำหรับจีนแผ่นดินใหญ่, จีนตัวเต็มสำหรับไต้หวัน/ฮ่องกง) ให้ใช้โค้ดโลแคลแยกจากกัน

---

## หมายเหตุด้านอักขรวิธี

Register ไม่ใช่แค่ระดับภาษา — แต่ยังมี**คำแนะนำด้านอักขรวิธี**ที่ชี้นำ LLM ไปสู่รูปแบบการเขียนที่ถูกต้อง

### รูปแบบการเรียกขานอย่างเป็นทางการ

register ในตัวของ champollion มีรูปแบบการเรียกขานอย่างเป็นทางการที่เหมาะสมทางวัฒนธรรมสำหรับแต่ละภาษา:

| ภาษา | รูปแบบทางการ | คำแนะนำใน Register |
|----------|------------|---------------------|
| German | Sie | `Use Sie-form for formal address` |
| French | vous | `Use vous-form` |
| Russian | вы | `Professional register with вы-form` |
| Turkish | siz | `Professional register with siz-form` |
| Korean | 합쇼체 | `Formal Korean (합쇼체)` |
| Japanese | です/ます | `Polite professional register (です/ます form)` |
| Polish | Pan/Pani | `Professional register with Pan/Pani form` |

### การเขียนแบบครอบคลุมทางเพศ

การ์ดแต่ละภาษามีฟิลด์ `gender.inclusiveGuidance` พร้อมคำแนะนำเฉพาะภาษา ฟิลด์นี้ถูกแทรกเข้าใน prompt การแปลของ LLM แยกจาก register preset ดังนั้นจึงใช้งานได้สม่ำเสมอโดยไม่ขึ้นกับ preset ความเป็นทางการที่ผู้ใช้เลือก:

- **French**: Écriture inclusive ด้วยสัญลักษณ์ interpunct (เช่น "Connecté·e")
- **German**: สัญลักษณ์ Doppelpunkt (เช่น "Benutzer:innen")
- **Spanish**: นิยมการปรับโครงสร้างให้เป็นกลางทางเพศ; สัญลักษณ์ slash (เช่น "usuario/a") เป็นทางเลือกสำรอง

สำหรับภาษาที่ไม่มีคำแนะนำเฉพาะในการ์ด (เช่น Korean, ภาษาสร้าง) ระบบจะใช้กฎทั่วไปแทน: *"นิยมรูปแบบที่เป็นกลางทางเพศหรือตัวเลือกที่ครอบคลุมที่สุดที่มี"*

### ข้อกำหนดสำหรับอักษร RTL

register ภาษา Arabic, Hebrew, Persian และ Urdu ทั้งหมดระบุข้อกำหนดการเขียนจากขวาไปซ้าย: `Ensure text reads naturally in RTL layout contexts.`

### การแทนที่ Register ใดก็ได้

ทุก register เป็นค่า config — แทนที่เพื่อให้ตรงกับเสียงของโปรเจกต์คุณ:

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

ดู [การกำหนดค่า](/docs/getting-started/configuration) สำหรับเอกสารอ้างอิง config แบบเต็ม

---

## การเพิ่มภาษาสร้างใหม่

### ขั้นตอน

1. **เลือกรหัส BCP-47 private-use**: ใช้คำนำหน้า `x-` (เช่น `x-dothraki`, `x-valyrian`)

2. **เพิ่มในการกำหนดค่าของคุณ**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(ไม่บังคับ) เพิ่มตัวแปลงอักษร**: หากภาษาสร้างของคุณใช้อักษรแสดงผลที่ไม่ใช่ Latin ให้เพิ่มตัวแปลงใน `lib/scripts.js` และลงทะเบียนใน `SCRIPT_CONVERTERS`

4. **ทดสอบ**: รัน `champollion sync --dry` เพื่อดูตัวอย่างการแปลโดยไม่เขียนไฟล์

5. **ตรวจสอบ quality gate**: [quality gate](/docs/concepts/quality-gate) อาจต้องปรับแต่งสำหรับภาษาสร้างของคุณ — โดยเฉพาะการตรวจสอบ `requireNonLatin` หากภาษาสร้างของคุณใช้อักขระ PUA

:::note[คุณภาพของ conlang ขึ้นอยู่กับความรู้ของ LLM]
LLM สามารถแปลเป็น conlang ได้เฉพาะภาษาที่ปรากฏในข้อมูลการฝึกเท่านั้น Conlang ที่มีเอกสารประกอบครบถ้วน (Klingon, Sindarin, Dothraki) ทำงานได้ดี ส่วน conlang ที่ไม่เป็นที่รู้จักหรือสร้างขึ้นใหม่อาจให้ผลลัพธ์ที่ไม่สม่ำเสมอ ใช้[ข้อมูล coaching](/docs/concepts/coaching-data)เพื่อปรับปรุงคุณภาพ
:::

---

## ดูเพิ่มเติม

- [ภาษาที่รองรับ](/docs/reference/supported-languages) — ตารางภาษาทั้งหมดพร้อมความพร้อมใช้งานของแต่ละวิธี
- [ตัวแปลงอักษร](/docs/concepts/script-converters) — รายละเอียดทางเทคนิคของ pipeline การแปลง
- [วิธีการแปล](/docs/guides/translation-methods) — การทำงานของแต่ละวิธีการแปล
- [การกำหนดค่า](/docs/getting-started/configuration) — เอกสารอ้างอิง config รวมถึงการตั้งค่าภาษาและ register
- [รองรับภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages) — โครงสร้างพื้นฐานเดียวกันที่ใช้กับภาษาที่ขาดแคลนทรัพยากรจริงๆ
