---
sidebar_position: 4
title: "ภาษาที่รองรับ"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# ภาษาที่รองรับ

champollion มาพร้อมกับ **Language Cards** — ไฟล์การกำหนดค่าแบบมีโครงสร้างสำหรับ 50 ภาษา การ์ดแต่ละใบประกอบด้วยค่าพรีเซ็ตของ register ข้อมูล metadata ของระบบความเป็นทางการ แฟล็กการรองรับวิธีการแปล กฎการพิมพ์ และข้อมูลอักษร ภาษาใดก็ตามที่ LLM ของคุณรู้จักสามารถเพิ่มได้ด้วยการกำหนดค่าเพียงบรรทัดเดียว — เหล่านี้คือภาษาที่มี register ที่ผ่านการดูแลและพร้อมใช้งานในระดับ production

---

## วิธีการแปล

แต่ละภาษาสามารถใช้วิธีการแปลได้หนึ่งวิธีหรือมากกว่า:

| ไอคอน | วิธีการ | หลักการทำงาน | ค่าใช้จ่าย |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | พื้นฐาน Neural MT รองรับ 194 ภาษา เฉพาะสตริงแบบ key-value เท่านั้น — ไม่สามารถแปลเนื้อหา Markdown ได้อย่างปลอดภัย | ~$20/1 ล้านตัวอักษร |
| 🔵 | **LLM (OpenRouter)** | ภาษาใดก็ได้ที่โมเดลรู้จัก ใช้ prompt ที่ควบคุมระดับภาษา (register-steered) รองรับทั้ง key-value และเนื้อหา Markdown | ขึ้นอยู่กับโมเดล |
| 🟣 | **LLM-Coached** | LLM + พจนานุกรมไวยากรณ์ + ข้อมูลการสอน (coaching data) ที่แทรกเข้าไปใน prompt เหมาะที่สุดสำหรับภาษาที่มีความซับซ้อนทางสัณฐานวิทยา | ขึ้นอยู่กับโมเดล |
| 🟠 | **API (Plugin)** | ไปป์ไลน์การแปลที่โฮสต์โดยชุมชนและให้บริการผ่าน HTTP [มุ่งสู่อธิปไตยทางข้อมูล](/docs/network/community/low-resource-languages) | ขึ้นอยู่กับผู้ให้บริการ |

ตั้งค่า `GOOGLE_TRANSLATE_API_KEY` สำหรับ Google Translate หรือ `OPENROUTER_API_KEY` สำหรับวิธี LLM ดูรายละเอียดทั้งหมดได้ที่ [วิธีการแปล](/docs/guides/translation-methods)

---

## ภาษาหลัก

ภาษาเหล่านี้คือ locale ที่ได้รับการร้องขอมากที่สุดสำหรับแอปพลิเคชันเว็บและมือถือ เรียงตามลำดับ accessibility-first ที่ champollion แนะนำ

| ธง | ภาษา | รหัส | Google | LLM | Coached | อักษร | หมายเหตุ |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | อาหรับ | `ar` | ✅ | ✅ | ✅ | — | RTL. Modern Standard Arabic (فصحى). |
| 🇵🇭 | ฟิลิปิโน (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | ใช้ `fil` ใน Docusaurus configs champollion รองรับทั้งสองรูปแบบ |
| 🇫🇷 | ฝรั่งเศส | `fr` | ✅ | ✅ | ✅ | — | รูปแบบ Vous ใช้ภาษาที่ครอบคลุมทุกเพศ (Connecté·e) |
| 🇪🇸 | สเปน | `es` | ✅ | ✅ | ✅ | — | ภาษาสเปนกลางละตินอเมริกา |
| 🇩🇪 | เยอรมัน | `de` | ✅ | ✅ | ✅ | — | รูปแบบ Sie ใช้ภาษาที่ครอบคลุมทุกเพศ (Benutzer:innen) |
| 🇯🇵 | ญี่ปุ่น | `ja` | ✅ | ✅ | ✅ | — | です/ます สำหรับเนื้อหาทั่วไป する สำหรับป้ายกำกับ UI |
| 🇨🇳 | จีน (ตัวย่อ) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | อิตาลี | `it` | ✅ | ✅ | ✅ | — | รูปแบบ Lei |
| 🇧🇷 | โปรตุเกส (BR) | `pt` | ✅ | ✅ | ✅ | — | โปรตุเกสบราซิล |
| 🇰🇷 | เกาหลี | `ko` | ✅ | ✅ | ✅ | — | register สุภาพ 해요체 |

## ภาษาหลักของโลก

| ธง | ภาษา | รหัส | Google | LLM | Coached | อักษร | หมายเหตุ |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | เบงกาลี | `bn` | ✅ | ✅ | ✅ | — | ใช้ภาษา শুদ্ধ ভাষা เป็นหลัก |
| 🇧🇬 | บัลแกเรีย | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | เช็ก | `cs` | ✅ | ✅ | ✅ | — | Vykání (รูปแบบ vy) |
| 🇩🇰 | เดนมาร์ก | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | กรีก | `el` | ✅ | ✅ | ✅ | — | Δημοτική สมัยใหม่ |
| 🇮🇷 | เปอร์เซีย | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | ฟินแลนด์ | `fi` | ✅ | ✅ | ✅ | — | ไม่มีเพศทางไวยากรณ์ |
| 🇮🇱 | ฮีบรู | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | ฮินดี | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. ใช้คำยืมภาษาอังกฤษน้อยที่สุด |
| 🇭🇺 | ฮังการี | `hu` | ✅ | ✅ | ✅ | — | รูปแบบ Ön |
| 🇮🇩 | อินโดนีเซีย | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | มาเลย์ | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | ดัตช์ | `nl` | ✅ | ✅ | ✅ | — | รูปแบบ U |
| 🇳🇴 | นอร์เวย์ | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | โปแลนด์ | `pl` | ✅ | ✅ | ✅ | — | รูปแบบ Pan/Pani |
| 🇵🇹 | โปรตุเกส (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | โปรตุเกสยุโรป |
| 🇷🇴 | โรมาเนีย | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | รัสเซีย | `ru` | ✅ | ✅ | ✅ | — | รูปแบบ Вы |
| 🇸🇰 | สโลวัก | `sk` | ✅ | ✅ | ✅ | — | Vykanie (รูปแบบ vy) |
| 🇷🇸 | เซอร์เบีย | `sr` | ✅ | ✅ | ✅ | 🔤 Latin→Cyrillic | ตัวแปลงอักษรแบบ deterministic |
| 🇸🇪 | สวีเดน | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | สวาฮีลี | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | ไทย | `th` | ✅ | ✅ | ✅ | — | คำลงท้ายสุภาพ ครับ/ค่ะ |
| 🇹🇷 | ตุรกี | `tr` | ✅ | ✅ | ✅ | — | รูปแบบ Siz |
| 🇺🇦 | ยูเครน | `uk` | ✅ | ✅ | ✅ | — | รูปแบบ Ви |
| 🇵🇰 | อูรดู | `ur` | ✅ | ✅ | ✅ | — | RTL. รูปแบบ آپ |
| 🇻🇳 | เวียดนาม | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | จีน (ตัวเต็ม) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | จอร์เจีย | `ka` | ✅ | ✅ | — | — | ქართული. ตระกูล Kartvelian |
| 🇳🇬 | โยรูบา | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. มีวรรณยุกต์ (3 ระดับ) |

## ภาษาตามภูมิภาค

| ธง | ภาษา | รหัส | Google | LLM | Coached | อักษร | หมายเหตุ |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | สเปนเม็กซิโก | `es-MX` | ✅ | ✅ | ✅ | — | รูปแบบ Tú register อบอุ่น |
| 🇨🇦 | ฝรั่งเศสแคนาดา | `fr-CA` | ✅ | ✅ | ✅ | — | สำนวน Québécois |

---

## ภาษาพื้นเมืองและภาษาที่มีทรัพยากรน้อย

ภาษาเหล่านี้ไม่ได้รับการรองรับโดยบริการ MT เชิงพาณิชย์ champollion มีเครื่องมือสำหรับชุมชนเจ้าของภาษาในการสร้างวิธีการของตนเองภายใต้ [หลักการอธิปไตยทางข้อมูล](/docs/network/community/low-resource-languages)

| | ภาษา | รหัส | Google | LLM | Coached | อักษร | สถานะ |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Plains Cree | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Syllabics | 🚧 อยู่ระหว่างพัฒนา |
| 🌄 | Quechua | `qu` | ✅ | ✅ | — | — | Runasimi. มี evidential suffixes |

:::info[Plains Cree อยู่ระหว่างการพัฒนาอย่างต่อเนื่อง]
ระดับภาษา (register), โครงสร้างพื้นฐานสำหรับการสอน (coaching infrastructure), ตัวแปลงสคริปต์ (script converter) และชุดทดสอบประเมินผล (evaluation harness) สำหรับภาษา Plains Cree สามารถใช้งานได้แล้ว แต่ไปป์ไลน์การแปล **ยังไม่เปิดให้ใช้งาน** เรากำลังทำงานร่วมกับชุมชนเจ้าของภาษาภายใต้ [หลักการอธิปไตยทางข้อมูล](/docs/network/community/low-resource-languages) เพื่อให้มั่นใจในคุณภาพก่อนการเปิดตัว ดูรายละเอียดทั้งหมดได้ที่ [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — และวิธีที่คุณสามารถมีส่วนร่วม
:::

:::tip[การเพิ่มภาษาที่มีทรัพยากรน้อยอื่น ๆ]
ระบบ method plugin ของ champollion ได้รับการออกแบบมาเพื่อสิ่งนี้โดยเฉพาะ ชุมชนภาษาสามารถสร้าง translation method แบบกำหนดเอง โฮสต์ไว้ภายใต้การควบคุมของตนเอง และให้บริการผ่าน[API method](/docs/guides/serving-a-method) [Method Leaderboard](/leaderboard) ติดตามคะแนนสำหรับทุกคู่ภาษา — สร้าง method, รัน harness และคว้าคะแนนสูงสุด
:::

---

## ภาษาประดิษฐ์

Conlang รองรับผ่าน LLM registers และตัวแปลงอักษรแบบเสริม ใช้โครงสร้างพื้นฐานเดียวกับภาษาจริง — ระบบ quality gate, coaching และ pipeline การแปลงอักษรทำงานเหมือนกันทุกประการ

| | ภาษา | รหัส | Google | LLM | อักษร | หมายเหตุ |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | Klingon | `tlh` | ❌ | ✅ | 🔤 Romanization→pIqaD | ต้องใช้ฟอนต์ PUA คำศัพท์ Marc Okrand |
| 🧝 | Sindarin (Tolkien Elvish) | `x-elvish-s` | ❌ | ✅ | 🔤 Latin→Tengwar | ต้องใช้ฟอนต์ CSUR PUA |
| 🏴‍☠️ | ภาษาอังกฤษแบบโจรสลัด | `x-pirate` | ❌ | ✅ | — | Register เท่านั้น ใช้อุปมาอุปไมยทางทะเล |
| 🦸 | Kryptonian | `x-kryptonian` | ❌ | ✅ | 🔤 Latin→Kryptonian | ต้องใช้ฟอนต์ PUA |
| 🎭 | ภาษาอังกฤษแบบ Shakespeare | `x-shakespeare` | ❌ | ✅ | — | Register เท่านั้น รูปแบบ Thee/thou, -eth/-est |
| 🐸 | Yoda-speak | `x-yoda` | ❌ | ✅ | — | Register เท่านั้น ลำดับคำแบบ OSV |

ดู [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) สำหรับข้อกำหนดฟอนต์ PUA ข้อจำกัด Unicode และวิธีเพิ่มภาษาของคุณเอง

---

## Language Presets

wizard `init` รองรับชื่อ preset สำหรับการตั้งค่าอย่างรวดเร็ว คุณสามารถผสม preset กับรหัสภาษาแต่ละรหัสได้

| Preset | ขยายเป็น |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## การเพิ่มภาษาใดก็ได้

champollion สามารถแปลเป็น **ภาษาใดก็ตามที่ LLM ของคุณรู้จัก** — ตารางด้านบนเป็นเพียงรายการภาษาที่มี register preset ในตัว หากต้องการเพิ่มภาษาที่ไม่อยู่ในรายการ ให้ระบุรหัส BCP-47 ในการกำหนดค่าของคุณ:

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

LLM จะแปลโดยใช้ความรู้เกี่ยวกับภาษานั้นจากการฝึกอบรม การตั้งค่า `register` ช่วยให้คุณควบคุมน้ำเสียง ความเป็นทางการ และรูปแบบการเขียน ดู [การกำหนดค่า](/docs/getting-started/configuration) สำหรับรายละเอียด

---

## Language Cards {#language-cards}

ภาษาในตัวแต่ละภาษามี **Language Card** — ไฟล์ JSON เดียวใน `shared/language-cards/` ที่ประกอบด้วย metadata ทั้งหมด ได้แก่ register ความเป็นทางการ การรองรับวิธีการ กฎการพิมพ์ การจำแนกทางลำดับวงศ์ตระกูล ความท้าทายทางภาษาศาสตร์ และทรัพยากร NLP

### สถาปัตยกรรม Unified Card

การ์ดแต่ละใบถูกโหลดทันทีเมื่อ import ไม่มีชั้นข้อมูลอ้างอิงแยกต่างหาก — ข้อมูลทั้งหมดอยู่ในไฟล์เดียวต่อภาษา การ์ดได้รับการเสริมข้อมูลจากแหล่งที่มีอำนาจ:

| แหล่งที่มา | ข้อมูล |
|--------|------|
| [Glottolog](https://glottolog.org) | การจำแนกตระกูลภาษา สายบรรพบุรุษ Glottocode |
| [WALS](https://wals.info) | การจำแนก genus คุณลักษณะทางประเภทวิทยา |
| [CLDR](https://cldr.unicode.org) | อักษร ทิศทาง กฎพหูพจน์ การพิมพ์ |
| [ISO 15924](https://unicode.org/iso15924/) | รหัสอักษร |

### ฟิลด์หลักของการ์ด

| ฟิลด์ | เนื้อหา |
|-------|------------------|
| **`nativeName`** | Endonym — ชื่อภาษาในภาษาของตนเอง เขียนด้วยอักษรของตนเอง (เช่น ქართული, Runasimi) |
| **`classification`** | จุดยึดทางลำดับวงศ์ตระกูล: ตระกูล genus สายบรรพบุรุษทั้งหมดจาก Glottolog |
| **`contactInfluences`** | ประวัติการสัมผัสภาษาแบบสากล — ชั้นการยืมคำ superstrate substrate |
| **ระบบความเป็นทางการ** | ความแตกต่าง T-V ระดับการพูด keigo คำลงท้าย ฯลฯ |
| **Register presets** | ชุด preset prompt LLM ที่ตั้งชื่อเฉพาะสำหรับลักษณะของภาษานั้น |
| **การรองรับวิธีการ** | API การแปลใดที่รองรับภาษานี้ |
| **คำแนะนำเรื่องเพศ** | กฎเพศทางไวยากรณ์และเคล็ดลับการเขียนแบบครอบคลุม |
| **อักษร/ทิศทาง** | รหัสอักษร ISO 15924 และ RTL/LTR |
| **กฎ** | การพิมพ์ (เครื่องหมายคำพูด การเว้นวรรค) การใช้ตัวพิมพ์ใหญ่ หมวดหมู่พหูพจน์ |
| **`glottocode`** | ตัวระบุ Glottolog มาตรฐานสำหรับการอ้างอิงข้าม |
| **`dataSources`** | การติดตามที่มา (เช่น `["glottolog-5.3", "cldr-48"]`) |

### การสร้างโครงร่าง Language Card ใหม่

ใช้ generator เพื่อสร้างโครงร่างการ์ดจากแหล่งข้อมูลที่มีอำนาจ (IANA, CLDR, Glottolog):

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

generator จะเติม metadata โดยอัตโนมัติ (รหัส อักษร ทิศทาง พหูพจน์ เครื่องหมายคำพูด การรองรับวิธีการ การจำแนก) และทำเครื่องหมายฟิลด์ที่ต้องใช้วิจารณญาณทางภาษาศาสตร์เป็น TODO สำหรับการดูแลโดยมนุษย์

### การใช้ Preset Keys

แทนที่จะเขียนข้อความ register แบบเต็ม คุณสามารถใช้ชื่อ preset key ได้:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion จะแปลง key เป็น prompt register แบบเต็ม รัน `npx champollion init` เพื่อดู preset ที่มีสำหรับแต่ละภาษา

### ตัวอย่าง Presets

| ภาษา | Presets | ค่าเริ่มต้น |
|----------|---------|--------|
| ฝรั่งเศส | `formal-vous`, `casual-tu` | `formal-vous` |
| เกาหลี | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| ญี่ปุ่น | `polite`, `formal-keigo`, `casual` | `polite` |
| เยอรมัน | `formal-Sie`, `casual-du` | `formal-Sie` |
| ไทย | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| สเปน | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

ดู [การมีส่วนร่วมใน Language Card](https://github.com/gamedaysuits/champollion) สำหรับข้อกำหนดทั้งหมด รวมถึงการตรวจสอบฟิลด์และรายการตรวจสอบ PR

---

## ดูเพิ่มเติม

- [การกำหนดค่า](/docs/getting-started/configuration) — เอกสารอ้างอิงการกำหนดค่าทั้งหมด รวมถึงการตั้งค่าภาษา
- [วิธีการแปล](/docs/guides/translation-methods) — วิธีทำงานของแต่ละวิธี
- [Script Converters](/docs/concepts/script-converters) — pipeline การแปลงอักษรแบบ deterministic
- [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) — ฟอนต์ PUA, Unicode, การเพิ่ม conlang
- [การสนับสนุนภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages) — การสร้าง method สำหรับภาษาที่ขาดแคลนทรัพยากร
