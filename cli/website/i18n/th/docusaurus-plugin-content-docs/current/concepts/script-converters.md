---
sidebar_position: 6
title: "ตัวแปลงสคริปต์"
---

# Script Converters

Script converters คือ post-translation hooks แบบ deterministic ที่ไม่ใช้ LLM สำหรับแปลงข้อความจากระบบการเขียนหนึ่งไปยังอีกระบบหนึ่ง รองรับ workflow แบบ "แปลครั้งเดียว แสดงผลได้หลาย script" — คุณแปลเป็น script ที่ใช้งานได้ (โดยทั่วไปคือ Latin) แล้วแปลงเป็น script สำหรับแสดงผลโดยอัตโนมัติ

## ทำไมต้องใช้ Script Converters?

บางภาษาใช้หลาย script สำหรับภาษาพูดเดียวกัน:

- **Plains Cree**: SRO (Latin) สำหรับการแก้ไข → Syllabics (ᓀᐦᐃᔭᐍᐏᐣ) สำหรับแสดงผล
- **Serbian**: Latin สำหรับการใช้งานระดับสากล → Cyrillic สำหรับการใช้งานภายในประเทศ
- **Klingon**: Romanization สำหรับการพิมพ์ → pIqaD (  ) สำหรับแสดงผล

การแปลโดยตรงเป็น script ที่ไม่ใช่ Latin ก่อให้เกิดปัญหา: LLM สร้างตัวอักษรที่ผิดพลาด, ไฟล์ JSON ควบคุมเวอร์ชันได้ยาก, และ diff tools ไม่สามารถเปรียบเทียบการเปลี่ยนแปลงได้ Script converters แก้ปัญหานี้โดยเก็บการแปลไว้ใน script ที่เหมาะกับการควบคุมเวอร์ชัน และแปลงแบบ deterministic ในขณะ sync

## Converters ที่มีให้ใช้งาน

Champollion มี script converters ในตัวห้าตัว:

| Locale | จาก | ไปยัง | ประเภท | ต้องใช้ Font? |
|--------|------|--------|--------|--------------|
| `crk` | SRO (Standard Roman Orthography) | Cree Syllabics | Deterministic | ไม่ — Unicode มาตรฐาน |
| `sr` | Latin | Cyrillic | Deterministic | ไม่ — Unicode มาตรฐาน |
| `tlh` | Romanization | pIqaD | Deterministic | ใช่ — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latin | Tengwar (Mode of Beleriand) | Deterministic | ใช่ — PUA U+E000–E07F |
| `x-kryptonian` | Latin | Kryptonian | Font-based cipher | ใช่ — PUA U+E100–E119 |

### Deterministic vs. Font-Based

- **Deterministic converters** (Cree, Serbian, Klingon, Tengwar) ทำการ mapping ตัวอักษรต่อตัวอักษรโดยใช้กฎทางภาษาศาสตร์ ผลลัพธ์ประกอบด้วยตัวอักษร Unicode จริง
- **Font-based converters** (Kryptonian) คือ substitution cipher แบบ 1:1 ที่ผลลัพธ์เป็นตัวอักษร Unicode PUA ซึ่งแสดงผลได้ถูกต้องเฉพาะเมื่อโหลด font เฉพาะเจาะจงเท่านั้น

## วิธีการทำงาน

Script converters ทำงาน **หลังจาก** การแปลในฐานะขั้นตอน post-processing โดย pipeline คือ:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

ตัวอย่างเช่น ภาษา Plains Cree:
```
"Welcome" → LLM → <its translation, in SRO> → Converter → <the same text, in Syllabics>
```

ตัวแปลงจะจับคู่การสะกดคำ ไม่ใช่คำศัพท์: พยางค์ `pâ tê ki` (ตัวอย่างการสะกด ไม่ใช่คำศัพท์) จะกลายเป็น `ᐹ ᑌ ᑭ`

### การจับคู่แบบ Greedy Left-to-Right

Converters ทั้งหมดใช้อัลกอริทึมเดียวกัน: ที่แต่ละตำแหน่งตัวอักษร จะลองจับคู่ที่ยาวที่สุดก่อน แล้วจึงลองจับคู่ที่สั้นลงตามลำดับ ตัวอักษรที่ไม่ตรงกับรูปแบบใด (เว้นวรรค, เครื่องหมายวรรคตอน, ตัวเลข) จะผ่านไปโดยไม่เปลี่ยนแปลง

วิธีนี้จัดการ digraphs และ trigraphs ได้อย่างถูกต้อง:
- Klingon: `tlh` → ตัวอักษร pIqaD ตัวเดียว (ไม่ใช่ `t` + `l` + `h`)
- Serbian: `nj` → `њ` (ไม่ใช่ `н` + `ј`)
- Cree: `twê` → syllabic ตัวเดียว (ไม่ใช่ `t` + `w` + `ê`)

## การใช้งาน Script Converters

การแปลงอักษรเป็น **การตัดสินใจผ่านการกำหนดค่า ไม่เคยทำโดยอัตโนมัติ** (ตั้งแต่เวอร์ชัน 0.3.0 เป็นต้นมา — เวอร์ชันก่อนหน้านี้จะแปลงโดยไม่มีเงื่อนไข ซึ่งส่งผลให้ส่งออกข้อความ PUA ที่ไม่สามารถแสดงผลได้ไปยังโปรเจกต์ที่ฟอนต์รองรับเฉพาะการถอดอักษรละติน):

- **crk และ sr มีระบบการเขียนจริงสองระบบ** (SRO/Syllabics, ละติน/ซีริลลิก) ไม่มีการกำหนดค่าเริ่มต้น: `champollion init` จะถามว่าต้องการเขียนด้วยระบบใด และ `sync` จะปฏิเสธการทำงานจนกว่าจะมีการระบุในการกำหนดค่า Champollion จะไม่ตัดสินใจเลือกระบบการเขียนของชุมชนแทนคุณ
- **tlh, x-elvish-s และ x-kryptonian จะใช้การแปลงเป็นอักษรโรมันเป็นค่าเริ่มต้น** — อักษรสำหรับแสดงผลของภาษาเหล่านี้อยู่ใน Private Use Area ซึ่งไม่สามารถแสดงผลได้หากไม่มีฟอนต์พิเศษ ต้องเลือกเปิดใช้งานอย่างชัดเจน

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

เมื่อ Champollion ซิงค์ `en:crk` ด้วย `"script": "Cans"` คำแปลจะถูกสร้างขึ้นในรูปแบบ SRO (อักษรที่ใช้ทำงานซึ่งเกตจะตรวจสอบความถูกต้อง) จากนั้นจึงแปลงเป็น Syllabics ก่อนที่จะเขียนลงใน `crk.json` หากตั้งค่าเป็น `"script": "Latn"` — หรือสำหรับ tlh ที่ไม่มีการระบุ `script:` เลย — อักษรที่ใช้ทำงานจะเป็นผลลัพธ์สุดท้ายและจะไม่มีสิ่งใดถูกแปลง

ตัวอักษรที่ตัวแปลงไม่สามารถจับคู่ได้ (ภาษาคลิงงอนไม่มี `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z` — ดังนั้น "GitHub" จึงไม่สามารถแปลงได้ครบถ้วน) จะคง **ค่าทั้งหมด** ไว้ในอักษรที่ใช้ทำงานแทนที่จะใช้อักษรผสมกัน พร้อมทั้งมีคำเตือนระบุตัวอักษรเหล่านั้น คุณสามารถประกาศกฎการถอดอักษรของคุณเองได้ที่ [`scriptFallback`](/docs/getting-started/configuration#script-fallback)

หากต้องการเลิกทำการแปลงที่เกิดขึ้นในตอนที่ยังเป็นแบบไม่มีเงื่อนไข ให้รัน [`champollion repair-script`](/docs/getting-started/configuration#repair-script); คำสั่ง `champollion integrity` จะล้มเหลวหากพบ PUA ในตำแหน่งที่ปิดการแปลงอักษรไว้

### การตรวจสอบสถานะ Converter

```bash
npx champollion status
```

ผลลัพธ์ของสถานะจะแสดงการตัดสินใจเลือกระบบอักษรที่ได้รับการแก้ไขแล้วของแต่ละคู่ — สิ่งที่จะถูกเขียนลงไป และแสดงว่ามีตัวแปลงที่พร้อมใช้งานแต่ไม่ได้เปิดใช้งานหรือไม่

## ข้อกำหนด Web Font

Converters สามตัวส่งออกตัวอักษร Unicode Private Use Area (PUA) ที่ต้องใช้ web fonts แบบกำหนดเอง:

### Klingon (pIqaD)

ติดตั้ง font pIqaD ที่รองรับ CSUR (เช่น "pIqaD qolqoS" หรือ "Klingon pIqaD HaSta"):

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar (Sindarin)

ติดตั้ง font Tengwar ที่รองรับ CSUR (เช่น "Tengwar Formal CSUR", "Tengwar Annatar"):

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### Kryptonian

ติดตั้ง font Kryptonian ที่ map กับ PUA codepoints U+E100–E119:

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[แนวทางอื่นสำหรับ Kryptonian]
เนื่องจาก Kryptonian เป็นรหัสแบบ A-Z ล้วนๆ คุณสามารถข้ามตัวแปลงสคริปต์ไปได้เลย และใช้ฟอนต์กับข้อความ Latin ผ่าน CSS แทน วิธีนี้มักจะง่ายกว่าสำหรับการใช้งานบนเว็บ — เพียงแค่ให้บริการฟอนต์ Kryptonian และตั้งค่า `font-family` บนองค์ประกอบที่เกี่ยวข้อง
:::

## การเพิ่ม Custom Converter

หากต้องการเพิ่ม converter สำหรับภาษาใหม่ ให้แก้ไข `lib/scripts.js`:

1. **สร้างแผนผังการแปลง (conversion map)** — อาร์เรย์ที่เรียงลำดับของคู่ `[from, to]` โดยเรียงลำดับลำดับอักขระที่ยาวที่สุดขึ้นก่อน
2. **สร้างฟังก์ชันตัวแปลง** — ตัวสแกนแบบ greedy จากซ้ายไปขวา (ใช้ `latinToCyrillicSr` เป็นเทมเพลต) ในกรณีที่มีตัวแปลงที่ดูแลโดยชุมชนอยู่แล้ว ให้ใช้ตัวแปลงนั้นแทนที่จะสร้างตารางขึ้นมาเอง: Plains Cree จะส่งต่องานไปยัง `cree-sro-syllabics` ซึ่งเป็นตัวแปลงที่ itwêwina ของ ALTLab ใช้งาน
3. **ลงทะเบียน** ในออบเจกต์ `SCRIPT_CONVERTERS` โดยใช้รหัสภาษา (locale code) เป็นคีย์
4. **เพิ่มฟิลด์ `script`** ลงในรายการลงทะเบียนของภาษานั้นใน `registers.js`

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## ดูเพิ่มเติม

- [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) — PUA fonts, Unicode, การเพิ่ม converters ใหม่
- [Quality Gate](/docs/concepts/quality-gate) — การตรวจสอบที่ทำงานก่อน script conversion
- [Supported Languages](/docs/reference/supported-languages) — ภาษาใดที่มี script converters
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — SRO→Syllabics ในบริบท
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — script conversion ใน multi-stage pipeline
