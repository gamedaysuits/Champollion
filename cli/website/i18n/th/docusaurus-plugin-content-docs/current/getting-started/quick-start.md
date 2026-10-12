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
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# เริ่มต้นอย่างรวดเร็ว

แปลไฟล์ locale แรกของคุณภายใน 60 วินาที

CLI นี้ใช้งานได้ฟรีสำหรับการใช้งานที่ไม่ใช่เชิงพาณิชย์ภายใต้
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) สิทธิ์การใช้งานนี้ไม่ครอบคลุมการใช้งานเชิงพาณิชย์ โรงเรียน โรงพยาบาลหรือคลินิกรัฐ องค์กรการกุศล หรือโปรเจกต์ส่วนตัวจะได้รับการครอบคลุม ส่วนหน้าร้านค้าจะไม่ได้รับการครอบคลุม อ่านรายละเอียดทั้งหมดได้ที่ [ใครสามารถใช้งานสิ่งนี้ได้บ้าง](/docs/getting-started/who-may-use-this)

## 1. ตั้งค่าไฟล์ Locale ของคุณ

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

## 2. ตั้งค่า API Key ของคุณ

เลือก provider และตั้งค่า key:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

รับคีย์ Gemini ฟรีได้ที่ [aistudio.google.com/apikey](https://aistudio.google.com/apikey) รับคีย์ OpenRouter ได้ที่ [openrouter.ai](https://openrouter.ai) สำหรับตัวเลือก C ให้ระบุชื่อโมเดลของคุณเมื่อตั้งค่าโปรเจกต์: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (หรือเรียกใช้ `sync --method local --model llama3.1`)

## 3. รัน Sync

```bash
npx champollion sync
```

:::note[คุณเป็นผู้พิมพ์เอง หรือให้สคริปต์ทำงาน?]
คำสั่งในหน้านี้เป็นคำสั่งที่คุณพิมพ์เอง: `npx champollion` จะเรียกใช้ตัวที่ติดตั้งไว้ในโปรเจกต์ของคุณ หรือตัวที่ npx ดึงมา ซึ่งในครั้งแรกจะเป็นเวอร์ชันล่าสุด จากนั้นจึงใช้ตัวที่แคชไว้ ส่วนคำสั่งที่สคริปต์ทำงานแทนคุณ เช่น CI, สคริปต์ใน `package.json` หรือ git hook ควรกำหนดเวอร์ชันไว้เสมอ เช่น `npx --yes champollion@0.5 sync` เพื่อไม่ให้เวอร์ชันใหม่ที่ปล่อยออกมาส่งผลต่อสิ่งที่บิลด์รัน (และ `--yes` จะช่วยป้องกันไม่ให้ npx หยุดเพื่อถามยืนยัน) [คู่มือ CI](/docs/guides/ci-cd) และ [หน้าเฟรมเวิร์กต่างๆ](/docs/integrations/frameworks) จะตรึงเวอร์ชันไว้ในรูปแบบนี้
:::

:::tip[ใช้ Gemini อยู่หรือเปล่า?]
หากคุณเลือก Option B (Gemini) ให้เพิ่ม `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion จะ:
1. ตรวจจับ `locales/en.json` เป็นต้นฉบับโดยอัตโนมัติ
2. ค้นหา (หรือถามหา) ภาษาเป้าหมาย
3. แปลทุก key
4. เขียน `locales/fr.json`, `locales/ja.json` และอื่น ๆ
5. สร้าง `.champollion.lock` เพื่อติดตามสิ่งที่ได้แปลไปแล้ว

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

## ขั้นตอนถัดไปคืออะไร?

เมื่อคุณเปลี่ยนสตริงต้นฉบับ champollion จะตรวจจับการเปลี่ยนแปลงผ่านการติดตาม SHA-256 hash และแปลเฉพาะ key นั้นใหม่ในการ sync ครั้งถัดไป:

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

คีย์ที่ไม่มีการเปลี่ยนแปลง (`hero.subtitle`) จะถูก **ข้าม**: เนื่องจากมีคำแปลอยู่ใน `locales/fr.json` แล้ว จึงไม่ถูกส่งไปที่ไหนและไม่มีการค้นหาข้อมูลด้วยซ้ำ — ไม่มีการเรียกใช้ ไม่มีค่าใช้จ่าย และไม่นับรวมในตัวเลข "served from the cache" ของการรันรอบนั้น

**Translation Memory** (`.champollion/tm.json` ซึ่งสร้างขึ้นโดยอัตโนมัติในทุกๆ การซิงค์) มีไว้สำหรับข้อความที่ *เข้าคิว* แปล: ข้อความที่คุณเปลี่ยนกลับไปเป็นแบบเดิม, ประโยคเดียวกันที่ปรากฏในอีกไฟล์หนึ่ง หรือการแปลใหม่ทั้งภาษา (`sync --redo all`) รายการเหล่านี้จะถูกดึงมาจากแคชฟรี และบรรทัดสรุปผลการรันจะบอกจำนวน (`… 0 key(s) sent to the model, 12 served from the cache (free)`) แคชจะถูกแยกเก็บตาม method, register และ coaching — ของแต่ละคู่ภาษาและ fallback ของคู่นั้นๆ หลังจากเปลี่ยน method (เช่น `local` → `llm`) หรือแก้ไขข้อความในไฟล์ coaching (ของคู่ภาษา, ตัวภาษาเอง หรือ fallback) จะไม่มีการนำข้อมูลเดิมมาใช้ซ้ำและการรันจะแจ้งเหตุผล ส่วนการเปลี่ยนเฉพาะโมเดลเพียงอย่างเดียวจะยังคงนำคำแปลก่อนหน้านี้มาใช้ซ้ำได้ การเปลี่ยนแปลงจะไม่สั่งแปลใหม่โดยอัตโนมัติ: `sync` จะระบุการแปลใหม่และค่าใช้จ่ายที่เกิดขึ้น

## ตัวเลือกเสริม: สร้างไฟล์ Config

สำหรับการควบคุมที่มากขึ้น ให้สร้างไฟล์ config:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` และ `--model` ใช้สำหรับเลือกวิธีแปลและโมเดล (`npx champollion init --help` แสดงรายการวิธีแปลทั้งหมด); คำสั่ง init จะแสดงผลว่าการกำหนดค่าใช้ตัวเลือกใดอยู่

wizard แบบมีคำแนะนำจะพาคุณผ่านแต่ละ **register presets** ของแต่ละภาษา — คำแนะนำด้านน้ำเสียง/ความเป็นทางการที่สร้างไว้ล่วงหน้าและปรับให้เหมาะกับระบบภาษานั้น ๆ ภาษาฝรั่งเศสมี T-V presets (vouvoiement vs tutoiement) ภาษาเกาหลีมีระดับการพูด (해요체 vs 합쇼체 vs 해체) ภาษาญี่ปุ่นมีตัวเลือก keigo (です/ます vs 丁寧語)

หรือสร้าง config ด้วยตนเองโดยใช้ preset keys:

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

รัน `npx champollion init` เพื่อดู presets ที่มีอยู่สำหรับแต่ละภาษา

## ตัวเลือกเสริม: Watch Mode

แปลโดยอัตโนมัติเมื่อไฟล์ต้นฉบับของคุณมีการเปลี่ยนแปลง:

```bash
npx champollion watch
```

## ขั้นตอนต่อไป

- **[การกำหนดค่า](/docs/getting-started/configuration)** — เอกสารอ้างอิง config ฉบับสมบูรณ์
- **[วิธีการแปล](/docs/guides/translation-methods)** — เลือกวิธีที่เหมาะสมสำหรับแต่ละคู่ภาษา
- **[Translation Memory](/docs/concepts/translation-memory)** — วิธีที่การ cache ช่วยประหยัดค่าใช้จ่ายในการรันซ้ำ
- **[การทำงานร่วมกับนักแปลมืออาชีพ](/docs/guides/professional-translators)** — ส่งออก XLIFF สำหรับการตรวจสอบโดยมนุษย์
- **[การผสานรวมกับ Framework](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — ทำให้การแปลเป็นอัตโนมัติใน pipeline ของคุณ
- **[การแก้ไขปัญหา](/docs/guides/troubleshooting)** — ปัญหาที่พบบ่อยและวิธีแก้ไข
