---
sidebar_position: 5
title: "Dados de Coaching"
related:
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: tutorial
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Dados de Coaching

Os dados de coaching são o mecanismo do Champollion para fornecer a um LLM o que ele não sabe sobre um idioma. Ao fornecer regras gramaticais, dicionários e notas de estilo junto com cada solicitação de tradução, você dá a um LLM de uso geral o contexto que lhe falta — algo muito útil para idiomas que nenhum serviço de MT atende bem. Isso não pode ensinar a um modelo um idioma que ele nunca viu; meça o que um método com coaching realmente faz usando a [bancada de avaliação](/docs/network/specifications/harness) antes de confiar nele.

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

1. **Dados de coaching estruturados** (método `llm-coached`) — Regras gramaticais, dicionários e notas de estilo no formato JSON. Carregados a partir de `.champollion/coaching/<locale>.json` ou do diretório `coaching/` de um plugin. Seu `dictionary` também funciona como o glossário do projeto: cada método LLM (`llm`, `openai`, `anthropic`, `gemini`, `local`) é informado sobre os termos de glossário contidos em cada lote, o DeepL o envia como um glossário, e o sync emite um aviso quando a saída de qualquer método omite um termo. As regras gramaticais e notas de estilo são lidas apenas por `llm-coached` — em qualquer provedor (`"provider": "openai"`, `"local"`, …).
2. **Prompt de coaching em texto livre** (campo de configuração `coachingFile`) — Um arquivo de texto simples com orientações adicionais injetadas no prompt de sistema. Funciona com qualquer método LLM, não apenas com o `llm-coached`. Definido via `coachingFile` na sua configuração ou `--coaching-file` na CLI.

Ambos podem ser usados juntos. Note que a bancada de avaliação não monta o mesmo prompt: ela envia um arquivo de coaching como todo o prompt do sistema, enquanto `champollion sync` o posiciona dentro de seu próprio prompt de tradução. Uma pontuação com coaching da bancada é, portanto, um guia para a saída da CLI, não uma medição dela — meça a própria saída da CLI nas suas frases de teste antes de confiar nela.

Como os dados de coaching fazem parte da mensagem do sistema, eles se beneficiam do **prompt caching** — provedores como Anthropic e Google armazenam em cache prefixos de sistema repetidos, então você paga pelo contexto de coaching uma vez por sessão, não uma vez por lote.

## Formato do Arquivo de Coaching

Crie um arquivo JSON por localidade em `.champollion/coaching/`. O exemplo
abaixo é para um idioma fictício sob `qaa`, um código de uso privado que nenhum
idioma real possui: cada regra e termo nele presente é apenas ilustrativo, não um fato sobre nenhum
idioma. Escreva o seu próprio, idealmente com um falante da língua, e obtenha os
termos do dicionário a partir de uma fonte que você possa citar.

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
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
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Isso significa que você pode definir `"defaultMethod": "llm-coached"` globalmente com segurança — idiomas com dados de coaching os usarão, e o resto receberá tradução padrão de LLM sem erros.

## Quando Usar Coaching

| Cenário | Método recomendado |
|----------|-------------------|
| Idiomas de altos recursos (francês, espanhol, alemão) | `llm` ou `google-translate` — os LLMs já conhecem bem esses idiomas |
| Idiomas de recursos médios (coreano, turco, tailandês) | `llm` com um registro — os LLMs lidam adequadamente com eles quando recebem orientação de estilo |
| Idiomas de baixos recursos (cree das planícies, iorubá, quéchua) | `llm-coached` — os LLMs precisam de regras gramaticais e dicionários |
| Línguas construídas (klingon, sindarin, kryptoniano) | `llm-coached` — os LLMs têm alguns dados de treinamento, mas precisam de correções |

## Construindo Bons Dados de Coaching

### Regras Gramaticais

Escreva regras como **instruções**, não descrições. O LLM segue instruções melhor do que interpreta teoria linguística.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### Dicionários

Foque em **termos específicos do domínio** que o LLM acertaria ou inventaria. Não se preocupe com palavras comuns que o LLM já lida — foque nos termos específicos da UI da sua aplicação.

**O dicionário é verificado para todos os métodos.** Independentemente do método que traduz um
par — um modelo hospedado, seu próprio modelo por meio do `local`, DeepL, um endpoint
`api` — o `champollion sync` verifica cada string traduzida em relação ao
dicionário e exibe um aviso de `[TERM]` informando qualquer termo que não tenha sido utilizado.
Apenas `llm-coached` (no prompt) e `deepl` (como um glossário do DeepL) também o
*aplicam* durante a tradução; para os outros, a verificação indica quais
strings devem ser corrigidas, por exemplo com `champollion sync --method llm-coached
--redo keys:<key>`.

### Notas de Estilo

Seja específico sobre registro, formalidade e convenções:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Testando Traduções com Coaching

Use o [MT Eval Harness](https://github.com/gamedaysuits/Champollion) para fazer benchmark de suas traduções com coaching contra um corpus de referência:

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

# Score the results
mt-eval test eval/logs/run_*.json
```

Isso fornece pontuações chrF++, BLEU e correspondência exata. Crie múltiplas versões de arquivo de coaching e compare — métricas objetivas superam revisão subjetiva.

---

## Veja Também

- [Métodos de tradução](/docs/guides/translation-methods) — o método llm-coached
- [Do que se trata](/docs/what-is-champollion) — coaching na prática
- [Especificação de plugins](/docs/reference/plugin-spec) — como empacotar dados de coaching em um plugin
- [Portão de qualidade](/docs/concepts/quality-gate) — como as traduções com coaching são validadas
- [Configuração](/docs/getting-started/configuration) — configuração de coaching por par de idiomas
