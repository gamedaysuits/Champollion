---
sidebar_position: 5
title: "بيانات التوجيه"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# بيانات التوجيه

تُعد بيانات التوجيه آلية Champollion لتعليم النماذج اللغوية الكبيرة (LLMs) لغات لم يتم تدريبها عليها. من خلال توفير القواعد النحوية، والقواميس، وملاحظات الأسلوب جنبًا إلى جنب مع كل طلب ترجمة، فإنك تحول نموذجًا لغويًا كبيرًا عام الغرض إلى مترجم مدرك للسياق لأي لغة — بما في ذلك اللغات التي لا تحظى بأي دعم حالي في الترجمة الآلية (MT).

## كيف تعمل

عندما تقوم بتعيين طريقة الزوج إلى `llm-coached`، يقوم Champollion بتحميل ملف توجيه من `.champollion/coaching/<locale>.json` ويحقن محتوياته في كل مطالبة (prompt) للنموذج اللغوي الكبير كجزء من رسالة النظام. يرى النموذج اللغوي الكبير قواعدك اللغوية جنبًا إلى جنب مع طلب الترجمة، مما ينتج عنه مخرجات تتبع قواعدك النحوية ومصطلحاتك بدلاً من التخمين.

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

1. **بيانات التوجيه المهيكلة** (طريقة `llm-coached`) — القواعد النحوية، والقواميس، وملاحظات الأسلوب بتنسيق JSON. يتم تحميلها من `.champollion/coaching/<locale>.json` أو من دليل `coaching/` الخاص بالمكون الإضافي.
2. **مطالبة التوجيه بالنص الحر** (حقل التكوين `coachingFile`) — ملف نصي عادي يحتوي على إرشادات إضافية يتم حقنها في مطالبة النظام. يعمل مع أي طريقة للنموذج اللغوي الكبير، وليس فقط `llm-coached`. يتم تعيينه عبر `coachingFile` في التكوين الخاص بك أو `--coaching-file` في واجهة سطر الأوامر (CLI).

يمكن استخدام كليهما معًا. تستخدم أداة التقييم (eval harness) نفس بنية المطالبة تمامًا — لذا فإن درجات القياس الخاصة بك تعكس مطالبات الإنتاج الفعلية.

نظرًا لأن بيانات التوجيه تعد جزءًا من رسالة النظام، فإنها تستفيد من **التخزين المؤقت للمطالبات (prompt caching)** — حيث يقوم مزودون مثل Anthropic وGoogle بتخزين بادئات النظام المتكررة مؤقتًا، لذلك تدفع مقابل سياق التوجيه مرة واحدة فقط لكل جلسة، وليس مرة واحدة لكل دفعة.

## تنسيق ملف التوجيه

قم بإنشاء ملف JSON واحد لكل لغة (locale) في `.champollion/coaching/`:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### الحقول

| الحقل | النوع | مطلوب | الوصف |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | لا | مصفوفة من القواعد النحوية المحقونة في مطالبة النظام. يجب أن تكون كل قاعدة عبارة عن تعليمة موجزة وقابلة للتنفيذ يمكن للنموذج اللغوي الكبير اتباعها. |
| `dictionary` | `object` | لا | خريطة مفتاح-قيمة (Key-value map) للمصطلح الإنجليزي → مصطلح اللغة المستهدفة. تُستخدم للمفردات الخاصة بالمجال والتي لن يعرفها النموذج اللغوي الكبير. |
| `style_notes` | `string` | لا | تعليمات أسلوب حرة الشكل (مستوى اللغة، النبرة، أعراف الرسمية). |

جميع الحقول اختيارية — يمكنك البدء بقاموس فقط وإضافة القواعد النحوية أثناء التحسين.

## سلوك التراجع (Fallback Behavior)

إذا تم تكوين زوج لـ `llm-coached` ولكن لا يوجد ملف توجيه لتلك اللغة، فإن Champollion **يتراجع إلى طريقة `llm` القياسية** مع تحذير في وحدة التحكم:

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

هذا يعني أنه يمكنك تعيين `"defaultMethod": "llm-coached"` بشكل عام بأمان — ستستخدمه اللغات التي تحتوي على بيانات توجيه، وستحصل البقية على ترجمة قياسية للنموذج اللغوي الكبير دون أخطاء.

## متى تستخدم التوجيه

| السيناريو | الطريقة الموصى بها |
|----------|-------------------|
| لغات المستوى الأول (الفرنسية، الإسبانية، الألمانية) | `llm` أو `google-translate` — النماذج اللغوية الكبيرة تعرفها جيدًا بالفعل |
| لغات المستوى الثاني (الكورية، التركية، التايلاندية) | `llm` مع تحديد مستوى اللغة — تتعامل النماذج اللغوية الكبيرة معها بشكل مناسب مع إرشادات الأسلوب |
| لغات المستوى الثالث (Plains Cree، اليوروبا، الكيتشوا) | `llm-coached` — تحتاج النماذج اللغوية الكبيرة إلى قواعد نحوية وقواميس |
| اللغات المصطنعة (الكلينغونية، السندارين، الكريبتونية) | `llm-coached` — تمتلك النماذج اللغوية الكبيرة بعض بيانات التدريب ولكنها تحتاج إلى تصحيحات |

## بناء بيانات توجيه جيدة

### القواعد النحوية

اكتب القواعد كـ **تعليمات**، وليس كأوصاف. يتبع النموذج اللغوي الكبير التعليمات بشكل أفضل من تفسيره للنظريات اللغوية.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### القواميس

ركز على **المصطلحات الخاصة بالمجال** التي قد يخطئ فيها النموذج اللغوي الكبير أو يبتكرها. لا تهتم بالكلمات الشائعة التي يتعامل معها النموذج اللغوي الكبير بالفعل — ركز على المصطلحات الخاصة بواجهة مستخدم تطبيقك.

### ملاحظات الأسلوب

كن محددًا بشأن مستوى اللغة (register)، والرسمية، والأعراف:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## اختبار الترجمات الموجهة

استخدم [MT Eval Harness](https://github.com/gamedaysuits/Champollion) لقياس أداء ترجماتك الموجهة مقابل مجموعة نصوص مرجعية (reference corpus):

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

يمنحك هذا درجات chrF++، وBLEU، والتطابق التام. قم بإنشاء إصدارات متعددة من ملف التوجيه وقارن بينها — المقاييس الموضوعية تتفوق على المراجعة الذاتية.

---

## انظر أيضًا

- [طرق الترجمة](/docs/guides/translation-methods) — طريقة llm-coached
- [دعم لغة قليلة الموارد](/docs/network/community/low-resource-languages) — التوجيه في الممارسة العملية
- [مواصفات المكون الإضافي](/docs/reference/plugin-spec) — حزم بيانات التوجيه في مكون إضافي
- [بوابة الجودة](/docs/concepts/quality-gate) — كيفية التحقق من صحة الترجمات الموجهة
- [التكوين](/docs/getting-started/configuration) — تكوين التوجيه لكل زوج
