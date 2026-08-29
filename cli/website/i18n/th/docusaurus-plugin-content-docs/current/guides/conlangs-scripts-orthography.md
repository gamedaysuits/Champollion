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

การแปลงสคริปต์ของ champollion เป็น **post-translation hook ซึ่งจะทำงานก็ต่อเมื่อมีการระบุไว้ใน config เท่านั้น**:

1. LLM จะแปลข้อความให้อยู่ใน **working script** (มักจะเป็น Latin หรือ SRO)
2. [quality gate](/docs/concepts/quality-gate) จะตรวจสอบความถูกต้องของผลลัพธ์
3. หากการตั้งค่า `script:` ของคู่ภาษาเลือก display script ตัวแปลงแบบ deterministic จะทำการแปลงข้อความที่ผ่านการตรวจสอบแล้ว — ค่าที่มีตัวอักษรที่ตัวแปลงไม่สามารถจับคู่ได้จะยังคงอยู่ใน working script ตามเดิม โดยจะมีการแจ้งเตือนเป็นรายคีย์
4. ผลลัพธ์จะถูกเขียนลงดิสก์

แนวทางสองขั้นตอนนี้ทำงานได้เพราะ LLM ให้ผลลัพธ์ที่ดีกว่าเมื่อทำงานกับอักษรที่ใช้ Latin เป็นฐาน ตัวแปลง deterministic รับประกันผลลัพธ์อักษรที่ถูกต้องโดยไม่ต้องพึ่งพาความรู้ด้านอักษรของโมเดล (ซึ่งมักไม่น่าเชื่อถือ)

การที่ขั้นตอนที่ 3 จะทำงานหรือไม่นั้นขึ้นอยู่กับการตัดสินใจของแต่ละโปรเจกต์ — ดู [Script Conversion](/docs/getting-started/configuration#script-conversion) สคริปต์แสดงผลแบบ PUA (pIqaD, Tengwar, Kryptonian) จะถูกปิดใช้งานเป็นค่าเริ่มต้น เนื่องจากสคริปต์เหล่านี้จะไม่แสดงผลใดๆ หากไม่มีฟอนต์ที่สร้างขึ้นมาโดยเฉพาะ ส่วน crk และ sr จะไม่มีค่าเริ่มต้นเลย เนื่องจากระบบการเขียน (orthographies) ของทั้งสองภาษานั้นมีการใช้งานจริง และการตัดสินใจเลือกใช้จะเป็นสิทธิ์ของโปรเจกต์

### ตัวแปลงทั้งห้า

champollion มาพร้อมตัวแปลงอักษรในตัวห้าตัว:

#### Plains Cree: SRO → Syllabics (`crk`)

Standard Roman Orthography เป็น Canadian Aboriginal Syllabics

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

สระยาวใช้ macron/circumflex: ê, î, ô, â ตัวแปลงจัดการ diacritics ทั้งหมดของ SRO และแมปไปยังอักขระ syllabic ที่ถูกต้อง ดู [รองรับภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages) สำหรับ pipeline Cree แบบเต็ม

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
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

การแมป Tengwar แบบ Sindarin mode ของ Tolkien

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian: Latin → Kryptonian (`x-kryptonian`)

การแมปอักษร Kryptonian จาก fan-lexicon

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### การเรียกใช้ตัวแปลง

กำหนดค่าฟิลด์ `script` เป็นรหัส ISO 15924 ของระบบการเขียน (orthography) ที่คุณต้องการให้เขียนผลลัพธ์ออกมา:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

จะไม่มีการแปลงใดๆ เกิดขึ้นหากไม่มีการตั้งค่านี้ สำหรับ `crk` และ `sr` ฟิลด์นี้เป็น **สิ่งที่จำเป็นต้องระบุ (required)** — เนื่องจากระบบการเขียนของทั้งสองภาษานั้นมีการใช้งานจริง และ `sync` จะไม่ตัดสินใจเลือกแทนคุณ สำหรับ PUA locales การตั้งค่านี้จะเป็นแบบ opt-in เพื่อแทนที่ค่าเริ่มต้นที่เป็น romanization ดู [Script Conversion](/docs/getting-started/configuration#script-conversion)

---

## ภาษาที่ใช้หลายอักษร

ภาษาจริงบางภาษาใช้หลายอักษรที่ยังคงใช้งานอยู่:

| ภาษา | สคริปต์ | แนวทางของ champollion |
|----------|---------|-----------------|
| Serbian | Latin + Cyrillic | ใช้ locale เดียว, ระบุตัวเลือกชัดเจน: `"script": "Cyrl"` ทำการแปลง, `"script": "Latn"` คงอักษร Latin ไว้ |
| Plains Cree | SRO (Latin) + Syllabics | ใช้ locale เดียว, ระบุตัวเลือกชัดเจน: `"script": "Cans"` หรือ `"script": "Latn"` |
| Chinese | Simplified + Traditional | แยกใช้รหัส locale (`zh` กับ `zh-TW`) ซึ่งมีระดับภาษา (registers) ที่แตกต่างกัน |

สำหรับภาษาที่ทั้งสองสคริปต์รองรับกลุ่มผู้อ่านเดียวกัน (Serbian, Plains Cree) การใช้ locale เดียวร่วมกับการระบุตัวเลือก `script` อย่างชัดเจน จะช่วยให้คงกระบวนการแปล (translation pipeline) ไว้เป็นหนึ่งเดียวได้ สำหรับภาษาที่สคริปต์รองรับกลุ่มผู้อ่านที่แตกต่างกัน (Chinese Simplified สำหรับจีนแผ่นดินใหญ่, Traditional สำหรับไต้หวัน/ฮ่องกง) ให้แยกใช้รหัส locale

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
