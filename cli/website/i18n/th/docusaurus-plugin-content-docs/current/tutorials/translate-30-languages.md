---
sidebar_position: 2
title: "แปล 30 ภาษา"
description: "Cookbook: ขยายโปรเจกต์จาก 3 ภาษาเป็น 30 ภาษา โดยใช้การผสม per-pair method, batching และการผสานรวมกับ CI"
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Cookbook: แปล 30 ภาษา

ขยายโปรเจกต์จากภาษาท้องถิ่นไม่กี่ภาษาสู่การครอบคลุมระดับโลก Cookbook นี้จะพาคุณผ่านขั้นตอนการเลือกวิธีการแปล การเพิ่มประสิทธิภาพด้านต้นทุน และการผสานรวมกับ CI สำหรับการใช้งานหลายภาษาจริง

**สถานการณ์:** คุณมีแอป SaaS ที่มี `en`, `fr`, `es` และต้องการเพิ่มอีก 27 ภาษาใน 3 ระดับคุณภาพที่แตกต่างกัน

---

## ขั้นตอนที่ 1: จัดหมวดหมู่ภาษาของคุณ

ไม่จำเป็นต้องใช้แนวทางเดียวกันสำหรับทั้ง 30 ภาษา จัดกลุ่มตามคุณภาพของวิธีการที่มีอยู่:

| ระดับ | ภาษา | วิธีการ | เหตุผล |
|------|-----------|--------|-----|
| **ระดับ 1 — Premium** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | ตลาดมูลค่าสูง ไวยากรณ์ซับซ้อน |
| **ระดับ 2 — Standard** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | ปริมาณสูง รองรับได้ดีโดย Google |
| **ระดับ 3 — Coached** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + plugins | ทรัพยากรน้อย ต้องการการบังคับใช้คำศัพท์เฉพาะ |

## ขั้นตอนที่ 2: กำหนดค่าแบบรายคู่ภาษา

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.8-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

**หมายเหตุ:** ภาษาที่ไม่ได้ระบุใน `pairs` จะสืบทอดค่าจาก `defaultMethod: "google-translate"` คุณไม่จำเป็นต้องระบุทั้ง 30 ภาษา

:::info
การรองรับ `crk` อยู่ระหว่างการพัฒนา — ดูสถานะและแนวทางการมีส่วนร่วมได้ที่ [รองรับภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages)
:::

## ขั้นตอนที่ 3: ตั้งค่า API Keys

คุณจะต้องใช้ API key ทั้งสองสำหรับการกำหนดค่านี้:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## ขั้นตอนที่ 4: ทดลองรันก่อน

ควรดูตัวอย่างผลลัพธ์เสมอก่อนแปล 30 ภาษา:

```bash
npx champollion sync --dry
```

ตรวจสอบผลลัพธ์ที่แสดง ซึ่งจะประกอบด้วย:
- คู่ภาษาใดใช้วิธีการใด
- จำนวน key ที่ใหม่หรือเปลี่ยนแปลงในแต่ละ locale
- จำนวน API call โดยประมาณในแต่ละระดับ

## ขั้นตอนที่ 5: รัน Sync

```bash
npx champollion sync
```

Champollion ประมวลผลแต่ละคู่ภาษาอย่างอิสระ คู่ภาษาระดับ 2 ที่ใช้ Google Translate จะทำงานได้รวดเร็ว คู่ภาษาระดับ 1 ที่ใช้ LLM จะช้ากว่าแต่มีคุณภาพสูงกว่า คู่ภาษาระดับ 3 แบบ coached จะใช้ข้อมูล coaching ของ plugin

### การอัปเดตแบบ Incremental

หลังจาก sync ครั้งแรก การรันครั้งถัดไปจะแปลเฉพาะ key ที่ **เปลี่ยนแปลงหรือใหม่** เท่านั้น:

```bash
# Only keys that changed since last sync
npx champollion sync
```

lock file (`.champollion.lock`) จะติดตามสิ่งที่แปลไปแล้ว ทำให้คุณไม่ต้องแปลเนื้อหาที่คงที่ซ้ำอีก

## ขั้นตอนที่ 6: ตรวจสอบคุณภาพ

ตรวจสอบสถานะของคู่ภาษาทั้งหมด:

```bash
npx champollion status
```

ส่วนนี้จะแสดงรายการวิธี (method), โมเดล และระดับภาษา (register) ของแต่ละคู่ภาษา รวมถึงข้อมูล coaching และคะแนนเบนช์มาร์กของปลั๊กอินเมื่อมีการเผยแพร่ (พร้อมทั้งป้ายกำกับ `qualityTier` หากการกำหนดค่าของคุณมีการตั้งค่าไว้)

### ผลลัพธ์เป็นไปตาม register ที่กำหนดหรือไม่?

ในขั้นตอนที่ 2 คุณได้ประกาศ [register](/glossary#term-register) สำหรับแต่ละภาษา — `"Polite/formal"` สำหรับภาษาญี่ปุ่น `"Formal (Sie)"` สำหรับภาษาเยอรมัน (ยังไม่คุ้นกับคำนี้? อ่านคำอธิบายในภาษาที่เข้าใจง่ายได้ที่ glossary) คำสั่งเหล่านั้นจะถูกส่งเข้าไปใน prompt การแปล แต่ prompt เป็นเพียงคำขอ ไม่ใช่การรับประกัน

[Network harness](/docs/network/specifications/harness) — เครื่องมือเดียวกับที่ขับเคลื่อน leaderboard สาธารณะ — สามารถวัดความสอดคล้องของ register และสไตล์จากตัวอย่างการแปลของคุณได้ เมตริกด้านสไตล์การเขียนจะตรวจสอบผลลัพธ์แต่ละรายการเทียบกับ register ที่คาดหวัง (ตัวบ่งชี้ formal/informal, สรรพนาม T–V, คำย่อ, การเปลี่ยนแปลงความยาวประโยค) และรายงาน `style_consistency_rate` ตลอดการรัน คุณยังสามารถชี้ไปที่โปรไฟล์ brand voice แบบกำหนดเองด้วย `--style-profile`

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

ข้อควรทราบตามจริงสองประการ: เมตริกเหล่านี้มีไว้เพื่อ**แจ้งข้อมูลเท่านั้น** (เป็นการวินิจฉัยที่ไม่เคยนำไปรวมในคะแนน chrF++ หลักบนลีดเดอร์บอร์ดหรือการจัดอันดับ) และการตรวจหาระดับความเป็นทางการนั้นทำงานโดยอิงตามตัวระบุ (marker-based) ซึ่งเป็นตัวตรวจจับความคลาดเคลื่อน ไม่ใช่การตัดสินโดยมนุษย์ ดูรายละเอียดและคำจำกัดความของเมตริกได้ที่: [เมตริกรูปแบบการเขียนและระดับภาษา](/docs/network/specifications/harness#writing-style-and-register-metrics-informational)

## ขั้นตอนที่ 7: ผสานรวมกับ CI

เพิ่มลงใน GitHub Actions workflow เพื่อให้การแปลอัปเดตอยู่เสมอในทุก push:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24

      # Pinned to the 0.5 line: a new release never changes what this job
      # runs. The CI guide has the complete workflow (the translation cache,
      # partial runs, a dry-run check and verify --strict).
      - name: Sync translations
        run: npx --yes champollion@0.5 sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## การประมาณต้นทุน

สำหรับโปรเจกต์ที่มี 500 source key ใน 30 ภาษา:

| ระดับ | ภาษา | วิธีการ | ต้นทุนโดยประมาณ |
|------|-----------|--------|-----------------|
| ระดับ 1 (5 ภาษา) | ja, ko, zh, de, pt | GPT-4o | ~$2.50/full sync |
| ระดับ 2 (18 ภาษา) | it, nl, pl, etc. | Google Translate | ~$0.90/full sync |
| ระดับ 3 (4 ภาษา) | crk, oj, mi, haw | GPT-4o-mini coached | ~$0.40/full sync |
| **รวม** | **30 ภาษา** | **Mixed** | **~$3.80/full sync** |

การ sync แบบ incremental (เปลี่ยนแปลง 5–20 key) มีต้นทุนเพียงเศษเสี้ยวของ full sync

## ดูเพิ่มเติม

- [วิธีแปลภาษา](/docs/guides/translation-methods) — การทำงานของแต่ละวิธีแปลภาษาและกรณีที่ควรเลือกใช้
- [ข้อกำหนดของปลั๊กอิน](/docs/reference/plugin-spec) — สร้างข้อมูล coaching สำหรับภาษา Tier 3 ใดๆ ของคุณ
- [คู่มือ CI/CD](/docs/guides/ci-cd) — รูปแบบ CI ขั้นสูง รวมถึงพรีวิวบิลด์ของ PR
- [Quality Gate](/docs/concepts/quality-gate) — วิธีที่ Champollion ตรวจสอบข้อผิดพลาดในผลลัพธ์ของคำแปลทุกรายการก่อนบันทึกไฟล์
- [ภาษาที่รองรับ](/docs/reference/supported-languages) — รายการรหัสภาษาและความเข้ากันได้ของแต่ละวิธีแปลแบบครบถ้วน
- [เมตริกรูปแบบการเขียนและระดับภาษา](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — วัดความสอดคล้องของระดับภาษาและสไตล์ด้วยชุดทดสอบประเมินผล (เมตริกเพื่อให้ข้อมูล)
- [อภิธานศัพท์: ระดับภาษา](/glossary#term-register) — ความหมายของคำว่า "register" ด้วยภาษาที่เข้าใจง่าย
- [สนับสนุนภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages) — เพิ่มข้อมูล coaching สำหรับภาษาที่ยังไม่มีระบบ MT รองรับอย่างครอบคลุม
