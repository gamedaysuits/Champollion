---
sidebar_position: 1
title: "メソッドを送信する"
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

# メソッドを提出する

> **概要。** リーダーボードへの最初のベンチマーク実行を提出するためのステップバイステップのクイックスタートです。ハーネスをインストールし、データセットに対して実行し、ランカードを確認して公開します。APIキーがあれば10分で完了します。

このガイドでは、Networkリーダーボードへの最初のベンチマーク実行を提出する手順を説明します。

---

## 前提条件

- **Python 3.11 以上**
- **OpenRouter の API キー**（またはご利用のモデルプロバイダーに対応するもの）
- **翻訳メソッド** — ソーステキストから翻訳を生成できるものであれば何でも構いません

```bash
# Install the eval harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

---

## ステップ1: ハーネスを実行する

ハーネスは、標準化されたデータセットに対してメソッドをスコアリングします。

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| フラグ | 説明 |
|---|---|
| `--corpus` | コーパスファイルのパス、または登録済みコーパスID（`.json`、`.jsonl`、`.tsv`） |
| `--model` | 正確なモデルスラッグ — 完全なOpenRouter ID（例：`google/gemini-3.1-pro-preview`）。短いエイリアスや変動するID（`…-latest`）は拒否されます。`--method <plugin dir>` を指定した場合は、`config.method_model` としてプラグインに渡されるモデル名（プラグインで使用される任意の命名）になります |
| `-n, --name` | 実行結果の人間が読めるラベル（リーダーボードに表示） |
| `--temperature` | サンプリング温度（低いほど決定論的になります） |
| `--fst-retries` | 任意：FSTの再試行回数 |
| `--publish` | 実行終了時に実行カード（Run Card）をリーダーボードに公開する |

ハーネスは**ランカード**を生成します。これは、スコア、データセットハッシュ、モデルスラッグ、および実験設定と結果を紐付ける暗号化フィンガープリントを含む自己完結型のJSONファイルです。

---

## ステップ2: ランカードを確認する

各実行により、`eval/logs/harness/` に2つのファイルが書き込まれます。実行ログ `<run-id>.json`
とスコアレポート `<run-id>_report.json` です。公開するのはこのレポートです。
まずレポートを確認してください：

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

レポートの `overall` ブロックに含まれる主要フィールド：
- `corpus_chrf` — コーパスレベルの chrF++（0〜100）。メインとなるランキング指標です。95%ブートストラップ信頼区間は `confidence_intervals.corpus_chrf`、sacreBLEUシグネチャは `sacrebleu_signatures.chrf` です
- `scoring_standard`（`"standard/1"`）および `primary_metric`（`"chrf_plus_plus"`） — レポートのスコア算出基準となった標準仕様
- `corpus_bleu`、`corpus_spbleu`、`corpus_ter` — その他の標準指標。chrF++と並べて表示され、合算されることはありません
- `exact_match_rate` — 診断指標：完全一致した翻訳の割合
- `confidence_intervals` — 上記指標のブートストラップ信頼区間
- `total_cost_usd` — 実行にかかった費用（ローカルモデルなど、公開価格がないモデルの場合は `null`。$0と報告されることはありません）

レポートには、モデルに何が指示されたかもポインタとして記録されます
（`instructions`：コーチングファイルの名前とSHA-256、システムプロンプトの
SHA-256、そして全文が存在するローカルマシン上の実行ログの場所）。リーダーボードに
送られる実行カードは、このレポートから組み立てられます。メソッドカードと
再現性フィンガープリントが追加され、同じchrF++およびCIが先頭に表示されます。
[廃止された](/docs/network/specifications/scoring#how-runs-are-scored)ため、
その `composite` と `quality_tier` は `null` になります。（標準化以前に
作成されたレポートには `published_composite` が含まれている場合がありますが、これは廃止された
レガシーな複合指標であり、chrF++と比較されることはありません。）
`mt-eval publish <report> --dry-run` は、公開されるカードの内容をそのまま出力します。
スキーマについては[実行カード仕様](/docs/network/specifications/run-card)を参照してください。

---

## ステップ3: 提出する

公開操作は**本番の**リーダーボードに書き込むため、明示的な `--prod` が必要です。
これが指定されない場合、テストハーネスは拒否し、その旨を通知します。まずはプレビューしてください：

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

実行から直接公開するには、`mt-eval run` に `--publish --prod` を追加します。
公開ステップが失敗した場合でも、実行のスコアは保存され、ハーネスが正確な再試行コマンドを表示します。
環境変数に `MT_EVAL_ALLOW_PROD=1` を設定することは、スクリプトにおける `--prod` と同等です。

:::note[送信APIとWebアップロードはまだ利用できません]
`POST https://champollion.dev/api/leaderboard/submit` エンドポイントおよびリーダーボードのアップロードUIは
計画中ですが、**まだ実装されていません**。これらがリリースされるまで、
利用可能な提出経路は `mt-eval publish` のみです（Pull Requestによる受付はありません）。
:::

---

## この後の流れ

1. 提出内容が検証されます（データセットのハッシュ値、実行カードの整合性）
2. 結果が **Self-benchmarked**（信頼ティア1）としてリーダーボードに表示されます
3. **Champollion Verified** ステータスを取得するには、メンテナが結果を再現できるよう、手法をインストール可能なプラグインとして提出してください
4. 先住民族の言語の手法の場合：トップに達した手法については、[所有権移転](/docs/network/sovereignty/ownership-transfer)のプロセスが開始されます

---

## 関連項目

- [ハーネスの使い方](/docs/network/specifications/harness) — 完全なCLIリファレンス
- [リーダーボードルール](/docs/network/leaderboard/rules) — 提出基準および不正防止ポリシー
- [メソッドの構築](/docs/network/specifications/methods) — TranslationMethodプロトコル
- [データセット](/docs/network/leaderboard/datasets) — 利用可能な評価データセット
