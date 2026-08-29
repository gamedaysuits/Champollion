---
sidebar_position: 4
title: "クックブック：辞書拡張LLM"
---

# 辞書拡張型 LLM

> **基本的な考え方：** 対訳辞書から特定の用語の既知・検証済み訳語を強制的に使用させ、文構造や未知の語彙は LLM に処理させます。辞書が正確さのアンカーを提供し、LLM が流暢さを提供します。

:::info[これはクックブックであり、完成した実装ではありません]
このガイドはアプローチの概要を示すものです。具体的な辞書マッチングおよびインジェクション戦略は、言語ペアと利用可能な語彙リソースによって異なります。
:::

## このアプローチを使うべき場面

- 対象言語ペアに**対訳辞書が存在する**場合（小規模なものでも可）
- LLM が主要な用語を**一貫してハルシネーション**している場合 — 存在しない語を作り出してしまう
- 翻訳全体で**用語の一貫性**が必要な場合（同じ語が常に同じ訳語に対応する）
- 標準的な LLM 翻訳が誤りとなる**専門分野のコンテンツ**を翻訳している場合（法律・医療・教育など）

## 仕組み

1. **対訳辞書を読み込む** — 原語の用語を検証済みの訳語にマッピングするキーと値のペア
2. **原文テキストを辞書と照合する** — 既知の訳語を持つ用語を入力から特定する
3. **マッチした結果をプロンプトに注入する** — 「これらの用語は必ず以下のように翻訳すること」と LLM に指示する
4. **LLM が翻訳を生成する** — 辞書の制約をハード要件として使用する
5. **後処理を行う** — 辞書の用語が出力に含まれているか検証し、含まれていない場合は再試行する

## 辞書のフォーマット

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## プロンプトの構造

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## 主要な設計上の判断

**マッチング戦略：** 完全一致が最もシンプルです。見出し語化マッチング（"teachers" が "teacher" にマッチする）はより多くの語を捕捉できますが、原語の見出し語化ツールが必要です。ファジーマッチングは誤検出のリスクがあります。

**活用形の処理：** 多合成語言語では、辞書の見出し語形を文に合わせて活用させる必要がある場合があります。語根を提供して LLM に活用させるか、複数の活用形を提供するかを選択できます。[FST](./fst-gated-pipeline) を使って結果を検証することも可能です。

**競合の解決：** LLM が辞書の用語を無視した場合はどうするか。選択肢は次のとおりです：(a) より強い指示で再試行する、(b) 文字列置換で後処理する、(c) そのまま受け入れてレビュー対象としてフラグを立てる。

## メリットとデメリット

| | |
|---|---|
| ✅ 既知の用語に対するハルシネーションを排除できる | ❌ 辞書のカバレッジは常に不完全である |
| ✅ 主要な語彙の一貫性を保証できる | ❌ 活用・語形変化が文脈に合わない場合がある |
| ✅ 監査・更新が容易である | ❌ 制約が過剰になると不自然な出力になる可能性がある |
| ✅ 辞書は再利用可能な資産である | ❌ そもそも辞書が存在することが前提となる |

## 辞書の入手先

- **[itwêwina](https://itwewina.altlab.app/)** — 平原クリー語–英語 (FST駆動。morphodictプラットフォームはオープンソースですが、辞書コンテンツ自体はオープンライセンスではありません)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — 包括的な平原クリー語のリファレンス (レジャイナ大学出版局)
- **[Apertium](https://www.apertium.org/)** — 数十の言語ペアに対応したバイリンガル辞書
- **[Giellatekno](https://giellalt.github.io/)** — サーミ語、ウラル語族、その他の少数言語の辞書
- コミュニティによって作成された用語集、教育資料、用語リスト

## 組み合わせに適したアプローチ

- **[Coached LLM Prompting](./coached-llm-prompting)** — 辞書エントリはコーチングデータの一形態です
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST が辞書の用語の活用形を検証します
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — 決定論的な辞書ルックアップをルール層の一つとして使用します

## 関連項目

- [低リソース言語のサポート](/docs/network/community/low-resource-languages) — 全体的なコンテキスト
- [メソッドインターフェース](/docs/network/specifications/methods) — メソッドの構造について
