---
sidebar_position: 8
title: "クックブック：逆翻訳によるデータ拡張"
---

# 逆翻訳によるデータ拡張

> **基本的なアイデア：** 既存のターゲット言語テキストをソース言語に逆翻訳して合成対訳データを生成し、その合成ペアを使ってフォワードモデルの訓練やプロンプト作成に活用します。これにより対訳コーパスを低コストで拡張できますが、品質面でいくつかの注意点があります。

:::info[これはクックブックであり、完成した実装ではありません]
このガイドでは、戦略とその重要な落とし穴を概説します。逆翻訳は強力ですが、慎重に行わないとエラーを増幅させる可能性があります。
:::

## このアプローチを使うべき場面

- **ターゲット言語の単言語テキスト**はあるが、対訳データが限られている場合
- 手動翻訳なしで[ファインチューニング](./fine-tuned-model)用の**訓練コーパスを拡張**したい場合
- **few-shotの例文**がもっと必要だが、人手翻訳を十分な速さで入手できない場合
- 合成データに対して**積極的な品質フィルタリング**を行う意思がある場合

## 仕組み

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **単言語テキストを収集する** — ターゲット言語の書籍、記事、書き起こし、ソーシャルメディア
2. **逆翻訳する** — LLMまたはMT APIを使って各文をソース言語に翻訳する
3. **品質フィルタリングを行う** — ラウンドトリップ（再度翻訳して元に戻す）を実施し比較する。ラウンドトリップ結果が元のテキストに近いペアのみを保持する
4. **合成コーパスを活用する** — ファインチューニング、few-shotの例文、またはコーチングデータとして使用する

## 品質フィルタリング：ラウンドトリップテスト

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## 重大な落とし穴：エラーの増幅

:::warning[逆翻訳は既存のモデルバイアスを増幅させます]
逆翻訳モデルが一貫して同じエラーを犯す場合、合成コーパスはそれらのエラーを「正しい」ものとして記録してしまいます。これはフィードバックループを生み出します：質の低いデータで学習する → より質の低い翻訳を生成する → より質の低い合成データを生成する。**常に積極的に品質フィルタリングを行い**、合成データと検証済みの人間による翻訳を組み合わせてください。
:::

## 単言語テキストの入手先

- コミュニティのニュースレター、新聞、出版物
- ターゲット言語の政府文書（例：イヌクティトゥット語向けのヌナブト州ハンサード）
- 教育教材および教科書
- 宗教テキスト（多くの言語で広く入手可能）
- ソーシャルメディア（適切な許可と品質フィルタリングを行った上で）
- 言語プログラムの音声・映像の書き起こし

## メリットとデメリット

| | |
|---|---|
| ✅ 低コストで訓練データを拡張できる | ❌ フィルタリングしないとモデルエラーを増幅させる |
| ✅ 豊富な単言語テキストを活用できる | ❌ 品質の上限が逆翻訳モデルに依存する |
| ✅ 大規模に生成しやすい | ❌ ラウンドトリップフィルタリングは計算コストが高い |
| ✅ 他のアプローチと組み合わせやすい | ❌ 合成データは人手翻訳には及ばない |

## 組み合わせに適したアプローチ

- **[ファインチューニングモデル](./fine-tuned-model)** — 逆翻訳によってファインチューニング用の訓練データを作成できる
- **[コーパス作成](./corpus-creation)** — 合成データが人手作成コーパスを補完する
- **[コーチングLLMプロンプティング](./coached-llm-prompting)** — 合成例文がコーチング辞書の構築に役立てられる

## 関連情報

- [評価データセット](/docs/network/leaderboard/datasets) — 合成データは評価データと重複してはなりません
- [リーダーボードのルール](/docs/network/leaderboard/rules) — データ汚染に関するポリシー
- [低リソース言語のサポート](/docs/network/community/low-resource-languages)
