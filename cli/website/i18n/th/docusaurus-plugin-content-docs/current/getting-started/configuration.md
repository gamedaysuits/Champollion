---
sidebar_position: 3
title: "การกำหนดค่า"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# การกำหนดค่า

Champollion ทำงานได้โดยไม่ต้องกำหนดค่าใดๆ — ระบบจะตรวจจับไฟล์ locale รูปแบบ และภาษาเป้าหมายจากโปรเจกต์ของคุณโดยอัตโนมัติ หากต้องการควบคุมเพิ่มเติม ให้สร้าง `champollion.config.json` ในไดเรกทอรีรากของโปรเจกต์ หรือรัน:

```bash
npx champollion init
```

## เอกสารอ้างอิงการกำหนดค่าแบบเต็ม

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen ยังไม่ได้รับการพัฒนา]
บล็อกการกำหนดค่า `typegen` ได้รับการรับรู้และเก็บรักษาไว้โดย config loader แต่การสร้างประเภท TypeScript ยังไม่ได้รับการพัฒนา นี่เป็นเพียง placeholder สำหรับฟีเจอร์ที่วางแผนไว้ การตั้งค่าเหล่านี้ไม่มีผลใดๆ
:::


### ฟิลด์

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|------|---------|-------------|
| `version` | `number` | `3` | เวอร์ชันของสคีมาการกำหนดค่า ต้องเป็น `3` เสมอ |
| `inputLocale` | `string` | `"en"` | รหัสภาษาต้นทาง (BCP 47) |
| `localesDir` | `string` | `"./locales"` | พาธไปยังไฟล์ locale Champollion จะสแกนไดเรกทอรีนี้ |
| `contentDir` | `string` | `null` | ไดเรกทอรีเนื้อหาของ Hugo เปิดใช้งานการแปลเนื้อหา Markdown |
| `translatableFields` | `string[]` | `null` | เขียนทับฟิลด์ frontmatter เริ่มต้นที่สามารถแปลได้สำหรับการแปลเนื้อหา `null` จะใช้ค่าเริ่มต้นที่มีให้ (`title`, `description`, `summary`) |
| `format` | `string` | `"auto"` | รูปแบบไฟล์: `json`, `toml`, `yaml`, หรือ `auto` (ตรวจจับจากนามสกุลไฟล์) |
| `model` | `string` | `"google/gemini-3.5-flash"` | โมเดลเริ่มต้นสำหรับเมธอด LLM รองรับ slug เต็มของ OpenRouter (`provider/model`) หรือนามแฝงแบบสั้นจาก `shared/model-aliases.json` (เช่น `gemini-flash`) ผู้ให้บริการโดยตรงจะใช้ชื่อแบบไม่มีส่วนขยาย (เช่น `gpt-4o`) |
| `temperature` | `number` | `0.3` | อุณหภูมิของ LLM (0.0–2.0) ค่าน้อย = คาดเดาผลลัพธ์ได้มากขึ้น (deterministic) |
| `defaultMethod` | `string` | `"llm"` | เมธอดการแปลเริ่มต้น: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` ถูกเขียนทับได้ด้วยแฟล็ก CLI `--method` |
| `batchSize` | `number` | `80` | จำนวนคีย์ต่อแบตช์การแปล ค่ามาก = เรียก API น้อยลง แต่ prompt จะมีขนาดใหญ่ขึ้น |
| `coachingFile` | `string` | `null` | พาธไปยังไฟล์ coaching prompt แบบข้อความอิสระ (สัมพัทธ์กับรูทของโปรเจกต์) เนื้อหาจะถูกอ่านตอนเริ่มต้นและแทรกเข้าไปใน system prompt เป็นบล็อก `Coaching guidance:` |
| `promptContext` | `string` | `null` | สตริงบริบทของแอปพลิเคชันที่แทรกเข้าไปใน system prompt (เช่น "E-commerce product descriptions") ช่วยให้โมเดลปรับการแปลให้เข้ากับโดเมนของคุณ |
| `jsonConcurrency` | `number` | `200` | จำนวนการแปล locale คู่ขนานสูงสุดสำหรับการซิงค์คีย์ JSON ถูกเขียนทับได้ด้วยแฟล็ก CLI `--json-concurrency` |
| `contentConcurrency` | `number` | `48` | จำนวนการเรียก API คู่ขนานสูงสุดสำหรับการแปลเนื้อหา (Markdown/MDX) ถูกเขียนทับได้ด้วยแฟล็ก CLI `--content-concurrency` |
| `fallbackPrefix` | `string` | `"[EN] "` | คำนำหน้ามาร์กเกอร์ที่ `audit` และ `verify` ใช้เพื่อตรวจจับค่าที่ยังไม่ได้แปลแบบเก่าจากการรันครั้งก่อนหน้า Champollion จะไม่เขียนคำนำหน้านี้ — มันจะอ่านเพื่อการตรวจจับเท่านั้น |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | ชื่อตัวแปรสภาพแวดล้อมสำหรับ API key เขียนทับสำหรับชื่อตัวแปรสภาพแวดล้อมแบบกำหนดเอง |
| `minContentRetention` | `number` | `0.35` | สัดส่วนของตัวอักษร/ตัวเลขจากต้นทางที่ผลลัพธ์ต้องคงไว้ก่อนที่ [content-deletion check](/docs/concepts/quality-gate) จะตรวจสอบสัญญาณที่สอง สามารถตั้งค่าแยกตามคู่ภาษาและตามภาษาได้เช่นกัน |
| `noTranslate` | `string[]` | `[]` | คีย์แบบ dot-path และรูปแบบ glob ที่ค่าจะถูกคัดลอกไปยังทุก locale แบบคำต่อคำ ดูที่ [No-Translate Keys](#no-translate) รองรับในรูปแบบ `skipKeys` ด้วยเช่นกัน |
| `noTranslateUrls` | `boolean` | `true` | ปฏิบัติต่อค่าต้นทางที่เป็นเพียง URL `scheme://` ว่าไม่ต้องแปล ตั้งค่า `false` เพื่อส่งคีย์ที่มีค่าเป็น URL ไปยังแบ็กเอนด์การแปล |
| `baseUrl` | `string` | `""` | Base URL สำหรับการสร้างอาร์ติแฟกต์ SEO (hreflang, sitemaps, JSON-LD) |
| `pairs` | `object` | `{}` | การเขียนทับเมธอด โมเดล และคุณภาพแยกตามคู่ภาษา ดูที่ [Pair Configuration](#pair-configuration) |
| `languages` | `object` | `{}` | การเขียนทับแยกตามภาษา ดูที่ [Language Configuration](#language-configuration) |
| `lint.srcDir` | `string` | `null` | ไดเรกทอรีต้นทางสำหรับการสแกน lint `null` = ตรวจจับอัตโนมัติจากเฟรมเวิร์ก |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | รูปแบบ glob ที่จะยกเว้นจาก lint |
| `lint.minLength` | `number` | `2` | ความยาวสตริงขั้นต่ำที่จะตั้งแฟล็กว่าเป็นการฮาร์ดโค้ด |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | เทมเพลตรูปแบบ URL สำหรับการสร้างแท็ก hreflang |
| `seo.pages` | `string[]` | `null` | รายการหน้าแบบระบุชัดเจนสำหรับ SEO `null` = ตรวจจับอัตโนมัติจากคีย์ locale |
| `typegen.output` | `string` | `null` | พาธเอาต์พุตสำหรับประเภท TypeScript ที่สร้างขึ้น `null` = ปิดใช้งาน |
| `typegen.autoGenerate` | `boolean` | `false` | สร้างประเภทใหม่โดยอัตโนมัติหลังจากการซิงค์แต่ละครั้ง |

## คีย์ที่ไม่ต้องแปล (No-Translate Keys) {#no-translate}

ค่าบางค่ามีรูปแบบที่ถูกต้องเพียงรูปแบบเดียวในทุกภาษา: URL, พาธของรีโพสิทอรี, ชื่อแพ็กเกจ, ตัวระบุผลิตภัณฑ์ การแปลที่ถูกต้องของ `https://example.org/paper` คือ `https://example.org/paper`

[quality gate](/docs/concepts/quality-gate) ของ Champollion จะปฏิเสธ source-echo — การแปลที่เหมือนกับต้นทางทุกประการ — เพราะโดยปกติแล้วนั่นคือการที่โมเดลปฏิเสธที่จะทำงาน สำหรับคีย์เหล่านี้ นั่นทำให้คำตอบที่ถูกต้องกลายเป็นคำตอบที่ถูกปฏิเสธ และไม่มีผลลัพธ์ใดที่โมเดลสามารถสร้างขึ้นมาแล้วผ่านการตรวจสอบได้ โมเดลที่อ่อนกว่าจะเรียนรู้ที่จะเอาชนะ gate โดยการปรับเปลี่ยนค่าเพียงเล็กน้อย (เช่น การสร้าง `#fragment` ปลอมขึ้นมา, การใส่เครื่องหมายทับต่อท้ายแบบผิดที่, การใส่ช่องว่างที่มองไม่เห็น) ซึ่งทำให้เกิดลิงก์เสีย โมเดลที่เก่งกว่าจะส่งคืนค่าเดิมโดยไม่เปลี่ยนแปลงและไม่ผ่าน gate ดังนั้น `sync` จึงออกด้วยค่าที่ไม่ใช่ศูนย์ในทุกๆ การรัน

ให้ประกาศคีย์เหล่านั้นแทน:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

คีย์ที่ตรงกันจะถูก **คัดลอกมาจาก locale ต้นทางแบบคำต่อคำ** — จะไม่ถูกส่งไปยังแบ็กเอนด์การแปล, ไม่ถูกตรวจสอบด้วย quality gate, ไม่ถูกนับว่าเป็นความล้มเหลว และไม่ถูกคิดเงิน คีย์เหล่านี้จะถูกยกเว้นจากการประเมินค่าใช้จ่ายก่อนการรันด้วยเหตุผลเดียวกัน

### ไวยากรณ์ของรูปแบบ

รูปแบบจะเป็น dot-path บนพื้นที่คีย์แบบแบนราบ โดยมีไวลด์การ์ดสองตัว:

| รูปแบบ | ตรงกับ | ไม่ตรงกับ |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (พาธแบบตรงตัว) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (โหนดใบ `url` ที่ระดับความลึกใดๆ) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` จะตรงกับภายในเซกเมนต์เดียว; `**` จะตรงกับศูนย์หรือหลายเซกเมนต์แบบเต็ม รูปแบบที่ไม่มีไวลด์การ์ดคือพาธของคีย์แบบตรงตัว

### URL จะถูกจัดการโดยค่าเริ่มต้น

เนื่องจากคีย์ที่มีค่าเป็น URL จะไม่มีผลลัพธ์ที่ถูกต้องภายใต้ gate ดังนั้น `noTranslateUrls` จึงเป็น `true` มาตั้งแต่ต้น: ค่าต้นทางใดๆ ที่เป็นเพียง absolute URL `scheme://` จะถูกปฏิบัติต่อว่าไม่ต้องแปลโดยไม่ต้องกำหนดค่าใดๆ

การตรวจจับจะถูกจำกัดให้แคบอย่างจงใจ — ค่าที่ถูกตัดช่องว่างทั้งหมดจะต้องเป็น URL ข้อความที่มีเพียงลิงก์ประกอบอยู่ (`"Read the paper at https://…"`) จะยังคงถูกแปลตามปกติ

คุณสามารถปิดการทำงานนี้ได้ด้วย `"noTranslateUrls": false` หาก URL ของคุณมีความเฉพาะเจาะจงตาม locale จริงๆ (เช่น โฮสต์เอกสารแยกตามภาษา) — จากนั้นให้ประกาศ URL ที่ไม่เฉพาะเจาะจงด้วย `noTranslate`

### การซ่อมแซมและการบังคับใช้

สำหรับคีย์ที่ไม่ต้องแปล จะมีค่าเป้าหมายที่ถูกต้องเพียงค่าเดียวเท่านั้น ดังนั้นความแตกต่างใดๆ จึงถือเป็นข้อบกพร่อง Champollion จะบังคับใช้สิ่งนี้ในทั้งสองทิศทาง:

- **`sync` จะซ่อมแซมมัน** คีย์ที่ไม่ต้องแปลซึ่งเป้าหมายหายไป, มีคำนำหน้า `[EN] `, หรือถูกเปลี่ยนแปลง จะถูกเขียนใหม่จากต้นทาง การทำเช่นนี้จะไม่เสียค่าใช้จ่ายในการเรียก API และเป็น idempotent: เมื่อค่าตรงกันแล้ว การซิงค์ในภายหลังจะข้ามคีย์นี้ไปทั้งหมด
- **`verify` และ `integrity` จะล้มเหลวเมื่อพบมัน** คีย์ที่ไม่ต้องแปลที่คลาดเคลื่อนไปจะถูกรายงานเป็น `NO-TRANSLATE DRIFT` พร้อมกับค่าที่คาดหวังและค่าจริง — อักขระที่มองไม่เห็นจะถูก escape เป็น `\uXXXX` เนื่องจากความเสียหายประเภทนี้จะไม่สามารถมองเห็นได้ใน diff `champollion integrity` จะออกด้วย `1` ดังนั้นบิลด์ที่เชื่อมต่อกับมันจะจับ URL ที่เสียหายได้ก่อนที่จะถูกส่งออกไป

หาก `integrity` ล้มเหลวด้วยวิธีนี้ในโปรเจกต์ที่คุณเพิ่งกำหนดค่า แสดงว่ามันกำลังรายงานความเสียหายที่มีอยู่แล้วในไฟล์ locale ของคุณ ให้รัน `champollion sync` หนึ่งครั้งเพื่อซ่อมแซม

## การแปลงสคริปต์ (Script Conversion) {#script-conversion}

บางภาษาที่ Champollion แปลสามารถ *เขียน* ได้มากกว่าหนึ่งวิธี โมเดลจะทำงานใน **สคริปต์การทำงาน (working script)** ของภาษาเสมอ (การถอดอักษรละติน — SRO สำหรับ Plains Cree, การถอดอักษร Okrand สำหรับ Klingon) และตัวแปลงแบบกำหนดได้จะสามารถเขียนผลลัพธ์ใหม่ให้อยู่ในสคริปต์สำหรับแสดงผลได้ การจะทำเช่นนั้นหรือไม่ขึ้นอยู่กับการตัดสินใจในการกำหนดค่า — **จะไม่มีการตั้งเป็นค่าเริ่มต้นเด็ดขาด**:

| Locale | สคริปต์การทำงาน | แปลงเป็น | ประเภท |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabics) | Unicode จริง — **ต้องเลือก** |
| `sr` / `srp` (Serbian) | `Latn` | `Cyrl` (Cyrillic) | Unicode จริง — **ต้องเลือก** |
| `tlh` (Klingon) | `Latn` (romanization) | `Piqd` (pIqaD) | PUA — ต้องเลือกเปิดใช้งาน (opt-in) |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — ต้องเลือกเปิดใช้งาน (opt-in) |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — ต้องเลือกเปิดใช้งานผ่าน `"script": "x-kryptonian"` |

**คู่ภาษาที่เป็น Unicode จริง (crk, sr) จำเป็นต้องเลือก** Cree Syllabics และ Cyrillic เป็น Unicode ธรรมดา — สามารถเรนเดอร์ได้ทุกที่ — และระบบการเขียนทั้งสองแบบก็มีการใช้งานจริง Champollion จะไม่เลือกระบบการเขียนของชุมชนแทนโปรเจกต์: `init` จะถามเมื่อคุณเลือกภาษา และ `sync` จะปฏิเสธการรันจนกว่าการกำหนดค่าจะระบุว่าเลือกแบบใด:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**สคริปต์ PUA (tlh, x-elvish-s, x-kryptonian) จะใช้ romanization เป็นค่าเริ่มต้น** pIqaD, Tengwar และ Kryptonian *ไม่ได้อยู่ใน Unicode* — ตัวแปลงจะปล่อย codepoint ใน Private Use Area ซึ่งจะไม่แสดงผลอะไรเลยเว้นแต่คุณจะแนบฟอนต์ที่แมปกับ codepoint เหล่านั้นมาด้วย Romanization เป็นผลลัพธ์เดียวที่เรนเดอร์ได้ทุกที่ ดังนั้นจึงเป็นค่าเริ่มต้น หากต้องการปล่อยสคริปต์สำหรับแสดงผลแทน:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…และรัน `champollion fonts install` เพื่อให้เว็บไซต์ของคุณมีฟอนต์ที่สามารถวาดมันได้ หากฟอนต์ของคุณถูกผูกไว้กับการทับศัพท์ภาษาละติน (ฟอนต์ภาษาประดิษฐ์หลายตัวเป็นเช่นนั้น) ให้ใช้ค่าเริ่มต้นต่อไป

`script` รับรหัส ISO 15924 โดยไม่สนใจตัวพิมพ์เล็ก/ใหญ่ (`"cans"`, `"Cans"` และ `"CANS"` มีค่าเท่ากัน) นอกจากนี้ยังสามารถตั้งค่าแยกตามคู่ภาษาได้ ซึ่งจะมีความสำคัญเหนือกว่าระดับภาษา ค่าที่ไม่ถูกต้อง หรือสคริปต์ที่ locale ไม่สามารถสร้างได้ จะล้มเหลวตั้งแต่ตอนเริ่มต้น — ก่อนที่จะมีการเรียก API ใดๆ

### ตัวอักษรที่ไม่ได้แมปและ `scriptFallback` {#script-fallback}

ตัวแปลงจะแปลเฉพาะสิ่งที่ระบบการเขียนกำหนดไว้และไม่มีอะไรอื่นอีก Klingon romanization ไม่มี `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` หรือ `z` — ดังนั้นผลลัพธ์ของโมเดลที่มีคำนามเฉพาะอย่าง "GitHub" จึงไม่สามารถแปลงได้อย่างสมบูรณ์ Champollion **จะไม่เขียนค่าที่แปลงไปเพียงครึ่งเดียวเด็ดขาด**: หากมีตัวอักษรใดที่ไม่สามารถแมปได้ ค่าทั้งหมดจะยังคงอยู่ในสคริปต์การทำงาน และคำเตือนจะระบุชื่อตัวอักษรพร้อมกับบรรทัดการกำหนดค่าที่จะใช้แมปพวกมัน

การแมปเหล่านั้นเป็นหน้าที่ของคุณที่จะต้องประกาศ:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

แต่ละกฎจะแทนที่ลำดับของสคริปต์การทำงานด้วยลำดับที่ตัวแปลง *สามารถ* แมปได้ ก่อนที่การแปลงจะทำงาน กฎต่างๆ จะถูกตรวจสอบความถูกต้องตอนเริ่มต้น — การแทนที่ที่ไม่สามารถแมปได้ในตัวเองจะถูกปฏิเสธ

Champollion **ไม่มีกฎ fallback ของตัวเอง** มาให้: การประดิษฐ์การดัดแปลงระบบการเขียน โดยเฉพาะอย่างยิ่งสำหรับระบบการเขียนของภาษาจริง ไม่ใช่สิ่งที่ดัชนีควรจะเป็นผู้ตัดสินใจ ชุมชนและกลุ่มแฟนคลับมีธรรมเนียมปฏิบัติของตนเอง — โปรดนำมาใช้อย่างรอบคอบในแต่ละโปรเจกต์

### การซ่อมแซมการแปลงที่ไม่ต้องการ {#repair-script}

ก่อนเวอร์ชัน 0.3.0 การแปลงจะเกิดขึ้นอย่างไม่มีเงื่อนไข — โปรเจกต์ที่กำหนดเป้าหมายไปยัง locale แบบ PUA จะได้รับผลลัพธ์ที่ไม่สามารถเรนเดอร์ได้ไม่ว่าพวกเขาจะต้องการหรือไม่ก็ตาม มีเครื่องมือสองตัวที่ช่วยแก้ปัญหานี้:

- **`champollion repair-script`** จะสแกน locale ที่การกำหนดค่าระบุว่า *ปิด* การแปลงสำหรับ codepoint แบบ PUA และจะกู้คืน romanization โดยใช้ตารางย้อนกลับของตัวแปลงเอง (ใช้ `--dry` เพื่อดูตัวอย่าง) pIqaD จะย้อนกลับได้อย่างแม่นยำ; การย้อนกลับของ Tengwar และ Kryptonian จะสูญเสียตัวพิมพ์ใหญ่/เล็กและจะมีการแจ้งให้ทราบ
- **`champollion integrity`** จะล้มเหลว (exit 1) เมื่อพบ PUA ในที่ที่ปิดการแปลงไว้ — ดังนั้น build gate จะจับข้อความที่ไม่สามารถเรนเดอร์ได้ก่อนที่จะถูกส่งออกไป และรายงานจะระบุชื่อการซ่อมแซม

Translation Memory ไม่จำเป็นต้องได้รับการซ่อมแซม: มันจะเก็บค่าก่อนการแปลงไว้ ดังนั้นการเปิดหรือปิด `script:` ในภายหลังจึงไม่ต้องมีการจัดการแคชใดๆ

การแปลงสคริปต์จะใช้กับสตริง UI (ไฟล์ key-value และ Docusaurus JSON) เนื้อหา Markdown จะไม่ถูกแปลงเด็ดขาด — ตัวแปลงอักขระแบบ greedy ไม่มีวิธีที่ปลอดภัยในการผ่าน code span, URL และ front matter

## การกำหนดค่าคู่ {#pair-configuration}

แต่ละคู่ต้นทาง→เป้าหมายสามารถกำหนดค่าได้อย่างอิสระ:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### ฟิลด์ของคู่

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `method` | `string` | วิธีการแปล: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | ชื่อของ plugin ที่ติดตั้งแล้ว (จาก `.champollion/methods/`) |
| `model` | `string` | แทนที่โมเดลเริ่มต้นสำหรับคู่นี้ |
| `temperature` | `number` | แทนที่อุณหภูมิเริ่มต้นสำหรับคู่นี้ |
| `batchSize` | `number` | แทนที่ขนาด batch เริ่มต้นสำหรับคู่นี้ |
| `register` | `string` | การแทนที่ register/โทนเสียง (preset key หรือข้อความอิสระ) |
| `endpoint` | `string` | URL ของ endpoint API ระยะไกล จำเป็นเมื่อ `method` เป็น `api` |
| `coachingFile` | `string` | พาธไปยังไฟล์ coaching prompt สำหรับคู่นี้ |
| `promptContext` | `string` | บริบทของแอปพลิเคชันสำหรับคู่นี้ |
| `qualityTier` | `string` | ระดับการแสดงผล: `standard`, `high`, `research`, `verified` |

## การกำหนดค่าภาษา {#language-configuration}

ภาษารองรับสามรูปแบบ:

### อาร์เรย์ของรหัส (ง่ายที่สุด)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

แต่ละภาษาจะได้รับ register เริ่มต้นจากตาราง register ในตัว ภาษาที่ไม่มีค่าเริ่มต้นจะได้รับ `"Professional register."`

### อ็อบเจกต์พร้อมสตริง register

ค่าสามารถเป็น **preset key** จาก language card หรือข้อความ register ที่กำหนดเอง:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion จะตรวจสอบว่าสตริงตรงกับ preset key ใน language card หรือไม่ หากตรงกัน จะใช้ register prompt แบบเต็มจาก card นั้น หากไม่ตรงกัน จะใช้สตริงนั้นตามที่เป็น ดู [ภาษาที่รองรับ](/docs/reference/supported-languages#language-cards) สำหรับ preset ที่มีอยู่

### อ็อบเจกต์พร้อมการกำหนดค่าแบบเต็ม

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

คุณสามารถผสมรูปแบบย่อและอ็อบเจกต์แบบเต็มในบล็อกเดียวกันได้


### ฟิลด์ภาษา

| ฟิลด์ | ประเภท | คำอธิบาย |
|-------|------|-------------|
| `register` | `string` | คำแนะนำเกี่ยวกับสไตล์/น้ำเสียง สามารถเป็น **คีย์พรีเซ็ต** (เช่น `casual-tu`, `formal-hapsyo`) หรือข้อความแบบกำหนดเอง ดูที่ [Language Cards](/docs/reference/supported-languages#language-cards) |
| `name` | `string` | ชื่อภาษาที่มนุษย์อ่านได้ (สำหรับการแสดงสถานะ) |
| `model` | `string` | เขียนทับโมเดลเริ่มต้น |
| `temperature` | `number` | เขียนทับอุณหภูมิเริ่มต้น |
| `batchSize` | `number` | เขียนทับขนาดแบตช์เริ่มต้น |
| `coachingFile` | `string` | พาธไปยังไฟล์ coaching prompt สำหรับภาษานี้ |
| `promptContext` | `string` | บริบทของแอปพลิเคชันสำหรับภาษานี้ |
| `maxRetries` | `number` | งบประมาณการลองใหม่สูงสุดสำหรับแบตช์ที่ล้มเหลว (ค่าเริ่มต้น: 3) |
| `script` | `string` | รหัส ISO 15924 ของระบบการเขียนที่ Champollion เขียน (เช่น `"Cans"`, `"Piqd"`) ดูที่ [Script Conversion](#script-conversion) |
| `scriptFallback` | `object` | กฎการทับศัพท์สำหรับตัวอักษรที่ตัวแปลงสคริปต์ไม่สามารถแมปได้ ดูที่ [Script Conversion](#script-conversion) |

:::info[ลำดับการสืบทอด]
การตั้งค่าจะถูกแก้ไขตามลำดับนี้ (ค่าแรกมีผลก่อน):

**ระดับคู่** → **ระดับภาษา** → **การกำหนดค่าส่วนกลาง** → **ค่าเริ่มต้น**

ตัวอย่างเช่น หาก `pairs["en:fr"]` ตั้งค่า `model` จะแทนที่ค่า `model` ทั้งในระดับภาษาและระดับส่วนกลาง
:::

## ภาษาต้นทางที่ไม่ใช่ภาษาอังกฤษ

หากภาษาต้นทางของคุณไม่ใช่ภาษาอังกฤษ:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Lock File

Champollion สร้าง `.champollion.lock` เพื่อติดตาม SHA-256 hash ของค่าต้นทางที่แปลแล้ว **Commit ไฟล์นี้** เพื่อให้นักพัฒนาทุกคนใช้ baseline การแปลเดียวกัน

เมื่อค่าต้นทางเปลี่ยนแปลง hash จะไม่ตรงกันอีกต่อไป และ champollion จะแปล key นั้นใหม่ในการซิงค์ครั้งถัดไป

## `.champollionignore`

สร้าง `.champollionignore` ในไดเรกทอรีรากของโปรเจกต์เพื่อยกเว้นไฟล์จากการสแกน `lint` ใช้รูปแบบ glob เช่น `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## ไดเรกทอรี `.champollion/`

Champollion สร้างไดเรกทอรี `.champollion/` ในไดเรกทอรีรากของโปรเจกต์สำหรับสถานะภายใน โดยทั่วไปควร **เพิ่มไดเรกทอรีนี้ใน `.gitignore`** — เป็นการปรับแต่งในเครื่อง ไม่ใช่ source ของโปรเจกต์:

```gitignore
.champollion/
```

| ไฟล์ | วัตถุประสงค์ | Commit? |
|------|---------|--------|
| `tm.json` | แคช Translation Memory — เก็บการแปลก่อนหน้าโดยใช้ข้อความต้นทาง + locale + วิธีการเป็น key | ไม่ (แคชในเครื่อง) |
| `xliff/*.xliff` | ไฟล์ XLIFF สำหรับการตรวจสอบโดยนักแปลมืออาชีพ | ไม่ (ชั่วคราว) |
| `methods/` | manifest ของ method plugin ที่ติดตั้งแล้ว | ใช่ (การกำหนดค่าร่วมกัน) |
| `backups/` | ไฟล์สำรองก่อน wrap (สร้างโดย `wrap --undo`) | ไม่ (ตาข่ายนิรภัย) |

ดู [Translation Memory](/docs/concepts/translation-memory) สำหรับรายละเอียดเกี่ยวกับ `tm.json` และวิธีที่ช่วยประหยัดค่าใช้จ่าย API

---

## Programmatic API

สำหรับ build script และการผสานรวมที่กำหนดเอง ให้ import โดยตรงจาก package:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### Export ที่มีให้ใช้งาน

| Export | หน้าที่ |
|--------|-------------|
| `TranslationMethod` | คลาสพื้นฐานสำหรับทุกวิธีการ |
| `LLMMethod` | คลาสพื้นฐานสำหรับวิธีการ LLM (OpenRouter) |
| `DirectLLMMethod` | คลาสพื้นฐานสำหรับผู้ให้บริการ LLM โดยตรง (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | คลาสผู้ให้บริการ LLM โดยตรง |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | คลาส MT แบบดั้งเดิม |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Coached LLM (OpenRouter + ข้อมูล coaching) |
| `APIMethod` | Remote API client |
| `runSync`, `runContentSync` | pipeline การซิงค์แบบเต็ม |
| `resolveConfig`, `resolvePairs` | การแก้ไขการกำหนดค่า |
| `validateTranslations` | Quality gate |
| `loadCoachingData`, `findDictionaryMatches` | ยูทิลิตี้ coaching |

### การขยาย Custom Provider

ขยาย `DirectLLMMethod` เพื่อเพิ่มผู้ให้บริการ LLM ใหม่ในประมาณ 40 บรรทัด:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

คุณได้รับ translate, coaching, retry loop, การตรวจสอบโมเดล, quality tier และความช่วยเหลือในการตั้งค่าโดยไม่ต้องเขียนเพิ่ม เฉพาะรูปแบบ HTTP request เท่านั้นที่เฉพาะเจาะจงกับผู้ให้บริการ สำหรับ adapter ที่ไม่ใช่ LLM ที่ใช้ `fetch()` แบบดิบ ให้ใช้ helper `fetchWithRetry()` ที่ใช้ร่วมกันจาก `lib/methods/fetch-with-retry.js` แทนการเขียน retry loop ของตัวเอง

---

## ดูเพิ่มเติม

- [เอกสารอ้างอิง CLI](/docs/reference/cli) — คำสั่งและ flag ทั้งหมด
- [วิธีการแปล](/docs/guides/translation-methods) — การเลือกและผสมวิธีการ
- [Translation Memory](/docs/concepts/translation-memory) — การแคชและการประหยัดค่าใช้จ่าย
- [การทำงานกับนักแปลมืออาชีพ](/docs/guides/professional-translators) — workflow ของ XLIFF
- [ข้อกำหนด Plugin](/docs/reference/plugin-spec) — รูปแบบ manifest ของ method plugin
- [สถาปัตยกรรม](/docs/concepts/architecture) — วิธีที่ส่วนต่างๆ เชื่อมต่อกัน
- [ภาษาที่รองรับ](/docs/reference/supported-languages) — การรองรับภาษาในตัว
- [วิธีการทำงานของ Sync](/docs/concepts/how-sync-works) — pipeline การแปล
