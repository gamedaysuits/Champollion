---
sidebar_position: 2
title: "دليل الوصفات: توجيه LLM المُوجَّه"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# التلقين الموجه للنماذج اللغوية الكبيرة (Coached LLM Prompting)

> **الفكرة:** حقن القواعد النحوية، والقواميس ثنائية اللغة، وملاحظات الأسلوب مباشرة في موجه النظام (system prompt) الخاص بالنموذج اللغوي الكبير (LLM). لا حاجة للتدريب، ولا للضبط الدقيق (fine-tuning) — مجرد معرفة لغوية منظمة توجه المخرجات نحو ترجمات صحيحة.

:::info[هذا دليل عملي (cookbook)، وليس تنفيذاً نهائياً]
يوضح هذا الدليل النهج وقرارات التصميم الرئيسية الخاصة به. يمكنك تكييفه ليناسب زوج اللغات الخاص بك، والموارد المتاحة، وأهداف التقييم.
:::

## متى تستخدم هذا

- لديك **معرفة لغوية** حول اللغة المستهدفة (قواعد نحوية، مدخلات قاموس، تفضيلات أسلوبية) ولكن ليس لديك بيانات متوازية كافية للضبط الدقيق (fine-tuning).
- ترغب في **التكرار السريع (iterate fast)** — يتم نشر تغييرات الموجه (prompt) في ثوانٍ، دون الحاجة لإعادة التدريب.
- تحتوي اللغة المستهدفة على **أنماط معروفة** يخطئ فيها النموذج اللغوي الكبير (مثل التوافق بين الجنسين، اصطلاحات الكتابة، مستويات الرسمية).
- ترغب في قياس أداء التلقين الموجه (coached prompting) مقارنة بخط الأساس (baseline) والتكرار بناءً على ما ينجح.

## كيف تعمل

1. **تجميع بيانات التوجيه** — القواعد النحوية، وقاموس ثنائي اللغة، وملاحظات الأسلوب في ملف JSON منظم.
2. **تكوين السجل اللغوي (register)** — بادئة لموجه النظام تحدد اللغة، ونظام الكتابة، والنبرة.
3. **تشغيل منصة الاختبار (harness)** — يتم حقن بيانات التوجيه في كل موجه (prompt) للنموذج اللغوي الكبير.
4. **مراجعة الإخفاقات** — انظر إلى ما ترفضه بوابة الجودة (quality gate)، وأضف قواعد لمعالجة الأنماط.
5. **التكرار** — كل مراجعة لملف التوجيه تمثل تجربة جديدة؛ وتقوم منصة الاختبار بتتبعها جميعاً.

## بنية بيانات التوجيه

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## قرارات التصميم الرئيسية

**تحديد القواعد مقابل نافذة السياق (context window):** توفر القواعد الإضافية مزيداً من التوجيه للنموذج اللغوي الكبير، ولكنها تستهلك من نافذة السياق المتاحة للترجمة الفعلية. ابدأ بـ 5 إلى 10 قواعد عالية التأثير، وأضف المزيد فقط عندما تلاحظ أنماط إخفاق محددة.

**تغطية القاموس:** لست بحاجة إلى قاموس كامل — ركز على المصطلحات التي يخطئ فيها النموذج اللغوي الكبير باستمرار. حتى 20 إلى 30 مصطلحاً مفروضاً يمكن أن تحسن الاتساق بشكل كبير.

**ترتيب القواعد مهم:** ضع القواعد الأكثر أهمية في البداية. تولي النماذج اللغوية الكبيرة (LLMs) اهتماماً أكبر للتعليمات المبكرة.

## تشغيل تجربة

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## الإيجابيات والسلبيات

| | |
|---|---|
| ✅ تكلفة تدريب صفرية | ❌ سقف الجودة محدود بالمعرفة الأساسية للنموذج اللغوي الكبير |
| ✅ تكرار فوري (تغيير الموجه ← إعادة التشغيل) | ❌ نافذة السياق تحد من مقدار التوجيه الذي يمكن استيعابه |
| ✅ يعمل مع أي مزود للنماذج اللغوية الكبيرة | ❌ يمكن أن تتعارض القواعد — تصحيح تفاعلات الموجه يعتبر فناً |
| ✅ شفافية — يمكنك قراءة ما يراه النموذج اللغوي الكبير بالضبط | ❌ لا ينشئ معرفة جديدة، بل يوجه المعرفة الحالية فقط |

## يندمج جيداً مع

- **[مسار عمل ببوابة FST (FST-Gated Pipeline)](./fst-gated-pipeline)** — التوجيه + التحقق الصرفي يكتشف ما يغفله التوجيه وحده.
- **[نموذج لغوي كبير معزز بالقاموس (Dictionary-Augmented LLM)](./dictionary-augmented-llm)** — المصطلحات المفروضة هي شكل من أشكال التوجيه.
- **[التلقين بأمثلة قليلة (Few-Shot Prompting)](./few-shot-prompting)** — الأمثلة + القواعد معاً أقوى من استخدام أي منهما بمفرده.

## انظر أيضًا

- [واجهة الطريقة (Method Interface)](/docs/network/specifications/methods) — تنسيق بيانات التوجيه وبروتوكول TranslationMethod.
- [دعم لغة قليلة الموارد (Support a Low-Resource Language)](/docs/network/community/low-resource-languages) — السياق الكامل.
- [منصة التقييم (Eval Harness)](/docs/network/specifications/harness) — كيفية تشغيل التجارب.
