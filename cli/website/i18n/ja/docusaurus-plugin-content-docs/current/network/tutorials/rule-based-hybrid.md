---
sidebar_position: 7
title: "クックブック：ルールベース + LLM ハイブリッド"
---

# ルールベース + LLMハイブリッド

> **基本的な考え方：** 正しいことが確実にわかっているパターン（形態論的な接辞付加、数値フォーマット、既知のフレーズ構造）には決定論的な言語ルールを使用し、それ以外の創造的な翻訳はLLMに任せます。ルールが適用される箇所ではルールがLLMより優先され、LLMはルールが対応できない部分を補います。

:::info[これはクックブックであり、完成した実装ではありません]
このガイドはハイブリッドアーキテクチャの概要を示すものです。具体的なルールは、対象言語の文法や利用可能な言語リソースによって異なります。
:::

## このアプローチを使うべき場面

- 対象言語に関する**深い言語学的専門知識**がある（または言語学者にアクセスできる）
- 一部の翻訳パターンが**決定論的**である — 正しい出力を確実に把握している
- LLMが特定のパターン（数値フォーマット、敬語表現、膠着語の処理）で**一貫して失敗する**
- 流暢さはLLMに維持させつつ、重要度の高いパターンの**正確性を保証**したい

## 仕組み

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **ルールを定義する** — 正規表現パターン、FSTルックアップ、既知の翻訳に対するルックアップテーブル
2. **前処理** — ルールにマッチするセグメントをソーステキストから特定・抽出する
3. **LLMが翻訳する** — 残りのテキストを、ルールの出力を制約として使用しながら翻訳する
4. **マージ** — 翻訳を再結合し、ルールの出力が存在する箇所ではそちらを優先する
5. **検証** — マージ結果に対してFST/ルールによるチェックを任意で実施する

## 例：数値・日付ルール

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## 主要な設計上の判断

**ルールの優先度：** 同じセグメントに対してルールとLLMの両方が出力を生成した場合、どちらを優先するか。**正確性が重要**なパターンではルールを優先すべきです。**流暢さが重要**なパターンではLLMを優先すべきです。

**粒度：** 単語レベルのルール（辞書ルックアップ）、フレーズレベルのルール（慣用句マッピング）、構造レベルのルール（文の語順変換）があります。まず単語レベルから始め、パターンが明らかになるにつれてフレーズレベルを追加していきましょう。

**ルールのメンテナンス：** すべてのルールはメンテナンスの義務を伴います。不確かなルールを大量に持つよりも、確信度の高いルールを少数に絞ることを推奨します。ルールが正しいかどうか確信が持てない場合は、LLMに任せてください。

## メリットとデメリット

| | |
|---|---|
| ✅ ルールが適用される箇所では正確性を保証できる | ❌ 深い言語学的専門知識が必要 |
| ✅ 透明性が高い — ルールは読みやすく監査可能 | ❌ ルールとLLMの境界部分で不自然な出力が生じる場合がある |
| ✅ ルールは高速（APIコストが不要） | ❌ ルール数が増えるにつれてメンテナンスの負担が増大する |
| ✅ 段階的に導入可能 — 学習しながらルールを追加できる | ❌ ルール境界での活用形の処理が難しい |

## 組み合わせに適したアプローチ

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FSTを特定種類のルールエンジンとして活用する
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 辞書ルックアップはシンプルなルールの一形態
- **[Coached LLM Prompting](./coached-llm-prompting)** — コーチングはソフトな好みを扱い、ルールはハードな要件を扱う

## 関連情報

- [GiellaLT](https://giellalt.github.io/) — 100以上の言語に対応したオープンソースのFSTインフラ
- [Apertium](https://www.apertium.org/) — 対訳辞書を備えたルールベースMTプラットフォーム
- [低リソース言語のサポート](/docs/network/community/low-resource-languages)
