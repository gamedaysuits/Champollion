---
sidebar_position: 9
title: "จัดการแข่งขันแบบอิสระ"
slug: /network/sovereignty/run-a-sovereign-contest
description: "เส้นทางแบบ self-serve ครบวงจร สำหรับชุมชนหรือองค์กรที่ต้องการจัดการแข่งขัน MT โดยใช้คลังข้อมูลที่ปิดผนึกและสงวนไว้ของตนเอง — โดยที่ Champollion ไม่ต้องถือครองข้อมูลหรือเงินรางวัลแต่อย่างใด"
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# จัดการแข่งขันแบบ Sovereign

> **สรุปสำหรับผู้บริหาร** ชุมชนหรือองค์กรสามารถจัดการแข่งขันประเมินผล — รวมถึงรางวัลที่มีผู้สนับสนุน — โดยใช้ชุดข้อมูลทดสอบที่สงวนไว้ซึ่ง **ไม่เคยออกจากโครงสร้างพื้นฐานของตนเอง** คุณสร้างชุดข้อมูล เข้ารหัส โฮสต์ และถือกุญแจเอง Network บันทึกเพียงการ์ดข้อมูลเมตาที่ไม่มีเนื้อหา และ digest ของ ciphertext เท่านั้น วิธีการต้องผ่านการคัดเลือกจากชุดข้อมูลสาธารณะก่อน ทุกการรันกับชุดข้อมูลที่ปิดผนึกต้องได้รับอนุญาตจากผู้ดูแลของคุณ และมีเพียง **คะแนน** เท่านั้นที่ถูกเผยแพร่ออกมา เงินรางวัลอยู่ใน **ความดูแลของผู้สนับสนุน** — โดยองค์กรของคุณหรือกองทุนที่คุณกำหนด — และ **Champollion ไม่แตะต้องเงินหรือข้อมูลเลย** หน้านี้คือคู่มือการดำเนินการแบบครบวงจรที่คุณจัดการเองได้

:::warning[สิ่งที่พร้อมใช้งานในปัจจุบัน vs. ที่อยู่ระหว่างพัฒนา]
ควรทำความเข้าใจให้ชัดเจนก่อนเริ่มต้น — นี่คือโครงการวิจัยที่กำลังพัฒนาและไม่มีวัตถุประสงค์เชิงพาณิชย์
เราต้องการให้คุณตรวจสอบเราแทนที่จะเชื่อใจเราโดยไม่มีข้อสงสัย:

- ✅ **Live:** การลงทะเบียน corpus (metadata cards, hash-pinning, exposure
  lanes), sealed-set registry (digest + custodian group + qualifier, ไม่มี
  เนื้อหา), กลไกการแข่งขันพร้อม sealed lane, ชั้นข้อมูล authorization
  request/grant/audit (รอดำเนินการ → การตัดสินใจแบบ M-of-N → สิทธิ์การใช้งานแบบครั้งเดียว
  ที่กำหนดเวลา, audit log แบบ append-only hash-chained), และการปล่อยเฉพาะคะแนน
  (scores-only emission) ที่บังคับใช้ในระดับฐานข้อมูล
- ✅ **Live: organizer scoring node + hypotheses lane.** คำสั่ง
  เดียวจะแบ่ง corpus ของคุณออกเป็น public dev set (qualifier), blind
  test set (เปิดเผย source, ปิดผนึก references ไว้ในเครื่องของคุณ), และ
  อาจมี fully-secret set (`mt-eval contest prepare`) การลงทะเบียน
  sealed set(s), qualifier, และการแข่งขันเป็นแบบ **บริการตนเองจากการ
  ลงชื่อเข้าใช้ของคุณเอง** — `contest prepare --self-serve`, หรือ `mt-eval contest register
  --manifest` สำหรับการแข่งขันที่คุณเตรียมไว้ก่อนหน้านี้ — โดยทุกแถว
  จะผูกกับข้อมูลระบุตัวตนที่ระดับฐานข้อมูล; ไม่มี curator เข้ามาเกี่ยวข้องและไม่มี
  privileged key (ดูขั้นตอนที่ 4 สำหรับข้อจำกัดตามความเป็นจริง) ผู้เข้าร่วม
  ส่งคำแปลของตนด้วย `mt-eval contest submit-hypotheses` (CLI
  จะให้คะแนน dev set ด้วยตนเองในเครื่องและปฏิเสธการอัปโหลดที่ต่ำกว่าเกณฑ์ของคุณ);
  self-hosted node ของคุณ (`mt-eval node serve`) จะให้คะแนน dev evidence
  ใหม่อีกครั้งด้วยตัวเอง, คัดกรองตาม qualifier, อนุมัติตามโมเดลการแข่งขันของคุณ
  (`per-submission` — custodian อนุมัติการให้คะแนนแต่ละครั้ง — หรือ `blanket` /
  `open`), ให้คะแนน blind set เทียบกับ references ที่ไม่เคยออกจาก
  เครื่องของคุณ, และเผยแพร่ run cards แบบ **aggregates-only** สิ่งที่ lane นี้
  ไม่ได้พิสูจน์คือ: วิธีการที่ระบุชื่อเป็นตัวสร้าง hypotheses (ข้อมูลระบุตัวตนของวิธีการคือ
  สิ่งที่ผู้เข้าร่วมอ้างและถูกติดป้ายกำกับไว้เช่นนั้นในทุก run card), และไม่สามารถ
  หยุดยั้งผู้ไม่ประสงค์ดีที่มุ่งมั่นในการดึงสัญญาณ reference จากการส่งผลงานที่แตกต่างกันหลายๆ ครั้งได้ — rate limits, byte-identical dedup, และ audit chain จะช่วยชะลอ
  สิ่งนั้นลง; method-execution lane ด้านล่างคือคำตอบที่แท้จริง
- ✅ **Live: two secret-set method lanes.** ผู้เข้าร่วมที่มีประวัติ
  hypotheses-lane ที่เผยแพร่แล้วสามารถเสนอวิธีการของตนเทียบกับ secret set ของคุณได้
  node จะเลือก lane จากการส่งผลงาน:
  - **Lane A — declarative model (แนะนำ).** โมเดลนิวรัลมาตรฐานคือ
    ข้อมูล: `mt-eval contest submit-model` ส่ง safetensors weights +
    declarative tokenizer + config — **ไม่มีโค้ด, ไม่มี Dockerfile.** node ของคุณ
    จะตรวจสอบว่าไม่มีโค้ด (safetensors ไม่ใช่ pickle; ไม่มี
    `trust_remote_code`/`auto_map`; มีเฉพาะไฟล์ข้อมูล) และรัน weights ใน
    trusted engine ของตัวเอง (`transformers`, `trust_remote_code=False`, ออฟไลน์)
    สถาปัตยกรรมจะเปิดกว้างโดยค่าเริ่มต้น (สถาปัตยกรรมใดๆ ที่ engine ของคุณโหลดได้แบบเนทีฟ);
    โฮสต์ที่ระมัดระวังสามารถปักหมุด allowlist ได้ จะไม่มีสิ่งที่ไม่น่าเชื่อถือถูกรัน ดังนั้น
    จึงไม่มีอะไรต้องทำ sandbox เผยแพร่ `declarative-model`, ข้อมูลระบุตัวตนของวิธีการ
    **ปราศจากโค้ดโดยโครงสร้าง**
  - **Lane B — runnable bundle (sandbox fallback).** สำหรับวิธีการที่เป็นโค้ด:
    `mt-eval contest submit-method` ส่ง Dockerfile + entrypoint หลังจากที่
    custodian ของคุณอนุมัติ, node ของคุณจะรันมันภายในคอนเทนเนอร์ที่
    แยกเครือข่าย (`--network=none` — ไม่มี network stack อยู่ภายใน;
    root แบบอ่านอย่างเดียว, ตัด capabilities ทิ้ง, สภาพแวดล้อมที่ถูกทำความสะอาด), พร้อม
    การตรวจสอบแบบสแตติกอัตโนมัติก่อน และ references จะไม่เข้าไปในคอนเทนเนอร์เลย
    เผยแพร่ `method-execution` พร้อมข้อมูลระบุตัวตนที่ **ตรวจสอบการทำงานแล้ว**
  ไม่ว่าจะเป็น lane ใด: bundle hash จะถูกแช่แข็งไว้ใน authorization request (สิ่งที่
  รันคือสิ่งที่ถูกเสนออย่างพิสูจน์ได้), และคะแนนจะเผยแพร่ผ่านเส้นทาง
  aggregates-only เดียวกัน เพื่อการแยกส่วนสูงสุด เครื่องให้คะแนนสามารถเป็น
  airgap ที่แท้จริงได้: คำขอที่ได้รับอนุญาตและ scores-only bundles ที่ลงนามด้วย Ed25519 จะข้ามผ่าน
  สื่อที่ถอดออกได้ (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  ข้อความลับจะไม่ไปถึงแม้แต่เครื่องที่เชื่อมต่ออยู่ สิ่งที่ lanes เหล่านี้
  ยังไม่รวมถึง: hardware attestation ของ node (ข้อมูลระบุตัวตนเป็นการรายงานด้วยตนเอง),
  กลไกการโต้แย้งอย่างเป็นทางการ, และ — สำหรับ Lane B โดยเฉพาะ — การเสริมความแข็งแกร่งของคอนเทนเนอร์
  ที่ลึกซึ้งยิ่งขึ้นนอกเหนือจากการลบ network stack (seccomp profiles, microVMs; นี่
  คือเหตุผลที่ควรเลือก Lane A) ดู
  [Honest Limitations](/docs/network/honest-limitations)
- 🔲 **In development: threshold signing.** การอนุมัติของ custodian แบบ M-of-N
  ถูก *บันทึก* ไว้ในตาราง authorization และ audit ในปัจจุบัน; เครื่องมือ
  cryptographic threshold-key ที่ทำให้ไม่สามารถสร้างสิทธิ์ได้หากไม่มี M shares นั้น
  ยังไม่ได้ถูกสร้างขึ้น — sealing key ปัจจุบันเป็นตัวแทนแบบ single-keypair ที่มีป้ายกำกับ
  (`champollion seal-corpus keygen`), และลายเซ็น airgap score-bundle
  เป็น node key เดี่ยว (`seal-corpus sign-keygen`), ไม่ใช่พิธีการของ steward
- ❌ **Not a thing, by design:** Champollion โฮสต์ corpus ของคุณ, เก็บ
  keys ของคุณ, หรือเก็บเงินรางวัล hypotheses ของผู้เข้าร่วม (คำแปลของพวกเขาเอง)
  จะส่งผ่านพื้นที่จัดเก็บข้อมูลของเรา; แต่เนื้อหา corpus ของคุณจะไม่เคยส่งผ่านเลย

หากขั้นตอนใดด้านล่างขึ้นอยู่กับสิ่งที่อยู่ในรายการ 🔲 ขั้นตอนนั้นจะระบุไว้ชัดเจน
:::

---

## รูปแบบของข้อตกลง

| ใคร | ถือครอง | ไม่ถือครอง |
|-----|-------|-------------|
| **คุณ (ชุมชน/องค์กร)** | ชุดข้อมูล, กุญแจเข้ารหัส (ผ่าน custodians ของคุณ), เงินรางวัล, การตัดสินรางวัล | — |
| **Champollion / Network** | การ์ดข้อมูลเมตา, ciphertext digest, บันทึก authorization + audit, คะแนนที่เผยแพร่ | เนื้อหาชุดข้อมูลของคุณ, กุญแจของคุณ, เงินของคุณ |
| **นักพัฒนาวิธีการ** | วิธีการของตน | ข้อมูลทดสอบของคุณ — พวกเขาเห็นคะแนน ไม่เห็นประโยค |

ทุกอย่างด้านล่างคือการขยายความเชิงกลไกของตารางนั้น

---

## ข้อกำหนดเบื้องต้นสำหรับผู้จัดการแข่งขัน

ก่อนขั้นตอนที่ 1 ควรทราบว่าการรัน node จริงนั้นต้องการอะไรบ้าง:

- **docker หรือ podman** — จำเป็นสำหรับ method-execution lane โดย node จะตรวจหา docker ก่อน แล้วจึงตรวจหา podman หากไม่พบทั้งคู่จะปฏิเสธการทำงานพร้อมแสดงข้อความแจ้งเตือนอย่างชัดเจน
  ไม่มี **fallback** — การแยกส่วนด้วย container ผ่าน `--network=none` คือหลักประกันหลักของระบบ ดังนั้นจะไม่มีอะไรทำงานได้หากไม่มี container runtime
- **Node.js 20.11+ และ `champollion` npm CLI** — harness ไม่ได้ implement sealing cipher ขึ้นมาใหม่ `champollion seal-corpus` (คำสั่ง: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) คือ cipher implementation เดียว (X25519-ECDH → HKDF-SHA256 → AES-256-GCM) และ organizer node จะเรียกใช้งานผ่าน shell
- **ไฟล์ node config ที่ `~/.mt-eval/node.json`** ทุกคำสั่ง `mt-eval node`
  จะปฏิเสธการเริ่มต้นหากไม่มีไฟล์นี้ — รันคำสั่งใดก็ได้หนึ่งครั้งแล้วข้อความ error จะระบุ path ของ config และตำแหน่งของ template (ซึ่งมาพร้อมกับ harness source ใน `mt_eval_harness/contest_node.py`) config จะเก็บ `node_id` ที่คุณรายงานด้วยตนเอง (ผูกไว้ใน request fingerprint ทุกรายการ) และ `contests` map ที่ชี้ไปยัง dev references และ sealed artifacts ของคุณ
- **การลงชื่อเข้าใช้** ไม่มีขั้นตอนสร้างบัญชีแยกต่างหาก: คำสั่งแรกที่ต้องการ identity (เช่น `mt-eval contest prepare --self-serve` หรือ
  `mt-eval publish`) จะเปิดหน้าต่าง browser สำหรับ OAuth sign-in ผ่าน **GitHub หรือ Google**
  (Supabase Auth) โดย email ของบัญชีนั้นคือ identity ที่ผูกกับทุก registry row — ใช้บัญชีที่องค์กรของคุณควบคุมได้
- **intake throttle** การส่งผลงานของผู้เข้าร่วมถูกจำกัดอัตราต่อผู้ส่งที่ **5 ครั้งต่อ 24 ชั่วโมงโดยค่าเริ่มต้น** (เพื่อป้องกันการ probe; กำหนดต่อการแข่งขันด้วย `--intake-daily-limit` ในขั้นตอน prepare หรือเป็นค่าเริ่มต้นของ shared-task edition) วางแผนระยะเวลาการแข่งขันของคุณให้สอดคล้องกับข้อจำกัดนี้

**ข้อควรระวังที่ต้องทราบเกี่ยวกับการลงทะเบียนด้วยตนเอง** บน **endpoint ที่โฮสต์บนเครือข่ายเริ่มต้น** การลงทะเบียนด้วยตนเอง (`contest prepare
--self-serve` / `contest register`) ในปัจจุบันจะหยุดที่ production-endpoint guard: CLI จะปฏิเสธพร้อมแสดงข้อความชัดเจนแทนที่จะเขียนข้อมูลไปยัง production project โดยรอการตัดสินใจด้านนโยบายในการเปิดช่องทางนั้น Federated hosts (Supabase project ของคุณเอง) ไม่ได้รับผลกระทบ หากคุณพบ guard บน default host นั่นคือสถานะปัจจุบันของระบบ ไม่ใช่การตั้งค่าผิดพลาดจากฝั่งคุณ — [เปิด issue](https://github.com/gamedaysuits)
แล้วเราจะช่วยดำเนินการลงทะเบียนให้

---

## Step 1 — สร้างชุดข้อมูลทดสอบที่สงวนไว้

ออกแบบชุดข้อมูลที่คุณจะใช้วัดผล และสงวนไว้ตั้งแต่วันแรก: ไม่มีสิ่งใดในนั้นที่ควรเคยถูกเผยแพร่, โพสต์ หรือแชร์กับผู้ให้บริการโมเดลมาก่อน

- ปฏิบัติตาม [Corpus Design Framework](/docs/network/specifications/corpus-design) สำหรับโครงสร้าง entry, ระดับความยาก และการครอบคลุม register และ [Corpus Creation cookbook](/docs/network/tutorials/corpus-creation) สำหรับเครื่องมือ
- ให้ผู้พูดที่คล่องแคล่วตรวจสอบ entries ก่อนปิดผนึก — [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) อธิบายโครงสร้างการตรวจสอบที่คุณสามารถนำมาใช้ซ้ำสำหรับ QA ของชุดข้อมูล ไม่ใช่แค่การตรวจสอบวิธีการ
- กำหนดป้ายกำกับ **version** ของชุดข้อมูลตอนนี้ (เช่น `v1`) authorization grants ถูกผูกกับ version เฉพาะ ดังนั้น versioning เป็นส่วนหนึ่งของโมเดลความปลอดภัย ไม่ใช่แค่การจัดระเบียบ

## Step 2 — เข้ารหัสและโฮสต์บนโครงสร้างพื้นฐานของคุณเอง

เข้ารหัสชุดข้อมูลขณะพักเก็บ (ด้วย AEAD scheme สมัยใหม่ใดก็ได้ — เช่น `age`/x25519 หรือ AES-256-GCM) และโฮสต์ **ciphertext** ในที่ที่คุณควบคุม Champollion ไม่เคยรับ plaintext *หรือ* ciphertext

เผยแพร่เพียงสิ่งเดียว: **SHA-256 digest ของ ciphertext blob**

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

digest เป็นสาธารณะ แต่ข้อมูลไม่ใช่ ทุกคนสามารถตรวจสอบในภายหลังได้ว่า blob ที่ใช้ประเมินผลนั้นเหมือนกันทุก byte กับ blob ที่คุณปิดผนึก — ความสมบูรณ์โดยไม่ต้องครอบครอง นี่คือวินัย hash-instead-of-copy เดียวกับ [การลงทะเบียนชุดข้อมูลทั่วไป](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content)

## Step 3 — ลงทะเบียนการ์ดข้อมูลเมตา

ลงทะเบียนชุดข้อมูลผ่าน [registration lane](/docs/network/sovereignty/registering-corpora) มาตรฐานแบบ fail-private: การ์ดที่มี `language_pair`, `license`, `attribution` และ `do_not_train` — **ไม่มีประโยค** เลือก exposure lane แบบ **private** การลงทะเบียน sealed set ในขั้นตอนถัดไปคือสิ่งที่ทำให้มีสิทธิ์เข้าร่วมการแข่งขัน

## Step 4 — ลงทะเบียนเป็น sealed set

sealed set คือ registry entry ที่ไม่มีเนื้อหา ซึ่งบันทึกสิ่งสามอย่างไว้ในบันทึกสาธารณะ:

| Field | สิ่งที่คุณผูกพัน |
|-------|------------------------|
| `ciphertext_digest` | bytes ที่แน่นอนซึ่งนับเป็น "ชุดข้อมูล" |
| `custodian_group_id` | opaque id สำหรับกลุ่มที่ควบคุมการเข้าถึง (ไม่ใช่ชื่อองค์กร/ชาติสาธารณะก่อนได้รับความยินยอม) |
| `current_qualifier_id` | รอบสาธารณะที่วิธีการต้องผ่านก่อนที่จะสามารถเสนอ sealed run ได้ |

การลงทะเบียนเป็น **self-serve จาก sign-in ของคุณเอง** — ไม่มีผู้ดูแลเข้ามาเกี่ยวข้องและไม่มีกุญแจพิเศษ:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

manifest อยู่บนเครื่องของคุณ — การลงทะเบียนส่งเฉพาะ ids, digests และ thresholds ที่ไม่มีเนื้อหา ทุก registry row ถูก **ผูกกับ identity**: ฐานข้อมูลบันทึก account ที่ sign-in ซึ่งลงทะเบียนและตรึง binding นั้นไว้กับการแก้ไขในภายหลัง และ qualifier สามารถกำหนดเงื่อนไขให้ sealed set ได้เฉพาะที่ **identity เดียวกัน** ลงทะเบียนไว้เท่านั้น Sealed sets ถูกสร้างมาในสถานะ quarantined (ไม่สามารถสนับสนุนการแข่งขันทั่วไปหรือจัดอันดับบน public leaderboard ได้) qualifiers ถูกสร้างมาในสถานะปลอดภัย และการลงทะเบียนมี rate-limit — ทั้งหมดบังคับใช้โดย database triggers ใต้ทุก client รวมถึงของเราด้วย รีจิสทรีเองอ่านได้สาธารณะ ดังนั้นคุณสามารถตรวจสอบได้ว่า entry ของคุณระบุสิ่งที่คุณปิดผนึกไว้จริง — และไม่มีอะไรมากกว่านั้น

**ขีดจำกัดที่ซื่อสัตย์** ประตู self-serve ใช้ได้เฉพาะการลงทะเบียน (insert-only ที่ชั้นฐานข้อมูล) **การหมุนเวียน qualifier และการเลิกใช้ sealed set ยังคงต้องผ่านผู้ดูแล** — เปิด issue หรือติดต่อโครงการผ่าน [GitHub](https://github.com/gamedaysuits) และการรัน organizer scoring node ในขั้นตอนถัดไป (lifecycle advances, authorization grants, audit operations) เป็น lane ที่ใช้ service credential แยกต่างหากบน node ของคุณเอง — self-serve หยุดที่ public record

## Step 5 — เลือก custodians และกฎ M-of-N

เลือกบุคคลหรือสถาบันที่ต้องอนุมัติร่วมกันสำหรับทุกการประเมินกับชุดข้อมูลของคุณ และกำหนด threshold (เช่น **3 จาก 5**) Custodians ควรรับผิดชอบต่อชุมชนของคุณ ไม่ใช่ต่อ Champollion — ดู [Data Stewardship](/docs/network/sovereignty/data-sovereignty) และ [Ownership & Terms](/docs/network/sovereignty/ownership-transfer) สำหรับวิธีการกำหนดเงื่อนไขต่อชุมชน

**กล่องความซื่อสัตย์:** เครื่องมือ threshold-*cryptography* (key shares ที่ทำให้ grant ไม่สามารถสร้างได้จริงหากไม่มี M signatures) **อยู่ระหว่างพัฒนา** ในปัจจุบัน กฎ M-of-N บังคับใช้เป็นกระบวนการที่บันทึกไว้: ทุก access request เข้าสู่คิว **pending**, การตัดสินใจของ custodian ถูกบันทึก, grant ถูกสร้างเฉพาะสำหรับ request ที่ได้รับอนุญาต, แต่ละ grant เป็น **single-use, time-boxed และผูกกับ fingerprint เฉพาะหนึ่งรายการ (method, corpus version, evaluation node)** และทุก event — รวมถึงความพยายามที่ถูกบล็อก — ลงใน **append-only, hash-chained, publicly readable audit log** ฐานข้อมูลปฏิเสธการเปลี่ยนสถานะที่ผิดกฎใต้ทุก client และ key สิ่งที่ยังไม่สามารถปฏิเสธได้คือการถูก compromise ของ platform operator เอง — นั่นคือสิ่งที่ threshold signing จะแก้ไข และจนกว่าจะพร้อมใช้งาน คุณควรถือว่า "Champollion ถือ zero key shares" เป็นเป้าหมายการออกแบบที่กำลังสร้าง ไม่ใช่คุณสมบัติที่คุณสามารถตรวจสอบได้ในวันนี้

## Step 6 — กำหนดรางวัล

ตัดสินใจและเผยแพร่พร้อมกับการแข่งขัน:

- **จำนวนเงินและสกุลเงิน**
- **ผู้สนับสนุน** — ใครเป็นผู้ออกเงิน
- **ที่เก็บเงิน** — บัญชีขององค์กรของคุณ หรือกองทุนชุมชนที่คุณกำหนด **Champollion ไม่เคยถือ, escrow หรือส่งต่อเงินรางวัล** การเผยแพร่ identity ของผู้ถือล่วงหน้าคือสิ่งที่ทำให้รางวัลน่าเชื่อถือ ดู [หมายเหตุความเสี่ยงกรณีผู้สนับสนุนผิดนัด](/docs/network/sovereignty/terms-templates#trojan-horse-risks) ใน terms templates
- **เงื่อนไข threshold** — คะแนนที่วิธีการต้องผ่าน เขียนตาม [Prize Specification](/docs/network/specifications/prizes): metric thresholds, ข้อกำหนด speaker-validation, reproducibility กำหนดเงื่อนไขการมอบรางวัลให้ตรวจสอบได้จากคะแนนที่เผยแพร่ เพื่อที่ไม่มีใครต้องเชื่อคำพูดของคุณ (หรือของเรา) ว่าผ่านเกณฑ์หรือไม่

## Step 7 — สร้างการแข่งขัน

การแข่งขันบน sealed sets ใช้ **sealed lane** อย่างชัดเจน การมีสิทธิ์เข้าร่วมเป็นแบบ fail-closed: การแข่งขันจะถูกปฏิเสธหากการลงทะเบียน sealed set ของคุณไม่มีอยู่หรือไม่ active — และการสร้างการแข่งขันไม่ได้ให้สิทธิ์ **ใคร** เข้าถึงชุดข้อมูลเลย

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(ค่า `--corpus` คือ `sealed_set_id` ที่คุณลงทะเบียนไว้ sealed lane ถูกเลือก **โดยอัตโนมัติ** จากการลงทะเบียน sealed set — ไม่ต้องใช้ flag เพิ่มเติม sealed set ไม่สามารถสนับสนุนการแข่งขันทั่วไปได้ และ quarantined dataset ทั่วไปไม่สามารถสนับสนุนการแข่งขันใดๆ ได้ ทั้งสองกฎบังคับใช้ในฐานข้อมูลใต้ทุก client หากคุณลงทะเบียนใน Step 4 ด้วย `contest register` หรือ `prepare --self-serve` row ของการแข่งขัน **มีอยู่แล้ว** — ข้ามขั้นตอนนี้ไป `contest create` ด้วยตนเองใช้เฉพาะสำหรับการประกอบการแข่งขันจาก sealed set ที่ลงทะเบียนไว้แล้ว)*

## Step 8 — วิธีการต้องผ่านการคัดเลือกจากสาธารณะก่อน

นักพัฒนาสร้างและให้คะแนนวิธีการของตนบนชุดข้อมูล **สาธารณะ** สำหรับคู่ภาษาของคุณ — ผ่านเส้นทาง [submit-a-method](/docs/network/getting-started/submit-a-method) ปกติ `current_qualifier_id` ของ sealed set ของคุณระบุรอบสาธารณะที่วิธีการต้องผ่านก่อนที่จะสามารถขอ sealed run ได้ สิ่งนี้ช่วยลดแรงกดดันในการสำรวจชุดข้อมูลของคุณ: ไม่มีใครสามารถมุ่งเป้าไปที่ sealed set ได้จนกว่าจะแสดงประสิทธิภาพจริงในที่เปิดเผย

:::note[ผู้เข้าร่วม: การแข่งขันของคุณอยู่บน endpoint ใด?]
การแข่งขันที่ **โฮสต์บนเครือข่าย** ไม่ต้องการการตั้งค่าใดๆ — endpoint เริ่มต้นที่มาพร้อมกับ harness มีระบบการแข่งขันครบถ้วน (hypotheses intake, qualifier gate, method proposals) และ `mt-eval contest submit-hypotheses` /
`submit-method` ทำงานได้ทันทีโดยไม่ต้องตั้งค่าเพิ่มเติม

การแข่งขันแบบ **federated** — ผู้จัดงานรันกลไกบน Supabase project ของตนเอง ดังนั้นการส่งจึงไม่ผ่านของเรา — เผยแพร่ endpoint พร้อมกับเอกสารการแข่งขัน ส่งออกก่อนส่งผลงาน:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

หาก harness ชี้ไปยัง endpoint ที่ไม่มีกลไกการแข่งขัน (เช่น federated host ที่ขาด migration) คำสั่งจะหยุดพร้อมข้อความ *"the contest lane isn't available on this Supabase endpoint yet"* และบอกคุณว่ากำลังคุยกับ endpoint ใด (ผู้จัดงานแบบ federated: เผยแพร่สองค่านี้ควบคู่กับการเผยแพร่ corpus ของคุณ, `--node-id` และ `--corpus-version`)
:::

## Step 9 — Sealed runs: ขอ, อนุมัติ, รัน, ส่งออกคะแนน

สำหรับแต่ละวิธีการที่ผ่านการคัดเลือก:

1. **request** ถูกยื่นกับ sealed set ของคุณ — มันเข้าสู่ `pending` และมี fingerprint ที่ไม่เปลี่ยนแปลงของ (method tarball hash, corpus id, corpus version, `scores-only`, evaluation-node measurement)
2. **custodians ของคุณตัดสินใจ** (M-of-N) การอนุมัติสร้าง **grant**: single-use, มีวันหมดอายุ, ใช้ได้เฉพาะกับ fingerprint นั้นเท่านั้น
3. การประเมินรันใน network-isolated sandbox บน node **ของคุณ** (`mt-eval node run-method`): automated static checks, container ที่ไม่มี network stack, references ถูกเก็บไว้ภายนอก — หรือสำหรับการแยกตัวสูงสุด บน true-airgap machine พร้อม signed scores-only bundles ที่ส่งผ่านสื่อแบบถอดได้ (ดูกล่องสถานะด้านบนสำหรับสิ่งที่ครอบคลุมและไม่ครอบคลุม)
4. **มีเพียงคะแนนที่ออกมา** กฎการปล่อย `scores-only` ถูกตรึงที่ชั้นฐานข้อมูล ข้อความต่อ entry จากชุดข้อมูลของคุณไม่เคยถูกเผยแพร่
5. ทุกขั้นตอน — request, votes, grant, การใช้งาน และความพยายามที่ถูกบล็อก — ถูก append ไปยัง public, hash-chained audit log ที่คุณ (และทุกคน) สามารถ replay ได้

## Submitting a method (for participants) — two lanes
## การส่งวิธีการ (สำหรับผู้เข้าร่วม) — สอง lanes

Most NMT entries are not exotic: a standard fine-tuned transformer and its
weights. For those, there is a **preferred, code-free lane** — and a sandbox
fallback for methods that genuinely are code.

ผลงาน NMT ส่วนใหญ่ไม่ได้แปลกใหม่: เป็น standard fine-tuned transformer และ
weights ของมัน สำหรับสิ่งเหล่านั้น จะมี **preferred, code-free lane** — และ sandbox
fallback สำหรับวิธีการที่เป็นโค้ดจริงๆ

### Lane A — declarative model (preferred for standard NMT)
### Lane A — declarative model (แนะนำสำหรับ NMT มาตรฐาน)

If your method is a standard neural model, you submit it as **data** — the
weights, tokenizer, and config — and the organizer runs it in their own trusted
inference engine. **No Dockerfile, no code, no sandbox.** Because nothing you
submit executes, the organizer's safety check is a decidable format validation
instead of trying to prove arbitrary code is safe — a strictly stronger
guarantee for you and for the corpus.

หากวิธีการของคุณเป็นโมเดลนิวรัลมาตรฐาน คุณจะส่งมันเป็น **ข้อมูล** —
weights, tokenizer, และ config — และผู้จัดงานจะรันมันใน trusted
inference engine ของพวกเขาเอง **ไม่มี Dockerfile, ไม่มีโค้ด, ไม่มี sandbox.** เนื่องจากไม่มีสิ่งใดที่คุณ
ส่งไปถูกรัน การตรวจสอบความปลอดภัยของผู้จัดงานจึงเป็นการตรวจสอบรูปแบบที่ตัดสินใจได้
แทนที่จะพยายามพิสูจน์ว่าโค้ดที่กำหนดเองนั้นปลอดภัย — ซึ่งเป็นการรับประกันที่
แข็งแกร่งกว่าอย่างเคร่งครัดสำหรับคุณและสำหรับ corpus

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

The rules your bundle must satisfy (validated locally before upload, and again
by the organizer's node):

กฎที่ bundle ของคุณต้องปฏิบัติตาม (ตรวจสอบในเครื่องก่อนอัปโหลด, และอีกครั้ง
โดย node ของผู้จัดงาน):

- **Weights are `safetensors`, never pickle.** A PyTorch `.bin`/`.pt`/`.ckpt`
  is a pickle — arbitrary code on load — and is refused. Export to
  `model.safetensors` (`safetensors` / `transformers` do this natively).
- **An architecture the organizer's engine loads natively.** `config.json`'s
  `architectures` can be any architecture the host's `transformers` implements
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, and many more) — hosts are
  **permissive by default**, because with `trust_remote_code=False` the safety
  comes from the code-free format, not the architecture name (an unsupported
  architecture simply fails to load, running nothing). A careful host may
  publish an allowlist. No `auto_map`, no `trust_remote_code` — those smuggle
  custom code back in and are always refused.
- **A declarative tokenizer** (`tokenizer.json` or a `sentencepiece` `.model` +
  vocab), and **data files only** — no `.py`/scripts/binaries in the bundle.

- **Weights เป็น `safetensors`, ไม่ใช่ pickle เด็ดขาด.** PyTorch `.bin`/`.pt`/`.ckpt`
  คือ pickle — โค้ดที่กำหนดเองเมื่อโหลด — และจะถูกปฏิเสธ ให้ส่งออกเป็น
  `model.safetensors` (`safetensors` / `transformers` ทำสิ่งนี้ได้แบบเนทีฟ)
- **สถาปัตยกรรมที่ engine ของผู้จัดงานโหลดได้แบบเนทีฟ.** `architectures` ของ `config.json`
  สามารถเป็นสถาปัตยกรรมใดๆ ที่ `transformers` ของโฮสต์รองรับ
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, และอื่นๆ อีกมากมาย) — โฮสต์จะ
  **เปิดกว้างโดยค่าเริ่มต้น**, เพราะด้วย `trust_remote_code=False` ความปลอดภัย
  มาจากรูปแบบที่ปราศจากโค้ด, ไม่ใช่ชื่อสถาปัตยกรรม (สถาปัตยกรรมที่ไม่รองรับ
  จะแค่โหลดไม่สำเร็จ, ไม่มีการรันใดๆ) โฮสต์ที่ระมัดระวังอาจ
  เผยแพร่ allowlist ไม่มี `auto_map`, ไม่มี `trust_remote_code` — สิ่งเหล่านั้นลักลอบนำ
  โค้ดที่กำหนดเองกลับเข้ามาและจะถูกปฏิเสธเสมอ
- **Declarative tokenizer** (`tokenizer.json` หรือ `sentencepiece` `.model` +
  vocab), และ **ไฟล์ข้อมูลเท่านั้น** — ไม่มี `.py`/scripts/binaries ใน bundle

The organizer runs it with `trust_remote_code=False`, offline, and only scores
leave — published as `declarative-model`, method identity **code-free by
construction**. (Multi-GB weights: use `--bundle-out` for the sneakernet lane,
same as below.)

ผู้จัดงานจะรันมันด้วย `trust_remote_code=False`, แบบออฟไลน์, และมีเพียงคะแนนเท่านั้น
ที่ออกมา — เผยแพร่เป็น `declarative-model`, ข้อมูลระบุตัวตนของวิธีการ
**ปราศจากโค้ดโดยโครงสร้าง**. (Weights ขนาดหลาย GB: ใช้ `--bundle-out` สำหรับ sneakernet lane,
เช่นเดียวกับด้านล่าง)

### Lane B — runnable bundle (the sandbox, for code methods)
### Lane B — runnable bundle (sandbox, สำหรับวิธีการที่เป็นโค้ด)

If your method is genuinely code — a pipeline, an LLM-coached hybrid, a custom
decoder — it can't be run declaratively, so it goes through the network-isolated
sandbox instead. This is the honestly-weaker lane (it contains untrusted code
rather than refusing to run it), so use Lane A whenever your method is a
standard model.

หากวิธีการของคุณเป็นโค้ดจริงๆ — pipeline, LLM-coached hybrid, custom
decoder — มันไม่สามารถรันแบบ declarative ได้, ดังนั้นมันจึงต้องผ่าน sandbox
ที่แยกเครือข่ายแทน นี่คือ lane ที่อ่อนแอกว่าตามความเป็นจริง (มันมีโค้ดที่ไม่น่าเชื่อถือ
แทนที่จะปฏิเสธการรันมัน), ดังนั้นให้ใช้ Lane A เสมอเมื่อวิธีการของคุณเป็น
โมเดลมาตรฐาน

**สัญญาของ runnable-bundle คือ stdin/stdout** bundle ของคุณประกาศ entrypoint (เช่น `method/translate.py`) ภายใน container node ของผู้จัดการแข่งขันจะรันคำสั่งต่อไปนี้เท่านั้น:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

ประโยคต้นฉบับจะส่งมาทีละบรรทัดผ่าน stdin; คุณเขียนคำแปลหนึ่งบรรทัดต่อหนึ่งประโยคไปยัง stdout ทุกสิ่งที่คุณส่งเป็น `--method-dir` จะถูกบรรจุไว้ใน `method/` ใน bundle และ mount แบบ **read-only ที่ `/method`** ในขณะรัน — รวมถึง weights โดยไม่ต้องคัดลอกเข้าไปใน image Container ไม่มี network stack (`--network=none`), root แบบ read-only และ `/tmp` แบบ writable

**ตัวอย่าง Hugging Face transformers wrapper ขั้นต่ำ:**

```python title="method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**Dockerfile ต้องสร้างได้โดยไม่ใช้เครือข่าย** ผู้จัดการแข่งขันจะ build image ของคุณด้วย `--network=none` — การทดสอบ build แบบ air-gap *คือ* ขั้นตอน build นั่นเอง — ดังนั้น dependency ทุกอย่างต้อง **vendor ไว้ใน bundle** (`pip install` ที่เชื่อมต่อ PyPI จะทำให้ build ล้มเหลว และการสแกน static แบบ pre-flight จะตรวจพบการเรียกใช้เครือข่ายก่อนที่จะมีการส่งข้อมูลใดๆ) ให้ ship wheels ไว้ใน method dir และติดตั้งจาก wheels เหล่านั้น:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

ส่งด้วยคำสั่ง:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(คุณต้องมี hypotheses-lane record ที่ publish แล้วสำหรับการแข่งขันก่อน — T1 gate ในขั้นตอนที่ 9 — และ `--agree` รับทราบข้อกำหนดการส่ง method)

**weights ขนาดหลาย GB: ใช้ sneakernet lane** เส้นทาง hosted intake จะอัปโหลด tarball ของคุณเป็น **POST เดียว** ไปยัง storage ของ contest host ดังนั้นจึงถูกจำกัดด้วยขีดจำกัดการอัปโหลด storage ของ host นั้น — เหมาะสำหรับ code และ model ขนาดเล็ก แต่ไม่เหมาะสำหรับ checkpoint ขนาดหลาย GB สัญญาของ bundle เองรองรับ artifact ขนาดใหญ่กว่ามาก (tarball สูงสุด 100 GB, image ที่ build แล้วสูงสุด 150 GB) สำหรับ weights ขนาดใหญ่ ให้ข้ามการอัปโหลดผ่าน hosted:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

ไดเรกทอรี exchange จะส่งถึงผู้จัดการแข่งขันผ่านสื่อแบบถอดได้ (หรือช่องทางใดก็ได้ที่ทั้งสองฝ่ายไว้วางใจ) โดยผู้จัดการแข่งขันจะนำเข้าด้วย `mt-eval node import-bundle` SHA-256 ของ bundle จะถูกตรึงไว้ใน authorization request ไม่ว่าจะใช้วิธีใด ดังนั้นสิ่งที่รันจึงพิสูจน์ได้ว่าตรงกับสิ่งที่คุณเสนอ

**ผู้จัดการแข่งขัน: โหลด base image ล่วงหน้าบนเครื่อง airgap** เนื่องจาก image build รันด้วย `--network=none` base image ของ `FROM` ใน Dockerfile จะต้องมีอยู่ใน local image store ของเครื่องแล้ว บนเครื่องที่เชื่อมต่ออินเทอร์เน็ต `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`;
นำ `base.tar` ไปพร้อมกับ bundle; บนเครื่อง airgap ให้รัน
`docker load -i base.tar` ก่อนรัน `mt-eval node run-method` ตกลงเรื่อง base image กับผู้เข้าร่วมในเอกสารการแข่งขันที่คุณเผยแพร่

## Step 10 — เผยแพร่คะแนนและมอบรางวัลตาม threshold ที่คุณประกาศไว้

ผลลัพธ์เฉพาะคะแนนเผยแพร่ไปยัง [leaderboard](/docs/network/leaderboard/rules) เหมือนกับการรันอื่นๆ โดยระบุว่าเป็นการประเมิน sealed set หากวิธีการผ่านเงื่อนไข threshold ที่คุณประกาศไว้ใน Step 6 — รวมถึง [speaker validation](/docs/network/specifications/speaker-validation) ซึ่งเป็นประตูของชุมชนคุณ ไม่ใช่ระบบอัตโนมัติ — **คุณ** (หรือกองทุนของคุณ) มอบรางวัลตามเงื่อนไขที่คุณเผยแพร่เอง บทบาทของ Champollion สิ้นสุดที่การวัดผล

---

## สิ่งที่คุณเก็บไว้ตลอดไป

- **ชุดข้อมูล** มันไม่เคยออกจากโครงสร้างพื้นฐานของคุณ นำ ciphertext ออกไปออฟไลน์และ sealed set ก็หยุดรันได้ทันที
- **กุญแจ** การเข้าถึงสิ้นสุดเมื่อ custodians ของคุณหยุดอนุมัติ
- **เงิน** มันไม่เคยอยู่ที่อื่น
- **บันทึก** head digest ของ audit log สามารถเผยแพร่ได้ ดังนั้นประวัติว่าใครรันอะไรกับชุดข้อมูลของคุณไม่สามารถถูกเขียนทับอย่างเงียบๆ — โดยใครก็ตาม รวมถึงเราด้วย

สำหรับภาษาเงื่อนไขที่คุณสามารถนำไปปรับใช้ — ความเป็นเจ้าของ, การอนุญาตใช้งานเฉพาะคะแนน และการสำรวจวิธีที่การแข่งขันอาจถูกโจมตีอย่างละเอียด — ดู [Terms Templates](/docs/network/sovereignty/terms-templates)
