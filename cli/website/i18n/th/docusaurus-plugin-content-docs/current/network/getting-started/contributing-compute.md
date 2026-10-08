---
sidebar_position: 4
title: "การมีส่วนร่วมด้าน Compute"
description: "รันคิว: รัน benchmark sweep แบบเปิดจากคิวสาธารณะด้วย API key ของคุณเองและเผยแพร่ผลลัพธ์"
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# การมีส่วนร่วมด้านทรัพยากรการประมวลผล

> **แนวคิด:** บนลีดเดอร์บอร์ดมีช่องว่างอยู่ — นั่นคือชุดค่าผสมของ (คู่ภาษา, วิธีการ, เงื่อนไข) ที่ยังไม่มีใครเคยวัดผล เราได้ดูแลคิวสาธารณะของรายการเหล่านี้ไว้ คุณสามารถรันรายการต่างๆ โดยใช้ API key ของคุณเอง เผยแพร่รายงาน แล้วแผนที่จะค่อยๆ ถูกเติมเต็ม การร่วมสนับสนุนการประมวลผล (compute) ถือเป็นการมีส่วนร่วมอย่างแท้จริงและสามารถนำไปอ้างอิงได้สำหรับการประเมินผล MT ของภาษาทรัพยากรต่ำ

คิวนี้มีงานอยู่สองประเภท **รายการ LLM** ใช้ทดสอบโมเดลแช็ตกับ
คู่ภาษา ภายใต้เงื่อนไขพรอมต์ `naive` หรือ `coached` ส่วน **รายการ
Engine** (เงื่อนไข `engine`) จะทดสอบบริการ MT แบบดั้งเดิม — DeepL, Google
Translate, Microsoft Translator, LibreTranslate, Tilde — บนคู่ภาษาที่อยู่
ภายใต้ขอบเขตที่บริการนั้นๆ เผยแพร่รองรับไว้ รายการเหล่านี้คือแกนหลักที่ถูกวัดผลของ
แผนที่ความครอบคลุม และจนถึงเดือน 2026-08 รายการเหล่านี้แทบจะว่างเปล่าทั้งหมด งานทั้งสอง
ประเภททำงานผ่านชุดทดสอบเดียวกันและเผยแพร่ไปยังบอร์ดเดียวกัน

## คิว

คิวสด (live queue) ให้บริการจากฐานข้อมูล (ชุดทดสอบจะอ่านข้อมูลนี้โดยค่าเริ่มต้น) โดยมีสแนปช็อตขนาดกะทัดรัดเผยแพร่อยู่ที่ [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json) และไฟล์ฉบับเต็มอยู่ที่ [queue.json](https://champollion.dev/queue.json) (ขนาดหลายสิบ MB — ไฟล์พรีวิวคือตัวเลือกที่เหมาะสมสำหรับการดึงข้อมูลครั้งแรก) คุณสามารถดูผลลัพธ์ที่การรันของคุณสร้างขึ้นได้บน [แผนที่สดที่ champollion.dev](https://champollion.dev) — แผนที่ความครอบคลุมที่แสดงว่าใครสามารถแปลอะไรได้บ้าง นอกจากนี้ยังมีเครื่องมือดูผ่านเทอร์มินัลที่ไม่ต้องติดตั้ง:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

ตัวแสดงผลจะ*แสดง*เฉพาะรายการที่เปิดอยู่และคำสั่ง `mt-eval run` ที่แน่นอนเท่านั้น — ไม่มีการรันคำสั่งใดหรือใช้โทเค็นของคุณ แต่ละรายการมี:

- `run_command` — พร้อมคัดลอกและวางได้ทันที (ดึงคลังข้อมูลและรันชุดทดสอบ)
- `est_cost_usd` และ `est_basis` — อาจเป็นค่าใช้จ่ายที่**สังเกตพบจริง**จากการรันเบสไลน์ของเราเองในชุด (คลังข้อมูล, โมเดล) เดียวกัน หรือเป็นการ**คาดการณ์**จากต้นทุนเฉลี่ยต่อรายการของการสวีปโมเดลนั้น × จำนวนรายการในคลังข้อมูล เกณฑ์ในการคำนวณจะระบุไว้ในแต่ละรายการ โดยค่าใช้จ่ายจริงของคุณจะขึ้นอยู่กับราคาของผู้ให้บริการ ณ เวลาที่รัน
- `priority` — อันดับที่เผยแพร่ (โหมดสำรวจ: ผลการประเมินเริ่มต้นครอบคลุมทั้งคู่ภาษา, ภาษา และตระกูลภาษาต่อดอลลาร์) ตัวอย่างพรีวิวยังเผยแพร่**ระดับงบประมาณ** — สิ่งที่ $1 / $10 / $100 / $1000 จะได้รับจากอันดับต้นๆ (รายการ, คู่ภาษา, โมเดลที่ครอบคลุมถึง) — เพื่อให้คุณสามารถกำหนดขนาดการมีส่วนร่วมได้ก่อนที่จะใช้จ่ายจริง โมเดลมูลค่าเบื้องหลังคือ **มูลค่าลูกโซ่ที่คาดหวัง**: การรันครั้งนี้ถูกคาดการณ์ว่าจะช่วยเสริมความแข็งแกร่งให้กับโครงข่ายภาษาทั้งหมดมากน้อยเพียงใด ต่อหนึ่งดอลลาร์ที่ประมาณการไว้ แต่ละรายการจะแสดงรายละเอียดสูตรอย่างครบถ้วน (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`) เพื่อให้สามารถคำนวณอันดับใดๆ ซ้ำได้ด้วยตนเอง — สูตรและค่าเริ่มต้นได้รับการเผยแพร่ใน [ข้อกำหนดการสร้างคิว](/docs/network/specifications/queue-construction) และเหตุผลเบื้องหลังอยู่ใน [เหตุใดคิวจึงถูกสร้างขึ้นในลักษณะนี้](/docs/network/perspectives/why-the-queue)

**ไม่มีการล็อกการจอง — เลือกรายการที่เปิดอยู่ได้เลย** การที่สองคนรันรายการเดียวกันไม่เป็นปัญหาโดยการออกแบบ: การ์ดรันทุกใบมีลายนิ้วมือ (SHA-256 จากแฮชชุดข้อมูล + โมเดล + เงื่อนไข + system prompt, [ข้อกำหนด Benchmark §3.8](/docs/network/specifications/benchmark)) ดังนั้นการรันที่เหมือนกันจะถูกรวมเป็นหนึ่งเมื่อเผยแพร่ และการทำซ้ำอิสระของการกำหนดค่าเดียวกันถือเป็นหลักฐานที่มีประโยชน์ ไม่ใช่การสูญเปล่า

Corpus ในคิวเป็น dev-split, ใช้สัญญาอนุญาต CC-BY (ดัดแปลงจาก Tatoeba) และมีแฟล็ก `do_not_train` — เป็นชุดข้อมูลสำหรับการประเมิน ไม่ใช่ข้อมูลสำหรับการฝึก Corpus ที่มีสัญญาอนุญาตไม่อนุญาตให้ใช้เชิงพาณิชย์และที่ถูกกักกันจะถูกยกเว้นจากคิวสาธารณะ

## การตั้งค่า (ครั้งเดียว)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### ควรใช้ key ของผู้ให้บริการรายใด?

ชุดทดสอบรองรับ key ของผู้ให้บริการสี่ราย เลือกด้วย `--provider` บน `mt-eval run` และ `mt-eval queue` — หรือตรวจจับอัตโนมัติจาก key ที่ตั้งค่าไว้ในสภาพแวดล้อมของคุณหรือ `.env`:

| `--provider` | Key | เข้าถึง |
|---|---|---|
| `openrouter` (ค่าเริ่มต้น) | `OPENROUTER_API_KEY` | ทุกโมเดลในรายการคิว |
| `anthropic` | `ANTHROPIC_API_KEY` | โมเดล Anthropic Claude |
| `openai` | `OPENAI_API_KEY` | โมเดล OpenAI GPT |
| `gemini` | `GOOGLE_API_KEY` | โมเดล Google Gemini |

key [OpenRouter](https://openrouter.ai/keys) เพียงหนึ่งอันสามารถเข้าถึงทุกโมเดลในรายการ และการติดตามต้นทุนและ snapshot ราคาของชุดทดสอบมาจาก metadata ของ OpenRouter เดียวกัน ดังนั้นต้นทุนการรันที่รายงานจึงตรงกับสิ่งที่ key ของคุณถูกเรียกเก็บ — นั่นคือเหตุผลที่เป็นค่าเริ่มต้น หากเครดิตของคุณอยู่กับ Anthropic, OpenAI หรือ Google โดยตรง ให้ตั้งค่า key ของผู้ให้บริการนั้นและชุดทดสอบจะเรียก API ของผู้ให้บริการโดยตรงโดยไม่มีพร็อกซี key โดยตรงเข้าถึงได้เฉพาะโมเดลของผู้ให้บริการนั้นเอง (เหมาะสำหรับการรันแบบผู้ให้บริการเดียว) และตัวเลขต้นทุนมาจากราคาที่ผู้ให้บริการประกาศไว้แทนที่จะเป็น metadata ที่เรียกเก็บจริง — ถือว่าเป็นการประมาณการที่ใกล้เคียง หากตั้งค่าทั้ง key ของ OpenRouter และ key โดยตรง การตรวจจับอัตโนมัติจะเลือก OpenRouter; ตัวประมวลผลคิวจะแจ้งให้คุณทราบและวิธีการแทนที่ด้วย `--provider` การ์ดรันทุกใบบันทึกว่ารันผ่านช่องทางใดในฟิลด์ `api_provider`

(`mt-eval run` ยังรับ `--provider local` สำหรับ endpoint ที่เข้ากันได้กับ OpenAI แบบ self-hosted — Ollama, vLLM, LM Studio — ผ่าน `--base-url` เป็นการเลือกใช้อย่างชัดเจน ไม่มีการตรวจจับอัตโนมัติ)

### ไม่ต้องใช้ API key: รันโมเดลแบบโฮสต์เอง

คุณไม่จำเป็นต้องมีคีย์คลาวด์เลย วิธี `local-model` จะรันโมเดล neural-MT แบบโอเพนซอร์สบนฮาร์ดแวร์ของคุณเอง — ซึ่งเป็นโมเดลที่เอนจินบนคลาวด์ไม่ได้ให้บริการ และเป็นจุดที่ความครอบคลุมของภาษาทรัพยากรต่ำอยู่จริงๆ: **NLLB-200**, **OPUS-MT** (Helsinki-NLP) และ **MADLAD-400**

```bash
# transformers backend (Hugging Face) — install the extra once:
python3 -m pip install 'mt-eval-harness[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**สอง "วิธีทั่วไป" ในการโหลดโมเดล ซึ่งจะถูกเลือกโดยอัตโนมัติ — ไม่จำเป็นต้องกำหนดค่าใดๆ:**

- **transformers** (ค่าเริ่มต้น): `--model` คือ Hugging Face hub id (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) หรือไดเรกทอรี `from_pretrained()` ภายในเครื่อง จำเป็นต้องมี `python3 -m pip install 'mt-eval-harness[local-models]'`
- **CTranslate2** (การอนุมานบน CPU/GPU ที่รวดเร็ว): `--model` คือไดเรกทอรีโมเดลที่แปลงเป็น CTranslate2 แล้ว (ไดเรกทอรีที่สร้างขึ้นโดย `ct2-transformers-converter` ซึ่งมี `model.bin` อยู่) จำเป็นต้องมี `python3 -m pip install 'mt-eval-harness[ctranslate2]'` โดยระบบจะอ่าน tokenizer จากไดเรกทอรีที่แปลงแล้ว หรือระบุชื่อด้วย `LOCAL_TOKENIZER_ID`

แบ็กเอนด์จะถูกตรวจหาโดยอัตโนมัติจากพาธของโมเดล (ไดเรกทอรี CTranslate2 จะมี `model.bin`) และคุณสามารถบังคับเลือกได้ด้วย `LOCAL_MODEL_BACKEND=transformers|ctranslate2` หากจำเป็น

**จำเป็นต้องระบุ `-m` / `--model`** วิธี `local-model` ไม่มีโมเดลเริ่มต้น: การรันโดยไม่ระบุโมเดลจะถูกปฏิเสธ และ run card จะบันทึกโมเดลที่โหลดขึ้นมาจริง (hub id พร้อม revision หรือไดเรกทอรีพร้อมค่า SHA-256 ของไฟล์) หากเป็น Hugging Face id ระบบจะดาวน์โหลดค่าน้ำหนักในการรันครั้งแรกไปยังแคชของ Hugging Face (ใช้ `HF_HOME` เพื่อย้ายตำแหน่ง)

**โมเดลแบบระบุคู่ภาษาจะแปลเฉพาะคู่ภาษาของตนเอง** โมเดล OPUS-MT (`Helsinki-NLP/opus-mt-<src>-<tgt>`) จะแปลเฉพาะคู่ภาษาที่ระบุอยู่ในชื่อของมันเท่านั้น การรันที่ใช้คลังข้อมูลของคู่ภาษาอื่นจะถูกปฏิเสธ เว้นแต่คุณจะส่งพารามิเตอร์ `--allow-model-pair-mismatch` — สำหรับการทดสอบเบสไลน์กับภาษาที่เกี่ยวข้องกันอย่างเจาะจง (เช่น `opus-mt-en-fi` บนชุดข้อมูล English→Northern Sami) โดย run card จะบันทึกความไม่ตรงกันนี้ไว้

**รหัสภาษามาจาก language card ไม่ใช่การคาดเดา** สำหรับโมเดลหลายภาษาอย่าง NLLB ชุดทดสอบจะอ่านรหัส FLORES-200 โดยตรงจาก card ของภาษาเป้าหมาย (ซึ่งเป็นแหล่งความจริงแหล่งเดียวกับที่ทุกวิธีใช้) หากเป็นภาษาที่โมเดลไม่รองรับจริงๆ — ตัวอย่างเช่น NLLB-200 ไม่มี Plains Cree (`crk`) — ระบบจะ**แจ้งข้อผิดพลาดอย่างตรงไปตรงมา** ("อยู่นอกเหนือขอบเขตสำหรับโมเดลนี้") แทนที่จะส่งรหัสหลอกและให้คำแปลที่ดูน่าเชื่อถือแต่ไม่ถูกต้อง ส่วนโมเดล OPUS-MT นั้นเจาะจงเฉพาะคู่ภาษาอยู่แล้ว คู่ภาษาจึง*เป็น*ตัวแทนของโมเดลโดยตรง

การรันโมเดลในเครื่องจะทำการคิดคะแนนและเผยแพร่เหมือนกับการรันอื่นๆ ทุกประการ — ใช้เมตริกเดียวกัน, run card เดียวกัน, ลีดเดอร์บอร์ดเดียวกัน (นี่คือวิธีการของ harness โดยเครื่องมือแปลผ่าน CLI จะเรียกใช้ในภายหลังผ่าน subprocess bridge ดังนั้น Node จึงไม่จำเป็นต้องมี Python ML stack)

### เส้นทางด่วนสำหรับ agent

หากคุณทำงานกับ Claude Code หรือ coding agent อื่น การมีส่วนร่วมทั้งหมดใช้เพียง prompt เดียว:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Tier 0 — คำสั่งเดียว

วิธีที่เร็วที่สุดในการมีส่วนร่วมคือให้ชุดทดสอบดึงรายการบนสุดของ
คิวให้คุณ:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

ไม่มีการเรียงลำดับใหม่ — ลำดับคิว*คือ*[โมเดลลำดับความสำคัญ](/docs/network/specifications/queue-construction) — และจะแสดงแผนทั้งหมดพร้อมค่าใช้จ่ายโดยประมาณและถามก่อนดำเนินการใดๆ รายการที่มีการ coaching จะถูกข้ามเว้นแต่คุณจะนำไฟล์ coaching มาเอง
(`--include-coached --coaching-file my-coaching.txt`)

**ตัวประมวลผลคิวเผยแพร่ให้คุณ — ไม่ต้องมีบัญชี** ต่างจาก `mt-eval run` เดี่ยว (ซึ่งไม่มีการเผยแพร่อัตโนมัติ) `mt-eval queue` จะระบุตัวตนสำหรับการเผยแพร่*ก่อน*ใช้โทเค็นใดๆ และ**เผยแพร่การรันที่สำเร็จแต่ละครั้งอัตโนมัติ**ไปยังตารางอันดับเมื่อเสร็จสิ้น — ไม่มีขั้นตอนเผยแพร่แยกต่างหาก ลงชื่อเข้าใช้ (GitHub/Google) เฉพาะเมื่อต้องการให้ชื่อของคุณปรากฏบนตาราง มิฉะนั้นดำเนินการแบบไม่ระบุตัวตนและผลลัพธ์จะโพสต์ในชื่อผู้ส่ง `anonymous` (`--anonymous` บังคับใช้ และการรัน `curl | bash` แบบไม่โต้ตอบที่ไม่มีการลงชื่อเข้าใช้ที่แคชไว้จะใช้ค่านี้เป็นค่าเริ่มต้นและแจ้งให้ทราบ) ส่ง `--no-publish` เพื่อเก็บผลลัพธ์ไว้ในเครื่องแทน (คุณสามารถเผยแพร่ภายหลังด้วย `mt-eval publish`) จากนั้นติดตามสิ่งที่การรันของคุณสร้างขึ้นได้ที่ [แผนที่สดบน champollion.dev](https://champollion.dev)

## Tier 1 — รัน benchmark

`run_command` ของแต่ละรายการในคิวเป็นแบบ self-contained ตัวอย่างทั่วไป:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

คุณส่ง **registry id** ไม่ใช่ไฟล์ — ชุดทดสอบจะดึงข้อมูลอ้างอิงจากแหล่งต้นทางในขณะรัน และให้คะแนนกับข้อมูลที่ดึงมาใหม่
(เนื้อหา corpus ไม่มีการโฮสต์หรือติดตามที่นี่)

การรันจะแสดงต้นทุนรวมและเขียน run log พร้อมรายงานที่ให้คะแนนไปยัง `eval/logs/` จากนั้นเผยแพร่:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**ไม่ต้องมีบัญชี** การเผยแพร่เสนอการลงชื่อเข้าใช้ OAuth (GitHub/Google) เพื่อให้ชื่อของคุณกลายเป็นการระบุแหล่งที่มาบนตารางอันดับ — แต่เป็นทางเลือก: `mt-eval publish <report> --anonymous` เผยแพร่โดยไม่มีบัญชี และแถวจะแสดงเหมือนกับผลลัพธ์ที่ self-benchmarked อื่นๆ ทุกประการโดยมีผู้ส่ง `anonymous` การรับข้อมูลแบบไม่ระบุตัวตนมีการจำกัดอัตรา (ไม่กี่การ์ดต่อชั่วโมงต่อการเชื่อมต่อ การลงชื่อเข้าใช้คือเส้นทางไม่จำกัด) และผ่านประตูความสมบูรณ์ของฐานข้อมูลเดียวกับการส่งอื่นๆ ทุกรายการ — การกักกัน ช่วงคะแนน การผูก corpus-sha และการป้องกันเนื้อหา corpus ล้วนใช้บังคับเหมือนกัน ไม่ว่าจะไม่ระบุตัวตนหรือระบุแหล่งที่มา การส่งของชุมชนจะอยู่ในระดับความน่าเชื่อถือ **self-benchmarked** — ระบุไว้อย่างชัดเจนว่า "ส่งโดยผู้ที่รันเอง" นั่นไม่ใช่การลดระดับ แต่เป็นโมเดลความน่าเชื่อถือที่ทำงาน การ์ดรันมีทุกสิ่งที่จำเป็นสำหรับให้ใครก็ตามรันการกำหนดค่าเดียวกันของคุณซ้ำได้: แฮชชุดข้อมูล โมเดล เงื่อนไข system prompt ครบถ้วน และต้นทุน ระดับที่สูงขึ้น (การยืนยัน การตรวจสอบโดยชุมชน) ได้รับโดยการตรวจสอบ — ดู [กฎตารางอันดับ](/docs/network/leaderboard/rules)

:::note[การกลั่นกรอง]
แถวที่ไม่ระบุตัวตนได้รับการกลั่นกรองเหมือนกับทุกอย่างอื่น: การส่งข้อมูลไม่สามารถเปลี่ยนแปลงได้ผ่าน public API และการลบหรือแก้ไขโดยผู้ดูแลจะผ่านช่องทาง service-role ซึ่งเส้นทางการตรวจสอบของฐานข้อมูลจะเก็บรักษาแถวก่อนหน้าไว้ — ดังนั้นการลบจะถูกบันทึกและสามารถย้อนกลับได้ ไม่มีการลบแบบเงียบ
:::

## Tier 2 — สร้าง prompt แบบ coached

ชุดทดสอบมีการรองรับชั้นหนึ่งสำหรับ **coaching**: แทนที่ system prompt แบบพื้นฐานด้วยอันที่มีความรู้ทางภาษาศาสตร์จริง ส่ง `--coaching-file` (หรือ `--coaching "inline text"` สำหรับ prompt สั้น) และชุดทดสอบจะใช้ข้อความของคุณเป็น system prompt บันทึก**ข้อความเต็มพร้อม SHA-256** ในบล็อก provenance ของ run log และระบุเงื่อนไขของการรันว่า **`coached`** (เว้นแต่คุณจะตั้งค่า `--prompt` อย่างชัดเจน) — ดังนั้นการสร้าง prompt จึงเป็นการทดลองที่ทำซ้ำได้และระบุแหล่งที่มาได้ ไฟล์ coaching สองไฟล์ที่ต่างกันจะไม่มีทางสับสนกัน และการรันแบบ coached จะไม่ถูกเข้าใจผิดว่าเป็น baseline แบบพื้นฐานบนตารางอันดับ

ตัวอย่างที่ใช้งานได้จริงสำหรับภาษา Faroese โดยใช้ข้อเท็จจริงด้านประเภทวิทยาและรายการคำศัพท์จาก [การ์ดภาษาสาธารณะ](https://champollion.dev/languages) ของภาษา:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(เขียนเนื้อหา coaching ของคุณเอง — ข้อเท็จจริงข้างต้นแสดงให้เห็น*รูปแบบ*: กฎไวยากรณ์ที่มีผลกระทบสูงสองสามข้อ คำศัพท์ขนาดเล็กของคำที่โมเดลมักผิดพลาด คำแนะนำเกี่ยวกับ register การ์ดภาษาที่ [champollion.dev/languages](https://champollion.dev/languages) อ้างอิงแหล่งที่มาด้านประเภทวิทยาที่คุณสามารถนำมาใช้ได้)

เปรียบเทียบกับ baseline แบบพื้นฐานด้วย `mt-eval compare <naive_log> <coached_log>` ปรับปรุง และเผยแพร่การรันที่ดีที่สุดของคุณ การรันจะเผยแพร่พร้อมเงื่อนไข `coached` โดยอัตโนมัติ หากต้องการให้ตารางอันดับแสดงชื่อวิธีการแทนป้ายกำกับทั่วไป ให้แนบ method card เมื่อเผยแพร่ (ขั้นตอนการเผยแพร่มี wizard ให้) การเอาชนะ baseline แบบพื้นฐานในคู่ภาษาที่มีทรัพยากรน้อยด้วยการวิศวกรรม prompt เพียงอย่างเดียวถือเป็นผลการค้นพบที่แท้จริงและสามารถเผยแพร่ได้ — ดู [คู่มือ Coached LLM Prompting](/docs/network/tutorials/coached-llm-prompting) ฉบับสมบูรณ์สำหรับแนวทางการออกแบบ

## Tier 3 — สร้างวิธีการ

การมีส่วนร่วมที่ทะเยอทะยานที่สุด: ใช้งานโปรโตคอล `TranslationMethod` (`translate(entries, config)`) และทำ benchmark กับระบบจริง ไม่ใช่แค่ prompt ชุดทดสอบรันผ่าน `--method <plugin-dir>` และฝัง method card ของคุณไว้ใน run card รูปแบบพร้อม cookbook ที่ใช้งานได้:

- **[FST-gated pipelines](/docs/network/tutorials/fst-gated-pipeline)** — คำผู้สมัครทุกคำได้รับการตรวจสอบโดย morphological analyzer; LLM สร้างใหม่จนกว่าจะผ่านประตู ผลลัพธ์แบบกึ่ง-deterministic ที่รับประกันด้านสัณฐานวิทยา
- **[Dictionary-augmented generation](/docs/network/tutorials/dictionary-augmented-llm)** — ค้นหาคำต้นทางในพจนานุกรมสองภาษาในขณะแปลและจำกัดผลลัพธ์
- [Chained models](/docs/network/tutorials/chained-models), [few-shot retrieval](/docs/network/tutorials/few-shot-prompting), [back-translation](/docs/network/tutorials/back-translation), [rule-based hybrids](/docs/network/tutorials/rule-based-hybrid)…

วิธีการประกาศ **dependency class** (S/O/A1/A2/X — ดู [ข้อกำหนดวิธีการ](/docs/network/specifications/methods#method-validity-and-dependency-classes)) ที่อธิบายสิ่งที่จำเป็นสำหรับการรันและการถ่ายโอน: pipeline แบบ self-contained คือ Class S; อันที่เรียก licensed dictionary API ในขณะรันคือ A2 ประกาศอย่างซื่อสัตย์ — class กำหนดว่าวิธีการของคุณสามารถแข่งขันได้ที่ใด และ manifest จะถูกตรวจสอบ

## ทำไมสิ่งนี้จึงสำคัญเกินกว่าแค่ตารางอันดับ

การรันที่เผยแพร่ทุกครั้งเป็นหลักฐานอิสระเกี่ยวกับคุณภาพ MT สำหรับคู่ภาษาที่ผู้ให้บริการเชิงพาณิชย์ไม่ได้วัดผล คิวยังทำหน้าที่เป็นบันทึกสาธารณะของ*ความต้องการ*: คู่ภาษาใดที่ชุมชนพิจารณาว่าคุ้มค่าแก่การวัด ความครอบคลุมมีต้นทุนเท่าใดในราคา API ปัจจุบัน และทรัพยากรการประมวลผลที่มีส่วนร่วมสามารถขยายได้ไกลแค่ไหน เมื่อเราขอให้หน่วยงานให้ทุนสนับสนุนการสำรวจอย่างเป็นระบบ คิวนี้และอัตราการเติมเต็มคือหลักฐานของความต้องการ
