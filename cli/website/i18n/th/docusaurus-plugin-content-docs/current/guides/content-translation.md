---
sidebar_position: 5
title: "การแปลเนื้อหา"
---

# การแปลเนื้อหา (Hugo Markdown)

Champollion แปลไฟล์ Hugo Markdown — ทั้งฟิลด์ front matter และเนื้อหาในส่วน body — พร้อมการป้องกันอย่างครบถ้วนสำหรับ code blocks, shortcodes และองค์ประกอบที่มีโครงสร้าง

## การตั้งค่า

ตั้งค่า `contentDir` ในไฟล์ config ของคุณเพื่อเปิดใช้งานการแปลเนื้อหา Markdown:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## สิ่งที่จะถูกแปล

### Front Matter

รองรับทั้ง YAML (`---`) และ TOML (`+++`) delimiters โดยค่าเริ่มต้น ฟิลด์เหล่านี้จะถูกแปล:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

ฟิลด์อื่น ๆ ทั้งหมด (`date`, `draft`, `tags`, `weight`, `slug` ฯลฯ) จะถูกเก็บไว้ตามเดิม สามารถปรับแต่งได้ด้วย `translatableFields` ในไฟล์ config ของคุณ

### เนื้อหาในส่วน Body

เนื้อหา Markdown ทั้งหมดในส่วน body จะถูกแปลพร้อมการป้องกันระดับ block — องค์ประกอบที่มีโครงสร้างจะถูกป้องกันด้วย Unicode sentinel placeholders ก่อนการแปล และจะถูกคืนค่าหลังจากการแปลเสร็จสิ้น

## การป้องกัน Block

องค์ประกอบเหล่านี้จะผ่านกระบวนการแปลโดยไม่ถูกแก้ไข:

| องค์ประกอบ | ตัวอย่าง | การป้องกัน |
|---------|---------|-----------|
| Code blocks | ``````` ```js ... ``` ``````` | ป้องกันทั้ง block |
| Inline code | `` `variable` `` | ถูกป้องกัน |
| Hugo shortcodes | `{{< figure >}}`, `{{% note %}}` | ป้องกันทั้ง block |
| Raw HTML | `<div>`, `<table>` | ถูกป้องกัน |
| Links (URLs) | `[text](https://...)` | URL ถูกเก็บไว้, ข้อความถูกแปล |
| Interpolation | `{{ .Count }}` | ถูกป้องกัน |

## รูปแบบการตั้งชื่อไฟล์

ปฏิบัติตามรูปแบบ translation-by-filename ของ Hugo:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## พฤติกรรมการข้ามไฟล์

ไฟล์ที่แปลแล้วจะ**ไม่ถูกเขียนทับ**เด็ดขาด หาก `my-post.fr.md` มีอยู่แล้ว ไฟล์นั้นจะถูกข้ามไป ลบไฟล์ปลายทางเพื่อบังคับให้แปลใหม่

## วิธีการที่ใช้ได้เฉพาะกับ Markdown

:::warning[Google Translate และ Markdown]
Google Translate **ไม่รู้จัก** code block, shortcode หรือตัวแปร interpolation และจะทำให้เนื้อหา Markdown ที่มีโครงสร้างเสียหาย ใช้วิธี LLM (`llm` หรือ `llm-coached`) สำหรับการแปลเนื้อหา เนื่องจากวิธีเหล่านี้ป้องกันองค์ประกอบที่มีโครงสร้างอย่างชัดเจน
:::

เมื่อการแปลเนื้อหาถอยกลับจาก Google Translate ไปใช้วิธี LLM champollion จะบันทึกคำเตือนพร้อมอธิบายสาเหตุ
