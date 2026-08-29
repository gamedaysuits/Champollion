---
sidebar_position: 2
title: "ฝึกโมเดลอย่างซื่อสัตย์ (nmt-forge)"
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# ฝึกโมเดลอย่างซื่อสัตย์ (nmt-forge)

**สรุปใน 30 วินาที:** "การปรับปรุง" MT สำหรับภาษาที่มีทรัพยากรน้อยส่วนใหญ่พังทลายเมื่อตรวจสอบซ้ำ — ชุดทดสอบรั่วไหลเข้าสู่การฝึก ชุดทดสอบเป็นตัวเลือก checkpoint หรือผลลัพธ์ที่ได้เป็นเพียงสัญญาณรบกวนที่ไม่มี error bar **nmt-forge** คือชุดเครื่องมือฝึกที่ทำให้ข้อผิดพลาดเหล่านั้นเกิดขึ้นได้ยากในเชิงโครงสร้าง: เส้นทางปกติของมันทำสิ่งที่ถูกต้อง และเส้นทางที่ผิดพลาดจะปฏิเสธพร้อมข้อความที่บอก *สิ่งที่* เกิดขึ้น *เหตุใด* จึงทำให้ผลลัพธ์เสียหาย และ *วิธีแก้ไข* ที่ชัดเจน มันทำหน้าที่ฝึก ส่วน [eval harness](/docs/network/specifications/harness) ทำหน้าที่ให้คะแนน การป้องกันทุกอย่างในนั้นเป็นการแปลงข้อผิดพลาดที่เราเคยทำจริง วัดผล และบันทึกไว้ระหว่างการสร้างระบบแปลภาษา Plains Cree ให้กลายเป็นกลไก

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

นั่นคือบุคลิกทั้งหมดของชุดเครื่องมือนี้ในการปฏิเสธครั้งเดียว

## เรื่องราวในห้านาที

นี่คือความล้มเหลวที่ชุดเครื่องมือนี้ถือกำเนิดขึ้นมา ตำราเรียนภาษา Cree แมปแบบฝึกหัดภาษาอังกฤษหลายรายการไปยังเป้าหมายเดียว: *"Feed him"* และ *"Feed her"* ทั้งคู่แปลเป็น `asam` การแบ่งแบบสุ่มมาตรฐานนำสำเนาหนึ่งไปไว้ในชุดฝึกและคู่แฝดของมันไปไว้ในชุดทดสอบ — ดังนั้นโมเดลจึงเคยเห็นคำตอบ "ทดสอบ" จริง ๆ 17 จาก 54 รายการ และแถวเหล่านั้นได้คะแนน chrF++ 83 เทียบกับ 44 สำหรับรายการที่สะอาด ทุกอย่างที่ตามมา (โมเดล "แชมป์" ผลการค้นพบที่สร้างบนมัน) ต้องถูกทิ้งทั้งหมด

ตัวแบ่งข้อมูลของ nmt-forge ทำให้สิ่งนั้นเป็นไปไม่ได้ **โดยโครงสร้าง**: คู่ที่มีต้นฉบับ *หรือ* เป้าหมายร่วมกันจะถูกจัดกลุ่ม กลุ่มทั้งหมดจะอยู่ฝั่งเดียวกัน และการตรวจสอบ zero-overlap จะทำงานหลังการแบ่งทุกครั้ง:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

การป้องกันอื่น ๆ ทุกอย่างมีรูปแบบเดียวกัน — ข้อผิดพลาดจริง ที่ถูกแปลงเป็นกลไก:

| การป้องกัน | ข้อผิดพลาดที่กำจัด |
|---|---|
| **split-guard** | คำตอบทดสอบที่ซ่อนอยู่ในชุดฝึกผ่านต้นฉบับ/เป้าหมายที่ใช้ร่วมกัน |
| **dev-fence** | ชุดทดสอบที่เลือก checkpoint ของคุณ (การฝึกปฏิเสธที่จะเริ่มต้นหากไม่มี dev set ที่ลงทะเบียนไว้) |
| **leak-audit** | การฝึกบนข้อความ eval — แบบตรงทั้งหมด เขียนใหม่ (Jaccard) หรือทั้งไฟล์ |
| **funnel-audit** | การสูญหายของ pipeline แบบเงียบ (อักขระ orthography หนึ่งตัวเคยลบกริยาในพจนานุกรม 1,375 รายการ อย่างล่องหน เป็นเวลาหลายสัปดาห์) |
| **convention-lint** | การฝึกบนรูปแบบการสะกดที่ผสมกัน (โมเดลจะผสมรูปแบบเหล่านั้นกลางประโยค) |
| **coverage-map** | คู่ประโยคสังเคราะห์หนึ่งล้านคู่ที่ไม่มีประโยคคำสั่ง ไม่มีคำถาม ไม่มีการแสดงความเป็นเจ้าของ — ปริมาณที่ซ่อนช่องว่างเชิงโครงสร้าง |
| **sample-strata** | รูปแบบ template สองประเภทที่ครอบครองสัญญาณการฝึกครึ่งหนึ่ง |
| **ci-scoring** | คะแนนที่ไม่มี error bar (ตัวเลขทุกตัวแสดงพร้อม 95% bootstrap CI — ไม่มีผลลัพธ์คะแนนเปล่า) |
| **schedule-sanity** | early stopping ที่หยุดการรันที่มีข้อมูลสังเคราะห์หนักที่ครึ่ง epoch: เมื่อมีข้อมูลสังเคราะห์ 97% และ dev set จริงที่ซื่อสัตย์ dev loss จะถึงจุดต่ำสุดเร็วและค่อย ๆ สูงขึ้น — นั่นคือโมเดลที่ fitting กับข้อมูลสังเคราะห์จำนวนมาก ไม่ใช่การ convergence เกณฑ์ขั้นต่ำของการหยุดถูกคำนวณจากสัดส่วนข้อมูลของคุณโดยอัตโนมัติ และทุกการแทรกแซงจะอธิบายตัวเองด้วย dev-loss trajectory สิ่งนี้ถูกค้นพบ *โดย* โปรโตคอลที่สะอาด — การตั้งค่าที่ซื่อสัตย์จะเปิดเผยบั๊กจริง |
| **eval-ledger** | การใช้ข้อมูล eval แบบ adaptive ที่มองไม่เห็น (การอ่านทุกครั้งถูกบันทึก ชุดที่ปิดผนึกใช้ได้ครั้งเดียว) |
| **preregister** | การทำนายย้อนหลังที่แต่งตัวเป็นการทำนายล่วงหน้า (ไม่มีการลงทะเบียนล่วงหน้า → ไม่มีตารางเปรียบเทียบ) |

## ทุกภาษา ทุกทรัพยากร — เริ่มจาก card

nmt-forge เป็นเครื่องมือเดียวสำหรับภาษาทั้งหมดประมาณ 8,700 ภาษาในดัชนีของ Champollion และ
เริ่มต้นด้วยการสอบถามดัชนีว่าภาษานั้นมีอะไรอยู่บ้างจริงๆ:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

เครื่องหมาย `?` คือเครื่องมือที่ซื่อสัตย์: การไม่มีข้อมูลใน card หมายถึง **ไม่ทราบ** ไม่ใช่ "ภาษานี้ไม่มีอะไรเลย" ทุกภาษาไต่ขึ้น **asset ladder** เดียวกัน — (1) ข้อความคู่ขนานเพียงอย่างเดียวก็ได้รับ training loop ที่มีการป้องกันครบถ้วน (2) ข้อความ monolingual เพิ่ม backtranslation (3) พจนานุกรมบวกไวยากรณ์ที่ตีพิมพ์ทำให้คุ้มค่าที่จะสร้าง template pack ที่อ้างอิงได้ (4) morphological analyzer ปลดล็อกการสังเคราะห์ที่ตรวจสอบแล้ว (5) LYSS referee นำ metric ของภาษานั้นเองเข้าสู่การให้คะแนนและการเลือก checkpoint card ที่สมบูรณ์ (Plains Cree) เชื่อมต่อขั้น 4–5 โดยอัตโนมัติ — ชุดทดสอบมาพร้อมแฟล็ก `NEVER TRAIN ON THIS` และ plugin lane ของ referee พร้อมให้วางได้ทันที

`nmt-forge init <code>` จากนั้นสร้างโครงการจาก card: workspace, config เริ่มต้น และ brief `NEXT_STEPS.md` ที่เขียนไว้สำหรับคุณ *และ agent ของคุณ* — จบที่ [Submit a Method](/docs/network/getting-started/submit-a-method) เมื่อคุณมีสิ่งที่คุ้มค่าแก่การทดสอบ

## ข้อมูลสังเคราะห์ที่คุณสามารถปกป้องได้

สำหรับภาษาที่มี morphological analyzer (FST) forge ผลิตข้อมูลฝึกผ่าน **language pack** — และบังคับใช้ *emit law* ที่ไม่มี pack ใดสามารถเลือกไม่ทำตามได้: ทุกคำที่สร้างขึ้นต้องผ่าน round-trip ผ่าน analyzer (generate → analyze → analysis เดิม) ทุก template อ้างอิงไวยากรณ์ที่ตีพิมพ์ที่มันถอดความ ทุก plausibility filter ถูกตั้งชื่อและนับ และทุกแถวถูกประทับตรา `synthetic: true` ตราประทับนั้นมีความสำคัญ: registry **ปฏิเสธแถวสังเคราะห์ในชุดทดสอบ** การทดสอบใช้ข้อมูลจริงเท่านั้น

forge เองไม่มี language pack มาให้ — มันเป็นเครื่องมือทั่วไป Pack อยู่กับภาษาของตนและเชื่อมต่อผ่าน module path หรือ entry point (Plains Cree pack อยู่ในโครงการ crk-translate):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Analyzer และพจนานุกรมเป็นเครื่องมือแยกต่างหากที่ผู้ใช้ดึงมาเองภายใต้ใบอนุญาตของตนเอง — ไม่มีการรวมไว้ด้วยกัน ไม่มีการแจกจ่ายซ้ำ

## กรรมการของภาษาคุณเอง อยู่ในวงจร

มาตรฐานการประเมิน LYSS (linter ต่อภาษาที่รู้ว่า เช่น การสะกดสองแบบของ Cree ต่างกันเพียงแค่รูปแบบสระยาวที่มีเอกสารรองรับ) เชื่อมต่อกับทุก scoring surface — และเข้าสู่การเลือก checkpoint ดังนั้นโมเดลที่ชนะคือโมเดลที่ *กรรมการของภาษา* ชอบ ไม่ใช่แค่ chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

ตัวเลข plugin ทุกตัวได้รับ confidence interval กรรมการที่ขาด prerequisite จะรายงาน *unavailable* แทนที่จะให้คะแนนที่แต่งขึ้น

เช่นเดียวกันกับ **full harness metric stack** — nmt-forge รองรับทุกอย่างที่ [eval harness](/docs/network/specifications/harness) รองรับ รวมถึง neural metric (COMET, COMET-QE, MetricX) โดยรัน inference ครั้งเดียวและ bootstrap confidence interval จากคะแนนต่อรายการที่แคชไว้ ก่อนที่คุณจะเลือก checkpoint บน automatic metric ใด ๆ `discover` จะแสดง [ความน่าเชื่อถือที่วัดได้](/docs/network/specifications/metric-reliability) ของแต่ละ metric สำหรับตระกูลภาษาของคุณ — สำหรับ Inuktitut BLEU แทบไม่สัมพันธ์กับการตัดสินของมนุษย์ (r=0.16) ในขณะที่ COMET ทำได้ (r=0.86) สำหรับตระกูลภาษาที่มีทรัพยากรน้อยส่วนใหญ่ คำตอบที่ซื่อสัตย์คือ *ยังไม่ได้วัด* เครื่องมือบอกคุณว่าตัวเลขใดควรเชื่อก่อนที่คุณจะ optimize ไปหามัน

## ไปศึกษาเพิ่มเติมได้ที่

- **ยังใหม่กับคำศัพท์?** [MT Training in Plain Language](/docs/network/context/mt-training-concepts) นิยามทุกคำ — ข้อมูลฝึกเทียบกับ eval, loss เทียบกับ decoding, leakage, chrF++, backtranslation, plateau — พร้อมตัวอย่างที่ทำงานได้จริง เขียนสำหรับผู้ที่ไม่มีพื้นฐานมาก่อน
- **พร้อมสร้างแล้ว?** [So You Want to Train Your Own Model](/docs/network/tutorials/train-your-own-model) คือคำแนะนำทีละขั้นตอนแบบ agent-forward: เลือกภาษา → รวบรวมข้อมูล → สังเคราะห์ → แบ่ง → ฝึก → ประเมิน → ทำซ้ำ → ส่ง โดยแสดงแต่ละ guardrail ที่จับข้อผิดพลาดของมัน
- **ฝึกแล้วส่ง:** โมเดลที่ฝึกอย่างซื่อสัตย์กลายเป็นรายการ Network ผ่าน [Submit a Method](/docs/network/getting-started/submit-a-method)
- **Error bar:** [Statistical Significance Testing](/docs/network/specifications/significance) คือคณิตศาสตร์ที่ forge ใช้โดยค่าเริ่มต้น
- **Metric ใดที่ควรเชื่อ:** ตรวจสอบ [Metric Reliability](/docs/network/specifications/metric-reliability) ก่อนเลือก checkpoint บน automatic metric ใด ๆ
- **การออกแบบทั้งหมด** — backstory ที่วัดได้ของทุก guard, pack interface, ค่าเริ่มต้นของ training loop — อยู่กับโค้ดใน repository (`forge/DESIGN.md`)
