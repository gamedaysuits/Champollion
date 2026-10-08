---
sidebar_position: 1
slug: /intro
title: "はじめに"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

完全にカスタマイズ可能な国際化フレームワークです。コマンド一つでロケールファイルを翻訳できます。一つの設定ファイルで、すべてのメソッド・モデル・言語ペアを制御できます。組み込みのメソッドでは不十分な場合は、独自のメソッドを構築し、動作を検証してからデプロイできます。

```bash
npx champollion sync
```

champollionはロケールファイル、フォーマット、ターゲット言語を自動検出します。不足している翻訳のみを実行し、完了しているものはスキップし、破損した出力がないかすべての結果をチェックした上で、クリーンな出力として書き込みます。これがスタートラインです。

:::info[より大きな取り組みの一部として]

このCLIは、**Champollion**におけるデプロイを担うツールです。Champollionは、他では測定されていない言語の機械翻訳を評価し、その結果を公開するインフラストラクチャです。評価側では、テストセットの構築や、「誰が・どの種類のテキストで・何を・どれだけ適切に翻訳できるか」を示す公開マップを作成します。そしてCLIは、実証された手法を実際に実行可能な形にする役割を果たします。

すべての根底には1つの原則があります。言語データは生体データ（biodata）と同様に扱われ、コーパスを提供する人々がそのデータおよびそれに基づいて測定されるあらゆる対象の権利を保持します。全体像（何が存在し、どのようなルールがあり、どこに関与できるか）については[Champollionとは](/docs/what-is-champollion)を、評価側の仕組みについては[ネットワーク](/docs/network/)を参照してください。

:::

---

## なぜ自分でスクリプトを書かないのか？

各キーに対して Google Translate を呼び出す簡単なループを書くことはできます。多くの開発者がそうしています — 約30行で書けます。しかし、次のような問題が生じます。

- **変更検知がない** — 英語の文字列を更新しても、翻訳は古いまま残ってしまいます。champollionは各原文の値をSHA-256ハッシュで追跡し、変更された箇所のみを再翻訳します。
- **バッチ処理がない** — 1キーごとに1回のAPI呼び出しを行うと、200キーで200往復の通信が発生します。champollionは賢くバッチ処理を行います（設定可能、デフォルトはLLMで80キー/バッチ、Googleで128キー/バッチ）。
- **キャッシュがない** — 同期を実行するたびにすべてが再翻訳されます。champollionの翻訳メモリ（Translation Memory）は、「原文テキスト + ロケール + 手法」に基づいて翻訳をキャッシュします。1つのキーを変更した後に同期を再実行しても、ファイル全体ではなくその1キーのみが翻訳されます。
- **品質ゲートがない** — 機械翻訳はハルシネーションを起こしたり、原文をそのまま返したり、誤った文字体系で出力したりすることがあります。champollionは書き込みを行う前にすべての翻訳をチェックします。空の出力、原文のエコー、繰り返しのループ、不自然な文字数の膨張、コンテンツの欠落、誤った文字体系は検出されて拒否されます。このゲートは意味の誤りではなく、破損した出力を捕捉します。
- **フォーマットへの配慮がない** — JSONにハードコードされていませんか？champollionはJSON、TOML、YAML、Hugo Markdown（フロントマター + 本文）に対応し、自動検出します。
- **手法の制御ができない** — すべての言語ペアに同じ手法が適用されてしまいます。champollionでは、同じ設定ファイル内で、フランス語にはGoogle翻訳、日本語にはLLM、クリー語にはコミュニティホストのカスタムパイプラインを使用するといった設定が可能です。

champollion は、そのスクリプトのプロダクション版です。

---

## 何が違うのか

### すべてのメソッドはプラグイン

翻訳メソッドは**言語ペアごとに設定可能**です。同じプロジェクト内で Google Translate・LLM・コーチングプロンプト・カスタム API を組み合わせて使えます。

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

フランス語にはGoogle翻訳（高速・低コスト）。日本語には高精度なLLM（ニュアンスの再現）。平原クリー語には、指定した文法規則と辞書で誘導されたLLM。すべて同じ`sync`コマンド、同じ品質ゲート、同じCLIで実行できます。

### 何が機能するかを確認する

自分のメソッドが英語からスペイン語へ、トルコ語からアゼルバイジャン語へ、英語からクリー語へ翻訳できると思いますか？

**構築してテストしてください。** 付属の [eval ハーネス](/docs/network/specifications/harness)は、再現性のある指紋付きスコアリングで任意の翻訳メソッドをベンチマークします。[リーダーボード](/leaderboard)は公開された各実行を記録するので、誰でも何が機能するかを確認できます。

eval ハーネスとプロダクション CLI は同じプラグインインターフェースを共有しています。ハーネスで高スコアを獲得したメソッドは、その言語を使用するコミュニティが同意を与えた場合に限り、プロダクションで使用できます。先住民言語や低リソース言語では、その同意が重要です。[データ主権](/docs/network/sovereignty/data-sovereignty)をご覧ください。

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

# Use it locally
npx champollion sync
```

同じプラグイン。接続してテストするだけ。

### 完全なツールキット

champollion は `sync` だけではありません。完全な i18n パイプラインです。

| コマンド | 機能 |
|---------|-------------|
| `sync` | 不足・古くなったキーを翻訳する（同期後の検証付き） |
| `watch` | ソースファイルの変更時に自動同期する |
| `lint` | ソースコード内のハードコードされた文字列をスキャンする |
| `wrap` | ハードコードされた文字列を `t()` 呼び出しで自動ラップする |
| `audit` | 過去の実行からすべての `[EN]` フォールバックマーカーを一覧表示する |
| `verify` | 翻訳の存在と正確性を検証する（CI ゲート） |
| `integrity` | プレースホルダーの破損・エンコーディングの問題・ICU 複数形の完全性を検出する |
| `seo` | hreflang タグ・サイトマップ・JSON-LD スキーマを生成する |
| `status` | ペアの設定・プラグイン・ベンチマークスコアを表示する |
| `provenance` | 翻訳リソースのライセンスを監査する |
| `plugin` | メソッドプラグインのインストール・削除・一覧表示を行う |
| `fonts` | PUA スクリプトコンバーター用のウェブフォントをダウンロードする |
| `tm` | Translation Memory キャッシュを管理する（統計・クリア・ロケール別） |
| `xliff` | プロの翻訳者レビュー用に XLIFF 1.2 をエクスポート/インポートする |

このうち4つ — `lint`、`sync`、`verify`、`audit` — は CI パイプラインを構成し、ハードコードされた文字列を検出し、翻訳し、正確性を検証し、いずれかのロケールが不完全な場合はビルドを失敗させます。

---

## ネットワーク

[手法リーダーボード](/leaderboard)はスコアボードであり、リアルタイムで公開され、誰でも提出が可能です。すべての提出物はGitコミットにフィンガープリントされ、特定のデータセットに対してバージョン管理され、同一のハーネスによってスコアリングされます。誰でも提出できます。

**何を構築できますか？** ハーネスは JSON を受け取ります。プラグインも JSON を受け取ります。JSON を生成するメソッドであれば何でもテストできます。

| アプローチ | 例 |
|----------|---------|
| **コーチング済み LLM** | 文法規則と辞書をフロンティアモデルのプロンプトに注入する |
| **ファインチューニング済みモデル** | 対訳テキストでオープンモデルを訓練する — ただし評価データは使用しない |
| **FST ゲート付きパイプライン** | LLM が生成 → 有限状態トランスデューサーが形態論を検証 → リトライ |
| **連鎖モデル** | モデル A が下書き → モデル B がポストエディット → モデル C がスコアリング |
| **辞書 + LLM** | 辞書から既知の用語を強制適用し、残りは LLM に任せる |
| **進化的アプローチ** | 候補を生成し、スコアリングし、最良のものを変異させ、繰り返す |
| **部分翻訳** | サンプルを手動で翻訳し、LLM が一致することを証明してから残りを自動翻訳する |

モデルをファインチューニングする。進化的アルゴリズムをデプロイする。言語試験で生徒の回答をテストする。ルックアップテーブルを構築する。3つのモデルを連鎖させる。メソッドが JSON を生成する限り、ハーネスがスコアリングし、フレームワークが実行します。

:::danger[唯一のルール]
**評価データで訓練しないでください。** ベンチマークデータセットにアクセスしたメソッドは失格となります。ファインチューニングは何を使っても構いません。ただし、テストセットは使用しないでください。
:::

これはオープンな招待です。低リソース言語に携わっている方 — 研究者、コミュニティメンバー、学生、あるいは単純に関心を持っている方 — メソッドを構築し、ハーネスを実行して、すべての人のためにネットワークを強化してください。この問題はまだ解決されていません。インフラはここにあり、オープンです。

**[→ リーダーボードを見る](/leaderboard)**

---

## 次のステップ

**はじめに:**
- [インストール](/docs/getting-started/installation) — 2分でセットアップ
- [クイックスタート](/docs/getting-started/quick-start) — 最初の sync を実行する
- [対応言語](/docs/reference/supported-languages) — すぐに使える言語一覧

**セットアップのカスタマイズ:**
- [翻訳メソッド](/docs/guides/translation-methods) — ペアごとに適切なメソッドを選ぶ
- [Translation Memory](/docs/concepts/translation-memory) — キャッシュでコストを削減する方法
- [設定](/docs/getting-started/configuration) — 完全な設定リファレンス
- [Hugo 多言語サイト](/docs/tutorials/hugo-multilingual-site) — Markdown コンテンツの翻訳

**さらに詳しく：**
- [プロの翻訳者との連携](/docs/guides/professional-translators) — XLIFFのエクスポート／インポートワークフロー
- [データ主権](/docs/network/sovereignty/data-sovereignty) — 先住民族のデータ主権原則：コミュニティによる言語データの所有と管理
- [低リソース言語のサポート](/docs/network/community/low-resource-languages) — すべての始まりとなった挑戦
- [クックブック: FSTゲートパイプライン](/docs/network/tutorials/fst-gated-pipeline) — 分解パイプラインの構築
- [機械翻訳の評価](/docs/network/leaderboard/rules) — ハーネスとリーダーボードの仕組み
- [手法リーダーボード](/leaderboard) — リアルタイムスコアと提出
