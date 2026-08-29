---
sidebar_position: 2
title: "Cookbook: Prompting de LLM com Orientação"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Orientação de Prompts para LLM

> **A ideia:** Injete regras gramaticais, dicionários bilíngues e notas de estilo diretamente no prompt do sistema do LLM. Sem treinamento, sem fine-tuning — apenas conhecimento linguístico estruturado que orienta a saída para traduções válidas.

:::info[Este é um cookbook, não uma implementação finalizada]
Este guia esboça a abordagem e suas principais decisões de design. Adapte-o para seu par de idiomas, recursos disponíveis e objetivos de avaliação.
:::

## Quando Usar Isso

- Você tem **conhecimento linguístico** sobre o idioma de destino (regras gramaticais, entradas de dicionário, preferências de estilo), mas não dados paralelos suficientes para fine-tuning
- Você quer **iterar rapidamente** — mudanças de prompt são implantadas em segundos, sem retreinamento
- O idioma de destino tem **padrões conhecidos** que o LLM erra (concordância de gênero, convenções de script, níveis de formalidade)
- Você quer comparar a orientação de prompts com uma linha de base e iterar sobre o que funciona

## Como Funciona

1. **Reúna dados de orientação** — regras gramaticais, um dicionário bilíngue e notas de estilo em um arquivo JSON estruturado
2. **Configure o registro** — um prefixo de prompt do sistema que define o idioma, script e tom
3. **Execute o harness** — os dados de orientação são injetados em cada prompt do LLM
4. **Revise falhas** — veja o que o quality gate rejeita, adicione regras para abordar padrões
5. **Itere** — cada revisão do arquivo de orientação é um novo experimento; o harness rastreia todos eles

## Estrutura de Dados de Orientação

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## Decisões de Design Principais

**Especificidade de regras vs. janela de contexto:** Mais regras dão ao LLM mais orientação, mas consomem a janela de contexto disponível para tradução real. Comece com 5–10 regras de alto impacto e adicione mais apenas quando você vir padrões de falha específicos.

**Cobertura de dicionário:** Você não precisa de um dicionário completo — concentre-se em termos que o LLM consistentemente erra. Mesmo 20–30 termos forçados podem melhorar drasticamente a consistência.

**A ordem das regras importa:** Coloque as regras mais importantes primeiro. LLMs prestam mais atenção às instruções iniciais.

## Executando um Experimento

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## Prós e Contras

| | |
|---|---|
| ✅ Custo zero de treinamento | ❌ Teto de qualidade limitado pelo conhecimento base do LLM |
| ✅ Iteração instantânea (mude o prompt → re-execute) | ❌ Limites de janela de contexto quanto coaching cabe |
| ✅ Funciona com qualquer provedor de LLM | ❌ Regras podem conflitar — debugar interações de prompt é uma arte |
| ✅ Transparente — você pode ler exatamente o que o LLM vê | ❌ Não cria novo conhecimento, apenas orienta o conhecimento existente |

## Combina Bem Com

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — orientação + validação morfológica captura o que orientação sozinha perde
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — terminologia forçada é uma forma de orientação
- **[Few-Shot Prompting](./few-shot-prompting)** — exemplos + regras juntos são mais poderosos que qualquer um sozinho

## Veja Também

- [Method Interface](/docs/network/specifications/methods) — formato de dados de orientação e o protocolo TranslationMethod
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — o contexto completo
- [Eval Harness](/docs/network/specifications/harness) — como executar experimentos
