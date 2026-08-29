---
sidebar_position: 6
title: "การแก้ไขปัญหา"
---

# การแก้ไขปัญหา

ปัญหาที่พบบ่อยและวิธีแก้ไขสำหรับ champollion

## API และการยืนยันตัวตน

### "OPENROUTER_API_KEY not found"

Champollion ต้องการ API key สำหรับการแปลด้วย LLM ตั้งค่าเป็นตัวแปรสภาพแวดล้อม:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

หรือในไฟล์ `.env` (หากโปรเจกต์ของคุณโหลดไฟล์ `.env`):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
หากคุณมีเพียง Google Translate API key, champollion จะตรวจจับและใช้ Google Translate เป็นวิธีการเริ่มต้นโดยอัตโนมัติ ไม่จำเป็นต้องเปลี่ยนการตั้งค่า
:::

### "401 Unauthorized" จาก OpenRouter

API key ของคุณไม่ถูกต้องหรือหมดอายุแล้ว ตรวจสอบได้ที่ [openrouter.ai/keys](https://openrouter.ai/keys)

### "429 Too Many Requests" / การจำกัดอัตราการใช้งาน

Champollion จัดการข้อจำกัดอัตราการใช้งานภายในด้วย exponential backoff หากคุณพบปัญหานี้อย่างต่อเนื่อง:

1. **ลดขนาด batch** ในการตั้งค่าของคุณ:
   ```json
   { "batchSize": 15 }
   ```
2. **ใช้โมเดลที่มีขีดจำกัดอัตราการใช้งานสูงกว่า** (เช่น `google/gemini-3.5-flash` มีขีดจำกัดที่ใจกว้าง)
3. **ใช้วิธีที่ถูกกว่า/เร็วกว่า** สำหรับคู่ภาษาที่มีปริมาณสูง — Google Translate ไม่มีขีดจำกัดอัตราการใช้งาน:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### โมเดลไม่พบ / ข้อผิดพลาด 404

ผู้ให้บริการ LLM โดยตรง (`openai`, `anthropic`, `gemini`) จะตรวจสอบ string ของโมเดลในการใช้งานครั้งแรก หากคุณเห็นคำเตือน:

**"looks like an OpenRouter path"** — คุณกำลังใช้โมเดลในรูปแบบ OpenRouter (`google/gemini-3.5-flash`) กับผู้ให้บริการโดยตรง ผู้ให้บริการโดยตรงใช้ชื่อโมเดลแบบย่อ:

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

หรือเปลี่ยนไปใช้วิธี `llm` เพื่อใช้ OpenRouter:
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"is an Anthropic/OpenAI/Gemini model"** — คุณกำลังส่งโมเดลไปยังผู้ให้บริการที่ไม่ถูกต้อง:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — โมเดลอาจถูกยกเลิกหรือสะกดผิด Champollion ดึงรายการโมเดลที่ใช้งานได้จากผู้ให้บริการและแนะนำทางเลือกอื่น ตรวจสอบเอกสารของผู้ให้บริการสำหรับชื่อโมเดลปัจจุบัน

:::tip[การเลิกใช้งานโมเดลเป็นเรื่องปกติ]
ผู้ให้บริการมักจะยกเลิกชื่อโมเดลเป็นประจำ หากการแปลล้มเหลวกะทันหันหลังจากผู้ให้บริการอัปเดต ให้ตรวจสอบผลลัพธ์ของ `[WARN]` — จะแสดงตัวเลือกอื่นที่ใช้งานได้ในปัจจุบัน
:::

## คุณภาพการแปล

### การแปลสะท้อนภาษาต้นฉบับ

quality gate จะตรวจจับสิ่งนี้ หากการแปลเหมือนกับต้นฉบับภาษาอังกฤษ จะถูกปฏิเสธและลองใหม่ หากยังคงเกิดขึ้น:

1. **ตรวจสอบโมเดล** — โมเดลบางตัวทำงานได้ไม่ดีสำหรับคู่ภาษาเฉพาะ
2. **เพิ่มคำแนะนำ register** — บอกโมเดลว่าต้องการผลลัพธ์เป็นภาษาใด:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **ลองใช้โมเดลอื่น** — เปลี่ยนจาก `gpt-4o-mini` เป็น `gpt-4o` หรือ `google/gemini-2.5-pro`

### ผลลัพธ์เป็นสคริปต์ที่ไม่ถูกต้อง (เช่น ข้อความ Latin สำหรับภาษาญี่ปุ่น)

การตรวจสอบการปฏิบัติตามสคริปต์ของ quality gate จะตรวจจับกรณีส่วนใหญ่ หากยังคงเกิดขึ้น:

- ตรวจสอบว่า locale code ถูกต้อง (`ja` ไม่ใช่ `jp`)
- เพิ่มคำแนะนำสคริปต์อย่างชัดเจนในฟิลด์ `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### รูปแบบ hallucination ในผลลัพธ์

รูปแบบ trigram ที่ซ้ำกัน (เช่น "hello hello hello") จะถูกตรวจจับโดย hallucination loop detector หากผลลัพธ์ผิดปกติแต่ผ่านตัวตรวจจับ:

1. **ลดขนาด batch** — batch ที่เล็กกว่าให้ผลลัพธ์ที่มีสมาธิมากขึ้น
2. **ใช้โมเดลที่แข็งแกร่งกว่า** — โมเดลขนาดใหญ่กว่า hallucinate น้อยกว่าสำหรับสคริปต์ที่ไม่ใช่ Latin
3. **เพิ่มข้อมูล coaching** — คำศัพท์จากพจนานุกรมช่วยยึดการแปล

## ปัญหาไฟล์และรูปแบบ

### "No locale files found"

Champollion ตรวจจับไฟล์ locale โดยอัตโนมัติ หากไม่พบ:

1. **ตรวจสอบ `localesDir`** — ต้องชี้ไปยังไดเรกทอรีที่มีไฟล์ locale:
   ```json
   { "localesDir": "./locales" }
   ```
2. **ตรวจสอบการตั้งชื่อไฟล์** — ไฟล์ต้องตั้งชื่อตาม locale code: `en.json`, `fr.json` เป็นต้น
3. **ตรวจสอบรูปแบบ** — รูปแบบที่รองรับ: JSON, nested JSON, YAML, TOML

### ความขัดแย้งของ lock file

หาก `.champollion.lock` อยู่ในสถานะที่ไม่ดี:

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
การลบ lock file หมายความว่าการ sync ครั้งถัดไปจะแปลทุก key ใหม่ ไม่ใช่แค่ที่เปลี่ยนแปลง ซึ่งมีผลต่อค่าใช้จ่าย API สำหรับโปรเจกต์ขนาดใหญ่
:::

### การแปล key เฉพาะใหม่

หากการแปลบางรายการไม่ถูกต้องและคุณต้องการบังคับให้แปลใหม่โดยไม่ลบ lock file:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

flag `--force-keys` จะแทนที่การตรวจสอบ hash ของ lock file สำหรับ key เหล่านั้น บังคับให้แปลใหม่โดยไม่กระทบ key อื่น

### การแปลเนื้อหาทำให้ code block เสียหาย

สิ่งนี้ไม่ควรเกิดขึ้น — code block จะถูกป้องกันก่อนการแปล หากเกิดขึ้น:

1. ตรวจสอบว่า code block ใช้ fencing มาตรฐาน (triple backticks)
2. ตรวจสอบ code block ที่ไม่ได้ปิดในต้นฉบับ Markdown
3. รายงานปัญหา — นี่คือ bug ในระบบ sentinel shielding

## ปัญหา CLI

### `--watch` ไม่ตรวจจับการเปลี่ยนแปลง

การเฝ้าดูไฟล์ใช้ Node.js native `fs.watch` ปัญหาที่ทราบ:

- **Network drives** — `fs.watch` ทำงานไม่น่าเชื่อถือบน NFS/SMB mounts
- **Docker volumes** — ใช้ polling mode หรือรัน champollion ภายใน container
- **ไดเรกทอรีขนาดใหญ่** — watcher ตรวจสอบ `localesDir` แบบ recursive; tree ที่ลึกมากอาจเกินขีดจำกัดของ OS

### `npx` รันเวอร์ชันเก่า

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

หรือติดตั้งแบบ global:

```bash
npm install -g champollion
champollion sync
```

## ประสิทธิภาพ

### การ sync ช้าสำหรับหลายภาษา

Champollion แปลทุก locale พร้อมกันโดยค่าเริ่มต้น หากการ sync ยังช้าอยู่:

1. **ใช้ Google Translate สำหรับคู่ภาษาที่มีปริมาณสูง** — เร็วกว่าการแปลด้วย LLM 10–50 เท่า
2. **เพิ่มขนาด batch** (ค่าเริ่มต้นคือ 80):
   ```json
   { "batchSize": 120 }
   ```
3. **ปรับ concurrency** — parallelism ของ JSON locale ค่าเริ่มต้นคือ 200 และ content คือ 48 หาก API provider ของคุณรองรับขีดจำกัดอัตราการใช้งานที่สูงกว่า:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **ใช้โมเดลที่เร็ว** — `gpt-4o-mini` เร็วกว่า `gpt-4o` อย่างมีนัยสำคัญ

### ค่าใช้จ่าย API สูง

- **ตรวจสอบขนาด batch** — batch ที่ใหญ่กว่า = การเรียก API น้อยกว่า = ค่าใช้จ่ายต่ำกว่า
- **ใช้ Translation Memory** — TM เปิดใช้งานโดยค่าเริ่มต้น รัน `champollion tm stats` เพื่อตรวจสอบว่าทำงานอยู่ หากคุณเห็น 0 รายการหลังจาก sync หลายครั้ง อาจมีปัญหากับสิทธิ์ไดเรกทอรี `.champollion/` ของคุณ
- **ใช้ prompt caching** — Champollion แยก system/user messages สำหรับ cache hits บนโมเดล Anthropic และ Google
- **ใช้ Google Translate สำหรับภาษา Tier 2** — ดู cookbook [แปล 30 ภาษา](/docs/tutorials/translate-30-languages)

### การแปลที่ล้าสมัยหลังจากเปลี่ยนผู้ให้บริการ

หากคุณเปลี่ยนจากวิธีการแปลหนึ่งไปยังอีกวิธีหนึ่ง (เช่น `llm` เป็น `deepl`) TM cache อาจยังคงให้การแปลเก่าจากวิธีการก่อนหน้าสำหรับ key ที่ข้อความต้นฉบับไม่เปลี่ยนแปลง cache key รวมชื่อวิธีการ ดังนั้นกรณีส่วนใหญ่จะถูกจัดการโดยอัตโนมัติ แต่หากคุณเปลี่ยน `model` ภายในวิธีการเดียวกัน:

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

ดู [Translation Memory](/docs/concepts/translation-memory) สำหรับรายละเอียดเกี่ยวกับการออกแบบ cache key

## การกู้คืนจากเวอร์ชันที่มีปัญหา {#recover-old-damage}

ค่าที่ถูกเขียนโดย pipeline เวอร์ชันเก่าจะ **ไม่สามารถซ่อมแซมตัวเองได้**: เนื่องจาก manifest hash ของค่าเหล่านั้นตรงกับ source ปัจจุบัน ดังนั้น `sync` จึงถือว่าค่าเหล่านั้นได้รับการจัดการเรียบร้อยแล้ว และจะไม่มี gate ใดตรวจสอบค่าเหล่านั้นอีก หากคุณกำลังอัปเกรดโปรเจกต์ที่เคยรันเวอร์ชันก่อน 0.3.0 ให้สันนิษฐานไว้ก่อนว่าอาจมีความเสียหายตกค้างอยู่ในไฟล์ locale ของคุณ และควรทำการตรวจสอบก่อน:

```bash
champollion integrity
```

การตรวจสอบจะตรวจจับรูปแบบความเสียหายที่รู้จัก และระบุวิธีแก้ไขสำหรับแต่ละรายการ:

| สิ่งที่พบ | คำอธิบาย | วิธีแก้ไข |
|---------|-----------|-----|
| `UNEXPECTED PUA` | ผลลัพธ์จากการแปลงสคริปต์ (pIqaD/Tengwar/Kryptonian) ที่ถูกเขียนลงไปทั้งที่ไม่ต้องการให้แปลง — ทำให้แสดงผลเป็นค่าว่าง | `champollion repair-script` (ออฟไลน์, แม่นยำสำหรับ pIqaD) |
| `HOLLOWED VALUES` | source ที่ตัวอักษรถูกลบออก — เป็นผลลัพธ์จากช่วงก่อนที่จะมี content-preservation gate | แปลใหม่ (ดูด้านล่าง) |
| `NO-TRANSLATE DRIFT` | URL หรือคีย์อื่นๆ ที่ควรคงไว้ตามเดิม (verbatim) แต่กลับถูก "แปล" | `champollion sync` (ซ่อมแซมฟรีโดยอัตโนมัติ) |

สำหรับค่าที่ว่างเปล่า (hollowed values) — หรือ locale ใดๆ ที่คุณไม่เชื่อถืออีกต่อไป — ให้ทำการบิลด์ใหม่ (rebuild):

```bash
champollion sync --pair en:tlh --force
```

`--force` จะนำ source key ทุกตัวสำหรับคู่ภาษาที่อยู่ในขอบเขตกลับเข้าคิวใหม่ (re-queue) การดึงข้อมูลจาก Translation Memory ยังคงทำงานอยู่ แต่ทุกข้อมูลที่ดึงมาจะ **ถูกตรวจสอบความถูกต้องกับ gate ปัจจุบันก่อน** — ค่าในแคชที่ถูก gate ปฏิเสธจะถูกลบออกและคิดค่าใช้จ่ายในการแปลใหม่ (re-billed) ดังนั้นแคชที่มีปัญหาจะซ่อมแซมตัวเองแทนที่จะถูกนำไปใช้ในการบิลด์ใหม่ เพิ่ม `--no-tm` หากคุณต้องการแปลใหม่ทั้งหมดโดยไม่สนใจแคช และใช้ `--max-cost` เพื่อจำกัดค่าใช้จ่ายในทั้งสองกรณี

การตรวจสอบหลังการซิงค์ (Post-sync verification) จะรายงานรูปแบบความเสียหายเหล่านี้ด้วยเช่นกัน ดังนั้น locale ที่เสียหายจะทำให้ `sync` ล้มเหลวอย่างชัดเจน (พร้อมระบุวิธีแก้ไข) แทนที่จะถูกปล่อยผ่านไปอย่างเงียบๆ

### การนำเข้าคิวใหม่เพียงครั้งเดียวหลังจากการล้างข้อมูลด้วย `--no-tm` {#one-time-requeue}

หากการกู้คืนของคุณใช้ `--no-tm` ให้คาดไว้เลยว่าการซิงค์ **ครั้งถัดไป** จะมีการนำคีย์ประเภท source-echo ที่คุณคิดว่าจัดการเรียบร้อยแล้วกลับเข้าคิวอีกชุดหนึ่ง `--no-tm` จะเขียนค่าโดยไม่ประทับตรา (stamping) ลงใน Translation Memory และค่าที่ *ไม่ถูกประทับตรา* ซึ่งเหมือนกับ source ทุกประการ จะไม่สามารถแยกแยะออกจากค่าที่ยังไม่ได้แปลได้ — ดังนั้นมันจึงถูกนำเข้าคิวใหม่หนึ่งครั้ง เมื่อได้ผลลัพธ์กลับมา (ซึ่งมักจะเหมือนเดิม) ก็จะถูกประทับตรา และถือว่าจัดการเรียบร้อยอย่างถาวร นี่คือค่าใช้จ่ายที่เกิดขึ้นเพียงครั้งเดียว ไม่ใช่การวนลูป คุณสามารถดูตัวอย่างแบบเจาะจงได้ว่ามีคีย์ใดบ้างโดยใช้:

```bash
champollion sync --dry --list-keys
```

## ยังติดปัญหาอยู่?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — ค้นหาปัญหาที่มีอยู่หรือรายงานปัญหาใหม่
- **[เอกสาร Architecture](/docs/concepts/architecture)** — ทำความเข้าใจการออกแบบระบบ
- **[Quality Gate](/docs/concepts/quality-gate)** — วิธีการทำงานของการตรวจสอบภายใต้ระบบ
