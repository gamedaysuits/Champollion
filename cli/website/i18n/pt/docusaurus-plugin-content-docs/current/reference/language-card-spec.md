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

> **Única fonte de verdade.** Este documento define o formato canônico de cada cartão de idioma. Um cartão afirma apenas o que uma fonte citada afirma: um campo que nenhuma fonte afirma é **omitido, não nulo** — um campo ausente significa "nenhuma fonte se pronunciou", nunca "não há nada a saber". O esquema verificável por máquina é distribuído como `shared/schemas/language-card.schema.json` no pacote npm, e o [exemplo canônico abaixo](#canonical-template) é gerado a partir do corpus ativo em cada build do site, para que esta página não possa divergir dos cartões que descreve.

## A reconstrução do atlas de 2026-08 — o que mudou neste esquema

O corpus de cartões agora é **saída de build**: cada cartão é projetado a partir de um armazenamento de snapshots upstream fixados, e reconstruído — nunca editado — quando um fato muda. Quatro coisas sobre o formato mudaram com essa reconstrução:

1. **Campos contestados carregam um envelope de atribuição.** Onde as fontes citadas genuinamente discordam, o campo não é um valor plano, mas `{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`, `speakerEstimates`, `endangerment`, e qualquer campo que uma nova fonte torne contestado. Os consumidores devem ler os cartões através do adaptador publicado (`normalizeCard()` no pacote npm) em vez de assumir valores planos — `display()` resolve um envelope para o seu valor acordado e deliberadamente não retorna nada em uma disputa genuína em vez de eleger um vencedor.

2. **Campos renomeados.** `endonym` substituiu `nativeName` · `codeAliases` substituiu `aliases` · `scripts[]` (todos os scripts atestados) substituiu o `script` plano, com o script primário derivado da tag BCP 47 máxima do cartão · `endangerment` (a avaliação de cada fonte, na própria escala dessa fonte) substituiu o objeto único `vitality` · `isoLanguageType` e `isoScope` agora carregam as próprias palavras da ISO 639-3 ("Living", "Macrolanguage") em vez de iniciais. Novos campos: `modality` ("spoken"/"signed", derivado da ancestralidade do Glottolog), `glottologBucket` (baldes não genealógicos do Glottolog, mantidos fora do espaço de família), `locale`/`localeScoped`.

3. **Campos não afirmados são omitidos, não nulos.** Um campo que nenhuma fonte afirma está ausente do cartão. A regra anterior ("cada cartão DEVE conter todos os campos de nível superior, mesmo quando nulos") foi aposentada: um valor vazio em uma superfície pública é lido como uma afirmação de que não há nada a saber, o que não é o mesmo que não ter procurado.

4. **Cartões de localidade (locale) existem.** Ao lado dos cartões de idioma, as projeções de localidade (`fra-CA`, `cmn-Hant`) carregam os fatos do seu idioma resolvidos para um território ou script, identificados por um bloco `locale: {language, region, script}`. Uma localidade não é um idioma: exclua as localidades das contagens de idiomas por esse bloco.

## Princípios de Design

1. **Documente todas as fontes.** Toda afirmação factual remonta a uma fonte primária nomeada e versionada. Afirmações sem fontes são afirmações não verificáveis. O mapa `_fieldSources` (e as anotações `source` por campo em subobjetos) tornam a proveniência explícita.

2. **Preserve a discordância.** Quando as autoridades discordam (uma fonte diz 50.000 falantes, outra diz 20.000), o cartão armazena *ambas* com atribuição de fonte — o formato de envelope acima. Nós não calculamos a média, não resolvemos nem escolhemos lados. Os usuários podem navegar pela nuance.

3. **Ausente significa não afirmado.** Um campo ausente significa que nenhuma fonte afirma um valor. Quando uma propriedade genuinamente não se aplica (por exemplo, gênero gramatical para um idioma que não o possui), o valor citado diz isso explicitamente em vez de ficar em branco.

4. **Reconstruído, nunca corrigido com patches.** Os cartões são projetados a partir de fontes fixadas por um build determinístico. Um defeito de fato é corrigido em seu manipulador de fonte e o corpus é reconstruído — sem edições in-place, sem camada de enriquecimento apenas de mesclagem.

---

## Arquitetura de Três Camadas

| Camada | Localização | Propósito |
|-------|----------|---------|
| **Cartões de idioma** | `shared/language-cards/<code>.json` | Configuração por idioma: identidade, classificação, recursos, tudo |
| **Cartões de gênero** | `shared/language-cards/genera/<genus>.json` | Propriedades de tempo de execução compartilhadas para idiomas relacionados (curadas, não geradas automaticamente) |
| **Árvore de idiomas** | `shared/language-cards/language-tree.json` | Hierarquia completa do Glottolog — dados de referência para UI do Lab e descoberta de idiomas |

---

## Modelo de Herança

> **Em grande parte histórico desde a reconstrução do atlas.** Nenhum cartão de idioma no disco carrega mais `extends` — cada cartão é totalmente materializado pelo build, porque a prosa herdada não era citável (uma afirmação em nível de família usava um endereço em nível de idioma). O mecanismo em si sobrevive em um lugar: o pacote offline do pacote npm distribui cartões de localidade como deltas `extends` compactos em relação ao seu idioma, resolvidos pela mesma mesclagem descrita aqui.

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

## Exemplo Canônico \{#canonical-template}

> **Gerado, não escrito.** Tudo nesta seção é derivado do corpus ativo no momento do build: o cartão completo `crk` (Plains Cree), byte por byte, mais um trecho de localidade `fra-CA`. Quando o corpus é reconstruído, o próximo build do site rederiva esta página. Não há mais nenhum modelo mantido manualmente para ficar desatualizado — o anterior ficou uma geração inteira de esquema atrás dos cartões e foi aposentado em 16-08-2026.

O exemplo mostra o **formato no disco** — o que você obtém se abrir o arquivo. Os consumidores ainda devem ler os cartões através do adaptador publicado (`normalizeCard()` no pacote npm): ele resolve envelopes, faz a ponte entre os nomes pré-transição e deriva os valores apenas para exibição (script primário, nível de vitalidade) que o cartão bruto deliberadamente não carrega.

O que observar durante a leitura:

1. **Envelopes de atribuição.** `name`, `classification.family`, `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` e `politenessDistinction` carregam cada um `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment` tem `"agreement": "incommensurable"`: suas fontes avaliam em escalas diferentes, então cada valor nomeia sua `scale` em vez de ser convertido para a de um vencedor.

2. **Omitido significa não afirmado.** O cartão não tem `iso639_1` (Plains Cree não tem código ISO 639-1) e não tem `phonologicalInventory` (nenhuma fonte ingerida afirma um) — esses campos estão simplesmente ausentes, nunca `null` ou `[]`.

3. **A proveniência é uma camada de primeira classe.** `_fieldSources` mapeia cada campo para a(s) fonte(s) que o afirmou, com `champollion-derived-v1` marcando os valores que o Champollion computou. `_card` carimba o tipo, id, revisão do cartão e quais campos a via de correção pode tocar; `_atlas` carimba o lançamento do corpus.

4. **Sem resultados de execução.** Nada no cartão é uma pontuação medida da saída do método — chrF, taxas de aceitação FST e seus semelhantes são resultados de execução chaveados por (método, conjunto de dados, métrica) e vivem no placar de líderes (leaderboard). O cartão apenas afirma que os recursos *existem* (`resources`, `lexicalResources`, `methodSupport`).

<CardSpecExample variant="language" />

### Um cartão de localidade é uma projeção, não um idioma \{#locale-card-example}

Ao lado dos cartões de idioma ficam os cartões de localidade (`fra-CA`, `cmn-Hant`): os fatos de um idioma **resolvidos para um território ou script**, identificados pelo seu bloco `locale` — nunca pelo formato do código. Um cartão de localidade herda os fatos do seu idioma, resolve aqueles com escopo de script e território (`script`, `localeScoped`), e **não é um idioma**: exclua os cartões de localidade de todas as contagens de idiomas e listagens por idioma por esse bloco `locale`.

<CardSpecExample variant="locale" />

---

## Referência de Campos \{#field-reference}

Duas convenções se aplicam a todas as tabelas abaixo:

- **"envelope"** significa um envelope de atribuição — `{agreement, consensus?, values: [{value, source, note?, scale?}]}` — carregando a afirmação de *todas* as fontes. Um campo listado como `envelope` pode aparecer como um valor plano em cartões onde apenas uma fonte se pronuncia (por exemplo, languoids apenas do Glottolog carregam um `name` plano); os consumidores devem lidar com ambos, que é o que o adaptador publicado faz.
- Nenhum campo é obrigatório além de `code` e `name`; todo o resto é **omitido quando nenhuma fonte o afirma**. A(s) fonte(s) que afirma(m) cada campo são registradas por cartão em `_fieldSources`, de modo que as tabelas descrevem o *tipo* de fonte em vez de fixar versões que poderiam divergir.

### § 1. Campos de Identidade

| Campo | Formato | Notas |
|-------|-------|-------|
| `code` | `string` | **Obrigatório.** O ID do cartão e o nome do arquivo. ISO 639-3 para cartões de idioma (`crk`); languoids apenas do Glottolog carregam seu glottocode; cartões de localidade carregam um código de localidade (`fra-CA`). |
| `name` | envelope | **Obrigatório.** Nome de referência em inglês (registro ISO 639-3, LinguaMeta, Glottolog). |
| `endonym` | envelope | Substituiu `nativeName`. Como os falantes chamam o idioma, no próprio idioma (LinguaMeta, Wikidata). Ausente quando nenhuma fonte afirma um — um endônimo nunca é inventado ou transliterado por nós. |
| `alternateNames` | `string[]` | Outros nomes atestados em inglês. |
| `iso639_1` | `string` | Presente apenas quando existe um código ISO 639-1 de duas letras (`fra` → `"fr"`). |
| `isoScope` | `string` | As próprias palavras da ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (substituiu as iniciais `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Substituiu `isoType`. As próprias palavras da ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | A macrolíngua à qual este idioma pertence (`crk` → `"cre"`). Mapeamentos de macrolíngua da ISO 639-3. |
| `macrolanguageMembers` | `string[]` | Em cartões hub de macrolíngua: os códigos dos membros individuais (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Em cartões de macrolíngua: membros cujas tags os registros BCP 47 dobram na tag desta macrolíngua (tabela de alias do CLDR + langtags do SIL, cada um atribuído). |
| `supersededCodes` | `string[]` | Códigos ISO 639-3 aposentados que o SIL agora direciona para este idioma — registrados no sucessor para que os corpora publicados sob um código antigo ainda sejam resolvidos. |
| `codeAliases` | `string[]` | Substituiu `aliases`. Identificadores em nível de código que resolvem para este cartão. |
| `bcp47` | `string` | A tag BCP 47 do idioma conforme afirmada (LinguaMeta). |
| `bcp47Tag` | envelope | Derivado pelo Champollion: a tag RFC 5646 (o código ISO 639 mais curto vence). |
| `bcp47FullTag` | envelope | A forma máxima idioma–script–região (likelySubtags do CLDR + langtags do SIL). O adaptador deriva o **script primário** a partir desta tag. |
| `modality` | `string` | `"spoken"` ou `"signed"`, derivado da ancestralidade do Glottolog. A escrita é um atributo de ortografia, não uma modalidade — um idioma não escrito ainda é totalmente falado ou sinalizado. |
| `locale` | `object` | **Apenas cartões de localidade.** `{language, region, script, publishedTag, source, note}` — A identidade da localidade. Exclua os cartões de localidade das contagens de idiomas por este bloco, nunca pelo formato do código. |
| `localeScoped` | `object` | Apenas cartões de localidade: valores resolvidos para o território/script da localidade (por exemplo, `scriptName`, `cldrOfficialStatus`). |

### § 2. Campos de Classificação

| Campo | Formato | Notas |
|-------|-------|-------|
| `glottocode` | `string` | O identificador do Glottolog para este languoid (`crk` → `"plai1258"`). Languoids apenas do Glottolog — idiomas que o Glottolog registra e a ISO 639-3 não — usam o glottocode como seu cartão `code`. |
| `classification` | `object` | Contêiner para os campos de posicionamento abaixo. Cada um tem fonte independente e é omitido independentemente — um isolado, ou um idioma arquivado em um balde do Glottolog, legitimamente carrega apenas parte deste objeto. |
| `classification.family` | envelope | A família de nível superior que cada autoridade de classificação afirma. Glottolog e WALS são taxonomias separadas que nem sempre concordam, então ambas são mantidas e atribuídas. A regra de lint R5 verifica o valor do Glottolog dentro do envelope em relação à própria árvore do Glottolog: o WALS pode discordar do Glottolog, mas o Glottolog não pode ser citado incorretamente. Isolados não carregam nenhuma família. |
| `classification.familyGlottocode` | `string` | Glottocode dessa família de nível superior (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Nó de classificação intermediária do WALS (`crk` → `"Algonquian"`). Um conceito do WALS, **não** do Glottolog — o Glottolog publica uma árvore de profundidade arbitrária sem nível de gênero — portanto, está presente apenas onde o WALS codifica o idioma. |
| `classification.ancestry` | `string[]` | Caminho de descendência do Glottolog como glottocodes ancestrais, raiz primeiro (`["algi1248", …, "plai1264"]`). A ordem **é** a afirmação: este é um caminho, nunca um conjunto em ordem alfabética. |
| `classification.glottologBucket` | `string` | Baldes não genealógicos do Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Mantido fora do espaço de família porque um balde classifica por tipo, não por descendência: um cartão com um balde não tem família, e esse é o resultado honesto. |
| `isIsolate` | `boolean` | Se o Glottolog classifica este idioma como um isolado. |

O cartão pré-transição também carregava um `genusGlottocode`. Ele foi aposentado junto com o erro de categoria que o produziu: o gênero é um conceito do WALS, e vesti-lo com um identificador do Glottolog afirmava um nó de árvore que o Glottolog não possui. A hierarquia do Glottolog é carregada por `ancestry` em vez disso.

### § 3. Campos de Geografia

| Campo | Formato | Notas |
|-------|-------|-------|
| `macroarea` | `string` | Macroárea do Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` ou `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Ponto representativo do Glottolog. Um ponto, não um território: ele coloca o idioma em um mapa e não afirma nada sobre alcance ou fronteiras. |
| `countries` | `string[]` | Códigos ISO 3166-1 alfa-2 dos países que o Glottolog associa ao idioma (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Um status oficial que algum território concede ao idioma, conforme o CLDR o registra (carregado via LinguaMeta) — `"Official"`, `"Regional official"`. Em um cartão de localidade, o status resolvido para o território *dessa localidade* fica em `localeScoped.cldrOfficialStatus`. |

O array `regions` pré-transição (detalhamentos de falantes por país com códigos administrativos) e `arealContext` (associação a Sprachbund) foram aposentados: nenhuma fonte ingerida os afirma, e a curadoria sem fontes não sobrevive a uma reconstrução. Afirmações de falantes em nível de região podem retornar no dia em que uma fonte citável chegar ao pipeline; até lá, a ausência é o estado honesto.

### § 4. Campos de Sistema de Escrita

| Campo | Formato | Notas |
|-------|-------|-------|
| `scripts` | `string[]` | Substituiu o `script` plano. **Todos** os códigos ISO 15924 atestados (`crk` → `["Cans", "Latn"]`), não ordenados — nunca leia `scripts[0]` como "o" script. O script primário é derivado pelo adaptador a partir da tag máxima de `bcp47FullTag`. |
| `scriptNames` | `string[]` | Nomes de exibição derivados pelo Champollion para `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Substituiu `dir`. As próprias palavras da fonte — `"left-to-right"` / `"right-to-left"` (era `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: o script tão canônico para o idioma que as tags BCP 47 o omitem (`fra` → `"Latn"`). |
| `script` | `string` | **Apenas cartões de localidade**: o script resolvido para a localidade (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Cartões de idioma não carregam nenhum campo de script plano. |

Um idioma sem escrita atestada simplesmente **não tem o campo `scripts`** — a ausência significa que nenhuma fonte afirmou um script, não uma afirmação de que o idioma é "não escrito". (As línguas de sinais são o maior grupo desse tipo: nenhum sistema de notação tem adoção padrão da comunidade para a alfabetização diária.)

### § 5. Campos de Demografia e Vitalidade

| Campo | Formato | Notas |
|-------|-------|-------|
| `speakerEstimates` | envelope | A estimativa de cada fonte, atribuída. Os valores podem ser contagens exatas ou as próprias strings de intervalo da fonte (`"10000-99999"`), com as ressalvas da fonte carregadas literalmente em `note`. `"agreement": "conflicting"` é comum — mostrar o conflito *é* o produto; nada tem a média calculada ou é eleito. |
| `endangerment` | envelope | Substituiu o objeto único `vitality`. A avaliação de cada fonte **na própria escala dessa fonte** — cada valor carrega um campo `scale`, e `"agreement": "incommensurable"` é a norma porque os vocabulários ELCat, Glottolog AES e LinguaMeta não são traduções uns dos outros. O adaptador deriva um *nível de vitalidade* de exibição a partir de uma única fonte nomeada de acordo com a ordem de autoridade declarada; esse nível é apenas para exibição — o conjunto atribuído completo permanece no cartão. |

Uma contagem de falantes *exibida* em qualquer lugar no Champollion deve corresponder a uma das entradas `speakerEstimates` citadas ou carregar proveniência `champollion-derived` explícita — imposto pelas regras de integridade do cartão.

### § 5.5 Campos de Documentação e Presença Digital

| Campo | Formato | Notas |
|-------|-------|-------|
| `documentation` | `object` | Substituiu `documentationDepth`. O registro do Glottolog de quão bem descrito o idioma é, nos próprios termos do Glottolog. |
| `documentation.medLevel` | `string` | O nível de Descrição Mais Extensa do Glottolog, literalmente — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | A chave bibliográfica dessa descrição mais extensa no catálogo de referência do Glottolog. |
| `documentation.firstDocumented` | `number` | A própria coluna de primeiro ano de documentação do Glottolog, literalmente — movida para cá do campo de nível superior pré-transição. Presente em apenas algumas centenas de idiomas, e a própria escassez vale a pena ser conhecida. |
| `documentation.lastDocumented` | `number` | A coluna de último ano de documentação do Glottolog, literalmente — presente em cerca de mil idiomas. |
| `wikipediaEdition` | `object` | Substituiu `digitalPresence`. `{site, url, name}` — existe uma edição aberta da Wikipedia neste idioma (`afr` → `af.wikipedia.org`). Apenas existência, deliberadamente **sem contagens de artigos**: várias edições são em grande parte geradas por bots, e uma edição enorme não é "melhor documentada" do que uma pequena em qualquer sentido que um tradutor possa usar. |
| `dialectCount` | `number` | A própria coluna `child_dialect_count` do Glottolog, literalmente — apenas dialetos filhos diretos, não toda a subárvore. Esta é a afirmação do Glottolog, não nossa aritmética: uma regra anterior a carimbava como `champollion-derived` e fazia com que milhares de cartões levassem o crédito pela contagem do Glottolog. |

O restante do bloco `digitalPresence` pré-transição (horas do Common Voice, contagens de frases do Tatoeba) está aposentado até que essas fontes cheguem ao pipeline — o próprio corpus do Tatoeba já aparece onde pertence, como um corpus paralelo em `resources.corpora` (§ 9).

### § 6. Campos de Formalidade, Registro e Gênero

O corpus projetado carrega exatamente um campo aqui — o fato citado:

| Campo | Formato | Notas |
|-------|-------|-------|
| `politenessDistinction` | envelope | Se o idioma gramaticaliza a polidez em formas de segunda pessoa. Atribuído através do Grambank GB415 (binário: ausente/presente) e WALS 45A (quatro níveis: sem distinção / binário / múltiplo / pronomes evitados). Essas são escalas diferentes, então cada valor nomeia sua `scale` e o envelope os relata como **incomensuráveis** em vez de como uma discordância. |

**O sistema de registro é configuração, não um fato do cartão.** O corpus pré-transição armazenava prosa `formality` e prompts `registers` em quase mil e oitocentos cartões cada — quase tudo gerado a partir das mesmas duas fontes acima, e então carregado como se fosse uma configuração com curadoria manual. O atlas mantém o fato; as superfícies de configuração — `formality`, `registers`, `gender`, `codeSwitching` — permanecem parte do **esquema com curadoria do pacote npm** (`language-card.schema.json`), vivem nos cartões hub de gênero/família com curadoria e chegam à CLI através da mesclagem `extends` do sistema de registro descrita no [Modelo de Herança](#inheritance-model). Eles não são campos projetados do atlas: nenhum cartão no corpus projetado os carrega, e o build do atlas nunca os escreverá. A orientação em [Escrevendo Boas Predefinições de Registro](#writing-good-register-presets) se aplica a essa via com curadoria.

### § 7. Campos de Perfil Linguístico

| Campo | Formato | Notas |
|-------|-------|-------|
| `typologicalProfile` | `object` | Uma chave por recurso tipológico ingerido, cada valor é a própria codificação da fonte, cada chave está presente apenas onde a fonte codifica este idioma. Booleanos vêm de recursos do Grambank, strings de categoria de capítulos do WALS; o registro de decisão nomeia o parâmetro upstream exato para cada chave. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — contagens computadas pelo Champollion sobre um inventário PHOIBLE citado (o PHOIBLE publica uma linha por segmento e não afirma contagens), então cada valor carrega proveniência `champollion-derived`. **O PHOIBLE é a única autoridade de tom** (lint R1): o Grambank não tem recurso de tom, e nada mais no cartão pode afirmar tonalidade. |
| `numeralSystem` | `object` | `{base}` — a base numeral, literalmente de *Numeral Systems of the World's Languages* de Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; quase cem valores distintos). Ausente quando a própria coluna de base de Chan está vazia — cerca de metade dos idiomas pesquisados — porque um gerador anterior preencheu o espaço em branco com `"decimal"` e inventou valores para dois mil idiomas. |
| `pluralCategories` | `string[]` | As categorias de plural cardinal que o CLDR declara para este idioma — o árabe distingue `["zero", "one", "two", "few", "many", "other"]`, o francês três delas, o chinês uma. Lido a partir das chaves do próprio conjunto de regras do CLDR, portanto é uma afirmação do CLDR, não nossa derivação. Substituiu o `rules.plurals.categories` pré-transição; um pipeline de i18n precisa dele para saber quantas formas plurais uma mensagem deve fornecer. |

As chaves `typologicalProfile` atualmente projetadas, com seus parâmetros upstream:

- **Capítulos do WALS** (strings de categoria, os próprios rótulos de valor do WALS): `fusion` (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication` (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A), `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Recursos do Grambank** (booleanos): `hasGenderInPronouns` (GB030), `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase` (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083), `marksPresentTense` (GB084)

Os blocos `linguisticChallenges` e `contactInfluences` pré-transição não são projetados — a prosa pesquisada sem fonte ingerida permanece no esquema com curadoria do pacote npm, como as superfícies de registro no § 6 (as tabelas de [Tipos de Influência de Contato](#contact-influence-types) abaixo servem a essa via). O bloco `rules` foi aposentado: o que era citável nele sobrevive como `pluralCategories` aqui e os campos de script no § 4.

### § 8. Campos Enciclopédicos

Aposentados dos cartões. Os blocos `encyclopedic` (ensaios de história e dialeto, links institucionais), `culturalAphorism` e `varieties` pré-transição eram prosa com curadoria manual no nível do cartão, que a reconstrução exclui por design. Os fatos de associação que `varieties` indicava agora são campos de identidade citados (§ 1 `macrolanguageMembers` e `canonicalisedMembers`), e a cobertura de ferramentas por variedade é respondida pelo próprio cartão de cada membro (`methodSupport`, `resources`). Um ditado representativo pode retornar através de uma via de contribuição da comunidade com consentimento e citação; ele não retornará como um campo de cartão não citado.

### § 9. Campos de Recurso Digital

Tudo nesta seção afirma **existência e capacidade, nunca qualidade**: que um recurso está publicado e quem o publica — nunca que ele é bom, completo ou utilizável, e nunca uma pontuação medida. Qualquer pontuação medida da saída do método é um resultado de execução chaveado por (método, conjunto de dados, métrica), vive no placar de líderes (leaderboard) e é proibido nos cartões (lint R3).

| Campo | Formato | Notas |
|-------|-------|-------|
| `resources` | `object` | Contêiner: cada subcampo abaixo é uma lista com fonte independente, omitida quando nenhuma fonte a afirma. |
| `resources.fsts` | `object[]` | Analisadores morfológicos de estado finito publicados: `{name, url, publisher, license, licenceEstablished, archived}`. A licença viaja com cada entrada em vez de ser assumida como uniforme em um catálogo — os limites da licença precisam dos termos reais. Para um idioma polissintético, um FST é frequentemente a única verificação estrutural que existe. |
| `resources.corpora` | `object[]` | Corpora paralelos atestando este idioma: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Declarado através de **pares**, porque um corpus paralelo atesta um idioma apenas através de um par — "cobre suaíli" sem dizer contra o que responde a uma pergunta que ninguém fez. Existência e tamanho, nunca qualidade. |
| `resources.monolingualCorpora` | `object[]` | Corpora monolíngues — mantidos separados de `corpora` para que "tem um corpus" nunca signifique duas coisas incomparáveis. |
| `resources.speech` | `object[]` | Recursos de fala publicados. Apenas existência. |
| `resources.keyboards` | `object[]` | Layouts de teclado publicados. Simples, mas fundamentais: para uma ortografia que precisa de caracteres que nenhum layout padrão produz, um layout é a diferença entre o idioma ser digitável ou não. |
| `resources.typology` | `object[]` | Conjuntos de dados tipológicos que *codificam* este idioma, com extensão: `{dataset, featuresCoded, datasetFeatureTotal}`. Existência e extensão, nunca conteúdo — o que um recurso diz fica fora do cartão até que uma pessoa escreva o mapa de parâmetros que o aceita (os aceitos surgem em `typologicalProfile` do § 7). As contagens de recursos são nossa aritmética, então elas carregam proveniência `champollion-derived`. |
| `lexicalResources` | `object` | Contêiner para fatos de existência lexical. |
| `lexicalResources.datasets` | `object[]` | Listas de palavras publicadas com sua cobertura: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Dicionários publicados — existência, nunca qualidade, e **direcionados** para onde o editor os direciona: um dicionário que vai em uma direção é um recurso diferente de um que vai na outra. As entradas não têm formato uniforme (um conjunto de dados CLDF conhece sua contagem de entradas; um repositório conhece seu par e direção); cada um nomeia sua própria fonte, e a licença e o estado arquivado viajam por entrada. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Contagens computadas pelo Champollion sobre o CLICS³: conceitos atestados para este idioma e formas que mapeiam para dois ou mais conceitos distintos. `champollion-derived`. |
| `methodSupport` | `object` | Quais métodos de tradução cobrem este idioma — capacidade, nunca uma pontuação. Formato: `{total, byTier, named, truncated}`. O inglês carrega milhares de arestas de método e o idioma mediano algumas dezenas, então o cartão mantém o *formato* da evidência — `total` mais contagens `byTier` por nível de confiança (`fetched`, `partially-confirmed`, `model-card-declared`) — e nomeia apenas as entradas mais fortes (cada `{value, variant, source, confidence}`), com limite. Os **serviços** de registro são sempre nomeados na íntegra, acima do limite, de modo que a ausência de um serviço em `named` é uma resposta real; a ausência de uma entrada de cartão de modelo significa apenas "não está entre os mais fortes", e cada aresta permanece consultável no armazenamento do atlas. |
| `metricModelSupport` | envelope | Modelos de métrica de avaliação que publicam a cobertura deste idioma, com o identificador do modelo que um harness carrega (`masakhane/africomet-mtl`). Impulsiona o comportamento real — seleção de modelo COMET — e ainda é capacidade, nunca uma pontuação. |

**Incorporados aos campos acima:** o `keyboardSupport` pré-transição (→ `resources.keyboards`), `corpusAvailability` (→ `resources.corpora` / `resources.monolingualCorpora`) e `databaseCoverage` (→ `resources.typology` mais `lexicalResources` — uma entrada de banco de dados agora é um fato de cobertura citado com extensão, não um booleano).

**Aposentados dos cartões:** `omt1600`, `evalDatasets`, `pipelineReadiness` e `metricPlugins` — nenhum é afirmado por uma fonte ingerida, e um nível de prontidão é um julgamento, não uma citação.

**Com curadoria, não projetado:** as superfícies de declaração de padrão de avaliação (`evalStandard`, `evalMetrics`, `evalPack`) permanecem no esquema com curadoria do pacote npm. Elas dizem ao harness de avaliação qual pacote de árbitro externo pontua um idioma (árbitros, não concorrentes — o núcleo do harness não distribui nenhum código de pontuador específico do idioma); o harness os lê de um cartão quando presentes, mas nenhum cartão no corpus projetado atualmente os carrega, e o build do atlas não os escreve. O mesmo vale para o bloco `install` que o instalador FST do harness lê das entradas `resources.fsts[]` (`get_fst_install_info()` em `language_cards.py`): as entradas projetadas carregam apenas fatos de existência.

### § 10. Campos de Proveniência

| Campo | Formato | Notas |
|-------|-------|-------|
| `_fieldSources` | `object` | Em cada cartão. Mapeia cada caminho de campo no cartão (`"classification.family"`, `"coordinates.lat"`) para os ids de fonte classificados que o afirmaram (`["glottolog-v5.3", "wals-v2020.5"]`). Valores que o Champollion computou carregam `champollion-derived-v1`. Os ids de fonte são versionados — `grambank-v1.0.3`, `iso639-3-20260715` — para que cada afirmação remonte ao lançamento exato que a fez. |
| `coverage` | `object` | Em cada cartão, e **computado pelo projetor, não afirmado por nenhuma fonte**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — quantas fontes distintas falam sobre este idioma, quantos componentes do cartão carregam um valor do total que existe para ser preenchido, e quantos valores uma fonte registrou positivamente como *ausentes* (olhou e disse não — um fato diferente de nunca ter olhado). É isso que permite que um cartão fino diga **por que** ele é fino em vez de parecer negligenciado. |
| `_card` | `object` | Os próprios metadados do cartão: `{type, id, revision, correctableFields}`. `type` é `"language"` ou `"locale"` (cartões de método e corpus usam o mesmo projetor); `revision` é um hash de conteúdo, então qualquer alteração no conteúdo do cartão o altera; `correctableFields` lista os caminhos de campo que carregam valores — os campos que a via de correção pode tocar. |
| `_atlas` | `object` | `{version}` — o carimbo de lançamento do corpus (`"unreleased"` entre lançamentos). Deliberadamente um id de lançamento, **não** um timestamp de build: um timestamp faria com que dois builds de fixações idênticas diferissem pelo calendário, destruindo a propriedade que permite a qualquer um verificar o atlas — mesmas fixações de entrada, mesmos bytes de saída. |

O bloco de proveniência pré-transição foi totalmente aposentado: `dataSources` (substituído pelo mapa `_fieldSources` por campo), `supportTier` (um julgamento computado, substituído pelas contagens neutras `coverage`), `_generated` (todo o corpus é gerado; o carimbo é `_card.revision` mais `_atlas.version`), `humanReviewed` e `notes` (curadoria que pertence a vias com seus próprios registros), e o `firstDocumented`/`lastDocumented` de nível superior (movido para `documentation` no § 5.5, onde sua fonte realmente os afirma).

---

## Política de Código de Idioma

Champollion usa **ISO 639-3** como identificador canônico. Outros códigos padrão
são registrados como aliases e resolvem para o código ISO 639-3 em tempo de execução.

| Prioridade | Padrão | Exemplo | Campo | Uso |
|----------|----------|---------|-------|-----|
| 1 (canônico) | ISO 639-3 | `crk` | `code` | Nome do arquivo do cartão, chaves de configuração, parâmetros de API |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Aceito na CLI, resolvido para ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Aceito na CLI, resolvido para ISO 639-3 |
| Referência | Glottocode | `plai1258` | `glottocode` | Apenas classificação, não para tempo de execução |

**Ordem de resolução:** Quando um usuário fornece um código:
1. Correspondência direta em `card.code` → encontrado
2. Correspondência em `card.codeAliases[]` → encontrado, retorna o cartão canônico
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
- Os usuários ainda podem escrever `"fr"` em sua configuração — ele é resolvido de forma transparente

**O que mudou arquiteturalmente:**
- `_deepMerge()` agora pula valores `null` (herda do pai)
- `_deepMerge()` agora tem um campo de identidade definido (código, estende, aliases nunca herdados)
- `formality.default` agora é derivado de flags de registro `isDefault: true`
- 205 cartões derivados de Grambank receberam correção estrutural `formality.default`
- 38 cartões de gênero/família/macrolíngua fornecem destinos de herança

---

## Casos Extremos

### Línguas de Sinais
As línguas de sinais (por exemplo, ASE — American Sign Language) são idiomas legítimos com códigos ISO 639-3. Elas têm geografia e contagens de falantes, mas:
- `modality` é `"signed"` — a afirmação positiva do cartão sobre o que o idioma *é*; a ausência de um sistema de escrita é um fato separado
- `scripts` está tipicamente ausente (nenhum sistema de notação tem adoção padrão da comunidade), embora `"Sgnw"` (SignWriting) apareça onde uma fonte o afirma
- `textDirection` está ausente
- `linguisticChallenges` deve abordar gramática espacial, classificadores, etc.

### Idiomas Antigos e Históricos
Idiomas como o latim (`lat`, isoLanguageType `"Historical"`) e o sânscrito (`san`) ainda são usados em contextos específicos (litúrgicos, acadêmicos), mas não têm falantes nativos:
- `isoLanguageType` carrega a própria palavra de status da ISO (`"Ancient"`, `"Historical"`, `"Extinct"`) — o cartão nunca a suaviza ou a substitui
- `endangerment` e `speakerEstimates` relatam o que as fontes citadas realmente avaliam, com ressalvas literais (as contagens da comunidade L2 permanecem rotuladas como suas fontes as rotulam)
- `firstDocumented` / `lastDocumented` os localizam no tempo

### Idiomas Construídos
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, etc.:
- `classification` pode estar ausente — o Glottolog arquiva conlangs em um balde não genealógico, e o balde nunca é exibido como uma família
- `contactInfluences` reflete o material de origem (por exemplo, o esperanto se baseia no românico, germânico, eslavo)
- `endangerment` é incomum — comunidade de falantes em crescimento, mas sem pátria nativa

### Macrolínguas
Árabe (`ara`), chinês (`zho`), cree (`cre`), quéchua (`que`) são macrolínguas que englobam vários idiomas individuais:
- `isoScope: "Macrolanguage"` — um hub de navegação, nunca um alvo de benchmark
- `macrolanguageMembers` lista os códigos dos membros individuais; `canonicalisedMembers` registra quais membros os registros BCP 47 dobram na tag da macrolíngua (cada registro atribuído)
- `methodSupport` reflete o que o *cartão da macrolíngua* suporta (geralmente a variedade padronizada)
- Os membros individuais têm seus próprios cartões, carregando `macrolanguage` de volta para o hub

### Idiomas Sem Ortografia Padronizada
Muitos idiomas (especialmente idiomas de tradição oral) não têm um sistema de escrita padronizado ou têm ortografias concorrentes:
- `scripts`, `scriptNames` e `textDirection` estão ausentes — nenhuma fonte afirmou um script, o que não é a mesma afirmação que "não escrito"
- `notes` deve explicar a situação ortográfica
- `linguisticChallenges` deve observar como isso afeta a MT (por exemplo, sem dados de treinamento)

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

## Como os Fatos do Cartão São Atualizados

Os cartões são **saída de build** — uma projeção determinística a partir de snapshots upstream fixados. Não há mais nenhum procedimento de enriquecimento por cartão: a via de script `enrich-*` executada manualmente foi aposentada, e uma edição feita diretamente em um arquivo de cartão é excluída pelo próximo build. Para alterar um fato:

1. **Registre a decisão.** Cada campo é uma linha no registro de decisão do build: qual parâmetro upstream o alimenta, como ele se projeta e o que significa um valor ausente.
2. **Corrija a camada de ingestão.** Um valor errado é um defeito no manipulador de fonte (ou uma fixação upstream obsoleta), nunca algo para corrigir com patch no cartão.
3. **Reconstrua e faça a transição.** O build reprojeta cada cartão a partir dos snapshots fixados; os portões (gates) recusam builds parciais, valores nulos/vazios e cartões que falham nas regras de integridade.

### Tratamento de Conflitos

Quando as fontes discordam:
1. **Armazene todas elas** com atribuição de fonte — é para isso que serve o envelope de atribuição
2. **NÃO calcule a média** nem escolha lados — `consensus` aparece apenas quando as fontes realmente concordam
3. **Carregue as ressalvas de cada fonte** literalmente no `note` desse valor
4. Um único valor para exibição ou computação é **derivado pelo adaptador** a partir da ordem de autoridade declarada — o próprio cartão mantém a distribuição completa

---

## Validação

Execute o linter após qualquer reconstrução:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### Lista de Verificação de PR

Ao enviar uma alteração que toca nos cartões (lembre-se: altere o build, não o cartão):

- [ ] A correção vive em um manipulador de ingestão ou no registro de decisão — nenhum arquivo de cartão é editado manualmente
- [ ] Os campos carregam apenas valores afirmados pela fonte — nada preenchido com `null` ou `[]` para "completar" um cartão
- [ ] `classification` vem do Glottolog (não construído manualmente)
- [ ] A proveniência de cada campo tocado chega em `_fieldSources`, com os valores computados pelo Champollion carregando proveniência `champollion-derived`
- [ ] Nenhuma pontuação medida da saída do método aparece em qualquer lugar em um cartão
- [ ] O linter e o portão de integridade do cartão passam sem erros

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
