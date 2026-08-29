---
sidebar_position: 6
title: "スクリプトコンバーター"
---

# スクリプトコンバーター

スクリプトコンバーターは、決定論的でLLMを使用しない翻訳後フックであり、テキストをある文字体系から別の文字体系へ変換します。「一度翻訳して、複数のスクリプトで表示する」ワークフローを実現します。つまり、作業用スクリプト（通常はラテン文字）に翻訳した後、表示用スクリプトへ自動的に変換します。

## スクリプトコンバーターが必要な理由

同じ話し言葉に対して複数のスクリプトを使用する言語があります：

- **Plains Cree**：編集用のSRO（ラテン文字）→ 表示用の音節文字（ᓀᐦᐃᔭᐍᐏᐣ）
- **セルビア語**：国際的な用途向けのラテン文字 → 国内向けのキリル文字
- **クリンゴン語**：入力用のローマ字表記 → 表示用のpIqaD（  ）

非ラテン文字スクリプトへ直接翻訳すると問題が生じます。LLMが文字を誤生成したり、JSONファイルのバージョン管理が困難になったり、差分ツールで変更を比較できなくなったりします。スクリプトコンバーターは、翻訳をバージョン管理しやすいスクリプトで保持し、同期時に決定論的に変換することでこれらの問題を解決します。

## 利用可能なコンバーター

Champollionには5つの組み込みスクリプトコンバーターが付属しています：

| ロケール | 変換元 | 変換先 | 種類 | フォント必要？ |
|--------|------|----|------|----------------|
| `crk` | SRO（標準ローマ字正書法） | Cree音節文字 | 決定論的 | 不要 — ネイティブUnicode |
| `sr` | ラテン文字 | キリル文字 | 決定論的 | 不要 — ネイティブUnicode |
| `tlh` | ローマ字表記 | pIqaD | 決定論的 | 必要 — PUA U+F8D0–F8FF |
| `x-elvish-s` | ラテン文字 | テングワール（ベレリアンド様式） | 決定論的 | 必要 — PUA U+E000–E07F |
| `x-kryptonian` | ラテン文字 | クリプトン文字 | フォントベース暗号 | 必要 — PUA U+E100–E119 |

### 決定論的コンバーターとフォントベースコンバーターの違い

- **決定論的コンバーター**（Cree、セルビア語、クリンゴン語、テングワール）は、言語規則を用いた実際の文字対文字マッピングを行います。出力には実際のUnicode文字が含まれます。
- **フォントベースコンバーター**（クリプトン文字）は1対1の置換暗号であり、出力はUnicode PUA文字となります。特定のフォントが読み込まれている場合にのみ正しく表示されます。

## 動作の仕組み

スクリプトコンバーターは翻訳の**後**に後処理ステップとして実行されます。パイプラインは次のとおりです：

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

例として、Plains Creeの場合：
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### 左から右へのグリーディマッチング

すべてのコンバーターは同じアルゴリズムを使用します。各文字位置において、まず最長の一致を試み、次第に短い一致へと移行します。どのパターンにも一致しない文字（スペース、句読点、数字）はそのまま通過します。

これにより、二重字（ダイグラフ）や三重字（トライグラフ）が正しく処理されます：
- クリンゴン語：`tlh` → 単一のpIqaD文字（`t` + `l` + `h`ではなく）
- セルビア語：`nj` → `њ`（`н` + `ј`ではなく）
- Cree：`twê` → 単一の音節文字（`t` + `w` + `ê`ではなく）

## スクリプトコンバーターの使用方法

変換は**設定による決定事項であり、決して自動で行われることはありません**（バージョン0.3.0以降。以前のバージョンでは無条件に変換されていたため、ラテン文字の翻字を想定したフォントを使用するプロジェクトに、レンダリング不可能なPUAテキストが出力されていました）:

- **crkとsrには2つの実際の正書法があります**（SRO/音節文字、ラテン文字/キリル文字）。デフォルトはありません。`champollion init`はどちらを記述するかを尋ね、`sync`は設定で指定されるまで実行を拒否します。Champollionがコミュニティの書記体系を勝手に選択することはありません。
- **tlh、x-elvish-s、x-kryptonianはデフォルトでローマ字表記になります** — これらの表示用文字はPrivate Use Area（私用領域）であり、特殊なフォントがないとレンダリングできません。明示的にオプトインしてください。

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

champollionが`en:crk`を`"script": "Cans"`と同期する際、翻訳はSRO（ゲートが検証する作業用文字）で生成され、`crk.json`に書き込まれる前に音節文字（Syllabics）に変換されます。`"script": "Latn"`を使用する場合、または`script:`が全くないtlhの場合、作業用文字がそのまま成果物となり、変換は行われません。

コンバーターがマッピングできない文字（クリンゴン語には`d`、`c`、`f`、`g`、`i`、`k`、`s`、`x`、`z`がないため、「GitHub」は完全には変換できません）が含まれる場合、文字を混在させるのではなく、作業用文字のまま**値全体**を保持し、該当する文字を明記した警告を出します。[`scriptFallback`](/docs/getting-started/configuration#script-fallback)を使用して、独自の翻字ルールを宣言してください。

無条件であった時に行われた変換を元に戻すには、[`champollion repair-script`](/docs/getting-started/configuration#repair-script)を実行します。変換がオフになっている場所でPUAが見つかった場合、`champollion integrity`は失敗します。

### コンバーターの状態を確認する

```bash
npx champollion status
```

ステータス出力には、各ペアの解決された文字の決定事項（何が書き込まれるか、およびコンバーターが利用可能であっても有効になっていないかどうか）が表示されます。

## Webフォントの要件

3つのコンバーターはUnicode私用領域（PUA）文字を出力するため、カスタムWebフォントが必要です：

### クリンゴン語（pIqaD）

CSURに対応したpIqaDフォント（例：「pIqaD qolqoS」または「Klingon pIqaD HaSta」）をインストールしてください：

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### テングワール（シンダール語）

CSURに対応したテングワールフォント（例：「Tengwar Formal CSUR」、「Tengwar Annatar」）をインストールしてください：

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### クリプトン文字

PUAコードポイントU+E100–E119にマッピングされたクリプトン文字フォントをインストールしてください：

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[クリプトン語への代替アプローチ]
クリプトン語は純粋なA-Zの暗号であるため、スクリプトコンバーターを省略し、CSSでラテン文字テキストにフォントを適用することができます。これはウェブ展開においてよりシンプルな方法です — クリプトン語フォントを配信し、該当する要素に`font-family`を設定するだけです。
:::

## カスタムコンバーターの追加

新しい言語のコンバーターを追加するには、`lib/scripts.js`を編集してください：

1. **変換マップを作成する** — `[from, to]`ペアの順序付き配列。最長のシーケンスを先頭に配置します
2. **コンバーター関数を作成する** — 左から右へのグリーディスキャナー（`sroToSyllabics`をテンプレートとして使用してください）
3. **ロケールコードをキーとして** `SCRIPT_CONVERTERS`オブジェクトに**登録する**
4. **`script`フィールドを追加する** — `registers.js`内の言語のレジストリエントリに追加します

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## 関連項目

- [Conlangs、スクリプト、正書法](/docs/guides/conlangs-scripts-orthography) — PUAフォント、Unicode、新しいコンバーターの追加
- [品質ゲート](/docs/concepts/quality-gate) — スクリプト変換前に実行される検証
- [サポート対象言語](/docs/reference/supported-languages) — スクリプトコンバーターを持つ言語
- [低リソース言語のサポート](/docs/network/community/low-resource-languages) — SRO→音節文字の実際の使用例
- [クックブック：FSTゲートパイプライン](/docs/network/tutorials/fst-gated-pipeline) — 多段階パイプラインにおけるスクリプト変換
