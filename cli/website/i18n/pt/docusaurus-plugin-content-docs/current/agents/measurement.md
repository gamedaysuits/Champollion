---
title: "Regras de medição"
slug: /agents/measurement
description: "Como o Champollion avalia um tradutor e como um agente relata isso: o padrão de pontuação (chrF++ de corpus com intervalo bootstrap de 95%), pontuações com gating, dev versus teste, predições, quase-cópias, o piso do dicionário, a regra do veredito pareado e o piso de 50 frases sob ela, o que direciona a lista de desejos, as notas da pessoa falante, a comparação cega entre dois modelos, o veredito da pessoa falante, linhas exibidas novamente (concordância, erro aleatório, desvio) e como expressar um número."
---

# Regras de medição

Os trilhos prometem que as pessoas vão **saber** quão bom um modelo é em suas
próprias frases — não que ele seja bom. Essa promessa se apoia em algumas regras,
a maioria delas obrigatória. Esta página apresenta essas regras com exatidão e termina
mostrando como comunicar um número.

## O padrão de pontuação (standard/1)

Toda nova execução é pontuada da mesma forma (`arena/mt_eval_harness/scoring.py`):

- **O destaque:** **chrF++** no nível do corpus (sacreBLEU chrF com ordem de palavras
  2), de 0 a 100 — quanto maior, mais próximo das traduções de referência —
  com seu **intervalo de bootstrap de 95%** e sua assinatura sacreBLEU. Escrito como
  `chrF++ 47.5 [45.9, 49.0]`.
- **Quais segmentos contam:** uma regra única para o destaque, seu intervalo e cada
  comparação. Um segmento cuja tradução falhou conta como uma saída vazia —
  nunca é descartado, nunca é pontuado como marcador de posição; um segmento sem referência
  é deixado de fora em todos os lugares.
- **O intervalo:** o próprio do destaque — bootstrap de percentil sobre esses
  segmentos, 1.000 reamostragens, semente 12345, α 0,05. Abaixo de 30 segmentos, as ferramentas
  avisam que o intervalo pode ter cobertura ruim; com menos de 2, não há
  nenhum.
- **Ao lado, nunca misturados:** BLEU, spBLEU, TER e COMET quando calculado,
  cada um com sua assinatura ou ID de modelo.
- **Diagnósticos, em separado:** correspondência exata, correspondência equivalente, aceitação por FST,
  precisão morfológica, validador semântico, alternância de código, alucinação,
  aderência à terminologia, estilo de escrita. Eles nunca entram no destaque e nunca
  definem classificação.
- **"Melhor" é um teste de significância pareado** no chrF++, nunca dois números
  comparados a olho nu.
- **Sem rótulos de qualidade.** Apenas a avaliação humana certifica a qualidade.

**Descontinuados:** a pontuação composta ponderada e os rótulos de nível de qualidade. Um
card de execução standard/1 traz `composite: null` e `quality_tier: null`.
**Aviso.** Nunca apresente, calcule ou cite uma pontuação composta ou um nível, mesmo de um
card antigo.

**Ressalvas de pontuação** são diagnósticos escritos ao lado de uma pontuação, nunca uma alteração nela:
`source_copy` (metade ou mais das saídas copiam a fonte),
`length_inflation` e `length_deflation` (saídas com mais do dobro, ou menos da metade,
do comprimento da referência — em média, ou em um quarto ou mais dos segmentos), `near_constant_output` (uma única saída repetida em várias
fontes) e `train_test_near_twin` (linhas de teste com gêmeas no treino —
grave quando metade ou mais tiver). **Aviso.** Repasse cada ressalva junto com a pontuação,
palavra por palavra.

## Medição com gates

Quando uma execução tem uma cadeia de gates ([métodos e gates](/docs/agents/methods#gate-chains)),
**o que é medido é o que é entregue**:

- o chrF++ de destaque pontua a saída pós-gates;
- o chrF++ sem gates, com seu intervalo, fica ao lado
  (`overall.gates.ungated`);
- a **taxa de recusa** — segmentos recusados pelos gates ÷ segmentos avaliados — é um
  número próprio, com contagens por gate e pelo que foi entregue (`shipped_from`:
  método, fonte, fallback, nada);
- a **impressão digital** da cadeia (sha256 de seu JSON canônico) acompanha o
  relatório e qualquer execução publicada.

**Bloqueio.** Sem fallback na medição: `mt-eval run` e `mt-eval test` recusam
uma cadeia cujos gates repassam segmentos recusados para um fallback, antes que qualquer coisa seja
traduzida ou gasta.

**Aviso.** Relate uma pontuação com gates junto com a pontuação sem gates e a taxa de recusa.
Uma pontuação com gates isolada esconde o que os gates descartaram.

## Conjuntos e para que serve cada um

| Função | Usado para | Leitura |
|---|---|---|
| `train` | Aprendizado | Nunca avaliado como resultado |
| `dev` (prática) | Escolher o checkpoint; avaliar rodadas de aprimoramento (a partir de 50 frases); o piso do dicionário | Livremente |
| `test` | Marcos: testar um modelo, comparado à previsão das pessoas | Toda leitura de pontuação exige um pré-registro (forge); toda leitura é registrada |
| `sealed` | Um teste que ninguém de fora de quem o detém vê | Uma vez |

**No nmt-forge** (o registro, `.forge/eval-registry.json`; o livro-razão):

- **Bloqueio.** Cada leitura de um conjunto registrado é gravada no livro-razão
  encadeado por hash com sua finalidade (`score`, `dev-selection`, `audit`, `inspect`).
- **Bloqueio.** Pontuar um conjunto de teste requer um pré-registro válido para seu
  conteúdo atual.
- **Bloqueio.** Um conjunto lacrado é pontuado uma única vez. Uma segunda pontuação é recusada (`sealed
  set '<name>' has already been spent`); a single `mt-eval` no arquivo lacrado
  também o consome. `--override-respend '<reason>'` (em `nmt-forge score`
  e `nmt-forge compare`) é registrado no livro-razão. `export` recusa o
  reconsumo e cita `--no-eval`.
- **Bloqueio.** O isolamento de dev: o treinamento precisa de um conjunto `dev` registrado; linhas de dev não
  podem compartilhar fonte ou alvo exatos com um conjunto de teste ou lacrado; nenhuma linha de treino
  pode ser uma linha de dev.

**No mt-eval:**

- **Aviso.** `mt-eval run` e `mt-eval compare` pontuam um arquivo de teste ou lacrado
  sem nenhum pré-registro e nunca recusam com base em contagens de leitura. `mt-eval run`
  apenas anexa uma linha ao log de leitura do arquivo (`<file>.reads.jsonl`) quando o forge
  tiver criado um; `compare` e `test` não registram nada. Nunca pontue o conjunto de teste com
  o mt-eval antes que a previsão das pessoas seja escrita.

## Previsões

```bash
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge prereg new round-2 --eval-set project-test --predictions predictions.json
nmt-forge prereg template --out predictions.json
```

- `--expect` e `--rationale`: uma previsão em texto livre sobre o chrF++, nas
  próprias palavras das pessoas. O veredito é delas: `nmt-forge prereg verdict
  <id> --prediction <n> --held` (or `--missed`) `--by "<who>"`.
- `--predictions <file>`: uma matriz JSON; cada previsão indica um `metric` e
  um `rationale`, e ou um `direction` (`increase`, `decrease`,
  `no_change`) com um `baseline_score` (e `margin` opcional) — julgado pelas
  ferramentas — ou `expect` em texto livre.
- **Bloqueio.** Uma previsão escrita após qualquer leitura de pontuação do conjunto (pelo forge,
  ou pelo `mt-eval run`) é recusada: *"eval set '…' was already read for scoring
  (N time(s): …) before this preregistration"*. `--allow-after-reads` permite a passagem,
  e todo relatório, exportação e status informa isso.
- **Aviso.** A previsão é das pessoas, escrita antes de qualquer pontuação existir,
  nunca reformulada ou limitada por você. A pergunta dos trilhos não sugere nenhum número
  (*"No number is suggested here, so the guess stays theirs"*); você também não deve oferecer
  nenhum.

## Quase-cópias

`nmt-forge leak-audit` compara cada par de treino com cada conjunto dev,
de teste e lacrado registrado:

| Encontrado | Regra | O que acontece |
|---|---|---|
| Mesmo arquivo | sha256 | Descartado |
| Cópia exata | Mesma fonte ou mesmo alvo após normalização | Descartado |
| Quase-cópia | Conjuntos de palavras do alvo se sobrepõem em ≥ 0,6 (Jaccard) onde um contém o outro, ou ≥ 0,9 | Descartado |
| Irmão de modelo (template) | Mesma estrutura de frase, resposta diferente | **Mantido** para aprender com ele, e contado, para que a pontuação possa ser lida com e sem essas linhas de teste |
| Correspondência apenas na fonte | Mesmo prompt, resposta diferente | Mantido, relatado |

Frases curtas são comparadas por trigramas de caracteres; frases muito curtas, apenas por
correspondência exata. Uma linha de teste é uma **quase-gêmea** quando uma linha de treino é idêntica ou
se sobrepõe a ela em ≥ 0,6 em qualquer um dos lados; quando metade ou mais das linhas de teste têm
gêmeas, a pontuação reflete principalmente memorização, não tradução, e a ressalva é grave.
`--clean-to` grava o arquivo filtrado; `--drop-test-twins` também descarta as
linhas de treino que são gêmeas de uma linha de teste, para uma pontuação livre de gêmeas.

A primeira divisão de dev dos trilhos aplica o mesmo limiar: `--near-dupe 0.6` em
`nmt-forge split` mantém linhas cujas palavras se sobrepõem em ≥ 0,6 em um dos lados da
fronteira dev/treino, de modo que a primeira pontuação de dev não guarde memória de quase-cópias que a filtragem
de uma rodada posterior negaria. `--max-group` limita um grupo de quase-cópias à metade do
tamanho de dev mais um, para que um arquivo gerado a partir de templates ainda seja dividido.

**Aviso.** Diga "a auditoria de vazamento encontrou …" apenas a partir de `true_now` ou da própria
saída da auditoria, nunca afirmando por conta própria que "o conjunto de teste está limpo".

## O piso do dicionário

`nmt-forge floor <word lists>` traduz o conjunto dev palavra por palavra com o
dicionário (frase mais longa primeiro) e o pontua com o mesmo código da
pontuação de dev de uma execução: chrF++ com seu intervalo de 95%. Ele roda neste computador, nunca lê
o conjunto de teste e registra apenas os nomes, hashes e contagens de entradas dos dicionários,
quantas palavras-fonte foram alcançadas e as pontuações. Uma execução só **supera o
piso** quando a extremidade inferior do seu intervalo de dev fica acima da extremidade superior
do piso; `nmt-forge status` avisa sobre uma execução que não faz isso.

## Comparando dois modelos

**Uma rodada de melhoria** (`nmt-forge compare-runs <in-use> <new>`): as traduções de ambos os modelos
das **mesmas frases de dev**, pareadas linha por linha; um teste pareado de
randomização aproximada (1.000 tentativas) e um intervalo de bootstrap de 95% sobre
a diferença.

| Veredito | Regra |
|---|---|
| **too-few** | menos de 50 frases de dev, sejam quais forem as pontuações — o modelo em uso continua, e as avaliações cegas da pessoa falante decidem (abaixo) |
| **better** | 50 ou mais, p < 0,05 **e** o limite inferior do intervalo acima de 0 — o novo modelo é oferecido para uso; ele só entra em uso com o sim das pessoas |
| **worse** | 50 ou mais, p < 0,05 e o limite superior do intervalo abaixo de 0 |
| **no-change** | qualquer outro caso — o modelo em uso continua |

**Por que 50.** Medido nas saídas do ByT5-small para a língua de teste inventada, 100
conjuntos de prática aleatórios por tamanho, com esta regra: com 23 frases de dev,
ela considerou dois modelos quase iguais (diferença de 0,7 chrF++ em 500 frases)
como diferentes 9 vezes em 100, e considerou um ganho real de +5,9 chrF++ como
**better** apenas 21 vezes em 100; com 50 frases, 4 vezes e 96 vezes em 100.
A menor diferença observada 8 vezes em 10 foi de 8,1 pontos de chrF++ com 23 frases,
5,8 com 50, 4,0 com 100 e 2,8 com 200. Portanto, a primeira divisão dos trilhos
reserva pelo menos 50 frases de dev quando há 200 pares ou mais — um a cada dez
dos pares triados, no máximo 500; com menos de 200 pares, um quarto deles, o que
dá menos de 50 — e as planilhas de revisão ampliam o conjunto com linhas de prática:
uma linha a cada duas enquanto estiver abaixo de 50, uma a cada quatro até atingir 200.

Cada veredito também indica a menor diferença que seu conjunto dev detecta com segurança
(8 vezes em 10): a largura do intervalo × (1,96 + 0,84) ÷ (2 × 1,96). Quando esse valor
passa de 3 pontos de chrF++, "no-change" é o limite do conjunto dev, não uma prova de que a
rodada não fez nada. O conjunto dev também escolheu o checkpoint da nova execução, o que
favorece levemente o novo modelo — **diga isso** ao transmitir um veredito.

Uma preferência cega do falante pelo modelo mais novo (abaixo) faz com que o forge
o ofereça para uso apenas após um veredito **too-few** ou **no-change** — nunca
após **worse** —, e as pessoas dizem sim primeiro (`improve-promote`, modo
`confirm`). Uma preferência cega pelo modelo que uma promoção substituiu nunca o
coloca de volta: a ação do relatório da rodada pergunta às pessoas.

**Quaisquer duas execuções** (`mt-eval compare <report> <report> --significance`):
randomização aproximada por padrão (`--method paired_bootstrap` para a
outra), 1.000 tentativas (`--n-bootstrap`), α 0,05, semente 12345, nas entradas que os
relatórios compartilham por ID (um aviso com menos de 10). chrF++ primeiro, depois as métricas
secundárias. Todo par de execuções é testado; não há correção para testes múltiplos,
e a saída informa isso.

## No que a lista de desejos se baseia

`nmt-forge analyze` divide o chrF++ de dev de uma execução por tipo de frase (com
pelo menos 5 frases de dev daquele tipo). Um tipo é considerado o **mais fraco** — e ganha peso na
lista de desejos — somente quando o intervalo de 95% sobre o quanto suas frases pontuam abaixo
das demais fica inteiramente acima de zero (intervalo de Welch no chrF++ por frase).
Uma pontuação mais baixa que possa ser fruto do acaso é informada como tal (*"… could be chance —
the wishlist does not steer by it"*) e nunca recebe peso na planilha.

A seção "Palavras que ele nunca viu" pede duas ou três frases com
cada palavra, cada uma dizendo algo diferente, e não apenas uma: na linguagem de teste
inventada, uma palavra vista uma única vez no treino saía correta em 27–29% das vezes e
uma palavra vista de 2 a 4 vezes, em 63–95%; e com 3.200 frases de treino, o ByT5-small
treinado em frases escolhidas pelo maior número de palavras novas acertou o significado de 39,4% de 500
frases reservadas, contra 53,4% para frases do dia a dia, exigindo um pouco
mais de tempo do falante (cerca de 57 horas contra 54).

## As avaliações do falante

Em cada rodada de melhoria, o falante marca os rascunhos de novas frases do modelo
`Y`, `N` ou `?`. A proporção de acertos é `Y ÷ (Y + N)` (`?`, não marcadas, linhas
de prática e linhas exibidas novamente ficam de fora), com um intervalo de Wilson de 95%. Um aumento entre rodadas conta como
**progresso** somente quando o intervalo da última rodada estiver totalmente acima do
da primeira, um modelo de uma rodada foi colocado em uso no intervalo — escolhido pelas pessoas
(registros `export` e `choose` do forge), seja após um veredito de **better**,
nas marcações cegas do falante ou por escolha própria; um veredito de **better**
por si só não conta — **e** as verificações cegas do falante de cada promoção
(abaixo), combinadas ao longo das rodadas intermediárias, marcaram os novos modelos como certos
claramente com mais frequência do que aqueles que eles substituíram (|z| > 1,96).
São frases que nenhum modelo tinha visto: a métrica que mais importa e a
principal a ser considerada ([coaching](/docs/agents/coaching)).

**Dois modelos, às cegas.** O `champollion improve sheet` faz um segundo modelo rascunhar
uma metade aleatória (com semente definida) das linhas rascunhadas (`nmt-forge draft-newer`), sem identificação:
o modelo treinado mais recente quando não for o que está em uso — como após uma rodada
cujo veredito foi too-few, no-change ou worse — ou, na visita após uma
promoção, o modelo que o atual substituiu. A informação de quais linhas pertencem a quem é mantida
ao lado da planilha em `improve/round-<k>/sheet-key.json` (`in_use`, `other`,
`relation` `newer` ou `replaced`, os pares de treino de cada modelo `in_use_pairs`
e `other_pairs`, `other_rows`, e `repeat_rows`, abaixo).
O `champollion improve marks` então faz a contagem dos dois modelos separadamente, deixando as linhas
exibidas novamente de fora de tudo isso:

- a proporção de acertos acima — a medição de progresso — conta apenas as
  linhas do modelo em uso;
- cada rascunho marcado como correto e cada correção vira um par de treino,
  qualquer que seja o modelo que o tenha rascunhado;
- um teste de duas proporções (combinado, bicaudal a 5%: |z| > 1,96) indica
  qual modelo o falante marcou como correto com mais frequência, se houver: `clear` é `newer`
  ou `replaced` (o outro modelo), `in-use` ou `neither`, registrado em
  `marks.json` (`blind`) com ambas as contagens (`in_use_right`, `in_use_judged`,
  `other_right`, `other_judged`, `in_use_share`, `other_share`), `other`,
  `relation` e as contagens de pares de treino de ambos; uma comparação com um modelo mais novo
  também mantém `newer`, `newer_right`, `newer_judged` e `newer_share`. Quando
  qualquer um dos modelos não tiver nenhuma linha marcada como `Y` ou `N`, `clear` será `null` e o texto
  dirá *"poucas linhas de um dos modelos foram avaliadas para comparar"*;
- contra um modelo mais novo, com pelo menos um rascunho de cada avaliado, as contagens
  vão para o forge (`nmt-forge speaker-verdict`), que executa o mesmo teste e
  registra `clear` (`newer`, `in-use` ou `neither`) em seu livro de registros
  (`improve-speaker`). Após um veredito **too-few** ou **no-change** nessa
  execução, o `clear: newer` faz com que o forge ofereça o modelo mais novo para uso;
  o `champollion improve marks` então exibe *"o forge registrou: oferece colocar o modelo mais novo em uso (as pessoas dizem sim primeiro)"*
  ([treinamento](/docs/agents/training#the-improve-rounds)).

As linhas foram atribuídas aleatoriamente, em uma única planilha, avaliadas pelo mesmo falante,
nas frases inéditas da própria família — portanto, uma diferença clara revela algo que o conjunto dev
pode ser pequeno demais para mostrar, e uma mudança na exigência do falante ao avaliar
afeta ambos os modelos da mesma forma. **Aviso.** Nunca diga ao falante quais linhas vieram
de qual modelo antes que suas avaliações sejam lidas.

**Linhas exibidas novamente.** A partir da rodada 2, o `champollion improve sheet` insere de volta uma
linha para cada 10 novas frases na planilha (`REPEAT_EVERY`; arredondado para baixo,
e menos quando houver menos qualificadas): um rascunho que o falante marcou como `Y` ou `N` em uma
planilha anterior, com seu rascunho anterior, sem identificação, em uma posição aleatória com semente —
nunca uma linha de prática, uma linha que já era uma repetição, uma já exibida
novamente ou uma frase desta planilha. A primeira linha da planilha, acima do
cabeçalho, diz: *"Algumas linhas abaixo voltam de planilhas anteriores de propósito.
Por favor, avalie-as do zero, como se fossem novas: a frequência com que as marcações concordam indica até que ponto
elas são confiáveis."* Ela nunca diz quais; o `sheet-key.json` as mantém como
`repeat_rows` (`row`, `from_round`, `from_row` e `mark`, a marcação
anterior). Elas custam ao falante cerca de 10 segundos por linha.

O `improve marks` avalia cada uma apenas em relação à marcação anterior do próprio falante: uma
repetição nunca é contada na proporção da rodada, nunca volta a ser um par de treino,
nunca entra na comparação às cegas. O `marks.json` recebe `repeats`: `shown`,
`judged` (marcadas como `Y` ou `N` desta vez; `?` ou em branco é exibido, não avaliado),
`agreed`, `agreement` (concordadas ÷ avaliadas), `wrong_to_right`,
`right_to_wrong`, `wrong_before` (linhas avaliadas que antes foram marcadas como `N`) e
`rounds_apart_wrong_before`. Ele imprime *"Linhas exibidas novamente: o falante
marcou A de J da mesma forma que antes (P%) — W antes erradas agora certas, R antes
certas agora erradas. Não contadas na proporção desta rodada e não utilizadas no
treino novamente."*

Combinadas ao longo das rodadas, assim que 10 ou mais forem avaliadas (`MIN_REPEATS`), o
relatório da rodada extrai duas informações delas:

- **Erro aleatório** `e`, a partir das inversões que ocorrem igualmente nos dois sentidos. Duas marcações de
  um mesmo rascunho discordam por acaso em 2e(1 − e) das vezes, metade em cada sentido; com
  d = 2 × min(`wrong_to_right`, `right_to_wrong`) ÷ `judged`,
  e = (1 − √(1 − 2d)) ÷ 2. O erro puxa toda proporção em direção a 50%: um rascunho verdadeiramente
  certo em uma proporção p das vezes é marcado como certo em e + p(1 − 2e) das vezes; assim,
  com e = 10%, "verdadeiramente 80% certo" resulta em cerca de 74%.
- **Desvio**: inversões em um sentido além das equivalentes. O relatório avisa que a
  marcação pode estar se tornando mais benevolente quando as inversões de antes-errado-agora-certo superam claramente
  o sentido oposto: 6 inversões ou mais e um teste de sinal,
  (`wrong_to_right` − inversões ÷ 2) ÷ √(inversões ÷ 4) > 1,96.

Sua linha de verificação: *"O falante marcou A de J linhas exibidas novamente da mesma forma que
antes (P%): cerca de E% das marcações vão no sentido oposto por acaso, o que puxa toda
proporção marcada como certa em direção a 50% — a projeção leva isso em conta."* — e sobre
o desvio, *"E W rascunhos antes marcados como errados agora estão marcados como certos, contra R no
sentido oposto: a marcação pode estar se tornando mais benevolente, algo que um aumento na proporção
não mostraria."* Com menos de 10 avaliadas: *"N linhas exibidas novamente avaliadas até agora — o
erro de marcação do próprio falante é estimado a partir de 10."*

**Para onde as rodadas apontam.** A projeção do relatório da rodada é feita somente a partir do
progresso real (acima) enquanto a proporção de acertos estiver abaixo de 80%. As curvas de aprendizado
sobem em passos aproximadamente uniformes em log-odds a cada duplicação dos dados de treino, portanto
ele obtém o passo a partir das mesmas verificações cegas após promoções: a soma de
`logit(in_use_share) − logit(other_share)` sobre a soma de
`log2(in_use_pairs ÷ other_pairs)` (proporções limitadas a 1–99%), com um intervalo de 95%
a partir da variância de cada proporção, cerca de 1 ÷ (n·p·(1 − p)) para n rascunhos
avaliados. A partir dos pares de treino do modelo em uso, ele indica quantos mais são necessários para atingir
80% marcados como certos — a estimativa — e as horas do falante a 70 segundos por
frase. O intervalo cobre o intervalo do passo (sem limite superior além de mais seis
duplicações) e, assim que 10 linhas exibidas novamente forem avaliadas, onde "verdadeiramente certo em
80%" pode se situar nas marcações deste falante: e + 0,8(1 − 2e) + 0,2 × K, no máximo
97%, onde K é o desvio por rodada (inversões além das equivalentes, dividido por
quantas rodadas de distância estavam as duas marcações das linhas antes erradas) multiplicado pelas rodadas
entre a primeira e a última marcação, limitado a ±30%. O mínimo é o menor dos dois alvos no limite
superior do passo, o máximo é o maior no limite inferior; um mínimo de 0 é exibido como
"nenhum". O texto então acrescenta *"A marcação do próprio falante: ele marcou A de J
linhas exibidas novamente da mesma forma que antes (P%), portanto cerca de E% das marcações vão no
sentido oposto por acaso … rascunhos verdadeiramente certos em 80% podem ser marcados como certos cerca de T%
das vezes em suas marcações — o intervalo leva isso em conta."* (com, quando K for
1% ou mais para qualquer lado, com que frequência a mais ou a menos rascunhos antes marcados como errados
agora são marcados como certos); antes disso, *"(O próprio erro de marcação do falante ainda não é
levado em conta: poucas linhas exibidas novamente foram avaliadas.)"* O `report.json`
traz os números como `projection_numbers` (`more_sentences`, `range`,
`speaker_hours`).

Em simulação — um falante com ruído, a própria divisão de desenvolvimento dos trilhos e estas regras
de veredito, 200 testes por cenário em dois conjuntos de sementes —, a estimativa ficou
dentro de um fator de 2 da contagem real em 69–78% das vezes com 400 novas
frases por rodada e 53–56% com 800, e a contagem real ficou dentro do
intervalo em 89–94% e 76–80% das vezes (sem repetições, 91–93% e 51–54%).
Ajustar a própria estimativa para as marcações do falante ajudou a 800 por rodada e
prejudicou a 400 (dentro de um fator de 2: 64% e 19%), por isso ela é mantida nos
80% simples. Uma observação de que o modelo "pode já estar funcionando" foi testada e descartada:
ela errava de 2 a 3 vezes para cada vez que acertava. Uma estimativa aproximada, declarada como tal.

## O que os números não dizem

- Uma pontuação reflete o sistema naquele conjunto, não uma frase específica: não existe
  confiança por frase.
- O chrF++ mede a sobreposição com uma referência. Uma boa tradução formulada de
  forma diferente pode ter pontuação baixa; uma tradução fluente, porém errada, pode ter pontuação razoavelmente alta.
- A aceitação por FST indica que as palavras existem, não que a frase tem o significado correto.
- As linhas da tabela de classificação pública são autodeclaradas por padrão; o verificador
  repontua as saídas enviadas em relação ao corpus fixado por hash (com margem de 1,0
  chrF++) e não reexecuta métodos.

## Como relatar um número

Todo número traz **sua unidade, o que ele mede e o conjunto no qual foi
medido** — com o tamanho do conjunto e o intervalo, quando houver.

| Diga | Nunca |
|---|---|
| "chrF++ de 24,1 em 100 nas 50 frases de prática (dev), intervalo de 20,6–27,6" | "24,1" · "24% de precisão" |
| "o falante marcou 9 de 24 novos rascunhos como corretos — 38% (21%–57%)" | "38% de precisão" |
| "nenhuma mudança mensurável: em 50 frases de dev, só aparece uma diferença de cerca de 5,8 pontos" | "melhorou um pouco" |
| "frases de prática insuficientes para dizer ainda: com menos de 50, nenhuma comparação decide — as marcações cegas do falante decidirão" | "nenhuma mudança" para um veredito **too-few** |
| "nas 50 frases de teste bloqueadas, uma vez, comparado à previsão que você escreveu: '…'" (as palavras deles, lidas de volta) | uma pontuação de teste sem conjunto ou previsão |
| "às cegas, em frases novas, o falante marcou o modelo mais novo como correto em 7 de 12 e o modelo em uso em 5 de 12 — sem diferença evidente em 24 frases" | "o novo modelo é melhor" baseado apenas nas marcações |
| "chrF++ 31,0 com gates (o que entra em produção), 33,5 sem gates, 12% recusado pelos gates" | apenas a pontuação com gates |

- Um intervalo indica a certeza das ferramentas, não dois resultados diferentes.
- Duas pontuações em conjuntos diferentes não são comparáveis. Duas pontuações no mesmo conjunto
  só diferem quando o teste pareado confirma.
- Cite ressalvas e avisos palavra por palavra.
- Nunca chame uma pontuação de boa ou ruim; nunca use palavras de qualidade. Um falante
  fluente decide o que está apto para uso.

## Aprofunde-se

- [A especificação de pontuação](/docs/network/specifications/scoring) e
  [significância](/docs/network/specifications/significance).
- [O card de execução](/docs/network/specifications/run-card) — o que uma execução pontuada
  registra.
- [Confiabilidade das métricas](/docs/network/specifications/metric-reliability) —
  qual métrica foi verificada em relação a julgamentos humanos para quais idiomas.
- [Os limites técnicos](/docs/network/honest-limitations).
- [As salvaguardas](/docs/guardrails) — a versão para as pessoas.
