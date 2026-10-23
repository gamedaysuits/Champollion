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
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: cookbook
  - label: "Measurement rules"
    to: /docs/agents/measurement
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
  --name your-method-name
```

| フラグ | 説明 |
|---|---|
| `--corpus` | コーパスファイルのパス、または登録済みコーパスID（`.json`、`.jsonl`、`.tsv`） |
| `--model` | 正確なモデルスラッグ — 完全なOpenRouter ID（例: `google/gemini-3.1-pro-preview`）。短いエイリアスや変動するID（`…-latest`）は拒絶されます。`--method <plugin dir>` を指定した場合は、`config.method_model` としてプラグインに渡されるモデル（プラグインが使用する任意の命名） |
| `-n, --name` | 実行内容のわかりやすいラベル（リーダーボードに表示されます） |
| `--temperature` | サンプリング温度（デフォルトは `0.0`: 決定論的、`shared/model-defaults.json` のデフォルト） |
| `--publish` | 実行完了時に実行カードをリーダーボードへ公開 |

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

1. 提出内容が検証されます（データセットのハッシュ、実行カードの整合性）
2. 結果は **Self-benchmarked**（信頼ティア1）としてリーダーボードに表示されます
3. **Champollion Verified** ステータスは、SHA固定されたコーパスに対して提出された出力を再スコアリングすることで付与されます。再スコアラーはメンテナーが手動で実行するコマンドです。提出時に自動実行されることもスケジュールされることもないため、現在はすべての行が自己ベンチマーク（self-benchmarked）のままとなります（[検証ティア](/docs/network/leaderboard/rules#verification-tiers)）
4. 公開リーダーボードへの掲載によって権利が移転することはありません。手法の権利が移転するのは、参加前に公開された、封印型コンテストの規定された賞金規約に基づく場合のみです（[所有権と利用規約](/docs/network/sovereignty/ownership-transfer)）

---

## 関連項目

- [ハーネスの使い方](/docs/network/specifications/harness) — 完全なCLIリファレンス
- [リーダーボードルール](/docs/network/leaderboard/rules) — 提出基準および不正防止ポリシー
- [メソッドの構築](/docs/network/specifications/methods) — TranslationMethodプロトコル
- [データセット](/docs/network/leaderboard/datasets) — 利用可能な評価データセット
