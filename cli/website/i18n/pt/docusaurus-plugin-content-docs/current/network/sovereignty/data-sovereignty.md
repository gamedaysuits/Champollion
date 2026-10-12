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

> **Resumo Executivo.** O Champollion é um conjunto de ferramentas de pesquisa e
> desenvolvimento de tradução automática — com código disponível (source-available) e gratuito para uso não comercial, com seu
> harness de avaliação em código aberto. Esta página estabelece sua posição sobre dados linguísticos
> na íntegra: os corpora pertencem às pessoas de onde se originam, cada licença e
> termo comunitário é respeitado mecanicamente em vez de por promessa, e a plataforma
> não impõe termos próprios sobre a língua de ninguém.

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

2. **Cada licença é respeitada — por gate, não por promessa.** Corpora
   não comerciais e exclusivos para pesquisa são excluídos mecanicamente de qualquer uso
   que sua licença não permita. Restrições declaradas por uma comunidade além da licença são
   registradas com sua fonte e honradas da mesma forma. A aplicação prática reside em
   gates de pré-push executados localmente antes de cada push (o CI está desativado no momento) e
   em gatilhos de banco de dados, não em um código de conduta.

3. **Os termos são do guardião e variam.** Diferentes linguagens terão diferentes acordos — um corpus CC0 público, um corpus comunitário apenas para pesquisa e um conjunto de teste selado com requisitos de implantação soberana podem todos participar, cada um em seus próprios termos. Não há contrato universal aqui e nenhuma reivindicação padrão sobre nada. Veja o [Framework de Termos](/docs/network/sovereignty/ownership-transfer).

4. **Corpora secretos são suportados como arquitetura, não exceção.** Uma comunidade pode manter um conjunto de teste selado — mantido em sua própria infraestrutura, nunca visto por Champollion ou por desenvolvedores — e ainda ter métodos pontuados contra ele. Mensurabilidade sem extractibilidade é um objetivo de design, não uma solução alternativa.

5. **Atribuição e crédito acompanham os dados.** O crédito aos criadores
   e linguistas é obrigatório em todas as superfícies onde um corpus aparece. Onde uma comunidade
   aplicou os Rótulos (Labels) TK ou BC do [Local Contexts](https://localcontexts.org/), temos a
   intenção de exibi-los e respeitar o protocolo que eles codificam; o suporte a Labels
   ainda não foi implementado. Nós veicularemos os Labels; nós nunca os emitimos.

6. **Os colaboradores serão remunerados.** A criação e a validação de corpora
   são trabalhos profissionais, a serem pagos conforme taxas publicadas assim que houver financiamento
   (nenhum fundo é mantido hoje) — veja
   [Como os Falantes São Remunerados](/docs/network/perspectives/how-speakers-get-paid).
   O pagamento não compra o corpus: quem constrói é remunerado *e* continua sendo
   o custodiante (steward).

## Como uma licença se torna uma aplicação prática

O Compromisso 2 tem um formato específico, e vale a pena expressá-lo na íntegra — é
assim que "cada licença é respeitada" realmente funciona, não um resumo de boas
intenções.

**Todo benchmark entra retido.** Um conjunto de testes recém-catalogado entra em quarentena
por padrão: visível no índice, excluído da fila de avaliação, de
concursos e de qualquer classificação. Nada sobre um corpus é presumido no momento da inclusão
— nem mesmo uma licença que pareça permissiva — até que seus termos sejam revisados em relação
ao texto real da licença em uma revisão upstream fixada.

**Os vereditos de revisão são mecânicos, e os casos difíceis continuam retidos.** Uma
licença permissiva claramente declarada libera o corpus para todas as esteiras (lanes). Uma
licença não comercial claramente declarada o libera para uma esteira de pesquisa que é excluída de
qualquer superfície comercial, de premiação e de API. E uma licença não declarada,
modificada, mista ou personalizada **nunca é interpretada em nome do detentor dos
direitos**: o corpus permanece catalogado, mas retido — fora da fila, de concursos
e de classificações — até que o detentor dos direitos defina os termos ou registre uma concessão. O
veredito, sua data, sua esteira e sua base são gravados de forma legível por máquina no
cartão do corpus e em suas entradas de registro, de modo que "por que isso pode ser executado?" sempre tenha
uma resposta citável, assim como "por que isso não pode?".

**Enviar texto para um modelo é uma transmissão e passa por controle (gated).** Avaliar
um modelo significa enviar a ele sentenças de origem — isso é o corpus saindo de casa, e
isso é regido pela licença. Corpora com licenças permissivas podem usar canais
padrão. Corpora sob uma licença declarada não comercial trafegam apenas por
canais que, contratualmente, não treinam com os dados de entrada — declarado exatamente como isso:
uma garantia de não treinamento, não apenas de não retenção. Corpora sob concessões não
declaradas ou modificadas têm a avaliação remota recusada de imediato até que o consentimento
seja registrado, e conjuntos comunitários restritos (sealed) nunca saem da infraestrutura do
seu custodiante. Quando o gate recusa, sua mensagem de recusa cita o veredito da
revisão da licença.

**A aplicação prática atua abaixo de cada cliente.** As retenções são aplicadas por
um gatilho de banco de dados que nenhum cliente consegue ignorar, a regra de não hospedagem é aplicada por
um gate de pré-push, executado localmente antes de cada push (o CI está desativado no momento), que
verifica todos os caminhos rastreados e enviados em busca de conteúdo de corpus, e o gate de
transmissão roda dentro do próprio harness de avaliação. Qualquer um deles pode nos dizer
não, o que é exatamente o objetivo.

## O que isso não é

Champollion não é um intermediário de dados, não é um fornecedor de tradução e não é uma plataforma comercial. É uma ferramenta de pesquisa. Uma pontuação alta no ranking prova que um método funciona tecnicamente; não é uma licença para publicar traduções, redistribuir um corpus ou implantar qualquer coisa contra os desejos de uma comunidade. Essas decisões pertencem ao guardião, sempre.

## Os frameworks que moldaram este design

Essa postura não foi inventada aqui. É informada por, e em dívida com, o trabalho de governança de dados indígenas dos últimos dois décadas:

- **Princípios de soberania de dados das Primeiras Nações** — As Primeiras Nações no Canadá
  articularam propriedade comunitária, controle, acesso e posse de
  suas próprias informações; o modelo de custódia aqui foi projetado para ser
  compatível com essas declarações.
- **[Princípios CARE](https://www.gida-global.org/care)** (Benefício Coletivo,
  Autoridade para Controlar, Responsabilidade, Ética) — Global Indigenous Data
  Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — a Rede de Soberania
  de Dados Māori.
- **A [Kaitiakitanga License](https://tehiku.nz/)** — a licença baseada em
  tutela da Te Hiku Media para dados em te reo Māori, uma influência direta no
  modelo de custódia onde o custodiante detém as chaves utilizado aqui.

Apontamos qualquer pessoa que projete governança para os dados da linguagem de sua comunidade diretamente para essas fontes — elas são as autoridades, não nós. Quando uma comunidade adota qualquer um desses frameworks para seu corpus, o cartão do corpus registra essa afirmação e a ferramenta a honra.

O Champollion pretende adotar o **Aviso "Open to Collaborate"** e os Labels do Local Contexts;
nenhum dos dois está implementado ainda. Quando estiverem, os Labels criados pela comunidade
prevalecerão sobre qualquer coisa que digamos a respeito dos dados de uma comunidade.

## Veja Também

- [Soberania de Dados, do zero](/docs/learn/data-sovereignty) — a versão introdutória desta página, para leitores iniciantes no assunto

- [Registrando Corpora & Exposure Lanes](/docs/network/sovereignty/registering-corpora) — a mecânica
- [Para Comunidades de Linguagem](/docs/network/community/for-language-communities) — um guia em linguagem clara
- [Como Falantes Recebem Pagamento](/docs/network/perspectives/how-speakers-get-paid) — taxas e termos publicados
- [Métodos de Tradução](https://champollion.dev/docs/guides/translation-methods) — o método `api`, que mantém os prompts, dicionários e dados de coaching de uma comunidade em seus próprios servidores
