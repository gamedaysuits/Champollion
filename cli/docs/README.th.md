# Champollion

[![เวอร์ชัน npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![สัญญาอนุญาต: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


**ทำงานอย่างเป็นระบบ พร้อมระบบป้องกัน** การพัฒนาและการปรับใช้การแปลภาษาด้วยเครื่อง (Machine translation) อย่างเป็นระบบ สร้างขึ้นโดยคำนึงถึงชุมชนภาษาที่มีทรัพยากรน้อยและภาษาพื้นเมือง CLI นี้คือเลเยอร์สำหรับโปรเจกต์และการปรับใช้

**สร้างโมเดลสำหรับภาษา** บนคอมพิวเตอร์ของคุณเอง:

```bash
npx champollion new our-language --from English --to "Plains Cree"
cd our-language && npx champollion next
```

ภาษาที่ไม่มีรหัสมาตรฐานจะใช้รหัสสำหรับการใช้งานส่วนตัวและชื่อของภาษาเอง:
`npx champollion new our-language --from English --to qaa --target-name "Our language"`
(รหัสใดก็ได้ตั้งแต่ `qaa` ถึง `qtz`)

`champollion new` จะเริ่มต้นโปรเจกต์โดยจัดเตรียมพื้นที่สำหรับทุกสิ่ง `champollion next` จะบอกขั้นตอนถัดไป — จากไฟล์ที่ชุมชนเก็บรักษาไว้ (สเปรดชีต, ตาราง Word, พจนานุกรม Toolbox หรือ LIFT, ไฟล์ถอดเสียง ELAN) ไปจนถึงโมเดลที่ผ่านการวัดผลและนำเข้าสู่แอปของคุณ แต่ละขั้นตอนจะระบุว่าใครเป็นผู้ตัดสินใจ: ผู้ที่เป็นเจ้าของภาษาจะเป็นผู้ตัดสินใจว่าประโยคของพวกเขาจะถูกนำไปใช้ที่ใดและสิ่งใดที่จะถูกนำไปใช้งานจริง AI agent สามารถดำเนินการตามขั้นตอนเดียวกันนี้ผ่าน [MCP server](https://www.npmjs.com/package/champollion-mcp-server) ระบบนี้รับประกันในเรื่องของกระบวนการ ไม่ใช่คุณภาพ: คุณจะรู้ว่าโมเดลนั้นดีแค่ไหน ไม่ใช่รับประกันว่ามันดี — โมเดลชุมชนขนาดเล็กในตอนเริ่มต้นมักจะเป็นเพียงหนังสือวลีที่ผ่านการวัดผลแล้ว เริ่มต้นได้ที่ [champollion.dev/start](https://champollion.dev/start)

**แปลไฟล์ locale ของแอปคุณ** ด้วยคำสั่งเดียว:

```bash
npx champollion sync
```

Champollion จะตรวจหาไฟล์ locale, รูปแบบของไฟล์ และภาษาเป้าหมายของคุณโดยอัตโนมัติ มันจะแปลคีย์ที่หายไป, ข้ามสิ่งที่ทำเสร็จแล้ว และเขียนผลลัพธ์ — จากเอนจินที่โฮสต์ไว้ หรือจากโมเดลที่คุณสร้างและให้บริการด้วยตัวเอง (`champollion connect`)

**สัญญาอนุญาต:** เปิดเผยซอร์สโค้ด (source-available) ภายใต้ [PolyForm Noncommercial License 1.0.0](../LICENSE) — ใช้งาน เปลี่ยนแปลง และแชร์ได้ฟรีสำหรับวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ (โปรเจกต์ส่วนตัว, งานวิจัย, การสอน, และการใช้งานโดยองค์กรการกุศล, โรงเรียน และหน่วยงานของรัฐ) การใช้งานเพื่อวัตถุประสงค์เชิงพาณิชย์จะไม่ครอบคลุมอยู่ในสัญญาอนุญาตนี้ Evaluation harness เป็นโอเพนซอร์ส (AGPL-3.0-or-later) [ใครสามารถใช้งานได้บ้าง](https://champollion.dev/docs/getting-started/who-may-use-this) · [รายละเอียด](#license)

## ทำไมไม่เขียนสคริปต์เองล่ะ?

คุณอาจจะเขียนสคริปต์ง่ายๆ ที่วนลูปอ่านคีย์ภาษาอังกฤษของคุณแล้วเรียกใช้ Google Translate นักพัฒนาส่วนใหญ่ก็ทำเช่นนั้น — ใช้โค้ดประมาณ 30 บรรทัด และนี่คือเหตุผลว่าทำไมมันถึงพัง:

- **ไม่มีการตรวจจับการเปลี่ยนแปลง** เมื่อคุณอัปเดตข้อความภาษาอังกฤษ คำแปลจะยังคงเป็นของเก่าตลอดไป Champollion ติดตามค่าต้นทางทุกค่าด้วยแฮช SHA-256 และแปลใหม่เฉพาะส่วนที่เปลี่ยนแปลงเท่านั้น
- **ไม่มีการจัดกลุ่ม (Batching)** การเรียก API หนึ่งครั้งต่อหนึ่งคีย์หมายความว่า 200 คีย์ = การรับส่งข้อมูล 200 รอบ Champollion จัดกลุ่มอย่างชาญฉลาด (กำหนดค่าได้ ค่าเริ่มต้นคือ 80 คีย์/กลุ่มสำหรับ LLM, 128 สำหรับ Google)
- **ไม่มีการตรวจสอบคุณภาพ** การแปลภาษาด้วยเครื่องอาจเกิดอาการหลอน (hallucinate), ส่งคืนข้อความต้นทาง, หรือแสดงผลลัพธ์เป็นตัวอักษรที่ผิด Champollion ตรวจสอบทุกคำแปลก่อนที่จะเขียนลงไป — ผลลัพธ์ที่ว่างเปล่า, การส่งคืนข้อความต้นทาง, การวนซ้ำ, ความยาวที่เพิ่มขึ้นผิดปกติ, เนื้อหาที่ถูกลบ และตัวอักษรที่ผิด จะถูกตรวจจับและปฏิเสธ ระบบตรวจสอบนี้จะจับผลลัพธ์ที่พัง ไม่ใช่ความหมายที่ผิด
- **ไม่รู้จักรูปแบบไฟล์** ฮาร์ดโค้ดไว้สำหรับ JSON ใช่ไหม? Champollion รองรับ JSON, TOML, YAML และ Hugo Markdown (frontmatter + body) พร้อมการตรวจจับอัตโนมัติ
- **ไม่มีความปลอดภัย** Champollion ป้องกัน prototype pollution, path traversal ผ่านรหัส locale ที่ถูกสร้างขึ้นมาเพื่อโจมตี, และการพังของบล็อกโค้ดระหว่างการแปล Markdown

Champollion คือเวอร์ชันระดับโปรดักชันของสคริปต์นั้น

> [!NOTE]
> **สิ่งที่ Champollion แปล** Champollion มุ่งเน้นไปที่ **ไฟล์ locale และเนื้อหาที่มีโครงสร้าง** — คู่คีย์-ค่าของ JSON, การกำหนดค่า TOML/YAML, หน้า Hugo Markdown, เอกสารแลกเปลี่ยน XLIFF มันถูกปรับแต่งมาสำหรับข้อความเขียนที่เป็นทางการ: ข้อความ UI, เอกสารประกอบ, การสื่อสารอย่างเป็นทางการ, สื่อการเรียนการสอน มันไม่ใช่แชทบอท, เครื่องมือแปลเสียงแบบเรียลไทม์, หรือ AI สนทนาอเนกประสงค์ สำหรับแต่ละคู่ภาษา วิธีการแปลสามารถกำหนดค่าได้ — ตั้งแต่ API เชิงพาณิชย์ (Google Translate, DeepL) ไปจนถึงปลั๊กอินที่พัฒนาโดยชุมชน, เกณฑ์มาตรฐานสาธารณะ, และโมเดลที่คุณฝึกสอนและให้บริการอย่างเป็นระบบ

## เริ่มต้นใช้งานอย่างรวดเร็ว

```bash
npm install --save-dev champollion
```

### รับ API Key

Champollion ต้องการแบ็กเอนด์สำหรับการแปล เลือกมาหนึ่งอย่าง:

| ผู้ให้บริการ | คีย์ | เหมาะที่สุดสำหรับ |
|----------|-----|----------|
| **OpenRouter** (แนะนำ) | `OPENROUTER_API_KEY` | โปรเจกต์ที่มีเนื้อหาเยอะ, Markdown, โมเดลมากกว่า 200+ รายการ |
| **OpenAI** | `OPENAI_API_KEY` | การเข้าถึง GPT-4o โดยตรง |
| **Anthropic** | `ANTHROPIC_API_KEY` | การเข้าถึง Claude โดยตรง |
| **Gemini** | `GEMINI_API_KEY` | มีระดับการใช้งานฟรี |
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

> **หมายเหตุ**: หากตั้งค่าเฉพาะ `GOOGLE_TRANSLATE_API_KEY` champollion จะสลับไปใช้ Google Translate โดยอัตโนมัติ ไม่จำเป็นต้องเปลี่ยนการกำหนดค่า ใช้ REST API โดยตรง — ไม่มี SDK, ไม่มี service account, ไม่มี `pip install` ใช้แค่คีย์เท่านั้น

เพียงเท่านี้ก็เรียบร้อย สำหรับการควบคุมที่มากขึ้น ให้สร้างไฟล์การกำหนดค่า:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

แต่ละภาษาจะมาพร้อมกับ **พรีเซ็ตระดับภาษา (register presets)** — คำสั่งกำหนดน้ำเสียง/ความเป็นทางการที่สร้างไว้ล่วงหน้าซึ่งปรับให้เข้ากับระบบภาษาของมัน (vouvoiement สำหรับภาษาฝรั่งเศส, Siezen สำหรับภาษาเยอรมัน, です/ます สำหรับภาษาญี่ปุ่น, 해요체 สำหรับภาษาเกาหลี) วิซาร์ดการเริ่มต้นจะให้คุณเรียกดูและเลือกพรีเซ็ต หรือส่ง `--yes` เพื่อยอมรับค่าเริ่มต้น

### ภาษาต้นทางที่ไม่ใช่ภาษาอังกฤษ

หากภาษาต้นทางของคุณไม่ใช่ภาษาอังกฤษ:

```bash
champollion sync --source fr                      # CLI flag
```

หรือตั้งค่าอย่างถาวรในการกำหนดค่าของคุณ:

```json
{ "inputLocale": "fr" }
```

## สิ่งที่เครื่องมือนี้ทำ

คุณจัดการเฟรมเวิร์ก i18n (next-intl, i18next, Hugo) ส่วน Champollion จะจัดการไฟล์คำแปล

- **รองรับหลายรูปแบบ** — JSON, TOML, YAML, Hugo Markdown (front matter + body) และ XLIFF 1.2
- **แปลเฉพาะส่วนที่เพิ่ม (Incremental)** — แปลเฉพาะสิ่งที่เปลี่ยนแปลงเท่านั้น (การติดตามด้วยแฮช SHA-256)
- **แคช (Cached)** — Translation Memory จะจัดเก็บผลลัพธ์ก่อนหน้า; การรันซิงก์ซ้ำจะไม่เสียค่าใช้จ่ายสำหรับคีย์ที่ไม่เปลี่ยนแปลง
- **ตรวจสอบคุณภาพ (Quality-gated)** — ตรวจสอบทุกคำแปลเพื่อหาผลลัพธ์ที่พัง: การวนซ้ำ, ตัวอักษรที่ผิด, การส่งคืนข้อความต้นทาง, ความยาวที่เพิ่มขึ้นผิดปกติ และเนื้อหาที่ถูกลบ (ไม่ได้ตรวจสอบความหมาย)
- **รับรู้เนื้อหา (Content-aware)** — วิธีการแบบ LLM จะปกป้องบล็อกโค้ด, shortcodes, ลิงก์ และตัวแปรแทรก (interpolation variables) ระหว่างการแปล Markdown
- **เครื่องมือไปป์ไลน์** — `lint`, `audit`, `integrity`, `seo` สำหรับ CI gates
- **การทำงานร่วมกับ XLIFF** — ส่งออกคำแปลเพื่อให้นักแปลมืออาชีพตรวจสอบในเครื่องมือ CAT (memoQ, SDL Trados, Phrase) และนำเข้ากลับมา
- **พึ่งพาแพ็กเกจน้อยที่สุด (Minimal dependencies)** — มี runtime dependencies เพียงสองตัว: `@translated/lara` (Lara provider SDK) และ `cree-sro-syllabics` (ตัวแปลง Plains Cree SRO ⇄ syllabics ของ ALTLab/NRC) ต้องการ Node 20+

## เหนือกว่า Google Translate

การเริ่มต้นอย่างรวดเร็วช่วยให้คุณใช้งาน LLM หรือ Google Translate ได้ แต่ Google Translate รองรับประมาณ 130 ภาษา ในขณะที่มีภาษามากกว่า 7,000 ภาษาบนโลก

**แนวคิดหลักของ Champollion: วิธีการแปลสามารถกำหนดค่าได้ตามคู่ภาษา** ใช้ Google Translate สำหรับภาษาฝรั่งเศส, ใช้ LLM ที่ได้รับการฝึกสอนด้วยบันทึกไวยากรณ์และพจนานุกรมของคุณเองสำหรับภาษา Plains Cree, และใช้ API ที่คุณโฮสต์เองสำหรับภาษาที่ไม่มีบริการใดรองรับ — ทั้งหมดนี้อยู่ในโปรเจกต์เดียวกัน และใช้ CLI เดียวกันทั้งหมด

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

หากคุณสามารถหาวิธีแปลคู่ภาษาได้ — ผ่าน prompt engineering, พจนานุกรมชุมชน, ไปป์ไลน์ FST, หรือโมเดลที่ fine-tune แล้ว — champollion จะให้คุณแพ็กเกจวิธีการนั้นเป็นปลั๊กอินและปรับใช้ควบคู่ไปกับสิ่งอื่นๆ ทั้งหมดได้

> ถือกำเนิดขึ้นจากการแปลเว็บไซต์ระดับโปรดักชันเป็นภาษา Plains Cree ซึ่งไม่มี API สำเร็จรูปให้ใช้งาน สถาปัตยกรรมแบบแยกตามคู่ภาษาไม่ใช่แค่ทฤษฎี — มันเกิดขึ้นเพราะมีโปรเจกต์หนึ่งที่ต้องการใช้ Google Translate สำหรับภาษาฝรั่งเศส และไปป์ไลน์ FST ที่ได้รับการฝึกสอนสำหรับภาษาพื้นเมือง โดยทำงานเคียงคู่กันในคำสั่งซิงก์เดียวกัน

เครื่องมือเสริม [MT Eval Harness](https://github.com/gamedaysuits/Champollion) ช่วยให้คุณสามารถวัดผลและเปรียบเทียบแนวทางการแปล จากนั้นส่งออกวิธีการที่ใช้งานได้เป็นปลั๊กอินของ champollion ใครก็ตามที่พูดได้ทั้งสองภาษาสามารถพัฒนา, ทดสอบ, และแชร์วิธีการแปลได้ — โดยไม่ต้องใช้แพลตฟอร์มที่มีกรรมสิทธิ์

### เลือกวิธีการของคุณ

Champollion รองรับวิธีการแปล 10 วิธี แต่ละคู่ภาษาสามารถใช้วิธีการที่แตกต่างกันได้

**ผู้ให้บริการ LLM** — ดีที่สุดสำหรับคุณภาพ, รองรับ Markdown, เข้ากันได้กับการฝึกสอน (coaching):

| วิธีการ | คีย์ | สิ่งที่ทำ |
|--------|-----|-------------|
| `llm` (ค่าเริ่มต้น) | `OPENROUTER_API_KEY` | LLM ผ่าน OpenRouter — 200+ โมเดล, การกำหนดเส้นทางอัตโนมัติ |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + กฎไวยากรณ์, พจนานุกรม, บันทึกรูปแบบ |
| `openai` | `OPENAI_API_KEY` | OpenAI API โดยตรง (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic API โดยตรง (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Google Gemini API โดยตรง (Flash, Pro) — มีระดับการใช้งานฟรี |
| `local` | *(ไม่มี)* | โมเดลของคุณเองที่อยู่เบื้องหลังปลายทางที่เข้ากันได้กับ OpenAI (Ollama, vLLM, LM Studio, โมเดลที่ฝึกสอนด้วย `nmt-forge`) ตั้งค่า `LOCAL_API_BASE` หากไม่ได้อยู่ที่ค่าเริ่มต้นของ Ollama ข้อความจะไม่ออกจากโครงสร้างพื้นฐานของคุณ |

**การแปลด้วยเครื่องแบบดั้งเดิม (Traditional MT)** — ดีที่สุดสำหรับความเร็ว, ต้นทุน, และคู่คีย์-ค่าที่มีปริมาณมาก:

| วิธีการ | คีย์ | สิ่งที่ทำ |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130+ ภาษา) |
| `deepl` | `DEEPL_API_KEY` | DeepL API พร้อมรองรับอภิธานศัพท์ (30+ ภาษา) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100+ ภาษา) |
| `libretranslate` | *(โฮสต์เอง)* | LibreTranslate ที่โฮสต์เอง (AGPL, ฟรี) |

**โครงสร้างพื้นฐาน** — สำหรับปลายทางที่กำหนดเองหรือโฮสต์โดยชุมชน:

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

> **หมายเหตุ**: วิธีการแปลด้วยเครื่องแบบดั้งเดิม (Google Translate, DeepL, Microsoft Translator, LibreTranslate) จัดการคู่คีย์-ค่าได้ดี แต่ไม่สามารถแปลเนื้อหา Markdown ได้อย่างปลอดภัย สำหรับโปรเจกต์ที่มีเนื้อหาเยอะ ขอแนะนำให้ใช้วิธีการแบบ LLM — เนื่องจากมันจะปกป้องบล็อกโค้ด, shortcodes, และตัวแปรแทรกอย่างชัดเจน

## ปลั๊กอิน

ปลั๊กอินคือสูตรการแปลที่แพ็กเกจไว้ล่วงหน้าสำหรับคู่ภาษาเฉพาะ พวกมันคือ JSON manifests — ไม่ใช่โค้ด — ที่บอก champollion ว่าจะใช้วิธีการใด, ด้วยการตั้งค่าใด, และคุณภาพที่ผ่านการวัดผลแล้วเป็นอย่างไร

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
| `init` | วิซาร์ดการตั้งค่าแบบโต้ตอบ (หรือ `--yes` สำหรับค่าเริ่มต้นอย่างรวดเร็ว) |
| `sync` | แปลและซิงก์ไฟล์ locale ทั้งหมด |
| `serve` | ให้บริการสแต็กการแปลของโปรเจกต์นี้ผ่าน HTTP (api-method contract) |
| `watch` | ซิงก์อัตโนมัติเมื่อไฟล์มีการเปลี่ยนแปลง |
| `audit` | ตั้งค่าสถานะ locale ที่ไม่สมบูรณ์ (CI gate) |
| `lint` | ค้นหาข้อความที่ถูกฮาร์ดโค้ดในซอร์สโค้ด |
| `status` | แสดงการกำหนดค่าคู่ภาษา, วิธีการ, ระดับภาษา, และเกณฑ์มาตรฐานของปลั๊กอิน |
| `provenance` | ตรวจสอบสัญญาอนุญาตของทรัพยากรการแปล |
| `wrap` | ห่อหุ้มข้อความที่ถูกฮาร์ดโค้ดอัตโนมัติในการเรียก `t()` (พร้อมการเลิกทำ) |
| `seo` | สร้าง hreflang, sitemap.xml, หรือ JSON-LD schema |
| `integrity` | ตรวจสอบการพังของ placeholder, การเข้ารหัส, และความสมบูรณ์ของพหูพจน์ ICU |
| `plugin` | ติดตั้ง, ลบ, หรือแสดงรายการปลั๊กอินวิธีการ |
| `fonts` | ดาวน์โหลดเว็บฟอนต์สำหรับตัวแปลงสคริปต์ PUA |
| `tm` | จัดการแคช Translation Memory (สถิติ, ล้าง, สร้าง, ตัดแต่ง) |
| `xliff` | ส่งออก/นำเข้า XLIFF 1.2 สำหรับการตรวจสอบโดยนักแปลมืออาชีพ |
| `models` | แสดงรายการโมเดลที่มีอยู่สำหรับผู้ให้บริการ (`--method gemini`) |
| `verify` | อ่านไฟล์ locale ที่เขียนไปแล้วอีกครั้งและยืนยันว่ามีคำแปลอยู่และถูกต้อง (CI gate) |
| `doctor` | ตรวจสอบความสมบูรณ์ของระบบ: การ์ด, การกำหนดค่า, วิธีการ, และตัวแปลง |

คำสั่งที่ทำงานกับดัชนีที่แชร์และกระดานผู้นำ แทนที่จะเป็นโปรเจกต์ของคุณ จะถูกจัดกลุ่มไว้ภายใต้ `champollion network` (แต่ละคำสั่งสามารถทำงานได้โดยไม่ต้องมีคำนำหน้า):

| คำสั่ง | วัตถุประสงค์ |
|---------|---------|
| `network card` | พิมพ์การ์ดภาษาให้อ่านง่าย (`network card <code>`, `--json` สำหรับข้อมูลดิบ) |
| `network recommend` | คำแนะนำวิธีการสำหรับคู่ภาษา — ความพร้อมใช้งาน + หลักฐานอ้างอิง (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | แสดงกระดานผู้นำ MT (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | ลงทะเบียนคลังข้อมูลการประเมิน: เลือกสัญญาอนุญาต + ระดับการเปิดเผย (local-only/private/public/sealed) |
| `network seal-corpus` | คำสั่งเข้ารหัสระดับ Sealed: `keygen` / `seal` / `open` (สะพานเชื่อม organizer-node) |
| `network submit` | เสนอรายการดัชนี (ต้องผ่านการตรวจสอบ) — พิมพ์ GitHub issue ที่กรอกข้อมูลไว้ล่วงหน้า |

รัน `champollion <command> --help` สำหรับความช่วยเหลือโดยละเอียดเกี่ยวกับคำสั่งใดๆ

ข้อมูลอ้างอิงฉบับเต็ม: [เอกสารอ้างอิง](https://champollion.dev/docs/reference/cli)

### Pre-commit gate

`champollion lint` ถูกสร้างขึ้นเพื่อเป็น commit gate: มันจะออกด้วย `1` เมื่อพบข้อความที่แสดงต่อผู้ใช้ซึ่งถูกฮาร์ดโค้ดไว้ และ `0` เมื่อไม่มีปัญหา (`--warn-only` จะรายงานโดยไม่บล็อก) เชื่อมต่อมันเข้ากับไดเรกทอรี hooks ที่ถูกติดตามในโปรเจกต์ของคุณ:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.6 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

หรือเรียกใช้งานจาก [lint-staged](https://github.com/lint-staged/lint-staged) เพื่อให้มันทำงานเฉพาะเมื่อไฟล์ซอร์สถูก stage ไว้:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

อย่าใส่ `champollion sync` ไว้ใน pre-commit — เนื่องจากมันมีการเรียก network API ซึ่งอย่างดีที่สุดคือทำให้ช้า และอย่างแย่ที่สุดคือบล็อกการคอมมิตเมื่อออฟไลน์ ให้รันใน CI หรือ pre-push hook แทน โดยใช้ `champollion audit` / `champollion verify` เป็น gate

## การกำหนดค่า

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
| `contentDir` | `null` | โฟลเดอร์ของ Markdown/MDX ที่จะแปล (Hugo `content/` หรือโฟลเดอร์ใดๆ); แต่ละคำแปลจะถูกเขียนไว้ข้างๆ ต้นทางเป็น `<name>.<locale>.md` |
| `format` | `"auto"` | รูปแบบไฟล์: `json`, `toml`, `yaml`, หรือ `auto` |
| `model` | `"google/gemini-3.8-flash"` | โมเดลเริ่มต้น (OpenRouter slug) ผู้ให้บริการโดยตรงจะแก้ไขค่าเริ่มต้นของตนเองเมื่อรันไทม์ รัน `champollion models --method gemini` เพื่อค้นหาโมเดลที่มีอยู่ |
| `defaultMethod` | `"llm"` | วิธีการแปลเริ่มต้น (ถูกแทนที่ด้วยแฟล็ก `--method`) |
| `batchSize` | `80` | จำนวนคีย์ต่อกลุ่มการแปล |
| `pairs` | `{}` | การแทนที่วิธีการ, โมเดล, และคุณภาพแบบแยกตามคู่ภาษา |

**การแทนที่แบบแยกตามภาษา**: แต่ละภาษาจะมี [Language Card](https://champollion.dev/docs/reference/language-card-spec) — หนึ่งในการ์ดที่คัดสรรมา 50 ใบ ซึ่งประกอบด้วยพรีเซ็ตระดับภาษา, ระบบความเป็นทางการ, กฎการจัดรูปแบบตัวอักษร, และแฟล็กการรองรับวิธีการ การ์ดใช้ [สถาปัตยกรรมแบบสองระดับ](https://champollion.dev/docs/agents/rails-model) (รันไทม์ + อ้างอิง) เพื่อประสิทธิภาพในการขยายขนาด สร้างโครงสร้างการ์ดใหม่ด้วย `node scripts/generate-language-card.mjs <code>` ใช้คีย์พรีเซ็ตเป็นตัวย่อ หรือเขียนข้อความระดับภาษาที่กำหนดเอง:

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

**โหมดไม่ต้องกำหนดค่า (Zero-config mode)**: ไม่มีไฟล์กำหนดค่าใช่ไหม? Champollion จะตรวจหาไฟล์ locale, รูปแบบ, และภาษาเป้าหมายจากโปรเจกต์ของคุณโดยอัตโนมัติ

ค่าของภาษาสามารถเป็นคีย์พรีเซ็ต (เช่น `"casual-tu"`), ข้อความระดับภาษาที่กำหนดเอง, หรือออบเจกต์ (ควบคุมได้ทั้งหมด) การแทนที่ระดับคู่ภาษาใน `pairs` จะมีความสำคัญเหนือกว่าการตั้งค่าระดับภาษา รัน `npx champollion init` เพื่อเรียกดูพรีเซ็ตที่มีอยู่สำหรับแต่ละภาษา

ดู [ข้อมูลอ้างอิง CLI](https://champollion.dev/docs/reference/cli) สำหรับรายละเอียดการตั้งค่าเฉพาะของแต่ละเฟรมเวิร์ก

## ผลลัพธ์ CLI

เมื่อคุณรัน `sync` champollion จะแสดงสิ่งที่เกิดขึ้นอย่างชัดเจน:

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

บรรทัดสุดท้ายของการประมาณการจะระบุอัตราที่แต่ละตัวเลขถูกประเมินราคา, แหล่งที่มา และเวลา (`--json` จะมีรายละเอียด) "Translating …" จะแสดงขึ้นก็ต่อเมื่อมีบางสิ่งถูกส่งไป: การรันแบบ dry run หรือการรันที่ไม่มีอะไรให้ส่ง จะบอกว่ากำลังตรวจสอบ locales แทน แถบความคืบหน้าจะอัปเดตในตำแหน่งเดิมเมื่อแต่ละกลุ่มเสร็จสมบูรณ์ (~80 คีย์ต่อการอัปเดต) เมื่อตั้งค่า `contentDir` การซิงก์จะระบุชื่อโฟลเดอร์และตำแหน่งที่คำแปลจะไป; มันจะบอกว่า `Detected framework: Hugo` ก็ต่อเมื่อพบไซต์ Hugo จริงๆ (`hugo.toml`, `config.toml` ที่มีการตั้งค่า Hugo, `archetypes/`, …) การตรวจจับรูปแบบจะแยกความแตกต่างระหว่าง `(auto)` กับ `(config)` เพื่อชี้แจงว่ารูปแบบนั้นถูกแก้ไขอย่างไร

**โหมดผลลัพธ์**: `--quiet` จะระงับผลลัพธ์ที่เป็นข้อมูล (แสดงเฉพาะข้อผิดพลาดและคำเตือน) `--json` จะส่งออก NDJSON ที่เครื่องอ่านได้สำหรับไปป์ไลน์ CI/CD

## การเสริมความปลอดภัย (Hardening)

- **Exponential backoff** — ลองใหม่ 3 ครั้งพร้อม jitter เมื่อพบข้อผิดพลาด 429/5xx
- **หมดเวลาคำขอ 30 วินาที** — AbortController ป้องกันการค้าง
- **การตรวจสอบการตอบกลับ** — ยอมรับเฉพาะคีย์ที่ถูกส่งไปแปลเท่านั้น
- **ตรวจสอบคุณภาพ (Quality gate)** — จับการวนซ้ำจากอาการหลอน, ผลลัพธ์ตัวอักษรที่ผิด, ความยาวที่เพิ่มขึ้นผิดปกติ, และการส่งคืนข้อความต้นทาง
- **การลองใหม่แบบลดหลั่น (Retry cascade)** — เมื่อการแยกวิเคราะห์ JSON ล้มเหลว จะลองใหม่แบบกลุ่ม → ครึ่งกลุ่ม → คีย์เดี่ยว (จำกัดงบประมาณผ่าน `maxRetries`)
- **Translation Memory** — `.champollion/tm.json` แคชคำแปลโดยใช้ข้อความต้นทาง + locale + วิธีการ เป็นคีย์; คีย์ที่ไม่เปลี่ยนแปลงจะถูกให้บริการจากแคชในการซิงก์ครั้งถัดไป ช่วยลดการเรียก API ที่ซ้ำซ้อน
- **การแคชพรอมต์ (Prompt caching)** — การแยกข้อความระบบ/ผู้ใช้ช่วยให้สามารถแคชในระดับผู้ให้บริการได้ ลดต้นทุนโทเค็นข้ามกลุ่ม
- **การบังคับใช้คำศัพท์** — คำแปลที่ได้รับการฝึกสอนจะถูกตรวจสอบกับคำศัพท์ในพจนานุกรมหลังจากที่ LLM ตอบกลับ
- **ป้องกัน Prototype pollution** — บล็อก `__proto__`, `constructor`, `prototype`
- **การจำกัดพาธ (Path containment)** — การเขียนไฟล์จะถูกตรวจสอบให้อยู่ภายในไดเรกทอรีที่กำหนดค่าไว้เท่านั้น
- **การปกป้องบล็อก (Block protection)** — บล็อกโค้ด, shortcodes, HTML จะถูกปกป้องระหว่างการแปลเนื้อหา
- **สถาปัตยกรรมแบบ Fail-loud** — ความล้มเหลวในการแปลจะส่งข้อผิดพลาดที่สามารถดำเนินการแก้ไขได้เสมอ จะไม่มีการเขียนข้อมูลขยะลงไปเงียบๆ
- **การตรวจสอบหลังการซิงก์** — คำสั่ง `verify` จะอ่านไฟล์ที่เขียนไปแล้วอีกครั้งและยืนยันว่ามีคำแปลอยู่, ตัวอักษรถูกต้อง, และ placeholder ไม่เสียหาย
- **ความสำเร็จบางส่วน (Partial success)** — กลุ่มที่ล้มเหลวหนึ่งกลุ่มจะไม่บล็อกกลุ่มที่เหลือ

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

**พึ่งพาแพ็กเกจน้อยที่สุด (Minimal dependencies)** — ดูด้านบน

## สัญญาอนุญาต

PolyForm Noncommercial 1.0.0. Champollion CLI เปิดเผยซอร์สโค้ด (source-available) — ติดตั้ง ใช้งาน และแก้ไขได้ฟรีสำหรับวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ (งานวิจัย, การศึกษา, งานชุมชน) ภายใต้ [PolyForm Noncommercial License 1.0.0](../LICENSE); การใช้งานเพื่อวัตถุประสงค์เชิงพาณิชย์จะไม่ครอบคลุมอยู่ในสัญญาอนุญาตนี้ พูดง่ายๆ พร้อมตัวอย่าง — โรงเรียน, โรงพยาบาลหรือคลินิกของรัฐ, องค์กรการกุศล, โปรเจกต์ส่วนตัวหรืองานวิจัย จะครอบคลุมอยู่ในสัญญาอนุญาตนี้; แต่ผลิตภัณฑ์ของธุรกิจที่แสวงหาผลกำไร เช่น หน้าร้านของร้านค้า จะไม่ครอบคลุม: [ใครสามารถใช้งานได้บ้าง](https://champollion.dev/docs/getting-started/who-may-use-this) (เป็นเพียงบทสรุป ไม่ใช่คำแนะนำทางกฎหมาย; ให้ยึดตามข้อความในสัญญาอนุญาตเป็นหลัก) แพ็กเกจ npm `champollion` ที่เผยแพร่คือ PolyForm-Noncommercial-1.0.0; `cli/LICENSE` คือสัญญาอนุญาตที่เชื่อถือได้สำหรับแพ็กเกจที่แจกจ่าย เครื่องมือเสริม MT Eval Harness และข้อกำหนดต่างๆ เป็นโอเพนซอร์ส ภายใต้สัญญาอนุญาต AGPL-3.0-or-later — พร้อมข้อยกเว้น §7 eval-standard-plugin — ที่ [harness repository](https://github.com/gamedaysuits/Champollion) สาธารณะ
