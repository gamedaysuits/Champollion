---
sidebar_position: 3
title: "CI/CD"
---

# การผสานรวม CI/CD

ทำให้การแปลเป็นอัตโนมัติในไปป์ไลน์การ build ของคุณ

## GitHub Actions: ซิงค์เมื่อ Push

เพิ่มการซิงค์การแปลเข้ากับไปป์ไลน์การ build ที่มีอยู่ของคุณ:

```yaml title=".github/workflows/deploy.yml"
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - run: npm run build
```

## GitHub Actions: ซิงค์ตามกำหนดเวลา

รันการแปลตามกำหนดเวลาและ commit อัตโนมัติ:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          git add i18n/ content/ locales/ messages/
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git push
```

## วิธี Google Translate

หากใช้วิธี Google Translate ที่มีอยู่ในตัวแทน OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## ผู้ให้บริการ LLM โดยตรง

หากใช้วิธี `openai`, `anthropic` หรือ `gemini` โดยตรง:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx champollion sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx champollion sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx champollion sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx champollion sync --method deepl
```

## Remote Translation API

หากใช้ endpoint การแปลระยะไกล (เช่น บริการแปลที่โฮสต์ไว้):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## ไปป์ไลน์ CI สามชั้น

เพื่อความครอบคลุม i18n สูงสุด ให้กำหนดเงื่อนไขไปป์ไลน์ของคุณด้วยเครื่องมือทั้งสามชิ้น:

```yaml
jobs:
  i18n:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      # 1. Catch hardcoded strings before they ship
      - run: npx champollion lint

      # 2. Translate missing keys
      - run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}

      # 3. Fail if any locale is incomplete
      - run: npx champollion audit
```

| ชั้น | คำสั่ง | เมื่อใด | วัตถุประสงค์ |
|-------|---------|------|---------|
| **Lint** | `lint` | ก่อน commit | บล็อก commit ที่มี hardcoded string |
| **Sync** | `sync` | หลัง commit / CI | แปล key ที่ขาดหายและที่เปลี่ยนแปลง |
| **Audit** | `audit` | ขั้นตอน build | หยุดการ deploy หาก locale ใดไม่สมบูรณ์ |

:::tip[Translation Memory ใน CI]
หาก CI runner ของคุณมี workspace ที่คงอยู่ถาวร (หรือแคช `.champollion/`) Translation Memory จะทำงานโดยอัตโนมัติ — การ sync ครั้งถัดไปจะแปลเฉพาะ key ที่ข้อความต้นฉบับมีการเปลี่ยนแปลงจริงเท่านั้น สำหรับ runner แบบ ephemeral ควรพิจารณาแคช `.champollion/tm.json` ระหว่างการรัน:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## ดูเพิ่มเติม

- [CLI Reference](/docs/reference/cli) — เอกสารอ้างอิงคำสั่งทั้งหมด
- [How Sync Works](/docs/concepts/how-sync-works) — ทำความเข้าใจการซิงค์แบบ incremental
- [Translation Memory](/docs/concepts/translation-memory) — การแคชและการประหยัดต้นทุน
- [Translation Methods](/docs/guides/translation-methods) — การเลือกวิธีการแปลสำหรับแต่ละคู่ภาษา
- [Quality Gate](/docs/concepts/quality-gate) — สิ่งที่เกิดขึ้นเมื่อการแปลล้มเหลว
- [Configuration](/docs/getting-started/configuration) — เอกสารอ้างอิงการตั้งค่า
