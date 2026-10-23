---
title: "ควบคุม rails จากเชลล์"
slug: /agents/shell
description: "ทุกขั้นตอนของ rails ในรูปแบบคำสั่งทั่วไป: ติดตั้ง เริ่มต้นโปรเจกต์ นำเข้าข้อมูล บันทึกคำศัพท์ ฝึกฝนและทดสอบโมเดลด้วย nmt-forge ดำเนินรอบการปรับปรุง แปลและให้บริการด้วย mt-eval — รวมถึงโหมดออฟไลน์ ตัวแปรสภาพแวดล้อมที่เครื่องมืออ่าน และ exit code"
---

# การควบคุมรางผ่านเชลล์

ทุกขั้นตอนบนรางคือคำสั่งทั่วไป เอเจนต์ที่ไม่มี MCP — หรือบุคคลที่ใช้งานผ่านเทอร์มินัล — สามารถเดินบนรางเดียวกันนี้ได้ด้วยสามโปรแกรม:
`champollion`, `nmt-forge` และ `mt-eval` โดยไม่จำเป็นต้องจำลำดับขั้นตอน: `champollion next` จะระบุขั้นตอนถัดไป พร้อมโหมดและคำสั่งที่แน่ชัด ซึ่งอ่านมาจากไฟล์ของโปรเจกต์

กฎเกณฑ์ต่าง ๆ เหมือนกันกับการใช้งานผ่าน MCP โดยขั้นตอนแบบ `confirm` จะทำงานหลังจากบุคคลตอบตกลงเท่านั้น และคำตอบของขั้นตอนแบบ `ask_user` ย่อมเป็นของพวกเขา
([ข้อตกลง](/docs/agents/contract))

## การติดตั้ง

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**หมายเหตุ** ทั้งคู่มีการดาวน์โหลดแพ็กเกจ: โหมด `confirm` — ให้ถามก่อนเสมอ หาก `uv
--version` ล้มเหลว บุคคลจะต้องติดตั้ง uv เองจาก https://docs.astral.sh/uv/
โดยเอเจนต์จะไม่ดาวน์โหลดตัวติดตั้ง การฝึกฝนยังจำเป็นต้องใช้ training extra ของ forge (PyTorch และ Hugging Face transformers ขนาดหลายร้อย MB) ซึ่ง Forge จะแจ้งเตือนเมื่อยังไม่ได้ติดตั้ง (สถานะ `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

รางต้องการ `nmt-forge` เวอร์ชัน 0.3.0 ขึ้นไป หากเป็นเวอร์ชันเก่ากว่า ระบบจะแจ้งพร้อมคำสั่งอัปเกรด (`uv tool install --upgrade --python 3.12 nmt-forge`)

## ลูปการทำงาน

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

`How:` ในเอาต์พุตสำหรับมนุษย์คือโหมด: `run it` (`auto`), `ถามก่อน แล้วจึงสั่งรัน` (`confirm`), `ถามผู้ถือครองข้อมูล — ห้ามตอบแทนเด็ดขาด` (`ask_user`), `รอ แล้วถามอีกครั้ง` (`wait`), `ดำเนินการโดยบุคคล`
(`human_only`) ให้รันคำสั่งที่ระบบแจ้ง จากนั้นจึงถามอีกครั้ง การก้าวออกนอกรางสามารถทำได้ตามสะดวก — รันคำสั่งระดับผู้เชี่ยวชาญใดก็ได้ จากนั้นรัน `champollion next`: ขั้นตอนถัดไปจะถูกอ่านมาจากไฟล์

## เริ่มต้น

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

ภาษาต่าง ๆ จะระบุเป็นรหัสหรือชื่อ ซึ่งจำแนกผ่านการ์ดภาษา สำหรับภาษาถิ่นที่ไม่มีรหัส ให้ใช้รหัสสำหรับการใช้งานส่วนตัว (`qaa`–`qtz`) และชื่อที่ชุมชนภาษานั้นเรียกขาน (`--target-name`, `--source-name`) **หมายเหตุ** ให้ยืนยันคู่ภาษาและทิศทางก่อนสร้างโปรเจกต์: `--dry` จะจำแนกทั้งสองภาษาโดยไม่มีการเขียนข้อมูลใด ๆ ส่งต่อแต่ละภาษาตามชื่อที่บุคคลระบุอย่างแม่นยำ

## รวบรวมและบันทึกข้อกำหนด

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` อ่าน `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, ตาราง Word `.docx`, พจนานุกรม Toolbox และ LIFT, ELAN `.eaf` รวมถึง USFM
(`--usfm-source`) คำสั่งนี้จะเขียน `<stem>.tsv` และไฟล์กำกับ (sidecar) โดยคงไฟล์ต้นฉบับไว้ไม่แตะต้อง พร้อมทั้งแสดงจำนวน คอลัมน์ และหมายเลขแถวที่ระบบตรวจพบ (แถวที่ซ้ำ แถวที่กล่าวซ้ำ ความยาวผิดปกติ แถวที่สลับกันหรือเลื่อน — โดยไม่มีการลบสิ่งใดออก) — และไม่แสดงประโยคเด็ดขาด หากระบบไม่สามารถระบุได้ว่าคอลัมน์ใด (หรือ tier ของ ELAN ตามหมายเลข หรือภาษาของ LIFT) คืออะไร ระบบจะปฏิเสธและถาม ให้ถามบุคคล `--replace` จะอ่านไฟล์ต้นฉบับเดิมซ้ำอีกครั้งด้วยคอลัมน์อื่น โดยยังคงรักษาคำตอบของผู้ถือครองไว้ ส่วน `--name <stem>` จะเพิ่มอีกไฟล์หนึ่งภายใต้ชื่ออื่น
ดู [กฎข้อมูล](/docs/agents/data-rules#what-tools-print-and-never-print)

จากนั้นบันทึกข้อกำหนดทีละไฟล์ จากคำตอบของบุคคล:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

ต้องระบุ `--local-only` หรือ `--may-leave` สำหรับไฟล์ที่ยังไม่ได้กำหนดให้ใช้งานเฉพาะในเครื่อง ขั้นตอนข้อกำหนดของกระบวนการจะสอบถามเกี่ยวกับแต่ละไฟล์ใน `data/parallel/`, `data/lexicon/`, `data/grammar/` และ `data/monolingual/` จนกว่าจะบันทึกทั้งคำตอบสำหรับการฝึกฝนและ `--speakers-agreed` ครบถ้วน ทุกค่าล้วนกำหนดโดยผู้ถือครอง — ดู [กฎข้อมูล](/docs/agents/data-rules) สำหรับการทำงานของแต่ละค่าและกรณีที่คำสั่งจะปฏิเสธ

## ปกป้องชุดทดสอบ

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## สร้างและทดสอบโมเดล

กระบวนการจะระบุขั้นตอนเหล่านี้ตามลำดับ (โดยเติมค่า `{placeholders}` จากโปรเจกต์):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` จะเลือกโมเดลที่ทรงพลังที่สุดที่คอมพิวเตอร์เครื่องนี้สามารถเทรนได้ภายในเวลาไม่กี่ชั่วโมง โดยประเมินจากหน่วยความจำของเครื่อง ([การเทรน](/docs/agents/training#models)) หากมี language card `--no-card --name` จะถูกละเว้นไว้
- `data combine` จะทำงานก็ต่อเมื่อ `data/parallel/` มีไฟล์มากกว่าหนึ่งไฟล์ โดยจะยึดตามข้อกำหนดที่เข้มงวดที่สุดของไฟล์ที่นำมารวมกัน และจะปฏิเสธไฟล์ที่ผู้ดูแลยังไม่ได้ให้คำตอบ — ทั้งในเรื่องที่ว่าโมเดลสามารถเรียนรู้จากไฟล์นั้นได้หรือไม่ และทุกคนที่มีถ้อยคำอยู่ในไฟล์นั้นยินยอมแล้วหรือไม่
- `prereg new` เป็นขั้นตอนของ `ask_user`: `--expect` และ `--rationale` คือคำพูดของผู้คนตามที่พวกเขาได้กล่าวไว้อย่างแท้จริง ซึ่งถูกเขียนขึ้นก่อนที่จะมีคะแนนใด ๆ คำถามไม่ได้ชี้นำตัวเลขใด ๆ และคุณก็ไม่ควรชี้นำเช่นกัน
- ขนาดของชุด dev ที่ journey กรอกให้ (`dev_n`) คือหนึ่งในสิบของคู่ประโยคที่ผ่านการคัดกรอง อย่างน้อย 50 คู่ และไม่เกิน 500 คู่; หากมีน้อยกว่า 200 คู่ จะใช้หนึ่งในสี่แทน เพื่อให้ชุดเทรนยังคงเก็บข้อมูลส่วนใหญ่ไว้ — ซึ่งจะน้อยกว่า 50 คู่
  ดังนั้น: ประโยค dev 40 ประโยคจาก 160 คู่, 50 ประโยคจาก 200 ถึง 500 คู่, 160 ประโยคจาก 1,600 คู่, 500 ประโยคจาก 5,000 คู่ขึ้นไป หากน้อยกว่า 50 ประโยค จะไม่สามารถตัดสินรอบการทำงานใด ๆ บนชุด dev ได้ ([การวัดผล](/docs/agents/measurement#comparing-two-models))
  `--near-dupe 0.6` จะเก็บข้อความที่เกือบซ้ำกันไว้ที่ฝั่งใดฝั่งหนึ่ง; `--max-group` คือครึ่งหนึ่งของขนาดชุด dev ปัดเศษลง แล้วบวกหนึ่ง
- `floor` จะใช้ก็ต่อเมื่อ `data/lexicon/` มีรายการคำศัพท์

จากจุดนี้ ตัวแนะนำของ forge จะระบุแต่ละขั้นตอนด้วยตนเอง `champollion next` จะถ่ายทอดต่อ ส่วน `nmt-forge status` จะแจ้งโดยตรง:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

การเทรนคือ `confirm` (ต้องใช้พลังการคำนวณ ตั้งแต่หลายนาทีไปจนถึงหลายชั่วโมง); ระหว่างที่ detached run กำลังเทรน ขั้นตอนนี้จะเป็น `wait` `nmt-forge run` จะปฏิเสธการรันที่ดิสก์ไม่สามารถรองรับได้ก่อนที่จะเริ่มต้น (`[disk-room]`) พร้อมแสดงพื้นที่ว่าง ค่าประมาณ และสิ่งที่จะได้พื้นที่คืนจาก `nmt-forge tidy`; `nmt-forge tidy --yes` จะล้างพื้นที่ดังกล่าว และ `--skip-disk-check` บน `run` จะเริ่มทำงานต่อไป โดยจะบันทึกไว้ในการรัน ทั้งสองตัวเลือกนี้ขึ้นอยู่กับการตัดสินใจของบุคคลนั้น ไม่ใช่ของคุณ ([การเทรน](/docs/agents/training#disk-space))
การส่งออก (export) จะให้คะแนนโมเดลหนึ่งครั้งบนชุดทดสอบเทียบกับการคาดการณ์
การเลือกระหว่างหลาย export เป็นการตัดสินใจของบุคคลนั้น
(`nmt-forge choose <model folder>`) หลังจากได้คะแนนชุดทดสอบแล้ว ผู้คนจะตัดสินการคาดการณ์ของตนเอง:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed` เมื่อผลไม่เป็นไปตามคาด `--prediction` คือหมายเลขของการคาดการณ์ โดยเป็น 1 สำหรับ `--expect` เดี่ยว และ `--by` ระบุผู้ที่ตัดสินตามที่พวกเขากล่าว) ดู [การฝึกฝน](/docs/agents/training) สำหรับคำสั่งและการปฏิเสธทั้งหมดของ forge

## รอบการปรับปรุง

เมื่อโมเดลถูกนำขึ้นให้บริการแล้ว รอบการปรับปรุงจะเริ่มต้นขึ้น:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: ตราบใดที่ชุด dev (ฝึกฝน) ยังมีไม่ถึง 200 ประโยค บางแถวจะไม่มีร่างคำแปล — หนึ่งในสองแถวเมื่อมีไม่ถึง 50 ประโยค และหนึ่งในสี่แถวตั้งแต่ 50 ประโยคขึ้นไป — ซึ่งผู้พูดจะเป็นคนเขียนคำแปลเหล่านั้น `improve marks` จะเขียนประโยคเหล่านั้นลงใน `data/dev/` และ `improve prepare` จะเพิ่มประโยคเหล่านั้นลงในชุด dev (`nmt-forge grow-dev`) โดยไม่นำไปใช้ในการฝึกฝนอย่างเด็ดขาด คำสั่งนี้ยังรัน `nmt-forge draft-newer` อีกด้วย เมื่อมีโมเดลอื่น — โมเดลที่เพิ่งฝึกฝนเสร็จล่าสุดเมื่อไม่ได้ถูกนำไปใช้งาน (ไม่ได้นำไปใช้หลังจบรอบ: ข้อมูลน้อยเกินกว่าจะบอกได้ ไม่มีการเปลี่ยนแปลงที่วัดผลได้ หรือแย่ลง) หรือโมเดลเดิมที่โมเดลที่กำลังใช้งานอยู่เข้ามาแทนที่หลังการเลื่อนขั้น — โมเดลดังกล่าวจะร่างคำแปลให้กับแถวที่มีการร่างคำแปลแบบสุ่มจำนวนครึ่งหนึ่ง โดยไม่มีการระบุเครื่องหมาย และเฉลยจะถูกเก็บไว้ข้างชีต (`sheet-key.json`) จากนั้น `improve marks` จะนับผลแยกตามแต่ละโมเดล — การเปรียบเทียบแบบไม่เปิดเผยชื่อโมเดล (blind comparison) ซึ่งหลังการเลื่อนขั้น นี่คือการตรวจสอบที่รายงานจำเป็นต้องใช้ ก่อนที่จะสรุปว่าคะแนนที่เพิ่มขึ้นนั้นเป็นความก้าวหน้าที่แท้จริง ([การวัดผล](/docs/agents/measurement#the-speakers-marks))
- `improve sheet` ตั้งแต่รอบที่ 2 เป็นต้นไป: ทุก ๆ 10 ประโยคใหม่ (ปัดเศษลง) จะมี 1 แถวที่เป็นร่างคำแปลที่ผู้พูดเคยทำเครื่องหมาย `Y` หรือ `N` ไว้ในชีตก่อนหน้า นำกลับมาใส่ไว้ในตำแหน่งที่สุ่มโดยไม่ระบุเครื่องหมาย บรรทัดแรกของชีตจะระบุว่ามีไม่กี่แถวที่จงใจนำกลับมาแสดงซ้ำ โดยไม่บอกว่าเป็นแถวใด ส่วน `sheet-key.json` จะแสดงรายการแถวเหล่านั้น (`repeat_rows`) คำสั่งจะพิมพ์จำนวนแถวที่นำกลับมา, *"(ไม่ได้ระบุว่าเป็นแถวใด)"*, และระบุว่าแถวเหล่านี้ใช้เวลา *"ประมาณ 10 วินาทีต่อแถว ไม่นำไปฝึกฝนอีก"*
- `improve marks` จะประเมินแถวที่นำกลับมาแสดงซ้ำเทียบกับเครื่องหมายเดิมของผู้พูดเท่านั้น — ไม่รวมอยู่ในส่วนของรอบนั้น คู่ประโยคสำหรับฝึกฝน หรือการเปรียบเทียบแบบไม่เปิดเผยชื่อโมเดล — เขียน `repeats` ลงใน `marks.json` และพิมพ์ *"แถวที่นำกลับมาแสดงซ้ำ: ผู้พูดทำเครื่องหมายตรงกับที่เคยทำไว้ก่อนหน้า A จาก J แถว (P%) — W แถวเคยผิดตอนนี้ถูก, R แถวเคยถูกตอนนี้ผิด ไม่นับในส่วนของรอบนี้ และไม่นำไปฝึกฝนอีก"*
- `improve marks` เมื่อโมเดลอื่นเป็นโมเดลที่ใหม่กว่าและผู้พูดได้ประเมินร่างคำแปลของแต่ละโมเดลอย่างน้อยหนึ่งร่าง จะบันทึกจำนวนนับด้วย forge (เฉพาะจำนวนนับเท่านั้น ไม่บันทึกประโยคอย่างเด็ดขาด):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  เมื่อผู้พูดภาษาให้คะแนนโมเดลที่ใหม่กว่าว่าถูกต้องบ่อยกว่าอย่างชัดเจน ระบบจะแสดงข้อความ *"forge recorded it: it offers to put the newer model to use (the people say yes first)"*; หากไม่ได้ติดตั้ง forge หรือ forge ปฏิเสธ ระบบจะแจ้งว่าไม่มีการบันทึกคะแนน และระบุเหตุผล
- `improve prepare` สิ้นสุดด้วย `nmt-forge round-plan`: รอบการทำงานจะดำเนินต่อจากโมเดลที่ใช้งานอยู่ (ประมวลผล 4 รอบบนประโยคทั้งหมดที่มีอยู่จนถึงตอนนี้) หรือเทรนใหม่ตั้งแต่เริ่มต้น พร้อมระบุเหตุผล ([การเทรน](/docs/agents/training#the-improve-rounds))

จากนั้น Forge จะตัดสินโมเดลใหม่เทียบกับโมเดลที่ใช้งานอยู่
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`) และเสนอให้นำไปใช้งาน (`confirm`) ก็ต่อเมื่อโมเดลนั้นดีขึ้น
อย่างวัดผลได้เท่านั้น — หรือในกรณีที่ผลการตัดสินมีข้อมูลน้อยเกินกว่าจะบอกได้ (ประโยค dev น้อยกว่า 50 ประโยค)
หรือไม่มีความเปลี่ยนแปลงที่วัดผลได้ เมื่อคะแนนประเมินแบบบอดของผู้พูดภาษาชื่นชอบ
โมเดลนี้มากกว่าอย่างชัดเจน ผลการตัดสินเพียงอย่างเดียวจะไม่นำสิ่งใดไปใช้งาน มีเพียงการตอบตกลงของผู้คน (`nmt-forge export`
และ `nmt-forge choose` ของขั้นตอนนี้) เท่านั้นที่ทำได้ คู่แปลใหม่จาก `improve marks` จะได้รับข้อกำหนดของตัวเองก่อน — ขั้นตอนการ
เดินทางจะถามคุณ วิธีส่งต่อรายงาน: [การโค้ช](/docs/agents/coaching)

## แปลภาษาและให้บริการด้วย mt-eval

`nmt-forge export` ภายในโปรเจกต์จะเขียน `deploy/<name>.json` (deployment/1)
โดยไฟล์เดียวกันนี้ใช้สำหรับวัดผล แปลภาษา และให้บริการ:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **หมายเหตุ** `mt-eval run` บนไฟล์ทดสอบไม่จำเป็นต้องลงทะเบียนล่วงหน้า — เป็นเพียงการบันทึกการอ่านเท่านั้น ให้ประเมินคะแนนชุดทดสอบผ่าน `nmt-forge export` (หรือหลังจากบันทึกการคาดการณ์แล้ว) ห้ามทำก่อนหน้านั้นเด็ดขาด
- `--gates gates/<chain>.json` เพิ่มเกตเชนไปยัง `run`, `translate` หรือ `serve` (โดยไม่มี `--deployment`) ทั้งนี้ `run` และ `test` จะปฏิเสธเชนที่มีการย้อนกลับ (fallback) ดู [วิธีการและเกต](/docs/agents/methods) และ [การให้บริการ](/docs/agents/serving)

## ออกนอกราง: สิ่งที่มีอยู่สำหรับภาษา

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## ตรวจสอบและอัปเกรดไฟล์

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## ออฟไลน์

`CHAMPOLLION_OFFLINE=1` ป้องกันไม่ให้ CLI `champollion` เข้าถึงเครือข่าย: การ์ดภาษาจะดึงมาจากชุดที่รวมมาด้วยและแคชในเครื่องเท่านั้น (จะไม่ดึงการ์ดภาษาหายากกลุ่ม long-tail) ข้ามการรีเฟรชแคชการ์ดประจำวัน และ `register-corpus` จะไม่เปรียบเทียบแฮชของไฟล์กับแคตตาล็อกสาธารณะ (โดยจะบันทึกว่าไม่ได้ทำการเปรียบเทียบ) ค่านี้ไม่เปลี่ยนแปลงสิ่งที่วิธีการส่งออกไป: วิธีการที่เรียกใช้ผู้ให้บริการยังคงจำเป็นต้องใช้เครือข่าย และกฎการส่งข้อมูลยังคงมีผลบังคับใช้เช่นเดิม

`MT_EVAL_NO_REMOTE_REGISTRY=1` ป้องกันไม่ให้ `mt-eval` ดึงข้อมูลทะเบียนชุดข้อมูลจากเว็บ (สำหรับเครื่องที่ตัดขาดจากการเชื่อมต่อเครือข่ายหรือ air-gapped)

สิ่งที่ยังคงต้องใช้เครือข่ายบนรางไม่ว่าในกรณีใด: การติดตั้งเครื่องมือ, training extra และการดาวน์โหลดโมเดลที่ฝึกฝนไว้ล่วงหน้าเป็นครั้งแรก (`byt5-small` หรือ `byt5-small-lowmem` ขนาดประมาณ 1.2 GB ส่วน `cpu-tiny` จะไม่ดาวน์โหลดสิ่งใด)

## ตัวแปรสภาพแวดล้อม

อ่านโดยโค้ด สำหรับผู้ปฏิบัติการ คีย์ API ของผู้ให้บริการจำเป็นต้องใช้เฉพาะกับวิธีการที่เรียกใช้ผู้ให้บริการเท่านั้น ไม่จำเป็นต้องใช้บนเส้นทางเริ่มต้นของราง

| ตัวแปร | อ่านโดย | ผลลัพธ์ |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | เซิร์ฟเวอร์ MCP | `rails` (ค่าเริ่มต้น) หรือ `full` |
| `CHAMPOLLION_CLI_BIN` | เซิร์ฟเวอร์ MCP | จุดเริ่มต้นการทำงาน (entry point) ของ `champollion` ที่จะรัน |
| `NMT_FORGE_BIN` | `champollion`, เซิร์ฟเวอร์ MCP | ไฟล์สั่งการ (executable) ของ `nmt-forge` |
| `UV_TOOL_BIN_DIR` | `champollion`, เซิร์ฟเวอร์ MCP | ตำแหน่งที่จะค้นหา `nmt-forge` และ `uv` หลังจาก `PATH` (ค่าเริ่มต้นคือ `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: ไม่ใช้เครือข่ายสำหรับการค้นหาการ์ดหรือแคตตาล็อก |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | แคชการ์ดสำหรับผู้ใช้แต่ละราย (ค่าเริ่มต้นคือ `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | ความถี่ในการตรวจสอบการอัปเดตของแคชการ์ด (ค่าเริ่มต้นคือ 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | ตรึงพรีเซ็ตที่ `auto` เลือก (ต้องเป็นชื่อพรีเซ็ต) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | พอร์ตเริ่มต้น (คือ 8378 หากไม่ได้ระบุ) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | โทเค็น Bearer จำเป็นต้องใช้เมื่ออยู่นอก loopback |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: ไม่มีแผงควบคุมการฝึกฝนแบบสด |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | โทเค็น Bearer (ห้ามระบุเป็นค่าผ่านบรรทัดคำสั่ง) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | โทเค็น Bearer สำหรับเซิร์ฟเวอร์ของ CLI เอง |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: ไม่ดึงข้อมูลทะเบียน |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | ตำแหน่งที่จะแปลงพาธของชุดข้อมูลที่ลงทะเบียนไว้เป็นอันดับแรก |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | คีย์ของผู้ให้บริการโมเดลแบบโฮสต์ที่เป็นค่าเริ่มต้น |

## ผลลัพธ์สำหรับโปรแกรม

| เครื่องมือ | เอาต์พุตของโปรแกรม | รหัสออก (Exit codes) |
|---|---|---|
| `champollion` | `--json` บนคำสั่งราง (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 สำเร็จ · 1 ปฏิเสธ · 2 การใช้งานไม่ถูกต้อง |
| `nmt-forge` | `--json` ในทุกคำสั่งย่อย: เอกสาร JSON หนึ่งรายการบน stdout และข้อมูลอื่นทั้งหมดบน stderr | 0 สำเร็จ · 2 ปฏิเสธ (`{"error": …}`) |
| `mt-eval` | `--json` และ `--non-interactive` ในทุกคำสั่งย่อย | 0 สำเร็จ · ปฏิเสธเมื่อไม่ใช่ศูนย์ |

รูปแบบการปฏิเสธ: [โมเดลราง](/docs/agents/rails-model#refusal-shapes)

## ศึกษาเพิ่มเติม

- [ข้อมูลอ้างอิงคำสั่ง `champollion`](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) และ
  [`mt-eval`](/docs/reference/mt-eval)
- [โมเดลราง](/docs/agents/rails-model) — กระบวนการและ `next --json`
- [การควบคุมรางผ่าน MCP](/docs/agents/mcp) — ขั้นตอนเดียวกันในรูปแบบเครื่องมือหกรายการ
- [การฝึกฝนด้วย nmt-forge](/docs/agents/training) และ
  [กฎข้อมูล](/docs/agents/data-rules)
