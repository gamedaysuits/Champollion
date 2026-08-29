---
sidebar_position: 1
slug: /intro
title: "บทนำ"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

เฟรมเวิร์ก internationalization ที่ปรับแต่งได้อย่างสมบูรณ์ คำสั่งเดียวแปลไฟล์ locale ของคุณ การตั้งค่าเดียวควบคุมทุก method, model, และคู่ภาษา และหากวิธีที่มีอยู่ยังไม่เพียงพอ — สร้างของคุณเอง ทดสอบว่าใช้งานได้ แล้ว deploy

```bash
npx champollion sync
```

champollion ตรวจจับไฟล์ locale, รูปแบบ, และภาษาเป้าหมายของคุณโดยอัตโนมัติ แปลส่วนที่ขาดหายไป ข้ามส่วนที่เสร็จแล้ว ตรวจสอบทุกผลลัพธ์ และเขียน output ที่สะอาด นั่นคือจุดเริ่มต้น

:::info[ส่วนหนึ่งของสิ่งที่ยิ่งใหญ่กว่า]

CLI นี้คือส่วนปลายทางสำหรับการนำไปใช้งานของ **Champollion** — โครงสร้างพื้นฐานที่
ใช้วัดผลการแปลด้วยเครื่องสำหรับภาษาที่ไม่มีใครเคยวัดผลมาก่อน และ
เผยแพร่สิ่งที่ค้นพบ ฝั่งการวัดผลจะสร้างชุดทดสอบสำหรับการประเมินและ
แผนที่สาธารณะที่แสดงว่าใครสามารถแปลอะไรได้บ้าง แปลได้ดีแค่ไหน บนข้อความประเภทใด
ส่วน CLI คือจุดที่วิธีการที่ได้รับการพิสูจน์แล้วกลายเป็นสิ่งที่คุณสามารถนำไปรันได้จริง

กฎข้อหนึ่งที่เป็นตัวกำหนดทุกสิ่งคือ: ข้อมูลภาษาจะถูกปฏิบัติเสมือนข้อมูลทางชีวภาพ ดังนั้น
ผู้ที่ให้ข้อมูลคลังข้อความ (corpus) จะเป็นผู้ถือสิทธิ์ในข้อมูลนั้นและในทุกสิ่งที่ถูกนำมาวัดผล
กับข้อมูลดังกล่าว ภาพรวมทั้งหมด — มีอะไรอยู่บ้าง กฎคืออะไร และคุณ
เหมาะสมกับส่วนไหน — สามารถดูได้ที่ [Champollion คืออะไร](/docs/what-is-champollion) และ
ฝั่งการวัดผลจะอยู่ภายใต้ [เครือข่าย](/docs/network/)

:::

---

## ทำไมไม่เขียน Script เองเลย?

คุณสามารถเขียน loop สั้นๆ ที่เรียก Google Translate สำหรับแต่ละ key ได้ นักพัฒนาส่วนใหญ่ทำแบบนั้น — ใช้โค้ดประมาณ 30 บรรทัด แต่นี่คือจุดที่มันพัง:

- **ไม่มีการตรวจจับการเปลี่ยนแปลง** อัปเดต string ภาษาอังกฤษ — คำแปลยังคงล้าสมัยตลอดไป champollion ติดตามทุก source value ด้วย SHA-256 hash และแปลใหม่เฉพาะส่วนที่เปลี่ยนแปลง
- **ไม่มีการ batch** หนึ่ง API call ต่อหนึ่ง key หมายความว่า 200 key = 200 round trip champollion batch อย่างชาญฉลาด (ปรับแต่งได้ ค่าเริ่มต้น 80 key/batch สำหรับ LLM, 128 สำหรับ Google)
- **ไม่มีการ cache** ทุกครั้งที่ sync จะแปลทุกอย่างใหม่ Translation Memory ของ champollion cache คำแปลตาม source text + locale + method — การรัน sync ใหม่หลังจากเปลี่ยน key เดียวจะแปลเฉพาะ key นั้น ไม่ใช่ทั้งไฟล์
- **ไม่มี quality gate** การแปลด้วยเครื่องอาจ hallucinate, ส่งคืน source กลับมา, หรือ output ในสคริปต์ที่ผิด champollion ตรวจสอบทุกคำแปลก่อนเขียน — สคริปต์ผิด, การขยายความยาว, และการ echo source จะถูกตรวจพบและปฏิเสธ
- **ไม่มีความรู้เรื่องรูปแบบ** ผูกติดกับ JSON? champollion รองรับ JSON, TOML, YAML, และ Hugo Markdown (frontmatter + body) พร้อม auto-detection
- **ไม่มีการควบคุม method** ทุกคู่ใช้ method เดียวกัน champollion ให้คุณใช้ Google Translate สำหรับภาษาฝรั่งเศส, LLM สำหรับภาษาญี่ปุ่น, และ pipeline ที่ชุมชนโฮสต์เองสำหรับภาษา Cree — ในไฟล์ config เดียวกัน

champollion คือเวอร์ชัน production ของ script นั้น

---

## สิ่งที่ทำให้มันแตกต่าง

### ทุก method คือ plugin

Translation method **ปรับแต่งได้ต่อคู่ภาษา** ผสม Google Translate, LLM, coached prompt, และ custom API ในโปรเจกต์เดียวกัน:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

ภาษาฝรั่งเศสใช้ Google Translate (เร็ว, ประหยัด) ภาษาญี่ปุ่นใช้ LLM ระดับพรีเมียม (ละเอียดอ่อน) ภาษา Plains Cree ใช้ coached plugin พร้อมกฎไวยากรณ์, พจนานุกรม, และการตรวจสอบทางสัณฐานวิทยา คำสั่ง `sync` เดียวกัน quality gate เดียวกัน CLI เดียวกัน

### ดูว่าอะไรได้ผล

คิดว่า method ของคุณสามารถแปลภาษาอังกฤษเป็นสเปนได้ไหม? ตุรกีเป็นอาเซอร์ไบจาน? อังกฤษเป็น Cree?

**สร้างและทดสอบมัน** [eval harness](/docs/network/specifications/harness) ที่มาพร้อมกันนี้ benchmark translation method ใดก็ได้ด้วยการให้คะแนนที่ทำซ้ำได้และมี fingerprint [leaderboard](/leaderboard) บันทึกทุก run ที่เผยแพร่ เพื่อให้ทุกคนเห็นว่าอะไรได้ผล

eval harness และ production CLI ใช้ plugin interface เดียวกัน method ที่ได้คะแนนดีใน harness สามารถนำไปใช้ใน production ได้ — หากชุมชนที่ภาษานั้นรับใช้ให้ความยินยอม สำหรับภาษาพื้นเมืองและภาษาที่มีทรัพยากรน้อย ความยินยอมนั้นมีความสำคัญ ดู [Data Sovereignty](/docs/network/sovereignty/data-sovereignty)

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

# Use it locally
npx champollion sync
```

Plugin เดียวกัน เสียบและทดสอบ

### ชุดเครื่องมือครบชุด

champollion ไม่ใช่แค่ `sync` แต่เป็น i18n pipeline ที่สมบูรณ์:

| คำสั่ง | สิ่งที่ทำ |
|---------|-------------|
| `sync` | แปล key ที่ขาดหายไปและล้าสมัย (พร้อมการตรวจสอบหลัง sync) |
| `watch` | Auto-sync เมื่อไฟล์ source ของคุณเปลี่ยนแปลง |
| `lint` | สแกน source code เพื่อหา string ที่ hardcode ไว้ |
| `wrap` | Auto-wrap string ที่ hardcode ไว้ในการเรียก `t()` |
| `audit` | แสดงรายการ fallback marker `[EN]` ทั้งหมดจาก run ก่อนหน้า |
| `verify` | ตรวจสอบว่าคำแปลมีอยู่และถูกต้อง (CI gate) |
| `integrity` | ตรวจจับการเสียหายของ placeholder, ปัญหา encoding, และความสมบูรณ์ของ ICU plural |
| `seo` | สร้าง hreflang tag, sitemap, และ JSON-LD schema |
| `status` | แสดงการตั้งค่าคู่ภาษา, plugin, และคะแนน benchmark |
| `provenance` | ตรวจสอบการอนุญาตใช้งานทรัพยากรการแปล |
| `plugin` | ติดตั้ง, ลบ, และแสดงรายการ method plugin |
| `fonts` | ดาวน์โหลด web font สำหรับ PUA script converter |
| `tm` | จัดการ Translation Memory cache (สถิติ, ล้าง, ต่อ locale) |
| `xliff` | Export/import XLIFF 1.2 สำหรับการตรวจสอบโดยนักแปลมืออาชีพ |

สี่คำสั่งนี้ — `lint`, `sync`, `verify`, `audit` — ประกอบกันเป็น CI pipeline ที่ตรวจจับ string ที่ hardcode ไว้, แปลมัน, ตรวจสอบความถูกต้อง, และทำให้ build ล้มเหลวหาก locale ใดไม่สมบูรณ์

---

## เครือข่าย

[Method Leaderboard](/leaderboard) คือกระดานคะแนน — แบบเรียลไทม์ สาธารณะ และเปิดรับการส่งผลงาน ทุกการส่งผลงานจะถูกประทับลายนิ้วมือผูกกับ Git commit, ระบุเวอร์ชันกับชุดข้อมูลเฉพาะ และให้คะแนนโดยระบบทดสอบ (harness) เดียวกัน ใครก็สามารถส่งผลงานได้

**คุณสามารถสร้างอะไรได้บ้าง?** harness รับ JSON Plugin รับ JSON method ใดก็ตามที่ผลิต JSON สามารถทดสอบได้:

| แนวทาง | ตัวอย่าง |
|----------|---------|
| **Coached LLM** | ใส่กฎไวยากรณ์และพจนานุกรมลงใน prompt ของ frontier model |
| **Fine-tuned model** | Train open model บน parallel text — แต่ไม่ใช่บนข้อมูล eval |
| **FST-gated pipeline** | LLM สร้าง → finite-state transducer ตรวจสอบสัณฐานวิทยา → ลองใหม่ |
| **Chained models** | Model A ร่าง → Model B แก้ไข → Model C ให้คะแนน |
| **Dictionary + LLM** | บังคับใช้คำที่รู้จักจากพจนานุกรม ให้ LLM จัดการส่วนที่เหลือ |
| **Evolutionary** | สร้างตัวเลือก, ให้คะแนน, กลายพันธุ์ตัวที่ดีที่สุด, ทำซ้ำ |
| **Partial translation** | แปลตัวอย่างด้วยมือ, พิสูจน์ว่า LLM ของคุณตรงกัน, auto-translate ส่วนที่เหลือ |

Fine-tune model ต่างๆ Deploy evolutionary algorithm ทดสอบคำตอบของนักเรียนในการสอบภาษา สร้าง lookup table เชื่อม model สามตัวเข้าด้วยกัน ตราบใดที่ method ของคุณผลิต JSON harness จะให้คะแนนมันและ framework จะรันมัน

:::danger[กฎข้อเดียว]
**ห้าม train บนข้อมูล evaluation** method ที่สัมผัสกับ benchmark dataset จะถูกตัดสิทธิ์ Fine-tune บนอะไรก็ได้ที่คุณต้องการ แค่ไม่ใช่บน test set
:::

นี่คือคำเชิญแบบเปิด หากคุณทำงานกับภาษาที่มีทรัพยากรน้อย — ในฐานะนักวิจัย, สมาชิกชุมชน, นักศึกษา, หรือเพียงแค่ผู้ที่ใส่ใจ — สร้าง method, รัน harness, และเสริมความแข็งแกร่งให้เครือข่ายสำหรับทุกคน ปัญหานี้ยังไม่ได้รับการแก้ไข โครงสร้างพื้นฐานอยู่ที่นี่แล้ว และเปิดให้ทุกคน

**[→ ดู leaderboard](/leaderboard)**

---

## ขั้นตอนต่อไป

**เริ่มต้นใช้งาน:**
- [การติดตั้ง](/docs/getting-started/installation) — ตั้งค่าใน 2 นาที
- [Quick Start](/docs/getting-started/quick-start) — รัน sync ครั้งแรกของคุณ
- [ภาษาที่รองรับ](/docs/reference/supported-languages) — สิ่งที่พร้อมใช้งานทันที

**ปรับแต่งการตั้งค่าของคุณ:**
- [Translation Methods](/docs/guides/translation-methods) — เลือก method ที่เหมาะสมต่อคู่ภาษา
- [Translation Memory](/docs/concepts/translation-memory) — วิธีที่การ cache ช่วยประหยัดเงิน
- [Configuration](/docs/getting-started/configuration) — เอกสารอ้างอิง config ฉบับสมบูรณ์
- [Hugo Multilingual Site](/docs/tutorials/hugo-multilingual-site) — การแปลเนื้อหา Markdown

**เจาะลึกเพิ่มเติม:**
- [การทำงานร่วมกับนักแปลมืออาชีพ](/docs/guides/professional-translators) — เวิร์กโฟลว์การส่งออก/นำเข้า XLIFF
- [อธิปไตยของข้อมูล](/docs/network/sovereignty/data-sovereignty) — หลักการอธิปไตยทางข้อมูลของ First Nations, CARE และอธิปไตยของข้อมูลชาวเมารี
- [การสนับสนุนภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages) — ความท้าทายที่เป็นจุดเริ่มต้นของทุกสิ่ง
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — สร้างไปป์ไลน์การแยกส่วน
- [การประเมิน MT](/docs/network/leaderboard/rules) — วิธีการทำงานของระบบทดสอบและกระดานผู้นำ
- [Method Leaderboard](/leaderboard) — คะแนนแบบเรียลไทม์และการส่งผลงาน
