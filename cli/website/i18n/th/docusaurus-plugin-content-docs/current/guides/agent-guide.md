---
sidebar_position: 9
title: "คู่มือ Agent: การใช้งาน champollion"
description: "วิธีที่ AI agent สามารถติดตั้ง กำหนดค่า และรัน champollion เพื่อแปลไฟล์ locale"
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# คู่มือสำหรับ Agent: การใช้งาน champollion

champollion เป็น CLI tool ที่แปลไฟล์ locale ของแอปพลิเคชันของคุณด้วยคำสั่งเดียว คู่มือนี้จัดทำขึ้นสำหรับ AI agent (หรือนักพัฒนาที่ทำงานร่วมกับ AI agent) ที่ต้องการเริ่มต้นและได้ไฟล์ locale ที่แปลแล้วอย่างรวดเร็ว

:::tip[คุ้นเคยอยู่แล้ว?]
หากต้องการเพียงคำสั่ง ข้ามไปที่ [CLI Reference](/docs/reference/cli) ได้เลย หากต้องการสร้างและทดสอบประสิทธิภาพของวิธีการแปล ดูที่ [Network Agent Guide](/docs/network/getting-started/agent-guide)
:::

---

## การตั้งค่าสภาพแวดล้อม

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**ข้อกำหนด:**
- Node.js 20.11+ (native ESM)
- API key สำหรับผู้ให้บริการแปลของคุณ

**การตั้งค่า API key** — champollion ต้องการ key อย่างน้อยหนึ่งรายการขึ้นอยู่กับ method ที่ใช้:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion อ่าน `.env.local` และ `.env` โดยอัตโนมัติ (ลำดับความสำคัญ: `process.env` → `.env.local` → `.env`) รับ OpenRouter key ได้ที่ [openrouter.ai/keys](https://openrouter.ai/keys)

---

## การ Sync ครั้งแรก

Champollion ตรวจจับไฟล์ locale, รูปแบบไฟล์ (JSON, TOML, หรือ YAML) และภาษาเป้าหมายของคุณโดยอัตโนมัติ:

```bash
npx champollion sync
```

**สิ่งที่เกิดขึ้น:**
1. โหลด `champollion.config.json` (หรือตรวจจับการตั้งค่าอัตโนมัติ)
2. สแกนไฟล์ locale ต้นทาง และทำให้ nested key แบนราบ
3. เปรียบเทียบกับ `.champollion.lock` (SHA-256 hash ของค่าที่แปลไปก่อนหน้า)
4. ตรวจสอบ `.champollion/tm.json` สำหรับการแปลที่แคชไว้ (Translation Memory)
5. แปลเฉพาะ **key ที่เปลี่ยนแปลง, ขาดหายไป หรือล้าสมัย** ผ่าน method ที่กำหนดไว้
6. รัน quality gate (5 การตรวจสอบ) กับทุกการแปล
7. เขียนการแปลที่ผ่านการตรวจสอบลงในไฟล์ locale เป้าหมาย
8. อัปเดต lock file และ TM cache

ในการรันซ้ำทั่วไปหลังจากเปลี่ยน key หนึ่งรายการ ขั้นตอนที่ 4 จะดึง 142 key จาก cache และขั้นตอนที่ 5 จะแปลเพียง 1 key นี่คือเหตุผลที่การ sync ครั้งถัดไปรวดเร็วและประหยัดค่าใช้จ่าย

---

## การกำหนดค่า

สร้าง `champollion.config.json` ในไดเรกทอรีหลักของโปรเจกต์:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

key ของคู่ภาษาใช้ **โคลอน** (`en:fr`) ไม่ใช่ขีดกลาง — ขีดกลางสงวนไว้สำหรับรหัส locale ระดับภูมิภาค เช่น `es-MX`

ฟิลด์สำคัญ:

| ฟิลด์ | วัตถุประสงค์ | ค่าเริ่มต้น |
|-------|---------|---------|
| `inputLocale` | ภาษาต้นทาง | `en` |
| `languages` | ภาษาเป้าหมาย (array หรือ object) | `[]` |
| `pairs` | การกำหนดค่าเฉพาะคู่ภาษา (key แบบ `"src:tgt"`) พร้อม method config | ไม่บังคับ |
| `localesDir` | ตำแหน่งที่เก็บไฟล์ locale | `./locales` |
| `model` | LLM model สำหรับ method `llm`/`llm-coached` | `google/gemini-3.5-flash` |
| `batchSize` | จำนวน key ต่อการเรียก API หนึ่งครั้ง | 80 (LLM); Google Translate จำกัดที่ 128 segments/request |
| `jsonConcurrency` | การแปล locale แบบขนานสำหรับ JSON key | 50 |
| `contentConcurrency` | การเรียก API แบบขนานสำหรับการแปลเนื้อหา | 48 (Docusaurus docs), 12 (Hugo `contentDir`) |

ข้อมูลอ้างอิงฉบับเต็ม: [Configuration](/docs/getting-started/configuration)

---

## วิธีการแปล

| Method | เมื่อใดควรใช้ | ค่าใช้จ่าย | API key ที่ต้องการ |
|--------|------------|------|---------------|
| **`llm`** | ใช้งานทั่วไป เหมาะกับภาษาที่มีทรัพยากรมาก | คิดตาม token (ขึ้นอยู่กับ model) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | เมื่อมีกฎไวยากรณ์/พจนานุกรมสำหรับภาษาเป้าหมาย | คิดตาม token + บริบท coaching | `OPENROUTER_API_KEY` |
| **`google-translate`** | ภาษาที่มีทรัพยากรสูงซึ่ง GT ทำงานได้ดี | $20/ล้านตัวอักษร | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Pipeline แบบกำหนดเองที่โฮสต์ผ่าน HTTP endpoint | ขึ้นอยู่กับ server | ไม่มี (endpoint จัดการ auth เอง) |
| **`plugin`** | Method ที่แพ็กเกจไว้ล่วงหน้าและติดตั้งในเครื่อง | แตกต่างกันไป | แตกต่างกันไป |

รายละเอียด: [Translation Methods](/docs/guides/translation-methods)

---

## Coaching Data

สำหรับคู่ `llm-coached` coaching data จะชี้นำ LLM ด้วยความรู้ทางภาษาศาสตร์ที่ชัดเจน สร้างไฟล์ coaching:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

อ้างอิงในการกำหนดค่าคู่ภาษาของคุณ:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

Quality gate จะตรวจสอบว่าคำศัพท์ในพจนานุกรมปรากฏในผลลัพธ์จริง — การละเมิดจะถูกบันทึกเป็นคำเตือน `[TERM]`

รายละเอียด: [Coaching Data](/docs/concepts/coaching-data)

---

## Quality Gate

ทุกการแปลจะผ่านการตรวจสอบอัตโนมัติห้ารายการก่อนเขียนลงดิสก์:

| การตรวจสอบ | สิ่งที่ตรวจจับ | ตัวอย่าง |
|-------|----------------|---------|
| **ว่างเปล่า/ไม่มีเนื้อหา** | Model ไม่ส่งคืนผลลัพธ์ใดๆ | `""` |
| **Source echo** | Model ส่งคืนข้อความภาษาอังกฤษต้นทางโดยไม่เปลี่ยนแปลง | `"Welcome"` สำหรับภาษาญี่ปุ่น |
| **Hallucination loop** | trigram ที่ซ้ำกัน | `"Qo' Qo' Qo' Qo'"` |
| **Length inflation** | ผลลัพธ์ยาวกว่าต้นทาง 4 เท่าขึ้นไป | ต้นทาง 10 ตัวอักษร → ผลลัพธ์ 50 ตัวอักษร |
| **Script compliance** | script ไม่ถูกต้องสำหรับ locale | ข้อความ Latin สำหรับ locale ภาษาอาหรับ |

ความล้มเหลวจะถูกบันทึกด้วยคำนำหน้า `[GATE]` ไม่มี silent fallback — หากการแปลล้มเหลว จะถูกรายงาน ไม่ใช่ยอมรับโดยไม่แจ้ง

รายละเอียด: [Quality Gate](/docs/concepts/quality-gate)

---

## Translation Memory

Champollion แคชการแปลไว้ใน `.champollion/tm.json` โดยใช้ข้อความต้นทาง + locale + method เป็น key ในการ sync ครั้งถัดไป key ที่ไม่เปลี่ยนแปลงจะถูกดึงจาก cache — ไม่มีการเรียก API ไม่มีค่าใช้จ่าย

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

หากต้องการข้ามการใช้ cache สำหรับการรันครั้งเดียว: `npx champollion sync --no-tm`

รายละเอียด: [Translation Memory](/docs/concepts/translation-memory)

---

## ไฟล์ที่สร้างขึ้น

Champollion สร้างไฟล์หลายรายการในโปรเจกต์ของคุณ ควรทำความเข้าใจว่าแต่ละไฟล์คืออะไร เพื่อไม่ให้ลบหรือ commit ผิดพลาด:

| ไฟล์ | วัตถุประสงค์ | Git? |
|------|---------|------|
| `.champollion.lock` | แฮช SHA-256 ของค่าต้นทางที่แปลแล้ว (สำหรับตรวจจับการเปลี่ยนแปลง) | **ใช่** — commit ไฟล์นี้ |
| `.champollion-content.lock` | เหมือนกัน แต่สำหรับไฟล์เนื้อหา Markdown/MDX | **ใช่** — commit ไฟล์นี้ |
| `.champollion/` | ไดเรกทอรีสถานะภายใน (`tm.json` cache, XLIFF exports, backups) | **ไม่** — gitignore ไว้; `tm.json` เป็น local cache (ดู [Configuration](/docs/getting-started/configuration)) |
| ไฟล์ coaching ที่คุณสร้างเอง (เช่น `coaching/fr.json`) | ความรู้ด้านภาษาของคุณ | **ใช่** — commit ไฟล์เหล่านี้ |
| `champollion.config.json` | การกำหนดค่าโปรเจกต์ | **ใช่** — commit ไฟล์นี้ |

---

## รูปแบบการใช้งานทั่วไป

**แปลคู่ภาษาที่กำหนดค่าไว้ทั้งหมด:**
```bash
npx champollion sync
```
Champollion จะแปล locale ทั้งหมดแบบขนานกัน ด้วยการแคช TM จะมีเพียงคีย์ที่เปลี่ยนแปลงเท่านั้นที่เรียกใช้งาน API (คู่ภาษาที่ไม่เปลี่ยนแปลงจะถูกดึงมาจากแคช ดังนั้นการซิงค์แบบเต็มรูปแบบจึงมีค่าใช้จ่ายต่ำ)

**แปลเฉพาะคู่ภาษาที่ระบุ:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` จะจำกัดการทำงานให้อยู่เฉพาะคู่ภาษาที่ระบุชื่อไว้เท่านั้น การตรวจสอบความพร้อมและค่าใช้จ่ายจะเกิดขึ้นกับคู่ภาษาเหล่านั้นเท่านั้น การระบุชื่อคู่ภาษาที่ไม่ได้อยู่ในกราฟคู่ภาษาที่คุณกำหนดค่าไว้ จะทำให้เกิดข้อผิดพลาดอย่างชัดเจนพร้อมกับแสดงรายการคู่ภาษาที่กำหนดค่าไว้ — จะไม่มีการข้ามไปเงียบๆ อย่างเด็ดขาด

**โหมดเนื้อหา (Markdown/MDX สำหรับ Docusaurus, Hugo ฯลฯ):**
```bash
npx champollion sync --content-dir ./content
```
แปล docs, blog posts และไฟล์เนื้อหาควบคู่ไปกับ locale JSON การแปลเนื้อหาทำงานแบบขนาน ปรับแต่งได้ด้วย `--content-concurrency`

**Dry run (ดูตัวอย่างโดยไม่เขียนไฟล์):**
```bash
npx champollion sync --dry-run
```

**บังคับแปลซ้ำ key ที่ระบุ:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**บังคับแปลซ้ำไฟล์เนื้อหาทั้งหมด:**
```bash
npx champollion sync --force-content
```

**ตรวจสอบสถานะการแปล:**
```bash
npx champollion status
```
แสดงความครอบคลุม, ระดับคุณภาพ และข้อมูล plugin สำหรับแต่ละคู่ภาษา

**ตรวจสอบ fallback ที่ยังไม่ได้แปล:**
```bash
npx champollion audit
```
แสดงรายการค่า fallback `[EN]` ทั้งหมดที่ยังต้องการการแปล

---

## การแก้ไขปัญหา (Troubleshooting)

| ปัญหา | วิธีแก้ไข |
|---------|-----|
| `OPENROUTER_API_KEY not set` | Export key หรือเพิ่มลงใน `.env` ในไดเรกทอรีหลักของโปรเจกต์ |
| `No locale files found` | ตั้งค่า `localesDir` ในการกำหนดค่า หรือตรวจสอบให้แน่ใจว่าไฟล์ locale ตรงกับการตั้งชื่อมาตรฐาน (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | locale เป้าหมายได้รับข้อความ Latin แทน script ที่คาดหวัง — ลองใช้ model อื่นหรือเพิ่ม coaching data |
| `[GATE] Source echo` | Model ส่งคืนภาษาอังกฤษโดยไม่เปลี่ยนแปลง — coaching data หรือการเปลี่ยน model มักแก้ปัญหาได้ |
| การแปลทั้งหมดถูกแคช | รันด้วย `--no-tm` เพื่อข้าม cache หรือ `--force-keys` สำหรับ key ที่ระบุ |
| Lock file conflicts | `.champollion.lock` ใช้ SHA-256 hash — merge conflict สามารถแก้ไขได้อย่างปลอดภัยโดยเลือกเวอร์ชันใดเวอร์ชันหนึ่ง แล้วรัน sync ใหม่ |

---

## ขั้นตอนถัดไป

- [Quick Start](/docs/getting-started/quick-start) — คำแนะนำการเริ่มต้นใช้งานฉบับสมบูรณ์
- [CLI Reference](/docs/reference/cli) — ทุกคำสั่งและ flag
- [How It Works](/docs/how-it-works) — อธิบาย sync pipeline
- [The Eval Harness Bridge](/docs/guides/bridge) — วิธีที่ champollion เชื่อมต่อกับ Network
- **ต้องการสร้าง translation method ของตัวเอง?** ดูที่ [Network Agent Guide](/docs/network/getting-started/agent-guide) — สร้าง method, พิสูจน์ว่าใช้งานได้บน public leaderboard และแข่งขันเพื่อรับรางวัลหากมีการเปิดรับ (รางวัลเป็นกลไกที่วางแผนไว้ — ดู [Honest Limitations](/docs/network/honest-limitations))
