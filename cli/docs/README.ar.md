# Champollion

[![إصدار npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![الترخيص: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


**على مسار موجه، مع حواجز حماية.** تطوير ونشر الترجمة الآلية على مسار موجه، صُمم واضعاً في الاعتبار المجتمعات ذات الموارد المحدودة ومجتمعات لغات السكان الأصليين. واجهة سطر الأوامر (CLI) هذه هي طبقة المشروع والنشر.

**بناء نموذج للغة**، على حاسوبك الشخصي:

```bash
npx champollion new our-language --from English --to "Plains Cree"
cd our-language && npx champollion next
```

اللغة التي ليس لها رمز قياسي تأخذ رمز استخدام خاص واسمها الخاص:
`npx champollion new our-language --from English --to qaa --target-name "Our language"`
(أي رمز من `qaa` إلى `qtz`).

يبدأ `champollion new` مشروعاً يخصص مكاناً لكل شيء؛ ويوضح `champollion next` الخطوة التالية الوحيدة — من الملفات التي يحتفظ بها المجتمع (جداول البيانات، جداول Word، قواميس Toolbox أو LIFT، تفريغات ELAN) إلى نموذج مُقاس ثم إلى تطبيقك. تحدد كل خطوة من يتخذ القرار: الأشخاص الذين يمتلكون اللغة هم من يقررون أين يمكن أن تذهب جملها وما الذي يتم إصداره. يمكن لوكيل الذكاء الاصطناعي السير في نفس الخطوات من خلال [خادم MCP](https://www.npmjs.com/package/champollion-mcp-server). تضمن المسارات الموجهة العملية، وليس الجودة: ستعرف مدى جودة النموذج، وليس أنه جيد بالضرورة — عادةً ما يكون النموذج المجتمعي الصغير الأول عبارة عن كتاب عبارات مُقاس. ابدأ من [champollion.dev/start](https://champollion.dev/start).

**ترجمة ملفات الترجمة (locale) لتطبيقك** بأمر واحد:

```bash
npx champollion sync
```

يكتشف Champollion تلقائياً ملفات الترجمة (locale) الخاصة بك، وتنسيقها، واللغات المستهدفة. يقوم بترجمة المفاتيح المفقودة، ويتخطى ما تم إنجازه بالفعل، ويكتب النتائج — من محرك مستضاف، أو من نموذج قمت ببنائه وتقديمه بنفسك (`champollion connect`).

**الترخيص:** متاح المصدر بموجب [ترخيص PolyForm Noncommercial 1.0.0](../LICENSE) — مجاني للاستخدام والتعديل والمشاركة للأغراض غير التجارية (المشاريع الشخصية، والبحث، والتدريس، والاستخدام من قبل المؤسسات الخيرية والمدارس والهيئات العامة). لا يغطي هذا الترخيص استخدامه لغرض تجاري. بيئة التقييم (evaluation harness) مفتوحة المصدر (AGPL-3.0-or-later). [من يمكنه استخدام هذا](https://champollion.dev/docs/getting-started/who-may-use-this) · [التفاصيل](#license).

## لماذا لا تكتب البرنامج النصي بنفسك؟

يمكنك كتابة برنامج نصي سريع يمر عبر مفاتيحك الإنجليزية ويستدعي Google Translate. يفعل معظم المطورين ذلك — يستغرق الأمر حوالي 30 سطراً. إليك سبب فشل ذلك:

- **لا يوجد اكتشاف للتغييرات.** عندما تقوم بتحديث نص إنجليزي، تظل الترجمة قديمة إلى الأبد. يتتبع Champollion كل قيمة مصدر باستخدام تجزئات SHA-256 ويعيد ترجمة ما تغير فقط.
- **لا يوجد تجميع (batching).** استدعاء API واحد لكل مفتاح يعني 200 مفتاح = 200 رحلة ذهاب وإياب. يقوم Champollion بالتجميع بذكاء (قابل للتهيئة، الافتراضي 80 مفتاحاً/دفعة للنماذج اللغوية الكبيرة (LLM)، و128 لـ Google).
- **لا توجد بوابة جودة.** الترجمة الآلية تهلوس، أو تعيد المصدر كما هو، أو تخرج بنظام كتابة خاطئ. يتحقق Champollion من كل ترجمة قبل كتابتها — يتم التقاط ورفض المخرجات الفارغة، وتكرار المصدر، وحلقات التكرار، وتضخم الطول، والمحتوى المحذوف، ونظام الكتابة الخاطئ. تلتقط البوابة المخرجات المعطلة، وليس المعنى الخاطئ.
- **لا يوجد وعي بالتنسيق.** هل هو مبرمج برمجياً (hardcoded) على JSON؟ يتعامل Champollion مع JSON، وTOML، وYAML، وHugo Markdown (البيانات الوصفية + النص الأساسي) مع الاكتشاف التلقائي.
- **لا يوجد أمان.** يحمي Champollion من تلوث النموذج الأولي (prototype pollution)، وتجاوز المسار (path traversal) عبر رموز الترجمة (locale codes) المصممة خصيصاً، وفساد كتل التعليمات البرمجية أثناء ترجمة Markdown.

Champollion هو إصدار الإنتاج من ذلك البرنامج النصي.

> [!NOTE]
> **ما يترجمه Champollion.** يستهدف Champollion **ملفات الترجمة (locale) والمحتوى المهيكل** — أزواج المفتاح والقيمة في JSON، وتهيئة TOML/YAML، وصفحات Hugo Markdown، ومستندات التبادل XLIFF. تم تحسينه للنصوص المكتوبة الرسمية: نصوص واجهة المستخدم، والوثائق، والاتصالات الرسمية، والمواد التعليمية. إنه ليس روبوت محادثة، أو مترجم كلام في الوقت الفعلي، أو ذكاء اصطناعي للمحادثة للأغراض العامة. لكل زوج لغوي، تكون طريقة الترجمة قابلة للتهيئة — بدءاً من واجهات برمجة التطبيقات (APIs) التجارية (Google Translate، DeepL) إلى المكونات الإضافية التي يطورها المجتمع، والمعايير العامة، والنماذج التي تقوم بتدريبها وتقديمها على المسارات الموجهة.

## البدء السريع

```bash
npm install --save-dev champollion
```

### الحصول على مفتاح API

يحتاج Champollion إلى نهاية خلفية (backend) للترجمة. اختر واحدة:

| المزود | المفتاح | الأفضل لـ |
|----------|-----|----------|
| **OpenRouter** (موصى به) | `OPENROUTER_API_KEY` | المشاريع كثيفة المحتوى، Markdown، أكثر من 200 نموذج |
| **OpenAI** | `OPENAI_API_KEY` | الوصول المباشر إلى GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | الوصول المباشر إلى Claude |
| **Gemini** | `GEMINI_API_KEY` | تتوفر فئة مجانية |
| **DeepL** | `DEEPL_API_KEY` | اللغات الأوروبية، دعم المسرد |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | أكثر من 130 لغة، الحجم الكبير |

**أسرع بداية** (مجاناً): سجل في [aistudio.google.com](https://aistudio.google.com/apikey) للحصول على مفتاح Gemini مجاني:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (أكثر من 200 نموذج): سجل في [openrouter.ai](https://openrouter.ai)، ثم:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

بديل **Google Translate** (أزواج المفتاح والقيمة فقط — لا يوجد وعي بـ Markdown):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **ملاحظة**: إذا تم تعيين `GOOGLE_TRANSLATE_API_KEY` فقط، يتحول champollion تلقائياً إلى Google Translate. لا حاجة لتغيير التهيئة. يستخدم REST API مباشرة — بدون SDK، بدون حساب خدمة، بدون `pip install`. فقط المفتاح.

هذا كل شيء. لمزيد من التحكم، قم بإنشاء ملف تهيئة:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

تأتي كل لغة مع **إعدادات مسبقة للسجل (register presets)** — تعليمات نبرة/رسمية مبنية مسبقاً ومضبوطة وفقاً لنظامها اللغوي (vouvoiement للفرنسية، Siezen للألمانية، です/ます لليابانية، 해요체 للكورية). يتيح لك معالج التهيئة (init wizard) تصفح واختيار الإعدادات المسبقة، أو تمرير `--yes` لقبول الإعدادات الافتراضية.

### مصدر غير إنجليزي

إذا كانت لغتك المصدر ليست الإنجليزية:

```bash
champollion sync --source fr                      # CLI flag
```

أو قم بتعيينها بشكل دائم في ملف التهيئة الخاص بك:

```json
{ "inputLocale": "fr" }
```

## ماذا يفعل

أنت تتعامل مع إطار عمل التدويل (i18n) (مثل next-intl، i18next، Hugo). ويتعامل Champollion مع ملفات الترجمة.

- **متعدد التنسيقات** — JSON، وTOML، وYAML، وHugo Markdown (البيانات الوصفية + النص الأساسي)، وXLIFF 1.2
- **تزايدي** — يترجم فقط ما تغير (تتبع تجزئة SHA-256)
- **مخزن مؤقتاً** — تخزن ذاكرة الترجمة (Translation Memory) النتائج السابقة؛ إعادة تشغيل المزامنة لا تكلف شيئاً للمفاتيح غير المتغيرة
- **بوابة جودة** — يتحقق من كل ترجمة بحثاً عن المخرجات المعطلة: حلقات التكرار، ومخرجات نظام الكتابة الخاطئ، وتكرار المصدر، وتضخم الطول، والمحتوى المحذوف (لا يتحقق من المعنى)
- **مدرك للمحتوى** — تحمي طرق النماذج اللغوية الكبيرة (LLM) كتل التعليمات البرمجية، والرموز القصيرة (shortcodes)، والروابط، ومتغيرات الاستيفاء (interpolation variables) أثناء ترجمة Markdown
- **أدوات مسار العمل (Pipeline)** — `lint`، `audit`، `integrity`، `seo` لبوابات التكامل المستمر (CI)
- **التوافق مع XLIFF** — تصدير الترجمات للمراجعة الاحترافية في أدوات الترجمة بمساعدة الحاسوب (CAT tools) (مثل memoQ، SDL Trados، Phrase)، واستيرادها مرة أخرى
- **تبعيات قليلة** — تبعيتان في وقت التشغيل: `@translated/lara` (حزمة تطوير البرمجيات لمزود Lara) و `cree-sro-syllabics` (محول Plains Cree SRO ⇄ syllabics الخاص بـ ALTLab/NRC). يتطلب Node 20+

## ما وراء Google Translate

يجعلك البدء السريع تعمل باستخدام نموذج لغوي كبير (LLM) أو Google Translate. لكن Google Translate يدعم حوالي 130 لغة. بينما يوجد أكثر من 7,000 لغة.

**الفكرة الأساسية لـ Champollion: طريقة الترجمة قابلة للتهيئة لكل زوج لغوي.** استخدم Google Translate للغة الفرنسية، ونموذجاً لغوياً كبيراً (LLM) مدرباً بملاحظاتك النحوية وقاموسك للغة Plains Cree، وواجهة برمجة تطبيقات (API) تستضيفها للغة لا تغطيها أي خدمة — كل ذلك في نفس المشروع، وكل ذلك باستخدام نفس واجهة سطر الأوامر (CLI).

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

إذا تمكنت من معرفة كيفية ترجمة زوج لغوي — من خلال هندسة التلقين (prompt engineering)، أو قواميس المجتمع، أو مسارات عمل FST، أو النماذج المضبوطة بدقة (fine-tuned models) — يتيح لك champollion حزم هذه الطريقة كمكون إضافي (plugin) ونشرها جنباً إلى جنب مع كل شيء آخر.

> نشأ من ترجمة موقع ويب إنتاجي إلى لغة Plains Cree، حيث لا توجد واجهة برمجة تطبيقات (API) جاهزة للاستخدام. البنية القائمة على الزوج اللغوي ليست نظرية — فهي موجودة لأن أحد المشاريع احتاج إلى Google Translate للغة الفرنسية ومسار عمل FST مدرب للغة من لغات السكان الأصليين، يعملان جنباً إلى جنب في نفس أمر المزامنة.

تتيح لك بيئة التقييم المرافقة [MT Eval Harness](https://github.com/gamedaysuits/Champollion) قياس ومقارنة مناهج الترجمة، ثم تصدير الطرق الفعالة كمكونات إضافية لـ champollion. يمكن لأي شخص يتحدث كلتا اللغتين تطوير واختبار ومشاركة طريقة ترجمة — دون الحاجة إلى منصة احتكارية.

### اختر طريقتك

يدعم Champollion 10 طرق للترجمة. يمكن لكل زوج لغوي استخدام طريقة مختلفة.

**مزودو النماذج اللغوية الكبيرة (LLM)** — الأفضل من حيث الجودة، ومدركون لـ Markdown، ومتوافقون مع التدريب (coaching):

| الطريقة | المفتاح | ماذا تفعل |
|--------|-----|-------------|
| `llm` (الافتراضي) | `OPENROUTER_API_KEY` | نموذج لغوي كبير (LLM) عبر OpenRouter — أكثر من 200 نموذج، توجيه تلقائي |
| `llm-coached` | `OPENROUTER_API_KEY` | نموذج لغوي كبير (LLM) + قواعد نحوية، قواميس، ملاحظات الأسلوب |
| `openai` | `OPENAI_API_KEY` | واجهة برمجة تطبيقات OpenAI المباشرة (gpt-4o، gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | واجهة برمجة تطبيقات Anthropic المباشرة (Claude Sonnet، Haiku، Opus) |
| `gemini` | `GEMINI_API_KEY` | واجهة برمجة تطبيقات Google Gemini المباشرة (Flash، Pro) — تتوفر فئة مجانية |
| `local` | *(لا يوجد)* | نموذجك الخاص خلف نقطة نهاية متوافقة مع OpenAI (Ollama، vLLM، LM Studio، نموذج تم تدريبه باستخدام `nmt-forge`). قم بتعيين `LOCAL_API_BASE` إذا لم يكن في الإعداد الافتراضي لـ Ollama. النص لا يغادر بنيتك التحتية أبداً |

**الترجمة الآلية التقليدية (Traditional MT)** — الأفضل من حيث السرعة، والتكلفة، وأزواج المفتاح والقيمة ذات الحجم الكبير:

| الطريقة | المفتاح | ماذا تفعل |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | واجهة برمجة تطبيقات Google Cloud Translation v2 (أكثر من 130 لغة) |
| `deepl` | `DEEPL_API_KEY` | واجهة برمجة تطبيقات DeepL مع دعم المسرد (أكثر من 30 لغة) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | مترجم Azure Cognitive Services (أكثر من 100 لغة) |
| `libretranslate` | *(استضافة ذاتية)* | LibreTranslate باستضافة ذاتية (AGPL، مجاني) |

**البنية التحتية** — لنقاط النهاية المخصصة أو المستضافة من قبل المجتمع:

| الطريقة | المفتاح | ماذا تفعل |
|--------|-----|-------------|
| `api` | *(لكل مزود)* | عميل HTTP خفيف لأي نقطة نهاية REST |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **ملاحظة**: تتعامل طرق الترجمة الآلية التقليدية (Google Translate، DeepL، Microsoft Translator، LibreTranslate) مع أزواج المفتاح والقيمة بشكل جيد ولكنها لا تستطيع ترجمة محتوى Markdown بأمان. بالنسبة للمشاريع كثيفة المحتوى، يوصى باستخدام طرق النماذج اللغوية الكبيرة (LLM) — فهي تحمي صراحةً كتل التعليمات البرمجية، والرموز القصيرة، ومتغيرات الاستيفاء.

## المكونات الإضافية (Plugins)

المكونات الإضافية هي وصفات ترجمة معبأة مسبقاً لأزواج لغوية محددة. إنها بيانات JSON (manifests) — وليست تعليمات برمجية — تخبر champollion بالطريقة التي يجب استخدامها، وبأي إعدادات، وما هي الجودة التي تم قياسها.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

راجع [الوثائق المرجعية](https://champollion.dev/docs/reference/plugin-spec) لمعرفة تنسيق البيان (manifest).

## الأوامر

| الأمر | الغرض |
|---------|---------|
| `init` | معالج الإعداد التفاعلي (أو `--yes` للإعدادات الافتراضية السريعة) |
| `sync` | ترجمة ومزامنة جميع ملفات الترجمة (locale) |
| `serve` | تقديم حزمة الترجمة لهذا المشروع عبر HTTP (عقد api-method) |
| `watch` | المزامنة التلقائية عند تغيير الملفات |
| `audit` | وضع علامة على ملفات الترجمة غير المكتملة (بوابة CI) |
| `lint` | العثور على السلاسل النصية المبرمجة برمجياً (hardcoded) في الكود المصدري |
| `status` | عرض تهيئة الزوج اللغوي، والطرق، والسجلات، ومعايير المكونات الإضافية |
| `provenance` | تدقيق ترخيص موارد الترجمة |
| `wrap` | التغليف التلقائي للسلاسل النصية المبرمجة برمجياً في استدعاءات `t()` (مع إمكانية التراجع) |
| `seo` | إنشاء hreflang، أو sitemap.xml، أو مخطط JSON-LD |
| `integrity` | التحقق من فساد العناصر النائبة (placeholder)، والترميز، واكتمال صيغ الجمع في ICU |
| `plugin` | تثبيت، أو إزالة، أو سرد المكونات الإضافية للطرق |
| `fonts` | تنزيل خطوط الويب لمحوّلات نصوص PUA |
| `tm` | إدارة ذاكرة التخزين المؤقت لذاكرة الترجمة (الإحصائيات، المسح، التأسيس، التقليم) |
| `xliff` | تصدير/استيراد XLIFF 1.2 لمراجعة المترجم المحترف |
| `models` | سرد النماذج المتاحة لمزود (`--method gemini`) |
| `verify` | إعادة قراءة ملفات الترجمة المكتوبة والتأكد من وجود الترجمات وصحتها (بوابة CI) |
| `doctor` | فحص صحة النظام: البطاقات، والتهيئة، والطرق، والمحولات |

الأوامر التي تعمل مع الفهرس المشترك ولوحة الصدارة (leaderboard)، بدلاً من مشروعك، مجمعة تحت `champollion network` (يعمل كل منها أيضاً بدون البادئة):

| الأمر | الغرض |
|---------|---------|
| `network card` | طباعة منسقة لبطاقة لغة (`network card <code>`، `--json` للبيانات الخام) |
| `network recommend` | إرشادات الطريقة لزوج لغوي — التوفر + الأدلة المقتبسة (`network recommend eng fra`، `--use`، `--json`) |
| `network leaderboard` | عرض لوحة صدارة الترجمة الآلية (MT leaderboard) (`--pair`، `--sort`، `--install N`) |
| `network register-corpus` | تسجيل مجموعة نصوص للتقييم (evaluation corpus): اختيار ترخيص + مستوى التعرض (محلي فقط/خاص/عام/مختوم) |
| `network seal-corpus` | أفعال التشفير للمستوى المختوم (Sealed-tier): `keygen` / `seal` / `open` (جسر العقدة المنظمة) |
| `network submit` | اقتراح إدخال في الفهرس (خاضع للمراجعة) — يطبع مشكلة GitHub معبأة مسبقاً |

قم بتشغيل `champollion <command> --help` للحصول على مساعدة مفصلة حول أي أمر.

المرجع الكامل: [الوثائق المرجعية](https://champollion.dev/docs/reference/cli)

### بوابة ما قبل الالتزام (Pre-commit gate)

تم بناء `champollion lint` ليكون بوابة التزام (commit gate): يخرج بـ `1` عندما يجد سلاسل نصية مبرمجة برمجياً (hardcoded) موجهة للمستخدم ويخرج بـ `0` عندما يكون نظيفاً (يقوم `--warn-only` بالإبلاغ دون حظر). قم بربطه في دليل خطافات (hooks) متتبع في مشروعك:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.6 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

أو قم بتشغيله من [lint-staged](https://github.com/lint-staged/lint-staged) بحيث يعمل فقط عندما تكون الملفات المصدرية في مرحلة التجهيز (staged):

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

أبقِ `champollion sync` خارج مرحلة ما قبل الالتزام (pre-commit) — فهو يجري استدعاءات شبكة لواجهة برمجة التطبيقات (API)، لذا فهو بطيء في أحسن الأحوال ويحظر الالتزامات في وضع عدم الاتصال في أسوأ الأحوال. قم بتشغيله في التكامل المستمر (CI) أو في خطاف ما قبل الدفع (pre-push hook) بدلاً من ذلك، مع استخدام `champollion audit` / `champollion verify` كبوابة.

## التهيئة

قم بإنشاء `champollion.config.json` أو تشغيل `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| الخيار | الافتراضي | الوصف |
|--------|---------|-------------|
| `inputLocale` | `"en"` | رمز اللغة المصدر |
| `localesDir` | `"./locales"` | مسار ملفات الترجمة (locale): ملف واحد لكل لغة (`fr.json`) أو مجلد واحد لكل لغة (`fr/common.json`، i18next) |
| `localesPattern` | `null` | أي تخطيط آخر، على سبيل المثال `"src/i18n/{ns}/{lang}.json"` (يستبدل `localesDir`) |
| `contentDir` | `null` | مجلد Markdown/MDX المراد ترجمته (مجلد `content/` في Hugo أو أي مجلد)؛ تُكتب كل ترجمة بجانب مصدرها كـ `<name>.<locale>.md` |
| `format` | `"auto"` | تنسيق الملف: `json`، أو `toml`، أو `yaml`، أو `auto` |
| `model` | `"google/gemini-3.8-flash"` | النموذج الافتراضي (معرف OpenRouter). يحدد المزودون المباشرون الإعداد الافتراضي الخاص بهم في وقت التشغيل. قم بتشغيل `champollion models --method gemini` لاكتشاف النماذج المتاحة. |
| `defaultMethod` | `"llm"` | طريقة الترجمة الافتراضية (يتم تجاوزها بواسطة علامة `--method`) |
| `batchSize` | `80` | عدد المفاتيح لكل دفعة ترجمة |
| `pairs` | `{}` | تجاوزات الطريقة، والنموذج، والجودة لكل زوج لغوي |

**تجاوزات لكل لغة**: لكل لغة [بطاقة لغة (Language Card)](https://champollion.dev/docs/reference/language-card-spec) — واحدة من 50 بطاقة منسقة تحتوي على إعدادات مسبقة للسجل، وأنظمة الرسمية، وقواعد الطباعة، وعلامات دعم الطريقة. تستخدم البطاقات [بنية ثنائية المستويات](https://champollion.dev/docs/agents/rails-model) (وقت التشغيل + المرجع) من أجل الأداء على نطاق واسع. قم بإنشاء هيكل بطاقة جديدة باستخدام `node scripts/generate-language-card.mjs <code>`. استخدم مفاتيح الإعداد المسبق كاختصار، أو اكتب نص سجل مخصص:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**وضع عدم التهيئة (Zero-config mode)**: لا يوجد ملف تهيئة؟ يكتشف Champollion تلقائياً ملفات الترجمة (locale)، والتنسيق، واللغات المستهدفة من مشروعك.

يمكن أن تكون قيم اللغة مفتاح إعداد مسبق (مثل `"casual-tu"`)، أو نص سجل مخصص، أو كائناً (تحكم كامل). التجاوزات على مستوى الزوج اللغوي في `pairs` لها الأولوية على الإعدادات على مستوى اللغة. قم بتشغيل `npx champollion init` لتصفح الإعدادات المسبقة المتاحة لكل لغة.

راجع [مرجع واجهة سطر الأوامر (CLI)](https://champollion.dev/docs/reference/cli) للحصول على تفاصيل الإعداد الخاصة بإطار العمل.

## مخرجات واجهة سطر الأوامر (CLI)

عندما تقوم بتشغيل `sync`، يعرض champollion بالضبط ما يحدث:

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

يسمي السطر الأخير من التقدير السعر الذي تم تسعير كل رقم به، ومن أين أتى ومتى (يحمل `--json` التفاصيل). تُقال عبارة "Translating …" فقط عندما يتم إرسال شيء ما: التشغيل التجريبي (dry run)، أو التشغيل الذي لا يحتوي على شيء لإرساله، يقول إنه يتحقق من ملفات الترجمة (locales) بدلاً من ذلك. يتم تحديث شريط التقدم في مكانه مع اكتمال كل دفعة (حوالي 80 مفتاحاً لكل تحديث). عندما يتم تعيين `contentDir`، تسمي المزامنة المجلد والمكان الذي تذهب إليه ترجماته؛ وتقول `Detected framework: Hugo` فقط عندما تجد موقع Hugo حقيقياً (`hugo.toml`، أو `config.toml` مع إعدادات Hugo، أو `archetypes/`، ...). يميز اكتشاف التنسيق `(auto)` عن `(config)` لتوضيح كيفية حل التنسيق.

**أوضاع المخرجات**: يمنع `--quiet` المخرجات الإعلامية (الأخطاء والتحذيرات فقط). يصدر `--json` تنسيق NDJSON قابلاً للقراءة آلياً لمسارات عمل CI/CD.

## التحصين (Hardening)

- **التراجع الأسي (Exponential backoff)** — 3 محاولات إعادة مع تذبذب (jitter) عند أخطاء 429/5xx
- **مهلة الطلب 30 ثانية** — يمنع AbortController التعليق
- **التحقق من صحة الاستجابة** — يقبل فقط المفاتيح التي تم إرسالها للترجمة
- **بوابة الجودة** — تلتقط حلقات الهلوسة، ومخرجات نظام الكتابة الخاطئ، وتضخم الطول، وتكرار المصدر
- **تتالي إعادة المحاولة** — عند فشل تحليل JSON، يعيد محاولة الدفعة ← نصف الدفعة ← المفاتيح الفردية (محدد الميزانية عبر `maxRetries`)
- **ذاكرة الترجمة** — يقوم `.champollion/tm.json` بتخزين الترجمات مؤقتاً مفهرسة بالنص المصدر + الترجمة (locale) + الطريقة؛ يتم تقديم المفاتيح غير المتغيرة من ذاكرة التخزين المؤقت في عمليات المزامنة اللاحقة، مما يلغي استدعاءات API الزائدة
- **التخزين المؤقت للتلقين (Prompt caching)** — يتيح تقسيم رسائل النظام/المستخدم التخزين المؤقت على مستوى المزود، مما يقلل من تكلفة الرموز (tokens) عبر الدفعات
- **فرض المصطلحات** — يتم التحقق من الترجمات المدربة مقابل مصطلحات القاموس بعد استجابة النموذج اللغوي الكبير (LLM)
- **حارس تلوث النموذج الأولي (Prototype pollution guard)** — يحظر `__proto__`، `constructor`، `prototype`
- **احتواء المسار** — يتم التحقق من صحة عمليات كتابة الملفات للبقاء ضمن الدلائل المهيأة
- **حماية الكتل** — حماية كتل التعليمات البرمجية، والرموز القصيرة، وHTML أثناء ترجمة المحتوى
- **بنية الفشل الصاخب (Fail-loud architecture)** — تؤدي إخفاقات الترجمة دائماً إلى طرح رسائل خطأ قابلة لاتخاذ إجراء، ولا تكتب أبداً بيانات غير صالحة بصمت
- **التحقق بعد المزامنة** — يعيد أمر `verify` قراءة الملفات المكتوبة ويؤكد وجود الترجمات، وصحة نظام الكتابة، وسلامة العناصر النائبة
- **النجاح الجزئي** — فشل دفعة واحدة لا يحظر الباقي

## الاختبار

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**تبعيات قليلة** — انظر أعلاه.

## الترخيص

PolyForm Noncommercial 1.0.0. واجهة سطر الأوامر (CLI) لـ Champollion متاحة المصدر — مجانية التثبيت والاستخدام والتعديل للأغراض غير التجارية (البحث، والتعليم، والعمل المجتمعي) بموجب [ترخيص PolyForm Noncommercial 1.0.0](../LICENSE)؛ لا يغطي هذا الترخيص استخدامها لغرض تجاري. بكلمات بسيطة، مع أمثلة — المدرسة، أو المستشفى أو العيادة العامة، أو المؤسسة الخيرية، أو المشروع الشخصي أو البحثي مشمول؛ منتج شركة هادفة للربح، مثل واجهة متجر، غير مشمول: [من يمكنه استخدام هذا](https://champollion.dev/docs/getting-started/who-may-use-this) (ملخص، وليس نصيحة قانونية؛ نص الترخيص هو الحاكم). حزمة npm المنشورة `champollion` مرخصة بـ PolyForm-Noncommercial-1.0.0؛ `cli/LICENSE` هو الترخيص المعتمد للحزمة الموزعة. بيئة التقييم المرافقة (MT Eval Harness) والمواصفات مفتوحة المصدر، ومرخصة بـ AGPL-3.0-or-later — مع استثناء §7 eval-standard-plugin — في [مستودع بيئة التقييم](https://github.com/gamedaysuits/Champollion) العام.
