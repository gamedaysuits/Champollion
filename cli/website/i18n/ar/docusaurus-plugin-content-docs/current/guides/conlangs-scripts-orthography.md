---
sidebar_position: 3
title: "اللغات المصطنعة وأنظمة الكتابة والإملاء"
---

# اللغات المصطنعة والأنظمة الكتابية وقواعد الإملاء

يوفر champollion دعمًا من الدرجة الأولى للغات المصطنعة (constructed languages) عبر سجلات النماذج اللغوية الكبيرة (LLM registers) ومحولات الأنظمة الكتابية الحتمية (deterministic script converters). يغطي هذا الدليل كيفية عمل دعم اللغات المصطنعة (conlang)، وما هي الخطوط التي تحتاجها، وكيفية إضافة لغتك الخاصة.

:::tip[لماذا تعتبر اللغات المصطنعة مهمة]
اللغات المصطنعة ليست مجرد حداثة — فهي تختبر نفس البنية التحتية المستخدمة للغات الحقيقية غير المخدومة بشكل كافٍ. تعمل بوابة الجودة (quality gate)، ونظام التدريب (coaching system)، ومسار تحويل الأنظمة الكتابية بشكل متطابق مع لغتي Klingon و Plains Cree. إذا كان مسار اللغة المصطنعة الخاص بك يعمل، فإن مسار اللغة منخفضة الموارد سيعمل أيضًا.
:::

---

## اللغات المصطنعة المدعومة

| اللغة | الرمز | محول النظام الكتابي | الخط المطلوب |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ Romanization → pIqaD | خط PUA (مثل pIqaD qolqoS) |
| Sindarin (Tolkien Elvish) | `x-elvish-s` | ✅ Latin → Tengwar | خط CSUR PUA |
| Kryptonian | `x-kryptonian` | ✅ Latin → Kryptonian | خط PUA |
| Pirate English | `x-pirate` | ❌ register only | لا يوجد |
| Shakespearean English | `x-shakespeare` | ❌ register only | لا يوجد |
| Yoda-speak | `x-yoda` | ❌ register only | لا يوجد |

تستخدم رموز اللغات المصطنعة البادئة `x-` وفقًا لاتفاقية الاستخدام الخاص BCP-47، باستثناء لغة Klingon (`tlh`) التي تحتوي على رمز [ISO 639-3](https://iso639-3.sil.org/code/tlh) مخصص من قبل SIL International.

---

## متطلبات Unicode و PUA والخطوط

### منطقة الاستخدام الخاص (Private Use Area)

تستخدم لغات Klingon (pIqaD) و Sindarin (Tengwar) و Kryptonian رموز **منطقة الاستخدام الخاص (PUA)** في Unicode. منطقة PUA هي النطاق U+E000–U+F8FF — وهذه النقاط الرمزية (codepoints) **ليس لها تعيين قياسي**. يحتفظ [سجل ConScript Unicode (CSUR)](https://www.evertype.com/standards/csur/) بتعيينات متفق عليها مجتمعيًا للأنظمة الكتابية الخيالية، ولكنها ليست جزءًا من معيار Unicode.

ما يعنيه هذا عمليًا:

- يُعرض نص PUA على شكل **مربعات فارغة** (□□□) إذا لم يتم تحميل الخط الصحيح
- قد تقوم الخطوط المختلفة بتعيين أشكال (glyphs) مختلفة لنفس النقاط الرمزية في PUA
- لا يقوم champollion بتضمين خطوط PUA — يجب عليك تحميلها بنفسك
- لن تقوم خطوط النظام أبدًا بعرض هذه الرموز

### نطاقات PUA حسب النظام الكتابي

| النظام الكتابي | نطاق PUA | مرجع CSUR |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elvish) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | يختلف حسب الخط | لا يوجد معيار CSUR |

### تحميل خطوط الويب PUA

يتضمن champollion أمرًا مدمجًا لتنزيل وإدارة خطوط الويب PUA:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

يقوم الأمر `fonts install` بالتنزيل من مستودعات مفتوحة المصدر تم التحقق منها:

| الخط | النظام الكتابي | الترخيص | المصدر |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (مع استثناء الخط) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(مقدم من المستخدم)* | Kryptonian | يختلف | لا يتوفر خط PUA مفتوح المصدر |

يتم اكتشاف دليل المخرجات تلقائيًا من بنية مشروعك (Docusaurus → `static/fonts/`، Hugo → `static/fonts/`، الافتراضي → `public/fonts/`). يمكنك تجاوزه باستخدام `--dir`.

إذا كنت تفضل إدارة الخطوط يدويًا، أضف قواعد `@font-face` في ملف CSS الخاص بك:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[دعم Unicode غير مضمون]
لقد [رفض اتحاد Unicode صراحةً](https://www.unicode.org/faq/private_use.html) ترميز الأنظمة الكتابية الخيالية في المعيار. يتم الحفاظ على تعيينات PUA من قبل المجتمع وقد تتعارض بين تطبيقات الخطوط المختلفة. حدد دائمًا الخط الدقيق الذي يستخدمه مشروعك، واختبر العرض عبر المتصفحات.
:::

---

## محولات الأنظمة الكتابية

### كيف تعمل

يعد تحويل النظام الكتابي في champollion بمثابة **خطاف ما بعد الترجمة (post-translation hook)، يتم تطبيقه فقط عندما يطلب التكوين ذلك**:

1. يترجم النموذج اللغوي الكبير (LLM) النص إلى **نظام كتابي للعمل** (عادةً Latin أو SRO)
2. تتحقق [بوابة الجودة](/docs/concepts/quality-gate) من صحة المخرجات
3. إذا كان إعداد `script:` للزوج يحدد نظام العرض الكتابي، يقوم المحول الحتمي بتحويل النص الذي تم التحقق من صحته — القيم التي تحتوي على أحرف لا يمكن للمحول تعيينها تبقى كاملة في نظام العمل الكتابي، مع إصدار تحذير لكل مفتاح
4. تُكتب النتيجة على القرص

يعمل هذا النهج المكون من خطوتين لأن النماذج اللغوية الكبيرة (LLMs) تنتج مخرجات أفضل عند العمل بالأنظمة الكتابية المعتمدة على اللاتينية. يضمن المحول الحتمي مخرجات صحيحة للنظام الكتابي دون الاعتماد على معرفة النموذج (التي غالبًا ما تكون غير موثوقة) بالنظام الكتابي.

ما إذا كانت الخطوة 3 تعمل على الإطلاق هو قرار يخص كل مشروع — راجع [تحويل النظام الكتابي](/docs/getting-started/configuration#script-conversion). يتم إيقاف تشغيل أنظمة العرض الكتابية PUA (pIqaD و Tengwar و Kryptonian) افتراضيًا لأنها لا تُعرض كأي شيء بدون خط مصمم خصيصًا؛ لا يوجد إعداد افتراضي لـ crk و sr على الإطلاق، لأن كلا نظامي الإملاء الخاصين بهما حقيقيان والاختيار يعود للمشروع.

### المحولات الخمسة جميعها

يأتي champollion مزودًا بخمسة محولات مدمجة للأنظمة الكتابية:

#### Plains Cree: SRO → Syllabics (`crk`)

من الإملاء الروماني القياسي (Standard Roman Orthography) إلى المقاطع الكندية الأصلية (Canadian Aboriginal Syllabics).

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

تستخدم حروف العلة الطويلة علامات التشكيل (macron/circumflex): ê, î, ô, â. يتعامل المحول مع جميع علامات التشكيل الخاصة بـ SRO ويعينها إلى الأحرف المقطعية الصحيحة. راجع [دعم لغة منخفضة الموارد](/docs/network/community/low-resource-languages) للحصول على مسار Cree الكامل.

#### Serbian: Latin → Cyrillic (`sr`)

تحويل حتمي من اللاتينية إلى السيريلية للغة الصربية.

```
Input:  "zdravo"
Output: "здраво"
```

يتعامل هذا مع التعيين الكامل للأبجدية الصربية بما في ذلك الحروف المزدوجة (digraphs) (lj → љ, nj → њ, dž → џ).

#### Klingon: Romanization → pIqaD (`tlh`)

نظام الكتابة بالحروف اللاتينية (romanization) الخاص بـ Marc Okrand إلى رموز pIqaD PUA.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

تعيين Tengwar في وضع Sindarin الخاص بـ Tolkien.

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian: Latin → Kryptonian (`x-kryptonian`)

تعيين النظام الكتابي Kryptonian الخاص بمعجم المعجبين.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### تشغيل المحول

قم بتعيين الحقل `script` إلى رمز ISO 15924 الخاص بنظام الإملاء الذي تريد كتابته:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

لا يتم تحويل أي شيء بدون هذا. بالنسبة لـ `crk` و `sr`، يكون الحقل **مطلوبًا** — كلا نظامي الإملاء الخاصين بهما حقيقيان، ويرفض `sync` اختيار أحدهما لك. بالنسبة لإعدادات PUA المحلية، فهو خيار اشتراك (opt-in) فوق الإعداد الافتراضي للكتابة بالحروف اللاتينية (romanization). راجع [تحويل النظام الكتابي](/docs/getting-started/configuration#script-conversion).

---

## اللغات متعددة الأنظمة الكتابية

تستخدم بعض اللغات الحقيقية أنظمة كتابية نشطة متعددة:

| اللغة | الأنظمة الكتابية | نهج champollion |
|----------|---------|-----------------|
| Serbian | Latin + Cyrillic | إعداد محلي واحد، اختيار صريح: `"script": "Cyrl"` يقوم بالتحويل، `"script": "Latn"` يحتفظ باللاتينية |
| Plains Cree | SRO (Latin) + Syllabics | إعداد محلي واحد، اختيار صريح: `"script": "Cans"` أو `"script": "Latn"` |
| Chinese | Simplified + Traditional | رموز إعدادات محلية منفصلة (`zh` مقابل `zh-TW`) مع سجلات مميزة |

بالنسبة للغات التي يخدم فيها كلا النظامين الكتابيين نفس الجمهور (Serbian و Plains Cree)، فإن إعدادًا محليًا واحدًا بالإضافة إلى اختيار `script` صريح يحافظ على مسار ترجمة واحد. بالنسبة للغات التي تخدم فيها الأنظمة الكتابية جماهير مختلفة (الصينية المبسطة للبر الرئيسي للصين، والتقليدية لتايوان/هونغ كونغ)، استخدم رموز إعدادات محلية منفصلة.

---

## ملاحظات حول قواعد الإملاء

السجلات (Registers) ليست مجرد نبرة — فهي تحمل **تعليمات إملائية** توجه النموذج اللغوي الكبير (LLM) نحو اصطلاحات الكتابة الصحيحة.

### صيغ المخاطبة الرسمية

تتضمن السجلات المدمجة في champollion صيغة المخاطبة الرسمية المناسبة ثقافيًا لكل لغة:

| اللغة | الصيغة الرسمية | تعليمة السجل |
|----------|------------|---------------------|
| German | Sie | `Use Sie-form for formal address` |
| French | vous | `Use vous-form` |
| Russian | вы | `Professional register with вы-form` |
| Turkish | siz | `Professional register with siz-form` |
| Korean | 합쇼체 | `Formal Korean (합쇼체)` |
| Japanese | です/ます | `Polite professional register (です/ます form)` |
| Polish | Pan/Pani | `Professional register with Pan/Pani form` |

### الكتابة الشاملة للجنسين

تحتوي كل بطاقة لغة على حقل `gender.inclusiveGuidance` يتضمن نصائح خاصة باللغة. يتم حقن هذا في موجه ترجمة النموذج اللغوي الكبير (LLM) بشكل منفصل عن الإعداد المسبق للسجل، بحيث يتم تطبيقه باستمرار بغض النظر عن الإعداد المسبق للرسمية الذي يختاره المستخدم:

- **French**: الكتابة الشاملة (Écriture inclusive) مع تدوين النقطة الوسطى (مثل "Connecté·e")
- **German**: تدوين النقطتين (Doppelpunkt) (مثل "Benutzer:innen")
- **Spanish**: يُفضل إعادة الهيكلة المحايدة جنسانيًا؛ تدوين الشرطة المائلة (مثل "usuario/a") كبديل احتياطي

بالنسبة للغات التي لا تحتوي على إرشادات محددة في بطاقتها (مثل Korean واللغات المصطنعة)، يعود النظام إلى قاعدة عامة: *"تفضيل الصيغ المحايدة جنسانيًا أو الخيار الأكثر شمولاً المتاح."*

### متطلبات الأنظمة الكتابية من اليمين إلى اليسار (RTL)

تشير جميع سجلات اللغات العربية والعبرية والفارسية والأردية إلى متطلبات الكتابة من اليمين إلى اليسار: `Ensure text reads naturally in RTL layout contexts.`

### تجاوز أي سجل

كل سجل هو قيمة تكوين — يمكنك تجاوزه ليتطابق مع صوت مشروعك:

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

راجع [التكوين](/docs/getting-started/configuration) للحصول على المرجع الكامل للتكوين.

---

## إضافة لغة مصطنعة جديدة

### خطوة بخطوة

1. **اختر رمز استخدام خاص BCP-47**: استخدم البادئة `x-` (مثل `x-dothraki`، `x-valyrian`).

2. **أضفه إلى التكوين الخاص بك**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(اختياري) أضف محول نظام كتابي**: إذا كانت لغتك المصطنعة تستخدم نظام عرض كتابي غير لاتيني، أضف محولًا في `lib/scripts.js` وقم بتسجيله في `SCRIPT_CONVERTERS`.

4. **الاختبار**: قم بتشغيل `champollion sync --dry` لمعاينة الترجمات دون كتابة الملفات.

5. **تحقق من بوابة الجودة**: قد تحتاج [بوابة الجودة](/docs/concepts/quality-gate) إلى ضبط للغتك المصطنعة — خاصة فحص `requireNonLatin` إذا كانت لغتك المصطنعة تستخدم رموز PUA.

:::note[تعتمد جودة اللغة المصطنعة على معرفة النموذج اللغوي الكبير (LLM)]
لا يمكن للنموذج اللغوي الكبير الترجمة إلا إلى لغة مصطنعة رآها في بيانات التدريب. تعمل اللغات المصطنعة الموثقة جيدًا (Klingon و Sindarin و Dothraki) بشكل جيد. قد تنتج اللغات المصطنعة الغامضة أو المخترعة حديثًا نتائج غير متسقة. استخدم [بيانات التدريب (coaching data)](/docs/concepts/coaching-data) لتحسين الجودة.
:::

---

## انظر أيضًا

- [اللغات المدعومة](/docs/reference/supported-languages) — جدول اللغات الكامل مع توفر الطرق
- [محولات الأنظمة الكتابية](/docs/concepts/script-converters) — التفاصيل الفنية لمسار التحويل
- [طرق الترجمة](/docs/guides/translation-methods) — كيف تعمل كل طريقة ترجمة
- [التكوين](/docs/getting-started/configuration) — مرجع التكوين بما في ذلك إعداد اللغة والسجل
- [دعم لغة منخفضة الموارد](/docs/network/community/low-resource-languages) — نفس البنية التحتية المطبقة على اللغات الحقيقية غير المخدومة بشكل كافٍ
