---
sidebar_position: 8
title: "Especificação de Construção da Fila"
slug: '/network/specifications/queue-construction'
description: "A fórmula transparente por trás da fila de computação comunitária: ranking por valor esperado da cadeia, cada componente publicado, cada classificação re-derivável manualmente."
related:
  - label: "Why the Queue Is Built This Way"
    to: /docs/network/perspectives/why-the-queue
    kind: position
    note: "The philosophy behind this formula"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
    note: "How to actually run queue items"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "Small-corpus floors and noise thresholds the formula inherits"
---

# Especificação de Construção da Fila

**Versão da fórmula: `ecv-v3` (valor de cadeia esperado com
confiabilidade de ponte).** Este documento é a definição normativa de como
[champollion.dev/queue.json](https://champollion.dev/queue.json) é
ordenado. A implementação
(`arena/scripts/generate_sweep_queue.py` no repositório público de teste)
espelha esta página seção por seção; os metadados da fila ecoam os
valores exatos de parâmetros usados no momento da geração, e **cada item
carrega seu detalhamento completo da fórmula**, então qualquer classificação pode ser re-derivada manualmente apenas do JSON publicado. Se esta página e a fila discordarem, isso é um bug — por favor, reporte.

**A fila hoje, em um parágrafo.** A fila pública contém tanto itens de LLM
(condições de prompting naive e coached) quanto itens de motores de serviços de MT
em um único painel, ordenados pela classificação de exploração (`map`, §2.2): primeira luz
entre pares, idiomas e famílias por dólar, com um impulso de primeira leitura
para idiomas que nunca foram medidos (§2.2), faixas de orçamento
publicadas na prévia (§2.1.1) e o ranking completo servido a partir
do banco de dados (o arquivo estático contém a fatia superior quando o ranking completo
ultrapassa seu limite de tamanho, e indica isso explicitamente). As seções abaixo constituem a definição
normativa, mantida com seu histórico de decisões datado — os metadados em qualquer
fila servida indicam os parâmetros exatos que a ordenaram.

> **v3 (2026-06-13).** Toda aresta agora é uma *ponte* com dois números —
> qualidade e confiabilidade — e a matriz de cadeia funciona no seu produto
> (§1.5). 62 itens de vocabulário de uma única palavra executados uma vez não podem mais parecer um caminho; replicações, corpora maiores, corpora mais ricos e intervalos de confiança mais apertados carregam valor precificado. Filas v2
> (apenas qualidade) permanecem interpretáveis via seus próprios metadados.

## 1. O objetivo: uma malha ponderada por qualidade

O objetivo é a *tradução entre idiomas, construída a partir de cadeias de
pares individuais medidos*. Uma tradução entre dois idiomas sem
benchmark direto é atendida pelo **encadeamento** de pares avaliados
(X→pivô→Y), de modo que o valor do benchmark não é o seu número de
corpora, mas a **capacidade de encadeamento do seu grafo**.

**Definições.** Seja o *grafo de benchmark* com um nó por linguagem e, para cada par de linguagens com pelo menos uma execução publicada e não desqualificada, uma **força de aresta**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

O chrF++ em nível de corpus é o número publicado canônico (veja a
[Especificação de Pontuação](/docs/network/specifications/scoring)); *melhor* porque
uma cadeia rotearia através do melhor sistema demonstrado por salto.
Pares sem execuções publicadas têm s(e) = 0.

A **força de cadeia estimada** de um caminho P entre duas linguagens é

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— qualidades de aresta se compõem multiplicativamente, e cada *junção* (cada pivô intermediário) custa um fator de fidelidade adicional **λ < 1**.
Ambas as escolhas são fundamentadas na literatura de tradução por pivô:
tradução através de um pivô confiavalmente perde qualidade em relação à tradução direta, além do que a composição ingênua sugere (Utiyama & Isahara 2007; Wu & Wang 2007), o tamanho da perda depende do pivô escolhido (Paul et al. 2009), e construir pares *diretos* não-centrados em inglês mede-se melhor que pivotagem em inglês em escala — por ~10 BLEU na configuração muitos-para-muitos do M2M-100 (Fan et al. 2021). λ é o lembrete permanente da fórmula de que uma cadeia estimada não é uma medição: apenas uma execução direta remove o desconto.

A **matriz de melhor cadeia** e o **objetivo de malha** são então

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Q é computado exatamente como um problema de caminho mais curto sob a transformação logarítmica padrão (peso de aresta −ln(λ·s(e)) ≥ 0, Dijkstra, então
Q = exp(−d)/λ). Φ é a construção de *eficiência global* de
[Latora & Marchiori (2001)](https://arxiv.org/abs/cond-mat/0101396) com o kernel de distância 1/ substituído por fidelidade de cadeia multiplicativa — o kernel natural quando arestas carregam retenção de qualidade por salto em vez de comprimentos unitários. (Fila v1 classificada por ganho de eficiência global não ponderado — o caso especial desta família onde tudo que você sabe sobre uma aresta é se ela existe.)

### 1.5 Confiabilidade: uma ponte é (q, r)

Uma pontuação chamativa em um corpus minúsculo, fino e nunca replicado não é uma ponte. v3 portanto divide cada aresta medida em:

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| Fator | Definição | Crédito completo em | Âncora |
|---|---|---|---|
| `f_size` | min(1, n/100), n = entradas avaliadas da melhor execução | 100 entradas | o piso de significância do [design de corpus](/docs/network/specifications/corpus-design); Koehn (2004) valida testes bootstrap em conjuntos de ~300 sentenças — até 300 é "pequeno", então o tamanho desconta confiabilidade em vez de meramente gating display |
| `f_rich` | min(1, L̄/5), L̄ = comprimento de fonte *efetivo* médio | 5 palavras efetivas | AmericasNLP (Mager et al. 2021) adotou chrF porque unidades em nível de palavra quebram em morfologia rica; Mager et al. (2022) documentam tokens de espaço em branco como a unidade errada |
| `f_conf` | min(1, 5/h), h = meia largura do IC 95% de chrF da melhor execução (proxy `50/√n` quando não publicado) | IC ≤ ±5 chrF | o piso de ruído abaixo do qual deltas são indistinguíveis em corpora pequenos; Kocmi et al. (2021) mostram que deltas dentro do IC frequentemente contradizem preferência humana |
| `f_repl` | min(1, execuções/2) | 2 execuções publicadas | Marie, Fujita & Rubino (2021), meta-avaliando 769 artigos: comparações únicas não replicadas são a falha de credibilidade documentada do campo |

**Comprimento efetivo** é medido em unidades de conteúdo, não palavras de espaço em branco: `L̄ = mean source chars / c(L)`, onde a *economia de caracteres*
`c(L)` é a mediana de caracteres no lado da linguagem L por palavra em inglês no lado alinhado, medida a partir dos corpora paralelos próprios deste projeto (7.400+ entradas alinhadas no tempo de envio v3: cmn 1.6, jpn 2.3, kor 2.6;
baseline eng 5.0; deu 6.0; crk 4.7 — palavras polissintéticas precificadas pelo conteúdo que carregam). Sem tabelas de consulta de tipologia; a estimativa se aguça conforme corpora crescem; linguagens sem dados pareados com eng usam a economia padrão. Marcado por corpus no registro (bloco `richness`).

**Camadas de ponte** (vocabulário de display): **estabelecida** — n ≥ 100,
L̄ ≥ 5, h ≤ 5, execuções ≥ 2; **provisória** — medida mas falhando em qualquer; **registrada** — sem execuções publicadas. Uma reivindicação de cadeia ("você pode ir de X para Y") é apenas tão forte quanto a camada do salto mais fraco, e a visualização de malha mostra confiabilidade como opacidade de aresta.

**Verificações trabalhadas** (do script de verificação verificado, executado antes do envio v3): *62 itens de vocabulário de uma única palavra, uma execução* → r ≈ **0.04**
(não é um caminho); *200 sentenças, ±3 IC, 3 execuções* → r = **1.00**; um corpus japonês de 101 entradas cuja contagem de palavras ingênua é 1.0 (artefato de script) se reabilita para 6.5 palavras efetivas e crédito completo `f_rich`.
Limites e monotonicidade por fator são testados por propriedade.

**Valor de uma execução sob v3.** Uma execução pode melhorar uma ponte de duas formas, e ΔΦ toma a melhor: **(a)** ela se torna a melhor execução da aresta — `ŝ_eff = qualidade prevista × r(n do corpus, riqueza, proxy IC,
execuções+1)`; ou **(b)** ela meramente replica — a melhor atual permanece,
`f_repl` sobe. Replicação em uma aresta de execução única é portanto valor real,
precificado, e um corpus maior ou mais rico em um par medido supera uma re-execução do pequeno. Itens expõem `edge_quality`,
`edge_reliability`, `edge_tier`, `effective_strength`,
`post_run_reliability`, e `predicted_effective` ao lado dos campos de previsão v2.

**O que Φ não é.** Φ é a moeda de priorização interna da fila,
não uma reivindicação de capacidade. Suas entradas são pontuações de conjunto de desenvolvimento com todas as ressalvas do [Framework de Design de Corpus](/docs/network/specifications/corpus-design): possível contaminação de dados de treinamento torna cada pontuação um limite superior, valores chrF++ não são estritamente comparáveis entre linguagens, e corpora pequenos carregam intervalos de confiança amplos. A fórmula apenas precisa que Φ *ordene execuções por utilidade*; nunca é publicado como garantia de qualidade.

## 2. O problema de decisão

Os itens abertos da fila são todas as combinações de (corpus, modelo, condição)
que são elegíveis (split de desenvolvimento, licença redistribuível,
não em quarentena, elegível para transmissão e
**resolvível para benchmark** — consulte o filtro de identidade de idioma no §2.2) e
ainda não presentes no leaderboard. Execuções idênticas repetidas de combinações
já cobertas são excluídas — fingerprints nos run-cards fazem a deduplicação na publicação —, mas novos
modelos ou condições em um par já medido permanecem como itens abertos.

Computação contribuída é um orçamento. Escolher qual item aberto executar a seguir para que a malha melhore mais rápido é uma maximização de cobertura com orçamento, e a abordagem canônica é seleção gulosa por
**valor marginal por unidade de custo**: para objetivos submodulares monótonos a regra gulosa carrega a garantia clássica (1 − 1/e) (Nemhauser, Wolsey & Fisher 1978), e sua forma de razão benefício/custo é o algoritmo padrão sob orçamentos (Khuller, Moss & Naor 1999). Usamos a regra de razão como nosso princípio de classificação. (Nota de honestidade: nosso objetivo tem retornos decrescentes de cobertura em seu núcleo determinístico, mas a camada de previsão estocástica significa que citamos a garantia gulosa como *motivação*, não como um teorema sobre este sistema exato.)

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

Itens são classificados por ECV descendente. Empates quebram: ingênuo antes de treinado, mais barato primeiro, depois id do item.

### 2.1 Remediações de classificação — 2026-07-12

Quatro ajustes em camadas sobre a regra ECV gulosa, cada um refletido nos metadados da fila (`priority_parameters.contamination_ecv_factors`,
`priority_parameters.frontier_interleave`, `metadata.preview_policy`):

1. **Multiplicador de contaminação.** O ECV de cada item é multiplicado por um fator do grau de contaminação de seu corpus: **LOW 1.0 / MEDIUM 0.4 / HIGH 0.1**, com um grau desconhecido ou ausente tratado como MEDIUM (nunca assuma limpeza). Justificativa: o grafo de cadeia limpa admite apenas arestas de contaminação LOW, então uma execução não-LOW não pode entrar nele e não deve superar o trabalho de malha limpa com custo igual. Itens não-LOW permanecem na fila — comparações de faixa relativa têm valor real — eles apenas classificam atrás do trabalho limpo.
2. **Intercalação de fronteira.** Após a classificação gulosa, cada 5º slot de prioridade carrega o item de classificação mais alta ainda não colocado do conjunto do modelo de fronteira (mantido como dados no gerador e refletido nos metadados), para que a evidência de fronteira alcance os priors de predição cedo em vez de apenas após os níveis baratos saturarem. Pura reordenação: nada é descartado ou duplicado, um item de fronteira que conquistou um slot natural o mantém, e as prioridades são numeradas a partir da ordem tecida — a classificação publicada é a verdade.
3. **Limite de hub de fonte de visualização.** A visualização pública dos 25 principais mostra no máximo **6** itens compartilhando um idioma de origem, para que um hub bem-recursos único não monopolize a vitrine. Itens acima do limite mantêm sua prioridade real na fila completa; a visualização simplesmente puxa o próximo item elegível em ordem de classificação.
4. **Exclusão de linguagem construída na visualização.** Itens cuja origem ou destino é uma linguagem construída são ignorados pela visualização. A determinação é orientada por família de cartão (bucket de Linguagem Artificial do Glottolog, lido dos cartões de idioma — nunca um conjunto de idioma codificado), e a lista de código derivada é publicada em `metadata.preview_policy` para que atualizações do lado do servidor apliquem a mesma seleção.

(3) e (4) são **política de apresentação apenas**: a `queue.json` completa, sua classificação e suas prioridades não são afetadas.

### 2.1.1 Faixas de orçamento — "o que $X compra?" (2026-08-24)

`queue-preview.json` traz um array `budget_tiers` resumindo, para
orçamentos de **$1 / $10 / $100 / $1000**, o prefixo guloso acessível do
ranking publicado: percorra os itens em ordem de prioridade, inclua cada item
cujo custo estimado ainda caiba no orçamento, pule os que não cabem
e continue preenchendo com itens posteriores mais baratos. Cada faixa informa quantos
itens isso compra, o custo estimado total deles, quantos pares de idiomas
e modelos distintos eles abrangem e até que profundidade do ranking o orçamento
alcança (`max_priority`).

Como o ranking já representa o valor marginal por custo (§2), o prefixo guloso
acessível **é** a alocação recomendada por este modelo para esse
gasto — um contribuidor pequeno e um grande obtêm, cada um, uma
resposta concreta e ideal a partir do mesmo ranking publicado, em vez de uma lista
dimensionada implicitamente para ninguém. As faixas são apenas resumos: a
alocação em si é apenas o ranking, percorrido em ordem em relação ao seu
próprio orçamento. As atualizações no lado do servidor recalculam as faixas sobre os
itens restantes com o mesmo percurso idêntico (o gerador e a função de atualização
o implementam como pares idênticos, testados em ambos os lados).

### 2.2 Lanes e modos de ranking — 2026-07-19

A fila servida declara, em seus próprios metadados, qual **lane**
ela contém e qual **modo de ranking** a ordenou. Os metadados são a
autoridade; esta seção define o vocabulário.

**Lanes** (`metadata.lane`, `metadata.lane_policy`). Desde 2026-08-27,
a fila pública contém a lane **both**: itens de LLM (modelo ×
condição de prompting) **e** itens de serviços de MT (condição `engine` —
DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde;
cada um enfileirado apenas para pares dentro da sua própria lista de cobertura publicada).
A lane **llm** de 2026-07-19 — apenas itens de LLM, restritos a pares onde
pelo menos um dos lados está fora da cobertura publicada de todos os serviços de MT —
reservava o benchmark de serviços para campanhas executadas pelos organizadores que
nunca aconteceram, o que estagnou a maior parte do catálogo; medir os serviços *é*
a espinha dorsal do mapa de cobertura, portanto ambos os tipos de trabalho agora estão em um
único painel. A união de cobertura (com alias de macroidioma via language
cards) ainda é reproduzida como `service_coverage_methods` e
`service_covered_languages`, e uma fila da lane llm ainda relata seus
pares excluídos como `pairs_dropped_fully_covered`.

**Limite de tamanho do blob** (2026-08-27). O `queue.json` servido é um arquivo
estático com um teto rígido de hospedagem; portanto, quando o ranking completo o ultrapassa,
o arquivo carrega a **fatia superior** do ranking e indica isso em
`metadata.blob_truncated {kept, total}` — nunca um limite silencioso. A fila do
banco de dados (`queue_top()` / `queue_pairs()`) sempre serve o
ranking **completo** e é a lista de trabalho definitiva; a agregação de pares
e as faixas de orçamento da prévia descrevem o artefato com o qual são enviadas.

**Filtro de identidade de idioma** (2026-07-19). Os itens da fila têm como alvo apenas
**códigos individuais ISO 639-3 ativos** — uma pontuação em relação a um macroidioma
("árabe") ou a um código de família coletiva ("línguas berberes") seria uma
alegação infalseável sobre variedades que nunca foram avaliadas (o mesmo raciocínio
que o FLORES-200/NLLB segue ao codificar dados como `arb`/`quy`/`zsm`). Os rótulos de
corpora upstream são *resolvidos*, nunca obedecidos ou descartados cegamente: tags de escrita (script)
são removidas mecanicamente (um corpus `eng→cmn-Hans` é enfileirado para `eng→cmn`,
com a escrita mantida como metadado de exibição do item `source_script`/
`target_script`); códigos descontinuados de forma limpa seguem seu sucessor oficial da ISO;
e um corpus rotulado como macro só entra na fila sob uma **resolução de variedade**
registrada e citada em sua entrada no registro (por exemplo, o FLORES+
documenta seu quíchua como `quy`). Corpora que não se resolvem por nenhum dos caminhos
são excluídos com justificativas legíveis por máquina publicadas em
`metadata.doctrine_exclusions` (total, contagens por motivo, motivos por corpus)
e contabilizados no registro de desertos
(`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`) —
exclusões visíveis, nunca descartes silenciosos. Resultados históricos em corpora
com rótulos genéricos mantêm seu próprio nó na malha honestamente nomeado
(nó `scope`: `macrolanguage` / `collective` / `retired`), nunca
mesclados a uma variedade integrante. As entradas de resolução são todas publicadas:
os carimbos `language_resolution` por entrada do registro contêm
os códigos resolvidos, escopos e citações de fixação.

**Modos de ranking** (`metadata.rank_mode`, descritos em
`metadata.priority_model`). Duas ordenações dos mesmos itens:

- **ecv** — a regra gulosa de valor esperado da cadeia (expected-chain-value) dos §2–§3:
  melhoria da malha por dólar estimado. A ordenação de exploração intensiva (exploitation); adequada
  quando o painel estiver denso o suficiente para que previsões e ΔΦ tragam
  sinal.
- **map** (map-value v2) — a ordenação de exploração/mapeamento (survey):
  `MapValue = novelty × uncertainty × promise × connectivity ×
  corpus-quality × contamination ÷ cost`, montada por um rastreamento guloso
  exato. *Novelty* (novidade) é o crédito posicional de primeira luz que decai conforme
  itens já posicionados ocupam o mesmo par direcionado (1/(1+n)), idioma
  de destino, família de destino, célula de método × família de destino e célula de
  destino × domínio (cada uma 1/√(1+n); famílias dos language cards,
  domínios da taxonomia do registro de corpora — a cobertura inicial de um destino
  deve se espalhar entre registros, não repetir o primeiro domínio medido).
  *Uncertainty* (incerteza) é a profundidade de recuo (back-off) da previsão do §3.1
  (par 0,25 · idioma de destino 0,55 · idioma de origem 0,75 · global
  1,0) × 1/(1+execuções publicadas na aresta). *Promise* (promessa) é a força prevista
  do §3.1 limitada por baixo em 0,25 — itens desconhecidos com alta probabilidade
  de funcionar lideram, e mapear um provável deserto ainda tem valor. *Connectivity*
  (conectividade) prioriza pares que **conectam a rede medida a um idioma que
  ela ainda não alcança**: um endpoint é *estabelecido* quando está em uma
  aresta medida da malha (`mesh.json`, status `measured`) ou dentro da lista de cobertura
  publicada de qualquer serviço de MT (com alias de macroidioma, o mesmo alias
  do filtro de lane acima); **pontes** (exatamente um endpoint estabelecido)
  e **ilhas** (nenhum) pontuam 1,0 — desde 2026-08-27, a primeira luz de um
  deserto desconectado conta integralmente (ilhas pontuavam 0,5 sob o dimensionamento
  de expansão a partir da rede de 2026-07-19, que rebaixava estruturalmente a cauda mais profunda) —
  enquanto o adensamento **interior** (ambos estabelecidos) pontua 0,5:
  o fortalecimento entre pontos conhecidos é função do modo ecv. Um
  **impulso de primeira leitura** (×2,0) multiplica adicionalmente o valor de
  exploração de qualquer item cujo idioma de origem ou destino tenha ZERO medições
  publicadas em qualquer lugar — o nono princípio, dito claramente: **a
  primeira leitura de um idioma supera o refinamento**. O fator de incerteza
  sozinho não consegue expressar isso (ele pontua um par não medido entre dois
  idiomas bem medidos da mesma forma que um idioma nunca medido); o impulso torna a primeira
  luz da cauda longa um objetivo declarado, em vez de um acidente emergente. Ambos
  os fatores estão em `metadata.map_value_parameters` e aplicam-se de forma idêntica
  dentro do componente de exploração do edv (§2.3).

  A outra metade do nono princípio vive FORA do ranking: nenhuma ordenação
  de itens existentes pode alcançar um idioma sem nenhum corpus
  (~7.500 idiomas vivos com código individual hoje). A **lista de desejos
  de corpora** (`/corpus-wishlist.json`, regenerada junto com a fila)
  publica essa fronteira de aquisição: cada idioma vivo, com código individual e
  sem corpus, classificado por sua contagem de falantes mais citada — contagem
  de falantes como proxy de viabilidade para uma comunidade que poderia
  realmente construir um corpus — com cada contagem atribuída à sua fonte e
  nunca arbitrada.
  *Corpus-quality* (qualidade do corpus) é o potencial intrínseco de confiabilidade
  do corpus `f_size × f_rich` do §1.5 — a exploração deve priorizar corpora que
  sustentem peso, para que uma lista de vocabulário de palavras únicas com 62 entradas
  não fique no topo apenas por ser barata; uma medição de riqueza ausente permanece
  neutra (ausência de medição não é evidência de pobreza). A disciplina de custo e
  contaminação é idêntica à do ecv. O intercalamento de fronteira e os critérios de
  desempate (§2.1) aplicam-se inalterados. Ideal para a fase de exploração:
  maximiza o que o *mapa aprende* por dólar — primeiras medições entre pares,
  idiomas, famílias, células de métodos e domínios, expandindo-se a partir da
  rede medida em vez de se dispersar — ao preço deliberado de um crescimento
  mais lento da força da malha.

> **map-value v2 (2026-07-19).** Duas adições determinadas pelos fundadores
> à ordenação de exploração: pares que *fazem a ponte com a rede medida* agora
> se classificam à frente de sondagens desconectadas e do adensamento interior, e
> a qualidade do corpus (piso de tamanho × riqueza efetiva, §1.5) mais a dispersão
> de domínios por destino ponderam o ranking — a computação dos contribuidores
> deve conectar caminhos estabelecidos a novos, em corpora bons o suficiente para
> sustentar o peso. A licença continua sendo um **filtro, não um peso**: as regras
> de licenciamento e canais de transmissão decidem o que pode ser enfileirado (§2
> e o `transmission_note` da fila); entre os corpora elegíveis, o ranking não distingue licenças,
> de modo que conjuntos de pesquisa restritos, porém fixados (pinned) — muitas vezes
> o único corpus de um par — nunca sejam sistematicamente privados de recursos. As filas v1
> (apenas novelty × uncertainty × promise) continuam interpretáveis por meio de seus próprios metadados.

Os valores exatos dos fatores usados na geração são enviados em
`metadata.map_value_parameters`; as entradas de conectividade e qualidade podem
ser derivadas novamente a partir do `mesh.json` publicado (arestas medidas), da
união de cobertura dos serviços reproduzida nos metadados e de `registry.json`
(contagens de entradas + riqueza). Cada item retém adicionalmente todos os
campos de diagnóstico ecv-v3, independentemente do modo, para que qualquer
uma das ordenações possa ser derivada novamente a partir dos mesmos artefatos.

### 2.3 Modo de ranking `edv` — valor de decisão esperado (2026-08-27)

*Status: implementado, desativado por padrão aguardando a comparação medida no
§2.3.6. O padrão publicado permanece `map` até lá.*

A fila compra exatamente dois produtos: o **mapa de capacidades** (qual
método é bom em quê, com incerteza honesta) e a **malha de roteamento**
(pares medidos que se encadeiam em rotas). O `edv` precifica cada
item candidato por quanto ele avança em ambos, como um portfólio ponderado:

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

com padrões `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40`
(ajustáveis pelos fundadores; cada geração reproduz os pesos realmente utilizados em
`metadata.edv_parameters`). O fator de contaminação (§2.1 remédio 1) é
aplicado exatamente uma vez, como o multiplicador externo. O licenciamento e a
transmissão continuam sendo **filtros, não pesos** — a elegibilidade é decidida
antes que qualquer valor seja calculado, e o ranking não distingue licenças entre
os corpora elegíveis.

#### 2.3.1 Ĵ — valor de julgamento de método

Precifica o quanto a execução avança na **resolução de comparações de métodos
no mesmo corpus** — a única afirmação entre métodos que a pesquisa de medição
deste projeto autoriza. (O estudo de transferência de dificuldade W2
rejeitou a vinculação de habilidades entre idiomas; seu resultado positivo autorizado —
ajuste aditivo de método × corpus dentro do mesmo idioma — é exatamente o que
este componente utiliza. As pontuações são usadas apenas para ordenação e separação,
nunca convertidas em probabilidades de aceitabilidade, de acordo com o piloto de calibração.)

Para um candidato (corpus C, método M, condição): os **parceiros de contraste**
são os métodos M′ que já possuem uma execução publicada em
(C, mesma condição). Para cada parceiro, com `sep` representando a separação de pontuação
em pontos chrF dividida pelas metades dos intervalos de confiança agrupados (CIs registrados; proxy `50/√n`
quando não publicados), e `sep_pred` sendo o mesmo calculado em relação à pontuação prevista do §3.1:

| estado de contraste de {M, M′} no par | crédito |
|---|---|
| **não atendido** — ainda sem corpus compartilhado | `JUDGE_FIRST = 1.0` |
| **contestado** — existem corpora compartilhados, todos `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **decidido** — algum `sep ≥ Z_DEC`, n_dec corpora o decidem | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

cada um multiplicado por `w_top = 1/√(rank(M)·rank(M′))` — decidir o primeiro
lugar contra o segundo vale mais do que o sétimo contra o oitavo. O
ranking de métodos por par usa o ajuste aditivo método × corpus autorizado
(mínimos quadrados alternados sobre as células observadas) quando o par possui ≥2
métodos × ≥2 corpora medidos; caso contrário, a melhor pontuação por método; o ajuste é
**estritamente por par, nunca agrupado entre idiomas**. `Z_DEC = 1.96`.

Um contraste coached-vs-naive no mesmo (C, M) adiciona
`JUDGE_COND = 0.5 / (1 + n_cond)`. Os contrastes de um item são somados com
retornos decrescentes (`JUDGE_GAMMA = 0.7` por contraste adicional,
ordenados em ordem decrescente), mais um **termo semente**
`JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality` (m_C = outros
métodos da lineup com um item na fila em C) para que um painel vazio ainda prefira
corpora onde comparações futuras possam ser julgadas — valor do espaço de teste, nunca uma
pontuação emprestada. Durante a montagem, o componente de julgamento decai
`1/(1 + items already placed on the same pair and condition lane)`.

#### 2.3.2 M̂ e Ŝ

`M̂` é o ganho de malha esperado (ΔΦ) do §3, inalterado, com a matriz de cadeias
congelada no momento da geração. `Ŝ` é o núcleo do map-value v2 do §2.2 —
`uncertainty × promise × connectivity × corpus-quality` com o
decaimento de novidade posicional — inalterado. O *nível* de pontuação prevista
(promessa) reside apenas em Ŝ; Ĵ utiliza apenas as *separações* de pontuação —
os dois componentes não podem contar o mesmo otimismo duas vezes.

#### 2.3.3 Normalização

Os três componentes operam em escalas incomensuráveis, portanto cada
componente estático é dividido pelo seu 95º percentil sobre o conjunto de candidatos
(limitado em `EDV_NORM_CAP = 4.0`); os três normalizadores são enviados em
`metadata.edv_parameters.normalizers`, tornando cada valor EDV publicado
passível de ser derivado novamente a partir de seus próprios artefatos.

#### 2.3.4 Montagem

A ordenação segue exatamente o mesmo rastreamento preguiçoso-guloso (lazy-greedy) do modo map: cada
multiplicador dependente de ordem (novidade de exploração, decaimento de posicionamento do juiz) é
monótono não crescente à medida que os itens são posicionados, de modo que uma entrada desatualizada
no heap só pode superestimar — o invariante do lazy-greedy se mantém e o rastreamento
é equivalente ao método guloso por força bruta. O intercalamento de fronteira, a política de prévia e
as faixas de orçamento aplicam-se inalterados.

#### 2.3.5 Explicabilidade

Cada item retém, em seus diagnósticos: a lista de contrastes pelos quais
recebeu crédito (parceiro, estado, separação prevista, peso no ranking),
os termos de semente e decaimento, todos os campos dos §2.2 e §3, os pesos e
normalizadores — o valor publicado de EDV pode ser exatamente recalculado a partir da
linha. "Como este item obteve este ranking?" pode ser respondido sem qualquer
estado externo.

#### 2.3.6 Critério de adoção

`edv` torna-se o padrão publicado apenas após uma comparação medida
contra `map` e `ecv` no mesmo painel: dentro de 10% do map em todas as
métricas de exploração (percentis de profundidade de primeira luz, pares/idiomas/famílias
distintos em profundidade, taxa marginal de novos pares), estritamente melhor em ambas as métricas
de juiz (contrastes contestados resolvidos por $1.000 simulados; recuperação do ranking de métodos
com gasto fixo) e crescimento da malha por dólar não inferior ao map. O relatório de comparação é
publicado junto com a transição.

## 3. O valor de uma execução

### 3.1 Prevendo a pontuação antes de executar

A pontuação esperada de um (par, modelo, condição) não executado é uma
soma deliberadamente simples, totalmente inspecionável — uma previsão de efeitos principais bidirecional mais otimismo estruturado, cada termo publicado no item:

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — retrocesso hierárquico sobre forças publicadas:
  média neste par → média nesta linguagem alvo → média nesta
  linguagem fonte → média global → `S0_FALLBACK`. O nível usado é
  publicado como `prior_basis`.
- **`model_offset`** — como este modelo se comporta em relação aos *outros*
  modelos no mesmo par, em média sobre todos os pares onde uma comparação
  existe. Zero para modelos nunca vistos.
- **`condition_offset`** — o delta treinado-menos-ingênuo observado no
  mesmo par (retrocedendo para a mesma linguagem alvo), e **zero
  caso contrário**: ganhos de treinamento são reais onde medidos mas não são
  assumidos transferir entre linguagens, então em pares não evidenciados a convenção de linha de base primeiro vale.
- **`exploration_bonus`** — otimismo diante da incerteza, com
  o cronograma UCB1 (Auer, Cesa-Bianchi & Fischer 2002):
  `κ·sqrt(2·ln(1+N)/(1+n))`, onde N é o número total de execuções
  publicadas pontuadas e n o número neste (par, modelo). Células nunca tentadas recebem o maior bônus; células bem medidas decaem para zero.
  Pegamos emprestado o cronograma — a forma que faz braços sub-explorados ressurgirem na taxa certa — não o teorema de arrependimento, que assume um bandido estacionário este sistema não é.

### 3.2 O ganho de malha, em forma fechada

Uma execução pode apenas melhorar a malha elevando a aresta de seu par para
`s' = max(s(e), ŝ)`. Para uma mudança de aresta única, a nova melhor cadeia
entre quaisquer duas linguagens ou ignora a nova aresta ou a usa exatamente uma vez, então a matriz atualizada — e portanto ΔΦ — tem uma forma exata de uma linha (sem re-resolver o grafo inteiro):

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

E é "a melhor cadeia para o ponto final da nova aresta, pagando a junção para emendá-la"; os dois termos são as duas direções de cruzar a aresta. Isso é testado na suíte de teste contra recomputação de força bruta de Φ.

Uma previsão que não pode superar a força de aresta atual produz
ΔΦ = 0: a fórmula gasta o dinheiro dos doadores confirmando o desconhecido, não re-medindo o demonstrado. (O bônus de exploração mantém células fracas ou sub-amostradas de serem privadas para sempre.)

### 3.3 O que conta como evidência vs. o que pode ser enfileirado

Dois portões diferentes, deliberadamente assimétricos:

- **Evidência** vem de *toda* execução publicada, não desqualificada —
  incluindo execuções em corpora que não podem ser enfileirados publicamente (ex.
  conjuntos com licença não comercial). Uma medição publicada de um par
  é conhecimento independentemente de você poder re-executá-lo.
- **Ações** (itens de fila) vêm apenas de corpora abertamente executáveis:
  divisão de desenvolvimento, licença família CC-BY, buscável por qualquer um.

Linguagens alcançáveis apenas através de corpora não enfileiráveis ainda estão no
grafo: melhorar arestas *ao redor* delas muda seus valores de cadeia,
e a fórmula contabiliza.

## 4. Parâmetros

| Parâmetro | Padrão | Significado e justificativa |
|---|---|---|
| `λ` (`lambda_junction_discount`) | **0.9** | Retenção de fidelidade por junção de uma cadeia *estimada*. Codifica "medição direta supera encadeamento de produto igual" (Utiyama & Isahara 2007; Wu & Wang 2007; Fan et al. 2021). O corte de ~10% é uma escolha de calibração, revisitada conforme triângulos de cadeia medidos se acumulam (§6). |
| `κ` (`kappa_exploration_scale`) | **0.05** | Escala de bônus de exploração, em unidades de força. 0.05 ≡ 5 pontos chrF++ — o piso de ruído abaixo do qual diferenças de pontuação são indistinguíveis em corpora sub-100-entrada ([Corpus Design §6.3](/docs/network/specifications/corpus-design)). Otimismo é limitado à resolução do instrumento. |
| `S_CAP` | **0.95** | Teto de previsão — nenhuma aresta estimada pode reivindicar fidelidade quase perfeita que não demonstrou. |
| `S0_FALLBACK` | **0.5** | Prior de par de último recurso, usado apenas quando não há resultados publicados (a média global observada — ≈ 0.54 sobre as primeiras 429 execuções — é preferida sempre que qualquer resultado existe). |
| `COST_FLOOR` | **$0.01** | Piso para o denominador ECV, então execuções quase gratuitas não podem reivindicar valor ilimitado por dólar. |
| `N_FULL` | **100** | Entradas avaliadas para crédito de tamanho completo (§1.5). |
| `L_HEALTHY` | **5.0** | Palavras efetivas para crédito de riqueza completa (§1.5). |
| `H_NOISE` | **±5 chrF** | Meia largura de IC para crédito de confiança completo; ICs faltantes proxy como 50/√n (ancorado a ±5 em n=100). |
| `RUNS_FULL` | **2** | Execuções publicadas para crédito de replicação completo. |

**Versionamento.** Mudanças de parâmetro ou fórmula aumentam `formula_version`
(metadados) e a linha de versão desta página. A fila sempre ecoa os
valores exatos usados sob `metadata.priority_parameters`, incluindo o
Φ atual, então filas históricas permanecem interpretáveis. Execuções de sensibilidade estão a uma flag de distância: `generate_sweep_queue.py --lam 0.8 --kappa 0.1`.

## 5. Exemplo trabalhado (valores ao vivo, 2026-06-12)

Geração contra 424 execuções pontuadas, 59 arestas medidas, 60 linguagens;
**Φ = 0.272**. O item superior:

```
eng>fao · claude-haiku-4.5 · naive
  edge_strength        0.0      (no published eng→fao runs)
  pair_prior           0.613    basis: target-language (Faroese runs exist via dan→fao)
  model_offset        −0.114    (haiku trails other models on shared pairs)
  condition_offset     0.0      (no coaching evidence for fao)
  exploration_bonus   +0.174    (never-run cell: κ·√(2·ln 425 / 1))
  predicted_strength   0.673
  expected_mesh_gain   0.0181   (eng→fao is a near-component join)
  est_cost_usd         0.0101
  ecv_per_usd          1.79     ← rank #1
```

Leia de volta: Faroês está conectado à malha apenas através do dinamarquês, então
uma aresta eng→fao medida atalha uma enorme família de cadeias (o grande
ΔΦ); o modelo é previsto no meio do pacote em um par como este (prior +
offset), ninguém nunca tentou esta célula (grande bônus), e a execução
custa um centavo. Nada mais na fila compra mais malha por dólar.
A mesma aritmética, com cada entrada publicada, produz cada outra
classificação.

## 6. Limitações conhecidas (e o que as corrigiria)

1. **chrF++ não é comparável entre linguagens.** Morfologia move a
   escala; uma aresta 0.5 em Basco não é a mesma realização que em Holandês. Mitigação: prioridades são dominadas por *estrutura* (transições s = 0 →
   s > 0) onde efeitos de escala são de segunda ordem. Correção:
   normalização de pontuação por linguagem, ou métricas com melhor
   calibração entre linguagens conforme ficam disponíveis para estas
   linguagens.
2. **O modelo de cadeia produto-λ é um prior, não uma medição.** É
   direcionalamente apoiado pela literatura de pivô mas não calibrado
   para tradução LLM. Correção (planejada): a malha agora contém
   triângulos medidos (ex. deu→fra direto ao lado de deu→eng→fra), então saída encadeada pode ser pontuada diretamente e λ ajustado aos dados em vez de escolhido.
3. **Contaminação e status de conjunto de desenvolvimento.** Forças de aresta herdam cada ressalva de conjuntos de desenvolvimento públicos — trate Φ como um sinal de planejamento de limite superior, nunca uma reivindicação de capacidade
   ([Corpus Design](/docs/network/specifications/corpus-design)).
4. **Cegueira de domínio.** Uma aresta medida em texto conversacional é
   tratada como um número; cadeias cruzando domínios degradarão mais
   que λ prediz.
5. **Direcionalidade.** Arestas são atualmente não direcionadas (evidência X→Y
   ilumina X↔Y). Quando composição de cadeia se torna sensível à direção na
   prática, forças se dividem por direção — a fórmula é inalterada,
   o grafo apenas dobra.

## 7. Referências

- Latora, V. & Marchiori, M. (2001). *Efficient Behavior of
  Small-World Networks.* Physical Review Letters 87, 198701.
  [arXiv:cond-mat/0101396](https://arxiv.org/abs/cond-mat/0101396)
- Auer, P., Cesa-Bianchi, N. & Fischer, P. (2002). *Finite-time
  Analysis of the Multiarmed Bandit Problem.* Machine Learning 47,
  235–256. [doi:10.1023/A:1013689704352](https://link.springer.com/article/10.1023/A:1013689704352)
- Nemhauser, G., Wolsey, L. & Fisher, M. (1978). *An Analysis of
  Approximations for Maximizing Submodular Set Functions—I.*
  Mathematical Programming 14, 265–294.
  [doi:10.1007/BF01588971](https://link.springer.com/article/10.1007/BF01588971)
- Khuller, S., Moss, A. & Naor, J. (1999). *The Budgeted Maximum
  Coverage Problem.* Information Processing Letters 70(1), 39–45.
  [doi:10.1016/S0020-0190(99)00031-9](https://dl.acm.org/doi/10.1016/S0020-0190(99)00031-9)
- Utiyama, M. & Isahara, H. (2007). *A Comparison of Pivot Methods for
  Phrase-Based Statistical Machine Translation.* HLT-NAACL 2007,
  484–491. [ACL Anthology N07-1061](https://aclanthology.org/N07-1061/)
- Wu, H. & Wang, H. (2007). *Pivot Language Approach for Phrase-Based
  Statistical Machine Translation.* ACL 2007; journal version Machine
  Translation 21(3), 165–181.
  [doi:10.1007/s10590-008-9041-6](https://link.springer.com/article/10.1007/s10590-008-9041-6)
- Paul, M., Yamamoto, H., Sumita, E. & Nakamura, S. (2009). *On the
  Importance of Pivot Language Selection for Statistical Machine
  Translation.* NAACL-HLT 2009 Short Papers, 221–224.
  [ACL Anthology N09-2056](https://aclanthology.org/N09-2056/)
- Haffari, G., Roy, M. & Sarkar, A. (2009). *Active Learning for
  Statistical Phrase-Based Machine Translation.* NAACL-HLT 2009,
  415–423. [ACL Anthology N09-1047](https://aclanthology.org/N09-1047/)
- Fan, A. et al. (2021). *Beyond English-Centric Multilingual Machine
  Translation.* Journal of Machine Learning Research 22(107), 1–48.
  [arXiv:2010.11125](https://arxiv.org/abs/2010.11125)
