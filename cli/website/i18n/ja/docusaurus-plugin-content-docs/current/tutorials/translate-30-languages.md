---
sidebar_position: 2
title: "30言語への翻訳"
description: "クックブック：ペアごとの手法の組み合わせ、バッチ処理、CI連携を活用して、プロジェクトを3言語から30言語へスケールアップする方法。"
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# クックブック：30言語の翻訳

プロジェクトを少数のロケールからグローバルなカバレッジへとスケールアップする方法を解説します。このクックブックでは、実際の多言語デプロイメントを例に、手法の選択、コストの最適化、CI連携について説明します。

**シナリオ：** `en`、`fr`、`es` を持つ SaaS アプリがあります。品質要件の異なる3つのティアにわたって、さらに27言語を追加する必要があります。

---

## ステップ1：言語を分類する

30言語すべてに同じアプローチが必要なわけではありません。利用可能な手法の品質に応じてグループ分けしましょう。

| ティア | 言語 | 手法 | 理由 |
|------|-----------|--------|-----|
| **ティア1 — プレミアム** | `ja`、`ko`、`zh`、`de`、`pt` | `llm` (GPT-4o) | 重要市場、複雑な文法 |
| **ティア2 — スタンダード** | `it`、`nl`、`pl`、`sv`、`da`、`fi`、`no`、`cs`、`ro`、`hu`、`el`、`tr`、`id`、`ms`、`th`、`vi`、`uk`、`bg` | `google-translate` | 大量処理向け、Google による高いサポート品質 |
| **ティア3 — コーチング付き** | `crk`、`oj`、`mi`、`haw` | `llm-coached` + プラグイン | 低リソース言語、用語の統一が必要 |

## ステップ2：言語ペアごとに設定する

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**注意：** `pairs` に記載されていない言語は `defaultMethod: "google-translate"` を継承します。30言語すべてを列挙する必要はありません。

:::info
`crk` のサポートは現在開発中です。ステータスおよびコントリビューションのガイドラインについては、[低リソース言語のサポート](/docs/network/community/low-resource-languages)をご覧ください。
:::

## ステップ3：APIキーを設定する

この設定には、両方の APIキーが必要です。

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## ステップ4：まずドライランを実行する

30言語を翻訳する前に、必ずプレビューを確認してください。

```bash
npx champollion sync --dry
```

出力内容を確認します。以下の情報が表示されます。
- 各ペアで使用される手法
- ロケールごとに新規追加・変更されたキーの数
- ティアごとの推定 API 呼び出し回数

## ステップ5：同期を実行する

```bash
npx champollion sync
```

Champollion は各言語ペアを独立して処理します。Google Translate を使用するティア2のペアは処理が速く、ティア1の LLM ペアは低速ですが品質が高くなります。ティア3のコーチング付きペアは、プラグインのコーチングデータを使用します。

### 差分更新

初回の同期以降、後続の実行では**変更または追加された**キーのみが翻訳されます。

```bash
# Only keys that changed since last sync
npx champollion sync
```

ロックファイル（`.champollion.lock`）は翻訳済みの内容を追跡するため、安定したコンテンツが再翻訳されることはありません。

## ステップ6：品質を確認する

すべての言語ペアのステータスを確認します。

```bash
npx champollion status
```

各ペアの手法、モデル、品質ティア、コーチングデータやベンチマークスコアの有無を示すテーブルが出力されます。

### 出力はレジスターの指定を反映していますか？

ステップ2では言語ごとに[レジスター](/glossary#term-register)を指定しました。日本語には `"Polite/formal"`、ドイツ語には `"Formal (Sie)"` といった具合です。（この用語が初めての方は、用語集でわかりやすく説明しています。）これらの指示は翻訳プロンプトに組み込まれますが、プロンプトはあくまでリクエストであり、保証ではありません。

[Network ハーネス](/docs/network/specifications/harness)（公開リーダーボードを動かしているのと同じツール）を使うと、翻訳サンプルに対してレジスターとスタイルの遵守度を測定できます。文章スタイルのメトリクスは、各出力を期待されるレジスター（フォーマル・インフォーマルのマーカー、T–V 代名詞、短縮形、文長のドリフト）と照合し、実行全体の `style_consistency_rate` をレポートします。`--style-profile` を使ってカスタムのブランドボイスプロファイルを指定することも可能です。

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

正直に2点お断りしておきます。これらのメトリクスは**参考情報**です（リーダーボードの総合スコアには含まれません）。また、フォーマリティの検出はマーカーベースであり、ドリフト検出器であって人間による判断ではありません。詳細とメトリクスの定義については、[文章スタイルとレジスターのメトリクス](/docs/network/specifications/harness#writing-style-and-register-metrics-informational)をご覧ください。

## ステップ7：CI連携

GitHub Actions のワークフローに追加して、プッシュのたびに翻訳を最新の状態に保ちましょう。

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## コスト見積もり

ソースキーが500件、30言語のプロジェクトの場合：

| ティア | 言語 | 手法 | 概算コスト |
|------|-----------|--------|-----------------|
| ティア1（5言語） | ja, ko, zh, de, pt | GPT-4o | 〜$2.50 / フルシンク |
| ティア2（18言語） | it, nl, pl など | Google Translate | 〜$0.90 / フルシンク |
| ティア3（4言語） | crk, oj, mi, haw | GPT-4o-mini コーチング付き | 〜$0.40 / フルシンク |
| **合計** | **30言語** | **混合** | **〜$3.80 / フルシンク** |

差分シンク（変更キーが5〜20件）のコストは、フルシンクのごく一部で済みます。

## 関連項目

- [翻訳手法](/docs/guides/translation-methods) — 各翻訳手法の仕組みと使いどころ
- [プラグイン仕様](/docs/reference/plugin-spec) — ティア3の言語向けコーチングデータの作成方法
- [CI/CD ガイド](/docs/guides/ci-cd) — PR プレビュービルドを含む高度な CI パターン
- [品質ゲート](/docs/concepts/quality-gate) — Champollion が翻訳を書き込む前に検証する仕組み
- [サポート言語一覧](/docs/reference/supported-languages) — 言語コードと手法の互換性の完全なリスト
- [文章スタイルとレジスターのメトリクス](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — eval ハーネスによるレジスター・スタイル遵守度の測定（参考情報メトリクス）
- [用語集：レジスター](/glossary#term-register) — 「レジスター」の意味をわかりやすく解説
- [低リソース言語のサポート](/docs/network/community/low-resource-languages) — 機械翻訳のカバレッジが広くない言語向けのコーチングデータの追加方法
