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
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

フランス語にはDeepL（ヨーロッパ言語における自然さをチームが重視）。日本語にはフロンティアLLM。ドイツ語にはGoogle翻訳（高速、安価、十分な品質）。韓国語には敬体に対応したLLM。スペイン語は`api`メソッドを介してプロの人手翻訳／MTPEサービスにルーティングします。ここでは人手翻訳も後付けではなく、第一級のメソッドとして扱われます。プレーンズ・クリー語には、提供された文法ノートと辞書を備えたコーチ付きLLM（coached LLM）メソッドを割り当てます。

**同じコマンド。同じCIパイプライン。言語ペアごとに異なるメソッド（人間または機械）。1つの設定ファイル。**

:::note[コミュニティ言語メソッドには主権があります]
上記のプレーンズ・クリー語のペアは、単なる言語ペアの1つではありません。先住民族言語やその他のコミュニティ言語向けメソッドは、**コミュニティが所有しガバナンスを行っています**。背後にあるデータへのアクセス権はコミュニティが保持し、利用規約を定め、非商用（NC）コーパスやメソッドはデフォルトで商用パスから除外されています。商用利用の場合は、リリース前にそのメソッドのライセンスを確認してください。[データ主権](/docs/network/sovereignty/data-sovereignty)を参照してください。
:::

## リーダーボード → デプロイのワークフロー

:::tip[CLIに標準搭載された`champollion network leaderboard`]
以下のワークフローは`champollion network leaderboard`コマンドで動作します。ターミナルから[Network](/arena)リーダーボードを閲覧し、そこから直接メソッドプラグインをインストールできます。すべてのオプションについては[CLIリファレンス](/docs/reference/cli#leaderboard)を参照してください。
:::

[Network](/arena)は、再現可能かつフィンガープリント付きのスコアリングによって翻訳メソッドのベンチマークを行う場所です。実行結果（ラン）は機械翻訳（MT）分野の標準的な手法に従い、95%信頼区間を伴うコーパスレベルのchrF++によって順位付けされます。BLEU、TER、COMETはその横に表示され、完全一致やFST受理性などの診断情報は個別に報告され、主要指標に混ざることは決してありません。あるメソッドが別のメソッドより真に優れているかどうかは、2つの数値の差ではなく、対応のある有意差検定によって判定されます。リーダーボードはすべての提出を追跡します。

ワークフロー：

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*※例示のみ — 上記のリーダーボードの行はレイアウトの一例です。この例では上位2行の区間が重複しているため、ボード上では一方が他方より優れているとは判断されません。リーダーボードは現在提出を受け付けており、まだ公開されたランはありません。*

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
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

3つのコマンド。手動翻訳ゼロ。パイプラインはハードコードされた文字列を検出し、選択したメソッドで翻訳し、何かが欠落または破損している場合はビルドを失敗させます。

### 5. プロによるレビュー（任意）

重要度の高いコンテンツについては、人間によるレビューのためにXLIFFにエクスポートします。

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

大量のコンテンツは機械翻訳で処理します。重要なパスは人間がレビューします。人間の作業時間は、本当に必要な箇所にのみ費用をかけます。

## コストモデル

champollionには**サブスクリプションやシート単位の価格設定はありません**。CLIはPolyForm Noncommercial 1.0.0のもとでソースコードが公開（source-available）されており、研究、教育、慈善活動、公立病院・診療所、政府機関、個人プロジェクトなどの非商用目的であれば無料で使用できます。営利企業のプロダクトなど、商用目的での利用はこのライセンスの対象外です。導入前に[利用可能な対象](/docs/getting-started/who-may-use-this)をご確認ください。それ以外に発生する費用は、翻訳APIの呼び出しコストのみです：

| 量 | Google翻訳 | LLM（Gemini Flash） | LLM（GPT-4o） |
|--------|-----------------|---------------------|---------------|
| 1,000キー × 5ロケール | 約$0.50 | 約$0.30（無料枠） | 約$2.00 |
| 10,000キー × 15ロケール | 約$15 | 約$8 | 約$60 |
| 50,000キー × 30ロケール | 約$75 | 約$40 | 約$300 |

Translation Memoryにより、その後の同期では**変更されたキーのみ**の費用が発生します。10,000件中10件の文字列を更新した場合、10,000件ではなく10件分の翻訳費用のみがかかります。

## TMSプラットフォームとの比較

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **料金** | 非商用利用は無料（[利用可能な対象](/docs/getting-started/who-may-use-this)）＋ API費用 | 月額 $50〜$500 ＋ シート課金 |
| **ベンダーロックイン** | なし — 設定でプロバイダーを変更可能 | 高い — ベンダーのクラウド内にデータを保持 |
| **メソッドの選択** | 言語ペアごとに任意のプロバイダー、モデルを選択可能 | ベンダーが提供するもののみ |
| **CI/CD** | 第一級のサポート（`lint → sync → audit`） | プラグイン／Webhook |
| **カスタムメソッド** | プラグインシステム、コミュニティプラグイン | 非対応 |
| **品質ゲート** | 標準搭載（文字体系の誤り、エコー、テキスト長） | サービスにより異なる |
| **セルフホスト** | 可能（LibreTranslate、カスタムAPI） | 不可 |

詳細は[完全な比較](/docs/guides/comparison)を参照してください。

## 関連ドキュメント

- **[クイックスタート](/docs/getting-started/quick-start)** — 60秒で最初の同期を実行する
- **[翻訳メソッド](/docs/guides/translation-methods)** — デシジョンツリー付きの全メソッド一覧
- **[CI/CD統合](/docs/guides/ci-cd)** — パイプラインで自動化する
- **[プロの翻訳者との連携](/docs/guides/professional-translators)** — XLIFFのエクスポート・インポート
- **[the Network](/arena)** — ベンチマークとリーダーボード
- **[設定リファレンス](/docs/getting-started/configuration)** — すべての設定オプション
