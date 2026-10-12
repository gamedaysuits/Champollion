---
sidebar_position: 6
title: "Cookbook: Modelos Encadeados"
---

# Modelos Encadeados (Pipeline Multi-Estágio)

> **A ideia:** Modelo A gera uma tradução bruta → Modelo B faz pós-edição → Modelo C avalia ou valida o resultado. Cada estágio se especializa em uma coisa. A saída do pipeline é melhor do que qualquer modelo único sozinho.

:::info[Este é um cookbook, não uma implementação finalizada]
Este guia esboça a arquitetura de pipeline multi-estágio. Os modelos específicos e a configuração da cadeia dependem do seu par de idiomas e orçamento.
:::

## Quando Usar Isso

- Um único modelo produz **qualidade inconsistente** — bom em algumas entradas, ruim em outras
- Você quer **separar geração de validação** — um modelo cria, outro critica
- Você tem orçamento para **múltiplas chamadas de API por tradução** (latência e custo escalam linearmente com os estágios)
- Você quer combinar modelos com **diferentes pontos fortes** (por exemplo, um gerador criativo + um editor preciso)

## Como Funciona

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## Exemplo: Pipeline de Três Estágios

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

## Padrões Comuns de Cadeia

| Padrão | Estágios | Caso de Uso |
|---------|----------|----------|
| **Gerar → Editar** | LLM rápido → LLM forte | Melhoria de qualidade eficiente em custo |
| **Gerar → Validar → Tentar Novamente** | LLM → FST/regras → LLM (tentar novamente em caso de falha) | Correção morfológica (veja [FST-Gated](./fst-gated-pipeline)) |
| **Gerar → Traduzir de Volta → Avaliar** | LLM(en→crk) → LLM(crk→en) → comparar | Verificação de consistência de ida e volta |
| **Ensemble → Votação** | 3 LLMs independentemente → votação por maioria | Robustez através da diversidade |

## Decisões de Design Principais

**Orçamento de latência:** Cada estágio multiplica a latência. Uma cadeia de 3 estágios com 2s por estágio = 6s por tradução. Para avaliação em lote isso é aceitável; para tempo real pode não ser.

**Multiplicador de custo:** 3 estágios = 3× o custo da API. Use modelos mais baratos para estágios iniciais, modelos caros para estágios críticos.

**Propagação de erros:** Uma saída ruim do Estágio 1 pode enganar o Estágio 2. Inclua a fonte original em cada estágio para que modelos posteriores possam se recuperar.

## Prós e Contras

| | |
|---|---|
| ✅ Pode combinar pontos fortes de especialistas | ❌ Latência e custo se multiplicam por estágio |
| ✅ Separação de responsabilidades (gerar vs. validar) | ❌ Complexo para depurar — qual estágio introduziu o erro? |
| ✅ Fácil trocar estágios individuais | ❌ Propagação de erros entre estágios |
| ✅ Validação de ida e volta detecta alucinações | ❌ Retornos decrescentes além de 2-3 estágios |

## Combina Bem Com

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST como um estágio de validação
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — injeção de dicionário no estágio de geração
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching em um ou mais estágios

## Veja Também

- [Eval Harness](/docs/network/specifications/harness) — o harness mede a saída do pipeline de ponta a ponta
- [Run Card Specification](/docs/network/specifications/run-card) — latência e custo são registrados por entrada
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
