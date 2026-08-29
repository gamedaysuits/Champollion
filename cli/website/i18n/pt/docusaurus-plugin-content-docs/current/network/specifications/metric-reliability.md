---
sidebar_position: 6
title: "Especificação de Confiabilidade de Métricas"
slug: '/network/specifications/metric-reliability'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What each metric measures and how the harness computes it"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
---

# Especificação de Confiabilidade de Métrica

> **Resumo Executivo.** Uma pontuação de benchmark é tão significativa quanto a métrica por trás dela — e métricas automáticas não concordam com o julgamento humano igualmente bem em todos os idiomas. Este documento especifica como o Champollion mede **confiabilidade de métrica**: para cada família linguística, o quão fortemente cada métrica automática (BLEU, spBLEU, chrF, chrF++, COMET, MetricX) se correlaciona com julgamentos de qualidade humana, computados a partir dos arquivos da tarefa compartilhada WMT Metrics (2019–2025). O resultado é um artefato de evidência publicado e legível por máquina que o harness, a CLI e o servidor MCP consultam antes de apresentar qualquer pontuação como confiável. Até onde sabemos, nenhuma outra infraestrutura de avaliação publica essa evidência por idioma; é o que transforma "executamos uma métrica" em "aqui está o quanto confiar nela".
>
> **Escopo.** Este documento define *o que é a evidência de confiabilidade, de onde vem, exatamente como é computada e o que deliberadamente exclui*. As definições de métrica em si vivem na [Especificação de Pontuação](/docs/network/specifications/scoring); testes estatísticos de diferenças de pontuação vivem em [Significância](/docs/network/specifications/significance). O importador que regenera o artefato é `arena/scripts/import_wmt_metaeval.py` no repositório do harness — o código é a palavra final sobre detalhe de implementação, e está aberto para revisão.

---

## 1. O problema que isto resolve

A qualidade da tradução automática é, no final, um julgamento humano. Métricas automáticas existem porque avaliação humana é lenta e cara; toda pontuação automática é um *proxy* para o que um bilíngue competente diria. O atalho de todo o campo — "Sistema A vence Sistema B por 2 BLEU" — silenciosamente assume que o proxy é fiel.

Essa suposição foi testada por anos pela tarefa compartilhada WMT Metrics, mas quase sempre *em agregado*: métricas são classificadas por correlação média com julgamento humano em qualquer que seja os pares de idiomas que a campanha daquele ano cobriu — principalmente pares europeus de alto recurso mais chinês e japonês. O detalhe por idioma existe nos dados brutos e em artigos de descobertas por ano, mas não é publicado em lugar algum como uma camada de evidência consultável por família de idioma que um pipeline de avaliação possa consultar.

O detalhe importa enormemente para idiomas de baixo recurso e morfologicamente ricos. Duas descobertas de nossa própria importação ilustram as implicações (§7 tem a tabela completa):

- **English→Inuktitut (wmt20).** A correlação de nível de sistema do BLEU com julgamento humano é **+0.16** — essencialmente não informativo. chrF consegue +0.35. COMET atinge +0.86. Um leaderboard classificado por BLEU para este par estaria classificando ruído; o mesmo leaderboard classificado por COMET carrega sinal.
- **English→Maasai (wmt25).** A falha inversa: a correlação do MetricX-25 é **−0.09** — uma métrica *aprendida* de ponta gerando números não correlacionados com julgamento humano para um idioma ausente de seu treinamento, enquanto chrF++ computado (uma métrica de string "burra" sem dados de treinamento para carecer) consegue +0.50.

Nenhum modo de falha é visível em uma média global, e apontam em direções opostas: para um idioma a métrica aprendida é a única utilizável; para outro é a única *inutilizável*. Qualquer infraestrutura que pontua centenas de pares de idiomas com uma suite de métrica fixa — como o Champollion faz — deve aos seus usuários essa evidência.

## 2. Definições

As definições abaixo são o mínimo necessário para ler o resto do documento com precisão. Leitores familiarizados com avaliação de MT podem pular para §3.

**Métrica automática.** Uma função de (saída do sistema, tradução de referência, e às vezes a fonte) para um número. *Métricas de string* — BLEU, spBLEU, chrF, chrF++ — comparam sobreposição de superfície entre saída e referência. *Métricas aprendidas* — COMET, MetricX, BLEURT — são modelos neurais treinados em julgamentos humanos passados para prever qualidade. Identificadores canônicos para todas as métricas neste documento vêm do registro de métrica do Champollion (`shared/metric-registry.json`): `bleu`, `spbleu`, `chrf_plain`, `chrf_plus_plus`, `comet_score`, `metricx_score`.

**Protocolos de julgamento humano.** As campanhas WMT coletaram pontuações de qualidade humana sob vários protocolos, que este artefato mantém distintos:

- **DA (Avaliação Direta)** — trabalhadores de crowdsourcing ou pesquisadores classificam uma tradução 0–100. *DA normalizado por z* (escrito `wmt-z`) padroniza as pontuações de cada avaliador para média 0, variância 1, removendo efeitos de generosidade do avaliador.
- **DA+SQM** (`da-sqm`, `wmt`) — DA coletado em escala 0–100 anotado com descrições de âncora de métrica de qualidade escalar; usado a partir de WMT22.
- **MQM (Métricas de Qualidade Multidimensional)** (`mqm`) — anotadores profissionais marcam e classificam spans de erro individuais com severidades; a contagem de erro ponderada se torna uma pontuação de segmento. Lento, caro, e o sinal mais confiável disponível; coletado apenas para alguns pares de alto recurso por ano (as anotações originam de lançamentos `wmt-mqm-human-evaluation` do Google).
- **ESA (Anotação de Span de Erro)** (`esa`, `esa-merged`) — protocolo de WMT24 e WMT25 combinando marcação de span de erro com uma classificação escalar; mais barato que MQM, mais informativo que DA.

**Meta-avaliação.** Avaliando os avaliadores: medindo o quão bem as pontuações de cada métrica automática concordam com as pontuações humanas sobre as mesmas traduções. Concordância é medida em dois níveis:

- **Nível de sistema** (`sys`): cada sistema MT recebe uma pontuação humana agregada e uma pontuação de métrica agregada para um conjunto de teste; concordância é computada entre sistemas. Isto pergunta: *a métrica classifica sistemas inteiros da forma que humanos fazem?* — a pergunta que um leaderboard se importa.
- **Nível de segmento** (`seg`): concordância entre pares individuais (sistema, sentença). Isto pergunta: *a métrica consegue distinguir uma sentença boa de uma ruim?* — a pergunta que estimativa de qualidade e filtragem de dados se importam. É muito mais difícil, e correlações são sistematicamente mais baixas.

**Estatísticas de correlação.** Quatro estatísticas padrão, definidas aqui exatamente como computadas:

- **r de Pearson** — correlação linear entre os dois vetores de pontuação.
- **ρ de Spearman** — r de Pearson computado em ranks médios; mede concordância monotônica, insensível a escala.
- **τ-b de Kendall** — entre todos os pares de itens, o excesso (ajustado por empate) de pares ordenados concordantemente sobre pares ordenados discordantemente. Usamos a formulação padrão τ-b ajustada por empate (equivalente a `scipy.stats.kendalltau`; nossa implementação é livre de dependência e é verificada cruzada contra uma referência de força bruta na suite de testes).
- **Acurácia de classificação pairwise** (apenas nível de sistema) — de todos os pares de sistema que humanos ordenam *estritamente*, a fração que a métrica ordena da mesma forma, com um empate de métrica contado como falha em reproduzir a ordem. Esta é a estatística de acurácia de Kocmi et al. (2021), que campanhas WMT recentes usam como seu número de nível de sistema de manchete.

**Família linguística.** O agrupamento genealógico do *idioma alvo* (o idioma sendo traduzido), conforme registrado no banco de dados de idiomas do Champollion (`languages.family`, derivado de Glottolog). §5 discute por que o lado alvo, e o que uma família pode e não pode servir de proxy.

## 3. Dados

### 3.1 Fontes, fixadas

| Fonte | O que fornece | Fixação |
|---|---|---|
| `google-research/mt-metrics-eval` (arquivo de dados v2) | Pontuações humanas, pontuações de métrica, saídas de sistema, fontes e referências para cada conjunto de teste da tarefa WMT Metrics, wmt19–wmt25 | commit de código `68a481ae…`; tarball de dados `mt-metrics-eval-v2.tgz` de `data.statmt.org`, fixado **sha256 `6708eec9aaa8a9deca5e370bdd0e23db4881aeca129f29d5281575eaa66c7e10`**, ETag `36579a46-64ff8bb1d3080`, Last-Modified 2026-04-21, 911,710,790 bytes |
| `google/wmt-mqm-human-evaluation` | A origem upstream das anotações de especialista MQM que mt-metrics-eval redistribui em forma mesclada; Apache-2.0 | commit `7fadea28…` |

Dois fatos de integridade de dados moldam a disciplina de fixação. Primeiro, **o tarball de dados não é imutável** — é republicado no lugar conforme campanhas são adicionadas — então o artefato registra o checksum, ETag e timestamp da cópia exata de que os números foram computados, e o importador se recusa a executar sem um checksum. Segundo, a concessão Apache-2.0 do toolkit cobre seu *código*; **os dados de julgamento humano e conjunto de teste agrupados não carregam declaração de licença explícita**. Consequências disso estão em §8.

O conteúdo do arquivo (≈4.2 GB descompactado: julgamentos humanos, referências e saídas completas de sistema para cada campanha) são **nunca armazenados neste repositório ou redistribuídos pelo Champollion**. Eles são buscados da fonte para um cache local; apenas números de correlação derivados são publicados. Esta é a mesma postura de busca-da-fonte que cada benchmark do Champollion segue.

### 3.2 O que cada campanha contribui

| Conjunto de teste | Pares com julgamentos humanos | Protocolo(s) humano(s) usado(s) aqui |
|---|---|---|
| wmt19 | 18 | DA-z |
| wmt20 | 18 (incl. en→iu, en→ta, km→en, ps→en) | DA-z; MQM (en→de, zh→en) |
| wmt21.news | 16 (incl. en→ha, en→is) | DA-z; MQM (en→de, zh→en, en→ru) |
| wmt21.tedtalks | 3 | MQM |
| wmt21.flores | 4 (bn↔hi, xh↔zu) | DA-z |
| wmt22 | 17 (incl. en→liv, sah→ru, cs↔uk) | DA-SQM; MQM (en→de, zh→en, en→ru) |
| wmt23 | 9 (incl. he→en) | DA-SQM; MQM |
| wmt23.sent | 1 | MQM |
| wmt24 | 11 (incl. en→is, en→hi) | ESA; MQM |
| wmt25 | 16 (incl. en→bho, en→mas, en→ar) | ESA-merged; MQM |

**Excluído: wmt24pp.** O lançamento WMT24++ estende cobertura para 55 pares de idiomas mas envia *referências e saídas de sistema apenas* — sem julgamentos humanos — então nenhuma correlação pode ser computada a partir dele. Está listado no ledger de exclusão do artefato em vez de ser silenciosamente descartado.

## 4. Método

O importador percorre cada (conjunto de teste, par de idiomas) e computa uma **célula** por (lane de julgamento humano, nível, métrica):

1. **Descobrir lanes humanas.** Todos os arquivos de pontuação humana disponíveis para o par são combinados contra uma lista de permissão explícita (§4.1). Arquivos de nível de avaliador, arquivos de span de erro bruto e pontuações de nível de documento/domínio estão fora do escopo.
2. **Excluir "sistemas" humanos.** Arquivos de pontuação WMT incluem as próprias traduções de referência como sistemas pontuados (`refA`, `refb`, `HUMAN.0`…). Correlacionar uma métrica contra sua própria referência é sem sentido, então qualquer sistema correspondendo ao conjunto de referência do par ou aos prefixos `ref`/`human`/`synthetic` é excluído em todo lugar.
3. **Alinhar.** Nível de sistema: a interseção de sistemas tendo tanto uma pontuação humana quanto uma pontuação de métrica (valores faltantes são descartados, nunca coagidos a zero). Nível de segmento: cada (sistema, segmento) com ambas as pontuações, agrupadas entre sistemas sem agrupamento — este é o achatamento "sem média" do mt-metrics-eval. Arquivos irregulares (contagens de segmento desiguais) falham a célula em vez de alinhar aproximadamente.
4. **Computar.** Pearson, Spearman e Kendall τ-b em ambos os níveis; acurácia de classificação pairwise em nível de sistema. Células com menos de 3 sistemas alinhados (sys) ou menos de 10 pontos alinhados em pelo menos 2 sistemas (seg), ou com variância zero em qualquer lado, são registradas no ledger de exclusão como degeneradas (20 células na compilação atual).
5. **Agregar.** Por família de idioma alvo, por métrica, por nível: a média ponderada por n de cada estatística entre as células *preferidas* (§4.1), com a lista de (conjunto de teste, par) contribuinte retida para que qualquer agregado possa ser decomposto de volta para suas entradas.

### 4.1 Preferência de lane humana

Onde um par tem várias lanes de julgamento humano, todas são computadas, mas exatamente uma é sinalizada **preferida** e apenas células preferidas entram na agregação de família — caso contrário um par julgado sob MQM e DA contaria duas vezes. A ordem de preferência é por qualidade de sinal:

```
mqm > esa-merged > esa > da-sqm > wmt-z > wmt-appraise-z > wmt-appraise > wmt > wmt-raw
```

Anotação de erro de especialista (MQM) supera protocolos de span de erro (ESA), que superam avaliação direta escalar; dentro de DA, lanes normalizadas por z superam as brutas. As células não preferidas permanecem no artefato para qualquer um que queira estudar efeitos de protocolo.

### 4.2 Identidade de métrica e versionamento

Métricas aprendidas mudam ano a ano (COMET-20, COMET-22, MetricX-23/24/25 são modelos diferentes), e tratá-las como uma métrica boraria exatamente a distinção que meta-avaliação existe para desenhar. Cada célula portanto registra o **nome de pontuação upstream verbatim** (`COMET-22`, `MetricX-25-Ref`, `metricx_xxl_MQM_2020`…) ao lado do id de registro canônico, e o artefato lista quais nomes upstream alimentaram cada id. Onde uma campanha pontuou uma métrica contra várias referências, o stream de referência usado também é registrado por célula.

Pontuações são usadas exatamente como o arquivo as distribui (todas as lanes melhor-é-melhor; pontuações de erro MQM e MetricX são armazenadas negadas upstream). Nenhuma inversão de sinal ou rescalonamento é aplicado; correlações são invariantes à escala e a convenção de orientação foi verificada empiricamente antes da importação.

### 4.3 A lane chrF++ computada

chrF++ — a métrica de string primária do harness — foi apenas submetida à campanha wmt20, então pontuações upstream existem para um ano. Para cada outro conjunto de teste o importador computa chrF++ em si (sacreBLEU, `word_order=2`) das saídas de sistema em cache contra a referência registrada. Essas células são sinalizadas `computed: true` e seu nome upstream diz assim: uma pontuação computada por Champollion nunca é apresentada como uma submissão WMT. Todas as outras células de métrica são valores upstream verbatim; a única coisa que Champollion adiciona a elas é a aritmética de correlação.

## 5. Escolhas de design, alternativas e fundamentação

Estas são as decisões que um revisor deve interrogar. Cada lista o que foi escolhido, o que não foi, e por quê.

**Chaveado por família de idioma alvo.** *Escolhido:* agregar pela família do idioma sendo traduzido *para*. *Alternativas:* apenas por par (sem agregação); tipologia de lado de fonte ou nível de par; vetores de características tipológicas em vez de genealogia. *Fundamentação:* confiabilidade de métrica é dominada por o quão difícil o *idioma de saída* é de pontuar — riqueza morfológica infla desajuste de superfície para métricas de string, e escassez de dados de treinamento degrada métricas aprendidas — ambas propriedades do alvo. Família é uma chave crua mas universalmente disponível (cada idioma no banco de dados do Champollion tem uma); características tipológicas seriam mais refinadas mas estão faltando ou contestadas para exatamente os idiomas de baixo recurso que isto existe para. As células por par são retidas em cheio, então re-agregações mais refinadas (por gênero, por tipo morfológico) podem ser construídas do artefato sem re-importar.

**Correlação de nível de segmento achatada.** *Escolhido:* Kendall τ-b sobre o vetor (sistema, segmento) agrupado. *Alternativas:* acurácia pairwise agrupada por item com calibração de empate (o acc*-eq de descobertas WMT recentes); τ por segmento média entre segmentos. *Fundamentação:* a estatística achatada é a escolha mais simples defensável, é exatamente reproduzível de sua definição sem um procedimento de calibração de empate, e preserva a comparabilidade entre idiomas que este artefato precisa. Não é a estatística de manchete WMT mais nova, e §8 lista isto como uma limitação em vez de fingir equivalência.

**Empates de métrica contam contra a métrica** em acurácia pairwise. Uma métrica que não consegue separar dois sistemas que humanos separam falhou em reproduzir a ordenação humana; dar crédito parcial recompensaria quantização de pontuação.

**Médias ponderadas na agregação.** Agregados de família pesam cada célula por seu tamanho de amostra (sistemas em nível sys, pontos em nível seg), então um par MQM de 17 sistemas conta mais que um par DA de 6 sistemas. Os valores por célula não ponderados permanecem disponíveis.

**Limiares.** Células precisam de ≥3 sistemas alinhados (uma correlação sobre 2 pontos é sem sentido) ou ≥10 pontos de segmento alinhados sobre ≥2 sistemas. Estes são pisos contra aritmética degenerada, não afirmações de significância — §8.

**Disciplina verbatim-upstream.** Champollion re-computa nada que possa citar (exceto a lane chrF++ sinalizada), porque métricas aprendidas re-pontuadas introduziriam versão e desvio de ambiente que os nomes upstream por célula existem para prevenir. O trade-off — lacunas de cobertura onde uma campanha não executou uma métrica — é visível como células faltantes em vez de ser encobertas.

**Exclusões fail-honest.** Tudo pulado (um conjunto de teste sem julgamentos humanos, um código de idioma irresolvível, uma célula degenerada) é escrito para um ledger de exclusão com uma razão. Um leitor do artefato pode enumerar o que *não* está nele — a propriedade que a maioria dos relatórios agregados carecem.

## 6. O artefato publicado

A evidência envia como um arquivo JSON legível por máquina, rastreado no monorepo (deliberadamente não agrupado nos pacotes npm/PyPI):

```
shared/catalogue/metric-reliability.json    # the artifact (≈0.6 MB)
shared/schemas/metric-reliability.schema.json  # its JSON-Schema contract
```

Compilação atual: **1.810 células** (1.052 preferidas) sobre **57 pares de idiomas**, **10 conjuntos de teste**, **11 famílias alvo**, com 21 exclusões de ledger. Blocos de nível superior: `sources` e `provenance` fixados (cada valor derivado carrega proveniência `champollion-derived` nomeando os upstreams — as correlações são nossas, os julgamentos não são); `correlation_definitions` (as definições de estatística exata de §2); `metrics` (id de registro ↔ nomes upstream); `languages` (código → família/gênero); `families` (a agregação); `cells` (cada correlação, totalmente atribuída); `excluded` (o ledger).

Três superfícies de consumidor o leem hoje:

- **Harness CLI:** `mt-eval recommend SRC TGT` renderiza um bloco "confiança de métrica para o alvo" ao lado de disponibilidade de método e resultados citados.
- **Champollion CLI:** `champollion recommend SRC TGT` (mesmo contrato de payload; o artefato é rastreado em monorepo, então instalações empacotadas degradam para uma nota explícita "índice não disponível").
- **Servidor MCP:** a ferramenta `get_metric_reliability` responde "qual métrica devo confiar para o idioma X?" para qualquer agente AI conectado, incluindo uma resposta explícita UNMEASURED para idiomas que nenhuma campanha WMT julgou.

## 7. Visão geral de resultados

Correlação de Pearson de nível de sistema com a lane humana preferida, média ponderada por família de idioma alvo (compilação atual; números de nível de segmento, Spearman, τ-b e acurácia pairwise estão no artefato):

| Família alvo | Pares | BLEU | spBLEU | chrF | chrF++ | COMET | MetricX |
|---|---|---|---|---|---|---|---|
| Afro-Asiática | 2 | +0.88 | +0.95 | +0.85 | +0.87 | +0.67 | **−0.62** |
| Dravídica | 1 | +0.88 | — | +0.94 | +0.93 | +0.94 | — |
| Esquimó-Aleuta | 1 | **+0.16** | — | +0.35 | +0.33 | **+0.86** | — |
| Indo-Europeia | 42 | +0.75 | +0.76 | +0.79 | +0.76 | +0.81 | +0.84 |
| Japônica | 1 | +0.52 | +0.89 | +0.93 | +0.84 | +0.73 | +0.74 |
| Coreânica | 1 | +0.89 | +0.87 | +0.87 | +0.88 | +0.55 | +0.77 |
| Níger-Congo | 2 | +0.94 | — | +1.00 | +1.00 | +1.00 | — |
| Nilótica | 1 | — | — | — | +0.50 | — | **−0.09** |
| Sino-Tibetana | 2 | +0.49 | +0.68 | +0.68 | +0.62 | +0.72 | +0.82 |
| Túrquica | 1 | +0.85 | — | +0.97 | +0.97 | — | — |
| Urálica | 3 | +0.85 | +0.88 | +0.91 | +0.91 | +0.75 | +0.81 |

Como ler isto — e como não ler:

- **O padrão amplo corresponde aos achados agregados do campo.** No bulk Indo-Europeu de 42 pares, métricas aprendidas lideram (MetricX +0.84, COMET +0.81) com chrF atrás e BLEU por último — o resultado WMT padrão, reproduzido aqui de dados brutos como uma âncora de sanidade.
- **Os desvios por família são o payload.** Para Inuktitut polissintético, métricas de string colapsam e COMET é o único sinal utilizável. Para Maasai e para English→Arabic em wmt25, MetricX se correlaciona *negativamente* enquanto métricas de string permanecem utilizáveis — uma métrica aprendida extrapolando além de sua distribuição de treinamento falha silenciosamente, com pontuações confiantes. Estes são precisamente os casos que uma média global apaga.
- **Famílias de par único são evidência, não conclusões.** Oito de onze famílias repousam em um ou dois pares de uma única campanha. A leitura honesta de "Esquimó-Aleuta: BLEU +0.16" é *"na única campanha onde humanos julgaram en→iu, BLEU era não informativo"* — uma medição documentada, uma bandeira vermelha, e uma razão para coletar mais, não uma lei sobre a família.
- **Uma célula negativa não significa que a métrica está quebrada em todo lugar.** Significa: naquele par, no pool de sistema daquela campanha, a métrica ordenou sistemas contra julgamento humano. Restrição de alcance (veja §8) pode deprimir qualquer correlação quando sistemas se agrupam firmemente em qualidade.

## 8. Limitações

Dito claramente, porque o valor do artefato é sua honestidade:

1. **Família é um proxy, não um mecanismo.** Família genealógica se correlaciona com, mas não determina, as propriedades morfológicas que dirigem comportamento de métrica. As células por par (com gênero registrado por idioma) permitem fatiamento mais fino; a chave de família é um padrão consultável, não uma afirmação de causalidade tipológica.
2. **Cobertura é o que WMT julgou, não o que o mundo fala.** 57 pares, pesadamente ponderados para Europa; cada par xx→English se agrupa em Indo-Europeu; famílias macro inteiras (Algonquiana, Austronésia, Quechua, …) têm *nenhuma cobertura de julgamento humano em absoluto*. Para aquelas, as superfícies do Champollion respondem UNMEASURED em vez de emprestar o número de um vizinho. O próprio programa de benchmark soberano do Champollion — conjuntos de teste controlados por comunidade com validação de falante nativo — é a correção de longo prazo para exatamente essa lacuna.
3. **Transferência dentro de família é uma suposição.** Quando um idioma consultado nunca foi diretamente julgado, evidência de nível de família vem de *outros* idiomas na família, e cada superfície consumidora diz assim explicitamente.
4. **Sem intervalos de confiança ainda.** Células carregam tamanhos de amostra mas não intervalos bootstrap; agregados de família de par único especialmente devem ser lidos com as larguras que §7 implica. Adicionar CIs bootstrap por célula (o harness já tem a maquinaria para CIs de pontuação) é trabalho planejado.
5. **Restrição de alcance.** Correlações são computadas sobre os sistemas submetidos de cada campanha. Campanhas recentes agrupam muitos sistemas fortes firmemente juntos, o que deprime correlações para todas as métricas — parte de por que células derivadas de wmt25 (Maasai, Árabe) mostram valores extremos. A atribuição por testset em cada célula mantém isto inspecionável.
6. **Escolha de estatística de nível de segmento.** O τ-b achatado é simples e reproduzível mas não é a acurácia agrupada calibrada por empate dos artigos de descobertas WMT mais recentes; números aqui não devem ser comparados dígito-por-dígito contra essas publicações.
7. **Licença de dados.** Os dados de julgamento humano upstream não carregam declaração de licença explícita (§3.1). Champollion não redistribui nenhum deles, publica apenas estatísticas derivadas com atribuição completa, e mantém este artefato em uma **lane de evidência não comercial** (`license_lane.commercial_ok: false`) até que a postura seja resolvida. As lanes MQM adicionalmente rastreiam para lançamentos de anotação Apache-2.0 do Google.
8. **O arquivo é um alvo em movimento.** Novas campanhas são adicionadas ao mesmo URL de tarball. Os pinos identificam nosso snapshot exatamente; regeneração contra um snapshot mais novo é uma nova versão de artefato com novos pinos, nunca uma atualização silenciosa.

## 9. Reprodução

O artefato é regenerável da fonte por qualquer um:

```bash
# 1. Fetch the archive (912 MB compressed; NOT immutable — keep the pins)
mkdir -p ~/.mt-eval/mt-metrics-eval && cd ~/.mt-eval/mt-metrics-eval
curl -sSL -D mt-metrics-eval-v2.headers -o mt-metrics-eval-v2.tgz \
     https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz
shasum -a 256 mt-metrics-eval-v2.tgz > mt-metrics-eval-v2.sha256
tar xzf mt-metrics-eval-v2.tgz

# 2. Regenerate (refuses to run without a checksum pin)
python3 arena/scripts/import_wmt_metaeval.py
```

Note que o próprio README do arquivo aponta para uma URL storage.googleapis.com aposentada; `data.statmt.org` é o host ao vivo. O importador é biblioteca padrão Python pura (sacreBLEU apenas para a lane chrF++ computada); suas implementações de correlação são verificadas cruzadas contra referências de força bruta em `arena/tests/test_wmt_metaeval.py`, e o contrato estrutural do artefato é reforçado por seu schema JSON mais testes de integridade em ambos os runtimes.

## 10. Créditos e citação

Os julgamentos humanos resumidos aqui são o trabalho dos **organizadores e anotadores da tarefa compartilhada WMT Metrics** — incluindo Markus Freitag, Nitika Mathur, Tom Kocmi, e muitos colaboradores entre as campanhas 2019–2025 — e do **programa de anotação MQM do Google** (Freitag et al., *Experts, Errors, and Context*, TACL 2021; `google/wmt-mqm-human-evaluation`). O arquivo e toolkit são mantidos como `google-research/mt-metrics-eval`. Acurácia de classificação pairwise segue Kocmi, Federmann et al. (2021), *To Ship or Not to Ship*. A contribuição do Champollion é a organização por família de idioma por linguagem, a computação de correlação, e a estrutura de honestidade ao redor — cada número no artefato carrega proveniência `champollion-derived` nomeando o upstream de que deriva, e nenhum de seu texto, julgamentos ou pontuações é redistribuído.

Ao citar números de confiabilidade deste artefato, cite tanto a(s) campanha(s) WMT que as células atribuem quanto a versão do artefato do Champollion (o bloco `sources` carrega os pinos de dados exatos), e respeite a lane de evidência não comercial descrita em §8.
