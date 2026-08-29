---
sidebar_position: 4
title: "การวินิจฉัยการฝึกโมเดล"
description: "การแก้ไขปัญหาแบบเริ่มจากอาการสำหรับการฝึก MT ที่มีทรัพยากรจำกัด — เริ่มจากสิ่งที่คุณพบ ค้นหาสาเหตุที่น่าจะเป็น และ lever ใน forge ที่ใช้แก้ไข"
related:
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# การวินิจฉัยการรัน Training

โมเดลของคุณเทรนเสร็จแล้ว แต่ตัวเลขไม่เป็นอย่างที่หวัง หน้านี้เริ่มจาก
**สิ่งที่คุณเห็น** แล้วพาคุณไปสู่สาเหตุที่น่าจะเป็นและเครื่องมือ forge ที่แก้ไขปัญหานั้น
ส่วนใหญ่เป็นแบบอัตโนมัติ — `nmt-forge evaluate` จะเพิ่มส่วน
**Diagnosis & Recommendations** ที่ระบุสิ่งที่พบและตัวแปรที่ต้องปรับ
คู่มือนี้คือเวอร์ชันภาษาธรรมดา บวกกับสิ่งที่ forge ทำได้แค่
*เตือน* เท่านั้น (ทำเครื่องหมาย ⚠ **ระวังสิ่งนี้**)

บอก agent ของคุณว่า: *"รัน `nmt-forge lint <battery-manifest.json> --json` แล้วดำเนินการกับสิ่งที่พบที่มี severity สูงสุด"*
จากนั้นจับคู่สิ่งที่รายงานกับส่วนต่าง ๆ ด้านล่าง

---

## "ดีมากกับตัวอย่างในตำราเรียน แต่แย่มากกับประโยคจริง"

**กับดักที่พบบ่อยที่สุดสำหรับทรัพยากรน้อย** ข้อมูล synthetic/template ของคุณได้คะแนนสวยงาม
แต่ข้อความจริงพังทลาย

**สิ่งที่เกิดขึ้น:** เกิด **transfer plateau** ระหว่างการเทรน loss บน dev set จริงของคุณ
ลดลงต่ำสุดเร็วแล้วค่อย ๆ เพิ่มขึ้น ในขณะที่ training loss ยังคงลดลงต่อเนื่อง —
โมเดลกำลังเชี่ยวชาญ *ปริมาณ* ข้อมูล synthetic ไม่ใช่เรียนรู้การแปล
การเพิ่มข้อมูล synthetic จะ **ไม่** ช่วย

**สิ่งที่ forge พบ:** `R7-transfer-plateau` (จาก schedule story ของ run manifest)
**Lever: REAL-DATA**

**วิธีแก้:** เพิ่มข้อความจริง Backtranslate ข้อมูล monolingual ภาษาเป้าหมาย
(`nmt_forge.training.backtranslation`) หรือหาประโยคคู่ขนานจริง
ปริมาณข้อมูล synthetic ไม่ใช่ตัวแปรที่ต้องปรับ — ความหลากหลายของข้อมูล *จริง* ต่างหาก

⚠ **ระวังสิ่งนี้:** หาก mix ของคุณมีข้อมูล synthetic ~99% เทียบกับ dev set จริงขนาดเล็ก
คุณมีความเสี่ยงที่จะเกิดปัญหานี้ *ก่อน* ที่จะเห็นในคะแนน ยังไม่มี pre-flight lint
สำหรับ ratio ที่ผิดปกติ — ตรวจสอบจำนวน gold/synthetic ใน mix manifest ของคุณ

---

## "Register หนึ่งแย่กว่าตัวอื่นมาก"

ดูตาราง per-register มี register เดียว (เช่น ราชการหรือกฎหมาย) ที่ต่ำกว่าตัวอื่นมาก

**สาเหตุมีสองแบบ — การวินิจฉัยแยกแยะโดยดูที่ *coverage*
และว่า output *ไม่สมบูรณ์* หรือไม่:**

- **โมเดลขาดคำศัพท์** (`R1-vocabulary-gap`: coverage ต่ำ **และ** อัตรา incomplete สูง)
  **Lever: VOCABULARY** ขยาย lexicon (พจนานุกรม / การเก็บรวบรวม attestation)
  แล้วรัน `nmt-forge` funnel accounting เพื่อยืนยันว่า entry ใหม่ไปถึง corpus จริง —
  ความไม่ตรงกันของ orthography เพียงหนึ่งตัวอักษรเคยลบคำหลายพันคำไปโดยไม่มีใครรู้
- **โมเดลมีคำศัพท์แต่ขาดรูปประโยค** (`R2-structure-gap`:
  coverage ผ่าน แต่ยังไม่สมบูรณ์) **Lever: STRUCTURE** รัน coverage map
  เทียบกับ grammar checklist ของคุณและเพิ่ม construction ที่ขาดหายไป
  (imperatives, wh-questions, possession, inverse — อะไรก็ตามที่ template ของคุณไม่เคยครอบคลุม)

---

## "Output ผสมการสะกดหลายแบบในประโยคเดียว"

โมเดลเขียนเสียงเดียวกันสองแบบ บางครั้งในประโยคเดียวกัน

**สิ่งที่เกิดขึ้น:** ข้อมูลเป้าหมายในการเทรนสอนให้โมเดลคิดว่า convention สามารถใช้แทนกันได้ —
corpus มีเนื้อหาเดียวกันในหลาย orthography

**สิ่งที่ forge พบ:** `R3-mixed-convention` **Lever: ORTHOGRAPHY**

**วิธีแก้:** `convention-lint` corpus ทำให้เป็น **หนึ่ง** convention มาตรฐาน
ที่ data boundary แล้วเทรนใหม่ เก็บ mixed-convention rate ไว้ใน battery
เพื่อให้เห็นว่ามันลดลง

---

## "Model B ชนะ model A — แต่ต่างกันนิดเดียว"

คุณเปรียบเทียบสองโมเดลและตัวหนึ่งนำอยู่เพียงเศษเสี้ยวของคะแนน

**สิ่งที่เกิดขึ้น:** ความแตกต่างอาจเล็กกว่า noise ด้วยประโยค 80 ประโยค
ช่องว่าง chrF++ 0.4 คือการโยนเหรียญ

**สิ่งที่ forge พบ:** `R5-low-power` (confidence interval กว้างกว่า delta)
**Lever: MEASUREMENT**

**วิธีแก้:** อย่าดำเนินการกับ delta ที่เล็กกว่า CI ขยาย eval set สำหรับ register นั้น
หรือใช้ `nmt-forge compare` ซึ่งรายงาน *paired* significance test
แทนที่จะเป็นสอง interval ที่ทับซ้อนกัน forge ไม่แสดงคะแนนเปล่า ๆ —
interval มีอยู่เสมอเพื่อให้คุณเห็นสิ่งนี้

⚠ **ระวังสิ่งนี้:** ผลลัพธ์จาก **seed เดียว** ไม่มี variance-across-seeds band
ผลกำไรที่ไม่รอดจากการ re-seeding ไม่ใช่ผลจริง
หากการตัดสินใจมีความสำคัญ ให้รันซ้ำด้วย 2–3 seed

---

## "คะแนนดูดีเกินไป"

สูงอย่างน่าสงสัย โดยเฉพาะในช่วงต้นหรือกับข้อมูลน้อย จงเชื่อความสงสัยนั้น

**ตรวจสอบตามลำดับ:**

1. **Leakage** `nmt-forge leak-audit <corpus>` — คำตอบจาก test set ไปอยู่ใน training หรือไม่?
   การพบ target-side เป็นปัญหาร้ายแรงด้วยเหตุผลที่ชัดเจน
2. **การเลือก Checkpoint** Checkpoint ถูกเลือกบน **dev set ที่แยกไว้**
   ไม่ใช่ test set ใช่ไหม? forge ปฏิเสธการเทรนโดยไม่มี dev set เพื่อป้องกันสิ่งนี้โดยเฉพาะ
   แต่ pipeline ที่สร้างเองจะไม่มีการป้องกันนี้
3. **Optimism จาก near-twins** `R4-optimism-bound`: หากคะแนน battery "full"
   สูงกว่าคะแนน "strict" (ที่ตัด near-duplicate ออก) หลายคะแนน
   ช่องว่างนั้นคือ drill-sibling optimism **อ้างตัวเลข strict** สำหรับการอ้างสิทธิ์ generalization ใด ๆ

---

## "Training หยุดเกือบทันที"

การรันจบลงหลังจากไม่กี่ร้อย step โมเดลแทบไม่ได้เห็นข้อมูลของตัวเอง

**สิ่งที่เกิดขึ้น:** early stopping เข้าใจผิดว่า dev wobble ที่หนักไปด้วย synthetic
ตามปกติคือการ convergence

**พฤติกรรมของ forge:** สิ่งนี้ *ถูกป้องกัน* โดยค่าเริ่มต้น — `nmt-forge run` คำนวณ
stopping **floor** จาก mix ของคุณและระงับ early stop ที่ต่ำกว่านั้น
โดยบันทึกเหตุผลไว้ในบรรทัด `[schedule-sanity]` หากคุณเห็นการหยุดที่ไม่คาดคิด
ให้อ่านบรรทัดเหล่านั้น run manifest บันทึกสิ่งที่เกิดขึ้นและเหตุผลไว้อย่างครบถ้วน

---

## "Metric ที่ต้องการหายไปจากรายงาน"

รายงานซื่อสัตย์แต่ว่างเปล่าในแกนหนึ่ง (COMET, การตรวจสอบ FST validity)

**สิ่งที่ forge พบ:** `R6-referee-unavailable` — lane ถูกระบุว่าไม่พร้อมใช้งานพร้อมเหตุผล
**Lever: REFEREE**

**วิธีแก้:** ติดตั้ง/กำหนดค่า referee ที่ระบุแล้วให้คะแนนใหม่ คะแนนที่มีอยู่ยังคงซื่อสัตย์ —
เพียงแต่ตาบอดในแกนนั้นจนกว่า referee จะพร้อม

---

## "โมเดล emit `<unk>` หรืออักขระที่ผิดเพี้ยน"

โดยเฉพาะกับ script แบบ syllabic หรือ extended-Latin

⚠ **ระวังสิ่งนี้ — ยังไม่เป็นอัตโนมัติ** **tokenizer ของ base model อาจไม่รองรับ script เป้าหมายของคุณ**
forge ยังไม่ตรวจสอบ tokenizer coverage ก่อนการเทรน (อยู่ในรายการ gap สูงสุดของเรา)
ตรวจสอบ tokenizer ของ base model กับตัวอย่าง script เป้าหมายของคุณ
เลือก base ที่ vocabulary ครอบคลุม script นั้น (ภาษา low-resource หลายภาษาครอบคลุมโดย NLLB-family base)
หรือขยาย tokenizer ก่อนการเทรน

---

## เมื่อ forge ปฏิเสธและคุณไม่เข้าใจว่าทำไม

การปฏิเสธจะระบุเสมอว่า **เกิดอะไรขึ้น** **ทำไมมันจึงทำให้ผลลัพธ์เสียหาย** และ **วิธีแก้ไข**
หากยังไม่ชัดเจน:

- `nmt-forge status` — คุณอยู่ที่ไหนและคำสั่งถัดไปเพียงหนึ่งคำสั่ง
- `nmt-forge preflight <command>` — ทุก gate ที่คำสั่งนั้นจะผ่าน ✓/✗ พร้อมวิธีแก้ไขสำหรับแต่ละ ✗
  เพื่อให้คุณแก้ไขทั้งหมดพร้อมกันแทนที่จะทีละอย่าง

การปฏิเสธไม่ใช่ข้อผิดพลาดในการตั้งค่าของคุณ — มันคือเครื่องมือที่จับความผิดพลาด
ก่อนที่จะส่งผลต่อผลลัพธ์ของคุณ นั่นคือการออกแบบทั้งหมด
