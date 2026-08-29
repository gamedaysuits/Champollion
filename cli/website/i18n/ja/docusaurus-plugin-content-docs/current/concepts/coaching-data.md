---
sidebar_position: 5
title: "コーチングデータ"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# コーチングデータ

コーチングデータは、LLMが学習していない言語を教えるための Champollion の仕組みです。文法ルール、辞書、スタイルノートを各翻訳リクエストとともに提供することで、汎用 LLM をあらゆる言語に対応したコンテキスト認識型の翻訳エンジンへと変換できます。機械翻訳のサポートがまったく存在しない言語にも対応可能です。

## 仕組み

ペアのメソッドを `llm-coached` に設定すると、Champollion は `.champollion/coaching/<locale>.json` からコーチングファイルを読み込み、その内容をシステムメッセージの一部としてすべての LLM プロンプトに挿入します。LLM は翻訳リクエストとともに言語ルールを参照するため、推測に頼らず、指定した文法や用語に従った出力を生成します。

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

コーチングコンテンツには 2 種類あります。

1. **構造化コーチングデータ**（`llm-coached` メソッド）— JSON 形式の文法ルール、辞書、スタイルノート。`.champollion/coaching/<locale>.json` またはプラグインの `coaching/` ディレクトリから読み込まれます。
2. **フリーテキストコーチングプロンプト**（`coachingFile` 設定フィールド）— システムプロンプトに挿入される追加ガイダンスを記述したプレーンテキストファイル。`llm-coached` に限らず、あらゆる LLM メソッドで使用できます。設定ファイルの `coachingFile` または CLI の `--coaching-file` で指定します。

両方を同時に使用することもできます。評価ハーネスはまったく同じプロンプト構造を使用するため、ベンチマークスコアは実際の本番プロンプトを正確に反映します。

コーチングデータはシステムメッセージの一部であるため、**プロンプトキャッシュ**の恩恵を受けられます。Anthropic や Google などのプロバイダーは繰り返されるシステムプレフィックスをキャッシュするため、コーチングコンテキストの費用はバッチごとではなく、セッションごとに 1 回だけ発生します。

## コーチングファイルの形式

`.champollion/coaching/` にロケールごとの JSON ファイルを 1 つ作成します。

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### フィールド

| フィールド | 型 | 必須 | 説明 |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | いいえ | システムプロンプトに挿入される文法ルールの配列。各ルールは LLM が従いやすい、簡潔で実行可能な指示として記述してください。 |
| `dictionary` | `object` | いいえ | 英語の用語 → 対象言語の用語のキーと値のマップ。LLM が知らないドメイン固有の語彙に使用します。 |
| `style_notes` | `string` | いいえ | 文体に関する自由記述の指示（レジスター、トーン、丁寧さの規則など）。 |

すべてのフィールドは省略可能です。まず辞書だけで始め、改善を重ねながら文法ルールを追加していくことができます。

## フォールバックの動作

ペアが `llm-coached` に設定されているにもかかわらず、そのロケールのコーチングファイルが存在しない場合、Champollion はコンソール警告を表示したうえで**標準の `llm` メソッドにフォールバック**します。

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

これにより、`"defaultMethod": "llm-coached"` をグローバルに設定しても安全です。コーチングデータがある言語はそれを使用し、それ以外の言語はエラーなしで標準の LLM 翻訳が適用されます。

## コーチングを使うべき場面

| シナリオ | 推奨メソッド |
|----------|-------------------|
| Tier 1 言語（フランス語、スペイン語、ドイツ語） | `llm` または `google-translate` — LLM はこれらの言語を十分に習得済み |
| Tier 2 言語（韓国語、トルコ語、タイ語） | `llm` とレジスター指定 — スタイルガイダンスがあれば LLM で十分対応可能 |
| Tier 3 言語（Plains Cree、ヨルバ語、ケチュア語） | `llm-coached` — LLM には文法ルールと辞書が必要 |
| 人工言語（クリンゴン語、シンダリン語、クリプトン語） | `llm-coached` — LLM にある程度の学習データはあるが修正が必要 |

## 良いコーチングデータを作るには

### 文法ルール

ルールは説明文ではなく、**指示文**として記述してください。LLM は言語理論の解釈よりも、指示に従う方が得意です。

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### 辞書

LLM が誤訳したり造語したりしやすい**ドメイン固有の用語**に絞って記述してください。LLM がすでに正しく扱える一般的な単語は不要です。アプリケーションの UI に固有の用語に集中しましょう。

### スタイルノート

レジスター、丁寧さ、慣習について具体的に記述してください。

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## コーチング済み翻訳のテスト

[MT Eval Harness](https://github.com/gamedaysuits/Champollion) を使用して、参照コーパスに対してコーチング済み翻訳のベンチマークを実施してください。

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

chrF++、BLEU、完全一致スコアが得られます。複数のコーチングファイルバージョンを作成して比較しましょう。主観的なレビューよりも客観的な指標の方が信頼できます。

---

## 関連情報

- [翻訳メソッド](/docs/guides/translation-methods) — llm-coached メソッドについて
- [低リソース言語のサポート](/docs/network/community/low-resource-languages) — コーチングの実践例
- [プラグイン仕様](/docs/reference/plugin-spec) — プラグインへのコーチングデータのパッケージング
- [品質ゲート](/docs/concepts/quality-gate) — コーチング済み翻訳の検証方法
- [設定](/docs/getting-started/configuration) — ペアごとのコーチング設定
