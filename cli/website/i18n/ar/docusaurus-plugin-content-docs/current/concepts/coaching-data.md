---
sidebar_position: 5
title: "بيانات التوجيه"
related:
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: tutorial
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# بيانات التوجيه

بيانات التوجيه (Coaching data) هي آلية Champollion لتزويد نموذج LLM بما لا يعرفه عن لغة ما. من خلال تقديم قواعد نحوية وقواميس وملاحظات أسلوبية إلى جانب كل طلب ترجمة، فإنك تمنح نموذج LLM للأغراض العامة السياق الذي ينقصه — وهو أمر بالغ الفائدة للغات التي لا تجيد أي خدمة ترجمة آلية التعامل معها. لا يمكن لهذه البيانات تعليم النموذج لغةً لم يرها من قبل؛ قِس ما تفعله الطريقة الموجَّهة فعلياً باستخدام [عدة التقييم](/docs/network/specifications/harness) قبل الاعتماد عليها.

## كيف تعمل

عند تعيين طريقة زوج لغوي إلى `llm-coached`، يقوم Champollion بتحميل ملف توجيه من `.champollion/coaching/<locale>.json` وحقن محتوياته في كل مطالبة لنموذج LLM كجزء من رسالة النظام. يرى نموذج LLM قواعدك اللغوية بجانب طلب الترجمة، مما ينتج مخرجات تتبع قواعدك ومصطلحاتك بدلاً من التخمين.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

هناك نوعان من محتوى التوجيه:

1. **بيانات التوجيه المهيكلة** (طريقة `llm-coached`) — قواعد نحوية، وقواميس، وملاحظات أسلوبية بتنسيق JSON. يتم تحميلها من `.champollion/coaching/<locale>.json` أو من دليل `coaching/` الخاص بإضافة ما. ويُعد `dictionary` الخاص بها مسرد مصطلحات المشروع أيضًا: حيث يتم إخطار كل طريقة LLM (`llm`، `openai`، `anthropic`، `gemini`، `local`) بمصطلحات المسرد التي تحتوي عليها كل دفعة، ويرسلها DeepL كمسرد، ويصدر أمر sync تحذيرًا عند تخطي أي مصطلح في مخرجات أي طريقة. تتم قراءة القواعد النحوية والملاحظات الأسلوبية بواسطة `llm-coached` فقط — على أي موفر (`"provider": "openai"`، `"local"`، …).
2. **مطالبة التوجيه كنص حر** (حقل تكوين `coachingFile`) — ملف نصي عادي يحتوي على إرشادات إضافية تُحقن في مطالبة النظام. يعمل مع أي طريقة LLM، وليس فقط `llm-coached`. يُعيَّن عبر `coachingFile` في التكوين الخاص بك أو `--coaching-file` في واجهة سطر الأوامر (CLI).

يمكن استخدامهما معاً. يُرجى ملاحظة أن عدة التقييم لا تبني المحث نفسه: فهي ترسل ملف التوجيه كمحث النظام بأكمله، بينما تضعه `champollion sync` داخل محث الترجمة الخاص بها. وبالتالي، فإن النتيجة الموجَّهة من عدة التقييم تُعد دليلاً إرشادياً لمخرجات أداة CLI، وليست قياساً لها — قِس مخرجات أداة CLI نفسها على جُمل الاختبار الخاصة بك قبل الاعتماد عليها.

نظراً لأن بيانات التوجيه جزء من رسالة النظام، فإنها تستفيد من **التخزين المؤقت للمطالبات (prompt caching)** — حيث يقوم مزودون مثل Anthropic وGoogle بالتخزين المؤقت لبادئات النظام المتكررة، وبالتالي تدفع مقابل سياق التوجيه مرة واحدة فقط لكل جلسة، وليس لكل دفعة.

## تنسيق ملف التوجيه

أنشئ ملف JSON واحدًا لكل لغة وموقع (locale) في `.champollion/coaching/`. المثال
أدناه مخصص للغة مصطنعة تحت الرمز `qaa`، وهو رمز للاستخدام الخاص لا ينتمي لأي لغة حقيقية:
فكل قاعدة ومصطلح فيه مجرد نموذج بديل، وليس حقيقة عن أي
لغة. اكتب قواعدك الخاصة، ويفضل أن يكون ذلك مع متحدث باللغة، واقتبس
مصطلحات القاموس من مصدر يمكنك تحديده وتسميته.

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
}
```

### الحقول

| الحقل | النوع | مطلوب | الوصف |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | لا | مصفوفة من القواعد النحوية المحقونة في مطالبة النظام. يجب أن تكون كل قاعدة تعليمات موجزة وقابلة للتنفيذ يمكن لنموذج LLM اتباعها. |
| `dictionary` | `object` | لا | مخطط مفتاح-قيمة للمصطلح الإنجليزي ← مصطلح اللغة الهدف. يُستخدم للمفردات الخاصة بمجال معين والتي لا يعرفها نموذج LLM. |
| `style_notes` | `string` | لا | تعليمات أسلوبية حرة (مستوى الخطاب، النبرة، قواعد الرسمية). |

جميع الحقول اختيارية — يمكنك البدء بقاموس فقط وإضافة قواعد نحوية كلما قمت بتحسين النتائج.

## سلوك التراجع الاحتياطي

إذا تم تكوين زوج لغوي لاستخدام `llm-coached` ولكن لا يوجد ملف توجيه لهذا الإعداد الإقليمي، فإن Champollion **يتراجع احتياطيًا إلى طريقة `llm` القياسية** مع إصدار تحذير في وحدة التحكم:

```
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
       Falling back to standard LLM method. Create coaching data for better results.
```

هذا يعني أنه يمكنك تعيين `"defaultMethod": "llm-coached"` بأمان على المستوى العام — وستستخدمه اللغات التي تتوفر لها بيانات توجيه، بينما ستحصل اللغات الأخرى على ترجمة LLM قياسية دون أخطاء.

## متى تستخدم التوجيه

| السيناريو | الطريقة الموصى بها |
|----------|-------------------|
| اللغات غنية الموارد (الفرنسية، الإسبانية، الألمانية) | `llm` أو `google-translate` — نماذج LLM تعرفها جيداً بالفعل |
| اللغات متوسطة الموارد (الكورية، التركية، التايلاندية) | `llm` مع أسلوب الخطاب — تتعامل نماذج LLM معها بشكل كافٍ مع التوجيه الأسلوبي |
| اللغات منخفضة الموارد (لغة كري السهول، اليوروبا، الكيتشوا) | `llm-coached` — تحتاج نماذج LLM إلى قواعد نحوية وقواميس |
| اللغات المصنوعة (الكلينغونية، السندارينية، الكريبتونية) | `llm-coached` — تمتلك نماذج LLM بعض بيانات التدريب لكنها تحتاج إلى تصحيحات |

## إنشاء بيانات توجيه جيدة

### القواعد النحوية

اكتب القواعد على شكل **تعليمات**، وليس توصيفات. يتبع نموذج LLM التعليمات بصورة أفضل من تفسيره للنظريات اللغوية.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### القواميس

ركّز على **المصطلحات الخاصة بالمجال** التي قد يخطئ فيها نموذج LLM أو يبتكر ترجمات غير دقيقة لها. لا تشغل نفسك بالكلمات الشائعة التي يتعامل معها النموذج بالفعل — ركّز على المصطلحات الخاصة بواجهة المستخدم (UI) لتطبيقك.

**يتم التحقق من القاموس في كل طريقة.** أيًا كانت الطريقة المستخدمة لترجمة
زوج لغوي — سواء كان نموذجًا مستضافًا، أو نموذجك الخاص عبر `local`، أو DeepL، أو نقطة نهاية `api` —
فإن `champollion sync` يتحقق من كل سلسلة نصية مترجمة مقابل
القاموس ويطبع تحذير `[TERM]` يذكر أي مصطلح لم يتم استخدامه.
فقط `llm-coached` (في المطالبة) و`deepl` (كمسرد DeepL) يقومان أيضًا
*بتطبيقه* أثناء الترجمة؛ أما بالنسبة للطرق الأخرى، فإن الفحص يوضح لك
السلاسل النصية التي يجب إصلاحها، على سبيل المثال باستخدام `champollion sync --method llm-coached
--redo keys:<key>`.

### الملاحظات الأسلوبية

كن محددًا بشأن مستوى الخطاب، والرسمية، والاصطلاحات المتبعة:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## اختبار الترجمات الموجهة

استخدم [MT Eval Harness](https://github.com/gamedaysuits/Champollion) لإجراء قياس مرجعي لترجماتك الموجهة مقابل مدونة مرجعية:

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

# Score the results
mt-eval test eval/logs/run_*.json
```

يمنحك هذا درجات chrF++‎ وBLEU والتطابق التام. أنشئ إصدارات متعددة من ملفات التوجيه وقارن بينها — فالمقاييس الموضوعية تتفوق على المراجعة التقديرية.

---

## انظر أيضًا

- [طرق الترجمة](/docs/guides/translation-methods) — طريقة llm-coached
- [ما هو هذا المشروع](/docs/what-is-champollion) — التوجيه من الناحية العملية
- [مواصفات الملحق](/docs/reference/plugin-spec) — حزم بيانات التوجيه في ملحق
- [بوابة الجودة](/docs/concepts/quality-gate) — كيفية التحقق من الترجمات الموجَّهة
- [التهيئة](/docs/getting-started/configuration) — تهيئة التوجيه لكل زوج لغوي
