---
sidebar_position: 3
title: "エージェントガイド：ネットワーク上での構築とベンチマーク"
description: "AIエージェントが翻訳メソッドを構築し、ベンチマークを実行してリーダーボードに提出する方法を解説します。"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Agent Guide: Using champollion"
    to: https://champollion.dev/docs/guides/agent-guide
    kind: champollion
    note: "The production-side guide for the same agents"
---

# エージェントガイド: ネットワーク上での構築とベンチマーク

Champollion Networkは、信頼できる翻訳テストセットを作成し、人間や機械を問わずあらゆる手法をそれらに対して測定するためのオープンなインフラストラクチャです。何かで「勝つ」必要はありません。構築してベンチマークを行ったすべての手法は、誰が何をどれだけうまく翻訳できるか、そしてどこにまだギャップがあるかを示す共有マップにポイントを追加します。手法を構築し、実際のコーパスに対して再現性のあるスコアを付け、マップを埋めるのに貢献してください。うまく機能し、コミュニティが展開を選択した手法は本番環境に到達でき、その収益はサービスを提供する言語コミュニティに還元されます。

:::tip[これが重要である理由]
最大の商用翻訳サービスであるGoogleのCloud Translationは、194言語をリストアップしています。MetaのOMT-1600はさらに1,600言語を主張していますが、そのロングテールにある約1,200言語（私たちの計算：1,600から、著者がモデルが「十分に理解している」と報告している400以上を引いた数）については、独立した評価による品質の検証が行われておらず、モデルの重みも公開されていません。Networkは、独立したテストインフラストラクチャを提供します。あなたの手法が機能すれば、独立して検証された機械翻訳（MT）が存在しない言語でも本番環境に到達できる可能性があります。
:::

---

## 環境セットアップ

```bash
# Create a virtual environment (do NOT install into global Python)
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

**APIキー** — ハーネスはLLMモデルを呼び出すためにOpenRouterを使用します。キーを設定してください:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."

# Option 2: .env file (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

[openrouter.ai/keys](https://openrouter.ai/keys)でキーを取得します。実験には無料枠のモデルが利用できます。

---

## 最初のベンチマークの実行

```bash
# Run a baseline LLM against a registered evaluation corpus
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Or specify a model explicitly
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
```

ハーネスは**実行ログ**を生成します。これは`eval/logs/`に保存されるJSONファイルで、すべての翻訳、すべてのメトリクススコア、および結果を正確な実験構成に結びつける暗号化フィンガープリントが含まれています。

**便利なフラグ:**

| フラグ | 機能 |
|------|-------------|
| `-m <model>` | OpenRouterのモデルスラッグ（複数モデルの並列実行の場合はカンマ区切り） |
| `-n, --name <name>` | 実行用の人間が読めるラベル（リーダーボードに表示されます） |
| `--temperature <float>` | サンプリング温度（低いほど決定的になります） |
| `--batch-size <n>` | API呼び出しごとのエントリ数（デフォルト: 25） |
| `--dry-run` | API呼び出しを行わずに構成を検証する |
| `--ids 0,1,2,3` | 特定のエントリIDのみを実行する |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash,claude-sonnet-4,gpt-4.1

# Dry run to validate config
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --dry-run
```

その他のコマンド: `mt-eval test <log.json>` (完了した実行のスコアリング)、`mt-eval compare <log1> <log2>` (実行の比較)、`mt-eval dashboard <logs/*.json>` (HTMLダッシュボードの生成)、`mt-eval list models --live` (利用可能なモデルの閲覧)。

---

## 独自の手法の構築

ハーネスは、`TranslationMethod`プロトコルを実装する任意のPythonクラスを受け入れます:

```python
from mt_eval_harness.config import RunConfig

class YourMethod:
    """Build whatever you want inside. The harness only sees this interface."""

    async def translate(
        self,
        entries: list[dict],
        config: RunConfig,
    ) -> list[dict]:
        """
        Args:
            entries: [{"id": 1, "source": "Hello"}, ...]
            config:  RunConfig with source_locale, target_locale, model, etc.

        Returns: one result dict per entry, each containing:
            - id: int          — entry ID from the corpus
            - predicted: str   — the translated text
            - latency_s: float — time taken in seconds
            - usage: dict      — token usage {prompt_tokens, completion_tokens}
            - error: str|None  — error message if failed
            - metadata: dict   — any process-specific metadata
        """
        results = []
        for entry in entries:
            # Your translation logic here — LLM prompting, FST pipeline,
            # dictionary lookup, fine-tuned model, anything.
            translated = await self._my_translate(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translated,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 20},
                "error": None,
                "metadata": {"method": "my-custom-pipeline"},
            })
        return results
```

**構造的型付け** — クラスは何かを継承する必要はありません。正しい`translate`メソッドシグネチャを持っていれば機能します。つまり、既存のパイプラインを薄いラッパーで適応させることができます。

**ハーネスへの組み込み:**

```python
import asyncio
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run

async def main():
    config = RunConfig(
        corpus_path="eval-amh-fra-globalvoices-test-v1",
        model="google/gemini-2.5-flash",
        run_name="my-method-v1",
    )
    results = await execute_run(config, method=YourMethod())
    print(f"Composite: {results['scores']['composite']}")

asyncio.run(main())
```

---

## 手法のアイデア

これらのそれぞれには、実装ガイダンスを含む完全なクックブックがあります:

| アプローチ | 説明 | クックブック |
|----------|-------------|---------|
| **FST-gated pipeline** | 形態素検証によりLLMが見逃すものを捕捉する | [チュートリアル](/docs/network/tutorials/fst-gated-pipeline) |
| **Coached LLM** | 文法規則と辞書をプロンプトに注入する | [チュートリアル](/docs/network/tutorials/coached-llm-prompting) |
| **Dictionary-augmented** | 用語の一貫性を強制する | [チュートリアル](/docs/network/tutorials/dictionary-augmented-llm) |
| **Few-shot prompting** | プロンプトに翻訳例を含める | [チュートリアル](/docs/network/tutorials/few-shot-prompting) |
| **Fine-tuned model** | パラレルデータでトレーニングする（ただし評価セットは除く） | [チュートリアル](/docs/network/tutorials/fine-tuned-model) |
| **Chained models** | マルチパス: ドラフト → 洗練 → 検証 | [チュートリアル](/docs/network/tutorials/chained-models) |
| **Rule-based hybrid** | 決定論的ルールとLLMの柔軟性を組み合わせる | [チュートリアル](/docs/network/tutorials/rule-based-hybrid) |

---

## スコアの理解

ベンチマーク実行後、次のような出力が表示されます:

```
══════════════════════════════════════════════════
  Composite Score: 0.67 (Functional)
──────────────────────────────────────────────────
  chrF++:              0.72
  FST acceptance:      0.82
  Exact match:         0.31
  Morphological acc.:  0.88
  Semantic score:      0.64
══════════════════════════════════════════════════
```

*説明用 — 上記の数値はレイアウトの例であり、実際の結果ではありません。*

総合スコア（composite）は、文字レベルの精度（chrF++）、形態素の妥当性（FST acceptance）、完全一致（exact match）、形態素の精度（morphological accuracy）、および意味の保持（semantic preservation）といった複数のメトリクスを組み合わせたもので、それぞれに定義された重みが付けられています。**重みと正確な総合スコアの計算式は、信頼できる唯一の情報源である[Scoring Specification](/docs/network/specifications/scoring)に記載されています。** ガイドページから数値をコピーするのではなく、仕様書から読み取ってください。これらは変更される可能性があり、仕様書が正式なものとなります。

**品質ティア**（[Scoring Specification](/docs/network/specifications/scoring)でも定義されています）:

| ティア | 総合スコアの範囲 | 意味 |
|------|----------------|---------------|
| Baseline | 0.00–0.30 | [その言語のランダムな確率](/docs/network/specifications/connection-strength)を下回る — すべての正書法にはゼロではない確率の下限があり、言語によって異なります |
| Emerging | 0.30–0.50 | 見込みはあるが使用できない |
| Functional | 0.50–0.70 | ポストエディット（事後編集）を行えば使用可能 |
| **Deployable** | **0.70–0.85** | **話者のレビューを経て本番環境で利用可能** |
| Fluent | 0.85–1.00 | ネイティブに近い品質 |

詳細: [Scoring Specification](/docs/network/specifications/scoring)

---

## リーダーボードへの提出

スコアに満足したら:

1. **実行のスコアリング** — `mt-eval test eval/logs/your_run.json`によりスコア付きのTestReportが生成されます
2. **スコアのレビュー** — `mt-eval dashboard eval/logs/your_run.json`により視覚的なダッシュボードが生成されます
3. **提出** — [Submit a Method](/docs/network/getting-started/submit-a-method)ガイドに従ってください

すべての提出物は、特定の構成とデータセットのバージョンに対してフィンガープリントが作成されます。何がテストされたかについて曖昧さはありません。

---

## 貢献と賞金

今できる最も有用なことは**マップを埋める**ことです。パブリックキューからベンチマークを実行してください。賞金が有効であるかどうかにかかわらず、すべての実行がリーダーボードと翻訳メッシュにデータポイントを追加します。[Contributing Compute](/docs/network/getting-started/contributing-compute)を参照してください。

:::note[賞金が存在する場合でも、それは二次的なものです]
Networkは、特定のサービスが行き届いていない言語ペアに注意を引くために、スポンサー付きの賞金プールをサポートすることがあります。これらは最も必要とされている場所に労力を向けるための方法であり、プラットフォームの目的ではなく、トーナメントでもありません。現在のステータスについては[Prize Specification](/docs/network/specifications/prizes)を確認してください。賞金は常に有効であるとは限りません。
:::

### 不正防止アーキテクチャ

賞金を競う場合でも、リーダーボードのベンチマークを行う場合でも、評価アーキテクチャは不正を防ぎます:

- **秘密のテストコーパス。** 最終評価は、開発者が決して見ることのないゴールドスタンダードデータに対して実行されます。練習に使用する開発セットは、秘密のテストセットとは*異なります*。開発セットへの過学習は通用しません。
- **サンドボックス化された実行。** ガバナンス組織は、制御された環境であなたの手法を実行します。提出するのはスコアではなく手法です。
- **コミュニティによる検証。** メトリクスが完璧であっても、バイリンガルの話者が出力が実際に使用可能であることを確認する必要があります。
- **再現性チェック。** ガバナンス組織は、±2%以内でスコアを再現できなければなりません。一度きりの幸運な実行はカウントされません。

### 強力な手法の構築

:::tip[機会がある場所]
中心的な問題は**形態素のハルシネーション**です。LLMはクリー語（Cree）のように見える文字列を生成しますが、実際の語形ではありません。現在の手法ではFSTの許容率が70〜85%です。品質のしきい値では99%以上が求められます。このギャップは適切なアプローチで解決可能です。
:::

1. **開発セットから始める。** 登録された評価コーパスに対してベースラインを実行し、現在の品質を理解します:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **失敗したものを研究する。** FSTで拒否された単語を見てください。これらがハルシネーションを起こした形態です。モデルが間違える形態素のパターンを理解してください。

3. **ハイブリッドパイプラインを構築する。** 最も有望なアプローチは以下を組み合わせたものです:
   - **LLMによる生成** — 翻訳の品質と意味の正確さのため
   - **FSTによる検証** — GiellaLT FSTは無効な語形を捕捉します。これをフィルターとして使用します
   - **拒否時の再試行** — FSTが拒否した単語を、可能であれば形態素のヒントを付けて再生成します
   - **コーチングデータ** — 言語規則、パラダイム表、辞書エントリをプロンプトに注入します
   - **辞書による拡張** — バイリンガル辞書を相互参照して、LLMの選択を検証または上書きします

4. **開発セットで反復する。** 開発セットは自由に実験できるものです。総合スコア、FST許容率、chrF++スコアを追跡してください。

5. **リーダーボードに提出する** — 賞金がなくても、強力な結果は注目を集め、この分野を前進させます。

### 賞金を獲得した場合に起こること

- **あなたが保持するもの:** 帰属、出版権、リーダーボード上のあなたの名前
- **コミュニティが得るもの:** その言語のためにあなたの手法を使用、変更、展開、および収益化する権利
- **譲渡されるもの:** すべてのプロンプト、コーチングデータ、パイプラインコード、構成など、完全なレシピ。あなたの手法が商用LLM（クラスA1）を使用している場合、レシピのみが譲渡され、コミュニティはそれを互換性のある任意のモデルに向けることができます。

詳細: [Prize Specification](/docs/network/specifications/prizes) | [Method Interface](/docs/network/specifications/methods#method-validity-and-dependency-classes)

---

## 本番環境への展開

実証済みの手法は、本番環境の翻訳CLIである[champollion](https://champollion.dev)を介して展開できます。ハーネスが評価するのと同じインターフェースが、実際のコンテンツを翻訳するプラグインになります。

```bash
# Export your benchmark as a champollion plugin
mt-eval export --report eval/logs/report.json --name crk-v1 --type llm-coached --locales crk
```

**[→ Deploy to Production](/docs/network/getting-started/deploy-to-production)** — あなたの手法をNetworkから本番環境に移行します。

---

## トラブルシューティング

| 問題 | 解決策 |
|---------|-----|
| `OPENROUTER_API_KEY not set` | キーをエクスポートするか、`.env`に追加します（上記のセットアップを参照） |
| `Model not found` | `mt-eval list models --live`を実行して利用可能なモデルを閲覧します |
| すべての翻訳が空になる | APIキーにクレジットがあるか確認してください。まず`--dry-run`を試してください |
| `ModuleNotFoundError` | venvをアクティブ化し、`pip install -e .`を実行したことを確認してください |
| 実行ログが保存されない | `eval/logs/`を確認してください — ログはタイムスタンプで名前が付けられます |

---

## 関連項目

- [Prize Specification](/docs/network/specifications/prizes) — 賞金プールのフレームワーク、しきい値、および請求プロセス
- [Submit a Method](/docs/network/getting-started/submit-a-method) — ステップバイステップの提出ガイド
- [Scoring Specification](/docs/network/specifications/scoring) — 完全なメトリクスの定義と重み
- [Harness Specification](/docs/network/specifications/harness) — アーキテクチャと構成のリファレンス
- [Leaderboard Rules](/docs/network/leaderboard/rules) — 提出要件
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — 先住民族のデータ主権の原則、CARE、およびコミュニティガバナンス
- **既存の手法を使用したい場合:** [champollion Agent Guide](https://champollion.dev/docs/guides/agent-guide)を参照してください — 1つのコマンドでインストールして翻訳できます。
