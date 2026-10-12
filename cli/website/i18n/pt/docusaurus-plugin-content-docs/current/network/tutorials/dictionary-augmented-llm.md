---
sidebar_position: 4
title: "Cookbook: LLM Aumentado com Dicionário"
---

# LLM Aumentado com Dicionário

> **A ideia:** Force traduções conhecidas e verificadas para termos específicos de um dicionário bilíngue, e deixe o LLM lidar com estrutura de sentença e vocabulário desconhecido. O dicionário fornece âncoras de correção; o LLM fornece fluência.

:::info[Este é um cookbook, não uma implementação finalizada]
Este guia esboça a abordagem. A estratégia específica de correspondência de dicionário e injeção dependerá do seu par de idiomas e dos recursos léxicais disponíveis.
:::

## Quando Usar Isso

- Um **dicionário bilíngue existe** para seu par de idiomas (mesmo que pequeno)
- O LLM **alucina consistentemente termos-chave** — inventando palavras que não existem
- Você precisa de **consistência terminológica** entre traduções (mesma palavra traduzida da mesma forma em todos os lugares)
- Você está traduzindo **conteúdo específico de domínio** onde as traduções padrão do LLM estão erradas (jurídico, médico, educacional)

## Como Funciona

1. **Carregue um dicionário bilíngue** — pares chave→valor mapeando termos de origem para traduções alvo verificadas
2. **Corresponda o texto de origem contra o dicionário** — identifique termos na entrada que têm traduções conhecidas
3. **Injete correspondências no prompt** — diga ao LLM "estes termos DEVEM ser traduzidos da seguinte forma"
4. **LLM gera tradução** — com restrições de dicionário como requisitos obrigatórios
5. **Pós-processamento** — verifique se os termos do dicionário aparecem na saída; tente novamente se não aparecerem

## Formato do Dicionário

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

## Estrutura do Prompt

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## Decisões de Design Principais

**Estratégia de correspondência:** Correspondência exata é a mais simples. Correspondência lematizada ("teachers" corresponde a "teacher") captura mais, mas requer um lematizador de idioma de origem. Correspondência difusa corre o risco de falsos positivos.

**Tratamento de flexão:** Em idiomas polissintéticos, a forma do dicionário pode precisar de flexão para se adequar à sentença. Você pode fornecer a raiz e deixar o LLM flexionar, ou fornecer múltiplas formas flexionadas. Um [FST](./fst-gated-pipeline) pode validar o resultado.

**Resolução de conflitos:** E se o LLM ignorar um termo do dicionário? Opções: (a) tente novamente com instrução mais forte, (b) pós-processe por substituição de string, (c) aceite e sinalize para revisão.

## Prós e Contras

| | |
|---|---|
| ✅ Elimina alucinação para termos conhecidos | ❌ Cobertura de dicionário é sempre incompleta |
| ✅ Garante consistência para vocabulário-chave | ❌ Flexão/conjugação pode não corresponder ao contexto da sentença |
| ✅ Fácil de auditar e atualizar | ❌ Sobre-restrição pode produzir saída não natural |
| ✅ Dicionário é um ativo reutilizável | ❌ Requer que um dicionário exista em primeiro lugar |

## Onde Encontrar Dicionários

- **[itwêwina](https://itwewina.altlab.app/)** — Plains Cree–Inglês (baseado em FST; a plataforma morphodict é de código aberto — o conteúdo do dicionário em si não possui licença aberta)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — referência abrangente de Plains Cree (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — dicionários bilíngues para dezenas de pares de idiomas
- **[Giellatekno](https://giellalt.github.io/)** — dicionários para idiomas sami, urálicos e outras línguas minoritárias
- Glossários criados pela comunidade, materiais educacionais, listas de termos

## Combina Bem Com

- **[Coached LLM Prompting](./coached-llm-prompting)** — entradas de dicionário são uma forma de dados de coaching
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST valida que termos do dicionário estão corretamente flexionados
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — busca de dicionário determinística como uma camada de regra

## Veja Também

- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — o contexto completo
- [Method Interface](/docs/network/specifications/methods) — como métodos são estruturados
