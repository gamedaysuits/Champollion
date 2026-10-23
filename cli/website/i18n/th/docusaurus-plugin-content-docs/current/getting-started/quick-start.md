---
sidebar_position: 2
title: "เริ่มต้นอย่างรวดเร็ว"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# เริ่มต้นใช้งานอย่างรวดเร็ว

แปลไฟล์ภาษาไฟล์แรกของคุณได้ภายใน 60 วินาที

CLI นี้ใช้งานได้ฟรีสำหรับการใช้งานที่ไม่ใช่เชิงพาณิชย์ภายใต้
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) การใช้งานเชิงพาณิชย์ไม่ได้รับความคุ้มครอง
ตามสัญญานี้ โรงเรียน โรงพยาบาลหรือคลินิกรัฐ องค์กรการกุศล หรือโปรเจกต์ส่วนตัวสามารถใช้งานได้ แต่หน้าร้านของร้านค้า
ไม่สามารถใช้ได้ อ่านรายละเอียดทั้งหมดได้ที่ [ใครสามารถใช้งานได้บ้าง](/docs/getting-started/who-may-use-this)

## 1. เตรียมไฟล์ภาษาของคุณ

สร้างไฟล์ภาษาต้นฉบับ Champollion รองรับทั้ง JSON, TOML, YAML และอื่นๆ — ดูรายการทั้งหมดได้ที่ [เอกสารอ้างอิง CLI](/docs/reference/cli):

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. ตั้งค่าคีย์ API ของคุณ

เลือกผู้ให้บริการและตั้งค่าคีย์:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

รับคีย์ Gemini ฟรีได้ที่ [aistudio.google.com/apikey](https://aistudio.google.com/apikey) รับคีย์ OpenRouter ได้ที่ [openrouter.ai](https://openrouter.ai) สำหรับตัวเลือก C ให้ระบุชื่อโมเดลของคุณตอนตั้งค่าโปรเจกต์: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (หรือสั่งรัน `sync --method local --model llama3.1`)

## 3. สั่งรัน Sync

```bash
npx champollion sync
```

:::note[พิมพ์คำสั่งเอง หรือให้สคริปต์รัน?]
คำสั่งในหน้านี้เป็นคำสั่งที่คุณพิมพ์เอง: `npx champollion` จะรันเวอร์ชันที่ติดตั้งไว้ในโปรเจกต์ของคุณ หรือไม่ก็เวอร์ชันที่ npx ดึงมา — ซึ่งจะเป็นรุ่นล่าสุดในครั้งแรก จากนั้นจะใช้เวอร์ชันที่แคชไว้ ส่วนคำสั่งที่สคริปต์รันให้คุณ — เช่น CI, สคริปต์ `package.json` หรือ git hook — ควรระบุเวอร์ชันด้วย เช่น `npx --yes champollion@0.6 sync` เพื่อไม่ให้การอัปเดตรุ่นใหม่ส่งผลกระทบต่อสิ่งที่มีการบิลด์ (และ `--yes` จะช่วยป้องกันไม่ให้ npx หยุดถามยืนยัน) ใน [คู่มือ CI](/docs/guides/ci-cd) และ [หน้าเฟรมเวิร์ก](/docs/integrations/frameworks) ได้ล็อกเวอร์ชันไว้ด้วยวิธีนี้
:::

:::tip[ใช้ Gemini อยู่ใช่ไหม?]
หากคุณเลือกตัวเลือก B (Gemini) ให้เพิ่ม `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion จะ:
1. ตรวจหา `locales/en.json` เป็นภาษาต้นฉบับโดยอัตโนมัติ
2. ค้นหา (หรือสอบถาม) ภาษาปลายทาง
3. แปลคีย์ทั้งหมด
4. เขียนไฟล์ `locales/fr.json`, `locales/ja.json` และอื่นๆ
5. สร้าง `.champollion.lock` เพื่อติดตามสิ่งที่ได้รับการแปลไปแล้ว

## 4. ตรวจสอบผลลัพธ์

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## จะเกิดอะไรขึ้นต่อไป?

เมื่อคุณแก้ไขข้อความต้นฉบับ Champollion จะตรวจจับการเปลี่ยนแปลงผ่านการติดตามแฮช SHA-256 และจะแปลซ้ำเฉพาะคีย์นั้นในการซิงค์ครั้งถัดไป:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

คีย์ที่ไม่มีการเปลี่ยนแปลง (`hero.subtitle`) จะถูก**ข้าม**: คำแปลของคีย์นั้นอยู่ใน `locales/fr.json` เรียบร้อยแล้ว จึงไม่ถูกส่งไปที่ไหนและไม่ต้องเสียเวลาค้นหาเลย — ไม่มีการเรียกใช้ ไม่มีค่าใช้จ่าย และไม่ถูกนับรวมในตัวเลข "เสิร์ฟจากแคช" (served from the cache) ของรอบการรันนั้น

**Translation Memory** (`.champollion/tm.json` ซึ่งสร้างขึ้นโดยอัตโนมัติระหว่างการซิงค์ทุกครั้ง) มีไว้สำหรับข้อความที่*อยู่ในคิว*: ข้อความที่คุณเปลี่ยนกลับไปเป็นแบบเดิม ประโยคเดียวกันในอีกไฟล์หนึ่ง หรือการแปลใหม่ทั้งภาษา (`sync --redo all`) รายการเหล่านี้จะถูกดึงมาจากแคชโดยไม่มีค่าใช้จ่าย และบรรทัดสรุปการรันจะบอกว่ามีจำนวนเท่าใด (`… 0 key(s) sent to the model, 12 served from the cache (free)`) แคชจะถูกแยกเก็บตามวิธีแปล (method) ระดับภาษา (register) และไฟล์ให้คำแนะนำ (coaching) — แยกทั้งสำหรับคู่ภาษานั้นและคู่ภาษาสำรองของมัน หลังจากสลับวิธีแปล (เช่น `local` → `llm`) หรือแก้ไขข้อความในไฟล์ coaching (ในคู่ภาษา ภาษานั้น หรือคู่ภาษาสำรอง) จะไม่มีการนำของเดิมมาใช้ซ้ำ และระบบจะแจ้งเหตุผลตอนรัน แต่หากเปลี่ยนเฉพาะโมเดลเพียงอย่างเดียว จะยังคงนำคำแปลก่อนหน้านี้มาใช้ซ้ำได้ การเปลี่ยนแปลงการตั้งค่าจะไม่แปลซ้ำโดยอัตโนมัติ: `sync` จะระบุรายการที่จะแปลใหม่พร้อมค่าใช้จ่าย

## ทางเลือกเพิ่มเติม: สร้างไฟล์คอนฟิก

หากต้องการควบคุมการตั้งค่าให้ละเอียดยิ่งขึ้น ให้สร้างไฟล์คอนฟิกขึ้นมา:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` และ `--model` ใช้สำหรับเลือกวิธีแปลและโมเดล (`npx champollion init --help` จะแสดงรายการวิธีแปลทั้งหมด) คำสั่ง init จะแสดงว่าไฟล์คอนฟิกใช้อันใดบ้าง

วิซาร์ดแนะนำจะพาคุณกำหนด **พรีเซ็ตระดับภาษา (register presets)** ของแต่ละภาษา — ซึ่งเป็นคำสั่งกำหนดน้ำเสียง/ความสุภาพสำเร็จรูปที่ปรับแต่งให้เข้ากับระบบภาษาศาสตร์ของภาษานั้นๆ ภาษาฝรั่งเศสมีพรีเซ็ต T-V (vouvoiement กับ tutoiement) ภาษาเกาหลีมีระดับภาษาพูด (해요체 กับ 합쇼체 กับ 해체) ภาษาญี่ปุ่นมีตัวเลือกเคโงะ (です/ます กับ 丁寧語)

หรือสร้างไฟล์คอนฟิกด้วยตนเองโดยใช้คีย์พรีเซ็ต:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-3.8-flash"
}
```

สั่งรัน `npx champollion init` เพื่อดูพรีเซ็ตที่มีให้เลือกใช้ในแต่ละภาษา

## ทางเลือกเพิ่มเติม: Watch Mode

แปลโดยอัตโนมัติเมื่อไฟล์ต้นฉบับของคุณมีการเปลี่ยนแปลง:

```bash
npx champollion watch
```

## ขั้นตอนถัดไป

- **[การกำหนดค่า](/docs/getting-started/configuration)** — เอกสารอ้างอิงการกำหนดค่าทั้งหมด
- **[วิธีแปล](/docs/guides/translation-methods)** — เลือกวิธีที่เหมาะสมสำหรับแต่ละคู่ภาษา
- **[Translation Memory](/docs/concepts/translation-memory)** — วิธีที่การแคชช่วยประหยัดค่าใช้จ่ายเมื่อรันซ้ำ
- **[การทำงานร่วมกับนักแปลมืออาชีพ](/docs/guides/professional-translators)** — ส่งออกไฟล์ XLIFF เพื่อให้มนุษย์ตรวจทาน
- **[การผสานการทำงานกับเฟรมเวิร์ก](/docs/integrations/frameworks)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — จัดการงานแปลแบบอัตโนมัติในไปป์ไลน์ของคุณ
- **[การแก้ไขปัญหา](/docs/guides/troubleshooting)** — ปัญหาที่พบบ่อยและวิธีแก้ไข
