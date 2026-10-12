---
sidebar_position: 5
title: "Especificação de Pontuação"
slug: '/network/specifications/scoring'
related:
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
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# Especificação de Pontuação

> **Resumo executivo.** Esta é a fonte única da verdade sobre como as execuções são pontuadas no ecossistema de avaliação de TA do Champollion: a métrica principal de destaque, as outras métricas padrão informadas ao lado dela, os diagnósticos informados separadamente, e o custo e a velocidade. As execuções são pontuadas da forma como a área as pontua: **chrF++ a nível de corpus com sua assinatura sacreBLEU e um intervalo de confiança bootstrap de 95%**, BLEU, spBLEU, TER e COMET ao lado dele, e testes de significância pareados para decidir se um sistema é melhor do que outro. Os diagnósticos específicos do idioma (validade morfológica por FST, classes de equivalência do linter, validação semântica determinística) são coletivamente chamados de **LYSS** (Linguistically-informed Yield & Structural Scoring). O composto ponderado e os rótulos de nível de qualidade usados anteriormente foram **descontinuados** (§4, §5); suas tabelas permanecem aqui apenas para que cards antigos ainda possam ser verificados. O código, a documentação e os esquemas de banco de dados derivam deste documento. Em caso de conflito, este documento é a autoridade máxima.
>
> **Escopo.** Este documento define *o que* medimos e *como pontuamos*. Ele não define o esquema do card de execução (consulte BENCHMARK_SPEC §3), o protocolo de benchmark (BENCHMARK_SPEC §6) ou as regras do leaderboard (consulte a documentação da arena). Esses documentos fazem referência a este para definições de métricas e lógica de pontuação.


---

## Como as execuções são pontuadas {#how-runs-are-scored}

Toda nova execução é pontuada sob o **padrão de pontuação `standard/1`**. O card de execução especifica isso: `scores.scoring_standard` é `"standard/1"` e `scores.primary_metric` é `"chrf_plus_plus"`.

| Papel | O que é | Onde aparece |
|------|------|------------------|
| **Métrica principal e de classificação** | **chrF++** a nível de corpus (chrF do sacreBLEU com `word_order=2`), 0–100, com seu intervalo de confiança bootstrap de 95% e sua assinatura sacreBLEU | Escrito como `chrF++ 47.5 [45.9, 49.0]`, seguido pela assinatura. Card de execução: `scores.chrf_plus_plus`, o IC em `scores.confidence_intervals.corpus_chrf`, a assinatura em `scores.sacrebleu_signatures.chrf`. Banco de dados: `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **Outras métricas padrão** | BLEU, spBLEU (FLORES-200 SentencePiece), TER e COMET quando calculado | Exibidos ao lado do chrF++, cada um com sua assinatura ou id de modelo do COMET. Nunca misturados com o chrF++ ou entre si. |
| **Diagnósticos** | Correspondência exata, aceitação por FST, precisão morfológica, code-switching, alucinação, aderência à terminologia, estilo de escrita e todas as ressalvas de pontuação (§2.8) | Informados separadamente e rotulados como diagnósticos. Eles nunca entram em um número de destaque e nunca classificam uma execução. Ressalvas permanecem em destaque ao lado do valor principal. |
| **Custo e velocidade** | Tokens, dólares, latência (§6, §7) | Informados ao lado da pontuação, nunca combinados a ela. |

**Decidindo o que é "melhor".** Duas execuções no mesmo conjunto de avaliação são comparadas com um teste de significância pareado sobre o chrF++ (randomização aproximada por padrão, reamostragem pareada por bootstrap como opção; §8.2). As outras métricas padrão também são testadas e exibidas. Uma diferença que não seja significativa é informada como não significativa, quaisquer que sejam os dois números.

**Sem rótulos de qualidade.** Uma pontuação automática não é um veredito de qualidade. Cards novos não contêm níveis (tiers) nem rótulos como "funcional" ou "implantável"; apenas a avaliação humana feita por falantes certifica a qualidade ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**O que foi descontinuado.** Novos cards publicam `composite: null`, `quality_tier: null` e `cost_adjusted: null` (a pontuação ajustada pelo custo era o composto dividido por um fator de custo; o custo em si ainda é informado). Nenhuma saída nova imprime um composto ou um tier. Cards publicados antes do padrão mantêm seu composto armazenado e permanecem verificáveis: o verificador recalcula um card sem `scoring_standard` usando o cálculo legado (§4), e um card com `standard/1` recalculando o chrF++. Onde quer que o composto de um card antigo ainda seja exibido, ele é rotulado como **composto legado (descontinuado)**.

**Por que este é o padrão.** É assim que a área relata a avaliação de TA:

- A **WMT** classifica os sistemas de suas tarefas compartilhadas por avaliação humana e informa métricas automáticas ao lado com assinaturas sacreBLEU para que os números possam ser reproduzidos (Post 2018; Kocmi et al. 2024).
- O **FLORES-200** (NLLB Team 2022) informa chrF++ e spBLEU para 200 idiomas, a maioria deles de baixos recursos.
- As tarefas compartilhadas da **AmericasNLP** sobre tradução para idiomas indígenas das Américas classificam sistemas por chrF (Mager et al. 2021; Ebrahimi et al. 2023), pois os n-gramas de caracteres lidam melhor com morfologia rica do que o BLEU a nível de palavra (Popović 2015, 2017).
- Kocmi et al. (2021), comparando métricas automáticas com milhares de julgamentos humanos, descobriram que a magnitude da diferença de uma métrica e se ela é estatisticamente significativa são os fatores que preveem a preferência humana, razão pela qual as comparações aqui são testes de significância pareados (Koehn 2004; Riezler & Maxwell 2005), e não dois números lado a lado.

**Concursos.** O qualificador de um concurso é o chrF++ isoladamente, de 0 a 100, e o `primary_metric` de um concurso tem como padrão `chrf_plus_plus`. Um novo concurso que solicite `composite` como sua métrica é recusado com uma justificativa; concursos criados antes do padrão continuam funcionando. Um organizador ainda pode definir critérios diagnósticos eliminatórios (gates) nos termos da premiação (por exemplo, uma aceitação mínima por FST), como filtros que uma submissão deve passar, nunca como a pontuação ([Especificação de Prêmios](/docs/network/specifications/prizes)).

**Alterando o padrão.** A métrica de destaque muda apenas com uma nova versão do padrão (`standard/2`). Todo card indica o padrão sob o qual foi pontuado e é verificado sob esse mesmo padrão.

---

## 1. Filosofia de Pontuação

### 1.1 Filosofia de Microeval

> *"Se nos concentrarmos apenas no que generaliza, inevitavelmente esqueceremos de onde não generaliza — e perderemos esses idiomas e todo seu conhecimento e sabedoria."*

Este projeto pratica **desenvolvimento de microeval**: construindo métricas de avaliação adaptadas a idiomas específicos usando as melhores ferramentas linguísticas disponíveis — transdutores de estado finito, dicionários bilíngues, analisadores morfológicos, regras de equivalência curadas por linguistas. Isso é o oposto do paradigma dominante em avaliação de MT, que busca métricas universais que funcionem em todos os idiomas. Métricas universais são valiosas, mas são mais fracas precisamente onde são mais necessárias: para idiomas com morfologia complexa, dados de treinamento limitados e sem representação em conjuntos de treinamento de métricas neurais.

Não estamos fazendo progresso em tradução automática para muitos idiomas do mundo não apenas porque nos faltam corpora, mas porque **nem mesmo sabemos como se parece o progresso** — nos faltam ferramentas de avaliação automatizadas para medir se um sistema de tradução está melhorando. LYSS é nossa tentativa de construir essas ferramentas, idioma por idioma, usando qualquer recurso linguístico que exista.

### 1.2 Métricas Automatizadas São Proxies

Cada métrica definida aqui é calculada por máquina. Elas são úteis para iteração rápida, comparação sistemática e detecção de regressões. Elas **não substituem o julgamento humano**, razão pela qual nenhuma pontuação automática traz um rótulo de qualidade — apenas a revisão humana pode confirmar a real usabilidade.

### 1.3 Um Destaque, Vários Sinais

Nenhuma métrica isolada captura a qualidade da tradução. Uma tradução pode ter alta sobreposição de chrF++, mas falhar na validação morfológica. Pode passar nas verificações por FST, mas ter o significado incorreto. Pode ser semanticamente precisa, mas estilisticamente estranha ao idioma de destino. Portanto, toda execução informa vários sinais — mas apenas um deles, o chrF++, é a métrica principal e de classificação, e os outros são exibidos ao lado dele, nunca misturados a ele. Uma combinação de sinais que têm significados diferentes para idiomas diferentes pode ser burlada por um sistema que se saia bem nos sinais mais fáceis (§4 documenta como o composto descontinuado era), e o leitor não consegue discernir a partir de um número misturado qual sinal realmente mudou.

### 1.4 Extensibilidade

Este inventário de métricas não é fechado. Novos idiomas trazem novos requisitos: precisão tonal para idiomas tonais, precisão diacrítica para escritas semíticas, exatidão silábica para o Cree. A arquitetura (protocolo MetricPlugin) permite que diagnósticos sejam adicionados sem alterar nenhuma pontuação de destaque. Métricas específicas de idioma (por exemplo, o linter e o validador semântico do CRK) são declaradas nos cards de idioma sob `evalMetrics` e carregadas a partir de `eval_standards/` — o harness inclui apenas métricas comportamentais genéricas (code-switching, alucinação, terminologia).

### 1.5 Três Dimensões de Avaliação

Cada cartão de execução mede três dimensões independentes:

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

Estes são eixos independentes. Um método pode pontuar bem mas ser caro, ser rápido mas impreciso, ou qualquer combinação. O leaderboard permite a ordenação por qualquer dimensão. Nenhum número publicado combina esses eixos (a pontuação ajustada pelo custo que fazia isso, §6.3, foi descontinuada).

### 1.6 Status de Validação

Cada métrica nesta especificação tem um **status de validação** distinto de seu status de implementação (§3). O status de implementação rastreia se o código existe. O status de validação rastreia se a métrica foi mostrada correlacionar com julgamentos de qualidade humana.

| Nível de Validação | Significado | Métricas Atuais |
|------------------|---------|----------------|
| **✅ Validado externamente** | Estudos de correlação humana publicados existem (WMT, artigos acadêmicos) | `chrf_plus_plus`, `bleu`, `comet_score` *(apenas pares de alto recurso)* |
| **⚡ Validado por proxy** | Validado para idiomas de alto recurso; não validado para nossos LRLs de destino | `comet_score` *(para LRLs: validado em pares de alto recurso/UE, extrapolado para, por exemplo, CRK — direcional útil mas não calibrado)* |

| **🔶 Heurística de engenharia** | Projetada a partir de princípios linguísticos ou modos de falha observados; sem dados de correlação humana | `fst_acceptance_rate`, `morphological_accuracy` (derivado de FST, correspondido por lema, recalculado pelo verificador), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Não validada** | Ainda não testada em nenhum dado | `orthographic_accuracy`, `consistency_score` |

> **Por que `comet_score` aparece em duas linhas.** Trata-se de uma divisão por nível de recursos, não de uma contradição. O COMET é *validado externamente* onde existem estudos de correlação humana da WMT — pares de altos recursos, em sua maioria europeus. Para os nossos idiomas-alvo de baixos recursos, não existem tais estudos, portanto a mesma métrica é apenas *validada por aproximação (proxy)*: o modelo extrapola a partir de idiomas com sistemas morfológicos diferentes. Ele é exibido ao lado do chrF++ com seu id de modelo e uma ressalva de calibração, nunca misturado.

> **O que isso significa na prática.** O valor de destaque (chrF++) é uma métrica validada externamente, usada da mesma forma que a área a utiliza. Cada heurística de engenharia acima é um **diagnóstico**: pode explicar o *porquê* de uma execução ter obtido determinada pontuação (as palavras não são formas válidas, a saída alternou para o inglês), mas nunca é uma pontuação e nunca classifica uma execução. O composto descontinuado (§4) colocava heurísticas de todos os níveis de validação no destaque, e um sistema podia obter a maior parte dele sem traduzir (§4).
>
> **Experimentos de validação obrigatórios** (consulte `mt-evaluation-landscape.md` §6 e `speaker-validation.md`):
> 1. Estudo de correlação com julgamento humano: mais de 200 pares de frases avaliados por 3 ou mais falantes bilíngues
> 2. Medição da taxa de falsa rejeição do FST em um corpus representativo
> 3. Porte para um segundo idioma (Sámi do Norte) para testar a generalização
> 4. Comparação direta com o COMET nos mesmos dados


---

## 2. Inventário de Métricas {#2-metric-inventory}

As métricas estão organizadas em seis categorias (superficiais, estruturais, semânticas, comportamentais, de conformidade e comparadores relatados). Cada métrica possui um status de implementação, escala e nível (por entrada, a nível de corpus ou ambos), e um de três papéis sob o padrão: **destaque** (apenas chrF++), **padrão** (BLEU, spBLEU, TER, COMET — exibidos ao lado do destaque) ou **diagnóstico** (todas as demais — informadas separadamente).

### 2.1 Métricas de Superfície

Métricas de superfície comparam a tradução prevista com a tradução de referência no nível de string. Elas não requerem ferramentas linguísticas — apenas comparação de strings.

| ID | Métrica | Status | Escala | Nível | Implementação |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Correspondência Exata (Exact Match) | ✅ Implementada | 0.0–1.0 | Ambos | **Diagnóstico.** Binário: o previsto é == à referência? Taxa do corpus = correspondências / total. |
| `equivalent_match_rate` | Correspondência Equivalente (Equivalent Match) | ⚡ Parcial | 0.0–1.0 | Ambos | **Diagnóstico.** A saída prevista corresponde a alguma variante aceita? Para CRK: implementada via `CrkLinterMetric` do padrão de avaliação do CRK (em `eval_standards/crk/`) usando regras determinísticas de classes de variantes (ordem das palavras, ortografia, partícula opcional, sinônimo de lema, ambiguidade progressiva). Carregada automaticamente via declaração `evalMetrics` do card de idioma do CRK. A implementação genérica entre idiomas requer `variants[]` por entrada no corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implementada | 0–100 | Ambos | **Métrica principal e de classificação.** F-score de n-gramas de caracteres com unigramas e bigramas de palavras (chrF do sacreBLEU, `word_order=2`; Popović 2017). Robusta a variações morfológicas. O valor publicado é a nível de corpus (`corpus_chrf`), com um IC bootstrap de 95% e sua assinatura sacreBLEU; valores por entrada (`sentence_chrf`) alimentam os testes de significância. |
| `bleu` | BLEU | ✅ Implementada | 0–100 | Corpus | **Métrica padrão, exibida ao lado do chrF++** (card de execução e banco de dados `corpus_bleu`, com sua assinatura sacreBLEU). Precisão de n-gramas a nível de palavra (Papineni et al. 2002). Não é o destaque porque a correspondência a nível de palavra conta uma palavra correta com um sufixo diferente como um erro total, o que penaliza idiomas morfologicamente ricos. |
| `ter` | Translation Edit Rate | ✅ Implementada | 0–∞ (quanto menor, melhor) | Ambos | **Métrica padrão, exibida ao lado do chrF++** (`scores.ter`, com sua assinatura sacreBLEU). Distância mínima de edição entre o previsto e a referência, normalizada pelo comprimento da referência (`corpus_ter` do sacreBLEU; Snover et al. 2006). |
| `length_ratio` | Proporção de Comprimento (Length Ratio) | ✅ Implementada | 0–∞ (1.0 é o ideal) | Ambos | **Diagnóstico.** `len(predicted) / len(reference)` em caracteres. Detecta truncamento (<0.5) e inflação/alucinação (>2.0). Calculada pela média entre as entradas a nível de corpus. |

### 2.2 Métricas Estruturais

Métricas estruturais validam a bem-formação linguística da tradução. Elas requerem ferramentas específicas de idioma (analisadores FST, analisadores morfológicos) e são os sinais mais fortes para idiomas morfologicamente ricos.

| ID | Métrica | Status | Escala | Nível | Implementação |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | Aceitação por FST | ✅ Implementada | 0.0–1.0 | Ambos | **Diagnóstico.** Aceitação das palavras de saída por um transdutor de estados finitos (GiellaLT). Uma palavra é "válida" se o FST retornar pelo menos uma análise morfológica. **Agregação:** o valor de corpus publicado é a **média das taxas por entrada** — palavras aceitas de cada entrada ÷ suas palavras, com média sobre as entradas analisadas pelo FST, com saídas vazias contando como 0 (o `avg_fst_validity` do plugin). A taxa agregada de palavras (todas as palavras aceitas ÷ total de palavras, `corpus_validity_rate`) é informada ao lado no relatório de execução e no card de execução, mas não é o valor publicado; as duas diferem quando as entradas variam em comprimento. Disponível para qualquer idioma com um analisador GiellaLT `.hfstol`. **Maiúsculas/minúsculas:** a palavra é consultada como escrita; se o FST a rejeitar e ela começar com maiúscula, é consultada novamente com a primeira letra minúscula (`Mun` → `mun`), e uma palavra TODA EM MAIÚSCULAS como Titlecase e depois em minúsculas (`OSLO` → `Oslo`, `GIITU` → `giitu`). Nunca o contrário: um nome próprio escrito em minúsculas (`oslo`) permanece rejeitado. Os aceitadores de correção ortográfica do GiellaLT (Sámi do Norte, Amárico, Basco) e o analisador estrito de Plains Cree do ALTLab listam a maioria das palavras apenas em minúsculas e deixam o controle de maiúsculas para o programa ao redor, portanto, sem isso, uma inicial maiúscula correta em início de frase contava como palavra inválida. Esta é a versão de cálculo `case-fallback/1`, indicada no relatório (`fst_acceptance_method`, com `total_case_folded_words` e o `fst_case_folded_words` de cada entrada) e no card de execução (`fst_provenance.acceptance_method`). Um relatório sem isso foi pontuado diferenciando maiúsculas de minúsculas e apresenta valores mais baixos para texto com iniciais maiúsculas; `mt-eval compare` indica isso ao comparar os dois, e `mt-eval test <run log>` repontua uma execução antiga. O verificador recalcula os números derivados de FST de um card publicado com o método indicado no card, e de um card sem método diferenciando maiúsculas/minúsculas, de forma que o card seja checado contra o cálculo com o qual foi publicado. |
| `morphological_accuracy` | Precisão Morfológica | ✅ Implementada (recalculada pelo verificador) | 0.0–1.0 | Ambos | **Diagnóstico.** Uma palavra pode ser válida pelo FST, mas ter a flexão errada (raiz certa, sufixo errado). **Calculada** por `plugins/giellalt_fst.py`: para cada palavra prevista analisável, localiza uma palavra de referência que compartilha seu **lema** (raiz) e verifica se a **flexão** prevista (tags de atributos do FST) corresponde. A correspondência por lema — e não por posição — evita o alinhamento de palavras: uma escolha de palavra diferente ou um par desalinhado simplesmente não é *coberto* (nunca pontuado erroneamente). **Não requer anotações de referência (gold)** — a análise do FST sobre a referência *é* a verdade fundamental (ground truth). Palavras que o FST não consegue analisar, ou cuja raiz não está na referência, ficam fora da cobertura; `morph_coverage` (a fração com correspondência de lema) é divulgada e, abaixo de `MORPH_COVERAGE_FLOOR` (0.25), o valor é marcado como informativo. É **tolerante sob ambiguidade do FST** (uma palavra prevista com várias análises é considerada "correta" se *qualquer* uma corresponder → um limite superior, divulgado). Requer um **analisador**: um FST que é apenas um **aceitador** de correção ortográfica (os pacotes de correção Divvun instalados para Sámi do Norte, Amárico e Basco) informa se a palavra existe, mas não fornece lema nem tags. Para esses casos, `morphological_accuracy` e `morph_coverage` são nulos e `metric_availability` explica o motivo; a aceitação por FST ainda é informada. A fixação do FST declara isso (`kind: "acceptor"`), e a métrica também detecta um transdutor que nunca retorna uma tag. É **recalculada pelo verificador** contra o corpus canônico (`verifier.recompute_corpus_morph`, que executa novamente o FST fixado no card — com falha imediata caso o FST esteja ausente, o mesmo contrato do COMET). Sob o composto descontinuado, possuía peso 0.15 no perfil fst-coverage (§4.3). |
| `orthographic_accuracy` | Precisão Ortográfica | 🔲 Planejada | 0.0–1.0 | Ambos | **Diagnóstico (planejado).** Valida a correção específica do sistema de escrita: uso de mácron/circunflexo SRO para Cree, sinais diacríticos para Inuktitut, marcadores de extensão de vogal para Ojibwe. Conjuntos de regras por idioma. |

> **O que as métricas estruturais agregam e por que são diagnósticos.** O OMT-1600 da Meta — o maior sistema de TA já publicado (1.600 idiomas; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — avalia com ChrF++, xCOMET, MetricX e BLASER 3. Nenhum deles valida a correção morfológica: o chrF++ mede a sobreposição de n-gramas de caracteres e recompensa sequências que se *parecem* com a referência, de modo que uma palavra morfologicamente inválida que compartilha muitos caracteres com a referência ainda recebe crédito. A aceitação por FST responde a uma pergunta diferente: cada palavra é uma forma válida no idioma? Isso a torna um diagnóstico útil para idiomas polissintéticos. Não é uma pontuação de tradução: ela nunca examina a fonte ou a referência, portanto, um sistema que imprime uma mesma frase válida para qualquer entrada passa completamente (§4 traz o caso medido). O ChrF++ também tem um **piso de probabilidade diferente de zero** que varia conforme a ortografia — textos aleatórios na mesma escrita pontuam mensuravelmente acima de zero, mais em alguns sistemas de escrita do que em outros —, logo o chrF++ bruto não é comparável entre idiomas; ele classifica sistemas apenas dentro do mesmo conjunto de avaliação. Portanto, o mapa de rede **não** classifica a força comparativa entre idiomas — uma conexão indica apenas que o par foi medido, nada mais. A correção do piso de probabilidade que desenvolvemos para isso (cchrF++) é uma pesquisa publicada e não está conectada a nenhuma interface pública; o documento [Força da Conexão](/docs/network/specifications/connection-strength) explica o que ela estabelece e o que não estabelece.

### 2.3 Métricas Semânticas

Métricas semânticas medem preservação de significado usando embeddings ou modelos aprendidos. Elas capturam traduções que são superficialmente diferentes mas semanticamente equivalentes, e sinalizam traduções que são superficialmente similares mas semanticamente erradas.

| ID | Métrica | Status | Escala | Nível | Implementação |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Similaridade Semântica | ⚡ Parcial | 0.0–1.0 | Ambos | **Diagnóstico.** CRK: pontuação ponderada por veredito a partir de `CrkSemanticMetric` do padrão de avaliação do CRK (em `eval_standards/crk/`, proxy). Universal: similaridade de cosseno de embeddings de frases (fonte + previsto vs. fonte + referência). Modelo a definir — deve suportar idiomas de baixos recursos, o que descarta a maioria dos modelos de embedding centrados em inglês. |
| `comet_score` | COMET | ✅ Implementada | ~0.0–1.0 | Ambos | **Métrica padrão quando calculada, exibida ao lado do chrF++ com seu id de modelo** (`comet_model`). Métrica aprendida de avaliação de TA (Rei et al. 2020). Nunca misturada com o chrF++. Recalculada pelo verificador, de modo que um valor informado deve ser reproduzível. Marcada com uma ressalva de calibração para idiomas de baixos recursos como Plains Cree. Calculada quando `unbabel-comet` está instalado. Para 35 idiomas africanos, o harness seleciona automaticamente o AfriCOMET (`masakhane/africomet-mtl`) via `resolve_comet_model()`, que apresenta melhor correlação com julgamentos humanos para esses idiomas. |

> **Por que o COMET fica ao lado do destaque e não é o destaque.** O COMET é treinado com dados de avaliação humana da WMT, esmagadoramente com pares europeus de altos recursos. Para pares verdadeiramente de altos recursos (alemão, francês, …) o `Unbabel/wmt22-comet-da` padrão é bem validado pela WMT, e `resolve_comet_model()` o seleciona. Aplicado ao Plains Cree ou a outros idiomas de baixos recursos, o modelo extrapola a partir de idiomas com sistemas morfológicos distintos — útil direcionalmente, mas não calibrado, e o card informa isso. Ele também requer um modelo de 2,3 GB, portanto não é calculado para todas as execuções. O chrF++ é reproduzível unicamente a partir do corpus para qualquer idioma, razão pela qual é o destaque e o COMET é informado ao lado sempre que calculado.

> **AfriCOMET para idiomas africanos.** Cada cartão de idioma tem um campo `metricModelSupport` (ver especificação de cartão de idioma §9) que declara quais modelos COMET especializados são treinados para esse idioma. Para 35 idiomas africanos (yor, hau, ibo, amh, swa, etc.), o cartão declara AfriCOMET (`masakhane/africomet-mtl`) — um modelo COMET ajustado em julgamentos de MT de idioma africano pela comunidade Masakhane. O harness auto-seleciona o modelo recomendado via `resolve_comet_model()` lendo de cartões de idioma, mas isso pode ser substituído com `--comet-model`. Adicionar novos mapeamentos de idioma→modelo é feito enriquecendo o cartão de idioma (não editando código Python).

### 2.4 Métricas Comportamentais

Métricas comportamentais detectam modos específicos de falha na saída da tradução. Elas não medem a qualidade diretamente — elas detectam problemas. Todas elas são **diagnósticos**.

| ID | Métrica | Status | Escala | Nível | Implementação |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Taxa de Code-Switching | ✅ Implementada | 0.0–1.0 (quanto menor, melhor) | Ambos | Proporção de palavras de saída que estão no idioma de origem (normalmente inglês). Detectada por meio de análise de escrita Unicode e/ou lista de palavras do idioma de origem. Modo de falha muito comum em LLMs: o modelo insere palavras em inglês quando não sabe o equivalente no idioma de destino. |
| `hallucination_rate` | Taxa de Alucinação | ✅ Implementada | 0.0–1.0 (quanto menor, melhor) | Ambos | Proporção de conteúdo de saída que não possui conteúdo correspondente na origem. Detectada por alinhamento de palavras ou sobreposição de embeddings entre idiomas. Identifica quando o modelo gera traduções plausíveis, porém inventadas. |
| `terminology_adherence` | Aderência à Terminologia | ✅ Implementada | 0.0–1.0 | Ambos | Para métodos orientados (coached): proporção de termos terminológicos prescritos que aparecem na saída. Requer um glossário (`{"source term": "translation"}`, ou uma lista de traduções aceitas por termo). A fonte é `--glossary <file.json>`, uma entrada de avaliação que nunca é enviada ao modelo e é fornecida a todas as execuções comparadas. Caso contrário, é o objeto `dictionary` de um `--coaching-file` JSON: a execução é então pontuada contra sua própria orientação, e a saída da execução informa isso. Sem nenhum dos dois, a métrica fica inativa (nula). Mede se o modelo respeita o vocabulário fornecido por especialistas. |
| `consistency_score` | Consistência entre Entradas | 🔲 Planejada | 0.0–1.0 | Apenas corpus | O modelo traduz o mesmo termo de origem da mesma forma entre as diferentes entradas? Baixa consistência sugere que o modelo está adivinhando em vez de aplicar padrões aprendidos. Requer termos repetidos entre as entradas do corpus. |

### 2.5 Métricas de Conformidade

Métricas de conformidade validam se as traduções preservam a integridade estrutural — marcadores de substituição (placeholders), formatação e convenções tipográficas. São verificações de controle de qualidade (gates), não pontuações de qualidade, e atuam como diagnósticos sob o padrão.

| ID | Métrica | Status | Escala | Nível | Implementação |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Conformidade em Duplo Passo | 🔲 Planejada | 0.0–1.0 | Ambos | Composto ponderado: 60% integridade de variáveis (variáveis `{placeholder}` foram preservadas?) + 20% conformidade de aspas (caracteres de aspas corretos no idioma de destino) + 20% conformidade de maiúsculas/minúsculas (sem vazamento de caracteres latinos para idiomas sem distinção de caixa). Calculado tanto na saída bruta quanto na pós-processada. Existe uma classe `DoublePassCompliancePlugin`, mas nenhuma execução de avaliação a carrega, e ainda não há fonte citada para convenções de aspas e caixa por idioma. Os cards de idioma não as contêm. Sem essa fonte, apenas o termo de integridade de variáveis mede algo real. |
| `repair_effectiveness` | Eficácia do Reparo | 🔲 Planejada | 0.0–1.0 | Corpus | Proporção de violações de conformidade que foram reparadas automaticamente por hooks pós-tradução. Mede o quanto o gate de qualidade melhorou a saída bruta. Planejada pelo mesmo motivo de `compliance_index`. |

> **Por que a conformidade é um filtro eliminatório (gate) e não uma pontuação.** As métricas de conformidade medem a preservação estrutural (placeholders, aspas), e não a qualidade da tradução. Uma tradução pode ser perfeita linguisticamente, mas falhar na conformidade por ter omitido uma variável `{name}`. Elas são projetadas como filtros de qualidade para impedir a entrega de saídas defeituosas, não para classificar a qualidade da tradução.

### 2.6 Comparadores informados

O spBLEU é uma das métricas padrão exibidas ao lado do chrF++; o chrF simples e o comparador no estilo FUSE são informados para fins de comparação com outras tabelas publicadas. Nenhum deles é misturado com qualquer outra métrica:

| ID | Métrica | Status | Notas |
|----|--------|--------|-------|
| `spbleu` | spBLEU (tokenizador FLORES-200) | ✅ Implementada | **Métrica padrão, exibida ao lado do chrF++** (`scores.spbleu`, com sua assinatura sacreBLEU). BLEU sobre a tokenização SentencePiece do FLORES-200 (Goyal et al. 2022) — comparável entre diferentes escritas/segmentações (a língua franca do NLLB/FLORES). Requer `sentencepiece` (dependência principal). |
| `chrf_plain` | chrF simples (`word_order=0`) | ✅ Implementada | O valor de chrF informado pelo AmericasNLP e por muitas tabelas da WMT, ao lado da nossa métrica de destaque chrF++ (`word_order=2`). Sua assinatura é `sacrebleu_signatures.chrf_plain`. |
| `fuse_score` | Comparador estilo FUSE | ⚡ Opcional (`--fuse`) | Uma **reimplementação NÃO TREINADA** da abordagem FUSE do AmericasNLP-2025 (Raja & Vats): semântica LaBSE + F1 lexical de tokens + Soundex fonético + difflib difuso, combinados como uma *média não ponderada* (não temos dados de treinamento com julgamentos humanos para ajustar o Ridge/GBM original, e explicitamos isso). LaBSE/Soundex são os extras opcionais de `fuse`; sem LaBSE, `compute_fuse` retorna `None` (divulgado) em vez de simular uma pontuação. Cada componente executado é listado em `fuse_components`; o resultado recebe a flag `fuse_untrained=true`. Apenas um comparador diagnóstico. |

### 2.7 Namespaces de Métrica {#2-7-metric-namespaces}

Uma única métrica carrega até quatro nomes coordenados na pilha: o **id canônico** (a chave `scores` em um cartão de execução, por exemplo `equivalent_match_rate`), o **nome de plugin** Python que a computa (por exemplo `crk_linter`), a chave **`evalMetrics` do cartão de idioma** que a declara (por exemplo `lyss-eq`), e a coluna **`run_cards` desnormalizada** no leaderboard (por exemplo `equivalent_match_rate`). Estes são deliberadamente distintos — o nome do plugin declara a *ferramenta*, o id da métrica declara a *medição* — mas devem permanecer sincronizados.

A fonte única da verdade para esse mapeamento é `shared/metric-registry.json`, carregado
por `mt_eval_harness.metric_manifest`. Cada entrada registra os quatro nomes mais `scale`,
`direction` (higher/lower/neutral), `level` (entry/corpus/both), `in_composite`
(se estava no composto descontinuado; mantido para verificação de cards antigos) e
`verifier_reproducible`. Um teste de paridade falha se as tabelas de `scoring.py` ou as
chaves `scores` do card de execução geradas por `publish.py` divergirem do registro, garantindo que uma nova
métrica não seja entregue pela metade.

Dois campos de cartão de execução relacionados tornam a proveniência de métrica explícita:

- **`scores.metric_availability`** — um bloco `{metric: reason}` que desambigua uma
  pontuação `null`: `not_applicable` (o idioma/execução não a utiliza), `unavailable`
  (uma dependência opcional estava ausente), `below_coverage_floor` (presente, mas esparsa
  demais para ser mais do que informativa), `not_run` (opcional e não solicitada), ou
  `not_implemented` (planejada). Uma métrica ausente do bloco foi calculada normalmente.
- **`fst_version`** / **`fst_provenance`** — a versão instalada do transdutor
  GiellaLT e a versão de `pyhfst` por trás de qualquer métrica derivada de FST, capturadas da mesma forma
  que as assinaturas sacreBLEU para que uma pontuação estrutural possa ser rastreada até uma compilação
  exata do analisador. `fst_provenance.acceptance_method` indica como a aceitação
  foi calculada a partir das respostas do transdutor (`case-fallback/1`, §1); um card sem
  isso foi pontuado diferenciando maiúsculas de minúsculas.
- **`scores.sacrebleu_signatures`** — a assinatura sacreBLEU de cada
  métrica sacreBLEU calculada pela execução: `chrf` (o destaque chrF++,
  `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. Dois valores de chrF++ são
  comparáveis apenas quando suas assinaturas coincidem (Post 2018).

### 2.8 Ressalvas de Pontuação {#2-8-score-caveats}

Uma pontuação pode ser calculada corretamente e ainda assim não significar o que seu rótulo diz. O
harness verifica cada execução em busca dos cenários conhecidos em que isso ocorre e, quando um é acionado,
imprime-o ao lado da métrica principal no resumo do teste, no `mt-eval compare`, na
pré-visualização de publicação e no dashboard, e o card publicado o inclui como
`score_caveats` para que o leaderboard também o exiba. Uma ressalva nunca altera uma pontuação;
ela indica o que a limita. Cada uma é um diagnóstico com uma `severity` (`major` ou
`minor`) e uma mensagem de uma frase citando contagens, nunca as saídas
em si.

| Ressalva | Disparada quando |
|--------|-----------|
| `source_copy` | Pelo menos metade das saídas pontuadas é idêntica à sua origem (ignorando maiúsculas/minúsculas, acentos e pontuação). Uma entrada cuja referência é a própria origem (um nome, um número) é desconsiderada. |
| `length_deflation` | As saídas têm em média menos de 0,5× o comprimento da referência, ou um quarto ou mais delas atinge esse valor — palavras foram omitidas. A aceitação por FST e o code-switching avaliam apenas as palavras presentes, logo a omissão de palavras eleva seus índices. |
| `length_inflation` | As saídas têm em média mais de 2× o comprimento da referência, ou um quarto ou mais delas atinge esse valor (por exemplo, exemplos few-shot vazando para todas as saídas). |
| `near_constant_output` | Uma única saída é retornada para muitas entradas diferentes: repetições cobrem pelo menos um quarto das origens distintas e pelo menos 5 delas. Uma saída conta como repetição quando 3 origens a recebem (uma saída de três ou mais palavras) ou 5 (uma saída de uma ou duas palavras, já que respostas curtas como "Sim." ocorrem legitimamente); uma saída idêntica à sua própria referência é uma resposta correta, não uma repetição. Antes de definir esses limites, a regra foi executada sobre 2.161 saídas de sistemas reais e referências das tarefas de métricas da WMT 2019–2025; as cinco que ela sinalizou eram todas saídas corrompidas. |
| `train_test_near_twin` | Escrita por nmt-forge: cada linha de teste (ou quase todas) possui um gêmeo quase idêntico nos dados de treinamento, logo a pontuação mede a memorização de frases de treino, não tradução. |

---

## 3. Níveis de Status de Métrica

Cada métrica em §2 cai em um de quatro níveis de implementação:

| Nível | Significado | Comportamento do Cartão de Execução |
|------|---------|-------------------|
| **✅ Implementado** | Código existe, testado, produzindo valores em cartões de execução hoje | Valor numérico no cartão de execução |
| **⚡ Parcial** | Proxy específico de idioma existe (por exemplo, CRK) mas implementação universal está pendente | Valor numérico quando proxy se aplica, `null` caso contrário |
| **🔲 Planejado** | Especificado mas ainda não implementado | `null` no cartão de execução (campo presente, valor ausente) |
| **💡 Proposto** | Sob discussão, ainda não especificado | Não no cartão de execução |

Uma métrica se move de Planejado → Parcial quando:
1. Uma implementação específica de idioma é mesclada e testada
2. Produz valores para pelo menos um par de idiomas
3. A implementação universal permanece pendente (documentada nesta especificação)

Uma métrica se move de Parcial → Implementado quando:
1. Uma implementação agnóstica de idioma é mesclada e testada
2. Produz valores para qualquer par de idiomas sem plugins específicos de idioma
3. Este documento é atualizado para refletir status ✅

Uma métrica se move de Planejado → Implementado quando:
1. A implementação é mesclada e testada
2. Foi validada em pelo menos uma execução de avaliação real
3. Este documento é atualizado com seus detalhes de implementação

Uma métrica se move de Proposto → Planejado quando:
1. Sua definição, escala e método de computação são acordados
2. É adicionada a este documento com status `🔲 Planned`
3. Um placeholder nulo é adicionado ao esquema de cartão de execução

---

## 4. Descontinuado: o Composto (legado) {#4-composite-score}

> [!CAUTION]
> **Nenhuma nova execução é pontuada com o composto.** Ele foi descontinuado pelo padrão de pontuação `standard/1` ([Como as execuções são pontuadas](#how-runs-are-scored)). Novos cards publicam `composite: null`. Esta seção é mantida **apenas** para que cards publicados antes do padrão ainda possam ser lidos e verificados: o verificador recalcula o composto armazenado de qualquer card que não contenha `scores.scoring_standard`, exatamente com a fórmula e tabelas abaixo. Onde quer que o composto de um card antigo ainda seja exibido, ele é rotulado como **composto legado (descontinuado)** e nunca é comparado com o chrF++ ou com um card novo.

### Por que foi descontinuado {#why-the-composite-was-retired}

O composto era uma combinação ponderada de chrF++/100, correspondência exata, aceitação por FST (peso 0.25), precisão morfológica, pontuação semântica, code-switching, alucinação e terminologia, com pesos definidos por julgamento de engenharia e nunca ajustados a julgamentos humanos. Como várias de suas variáveis nunca comparam a saída com a origem ou com a referência, um sistema conseguia obter a maior parte da pontuação sem traduzir:

- **Uma frase para todas as entradas.** Um modelo não treinado de inglês→Sámi do Norte que repetia uma mesma frase válida em Sámi do Norte para qualquer entrada obteve uma pontuação composta de **0.6244** — rotulado como "funcional" — com **chrF++ de 5.5**. As palavras repetidas são palavras válidas em Sámi, portanto a aceitação por FST foi de 100%, e para um idioma cujo FST é um aceitador ortográfico, a aceitação por FST representava cerca de 45% do composto após a redistribuição dos pesos das métricas ausentes.
- **Omitir o que não sabe traduzir.** Um glossário experimental que descarta todas as palavras desconhecidas obteve **0.6612**, porque a aceitação por FST e o code-switching julgam apenas as palavras que a saída contém.
- **Copiar a fonte.** O inglês copiado diretamente como saída em "Sámi do Norte" ainda recebia crédito de FST, já que um verificador ortográfico aceita palavras em maiúsculas e alguns termos em inglês.

Nenhuma avaliação padrão classificaria esses sistemas acima de uma tradução real, e o chrF++ não o faz: ele compara cada saída com sua referência. As ressalvas do harness (§2.8) também capturam esses padrões e permanecem em destaque ao lado da métrica principal chrF++.

### 4.1 Fórmula (legada)

A pontuação composta era uma média ponderada de todas as métricas *disponíveis*, renormalizada para que a soma dos pesos das métricas disponíveis resultasse em 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Uma métrica é considerada "disponível" se seu valor no card de execução for um número (e não `null`). Quando uma métrica estava indisponível — porque o idioma não possui FST ou porque a métrica ainda não foi implementada —, seu peso era redistribuído proporcionalmente entre as métricas restantes. Compostos calculados a partir de conjuntos de métricas distintos nunca eram comparáveis; cada card legado registra seus campos `scores.scoring_profile` e `scores.metric_availability` (§2.7), para que o verificador saiba qual conjunto utilizar.

### 4.2 Normalização de Entradas (legada)

Antes de entrar na fórmula do composto, cada métrica era convertida para uma **escala de 0.0 a 1.0**, onde 1.0 = perfeito:

| Métrica | Escala Nativa | Normalização |
|--------|-------------|---------------|
| `exact_match_rate` | 0.0–1.0 | Nenhuma (já normalizada) |
| `equivalent_match_rate` | 0.0–1.0 | Nenhuma |
| `fst_acceptance_rate` | 0.0–1.0 | Nenhuma |
| `morphological_accuracy` | 0.0–1.0 | Nenhuma |
| `chrf_plus_plus` | 0–100 | **Dividir por 100** |
| `semantic_score` | 0.0–1.0 | Nenhuma |
| `code_switching_rate` | 0.0–1.0 (menor = melhor) | **`1.0 - value`** (inverter: 0% code-switching = 1.0) |
| `hallucination_rate` | 0.0–1.0 (menor = melhor) | **`1.0 - value`** (inverter) |
| `terminology_adherence` | 0.0–1.0 | Nenhuma |

### 4.3 Tabelas de Pesos (legadas) {#43-weight-tables}

Cada idioma resolvia para um **perfil nomeado** via `language_cards.resolve_scoring_profile()` (`fst-coverage` quando um FST pontuava a execução, caso contrário `surface-only`, a menos que o card de idioma declarasse `scoringProfile.basis`); o perfil é refletido em `PROFILE_REGISTRY` de `scoring.py` e registrado em cada card legado como `scores.scoring_profile`. `orthographic_accuracy` está listado em `scoring.INACTIVE_METRICS` e nunca foi calculado, logo seu peso sempre era redistribuído. `morphological_accuracy` entrava apenas quando `morph_coverage ≥ 0.25`. Métricas neurais (`comet_score`, `qe_score`; `scoring.NEURAL_METRICS`) nunca fizeram parte de nenhum composto.

#### `fst-coverage` (Perfil A): Idiomas COM Cobertura FST

| Métrica | Peso de Destino | Justificativa |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.25** | Peso mais alto. Se o FST rejeita uma palavra, não é uma forma válida no idioma — independentemente do que outras métricas dizem. Binário, estruturalmente fundamentado. |
| `morphological_accuracy` | **0.15** | Uma palavra pode ser válida em FST mas morfologicamente errada (raiz correta, inflexão errada). Junto com FST, métricas estruturais carregam 40%. |
| `chrf_plus_plus` | **0.15** | Sobreposição de n-grama de caractere: o melhor proxy de nível de superfície para idiomas polissintéticos. Lida com morfologia aglutinante melhor do que métricas no nível de palavra. |
| `semantic_score` | **0.15** | Preservação de significado quando forma de superfície diverge. Captura traduções semanticamente erradas que passam em verificações estruturais. |
| `equivalent_match_rate` | **0.10** | Recompensa variantes aceitáveis, não apenas a tradução de referência única. Importante para idiomas com ordem de palavras flexível. |
| `code_switching_rate` | **0.05** | Penaliza vazamento de idioma de origem. Invertido: 0% code-switching = 1.0. |
| `terminology_adherence` | **0.05** | Recompensa métodos treinados que respeitam vocabulário prescrito. Apenas ativo quando dados de treinamento estão presentes. |
| `hallucination_rate` | **0.05** | Penaliza conteúdo fabricado. Invertido: 0% alucinação = 1.0. |
| `exact_match_rate` | **0.05** | Peso mais baixo. Muito rigoroso para idiomas polissintéticos — múltiplas traduções corretas existem. Mantido como verificação de teto. |

> **Total: 1.00.** Com a ausência de `morphological_accuracy` (sem analisador FST, com FST apenas aceitador ou cobertura inferior a 0.25), as 8 métricas restantes (totalizando 0.85) eram escaladas individualmente por 1/0.85 ≈ 1.176. Para um idioma com FST apenas aceitador (Sámi do Norte, Amárico, Basco) sem padrão de avaliação e sem glossário, restavam apenas aceitação por FST de 0.25, chrF++ de 0.15, code-switching, alucinação e correspondência exata (0.05 cada) — totalizando 0.55 —, de modo que a aceitação por FST respondia por **0.25/0.55 ≈ 45%** do composto. Foi essa ponderação que os exemplos acima exploraram.

#### `surface-only` (Perfil B): Idiomas SEM Cobertura FST

| Métrica | Peso de Destino | Justificativa |
|--------|--------------|-----------|
| `semantic_score` | **0.25** | Sem validação estrutural, preservação de significado é o sinal disponível mais forte. |
| `chrf_plus_plus` | **0.25** | Sem FST, sobreposição no nível de caractere se torna a verificação de superfície primária. |
| `equivalent_match_rate` | **0.15** | Correspondência de variante fornece avaliação de qualidade estruturada sem exigir ferramentas morfológicas. |
| `exact_match_rate` | **0.10** | Sem FST, correspondência exata carrega mais peso como o único proxy de validação estrutural. |
| `code_switching_rate` | **0.10** | Vazamento de idioma de origem importa mais quando não há FST para capturar saída ruim. |
| `terminology_adherence` | **0.05** | Conformidade de vocabulário treinado. |
| `hallucination_rate` | **0.05** | Detecção de conteúdo fabricado. |
| `orthographic_accuracy` | **0.05** | Correção específica de script preenche parte da lacuna deixada por FST ausente. |

> **Total: 1.00.** `orthographic_accuracy` nunca foi calculado, portanto as 7 métricas restantes (totalizando 0.95) eram escaladas por 1/0.95 ≈ 1.053.

#### `no-reference`: execuções com SEM referência de ouro

| Métrica | Peso de Destino | Justificativa |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | Validade morfológica não precisa de referência; o sinal determinístico mais forte quando um FST existe. |
| `code_switching_rate` | **0.25** | Vazamento de idioma de origem (invertido). |
| `hallucination_rate` | **0.20** | Conteúdo fabricado (invertido). |
| `terminology_adherence` | **0.15** | Conformidade de vocabulário treinado. |

> **Total: 1.00.** Para execuções cujo corpus não continha referências de padrão-ouro (gold). Quando tal execução não possuía FST, o composto era renormalizado unicamente sobre as verificações comportamentais.

### 4.4 Adicionando uma Nova Métrica

Uma nova métrica é adicionada como um **diagnóstico**; ela nunca altera o destaque:

1. **Defina-a** no §2 com status `🔲 Planned`, incluindo escala, nível, direção e método de cálculo.
2. **Implemente-a** como um MetricPlugin (ou em `tester.py` para métricas principais).
3. **Registre-a** em `shared/metric-registry.json` e adicione um placeholder nulo no bloco scores do card de execução.
4. **Atualize BENCHMARK_SPEC.md** §3 caso o esquema do card de execução sofra alterações.
5. **Execute um benchmark de validação** para confirmar que a métrica produz valores coerentes com dados reais.
6. **Atualize este documento** alterando o status de `🔲` para `✅`.

Alterar a métrica de destaque ou de classificação não é "adicionar uma métrica": isso requer uma nova versão do padrão de pontuação ([Como as execuções são pontuadas](#how-runs-are-scored)).

---

## 5. Descontinuado: Níveis de Qualidade (legado) {#5-quality-tiers}

> [!CAUTION]
> **Nenhum novo card recebe um nível de qualidade (tier).** Novos cards publicam `quality_tier: null`, e nenhuma nova saída exibe um tier ou um rótulo como "funcional" ou "implantável". Uma pontuação automática não é um veredito de qualidade: o mesmo número tem significados distintos para diferentes idiomas e conjuntos de avaliação, e os tiers descontinuados rotulavam um sistema que repetia uma mesma frase para todas as entradas como "funcional" (§4). Apenas a avaliação humana feita por falantes certifica a qualidade ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

Os tiers eram rótulos derivados diretamente do composto legado. Cards legados ainda os mantêm armazenados; eles permanecem aqui apenas para que um card antigo possa ser lido, não constituindo alegações de qualidade.

| Tier legado | Intervalo do composto legado |
|------|----------------|
| Linha de base (Baseline) | 0.00–0.30 |
| Emergente (Emerging) | 0.30–0.50 |
| Funcional (Functional) | 0.50–0.70 |
| Implantável (Deployable) | 0.70–0.85 |
| Fluente (Fluent) | 0.85–1.00 |

### 5.1 Limiares de Tier (Legíveis por Máquina, legado)

Os limiares legados (avaliados de cima para baixo, a primeira correspondência é a escolhida):

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. Métricas de Custo

Métricas de custo medem a eficiência financeira de um método de tradução. Elas são informadas ao lado da pontuação e nunca combinadas a ela.

### 6.1 Métricas de Token

| ID | Métrica | Computação |
|----|--------|-------------|
| `prompt_tokens` | Total de tokens de entrada | Soma de `usage.prompt_tokens` em todas as chamadas de API |
| `completion_tokens` | Total de tokens de saída | Soma de `usage.completion_tokens` |
| `reasoning_tokens` | Tokens de cadeia de pensamento | Soma de `usage.completion_tokens_details.reasoning_tokens` (0 para maioria dos modelos) |
| `cached_tokens` | Tokens em cache do provedor | Soma de `usage.prompt_tokens_details.cached_tokens` |
| `total_tokens` | Total de tokens consumidos | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | Média de tokens por tradução | ✅ `total_tokens / entry_count` |

### 6.2 Métricas de Custo

| ID | Métrica | Computação | Caso de Uso |
|----|--------|-------------|----------|
| `total_cost_usd` | Custo total de execução | Preço relatado pelo provedor × contagens de token | "Quanto custou este benchmark?" |
| `cost_per_entry_usd` | Custo por entrada de corpus | `total_cost_usd / entry_count` | Comparando métodos no mesmo corpus |
| `cost_per_1k_tokens` | Custo por 1.000 tokens | ✅ `total_cost_usd / total_tokens × 1000` | Eficiência universal de LLM — comparável entre corpora |
| `cost_per_source_char` | Custo por caractere de origem | `total_cost_usd / total_source_chars` | Comparável entre idiomas com tokenização diferente |

> **Por que múltiplas métricas de custo?** Uma "entrada" varia em comprimento — uma frase de 3 palavras custa menos do que um parágrafo. `cost_per_entry_usd` é útil para comparar métodos no *mesmo* corpus (mesmas entradas = mesmos comprimentos = comparação justa). `cost_per_1k_tokens` é a métrica de eficiência de LLM padrão, comparável *entre* corpora. `cost_per_source_char` normaliza para diferenças de tokenização — a mesma sentença pode tokenizar em números diferentes de tokens dependendo do vocabulário do modelo.

### 6.3 Pontuação Ajustada por Custo (descontinuada)

Cards legados contêm uma pontuação ajustada pelo custo, calculada a partir do composto descontinuado:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Ela foi descontinuada junto com o composto: novos cards publicam `cost_adjusted: null`. Para ponderar custo contra qualidade, analise o chrF++ (com seu IC) e `cost_per_entry_usd` lado a lado; o leaderboard permite ordenar por qualquer um dos dois.

---

## 7. Métricas de Velocidade

Métricas de velocidade medem a latência e a vazão (throughput) de um método de tradução. Assim como o custo, a velocidade é informada ao lado da pontuação e nunca combinada a ela.

| ID | Métrica | Computação | Nível |
|----|--------|-------------|-------|
| `elapsed_seconds` | Duração de execução em tempo real | `time_end - time_start` | Execução |
| `avg_latency_seconds` | Latência média por entrada | `Σ latency_s / n_entries` | Corpus |
| `median_latency_seconds` | Latência mediana por entrada | 50º percentil de `latency_s` | Corpus |
| `p95_latency_seconds` | Latência do 95º percentil | 95º percentil de `latency_s` | Corpus |
| `tokens_per_second` | Throughput | `total_tokens / elapsed_seconds` | Execução |
| `entries_per_minute` | Taxa de tradução | `entry_count / (elapsed_seconds / 60)` | Execução |

---

## 8. Confiança e Significância

### 8.1 Intervalos de Confiança Bootstrap

Os intervalos de confiança são calculados via percentil bootstrap sobre os segmentos do conjunto de avaliação (n=1000 reamostragens, α=0.05; Koehn 2004). O intervalo do chrF++ faz parte da métrica principal: `chrF++ 47.5 [45.9, 49.0]`. Em conjuntos de avaliação pequenos, o intervalo fica amplo, e o harness avisa quando um subconjunto é reduzido demais para gerar um intervalo significativo.

| Métrica | IC Informado |
|--------|------------|
| `chrf_plus_plus` (destaque) | ✅ card de execução `confidence_intervals.corpus_chrf`; banco de dados `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (calculado apenas quando existem dados de FST) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (gerado por bootstrap a partir de pontuações em cache por entrada — sem inferência neural redundante) |
| `composite` | Apenas cards legados (`composite_ci_lower`, `composite_ci_upper`); não calculado para novas execuções |
| ICs por tier | ✅ `confidence_intervals_by_tier` — ICs de chrF++ e exact_match por nível de dificuldade (Tier 1-5) |

### 8.2 Testes de Significância Pareados {#82-paired-significance-tests}

A decisão sobre uma execução ser melhor do que outra é tomada por meio de um teste de significância pareado sobre o chrF++ nos segmentos que ambas as execuções traduziram, nunca pela simples comparação de dois números. O `mt-eval compare --significance` executa:

- **Randomização aproximada** (o padrão; Riezler & Maxwell 2005, também o padrão do sacreBLEU): as saídas dos dois sistemas são trocadas segmento por segmento aleatoriamente, 1.000 vezes, para verificar com que frequência uma diferença pelo menos tão grande ocorreria por acaso.
- **Reamostragem pareada por bootstrap** (`--method paired_bootstrap`; Koehn 2004): os segmentos são reamostrados com reposição e a diferença é recalculada em cada amostra. É uma estimativa mais conservadora, oferecida para comparação com artigos mais antigos.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

Cada diferença vem acompanhada de seu intervalo de confiança de 95% e é informada como significativa quando p < 0.05. BLEU, spBLEU, TER e os diagnósticos presentes em ambas as execuções também são testados e exibidos (os valores de p são por métrica e sem correção para testes múltiplos), mas o veredito sobre qual é "melhor" decorre do teste de chrF++. Dois valores de chrF++ são comparáveis apenas quando suas assinaturas sacreBLEU coincidem. Se um dos relatórios comparados for legado, o comparador indicará que seu composto foi descontinuado e não fará a comparação dele. Método completo: [Testes de Significância Estatística](/docs/network/specifications/significance).

---

## 9. Esquema de Pontuações do Cartão de Execução

Esta seção define a estrutura hierárquica do bloco `scores` em um cartão de execução. Este esquema é derivado das métricas definidas em §2–§7 e deve ser mantido em sincronização.

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

Ressalvas de pontuação (§2.8) ficam no nível raiz do card como `score_caveats`, uma lista de objetos `{kind, source, severity, message, …}`; o BLEU fica lá como `corpus_bleu`.

> **Histórico de esquema.** Rascunhos de especificação anteriores propuseram blocos `cost`, `speed` e `tokens` separados. Estes foram mesclados em `scores` e `totals` respectivamente para simplicidade. Métricas de velocidade (`tokens_per_second`, `entries_per_minute`, latências) vivem em `scores`; contagens de token e figuras de custo vivem em `totals`.

### 9.1 Mapeamento Esquema–Banco de Dados

O JSON do cartão de execução é armazenado em sua totalidade como uma coluna `jsonb` no Supabase. Métricas-chave também são desnormalizadas em colunas de nível superior para desempenho de classificação/filtro:

| Campo no Card de Execução | Coluna Supabase | Tipo | Índice |
|---------------|----------------|------|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — apenas cards legados; nulo para `standard/1` |
| `scores.quality_tier` | `quality_tier` | `text` | — apenas cards legados; nulo para `standard/1` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(card completo)* | `run_card` | `jsonb` | — |

Quando novas métricas são implementadas, a coluna correspondente deve ser adicionada via migração numerada em `arena/migrations/`.

---

## 10. Sincronização Código–Especificação

### 10.1 Fonte Canônica

Este documento é a fonte canônica para:
- O padrão de pontuação: a métrica de destaque, as métricas padrão exibidas ao lado dela e os diagnósticos ([Como as execuções são pontuadas](#how-runs-are-scored))
- Definições de métricas (§2) e ressalvas de pontuação (§2.8)
- As tabelas de pesos do composto legado (§4.3) e os limiares de tiers (§5.1), mantidos para verificação de cards antigos
- Fórmulas de métricas de custo (§6.2)
- Esquema de pontuações do card de execução (§9)

### 10.2 Espelho de Código

O arquivo `arena/mt_eval_harness/scoring.py` é a implementação em código deste documento: os papéis das métricas do padrão (`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`) e, abaixo deles, as tabelas do composto legado e os limiares de tiers usados apenas para verificar cards antigos. Nenhum outro módulo os define; os testes do harness fixam ambos. Quando este documento for atualizado, atualize `scoring.py` para manter a correspondência e execute novamente os testes do harness.

### 10.3 Documentos que Fazem Referência a Esta Especificação

| Documento | O que referencia | Como manter sincronizado |
|----------|-------------------|---------------------|
| [Especificação de Benchmark](/docs/network/specifications/benchmark) §4–§5 | A métrica de destaque, classificação, composto legado | Faça referência cruzada a este documento; não duplique tabelas |
| [Testes de Significância Estatística](/docs/network/specifications/significance) | Como o que é "melhor" é decidido | Deve corresponder ao §8.2 |
| [FAQ](/docs/network/getting-started/faq) e [Como Funciona](/docs/network/how-it-works) | Resumo em linguagem simples do padrão | Crie links de retorno para este documento |
| `publish.py` via `scoring.py` | `standard_score_fields()` e o composto legado | Testes do harness validam a correspondência |

---

## Apêndice A: Por que o chrF++ é o Destaque (e as Outras não São)

| Métrica | Papel | Por quê |
|--------|------|-----|
| **chrF++** | Destaque | N-gramas de caracteres atribuem crédito parcial para uma palavra com a raiz certa e um sufixo diferente, lidando melhor com morfologia rica do que métricas a nível de palavra (Popović 2015, 2017). É reproduzível unicamente a partir do corpus para qualquer idioma e sistema de escrita, e é o que o FLORES-200 e as tarefas compartilhadas da AmericasNLP informam. |
| **BLEU** | Padrão, ao lado | A correspondência a nível de palavra conta uma variação flexional menor como erro total, penalizando idiomas polissintéticos. Informado para permitir comparação com a literatura de TA. |
| **spBLEU** | Padrão, ao lado | BLEU sobre uma tokenização SentencePiece compartilhada, comparável entre escritas; informado pelo FLORES-200. |
| **TER** | Padrão, ao lado | Distância de edição; correlaciona-se com o chrF++ na maioria dos casos de uso. |
| **COMET** | Padrão, ao lado (quando calculado) | Treinado em dados da WMT (pares europeus de altos recursos). Para idiomas de baixos recursos (por exemplo, Cree), o modelo extrapola e não é calibrado, além de exigir um modelo grande, não podendo ser o número único presente em todas as execuções. Recalculado pelo verificador. |
| **Proporção de Comprimento** | Diagnóstico | Uma proporção de 1.02 e uma de 0.98 são igualmente adequadas. Apenas valores extremos indicam problemas (§2.8). |
| **Aceitação por FST, precisão morfológica, LYSS** | Diagnóstico | Heurísticas de engenharia sem dados de correlação humana; a aceitação por FST nunca examina a fonte ou a referência (§4). |
| **Pontuação de Consistência** | Diagnóstico (planejada) | Certo grau de inconsistência é legítimo (mesma palavra em inglês → diferentes traduções no idioma de destino dependendo do contexto). |
| **Índice de Conformidade** | Filtro eliminatório (planejado) | Mede a preservação estrutural (placeholders, aspas), e não a precisão da tradução. |

## Apêndice B: LYSS — Implementações de Métrica Específicas de Idioma

A estrutura **LYSS** (Linguistically-informed Yield & Structural Scoring) fornece métricas específicas de idioma que vão além de comparação de string de nível de superfície. LYSS tem três componentes principais:

- **LYSS-fst** — Validade morfológica (`fst_acceptance_rate`): Cada palavra é uma forma válida no idioma de destino?
- **LYSS-eq** — Equivalência linguística (`equivalent_match_rate`): A saída é uma variante aceitável da referência?
- **LYSS-sem** — Validação semântica (`semantic_score`): A saída preserva o significado da origem?

Todas as três são **diagnósticos** sob o padrão de pontuação: informadas ao lado do chrF++ em destaque, nunca dentro dele.

> **Status de validação: 🔶 Heurística de engenharia.** Métricas LYSS **NÃO** foram validadas contra julgamentos de qualidade humana. Elas são projetadas a partir de princípios linguísticos (FSTs, dicionários, regras de gramática construídas por linguistas no ALTLab da UAlberta), mas a correlação entre pontuações LYSS e qualidade de tradução real não foi medida. Ver o [Protocolo de Validação de Falante](/docs/network/specifications/speaker-validation) para os experimentos de validação necessários.

| Idioma | Plugin | Localização | Componente LYSS | Chave da Métrica | Notas |
|----------|--------|----------|----------------|------------|-------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Regras determinísticas de classes de variantes: ordem das palavras, ortografia, partícula opcional, sinônimo de lema, ambiguidade progressiva, inclusivo/exclusivo. Produz `lint_verdict` por entrada (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Determinístico: extração de lema por FST + glosas de dicionário + sobreposição de content-words spaCy. Produz vereditos (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| Idiomas GiellaLT | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Genérico: qualquer idioma com um FST fixado no harness (`mt_eval_harness/data/fst-pins.json`). Um analisador FST também produz `morphological_accuracy`; um speller apenas aceitador (os pacotes Divvun fixados para Sámi do Norte, Amárico e Basco) informa apenas aceitação. Ser pontuado por FST na prática também exige um conjunto de avaliação para o par que possa ranquear: os dois conjuntos de Plains Cree (EdTeKLA) são rótulos em quarentena contra os quais o banco de dados recusa uma pontuação, enquanto vários outros idiomas com FST têm conjuntos abertos (Tatoeba, WMT, WMT24++). A [página de datasets](/docs/network/leaderboard/datasets) lista o catálogo, e `mt-eval corpora --source eng --target <code>` lista o que pode ser executado para um par (consulte [Limitações Honestas](/docs/network/honest-limitations)). |

> **Nota de arquitetura (junho de 2026).** As métricas LYSS específicas de idioma agora são declaradas no card de idioma sob `evalMetrics` e carregadas a partir de `eval_standards/<lang>/` por `plugin_discovery.py`. Elas são **padrões de avaliação** (árbitro), e não métricas de plugin de método (competidor). Isso significa que qualquer método de tradução voltado para CRK é automaticamente verificado pelos diagnósticos LYSS — sem a necessidade de configuração específica do método. O `CrkFSTMetric` foi removido; sua funcionalidade é totalmente coberta pelo `GiellaLTFSTMetric` genérico.

## Apêndice C: Métricas Sob Consideração

Estas são ideias sendo avaliadas mas ainda não especificadas o suficiente para §2:

| Ideia | O que Mediria | Bloqueadores |
|------|----------------------|----------|
| Fluência (perplexidade de LM) | A saída é prosa bem-formada no idioma de destino? | Requer um LM de idioma de destino. Nenhum bom modelo existe para maioria dos LRLs. |
| Correspondência de registro | A tradução corresponde ao nível de formalidade esperado? | Requer classificadores sociolinguísticos. Problema de pesquisa. |
| Apropriação cultural | Referências culturais são tratadas corretamente? | Não pode ser automatizado — inerentemente requer revisão humana. |
| Coerência de discurso | Traduções consecutivas formam uma passagem coerente? | Requer avaliação no nível de documento, não no nível de sentença. |

---

## Referências

Artigos acadêmicos, ferramentas e recursos de idioma citados ao longo desta especificação.

### Métricas de Superfície

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhagen, Denmark.

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lisboa, Portugal.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Implementação de referência: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Prática de Avaliação e Testes de Significância

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, Espanha.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; informa chrF++ e spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

### Métricas Neurais

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Ababa, Ethiopia.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Online.

### Ferramentas Morfológicas e Linguísticas

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### Classificação de Erro e Avaliação Diagnóstica

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Trabalho relacionado em métricas de avaliação baseadas em recursos, incluindo FUSE.)

### Detecção de Alucinação

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. Online.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croatia.

### Recursos de Idioma Cree

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### Governança de Dados

18. Global Indigenous Data Alliance. "Princípios CARE para Governança de Dados Indígenas." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
