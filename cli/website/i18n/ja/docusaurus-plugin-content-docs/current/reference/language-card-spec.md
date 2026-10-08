---
sidebar_position: 4
title: "言語カード仕様"
description: "Champollion の言語ごとの設定カードに関する標準スキーマです。"
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# 言語カード仕様

> **唯一の信頼できる情報源（Single source of truth）。** 本ドキュメントでは、すべての言語カードの標準的な構造（canonical shape）を定義します。カードは引用元ソースが言及している内容のみを表明します。どのソースも言及していないフィールドは、**null ではなく省略**されます。欠落しているフィールドは「ソースによる言及がない」ことを意味し、「知るべき情報が存在しない」ことを意味するわけではありません。機械検証可能なスキーマは npm パッケージ内に `shared/schemas/language-card.schema.json` として同梱されており、[以下の正規の例](#canonical-template)はサイトのビルドごとにライブコーパスから生成されるため、本ページが記述対象のカードから乖離することはありません。

## 2026-08 アトラス再構築 — 本スキーマにおける変更点

カードコーパスは現在、**ビルド成果物**となっています。すべてのカードは固定された上流スナップショットのストアから射影され、事実が変更された際には直接編集されることなく再構築されます。この再構築に伴い、構造に関して次の4点が変更されました。

1. **見解が分かれるフィールドには帰属エンベロープ（attribution envelope）を付与。** 引用元ソース間で明確に見解が分かれる場合、フィールドは単純な単一値ではなく、`{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`、`speakerEstimates`、`endangerment`、および新しいソースによって異論が生じた任意のフィールドの形式をとります。利用側は単一値を想定するのではなく、公開されているアダプター（npm パッケージの `normalizeCard()`）を介してカードを読み取る必要があります。`display()` はエンベロープを合意された値へと解決し、真に見解が分かれている場合は勝者を勝手に選出するのではなく、意図的に何も返しません。

2. **フィールド名の変更。** `endonym` が `nativeName` を置き換え · `codeAliases` が `aliases` を置き換え · `scripts[]`（確認されているすべての文字体系）がフラットな `script` を置き換え、主要文字体系はカードの最大長 BCP 47 タグから導出 · `endangerment`（各ソース独自のスケールに基づく全ソースの評価）が単一の `vitality` オブジェクトを置き換え · `isoLanguageType` および `isoScope` は頭文字ではなく、ISO 639-3 自身の表記（「Living」、「Macrolanguage」）を保持するようになりました。新規フィールド：`modality`（Glottolog の系統関係から導出された「spoken」/「signed」）、`glottologBucket`（family スロットから除外された Glottolog の非系統的分類バケット）、`locale`/`localeScoped`。

3. **言及のないフィールドは null ではなく省略。** どのソースも言及していないフィールドは、カードから除外されます。以前のルール（「すべてのカードは、null であってもすべてのトップレベルフィールドを含まなければならない（MUST）」）は廃止されました。公開面にある空の値は「知るべき情報が存在しない」という主張として解釈されてしまい、「調査していない」こととは異なるためです。

4. **ロケールカードの存在。** 言語カードと並んで、ロケール射影（`fra-CA`、`cmn-Hant`）は、特定の地域または文字体系向けに解決された言語の事実を保持し、`locale: {language, region, script}` ブロックによって識別されます。ロケールと言語は別物です。言語のカウントを行う際は、このブロックを用いてロケールを除外してください。

## 設計原則

1. **すべての情報に出典を明記。** すべての事実に関する主張は、名前とバージョンが特定された一次情報源に遡ることができます。出典のない主張は検証不可能です。`_fieldSources` マップ（およびサブオブジェクト内のフィールドごとの `source` 注釈）により、来歴（provenance）が明確になります。

2. **見解の相違を保持。** 権威ある情報源の間で見解が一致しない場合（あるソースでは話者数50,000人、別のソースでは20,000人とされている場合など）、カードには前述のエンベロープ形式を用いて、出典帰属とともに*双方*が記録されます。平均化したり、独自に解決したり、いずれかの立場を選んだりすることはありません。ユーザー自身がそのニュアンスを読み解くことができます。

3. **非存在は言及なしを意味する。** フィールドの欠落は、どのソースも値を言及していないことを意味します。ある特性が真に適用されない場合（例：文法性を持たない言語における文法性など）、空白にするのではなく、引用された値において明示的にその旨が示されます。

4. **パッチ修正ではなく常に再構築。** カードは決定論的ビルドによって、固定されたソースから射影されます。事実の不備はソースハンドラー側で修正され、コーパス全体が再構築されます。直接のインプレース編集や、マージのみのエンリッチメント層は存在しません。

---

## 三層アーキテクチャ

| レイヤー | 場所 | 目的 |
|-------|----------|---------|
| **言語カード** | `shared/language-cards/<code>.json` | 言語ごとの設定：識別情報、分類、リソース、その他すべて |
| **属カード** | `shared/language-cards/genera/<genus>.json` | 関連言語の共有ランタイムプロパティ（手動でキュレーション、自動生成ではない） |
| **言語ツリー** | `shared/language-cards/language-tree.json` | 完全な Glottolog 階層 — Lab UI と言語探索のための参照データ |

---

## 継承モデル

> **アトラス再構築以降、ほぼ歴史的経緯となりました。** ディスク上の言語カードには `extends` はもう含まれていません。継承された説明文は引用不可能であったため（語族レベルの主張が言語レベルのアドレスを帯びてしまっていたため）、すべてのカードはビルドによって完全に実体化（materialize）されます。この仕組み自体は1箇所にのみ残っています。npm パッケージのオフラインバンドルでは、言語に対するコンパクトな `extends` の差分としてロケールカードが提供され、ここで説明されているのと同じマージ処理によって解決されます。

カードが `"extends": "family-dravidian"` を設定すると、ランタイムは `lib/registers.js` 内の `_deepMerge()` を使用して親カードを子カードにマージします。これにより、属カードが共有のレジスター、丁寧さのシステム、および性別ガイダンスを定義し、数百の個別カードにデータを複製することなく、すべてのメンバー言語に継承させることができます。

### マージのセマンティクス

| 子の値 | 動作 | 理由 |
|-------------|----------|-----|
| `null` | 親から継承 | `null` は「これを定義しない」を意味する — 親の値がそのまま使われる |
| null以外 | 親を上書き | 子のデータがより具体的 — 優先される |
| ネストされたオブジェクト | 再帰的マージ | 子のフィールドが上書き、親のフィールドは保持 |
| 配列 | 完全に置き換え | 配列はアイテムごとにマージされない — 子の配列が優先 |

### 識別フィールド（継承されない）

一部のフィールドはカード自体に属するものであり、親から継承されてはなりません：

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

親カードが `aliases: ["macro-code"]` を定義していても、子カードはそのエイリアスを継承しません。これらのフィールドは常に子自身の値です（未設定の場合は `null` を含む）。

**理由：** このルールがなければ、すべての Cree 言語がマクロ言語の親から `aliases: ["cre"]` を継承し、すべての変種がマクロのエイリアスになってしまいます。

### 例：Cree カードの解決方法

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

ランタイムでは、`getLanguageCard("crk")` は genus-cree のレジスター + family-algic のプロパティ（存在する場合）+ crk 自身の識別情報とメタデータをマージしたオブジェクトを返します。

### 属カードテンプレート

属カードは `shared/language-cards/genera/` に置かれ、言語グループの共有プロパティを定義します。通常のカードと同じスキーマに従いますが、異なる規則があります：

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**重要なルール：** 属カードには、グループ全体で本当に共有されており、権威ある参考文献から出典が取れるデータのみを含めなければなりません。丁寧さのシステムがメンバー間で異なる場合は、属カードではなく個別のカードに記載します。

## 正規の例 \{#canonical-template}

> **手書きではなく生成されたものです。** このセクションのすべての内容は、ビルド時にライブコーパスから導出されています。完全な `crk`（平原クリー語）カード（バイト単位で完全一致）に加えて、`fra-CA` ロケールの抜粋が含まれます。コーパスが再構築されると、次のサイトビルドで本ページが再導出されます。時代遅れになるような手動メンテのテンプレートは残っていません。以前のテンプレートはカードのスキーマより丸々1世代分遅れて乖離してしまったため、2026-08-16 に廃止されました。

この例は**ディスク上の構造**（ファイルを開いた際に得られる内容）を示しています。利用側は引き続き、公開されているアダプター（npm パッケージ内の `normalizeCard()`）を介してカードを読み取る必要があります。アダプターはエンベロープを解決し、移行前の古いフィールド名との橋渡しを行い、未加工のカードには意図的に保持されていない表示専用の値（主要文字体系、活力度ティアなど）を導出します。

確認すべきポイント：

1. **帰属エンベロープ。** `name`、`classification.family`、`endangerment`、`speakerEstimates`、`endonym`、`bcp47FullTag`、および `politenessDistinction` は、それぞれ `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment` を持ち、`"agreement": "incommensurable"` となっています。ソースごとに異なる尺度で評価しているため、特定の勝者の尺度に変換されるのではなく、各値が自身の `scale` を明記します。

2. **省略は言及なしを意味する。** カードには `iso639_1`（平原クリー語には ISO 639-1 コードが存在しない）や `phonologicalInventory`（取り込まれたソースで言及しているものがない）が含まれていません。これらのフィールドは単に存在せず、`null` や `[]` になることはありません。

3. **来歴（provenance）は第一級の層。** `_fieldSources` はすべてのフィールドをそれを言及したソースに対応付け、Champollion が計算した値には `champollion-derived-v1` のマークが付けられます。`_card` はカードのタイプ、ID、リビジョン、および修正レーンが変更可能なフィールドを記録します。`_atlas` はコーパスのリリースを記録します。

4. **実行結果（run results）は含まない。** カード上のいかなる項目も、手法の出力に関する測定スコアではありません。chrF、FST 受理率、およびそれらと同種の値は、(method, dataset, metric) をキーとする実行結果であり、リーダーボード上に配置されます。カードはリソースが*存在する*こと（`resources`、`lexicalResources`、`methodSupport`）のみを表明します。

<CardSpecExample variant="language" />

### ロケールカードは射影であり、言語ではない \{#locale-card-example}

言語カードの隣には、ロケールカード（`fra-CA`、`cmn-Hant`）が配置されています。これは**特定の地域または文字体系向けに解決された**言語の事実であり、コードの形式ではなく `locale` ブロックによって識別されます。ロケールカードはその言語の事実を継承し、文字体系や地域にスコープされた事実（`script`、`localeScoped`）を解決したものであり、**言語ではありません**。言語の集計や言語ごとの一覧からは、この `locale` ブロックを用いて必ずロケールカードを除外してください。

<CardSpecExample variant="locale" />

---

## フィールドリファレンス \{#field-reference}

以下のすべての表に共通する2つの規則があります。

- **「envelope」**は、*すべての*ソースの主張を保持する帰属エンベロープ（`{agreement, consensus?, values: [{value, source, note?, scale?}]}`）を指します。`envelope` と記載されているフィールドであっても、1つのソースのみが言及しているカードでは単一値として現れる場合があります（例えば、Glottolog にのみ存在する languoid ではフラットな `name` となります）。利用側は双方を処理できるようにする必要があり、公開されているアダプターがその処理を担っています。
- `code` および `name` 以外に必須のフィールドはありません。それ以外はすべて、**言及するソースが存在しない場合は省略されます**。各フィールドについて言及しているソースはカードごとに `_fieldSources` に記録されるため、以下の表では時間の経過とともに変化するバージョンを固定するのではなく、ソースの*種類*を説明しています。

### § 1. 識別フィールド

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `code` | `string` | **必須。** カード ID およびファイル名。言語カードの場合は ISO 639-3（`crk`）、Glottolog のみの languoid の場合は glottocode、ロケールカードの場合はロケールコード（`fra-CA`）となります。 |
| `name` | envelope | **必須。** 英語の参照名（ISO 639-3 レジストリ、LinguaMeta、Glottolog）。 |
| `endonym` | envelope | `nativeName` を置き換え。話者がその言語内で自分たちの言語を呼ぶ名称（LinguaMeta、Wikidata）。言及するソースがない場合は省略されます。エンドニムが勝手に創作されたり翻字されたりすることはありません。 |
| `alternateNames` | `string[]` | 確認されているその他の英語名。 |
| `iso639_1` | `string` | 2文字の ISO 639-1 コードが存在する場合にのみ存在（`fra` → `"fr"`）。 |
| `isoScope` | `string` | ISO 639-3 自身の表記 — `"Individual"`、`"Macrolanguage"`、`"Special"`（頭文字の `"I"`/`"M"`/`"S"` を置き換え）。 |
| `isoLanguageType` | `string` | `isoType` を置き換え。ISO 639-3 自身の表記 — `"Living"`、`"Extinct"`、`"Ancient"`、`"Historical"`、`"Constructed"`。 |
| `macrolanguage` | `string` | この言語が属するマクロランゲージ（`crk` → `"cre"`）。ISO 639-3 マクロランゲージマッピング。 |
| `macrolanguageMembers` | `string[]` | マクロランゲージのハブカードにおける、個々の構成言語コード（`nor` → `["nno", "nob"]`）。 |
| `canonicalisedMembers` | envelope | マクロランゲージカードにおいて、BCP 47 レジストリがこのマクロランゲージのタグに統合している構成言語（CLDR エイリアステーブル + SIL langtags、それぞれ出典付き）。 |
| `supersededCodes` | `string[]` | SIL が現在この言語へ転送している廃止済みの ISO 639-3 コード — 古いコードで公開されたコーパスが引き続き解決できるように、後継言語側に記録されます。 |
| `codeAliases` | `string[]` | `aliases` を置き換え。このカードへと解決されるコードレベルの識別子。 |
| `bcp47` | `string` | ソースで言及されている言語の BCP 47 タグ（LinguaMeta）。 |
| `bcp47Tag` | envelope | Champollion 導出値：RFC 5646 タグ（最も短い ISO 639 コードが優先）。 |
| `bcp47FullTag` | envelope | 言語–文字体系–地域の最大形式（CLDR likelySubtags + SIL langtags）。アダプターはこのタグから**主要文字体系**を導出します。 |
| `modality` | `string` | `"spoken"` または `"signed"`。Glottolog の系統関係から導出。書字は正書法の属性であり、モダリティではありません。文字を持たない言語であっても、完全に音声言語または手話言語です。 |
| `locale` | `object` | **ロケールカードのみ。** `{language, region, script, publishedTag, source, note}` — ロケール自体の識別情報。言語の集計からは、コードの形式ではなくこのブロックによってロケールカードを除外してください。 |
| `localeScoped` | `object` | ロケールカードのみ：ロケールの地域/文字体系向けに解決された値（例：`scriptName`、`cldrOfficialStatus`）。 |

### § 2. 分類フィールド

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `glottocode` | `string` | この languoid に対する Glottolog の識別子（`crk` → `"plai1258"`）。Glottolog のみの languoid（Glottolog には記録されているが ISO 639-3 にはない言語）は、カードの `code` として glottocode を使用します。 |
| `classification` | `object` | 以下の分類位置フィールドのコンテナ。各項目は独立して出典付けされ、個別に省略されます。孤立した言語や Glottolog のバケットに分類される言語は、正当な理由によりこのオブジェクトの一部のみを保持します。 |
| `classification.family` | envelope | 各分類機関が主張する最上位語族。Glottolog と WALS は別々の分類体系であり、常に見解が一致するとは限らないため、両方が保持され出典が明記されます。リントルール R5 は、エンベロープ内の Glottolog の値を Glottolog 自身のツリーと照合して検証します。WALS が Glottolog と異なる見解を持つことは許容されますが、Glottolog の誤引用は許されません。孤立した言語には語族は一切含まれません。 |
| `classification.familyGlottocode` | `string` | その最上位語族の glottocode（`crk` → `"algi1248"`）。 |
| `classification.genus` | `string` | WALS の中間分類ノード（`crk` → `"Algonquian"`）。WALS 独自の概念であり、Glottolog の概念**ではありません**（Glottolog は genus レベルを持たない任意の深さのツリーを公開しています）。そのため、WALS が言語をコード化している場合にのみ存在します。 |
| `classification.ancestry` | `string[]` | 祖先 glottocode のリストとしての Glottolog の系統パス（ルートが先頭、`["algi1248", …, "plai1264"]`）。順序そのものが主張**である**ため、これはパスであり、アルファベット順に並べ替えたセットではありません。 |
| `classification.glottologBucket` | `string` | Glottolog の非系統的分類バケット — `"Artificial Language"`、`"Pidgin"`、`"Mixed Language"`、`"Speech Register"`、`"Unclassifiable"`、`"Unattested"`。バケットは系統ではなく種別で分類するものであるため、語族スロットから除外されています。バケットを持つカードには語族が存在せず、それが正確な結果です。 |
| `isIsolate` | `boolean` | Glottolog がこの言語を孤立言語として分類しているかどうか。 |

移行前のカードには `genusGlottocode` も含まれていました。これはそれを生み出したカテゴリー錯誤とともに廃止されました。genus は WALS の概念であり、それに Glottolog の識別子を付与することは、Glottolog には存在しないツリーノードを主張することになっていたためです。現在、Glottolog の階層は代わりに `ancestry` によって保持されます。

### § 3. 地理フィールド

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `macroarea` | `string` | Glottolog のマクロエリア — `"Africa"`、`"Australia"`、`"Eurasia"`、`"North America"`、`"Papunesia"`、または `"South America"`。 |
| `coordinates` | `object` | `{lat, lng}` — Glottolog の代表地点。領域ではなく代表地点であり、地図上に言語を配置するもので、分布範囲や境界を主張するものではありません。 |
| `countries` | `string[]` | Glottolog がその言語に関連付けている国の ISO 3166-1 alpha-2 コード（`["CA", "US"]`）。 |
| `cldrOfficialStatus` | `string` | CLDR が記録している（LinguaMeta 経由で取得される）、ある地域がその言語に付与している公的地位 — `"Official"`、`"Regional official"`。ロケールカードでは、*そのロケールの*地域向けに解決された地位が `localeScoped.cldrOfficialStatus` に配置されます。 |

移行前の `regions` 配列（行政コードを含む国別の話者数内訳）および `arealContext`（言語同調圏／言語連合の所属）は廃止されました。取り込まれたソースでこれらを言及しているものはなく、出典のないキュレーションは再構築に耐えられないためです。引用可能なソースがパイプラインに導入された日には地域レベルの話者数クレームを復活させることができますが、それまでは「存在しない」ことが誠実な状態です。

### § 4. 文字体系フィールド

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `scripts` | `string[]` | 単一値の `script` を置き換え。確認されている**すべての** ISO 15924 コード（`crk` → `["Cans", "Latn"]`）、順不同 — `scripts[0]` を「唯一の」文字体系として読み取らないでください。主要文字体系はアダプターによって `bcp47FullTag` の最大長タグから導出されます。 |
| `scriptNames` | `string[]` | `scripts[]`（`"Unified Canadian Aboriginal Syllabics"`）に対する Champollion 導出の表示名。 |
| `textDirection` | `string` | `dir` を置き換え。ソース自身の表記 — `"left-to-right"` / `"right-to-left"`（旧 `"ltr"`/`"rtl"`）。 |
| `suppressScript` | `string` | CLDR Suppress-Script：その言語にとって非常に標準的であるため BCP 47 タグで省略される文字体系（`fra` → `"Latn"`）。 |
| `script` | `string` | **ロケールカードのみ**：ロケール向けに解決された文字体系（`fra-CA` → `"Latn"`、`cmn-Hant` → `"Hant"`）。言語カードには単一値の文字体系フィールドは含まれません。 |

文字の使用が確認されていない言語には、単に **`scripts` フィールドが存在しません**。非存在は文字体系を主張するソースがなかったことを意味し、その言語が「文字を持たない」と主張しているわけではありません。（手話言語はこのグループの最大のものであり、日常的な読み書きにおいてコミュニティ標準として採用されている表記体系は存在しません。）

### § 5. 人口統計・活力フィールド

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `speakerEstimates` | envelope | 出典付きの全ソースの推定値。値は正確な数値、またはソース自身の範囲文字列（`"10000-99999"`）の場合があり、ソースの注意事項は `note` にそのまま保持されます。`"agreement": "conflicting"` は一般的です。対立を示すこと*こそが*成果物であり、平均化されたり勝者が選出されたりすることはありません。 |
| `endangerment` | envelope | 単一の `vitality` オブジェクトを置き換え。**各ソース独自のスケールに基づく**全ソースの評価 — 各値は `scale` フィールドを保持し、ELCat、Glottolog AES、LinguaMeta の語彙は相互の翻訳ではないため、`"agreement": "incommensurable"` が標準的です。アダプターは、宣言された優先順位に従って指定された単一のソースから1つの表示用*活力度ティア（vitality tier）*を導出します。そのティアは表示専用であり、出典付きの完全なセットはカード上に残ります。 |

Champollion のどこかで*表示される*話者数は、引用された `speakerEstimates` エントリのいずれかと一致するか、明示的な `champollion-derived` 来歴を保持している必要があります。これはカード整合性ルールによって強制されます。

### § 5.5 ドキュメンテーション・デジタルプレゼンスフィールド

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `documentation` | `object` | `documentationDepth` を置き換え。Glottolog 独自の用語による、言語がどれだけ詳細に記述されているかの Glottolog の記録。 |
| `documentation.medLevel` | `string` | Glottolog の最も包括的な記述レベル（Most Extensive Description レベル）の原文ママ — `"long grammar"`、`"grammar"`、`"grammar sketch"`、`"phonology"`、`"wordlist"`。 |
| `documentation.medSourceId` | `string` | Glottolog の文献目録における、その最も包括的な記述の文献キー。 |
| `documentation.firstDocumented` | `number` | Glottolog 自身の文献初出年の列（原文ママ） — 移行前のトップレベルフィールドからここへ移動。数百の言語にのみ存在し、この疎さ自体が有益な情報です。 |
| `documentation.lastDocumented` | `number` | Glottolog の文献最終年の列（原文ママ） — 約1,000の言語に存在。 |
| `wikipediaEdition` | `object` | `digitalPresence` を置き換え。`{site, url, name}` — この言語のオープンな Wikipedia 版が存在する（`afr` → `af.wikipedia.org`）。意図的に**記事数なし**で、存在のみを記録します。一部の版はほぼボット生成されたものであり、巨大な版だからといって翻訳者が利用可能な意味で「ドキュメントが充実している」とは言えないためです。 |
| `dialectCount` | `number` | Glottolog 自身の `child_dialect_count` 列（原文ママ） — サブツリー全体ではなく、直接の子方言のみ。これは Glottolog の主張であり、私たちの計算ではありません。以前のルールでは `champollion-derived` とマークされ、数千のカードが Glottolog のカウントを自前の成果として扱ってしまっていました。 |

移行前の `digitalPresence` ブロックの残りの項目（Common Voice の音声時間、Tatoeba の例文数）は、それらのソースがパイプラインに導入されるまで廃止されます。Tatoeba コーパス自体は、本来あるべき場所である `resources.corpora`（§ 9）の並列コーパスとしてすでに表示されています。

### § 6. 丁寧さ・レジスター・性別フィールド

射影コーパスは、ここに引用された事実として1つのフィールドのみを保持します。

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `politenessDistinction` | envelope | 二人称形式において言語が待遇表現（politeness）を文法化しているかどうか。Grambank GB415（2値：なし／あり）と WALS 45A（4段階：区別なし／2値／複数／代名詞を回避）の間で出典付けされます。これらは異なるスケールであるため、各値はその `scale` を明記し、エンベロープは不一致としてではなく**比較不能（incommensurable）**として報告します。 |

**位相（レジスター）システムは設定であり、カードの事実ではありません。** 移行前のコーパスでは、約1,800枚のカードそれぞれに `formality` の説明文と `registers` プロンプトが保存されていました。そのほぼすべてが上記の同じ2つのソースから生成され、手作業でキュレーションされた設定であるかのように保持されていました。アトラスは事実を保持し、設定インターフェース — `formality`、`registers`、`gender`、`codeSwitching` — は **npm パッケージのキュレーション済みスキーマ**（`language-card.schema.json`）の一部として残り、キュレーション済みの genus/family ハブカード上に配置され、[継承モデル](#inheritance-model)で説明されているレジスターシステムの `extends` マージを通じて CLI に渡されます。これらは射影されたアトラスフィールドではありません。射影コーパス内のどのカードもこれらを保持しておらず、アトラスのビルドがこれらを書き込むことも決してありません。[優れたレジスタープリセットの作成](#writing-good-register-presets)にあるガイドラインは、そのキュレーションレーンに適用されます。

### § 7. 言語プロファイルフィールド

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `typologicalProfile` | `object` | 取り込まれた類型論的特徴ごとに1つのキーを持ち、各値はソース自体のコーディング、各キーはそのソースがこの言語をコーディングしている場合にのみ存在します。ブール値は Grambank の特徴から、カテゴリ文字列は WALS の章から取得され、判定レジストリ（decision registry）がすべてのキーに対応する正確な上流パラメータを指定します。 |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — 引用された PHOIBLE 目録に基づいて Champollion が計算したカウント（PHOIBLE はセグメントごとに1行を公開し、カウント自体は表明しないため）。したがって、すべての値は `champollion-derived` の来歴を持ちます。**PHOIBLE は声調に関する唯一の権威です**（リント R1）：Grambank には声調の特徴がなく、カード上の他のいかなる項目も声調性を主張することはできません。 |
| `numeralSystem` | `object` | `{base}` — Chan 氏の *Numeral Systems of the World's Languages* からの数詞の底（基数）の原文ママ（`"decimal"`、`"quinary-vigesimal"`、`"body tally"`、約100の異なる値）。Chan 氏の基数列自体が空である場合（調査対象言語の約半数）は省略されます。以前のジェネレーターが空白を `"decimal"` で埋め、2,000の言語について値を捏造してしまっていたためです。 |
| `pluralCategories` | `string[]` | CLDR がこの言語に対して規定している基数詞の複数形カテゴリ — アラビア語は `["zero", "one", "two", "few", "many", "other"]` を区別し、フランス語はそのうち3つ、中国語は1つを区別します。CLDR 独自のルールセットのキーから読み取られるため、私たちの導出ではなく CLDR の主張です。移行前の `rules.plurals.categories` を置き換えました。i18n パイプラインがメッセージにいくつの複数形を提供する必要があるかを知るために必要となります。 |

現在射影されている `typologicalProfile` のキーと、その上流パラメータは以下のとおりです。

- **WALS の章**（カテゴリ文字列、WALS 独自の値ラベル）：`fusion` (20A)、`verbSynthesis` (22A)、`affixPreference` (26A)、`reduplication` (27A)、`genderCount` (30A)、`caseCount` (49A)、`wordOrder` (81A)、`subjectVerbOrder` (82A), `verbalAlignment` (100A)、`negationOrder` (143A)
- **Grambank の特徴**（ブール値）：`hasGenderInPronouns` (GB030)、`hasSexBasedGender` (GB051)、`hasNumeralClassifiers` (GB057)、`hasCoreCase` (GB070)、`hasObliqueCase` (GB072)、`marksPastTense` (GB083)、`marksPresentTense` (GB082)

移行前の `linguisticChallenges` および `contactInfluences` ブロックは射影されません。取り込まれたソースが存在しない調査による説明文は、§ 6 のレジスターインターフェースと同様に、npm パッケージのキュレーション済みスキーマに残ります（後述の[接触による影響の種類](#contact-influence-types)の表はそのレーン向けです）。`rules` ブロックは廃止されました。その中で引用可能だった内容は、ここでの `pluralCategories` および § 4 の文字体系フィールドとして存続しています。

### § 8. 百科事典的フィールド

カードから廃止されました。移行前の `encyclopedic`（歴史や方言に関する解説、関連機関のリンク）、`culturalAphorism`、および `varieties` ブロックは、カード単位の手作業によるキュレーション文章であり、再構築によって設計上削除されます。`varieties` が示唆していた所属に関する事実は、現在では出典付きの識別フィールド（§ 1 `macrolanguageMembers` および `canonicalisedMembers`）となり、変種ごとのツールカバレッジは各メンバー独自のカード（`methodSupport`、`resources`）で回答されます。代表的なことわざなどは、合意と引用を伴うコミュニティ貢献レーンを通じて復活する可能性がありますが、出典のないカードフィールドとして復活することはありません。

### § 9. デジタルリソースフィールド

このセクションのすべての項目は、**存在と能力を表明し、品質は決して表明しません**。つまり、リソースが公開されていることとその公開者のみを示し、それが優れているか、完全か、利用可能か、あるいは測定スコアなどを主張することは決してありません。手法の出力に関する測定スコアは、(method, dataset, metric) をキーとする実行結果であり、リーダーボード上に存在し、カード上では禁止されています（リント R3）。

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `resources` | `object` | コンテナ：以下の各サブフィールドは独立して出典付けされたリストであり、言及するソースがない場合は省略されます。 |
| `resources.fsts` | `object[]` | 公開されている有限状態形態素解析器（FST）：`{name, url, publisher, license, licenceEstablished, archived}`。カタログ全体で均一であると仮定するのではなく、ライセンスは各エントリに付随します。ライセンスの境界には実際の条項が必要です。抱合語（多合成語）においては、FST が唯一存在する構造的チェックであることも少なくありません。 |
| `resources.corpora` | `object[]` | この言語を収録する並列コーパス：`{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`。**ペア**を通じて示されます。並列コーパスはペアを通じてのみ言語を収録するためです。何に対するものかを明示せずに「スワヒリ語をカバーしている」と言っても、誰も求めていない問いに答えることになります。存在と規模のみであり、品質ではありません。 |
| `resources.monolingualCorpora` | `object[]` | 単一言語コーパス — 「コーパスがある」という言葉が比較不能な2つの意味を持たないように、`corpora` とは分けて保持されます。 |
| `resources.speech` | `object[]` | 公開されている音声リソース。存在のみ。 |
| `resources.keyboards` | `object[]` | 公開されているキーボードレイアウト。地味ですが極めて重要です。標準的なレイアウトでは入力できない文字を必要とする正書法にとって、レイアウトの有無はその言語が入力可能か否かの分かれ目となります。 |
| `resources.typology` | `object[]` | この言語を*コード化*している類型論的データセット（範囲付き）：`{dataset, featuresCoded, datasetFeatureTotal}`。存在と範囲のみであり、内容は含みません。特徴が何を述べているかは、それを受け入れるパラメータマップを人間が作成するまでカードには入りません（受け入れられたものは § 7 の `typologicalProfile` に現れます）。特徴のカウントは私たちの計算であるため、`champollion-derived` の来歴を持ちます。 |
| `lexicalResources` | `object` | 語彙の存在に関する事実のコンテナ。 |
| `lexicalResources.datasets` | `object[]` | 公開されている単語リストとそのカバレッジ：`{dataset, forms, concepts, release}`。 |
| `lexicalResources.dictionaries` | `object[]` | 公開されている辞書 — 存在のみで品質ではなく、公開者が方向を定めている場合は**方向性**を持ちます。一方向の辞書は、反対方向の辞書とは異なるリソースです。エントリの形式は一様ではありません（CLDF データセットはエントリ数を保持し、リポジトリはペアと方向を保持します）。それぞれが独自のソースを指定し、ライセンスとアーカイブ状態はエントリごとに付随します。 |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | CLICS³ に基づいて Champollion が計算したカウント：この言語で確認されている概念数、および2つ以上の異なる概念に対応する語形数。`champollion-derived`。 |
| `methodSupport` | `object` | どの翻訳手法がこの言語をサポートしているか — 能力であり、スコアではありません。構造：`{total, byTier, named, truncated}`。英語には数千の手法エッジがあり、中央値となる言語でも20〜30あるため、カードには証拠の*形状*（`total` に加え、信頼度ティア［`fetched`、`partially-confirmed`、`model-card-declared`］ごとの `byTier` カウント）が保持され、上限付きで最も強力なエントリ（各 `{value, variant, source, confidence}`）のみが指定されます。レジストリ**サービス**は上限に関係なく常に完全に記載されるため、`named` にサービスが存在しないことは明確な事実です。モデルカードのエントリが存在しないことは単に「最も強力なものに含まれていない」ことを意味し、すべてのエッジはアトラスストアでクエリ可能です。 |
| `metricModelSupport` | envelope | この言語のカバレッジを公開している評価指標モデルと、ハーネスが読み込むモデル識別子（`masakhane/africomet-mtl`）。実際の動作（COMET モデルの選択）を決定しますが、依然として能力であり、スコアではありません。 |

**上記のフィールドに統合されたもの：** 移行前の `keyboardSupport`（→ `resources.keyboards`）、`corpusAvailability`（→ `resources.corpora` / `resources.monolingualCorpora`）、および `databaseCoverage`（→ `resources.typology` および `lexicalResources` — データベースエントリは、ブール値ではなく範囲付きの引用カバレッジ事実となりました）。

**カードから廃止されたもの：** `omt1600`、`evalDatasets`、`pipelineReadiness`、および `metricPlugins` — いずれも取り込まれたソースによって言及されておらず、レディネスティア（対応準備レベル）は引用ではなく主観的判断であるためです。

**射影ではなくキュレーション対象：** 評価標準の宣言インターフェース（`evalStandard`、`evalMetrics`、`evalPack`）は、npm パッケージのキュレーション済みスキーマに残ります。これらは評価ハーネスに対して、どの外部審判パッケージが言語をスコアリングするかを指示します（競技者ではなく審判であり、ハーネスのコアには言語固有のスコアラーコードは含まれません）。ハーネスは存在する場合にカードからこれらを読み取りますが、現在射影コーパス内のどのカードもこれらを保持しておらず、アトラスビルドがこれらを書き込むこともありません。ハーネスの FST インストーラーが `resources.fsts[]` エントリから読み取る `install` ブロック（`language_cards.py` 内の `get_fst_install_info()`）についても同様です。射影されたエントリは存在に関する事実のみを保持します。

### § 10. 出典フィールド

| フィールド | 構造 | 備考 |
|-------|-------|-------|
| `_fieldSources` | `object` | すべてのカードに存在。カード上のすべてのフィールドパス（`"classification.family"`、`"coordinates.lat"`）を、それを言及したソート済みのソース ID（`["glottolog-v5.3", "wals-v2020.5"]`）に対応付けます。Champollion が計算した値は `champollion-derived-v1` を保持します。ソース ID はバージョン管理されているため（`grambank-v1.0.3`、`iso639-3-20260715`）、すべての主張はそれを行った正確なリリースに遡ることができます。 |
| `coverage` | `object` | すべてのカードに存在し、**ソースによって言及されるのではなくプロジェクターによって計算されます**：`{sourceCount, componentsPresent, componentsTotal, notAttested}` — この言語について言及している個別ソースの数、入力対象となり得る全コンポーネント数のうち値を持つカードコンポーネントの数、およびソースが「*存在しない*」と能動的に記録した値の数（調査した結果「ない」と述べたものであり、未調査とは異なる事実）。これにより、内容の薄いカードが放置されているように見えるのではなく、**なぜ**薄いのかを示すことができます。 |
| `_card` | `object` | カード自体のメタデータ：`{type, id, revision, correctableFields}`。`type` は `"language"` または `"locale"` です（手法カードとコーパスカードも同一のプロジェクターを使用します）。`revision` はコンテンツハッシュであり、カードの内容が変更されると変化します。`correctableFields` は値を保持するフィールドパスをリストします（修正レーンが変更可能なフィールド）。 |
| `_atlas` | `object` | `{version}` — コーパスリリースの刻印（リリース間では `"unreleased"`）。意図的にリリース ID であり、ビルドのタイムスタンプ**ではありません**。タイムスタンプにすると、同一のピン留めからの2つのビルドが日付によって異なってしまい、アトラスを誰でも検証できるという特性（同じピンを入力すれば、バイト単位で同じ出力が得られる）が損なわれるためです。 |

移行前の来歴ブロックは全面的に廃止されました：`dataSources`（フィールドごとの `_fieldSources` マップに置き換え）、`supportTier`（計算された評価判定であり、中立的な `coverage` カウントに置き換え）、`_generated`（コーパス全体が生成されるため、スタンプは `_card.revision` と `_atlas.version` となります）、`humanReviewed` および `notes`（独自の記録を持つレーンに属するキュレーション）、そしてトップレベルの `firstDocumented`/`lastDocumented`（ソースが実際にそれらを言及している § 5.5 の `documentation` へ移動）です。

---

## 言語コードポリシー

Champollion は **ISO 639-3** を標準識別子として使用します。その他の標準コードはエイリアスとして登録され、ランタイムで ISO 639-3 コードに解決されます。

| 優先度 | 標準規格 | 例 | フィールド | 用途 |
|----------|----------|---------|-------|-----|
| 1（正規） | ISO 639-3 | `crk` | `code` | カードファイル名、設定キー、API パラメータ |
| 2（エイリアス） | ISO 639-1 | `iu` | `codeAliases[]` | CLI で受け入れ、ISO 639-3 へ解決 |
| 3（エイリアス） | BCP 47 | `fil` | `codeAliases[]` | CLI で受け入れ、ISO 639-3 へ解決 |
| 参照 | Glottocode | `plai1258` | `glottocode` | 分類のみ、ランタイムでは非使用 |

**解決順序：** ユーザーがコードを指定した場合：
1. `card.code` への直接一致 → 見つかった場合解決
2. `card.codeAliases[]` への一致 → 見つかった場合、正規のカードを返す
3. `card.iso639_1` への一致 → 見つかった場合解決（フォールバック）
4. 見つからない場合 → エラー

### 移行履歴：ISO 639-1 → ISO 639-3

v8 以前は、カードファイル名に ISO 639-1 コードが使用されていました（`fr.json`、`de.json`、`ja.json`）。639-3 への移行では、すべてのカードが ISO 639-3 の対応するコードに名前変更されました：

| 変更前 | 変更後 | 理由 |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3 が標準 |
| `de.json` | `deu.json` | 639-3 が標準 |
| `zh.json` | `cmn.json` | マクロ言語 → デフォルト個別言語 |
| `ar.json` | `arb.json` | マクロ言語 → 現代標準アラビア語 |
| `ms.json` | `zsm.json` | マクロ言語 → 標準マレー語 |

**古いコードはどうなりましたか？**
- 古い 639-1 コードは `card.iso639_1` にあります
- 古い 639-1 コードは `card.codeAliases[]` にあります（`fra` → `["fr"]`）
- 実行時に `resolveCode("fr")` は `"fra"` を返します（後方互換性あり）
- ユーザーは設定に引き続き `"fr"` を記述できます — 透過的に解決されます

**アーキテクチャ上の変更点：**
- `_deepMerge()` は `null` の値をスキップするようになった（親から継承）
- `_deepMerge()` は識別フィールドセットを持つようになった（コード、extends、エイリアスは継承されない）
- `formality.default` はレジスター `isDefault: true` フラグから導出されるようになった
- 205 枚の Grambank 由来のカードが構造的な `formality.default` 修正を受けた
- 38 枚の属/語族/マクロ言語カードが継承ターゲットを提供する

---

## エッジケース

### 手話言語
手話言語（例：ASE — アメリカ手話）は、ISO 639-3 コードを持つ正当な言語です。地理的情報や話者数を持ちますが、以下の特徴があります。
- `modality` は `"signed"` — その言語が何で*ある*かというカードの積極的な表明。書記体系が存在しないことは別の事実です
- `scripts` は通常存在しません（コミュニティ標準として採用されている表記体系が存在しないため）。ただし、ソースが言及している場合は `"Sgnw"`（SignWriting）が表示されます
- `textDirection` は存在しません
- `linguisticChallenges` では空間文法、分類詞などを扱う必要があります

### 古代語・歴史的言語
ラテン語（`lat`、isoLanguageType `"Historical"`）やサンスクリット語（`san`）のような言語は、特定の文脈（典礼、学術）で現在も使用されていますが、母語話者は存在しません。
- `isoLanguageType` は ISO 独自のステータス表記（`"Ancient"`、`"Historical"`、`"Extinct"`）を保持します — カードがこれを和らげたり上書きしたりすることはありません
- `endangerment` および `speakerEstimates` は、引用されたソースが実際に評価した内容を、注意事項も原文ママで報告します（第二言語［L2］コミュニティのカウントは、ソースのラベル付けのまま保持されます）
- `firstDocumented` / `lastDocumented` はそれらを時間軸上に位置付けます

### 人工言語
エスペラント語（`epo`、isoLanguageType `"Constructed"`）、ロジバンなど：
- `classification` は存在しない場合があります — Glottolog は人工言語を非系統的バケットに分類しており、そのバケットが語族として表示されることはありません
- `contactInfluences` は元となった言語素材を反映します（例：エスペラント語はロマンス諸語、ゲルマン諸語、スラヴ諸語を取り入れています）
- `endangerment` は特殊です — 話者コミュニティは成長しているものの、本来の母国／発祥地域は存在しません

### マクロランゲージ
アラビア語（`ara`）、中国語（`zho`）、クリー語（`cre`）、ケチュア語（`que`）は、複数の個別言語を包含するマクロランゲージです。
- `isoScope: "Macrolanguage"` — ナビゲーション用のハブであり、ベンチマーク対象になることはありません
- `macrolanguageMembers` は個々の構成言語コードをリストします。`canonicalisedMembers` は BCP 47 レジストリがマクロランゲージのタグに統合している構成言語を記録します（各レジストリに出典明記）
- `methodSupport` は*マクロランゲージカード*がサポートする内容（通常は標準化された変種）を反映します
- 個々の構成言語は独自のカードを持ち、ハブに戻る `macrolanguage` を保持します

### 標準化された正書法を持たない言語
多くの言語（特に口承言語）には、標準化された表記体系がないか、複数の正書法が競合しています。
- `scripts`、`scriptNames`、および `textDirection` は存在しません — 文字体系を言及するソースが存在しなかったためであり、「文字を持たない」という主張と同じではありません
- `notes` では正書法の状況を説明する必要があります
- `linguisticChallenges` では、これが機械翻訳（MT）にどのように影響するか（訓練データが存在しないなど）を記載する必要があります

### ダイグロシア
アラビア語（現代標準アラビア語 vs. 方言）やグアラニー語（Jopará vs. 純粋なグアラニー語）などの言語：
- `codeSwitching` は混合変種の状況を捉える
- `registers` は異なるレベルのプリセットを提供できる
- `varieties` はダイグロシアのペアを列挙できる

---

## 言語接触の影響タイプ

| タイプ | 意味 | 例 |
|------|---------|---------|
| `superstrate` | コミュニティに押し付けられた支配的言語 | フランス語 → 英語（1066年以降） |
| `substrate` | 押し付けられた言語に影響を与えた母語 | ケルト語 → 英語 |
| `adstrate` | 相互影響を持つ隣接言語 | 古ノルド語 → 英語 |
| `learned_borrowing` | 教育・学術を通じた借用 | ラテン語 → 英語 |
| `lexical_borrowing` | 接触による直接的な語彙借用 | スペイン語 → フィリピン語 |
| `relexification` | 語彙の全面的な置き換え | ポルトガル語 → パピアメント語 |

## 言語接触の影響の深さ

| 深さ | 意味 |
|-------|---------|
| `light` | 少数の借用語、構造的影響は最小限 |
| `moderate` | 特定の領域で大量の語彙 |
| `heavy` | 語彙全体に広がり、一部の構造的特徴も |
| `structural` | 文法、統語、音韻に影響 |
| `defining` | 接触によってコアアイデンティティが形成された（クレオール語、混合言語） |

---

## 良いレジスタープリセットの書き方

**良いプリセットプロンプトの条件：**
- 丁寧さの特徴を明示的に名前で示す（例：「해요체」、「vous 形」、「siz 形」）
- 使用する具体的な代名詞や動詞形を説明する
- このレジスターが適切な場面の文脈を示す
- 該当する場合は文字の考慮事項も記載する

性別包括的なガイダンスはプリセットプロンプトに含めないでください。性別ガイダンスは `card.gender.inclusiveGuidance` に属します — 別途注入されます。

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### プリセット命名規則

プリセットキーは説明的で小文字ハイフン区切りにすべきです：
- T-V 言語：`formal-vous`、`informal-tu`、`formal-Sie`、`casual-du`
- 敬語レベル：`polite-haeyo`、`formal-hapsyo`、`casual-hae`
- 中立：`professional`、`neutral-professional`
- コードスイッチング：`taglish-professional`、`pure-filipino`

---

## カードの事実が更新される仕組み

カードは**ビルド成果物**であり、固定された上流スナップショットからの決定論的射影です。カードごとの個別エンリッチメント手順は現在存在しません。手動で実行していた `enrich-*` スクリプトのレーンは廃止され、カードファイルに対して直接行われた編集は次のビルドによって削除されます。事実を変更するには、次のようにします。

1. **決定事項を登録する。** すべてのフィールドは、ビルドの判定レジストリ（decision registry）における1つの行に対応します。どの上流パラメータがそれを供給するか、どのように射影されるか、そして値の非存在が何を意味するかを定義します。
2. **取り込み層（ingest layer）を修正する。** 誤った値はソースハンドラーの不備（または古くなった上流の固定バージョン）であり、カード上で直接パッチを当てるべきものではありません。
3. **再構築して切り替える。** ビルドは固定されたスナップショットからすべてのカードを再射影します。ゲートチェックにより、不完全なビルド、null/空の値、および整合性ルールに違反するカードは拒絶されます。

### 競合の処理

ソース間で見解が一致しない場合：
1. **出典帰属とともにすべて保存する** — これが帰属エンベロープ（attribution envelope）の目的です
2. **平均化したり特定の立場を選んだりしない** — `consensus` は、ソースが実際に合意している場合にのみ現れます
3. **各ソースの注意事項をその値の `note` に原文ママで保持する**
4. 表示や計算のための単一の値は、宣言された優先順位に基づいて**アダプターによって導出される** — カード自体にはすべての差異が保持されます

---

## バリデーション

再構築後は必ずリンターを実行してください。

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR チェックリスト

カードに関わる変更を提出する際の確認事項（注意：カードではなくビルドを変更すること）：

- [ ] 修正が取り込みハンドラーまたは判定レジストリ内にあること — カードファイルが手作業で編集されていないこと
- [ ] フィールドにはソースによって言及された値のみが含まれていること — カードを「完成」させるために `null` や `[]` で埋められた項目がないこと
- [ ] `classification` が Glottolog から取得されていること（手動構築ではないこと）
- [ ] 変更されたすべてのフィールドの来歴が `_fieldSources` に記録され、Champollion が計算した値には `champollion-derived` の来歴が付与されていること
- [ ] 手法の出力に関する測定スコアがカードのいかなる場所にも現れていないこと
- [ ] リンターおよびカード整合性ゲートがエラーなしで通過すること

---

## 専門的な参考資料

| 標準 | 管理機関 | 当プロジェクトでの用途 |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | 標準言語コード、マクロ言語の関係 |
| [Glottolog](https://glottolog.org) | Max Planck Institute | 分類、座標、AES 危機度 |
| [WALS](https://wals.info) | Max Planck Institute | 属の定義、類型論的特徴 |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | 文字コード |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | ロケールデータ、複数形規則、タイポグラフィ |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | 話者数、自称名、文字データ |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS、話者数推定、DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | 危機度分類 |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | フィリピン語言語カプセル |

詳細な情報源ごとのガイダンスについては、[言語カード引用手順](/docs/reference/language-card-citation-procedure)も参照してください。
