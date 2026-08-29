---
title: "言語カードの引用手順"
sidebar_label: "Citation Procedure"
---

# 言語カード引用手順

*Champollion が言語カード上のすべての主張を一次資料まで追跡可能にする方法。*

---

## 1. 問題の背景

言語カードには、話者数、危機的状況、接触影響、形態的特性、表記規則、メソッドサポートといった事実に基づく主張が含まれており、これらは**検証可能でなければなりません**。現状では：

- `dataSources` フィールドは文字列のフラット配列（例：`["cldr-48", "glottolog-5.3"]`）です
- フィールドごとの引用粒度がありません
- 「約280万人の話者」や「脆弱」といった主張には追跡可能な出典がありません
- レビュアーはどの資料がどの主張を裏付けているかを判断できません

> [!CAUTION]
> **出典のない主張は検証不可能な主張です。** 専門的な厳密さを標榜するプロジェクトとして、言語カード上のすべての主張は、特定のバージョン管理された一次資料まで追跡可能でなければなりません。

---

## 2. 権威ある資料（優先度順）

主張の種類ごとに、以下の資料が権威あるものとして認められています。**常に利用可能な最も優先度の高い資料を使用してください。**

### 分類と識別情報

| 優先度 | 資料 | 対象範囲 | ライセンス | 引用方法 |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org)（マックス・プランク研究所） | 語族、系統、glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org)（SIL） | ISO コード、マクロ言語 | 無償 | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info)（マックス・プランク研究所） | 属の定義、類型論的特徴 | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org)（Unicode） | ロケールコード、スクリプトコード、複数形規則 | Unicode 利用規約 | `cldr-{version}` |

### 話者の人口統計と言語活力

| 優先度 | 資料 | 対象範囲 | ライセンス | 引用方法 |
|---|---|---|---|---|
| 1 | 国勢調査データ | 公式話者数 | 様々（通常は公開） | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | 話者数推計、EGIDS | 独自（サブスクリプション） | `ethnologue-{edition}` |
| 3 | [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | 危機的状況 | 無償 | `unesco-atlas-{year}` |
| 4 | 学術論文 | 地域別話者調査 | 論文ごとのライセンス | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | フィリピンの言語 | 学術 | `katig-{year}` |

> [!WARNING]
> **人口統計に関する主張の一次資料として、Wikipedia、LLM が生成したテキスト、または自己知識を使用しないでください。** これらはせいぜい二次・三次資料です。常に一次データまで遡ってください。

### メソッドサポート（翻訳 API の対応状況）

| メソッド | 検証資料 | 検証方法 | 引用方法 |
|---|---|---|---|
| Google Translate | [言語一覧](https://cloud.google.com/translate/docs/languages) | API 呼び出しまたはドキュメントページ | `google-translate-{date}` |
| DeepL | [言語一覧](https://www.deepl.com/docs-api/translate-text/) | API 呼び出し | `deepl-api-{date}` |
| Microsoft Translator | [言語一覧](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | ドキュメントページ | `ms-translator-{date}` |
| LibreTranslate | [言語一覧](https://libretranslate.com/languages) | API 呼び出し | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + モデルカード | `nllb-200-{date}` |
| LLM | 常に `true` | 該当なし（品質は様々） | `llm-assumed` |

### DLS（デジタル言語サポート）

| 優先度 | 資料 | 対象範囲 | 引用方法 |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | DLS スコア（元の 143 ツール） | `simons-2022` |
| 2 | Ethnologue 第27版以降 | DLS スコア（拡張版 211 ツール） | `ethnologue-{edition}-dls` |

### 表記、複数形、スクリプト

| 優先度 | 資料 | 対象範囲 | 引用方法 |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | 複数形規則、引用符、数値フォーマット | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | スクリプトコード | `iso15924-{date}` |
| 3 | 出版された文法書 | 言語固有の規則 | `{author}-{year}` |

### 接触影響

| 優先度 | 資料 | 対象範囲 | 引用方法 |
|---|---|---|---|
| 1 | 出版された歴史言語学論文 | 借用語研究、接触の歴史 | `{author}-{year}` |
| 2 | 参照文法書 | 構造的影響の記述 | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | 類型論的比較 | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **接触影響の主張は出典を示すのが最も難しい項目です。** 「スペイン語上層言語、深い影響、1571〜1898年」といった主張には歴史言語学の専門知識が必要です。出版された資料が見つからない場合は、推測するのではなく、主張に `"citation_needed": true` を付けてください。

---

## 3. 引用手順（ステップごと）

### 新しい言語カードを作成する場合

1. **自動入力フィールドから始める：**
   - `node scripts/build-language-tree.mjs --enrich` を実行 → Glottolog から `classification` を入力
   - `dataSources` に `"glottolog-{version}"` を記録する

2. **CLDR データを追加する：**
   - CLDR から複数形規則、引用符、スクリプトコードを参照する
   - `dataSources` に `"cldr-{version}"` を記録する

3. **話者の人口統計を調査する：**
   - まず国勢調査データを確認する
   - Ethnologue と照合する（利用可能な場合）
   - UNESCO Atlas と照合する
   - 参照したすべての資料を `dataSources` に記録する

4. **メソッドサポートを確認する：**
   - 各 API の言語一覧を確認する（記憶や推測に頼らない）
   - 確認日を記録する

5. **接触影響を調査する：**
   - 出版された歴史言語学論文を探す
   - 時期、種類、深さを引用とともに記録する
   - 出版された資料が存在しない場合は、影響エントリに `"citation_needed": true` を追加する

6. **言語活力を調査する：**
   - EGIDS について Ethnologue を確認する
   - 危機的状況について UNESCO Atlas を確認する
   - 資料間の相違点を記録する

7. **`dataSources` を入力する：**
   - データを提供した資料だけでなく、参照したすべての資料を列挙する
   - 上記の表の引用形式を使用する

### 既存のカードを更新する場合

1. **`dataSources` を更新せずに事実に基づく主張を変更しない**
2. **話者数を更新する場合**は、古い資料を削除して新しい資料を追加する
3. **メソッドサポートを追加する場合**は、API に対して確認し、日付を記録する
4. **メソッドサポートの確認にはすべて日付を記録する** — API の対応状況は頻繁に変わります

---

## 4. スキーマ拡張の提案：フィールドごとの引用

### 現在のスキーマ（フラットな `dataSources`）

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**問題点：** どのフィールドが CLDR から来たのか？どれが Glottolog から来たのか？どれが未引用なのか？

### 提案する拡張：構造化された `dataSources`

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### 移行パス

これは**後方互換性のある**変更です：
1. 既存のカードはフラット配列を維持します（引き続き有効）
2. 新しいカードは構造化形式を使用します
3. スキーマ検証は両方の形式を受け入れます
4. 既存のカードはレビュー時に段階的に移行します

> [!TIP]
> **スクリプトで検証してください。** 以下を行う `validate-citations.mjs` スクリプトを追加します：
> - すべてのカードに少なくとも `classification` と `vitality` の資料があることを確認する
> - フラットな `dataSources` 配列を持つカードにアップグレードのフラグを立てる
> - 日付付き確認のない `methodSupport` エントリについて警告する

---

## 5. 品質チェックリスト

言語カードの変更をマージする前に、以下を確認してください：

- [ ] すべての話者数に資料がある（国勢調査または Ethnologue、Wikipedia は不可）
- [ ] すべての UNESCO/EGIDS ステータスに資料がある
- [ ] すべてのメソッドサポートフラグが実際の API に対して確認されている（推測ではない）
- [ ] すべての接触影響に出版された学術資料があるか、または `citation_needed` が付いている
- [ ] 分類が Glottolog から自動入力されている（手動で構築されていない）
- [ ] `dataSources` に参照したすべての資料が列挙されている
- [ ] LLM が生成した知識のみに依存している主張がない
- [ ] ネイティブスピーカーがレビューした場合、`humanReviewed` にレビュアーの識別子と日付が設定されている

---

## 6. `humanReviewed` フィールド

言語カードスキーマには `humanReviewed` フィールドが含まれており、現在すべてのカードで `null` になっています。このフィールドは、ネイティブスピーカーまたは資格のある言語学者がカードをレビューした際に入力する必要があります：

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **コミュニティによるレビューが最高水準です。** 自動化されたデータと学術論文は基盤を提供しますが、ネイティブスピーカーによるレビューが最終的な検証となります。これは特に以下の点において重要です：
> - 接触影響の主張（コミュニティのメンバーは実際に使われている借用語を知っています）
> - 言語活力の評価（コミュニティのメンバーは子どもたちがその言語を話しているかどうかを知っています）
> - 敬語・丁寧さのシステム（学術的な記述は日常的な使用パターンを見落とすことがあります）

---

## 7. この手順の参考資料

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — 無償
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Unicode 利用規約
5. Ethnologue: https://www.ethnologue.com — 独自（サブスクリプション）
6. UNESCO Atlas: http://www.unesco.org/languages-atlas/ — 無償
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Champollion Language Card Spec: `cli/website/docs/reference/language-card-spec.md`
