---
sidebar_position: 1
title: "تقديم طريقة"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# إرسال طريقة

> **ملخص تنفيذي.** دليل بدء سريع خطوة بخطوة لإرسال أول تشغيل تقييم لك إلى لوحة الصدارة. قم بتثبيت أداة الاختبار، وشغلها على مجموعة بيانات، وراجع بطاقة التشغيل الخاصة بك، ثم انشرها. يستغرق الأمر 10 دقائق إذا كان لديك مفتاح واجهة برمجة التطبيقات (API).

يرشدك هذا الدليل خلال إرسال أول تشغيل تقييم لك إلى لوحة صدارة الشبكة.

---

## المتطلبات الأساسية

- **Python 3.11+**
- **مفتاح واجهة برمجة تطبيقات OpenRouter** (أو ما يعادله لمزود النموذج الخاص بك)
- **طريقة ترجمة** — أي شيء ينتج ترجمات من نص مصدر

```bash
# Install the eval harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

---

## الخطوة 1: تشغيل أداة الاختبار

تقوم أداة الاختبار بتقييم طريقتك مقابل مجموعة بيانات موحدة:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| العلامة (Flag) | وظيفتها |
|---|---|
| `--corpus` | مسار ملف المتن (Corpus) أو معرف المتن المسجل (`.json`، `.jsonl`، `.tsv`) |
| `--model` | الاسم المختصر للنموذج (Model slug) — اسم مستعار قصير (مثل `gemini-pro`) أو معرف OpenRouter الكامل |
| `-n, --name` | تسمية مقروءة بشرياً للتشغيل الخاص بك (تظهر على لوحة الصدارة) |
| `--temperature` | درجة حرارة أخذ العينات (أقل = أكثر حتمية) |
| `--fst-retries` | اختياري: عدد محاولات إعادة المحاولة لـ FST |
| `--publish` | نشر بطاقة التشغيل على لوحة الصدارة عند انتهاء التشغيل |

تنتج أداة الاختبار **بطاقة تشغيل** — وهي ملف JSON مستقل يحتوي على درجاتك، وتجزئة (hash) مجموعة البيانات، والاسم المختصر للنموذج، وبصمة تشفير تربط النتائج بتكوين التجربة الدقيق.

---

## الخطوة 2: مراجعة بطاقة التشغيل الخاصة بك

يتم حفظ بطاقات التشغيل في `eval/logs/harness/`. افحص بطاقتك قبل الإرسال:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

الحقول الرئيسية التي يجب التحقق منها:
- `scores.chrf_plus_plus` — مقياس الجودة الأساسي الخاص بك
- `scores.exact_match_rate` — نسبة الترجمات المثالية
- `scores.fst_acceptance_rate` — الصلاحية الصرفية (إذا تم استخدام FST)
- `totals.total_cost_usd` — تكلفة التشغيل
- `fingerprint` — تجزئة قابلية إعادة الإنتاج للتجربة

راجع [مواصفات بطاقة التشغيل](/docs/network/specifications/run-card) للحصول على المخطط الكامل.

---

## الخطوة 3: الإرسال

### النشر التلقائي

إذا قمت بتمرير `--publish` عند تشغيل أداة الاختبار، فقد تم تحميل بطاقة التشغيل الخاصة بك بالفعل.

### النشر اليدوي

انشر أي بطاقة تشغيل باستخدام أداة الاختبار:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

إذا كنت تفضل عدم استخدام مسار النشر، فافتح طلب سحب (pull request) في
[مستودع أداة التقييم](https://github.com/gamedaysuits/Champollion)
مع ملف JSON الخاص ببطاقة التشغيل في الدليل `results/`.

:::note[واجهة برمجة تطبيقات الإرسال والتحميل عبر الويب ليستا متاحتين بعد]
من المخطط توفير نقطة نهاية `POST https://champollion.dev/api/leaderboard/submit` وواجهة مستخدم لتحميل لوحة الصدارة ولكنهما **لم يتم تنفيذهما بعد**. حتى يتم إصدارهما،
فإن مسارات الإرسال الوحيدة التي تعمل هي `mt-eval publish` وطلب سحب إلى
مستودع أداة الاختبار المذكور أعلاه.
:::

---

## ماذا يحدث بعد ذلك

1. يتم التحقق من صحة إرسالك (تجزئة مجموعة البيانات، وسلامة بطاقة التشغيل)
2. تظهر النتائج على لوحة الصدارة كـ **مُقيَّمة ذاتياً (Self-benchmarked)** (مستوى الثقة 1)
3. للحصول على حالة **مُعتمد من Champollion (Champollion Verified)**، أرسل طريقتك كمكون إضافي (plugin) قابل للتثبيت حتى يتمكن المشرفون من إعادة إنتاج نتائجك
4. بالنسبة لطرق لغات الشعوب الأصلية: إذا وصلت طريقتك إلى القمة، تبدأ عملية [نقل الملكية](/docs/network/sovereignty/ownership-transfer)

---

## انظر أيضًا

- [استخدام أداة الاختبار](/docs/network/specifications/harness) — مرجع كامل لواجهة سطر الأوامر (CLI)
- [قواعد لوحة الصدارة](/docs/network/leaderboard/rules) — معايير الإرسال وسياسات مكافحة التلاعب
- [بناء طريقة](/docs/network/specifications/methods) — بروتوكول TranslationMethod
- [مجموعات البيانات](/docs/network/leaderboard/datasets) — مجموعات بيانات التقييم المتاحة
