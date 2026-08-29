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

> **信頼できる唯一の情報源 (Single source of truth)。** このドキュメントは、すべての言語カードの正規の形式を定義します。カードは引用元が主張することのみを主張します。どの情報源も主張していないフィールドは**nullではなく省略**されます。フィールドが存在しないことは「どの情報源も言及していない」ことを意味し、「知るべき情報が何もない」ことを意味するわけではありません。機械的にチェック可能なスキーマは、npmパッケージに`shared/schemas/language-card.schema.json`として同梱されており、[以下の正規の例](#canonical-template)はサイトのビルドごとにライブコーパスから生成されるため、このページが記述対象のカードから乖離することはありません。

## 2026年8月のatlas再ビルド — このスキーマでの変更点

カードのコーパスは現在**ビルドの出力結果**となっています。すべてのカードは、固定されたアップストリームのスナップショットのストアから投影され、事実が変更された場合には再ビルドされます（直接編集されることはありません）。この再ビルドに伴い、形式に関して4つの点が変更されました。

1. **見解が分かれるフィールドには帰属エンベロープ (attribution envelope) が含まれます。** 引用元間で純粋に見解が異なる場合、フィールドはフラットな値ではなく、`{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`、`speakerEstimates`、`endangerment`、および新しい情報源によって見解が分かれることになった任意のフィールドとなります。利用者は、フラットな値を前提とするのではなく、公開されているアダプター（npmパッケージの`normalizeCard()`）を介してカードを読み取る必要があります。`display()`はエンベロープを合意された値に解決し、純粋な見解の相違がある場合は勝者を選ぶのではなく、意図的に何も返しません。

2. **名前が変更されたフィールド。** `endonym`が`nativeName`を置き換えました。・`codeAliases`が`aliases`を置き換えました。・`scripts[]`（証明されたすべての文字体系）がフラットな`script`を置き換え、主要な文字体系はカードの最大BCP 47タグから派生するようになりました。・`endangerment`（各情報源独自の尺度に基づく、すべての情報源の評価）が単一の`vitality`オブジェクトを置き換えました。・`isoLanguageType`と`isoScope`は、頭文字ではなくISO 639-3独自の単語（"Living"、"Macrolanguage"）を保持するようになりました。新しいフィールド: `modality`（Glottologの系統から派生した "spoken"/"signed"）、`glottologBucket`（Glottologの非系統的なバケツ分類。familyスロットからは除外）、`locale`/`localeScoped`。

3. **主張されていないフィールドはnullではなく省略されます。** どの情報源も主張していないフィールドはカードに存在しません。以前のルール（「nullであっても、すべてのカードはすべてのトップレベルフィールドを含まなければならない」）は廃止されました。公開されている表面上の空の値は、知るべき情報が何もないという主張として読み取られますが、これは調査していないことと同じではありません。

4. **ロケールカードが存在します。** 言語カードと並んで、ロケールの投影（`fra-CA`、`cmn-Hant`）は、地域や文字体系に合わせて解決されたその言語の事実を保持し、`locale: {language, region, script}`ブロックによって識別されます。ロケールは言語ではありません。そのブロックを使用して、言語のカウントからロケールを除外してください。

## 設計原則

1. **すべてを情報源に基づかせる。** すべての事実の主張は、名前とバージョンが指定された一次情報源に遡ります。情報源のない主張は検証不可能な主張です。`_fieldSources`マップ（およびサブオブジェクト内のフィールドごとの`source`アノテーション）により、出所が明確になります。

2. **見解の相違を保持する。** 権威ある情報源の間で見解が異なる場合（ある情報源は話者数5万人とし、別の情報源は2万人とするなど）、カードは情報源の帰属とともに*両方*を保存します（上記のエンベロープ形式）。平均化したり、解決したり、どちらか一方を選んだりすることはありません。ユーザー自身がそのニュアンスを読み解くことができます。

3. **存在しないことは主張されていないことを意味する。** フィールドが存在しないことは、どの情報源も値を主張していないことを意味します。プロパティが純粋に適用されない場合（文法上の性別を持たない言語の文法上の性別など）、空白にするのではなく、引用された値がその旨を明示的に示します。

4. **再ビルドされ、パッチは当てられない。** カードは、決定論的なビルドによって固定された情報源から投影されます。事実の欠陥はソースハンドラーで修正され、コーパスが再ビルドされます。直接の編集や、マージのみのエンリッチメントレイヤーはありません。

---

## 三層アーキテクチャ

| レイヤー | 場所 | 目的 |
|-------|----------|---------|
| **言語カード** | `shared/language-cards/<code>.json` | 言語ごとの設定：識別情報、分類、リソース、その他すべて |
| **属カード** | `shared/language-cards/genera/<genus>.json` | 関連言語の共有ランタイムプロパティ（手動でキュレーション、自動生成ではない） |
| **言語ツリー** | `shared/language-cards/language-tree.json` | 完全な Glottolog 階層 — Lab UI と言語探索のための参照データ |

---

## 継承モデル

> **atlasの再ビルド以降、大部分が歴史的なものとなっています。** ディスク上の言語カードにはもはや`extends`は含まれていません。継承された文章は引用不可能であったため（語族レベルの主張が言語レベルのアドレスをまとっていたため）、すべてのカードはビルドによって完全に実体化されます。このメカニズム自体は1箇所だけ残っています。npmパッケージのオフラインバンドルは、ロケールカードをその言語に対するコンパクトな`extends`の差分として同梱しており、ここで説明されているのと同じマージによって解決されます。

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

> **記述されたものではなく、生成されたものです。** このセクションのすべては、ビルド時にライブコーパスから派生しています。完全な`crk` (Plains Cree) カード（バイト単位で同一）と、`fra-CA`ロケールの抜粋です。コーパスが再ビルドされると、次のサイトビルドでこのページが再派生します。古くなるような手動で保守されるテンプレートは残っていません。以前のテンプレートはカードからスキーマ1世代分遅れて乖離したため、2026年8月16日に廃止されました。

この例は**ディスク上の形式**、つまりファイルを開いたときに得られるものを示しています。利用者は引き続き、公開されているアダプター（npmパッケージの`normalizeCard()`）を介してカードを読み取る必要があります。これにより、エンベロープが解決され、移行前の名前が橋渡しされ、生のカードが意図的に保持していない表示専用の値（主要な文字体系、活力層）が派生します。

読む際の注意点:

1. **帰属エンベロープ。** `name`、`classification.family`、`endangerment`、`speakerEstimates`、`endonym`、`bcp47FullTag`、および`politenessDistinction`はそれぞれ`{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment`を保持し、`"agreement": "incommensurable"`を持っています。その情報源は異なる尺度で評価するため、勝者の尺度に変換されるのではなく、各値が自身の`scale`を指定します。

2. **省略は主張されていないことを意味する。** このカードには`iso639_1`（Plains CreeにはISO 639-1コードがありません）も`phonologicalInventory`（取り込まれた情報源のいずれも主張していません）もありません。これらのフィールドは単に存在しないだけであり、決して`null`や`[]`にはなりません。

3. **出所はファーストクラスのレイヤーである。** `_fieldSources`は、すべてのフィールドをそれを主張した情報源にマッピングし、`champollion-derived-v1`はChampollionが計算した値をマークします。`_card`は、カードのタイプ、ID、リビジョン、および修正レーンが触れる可能性のあるフィールドをスタンプします。`_atlas`はコーパスのリリースをスタンプします。

4. **実行結果を含まない。** カード上のいかなる情報も、メソッド出力の測定スコアではありません。chrF、FSTの受容率、およびそれらの同類は、(メソッド、データセット、メトリクス) をキーとする実行結果であり、リーダーボード上に存在します。カードはリソースが*存在する*ことのみを主張します（`resources`、`lexicalResources`、`methodSupport`）。

<CardSpecExample variant="language" />

### ロケールカードは投影であり、言語ではない \{#locale-card-example}

言語カードの横にはロケールカード（`fra-CA`、`cmn-Hant`）があります。これは、**地域や文字体系に合わせて解決された**言語の事実であり、コードの形式ではなく、`locale`ブロックによって識別されます。ロケールカードはその言語の事実を継承し、文字体系や地域のスコープを持つもの（`script`、`localeScoped`）を解決しますが、**言語ではありません**。その`locale`ブロックを使用して、すべての言語のカウントや言語ごとのリストからロケールカードを除外してください。

<CardSpecExample variant="locale" />

---

## フィールドリファレンス \{#field-reference}

以下のすべての表には、2つの規則が適用されます。

- **"envelope"** は帰属エンベロープ（`{agreement, consensus?, values: [{value, source, note?, scale?}]}`）を意味し、*すべて*の情報源の主張を保持します。`envelope`としてリストされているフィールドは、1つの情報源のみが言及しているカードではフラットな値として表示される場合があります（たとえば、Glottologのみのlanguoidはフラットな`name`を保持します）。利用者は両方を処理する必要があり、公開されているアダプターはこれを行います。
- `code`と`name`以外に必須のフィールドはありません。それ以外のすべては、**どの情報源も主張していない場合は省略されます**。各フィールドを主張する情報源はカードごとに`_fieldSources`に記録されるため、表では乖離する可能性のあるバージョンを固定するのではなく、情報源の*種類*を説明しています。

### § 1. 識別フィールド

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `code` | `string` | **必須。** カードIDとファイル名。言語カードの場合はISO 639-3（`crk`）。Glottologのみのlanguoidはglottocodeを保持します。ロケールカードはロケールコード（`fra-CA`）を保持します。 |
| `name` | envelope | **必須。** 英語の参照名（ISO 639-3レジストリ、LinguaMeta、Glottolog）。 |
| `endonym` | envelope | `nativeName`を置き換えました。話者がその言語でその言語を何と呼ぶか（LinguaMeta、Wikidata）。どの情報源も主張していない場合は存在しません。私たちがエンドニム（自称）を発明したり音訳したりすることは決してありません。 |
| `alternateNames` | `string[]` | 証明されているその他の英語名。 |
| `iso639_1` | `string` | 2文字のISO 639-1コードが存在する場合にのみ存在します（`fra` → `"fr"`）。 |
| `isoScope` | `string` | ISO 639-3独自の単語 — `"Individual"`、`"Macrolanguage"`、`"Special"`（`"I"`/`"M"`/`"S"`の頭文字を置き換えました）。 |
| `isoLanguageType` | `string` | `isoType`を置き換えました。ISO 639-3独自の単語 — `"Living"`、`"Extinct"`、`"Ancient"`、`"Historical"`、`"Constructed"`。 |
| `macrolanguage` | `string` | この言語が属するマクロランゲージ（`crk` → `"cre"`）。ISO 639-3のマクロランゲージマッピング。 |
| `macrolanguageMembers` | `string[]` | マクロランゲージのハブカードの場合: 個々のメンバーコード（`nor` → `["nno", "nob"]`）。 |
| `canonicalisedMembers` | envelope | マクロランゲージカードの場合: BCP 47レジストリがこのマクロランゲージのタグに折りたたむメンバーのタグ（CLDRエイリアステーブル + SIL langtags、それぞれ帰属が示されます）。 |
| `supersededCodes` | `string[]` | SILが現在この言語にリダイレクトしている廃止されたISO 639-3コード。古いコードで公開されたコーパスが引き続き解決されるように、後継の言語に記録されます。 |
| `codeAliases` | `string[]` | `aliases`を置き換えました。このカードに解決されるコードレベルの識別子。 |
| `bcp47` | `string` | 主張されている言語のBCP 47タグ（LinguaMeta）。 |
| `bcp47Tag` | envelope | Champollionから派生: RFC 5646タグ（最短のISO 639コードが優先されます）。 |
| `bcp47FullTag` | envelope | 最大の言語-文字体系-地域形式（CLDR likelySubtags + SIL langtags）。アダプターはこのタグから**主要な文字体系**を派生させます。 |
| `modality` | `string` | `"spoken"`または`"signed"`。Glottologの系統から派生。書記は正書法の属性であり、モダリティではありません。文字を持たない言語であっても、完全に音声言語または手話言語です。 |
| `locale` | `object` | **ロケールカードのみ。** `{language, region, script, publishedTag, source, note}` — ロケールのアイデンティティ。コードの形式ではなく、このブロックによって言語のカウントからロケールカードを除外してください。 |
| `localeScoped` | `object` | ロケールカードのみ: ロケールの地域/文字体系に合わせて解決された値（例: `scriptName`、`cldrOfficialStatus`）。 |

### § 2. 分類フィールド

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `glottocode` | `string` | このlanguoidに対するGlottologの識別子（`crk` → `"plai1258"`）。Glottologのみのlanguoid（ISO 639-3にはなくGlottologが記録している言語）は、カードの`code`としてglottocodeを使用します。 |
| `classification` | `object` | 以下の配置フィールドのコンテナ。それぞれが独立して情報源を持ち、独立して省略されます。孤立言語、またはGlottologのバケツ分類に分類される言語は、正当にこのオブジェクトの一部のみを保持します。 |
| `classification.family` | envelope | 各分類機関が主張するトップレベルの語族。GlottologとWALSは常に一致するとは限らない別々の分類体系であるため、両方が保持され、帰属が示されます。LintルールR5は、エンベロープ内のGlottologの値をGlottolog自身のツリーと照合してチェックします。WALSがGlottologと一致しないことはありますが、Glottologが誤って引用されることはありません。孤立言語は語族をまったく持ちません。 |
| `classification.familyGlottocode` | `string` | そのトップレベルの語族のGlottocode（`crk` → `"algi1248"`）。 |
| `classification.genus` | `string` | WALSの中間分類ノード（`crk` → `"Algonquian"`）。WALSの概念であり、Glottologの概念では**ありません**（Glottologはgenusレベルのない任意の深さのツリーを公開しています）。そのため、WALSがその言語をコーディングしている場合にのみ存在します。 |
| `classification.ancestry` | `string[]` | 祖先のglottocodeとしてのGlottologの系統パス、ルートが先頭（`["algi1248", …, "plai1264"]`）。順序**こそ**が主張です。これはパスであり、アルファベット順のセットではありません。 |
| `classification.glottologBucket` | `string` | Glottologの非系統的なバケツ分類 — `"Artificial Language"`、`"Pidgin"`、`"Mixed Language"`、`"Speech Register"`、`"Unclassifiable"`、`"Unattested"`。バケツ分類は系統ではなく種類によって分類するため、familyスロットからは除外されます。バケツ分類を持つカードには語族がなく、それが誠実な結果です。 |
| `isIsolate` | `boolean` | Glottologがこの言語を孤立言語として分類しているかどうか。 |

移行前のカードには`genusGlottocode`も含まれていました。これは、それを生み出したカテゴリーエラーとともに廃止されました。genusはWALSの概念であり、それをGlottologの識別子で装うことは、Glottologが持っていないツリーノードを主張することになっていました。Glottologの階層は、代わりに`ancestry`によって保持されます。

### § 3. 地理フィールド

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `macroarea` | `string` | Glottologのマクロエリア — `"Africa"`、`"Australia"`、`"Eurasia"`、`"North America"`、`"Papunesia"`または`"South America"`。 |
| `coordinates` | `object` | `{lat, lng}` — Glottologの代表点。地域ではなく点です。言語を地図上に配置するものであり、範囲や境界については何も主張しません。 |
| `countries` | `string[]` | Glottologがその言語に関連付ける国のISO 3166-1 alpha-2コード（`["CA", "US"]`）。 |
| `cldrOfficialStatus` | `string` | CLDRが記録している（LinguaMeta経経由で保持される）、一部の地域がその言語に付与している公式ステータス — `"Official"`、`"Regional official"`。ロケールカードでは、*そのロケールの*地域に合わせて解決されたステータスが`localeScoped.cldrOfficialStatus`に配置されます。 |

移行前の`regions`配列（管理コード付きの国別の話者内訳）と`arealContext`（言語連合のメンバーシップ）は廃止されました。取り込まれた情報源のいずれもこれらを主張しておらず、情報源のないキュレーションは再ビルドを生き残れないためです。地域レベルの話者の主張は、引用可能な情報源がパイプラインに導入された日に復活する可能性があります。それまでは、存在しないことが誠実な状態です。

### § 4. 文字体系フィールド

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `scripts` | `string[]` | フラットな`script`を置き換えました。証明された**すべて**のISO 15924コード（`crk` → `["Cans", "Latn"]`）、順不同です。`scripts[0]`を「唯一の」文字体系として読み取らないでください。主要な文字体系は、アダプターによって`bcp47FullTag`の最大タグから派生します。 |
| `scriptNames` | `string[]` | `scripts[]`に対するChampollionから派生した表示名（`"Unified Canadian Aboriginal Syllabics"`）。 |
| `textDirection` | `string` | `dir`を置き換えました。情報源独自の単語 — `"left-to-right"` / `"right-to-left"`（以前は`"ltr"`/`"rtl"`）。 |
| `suppressScript` | `string` | CLDR Suppress-Script: その言語にとって非常に標準的であるため、BCP 47タグでは省略される文字体系（`fra` → `"Latn"`）。 |
| `script` | `string` | **ロケールカードのみ**: ロケールで解決された文字体系（`fra-CA` → `"Latn"`、`cmn-Hant` → `"Hant"`）。言語カードにはフラットなscriptフィールドはありません。 |

証明された書記を持たない言語には、単に**`scripts`フィールドがありません**。存在しないことは、どの情報源も文字体系を主張しなかったことを意味し、その言語が「文字を持たない」という主張ではありません。（手話言語はそのようなグループの中で最大のものであり、日常的な読み書きのためにコミュニティ標準として採用されている表記体系はありません。）

### § 5. 人口統計・活力フィールド

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `speakerEstimates` | envelope | 帰属が示された、すべての情報源の推定値。値は正確な数、または情報源独自の範囲文字列（`"10000-99999"`）の場合があり、情報源の注意事項は`note`にそのまま保持されます。`"agreement": "conflicting"`は一般的です。対立を示すこと*こそ*が成果物であり、平均化されたり選出されたりするものはありません。 |
| `endangerment` | envelope | 単一の`vitality`オブジェクトを置き換えました。**各情報源独自の尺度に基づく**、すべての情報源の評価。各値は`scale`フィールドを保持し、ELCat、Glottolog AES、およびLinguaMetaの語彙は互いの翻訳ではないため、`"agreement": "incommensurable"`が標準となります。アダプターは、宣言された権威の順序に従って、単一の指定された情報源から1つの表示用*活力層 (vitality tier)* を派生させます。その層は表示専用であり、帰属が示された完全なセットはカード上に残ります。 |

Champollionのどこかに*表示される*話者数は、引用された`speakerEstimates`エントリのいずれかと一致するか、明示的な`champollion-derived`の出所を保持していなければなりません。これはカードの整合性ルールによって強制されます。

### § 5.5 ドキュメンテーション・デジタルプレゼンスフィールド

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `documentation` | `object` | `documentationDepth`を置き換えました。その言語がどの程度よく記述されているかに関する、Glottolog独自の用語によるGlottologの記録。 |
| `documentation.medLevel` | `string` | GlottologのMost Extensive Description（最も広範な記述）レベル、そのまま — `"long grammar"`、`"grammar"`、`"grammar sketch"`、`"phonology"`、`"wordlist"`。 |
| `documentation.medSourceId` | `string` | Glottologの参照カタログにおける、その最も広範な記述の書誌キー。 |
| `documentation.firstDocumented` | `number` | Glottolog独自のfirst-year-of-documentation（最初の文書化の年）列、そのまま。移行前のトップレベルフィールドからここに移動しました。数百の言語にのみ存在し、そのまばらさ自体が知る価値のあるものです。 |
| `documentation.lastDocumented` | `number` | Glottologのlast-year-of-documentation（最後の文書化の年）列、そのまま。約1,000の言語に存在します。 |
| `wikipediaEdition` | `object` | `digitalPresence`を置き換えました。`{site, url, name}` — この言語でオープンなWikipediaエディションが存在します（`afr` → `af.wikipedia.org`）。存在のみであり、意図的に**記事数を含みません**。いくつかのエディションは大部分がボットによって生成されており、巨大なエディションが小さなエディションよりも翻訳者が利用できる意味で「よりよく文書化されている」わけではないためです。 |
| `dialectCount` | `number` | Glottolog独自の`child_dialect_count`列、そのまま。サブツリー全体ではなく、直接の子方言のみです。これはGlottologの主張であり、私たちの計算ではありません。以前のルールではこれに`champollion-derived`をスタンプし、何千ものカードがGlottologのカウントを自分たちの手柄にしていました。 |

移行前の`digitalPresence`ブロックの残り（Common Voiceの時間数、Tatoebaの文数）は、それらの情報源がパイプラインに導入されるまで廃止されます。Tatoebaコーパス自体は、`resources.corpora`（§ 9）の下のパラレルコーパスとして、すでに適切な場所に表示されています。

### § 6. 丁寧さ・レジスター・性別フィールド

投影されたコーパスは、ここに正確に1つのフィールド（引用された事実）を保持します。

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `politenessDistinction` | envelope | 言語が二人称形式で丁寧さを文法化しているかどうか。Grambank GB415（バイナリ: なし/あり）とWALS 45A（4レベル: 区別なし / バイナリ / 複数 / 代名詞の回避）にわたって帰属が示されます。これらは異なる尺度であるため、各値は自身の`scale`を指定し、エンベロープはそれらを見解の相違としてではなく、**比較不能 (incommensurable)** として報告します。 |

**レジスターシステムは設定であり、カードの事実ではありません。** 移行前のコーパスは、`formality`の文章と`registers`のプロンプトをそれぞれ約1,800枚のカードに保存していました。そのほとんどすべてが上記の同じ2つの情報源から生成され、手動でキュレーションされた設定であるかのように保持されていました。atlasは事実を保持します。設定の表面（`formality`、`registers`、`gender`、`codeSwitching`）は、**npmパッケージのキュレーションされたスキーマ**（`language-card.schema.json`）の一部として残り、キュレーションされたgenus/familyのハブカード上に存在し、[継承モデル](#inheritance-model)で説明されているレジスターシステムの`extends`マージを通じてCLIに到達します。これらは投影されたatlasのフィールドではありません。投影されたコーパス内のどのカードもこれらを保持しておらず、atlasのビルドがこれらを書き込むことは決してありません。[優れたレジスタープリセットの記述](#writing-good-register-presets)のガイダンスは、そのキュレーションされたレーンに適用されます。

### § 7. 言語プロファイルフィールド

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `typologicalProfile` | `object` | 取り込まれた類型論的特徴ごとに1つのキー。各値は情報源独自のコーディングであり、各キーは情報源がこの言語をコーディングしている場合にのみ存在します。ブール値はGrambankの特徴から、カテゴリストリングはWALSの章から取得されます。決定レジストリは、すべてのキーの正確なアップストリームパラメータを指定します。 |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — 引用されたPHOIBLEインベントリに対してChampollionが計算したカウント（PHOIBLEはセグメントごとに1行を公開し、カウントを主張しません）。そのため、すべての値は`champollion-derived`の出所を保持します。**PHOIBLEは声調に関する唯一の権威です**（lint R1）。Grambankには声調の特徴はなく、カード上の他のいかなるものも声調を主張することはできません。 |
| `numeralSystem` | `object` | `{base}` — 記数法の底 (numeral base)。Chanの *Numeral Systems of the World's Languages* からそのまま引用（`"decimal"`、`"quinary-vigesimal"`、`"body tally"`。約100の異なる値）。Chan自身のbase列が空の場合（調査対象言語の約半数）は存在しません。以前のジェネレーターが空白を`"decimal"`で埋め、2,000の言語に対して値を発明したためです。 |
| `pluralCategories` | `string[]` | CLDRがこの言語について規定している基数の複数形カテゴリ。アラビア語は`["zero", "one", "two", "few", "many", "other"]`を区別し、フランス語は3つ、中国語は1つを区別します。CLDR自身のルールセットのキーから読み取られるため、これはCLDRの主張であり、私たちの派生ではありません。移行前の`rules.plurals.categories`を置き換えました。i18nパイプラインは、メッセージが提供しなければならない複数形の数を知るためにこれを必要とします。 |

現在投影されている`typologicalProfile`キーと、そのアップストリームパラメータ:

- **WALSの章** (カテゴリストリング、WALS自身の値ラベル): `fusion` (20A)、`verbSynthesis` (22A)、`affixPreference` (26A)、`reduplication` (27A)、`genderCount` (30A)、`caseCount` (49A)、`wordOrder` (81A)、`subjectVerbOrder` (82A)、`verbalAlignment` (100A)、`negationOrder` (143A)
- **Grambankの特徴** (ブール値): `hasGenderInPronouns` (GB030)、`hasSexBasedGender` (GB051)、`hasNumeralClassifiers` (GB057)、`hasCoreCase` (GB070)、`hasObliqueCase` (GB071)、`marksPastTense` (GB083)、`marksPresentTense` (GB084)

移行前の`linguisticChallenges`および`contactInfluences`ブロックは投影されません。取り込まれた情報源のない調査済みの文章は、§ 6のレジスターの表面と同様に、npmパッケージのキュレーションされたスキーマに残ります（以下の[接触影響タイプ](#contact-influence-types)の表がそのレーンに役立ちます）。`rules`ブロックは廃止されました。その中で引用可能であったものは、ここの`pluralCategories`および§ 4のscriptフィールドとして存続しています。

### § 8. 百科事典的フィールド

カードから廃止されました。移行前の`encyclopedic`（歴史や方言に関するエッセイ、機関へのリンク）、`culturalAphorism`、および`varieties`ブロックは、カード単位で手動でキュレーションされた文章であり、再ビルドによって意図的に削除されます。`varieties`が示唆していたメンバーシップの事実は、現在では引用されたアイデンティティフィールド（§ 1の`macrolanguageMembers`および`canonicalisedMembers`）となっており、変種ごとのツールのカバレッジは各メンバー自身のカード（`methodSupport`、`resources`）によって回答されます。代表的なことわざは、同意と引用を伴うコミュニティ貢献レーンを通じて復活する可能性がありますが、引用のないカードフィールドとして復活することはありません。

### § 9. デジタルリソースフィールド

このセクションのすべては、**存在と機能性を主張するものであり、品質を主張するものではありません**。リソースが公開されていること、および誰が公開しているかを示すものであり、それが優れている、完全である、または使用可能であることを示すものではなく、測定されたスコアでもありません。メソッド出力の測定スコアは、(メソッド、データセット、メトリクス) をキーとする実行結果であり、リーダーボード上に存在し、カード上では禁止されています（lint R3）。

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `resources` | `object` | コンテナ: 以下の各サブフィールドは独立して情報源を持つリストであり、どの情報源も主張していない場合は省略されます。 |
| `resources.fsts` | `object[]` | 公開されている有限状態形態素解析器: `{name, url, publisher, license, licenceEstablished, archived}`。ライセンスはカタログ全体で一律であると想定されるのではなく、各エントリに付随します。ライセンスの境界には実際の条件が必要です。抱合語の場合、FSTが唯一存在する構造チェックであることもしばしばあります。 |
| `resources.corpora` | `object[]` | この言語を証明するパラレルコーパス: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`。**ペア**を通じて記述されます。パラレルコーパスはペアを通じてのみ言語を証明するためです。何に対するものかを言わずに「スワヒリ語をカバーしている」と言うのは、誰も尋ねていない質問に答えるようなものです。存在とサイズのみであり、品質ではありません。 |
| `resources.monolingualCorpora` | `object[]` | モノリンガルコーパス — `corpora`とは区別して保持されるため、「コーパスがある」という言葉が比較不能な2つの意味を持つことは決してありません。 |
| `resources.speech` | `object[]` | 公開されている音声リソース。存在のみ。 |
| `resources.keyboards` | `object[]` | 公開されているキーボードレイアウト。地味ですが重要です。標準のレイアウトでは生成できない文字を必要とする正書法の場合、レイアウトの有無がその言語を入力できるかどうかの違いになります。 |
| `resources.typology` | `object[]` | この言語を*コーディング*している類型論的データセットとその範囲: `{dataset, featuresCoded, datasetFeatureTotal}`。存在と範囲のみであり、内容ではありません。特徴が何を示しているかは、それを受け入れるパラメータマップを人が記述するまでカードには表示されません（受け入れられたものは§ 7の`typologicalProfile`に表示されます）。特徴のカウントは私たちの計算であるため、`champollion-derived`の出所を保持します。 |
| `lexicalResources` | `object` | 語彙の存在の事実に関するコンテナ。 |
| `lexicalResources.datasets` | `object[]` | 公開されている単語リストとそのカバレッジ: `{dataset, forms, concepts, release}`。 |
| `lexicalResources.dictionaries` | `object[]` | 公開されている辞書 — 存在のみであり、品質ではありません。また、発行者が指定する方向に**方向付け**られています。ある方向に向かう辞書は、別の方向に向かう辞書とは異なるリソースです。エントリの形式は一律ではありません（CLDFデータセットはエントリ数を知っており、リポジトリはペアと方向を知っています）。それぞれが自身の情報源を指定し、ライセンスとアーカイブ状態はエントリごとに付随します。 |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | CLICS³に対してChampollionが計算したカウント: この言語で証明されている概念、および2つ以上の異なる概念にマッピングされる形式。`champollion-derived`。 |
| `methodSupport` | `object` | どの翻訳メソッドがこの言語をカバーしているか — 機能性であり、スコアではありません。形式: `{total, byTier, named, truncated}`。英語は何千ものメソッドエッジを持ち、中央値の言語は数十個であるため、カードは証拠の*形式*（`total`と信頼度層ごとの`byTier`カウント（`fetched`、`partially-confirmed`、`model-card-declared`））を保持し、最も強力なエントリ（各`{value, variant, source, confidence}`）のみを上限付きで指定します。レジストリの**サービス**は常に上限を超えて完全に指定されるため、`named`にサービスが存在しないことは実際の回答となります。モデルカードのエントリが存在しないことは「最も強力なものの中にない」ことのみを意味し、すべてのエッジはatlasストアでクエリ可能なままです。 |
| `metricModelSupport` | envelope | この言語のカバレッジを公開している評価メトリクスモデルと、ハーネスがロードするモデル識別子（`masakhane/africomet-mtl`）。実際の動作（COMETモデルの選択）を促進し、これも機能性であり、スコアではありません。 |

**上記のフィールドに統合されました:** 移行前の`keyboardSupport`（→ `resources.keyboards`）、`corpusAvailability`（→ `resources.corpora` / `resources.monolingualCorpora`）、および`databaseCoverage`（→ `resources.typology`と`lexicalResources` — データベースエントリはブール値ではなく、範囲を伴う引用されたカバレッジの事実になりました）。

**カードから廃止されました:** `omt1600`、`evalDatasets`、`pipelineReadiness`、および`metricPlugins` — いずれも取り込まれた情報源によって主張されておらず、準備層 (readiness tier) は判断であり、引用ではありません。

**投影ではなく、キュレーションされたもの:** 評価標準の宣言の表面（`evalStandard`、`evalMetrics`、`evalPack`）は、npmパッケージのキュレーションされたスキーマに残ります。これらは、どの外部のレフェリーパッケージが言語をスコアリングするかを評価ハーネスに伝えます（コンテスタントではなくレフェリーです。ハーネスのコアには言語固有のスコアラーコードは同梱されていません）。ハーネスは存在する場合にカードからこれらを読み取りますが、現在投影されているコーパス内のどのカードもこれらを保持しておらず、atlasのビルドがこれらを書き込むことはありません。ハーネスのFSTインストーラーが`resources.fsts[]`エントリ（`language_cards.py`内の`get_fst_install_info()`）から読み取る`install`ブロックについても同様です。投影されたエントリは存在の事実のみを保持します。

### § 10. 出典フィールド

| フィールド | 形式 | 備考 |
|-------|-------|-------|
| `_fieldSources` | `object` | すべてのカードに存在します。カード上のすべてのフィールドパス（`"classification.family"`、`"coordinates.lat"`）を、それを主張したソート済みの情報源ID（`["glottolog-v5.3", "wals-v2020.5"]`）にマッピングします。Champollionが計算した値は`champollion-derived-v1`を保持します。情報源IDはバージョン管理されているため（`grambank-v1.0.3`、`iso639-3-20260715`）、すべての主張はそれを行った正確なリリースに遡ることができます。 |
| `coverage` | `object` | すべてのカードに存在し、**どの情報源によっても主張されておらず、プロジェクターによって計算されます**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — いくつの異なる情報源がこの言語について言及しているか、入力可能なコンポーネントのうちいくつのカードコンポーネントが値を保持しているか、そして情報源が肯定的に*存在しない*と記録した値がいくつあるか（調査して「ない」と答えたものであり、調査しなかったこととは異なる事実です）。これにより、情報が少ないカードが放置されているように見えるのではなく、**なぜ**情報が少ないのかを示すことができます。 |
| `_card` | `object` | カード自身のメタデータ: `{type, id, revision, correctableFields}`。`type`は`"language"`または`"locale"`です（メソッドカードとコーパスカードは同じプロジェクターに乗ります）。`revision`はコンテンツハッシュであるため、カードのコンテンツが変更されるとこれも変更されます。`correctableFields`は値を保持するフィールドパス（修正レーンが触れる可能性のあるフィールド）をリストします。 |
| `_atlas` | `object` | `{version}` — コーパスのリリーススタンプ（リリース間は`"unreleased"`）。意図的にビルドのタイムスタンプでは**なく**、リリースIDとしています。タイムスタンプを使用すると、同一のピンからの2つのビルドがカレンダーによって異なるものになり、誰もがatlasをチェックできるという特性（同じピンを入力すれば同じバイトが出力される）が損なわれるためです。 |

移行前の出所ブロックは全面的に廃止されました。`dataSources`（フィールドごとの`_fieldSources`マップに置き換えられました）、`supportTier`（計算された判断であり、中立的な`coverage`カウントに置き換えられました）、`_generated`（コーパス全体が生成されます。スタンプは`_card.revision`と`_atlas.version`です）、`humanReviewed`および`notes`（独自の記録を持つレーンに属するキュレーション）、およびトップレベルの`firstDocumented`/`lastDocumented`（情報源が実際にそれらを主張している§ 5.5の`documentation`に移動しました）。

---

## 言語コードポリシー

Champollion は **ISO 639-3** を標準識別子として使用します。その他の標準コードはエイリアスとして登録され、ランタイムで ISO 639-3 コードに解決されます。

| 優先度 | 標準 | 例 | フィールド | 用途 |
|----------|----------|---------|-------|-----|
| 1 (正規) | ISO 639-3 | `crk` | `code` | カードファイル名、設定キー、APIパラメータ |
| 2 (エイリアス) | ISO 639-1 | `iu` | `codeAliases[]` | CLIで受け入れられ、ISO 639-3に解決される |
| 3 (エイリアス) | BCP 47 | `fil` | `codeAliases[]` | CLIで受け入れられ、ISO 639-3に解決される |
| 参照 | Glottocode | `plai1258` | `glottocode` | 分類のみ、ランタイム用ではない |

**解決順序:** ユーザーがコードを提供した場合:
1. `card.code`での直接一致 → 見つかった
2. `card.codeAliases[]`での一致 → 見つかった、正規のカードを返す
3. `card.iso639_1`での一致 → 見つかった (フォールバック)
4. 見つからない → エラー

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
- 古い639-1コードは`card.iso639_1`にあります
- 古い639-1コードは`card.codeAliases[]`にあります（`fra` → `["fr"]`）
- `resolveCode("fr")`はランタイム時に`"fra"`を返します — 下位互換性があります
- ユーザーは引き続き設定に`"fr"`を記述できます — 透過的に解決されます

**アーキテクチャ上の変更点：**
- `_deepMerge()` は `null` の値をスキップするようになった（親から継承）
- `_deepMerge()` は識別フィールドセットを持つようになった（コード、extends、エイリアスは継承されない）
- `formality.default` はレジスター `isDefault: true` フラグから導出されるようになった
- 205 枚の Grambank 由来のカードが構造的な `formality.default` 修正を受けた
- 38 枚の属/語族/マクロ言語カードが継承ターゲットを提供する

---

## エッジケース

### 手話言語
手話言語（例: ASE — アメリカ手話）は、ISO 639-3コードを持つ正当な言語です。地理的情報や話者数を持ちますが、以下の点に注意してください。
- `modality`は`"signed"`です。これは、その言語が何で*あるか*というカードの肯定的な主張です。書記体系が存在しないことは別の事実です。
- `scripts`は通常存在しません（コミュニティ標準として採用されている表記体系はありません）が、情報源が主張している場合は`"Sgnw"` (SignWriting) が表示されます。
- `textDirection`は存在しません。
- `linguisticChallenges`は、空間文法、類別詞などに対処する必要があります。

### 古代言語および歴史的言語
ラテン語（`lat`、isoLanguageType `"Historical"`）やサンスクリット語（`san`）などの言語は、特定のコンテキスト（典礼、学術）で現在も使用されていますが、母語話者はいません。
- `isoLanguageType`はISO独自のステータスワード（`"Ancient"`、`"Historical"`、`"Extinct"`）を保持します。カードがこれを和らげたり上書きしたりすることはありません。
- `endangerment`と`speakerEstimates`は、引用された情報源が実際に評価したものを報告し、注意事項はそのまま記載されます（L2コミュニティのカウントは、情報源がラベル付けしたとおりにラベル付けされたままになります）。
- `firstDocumented` / `lastDocumented`は、それらを時間的に位置付けます。

### 人工言語
エスペラント（`epo`、isoLanguageType `"Constructed"`）、ロジバンなど:
- `classification`は存在しない場合があります。Glottologは人工言語を非系統的なバケツ分類に分類しており、そのバケツ分類が語族として表示されることはありません。
- `contactInfluences`はソース資料を反映します（例: エスペラントはロマンス語、ゲルマン語、スラブ語から派生しています）。
- `endangerment`は特殊です。話者コミュニティは成長していますが、母国となる地域はありません。

### マクロランゲージ
アラビア語（`ara`）、中国語（`zho`）、クリー語（`cre`）、ケチュア語（`que`）は、複数の個別の言語を包含するマクロランゲージです。
- `isoScope: "Macrolanguage"` — ナビゲーションハブであり、ベンチマークのターゲットになることはありません。
- `macrolanguageMembers`は個々のメンバーコードをリストします。`canonicalisedMembers`は、BCP 47レジストリがどのメンバーをマクロランゲージのタグに折りたたむかを記録します（各レジストリの帰属が示されます）。
- `methodSupport`は、*マクロランゲージカード*がサポートするもの（通常は標準化された変種）を反映します。
- 個々のメンバーは独自のカードを持ち、ハブに戻る`macrolanguage`を保持します。

### 標準化された正書法を持たない言語
多くの言語（特に口承伝統の言語）には、標準化された書記体系がないか、競合する正書法があります。
- `scripts`、`scriptNames`、および`textDirection`は存在しません。どの情報源も文字体系を主張しなかったためであり、これは「文字を持たない」という主張と同じではありません。
- `notes`は正書法の状況を説明する必要があります。
- `linguisticChallenges`は、これが機械翻訳 (MT) にどのように影響するか（例: トレーニングデータがないなど）を記載する必要があります。

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

カードは**ビルドの出力結果**であり、固定されたアップストリームのスナップショットからの決定論的な投影です。カードごとのエンリッチメント手順はもはや存在しません。手動で実行される`enrich-*`スクリプトレーンは廃止され、カードファイルに直接行われた編集は次のビルドで削除されます。事実を変更するには:

1. **決定を登録する。** すべてのフィールドは、ビルドの決定レジストリの1行になります。どのアップストリームパラメータがそれを提供するか、どのように投影されるか、そして値が存在しないことが何を意味するかです。
2. **インジェストレイヤーを修正する。** 誤った値はソースハンドラーの欠陥（または古いアップストリームのピン）であり、カード上でパッチを当てるものではありません。
3. **再ビルドして切り替える。** ビルドは、固定されたスナップショットからすべてのカードを再投影します。ゲートは、部分的なビルド、null/空の値、および整合性ルールに違反するカードを拒否します。

### 競合の処理

情報源間で見解が異なる場合:
1. 情報源の帰属とともに**すべてを保存する** — これが帰属エンベロープの目的です。
2. **平均化したり**どちらか一方を選んだり**しない** — `consensus`は、情報源が実際に一致している場合にのみ表示されます。
3. **各情報源の注意事項**をその値の`note`にそのまま保持する。
4. 表示または計算用の単一の値は、宣言された権威の順序から**アダプターによって派生する** — カード自体は完全な広がりを保持します。

---

## バリデーション

再ビルド後は必ずリンターを実行してください:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR チェックリスト

カードに影響を与える変更を送信する場合（カードではなくビルドを変更することを忘れないでください）:

- [ ] 修正はインジェストハンドラーまたは決定レジストリに存在する — カードファイルは手動で編集されていない
- [ ] フィールドは情報源が主張した値のみを保持する — カードを「完成」させるために`null`や`[]`で埋められたものはない
- [ ] `classification`はGlottologから取得されている（手動で構築されていない）
- [ ] 変更されたすべてのフィールドの出所が`_fieldSources`に記録され、Champollionが計算した値は`champollion-derived`の出所を保持している
- [ ] メソッド出力の測定スコアがカードのどこにも表示されていない
- [ ] リンターとカード整合性ゲートがエラーなしでパスする

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
