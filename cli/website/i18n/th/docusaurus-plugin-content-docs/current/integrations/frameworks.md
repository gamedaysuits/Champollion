# คู่มือการผสานรวม

การตั้งค่าทีละขั้นตอนสำหรับ champollion กับเฟรมเวิร์กยอดนิยม

---

## การตั้งค่า API Key

ก่อนผสานรวมกับเฟรมเวิร์กใดๆ คุณต้องมี API key สำหรับการแปล Champollion รองรับผู้ให้บริการสองราย:

### ตัวเลือก A: OpenRouter (แนะนำ)

[OpenRouter](https://openrouter.ai) ให้บริการ API แบบรวมศูนย์สำหรับโมเดล LLM กว่า 200 รายการ มีระดับบริการฟรี

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

เหมาะสำหรับ: โปรเจกต์ที่มีเนื้อหาจำนวนมาก การแปล Markdown และโปรเจกต์ที่ต้องการการป้องกันเนื้อหา (code blocks, shortcodes, ตัวแปร interpolation)

### ตัวเลือก B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

เหมาะที่สุดสำหรับ: คู่สตริง key-value ปริมาณมาก (194 ภาษา) **ไม่แนะนำ** สำหรับเนื้อหา Markdown — Google Translate ไม่รู้จักบล็อกโค้ด, ชอร์ตโค้ด หรือตัวแปรแทรก

หากต้องการใช้ Google Translate อย่างชัดเจน:

```bash
champollion sync --method google-translate
```

> **เคล็ดลับ**: หากตั้งค่าเฉพาะ `GOOGLE_TRANSLATE_API_KEY` (ไม่มี OpenRouter key) champollion จะสลับไปใช้ Google Translate โดยอัตโนมัติ

---

## Hugo (TOML / YAML / Markdown)

### โครงสร้างโปรเจกต์

Hugo ใช้ `i18n/` สำหรับการแปล string และ `content/` สำหรับเนื้อหาหน้า:

```
my-hugo-site/
├── i18n/
│   ├── en.toml             ← source of truth
│   ├── fr.toml
│   └── ja.toml
├── content/
│   ├── posts/
│   │   ├── hello.md        ← source (English)
│   │   ├── hello.fr.md
│   │   └── hello.ja.md
│   └── about.md
└── .env.local
```

### การตั้งค่า

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

สร้าง `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "format": "auto",
  "languages": ["fr", "de", "ja", "es", "ko", "zh"]
}
```

```bash
champollion sync           # sync i18n string files + content files
champollion sync --dry     # preview changes without writing
```

### รายละเอียดการแปลเนื้อหา

**Front matter**: รองรับทั้ง YAML (`---`) และ TOML (`+++`) delimiters แปล `title`, `description`, `summary`, `subtitle`, `caption` และ `linkTitle` ตามค่าเริ่มต้น ฟิลด์อื่นๆ ทั้งหมด (date, draft, tags, weight, slug ฯลฯ) จะถูกเก็บรักษาไว้ ปรับแต่งได้ด้วย `translatableFields` ในการกำหนดค่าของคุณ

**การป้องกัน Block**: Code blocks, Hugo shortcodes (`{{< >}}`, `{{% %}}`), inline code และ raw HTML จะถูกป้องกันโดยอัตโนมัติโดยใช้ Unicode sentinel placeholders และจะผ่านไปโดยไม่ถูกแตะต้อง

**รูปแบบชื่อไฟล์**: ปฏิบัติตามรูปแบบ translation-by-filename ของ Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (ตัด source suffix ออก)

**ข้ามไฟล์ที่มีอยู่**: ไฟล์ที่แปลแล้วจะไม่ถูกเขียนทับ ลบไฟล์เป้าหมายเพื่อบังคับให้แปลใหม่

### รูปแบบพหูพจน์

TOML และ YAML locales รองรับรูปแบบพหูพจน์ CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

แสดงภายในเป็น `items.one` และ `items.other` สำหรับการ diff จากนั้น re-serialize ไปยังรูปแบบ sectioned ที่ถูกต้องเมื่อเขียน

---

## next-intl (JSON)

### โครงสร้างโปรเจกต์

```
my-app/
├── messages/
│   └── en.json        ← source of truth
├── src/
│   ├── i18n/
│   │   ├── routing.ts
│   │   └── request.ts
│   └── middleware.ts
└── .env.local
```

### การตั้งค่า

```bash
npm install --save-dev champollion
```

สร้าง `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": ["fr", "de", "ja", "es", "ko", "zh", "pt", "ar"]
}
```

```bash
npx champollion sync
```

สร้าง `messages/fr.json`, `messages/ja.json` ฯลฯ — แปลครบถ้วน โดยรักษาโครงสร้าง nested key ของคุณไว้ next-intl จะรับรู้ไฟล์เหล่านี้โดยอัตโนมัติ

### ขั้นตอนการพัฒนา

```json
{
  "scripts": {
    "dev": "champollion watch & next dev",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

---

## react-i18next (JSON)

### โครงสร้างไฟล์แบบ Flat (แนะนำ)

```
locales/
├── en.json
├── fr.json
└── ja.json
```

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": ["fr", "de", "ja"]
}
```

### โครงสร้างไดเรกทอรีแบบ Nested

หากคุณใช้โครงสร้าง `{locale}/{namespace}.json` ให้สร้าง sync script เพื่อ flatten → แปล → unflatten ดูรายละเอียดได้ที่ [เอกสาร react-i18next](https://react.i18next.com/)
