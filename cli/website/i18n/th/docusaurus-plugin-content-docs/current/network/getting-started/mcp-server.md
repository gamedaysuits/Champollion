---
title: "MCP Server — ประตูเชื่อมต่อสำหรับ AI agent"
sidebar_label: "MCP Server"
description: "เชื่อมต่อ AI agent เข้ากับ Champollion ผ่าน Model Context Protocol: มาพร้อม 23 tools สำหรับการแปล, การเรียกดู benchmark queue, การรัน evaluations และการเทรนโมเดล — รวมถึงระบุชัดเจนว่า tool ใดบ้างที่ต้องการการตั้งค่าเพิ่มเติมจากการรันแค่ npx install"
---

# MCP Server — ประตูสำหรับเอเจนต์

`champollion-mcp-server` เปิดให้ AI เอเจนต์เข้าถึง Champollion ผ่าน [Model Context Protocol](https://modelcontextprotocol.io) หากคุณเป็นเอเจนต์ หรือกำลังเชื่อมต่อเอเจนต์อยู่ นี่คือประตูของคุณ: **เครื่องมือ 23 รายการ, รีซอร์ส 3 รายการ และพรอมต์ 3 รายการ** ผ่าน stdio

ทุกสิ่งในที่นี้สามารถเข้าถึงได้ผ่าน HTTP ธรรมดาเช่นกัน — ดู [Machine-readable endpoints](#machine-readable-endpoints) — แต่ MCP server เป็นเพียงพื้นผิวเดียวที่อนุญาตให้เอเจนต์ *ลงมือทำ* (แปลภาษา, รันเบนช์มาร์ก, ฝึกสอนโมเดล) แทนที่จะแค่อ่านเพียงอย่างเดียว

## การติดตั้ง

```bash
npx -y champollion-mcp-server
```

จากนั้นลงทะเบียนกับไคลเอนต์ของคุณ สำหรับ Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

สำหรับไคลเอนต์ที่กำหนดค่าผ่านไฟล์ (Claude Desktop, Cursor, Antigravity) ให้เพิ่ม:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## อ่านส่วนนี้ก่อนที่คุณจะนำไปใช้งานจริง

**เครื่องมือ 9 จาก 23 รายการสามารถทำงานได้จากการติดตั้ง `npx` แบบพื้นฐาน ส่วนอีก 14 รายการที่เหลือต้องการซอฟต์แวร์ที่แพ็กเกจ npm ไม่มีและไม่สามารถจัดส่งให้ได้** เครื่องมือเหล่านี้จะไม่ล้มเหลวแบบเงียบๆ — แต่ละรายการจะส่งคืนข้อผิดพลาดที่สามารถดำเนินการต่อได้โดยระบุสิ่งที่ขาดหายไป — แต่คุณควรทราบรูปแบบก่อนที่จะวางแผนใช้งาน

| เครื่องมือ | ทำงานหลัง `npx` หรือไม่? | สิ่งอื่นที่ต้องการ |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **ใช่** — อ่านอย่างเดียว, ให้บริการจาก public endpoints | ไม่มี |
| `translate` | ไม่ | `champollion` CLI (`npm i -g champollion`) และ API key |
| `run_benchmark`, `get_run_status` | ไม่ | eval harness — `pipx install mt-eval-harness` |
| เครื่องมือ `forge_*` ทั้ง 11 รายการ | ไม่ | การโคลน monorepo โดยตั้งค่า `CHAMPOLLION_FORGE_DIR` ไปที่ไดเรกทอรี `forge/`; การให้คะแนนยังต้องการ `mt-eval` ด้วย |

หากคุณต้องการใช้งานทั้งหมด ให้โคลน repo แทนที่จะพึ่งพา `npx`

## เครื่องมือเหล่านี้ทำอะไรได้บ้าง

**เรียกดูและประเมินราคาของงาน** `list_queue` และ `get_queue_item` จะไล่ดูคิวเบนช์มาร์กที่เปิดอยู่ — ซึ่งเป็นรายการการวัดผลที่จัดอันดับไว้ที่จะช่วยปรับปรุงแผนที่ได้มากที่สุด `estimate_cost` จะประเมินราคาชุดการรันก่อนที่คุณจะเสียค่าใช้จ่ายใดๆ

**ค้นหาข้อมูล** `search_languages` ค้นหาการ์ดภาษาตามชื่อ, รหัส, ตระกูลภาษา หรือภูมิภาค `get_results` และ `get_run_card` อ่านการรันที่ให้คะแนนแล้วจากลีดเดอร์บอร์ดสาธารณะ `get_metric_reliability` ตอบคำถามที่เอเจนต์ส่วนใหญ่มักจะตอบผิด — *ฉันควรเชื่อถือเมตริกใดสำหรับภาษาเป้าหมายนี้* — จากความสัมพันธ์กับการตัดสินของมนุษย์ในแต่ละตระกูลภาษา

**ลงมือทำ** `translate` รันข้อความผ่านไปป์ไลน์ที่ผ่านการทดสอบแล้ว พร้อมด้วย Translation Memory (การทำซ้ำไม่มีค่าใช้จ่าย) และ quality gate แบบกำหนดได้ `run_benchmark` เริ่มการประเมินผลและส่งคืน **job id ทันที** เนื่องจากการรันจริงจะใช้เวลานานกว่า timeout ของไคลเอนต์ใดๆ; คุณสามารถใช้ id นั้นเพื่อ poll กับ `get_run_status`

**ฝึกสอนโดยไม่หลอกตัวเอง** `get_training_guardrails` ส่งคืนกฎที่สกัดจากความล้มเหลวที่วัดผลได้จริง เครื่องมือ `forge_*` ทั้ง 11 รายการจะรัน [NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status` ก่อนและหลังทุกขั้นตอน, `forge_preflight` เพื่อดูว่าคำสั่งจะชนกับ gate ใดก่อนที่จะปฏิเสธ

:::note[การใช้จ่ายถูกจำกัดไว้ตามการออกแบบ]
`run_benchmark` **จะปฏิเสธการรันคิวที่ไม่มีการจำกัดขอบเขต** คุณต้องส่งผ่านขอบเขตเพียงหนึ่งอย่างเท่านั้น — `budget`, `top`, หรือ `item_id` ที่ระบุเฉพาะเจาะจง จะไม่มีการเรียกใช้แบบ "แค่รันคิว" เนื่องจากเอเจนต์ที่เข้าใจคิวผิดอาจใช้จ่ายไปโดยไม่มีขีดจำกัด
:::

## เวอร์ชันของโปรโตคอล

การรับส่งข้อมูลเป็นแบบ **stdio เท่านั้น** — หนึ่งโปรเซสเซิร์ฟเวอร์ต่อหนึ่งเอเจนต์

[การปรับปรุงเมื่อ 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) ของ MCP ทำให้โปรโตคอลเป็นแบบ stateless โดยค่าเริ่มต้น โดยยกเลิกการทำ handshake แบบ `initialize` และเฮดเดอร์ `Mcp-Session-Id` เซิร์ฟเวอร์นี้ไม่ได้รับผลกระทบในด้านการออกแบบ: มันไม่ได้ใช้ความสามารถที่ถูกยกเลิกไปแล้ว (Roots, Sampling, Logging), ไม่เคยใช้การรับส่งข้อมูลแบบ HTTP+SSE รุ่นเก่า, และปฏิบัติตามคำแนะนำใหม่สำหรับสถานะข้ามการเรียกใช้ (cross-call state) อยู่แล้ว — `run_benchmark` จะสร้าง job handle ที่ชัดเจนซึ่งโมเดลจะส่งกลับมา แทนที่จะพึ่งพา transport session

มัน **ยังไม่ได้** รับการอัปเกรดเป็นเวอร์ชันปรับปรุงใหม่ เนื่องจากยังไม่มี TypeScript SDK ที่เผยแพร่ออกมาที่รองรับเวอร์ชันนี้ ดู [server README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) สำหรับจุดยืนแบบเต็ม

## Machine-readable endpoints

ไม่จำเป็นต้องใช้ MCP ไคลเอนต์สำหรับสิ่งเหล่านี้:

| เอนด์พอยต์ | คืออะไร |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [ประตูหน้าสำหรับเอเจนต์](/for-agents) ในรูปแบบ raw markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | ดัชนีที่คัดสรรแล้วของเว็บไซต์นี้ |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | ทุกหน้าที่จัดทำดัชนีไว้ แบบอินไลน์ |
| [`/queue.json`](https://champollion.dev/queue.json) | คิวเบนช์มาร์กแบบเต็ม |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | รายการคิวอันดับต้นๆ |
| [`/registry.json`](https://champollion.dev/registry.json) | รีจิสทรีของคลังข้อมูล (corpus registry) |
| [`/mesh.json`](https://champollion.dev/mesh.json) | กราฟภาษาที่วัดผลแล้ว |

## ขั้นตอนต่อไป

- [คู่มือเอเจนต์ — การสร้างและการทำเบนช์มาร์ก](/docs/network/getting-started/agent-guide)
- [คู่มือเอเจนต์ — การแปลด้วย CLI](/docs/guides/agent-guide)
- [ส่งวิธีการ (Submit a Method)](/docs/network/getting-started/submit-a-method)
