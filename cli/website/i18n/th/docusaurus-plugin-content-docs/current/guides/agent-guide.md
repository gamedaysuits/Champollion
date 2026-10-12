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
| `languages` | ภาษาปลายทาง (array หรือ object) | `[]` |
| `pairs` | การกำหนดค่าแทนที่รายคู่ภาษา (คีย์ `"src:tgt"`) พร้อมการกำหนดค่า method | ไม่บังคับ |
| `localesDir` | ตำแหน่งที่เก็บไฟล์ locale | `./locales` |
| `model` | โมเดล LLM สำหรับ method `llm`/`llm-coached` | `google/gemini-3.8-flash` |
| `batchSize` | จำนวนคีย์ต่อการเรียก API หนึ่งครั้ง | 80 (LLM); Google Translate จำกัดสูงสุดที่ 128 เซกเมนต์/คำขอ |
| `jsonConcurrency` | การแปล locale พร้อมกันสำหรับคีย์ JSON | 50 |
| `contentConcurrency` | การเรียก API พร้อมกันสำหรับการแปลเนื้อหา | 48 (เอกสาร Docusaurus), 12 (`contentDir`) |

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
| **ว่างเปล่า** | โมเดลไม่ส่งค่าใดๆ กลับมา | `""` |
| **สะท้อนต้นทาง** | โมเดลส่งคืนข้อความภาษาอังกฤษที่เป็นอินพุตโดยไม่มีการเปลี่ยนแปลง | `"Welcome"` สำหรับภาษาญี่ปุ่น |
| **การหลอนวนซ้ำ (Hallucination loop)** | Trigram ซ้ำๆ | `"Qo' Qo' Qo' Qo'"` |
| **ความยาวเพิ่มขึ้นเกินจริง** | เอาต์พุตยาวกว่าต้นทางเกิน 4 เท่า (หากเท่ากับ 4 เท่าพอดีจะผ่าน) | ต้นทาง 10 อักขระ → เอาต์พุต 50 อักขระ |
| **ความถูกต้องของชุดอักษร** | ใช้ชุดอักษรผิดสำหรับ locale นั้นๆ | ข้อความอักษรละตินสำหรับ locale ภาษาอาหรับ |

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

| ไฟล์ | วัตถุประสงค์ | เก็บใน Git หรือไม่? |
|------|---------|------|
| `.champollion.lock` | แฮช SHA-256 ของค่าต้นทางที่แปลแล้ว (สำหรับการตรวจจับการเปลี่ยนแปลง) รวมถึงข้อมูลราย locale: สิ่งที่การ sync เขียน, คีย์ที่การ redo ทิ้งไว้ให้รอดำเนินการ, คีย์ที่ถูกระงับไว้หลังจากการปฏิเสธ | **ใช่** — คอมมิตไฟล์นี้ |
| `.champollion-replaced-edits.jsonl` | คำแปลที่แก้ไขด้วยตนเองซึ่งถูกเขียนทับโดยการ sync พร้อมข้อความเดิม (จะถูกเขียนขึ้นเมื่อเกิดกรณีนี้เท่านั้น) | **ใช่** — คอมมิตไฟล์นี้ |
| `.champollion-content.lock` | เช่นเดียวกัน แต่สำหรับไฟล์เนื้อหา Markdown/MDX | **ใช่** — คอมมิตไฟล์นี้ |
| `.champollion/` | ไดเรกทอรีสถานะภายใน (แคช `tm.json`, การส่งออก XLIFF, ข้อมูลสำรอง) | **ไม่ใช่** — ให้ใส่ใน .gitignore; `tm.json` เป็นแคชในเครื่อง (ดูที่ [การกำหนดค่า](/docs/getting-started/configuration)) |
| ไฟล์ coaching ที่คุณเขียนขึ้นเอง (เช่น `coaching/fr.json`) | องค์ความรู้ทางภาษาศาสตร์ของคุณ | **ใช่** — คอมมิตไฟล์เหล่านี้ |
| `champollion.config.json` | การกำหนดค่าของโปรเจกต์ | **ใช่** — คอมมิตไฟล์นี้ |

---

## รูปแบบการใช้งานทั่วไป

**แปลคู่ภาษาที่กำหนดค่าไว้ทั้งหมด:**
```bash
npx champollion sync
```
Champollion แปลทุก locale แบบคู่ขนาน ด้วยการแคชของ TM จะมีเพียงคีย์ที่เปลี่ยนแปลงเท่านั้นที่ถูกส่งไปยัง API (คู่ภาษาที่ไม่มีการเปลี่ยนแปลงจะถูกดึงมาจากแคช การ sync ทั้งหมดจึงประหยัดค่าใช้จ่าย)

**แปลเฉพาะคู่ภาษาที่ระบุ:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` จะจำกัดการทำงานไว้เฉพาะคู่ภาษาที่ระบุเท่านั้น การตรวจสอบความพร้อมและค่าใช้จ่ายจะมีผลกับคู่ภาษาเหล่านั้นเท่านั้น การระบุคู่ภาษาที่ไม่อยู่ในกราฟคู่ภาษาที่คุณกำหนดค่าไว้จะแจ้งข้อผิดพลาดอย่างชัดเจนพร้อมรายชื่อคู่ภาษาที่กำหนดค่าไว้ทั้งหมด — จะไม่มีการหยุดทำงานเงียบๆ โดยไม่ทำอะไรเด็ดขาด

**วิธีเขียนคู่ภาษา** คู่ภาษาของโปรเจกต์จะเขียนในรูปแบบที่ `champollion.config.json` ใช้เป็นคีย์ นั่นคือ `en:fr` ส่วนคำสั่ง `sync`, `verify` และ `serve` สามารถอ่าน `en>fr` และ `en-fr` ได้เช่นกัน และ `en-pt-BR` จะถูกนำไปจับคู่กับคู่ภาษาที่คุณกำหนดค่าไว้ คำสั่งเกี่ยวกับเครือข่าย (`network register-corpus`, `leaderboard`, `recommend`, `submit`) จะเขียนคู่ภาษาในรูปแบบ `eng>crk` ซึ่งเป็นรูปแบบที่ลีดเดอร์บอร์ดจัดเก็บ และอ่าน `eng-crk` กับ `eng:crk` ในลักษณะเดียวกัน ในกรณีดังกล่าว คู่ภาษาที่มีเฉพาะเครื่องหมายยัติภังค์จะต้องประกอบด้วยรหัสความยาวสองหรือสามตัวอักษรสองรหัส (`eng-crk`) รหัสที่มีขีดกลางในตัวเองจำเป็นต้องใช้ `>`: `--pair "eng>pt-BR"` เนื่องจาก `eng-pt-BR` อาจหมายถึง `eng-pt` และ `BR` ได้เช่นกัน ระบบจึงปฏิเสธและจะไม่คาดเดาโดยเด็ดขาด เมื่อใช้งานในเชลล์ ให้ครอบเครื่องหมายคำพูดรอบรูปแบบ `>`: `--pair "eng>crk"` หากไม่ครอบเครื่องหมายคำพูด เชลล์จะส่งเอาต์พุตไปยังไฟล์ชื่อ `crk`

**โหมดเนื้อหา (โฟลเดอร์ของ Markdown/MDX: `content/` ของ Hugo หรือโฟลเดอร์ใดๆ ก็ตาม สำหรับเอกสาร Docusaurus จะถูกตรวจพบได้โดยไม่ต้องระบุ):**
```bash
npx champollion sync --content-dir ./content
```
แปลเอกสาร, บล็อกโพสต์ และไฟล์เนื้อหาควบคู่ไปกับ JSON ของ locale ผลการแปลแต่ละรายการจะถูกเขียนไว้ข้างๆ ไฟล์ต้นทางในรูปแบบ `<name>.<locale>.md` โดยการแก้ไขที่ผู้ตรวจทานทำไว้จะยังคงอยู่เมื่อไฟล์ต้นทางมีการเปลี่ยนแปลงในจุดอื่น ([การแปลเนื้อหา](/docs/guides/content-translation#reviewing-and-editing-translations)) การแปลเนื้อหาจะทำงานแบบคู่ขนาน ปรับแต่งได้ด้วย `--content-concurrency`

**Dry run (ดูตัวอย่างโดยไม่เขียนไฟล์):**
```bash
npx champollion sync --dry-run
```

**บังคับแปลซ้ำ key ที่ระบุ:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**ประมวลผลไฟล์เนื้อหาทั้งหมดใหม่อีกครั้ง (ข้อความที่แคชไว้จะถูกนำมาใช้ซ้ำ ข้อความที่ไม่มีการเปลี่ยนแปลงจึงไม่มีค่าใช้จ่าย):**
```bash
npx champollion sync --force-content
```

**แปลไฟล์เนื้อหาที่ระบุใหม่ทั้งหมด (มีค่าใช้จ่าย) หรือจำกัดการทำงานไว้เฉพาะบางไฟล์:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**การรันในรูปแบบที่เครื่องอ่านได้:** `--json` จะเขียนออบเจกต์ JSON บรรทัดละหนึ่งรายการ (NDJSON) โดยแต่ละรายการจะมี `level`: ทาง stdout จะเป็นข้อความ `info` และ `ok`, ระเบียน `event` (`"event": "cost"` — ค่าประมาณการ ก่อนถึงเกต `--max-cost` — และ `"event": "file"` หนึ่งรายการต่อไฟล์เนื้อหาและแต่ละ locale) และสุดท้ายคือ `{"level": "summary", "command": "sync", …}` ปิดท้าย; ส่วนทาง stderr จะเป็นบรรทัด `warn` และ `error` ซึ่งเป็น JSON เช่นกัน เลือกสรุปผลจากระดับ (level) ของมัน อย่าเลือกจากตำแหน่งบรรทัดเพียงอย่างเดียว: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'` รหัสออก (Exit code) `2` หมายถึงสำเร็จบางส่วน (มีงานบางส่วนเสร็จสิ้น แต่มีบางอย่างล้มเหลว)

ในการประมาณการ (อีเวนต์ `cost` และ `costEstimate` ในส่วนสรุป) `totalEstimatedCost` จะเป็น `null` เมื่อใดก็ตามที่มีส่วนใดส่วนหนึ่งไม่มีราคาที่ทราบแน่ชัด — จะไม่มีการรวมผลรวมบางส่วน และไม่มีการใช้ `0` แทนค่าที่ไม่ทราบ; `knownEstimatedCost` จะเก็บส่วนที่มีการคิดราคาไว้, `unknownCost.reason` จะระบุชื่อคู่ภาษาที่ไม่มีราคา และ `unknownCost.notes` จะระบุว่ารายการใดไม่มีราคาและเพราะเหตุใด — `{ subject, pairs, note }` เช่น ชื่อโมเดลที่ไม่มีในรายการของ OpenRouter (ซึ่งน่าจะพิมพ์ผิด พร้อมระบุชื่อที่ใกล้เคียงที่สุดในรายการ), โมเดลที่มีในรายการแต่ไม่มีราคาต่อโทเคน หรือรายการราคาที่ไม่สามารถอ่านได้ โมเดลบนเครื่องนี้ (เอนด์พอยต์ `local` หรือ `api` ที่ `localhost`/`127.0.0.1`/`::1`) จะคิดราคาเป็น `0` พร้อมกับ `"local": true` ค่า `sentToModel` ในส่วนสรุปจะนับคีย์ที่ส่งไปยัง method ในการรันครั้งนี้ (`tmHits`: ดึงมาจากแคช) ส่วนสรุปของการ dry run จะมี `preflight: { ready, failures }` — `ready: false` หมายความว่าการรันจริงจะหยุดทำงานและจบการทำงานด้วยรหัส `1` (คีย์หายไป หรือเซิร์ฟเวอร์โมเดลที่การรันต้องใช้ไม่ตอบสนอง) แม้ว่าการ dry run เองจะจบการทำงานด้วยรหัส `0` ก็ตาม ([รหัสการสิ้นสุดการทำงาน (exit codes)](/docs/reference/cli#sync-exit-codes)) เมื่อใช้ `--max-cost` จะมี `maxCost: { cap, estimatedCost, wouldStop }` รวมอยู่ด้วย — `wouldStop: true` (พร้อมกับ `exitCode: 2` และ `reason`) หมายความว่าการรันจริงจะหยุดที่วงเงินสูงสุดก่อนที่จะมีการเรียก API ใดๆ `realRun: { exitCode, wouldStop, reasons }` คือรหัสการสิ้นสุดการทำงานที่การรันจริงจะจบลง เท่าที่การแสดงตัวอย่างจะระบุได้: ทั้งการตรวจสอบเบื้องต้น (preflight) และวงเงินสูงสุด รวมถึงสิ่งที่อาจทำให้การทำงานสำเร็จเพียงบางส่วน — คีย์ที่ถูกระงับไว้, ข้อความพหูพจน์บนดิสก์ที่ไม่มีรูปแบบที่ภาษานั้นใช้ซึ่งระบบจะไม่ส่งคำขอซ้ำอีก (นับอยู่ใน `totalPluralGaps` ของการ dry run) การ dry run ไม่ได้ทำการตรวจสอบความถูกต้องของผลลัพธ์ (`verify: { "ran": false }`) ให้รัน dry run พร้อมกับ `--method`/`--model` ของการรันจริง มิฉะนั้น ระบบจะตรวจสอบ method ตามที่ระบุไว้ในการกำหนดค่า

**ตรวจสอบสถานะการแปล:**
```bash
npx champollion status
```
แสดง method, โมเดล, ความครอบคลุม (coverage) และข้อมูลปลั๊กอินของแต่ละคู่ภาษา (มี `qualityTier` เฉพาะเมื่อมีการตั้งค่าไว้ในการกำหนดค่า — เป็นเพียงป้ายกำกับ ไม่ใช่การวัดค่าจริง)

**ตรวจสอบ fallback ที่ยังไม่ได้แปล:**
```bash
npx champollion audit
```
แสดงรายการค่า fallback `[EN]` ทั้งหมดที่ยังต้องการการแปล

---

## การแก้ไขปัญหา (Troubleshooting)

| ปัญหา | วิธีแก้ไข |
|---------|-----|
| `OPENROUTER_API_KEY not set` | ส่งออก (export) คีย์หรือเพิ่มลงใน `.env` ที่รูทของโปรเจกต์ของคุณ |
| `No locale files found` | ตั้งค่า `localesDir` ในการกำหนดค่า หรือตรวจสอบให้แน่ใจว่าไฟล์ locale ของคุณตั้งชื่อตามมาตรฐาน (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | locale ปลายทางของคุณได้รับข้อความอักษรละตินแทนชุดอักษรที่คาดไว้ — ลองใช้โมเดลอื่นหรือเพิ่มข้อมูล coaching |
| `[GATE] Source echo` | โมเดลส่งคืนภาษาอังกฤษโดยไม่มีการเปลี่ยนแปลง — ข้อมูล coaching หรือโมเดลอื่นมักจะแก้ไขปัญหานี้ได้ |
| การแปลทั้งหมดมาจากแคช | รันด้วย `--no-tm` เพื่อข้ามแคช หรือ `--force-keys` สำหรับคีย์ที่ระบุ |
| ข้อขัดแย้งของ Lock file | `.champollion.lock` เก็บค่าแฮชไว้ — ข้อขัดแย้งจากการผสาน (merge conflict) สามารถแก้ไขได้อย่างปลอดภัยโดยเลือกเก็บเวอร์ชันใดเวอร์ชันหนึ่งไว้ แล้วรัน sync ใหม่อีกครั้ง การเก็บระเบียนราย locale ของอีกฝั่งอาจทำให้บางค่าถูกอ่านว่าเป็นการแก้ไขด้วยตนเอง (การ redo ทั้งหมดจะเก็บค่าเหล่านั้นไว้และระบุชื่อออกมา; `--redo keys:` จะแทนที่ค่าหนึ่ง) — จะไม่มีกรณีตรงกันข้ามเด็ดขาด |
| คีย์ถูก "ระงับไว้" | เกตควบคุมคุณภาพ (quality gate) เคยปฏิเสธคำตอบของโมเดลนั้นมาก่อน; การ sync แบบธรรมดาจะไม่ส่งคำขอนั้นซ้ำ (เพราะจะทำให้เสียค่าใช้จ่ายสำหรับคำตอบเดิม) ใช้ `champollion sync --redo keys:<key>` เพื่อขอใหม่อีกครั้ง; หรือเพิ่ม `fallback`, ระบุไว้ใน `noTranslate` หรือเขียนขึ้นด้วยตนเอง |

---

## ขั้นตอนถัดไป

- [Quick Start](/docs/getting-started/quick-start) — คำแนะนำการเริ่มต้นใช้งานฉบับสมบูรณ์
- [CLI Reference](/docs/reference/cli) — ทุกคำสั่งและ flag
- [How It Works](/docs/how-it-works) — อธิบาย sync pipeline
- [The Eval Harness Bridge](/docs/guides/bridge) — วิธีที่ champollion เชื่อมต่อกับ Network
- **ต้องการสร้าง translation method ของตัวเอง?** ดูที่ [Network Agent Guide](/docs/network/getting-started/agent-guide) — สร้าง method, พิสูจน์ว่าใช้งานได้บน public leaderboard และแข่งขันเพื่อรับรางวัลหากมีการเปิดรับ (รางวัลเป็นกลไกที่วางแผนไว้ — ดู [Honest Limitations](/docs/network/honest-limitations))
