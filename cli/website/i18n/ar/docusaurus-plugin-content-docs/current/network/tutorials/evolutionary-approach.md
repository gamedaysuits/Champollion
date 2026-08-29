---
sidebar_position: 9
title: "كتاب الوصفات: تطوري / قائم على البحث"
---

# الترجمة التطورية / القائمة على البحث

> **الفكرة:** إنشاء عدة ترجمات مرشحة، وتقييمها بناءً على دالة الملاءمة (chrF++، قبول FST، اتساق الترجمة العكسية)، ثم إحداث طفرات (تعديلات) على أفضل النتائج، وتكرار العملية. إنه الانتقاء الطبيعي للترجمات — البقاء للأصلح.

:::info[هذا دليل وصفات (cookbook)، وليس تنفيذاً نهائياً]
يُعد هذا النهج الأكثر تجريبية في سلسلة أدلة الوصفات. لم يثبت نجاحه بعد في الترجمة الآلية (MT) على نطاق واسع، ولكن البنية الهندسية سليمة، وستقوم منصة التقييم (harness) بتقييم أي مخرجات تنتجها بكل سهولة.
:::

## متى تستخدم هذا النهج

- لديك **دالة تقييم جيدة** ولكن لا يوجد نموذج واحد ينتج نتائج متسقة
- تريد **استكشاف مساحة الحلول** على نطاق أوسع من التوليد الجشع (greedy generation) الفردي
- لديك **ميزانية حوسبة** للعديد من عمليات التوليد المتوازية (عشرات المرشحين لكل مُدخل)
- أنت مهتم بـ **الأبحاث الجديدة** — هذا النهج لم يحظَ بالدراسة الكافية في الترجمة الآلية (MT) للغات منخفضة الموارد

## كيف تعمل

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## الهيكل الأساسي

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## تصميم دالة الملاءمة

دالة الملاءمة هي كل شيء. الخيارات المتاحة:

| المقياس (Metric) | ماذا يقيس | هل هو آلي؟ |
|--------|-----------------|------------|
| chrF++ مقابل المرجع | التشابه على مستوى الحروف مع النص الذهبي (gold) | ✅ نعم |
| معدل قبول FST | الصحة الصرفية | ✅ نعم (إذا كان FST متاحاً) |
| اتساق الترجمة العكسية | هل تؤدي الترجمة العكسية إلى استعادة النص المصدر؟ | ✅ نعم |
| LLM كحكم (LLM-as-judge) | نموذج LLM آخر يقيّم السلاسة/الدقة | ✅ نعم (ولكنه قد يحتوي على تشويش) |
| وجود مصطلحات القاموس | هل تظهر المصطلحات المعروفة بشكل صحيح؟ | ✅ نعم |

:::tip[الجمع بين إشارات متعددة]
يؤدي الجمع الموزون للمقاييس إلى إنشاء دالة ملاءمة أكثر قوة من أي مقياس فردي. وهذا يعكس [النتيجة المركبة](/docs/network/leaderboard/rules) الخاصة بمنصة التقييم (harness) نفسها.
:::

## الإيجابيات والسلبيات

| | |
|---|---|
| ✅ يستكشف حلولاً متنوعة | ❌ مكلف حسابياً (N × G من استدعاءات API) |
| ✅ يمكنه اكتشاف نُهج لا يجدها أي نموذج بمفرده | ❌ يتطلب دالة ملاءمة جيدة |
| ✅ قابل للتوازي | ❌ بطيء — عمليات توليد متعددة لكل ترجمة |
| ✅ مستقل عن النموذج (Model-agnostic) | ❌ تناقص الغلة (Diminishing returns) بعد بضعة أجيال |

## يندمج جيداً مع

- **[النماذج المتسلسلة (Chained Models)](./chained-models)** — خطوة إحداث الطفرة هي شكل من أشكال التسلسل
- **[مسار عمل مقيد بـ FST (FST-Gated Pipeline)](./fst-gated-pipeline)** — قبول FST كإشارة ملاءمة
- **[نموذج LLM معزز بالقاموس (Dictionary-Augmented LLM)](./dictionary-augmented-llm)** — وجود القاموس كإشارة ملاءمة

## انظر أيضًا

- [مواصفات بطاقة التشغيل (Run Card Specification)](/docs/network/specifications/run-card) — يتم تسجيل التكلفة وزمن الانتقال لكل إدخال
- [منصة التقييم (Eval Harness)](/docs/network/specifications/harness) — تقوم المنصة بتقييم مخرجاتك النهائية، وليس عمليتك
- [دعم لغة منخفضة الموارد](/docs/network/community/low-resource-languages)
