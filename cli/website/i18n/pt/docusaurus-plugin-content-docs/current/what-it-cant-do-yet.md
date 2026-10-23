---
title: "O que ele ainda não consegue fazer"
slug: /what-it-cant-do-yet
description: "A parte honesta, em palavras simples: seu primeiro tradutor será pequeno, um que funcione exige muitas frases, e nenhuma ferramenta pode prometer qualidade — apenas que você saberá em que ponto está."
---

# O que ainda não é possível fazer

Seu primeiro tradutor provavelmente será um **livro de frases**. Ele será bom com
frases parecidas com aquelas com as quais aprendeu, e instável com qualquer coisa nova. Isso é
normal: todo projeto começa assim.

O que o faz avançar são mais frases — dos tipos certos, revisadas por alguém
que fale o idioma. A cada rodada, as ferramentas mostram se ele realmente ficou
melhor e sugerem o que mais ajudaria a seguir. Esta página explica, com clareza,
o que esperar ao longo do caminho.

## Um tradutor funcional exige muitas frases

Quantas? Ainda não sabemos para nenhum idioma real. Isto é o que sabemos.

Criamos um idioma de teste, para que um computador pudesse verificar cada resposta:
cerca de 2.000 palavras, gramática perfeitamente regular, dados limpos. Um tradutor treinado
em um notebook traduziu então novas frases do dia a dia que nunca tinha visto, e um
computador verificou se cada uma significava exatamente o que o inglês significava:

- após 6.400 frases de exemplo, **cerca de 79 em 100** estavam exatamente corretas;
- após 25.600, **cerca de 96 em 100**.

Toda frase com uma palavra que ele nunca tinha visto saía errada — cerca de um terço de
seus erros com 6.400 exemplos; o restante era gramática que ele ainda não havia aprendido.
Essa é a primeira coisa que você precisa saber: **um tradutor não pode traduzir uma palavra que
nunca aprendeu.** Por isso, as ferramentas apontam isso: quando uma frase tem uma palavra que
seu tradutor nunca viu nas lições, elas dizem qual palavra — essa linha tem grande probabilidade
de estar errada, por mais fluida que pareça a leitura.

Um idioma real é muito mais rico do que o nosso idioma de teste: muito mais palavras
do dia a dia, palavras com vários significados, gramática que marca coisas que o inglês deixa
subentendidas. Portanto, esses números são um piso, não uma estimativa. Um idioma real
precisará de mais frases, e ainda não sabemos quantas a mais. Estamos medindo isso
agora.

O que isso significa em tempo: ainda não medimos o tempo de um falante real. Se
escrever ou revisar uma frase levasse cerca de um minuto, 6.400 frases levariam
cerca de cem horas. Dividido entre uma família e uma turma, uma ou duas horas por
semana para cada pessoa vai somando — e um tradutor pequeno já ajuda com as frases mais usadas
muito antes disso. [De quantas frases você precisa?](/docs/how-many-sentences)
explica isso em detalhes.

## Não é possível prometer um tradutor bom — apenas que você saberá

Uma pontuação mede o quão perto o tradutor chega do modo como um falante disse uma
frase. Uma boa tradução formulada de maneira diferente pode ter uma pontuação baixa, e uma tradução
fluida, mas errada, pode ter uma pontuação razoavelmente alta. É por isso que um falante revisando
os rascunhos é mais importante do que qualquer número.

Uma pontuação também reflete apenas frases semelhantes àquelas em que foi medida e,
com apenas algumas frases, ela é imprecisa — as ferramentas mostram uma faixa, não um
número único. Ela não pode dizer se a *próxima* frase que o tradutor
escrever estará certa. Um falante fluente decide o que está adequado para uso.

## Ninguém levou um idioma real até o fim ainda

Percorremos cada etapa do fluxo muitas vezes, com idiomas inventados e
com muitos assistentes de IA diferentes, desde uma pasta vazia até um tradutor que
você pode testar no navegador. Em nossos testes práticos mais recentes — assistentes de IA ajudando
uma família fictícia —, mais da metade falhou em alguma etapa. Corrigimos essas
etapas e estamos testando novamente.

Nenhuma comunidade levou ainda um idioma real até o fim para obter um
tradutor funcional no fluxo. Se você começar agora, estará entre os primeiros.

## Algumas partes não estão prontas

- **As ferramentas passo a passo virão com a próxima versão.** Até lá, estas
  páginas descrevem como elas funcionarão. [Antes de começar](/docs/before-you-begin)
  é o que você pode fazer hoje.
- **Permitir que outros testem tradutores nas suas frases** — sem nunca vê-las
  — funciona, mas ainda não está integrado ao fluxo. Hoje isso exige seguir um
  manual mais longo.
- **Seu computador faz diferença.** Um Mac mais novo (M1 ou posterior) com 16 GB de memória,
  ou um computador cuja placa de vídeo NVIDIA tenha 16 GB de memória própria, pode criar o
  tipo mais forte de tradutor; com 8 GB, uma versão mais leve dele, que
  ainda não foi testada em um computador de 8 GB. No Windows, as ferramentas de treinamento
  precisam do WSL (o Linux integrado do Windows). Outros computadores criam um tipo
  muito menor, que ficou bem atrás em nossos testes.
- **As rodadas consom tempo do computador.** A maioria das rodadas continua a partir do
  tradutor que você está usando em vez de recomeçar do zero, mas com o tradutor
  mais forte uma rodada ainda pode levar horas, e apenas um tradutor aprende por
  vez em um computador.
- **Mantenha as frases curtas.** O tradutor mais forte lê apenas uma quantidade limitada de uma
  frase — menos ainda se o seu idioma usar um alfabeto próprio. As ferramentas contam
  qualquer frase que ficou longa demais e avisam você, para que possa dividi-la.
- **A ortografia não é verificada para você.** Se as pessoas escrevem o idioma de
  maneiras diferentes, combinem uma forma única para o projeto antes de começar.

## Não é possível impedir todo vazamento

Para arquivos mantidos neste computador — o padrão —, as ferramentas mostram ao seu
assistente de IA contagens, não frases. Mas um assistente que pode usar seu computador
pode abrir qualquer arquivo que você puder, com ou sem autorização, e a maioria envia o que lê para a
empresa que o opera.
[Suas palavras, suas regras](/docs/your-words-your-rules) explica o que fazer.

## Um tradutor não é um idioma vivo

Um tradutor pode ajudar um programa de idiomas, uma escola ou uma família. O
idioma vive em seus falantes e no uso cotidiano.
[Tradução não é revitalização](/docs/network/perspectives/translation-is-not-revitalization)
traz mais detalhes.

---

Esses limites mudarão conforme o trabalho avança. Quando um deles mudar, esta página mudará
junto.

**A seguir:** [Antes de começar →](/docs/before-you-begin)

## Aprofunde-se

- [Os guardrails, um a um](/docs/guardrails) — como funciona cada verificação.
- [Os limites técnicos](/docs/network/honest-limitations) — o que as
  medições cobrem ou não, níveis de confiança em pontuações publicadas, custódia
  de testes lacrados e por que não é fornecida confiança por frase.
- Sobre os números do idioma de teste: uma execução por tamanho, portanto a variação
  entre execuções não é medida. "Exatamente correta" é uma verificação automática de cada
  parte do significado — verbo, tempo, pessoa, negação, sujeito, objeto e
  mais — em relação à gramática do próprio idioma inventado, não a avaliação de uma
  pessoa. O tradutor era um modelo pré-treinado em nível de bytes ajustado em um
  notebook Apple Silicon. O tempo de treinamento altera bastante o resultado (o mesmo
  modelo e 6.400 frases pontuaram cerca de 27 em 100 com um quarto do
  treinamento), portanto esses não são limites fixos. Com 6.400 frases, cerca de 9 em 100
  traduções eram fluidas, usavam palavras reais e significavam outra coisa. O
  modelo menor que as ferramentas usam em outros computadores acertou cerca de 6 em 100 com
  6.400 frases.
- O tradutor mais forte lê no máximo 320 bytes de uma frase — cerca de 100
  letras de escrita silábica, já que letras com acento e letras de outros alfabetos
  ocupam de dois a quatro bytes cada. O treinamento conta os pares que ultrapassam o limite antes de
  cortá-los, e a tradução servida informa o que foi cortado.
