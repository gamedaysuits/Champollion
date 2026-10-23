---
sidebar_position: 1
title: "مرجع CLI"
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

# مرجع واجهة سطر الأوامر (CLI)

## الأوامر

تعمل الأوامر التي تبني الترجمة الآلية للغةٍ ما — المسارات — على مجلد مشروع ينشئه `champollion new`:

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

الأوامر التي تترجم ملفات تطبيق أو موقع ويب:

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

الأوامر التي تعمل مع الفهرس المشترك ولوحة الصدارة (leaderboard)، بدلاً من العمل مع
مشروعك، مجمعة تحت `champollion network`. ويعمل كل منها أيضاً بدون
البادئة:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

قم بتشغيل `champollion <command> --help` للحصول على مساعدة تفصيلية حول أي أمر
(`champollion network` يعرض قائمة بأوامر الشبكة).

## الخيارات العامة

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

### كتابة زوج لغوي

يُكتب زوج لغات المشروع بالطريقة التي يحدده بها `champollion.config.json` مفتاحاً: `en:fr`. يقرأ كل من `sync` و`verify` و`serve` أيضاً `en>fr` و`en-fr`، وتتم مطابقة `en-pt-BR` مع الأزواج التي قمت بتكوينها. تكتب أوامر الشبكة (`network register-corpus`، `leaderboard`، `recommend`، `submit`) الزوج بالصيغة `eng>crk`، وهي الصيغة التي تخزن بها لوحة الصدارة ويستخدمها `mt-eval`، وتقرأ `eng-crk` و`eng:crk` بالطريقة نفسها. باستخدام الشرطات فقط، يكون الزوج عبارة عن رمزين يتألف كل منهما من حرفين أو ثلاثة أحرف (`eng-crk`). أما الرمز الذي يحتوي على شرطة خاصة به فيتطلب `>`: `--pair "eng>pt-BR"`. يتم رفض `eng-pt-BR` ولا يتم تخمينه أبداً. ضع الصيغة `>` بين علامتي اقتباس في سطر الأوامر (shell): فبدون اقتباس، يقوم `--pair eng>crk` بتوجيه المخرجات إلى ملف باسم `crk`.

---

## new

يبدأ مشروع ترجمة آلية على المسارات: مجلد واحد يحتوي على موضعٍ مخصص لكل شيء.

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry   # say the direction back; writes nothing
champollion new family --from English --to qaa --target-name "Our language"
champollion new school-crk --from eng --to "Plains Cree" --purpose "school newsletter"
```

يكتب ما يلي:

- `champollion.project.json` — قرارات المشروع ([project/1](/docs/reference/formats#project1)): الزوج اللغوي، والغرض منه، والإعدادات الافتراضية التي تحصل عليها البيانات الجديدة (`local-only`؛ درجات التدريب والمشاركة: `ask`).
- المجلدات `data/parallel/` و`data/test/` و`data/lexicon/` و`data/grammar/` و`data/monolingual/` و`consent/` و`inbox/`.
- `README.md` (ما يوضع في كل مكان)، و`.gitignore` (يمنع رفع `data/` إلى أي مستودع تدفعه)، و`NEXT.md` (الخطوة التالية)، و`AGENTS.md` — القواعد التي يتبعها وكيل الذكاء الاصطناعي العامل في المجلد، أي [عقد التشغيل](/docs/agents/contract). لا يتم استبدال `.gitignore` أو `AGENTS.md` موجودين على الإطلاق.

اللغات تكون في صورة رموز أو أسماء، وتُحل عبر بطاقات اللغات. والاسم الذي تسجله بطاقة للغتها تحت اسم آخر يُذكر مع مصدره (`"Blackfoot" is another name for this language … Siksika (bla)`)؛ والاسم الذي تشترك فيه عدة لغات يُرفض مع عرض الخيارات، ولا يُختار تلقائياً أبداً. أما رمز الاستخدام الخاص (`qaa`–`qtz`) لضربٍ لغوي ليس له رمز، فيتطلب الاسم الذي يستخدمه أهله (`--target-name`، `--source-name`). لا تدعم المسارات حتى الآن سوى مشاريع `language`. وأي مجلد يمثل مشروعاً بالفعل، أو يحتوي على ملفات مسبقاً، يُرفض.

| الخيار | التأثير |
|--------|--------|
| `--from <language>` | لغة المصدر (رمز أو اسم) |
| `--to <language>` | اللغة الهدف (رمز أو اسم) |
| `--name <text>` | اسم المشروع (الافتراضي: `<source> → <target>`) |
| `--purpose <text>` | الغرض من الترجمات، بكلماتك الخاصة |
| `--target-name <text>` | اسم اللغة الهدف كما ينطق به أهلها (مطلوب لـ `qaa`–`qtz`) |
| `--source-name <text>` | اسم لغة المصدر (لمصدر ذي استخدام خاص) |
| `--dry` | ذكر اتجاه الترجمة (`… goes in, … comes out`) دون كتابة أي شيء |
| `--json` | ملف المشروع، واللغات بعد حلها، والخطوة الأولى، بصيغة JSON |

---

## next

سؤال المسارات الوحيد: ماذا نفعل الآن؟

```bash
champollion next                  # in the project folder
champollion next family --json    # for an agent
champollion next --write          # also rewrite NEXT.md
```

يقرأ ملفات المشروع (دون قراءة نصوص ملفات البيانات أبداً)، ويتتبع مساره، ويطبع الخطوة التالية المحددة: ما يجب إخباره للشخص، والسبب، والأمر الدقيق عند وجوده، وكيفية اتخاذ هذه الخطوة:

| الوضع | الكيفية |
|------|-----|
| `auto` | يجوز للوكيل تشغيل الأمر |
| `confirm` | لا يُشغّل إلا بعد موافقة الشخص (التثبيت، الإنفاق، التدريب) |
| `ask_user` | يجيب أصحاب البيانات؛ لا تجب نيابةً عنهم أبداً |
| `wait` | هناك عملية قيد التشغيل؛ اسأل مجدداً لاحقاً |
| `human_only` | لا يمكن إلا لشخص القيام بذلك (جمع الجمل، اختيار نموذج) |

بالنسبة لمراحل التدريب، فإنه ينقل توجيهات المستشار الخاص بأداة nmt-forge (`nmt-forge status`، بحد أقصى 60 ثانية). وهو للقراءة فقط: لا يكتب أي شيء ما لم يُحدد `--write` (حينها يعيد كتابة `NEXT.md`).

| الخيار | التأثير |
|--------|--------|
| `--json` | الخطوة بصيغة JSON (للوكلاء) |
| `--write` | إعادة كتابة `NEXT.md` أيضاً |

---

## data

يجلب الملفات التي يحتفظ بها المجتمع إلى المشروع، ويسجل ما قرره أصحابها، ويدمج ملفات الأزواج اللغوية في الملف الوحيد الذي يعتمد عليه التدريب. يُشغّل داخل المشروع.

### data add

```bash
champollion data add inbox/grandpa.xlsx
champollion data add inbox/list.txt --source-col A --target-col B
champollion data add inbox/checked.docx --into test
```

يحول ملفاً يحتفظ به المجتمع إلى الصيغة التي تقرأها جميع الأدوات: جدول بيانات (`.xlsx`، `.ods`، `.csv`)، أو `.tsv` أو `.txt`، أو جدول في مستند Word `.docx`، أو معجم Toolbox/MDF أو LIFT (FieldWorks/FLEx) — حيث تتحول شروحاته إلى قائمة كلمات باستخدام `--into lexicon`، وتتحول جمله التوضيحية إلى أزواج لغوية. يوفّر ملف ELAN (`.eaf`) أزواجاً من طبقتين يربطهما ELAN، متطابقتين باللغات المذكورة فيهما أو عبر معرفات الطبقات `--source-col`/`--target-col`. لا تُجلب نصوص USFM الدينية إلا عند الطلب: يحدد `--usfm-source` نص اللغة الأخرى، وتصبح الآيات ذات الأرقام المتطابقة في كليهما أزواجاً؛ وبما أن ترجمة النصوص الدينية تخضع عادةً لحقوق نشر خاصة بالناشر، فلا يتعلم أي نموذج منها حتى يوافق أصحابها على ذلك.

تؤخذ الأعمدة من صف الترويسة الذي يسمي اللغات، أو من `--source-col` و`--target-col`. لا يخمن أبداً من واقع الجمل ولا يطبع أي جملة: توصف الأعمدة بنسبة الامتلاء ونظام الكتابة. ويكتب `data/parallel/<name>.tsv` (أو `data/test/`، أو قائمة كلمات في `data/lexicon/`) مصحوباً بملف وصفي جانبي (sidecar) يسجل مصدره؛ ويُطبق الإعداد الافتراضي للمشروع "محلي فقط" حتى يبت أصحاب البيانات في الأمر. ولا يُعدل الملف الأصلي أبداً.

| الخيار | التأثير |
|--------|--------|
| `--into <parallel\|test\|lexicon>` | موضع حفظ الأزواج (الافتراضي `parallel`؛ `lexicon` = قائمة كلمات) |
| `--source-col <col>` | عمود المصدر: حرف أو رقم أو ترويسته (معرف طبقة ELAN لـ `.eaf`؛ رمز لغة لـ LIFT) |
| `--target-col <col>` | عمود الهدف |
| `--sheet <name\|n>` | ورقة العمل أو الجدول المطلوب، عند وجود أكثر من واحد |
| `--header` / `--no-header` | تحديد ما إذا كان الصف الأول ترويسة أم لا |
| `--usfm-source <file\|folder>` | نصوص USFM الدينية: نص اللغة الأخرى، مقترناً آية بآية |
| `--name <stem>` | اسم الملف المكتوب |

### data mark

```bash
champollion data mark data/parallel/pairs.tsv --owner "the family" --training allowed --local-only
champollion data mark data/test/checked.tsv --role test --local-only
```

يسجل ما قرره الأشخاص أصحاب ملف البيانات، في الملف الوصفي الجانبي (sidecar) المرفق به (`<file>.champollion.json`، [set/1](/docs/reference/formats#set1)) والذي تلتزم به أدوات mt-eval وnmt-forge وخادم MCP. والملف الذي لم يكن محدداً بالفعل على أنه "محلي فقط" يتطلب `--local-only` أو `--may-leave`: فمسألة إمكانية إرسال نصه إلى خدمة ذكاء اصطناعي خارجية من عدمها تعود لقرار أصحابه، لذا لا يتم افتراضها أبداً.

لا يتجه الملف الوصفي الجانبي إلا نحو مزيد من التشدد: لا يمكن تحويل "محلي فقط" إلى "يجوز خروجه"، ولا يمكن تحويل التدريب `not-allowed` إلى `allowed`، وتحتفظ مجموعة الاختبار أو المجموعة المختومة بدورها ولا يُدرب عليها أبداً. وتتمثل الاستثناءات في الإجابة الأولى للأصحاب رداً على الإجراء الاحترازي للأداة: علامة "محلي فقط" `data add` المطبقة بناءً على الوضع الافتراضي للمشروع (حيث يرفعها أول `--may-leave`)، و`not-allowed` التي طُبقت على النصوص الدينية، و`--speakers-agreed yes --training allowed` بمجرد موافقة الأشخاص الذين كانت حالتهم `not-yet`. وأي تخفيف آخر للشروط لا يتم إلا بتعديل يدوي يجريه أصحاب البيانات بأنفسهم.

| الخيار | التأثير |
|--------|--------|
| `--local-only` | لا يجوز لأي نموذج الاطلاع على النص باستثناء نموذج موجود على هذا الحاسوب |
| `--may-leave` | يسمح أصحاب البيانات بإرسال النص إلى خدمات خارجية |
| `--training <allowed\|not-allowed>` | ما إذا كان يجوز للنموذج التعلم منه |
| `--role <role>` | `train` أو `dev` أو `test` أو `sealed` أو `input` أو `resource` |
| `--kind <kind>` | `parallel` أو `monolingual` أو `lexicon` أو `grammar` أو `glossary` |
| `--owner <text>` | أصحاب البيانات، بكلماتهم الخاصة |
| `--speakers <text>` | من تعود له كلمات الملف — من قالها أو كتبها |
| `--speakers-agreed <yes\|not-yet\|some-said-no>` | ما إذا كانوا قد وافقوا؛ تمنع `not-yet` و`some-said-no` دخوله في التدريب |
| `--consent-record <path>` | الملاحظة التي تسجل من وافق على ماذا |
| `--json` | طباعة الملف الوصفي الجانبي المكتوب بصيغة JSON |

### data combine

```bash
champollion data combine
champollion data combine --name all-pairs
```

يدمج جميع ملفات الأزواج اللغوية في `data/parallel/` في الملف الوحيد الذي يعتمد عليه التدريب، مع استبعاد التكرارات المتطابقة. ويحتفظ ملفه الوصفي الجانبي بأكثر الشروط تشدداً بين الملفات (محلي فقط إذا كان أحدها كذلك؛ مع تسمية كل أصحاب البيانات). وتُنقل الملفات الأصلية إلى `data/combined-from/`؛ ولا يُحذف أي شيء. والملف الذي ذكر أصحابه أنه لا يجوز لأي نموذج التعلم منه لا يتم دمجه: بل يُنقل إلى `data/not-for-training/`، ويُحتفظ به دون أن يتعلم منه أي نموذج. ويحدد `--name <stem>` اسم الملف المدمج.

---

## improve

يعمل على تحسين النموذج المستخدم، جولة تلو الأخرى، مع تقييم كل جولة بناءً على مجموعة التدريب العملي (dev). يُشغّل داخل المشروع؛ ويوضح `champollion next` الخطوة الحالية.

```bash
champollion improve time --per-week "two evenings" --total "until the spring"
champollion improve wishlist --prompts 30
champollion improve sheet
champollion improve marks
champollion improve prepare
champollion improve report
champollion improve status --json
```

الجولة الواحدة: يكتب الأشخاص الجمل التي يريدون ترجمتها، جملة في كل سطر، في `improve/round-<k>/to-translate.txt`؛ ويقوم النموذج قيد الاستخدام بصياغة مسودات لها في ورقة؛ ثم يضع المتحدث علامة أمام كل مسودة: Y (صحيحة)، أو N (خاطئة — مع كتابة العبارة الصحيحة)، أو ؟ (غير متأكد)؛ وتتحول المسودات المؤكدة والتصحيحات إلى أزواج تدريب جديدة؛ ثم يُفحص ملف التدريب ويُدرب النموذج مرة أخرى. تقارن أداة forge بعد ذلك النموذج الجديد بالنموذج قيد الاستخدام على جمل dev نفسها، ولا تضعه قيد الاستخدام إلا إذا كان أفضل بشكل قابل للقياس. تُرقم الجولات بناءً على أحكام forge حتى تلك اللحظة، وتُحفظ ملفاتها في `improve/round-<k>/`. ما يظهر على الشاشة: أعداد وكلمات بسيطة، دون عرض أي جملة — فالأوراق هي التي تحتوي على الجمل، داخل مجلد المشروع.

| الأمر الفرعي | ما يفعله |
|------------|--------------|
| `time` | يسجل مقدار الوقت الذي يمكن للمتحدث تخصيصه، أسبوعياً وفي المجمل، تماماً كما ذكره (`improve/time.json`)؛ وتُخطط كل جولة بناءً عليه |
| `wishlist` | ورقة قابلة للطباعة تتضمن ما يجب كتابته لاحقاً (`improve/round-<k>/wishlist.md`): كلمات لم يرها النموذج من قبل، وأنواع الجمل التي يخطئ فيها في dev، وتوجيهات مفتوحة (`nmt-forge wishlist`) |
| `sheet` | يضع النموذج المستضاف على هذا الحاسوب مسودات لجمل الجولة في `review.csv` لتقييمها من قِبل المتحدث؛ وطالما أن مجموعة التدريب العملي (dev) صغيرة، يترك سطر من كل أربعة أسطر دون مسودة — ليكتبه المتحدث، مما يوسع مجموعة التدريب العملي |
| `marks` | يقرأ علامات المتحدث: كم عدد المسودات الصحيحة (مع مجال ثقة 95%)، والمسودات المؤكدة والتصحيحات كأزواج تدريب جديدة (تُضاف كما يضيف `data add` ملفاً)، وأسطر التدريب العملي بصيغة `data/dev/` |
| `prepare` | ملف التدريب الخاص بهذه الجولة (`data/split/train-r<k>.jsonl`)، بعد تصفيته مقارنة بمجموعة الاختبار واستبعاد جمل dev؛ وتوسيع مجموعة التدريب العملي (`nmt-forge grow-dev`)؛ وتوجيه `config.json` إليه |
| `report` | تقرير الجولة (`improve/round-<k>/report.json`): التقدم المحرز، مع ذكر كل رقم بوحدته؛ والتأكد من أن التحسينات حقيقية؛ والتوقعات المستقبلية؛ وما يجب فعله بعد ذلك |
| `status` | الجولات حتى الآن: علامات المتحدث وحكم forge لكل جولة |

| الخيار | التأثير |
|--------|--------|
| `--per-week <text>` | `time`: الوقت الذي يستطيع المتحدث تقديمه أسبوعياً، بكلماته الخاصة (مطلوب) |
| `--total <text>` | `time`: إجمالي الوقت الذي يستطيع المتحدث تقديمه، بكلماته الخاصة (مطلوب) |
| `--prompts <n>` | `wishlist`: عدد التوجيهات التي تحتوي عليها الورقة (الافتراضي 40، حوالي جلسة واحدة) |
| `--json` | `report`، `status`: الطباعة بصيغة JSON |

---

## validate

```bash
champollion validate                  # the current folder
champollion validate family --json    # one project, machine-readable
```

يتحقق من ملفات المشروع مقارنةً بمخططات إطار العمل ([الصيغ](/docs/reference/formats)) التي تقرأها أداتا mt-eval وnmt-forge أيضاً: `champollion.project.json`، وكل ملف وصفي جانبي للبيانات (`<file>.champollion.json`) داخل المجلد، وكل `method.json` (في جذره، وفي `methods/*/` و`.champollion/methods/*/`)، وسلاسل بوابات التحقق (`gates/*.json`) وعمليات النشر الخاصة به (`deploy/*.json`). ولا يفتح إلا ملفات JSON الصغيرة هذه، ولا يفتح أبداً أي ملف بيانات. ويظل الملف الوصفي الجانبي المكتوب قبل set/1 صالحاً؛ أما أي مفتاح يرفضه set/1 فيُبلّغ عنه كتحذير.

رموز الخروج: 0 صالح (يُسمح بالتحذيرات)، 1 وجود مستند غير صالح، 2 خطأ في الاستخدام. يطبع `--json` التقرير الكامل.

---

## upgrade

```bash
champollion upgrade --dry         # say what would change; write nothing
champollion upgrade family
```

يعيد كتابة ملفات إطار العمل القديمة للمشروع بالصيغة المشتركة بين جميع الأدوات حالياً، دون فقدان أي شيء. يتحول الملف الوصفي الجانبي للبيانات المكتوب قبل set/1 إلى صيغة set/1: مع الاحتفاظ بكل قيمة، ونقل أي مفتاح لا يتعرف عليه set/1 تحت `x-<key>`. ويُترك الملف الوصفي الجانبي غير الصالح ليصلحه شخص ما (يوضح `champollion validate` موضع الخطأ). ويُدرج أي `method.json` مكتوب قبل method/1 ويُحتفظ به كما هو — فبنيته القديمة لا تزال تحمل إعدادات تقرأها الأدوات منه. لا يُحذف أي شيء. ويطبع `--json` التقرير.

---

## connect

```bash
champollion connect ../family/export/model --app .
champollion connect ../family/export --app ../school-site --holders-agreed-by "Grandpa"
```

يدرج نموذجاً مُستضافاً في مشروع تطبيق أو موقع ويب، بحيث يُترجم `sync` باستخدامه. يكون النموذج تصديراً من forge (مجلده أو مجلد `model/` التابع له) أو أي `method.json`. يُثبت في `.champollion/methods/` الخاص بالتطبيق، وتُشير أزواج التطبيق إليه (`"methodPlugin"`)؛ مع الاحتفاظ بأي خيار بديل (fallback) أو أسلوب لغوي (register) موجود بالفعل لدى الزوج.

النموذج الذي تعلم من جمل محددة بأنها "محلي فقط" (أو لم يُسجل تدريبه)، أو الخدمة التي ينص `/health` الخاص بها على أن مخرجاتها "محلي فقط"، يمكنهما تكرار هذه الجمل — وتُنشر ملفات ترجمة التطبيق (locale files) مع التطبيق نفسه. لذا لا يتم ربطه إلا باستخدام `--holders-agreed-by`: من وافق من أصحاب البيانات، مع تسجيل ذلك على الزوج (`"holdersAgreed"`، مع ذكر الطريقة). اسألهم؛ ولا تجب نيابةً عنهم أبداً. ويخضع `sync` أي إجابة "محلي فقط" للقاعدة نفسها: فبدون الموافقة، لا يُكتب أي شيء منها.

| الخيار | التأثير |
|--------|--------|
| `--app <folder>` | مشروع التطبيق أو موقع الويب (الافتراضي: هذا المجلد) |
| `--holders-agreed-by <who>` | للنموذج "المحلي فقط": من وافق من أصحاب البيانات |
| `--json` | طباعة ما تم ربطه بصيغة JSON |

---

## init

معالج إعداد تفاعلي يقوم بإنشاء `champollion.config.json`. يرشدك عبر اللغة المصدر، واللغات المستهدفة، وتنسيق الملف، ونموذج الترجمة.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**خيار `--content-dir`**: مجلد لملفات Markdown/MDX المراد ترجمتها جنباً إلى جنب مع ملفات الترجمة المحلية (تُكتب كـ `contentDir`). يجب أن يكون المجلد موجوداً؛ حيث يتوقف `init` دون كتابة أي شيء إذا لم يكن موجوداً.

**المشروع الذي يحتوي على ملف محلي فقط يعتمد افتراضياً على `local`**: الطريقة الافتراضية هي `llm` (OpenRouter، وهي خدمة مستضافة). عندما يتم تمييز ملف في أي مكان بالمشروع على أنه محلي فقط — بوجود `<file>.champollion.json` بجانبه مع `"transmission": "local-only"`، كما يكتب `champollion network register-corpus --data <file> --tier local-only` — فإن `init` (وكذلك مع `--yes`) يعتمد افتراضياً على طريقة `local` بدلاً من ذلك: نموذج تتم استضافته على هذا الجهاز (خيار Ollama الافتراضي `http://localhost:11434/v1`، أو الخادم الذي يحدده `LOCAL_API_BASE`). ويذكر السبب، مع تسمية الملف المحدد، وكيفية اختيار طريقة مستضافة عن قصد: `champollion init --force --method llm --model <model>`. التحديد الصريح عبر `--method` له الأولوية دائماً؛ ويقوم `init` حينئذٍ بتسجيل ملاحظة حول الملف المحدد بجانب المكان الذي يُرسل إليه النص.

**تشغيل `init` مرة أخرى (`--force`)**: بدون `--force`، يتوقف `init` عند وجود `champollion.config.json`. وبوجوده، يبدأ `init` من ذلك الملف ويعيد كتابة ما تحدده الخيارات فقط: `--langs` يحدد قائمة اللغات المستهدفة (تحتفظ اللغة الموجودة بالفعل ببياناتها — السجل الأسلوبي، ونظام الكتابة، والاسم)، و`--method` يحدد الطريقة الافتراضية (والنموذج المقترن بها، ما لم يحدد `--model` نموذجاً)، و`--model`، `--temperature`، `--source`، `--dir`، `--format`، `--content-dir`، `--script`، `--name`، و`--method api` الأزواج التي يسميها. لا يعيد اكتشاف تخطيط ملفات الترجمة المحلية إلا عندما يعجز الملف عن العثور على ملفات المصدر (أو عند تحديد مجلد آخر عبر `--dir`). تبقى جميع الإعدادات الأخرى — `batchSize`، `pairs`، `glossary`، والخيارات البديلة، والسجلات الأسلوبية التي اخترتها — كما كانت. ويقوم بطباعة كل حقل قام بتغييره والحقول التي احتفظ بها، وينسخ الملف السابق أولاً إلى `champollion.config.json.bak` (وعندما تحتوي تلك النسخة الاحتياطية بالفعل على ملف أقدم، تكون النسخة التالية `.bak.2`، `.bak.3` …؛ ولا يتم استبدال نسخة احتياطية أقدم أبداً). الملف الذي لا يمثل JSON صالحاً لا يمكن الاحتفاظ به: حيث يتم أخذ نسخة احتياطية منه وكتابة ملف جديد. لتغيير إعداد واحد، قم بتعديله في الملف مباشرةً — فلا داعي إطلاقاً لتشغيل `init` مجدداً من أجل ذلك.

**العثور على ملفات الترجمة المحلية**: يبحث `init` عن ملف اللغة المصدر قبل أن يكتب أي شيء. يتحقق أولاً من المجلد المعتاد لإطار العمل الخاص بك (next-intl `messages/`، i18next `public/locales/<lang>/` ثم `locales/<lang>/`، vue-i18n `src/locales/`، Hugo `i18n/`)، ثم `locales`، `messages`، `i18n`، `lang`، `translations`، `public/locales`، `src/locales` و`src/i18n`، ويطبع ما عثر عليه. لا يكتب أبداً `localesDir` غير موجود. راجع [تخطيطات ملفات الترجمة المحلية](/docs/getting-started/configuration#locale-layouts).

**خيار `--langs`**: قائمة برموز اللغات المستهدفة مفصولة بفواصل. يتخطى المطالبة باختيار اللغة ويطبق الإعداد المسبق للسجل الأسلوبي الافتراضي لكل لغة — ويُكتب في ملف التكوين، بحيث يكون الاختيار مرئياً وقابلاً للتعديل: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (يمكنك تغيير أي منها إلى إعداد مسبق آخر، أو إلى كلماتك الخاصة لوصف النبرة؛ وتُكتب اللغة التي ليس لها إعدادات مسبقة كـ `{}`). كما ينشئ الملفات المستهدفة الفارغة في التخطيط الخاص بك (`fr.json`، أو `fr/common.json` لكل مساحة أسماء). ادمجه مع `--yes` لإعداد غير تفاعلي بالكامل.

**`--method api --endpoint <url>`**: خادم يتوافق مع ميثاق واجهة برمجة تطبيقات champollion — على سبيل المثال، نموذج قمت بتدريبه وتتم استضافته عبر `nmt-forge serve`. يكتب `init` زوجاً واحداً لكل هدف، وهو المدخل نفسه كـ `DEPLOY.md` بجوار النموذج: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. يحدد `--accepts-instructions true|false` ما إذا كانت نقطة النهاية تتبع تعليمات كل مفتاح على حدة (النموذج المدرب باستخدام nmt-forge لا يفعل ذلك)؛ وبدونه، يأخذ `init` القيمة من بيان إضافة مثبتة لنقطة النهاية نفسها (`.champollion/methods/<name>/method.json`)، أو يتركه غير محدد. ويتطلب `--langs` (يتم تعيين نقطة النهاية لكل زوج)، ومفتاحاً فقط لنقطة نهاية خارج هذا الجهاز (`CHAMPOLLION_API_KEY`). أضف طريقة `fallback` إلى الزوج يدوياً، كما يوضح `DEPLOY.md`.

**خيار `--script`**: تُكتب قلة من اللغات بأكثر من نظام كتابة إملائي حقيقي واحد — مثل لغة كري السهول (Plains Cree) (`crk`: `Latn` = الكتابة اللاتينية القياسية، `Cans` = المقاطع الصوتية)، والصربية (`sr`: `Latn`، `Cyrl`). لا يختار Champollion نظاماً نيابة عن المجتمع اللغوي: يرفض `sync` ترجمة مثل هذه اللغة حتى يحدد ملف التكوين أحد الأنظمة. يسأل المعالج عن ذلك؛ ومع `--yes`، مرر `--script crk=Cans` (لعدة خيارات: `--script crk=Cans,sr=Latn`؛ ومع لغة مستهدفة واحدة يكفي `--script Cans`)، مما يكتب `"languages": { "crk": { "script": "Cans" } }`. وبدونه، يوضح `init --yes` اللغات التي تحتاج إلى اختيار، ويسرد الخيارات، ويطبع سطر `"script"` لإضافته إلى مدخل تلك اللغة في ملف التكوين.

**خيار `--name`**: لا يمتلك الرمز المخصص للاستخدام الخاص (`qaa`–`qtz`، لمتغير لغوي ليس له رمز مؤكد) بطاقة لغة، لذا يوضح `init` ذلك بدلاً من مطالبتك بالتحقق من الإملاء. يمنحه `--name qaa="Ayta (variety not yet confirmed)"` اسم العرض الذي تستخدمه التوجيهات والتقارير، مكتوباً كـ `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (لعدة خيارات: `--name "qaa=…;qab=…"`). وإلى جانب كل سجل أسلوبي، يطبع `init` أيضاً إرشادات النوع الاجتماعي التي تحملها توجيهات نماذج اللغة الكبيرة (LLM) للغة المعنية ([إرشادات النوع الاجتماعي](/docs/getting-started/configuration#gender-guidance)).

**الإعدادات المسبقة للغات**: عند مطالبتك بتحديد اللغات المستهدفة، يمكنك كتابة أسماء الإعدادات المسبقة:
- `european` ← fr، de، es، it، pt، nl
- `asian` ← ja، zh، ko
- `global` ← fr، es، de، ja، zh، ko، pt، ar
- `nordic` ← da، fi، nb، sv

يمكنك الجمع بين الإعدادات المسبقة والرموز الفردية: `european, ja` ← fr، de، es، it، pt، nl، ja

---

## sync

يقوم بترجمة المفاتيح المفقودة والقديمة عبر جميع ملفات الترجمة المحلية. ويشغل التحقق بعد المزامنة افتراضياً.

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

**ذاكرة الترجمة**: افتراضياً، يقوم `sync` بتحميل `.champollion/tm.json` وتقديم ترجمات مخبأة مؤقتاً لقيم المصدر التي لم تتغير. إن تبديل النموذج لا يتخلص من ذلك: فالنص الذي تمت ترجمته بالفعل بموجب النموذج السابق يُعاد استخدامه دون أي تكلفة، وتوضح عملية المزامنة ذلك قبل تقدير التكلفة. لجعل النموذج الجديد يترجمها بدلاً من ذلك: `--redo all --fresh-on-model-change` — حيث يرسل المفاتيح التي ترجمها نموذج سابق، في حين يظل ما ترجمه النموذج الجديد بالفعل مأخوذاً من التخزين المؤقت (بمفرده، يؤثر `--fresh-on-model-change` فقط على المفاتيح التي تترجمها العملية على أي حال). استخدم `--no-tm` لتجاوز ذاكرة التخزين المؤقت تماماً (مفيد عند تصحيح أخطاء الجودة). راجع [ذاكرة الترجمة](/docs/concepts/translation-memory).

**تقدير التكلفة و`--max-cost`**: يسعر التقدير فقط ما ستتم فوترته في العملية الحالية. المفاتيح وحقول البيانات الوصفية (front-matter) وكتل Markdown الموجودة بالفعل في ذاكرة الترجمة تُسعر بـ $0، ويوضح الجدول ما توفره ذاكرة التخزين المؤقت. النموذج الذي تتم استضافته على هذا الجهاز (`local`، أو نقطة نهاية `api`، عند `localhost`/`127.0.0.1`/`::1`) يُظهر `$0 (local)` — أي لا توجد فاتورة API؛ ولا يتم احتساب عتادك واستهلاكك للطاقة. يقارن `--max-cost` بهذا الرقم. وإذا تجاوز الحد الأقصى، أو لم يتوفر تقدير (لطريقة ليس لها سعر منشور، مثل `local` الموجه إلى جهاز آخر)، تتوقف المزامنة قبل إجراء أي استدعاء لـ API وتخرج بالرمز `2`؛ ولا تتم ترجمة أو كتابة أي شيء. يوضح السطر الختامي عدد المفاتيح المرسلة إلى النموذج وعدد المفاتيح المأخوذة من ذاكرة التخزين المؤقت.

أسفل الجدول، يوضح سطر واحد المعدل الذي سُعِّر به الرقم ومصدره — بالنسبة لنموذج مستضاف، السعر لكل مليون رمز إدخال وإخراج من قائمة أسعار OpenRouter العامة، ووقت قراءتها (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`)؛ وبالنسبة لمزود مباشر (`openai`، `anthropic`، `gemini`) تُستخدم القائمة نفسها كبديل لسعر المزود الخاص، وعند تعذر قراءة القائمة (أو عدم احتوائها على سعر للنموذج) يتم استخدام نسخة محفوظة في champollion، مع تاريخ آخر فحص وسببه؛ وDeepL وGoogle وMicrosoft من أسعارها المنشورة لكل حرف، مع تاريخها. إنه مجرد تقدير: يوضح السطر عدد الرموز (أو الأحرف) المفترضة لكل مفتاح، وتعتمد الفاتورة على الأطوال الحقيقية. مع `--json`، يتضمن التقدير التفاصيل: `rate` لكل زوج و`rates` الخاص بالعملية (`inputPerMillion`، `outputPerMillion` أو `perMillionChars`، `tokensPerKey`، `from`، `url`، `fetchedAt` أو `verified`).

**معاينة الطلب**: يقوم `sync --dry --show-prompt [key]` بطباعة الطلب الدقيق الذي سيُرسل إلى طريقة الزوج — رسائل النظام والمستخدم (أو، بالنسبة لنقطة نهاية `api`، نص الطلب)، المنشأ بواسطة الكود الخاص بالطريقة، مع حجب مفاتيح API — ولا يرسل أي شيء. مع تحديد مفتاح (مسمى كما يسميه `--redo keys:`: `verb␄Open`، `common::nav.home`؛ ويمكن تقديم gettext msgid المحتوي على فاصلة بالكامل) فإنه يعرض طلب ذلك المفتاح سواء كان في قائمة الانتظار أم لا. وعندما لا ترسل عملية التشغيل الحقيقية أي شيء له (إذا كان محدثاً، أو مقدماً من ذاكرة التخزين المؤقت، أو محجوباً مؤقتاً)، يوضح ذلك ويسمي أمر `--redo keys:<key> --fresh` الذي كان سيرسله. وبدون تحديد مفتاح، يعرض أول دفعة سيرسلها كل ملف، أو يذكر أنه لن يتم إرسال أي شيء. هذه هي الطريقة للتحقق من وصول gettext `msgctxt`، أو تعليق `#.` أو وصف ARB إلى النموذج. يتم إرسال النص المصدر وحده إلى محركات الترجمة الآلية (DeepL، Google…)؛ وتوضح المعاينة ذلك. مع `--json` يكون كل طلب عبارة عن سطر `{"level": "event", "event": "request", …}`.

**التشغيل التجريبي**: لا يترجم `--dry` أي شيء ولا يكتب أي شيء، ولكنه يفحص ما ستفحصه العملية الحقيقية أولاً: عندما يكون المفتاح الذي تحتاجه الطريقة مفقوداً (`OPENROUTER_API_KEY`، `DEEPL_API_KEY`، …)، يحذر من أن العملية الحقيقية ستتوقف ويذكر اسم المتغير. يتحقق من تعيين المفتاح، وليس من صلاحية عمله: لا يتم إرسال شيء، لذا يمر أي عنصر نائب (placeholder). يظل يخرج برمز الخروج `0` — فالمعاينة لا تفشل أبداً (راجع [رموز الخروج](#sync-exit-codes)). وينطبق الشيء نفسه على `--max-cost`: لا يتوقف التشغيل التجريبي عند بلوغ الحد الأقصى، ولكن عندما يتجاوزه التقدير (أو يكون غير معروف) فإنه يذكر، مرة واحدة في النهاية، أن العملية الحقيقية ستتوقف هناك وتخرج بالرمز `2`. مع `--json` يكون كل سطر عبارة عن كائن JSON واحد مع `level` (`info`، `ok`، `event` على stdout؛ `warn`، `error` على stderr)، وآخر سطر على stdout هو الملخص، `{"level": "summary", "command": "sync", …}`، ويحمل `preflight: { ready, failures }`، مع حد أقصى `maxCost: { cap, estimatedCost, wouldStop, exitCode }`، و`realRun: { exitCode, wouldStop, reasons }` — وهو رمز الخروج الذي ستنتهي به العملية الحقيقية، بقدر ما يمكن للمعاينة معرفته (راجع [رموز الخروج](#sync-exit-codes)). قم بتشغيله مع المعلمات التي تستخدمها المزامنة الحقيقية (`--method`، `--model`): فبدونها يتحقق من الطريقة المحددة في ملف التكوين. لا يتسبب رمز الخروج الخاص بالتشغيل التجريبي مطلقاً في إفشال خطوة التكامل المستمر (CI)، لذا فإن تحذير `--max-cost` يوضح كيفية تقييد الخطوة: اقرأ `maxCost.wouldStop` (أو `realRun.exitCode`) من ملخص `--json` — على سبيل المثال `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. تفعل [خطوة الفحص في دليل CI](/docs/guides/ci-cd#check-before-sync) ذلك، وعند فشلها، تطبع السبب (`realRun.reasons`) بدلاً من رمز `false` مجرد. يعد `totalPluralGaps` الخاص بالتشغيل التجريبي رسائل الجمع على القرص التي تفتقر إلى صيغة تستخدمها اللغة والتي لن تطلبها العملية الحقيقية مجدداً، ويكون `verify` هو `{ "ran": false }` (لم يُكتب شيء، وبالتالي لم يتم التحقق من شيء).

**إعادة الترجمة**: يحدد `--redo` *ما يجب* إعادة ترجمته ويحدد `--fresh` *ما إذا كان سيتم الدفع مقابله*. بدون `--fresh`، يُسترجع أي شيء تحتفظ به ذاكرة التخزين المؤقت بالفعل مجاناً (ولا يزال يجتاز بوابة الجودة)؛ ومعه، تتم ترجمة كل ما هو مدرج في قائمة الانتظار من جديد وتتم فوترته. لا تزال الخيارات القديمة (`--force`، `--force-keys`، `--force-content`، `--retranslate`، `--no-tm`) تعمل وتعني تماماً ما يوضحه الجدول.

**حصر النطاق على ملفات محددة**: يقصر `--files` خطوة المحتوى على الملفات المطابقة، ويفرض `--redo files:<glob> --fresh` ترجمات جديدة للملفات المطابقة (وهي الحالة المتعمدة الوحيدة لإعادة الإنفاق). تطابق الأنماط المسارات التي تطبعها عملية المزامنة (نسبة إلى `contentDir`، `2026-10.md`) والمسار نفسه من جذر المشروع (`newsletter/2026-10.md`): يبقى `*` داخل المجلد ويعبر `**` بين المجلدات. يمكن تكرار كلا الخيارين. النمط الذي لا يطابق أي ملف يوقف التشغيل قبل إنفاق أي شيء. خطوة قيم المفاتيح (key-value) هي خطوة تزايدية بالفعل وتعمل كالمعتاد.

**الإخفاقات**: فشل ملف محتوى واحد لا يوقف الملفات الأخرى. يتم تسجيل الملفات التي نجحت وتخزين ترجماتها مؤقتاً، وتنتهي العملية بقائمة من الملفات الفاشلة وحالة كل منها. لا يظهر في سطر الملف أبداً `[OK]` إذا لم تتم ترجمة مفاتيح بداخله. يوضح ملخص الفشل، لكل مفتاح، ما ستفعله المزامنة التالية: تطلب مرة أخرى (لا توجد إجابة قابلة للاستخدام)، أو تطلب مرة أخرى إضافية (معلقة من عملية إعادة سابقة)، أو تحجبه مؤقتاً (تم رفضه بواسطة بوابة الجودة). تُحجب كتل Markdown وحقول البيانات الوصفية (front-matter) التي رفضتها البوابة بالطريقة نفسها، لكل صفحة؛ ويطلب `--redo files:<page>` أو `--redo content` ترجمتها مرة أخرى ([بوابة الجودة](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). رمز الخروج هو `0` (تم بنجاح تام)، أو `2` (جزئي: تم إنجاز بعض العمل، أو فشل شيء ما، أو حُجب، أو لم يجتز التحقق، أو كُتبت رسالة جمع بدون صيغة تستخدمها اللغة للأعداد العادية — أو تم إيقافه بواسطة `--max-cost` قبل إنفاق أي شيء) أو `1` (لم ينجح أي شيء).

**اكتشاف التغييرات**: يخزن champollion تجزئات SHA-256 في `.champollion.lock`. عندما تتغير قيم المصدر، تعيد المزامنة التالية ترجمة تلك المفاتيح تلقائياً. قم بتثبيت ملف القفل (commit) حتى يشارك جميع المطورين الخط الأساسي نفسه. يسجل ملف القفل أيضاً، لكل لغة مستهدفة، بصمة لكل قيمة كتبتها المزامنة (بحيث يتم التعرف على القيمة التي عدلها شخص ما والاحتفاظ بها أثناء عمليات الإعادة الشاملة — [تعديل الترجمات](/docs/guides/professional-translators#editing-key-value-files))، والمفاتيح التي لم تتمكن عملية الإعادة من إنهائها (**معلقة**: تطلبها المزامنة التالية مرة أخرى) والمفاتيح التي رفضتها بوابة الجودة (**محجوبة مؤقتاً**: لا يُعاد إرسالها إلى النموذج نفسه في المزامنة العادية — [بوابة الجودة](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**التعديلات اليدوية وعمليات الإعادة**: يحتفظ كل من `--redo all` و`--force` والتبديل بين النماذج بالقيم التي عدلها شخص ما، ويوضح أياً منها تم تعديله؛ ويؤدي `--redo keys:<key>` مع تسمية مفتاح إلى استبداله؛ ويعاد ترجمة المفتاح الذي تغير مصدره. تتم طباعة التعديل المستبدل وإلحاقه بـ `.champollion-replaced-edits.jsonl` (يتم تتبعه — قم بتثبيته مع ملف القفل).

**مفاتيح gettext ذات السياق**: يتكون المفتاح من `msgctxt` + U+0004 + `msgid`. تطبع التقارير الفاصل كـ `␄`، وهو ما يقبله كل من `--redo keys:` و`--force-keys` بدورهما؛ لكتابة واحد منها، اكتب `\x04`: `--redo 'keys:django::verb\x04Open'` (تحتفظ علامات الاقتباس المفردة بالشرطة المائلة العكسية). كلا الرسمين الإملائيين يعملان. تطبع أوامر الإصلاح الصيغة `␄`، متبوعة بتعليق سطر أوامر يسمي `\x04`.

**مفتاح مسمى لا يطابق أي شيء**: يفشل `--redo keys:` / `--force-keys` مع اسم لا يحتويه أي مفتاح مصدر (خطأ إملائي، أو msgid موجود بسياق فقط) برمز خروج 1. يسرد الخطأ المفاتيح الأقرب، بما في ذلك كل متغير سياق لذلك msgid، بكلتا الصياغتين. عند عدم تطابق أي من الأسماء، لا يتم تشغيل شيء. وعندما يتطابق بعضها، تتم إعادة تلك المفاتيح فقط، ثم تفشل العملية مع تسمية الباقي.

**مفتاح مسمى يُقدم من ذاكرة التخزين المؤقت**: بدون `--fresh`، تقدم عملية الإعادة ما تحتفظ به ذاكرة التخزين المؤقت (يُعاد فحصه دون تكلفة) وتذكر ذلك، مع أمر `--fresh` الذي يعيد سؤال النموذج وتكلفته.

**التوازي**: تعمل كل من ترجمة مفاتيح JSON وترجمة المحتوى بالتوازي. تُترجم لغات JSON المحلية في وقت واحد (افتراضياً: 200 لغة محلية متزامنة)، مع موازاة الدفعات داخل كل لغة محلية أيضاً (4 دفعات متزامنة). وتعمل ترجمة المحتوى (Markdown، MDX، تدوينات المدونة) في تجمع عناصر عمل مسطح (افتراضياً: 48 استدعاء API متزامناً). يمكنك التجاوز باستخدام `--json-concurrency`، أو `--content-concurrency`، أو `--concurrency` (يعين كليهما).

**المخرجات**: تعرض المزامنة شعار الإصدار، واكتشاف التنسيق/إطار العمل، وتقدير التكلفة، وأشرطة التقدم لكل لغة محلية:

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

يتم تحديث أشرطة التقدم في مكانها بعد كل دفعة (~80 مفتاحاً). استخدم `--quiet` للأخطاء/التحذيرات فقط، أو `--json` لمخرجات NDJSON قابلة للقراءة آلياً. كلا الخيارين يعطل شريط التقدم والشعار. مع `--json`، يصل حدث `cost` قبل بوابة `--max-cost`، ويصل حدث `file` لكل ملف محتوى ولغة محلية، ويختتم حدث `summary` كل عملية تشغيل.

### رموز الخروج {#sync-exit-codes}

| الرمز | التشغيل الحقيقي | التشغيل التجريبي (`--dry`) |
|------|------------|---------------------|
| `0` | تمت ترجمة كل ما هو مدرج في قائمة الانتظار والتحقق منه، أو لم يكن هناك شيء في قائمة الانتظار. | تم التشغيل — حتى لو ذكر أن العملية الحقيقية ستتوقف. |
| `2` | جزئي: تم إنجاز بعض العمل، ولكن فشل شيء ما، أو تم حجبه مؤقتاً أو لم يجتز التحقق، أو كُتبت رسالة جمع بدون صيغة تستخدمها اللغة للأعداد العادية. أيضاً: أوقف `--max-cost` العملية قبل إرسال أي شيء. | لا يحدث أبداً. |
| `1` | لم ينجح أي شيء، أو تعذر بدء العملية: مفتاح تحتاجه الطريقة مفقود، أو خادم النموذج الذي تحتاجه العملية لا يستجيب، أو مفتاح مسمى للإعادة لا يطابق شيئاً، أو نمط `--files` لا يطابق أي ملف، أو التكوين غير صالح. | تعذر تشغيل الفحص التجريبي نفسه: مفتاح مسمى للإعادة لا يطابق شيئاً، أو نمط `--files` لا يطابق أي ملف، أو التكوين غير صالح. |

يخرج التشغيل التجريبي بالرمز `0` عن قصد: فهو يمثل المعاينة التي تشغلها قبل اتخاذ القرار، ويجب ألا تفشل خطوة CI التي تكتفي بالاطلاع فقط. يظهر ما ستفعله العملية الحقيقية في الأسطر الأخيرة من التشغيل التجريبي وفي ملخص `--json`: يعني `preflight.ready: false` أن العملية الحقيقية ستتوقف قبل الترجمة وتخرج بالرمز `1` (ويوضح `preflight.failures` السبب)؛ ويعني `maxCost.wouldStop: true` أنها ستتوقف عند بلوغ الحد الأقصى وتخرج بالرمز `2` (`maxCost.exitCode: 2`)؛ ويعني `maxCost.exitCode: 1`، مع `maxCost.stopsEarlier`، أن الفحص المسبق سيوقفها قبل فحص الحد الأقصى. يجمع `realRun.exitCode` هذه الحالات معاً، مع ما قد يجعل العملية الحقيقية جزئية: مفاتيح محجوبة مؤقتاً، أو رسائل جمع على القرص بدون صيغة تستخدمها اللغة ولن تطلبها مجدداً (`2`؛ ويسميها `realRun.reasons`، ويذكر السطر الأخير من التشغيل التجريبي ذلك). إن الرفض من قبل بوابة الجودة أو فشل التحقق، والذي لا يمكن إلا للعملية الحقيقية اكتشافه، قد يحول النتيجة المتوقعة `0` إلى `2`. تحول [خطوة الفحص في دليل CI](/docs/guides/ci-cd#check-before-sync) هذه الحالات إلى خطوة CI فاشلة تطبع السبب.

---

## watch

مزامنة تلقائية عند تغير ملف الترجمة المصدر. يستمر في العمل حتى تتم مقاطعته باستخدام `Ctrl+C`.

```bash
champollion watch
```

---

## audit

بوابة اكتمال الترجمة. تسرد كل مفتاح لم تتم ترجمته — مفقود، أو فارغ، أو لا يزال قيمة بديلة لـ `[EN]` — وكل ترجمة **قديمة**: تم إنشاؤها من نص مصدر أقدم من النص الحالي (وفقاً لـ `.champollion.lock`؛ ويترك تعديل المصدر الذي فشلت إعادة ترجمته هذه الحالة تحديداً). تنتهي كل قائمة بالترجمات القديمة بالأمر الذي يعيد ترجمتها. يخرج برمز 1 في حالة العثور على أي منها — يُستخدم كبوابة في CI لإفشال عمليات البناء التي تحتوي على ترجمات غير مكتملة أو قديمة.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

يعيد قراءة جميع ملفات الترجمة المحلية من القرص ويتحقق من أن الترجمات موجودة بالفعل وصحيحة. هذا هو التحقق نفسه الذي يتم تشغيله تلقائياً في نهاية كل عملية `sync` (ما لم يتم تمرير `--no-verify`).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**ما يتحقق منه:**
- تكافؤ المفاتيح — وجود جميع مفاتيح المصدر في كل هدف (بالنسبة لمفاتيح الجمع في i18next، مفاتيح صيغ الجمع الخاصة بـ CLDR للغة المحلية نفسها: تتطلب الفرنسية `count_many` أيضاً)
- علامات القيم البديلة `[EN]` من العمليات السابقة
- الترجمات الفارغة
- التوافق مع نظام الكتابة (Script) — يجب ألا تحتوي اللغة المحلية غير اللاتينية على نص لاتيني فقط؛ يتم تصنيف الأحرف حسب نظام كتابة Unicode، لذا تُحسب الحروف اللاتينية المشكولة وذات العرض الكامل (fullwidth) كلاتينية. تُعد الحروف اللاتينية ذات العرض الكامل خطأً في أي لغة محلية خارج الطباعة الصينية واليابانية والكورية (CJK)
- العناصر النائبة (Placeholders)، ويُسمى كل اكتشاف وفقاً لبناء الجملة المعني — بنية ICU MessageFormat (`ICU structure error`: وسيطة `{name}`، كلمة مفتاحية أو محدد مترجم لـ plural/select، علامة `#` مفقودة)، وتحويلات printf (`printf/python-format placeholder mismatch`: `%s`، `%d`، `%(name)s` — علامة `%(name)s` المفقودة في كتالوج gettext تُسمى كـ printf، وليس ICU)، واستيفاء i18next (`i18next {{…}} placeholder mismatch`: `{{name}}`، بما في ذلك `{{name}}` المكتوب كـ `{name}`، والذي يطبعه i18next كما هو)، وقوس مفرد `{name}` خارج رسالة ICU (`{…} placeholder mismatch`)
- علامات التنسيق (Markup) — لكل اسم وسم نفس وسوم الفتح والإغلاق والوسوم ذاتية الإغلاق كما في المصدر، وبالتداخل نفسه (يُعد فقدان `</strong>` خطأً)
- مشاكل الترميز — علامات BOM، والأحرف غير المرئية
- أصداء المصدر (Source echoes) — قيم مطابقة للمصدر (تحذير)
- صيغ الجمع — رسالة جمع تفتقر إلى صيغة تستخدمها اللغة للأعداد العادية (الروسية `few`/`many`)، أو مدخل gettext تكرر صيغه `other` فقط (تميز المزامنة هذه الحالات بتعليق `# champollion:`)، أو مفتاح i18next أو `msgstr[n]` لصيغة لا تملكها اللغة (تحذيرات)
- اللغات المحلية المتطابقة — لغتان محليتان مستهدفتان بالنص نفسه لمعظم المفاتيح: يُرجح أن إحداهما كُتبت بلغة الأخرى (تحذير)
- النص نفسه لمصادر مختلفة — نص واحد مكتوب لعدة سلاسل مصدر مختلفة (نموذج يكرر جملة محفوظة): سلسلتان واضحتان متعدّدتا الكلمات تم الرد عليهما بالنص نفسه المكون من أربع كلمات أو أكثر، أو ثلاث كلمات أو أكثر في الحالات الأخرى؛ الجملة التي التقطت المزامنة السابقة تكرار النموذج لها تُحسب ولو لمرة واحدة. يتم حسابها على قيم المفاتيح، وكل فرع جمع/تحديد (plural/select) في ICU (تُحسب فروع الجمع الواحد كمصدر واحد) وصفحات Markdown الخاصة باللغة المحلية (حقول البيانات الوصفية والكتل؛ مع استبعاد `# ` وعلامات الترقيم الختامية)، وفقاً للقاعدة نفسها التي ترفضها بها بوابة `sync` (خطأ)
- قديم — ترجمة أُجريت من نص مصدر أقدم من النص الحالي (تحذير هنا؛ ويفشل `audit` بسببها)
- علامة استفهام أو تعجب محذوفة — ينتهي المصدر بـ `?` أو `!` ولا تنتهي الترجمة بأي منهما ولا بما يعادلهما في نظام كتابة الهدف (`？`، `؟`، اليونانية `;`، …). تحذير: تميز بعض اللغات الاستفهام بكلمة أو أداة بدلاً من ذلك

يتحقق من البنية لا المعنى: فالاجتياز يعني أن المفاتيح، والعناصر النائبة، وصيغ الجمع،
وعلامات التنسيق، ونظام الكتابة سليمة، وليس أن النص يؤدي المعنى الصحيح — احرص على أن
يراجعه متحدث باللغة قبل الاعتماد عليه.

**أي اللغات المحلية.** يفحص `verify` كل لغة محلية؛ ويفحص `verify --pair en:fr`
الفرنسية فقط. بعد `sync --pair en:fr` يغطي فحص ما بعد المزامنة الأزواج
التي تم تشغيلها، دون غيرها. يوضح الفحص ذو النطاق المحدد ذلك في سطره الختامي — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json` يحمل هذا السطر
`checked` (اللغات المحلية المفحوصة) و`scope`.

**تغطية صيغ الجمع.** يحتوي المربع الخاص بكل لغة محلية على سطر واحد لكل نوع من أنواع الجمع
التي تحملها ملفاتها — مفاتيح i18next ذات اللواحق، ورسائل الجمع في ICU، ومدخلات `msgid_plural`
في gettext — مع تسمية الصيغ المتوقع أن تشتمل عليها اللغة المحلية
(فئات الجمع في CLDR الخاصة بها؛ وفي كتالوج gettext، تلك التي يحتوي `Plural-Forms`
على خانة لها) وما إذا كانت جميع صيغ الجمع تحتوي عليها:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

يسمي `✗` صيغ الجمع التي تفتقر إلى صيغة معينة. وتُذكر الصيغة التي تستخدمها الأرقام التي تزيد عن 1000 أو
الكسور فقط (الفرنسية `many` في رسالة ICU) على حدة: حيث تنوب عنها صيغة
`other`، وهو ما لا يُعد مشكلة مستكشفة. هذا السطر عبارة عن ملخص — فالصيغة
المفقودة تُعد أيضاً نتيجة مستكشفة أعلاه (مفتاح مفقود، تحذير جمع).

يكتب **`--json`** كائن JSON واحداً في كل سطر. تحصل كل لغة محلية على سجل في
stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — متضمناً
`ok`، `keys` (`expected`، `present`، `missing`، `extra`)، و`errors`،
`warnings` و`infos`، `placeholders` (كل نتيجة مستكشفة مع `syntax` الخاص بها: `icu`،
`printf`، `i18next`، `brace` أو `markup`) و`plurals` (لكل صنف ونوع:
`categories`، `total`، `complete`، `incomplete`). تكون النتائج المستكشفة أيضاً
أسطر `error`/`warn` على stderr، ويحتفظ السطر الختامي بمستواه
ورسالته (`ok` على stdout عند اجتياز الفحص، و`error` على stderr عندما لا
يجتازه) ويحمل إحصائيات `errors` و`warnings`. بعد المزامنة، تأتي السجلات
نفسها قبل ملخص المزامنة نفسه. (لا تحمل سجلات مشروع Docusaurus
أي `keys` أو `plurals`: حيث يتم فحص سلاسل واجهة المستخدم الخاصة به ملفاً بملف.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**رمز الخروج:** `1` عند العثور على خطأ — أو عند تعذر فحص أي شيء
على الإطلاق (ملف المصدر أو مجلد اللغات المحلية ليس في المسار المحدد في التكوين؛
ويسمي سطر الخطأ المسار والإعداد)، و`0` بخلاف ذلك. لا تتسبب التحذيرات
في إفشاله ما لم تمرر `--strict`، والذي يخرج بالرمز `1` عند وجود أي تحذير (كإجراء CI
يجب ألا يطلق، مثلاً، صيغ الجمع الروسية دون صيغتيها `few`/`many`) وينتهي
بسطر `[FAIL]`، وليس سطر `[OK]` أبداً؛ ويجعل `--warn-only` الأخطاء تخرج بالرمز `0`
أيضاً. واللغة المحلية التي يكون عدد مفاتيحها غير صحيح تذكر ذلك بدلاً من `[OK]`:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

يفحص الكود المصدري بحثاً عن سلاسل النصوص الموجهة للمستخدم والمضمنة برمجياً بشكل صريح (hardcoded) والتي يجب أن تستخدم استدعاءات ترجمة i18n. يكتشف إطار العمل تلقائياً (next-intl، react-i18next، vue-i18n، Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**ما يكتشفه:**
- السلاسل المضمنة برمجياً في نصوص JSX، `placeholder`، `alt`، `aria-label`، `title`
- الملفات التي تحتوي على محتوى موجه للمستخدم ولكنها تفتقر إلى استيراد إطار عمل i18n
- المفاتيح الميتة — مفاتيح الترجمة التي لا يشير إليها أي ملف مصدر
- درجة التغطية — النسبة المئوية للسلاسل الموجهة عبر i18n

**الاستثناءات**: أنشئ `.champollionignore` في جذر مشروعك (أنماط glob، مثل `.gitignore`).

**عدم وجود ما يتم فحصه يُعد فشلاً**: عندما لا يطابق أي ملف مصدر (المجلدات الافتراضية لإطار العمل — `src/`، `app/`، `pages/`، `components/` لمشاريع الويب — أو `--src` الخاص بك)، يخرج lint بالرمز `1` ويسمي المجلدات والامتدادات التي بحث عنها. يجب ألا يجتاز فحص lint لم يفحص أي شيء بوابة CI؛ وجهه إلى الكود الخاص بك باستخدام `--src <dir>` أو `"lint": { "srcDir": "<dir>" }`.

---

## wrap

يقوم بتغليف السلاسل المضمنة برمجياً التي اكتشفها `lint` تلقائياً داخل استدعاءات `t()`. ينشئ نسخاً احتياطية تلقائية قبل تعديل الملفات.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**بوابات الأمان:**
1. فحص نظافة Git (يتم تخطيه في التشغيل التجريبي)
2. نسخة احتياطية تلقائية إلى `.champollion-backup/`
3. معاينة الفروقات (diff) قبل كل كتابة لملف
4. دعم `--undo` للاستعادة من النسخة الاحتياطية

---

## seo

توليد عناصر تحسين محركات البحث (SEO) للمواقع متعددة اللغات.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| الأمر الفرعي | المخرجات |
|------------|--------|
| `hreflang` | وسوم `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` متعدد اللغات |
| `jsonld` | مخطط لغات WebSite بتنسيق JSON-LD |

---

## integrity

يكتشف التلف والانحراف في ملفات الترجمة المحلية المترجمة.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**ما يتحقق منه:**
- تلف العناصر النائبة (مثل وجود `{name}` في المصدر وفقده في الهدف)
- مشاكل الترميز (mojibake، ورموز Unicode غير الصالحة)
- النسخ غير المترجمة (قيمة الهدف مطابقة للمصدر) — تُعفى مفاتيح [`noTranslate`](/docs/getting-started/configuration#no-translate)، وكذلك الأصداء التي تؤكد ذاكرة الترجمة أنها ناتجة عن خط المعالجة ومعتمدة من البوابة. ما يتبقى معلماً هو تماماً ما سيعيد `sync` إدراجه في قائمة الانتظار — لا يمكن للأداتين أن تختلفا حول ملف سليم
- انحراف المفاتيح غير المترجمة (مفتاح `noTranslate` *غير* مطابق للمصدر) — يتم الإبلاغ عنه مع القيم المتوقعة/الفعلية ومحاذاة الأحرف غير المرئية مع ترميز خاص؛ شغّل `champollion sync` للإصلاح
- رموز PUA غير المتوقعة (نقاط ترميز منطقة الاستخدام الخاص في لغة محلية تم تعطيل [تحويل نظام الكتابة](/docs/getting-started/configuration#script-conversion) فيها — وتظهر فارغة بدون خط خاص)؛ شغّل `champollion repair-script` للإصلاح
- القيم المفرغة (هدف يمثل مصدره مع حذف الحروف — تلف ناتج عن خط معالجة أقدم من بوابة الحفاظ على المحتوى)؛ أعد الترجمة باستخدام `sync --force-keys <key>` أو `sync --pair <pair> --force`
- المفاتيح اليتيمة (مفاتيح موجودة في الهدف ولا وجود لها في المصدر)
- اكتمال فئات الجمع في ICU MessageFormat (على سبيل المثال، تحتاج العربية إلى 6 فئات) — وفقاً للقاعدة نفسها التي يستخدمها `sync` و`verify`: الصيغة المفقودة التي تصل إليها الأعداد العادية (الروسية `few`/`many`) تمثل تحذيراً؛ وتلك التي لا تصل إليها سوى الأرقام التي تتجاوز 1000 أو الكسور (الفرنسية `many`، المستخدمة للعدد 1 000 000) تمثل ملاحظة، نظراً لاستخدام صيغة `other` هناك

---

## repair-script

يعكس تحويل نظام الكتابة الذي ما كان ينبغي أن يحدث: تتم استعادة القيم المشفرة بـ PUA (مثل pIqaD، وTengwar، وKryptonian) في اللغات المحلية التي ينص تكوينها على إيقاف التحويل، إلى الحروف اللاتينية عبر جدول العكس الخاص بالمحول نفسه.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| الخيار | التأثير |
|--------|--------|
| `--dry` | معاينة الإصلاحات دون كتابة |
| `--locale <code>` | إصلاح لغة محلية واحدة فقط |
| `--json` | مخرجات JSON قابلة للقراءة آلياً |
| `--warn-only` | الخروج برمز 0 حتى إذا بقيت رموز PUA غير قابلة للعكس |

يتم عكس pIqaD بدقة متناهية. لا يمكن لعمليات عكس Tengwar وKryptonian استعادة حالة الأحرف الكبيرة والصغيرة (تُعلّم على أنها مسببة لفقدان حالة الأحرف case-lossy). لا تحتاج ذاكرة الترجمة إلى إصلاح — فهي تخزن القيم السابقة للتحويل. يخرج بالرمز 1 عندما تتبقى رموز PUA لا يستطيع أي محول مسجل عكسها.

---

## tm

إدارة ذاكرة التخزين المؤقت لذاكرة الترجمة (`.champollion/tm.json`). تخزن ذاكرة الترجمة (TM) الترجمات السابقة وتقدمها في عمليات المزامنة اللاحقة بدلاً من استدعاء API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| الأمر الفرعي | المخرجات |
|------------|--------|
| `stats` | عدد المدخلات، وحجم الملف، وتفصيل لكل لغة محلية |
| `clear` | حذف ملف التخزين المؤقت (بالكامل أو لكل لغة محلية) |

| الخيار | التأثير |
|--------|--------|
| `--locale <code>` | مسح المدخلات الخاصة بلغة محلية واحدة فقط |
| `--yes` | تخطي المطالبة بالتأكيد |

راجع [ذاكرة الترجمة](/docs/concepts/translation-memory) لمعرفة كيفية عمل TM ومتى يتم مسحها.

---

## xliff

تصدير واستيراد ملفات XLIFF 1.2 لمراجعتها من قبل مترجمين محترفين. XLIFF هو تنسيق التبادل العالمي المدعوم من أدوات الترجمة بمساعدة الحاسوب (CAT) مثل memoQ وSDL Trados وPhrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| الأمر الفرعي | المخرجات |
|------------|--------|
| `export` | توليد `.xliff` من ملفات الترجمة المحلية للمصدر + الهدف |
| `import` | دمج ترجمات `.xliff` التي تمت مراجعتها في ملفات الترجمة المحلية |

| الخيار | التأثير |
|--------|--------|
| `--locale <code>` | اللغة المحلية المستهدفة للتصدير (مطلوب) |
| `--out <path>` | مسار إخراج أو مجلد مخصص |
| `--dry` | معاينة الاستيراد دون كتابة |

راجع [العمل مع المترجمين المحترفين](/docs/guides/professional-translators) للاطلاع على سير العمل بالكامل.

---

## status

عرض تكوين الأزواج، والإضافات المثبتة، ونتائج التقييم المعياري (benchmark).

الزوج الذي يحدد تكوينه `qualityTier` (`standard`، أو `high`، أو `research`، أو
`verified`) يعرض ذلك، مع توضيحه على حقيقته: تسمية اخترتها أنت، وليست
قياساً — تترجم المزامنة بالطريقة نفسها بغض النظر عما يذكره، ويعلن عنه
`serve`. والزوج الذي لا يحدد أياً منها لا يعرض شيئاً (يظل لدى `--json`
`qualityTier`، مع `qualityTierSet: false`).

```bash
champollion status
```

بعد تبديل النموذج، يوضح أيضاً ما إذا كانت ملفات لغة محلية ما تخلط بين نصوص من أكثر
من نموذج واحد (من ذاكرة الترجمة: أي النماذج أنتج كل قيمة
على القرص)، مع الأمر الذي يجعل النموذج الحالي يترجم القيم التي كتبها
نموذج سابق — `sync --pair <pair> --redo all --fresh-on-model-change`.
وبالنسبة لطريقة تشغل نموذجاً تختاره أنت (`local`، `api`، `external`) فإنها
تكرر ملاحظة الترخيص التي طبعتها المزامنة الأولى مرة واحدة. وبالنسبة لطريقة متوافقة مع
OpenAI (`local`، `openai`) تعرض العنوان الذي تذهب إليه الطلبات والإعداد
الذي حدده: `LOCAL_API_BASE` في البيئة أو في `.env`، أو الإعداد الافتراضي
(Ollama، `http://localhost:11434/v1`). مع `contentDir` تسرد مجلد المحتوى
بجانب ملفات قيم المفاتيح، مع عدد صفحات المصدر التي يحتوي عليها،
ولكل لغة، عدد الترجمات الحالية أو القديمة أو المعلقة.
تعني "معلقة" عدم وجود ترجمة بعد، أو أن الأجزاء التي رفضتها بوابة الجودة تُركت بلغة المصدر (يقرأ قفل المحتوى `pending:<hash>`).
وتحت كل سجل أسلوبي تعرض إرشادات النوع الاجتماعي التي تحملها توجيهات نماذج LLM ومصدرها
(الافتراضي لـ Champollion لتلك اللغة، أو تكوينك، أو معطل —
راجع [إرشادات النوع الاجتماعي](/docs/getting-started/configuration#gender-guidance)).
وبالنسبة لزوج له خيار بديل (fallback)، تحسب عدد القيم في الملفات التي كتبها الخيار
البديل، وتسمي أولى هذه القيم.
يحمل `--json` ما يحمله `requestsGoTo` نفسه (على زوج أو خيار بديل بنقطة نهاية كهذه)، و`content`، و`genderGuidance` و`fallback.valuesInFiles`.

---

## provenance

تدقيق تراخيص موارد الترجمة لجميع الإضافات المثبتة.

```bash
champollion provenance
```

---

## plugin

إدارة إضافات طرق الترجمة. الإضافات هي وصفات ترجمة مجهزة مسبقاً ومثبتة في `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

راجع [مواصفات الإضافة](/docs/reference/plugin-spec) لمعرفة تنسيق بيان الإضافة (plugin manifest).

---

## leaderboard

`champollion network leaderboard` (يعمل أيضاً كـ `champollion leaderboard`). استعرض وابحث وثبّت طرق الترجمة من لوحة صدارة الشبكة (Network leaderboard). تأتي الطرق المثبتة من لوحة الصدارة مصحوبة بنتائج التقييم المعياري وتكوين MethodConfig الأساسي الكامل — التكوين الدقيق المستخدم أثناء التقييم.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| الخيار | التأثير |
|--------|--------|
| `--pair <pair>` | التصفية حسب زوج اللغات، كما تكتبه اللوحة: `"eng>fra"` (ISO 639-3؛ ضع `>` بين علامتي اقتباس). يعمل `eng-fra` و`eng:fra` أيضاً، ويتم تحويل الرمز المكون من حرفين (`en` ← `eng`) |
| `--install <rank>` | تثبيت الطريقة في تلك المرتبة (كما هي مدرجة) كإضافة |
| `--apply` | بعد التثبيت، أضف `methodPlugin` تلقائياً إلى `champollion.config.json` |

**سير عمل `--apply`:** عندما تقوم بالتثبيت باستخدام `--apply`، يكتب champollion إضافة الطريقة في `.champollion/methods/` **ويقوم أيضاً** بتعديل `champollion.config.json` الخاص بك لاستخدامها للزوج المعني. هذا هو أسرع مسار من "ما الذي يحقق أعلى الدرجات؟" إلى "أنا أستخدمه في بيئة الإنتاج".

---

## card

`champollion network card <code>` (يعمل أيضاً كـ `champollion card`). يطبع ما يعرفه الفهرس عن لغة ما: التعريف، والتصنيف، وتقديرات أعداد المتحدثين، ومستوى خطر الاندثار، والأنماط اللغوية (typology)، وتوفر المدونات اللغوية، والموارد اللغوية، ومجموعات بيانات التقييم، وجاهزية خط المعالجة، ودعم الطرق اللغوية، ومصادر البيانات. وعند اختلاف المصادر (الأسماء، العائلات، أعداد المتحدثين، خطر الاندثار، ...) تُطبع كل قيمة مع مصدرها دون ترجيح إحداها. وأي قسم لا تتضمن البطاقة شيئاً عنه يذكر "غير مسجل في هذه البطاقة": فالغياب يعني عدم المعرفة، وليس "عدم الوجود". وتُحل الأسماء البديلة (`fr` → `fra`).

```bash
champollion network card crk           # Plains Cree
champollion network card cmn --json    # the raw card JSON
```

| الخيار | التأثير |
|--------|--------|
| `--json` | بيانات JSON الخام للبطاقة بدلاً من العرض المنسق |

---

## recommend

`champollion network recommend <src> <tgt>` (يعمل أيضاً كـ `champollion recommend`). إرشادات الطرق لزوج لغوي واحد (المصدر→الهدف): كل محرك يمكن إرسال المهام إليه مع حالة توفره المباشرة (هل يتوفر مفتاح API؟ ما مسار الترخيص؟)، والنماذج المفتوحة التي تعلن بطاقة نموذجها الخاصة عن دعم اللغة الهدف ويمكن لـ `local-model` تحميلها (قابلة للتشغيل، دون أدلة منشورة — ادعاء بحاجة إلى قياس معياري، وليس قياساً)، والأدلة المنشورة المفهرسة للزوج (مستشهد بها دون إعادة إنتاجها؛ مقارنة نسبية فقط)، وأي من النماذج المدعومة بأدلة يمكن تشغيله هنا. وإذا لم تكن هناك أدلة، يُذكر ذلك بوضوح. والمسار التجاري صارم: تُستبعد أي طريقة لا تحمل ترخيصاً جاهزاً للاستخدام التجاري مع ذكر السبب.

```bash
champollion network recommend eng yor
champollion network recommend eng-yor --use commercial
```

| الخيار | التأثير |
|--------|--------|
| `--pair <pair>` | الزوج كقيمة واحدة بدلاً من رمزين: `"eng>yor"` (ضع `>` بين علامتي اقتباس)، أو `eng-yor`، أو `eng:yor` |
| `--use <lane>` | مسار الترخيص: `non-commercial` (الافتراضي) أو `commercial` (صارم) |
| `--json` | حمولة قابلة للقراءة آلياً |

---

## register-corpus

`champollion network register-corpus` (يعمل أيضاً كـ `champollion register-corpus`). يسجل مدونة تقييم مع ترخيصها ومستوى تعرضها — `local-only` (الافتراضي: لا يُسجل أو يُرفع أي شيء)، أو `private` (بيانات وصفية فقط)، أو `public` (بطاقة بيانات وصفية ومؤشر جلب من المصدر)، أو `sealed` (مشفرة على جهازك؛ ولا يخرج منه سوى بطاقة خالية من المحتوى). لا يرفع Champollion نصوص المدونات أو يستضيفها أبداً، في أي مستوى كان: الملف المحدد بـ `--data` يُقرأ على هذا الجهاز فقط لحساب أعداده وتدقيق المجموع الاختباري (checksum)، ويحصل على ملف وصفي جانبي (sidecar) حتى يطبق `mt-eval run` ترخيصه. وبالنسبة لمجموعة الاختبار، يطبع خطوات nmt-forge التي يجب تنفيذها قبل أول تقييم لها. تفاعلي في الطرفية؛ وقابل للتشغيل البرمجي عبر الخيارات و`--yes`.

```bash
champollion network register-corpus --list
champollion network register-corpus --yes --name "Holdout" --pair "eng>crk" --license cc-by-nc-4.0 --tier private --role test --size 500 --domain educational
```

كل الخيارات، مع قاعدة معرف البطاقة: `champollion network register-corpus --help`.

---

## seal-corpus

`champollion network seal-corpus <keygen|seal|open|sign-keygen|sign|verify>` (يعمل أيضاً كـ `champollion seal-corpus`). عمليات التشفير المحيطة بمستوى التعرض المختوم (X25519-ECDH → HKDF-SHA256 → AES-256-GCM): ينشئ `keygen` زوج مفاتيح بديل فردي (ليس مفتاح مجموعة M-of-N — فأي شخص يحمل ملف المفتاح الخاص يمكنه فك التشفير بمفرده)، ويشفر `seal` مدونة على هذا الجهاز، ويفك `open` تشفير عنصر مختوم في سياق تقييم خاضع للرقابة، وتوقع `sign-keygen` / `sign` / `verify` حزم الدرجات للنقل المعزول تماماً عن الشبكة (air-gapped) (مفتاح توقيع لعقدة واحدة). تستدعي عقدة التنظيم `mt-eval` هذا الأمر في الطرفية بدلاً من إعادة تنفيذ خوارزمية التشفير.

```bash
champollion network seal-corpus keygen --out ~/.contest-keys
```

كل الخيارات: `champollion network seal-corpus --help`.

---

## submit

`champollion network submit` (يعمل أيضاً كـ `champollion submit`). يقترح مدخلاً للفهرس عبر مسار مشروط بالمراجعة: يجمع الحقول لأحد أنواع التقديم الستة (`dataset`، `resource`، `method`، `human-service`، `external-result`، `card-correction`) ويطبع رابط GitHub issue مملوءاً مسبقاً، يراجعه أحد مسؤولي الصيانة للتحقق من قواعد الترخيص والسيادة. لا تتم الموافقة على أي شيء تلقائياً، ولا يكتب في سجل أو قاعدة بيانات أبداً.

```bash
champollion network submit --list
champollion network submit --yes --type dataset --attest --field dataset-name="GlobalVoices eng-amh" --field pairs=eng-amh --field license=CC-BY-4.0 --field source-url=https://globalvoices.org
```

كل الخيارات: `champollion network submit --help`.

---

## fonts

تنزيل وإدارة خطوط الويب لرموز PUA لمحولات أنظمة كتابة اللغات المصنوعة (conlangs). تحتاج اللغات التي تستخدم أحرف منطقة الاستخدام الخاص (الكلينغونية Klingon، والسندرين Sindarin، والكريبتونية Kryptonian) إلى خطوط ويب مخصصة لعرض أنظمة كتابتها. يقوم هذا الأمر بتنزيلها من مستودعات مفتوحة المصدر تم التحقق منها.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| الأمر الفرعي | المخرجات |
|------------|--------|
| `list` | يعرض خطوط PUA المطلوبة وحالة تثبيتها |
| `install` | ينزل الخطوط للغات التي تم تكوينها |

| الخيار | التأثير |
|--------|--------|
| `--dir <path>` | تجاوز مجلد إخراج الخطوط (يُكتشف تلقائياً من نوع المشروع) |
| `--css` | توليد مقتطف `conlang-fonts.css` جنباً إلى جنب مع الخطوط |
| `--config <path>` | المسار إلى ملف التكوين (يُستخدم لاكتشاف اللغات التي تحتاج إلى خطوط) |

**الاكتشاف التلقائي:** يتم استنتاج مجلد الإخراج من بنية مشروعك:
- **Docusaurus** ← `static/fonts/` أو `website/static/fonts/`
- **Hugo** ← `static/fonts/`
- **الافتراضي** ← `public/fonts/`

**محولات Unicode الأصلية** (`crk` ← مقاطع كري الصوتية، `sr` ← السيريلية الصربية) لا تتطلب تثبيت أي خطوط.

راجع [اللغات المصنوعة وأنظمة الكتابة وقواعد الإملاء](/docs/guides/conlangs-scripts-orthography) للحصول على تفاصيل كاملة حول خطوط PUA.

---

## serve

يقدم حزمة الترجمة الخاصة بهذا المشروع (الطريقة، والأساليب اللغوية، والتوجيه، وذاكرة الترجمة Translation Memory، وبوابة الجودة) عبر HTTP، وفق العقد الذي تستخدمه طريقة `api`، مما يسمح لمشروع champollion آخر بتوجيه `"method": "api"` إليه. تمر الطلبات عبر خط المعالجة الذي يستخدمه `sync`: تُقدم التطابقات مع ذاكرة الترجمة مجاناً من التخزين المؤقت، وترد حالات الإخفاق في بوابة الجودة كأخطاء خاصة بكل مفتاح، دون تقديم مخرجات منخفضة الجودة أبداً.

يرتبط بـ `127.0.0.1` افتراضياً: يمكن لأي شخص يستطيع الوصول إلى المنفذ استهلاك ميزانية واجهة برمجة التطبيقات (API) الخاصة بك لدى المزود، لذا فإن إتاحته للعلن قرار صريح (`--bind 0.0.0.0`) ويتطلب رمز حامل (bearer token). ولا يُقبل `--no-auth` إلا مع ربط الاسترجاع الداخلي (loopback).

```bash
champollion serve --token my-strong-secret --max-session-cost 5
champollion serve --no-auth --bind 127.0.0.1     # this machine only, no token
champollion serve --emit-manifest --endpoint https://translate.example.org
```

| الخيار | التأثير |
|--------|--------|
| `--port <n>` | منفذ الاستماع (الافتراضي: 1822؛ 0 = منفذ متاح عشوائي) |
| `--bind <addr>` | عنوان الربط (الافتراضي: `127.0.0.1`؛ `--bind 0.0.0.0` يُتيح الخادم للعلن ويتطلب رمزاً) |
| `--token <secret>` | رمز الحامل (bearer token) الذي يرسله المستهلكون (الافتراضي: `CHAMPOLLION_SERVE_TOKEN` من البيئة أو `.env.local`؛ 12 حرفاً على الأقل) |
| `--no-auth` | بدون مصادقة — يُرفض ما لم يكن الربط على الاسترجاع الداخلي (loopback) |
| `--rate-limit <n>` | عدد الطلبات في الدقيقة لكل عنوان IP للعميل (الافتراضي: 120؛ 0 يعطله) |
| `--max-body-bytes <n>` | الحد الأقصى لحجم نص الطلب بالبايت (الافتراضي: 1000000) |
| `--max-cost-per-request <usd>` | رفض الطلب إذا تجاوزت تكلفته التقديرية لدى المزود هذا الحد (يُرفض أيضاً إذا كان السعر غير معروف) |
| `--max-session-cost <usd>` | الحد الأقصى للإنفاق التقديري لعملية الخادم هذه؛ تُرفض الطلبات التي تتجاوزه (402) |
| `--name <kebab-case>` | اسم الطريقة المستضافة (الافتراضي: من دليل المشروع) |
| `--pair <src:tgt>` | استضافة هذه الأزواج المهيأة فقط، مفصولة بفواصل |
| `--emit-manifest` | كتابة `method.json` الذي يثبته المستهلك، ثم الخروج (دون تشغيل الخادم) |
| `--endpoint <url>` | نقطة النهاية التي يمكن للمستهلك الوصول إليها لـ `--emit-manifest` (الافتراضي: `http://127.0.0.1:<port>/translate`) |
| `--out <path>` | الموضع الذي يكتب فيه `--emit-manifest` (الافتراضي: `./<name>/method.json`) |

---

## models

```bash
champollion models --method gemini      # list Gemini models
champollion models --method openai --json
champollion models check                # every default model against the providers' live lists (free)
```

يسرد النماذج التي توفرها واجهة برمجة التطبيقات (API) الخاصة بالمزود (للقراءة فقط؛ لا يتم تغيير التهيئة). يتحقق `champollion models check` من كل نموذج افتراضي (`shared/model-defaults.json`) بمقارنته بالقوائم المباشرة للمزودين ويخرج بالرمز 1 إذا كان أحدهما مفقوداً؛ ولا يُحسب مقابل مالي على نقاط نهاية سرد النماذج.

| الخيار | التأثير |
|--------|--------|
| `--method <name>` | المزود المراد الاستعلام منه: `gemini` أو `openai` أو `anthropic` (مطلوب، باستثناء `check`) |
| `--json` | JSON قابل للقراءة آلياً (مستند واحد) |

---

## doctor

```bash
champollion doctor                  # every check
champollion doctor cards            # language card diagnostics
champollion doctor fst crk          # the Plains Cree FST
champollion doctor --json
```

فحص صحة التثبيت: بطاقات اللغات، وتهيئة المشروع، وتثبيتات FST، ومفاتيح API، وتبعيات الطرق. يُشغّل جميع الفحوصات افتراضياً؛ بينما يُشغّل الأمر الفرعي فحصاً واحداً.

| الأمر الفرعي | الفحوصات |
|------------|--------|
| `cards` | تحميل بطاقات اللغات بشكل صحيح؛ وإحصاءات التغطية |
| `config` | ملف تهيئة المشروع وكيفية حل رموز اللغات الخاصة به |
| `fst [code]` | تثبيت FST (الكل، أو لغة واحدة) |
| `methods` | مفاتيح API (التأكد من تعيين كل منها؛ كما يُرسل مفتاح OpenRouter إلى نقطة نهاية المفاتيح المجانية لـ OpenRouter، والتي ترفض المفتاح غير الصالح)، وإمكانية الوصول إلى الخادم، وحزم Python |

يطبع `--json` مستنداً واحداً يتضمن نتيجة كل فحص.

## مسار معالجة ثلاثي الطبقات

استخدم `lint` و`sync` و`audit` معاً للحصول على نظام تدويل (i18n) محكم لا تشوبه شائبة:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| الطبقة | الأمر | التوقيت | الغرض |
|-------|---------|------|---------|
| **Lint** | `lint` | قبل التثبيت (Pre-commit) | حظر عمليات التثبيت التي تحتوي على سلاسل نصوص مضمنة برمجياً |
| **Sync** | `sync` | بعد التثبيت / CI | ترجمة المفاتيح المفقودة والمتغيرة |
| **Verify** | `verify` | بعد المزامنة / CI | التأكد من أن الترجمات موجودة وصحيحة |
| **Audit** | `audit` | خطوة البناء | إفشال النشر إذا احتوت أي لغة محلية على علامات `[EN]` |

---

## انظر أيضًا

- [التكوين](/docs/getting-started/configuration) — مرجع ملف التكوين
- [طرق الترجمة](/docs/guides/translation-methods) — اختيار الطريقة لكل زوج
- [ذاكرة الترجمة](/docs/concepts/translation-memory) — التخزين المؤقت وتوفير التكاليف
- [العمل مع المترجمين المحترفين](/docs/guides/professional-translators) — سير عمل XLIFF
- [مواصفات الإضافة](/docs/reference/plugin-spec) — تنسيق بيان الإضافة
- [دليل CI/CD](/docs/guides/ci-cd) — أتمتة أوامر CLI في مسار المعالجة الخاص بك
- [كيف تعمل المزامنة](/docs/concepts/how-sync-works) — فهم مسار معالجة المزامنة
- [بوابة الجودة](/docs/concepts/quality-gate) — كيف يتم التحقق من صحة الترجمات
