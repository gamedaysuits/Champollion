---
sidebar_position: 4
title: "対応言語"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# サポート言語

champollion には **Language Cards** が付属しています。これは50言語の構造化された設定ファイルです。各カードには、レジスタープリセット、丁寧さシステムのメタデータ、メソッドサポートフラグ、タイポグラフィルール、スクリプト情報が含まれています。LLM が知っている言語であれば、設定を1行追加するだけで対応できます。ここに掲載されているのは、厳選された本番環境対応のレジスターを持つ言語です。

---

## 翻訳メソッド

各言語は、以下の翻訳メソッドを1つ以上使用できます。

| アイコン | 方式 | 仕組み | コスト |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | ニューラルMTのベースライン。194言語に対応。キーと値の文字列のみ — Markdownコンテンツを安全に翻訳することはできません。 | 約$20/100万文字 |
| 🔵 | **LLM (OpenRouter)** | モデルが学習している任意の言語。レジスター制御プロンプト。キーと値の文字列およびMarkdownコンテンツに対応。 | モデルにより異なる |
| 🟣 | **LLM-Coached** | LLM + 文法辞書 + プロンプトに注入されるコーチングデータ。形態論的に複雑な言語に最適です。 | モデルにより異なる |
| 🟠 | **API (Plugin)** | HTTP経由で提供される、コミュニティがホストする翻訳パイプライン。[主権の実現を目指す（sovereignty-aspirant）](/docs/network/community/low-resource-languages)。 | プロバイダーにより異なる |

Google Translate には `GOOGLE_TRANSLATE_API_KEY`、LLM メソッドには `OPENROUTER_API_KEY` を設定してください。詳細は [翻訳メソッド](/docs/guides/translation-methods) をご覧ください。

---

## 優先言語

ウェブおよびモバイルアプリケーションで最もよくリクエストされるロケールです。champollion が推奨するアクセシビリティ優先の順番で掲載しています。

| フラグ | 言語 | コード | Google | LLM | Coached | スクリプト | 備考 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | アラビア語 | `ar` | ✅ | ✅ | ✅ | — | RTL。現代標準アラビア語 (فصحى)。 |
| 🇵🇭 | フィリピン語 (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Docusaurus の設定では `fil` を使用してください。champollion は両方を解決します。 |
| 🇫🇷 | フランス語 | `fr` | ✅ | ✅ | ✅ | — | Vous 形。ジェンダーインクルーシブ (Connecté·e)。 |
| 🇪🇸 | スペイン語 | `es` | ✅ | ✅ | ✅ | — | ラテンアメリカ中立形。 |
| 🇩🇪 | ドイツ語 | `de` | ✅ | ✅ | ✅ | — | Sie 形。ジェンダーインクルーシブ (Benutzer:innen)。 |
| 🇯🇵 | 日本語 | `ja` | ✅ | ✅ | ✅ | — | 本文はです/ます体、UI ラベルはする形。 |
| 🇨🇳 | 中国語（簡体字） | `zh` | ✅ | ✅ | ✅ | — | 简体中文。 |
| 🇮🇹 | イタリア語 | `it` | ✅ | ✅ | ✅ | — | Lei 形。 |
| 🇧🇷 | ポルトガル語（ブラジル） | `pt` | ✅ | ✅ | ✅ | — | ブラジルポルトガル語。 |
| 🇰🇷 | 韓国語 | `ko` | ✅ | ✅ | ✅ | — | 해요체 丁寧レジスター。 |

## 主要世界言語

| フラグ | 言語 | コード | Google | LLM | Coached | スクリプト | 備考 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | ベンガル語 | `bn` | ✅ | ✅ | ✅ | — | শুদ্ধ ভাষা 優先。 |
| 🇧🇬 | ブルガリア語 | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | チェコ語 | `cs` | ✅ | ✅ | ✅ | — | Vykání（vy 形）。 |
| 🇩🇰 | デンマーク語 | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | ギリシャ語 | `el` | ✅ | ✅ | ✅ | — | 現代 Δημοτική。 |
| 🇮🇷 | ペルシャ語 | `fa` | ✅ | ✅ | ✅ | — | RTL。 |
| 🇫🇮 | フィンランド語 | `fi` | ✅ | ✅ | ✅ | — | 文法的性別なし。 |
| 🇮🇱 | ヘブライ語 | `he` | ✅ | ✅ | ✅ | — | RTL。 |
| 🇮🇳 | ヒンディー語 | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी。英語借用語を最小限に。 |
| 🇭🇺 | ハンガリー語 | `hu` | ✅ | ✅ | ✅ | — | Ön 形。 |
| 🇮🇩 | インドネシア語 | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | マレー語 | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | オランダ語 | `nl` | ✅ | ✅ | ✅ | — | U 形。 |
| 🇳🇴 | ノルウェー語 | `nb` | ✅ | ✅ | ✅ | — | Bokmål。 |
| 🇵🇱 | ポーランド語 | `pl` | ✅ | ✅ | ✅ | — | Pan/Pani 形。 |
| 🇵🇹 | ポルトガル語（EU） | `pt-PT` | ✅ | ✅ | ✅ | — | ヨーロッパポルトガル語。 |
| 🇷🇴 | ルーマニア語 | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | ロシア語 | `ru` | ✅ | ✅ | ✅ | — | Вы 形。 |
| 🇸🇰 | スロバキア語 | `sk` | ✅ | ✅ | ✅ | — | Vykanie（vy 形）。 |
| 🇷🇸 | セルビア語 | `sr` | ✅ | ✅ | ✅ | 🔤 ラテン文字→キリル文字 | 決定論的スクリプト変換器。 |
| 🇸🇪 | スウェーデン語 | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | スワヒリ語 | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | タイ語 | `th` | ✅ | ✅ | ✅ | — | ครับ/ค่ะ 丁寧語助詞。 |
| 🇹🇷 | トルコ語 | `tr` | ✅ | ✅ | ✅ | — | Siz 形。 |
| 🇺🇦 | ウクライナ語 | `uk` | ✅ | ✅ | ✅ | — | Ви 形。 |
| 🇵🇰 | ウルドゥー語 | `ur` | ✅ | ✅ | ✅ | — | RTL。آپ 形。 |
| 🇻🇳 | ベトナム語 | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | 中国語（繁体字） | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文。 |
| 🇬🇪 | ジョージア語 | `ka` | ✅ | ✅ | — | — | ქართული。カルトヴェリ語族。 |
| 🇳🇬 | ヨルバ語 | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá。声調言語（3声調）。 |

## 地域変種

| フラグ | 言語 | コード | Google | LLM | Coached | スクリプト | 備考 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | メキシコスペイン語 | `es-MX` | ✅ | ✅ | ✅ | — | Tú 形。温かみのあるレジスター。 |
| 🇨🇦 | カナダフランス語 | `fr-CA` | ✅ | ✅ | ✅ | — | ケベック語法。 |

---

## 先住民言語・低リソース言語

これらの言語は、商用のMTサービスではサポートされていません。champollionは、言語コミュニティが[コミュニティのデータ主権の原則](/docs/network/community/low-resource-languages)の下で独自の手法を構築するためのツールを提供します。

| | 言語 | コード | Google | LLM | Coached | スクリプト | ステータス |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | プレーンズ・クリー語 | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→音節文字 | 🚧 開発中 |
| 🌄 | ケチュア語 | `qu` | ✅ | ✅ | — | — | Runasimi。証拠性接尾辞あり。 |

:::info[Plains Creeは現在活発に開発されています]
Plains Cree（平原クリー語）のレジスター、コーチングインフラストラクチャ、スクリプトコンバーター、および評価ハーネスはすべて機能していますが、翻訳パイプラインは**まだリリースされていません**。リリース前に品質を確保するため、私たちは[コミュニティのデータ主権の原則](/docs/network/community/low-resource-languages)の下で言語コミュニティと協力しています。詳細および貢献の方法については、[低資源言語のサポート](/docs/network/community/low-resource-languages)をご覧ください。
:::

:::tip[低リソース言語をさらに追加するには]
champollion のメソッドプラグインシステムはこのために設計されています。言語コミュニティは独自の翻訳メソッドを構築し、自分たちの管理下でホストし、[API メソッド](/docs/guides/serving-a-method)を通じて提供することができます。[メソッドリーダーボード](/leaderboard)では、あらゆる言語ペアのスコアを追跡しています。メソッドを構築し、ハーネスを実行して、トップスコアを獲得しましょう。
:::

---

## 人工言語

人工言語（Conlang）は LLM レジスターとオプションのスクリプト変換器によってサポートされています。実在の言語と同じインフラを使用しており、品質ゲート、コーチングシステム、スクリプト変換パイプラインはまったく同じように機能します。

| | 言語 | コード | Google | LLM | スクリプト | 備考 |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | クリンゴン語 | `tlh` | ❌ | ✅ | 🔤 ローマ字→pIqaD | PUA フォント必須。Marc Okrand 語彙。 |
| 🧝 | シンダリン（トールキンのエルフ語） | `x-elvish-s` | ❌ | ✅ | 🔤 ラテン文字→テングワール | CSUR PUA フォント必須。 |
| 🏴‍☠️ | 海賊英語 | `x-pirate` | ❌ | ✅ | — | レジスターのみ。航海メタファー。 |
| 🦸 | クリプトン語 | `x-kryptonian` | ❌ | ✅ | 🔤 ラテン文字→クリプトン文字 | PUA フォント必須。 |
| 🎭 | シェイクスピア英語 | `x-shakespeare` | ❌ | ✅ | — | レジスターのみ。Thee/thou、-eth/-est 形。 |
| 🐸 | ヨーダ語 | `x-yoda` | ❌ | ✅ | — | レジスターのみ。OSV 語順。 |

PUA フォントの要件、Unicode の制限、独自の人工言語の追加方法については、[Conlangs、スクリプト、正書法](/docs/guides/conlangs-scripts-orthography) をご覧ください。

---

## 言語プリセット

`init` ウィザードは、クイックセットアップ用のプリセット名をサポートしています。プリセットと個別コードを組み合わせて使用できます。

| プリセット | 展開先 |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## 任意の言語を追加する

champollion は **LLM が知っている任意の言語** に翻訳できます。上記の表は組み込みレジスタープリセットを持つ言語の一覧です。掲載されていない言語を追加するには、設定ファイルに BCP-47 コードを記述してください。

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

LLM はその言語に関するトレーニング知識を使って翻訳します。`register` を設定することで、トーン、丁寧さ、正書法の規則を制御できます。詳細は [設定](/docs/getting-started/configuration) をご覧ください。

---

## Language Cards {#language-cards}

組み込み言語にはそれぞれ **Language Card** があります。これは `shared/language-cards/` にある統合 JSON ファイルで、レジスター、丁寧さ、メソッドサポート、タイポグラフィルール、系統分類、言語的課題、NLP リソースなどすべてのメタデータが含まれています。

### 統合カードアーキテクチャ

各カードはインポート時に即座に読み込まれます。別途参照用のティアは存在せず、すべてのデータは言語ごとの単一ファイルに格納されています。カードは権威あるソースから情報が補完されています。

| ソース | データ |
|--------|------|
| [Glottolog](https://glottolog.org) | 語族分類、祖先チェーン、Glottocode |
| [WALS](https://wals.info) | 属分類、類型論的特徴 |
| [CLDR](https://cldr.unicode.org) | スクリプト、文字方向、複数形ルール、タイポグラフィ |
| [ISO 15924](https://unicode.org/iso15924/) | スクリプトコード |

### 主要カードフィールド

| フィールド | 内容 |
|-------|------------------|
| **`nativeName`** | 自称名 — その言語が自分自身を呼ぶ名前、自言語のスクリプトで表記（例：ქართული、Runasimi） |
| **`classification`** | 系統的位置：語族、属、Glottolog による完全な祖先チェーン |
| **`contactInfluences`** | 普遍的な接触史 — 借用層、上位言語、基層言語 |
| **丁寧さシステム** | T-V 区別、敬語レベル、敬語、助詞など |
| **レジスタープリセット** | その言語の特性に合わせた名前付き LLM プロンプトプリセット |
| **メソッドサポート** | この言語をサポートする翻訳 API |
| **ジェンダーガイダンス** | 文法的性別のルールとインクルーシブライティングのヒント |
| **スクリプト/文字方向** | ISO 15924 スクリプトコードと RTL/LTR |
| **ルール** | タイポグラフィ（引用符、スペース）、大文字化、複数形カテゴリ |
| **`glottocode`** | クロスリファレンス用の正規 Glottolog 識別子 |
| **`dataSources`** | 出典追跡（例：`["glottolog-5.3", "cldr-48"]`） |

### 新しい Language Card のスキャフォールディング

ジェネレーターを使用して、権威あるデータソース（IANA、CLDR、Glottolog）からカードをスキャフォールドできます。

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

ジェネレーターはメタデータ（コード、スクリプト、文字方向、複数形、引用符、メソッドサポート、分類）を自動入力し、言語的判断が必要なフィールドには TODO マークを付けて人間によるキュレーションを促します。

### プリセットキーの使用

完全なレジスターテキストを記述する代わりに、プリセットキー名を使用できます。

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion はキーを完全なレジスタープロンプトに解決します。各言語で利用可能なプリセットを確認するには `npx champollion init` を実行してください。

### プリセット例

| 言語 | プリセット | デフォルト |
|----------|---------|--------|
| フランス語 | `formal-vous`、`casual-tu` | `formal-vous` |
| 韓国語 | `polite-haeyo`、`formal-hapsyo`、`casual-hae` | `polite-haeyo` |
| 日本語 | `polite`、`formal-keigo`、`casual` | `polite` |
| ドイツ語 | `formal-Sie`、`casual-du` | `formal-Sie` |
| タイ語 | `neutral-professional`、`polite-male`、`polite-female` | `neutral-professional` |
| スペイン語 | `neutral-professional`、`formal-usted`、`casual-tuteo` | `neutral-professional` |

完全な仕様（フィールドバリデーションと PR チェックリストを含む）については、[Language Card の貢献](https://github.com/gamedaysuits/champollion) をご覧ください。

---

## 関連項目

- [設定](/docs/getting-started/configuration) — 言語設定を含む完全な設定リファレンス
- [翻訳メソッド](/docs/guides/translation-methods) — 各メソッドの仕組み
- [スクリプト変換器](/docs/concepts/script-converters) — 決定論的スクリプト変換パイプライン
- [Conlangs、スクリプト、正書法](/docs/guides/conlangs-scripts-orthography) — PUA フォント、Unicode、人工言語の追加
- [低リソース言語のサポート](/docs/network/community/low-resource-languages) — サポートが不十分な言語のメソッド構築
