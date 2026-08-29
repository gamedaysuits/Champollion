---
sidebar_position: 4
title: "ความปลอดภัย"
---

# ความปลอดภัย

Champollion ได้รับการออกแบบให้ปลอดภัยในสภาพแวดล้อมที่ไม่น่าไว้วางใจ — ไม่ว่าข้อมูล locale จะมาจากแหล่งที่ไม่น่าเชื่อถือ ชื่อไฟล์ที่ถูกสร้างขึ้นเพื่อหลบเลี่ยงขอบเขตไดเรกทอรี หรือผลลัพธ์จาก LLM ที่อาจมีเนื้อหาใดก็ได้

## โมเดลภัยคุกคาม

| ภัยคุกคาม | ช่องทางการโจมตี | มาตรการป้องกัน |
|--------|--------------|-----------|
| **Prototype pollution** | คีย์ JSON ที่ถูกสร้างขึ้น (`__proto__`, `constructor`) | ถูกปฏิเสธในขั้นตอน parse |
| **Path traversal** | รหัส locale เช่น `../../etc/passwd` | การเขียนไฟล์ถูกตรวจสอบให้อยู่ในไดเรกทอรีที่กำหนด |
| **Code block corruption** | LLM แปลภายใน code fence | การป้องกันด้วย Unicode sentinel |
| **Hallucinated keys** | LLM ส่งคืนคีย์ที่ไม่ได้ส่งไป | การตรวจสอบ response — รับเฉพาะคีย์ที่ยอมรับเท่านั้น |
| **Runaway token spend** | การวนซ้ำ retry ไม่สิ้นสุด | จำกัดงบประมาณผ่าน `maxRetries` |

## การป้องกัน Prototype Pollution

คีย์ locale ทั้งหมดจะถูกตรวจสอบกับ blocklist ก่อนการประมวลผล:

- `__proto__`
- `constructor`
- `prototype`

คีย์ใดที่ตรงกับรูปแบบเหล่านี้จะถูกปฏิเสธพร้อมข้อผิดพลาด ซึ่งป้องกันไม่ให้ผู้โจมตีใช้ไฟล์ locale ที่สร้างขึ้นเพื่อแก้ไข prototype ของ JavaScript object

## การจำกัดขอบเขต Path

เมื่อเขียนไฟล์ locale champollion จะตรวจสอบว่า output path อยู่ภายในไดเรกทอรีที่กำหนด (`localesDir`, `contentDir`) รหัส locale จะถูก sanitize — รหัสอย่าง `../../secrets` ไม่สามารถเขียนออกนอกไดเรกทอรีที่คาดไว้ได้

## การป้องกัน Block

ระหว่างการแปลเนื้อหา Markdown องค์ประกอบที่มีโครงสร้างจะถูกแทนที่ด้วย Unicode sentinel placeholder ก่อนที่ข้อความจะถูกส่งไปยัง LLM:

1. **Code block** (fenced และ inline) → sentinel
2. **Hugo shortcode** (`{{< >}}`, `{{% %}}`) → sentinel
3. **Raw HTML** → sentinel
4. **ตัวแปร interpolation** (`{{ .Count }}`) → sentinel

หลังการแปล sentinel จะถูกแทนที่ด้วยเนื้อหาต้นฉบับ LLM จะไม่เห็น code block, shortcode หรือ HTML เลย — จึงไม่สามารถทำให้เสียหายได้

## การตรวจสอบ Response

เมื่อ LLM ส่งคืน JSON response champollion จะตรวจสอบว่า:
- มีเฉพาะคีย์ที่ส่งไปใน batch เท่านั้นที่ปรากฏใน response
- ไม่มีคีย์เพิ่มเติมถูกแทรกเข้ามา
- Response สามารถ parse เป็น JSON ที่ถูกต้องได้

คีย์ที่ถูก hallucinate จะถูกละทิ้งโดยไม่แจ้งเตือน ซึ่งป้องกันไม่ให้ผลลัพธ์จาก LLM แทรกการแปลที่ไม่คาดคิดลงในไฟล์ locale ของคุณ

## Quality Gate

การแปลทุกรายการจะถูกตรวจสอบผ่านการตรวจสอบแบบ deterministic ห้าขั้นตอนก่อนที่จะเขียนลงดิสก์ ดูรายละเอียดได้ที่ [Quality Gate](/docs/concepts/quality-gate)

## Exponential Backoff

การเรียก API ใช้ exponential backoff พร้อม jitter สำหรับ response 429 (rate limit) และ 5xx (server error) การ retry สามครั้งพร้อมการหน่วงเวลาที่เพิ่มขึ้นป้องกันการส่งคำขอซ้ำไปยัง API ในช่วงที่เกิดปัญหา

## Request Timeout

คำขอ API ทุกรายการมี timeout 30 วินาทีผ่าน `AbortController` ซึ่งป้องกันไม่ให้กระบวนการ sync ค้างอยู่อย่างไม่มีกำหนดเมื่อการเชื่อมต่อขัดข้อง

## การแจ้งข้อผิดพลาดการแปลอย่างชัดเจน

เมื่อ API ไม่พร้อมใช้งานหรือการแปลล้มเหลว champollion จะแสดงข้อผิดพลาดที่ชัดเจนพร้อมคำแนะนำที่ดำเนินการได้ แทนที่จะเขียนข้อมูลที่ไม่ถูกต้องโดยไม่แจ้งเตือน ไม่มี placeholder ที่มีคำนำหน้า `[EN]` ถูกเขียนในระหว่าง sync เลย

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

ความล้มเหลวของไฟล์หนึ่งไม่ได้หยุดการ sync ทั้งหมด — ข้อผิดพลาดจะถูกบันทึกและ pipeline จะดำเนินการต่อไปยังไฟล์ถัดไป เพื่อให้ได้ความคืบหน้าสูงสุดในแต่ละครั้งที่รัน

## การตรวจสอบหลัง Sync

หลังจากการแปลทั้งหมดเสร็จสิ้น champollion จะอ่านไฟล์ locale ที่เขียนไว้จากดิสก์อีกครั้งและดำเนินการตรวจสอบ ซึ่งช่วยตรวจจับช่องว่างระหว่างที่ sync รายงานว่าสำเร็จกับการแปลที่ผิดพลาดจริง:

- **Key parity** — คีย์ต้นฉบับทั้งหมดมีอยู่ในแต่ละ target
- **`[EN]` markers** — เครื่องหมาย fallback เดิมจากการรันก่อนหน้า
- **การแปลที่ว่างเปล่า** — ค่าว่างที่ผ่านการตรวจสอบมาได้
- **Script compliance** — locale ที่ไม่ใช่ Latin ที่มีการแปลเป็น ASCII เท่านั้น
- **การรักษา Placeholder** — ICU placeholder ตรงกับต้นฉบับ

ข้ามขั้นตอนนี้ด้วย `--no-verify` หรือรันแบบ standalone ด้วย `npx champollion verify`

## การทดสอบ

คุณสมบัติด้านความปลอดภัยได้รับการตรวจสอบโดย adversarial test suite:

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## ดูเพิ่มเติม

- [Architecture](/docs/concepts/architecture) — วิธีที่ระบบนิเวศสามส่วนเชื่อมต่อกัน
- [CLI Reference — integrity](/docs/reference/cli#integrity) — คำสั่งตรวจสอบ integrity
- [CLI Reference — provenance](/docs/reference/cli#provenance) — คำสั่งตรวจสอบ provenance
- [Plugin Specification](/docs/reference/plugin-spec) — ฟิลด์ provenance ใน plugin manifest
- [Quality Gate](/docs/concepts/quality-gate) — การตรวจสอบความปลอดภัยระดับการแปล
