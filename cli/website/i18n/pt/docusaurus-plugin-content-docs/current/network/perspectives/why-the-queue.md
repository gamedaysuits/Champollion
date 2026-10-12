---
sidebar_position: 5
title: "Por Que a Fila Foi Construída Assim"
slug: '/network/perspectives/why-the-queue'
description: "A filosofia por trás da fila de computação comunitária: tokens doados são um orçamento, a malha é a missão, e uma lista de prioridades é um conjunto de crenças que deve ser documentado, criticado e refutável."
related:
  - label: "Queue Construction Specification"
    to: /docs/network/specifications/queue-construction
    kind: spec
    note: "The formula this philosophy commits us to"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Por que a Fila É Construída Dessa Forma

A fila é o artefato editorial mais consequente que publicamos.
Cada item nela diz: *se você está disposto a gastar alguns centavos de
crédito de API em tradução automática para idiomas com poucos recursos, este é o melhor lugar
que conhecemos para gastá-los.* Essa frase carrega obrigações. Esta página é
sobre quais são elas e como a
[fórmula de construção da fila](/docs/network/specifications/queue-construction)
as cumpre.

## Uma lista de prioridades é um conjunto de crenças

Qualquer ordenação de trabalho codifica respostas a três perguntas, quer
alguém as tenha escrito ou não:

1. **O que valorizamos?** O que uma execução concluída realmente *vale*?
2. **O que acreditamos?** O que esperamos que aconteça quando uma execução que
   ainda não tentamos for executada?
3. **O que admitimos não saber?** Onde a curiosidade deveria
   sobrepor a previsão?

A maioria das filas de benchmark respondem isso implicitamente — "maior lacuna primeiro,"
"modelo mais novo primeiro," a planilha de alguém. Achamos que um projeto pedindo
a estranhos para gastar dinheiro merece respostas explícitas, em uma fórmula
que qualquer um possa recomputar, com cada entrada publicada. Não porque fórmulas
sejam neutras — não são, a nossa codifica nossa missão e nossas intuições — 
mas porque **um viés escrito pode ser questionado, e um não escrito não pode.**

## O que valorizamos: cadeias, não checkmarks

Nossa missão é *cada idioma em cada idioma por cadeias de pares medidas
individualmente*. A infraestrutura de tradução do mundo é
centrada em inglês; a nossa começou assim também — uma estrela de
benchmarks eng→X. Mas uma estrela só mede uma coisa: distância do
inglês. Os idiomas do mundo merecem uma *malha*: quando nenhum benchmark
direto existe entre dois idiomas, uma cadeia de pares medidos
deveria — e sua qualidade deveria ser algo que possamos estimar a partir
de medições em vez de afirmar.

Então o valor de uma execução concluída não é "uma linha a mais no leaderboard." É
**quanto mais forte a malha inteira fica**: o ganho em nosso
objetivo de capacidade de cadeia ponderada por qualidade Φ, que pergunta, para cada
par ordenado de idiomas na Terra que rastreamos, *qual é a melhor cadeia entre eles agora?* Uma execução que conecta um idioma isolado
vale centenas de execuções que polem um canto já brilhante — e a
fórmula diz exatamente quantas centenas, em vez de deixar para vibes. Este é o mesmo instinto que levou M2M-100 a
minerar "idiomas ponte" entre famílias em vez de mais
dados pareados com inglês (Fan et al. 2021) — feito contínuo, e apontado
para avaliação em vez de treinamento.

Duas consequências que aceitamos propositalmente:

- **Uma execução pequena e barata em um par não medido geralmente vence uma execução cara
  em um medido.** Computação contribuída é um orçamento; classificamos por
  ganho de malha *por dólar* (a regra gulosa clássica para cobrir
  o máximo sob um orçamento — Khuller, Moss & Naor 1999). Iluminar a
  centésima aresta faz mais pela missão do que polir a
  primeira.
- **Cadeias estimadas valem menos que arestas medidas.** Nosso modelo de cadeia
  multiplica qualidades de arestas e cobra um desconto de fidelidade por
  junção de pivô, porque quarenta anos de resultados de tradução por pivô
  dizem que rotear através de um idioma intermediário perde mais do que a
  composição ingênua sugere (Utiyama & Isahara 2007; Wu & Wang 2007). O
  desconto é o incentivo permanente da fórmula para *medir o
  par direto* em vez de descansar em uma cadeia plausível.

## O que acreditamos: previsões simples o suficiente para auditar

Para valorizar um experimento não executado você deve prever seu resultado. Há um
espectro aqui, de "não assuma nada" a "treine um modelo para adivinhar." Nós
deliberadamente paramos cedo nesse espectro: nossa previsão é uma soma que um
contribuidor pode verificar em um guardanapo — *como esse par de idiomas
geralmente pontua, como esse modelo geralmente se desvia, existe evidência de coaching para esse idioma exato* — e nada mais. Sem pesos aprendidos, sem embeddings, sem
modelo cujos próprios vieses precisariam ser auditados.

Isso nos custa precisão. Um preditor com gradient boosting sobre
características de idioma adivinharia melhor. Trocamos essa precisão por uma propriedade que
valorizamos mais: **cada classificação na fila é re-derivável à mão a partir de
números impressos no próprio item.** Quando alguém pergunta "por que essa
execução Faroese é #1?", a resposta é quatro números publicados e uma
sentença, não "o modelo disse assim." Pesquisa em aprendizado ativo há muito
equilibra sofisticação de seleção contra confiança e inspecionabilidade
(Haffari, Roy & Sarkar 2009 trouxeram exatamente esse trade-off para tradução
automática); um benchmark financiado por voluntários pertence à
extremidade inspecionável.

## O que não sabemos: curiosidade com orçamento

Uma fila dirigida puramente por previsões tem um modo de falha: ela
confiantemente priva tudo sobre o que prevê mal, e nunca
descobre que estava errada. A resposta clássica da literatura de bandidos
é *otimismo diante da incerteza*: dê a cada opção não tentada um
bônus que encolhe conforme a evidência se acumula (Auer, Cesa-Bianchi &
Fischer 2002). Nossa fila carrega exatamente esse bônus — escalado, não
coincidentemente, para o piso de ruído de nossos instrumentos: otimismo nunca
excede os ~5 pontos chrF++ que pequenos corpora de dev não conseguem distinguir
de qualquer forma ([Corpus Design §6.3](/docs/network/specifications/corpus-design)).

A mesma humildade aparece em duas assimetrias que valem a pena nomear:

- **Tudo publicado é evidência; apenas corpora abertos são ações.**
  Resultados em corpora com licença restrita informam o conhecimento da malha,
  mas a fila só pede aos contribuidores para executar o que qualquer um pode
  executar livremente.
- **Evidência de coaching não viaja.** Onde execuções coached vencem ingênuas,
  isso é fato medido para esse idioma — e silêncio sobre
  todos os outros. A fila mantém ordenação baseline-first onde coaching é
  não medido, em vez de assumir que os ganhos de um idioma generalizam.

## O que nos recusamos a fazer

- **Sem otimização de engajamento.** Itens nunca são ordenados para maximizar
  cliques, sequências ou satisfação de conclusão. O objetivo da malha é
  o único objetivo.
- **Sem polegar editorial escondido.** Se alguma vez precisarmos impulsionar um par (uma
  parceria comunitária, um prazo), aparecerá como um termo nomeado,
  versionado na especificação — não como uma re-classificação silenciosa.
- **Sem bloqueio de reivindicação.** Qualquer um pode executar qualquer item a qualquer momento; execuções idênticas
  se deduplicam por impressão digital e replicações independentes são
  bem-vindas como evidência. Uma posição na fila é conselho, não permissão.
- **Sem teatro de capacidade.** Φ e cada pontuação que o alimenta são
  números de conjunto de desenvolvimento com ressalvas conhecidas (limites superiores de contaminação,
  diferenças de escala entre idiomas). Eles direcionam gastos; nunca são
  citados como o que um modelo "pode fazer."

## Construído para estar errado em público

A fórmula é versionada (`ecv-v2`), seus parâmetros são ecoados em
cada fila publicada, e sua suposição de modelagem central — que
qualidade de cadeia se compõe multiplicativamente com um desconto por junção —
agora é *testável com nossos próprios dados*: a malha contém
triângulos medidos (deu→fra direto ao lado de deu→eng e eng→fra), então podemos
pontuar traduções encadeadas reais contra as previsões do modelo e
ajustar o desconto empiricamente em vez de escolhê-lo. Quando isso
acontecer, v3 dirá, e esta página explicará o que mudou e por quê. Esse é o
padrão que queremos ser mantidos: não uma fila que está sempre certa, mas uma
cujo raciocínio está sempre no registro.

*A matemática, padrões, exemplo trabalhado e citações completas vivem na
[Especificação de Construção da Fila](/docs/network/specifications/queue-construction).*
