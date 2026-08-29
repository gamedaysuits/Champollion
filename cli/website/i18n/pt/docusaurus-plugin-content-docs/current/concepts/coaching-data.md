---
sidebar_position: 5
title: "Dados de Coaching"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Dados de Coaching

Dados de coaching é o mecanismo do champollion para ensinar LLMs sobre idiomas nos quais não foram treinados. Ao fornecer regras gramaticais, dicionários e notas de estilo junto com cada solicitação de tradução, você transforma um LLM de propósito geral em um tradutor ciente do contexto para qualquer idioma — incluindo idiomas sem suporte de MT existente.

## Como Funciona

Quando você define o método de um par como `llm-coached`, o champollion carrega um arquivo de coaching de `.champollion/coaching/<locale>.json` e injeta seu conteúdo em cada prompt do LLM como parte da mensagem do sistema. O LLM vê suas regras linguísticas junto com a solicitação de tradução, produzindo saída que segue sua gramática e terminologia em vez de adivinhar.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Existem dois tipos de conteúdo de coaching:

1. **Dados de coaching estruturados** (método `llm-coached`) — Regras gramaticais, dicionários e notas de estilo em formato JSON. Carregados de `.champollion/coaching/<locale>.json` ou do diretório `coaching/` de um plugin.
2. **Prompt de coaching em texto livre** (campo de configuração `coachingFile`) — Um arquivo de texto simples com orientação adicional injetada no prompt do sistema. Funciona com qualquer método de LLM, não apenas `llm-coached`. Defina via `coachingFile` em sua configuração ou `--coaching-file` na CLI.

Ambos podem ser usados juntos. O harness de avaliação usa a mesma estrutura de prompt — então suas pontuações de benchmark refletem seus prompts de produção reais.

Como os dados de coaching fazem parte da mensagem do sistema, eles se beneficiam do **prompt caching** — provedores como Anthropic e Google armazenam em cache prefixos de sistema repetidos, então você paga pelo contexto de coaching uma vez por sessão, não uma vez por lote.

## Formato do Arquivo de Coaching

Crie um arquivo JSON por locale em `.champollion/coaching/`:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | Não | Array de regras gramaticais injetadas no prompt do sistema. Cada regra deve ser uma instrução concisa e acionável que o LLM possa seguir. |
| `dictionary` | `object` | Não | Mapa chave-valor de termo em inglês → termo no idioma de destino. Usado para vocabulário específico do domínio que o LLM não conheceria. |
| `style_notes` | `string` | Não | Instruções de estilo em forma livre (registro, tom, convenções de formalidade). |

Todos os campos são opcionais — você pode começar com apenas um dicionário e adicionar regras gramaticais conforme refina.

## Comportamento de Fallback

Se um par está configurado para `llm-coached` mas nenhum arquivo de coaching existe para esse locale, o champollion **volta para o método padrão `llm`** com um aviso no console:

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Isso significa que você pode definir `"defaultMethod": "llm-coached"` globalmente com segurança — idiomas com dados de coaching os usarão, e o resto receberá tradução padrão de LLM sem erros.

## Quando Usar Coaching

| Cenário | Método Recomendado |
|----------|-------------------|
| Idiomas Tier 1 (Francês, Espanhol, Alemão) | `llm` ou `google-translate` — LLMs já conhecem bem esses idiomas |
| Idiomas Tier 2 (Coreano, Turco, Tailandês) | `llm` com um registro — LLMs lidam adequadamente com esses idiomas com orientação de estilo |
| Idiomas Tier 3 (Plains Cree, Iorubá, Quíchua) | `llm-coached` — LLMs precisam de regras gramaticais e dicionários |
| Conlangs (Klingon, Sindarin, Kryptoniano) | `llm-coached` — LLMs têm alguns dados de treinamento mas precisam de correções |

## Construindo Bons Dados de Coaching

### Regras Gramaticais

Escreva regras como **instruções**, não descrições. O LLM segue instruções melhor do que interpreta teoria linguística.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### Dicionários

Foque em **termos específicos do domínio** que o LLM acertaria ou inventaria. Não se preocupe com palavras comuns que o LLM já lida — foque nos termos específicos da UI da sua aplicação.

### Notas de Estilo

Seja específico sobre registro, formalidade e convenções:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Testando Traduções com Coaching

Use o [MT Eval Harness](https://github.com/gamedaysuits/Champollion) para fazer benchmark de suas traduções com coaching contra um corpus de referência:

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

Isso fornece pontuações chrF++, BLEU e correspondência exata. Crie múltiplas versões de arquivo de coaching e compare — métricas objetivas superam revisão subjetiva.

---

## Veja Também

- [Métodos de Tradução](/docs/guides/translation-methods) — o método llm-coached
- [Suporte a um Idioma de Baixos Recursos](/docs/network/community/low-resource-languages) — coaching na prática
- [Especificação de Plugin](/docs/reference/plugin-spec) — empacotando dados de coaching em um plugin
- [Quality Gate](/docs/concepts/quality-gate) — como traduções com coaching são validadas
- [Configuração](/docs/getting-started/configuration) — configuração de coaching por par
