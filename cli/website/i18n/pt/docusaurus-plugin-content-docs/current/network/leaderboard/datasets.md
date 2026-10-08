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

> **Resumo executivo.** Esta página descreve os conjuntos de dados de avaliação disponíveis para benchmarking, incluindo o esquema de entradas de corpora, níveis de dificuldade (1–5) e requisitos de proveniência. O catálogo conta com **~4.700 conjuntos de dados de avaliação obtidos diretamente da fonte em 19 famílias de corpora** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, os conjuntos cegos newstest/General do WMT de 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) além do FLORES+ — o *conteúdo* dos corpora nunca é hospedado aqui; cada conjunto de dados é um cartão de metadados fixado por SHA, reconstruído deterministicamente a partir de seu arquivo upstream fixado. Uma **trilha não comercial / exclusiva para pesquisa** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k e os conjuntos de uso em pesquisa do WMT) é excluída de qualquer fluxo comercial, de premiação ou de API; dentro dela, corpora sob concessões modificadas, personalizadas ou não declaradas passam adicionalmente por **controle de consentimento (consent-gated)** — a avaliação remota por API de modelos recusa a execução, a menos que o próprio texto da licença conceda o uso para avaliação (registrado como uma decisão explícita por conjunto de dados, como nos conjuntos de uso em pesquisa do WMT) ou que a permissão do detentor dos direitos esteja registrada na entrada do conjunto de dados. Os dois conjuntos de dados de referência com curadoria humana — EDTeKLA Dev v1 (Cree das Planícies) e FLORES+ Devtest (870 pares de idiomas catalogados, com 1.012 frases cada) — são detalhados abaixo; o detalhamento completo da contagem de entradas do EdTeKLA é informado uma única vez, em [sua seção](#edtekla-development-set-v1).

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

O catálogo conta com **~4.700 conjuntos de dados de avaliação obtidos diretamente da fonte em 19 famílias
de corpora**, além dos dois conjuntos de dados de referência com curadoria humana (EDTeKLA + FLORES)
detalhados abaixo — totalizando **5.601 conjuntos de dados** no registro em 06/09/2026. Cada
corpus é um **cartão de metadados fixado por SHA** — o conteúdo dos corpora nunca é hospedado aqui;
ele é reconstruído deterministicamente a partir de seu arquivo upstream fixado no momento
da avaliação. Todos os conjuntos de dados contêm `do_not_train`. Um único cartão de origem se desdobra em vários
conjuntos de dados por par, de modo que o total no registro supera os ~1.417 cartões de origem; os
conjuntos de dados da trilha aberta alimentam diretamente a fila de varredura; a trilha exclusiva para pesquisa é executada
sob demanda quando sua licença permitir claramente (concessões modificadas/personalizadas/não declaradas
possuem controle de consentimento para avaliação remota por API de modelos).

| Família | Conjuntos de dados | Criador / fonte | Licença | Trilha |
|---------|-------------------:|-----------------|---------|--------|
| **TICO-19** | 1.260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | aberta |
| **IN22** (Conv + Gen) | 1.012 | AI4Bharat / IIT Madras | CC-BY-4.0 | aberta (download restrito via HF) |
| **Tatoeba** | 874 | [Comunidade Tatoeba](https://tatoeba.org), via Tatoeba Challenge | CC-BY-2.0 | aberta |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | aberta |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | aberta |
| **WMT newstest / General** (conjuntos cegos de 2014–2025) | 178 | WMT (Conference on Machine Translation), via sacreBLEU | `LicenseRef-WMT-Research-Use` | **uso em pesquisa** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | aberta |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | aberta |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | aberta |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **não comercial / exclusiva para pesquisa** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | aberta (share-alike) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **exclusiva para pesquisa** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (organizadores da shared task) | CC-BY-NC-SA-4.0 | **não comercial / exclusiva para pesquisa** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (organizadores) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **exclusiva para pesquisa** |
| **Gamayun** | 8 | CLEAR Global (anteriormente Translators without Borders) | `LicenseRef-TWB-Gamayun` | **não comercial / exclusiva para pesquisa** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **não comercial / exclusiva para pesquisa** |
| **EDTeKLA / prize** | 2 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **em quarentena: nunca executável ou ranqueado** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **não comercial / exclusiva para pesquisa** |
| **MENYO-20k** | 2 | Masakhane / Saarland University (uds-lsv) | CC-BY-NC-4.0 | **não comercial / exclusiva para pesquisa** |

*(O FLORES+ devtest — 870 pares catalogados, CC-BY-SA-4.0 — é o conjunto de dados
de referência detalhado abaixo, elevando o total do registro para 5.601.)*

:::info[A trilha não comercial e exclusiva para pesquisa]
A maior parte do catálogo possui licenciamento permissivo (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) e pode ser usada em qualquer trilha. Um pequeno conjunto — **Gamayun** (licença
personalizada da TWB) e **EDTeKLA** (uma licença CC BY-NC-SA modificada, com escopo voltado à soberania) — é **não comercial**: ele fica
excluído de qualquer fluxo comercial, de premiação ou de API. Para corpora sob
concessões modificadas, personalizadas ou não declaradas, a avaliação remota por API de modelos passa
adicionalmente por **controle de consentimento (consent-gated)**: o harness se recusa a enviar o texto para
APIs de modelos de terceiros, a menos que o próprio texto da licença conceda o uso para avaliação
(registrado como uma decisão explícita por conjunto de dados — os conjuntos de uso em pesquisa do WMT
possuem uma) ou que a permissão explícita do detentor dos direitos esteja registrada na
entrada do conjunto de dados (a avaliação local continua sendo possível). A elegibilidade é **baseada no uso**: a trilha comercial é rigorosa,
a trilha de pesquisa é flexível e a quarentena sempre prevalece (os corpora do EdTeKLA estão
em quarentena definitiva, e o banco de dados rejeita qualquer pontuação submetida para eles). Veja
[Registrando Corpora e Trilhas de Exposição](/docs/network/sovereignty/registering-corpora) para
entender como um corpus escolhe sua trilha.
:::

Os conjuntos de dados de referência são detalhados abaixo; os corpora da família seguem o mesmo esquema JSON e estão listados no registro de conjuntos de dados.

:::note[Um catálogo não é um quadro preenchido]
Um grande catálogo de corpus é o que os métodos *podem* ser benchmarkados — não é um leaderboard cheio de resultados. O quadro em si está germinando; veja as [regras do leaderboard](/docs/network/leaderboard/rules) e [Limitações Honestas](/docs/network/honest-limitations).
:::

### Conjunto de Desenvolvimento EDTeKLA v1 {#edtekla-development-set-v1}

O primeiro dataset de avaliação, construído para tradução English→Plains Cree (SRO). Criado pelo [grupo de pesquisa EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) da Universidade de Alberta.

| Propriedade | Valor |
|-------------|-------|
| **ID** | `eval-eng-crk-edtekla-dev-v1` (e `eval-eng-crk-edtekla-textbook`) |
| **Versão** | `1.0` |
| **Par de idiomas** | EN → CRK (Cree das Planícies, ortografia SRO) |
| **Contagem de entradas** | Divisão de desenvolvimento com 436 entradas (`textbook_dev.json`). Cadeia: 589 linhas alinhadas brutas no upstream → 486 pares válidos únicos após normalização/desduplicação (uma contagem obtida pelo Champollion) → 436 dev + 50 retidas (divisão determinística com seed-42 do Champollion — o EdTeKLA publica os arquivos brutos, não uma divisão). Um conjunto padrão-ouro separado com 62 entradas (curadoria manual, exclusivo para pesquisa, **não** sendo material do EdTeKLA) eleva a coleção combinada de avaliação de Cree das Planícies do projeto para 548. |
| **Distribuição de dificuldade** | Fácil, Médio, Difícil |
| **Proveniência** | `gold_standard` (verificado por falantes), `textbook` (materiais educacionais publicados) |
| **Licença** | [CC BY-NC-SA modificada do EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — com escopo de soberania; o livro didático original é CC BY-NC-ND 4.0) — **em quarentena**: catalogado, mas nunca executável, e qualquer pontuação enviada para ele é rejeitada pelo banco de dados; excluído do leaderboard, premiações e trilhas comerciais/de API (não comercial) |

> **Esta é a declaração canônica das contagens do conjunto de avaliação de Cree das Planícies.** Outras
> páginas colocam links para cá em vez de repeti-las. Os números 486/436/50 são
> derivados pelo Champollion a partir dos arquivos brutos alinhados do EdTeKLA (o próprio EdTeKLA
> não publica contagens nem divisões); o conjunto padrão-ouro de 62 entradas tem
> proveniência separada e externa ao EdTeKLA. A contagem acima está sempre associada à sua trilha: o EdTeKLA adota uma CC BY-NC-SA
> modificada, com escopo voltado à soberania, e está **excluído da tabela de classificação (leaderboard), de premiações e do
> fluxo comercial/de API**.

**O que testa:**

- Saudações básicas e frases comuns
- Animacidade de nomes e obviation
- Conjugação verbal entre pessoas e tempos
- Construções locativas
- Paradigmas possessivos
- Estruturas de sentenças complexas

:::tip[Estrutura do corpus]
O material derivado do EdTeKLA se divide em um conjunto de desenvolvimento público e um conjunto retido (held-out) (a divisão feita pelo Champollion a partir do alinhamento bruto do livro didático do EdTeKLA — contagens na tabela acima). O conjunto padrão-ouro separado de 62 entradas foi curado manualmente a partir de outras fontes e não faz parte do corpus do EdTeKLA. Um conjunto de dados menor e de alta qualidade com referências padrão-ouro verificadas é mais útil do que um conjunto grande e ruidoso — especialmente para um idioma de baixos recursos, no qual traduções que parecem "próximas o suficiente" costumam ser morfologicamente inválidas.
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
