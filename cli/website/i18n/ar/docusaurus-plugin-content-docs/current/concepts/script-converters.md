---
sidebar_position: 6
title: "محولات أنظمة الكتابة"
---

# محولات النصوص

محولات النصوص هي خطافات (hooks) حتمية تعمل بعد الترجمة ولا تعتمد على النماذج اللغوية الكبيرة (LLM-free)، وتقوم بتحويل النص من نظام كتابة إلى آخر. وهي تتيح سير عمل يعتمد على مبدأ "ترجم مرة واحدة، واعرض بعدة نصوص" — حيث تقوم بالترجمة إلى نص العمل (عادةً اللاتيني)، ثم يتم التحويل إلى نص العرض تلقائيًا.

## لماذا نستخدم محولات النصوص؟

تستخدم بعض اللغات أنظمة كتابة متعددة لنفس اللغة المنطوقة:

- **لغة Plains Cree**: نظام SRO (اللاتيني) للتحرير ← المقاطع (Syllabics) (ᓀᐦᐃᔭᐍᐏᐣ) للعرض
- **الصربية**: اللاتينية للاستخدام الدولي ← السيريلية للاستخدام المحلي
- **الكلينغونية (Klingon)**: الرومنة (Romanization) للكتابة ← pIqaD (  ) للعرض

تؤدي الترجمة المباشرة إلى نصوص غير لاتينية إلى حدوث مشكلات: حيث تهلوس النماذج اللغوية الكبيرة (LLMs) في الحروف، وتصبح ملفات JSON صعبة في التحكم في الإصدارات (version-control)، ولا تستطيع أدوات المقارنة (diff tools) مقارنة التغييرات. تحل محولات النصوص هذه المشكلة عن طريق الاحتفاظ بالترجمات في نص متوافق مع أنظمة التحكم في الإصدارات وتحويلها بشكل حتمي في وقت المزامنة.

## المحولات المتاحة

يأتي Champollion مزودًا بخمسة محولات نصوص مدمجة:

| الإعداد المحلي (Locale) | من | إلى | النوع | هل يتطلب خطًا؟ |
|--------|------|----|------|----------------|
| `crk` | SRO (الأبجدية الرومانية القياسية) | مقاطع Cree (Cree Syllabics) | حتمي (Deterministic) | لا — Unicode أصلي |
| `sr` | اللاتينية | السيريلية | حتمي | لا — Unicode أصلي |
| `tlh` | الرومنة (Romanization) | pIqaD | حتمي | نعم — PUA U+F8D0–F8FF |
| `x-elvish-s` | اللاتينية | Tengwar (وضع Beleriand) | حتمي | نعم — PUA U+E000–E07F |
| `x-kryptonian` | اللاتينية | Kryptonian | تشفير يعتمد على الخط | نعم — PUA U+E100–E119 |

### المحولات الحتمية مقابل المعتمدة على الخطوط

- **المحولات الحتمية** (Cree، الصربية، Klingon، Tengwar) تقوم بتعيين حقيقي من حرف إلى حرف باستخدام قواعد لغوية. يحتوي المخرجات على حروف Unicode فعلية.
- **المحولات المعتمدة على الخطوط** (Kryptonian) هي شفرات استبدال بنسبة 1:1 حيث تكون المخرجات عبارة عن حروف Unicode PUA لا تُعرض بشكل صحيح إلا عند تحميل خط معين.

## كيف تعمل

تعمل محولات النصوص **بعد** الترجمة كخطوة معالجة لاحقة. يكون مسار العمل (pipeline) كالتالي:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

على سبيل المثال، لغة Plains Cree:
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### المطابقة النهمة من اليسار إلى اليمين (Greedy Left-to-Right Matching)

تستخدم جميع المحولات نفس الخوارزمية: في كل موضع حرف، يتم تجربة أطول مطابقة ممكنة أولاً، ثم المطابقات الأقصر تدريجيًا. الحروف التي لا تتطابق مع أي نمط (المسافات، علامات الترقيم، الأرقام) تمر دون تغيير.

يعالج هذا الحروف المزدوجة (digraphs) والثلاثية (trigraphs) بشكل صحيح:
- الكلينغونية (Klingon): `tlh` ← حرف pIqaD واحد (وليس `t` + `l` + `h`)
- الصربية: `nj` ← `њ` (وليس `н` + `ј`)
- لغة Cree: `twê` ← مقطع لفظي واحد (وليس `t` + `w` + `ê`)

## استخدام محولات النصوص

التحويل هو **قرار يتم عبر الإعدادات، وليس تلقائيًا أبدًا** (بدءًا من الإصدار 0.3.0 — كانت الإصدارات السابقة تقوم بالتحويل دون قيد أو شرط، مما أدى إلى إرسال نصوص PUA غير قابلة للعرض إلى المشاريع التي تتوقع خطوطها نقلاً حرفيًا لاتينيًا):

- **اللغتان crk و sr لهما نظاما كتابة حقيقيان** (SRO/المقاطع، اللاتينية/السيريلية). لا يوجد إعداد افتراضي: يسأل `champollion init` عن النظام المراد كتابته، ويرفض `sync` التشغيل حتى يتم تحديده في الإعدادات. لا يختار Champollion نظام الكتابة الخاص بالمجتمع نيابة عنه.
- **اللغات tlh و x-elvish-s و x-kryptonian تعتمد الرومنة (romanization) كإعداد افتراضي** — نصوص العرض الخاصة بها تقع في منطقة الاستخدام الخاص (Private Use Area)، ولا يمكن عرضها بدون خط خاص. يجب تفعيلها صراحةً.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

عندما يقوم champollion بمزامنة `en:crk` مع `"script": "Cans"`، يتم إنتاج الترجمات بنظام SRO (نص العمل الذي تتحقق منه البوابة)، ثم يتم تحويلها إلى المقاطع (Syllabics) قبل كتابتها في `crk.json`. مع `"script": "Latn"` — أو للغة tlh بدون `script:` على الإطلاق — يكون نص العمل هو المُخرج النهائي ولا يتم تحويل أي شيء.

الحروف التي لا يستطيع المحول تعيينها (لا تحتوي الكلينغونية على `d`، `c`، `f`، `g`، `i`، `k`، `s`، `x`، `z` — لذا لا يمكن تحويل كلمة "GitHub" بالكامل) تحتفظ **بالقيمة كاملة** في نص العمل بدلاً من خلط النصوص، مع ظهور تحذير يذكر أسماء الحروف. يمكنك الإعلان عن قواعد النقل الحرفي الخاصة بك باستخدام [`scriptFallback`](/docs/getting-started/configuration#script-fallback).

للتراجع عن التحويل الذي حدث عندما كان غير مشروط، قم بتشغيل [`champollion repair-script`](/docs/getting-started/configuration#repair-script)؛ يفشل `champollion integrity` عند العثور على PUA في الأماكن التي يكون فيها التحويل متوقفًا.

### التحقق من حالة المحول

```bash
npx champollion status
```

تُظهر مخرجات الحالة قرار النص الذي تم حله لكل زوج — ما سيتم كتابته، وما إذا كان المحول متاحًا ولكنه غير مفعل.

## متطلبات خطوط الويب

تُخرج ثلاثة محولات حروفًا من منطقة الاستخدام الخاص (PUA) في Unicode والتي تتطلب خطوط ويب مخصصة:

### الكلينغونية (pIqaD)

قم بتثبيت خط pIqaD متوافق مع CSUR (مثل "pIqaD qolqoS" أو "Klingon pIqaD HaSta"):

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar (Sindarin)

قم بتثبيت خط Tengwar متوافق مع CSUR (مثل "Tengwar Formal CSUR" أو "Tengwar Annatar"):

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### Kryptonian

قم بتثبيت خط Kryptonian معين إلى نقاط تشفير PUA من U+E100 إلى U+E119:

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[نهج بديل لـ Kryptonian]
نظرًا لأن Kryptonian عبارة عن شفرة خالصة من A إلى Z، يمكنك تخطي محول النصوص تمامًا وتطبيق الخط على النص اللاتيني عبر CSS. غالبًا ما يكون هذا أبسط لعمليات النشر على الويب — ما عليك سوى تقديم خط Kryptonian وتعيين `font-family` على العناصر ذات الصلة.
:::

## إضافة محول مخصص

لإضافة محول للغة جديدة، قم بتعديل `lib/scripts.js`:

1. **إنشاء خريطة التحويل** — مصفوفة مرتبة من أزواج `[from, to]`، بحيث تكون التسلسلات الأطول أولاً
2. **إنشاء دالة المحول** — ماسح ضوئي نهم من اليسار إلى اليمين (استخدم `sroToSyllabics` كقالب)
3. **تسجيله** في كائن `SCRIPT_CONVERTERS` باستخدام رمز الإعداد المحلي (locale code) كمفتاح
4. **إضافة حقل `script`** إلى إدخال سجل اللغة في `registers.js`

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## انظر أيضًا

- [اللغات المصطنعة، النصوص وأنظمة الكتابة](/docs/guides/conlangs-scripts-orthography) — خطوط PUA، وUnicode، وإضافة محولات جديدة
- [بوابة الجودة (Quality Gate)](/docs/concepts/quality-gate) — التحقق الذي يتم تشغيله قبل تحويل النص
- [اللغات المدعومة](/docs/reference/supported-languages) — اللغات التي تحتوي على محولات نصوص
- [دعم لغة قليلة الموارد](/docs/network/community/low-resource-languages) — تحويل SRO إلى المقاطع (Syllabics) في السياق
- [كتاب الوصفات: مسار عمل FST-Gated](/docs/network/tutorials/fst-gated-pipeline) — تحويل النصوص في مسار عمل متعدد المراحل
