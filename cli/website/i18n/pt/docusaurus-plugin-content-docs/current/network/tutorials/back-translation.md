---
sidebar_position: 8
title: "Cookbook: Aumento por Back-Translation"
---

# Aumento por Retro-Tradução

> **A ideia:** Gerar dados paralelos sintéticos traduzindo texto existente em língua-alvo de volta para a língua-fonte, depois usar esses pares sintéticos para treinar ou fazer prompt de um modelo direto. Isso expande seu corpus paralelo de forma barata — mas com ressalvas sobre qualidade.

:::info[Este é um cookbook, não uma implementação finalizada]
Este guia esboça a estratégia e seus riscos críticos. Back-translation é poderoso, mas pode amplificar erros se não for feito com cuidado.
:::

## Quando Usar Isso

- Você tem **texto monolíngue em língua-alvo** mas dados paralelos limitados
- Você quer **expandir um corpus de treinamento** para [fine-tuning](./fine-tuned-model) sem tradução manual
- Você precisa de **mais exemplos few-shot** mas não consegue traduções humanas rápido o suficiente
- Você está disposto a **filtrar qualidade** dos dados sintéticos agressivamente

## Como Funciona

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

1. **Coletar texto monolíngue** — livros, artigos, transcrições, mídia social em língua-alvo
2. **Retro-traduzir** — usar um LLM ou API de MT para traduzir cada sentença para a língua-fonte
3. **Filtrar qualidade** — fazer tradução de ida e volta (traduzir novamente) e comparar; manter pares onde a volta ≈ original
4. **Usar o corpus sintético** — para fine-tuning, exemplos few-shot ou dados de coaching

## Filtragem de Qualidade: O Teste de Ida e Volta

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

## Risco Crítico: Amplificação de Erros

:::warning[Back-translation amplifica vieses existentes do modelo]
Se seu modelo de back-translation cometer consistentemente os mesmos erros, seu corpus sintético codificará esses erros como "corretos". Isso cria um loop de feedback: treinar com dados ruins → produzir piores traduções → gerar piores dados sintéticos. **Sempre filtre qualidade agressivamente** e misture dados sintéticos com traduções humanas verificadas.
:::

## Onde Encontrar Texto Monolíngue

- Boletins comunitários, jornais e publicações
- Documentos governamentais em língua-alvo (ex: Hansard de Nunavut para inuktitut)
- Materiais educacionais e livros didáticos
- Textos religiosos (amplamente disponíveis para muitas línguas)
- Mídia social (com permissões apropriadas e filtragem de qualidade)
- Áudio/vídeo transcrito de programas de língua

## Prós e Contras

| | |
|---|---|
| ✅ Expande dados de treinamento de forma barata | ❌ Amplifica erros do modelo se não filtrado |
| ✅ Usa texto monolíngue abundante | ❌ Teto de qualidade limitado pelo modelo de retro-tradução |
| ✅ Fácil de gerar em escala | ❌ Filtragem de ida e volta é computacionalmente intensiva |
| ✅ Complementa outras abordagens | ❌ Dados sintéticos nunca são tão bons quanto tradução humana |

## Combina Bem Com

- **[Modelo Fine-Tuned](./fine-tuned-model)** — retro-tradução cria dados de treinamento para fine-tuning
- **[Criação de Corpus](./corpus-creation)** — dados sintéticos complementam corpora criados por humanos
- **[Coached LLM Prompting](./coached-llm-prompting)** — exemplos sintéticos podem informar dicionários de coaching

## Veja Também

- [Datasets de Avaliação](/docs/network/leaderboard/datasets) — dados sintéticos não devem sobrepor dados de avaliação
- [Regras do Leaderboard](/docs/network/leaderboard/rules) — política de contaminação
- [Suporte a Língua de Baixo Recurso](/docs/network/community/low-resource-languages)
