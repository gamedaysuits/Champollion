---
sidebar_position: 7
title: "اختبار الدلالة الإحصائية"
slug: '/network/specifications/significance'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The scores these tests protect"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "Where significance gates what ranks"
---

# اختبار الدلالة الإحصائية

> **الحالة**: ✅ تم الإصدار. تم تنفيذ اختبار الدلالة الإحصائية بطريقة إعادة الاعتيان المزدوج (Paired bootstrap) وفترات الثقة بطريقة إعادة الاعتيان (Bootstrap confidence intervals) في `mt_eval_harness/significance.py` و `mt_eval_harness/confidence.py`، وتم تصديرها من الحزمة، وإتاحتها في واجهة سطر الأوامر (CLI)، وتغطيتها بواسطة حزم اختبارات الدلالة / الثقة / التقييم.
> **قاعدة البيانات البرمجية**: `arena` — مدمجة في `tester.py` (فترات الثقة لكل عملية تشغيل) و `compare.py` (الدلالة الإحصائية بين عمليات التشغيل).
> **الغرض**: السماح للباحثين بتحديد ما إذا كان الفرق بين عمليتي تقييم ذو دلالة إحصائية أم مجرد تشويش.

توثق هذه الصفحة **السلوك المُصدَر** — فهي وصفية، وليست قائمة مهام.

---

## لماذا يعد هذا مهماً

عند مقارنة عمليتين (للتوضيح: النظام أ chrF++ 42.96 مقابل النظام ب chrF++ 41.80 على 92 مُدخلًا)، فإن فرق النقاط الخام لا يعني شيئًا بحد ذاته حول ما إذا كان حقيقيًا أم مجرد تشويش. مع وجود حوالي 92 مُدخل اختبار فقط، يمكن أن يُحدث التباين العشوائي بسهولة تقلبات بمقدار نقطة إلى نقطتين. يطلب الخبراء اختبارات الدلالة الإحصائية — لذلك تقوم بيئة الاختبار (harness) بحسابها.

---

## الخوارزمية: إعادة الاعتيان المزدوج (Paired Bootstrap Resampling)

هذه هي الطريقة القياسية المستخدمة في SacreBLEU و MT-Lens والمهام المشتركة في WMT. وهي مفهومة جيدًا من قِبل باحثي الترجمة الآلية (MT) وتنتج نتائج يثقون بها.

### كيف تعمل

بافتراض وجود نظامين أ (A) وب (B) تم تقييمهما على نفس العدد N من مُدخلات الاختبار:

1. حساب فرق المقياس الفعلي: `Δ = metric(A) - metric(B)`
2. التكرار `n_bootstrap` مرة (الافتراضي 1000):
   أ. أخذ عينة من N مُدخل **مع الإرجاع** (with replacement) من مجموعة الاختبار المشتركة
   ب. حساب المقياس لكل من أ (A) وب (B) على عينة إعادة الاعتيان هذه
   ج. حساب فرق إعادة الاعتيان: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. القيمة الاحتمالية (p-value) = نسبة عينات إعادة الاعتيان التي يكون فيها لـ `Δ_boot` إشارة معاكسة لـ `Δ`
4. إذا كانت القيمة الاحتمالية (p-value) < α (الافتراضي 0.05)، فإن الفرق ذو دلالة إحصائية

### الخصائص الرئيسية

- **مزدوجة (Paired)**: يتم تقييم كلا النظامين على نفس عينة إعادة الاعتيان، مما يحافظ على الارتباط على مستوى المُدخلات
- **لابارامترية (Non-parametric)**: لا توجد افتراضات حول توزيع الدرجات
- **قياسية (Standard)**: هذا بالضبط ما يفعله `sacrebleu --paired-bs` في الخلفية

---

## sacrebleu هي اعتمادية أساسية (Hard Dependency)

تُعد sacrebleu اعتمادية أساسية. بيئة تقييم الترجمة الآلية (MT eval harness) التي لا يمكنها حساب chrF++ أو BLEU ليست بيئة تقييم للترجمة الآلية، لذلك:

1. تم التصريح عن `sacrebleu>=2.3` ضمن `[project.dependencies]` في `pyproject.toml` (وليس `[project.optional-dependencies]`).
2. يتم استيرادها مباشرة في `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — بدون حماية `try/except`.
3. يتم استيرادها مباشرة في `significance.py`.

لا توجد مسارات شرطية `HAS_SACREBLEU` في أي مكان: التشغيل بدون sacrebleu ليس إعدادًا مدعومًا.

---

## التنفيذ

### 1. sacrebleu كاعتمادية أساسية

يُصرح `pyproject.toml` عن `sacrebleu>=2.3` ضمن `[project.dependencies]`، ويقوم `tester.py` باستيرادها مباشرة:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

لا توجد حمايات `if HAS_SACREBLEU:` في `tester.py` — تمت إزالة مسارات الاستيراد الشرطية.

---

### 2. الوحدة: `mt_eval_harness/significance.py`

التنفيذ الأساسي لإعادة الاعتيان المزدوج (paired-bootstrap). واجهتها العامة:

```python
"""
Statistical significance testing via paired bootstrap resampling.

Standard method used by WMT shared tasks, SacreBLEU, and MT-Lens.
Compares two runs on the same corpus to determine if the performance
difference is statistically significant.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from sacrebleu.metrics import CHRF, BLEU


@dataclass
class SignificanceResult:
    """Result of a paired bootstrap significance test."""
    metric_name: str           # e.g., "corpus_chrf", "exact_match_rate"
    system_a_score: float      # Score for system A
    system_b_score: float      # Score for system B
    delta: float               # A - B
    p_value: float             # Two-sided p-value
    n_bootstrap: int           # Number of bootstrap iterations
    confidence_level: float    # 1 - alpha
    significant: bool          # p_value < alpha
    winner: str | None         # "A", "B", or None if not significant
    ci_lower: float            # Lower bound of 95% CI on the delta
    ci_upper: float            # Upper bound of 95% CI on the delta


def paired_bootstrap(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int = 12345,
    metric_name: str = "metric",
) -> SignificanceResult:
    """Run paired bootstrap resampling significance test.

    Args:
        entries_a: Per-entry results from system A (from TestReport["entries"])
        entries_b: Per-entry results from system B (must be same length, same IDs)
        metric_fn: Function(list[dict]) -> float that computes the corpus-level
                   metric from a list of entry dicts. Must handle the entry format
                   from TestReport.
        n_bootstrap: Number of bootstrap iterations (1000 is standard)
        alpha: Significance level (0.05 = 95% confidence)
        seed: RNG seed for reproducibility (12345 matches SacreBLEU default)
        metric_name: Human-readable name for the metric being tested

    Returns:
        SignificanceResult with all fields populated.

    Raises:
        ValueError: If entries_a and entries_b have different lengths or IDs.
    """
    ...
```

### 3. دوال المقاييس المدمجة

```python
def exact_match_rate(entries: list[dict]) -> float:
    """Compute exact match rate from a list of entry dicts."""
    non_error = [e for e in entries if not e.get("error")]
    if not non_error:
        return 0.0
    exact = sum(1 for e in non_error if e.get("exact_match"))
    return exact / len(non_error)


def corpus_chrf(entries: list[dict]) -> float:
    """Compute corpus-level chrF++ from a list of entry dicts."""
    chrf = CHRF(word_order=2)
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return chrf.corpus_score(hyps, [refs]).score


def corpus_bleu(entries: list[dict]) -> float:
    """Compute corpus-level BLEU from a list of entry dicts."""
    bleu = BLEU()
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return bleu.corpus_score(hyps, [refs]).score
```

### 4. الدمج في `compare.py`

يقوم `compare.py` بمقارنة جنبًا إلى جنب لتقارير اختبار (TestReports) متعددة ويُجري اختبار الدلالة الإحصائية بينها. كما يُصدر `significance.py` أيضًا `fst_acceptance_rate()` و `composite_score()` (بحيث يمكن اختبار الدلالة الإحصائية لفروق FST والمركبة)، و `run_significance_tests()` (يُشغل جميع المقاييس عبر تقريرين)، و `format_significance_table()` (للعرض في وحدة التحكم).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

عند مقارنة أكثر من تقريرين، يتم تشغيل اختبارات الدلالة الزوجية لجميع الأزواج، مفهرسة بواسطة `"(run_a_id, run_b_id)"`.

### 5. الدمج مع واجهة سطر الأوامر (CLI)

يعرض `mt-eval compare` علامة `--significance`، مع `--n-bootstrap` لتعيين عدد التكرارات:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. تنسيق المخرجات

يعرض `format_significance_table()` واجهة وحدة التحكم؛ وتتم إضافة نفس البيانات إلى ملف JSON الخاص بالمقارنة.

**مخرجات وحدة التحكم:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**مخرجات JSON** (مضافة إلى تقرير المقارنة):
```json
{
  "significance": [
    {
      "metric_name": "corpus_chrf",
      "system_a_score": 42.96,
      "system_b_score": 41.80,
      "delta": 1.16,
      "p_value": 0.142,
      "n_bootstrap": 1000,
      "confidence_level": 0.95,
      "significant": false,
      "winner": null,
      "ci_lower": -0.85,
      "ci_upper": 3.12
    }
  ]
}
```

### 7. الدمج مع لوحة المعلومات (تحسين اختياري)

عندما تكون بيانات الدلالة الإحصائية موجودة في ملف JSON الخاص بالمقارنة، يمكن للوحة المعلومات عرضها — صف في جدول المقارنة مع مؤشرات الدلالة (`*` لـ p < 0.05، و `**` لـ p < 0.01). هذه طبقة عرض فوق العمليات الحسابية المُصدرة، وليست جزءًا من الميزة الأساسية.

---

## الحالات الطرفية والتحقق

1. **المُدخلات غير المتطابقة**: يجب أن يحتوي تقريرا الاختبار (TestReports) على نفس معرفات المُدخلات. إذا لم تكن كذلك (على سبيل المثال، تم تشغيل أحدهما على مجموعة فرعية)، فاختبر الدلالة الإحصائية فقط على التقاطع. قم بإصدار تحذير بشأن المُدخلات المستبعدة.

2. **عدد قليل جدًا من المُدخلات**: إذا كان N < 10، قم بإصدار تحذير بأن اختبارات الدلالة الإحصائية غير موثوقة مع هذا العدد القليل من المُدخلات. استمر في تشغيلها، ولكن اطبع التحذير.

3. **الدرجات المتطابقة**: إذا أنتج كلا النظامين نتائج متطابقة لكل مُدخل، فيجب أن تكون القيمة الاحتمالية (p_value) 1.0 (لا يوجد فرق على الإطلاق).

4. **مقاييس الإضافات (Plugin metrics)**: يجب أن تختبر وحدة الدلالة الإحصائية أيضًا أي مقاييس إضافات تظهر في كلا التقريرين. استخدم نهجًا عامًا: إذا كان كلا التقريرين يحتويان على `plugin_metrics.crk_fst_validity.avg_fst_validity`، فقم باختباره.

5. **قابلية إعادة الإنتاج (Reproducibility)**: يجب تسجيل بذرة مولد الأرقام العشوائية (RNG seed) في المخرجات بحيث يمكن إعادة إنتاج النتائج بدقة. القيمة الافتراضية هي 12345 (مطابقة لعرف SacreBLEU).

---

## ما لا يجب بناؤه

- **لا توجد دلالة إحصائية منفصلة لـ COMET**: يتم حساب COMET والإبلاغ عنه في **مسار عصبي منفصل** — ولا يتم **أبدًا دمجه في أي مقياس مركب** (المقياس المركب حتمي؛ راجع [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) و §2). *يمكن* حساب فترات الثقة (CIs) بطريقة إعادة الاعتيان على درجاته المخزنة مؤقتًا لكل مُدخل، ولكن بيئة الاختبار لا تُشغل اختبار دلالة مزدوج مدمج لـ COMET. للحصول على الدلالة الإحصائية الزوجية لـ COMET بين نظامين، استخدم `comet-compare` من Unbabel.
- **لا يوجد تحليل بايزي (Bayesian analysis)**: التزم بإعادة الاعتيان التكراري (frequentist bootstrap). هذا ما يتوقعه ويفهمه مجتمع الترجمة الآلية.
- **لا يوجد تصحيح للاختبارات المتعددة**: عند اختبار مقاييس متعددة، لا تقم بتطبيق تصحيح بونفيروني (Bonferroni) أو تصحيحات مشابهة. العرف المتبع في تقييم الترجمة الآلية هو الإبلاغ عن القيم الاحتمالية (p-values) الخام لكل مقياس وترك التفسير للقارئ.

---

## خريطة الوحدات

أين توجد الميزة المُصدرة:

| الملف | الدور |
|---|---|
| `pyproject.toml` | تم التصريح عن `sacrebleu>=2.3` كاعتمادية أساسية |
| `mt_eval_harness/tester.py` | استيراد مباشر لـ sacrebleu (بدون حماية `HAS_SACREBLEU`)؛ يحسب فترات الثقة (CIs) لكل عملية تشغيل |
| `mt_eval_harness/significance.py` | نواة إعادة الاعتيان المزدوج (Paired-bootstrap): `paired_bootstrap`، `SignificanceResult`، دوال المقاييس المدمجة، `run_significance_tests`، `format_significance_table` |
| `mt_eval_harness/confidence.py` | فترات الثقة بطريقة إعادة الاعتيان (Bootstrap confidence intervals): `bootstrap_ci`، `compute_all_cis`، `compute_per_tier_cis`، `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | يُصدر `SignificanceResult`، `paired_bootstrap`، `ConfidenceInterval`، `bootstrap_ci`، `compute_all_cis` |
| `mt_eval_harness/compare.py` | اختبارات الدلالة الإحصائية المدمجة في مقارنة التقارير |
| `mt_eval_harness/cli.py` | علامات `--significance` / `--n-bootstrap` (للمقارنة) و `--no-ci` / `--n-bootstrap-ci` (للاختبار) |
| `mt_eval_harness/dashboard.py` | يعرض الدلالة الإحصائية في جدول المقارنة (تحسين اختياري) |
| `tests/test_significance.py`، `tests/test_confidence.py` | اختبارات الوحدة (جزء من حزمة الاختبارات الناجحة) |

---

## تغطية الاختبارات

حزم اختبارات الدلالة / الثقة / التقييم خضراء (ناجحة). وهي تغطي:

1. **حتمية مع البذرة (seed)**: نفس المدخلات + نفس البذرة ← نفس القيمة الاحتمالية (p-value)، في كل مرة
2. **اختبار الإجابة المعروفة**: مجموعتا نتائج متطابقتان ← القيمة الاحتمالية (p-value) = 1.0
3. **اختبار الدلالة المعروفة**: مجموعتا نتائج تكون إحداهما أفضل بوضوح (على سبيل المثال، جميعها تطابقات تامة مقابل جميعها إخفاقات) ← القيمة الاحتمالية (p-value) ≈ 0.0
4. **المعرفات غير المتطابقة**: يُطلق `ValueError`، أو يُحذر ويحسب على التقاطع
5. **المدخلات الفارغة**: يتم التعامل معها بسلاسة (القيمة الاحتمالية (p-value) = 1.0 أو يُطلق استثناء)

---

## فترات الثقة (ميزة مصاحبة)

> **الحالة**: ✅ تم التنفيذ في `confidence.py`

تجيب فترات الثقة (CIs) على سؤال مختلف عن اختبار الدلالة الإحصائية:

- **اختبار الدلالة الإحصائية** (`significance.py`): "هل الفرق بين النظام أ والنظام ب حقيقي؟"
- **فترات الثقة** (`confidence.py`): "ما مدى عدم اليقين في درجة هذا النظام بحد ذاته؟"

### التنفيذ: `confidence.py`

يستخدم نفس طريقة إعادة الاعتيان المئوية (percentile bootstrap) مثل اختبار الدلالة الإحصائية:

| المعلمة | القيمة | المبرر |
|---|---|---|
| `n_bootstrap` | 1000 | الافتراضي في SacreBLEU، وعرف WMT 2024 |
| `seed` | 12345 | البذرة الافتراضية في SacreBLEU لقابلية إعادة الإنتاج |
| `alpha` | 0.05 | مستوى الثقة القياسي 95% |
| الطريقة | إعادة الاعتيان المئوية (Percentile bootstrap) | Koehn (2004)، Efron (1979) |

### ما الذي يحصل على فترات الثقة (CIs)

المقاييس الحتمية على مستوى المتن (corpus-level) التي تحسبها بيئة الاختبار:
- `corpus_chrf` (درجة chrF++)
- `corpus_bleu` (درجة BLEU)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (عند وجود بيانات FST)
- `composite` (عند توفر chrF++ والتطابق التام)

يتم حساب فترات الثقة (CIs) **أيضًا** للمقياس العصبي `comet_score`، عن طريق إعادة الاعتيان من درجاته المخزنة مؤقتًا لكل مُدخل (بدون استدلال عصبي متكرر). وجود فترة ثقة لا يجعل COMET مقياسًا مركبًا: يتم الإبلاغ عنه في **مسار عصبي منفصل** ولا يتم أبدًا دمجه في المقياس المركب (راجع [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

### علامات واجهة سطر الأوامر (CLI Flags)

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### تحذير العينة الصغيرة

عندما يكون N < 30 مُدخلًا، تُصدر الوحدة تحذيرًا بأن فترات الثقة (CIs) قد تكون ذات تغطية ضعيفة. لا يمكن لطريقة إعادة الاعتيان (bootstrap) إنشاء معلومات غائبة عن العينة — مع وجود عدد قليل جدًا من المُدخلات، ستكون الفترات واسعة، مما يعكس بشكل صحيح درجة عالية من عدم اليقين.

### COMET (يُبلغ عنه بشكل منفصل، ولا يُركب أبدًا)

يُعد COMET **مقياسًا عصبيًا يُبلغ عنه في مساره الخاص** — ولا يتم **أبدًا دمجه في أي مقياس مركب** (يُحتفظ بالمقياس المركب حتميًا؛ راجع [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) و §2). *يتم* حساب فترات الثقة (CIs) بطريقة إعادة الاعتيان على درجاته المخزنة مؤقتًا لكل مُدخل، ولكنه ليس مقياسًا مركبًا من "الدرجة الأولى":
- النموذج: `Unbabel/wmt22-comet-da` (نموذج WMT 2022 القائم على المراجع)؛ يتم تحديد AfriCOMET تلقائيًا للغات الأفريقية المدعومة
- يُحسب عند تثبيت `unbabel-comet`
- تُخزن الدرجات لكل مُدخل في مُدخلات TestReport؛ وتحمل قيمة المتن تحذيرًا بشأن المعايرة للموارد المنخفضة
- يُعاد اشتقاقه بواسطة المُدقق — يجب أن تكون قيمة COMET المُبلغ عنها قابلة لإعادة الإنتاج
- اعتمادية اختيارية: `pip install mt-eval-harness[comet]`

### أعمدة Supabase

يحمل جدول `run_cards` الأعمدة المقابلة القابلة للقيم الفارغة (nullable) (راجع [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — الدرجة العصبية المُبلغ عنها بشكل منفصل، ولا تُركب أبدًا
- `corpus_bleu` (`real`)

يتم تخزين حدود فترة الثقة داخل ملف JSON الخاص بـ `scores` لبطاقة التشغيل (run-card) ضمن `confidence_intervals` (وفقًا لمخطط بطاقة التشغيل في scoring.md §9)، وليس كأعمدة ذات مستوى أعلى غير مطبعة (denormalized).
