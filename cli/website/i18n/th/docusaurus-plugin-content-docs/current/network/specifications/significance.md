---
sidebar_position: 7
title: "การทดสอบนัยสำคัญทางสถิติ"
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

# การทดสอบนัยสำคัญทางสถิติ

> **สถานะ**: ✅ เปิดตัวแล้ว การทดสอบนัยสำคัญแบบ paired bootstrap และช่วงความเชื่อมั่นแบบ bootstrap ได้รับการพัฒนาใน `mt_eval_harness/significance.py` และ `mt_eval_harness/confidence.py` ส่งออกจากแพ็กเกจ เปิดเผยบน CLI และครอบคลุมโดยชุดทดสอบ significance / confidence / scoring
> **Codebase**: `arena` — เชื่อมต่อกับ `tester.py` (ช่วงความเชื่อมั่นต่อการรัน) และ `compare.py` (นัยสำคัญระหว่างการรัน)
> **วัตถุประสงค์**: ให้นักวิจัยสามารถระบุได้ว่าความแตกต่างระหว่างการรันประเมินผลสองครั้งมีนัยสำคัญทางสถิติหรือเป็นเพียงสัญญาณรบกวน

หน้านี้บันทึก **พฤติกรรมที่เปิดตัวแล้ว** — เป็นเอกสารเชิงพรรณนา ไม่ใช่รายการสิ่งที่ต้องทำ

---

## เหตุใดสิ่งนี้จึงสำคัญ

เมื่อเปรียบเทียบการรันสองครั้ง (ตัวอย่างเพื่อประกอบความเข้าใจ: ระบบ A ได้ chrF++ 42.96 เทียบกับระบบ B ได้ chrF++ 41.80 บน 92 รายการ) ความแตกต่างของคะแนนดิบเพียงอย่างเดียวไม่สามารถบอกได้ว่าผลลัพธ์นั้นเป็นจริงหรือเป็นเพียงสัญญาณรบกวน เมื่อมีรายการทดสอบเพียง ~92 รายการ ความแปรปรวนแบบสุ่มสามารถสร้างความแกว่งได้ง่าย 1–2 คะแนน ผู้เชี่ยวชาญต้องการการทดสอบนัยสำคัญ — ดังนั้น harness จึงคำนวณให้

---

## อัลกอริทึม: Paired Bootstrap Resampling

นี่คือวิธีมาตรฐานที่ใช้โดย SacreBLEU, MT-Lens และงาน WMT shared tasks เป็นที่เข้าใจดีในหมู่นักวิจัย MT และให้ผลลัพธ์ที่พวกเขาไว้วางใจ

### วิธีการทำงาน

กำหนดให้ระบบสองระบบ A และ B ถูกประเมินบนรายการทดสอบ N รายการเดียวกัน:

1. คำนวณความแตกต่างของเมตริกจริง: `Δ = metric(A) - metric(B)`
2. ทำซ้ำ `n_bootstrap` ครั้ง (ค่าเริ่มต้น 1000):
   a. สุ่มตัวอย่าง N รายการ **แบบมีการคืน** จากชุดทดสอบร่วม
   b. คำนวณเมตริกสำหรับทั้ง A และ B บน bootstrap sample นี้
   c. คำนวณความแตกต่างของ bootstrap: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. p-value = สัดส่วนของ bootstrap samples ที่ `Δ_boot` มีเครื่องหมายตรงข้ามกับ `Δ`
4. หาก p-value < α (ค่าเริ่มต้น 0.05) ความแตกต่างนั้นมีนัยสำคัญทางสถิติ

### คุณสมบัติสำคัญ

- **Paired**: ทั้งสองระบบถูกประเมินบน bootstrap sample เดียวกัน เพื่อรักษาความสัมพันธ์ระดับรายการ
- **Non-parametric**: ไม่มีข้อสมมติเกี่ยวกับการกระจายของคะแนน
- **Standard**: นี่คือสิ่งที่ `sacrebleu --paired-bs` ทำภายใต้ฝากระโปรง

---

## sacrebleu เป็น Hard Dependency

sacrebleu เป็น hard dependency การประเมิน MT ที่ไม่สามารถคำนวณ chrF++ หรือ BLEU ไม่ถือเป็น MT eval harness ดังนั้น:

1. `sacrebleu>=2.3` ถูกประกาศภายใต้ `[project.dependencies]` ใน `pyproject.toml` (ไม่ใช่ `[project.optional-dependencies]`)
2. นำเข้าโดยตรงใน `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — โดยไม่มีการป้องกัน `try/except`
3. นำเข้าโดยตรงใน `significance.py`

ไม่มีเส้นทางแบบมีเงื่อนไข `HAS_SACREBLEU` ที่ใดเลย: การรันโดยไม่มี sacrebleu ไม่ใช่การกำหนดค่าที่รองรับ

---

## การนำไปใช้งาน

### 1. sacrebleu ในฐานะ hard dependency

`pyproject.toml` ประกาศ `sacrebleu>=2.3` ภายใต้ `[project.dependencies]` และ `tester.py` นำเข้าโดยตรง:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

ไม่มีการป้องกัน `if HAS_SACREBLEU:` ใน `tester.py` — เส้นทางการนำเข้าแบบมีเงื่อนไขถูกลบออกแล้ว

---

### 2. โมดูล: `mt_eval_harness/significance.py`

การพัฒนา paired-bootstrap หลัก พื้นผิวสาธารณะของมัน:

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

### 3. ฟังก์ชันเมตริกในตัว

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

### 4. การผสานรวมเข้ากับ `compare.py`

`compare.py` ทำการเปรียบเทียบแบบ side-by-side ของ TestReports หลายรายการและรันการทดสอบนัยสำคัญระหว่างกัน `significance.py` ยังมาพร้อมกับ `fst_acceptance_rate()` และ `composite_score()` (เพื่อให้สามารถทดสอบนัยสำคัญของความแตกต่าง FST และ composite ได้), `run_significance_tests()` (ขับเคลื่อนเมตริกทั้งหมดระหว่างสองรายงาน) และ `format_significance_table()` (การแสดงผลบน console)

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

เมื่อเปรียบเทียบรายงานมากกว่า 2 รายการ การทดสอบนัยสำคัญแบบ pairwise จะรันสำหรับทุกคู่ โดยใช้คีย์ `"(run_a_id, run_b_id)"`

### 5. การผสานรวม CLI

`mt-eval compare` เปิดเผยแฟล็ก `--significance` พร้อมด้วย `--n-bootstrap` สำหรับกำหนดจำนวนการวนซ้ำ:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. รูปแบบผลลัพธ์

`format_significance_table()` แสดงผลมุมมอง console โดยข้อมูลเดียวกันจะถูกเพิ่มลงใน JSON ของการเปรียบเทียบ

**ผลลัพธ์บน console:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**ผลลัพธ์ JSON** (เพิ่มลงในรายงานการเปรียบเทียบ):
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

### 7. การผสานรวม Dashboard (การปรับปรุงเสริม)

เมื่อมีข้อมูลนัยสำคัญอยู่ใน JSON ของการเปรียบเทียบ dashboard สามารถแสดงผลได้ — แถวตารางการเปรียบเทียบพร้อมตัวบ่งชี้นัยสำคัญ (`*` สำหรับ p < 0.05, `**` สำหรับ p < 0.01) นี่คือ presentation layer ที่อยู่บนการคำนวณที่เปิดตัวแล้ว ไม่ใช่ส่วนหนึ่งของฟีเจอร์หลัก

---

## กรณีขอบและการตรวจสอบ

1. **รายการไม่ตรงกัน**: TestReports ทั้งสองต้องมี entry ID เดียวกัน หากไม่ตรงกัน (เช่น รายการหนึ่งรันบนชุดย่อย) ให้ทดสอบนัยสำคัญเฉพาะบนส่วนที่ตัดกัน และแจ้งเตือนเกี่ยวกับรายการที่ถูกยกเว้น

2. **รายการน้อยเกินไป**: หาก N < 10 ให้แจ้งเตือนว่าการทดสอบนัยสำคัญไม่น่าเชื่อถือเมื่อมีรายการน้อยมาก ยังคงรันการทดสอบ แต่พิมพ์คำเตือน

3. **คะแนนเหมือนกัน**: หากทั้งสองระบบให้ผลลัพธ์ต่อรายการที่เหมือนกัน p_value ควรเป็น 1.0 (ไม่มีความแตกต่างเลย)

4. **เมตริก Plugin**: โมดูลนัยสำคัญควรทดสอบเมตริก plugin ใดๆ ที่ปรากฏในรายงานทั้งสองด้วย ใช้แนวทางทั่วไป: หากรายงานทั้งสองมี `plugin_metrics.crk_fst_validity.avg_fst_validity` ให้ทดสอบ

5. **การทำซ้ำได้**: ต้องบันทึก seed ของ RNG ในผลลัพธ์เพื่อให้ผลลัพธ์สามารถทำซ้ำได้อย่างแม่นยำ ค่าเริ่มต้นคือ 12345 (ตามแบบแผนของ SacreBLEU)

---

## สิ่งที่ไม่ควรสร้าง

- **ไม่มีการทดสอบนัยสำคัญ COMET แยกต่างหาก**: COMET ถูกคำนวณและรายงานใน **neural lane แยกต่างหาก** — **ไม่เคยรวมเข้าใน composite ใดๆ** (composite เป็นแบบ deterministic ดู [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) และ §2) Bootstrap CIs *สามารถ* คำนวณบนคะแนนต่อรายการที่แคชไว้ได้ แต่ harness ไม่รันการทดสอบนัยสำคัญแบบ paired ในตัวสำหรับ COMET สำหรับการทดสอบนัยสำคัญ COMET แบบ pairwise ระหว่างสองระบบ ให้ใช้ `comet-compare` จาก Unbabel
- **ไม่มีการวิเคราะห์แบบ Bayesian**: ยึดถือ frequentist bootstrap นี่คือสิ่งที่ชุมชน MT คาดหวังและเข้าใจ
- **ไม่มีการแก้ไขการทดสอบหลายครั้ง**: เมื่อทดสอบเมตริกหลายรายการ ไม่ต้องใช้การแก้ไขแบบ Bonferroni หรือที่คล้ายกัน แบบแผนในการประเมิน MT คือการรายงาน p-value ดิบต่อเมตริกและให้ผู้อ่านตีความเอง

---

## แผนที่โมดูล

ตำแหน่งที่ฟีเจอร์ที่เปิดตัวแล้วอยู่:

| ไฟล์ | บทบาท |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` ประกาศเป็น hard dependency |
| `mt_eval_harness/tester.py` | นำเข้า sacrebleu โดยตรง (ไม่มีการป้องกัน `HAS_SACREBLEU`); คำนวณ CI ต่อการรัน |
| `mt_eval_harness/significance.py` | Paired-bootstrap หลัก: `paired_bootstrap`, `SignificanceResult`, ฟังก์ชันเมตริกในตัว, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap confidence intervals: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | ส่งออก `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | การทดสอบนัยสำคัญเชื่อมต่อกับการเปรียบเทียบรายงาน |
| `mt_eval_harness/cli.py` | แฟล็ก `--significance` / `--n-bootstrap` (compare) และ `--no-ci` / `--n-bootstrap-ci` (test) |
| `mt_eval_harness/dashboard.py` | แสดงนัยสำคัญในตารางการเปรียบเทียบ (การปรับปรุงเสริม) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Unit tests (ส่วนหนึ่งของชุดทดสอบที่ผ่านแล้ว) |

---

## ความครอบคลุมของการทดสอบ

ชุดทดสอบ significance / confidence / scoring ผ่านทั้งหมด ครอบคลุม:

1. **Deterministic ด้วย seed**: input เดียวกัน + seed เดียวกัน → p-value เดียวกัน ทุกครั้ง
2. **การทดสอบด้วยคำตอบที่ทราบ**: ชุดผลลัพธ์สองชุดที่เหมือนกัน → p_value = 1.0
3. **การทดสอบที่มีนัยสำคัญที่ทราบ**: ชุดผลลัพธ์สองชุดที่หนึ่งดีกว่าอย่างชัดเจน (เช่น ตรงทั้งหมด vs ไม่ตรงทั้งหมด) → p_value ≈ 0.0
4. **ID ไม่ตรงกัน**: ยก `ValueError` หรือแจ้งเตือนและคำนวณบนส่วนที่ตัดกัน
5. **Input ว่างเปล่า**: จัดการได้อย่างเหมาะสม (p_value = 1.0 หรือยกข้อผิดพลาด)

---

## Confidence Intervals (ฟีเจอร์เสริม)

> **สถานะ**: ✅ พัฒนาแล้วใน `confidence.py`

Confidence intervals (CIs) ตอบคำถามที่แตกต่างจากการทดสอบนัยสำคัญ:

- **การทดสอบนัยสำคัญ** (`significance.py`): "ความแตกต่างระหว่างระบบ A และระบบ B เป็นจริงหรือไม่?"
- **Confidence intervals** (`confidence.py`): "คะแนนของระบบนี้มีความไม่แน่นอนมากเพียงใดในตัวมันเอง?"

### การพัฒนา: `confidence.py`

ใช้วิธี percentile bootstrap resampling เดียวกับการทดสอบนัยสำคัญ:

| พารามิเตอร์ | ค่า | เหตุผล |
|---|---|---|
| `n_bootstrap` | 1000 | ค่าเริ่มต้นของ SacreBLEU, แบบแผน WMT 2024 |
| `seed` | 12345 | seed เริ่มต้นของ SacreBLEU สำหรับการทำซ้ำได้ |
| `alpha` | 0.05 | ระดับความเชื่อมั่นมาตรฐาน 95% |
| Method | Percentile bootstrap | Koehn (2004), Efron (1979) |

### สิ่งที่ได้รับ CIs

เมตริกระดับ corpus แบบ deterministic ที่คำนวณโดย harness:
- `corpus_chrf` (คะแนน chrF++)
- `corpus_bleu` (คะแนน BLEU)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (เมื่อมีข้อมูล FST)
- `composite` (เมื่อมี chrF++ และ exact match)

CIs **ยังถูก** คำนวณสำหรับ `comet_score` แบบ neural โดย bootstrap จากคะแนนต่อรายการที่แคชไว้ (ไม่มีการอนุมาน neural ซ้ำซ้อน) การมี CI ไม่ทำให้ COMET เป็นเมตริก composite: มันถูกรายงานใน **neural lane แยกต่างหาก** และไม่เคยรวมเข้าใน composite (ดู [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables))

### แฟล็ก CLI

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### คำเตือนสำหรับตัวอย่างขนาดเล็ก

เมื่อมีรายการ N < 30 รายการ โมดูลจะส่งคำเตือนว่า CIs อาจมีความครอบคลุมที่ไม่ดี Bootstrap ไม่สามารถสร้างข้อมูลที่ไม่มีอยู่ในตัวอย่าง — เมื่อมีรายการน้อยมาก ช่วงจะกว้าง ซึ่งสะท้อนความไม่แน่นอนสูงได้อย่างถูกต้อง

### COMET (รายงานแยกต่างหาก ไม่เคยรวมเป็น composite)

COMET เป็น **neural metric ที่ถูกรายงานแยกออกมาต่างหาก** — ซึ่ง **จะไม่ถูกนำไปรวมกับ composite ใดๆ** (เนื่องจาก composite จะถูกรักษาให้เป็นแบบ deterministic; ดู [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) และ §2) Bootstrap CIs *จะถูก*คำนวณจากคะแนนต่อรายการที่ถูกแคชไว้ แต่มันไม่ใช่ composite metric ระดับ "first-class":
- โมเดล: `Unbabel/wmt22-comet-da` (โมเดลอ้างอิง WMT 2022); AfriCOMET จะถูกเลือกโดยอัตโนมัติสำหรับภาษาแอฟริกาที่รองรับ
- จะถูกคำนวณเมื่อมีการติดตั้ง `unbabel-comet`
- คะแนนต่อรายการจะถูกจัดเก็บไว้ในรายการของ TestReport; ค่าของ corpus จะมีข้อควรระวังเกี่ยวกับการปรับเทียบสำหรับภาษาที่มีทรัพยากรจำกัด (low-resource calibration caveat)
- ถูกคำนวณใหม่โดย verifier — ค่า COMET ที่รายงานจะต้องสามารถทำซ้ำได้
- Dependency ทางเลือก: `pip install mt-eval-harness[comet]`

### คอลัมน์ Supabase

ตาราง `run_cards` มีคอลัมน์ nullable ที่สอดคล้องกัน (ดู [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — คะแนน neural ที่รายงานแยกต่างหาก ไม่เคยรวมเป็น composite
- `corpus_bleu` (`real`)

ขอบเขตของ confidence interval ถูกเก็บไว้ภายใน JSON `scores` ของ run-card ภายใต้ `confidence_intervals` (ตาม run-card schema ใน scoring.md §9) ไม่ใช่เป็นคอลัมน์ระดับบนสุดแบบ denormalized
