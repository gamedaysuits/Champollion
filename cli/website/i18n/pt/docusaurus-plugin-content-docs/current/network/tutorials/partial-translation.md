---
sidebar_position: 10
title: "Cookbook: Tradução Parcial (Humana + Máquina)"
---

# Tradução Parcial (Humana + Máquina)

> **A ideia:** Traduzir manualmente uma amostra representativa, comprovar que seu método de máquina corresponde ao estilo humano nessa amostra e depois traduzir automaticamente o restante em volume. Combina qualidade humana com escala de máquina — o humano estabelece o padrão, a máquina o segue.

:::info[Este é um cookbook, não uma implementação finalizada]
Este guia esboça o fluxo de trabalho híbrido humano-máquina. É especialmente relevante para agências de tradução, profissionais de línguas comunitárias e contextos educacionais.
:::

## Quando Usar Isso

- Você tem **acesso a falantes fluentes**, mas o tempo deles é limitado
- Você precisa traduzir um **grande volume**, mas apenas uma pequena parte precisa ser perfeita
- Você quer **estabelecer uma linha de base de qualidade** com tradução humana e depois escalar com MT
- Você está trabalhando em um **contexto educacional ou comunitário** onde a revisão humana de um subconjunto é viável

## Como Funciona

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **Selecione uma amostra representativa** — cubra diferentes tipos de frases, comprimentos e tópicos
2. **Traduza a amostra manualmente** — estabeleça o padrão ouro para estilo, registro e terminologia
3. **Configure seu método de máquina** — use as traduções humanas como dados de coaching, exemplos few-shot ou dados de fine-tuning
4. **Avalie a máquina na amostra humana** — a máquina corresponde ao estilo do humano?
5. **Traduza automaticamente o restante** — se a qualidade da máquina for aceitável na amostra
6. **Revisão humana opcional** — sinalize saídas com baixa confiança para revisão do falante

## Garantia de Qualidade: O Teste de Correspondência de Estilo

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## Selecionando a Amostra

**Cubra a distribuição.** Suas 100 entradas devem incluir:
- Frases curtas (1–3 palavras) e frases completas
- Vocabulário comum e termos específicos do domínio
- Estruturas simples e complexas
- Múltiplas características gramaticais (perguntas, imperativos, condicionais)

**Não escolha apenas as fáceis.** A amostra deve incluir entradas com as quais seu método provavelmente terá dificuldade — é aí que a qualidade humana importa mais.

## O Fluxo de Trabalho de Revisão Comunitária

Para comunidades de línguas indígenas, essa abordagem respeita o tempo do falante:

1. **Falante traduz 50–100 entradas** (2–4 horas de trabalho focado)
2. **Máquina traduz as 900 restantes** usando o trabalho do falante como dados de coaching
3. **Falante revisa entradas sinalizadas** — apenas aquelas em que a máquina teve menor confiança (mais 1–2 horas)
4. **Resultado:** 1.000 traduções com qualidade próxima à humana, com ~5 horas de tempo do falante em vez de ~50

## Prós e Contras

| | |
|---|---|
| ✅ Combina qualidade humana com escala de máquina | ❌ Requer investimento humano inicial |
| ✅ Respeita disponibilidade limitada do falante | ❌ Máquina pode não capturar todas as nuances estilísticas |
| ✅ Fluxo de trabalho natural de garantia de qualidade | ❌ Gargalo de revisão humana para entradas sinalizadas |
| ✅ Ótimo para contextos comunitários/educacionais | ❌ Seleção de amostra afeta a qualidade geral |

## Combina Bem Com

- **[Coached LLM Prompting](./coached-llm-prompting)** — traduções humanas informam os dados de coaching
- **[Few-Shot Prompting](./few-shot-prompting)** — traduções humanas como exemplos em contexto
- **[Corpus Creation](./corpus-creation)** — a amostra humana É criação de corpus

## Veja Também

- [For Language Communities](/docs/network/community/for-language-communities) — modelo de engajamento comunitário
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — propriedade dos dados de tradução
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
