---
sidebar_position: 3
title: "Portão de Qualidade"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Portão de Qualidade

Toda tradução passa por um portão de validação determinístico antes de ser escrita no disco. O portão de qualidade captura modos de falha comuns em tradução automática — sem fallbacks silenciosos, sem lixo escrito nos seus arquivos de locale.

## Verificações de Validação

| Verificação | O que ela captura | Rótulo do Gate |
|-------|----------------|-----------|
| **Vazio/em branco** | O modelo retornou uma string vazia ou espaços em branco | `[GATE] empty` |
| **Eco da fonte** | O modelo retornou a entrada original em inglês | `[GATE] source-echo` |
| **Loop de alucinação** | Padrões de trigramas repetidos (ex., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Inflação de comprimento** | A saída é significativamente mais longa que a fonte | `[GATE] length` |
| **Exclusão de conteúdo** | A saída é a fonte com suas letras removidas | `[GATE] content` |
| **Conformidade de script** | Script incorreto para a localidade de destino | `[GATE] script` |
| **Categorias de plural ICU** | Faltam formas plurais obrigatórias para a localidade | `[GATE] icu-plural` |

Chaves declaradas como [`noTranslate`](/docs/getting-started/configuration#no-translate) nunca chegam ao gate — elas são copiadas da fonte literalmente, então não há nada para validar.

### Vazio/Em Branco

Rejeita traduções que são strings vazias, apenas espaços em branco, ou `null`. Isso captura modelos que não retornam nada para chaves difíceis.

### Eco da Fonte

Detecta quando o modelo retorna o texto fonte em inglês em vez de traduzi-lo. Comum com strings curtas e prompts mal especificados.

Strings curtas compostas principalmente por ASCII (≤ 30 caracteres) estão isentas — `"Blog"`, `"GitHub"`, `"npm"` legitimamente permanecem em inglês em todos os lugares, e rejeitá-las causaria um loop infinito.

Valores mais longos que também estão corretos sem alterações — URLs, caminhos de repositório, identificadores de produtos — não são um problema do gate e não podem ser corrigidos ajustando o gate: a resposta correta *é* o eco, então qualquer possível saída do modelo está errada. Declare essas chaves com [`noTranslate`](/docs/getting-started/configuration#no-translate) e elas ignorarão o pipeline inteiramente. Chaves com valores de URL são tratadas dessa forma por padrão.

### Loop de Alucinação

Analisa padrões de trigrama (3 caracteres) na saída. Se algum trigrama se repete mais que um número limite de vezes em relação ao comprimento da saída, a tradução é rejeitada. Isso captura saídas degeneradas como `"Qo' Qo' Qo' Qo' Qo'"`.

### Inflação de Comprimento

Rejeita traduções onde o comprimento da saída excede `maxLengthRatio × source length` (padrão: 4×). Isso captura alucinações do modelo que produzem paredes de texto para uma entrada curta.

Configurável via `maxLengthRatio` na sua configuração.

### Exclusão de Conteúdo

O oposto da inflação de comprimento. Um modelo sem vocabulário para uma string pode excluir todas as letras que não consegue traduzir e deixar a pontuação e o espaçamento da fonte intactos:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Nenhuma outra verificação captura isso. Não está vazio, não é um eco, não é repetitivo e, com 33% do *comprimento* da fonte, passa confortavelmente por `minLengthRatio`.

A verificação compara **caracteres de conteúdo** — letras e dígitos, ignorando pontuação, espaços em branco e formatação invisível — entre a fonte e a saída. Mas a densidade por si só não pode ser a regra, porque scripts densos legítimos se encontram exatamente na mesma situação:

| Fonte | Saída | Conteúdo retido | Veredito |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **rejeitado** |
| `Getting started` | `入门` | 14% | aceito |
| `Frequently asked questions` | `常见问题` | 17% | aceito |

Qualquer limite que capture o primeiro rejeita chinês, japonês e coreano de imediato. O que os separa não é o quanto sobreviveu, mas *de onde veio*: a saída esvaziada é uma **subsequência** de sua própria fonte — que pode ser produzida excluindo caracteres dela — enquanto uma tradução real não compartilha essencialmente nada com a fonte. Uma sinalização exige **ambos** os sinais, portanto, a verificação é necessária, mas não suficiente, da mesma forma que o detector de repetição.

Configurável via `minContentRetention` (padrão `0.35`), por par ou por idioma. Aumentá-lo torna a verificação mais sensível; ela só é acionada junto com o sinal de subsequência.

:::note[Este é um sinal de vocabulário, não um ajuste de qualidade]
Quando isso é acionado repetidamente para um idioma de destino, o modelo não tem palavras para esse texto — geralmente strings curtas e cheias de jargões em um idioma com um léxico fechado. Afrouxar o limite restaura a corrupção silenciosa; isso não produz uma tradução. Corrija o prompt, os dados de orientação ou o par.
:::

### Conformidade de Script

Para localidades cujo cartão de idioma registra um script não latino (Árabe, CJK, Cirílico, …), valida se a saída realmente contém caracteres não ASCII — saídas apenas em latim para essas localidades são rejeitadas como script incorreto.

Dois esclarecimentos sobre o que essa verificação *não* é:

- Ela **não é controlada pelo campo de configuração `script:`.** Esse campo seleciona a ortografia de saída para a [conversão de script](/docs/getting-started/configuration#script-conversion); a expectativa do gate vem dos cartões de idioma.
- Ela sempre valida o **script de trabalho que o modelo emite**, *antes* de qualquer conversão de script. Localidades com um conversor de script (crk, sr, tlh, …) produzem corretamente saídas de script de trabalho em latim, portanto, estão isentas dessa verificação; a conversão — se a configuração permitir — acontece depois do gate.

## O Que Acontece em Caso de Falha

1. A tradução que falhou é registrada em stderr com um prefixo `[GATE]`, o nome da chave, o motivo e uma prévia do valor
2. A chave **não** é escrita no arquivo de locale
3. A cascata de retry é acionada (veja abaixo)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Retentativa de Feedback e a Cascata de Retentativas

Uma chave rejeitada pelo gate recebe **uma retentativa de feedback**: o motivo da rejeição é injetado no prompt como contexto por chave (uma retentativa cega em baixa temperatura retornaria uma saída idêntica em bytes). Se a retentativa for bem-sucedida, a chave é gravada e a sincronização fica **verde** — uma rejeição do gate que se autocorrige não é uma falha, e essa é a semântica pretendida. Apenas as chaves que continuam falhando após a retentativa são ignoradas, relatadas (a sincronização sai com código diferente de zero) e tentadas novamente na próxima sincronização.

A retentativa passa pelo próprio método de tradução do par, seja ele qual for — LLM, Google Translate, DeepL ou um provedor direto. Isso também se aplica a correspondências da Memória de Tradução: um valor em cache que o gate rejeita é removido e retraduzido na mesma execução, para que um cache envenenado se cure sozinho.

Separadamente, quando um lote inteiro falha (erro de análise JSON), o champollion tenta novamente com lotes progressivamente menores:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

O orçamento de retry é limitado por `maxRetries` (padrão: 3, configurável por idioma). Isso previne gasto de tokens descontrolado em chaves que falham consistentemente.

Após esgotar os retries, as chaves problemáticas são registradas e puladas. Elas serão retentadas na próxima execução de `sync`.

## Cache de Prompt

A mensagem do sistema (registro, regras de gramática, notas de estilo) é separada da mensagem do usuário (as chaves a traduzir). Essa separação é intencional:

- A mensagem do sistema é **idêntica entre lotes** para um dado locale
- Provedores como Anthropic e Google fazem cache de mensagens de sistema repetidas
- Resultado: o primeiro lote paga o custo total de tokens, lotes subsequentes pagam apenas pela mensagem do usuário

Isso pode reduzir significativamente os custos de tokens para projetos com muitos lotes.

## Validação de ICU MessageFormat

O comando `integrity` valida padrões plurais de ICU MessageFormat contra regras plurais CLDR. Se seu arquivo fonte usa sintaxe ICU como:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion verifica que versões traduzidas incluem todas as categorias plurais obrigatórias para o locale de destino. Por exemplo, árabe requer seis categorias (`zero`, `one`, `two`, `few`, `many`, `other`) — não apenas `one` e `other`.

Execute `champollion integrity` para verificar completude plural em todos os locales.

## Aplicação de Terminologia

Para pares treinados com um dicionário, champollion executa uma verificação de terminologia pós-tradução. Após o portão de qualidade passar, verifica se o LLM realmente usou os termos de dicionário obrigatórios.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Violações de terminologia são **avisos, não erros bloqueadores**. A tradução ainda é escrita no disco. Isso é intencional — o LLM pode ter razões válidas para escolher uma alternativa (contexto, gramática), e bloquear em incompatibilidades de termos causaria mais dano que bem.

Para corrigir violações, atualize o dicionário de treinamento ou edite manualmente o arquivo de locale.

---

## Veja Também

- [Como Sync Funciona](/docs/concepts/how-sync-works) — onde o portão de qualidade se encaixa no pipeline
- [Métodos de Tradução](/docs/guides/translation-methods) — métodos que alimentam o portão
- [Conversores de Script](/docs/concepts/script-converters) — conversão de script pós-portão
- [Dados de Treinamento](/docs/concepts/coaching-data) — melhorando qualidade de tradução upstream
- [Memória de Tradução](/docs/concepts/translation-memory) — cacheando traduções validadas
- [Referência CLI — sync](/docs/reference/cli#sync) — flags de sync incluindo comportamento de retry
- [Referência CLI — integrity](/docs/reference/cli#integrity) — auditoria plural ICU
