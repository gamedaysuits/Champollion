---
sidebar_position: 8
title: "O Compromisso com Artefatos Derivados"
description: "A quem pertencem os modelos, memórias de tradução e padrões de avaliação construídos a partir de dados linguísticos da comunidade: não a nós. O Champollion é uma infraestrutura para que as comunidades construam e sejam proprietárias dos seus próprios artefatos."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The corpus-side position: data stays with its stewards"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
    note: "How infrastructure custody hands over to communities"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
    note: "The ground rules, in plain language"
---

# O Compromisso com Artefatos Derivados

A posição de [Gestão de Dados](/docs/network/sovereignty/data-sovereignty) cobre as *entradas* (inputs): os corpora permanecem com seus gestores, nós nunca hospedamos ou redistribuímos dados da comunidade. Esta página cobre as *saídas* (outputs) — as coisas que são **construídas a partir** de dados de idiomas: modelos treinados e seus pesos, memórias de tradução, ajustes finos (fine-tunes), conjuntos de treinamento (coaching sets), padrões de avaliação e artefatos de execução.

O compromisso, em uma frase:

> **Não reivindicamos propriedade sobre nenhum modelo de linguagem ou artefato derivado de idioma construído a partir dos dados de uma comunidade — e não temos o desejo de fazê-lo. O objetivo principal deste projeto é colocar o controle em nível de desenvolvimento e de propriedade dessas tecnologias nas mãos dos falantes.**

O Champollion é **infraestrutura**. Uma estrada não é dona das mercadorias que trafegam por ela.

## O que isso significa concretamente

**Os modelos pertencem às pessoas cujo idioma eles falam.** Se um modelo é treinado com os dados de uma comunidade — com nossas ferramentas ou de qualquer outra pessoa —, os pesos, os ajustes finos e todos os derivados seguem os termos da comunidade, não os nossos. Não fazemos cópias, não relicenciamos e não tratamos "nós escrevemos o script de treinamento" como uma participação de propriedade no que ele produziu. A lição é histórica, não hipotética: as comunidades linguísticas têm repetidamente visto organizações externas gravarem, compilarem ou treinarem em seu idioma e, em seguida, reterem os resultados — direitos autorais sobre gravações de anciãos, modelos treinados em falas extraídas da internet — enquanto os próprios falantes tinham que pedir permissão para usar suas próprias vozes. Esse padrão de falha é o que este compromisso existe para eliminar.

**O trabalho com o Plains Cree (nêhiyawêwin) é o caso de teste, e a resposta já está definida.** Nada construído para o Cree neste projeto é nosso — nem o corpus de treinamento (usado com a permissão de seus detentores e nunca redistribuído), nem os pipelines treinados, nem qualquer modelo treinado. Qualquer modelo Cree produzido neste trabalho será lançado **apenas para uma autoridade reconhecida da comunidade** — uma autoridade educacional, um conselho de Anciãos ou qualquer órgão que a própria comunidade designar — sob os próprios termos da comunidade, e para mais ninguém. Não existe nenhuma versão disso em que um modelo Cree seja lançado como um produto. O trabalho de avaliação do Cree é igualmente **totalmente não comercial**: no máximo, o Champollion mantém a metodologia de avaliação *genérica* (o padrão LYSS — a ideia de uma pontuação intencional, ciente da morfologia e que falha de forma honesta). A **instanciação Cree** desse padrão — o conhecimento linguístico que ele codifica e contra o qual valida — não é algo que possuímos; o uso comercial dele é reservado e pendente de consulta com a comunidade linguística nêhiyaw, e os termos da comunidade prevalecem.

**As pontuações viajam; os artefatos não.** O placar de líderes (leaderboard) publica *medições* — um valor chrF++, uma taxa de validação, um intervalo de confiança — com o método e o corpus identificados. Ele nunca publica, hospeda ou exige o próprio modelo, o conteúdo do corpus ou as saídas além do que os termos do gestor permitem. Se uma comunidade quiser que a linha do seu idioma seja removida da visualização pública, as [vias de registro](/docs/network/sovereignty/registering-corpora) existem precisamente para que a exposição seja controlada por eles, não por nós.

## Infraestrutura significa: seus dados, sua build, suas chaves

Três formas concretas de como "somos apenas infraestrutura" se parece na prática:

1. **Uma comunidade constrói seu próprio corpus.** Eles usam a CLI em suas próprias máquinas; o corpus vive onde eles o colocam. Se eles escolherem registrá-lo para benchmarking, o registro armazena um *ponteiro e um checksum* — busca na origem (fetch-from-source), sob a licença deles, e que pode ser removido da lista a pedido deles. O corpus nunca entra em nosso repositório ou em nosso armazenamento. Isso é imposto por mecanismos que você pode inspecionar: o repositório público fornece os portões de quarentena e os gatilhos de banco de dados que tornam a hospedagem de conteúdo da comunidade estruturalmente impossível, não apenas indelicada.

2. **Uma comunidade treina seu próprio modelo.** A suíte de treinamento ([nmt-forge](https://github.com/gamedaysuits/Champollion)) é executada no hardware deles; checkpoints e pesos existem apenas lá. O framework de avaliação (eval harness) o pontua; o placar registra a pontuação. Nós nunca possuímos o modelo. Se eles quiserem que ele seja privado para sempre, ele será — uma linha de pontuação é o único rastro público, e apenas se eles publicarem uma.

3. **Uma comunidade executa seu próprio benchmark.** Com os [concursos soberanos](/docs/network/sovereignty/run-a-sovereign-contest), o conjunto de testes permanece selado em uma infraestrutura controlada pela comunidade; os métodos vêm *até* os dados; apenas as pontuações agregadas saem. A comunidade decide quem pode avaliar, em quais termos, e pode parar a qualquer momento.

Em todos os casos, a direção da viagem é a mesma: a capacidade se move em direção à comunidade; os dados e seus derivados não se afastam dela.

## Os frameworks nos quais nos inspiramos

Somos **inspirados por, e aspirantes a,** frameworks de governança de dados indígenas que as próprias comunidades construíram. Não cabe a nós nos considerarmos em conformidade com nenhum deles — esse julgamento pertence às comunidades e instituições que os criaram. O que podemos fazer é projetar em sua direção, nomeá-los como os definidores de padrões e dizer claramente que valorizaríamos profundamente a oportunidade de ouvir e trabalhar com esses especialistas para melhorar este sistema em seu espírito:

- **Os princípios de soberania de dados das Primeiras Nações** — propriedade, controle, acesso e posse das informações da própria comunidade: precisamente as quatro capacidades que esta página se compromete a manter nas mãos da comunidade.
- **Os Princípios CARE para Governança de Dados Indígenas** (Benefício Coletivo, Autoridade para Controlar, Responsabilidade, Ética - *Collective Benefit, Authority to Control, Responsibility, Ethics*), da Global Indigenous Data Alliance — a lente corretiva para dados puramente "abertos": a abertura não é uma virtude quando retira a autoridade de um povo sobre seu próprio conhecimento.
- **Te Mana Raraunga**, a carta da Rede de Soberania de Dados Māori — dados como um taonga (tesouro) vivo, com direitos e responsabilidades que os acompanham.
- **A Licença Kaitiakitanga** (Te Hiku Media) — até onde sabemos, o exemplo prático mais claro de soberania de artefatos derivados em tecnologia de idiomas: a Te Hiku construiu modelos de fala *a partir do* e *para o* te reo Māori e licencia o acesso sob termos de tutela, para que os modelos beneficiem os Māori e permaneçam sob a governança Māori. Quando dizemos que "os modelos pertencem aos falantes", a Te Hiku é a prova de existência de que isso funciona.
- **O modelo de pesquisa participativa da Masakhane** — PNL (Processamento de Linguagem Natural) africano construído por pesquisadores-falantes como coautores e proprietários, em vez de fontes de dados; a demonstração de que o *processo* de construção de tecnologia de idiomas pode ser, por si só, a transferência de capacidade.

Estes são frameworks diferentes de povos diferentes com posições legais e culturais diferentes — nós os nomeamos lado a lado em vez de agrupá-los em um único rótulo. Onde nosso design não atinge o espírito deles, isso é um defeito a ser corrigido, e preferimos ouvir isso dos especialistas a descobrir em uma análise post-mortem. Se você trabalha nesta área e está disposto a nos dizer onde erramos: **essa conversa é a contribuição mais valiosa que este projeto pode receber.** Entre em contato conosco através de [Envolva-se](/get-involved).

## O que nós possuímos

Para maior clareza, as coisas que o Champollion *de fato* reivindica: o código de infraestrutura (CLI, framework de avaliação, suíte de treinamento — cada um sob sua licença publicada), a metodologia de avaliação genérica e as *medições derivadas* do índice (que carregam a proveniência `champollion-derived` precisamente para que nunca sejam atribuídas erroneamente a uma comunidade ou a uma fonte upstream). Essa é a caixa de ferramentas. O que você constrói com ela é seu.
