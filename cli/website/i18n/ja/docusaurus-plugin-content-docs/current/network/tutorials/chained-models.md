---
sidebar_position: 6
title: "クックブック：チェーンモデル"
---

# チェーンモデル（マルチステージパイプライン）

> **基本的な考え方：** モデルAが粗訳を生成 → モデルBがポストエディット → モデルCが結果をスコアリングまたは検証する。各ステージは一つのことに特化します。パイプラインの出力は、単一モデルよりも優れたものになります。

:::info[これはクックブックであり、完成した実装ではありません]
このガイドでは、マルチステージパイプラインのアーキテクチャの概要を説明します。具体的なモデルとチェーン設定は、言語ペアと予算によって異なります。
:::

## このアプローチを使うべき場面

- 単一モデルが**品質にばらつき**を生じさせる — 一部の入力では良好だが、他では不良
- **生成と検証を分離**したい — 一方のモデルが生成し、もう一方が批評する
- **翻訳ごとに複数のAPI呼び出し**の予算がある（レイテンシとコストはステージ数に比例して増加する）
- **異なる強みを持つモデルを組み合わせ**たい（例：創造的な生成モデル＋精密な編集モデル）

## 仕組み

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## 例：3ステージパイプライン

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## 一般的なチェーンパターン

| パターン | ステージ | ユースケース |
|---------|--------|----------|
| **生成 → 編集** | 高速LLM → 高性能LLM | コスト効率の良い品質向上 |
| **生成 → 検証 → リトライ** | LLM → FST/ルール → LLM（失敗時にリトライ） | 形態論的正確性（[FST-Gated](./fst-gated-pipeline)を参照） |
| **生成 → 逆翻訳 → スコアリング** | LLM(en→crk) → LLM(crk→en) → 比較 | ラウンドトリップ整合性チェック |
| **アンサンブル → 投票** | 3つのLLMが独立して処理 → 多数決 | 多様性によるロバスト性 |

## 主要な設計上の判断

**レイテンシ予算：** 各ステージはレイテンシを乗算します。1ステージあたり2秒の3ステージチェーンでは、翻訳1件あたり6秒かかります。バッチ評価では問題ありませんが、リアルタイム処理では適さない場合があります。

**コスト乗数：** 3ステージ = APIコストが3倍になります。初期ステージには安価なモデルを使用し、重要なステージには高価なモデルを使用してください。

**エラーの伝播：** ステージ1の出力が不良だと、ステージ2を誤った方向に導く可能性があります。後続のモデルが回復できるよう、すべてのステージに元のソーステキストを含めてください。

## メリットとデメリット

| | |
|---|---|
| ✅ 専門特化した強みを組み合わせられる | ❌ レイテンシとコストがステージごとに乗算される |
| ✅ 関心の分離（生成と検証） | ❌ デバッグが複雑 — どのステージでエラーが発生したか？ |
| ✅ 個々のステージを容易に交換できる | ❌ ステージ間でエラーが伝播する |
| ✅ ラウンドトリップ検証でハルシネーションを検出できる | ❌ 2〜3ステージを超えると収穫逓減が生じる |

## 組み合わせに適したアプローチ

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — 検証ステージとしてのFST
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 生成ステージでの辞書注入
- **[Coached LLM Prompting](./coached-llm-prompting)** — 1つ以上のステージでのコーチング

## 関連情報

- [Eval Harness](/docs/network/specifications/harness) — ハーネスはエンドツーエンドのパイプライン出力を測定します
- [Run Card Specification](/docs/network/specifications/run-card) — レイテンシとコストはエントリごとに記録されます
- [低リソース言語のサポート](/docs/network/community/low-resource-languages)
