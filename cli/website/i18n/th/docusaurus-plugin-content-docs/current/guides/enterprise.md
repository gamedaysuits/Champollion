---
sidebar_position: 7
title: "สำหรับองค์กร"
description: "วิธีที่องค์กรสามารถกำหนดมาตรฐานการแปลด้วยวิธีที่ผ่านการพิสูจน์จาก leaderboard, custom plugins และการ deploy ด้วยคำสั่งเดียว"
---

# champollion สำหรับองค์กร

ทีมของคุณแปลเนื้อหาเป็นประจำ คุณมีไฟล์ locale สะสมอยู่ มี CI pipeline และกระบวนการที่อาจเกี่ยวข้องกับการที่ใครบางคนรัน Google Translate ด้วยตนเอง คัดลอกผลลัพธ์ลงใน JSON แล้วก็หวังว่าทุกอย่างจะเรียบร้อย หรือไม่ก็คุณกำลังจ่ายเงินให้แพลตฟอร์ม TMS ที่ผูกติดคุณไว้กับ translation engine ของผู้ให้บริการรายเดียว

champollion มอบทางเลือกที่สงบกว่า: เลือกวิธีที่เหมาะสมสำหรับแต่ละภาษา — เครื่องหรือมนุษย์ — แล้วรันทั้งหมดผ่านคำสั่งเดียว

## เหตุใดทีมต่าง ๆ จึงใช้ champollion

1. **เลือกวิธีที่เหมาะสมสำหรับแต่ละภาษา** — เครื่องหรือมนุษย์ ไม่ใช่ค่าเริ่มต้นของผู้ให้บริการ
2. **Deploy ด้วยคำสั่งเดียว** — `npx champollion sync` แปล locale ทุกรายการ ทุกรูปแบบ ทุกครั้ง
3. **เปลี่ยนวิธีโดยไม่ต้องแก้โค้ด** — เปลี่ยนที่ config ไม่ใช่การ migration
4. **เป็นเจ้าของ pipeline ของคุณเอง** — ไม่มี vendor lock-in ไม่มี dashboard รายเดือน ไม่มีการสมัครบัญชี

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

ภาษาฝรั่งเศสใช้ DeepL (ทีมของคุณชอบความคล่องแคล่วในภาษายุโรป) ภาษาญี่ปุ่นใช้ frontier LLM ภาษาเยอรมันใช้ Google Translate (เร็ว ราคาถูก ดีพอ) ภาษาเกาหลีใช้ LLM ที่มี register แบบทางการ ภาษาสเปนส่งต่อไปยังบริการแปลโดยมืออาชีพ / MTPE ผ่านวิธี `api` — การแปลโดยมนุษย์เป็นวิธีหลักที่รองรับโดยตรง ไม่ใช่ส่วนเสริม ภาษา Plains Cree ใช้ plugin ที่สร้างและเป็นเจ้าของโดยชุมชน

**คำสั่งเดียวกัน CI pipeline เดียวกัน วิธีที่แตกต่างกันต่อคู่ภาษา — มนุษย์หรือเครื่อง ไฟล์ config ไฟล์เดียว**

:::note[วิธีการสำหรับภาษาชุมชนมีอำนาจอธิปไตยของตนเอง]
ปลั๊กอิน Plains Cree ข้างต้นไม่ใช่แค่ "วิธีการอีกแบบหนึ่ง" วิธีการสำหรับภาษาของชนพื้นเมืองและภาษาชุมชนอื่น ๆ นั้น **เป็นของชุมชนและอยู่ภายใต้การกำกับดูแลของชุมชน**: ชุมชนเป็นผู้ถือกุญแจสู่ข้อมูลที่อยู่เบื้องหลัง กำหนดเงื่อนไขการใช้งาน และวิธีการหรือคลังข้อมูลที่ไม่ใช่เชิงพาณิชย์ (NC) จะถูกแยกออกจากเส้นทางเชิงพาณิชย์โดยค่าเริ่มต้น หากการใช้งานของคุณเป็นเชิงพาณิชย์ โปรดตรวจสอบสัญญาอนุญาตของวิธีการนั้นก่อนนำไปใช้งาน ดูเพิ่มเติมที่ [อธิปไตยของข้อมูล](/docs/network/sovereignty/data-sovereignty)
:::

## เวิร์กโฟลว์ Leaderboard → Deploy

:::tip[`champollion leaderboard` มาพร้อมกับ CLI]
เวิร์กโฟลว์ด้านล่างนี้ทำงานผ่านคำสั่ง `champollion leaderboard` — คุณสามารถเรียกดูตารางจัดอันดับ [Network](/arena) ได้จากเทอร์มินัลของคุณ และติดตั้งปลั๊กอิน method ได้โดยตรงจากที่นั่น ดู [CLI reference](/docs/reference/cli#leaderboard) สำหรับตัวเลือกทั้งหมด
:::

[Network](/arena) คือสถานที่ที่วิธีการแปลถูก benchmark ด้วยการให้คะแนนที่ทำซ้ำได้และมี fingerprint ทุกวิธีได้รับคะแนนรวมจากหลายตัวชี้วัด (chrF++, exact match, FST acceptance, semantic scoring) leaderboard ติดตามทุกการส่งผลงาน

เวิร์กโฟลว์:

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*เพื่อประกอบการอธิบายเท่านั้น — แถว leaderboard ข้างต้นเป็นตัวอย่างเลย์เอาต์ กระดานปัจจุบันเปิดรับการส่งผลงานและยังไม่มีการรันที่เผยแพร่*

**คุณไม่ต้องสร้างวิธีนั้น คุณไม่ต้องเทรนโมเดล คุณเพียงแค่เลือกวิธีที่เหมาะกับโดเมน งบประมาณ และสัญญาอนุญาตของคุณ — มนุษย์หรือเครื่อง — แล้ว deploy** หากมีวิธีที่เหมาะสมกว่าปรากฏขึ้นในเดือนหน้า คุณเปลี่ยนได้ด้วยคำสั่งเดียว

## สิ่งที่ใช้งานได้ในปัจจุบัน

bridge ระหว่าง leaderboard กับ CLI กำลังอยู่ในระหว่างการพัฒนา นี่คือสิ่งที่ใช้งานได้ตอนนี้:

### วิธีในตัว (ไม่ต้องติดตั้ง plugin)

| วิธี | เหมาะสำหรับ | ค่าใช้จ่าย |
|--------|----------|------|
| `llm` (ค่าเริ่มต้น) | เน้นคุณภาพ ทุกภาษา | คิดต่อ token ผ่าน OpenRouter |
| `gemini` | คุณภาพ + tier ฟรี | ฟรี (จำกัด) จากนั้นคิดต่อ token |
| `google-translate` | ความเร็ว + ปริมาณมาก | $20/ล้านตัวอักษร |
| `deepl` | ภาษายุโรป | $25/ล้านตัวอักษร |
| `llm-coached` | ภาษาที่มีข้อมูล coaching | คิดต่อ token ผ่าน OpenRouter |
| `api` | วิธีที่กำหนดเองหรือ host โดยชุมชน | Self-hosted |

### วิธีแบบ plugin (ติดตั้งแยกต่างหาก)

plugin ที่กำหนดเองสามารถครอบคลุม logic การแปลใด ๆ ก็ได้ — โมเดลที่ fine-tune แล้ว, pipeline ที่มี FST-gated, community API หรืออะไรก็ตามที่ผลิต JSON ดูเพิ่มเติมที่ [Build a Plugin](/docs/tutorials/build-a-plugin)

## เวิร์กโฟลว์สำหรับองค์กร

### 1. ประเมินคุณภาพปัจจุบันของคุณ

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. รัน eval harness กับตัวเลือก

[eval harness](/docs/network/specifications/harness) ช่วยให้คุณ benchmark หลายวิธีกับชุดข้อมูลเดียวกัน รัน sweep เปรียบเทียบคะแนน เลือกตัวที่ดีที่สุด:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. กำหนดค่าตัวที่ดีที่สุดต่อคู่ภาษา

อัปเดต config ของคุณเพื่อใช้วิธีที่ดีที่สุดต่อคู่ภาษา ภาษาที่แตกต่างกันมีวิธีที่ดีที่สุดแตกต่างกัน — นั่นคือจุดประสงค์

### 4. ผสานรวมเข้ากับ CI/CD

```bash
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

สามคำสั่ง ไม่มีการแปลด้วยตนเอง pipeline ตรวจจับ string ที่ hardcode แปลด้วยวิธีที่คุณเลือก และทำให้ build ล้มเหลวหากมีสิ่งใดขาดหายหรือเสียหาย

### 5. การตรวจสอบโดยมืออาชีพ (ไม่บังคับ)

สำหรับเนื้อหาที่มีความสำคัญสูง ให้ export เป็น XLIFF เพื่อให้มนุษย์ตรวจสอบ:

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

แปลด้วยเครื่องในส่วนที่เป็นเนื้อหาหลัก ให้มนุษย์ตรวจสอบในส่วนที่สำคัญ จ่ายค่าเวลามนุษย์เฉพาะในส่วนที่จำเป็นจริง ๆ

## โมเดลค่าใช้จ่าย

champollion **ไม่มีการสมัครสมาชิกและไม่มีการคิดราคาต่อผู้ใช้** CLI นี้เปิดเผยซอร์สโค้ดภายใต้สัญญาอนุญาต PolyForm Noncommercial 1.0.0 — ใช้งานได้ฟรีสำหรับวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ (การวิจัย, การศึกษา, งานชุมชน) ส่วนการใช้งานเชิงพาณิชย์จำเป็นต้องได้รับอนุญาต ดังนั้นโปรด [พูดคุยกับเรา](/get-involved) ก่อน นอกเหนือจากนั้น คุณจะจ่ายเพียงแค่ค่าเรียกใช้งาน translation API เท่านั้น:

| ปริมาณ | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1,000 keys × 5 locales | ~$0.50 | ~$0.30 (tier ฟรี) | ~$2.00 |
| 10,000 keys × 15 locales | ~$15 | ~$8 | ~$60 |
| 50,000 keys × 30 locales | ~$75 | ~$40 | ~$300 |

Translation Memory หมายความว่าคุณจ่ายเฉพาะ **key ที่เปลี่ยนแปลง** ในการ sync ครั้งถัดไป หากคุณอัปเดต 10 string จาก 10,000 รายการ คุณจ่ายค่าแปล 10 รายการ ไม่ใช่ 10,000 รายการ

## เทียบกับแพลตฟอร์ม TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **ราคา** | ฟรีสำหรับการใช้งานที่ไม่ใช่เชิงพาณิชย์ (เชิงพาณิชย์ต้องได้รับอนุญาต) + ค่า API | $50–$500/เดือน + ต่อผู้ใช้ |
| **การผูกขาดกับผู้ให้บริการ** | ไม่มี — เปลี่ยนผู้ให้บริการได้ใน config | สูง — ข้อมูลอยู่ในคลาวด์ของพวกเขา |
| **ตัวเลือก Method** | ผู้ให้บริการใดก็ได้, โมเดลใดก็ได้, กำหนดได้ต่อคู่ภาษา | ตามที่พวกเขาเสนอให้ |
| **CI/CD** | First-class (`lint → sync → audit`) | ปลั๊กอิน/webhook |
| **Method แบบกำหนดเอง** | ระบบปลั๊กอิน, ปลั๊กอินจากชุมชน | ไม่รองรับ |
| **การตรวจสอบคุณภาพ** | มีในตัว (wrong-script, echo, length) | แตกต่างกันไป |
| **โฮสต์ด้วยตัวเอง** | รองรับ (LibreTranslate, custom API) | ไม่รองรับ |

ดู [การเปรียบเทียบแบบเต็ม](/docs/guides/comparison) สำหรับรายละเอียด

## อ่านเพิ่มเติม

- **[Quick Start](/docs/getting-started/quick-start)** — รัน sync ครั้งแรกของคุณใน 60 วินาที
- **[Translation Methods](/docs/guides/translation-methods)** — เมนูวิธีทั้งหมดพร้อม decision tree
- **[CI/CD Integration](/docs/guides/ci-cd)** — ทำให้เป็นอัตโนมัติใน pipeline ของคุณ
- **[Working with Professional Translators](/docs/guides/professional-translators)** — การ export/import XLIFF
- **[the Network](/arena)** — benchmark และ leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — ทุก option ใน config
