# Champollion

[![إصدار npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![الترخيص: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


ترجم ملفات الترجمة (locale files) الخاصة بك بأمر واحد:

```bash
npx champollion sync
```

يكتشف Champollion تلقائياً ملفات الترجمة الخاصة بك، وتنسيقها، واللغات المستهدفة. يقوم بترجمة المفاتيح المفقودة، ويتخطى ما تمت ترجمته بالفعل، ثم يكتب النتائج. هذا كل شيء.

> **جزء من Champollion** — بنية تحتية مفتوحة المصدر للترجمة الآلية الموثوقة عبر جميع اللغات. واجهة سطر الأوامر (CLI) هذه هي واجهة النشر لمشروع أكبر يبني مجموعات الاختبار والخريطة التي توضح من يمكنه ترجمة ماذا، ومدى جودة كل طريقة في كل نوع من النصوص، وأين لا تزال الفجوات موجودة. يعمل المشروع على نوعين من المعايير (benchmarks): معايير عامة على بيانات مفتوحة (واسعة النطاق، منخفضة التكلفة، وترحب بكل الطرق) ومعايير سيادية — مجموعات اختبار سرية تنشئها المجتمعات، وتمتلكها، وتتحكم فيها، ولا نراها أبداً. البنية التحتية مفتوحة المصدر وتُدار بشكل فردي؛ أما مجموعات الاختبار وطرق الترجمة الخاصة بلغة مجتمع ما فهي ملك لذلك المجتمع. بُنيت مع المجتمعات، ولم تُجمع بياناتها منها خلسة — فهم من يملكون مفاتيحها. نرحب بكل الطرق، سواء كانت بشرية أو آلية. استكشف الشبكة على [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## لماذا لا تكتب نصاً برمجياً (Script) بنفسك؟

يمكنك كتابة نص برمجي سريع يمر عبر المفاتيح الإنجليزية ويستدعي Google Translate. يفعل معظم المطورين ذلك — يستغرق الأمر حوالي 30 سطراً. إليك سبب فشل هذه الطريقة:

- **عدم اكتشاف التغييرات.** عندما تقوم بتحديث نص إنجليزي، تظل الترجمة قديمة إلى الأبد. يتتبع Champollion كل قيمة مصدرية باستخدام تجزئات SHA-256 ويعيد ترجمة ما تغير فقط.
- **عدم تجميع الطلبات (Batching).** إجراء استدعاء API واحد لكل مفتاح يعني 200 مفتاح = 200 طلب ذهاب وإياب. يقوم Champollion بتجميع الطلبات بذكاء (قابل للتهيئة، الافتراضي 80 مفتاحاً/دفعة للنماذج اللغوية الكبيرة LLM، و128 لـ Google).
- **عدم وجود بوابة جودة.** الترجمة الآلية قد تهلوس، أو تعيد النص المصدر كما هو، أو تخرج نصاً بنظام كتابة خاطئ. يتحقق Champollion من صحة كل ترجمة قبل كتابتها — حيث يتم التقاط ورفض أنظمة الكتابة الخاطئة، والتضخم في طول النص، وتكرار النص المصدر.
- **عدم الوعي بالتنسيق.** هل الكود مبرمج خصيصاً لـ JSON؟ يتعامل Champollion مع JSON، و TOML، و YAML، و Hugo Markdown (البيانات الوصفية frontmatter + المحتوى) مع الاكتشاف التلقائي.
- **انعدام الأمان.** يحمي Champollion من تلوث النموذج الأولي (prototype pollution)، وتجاوز المسار (path traversal) عبر رموز اللغات المصاغة بشكل خبيث، وتلف كتل الأكواد أثناء ترجمة Markdown.

Champollion هو إصدار الإنتاج (production version) من ذلك النص البرمجي.

> [!NOTE]
> **ما يترجمه Champollion.** يستهدف Champollion **ملفات الترجمة والمحتوى المهيكل** — أزواج المفتاح والقيمة في JSON، وتكوينات TOML/YAML، وصفحات Hugo Markdown، ومستندات التبادل XLIFF. تم تحسينه للنصوص المكتوبة الرسمية: نصوص واجهة المستخدم، والوثائق، والمراسلات الرسمية، والمواد التعليمية. إنه ليس روبوت محادثة، أو مترجم كلام في الوقت الفعلي، أو ذكاء اصطناعي حواري للأغراض العامة. بالنسبة لكل زوج لغوي، تكون طريقة الترجمة قابلة للتهيئة — بدءاً من واجهات برمجة التطبيقات التجارية (Google Translate، DeepL) إلى الإضافات (plugins) التي يطورها المجتمع والتي يتم تقييمها عبر [MT Eval Arena](https://champollion.dev/arena).

## البدء السريع

```bash
npm install --save-dev champollion
```

### الحصول على مفتاح API

يحتاج Champollion إلى واجهة خلفية للترجمة. اختر واحدة:

| المزود | المفتاح | الأفضل لـ |
|----------|-----|----------|
| **OpenRouter** (موصى به) | `OPENROUTER_API_KEY` | المشاريع كثيفة المحتوى، Markdown، أكثر من 200 نموذج |
| **OpenAI** | `OPENAI_API_KEY` | الوصول المباشر إلى GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | الوصول المباشر إلى Claude |
| **Gemini** | `GEMINI_API_KEY` | تتوفر باقة مجانية |
| **DeepL** | `DEEPL_API_KEY` | اللغات الأوروبية، دعم المسارد (glossary) |
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

بديل **Google Translate** (أزواج المفتاح والقيمة فقط — لا يدعم Markdown):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **ملاحظة**: إذا تم تعيين `GOOGLE_TRANSLATE_API_KEY` فقط، فسيقوم champollion بالتبديل تلقائياً إلى Google Translate. لا حاجة لتغيير التهيئة. يستخدم REST API مباشرة — بدون SDK، وبدون حساب خدمة (service account)، وبدون `pip install`. فقط المفتاح.

هذا كل شيء. لمزيد من التحكم، قم بإنشاء ملف تهيئة:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

تأتي كل لغة مع **إعدادات مسبقة للسجل اللغوي (register presets)** — تعليمات مبنية مسبقاً للنبرة/الرسمية مضبوطة وفقاً لنظامها اللغوي (vouvoiement للفرنسية، Siezen للألمانية، です/ます لليابانية، 해요체 للكورية). يتيح لك معالج التهيئة (init wizard) تصفح واختيار الإعدادات المسبقة، أو تمرير `--yes` لقبول الإعدادات الافتراضية.

### مصدر بغير اللغة الإنجليزية

إذا كانت لغتك المصدر ليست الإنجليزية:

```bash
champollion sync --source fr                      # CLI flag
```

أو قم بتعيينها بشكل دائم في ملف التهيئة الخاص بك:

```json
{ "inputLocale": "fr" }
```

## ماذا يفعل

أنت تتعامل مع إطار عمل التدويل i18n (مثل next-intl، i18next، Hugo). ويتعامل Champollion مع ملفات الترجمة.

- **متعدد التنسيقات** — JSON، و TOML، و YAML، و Hugo Markdown (البيانات الوصفية + المحتوى)، و XLIFF 1.2
- **تزايدي** — يترجم فقط ما تغير (تتبع تجزئة SHA-256)
- **مخزن مؤقتاً** — تخزن ذاكرة الترجمة (Translation Memory) النتائج السابقة؛ إعادة تشغيل المزامنة لا تكلف شيئاً للمفاتيح غير المتغيرة
- **مراقب الجودة** — يتحقق من صحة كل ترجمة: يلتقط الهلوسات، والمخرجات بنظام كتابة خاطئ، وتكرار النص المصدر، والتضخم في طول النص
- **مدرك للمحتوى** — تحمي طرق النماذج اللغوية الكبيرة (LLM) كتل الأكواد، والأكواد القصيرة (shortcodes)، والروابط، ومتغيرات الاستيفاء (interpolation variables) أثناء ترجمة Markdown
- **أدوات مسار العمل (Pipeline)** — `lint`، و `audit`، و `integrity`، و `seo` لبوابات التكامل المستمر (CI gates)
- **التوافق مع XLIFF** — تصدير الترجمات للمراجعة الاحترافية في أدوات الترجمة بمساعدة الحاسوب (CAT tools مثل memoQ، SDL Trados، Phrase)، واستيرادها مرة أخرى
- **الحد الأدنى من الاعتماديات** — اعتماديتان فقط في وقت التشغيل (better-sqlite3 لقاعدة بيانات اللغة المدمجة، وأسماء اللغات CLDR)؛ بدون حزم تطوير برمجيات (SDKs) للمزودين. يتطلب Node 20+

## ما وراء Google Translate

البدء السريع يجعلك تعمل باستخدام نموذج لغوي كبير (LLM) أو Google Translate. لكن Google Translate يدعم حوالي 130 لغة. بينما يوجد أكثر من 7,000 لغة.

**الفكرة الأساسية لـ Champollion: طريقة الترجمة قابلة للتهيئة لكل زوج لغوي.** استخدم Google Translate للفرنسية، ونموذجاً لغوياً كبيراً (LLM) مع توجيه صرفي (morphological coaching) للغة Plains Cree، وواجهة برمجة تطبيقات (API) مستضافة مجتمعياً للغة Quechua — كل ذلك في نفس المشروع، وبنفس واجهة سطر الأوامر (CLI).

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

إذا تمكنت من معرفة كيفية ترجمة زوج لغوي — من خلال هندسة الأوامر (prompt engineering)، أو قواميس المجتمع، أو مسارات FST، أو النماذج المضبوطة بدقة (fine-tuned models) — فإن champollion يتيح لك حزم هذه الطريقة كإضافة (plugin) ونشرها جنباً إلى جنب مع كل شيء آخر.

> نشأ المشروع من ترجمة موقع إنتاجي إلى لغة Plains Cree، حيث لا توجد واجهة برمجة تطبيقات (API) جاهزة للاستخدام. البنية القائمة على الزوج اللغوي ليست نظرية — بل هي موجودة لأن أحد المشاريع احتاج إلى Google Translate للفرنسية ومسار FST موجه للغة من لغات الشعوب الأصلية، يعملان جنباً إلى جنب في نفس أمر المزامنة.

تتيح لك الأداة المرافقة [MT Eval Harness](https://github.com/gamedaysuits/Champollion) قياس ومقارنة أساليب الترجمة، ثم تصدير الطرق الفعالة كإضافات (plugins) لـ champollion. يمكن لأي شخص يتحدث اللغتين تطوير واختبار ومشاركة طريقة ترجمة — دون الحاجة إلى منصة احتكارية.

### اختر طريقتك

يدعم Champollion 10 طرق للترجمة. يمكن لكل زوج لغوي استخدام طريقة مختلفة.

**مزودو النماذج اللغوية الكبيرة (LLM)** — الأفضل من حيث الجودة، ويدعمون Markdown، ومتوافقون مع التوجيه (coaching):

| الطريقة | المفتاح | ماذا تفعل |
|--------|-----|-------------|
| `llm` (الافتراضي) | `OPENROUTER_API_KEY` | نموذج لغوي كبير (LLM) عبر OpenRouter — أكثر من 200 نموذج، توجيه تلقائي |
| `llm-coached` | `OPENROUTER_API_KEY` | نموذج لغوي كبير (LLM) + قواعد نحوية، قواميس، ملاحظات الأسلوب |
| `openai` | `OPENAI_API_KEY` | واجهة برمجة تطبيقات OpenAI المباشرة (gpt-4o، gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | واجهة برمجة تطبيقات Anthropic المباشرة (Claude Sonnet، Haiku، Opus) |
| `gemini` | `GEMINI_API_KEY` | واجهة برمجة تطبيقات Google Gemini المباشرة (Flash، Pro) — تتوفر باقة مجانية |

**الترجمة الآلية التقليدية (Traditional MT)** — الأفضل من حيث السرعة، والتكلفة، وأزواج المفتاح والقيمة ذات الحجم الكبير:

| الطريقة | المفتاح | ماذا تفعل |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | واجهة برمجة تطبيقات Google Cloud Translation v2 (أكثر من 130 لغة) |
| `deepl` | `DEEPL_API_KEY` | واجهة برمجة تطبيقات DeepL مع دعم المسارد (أكثر من 30 لغة) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | مترجم Azure Cognitive Services (أكثر من 100 لغة) |
| `libretranslate` | *(استضافة ذاتية)* | LibreTranslate باستضافة ذاتية (AGPL، مجاني) |

**البنية التحتية** — لنقاط النهاية (endpoints) المخصصة أو المستضافة مجتمعياً:

| الطريقة | المفتاح | ماذا تفعل |
|--------|-----|-------------|
| `api` | *(حسب المزود)* | عميل HTTP خفيف لأي نقطة نهاية REST |

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
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **ملاحظة**: تتعامل طرق الترجمة الآلية التقليدية (Google Translate، DeepL، Microsoft Translator، LibreTranslate) مع أزواج المفتاح والقيمة بشكل جيد ولكنها لا تستطيع ترجمة محتوى Markdown بأمان. بالنسبة للمشاريع كثيفة المحتوى، يوصى باستخدام طرق النماذج اللغوية الكبيرة (LLM) — فهي تحمي صراحةً كتل الأكواد، والأكواد القصيرة، ومتغيرات الاستيفاء.

## الإضافات (Plugins)

الإضافات هي وصفات ترجمة معبأة مسبقاً لأزواج لغوية محددة. إنها عبارة عن ملفات بيان (manifests) بتنسيق JSON — وليست أكواداً برمجية — تخبر champollion بالطريقة التي يجب استخدامها، وبأي إعدادات، وما هي الجودة التي تم قياسها.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

راجع [website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md) لمعرفة تنسيق ملف البيان.

## الأوامر

| الأمر | الغرض |
|---------|---------|
| `init` | معالج الإعداد التفاعلي (أو `--yes` للإعدادات الافتراضية السريعة) |
| `sync` | ترجمة ومزامنة جميع ملفات الترجمة |
| `watch` | المزامنة التلقائية عند تغيير الملفات |
| `audit` | وضع علامة على اللغات غير المكتملة (بوابة CI) |
| `card` | طباعة بطاقة لغة بتنسيق جميل (`card <code>`، `--json` للتنسيق الخام) |
| `register-corpus` | تسجيل مجموعة نصوص للتقييم (corpus): اختيار ترخيص + مستوى التعرض (محلي فقط/خاص/عام/مغلق) |
| `submit` | اقتراح إدخال في الفهرس (خاضع للمراجعة) — يطبع مشكلة GitHub معبأة مسبقاً |
| `lint` | البحث عن النصوص المبرمجة الثابتة (hardcoded strings) في الكود المصدري |
| `status` | عرض تهيئة الزوج اللغوي، والطرق، والسجلات اللغوية، ومستويات الجودة |
| `provenance` | تدقيق تراخيص موارد الترجمة |
| `wrap` | التغليف التلقائي للنصوص المبرمجة الثابتة في استدعاءات `t()` (مع إمكانية التراجع) |
| `seo` | إنشاء hreflang، أو sitemap.xml، أو مخطط JSON-LD |
| `integrity` | التحقق من تلف العناصر النائبة (placeholders)، والترميز، واكتمال صيغ الجمع في ICU |
| `plugin` | تثبيت، أو إزالة، أو سرد إضافات الطرق |
| `fonts` | تنزيل خطوط الويب لمحولات نصوص PUA |
| `tm` | إدارة ذاكرة التخزين المؤقت لذاكرة الترجمة (الإحصائيات، المسح، لكل لغة) |
| `xliff` | تصدير/استيراد XLIFF 1.2 لمراجعة المترجمين المحترفين |
| `models` | سرد النماذج المتاحة لمزود معين (`--method gemini`) |
| `verify` | إعادة قراءة ملفات الترجمة المكتوبة والتأكد من وجود الترجمات وصحتها (بوابة CI) |
| `leaderboard` | عرض لوحة صدارة الترجمة الآلية (`--pair`، `--sort`، `--install N`) |
| `doctor` | فحص صحة النظام: البطاقات، والتهيئة، والطرق، والمحولات |

قم بتشغيل `champollion <command> --help` للحصول على مساعدة مفصلة حول أي أمر.

المرجع الكامل: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### بوابة ما قبل الالتزام (Pre-commit gate)

تم بناء `champollion lint` ليكون بوابة التزام (commit gate): يخرج برمز `1` عندما يجد نصوصاً مبرمجة ثابتة موجهة للمستخدم ويخرج برمز `0` عندما يكون نظيفاً (يقوم `--warn-only` بالإبلاغ دون حظر). قم بربطه في دليل خطافات (hooks) متتبع في مشروعك:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
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

أبقِ `champollion sync` خارج مرحلة ما قبل الالتزام (pre-commit) — فهو يجري استدعاءات شبكة لواجهة برمجة التطبيقات (API)، لذا فهو بطيء في أحسن الأحوال ويحظر الالتزامات عند عدم الاتصال بالإنترنت في أسوأ الأحوال. قم بتشغيله في التكامل المستمر (CI) أو في خطاف ما قبل الدفع (pre-push hook) بدلاً من ذلك، مع استخدام `champollion audit` / `champollion verify` كبوابة.

## التهيئة (Configuration)

قم بإنشاء `champollion.config.json` أو تشغيل `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| الخيار | الافتراضي | الوصف |
|--------|---------|-------------|
| `inputLocale` | `"en"` | رمز اللغة المصدر |
| `localesDir` | `"./locales"` | مسار ملفات الترجمة |
| `contentDir` | `null` | دليل محتوى Hugo (يُفعل ترجمة Markdown) |
| `format` | `"auto"` | تنسيق الملف: `json`، أو `toml`، أو `yaml`، أو `auto` |
| `model` | `"google/gemini-3.5-flash"` | النموذج الافتراضي (معرف OpenRouter). يحدد المزودون المباشرون النموذج الافتراضي الخاص بهم في وقت التشغيل. قم بتشغيل `champollion models --method gemini` لاكتشاف النماذج المتاحة. |
| `defaultMethod` | `"llm"` | طريقة الترجمة الافتراضية (يتم تجاوزها بواسطة علامة `--method`) |
| `batchSize` | `80` | عدد المفاتيح لكل دفعة ترجمة |
| `pairs` | `{}` | تجاوزات الطريقة، والنموذج، والجودة لكل زوج لغوي |

**تجاوزات لكل لغة**: تمتلك كل لغة [بطاقة لغة](../website/docs/reference/language-card-spec.md) — وهي واحدة من 50 بطاقة منسقة تحتوي على إعدادات مسبقة للسجل اللغوي، وأنظمة الرسمية، وقواعد الطباعة، وعلامات دعم الطرق. تستخدم البطاقات [بنية ثنائية المستويات](../website/docs/concepts/architecture.md) (وقت التشغيل + المرجع) لضمان الأداء على نطاق واسع. قم بإنشاء هيكل بطاقة جديدة باستخدام `node scripts/generate-language-card.mjs <code>`. استخدم مفاتيح الإعدادات المسبقة كاختصار، أو اكتب نص سجل لغوي مخصص:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "cans"
    }
  }
}
```

**وضع انعدام التهيئة (Zero-config mode)**: لا يوجد ملف تهيئة؟ يكتشف Champollion تلقائياً ملفات الترجمة، والتنسيق، واللغات المستهدفة من مشروعك.

يمكن أن تكون قيم اللغة عبارة عن مفتاح إعداد مسبق (مثل `"casual-tu"`)، أو نص سجل لغوي مخصص، أو كائن (تحكم كامل). التجاوزات على مستوى الزوج اللغوي في `pairs` لها الأولوية على الإعدادات على مستوى اللغة. قم بتشغيل `npx champollion init` لتصفح الإعدادات المسبقة المتاحة لكل لغة.

راجع [مرجع واجهة سطر الأوامر (CLI Reference)](../website/docs/reference/cli.md) للحصول على تفاصيل الإعداد الخاصة بإطارات العمل.

## مخرجات واجهة سطر الأوامر (CLI Output)

عندما تقوم بتشغيل `sync`، يعرض champollion بالضبط ما يحدث:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

يتم تحديث شريط التقدم في مكانه مع اكتمال كل دفعة (حوالي 80 مفتاحاً لكل تحديث). يُظهر اكتشاف إطار العمل `Hugo` عند تعيين `contentDir`. يميز اكتشاف التنسيق `(auto)` عن `(config)` لتوضيح كيفية تحديد التنسيق.

**أوضاع المخرجات**: يقوم `--quiet` بكتم المخرجات الإعلامية (الأخطاء والتحذيرات فقط). ويقوم `--json` بإصدار NDJSON قابل للقراءة آلياً لمسارات CI/CD.

## التحصين (Hardening)

- **التراجع الأسي (Exponential backoff)** — 3 محاولات إعادة مع تذبذب (jitter) عند أخطاء 429/5xx
- **مهلة الطلب 30 ثانية** — يمنع AbortController التعليق
- **التحقق من الاستجابة** — يقبل فقط المفاتيح التي تم إرسالها للترجمة
- **بوابة الجودة** — تلتقط حلقات الهلوسة، والمخرجات بنظام كتابة خاطئ، والتضخم في طول النص، وتكرار النص المصدر
- **إعادة المحاولة المتتالية (Retry cascade)** — عند فشل تحليل JSON، يعيد محاولة الدفعة ← نصف الدفعة ← المفاتيح الفردية (محددة الميزانية عبر `maxRetries`)
- **ذاكرة الترجمة** — يقوم `.champollion/tm.json` بتخزين الترجمات مؤقتاً مفهرسة بالنص المصدر + اللغة + الطريقة؛ يتم تقديم المفاتيح غير المتغيرة من ذاكرة التخزين المؤقت في عمليات المزامنة اللاحقة، مما يلغي استدعاءات API الزائدة
- **التخزين المؤقت للأوامر (Prompt caching)** — يتيح تقسيم رسائل النظام/المستخدم التخزين المؤقت على مستوى المزود، مما يقلل من تكلفة الرموز (tokens) عبر الدفعات
- **فرض المصطلحات** — يتم التحقق من الترجمات الموجهة مقابل مصطلحات القاموس بعد استجابة النموذج اللغوي الكبير (LLM)
- **حماية تلوث النموذج الأولي (Prototype pollution guard)** — يحظر `__proto__`، و `constructor`، و `prototype`
- **احتواء المسار (Path containment)** — يتم التحقق من عمليات كتابة الملفات للبقاء ضمن الأدلة المهيأة
- **حماية الكتل** — يتم حماية كتل الأكواد، والأكواد القصيرة، و HTML أثناء ترجمة المحتوى
- **بنية الفشل الصاخب (Fail-loud architecture)** — تؤدي إخفاقات الترجمة دائماً إلى طرح رسائل خطأ قابلة لاتخاذ إجراء، ولا تكتب أبداً بيانات غير صالحة بصمت
- **التحقق بعد المزامنة** — يعيد الأمر `verify` قراءة الملفات المكتوبة ويؤكد وجود الترجمات، وصحة نظام الكتابة، وسلامة العناصر النائبة
- **النجاح الجزئي** — فشل دفعة واحدة لا يعيق الباقي

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

**الحد الأدنى من الاعتماديات** — انظر أعلاه.

## الترخيص

Apache-2.0. واجهة سطر الأوامر (CLI) لـ Champollion مفتوحة المصدر — مجانية التثبيت، والاستخدام، والتعديل، وإعادة التوزيع بموجب شروط [ترخيص Apache، الإصدار 2.0](../LICENSE). حزمة npm المنشورة `champollion` مرخصة بـ Apache-2.0؛ و `cli/LICENSE` هو الترخيص المعتمد للحزمة الموزعة. الأداة المرافقة MT Eval Harness والمواصفات مفتوحة المصدر أيضاً، ومرخصة بموجب AGPL-3.0-or-later — مع استثناء §7 eval-standard-plugin — في [مستودع الأداة](https://github.com/gamedaysuits/Champollion) العام.
