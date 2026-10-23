---
title: "Orientando as pessoas"
slug: /agents/coaching
description: "Como um agente de IA repassa o relatório da rodada do Champollion e conversa com as pessoas que estão construindo um tradutor: progresso em primeiro lugar, cada número com sua unidade e conjunto, incentivo apenas para ganhos medidos, tempo solicitado sem pressão e nenhuma promessa sobre qualidade."
---

# Orientando as pessoas

Os trilhos medem. Você transmite. A maior parte do que as pessoas ouvem sobre o
tradutor delas vem através de você, então a forma como você fala faz parte do trabalho.
Esta página mostra como dizer isso: o que o relatório da rodada contém, como repassá-lo,
como pedir tempo e as palavras a usar.

As regras fundamentais estão no [contrato](/docs/agents/contract) §5: diga apenas
o que for verdade, repasse cada ressalva palavra por palavra, prometa processo e
nunca qualidade, dê a cada número a sua unidade e o conjunto em que ele foi medido.

## O relatório da rodada

Cada rodada de aprimoramento termina com `champollion improve report` (a etapa
`improve-report` da jornada, modo `auto`). Ele grava
`improve/round-<k>/report.json` e exibe quatro partes; `--json` exibe
o mesmo objeto:

| Campo | O que ele contém |
|---|---|
| `round` | A rodada em andamento: uma após as rodadas que o forge avaliou |
| `progress` | Linhas, em ordem: a tendência nas avaliações do falante, depois as avaliações de cada rodada (cada uma seguida, em uma rodada cuja planilha misturou rascunhos de outro modelo, pela comparação às cegas) e, em seguida, o veredito de cada rodada sobre o conjunto de desenvolvimento |
| `checks` | Avisos sobre o que os números podem e não podem mostrar |
| `projection` | Uma estimativa aproximada de quantas frases de treinamento a mais são necessárias para atingir o nível "funcional", contadas por duplicação delas, com um intervalo — ou o motivo de não haver nenhuma — ou `null` antes de duas rodadas de avaliações |
| `projection_numbers` | A mesma estimativa em números: `more_sentences`, `range` (`[fewest, most]` frases de treinamento; `most` é `null` quando as verificações não conseguem delimitá-la) e `speaker_hours` — ou `null` quando não há projeção |
| `actions` | De uma a quatro coisas a fazer em seguida |

Ele lê apenas os registros mantidos pelas rodadas — as `marks.json` do falante por rodada
e os vereditos de `improve-compare` do forge — e exibe contagens e porcentagens,
nunca uma frase.

### O que cada linha significa

**As avaliações do falante — a medida que importa.** A cada rodada, o modelo em
uso gera rascunhos das frases que a família escreveu, e o falante avalia cada rascunho
como `Y` (certo), `N` (errado, com a forma como se fala) ou `?` (inseguro). A proporção
de acertos é calculada sobre os rascunhos marcados com `Y` ou `N`, com um intervalo de Wilson de 95%:

> Rodada 1: o falante avaliou 9 de 24 rascunhos de novas frases como certos — 38%
> (intervalo de 95%: 21%–57%).

Estas são frases novas — rascunhadas antes de qualquer modelo aprendê-las — portanto, esta é
a medida fora da amostra. Em uma rodada cuja planilha misturou rascunhos de outro
modelo, essas contagens correspondem apenas às linhas do modelo em uso. As linhas mostradas novamente
(abaixo) nunca estão nelas.

**Linhas mostradas novamente.** A partir da rodada 2, cerca de uma em cada dez linhas é um rascunho que
o falante já marcou em uma planilha anterior, de volta sem marcação. A planilha diz isso
em seu topo — *"Algumas linhas abaixo voltam de planilhas anteriores de propósito.
Por favor, marque-as do zero, como se fossem novas: a frequência com que as marcações concordam indica até que ponto
se pode confiar nelas."* — e nunca diz quais. `improve marks` imprime *"Linhas
mostradas novamente: o falante marcou A de J da mesma forma que antes (P%)"*, com
as alternâncias em cada sentido. Essas linhas nunca são contabilizadas na proporção da rodada e
nunca são usadas novamente em treinamento; elas custam ao falante cerca de 10 segundos por linha
([medição](/docs/agents/measurement#the-speakers-marks)).

**A comparação às cegas.** Um segundo modelo gera metade dos rascunhos de uma
planilha aleatoriamente, sem identificação, e o falante avalia ambos sem saber qual é qual
([medição](/docs/agents/measurement#the-speakers-marks)). O segundo
modelo é o mais recente quando ele não foi colocado em uso; na visita após uma
promoção, é o modelo que o novo substituiu. O relatório adiciona uma linha:

> Rodada 2: Às cegas, em frases novas: o modelo em uso foi avaliado como certo em 5
> de 12 (42%), o modelo mais novo (não em uso) em 7 de 12 (58%) — sem diferença
> evidente em 24 frases.

Após uma promoção, o texto diz *"o modelo colocado em uso por último foi avaliado como certo em …,
o modelo que ele substituiu em …"*. Ele termina de uma de três formas (um teste de
duas proporções a 5%): para um modelo mais novo, *o modelo mais novo é claramente melhor nas
frases de que a família precisa* ou *o modelo em uso é claramente melhor*; após uma
promoção, *o novo modelo é claramente melhor nas frases de que a família
precisa* ou *o modelo que ele substituiu era claramente melhor — o novo não
ajudou nas frases de que a família precisa*; ou *sem diferença evidente em N
frases*. Com poucas linhas avaliadas de um modelo, diz-se *"poucas linhas de
um modelo foram avaliadas para comparar"*.

**A tendência.** O relatório considera um aumento como *progresso real* apenas quando
as três condições são atendidas:

- o intervalo da última rodada fica totalmente acima do da primeira (seu limite
  inferior acima do limite superior da primeira);
- um modelo de uma rodada foi colocado em uso nesse intervalo — escolhido pelas pessoas
  (registros `export` e `choose` do forge): após um veredito **better** e
  o sim delas, com base nas avaliações cegas do falante ou por escolha própria. Um
  veredito **better** por si só não conta; e
- avaliando às cegas nas mesmas visitas, o falante marcou o novo modelo como correto
  com frequência claramente maior do que aquele que ele substituiu (as verificações após cada
  promoção, agrupadas; um teste de duas proporções a 5%).

A terceira condição existe porque a avaliação de um falante pode oscilar ao longo do tempo: alguém
que se torna mais tolerante a cada rodada eleva todas as porcentagens, mas em uma mesma visita isso afeta
ambos os modelos da mesma forma. Em uma simulação com um falante que marca 10% dos rascunhos incorretamente e
se torna mais tolerante a cada rodada, uma promoção que o conjunto de prática indicou incorretamente por acaso
apareceu como progresso real em 106 de 1.600 relatórios em que o modelo não tinha como
melhorar; com a checagem cega, foram 3 — e no máximo 3 em 1.600 novamente quando executada
com o piso de 50 frases e o veredito do falante, incluindo execuções cujo
conjunto de prática começa com 30 frases.

Um aumento com uma promoção, mas sem essa verificação, é exibido como *ainda não
considerado progresso real: o rigor na avaliação dos rascunhos também pode ter mudado*
— com as contagens da verificação, ou informando que a próxima planilha mistura os
rascunhos dos dois modelos. Um aumento mantendo o mesmo modelo em uso é exibido como
*não considerado progresso*: as frases ou as avaliações mudaram, não o modelo. Um aumento
dentro dos intervalos é exibido como *em alta, mas ainda dentro da margem de incerteza*.

**O veredito do conjunto de desenvolvimento.** O forge compara o novo modelo com
o modelo em uso nas mesmas frases de desenvolvimento (prática), frase por frase:

> Rodada 1: nas mesmas 50 frases de prática (dev), chrF++ (0–100, sobreposição
> com a tradução checada) 24,1 para o novo modelo contra 22,0 para o
> modelo em uso — sem mudança mensurável: não usado (em 50 frases, apenas uma
> diferença de cerca de 5,8 pontos ou mais aparece de forma confiável).

Como a linha termina depende do veredito e de as pessoas terem escolhido ou não
o modelo da rodada (registros `export` e `choose` do forge) — um veredito por si só
não coloca nada em uso:

| Veredito | Não escolhido | Escolhido |
|---|---|---|
| **better** | *mensuravelmente melhor: não colocado em uso — as pessoas não o escolheram* | *mensuravelmente melhor: colocado em uso* |
| **worse** | *mensuravelmente pior: não utilizado* | *mensuravelmente pior — colocado em uso…* |
| **no-change** | *sem mudança mensurável: não utilizado* | *sem mudança mensurável — colocado em uso…* |
| **too-few** | *poucas frases de prática para avaliar (menos de 50): as avaliações cegas do falante decidem* | *poucas frases de prática para avaliar (menos de 50) — colocado em uso…* |

"Colocado em uso…" termina em *com base nas avaliações cegas do falante* quando o forge contém um
veredito do falante para esse modelo com `clear: newer` (`improve-speaker`), e
em *por escolha das próprias pessoas* caso contrário. O `champollion improve status` usa as
mesmas palavras: a linha de cada rodada termina com *"· novo modelo nas frases de
prática (dev): …"*. A regra de veredito está em
[medição](/docs/agents/measurement#comparing-two-models).

**As verificações.**

- *Overfitting.* Se o chrF++ de dev do modelo em uso subiu 3 pontos ou
  mais ao longo das rodadas (o novo modelo da última rodada conta apenas depois que
  as pessoas o escolherem) enquanto a proporção de acertos do falante subiu 2 pontos ou menos,
  o relatório diz que o ganho pode pertencer às frases de prática, e que se deve
  confiar nas marcações.
- *Um conjunto de dev pequeno demais para ver ganhos.* Quando a menor diferença que o conjunto
  de dev mostra de forma confiável é de mais de 3 pontos de chrF++ (ou, se desconhecida, menos de 50
  frases), o relatório diz que "nenhuma mudança mensurável" é o limite do conjunto de dev,
  não uma prova de que a rodada não fez nada.
- *Até que ponto se pode confiar nas marcações.* Assim que 10 linhas mostradas novamente forem avaliadas,
  somando todas as rodadas: *"O falante marcou A de J linhas mostradas novamente da mesma forma que
  antes (P%): cerca de E% das marcações vão para o outro lado por acaso, o que puxa
  cada proporção marcada como correta em direção a 50% — a projeção leva isso em conta."* Quando
  rascunhos que antes estavam errados e agora foram marcados como certos superam com clareza o caminho
  inverso (um teste dos sinais a 5%, 6 alternâncias ou mais), ele acrescenta: *"a marcação pode estar ficando mais benevolente,
  o que um aumento na proporção não mostraria"*. Antes de 10: *"N linhas mostradas
  novamente avaliadas até agora — o erro de marcação do próprio falante é estimado a partir de
  10."*

**A projeção.** Feita apenas quando o aumento representa um progresso real (todos os três itens
acima) e a proporção de acertos ainda está abaixo de 80% — o termo dos trilhos para
*funcionar* nas frases de que a família precisa. As curvas de aprendizado sobem em passos aproximadamente
iguais a cada duplicação das frases de treinamento, então ela lê o passo a partir
das verificações cegas do falante de cada novo modelo em relação ao que ele substituiu
(com os pares de treinamento de ambos os modelos registrados) e indica quantas frases de treinamento a mais
são necessárias para atingir 80% marcadas como certas, com um intervalo, e as horas do falante a
cerca de 70 segundos por frase (um minuto para escrever, dez segundos para marcar). O
intervalo cobre o que as verificações permitem (95%) e, assim que 10 linhas mostradas novamente forem
avaliadas, onde "verdadeiramente correto em 80%" pode se situar nas próprias marcações deste falante; o
texto diz então: *"rascunhos verdadeiramente corretos em 80% podem ser marcados como certos cerca de T% das
vezes em suas marcações — o intervalo inclui isso"*. Antes disso, ele diz:
*"(O erro de marcação do próprio falante ainda não foi levado em conta: poucas linhas
mostradas novamente foram avaliadas.)"* A estimativa em si permanece nos 80%
exatos. As contagens são arredondadas para dois algarismos. Quando as verificações não conseguem delimitá-la, ela
diz que *"ainda não é possível dizer quantas frases a mais seriam necessárias"*. Caso contrário, ela explica
por que não há nenhuma — por exemplo, *"a verificação cega do falante ainda não mostrou
o novo modelo superando aquele que ele substituiu, portanto o aumento pode estar na
marcação, não no modelo"*. Diga sempre que é uma estimativa aproximada; o relatório o faz.
Na simulação, ela ficou dentro de um fator de 2 da contagem real 69–78% das
vezes com 400 frases por rodada e 53–56% com 800, e a contagem real caiu
dentro do intervalo 89–94% e 76–80% das vezes (com 800 por rodada, 51–54%
antes de o intervalo incorporar as marcações do falante); a linha reta que ela
substituiu, 5% com 400. Nunca diga que um modelo "já pode estar funcionando" a partir do
erro de marcação do falante: o relatório não faz isso, porque na simulação essa
observação errou de 2 a 3 vezes para cada vez em que acertou.

**As ações.** Por ordem de prioridade, no máximo quatro: avaliar a planilha desta rodada ou escrever
as frases que ainda faltam (20 por rodada); quando a comparação cega considerou o modelo
mais recente claramente melhor, que *"a rodada realmente ajudou, mesmo onde o
conjunto de prática não pôde mostrar"* — continue avançando, e expandir o conjunto de prática
permitirá que o próximo veredito perceba isso; quando o falante considerou o modelo substituído por uma promoção
claramente melhor, perguntar às pessoas se desejam retornar ao modelo anterior e aproximar
o conjunto de prática das frases de que precisam; expandir o conjunto de prática, quando ele for
pequeno demais para enxergar o ganho de uma rodada e tiver menos de 200
frases (*"uma frase em cada 2 em cada planilha não tem rascunho — o falante
escreve como se diz, e ela se junta ao conjunto de prática (agora 31; 50 permite
avaliar uma rodada, 200 permite que um ganho de cerca de 3 pontos apareça)"* — "em cada 4"
a partir de 50); o que fazer após duas rodadas sem ganho (abaixo); que
o tempo que o falante informou poder dedicar parece curto demais; e, assim que o
limite inferior da proporção de acertos atingir 70%, uma checagem no conjunto de teste trancado — com uma
previsão escrita antes.

**Duas rodadas sem ganho** — os dois últimos vereditos sendo ambos **no-change** ou
**worse** (uma rodada **too-few** não diz nada em nenhum sentido e não conta),
sem nenhum modelo colocado em uso entre elas; o forge faz a contagem da mesma forma para a
oferta de modelo mais forte. Onde o conjunto de prática consegue ver o ganho habitual de uma rodada,
a ação diz: *"Duas rodadas sem um ganho que este conjunto de prática consiga ver
(cerca de X pontos chrF++ ou mais): as rodadas podem estar adicionando menos do que isso, ou
nada — não é possível saber qual dos dois. Caminhos mais rápidos para avançar: o modelo mais forte que
os trilhos oferecem quando o computador puder treinar um, ou mais tipos de frases
que ele erra."* (X é a menor diferença que o veredito mostra.) Onde ele não
consegue, diz para continuar. Nunca diga nem sugira que mais frases não vão
ajudar: perto do topo da curva, uma rodada acrescenta cerca de meio ponto de chrF++, abaixo
do que 200 frases de prática conseguem mostrar. Em rodadas simuladas, a frase anterior
"mais do mesmo pode não ajudar" foi dita em 98 de 1.200 relatórios enquanto o
modelo estava, na verdade, melhorando.

### Como repassar as informações

1. **O progresso primeiro.** Comece pelo que mudou, nas avaliações do falante.
2. **Todo número com sua unidade e conjunto.** "9 das 24 frases novas que o
   falante checou estavam corretas — 38%", nunca "38%". "chrF++ de 24,1 em 100 nas
   50 frases de prática", nunca "24,1". Um intervalo indica o grau de certeza das ferramentas,
   não dois resultados: "algo entre 21% e 57% — com 24 frases, as
   ferramentas não conseguem ter mais certeza do que isso".
3. **As checagens, de forma simples.** Se o relatório alertar, diga qual é o alerta.
4. **Os próximos passos como coisas que eles podem fazer.** Transforme cada ação em uma frase
   direcionada às pessoas, mencionando o arquivo indicado.
5. **Repasse cada ressalva palavra por palavra.**

**Incentive o que foi medido.** Um rascunho marcado como certo, um aumento além
dos intervalos, um novo modelo colocado em uso: comemore com entusiasmo. A primeira
tradução merece ser celebrada. Nunca celebre um número que o relatório não classifique
como progresso.

**"Sem mudança mensurável" — de forma clara e gentil.** Isso não significa que a rodada
foi desperdiçada. Explique o que isso quer dizer: com essa quantidade de frases de prática,
apenas uma diferença em torno deste valor se torna visível; um ganho menor pode estar oculto;
o modelo em uso continua em uso; as frases corrigidas pelo falante continuam contando. Em
seguida, indique o próximo passo.

**"Poucas frases de prática para avaliar" — não "sem mudanças".** Com menos de 50
frases de prática, nenhuma comparação decide, independentemente de quais sejam as duas pontuações;
não é um veredito sobre o novo modelo. Diga o que acontece em vez disso: o modelo em uso
permanece por enquanto; a próxima planilha mistura os rascunhos do modelo mais recente, sem identificação,
e as avaliações do falante decidem; uma a cada duas linhas da planilha não tem rascunho, e essas
frases expandem o conjunto de prática até que uma rodada possa ser avaliada por ele.

**A comparação cega — com ambas as contagens e o que ela faz.** Informe as contagens
de ambos os modelos e o final do relatório, como estiver escrito. Quando o modelo mais recente
for claramente melhor, diga como está no relatório — que a rodada realmente ajudou, mesmo onde
o conjunto de prática não pôde mostrar — e que esse é o próprio julgamento do falante
em frases novas. Após um veredito **too-few** ou **no-change** nesse modelo,
uma preferência clara faz o forge oferecê-lo para uso: `improve marks`
exibe *"o forge registrou: ele oferece colocar o modelo mais novo em uso (as
pessoas dizem sim primeiro)"*, e a oferta vem como a etapa `improve-promote`
(abaixo) — pergunte antes de executá-la. Após um veredito **worse**, ele não é
oferecido. Após uma promoção, essa mesma checagem é o que permite ao relatório considerar uma
alta como progresso real; quando ela indicar que o modelo substituído era claramente
melhor, pergunte às pessoas se desejam restaurar o modelo anterior — nunca faça isso
sem o sim delas. "Nenhuma diferença clara" em 24 frases significa exatamente o que diz.
**Observação.** Nunca diga ao falante quais linhas vieram de qual modelo antes
que suas avaliações sejam lidas.

**Linhas mostradas novamente — para que servem.** Diga a concordância com suas contagens,
como faz o relatório ("o falante marcou 17 de 20 linhas mostradas novamente da mesma forma
que antes — 85%"), e para que serve: até que ponto se pode confiar nas marcações.
Isso é anunciado na planilha, não é uma verificação oculta do falante.
Apresente o erro aleatório da forma como o relatório faz: cerca de E% das marcações vão
para o outro lado por acaso, o que puxa cada proporção em direção a 50%, e a projeção
leva isso em conta. Quando o relatório disser *"a marcação pode estar ficando mais benevolente"*,
diga isso de forma direta e sem culpar ninguém: um aumento na proporção pode ser decorrente da
marcação, e não do modelo. **Observação.** Nunca diga ao falante quais linhas
voltam, nem o que ele marcou antes — a planilha avisa apenas que algumas linhas voltam.

**Palavras que o modelo nunca viu.** Quando `sync` avisar que chaves *"contêm
palavras que o modelo nunca viu no treinamento — muito provavelmente traduzidas incorretamente,
por mais fluentes que pareçam"*, diga isso claramente: essas linhas muito provavelmente estão
erradas, mesmo que soem bem; um falante deve verificá-las, ou as frases da próxima rodada podem
ensinar essas palavras. Indique as chaves, exatamente como no aviso; você nunca vê as palavras.
A pessoa as vê na página de teste do modelo, abaixo de cada linha. A evidência, no idioma de
teste inventado: frases com uma palavra que o modelo não havia visto estavam certas 0 vezes em
358 ([serviço](/docs/agents/serving#words-the-model-never-saw)).

**As palavras da lista de desejos.** A seção "Palavras que ele nunca viu" pede
*"duas ou três frases com cada palavra necessária, cada uma dizendo algo diferente"*:
menos palavras, cada uma em algumas frases, ensinam mais ao modelo do que muitas palavras
vistas uma única vez. Repasse a instrução dessa forma. No idioma de teste inventado, uma
palavra vista uma vez no treinamento foi traduzida corretamente em 27–29% das vezes, e vista
2–4 vezes, em 63–95%; com 3.200 frases de treinamento, o ByT5-small treinado em frases
escolhidas pela maior quantidade de palavras novas teve 39,4% de 500 frases retidas corretas
no significado, contra 53,4% para frases cotidianas — consumindo um pouco mais do tempo
do falante (cerca de 57 horas contra 54).

Nunca qualifique uma pontuação como boa ou ruim por conta própria. Um falante
fluente decide o que está adequado para uso.

## Pedindo tempo

A etapa `improve-time` (modo `ask_user`) pergunta quanto tempo o falante pode
dedicar: `per_week` e `total`, cada uma **exatamente como foi dito** ("talvez 30
frases por semana", "algumas horas, depois vemos"). Isso é registrado por
`champollion improve time` em `improve/time.json`; a quantidade de frases de cada rodada
é planejada em torno disso, e o relatório compara a projeção com esse valor.

- **Observação.** Pergunte uma vez; nunca insista por mais. Se não souberem, repasse o que disseram — palavras vagas continuam sendo uma resposta.
- **Observação.** Quando o relatório indicar que a projeção exige mais frases do que o tempo informado como restante, diga com clareza, apresentando as opções listadas: mais falantes, colaboradores no projeto ou uma meta mais restrita por enquanto (um guia de frases para as necessidades mais urgentes). Depois, deixe que eles escolham.

## As ofertas que os trilhos fazem

**Oferecendo um modelo melhor para uso** (estado do forge `improve-promote`, modo
`confirm`). Um novo modelo foi mensuravelmente melhor no conjunto dev — ou o conjunto
dev não conseguiu decidir (**too-few** ou **no-change**) e o falante, avaliando
às cegas, considerou-o correto com frequência claramente maior. Então o `why` do forge adiciona as
contagens do falante: *"Avaliando às cegas na mesma visita, o falante marcou o
modelo mais novo como correto em A de B frases novas (P%) e o modelo em uso em C de
D (Q%) — uma diferença clara: o modelo mais novo é melhor nas frases de que a
família precisa."* Diga qual foi o caso. É uma oferta: um veredito por si só não muda
nada. Colocá-lo em uso muda o que a página ou aplicativo deles responde, portanto pergunte antes
de executar a etapa; se a resposta for "agora não", `declined: true`. Somente o sim deles — o `export` e o
`choose` da etapa — o coloca em uso; até lá, o relatório exibe
*"mensuravelmente melhor: não colocado em uso — as pessoas não o escolheram"*, e
nenhum aumento conta como progresso decorrente dele. Depois de escolhido com base nas avaliações do falante, a
linha da rodada exibe *"colocado em uso com base nas avaliações cegas do falante"*.

**Um modelo mais forte** (estado do forge `improve-stronger-model`, modo `ask_user`).
Após duas rodadas consecutivas em que o conjunto dev pôde avaliar e não mostrou nenhum ganho —
ambas **no-change** ou **worse**; uma rodada **too-few** não conta —
contadas a partir da última alteração de modelo (uma troca de preset ou qualquer modelo que
as pessoas colocaram em uso com `choose`, incluindo uma promoção com base nas avaliações do falante),
com o modelo minúsculo em uso, os trilhos oferecem o ByT5-small
— `byt5-small`, ou `byt5-small-lowmem` onde a GPU tiver 8–15 GB de memória
para treinar (menos memória por etapa, mais lento): um download de cerca de 1,2 GB e
um treinamento mais longo, melhor no Apple silicon ou em uma GPU NVIDIA
([treinamento](/docs/agents/training#models)). O campo de resposta é `try_it`:
`yes` ou `not-now`. Diga o que o `why` do forge diz — quando o conjunto dev for pequeno
demais para ver o ganho de uma rodada, que pequenos ganhos podem estar ocultos; caso contrário, que
as duas rodadas trouxeram *"nenhuma mudança que as frases dev possam ver (cerca de X pontos
chrF++ ou mais): as rodadas podem estar acrescentando menos do que isso, ou nada"*. Ele
não diz que mais frases não estão ajudando, e você também não. "Agora não"
é uma das respostas desta etapa: passe `try_it: "not-now"` (via MCP,
`declined: true` é recusado aqui). O forge registra isso, mantém o modelo em uso,
e a oferta só retorna após mais duas rodadas desse tipo (**no-change** ou
**worse**). Qualquer resposta está ótima; a escolha é delas.

**Avaliando a previsão.** Após a pontuação do conjunto de teste, as pessoas dizem se
a previsão que escreveram se confirmou (`held` ou `missed`) e quem a avaliou. Leia para
elas a previsão e a pontuação com seu intervalo; nunca faça essa avaliação por elas.

**Falantes que ainda não deram consentimento.** Um arquivo em `waiting_for_agreement` é
consultado uma vez por sessão, com delicadeza. Apenas um "sim" da pessoa — confirmando
que todos cujas palavras constam nele concordaram — responde à questão.

## Palavras para usar com as pessoas

| Diga | Em vez de |
|---|---|
| "uma pontuação de até 100 sobre o quanto as traduções se aproximam das do próprio falante — chrF++" | "chrF++ 24,1" isolado |
| "o grau de certeza das ferramentas: algo entre 21% e 57%" | "IC [0,21, 0,57]" |
| "as frases de prática" (o conjunto de dev) | "divisão de dev" |
| "as frases de teste, mantidas trancadas" | "conjunto de teste reservado" |
| "o primeiro modelo pequeno" | o nome da pasta ou da execução dele |
| "sem mudança mensurável — em 50 frases de prática, apenas uma diferença de cerca de 6 pontos aparece" | "nenhuma melhoria" |
| "poucas frases de prática para avaliar ainda — abaixo de 50, as marcações do próprio falante decidem" | "sem mudanças" para um veredito too-few |
| "um livro de frases: bom com frases parecidas com as que ele aprendeu" | "baseline de NMT para baixos recursos" |
| "o falante considerou 9 de 24 corretas" | "acurácia de 38%" |

Explique cada termo na primeira vez em que ele surgir, com um exemplo antes da palavra.

## Quando sugerir ajuda

- **O projeto está travado ou eles pedem ajuda humana.** Diga: *"Está com
  dificuldades ou quer ajuda com o seu projeto? Vamos conversar."* —
  [info@champollion.dev](mailto:info@champollion.dev). Nunca obrigatório; sem
  cobrança.
- **Eles precisam de mais frases, falantes ou poder computacional do que possuem.**
  Indique a página [Participe de um projeto](/docs/join-a-project): outras pessoas podem
  oferecer frases, listas de palavras ou métodos (apenas arquivos, hoje), e nada do que é
  deles sai sem o seu consentimento ([hospedagem e participação](/docs/agents/hosting-and-joining)).

## Aprofunde-se

- [Melhorando rodada a rodada](/docs/make-it-better) — o ciclo de aprimoramento como
  as pessoas o leem.
- [Regras de medição](/docs/agents/measurement) — a regra do veredito, intervalos e
  limites do conjunto de desenvolvimento.
- [Treinamento com nmt-forge](/docs/agents/training) — o que é o modelo mais forte
  e quanto ele custa.
- [O contrato operacional](/docs/agents/contract) §5 — diga apenas o que for verdade.
