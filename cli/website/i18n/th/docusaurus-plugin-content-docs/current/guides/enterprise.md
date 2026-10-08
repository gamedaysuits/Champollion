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
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

ภาษาฝรั่งเศสใช้ DeepL (ทีมของคุณชอบความลื่นไหลในแบบฉบับยุโรป) ภาษาญี่ปุ่นใช้ frontier LLM ภาษาเยอรมันใช้ Google Translate (รวดเร็ว ราคาประหยัด และดีเพียงพอ) ภาษาเกาหลีใช้ LLM ที่ใช้ระดับภาษาทางการ ภาษาสเปนจะถูกส่งต่อไปยังบริการนักแปลมืออาชีพ / MTPE ผ่านเมธอด `api` — การแปลโดยมนุษย์เป็นเมธอดระดับ first-class ไม่ใช่ฟังก์ชันเสริมที่นำมาต่อเติม ภาษา Plains Cree ใช้เมธอด coached LLM พร้อมโน้ตไวยากรณ์และพจนานุกรมที่คุณจัดเตรียมไว้

**คำสั่งเดียวกัน CI pipeline เดียวกัน วิธีที่แตกต่างกันต่อคู่ภาษา — มนุษย์หรือเครื่อง ไฟล์ config ไฟล์เดียว**

:::note[เมธอดสำหรับภาษาชุมชนมีอำนาจอธิปไตยเหนือข้อมูล]
คู่ภาษา Plains Cree ข้างต้นไม่ได้เป็นเพียงแค่อีกคู่ภาษาทั่วไป เมธอดสำหรับภาษาชนพื้นเมืองและภาษาชุมชนอื่นๆ เป็นสิ่งที่มี**ชุมชนเป็นเจ้าของและกำกับดูแล**: ชุมชนเป็นผู้ถือกุญแจข้อมูลเบื้องหลัง กำหนดเงื่อนไขการใช้งาน และคลังข้อมูล (corpus) หรือเมธอดที่มิใช่เพื่อการค้า (non-commercial: NC) ใดๆ จะถูกแยกออกจากเส้นทางการค้าโดยค่าเริ่มต้น หากการใช้งานของคุณเป็นไปเพื่อการค้า โปรดตรวจสอบสัญญาอนุญาตของเมธอดก่อนที่คุณจะนำไปใช้งานจริง ดูที่ [อธิปไตยเหนือข้อมูล (Data Sovereignty)](/docs/network/sovereignty/data-sovereignty)
:::

## เวิร์กโฟลว์ Leaderboard → Deploy

:::tip[`champollion network leaderboard` มาพร้อมกับ CLI]
เวิร์กโฟลว์ด้านล่างนี้ทำงานผ่านคำสั่ง `champollion network leaderboard` — สำรวจตารางอันดับ (leaderboard) ของ [Network](/arena) ได้จากเทอร์มินัลของคุณ และติดตั้งปลั๊กอินเมธอดได้โดยตรงจากที่นั่น ดูตัวเลือกทั้งหมดได้ที่ [เอกสารอ้างอิง CLI](/docs/reference/cli#leaderboard)
:::

[Network](/arena) คือพื้นที่ที่เมธอดการแปลได้รับการทดสอบวัดประสิทธิภาพ (benchmark) ด้วยการให้คะแนนที่มีลายนิ้วมือระบุตัวตน (fingerprinted) และทำซ้ำได้ (reproducible) การทดสอบ (runs) จะได้รับการจัดอันดับตามแนวทางของวงการ MT: ด้วยค่า chrF++ ระดับคลังข้อมูลพร้อมช่วงความเชื่อมั่น 95% โดยมีค่า BLEU, TER และ COMET แสดงเคียงคู่กัน และการวิเคราะห์เชิงวินิจฉัย เช่น exact match และการยอมรับของ FST จะถูกรายงานแยกต่างหาก โดยไม่นำมาผสมปนเปกับตัวเลขหลัก การที่เมธอดหนึ่งดีกว่าอีกเมธอดหนึ่งอย่างแท้จริงหรือไม่นั้นตัดสินด้วยการทดสอบนัยสำคัญแบบจับคู่ (paired significance test) ไม่ใช่เพียงผลต่างระหว่างตัวเลขสองค่า ตารางอันดับจะติดตามทุกการส่งผลงาน

เวิร์กโฟลว์:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*เพื่อเป็นตัวอย่างเท่านั้น — แถวในตารางอันดับด้านบนเป็นเพียงเค้าโครงตัวอย่าง ในตัวอย่างนี้ ช่วงความเชื่อมั่นของสองแถวแรกมีความทับซ้อนกัน ดังนั้นตารางจึงไม่ได้บ่งบอกว่าเมธอดใดดีกว่าอีกเมธอดหนึ่ง ขณะนี้ตารางเปิดรับการส่งผลงานและยังไม่มีการเผยแพร่ผลการรันใดๆ*

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
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

สามคำสั่ง ไม่มีการแปลด้วยตนเอง pipeline ตรวจจับ string ที่ hardcode แปลด้วยวิธีที่คุณเลือก และทำให้ build ล้มเหลวหากมีสิ่งใดขาดหายหรือเสียหาย

### 5. การตรวจสอบโดยมืออาชีพ (ไม่บังคับ)

สำหรับเนื้อหาที่มีความสำคัญสูง ให้ export เป็น XLIFF เพื่อให้มนุษย์ตรวจสอบ:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

แปลด้วยเครื่องในส่วนที่เป็นเนื้อหาหลัก ให้มนุษย์ตรวจสอบในส่วนที่สำคัญ จ่ายค่าเวลามนุษย์เฉพาะในส่วนที่จำเป็นจริง ๆ

## โมเดลค่าใช้จ่าย

champollion **ไม่มีค่าสมัครสมาชิกและไม่มีการคิดราคาตามจำนวนผู้ใช้ (per-seat)** ตัว CLI เป็นแบบ source-available ภายใต้สัญญาอนุญาต PolyForm Noncommercial 1.0.0 — ใช้งานได้ฟรีสำหรับการใช้งานที่ไม่ใช่เพื่อการค้า: งานวิจัย, การศึกษา, องค์กรการกุศล, โรงพยาบาลและคลินิกรัฐ, หน่วยงานราชการ, โปรเจกต์ส่วนตัว การนำไปใช้เพื่อวัตถุประสงค์ทางการค้า เช่น ผลิตภัณฑ์ของธุรกิจที่แสวงหากำไร จะไม่อยู่ในขอบเขตของสัญญาอนุญาตดังกล่าว โปรดตรวจสอบ [ใครบ้างที่สามารถใช้งานได้](/docs/getting-started/who-may-use-this) ก่อนเริ่มนำไปใช้ นอกเหนือจากนั้น คุณจ่ายเพียงแค่ค่าเรียกใช้งาน API สำหรับการแปลเท่านั้น:

| ปริมาณ | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1,000 keys × 5 locales | ~$0.50 | ~$0.30 (tier ฟรี) | ~$2.00 |
| 10,000 keys × 15 locales | ~$15 | ~$8 | ~$60 |
| 50,000 keys × 30 locales | ~$75 | ~$40 | ~$300 |

Translation Memory หมายความว่าคุณจ่ายเฉพาะ **key ที่เปลี่ยนแปลง** ในการ sync ครั้งถัดไป หากคุณอัปเดต 10 string จาก 10,000 รายการ คุณจ่ายค่าแปล 10 รายการ ไม่ใช่ 10,000 รายการ

## เทียบกับแพลตฟอร์ม TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **ราคา** | ฟรีสำหรับการใช้งานที่ไม่ใช่เพื่อการค้า ([ใครบ้างที่สามารถใช้งานได้](/docs/getting-started/who-may-use-this)) + ค่าบริการ API | $50–$500/เดือน + คิดตามจำนวนผู้ใช้ |
| **การผูกขาดกับผู้ให้บริการ (Vendor lock-in)** | ไม่มี — สลับผู้ให้บริการได้ในการตั้งค่า (config) | สูง — ข้อมูลอยู่บนคลาวด์ของพวกเขา |
| **การเลือกเมธอด** | ผู้ให้บริการใดก็ได้, โมเดลใดก็ได้, แยกตามคู่ภาษา | เฉพาะสิ่งที่พวกเขามีให้ |
| **CI/CD** | รองรับระดับ First-class (`lint → sync → audit`) | ปลั๊กอิน/webhook |
| **เมธอดแบบกำหนดเอง** | ระบบปลั๊กอิน, ปลั๊กอินจากชุมชน | ไม่รองรับ |
| **การตรวจสอบคุณภาพ (Quality gate)** | มีในตัว (ตรวจจับอักษรผิดระบบ, การสะท้อนข้อความเดิม, ความยาว) | แตกต่างกันไป |
| **โฮสต์ด้วยตนเอง (Self-hosted)** | ได้ (LibreTranslate, API ที่กำหนดเอง) | ไม่ได้ |

ดู [การเปรียบเทียบแบบเต็ม](/docs/guides/comparison) สำหรับรายละเอียด

## อ่านเพิ่มเติม

- **[Quick Start](/docs/getting-started/quick-start)** — รัน sync ครั้งแรกของคุณใน 60 วินาที
- **[Translation Methods](/docs/guides/translation-methods)** — เมนูวิธีทั้งหมดพร้อม decision tree
- **[CI/CD Integration](/docs/guides/ci-cd)** — ทำให้เป็นอัตโนมัติใน pipeline ของคุณ
- **[Working with Professional Translators](/docs/guides/professional-translators)** — การ export/import XLIFF
- **[the Network](/arena)** — benchmark และ leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — ทุก option ใน config
