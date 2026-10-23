---
title: "การจัดแบบทดสอบแบบปิดผนึก และการเข้าร่วมโปรเจกต์"
slug: /agents/hosting-and-joining
description: "สองวิธีในการมีส่วนร่วมนอกเหนือจากการสร้าง: จัดแบบทดสอบแบบปิดผนึกด้วย mt-eval contest และ mt-eval node (ใช้งานได้แล้ว ยังไม่ได้อยู่บน rails และผู้ดูแลที่ผู้จัดเลือกไว้จะเป็นผู้ถือส่วนแบ่งคีย์) และเข้าร่วมโปรเจกต์ที่ลงทะเบียนไว้ด้วย mt-eval project — ทุกคำสั่ง ส่งอะไรไปที่ไหน และสิ่งใดที่จะไม่มีวันแสดงออกมา"
---

# การจัดชุดทดสอบแบบปิดผนึกและการเข้าร่วมโครงการ

สองเส้นทางเคียงข้างรางการสร้าง ทั้งสองเป็นคำสั่ง `mt-eval` ทั่วไป และไม่มีคำสั่งใดที่เป็นขั้นตอนที่ `champollion next` ระบุชื่อ

## การจัดชุดทดสอบแบบปิดผนึก

**สถานะตามความเป็นจริง**

- ใช้งานได้จริง: การเตรียมชุดข้อมูลแบบปิดผนึก พิธีกรรมกุญแจ การรันผลงานที่ส่งเข้าประกวดบนโหนดแบบแอร์แก็ป คำตัดสิน และการจัดอันดับ ล้วนเป็นคำสั่งที่มีการทดสอบรองรับ
- **ระบบนี้ยังไม่ได้อยู่บนราง** `champollion new --kind task` จะถูกปฏิเสธ เส้นทางเดียวที่มีคือเส้นทางของภาษา เตรียมพบกับขั้นตอนแบบดำเนินการเองที่ยาวนานกว่า และโปรดทำตาม [คู่มือปฏิบัติการการแข่งขัน](/docs/network/sovereignty/run-a-sovereign-contest)
- **ส่วนแบ่งกุญแจจะถูกถือครองโดยผู้ดูแลผลประโยชน์ที่ผู้จัดงานระบุชื่อ** ไม่มีส่วนใดในโค้ดที่แต่งตั้งหรือตรวจสอบพวกเขา ยังไม่มีการแต่งตั้งผู้ดูแลกุญแจของชุมชนสำหรับการทดสอบใด ๆ
- **Champollion ไม่ได้ถือครองส่วนแบ่งกุญแจหรือกุญแจส่วนตัวใด ๆ** พิธีกรรมจะทำงานบนเครื่องของผู้จัดงาน และการลงทะเบียนจะส่งเพียงตัวระบุ ค่าไดเจสต์ และเกณฑ์การคัดเลือกเท่านั้น — จะไม่มีการส่งกุญแจ ส่วนแบ่งกุญแจ หรือประโยคข้อความโดยเด็ดขาด

**หมายเหตุ** การจัดทดสอบเป็นตัวกำหนดว่าจะเกิดอะไรขึ้นกับประโยคของผู้คน และใครสามารถปลดล็อกประโยคเหล่านั้นได้ ทุกขั้นตอนด้านล่างนี้ขึ้นอยู่กับการตัดสินใจของผู้จัดงาน โปรดเรียกใช้แต่ละขั้นตอนเมื่อพวกเขาขอให้ทำเท่านั้น

### สิ่งที่จะถูกสร้างขึ้น

`mt-eval contest prepare` จะแบ่งคลังข้อมูลของผู้จัดงาน:

| แฟล็ก | ชุดข้อมูล | ใครมองเห็นได้บ้าง |
|---|---|---|
| `--dev-size` (จำเป็น) | ชุดคัดเลือก: ต้นทางและข้อความอ้างอิง | สาธารณะ เผยแพร่จาก `<out>/public/` |
| `--secret-size` | ชุดทดสอบแบบปิดผนึกที่การแข่งขันลงทะเบียนเทียบไว้ | ไม่มีใครเห็น: ถูกปิดผนึกไว้ใน `<out>/local/` |
| `--sealed-holdout-size` (ต้องใช้ `--secret-size`) | ชุดย่อยแบบปิดผนึกชุดที่สอง ซึ่งได้รับการคิดคะแนนแต่ระงับไว้จนกว่าจะปิดการแข่งขัน | ไม่มีใครเห็น |

จำเป็นต้องระบุ `--seed`, `--qualifier-threshold` (มากกว่า 0) และ `--license` — ระบบไม่ถือเอาเองว่ามีสัญญาอนุญาตใด ๆ จำเป็นต้องระบุ `--custodian-group` และ `--threshold-pubkey` (กุญแจที่ชุดข้อมูลแบบปิดผนึกถูกเข้ารหัสไว้) ข้อความธรรมดาของชุดข้อมูลแบบปิดผนึกแต่ละชุดจะถูกลบทิ้งหลังการปิดผนึก โดย `<out>/local/manifest.json` จะเก็บสูตรกำหนดการสร้างและไม่ส่งออกจากเครื่องเด็ดขาด การปิดผนึกจะรัน `champollion network seal-corpus seal` ดังนั้นจึงต้องติดตั้ง CLI ของ `champollion` ไว้

### การดูแลรักษา

**การดูแลรักษาแบบกำหนดเกณฑ์ขั้นต่ำ (M-of-N)** บนโหนดแบบแอร์แก็ป:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` จะสร้างกุญแจ แบ่งย่อยด้วย Shamir's scheme และล้างค่าเป็นศูนย์ในการเรียกใช้ครั้งเดียว โดยจะเขียนไฟล์ `ceremony.json` (บันทึกสาธารณะ) และไฟล์ส่วนแบ่งหนึ่งไฟล์ต่อผู้ดูแลผลประโยชน์หนึ่งคน `--set` จะต้องเป็น id ของชุดข้อมูลลับ และ `--group` จะต้องเป็น `--custodian-group` ที่ขั้นตอน prepare จะใช้ — คำสั่ง prepare ไม่ได้ตรวจสอบค่าเหล่านี้ และจะตรวจพบความไม่ตรงกันก็ต่อเมื่อการรันถูกปฏิเสธเท่านั้น ส่งบันทึกของพิธีกรรมให้กับ prepare: `--threshold-pubkey <ceremony>/ceremony.json`

**การล็อก** ชุดข้อมูลแบบปิดผนึกจะถูกถอดรหัสได้ด้วย `mt-eval node run-method <id>
--offline --share … --share …` เท่านั้น โดยต้องมีส่วนแบ่งอย่างน้อย M ส่วนจากผู้ดูแลผลประโยชน์คนละคนกันซึ่งมี id ตรงกับชุดข้อมูล การดูแลรักษาแบบกำหนดเกณฑ์ขั้นต่ำจะทำงานบนเส้นทางออฟไลน์นี้เท่านั้น

**กุญแจเดี่ยว** `champollion network seal-corpus keygen --out <dir>` จะสร้างคู่กุญแจหนึ่งคู่ ใครก็ตามที่ถือไฟล์กุญแจนี้สามารถถอดรหัสได้ตามลำพัง ซึ่งเป็นสิ่งที่เส้นทางโหนดแบบเชื่อมต่อเครือข่ายใช้งาน

### ขั้นตอนดำเนินงานของผู้จัดงาน (การดูแลรักษาแบบกำหนดเกณฑ์ขั้นต่ำ)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

`node init --from-contest` จะกำหนดการดูแลรักษาแบบเกณฑ์ขั้นต่ำเมื่อชุดข้อมูลถูกปิดผนึกไว้กับกุญแจพิธีกรรม ผู้ส่งผลงานจะผ่านการคัดเลือกบนชุดพัฒนาสาธารณะ (`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`
`mt-eval contest submit-model` โดยทั้งสองคำสั่งต้องระบุพาธ `--offline --bundle-out`)
[คู่มือเกี่ยวกับโหนด](/docs/network/sovereignty/sovereign-eval-node) มีคำสั่งโหนดทั้งหมดระบุไว้

### คำสั่งใดที่ต้องเชื่อมต่อเครือข่าย และเป็นของใคร

| ใช้งานแบบออฟไลน์ได้ | ต้องลงชื่อเข้าใช้ | ต้องใช้ service key ของฐานข้อมูล |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (ร่วมกับ `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, ทุกคำสั่งของ `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, `submit-*` ออนไลน์, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` ที่ไม่มี `--no-register` หรือ `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, `node run-method` ออนไลน์, `node relay` และ `contest close` เมื่อมีการระงับผลลัพธ์ไว้ |

service key เป็นของใครก็ตามที่ดูแลจัดการฐานข้อมูล ผู้จัดงานภายนอกจะรันคำสั่งเหล่านี้กับฐานข้อมูลของตนเอง (`MT_EVAL_SUPABASE_URL` และคีย์ต่าง ๆ) หรือใช้งานเฉพาะบนเส้นทางออฟไลน์ — ซึ่งคะแนนสามารถตรวจสอบความถูกต้องได้จากแมนิเฟสต์ที่มีลายเซ็นกำกับ แต่จะไม่มีรายการบนกระดานสาธารณะ **หมายเหตุ** ห้ามตั้งค่า `MT_EVAL_ALLOW_PROD` โดยเด็ดขาด เพราะการตั้งค่านี้จะปลดการปฏิเสธของเครื่องมือในการเขียนลงในฐานข้อมูลการผลิตเริ่มต้น และนั่นไม่ใช่สิ่งที่เอเจนต์จะตัดสินใจได้เอง

## การเข้าร่วมโครงการ

**โครงการที่ลงทะเบียน** คือโครงการด้านภาษาที่เจ้าของโครงการนำมาแสดงรายการไว้เพื่อให้ผู้อื่นสามารถช่วยสนับสนุนได้ โดยมีไฟล์ต่าง ๆ เช่น ประโยค รายการคำศัพท์ หรือวิธี/เมธอด (ยังไม่มีการเปิดรับการตรวจทานหรือทรัพยากรการประมวลผล) คำสั่ง `mt-eval
project` ด้านล่างนี้จะสื่อสารกับฐานข้อมูลโครงการ
(`MT_EVAL_SUPABASE_URL`) คำสั่งย่อยทุกคำสั่งยกเว้น `list` (แบบไม่ระบุตัวตน) และ
`review` (สำหรับผู้ดำเนินการ) จะต้องลงชื่อเข้าใช้ (เซสชันที่แคชไว้ `MT_EVAL_REFRESH_TOKEN` หรือการลงชื่อเข้าใช้แบบโต้ตอบผ่าน GitHub หรือ Google) โดยบัญชีผู้ใช้จะใช้อีเมลที่ลงชื่อเข้าใช้นั้น

**กฎเกณฑ์**

- **ได้รับการตรวจสอบก่อนแสดงรายการ** โครงการใหม่จะเริ่มต้นที่ `pending_review` และจะแสดงในรายการหลังจากได้รับการตรวจสอบแล้วเท่านั้น เจ้าของโครงการสามารถปิดโครงการได้ และเลือกที่จะไม่แสดงในรายการเลยก็ได้
- **เจ้าของโครงการจะระบุชื่อตามที่ตนเลือก** (`--owner-name`) แถวข้อมูลของโครงการจะไม่มีอีเมล บัญชีของเจ้าของโครงการจะถูกแยกเก็บไว้ต่างหาก และอ่านได้เฉพาะเจ้าของโครงการเท่านั้น
- **ไม่มีอีเมลในการแสดงรายการ** `project list` ทำงานแบบไม่ระบุตัวตนและแสดงเฉพาะชื่อและจำนวน `project offers` จะแสดงชื่อผู้ช่วยเหลือตามชื่อที่พวกเขาระบุไว้ (`--as`) บัญชีของเจ้าของโครงการยังคงสามารถอ่านอีเมลบัญชีของผู้ช่วยเหลือได้ในบันทึกข้อเสนอ และบันทึกความยินยอมจะบันทึกบัญชีของทั้งสองฝ่ายไว้
- **ข้อเสนอจะถูกเก็บรักษาไว้โดยทั้งสองฝ่าย** การยอมรับข้อเสนอจะเขียนบันทึกความยินยอมที่ระบุชื่อผู้ส่งและผู้อนุมัติ
- **ไม่มีการพิมพ์เนื้อหาใด ๆ ออกมาจากไฟล์** แสดงเฉพาะชื่อ จำนวน และสถานะเท่านั้น

### เจ้าของโครงการ

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` จะอ่านคู่ภาษาจาก `champollion.project.json` (และวัตถุประสงค์ เว้นแต่จะระบุ `--purpose`) อ็อปชันเสริมคือ `--slug`, `--domain`, `--register`, `--about` ลงทะเบียนได้สูงสุด 5 ครั้งต่อหนึ่งบัญชีในทุก 24 ชั่วโมง
- `ask` `--kind` จะเป็น `sentences`, `word-list` หรือ `method` คำขอจะแสดงให้เห็นเฉพาะช่วงที่โครงการแสดงอยู่ในรายการเท่านั้น
- `accept` จะดาวน์โหลดไฟล์ **ตรวจสอบความถูกต้องของ sha256** (ปฏิเสธหากไม่ตรงกัน) เขียน `inbox/offer-<offer id>-<file name>` และ
  `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`,
  `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`) จากนั้นทำเครื่องหมายว่าข้อเสนอได้รับการยอมรับแล้ว หลังจากนั้นไฟล์จะถูกนำเข้ามาเช่นเดียวกับไฟล์อื่น ๆ —
  `champollion data add inbox/<file>` — และจะมีการถามข้อกำหนดของผู้ถือครองไฟล์
- **หมายเหตุ** `--terms` ของผู้ช่วยเหลือจะระบุไว้ในบันทึกความยินยอม คำตอบที่คุณบันทึกด้วย `champollion data mark` จะต้องไม่ผ่อนปรนข้อกำหนดเหล่านั้นให้หย่อนลง

### ผู้ช่วยเหลือ

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` จะอัปโหลดไฟล์ที่ไม่ว่างเปล่าขนาดไม่เกิน 50 MB หนึ่งไฟล์ไปยังที่จัดเก็บข้อมูลส่วนตัวของโครงการ พร้อมกับ sha256 โดยส่งไปยังโครงการที่แสดงในรายการเท่านั้น ยื่นข้อเสนอได้สูงสุด 24 ข้อเสนอต่อผู้ช่วยเหลือหนึ่งคนในทุก 24 ชั่วโมง
- ข้อเสนอจะเปลี่ยนสถานะได้ครั้งเดียว: `offered` → `accepted`, `declined` หรือ `withdrawn`
- **หมายเหตุ** การถอนข้อเสนอหรือการปฏิเสธจะเปลี่ยนเฉพาะสถานะของข้อเสนอเท่านั้น ไม่ได้เป็นการลบไฟล์ที่อัปโหลดออกจากที่จัดเก็บข้อมูล แจ้งให้ผู้ช่วยเหลือทราบก่อนที่จะยื่นข้อเสนอใด ๆ ที่พวกเขาอาจต้องการนำกลับคืน
- **การล็อก** `offer` จะอ่านไฟล์ไซด์คาร์ก่อนที่จะอัปโหลดสิ่งใด คำสั่งจะปฏิเสธไฟล์ที่เป็น `local-only` ชุดข้อมูลที่เป็น `sealed` และไฟล์ที่ `speakers_agreed` มีค่าเป็น `not-yet` หรือ `some-said-no` หากไม่สามารถอ่านไฟล์ไซด์คาร์ได้ ข้อเสนอจะถูกหยุดทันที จะไม่มีการข้ามการตรวจสอบนี้: เครื่องหมายกำกับมีไว้เพื่อให้ผู้ถือครองเป็นผู้เปลี่ยนแปลงเท่านั้น ข้อกำหนด `training: not-allowed` จะถูกเพิ่มลงในข้อกำหนดของข้อเสนอเพื่อให้เจ้าของโครงการมองเห็น
- **หมายเหตุ** การยื่นข้อเสนอจะเป็นการส่งไฟล์ออกจากคอมพิวเตอร์ของผู้ช่วยเหลือไปยังที่จัดเก็บข้อมูลของฐานข้อมูลโครงการ โปรดสอบถามผู้ช่วยเหลือก่อนเสมอ และอย่ายื่นข้อเสนอไฟล์แทนพวกเขาโดยเด็ดขาด

`mt-eval project review` เป็นคำสั่งสำหรับผู้ดูแลฐานข้อมูล (ใช้ service key) ไม่ใช่คำสั่งสำหรับเอเจนต์

## ศึกษาเพิ่มเติม

- [จัดชุดทดสอบแบบปิดผนึก](/docs/host-a-sealed-test) และ
  [เข้าร่วมโครงการ](/docs/join-a-project) — เวอร์ชันสำหรับบุคคลทั่วไป
- [จัดการแข่งขันแบบอธิปไตย](/docs/network/sovereignty/run-a-sovereign-contest)
  และ [โหนดประเมินผลแบบอธิปไตย](/docs/network/sovereignty/sovereign-eval-node)
- [การโอนสิทธิ์ความเป็นเจ้าของ](/docs/network/sovereignty/ownership-transfer) และ
  [เทมเพลตข้อกำหนด](/docs/network/sovereignty/terms-templates)
- [กฎเกี่ยวกับข้อมูลและการส่งข้อมูล](/docs/agents/data-rules) — ชุดข้อมูลแบบปิดผนึกและไฟล์ที่ใช้งานเฉพาะในเครื่อง
- [เอกสารอ้างอิง `mt-eval`](/docs/reference/mt-eval)
