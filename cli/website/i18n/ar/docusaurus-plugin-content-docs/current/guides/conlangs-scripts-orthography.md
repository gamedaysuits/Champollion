---
sidebar_position: 3
title: "اللغات المصطنعة وأنظمة الكتابة وقواعد الإملاء"
---

# اللغات المصطنعة وأنظمة الكتابة وقواعد الإملاء

يوفر champollion دعمًا من الدرجة الأولى للغات المصطنعة (conlangs) عبر أساليب النماذج اللغوية (LLM registers) ومحولات أنظمة الكتابة الحتمية. يوضح هذا الدليل كيفية عمل دعم اللغات المصطنعة، والخطوط التي تحتاج إليها، وكيفية إضافة لغتك الخاصة.

:::tip[أهمية اللغات المصطنعة]
اللغات المصطنعة ليست مجرد وسيلة للتسلية والابتكار — بل هي تطبيق عملي لنفس البنية التحتية المستخدمة للغات الحقيقية ذات الموارد المحدودة. تعمل بوابة الجودة (quality gate)، ونظام التوجيه والتدريب (coaching system)، ومسار تحويل أنظمة الكتابة بالطريقة نفسها تمامًا لكل من لغة Klingon ولغة Plains Cree. إذا نجح مسار العمل لديك مع اللغات المصطنعة، فسيعمل أيضًا مع اللغات منخفضة الموارد.
:::

---

## اللغات المصطنعة المدعومة

| اللغة | الرمز | محول نظام الكتابة | الخط المطلوب |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ الحروف اللاتينية ← pIqaD | خط PUA (مثل pIqaD qolqoS) |
| Sindarin (إلفية تولكين) | `x-elvish-s` | ✅ اللاتينية ← Tengwar | خط CSUR PUA |
| Kryptonian | `x-kryptonian` | ✅ اللاتينية ← Kryptonian | خط PUA |
| Pirate English | `x-pirate` | ❌ أسلوب فقط (register only) | لا شيء |
| Shakespearean English | `x-shakespeare` | ❌ أسلوب فقط (register only) | لا شيء |
| Yoda-speak | `x-yoda` | ❌ أسلوب فقط (register only) | لا شيء |

تستخدم رموز اللغات المصطنعة البادئة `x-` وفقًا لعرف الاستخدام الخاص لمعيار BCP-47، باستثناء Klingon (`tlh`) التي تمتلك رمز [ISO 639-3](https://iso639-3.sil.org/code/tlh) مخصصًا من قِبل منظمة SIL International.

---

## متطلبات خطوط Unicode وPUA

### منطقة الاستخدام الخاص (PUA)

تستخدم كل من Klingon (pIqaD) وSindarin (Tengwar) وKryptonian محارف **منطقة الاستخدام الخاص (PUA)** في ترميز Unicode. نطاق PUA هو U+E000–U+F8FF — وهذه النقاط البرمجية **ليس لها تعيين قياسي رسمي**. يحتفظ [سجل ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) بتعيينات متفق عليها مجتمعيًا لأنظمة الكتابة الخيالية، إلا أنها ليست جزءًا من معيار Unicode الرسمي.

ما يعنيه هذا عمليًا:

- تظهر نصوص PUA على هيئة **مربعات فارغة** (□□□) ما لم يتم تحميل الخط الصحيح
- قد تعين خطوط مختلفة أشكالًا رسومية مختلفة لنفس النقاط البرمجية في PUA
- لا يرفق champollion خطوط PUA تلقائيًا — يجب عليك تحميلها بنفسك
- لن تقوم خطوط النظام أبدًا بعرض هذه المحارف بالشكل الصحيح

### نطاقات PUA حسب نظام الكتابة

| نظام الكتابة | نطاق PUA | مرجع CSUR |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (الإلفية) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | يختلف باختلاف الخط | لا يوجد معيار CSUR |

### تحميل خطوط الويب لمنطقة PUA

يتضمن champollion أمرًا مدمجًا لتنزيل خطوط الويب الخاصة بـ PUA وإدارتها:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

يقوم الأمر `fonts install` بالتنزيل من مستودعات مفتوحة المصدر تم التحقق منها:

| الخط | نظام الكتابة | الترخيص | المصدر |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | رخصة SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | رخصة GNU GPL v3 (مع استثناء الخطوط) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(مقدم من المستخدم)* | Kryptonian | يختلف | لا يتوفر خط PUA مفتوح المصدر |

يتم اكتشاف دليل المخرجات تلقائيًا بناءً على بنية مشروعك (Docusaurus ← `static/fonts/`، Hugo ← `static/fonts/`، الافتراضي ← `public/fonts/`). يمكنك تجاوزه باستخدام `--dir`.

إذا كنت تفضل إدارة الخطوط يدويًا، فأضف قواعد `@font-face` في ملفات CSS الخاصة بك:

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
رفض مجمع Unicode (The Unicode Consortium) [صراحةً](https://www.unicode.org/faq/private_use.html) ترميز أنظمة الكتابة الخيالية ضمن المعيار الرسمي. يتم الحفاظ على تعيينات PUA من قِبل المجتمع وقد تتعارض بين تنفيذات الخطوط المختلفة. حدد دائمًا الخط الدقيق الذي يستخدمه مشروعك، واختبر طريقة العرض عبر مختلف المتصفحات.
:::

---

## محولات أنظمة الكتابة

### آلية العمل

يعد تحويل نظام الكتابة في champollion **خطوة ما بعد الترجمة (post-translation hook)، ولا يُطبق إلا عند طلبه صراحةً في التكوين**:

1. يترجم النموذج اللغوي (LLM) النص إلى **نظام كتابة تشغيلي** (عادةً اللاتينية أو SRO)
2. تتحقق [بوابة الجودة](/docs/concepts/quality-gate) من صحة المخرجات
3. إذا حدد إعداد `script:` للزوج نظام كتابة العرض، يقوم المحول الحتمي بتحويل النص الذي تم التحقق منه — مع إبقاء القيم التي تحتوي على حروف يعجز المحول عن تعيينها كاملةً بنظام الكتابة التشغيلي، مع إطلاق تحذير لكل مفتاح
4. تُكتب النتيجة على القرص

يعمل هذا النهج المكون من خطوتين لأن النماذج اللغوية تعطي نتائج أفضل عند العمل بالأنظمة القائمة على الحروف اللاتينية. ويضمن المحول الحتمي مخرجات صحيحة لنظام الكتابة دون الاعتماد على معرفة النموذج اللغوي (التي غالبًا ما تكون غير موثوقة) بهذا النظام.

ما إذا كانت الخطوة 3 ستعمل أم لا هو قرار يعود لكل مشروع — راجع [تحويل نظام الكتابة](/docs/getting-started/configuration#script-conversion). تكون أنظمة كتابة العرض لـ PUA (مثل pIqaD وTengwar وKryptonian) معطلة افتراضيًا لأنها لا تظهر على الإطلاق بدون خط مخصص لها؛ بينما لا تملك اللغتان crk وsr أي إعداد افتراضي على الإطلاق، لأن كلا نظامي الكتابة لهما حقيقيان ويعود الخيار للمشروع نفسه.

### المحولات الخمسة كاملة

يأتي champollion مزودًا بخمسة محولات مدمجة لأنظمة الكتابة:

#### Plains Cree: من SRO إلى المقاطع اللفظية (`crk`)

من قواعد الإملاء اللاتينية القياسية (SRO) إلى المقاطع اللفظية للسكان الأصليين في كندا (Canadian Aboriginal Syllabics).

```
Input:  "pâ tê ki"    (syllables, a spelling example — not a word)
Output: "ᐹ ᑌ ᑭ"
```

تستخدم حروف العلة الطويلة علامة الثنية circumflex (أو الماكرون macron): ê، î، ô، â. يتم التحويل بواسطة `cree-sro-syllabics`، وهو المحول المدعوم مجتمعيًا الذي يستخدمه مشروع itwêwina التابع لـ ALTLab؛ وتبقى العناصر النائبة وبنية ICU والوسوم وعناوين URL دون أي تعديل. راجع [دعم لغة منخفضة الموارد](/docs/network/community/low-resource-languages) للاطلاع على مسار عمل لغة Cree بالكامل.

#### الصربية: من اللاتينية إلى السيريلية (`sr`)

تحويل حتمي من اللاتينية إلى السيريلية للغة الصربية.

```
Input:  "zdravo"
Output: "здраво"
```

يتعامل هذا المحول مع التعيين الكامل للأبجدية الصربية بما في ذلك الحروف المزدوجة (lj ← љ، nj ← њ، dž ← џ).

#### Klingon: من الكتابة بالحروف اللاتينية إلى pIqaD (`tlh`)

من نظام الكتابة بالحروف اللاتينية لمارك أوكراند إلى محارف PUA لنظام pIqaD.

```
Input:  "tlh gh Q"   (romanized letters, a spelling example — tlh is one letter)
Output: [pIqaD PUA]  (requires pIqaD font to render)
```

#### Sindarin: من اللاتينية إلى Tengwar (`x-elvish-s`)

تعيين Tengwar لنمط Sindarin الخاص بتولكين.

```
Input:  "la ne mi"   (Latin letters, a spelling example — not a word)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian: من اللاتينية إلى Kryptonian (`x-kryptonian`)

تعيين نظام كتابة Kryptonian وفق المعجم الذي وضعه المعجبون.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### تفعيل المحول

عيّن الحقل `script` إلى رمز ISO 15924 الخاص بقواعد الإملاء التي ترغب في كتابتها:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

لن يتم تحويل أي شيء بدون هذا الإعداد. بالنسبة إلى `crk` و`sr` فإن هذا الحقل **مطلوب** — فكلا نظامي الإملاء لهما حقيقيان، ويرفض `sync` اختيار أحدهما بالنيابة عنك. أما بالنسبة للغات PUA، فهو خيار تفعيل اختياري بديل عن الكتابة اللاتينية الافتراضية. راجع [تحويل نظام الكتابة](/docs/getting-started/configuration#script-conversion).

---

## اللغات متعددة أنظمة الكتابة

تستخدم بعض اللغات الحقيقية أنظمة كتابة نشطة متعددة:

| اللغة | أنظمة الكتابة | نهج champollion |
|----------|---------|-----------------|
| الصربية | اللاتينية + السيريلية | إعداد لغة واحد (locale)، وخيار صريح: `"script": "Cyrl"` يحول، و`"script": "Latn"` يبقي على اللاتينية |
| Plains Cree | SRO (اللاتينية) + المقاطع اللفظية | إعداد لغة واحد، وخيار صريح: `"script": "Cans"` أو `"script": "Latn"` |
| الصينية | المبسطة + التقليدية | رمزا لغة منفصلان (`zh` مقابل `zh-TW`) بأسلوبين متميزين |

بالنسبة للغات التي يخدم فيها كلا نظامي الكتابة نفس الجمهور (مثل الصربية وPlains Cree)، فإن استخدام إعداد لغة واحد مع تحديد خيار `script` صريح يحافظ على مسار ترجمة موحد. أما اللغات التي تخدم أنظمة كتابتها جماهير مختلفة (مثل الصينية المبسطة للصين البر الرئيسي، والتقليدية لتايوان وهونغ كونغ)، فينبغي استخدام رموز لغات منفصلة.

---

## ملاحظات حول قواعد الإملاء

الأساليب (Registers) ليست مجرد نبرة لغوية — بل تحمل **تعليمات إملائية** توجه النموذج اللغوي نحو الاصطلاحات الكتابية الصحيحة.

### صيغ الخطاب الرسمي

تتضمن الأساليب المدمجة في champollion صيغة الخطاب الرسمي المناسبة ثقافيًا لكل لغة:

| اللغة | الصيغة الرسمية | تعليمات الأسلوب |
|----------|------------|---------------------|
| الألمانية | Sie | `Use Sie-form for formal address` |
| الفرنسية | vous | `Use vous-form` |
| الروسية | вы | `Professional register with вы-form` |
| التركية | siz | `Professional register with siz-form` |
| الكورية | 합쇼체 | `Formal Korean (합쇼체)` |
| اليابانية | です/ます | `Polite professional register (です/ます form)` |
| البولندية | Pan/Pani | `Professional register with Pan/Pani form` |

### الكتابة الشاملة للجنسين

تحتوي كل بطاقة لغة على حقل `gender.inclusiveGuidance` يتضمن إرشادات مخصصة لتلك اللغة. يتم إدراج هذا الحقل في مطالبة الترجمة للنموذج اللغوي بمعزل عن إعدادات الأسلوب المسبقة، مما يجعله يُطبق بانسجام بصرف النظر عن مستوى الرسمية الذي يختاره المستخدم:

- **الفرنسية**: الكتابة الشاملة (Écriture inclusive) باستخدام النقطة الوسطى (مثل "Connecté·e")
- **الألمانية**: كتابة النقطتين الرأسيتين (Doppelpunkt notation، مثل "Benutzer:innen")
- **الإسبانية**: يُفضّل إعادة الصياغة المحايدة جنسانيًا؛ واستخدام الشرطة المائلة (مثل "usuario/a") كخيار احتياطي

بالنسبة للغات التي لا تتوفر لها إرشادات محددة في بطاقتها (مثل الكورية واللغات المصطنعة)، يرجع النظام إلى قاعدة عامة: *"فضّل الصيغ المحايدة جنسانيًا أو الخيار الأكثر شمولاً المتاح."*

### متطلبات أنظمة الكتابة من اليمين إلى اليسار (RTL)

تشير أساليب اللغات العربية والعبرية والفارسية والأردية جميعها إلى متطلبات الكتابة من اليمين إلى اليسار: `Ensure text reads naturally in RTL layout contexts.`

### تخصيص أي أسلوب

كل أسلوب هو عبارة عن قيمة تكوين — يمكنك تخصيصه ليلائم نبرة مشروعك:

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

راجع صفحة [التكوين](/docs/getting-started/configuration) للاطلاع على مرجع التكوين الكامل.

---

## إضافة لغة مصطنعة جديدة

### خطوة بخطوة

1. **اختر رمز استخدام خاص بمعيار BCP-47**: استخدم البادئة `x-` (مثل `x-dothraki`، و`x-valyrian`).

2. **أضف الرمز إلى ملف التكوين**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(اختياري) أضف محول نظام كتابة**: إذا كانت لغتك المصطنعة تستخدم نظام كتابة للعرض غير لاتيني، فأضف محولاً في `lib/scripts.js` وسجّله في `SCRIPT_CONVERTERS`.

4. **الاختبار**: شغّل الأمر `champollion sync --dry` لمعاينة الترجمات دون كتابة الملفات.

5. **تحقق من بوابة الجودة**: قد تحتاج [بوابة الجودة](/docs/concepts/quality-gate) إلى ضبط دقيق للغتك المصطنعة — لا سيما فحص `requireNonLatin` إذا كانت لغتك المصطنعة تستخدم محارف PUA.

:::note[جودة اللغة المصطنعة تعتمد على معرفة النموذج اللغوي]
لا يمكن للنموذج اللغوي الترجمة إلى لغة مصطنعة إلا إذا كان قد رآها في بيانات التدريب. وتعمل اللغات المصطنعة الموثقة جيدًا (مثل Klingon وSindarin وDothraki) بشكل ممتاز. أما اللغات المصطنعة المغمورة أو الحديثة فقد تعطي نتائج غير متسقة. استخدم [بيانات التدريب والتوجيه](/docs/concepts/coaching-data) لتحسين الجودة.
:::

---

## انظر أيضًا

- [اللغات المدعومة](/docs/reference/supported-languages) — جدول اللغات الكامل مع مدى توفر الطرق
- [محولات أنظمة الكتابة](/docs/concepts/script-converters) — التفاصيل التقنية لمسار التحويل
- [طرق الترجمة](/docs/guides/translation-methods) — كيفية عمل كل طريقة من طرق الترجمة
- [التكوين](/docs/getting-started/configuration) — مرجع التكوين بما في ذلك إعدادات اللغة والأسلوب
- [دعم لغة منخفضة الموارد](/docs/network/community/low-resource-languages) — تطبيق نفس البنية التحتية على اللغات الحقيقية ذات الموارد المحدودة
