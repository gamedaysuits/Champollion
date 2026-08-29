---
sidebar_position: 9
title: "Cookbook: Evolutivo / Baseado em Busca"
---

# Tradução Evolutiva / Baseada em Busca

> **A ideia:** Gere múltiplos candidatos de tradução, avalie-os contra uma função de aptidão (chrF++, aceitação FST, consistência de tradução reversa), mutue os melhores desempenhos e repita. Seleção natural para traduções — os mais aptos sobrevivem.

:::info[Este é um cookbook, não uma implementação finalizada]
Esta é a abordagem mais experimental da série de cookbooks. Ela não foi comprovada para MT em escala, mas a arquitetura é sólida e o harness avaliará com prazer o que ela produzir.
:::

## Quando Usar Isso

- Você tem uma **boa função de avaliação**, mas nenhum modelo único produz resultados consistentes
- Você quer **explorar o espaço de soluções** de forma mais ampla do que uma única geração gulosa
- Você tem **orçamento computacional** para muitas gerações paralelas (dezenas de candidatos por entrada)
- Você está interessado em **pesquisa inovadora** — essa abordagem é pouco explorada para MT de baixo recurso

## Como Funciona

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

## Esqueleto

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

## Design da Função de Aptidão

A função de aptidão é tudo. Opções:

| Métrica | O Que Mede | Automatizada? |
|---------|-----------|---------------|
| chrF++ contra referência | Similaridade em nível de caractere com o ouro | ✅ Sim |
| Taxa de aceitação FST | Validade morfológica | ✅ Sim (se FST disponível) |
| Consistência de tradução reversa | A tradução reversa recupera a fonte? | ✅ Sim |
| LLM-como-juiz | Outro LLM avalia fluência/precisão | ✅ Sim (mas ruidoso) |
| Presença de termo em dicionário | Os termos conhecidos aparecem corretamente? | ✅ Sim |

:::tip[Combine múltiplos sinais]
Uma combinação ponderada de métricas cria uma função de fitness mais robusta do que qualquer métrica isolada. Isso espelha a [pontuação composta](/docs/network/leaderboard/rules) do próprio harness.
:::

## Prós e Contras

| | |
|---|---|
| ✅ Explora soluções diversas | ❌ Computacionalmente caro (N × G chamadas de API) |
| ✅ Pode descobrir abordagens que nenhum modelo único encontra | ❌ Requer uma boa função de aptidão |
| ✅ Paralelizável | ❌ Lento — múltiplas gerações por tradução |
| ✅ Agnóstico a modelo | ❌ Retornos decrescentes após algumas gerações |

## Combina Bem Com

- **[Modelos Encadeados](./chained-models)** — o passo de mutação é uma forma de encadeamento
- **[Pipeline com Portão FST](./fst-gated-pipeline)** — aceitação FST como sinal de aptidão
- **[LLM Aumentado com Dicionário](./dictionary-augmented-llm)** — presença em dicionário como sinal de aptidão

## Veja Também

- [Especificação de Run Card](/docs/network/specifications/run-card) — custo e latência são registrados por entrada
- [Eval Harness](/docs/network/specifications/harness) — o harness avalia seu resultado final, não seu processo
- [Suporte a Idioma de Baixo Recurso](/docs/network/community/low-resource-languages)
