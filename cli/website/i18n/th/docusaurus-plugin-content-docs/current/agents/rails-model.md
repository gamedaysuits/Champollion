---
title: "โมเดล rails"
slug: /agents/rails-model
description: "วิธีสร้างโปรเจกต์บน rails ของ Champollion: โครงสร้างต้นไม้ของโปรเจกต์ รูปแบบที่ผ่านการตรวจสอบ schema ทั้งหกแบบที่ทุกเครื่องมืออ่านได้ ไปป์ไลน์หนึ่งเดียวตั้งแต่ข้อมูลนำเข้าที่ยอมรับไปจนถึงผลลัพธ์ที่วัดผลได้ เส้นทางในรูปแบบข้อมูล และรูปแบบของการปฏิเสธในทุกกรณี"
---

# โมเดล Rails

โปรเจกต์บน rails คือโฟลเดอร์ของไฟล์ธรรมดา เครื่องมือทุกตัว — ทั้ง `champollion` CLI, `nmt-forge`, `mt-eval` และเซิร์ฟเวอร์ MCP — ต่างอ่านไฟล์ชุดเดียวกันโดยตรง เทียบกับสกีมาเดียวกัน พร้อมผลการประเมินเดียวกัน ขั้นตอนถัดไปจะอ่านจากไฟล์เสมอ โดยไม่เคยมีการจดจำไว้ (มีสองสิ่งที่อยู่นอกโปรเจกต์: เซิร์ฟเวอร์ MCP จะนับจำนวนครั้งที่ขั้นตอนล้มเหลวตามช่วงอายุการทำงานของตัวเอง และ nmt-forge จะดูแลคิวการฝึกสอนระดับเครื่องหนึ่งคิวใน `~/.nmt-forge`) หากคุณแก้ไขไฟล์ด้วยตนเอง แล้วเรียกดูขั้นตอนถัดไป คำตอบจะสะท้อนการเปลี่ยนแปลงนั้นทันที

หน้านี้คือแผนที่ กฎการทำงานอยู่ใน[สัญญาการทำงาน](/docs/agents/contract) ส่วนการเรียกใช้เครื่องมืออยู่ใน [MCP](/docs/agents/mcp) และ[เชลล์](/docs/agents/shell)

## เครื่องมือ

| เครื่องมือ | การติดตั้ง | หน้าที่บน rails |
|---|---|---|
| `champollion` | npm (Node 20.11+) | เริ่มต้นโปรเจกต์ นำเข้าข้อมูล บันทึกข้อกำหนด ระบุขั้นตอนถัดไป ดำเนินรอบการปรับปรุง เชื่อมต่อโมเดลเข้ากับแอปพลิเคชัน |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | ฝึกสอน คัดกรอง แบ่งชุดข้อมูล บันทึกการคาดการณ์ ประเมินคะแนนโมเดลบนชุดทดสอบและส่งออกโมเดล ให้บริการโมเดล ดูแลสมุดบัญชี (ledger) |
| `mt-eval` | มาพร้อมกับ `nmt-forge` (แพ็กเกจ `mt-eval-harness`) | รันวิธีประมวลผล (method) บนชุดทดสอบ ไฟล์ หรือคำขอ ใช้เกต (gate) ประเมินคะแนน |
| `champollion-mcp-server` | npx | ขับเคลื่อน `champollion` CLI ในฐานะโพรเซสย่อยที่มีขอบเขต โปรไฟล์ rails ประกอบด้วยเครื่องมือหกอย่าง |

เครื่องมือแต่ละตัวทำงานเป็นโพรเซสของตัวเอง เซิร์ฟเวอร์ MCP จะรันคำสั่งเดียวกับที่คนพิมพ์ (`run_next_step` จะปฏิเสธโปรแกรมอื่นใดนอกจาก `champollion`, `nmt-forge` และ `uv tool install … nmt-forge`)

## โครงสร้างโปรเจกต์

`champollion new <folder> --from <language> --to <language>` เขียน:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

คำสั่งนี้จะปฏิเสธโฟลเดอร์ที่มีโปรเจกต์อยู่แล้ว (exit 1) หรือมีไฟล์ที่ไม่ซ่อนอยู่ (exit 1) และปฏิเสธ `kind` อื่นใดนอกจาก `language`: โปรเจกต์ `task` และ `service` ยังไม่ได้อยู่บน rails ส่วน `--dry` จะแปลงรหัสภาษาและไม่เขียนไฟล์ใดๆ

ขั้นตอนต่างๆ จะเพิ่มส่วนที่เหลือเมื่อทำงาน:

| พาธ | เขียนโดย | สิ่งที่จัดเก็บ |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — ข้อกำหนดของไฟล์ที่อยู่ข้างกัน |
| `data/combined-from/` | `champollion data combine` | ไฟล์ต้นฉบับที่ combine นำมารวมเข้าด้วยกัน (ย้ายเท่านั้น ไม่เคยลบ) |
| `data/not-for-training/` | `champollion data combine` | ไฟล์ที่ผู้ถือครองระบุว่าห้ามโมเดลใดเรียนรู้จากไฟล์เหล่านี้ |
| `.forge/` | `nmt-forge init` | เวิร์กช็อป: `eval-registry.json`, `ledger.jsonl`, การลงทะเบียนล่วงหน้า, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | การกำหนดค่าการฝึกฝน (พรีเซ็ตโมเดลที่แจกแจงเป็นตัวเลขอย่างชัดเจน) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | คู่ข้อมูลฝึกฝนที่ผ่านการคัดกรองแล้ว |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | ชุดข้อมูล dev; ไฟล์ฝึกฝนของแต่ละรอบ |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | ประโยคที่ผู้พูดเขียนขึ้นสำหรับชุดข้อมูล dev — บทบาท `dev`, เฉพาะในเครื่องเท่านั้น, ไม่เคยนำไปฝึกฝน |
| `improve/time.json` | `champollion improve time` | เวลาของผู้พูด ในคำพูดของพวกเขาเอง |
| `improve/round-<k>/` | ขั้นตอน improve | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (แถวที่โมเดลอื่นร่างไว้ — โมเดลใหม่กว่าที่ยังไม่ได้ใช้งาน หรือโมเดลที่ถูกแทนที่ด้วยการเลื่อนขั้น: หมายเลขแถว, ชื่อรัน, ความสัมพันธ์ และจำนวนคู่ฝึกฝนของแต่ละโมเดล — และตั้งแต่รอบที่ 2 เป็นต้นไป, `repeat_rows`: แถวที่แสดงซ้ำ, แต่ละ `row`, `from_round`, `from_row` และ `mark` ก่อนหน้า), `marks.json` (จำนวนนับ, สัดส่วนที่ถูกต้องพร้อมช่วงความเชื่อมั่น, `blind`, และ `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | โมเดลที่ส่งออกและ method.json ของโมเดลนั้น |
| `deploy/<name>.json` | `nmt-forge export` (ภายในโปรเจกต์ rails) | deployment/1 — สิ่งที่ถูกนำไปใช้งาน |
| `gates/*.json` | ผู้คน | gate-chain/1 — การตรวจสอบระหว่างเอาต์พุตและสิ่งที่จะส่งมอบจริง |
| `methods/<id>/method.json` | ผู้คน | method/1 (เขียนโดย `nmt-forge export` ลงในโฟลเดอร์โมเดลด้วยเช่นกัน, `mt-eval export` และ `champollion serve --emit-manifest`) |

## รูปแบบข้อมูล

สกีมาของเฟรมเวิร์กทั้งหกรายการอยู่ใน `shared/schemas/framework/` เอกสารแต่ละฉบับจะระบุสกีมาของตนไว้ใน `$schema` คีย์ที่ไม่รู้จักจะถูกปฏิเสธ หากคุณมีคีย์เฉพาะของตัวเอง ให้ใส่ไว้ใต้ `x-`

| รูปแบบ | `$schema` | ตำแหน่ง | คืออะไร |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | การตัดสินใจเท่านั้น: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | ข้อกำหนดของไฟล์ข้อมูล: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, ฟิลด์การลงทะเบียน, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | หนึ่งวิธีประมวลผล: `id`, `name`, `kind` และการตั้งค่าเฉพาะของประเภทนั้น, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | เกต `metric-threshold` ที่เรียงลำดับ และ `fallback` ที่ระบุหรือไม่ก็ได้ |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | หนึ่งวิธีประมวลผล, เกตของวิธีนั้น, หนึ่งคู่ภาษา; โฮสต์และพอร์ต `serve` ที่ระบุหรือไม่ก็ได้ |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | สัญญา `/translate` | เอกสารคำขอ, คำตอบ, ข้อผิดพลาด และ `/health` |

`project.defaults` — สิ่งที่ข้อมูลที่เพิ่มเข้ามาในโปรเจกต์จะได้รับเมื่อไม่มีใครระบุเป็นอย่างอื่น `champollion new` จะเขียน `{"transmission": "local-only", "training": "ask", "share_scores": "ask"}`. The values: `transmission` `local-only` หรือ `ask`; `training` `allowed`, `not-allowed` หรือ `ask`; `share_scores` `never` หรือ `ask` ทั้งนี้ `ask` จะทำให้เครื่องมือหยุดและสอบถาม — rails จะไม่กุคำตอบขึ้นมาเองอย่างเด็ดขาด

มีบันทึกอีกสองรายการที่ไม่ได้เป็นสกีมาของเฟรมเวิร์ก แต่เป็นส่วนหนึ่งของโมเดล:

- **บัญชีแยกประเภท forge**, `.forge/ledger.jsonl`: เพิ่มข้อมูลต่อท้ายได้เท่านั้นและเชื่อมโยงด้วยแฮช
  (แต่ละรายการจะฝังแฮชของรายการก่อนหน้าไว้; `nmt-forge ledger verify`
  จะไม่ผ่านหากมีการแก้ไขใดๆ) บัญชีนี้จะบันทึกการลงทะเบียน, ทุกการอ่านชุดข้อมูลที่ลงทะเบียนไว้,
  การลงทะเบียนล่วงหน้า, คะแนน, การใช้ชุดข้อมูลปิดผนึก, การแทนที่ค่า, ผลการตรวจสอบการรั่วไหล,
  เกณฑ์ขั้นต่ำของพจนานุกรม, การส่งออก, ตัวเลือก, การให้บริการ, คำตัดสินของรอบ
  (`improve-compare`: `better`, `worse`, `no-change`, หรือ `too-few` ภายใต้ 50
  ประโยคชุดพัฒนา), วิธีที่แต่ละรอบใช้เทรน (`round-plan`), ฉบับร่างของอีกโมเดล
  สำหรับแผ่นตรวจทาน (`draft-newer`: ชื่อรอบการรัน, `relation`, จำนวนคู่ประโยคสำหรับเทรนของแต่ละโมเดล
  และจำนวนฉบับร่าง), คำตัดสินแบบไม่เปิดเผยตัวตนของผู้พูดภาษาที่มีต่อโมเดลที่ใหม่กว่า (`improve-speaker`: ชื่อรอบการรัน, จำนวนสี่ค่า, `z`,
  `clear`), การเปลี่ยนแปลงโมเดล (`model-change`, รวมถึง `not-now`) และสิ่งที่
  `nmt-forge tidy` ลบออกไป (`tidy`: รอบการรันและไบต์) มีเพียงจำนวนนับ, แฮช และ
  พาธ — ไม่เคยมีประโยคข้อความ นี่คือการทำบัญชีที่แสดงหลักฐานการดัดแปลง
  ไม่ใช่การรักษาความปลอดภัยด้วยการเข้ารหัส
- **การ์ดรอบการรัน (run card)**: สิ่งที่ `mt-eval run` บันทึกไว้สำหรับรอบการรันที่ให้คะแนนแล้ว และสิ่งที่
  ผลลัพธ์ที่เผยแพร่ระบุไว้ ดูที่ [ข้อกำหนดการ์ดรอบการรัน](/docs/network/specifications/run-card)

**การล็อก (Lock)** `champollion validate [folder]` จะตรวจสอบไฟล์โปรเจกต์, ทุก sidecar, ทุก `method.json` (ที่รูท, ใน `methods/*/` และ `.champollion/methods/*/`), `gates/*.json` และ `deploy/*.json` เทียบกับสกีมาเหล่านี้ ระบบทดสอบ (harness) จะอ่านไฟล์ชุดเดียวกันพร้อมผลการประเมินเดียวกัน Exit 0 = ไม่มีข้อผิดพลาด, 1 = เอกสารไม่ถูกต้อง, 2 = ข้อผิดพลาดจากการใช้งาน คำสั่งนี้จะเปิดเฉพาะไฟล์ JSON เหล่านี้เท่านั้น และไม่เปิดไฟล์ข้อมูลเลย

`champollion upgrade [folder]` จะเขียน sidecar ที่เขียนขึ้นก่อน set/1 ใหม่ (ที่ไม่มี `$schema`) ให้เป็น set/1 โดยคงค่าเดิมไว้ทั้งหมด (คีย์ที่ set/1 ไม่รู้จักจะถูกย้ายไปอยู่ใต้ `x-<key>`) คำสั่งนี้จะไม่แตะต้อง sidecar ที่ไม่ถูกต้อง และแสดงรายการ `method.json` รุ่นเก่าโดยไม่แก้ไข: เครื่องมือทุกตัวยังคงอ่านไฟล์นั้นได้ในฐานะ method/0 พร้อมคำเตือน

## ไปป์ไลน์เดียว

ทุกรูปแบบที่วิธีประมวลผล (method) ทำงานกับข้อความ ล้วนเป็นไปป์ไลน์เดียวในเอนจินการประเมิน:

1. **รับเข้า (Admit)** ข้อกำหนดของข้อมูลนำเข้าจะถูกอ่าน (sidecar set/1, ข้อมูลห่อหุ้ม JSON, รายการในรีจิสทรี) ตลอดจนนโยบายการส่งผ่านข้อมูลจะได้รับการตรวจสอบและบังคับใช้ก่อนที่จะมีการแปลใดๆ ช่องทางที่นโยบายไม่อนุญาตจะถูกปฏิเสธที่ขั้นตอนนี้ (ดูที่[กฎเกี่ยวกับข้อมูล](/docs/agents/data-rules))
2. **วิธีประมวลผล (Method)** วิธีประมวลผลวิธีหนึ่งทำการแปล (ประเภทของ method/1: `llm`, `llm-coached`, `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`, `human`)
3. **เกต (Gates)** หากมีการระบุสายโซ่เกต (gate chain) แต่ละเซกเมนต์จะได้รับการตัดสิน โดยเกตแรกที่ปฏิเสธจะเป็นตัวตัดสินว่าสิ่งใดจะถูกส่งออกไป (`drop`, `keep-source`, `flag`, `fallback`) ดูที่[วิธีประมวลผลและเกต](/docs/agents/methods)
4. **ผลลัพธ์ (Outputs)** บันทึกการรัน (run log) จะถูกเขียนขึ้น ไฟล์ที่ตัดแบ่งออกมาจากข้อมูลนำเข้าที่มีข้อกำหนดจะนำข้อกำหนดเหล่านั้นติดตัวไปด้วยใน sidecar ที่อยู่เคียงข้าง
5. **เมตริก (Metrics)** เฉพาะเมื่อมีข้อมูลอ้างอิงเท่านั้น: คะแนนหลัก (headline) จะวัดผลสิ่งที่ถูกส่งออกไป โดยมีคะแนนแบบไม่ผ่านเกต (ungated score) วางอยู่เคียงข้าง ดูที่[การวัดผล](/docs/agents/measurement)

โหมดต่างๆ คือไปป์ไลน์เดียวกันนี้ที่ทำงานบนข้อมูลนำเข้าที่ต่างกัน:

| โหมด | คำสั่ง | ข้อมูลนำเข้า | เมตริก |
|---|---|---|---|
| วัดผล | `mt-eval run` (`mt-eval test` ให้คะแนนบันทึกการรันใหม่) | ชุดข้อมูลทดสอบหรือ dev | มี |
| แปลไฟล์ | `mt-eval translate --out <file>` | ภาษาต้นทางเท่านั้น | ไม่มี |
| ให้บริการ (Serve) | `mt-eval serve` | ทีละหนึ่งคำขอ | ไม่มี |

**การดีพลอย (deployment) คือไปป์ไลน์การวัดผลที่ทำงานบนข้อมูลนำเข้าที่มีเฉพาะภาษาต้นทาง** ไฟล์ deployment/1 ไฟล์เดียวจะถูกนำไปทดสอบ (`mt-eval run --deployment`), รันบนไฟล์ (`mt-eval translate --deployment`) และให้บริการ (`mt-eval serve --deployment`) เพื่อให้สิ่งที่ถูกวัดผลเป็นสิ่งเดียวกับที่ปล่อยใช้งานจริง เมื่อใช้ `--deployment` แฟล็กต่างๆ ที่ไฟล์เป็นตัวกำหนด (`--method`, `-m`/`--model`, `--gates`, `--target-script`) จะถูกปฏิเสธ deployment จะไม่ระบุคะแนน: ตัวเลขที่วัดผลได้คือผลลัพธ์ของการรัน ซึ่งจะถูกเก็บไว้กับการรันนั้น ดูที่[การให้บริการ](/docs/agents/serving)

## เส้นทางการทำงานในรูปแบบข้อมูล

ลำดับขั้นตอนการทำงานคือไฟล์: `shared/journeys/language.json` โดยตัวประเมิน `cli/lib/framework/journey.js` คือผู้อ่านเพียงรายเดียว ทั้ง `champollion next`, โปรไฟล์ MCP rails และ `NEXT.md` ต่างถามคำถามเดียวกันกับตัวประเมินนี้ **ขั้นตอนแรกที่ยังไม่เสร็จคือขั้นตอนถัดไป** ตัวประเมินจะอ่านเฉพาะ sidecar, ไฟล์โปรเจกต์ ตลอดจนรีจิสทรีและสมุดบัญชีของ forge — ไม่เคยอ่านข้อความในไฟล์ข้อมูล — และไม่รันคำสั่งใดๆ ยกเว้น `nmt-forge --version` (จำกัดเวลาที่ 30 วินาที) สำหรับขั้นตอนการติดตั้ง และ `nmt-forge status --json` (จำกัดเวลาที่ 60 วินาที) เมื่อขั้นตอนการทำงานไปถึงการฝึกสอน

**ระยะ (Stages)** `start` → `gather` → `protect` → `tools` → `build` → `improve`

**ขั้นตอน (step)** ประกอบด้วย `id`, `stage`, `mode`, ถ้อยคำธรรมดาสำหรับบอกผู้ใช้ (`say`) และเหตุผลว่าทำไมจึงสำคัญ (`why`) และมักจะมี `command` ฟิลด์ที่ไม่บังคับระบุ:

| ฟิลด์ | ความหมาย |
|---|---|
| `done_when` | การตรวจสอบที่ระบุว่าขั้นตอนนี้เสร็จสมบูรณ์แล้ว จำเป็นต้องมี (ยกเว้นในขั้นตอนการมอบหมายงาน) |
| `when` | การตรวจสอบที่ต้องเป็นจริงเพื่อให้ขั้นตอนนี้มีผลบังคับใช้ (dictionary floor จะมีผลก็ต่อเมื่อ `data/lexicon/` มีไฟล์อยู่) |
| `question`, `answers` | คำถามของขั้นตอน `ask_user` และช่องใส่คำตอบ: `{"enum": [...]}` หรือ `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | สิ่งที่เอเจนต์ทำด้วยตัวเองสำหรับขั้นตอนของมนุษย์ (นำไฟล์ที่ระบุเข้ามาด้วย `add_data`) |
| `outdated` | ตัวแปรเสริมที่ใช้เมื่อผลการตรวจสอบพบว่าเครื่องมือเก่าเกินไป |
| `delegate` | `"nmt-forge"`: ส่งมอบหน้าที่ต่อไปยังที่ปรึกษาของ forge เอง |

`{placeholders}` ใน `say`, `question` และ `command` จะถูกเติมข้อมูลจากไฟล์โปรเจกต์และไฟล์ที่พบ

**การตรวจสอบ (Checks)** เป็นชุดแบบปิด โดยตัวประเมินจะแจ้งข้อผิดพลาด (throw) หากพบรายการที่ไม่รู้จัก: `project_valid`, `data_files`, `every_data_file_has_terms`, `protected_test_set`, `tool_on_path` (พร้อม `min_version`), `path_exists`, `forge_test_registered`, `single_file`, `forge_role_registered`, `forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`, `improve_prepared`, `forge_trained_on_current`

**โหมด:**

| โหมด | ใครเป็นผู้กระทำ | สิ่งที่ rails อนุญาต |
|---|---|---|
| `auto` | เอเจนต์ | รันคำสั่ง |
| `confirm` | เอเจนต์ หลังได้รับคำยืนยัน | การติดตั้ง, การฝึกสอน, สิ่งใดก็ตามที่มีค่าใช้จ่ายหรือเผยแพร่; รันหลังจากที่ผู้ใช้ตอบตกลงเท่านั้น |
| `ask_user` | ผู้ใช้เป็นผู้ตอบ | ถาม `question`; ส่งคำตอบของผู้ใช้ตามคีย์ใน `answers`; ห้ามตอบแทนผู้ใช้อย่างเด็ดขาด |
| `wait` | ไม่มีใคร | มีบางอย่างกำลังทำงานอยู่; ให้สอบถามใหม่อีกครั้งในภายหลัง |
| `human_only` | มนุษย์ | รวบรวมประโยค, ทำเครื่องหมายแบบร่าง, เลือก |
| `use_tool` | เอเจนต์ โดยใช้เครื่องมือของตนเอง | เฉพาะ MCP: ขั้นตอน `human_only` ที่มีฟิลด์ `agent` จะแสดงเป็น `use_tool` พร้อม `step.tool` |

**การมอบหมายงาน (Delegation)** ในขั้นตอน `forge` เส้นทางการทำงานจะเรียก `nmt-forge status --json` และใช้สถานะของ forge เป็นขั้นตอน สถานะของ forge จะจับคู่กับโหมดต่างๆ ดังนี้: `training` → `wait`; `ready-to-train` และ `needs-training-extra` → `confirm`; `missing-preregistration` → `ask_user`; `choose-export` → `human_only`; `improve-compare` → `auto`; `improve-promote` → `confirm`; `improve-stronger-model` → `ask_user` สถานะอื่นใดจะเป็น `auto` เมื่อ forge ระบุคำสั่ง และเป็น `human_only` เมื่อไม่ได้ระบุคำสั่ง ทั้งนี้ สถานะ `serving` จะถือเป็นการสิ้นสุดระยะสร้าง (build stage) และเริ่มระยะปรับปรุง (improve stage)

มีขั้นตอนสองประเภทที่มาจากภายนอกรายการขั้นตอน:

- **การตัดสินการคาดการณ์** หลังจากการส่งออกที่ได้รับการประเมินคะแนนบนชุดทดสอบแล้ว การคาดการณ์ที่ผู้คนเขียนขึ้นด้วยถ้อยคำของตนเองจะรอผลการตัดสินจากพวกเขา: ขั้นตอน `ask_user` พร้อม `answers` `verdict` (`held` หรือ `missed`) และ `by` (ใครเป็นผู้ตัดสิน) ซึ่งจะรัน `nmt-forge prereg verdict`
- **การรอข้อตกลงร่วมกัน** ทุกไฟล์ที่ sidecar ระบุว่า `speakers_agreed: not-yet` becomes its own `ask_user` question in `waiting` ซึ่งจะได้รับคำตอบผ่าน id ของขั้นตอนนั้นเองเมื่อใดก็ตามที่ผู้ใช้มีคำตอบ โดยขั้นตอนนี้จะไม่หน่วงการทำงานส่วนอื่นของ rails แต่อย่างใด

**รหัสระบุขั้นตอน (Step id)** คือ `<journey step id>:<8 hex characters>` — ซึ่งเป็นแฮชของขั้นตอนและคำสั่งที่กรอกค่าแล้ว หากโปรเจกต์เปลี่ยนแปลง id ก็จะเปลี่ยนตาม และ `run_next_step` ที่ใช้ id เก่าจะถูกปฏิเสธ (`the project changed since that step was named`)

**สิ่งที่ `champollion next --json` ส่งกลับมา:** `project`, `kind`, `stage` (`n`, `of`, `id`, `title`), `done` (id ของขั้นตอน), `step` (`id`, `mode`, `say`, `why` และหากมี `command`, `question`, `answers`, `agent`, `agent_tool`, `file`, `source`), `now` (ข้อเท็จจริงของ forge — สิ่งที่เป็นจริงในขณะนี้), `waiting`, `forge` (`state`, `blockers`, `warnings`), `finished` (เมื่อไม่มีขั้นตอนเหลืออยู่) และ `error` โดยจะ Exit 1 เมื่อเกิดข้อผิดพลาดและไม่มีขั้นตอน

## รูปแบบการปฏิเสธ

การปฏิเสธทุกครั้งจะบอกว่าเกิดอะไรขึ้น และส่วนใหญ่จะบอกเหตุผลพร้อมวิธีแก้ไข

| เครื่องมือ | ผลลัพธ์สำหรับมนุษย์ | ผลลัพธ์สำหรับเครื่อง | Exit |
|---|---|---|---|
| `nmt-forge` | `[guard] message` ตามด้วย `  why: …` และ `  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` บน stdout | 2 ถูกปฏิเสธ (refused) |
| `champollion` | `[ERR] message` บน stderr | `--json` ในคำสั่งที่รองรับ | 1 ถูกปฏิเสธ (refused), 2 การใช้งานผิดพลาด (usage) |
| เครื่องมือ MCP rails | — | `{"refused": "<reason>", …}` พร้อม `isError: true` รวมถึงคำสั่งลองใหม่หากมี (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

`type` ในข้อผิดพลาดของ forge คือคลาสข้อยกเว้น (`UsageError` สำหรับอาร์กิวเมนต์
ที่ไม่ถูกต้อง — forge ปฏิเสธแฟล็กแบบย่อแทนที่จะคาดเดา) ชื่อการควบคุม (guard) ของ forge
รวมถึง `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` และ `disk-room` (รอบการเทรน
ที่ดิสก์ไม่สามารถจุได้) เมื่อเกิดข้อผิดพลาดที่
อาจต้องยกข้อความประโยคของคลังข้อมูลที่ถูกระงับไว้ ประโยคนั้นจะแสดงเป็น
`[sentence withheld]` และออบเจกต์จะเพิ่ม `text_withheld` เข้ามา

ส่งต่อข้อความปฏิเสธด้วยถ้อยคำที่เข้าใจง่ายและปฏิบัติตามวิธีแก้ไข หรือสอบถามขั้นตอนถัดไปอีกครั้ง ทั้งนี้ขั้นตอนที่ล้มเหลวสองครั้งจะไม่ถูกรันซ้ำจนกว่าผู้ใช้จะตัดสินใจ ([MCP](/docs/agents/mcp#when-a-step-fails))

## ศึกษาเพิ่มเติม

- [สัญญาการทำงาน](/docs/agents/contract) — กฎ, การล็อก และข้อควรทราบ
- [การขับเคลื่อน rails ผ่าน MCP](/docs/agents/mcp) และ[จากเชลล์](/docs/agents/shell)
- [กฎเกี่ยวกับข้อมูลและการส่งผ่าน](/docs/agents/data-rules) — set/1 ฉบับเต็ม
- [วิธีประมวลผลและเกต](/docs/agents/methods) และ[การให้บริการ](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1
- [ข้อกำหนด run card](/docs/network/specifications/run-card) และ[ข้อกำหนด harness](/docs/network/specifications/harness)
- [ข้อมูลอ้างอิงคำสั่ง `mt-eval`](/docs/reference/mt-eval) และ[ข้อมูลอ้างอิงคำสั่ง `nmt-forge`](/docs/network/getting-started/forge-command-reference)
