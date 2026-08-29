---
sidebar_position: 7
title: "統計的有意性検定"
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

# 統計的有意性検定

> **ステータス**: ✅ 実装済み。ペアードブートストラップ有意性検定およびブートストラップ信頼区間は `mt_eval_harness/significance.py` と `mt_eval_harness/confidence.py` に実装されており、パッケージからエクスポートされ、CLI に公開され、有意性・信頼性・スコアリングのテストスイートでカバーされています。
> **コードベース**: `arena` — `tester.py`（実行ごとの信頼区間）および `compare.py`（実行間の有意性）に組み込まれています。
> **目的**: 2つの評価実行の差が統計的に有意なのか、単なるノイズなのかを研究者が判断できるようにします。

このページは**実装済みの動作**を説明するものです。To-Doリストではありません。

---

## なぜこれが重要なのか

2つの実行を比較する場合（例：92エントリに対してシステムA の chrF++ が 42.96、システムB が 41.80）、生の点差だけでは、その差が実際のものかノイズかを判断することはできません。テストエントリが約92件しかない場合、ランダムな変動によって1〜2ポイントの差が生じることは十分あり得ます。専門家は有意性検定を求めるため、ハーネスはそれを計算します。

---

## アルゴリズム：ペアードブートストラップリサンプリング

これは SacreBLEU、MT-Lens、および WMT 共有タスクで使用されている標準的な手法です。MT 研究者にとってよく知られており、信頼性の高い結果を生み出します。

### 仕組み

同じ N 件のテストエントリで評価された2つのシステム A と B が与えられた場合：

1. 実際のメトリクス差を計算する：`Δ = metric(A) - metric(B)`
2. `n_bootstrap` 回繰り返す（デフォルト 1000）：
   a. 共有テストセットから N 件のエントリを**復元抽出**でサンプリングする
   b. このブートストラップサンプルに対して A と B 両方のメトリクスを計算する
   c. ブートストラップ差を計算する：`Δ_boot = metric(A_boot) - metric(B_boot)`
3. p値 = `Δ_boot` の符号が `Δ` と逆になるブートストラップサンプルの割合
4. p値 < α（デフォルト 0.05）の場合、差は統計的に有意である

### 主な特性

- **ペアード**：両システムを同じブートストラップサンプルで評価することで、エントリレベルの相関を保持する
- **ノンパラメトリック**：スコアの分布に関する仮定が不要
- **標準的**：これは `sacrebleu --paired-bs` が内部で行っていることと全く同じ

---

## sacrebleu は必須依存関係

sacrebleu は必須依存関係です。chrF++ や BLEU を計算できない MT 評価ハーネスは MT 評価ハーネスとは言えないため、以下のようになっています：

1. `sacrebleu>=2.3` は `pyproject.toml` の `[project.dependencies]` に宣言されています（`[project.optional-dependencies]` ではありません）。
2. `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — に `try/except` ガードなしで直接インポートされています。
3. `significance.py` に直接インポートされています。

`HAS_SACREBLEU` の条件分岐パスはどこにも存在しません。sacrebleu なしでの実行はサポートされている構成ではありません。

---

## 実装

### 1. sacrebleu を必須依存関係として使用する

`pyproject.toml` は `sacrebleu>=2.3` を `[project.dependencies]` に宣言しており、`tester.py` はそれを直接インポートしています：

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

`tester.py` には `if HAS_SACREBLEU:` ガードは存在しません。条件付きインポートパスは削除されました。

---

### 2. モジュール：`mt_eval_harness/significance.py`

ペアードブートストラップのコア実装です。公開インターフェース：

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

### 3. 組み込みメトリクス関数

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

### 4. `compare.py` への統合

`compare.py` は複数の TestReport を並べて比較し、それらの間で有意性検定を実行します。`significance.py` には `fst_acceptance_rate()` と `composite_score()`（FST および複合差の有意性検定が可能）、`run_significance_tests()`（2つのレポート間で全メトリクスを駆動）、および `format_significance_table()`（コンソールレンダリング）も含まれています。

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

3つ以上のレポートを比較する場合、全ペアに対してペアワイズ有意性検定が実行され、`"(run_a_id, run_b_id)"` をキーとして管理されます。

### 5. CLI への統合

`mt-eval compare` は `--significance` フラグを公開しており、`--n-bootstrap` で反復回数を設定できます：

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. 出力形式

`format_significance_table()` がコンソールビューをレンダリングします。同じデータが比較 JSON にも追加されます。

**コンソール出力：**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**JSON 出力**（比較レポートに追加）：
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

### 7. ダッシュボードへの統合（オプションの拡張）

比較 JSON に有意性データが含まれている場合、ダッシュボードはそれを表示できます。有意性インジケーター（p < 0.05 の場合は `*`、p < 0.01 の場合は `**`）付きの比較テーブル行として表示されます。これは実装済みの計算の上に乗るプレゼンテーション層であり、コア機能の一部ではありません。

---

## エッジケースとバリデーション

1. **エントリの不一致**：2つの TestReport は同じエントリ ID を持つ必要があります。そうでない場合（例：一方がサブセットで実行された場合）、共通部分のみで有意性検定を行います。除外されたエントリについては警告を表示します。

2. **エントリ数が少なすぎる場合**：N < 10 の場合、エントリ数が少なすぎるため有意性検定の信頼性が低いことを警告します。それでも検定は実行しますが、警告を表示します。

3. **スコアが同一の場合**：両システムがエントリごとに同一の結果を出した場合、p_value は 1.0 になるべきです（差がまったくない）。

4. **プラグインメトリクス**：有意性モジュールは、両方のレポートに存在するプラグインメトリクスについても検定を行う必要があります。汎用的なアプローチを使用します：両方のレポートに `plugin_metrics.crk_fst_validity.avg_fst_validity` がある場合は検定します。

5. **再現性**：RNG シードは出力にログとして記録され、結果を完全に再現できるようにする必要があります。デフォルトは 12345 です（SacreBLEU の慣例に合わせています）。

---

## 実装しないもの

- **COMET の個別有意性検定なし**：COMET は**別のニューラルレーン**で計算・報告されます。**いかなる複合指標にも組み込まれません**（複合指標は決定論的です。[scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) および §2 を参照）。キャッシュされたエントリごとのスコアに対してブートストラップ CI を計算することは*可能*ですが、ハーネスは COMET のペアワイズ有意性検定を組み込みでは実行しません。2つのシステム間の COMET ペアワイズ有意性検定には、Unbabel の `comet-compare` を使用してください。
- **ベイズ分析なし**：頻度論的ブートストラップに留めます。MT コミュニティが期待し、理解しているものです。
- **多重検定補正なし**：複数のメトリクスを検定する場合、Bonferroni 補正などは適用しません。MT 評価の慣例では、メトリクスごとの生の p 値を報告し、解釈は読者に委ねます。

---

## モジュールマップ

実装済み機能の所在：

| ファイル | 役割 |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` を必須依存関係として宣言 |
| `mt_eval_harness/tester.py` | sacrebleu の直接インポート（`HAS_SACREBLEU` ガードなし）；実行ごとの CI を計算 |
| `mt_eval_harness/significance.py` | ペアードブートストラップのコア：`paired_bootstrap`、`SignificanceResult`、組み込みメトリクス関数、`run_significance_tests`、`format_significance_table` |
| `mt_eval_harness/confidence.py` | ブートストラップ信頼区間：`bootstrap_ci`、`compute_all_cis`、`compute_per_tier_cis`、`ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | `SignificanceResult`、`paired_bootstrap`、`ConfidenceInterval`、`bootstrap_ci`、`compute_all_cis` をエクスポート |
| `mt_eval_harness/compare.py` | レポート比較に有意性検定を組み込み |
| `mt_eval_harness/cli.py` | `--significance` / `--n-bootstrap`（compare）および `--no-ci` / `--n-bootstrap-ci`（test）フラグ |
| `mt_eval_harness/dashboard.py` | 比較テーブルに有意性を表示（オプションの拡張） |
| `tests/test_significance.py`、`tests/test_confidence.py` | ユニットテスト（合格済みテストスイートの一部） |

---

## テストカバレッジ

有意性・信頼性・スコアリングのテストスイートはすべてグリーンです。以下をカバーしています：

1. **シードによる決定論的動作**：同じ入力 + 同じシード → 毎回同じ p 値
2. **既知の答えによるテスト**：2つの同一の結果セット → p_value = 1.0
3. **既知の有意差テスト**：一方が明らかに優れている2つの結果セット（例：全て完全一致 vs 全て不一致）→ p_value ≈ 0.0
4. **ID の不一致**：`ValueError` を発生させるか、警告を出して共通部分で計算する
5. **空の入力**：適切に処理される（p_value = 1.0 または例外を発生させる）

---

## 信頼区間（付随機能）

> **ステータス**: ✅ `confidence.py` に実装済み

信頼区間（CI）は有意性検定とは異なる問いに答えます：

- **有意性検定**（`significance.py`）：「システム A とシステム B の差は本物か？」
- **信頼区間**（`confidence.py`）：「このシステム単体のスコアはどの程度不確かか？」

### 実装：`confidence.py`

有意性検定と同じパーセンタイルブートストラップリサンプリング手法を使用します：

| パラメータ | 値 | 根拠 |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU のデフォルト、WMT 2024 の慣例 |
| `seed` | 12345 | 再現性のための SacreBLEU デフォルトシード |
| `alpha` | 0.05 | 標準的な 95% 信頼水準 |
| Method | Percentile bootstrap | Koehn (2004)、Efron (1979) |

### CI が計算される対象

ハーネスが計算する決定論的なコーパスレベルのメトリクス：
- `corpus_chrf`（chrF++ スコア）
- `corpus_bleu`（BLEU スコア）
- `exact_match_rate`（0.0〜1.0）
- `fst_acceptance_rate`（FST データが存在する場合）
- `composite`（chrF++ と完全一致が利用可能な場合）

ニューラル `comet_score` についても CI が**計算されます**。キャッシュされたエントリごとのスコアからブートストラップされます（冗長なニューラル推論は行いません）。CI があっても COMET は複合メトリクスにはなりません。COMET は**別のニューラルレーン**で報告され、複合指標には組み込まれません（[scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) を参照）。

### CLI フラグ

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### サンプル数が少ない場合の警告

N < 30 エントリの場合、モジュールは CI のカバレッジが不十分になる可能性があるという警告を出力します。ブートストラップはサンプルにない情報を生み出すことはできません。エントリ数が非常に少ない場合、区間は広くなりますが、これは高い不確実性を正しく反映しています。

### COMET（別途報告、複合指標には組み込まれない）

COMETは**独立した枠で報告されるニューラル指標**です。**いかなる複合指標にも組み込まれることは決してありません**（複合指標は決定論的に保たれます。[scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) および §2 を参照してください）。ブートストラップ信頼区間（CI）は、キャッシュされたエントリごとのスコアに基づいて計算*されます*が、「第一級」の複合指標ではありません。
- モデル: `Unbabel/wmt22-comet-da`（WMT 2022 参照ベースモデル）。サポートされているアフリカの言語には AfriCOMET が自動選択されます
- `unbabel-comet` がインストールされている場合に計算されます
- エントリごとのスコアは TestReport エントリに保存されます。コーパス値には、低リソース言語向けのキャリブレーションに関する注意事項が伴います
- 検証者によって再導出されます — 報告された COMET 値は再現可能でなければなりません
- オプションの依存関係: `pip install mt-eval-harness[comet]`

### Supabase カラム

`run_cards` テーブルには対応する nullable カラムが含まれています（[scoring.md §9.1](/docs/network/specifications/scoring) を参照）：
- `comet_score`（`real`）— 別途報告されるニューラルスコア。複合指標には組み込まれない
- `corpus_bleu`（`real`）

信頼区間の境界値は、非正規化されたトップレベルのカラムとしてではなく、`confidence_intervals` 配下のランカード `scores` JSON 内に保存されます（scoring.md §9 のランカードスキーマに従います）。
