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

คำสั่งที่สร้างระบบแปลภาษาด้วยเครื่องสำหรับภาษาหนึ่ง ๆ — ราง (rails) — ทำงาน
บนโฟลเดอร์โปรเจกต์ที่ `champollion new` สร้างขึ้น:

```
champollion new <folder>      Start a project: --from <language> --to <language> (--dry says the direction back first)
champollion next              THE next step, from the project's files (--json for agents)
champollion data add <file>   Bring in a spreadsheet, .csv/.tsv, Word table, dictionary or ELAN file
champollion data mark <file>  Record what a data file's holders decided
champollion data combine      Join the pair files into the one training reads
champollion improve <step>    Make a model in use better, round by round (time, wishlist, sheet, marks, prepare, report, status)
champollion validate          Check a project's files against the schemas every tool shares
champollion upgrade           Rewrite older framework files in the current formats (--dry first)
champollion connect <model>   Put a served model into an app or website project (--app <folder>)
```

คำสั่งที่แปลไฟล์ของแอปหรือเว็บไซต์:

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion serve             Serve this project's translation stack over HTTP (the api method's contract)
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion models check      Check every default model against the providers' live lists (free)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

คำสั่งที่ทำงานกับดัชนีและลีดเดอร์บอร์ดที่ใช้ร่วมกัน แทนที่จะทำงานกับโปรเจกต์ของคุณ ถูกจัดกลุ่มไว้ภายใต้ `champollion network` โดยแต่ละคำสั่งสามารถทำงานได้โดยไม่ต้องมีคำนำหน้าเช่นกัน:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

รัน `champollion <command> --help` เพื่อดูคำแนะนำช่วยเหลือโดยละเอียดของคำสั่งใดๆ
(`champollion network` จะแสดงรายการคำสั่งเครือข่าย)

## ตัวเลือกส่วนกลาง

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0 — deterministic; the one default for translating and evaluating)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### การระบุคู่ภาษา

คู่ภาษาของโปรเจกต์จะเขียนในรูปแบบที่ `champollion.config.json` ใช้เป็นคีย์: `en:fr` ทั้งนี้ `sync`, `verify` และ `serve` รองรับการอ่าน `en>fr` และ `en-fr` ด้วยเช่นกัน และ `en-pt-BR` จะถูกจับคู่กับคู่ภาษาที่คุณกำหนดค่าไว้ สำหรับคำสั่งเครือข่าย (`network register-corpus`, `leaderboard`, `recommend`, `submit`) จะเขียนคู่ภาษาในรูปแบบ `eng>crk` ซึ่งเป็นรูปแบบที่ลีดเดอร์บอร์ดจัดเก็บและ `mt-eval` ใช้งาน รวมถึงอ่าน `eng-crk` และ `eng:crk` ในลักษณะเดียวกัน หากใช้ยัติภังค์ (hyphen) เพียงอย่างเดียว คู่ภาษาจะประกอบด้วยรหัสสองหรือสามตัวอักษรสองชุด (`eng-crk`) ส่วนรหัสที่มีขีดคั่นในตัวเองจำเป็นต้องใช้ `>`: `--pair "eng>pt-BR"` โดย `eng-pt-BR` จะถูกปฏิเสธและไม่มีการเดาค่าเด็ดขาด โปรดใส่เครื่องหมายคำพูด (quote) ครอบรูปแบบ `>` ในเชลล์เสมอ เพราะหากไม่ใส่เครื่องหมายคำพูด `--pair eng>crk` จะส่งเอาต์พุตไปยังไฟล์ชื่อ `crk`

---

## new

เริ่มต้นโปรเจกต์การแปลภาษาด้วยเครื่องบนราง: หนึ่งโฟลเดอร์ที่มีที่ทางสำหรับทุกสิ่ง

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry   # say the direction back; writes nothing
champollion new family --from English --to qaa --target-name "Our language"
champollion new school-crk --from eng --to "Plains Cree" --purpose "school newsletter"
```

คำสั่งนี้จะเขียน:

- `champollion.project.json` — การตัดสินใจของโปรเจกต์ ([project/1](/docs/reference/formats#project1)): คู่ภาษา จุดประสงค์ และค่าเริ่มต้นที่ข้อมูลใหม่จะได้รับ (`local-only`; คะแนนการเทรนและการแบ่งปัน: `ask`)
- โฟลเดอร์ `data/parallel/`, `data/test/`, `data/lexicon/`, `data/grammar/`, `data/monolingual/`, `consent/` และ `inbox/`
- `README.md` (อะไรอยู่ที่ไหน), `.gitignore` (ป้องกันไม่ให้ `data/` หลุดไปยังที่เก็บโค้ดใด ๆ ที่คุณพุช), `NEXT.md` (ขั้นตอนถัดไป) และ `AGENTS.md` — กฎเกณฑ์ที่ตัวแทน AI ซึ่งทำงานในโฟลเดอร์ต้องปฏิบัติตาม หรือ[สัญญาการปฏิบัติการ](/docs/agents/contract) ทั้งนี้จะไม่เขียนทับ `.gitignore` หรือ `AGENTS.md` ที่มีอยู่เดิมเด็ดขาด

ภาษาระบุได้ด้วยรหัสหรือชื่อ ซึ่งจำแนกหาผ่านการ์ดภาษา หากการ์ดบันทึกชื่อภาษาหนึ่งไว้ใต้ชื่ออื่น ระบบจะแจ้งชื่อนั้นกลับคืนพร้อมระบุแหล่งที่มา (`"Blackfoot" is another name for this language … Siksika (bla)`); หากชื่อใดมีหลายภาษาใช้ร่วมกัน ระบบจะปฏิเสธพร้อมแสดงตัวเลือกให้ โดยจะไม่สุ่มเลือกเอง ส่วนรหัสใช้งานส่วนตัว (`qaa`–`qtz`) สำหรับภาษาย่อยที่ไม่มีรหัส จำเป็นต้องระบุชื่อที่ผู้คนของภาษานั้นใช้เรียก (`--target-name`, `--source-name`) จนถึงตอนนี้มีเพียงโปรเจกต์ `language` เท่านั้นที่อยู่บนราง และโฟลเดอร์ที่เป็นโปรเจกต์อยู่แล้ว หรือมีไฟล์อยู่ข้างในแล้ว จะถูกปฏิเสธ

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--from <language>` | ภาษาต้นทาง (รหัสหรือชื่อ) |
| `--to <language>` | ภาษาเป้าหมาย (รหัสหรือชื่อ) |
| `--name <text>` | ชื่อโปรเจกต์ (ค่าเริ่มต้น: `<source> → <target>`) |
| `--purpose <text>` | การแปลนี้มีไว้เพื่ออะไร ตามคำอธิบายของคุณ |
| `--target-name <text>` | ชื่อภาษาเป้าหมายตามที่ผู้คนของภาษานั้นเรียก (จำเป็นสำหรับ `qaa`–`qtz`) |
| `--source-name <text>` | ชื่อภาษาต้นทาง (สำหรับต้นทางที่ใช้รหัสใช้งานส่วนตัว) |
| `--dry` | บอกทิศทางที่จะทำการแปล (`… goes in, … comes out`) และไม่เขียนสิ่งใดลงไป |
| `--json` | ไฟล์โปรเจกต์ ภาษาหลังการจำแนก และขั้นตอนแรก ในรูปแบบ JSON |

---

## next

คำถามเดียวของราง: ตอนนี้เราต้องทำอะไรต่อ?

```bash
champollion next                  # in the project folder
champollion next family --json    # for an agent
champollion next --write          # also rewrite NEXT.md
```

คำสั่งนี้จะอ่านไฟล์ของโปรเจกต์ (ไม่อ่านข้อความในไฟล์ข้อมูลเด็ดขาด) ไล่เรียงเส้นทางของโปรเจกต์ และพิมพ์ขั้นตอนถัดไปเพียงหนึ่งขั้นตอน: สิ่งที่ต้องแจ้งแก่บุคคลนั้น เหตุผล คำสั่งที่แน่ชัดหากมี และวิธีการที่ต้องดำเนินการในขั้นตอนนี้:

| โหมด | วิธีการ |
|------|-----|
| `auto` | ตัวแทนสามารถรันคำสั่งได้ |
| `confirm` | รันคำสั่งหลังจากบุคคลนั้นตอบตกลงเท่านั้น (การติดตั้ง ค่าใช้จ่าย การเทรน) |
| `ask_user` | ผู้ถือครองข้อมูลเป็นผู้ตอบ อย่าตอบแทนพวกเขาเด็ดขาด |
| `wait` | มีบางอย่างกำลังทำงานอยู่ โปรดถามใหม่อีกครั้งในภายหลัง |
| `human_only` | มีเพียงมนุษย์เท่านั้นที่ทำสิ่งนี้ได้ (รวบรวมประโยค เลือกโมเดล) |

สำหรับขั้นตอนการเทรน คำสั่งนี้จะส่งต่อคำแนะนำจากที่ปรึกษาของ nmt-forge เอง (`nmt-forge status` ซึ่งจำกัดเวลาไว้ที่ 60 วินาที) คำสั่งนี้ทำงานแบบอ่านอย่างเดียว: ไม่เขียนสิ่งใดลงไปเว้นแต่จะระบุ `--write` (ซึ่งจะเขียน `NEXT.md` ใหม่)

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--json` | ขั้นตอนในรูปแบบ JSON (สำหรับตัวแทน) |
| `--write` | เขียน `NEXT.md` ใหม่ด้วย |

---

## data

นำไฟล์ที่ชุมชนเก็บรักษาไว้เข้ามาสู่โปรเจกต์ บันทึกสิ่งที่ผู้ถือครองตัดสินใจ และรวมไฟล์คู่ภาษาเข้าเป็นไฟล์เดียวที่กระบวนการเทรนจะใช้อ่าน ให้รันคำสั่งนี้ภายในโปรเจกต์

### data add

```bash
champollion data add inbox/grandpa.xlsx
champollion data add inbox/list.txt --source-col A --target-col B
champollion data add inbox/checked.docx --into test
```

แปลงไฟล์ที่ชุมชนเก็บรักษาไว้ให้อยู่ในรูปแบบที่เครื่องมือทุกตัวอ่านได้: สเปรดชีต (`.xlsx`, `.ods`, `.csv`), `.tsv` หรือ `.txt`, ตารางใน Word `.docx` หรือพจนานุกรม Toolbox/MDF หรือ LIFT (FieldWorks/FLEx) — คำแปลอธิบาย (glosses) จะกลายเป็นรายการคำศัพท์เมื่อใช้ `--into lexicon` และประโยคตัวอย่างจะกลายเป็นคู่ภาษา สำหรับไฟล์ ELAN (`.eaf`) จะให้คู่ภาษาจากสอง tier ที่ ELAN เชื่อมโยงกัน โดยจับคู่ตามชื่อภาษาที่ระบุหรือตาม tier id `--source-col`/`--target-col` ส่วนคัมภีร์ USFM จะนำเข้าตามการร้องขอเท่านั้น: `--usfm-source` ระบุข้อความของอีกภาษาหนึ่ง และข้อที่มีหมายเลขตรงกันทั้งสองภาษาจะกลายเป็นคู่ภาษา เนื่องจากคำแปลคัมภีร์มักอยู่ภายใต้ลิขสิทธิ์ของสำนักพิมพ์ จึงไม่มีโมเดลใดจะเรียนรู้จากข้อมูลนี้จนกว่าผู้ถือครองจะอนุญาต

คอลัมน์จะดึงมาจากแถวส่วนหัวที่ระบุชื่อภาษา หรือจาก `--source-col` และ `--target-col` คำสั่งจะไม่คาดเดาจากประโยคและไม่พิมพ์ประโยคออกมาเด็ดขาด: คอลัมน์จะถูกอธิบายด้วยอัตราการเติมข้อมูล (fill) และระบบการเขียน (script) คำสั่งจะเขียน `data/parallel/<name>.tsv` (หรือ `data/test/` หรือรายการคำศัพท์ใน `data/lexicon/`) พร้อมไฟล์ประกบ (sidecar) ที่บันทึกแหล่งที่มา โดยจะใช้ค่าเริ่มต้นเฉพาะในเครื่องเท่านั้น (local-only) ของโปรเจกต์จนกว่าผู้ถือครองข้อมูลจะตัดสินใจ ทั้งนี้ไฟล์ต้นฉบับจะไม่ถูกเปลี่ยนแปลงเด็ดขาด

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--into <parallel\|test\|lexicon>` | ตำแหน่งปลายทางของคู่ภาษา (ค่าเริ่มต้น `parallel`; `lexicon` = รายการคำศัพท์) |
| `--source-col <col>` | คอลัมน์ต้นทาง: ตัวอักษร ตัวเลข หรือชื่อส่วนหัว (tier id ของ ELAN สำหรับ `.eaf`; รหัสภาษาสำหรับ LIFT) |
| `--target-col <col>` | คอลัมน์เป้าหมาย |
| `--sheet <name\|n>` | แผ่นงานหรือตารางใด เมื่อมีหลายรายการ |
| `--header` / `--no-header` | แถวแรกเป็นส่วนหัวหรือไม่ |
| `--usfm-source <file\|folder>` | คัมภีร์ USFM: ข้อความของอีกภาษาหนึ่ง จับคู่แบบข้อต่อข้อ |
| `--name <stem>` | ชื่อของไฟล์ที่เขียนขึ้น |

### data mark

```bash
champollion data mark data/parallel/pairs.tsv --owner "the family" --training allowed --local-only
champollion data mark data/test/checked.tsv --role test --local-only
```

บันทึกสิ่งที่ผู้ถือครองไฟล์ข้อมูลตัดสินใจ ไว้ในไฟล์ประกบเคียงข้างกัน (`<file>.champollion.json`, [set/1](/docs/reference/formats#set1)) ซึ่ง mt-eval, nmt-forge และเซิร์ฟเวอร์ MCP จะปฏิบัติตาม ไฟล์ที่ไม่ได้ตั้งเป็น local-only อยู่แล้วจำเป็นต้องระบุ `--local-only` หรือ `--may-leave`: ข้อความจะสามารถส่งไปยังบริการ AI ภายนอกได้หรือไม่นั้นเป็นการตัดสินใจของผู้ถือครอง จึงไม่มีการทึกทักเอาเองเด็ดขาด

ไฟล์ประกบมีแต่จะเข้มงวดขึ้นเท่านั้น: local-only ไม่สามารถเปลี่ยนเป็น may-leave ได้, การเทรน `not-allowed` ไม่สามารถเปลี่ยนเป็น `allowed` ได้ และชุดทดสอบหรือชุดข้อมูลที่ปิดผนึก (sealed set) จะคงบทบาทเดิมไว้และไม่มีการนำไปเทรนเด็ดขาด ข้อยกเว้นมีเพียงคำตอบแรกของผู้ถือครองต่อความระมัดระวังของตัวเครื่องมือเอง: เครื่องหมาย local-only ที่ `data add` กำหนดจากค่าเริ่มต้นของโปรเจกต์ (การระบุ `--may-leave` ครั้งแรกจะปลดล็อก), `not-allowed` ที่กำหนดไว้กับคัมภีร์ และ `--speakers-agreed yes --training allowed` เมื่อผู้ที่เคย `not-yet` ได้ให้ความยินยอม การผ่อนปรนอื่น ๆ นอกเหนือจากนี้จะต้องเป็นการแก้ไขด้วยตนเองโดยผู้ถือครองข้อมูลเท่านั้น

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--local-only` | ให้เฉพาะโมเดลบนคอมพิวเตอร์เครื่องนี้เท่านั้นที่สามารถเห็นข้อความได้ |
| `--may-leave` | ผู้ถือครองอนุญาตให้ส่งข้อความไปยังบริการภายนอกได้ |
| `--training <allowed\|not-allowed>` | โมเดลสามารถเรียนรู้จากข้อมูลนี้ได้หรือไม่ |
| `--role <role>` | `train`, `dev`, `test`, `sealed`, `input` หรือ `resource` |
| `--kind <kind>` | `parallel`, `monolingual`, `lexicon`, `grammar` หรือ `glossary` |
| `--owner <text>` | ใครเป็นผู้ถือครองข้อมูล ตามคำอธิบายของพวกเขา |
| `--speakers <text>` | ไฟล์นี้เก็บคำพูดของใคร — ใครเป็นผู้พูดหรือเขียนไว้ |
| `--speakers-agreed <yes\|not-yet\|some-said-no>` | พวกเขาให้ความยินยอมหรือไม่ โดย `not-yet` และ `some-said-no` จะกันข้อมูลนี้ออกจากการเทรน |
| `--consent-record <path>` | บันทึกข้อความระบุว่าใครยินยอมในเรื่องใด |
| `--json` | พิมพ์ไฟล์ประกบที่เขียนขึ้นในรูปแบบ JSON |

### data combine

```bash
champollion data combine
champollion data combine --name all-pairs
```

รวมไฟล์คู่ภาษาทุกไฟล์ใน `data/parallel/` เข้าเป็นไฟล์เดียวที่กระบวนการเทรนจะใช้อ่าน โดยตัดข้อความที่ซ้ำกันทุกตัวอักษรออก ไฟล์ประกบจะยึดเงื่อนไขที่เข้มงวดที่สุดในบรรดาไฟล์เหล่านั้น (เป็น local-only ทันทีหากมีไฟล์ใดไฟล์หนึ่งกำหนดไว้ และระบุชื่อผู้ถือครองทุกคน) ไฟล์ต้นฉบับจะถูกย้ายไปยัง `data/combined-from/` โดยไม่มีสิ่งใดถูกลบ ไฟล์ที่ผู้ถือครองระบุว่าห้ามโมเดลใดเรียนรู้จะไม่ถูกนำมารวม: ไฟล์นั้นจะถูกย้ายไปยัง `data/not-for-training/` ซึ่งจะเก็บรักษาไว้และไม่มีการนำไปเรียนรู้เด็ดขาด ทั้งนี้ `--name <stem>` จะระบุชื่อไฟล์ที่รวมแล้ว

---

## improve

ปรับปรุงโมเดลที่ใช้งานอยู่ให้ดียิ่งขึ้นทีละรอบ โดยแต่ละรอบจะตัดสินจากชุดฝึกฝน (dev) ให้รันคำสั่งนี้ภายในโปรเจกต์ ซึ่ง `champollion next` จะบอกว่าขั้นตอนใดต้องทำต่อไป

```bash
champollion improve time --per-week "two evenings" --total "until the spring"
champollion improve wishlist --prompts 30
champollion improve sheet
champollion improve marks
champollion improve prepare
champollion improve report
champollion improve status --json
```

หนึ่งรอบ: ผู้คนจะเขียนประโยคที่ต้องการแปล บรรทัดละหนึ่งประโยค ใน `improve/round-<k>/to-translate.txt`; โมเดลที่ใช้งานอยู่จะร่างคำแปลลงบนแผ่นงาน; ผู้พูดภาษานั้นจะทำเครื่องหมายในแต่ละคำแปลร่างเป็น Y (ถูกต้อง), N (ไม่ถูกต้อง — และเขียนระบุว่าที่ถูกต้องพูดอย่างไร) หรือ ? (ไม่แน่ใจ); คำแปลร่างที่ยืนยันแล้วและข้อความที่แก้ไขจะกลายเป็นคู่ภาษาสำหรับเทรนชุดใหม่; ไฟล์สำหรับเทรนจะถูกคัดกรองและนำโมเดลไปเทรนใหม่อีกครั้ง จากนั้น forge จะเปรียบเทียบโมเดลใหม่กับโมเดลที่ใช้งานอยู่โดยใช้ประโยค dev ชุดเดียวกัน และจะนำไปใช้งานจริงก็ต่อเมื่อโมเดลใหม่ดีขึ้นอย่างวัดผลได้เท่านั้น แต่ละรอบจะมีหมายเลขตามผลการตัดสินของ forge ที่ผ่านมา และไฟล์ของรอบนั้นจะอยู่ใน `improve/round-<k>/` บนหน้าจอจะแสดงเพียงจำนวนนับและข้อความธรรมดา จะไม่มีประโยคปรากฏขึ้นเด็ดขาด — เพราะแผ่นงานจะเก็บประโยคเหล่านั้นไว้ในโฟลเดอร์โปรเจกต์

| คำสั่งย่อย | การทำงาน |
|------------|--------------|
| `time` | บันทึกเวลาที่ผู้พูดภาษาสามารถสละให้ได้ ต่อสัปดาห์และโดยรวม ตามที่ผู้พูดกล่าวไว้ทุกประการ (`improve/time.json`); แต่ละรอบจะวางแผนตามเวลานี้ |
| `wishlist` | แผ่นงานสั่งพิมพ์ได้สำหรับสิ่งที่ต้องเขียนต่อไป (`improve/round-<k>/wishlist.md`): คำที่โมเดลไม่เคยพบ ชนิดของประโยคที่โมเดลแปลผิดในชุด dev ข้อความกระตุ้นแบบเปิด (`nmt-forge wishlist`) |
| `sheet` | โมเดลที่ให้บริการบนคอมพิวเตอร์เครื่องนี้จะร่างประโยคของรอบนั้นลงใน `review.csv` เพื่อให้ผู้พูดทำเครื่องหมาย; ในช่วงที่ชุดฝึกฝน (dev) ยังมีขนาดเล็ก หนึ่งในสี่แถวจะไม่มีคำแปลร่าง — โดยผู้พูดจะเป็นผู้เขียนขึ้นมา และทำให้ชุดฝึกฝนขยายใหญ่ขึ้น |
| `marks` | อ่านเครื่องหมายที่ผู้พูดระบุ: จำนวนคำแปลร่างที่ถูกต้อง (พร้อมช่วงความเชื่อมั่น 95%), คำแปลร่างที่ยืนยันแล้วและข้อความที่แก้ไขซึ่งกลายเป็นคู่ภาษาสำหรับเทรนชุดใหม่ (เพิ่มเข้ามาเหมือนที่ `data add` เพิ่มไฟล์), แถวฝึกฝนในฐานะ `data/dev/` |
| `prepare` | ไฟล์สำหรับเทรนของรอบนี้ (`data/split/train-r<k>.jsonl`) ผ่านการคัดกรองเทียบกับชุดทดสอบโดยแยกประโยค dev ไว้ต่างหาก; ชุดฝึกฝนขยายใหญ่ขึ้น (`nmt-forge grow-dev`); `config.json` ถูกชี้ไปยังไฟล์นี้ |
| `report` | รายงานของรอบนี้ (`improve/round-<k>/report.json`): ความคืบหน้า โดยตัวเลขแต่ละตัวมีหน่วยกำกับ; การตรวจสอบว่าการพัฒนาขึ้นนั้นเกิดขึ้นจริง; การคาดการณ์ล่วงหน้า; สิ่งที่ต้องทำต่อไป |
| `status` | รอบการทำงานที่ผ่านมาทั้งหมด: เครื่องหมายของผู้พูดและผลการตัดสินของ forge ในแต่ละรอบ |

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--per-week <text>` | `time`: เวลาที่ผู้พูดภาษาสละให้ได้ต่อสัปดาห์ ตามคำพูดของพวกเขา (จำเป็น) |
| `--total <text>` | `time`: เวลาที่ผู้พูดภาษาสละให้ได้โดยรวม ตามคำพูดของพวกเขา (จำเป็น) |
| `--prompts <n>` | `wishlist`: จำนวนข้อความกระตุ้นในแผ่นงาน (ค่าเริ่มต้น 40 ประมาณหนึ่งครั้งที่นั่งทำ) |
| `--json` | `report`, `status`: พิมพ์เป็น JSON |

---

## validate

```bash
champollion validate                  # the current folder
champollion validate family --json    # one project, machine-readable
```

ตรวจสอบไฟล์ของโปรเจกต์เทียบกับสคีมาของเฟรมเวิร์ก ([Formats](/docs/reference/formats)) ซึ่ง mt-eval และ nmt-forge ใช้อ่านด้วยเช่นกัน: `champollion.project.json`, ไฟล์ประกบของข้อมูลทุกไฟล์ (`<file>.champollion.json`) ภายใต้โฟลเดอร์, `method.json` ทุกไฟล์ (ที่รูท ใน `methods/*/` และใน `.champollion/methods/*/`), สายลำดับเกต (`gates/*.json`) และการนำไปปรับใช้ (`deploy/*.json`) คำสั่งจะเปิดเฉพาะไฟล์ JSON ขนาดเล็กเหล่านั้นเท่านั้น ไม่อ่านไฟล์ข้อมูลเด็ดขาด ไฟล์ประกบที่เขียนขึ้นก่อน set/1 จะยังคงถูกต้อง ส่วนคีย์ที่ set/1 ปฏิเสธจะได้รับการรายงานเป็นคำเตือน

รหัสการออก (Exit codes): 0 ถูกต้อง (อนุญาตให้มีคำเตือนได้), 1 มีเอกสารไม่ถูกต้อง, 2 ข้อผิดพลาดในการใช้งาน ทั้งนี้ `--json` จะพิมพ์รายงานฉบับเต็ม

---

## upgrade

```bash
champollion upgrade --dry         # say what would change; write nothing
champollion upgrade family
```

เขียนไฟล์เฟรมเวิร์กเดิมของโปรเจกต์ใหม่ให้อยู่ในรูปแบบที่เครื่องมือทุกตัวใช้ร่วมกันในปัจจุบัน โดยไม่มีข้อมูลใดสูญหาย ไฟล์ประกบของข้อมูลที่เขียนขึ้นก่อน set/1 จะเปลี่ยนเป็น set/1: ค่าทุกค่ายังคงอยู่ คีย์ที่ set/1 ไม่รู้จักจะถูกย้ายไปไว้ใต้ `x-<key>` สำหรับไฟล์ประกบที่ไม่ถูกต้องจะคงไว้ให้มนุษย์เข้ามาแก้ไข (`champollion validate` จะบอกสิ่งที่ผิดพลาด) ส่วน `method.json` ที่เขียนขึ้นก่อน method/1 จะถูกแสดงในรายการและเก็บไว้ดังเดิม — รูปแบบเดิมยังคงมีการตั้งค่าที่เครื่องมือต่าง ๆ ต้องอ่านใช้งาน ไม่มีสิ่งใดถูกลบ และ `--json` จะพิมพ์รายงานออกมา

---

## connect

```bash
champollion connect ../family/export/model --app .
champollion connect ../family/export --app ../school-site --holders-agreed-by "Grandpa"
```

นำโมเดลที่ให้บริการอยู่เข้าไปไว้ในโปรเจกต์แอปหรือเว็บไซต์ เพื่อให้ `sync` สามารถแปลด้วยโมเดลนั้นได้ โมเดลดังกล่าวอาจเป็นโมเดลที่ส่งออกจาก forge (โฟลเดอร์ของโมเดลหรือโฟลเดอร์ `model/`) หรือ `method.json` ใด ๆ โมเดลจะถูกติดตั้งลงใน `.champollion/methods/` ของแอป และคู่ภาษาของแอปจะชี้ไปยังโมเดลนั้น (`"methodPlugin"`); โดยระบบจะคงระบบสำรอง (fallback) หรือระดับภาษา (register) ที่คู่ภาษานั้นมีอยู่แล้วไว้

โมเดลที่เรียนรู้จากประโยคที่ทำเครื่องหมายว่าเป็น local-only (หรือไม่มีการบันทึกประวัติการเทรน) หรือบริการที่ `/health` ระบุว่าผลลัพธ์เป็น local-only อาจนำประโยคเหล่านั้นมาพูดซ้ำได้ — และไฟล์ภาษาเฉพาะถิ่น (locale) ของแอปจะได้รับการเผยแพร่ไปพร้อมกับแอป ดังนั้นการเชื่อมต่อจะทำได้เมื่อระบุ `--holders-agreed-by` เท่านั้น: ซึ่งต้องระบุว่ามีผู้ถือครองข้อมูลคนใดบ้างที่ยินยอม โดยบันทึกไว้ในคู่ภาษา (`"holdersAgreed"` พร้อมระบุชื่อ method) โปรดถามพวกเขา อย่าตอบแทนพวกเขาเด็ดขาด ส่วน `sync` ยึดคำตอบ local-only ตามกฎเดียวกัน: หากปราศจากความยินยอม จะไม่มีสิ่งใดจากโมเดลนั้นถูกเขียนลงไป

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--app <folder>` | โปรเจกต์แอปหรือเว็บไซต์ (ค่าเริ่มต้น: โฟลเดอร์นี้) |
| `--holders-agreed-by <who>` | สำหรับโมเดลที่เป็น local-only: มีผู้ถือครองข้อมูลคนใดบ้างที่ยินยอม |
| `--json` | พิมพ์สิ่งที่เชื่อมต่อแล้วเป็น JSON |

---

## init

วิซาร์ดตั้งค่าแบบโต้ตอบที่สร้าง `champollion.config.json` นำทางผ่านการตั้งค่า source locale, ภาษาเป้าหมาย, รูปแบบไฟล์ และโมเดลการแปล

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**ตัวเลือก `--content-dir`**: โฟลเดอร์ของไฟล์ Markdown/MDX ที่จะแปลควบคู่ไปกับไฟล์โลแคลของคุณ (เขียนเป็น `contentDir`) โฟลเดอร์ดังกล่าวต้องมีอยู่จริง มิฉะนั้น `init` จะหยุดทำงานโดยไม่เขียนข้อมูลใดๆ

**โปรเจกต์ที่มีไฟล์ local-only จะมีค่าเริ่มต้นเป็น `local`**: เมธอดเริ่มต้นคือ `llm` (OpenRouter ซึ่งเป็นบริการแบบโฮสต์) เมื่อมีไฟล์ใดก็ตามในโปรเจกต์ถูกทำเครื่องหมายว่า local-only — มี `<file>.champollion.json` กำกับอยู่ข้างๆ พร้อม `"transmission": "local-only"` ตามที่ `champollion network register-corpus --data <file> --tier local-only` เขียน — `init` (รวมถึง `--yes` ด้วย) จะเปลี่ยนค่าเริ่มต้นไปเป็นเมธอด `local` แทน: ซึ่งเป็นโมเดลที่ให้บริการบนเครื่องนี้ (ค่าเริ่มต้นของ Ollama `http://localhost:11434/v1` หรือเซิร์ฟเวอร์ตามที่ `LOCAL_API_BASE` ระบุ) ระบบจะแจ้งเหตุผลพร้อมระบุชื่อไฟล์ที่ถูกทำเครื่องหมายไว้ และบอกวิธีเลือกใช้เมธอดแบบโฮสต์อย่างเจาะจง: `champollion init --force --method llm --model <model>` ทั้งนี้ การระบุ `--method` อย่างชัดเจนจะมีความสำคัญสูงสุดเสมอ จากนั้น `init` จะระบุไฟล์ที่ถูกทำเครื่องหมายไว้ข้างๆ ปลายทางที่ข้อความถูกส่งไป

**การรัน `init` ซ้ำ (`--force`)**: หากไม่มี `--force` ตัว `init` จะหยุดทำงานเมื่อมี `champollion.config.json` อยู่แล้ว แต่หากระบุแฟล็กนี้ `init` จะเริ่มต้นจากไฟล์ดังกล่าวและเขียนทับเฉพาะสิ่งที่แฟล็กระบุเท่านั้น: `--langs` กำหนดรายการภาษาเป้าหมาย (ภาษาที่มีอยู่แล้วจะคงรายการเดิมไว้ — ระดับภาษา, สคริปต์, ชื่อ), `--method` กำหนดเมธอดเริ่มต้น (และโมเดลควบคู่กัน เว้นแต่ `--model` จะระบุชื่อไว้), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name` และ `--method api` กำหนดคู่ภาษาตามที่ระบุ ระบบจะตรวจหาโครงสร้างไฟล์โลแคล (locale layout) ใหม่อีกครั้งเมื่อไฟล์ไม่พบไฟล์ต้นฉบับของคุณแล้วเท่านั้น (หรือเมื่อ `--dir` ระบุโฟลเดอร์อื่น) การตั้งค่าอื่นๆ ทั้งหมด — `batchSize`, `pairs`, `glossary`, แผนสำรอง (fallbacks), ระดับภาษาที่คุณเลือกไว้ — จะคงอยู่เหมือนเดิม ระบบจะพิมพ์แต่ละฟิลด์ที่มีการเปลี่ยนแปลงและฟิลด์ที่คงไว้ พร้อมทั้งคัดลอกไฟล์เดิมไปยัง `champollion.config.json.bak` ก่อน (หากไฟล์สำรองนั้นมีไฟล์เก่าอยู่แล้ว ไฟล์ถัดไปจะเป็น `.bak.2`, `.bak.3` … โดยจะไม่มีการเขียนทับไฟล์สำรองเดิมเด็ดขาด) ไฟล์ที่ไม่ใช่ JSON ที่ถูกต้องจะไม่สามารถเก็บไว้ได้ โดยระบบจะสำรองไฟล์นั้นไว้แล้วเขียนไฟล์ใหม่ขึ้นมา หากต้องการเปลี่ยนการตั้งค่าเพียงอย่างเดียว ให้แก้ไขในไฟล์โดยตรง — คุณไม่จำเป็นต้องรัน `init` ซ้ำเพื่อการนั้น

**การค้นหาไฟล์โลแคลของคุณ**: `init` จะค้นหาไฟล์ของภาษาต้นทางก่อนที่จะเขียนสิ่งใด โดยจะตรวจสอบโฟลเดอร์ทั่วไปของเฟรมเวิร์กของคุณก่อน (next-intl `messages/`, i18next `public/locales/<lang>/` แล้วตามด้วย `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`) จากนั้นจึงตรวจสอบ `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` และ `src/i18n` พร้อมทั้งพิมพ์สิ่งที่พบ โดยจะไม่เขียน `localesDir` ที่ไม่มีอยู่จริงเด็ดขาด ดูที่ [โครงสร้างไฟล์โลแคล](/docs/getting-started/configuration#locale-layouts)

**ตัวเลือก `--langs`**: รายการรหัสภาษาเป้าหมายที่คั่นด้วยเครื่องหมายจุลภาค ข้ามข้อความแจ้งเตือนเลือกภาษาและนำพรีเซ็ตระดับภาษา (register preset) เริ่มต้นของแต่ละภาษาไปใช้ — ซึ่งจะเขียนลงในการกำหนดค่า เพื่อให้เห็นและแก้ไขตัวเลือกดังกล่าวได้: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (สามารถเปลี่ยนเป็นพรีเซ็ตอื่น หรือใช้คำอธิบายน้ำเสียงภาษาของคุณเอง; ภาษาที่ไม่มีพรีเซ็ตจะถูกเขียนเป็น `{}`) ตัวเลือกนี้ยังสร้างไฟล์เป้าหมายเปล่าในโครงสร้างไฟล์ของคุณด้วย (`fr.json` หรือ `fr/common.json` สำหรับแต่ละเนมสเปซ) ใช้งานร่วมกับ `--yes` เพื่อการตั้งค่าแบบอัตโนมัติเต็มรูปแบบโดยไม่ต้องมีการโต้ตอบ

**`--method api --endpoint <url>`**: เซิร์ฟเวอร์ที่สื่อสารตามสัญญา API ของ champollion — เช่น โมเดลที่คุณเทรนเอง ซึ่งให้บริการผ่าน `nmt-forge serve` ทั้งนี้ `init` จะเขียนหนึ่งคู่ภาษาต่อหนึ่งเป้าหมาย ซึ่งเป็นรายการเดียวกับ `DEPLOY.md` ข้างโมเดล: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }` ส่วน `--accepts-instructions true|false` จะระบุว่าเอนด์พอยต์ปฏิบัติตามคำสั่งแบบแยกตามคีย์ (per-key instructions) หรือไม่ (โมเดลที่เทรนด้วย nmt-forge จะไม่รองรับ); หากไม่มีการระบุ `init` จะดึงค่าจาก manifest ของปลั๊กอินที่ติดตั้งไว้สำหรับเอนด์พอยต์เดียวกัน (`.champollion/methods/<name>/method.json`) หรือปล่อยเว้นว่างไว้ ตัวเลือกนี้จำเป็นต้องใช้ `--langs` (เอนด์พอยต์จะถูกกำหนดต่อคู่ภาษา) และต้องใช้คีย์เฉพาะสำหรับเอนด์พอยต์ที่ไม่ได้อยู่บนเครื่องนี้เท่านั้น (`CHAMPOLLION_API_KEY`) คุณสามารถเพิ่มเมธอด `fallback` ให้กับคู่ภาษาได้ด้วยตนเองตามที่ `DEPLOY.md` แสดงไว้

**ตัวเลือก `--script`**: บางภาษามีระบบการเขียน (อักขรวิธี) ในการใช้งานจริงมากกว่าหนึ่งระบบ — เช่น ภาษาครีทุ่งราบ (Plains Cree) (`crk`: `Latn` = Standard Roman Orthography, `Cans` = Syllabics), ภาษาเซอร์เบีย (`sr`: `Latn`, `Cyrl`) Champollion จะไม่ตัดสินใจเลือกระบบใดระบบหนึ่งแทนชุมชนผู้ใช้ภาษา: `sync` จะปฏิเสธการแปลภาษาดังกล่าวจนกว่าการกำหนดค่าจะระบุระบบการเขียนไว้ วิซาร์ดจะถามคำถามนี้; เมื่อใช้ `--yes` ให้ส่ง `--script crk=Cans` (หากมีหลายภาษา: `--script crk=Cans,sr=Latn`; หากมีภาษาเป้าหมายเดียว `--script Cans` ก็เพียงพอ) ซึ่งจะเขียน `"languages": { "crk": { "script": "Cans" } }` หากไม่มีตัวเลือกนี้ `init --yes` จะแจ้งว่าภาษาใดจำเป็นต้องเลือก พร้อมแสดงตัวเลือกที่มี และพิมพ์บรรทัด `"script"` เพื่อนำไปเพิ่มในรายการของภาษานั้นในการกำหนดค่า

**ตัวเลือก `--name`**: รหัสการใช้งานส่วนตัว (`qaa`–`qtz` สำหรับภาษาหรือความหลากหลายของภาษาที่ไม่มีรหัสมาตรฐานที่ได้รับการยืนยัน) จะไม่มีการ์ดภาษา ดังนั้น `init` จะแจ้งให้ทราบแทนที่จะขอให้คุณตรวจสอบตัวสะกด โดย `--name qaa="Ayta (variety not yet confirmed)"` จะกำหนดชื่อแสดงผลที่พรอมต์และรายงานจะนำไปใช้ ซึ่งเขียนเป็น `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (หากมีหลายรายการ: `--name "qaa=…;qab=…"`) นอกจากนี้ ถัดจากแต่ละระดับภาษา `init` ยังพิมพ์คำแนะนำเรื่องเพศภาวะ (gender guidance) ที่พรอมต์ของ LLM ส่งไปสำหรับภาษานั้นด้วย ([คำแนะนำเรื่องเพศภาวะ](/docs/getting-started/configuration#gender-guidance))

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
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: ตามค่าเริ่มต้น `sync` จะโหลด `.champollion/tm.json` และส่งคืนคำแปลที่แคชไว้สำหรับค่าต้นทางที่ไม่มีการเปลี่ยนแปลง การสลับโมเดลจะไม่ลบข้อมูลดังกล่าวทิ้ง: ข้อความที่แปลไปแล้วภายใต้โมเดลก่อนหน้าจะถูกนำมาใช้ซ้ำโดยไม่มีค่าใช้จ่าย และ sync จะแจ้งให้ทราบก่อนการประเมินค่าใช้จ่าย หากต้องการให้โมเดลใหม่แปลข้อความเหล่านั้นแทน: ให้ใช้ `--redo all --fresh-on-model-change` — คำสั่งนี้จะส่งคีย์ที่โมเดลก่อนหน้าเคยแปลไป และส่วนที่โมเดลใหม่แปลไว้แล้วจะยังคงดึงมาจากแคช (โดยลำพังแล้ว `--fresh-on-model-change` จะส่งผลต่อคีย์ที่การรันรอบนั้นต้องแปลอยู่แล้วเท่านั้น) ใช้ `--no-tm` เพื่อข้ามการใช้แคชทั้งหมด (มีประโยชน์เมื่อแก้ไขปัญหาด้านคุณภาพ) ดูที่ [Translation Memory](/docs/concepts/translation-memory)

**การประเมินค่าใช้จ่ายและ `--max-cost`**: การประเมินราคาจะคิดเฉพาะสิ่งที่จะถูกเรียกเก็บเงินในการรันรอบนั้นเท่านั้น คีย์, ฟิลด์ front-matter และบล็อก Markdown ที่มีอยู่แล้วใน Translation Memory จะคิดราคาที่ $0 และตารางจะแสดงจำนวนเงินที่แคชช่วยประหยัดได้ โมเดลที่ให้บริการบนเครื่องนี้ (`local` หรือเอนด์พอยต์ `api` ที่ `localhost`/`127.0.0.1`/`::1`) จะแสดงเป็น `$0 (local)` — ไม่มีการคิดค่าบริการ API โดยไม่นับรวมฮาร์ดแวร์และพลังงานไฟฟ้าของคุณ `--max-cost` จะเปรียบเทียบกับตัวเลขดังกล่าว หากเกินขีดจำกัด (cap) หรือไม่มีการประเมินราคา (เมธอดที่ไม่มีการเผยแพร่ราคา เช่น `local` ที่ชี้ไปยังเครื่องอื่น) sync จะหยุดทำงานก่อนที่จะมีการเรียก API ใดๆ และจบการทำงานด้วยรหัสออก `2` โดยไม่มีสิ่งใดได้รับการแปลหรือเขียนลงไฟล์ บรรทัดปิดท้ายจะระบุจำนวนคีย์ที่ส่งไปยังโมเดลและจำนวนคีย์ที่ดึงมาจากแคช

ใต้ตารางจะมีบรรทัดหนึ่งที่ระบุอัตราการคำนวณราคาและที่มาของราคานั้น — สำหรับโมเดลแบบโฮสต์ จะเป็นราคาต่อ 1 ล้านโทเค็นอินพุตและเอาต์พุตจากรายการราคาสาธารณะของ OpenRouter รวมถึงเวลาที่อ่านข้อมูล (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`); สำหรับผู้ให้บริการโดยตรง (direct provider) (`openai`, `anthropic`, `gemini`) จะใช้รายการราคาเดียวกันนี้แทนราคาของผู้ให้บริการเอง และหากไม่สามารถอ่านรายการดังกล่าวได้ (หรือไม่มีราคาสำหรับโมเดลนั้น) จะใช้สำเนาที่เก็บไว้ใน champollion พร้อมระบุวันที่ตรวจสอบล่าสุดและเหตุผล; ส่วน DeepL, Google และ Microsoft จะอ้างอิงจากราคาต่อตัวอักษรที่เผยแพร่ไว้พร้อมวันที่ ข้อมูลนี้เป็นเพียงการประเมิน: บรรทัดดังกล่าวจะระบุจำนวนโทเค็น (หรือตัวอักษร) ต่อคีย์ที่ใช้ในการประมาณการ และค่าบริการจริงจะขึ้นอยู่กับความยาวที่แท้จริง เมื่อใช้ `--json` การประเมินจะแสดงรายละเอียด: `rate` ของแต่ละคู่ภาษา และ `rates` ของการรันรอบนั้น (`inputPerMillion`, `outputPerMillion` หรือ `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` หรือ `verified`)

**การดูคำขอ (request)**: `sync --dry --show-prompt [key]` จะพิมพ์คำขอที่แน่ชัดซึ่งเมธอดของคู่ภาษานั้นจะส่งไป — ทั้ง system message และ user message (หรือสำหรับเอนด์พอยต์ `api` จะเป็น request body) ที่สร้างขึ้นโดยโค้ดของเมธอดนั้นเอง พร้อมปิดบัง API key — โดยไม่มีการส่งข้อมูลใดๆ ออกไปจริง หากระบุคีย์ (ตามที่ `--redo keys:` เรียกชื่อ: `verb␄Open`, `common::nav.home`; สำหรับ gettext msgid ที่มีเครื่องหมายจุลภาคสามารถระบุทั้งข้อความได้) จะแสดงคำขอของคีย์นั้นไม่ว่าจะอยู่ในคิวหรือไม่ก็ตาม หากการรันจริงจะไม่ส่งข้อมูลใดๆ สำหรับคีย์นั้น (เนื่องจากเป็นข้อมูลล่าสุดแล้ว, ให้บริการจากแคช หรือถูกระงับไว้) ระบบจะแจ้งให้ทราบและระบุคำสั่ง `--redo keys:<key> --fresh` ที่จะใช้ส่งคีย์ดังกล่าว หากไม่ระบุคีย์ จะแสดงชุดข้อมูลแรก (first batch) ที่แต่ละไฟล์จะส่ง หรือแจ้งว่าไม่มีข้อมูลใดที่จะถูกส่ง วิธีนี้ใช้สำหรับตรวจสอบว่า `msgctxt` ของ gettext, คอมเมนต์ `#.` หรือคำอธิบายของ ARB ส่งไปถึงโมเดลหรือไม่ เครื่องมือแปลภาษาของระบบแมชชีนทรานสเลชัน (DeepL, Google…) จะได้รับเพียงข้อความต้นฉบับเท่านั้น ซึ่งการแสดงตัวอย่างจะระบุไว้เช่นกัน เมื่อใช้ `--json` แต่ละคำขอจะแสดงเป็นบรรทัด `{"level": "event", "event": "request", …}`

**การจำลองการทำงาน (Dry runs)**: `--dry` จะไม่แปลและไม่เขียนสิ่งใด แต่จะตรวจสอบสิ่งที่การรันจริงจะตรวจสอบก่อน: หากคีย์ที่เมธอดต้องใช้ขาดหายไป (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …) ระบบจะเตือนว่าการรันจริงจะหยุดทำงานพร้อมระบุชื่อตัวแปรนั้น โดยระบบจะตรวจสอบเพียงว่ามีการตั้งค่าคีย์ไว้หรือไม่ ไม่ได้ตรวจสอบว่าใช้งานได้จริงหรือไม่: เนื่องจากไม่มีการส่งข้อมูล ค่าที่เป็น placeholder จึงผ่านได้ การทำงานจะยังคงจบด้วยรหัสออก `0` — การแสดงตัวอย่างจะไม่มีวันล้มเหลว (ดูที่ [รหัสออก](#sync-exit-codes)) เช่นเดียวกับ `--max-cost`: การทำ dry run จะไม่หยุดเมื่อถึงขีดจำกัด แต่หากการประเมินราคาเกินขีดจำกัด (หรือไม่ทราบราคา) ระบบจะแจ้งในตอนท้ายเพียงครั้งเดียวว่าการรันจริงจะหยุดลงตรงนั้นและจบด้วยรหัสออก `2` เมื่อใช้ `--json` แต่ละบรรทัดจะเป็นออบเจกต์ JSON หนึ่งรายการที่มี `level` (`info`, `ok`, `event` บน stdout; `warn`, `error` บน stderr) และบรรทัดสุดท้ายของ stdout จะเป็นบทสรุป `{"level": "summary", "command": "sync", …}` ซึ่งมี `preflight: { ready, failures }`, ค่าขีดจำกัด `maxCost: { cap, estimatedCost, wouldStop, exitCode }` และ `realRun: { exitCode, wouldStop, reasons }` — ซึ่งเป็นรหัสออกที่การรันจริงจะสิ้นสุดลงเท่าที่การแสดงตัวอย่างจะระบุได้ (ดูที่ [รหัสออก](#sync-exit-codes)) ให้รันคำสั่งนี้พร้อมแฟล็กที่การ sync จริงใช้ (`--method`, `--model`): หากไม่ระบุ ระบบจะตรวจสอบเมธอดที่การกำหนดค่าระบุไว้ รหัสออกของการทำ dry run จะไม่มีวันทำให้ขั้นตอนใน CI ล้มเหลว คำเตือน `--max-cost` จึงแนะนำวิธีใช้เป็นเกตตรวจสอบ: ให้อ่าน `maxCost.wouldStop` (หรือ `realRun.exitCode`) จากบทสรุป `--json` — ตัวอย่างเช่น `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'` โดย [ขั้นตอนตรวจสอบในคู่มือ CI](/docs/guides/ci-cd#check-before-sync) ใช้วิธีนี้ และเมื่อไม่ผ่าน จะพิมพ์เหตุผล (`realRun.reasons`) แทนที่จะแสดงเพียง `false` เปล่าๆ ทั้งนี้ `totalPluralGaps` ของ dry run จะนับข้อความพหูพจน์บนดิสก์ที่ไม่มีรูปแบบที่ภาษานั้นใช้ ซึ่งการรันจริงจะไม่ส่งคำขอซ้ำอีก และ `verify` จะเป็น `{ "ran": false }` (เนื่องจากไม่มีการเขียนข้อมูล จึงไม่มีการตรวจสอบความถูกต้อง)

**การแปลซ้ำ**: `--redo` จะระบุว่า*อะไร*ที่จะต้องแปลซ้ำ และ `--fresh` จะระบุว่า*ต้องจ่ายเงินสำหรับสิ่งนั้นหรือไม่* หากไม่มี `--fresh` สิ่งใดก็ตามที่แคชเก็บไว้อยู่แล้วจะถูกดึงกลับมาใช้โดยไม่มีค่าใช้จ่าย (และยังคงผ่านเกตตรวจสอบคุณภาพ); แต่หากระบุ ทุกสิ่งที่อยู่ในคิวจะถูกแปลใหม่ทั้งหมดและคิดค่าบริการ ทั้งนี้ แฟล็กแบบเดิม (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) ยังคงใช้งานได้และมีความหมายตรงตามที่ระบุไว้ในตารางทุกประการ

**การจำกัดขอบเขตไปยังไฟล์**: `--files` จะจำกัดขั้นตอนการแปลเนื้อหาเฉพาะไฟล์ที่ตรงกัน และ `--redo files:<glob> --fresh` จะบังคับแปลใหม่ตั้งแต่ต้นสำหรับไฟล์ที่ตรงกัน (กรณีเดียวที่มีการตั้งใจจ่ายค่าแปลซ้ำ) รูปแบบแพตเทิร์นจะจับคู่กับเส้นทางไฟล์ที่ sync พิมพ์ (สัมพันธ์กับ `contentDir`, `2026-10.md`) และเส้นทางเดียวกันจากรูทของโปรเจกต์ (`newsletter/2026-10.md`): โดย `*` จะอยู่ภายในโฟลเดอร์เดียว และ `**` จะครอบคลุมข้ามโฟลเดอร์ ทั้งสองแฟล็กสามารถระบุซ้ำได้ หากแพตเทิร์นไม่ตรงกับไฟล์ใดเลย การรันจะหยุดลงก่อนที่จะมีการเสียค่าใช้จ่ายใดๆ สำหรับขั้นตอน key-value จะทำงานแบบ incremental อยู่แล้วและทำงานตามปกติ

**ความล้มเหลว**: หากมีไฟล์เนื้อหาไฟล์หนึ่งล้มเหลว จะไม่ทำให้ไฟล์อื่นหยุดทำงาน ไฟล์ที่สำเร็จจะถูกบันทึกและแคชคำแปลไว้ และเมื่อการรันสิ้นสุดลงจะแสดงรายการไฟล์ที่ล้มเหลวพร้อมสถานะคงเหลือของแต่ละไฟล์ บรรทัดของไฟล์จะไม่มีวันแสดง `[OK]` หากมีคีย์ในไฟล์ที่ยังไม่ได้แปล บทสรุปความล้มเหลวจะระบุว่าการ sync ครั้งถัดไปจะทำอย่างไรกับแต่ละคีย์: ส่งคำขออีกครั้ง (ไม่มีคำตอบที่ใช้ได้), ส่งคำขออีกหนึ่งครั้ง (รอดำเนินการจากการสั่ง redo) หรือระงับไว้ (ถูกปฏิเสธโดยเกตตรวจสอบคุณภาพ) บล็อก Markdown และฟิลด์ front-matter ที่เกตปฏิเสธจะถูกระงับไว้ในลักษณะเดียวกันเป็นรายหน้า; โดย `--redo files:<page>` หรือ `--redo content` จะส่งคำขออีกครั้ง ([เกตตรวจสอบคุณภาพ](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)) รหัสออกคือ `0` (เรียบร้อยทั้งหมด), `2` (สำเร็จบางส่วน: ทำงานไปบางส่วน, มีบางอย่างล้มเหลว, ถูกระงับไว้ หรือไม่ผ่านการตรวจสอบความถูกต้อง, มีการเขียนข้อความพหูพจน์โดยไม่มีรูปแบบที่ภาษานั้นใช้สำหรับการนับจำนวนทั่วไป — หรือหยุดทำงานเนื่องจาก `--max-cost` ก่อนที่จะมีค่าใช้จ่าย) หรือ `1` (ไม่มีส่วนใดสำเร็จเลย)

**การตรวจจับการเปลี่ยนแปลง**: champollion จะจัดเก็บค่าแฮช SHA-256 ไว้ใน `.champollion.lock` เมื่อค่าต้นทางเปลี่ยน การ sync ครั้งถัดไปจะแปลคีย์เหล่านั้นซ้ำโดยอัตโนมัติ โปรดคอมมิตไฟล์ล็อกเพื่อให้ผู้พัฒนาทุกคนใช้ข้อมูลอ้างอิงเดียวกัน ไฟล์ล็อกยังบันทึกฟิงเกอร์พรินต์ของแต่ละค่าที่ sync เขียนไว้แยกตามโลแคลเป้าหมาย (เพื่อให้ระบบจำแนกค่าที่มนุษย์แก้ไขได้และเก็บรักษาไว้เมื่อมีการสั่ง redo จำนวนมาก — [การแก้ไขคำแปล](/docs/guides/professional-translators#editing-key-value-files)), คีย์ที่การ redo ทำไม่เสร็จ (**รอดำเนินการ (pending)**: การ sync ครั้งถัดไปจะส่งคำขออีกหนึ่งครั้ง) และคีย์ที่เกตตรวจสอบคุณภาพปฏิเสธ (**ถูกระงับไว้ (held back)**: จะไม่ถูกส่งซ้ำไปยังโมเดลเดิมในการ sync แบบปกติ — [เกตตรวจสอบคุณภาพ](/docs/concepts/quality-gate#refused-keys-are-held-back))

**การแก้ไขด้วยตนเองและการทำซ้ำ (redos)**: `--redo all`, `--force` และการสลับโมเดลจะคงค่าที่มนุษย์แก้ไขไว้ พร้อมระบุว่าคือค่าใด; `--redo keys:<key>` ที่ระบุชื่อคีย์จะเขียนทับค่านั้น; คีย์ที่ต้นทางมีการเปลี่ยนแปลงจะถูกแปลใหม่อีกครั้ง การแก้ไขที่ถูกเขียนทับจะถูกพิมพ์ออกมาและเพิ่มต่อท้ายใน `.champollion-replaced-edits.jsonl` (มีการติดตาม — คอมมิตไฟล์นี้ร่วมกับไฟล์ล็อก)

**คีย์ gettext ที่มีบริบท (context)**: คีย์คือ `msgctxt` + U+0004 + `msgid` รายงานจะพิมพ์ตัวคั่นเป็น `␄` ซึ่ง `--redo keys:` และ `--force-keys` ยอมรับเช่นกัน; หากต้องการพิมพ์ ให้เขียน `\x04`: `--redo 'keys:django::verb\x04Open'` (เครื่องหมายคำพูดเดี่ยวจะช่วยคงค่า backslash ไว้) ทั้งสองรูปแบบสามารถใช้งานได้ คำสั่งกู้คืนจะพิมพ์รูปแบบ `␄` ตามด้วยคอมเมนต์ของเชลล์ที่ระบุชื่อ `\x04`

**คีย์ที่ระบุไม่ตรงกับสิ่งใด**: `--redo keys:` / `--force-keys` ที่ระบุชื่อซึ่งไม่มีในคีย์ต้นทาง (พิมพ์ผิด หรือ msgid มีอยู่เฉพาะเมื่อมีบริบทเท่านั้น) จะล้มเหลวด้วยรหัสออก 1 ข้อผิดพลาดจะแสดงรายการคีย์ที่ใกล้เคียงที่สุด รวมถึงรูปแบบบริบททั้งหมดของ msgid นั้นในทั้งสองรูปแบบการเขียน หากไม่มีชื่อใดตรงกันเลย จะไม่มีการรันใดๆ เกิดขึ้น หากมีบางชื่อตรงกัน คีย์เหล่านั้นจะถูกทำซ้ำ (redo) จากนั้นการรันจะล้มเหลวพร้อมระบุชื่อคีย์ที่เหลือ

**คีย์ที่ระบุซึ่งให้บริการจากแคช**: หากไม่มี `--fresh` การ redo จะส่งคืนค่าที่แคชเก็บไว้ (ตรวจสอบซ้ำ โดยไม่มีค่าใช้จ่าย) และแจ้งให้ทราบ พร้อมแสดงคำสั่ง `--fresh` สำหรับส่งคำขอไปยังโมเดลใหม่อีกครั้งและระบุค่าใช้จ่าย

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

แถบแสดงความคืบหน้าจะอัปเดตแบบ in-place หลังจบแต่ละชุด (~80 คีย์) ใช้ `--quiet` สำหรับแสดงเฉพาะข้อผิดพลาด/คำเตือนเท่านั้น หรือ `--json` สำหรับเอาต์พุต NDJSON ที่เครื่องสามารถอ่านได้ ทั้งสองตัวเลือกจะปิดการแสดงแถบความคืบหน้าและแบนเนอร์ เมื่อใช้ `--json` จะมีอีเวนต์ `cost` ส่งมาก่อนเกต `--max-cost`, มีอีเวนต์ `file` สำหรับแต่ละไฟล์เนื้อหาและโลแคล และมี `summary` ปิดท้ายการรันทุกครั้ง

### รหัสออก {#sync-exit-codes}

| รหัส | การรันจริง | การทำ dry run (`--dry`) |
|------|------------|---------------------|
| `0` | ทุกอย่างในคิวได้รับการแปลและตรวจสอบความถูกต้องแล้ว หรือไม่มีสิ่งใดในคิว | รันสำเร็จ — แม้ว่าจะระบุว่าการรันจริงจะหยุดทำงานก็ตาม |
| `2` | สำเร็จบางส่วน: ทำงานไปบางส่วน แต่มีบางอย่างล้มเหลว, ถูกระงับไว้ หรือไม่ผ่านการตรวจสอบความถูกต้อง หรือมีการเขียนข้อความพหูพจน์โดยไม่มีรูปแบบที่ภาษานั้นใช้สำหรับการนับจำนวนทั่วไป รวมถึง: `--max-cost` หยุดการทำงานก่อนที่จะส่งข้อมูลใดๆ | ไม่มีวันเกิดขึ้น |
| `1` | ไม่มีสิ่งใดสำเร็จเลย หรือไม่สามารถเริ่มการรันได้: คีย์ที่เมธอดต้องการขาดหายไป, เซิร์ฟเวอร์โมเดลที่ต้องใช้ไม่ตอบสนอง, คีย์ที่ระบุให้ redo ไม่ตรงกับสิ่งใด, แพตเทิร์น `--files` ไม่ตรงกับไฟล์ใด หรือการกำหนดค่าไม่ถูกต้อง | ตัว dry run เองไม่สามารถทำงานได้: คีย์ที่ระบุให้ redo ไม่ตรงกับสิ่งใด, แพตเทิร์น `--files` ไม่ตรงกับไฟล์ใด หรือการกำหนดค่าไม่ถูกต้อง |

การทำ dry run จะจบด้วยรหัสออก `0` เสมอโดยเจตนา: เนื่องจากเป็นการแสดงตัวอย่างที่คุณรันเพื่อดูก่อนตัดสินใจ และขั้นตอน CI ที่ทำหน้าที่เพียงแค่ตรวจสอบจะต้องไม่ล้มเหลว สิ่งที่การรันจริงจะทำจะแสดงอยู่ในบรรทัดท้ายๆ ของ dry run และในบทสรุป `--json`: โดย `preflight.ready: false` หมายความว่าการรันจริงจะหยุดลงก่อนการแปลและจบด้วยรหัสออก `1` (`preflight.failures` จะบอกเหตุผล); `maxCost.wouldStop: true` หมายความว่าจะหยุดเมื่อถึงขีดจำกัดและจบด้วยรหัสออก `2` (`maxCost.exitCode: 2`); `maxCost.exitCode: 1` ร่วมกับ `maxCost.stopsEarlier` หมายความว่าการตรวจสอบเบื้องต้น (preflight) จะสั่งหยุดก่อนที่จะตรวจสอบขีดจำกัด ส่วน `realRun.exitCode` จะรวมข้อมูลเหล่านี้เข้าด้วยกัน พร้อมสิ่งที่อาจทำให้การรันจริงสำเร็จเพียงบางส่วน: คีย์ที่ถูกระงับไว้ หรือข้อความพหูพจน์บนดิสก์ที่ไม่มีรูปแบบที่ภาษานั้นใช้ซึ่งระบบจะไม่ส่งคำขอซ้ำอีก (`2`; `realRun.reasons` จะระบุชื่อ และบรรทัดสุดท้ายของ dry run จะแจ้งไว้) การปฏิเสธโดยเกตตรวจสอบคุณภาพหรือการตรวจสอบความถูกต้องไม่ผ่าน ซึ่งมีเพียงการรันจริงเท่านั้นที่ตรวจพบได้ ยังสามารถเปลี่ยนรหัสที่คาดการณ์ไว้จาก `0` ไปเป็น `2` ได้ [ขั้นตอนตรวจสอบในคู่มือ CI](/docs/guides/ci-cd#check-before-sync) จะเปลี่ยนสิ่งเหล่านี้ให้เป็นขั้นตอน CI ที่ล้มเหลวพร้อมพิมพ์สาเหตุออกมา

---

## watch

Sync อัตโนมัติเมื่อไฟล์ source locale เปลี่ยนแปลง ทำงานจนกว่าจะหยุดด้วย `Ctrl+C`

```bash
champollion watch
```

---

## audit

เกตตรวจสอบความครบถ้วนสมบูรณ์ จะแสดงรายการทุกคีย์ที่ยังไม่ได้แปล — ขาดหายไป, ว่างเปล่า หรือยังคงเป็น fallback `[EN]` — และทุกคำแปลที่**ล้าสมัย (out of date)**: แปลมาจากข้อความต้นฉบับรุ่นเก่ากว่ารุ่นปัจจุบัน (ตาม `.champollion.lock`; การแก้ไขต้นทางที่แปลซ้ำไม่สำเร็จจะทิ้งสถานะนี้ไว้) แต่ละรายการที่ล้าสมัยจะลงท้ายด้วยคำสั่งสำหรับแปลซ้ำ จบการทำงานด้วยรหัสออก 1 หากตรวจพบรายการใดๆ — ใช้เป็นเกตใน CI เพื่อสั่งให้บิลด์ล้มเหลวหากมีคำแปลที่ไม่ครบถ้วนหรือล้าสมัย

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

อ่านไฟล์ locale ทั้งหมดจากดิสก์อีกครั้งและตรวจสอบว่าการแปลมีอยู่จริงและถูกต้อง นี่คือการตรวจสอบเดียวกับที่รันโดยอัตโนมัติเมื่อสิ้นสุดทุก `sync` (เว้นแต่จะส่ง `--no-verify`)

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**สิ่งที่ตรวจสอบ:**
- ความสอดคล้องของคีย์ (Key parity) — คีย์ต้นทางทั้งหมดต้องมีอยู่ในแต่ละเป้าหมาย (สำหรับคีย์พหูพจน์ของ i18next จะต้องมีคีย์ของรูปแบบพหูพจน์ CLDR ของโลแคลนั้นๆ ด้วย: ภาษาฝรั่งเศสต้องมี `count_many` ด้วยเช่นกัน)
- เครื่องหมาย fallback `[EN]` จากการรันครั้งก่อนหน้า
- คำแปลที่ว่างเปล่า
- ความสอดคล้องของระบบอักษร (Script compliance) — โลแคลที่ไม่ใช่อักษรละตินต้องไม่มีข้อความที่เป็นอักษรละตินล้วน; ตัวอักษรจะถูกจัดหมวดหมู่ตาม Unicode script ดังนั้นอักษรละตินที่มีเครื่องหมายกำกับเสียงและแบบความกว้างเต็ม (fullwidth) จึงนับเป็นละตินด้วย ตัวอักษรละตินแบบความกว้างเต็มถือเป็นข้อผิดพลาดในทุกโลแคลที่อยู่นอกเหนือการจัดพิมพ์ CJK
- ตัวแทนข้อความ (Placeholders) โดยแต่ละสิ่งที่ตรวจพบจะระบุชื่อตามไวยากรณ์ที่เกี่ยวข้อง — โครงสร้าง ICU MessageFormat (`ICU structure error`: อาร์กิวเมนต์ `{name}`, คีย์เวิร์ดหรือ selector ของ plural/select ที่ถูกแปล, `#` ที่หายไป), การแปลง printf (`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` — `%(name)s` ที่หายไปของแคตตาล็อก gettext จะถูกระบุว่าเป็น printf ไม่ใช่ ICU), การแทนค่าแบบ i18next (`i18next {{…}} placeholder mismatch`: `{{name}}` รวมถึง `{{name}}` ที่เขียนเป็น `{name}` ซึ่ง i18next จะพิมพ์ออกมาตามนั้น) และ `{name}` แบบวงเล็บปีกกาเดี่ยวที่อยู่นอกข้อความ ICU (`{…} placeholder mismatch`)
- มาร์กอัป (Markup) — มีแท็กเปิด แท็กปิด และแท็กปิดในตัวที่เหมือนกับต้นทางตามชื่อแท็ก พร้อมการซ้อนกันในลักษณะเดียวกัน (`</strong>` ที่หายไปถือเป็นข้อผิดพลาด)
- ปัญหาการเข้ารหัส — เครื่องหมาย BOM, อักขระที่มองไม่เห็น
- ข้อความสะท้อนต้นทาง (Source echoes) — ค่าที่เหมือนกับต้นทางทุกประการ (คำเตือน)
- รูปแบบพหูพจน์ — ข้อความพหูพจน์ที่ไม่มีรูปแบบที่ภาษานั้นใช้สำหรับการนับจำนวนทั่วไป (ภาษารัสเซีย `few`/`many`), รายการ gettext ที่รูปแบบต่างๆ ซ้ำเพียงแค่ `other` (sync จะทำเครื่องหมายรายการเหล่านั้นด้วยคอมเมนต์ `# champollion:`), คีย์ i18next หรือ `msgstr[n]` สำหรับรูปแบบที่ภาษานั้นไม่มี (คำเตือน)
- โลแคลที่เหมือนกัน — โลแคลเป้าหมายสองรายการมีข้อความเหมือนกันในเกือบทุกคีย์: โลแคลหนึ่งอาจเป็นภาษาของอีกโลแคลหนึ่ง (คำเตือน)
- ข้อความเดียวกันจากต้นทางต่างกัน — มีข้อความเดียวที่เขียนให้กับข้อความต้นทางหลายข้อความที่แตกต่างกัน (โมเดลพูดประโยคที่ท่องจำซ้ำ): ข้อความที่มีหลายคำและแตกต่างกันอย่างชัดเจนสองข้อความ แต่ได้คำตอบเป็นข้อความเดียวกันที่มีตั้งแต่ 4 คำขึ้นไป หรือตั้งแต่ 3 คำขึ้นไปในกรณีอื่น; ประโยคที่การ sync ครั้งก่อนหน้าตรวจพบว่าโมเดลพูดซ้ำจะถูกนับแม้จะเกิดขึ้นเพียงครั้งเดียวก็ตาม โดยจะนับรวมทั้งค่าของคีย์, แต่ละกิ่งของ ICU plural/select (กิ่งต่างๆ ของพหูพจน์หนึ่งรายการนับเป็นหนึ่งต้นทาง) และหน้า Markdown ของโลแคลนั้น (ฟิลด์ front-matter และบล็อกข้อความ; ไม่นับรวม `# ` และเครื่องหมายวรรคตอนท้ายประโยค) ตามกฎเดียวกับที่เกตของ `sync` ใช้ปฏิเสธ (ข้อผิดพลาด)
- ล้าสมัย (Out of date) — คำแปลที่แปลมาจากข้อความต้นฉบับที่เก่ากว่าข้อความปัจจุบัน (คำเตือนสำหรับจุดนี้; แต่ `audit` จะถือว่าล้มเหลว)
- เครื่องหมายคำถามหรืออัศเจรีย์ตกหล่น — ข้อความต้นทางลงท้ายด้วย `?` หรือ `!` แต่คำแปลไม่ได้ลงท้ายด้วยเครื่องหมายนั้นหรือเครื่องหมายเทียบเท่าของระบบอักษรเป้าหมาย (`？`, `؟`, `;` ของภาษากรีก, …) เป็นคำเตือน: บางภาษาใช้คำหรือคำลงท้ายเพื่อแสดงคำถามแทน

คำสั่งนี้จะตรวจสอบโครงสร้าง ไม่ได้ตรวจสอบความหมาย: การผ่านการตรวจสอบหมายความว่าคีย์, ตัวแทนข้อความ, รูปแบบพหูพจน์,
มาร์กอัป และระบบอักษรยังคงสมบูรณ์ ไม่ได้แปลว่าข้อความสื่อความหมายถูกต้อง — ควรให้เจ้าของภาษาตรวจสอบก่อนนำไปใช้งานจริง

**โลแคลใดบ้าง** `verify` จะตรวจสอบทุกโลแคล; `verify --pair en:fr` จะตรวจสอบ
เฉพาะภาษาฝรั่งเศสเท่านั้น หลังจาก `sync --pair en:fr` การตรวจสอบหลังการ sync จะครอบคลุมเฉพาะคู่ภาษา
ที่ได้รันไปเท่านั้น ไม่รวมคู่อื่น การตรวจสอบแบบจำกัดขอบเขตจะระบุไว้ที่บรรทัดปิดท้าย — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json` บรรทัดนั้นจะมี
`checked` (โลแคลที่ได้รับการตรวจสอบ) และ `scope`

**ความครอบคลุมของรูปแบบพหูพจน์** บล็อกของแต่ละโลแคลจะมีหนึ่งบรรทัดต่อชนิดพหูพจน์ที่
ไฟล์ของโลแคลนั้นมี — คีย์ที่มีคำต่อท้ายของ i18next, ข้อความพหูพจน์ของ ICU, รายการ `msgid_plural`
ของ gettext — โดยจะระบุชื่อรูปแบบที่คาดว่าโลแคลนั้นควรมี
(หมวดหมู่พหูพจน์ CLDR สำหรับภาษานั้น; ส่วนในแคตตาล็อก gettext คือรูปแบบที่
`Plural-Forms` มีช่องรองรับ) และระบุว่าทุกพหูพจน์มีรูปแบบเหล่านั้นครบถ้วนหรือไม่:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` จะระบุชื่อพหูพจน์ที่ขาดรูปแบบไป สำหรับรูปแบบที่ใช้เฉพาะกับตัวเลขที่มากกว่า 1000 หรือ
เศษส่วนเท่านั้น (เช่น `many` ของภาษาฝรั่งเศสในข้อความ ICU) จะถูกแยกไว้ต่างหาก: โดยจะใช้รูปแบบ `other`
แทน ซึ่งไม่ถือเป็นข้อตรวจพบ (finding) บรรทัดนี้เป็นบทสรุป — รูปแบบที่
ขาดหายไปจะถูกแสดงเป็นข้อตรวจพบที่ด้านบนด้วยเช่นกัน (คีย์ที่หายไป, คำเตือนเรื่องพหูพจน์)

**`--json`** จะเขียนออบเจกต์ JSON หนึ่งรายการต่อหนึ่งบรรทัด แต่ละโลแคลจะได้รับหนึ่งเรคอร์ดทาง
stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — พร้อมทั้ง
`ok`, `keys` (`expected`, `present`, `missing`, `extra`), `errors` ของโลแคล,
`warnings` และ `infos`, `placeholders` (แต่ละข้อตรวจพบพร้อม `syntax` ของรายการนั้น: `icu`,
`printf`, `i18next`, `brace` หรือ `markup`) และ `plurals` (แยกตามชนิดและประเภท:
`categories`, `total`, `complete`, `incomplete`) นอกจากนี้ข้อตรวจพบยังแสดงเป็น
บรรทัด `error`/`warn` ทาง stderr อีกด้วย และบรรทัดปิดท้ายจะยังคงรักษาระดับและ
ข้อความไว้ (`ok` ทาง stdout เมื่อการตรวจสอบผ่าน, `error` ทาง stderr เมื่อการตรวจสอบ
ไม่ผ่าน) พร้อมทั้งมีจำนวนนับของ `errors` และ `warnings` หลังจาก sync เรคอร์ดเดียวกันนี้
จะปรากฏก่อนบทสรุปของตัว sync เอง (เรคอร์ดของโปรเจกต์ Docusaurus
จะไม่มี `keys` หรือ `plurals`: เนื่องจากข้อความ UI จะได้รับการตรวจสอบแบบทีละไฟล์)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**รหัสออก:** `1` เมื่อพบข้อผิดพลาด — หรือเมื่อไม่สามารถตรวจสอบสิ่งใดได้เลย
(ไฟล์ต้นทางหรือโฟลเดอร์โลแคลไม่ได้อยู่ในตำแหน่งที่การกำหนดค่าชี้ไป;
บรรทัดข้อผิดพลาดจะระบุพาธและการตั้งค่าดังกล่าว) และเป็น `0` ในกรณีอื่นๆ คำเตือนจะไม่ทำให้
คำสั่งล้มเหลว เว้นแต่คุณจะระบุ `--strict` ซึ่งจะจบด้วยรหัสออก `1` เมื่อมีคำเตือนใดๆ (เช่น CI
ที่ต้องไม่ปล่อยงานที่มีพหูพจน์ภาษารัสเซียโดยไม่มีรูปแบบ `few`/`many`) และจะจบ
ด้วยบรรทัด `[FAIL]` โดยไม่มีวันเป็น `[OK]`; `--warn-only` จะทำให้ข้อผิดพลาดจบด้วยรหัสออก `0`
เช่นกัน สำหรับโลแคลที่จำนวนคีย์ไม่ถูกต้องจะแจ้งให้ทราบแทนที่จะแสดง `[OK]`:
`8 expected, 9 present (1 extra: count_two)`

---

## lint

สแกน source code เพื่อหาสตริงที่ hardcode สำหรับผู้ใช้ที่ควรใช้ i18n translation call ตรวจจับ framework ของคุณโดยอัตโนมัติ (next-intl, react-i18next, vue-i18n, Hugo)

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
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

**การไม่มีสิ่งใดให้ lint ถือเป็นความล้มเหลว**: เมื่อไม่มีไฟล์ต้นทางใดตรงกับเงื่อนไข (โฟลเดอร์เริ่มต้นของเฟรมเวิร์ก — `src/`, `app/`, `pages/`, `components/` สำหรับโปรเจกต์เว็บ — หรือ `--src` ของคุณ) lint จะจบด้วยรหัสออก `1` พร้อมระบุชื่อโฟลเดอร์และนามสกุลไฟล์ที่ค้นหา การ lint ที่ไม่ได้ตรวจสอบสิ่งใดเลยจะต้องไม่ผ่านเกต CI; ให้ชี้คำสั่งไปยังโค้ดของคุณด้วย `--src <dir>` หรือ `"lint": { "srcDir": "<dir>" }`

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
- ความเสียหายของตัวแทนข้อความ (Placeholder corruption) (เช่น `{name}` มีอยู่ในต้นทางแต่ขาดหายไปในเป้าหมาย)
- ปัญหาการเข้ารหัส (mojibake, Unicode ไม่ถูกต้อง)
- สำเนาที่ยังไม่ได้แปล (Untranslated copies) (ค่าเป้าหมายเหมือนกับต้นทาง) — คีย์ [`noTranslate`](/docs/getting-started/configuration#no-translate) จะได้รับการยกเว้น รวมถึงข้อความสะท้อน (echoes) ที่ Translation Memory ยืนยันว่าสร้างขึ้นจากไปป์ไลน์และผ่านการอนุมัติจากเกตแล้ว สิ่งที่ยังคงถูกติดแฟล็กไว้คือสิ่งที่ `sync` จะนำกลับเข้าคิวใหม่ — เครื่องมือทั้งสองจะไม่มีความเห็นขัดแย้งกันเกี่ยวกับไฟล์ที่สมบูรณ์ดี
- ความคลาดเคลื่อนของ no-translate (คีย์ `noTranslate` ที่*ไม่*เหมือนกับต้นทาง) — รายงานพร้อมค่าที่คาดหวัง/ค่าจริงและ escape อักขระที่มองไม่เห็น; รัน `champollion sync` เพื่อแก้ไข
- PUA ที่ไม่คาดคิด (รหัสจุด Private Use Area ในโลแคลที่ปิด [การแปลงระบบอักษร](/docs/getting-started/configuration#script-conversion) — จะแสดงผลเป็นช่องว่างหากไม่มีฟอนต์พิเศษ); รัน `champollion repair-script` เพื่อแก้ไข
- ค่าที่ถูกลบเนื้อหา (Hollowed values) (ค่าเป้าหมายที่เหมือนต้นทางแต่ตัวอักษรถูกลบหายไป — ความเสียหายจากไปป์ไลน์รุ่นเก่าก่อนหน้าที่จะมีเกตสงวนเนื้อหา); แปลใหม่ด้วย `sync --force-keys <key>` หรือ `sync --pair <pair> --force`
- คีย์กำพร้า (Orphaned keys) (คีย์ในเป้าหมายที่ไม่มีอยู่ในต้นทาง)
- ความครบถ้วนของหมวดหมู่พหูพจน์ ICU MessageFormat (เช่น ภาษาอาหรับต้องมี 6 หมวดหมู่) — ตามกฎเดียวกับที่ `sync` และ `verify` ใช้: รูปแบบที่ขาดหายไปซึ่งการนับจำนวนทั่วไปเข้าถึงได้ (เช่น `few`/`many` ในภาษารัสเซีย) จะเป็นคำเตือน; ส่วนรูปแบบที่เข้าถึงได้เฉพาะตัวเลขที่มากกว่า 1000 หรือเศษส่วนเท่านั้น (เช่น `many` ในภาษาฝรั่งเศส ซึ่งใช้สำหรับ 1,000,000) จะเป็นหมายเหตุ เนื่องจากใช้รูปแบบ `other` สำหรับกรณีนั้น

---

## repair-script

แปลงระบบอักษรกลับคืนจากกรณีที่ไม่ควรเกิดขึ้น: ค่าที่เข้ารหัสด้วย PUA (pIqaD, Tengwar, Kryptonian) ในโลแคลที่มีการกำหนดค่าระบุว่าปิดการแปลงระบบอักษร จะถูกกู้คืนกลับเป็นอักษรโรมัน (romanization) ผ่านตารางย้อนกลับของตัวแปลงนั้นเอง

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| ตัวเลือก | ผลลัพธ์ |
|--------|--------|
| `--dry` | ดูตัวอย่างการกู้คืนโดยไม่เขียนลงไฟล์ |
| `--locale <code>` | กู้คืนเฉพาะโลแคลเดียว |
| `--json` | เอาต์พุตเป็น JSON ที่เครื่องสามารถอ่านได้ |
| `--warn-only` | จบด้วยรหัสออก 0 แม้จะยังมี PUA ที่แปลงกลับไม่ได้เหลืออยู่ |

pIqaD สามารถแปลงกลับได้อย่างแม่นยำ ส่วนการแปลงกลับของ Tengwar และ Kryptonian จะไม่สามารถกู้คืนตัวพิมพ์ใหญ่-เล็กได้ (จะถูกติดแฟล็กว่า case-lossy) สำหรับ Translation Memory นั้นไม่จำเป็นต้องกู้คืน — เนื่องจากจัดเก็บค่าก่อนการแปลงไว้อยู่แล้ว คำสั่งจะจบด้วยรหัสออก 1 เมื่อมี PUA หลงเหลืออยู่และไม่มีตัวแปลงที่ลงทะเบียนไว้ตัวใดสามารถแปลงกลับได้

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

แสดงการกำหนดค่าคู่ภาษา, ปลั๊กอินที่ติดตั้ง และคะแนนเบนช์มาร์ก

คู่ภาษาที่มีการกำหนดค่า `qualityTier` (`standard`, `high`, `research` หรือ
`verified`) จะแสดงค่านั้นตามที่เป็นจริง: คือเป็นป้ายกำกับที่คุณเลือกเอง ไม่ใช่
ผลการวัด — sync จะแปลเหมือนเดิมไม่ว่าป้ายนี้จะระบุว่าอย่างไร และ `serve`
จะประกาศค่านั้นออกไป คู่ภาษาที่ไม่ได้ตั้งค่านี้ไว้จะไม่แสดงค่าใดๆ (`--json` ยังคงมี
`qualityTier` พร้อมด้วย `qualityTierSet: false`)

```bash
champollion status
```

หลังจากการสลับโมเดล ระบบจะแจ้งเตือนเมื่อไฟล์ของโลแคลมีข้อความผสมกันจากโมเดลมากกว่า
หนึ่งตัว (ดูจาก Translation Memory: โมเดลใดสร้างแต่ละค่า
บนดิสก์) พร้อมคำสั่งที่สั่งให้โมเดลปัจจุบันแปลส่วนที่โมเดล
ก่อนหน้าเขียนไว้ — `sync --pair <pair> --redo all --fresh-on-model-change`
สำหรับเมธอดที่รันโมเดลที่คุณเลือก (`local`, `api`, `external`) ระบบจะ
แสดงหมายเหตุสัญญาอนุญาตซ้ำอีกครั้งตามที่การ sync ครั้งแรกเคยพิมพ์ไว้ สำหรับเมธอดที่เข้ากันได้กับ
OpenAI (`local`, `openai`) จะแสดงที่อยู่ที่ส่งคำขอไปและค่าที่
กำหนดที่อยู่นั้น: `LOCAL_API_BASE` ในสภาพแวดล้อมหรือใน `.env` หรือค่าเริ่มต้น
(Ollama, `http://localhost:11434/v1`) เมื่อมี `contentDir` จะแสดงโฟลเดอร์เนื้อหา
ควบคู่ไปกับไฟล์ key-value พร้อมระบุจำนวนหน้าต้นทางที่มี และระบุ
แยกตามภาษาว่ามีคำแปลที่เป็นปัจจุบัน, ล้าสมัย หรือรอดำเนินการอยู่กี่หน้า
รอดำเนินการ (Pending) หมายถึงยังไม่มีคำแปล หรือส่วนที่เกตตรวจสอบคุณภาพปฏิเสธถูกปล่อยทิ้งไว้เป็นภาษาต้นทาง (ไฟล์ล็อกเนื้อหาจะอ่านค่าเป็น `pending:<hash>`)
ใต้แต่ละระดับภาษา จะแสดงคำแนะนำเรื่องเพศภาวะที่ส่งไปในพรอมต์ของ LLM และระบุ
ที่มาของคำแนะนำนั้น (ค่าเริ่มต้นของ Champollion สำหรับภาษานั้น, การกำหนดค่าของคุณ หรือปิดการใช้งาน —
ดูที่ [คำแนะนำเรื่องเพศภาวะ](/docs/getting-started/configuration#gender-guidance))
สำหรับคู่ภาษาที่มีแผนสำรอง (fallback) จะนับจำนวนค่าในไฟล์ที่แผนสำรอง
เป็นผู้เขียน และระบุสองสามรายการแรก
`--json` จะมีข้อมูลเช่นเดียวกับ `requestsGoTo` (ในคู่ภาษาหรือแผนสำรองที่มีเอนด์พอยต์ดังกล่าว), `content`, `genderGuidance` และ `fallback.valuesInFiles`

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
champollion plugin remove my-method          # remove a plugin
```

ดู [Plugin Specification](/docs/reference/plugin-spec) สำหรับรูปแบบ plugin manifest

---

## leaderboard

`champollion network leaderboard` (ใช้งานเป็น `champollion leaderboard` ได้เช่นกัน) เรียกดู ค้นหา และติดตั้งเมธอดการแปลจากลีดเดอร์บอร์ด Network โดยเมธอดที่ติดตั้งจากลีดเดอร์บอร์ดจะมาพร้อมคะแนนเบนช์มาร์กและ MethodConfig ตามแบบแผนฉบับเต็ม — ซึ่งเป็นการกำหนดค่าที่แน่ชัดที่ใช้ในระหว่างการประเมินผล

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| ตัวเลือก | ผลลัพธ์ |
|--------|--------|
| `--pair <pair>` | กรองตามคู่ภาษา ตามรูปแบบที่บอร์ดเขียน: `"eng>fra"` (ISO 639-3; ใส่เครื่องหมายคำพูดครอบ `>`) ทั้งนี้ `eng-fra` และ `eng:fra` ก็ใช้งานได้เช่นกัน รวมถึงรหัส 2 ตัวอักษรจะได้รับการแปลงให้ (`en` → `eng`) |
| `--install <rank>` | ติดตั้งเมธอดในอันดับนั้น (ตามรายการที่แสดง) เป็นปลั๊กอิน |
| `--apply` | หลังติดตั้ง จะเพิ่ม `methodPlugin` ไปยัง `champollion.config.json` โดยอัตโนมัติ |

**workflow `--apply`:** เมื่อคุณติดตั้งด้วย `--apply` champollion จะเขียน method plugin ไปยัง `.champollion/methods/` **และ** แก้ไข `champollion.config.json` ของคุณให้ใช้งานสำหรับ pair ที่เกี่ยวข้อง นี่คือเส้นทางที่เร็วที่สุดจาก "อะไรได้คะแนนดีที่สุด?" ไปสู่ "ฉันใช้งานมันใน production แล้ว"

---

## card

`champollion network card <code>` (ใช้งานในชื่อ `champollion card` ได้เช่นกัน) พิมพ์สิ่งที่ดัชนีรับรู้เกี่ยวกับภาษาหนึ่ง ๆ: การระบุตัวตน การจำแนกประเภท การประมาณการจำนวนผู้พูด ภาวะใกล้สูญ ภาษาศาสตร์เชิงแบบลักษณ์ ความพร้อมใช้งานของคลังข้อมูล ทรัพยากรทางภาษา ชุดข้อมูลการประเมิน ความพร้อมของไปป์ไลน์ การรองรับ method และแหล่งที่มาของข้อมูล ในกรณีที่แหล่งข้อมูลไม่ตรงกัน (ชื่อ ตระกูลภาษา จำนวนผู้พูด ภาวะใกล้สูญ ฯลฯ) ทุกค่าจะถูกพิมพ์ออกมาพร้อมแหล่งที่มาและไม่มีการเลือกค่าใดค่าหนึ่ง ส่วนหัวข้อที่การ์ดไม่มีข้อมูลจะระบุว่า "not recorded on this card": การไม่มีข้อมูลหมายถึงไม่ทราบ ไม่ใช่ "ไม่มี" ชื่อเรียกอื่น (alias) จะได้รับการจำแนกแปลงค่า (`fr` → `fra`)

```bash
champollion network card crk           # Plains Cree
champollion network card cmn --json    # the raw card JSON
```

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--json` | ข้อมูลดิบ JSON ของการ์ดแทนการจัดรูปแบบแสดงผล |

---

## recommend

`champollion network recommend <src> <tgt>` (ใช้งานในชื่อ `champollion recommend` ได้เช่นกัน) คำแนะนำเกี่ยวกับ method สำหรับคู่ภาษาต้นทาง→เป้าหมายหนึ่งคู่: เอนจินที่ส่งคำสั่งได้ทั้งหมดพร้อมสถานะความพร้อมใช้งานแบบสด (มีคีย์ API หรือไม่? มีเลนสัญญาอนุญาตหรือไม่?), โมเดลแบบเปิดที่การ์ดโมเดลของตนเองประกาศว่ารองรับภาษาเป้าหมายและ `local-model` สามารถโหลดได้ (รันได้ โดยไม่มีหลักฐานเผยแพร่ — เป็นการกล่าวอ้างเพื่อนำไปเบঞ্চมาร์ก ไม่ใช่ผลการวัดจริง), หลักฐานเผยแพร่ที่จัดทำดัชนีไว้สำหรับคู่ภาษานี้ (อ้างอิงถึง ไม่ทำซ้ำ; เปรียบเทียบเชิงสัมพัทธ์เท่านั้น) และโมเดลที่มีหลักฐานรองรับรุ่นใดบ้างที่สามารถรันที่นี่ได้ หากไม่มีหลักฐานก็จะระบุไว้เช่นนั้น ทั้งนี้เลนเชิงพาณิชย์มีความเข้มงวด: method ที่ไม่มีสัญญาอนุญาตที่พร้อมใช้เชิงพาณิชย์จะถูกแยกออกพร้อมแสดงเหตุผล

```bash
champollion network recommend eng yor
champollion network recommend eng-yor --use commercial
```

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--pair <pair>` | คู่ภาษาเป็นค่าเดียวแทนที่จะเป็นสองรหัส: `"eng>yor"` (ใส่เครื่องหมายคำพูดครอบ `>`), `eng-yor` หรือ `eng:yor` |
| `--use <lane>` | เลนสัญญาอนุญาต: `non-commercial` (ค่าเริ่มต้น) หรือ `commercial` (เข้มงวด) |
| `--json` | เพย์โหลดที่เครื่องสามารถอ่านได้ |

---

## register-corpus

`champollion network register-corpus` (ใช้งานในชื่อ `champollion register-corpus` ได้เช่นกัน) ลงทะเบียนคลังข้อมูลการประเมินพร้อมสัญญาอนุญาตและระดับการเปิดเผยข้อมูล (exposure tier) — `local-only` (ค่าเริ่มต้น: ไม่ลงทะเบียนหรืออัปโหลดสิ่งใด), `private` (เฉพาะเมทาดาทา), `public` (การ์ดเมทาดาทาและตัวชี้สำหรับดึงข้อมูลจากแหล่งต้นทาง) หรือ `sealed` (เข้ารหัสบนอุปกรณ์ของคุณ; มีเพียงการ์ดที่ปราศจากเนื้อหาเท่านั้นที่ส่งออกไป) Champollion ไม่อัปโหลดหรือโฮสต์ข้อความในคลังข้อมูลเด็ดขาดไม่ว่าจะอยู่ในระดับใด: ไฟล์ที่ระบุชื่อด้วย `--data` จะถูกอ่านบนเครื่องนี้เท่านั้น เพื่อนับจำนวนและคำนวณเช็กซัม และจะได้รับไฟล์ประกบเพื่อให้ `mt-eval run` นำสัญญาอนุญาตไปบังคับใช้ สำหรับชุดทดสอบ คำสั่งนี้จะพิมพ์ขั้นตอนของ nmt-forge ที่ต้องดำเนินการก่อนการคิดคะแนนครั้งแรก ใช้งานแบบโต้ตอบได้ในเทอร์มินัล และเขียนสคริปต์สั่งการได้ด้วยแฟล็กและ `--yes`

```bash
champollion network register-corpus --list
champollion network register-corpus --yes --name "Holdout" --pair "eng>crk" --license cc-by-nc-4.0 --tier private --role test --size 500 --domain educational
```

ตัวเลือกทั้งหมด พร้อมกฎของ card-id: `champollion network register-corpus --help`

---

## seal-corpus

`champollion network seal-corpus <keygen|seal|open|sign-keygen|sign|verify>` (ใช้งานในชื่อ `champollion seal-corpus` ได้เช่นกัน) การเข้ารหัสสำหรับระดับการเปิดเผยข้อมูลแบบปิดผนึก (X25519-ECDH → HKDF-SHA256 → AES-256-GCM): `keygen` จะสร้างคู่คีย์ตัวแทนเดี่ยว (ไม่ใช่คีย์กลุ่มแบบ M-of-N — ผู้ใดก็ตามที่ถือไฟล์ไพรเวตคีย์สามารถถอดรหัสได้โดยลำพัง), `seal` เข้ารหัสคลังข้อมูลบนเครื่องนี้, `open` ถอดรหัสอาร์ติแฟกต์ที่ปิดผนึกไว้ในบริบทการประเมินที่มีการควบคุม และ `sign-keygen` / `sign` / `verify` จะลงนามชุดคะแนนสำหรับการส่งต่อแบบแยกขาดจากเครือข่าย (air-gapped transport) (คีย์ลงนามของโหนดเดี่ยว) โดยโหนดผู้จัด `mt-eval` จะเรียกใช้งานเชลล์มาที่นี่แทนที่จะเขียนกระบวนการเข้ารหัสขึ้นมาใหม่

```bash
champollion network seal-corpus keygen --out ~/.contest-keys
```

ตัวเลือกทั้งหมด: `champollion network seal-corpus --help`

---

## submit

`champollion network submit` (ใช้งานในชื่อ `champollion submit` ได้เช่นกัน) เสนอรายการสำหรับบรรจุลงในดัชนีผ่านกระบวนการที่มีการกลั่นกรอง: คำสั่งจะรวบรวมฟิลด์สำหรับประเภทการส่งข้อมูล 1 ใน 6 ประเภท (`dataset`, `resource`, `method`, `human-service`, `external-result`, `card-correction`) และพิมพ์ URL ของ GitHub issue ที่กรอกข้อมูลไว้ล่วงหน้า ซึ่งผู้ดูแลจะตรวจสอบเทียบกับกฎด้านสัญญาอนุญาตและอธิปไตยทางข้อมูล จะไม่มีการอนุมัติสิ่งใดโดยอัตโนมัติ และไม่มีการเขียนลงในรีจิสทรีหรือฐานข้อมูลเด็ดขาด

```bash
champollion network submit --list
champollion network submit --yes --type dataset --attest --field dataset-name="GlobalVoices eng-amh" --field pairs=eng-amh --field license=CC-BY-4.0 --field source-url=https://globalvoices.org
```

ตัวเลือกทั้งหมด: `champollion network submit --help`

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

---

## serve

ให้บริการสแตกการแปลของโปรเจกต์นี้เอง (method, ระดับภาษา, การแนะนำโค้ชชิ่ง, Translation Memory, เกตคุณภาพ) ผ่าน HTTP ตามข้อกำหนดสัญญาที่ method `api` ใช้งาน เพื่อให้โปรเจกต์ Champollion อื่นสามารถชี้ `"method": "api"` มาที่นี่ได้ คำขอจะทำงานผ่านไปป์ไลน์ที่ `sync` ใช้: หากพบข้อมูลใน Translation Memory จะให้บริการโดยตรงจากแคชโดยไม่มีค่าใช้จ่าย และกรณีที่ไม่ผ่านเกตคุณภาพจะส่งข้อผิดพลาดกลับมารายคีย์ โดยไม่มีการส่งผลลัพธ์ที่ด้อยคุณภาพกลับไปเด็ดขาด

ค่าเริ่มต้นจะผูกกับ `127.0.0.1`: ใครก็ตามที่เข้าถึงพอร์ตนี้ได้จะสามารถใช้จ่ายงบประมาณ API ต้นทางของคุณได้ ดังนั้นการเปิดพอร์ตสู่ภายนอกจึงเป็นการตัดสินใจที่ต้องระบุอย่างชัดเจน (`--bind 0.0.0.0`) และต้องใช้ bearer token โดย `--no-auth` จะยอมรับได้เฉพาะกับการผูกแบบ loopback เท่านั้น

```bash
champollion serve --token my-strong-secret --max-session-cost 5
champollion serve --no-auth --bind 127.0.0.1     # this machine only, no token
champollion serve --emit-manifest --endpoint https://translate.example.org
```

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--port <n>` | พอร์ตที่รับฟัง (ค่าเริ่มต้น: 1822; 0 = สุ่มพอร์ตที่ว่าง) |
| `--bind <addr>` | แอดเดรสที่ผูก (ค่าเริ่มต้น: `127.0.0.1`; `--bind 0.0.0.0` จะเปิดเซิร์ฟเวอร์สู่ภายนอกและจำเป็นต้องใช้โทเค็น) |
| `--token <secret>` | Bearer token ที่ผู้ใช้งานส่งมา (ค่าเริ่มต้น: `CHAMPOLLION_SERVE_TOKEN` จากสภาพแวดล้อม หรือ `.env.local`; ต้องมีอย่างน้อย 12 อักขระ) |
| `--no-auth` | ไม่มีการตรวจสอบสิทธิ์ — จะถูกปฏิเสธเว้นแต่จะผูกแบบ loopback |
| `--rate-limit <n>` | จำนวนคำขอต่อนาทีต่อ IP ไคลเอนต์ (ค่าเริ่มต้น: 120; 0 คือปิดใช้งาน) |
| `--max-body-bytes <n>` | ขีดจำกัดขนาดเนื้อหาคำขอ (body) เป็นไบต์ (ค่าเริ่มต้น: 1000000) |
| `--max-cost-per-request <usd>` | ปฏิเสธคำขอที่ประมาณการต้นทุนต้นทางสูงเกินกว่าค่านี้ (หากไม่ทราบราคาก็จะปฏิเสธเช่นกัน) |
| `--max-session-cost <usd>` | เพดานการใช้จ่ายโดยประมาณสำหรับโพรเซสของเซิร์ฟเวอร์นี้ คำขอที่เกินจากนี้จะถูกปฏิเสธ (402) |
| `--name <kebab-case>` | ชื่อ method ที่ให้บริการ (ค่าเริ่มต้น: จากไดเรกทอรีโปรเจกต์) |
| `--pair <src:tgt>` | ให้บริการเฉพาะคู่ภาษาที่กำหนดค่าเหล่านี้ โดยคั่นด้วยเครื่องหมายจุลภาค |
| `--emit-manifest` | เขียน `method.json` ที่ผู้ใช้งานติดตั้ง จากนั้นออกจากโปรแกรม (ไม่เปิดเซิร์ฟเวอร์) |
| `--endpoint <url>` | เอนด์พอยต์ที่ผู้ใช้งานเข้าถึงได้สำหรับ `--emit-manifest` (ค่าเริ่มต้น: `http://127.0.0.1:<port>/translate`) |
| `--out <path>` | ตำแหน่งที่ `--emit-manifest` จะเขียนไฟล์ (ค่าเริ่มต้น: `./<name>/method.json`) |

---

## models

```bash
champollion models --method gemini      # list Gemini models
champollion models --method openai --json
champollion models check                # every default model against the providers' live lists (free)
```

แสดงรายการโมเดลที่ API ของผู้ให้บริการมีให้ (อ่านอย่างเดียว ไม่มีการแก้ไขค่าคอนฟิก) `champollion models check` จะตรวจสอบโมเดลเริ่มต้นทุกโมเดล (`shared/model-defaults.json`) เทียบกับรายการสดของผู้ให้บริการ และจะออกจากโปรแกรมด้วยรหัส 1 หากมีโมเดลใดหายไป ทั้งนี้เอนด์พอยต์แสดงรายการไม่มีการคิดค่าบริการ

| ตัวเลือก | ผลการทำงาน |
|--------|--------|
| `--method <name>` | ผู้ให้บริการที่จะสอบถาม: `gemini`, `openai` หรือ `anthropic` (จำเป็น ยกเว้นสำหรับ `check`) |
| `--json` | ข้อมูล JSON ที่เครื่องอ่านได้ (หนึ่งเอกสาร) |

---

## doctor

```bash
champollion doctor                  # every check
champollion doctor cards            # language card diagnostics
champollion doctor fst crk          # the Plains Cree FST
champollion doctor --json
```

การตรวจสุขภาพสำหรับการติดตั้ง: การ์ดภาษา คอนฟิกของโปรเจกต์ การติดตั้ง FST คีย์ API และการพึ่งพาของ method คำสั่งนี้จะรันการตรวจสอบทั้งหมดตามค่าเริ่มต้น ส่วนคำสั่งย่อยจะรันการตรวจสอบเพียงรายการเดียว

| คำสั่งย่อย | การตรวจสอบ |
|------------|--------|
| `cards` | การ์ดภาษาโหลดได้อย่างถูกต้อง; สถิติความครอบคลุม |
| `config` | ไฟล์คอนฟิกของโปรเจกต์และวิธีจำแนกแปลงรหัสภาษา |
| `fst [code]` | การติดตั้ง FST (ทั้งหมด หรือภาษาเดียว) |
| `methods` | คีย์ API (ตรวจสอบว่ามีการตั้งค่าไว้แต่ละคีย์; สำหรับคีย์ OpenRouter จะส่งไปยังเอนด์พอยต์ตรวจสอบคีย์ฟรีของ OpenRouter ซึ่งจะปฏิเสธคีย์ที่ไม่ถูกต้อง), ความสามารถในการเข้าถึงเซิร์ฟเวอร์, แพ็กเกจ Python |

`--json` พิมพ์เอกสารหนึ่งชุดพร้อมผลลัพธ์ของการตรวจสอบทุกรายการ

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
