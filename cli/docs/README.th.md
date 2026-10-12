# Champollion

[![เวอร์ชัน npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![สัญญาอนุญาต: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


แปลไฟล์ locale ของคุณด้วยคำสั่งเดียว:

```bash
npx champollion sync
```

Champollion จะตรวจหาไฟล์ locale รูปแบบของไฟล์ และภาษาปลายทางของคุณโดยอัตโนมัติ เครื่องมือนี้จะแปลคีย์ที่ขาดหายไป ข้ามส่วนที่แปลเสร็จแล้ว และเขียนผลลัพธ์ลงไฟล์ แค่นั้นเลย

**สัญญาอนุญาต:** เปิดเผยซอร์สโค้ด (source-available) ภายใต้ [PolyForm Noncommercial License 1.0.0](../LICENSE) — ใช้งาน ดัดแปลง และเผยแพร่ได้ฟรีสำหรับวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ (โปรเจกต์ส่วนตัว งานวิจัย การสอน และการใช้งานโดยองค์กรการกุศล โรงเรียน และหน่วยงานของรัฐ) การใช้งานเพื่อวัตถุประสงค์เชิงพาณิชย์จะไม่ครอบคลุมอยู่ในสัญญาอนุญาตนี้ ส่วน evaluation harness เป็นโอเพนซอร์ส (AGPL-3.0-or-later) [ใครสามารถใช้งานได้บ้าง](https://champollion.dev/docs/getting-started/who-may-use-this) · [รายละเอียด](#license)

> **ส่วนหนึ่งของ Champollion** — โครงสร้างพื้นฐานสำหรับการประเมินการแปลด้วยเครื่อง (machine-translation)
> ที่เชื่อถือได้ในทุกภาษา เปิดเผยซอร์สโค้ดและใช้งานได้ฟรีสำหรับวัตถุประสงค์
> ที่ไม่ใช่เชิงพาณิชย์ (evaluation harness และ shared registries เป็นโอเพนซอร์ส) CLI นี้คือ
> ส่วนการปรับใช้ (deployment) ของโปรเจกต์ที่ใหญ่กว่า
> ซึ่งสร้างชุดทดสอบและแผนที่ที่แสดงว่าใครสามารถแปลอะไรได้บ้าง
> แต่ละวิธีมีประสิทธิภาพดีแค่ไหนในข้อความแต่ละประเภท และยังมีช่องโหว่อยู่ตรงไหนบ้าง ระบบนี้
> ทำงานบนเกณฑ์มาตรฐาน (benchmark) สองประเภท: เกณฑ์มาตรฐานสาธารณะบนข้อมูลเปิด (ครอบคลุมกว้างขวาง ราคาถูก
> ยินดีรับทุกวิธี) และเกณฑ์มาตรฐานอธิปไตย (sovereign benchmarks) — ชุดทดสอบลับที่
> ชุมชนสร้างขึ้น เป็นเจ้าของ และควบคุม โดยที่เราจะไม่มีวันได้เห็น โครงสร้างพื้นฐานนี้
> เปิดเผยซอร์สโค้ดและดูแลโดยผู้ดูแลเพียงรายเดียว ชุดทดสอบและวิธีการสำหรับ
> ภาษาของชุมชนนั้นๆ จะเป็นของชุมชนนั้น ออกแบบมาเพื่อทำงานร่วมกับชุมชน
> โดยไม่โฮสต์คลังข้อมูล (corpora) ของพวกเขา — การออกแบบนี้มอบกุญแจให้พวกเขาเป็นผู้ควบคุม ยินดีรับทุกวิธีการแปล ทั้งจากมนุษย์และ
> เครื่องจักร สำรวจเครือข่ายได้ที่
> [champollion.dev/docs/network](https://champollion.dev/docs/network/)

## ทำไมไม่เขียนสคริปต์เองล่ะ?

คุณอาจจะเขียนสคริปต์ง่ายๆ เพื่อวนลูปคีย์ภาษาอังกฤษแล้วเรียกใช้ Google Translate นักพัฒนาส่วนใหญ่ก็ทำแบบนั้น — ใช้โค้ดประมาณ 30 บรรทัด และนี่คือเหตุผลว่าทำไมวิธีนั้นถึงมีปัญหา:

- **ไม่มีการตรวจจับการเปลี่ยนแปลง** เมื่อคุณอัปเดตข้อความภาษาอังกฤษ คำแปลจะล้าสมัยไปตลอดกาล Champollion ติดตามค่าต้นฉบับทุกค่าด้วยแฮช SHA-256 และแปลใหม่เฉพาะส่วนที่เปลี่ยนแปลงเท่านั้น
- **ไม่มีการจัดกลุ่ม (batching)** การเรียก API หนึ่งครั้งต่อหนึ่งคีย์หมายความว่า 200 คีย์ = การรับส่งข้อมูล 200 รอบ Champollion จัดกลุ่มอย่างชาญฉลาด (กำหนดค่าได้ ค่าเริ่มต้นคือ 80 คีย์/กลุ่มสำหรับ LLM, 128 สำหรับ Google)
- **ไม่มีการตรวจสอบคุณภาพ (quality gate)** การแปลด้วยเครื่องอาจเกิดอาการหลอน (hallucinate) ส่งคืนข้อความต้นฉบับ หรือแสดงผลลัพธ์ในระบบตัวเขียนที่ผิด Champollion ตรวจสอบทุกคำแปลก่อนเขียนลงไป — ผลลัพธ์ที่ว่างเปล่า การส่งคืนข้อความต้นฉบับ การวนซ้ำซ้ำซาก ความยาวที่เพิ่มขึ้นผิดปกติ เนื้อหาที่ถูกลบ และระบบตัวเขียนที่ผิด จะถูกตรวจจับและปฏิเสธ ระบบตรวจสอบนี้จะจับผลลัพธ์ที่พัง ไม่ใช่ความหมายที่ผิด
- **ไม่รู้จักรูปแบบไฟล์** ถูกฮาร์ดโค้ดไว้แค่ JSON ใช่ไหม? Champollion จัดการได้ทั้ง JSON, TOML, YAML และ Hugo Markdown (frontmatter + body) พร้อมระบบตรวจจับอัตโนมัติ
- **ไม่มีความปลอดภัย** Champollion ป้องกัน prototype pollution, path traversal ผ่านรหัส locale ที่ถูกสร้างขึ้นมาเพื่อโจมตี และการเสียหายของบล็อกโค้ดระหว่างการแปล Markdown

Champollion คือเวอร์ชันระดับโปรดักชันของสคริปต์นั้น

> [!NOTE]
> **สิ่งที่ Champollion แปล** Champollion มุ่งเน้นไปที่ **ไฟล์ locale และเนื้อหาที่มีโครงสร้าง** — คู่คีย์-ค่าของ JSON, การตั้งค่า TOML/YAML, หน้า Hugo Markdown, เอกสารแลกเปลี่ยน XLIFF เครื่องมือนี้ได้รับการปรับแต่งมาสำหรับข้อความเขียนที่เป็นทางการ: ข้อความ UI, เอกสารประกอบ, การสื่อสารอย่างเป็นทางการ, สื่อการเรียนการสอน ไม่ใช่แชตบอต เครื่องมือแปลเสียงแบบเรียลไทม์ หรือ AI สนทนาอเนกประสงค์ สำหรับแต่ละคู่ภาษา คุณสามารถกำหนดวิธีการแปลได้ — ตั้งแต่ API เชิงพาณิชย์ (Google Translate, DeepL) ไปจนถึงปลั๊กอินที่พัฒนาโดยชุมชนซึ่งผ่านการวัดเกณฑ์มาตรฐานผ่าน [MT Eval Arena](https://champollion.dev/arena)

## เริ่มต้นใช้งานอย่างรวดเร็ว

```bash
npm install --save-dev champollion
```

### รับ API Key

Champollion จำเป็นต้องมีแบ็กเอนด์สำหรับการแปล เลือกมาหนึ่งอย่าง:

| ผู้ให้บริการ | คีย์ | เหมาะที่สุดสำหรับ |
|----------|-----|----------|
| **OpenRouter** (แนะนำ) | `OPENROUTER_API_KEY` | โปรเจกต์ที่มีเนื้อหาเยอะ, Markdown, โมเดลกว่า 200+ แบบ |
| **OpenAI** | `OPENAI_API_KEY` | เข้าถึง GPT-4o โดยตรง |
| **Anthropic** | `ANTHROPIC_API_KEY` | เข้าถึง Claude โดยตรง |
| **Gemini** | `GEMINI_API_KEY` | มีแพ็กเกจใช้งานฟรี |
| **DeepL** | `DEEPL_API_KEY` | ภาษายุโรป, รองรับอภิธานศัพท์ (glossary) |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130+ ภาษา, ปริมาณงานสูง |

**เริ่มต้นเร็วที่สุด** (ฟรี): สมัครใช้งานที่ [aistudio.google.com](https://aistudio.google.com/apikey) เพื่อรับคีย์ Gemini ฟรี:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200+ โมเดล): สมัครใช้งานที่ [openrouter.ai](https://openrouter.ai) จากนั้น:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

ทางเลือก **Google Translate** (เฉพาะคู่คีย์-ค่าเท่านั้น — ไม่รองรับ Markdown):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **หมายเหตุ**: หากตั้งค่าเฉพาะ `GOOGLE_TRANSLATE_API_KEY` champollion จะสลับไปใช้ Google Translate โดยอัตโนมัติ ไม่จำเป็นต้องเปลี่ยนการตั้งค่าใดๆ โดยจะใช้ REST API โดยตรง — ไม่ต้องใช้ SDK, ไม่ต้องใช้ service account, ไม่ต้องใช้ `pip install` ใช้แค่คีย์เท่านั้น

แค่นั้นเลย หากต้องการควบคุมเพิ่มเติม ให้สร้างไฟล์คอนฟิก:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

แต่ละภาษาจะมาพร้อมกับ **พรีเซ็ตระดับภาษา (register presets)** — คำสั่งกำหนดน้ำเสียง/ความเป็นทางการที่สร้างไว้ล่วงหน้าซึ่งปรับให้เข้ากับระบบภาษาของภาษานั้นๆ (vouvoiement สำหรับภาษาฝรั่งเศส, Siezen สำหรับภาษาเยอรมัน, です/ます สำหรับภาษาญี่ปุ่น, 해요체 สำหรับภาษาเกาหลี) วิซาร์ดการเริ่มต้น (init wizard) จะให้คุณเลือกดูและเลือกพรีเซ็ตได้ หรือส่ง `--yes` เพื่อยอมรับค่าเริ่มต้น

### ภาษาต้นทางที่ไม่ใช่ภาษาอังกฤษ

หากภาษาต้นทางของคุณไม่ใช่ภาษาอังกฤษ:

```bash
champollion sync --source fr                      # CLI flag
```

หรือตั้งค่าอย่างถาวรในไฟล์คอนฟิกของคุณ:

```json
{ "inputLocale": "fr" }
```

## สิ่งที่เครื่องมือนี้ทำ

คุณจัดการเฟรมเวิร์ก i18n (next-intl, i18next, Hugo) ส่วน Champollion จะจัดการไฟล์คำแปลให้เอง

- **รองรับหลายรูปแบบ** — JSON, TOML, YAML, Hugo Markdown (front matter + body) และ XLIFF 1.2
- **ทำงานแบบส่วนเพิ่ม (Incremental)** — แปลเฉพาะส่วนที่เปลี่ยนแปลงเท่านั้น (การติดตามด้วยแฮช SHA-256)
- **มีระบบแคช** — Translation Memory จะจัดเก็บผลลัพธ์ก่อนหน้า การรันซิงก์ใหม่จะไม่มีค่าใช้จ่ายสำหรับคีย์ที่ไม่มีการเปลี่ยนแปลง
- **มีการตรวจสอบคุณภาพ** — ตรวจสอบทุกคำแปลเพื่อหาผลลัพธ์ที่พัง: การวนซ้ำซ้ำซาก ผลลัพธ์ที่ใช้ระบบตัวเขียนผิด การส่งคืนข้อความต้นฉบับ ความยาวที่เพิ่มขึ้นผิดปกติ และเนื้อหาที่ถูกลบ (ไม่ได้ตรวจสอบความหมาย)
- **รับรู้เนื้อหา** — วิธีการแบบ LLM จะปกป้องบล็อกโค้ด, shortcodes, ลิงก์ และตัวแปร interpolation ระหว่างการแปล Markdown
- **เครื่องมือสำหรับไปป์ไลน์** — `lint`, `audit`, `integrity`, `seo` สำหรับ CI gates
- **ทำงานร่วมกับ XLIFF ได้** — ส่งออกคำแปลเพื่อให้ผู้เชี่ยวชาญตรวจสอบในเครื่องมือ CAT (memoQ, SDL Trados, Phrase) และนำเข้ากลับมาได้
- **พึ่งพาแพ็กเกจน้อยที่สุด** — มี runtime dependencies เพียงสองตัว: `@translated/lara` (Lara provider SDK) และ `cree-sro-syllabics` (ตัวแปลง Plains Cree SRO ⇄ syllabics ของ ALTLab/NRC) ต้องการ Node 20+

## ก้าวข้ามขีดจำกัดของ Google Translate

การเริ่มต้นใช้งานอย่างรวดเร็วช่วยให้คุณรันงานด้วย LLM หรือ Google Translate ได้ แต่ Google Translate รองรับประมาณ 130 ภาษา ในขณะที่โลกนี้มีมากกว่า 7,000 ภาษา

**แนวคิดหลักของ Champollion: วิธีการแปลสามารถกำหนดค่าได้ตามคู่ภาษา** ใช้ Google Translate สำหรับภาษาฝรั่งเศส, ใช้ LLM ที่ได้รับการฝึกสอนด้วยบันทึกไวยากรณ์และพจนานุกรมของคุณเองสำหรับภาษา Plains Cree และใช้ API ที่คุณโฮสต์เองสำหรับภาษาที่ไม่มีบริการใดครอบคลุม — ทั้งหมดนี้อยู่ในโปรเจกต์เดียวกัน และใช้ CLI ตัวเดียวกันทั้งหมด

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

หากคุณหาวิธีแปลคู่ภาษาใดภาษาหนึ่งได้ — ไม่ว่าจะผ่าน prompt engineering, พจนานุกรมของชุมชน, ไปป์ไลน์ FST หรือโมเดลที่ผ่านการ fine-tune — champollion จะให้คุณแพ็กเกจวิธีการนั้นเป็นปลั๊กอินและนำไปใช้งานร่วมกับส่วนอื่นๆ ได้เลย

> ถือกำเนิดขึ้นจากการแปลเว็บไซต์ระดับโปรดักชันเป็นภาษา Plains Cree ซึ่งไม่มี API สำเร็จรูปให้ใช้งาน สถาปัตยกรรมแบบแยกตามคู่ภาษา (per-pair architecture) ไม่ใช่แค่ทฤษฎี — แต่มันเกิดขึ้นเพราะมีโปรเจกต์หนึ่งที่ต้องการใช้ Google Translate สำหรับภาษาฝรั่งเศส และไปป์ไลน์ FST ที่ผ่านการสอนสำหรับภาษาพื้นเมือง โดยรันควบคู่กันไปในคำสั่งซิงก์เดียวกัน

เครื่องมือเสริม [MT Eval Harness](https://github.com/gamedaysuits/Champollion) ช่วยให้คุณวัดเกณฑ์มาตรฐานและเปรียบเทียบแนวทางการแปล จากนั้นส่งออกวิธีการที่ใช้งานได้เป็นปลั๊กอินของ champollion ใครก็ตามที่พูดได้ทั้งสองภาษาสามารถพัฒนา ทดสอบ และแบ่งปันวิธีการแปลได้ — โดยไม่ต้องพึ่งพาแพลตฟอร์มที่มีลิขสิทธิ์เฉพาะ

### เลือกวิธีการของคุณ

Champollion รองรับวิธีการแปล 10 วิธี แต่ละคู่ภาษาสามารถใช้วิธีการที่แตกต่างกันได้

**ผู้ให้บริการ LLM** — ดีที่สุดในด้านคุณภาพ, รองรับ Markdown, เข้ากันได้กับการสอน (coaching):

| วิธีการ | คีย์ | สิ่งที่ทำ |
|--------|-----|-------------|
| `llm` (ค่าเริ่มต้น) | `OPENROUTER_API_KEY` | LLM ผ่าน OpenRouter — มากกว่า 200 โมเดล, การกำหนดเส้นทางอัตโนมัติ |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + กฎไวยากรณ์, พจนานุกรม, บันทึกรูปแบบ |
| `openai` | `OPENAI_API_KEY` | OpenAI API โดยตรง (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic API โดยตรง (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Google Gemini API โดยตรง (Flash, Pro) — มีระดับการใช้งานฟรี |
| `local` | *(ไม่มี)* | โมเดลของคุณเองที่อยู่เบื้องหลังเอนด์พอยต์ที่เข้ากันได้กับ OpenAI (Ollama, vLLM, LM Studio, โมเดลที่ฝึกด้วย `nmt-forge`) กำหนดค่า `LOCAL_API_BASE` หากไม่ได้อยู่ที่ค่าเริ่มต้นของ Ollama ข้อความจะไม่มีวันออกจากโครงสร้างพื้นฐานของคุณ |

**การแปลด้วยเครื่องแบบดั้งเดิม (Traditional MT)** — ดีที่สุดในด้านความเร็ว, ต้นทุน และคู่คีย์-ค่าที่มีปริมาณมาก:

| วิธีการ | คีย์ | สิ่งที่ทำ |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130+ ภาษา) |
| `deepl` | `DEEPL_API_KEY` | DeepL API รองรับอภิธานศัพท์ (30+ ภาษา) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100+ ภาษา) |
| `libretranslate` | *(โฮสต์เอง)* | LibreTranslate แบบโฮสต์เอง (AGPL, ฟรี) |

**โครงสร้างพื้นฐาน (Infrastructure)** — สำหรับเอนด์พอยต์แบบกำหนดเองหรือที่โฮสต์โดยชุมชน:

| วิธีการ | คีย์ | สิ่งที่ทำ |
|--------|-----|-------------|
| `api` | *(ตามผู้ให้บริการ)* | Thin HTTP client สำหรับ REST endpoint ใดๆ |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **หมายเหตุ**: วิธีการแปลด้วยเครื่องแบบดั้งเดิม (Google Translate, DeepL, Microsoft Translator, LibreTranslate) จัดการคู่คีย์-ค่าได้ดี แต่ไม่สามารถแปลเนื้อหา Markdown ได้อย่างปลอดภัย สำหรับโปรเจกต์ที่มีเนื้อหาเยอะ ขอแนะนำให้ใช้วิธีการแบบ LLM — เนื่องจากจะปกป้องบล็อกโค้ด, shortcodes และตัวแปร interpolation อย่างชัดเจน

## ปลั๊กอิน

ปลั๊กอินคือสูตรการแปลที่แพ็กเกจไว้ล่วงหน้าสำหรับคู่ภาษาเฉพาะ ปลั๊กอินเหล่านี้คือ JSON manifests — ไม่ใช่โค้ด — ซึ่งจะบอก champollion ว่าควรใช้วิธีการใด ด้วยการตั้งค่าแบบใด และผ่านการวัดเกณฑ์มาตรฐานคุณภาพระดับใดมาแล้ว

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

ดู [เอกสารอ้างอิง](https://champollion.dev/docs/reference/plugin-spec) สำหรับรูปแบบของ manifest

## คำสั่ง

| คำสั่ง | วัตถุประสงค์ |
|---------|---------|
| `init` | วิซาร์ดการตั้งค่าแบบโต้ตอบ (หรือ `--yes` สำหรับค่าเริ่มต้นแบบรวดเร็ว) |
| `sync` | แปลและซิงก์ไฟล์ locale ทั้งหมด |
| `serve` | ให้บริการสแต็กการแปลของโปรเจกต์นี้ผ่าน HTTP (สัญญา api-method) |
| `watch` | ซิงก์อัตโนมัติเมื่อมีการเปลี่ยนแปลงไฟล์ |
| `audit` | ตั้งค่าสถานะ locale ที่ไม่สมบูรณ์ (CI gate) |
| `lint` | ค้นหาข้อความที่ถูกฮาร์ดโค้ดในซอร์สโค้ด |
| `status` | แสดงการกำหนดค่าคู่ภาษา, วิธีการ, ระดับภาษา (registers) และเกณฑ์มาตรฐานของปลั๊กอิน |
| `provenance` | ตรวจสอบสัญญาอนุญาตของทรัพยากรการแปล |
| `wrap` | ห่อหุ้มข้อความที่ถูกฮาร์ดโค้ดอัตโนมัติด้วยการเรียก `t()` (พร้อมฟังก์ชันเลิกทำ) |
| `seo` | สร้าง hreflang, sitemap.xml หรือสคีมา JSON-LD |
| `integrity` | ตรวจสอบความเสียหายของตัวแทนที่ (placeholder), การเข้ารหัส และความสมบูรณ์ของพหูพจน์ ICU |
| `plugin` | ติดตั้ง, ลบ หรือแสดงรายการปลั๊กอินวิธีการ |
| `fonts` | ดาวน์โหลดเว็บฟอนต์สำหรับตัวแปลงระบบตัวเขียน PUA |
| `tm` | จัดการแคช Translation Memory (สถิติ, ล้าง, กำหนดค่าเริ่มต้น, ตัดแต่ง) |
| `xliff` | ส่งออก/นำเข้า XLIFF 1.2 สำหรับการตรวจสอบโดยนักแปลมืออาชีพ |
| `models` | แสดงรายการโมเดลที่มีให้ใช้งานสำหรับผู้ให้บริการ (`--method gemini`) |
| `verify` | อ่านไฟล์ locale ที่เขียนไปแล้วอีกครั้งและยืนยันว่ามีคำแปลอยู่และถูกต้อง (CI gate) |
| `doctor` | ตรวจสอบความสมบูรณ์ของระบบ: การ์ด, การกำหนดค่า, วิธีการ และตัวแปลง |

คำสั่งที่ทำงานกับดัชนีที่ใช้ร่วมกันและกระดานผู้นำ (leaderboard) แทนที่จะเป็น
โปรเจกต์ของคุณ จะถูกจัดกลุ่มอยู่ภายใต้ `champollion network` (แต่ละคำสั่งสามารถทำงานได้โดยไม่ต้องมี
คำนำหน้าเช่นกัน):

| คำสั่ง | วัตถุประสงค์ |
|---------|---------|
| `network card` | พิมพ์การ์ดภาษาให้อ่านง่าย (`network card <code>`, `--json` สำหรับข้อมูลดิบ) |
| `network recommend` | คำแนะนำวิธีการสำหรับคู่ภาษา — ความพร้อมใช้งาน + หลักฐานอ้างอิง (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | แสดงกระดานผู้นำ MT (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | ลงทะเบียนคลังข้อมูลการประเมิน: เลือกสัญญาอนุญาต + ระดับการเปิดเผย (local-only/private/public/sealed) |
| `network seal-corpus` | คำสั่งเข้ารหัสสำหรับระดับ sealed: `keygen` / `seal` / `open` (สะพานเชื่อม organizer-node) |
| `network submit` | เสนอรายการดัชนี (ต้องผ่านการตรวจสอบ) — พิมพ์ GitHub issue ที่กรอกข้อมูลไว้ล่วงหน้า |

รัน `champollion <command> --help` เพื่อดูความช่วยเหลือโดยละเอียดสำหรับคำสั่งใดๆ

ข้อมูลอ้างอิงฉบับเต็ม: [เอกสารอ้างอิง](https://champollion.dev/docs/reference/cli)

### Pre-commit gate

`champollion lint` ถูกสร้างขึ้นมาเพื่อเป็น commit gate: โดยจะออกด้วย `1` เมื่อพบข้อความที่แสดงต่อผู้ใช้ซึ่งถูกฮาร์ดโค้ดไว้ และออกด้วย `0` เมื่อไม่มีปัญหา (`--warn-only` จะรายงานผลโดยไม่บล็อก) เชื่อมต่อเข้ากับไดเรกทอรี hooks ที่ถูกติดตามในโปรเจกต์ของคุณ:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.5 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

หรือทริกเกอร์จาก [lint-staged](https://github.com/lint-staged/lint-staged) เพื่อให้รันเฉพาะเมื่อซอร์สไฟล์อยู่ในสถานะ staged:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

อย่าใส่ `champollion sync` ไว้ใน pre-commit — เนื่องจากมีการเรียก network API ซึ่งอย่างดีก็แค่ทำงานช้า และอย่างแย่คือบล็อกการคอมมิตเมื่อออฟไลน์ ให้รันใน CI หรือ pre-push hook แทน โดยใช้ `champollion audit` / `champollion verify` เป็น gate

## การตั้งค่า

สร้าง `champollion.config.json` หรือรัน `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| ตัวเลือก | ค่าเริ่มต้น | คำอธิบาย |
|--------|---------|-------------|
| `inputLocale` | `"en"` | รหัสภาษาต้นทาง |
| `localesDir` | `"./locales"` | พาธไปยังไฟล์ locale: หนึ่งไฟล์ต่อภาษา (`fr.json`) หรือหนึ่งโฟลเดอร์ต่อภาษา (`fr/common.json`, i18next) |
| `localesPattern` | `null` | โครงสร้างอื่นๆ เช่น `"src/i18n/{ns}/{lang}.json"` (แทนที่ `localesDir`) |
| `contentDir` | `null` | โฟลเดอร์ของ Markdown/MDX ที่จะแปล (`content/` ของ Hugo หรือโฟลเดอร์ใดๆ); คำแปลแต่ละรายการจะถูกเขียนไว้ข้างๆ ต้นฉบับเป็น `<name>.<locale>.md` |
| `format` | `"auto"` | รูปแบบไฟล์: `json`, `toml`, `yaml` หรือ `auto` |
| `model` | `"google/gemini-3.8-flash"` | โมเดลเริ่มต้น (slug ของ OpenRouter) ผู้ให้บริการโดยตรงจะแก้ไขค่าเริ่มต้นของตนเองขณะรันไทม์ รัน `champollion models --method gemini` เพื่อค้นหาโมเดลที่มีให้ใช้งาน |
| `defaultMethod` | `"llm"` | วิธีการแปลเริ่มต้น (ถูกแทนที่ด้วยแฟล็ก `--method`) |
| `batchSize` | `80` | จำนวนคีย์ต่อกลุ่มการแปล |
| `pairs` | `{}` | การแทนที่วิธีการ, โมเดล และคุณภาพต่อคู่ภาษา |

**การแทนที่ต่อภาษา**: แต่ละภาษาจะมี [Language Card](https://champollion.dev/docs/reference/language-card-spec) — หนึ่งในการ์ดที่คัดสรรมาแล้ว 50 ใบ ซึ่งประกอบด้วยค่าที่ตั้งไว้ล่วงหน้าของระดับภาษา (register presets), ระบบความเป็นทางการ, กฎการจัดรูปแบบตัวพิมพ์ และแฟล็กการรองรับวิธีการ การ์ดใช้ [สถาปัตยกรรมแบบสองระดับ](https://champollion.dev/docs/concepts/architecture) (รันไทม์ + อ้างอิง) เพื่อประสิทธิภาพในการขยายขนาด สร้างโครงสร้างการ์ดใหม่ด้วย `node scripts/generate-language-card.mjs <code>` ใช้คีย์ที่ตั้งไว้ล่วงหน้าเป็นตัวย่อ หรือเขียนข้อความระดับภาษาแบบกำหนดเอง:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**โหมดไม่ต้องตั้งค่า (Zero-config mode)**: ไม่มีไฟล์คอนฟิกใช่ไหม? Champollion จะตรวจหาไฟล์ locale, รูปแบบ และภาษาปลายทางจากโปรเจกต์ของคุณโดยอัตโนมัติ

ค่าของภาษาสามารถเป็นคีย์พรีเซ็ต (เช่น `"casual-tu"`), ข้อความระดับภาษาแบบกำหนดเอง หรือออบเจกต์ (ควบคุมได้ทั้งหมด) การแทนที่ระดับคู่ภาษาใน `pairs` จะมีความสำคัญเหนือกว่าการตั้งค่าระดับภาษา รัน `npx champollion init` เพื่อเรียกดูพรีเซ็ตที่มีให้ใช้งานสำหรับแต่ละภาษา

ดู [ข้อมูลอ้างอิง CLI](https://champollion.dev/docs/reference/cli) สำหรับรายละเอียดการตั้งค่าเฉพาะของแต่ละเฟรมเวิร์ก

## ผลลัพธ์ CLI

เมื่อคุณรัน `sync` champollion จะแสดงให้เห็นอย่างชัดเจนว่าเกิดอะไรขึ้นบ้าง:

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

บรรทัดสุดท้ายของการประมาณการจะระบุอัตราที่ใช้ประเมินราคาแต่ละตัวเลข ว่ามาจากไหนและเมื่อใด (`--json` จะมีรายละเอียด) คำว่า "Translating …" จะแสดงขึ้นก็ต่อเมื่อมีบางสิ่งถูกส่งไปเท่านั้น: การทดสอบรัน (dry run) หรือการรันที่ไม่มีอะไรให้ส่ง จะแสดงว่ากำลังตรวจสอบ locales แทน แถบความคืบหน้าจะอัปเดตในตำแหน่งเดิมเมื่อแต่ละกลุ่มเสร็จสมบูรณ์ (~80 คีย์ต่อการอัปเดต) เมื่อมีการตั้งค่า `contentDir` การซิงก์จะระบุชื่อโฟลเดอร์และตำแหน่งที่คำแปลจะไป; มันจะแสดง `Detected framework: Hugo` ก็ต่อเมื่อพบไซต์ Hugo ของจริง (`hugo.toml`, `config.toml` ที่มีการตั้งค่า Hugo, `archetypes/`, …) การตรวจจับรูปแบบจะแยกแยะ `(auto)` ออกจาก `(config)` เพื่อชี้แจงว่ารูปแบบนั้นถูกแก้ไขอย่างไร

**โหมดผลลัพธ์ (Output modes)**: `--quiet` จะระงับการแสดงผลข้อมูล (แสดงเฉพาะข้อผิดพลาดและคำเตือน) `--json` จะส่งออก NDJSON ที่เครื่องอ่านได้สำหรับไปป์ไลน์ CI/CD

## การเสริมความปลอดภัยและความเสถียร (Hardening)

- **Exponential backoff** — ลองใหม่ 3 ครั้งพร้อม jitter เมื่อพบข้อผิดพลาด 429/5xx
- **หมดเวลาคำขอ 30 วินาที (30s request timeout)** — AbortController ป้องกันการค้าง
- **ตรวจสอบการตอบกลับ (Response validation)** — ยอมรับเฉพาะคีย์ที่ถูกส่งไปแปลเท่านั้น
- **ตรวจสอบคุณภาพ (Quality gate)** — ตรวจจับการวนลูปของอาการหลอน, ผลลัพธ์ผิดสคริปต์ภาษา, ความยาวที่เพิ่มขึ้นผิดปกติ และการส่งคืนข้อความต้นทาง
- **การลองใหม่แบบลดหลั่น (Retry cascade)** — เมื่อแยกวิเคราะห์ JSON ล้มเหลว จะลองใหม่ทั้งกลุ่ม → ครึ่งกลุ่ม → ทีละคีย์ (จำกัดงบประมาณผ่าน `maxRetries`)
- **Translation Memory** — `.champollion/tm.json` แคชคำแปลโดยใช้ข้อความต้นทาง + locale + วิธีการ เป็นคีย์; คีย์ที่ไม่เปลี่ยนแปลงจะถูกดึงจากแคชในการซิงก์ครั้งถัดไป ช่วยลดการเรียก API ที่ซ้ำซ้อน
- **แคชพรอมต์ (Prompt caching)** — การแยกข้อความระบบ/ผู้ใช้ช่วยให้สามารถแคชในระดับผู้ให้บริการได้ ลดต้นทุนโทเค็นในหลายๆ กลุ่ม
- **บังคับใช้คำศัพท์ (Terminology enforcement)** — คำแปลที่ผ่านการสอนจะถูกตรวจสอบกับคำศัพท์ในพจนานุกรมหลังจากที่ LLM ตอบกลับ
- **ป้องกัน Prototype pollution** — บล็อก `__proto__`, `constructor`, `prototype`
- **จำกัดขอบเขตพาธ (Path containment)** — ตรวจสอบการเขียนไฟล์ให้อยู่ภายในไดเรกทอรีที่กำหนดค่าไว้เท่านั้น
- **ปกป้องบล็อก (Block protection)** — บล็อกโค้ด, shortcodes, HTML จะถูกปกป้องระหว่างการแปลเนื้อหา
- **สถาปัตยกรรมแจ้งเตือนชัดเจน (Fail-loud architecture)** — การแปลที่ล้มเหลวจะ throw ข้อความแสดงข้อผิดพลาดที่นำไปแก้ไขต่อได้เสมอ จะไม่มีการเขียนข้อมูลขยะลงไปเงียบๆ
- **ตรวจสอบหลังการซิงก์ (Post-sync verification)** — คำสั่ง `verify` จะอ่านไฟล์ที่เขียนไปแล้วอีกครั้งและยืนยันว่ามีคำแปลอยู่ สคริปต์ถูกต้อง และ placeholder ไม่เสียหาย
- **สำเร็จบางส่วน (Partial success)** — กลุ่มที่ล้มเหลวหนึ่งกลุ่มจะไม่บล็อกกลุ่มที่เหลือ

## การทดสอบ

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**พึ่งพาแพ็กเกจอื่นน้อยที่สุด (Minimal dependencies)** — ดูด้านบน

## ใบอนุญาต

PolyForm Noncommercial 1.0.0. Champollion CLI เปิดเผยซอร์สโค้ด (source-available) — ติดตั้ง ใช้งาน และดัดแปลงได้ฟรีสำหรับวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ (งานวิจัย การศึกษา งานชุมชน) ภายใต้ [PolyForm Noncommercial License 1.0.0](../LICENSE); การใช้งานเพื่อวัตถุประสงค์เชิงพาณิชย์จะไม่ครอบคลุมอยู่ในสัญญาอนุญาตนี้ พูดง่ายๆ พร้อมตัวอย่าง — โรงเรียน โรงพยาบาลหรือคลินิกของรัฐ องค์กรการกุศล โปรเจกต์ส่วนตัวหรืองานวิจัย จะได้รับความคุ้มครอง; แต่ผลิตภัณฑ์ของธุรกิจที่แสวงหาผลกำไร เช่น หน้าร้านของร้านค้า จะไม่ได้รับความคุ้มครอง: [ใครสามารถใช้งานได้บ้าง](https://champollion.dev/docs/getting-started/who-may-use-this) (เป็นเพียงบทสรุป ไม่ใช่คำแนะนำทางกฎหมาย; ให้ยึดตามข้อความในสัญญาอนุญาตเป็นหลัก) แพ็กเกจ npm `champollion` ที่เผยแพร่คือ PolyForm-Noncommercial-1.0.0; `cli/LICENSE` คือสัญญาอนุญาตที่เชื่อถือได้สำหรับแพ็กเกจที่แจกจ่าย ส่วน MT Eval Harness และข้อกำหนด (specs) ที่มาคู่กันนั้นเป็นโอเพนซอร์ส ภายใต้สัญญาอนุญาต AGPL-3.0-or-later — โดยมีข้อยกเว้น §7 eval-standard-plugin — ที่ [harness repository](https://github.com/gamedaysuits/Champollion) สาธารณะ
