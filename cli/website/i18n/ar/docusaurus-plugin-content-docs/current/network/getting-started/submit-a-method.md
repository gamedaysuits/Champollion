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

> **ملخص تنفيذي.** دليل بدء سريع خطوة بخطوة لإرسال أول تشغيل تقييم معياري خاص بك إلى لوحة المتصدرين. ثبّت أداة التقييم (harness)، وشغّلها على مجموعة بيانات، ثم راجع بطاقة التشغيل الخاصة بك، وانشرها. يستغرق الأمر 10 دقائق إذا كان لديك مفتاح API.

يرشدك هذا الدليل خلال عملية إرسال أول تشغيل تقييم معياري خاص بك إلى لوحة متصدري Network.

---

## المتطلبات الأساسية

- **Python 3.11+**
- **مفتاح OpenRouter API** (أو ما يعادله لمزوّد النماذج الخاص بك)
- **طريقة ترجمة** — أي شيء ينتج ترجمات من نص مصدري

```bash
# Install the eval harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

---

## الخطوة 1: تشغيل أداة التقييم (Harness)

تقوم أداة التقييم بتسجيل نقاط طريقتك مقارنة بمجموعة بيانات معيارية:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| الخيار (Flag) | وظيفته |
|---|---|
| `--corpus` | مسار ملف المدونة اللغوية أو معرّف المدونة المسجل (`.json`، `.jsonl`، `.tsv`) |
| `--model` | المعرّف الدقيق للنموذج (slug) — معرّف OpenRouter الكامل (مثل `google/gemini-3.1-pro-preview`)؛ يتم رفض الأسماء المستعارة القصيرة والمعرّفات العائمة (`…-latest`). مع `--method <plugin dir>`، النموذج الممرر إلى ملحقك كـ `config.method_model` (أي تسمية يستخدمها ملحقك) |
| `-n, --name` | تسمية مقروءة بشريًا لتشغيلك (تظهر في لوحة المتصدرين) |
| `--temperature` | درجة حرارة أخذ العينات (الأقل = أكثر حتمية) |
| `--fst-retries` | اختياري: عدد محاولات إعادة تجربة FST |
| `--publish` | نشر بطاقة التشغيل إلى لوحة المتصدرين عند انتهاء التشغيل |

تنتج أداة التقييم **بطاقة تشغيل** — وهي ملف JSON قائم بذاته يحتوي على درجاتك، وتجزئة مجموعة البيانات، ومعرّف النموذج الدقيق، وبصمة تشفير تربط النتائج بتهيئة التجربة بدقة.

---

## الخطوة 2: مراجعة بطاقة التشغيل الخاصة بك

يكتب كل تشغيل ملفين إلى `eval/logs/harness/`: سجل التشغيل `<run-id>.json`
والتقرير المسجل بالدرجات `<run-id>_report.json`. التقرير هو ما ستقوم بنشره.
افحصه أولاً:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

الحقول الرئيسية في كتلة `overall` الخاصة بالتقرير:
- `corpus_chrf` — مقياس chrF++ على مستوى المدونة (0–100)، وهو المقياس الرئيسي والمعيار المعتمد في الترتيب. فاصل الثقة بتقنية bootstrap بنسبة 95% هو `confidence_intervals.corpus_chrf` وتوقيع sacreBLEU الخاص به هو `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) و `primary_metric`
  (`"chrf_plus_plus"`) — المعيار الذي تم تقييم التقرير بموجبه
- `corpus_bleu`، `corpus_spbleu`، `corpus_ter` — المقاييس القياسية الأخرى،
  المعروضة بجانب chrF++ ولا يتم دمجها معها مطلقًا
- `exact_match_rate` — مقياس تشخيصي: نسبة الترجمات المثالية
- `confidence_intervals` — فترات bootstrap للمقاييس المذكورة أعلاه
- `total_cost_usd` — تكلفة التشغيل (`null` عندما لا يكون للنموذج سعر منشور،
  مثل نموذج محلي؛ ولا يتم تسجيلها أبدًا كـ 0 دولار)

يسجل التقرير أيضًا ما تم إخباره للنموذج كمؤشر
(`instructions`: اسم ملف التوجيه ورمز SHA-256 الخاص به، ورمز SHA-256
لمحفز النظام، ومكان وجود النص الكامل، أي سجل التشغيل على جهازك). ويتم تجميع
بطاقة التشغيل التي تذهب إلى لوحة المتصدرين من هذا التقرير. وهي تضيف
بطاقة الطريقة وبصمة قابلية إعادة الإنتاج، وتتصدر بنفس
chrF++ وفاصل الثقة؛ وتكون قيمة `composite` و `quality_tier` فيها `null`، لأن كلاهما
[تم إيقاف العمل بهما](/docs/network/specifications/scoring#how-runs-are-scored). (قد يحتوي التقرير
المكتوب قبل اعتماد المعيار على `published_composite`؛ وهو مقياس مركب قديم، تم إيقاف العمل به، ولا يُقارن مطلقًا مع chrF++.)
يطبع `mt-eval publish <report> --dry-run` البطاقة تمامًا كما سيتم
نشرها. راجع [مواصفات بطاقة التشغيل](/docs/network/specifications/run-card)
لمعرفة مخططها.

---

## الخطوة 3: الإرسال

تكتب عملية النشر مباشرة على لوحة المتصدرين **الحية**، لذا فهي تتطلب خيارًا صريحًا هو
`--prod` — بدونه سترفض أداة التقييم وتخطرك بذلك. قم بالمعاينة أولاً:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

للنشر مباشرة من التشغيل، أضف `--publish --prod` إلى `mt-eval run`. إذا فشلت
خطوة النشر، فستظل درجات التشغيل محفوظة وستطبع أداة التقييم
أمر إعادة المحاولة الدقيق. يُعد تعيين `MT_EVAL_ALLOW_PROD=1` في متغيرات البيئة هو
المعادل لـ `--prod` بالنسبة للبرامج النصية.

:::note[واجهة برمجة تطبيقات الإرسال والرفع عبر الويب غير متاحة بعد]
إن نقطة النهاية `POST https://champollion.dev/api/leaderboard/submit` وواجهة
المستخدم لرفع البيانات إلى لوحة المتصدرين مخطط لهما ولكنهما **لم يُنفّذا بعد**. وحتى يتم إطلاقهما،
فإن مسار الإرسال الفعال الوحيد هو `mt-eval publish` (لا يوجد مسار عبر طلبات السحب pull requests).
:::

---

## ما الذي يحدث بعد ذلك

1. يتم التحقق من صحة الإرسال الخاص بك (تجزئة مجموعة البيانات، وسلامة بطاقة التشغيل)
2. تظهر النتائج على لوحة المتصدرين بالحالة **Self-benchmarked** (مستوى الثقة 1)
3. للحصول على حالة **Champollion Verified**، أرسل طريقتك كملحق قابل للتثبيت حتى يتمكن مسؤولو الصيانة من إعادة إنتاج نتائجك
4. بالنسبة لطرق اللغات الأصلية: إذا وصلت طريقتك إلى القمة، تبدأ عملية [نقل الملكية](/docs/network/sovereignty/ownership-transfer)

---

## انظر أيضًا

- [استخدام أداة التقييم (Harness)](/docs/network/specifications/harness) — مرجع CLI الكامل
- [قواعد لوحة المتصدرين](/docs/network/leaderboard/rules) — معايير الإرسال وسياسات مكافحة التلاعب
- [بناء طريقة](/docs/network/specifications/methods) — بروتوكول TranslationMethod
- [مجموعات البيانات](/docs/network/leaderboard/datasets) — مجموعات بيانات التقييم المتاحة
