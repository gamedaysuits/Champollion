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

> **ステータス**: ✅ 提供済み。ペア有意差検定（デフォルトは近似無作為化、指定時はペアブートストラップ）およびブートストラップ信頼区間は `mt_eval_harness/significance.py` と `mt_eval_harness/confidence.py` に実装され、パッケージからエクスポートされ、CLI で公開され、有意差・信頼区間・スコアリングのテストスイートでカバーされています。
> **コードベース**: `arena` — `tester.py`（実行ごとの信頼区間）および `compare.py`（実行間の有意差）に組み込まれています。
> **目的**: 2つの評価実行間の差異が統計的に有意であるか、単なるノイズであるかを研究者が判断できるようにします。

このページは**実装済みの動作**を説明するものです。To-Doリストではありません。

---

## なぜこれが重要なのか

2つの実行を比較する場合（例：92エントリに対してシステムA の chrF++ が 42.96、システムB が 41.80）、生の点差だけでは、その差が実際のものかノイズかを判断することはできません。テストエントリが約92件しかない場合、ランダムな変動によって1〜2ポイントの差が生じることは十分あり得ます。専門家は有意性検定を求めるため、ハーネスはそれを計算します。

**スコアリング標準（`standard/1`）のもとでは、chrF++ のペア検定がある実行が別の実行より優れているかどうかを決定します。** chrF++ は事前に宣言されたプライマリメトリクスです（[スコアリング仕様](/docs/network/specifications/scoring#how-runs-are-scored)）。BLEU、spBLEU、TER、および COMET（両方の実行が同じモデルからのセグメントごとの COMET スコアを保持している場合）はセカンダリ標準メトリクスとして検定および表示され、完全一致率とプラグイン率は診断用として扱われます。これらが決定を下すことはありません。これは、数千件の人手評価を通じてメトリクスの差とその有意性が人間の好みを予測することを発見した Kocmi et al. (2021, "To Ship or Not to Ship") に従っています。

---

## アルゴリズム: ペア近似無作為化（デフォルト）

`mt-eval compare --significance` は、Riezler & Maxwell (2005) の**ペア近似無作為化（AR: Approximate Randomization）**検定を使用します。これは SacreBLEU がシステム比較に使用するデフォルトでもあります。

### 仕組み

同じ N 件のテストエントリで評価された2つのシステム A と B が与えられた場合：

1. 観測されたコーパスレベルの差を計算します: `Δ = metric(A) - metric(B)`。
2. `n_trials` 回繰り返します（デフォルトは 1000 回）:
   a. 各エントリについて、確率 ½ で A と B の出力を入れ替えます。
   b. シャッフルされた2つのグループでコーパスマトリクスを再計算します。
   c. `|Δ_shuffled| ≥ |Δ|` であるかどうかを記録します。
3. p値は両側達成有意水準です:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`。+1 は観測された割り当てを1つの有効な抽出としてカウントするため、p が完全に 0 になることはありません。
4. p < α（デフォルトは 0.05）の場合、その差は有意であると報告されます。

Δ の信頼区間はブートストラップパーセンタイル区間です（AR は信頼区間ではなく p 値を算出します）。これは AR の抽出を妨げないよう、独立したランダムストリームで計算されます。

### 主な特性

- **真の仮説検定:** シャッフルは、あるエントリをどちらのシステムが生成したとしても違いはないという帰無仮説のもとで抽出されます。
- **ペア化:** 両システムはエントリごとに比較されるため、エントリレベルの相関が維持されます。
- **ノンパラメトリック:** スコアがどのように分布しているかについての前提を置きません。

### ペアブートストラップ（利用可能、デフォルトではありません）

`paired_bootstrap()` は Koehn (2004) のペアブートストラップを実装しています。これはエントリを復元抽出でリサンプリングし、Δ の符号が反転する頻度をカウントします。過去の論文との比較のために提供されていますが、これは符号の堅牢性のヒューリスティックであり、教科書的な有意水準ではありません。その分布は帰無仮説ではなく観測された Δ を中心とするため、AR と比較して有意性を過大評価する可能性があります。コマンドラインでは `mt-eval compare <reports…> --significance --method paired_bootstrap` で、または `run_significance_tests` 内で `method="paired_bootstrap"` を指定して選択します。

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

有意差検定の実装（デフォルトは近似無作為化、指定時はペアブートストラップ）。その公開インターフェース:

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

`compare.py` は複数の TestReport を並べて比較し、それらの間で有意差検定を実行します。`run_significance_tests()` は2つのレポートにわたる検定を駆動し、`format_significance_table()` はそれらをレンダリングします。すべての結果はそれぞれの `role` を保持します: `primary`（chrF++ — 決定を下す唯一の検定）、`secondary`（その他の標準メトリクス）、または `diagnostic`。以下の順序で検定を行います:

| メトリクス | 役割 | リサンプルごとの計算元 |
|---|---|---|
| `corpus_chrf` | プライマリ | セグメントごとの sacreBLEU 統計量 |
| `corpus_bleu` | セカンダリ | セグメントごとの sacreBLEU 統計量 |
| `corpus_spbleu` | セカンダリ | FLORES-200 SentencePiece トークナイザーによるセグメントごとの sacreBLEU 統計量（spBLEU はそのトークナイザーを使用した BLEU であり、FLORES/NLLB の表で報告される数値です）。トークナイザーが利用できない場合（`sentencepiece` がない、またはオフラインでモデルがまだダウンロードされていない）、黙って省略されることはなく、未検定として一覧表示されます |
| `corpus_ter` | セカンダリ | セグメントごとの sacreBLEU 統計量。TER は編集率であるため**低いほど優れており**、負の Δ は A に有利となります |
| `comet_score` | セカンダリ | 両方のレポートがすでに保持しているセグメントごとの COMET スコア（その平均が COMET のシステムスコアとなり、モデルが再実行されることはありません）。片方の実行のみが COMET でスコアリングされている場合や、2つの実行で異なる COMET モデルが使用されている場合は、理由とともに未検定として一覧表示されます |
| `exact_match_rate` | 診断用 | 各エントリの完全一致フラグ |
| 両方のレポートに含まれるプラグイン率（例: `giellalt_fst_validity.avg_fst_validity`、`.corpus_validity_rate`、`.morphological_accuracy`、`code_switching.avg_code_switching_rate`、`hallucination.avg_hallucination_rate`） | 診断用 | プラグイン自身のエントリごとの結果（ヘッドラインと同様の方法で集計） |

**廃止された複合スコアは検定されません。** 以前ここで検定されていた重み付け複合スコアおよび `segment_composite` 行は、スコアリング標準によって廃止されました（[スコアリング仕様 §4](/docs/network/specifications/scoring#4-composite-score)）。標準制定前に書き出された比較 JSON には、何も決定しないレガシーな複合スコアとしてラベル付けされた `segment_composite`（または `composite_score`）行が引き続き表示されます。比較対象のレポートがレガシーなものである場合、`compare` はその複合スコアが廃止された旨を表示し、比較を行いません。

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

3つ以上のレポートを比較する場合、すべてのペアに対してペアごとの有意差検定が実行されます。その場合 `significance` は `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}` オブジェクトのリストとなり、ペアごとに1つずつ、各 `tests` リストは2つのレポートを比較する場合と同じ形状になります。`letters` は実行テーブルにおける2つの実行の英字記号であり、Δ は1つ目の実行から2つ目の実行を引いた値です。

`significance` のほかに、比較 JSON には `significance_settings` が含まれます: `method`、`n_resamples`、`alpha`、`seed`、各英字がどの実行に対応するか（`runs`）、`ci_lower`/`ci_upper` の内容、`multiple_testing_correction: "none"`、ペアごとにいくつのメトリクスが検定され、それがいくつのペアに及んだか、未補正の p 値に関する平易な注記（後述）、および検定で発生したすべての注記（ペアリングから除外されたエントリ、検定されなかったメトリクス）。

### 5. CLI への統合

`mt-eval compare` は `--significance` フラグを公開しており、ペア検定を選択する `--method`（デフォルトの `approximate_randomization` または `paired_bootstrap`）と、反復回数を設定する `--n-bootstrap` を備えています:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` は `mt-eval run` が書き出した `*_report.json` ファイル（または実行ログ。その兄弟レポートを使用します）を受け取ります。メトリクスごとに1行、実行ごとに1列の実行テーブルを出力し、続いて有意差テーブルを出力し、`-o` で別のファイル名が指定されていない限り、中立な場所に比較 JSON を書き込みます: レポートが同じフォルダーにある場合はレポートの横の `comparison-<hash>.json`、そうでない場合は最も近い共通フォルダー内の `comparisons/`（`run_benchmark` の `mcp-run-<id>/` フォルダーのように各実行独自のフォルダーにあるレポートの場合、それらの中に比較が書き込まれることはありません）。`<hash>` は、指定された順序での比較対象実行 ID の sha256 の先頭 10 桁の 16 進文字であり、同じフォルダー内の別の比較がこれを上書きすることはありません。同じ実行を再度比較した場合は、自分自身のファイルが書き直されます。`-o` でファイル名を指定すると既存のファイルが上書きされ、出力にもその旨が表示されます。書き込まれたパスが出力されます。ローカル専用、封印済み、または同意が必要なコーパスに対する実行の比較では文章が引用されるため、どこに書き込まれたとしても `<file>.champollion.json` サイドカー内にそのコーパスのマークが保持されます。

実行テーブルの **Avg latency (s/entry)** には、時間が記録されなかった実行に対して `—` が表示され、テーブルの下になぜそうなったかの注記が表示されます: すべてのエントリがキャッシュから取得された、出力がハーネスの外部で作成された、またはメソッドから何も報告されなかった、などです。0.01 秒未満の値は小数第 4 位まで表示され（CPU 上の小型モデルは 1 文を数ミリ秒でデコードします）、0.00 に丸められることはありません。

### 6. 出力形式

`format_significance_table()` がコンソールビューをレンダリングします。同じデータが比較 JSON にも追加されます。

レポートには指定された順序で英字が割り当てられます: 1つ目が実行 **A**、2つ目が **B**、続いて **C**、**D** となり、上記の実行テーブルと同じ英字が使用されます。すべてのペアごとのテーブルは、それらの英字と実行 ID（例: `--- A (baseline) vs C (nllb-ft) ---`）で2つの実行を指定し、その列と Δ にも同じ英字が使用されます（`Δ (A−C)`）。Δ は常に **1つ目 − 2つ目** です。テーブルの説明とその下の各注記は、ペアがいくつあっても **1回だけ** 出力されます。各行には、符号だけでなく差異がどれほど大きいと妥当に考えられるかを示す、JSON の `ci_lower`/`ci_upper` にあるブートストラップパーセンタイル区間である 95% の **CI on Δ**（Δ の信頼区間）も出力されます。各メトリクスにはメトリクスレジストリからの方向性（↑ 高いほど良い、↓ 低いほど良い）が付与され、**Better** 列には方向性を考慮した上でより良いスコアの実行名が表示されます。差が有意でない場合は `(n.s.)` となります。したがって、TER、コードスイッチング、ハルシネーションなどの「低いほど良い」率が上昇した場合、Δ は正の値として出力され、**B** がより良い実行として表示されます。また、2番目に渡されたトレーニング済みモデルがベースラインを 63.5 chrF++ 上回った場合、Δ は −63.52 と出力され、**B** がより良い実行となります。レジストリで方向性が宣言されていないメトリクスには `?` が表示されます。スコア、Δ、信頼区間は小数第 2 位まで出力されますが、それでは実際の差異が隠れてしまう行では、それ以上（最大 6 桁）の桁数で出力されます: 0.0673 に対する 0.0684 の spBLEU は、**Yes** の横に +0.00 [+0.00, +0.00] と表示されることはなく、Δ +0.0011 [+0.0001, +0.0021] と出力され、テーブルにはそれらの行がより多くの桁数を持っていることが示されます。JSON は小数第 4 位までを保持し、それより小さい非ゼロの値については 4 桁の有効数字を保持するため、実際の差異が 0 として保存されることは決してありません。出力が同一である場合、Δ は正確に 0、p = 1 となり、決して有意にはなりません。Δ のブートストラップ区間が正確に [0, 0] である（差異のあるセグメントが少なすぎて差を推定できない）状態で p が α を下回った場合、**Sig?** には `?†` が、**Better** には `—†` が注記とともに出力され、どちらの実行もより良いとは判定されません。「低いほど良い」プラグイン率の場合、JSON の `winner` も方向性を認識し（低い率が勝ちます）、これは `corpus_ter` でも従来から同様でした。より良い方向性がない（`morph_coverage` のように中立、または未宣言の）プラグイン率では `winner: null` となります。各結果にはその `direction` も付与されます。

**コンソール出力**（説明用の数値）:
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

この例での判定は**有意差なし**です。プライマリメトリクスである chrF++ では A と B を分離できず（p = 0.142）、どちらの実行も優れているとはみなされません — たとえ BLEU、spBLEU、TER が A に有利で、コードスイッチングが B に有利であっても同様です。それらの行は表示され、読者は詳しく調べたくなるかもしれませんが、決定的な判断材料にはなりません。テーブルにはまず chrF++ が一覧表示され、その後にその他の標準メトリクス、続いて診断用メトリクスが表示されます。

実行が3つ以上ある場合、単一のヘッダーの下に `--- X (run) vs Y (run) ---` テーブルが順次続き、注記には行われたすべての検定の数がカウントされます（`6 metrics were tested per pair (36 tests over 6 pairs)`）。

**JSON 出力**（比較レポートに追加されます）:
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

### 7. ダッシュボードへの統合（オプションの拡張）

比較 JSON に有意性データが含まれている場合、ダッシュボードはそれを表示できます。有意性インジケーター（p < 0.05 の場合は `*`、p < 0.01 の場合は `**`）付きの比較テーブル行として表示されます。これは実装済みの計算の上に乗るプレゼンテーション層であり、コア機能の一部ではありません。

---

## エッジケースとバリデーション

1. **エントリの不一致**：2つの TestReport は同じエントリ ID を持つ必要があります。そうでない場合（例：一方がサブセットで実行された場合）、共通部分のみで有意性検定を行います。除外されたエントリについては警告を表示します。

2. **エントリ数が少なすぎる場合**：N < 10 の場合、エントリ数が少なすぎるため有意性検定の信頼性が低いことを警告します。それでも検定は実行しますが、警告を表示します。

3. **スコアが同一の場合**：両システムがエントリごとに同一の結果を出した場合、p_value は 1.0 になるべきです（差がまったくない）。

4. **プラグインメトリクス**: 両方のレポートに存在するプラグイン率は、レポートが実際に保持しているセグメントごとの値からのみ検定されます。つまり、エントリごとの結果に対するプラグイン独自の集計（FST メトリクス）、または `avg_<name>` 集計が平均するエントリごとの値の平均（行動メトリクス）を指します。セグメントごとの値を持たないプラグイン率は未検定としてリストされ、0.00 vs 0.00 と表示されることはありません。`total_words_checked` のようなカウントは検定されません。

5. **再現性**：RNG シードは出力にログとして記録され、結果を完全に再現できるようにする必要があります。デフォルトは 12345 です（SacreBLEU の慣例に合わせています）。

---

## 実装しないもの

- **検定中の COMET の再推論なし**: COMET は、両方のレポートがすでに保持しているセグメントごとのスコアからペア検定されます。リサンプルごとにモデルが再実行されることはありません。異なる COMET モデルでスコアリングされた2つの実行同士は検定されません。
- **ベイズ分析なし**: 頻度論的ブートストラップを一貫して使用します。これは機械翻訳コミュニティが期待し、理解している手法です。
- **多重検定補正なし**: 複数のメトリクスを検定する場合でも、ボンフェローニなどの補正は適用しません。機械翻訳評価における慣例は、メトリクスごとに未補正の p 値を報告し、解釈は読者に委ねることです。`mt-eval compare` はその出力および `comparison.json`（平易な注記付きの `significance_settings.multiple_testing_correction: "none"`）で**その旨を明記しています**: 複数のメトリクスを検定すると、偶然だけで p < 0.05 の結果が1つ現れる可能性があり、小さな Δ でも重要性を持たずに有意となることがあるため、単一の「有意」に基づいて行動する前に、Δ の信頼区間とその言語に対するメトリクスの信頼性を確認してください。

---

## ランキングクラスター {#ranking-clusters}

> **ステータス**: ✅ コンテスト向けに提供済み。コンテストのランキングは厳格な順序ではなく**クラスター**の集合です — 有意差検定によって、隣接するエントリが実際に区別可能かどうかが決定されます。このセクションでは、ペア検定よりも証拠が弱い場合を含め、提供される機能について説明します。

### 隣接チェーン、コンペティションナンバリング

エントリはまず**トラック**ごとに分割されます — `constrained` システムが `unconstrained` システムと比較されて順位付けされることは決してなく、各トラックが独自の順序、同着グループ、順位範囲を持つため、「1位」とは常に*トラック内での* 1位を意味します。

トラック内では、エントリはコンテストのプライマリメトリクス（コンテストで別のものが記録されていない限り chrF++）順に並べられ、続いて残りの表層メトリクス、最後に最も早い提出順に並べられます。その順序で**隣接する**すべてのペアが検定されます。検定で区別できないペアは同じ順位を共有し、共有された順位は**連鎖（チェーン）**します: A と B が同着で、B と C が同着の場合、A と C が直接比較されていない場合でも、3つすべてが1つの同着グループに入ります。

順位にはコンペティションナンバリングが使用されます — トップが3すくみで同着の場合は `1, 1, 1` となり、次のエントリは `4` となります。2位タイが2つの場合は `1, 2, 2, 4` です。

**連鎖（チェーニング）の率直な限界**: 非有意性は推移的ではありません。長い連鎖によって、直接検定すれば*区別できるはずの*2つのエントリが結合されてしまう可能性があります。これが、クラスターが単一点ではなく**範囲**として報告される理由です。

### 順位範囲

すべてのエントリは、WMT が順位範囲に使用するスタイルと同様に、証拠と矛盾しない最良および最悪の位置である `rank_min` と `rank_max` を保持します。クラスター内に単独で存在するエントリは `rank_min == rank_max` となります。2〜5位にまたがる4つのクラスター内のエントリは `rank_min: 2, rank_max: 5` を保持し、**そのクラスター内のどのエントリも別のエントリの「上位にある」わけではありません**。クラスターから単一の順位数値だけを取り出すのは、結果の誤読です。

### 証拠のラダー（段階）

すべてのペアを同じ方法で検定できるわけではないため、各ペアは判定が実際にどの段階（ラング）から得られたかを記録します。このラベルは結果の一部であり、省略されることはありません:

| 段階 | 証拠 | 利用可能な条件 | 強度 |
|---|---|---|---|
| 1 | **セグメントごとのペア検定** — デフォルトは近似無作為化、指定時はペアブートストラップ（上記のアルゴリズム） | 両方のエントリが完全で位置合わせされたセグメントごとのスコアセットを保持している場合のみ | 真の検定 |
| 2 | 公開された区間境界における **95% ブートストラップ信頼区間の重複** | プライマリメトリクスにおいて両方のエントリに信頼区間の境界がある場合（chrF++ にはありますが、BLEU と COMET には信頼区間の列がありません） | 保守的な代替策 — 区間の重複は同等性を**証明するものではなく**、重複しないことはペア検定よりも厳しい基準となります |
| 3 | メトリクスの表示上の丸め桁数における**点の一致** | 常に利用可能 | 最も弱い段階: 出力された2つの数値が同一であることのみを示します |

### 封印されたコンテスト: 段階 1 はノード上で実行

段階 1 には両システムからのセグメントごとのスコアが必要です。封印されたコンテストでは、主催者の評価ノードが参照訳を保持し、**セグメントごとの出力をエクスポートすることは決してありません**。これこそが封印レーンの目的そのものであり、緩和できる設定ではありません。そのため、ペア検定はデータ側へと移動して実行されます。

`mt-eval node verdicts` はノード上で、封印された参照訳とスコアリングされたすべてのエントリのペアに対してコンテスト独自のペア検定を実行し、**判定結果のみ**を書き出します: 各ペアについて、手法、p 値、スコア差、その信頼区間、およびセグメント数です。ファイルにはセグメント、参照訳、翻訳は一切含まれません。ノードはスコア署名キーでこれに署名します。その後、主催者は `mt-eval contest close --node-verdicts <file> --verify-key <node public key>` で締め切ります。ランキングは、署名が検証され、かつ判定がこのコンテスト、その封印されたセット、そのメトリクス、固定された同着ポリシー、および規定されたハーネスバージョンに対して計算されたものである場合にのみ、その判定結果を使用します。そうでない場合、締め切り処理は拒否されます。

判定結果が提供されない場合、封印されたコンテストの同着判定は、メトリクスに信頼区間がある場合は信頼区間の重複に依存し、ない場合は点の一致に依存します。その場合、クラスターはペア検定の場合よりも広くなります。ランキング自体にどちらのケースが適用されたかが示されます: `ranking_method.evidence_used` には実際に使用された段階が示され、`ranking_method.node_verdicts` には判定が使用されたノードの名前（ある場合）が示されます。

### ランキングが順位付けしないもの

- **対照的なエントリ（Contrastive entries）**は独自のセクションで報告され、勝利することはありません。
- **実行時間、ハードウェア、コスト**は実行カードに記載され報告されますが、順位付けされることはありません。効率性トラックは存在しません。
- **人手による評価**は、これらのランキングには一切含まれません。限られた予算でカバーできるシステム（クラスターが途中で分断されないよう同着グループ全体を対象とする）の人手評価の*選定結果*は締め切られたコンテストに対して記録できますが、評価スコアそのものは存在しません。[機械翻訳評価ルール](/docs/network/leaderboard/rules#verification-tiers)を参照してください。

---

## モジュールマップ

実装済み機能の所在：

| ファイル | 役割 |
|---|---|
| `pyproject.toml` | 必須依存関係として宣言された `sacrebleu>=2.3` |
| `mt_eval_harness/tester.py` | 直接の sacrebleu インポート（`HAS_SACREBLEU` ガードなし）。実行ごとの信頼区間を計算 |
| `mt_eval_harness/significance.py` | ペア検定（デフォルトの `paired_approximate_randomization` および `paired_bootstrap`）、`SignificanceResult`、組み込みメトリクス関数（chrF++、BLEU、spBLEU、TER、キャッシュされたセグメントごとのスコアからの COMET、完全一致。廃止されたセグメントレベルの複合スコアは古い比較ファイルを読み取るためだけに保持）、`run_significance_tests`、`format_significance_table` |
| `mt_eval_harness/confidence.py` | ブートストラップ信頼区間: `bootstrap_ci`、`compute_all_cis`、`compute_per_tier_cis`、`ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | `SignificanceResult`、`paired_bootstrap`、`ConfidenceInterval`、`bootstrap_ci`、`compute_all_cis` をエクスポート |
| `mt_eval_harness/compare.py` | レポート比較に組み込まれた有意差検定 |
| `mt_eval_harness/cli.py` | `--significance` / `--method` / `--n-bootstrap`（比較）および `--no-ci` / `--n-bootstrap-ci`（テスト）フラグ |
| `mt_eval_harness/dashboard.py` | 比較テーブルでの有意差の表示（オプションの拡張機能） |

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

ハーネスによって計算される決定論的なコーパスレベルのメトリクス:
- `corpus_chrf`（chrF++ スコア）
- `corpus_bleu`（BLEU スコア）
- `exact_match_rate`（0.0〜1.0）
- `fst_acceptance_rate`（FST データが存在する場合）


chrF++ の区間は、公開されるヘッドライン（`chrF++ 47.5 [45.9, 49.0]`）の一部です。信頼区間は、キャッシュされたエントリごとのスコアからブートストラップされ、`comet_score` に対しても**同様に**計算されます（重複するニューラル推論はありません）。新しい実行に対して複合スコアの信頼区間が計算されることはありません。レガシーカードに保存されている複合スコアの信頼区間は、そのカードが検証されるときにのみ再導出されます。

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

### COMET（計算された場合の標準メトリクス、chrF++ の横に表示）

COMET は、計算された場合にモデル ID とともに **chrF++ ヘッドラインの横に表示されるニューラルメトリクス**です。chrF++ とブレンドされることは決してなく、また大型モデルを必要とし、ほとんどの低リソース言語に対してキャリブレーションされていないため、ヘッドラインにはなりません（[スコアリング仕様 §2.3](/docs/network/specifications/scoring#2-metric-inventory) を参照）。ブートストラップ信頼区間は、キャッシュされたエントリごとのスコアに対して計算されます:
- モデル: `Unbabel/wmt22-comet-da`（WMT 2022 参照ベースモデル）。サポートされているアフリカの言語には AfriCOMET が自動選択されます
- `unbabel-comet` がインストールされている場合に計算
- エントリごとのスコアは TestReport のエントリに保存されます。コーパス値には低リソース言語のキャリブレーションに関する注意書きが付与されます
- 検証ツールによって再導出されます — 報告された COMET 値は再現可能でなければなりません
- オプションの依存関係: `python3 -m pip install 'mt-eval-harness[comet]'`（または `mt-eval setup --comet`）

### Supabase カラム

`run_cards` テーブルは、対応する null 許容列を保持します（[scoring.md §9.1](/docs/network/specifications/scoring) を参照）:
- `chrf_plus_plus`、`chrf_ci_lower`、`chrf_ci_upper`（`real`）— ヘッドラインとその 95% 区間
- `comet_score`（`real`）— ヘッドラインの横に表示（ブレンドされません）
- `corpus_bleu`（`real`）

完全な信頼区間セットは、実行カードの `scores` JSON 内の `confidence_intervals` に格納されます（scoring.md §9 の実行カードスキーマによる）。chrF++ の境界のみが列としても非正規化されて保持されます。
