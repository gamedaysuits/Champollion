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
pip install mt-eval-harness
```

---

## ステップ1: ハーネスを実行する

ハーネスは、標準化されたデータセットに対してメソッドをスコアリングします。

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| フラグ | 説明 |
|---|---|
| `--corpus` | コーパスファイルのパスまたは登録済みコーパスID（`.json`、`.jsonl`、`.tsv`） |
| `--model` | モデルスラッグ — 短いエイリアス（例: `gemini-pro`）またはフルOpenRouter ID |
| `-n, --name` | 実行の表示名（リーダーボードに表示されます） |
| `--temperature` | サンプリング温度（低いほど決定論的） |
| `--fst-retries` | オプション: FSTリトライ回数 |
| `--publish` | 実行完了時にランカードをリーダーボードへ公開する |

ハーネスは**ランカード**を生成します。これは、スコア、データセットハッシュ、モデルスラッグ、および実験設定と結果を紐付ける暗号化フィンガープリントを含む自己完結型のJSONファイルです。

---

## ステップ2: ランカードを確認する

実行カードは `eval/logs/harness/` に保存されます。提出前に内容を確認してください：

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

確認すべき主なフィールド:
- `scores.chrf_plus_plus` — 主要な品質指標
- `scores.exact_match_rate` — 完全一致翻訳の割合
- `scores.fst_acceptance_rate` — 形態論的妥当性（FSTを使用した場合）
- `totals.total_cost_usd` — 実行にかかったコスト
- `fingerprint` — 実験の再現性ハッシュ

完全なスキーマについては、[ランカード仕様](/docs/network/specifications/run-card)を参照してください。

---

## ステップ3: 提出する

### 自動公開

ハーネス実行時に`--publish`を指定した場合、ランカードはすでにアップロードされています。

### 手動公開

ハーネスを使って任意のランカードを公開します。

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

公開フローを使用しない場合は、ランカードのJSONを`results/`ディレクトリに追加した上で、
[evalハーネスリポジトリ](https://github.com/gamedaysuits/Champollion)
へプルリクエストを送ってください。

:::note[提出用 API とウェブアップロードはまだ公開されていません]
`POST https://champollion.dev/api/leaderboard/submit` エンドポイントおよびリーダーボードへのアップロード UI は計画中ですが、**まだ実装されていません**。これらが公開されるまでは、`mt-eval publish` とハーネスリポジトリへのプルリクエストのみが有効な提出方法です。
:::

---

## 次のステップ

1. 提出内容が検証されます（データセットのハッシュ、ランカードの整合性）
2. 結果は **Self-benchmarked**（トラストティア1）としてリーダーボードに表示されます
3. **Champollion Verified** ステータスを取得するには、メンテナーが結果を再現できるように、メソッドをインストール可能なプラグインとして提出してください
4. 先住民言語のメソッドの場合: メソッドがトップに到達すると、[所有権の移譲](/docs/network/sovereignty/ownership-transfer)プロセスが開始されます

---

## 関連項目

- [ハーネスの使い方](/docs/network/specifications/harness) — 完全なCLIリファレンス
- [リーダーボードルール](/docs/network/leaderboard/rules) — 提出基準および不正防止ポリシー
- [メソッドの構築](/docs/network/specifications/methods) — TranslationMethodプロトコル
- [データセット](/docs/network/leaderboard/datasets) — 利用可能な評価データセット
