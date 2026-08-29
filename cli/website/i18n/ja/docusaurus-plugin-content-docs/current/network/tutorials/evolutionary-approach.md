---
sidebar_position: 9
title: "クックブック：進化的・探索ベースの手法"
---

# 進化的／探索ベースの翻訳

> **アイデア：** 複数の候補翻訳を生成し、適応度関数（chrF++、FST受理、ラウンドトリップ一貫性）でスコアリングし、上位の候補を変異させて繰り返す。翻訳における自然選択 — 最も適したものが生き残る。

:::info[これはクックブックであり、完成した実装ではありません]
これはクックブックシリーズの中で最も実験的なアプローチです。大規模な機械翻訳での実績はまだありませんが、アーキテクチャは堅実であり、ハーネスは生成された結果を問題なくスコアリングできます。
:::

## このアプローチを使うべき場面

- **優れたスコアリング関数**はあるが、単一のモデルでは一貫した結果が得られない場合
- 単一の貪欲な生成よりも**広く解空間を探索**したい場合
- 多数の並列生成（入力ごとに数十の候補）のための**計算リソース**がある場合
- **新しい研究**に関心がある場合 — このアプローチは低リソースMTにおいてまだ十分に探索されていません

## 仕組み

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## スケルトン

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## 適応度関数の設計

適応度関数がすべてです。選択肢：

| メトリクス | 測定対象 | 自動化可能？ |
|--------|-----------------|------------|
| 参照訳に対するchrF++ | ゴールドとの文字レベルの類似度 | ✅ 可能 |
| FST受理率 | 形態論的妥当性 | ✅ 可能（FSTが利用可能な場合） |
| ラウンドトリップ一貫性 | 逆翻訳でソースを復元できるか？ | ✅ 可能 |
| LLM-as-judge | 別のLLMが流暢さ／正確さを評価 | ✅ 可能（ただしノイズあり） |
| 辞書用語の存在 | 既知の用語が正しく出現しているか？ | ✅ 可能 |

:::tip[複数のシグナルを組み合わせる]
複数の指標を重み付けして組み合わせることで、単一の指標よりも堅牢なフィットネス関数を構築できます。これはハーネス自身の[複合スコア](/docs/network/leaderboard/rules)と同じ考え方を反映しています。
:::

## メリットとデメリット

| | |
|---|---|
| ✅ 多様な解を探索できる | ❌ 計算コストが高い（N × G回のAPIコール） |
| ✅ 単一モデルでは発見できないアプローチを見つけられる | ❌ 優れた適応度関数が必要 |
| ✅ 並列化可能 | ❌ 低速 — 翻訳ごとに複数世代が必要 |
| ✅ モデル非依存 | ❌ 数世代後は収穫逓減が生じる |

## 組み合わせに適したアプローチ

- **[Chained Models](./chained-models)** — 変異ステップはチェーニングの一形態
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — 適応度シグナルとしてのFST受理
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 適応度シグナルとしての辞書用語の存在

## 関連情報

- [Run Card仕様](/docs/network/specifications/run-card) — コストとレイテンシはエントリごとに記録されます
- [Eval Harness](/docs/network/specifications/harness) — ハーネスはプロセスではなく最終出力をスコアリングします
- [低リソース言語のサポート](/docs/network/community/low-resource-languages)
