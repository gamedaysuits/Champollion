---
sidebar_position: 4
title: "Especificação do Cartão de Idioma"
description: "Schema canônico para os cartões de configuração por idioma do Champollion."
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# Especificação de Cartão de Idioma

> **Fonte única de verdade.** Este documento define a estrutura canônica de
> cada ficha de idioma. Uma ficha declara apenas o que uma fonte citada declara: um
> campo que nenhuma fonte declara é **omitido, não nulo** — um campo ausente significa
> "nenhuma fonte declarou", nunca "não há nada a saber". O esquema verificável por
> máquina é disponibilizado como `shared/schemas/language-card.schema.json` no pacote
> npm, e o [exemplo canônico abaixo](#canonical-template) é
> gerado a partir do corpus ativo em cada build do site, portanto esta página não pode
> divergir das fichas que descreve.

## A reconstrução do atlas de 2026-08 — o que mudou neste esquema

O corpus de fichas agora é um **resultado de build**: cada ficha é projetada a partir de um repositório
de snapshots upstream fixados e reconstruída — nunca editada — quando um fato
muda. Quatro aspectos da estrutura mudaram com essa reconstrução:

1. **Campos disputados contêm um envelope de atribuição.** Onde as fontes citadas
   genuinamente discordam, o campo não é um valor simples, mas
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment` e qualquer campo que uma nova fonte torne
   disputado. Os consumidores devem ler as fichas por meio do adaptador publicado
   (`normalizeCard()` no pacote npm) em vez de assumir valores simples —
   `display()` resolve um envelope para seu valor acordado e deliberadamente
   não retorna nada em caso de disputa genuína, em vez de eleger um vencedor.

2. **Campos renomeados.** `endonym` substituiu `nativeName` · `codeAliases`
   substituiu `aliases` · `scripts[]` (todos os sistemas de escrita atestados) substituiu o simples
   `script`, com o sistema de escrita principal derivado da tag BCP 47 máxima da ficha ·
   `endangerment` (a avaliação de cada fonte, na própria escala
   dessa fonte) substituiu o objeto único `vitality` · `isoLanguageType` e
   `isoScope` agora trazem as próprias palavras da ISO 639-3 ("Living", "Macrolanguage")
   em vez de siglas. Novos campos: `modality` ("spoken"/"signed", derivados
   da ancestralidade do Glottolog), `glottologBucket` (agrupamentos não genealógicos do Glottolog,
   mantidos fora do campo de família), `locale`/`localeScoped`.

3. **Campos não declarados são omitidos, não nulos.** Um campo que nenhuma fonte declara fica
   ausente da ficha. A regra anterior ("toda ficha DEVE conter todos os campos de nível
   superior, mesmo quando nulos") foi descontinuada: um valor vazio em uma interface
   pública parece uma afirmação de que não há nada a saber, o que não é o mesmo
   que não ter verificado.

4. **Fichas de locale existem.** Ao lado das fichas de idioma, projeções de locale
   (`fra-CA`, `cmn-Hant`) contêm os fatos de seu idioma resolvidos para
   um território ou sistema de escrita, identificados por um bloco `locale: {language, region, script}`.
   Um locale não é um idioma: exclua locales das contagens de idiomas por
   meio desse bloco.

## Princípios de Design

1. **Adicione fontes a tudo.** Toda declaração factual remete a uma fonte primária,
   nomeada e versionada. Declarações sem fonte são declarações inverificáveis. O
   mapa `_fieldSources` (e as anotações `source` por campo em subobjetos)
   tornam a procedência explícita.

2. **Preserve divergências.** Quando as autoridades discordam (uma fonte diz
   50.000 falantes, outra diz 20.000), a ficha armazena *ambas* com a atribuição
   da fonte — a estrutura de envelope acima. Não calculamos médias, não resolvemos
   nem tomamos partido. Os usuários podem navegar pelas nuances.

3. **Ausente significa não declarado.** Um campo ausente significa que nenhuma fonte declara
   um valor. Quando uma propriedade genuinamente não se aplica (por exemplo, gênero gramatical
   para um idioma que não o possui), o valor citado afirma isso explicitamente em vez de
   ficar em branco.

4. **Reconstruído, nunca corrigido diretamente.** As fichas são projetadas a partir de fontes fixadas por
   um build determinístico. Um defeito em um fato é corrigido no manipulador da fonte e o
   corpus é reconstruído — sem edições manuais locais, sem camada de enriquecimento apenas por mesclagem.

---

## Arquitetura de Três Camadas

| Camada | Localização | Propósito |
|-------|----------|---------|
| **Cartões de idioma** | `shared/language-cards/<code>.json` | Configuração por idioma: identidade, classificação, recursos, tudo |
| **Cartões de gênero** | `shared/language-cards/genera/<genus>.json` | Propriedades de tempo de execução compartilhadas para idiomas relacionados (curadas, não geradas automaticamente) |
| **Árvore de idiomas** | `shared/language-cards/language-tree.json` | Hierarquia completa do Glottolog — dados de referência para UI do Lab e descoberta de idiomas |

---

## Modelo de Herança

> **Em grande parte histórico desde a reconstrução do atlas.** Nenhuma ficha de idioma em disco
> contém `extends` mais — cada ficha é totalmente materializada pelo build,
> porque o texto herdado não era citável (uma declaração em nível de família usava
> um endereço em nível de idioma). O mecanismo em si sobrevive em um lugar: o
> bundle offline do pacote npm distribui fichas de locale como deltas compactos em `extends`
> em relação ao seu idioma, resolvidos pela mesma mesclagem descrita aqui.

Quando um cartão define `"extends": "family-dravidian"`, o tempo de execução mescla o cartão pai
no filho usando `_deepMerge()` (em `lib/registers.js`). Isso permite que cartões de gênero definam registros compartilhados, sistemas de formalidade e orientação de gênero que
fluem para todos os idiomas membros — sem duplicar dados em centenas de
cartões individuais.

### Semântica de Mesclagem

| Valor do filho | Comportamento | Por quê |
|-------------|----------|-----|
| `null` | Herdar do pai | `null` significa "não defino isso" — o valor do pai flui |
| Não nulo | Sobrescrever pai | Os dados do filho são mais específicos — têm prioridade |
| Objeto aninhado | Mesclagem recursiva | Campos do filho sobrescrevem, campos do pai preservados |
| Array | Substituir completamente | Arrays não mesclam item por item — o array do filho vence |

### Campos de Identidade (Nunca Herdados)

Alguns campos pertencem ao cartão em si e NUNCA devem ser herdados de um pai:

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

Mesmo que um cartão pai defina `aliases: ["macro-code"]`, um cartão filho NÃO
herdará esses aliases. Esses campos são sempre os valores do próprio filho (incluindo
`null` se não definido).

**Por quê:** Sem essa regra, todo idioma Cree herdaria `aliases: ["cre"]`
do pai da macrolíngua, tornando cada variedade um alias da macro.

### Exemplo: Como um Cartão Cree é Resolvido

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

Em tempo de execução, `getLanguageCard("crk")` retorna um objeto mesclado com
registros de genus-cree + propriedades de family-algic (se houver) + identidade e metadados próprios de crk.

### Modelo de Cartão de Gênero

Cartões de gênero vivem em `shared/language-cards/genera/` e definem propriedades compartilhadas
para um grupo de idiomas. Eles seguem o mesmo esquema que cartões regulares, mas com
convenções diferentes:

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**Regra-chave:** Cartões de gênero devem APENAS conter dados genuinamente compartilhados em todo
o grupo e originários de referências autoritárias. Se um sistema de formalidade
varia entre membros, pertence aos cartões individuais, não ao gênero.

## Exemplo canônico \{#canonical-template}

> **Gerado, não escrito manualmente.** Tudo nesta seção é derivado do
> corpus ativo no momento do build: a ficha completa de `crk` (Plains Cree), byte a byte,
> além de um trecho do locale `fra-CA`. Quando o corpus é reconstruído, o próximo
> build do site gera esta página novamente. Não resta nenhum template mantido manualmente
> para ficar desatualizado — o anterior divergiu uma geração inteira de esquema em relação
> às fichas e foi descontinuado em 16-08-2026.

O exemplo mostra a **estrutura em disco** — o que você obtém se abrir o arquivo.
Os consumidores ainda devem ler as fichas por meio do adaptador publicado
(`normalizeCard()` no pacote npm): ele resolve envelopes, faz a ponte com os
nomes anteriores à migração e deriva os valores exclusivos para exibição (sistema de escrita principal,
nível de vitalidade) que a ficha bruta deliberadamente não contém.

O que observar durante a leitura:

1. **Envelopes de atribuição.** `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` e
   `politenessDistinction` contêm, cada um, `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   possui `"agreement": "incommensurable"`: suas fontes avaliam em
   escalas diferentes, de modo que cada valor nomeia sua `scale` em vez de ser convertido para a
   de um vencedor.

2. **Omitido significa não declarado.** A ficha não possui `iso639_1` (Plains Cree não
   tem código ISO 639-1) nem `phonologicalInventory` (nenhuma fonte ingerida
   declara um) — esses campos estão simplesmente ausentes, nunca `null` ou `[]`.

3. **A procedência é uma camada de primeira classe.** `_fieldSources` mapeia cada campo para
   a(s) fonte(s) que o declarou(aram), com `champollion-derived-v1` marcando
   os valores calculados pelo Champollion. `_card` registra o tipo da ficha, id, revisão
   e quais campos a trilha de correção pode alterar; `_atlas` registra o release
   do corpus.

4. **Sem resultados de execução.** Nada na ficha é uma pontuação medida do resultado
   de um método — chrF, taxas de aceitação de FST e similares são resultados de execução indexados
   por (método, dataset, métrica) e ficam no placar de líderes. A ficha apenas
   declara que os recursos *existem* (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### Uma ficha de locale é uma projeção, não um idioma \{#locale-card-example}

Ao lado das fichas de idioma estão as fichas de locale (`fra-CA`, `cmn-Hant`): os
fatos de um idioma **resolvidos para um território ou sistema de escrita**, identificados pelo seu
bloco `locale` — nunca pelo formato do código. Uma ficha de locale herda os fatos de seu
idioma, resolve aqueles com escopo de sistema de escrita e território (`script`,
`localeScoped`) e **não é um idioma**: exclua as fichas de locale de todas
as contagens de idiomas e listagens por idioma através desse bloco `locale`.

<CardSpecExample variant="locale" />

---

## Referência de campos \{#field-reference}

Duas convenções se aplicam a todas as tabelas abaixo:

- **"envelope"** significa um envelope de atribuição — `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}` — contendo a declaração de *todas*
  as fontes. Um campo listado como `envelope` pode aparecer como um valor simples em fichas
  onde apenas uma fonte se manifesta (por exemplo, linguoides apenas do Glottolog contêm um
  `name` simples); os consumidores devem lidar com ambos, que é exatamente o que o adaptador
  publicado faz.
- Nenhum campo é obrigatório além de `code` e `name`; todo o restante é
  **omitido quando nenhuma fonte o declara**. A(s) fonte(s) declarante(s) de cada campo
  é(são) registrada(s) por ficha em `_fieldSources`, portanto as tabelas descrevem o
  *tipo* de fonte em vez de fixar versões que ficariam desatualizadas.

### § 1. Campos de Identidade

| Campo | Formato | Notas |
|-------|-------|-------|
| `code` | `string` | **Obrigatório.** O ID e nome do arquivo da ficha. ISO 639-3 para fichas de idioma (`crk`); linguoides exclusivos do Glottolog usam seu glottocode; fichas de locale usam um código de locale (`fra-CA`). |
| `name` | envelope | **Obrigatório.** Nome de referência em inglês (registro ISO 639-3, LinguaMeta, Glottolog). |
| `endonym` | envelope | Substituiu `nativeName`. Como os falantes chamam o idioma, no próprio idioma (LinguaMeta, Wikidata). Ausente quando nenhuma fonte declara um — um endônimo nunca é inventado ou transliterado por nós. |
| `alternateNames` | `string[]` | Outros nomes em inglês atestados. |
| `iso639_1` | `string` | Presente apenas quando existe um código ISO 639-1 de duas letras (`fra` → `"fr"`). |
| `isoScope` | `string` | As próprias palavras da ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (substituiu as siglas `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Substituiu `isoType`. As próprias palavras da ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | O macroidioma ao qual este idioma pertence (`crk` → `"cre"`). Mapeamentos de macroidiomas da ISO 639-3. |
| `macrolanguageMembers` | `string[]` | Em fichas centrais de macroidiomas: os códigos dos membros individuais (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Em fichas de macroidiomas: membros cujas tags os registros BCP 47 agrupam na tag deste macroidioma (tabela de aliases do CLDR + langtags SIL, cada um atribuído). |
| `supersededCodes` | `string[]` | Códigos ISO 639-3 descontinuados que a SIL agora direciona para este idioma — registrados no sucessor para que corpora publicados sob um código antigo continuem sendo resolvidos. |
| `codeAliases` | `string[]` | Substituiu `aliases`. Identificadores em nível de código que resolvem para esta ficha. |
| `bcp47` | `string` | A tag BCP 47 do idioma conforme declarada (LinguaMeta). |
| `bcp47Tag` | envelope | Derivado pelo Champollion: a tag RFC 5646 (o código ISO 639 mais curto tem precedência). |
| `bcp47FullTag` | envelope | A forma máxima de idioma–escrita–região (likelySubtags do CLDR + langtags SIL). O adaptador deriva o **sistema de escrita principal** a partir desta tag. |
| `modality` | `string` | `"spoken"` ou `"signed"`, derivado da ancestralidade do Glottolog. A escrita é um atributo da ortografia, não uma modalidade — um idioma não escrito ainda é totalmente falado ou sinalizado. |
| `locale` | `object` | **Apenas fichas de locale.** `{language, region, script, publishedTag, source, note}` — A identidade do locale. Exclua fichas de locale das contagens de idiomas por meio deste bloco, nunca pelo formato do código. |
| `localeScoped` | `object` | Apenas fichas de locale: valores resolvidos para o território/sistema de escrita do locale (ex.: `scriptName`, `cldrOfficialStatus`). |

### § 2. Campos de Classificação

| Campo | Formato | Notas |
|-------|-------|-------|
| `glottocode` | `string` | Identificador do Glottolog para este linguoide (`crk` → `"plai1258"`). Linguoides exclusivos do Glottolog — idiomas registrados pelo Glottolog que a ISO 639-3 não possui — usam o glottocode como `code` de sua ficha. |
| `classification` | `object` | Contêiner para os campos de posicionamento abaixo. Cada um tem fonte independente e é omitido de forma independente — um idioma isolado, ou um idioma classificado em um agrupamento do Glottolog, legitimamente contém apenas parte deste objeto. |
| `classification.family` | envelope | A família de nível superior declarada por cada autoridade de classificação. Glottolog e WALS são taxonomias separadas que nem sempre concordam, portanto ambas são mantidas e atribuídas. A regra de lint R5 verifica o valor do Glottolog dentro do envelope em relação à própria árvore do Glottolog: o WALS pode discordar do Glottolog, mas o Glottolog não pode ser citado incorretamente. Idiomas isolados não contêm família alguma. |
| `classification.familyGlottocode` | `string` | Glottocode dessa família de nível superior (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Nó de classificação intermediário do WALS (`crk` → `"Algonquian"`). Um conceito do WALS, **não** do Glottolog — o Glottolog publica uma árvore de profundidade arbitrária sem nível de gênero —, portanto está presente apenas onde o WALS codifica o idioma. |
| `classification.ancestry` | `string[]` | Caminho de descendência do Glottolog como glottocodes ancestrais, com a raiz primeiro (`["algi1248", …, "plai1264"]`). A ordem **é** a declaração: este é um caminho, nunca um conjunto ordenado alfabeticamente. |
| `classification.glottologBucket` | `string` | Agrupamentos não genealógicos do Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Mantidos fora do campo de família porque um agrupamento classifica por tipo, não por descendência: uma ficha com um agrupamento não tem família, e esse é o resultado factual. |
| `isIsolate` | `boolean` | Se o Glottolog classifica este idioma como isolado. |

A ficha anterior à migração também continha um `genusGlottocode`. Ele foi descontinuado
junto com o erro de categoria que o gerou: o gênero é um conceito do WALS, e
vesti-lo com um identificador do Glottolog afirmava um nó de árvore que o Glottolog
não possui. Em vez disso, a hierarquia do Glottolog é transmitida por `ancestry`.

### § 3. Campos de Geografia

| Campo | Formato | Notas |
|-------|-------|-------|
| `macroarea` | `string` | Macroárea do Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` ou `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Ponto representativo do Glottolog. Um ponto, não um território: posiciona o idioma em um mapa e não afirma nada sobre limites ou extensão territorial. |
| `countries` | `string[]` | Códigos ISO 3166-1 alfa-2 dos países que o Glottolog associa ao idioma (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Status oficial concedido ao idioma por algum território, conforme registrado pelo CLDR (transmitido via LinguaMeta) — `"Official"`, `"Regional official"`. Em uma ficha de locale, o status resolvido para o território *daquele locale* fica em `localeScoped.cldrOfficialStatus`. |

O array `regions` anterior à migração (detalhamento de falantes por país com códigos
administrativos) e `arealContext` (associação a Sprachbund) foram descontinuados: nenhuma
fonte ingerida os declara, e a curadoria sem fontes não sobrevive a uma reconstrução.
Declarações de falantes em nível regional podem retornar no dia em que uma fonte citável
chegar ao pipeline; até lá, a ausência é o estado factual e honesto.

### § 4. Campos de Sistema de Escrita

| Campo | Formato | Notas |
|-------|-------|-------|
| `scripts` | `string[]` | Substituiu o `script` simples. **Todos** os códigos ISO 15924 atestados (`crk` → `["Cans", "Latn"]`), não ordenados — nunca interprete `scripts[0]` como "o" sistema de escrita. O sistema de escrita principal é derivado pelo adaptador a partir da tag máxima de `bcp47FullTag`. |
| `scriptNames` | `string[]` | Nomes de exibição derivados pelo Champollion para `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Substituiu `dir`. As próprias palavras da fonte — `"left-to-right"` / `"right-to-left"` (antes era `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | Suppress-Script do CLDR: o sistema de escrita tão canônico para o idioma que as tags BCP 47 o omitem (`fra` → `"Latn"`). |
| `script` | `string` | **Apenas fichas de locale**: o sistema de escrita resolvido para o locale (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Fichas de idioma não contêm um campo simples de sistema de escrita. |

Um idioma sem escrita atestada simplesmente **não tem o campo `scripts`** —
a ausência significa que nenhuma fonte declarou um sistema de escrita, não uma afirmação de que
o idioma é "não escrito". (As línguas de sinais constituem o maior grupo desse tipo: nenhum
sistema de notação possui adoção padrão pela comunidade para a alfabetização cotidiana.)

### § 5. Campos de Demografia e Vitalidade

| Campo | Formato | Notas |
|-------|-------|-------|
| `speakerEstimates` | envelope | Estimativa de cada fonte, com atribuição. Os valores podem ser contagens exatas ou as próprias strings de intervalo da fonte (`"10000-99999"`), com as ressalvas da fonte reproduzidas textualmente em `note`. `"agreement": "conflicting"` é comum — mostrar o conflito *é* o objetivo do produto; nada é submetido a médias ou eleições. |
| `endangerment` | envelope | Substituiu o objeto único `vitality`. A avaliação de cada fonte **na própria escala dessa fonte** — cada valor contém um campo `scale`, e `"agreement": "incommensurable"` é a norma, porque os vocabulários do ELCat, Glottolog AES e LinguaMeta não são traduções diretas uns dos outros. O adaptador deriva um *nível de vitalidade* de exibição a partir de uma única fonte nomeada, de acordo com a ordem de autoridade declarada; esse nível destina-se apenas à exibição — o conjunto completo e atribuído permanece na ficha. |

Uma contagem de falantes *exibida* em qualquer lugar no Champollion deve corresponder a uma das
entradas citadas de `speakerEstimates` ou trazer procedência explícita de `champollion-derived` —
o que é exigido pelas regras de integridade das fichas.

### § 5.5 Campos de Documentação e Presença Digital

| Campo | Formato | Notas |
|-------|-------|-------|
| `documentation` | `object` | Substituiu `documentationDepth`. O registro do Glottolog sobre o nível de documentação do idioma, nos próprios termos do Glottolog. |
| `documentation.medLevel` | `string` | Nível de Descrição Mais Abrangente (Most Extensive Description) do Glottolog, textual — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | A chave bibliográfica dessa descrição mais abrangente no catálogo de referências do Glottolog. |
| `documentation.firstDocumented` | `number` | A própria coluna de primeiro ano de documentação do Glottolog, textual — movida para cá a partir do campo de nível superior anterior à migração. Presente em apenas algumas centenas de idiomas, e a própria escassez é um dado valioso. |
| `documentation.lastDocumented` | `number` | A coluna de último ano de documentação do Glottolog, textual — presente em cerca de mil idiomas. |
| `wikipediaEdition` | `object` | Substituiu `digitalPresence`. `{site, url, name}` — existe uma edição aberta da Wikipédia neste idioma (`afr` → `af.wikipedia.org`). Apenas existência, deliberadamente **sem contagens de artigos**: várias edições são em grande parte geradas por bots, e uma edição imensa não é "mais bem documentada" do que uma pequena em qualquer sentido que um tradutor possa aproveitar. |
| `dialectCount` | `number` | A própria coluna `child_dialect_count` do Glottolog, textual — apenas dialetos filhos diretos, não a subárvore inteira. Esta é a declaração do Glottolog, não um cálculo nosso: uma regra anterior a marcava como `champollion-derived` e fazia milhares de fichas assumirem o crédito pela contagem do Glottolog. |

O restante do bloco `digitalPresence` anterior à migração (horas do Common Voice,
contagens de frases do Tatoeba) foi descontinuado até que essas fontes cheguem ao pipeline —
o próprio corpus do Tatoeba já aparece onde deve, como um corpus paralelo
sob `resources.corpora` (§ 9).

### § 6. Campos de Formalidade, Registro e Gênero

O corpus projetado contém exatamente um campo aqui — o fato citado:

| Campo | Formato | Notas |
|-------|-------|-------|
| `politenessDistinction` | envelope | Se o idioma gramaticaliza polidez em formas de segunda pessoa. Atribuído entre Grambank GB415 (binário: ausente/presente) e WALS 45A (quatro níveis: sem distinção / binário / múltiplo / pronomes evitados). Essas são escalas diferentes, portanto cada valor nomeia sua `scale` e o envelope as relata como **incomensuráveis**, em vez de como uma discordância. |

**O sistema de registros é configuração, não um fato da ficha.** O corpus anterior à
migração armazenava texto de `formality` e prompts de `registers` em quase
mil e oitocentas fichas cada — quase tudo gerado a partir das mesmas duas fontes
acima e mantido como se fosse configuração feita manualmente. O atlas
preserva o fato; as superfícies de configuração — `formality`, `registers`,
`gender`, `codeSwitching` — continuam sendo parte do **esquema com curadoria do
pacote npm** (`language-card.schema.json`), residem nas fichas centrais de gênero/família curadas
e chegam à CLI por meio da mesclagem `extends` do sistema de registros descrita
no [Modelo de herança](#inheritance-model). Elas não são campos projetados do atlas:
nenhuma ficha no corpus projetado as contém, e o build do atlas nunca as gravará. As
orientações em [Como escrever bons presets de registro](#writing-good-register-presets)
aplicam-se a essa trilha sob curadoria.

### § 7. Campos de Perfil Linguístico

| Campo | Formato | Notas |
|-------|-------|-------|
| `typologicalProfile` | `object` | Uma chave por recurso tipológico ingerido, cada valor com a codificação da própria fonte, cada chave presente apenas onde a fonte codifica este idioma. Os booleanos vêm dos recursos do Grambank; as strings de categorias, dos capítulos do WALS; o registro de decisões nomeia o parâmetro exato upstream para cada chave. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — contagens calculadas pelo Champollion sobre um inventário citado do PHOIBLE (o PHOIBLE publica uma linha por segmento e não declara contagens), portanto todo valor carrega a procedência `champollion-derived`. **O PHOIBLE é a única autoridade para tons** (lint R1): o Grambank não possui recurso de tom, e nenhum outro item da ficha pode declarar tonalidade. |
| `numeralSystem` | `object` | `{base}` — a base numeral, textual de *Numeral Systems of the World's Languages* de Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; quase cem valores distintos). Ausente quando a própria coluna de base de Chan está vazia — cerca de metade dos idiomas pesquisados —, porque um gerador anterior preenchia o espaço vazio com `"decimal"` e inventava valores para dois mil idiomas. |
| `pluralCategories` | `string[]` | As categorias de plural cardinal que o CLDR especifica para este idioma — o árabe distingue `["zero", "one", "two", "few", "many", "other"]`, o francês três delas, o chinês uma. Lido a partir das chaves do próprio conjunto de regras do CLDR, portanto é uma afirmação do CLDR, e não uma derivação nossa. Substituiu o `rules.plurals.categories` anterior à migração; um pipeline de i18n precisa disso para saber quantas formas de plural uma mensagem deve fornecer. |

As chaves de `typologicalProfile` atualmente projetadas, com seus parâmetros
upstream:

- **Capítulos do WALS** (strings de categoria, os próprios rótulos de valores do WALS): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Recursos do Grambank** (booleanos): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB072), `marksPastTense` (GB083),
  `marksPresentTense` (GB082)

Os blocos `linguisticChallenges` e `contactInfluences` anteriores à migração não são
projetados — textos pesquisados sem nenhuma fonte ingerida permanecem no esquema
com curadoria do pacote npm, assim como as superfícies de registro na § 6 (as tabelas
de [Tipos de influência de contato](#contact-influence-types) abaixo atendem a essa trilha).
O bloco `rules` foi descontinuado: o que nele era citável sobrevive como
`pluralCategories` aqui e nos campos de escrita na § 4.

### § 8. Campos Enciclopédicos

Descontinuado das fichas. Os blocos `encyclopedic` (ensaios históricos e dialetais,
links institucionais), `culturalAphorism` e `varieties` anteriores à migração eram textos
curados manualmente no nível da ficha, os quais a reconstrução exclui por design. Os fatos
de pertencimento sugeridos por `varieties` agora são campos de identidade citados
(§ 1 `macrolanguageMembers` e `canonicalisedMembers`), e a cobertura de ferramentas por variedade
é respondida pela própria ficha de cada membro (`methodSupport`, `resources`). Um ditado
representativo pode retornar por meio de uma trilha de contribuição da comunidade com
consentimento e citação; ele não retornará como um campo de ficha sem fonte.

### § 9. Campos de Recurso Digital

Tudo nesta seção declara **existência e capacidade, nunca
qualidade**: que um recurso foi publicado e quem o publica — nunca que ele
é bom, completo ou utilizável, e nunca uma pontuação medida. Qualquer pontuação
medida do resultado de um método é um resultado de execução indexado por (método, dataset, métrica),
reside no placar de líderes e é proibido nas fichas (lint R3).

| Campo | Formato | Notas |
|-------|-------|-------|
| `resources` | `object` | Contêiner: cada subcampo abaixo é uma lista com fonte independente, omitida quando nenhuma fonte a declara. |
| `resources.fsts` | `object[]` | Analisadores morfológicos de estados finitos publicados: `{name, url, publisher, license, licenceEstablished, archived}`. A licença acompanha cada entrada em vez de ser considerada uniforme em todo o catálogo — os limites de licença exigem os termos reais. Para um idioma polissintético, um FST é frequentemente a única verificação estrutural existente. |
| `resources.corpora` | `object[]` | Corpora paralelos que atestam este idioma: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Declarados por meio de **pares**, porque um corpus paralelo só atesta um idioma por meio de um par — dizer que "cobre suaíli" sem dizer em relação a quê responde a uma pergunta que ninguém fez. Existência e tamanho, nunca qualidade. |
| `resources.monolingualCorpora` | `object[]` | Corpora monolíngues — mantidos separados de `corpora` para que "ter um corpus" nunca signifique duas coisas incomparáveis. |
| `resources.speech` | `object[]` | Recursos de fala publicados. Apenas existência. |
| `resources.keyboards` | `object[]` | Layouts de teclado publicados. Simples, mas estruturais: para uma ortografia que precisa de caracteres que nenhum layout padrão produz, um layout é a diferença entre o idioma poder ser digitado ou não. |
| `resources.typology` | `object[]` | Datasets tipológicos que *codificam* este idioma, com extensão: `{dataset, featuresCoded, datasetFeatureTotal}`. Existência e extensão, nunca conteúdo — o que um recurso diz fica fora da ficha até que alguém escreva o mapa de parâmetros que o aceita (os aceitos aparecem no `typologicalProfile` da § 7). As contagens de recursos são cálculos nossos, portanto trazem procedência de `champollion-derived`. |
| `lexicalResources` | `object` | Contêiner para fatos de existência lexical. |
| `lexicalResources.datasets` | `object[]` | Listas de palavras publicadas com sua cobertura: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Dicionários publicados — existência, nunca qualidade, e **direcionados** para onde o publicador os direciona: um dicionário unidirecional em um sentido é um recurso diferente de outro no sentido oposto. As entradas não têm formato uniforme (um dataset CLDF sabe sua contagem de entradas; um repositório sabe seu par e direção); cada um nomeia sua própria fonte, e a licença e o estado de arquivamento acompanham cada entrada. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Contagens calculadas pelo Champollion sobre o CLICS³: conceitos atestados para este idioma e formas que mapeiam para dois ou mais conceitos distintos. `champollion-derived`. |
| `methodSupport` | `object` | Quais métodos de tradução cobrem este idioma — capacidade, nunca uma pontuação. Formato: `{total, byTier, named, truncated}`. O inglês contém milhares de arestas de método e o idioma mediano cerca de duas dezenas, de modo que a ficha mantém a *forma* da evidência — `total` mais contagens de `byTier` por nível de confiança (`fetched`, `partially-confirmed`, `model-card-declared`) — e nomeia apenas as entradas mais fortes (cada `{value, variant, source, confidence}`), com limite. Os **serviços** do registro são sempre nomeados na íntegra, acima do limite, de modo que a ausência de um serviço em `named` é uma resposta real; a ausência de uma entrada de ficha de modelo significa apenas "não está entre as mais fortes", e todas as arestas permanecem consultáveis no repositório do atlas. |
| `metricModelSupport` | envelope | Modelos de métricas de avaliação que publicam cobertura deste idioma, com o identificador de modelo que uma base de testes (harness) carrega (`masakhane/africomet-mtl`). Direciona o comportamento real — seleção de modelos COMET — e continua sendo capacidade, nunca uma pontuação. |

**Incorporados aos campos acima:** os itens anteriores à migração `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`) e `databaseCoverage` (→
`resources.typology` mais `lexicalResources` — uma entrada de banco de dados é agora um
fato citado de cobertura com extensão, não um booleano).

**Descontinuados das fichas:** `omt1600`, `evalDatasets`, `pipelineReadiness` e
`metricPlugins` — nenhum é declarado por uma fonte ingerida, e um nível de
prontidão é um julgamento, não uma citação.

**Com curadoria, não projetados:** as superfícies de declaração de padrões de avaliação
(`evalStandard`, `evalMetrics`, `evalPack`) permanecem no esquema sob curadoria
do pacote npm. Elas informam ao harness de avaliação qual pacote avaliador externo
pontua um idioma (árbitros, não concorrentes — o núcleo do harness não inclui código
de pontuação específico por idioma); o harness as lê de uma ficha quando presentes,
mas nenhuma ficha no corpus projetado as contém atualmente, e o build do atlas não
as grava. O mesmo vale para o bloco `install` que o instalador de FST do harness lê
das entradas de `resources.fsts[]` (`get_fst_install_info()` em `language_cards.py`): as entradas
projetadas contêm apenas fatos de existência.

### § 10. Campos de Proveniência

| Campo | Formato | Notas |
|-------|-------|-------|
| `_fieldSources` | `object` | Em todas as fichas. Mapeia cada caminho de campo na ficha (`"classification.family"`, `"coordinates.lat"`) para os IDs de fontes ordenados que o declararam (`["glottolog-v5.3", "wals-v2020.5"]`). Valores calculados pelo Champollion trazem `champollion-derived-v1`. Os IDs de fontes são versionados — `grambank-v1.0.3`, `iso639-3-20260715` — para que cada declaração remeta à versão exata que a originou. |
| `coverage` | `object` | Em todas as fichas, e **calculado pelo projetor, não declarado por nenhuma fonte**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — quantas fontes distintas mencionam este idioma, quantos componentes da ficha contêm um valor em relação a quantos existem para preenchimento e quantos valores uma fonte registrou positivamente como *ausentes* (verificou e disse que não — um fato diferente de nunca ter verificado). Isso é o que permite a uma ficha concisa explicar **por que** é concisa, em vez de parecer negligenciada. |
| `_card` | `object` | Metadados da própria ficha: `{type, id, revision, correctableFields}`. `type` é `"language"` ou `"locale"` (as fichas de método e de corpus utilizam o mesmo projetor); `revision` é um hash de conteúdo, de modo que qualquer alteração no conteúdo da ficha o modifica; `correctableFields` lista os caminhos de campos que contêm valores — os campos que a trilha de correção pode alterar. |
| `_atlas` | `object` | `{version}` — o selo de versão do corpus (`"unreleased"` entre versões). Deliberadamente um ID de release, **não** um timestamp de build: um timestamp faria dois builds a partir de snapshots fixados idênticos divergirem pela data do calendário, destruindo a propriedade que permite a qualquer pessoa auditar o atlas — mesmas referências na entrada, mesmos bytes na saída. |

O bloco de procedência anterior à migração foi descontinuado por completo: `dataSources`
(substituído pelo mapa `_fieldSources` por campo), `supportTier` (um julgamento calculado,
substituído pelas contagens neutras de `coverage`), `_generated` (todo o corpus é gerado;
o registro é `_card.revision` mais `_atlas.version`), `humanReviewed` e `notes` (curadoria
pertencente a trilhas com registros próprios) e o `firstDocumented`/`lastDocumented` de nível superior
(movido para `documentation` na § 5.5, onde a fonte realmente o declara).

---

## Política de Código de Idioma

Champollion usa **ISO 639-3** como identificador canônico. Outros códigos padrão
são registrados como aliases e resolvem para o código ISO 639-3 em tempo de execução.

| Prioridade | Padrão | Exemplo | Campo | Uso |
|------------|--------|---------|-------|-----|
| 1 (canônica) | ISO 639-3 | `crk` | `code` | Nome de arquivo da ficha, chaves de configuração, parâmetros de API |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Aceito na CLI, resolvido para ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Aceito na CLI, resolvido para ISO 639-3 |
| Referência | Glottocode | `plai1258` | `glottocode` | Apenas classificação, não para tempo de execução |

**Ordem de resolução:** quando um usuário fornece um código:
1. Correspondência direta em `card.code` → encontrado
2. Correspondência em `card.codeAliases[]` → encontrado, retorna a ficha canônica
3. Correspondência em `card.iso639_1` → encontrado (fallback)
4. Não encontrado → erro

### Histórico de Migração: ISO 639-1 → ISO 639-3

Antes da v8, nomes de arquivo de cartão usavam códigos ISO 639-1 quando disponíveis (`fr.json`,
`de.json`, `ja.json`). Na migração 639-3, todos os cartões foram renomeados para seus
equivalentes ISO 639-3:

| Antes | Depois | Por quê |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3 é canônico |
| `de.json` | `deu.json` | 639-3 é canônico |
| `zh.json` | `cmn.json` | Macrolíngua → individual padrão |
| `ar.json` | `arb.json` | Macrolíngua → Árabe Padrão Moderno |
| `ms.json` | `zsm.json` | Macrolíngua → Malaio Padrão |

**O que aconteceu com os códigos antigos?**
- O código 639-1 antigo está em `card.iso639_1`
- O código 639-1 antigo está em `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` retorna `"fra"` em tempo de execução — compatível com versões anteriores
- Os usuários ainda podem escrever `"fr"` em sua configuração — isso é resolvido de forma transparente

**O que mudou arquiteturalmente:**
- `_deepMerge()` agora pula valores `null` (herda do pai)
- `_deepMerge()` agora tem um campo de identidade definido (código, estende, aliases nunca herdados)
- `formality.default` agora é derivado de flags de registro `isDefault: true`
- 205 cartões derivados de Grambank receberam correção estrutural `formality.default`
- 38 cartões de gênero/família/macrolíngua fornecem destinos de herança

---

## Casos Extremos

### Línguas de sinais
Línguas de sinais (ex.: ASE — American Sign Language) são idiomas legítimos
com códigos ISO 639-3. Elas possuem geografia e contagem de falantes, mas:
- `modality` é `"signed"` — a declaração positiva da ficha sobre o que o
  idioma *é*; a ausência de um sistema de escrita é um fato separado
- `scripts` é tipicamente ausente (nenhum sistema de notação tem adoção padrão pela
  comunidade), embora `"Sgnw"` (SignWriting) apareça onde uma fonte o declara
- `textDirection` está ausente
- `linguisticChallenges` deve abordar gramática espacial, classificadores, etc.

### Idiomas antigos e históricos
Idiomas como o latim (`lat`, isoLanguageType `"Historical"`) e o sânscrito
(`san`) ainda são usados em contextos específicos (litúrgicos, acadêmicos), mas não
possuem falantes nativos:
- `isoLanguageType` traz a própria palavra de status da ISO (`"Ancient"`,
  `"Historical"`, `"Extinct"`) — a ficha nunca suaviza nem substitui esse termo
- `endangerment` e `speakerEstimates` informam o que as fontes citadas
  realmente avaliam, com as ressalvas textuais (contagens da comunidade de L2 continuam rotuladas
  conforme suas fontes as rotulam)
- `firstDocumented` / `lastDocumented` situam-nos no tempo

### Idiomas construídos
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, etc.:
- `classification` pode estar ausente — o Glottolog arquiva conlangs em um
  agrupamento não genealógico, e o agrupamento nunca é exibido como uma família
- `contactInfluences` reflete o material de origem (por exemplo, o Esperanto baseia-se em línguas românicas, germânicas e eslavas)
- `endangerment` é incomum — comunidade de falantes em crescimento, mas sem terra natal nativa

### Macroidiomas
Árabe (`ara`), chinês (`zho`), cree (`cre`), quéchua (`que`) são macroidiomas
que abrangem múltiplos idiomas individuais:
- `isoScope: "Macrolanguage"` — um ponto central de navegação, nunca um alvo de benchmark
- `macrolanguageMembers` lista os códigos dos membros individuais;
  `canonicalisedMembers` registra quais membros os registros BCP 47 agrupam
  na tag do macroidioma (cada registro atribuído)
- `methodSupport` reflete o que a *ficha do macroidioma* suporta (normalmente a variedade padronizada)
- Os membros individuais têm suas próprias fichas, contendo `macrolanguage` que aponta de volta para o ponto central

### Idiomas sem ortografia padronizada
Muitos idiomas (especialmente idiomas de tradição oral) não possuem um sistema de escrita
padronizado ou têm ortografias concorrentes:
- `scripts`, `scriptNames` e `textDirection` estão ausentes — nenhuma fonte
  declarou um sistema de escrita, o que não é a mesma afirmação que "não escrito"
- `notes` deve explicar a situação ortográfica
- `linguisticChallenges` deve indicar como isso afeta a MT (por exemplo, ausência de dados de treinamento)

### Diglossia
Idiomas como Árabe (MSA vs. dialetos) ou Guarani (Jopará vs. Guarani puro):
- `codeSwitching` captura a situação de variedade mista
- `registers` pode oferecer predefinições para diferentes níveis
- `varieties` pode listar o par diglóssico

---

## Tipos de Influência de Contato

| Tipo | Significado | Exemplo |
|------|---------|---------|
| `superstrate` | Idioma dominante imposto a uma comunidade | Francês → Inglês (pós-1066) |
| `substrate` | Idioma nativo influenciando um idioma imposto | Céltico → Inglês |
| `adstrate` | Idioma vizinho com influência mútua | Nórdico → Inglês |
| `learned_borrowing` | Empréstimos através de educação/erudição | Latim → Inglês |
| `lexical_borrowing` | Empréstimos de vocabulário direto através de contato | Espanhol → Filipino |
| `relexification` | Substituição de vocabulário em massa | Português → Papiamentu |

## Profundidades de Influência de Contato

| Profundidade | Significado |
|-------|---------|
| `light` | Algumas palavras emprestadas, impacto estrutural mínimo |
| `moderate` | Vocabulário significativo em domínios específicos |
| `heavy` | Vocabulário pervasivo e alguns recursos estruturais |
| `structural` | Gramática, sintaxe e fonologia afetadas |
| `defining` | Identidade central moldada pelo contato (crioulos, línguas mistas) |

---

## Escrevendo Boas Predefinições de Registro

**Bons prompts de predefinição:**
- Nomeie explicitamente o recurso de formalidade (por exemplo, "해요체", "vous-form", "siz-form")
- Explique o pronome ou forma verbal específica a usar
- Dê contexto para quando este registro é apropriado
- Mencione considerações de script se aplicável

**Não** coloque orientação de gênero inclusivo no prompt de predefinição. A orientação de gênero
pertence a `card.gender.inclusiveGuidance` — é injetada separadamente.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### Convenção de Nomenclatura de Predefinição

Chaves de predefinição devem ser descritivas e em minúsculas com hífens:
- Idiomas T-V: `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- Níveis de fala: `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- Neutro: `professional`, `neutral-professional`
- Code-switching: `taglish-professional`, `pure-filipino`

---

## Como os fatos das fichas são atualizados

As fichas são **resultados de build** — uma projeção determinística a partir de snapshots
upstream fixados. Não existe mais um procedimento de enriquecimento por ficha: o fluxo
do script `enrich-*` executado manualmente foi descontinuado, e uma edição feita diretamente em um
arquivo de ficha é excluída no build seguinte. Para alterar um fato:

1. **Registre a decisão.** Cada campo é uma linha no registro de decisões do build:
   qual parâmetro upstream o alimenta, como ele se projeta e o que um
   valor ausente significa.
2. **Corrija a camada de ingestão.** Um valor incorreto é um defeito no manipulador da fonte
   (ou um snapshot upstream fixado desatualizado), nunca algo para corrigir diretamente na ficha.
3. **Reconstrua e faça a migração.** O build projeta novamente cada ficha a partir dos snapshots
   fixados; as validações recusam builds parciais, valores nulos/vazios e fichas que
   falhem nas regras de integridade.

### Tratamento de Conflitos

Quando as fontes discordam:
1. **Armazene todas elas** com a atribuição da fonte — é para isso que serve o
   envelope de atribuição
2. **NÃO faça médias** nem tome partido — `consensus` aparece apenas quando as
   fontes realmente concordam
3. **Mantenha as ressalvas de cada fonte** textualmente em `note` desse valor
4. Um valor único para exibição ou cálculo é **derivado pelo adaptador**
   a partir da ordem de autoridade declarada — a própria ficha mantém a variação completa

---

## Validação

Execute o linter após qualquer reconstrução:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### Lista de Verificação de PR

Ao enviar uma alteração que afete as fichas (lembre-se: altere o build,
não a ficha):

- [ ] A correção reside em um manipulador de ingestão ou no registro de decisões — nenhum
      arquivo de ficha é editado manualmente
- [ ] Os campos contêm apenas valores declarados por fontes — nada preenchido com `null` ou
      `[]` para "completar" uma ficha
- [ ] `classification` vem do Glottolog (não construído manualmente)
- [ ] A procedência de cada campo alterado vai para `_fieldSources`, com
      valores calculados pelo Champollion trazendo procedência de `champollion-derived`
- [ ] Nenhuma pontuação medida do resultado de um método aparece em qualquer lugar de uma ficha
- [ ] O linter e a validação de integridade da ficha passam sem erros

---

## Referências Profissionais

| Padrão | Mantido Por | Nosso Uso |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | Códigos de idioma canônicos, relacionamentos de macrolíngua |
| [Glottolog](https://glottolog.org) | Max Planck Institute | Classificação, coordenadas, AES de ameaça |
| [WALS](https://wals.info) | Max Planck Institute | Definições de gênero, recursos tipológicos |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | Códigos de script |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | Dados de locale, regras de plural, tipografia |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | Contagens de falantes, endônimos, dados de script |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, estimativas de falantes, DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | Classificação de ameaça |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | Cápsulas de idioma das Filipinas |

Veja também: [Procedimento de Citação de Cartão de Idioma](/docs/reference/language-card-citation-procedure)
para orientação detalhada fonte por fonte.
