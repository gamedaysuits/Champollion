---
sidebar_position: 1
title: "เอกสารอ้างอิง CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLI Reference

## คำสั่ง

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

รัน `champollion <command> --help` เพื่อดูความช่วยเหลือโดยละเอียดสำหรับคำสั่งใดก็ได้

## ตัวเลือกส่วนกลาง

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

วิซาร์ดตั้งค่าแบบโต้ตอบที่สร้าง `champollion.config.json` นำทางผ่านการตั้งค่า source locale, ภาษาเป้าหมาย, รูปแบบไฟล์ และโมเดลการแปล

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**ตัวเลือก `--langs`**: รายการรหัสภาษาเป้าหมายที่คั่นด้วยเครื่องหมายจุลภาค ข้ามขั้นตอนการเลือกภาษาและใช้ค่าเริ่มต้น register preset สำหรับแต่ละภาษา รวมกับ `--yes` เพื่อตั้งค่าแบบไม่โต้ตอบอย่างสมบูรณ์

**Language presets**: เมื่อได้รับพรอมต์ให้เลือกภาษาเป้าหมาย คุณสามารถพิมพ์ชื่อ preset ได้:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

ผสม preset และรหัสภาษาแต่ละรายการ: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

แปลคีย์ที่ขาดหายไปและคีย์ที่ล้าสมัยในไฟล์ locale ทั้งหมด รันการตรวจสอบหลัง sync โดยค่าเริ่มต้น

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: โดยค่าเริ่มต้น `sync` จะโหลด `.champollion/tm.json` และให้บริการการแปลที่แคชไว้สำหรับค่า source ที่ไม่เปลี่ยนแปลง ใช้ `--no-tm` เพื่อข้ามแคช (มีประโยชน์เมื่อเปลี่ยน translation provider หรือดีบักคุณภาพ) ดู [Translation Memory](/docs/concepts/translation-memory)

**การตรวจจับการเปลี่ยนแปลง**: champollion จัดเก็บ SHA-256 hash ไว้ใน `.champollion.lock` เมื่อค่า source เปลี่ยนแปลง การ sync ครั้งถัดไปจะแปลคีย์เหล่านั้นใหม่โดยอัตโนมัติ Commit ไฟล์ lock เพื่อให้นักพัฒนาทุกคนใช้ baseline เดียวกัน

**Parallelism**: ทั้งการแปลคีย์ JSON และการแปลเนื้อหาทำงานแบบขนาน JSON locale ถูกแปลพร้อมกัน (ค่าเริ่มต้น: 200 locale พร้อมกัน) โดย batch ภายใน locale แต่ละรายการก็ทำงานแบบขนานด้วย (4 batch พร้อมกัน) การแปลเนื้อหา (Markdown, MDX, blog post) ทำงานในพูล work-item แบบแบน (ค่าเริ่มต้น: 48 API call พร้อมกัน) แทนที่ด้วย `--json-concurrency`, `--content-concurrency`, หรือ `--concurrency` (ตั้งค่าทั้งคู่)

**Output**: Sync แสดง version banner, การตรวจจับ format/framework, ประมาณการค่าใช้จ่าย และ progress bar แต่ละ locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Progress bar อัปเดตในตำแหน่งเดิมหลังจากแต่ละ batch (~80 คีย์) ใช้ `--quiet` สำหรับเฉพาะข้อผิดพลาด/คำเตือน หรือ `--json` สำหรับ output NDJSON ที่อ่านได้ด้วยเครื่อง ทั้งสองแบบจะซ่อน progress bar และ banner

---

## watch

Sync อัตโนมัติเมื่อไฟล์ source locale เปลี่ยนแปลง ทำงานจนกว่าจะหยุดด้วย `Ctrl+C`

```bash
champollion watch
```

---

## audit

แสดงรายการค่า fallback ที่มีคำนำหน้า `[EN]` ทั้งหมดที่ยังไม่ได้แปลจากการรันก่อนหน้า ออกด้วยรหัส 1 หากพบรายการใดก็ตาม — ใช้เป็น CI gate เพื่อทำให้ build ล้มเหลวเมื่อการแปลไม่สมบูรณ์

```bash
champollion audit
```

---

## verify

อ่านไฟล์ locale ทั้งหมดจากดิสก์อีกครั้งและตรวจสอบว่าการแปลมีอยู่จริงและถูกต้อง นี่คือการตรวจสอบเดียวกับที่รันโดยอัตโนมัติเมื่อสิ้นสุดทุก `sync` (เว้นแต่จะส่ง `--no-verify`)

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**สิ่งที่ตรวจสอบ:**
- Key parity — คีย์ source ทั้งหมดมีอยู่ในแต่ละ target
- เครื่องหมาย fallback `[EN]` จากการรันก่อนหน้า
- การแปลที่ว่างเปล่า
- Script compliance — locale ที่ไม่ใช่ Latin ควรมีการแปลที่ไม่ใช่ ASCII
- การรักษา placeholder — ICU placeholder ตรงกับ source
- ปัญหา encoding — BOM marker, อักขระที่มองไม่เห็น
- Source echo — ค่าที่เหมือนกับ source (คำเตือน)

---

## lint

สแกน source code เพื่อหาสตริงที่ hardcode สำหรับผู้ใช้ที่ควรใช้ i18n translation call ตรวจจับ framework ของคุณโดยอัตโนมัติ (next-intl, react-i18next, vue-i18n, Hugo)

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**สิ่งที่ตรวจจับ:**
- สตริงที่ hardcode ใน JSX text, `placeholder`, `alt`, `aria-label`, `title`
- ไฟล์ที่มีเนื้อหาสำหรับผู้ใช้แต่ไม่มี i18n framework import
- Dead key — คีย์ locale ที่ไม่มีไฟล์ source อ้างอิง
- คะแนน coverage — เปอร์เซ็นต์ของสตริงที่ผ่าน i18n

**การยกเว้น**: สร้าง `.champollionignore` ใน project root ของคุณ (glob pattern เช่น `.gitignore`)

---

## wrap

ห่อสตริงที่ hardcode ซึ่งตรวจพบโดย `lint` ใน `t()` call โดยอัตโนมัติ สร้าง backup อัตโนมัติก่อนแก้ไขไฟล์

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Safety gate:**
1. การตรวจสอบ Git-clean (ข้ามในโหมด dry-run)
2. Backup อัตโนมัติไปยัง `.champollion-backup/`
3. ดูตัวอย่าง diff ก่อนเขียนแต่ละไฟล์
4. รองรับ `--undo` เพื่อกู้คืนจาก backup

---

## seo

สร้าง SEO artifact สำหรับเว็บไซต์หลายภาษา

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcommand | Output |
|------------|--------|
| `hreflang` | แท็ก `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` หลายภาษา |
| `jsonld` | JSON-LD WebSite language schema |

---

## integrity

ตรวจจับความเสียหายและความคลาดเคลื่อนในไฟล์ locale ที่แปลแล้ว

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**สิ่งที่ตรวจสอบ:**
- ความเสียหายของ Placeholder (เช่น มี `{name}` ในต้นฉบับแต่หายไปในปลายทาง)
- ปัญหาการเข้ารหัส (mojibake, Unicode ที่ไม่ถูกต้อง)
- ข้อความที่ยังไม่ได้แปล (ค่าปลายทางเหมือนกับต้นฉบับทุกประการ) — คีย์ [`noTranslate`](/docs/getting-started/configuration#no-translate) จะได้รับการยกเว้น รวมถึงข้อความที่เหมือนกันซึ่ง Translation Memory ยืนยันว่าสร้างจากไปป์ไลน์และผ่านการอนุมัติจากเกตแล้ว สิ่งที่ยังคงถูกตั้งค่าสถานะ (flagged) คือสิ่งที่ `sync` จะนำกลับเข้าคิวใหม่พอดี — เครื่องมือทั้งสองนี้จะไม่มีความขัดแย้งกันในเรื่องความสมบูรณ์ของไฟล์
- ความคลาดเคลื่อนของ No-translate (คีย์ `noTranslate` ที่ *ไม่* เหมือนกับต้นฉบับ) — จะรายงานพร้อมค่าที่คาดหวัง/ค่าจริง และ escape ตัวอักษรที่มองไม่เห็น; รัน `champollion sync` เพื่อซ่อมแซม
- PUA ที่ไม่คาดคิด (จุดรหัส Private Use Area ใน locale ที่ปิดการใช้งาน [script conversion](/docs/getting-started/configuration#script-conversion) ไว้ — จะแสดงผลเป็นช่องว่างหากไม่มีฟอนต์พิเศษ); รัน `champollion repair-script` เพื่อซ่อมแซม
- ค่าที่กลวง (hollowed values) (ปลายทางที่เป็นต้นฉบับแต่ตัวอักษรถูกลบออก — ความเสียหายจากไปป์ไลน์ที่เก่ากว่าเกตการรักษาเนื้อหา); แปลใหม่ด้วย `sync --force-keys <key>` หรือ `sync --pair <pair> --force`
- คีย์กำพร้า (orphaned keys) (คีย์ในปลายทางที่ไม่มีอยู่ในต้นฉบับ)
- ความครบถ้วนของหมวดหมู่พหูพจน์ใน ICU MessageFormat (เช่น ภาษาอาหรับต้องการ 6 หมวดหมู่)

---

## repair-script

ย้อนกลับการแปลงสคริปต์ (script conversion) ที่ไม่ควรเกิดขึ้น: ค่าที่เข้ารหัสแบบ PUA (pIqaD, Tengwar, Kryptonian) ใน locale ที่การกำหนดค่าระบุว่าปิดการแปลงไว้ จะถูกกู้คืนกลับเป็นอักษรโรมัน (romanization) ผ่านตารางย้อนกลับของตัวแปลงเอง

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| ตัวเลือก | ผลลัพธ์ |
|--------|--------|
| `--dry` | ดูตัวอย่างการซ่อมแซมโดยไม่เขียนลงไฟล์ |
| `--locale <code>` | ซ่อมแซมเพียง locale เดียว |
| `--json` | เอาต์พุต JSON ที่เครื่องอ่านได้ |
| `--warn-only` | ออกด้วยรหัส 0 (Exit 0) แม้จะยังมี PUA ที่ย้อนกลับไม่ได้เหลืออยู่ |

pIqaD สามารถย้อนกลับได้ตรงตามเดิมทุกประการ การย้อนกลับของ Tengwar และ Kryptonian ไม่สามารถกู้คืนตัวพิมพ์ใหญ่-เล็กได้ (ถูกตั้งค่าสถานะเป็น case-lossy) Translation Memory ไม่จำเป็นต้องซ่อมแซม — เนื่องจากมีการจัดเก็บค่าก่อนการแปลงไว้ ออกด้วยรหัส 1 เมื่อมี PUA หลงเหลืออยู่โดยที่ไม่มีตัวแปลงที่ลงทะเบียนไว้ตัวใดสามารถย้อนกลับได้

---

## tm

จัดการแคช Translation Memory (`.champollion/tm.json`) TM จัดเก็บการแปลก่อนหน้าและให้บริการในการ sync ครั้งถัดไปแทนการเรียก API

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcommand | Output |
|------------|--------|
| `stats` | จำนวน entry, ขนาดไฟล์, รายละเอียดแต่ละ locale |
| `clear` | ลบไฟล์แคช (ทั้งหมดหรือแต่ละ locale) |

| ตัวเลือก | ผล |
|--------|--------|
| `--locale <code>` | ล้างเฉพาะ entry ของ locale เดียว |
| `--yes` | ข้ามพรอมต์ยืนยัน |

ดู [Translation Memory](/docs/concepts/translation-memory) สำหรับวิธีการทำงานของ TM และเวลาที่ควรล้าง

---

## xliff

Export และ import ไฟล์ XLIFF 1.2 สำหรับการตรวจสอบโดยนักแปลมืออาชีพ XLIFF คือรูปแบบการแลกเปลี่ยนสากลที่รองรับโดย CAT tool เช่น memoQ, SDL Trados และ Phrase

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcommand | Output |
|------------|--------|
| `export` | สร้าง `.xliff` จากไฟล์ locale source + target |
| `import` | รวมการแปล `.xliff` ที่ตรวจสอบแล้วเข้าในไฟล์ locale |

| ตัวเลือก | ผล |
|--------|--------|
| `--locale <code>` | Target locale สำหรับ export (จำเป็น) |
| `--out <path>` | กำหนด output path หรือไดเรกทอรีเอง |
| `--dry` | ดูตัวอย่าง import โดยไม่เขียนไฟล์ |

ดู [Working with Professional Translators](/docs/guides/professional-translators) สำหรับ workflow ฉบับสมบูรณ์

---

## status

แสดงการกำหนดค่า pair, plugin ที่ติดตั้ง, quality tier และคะแนน benchmark

```bash
champollion status
```

---

## provenance

ตรวจสอบการอนุญาตสิทธิ์ทรัพยากรการแปลสำหรับ plugin ที่ติดตั้งทั้งหมด

```bash
champollion provenance
```

---

## plugin

จัดการ plugin วิธีการแปล Plugin คือ translation recipe ที่บรรจุไว้ล่วงหน้าซึ่งติดตั้งไปยัง `.champollion/methods/`

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

ดู [Plugin Specification](/docs/reference/plugin-spec) สำหรับรูปแบบ plugin manifest

---

## leaderboard

เรียกดู ค้นหา และติดตั้งวิธีการแปลจาก Network leaderboard วิธีการที่ติดตั้งจาก leaderboard มาพร้อมกับคะแนน benchmark และ MethodConfig แบบ canonical ฉบับสมบูรณ์ — การกำหนดค่าที่แน่นอนที่ใช้ระหว่างการประเมิน

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| ตัวเลือก | ผล |
|--------|--------|
| `--pair <code>` | กรอง leaderboard ตาม language pair (เช่น `en:fr`) |
| `--install <name>` | ติดตั้ง method plugin จาก leaderboard |
| `--apply` | หลังติดตั้ง เพิ่ม `methodPlugin` ลงใน `champollion.config.json` โดยอัตโนมัติ |

**workflow `--apply`:** เมื่อคุณติดตั้งด้วย `--apply` champollion จะเขียน method plugin ไปยัง `.champollion/methods/` **และ** แก้ไข `champollion.config.json` ของคุณให้ใช้งานสำหรับ pair ที่เกี่ยวข้อง นี่คือเส้นทางที่เร็วที่สุดจาก "อะไรได้คะแนนดีที่สุด?" ไปสู่ "ฉันใช้งานมันใน production แล้ว"

---

## fonts

ดาวน์โหลดและจัดการ PUA web font สำหรับตัวแปลง script ภาษาสร้างสรรค์ ภาษาที่ใช้อักขระ Private Use Area (Klingon, Sindarin, Kryptonian) ต้องการ web font แบบกำหนดเองเพื่อแสดง script ของตน คำสั่งนี้ดาวน์โหลดจาก repository open-source ที่ได้รับการยืนยัน

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcommand | Output |
|------------|--------|
| `list` | แสดง PUA font ที่จำเป็นและสถานะการติดตั้ง |
| `install` | ดาวน์โหลด font สำหรับภาษาที่กำหนดค่าไว้ |

| ตัวเลือก | ผล |
|--------|--------|
| `--dir <path>` | แทนที่ไดเรกทอรี output ของ font (ตรวจจับอัตโนมัติจากประเภท project) |
| `--css` | สร้าง snippet `conlang-fonts.css` ควบคู่กับ font |
| `--config <path>` | Path ไปยังไฟล์ config (ใช้เพื่อตรวจจับว่าภาษาใดต้องการ font) |

**การตรวจจับอัตโนมัติ:** ไดเรกทอรี output ถูกอนุมานจากโครงสร้าง project ของคุณ:
- **Docusaurus** → `static/fonts/` หรือ `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **ค่าเริ่มต้น** → `public/fonts/`

**ตัวแปลง Unicode แบบ native** (`crk` → Cree Syllabics, `sr` → Serbian Cyrillic) **ไม่** ต้องการการติดตั้ง font

ดู [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) สำหรับรายละเอียด PUA font ฉบับสมบูรณ์

## Three-Layer Pipeline

ใช้ `lint`, `sync` และ `audit` ร่วมกันเพื่อ i18n ที่แข็งแกร่ง:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Layer | คำสั่ง | เมื่อใด | วัตถุประสงค์ |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | บล็อก commit ที่มีสตริง hardcode |
| **Sync** | `sync` | Post-commit / CI | แปลคีย์ที่ขาดหายไปและเปลี่ยนแปลง |
| **Verify** | `verify` | Post-sync / CI | ยืนยันว่าการแปลมีอยู่และถูกต้อง |
| **Audit** | `audit` | ขั้นตอน build | ทำให้ deployment ล้มเหลวหากมีเครื่องหมาย `[EN]` ใน locale ใดก็ตาม |

---

## ดูเพิ่มเติม

- [Configuration](/docs/getting-started/configuration) — เอกสารอ้างอิงไฟล์ config
- [Translation Methods](/docs/guides/translation-methods) — การเลือกวิธีการแปลแต่ละ pair
- [Translation Memory](/docs/concepts/translation-memory) — การแคชและการประหยัดค่าใช้จ่าย
- [Working with Professional Translators](/docs/guides/professional-translators) — XLIFF workflow
- [Plugin Specification](/docs/reference/plugin-spec) — รูปแบบ plugin manifest
- [CI/CD Guide](/docs/guides/ci-cd) — การทำให้คำสั่ง CLI ทำงานอัตโนมัติใน pipeline
- [How Sync Works](/docs/concepts/how-sync-works) — ทำความเข้าใจ sync pipeline
- [Quality Gate](/docs/concepts/quality-gate) — วิธีการตรวจสอบการแปล
