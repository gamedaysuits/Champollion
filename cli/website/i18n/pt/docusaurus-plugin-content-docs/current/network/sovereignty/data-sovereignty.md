---
sidebar_position: 7
title: "Governança de Dados"
description: "A posição do Champollion sobre dados linguísticos: corpora permanecem com seus guardiões, todas as licenças são respeitadas, e termos comunitários governam dados comunitários."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Gestão de Dados

> **Resumo Executivo.** Champollion é um conjunto de ferramentas de pesquisa e desenvolvimento de tradução automática — com código-fonte disponível e gratuito para uso não comercial, tendo seu framework de avaliação em código aberto. Esta página declara sua posição sobre dados de idiomas na íntegra: os corpora pertencem às pessoas de onde se originam, cada licença e termo da comunidade é respeitado mecanicamente em vez de por promessa, e a plataforma não impõe termos próprios sobre o idioma de ninguém.

:::info[Dados de idioma são biodados]
Dados de idioma são **biodados**. Como dados genéticos ou de saúde, um idioma carrega
a identidade, parentesco e relacionamentos das pessoas que o falam — e como
um genoma, não pode ser significativamente anonimizado: remova os nomes e o idioma
ainda codifica quem são seus falantes. Portanto, as pessoas que fornecem um corpus
detêm as chaves para ele e para qualquer coisa medida contra ele. Essa é a premissa
em que tudo abaixo se baseia.
:::

A partir dessa premissa, o design segue. Champollion trata cada contribuidor de corpus como um **guardião**: o corpus permanece deles — legal, física e praticamente — enquanto a infraestrutura o torna *mensurável*.

## Os compromissos

1. **Nunca mantemos os dados.** Corpora são registrados como cartões de metadados com hash fixado e obtidos da hospedagem própria do guardião no momento da avaliação. Nada é copiado para este repositório ou servido de nossa infraestrutura. Coloque seu arquivo offline e a avaliação contra ele simplesmente para. Veja [Registrando Corpora](/docs/network/sovereignty/registering-corpora).

2. **Cada licença é respeitada — por gate, não por promessa.** Corpora não comerciais e apenas para pesquisa são mecanicamente excluídos de qualquer uso que sua licença não permita. Restrições afirmadas por uma comunidade além da licença são registradas com sua fonte e honradas da mesma forma. A aplicação vive em gates de CI e triggers de banco de dados, não em um código de conduta.

3. **Os termos são do guardião e variam.** Diferentes linguagens terão diferentes acordos — um corpus CC0 público, um corpus comunitário apenas para pesquisa e um conjunto de teste selado com requisitos de implantação soberana podem todos participar, cada um em seus próprios termos. Não há contrato universal aqui e nenhuma reivindicação padrão sobre nada. Veja o [Framework de Termos](/docs/network/sovereignty/ownership-transfer).

4. **Corpora secretos são suportados como arquitetura, não exceção.** Uma comunidade pode manter um conjunto de teste selado — mantido em sua própria infraestrutura, nunca visto por Champollion ou por desenvolvedores — e ainda ter métodos pontuados contra ele. Mensurabilidade sem extractibilidade é um objetivo de design, não uma solução alternativa.

5. **Atribuição e crédito viajam com os dados.** Crédito de construtor e linguista é obrigatório em cada superfície onde um corpus aparece. Quando uma comunidade aplicou Labels TK ou BC do [Local Contexts](https://localcontexts.org/), os exibimos e honramos o protocolo que codificam. Carregamos Labels; nunca os criamos.

6. **Contribuidores são pagos.** Construção e validação de corpus são trabalho profissional com taxas publicadas — veja [Como Falantes Recebem Pagamento](/docs/network/perspectives/how-speakers-get-paid). O pagamento não compra o corpus: o construtor é pago *e* permanece como guardião.

## Como uma licença se torna uma regra aplicada

O Compromisso 2 tem um formato específico e vale a pena declará-lo na íntegra — é assim que "cada licença é respeitada" funciona na prática, não apenas um resumo de boas intenções.

**Todo benchmark entra retido.** Um conjunto de testes recém-catalogado fica em quarentena por padrão: visível no índice, excluído da fila de avaliação, de competições e de todos os rankings. Nada sobre um corpus é presumido na entrada — nem mesmo uma licença que pareça permissiva — até que seus termos sejam revisados em relação ao texto real da licença em uma revisão upstream fixada.

**Os vereditos de revisão são mecânicos, e os casos difíceis permanecem retidos.** Uma licença permissiva claramente declarada libera o corpus para todas as trilhas. Uma licença não comercial claramente declarada o libera para uma trilha de pesquisa que é excluída de todas as superfícies comerciais, de premiações e de API. E uma licença que seja não declarada, modificada, mista ou personalizada **nunca é interpretada em nome do detentor dos direitos**: o corpus permanece catalogado, mas retido — fora da fila, de competições e de rankings — até que o detentor dos direitos declare os termos ou registre uma concessão. O veredito, sua data, sua trilha e sua base são registrados em formato legível por máquina no cartão do corpus e em suas entradas de registro, para que "por que isso é executável?" sempre tenha uma resposta citável, assim como "por que isso não é?".

**Enviar texto para um modelo é uma transmissão, e ela é controlada.** Avaliar um modelo significa enviar a ele frases de origem — isso é o corpus saindo de casa, e é regido por licença. Corpora com licença permissiva podem usar canais padrão. Corpora sob uma licença não comercial declarada trafegam apenas por canais que contratualmente não treinam sobre os dados de entrada — declarado exatamente assim: uma garantia de não treinamento, não de não retenção. Corpora sob concessões não declaradas ou modificadas têm a avaliação remota recusada sumariamente até que o consentimento seja registrado, e conjuntos comunitários selados nunca saem da infraestrutura de seu gestor. Quando o controle recusa, sua mensagem de recusa cita o veredito da revisão da licença.

**A aplicação das regras atua abaixo de todos os clientes.** As retenções são aplicadas por um gatilho de banco de dados que nenhum cliente pode contornar, a regra de não hospedagem é aplicada por um controle de repositório que verifica cada caminho rastreado em busca de conteúdo do corpus, e o controle de transmissão é executado dentro do próprio framework de avaliação. Qualquer um deles pode nos dizer não, e esse é o objetivo.

## O que isso não é

Champollion não é um intermediário de dados, não é um fornecedor de tradução e não é uma plataforma comercial. É uma ferramenta de pesquisa. Uma pontuação alta no ranking prova que um método funciona tecnicamente; não é uma licença para publicar traduções, redistribuir um corpus ou implantar qualquer coisa contra os desejos de uma comunidade. Essas decisões pertencem ao guardião, sempre.

## Os frameworks que moldaram este design

Essa postura não foi inventada aqui. É informada por, e em dívida com, o trabalho de governança de dados indígenas dos últimos dois décadas:

- **Princípios de soberania de dados das Primeiras Nações** — as Primeiras Nações no Canadá articularam a propriedade, o controle, o acesso e a posse de suas próprias informações; o modelo de gestão aqui é projetado para ser compatível com essas afirmações.
- **[Princípios CARE](https://www.gida-global.org/care)** (Collective Benefit, Authority to Control, Responsibility, Ethics) — Global Indigenous Data Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — a Rede de Soberania de Dados Māori.
- **A [Licença Kaitiakitanga](https://tehiku.nz/)** — a licença baseada em guardianato da Te Hiku Media para dados de te reo Māori, uma influência direta no modelo de custódia guardião-detém-as-chaves usado aqui.

Apontamos qualquer pessoa que projete governança para os dados da linguagem de sua comunidade diretamente para essas fontes — elas são as autoridades, não nós. Quando uma comunidade adota qualquer um desses frameworks para seu corpus, o cartão do corpus registra essa afirmação e a ferramenta a honra.

Champollion exibe o Aviso **"Open to Collaborate"** do Local Contexts: construímos relacionamentos com as comunidades cujas linguagens aparecem aqui, e Labels criados pela comunidade superam qualquer coisa que digamos sobre seus dados.

## Veja Também

- [Soberania de Dados, do zero](/docs/learn/data-sovereignty) — a versão introdutória desta página, para leitores que não estão familiarizados com o conceito

- [Registrando Corpora & Exposure Lanes](/docs/network/sovereignty/registering-corpora) — a mecânica
- [Para Comunidades de Linguagem](/docs/network/community/for-language-communities) — um guia em linguagem clara
- [Como Falantes Recebem Pagamento](/docs/network/perspectives/how-speakers-get-paid) — taxas e termos publicados
- [Métodos de Tradução](https://champollion.dev/docs/guides/translation-methods) — o método `api`, que mantém os prompts, dicionários e dados de coaching de uma comunidade em seus próprios servidores
