---
sidebar_position: 8
title: "Registrando Corpora e Exposure Lanes"
slug: /network/sovereignty/registering-corpora
description: "Registre um corpus de avaliação sem abrir mão dele. Os quatro níveis de exposição — apenas local, privado, público e selado —, as trilhas de licenciamento que os acompanham e como o fetch-from-source mantém o conteúdo do corpus fora das nossas mãos."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Registrando Corpora & Exposure Lanes

> **Resumo Executivo.** Você pode registrar um corpus de avaliação na Rede para que métodos possam ser testados em benchmark contra ele **sem nos entregar os dados**. Cada corpus é registrado como um *cartão de metadados* fixado por SHA, não como conteúdo — as frases reais são buscadas de sua fonte no momento da avaliação. Ao registrar, você faz duas escolhas independentes: um **nível de exposição** — o quanto sai da sua máquina (`local-only`, `private`, `public` ou `sealed`, onde o corpus é criptografado no seu dispositivo sob uma chave de custódia M-de-N) — e uma **faixa de licença**, que determina para que o corpus pode ser usado (público, apenas para pesquisa não comercial ou privado). Este é o mecanismo que permite que uma comunidade torne seu idioma *mensurável* sem torná-lo *extraível*.

A avaliação de tradução automática geralmente exige o oposto da soberania de dados:
"envie seu conjunto de teste para que possamos fazer score contra ele." Isso é inaceitável para
corpora de línguas indígenas e outras comunidades, onde os dados são propriedade
das pessoas de quem vêm. A Network foi construída para que você nunca precise fazer esse
compromisso.

---

## 1. Registro é metadados, não conteúdo {#1-registration-is-metadata-not-content}

Um corpus registrado é um **cartão**: um pequeno registro JSON descrevendo *onde* o
corpus está e *o que é*, com um hash de conteúdo para que os bytes exatos possam ser
verificados — mas **sem sentenças**. Um cartão contém:

| Campo | O que é |
|-------|-----------|
| `url` | Onde o corpus é buscado (o arquivo upstream que você controla) |
| `sha256` | Hash de conteúdo do arquivo fixado — prova que ninguém trocou os dados |
| `license` | Identificador SPDX (ou `LicenseRef-…` para uma licença personalizada) |
| `language_pair` | Origem → alvo, ex. `eng-crk` |
| `do_not_train` | Sempre definido — dados de avaliação nunca devem ser treinados |
| `attribution` | O crédito do construtor/linguista mostrado em todos os lugares onde o corpus aparece |

No momento da avaliação, o harness **busca da fonte**, verifica o `sha256`,
e faz score contra as referências recém-buscadas. A Network nunca armazena, hospeda,
ou redistribui o conteúdo do corpus. Se você tirar o arquivo upstream do ar,
o corpus simplesmente deixa de ser executável — o controle permanece com você. Esta é a
mesma disciplina de buscar-da-fonte aplicada a todo o catálogo (veja
[Evaluation Datasets](/docs/network/leaderboard/datasets)).

:::info[Por que um hash em vez de uma cópia]
Um hash de conteúdo permite que uma pontuação auto-relatada seja **verificada novamente** contra o corpus real e não modificado sem que nunca o possuamos. Uma execução cujos números não se reproduzem contra a fonte fixada pelo hash é rejeitada. Verificabilidade e não-posse não estão em tensão aqui — o hash é o que torna ambas possíveis.
:::

---

## 2. Duas escolhas separadas

O registro faz duas perguntas independentes, e vale a pena mantê-las separadas porque elas protegem coisas diferentes:

1. **O que sai da sua máquina** — o *nível de exposição*.
2. **Para que seu corpus pode ser usado** — a *faixa de licença*.

Um corpus pode ser selado e não comercial, ou público e liberado comercialmente, ou qualquer outra combinação. Uma coisa não implica a outra.

### 2a. Níveis de exposição — o que sai da sua máquina

Quatro níveis, definidos em `cli/lib/corpus-registration.mjs`. **O conteúdo do corpus em texto simples nunca é enviado em nenhum deles** — isso não é uma configuração de política, é verdade para todos os níveis. O registro sempre usa o mais privado como padrão.

| Nível | Registrado? | O que recebemos | Cartão rastreado |
|---|:---:|---|:---:|
| **Privado / apenas local** | ❌ | Nada. O cartão e o texto permanecem na sua máquina. **O padrão.** | ❌ |
| **Registrar de forma privada** | ✅ | Apenas metadados — um conjunto retido secreto no estilo WMT. Você mantém a custódia; os resultados podem ser publicados sem expor os dados. | ✅ |
| **Registrar publicamente** | ✅ | Metadados + um ponteiro de busca na fonte. Seu texto é buscado do upstream sob demanda, nunca hospedado aqui. Precisa de uma licença liberada para redistribuição. | ✅ |
| **Selado** | ✅ | Texto cifrado + um cartão sem conteúdo. Nada mais. | ✅ |

**Selado é a garantia mais forte que o sistema oferece.** Seu corpus é criptografado **no seu dispositivo**, sob a chave de limiar do grupo de custodiantes, antes que um único byte saia. O Champollion recebe o texto cifrado e não pode descriptografá-lo — e nenhum custodiante individual pode fazê-lo: são necessários **M de N** deles juntos para autorizar uma execução. Conjuntos selados são catalogados, mas colocados em quarentena, e são emparelhados com um corpus *qualificador* público pelo qual um método deve passar antes que uma execução selada possa sequer ser proposta. Consulte [Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest) e o [Nó de Avaliação Soberano](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Faixas de licença — para que o corpus pode ser usado

Separadamente, a licença determina onde os resultados podem aparecer.

#### Público

Um corpus com licença aberta (ex. CC0, CC-BY) cujas referências podem aparecer em
superfícies públicas e cujas execuções podem rankear no leaderboard público. O conteúdo ainda é
buscado-da-fonte — "public" governa *exposição de referências e rankings*, não
hospedagem. A maioria do catálogo (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) está nesta lane.

#### Apenas para pesquisa não comercial

Um corpus sob uma licença não-comercial (ex. CC BY-NC-SA, ou uma licença
personalizada de comunidade/ONG como a `LicenseRef-TWB-Gamayun` dos kits Gamayun). Pode
ser **comparado para pesquisa** — métodos rodam nele, scores são computados —
mas é **excluído de todos os caminhos comerciais, prêmios e API.** A elegibilidade é
**baseada em uso**, não em corpus:

- a **lane comercial é rigorosa** — qualquer coisa não claramente licenciada comercialmente é
  excluída;
- a **lane de pesquisa é leniente** — corpora não-comerciais são bem-vindos;
- **quarentena sempre vence** — um corpus marcado como um subconjunto impróprio (ou
  de outra forma barrado) nunca pode rankear em *nenhuma* lane, independentemente da licença.

É assim que uma comunidade pode deixar seu corpus impulsionar o progresso da pesquisa enquanto o mantém
fora de qualquer produto.

#### Privado

Um corpus registrado para **suas próprias execuções com score**, onde as referências nunca são
publicadas. Você mantém a fonte; você executa a avaliação; você decide o que, se
algo, é alguma vez mostrado. Um corpus privado pode ser tornado público ou não-comercial
depois — a exposição apenas *se afrouxa* por uma decisão explícita e controlada pelo proprietário, nunca
silenciosamente.

| Faixa de licença | Permite benchmark | Referências mostradas publicamente | Pode entrar no ranking público | No caminho comercial / de prêmios / de API |
|------|:---:|:---:|:---:|:---:|
| **Público** | ✅ | ✅ | ✅ | ✅ (se a licença permitir) |
| **Apenas para pesquisa não comercial** | ✅ | depende da licença | apenas faixa de pesquisa | ❌ |
| **Privado** | ✅ (suas execuções) | ❌ | ❌ | ❌ |

:::note[A lane comercial é um guardrail, não um negócio]
Champollion em si é não-comercial — não há API paga ou produto por trás de nada disso. A lane comercial/prêmio existe como um guardrail *prospectivo*: registra, mecanicamente, quais corpora poderiam legalmente aparecer em um contexto de prêmio ou comercial, para que nenhum uso futuro — por qualquer pessoa — possa ultrapassar uma licença ou os termos de um curador.
:::

---

## 3. Garantias de soberania

O registro é projetado em torno da [posição de data stewardship](/docs/network/sovereignty/data-sovereignty).
Concretamente:

- **A possessão permanece com a fonte.** Mantemos um hash e uma URL, não os dados.
- **O controle é do proprietário.** A lane é escolha do proprietário, e a exposição apenas
  se afrouxa por uma decisão explícita. Tirar o arquivo upstream do ar revoga a executabilidade.
- **Não-comercial significa não-comercial.** Corpora NC são mecanicamente excluídos
  de lanes comerciais, prêmios e API — não por promessa, por gate.
- **Subconjuntos impróprios nunca podem rankear.** Quarentena sobrescreve licença, então um corpus
  barrado de rankear permanece barrado em todos os lugares.
- **Atribuição é obrigatória.** O crédito do construtor/linguista viaja com o cartão
  para todas as superfícies onde o corpus aparece.

Para como os termos por língua são definidos — incluindo transferência de propriedade de método para
prêmios patrocinados — veja [Ownership & Terms](/docs/network/sovereignty/ownership-transfer).

---

## 4. Como registrar

O schema do cartão de corpus e as ferramentas de build/verificação são documentados em
[Corpus Design Framework](/docs/network/specifications/corpus-design) e no
[Corpus Creation cookbook](/docs/network/tutorials/corpus-creation). Em resumo:

1. Hospede o arquivo do corpus em algum lugar que você controla (ele fica lá — nunca é
   copiado para a Network).
2. Escreva um cartão: `url`, `sha256`, `license`, `language_pair`, `attribution`,
   `do_not_train`.
3. Escolha a exposure lane (public / non-commercial / private).
4. Registre o cartão. Métodos agora podem ser comparados contra o corpus
   buscado-da-fonte, sob as regras da lane.

Você nunca envia as sentenças. Você pode parar a qualquer momento.
