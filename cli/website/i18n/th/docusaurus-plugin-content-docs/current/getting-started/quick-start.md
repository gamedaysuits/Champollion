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

## 1. ตั้งค่าไฟล์ Locale ของคุณ

สร้างไฟล์ locale ต้นทาง Champollion รองรับ JSON, TOML, YAML และอื่นๆ — ดูรายการทั้งหมดได้ที่ [ข้อมูลอ้างอิง CLI](/docs/reference/cli):

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
```

รับ Gemini key ฟรีได้ที่ [aistudio.google.com/apikey](https://aistudio.google.com/apikey) รับ OpenRouter key ได้ที่ [openrouter.ai](https://openrouter.ai)

## 3. รัน Sync

```bash
npx champollion sync
```

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

key ที่ไม่มีการเปลี่ยนแปลง (`hero.subtitle`) จะถูกดึงมาจาก **Translation Memory** cache ของ champollion — ไม่มีการเรียก API ไม่มีค่าใช้จ่าย cache จะถูกสร้างขึ้นโดยอัตโนมัติในทุกการ sync และจัดเก็บไว้ที่ `.champollion/tm.json`

## ตัวเลือกเสริม: สร้างไฟล์ Config

สำหรับการควบคุมที่มากขึ้น ให้สร้างไฟล์ config:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

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
  "model": "google/gemini-2.5-flash"
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
