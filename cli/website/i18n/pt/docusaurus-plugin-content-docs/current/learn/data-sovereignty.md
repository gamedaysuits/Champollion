---
title: "O que a soberania de dados significa quando você a implementa em um software"
sidebar_label: "Soberania de dados"
description: "A soberania de dados indígenas diz respeito à propriedade e ao controle comunitário dos dados. É assim que esses princípios se parecem quando alguém tenta incorporá-los a um software funcional — e o que essa tentativa não pode reivindicar."
---

# O que a soberania de dados significa quando você a escreve em um software

:::info[Para quem é isso]
Qualquer pessoa. Não se pressupõe nenhum conhecimento prévio em direito, aprendizado de máquina ou governança indígena.
Se você já se perguntou o que seria realmente necessário para uma comunidade
manter o controle de seus próprios dados linguísticos quando computadores estão envolvidos, esta página
é a resposta longa.
:::

A maior parte das discussões sobre dados e consentimento para na permissão: alguém disse sim.
A soberania de dados faz uma pergunta mais difícil: quem é o **dono** disso e quem **decide**
o que acontece com isso — não apenas uma vez, mas por todo o tempo em que existir?

Essa pergunta não surgiu do nada. Elas foram formuladas primeiro e
com mais força pelos povos indígenas.

---

## 1. As perguntas — e quem as fez primeiro

As Primeiras Nações no Canadá articularam princípios de soberania de dados — propriedade
e controle da comunidade sobre suas próprias informações — como uma afirmação de
jurisdição, decorrente de um histórico documentado de pesquisas feitas *sobre* as
comunidades em vez de *com* elas, e dos dados resultantes nunca retornarem.

Essa origem não é mera curiosidade. Estes não são uma lista de verificação ética de uso geral
que qualquer pessoa possa simplesmente adotar; são afirmações de jurisdição, feitas por povos
específicos em contextos jurídicos e culturais específicos, e pertencem às
comunidades que os criaram. Esta página não reformula os princípios de nenhuma
estrutura em nome de seus autores: leia-os conforme seus autores os declaram.

Em termos simples, uma comunidade é dona de seu conhecimento cultural e de seus dados coletivamente,
da mesma forma que uma pessoa é dona de suas próprias informações pessoais, e decide cada etapa
de tudo o que os envolve: o que é coletado, como, por quem, para quê e o que é
feito com isso depois.

Existem frameworks distintos que não são intercambiáveis entre si:
**CARE** (Benefício Coletivo, Autoridade para Controlar, Responsabilidade, Ética)
para a governança de dados indígenas em geral, e **Te Mana Raraunga** para a soberania
de dados Māori, entre outros. Cada um surgiu em seu próprio contexto jurídico e cultural.
Usar o nome de um framework para os princípios de outro é, por si só, uma forma
de apagamento.

---

## 2. Por que o software torna isso crítico

Um princípio pode sobreviver no papel como uma boa intenção. O software força a
questão, porque um computador não age com base em intenções — ele age com base no que foi
construído.

Considere a maneira comum como um sistema de tradução é avaliado. Para descobrir
se um sistema traduz bem o seu idioma, alguém precisa de um **conjunto de testes**:
frases no seu idioma, emparelhadas com o que elas significam. Quase todas as plataformas de avaliação
pedem que você faça o **upload** desse conjunto de testes para que ele possa ser pontuado.

Leia isso novamente tendo propriedade e controle em mente. Fazer upload entrega
a custódia: uma cópia agora existe na máquina de outra pessoa. Geralmente, também entrega o
controle prático — sua capacidade de dizer "pare" se torna um pedido, não um
poder de fato. A propriedade sobrevive no papel e deixa de significar muita coisa.

Para uma comunidade cujos dados linguísticos já foram extraídos antes, "faça o upload e confie
em nós" não é um pedido neutro. Tem a mesma forma daquilo que já
aconteceu.

---

## 3. Quais são realmente os mecanismos

A posição deste projeto é que, se a soberania é real, ela deve ser uma propriedade
do software, não um parágrafo em uma política. Aqui está como isso se parece
concretamente. Eles são descritos para que você possa avaliá-los e questioná-los.

**Registro sem rendição.** Um conjunto de testes é registrado descrevendo
*onde ele fica* e fixando um hash criptográfico do seu conteúdo exato — não fazendo
upload das frases. No momento da avaliação, o sistema busca os dados na fonte,
verifica se o hash coincide e faz a pontuação. Nada é armazenado. Se o detentor tirar a
fonte do ar, o corpus simplesmente deixa de poder ser avaliado. O controle permanece onde
começou, porque os dados nunca saíram do lugar.

**Criptografia antes do envio, para o nível mais rigoroso.** Onde um corpus precisa ser
utilizável sem nunca ser legível, ele é criptografado **no próprio dispositivo do
detentor**, e o texto cifrado permanece com o detentor. O que este projeto recebe
é uma descrição que não contém nenhum conteúdo.

**Nenhuma parte pode descriptografar sozinha.** A chave é projetada para ser dividida entre um grupo
de custodiantes, de modo que um determinado número deles — digamos, três de cinco — precise agir
em conjunto para autorizar qualquer coisa. Nenhum custodiante individual pode agir sozinho, e
este projeto também não: **o Champollion não detém frações da chave**, portanto não conseguiria
descriptografar com ou sem a cooperação de ninguém. Uma execução aconteceria porque um
quórum de custodiantes decidiu que ela deveria acontecer.

> **Em que ponto isso realmente está.** Hoje, as chaves de um conjunto lacrado ficam com o organizador:
> quem o lacrou é quem as detém. O mecanismo de custodiantes está construído e pode ser testado,
> mas ainda não foi executado com custodiantes reais. Custodiantes de chaves da comunidade —
> nenhum foi nomeado ainda: a composição cabe às comunidades envolvidas, e nenhum
> grupo consentiu em guardar frações. Até que algum consinta, não há um conjunto ativo
> de custodiantes, e este projeto não indicará candidatos publicamente. Portanto, leia o
> parágrafo acima como um mecanismo funcional à espera das relações que o
> fariam operar, não como algo em execução hoje.

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

**Este projeto não é validado, certificado ou aprovado em relação a qualquer framework
de soberania de dados indígenas. Nenhuma avaliação foi realizada, nenhuma está pendente
e nenhuma está implícita.**

O que existe é uma **tentativa de aplicar a soberania de dados em código** — de pegar
princípios articulados por povos indígenas e expressá-los como mecanismos
funcionais em vez de meros compromissos. Essa tentativa é nossa. Declarar se ela é bem-sucedida
não cabe a nós. Determinações de conformidade pertencem às comunidades
envolvidas, e um projeto que afirme sua própria conformidade estaria reproduzindo em
miniatura a postura exata que esses princípios existem para corrigir: o agente externo
decidindo o que conta como tratamento adequado das informações de uma comunidade.

Tampouco nada disso é uma garantia de impossibilidade. O software tem defeitos. Os operadores
cometem erros. Uma parte determinada que detenha funções adequadas suficientes é um
risco residual que nenhuma arquitetura remove. A afirmação é mais restrita e, acreditamos,
mais útil: **os caminhos fáceis estão fechados, e os difíceis deixam evidências.**

Também existem lacunas entre os princípios e os mecanismos, e preferimos
apontá-las a deixar que você as encontre. A custódia é o que esses mecanismos atendem
melhor — o código é genuinamente bom em não reter coisas. Propriedade e controle
vão além de onde o software consegue chegar sozinho, entrando em termos, governança e
relacionamentos que nenhuma quantidade de criptografia resolve. E cada
mecanismo acima presume uma comunidade que já tem a capacidade e a
infraestrutura para manter seus próprios dados, o que não é uma suposição neutra.

---

## 5. Por favor, questione isso

A tentativa está aberta a críticas, e o convite não é enfeite.

Se você trabalha com governança de dados indígenas, CARE, Te Mana Raraunga ou
tecnologia de línguas indígenas — ou se você for membro ou representante de uma
comunidade cuja língua está neste índice —, queremos saber onde erramos.
Especificamente:

- onde um mecanismo não faz o que o princípio exige;
- onde a abordagem distorce os princípios de uma comunidade ou se apropria de sua autoridade;
- onde algo é descrito como protetivo, mas não protegeria você;
- onde uma comunidade precisaria de algo que não construímos;
- onde o próprio vocabulário for inadequado.

Objeções e correções podem ser apresentadas pelo
[canal de contato e remoção](/docs/your-words-your-rules),
que também cobre a solicitação de remoção de qualquer conteúdo sobre um idioma que você
represente. Não há nenhuma exigência de ser diplomático quanto a isso.

Não ter sido revisado é um fato sobre este trabalho, não uma defesa dele. Uma tentativa que
convida à revisão é honesta; uma que não o faz é uma alegação.

> Esta página é a descrição de uma tentativa de avançar rumo a princípios cujos autores são as próprias comunidades — consulte esses princípios conforme declarados por seus autores; esta tentativa não é endossada por nenhuma das organizações que zelam por eles.

---

## Para onde ir a seguir

- [Suas palavras, suas regras](/docs/your-words-your-rules) — o posicionamento operacional, em maior profundidade.
- [Registrando corpora](/docs/network/sovereignty/registering-corpora) — os quatro níveis de exposição e o que sai da sua máquina em cada um.
- [Realizar uma competição soberana](/docs/network/sovereignty/run-a-sovereign-contest) — a cerimônia de custodiantes, de ponta a ponta.
- [Limitações sinceras](/docs/network/honest-limitations) — o que este projeto não reivindica.
- [Suas palavras, suas regras](/docs/your-words-your-rules) — o ponto de partida prático.
