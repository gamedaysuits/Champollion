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

> **状态**：✅ 已发布。配对显著性检验（默认使用近似随机化；可按需使用配对 Bootstrap）和 Bootstrap 置信区间已在 `mt_eval_harness/significance.py` 和 `mt_eval_harness/confidence.py` 中实现，已从包中导出，在 CLI 上公开，并由显著性 / 置信度 / 评分测试套件覆盖。
> **代码库**：`arena` —— 已接入 `tester.py`（单次运行置信区间）和 `compare.py`（运行间显著性）。
> **目的**：让研究人员确定两次评估运行之间的差异在统计上是显著的还是仅仅是噪声。

本页记录**已发布的行为** — 它是描述性的，而不是待办事项清单。

---

## 为什么这很重要

比较两次运行时（示例：系统 A chrF++ 42.96 对系统 B chrF++ 41.80，共 92 个条目），原始点差本身对于判断它是真实的还是噪声没有任何说明。仅有约 92 个测试条目，随机变化很容易产生 1-2 个点的波动。专家要求进行显著性检验 — 因此工具会计算它们。

**在评分标准（`standard/1`）下，基于 chrF++ 的配对检验决定了一次运行是否优于另一次运行。** chrF++ 是预先声明的主要指标（[评分规范](/docs/network/specifications/scoring#how-runs-are-scored)）。BLEU、spBLEU、TER 和 COMET（当两次运行都包含来自同一模型的每句段 COMET 分数时）作为次要标准指标进行检验并显示，精确匹配率（exact match）和插件比率作为诊断指标；它们都不起决定作用。这遵循了 Kocmi 等人（2021 年，“To Ship or Not to Ship”）的研究结果，他们在数千项人工评估中发现，指标差异结合其显著性能够预测人类偏好。

---

## 算法：配对近似随机化（默认）

`mt-eval compare --significance` 使用了 Riezler & Maxwell（2005）的**配对近似随机化（approximate randomization，AR）**检验。这也是 SacreBLEU 用于系统对比的默认方法。

### 工作原理

给定在相同 N 个测试条目上评估的两个系统 A 和 B：

1. 计算观测到的语料库级别差异：`Δ = metric(A) - metric(B)`。
2. 重复 `n_trials` 次（默认 1000 次）：
   a. 对于每个条目，以 ½ 的概率交换 A 和 B 的输出。
   b. 在两个打乱后的集合上重新计算语料库指标。
   c. 记录是否 `|Δ_shuffled| ≥ |Δ|`。
3. p 值是双侧达到的显著性水平（achieved significance level）：
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`。其中的 +1 将观测到的分配计为一次有效抽样，因此 p 绝不会恰好为 0。
4. 若 p < α（默认 0.05），则报告该差异具有显著性。

Δ 的置信区间是 Bootstrap 百分位区间（AR 生成 p 值，而不是区间）。它在单独的随机数流上计算，因此不会干扰 AR 抽样。

### 关键特性

- **真正的假设检验：**打乱是在零假设（由哪个系统生成特定条目并无区别）下抽样的。
- **配对：**两个系统按条目逐项进行比较，这保留了条目级别的相关性。
- **非参数化：**不对分数的分布方式作任何假设。

### 配对 Bootstrap（可用，非默认）

`paired_bootstrap()` 实现了 Koehn（2004）的配对 Bootstrap：它通过有放回抽样重新采样条目，并统计 Δ 符号翻转的频率。提供此方法是为了与早期论文保持可比性，但它是一种符号稳健性启发式方法，而非教科书式的显著性水平。它的分布以观测到的 Δ 为中心，而非以零假设为中心，因此与 AR 相比可能会夸大显著性。可以在命令行上使用 `mt-eval compare <reports…> --significance --method paired_bootstrap` 选择它，或在 `run_significance_tests` 中使用 `method="paired_bootstrap"`。

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

显著性检验的实现（默认使用近似随机化，可按需使用配对 Bootstrap）。其公开接口：

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

`compare.py` 对多个 TestReport 进行横向对比并在它们之间运行显著性检验。`run_significance_tests()` 驱动针对两个报告的检验，`format_significance_table()` 负责渲染结果。每个结果都带有其 `role`：`primary`（chrF++ —— 起决定作用的单一检验）、`secondary`（其他标准指标）或 `diagnostic`。它按以下顺序进行检验：

| 指标 | 角色 | 每次重抽样计算依据 |
|---|---|---|
| `corpus_chrf` | 主要 | 每句段的 sacreBLEU 统计数据 |
| `corpus_bleu` | 次要 | 每句段的 sacreBLEU 统计数据 |
| `corpus_spbleu` | 次要 | 基于 FLORES-200 SentencePiece 分词器的每句段 sacreBLEU 统计数据（spBLEU 是使用该分词器的 BLEU，即 FLORES/NLLB 表格报告的数值）。当分词器不可用时（缺少 `sentencepiece`，或处于离线状态且模型尚未下载），它将被列为未检验，绝不会被静默忽略 |
| `corpus_ter` | 次要 | 每句段的 sacreBLEU 统计数据。TER 是一种编辑率，因此**越低越好**：负的 Δ 表示 A 更优 |
| `comet_score` | 次要 | 两个报告已包含的每句段 COMET 分数（其均值即为 COMET 系统分数；不会重新运行模型）。当仅有一次运行使用 COMET 评分或两者使用了不同的 COMET 模型时，列为未检验并说明原因 |
| `exact_match_rate` | 诊断 | 每个条目的精确匹配标志 |
| 两个报告中的插件比率，例如 `giellalt_fst_validity.avg_fst_validity`、`.corpus_validity_rate`、`.morphological_accuracy`、`code_switching.avg_code_switching_rate`、`hallucination.avg_hallucination_rate` | 诊断 | 插件自身的逐条目结果，按主要结果相同的方式聚合 |

**已废弃的综合评分不进行检验。** 加权综合评分以及曾在此处检验的 `segment_composite` 行已被评分标准废弃（[评分规范 §4](/docs/network/specifications/scoring#4-composite-score)）。在标准制定前编写的比对 JSON 仍会显示其 `segment_composite`（或 `composite_score`）行，标记为不起任何决定作用的旧版综合评分。当被比对的报告属于旧版本时，`compare` 会声明其综合评分已废弃，且不对其进行比对。

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

当比对 2 个以上的报告时，会对所有成对组合运行两两显著性检验：`significance` 此时是一个 `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}` 对象列表（每对一个），每个 `tests` 列表的形式与双报告情况相同。`letters` 是运行表格中两次运行的字母代号，Δ 为前者减去后者。

除 `significance` 外，比对 JSON 还包含 `significance_settings`：`method`、`n_resamples`、`alpha`、`seed`、每个字母代表哪次运行（`runs`）、`ci_lower`/`ci_upper` 是什么、`multiple_testing_correction: "none"`、每对检验了多少项指标以及涉及多少对、关于未校正 p 值的通俗说明（见下文），以及检验引发的任何说明（从配对中排除的条目、未检验的指标）。

### 5. CLI 集成

`mt-eval compare` 提供了 `--significance` 标志，其中使用 `--method` 选择配对检验（默认为 `approximate_randomization`，或 `paired_bootstrap`），使用 `--n-bootstrap` 设置迭代次数：

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` 接收 `mt-eval run` 写入的 `*_report.json` 文件（或运行日志，它会使用其同级报告）。它会打印运行表格（每行一个指标，每列一次运行），接着打印显著性表格，并将比对 JSON 写入中立位置，除非 `-o` 指定了其他文件：当报告共享一个文件夹时写入报告旁的 `comparison-<hash>.json`，否则写入它们最近的公共文件夹中的 `comparisons/`（位于每次运行各自文件夹中的报告，如 `run_benchmark` 的 `mcp-run-<id>/` 文件夹，绝不会将比对结果写入其中任何一个）。`<hash>` 是按指定顺序对被比对运行的 ID 进行 sha256 计算的前十位十六进制字符，因此同一文件夹中的其他比对绝不会覆盖此文件；再次比对相同的运行则会重写它们自己的文件。使用 `-o` 指定文件名会替换现有的任何内容，并在输出中予以说明。它会打印写入的路径。在仅限本地、封闭（sealed）或需要同意的语料库上对比运行会引用其句子，因此无论写入何处，都会在 `<file>.champollion.json` 附随文件（sidecar）中带有该语料库的标记。

运行表格中的 **Avg latency (s/entry)** 对未记录时间的运行显示 `—`，并在表格下方添加说明解释原因：所有条目均来自缓存、输出是在 harness 外部生成的，或该方法未报告时间。低于 0.01 秒的值会显示到小数点后四位（CPU 上的小模型每句解码仅需几毫秒），绝不会舍入为 0.00。

### 6. 输出格式

`format_significance_table()` 渲染控制台视图；相同数据被添加到比较 JSON。

报告按给定的顺序分配字母代号：第一个是运行 **A**，第二个是 **B**，随后是 **C**、**D** 等，与上方的运行表格字母一致。每个成对表格通过这些字母及其运行 ID 来命名这两次运行，例如 `--- A (baseline) vs C (nllb-ft) ---`，其各列和 Δ 也使用相同的字母（`Δ (A−C)`）。Δ 始终为**前者 − 后者**。无论有多少对，表格的解释以及其下方的每条说明仅打印**一次**。每行还会打印 95% **CI on Δ**：即 JSON 中 `ci_lower`/`ci_upper` 的 Bootstrap 百分位区间，它表明了差异的可能大小，而不仅是其正负号。每个指标都根据指标注册表标注了其方向（↑ 越高越好，↓ 越低越好），并且 **Better** 列在感知方向的前提下指出得分更优的运行，差异不显著时显示 `(n.s.)`。因此，越低越好的比率（如 TER、语码转换或幻觉）若数值上升，则打印正的 Δ 并将 **B** 标记为更优运行；而作为第二个传入的训练模型若比其基线高出 63.5 个 chrF++，则打印 Δ −63.52 且 **B** 更优。注册表未声明方向的指标将显示 `?`。分数、Δ 和区间均打印至两位小数；若两位小数会掩盖真实差异，则会打印更多位数（最多六位）：例如 0.0684 对比 0.0673 的 spBLEU 将打印 Δ +0.0011 [+0.0001, +0.0021]，绝不会在 **Yes** 旁边显示 +0.00 [+0.00, +0.00]，并且表格会注明这些行保留了更多小数位数。JSON 保留四位小数，对于小于该精度的非零值则保留四位有效数字，因此真实差异绝不会被存储为 0。完全相同的输出得出 Δ 恰好为 0 且 p = 1，因此绝不会显著。如果 p 低于 α，但 Δ 的 Bootstrap 区间恰好为 [0, 0]（差异句段过少以至于无法估计差异），则 **Sig?** 显示 `?†`，**Better** 显示 `—†`，并附有说明：没有运行被判定为在此指标上更优。对于越低越好的插件比率，JSON `winner` 同样具有方向感知（比率较低者胜出），正如其对于 `corpus_ter` 一直以来的表现；没有更优方向的插件比率（中性，例如 `morph_coverage`，或未声明）则为 `winner: null`。每个结果还带有其 `direction`。

**控制台输出**（示意数据）：
```
  Significance Tests (paired approximate randomization, n=1000, α=0.05):
  Each table names its two runs by their letters in the run table above.
  Δ = first run − second run.  ↑ higher is better, ↓ lower is better.
  Better = the run with the better score, by the metric's direction; (n.s.) = not significant.
  95% CI on Δ = bootstrap percentile interval: how large the difference plausibly is.

  --- A (baseline) vs B (coached) ---

  Metric                                          A        B  Δ (A−B)      95% CI on Δ  p-value  Sig?  Better
  ---------------------------------------- -------- -------- -------- ---------------- -------- -----  --------
  ↑ corpus_chrf                               42.96    41.80    +1.16   [-0.85, +3.12]    0.142    No  A (n.s.)
  ↑ corpus_bleu                                6.80     3.81    +2.99   [+0.61, +5.40]    0.018 Yes *  A
  ↑ corpus_spbleu                              9.10     6.42    +2.68   [+0.35, +5.02]    0.027 Yes *  A
  ↓ corpus_ter                                61.20    64.90    -3.70   [-7.05, -0.41]    0.030 Yes *  A
  ↑ exact_match_rate                           0.20     0.19    +0.01   [-0.03, +0.05]    0.381    No  A (n.s.)
  ↓ code_switching.avg_code_switching_rate     0.60     0.08    +0.52   [+0.45, +0.59]    0.001 Yes *  B

  p-values are per metric and uncorrected — no multiple-testing correction is
  applied (deliberately: the MT convention is to report each metric's own
  p-value). 6 metrics were tested, so one "significant" result at p<0.05 can
  turn up by chance alone. And a small Δ can be significant yet not
  meaningful: check the CI on Δ (how large the difference plausibly is) and
  how reliable the metric is for this language before acting on it.
```

在此示例中，结论是**无显著差异**：主要指标 chrF++ 无法区分 A 和 B（p = 0.142），因此没有哪次运行被认定为更优 —— 尽管 BLEU、spBLEU 和 TER 倾向于 A，而语码转换倾向于 B。这些行都会显示，读者可能想要深入研究它们，但它们不起决定作用。表格首先列出 chrF++，接着是其他标准指标，最后是诊断指标。

当运行次数超过两次时，单个表头下方会接连显示各个 `--- X (run) vs Y (run) ---` 表格，说明中会统计执行的每一次检验（`6 metrics were tested per pair (36 tests over 6 pairs)`）。

**JSON 输出**（添加到比对报告中）：
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
      "ci_upper": 3.12,
      "method": "approximate_randomization",
      "direction": "higher",
      "role": "primary"
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

4. **插件指标**：同时出现在两个报告中的插件比率仅根据报告实际包含的每句段数值进行检验。这意味着插件自身对其逐条目结果的聚合（FST 指标），或者 `avg_<name>` 聚合所平均的逐条目数值的均值（行为指标）。没有每句段数值的插件比率将列为未检验，绝不会显示为 0.00 vs 0.00。诸如 `total_words_checked` 的计数不进行检验。

5. **可重现性**: RNG 种子必须记录在输出中，以便结果完全可重现。默认为 12345（与 SacreBLEU 约定匹配）。

---

## 不要构建什么

- **检验中不进行 COMET 重新推理**：COMET 基于两份报告已包含的每句段分数进行配对检验；每次重抽样绝不会重新运行模型。使用不同 COMET 模型评分的两次运行不会相互检验。
- **不进行贝叶斯分析**：坚持使用频率学派的 Bootstrap。这是机器翻译（MT）社区所期望和理解的方法。
- **不进行多重检验校正**：当检验多个指标时，不应用 Bonferroni 或类似的校正。机器翻译评估的惯例是报告每个指标的原始 p 值并由读者自行解读。`mt-eval compare` 在其输出和 `comparison.json` 中**对此明确说明**（`significance_settings.multiple_testing_correction: "none"` 并附有通俗说明）：在检验多个指标时，仅凭偶然就可能出现一个 p < 0.05 的结果，而且微小的 Δ 即使显著也可能无关紧要，因此在根据单一的“显著”采取行动之前，请阅读 Δ 的 CI 以及该指标对该语言的可靠性。

---

## 排名聚类 {#ranking-clusters}

> **状态**：✅ 已发布，适用于竞赛（contests）。竞赛排名是一组**聚类（clusters）**，而非严格的排序 —— 显著性检验决定了相邻条目实际上是否可区分。本节介绍了已发布的功能，包括证据强度弱于配对检验的情况。

### 相邻链接，竞赛排名编号

参赛条目首先按**赛道（track）**进行划分 —— `constrained` 系统绝不会与 `unconstrained` 系统一起排名，每个赛道都有自己的排序、平局分组和排名范围，因此“第 1 名”始终指*赛道内*的第 1 名。

在赛道内，条目按竞赛的主要指标（除非竞赛记录了其他指标，否则为 chrF++）排序，其次按其余表层指标排序，最后按最早提交时间排序。按此顺序检验每个**相邻**对。检验无法区分的一对条目共享排名，且共享的排名会**链接（chain）**：若 A 与 B 平局，B 与 C 平局，则即使 A 和 C 从未被直接比较过，这三者也会归入同一个平局分组。

排名采用竞赛编号方式（competition numbering）—— 榜首三方并列为 `1, 1, 1`，下一条目为 `4`；并列第二为 `1, 2, 2, 4`。

**链接的真实局限**：不显著性不具备传递性。一条长链可能会将直接检验*能够*区分的两个条目连接在一起。这就是为什么聚类报告为**范围**而非单点。

### 排名范围

每个条目都带有 `rank_min` 和 `rank_max` —— 即与证据一致的最佳和最差名次，采用 WMT 用于其排名范围的风格。单独处于其聚类中的条目具有 `rank_min == rank_max`。跨越第 2–5 名的四条目聚类中的某个条目带有 `rank_min: 2, rank_max: 5`，且**该聚类中的任何条目都不“领先于”另一个条目**。脱离聚类截取单一数字排名是对结果的误读。

### 证据阶梯

并非每一对都能以相同的方式进行检验，因此每一对都会记录该判定实际所依据的阶梯层级（rung）。该标签是结果的一部分，绝不会被丢弃：

| 层级 | 证据 | 何时可用 | 强度 |
|---|---|---|---|
| 1 | **每句段配对检验** —— 默认使用近似随机化，可按需使用配对 Bootstrap（如上文所述算法） | 仅当两个条目均包含完整、对齐的每句段分数集合时 | 真正的检验 |
| 2 | 已发布区间边界上的 **95% Bootstrap CI 重叠** | 当主要指标在两个条目上均具有置信区间边界时（chrF++ 具有；BLEU 和 COMET 没有区间列） | 保守的替代方法 —— 重叠的区间并**不**证明等价，且不重叠比配对检验的门槛更严格 |
| 3 | 指标显示舍入精度下的**点值相等** | 始终可用 | 最弱的层级：仅表示打印出的两个数字完全相同 |

### 封闭竞赛：层级 1 在节点上运行

层级 1 需要来自两个系统的每句段分数。在封闭竞赛中，组织者的评估节点持有参考译文，且**绝不导出逐句段输出**。这就是封闭赛道的全部意义所在，也是不可放宽的设置。因此，配对检验转为在数据侧运行。

`mt-eval node verdicts` 在节点上针对封闭参考译文及其评分的每对条目运行竞赛自身的配对检验，并**仅写入判定结果（verdicts only）**：对于每对条目，包含方法、p 值、分数差、其置信区间以及句段数量。文件中不包含任何句段、参考译文或翻译。节点使用其分数签名密钥（score-sign key）对其进行签名。组织者随后使用 `mt-eval contest close --node-verdicts <file> --verify-key <node public key>` 进行结算。仅当签名验证通过，并且这些结果是针对本次竞赛、其封闭数据集、其指标、其冻结的平局策略以及承诺的 harness 版本计算得出时，排名才会使用这些判定结果。否则，结算操作将拒绝执行。

在未提供判定结果时，封闭竞赛的平局判断在指标具有置信区间的指标上依赖置信区间重叠，在没有区间的指标上依赖点值相等。因此其聚类范围会比配对检验得出的聚类更宽。排名本身会说明适用哪种情况：`ranking_method.evidence_used` 指明实际使用的层级，`ranking_method.node_verdicts` 指明所使用判定结果的节点（若有）。

### 排名不包含的内容

- **对比条目（Contrastive entries）**在独立章节中报告，绝不会获胜。
- **运行时间、硬件和成本**附带在运行卡（run card）中进行报告，绝不参与排名。没有效率赛道。
- **人工评估**完全不在这些排名之中。可以在已结算的竞赛中记录人工评估*入选范围（selection）* —— 即固定预算所能覆盖的系统，按完整的平局分组选取以确保聚类绝不会被拆半 —— 但不存在评分；参见 [机器翻译评估规则](/docs/network/leaderboard/rules#verification-tiers)。

---

## 模块映射

已发布功能所在的位置：

| 文件 | 角色 |
|---|---|
| `pyproject.toml` | 将 `sacrebleu>=2.3` 声明为强依赖（hard dependency） |
| `mt_eval_harness/tester.py` | 直接导入 sacrebleu（无 `HAS_SACREBLEU` 保护）；计算单次运行的 CI |
| `mt_eval_harness/significance.py` | 配对检验（默认 `paired_approximate_randomization` 及 `paired_bootstrap`）、`SignificanceResult`、内置指标函数（chrF++、BLEU、spBLEU、TER、来自缓存每句段分数的 COMET、精确匹配；已废弃的句段级别综合评分仅保留用于读取旧比对文件）、`run_significance_tests`、`format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap 置信区间：`bootstrap_ci`、`compute_all_cis`、`compute_per_tier_cis`、`ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | 导出 `SignificanceResult`、`paired_bootstrap`、`ConfidenceInterval`、`bootstrap_ci`、`compute_all_cis` |
| `mt_eval_harness/compare.py` | 将显著性检验接入报告比对 |
| `mt_eval_harness/cli.py` | `--significance` / `--method` / `--n-bootstrap`（compare）和 `--no-ci` / `--n-bootstrap-ci`（test）标志 |
| `mt_eval_harness/dashboard.py` | 在比对表格中呈现显著性（可选增强项） |

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

由 harness 计算的确定性语料库级别指标：
- `corpus_chrf`（chrF++ 分数）
- `corpus_bleu`（BLEU 分数）
- `exact_match_rate`（0.0–1.0）
- `fst_acceptance_rate`（存在 FST 数据时）


chrF++ 区间是已发布核心数据（headline，`chrF++ 47.5 [45.9, 49.0]`）的一部分。**同时**也会为 `comet_score` 计算 CI，其基于缓存的逐条目分数进行 Bootstrap 抽样（无冗余神经推理）。新运行不会计算综合评分 CI；仅在验证旧版卡片时，才会重新推导该卡片存储的综合评分 CI。

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

### COMET（计算时作为标准指标，置于 chrF++ 旁）

无论何时计算 COMET，它都会作为**显示在 chrF++ 核心数据旁的神经模型指标**呈现，并带有其模型 ID。它绝不会与 chrF++ 混合，且它不是主要核心指标，因为它需要大型模型且对大多数低资源语言未经过校准（参见 [评分规范 §2.3](/docs/network/specifications/scoring#2-metric-inventory)）。Bootstrap CI 基于其缓存的逐条目分数进行计算：
- 模型：`Unbabel/wmt22-comet-da`（WMT 2022 基于参考译文的模型）；对于受支持的非洲语言自动选择 AfriCOMET
- 安装 `unbabel-comet` 时计算
- 逐条目分数存储在 TestReport 条目中；语料库数值带有低资源语言校准告诫
- 由验证器（verifier）重新推导 —— 报告的 COMET 值必须可复现
- 可选依赖：`python3 -m pip install 'mt-eval-harness[comet]'`（或 `mt-eval setup --comet`）

### Supabase 列

`run_cards` 表包含相应的可空列（参见 [scoring.md §9.1](/docs/network/specifications/scoring)）：
- `chrf_plus_plus`、`chrf_ci_lower`、`chrf_ci_upper`（`real`）—— 核心数据及其 95% 区间
- `comet_score`（`real`）—— 显示在核心数据旁，绝不混合
- `corpus_bleu`（`real`）

完整的置信区间集合存储在运行卡 `scores` JSON 中的 `confidence_intervals` 下（按照 scoring.md §9 中的运行卡 schema）；仅 chrF++ 的边界值同时被非规范化存储为列。
