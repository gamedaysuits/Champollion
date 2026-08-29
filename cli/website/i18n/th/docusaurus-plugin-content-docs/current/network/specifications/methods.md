---
sidebar_position: 4
title: "อินเทอร์เฟซเมธอด"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# อินเทอร์เฟซเมธอดร่วม

> **สรุปสำหรับผู้บริหาร** หน้านี้ระบุโปรโตคอล `TranslationMethod` ที่เมธอด Network ทุกตัวต้องนำไปใช้งาน, คลาสเมธอดหกประเภท (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), แกน **paradigm** ที่เป็นอิสระ (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …) ซึ่งทำให้ *วิธีที่เมธอดแปล* สามารถเปรียบเทียบข้ามระบบได้, รูปแบบปลั๊กอินเมธอด, และ **คลาสการพึ่งพา** (S/O/A1/A2/X) ที่กำหนดว่าเมธอดสามารถทำงานใน evaluation sandbox และมีสิทธิ์รับรางวัลหรือไม่ ทั้งสามนี้เป็นแกนที่เป็นอิสระจากกัน แนวทางใดก็ตามที่นำโปรโตคอลนี้ไปใช้งานสามารถทำการ benchmark ได้ และสิ่งที่เมธอดพึ่งพาจะเป็นตัวกำหนดว่าสามารถแข่งขันในส่วนใดได้บ้าง

eval harness และ champollion ใช้แนวคิด **translation method** ร่วมกัน เมธอดคือกระบวนการใดก็ตามที่รับข้อความต้นฉบับและสร้างข้อความที่แปลแล้ว ไม่ว่าจะเป็นการเรียก LLM โดยตรง, pipeline หลายขั้นตอน, API ของบุคคลที่สาม, หรือนักแปลมนุษย์

## สถาปัตยกรรม

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

โหลดผ่าน `--method path/to/dir` harness ไม่ค้นหาสิ่งใดโดยอัตโนมัติ

## สองระบบ หนึ่งอินเทอร์เฟซ

| | Eval Harness | champollion |
|---|---|---|
| **ภาษา** | Python | Node.js |
| **Entry point** | `translate.py` | `translate.js` |
| **อินเทอร์เฟซ** | โปรโตคอล `TranslationMethod` | config `methodPlugin` |
| **วัตถุประสงค์** | การประเมินแบบ batch พร้อมการให้คะแนน | การแปลภาษาแบบ live ใน dev/CI |
| **ผลลัพธ์** | Run card พร้อม metrics | ไฟล์ locale ที่แปลแล้ว |

เมธอดที่รองรับทั้งสองระบบจะมี entry point สองจุด — หนึ่งจุดสำหรับแต่ละ language runtime **method card** คือสะพานเชื่อม: มันอธิบายเมธอดในรูปแบบที่ทั้งสองระบบเข้าใจได้

## Method Card {#method-card}

method card อธิบาย *สิ่งที่* translation method คืออะไร โดยไม่เปิดเผยรายละเอียดที่เป็นกรรมสิทธิ์ เช่น system prompt ฉบับเต็ม โดยตอบคำถามต่อไปนี้:

- นี่คือเมธอดประเภทใด? (raw LLM, coached LLM, pipeline, API ฯลฯ)
- ใช้ **paradigm** ใด? (rule-based, statistical, neural-nmt, llm, hybrid)
- ใช้เครื่องมือใดบ้าง? (FST analyzer, dictionary ฯลฯ)
- การนำไปใช้งานเป็น open source หรือไม่?
- รองรับคู่ภาษาใดบ้าง?

ดู [Method Card Spec](/docs/network/specifications/methods#method-card) สำหรับ JSON schema ฉบับสมบูรณ์

### ตัวอย่าง

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

ฟิลด์ `dependency_class` สรุปสิ่งที่เมธอดต้องการเพื่อทำงานและถ่ายโอน — ดู [ความถูกต้องของเมธอดและคลาสการพึ่งพา](#method-validity-and-dependency-classes) ด้านล่าง ฟิลด์ `paradigm` วางเมธอดบน **แกน paradigm** (ที่นี่คือ `hybrid`: LLM ที่ถูกควบคุมโดย rule-based FST) — ดู [Paradigms](#paradigms) ด้านล่าง

### คลาสเมธอด

| คลาส | คำอธิบาย |
|-------|-------------|
| `raw-llm` | การเรียก LLM โดยตรงพร้อม instruction ขั้นต่ำ |
| `coached-llm` | LLM พร้อม prompt ที่มีโครงสร้าง, ตัวอย่าง, และข้อจำกัด |
| `pipeline` | Pipeline หลายขั้นตอนพร้อม deterministic components |
| `custom-plugin` | กระบวนการภายนอกที่นำโปรโตคอล `TranslationMethod` ไปใช้งาน |
| `api` | Translation API ของบุคคลที่สาม (Google Translate, DeepL ฯลฯ) |
| `human` | การแปลโดยมนุษย์ (สำหรับการสร้าง baseline) |

### Paradigms {#paradigms}

**paradigm** คือแกนที่สาม ซึ่งเป็นอิสระ: *วิธีที่เมธอดแปลในระดับ algorithm* มันเป็นอิสระจากทั้งคลาสเมธอดและคลาสการพึ่งพา คลาสเมธอดเพียงอย่างเดียวนั้นเน้น LLM เป็นศูนย์กลาง — ระบบ rule-based อย่าง [Apertium](https://www.apertium.org/) และ Google Translate ต่างก็อยู่ใน `pipeline`/`api` ดังนั้น "rule-based vs neural" จึงมองไม่เห็นหากไม่มีแกนนี้ แกน paradigm ทำให้การเปรียบเทียบนั้นเป็นสิ่งสำคัญอันดับแรกและสามารถกรองได้บน leaderboard

| Paradigm | คำอธิบาย | ตัวอย่าง |
|----------|-------------|----------|
| `rule-based` | Finite-state transducers, grammars ที่เขียนด้วยมือ, การถ่ายโอนทางสัณฐานวิทยา | Apertium, GiellaLT FST generation |
| `statistical` | MT แบบ phrase-based / statistical (SMT) ที่เรียนรู้จาก parallel corpora | classic Moses |
| `neural-nmt` | โมเดล MT แบบ neural encoder–decoder เฉพาะทาง | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | large language model เอนกประสงค์ที่ถูก prompt ให้แปล | การเรียก GPT / Claude / Gemini แบบ raw หรือ coached |
| `hybrid` | รวม paradigm สองอย่างขึ้นไปในเมธอดเดียว | LLM ที่ถูกควบคุมโดย rule-based FST (crk-translate); NMT + rule-based post-editing |
| `human` | การแปลโดยมนุษย์ (baseline ระดับ paradigm) | community translator baseline |
| `unknown` | ไม่ระบุ — card ไม่ได้ประกาศ paradigm | ค่าเริ่มต้นสำหรับ backward compatibility สำหรับ card ก่อนมี paradigm |

แกนทั้งสามเป็นอิสระจากกัน ตัวอย่างที่ใช้งานได้จริง:

| เมธอด | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (self-hosted, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-gated, LLM-coached) | `pipeline` | `hybrid` | A2 |
| Raw GPT call | `raw-llm` | `llm` | A1 |

paradigm เป็น **optional** บน method card; paradigm ที่ไม่ได้ระบุจะถูกบันทึกเป็น `unknown` (ไม่มีผลต่อการเผยแพร่ — แกนนี้เป็นแบบเพิ่มเติม) enum ด้านบนคือคำศัพท์ที่รองรับอย่างเป็นทางการ ซึ่งถูกบังคับใช้โดย harness (`config.VALID_PARADIGMS`) เนื่องจากการบังคับใช้อยู่ที่ฝั่ง app แทนที่จะเป็น database constraint จึงสามารถเพิ่ม paradigm ใหม่ได้ในภายหลังโดยไม่ต้องทำ migration; เฉพาะการเปลี่ยนชื่อหรือลบค่าที่เมธอดพึ่งพาอยู่แล้วเท่านั้นที่มีต้นทุนสูง

## ความถูกต้องของเมธอดและคลาสการพึ่งพา {#method-validity-and-dependency-classes}

เมธอดสามารถทำงานได้และถ่ายโอนได้เพียงเท่าที่ dependency ที่มีความพร้อมใช้งานน้อยที่สุดอนุญาต กลไก Network สองอย่างขึ้นอยู่กับการรู้ว่าเมธอดต้องการอะไรอย่างแน่ชัด:

1. **การประเมินแบบ Sandboxed** ([Benchmark Specification §8.2](/docs/network/specifications/benchmark)) — คะแนนมาตรฐานทองคำอย่างเป็นทางการมาจาก sandbox ที่มีนโยบายเครือข่ายแบบ **default-deny** เมธอดที่ต้องการบริการภายนอกโดยไม่ประกาศไว้ไม่สามารถสร้างคะแนนอย่างเป็นทางการได้
2. **การถ่ายโอนรางวัล** ([Prize Specification](/docs/network/specifications/prizes)) — เมธอดที่ชนะรางวัลจะถ่ายโอนไปยังองค์กรกำกับดูแลของชุมชนภาษา เมธอดที่รวมเนื้อหาที่ผู้ส่งไม่มีสิทธิ์รวมไว้ไม่สามารถถ่ายโอนได้โดยชอบด้วยกฎหมาย ผู้ส่งต้องถือ (หรือได้รับ) สิทธิ์ในทุกสิ่งที่อยู่ในแพ็กเกจ

เพื่อให้การตรวจสอบทั้งสองอย่างเป็นกระบวนการเชิงกลไกแทนที่จะเป็นแบบ ad hoc ทุกเมธอดจะประกาศ **คลาสการพึ่งพา** ซึ่งได้มาจาก **dependency manifest** ใน `method.json`

> **หมายเหตุเกี่ยวกับการตั้งชื่อ — สามแกนที่เป็นอิสระ** *คลาสเมธอด* (§ด้านบน: `raw-llm`, `pipeline`, …) อธิบาย *รูปร่าง* ของเมธอด — สัญญาอินเทอร์เฟซที่มันนำเสนอ *Paradigm* ([§Paradigms](#paradigms): `rule-based`, `neural-nmt`, `llm`, …) อธิบาย *วิธีที่มันแปลในเชิง algorithm* *คลาสการพึ่งพา* (ส่วนนี้) อธิบาย *สิ่งที่มันต้องการเพื่อทำงานและถ่ายโอน* ทั้งสามเป็นอิสระจากกัน: เมธอด `pipeline` สามารถเป็น `rule-based` หรือ `hybrid` และสามารถเป็นคลาสการพึ่งพาใดก็ได้ (คลาสและ paradigm แยกกันโดยเจตนา เพราะคลาสเพียงอย่างเดียวเน้น LLM เป็นศูนย์กลาง — มันไม่สามารถแยกแยะระบบ rule-based จาก neural ได้เมื่อทั้งคู่นำเสนอตัวเองเป็น `pipeline` หรือ `api`)

### คลาสการพึ่งพาทั้งห้า

| คลาส | ชื่อ | คำนิยาม | ทำงานใน Sandbox ได้? | มีสิทธิ์รับรางวัล? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Self-contained | โค้ด, ข้อมูล, โมเดล, และ weights ทั้งหมดอยู่ในไดเรกทอรีเมธอด ภายใต้ใบอนุญาตที่อนุญาตให้เผยแพร่ซ้ำและถ่ายโอนให้ชุมชนได้ | ✅ ใช่ ใช้ได้ทันที | ✅ ใช่ |
| **O** | Open external | พึ่งพา artifacts ที่โฮสต์ภายนอกภายใต้ใบอนุญาต open ที่อนุญาตให้เผยแพร่ซ้ำ (รวมถึงใบอนุญาต copyleft เช่น AGPL) — เช่น FST ที่ดาวน์โหลดตอนติดตั้ง | ✅ ใช่ — artifacts ถูก pin และ **mirror เข้าไปใน submission** | ✅ ใช่ พร้อมเงื่อนไขความเข้ากันได้ของใบอนุญาต: เงื่อนไข copyleft ถูกรักษาไว้ตลอดการถ่ายโอน และชุมชนได้รับสิทธิ์เดียวกับที่ใบอนุญาตมอบให้ทุกคน |
| **A1** | API-dependent, substitutable | ต้องการ LLM inference ขณะ runtime โดยที่โมเดลเป็น **configuration ที่แทนที่ได้** — โมเดลที่มีความสามารถเพียงพอใดก็ตามสามารถใส่แทนได้ คุณค่าของเมธอดอยู่ที่ prompts, coaching data, และโค้ด ไม่ใช่โมเดลของ provider ใดโดยเฉพาะ | ⚠️ เฉพาะผ่าน **LLM gateway** ที่ sandbox specification กำหนด (🔲 วางแผนไว้ — ดูด้านล่าง) | ⚠️ มีเงื่อนไข — ดูด้านล่าง |
| **A2** | API-dependent, non-substitutable | ต้องการการเรียก API ข้อมูลหรือบริการภายนอกขณะ runtime ที่ไม่สามารถ mirror หรือแทนที่ได้ — โดยทั่วไปเพราะเนื้อหาที่ให้บริการเป็นกรรมสิทธิ์หรือไม่มีใบอนุญาต (เช่น dictionary API ที่ dictionary พื้นฐานไม่มีใบอนุญาตสาธารณะ) | ❌ ไม่ — dependency ไม่สามารถอยู่ใน sandbox ได้หากไม่มีการอนุญาตจากเจ้าของสิทธิ์ | ❌ ไม่ได้จนกว่าเจ้าของสิทธิ์จะให้สิทธิ์การรวมใน sandbox **และ** การถ่ายโอน อนุญาตบน leaderboard แบบเปิด (development segment) พร้อมแฟล็ก **"external dependency"** ที่มองเห็นได้ |
| **X** | Closed | รวมเนื้อหาที่ผู้ส่งไม่มีสิทธิ์เผยแพร่ซ้ำ — datasets ที่ไม่มีใบอนุญาต, เนื้อหาที่ scrape มาจากแหล่งที่เป็นกรรมสิทธิ์, components ที่ใบอนุญาตไม่เข้ากัน | ❌ | ❌ ไม่ได้รับอนุญาตในทุก lane การรวมเนื้อหาโดยไม่มีสิทธิ์ถือเป็นการละเมิดใบอนุญาตโดยไม่คำนึงว่าเมธอดทำงานที่ใด |

**คลาสที่มีผล** คลาสการพึ่งพาของเมธอดคือคลาสที่ *จำกัดมากที่สุด* ในบรรดา dependencies ที่ประกาศทั้งหมด ตามลำดับ S < O < A1 < A2 < X dictionary ที่ไม่มีใบอนุญาตหนึ่งรายการทำให้ pipeline ที่ self-contained กลายเป็น Class A2 (ถ้าเข้าถึงขณะ runtime) หรือ Class X (ถ้ารวมไว้โดยไม่มีสิทธิ์)

### ความแตกต่าง A1/A2: Substitutability

เมธอดส่วนใหญ่เรียก LLM Network ไม่ได้แกล้งทำเป็นว่าไม่เป็นเช่นนั้น — แต่แยกแยะ API dependency สองประเภทที่แตกต่างกันมาก:

- **A1 (substitutable):** API ให้บริการ LLM inference แบบ commodity identifier ของโมเดลคือ configuration: เมธอดต้องทำงานได้ end-to-end กับ inference endpoint ที่เข้ากันได้ใดก็ตาม รวมถึงโมเดล open-weight ที่โฮสต์โดยชุมชน คุณภาพผลลัพธ์อาจแตกต่างกันตามโมเดล — นั่นคือความเสี่ยงของนักพัฒนา และคะแนนอย่างเป็นทางการผูกกับโมเดลที่ pin ไว้ที่ใช้ในการประเมิน เมธอดที่พึ่งพา **state ฝั่ง provider** (fine-tune ที่โฮสต์เฉพาะที่ provider, file stores ของ provider, assistants เฉพาะ provider) *ไม่สามารถแทนที่ได้*: state นั้นไม่สามารถสลับออกได้ ดังนั้น dependency จึงเป็น A2 เว้นแต่ weights หรือข้อมูลพื้นฐานจะรวมอยู่ใน submission
- **A2 (non-substitutable):** API ให้บริการสิ่งที่ไม่ซ้ำกัน — โดยทั่วไปคือข้อมูลที่เป็นกรรมสิทธิ์หรือไม่มีใบอนุญาต ไม่มี endpoint ทางเลือกใดที่สามารถให้บริการได้ และเนื้อหาไม่สามารถ mirror เข้า sandbox ได้หากไม่มีการอนุญาตจากเจ้าของสิทธิ์ เมธอดทำงานบน leaderboard แบบเปิด (พร้อมแฟล็ก) แต่ไม่สามารถสร้างคะแนน sandbox อย่างเป็นทางการหรือมีสิทธิ์รับรางวัลได้จนกว่าจะมีการอนุญาต

**สิ่งที่การถ่ายโอนรางวัล A1 ให้จริงๆ** ชุมชนไม่ได้รับโมเดล — ไม่มีใครสามารถถ่ายโอน weights ของ Anthropic, Google, หรือ OpenAI ได้ การถ่ายโอนครอบคลุม recipe ที่สมบูรณ์ *รอบๆ* โมเดล: prompts ทั้งหมด, coaching data, โค้ด pipeline, retry logic, configuration, และข้อกำหนดโมเดลที่บันทึกไว้ เนื่องจากโมเดลสามารถแทนที่ได้โดยการออกแบบ ชุมชนจึงสามารถชี้เมธอดที่ถ่ายโอนแล้วไปยัง provider ใดก็ได้ที่ต้องการ — หรือโมเดล open-weight บน hardware ของตัวเอง — โดยไม่ต้องมีส่วนร่วมของนักพัฒนา recipe เป็นสิ่งที่เป็นเจ้าของ; engine เป็นสิ่งที่เช่าและแทนที่ได้

### Dependency Manifest (`method.json`)

ทุกเมธอดประกาศ dependencies ใน manifest `method.json` แต่ละรายการบันทึกว่า artifact คืออะไร, มาจากไหน, ใบอนุญาตใดครอบคลุม, และเมธอดเข้าถึงอย่างไร:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| ฟิลด์ | จำเป็น | คำอธิบาย |
|-------|----------|-------------|
| `id` | ✅ | identifier ที่เสถียรสำหรับ dependency |
| `kind` | ✅ | `data`, `model`, `software`, หรือ `service` |
| `license` | ✅ | SPDX identifier, `proprietary`, หรือ `none` `none` หมายความว่าไม่มีใบอนุญาตสาธารณะ — ถือว่าสงวนสิทธิ์ทั้งหมด |
| `access` | ✅ | `bundled` (อยู่ในไดเรกทอรีเมธอด), `mirrored` (ดึงมาตอนติดตั้ง, pin ไว้, vendored เข้า submission), `gateway` (LLM inference ขณะ runtime ผ่าน evaluation gateway), `external-api` (การเรียกเครือข่ายขณะ runtime อื่นๆ) |
| `source` | ✅ | URL ที่เป็น canonical หรือ identifier `provider:slug` |
| `pin` | สำหรับ `mirrored` | version, commit, หรือ content hash ที่ pin artifact ที่แน่นอน |
| `substitutable` | สำหรับ `gateway`/`external-api` | ว่า endpoint ที่เข้ากันได้ใดก็ตามสามารถให้บริการ dependency นี้ได้หรือไม่ |
| `redistributable` | ✅ | ว่าใบอนุญาตอนุญาตให้เผยแพร่ artifact ซ้ำหรือไม่ |
| `transferable` | ✅ | ว่า artifact (หรือสิทธิ์ในนั้น) สามารถถ่ายโอนให้ชุมชนภายใต้เงื่อนไขการถ่ายโอนรางวัลได้หรือไม่ |
| `notes` | ❌ | บริบทในรูปแบบอิสระ |

**การหาคลาส** แต่ละ dependency มีส่วนร่วมในคลาส; `dependency_class` ของเมธอดคือที่จำกัดมากที่สุด:

| โปรไฟล์ dependency | มีส่วนร่วม |
|--------------------|-------------|
| `bundled` + ใบอนุญาตอนุญาตให้เผยแพร่ซ้ำและถ่ายโอน | S |
| `mirrored` + ใบอนุญาต open ที่อนุญาตให้เผยแพร่ซ้ำ (รวม copyleft) | O |
| `gateway` + `substitutable: true` (LLM inference) | A1 |
| `external-api`, หรือ `gateway` พร้อม `substitutable: false` | A2 |
| `bundled` + `license: none` หรือใบอนุญาตที่ไม่เข้ากันกับการเผยแพร่ซ้ำ | X |

`dependency_class` ที่ประกาศไว้ต้องตรงกับคลาสที่ harness หาได้จาก manifest ความไม่ตรงกันถือเป็น validation error

เมธอดที่ **ไม่มี** dependencies ภายนอกประกาศ `"dependency_class": "S"` และ `"dependencies": []` array ว่างเปล่าเป็นคำแถลงยืนยัน ซึ่งถูกตรวจสอบเหมือนกับรายการอื่นๆ

### วิธีการตรวจสอบความถูกต้อง

สามชั้น จากถูกที่สุดไปยังมีอำนาจมากที่สุด:

1. **Manifest audit** harness หาคลาสที่มีผลจาก manifest และปฏิเสธความไม่ตรงกัน ผู้ตรวจสอบตรวจสอบแต่ละ dependency ที่ประกาศกับใบอนุญาตและแหล่งที่มาที่ระบุ — dependency ที่ประกาศว่า `redistributable: true` แต่ใบอนุญาต upstream บอกเป็นอย่างอื่นจะไม่ผ่านการตรวจสอบ
2. **Static analysis** โค้ดที่ส่งมาจะถูกสแกนหาการเรียกเครือข่าย, การดาวน์โหลดแบบ dynamic, และการเข้าถึง filesystem ที่ manifest ไม่ได้ระบุ dependency ที่ *ไม่ได้ประกาศ* ที่พบในการตรวจสอบเป็นเหตุให้ปฏิเสธโดยไม่คำนึงว่ามันจะอยู่ในคลาสใด — manifest ต้องสมบูรณ์ ไม่ใช่แค่ถูกต้อง
3. **Sandbox network policy** sandbox specification กำหนดให้มี **default-deny egress**: method containers ไม่มีการเข้าถึงเครือข่ายเว้นแต่ path จะถูก allowlist อย่างชัดเจน egress path เดียวที่ specification กำหนดคือ **LLM gateway** — inference proxy ที่ดำเนินการโดย evaluation infrastructure, จำกัดเฉพาะ allowlist ที่ชัดเจนของโมเดลที่ pin ไว้, พร้อม request และ response ทุกรายการที่ถูก log สำหรับการตรวจสอบหลัง run สิ่งใดที่ไม่อยู่ใน allowlist จะล้มเหลวที่ชั้นเครือข่าย ไม่ใช่ชั้นนโยบาย ดู [Benchmark Specification §8.6](/docs/network/specifications/benchmark) สำหรับนโยบายเครือข่ายและการออกแบบ gateway

> **Sandbox สองประเภทที่แตกต่างกัน — ประเภทหนึ่งอยู่ในแผน อีกประเภทหนึ่งใช้งานได้จริงแล้ว** โปรดอ่านส่วนนี้อย่างละเอียด เนื่องจากคำว่า "sandbox" ครอบคลุมสองสิ่งที่แตกต่างกัน:
>
> - 🔲 **อยู่ในแผน: platform sandbox และ LLM gateway** — สภาพแวดล้อมที่ดำเนินการโดยโครงสร้างพื้นฐานการประเมินผลซึ่งอธิบายไว้ในส่วนนี้ ซึ่ง LLM gateway จะช่วยให้เมธอด Class A1 สามารถสร้างคะแนนมาตรฐาน gold-standard อย่างเป็นทางการได้ — ได้รับการระบุไว้แล้วแต่ยังไม่ได้สร้าง จนกว่าจะสร้างเสร็จ เมธอด Class A1 มีสิทธิ์ได้รับรางวัล *ในหลักการ* แต่ยังไม่สามารถสร้างคะแนนมาตรฐาน gold-standard อย่างเป็นทางการได้
> - ✅ **ใช้งานได้จริงแล้ว: organizer-node method-execution lane** — โหนดการให้คะแนนของผู้จัดการแข่งขันดำเนินการ method bundle ที่เสนอภายในคอนเทนเนอร์ที่แยกเครือข่าย (`mt-eval node run-method`) อยู่แล้ว: สร้างและรันด้วย `--network=none`, root แบบอ่านอย่างเดียว, dependencies ที่ vendored ไว้ — ซึ่งจำกัดให้ใช้เฉพาะเมธอดที่ไม่ต้องการเครือข่ายขณะรัน (Class S/O โดยโครงสร้าง) สามารถรันบนเครื่องที่ตัดการเชื่อมต่ออินเทอร์เน็ตอย่างสมบูรณ์ โดยมี bundle ที่มีลายเซ็นเฉพาะคะแนนส่งผ่านสื่อแบบถอดได้ ดู [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) สำหรับขั้นตอนแบบครบวงจร
>
> ส่วนนี้อธิบายสิ่งที่ข้อกำหนดของ platform กำหนดไว้ ไม่ใช่สิ่งที่กำลังรันอยู่บน platform ในปัจจุบัน

### การแสดงผลบน Leaderboard

- leaderboard แสดงคลาสการพึ่งพาของแต่ละเมธอดควบคู่กับ badge คลาสเมธอด
- เมธอด Class A2 บน leaderboard แบบเปิดจะมีแฟล็ก **"external dependency"** ที่มองเห็นได้: คะแนนของพวกเขาขึ้นอยู่กับบริการของบุคคลที่สามที่อาจเปลี่ยนแปลงหรือหายไป และปัจจุบันไม่มีสิทธิ์รับรางวัล
- เมธอด Class X ไม่ถูกแสดงรายการ

## Eval Harness: TranslationMethod Protocol {#eval-harness-translationmethod-protocol}

eval harness ใช้ structural typing ของ Python (`Protocol`) สำหรับ plugin ใดก็ตามที่มี member ที่ถูกต้องจะทำงานได้ — ไม่จำเป็นต้องสืบทอด protocol มี member ที่จำเป็น **สาม** รายการ ไม่ใช่แค่ `translate`:

1. **`name`** (`str`) — ชื่อเมธอดที่มนุษย์อ่านได้ ใช้ใน run ID และ log
2. **`method_card()`** (`-> dict | None`) — metadata ของเมธอดสำหรับการติดตาม provenance ฝังอยู่ใน run log และ run card ที่เผยแพร่ คืนค่า `None` หากเมธอดไม่มี card
3. **`async translate(entries, config)`** (`-> list[dict]`) — การแปลจริง: รับ batch ของ entry เข้ามา และส่งออก result dict หนึ่งรายการต่อ entry

เมื่อ harness โหลด plugin ผ่าน `--method path/to/dir` จะตรวจสอบว่า `translate` สามารถเรียกใช้ได้ จากนั้นอ่าน `method.name` และเรียก `method.method_card()` โดยไม่มีเงื่อนไข — plugin ที่ขาด member ใด member หนึ่งจะเกิด crash ตอนโหลด ไม่ใช่ล้มเหลวอย่างสง่างาม

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

ไดเรกทอรี plugin ต้องมี manifest `method.json` ที่มีอย่างน้อย `name` และ `entry_point` (`"module_name:ClassName"` — โมดูลถูกโหลดจากไดเรกทอรี plugin และ class ถูก instantiate) หาก method card ที่ส่งคืนประกาศ `class` หรือ `paradigm` จะต้องใช้คำศัพท์ canonical ข้างต้น — card ที่ไม่ตรงกับ taxonomy จะล้มเหลวในการตรวจสอบตอนโหลด แทนที่จะหลุดออกจากตัวกรองของ leaderboard อย่างเงียบๆ

สำหรับตัวอย่างการทำงานแบบครบถ้วน — การสร้าง รัน และส่ง plugin แบบครบวงจร — ดู [Submit a Method](/docs/network/getting-started/submit-a-method) และ [FST-Gated Pipeline cookbook](/docs/network/tutorials/fst-gated-pipeline)

## champollion: methodPlugin Config

ใน champollion เมธอดจะถูกลงทะเบียนต่อคู่ภาษาใน `champollion.config.json`:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

ดู [Plugin Spec](https://champollion.dev/docs/reference/plugin-spec) สำหรับอินเทอร์เฟซฝั่ง champollion

## การรวมกับ Leaderboard

เมื่อ method card ถูกแนบกับ run (ผ่าน `--method-card`) มันจะถูกฝังใน run card และแสดงบน leaderboard:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

หากไม่ได้ระบุ `--method-card` `mt-eval publish` จะเปิด wizard แบบโต้ตอบที่แนะนำคุณผ่านการอธิบายเมธอดของคุณ

leaderboard แสดง:
- **Class badge** — ตัวบ่งชี้ภาพ (เช่น "pipeline", "coached-llm")
- **Paradigm** — paradigm เชิง algorithm (เช่น "rule-based", "neural-nmt", "llm", "hybrid") ซึ่งเป็นคอลัมน์ที่กรองได้ (ดู [Paradigms](#paradigms))
- **คลาสการพึ่งพา** — S/O/A1/A2 (ดู [ความถูกต้องของเมธอดและคลาสการพึ่งพา](#method-validity-and-dependency-classes)); เมธอด A2 มีแฟล็ก "external dependency"
- **ชื่อเมธอด** — จาก method card
- **เครื่องมือที่ใช้** — แสดงรายการจาก method card
- **ตัวบ่งชี้ open source**

เมื่อไม่มี method card แนบ leaderboard จะแสดง configuration ที่ harness กำหนดเอง (โมเดล, prompt version, temperature, เครื่องมือที่เปิดใช้งาน)

:::danger[ห้ามนำข้อมูลการประเมินผลไปฝึกโมเดล]
เมธอดที่กระบวนการพัฒนามีการเปิดรับชุดข้อมูลการประเมินผล — ไม่ว่าจะเป็นข้อมูลฝึก, ตัวอย่าง few-shot, รายการพจนานุกรม หรือวัสดุสำหรับ prompt tuning — จะถูก **ตัดสิทธิ์** จาก leaderboard ดู [MT Evaluation](/docs/network/leaderboard/rules) สำหรับสิ่งที่แยกแยะเมธอดที่ดีออกจากเมธอดที่ไม่ดี
:::

---

## ดูเพิ่มเติม

- [MT Evaluation](/docs/network/leaderboard/rules) — ภาพรวม, คุณค่าของ leaderboard, และแนวทางเมธอดที่ดี/ไม่ดี
- [Eval Harness](/docs/network/specifications/harness) — วิธีการรันการประเมิน
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — datasets ที่มีอยู่ (EDTeKLA, FLORES+)
- [Run Card Specification](/docs/network/specifications/run-card) — JSON schema ของ run card
- [Plugin Spec](https://champollion.dev/docs/reference/plugin-spec) — อินเทอร์เฟซปลั๊กอินฝั่ง champollion
- [Method Leaderboard](https://champollion.dev/leaderboard) — คะแนน benchmark แบบ live
- [Benchmark Specification](/docs/network/specifications/benchmark) — โปรโตคอลการประเมิน, รูปแบบ corpus, schema ของ run card
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT สำหรับ metrics, น้ำหนัก composite, และระดับคุณภาพ
