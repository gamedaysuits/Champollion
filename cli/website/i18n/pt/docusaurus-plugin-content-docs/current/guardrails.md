---
title: "As barreiras de proteção"
slug: /guardrails
description: "Os erros que arruínam silenciosamente projetos de tradução, e o que os trilhos fazem a respeito de cada um — em palavras simples."
---

# As diretrizes de proteção, uma a uma

A maioria dos projetos de tradução não falha de forma barulhenta. Eles falham em silêncio. Palavras compartilhadas
na base da confiança vão parar onde não deveriam. Um tradutor parece maravilhoso —
porque está sendo testado em frases que já memorizou. Uma rodada de sorte
parece progresso.

Cada diretriz de proteção abaixo impede que uma dessas coisas aconteça. As ferramentas aplicam a maioria delas por
conta própria; algumas dependem de você e do seu assistente, e cada uma indica isso com clareza.

Uma palavra que você verá abaixo: uma **pontuação** é um número que mostra o quão próximas as frases de um tradutor
chegam da forma como um falante as disse. Uma pontuação mais alta significa maior proximidade.

## 1. Suas palavras saindo de casa

**O que dá errado.** Palavras compartilhadas na base da confiança vão parar no computador de outra pessoa,
ou dentro da IA de outra pessoa.

**O que as diretrizes fazem.** Cada arquivo recebe uma nota, mantida bem ao lado dele, dizendo o que
as pessoas a quem ele pertence decidiram: se ele pode algum dia sair deste computador e se um
tradutor pode aprender com ele. Toda ferramenta obedece a essa nota.

- Os arquivos começam privados, até que as pessoas a quem pertencem respondam.
- Uma vez que respondem, as ferramentas podem tornar as regras mais rigorosas, nunca mais frouxas. Somente
  uma pessoa pode afrouxá-las, de propósito, manualmente. Se alguém que ainda não havia
  sido consultado disser "sim" mais tarde, esse "sim" é adicionado.
- As palavras de ninguém são usadas para ensinar um tradutor até que a comunidade confirme que esses
  falantes concordaram. Palavras de falantes que ainda não concordaram, ou que disseram
  não, são deixadas de fora.
- Um tradutor que aprendeu com frases privadas também é tratado como privado,
  porque ele pode repetir o que aprendeu.
- Para arquivos mantidos neste computador, as ferramentas mostram contagens ao seu assistente de IA,
  não as frases.

**O que depende de você.** A maioria dos assistentes de IA roda nos computadores de uma empresa e
envia tudo o que lê para essa empresa. Se você pedir a um assistente para abrir seus arquivos, ele
vai abrir — nenhuma ferramenta pode impedir isso. Para palavras que você deseja manter privadas, use um assistente
que rode no seu próprio computador ou não peça a ele para abri-las. Além disso, as ferramentas
não têm como saber quem respondeu a uma pergunta; portanto, as próprias pessoas a quem as palavras pertencem devem
responder por si mesmas. O guia [Suas palavras, suas regras](/docs/your-words-your-rules) traz o panorama completo.

## 2. A prova que é, na verdade, a lição de casa

**O que dá errado.** Você testa um tradutor com frases com as quais ele aprendeu. Ele
se lembra delas e parece brilhante — mas tropeça em qualquer coisa nova. É como
dar nota a um aluno usando exatamente as mesmas questões da lição de casa da noite anterior.

**O que as diretrizes fazem.** Antes de qualquer treinamento, você separa frases de teste que
foram verificadas por um falante fluente. Elas são marcadas para que nenhum tradutor aprenda com
elas, e as ferramentas as omitem do que exibem na tela, a menos que uma pessoa peça para
vê-las.

## 3. Cópias quase idênticas

**O que dá errado.** A frase exata de teste não está entre as frases com as quais o
tradutor aprendeu — mas uma quase igual está. *"Nós vamos ao
mercado"* é testada, e *"Nós vamos ao mercado agora"* foi aprendida. O
tradutor recebe crédito por memória, não por traduzir.

**O que as diretrizes fazem.** Antes do início do treinamento, cada frase com a qual o tradutor
aprenderia é comparada com as frases de teste. Cópias e
quase-cópias são separadas. Frases que apenas compartilham um padrão são mantidas, mas
contabilizadas, para que você possa ver o quanto elas podem fazer a pontuação parecer melhor do
que realmente é.

## 4. Espiar as respostas

**O que dá errado.** Se você avaliar seu tradutor com as frases de teste após
cada pequena mudança, você aos poucos o ajusta a essas frases. O teste deixa de
ensinar qualquer coisa nova.

**O que as diretrizes fazem.** O progresso do dia a dia é avaliado em um conjunto separado de
**frases de treino**, reservado a partir dos seus dados. Cada vez que as ferramentas de
treinamento pontuam as frases de teste, isso é registrado por escrito, e elas não mostram uma pontuação de
teste até que uma previsão tenha sido registrada.

## 5. Decidir o que você esperava só depois de ver o resultado

**O que dá errado.** Quando um resultado aparece na tela, é fácil dizer *"era
mais ou menos o que a gente imaginava."* Assim, o resultado não surpreende você e não
ensina nada.

**O que as diretrizes fazem.** Antes de o primeiro tradutor ser treinado, as pessoas
que o estão construindo escrevem o que esperam, em suas próprias palavras. As diretrizes não
avançam enquanto isso não for escrito e, mais tarde, o resultado é comparado com essa previsão.

## 6. Confundir sorte com progresso

**O que dá errado.** Dois tradutores podem ter pontuações ligeiramente diferentes apenas por
acaso, especialmente em um número pequeno de frases. Uma rodada de sorte parece
progresso, e um ganho real pode se perder no ruído.

**O que os trilhos fazem.** Um novo tradutor é comparado com o que você
está usando, frase por frase, nas mesmas frases de treino. Ele só é oferecido
a você se obtiver uma pontuação superior ao que a sorte normalmente explicaria — e,
mesmo assim, só assume quando você disser sim. Caso contrário,
as ferramentas dizem *"nenhuma mudança mensurável"* — e indicam quão pequeno um ganho precisa ser para não ser percebido com essa quantidade de frases de treino. Com menos de 50 frases de treino,
pontuação nenhuma é capaz de dizer, por isso as ferramentas não tomam decisão alguma: em vez disso,
são as avaliações do falante, feitas em rascunhos de ambos sem saber qual é qual, que decidem.

## 7. É melhor do que um dicionário?

**O que dá errado.** Uma pontuação isolada quer dizer muito pouco. Um tradutor pode
não se sair melhor do que simplesmente procurar cada palavra em uma lista de vocabulário.

**O que as diretrizes fazem.** Se você tiver uma lista de palavras, as ferramentas primeiro medem até
onde procurar cada palavra leva você. Vale a pena usar um tradutor apenas onde ele
superar isso.

## 8. Dois tradutores escondidos em uma única pontuação

**O que dá errado.** Quando um tradutor não dá conta de uma frase, um segundo
tradutor de reserva pode entrar em ação. Não há problema nisso quando você está usando o sistema. Mas se uma pontuação de teste mistura os dois,
você não tem como saber qual deles realmente mediu.

**O que as diretrizes fazem.** A pontuação de um teste sempre vem de um único tradutor. O uso de um tradutor reserva
é permitido quando você usa o sistema, nunca quando você o avalia.

## 9. Dizer mais do que é verdade

**O que dá errado.** Um assistente entusiasmado anuncia *"seu tradutor está
pronto!"* quando ele mal começou a ser treinado.

**O que as diretrizes fazem.** As ferramentas mantêm um registro do que realmente aconteceu. Seu
assistente é instruído a relatar apenas isso e a repassar cada aviso palavra por
palavra. Este ponto depende de o assistente seguir as instruções dele.

---

Nada disso garante que um tradutor seja bom. Mas garante que você sempre saiba em que ponto ele
está — e que as pessoas donas da língua continuem no comando.

**A seguir:** [O que ele ainda não faz →](/docs/what-it-cant-do-yet)

## Aprofunde-se

- [O contrato de operação para agentes de IA](/docs/agents/contract) — cada regra,
  e se as ferramentas a aplicam diretamente ou se apenas o assistente pode cumpri-la.
- [Todos os comandos, passo a passo](/docs/agents/shell) — onde cada
  verificação roda, com os comandos exatos.
- O que "mais do que a sorte" significa aqui: o chrF++ do novo tradutor no
  conjunto de treino (dev) deve ser mais alto em um teste pareado e seu intervalo deve
  ficar acima de zero. O conjunto de treino também selecionou o melhor ponto de verificação
  do novo tradutor, o que favorece ligeiramente o novo.
- [Gestão responsável dos dados](/docs/your-words-your-rules) — como os dados
  são usados sem serem entregues a terceiros.
