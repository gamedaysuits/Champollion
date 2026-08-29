---
sidebar_position: 9
title: "Cookbook: 进化/搜索型方法"
---

# 进化/搜索型翻译

> **核心思想：** 生成多个候选翻译，用适应度函数（chrF++、FST 接受率、往返一致性）对其评分，对表现最好的候选进行变异，然后重复。自然选择应用于翻译——适应度最高的存活下来。

:::info[这是一份食谱，不是完成的实现]
这是食谱系列中最具实验性的方法。它还未在大规模机器翻译中得到验证，但架构是合理的，测试框架会乐意对其产生的任何结果进行评分。
:::

## 何时使用此方案

- 你有一个**良好的评分函数**，但没有单个模型能产生一致的结果
- 你想**更广泛地探索解空间**，而不仅仅是单个贪心生成
- 你有**计算预算**用于许多并行生成（每个输入数十个候选）
- 你对**新颖研究**感兴趣——这种方法在低资源机器翻译中尚未充分探索

## 工作原理

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

## 框架

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

## 适应度函数设计

适应度函数至关重要。选项包括：

| 指标 | 测量内容 | 自动化？ |
|--------|-----------------|------------|
| 针对参考译文的 chrF++ | 与黄金标准的字符级相似度 | ✅ 是 |
| FST 接受率 | 形态学有效性 | ✅ 是（如果有 FST） |
| 往返一致性 | 反向翻译能否恢复源文本？ | ✅ 是 |
| LLM 作为评判者 | 另一个 LLM 评估流畅度/准确度 | ✅ 是（但有噪声） |
| 词典术语出现 | 已知术语是否正确出现？ | ✅ 是 |

:::tip[组合多个信号]
多个指标的加权组合比任何单一指标都能形成更稳健的适应度函数。这与测试框架自身的[复合评分](/docs/network/leaderboard/rules)相呼应。
:::

## 优缺点

| | |
|---|---|
| ✅ 探索多样化的解决方案 | ❌ 计算成本高（N × G 次 API 调用） |
| ✅ 可以发现单个模型无法找到的方法 | ❌ 需要良好的适应度函数 |
| ✅ 可并行化 | ❌ 速度慢——每次翻译需要多代迭代 |
| ✅ 模型无关 | ❌ 几代之后收益递减 |

## 配合良好的方案

- **[链式模型](./chained-models)** — 变异步骤是一种链式形式
- **[FST 门控管道](./fst-gated-pipeline)** — FST 接受率作为适应度信号
- **[词典增强型 LLM](./dictionary-augmented-llm)** — 词典术语出现作为适应度信号

## 另请参阅

- [运行卡规范](/docs/network/specifications/run-card) — 成本和延迟按条目记录
- [评估工具](/docs/network/specifications/harness) — 工具评估你的最终输出，而非你的过程
- [支持低资源语言](/docs/network/community/low-resource-languages)
