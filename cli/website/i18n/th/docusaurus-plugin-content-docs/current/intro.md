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

champollion ตรวจหาไฟล์ locale รูปแบบไฟล์ และภาษาปลายทางของคุณโดยอัตโนมัติ โดยจะแปลเฉพาะส่วนที่ขาด ข้ามส่วนที่แปลเรียบร้อยแล้ว ตรวจสอบผลลัพธ์ทุกรายการเพื่อป้องกันเอาต์พุตที่เสียหาย และเขียนเอาต์พุตที่สะอาดเรียบร้อย นี่เป็นเพียงจุดเริ่มต้นเท่านั้น

:::info[ส่วนหนึ่งของสิ่งที่ยิ่งใหญ่กว่า]

CLI นี้เป็นส่วนการนำไปใช้งานจริง (deployment end) ของ **Champollion** — โครงสร้างพื้นฐานที่
วัดผลระบบการแปลภาษาด้วยเครื่องสำหรับภาษาที่ไม่มีใครเคยวัดผลมาก่อน และ
เผยแพร่สิ่งที่ค้นพบ ด้านการวัดผลจะสร้างชุดแบบทดสอบเพื่อการประเมินและ
แผนที่สาธารณะที่แสดงว่าใครสามารถแปลภาษาใดได้บ้าง แปลได้ดีเพียงใด และกับข้อความประเภทใด
ส่วน CLI คือจุดที่ระเบียบวิธีที่ผ่านการพิสูจน์แล้วกลายมาเป็นสิ่งที่คุณสามารถสั่งรันได้จริง

มีกฎข้อหนึ่งที่กำหนดทุกสิ่ง: ข้อมูลภาษาได้รับการปฏิบัติเยี่ยงข้อมูลทางชีวภาพ (biodata) ดังนั้น
ผู้คนที่มอบคลังข้อมูลภาษา (corpus) จึงเป็นผู้ถือกุญแจสู่ข้อมูลนั้นและสิ่งใดก็ตามที่นำมาวัดผล
เทียบกับมัน สำหรับภาพรวมทั้งหมด — สิ่งที่มีอยู่ กฎเกณฑ์คืออะไร และคุณอยู่ตรงไหนในระบบนี้ — สามารถดูได้ที่ [Champollion คืออะไร](/docs/what-is-champollion) และฝั่งการวัดผลจะอยู่ใน [the Network](/docs/network/)

:::

---

## ทำไมไม่เขียน Script เองเลย?

คุณสามารถเขียน loop สั้นๆ ที่เรียก Google Translate สำหรับแต่ละ key ได้ นักพัฒนาส่วนใหญ่ทำแบบนั้น — ใช้โค้ดประมาณ 30 บรรทัด แต่นี่คือจุดที่มันพัง:

- **ไม่มีการตรวจจับการเปลี่ยนแปลง** เมื่ออัปเดตข้อความภาษาอังกฤษ คำแปลก็ล้าสมัยไปตลอด champollion ติดตามค่าต้นทางทุกค่าด้วยแฮช SHA-256 และแปลใหม่เฉพาะส่วนที่เปลี่ยนแปลงเท่านั้น
- **ไม่มีการรวมชุดคำขอ (Batching)** การเรียก API 1 ครั้งต่อ 1 คีย์หมายถึง 200 คีย์ = การส่งคำขอไป-กลับ 200 รอบ champollion จะรวมชุดข้อมูลอย่างชาญฉลาด (ปรับแต่งได้ ค่าเริ่มต้นคือ 80 คีย์/ชุดสำหรับ LLM และ 128 คีย์/ชุดสำหรับ Google)
- **ไม่มีการแคช** การซิงค์ทุกครั้งต้องแปลใหม่ทั้งหมด Translation Memory ของ champollion จะแคชผลการแปลตามข้อความต้นทาง + locale + วิธีการแปล — การรันซิงค์ซ้ำหลังจากเปลี่ยนข้อความเพียงคีย์เดียวจะแปลเฉพาะคีย์นั้น ไม่ใช่ทั้งไฟล์
- **ไม่มีเกตควบคุมคุณภาพ (Quality gate)** การแปลด้วยเครื่องอาจสร้างข้อมูลเท็จ (hallucinate) ส่งข้อความต้นทางกลับมาซ้ำ หรือแสดงผลด้วยชุดอักขระที่ผิด champollion จะตรวจสอบการแปลทุกรายการก่อนเขียนไฟล์ — เอาต์พุตที่ว่างเปล่า การสะท้อนข้อความต้นทาง ลูปข้อความซ้ำ ความยาวที่พองเกินจริง เนื้อหาที่หายไป และชุดอักขระที่ผิดจะถูกตรวจจับและปฏิเสธ เกตนี้มีไว้ตรวจจับเอาต์พุตที่เสียหาย ไม่ใช่จับความหมายที่ผิด
- **ไม่เข้าใจรูปแบบไฟล์** ถูกล็อกไว้แค่ JSON หรือไม่? champollion จัดการได้ทั้ง JSON, TOML, YAML และ Hugo Markdown (frontmatter + เนื้อหา) พร้อมการตรวจหาอัตโนมัติ
- **ควบคุมวิธีการแปลไม่ได้** ทุกคู่ภาษาถูกบังคับให้ใช้วิธีเดียวกัน champollion ให้คุณใช้ Google Translate สำหรับภาษาฝรั่งเศส ใช้ LLM สำหรับภาษาญี่ปุ่น และใช้ไปป์ไลน์ที่ชุมชนร่วมดูแลสำหรับภาษาครี (Cree) — ได้ทั้งหมดในไฟล์ config เดียวกัน

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
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

ภาษาฝรั่งเศสใช้ Google Translate (รวดเร็ว ประหยัด) ภาษาญี่ปุ่นใช้ LLM ระดับพรีเมียม (เก็บรายละเอียดได้ลึกซึ้ง) ภาษาครีทุ่งราบ (Plains Cree) ใช้ LLM ที่ได้รับการแนะนำด้วยกฎไวยากรณ์และพจนานุกรมที่คุณจัดเตรียมไว้ ทั้งหมดนี้ใช้คำสั่ง `sync` เดียวกัน เกตควบคุมคุณภาพเดียวกัน CLI เดียวกัน

### ดูว่าอะไรได้ผล

คิดว่า method ของคุณสามารถแปลภาษาอังกฤษเป็นสเปนได้ไหม? ตุรกีเป็นอาเซอร์ไบจาน? อังกฤษเป็น Cree?

**สร้างและทดสอบมัน** [eval harness](/docs/network/specifications/harness) ที่มาพร้อมกันนี้ benchmark translation method ใดก็ได้ด้วยการให้คะแนนที่ทำซ้ำได้และมี fingerprint [leaderboard](/leaderboard) บันทึกทุก run ที่เผยแพร่ เพื่อให้ทุกคนเห็นว่าอะไรได้ผล

eval harness และ production CLI ใช้ plugin interface เดียวกัน method ที่ได้คะแนนดีใน harness สามารถนำไปใช้ใน production ได้ — หากชุมชนที่ภาษานั้นรับใช้ให้ความยินยอม สำหรับภาษาพื้นเมืองและภาษาที่มีทรัพยากรน้อย ความยินยอมนั้นมีความสำคัญ ดู [Data Sovereignty](/docs/network/sovereignty/data-sovereignty)

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

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

[Method Leaderboard](/leaderboard) คือกระดานคะแนน — ที่แสดงผลแบบสด เป็นสาธารณะ และเปิดรับการส่งผลงาน การส่งผลงานทุกรายการจะถูกผูกรอยประทับ (fingerprint) ไว้กับ Git commit กำกับเวอร์ชันกับชุดข้อมูลที่ระบุ และให้คะแนนด้วยชุดประเมินผล (harness) เดียวกัน ทุกคนสามารถส่งผลงานได้

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
- [อธิปไตยทางข้อมูล](/docs/network/sovereignty/data-sovereignty) — หลักการอธิปไตยทางข้อมูลของชนพื้นเมือง: การเป็นเจ้าของและการควบคุมข้อมูลภาษาโดยชุมชน
- [สนับสนุนภาษาที่มีทรัพยากรน้อย](/docs/network/community/low-resource-languages) — ความท้าทายที่เป็นจุดเริ่มต้นของทุกสิ่ง
- [Cookbook: ไปป์ไลน์ที่ควบคุมด้วย FST](/docs/network/tutorials/fst-gated-pipeline) — สร้างไปป์ไลน์แยกส่วนประกอบ (decomposition pipeline)
- [การประเมินผล MT](/docs/network/leaderboard/rules) — ชุดประเมินผล (harness) และกระดานคะแนนทำงานอย่างไร
- [Method Leaderboard](/leaderboard) — คะแนนสดและการส่งผลงาน
