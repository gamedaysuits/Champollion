---
title: "Limites técnicos"
description: "O que o Champollion (ainda) não afirma, declarado com precisão: os limites da validação morfológica, níveis de confiança autodeclarados, validação por falantes, custódia de testes selados e por que nenhuma confiança por frase é fornecida."
---

# Limites técnicos

> **Novo por aqui?** [O que ele ainda não faz](/docs/what-it-cant-do-yet) explica as
> mesmas coisas em palavras simples. Esta página é a versão precisa, voltada a
> desenvolvedores, pesquisadores e agentes.

Estas são as afirmações que **não** ultrapassaremos. Se qualquer outra parte deste
site sugerir algo além do que está escrito aqui, trate isso como um bug e
[nos avise](/docs/network/perspectives/reporting-errors-and-owning-corrections).

A infraestrutura de avaliação só ganha confiança sendo honesta sobre seus
limites. Aqui estão os nossos, declarados de forma clara o suficiente para
verificar.

## 1. A validação morfológica profunda depende de um FST *e* de um conjunto de testes classificável

A validação morfológica baseada em FST — verificar se cada palavra de saída é uma
palavra bem-formada no idioma de destino — necessita de duas coisas para um par de
idiomas: um FST fixado pelo harness e um conjunto de avaliação para o par que
possa gerar rankings. O próprio `GiellaLTFSTMetric` é **genérico**: ele pontua qualquer
idioma com um FST GiellaLT fixado (cree das planícies, as línguas sámi,
finlandês, norueguês bokmål, inuktitut e outros). Vários desses idiomas
possuem conjuntos de avaliação abertos (Tatoeba, WMT, WMT24++) — a
[página de conjuntos de dados](/docs/network/leaderboard/datasets) lista o catálogo,
`mt-eval corpora --source eng --target <code>` lista o que pode ser executado para um par,
e `mt-eval corpora --with-fst` lista apenas os pares cujo destino possui um
FST fixado, informando se ele está instalado na sua máquina.
O cree das planícies, idioma com o qual o trabalho de FST começou, é a exceção: seus
dois conjuntos de avaliação (EdTeKLA) estão catalogados como rótulos em quarentena, e o
banco de dados recusa qualquer pontuação enviada para eles.

Dois limites adicionais se aplicam. Onde o FST fixado é apenas um **aceitador** de
verificação ortográfica (sámi setentrional, amárico, basco), ele indica se uma palavra existe,
mas não se está flexionada corretamente, de modo que `morphological_accuracy` não é
calculado — e um aceitador aceita algumas palavras em inglês e com iniciais maiúsculas,
portanto a aceitação por FST pode creditar saídas não traduzidas (o cartão da execução exibe,
então, uma ressalva de cópia da origem; consulte [ressalvas de pontuação](/docs/network/specifications/scoring#2-8-score-caveats)). A aceitação por FST é um diagnóstico: ela nunca entra na pontuação principal do chrF++ nem classifica uma execução.
Ela também credita uma única frase válida repetida para cada entrada; o cartão da execução
exibe, então, uma ressalva de saída quase constante.
E todo par sem um FST é pontuado com métricas de superfície (chrF++, BLEU)
e verificações comportamentais. Esses são sinais úteis, mas **não**
garantem validade morfológica. Não reivindicamos validação morfológica
para nenhum idioma sem um FST e um conjunto de avaliação capaz de gerar ranking.

## 2. Níveis de confiança: hoje, cada linha é autorrelatada {#2-trust-tiers-are-self-reported-at-launch}

A maioria das pontuações é calculada pelos próprios colaboradores, que executam o harness e
publicam o resultado. A **verificação** — recalcular a pontuação de uma submissão a partir de suas
próprias saídas contra o corpus canônico fixado por SHA — já está implementada, mas é um
comando de mantenedor executado manualmente: nada o executa no momento da submissão e nada
o agenda; portanto, hoje toda linha chega, e permanece, autoavaliada
([Regras de submissão](/docs/network/leaderboard/rules#verification-tiers)). Leia
o selo de confiança em cada linha: **"autorrelatado" significa exatamente isso**, e é
o padrão.

## 3. A validação por falantes da comunidade ainda não aconteceu

O prêmio proposto exige **≥ 70% de aceitação de falantes bilíngues** (nenhum prêmio está aberto). Esse critério está
especificado, e as ferramentas para executá-lo estão em construção — mas **nenhuma revisão por falantes da comunidade
foi realizada**, e **nenhuma pontuação neste site passou pelo critério dos falantes**.
O chrF++ e qualquer outro número automático são sinais da máquina,
não um veredito da comunidade, e é por isso que nenhuma pontuação aqui carrega um selo de qualidade.

## 4. O sandbox de avaliação e a cerimônia de chaves existem; nenhum custodiante os utilizou

Buscamos corpora de sua fonte e os fixamos por SHA, e divisões retidas (held-out) são
seladas. Quando uma comunidade possui um conjunto de teste secreto, um método pode ser avaliado
em relação a ele sem que o conjunto saia das mãos dela — e essa avaliação
agora tem **duas vias**. A
preferencial, para modelos neurais padrão, é **declarativa**: o participante
envia apenas dados — pesos safetensors + um tokenizador declarativo + uma configuração —
e o organizador o executa em seu próprio mecanismo de inferência confiável
(`trust_remote_code=False`, offline; permissivo quanto à arquitetura porque
a segurança está no formato sem código, não no nome da arquitetura). Nenhum código do participante é executado,
portanto não há nada para isolar em sandbox; a verificação de segurança é uma validação de formato
decidível (isto é safetensors e não um pickle? nenhum `trust_remote_code`?), e não
uma tentativa de provar que código arbitrário é seguro. Para métodos que genuinamente são código
(pipelines, híbridos orientados por LLM), a alternativa é a **sandbox** isolada
da rede (verificações estáticas, contêineres `--network=none`, saída restrita apenas a pontuações,
transporte de arquivos opcional com airgap real). Como a sandbox não tem rede, um
método só roda lá contendo todos os modelos que ele chama dentro de seu pacote: um
híbrido orientado por LLM deve enviar seu LLM como pesos abertos, já que uma API de LLM hospedada
não pode ser acessada. A sandbox contém código não confiável em vez
de recusar sua execução, sendo portanto a via comprovadamente mais frágil — sua garantia
estrutural é `--network=none` (uma verificação estática heurística não consegue validar um modelo
binário), e um endurecimento mais profundo (seccomp, microVMs) foi adiado. Consulte
[executar uma competição soberana](/docs/network/sovereignty/run-a-sovereign-contest)
para saber exatamente o que está ativo e o que não está. A **cerimônia de chaves** do nó offline
**está construída** — a chave do conjunto é dividida em M-de-N e remontada apenas na memória durante uma
execução autorizada por quórum —, mas ela nunca foi usada com um custodiante real, e
as partes (shares) são arquivos simples nesta primeira versão. O que **não** está construído: assinatura
por limiar (uma pontuação é assinada pela chave de um único nó) e atestação de hardware (manifestos de
pontuação são assinados apenas em software). Nenhum custodiante de chaves comunitário foi
nomeado, portanto a avaliação de **prêmio** padrão ouro permanece fechada até que
os custodiantes e o consentimento da comunidade estejam estabelecidos.

## 5. Hoje as chaves ficam com os organizadores; nenhum custodiante comunitário foi nomeado {#5-key-custody-is-designed-no-custodians-are-appointed-yet}

**Hoje, as chaves de um conjunto selado ficam com seu organizador** — quem quer que o tenha selado,
em sua própria máquina. **O Champollion não retém frações de chaves.** O *mecanismo*
de custódia para mais de um detentor está construído: a cerimônia de chaves M-de-N do nó
offline divide a chave de um conjunto entre custodiantes. Ela ainda não foi executada com
custodiantes reais. Os custodiantes são escolhidos pelas próprias comunidades, e nenhum
foi nomeado: **custodiantes comunitários de chaves — nenhum nomeado até o momento.** Custódia
não é consentimento: o processo relacional de consentimento comunitário é uma trilha própria, mais
lenta e mais importante.

## 6. Medimos métodos em benchmarks; não pontuamos traduções individuais {#system-vs-output}

Duas coisas diferentes são chamadas de "tradução automática confiável". Nós fazemos uma
delas.

**Nível de sistema — o que fazemos.** Dado um par de idiomas, um conjunto de testes e um método:
qual é a pontuação desse método, sob qual métrica, em qual domínio, em qual
trilha de contaminação, em qual nível de confiança? Trata-se de uma afirmação sobre um *método em um
benchmark*, além de uma afirmação sobre quem definiu o critério. As regras de pontuação são
publicadas, os corpora têm versões fixadas e, para um benchmark soberano, a comunidade
proprietária do conjunto de testes decide o que é aprovado. A tabela de classificação, o mapa, os
cartões de execução e `mt-eval` são todos isso, e apenas isso.

**Nível de saída — o que não fazemos.** Dada uma frase de origem e uma
tradução dela: qual é a probabilidade de *essa* tradução estar correta? Em TA e PLN,
isso é estimativa de qualidade e quantificação de incerteza, e constitui um campo de pesquisa
próprio. Não publicamos **nenhuma confiança por segmento em nenhuma tradução**,
e nada aqui é uma probabilidade calibrada de que uma determinada saída esteja correta. Uma
linha com pontuação alta não é uma garantia sobre a próxima frase gerada por um método.

O inverso é o erro mais comum, e se aplica a nós também. Quando uma interface aqui diz
que nenhum método para um par pontua bem o suficiente para ser implantado — como faz a página de
[serviços de tradução humana](/human-services) —, essa é uma declaração sobre
métodos medidos em conjuntos de testes medidos. É um bom motivo para não disponibilizar
saídas geradas por máquina para esse par. Não é um veredito sobre nenhuma frase em particular.

**A estimativa de qualidade é um espaço aberto, não uma lacuna oculta.** O harness já
calcula uma pontuação neural sem referência, o AfriCOMET-QE (`qe_score`), como
sinal de adequação para execuções sem referência padrão-ouro. Ela é informada como um
valor em **nível de corpus** na trilha neural separada, é recalculada pelo
verificador e nunca entra no resultado de destaque do chrF++
([Especificação de pontuação](/docs/network/specifications/scoring#how-runs-are-scored)). As métricas são
plugins ([Especificação de plugins](/docs/reference/plugin-spec)), portanto uma métrica de QE em
nível de segmento é algo que este harness pode receber. Até que uma seja conectada,
publicada e meta-avaliada por idioma da mesma forma que as métricas baseadas em referência
([Confiabilidade das métricas](/docs/network/specifications/metric-reliability)), não
afirmamos nada sobre saídas individuais.

---

Esses limites se moverão conforme o trabalho avança. Quando um deles mudar, esta
página muda com ele — e a mudança deve ser visível no histórico da página, não
silenciosamente descartada.
