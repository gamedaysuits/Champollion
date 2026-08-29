---
title: "O que a soberania de dados significa quando você a implementa em um software"
sidebar_label: "Soberania de dados"
description: "A soberania de dados indígenas é um conjunto de princípios sobre quem possui, controla, acessa e detém os dados. É assim que esses princípios se apresentam quando alguém tenta implementá-los em um software funcional — e o que essa tentativa não pode reivindicar."
---

# O que a soberania de dados significa quando você a escreve em um software

:::info[Para quem é isso]
Qualquer pessoa. Não se pressupõe nenhum conhecimento prévio em direito, aprendizado de máquina ou governança indígena.
Se você já se perguntou o que seria realmente necessário para uma comunidade
manter o controle de seus próprios dados linguísticos quando computadores estão envolvidos, esta página
é a resposta longa.
:::

A maior parte das discussões sobre dados e consentimento para na permissão: alguém disse sim.
A soberania de dados faz um conjunto de perguntas mais difíceis. Quem é o **dono** disso? Quem decide
o que acontece com isso? Quem pode acessá-lo? Onde isso fica fisicamente?

Essas quatro perguntas têm um nome e vieram de um lugar específico.

---

## 1. As perguntas — e quem as fez primeiro

As First Nations no Canadá articularam princípios de soberania de dados de
**propriedade, controle, acesso e posse** como uma afirmação de jurisdição
sobre suas próprias informações.

Essa origem não é um mero detalhe. Esses princípios não são uma lista de verificação de ética de uso geral que
qualquer um pode adotar. São afirmações de jurisdição, feitas por povos específicos em contextos
legais e culturais específicos, surgindo de uma história documentada de pesquisas sendo feitas
*sobre* as comunidades em vez de *com* elas, e dos dados resultantes nunca
retornarem.

Os quatro princípios, resumidamente:

| | A pergunta que responde |
|---|---|
| **Ownership** (Propriedade) | Quem é o dono dessas informações? Uma comunidade é dona de seu conhecimento cultural e de seus dados coletivamente — da mesma forma que uma pessoa é dona de suas próprias informações pessoais. |
| **Control** (Controle) | Quem decide o que acontece com elas? As comunidades controlam todas as etapas de qualquer coisa que as afete: o que é coletado, como, por quem, para quê e o que é feito com isso depois. |
| **Access** (Acesso) | Quem pode acessá-las? As comunidades devem ser capazes de acessar informações sobre si mesmas, onde quer que sejam mantidas, independentemente de quem as detenha. |
| **Possession** (Posse) | Onde isso fica fisicamente? Não é o mesmo que propriedade — a posse é o fato concreto da custódia, e é o mecanismo que torna os outros três aplicáveis em vez de apenas prometidos. |

Existem estruturas relacionadas e elas não são intercambiáveis entre
si: **CARE** (Benefício Coletivo, Autoridade para Controlar, Responsabilidade,
Ética) para a governança de dados indígenas de forma ampla, e **Te Mana Raraunga** para
a soberania de dados Māori. Cada uma surgiu em seu próprio contexto legal e cultural. Usar
o nome de uma estrutura para os princípios de outra é, por si só, um tipo de apagamento.

---

## 2. Por que o software torna isso crítico

Um princípio pode sobreviver no papel como uma boa intenção. O software força a
questão, porque um computador não age com base em intenções — ele age com base no que foi
construído.

Considere a maneira comum como um sistema de tradução é avaliado. Para descobrir
se um sistema traduz bem o seu idioma, alguém precisa de um **conjunto de testes**:
frases no seu idioma, emparelhadas com o que elas significam. Quase todas as plataformas de avaliação
pedem que você faça o **upload** desse conjunto de testes para que ele possa ser pontuado.

Leia isso novamente com as quatro perguntas em mãos. Fazer o upload transfere
a posse. Geralmente transfere o controle prático — uma vez que uma cópia existe na
máquina de outra pessoa, sua capacidade de dizer "pare" é um pedido, não uma
capacidade. O acesso se torna algo que lhe é concedido, em vez de algo que você
tem. A propriedade sobrevive no papel e deixa de significar muita coisa.

Para uma comunidade cujos dados linguísticos já foram extraídos antes, "faça o upload e confie
em nós" não é um pedido neutro. Tem a mesma forma daquilo que já
aconteceu.

---

## 3. Quais são realmente os mecanismos

A posição deste projeto é que, se a soberania é real, ela deve ser uma propriedade
do software, não um parágrafo em uma política. Aqui está como isso se parece
concretamente. Eles são descritos para que você possa avaliá-los e questioná-los.

**Registro sem rendição.** Um conjunto de testes é registrado descrevendo
*onde ele reside* e fixando um hash criptográfico de seu conteúdo exato — não fazendo
o upload das frases. No momento da avaliação, o sistema busca na fonte,
verifica se o hash corresponde e atribui a pontuação. Nada é armazenado. Se o detentor colocar a
fonte offline, o corpus simplesmente deixa de ser avaliável. O controle permanece onde
começou, porque a posse nunca mudou de lugar.

**Criptografia antes da partida, para a camada mais forte.** Onde um corpus deve ser
usável sem nunca ser legível, ele é criptografado **no próprio dispositivo
do detentor** antes que qualquer coisa saia. O que este projeto recebe é um texto cifrado e uma
descrição que não contém conteúdo.

**Nenhuma parte única pode descriptografar.** A chave é dividida entre um grupo de custodiantes para
que um certo número deles — digamos, três de cinco — deva agir em conjunto para autorizar
qualquer coisa. Nenhum custodiante individual pode agir sozinho, e nem este projeto:
o modelo decidido é que o **Champollion detém zero partes**, portanto, não pode
descriptografar com ou sem a cooperação de ninguém. Uma execução acontece porque um quórum de
custodiantes decidiu que deveria.

> **Em que ponto isso realmente está.** O mecanismo está construído e testável. Os
> *custodiantes não estão confirmados* — a composição pertence às comunidades
> envolvidas, e nenhum grupo consentiu em deter partes ainda. Até que o façam,
> não há um conjunto de custodiantes ativo, e este projeto não nomeará candidatos
> publicamente. Portanto, leia o parágrafo acima como um mecanismo funcional aguardando as
> relações que o fariam operar, não como algo em execução hoje.

**Resultados sem exposição.** O que retorna de uma avaliação selada são
pontuações, não frases. Pode-se provar que um método funciona em um corpus que o
autor do método, e este projeto, nunca leram.

**Consentimento antes da transmissão.** Enviar texto para uma API de modelo externo é, por si só,
uma divulgação. Corpora sob licenças comunitárias, sob medida ou não declaradas **recusam**
a avaliação remota até que o detentor dos direitos tenha registrado explicitamente a permissão para
isso. Essa recusa é aplicada no código, e nenhum processo automatizado pode conceder a
permissão em nome de uma comunidade.

**Reversibilidade em apenas uma direção.** A exposição pode ser afrouxada por uma
decisão deliberada do detentor. Ela nunca se afrouxa por padrão, por acidente ou
pela conveniência de outra pessoa.

---

## 4. O que isso não é

**Este projeto não é validado, certificado ou aprovado por nenhum marco indígena de soberania de dados. Nenhuma avaliação
ocorreu, nenhuma está pendente e nenhuma está implícita.**

O que existe é uma **tentativa de promulgar a soberania de dados em código** — pegar princípios
articulados por povos indígenas e expressá-los como mecanismos funcionais em vez de
compromissos. Essa tentativa é nossa. Se ela é bem-sucedida, não cabe a nós declarar.
As determinações de conformidade pertencem às comunidades envolvidas, e um projeto que afirmasse sua
própria conformidade estaria reproduzindo em miniatura a exata postura que esses princípios existem
para corrigir: o forasteiro decidindo o que conta como tratamento adequado das
informações de uma comunidade.

Tampouco nada disso é uma garantia de impossibilidade. O software tem defeitos. Os operadores
cometem erros. Uma parte determinada que detenha funções adequadas suficientes é um
risco residual que nenhuma arquitetura remove. A afirmação é mais restrita e, acreditamos,
mais útil: **os caminhos fáceis estão fechados, e os difíceis deixam evidências.**

Também existem lacunas entre os princípios e os mecanismos, e preferimos
nomeá-las a deixar que você as encontre. A posse é o princípio que esses
mecanismos atendem melhor — o código é genuinamente bom em não reter as coisas.
A Propriedade e o Controle vão além do que o software pode ir por conta própria, entrando em termos,
governança e relacionamentos que nenhuma quantidade de criptografia resolve. E cada
mecanismo acima pressupõe uma comunidade que já tem a capacidade e a
infraestrutura para manter seus próprios dados, o que não é uma suposição neutra.

---

## 5. Por favor, questione isso

A tentativa está aberta a críticas, e o convite não é enfeite.

Se você trabalha com governança de dados indígenas, CARE, Te Mana Raraunga ou
tecnologia de idiomas indígenas — ou se você é membro ou representante de uma
comunidade cujo idioma está neste índice — queremos ouvir onde isso está errado.
Especificamente:

- onde um mecanismo não faz o que o princípio exige;
- onde o enquadramento deturpa os princípios de uma comunidade ou toma emprestada sua autoridade;
- onde algo é descrito como protetor, mas não protegeria você;
- onde uma comunidade precisaria de algo que não construímos;
- onde o próprio vocabulário está inadequado.

Objeções e correções podem ser levantadas através da
[rota de contato e remoção](/docs/network/community/contact-objections-takedown),
que também abrange a solicitação de remoção de qualquer coisa sobre um idioma que você
representa. Não há exigência de ser diplomático sobre isso.

Não ter sido revisado é um fato sobre este trabalho, não uma defesa dele. Uma tentativa que
convida à revisão é honesta; uma que não o faz é uma alegação.

> Esta página é a descrição de uma tentativa de construir em direção a princípios cujos autores são as próprias comunidades — procure esses princípios conforme seus autores os declaram; esta tentativa não é endossada por nenhuma das organizações que os administram.

---

## Onde ir a seguir

- [Gestão de Dados](/docs/network/sovereignty/data-sovereignty) — a posição operacional, com mais profundidade.
- [Registrando Corpora](/docs/network/sovereignty/registering-corpora) — as quatro camadas de exposição e o que sai da sua máquina em cada uma.
- [Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest) — a cerimônia do custodiante, de ponta a ponta.
- [Limitações Honestas](/docs/network/honest-limitations) — o que este projeto não reivindica.
- [Para Comunidades Linguísticas](/docs/network/community/for-language-communities) — o ponto de partida prático.
