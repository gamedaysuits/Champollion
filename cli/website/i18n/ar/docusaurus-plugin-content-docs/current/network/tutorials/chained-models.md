---
sidebar_position: 6
title: "دليل الوصفات: النماذج المتسلسلة"
---

# النماذج المتسلسلة (مسار متعدد المراحل)

> **الفكرة:** يُنشئ النموذج A ترجمة أولية → يقوم النموذج B بتحريرها لاحقًا → يقوم النموذج C بتقييم النتيجة أو التحقق من صحتها. تتخصص كل مرحلة في شيء واحد. وتكون مخرجات المسار أفضل من أي نموذج منفرد.

:::info[هذا دليل وصفات (cookbook)، وليس تنفيذًا نهائيًا]
يرسم هذا الدليل بنية المسار متعدد المراحل. تعتمد النماذج المحددة وتكوين السلسلة على زوج اللغات الخاص بك وميزانيتك.
:::

## متى تستخدم هذا

- ينتج نموذج واحد **جودة غير متسقة** — جيدة في بعض المدخلات، وسيئة في أخرى
- تريد **فصل التوليد عن التحقق** — نموذج يُنشئ، وآخر ينقد
- لديك ميزانية لـ **استدعاءات API متعددة لكل ترجمة** (يتناسب زمن الوصول والتكلفة طرديًا مع عدد المراحل)
- تريد الجمع بين نماذج ذات **نقاط قوة مختلفة** (على سبيل المثال، مُولّد إبداعي + مُحرّر دقيق)

## كيف تعمل

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## مثال: مسار من ثلاث مراحل

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## أنماط السلسلة الشائعة

| النمط | المراحل | حالة الاستخدام |
|---------|--------|----------|
| **توليد → تحرير** | LLM سريع → LLM قوي | تحسين الجودة بتكلفة فعالة |
| **توليد → تحقق → إعادة محاولة** | LLM → FST/قواعد → LLM (إعادة المحاولة عند الفشل) | الصحة الصرفية (انظر [FST-Gated](./fst-gated-pipeline)) |
| **توليد → ترجمة عكسية → تقييم** | LLM(en→crk) → LLM(crk→en) → مقارنة | فحص اتساق الترجمة العكسية (Round-trip) |
| **تجميع → تصويت** | 3 نماذج LLM بشكل مستقل → تصويت الأغلبية | المتانة من خلال التنوع |

## قرارات التصميم الرئيسية

**ميزانية زمن الوصول (Latency budget):** تضاعف كل مرحلة من زمن الوصول. سلسلة من 3 مراحل تستغرق ثانيتين لكل مرحلة = 6 ثوانٍ لكل ترجمة. هذا مقبول للتقييم المجمع (batch evaluation)؛ ولكنه قد لا يكون كذلك في الوقت الفعلي.

**مضاعف التكلفة:** 3 مراحل = 3 أضعاف تكلفة API. استخدم نماذج أرخص للمراحل المبكرة، ونماذج باهظة الثمن للمراحل الحرجة.

**انتشار الخطأ:** يمكن أن تؤدي المخرجات السيئة للمرحلة الأولى إلى تضليل المرحلة الثانية. قم بتضمين المصدر الأصلي في كل مرحلة حتى تتمكن النماذج اللاحقة من التعافي.

## الإيجابيات والسلبيات

| | |
|---|---|
| ✅ يمكن الجمع بين نقاط قوة المتخصصين | ❌ يتضاعف زمن الوصول والتكلفة مع كل مرحلة |
| ✅ فصل الاهتمامات (التوليد مقابل التحقق) | ❌ معقد في تصحيح الأخطاء — أي مرحلة تسببت في الخطأ؟ |
| ✅ سهولة تبديل المراحل الفردية | ❌ انتشار الخطأ بين المراحل |
| ✅ التحقق من خلال الترجمة العكسية يكتشف الهلوسة | ❌ تناقص العوائد بعد 2-3 مراحل |

## يندمج جيدًا مع

- **[مسار مقيد بـ FST](./fst-gated-pipeline)** — استخدام FST كمرحلة تحقق
- **[نموذج LLM معزز بالقاموس](./dictionary-augmented-llm)** — حقن القاموس في مرحلة التوليد
- **[تلقين LLM الموجه](./coached-llm-prompting)** — التدريب (coaching) في مرحلة واحدة أو أكثر

## انظر أيضًا

- [منصة التقييم (Eval Harness)](/docs/network/specifications/harness) — تقيس المنصة مخرجات المسار من البداية إلى النهاية
- [مواصفات بطاقة التشغيل (Run Card Specification)](/docs/network/specifications/run-card) — يتم تسجيل زمن الوصول والتكلفة لكل إدخال
- [دعم لغة منخفضة الموارد](/docs/network/community/low-resource-languages)
