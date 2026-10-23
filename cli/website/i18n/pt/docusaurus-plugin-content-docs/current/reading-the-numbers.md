---
title: "Entendendo os números"
slug: /reading-the-numbers
description: "O que significa cada número que os rails mostram, em palavras simples: a pontuação de 0 a 100, a proporção de rascunhos que a pessoa falante marcou como certos, intervalos e “nenhuma mudança mensurável”."
---

# Lendo os números

Os trilhos mostram números a cada etapa. Cada um só é útil se você souber
três coisas sobre ele: **o que ele mede**, **de qual total** e **em quais
frases**. As ferramentas informam as três coisas, e o seu assistente também é instruído a fazer isso. Esta página
explica cada tipo.

## A proporção de rascunhos que o falante marcou como certos

**O número que mais importa.** A cada rodada, um falante marca os rascunhos
do tradutor como certos ou errados. *"31 de 40 rascunhos marcados como certos"* significa exatamente
o que diz: das 40 frases que a sua família queria traduzir nesta rodada, o
falante considerou 31 certas.

Nada do que um computador mede supera a avaliação de um falante. Mas isso depende das
frases: uma semana fácil e uma semana difícil podem dar números diferentes com o
mesmo tradutor. É por isso que as ferramentas também medem da mesma forma a cada vez, nas
mesmas frases — a pontuação.

## A pontuação, de 0 a 100

Uma **pontuação** é um número de 0 a 100 que indica o quão perto as frases do tradutor
chegam da maneira como um falante escreveu as mesmas frases. Ela conta letras e
palavras correspondentes e dá crédito parcial: uma tradução quase
certa pontua mais alto do que uma que está totalmente errada. 100 significa idêntica.

Duas coisas para saber:

- **Ela mede proximidade, não correção.** Uma boa tradução redigida
  de forma diferente da do falante pode receber uma pontuação baixa. Uma tradução fluente que
  significa outra coisa pode pontuar relativamente alto. É por isso que a checagem de um falante
  importa mais.
- **Não é uma porcentagem de frases certas.** Uma pontuação de 60 não significa
  que 60 em cada 100 frases estavam certas.

Para os curiosos: essa pontuação se chama **chrF++**, e é a maneira comum na área
de comparar tradutores. As ferramentas também informam outras ao lado dela.

## Intervalos

A maioria dos números vem com um **intervalo**, como *14–22*. Isso não são dois resultados. É
o nível de certeza das ferramentas: o valor real muito provavelmente está em algum ponto ali dentro. Com
poucas frases, o intervalo é amplo. Com muitas, ele se estreita.

Quando dois intervalos se sobrepõem muito, os dois tradutores podem, na verdade, ser equivalentes.

## Quais frases

Um número sempre indica em quais frases ele foi medido:

- **Frases de teste** — aquelas que um falante checou e com as quais o tradutor nunca
  aprendeu. Usadas para os resultados que importam, e apenas de vez em quando.
- **Frases de prática** — separadas dos seus dados, e com as quais o tradutor também nunca
  aprendeu. Usadas para avaliar cada rodada, para que as frases de teste continuem inéditas.
- **Frases da sua rodada** — aquelas que a sua família queria traduzir; as
  marcações do falante são feitas nelas.

Um número medido em frases com as quais o tradutor aprendeu não significaria nada,
por isso os trilhos nunca mostram um número desses como resultado.

## "Nenhuma mudança mensurável"

Isso não significa que nada mudou. Significa que qualquer mudança foi pequena demais para ser
distinguida do acaso, com a quantidade de frases de prática que você tem. As ferramentas dizem
o tamanho da mudança que elas *poderiam* ter detectado. Mais frases de prática permitem que elas vejam
mudanças menores — e é por isso que, enquanto o conjunto de prática for pequeno, algumas linhas da
planilha de cada rodada são deixadas para o falante escrever.

## "Poucas frases de prática para saber"

Com menos de 50 frases de prática, nenhuma pontuação consegue dizer com segurança qual de dois
tradutores é melhor. No nosso idioma de prática, com 23 frases de prática,
a regra cuidadosa considerou dois tradutores quase iguais como diferentes 9 vezes em
100 — e percebeu um ganho real de cerca de 6 pontos em 100 apenas 21 vezes em
100. Com 50, esses números foram 4 e 96. Por isso, abaixo de 50, as ferramentas não se pronunciam. O que você está usando continua, e as marcações do falante na
próxima folha decidem.

## O piso do dicionário

Se você trouxe uma lista de palavras, verá uma pontuação para *apenas consultar cada palavra*.
É o piso: um tradutor só vale a pena ser usado onde ele pontuar acima
disso. Com pouquíssimas frases, um primeiro tradutor pode ficar abaixo disso. Vale a pena
saber disso; não vale a pena esconder.

## Um número que você verá em nossas páginas: "significado correto"

Quando falamos sobre a nossa língua fictícia de prática, você verá *"79 em cada 100
exatamente certas"*. Esse número é uma proporção de frases: um computador checou cada
parte do significado de cada tradução em relação à própria gramática da língua fictícia.
Isso só é possível em uma língua que inventamos, onde a resposta certa é conhecida
com exatidão. Em uma língua real, o mais próximo disso são as marcações de um falante.

**A seguir:** [Melhore, rodada a rodada →](/docs/make-it-better)

## Aprofunde-se

- [Regras de medição](/docs/agents/measurement) — as regras exatas: chrF++
  com seu intervalo de 95%, a comparação pareada, portões e taxas de recusa.
- [Especificação de pontuação](/docs/network/specifications/scoring) — como cada
  pontuação publicada é calculada.
- [Significância](/docs/network/specifications/significance) — como se decide o que é "melhor para além do acaso".
