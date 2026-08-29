---
sidebar_position: 7
title: "统计显著性检验"
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

# 统计显著性检验

> **状态**: ✅ 已发布。配对自助法显著性检验和自助法置信区间已在 `mt_eval_harness/significance.py` 和 `mt_eval_harness/confidence.py` 中实现，从包中导出，在 CLI 上公开，并由显著性/置信度/评分测试套件覆盖。
> **代码库**: `arena` — 连接到 `tester.py`（每次运行置信区间）和 `compare.py`（运行间显著性）。
> **目的**: 让研究人员确定两次评估运行之间的差异是否具有统计显著性，或仅仅是噪声。

本页记录**已发布的行为** — 它是描述性的，而不是待办事项清单。

---

## 为什么这很重要

比较两次运行时（示例：系统 A chrF++ 42.96 对系统 B chrF++ 41.80，共 92 个条目），原始点差本身对于判断它是真实的还是噪声没有任何说明。仅有约 92 个测试条目，随机变化很容易产生 1-2 个点的波动。专家要求进行显著性检验 — 因此工具会计算它们。

---

## 算法：配对自助法重采样

这是 SacreBLEU、MT-Lens 和 WMT 共享任务使用的标准方法。它被 MT 研究人员充分理解，并产生他们信任的结果。

### 工作原理

给定在相同 N 个测试条目上评估的两个系统 A 和 B：

1. 计算实际指标差异：`Δ = metric(A) - metric(B)`
2. 重复 `n_bootstrap` 次（默认 1000）：
   a. 从共享测试集中**有放回地**采样 N 个条目
   b. 在此自助法样本上计算 A 和 B 的指标
   c. 计算自助法差异：`Δ_boot = metric(A_boot) - metric(B_boot)`
3. p 值 = 自助法样本中 `Δ_boot` 与 `Δ` 符号相反的比例
4. 如果 p 值 < α（默认 0.05），则差异具有统计显著性

### 关键特性

- **配对的**: 两个系统在相同的自助法样本上评估，保留条目级相关性
- **非参数的**: 对分数分布没有假设
- **标准的**: 这正是 `sacrebleu --paired-bs` 在幕后所做的

---

## sacrebleu 是硬依赖

sacrebleu 是硬依赖。无法计算 chrF++ 或 BLEU 的 MT 评估工具不是 MT 评估工具，因此：

1. `sacrebleu>=2.3` 在 `pyproject.toml` 中的 `[project.dependencies]` 下声明（不是 `[project.optional-dependencies]`）。
2. 它直接导入到 `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — 中，没有 `try/except` 保护。
3. 它直接导入到 `significance.py` 中。

任何地方都没有 `HAS_SACREBLEU` 条件路径：在没有 sacrebleu 的情况下运行不是受支持的配置。

---

## 实现

### 1. sacrebleu 作为硬依赖

`pyproject.toml` 在 `[project.dependencies]` 下声明 `sacrebleu>=2.3`，`tester.py` 直接导入它：

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

`tester.py` 中没有 `if HAS_SACREBLEU:` 保护 — 条件导入路径已被移除。

---

### 2. 模块：`mt_eval_harness/significance.py`

核心配对自助法实现。其公共接口：

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

### 3. 内置指标函数

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

### 4. 集成到 `compare.py`

`compare.py` 进行多个 TestReports 的并排比较并在它们之间运行显著性检验。`significance.py` 也提供 `fst_acceptance_rate()` 和 `composite_score()`（因此 FST 和复合差异可以进行显著性检验），`run_significance_tests()`（驱动两个报告中的所有指标），以及 `format_significance_table()`（控制台渲染）。

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

比较超过 2 个报告时，对所有对进行配对显著性检验，由 `"(run_a_id, run_b_id)"` 键入。

### 5. CLI 集成

`mt-eval compare` 公开 `--significance` 标志，使用 `--n-bootstrap` 设置迭代计数：

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. 输出格式

`format_significance_table()` 渲染控制台视图；相同数据被添加到比较 JSON。

**控制台输出：**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**JSON 输出**（添加到比较报告）：
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

### 7. 仪表板集成（可选增强）

当比较 JSON 中存在显著性数据时，仪表板可以显示它 — 一个带有显著性指示器的比较表行（`*` 表示 p < 0.05，`**` 表示 p < 0.01）。这是已发布计算之上的表示层，不是核心功能的一部分。

---

## 边界情况和验证

1. **条目不匹配**: 两个 TestReports 必须具有相同的条目 ID。如果不匹配（例如，一个在子集上运行），仅在交集上测试显著性。警告排除的条目。

2. **条目太少**: 如果 N < 10，警告显著性检验在这么少的条目上不可靠。仍然运行它们，但打印警告。

3. **相同分数**: 如果两个系统产生相同的每条目结果，p_value 应为 1.0（完全没有差异）。

4. **插件指标**: 显著性模块也应测试出现在两个报告中的任何插件指标。使用通用方法：如果两个报告都有 `plugin_metrics.crk_fst_validity.avg_fst_validity`，测试它。

5. **可重现性**: RNG 种子必须记录在输出中，以便结果完全可重现。默认为 12345（与 SacreBLEU 约定匹配）。

---

## 不要构建什么

- **无单独的 COMET 显著性**: COMET 在**单独的神经通道**中计算和报告 — 它**从不折叠到任何复合中**（复合是确定性的；见 [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) 和 §2）。自助法 CI *可以*在其缓存的每条目分数上计算，但工具不运行 COMET 的内置配对显著性检验。对于两个系统之间的成对 COMET 显著性，使用 Unbabel 的 `comet-compare`。
- **无贝叶斯分析**: 坚持频率论自助法。这是 MT 社区期望和理解的。
- **无多重检验校正**: 测试多个指标时，不应用 Bonferroni 或类似校正。MT 评估中的约定是报告每个指标的原始 p 值，让读者解释。

---

## 模块映射

已发布功能所在的位置：

| 文件 | 角色 |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` 声明为硬依赖 |
| `mt_eval_harness/tester.py` | 直接 sacrebleu 导入（无 `HAS_SACREBLEU` 保护）；计算每次运行 CI |
| `mt_eval_harness/significance.py` | 配对自助法核心：`paired_bootstrap`、`SignificanceResult`、内置指标函数、`run_significance_tests`、`format_significance_table` |
| `mt_eval_harness/confidence.py` | 自助法置信区间：`bootstrap_ci`、`compute_all_cis`、`compute_per_tier_cis`、`ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | 导出 `SignificanceResult`、`paired_bootstrap`、`ConfidenceInterval`、`bootstrap_ci`、`compute_all_cis` |
| `mt_eval_harness/compare.py` | 显著性检验连接到报告比较 |
| `mt_eval_harness/cli.py` | `--significance` / `--n-bootstrap`（比较）和 `--no-ci` / `--n-bootstrap-ci`（测试）标志 |
| `mt_eval_harness/dashboard.py` | 在比较表中显示显著性（可选增强） |
| `tests/test_significance.py`、`tests/test_confidence.py` | 单元测试（通过测试套件的一部分） |

---

## 测试覆盖

显著性/置信度/评分套件是绿色的。它们覆盖：

1. **使用种子确定性**: 相同输入 + 相同种子 → 相同 p 值，每次
2. **已知答案测试**: 两个相同结果集 → p_value = 1.0
3. **已知显著测试**: 两个结果集，其中一个明显更好（例如，所有精确匹配对所有错误） → p_value ≈ 0.0
4. **ID 不匹配**: 抛出 `ValueError`，或警告并在交集上计算
5. **空输入**: 优雅处理（p_value = 1.0 或抛出）

---

## 置信区间（配套功能）

> **状态**: ✅ 在 `confidence.py` 中实现

置信区间 (CI) 回答了与显著性检验不同的问题：

- **显著性检验** (`significance.py`)："系统 A 和系统 B 之间的差异是真实的吗？"
- **置信区间** (`confidence.py`)："这个系统自身的分数有多不确定？"

### 实现：`confidence.py`

使用与显著性检验相同的百分位数自助法重采样方法：

| 参数 | 值 | 理由 |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU 默认值，WMT 2024 约定 |
| `seed` | 12345 | SacreBLEU 默认种子以确保可重现性 |
| `alpha` | 0.05 | 标准 95% 置信水平 |
| 方法 | 百分位数自助法 | Koehn (2004)、Efron (1979) |

### 什么获得 CI

工具计算的确定性语料库级指标：
- `corpus_chrf` (chrF++ 分数)
- `corpus_bleu` (BLEU 分数)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (当存在 FST 数据时)
- `composite` (当 chrF++ 和精确匹配可用时)

CI **也**为神经 `comet_score` 计算，从其缓存的每条目分数自助法（无冗余神经推理）。拥有 CI 不会使 COMET 成为复合指标：它在**单独的神经通道**中报告，从不折叠到复合中（见 [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)）。

### CLI 标志

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### 小样本警告

当 N < 30 个条目时，模块发出警告，CI 可能覆盖率较差。自助法无法创建样本中不存在的信息 — 条目很少时，区间会很宽，正确反映高度不确定性。

### COMET（单独报告，从不复合）

COMET 是一种**独立报告的神经指标**——它**绝不会被合并到任何复合指标中**（复合指标保持确定性；参见 [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) 和 §2）。Bootstrap CIs *确实*会基于其缓存的单条目分数进行计算，但它并不是“一等”复合指标：
- 模型：`Unbabel/wmt22-comet-da`（WMT 2022 基于参考的模型）；对于受支持的非洲语言，会自动选择 AfriCOMET
- 在安装了 `unbabel-comet` 时计算
- 单条目分数存储在 TestReport 条目中；语料库值带有低资源校准警告
- 由验证器重新推导——报告的 COMET 值必须可复现
- 可选依赖项：`pip install mt-eval-harness[comet]`

### Supabase 列

`run_cards` 表携带相应的可空列（见 [scoring.md §9.1](/docs/network/specifications/scoring)）：
- `comet_score` (`real`) — 单独报告的神经分数，从不复合
- `corpus_bleu` (`real`)

置信区间边界存储在运行卡 `scores` JSON 中的 `confidence_intervals` 下（根据 scoring.md §9 中的运行卡架构），而不是作为非规范化的顶级列。
