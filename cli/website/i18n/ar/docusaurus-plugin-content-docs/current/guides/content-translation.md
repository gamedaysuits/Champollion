---
sidebar_position: 5
title: "ترجمة المحتوى"
---

# ترجمة المحتوى (Hugo Markdown)

يترجم Champollion ملفات Hugo Markdown — سواء حقول الواجهة (front matter) أو محتوى النص (body content) — مع حماية كاملة لكتل الأكواد البرمجية، والأكواد القصيرة (shortcodes)، والعناصر المهيكلة.

## الإعداد

قم بتعيين `contentDir` في ملف التكوين الخاص بك لتمكين ترجمة محتوى Markdown:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## ما الذي تتم ترجمته

### حقول الواجهة (Front Matter)

يتم دعم محددات كل من YAML (`---`) و TOML (`+++`). افتراضياً، تتم ترجمة هذه الحقول:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

يتم الاحتفاظ بجميع الحقول الأخرى (`date`، `draft`، `tags`، `weight`، `slug`، إلخ) كما هي. يمكنك تخصيص ذلك باستخدام `translatableFields` في ملف التكوين الخاص بك.

### محتوى النص (Body Content)

تتم ترجمة نص Markdown بالكامل مع حماية الكتل — حيث يتم حجب العناصر المهيكلة باستخدام عناصر نائبة حارسة (sentinel placeholders) من نوع Unicode قبل الترجمة واستعادتها بعدها.

## حماية الكتل

تمر هذه العناصر عبر الترجمة دون أي تغيير:

| العنصر | مثال | الحماية |
|---------|---------|-----------|
| كتل الأكواد البرمجية (Code blocks) | ``````` ```js ... ``` ``````` | حجب الكتلة بالكامل |
| الأكواد المضمنة (Inline code) | `` `variable` `` | محجوبة |
| الأكواد القصيرة لـ Hugo (Hugo shortcodes) | `{{< figure >}}`, `{{% note %}}` | حجب الكتلة بالكامل |
| HTML خام (Raw HTML) | `<div>`, `<table>` | محجوبة |
| الروابط (URLs) | `[text](https://...)` | الاحتفاظ بالرابط، وترجمة النص |
| الاستيفاء (Interpolation) | `{{ .Count }}` | محجوبة |

## اصطلاح تسمية الملفات

يتبع نمط الترجمة حسب اسم الملف الخاص بـ Hugo:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## سلوك التخطي

**لا يتم أبداً الكتابة فوق** الملفات المترجمة الموجودة مسبقاً. إذا كان `my-post.fr.md` موجوداً بالفعل، فسيتم تخطيه. احذف الملف المستهدف لفرض إعادة الترجمة.

## الطرق الخاصة بـ Markdown فقط

:::warning[Google Translate و Markdown]
ليس لدى Google Translate **أي إدراك** بكتل الأكواد البرمجية، أو الأكواد القصيرة، أو متغيرات الاستيفاء. سيؤدي ذلك إلى إتلاف محتوى Markdown المهيكل. استخدم طرق LLM (`llm` أو `llm-coached`) لترجمة المحتوى — فهي تحجب العناصر المهيكلة بشكل صريح.
:::

عندما تتراجع ترجمة المحتوى من Google Translate إلى طريقة LLM، يسجل champollion تحذيراً يوضح السبب.
