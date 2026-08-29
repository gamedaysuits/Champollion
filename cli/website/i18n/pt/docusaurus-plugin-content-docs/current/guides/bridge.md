---
sidebar_position: 8
title: "A Ponte do Eval Harness"
description: "Como o MT Eval Harness e o Champollion trabalham juntos — da pesquisa para a produção e vice-versa."
related:
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: arena
    note: "The harness specification itself"
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Benchmark coaching data with the harness"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit registers with the harness, mid-cookbook"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
---

# A Ponte do Eval Harness

champollion e o MT Eval Harness são duas ferramentas separadas que formam um único ecossistema. O harness é onde métodos de tradução são **comprovados**. Champollion é onde métodos comprovados são **implantados**. Eles se conectam através de um formato de plugin compartilhado.

```mermaid
graph LR
    H["MT Eval Harness\n(Python)\nDevelop and benchmark"] -->|"method.json\n+ coaching data"| R["champollion\n(Node.js)\nDeploy and translate"]
    R -->|"Speaker feedback\nimproves the method"| H
```

## O Fluxo: Pesquisa → Produção

### 1. Construa um método no harness

Qualquer classe Python que implemente `async translate(entries, config) → [{id, predicted}]` pode se conectar ao harness. O harness não se importa com o que acontece dentro — LLM com prompt, modelo treinado customizado, regras determinísticas, qualquer coisa.

### 2. Faça benchmark

O harness avalia seu método contra um corpus padronizado com métricas reproduzíveis: chrF++, aceitação FST (para idiomas morfologicamente ricos), precisão morfológica e pontuação semântica.

### 3. Exporte como um plugin

Quando seu método atinge qualidade aceitável, empacote-o como um plugin champollion — um manifesto `method.json` com dados de coaching opcionais.

:::info[Export CLI é planejado]
Atualmente, você cria o manifesto method.json manualmente. O comando `mt-eval export` automatizará isso. Veja a [Interface de Método](/docs/network/specifications/methods) para o formato completo do plugin.
:::

### 4. Instale no champollion

```bash
champollion plugin install ./my-method-plugin/
```

### 5. Traduza conteúdo real

```bash
champollion sync
```

Seu método com benchmark agora está produzindo traduções reais em produção.

## O Fluxo: Produção → Pesquisa

Traduções implantadas são revisadas por falantes bilíngues. Seu feedback identifica erros sistemáticos (padrões de tempo incorretos, vocabulário faltante, fraseado não natural). O pesquisador atualiza o método no harness, faz novo benchmark, re-exporta e reimplanta. O sistema aprende com o uso.

## O Formato do Plugin

O manifesto `method.json` é o contrato entre as duas ferramentas:

```json
{
  "name": "crk-coached-v3",
  "type": "llm-coached",
  "version": "3.0.0",
  "description": "Coached LLM translation for Plains Cree",
  "locales": ["crk"],
  "config": {
    "model": "google/gemini-3.5-flash",
    "temperature": 0.3
  },
  "benchmarks": {
    "crk": {
      "composite_score": 0.67,
      "fst_acceptance": 0.82,
      "corpus_size": 150
    }
  }
}
```

Veja a [Especificação de Plugin](/docs/reference/plugin-spec) para o formato completo.

## O Que Está Construído vs. Planejado

| Componente | Status |
|-----------|--------|
| Protocolo TranslationMethod | ✅ Construído |
| Executor de benchmark do harness | ✅ Construído |
| Formato de plugin method.json | ✅ Construído |
| `champollion plugin install/remove/list` | ✅ Construído |
| Carregamento de dados de coaching | ✅ Construído |
| CLI `mt-eval export` | 🔲 Planejado |
| Interface de revisão comunitária | 🔲 Planejado |
| Avaliação de conjunto de testes criptográfico | 🔲 Planejado |

## Leitura Adicional

- [Métodos de Tradução](/docs/guides/translation-methods) — todos os métodos disponíveis e como eles funcionam
- [Especificação de Plugin](/docs/reference/plugin-spec) — o formato method.json
- [Servindo um Método via API](/docs/guides/serving-a-method) — hospedando um método no lado do servidor
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — princípios indígenas de soberania de dados, CARE e proteção criptográfica
- [Para Pesquisadores de Tradução Automática](/docs/network/leaderboard/rules) — a documentação do eval harness
