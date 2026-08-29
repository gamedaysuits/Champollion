---
sidebar_position: 11
title: "Livro de Receitas: Criação de Corpus"
---

# Guia de Criação de Corpus

> **A ideia:** Antes de avaliar um método de tradução, você precisa de um corpus de avaliação. Este guia cobre como construir um do zero — sourcing de dados, requisitos de formato, padrões de qualidade, licenciamento e contribuição para a Network.

:::info[Este não é um método de tradução]
Este guia é um pré-requisito para muitos métodos. Um bom corpus de avaliação é a base que torna tudo mais possível. Até 50 pares curados são suficientes para abrir uma nova faixa no leaderboard.
:::

## Quando Usar Isso

- Você quer **adicionar um novo par de idiomas** ao leaderboard da Network
- Você é um **professor de idiomas** que quer avaliar traduções de alunos
- Você é um **trabalhador de linguagem comunitária** com acesso a materiais bilíngues
- Você é um **pesquisador** que precisa de um conjunto de avaliação padronizado para seu par de idiomas

## Formato do Corpus

O harness aceita JSON simples:

```json title="my-corpus.json"
{
  "metadata": {
    "name": "Quechua Dev v1",
    "version": "1.0.0",
    "source_language": "eng",
    "target_language": "que",
    "entry_count": 75,
    "license": "CC-BY-SA-4.0",
    "author": "Your Name / Organization",
    "description": "75 English-Quechua pairs from educational materials"
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello, how are you?",
      "reference": "Allillanchu, imaynallan kashanki?"
    },
    {
      "id": 2,
      "source": "The sun is shining today",
      "reference": "Kunan p'unchay inti k'anchashan"
    }
  ]
}
```

## Onde Obter Dados

| Fonte | Qualidade | Volume | Licenciamento |
|--------|---------|--------|-----------|
| **Livros didáticos / materiais educacionais** | Alta (revisada por especialistas) | Baixo-médio | Verifique com a editora |
| **Documentos governamentais** | Média (registro formal) | Médio-alto | Frequentemente domínio público |
| **Dicionários bilíngues** | Alta (entradas verificadas) | Médio | Varia |
| **Anciãos / falantes da comunidade** | Mais alta (intuição nativa) | Baixo (tempo limitado) | Governado pela comunidade |
| **Textos religiosos** | Média (específica do domínio) | Alta | Geralmente aberta |
| **Corpora existentes** (Hansard, FLORES) | Médio-alta | Alta | Verifique a licença |
| **Feito à mão** | Mais alta | Baixo | Você é o proprietário |

## Padrões de Qualidade

Um bom corpus de avaliação tem:

1. **Conteúdo diverso** — não apenas saudações ou frases simples. Inclua perguntas, comandos, sentenças complexas, termos específicos do domínio
2. **Traduções verificadas** — revisadas por pelo menos um falante fluente, idealmente dois
3. **Ortografia consistente** — um script, uma convenção de ortografia em todo o corpus
4. **Fontes independentes** — não derivadas do mesmo texto que os métodos treinarão
5. **Licenciamento claro** — licença explícita que permite uso em avaliação

:::danger[Contaminação do corpus]
O corpus de avaliação deve ser **independente** de qualquer dado de treinamento. Se um método foi treinado ou solicitado com dados do corpus de avaliação, ele será desqualificado. Projete seu corpus para ser mantido isolado desde o primeiro dia.
:::

## Diretrizes de Tamanho

| Tamanho | O Que Permite |
|------|----------------|
| **50 entradas** | Avaliação viável mínima — suficiente para detectar diferenças grosseiras de qualidade |
| **100–200 entradas** | Ranking confiável — suficiente para significância estatística entre métodos |
| **500+ entradas** | Nível de pesquisa — pontuações compostas robustas, intervalos de confiança |
| **1.000+ entradas** | Padrão ouro — equivalente à cobertura devtest do FLORES |

Comece pequeno. 50 entradas são suficientes para abrir uma faixa no leaderboard. Você pode expandir depois.

## Contribuindo para a Network

1. **Crie seu corpus** no formato JSON acima
2. **Licencie-o** — CC BY-SA 4.0 é recomendado para avaliação aberta; CC BY-NC-SA 4.0 para uso restrito
3. **Hospede-o em uma fonte estável** (seu próprio repositório, um arquivo institucional ou um registro de dados) — Champollion nunca hospeda ou rastreia conteúdo de corpus
4. **Envie um cartão de metadados fetch-from-source** — abra uma PR contra o [repositório público](https://github.com/gamedaysuits/Champollion) adicionando uma entrada de registro que aponte o harness para sua fonte upstream (loader/URL, SHA pin, licença, proveniência); veja [Datasets](/docs/network/leaderboard/datasets#creating-a-new-dataset) para o formato do cartão
5. **O leaderboard abre** para seu par de idiomas assim que o cartão é mesclado

## Para Comunidades de Línguas Indígenas

A criação de corpus é um ato de **soberania linguística**. Seu corpus, seus termos:

- Você decide a licença e as condições de acesso
- Você pode contribuir com um **conjunto de desenvolvimento público** (para desenvolvimento de métodos) enquanto mantém um **conjunto de teste secreto** (para avaliação oficial) sob controle comunitário
- O [framework de soberania](/docs/network/sovereignty/data-sovereignty) protege seus dados em todos os níveis

Até um corpus pequeno é um **ativo estratégico** — é o benchmark que decide o que significa "bom o suficiente" para seu idioma.

## Combina Bem Com

- **[Tradução Parcial](./partial-translation)** — criar um corpus É a etapa de tradução humana
- **[Tradução Reversa](./back-translation)** — dados sintéticos complementam corpora criados por humanos
- Todos os outros cookbooks — todos precisam de um corpus de avaliação

## Veja Também

- [Conjuntos de Dados de Avaliação](/docs/network/leaderboard/datasets) — corpora existentes (EDTeKLA, FLORES+)
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — propriedade e controle
- [Para Comunidades de Linguagem](/docs/network/community/for-language-communities) — engajamento comunitário
- [Apoiar uma Língua de Baixo Recurso](/docs/network/community/low-resource-languages) — a visão geral
