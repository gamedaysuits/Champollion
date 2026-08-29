---
sidebar_position: 0
title: "เมื่อคุณต้องการ Train โมเดลของตัวเอง"
description: "คำแนะนำแบบ agent-forward ตั้งแต่ต้นจนจบสำหรับการ train โมเดลแปลภาษาที่มีทรัพยากรน้อยด้วย nmt-forge — คุณสั่งการ coding agent ส่วน guardrails จะจับข้อผิดพลาดเบื้องต้นโดยอัตโนมัติ"
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# คุณต้องการฝึกโมเดลของตัวเองใช่ไหม

นี่คือคำแนะนำแบบครบวงจรสำหรับการฝึกโมเดลการแปลด้วยเครื่องสำหรับภาษาที่มีทรัพยากรน้อย — ตั้งแต่ "ฉันพูดภาษานี้ได้แต่แทบไม่มีข้อมูลเลย" ไปจนถึงโมเดลที่คุณสามารถรายงานและส่งไปยัง [Network](/docs/network/) ได้อย่างสุจริต เขียนขึ้นสำหรับผู้เริ่มต้น และอิงตามวิธีการทำงานสมัยใหม่: **คุณสั่งการ coding agent** (Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity หรือเครื่องมือที่คล้ายกัน) และ agent จะเป็นผู้รันเครื่องมือต่างๆ

แต่ละขั้นตอนด้านล่างมีรูปแบบเดียวกัน:

- 🗣️ **บอก agent ของคุณ** — สิ่งที่ต้องขอ เป็นภาษาธรรมดา
- 🛠️ **สิ่งที่เครื่องมือทำ** — สิ่งที่ [nmt-forge](/docs/network/getting-started/training-honestly) รันแทนคุณ และ **guardrail** ที่ดักจับข้อผิดพลาดคลาสสิกก่อนที่มันจะสร้างความเสียหาย
- 👀 **วิธีอ่านผลลัพธ์** — ลักษณะของ "ผลดี" และสิ่งที่ควรระวัง

:::info[ก่อนอื่น ทำความเข้าใจคำศัพท์]
หากคำอย่าง *dev set*, *decoding*, *chrF++*, *leakage* หรือ *round-trip verification* ยังไม่คุ้นเคย ให้อ่าน
[**MT Training in Plain Language**](/docs/network/context/mt-training-concepts)
ก่อน — หน้านั้นนิยามทุกคำที่ใช้ที่นี่พร้อมตัวอย่างประกอบ หน้านี้จะอ้างอิงคำเหล่านั้นทั้งหมด
:::

:::note[ความสุจริตคือคุณสมบัติ ไม่ใช่อุปสรรค]
เครื่องมือนี้มีความเห็นที่ชัดเจนโดยตั้งใจ guardrail ของมันทำให้ข้อผิดพลาดจริงที่วัดได้จากโปรเจกต์จริงกลายเป็นกระบวนการอัตโนมัติ — เพื่อให้เส้นทางที่สุจริตเป็นค่าเริ่มต้น และทางลัดที่ไม่สุจริต **จะถูกปฏิเสธพร้อมข้อความที่ระบุวิธีแก้ไข** เมื่อคุณเห็นการปฏิเสธในคู่มือนี้ นั่นคือเครื่องมือกำลังทำหน้าที่ของมัน และคุณต้องการให้มันทำเช่นนั้น
:::

---

## สิ่งที่คุณต้องมีก่อนเริ่มต้น

- **Coding agent** ที่มีสิทธิ์เข้าถึง terminal และ filesystem นั่นคือตัวขับเคลื่อน
- **ประโยคที่แปลแล้วจริงๆ** สำหรับคู่ภาษาของคุณ — แม้แต่คู่ประโยคที่มนุษย์สร้างขึ้นเพียงไม่กี่ร้อยคู่ก็เป็นจุดเริ่มต้นที่ใช้ได้ ตำราเรียนสองภาษา คลังชุมชน บันทึกสาธารณะที่แปลแล้ว สื่อการศึกษา คุณภาพสำคัญกว่าปริมาณ
- **ไม่จำเป็นแต่มีประโยชน์มาก:** ข้อความภาษาเดียวในภาษาเป้าหมาย พจนานุกรมสองภาษา ไวยากรณ์อ้างอิงที่ตีพิมพ์แล้ว และ morphological analyzer (FST) คุณ **ไม่จำเป็น** ต้องมีทั้งหมดนี้เพื่อเริ่มต้น — เครื่องมือจะบอกคุณว่ามีอะไรอยู่แล้วและอะไรที่จะปลดล็อกความสามารถใด
- **Compute:** guardrail, การแบ่งข้อมูล, การสังเคราะห์, การตรวจสอบ และการให้คะแนนสามารถรันบนแล็ปท็อปได้ มีเพียงขั้นตอนการฝึกโมเดลจริงเท่านั้นที่ต้องการ GPU (และโมเดลขนาดเล็กที่ใช้ LoRA ก็ใช้ฮาร์ดแวร์ระดับปานกลางได้)

> 🗣️ **บอก agent ของคุณ:** *"ติดตั้ง nmt-forge จาก package `forge/` ของ Champollion monorepo และยืนยันว่าคำสั่ง `nmt-forge` รันได้ เราจะฝึกโมเดลแปล English → \<your language\> อย่างสุจริต"*

agent ของคุณสามารถเรียกใช้เครื่องมือ `get_training_guardrails` ของ Champollion MCP server เพื่อโหลด rulebook ฉบับสมบูรณ์ — guardrail ทั้งสิบข้อและข้อผิดพลาดที่แต่ละข้อป้องกัน — เข้าสู่ context ของตัวเองก่อนที่จะเขียนคำสั่งใดๆ หากคุณกำลังขับเคลื่อน agent ให้ขอให้มันทำสิ่งนั้นก่อน

---

## ขั้นตอนที่ 1 — เลือกภาษาและดูว่ามีอะไรอยู่จริงๆ

ทุกโปรเจกต์เริ่มต้นด้วยการถาม index ว่าภาษานั้น *มี* อะไรอย่างสุจริต

> 🗣️ **บอก agent ของคุณ:** *"รัน `nmt-forge discover` สำหรับรหัส ISO 639-3 ของภาษาเป้าหมายของฉัน และสรุปว่ามีข้อมูลอะไรอยู่และขาดอะไรไป"*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **สิ่งที่เครื่องมือทำ** มันอ่าน **card** ของ Champollion สำหรับภาษานั้น — แหล่งข้อมูลเดียวที่เชื่อถือได้สำหรับสิ่งที่รู้เกี่ยวกับภาษานั้น — และรายงาน script, morphological analyzer, พจนานุกรม, corpora และ eval dataset ที่บันทึกไว้ จากนั้นจัดวางภาษาบน **asset ladder**:

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **วิธีอ่านผลลัพธ์** เครื่องหมาย `✓` คือสิ่งที่คุณทำได้ตอนนี้ เครื่องหมาย `?` คือขั้นบันไดที่รอ asset อยู่ สิ่งสำคัญคือ **การไม่มีข้อมูลใน card หมายความว่า *ไม่ทราบ* ไม่ใช่ "ภาษานี้ไม่มีอะไรเลย"** card ที่บางเบาเป็นคำเชิญให้เพิ่มสิ่งที่คุณรู้ ไม่ใช่ทางตัน — และแม้แต่ card เปล่าก็ยังให้คุณใช้ training loop แบบมี guardrail ครบถ้วนบนขั้นที่ 1 ได้ card ที่สมบูรณ์ (เช่น Plains Cree) จะเชื่อมต่อขั้นบนโดยอัตโนมัติ: eval set ของมันจะมาพร้อมป้าย **NEVER TRAIN ON THIS** และ referee เฉพาะภาษาของมันก็พร้อมเสียบใช้งาน

จากนั้น scaffold โปรเจกต์:

> 🗣️ **บอก agent ของคุณ:** *"Scaffold โปรเจกต์ด้วย `nmt-forge init` สำหรับคู่ภาษานี้ และอ่าน `NEXT_STEPS.md` ที่มันสร้างขึ้นให้ฉันฟัง"*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ สิ่งนี้สร้าง workspace (ไดเรกทอรี `.forge/` ที่ guardrail ทุกตัวอ้างอิง), **starter config** และ brief `NEXT_STEPS.md` ที่เขียนขึ้นสำหรับ *คุณและ agent ของคุณ* — ลำดับคำสั่ง, asset ladder สำหรับภาษาของคุณ และสิ่งที่ต้องทำโดยไม่มีข้อยกเว้น นี่คือแผนที่สำหรับทุกสิ่งด้านล่าง

---

## ขั้นตอนที่ 2 — ชี้ไปที่ analyzer และพจนานุกรม (ถ้ามี)

ขั้นตอนนี้เกี่ยวกับ **ขั้นที่ 3–4** ของ ladder หากภาษาของคุณไม่มี analyzer ให้ข้ามไปที่ [ขั้นตอนที่ 4](#step-4--split-your-real-data-safely) — คุณจะฝึกบนข้อมูลจริง (และ backtranslated) เพียงอย่างเดียว ซึ่งเป็นเส้นทางที่ถูกต้องสมบูรณ์

หาก analyzer และพจนานุกรม *มีอยู่จริง* สิ่งเหล่านี้จะปลดล็อกความสามารถในการ *ผลิต* ข้อมูลฝึกที่ผ่านการตรวจสอบแล้ว — ซึ่งเป็นตัวช่วยที่ทรงพลังที่สุดสำหรับภาษาที่มีข้อความคู่ขนานน้อย

> 🗣️ **บอก agent ของคุณ:** *"Card ระบุว่ามี morphological analyzer และพจนานุกรมสำหรับภาษานี้ ดึงข้อมูลตามคำแนะนำการติดตั้งบน card ชี้ language pack ไปที่สิ่งเหล่านั้นผ่าน environment variable ที่ระบุไว้ และยืนยันว่า analyzer round-trip คำที่รู้จักสองสามคำได้"*

🛠️ **สิ่งที่เครื่องมือทำ — และขอบเขตที่มันจะไม่ข้าม** Analyzer (FST) และพจนานุกรมเป็น **เครื่องมือแยกต่างหากที่ผู้ใช้ดึงมาเองภายใต้ใบอนุญาตของตัวเอง** suite **ไม่เคยรวมหรือแจกจ่ายซ้ำ** — มันชี้ให้คุณรู้ว่าสิ่งเหล่านั้นมาจากไหนและใบอนุญาตของมันคืออะไร และคุณดึงมาเอง นี่ไม่ใช่ระบบราชการ: ทรัพยากรภาษาจำนวนมากมีข้อจำกัดด้านสิทธิ์และอำนาจอธิปไตยที่แท้จริง และเครื่องมือเคารพสิ่งเหล่านั้นโดยการออกแบบ

เนื้อเยื่อเชื่อมต่อคือ **language pack**: plugin ขนาดเล็กที่ปรับ analyzer, พจนานุกรม, กฎการสะกด และ template ประโยคที่อ้างอิงไวยากรณ์ *ของคุณ* ให้เข้ากับ engine suite **ไม่ได้** จัดส่ง pack ใดๆ เอง — pack อยู่กับภาษาของมัน (เช่น Plains Cree pack อยู่ในโปรเจกต์ของตัวเองและเสียบเข้าผ่าน module path)

👀 **วิธีอ่านผลลัพธ์** คุณต้องการให้ analyzer **round-trip** ได้: สะกดรูปแบบหนึ่ง ป้อนการสะกดนั้นกลับเข้าไป และได้ grammatical tag เดิม หากทำไม่ได้ **canonicalizer** ของ pack — ฟังก์ชันเดียวที่ normalize การสะกดทุกที่ที่ component สองตัวพบกัน — อาจต้องการกฎเพิ่มเติม การทำสิ่งนี้ให้ถูกต้องมีความสำคัญ: อักขระเดียวที่ไม่ได้รับการแก้ไข (`ý` กับ `y`) เคยลบกริยาออกไป 1,375 คำจาก generation pipeline อย่างเงียบๆ เป็นเวลาหลายสัปดาห์ **funnel audit** ของเครื่องมือนับจำนวนที่รอดในแต่ละขั้นตอนอย่างแม่นยำ เพื่อให้การหายไปอย่างเงียบๆ แบบนั้นไม่สามารถซ่อนตัวได้

---

## ขั้นตอนที่ 3 — สังเคราะห์ข้อมูลฝึกจากกฎไวยากรณ์

ด้วย analyzer + พจนานุกรม + pack ของ template ที่อ้างอิงไวยากรณ์ คุณสามารถผลิตคู่ประโยคที่ผ่านการตรวจสอบแล้วได้หลายแสนคู่

> 🗣️ **บอก agent ของคุณ:** *"สร้างข้อมูลฝึก synthetic ด้วย `nmt-forge synth` โดยใช้ language pack ของเรา จากนั้นแสดง coverage report ให้ฉันดู"*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **สิ่งที่เครื่องมือทำ — emit law** ทุก row ที่ไปถึง output ต้องผ่านกฎที่ไม่มี pack ใดสามารถยกเว้นได้:

- **Round-trip verified** — ทุกคำที่สร้างขึ้นต้องผ่าน *generate → analyze → same analysis* มิฉะนั้น row นั้นจะถูกทิ้ง ไม่มีรูปแบบที่ไม่ผ่านการตรวจสอบถูก emit ออกมาเลย
- **Grammar-cited** — ทุก template ต้องอ้างอิงไวยากรณ์ที่ตีพิมพ์แล้วที่มันถอดความมา Template ที่ไม่มีการอ้างอิงไม่มีอยู่จริง code ปฏิเสธที่จะโหลดมัน
- **Coverage-checked** — template ถูกตรวจสอบกับ checklist ของปรากฏการณ์ทางไวยากรณ์ที่จำเป็น (imperative, คำถาม, การครอบครอง, inverse form…) หากปรากฏการณ์ที่ *จำเป็น* มีตัวอย่างเป็นศูนย์ การ build จะล้มเหลว นี่คือการป้องกัน trap "ประโยคล้านประโยคแต่รูปแบบเดิมๆ" — ปริมาณที่ซ่อนช่องว่างเชิงโครงสร้าง
- **Provenance-stamped** — ทุก row synthetic ถูกทำเครื่องหมาย `synthetic: true` เครื่องหมายนั้นมีความสำคัญ: registry จะ **ปฏิเสธ** การลงทะเบียน row synthetic เป็น test set ข้อมูล test ต้องเป็นข้อมูลจริงเท่านั้น

👀 **วิธีอ่านผลลัพธ์** ดูที่ coverage report สำหรับ **รายการที่จำเป็นที่มี coverage เป็นศูนย์** (ปรากฏการณ์ทางไวยากรณ์ที่ template ของคุณไม่เคยสร้างขึ้น) และที่ **kind distribution** — หาก template สองรูปแบบครอบงำ per-kind cap ของ sampler (ค่าเริ่มต้น 15%) จะปรับสมดุลใหม่เพื่อไม่ให้รูปแบบเดียวกลายเป็นครึ่งหนึ่งของประสบการณ์ของโมเดล

:::tip[ไม่มี analyzer? ใช้ backtranslation แทน]
หากคุณไม่สามารถสังเคราะห์จากกฎได้ แต่มีข้อความ **monolingual** ในภาษาเป้าหมาย ให้ขอให้ agent ของคุณรัน **backtranslation** lane: `nmt-forge
backtranslate` แปลข้อความ monolingual ของคุณ *เป็น* ภาษาอังกฤษด้วยเครื่อง และจับคู่ผลลัพธ์แต่ละรายการกับประโยค **จริง** ในภาษาเป้าหมาย ฝั่งเป้าหมายยังคงเป็นของแท้ เครื่องมือ **ตรวจสอบ leak ในข้อความ monolingual ก่อน** — เพราะข้อความนั้นอาจเป็น eval data ของคุณโดยไม่รู้ตัว ดูที่
[Back-Translation cookbook](/docs/network/tutorials/back-translation)
:::

---

## ขั้นตอนที่ 4 — แบ่งข้อมูลจริงอย่างปลอดภัย

ตอนนี้นำคู่ประโยค **จริง** ของคุณมาแบ่งเป็น train / dev / test นี่คือจุดที่ข้อผิดพลาดที่ทำลายผลลัพธ์มากที่สุดใน low-resource MT ซ่อนตัวอยู่ และที่ guardrail พิสูจน์คุณค่าของมัน

> 🗣️ **บอก agent ของคุณ:** *"แบ่ง real corpus เป็น test set และ dev set ด้วย `nmt-forge split` แบบ group-disjoint และลงทะเบียนมัน ใช้ seed ที่กำหนดไว้เพื่อให้ reproduce ได้"*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **สิ่งที่เครื่องมือทำ — split-guard** มันทำ **group-disjoint splitting**: ทุกคู่ที่มี source *หรือ* target เดียวกันจะถูกผูกเป็นกลุ่มเดียว และแต่ละกลุ่มทั้งหมดจะอยู่ฝั่งเดียวกัน จากนั้นมัน **ตรวจสอบว่าไม่มี overlap** และปฏิเสธที่จะดำเนินการต่อหากมี

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

สิ่งนี้ป้องกัน **"Feed him" / "Feed her" leak**: ตำราเรียนแมป drill ภาษาอังกฤษทั้งสองกับคำเป้าหมายคำเดียว (`asam`); การแบ่งแบบสุ่มธรรมดาจะวางสำเนาหนึ่งไว้ใน train และคู่แฝดของมันไว้ใน test ทำให้โมเดล "ผ่าน" ด้วยความจำ ในโปรเจกต์จริงหนึ่งโปรเจกต์ 17 จาก 54 test row รั่วไหลด้วยวิธีนี้และได้คะแนน 83 เทียบกับ 44 สำหรับ row ที่สะอาด — และทุกผลการค้นพบที่สร้างบนตัวเลขนั้นเป็นโมฆะ `--register textbook` บันทึก dev set และ test set (เป็น `textbook-dev` และ `textbook-test`) ใน workspace เพื่อให้ทุกคำสั่งในภายหลังรู้ว่าสิ่งเหล่านั้นคือ *eval set ที่คุณต้องไม่ฝึกบนมัน*

👀 **วิธีอ่านผลลัพธ์** คุณต้องการเห็นบรรทัด **verified: 0 shared** หากแทนที่คุณได้รับ `SplitLeakageError` อย่าลบ row ด้วยมือ — นั่นแค่สับเปลี่ยนปัญหา รัน group-disjoint split ใหม่ นั่นคือวิธีแก้ไข และข้อความ error ก็บอกเช่นนั้น

:::danger[อย่าฝึกบน benchmark เด็ดขาด]
หากคุณดึง evaluation dataset จาก shared registry (`nmt-forge registry
add-harness`) เครื่องมือจะประทับตราและถือว่ามันเป็นสิ่งต้องห้ามสำหรับการฝึก — **ทุก** registry benchmark ถูกทำเครื่องหมาย *do-not-train* Fine-tune บนสิ่งที่คุณมีสิทธิ์ใช้ได้อย่างถูกต้อง แต่อย่าฝึกบน test set เด็ดขาด นี่คือ
[กฎข้อเดียว](/docs/network/leaderboard/rules) ของ Network ทั้งหมด
:::

---

## ขั้นตอนที่ 5 — ฝึกโมเดล

ไฟล์ config หนึ่งไฟล์อธิบาย run ทั้งหมด คำสั่งเดียวรันมันได้อย่าง reproducible

> 🗣️ **บอก agent ของคุณ:** *"กรอก training config — ชี้ `dev` ไปที่ registered dev set ของเรา ระบุ data lane ทั้ง gold และ synthetic เลือก base model ขนาดเล็กที่ใช้ LoRA — จากนั้นรัน `nmt-forge run` และดู schedule diagnostics"*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **สิ่งที่เครื่องมือทำ — guardrail สี่ตัวพร้อมกัน**

- **Leak-audit ก่อนฝึก** *ทุก* lane — gold, synthetic และข้อความ backtranslated ใดๆ — ถูกตรวจสอบกับ *ทุก* registered eval set การตรงกันแบบ exact, การตรงกันแบบ near-duplicate (เขียนใหม่) และการตรงกันทั้งไฟล์กับ test set ถือเป็น fatal ไม่มีอะไรฝึกจนกว่า mix จะสะอาด
- **Dev-fence** การฝึก **ปฏิเสธที่จะเริ่มโดยไม่มี registered dev set** และจะเลือก checkpoint บน dev set นั้นเท่านั้น — ไม่ใช่ test set (มันยังตรวจสอบเนื้อหาของ dev row กับ test set เพื่อดักจับ trick `cp test.jsonl dev.jsonl` ด้วย) การเลือก checkpoint สามารถใช้ dev **loss** หรือ dev **generation metric** — decode dev set และให้คะแนน output จริง ซึ่งเป็น signal ที่สุจริตกว่า
- **Schedule-sanity** หาก mix ของคุณมี synthetic หนัก เครื่องมือจะ *คำนวณ* stopping floor จากขนาดของ mix และรักษาการฝึกผ่าน **plateau** — ช่วงที่โมเดลเรียนรู้ synthetic ง่ายๆ เสร็จแล้วและยังไม่ได้ถ่ายโอนไปสู่คุณภาพจริง สิ่งนี้ป้องกัน "half-epoch death" ที่ early stopping แบบไม่ระมัดระวังหยุดที่หนึ่งในยี่สิบของแผน ทุก intervention จะพิมพ์ dev-loss trajectory และเหตุผล เป็นภาษาธรรมดา
- **Exposure math + tagged synthetic** ข้อมูล gold ถูก upweight (ทำซ้ำ) เพื่อไม่ให้ข้อมูลจริงที่มีน้อยถูกกลบ manifest บันทึก **effective exposure ต่อประโยค unique** เพื่อให้ A/B ยังคงยุติธรรม แหล่ง synthetic มี tag; gold ไม่มี tag เพื่อให้มันยึด output style

👀 **วิธีอ่านผลลัพธ์** run จะพิมพ์ **dev report พร้อม confidence interval** — ไม่มี output แบบ bare-score:

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

หากคุณเห็นข้อความ `schedule-sanity` ที่อธิบายว่ามัน *รักษา* การฝึกไว้เกินจุดหยุดก่อนกำหนด นั่นคือ plateau guard กำลังทำงาน — ดีมาก run ยังเขียน **manifest** ด้วย: config hash, data file hash, seed และ derived schedule เพื่อให้ run ทั้งหมด reproducible ได้

---

## ขั้นตอนที่ 6 — ประเมินผลอย่างสุจริต

คุณมีโมเดลแล้ว ก่อนที่จะให้คะแนนบน test set คุณต้องเขียนสิ่งที่คาดหวัง — *ก่อน*

> 🗣️ **บอก agent ของคุณ:** *"เขียน preregistration สำหรับการให้คะแนน test set — metric ที่เราคาดการณ์, ทิศทาง และ margin — จากนั้น decode test set และให้คะแนนมัน"*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **สิ่งที่เครื่องมือทำ — anti-storytelling guards**

- **Preregistration** การให้คะแนน **test** set ที่ลงทะเบียนแล้วต้องมี preregistration ที่เขียนขึ้น *ก่อน* การดูครั้งแรก หากไม่มี ตาราง comparison จะ **ปฏิเสธที่จะ render**:

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  นี่คือการป้องกันการแต่งเรื่อง postdiction ("แน่นอนว่ามันดีขึ้นสำหรับเรื่องราวปากเปล่า") ให้ดูเหมือน prediction การเขียนการเดาที่ *ผิด* ลงไปคือสิ่งที่ทำให้การเดาที่ถูกน่าเชื่อถือ
- **Confidence interval เสมอ** ทุกคะแนน render พร้อม 95% bootstrap CI ไม่มี output ที่ไม่มี CI การเพิ่มขึ้น `+0.5` ที่ interval ทับซ้อนกันไม่ถือเป็นชัยชนะ
- **Eval-ledger** ทุกการอ่าน eval set ทุกครั้งถูกบันทึก (append-only, tamper-evident) ถาม `nmt-forge ledger show --set textbook-test` ว่า set นั้น "ถูกใช้ไป" มากแค่ไหน set ที่ **Sealed** ใช้ได้ครั้งเดียว — ให้คะแนนครั้งเดียวแล้วปิด

👀 **วิธีอ่านผลลัพธ์** อ่านตัวเลข **พร้อม interval และแยกตาม register** และตรวจสอบ **metric ที่ควรเชื่อ** ก่อนที่จะดีใจ:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` แสดง **ความน่าเชื่อถือที่วัดได้** ของแต่ละ metric สำหรับ language family ของคุณ (จาก WMT meta-evaluation) สำหรับบาง family metric อย่าง BLEU แทบไม่สะท้อนการตัดสินของมนุษย์ในขณะที่ COMET ทำได้ สำหรับ low-resource family จำนวนมาก คำตอบที่สุจริตคือ *ไม่ได้วัด* — ในกรณีนั้น การตัดสินของเจ้าของภาษา ไม่ใช่ตัวเลขอัตโนมัติใดๆ คือ signal ที่แท้จริง ดูที่ [Metric Reliability](/docs/network/specifications/metric-reliability)

:::tip[referee ของภาษาคุณเอง]
หากภาษาของคุณมีมาตรฐาน eval แบบ LYSS (linter ที่รู้ว่า เช่น การสะกดสองแบบต่างกันเพียงแค่ตามข้อตกลง long-vowel ที่มีเอกสาร) ให้เสียบมันด้วย `--plugin` และมันจะให้คะแนนควบคู่กับ chrF++ — และยังสามารถ *เลือก* checkpoint ได้ด้วย เพื่อให้โมเดลที่ชนะคือโมเดลที่ referee ของภาษานั้นเองชอบ ทุกตัวเลขจาก plugin ก็มี confidence interval เช่นกัน
:::

---

## ขั้นตอนที่ 7 — ปรับปรุงซ้ำ

ตอนนี้คุณปรับปรุง — และทุกการปรับปรุงถูกวัดด้วยวิธีที่สุจริตเหมือนกัน

> 🗣️ **บอก agent ของคุณ:** *"เปลี่ยนสิ่งหนึ่งสิ่ง — เพิ่ม template kind / ข้อมูล backtranslated เพิ่มเติม / base model ที่ต่างออกไป — ฝึกใหม่ และ A/B เทียบกับ run ก่อนหน้าบน dev set พร้อม significance"*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
```

🛠️ **สิ่งที่เครื่องมือทำ** `compare` รัน **paired significance test** ไม่ใช่แค่การลบ เพื่อให้ "B ชนะ A" เป็นการอ้างที่สถิติรองรับ — ไม่ใช่ noise ปรับปรุงซ้ำบน **dev** set (นั่นคือไว้สำหรับสิ่งนั้น); เก็บ **test** set ไว้สำหรับการตรวจสอบที่ไม่บ่อยและ preregistered; เก็บ set ที่ **sealed** ไว้สำหรับตอนสุดท้าย

👀 **วิธีอ่านผลลัพธ์** การปรับปรุงจริงต้องผ่าน confidence interval *และ* significance test หากไม่ผ่าน คุณก็ยังได้เรียนรู้บางอย่าง — ว่า lever นั้นอ่อนแอกว่าที่หวัง ซึ่งเป็นสิ่งที่ควรรู้ guardrail ด้าน plateau/coverage/leak หมายความว่าตัวเลขที่คุณเปรียบเทียบน่าเชื่อถือ ดังนั้นคุณสามารถเชื่อ iteration loop ของตัวเองได้จริงๆ

lever ถัดไปที่พบบ่อย เรียงตามลำดับผลตอบแทนสำหรับภาษาที่ขาดแคลนข้อมูล:

1. **Coverage เพิ่มเติม** ในการสังเคราะห์ — เพิ่มปรากฏการณ์ทางไวยากรณ์ที่ขาดหายไปที่ coverage report ระบุ
2. **Backtranslation** — แปลง monolingual target text เป็นคู่ฝึกเพิ่มเติม
3. **Base model ที่ใหญ่กว่าหรือเหมาะสมกว่า** หรือการปรับ LoRA rank/hyperparameter
4. **Curriculum** — pretrain บน synthetic จากนั้น finetune บนคู่ประโยคจริง

---

## ขั้นตอนที่ 8 — นำไปสู่ Network

โมเดลที่ฝึกอย่างสุจริตคือสิ่งที่ [Champollion Network](/docs/network/) สร้างขึ้นมาเพื่อรับ

> 🗣️ **บอก agent ของคุณ:** *"Package โมเดลนี้เป็น method และส่งไปยัง leaderboard สำหรับคู่ภาษาของเรา"*

- **[Submit a Method](/docs/network/getting-started/submit-a-method)** เปลี่ยนโมเดลของคุณให้เป็น Network entry ที่ให้คะแนนบน public reference corpora และระบุว่าเป็นของคุณ
- เนื่องจากการประเมินของคุณสะอาด — group-disjoint, dev-fenced, leak-audited, CI'd, preregistered — การส่งของคุณจะผ่านการตรวจสอบที่ทำให้ low-resource MT claim ส่วนใหญ่ล้มเหลว สถาปัตยกรรม anti-gaming (test set ลับที่ชุมชนเป็นเจ้าของ, การตรวจสอบ reproducibility, การตรวจสอบโดยเจ้าของภาษา) ไม่ใช่อุปสรรคสำหรับโมเดลที่สร้างด้วยวิธีนี้ แต่เป็นตราประทับความน่าเชื่อถือ
- หาก **รางวัล** เปิดอยู่สำหรับภาษาของคุณ method ที่ยืนหยัดและดีกว่า baseline ที่สร้างอย่างสุจริตคือสิ่งที่ sponsored pool ให้รางวัล และเมื่อ method ใช้ได้ผลสำหรับภาษาพื้นเมือง **ความเป็นเจ้าของสามารถโอนไปยังชุมชนได้** — คุณสร้างที่นี่และพวกเขา deploy มัน ตามเงื่อนไขของพวกเขา ดูที่ [Prize Specification](/docs/network/specifications/prizes) และ [Ownership Transfer](/docs/network/sovereignty/ownership-transfer)

---

## ภาพรวมทั้งหมด ในหนึ่งประโยค

1. **ค้นพบ** ว่าภาษามีอะไร (`discover`, `init`) — การไม่มีข้อมูลคือไม่ทราบ ไม่ใช่ศูนย์
2. **ชี้ไปที่** analyzer + พจนานุกรมหากมี (ขั้นที่ 3–4) โดยเคารพใบอนุญาตของมัน
3. **สังเคราะห์** ข้อมูลฝึกที่ผ่านการตรวจสอบ อ้างอิง และตรวจสอบ coverage แล้ว (`synth`) — หรือ **backtranslate** ข้อความ monolingual
4. **แบ่ง** ข้อมูลจริงแบบ group-disjoint และลงทะเบียน eval set (`split`)
5. **ฝึก** ด้วย config เดียว, dev-fenced, leak-audited, plateau-aware (`run`)
6. **ประเมิน** โดยเขียน prediction ก่อน, CI เสมอ, metric ที่ถูกต้อง (`prereg`, `score`)
7. **ปรับปรุงซ้ำ** ด้วย A/B ที่ผ่าน significance test (`compare`)
8. **ส่ง** ไปยัง Network — ที่ซึ่งงานที่สุจริตคือจุดประสงค์

คุณไม่จำเป็นต้องจำสิบวิธีที่ผลลัพธ์ low-resource MT ผิดพลาด เครื่องมือทำให้เส้นทางที่สุจริตเป็นค่าเริ่มต้นและปฏิเสธทางลัดพร้อมคำอธิบาย นั่นคือแนวคิดทั้งหมด: **guardrail ดักจับข้อผิดพลาดของมือใหม่ เพื่อให้คุณสามารถมุ่งเน้นที่ภาษา**

## อ่านต่อ

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — ทุกคำที่ใช้ที่นี่ นิยามพร้อมตัวอย่าง
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — guardrail ทั้งสิบข้อในหน้าเดียว แต่ละข้อพร้อมเรื่องราวเบื้องหลังที่วัดได้
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) และ [**Back-Translation**](/docs/network/tutorials/back-translation) — cookbook เชิงลึกสำหรับเทคนิคเฉพาะ
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — การสร้างข้อมูลจริงที่ทุกสิ่งอื่นพึ่งพา
