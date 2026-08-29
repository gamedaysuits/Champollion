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

قم بتشغيل `champollion <command> --help` للحصول على مساعدة مفصلة حول أي أمر.

## الخيارات العامة

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

معالج إعداد تفاعلي يقوم بإنشاء `champollion.config.json`. يرشدك عبر تحديد اللغة المصدر، واللغات المستهدفة، وتنسيق الملف، ونموذج الترجمة.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**خيار `--langs`**: قائمة برموز اللغات المستهدفة مفصولة بفواصل. يتخطى هذا الخيار مطالبة تحديد اللغة ويطبق الإعدادات المسبقة الافتراضية للسجل (register) لكل لغة. ادمجه مع `--yes` لإعداد غير تفاعلي بالكامل.

**الإعدادات المسبقة للغات**: عند مطالبتك بتحديد اللغات المستهدفة، يمكنك كتابة أسماء الإعدادات المسبقة:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

الجمع بين الإعدادات المسبقة والرموز الفردية: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

يترجم المفاتيح المفقودة والقديمة عبر جميع ملفات اللغات (locale files). يقوم بتشغيل التحقق بعد المزامنة (post-sync verification) افتراضيًا.

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

**ذاكرة الترجمة (Translation Memory)**: افتراضيًا، يقوم `sync` بتحميل `.champollion/tm.json` ويقدم الترجمات المخزنة مؤقتًا للقيم المصدرية التي لم تتغير. استخدم `--no-tm` لتجاوز ذاكرة التخزين المؤقت (مفيد عند تبديل مزودي الترجمة أو تصحيح أخطاء الجودة). راجع [ذاكرة الترجمة](/docs/concepts/translation-memory).

**اكتشاف التغييرات**: يقوم Champollion بتخزين تجزئات SHA-256 في `.champollion.lock`. عندما تتغير القيم المصدرية، تقوم عملية المزامنة التالية بإعادة ترجمة تلك المفاتيح تلقائيًا. قم بإيداع (commit) ملف القفل (lock file) بحيث يتشارك جميع المطورين نفس خط الأساس.

**التوازي (Parallelism)**: تعمل كل من ترجمة مفاتيح JSON وترجمة المحتوى بالتوازي. تتم ترجمة ملفات لغات JSON في وقت واحد (الافتراضي: 200 ملف لغة متزامن)، مع موازاة الدفعات داخل كل ملف لغة أيضًا (4 دفعات متزامنة). تعمل ترجمة المحتوى (Markdown، MDX، منشورات المدونة) في تجمع عناصر عمل مسطح (الافتراضي: 48 استدعاء API متزامن). يمكنك تجاوز هذه القيم باستخدام `--json-concurrency`، أو `--content-concurrency`، أو `--concurrency` (يضبط كليهما).

**المخرجات**: تعرض عملية المزامنة لافتة الإصدار، واكتشاف التنسيق/إطار العمل، وتقدير التكلفة، وأشرطة التقدم لكل لغة:

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

يتم تحديث أشرطة التقدم في مكانها بعد كل دفعة (~80 مفتاحًا). استخدم `--quiet` لعرض الأخطاء/التحذيرات فقط، أو `--json` للحصول على مخرجات NDJSON قابلة للقراءة آليًا. كلاهما يمنع ظهور شريط التقدم واللافتة.

---

## watch

مزامنة تلقائية عند تغير ملف اللغة المصدر. يستمر في العمل حتى تتم مقاطعته باستخدام `Ctrl+C`.

```bash
champollion watch
```

---

## audit

يسرد جميع القيم الاحتياطية غير المترجمة المسبوقة بـ `[EN]` من عمليات التشغيل السابقة. يخرج برمز 1 إذا تم العثور على أي منها — استخدمه كبوابة CI لإفشال عمليات البناء ذات الترجمات غير المكتملة.

```bash
champollion audit
```

---

## verify

يعيد قراءة جميع ملفات اللغات من القرص ويتحقق من أن الترجمات موجودة بالفعل وصحيحة. هذا هو نفس التحقق الذي يتم تشغيله تلقائيًا في نهاية كل `sync` (ما لم يتم تمرير `--no-verify`).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**ما يتحقق منه:**
- تكافؤ المفاتيح — جميع المفاتيح المصدرية موجودة في كل لغة مستهدفة
- علامات `[EN]` الاحتياطية من عمليات التشغيل السابقة
- الترجمات الفارغة
- التوافق مع نظام الكتابة (Script compliance) — يجب أن تحتوي اللغات غير اللاتينية على ترجمات غير ASCII
- الحفاظ على العناصر النائبة — تطابق العناصر النائبة لـ ICU مع المصدر
- مشكلات الترميز — علامات BOM، الأحرف غير المرئية
- صدى المصدر (Source echoes) — القيم المطابقة للمصدر (تحذير)

---

## lint

يفحص الكود المصدري بحثًا عن السلاسل النصية الثابتة (hardcoded) الموجهة للمستخدم والتي يجب أن تستخدم استدعاءات ترجمة i18n. يكتشف إطار العمل الخاص بك تلقائيًا (next-intl، react-i18next، vue-i18n، Hugo).

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**ما يكتشفه:**
- السلاسل النصية الثابتة في نصوص JSX، و `placeholder`، و `alt`، و `aria-label`، و `title`
- الملفات التي تحتوي على محتوى موجه للمستخدم ولكن لا تتضمن استيرادًا لإطار عمل i18n
- المفاتيح الميتة — مفاتيح اللغة التي لا يشير إليها أي ملف مصدري
- درجة التغطية — النسبة المئوية للسلاسل النصية التي تمر عبر i18n

**الاستثناءات**: قم بإنشاء `.champollionignore` في جذر مشروعك (أنماط glob، مثل `.gitignore`).

---

## wrap

يقوم بالتغليف التلقائي للسلاسل النصية الثابتة المكتشفة بواسطة `lint` في استدعاءات `t()`. ينشئ نسخًا احتياطية تلقائية قبل تعديل الملفات.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**بوابات الأمان:**
1. فحص نظافة Git (يتم تخطيه في التشغيل التجريبي dry-run)
2. نسخ احتياطي تلقائي إلى `.champollion-backup/`
3. معاينة الفروق (Diff preview) قبل كتابة كل ملف
4. دعم `--undo` للاستعادة من النسخة الاحتياطية

---

## seo

إنشاء عناصر تحسين محركات البحث (SEO) للمواقع متعددة اللغات.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| الأمر الفرعي | المخرجات |
|------------|--------|
| `hreflang` | وسوم `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` متعدد اللغات |
| `jsonld` | مخطط لغة موقع الويب JSON-LD |

---

## integrity

يكتشف التلف والانحراف (drift) في ملفات اللغات المترجمة.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**ما يتحقق منه:**
- تلف العناصر النائبة (مثلًا، `{name}` موجود في المصدر ولكنه مفقود في الهدف)
- مشكلات الترميز (mojibake، Unicode غير صالح)
- النسخ غير المترجمة (القيمة المستهدفة مطابقة للمصدر) — تُستثنى مفاتيح [`noTranslate`](/docs/getting-started/configuration#no-translate)، وكذلك الأصداء (echoes) التي تؤكد ذاكرة الترجمة أنها مُنتجة عبر مسار العمل (pipeline) ومعتمدة من البوابة. ما يظل مميزًا بعلامة هو بالضبط ما سيعيد `sync` إدراجه في قائمة الانتظار — لا يمكن للأداتين أن تختلفا حول الملف السليم
- انحراف عدم الترجمة (مفتاح `noTranslate` *غير* مطابق للمصدر) — يتم الإبلاغ عنه بالقيم المتوقعة/الفعلية مع تخطي الأحرف غير المرئية؛ قم بتشغيل `champollion sync` للإصلاح
- PUA غير متوقع (نقاط ترميز منطقة الاستخدام الخاص في لغة تم إيقاف [تحويل نظام الكتابة](/docs/getting-started/configuration#script-conversion) الخاص بها — تظهر فارغة بدون خط خاص)؛ قم بتشغيل `champollion repair-script` للإصلاح
- القيم المجوفة (هدف يمثل مصدره مع حذف الأحرف — تلف ناتج عن مسار عمل أقدم من بوابة الحفاظ على المحتوى)؛ أعد الترجمة باستخدام `sync --force-keys <key>` أو `sync --pair <pair> --force`
- المفاتيح اليتيمة (مفاتيح في الهدف غير موجودة في المصدر)
- اكتمال فئة الجمع في ICU MessageFormat (مثلًا، تحتاج اللغة العربية إلى 6 فئات)

---

## repair-script

يعكس تحويل نظام الكتابة الذي لم يكن ينبغي أن يحدث أبدًا: يتم استعادة القيم المشفرة بـ PUA (مثل pIqaD، Tengwar، Kryptonian) في اللغات التي يشير تكوينها إلى إيقاف التحويل، إلى الكتابة اللاتينية (romanization) عبر الجدول العكسي الخاص بالمحول.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| الخيار | التأثير |
|--------|--------|
| `--dry` | معاينة الإصلاحات دون كتابة |
| `--locale <code>` | إصلاح لغة واحدة فقط |
| `--json` | مخرجات JSON قابلة للقراءة آليًا |
| `--warn-only` | الخروج برمز 0 حتى إذا بقيت PUA غير قابلة للعكس |

يتم عكس pIqaD بشكل تام. لا يمكن لعمليات عكس Tengwar و Kryptonian استعادة حالة الأحرف (تُصنف على أنها فاقدة لحالة الأحرف). لا تحتاج ذاكرة الترجمة إلى إصلاح — فهي تخزن قيم ما قبل التحويل. يخرج برمز 1 عندما تتبقى PUA لا يمكن لأي محول مسجل عكسها.

---

## tm

إدارة ذاكرة التخزين المؤقت لذاكرة الترجمة (`.champollion/tm.json`). تقوم ذاكرة الترجمة (TM) بتخزين الترجمات السابقة وتقديمها في عمليات المزامنة اللاحقة بدلاً من استدعاء واجهة برمجة التطبيقات (API).

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| الأمر الفرعي | المخرجات |
|------------|--------|
| `stats` | عدد الإدخالات، حجم الملف، التفصيل لكل لغة |
| `clear` | حذف ملف ذاكرة التخزين المؤقت (بالكامل أو لكل لغة) |

| الخيار | التأثير |
|--------|--------|
| `--locale <code>` | مسح الإدخالات للغة واحدة فقط |
| `--yes` | تخطي مطالبة التأكيد |

راجع [ذاكرة الترجمة](/docs/concepts/translation-memory) لمعرفة كيفية عمل ذاكرة الترجمة (TM) ومتى يجب مسحها.

---

## xliff

تصدير واستيراد ملفات XLIFF 1.2 لمراجعتها من قبل المترجمين المحترفين. XLIFF هو تنسيق التبادل العالمي المدعوم من قبل أدوات الترجمة بمساعدة الحاسوب (CAT tools) مثل memoQ، و SDL Trados، و Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| الأمر الفرعي | المخرجات |
|------------|--------|
| `export` | إنشاء `.xliff` من ملفات اللغة المصدر + الهدف |
| `import` | دمج ترجمات `.xliff` المراجعة في ملفات اللغات |

| الخيار | التأثير |
|--------|--------|
| `--locale <code>` | اللغة المستهدفة للتصدير (مطلوب) |
| `--out <path>` | مسار أو دليل مخرجات مخصص |
| `--dry` | معاينة الاستيراد دون كتابة |

راجع [العمل مع المترجمين المحترفين](/docs/guides/professional-translators) للحصول على مسار العمل الكامل.

---

## status

عرض تكوين الأزواج (pair configuration)، والإضافات المثبتة، ومستويات الجودة، ودرجات التقييم (benchmark scores).

```bash
champollion status
```

---

## provenance

تدقيق تراخيص موارد الترجمة لجميع الإضافات المثبتة.

```bash
champollion provenance
```

---

## plugin

إدارة إضافات طرق الترجمة. الإضافات عبارة عن وصفات ترجمة معبأة مسبقًا يتم تثبيتها في `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

راجع [مواصفات الإضافة](/docs/reference/plugin-spec) لمعرفة تنسيق بيان الإضافة (plugin manifest).

---

## leaderboard

تصفح، وابحث، وقم بتثبيت طرق الترجمة من لوحة الصدارة للشبكة (Network leaderboard). تأتي الطرق المثبتة من لوحة الصدارة مع درجات التقييم و MethodConfig الأساسي الكامل — وهو التكوين الدقيق المستخدم أثناء التقييم.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| الخيار | التأثير |
|--------|--------|
| `--pair <code>` | تصفية لوحة الصدارة حسب زوج اللغات (مثلًا، `en:fr`) |
| `--install <name>` | تثبيت إضافة طريقة من لوحة الصدارة |
| `--apply` | بعد التثبيت، إضافة `methodPlugin` تلقائيًا إلى `champollion.config.json` |

**مسار عمل `--apply`:** عند التثبيت باستخدام `--apply`، يكتب Champollion إضافة الطريقة إلى `.champollion/methods/` **و**يعدل `champollion.config.json` الخاص بك لاستخدامها للزوج المعني. هذا هو أسرع مسار من "ما الذي يسجل أفضل نتيجة؟" إلى "أنا أستخدمه في الإنتاج."

---

## fonts

يقوم بتنزيل وإدارة خطوط الويب PUA لمحوّلات أنظمة كتابة اللغات المصطنعة (constructed language). تحتاج اللغات التي تستخدم أحرف منطقة الاستخدام الخاص (مثل Klingon، و Sindarin، و Kryptonian) إلى خطوط ويب مخصصة لعرض أنظمة كتابتها. يقوم هذا الأمر بتنزيلها من مستودعات مفتوحة المصدر تم التحقق منها.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| الأمر الفرعي | المخرجات |
|------------|--------|
| `list` | يعرض خطوط PUA المطلوبة وحالة تثبيتها |
| `install` | يقوم بتنزيل الخطوط للغات المكونة |

| الخيار | التأثير |
|--------|--------|
| `--dir <path>` | تجاوز دليل مخرجات الخطوط (يتم اكتشافه تلقائيًا من نوع المشروع) |
| `--css` | إنشاء مقتطف `conlang-fonts.css` بجانب الخطوط |
| `--config <path>` | مسار ملف التكوين (يُستخدم لاكتشاف اللغات التي تحتاج إلى خطوط) |

**الاكتشاف التلقائي:** يتم استنتاج دليل المخرجات من بنية مشروعك:
- **Docusaurus** → `static/fonts/` أو `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **الافتراضي** → `public/fonts/`

**محولات Unicode الأصلية** (`crk` → المقاطع الكريية (Cree Syllabics)، `sr` → السيريلية الصربية) لا تتطلب تثبيت خطوط.

راجع [اللغات المصطنعة، وأنظمة الكتابة، وقواعد الإملاء](/docs/guides/conlangs-scripts-orthography) للحصول على التفاصيل الكاملة لخطوط PUA.

## مسار العمل ثلاثي الطبقات (Three-Layer Pipeline)

استخدم `lint`، و `sync`، و `audit` معًا للحصول على تدويل (i18n) محكم:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| الطبقة | الأمر | متى | الغرض |
|-------|---------|------|---------|
| **Lint** | `lint` | قبل الإيداع (Pre-commit) | حظر الإيداعات التي تحتوي على سلاسل نصية ثابتة |
| **Sync** | `sync` | بعد الإيداع / CI | ترجمة المفاتيح المفقودة والمتغيرة |
| **Verify** | `verify` | بعد المزامنة / CI | تأكيد وجود الترجمات وصحتها |
| **Audit** | `audit` | خطوة البناء (Build step) | إفشال النشر إذا كانت أي لغة تحتوي على علامات `[EN]` |

---

## انظر أيضًا

- [التكوين](/docs/getting-started/configuration) — مرجع ملف التكوين
- [طرق الترجمة](/docs/guides/translation-methods) — اختيار الطريقة لكل زوج
- [ذاكرة الترجمة](/docs/concepts/translation-memory) — التخزين المؤقت وتوفير التكاليف
- [العمل مع المترجمين المحترفين](/docs/guides/professional-translators) — مسار عمل XLIFF
- [مواصفات الإضافة](/docs/reference/plugin-spec) — تنسيق بيان الإضافة
- [دليل CI/CD](/docs/guides/ci-cd) — أتمتة أوامر CLI في مسار عملك
- [كيف تعمل المزامنة](/docs/concepts/how-sync-works) — فهم مسار عمل المزامنة
- [بوابة الجودة](/docs/concepts/quality-gate) — كيفية التحقق من صحة الترجمات
