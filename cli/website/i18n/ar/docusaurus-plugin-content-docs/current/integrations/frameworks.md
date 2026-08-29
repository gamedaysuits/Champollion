# أدلة التكامل

إعداد champollion خطوة بخطوة مع أطر العمل الشائعة.

---

## إعداد مفتاح API

قبل التكامل مع أي إطار عمل، ستحتاج إلى مفتاح API للترجمة. يدعم Champollion مزودين اثنين:

### الخيار أ: OpenRouter (موصى به)

يوفر [OpenRouter](https://openrouter.ai) واجهة برمجة تطبيقات (API) موحدة لأكثر من 200 نموذج من النماذج اللغوية الكبيرة (LLM). تتوفر فئة مجانية.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

الأفضل لـ: المشاريع كثيفة المحتوى، وترجمة Markdown، والمشاريع التي تحتاج إلى حماية واعية بالمحتوى (كتل التعليمات البرمجية، والرموز القصيرة، ومتغيرات الاستيفاء).

### الخيار ب: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

الأفضل لـ: أزواج المفتاح والقيمة (key-value) النصية ذات الحجم الكبير (194 لغة). **غير موصى به** لمحتوى Markdown — لا يمتلك Google Translate أي وعي بكتل التعليمات البرمجية، أو الرموز القصيرة، أو متغيرات الاستيفاء.

لاستخدام Google Translate بشكل صريح:

```bash
champollion sync --method google-translate
```

> **تلميح**: إذا تم تعيين `GOOGLE_TRANSLATE_API_KEY` فقط (بدون مفتاح OpenRouter)، فسيقوم champollion بالتبديل تلقائيًا إلى Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### هيكل المشروع

يستخدم Hugo `i18n/` لترجمة السلاسل النصية و `content/` لمحتوى الصفحة:

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

### الإعداد

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

قم بإنشاء `champollion.config.json`:

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

### تفاصيل ترجمة المحتوى

**البيانات التمهيدية (Front matter)**: يدعم محددات YAML (`---`) و TOML (`+++`). يترجم `title`، و `description`، و `summary`، و `subtitle`، و `caption`، و `linkTitle` افتراضياً. يتم الاحتفاظ بجميع الحقول الأخرى (date، و draft، و tags، و weight، و slug، إلخ). يمكنك التخصيص باستخدام `translatableFields` في ملف التكوين الخاص بك.

**حماية الكتل**: تتم حماية كتل التعليمات البرمجية، والرموز القصيرة (shortcodes) الخاصة بـ Hugo (`{{< >}}`، `{{% %}}`)، والتعليمات البرمجية المضمنة، وHTML الخام تلقائيًا باستخدام عناصر نائبة حارسة من Unicode. حيث تمر كما هي دون أي تغيير.

**اصطلاح تسمية الملفات**: يتبع نمط الترجمة حسب اسم الملف الخاص بـ Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (يزيل لاحقة المصدر)

**تخطي الملفات الموجودة**: لا يتم أبداً الكتابة فوق الملفات المترجمة الموجودة مسبقاً. احذف الملف الهدف لفرض إعادة الترجمة.

### صيغ الجمع

تدعم ملفات الترجمة بصيغتي TOML و YAML صيغ الجمع الخاصة بـ CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

يتم تمثيلها داخلياً كـ `items.one` و `items.other` لإجراء المقارنة (diffing)، ثم يُعاد تسلسلها إلى التنسيق المقطعي الصحيح عند الكتابة.

---

## next-intl (JSON)

### هيكل المشروع

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

### الإعداد

```bash
npm install --save-dev champollion
```

قم بإنشاء `champollion.config.json`:

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

ينشئ `messages/fr.json`، و `messages/ja.json`، إلخ — مترجمة بالكامل، مع الحفاظ على هيكل المفاتيح المتداخلة الخاص بك. يلتقطها next-intl تلقائياً.

### سير عمل التطوير

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

### هيكل الملفات المسطح (موصى به)

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

### هيكل الدلائل المتداخلة

إذا كنت تستخدم هيكل `{locale}/{namespace}.json`، فقم بإنشاء برنامج نصي للمزامنة للقيام بالتسطيح (flatten) → الترجمة → إلغاء التسطيح (unflatten). راجع [وثائق react-i18next](https://react.i18next.com/) للحصول على التفاصيل.
