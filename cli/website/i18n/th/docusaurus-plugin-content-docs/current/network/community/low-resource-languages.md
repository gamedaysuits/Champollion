---
sidebar_position: 5
title: "รองรับภาษาที่มีทรัพยากรน้อย"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# การรองรับภาษาที่มีทรัพยากรน้อย

> **บทสรุปผู้บริหาร** คู่มือฉบับสมบูรณ์สำหรับการสร้างระบบการแปลด้วยเครื่อง (Machine Translation) สำหรับภาษาที่มีทรัพยากรน้อยและภาษาที่มีโครงสร้างแบบผสานรวม (Polysynthetic) ครอบคลุมถึงสาเหตุที่ภาษาเหล่านี้มีความยาก (ความซับซ้อนทางวิทยาหน่วยคำ, ข้อมูลที่เบาบาง, อาการประสาทหลอนของโมเดล), ทรัพยากรทางคอมพิวเตอร์ที่มีอยู่ (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), กลยุทธ์แนวทางกว่า 10 รูปแบบ, ระบบ coaching ของ champollion และลูปการประเมินผล เริ่มต้นที่นี่หากคุณต้องการมีส่วนร่วมในการสร้างวิธีการสำหรับภาษาที่ยังขาดแคลนทรัพยากร

:::info[สถานะ: อยู่ระหว่างการพัฒนาอย่างต่อเนื่อง]
ขณะนี้การรองรับภาษา Plains Cree (nêhiyawêwin) กำลังอยู่ระหว่างการพัฒนา เครื่องมือ ชุดทดสอบประเมินผล และกระดานผู้นำที่อธิบายไว้ที่นี่เป็นของจริงและสามารถใช้งานได้แล้วในปัจจุบัน แต่ไปป์ไลน์การแปลภาษา Cree ยังไม่ได้เปิดตัว เมื่อเปิดตัวแล้ว สิ่งนี้จะทำหน้าที่เป็นพิมพ์เขียวสำหรับภาษาแบบผสานรวมและภาษาที่มีทรัพยากรน้อยอื่นๆ ที่มีโครงสร้างพื้นฐาน FST
:::

## ปัญหาที่ยังไม่ได้รับการแก้ไข

บริการ Cloud Translation ของ Google ระบุว่ารองรับ 194 ภาษา ([รายชื่อที่เผยแพร่โดย Google](https://docs.cloud.google.com/translate/docs/languages)) OMT-1600 ของ Meta (มีนาคม 2026) อ้างว่าครอบคลุมถึง 1,600 ภาษา ซึ่งเป็นระบบ MT ที่ใหญ่ที่สุดเท่าที่เคยมีการเผยแพร่มา แต่สำหรับภาษาอีกประมาณ 1,200 ภาษาที่อยู่ในกลุ่มหางยาว (long tail) — จากการคำนวณของเรา: 1,600 ภาษาที่ครอบคลุม ลบด้วย 400+ ภาษาที่ผู้เขียนรายงานว่าโมเดล "เข้าใจได้ดีเพียงพอ" — คุณภาพนั้นต่ำกว่าเกณฑ์ที่ใช้งานได้ ข้อมูลการฝึกอบรมส่วนใหญ่มาจากข้อความในคัมภีร์ไบเบิล น้ำหนักของโมเดล (model weights) ไม่เปิดให้ดาวน์โหลด และไม่มีการประเมินผลอิสระหรือกรอบการกำกับดูแลโดยชุมชน สำหรับภาษาที่เหลืออีกประมาณ 5,400 ภาษา ไม่มีโมเดลที่ผ่านการฝึกอบรมล่วงหน้าใดๆ ที่สามารถสร้างผลลัพธ์ออกมาได้เลย

ภูมิทัศน์ได้เปลี่ยนไปอย่างมาก — ปัจจุบันบริษัทเทคโนโลยีขนาดใหญ่กำลังลงทุนในการครอบคลุมภาษาที่มีทรัพยากรน้อย (LRL) แต่ความครอบคลุมไม่ใช่คุณภาพ และคุณภาพที่ปราศจากการตรวจสอบอย่างอิสระก็ไม่ใช่ความไว้วางใจ ภาษาที่มีทรัพยากรน้อยต้องการมากกว่าแค่โมเดลที่อ้างว่าครอบคลุมภาษาเหล่านั้น — พวกเขาต้องการการประเมินผลอย่างอิสระพร้อมการตรวจสอบความถูกต้องทางวิทยาหน่วยคำ (morphological validation) คลังข้อมูลที่คัดสรรโดยชุมชน และการกำกับดูแลที่เคารพต่ออธิปไตย

**champollion ถูกสร้างขึ้นมาเพื่อเปลี่ยนแปลงสิ่งนั้น**

[Method Leaderboard](https://champollion.dev/leaderboard) คือความท้าทายแบบเปิด: สร้างวิธีการแปลที่ดีที่สุดสำหรับภาษาที่ขาดแคลนทรัพยากร พิสูจน์ด้วยการประเมินผลที่สามารถทำซ้ำได้ และคว้าคะแนนสูงสุด ทุกคนในโลกสามารถมีส่วนร่วมได้ — นักภาษาศาสตร์ นักวิจัย ML ผู้ปฏิบัติงานด้านภาษาในชุมชน นักศึกษา ผู้ที่ทำเป็นงานอดิเรก ปัญหานี้ยังไม่ได้รับการแก้ไข โครงสร้างพื้นฐานพร้อมแล้วที่นี่ และกระดานผู้นำกำลังรอคุณอยู่

---

## ทำไมเรื่องนี้ถึงยาก: วิทยาหน่วยคำแบบผสานรวม (Polysynthetic Morphology)

ระบบ MT เชิงพาณิชย์ส่วนใหญ่ได้รับการออกแบบมาสำหรับภาษาอย่างเช่น ภาษาอังกฤษ ภาษาฝรั่งเศส และภาษาจีน — ซึ่งเป็นภาษาที่คำค่อนข้างสั้นและประโยคถูกสร้างขึ้นจากโทเค็นที่แยกจากกัน แต่ภาษาพื้นเมืองหลายภาษา รวมถึงภาษา Plains Cree เป็นภาษาแบบ **ผสานรวม (polysynthetic)**: คำเพียงคำเดียวสามารถเข้ารหัสความหมายที่ภาษาอังกฤษต้องใช้ทั้งประโยคในการสื่อสาร

### ตัวอย่างภาษา Cree

พิจารณาคำในภาษา Plains Cree ต่อไปนี้:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"เมื่อฉันไปโรงเรียน"*

นั่นคือ **คำเพียงคำเดียว** มันเข้ารหัสทั้งกาล (อดีต), ทิศทาง (กำลังไป), รากศัพท์ (เรียนรู้), วาจก (ถูกกระทำ/สะท้อนกลับ) และบุรุษ (บุรุษที่หนึ่งเอกพจน์) LLM ที่ได้รับการฝึกอบรมโดยใช้ภาษาอังกฤษเป็นหลักจะไม่มีสัญชาตญาณสำหรับความหนาแน่นทางวิทยาหน่วยคำในลักษณะนี้

ความท้าทายที่ทวีคูณขึ้น:

| ความท้าทาย | ความหมาย |
|-----------|--------------|
| **ความซับซ้อนทางวิทยาหน่วยคำ (Morphological complexity)** | รากศัพท์ของกริยาเพียงคำเดียวสามารถสร้างรูปแบบการผันคำที่ถูกต้องได้หลายพันรูปแบบผ่านการเติมอุปสรรค (prefixation), ปัจจัย (suffixation) และวิภัตติปัจจัยที่คร่อมรากศัพท์ (circumfixation) |
| **การแยกแยะสิ่งมีชีวิต/ไม่มีชีวิต (Animate/inanimate distinction)** | คำนามมีสถานะทางไวยากรณ์เป็นสิ่งมีชีวิตหรือไม่มีชีวิต — สิ่งนี้ส่งผลต่อการผันคำกริยา คำสรรพนามชี้เฉพาะ และการทำเป็นพหูพจน์ การจัดประเภทนี้ไม่ได้เป็นไปตามความเป็นสิ่งมีชีวิตทางชีววิทยาเสมอไป (*askiy* "โลก" เป็นสิ่งมีชีวิต; *maskisin* "รองเท้า" ก็เป็นสิ่งมีชีวิตเช่นกัน) |
| **การหลีกเลี่ยง (Obviation)** | การอ้างอิงถึงบุรุษที่สามจะถูกจัดลำดับตามความใกล้ชิด/ความโดดเด่น ความแตกต่างระหว่าง "proximate" (ใกล้ชิด) และ "obviative" (ห่างไกล) ไม่มีสิ่งที่เทียบเท่าได้ในภาษาอังกฤษ |
| **ข้อมูลการฝึกอบรมที่เบาบาง (Sparse training data)** | LLM เคยเห็นข้อความภาษา Plains Cree น้อยมาก สิ่งที่พวกมันเคยเห็นอาจมีการผสมผสานระหว่างภาษาถิ่น (Y-dialect, TH-dialect) หรือระบบการเขียน (SRO เทียบกับ syllabics) |
| **เส้นฐานเชิงพาณิชย์ที่อ่อนแอ (Weak commercial baseline)** | OMT-1600 รวม CRK ไว้ในระดับ R1 (ทรัพยากรต่ำมาก) โดยใช้การฝึกอบรมจากโดเมนคัมภีร์ไบเบิลและการทำโทเค็น BPE มาตรฐาน Google Translate ไม่รองรับภาษา Cree การประเมินผลอย่างอิสระด้วยตัวชี้วัดทางวิทยาหน่วยคำคือสิ่งที่ทำให้เส้นฐานเหล่านี้มีความหมาย |

การแปลภาษาแบบผสานรวมยังคงเป็น **ปัญหาการวิจัยที่เปิดกว้าง** — OMT-1600 รวมภาษาแบบผสานรวมไว้ด้วย แต่ใช้การทำโทเค็น BPE มาตรฐาน (คำศัพท์ 256K) โดยไม่มีความตระหนักรู้ทางวิทยาหน่วยคำ ซึ่งหมายความว่ามันจะฉีกคำที่มีองค์ประกอบซับซ้อนออกเป็นเศษไบต์ที่ไม่มีความหมาย

---

## ผลงานที่มีมาก่อน: วิธีที่ผู้คนใช้จัดการกับสิ่งนี้

### ALTLab FST

ทรัพยากรทางคอมพิวเตอร์ที่สำคัญที่สุดสำหรับภาษา Plains Cree คือ **finite-state transducer (FST)** ที่พัฒนาโดย [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) ณ University of Alberta โดยความร่วมมือกับ [Giellatekno](https://giellatekno.uit.no/) ณ UiT The Arctic University of Norway

ALTLab FST เป็น **เครื่องมือวิเคราะห์และสร้างคำทางวิทยาหน่วยคำ (morphological analyzer and generator)**: เมื่อได้รับคำภาษา Cree ที่ผ่านการผันคำแล้ว มันสามารถแยกองค์ประกอบออกเป็นรากศัพท์และแท็กทางไวยากรณ์ได้ และเมื่อได้รับรากศัพท์พร้อมแท็ก มันสามารถสร้างรูปแบบการผันคำที่ถูกต้องได้ สิ่งนี้ทำงานแบบกำหนดได้ (deterministic) — ไม่มีโครงข่ายประสาทเทียม ไม่มีอาการประสาทหลอน ไม่มีความน่าจะเป็น หาก FST ยอมรับคำใด คำนั้นจะถือว่าถูกต้องตามหลักวิทยาหน่วยคำ

นี่คือเหตุผลที่กระดานผู้นำของ champollion ติดตาม **FST Acceptance Rate** (อัตราการยอมรับของ FST) เป็นตัวชี้วัด วิธีการแปลที่สร้างคำซึ่ง FST ปฏิเสธ ถือเป็นการสร้างภาษา Cree ที่ไม่ถูกต้องตามหลักวิทยาหน่วยคำ — ไม่ว่าคะแนน chrF++ จะระบุว่าอย่างไรก็ตาม

**ทรัพยากรที่สำคัญของ ALTLab:**
- [itwêwina](https://itwewina.altlab.app/) — พจนานุกรมอัจฉริยะ Plains Cree–English ที่ขับเคลื่อนโดย FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — แพลตฟอร์มพจนานุกรมโอเพนซอร์สที่ตระหนักถึงวิทยาหน่วยคำ
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — ฐานข้อมูลคำศัพท์ภาษา Plains Cree
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — บริบทของโครงการในภาพกว้าง

### FST ระดับโลกและทะเบียนวิทยาหน่วยคำ

Plains Cree ไม่ใช่ภาษาเดียวที่มีโครงสร้างพื้นฐาน FST คุณภาพสูง หากคุณต้องการพัฒนาไปป์ไลน์การแปลสำหรับภาษาที่มีทรัพยากรน้อยหรือมีความซับซ้อนทางวิทยาหน่วยคำอื่นๆ คุณสามารถใช้ประโยชน์จากศูนย์กลางระดับโลกที่จัดตั้งขึ้นเหล่านี้ได้:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT The Arctic University of Norway):** คลังเก็บเครื่องมือวิเคราะห์และสร้างคำทางวิทยาหน่วยคำ FST แบบโอเพนซอร์สที่ใหญ่ที่สุด ครอบคลุมกว่า 100 ภาษา พื้นที่ที่มุ่งเน้นได้แก่ กลุ่มภาษา Sámi (`sme`, `smj`, `sma` ฯลฯ), กลุ่มภาษา Uralic (Komi, Erzya, Udmurt ฯลฯ) และภาษาชนกลุ่มน้อย/ภาษาพื้นเมืองอื่นๆ พวกเขาโฮสต์คลังข้อความสาธารณะที่ผ่านการประมวลผลแล้ว (`corpus-xxx`) ใน [GitHub Organization](https://github.com/giellalt/) ของพวกเขา
* **[The Apertium Project](https://www.apertium.org/):** แพลตฟอร์มการแปลด้วยเครื่องตามกฎ (rule-based) แบบโอเพนซอร์ส Apertium ดูแลรักษาเครื่องมือวิเคราะห์ทางวิทยาหน่วยคำ FST ที่ได้รับการปรับแต่งมาอย่างดี (โดยใช้ `lttoolbox` และ `hfst`) และพจนานุกรมสองภาษาสำหรับหลายสิบภาษา รวมถึงกลุ่มภาษา Turkic ขนาดใหญ่ (Kazakh, Tatar, Kyrgyz ฯลฯ) และภาษาชนกลุ่มน้อยในยุโรป ทรัพยากรทั้งหมดเปิดเป็นสาธารณะบน [GitHub ของ Apertium](https://github.com/apertium)
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** โครงการความร่วมมือที่จัดเตรียมกระบวนทัศน์ทางวิทยาหน่วยคำที่เป็นมาตรฐานสำหรับกว่า 150 ภาษา ชุดข้อมูลนี้โฮสต์อยู่บน Hugging Face ที่ [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies) หากไม่มีไบนารี FST ที่คอมไพล์แล้วสำหรับภาษาใดภาษาหนึ่ง สามารถใช้ตาราง UniMorph เป็นเกตเวย์ค้นหาฐานข้อมูลแบบคงที่ได้
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/):** นำเสนอเครื่องมือสำหรับภาษาพื้นเมืองของแคนาดา รวมถึงเครื่องมือวิเคราะห์ทางวิทยาหน่วยคำ FST ภาษา Inuktitut ชื่อ **Uqailaut** และ **Nunavut Hansard Parallel Corpus** ขนาดใหญ่ (คู่ประโยคภาษาอังกฤษ-Inuktitut ที่จัดตำแหน่งแล้ว 1.3 ล้านคู่)

### คลังข้อมูล EdTeKLA

[กลุ่มวิจัย EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) (ที่ UAlberta เช่นกัน) ได้รวบรวมคลังข้อมูลภาษา Plains Cree จากสื่อการเรียนการสอน การถอดเสียง และแหล่งข้อมูลในชุมชน ชุดข้อมูลการประเมินผลของ champollion [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) ได้มาจากผลงานนี้ ซึ่งเผยแพร่ภายใต้ [CC BY-NC-SA ที่ปรับเปลี่ยนโดย EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (เงื่อนไขที่กำหนดขอบเขตอธิปไตยและไม่ใช่เชิงพาณิชย์)

### แนวทางอื่นๆ ที่ผู้คนได้ลองใช้หรือสามารถลองใช้ได้

กระดานผู้นำไม่จำกัดวิธีการ (method-agnostic) ต่อไปนี้คือกลยุทธ์ที่ได้รับการสำรวจหรือเสนอแนะสำหรับ MT ที่มีทรัพยากรน้อย ซึ่งสามารถส่งเข้าร่วมได้ทุกรูปแบบ:

| แนวทาง | วิธีการทำงาน | ข้อดี | ข้อเสีย |
|----------|-------------|------|------|
| **[Coached LLM prompting](/docs/network/tutorials/coached-llm-prompting)** | แทรกกฎไวยากรณ์ พจนานุกรม และคู่ตัวอย่างลงใน system prompt | ทำซ้ำได้เร็ว ไม่ต้องมีการฝึกอบรม | ขีดจำกัดคุณภาพถูกจำกัดด้วยความรู้พื้นฐานของ LLM |
| **[Few-shot prompting](/docs/network/tutorials/few-shot-prompting)** | รวมคำแปลที่ตรวจสอบแล้วเป็นตัวอย่างในบริบท (in-context examples) | ดีสำหรับสไตล์ที่สม่ำเสมอ | หน้าต่างบริบท (context window) มีขนาดเล็ก; ตัวอย่างต้องไม่มาจากข้อมูลการประเมินผล |
| **[FST-gated pipeline](/docs/network/tutorials/fst-gated-pipeline)** | LLM สร้างคำ → FST ตรวจสอบ → ปฏิเสธและลองใหม่หากวิทยาหน่วยคำไม่ถูกต้อง | รับประกันความถูกต้องทางวิทยาหน่วยคำ | ต้องใช้โครงสร้างพื้นฐาน FST; ลูปการลองใหม่เพิ่มความหน่วงและต้นทุน |
| **[Dictionary lookup + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | บังคับใช้คำศัพท์ที่ทราบจากพจนานุกรมสองภาษา ปล่อยให้ LLM จัดการส่วนที่เหลือ | ลดอาการประสาทหลอนสำหรับคำศัพท์ที่ทราบ | ความครอบคลุมของพจนานุกรมไม่เคยสมบูรณ์ |
| **[Fine-tuned model](/docs/network/tutorials/fine-tuned-model)** | ปรับแต่งโมเดลแบบเปิด (Llama, Mistral) อย่างละเอียดบนข้อความคู่ขนาน — เพียงแต่ต้องไม่ใช้ข้อมูลการประเมินผล | มีศักยภาพที่จะได้คุณภาพสูงสุด | ต้องใช้คลังข้อมูลคู่ขนาน (ซึ่งหายาก); มีราคาแพง; มีความเสี่ยงที่จะเกิดการเรียนรู้เกิน (overfitting) |
| **[Chained models](/docs/network/tutorials/chained-models)** | โมเดล A สร้างคำแปลคร่าวๆ → โมเดล B แก้ไขหลังการแปล → โมเดล C ให้คะแนน | สามารถรวมจุดแข็งของผู้เชี่ยวชาญเข้าด้วยกันได้ | ซับซ้อน; ช้า; มีราคาแพง |
| **[Rule-based + LLM hybrid](/docs/network/tutorials/rule-based-hybrid)** | ใช้กฎทางภาษาศาสตร์สำหรับรูปแบบที่ทราบ ใช้ LLM สำหรับทุกสิ่งทุกอย่างที่เหลือ | แม่นยำในจุดที่ใช้กฎได้ | ต้องใช้ความเชี่ยวชาญทางภาษาศาสตร์อย่างลึกซึ้ง |
| **[Back-translation augmentation](/docs/network/tutorials/back-translation)** | สร้างข้อมูลคู่ขนานสังเคราะห์โดยการแปล Cree→English จากนั้นฝึกอบรมในทิศทางกลับกัน | ขยายข้อมูลการฝึกอบรมได้ในราคาถูก | ขยายข้อผิดพลาดที่มีอยู่ของโมเดลให้ใหญ่ขึ้น |
| **[Evolutionary approach](/docs/network/tutorials/evolutionary-approach)** | สร้างคำแปลที่เป็นตัวเลือก ให้คะแนน กลายพันธุ์ตัวเลือกที่ทำผลงานได้ดีที่สุด แล้วทำซ้ำ | สามารถค้นพบวิธีแก้ปัญหาใหม่ๆ ได้; ทำงานแบบขนานได้ | สิ้นเปลืองทรัพยากรการประมวลผล; ต้องการฟังก์ชันความเหมาะสม (fitness function) ที่ดี |
| **[Partial translation](/docs/network/tutorials/partial-translation)** | แปลตัวอย่างที่เป็นตัวแทนด้วยตนเอง พิสูจน์ว่าวิธีการของคุณตรงกับสไตล์ของคุณในตัวอย่างนั้น จากนั้นแปลส่วนที่เหลือทั้งหมดโดยอัตโนมัติ | ผสมผสานคุณภาพของมนุษย์เข้ากับขนาดของเครื่องจักร | ต้องใช้ความพยายามของมนุษย์ในเบื้องต้น |
| **Manual JSON / exam grading** | สร้างไฟล์ JSON ของชุดข้อมูลด้วยตนเองเพื่อทดสอบคำตอบของนักเรียนในการสอบภาษา หรือให้คะแนนชุดคำแปลของมนุษย์เทียบกับมาตรฐานทองคำ (gold standard) | ไม่ต้องใช้ ML เลย; ใช้ได้กับการศึกษาและ QA | ไม่สามารถปรับขนาดเพื่อรองรับความต้องการในการแปลอย่างต่อเนื่องได้ |

### มันก็แค่ JSON

ชุดทดสอบประเมินผลรับ JSON เข้ามาและให้คะแนนเป็น JSON ออกมา [รูปแบบชุดข้อมูล](/docs/network/leaderboard/datasets) นั้นเรียบง่าย:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

คุณสามารถสร้างสิ่งนี้ด้วยตนเอง คุณสามารถส่งออกจากสเปรดชีต คุณสามารถสร้างจากคลังข้อมูล ครูสอนภาษาสามารถใช้เพื่อให้คะแนนการแปลของนักเรียน เอเจนซี่การแปลสามารถใช้เพื่อเปรียบเทียบนักแปลอิสระ ห้องปฏิบัติการวิจัยสามารถใช้เพื่อเปรียบเทียบสถาปัตยกรรมของโมเดล ชุดทดสอบประเมินผลไม่สนใจว่า JSON มาจากไหน — มันแค่ให้คะแนนเท่านั้น

และเนื่องจากเฟรมเวิร์กการปรับใช้บนโปรดักชันใช้อินเทอร์เฟซปลั๊กอินเดียวกัน วิธีการที่ได้คะแนนดีในชุดทดสอบประเมินผลจึงสามารถปรับใช้กับเว็บไซต์ของคุณได้ด้วยการเปลี่ยนการกำหนดค่าเพียงครั้งเดียว **พิสูจน์มันและใช้งานมัน**

ความเป็นไปได้นั้นไม่มีที่สิ้นสุดอย่างแท้จริง **หากคุณมีไอเดีย จงสร้างมันขึ้นมา รันชุดทดสอบประเมินผล และส่งคะแนนของคุณ**

---

## champollion เข้ามามีบทบาทอย่างไร

champollion จัดเตรียมเลเยอร์โครงสร้างพื้นฐาน — คุณเป็นผู้นำวิธีการมา

### ระบบ Coaching

วิธีการ `llm-coached` ของ champollion ช่วยให้คุณสามารถแทรกความรู้ทางภาษาศาสตร์เข้าไปในพรอมต์ของ LLM ได้โดยตรง:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

ข้อมูล coaching จะถูกแทรกเข้าไปในพรอมต์ LLM ทุกรายการสำหรับคู่ `en:crk` ทำให้โมเดลมีบริบททางภาษาศาสตร์ที่มีโครงสร้างซึ่งปกติแล้วจะไม่มี ดู [Coaching Data](https://champollion.dev/docs/concepts/coaching-data) สำหรับข้อกำหนดฉบับเต็ม

### ระดับภาษา (Registers)

ระดับภาษา (register) เป็นส่วนหนึ่งของ system prompt ที่คอยควบคุมน้ำเสียง ความเป็นทางการ และธรรมเนียมปฏิบัติในการสะกดคำ champollion มาพร้อมกับระดับภาษา Plains Cree หนึ่งรูปแบบ:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

คุณสามารถแทนที่สิ่งนี้ในการกำหนดค่าของคุณเพื่อทดลองใช้กลยุทธ์การเขียนพรอมต์ที่แตกต่างกัน:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

ระดับภาษาที่แตกต่างกันจะสร้างสไตล์การแปลที่แตกต่างกัน — และคะแนนที่แตกต่างกันบนกระดานผู้นำ การส่งผลงานแต่ละครั้งจะบันทึกระดับภาษาและ system prompt ที่ใช้จริง (ในรูปแบบแฮช SHA-256 ใน [run card](/docs/network/specifications/run-card)) ดังนั้นการทดลองจึงสามารถทำซ้ำได้

### การแปลงระบบการเขียน (Script conversion)

ภาษา Plains Cree เขียนด้วยระบบการเขียนสองแบบ: **Standard Roman Orthography (SRO)** และ **Canadian Aboriginal Syllabics** ไปป์ไลน์ของ champollion:

1. LLM แปลเป็น SRO (อิงตามอักษรละติน ซึ่ง LLM จัดการได้ดีกว่า)
2. เกตเวย์คุณภาพ (Quality gate) ตรวจสอบความถูกต้องของผลลัพธ์ SRO
3. ตัวแปลงแบบกำหนดได้ (Deterministic converter) จะแปลง SRO → Syllabics
4. ข้อความที่แปลงแล้วจะถูกเขียนลงดิสก์

ตัวแปลงจะจัดการกับเครื่องหมายกำกับการออกเสียง SRO ทั้งหมด (ê, î, ô, â สำหรับสระเสียงยาว) และจับคู่กับตัวอักษร syllabic ที่ถูกต้อง ดู [Script Converters](https://champollion.dev/docs/concepts/script-converters) สำหรับรายละเอียดทางเทคนิค

### ลูปการประเมินผล

[ชุดทดสอบประเมินผล](/docs/network/specifications/harness) จะรันวิธีการของคุณเทียบกับชุดข้อมูลการประเมินผล และสร้าง [run card](/docs/network/specifications/run-card) ที่มีคะแนน:

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

แฟล็ก `--name` คือป้ายกำกับที่คุณเลือก มันจะปรากฏบนกระดานผู้นำเพื่อให้ผู้คนสามารถดูได้ว่าคุณใช้กลยุทธ์พรอมต์แบบใด ชุดทดสอบประเมินผลจะบันทึก system prompt แบบเต็มไว้ใน run card ดังนั้นแนวทางที่แน่นอนของคุณจึงสามารถทำซ้ำได้

:::tip[ทดลองได้อย่างอิสระ ส่งผลงานที่ดีที่สุดของคุณ]
ชุดทดสอบประเมินผลได้รับการออกแบบมาเพื่อการทำซ้ำอย่างรวดเร็ว รันการทดลองหลายสิบครั้งด้วยโมเดล ข้อมูล coaching ระดับภาษา และเงื่อนไขที่แตกต่างกัน ส่งผลงานไปยังกระดานผู้นำเฉพาะเมื่อคุณมีสิ่งที่คุณภาคภูมิใจเท่านั้น
:::

---

## หลักการอธิปไตยทางข้อมูล {#data-sovereignty-principles}

champollion ได้รับการออกแบบมาเพื่อสนับสนุนอธิปไตยด้านข้อมูลของชนพื้นเมือง ความเป็นเจ้าของ, การควบคุม, การเข้าถึง และการครอบครองข้อมูลภาษาโดยชุมชน เป็นแนวทางในการเข้าถึงเทคโนโลยีภาษาสำหรับชุมชนชนพื้นเมืองของเรา:

| หลักการ | วิธีที่ champollion ให้การสนับสนุน |
|-----------|------------------------|
| **ความเป็นเจ้าของ (Ownership)** | ชุมชนภาษาเป็นเจ้าของข้อมูลทางภาษาของตน champollion จะไม่ส่งข้อมูลกลับหรือส่งข้อมูลไปยังเซิร์ฟเวอร์ของเราโดยเด็ดขาด |
| **การควบคุม (Control)** | [วิธีการ API](https://champollion.dev/docs/guides/serving-a-method) ช่วยให้ชุมชนสามารถโฮสต์ไปป์ไลน์การแปลของตนเองได้ — เราจัดเตรียมอินเทอร์เฟซให้ พวกเขาควบคุมการนำไปใช้งาน |
| **การเข้าถึง (Access)** | ชุมชนเป็นผู้ตัดสินใจว่าใครสามารถใช้วิธีการของตนได้ API สามารถถูกจำกัดการเข้าถึงไว้เบื้องหลังการตรวจสอบสิทธิ์ได้ |
| **การครอบครอง (Possession)** | ข้อมูลการแปลทั้งหมดจะอยู่ในระบบไฟล์ของโปรเจ็กต์ของคุณ [ระบบแหล่งที่มา (provenance system)](https://champollion.dev/docs/concepts/security) จะติดตามว่าคำแปลแต่ละคำมาจากที่ใด |

สถาปัตยกรรมปลั๊กอินหมายความว่าชุมชนสามารถสร้างวิธีการที่รวมเอาความรู้ศักดิ์สิทธิ์หรือความรู้ที่ถูกจำกัดไว้ภายใน เปิดเผยเฉพาะ API การแปล และรักษาการควบคุมทรัพยากรทางภาษาของตนได้อย่างเต็มที่

---

## วิสัยทัศน์: สิ่งที่จะเกิดขึ้นต่อไป

Plains Cree คือเป้าหมายแรก เมื่อไปป์ไลน์ได้รับการตรวจสอบความถูกต้องและชุมชนพอใจกับคุณภาพแล้ว สถาปัตยกรรมเดียวกันนี้จะขยายไปยังภาษาแบบผสานรวมอื่นๆ ที่มีโครงสร้างพื้นฐาน FST:

- **กลุ่มภาษา Algonquian อื่นๆ**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **กลุ่มภาษา Inuit**: Inuktitut, Inuinnaqtun (ซึ่งใช้ระบบการเขียนแบบ syllabic เช่นกัน)
- **ตระกูลภาษาอื่นๆ**: ภาษาใดๆ ที่มีเครื่องมือวิเคราะห์ FST สามารถใช้ไปป์ไลน์ FST-gated ได้

กระดานผู้นำถูกกำหนดขอบเขตตามคู่ภาษา เมื่อชุมชนภาษามีส่วนร่วมในการให้ชุดข้อมูลการประเมินผลใหม่ แทร็กกระดานผู้นำใหม่ก็จะเปิดขึ้นโดยอัตโนมัติ

**นี่คือคำเชิญแบบเปิด** หากคุณทำงานกับภาษาที่มีทรัพยากรน้อย — ในฐานะนักวิจัย สมาชิกในชุมชน นักศึกษา หรือเพียงแค่คนที่ใส่ใจ — champollion มอบเครื่องมือให้คุณสร้างสิ่งที่เป็นจริง วัดผลอย่างซื่อสัตย์ และแบ่งปันให้กับโลก [Method Leaderboard](https://champollion.dev/leaderboard) กำลังรอผลงานของคุณอยู่

---

## ดูเพิ่มเติม

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — ส่งคะแนนของคุณและดูว่าวิธีการต่างๆ เปรียบเทียบกันอย่างไร
- **[MT Evaluation](/docs/network/leaderboard/rules)** — อะไรทำให้เป็นวิธีการที่ดี อะไรทำให้ถูกตัดสิทธิ์
- **[Eval Harness](/docs/network/specifications/harness)** — วิธีรันการทดลอง
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 และ FLORES+
- **[Coaching Data](https://champollion.dev/docs/concepts/coaching-data)** — วิธีจัดโครงสร้างความรู้ทางภาษาศาสตร์สำหรับ LLM
- **[Script Converters](https://champollion.dev/docs/concepts/script-converters)** — ไปป์ไลน์ SRO→Syllabics
- **[Serving a Method via API](https://champollion.dev/docs/guides/serving-a-method)** — การโฮสต์การแปลที่ควบคุมโดยชุมชน
- **[ALTLab](https://altlab.ualberta.ca/)** — Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — กลุ่มวิจัย Educational Technology, Knowledge & Language
- **[itwêwina dictionary](https://itwewina.altlab.app/)** — พจนานุกรม Plains Cree–English ที่ขับเคลื่อนโดย FST
