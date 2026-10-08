---
sidebar_position: 3
title: "人工言語・文字・正書法"
---

# 人工言語・文字・正書法

champollion は、LLM レジスターと決定論的文字変換器を通じて、人工言語をファーストクラスでサポートしています。このガイドでは、人工言語サポートの仕組み、必要なフォント、および独自の人工言語を追加する方法について説明します。

:::tip[なぜ人工言語が重要なのか]
人工言語は単なる珍しい存在ではありません — 実際に支援が不足している言語に使われるのとまったく同じインフラを検証します。品質チェック、コーチングシステム、スクリプト変換パイプラインは、Klingon でも Plains Cree でも同じように動作します。人工言語のパイプラインが正しく機能すれば、低リソース言語のパイプラインも同様に機能します。
:::

---

## サポートされている人工言語

| 言語 | コード | 文字変換器 | 必要なフォント |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ ローマ字表記 → pIqaD | PUA フォント（例：pIqaD qolqoS） |
| Sindarin（トールキンのエルフ語） | `x-elvish-s` | ✅ ラテン文字 → Tengwar | CSUR PUA フォント |
| Kryptonian | `x-kryptonian` | ✅ ラテン文字 → Kryptonian | PUA フォント |
| 海賊英語 | `x-pirate` | ❌ レジスターのみ | なし |
| シェイクスピア英語 | `x-shakespeare` | ❌ レジスターのみ | なし |
| ヨーダ語 | `x-yoda` | ❌ レジスターのみ | なし |

人工言語コードは BCP-47 私的使用規約に従い `x-` プレフィックスを使用しますが、Klingon（`tlh`）は例外で、SIL International によって [ISO 639-3](https://iso639-3.sil.org/code/tlh) コードが割り当てられています。

---

## Unicode、PUA、およびフォント要件

### 私的使用領域（Private Use Area）

Klingon（pIqaD）、Sindarin（Tengwar）、Kryptonian は Unicode の**私的使用領域（PUA）**文字を使用します。PUA は U+E000〜U+F8FF の範囲で、これらのコードポイントには**標準的な割り当てがありません**。[ConScript Unicode Registry（CSUR）](https://www.evertype.com/standards/csur/)は架空の文字体系に対するコミュニティ合意のマッピングを管理していますが、これらは Unicode 標準の一部ではありません。

実際の意味合いとしては：

- 正しいフォントが読み込まれていない場合、PUA テキストは**空のボックス**（□□□）として表示されます
- 異なるフォントが同じ PUA コードポイントに異なるグリフをマッピングする場合があります
- champollion は PUA フォントをバンドルしていません。ご自身で読み込む必要があります
- システムフォントはこれらの文字を表示しません

### 文字体系別の PUA 範囲

| 文字体系 | PUA 範囲 | CSUR 参照 |
|--------|-----------|---------------|
| Klingon（pIqaD） | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar（エルフ語） | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | フォントによって異なる | CSUR 標準なし |

### PUA ウェブフォントの読み込み

champollion には PUA ウェブフォントをダウンロードして管理するための組み込みコマンドが含まれています：

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

`fonts install` コマンドは、検証済みのオープンソースリポジトリからダウンロードします：

| フォント | 文字体系 | ライセンス | ソース |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3（フォント例外付き） | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *（ユーザー提供）* | Kryptonian | 様々 | 利用可能なオープンソース PUA フォントなし |

出力ディレクトリはプロジェクト構造から自動検出されます（Docusaurus → `static/fonts/`、Hugo → `static/fonts/`、デフォルト → `public/fonts/`）。`--dir` で上書きできます。

フォントを手動で管理する場合は、CSS に `@font-face` ルールを追加してください：

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[Unicode サポートは保証されません]
Unicode コンソーシアムは、架空のスクリプトを標準に収録することを[明示的に拒否しています](https://www.unicode.org/faq/private_use.html)。PUA の割り当てはコミュニティによって管理されており、フォントの実装によって競合する場合があります。プロジェクトで使用する正確なフォントを必ず指定し、ブラウザ間でのレンダリングをテストしてください。
:::

---

## 文字変換器

### 仕組み

Champollionの文字体系変換は、**設定で要求された場合にのみ適用される翻訳後フック（post-translation hook）**です。

1. LLMがテキストを**作業用文字体系（working script）**（通常はラテン文字またはSRO）に翻訳します
2. [品質ゲート](/docs/concepts/quality-gate)が出力を検証します
3. 言語ペアの`script:`設定が表示用文字体系を選択している場合、決定論的コンバーターが検証済みテキストを変換します — コンバーターがマッピングできない文字を含む値は作業用文字体系のまま保持され、キーごとに警告が表示されます
4. 結果がディスクに書き込まれます

この 2 段階のアプローチが機能するのは、LLM がラテン文字ベースの文字体系で作業する際により良い出力を生成するためです。決定論的変換器は、モデルの（しばしば信頼性の低い）文字体系の知識に依存することなく、正確な文字出力を保証します。

ステップ3を実行するかどうかはプロジェクトごとの判断となります。[文字体系の変換](/docs/getting-started/configuration#script-conversion)を参照してください。PUA表示用文字体系（pIqaD、テングワール、クリプトン文字）は、専用フォントがないと何も表示されないため、デフォルトでオフになっています。crkとsrにはデフォルト設定が一切ありません。どちらの表記体系も実際に使われており、その選択はプロジェクト側で行うべきだからです。

### 5 つの変換器すべて

champollion には 5 つの組み込み文字変換器が搭載されています：

#### Plains Cree：SRO → 音節文字（`crk`）

標準ローマ字正書法からカナダ先住民音節文字への変換。

```
Input:  "pâ tê ki"    (syllables, a spelling example — not a word)
Output: "ᐹ ᑌ ᑭ"
```

長母音にはサーカムフレックス（またはマクロン）を使用します：ê、î、ô、â。変換は、ALTLabのitwêwinaで使用されているコミュニティ保守のコンバーター`cree-sro-syllabics`によって行われます。プレースホルダー、ICU構文、タグ、URLはそのまま保持されます。Creeのパイプライン全体の詳細については、[リソースの少ない言語のサポート](/docs/network/community/low-resource-languages)を参照してください。

#### Serbian：ラテン文字 → キリル文字（`sr`）

Serbian 向けの決定論的なラテン文字からキリル文字への変換。

```
Input:  "zdravo"
Output: "здраво"
```

二重字（lj → љ、nj → њ、dž → џ）を含む Serbian アルファベットの完全なマッピングを処理します。

#### Klingon：ローマ字表記 → pIqaD（`tlh`）

Marc Okrand のローマ字表記システムから pIqaD PUA 文字への変換。

```
Input:  "tlh gh Q"   (romanized letters, a spelling example — tlh is one letter)
Output: [pIqaD PUA]  (requires pIqaD font to render)
```

#### Sindarin：ラテン文字 → Tengwar（`x-elvish-s`）

トールキンの Sindarin モード Tengwar マッピング。

```
Input:  "la ne mi"   (Latin letters, a spelling example — not a word)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian：ラテン文字 → Kryptonian（`x-kryptonian`）

ファンレキシコンの Kryptonian 文字マッピング。

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### 変換器のトリガー

書き込みたい表記体系のISO 15924コードを`script`フィールドに設定します。

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

この設定を行わない限り、変換は一切行われません。`crk`および`sr`の場合、このフィールドは**必須**です — どちらの表記体系も実際に使われており、`sync`が自動でいずれかを選択することはありません。PUAロケールの場合は、デフォルトのローマ字表記に対するオプトインとなります。[文字体系の変換](/docs/getting-started/configuration#script-conversion)を参照してください。

---

## 複数文字体系の言語

実際の言語の中には、複数の文字体系が現役で使用されているものがあります：

| 言語 | 文字体系 | Champollionのアプローチ |
|----------|---------|-----------------|
| セルビア語 | ラテン文字 + キリル文字 | 単一ロケール、明示的な選択：`"script": "Cyrl"`で変換、`"script": "Latn"`でラテン文字を維持 |
| 平原クリー語 | SRO（ラテン文字） + 音節文字 | 単一ロケール、明示的な選択：`"script": "Cans"`または`"script": "Latn"` |
| 中国語 | 簡体字 + 繁体字 | 異なる言葉遣いに応じた個別のロケールコード（`zh` vs `zh-TW`） |

両方の文字体系が同一の対象者に向けられている言語（セルビア語、平原クリー語）では、単一のロケールと明示的な`script`の選択により、単一の翻訳パイプラインを維持できます。文字体系ごとに異なる対象者に向けられている言語（中国本土向けの簡体字、台湾/香港向けの繁体字）では、個別のロケールコードを使用してください。

---

## 正書法に関する注意事項

レジスターはトーンだけではありません。LLM を正しい表記規則に誘導する**正書法の指示**も含まれています。

### 敬称・丁寧表現

champollion の組み込みレジスターには、各言語に文化的に適切な敬称が含まれています：

| 言語 | 敬称 | レジスター指示 |
|----------|------------|---------------------|
| ドイツ語 | Sie | `Use Sie-form for formal address` |
| フランス語 | vous | `Use vous-form` |
| ロシア語 | вы | `Professional register with вы-form` |
| トルコ語 | siz | `Professional register with siz-form` |
| 韓国語 | 합쇼체 | `Formal Korean (합쇼체)` |
| 日本語 | です/ます | `Polite professional register (です/ます form)` |
| ポーランド語 | Pan/Pani | `Professional register with Pan/Pani form` |

### ジェンダーインクルーシブな表記

各言語カードには、言語固有のアドバイスを含む `gender.inclusiveGuidance` フィールドがあります。これはレジストリプリセットとは別に LLM 翻訳プロンプトに注入されるため、ユーザーが選択した丁寧さのプリセットに関わらず一貫して適用されます：

- **フランス語**：中点記法によるインクルーシブ表記（例："Connecté·e"）
- **ドイツ語**：コロン記法（例："Benutzer:innen"）
- **スペイン語**：ジェンダーニュートラルな言い換えを優先。スラッシュ記法（例："usuario/a"）はフォールバックとして使用

言語カードに固有のガイダンスがない言語（例：韓国語、人工言語）の場合、システムは汎用ルールにフォールバックします：*「ジェンダーニュートラルな表現、または利用可能な最もインクルーシブな選択肢を優先する。」*

### RTL 文字体系の要件

アラビア語、ヘブライ語、ペルシア語、ウルドゥー語のレジスターはすべて右から左への要件を記載しています：`Ensure text reads naturally in RTL layout contexts.`

### レジスターの上書き

すべてのレジスターは設定値です。プロジェクトのスタイルに合わせて上書きできます：

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

完全な設定リファレンスについては、[設定](/docs/getting-started/configuration)を参照してください。

---

## 新しい人工言語の追加

### 手順

1. **BCP-47 私的使用コードを選択する**：`x-` プレフィックスを使用します（例：`x-dothraki`、`x-valyrian`）。

2. **設定に追加する**：

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **（オプション）文字変換器を追加する**：人工言語が非ラテン文字の表示用文字体系を使用する場合は、`lib/scripts.js` に変換器を追加し、`SCRIPT_CONVERTERS` に登録してください。

4. **テストする**：`champollion sync --dry` を実行して、ファイルを書き込まずに翻訳をプレビューします。

5. **品質ゲートを確認する**：[品質ゲート](/docs/concepts/quality-gate)は人工言語に合わせた調整が必要な場合があります。特に、人工言語が PUA 文字を使用する場合は `requireNonLatin` チェックに注意してください。

:::note[人工言語の品質は LLM の学習データに依存します]
LLM は、学習データに含まれている人工言語にしか翻訳できません。十分に文書化された人工言語（Klingon、Sindarin、Dothraki）は良好に機能します。マイナーな言語や新たに考案された人工言語では、結果が一貫しない場合があります。品質を向上させるには[コーチングデータ](/docs/concepts/coaching-data)を活用してください。
:::

---

## 関連項目

- [サポートされている言語](/docs/reference/supported-languages) — メソッドの利用可否を含む完全な言語一覧
- [文字変換器](/docs/concepts/script-converters) — 変換パイプラインの技術的な詳細
- [翻訳メソッド](/docs/guides/translation-methods) — 各翻訳メソッドの仕組み
- [設定](/docs/getting-started/configuration) — 言語およびレジスター設定を含む設定リファレンス
- [低リソース言語のサポート](/docs/network/community/low-resource-languages) — 実際のサポートが不十分な言語に適用される同じインフラ
