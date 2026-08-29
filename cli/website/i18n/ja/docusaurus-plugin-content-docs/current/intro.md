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

champollion はロケールファイル・フォーマット・対象言語を自動検出します。不足している翻訳を補い、完了済みのものはスキップし、すべての結果を検証して、クリーンな出力を書き出します。これが出発点です。

:::info[より大きな取り組みの一部として]

このCLIは、**Champollion**のデプロイメントを担う部分です。Champollionとは、
他の誰も測定していない言語の機械翻訳を測定し、
その結果を公開するインフラストラクチャです。測定側は、評価テストセットと、
誰が、何を、どの程度うまく、どのような種類のテキストで翻訳できるかを示す公開マップを構築します。
一方CLIは、実証済みの手法を実際に実行可能なものにする場所です。

すべてを形作る1つのルールがあります。言語データは生体データのように扱われるため、
コーパスを提供する人々が、そのデータおよびそれを用いて測定されるすべてのものに対する鍵を握っています。
全体像（何が存在し、どのようなルールがあり、あなたがどこに当てはまるのか）については[Champollionとは](/docs/what-is-champollion)を、
測定側については[ネットワーク](/docs/network/)をご覧ください。

:::

---

## なぜ自分でスクリプトを書かないのか？

各キーに対して Google Translate を呼び出す簡単なループを書くことはできます。多くの開発者がそうしています — 約30行で書けます。しかし、次のような問題が生じます。

- **変更検知がない。** 英語の文字列を更新しても、翻訳は永遠に古いままです。champollion は SHA-256 ハッシュですべてのソース値を追跡し、変更があったものだけを再翻訳します。
- **バッチ処理がない。** キーごとに1回の API 呼び出しを行うと、200キー = 200回のラウンドトリップになります。champollion はインテリジェントにバッチ処理します（設定可能、デフォルトは LLM で80キー/バッチ、Google で128）。
- **キャッシュがない。** 同期のたびにすべてを再翻訳します。champollion の Translation Memory は、ソーステキスト・ロケール・メソッドの組み合わせで翻訳をキャッシュします。1つのキーを変更した後に sync を再実行しても、翻訳されるのはそのキーだけで、ファイル全体ではありません。
- **品質ゲートがない。** 機械翻訳はハルシネーションを起こしたり、ソースをそのまま返したり、誤ったスクリプトで出力したりします。champollion はすべての翻訳を書き出す前に検証します — スクリプトの誤り、長さの膨張、ソースのエコーを検出して拒否します。
- **フォーマット認識がない。** JSON にハードコードされていますか？ champollion は JSON・TOML・YAML・Hugo Markdown（フロントマター＋本文）を自動検出で処理します。
- **メソッド制御がない。** すべてのペアに同じメソッドが使われます。champollion では、フランス語に Google Translate、日本語に LLM、クリー語にカスタムのコミュニティホスト型パイプラインを — 同じ設定ファイルの中で — 使い分けることができます。

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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

フランス語には Google Translate（高速・低コスト）。日本語にはプレミアム LLM（ニュアンスを重視）。プレーンズ・クリー語には、文法規則・辞書・形態論的検証を備えたコーチング済みプラグイン。同じ `sync` コマンド。同じ品質ゲート。同じ CLI。

### 何が機能するかを確認する

自分のメソッドが英語からスペイン語へ、トルコ語からアゼルバイジャン語へ、英語からクリー語へ翻訳できると思いますか？

**構築してテストしてください。** 付属の [eval ハーネス](/docs/network/specifications/harness)は、再現性のある指紋付きスコアリングで任意の翻訳メソッドをベンチマークします。[リーダーボード](/leaderboard)は公開された各実行を記録するので、誰でも何が機能するかを確認できます。

eval ハーネスとプロダクション CLI は同じプラグインインターフェースを共有しています。ハーネスで高スコアを獲得したメソッドは、その言語を使用するコミュニティが同意を与えた場合に限り、プロダクションで使用できます。先住民言語や低リソース言語では、その同意が重要です。[データ主権](/docs/network/sovereignty/data-sovereignty)をご覧ください。

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

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

[メソッドリーダーボード](/leaderboard)はスコアボードです。リアルタイムで公開されており、提出を受け付けています。すべての提出物はGitコミットにフィンガープリントされ、特定のデータセットにバージョン付けされ、同じハーネスによってスコアリングされます。誰でも提出できます。

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

**さらに詳しく:**
- [プロの翻訳者との連携](/docs/guides/professional-translators) — XLIFFのエクスポート/インポートワークフロー
- [データ主権](/docs/network/sovereignty/data-sovereignty) — 先住民族のデータ主権の原則：言語データのコミュニティによる所有と管理
- [低資源言語のサポート](/docs/network/community/low-resource-languages) — すべての始まりとなった課題
- [クックブック: FSTゲートパイプライン](/docs/network/tutorials/fst-gated-pipeline) — 分解パイプラインの構築
- [機械翻訳（MT）の評価](/docs/network/leaderboard/rules) — ハーネスとリーダーボードの仕組み
- [メソッドリーダーボード](/leaderboard) — リアルタイムのスコアと提出物
