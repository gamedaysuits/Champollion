---
sidebar_position: 3
title: "Cookbook: Prompting com Poucos Exemplos"
---

# Few-Shot Prompting

> **A ideia:** Inclua pares de tradução verificados e de alta qualidade como exemplos em contexto para que o LLM aprenda os padrões, estilo e convenções da língua alvo por demonstração em vez de instrução.

:::info[Este é um cookbook, não uma implementação finalizada]
Este guia esboça a abordagem e suas principais decisões de design. Adapte-o para seu par de idiomas e recursos disponíveis.
:::

## Quando Usar Isso

- Você tem um **pequeno conjunto de traduções verificadas** (até 5–10 pares de ouro ajudam)
- Você quer que o LLM corresponda a um **estilo ou registro específico** por exemplo em vez de regra
- Sua língua alvo tem padrões que são **mais fáceis de mostrar do que descrever** (ordem das palavras, padrões de afixação, marcadores de formalidade)

## Como Funciona

1. **Curar pares de exemplo** — selecione traduções fonte→alvo de alta qualidade que demonstrem padrões-chave
2. **Formatar como exemplos em contexto** — inclua-os no prompt do sistema ou do usuário antes da solicitação de tradução real
3. **Executar o harness** — meça se os exemplos melhoram as métricas em relação ao zero-shot
4. **Iterar na seleção de exemplos** — troque exemplos para cobrir diferentes modos de falha

## Estrutura de Prompt de Exemplo

```
You are translating English to Plains Cree (SRO orthography).

Examples of correct translations:
- "Hello" → "tânisi"
- "Thank you" → "kinanâskomitin"  
- "I am going home" → "nikîwân"
- "The children are playing" → "awâsisak mêtawêwak"

Now translate the following:
- "Welcome to the school"
```

## Regra Crítica: Sem Contaminação de Dados de Avaliação

:::danger[NÃO use dados de avaliação como exemplos few-shot]
Se seus exemplos vêm do conjunto de dados de avaliação, seu método será **desqualificado** do leaderboard. Exemplos few-shot devem vir de fontes independentes — dicionários, livros didáticos, pares verificados pela comunidade, ou um conjunto de desenvolvimento separado. O harness faz fingerprint do seu prompt exato; contaminação é detectável.
:::

## Decisões de Design Principais

**Quantos exemplos?** 3–8 é o ponto ideal. Menos dá ao LLM muito pouco sinal; mais consome a janela de contexto com retornos decrescentes.

**Quais exemplos?** Priorize diversidade em vez de dificuldade. Cubra diferentes estruturas de sentença, comprimentos de palavras e características gramaticais. Não agrupe exemplos em torno de um padrão.

**Seleção estática vs. dinâmica?** Exemplos estáticos são mais simples. Seleção dinâmica (escolher exemplos semelhantes à entrada atual) pode melhorar a qualidade, mas adiciona complexidade — considere [modelos encadeados](./chained-models) para a etapa de recuperação.

## Prós e Contras

| | |
|---|---|
| ✅ Poderoso para correspondência de estilo | ❌ Pequena janela de contexto limita a contagem de exemplos |
| ✅ Sem treinamento necessário | ❌ Seleção de exemplos é uma arte, não uma ciência |
| ✅ Funciona com qualquer LLM | ❌ Risco de contaminação de dados de avaliação (desqualificação) |
| ✅ Fácil de fazer testes A/B com diferentes conjuntos de exemplos | ❌ Exemplos podem não generalizar para todos os tipos de entrada |

## Combina Bem Com

- **[Coached LLM Prompting](./coached-llm-prompting)** — regras + exemplos juntos vencem qualquer um sozinho
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — termos forçados + exemplos de estilo
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — exemplos para estilo, FST para correção morfológica

## Veja Também

- [MT Evaluation Rules](/docs/network/leaderboard/rules) — o que é desqualificado
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — saiba o que você NÃO PODE usar como exemplos
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
