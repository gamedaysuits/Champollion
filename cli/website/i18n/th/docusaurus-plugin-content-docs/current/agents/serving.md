---
title: "การให้บริการและการนำไปใช้งาน"
slug: /agents/serving
description: "นำโมเดลที่ผ่านการวัดผลแล้วไปใช้งาน: ไฟล์ deployment/1 ที่ nmt-forge export สร้างขึ้น, mt-eval translate และ serve, nmt-forge serve และหน้าทดลองใช้งาน, ข้อกำหนด service-api/1 /translate, champollion connect และ champollion sync ที่ขับเคลื่อนโดยเอเจนต์ — พร้อมทั้งสิ่งที่เอาต์พุตแบบเฉพาะภายในเครื่องทำได้และทำไม่ได้"
---

# การให้บริการและการปรับใช้

**การปรับใช้คือไปป์ไลน์การวัดผลบนข้อมูลนำเข้าเฉพาะต้นทาง** ไฟล์
deployment/1 หนึ่งไฟล์จะระบุวิธี โมเดล เกต และคู่ภาษา ไฟล์
เดียวกันนี้ใช้ทดสอบกับชุดทดสอบ เรียกใช้กับไฟล์ และให้บริการ ดังนั้นสิ่งที่
วัดผลจึงเป็นสิ่งที่ส่งมอบ หน้านี้เป็นส่วนของเอเจนต์คู่กับ
[นำไปใช้งานจริง](/docs/put-it-to-work)

ตลอดทั้งเนื้อหา: โมเดลที่เรียนรู้จากประโยคที่ทำเครื่องหมายว่า local-only อาจพูดซ้ำ
ประโยคเหล่านั้นได้ ดังนั้น**ผลลัพธ์ของมันจึงเป็น local-only เช่นกัน** เครื่องมือทุกตัวด้านล่างนี้จะเก็บผลลัพธ์นั้น
ไว้บนคอมพิวเตอร์เครื่องนี้ เว้นแต่ผู้ถือครองข้อมูลจะตกลงเป็นอย่างอื่น และ
`--holders-agreed-by` จะบันทึกว่าใครเป็นผู้ตกลง **หมายเหตุ** ส่งแฟล็กนั้นเฉพาะเมื่อ
ระบุชื่อที่บุคคลนั้นให้คุณมา หลังจากที่พวกเขาระบุว่าผู้ถือครองข้อมูลยินยอมแล้วเท่านั้น

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json` จำเป็นต้องระบุ: `id`,
`pair` (`source`, `target`, ไม่บังคับ `target_script`), `method` (`method`,
ไม่บังคับ `model`) ตัวเลือกเพิ่มเติม: `gates` (ไฟล์ gate-chain/1) และ `serve`
(`host`, ค่าเริ่มต้น `127.0.0.1`; `port`) เส้นทางเป็นแบบสัมพัทธ์กับรากของโปรเจกต์
ซึ่งเป็นที่ที่ rails สั่งรันคำสั่ง ไฟล์นี้ไม่ได้ระบุคะแนนใดๆ

**ใครเป็นผู้เขียน** `nmt-forge export` เมื่อการส่งออก (export) อยู่ภายในโปรเจกต์
rails (มี `champollion.project.json` อยู่ข้างบน) จะเขียน
`deploy/<name>.json` — `<name>` คือ `--name` ในรูปแบบ kebab case มิฉะนั้นจะเป็น
`nmt-forge-<run>`:

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

มันจะไม่เขียนเลย (และแจ้งว่า `no deployment file: …`) เมื่อการส่งออกอยู่นอก
โปรเจกต์ rails, เมื่อโมเดลได้รับการคัดเลือกภายใต้ decode hook (มีเพียง
`nmt-forge serve` เท่านั้นที่รันฮุกของ forge), เมื่อการกำหนดค่าไม่ได้ระบุคู่ภาษา, เมื่อ
เอกสารไม่ผ่านการตรวจสอบความถูกต้อง, หรือเมื่อ `deploy/<name>.json` มีการปรับใช้
โมเดลอื่นอยู่แล้ว (ไม่มีการแทนที่)

**ใครเป็นผู้อ่าน**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**การล็อก** เมื่อใช้ `--deployment` แล้ว `run` และ `translate` จะปฏิเสธ `--method`,
`-m`/`--model`, `--gates` และ `--target-script` (*"--deployment … says the
method, its model, its gates and the target script; drop … (or change the
file)"*); `serve` ยังปฏิเสธ `--pair` อีกด้วย ข้อมูลนำเข้าในคู่ภาษาอื่นจะถูกปฏิเสธ
(`deployment <id> translates from <src>; this input is in <x>`) การ
ปรับใช้ที่ gate chain มีการย้อนกลับ (fall back) สามารถแปลและให้บริการได้ แต่
วัดผลไม่ได้: `mt-eval run` ปฏิเสธ chain ที่มีการย้อนกลับ
([วิธีและเกต](/docs/agents/methods#gate-chains))

## สิ่งที่การส่งออก (export) บรรจุไว้

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` เขียน:

| เส้นทาง | รายละเอียด |
|---|---|
| `<dir>/model/` | โฟลเดอร์ที่จะปรับใช้: weights และ tokenizer, `forge-model.json` (สิ่งที่มันได้รับการฝึกฝนมา, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, ชนิด `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (พอร์ต 8378 เว้นแต่ `--port`), `card.commercial_ready: false`, `evidence` พร้อม chrF++ ของชุดทดสอบ ช่วงความเชื่อมั่น และ n |
| `<dir>/evaluation/` | หลักฐานของชุดทดสอบ อย่าคัดลอกไปพร้อมกับโมเดลเด็ดขาด |
| `<dir>/input-words.json` | คำต่างๆ จากฝั่งข้อมูลนำเข้าของประโยคฝึกสอน อย่างละหนึ่งคำ จัดเรียงลำดับแล้ว (`words`, `english`, `sentences`, `from` และ `notes` ที่ระบุไฟล์ฝึกสอนซึ่งไม่สามารถอ่านได้แบบที่การรันอ่าน) อยู่ข้างๆ `model/` ไม่เคยอยู่ข้างในนั้น: คำเหล่านี้คือคำจากข้อมูลของชุมชน จะถูกเขียนเมื่อการส่งออกรวมโมเดลไว้และไฟล์ฝึกสอนของโมเดลอยู่บนคอมพิวเตอร์เครื่องนี้ มิฉะนั้นสรุปของการส่งออกจะระบุว่า `input_words.written: false` พร้อมด้วย `why`; `nmt-forge serve` จะอ่านไฟล์นี้เพื่อระบุคำที่โมเดลไม่เคยพบ ([ด้านล่าง](#words-the-model-never-saw)) |
| `<dir>/README.md` | ข้อมูลว่าการส่งออกนี้คืออะไร |

## `mt-eval translate`

ไปป์ไลน์ที่ทำงานกับไฟล์ โดยไม่มีการให้คะแนน `--out` รับ `.jsonl` (หนึ่งแถวต่อ
หนึ่งเซกเมนต์: `id`, `source`, `output`, `error` และเมื่อมีเกตจะมี `gates`,
`shipped_from`, `fallback`) หรือ `.tsv` (ต้นทาง, แท็บ, ผลลัพธ์) หากไม่มี `--out`
มันจะเขียน `<run id>.translations.jsonl` ในโฟลเดอร์ผลลัพธ์ (`-o`)
ผลลัพธ์จะนำพาข้อกำหนดของข้อมูลนำเข้า — รวมถึงของโมเดลด้วย — ไว้ในไซด์คาร์ set/1

**การล็อก** เมื่อผลลัพธ์ของวิธีเป็นแบบ local-only (หรือการย้อนกลับของ
gate chain เป็นแบบนั้น) ปลายทางที่อยู่นอกโปรเจกต์จะถูกปฏิเสธก่อนที่จะมี
การแปลใดๆ: *"refusing to write …: what this method writes is local-only
(…), and that is outside … — a place the data's holders did not choose. Only
they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or
write it inside the project"* เมื่อมีความยินยอมแล้ว ไซด์คาร์จะบันทึก
`holders_agreed: {by, date}`; ไฟล์จะยังคงเป็น local-only สำหรับทุกเครื่องมือ

`--json` จะพิมพ์ `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` และ `output_gates` ออกด้วย Exit 1 เมื่อทุกแถวล้มเหลว `--publish`
จะถูกปฏิเสธ: เนื่องจากไม่มีคะแนน

## `mt-eval serve`

| | |
|---|---|
| ที่อยู่เริ่มต้น | `127.0.0.1:8379` (`--host`, `--port` หรือบล็อก `serve` ของการปรับใช้) |
| สิ่งที่ให้บริการ | เฉพาะวิธีที่รันในโปรเซสนี้เท่านั้น: `lexicon`, `local-model` หรือปลั๊กอินที่ method.json ประกาศ `dependency_class` `S` หรือ `O` ทั้งนี้ LLM หรือเอนจินแบบโฮสต์จะถูกปฏิเสธ |
| โทเค็น | `MT_EVAL_SERVE_TOKEN` จากตัวแปรสภาพแวดล้อมเท่านั้น จำเป็นต้องมีเพื่อรับฟัง (listen) บนที่อยู่อื่นใดนอกเหนือจาก `127.0.0.1`, `::1` หรือ `localhost` และเมื่อตั้งค่าแล้ว จะต้องมีในทุกๆ `POST` (รวมถึง loopback ด้วย) ส่วน `GET /health` ไม่จำเป็นต้องใช้เลย |
| ขีดจำกัด | บอดีขนาด 1,000,000 ไบต์, 500 คีย์, สตริงละ 20,000 อักขระ — หากเกินกว่านี้ข้อใดข้อหนึ่งจะส่งผลเป็น `413` |
| เกต | `--gates <chain>` (หรือ `gates` ของการปรับใช้) ปลั๊กอินของทุกเกตจะต้องประเมินได้โดยไม่ต้องมีข้อมูลอ้างอิง มิฉะนั้นจะไม่เริ่มทำงาน อนุญาตให้มีการย้อนกลับ (fallback) ได้ที่นี่ และต้องรันในโปรเซสนี้ |

**การล็อก — นอก loopback** หากไม่มีโทเค็น: *"refusing to listen on … without a
token — anyone who can reach the port could use the method"* เมื่อมีผลลัพธ์แบบ
local-only และไม่มีความยินยอม: *"refusing to serve on …: what this method writes is
local-only (…), and an address other machines can reach sends it off this
one. Only the data's holders can agree to that — ask them; if they do:
--holders-agreed-by "<who agreed>" (reported on /health), or keep --host
127.0.0.1"* ผลลัพธ์จะเป็น local-only เมื่อไซด์คาร์ของพจนานุกรมระบุไว้เช่นนั้น (หรือ
ไม่สามารถอ่านได้) หรือ `forge-model.json` ของโฟลเดอร์โมเดลบันทึกข้อกำหนดการฝึกสอน
แบบ local-only หรือไม่ได้บันทึกไว้เลย; และจะถูกรายงานว่าไม่ทราบ (`null`) สำหรับ
ปลั๊กอินหรือโฟลเดอร์โมเดลที่ไม่มี `forge-model.json`

`/health` ตอบกลับ `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (ในโปรเซสนี้ — ไม่มีการส่งข้อมูลไปที่ใด), `scored`
(ไม่มีอะไร), `output_gates` และ `gates` (chain id, fingerprint, เกต, การย้อนกลับ),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (ที่เก็บโค้ด) และ `version`

เมื่อมีเกต เซกเมนต์ที่ถูกปฏิเสธจะถูกส่งกลับตามที่เกตระบุ: `drop` — คีย์
ภายใต้ `errors`; `keep-source` — ต้นทาง; `flag` — ผลลัพธ์ ซึ่งเป็นคีย์
ที่ระบุใน `meta.gates.flagged`; `fallback` — คำแปลจากการย้อนกลับหาก
เกตยอมรับ หากไม่มีเกต ระบบจะไม่ตรวจสอบสิ่งที่ส่งกลับคืนเลย

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| ที่อยู่เริ่มต้น | `127.0.0.1`, พอร์ต `NMT_FORGE_SERVE_PORT` หรือ 8378 |
| โทเค็น | `--token` หรือ `NMT_FORGE_SERVE_TOKEN` จำเป็นต้องใช้เมื่ออยู่นอก loopback ทั้งนี้ `--detach` จะรับจากตัวแปรสภาพแวดล้อมเท่านั้น |
| เส้นทาง (Routes) | `GET /` — หน้าทดลองใช้งานสำหรับผู้ใช้ (ไม่ต้องใช้โทเค็น โดยจะถามหาโทเค็นเมื่อมีการตั้งค่าไว้); `GET /health`; `POST /translate` (service-api/1); `POST /v1/chat/completions` (เข้ากันได้กับ OpenAI); `GET /v1/models` |
| `--detach` | จะส่งกลับเมื่อ `/health` ตอบกลับ; จะหยุดการทำงานหากไม่ตอบกลับภายใน 120 วินาที จะถูกปฏิเสธเมื่อพอร์ตมีการตอบกลับอยู่แล้ว |
| `--no-hook` | ให้บริการโดยไม่มี decode hook ของการรัน (ระบุไว้บน `/health` และใน `meta`) |
| `--allow-locale` | ยอมรับรหัสโลแคลเหล่านี้เพิ่มเติมด้วย (ระบุซ้ำได้) |
| `--device` | `auto` (ค่าเริ่มต้น) หรือ `cpu` เมื่อใช้ `auto` เซิร์ฟเวอร์ที่เริ่มทำงานขณะที่งานฝึกสอนของโปรเจกต์เดียวกันกำลังรันอยู่จะเปลี่ยนไปใช้ CPU แทนที่จะแชร์ GPU และ `/health` จะระบุไว้เช่นนั้น (`device_note`) |
| ขีดจำกัด | บอดีขนาด 1,000,000 ไบต์, 500 คีย์, สตริงละ 20,000 อักขระ, งานประมวลผลโมเดล 5,000 ชิ้นต่อหนึ่งคำขอ — หากเกินกว่านี้ข้อใดข้อหนึ่งจะเป็น `413` โมเดลจะได้รับการร้องขอครั้งละ 32 ชิ้น เพื่อให้ประโยคจากคำขออื่นรอเพียงช่วงสั้นๆ หนึ่งช่วง ไม่ต้องรอคำขอทั้งหมด คำขอที่ยังคงทำงานอยู่หลังจาก 600 วินาทีจะถูกปฏิเสธทั้งหมด — `503`, *"send fewer pieces at a time"* — จะไม่มีการตอบกลับเพียงบางส่วน |
| การถอดรหัส (Decoding) | Beam search ร่วมกับ `num_beams` ของการส่งออกเมื่อการส่งออกบันทึก `beams_applied` ไว้ (ตามที่โมเดลได้รับการวัดผล); หรือ greedy สำหรับการส่งออกรุ่นเก่า ข้อความที่ส่งจะได้รับการแปลงให้เป็นมาตรฐานแบบ NFC เช่นเดียวกับข้อมูลฝึกสอน |

**การล็อก** เมื่ออยู่นอก loopback โมเดลที่มีผลลัพธ์เป็น local-only — ซึ่งฝึกสอนด้วย
ประโยคที่เป็น local-only หรือไม่มีบันทึกว่าเรียนรู้มาจากอะไร — จะถูกปฏิเสธ
หากไม่มี `--holders-agreed-by` โดย `/health` จะรายงาน `pair`, `accepts`,
`decode_hook`, `run`, รายงาน dev และ test, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` และ `output_gates` ทุกคำตอบ `/translate` จาก
โมเดลที่เป็น local-only จะแนบ `meta.output_local_only: true` มาด้วย และทุก
การตอบกลับ `/v1/chat/completions` จะแนบ `meta.output_local_only` (true หรือ false)
เมื่อขีดจำกัดความยาวตัดทอนสิ่งใดในคำขอ `meta.cut` ของคำขอนั้นจะนับ
ประโยคที่ถูกตัดทอนตอนนำเข้า (`inputs`) และคำแปลที่หยุดลงเมื่อถึง
ขีดจำกัดสูงสุด (`outputs`) ([การฝึกสอน](/docs/agents/training#the-guarded-loop))

**หมายเหตุ** หน้าทดลองใช้งานมีไว้สำหรับบุคคล `try_translation` (MCP) จะส่งพวกเขา
ไปที่นั่นสำหรับโมเดลที่เป็น local-only อย่าเรียก `/translate` ด้วยตัวคุณเองเพื่ออ่าน
ผลลัพธ์ของมันเด็ดขาด ([ข้อตกลง](/docs/agents/contract) §1)

### คำที่โมเดลไม่เคยพบ

ประโยคที่มีคำซึ่งโมเดลไม่เคยพบในการฝึกสอนมีโอกาส
แปลผิดสูงมาก ไม่ว่าจะอ่านดูสละสลวยเพียงใดก็ตาม ในภาษาทดสอบที่สร้างขึ้น ประโยค
ชุดทดสอบที่มีคำเนื้อหาซึ่งโมเดลไม่เคยพบ ได้รับการแปล
ถูกต้อง 0 ครั้งจาก 358 ครั้ง (ByT5-small ที่คู่ฝึกสอน 1,600, 6,400 และ 25,600 คู่)
และให้ผลลัพธ์ที่ผิดอย่างมั่นใจ — สละสลวย ทุกคำเป็นรูปคำที่มีอยู่จริง แต่ความหมาย
ผิด — ถึง 32%, 55% และ 83% ของจำนวนครั้ง: ยิ่งโมเดลดีเท่าไร การคาดเดาก็ยิ่งดู
น่าเชื่อถือมากขึ้นเท่านั้น เซิร์ฟเวอร์จึงระบุชื่อคำเหล่านั้นออกมา

- **`/health`** ระบุว่าสามารถทำได้หรือไม่: `unseen_words_check` คือ `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`
- **`/translate`** จะเพิ่ม `meta.unseen_words` (คีย์ → คำในข้อความของคีย์นั้นที่โมเดล
  ไม่เคยพบ อย่างละหนึ่งคำตามลำดับ) และ `meta.unseen_note` เฉพาะเมื่อคำขอมีคำดังกล่าวเท่านั้น **`/v1/chat/completions`**
  จะเพิ่มข้อมูลแบบเดียวกัน โดยใช้คีย์ตามสิ่งที่ได้รับการร้องขอ: `SEG_<id>` ต่อเซกเมนต์ในโหมด
  บล็อก, `page` สำหรับหน้าเว็บ, คีย์ของออบเจกต์ JSON เอง หรือ `text`
- **ไม่มีบันทึก โดยจะแจ้งในทุกการตอบกลับ** เซิร์ฟเวอร์จะอ่าน `input-words.json`
  จากโฟลเดอร์ที่อยู่เหนือโฟลเดอร์โมเดลที่มันให้บริการ หากไม่มีไฟล์อยู่ที่นั่น — บนคอมพิวเตอร์
  export made before 2026-10-13, one made without its training files on this
  หรือโฟลเดอร์โมเดลถูกคัดลอกแยกออกไปจากการส่งออกของมัน — `meta.unseen_check`
  ของทุกการตอบกลับจะระบุว่าไม่สามารถตรวจสอบได้ และเพราะเหตุใด ให้บริการโมเดลจาก
  export, or export it again.
- **หน้าทดลองใช้งาน** จะทำเครื่องหมายที่บรรทัดนั้น: *"Never seen in training: … — this line is
  very likely wrong, however fluent it reads."*

คำคือลำดับตัวอักษรติดต่อกันในชุดอักษรใดๆ (คงเครื่องหมายอะโพสทรอฟีที่อยู่ภายในไว้)
แปลงเป็นตัวพิมพ์เล็ก ในรูปแบบ NFC เมื่อฝั่งข้อมูลนำเข้าเป็นภาษาอังกฤษ คำลงท้ายภาษาอังกฤษทั่วไป
จะถือว่าเคยพบไม่ว่าจะอยู่ในรูปใด (พบ `walk` → ถือว่าพบ `walked`; พบ `walked`
→ ถือว่าพบ `walk`)

## service-api/1 — ข้อตกลงของ `/translate`

`$schema` `https://champollion.dev/schemas/service-api/1.json` ซึ่งต้องเป็นไปตาม
`shared/test-fixtures/framework/service-api-vectors.json` (รันตรวจสอบกับ
`mt-eval serve` และ `nmt-forge serve`)

- **คำขอ (Request)** `POST /translate`: `keys` (คีย์ → สตริงต้นทาง; จำเป็นต้องระบุ),
  ตัวเลือกเพิ่มเติม `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` สำหรับข้อความเอกสาร), `instructions` (คีย์ → บันทึกช่วยจำ; ส่งไปยัง
  เซิร์ฟเวอร์ที่ประกาศว่าปฏิบัติตามเท่านั้น, `accepts_instructions`) ฟิลด์ที่เซิร์ฟเวอร์
  ไม่ได้ใช้จะถูกละเว้น ไม่มีการปฏิเสธ
- **การตอบกลับ (Response):** `200` `{translations, meta}` — จำเป็นต้องมี `meta`; `207` เพิ่ม
  `errors` (คีย์ → `{message}`) ข้อผิดพลาดจะเป็น `{error: {message}}`: `400` สำหรับ
  คำขอที่ไม่สามารถรับได้, `401` โทเค็นขาดหายหรือไม่ถูกต้อง, `404` เส้นทางที่ไม่รู้จัก,
  `413` ขนาดใหญ่เกินไป, `500` วิธีการทำงานล้มเหลว — จะไม่มีการตอบกลับเพียงบางส่วน
  (`nmt-forge serve` ยังตอบกลับ `503` สำหรับคำขอที่เกินขีดจำกัด 600 วินาทีด้วย)
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false หรือ null), `cost_usd`; เซิร์ฟเวอร์อาจเพิ่มฟิลด์อื่นได้
- **`GET /health`** จำเป็นต้องมี `status` (`ok`), `pair`, `output_gates` และ
  `output_local_only`; ตัวเลือกเพิ่มเติม `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`
- **กฎเกณฑ์:** เซิร์ฟเวอร์ที่ `/health` ระบุว่า `output_local_only: true` จะต้องใส่
  `output_local_only: true` ไว้ใน `meta` ของทุกการตอบกลับ และไคลเอนต์จะเขียน
  ผลลัพธ์ดังกล่าวเฉพาะในที่ที่ผู้ถือครองข้อมูลยินยอมแล้วเท่านั้น

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

คำสั่งนี้จะค้นหา `method.json` (ไฟล์ตามชื่อที่ระบุ หรือ `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` ใน
โฟลเดอร์), ติดตั้งลงใน `.champollion/methods/` ของแอป และชี้
แต่ละคู่ภาษาของแอป (`<inputLocale>:<target>`) ไปที่ไฟล์นั้นในฐานะ `methodPlugin` โดยคง
ส่วนที่เหลือของคู่ภาษาไว้ โฟลเดอร์แอปจำเป็นต้องมี `champollion.config.json` และ
วิธีดังกล่าวจะต้องแปลจาก `inputLocale` ของแอป

**การล็อก** โมเดลที่ผลลัพธ์เป็น local-only — ซึ่งทราบได้จาก
`forge-model.json` ของโมเดล (การไม่มีไฟล์ก็นับด้วยเช่นกัน) หรือจาก `/health` ของเซอร์วิส —
จะถูกปฏิเสธหากไม่มี `--holders-agreed-by`: เนื่องจากสิ่งที่เขียนลงในไฟล์
โลแคลของแอปจะถูกเผยแพร่ไปพร้อมกับแอป เมื่อระบุแฟล็กนี้ แต่ละคู่ภาษาจะบันทึก
`holdersAgreed: {by, date, method, what}` ระบบจะแจ้งเตือนโดยไม่ล้มเหลว เมื่อ
ไม่มีการตอบกลับที่ปลายทาง endpoint (`nmt-forge serve <dir> --detach` จะเป็นตัวเริ่มทำงาน)
หรือเมื่อ `/health` ไม่ปฏิบัติตาม service-api/1 ทั้งนี้ `--json` จะพิมพ์ `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`

## `champollion sync` ขับเคลื่อนโดยเอเจนต์

`sync` แปลไฟล์โลแคลของแอปหรือไซต์ด้วยวิธีที่ระบุไว้ใน
`champollion.config.json` โดยไม่มีการถามข้อมูลแบบโต้ตอบ

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**ผลลัพธ์ของ `--json`** จะเป็นออบเจกต์ JSON หนึ่งรายการต่อบรรทัด ทาง stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` พร้อม
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` และอื่นๆ; การทดลองรัน (dry run) จะเพิ่ม `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) และ `maxCost` ส่วนทาง stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` และ
`error`

| สถานะออก (Exit) | ความหมาย |
|---|---|
| 0 | เรียบร้อยดี |
| 1 | ชื่อ `--redo` หรือ `--force-keys` ไม่ตรงกับคีย์ใดๆ; ล้มเหลวโดยไม่มีการประมวลผลสิ่งใด; เกิดข้อผิดพลาด |
| 2 | `--max-cost` สั่งหยุดก่อนที่จะมีการเรียกใดๆ (หรือการประเมินไม่เป็นที่ทราบ); หรือสำเร็จบางส่วน: มีบางอย่างล้มเหลว, คีย์ถูกระงับไว้, รูปพหูพจน์ขาดหาย, หรือการตรวจสอบ (verify) พบข้อผิดพลาด |

การทดลองรัน (dry run) จะไม่ส่งและไม่เขียนสิ่งใด ไม่ทำการตรวจสอบ และออกด้วยสถานะ 0 เว้นแต่
คีย์ที่ระบุจะไม่ตรงกับสิ่งใดหรือมีข้อผิดพลาดเกิดขึ้น การตรวจสอบ (Verify) จะรันหลังจากการซิงค์จริง
เว้นแต่จะระบุ `--no-verify`

**การล็อก — คำตอบที่เป็น local-only** สำหรับวิธี `api` ชุดข้อมูลที่
`meta.output_local_only` เป็น `true` จะไม่ถูกเขียน เว้นแต่ `holdersAgreed`
ของคู่ภาษานั้นจะระบุชื่อวิธีดังกล่าว; `sync` จะแจ้งเตือนเช่นนี้หนึ่งครั้ง และระบุการเรียก
`champollion connect … --holders-agreed-by` คีย์เหล่านั้นจะยังคง
ไม่ได้รับการแปล (หรือส่งต่อไปยังการย้อนกลับของคู่ภาษานั้น)

**การล็อก — วิธี `local`** วิธี `local` (endpoint ที่เข้ากันได้กับ OpenAI)
จะสอบถาม `/health` ของเซิร์ฟเวอร์หนึ่งครั้ง เมื่อระบุว่า
`output_local_only: true` — เหมือนที่ `nmt-forge serve` ทำสำหรับโมเดลที่ฝึกสอนด้วย
ประโยคที่เป็น local-only — จะไม่มีการเขียนสิ่งใดจากเซิร์ฟเวอร์นั้น เว้นแต่ `holdersAgreed`
ของคู่ภาษาจะระบุ `local`: *"the model at … says what it writes is
local-only … nothing from it was written"* ตามด้วยการเรียก
`champollion connect <the model> --holders-agreed-by "<who agreed>"` เซิร์ฟเวอร์ที่
`/health` ไม่ตอบกลับหรือไม่ระบุว่า `true` (เช่น เซิร์ฟเวอร์ Ollama หรือ
LM Studio) จะถูกใช้งานตามเดิม

**หมายเหตุ** เชื่อมต่อโมเดล forge ด้วย `champollion connect` (เส้นทาง `api`):
คำสั่งนี้จะอ่านบันทึกของตัวโมเดลเองว่าเรียนรู้มาจากอะไร และบันทึก
ความยินยอมของผู้ถือครองข้อมูลลงบนคู่ภาษาภายใต้วิธีที่ติดตั้ง

**คำที่โมเดลไม่เคยพบ** เมื่อเซิร์ฟเวอร์ forge ระบุคีย์ใน
`meta.unseen_words` วิธี `local` และ `api` จะแจ้งเตือนด้วยคีย์เหล่านั้น —
โดยไม่แสดงข้อความหรือคำศัพท์เลย: *"<API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys>"* (จากนั้นตามด้วย *"and <n> more"*)
คำแปลจะยังคงถูกเขียนลงไป คำเตือนนี้เป็นวิธีที่ช่วยให้คนในชุมชนทราบว่าต้อง
ตรวจสอบรายการใด ([การแนะแนว](/docs/agents/coaching))

**หมายเหตุ** ส่งต่อทุกบรรทัดของ `warn` สตริงที่แปลด้วยเครื่องถือเป็นเพียงฉบับร่าง
จนกว่าผู้พูดภาษานั้นจะตรวจทาน อย่าเรียกสตริงเหล่านั้นว่าถูกต้องเด็ดขาด

## `champollion serve`

เซิร์ฟเวอร์ที่ต่างออกไป: ทำหน้าที่ให้บริการสแตกการแปลที่กำหนดค่าไว้ของ**โปรเจกต์แอป**เอง
(วิธี, การแนะแนว, หน่วยความจำการแปล, เกตวัดคุณภาพ) ไปยัง
โปรเจกต์อื่นๆ ค่าเริ่มต้นคือ `127.0.0.1`, พอร์ต 1822 จำเป็นต้องมี bearer token
แม้จะอยู่บน loopback (`--token` หรือ `CHAMPOLLION_SERVE_TOKEN` อย่างน้อย 12
อักขระ) เว้นแต่จะใช้ `--no-auth` ซึ่งยอมรับเฉพาะบนการผูกกับ loopback เท่านั้น
`--emit-manifest` จะเขียนไฟล์กำกับ method/1 ชนิด `service` ให้แก่ผู้ใช้
`/health` ของมันคือ `{ok, service, version}` ไม่ใช่เอกสารสถานะของ
service-api/1 ดังนั้น `champollion connect` จึงรายงานปัญหาด้านสถานะการทำงานสำหรับเซิร์ฟเวอร์นี้

## ศึกษาเพิ่มเติม

- [นำไปใช้งานจริง](/docs/put-it-to-work) — เวอร์ชันสำหรับทุกคน
- [วิธีและเกต](/docs/agents/methods) — method/1 และ gate-chain/1
- [กฎของข้อมูลและการส่งผ่าน](/docs/agents/data-rules) — local-only และ
  `holders_agreed`
- [โมเดลราง](/docs/agents/rails-model) — ไปป์ไลน์หนึ่งเดียว
- [ข้อมูลอ้างอิง `mt-eval`](/docs/reference/mt-eval) และ
  [ข้อมูลอ้างอิง `nmt-forge`](/docs/network/getting-started/forge-command-reference)
- การแปลแอปและไซต์: [CI/CD](/docs/guides/ci-cd),
  [การแก้ไขปัญหา](/docs/guides/troubleshooting)
