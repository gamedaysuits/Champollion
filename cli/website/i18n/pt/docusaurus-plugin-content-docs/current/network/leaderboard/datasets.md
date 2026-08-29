---
sidebar_position: 3
title: "Conjuntos de Dados de Avaliação"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# Conjuntos de Dados de Avaliação

> **Resumo Executivo.** Esta página descreve os conjuntos de dados de avaliação disponíveis para benchmarking, incluindo o esquema de entrada do corpus, os níveis de dificuldade (1–5) e os requisitos de proveniência. O catálogo contém **~4.700 conjuntos de dados de avaliação obtidos da fonte em 19 famílias de corpus** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, os conjuntos cegos WMT newstest/General 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) além do FLORES+ — o *conteúdo* do corpus nunca é hospedado aqui; cada conjunto de dados é um cartão de metadados fixado por SHA (sha-pinned), reconstruído de forma determinística a partir do seu arquivo original fixado. Uma **via não comercial / apenas para pesquisa** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k e os conjuntos de uso para pesquisa do WMT) é excluída de qualquer caminho comercial / de prêmios / de API; dentro dela, os corpora sob licenças modificadas, personalizadas ou não declaradas são adicionalmente **restritos por consentimento (consent-gated)** — a avaliação remota por API de modelo é recusada a menos que o próprio texto da licença conceda o uso para avaliação (registrado como uma decisão explícita por conjunto de dados, como nos conjuntos de uso para pesquisa do WMT) ou a permissão do detentor dos direitos esteja registrada na entrada do conjunto de dados. Os dois conjuntos de dados de referência com curadoria humana — EDTeKLA Dev v1 (Cree das Planícies) e FLORES+ Devtest (870 pares de idiomas catalogados, 1.012 frases cada) — são detalhados abaixo; o detalhamento completo da contagem de entradas do EdTeKLA é declarado uma vez, em [sua seção](#edtekla-development-set-v1).

Os conjuntos de dados são os alvos fixos contra os quais o harness é executado. Cada conjunto de dados é um arquivo JSON contendo pares fonte→alvo com referências padrão-ouro. O harness pontua as saídas do modelo em relação a essas referências — nunca as modifica.

:::danger[NÃO TREINE com dados de avaliação]

⚠️ **Estes conjuntos de dados são apenas para avaliação.** Métodos treinados, ajustados, com poucos exemplos, ou de outra forma expostos a dados de avaliação produzirão pontuações artificialmente inflacionadas e serão **desqualificados do leaderboard.**

Use corpora separados para treinamento. Os conjuntos de avaliação devem permanecer invisíveis para seu modelo durante o desenvolvimento.
:::

---

## Formato do Conjunto de Dados {#dataset-format}

Cada conjunto de dados segue o mesmo esquema JSON:

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[Schema Canônico]
A [Especificação de Benchmark](/docs/network/specifications/benchmark) define o corpus canônico e o schema de entrada. Esta página documenta os datasets disponíveis e como criar novos.
:::

### Bloco `dataset` de Nível Superior

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `id` | `string` | Identificador único do conjunto de dados (usado em cartões de execução e leaderboard) |
| `version` | `string` | Versão semântica. Incrementar isso invalida comparações de cartões de execução anteriores |
| `language_pair` | `string` | Rótulo de exibição (ex: `EN→CRK`) |
| `description` | `string` | Opcional. Resumo legível por humanos |
| `source_language` | `string` | Código de idioma de origem BCP 47 |
| `target_language` | `string` | Código de idioma de destino BCP 47 |
| `created` | `string` | Data de criação ISO 8601 |
| `license` | `string` | Identificador de licença SPDX |
| `provenance` | `string[]` | Lista de tags de proveniência usadas em todas as entradas |

### Campos de Entrada

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | Identificador único de entrada dentro do corpus |
| `source` | `string` | ✅ | O texto de origem a traduzir |
| `reference` | `string` | ✅ | A tradução de referência padrão-ouro |
| `difficulty` | `integer` | ✅ | Nível de dificuldade 1–5 (veja abaixo) |
| `provenance` | `string` | ✅ | Origem desta entrada (ex: `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | Nível de registro/formalidade (ex: `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | Função comunicativa (ex: `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | Contexto opcional para revisores humanos |
| `morphological_analysis` | `string` | ❌ | Análise morfológica padrão-ouro |
| `variant_class` | `string` | ❌ | Rótulo de classe agrupando variantes de tradução aceitáveis |

---

## Datasets Disponíveis

O catálogo contém **~4.700 conjuntos de dados de avaliação obtidos da fonte em 19 famílias
de corpus**, além dos dois conjuntos de dados de referência com curadoria humana (EDTeKLA + FLORES)
detalhados abaixo — um total de registro de **5.602 conjuntos de dados** em 12/07/2026. Cada
corpus é um **cartão de metadados fixado por SHA** — o conteúdo do corpus nunca é hospedado aqui;
ele é reconstruído de forma determinística a partir do seu arquivo original fixado no momento da
avaliação. Todos os conjuntos de dados contêm `do_not_train`. Um cartão de origem se desdobra em muitos
conjuntos de dados por par, de modo que o total do registro excede os ~1.417 cartões de origem; os
conjuntos de dados da via aberta alimentam a fila de varredura (sweep queue) diretamente; a via apenas para pesquisa é executada
sob demanda onde sua licença permite claramente (licenças modificadas/personalizadas/não declaradas
são restritas por consentimento para avaliação remota por API de modelo).

| Família | Conjuntos de dados | Construtor / fonte | Licença | Via |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1.260 | Consórcio TICO-19 (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | aberta |
| **IN22** (Conv + Gen) | 1.012 | AI4Bharat / IIT Madras | CC-BY-4.0 | aberta (download restrito pelo HF) |
| **Tatoeba** | 874 | [Comunidade Tatoeba](https://tatoeba.org), via Tatoeba Challenge | CC-BY-2.0 | aberta |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | aberta |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | aberta |
| **WMT newstest / General** (conjuntos cegos 2014–2025) | 178 | WMT (Conference on Machine Translation), via sacreBLEU | `LicenseRef-WMT-Research-Use` | **uso para pesquisa** |
| **ALT** | 156 | NICT / Projeto ALT | CC-BY-4.0 | aberta |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | aberta |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | aberta |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **não comercial / apenas para pesquisa** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | aberta (share-alike) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **apenas para pesquisa** |
| **LoResMT** (2020 + 2021) | 10 | Workshop LoResMT (organizadores da tarefa compartilhada) | CC-BY-NC-SA-4.0 | **não comercial / apenas para pesquisa** |
| **AmericasNLP 2021** | 9 | Tarefa Compartilhada AmericasNLP (organizadores) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **apenas para pesquisa** |
| **Gamayun** | 8 | CLEAR Global (anteriormente Translators without Borders) | `LicenseRef-TWB-Gamayun` | **não comercial / apenas para pesquisa** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **não comercial / apenas para pesquisa** |
| **EDTeKLA / prêmio** | 3 | Grupo de Pesquisa EdTeKLA, Universidade de Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **não comercial / apenas para pesquisa (em quarentena)** |
| **BSD** | 2 | Laboratório Tsuruoka, Universidade de Tóquio | CC-BY-NC-SA-4.0 | **não comercial / apenas para pesquisa** |
| **MENYO-20k** | 2 | Masakhane / Universidade do Sarre (uds-lsv) | CC-BY-NC-4.0 | **não comercial / apenas para pesquisa** |

*(FLORES+ devtest — 870 pares catalogados, CC-BY-SA-4.0 — é o dataset de referência detalhado abaixo, levando o total do registro a 5.602.)*

:::info[A via não comercial apenas para pesquisa]
A maior parte do catálogo é licenciada de forma permissiva (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) e utilizável em todas as vias. Um pequeno conjunto — **Gamayun** (licença
personalizada da TWB) e **EDTeKLA** (uma CC BY-NC-SA modificada, com escopo de soberania) — é **não comercial**: ele é
excluído de qualquer caminho comercial, de prêmios ou de API. Para corpora sob
licenças modificadas, personalizadas ou não declaradas, a avaliação remota por API de modelo é
adicionalmente **restrita por consentimento**: o harness se recusa a enviar seu texto para
APIs de modelos de terceiros, a menos que o próprio texto da licença conceda o uso para avaliação
(registrado como uma decisão explícita por conjunto de dados — os conjuntos de uso para pesquisa do WMT
possuem uma) ou a permissão explícita do detentor dos direitos esteja registrada na
entrada do conjunto de dados (a avaliação local continua sendo possível). A elegibilidade é **baseada no uso**: a via comercial é rigorosa,
a via de pesquisa é flexível e a quarentena sempre prevalece (para que as fatias inadequadas do EdTeKLA
nunca possam ser ranqueadas). Consulte
[Registrando Corpora e Vias de Exposição](/docs/network/sovereignty/registering-corpora) para
saber como um corpus escolhe sua via.
:::

Os conjuntos de dados de referência são detalhados abaixo; os corpora da família seguem o mesmo esquema JSON e estão listados no registro de conjuntos de dados.

:::note[Um catálogo não é um quadro preenchido]
Um grande catálogo de corpus é o que os métodos *podem* ser benchmarkados — não é um leaderboard cheio de resultados. O quadro em si está germinando; veja as [regras do leaderboard](/docs/network/leaderboard/rules) e [Limitações Honestas](/docs/network/honest-limitations).
:::

### Conjunto de Desenvolvimento EDTeKLA v1 {#edtekla-development-set-v1}

O primeiro dataset de avaliação, construído para tradução English→Plains Cree (SRO). Criado pelo [grupo de pesquisa EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) da Universidade de Alberta.

| Propriedade | Valor |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Versão** | `1.0` |
| **Par de idiomas** | EN → CRK (Cree das Planícies, ortografia SRO) |
| **Contagem de entradas** | Divisão de desenvolvimento (dev split) com 436 entradas (`textbook_dev.json`). Cadeia: 589 linhas alinhadas brutas na origem → 486 pares válidos únicos após normalização/desduplicação (uma contagem derivada do Champollion) → 436 dev + 50 retidos (held-out) (divisão determinística seed-42 do Champollion — o EdTeKLA publica os arquivos brutos, não uma divisão). Um conjunto padrão-ouro (gold-standard) separado de 62 entradas (curadoria manual, apenas para pesquisa, **não** é material do EdTeKLA) eleva a coleção combinada de avaliação em Cree das Planícies do projeto para 548. |
| **Distribuição de dificuldade** | Fácil, Médio, Difícil |
| **Proveniência** | `gold_standard` (verificado por falantes), `textbook` (materiais educacionais publicados) |
| **Licença** | [CC BY-NC-SA modificada do EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — com escopo de soberania; o livro didático raiz é CC BY-NC-ND 4.0) — **excluída das vias de placar de líderes (leaderboard), prêmios e comercial/API** (não comercial) |

> **Esta é a declaração canônica das contagens do conjunto de avaliação em Cree das Planícies.** Outras
> páginas têm links para cá em vez de repeti-las. Os números 486/436/50 são
> derivados pelo Champollion a partir dos arquivos alinhados brutos do EdTeKLA (o próprio EdTeKLA não publica
> contagens ou divisões); o conjunto padrão-ouro de 62 entradas tem proveniência separada,
> não pertencente ao EdTeKLA. A contagem acima é sempre combinada com sua via: o EdTeKLA possui uma CC BY-NC-SA modificada,
> com escopo de soberania e é **excluído do placar de líderes, dos prêmios e do
> caminho comercial/API**.

**O que testa:**

- Saudações básicas e frases comuns
- Animacidade de nomes e obviation
- Conjugação verbal entre pessoas e tempos
- Construções locativas
- Paradigmas possessivos
- Estruturas de sentenças complexas

:::tip[Estrutura do corpus]
O material derivado do EdTeKLA se divide em um conjunto de desenvolvimento (dev set) público e um conjunto retido (held-out set) (a divisão do Champollion do alinhamento bruto do livro didático do EdTeKLA — contagens na tabela acima). O conjunto padrão-ouro separado de 62 entradas é curado manualmente a partir de outras fontes e não faz parte do corpus do EdTeKLA. Um conjunto de dados menor e de alta qualidade com padrões-ouro verificados é mais útil do que um grande e ruidoso — especialmente para um idioma com poucos recursos, onde traduções "boas o suficiente" costumam ser morfologicamente inválidas.
:::

---

## Criando um Novo Conjunto de Dados

Para criar um conjunto de dados para um novo par de idiomas ou domínio:

### 1. Estruture o JSON

Siga o esquema [Formato do Conjunto de Dados](#dataset-format). Cada entrada deve ter `source`, `reference`, `difficulty`, `provenance`, `register` e `context`.

### 2. Atribua um ID único

Use um slug descritivo: `{project}-{split}-v{version}` (ex: `edtekla-dev-v1`, `quechua-test-v1`).

### 3. Verifique os padrões-ouro

Cada valor `reference` deve ser verificado por um falante fluente ou obtido de um recurso publicado e revisado por pares. Referências geradas por máquina derrotam o propósito da avaliação.

### 4. Defina níveis de dificuldade

Atribua a cada entrada um nível de dificuldade inteiro:

| Nível | Descrição | Exemplos |
|------|-------------|----------|
| 1 — Vocabulário básico | Palavras únicas, saudações comuns, números | "hello" → "tânisi" |
| 2 — Sentenças simples | Sujeito-verbo ou SVO, tempo presente | "I see the dog" |
| 3 — Complexidade moderada | Tempo passado/futuro, possessivos, animacidade | "I saw his dog yesterday" |
| 4 — Morfologia complexa | Obviation, voz passiva, ordem conjunta | "the woman whose son went to the store" |
| 5 — Avançado | Multi-cláusula, registro formal, cerimonial, idiomático | Parágrafo completo com tom apropriado ao registro |

### 5. Marque a proveniência

Cada entrada deve indicar de onde veio. Tags comuns:

- `gold_standard` — Verificado por falantes fluentes
- `textbook` — De materiais educacionais publicados
- `elicited` — Produzido através de sessões de elicitação estruturada
- `corpus` — Extraído de um corpus paralelo

### 6. Valide o arquivo

Execute o harness contra seu conjunto de dados com qualquer modelo para verificar se o JSON está bem formado e todos os campos obrigatórios estão presentes:

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

O harness gerará erro em campos ausentes, índices duplicados ou violações de esquema.

### 7. Envie para inclusão

Abra um pull request contra o [repositório do harness de avaliação](https://github.com/gamedaysuits/Champollion) que adiciona um **cartão de metadados fetch-from-source** — uma entrada de registro apontando o harness para a fonte upstream (loader/URL, pin SHA, licença e proveniência). **Nunca faça commit do conteúdo do corpus em si.** Champollion não hospeda ou rastreia texto de corpus de terceiros; o harness busca referências da fonte upstream no momento da execução e pontua contra os dados recém-buscados. Valide localmente primeiro (passo 6), depois envie apenas o cartão. Inclua documentação de sua metodologia de verificação e fontes de proveniência.

---

## FLORES+ Devtest

Um benchmark multilíngue de cobertura ampla mantido pela [Open Language Data Initiative (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus). Usado para comparações de fronteira multi-modelo do champollion.

| Propriedade | Valor |
|----------|-------|
| **ID** | Um cartão por par: `eval-flores-devtest-v1-<src>-<tgt>` (ex: `eval-flores-devtest-v1-amh-fra`) |
| **Pares de idiomas** | 870 pares catalogados e executáveis (812 deles entre dois idiomas não-ingleses) |
| **Contagem de entradas** | 1.012 sentenças por par |
| **Licença** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **Fonte** | Meta FLORES-200, agora mantido por OLDI — buscado da fonte, SHA-pinned por par (conteúdo do corpus nunca é rastreado aqui) |
| **Contaminação** | **ALTA** — apenas relativa, teste / ilustração apenas (veja nota) |

:::warning[ALTA contaminação — apenas relativa, nunca um benchmark absoluto]
FLORES+ é dados públicos, rastreados na web, que modelos de fronteira muito provavelmente já viram. Champollion o executa em uma **faixa apenas relativa**: utilizável para comparar métodos frente a frente, mas **nunca relatado como uma pontuação de qualidade absoluta**, e **nunca usado como uma aresta de cadeia** no [mapa de tradução](https://champollion.dev).
É para **testes e ilustração apenas**.
:::

:::danger[Apenas avaliação]
FLORES+ é destinado exclusivamente para avaliação. Os curadores solicitam explicitamente que **não seja usado como dados de treinamento**. Certifique-se de que seu conteúdo seja excluído de qualquer corpus de treinamento.
:::

---

## Veja Também

- [Avaliação de MT](/docs/network/leaderboard/rules) — visão geral do framework de avaliação e leaderboard
- [Eval Harness](/docs/network/specifications/harness) — como executar avaliações contra estes conjuntos de dados
- [Especificação de Cartão de Execução](/docs/network/specifications/run-card) — o esquema JSON para registrar resultados
- [Leaderboard de Métodos](https://champollion.dev/leaderboard) — pontuações de benchmark ao vivo
- [Projeto EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) — o grupo de pesquisa da University of Alberta por trás do conjunto de dados Cree
