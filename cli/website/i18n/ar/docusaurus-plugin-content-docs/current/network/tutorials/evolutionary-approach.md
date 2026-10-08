---
sidebar_position: 9
title: "دليل الحلول: تطوري / قائم على البحث"
---

# الترجمة التطورية / القائمة على البحث

> **الفكرة:** توليد ترجمات مرشحة متعددة، وتقييمها وفق دالة ملاءمة (chrF++‎، وقبول FST، واتساق الترجمة العكسية)، وإجراء طفرات على أفضلها أداءً، ثم التكرار. انتخاب طبيعي للترجمات — البقاء للأصلح.

:::info[هذا دليل عملي (Cookbook)، وليس تطبيقًا نهائيًا]
هذا هو النهج الأكثر تجريبية في سلسلة أدلة العمل (Cookbook). لم يُثبت بعد كفاءته في الترجمة الآلية على نطاق واسع، ولكن بنيته المعمارية متماسكة، وستقوم بيئة التقييم (harness) بتقييم أي مخرجات ينتجها بكل سلاسة.
:::

## متى تستخدم هذا النهج

- لديك **دالة تقييم جيدة** ولكن لا يوجد نموذج منفرد ينتج نتائج متسقة
- ترغب في **استكشاف فضاء الحلول** على نطاق أوسع من التوليد الجشع (greedy generation) الفردي
- تتوفر لديك **ميزانية حوسبة** لعمليات توليد متوازية متعددة (عشرات المرشحين لكل مدخل)
- تهتم بـ **الأبحاث المبتكرة** — فهذا النهج لم يحظَ بالاستكشاف الكافي في الترجمة الآلية للغات منخفضة الموارد

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

دالة الملاءمة هي الأساس لكل شيء. الخيارات المتاحة:

| المقياس | ما يقيسه | آلي؟ |
|--------|-----------------|------------|
| chrF++‎ مقابل المرجع | التشابه على مستوى الأحرف مع المرجع المعتمد | ✅ نعم |
| معدل قبول FST | الصلاحية الصرفية | ✅ نعم (إذا كان FST متاحًا) |
| اتساق الترجمة العكسية | هل تؤدي الترجمة العكسية إلى استعادة النص المصدر؟ | ✅ نعم |
| LLM كحَكَم | يقوم LLM آخر بتقييم الطلاقة/الدقة | ✅ نعم (لكن مع بعض التشويش) |
| وجود مصطلحات القاموس | هل تظهر المصطلحات المعروفة بشكل صحيح؟ | ✅ نعم |

:::tip[الجمع بين إشارات متعددة]
يمكن للجمع بين إشارات متعددة أن يوجه البحث بشكل أفضل من الاعتماد على إشارة واحدة بمفردها. تأكد من عدم إمكانية التلاعب بالدالة: فالمزيج الذي يعتمد بكثافة على قبول FST يكافئ المخرجات الصالحة صرفيًا حتى وإن كانت غير مترجمة، ولهذا السبب تم [إيقاف المقياس المركب الموزون](/docs/network/specifications/scoring#why-the-composite-was-retired) الخاص ببيئة التقييم نفسها. ومهما كانت دالة الملاءمة التي تطور الترجمة بناءً عليها، احكم على المرشحين النهائيين بالطريقة التي تتبعها بيئة التقييم: عبر مقياس chrF++‎ مع مجال الثقة الخاص به، مقارنة باختبار دلالة إحصائية مقترن (`mt-eval compare --significance`)، مع الإبلاغ عن الإشارات الأخرى بوصفها مؤشرات تشخيصية.
:::

## الإيجابيات والسلبيات

| | |
|---|---|
| ✅ يستكشف حلولاً متنوعة | ❌ مكلف حوسبيًا (N × G من استدعاءات API) |
| ✅ يمكنه اكتشاف أساليب لا يجدها أي نموذج بمفرده | ❌ يتطلب دالة ملاءمة جيدة |
| ✅ قابل للتنفيذ بالتوازي | ❌ بطيء — أجيال متعددة لكل ترجمة |
| ✅ غير مرتبط بنموذج معين (Model-agnostic) | ❌ عوائد متناقصة بعد بضعة أجيال |

## يتكامل جيدًا مع

- **[النماذج المتسلسلة](./chained-models)** — خطوة إجراء الطفرات هي شكل من أشكال التسلسل
- **[مسار المعالجة المقيد بـ FST](./fst-gated-pipeline)** — قبول FST كإشارة ملاءمة
- **[النماذج اللغوية المعززة بالقاموس](./dictionary-augmented-llm)** — وجود مصطلحات القاموس كإشارة ملاءمة

## انظر أيضًا

- [مواصفات بطاقة التشغيل (Run Card)](/docs/network/specifications/run-card) — يتم تسجيل التكلفة وزمن الانتقال لكل إدخال
- [بيئة التقييم (Eval Harness)](/docs/network/specifications/harness) — تقيم بيئة التقييم مخرجاتك النهائية، وليس طريقة معالجتك
- [دعم لغة منخفضة الموارد](/docs/network/community/low-resource-languages)
