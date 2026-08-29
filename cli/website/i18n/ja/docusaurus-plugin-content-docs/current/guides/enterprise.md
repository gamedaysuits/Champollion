---
sidebar_position: 7
title: "エンタープライズ向け"
description: "リーダーボードで実証済みの手法、カスタムプラグイン、ワンコマンドデプロイを活用して、組織全体で翻訳を標準化する方法を紹介します。"
---

# エンタープライズ向け champollion

チームが定期的にコンテンツを翻訳しているとします。ロケールファイルのスタック、CIパイプライン、そしておそらく誰かが手動でGoogle翻訳を実行し、結果をJSONにコピーして、うまくいくことを祈るというプロセスがあるでしょう。あるいは、特定のベンダーの翻訳エンジンに縛られたTMSプラットフォームに費用を払っているかもしれません。

champollionはより落ち着いた選択肢を提供します。言語ごとに適切な方法（機械翻訳または人間による翻訳）を選択し、すべてを1つのコマンドで実行できます。

## チームが champollion を使う理由

1. **言語ごとに適切な方法を選択** — ベンダーのデフォルトではなく、機械翻訳か人間による翻訳かを自分で決める
2. **1つのコマンドでデプロイ** — `npx champollion sync` がすべてのロケール、すべてのフォーマットを毎回翻訳する
3. **コードを変更せずに方法を切り替え** — マイグレーションではなく、設定変更だけで対応
4. **パイプラインを自分で管理** — ベンダーロックインなし、月次ダッシュボードなし、アカウント不要

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

フランス語はDeepL（チームがヨーロッパ的な流暢さを好むため）。日本語はフロンティアLLM。ドイツ語はGoogle翻訳（速く、安く、十分な品質）。韓国語はフォーマルなレジスターを持つLLM。スペイン語は`api`メソッドを通じてプロの人間翻訳・MTPE（機械翻訳後編集）サービスへルーティング — 人間による翻訳はここでは後付けではなく、ファーストクラスのメソッドです。Plains Creeはコミュニティが構築・所有するコーチングプラグインを使用。

**同じコマンド。同じCIパイプライン。言語ペアごとに異なるメソッド（人間または機械）。1つの設定ファイル。**

:::note[コミュニティ言語のメソッドは主権を持つ]
上記のプレインズ・クリー語プラグインは、単なる「もう一つのメソッド」ではありません。先住民族やその他のコミュニティ言語のメソッドは**コミュニティが所有・管理するもの**です。コミュニティがそのデータの鍵を握り、利用条件を定めており、非商用（NC）のコーパスやメソッドはデフォルトで商用利用の対象外となっています。商用利用を検討している場合は、リリース前にメソッドのライセンスをご確認ください。詳しくは[データ主権](/docs/network/sovereignty/data-sovereignty)をご覧ください。
:::

## リーダーボード → デプロイのワークフロー

:::tip[`champollion leaderboard` はCLIに同梱されています]
以下のワークフローは `champollion leaderboard` コマンドで実行されます。ターミナルから [Network](/arena) のリーダーボードを閲覧し、そこから直接メソッドプラグインをインストールできます。すべてのオプションについては、[CLIリファレンス](/docs/reference/cli#leaderboard)を参照してください。
:::

[Network](/arena)は、再現可能なフィンガープリント付きスコアリングで翻訳メソッドをベンチマークする場所です。すべてのメソッドは複数の指標（chrF++、完全一致、FST受理、セマンティックスコアリング）にわたる複合スコアを取得します。リーダーボードはすべての提出を追跡します。

ワークフロー:

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*あくまで例示です — 上記のリーダーボードの行はレイアウトの例です。ボードは現在提出を受け付けており、まだ公開済みの実行結果はありません。*

**メソッドを自分で構築する必要はありません。モデルをトレーニングする必要もありません。ドメイン、予算、ライセンスに合ったメソッド（人間または機械）を選んでデプロイするだけです。** 来月より適したメソッドが登場したら、1つのコマンドで切り替えられます。

## 現在利用可能なもの

リーダーボードからCLIへのブリッジは開発中です。現時点で動作するものは以下のとおりです。

### 組み込みメソッド（プラグイン不要）

| メソッド | 最適な用途 | コスト |
|--------|----------|------|
| `llm`（デフォルト） | 品質重視、あらゆる言語 | OpenRouter経由のトークン課金 |
| `gemini` | 品質 + 無料枠 | 無料（制限あり）、その後トークン課金 |
| `google-translate` | スピード + 大量処理 | $20/100万文字 |
| `deepl` | ヨーロッパ言語 | $25/100万文字 |
| `llm-coached` | コーチングデータがある言語 | OpenRouter経由のトークン課金 |
| `api` | カスタム・コミュニティホスト型メソッド | セルフホスト |

### プラグインメソッド（別途インストールが必要）

カスタムプラグインは、ファインチューニング済みモデル、FST制御パイプライン、コミュニティAPI、またはJSONを生成するその他のあらゆる翻訳ロジックをラップできます。[プラグインの構築](/docs/tutorials/build-a-plugin)を参照してください。

## エンタープライズワークフロー

### 1. 現在の品質を評価する

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. 候補に対してevalハーネスを実行する

[evalハーネス](/docs/network/specifications/harness)を使用すると、同じデータセットに対して複数のメソッドをベンチマークできます。スイープを実行し、スコアを比較して、勝者を選びます。

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. 言語ペアごとの勝者を設定する

最適なメソッドを言語ペアごとに使用するよう設定を更新します。言語によって最適なメソッドは異なります — それがこのツールの要点です。

### 4. CI/CDに統合する

```bash
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

3つのコマンド。手動翻訳ゼロ。パイプラインはハードコードされた文字列を検出し、選択したメソッドで翻訳し、何かが欠落または破損している場合はビルドを失敗させます。

### 5. プロによるレビュー（任意）

重要度の高いコンテンツについては、人間によるレビューのためにXLIFFにエクスポートします。

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

大量のコンテンツは機械翻訳で処理します。重要なパスは人間がレビューします。人間の作業時間は、本当に必要な箇所にのみ費用をかけます。

## コストモデル

champollionには**サブスクリプションやシート単位の料金はありません**。CLIはPolyForm Noncommercial 1.0.0ライセンスの下でソースコードが公開されており、非営利目的（研究、教育、コミュニティ活動）での利用は無料です。商用利用には許可が必要なため、事前に[お問い合わせ](/get-involved)ください。それ以外に発生する費用は、翻訳APIの呼び出し料金のみです。

| 量 | Google翻訳 | LLM（Gemini Flash） | LLM（GPT-4o） |
|--------|-----------------|---------------------|---------------|
| 1,000キー × 5ロケール | 約$0.50 | 約$0.30（無料枠） | 約$2.00 |
| 10,000キー × 15ロケール | 約$15 | 約$8 | 約$60 |
| 50,000キー × 30ロケール | 約$75 | 約$40 | 約$300 |

Translation Memoryにより、その後の同期では**変更されたキーのみ**の費用が発生します。10,000件中10件の文字列を更新した場合、10,000件ではなく10件分の翻訳費用のみがかかります。

## TMSプラットフォームとの比較

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **料金** | 非営利目的は無料（商用は要許可）+ API費用 | 月額$50〜$500 + シート単位 |
| **ベンダーロックイン** | なし（設定でプロバイダーを変更可能） | 高い（データはクラウド上） |
| **メソッドの選択** | 任意のプロバイダー、任意のモデル、ペアごと | 提供されているもののみ |
| **CI/CD** | ファーストクラス (`lint → sync → audit`) | プラグイン/Webhook |
| **カスタムメソッド** | プラグインシステム、コミュニティプラグイン | 未対応 |
| **品質ゲート** | 組み込み（文字種エラー、エコー、長さ） | サービスによる |
| **セルフホスト** | 可能（LibreTranslate、カスタムAPI） | 不可 |

詳細は[完全な比較](/docs/guides/comparison)を参照してください。

## 関連ドキュメント

- **[クイックスタート](/docs/getting-started/quick-start)** — 60秒で最初の同期を実行する
- **[翻訳メソッド](/docs/guides/translation-methods)** — デシジョンツリー付きの全メソッド一覧
- **[CI/CD統合](/docs/guides/ci-cd)** — パイプラインで自動化する
- **[プロの翻訳者との連携](/docs/guides/professional-translators)** — XLIFFのエクスポート・インポート
- **[the Network](/arena)** — ベンチマークとリーダーボード
- **[設定リファレンス](/docs/getting-started/configuration)** — すべての設定オプション
