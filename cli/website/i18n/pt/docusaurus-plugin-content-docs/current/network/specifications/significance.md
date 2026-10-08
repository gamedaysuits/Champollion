---
sidebar_position: 7
title: "Teste de Significância Estatística"
slug: '/network/specifications/significance'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The scores these tests protect"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "Where significance gates what ranks"
---

# Testes de Significância Estatística

> **Status**: ✅ Lançado. Testes de significância pareados (randomização aproximada por padrão; bootstrap pareado sob solicitação) e intervalos de confiança por bootstrap estão implementados em `mt_eval_harness/significance.py` e `mt_eval_harness/confidence.py`, exportados a partir do pacote, expostos na CLI e cobertos pelas suítes de teste de significância / confiança / pontuação.
> **Base de código**: `arena` — integrado a `tester.py` (intervalos de confiança por execução) e `compare.py` (significância entre execuções).
> **Objetivo**: Permitir que pesquisadores determinem se a diferença entre duas execuções de avaliação é estatisticamente significativa ou apenas ruído.

Esta página documenta o **comportamento entregue** — é descritiva, não uma lista de tarefas.

---

## Por Que Isso Importa

Ao comparar duas execuções (ilustrativo: Sistema A chrF++ 42.96 vs Sistema B chrF++ 41.80 em 92 entradas), uma diferença de ponto bruto não diz nada por si só sobre se é real ou ruído. Com apenas ~92 entradas de teste, variação aleatória pode facilmente produzir oscilações de 1–2 pontos. Especialistas pedem testes de significância — então o harness os calcula.

**Sob o padrão de pontuação (`standard/1`), o teste pareado em chrF++ é o que decide se uma execução é melhor do que outra.** chrF++ é a métrica primária pré-declarada ([Especificação de Pontuação](/docs/network/specifications/scoring#how-runs-are-scored)). BLEU, spBLEU, TER e COMET (quando ambas as execuções possuem pontuações COMET por segmento do mesmo modelo) são testados e exibidos como métricas padrão secundárias, e correspondência exata e taxas de plugins atuam como diagnósticos; nenhum deles toma a decisão. Isso segue Kocmi et al. (2021, "To Ship or Not to Ship"), que constataram através de milhares de avaliações humanas que uma diferença de métrica juntamente com sua significância é o que prevê a preferência humana.

---

## Algoritmo: Randomização Aproximada Pareada (padrão)

`mt-eval compare --significance` usa o teste de **randomização aproximada (AR)
pareada** de Riezler & Maxwell (2005). Este também é o padrão do SacreBLEU para
comparação de sistemas.

### Como Funciona

Dados dois sistemas A e B avaliados nas mesmas N entradas de teste:

1. Calcular a diferença observada no nível do corpus: `Δ = metric(A) - metric(B)`.
2. Repetir `n_trials` vezes (padrão: 1000):
   a. Para cada entrada, trocar as saídas de A e B com probabilidade de ½.
   b. Recalcular a métrica do corpus nas duas pilhas embaralhadas.
   c. Registrar se `|Δ_shuffled| ≥ |Δ|`.
3. O p-valor é o nível de significância alcançado bicaudal:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. O +1 contabiliza a
   atribuição observada como uma amostragem válida, de modo que p nunca seja exatamente 0.
4. Se p < α (padrão: 0.05), a diferença é relatada como significativa.

O intervalo de confiança para Δ é um intervalo percentil de bootstrap (AR produz um
p-valor, não um intervalo). Ele é calculado em um fluxo aleatório separado para que
não interfira nas amostragens de AR.

### Propriedades-Chave

- **Um teste de hipótese real:** as permutações são extraídas sob a hipótese nula
  de que não faz diferença qual sistema produziu uma determinada entrada.
- **Pareado:** ambos os sistemas são comparados entrada por entrada, o que preserva
  a correlação no nível da entrada.
- **Não paramétrico:** não faz suposições sobre como as pontuações estão distribuídas.

### O bootstrap pareado (disponível, não padrão)

`paired_bootstrap()` implementa o bootstrap pareado de Koehn (2004): ele reamostra
entradas com reposição e conta com que frequência o sinal de Δ se inverte. Ele é
oferecido para fins de comparabilidade com artigos mais antigos, mas é uma heurística de
robustez de sinal, não um nível de significância de livro didático. Sua distribuição é centrada no
Δ observado, não na hipótese nula, podendo superestimar a significância em comparação
com AR. Selecione-o na linha de comando com
`mt-eval compare <reports…> --significance --method paired_bootstrap`, ou com
`method="paired_bootstrap"` em `run_significance_tests`.

---

## sacrebleu É uma Dependência Obrigatória

sacrebleu é uma dependência obrigatória. Um harness de avaliação de MT que não consegue calcular chrF++ ou BLEU não é um harness de avaliação de MT, então:

1. `sacrebleu>=2.3` é declarado sob `[project.dependencies]` em `pyproject.toml` (não `[project.optional-dependencies]`).
2. É importado diretamente em `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — sem proteção `try/except`.
3. É importado diretamente em `significance.py`.

Não há caminhos condicionais `HAS_SACREBLEU` em lugar algum: executar sem sacrebleu não é uma configuração suportada.

---

## Implementação

### 1. sacrebleu como dependência obrigatória

`pyproject.toml` declara `sacrebleu>=2.3` sob `[project.dependencies]`, e `tester.py` o importa diretamente:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

Não há proteções `if HAS_SACREBLEU:` em `tester.py` — os caminhos de importação condicional foram removidos.

---

### 2. Módulo: `mt_eval_harness/significance.py`

A implementação de significância (randomização aproximada por padrão, bootstrap pareado sob solicitação). Sua superfície pública:

```python
"""
Statistical significance testing via paired bootstrap resampling.

Standard method used by WMT shared tasks, SacreBLEU, and MT-Lens.
Compares two runs on the same corpus to determine if the performance
difference is statistically significant.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from sacrebleu.metrics import CHRF, BLEU


@dataclass
class SignificanceResult:
    """Result of a paired bootstrap significance test."""
    metric_name: str           # e.g., "corpus_chrf", "exact_match_rate"
    system_a_score: float      # Score for system A
    system_b_score: float      # Score for system B
    delta: float               # A - B
    p_value: float             # Two-sided p-value
    n_bootstrap: int           # Number of bootstrap iterations
    confidence_level: float    # 1 - alpha
    significant: bool          # p_value < alpha
    winner: str | None         # "A", "B", or None if not significant
    ci_lower: float            # Lower bound of 95% CI on the delta
    ci_upper: float            # Upper bound of 95% CI on the delta


def paired_bootstrap(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int = 12345,
    metric_name: str = "metric",
) -> SignificanceResult:
    """Run paired bootstrap resampling significance test.

    Args:
        entries_a: Per-entry results from system A (from TestReport["entries"])
        entries_b: Per-entry results from system B (must be same length, same IDs)
        metric_fn: Function(list[dict]) -> float that computes the corpus-level
                   metric from a list of entry dicts. Must handle the entry format
                   from TestReport.
        n_bootstrap: Number of bootstrap iterations (1000 is standard)
        alpha: Significance level (0.05 = 95% confidence)
        seed: RNG seed for reproducibility (12345 matches SacreBLEU default)
        metric_name: Human-readable name for the metric being tested

    Returns:
        SignificanceResult with all fields populated.

    Raises:
        ValueError: If entries_a and entries_b have different lengths or IDs.
    """
    ...
```

### 3. Funções de métrica integradas

```python
def exact_match_rate(entries: list[dict]) -> float:
    """Compute exact match rate from a list of entry dicts."""
    non_error = [e for e in entries if not e.get("error")]
    if not non_error:
        return 0.0
    exact = sum(1 for e in non_error if e.get("exact_match"))
    return exact / len(non_error)


def corpus_chrf(entries: list[dict]) -> float:
    """Compute corpus-level chrF++ from a list of entry dicts."""
    chrf = CHRF(word_order=2)
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return chrf.corpus_score(hyps, [refs]).score


def corpus_bleu(entries: list[dict]) -> float:
    """Compute corpus-level BLEU from a list of entry dicts."""
    bleu = BLEU()
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return bleu.corpus_score(hyps, [refs]).score
```

### 4. Integração em `compare.py`

`compare.py` faz comparações lado a lado de múltiplos TestReports e executa testes de significância entre eles. `run_significance_tests()` conduz os testes entre dois relatórios e `format_significance_table()` os renderiza. Cada resultado traz seu `role`: `primary` (chrF++ — o teste único que decide), `secondary` (as outras métricas padrão) ou `diagnostic`. Ele testa, nesta ordem:

| Métrica | Papel | Calculada por reamostragem a partir de |
|---|---|---|
| `corpus_chrf` | primária | estatísticas do sacreBLEU por segmento |
| `corpus_bleu` | secundária | estatísticas do sacreBLEU por segmento |
| `corpus_spbleu` | secundária | estatísticas do sacreBLEU por segmento, no tokenizador SentencePiece do FLORES-200 (spBLEU é o BLEU com esse tokenizador, o valor reportado nas tabelas do FLORES/NLLB). Quando o tokenizador não estiver disponível (sem `sentencepiece`, ou offline sem o modelo previamente baixado), ele é listado como não testado, nunca descartado silenciosamente |
| `corpus_ter` | secundária | estatísticas do sacreBLEU por segmento. TER é uma taxa de edição, portanto **menor é melhor**: um Δ negativo favorece A |
| `comet_score` | secundária | as pontuações COMET por segmento que ambos os relatórios já contêm (sua média é a pontuação de sistema do COMET; o modelo nunca é reexecutado). Listado como não testado, com o motivo, quando apenas uma execução foi avaliada com COMET ou as duas usaram modelos COMET diferentes |
| `exact_match_rate` | diagnóstico | a flag de correspondência exata de cada entrada |
| Taxas de plugins em ambos os relatórios, ex.: `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate` | diagnóstico | os próprios resultados por entrada do plugin, agregados da mesma forma que o indicador principal foi |

**A pontuação composta descontinuada não é testada.** A pontuação composta ponderada e a linha `segment_composite` que costumavam ser testadas aqui foram descontinuadas pelo padrão de pontuação ([Especificação de Pontuação §4](/docs/network/specifications/scoring#4-composite-score)). Um JSON de comparação gerado antes do padrão ainda exibe suas linhas `segment_composite` (ou `composite_score`), rotuladas como uma métrica composta legada que não decide nada. Quando um relatório comparado for legado, `compare` indica que sua pontuação composta foi descontinuada e não a compara.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Quando mais de 2 relatórios são comparados, testes de significância pareados são executados para todos os pares: `significance` passa a ser uma lista de objetos `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}`, um por par, com cada lista `tests` formatada como no caso de dois relatórios. `letters` são as letras das duas execuções na tabela de execuções, e Δ é a primeira menos a segunda.

Além de `significance`, o JSON de comparação contém `significance_settings`: o `method`, `n_resamples`, `alpha`, `seed`, qual execução cada letra representa (`runs`), o que `ci_lower`/`ci_upper` são, `multiple_testing_correction: "none"`, quantas métricas foram testadas por par e em quantos pares, a nota em linguagem simples sobre p-valores não corrigidos (abaixo) e quaisquer notas geradas pelos testes (entradas excluídas de um pareamento, métricas não testadas).

### 5. Integração CLI

`mt-eval compare` expõe uma flag `--significance`, com `--method` para escolher o teste pareado (`approximate_randomization`, o padrão, ou `paired_bootstrap`) e `--n-bootstrap` para definir a contagem de iterações:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` recebe os arquivos `*_report.json` gerados por `mt-eval run` (ou os logs de execução, cujo relatório irmão ele utiliza). Ele exibe a tabela de execuções com uma linha por métrica e uma coluna por execução, depois a tabela de significância, e grava o JSON de comparação em um local neutro, a menos que `-o` especifique outro arquivo: `comparison-<hash>.json` ao lado dos relatórios quando compartilharem a mesma pasta, caso contrário em `comparisons/` na pasta comum mais próxima (relatórios na própria pasta de cada execução, como as pastas `mcp-run-<id>/` de `run_benchmark`, nunca recebem uma comparação gravada dentro de uma delas). O `<hash>` consiste nos primeiros dez caracteres hexadecimais de um sha256 sobre os IDs das execuções comparadas na ordem fornecida, de modo que outra comparação na mesma pasta nunca sobrescreva esta; comparar as mesmas execuções novamente reescreve o arquivo correspondente. Especificar um arquivo com `-o` substitui o que estiver lá, e a saída indica isso. O comando imprime o caminho gravado. Uma comparação de execuções em um corpus somente local, selado ou com exigência de consentimento cita suas frases, portanto ela carrega a marcação desse corpus em um sidecar `<file>.champollion.json` onde quer que seja gravada.

A coluna **Avg latency (s/entry)** da tabela de execuções exibe `—` para uma execução que não registrou tempo, com uma nota abaixo da tabela explicando o motivo: todas as entradas vieram do cache, as saídas foram geradas fora do ambiente de teste ou o método não reportou nenhuma latência. Um valor abaixo de 0,01 s é exibido com quatro casas decimais (um modelo pequeno em uma CPU decodifica uma frase em poucos milissegundos), nunca arredondado para 0,00.

### 6. Formato de saída

`format_significance_table()` renderiza a visualização de console; os mesmos dados são adicionados ao relatório de comparação JSON.

Os relatórios recebem letras na ordem em que são fornecidos: o primeiro é a execução **A**, o segundo **B**, depois **C**, **D** e assim por diante, as mesmas letras da tabela de execuções acima. Cada tabela de pares identifica suas duas execuções por essas letras e seus IDs de execução, por exemplo `--- A (baseline) vs C (nllb-ft) ---`, e suas colunas e Δ utilizam as mesmas letras (`Δ (A−C)`). Δ é sempre **primeiro − segundo**. A explicação da tabela e cada nota abaixo dela são impressas **uma única vez**, independentemente de quantos pares existam. Cada linha também exibe o **CI on Δ** de 95%: o intervalo percentil de bootstrap em `ci_lower`/`ci_upper` do JSON, que indica quão grande a diferença plausivelmente é, não apenas seu sinal. Cada métrica é marcada com sua direção a partir do registro de métricas (↑ maior é melhor, ↓ menor é melhor), e uma coluna **Better** indica a execução com a melhor pontuação, considerando a direção, com `(n.s.)` quando a diferença não for significativa. Assim, uma taxa em que menor é melhor, como TER, troca de código ou alucinação, que tenha aumentado exibirá um Δ positivo com **B** como a melhor execução, e um modelo treinado passado em segundo lugar que supere sua linha de base em 63,5 chrF++ exibirá Δ −63,52 com **B** sendo melhor. Uma métrica cuja direção não esteja declarada no registro é mostrada com `?`. Pontuações, Δ e o intervalo são exibidos com duas casas decimais, e com mais (até seis) em linhas onde isso ocultaria uma diferença real: um spBLEU de 0,0684 contra 0,0673 exibe Δ +0,0011 [+0,0001, +0,0021], nunca +0,00 [+0,00, +0,00] ao lado de **Yes**, e a tabela informa que essas linhas contêm mais casas decimais. O JSON mantém quatro casas decimais e quatro algarismos significativos para valores não nulos menores que isso, de forma que uma diferença real nunca seja armazenada como 0. Saídas idênticas resultam em Δ exatamente 0 e p = 1, portanto nunca são significativas. Se p ficar abaixo de α enquanto o intervalo de bootstrap para Δ for exatamente [0, 0] (poucos segmentos diferem para estimar a diferença), **Sig?** exibe `?†` e **Better** exibe `—†`, com uma nota: nenhuma execução é considerada melhor nela. Para uma taxa de plugin em que menor é melhor, o `winner` do JSON também reconhece a direção (a taxa mais baixa vence), como sempre foi para `corpus_ter`; uma taxa de plugin sem direção preferencial (neutra, como `morph_coverage`, ou não declarada) tem `winner: null`. Cada resultado também traz seu `direction`.

**Saída do console** (valores ilustrativos):
```
  Significance Tests (paired approximate randomization, n=1000, α=0.05):
  Each table names its two runs by their letters in the run table above.
  Δ = first run − second run.  ↑ higher is better, ↓ lower is better.
  Better = the run with the better score, by the metric's direction; (n.s.) = not significant.
  95% CI on Δ = bootstrap percentile interval: how large the difference plausibly is.

  --- A (baseline) vs B (coached) ---

  Metric                                          A        B  Δ (A−B)      95% CI on Δ  p-value  Sig?  Better
  ---------------------------------------- -------- -------- -------- ---------------- -------- -----  --------
  ↑ corpus_chrf                               42.96    41.80    +1.16   [-0.85, +3.12]    0.142    No  A (n.s.)
  ↑ corpus_bleu                                6.80     3.81    +2.99   [+0.61, +5.40]    0.018 Yes *  A
  ↑ corpus_spbleu                              9.10     6.42    +2.68   [+0.35, +5.02]    0.027 Yes *  A
  ↓ corpus_ter                                61.20    64.90    -3.70   [-7.05, -0.41]    0.030 Yes *  A
  ↑ exact_match_rate                           0.20     0.19    +0.01   [-0.03, +0.05]    0.381    No  A (n.s.)
  ↓ code_switching.avg_code_switching_rate     0.60     0.08    +0.52   [+0.45, +0.59]    0.001 Yes *  B

  p-values are per metric and uncorrected — no multiple-testing correction is
  applied (deliberately: the MT convention is to report each metric's own
  p-value). 6 metrics were tested, so one "significant" result at p<0.05 can
  turn up by chance alone. And a small Δ can be significant yet not
  meaningful: check the CI on Δ (how large the difference plausibly is) and
  how reliable the metric is for this language before acting on it.
```

Neste exemplo, o veredito é **sem diferença significativa**: chrF++, a métrica primária, não separa A e B (p = 0,142), portanto nenhuma execução é considerada melhor — mesmo que BLEU, spBLEU e TER favoreçam A e a troca de código favoreça B. Essas linhas são exibidas, e o leitor pode querer analisá-las, mas elas não definem o resultado. A tabela lista chrF++ primeiro, depois as outras métricas padrão e, em seguida, os diagnósticos.

Com mais de duas execuções, uma tabela `--- X (run) vs Y (run) ---` sucede a outra sob o mesmo cabeçalho, e a nota contabiliza cada teste realizado (`6 metrics were tested per pair (36 tests over 6 pairs)`).

**Saída JSON** (adicionada ao relatório de comparação):
```json
{
  "significance": [
    {
      "metric_name": "corpus_chrf",
      "system_a_score": 42.96,
      "system_b_score": 41.80,
      "delta": 1.16,
      "p_value": 0.142,
      "n_bootstrap": 1000,
      "confidence_level": 0.95,
      "significant": false,
      "winner": null,
      "ci_lower": -0.85,
      "ci_upper": 3.12,
      "method": "approximate_randomization",
      "direction": "higher",
      "role": "primary"
    }
  ]
}
```

### 7. Integração com dashboard (aprimoramento opcional)

Quando dados de significância estão presentes no JSON de comparação, o dashboard pode expô-los — uma linha de tabela de comparação com indicadores de significância (`*` para p < 0.05, `**` para p < 0.01). Esta é uma camada de apresentação sobre a computação entregue, não parte do recurso principal.

---

## Casos Extremos e Validação

1. **Entradas incompatíveis**: Os dois TestReports devem ter os mesmos IDs de entrada. Se não tiverem (por exemplo, um foi executado em um subconjunto), teste significância apenas na interseção. Avise sobre entradas excluídas.

2. **Poucas entradas**: Se N < 10, avise que testes de significância são pouco confiáveis com tão poucas entradas. Ainda assim execute-os, mas imprima o aviso.

3. **Pontuações idênticas**: Se ambos os sistemas produzem resultados idênticos por entrada, p_value deve ser 1.0 (nenhuma diferença).

4. **Métricas de plugins**: Uma taxa de plugin que aparece em AMBOS os relatórios é testada apenas a partir dos valores por segmento que o relatório de fato contém. Isso significa a própria agregação do plugin sobre seus resultados por entrada (a métrica FST), ou a média do valor por entrada calculado por uma agregação `avg_<name>` (as métricas comportamentais). Uma taxa de plugin sem valores por segmento é listada como não testada, nunca mostrada como 0,00 vs 0,00. Contagens como `total_words_checked` não são testadas.

5. **Reprodutibilidade**: A seed do RNG deve ser registrada na saída para que os resultados sejam exatamente reproduzíveis. Padrão 12345 (correspondendo à convenção SacreBLEU).

---

## O Que NÃO Construir

- **Sem reinferência do COMET no teste**: O teste pareado do COMET é feito a partir das pontuações por segmento que ambos os relatórios já trazem; o modelo nunca é reexecutado por reamostragem. Duas execuções pontuadas com modelos COMET diferentes não são testadas entre si.
- **Sem análise bayesiana**: Mantém-se o bootstrap frequentista. É o que a comunidade de TA espera e compreende.
- **Sem correção para múltiplos testes**: Ao testar várias métricas, não aplique correções de Bonferroni ou similares. A convenção na avaliação de TA é relatar os p-valores brutos por métrica e deixar a interpretação a cargo do leitor. `mt-eval compare` **informa isso explicitamente** em sua saída e em `comparison.json` (`significance_settings.multiple_testing_correction: "none"` com uma nota em linguagem simples): com várias métricas testadas, um resultado com p < 0,05 pode surgir apenas por acaso, e um Δ pequeno pode ser significativo sem ter relevância prática, portanto avalie o IC de Δ e a confiabilidade da métrica para o idioma antes de tomar decisões com base em um único resultado "significativo".

---

## Agrupamentos de classificação {#ranking-clusters}

> **Status**: ✅ Lançado, para competições. Uma classificação em competição é um conjunto de **agrupamentos** (clusters), não uma ordem estrita — o teste de significância decide quais entradas vizinhas são realmente distinguíveis. Esta seção descreve o que está disponível, incluindo onde as evidências são mais fracas do que em um teste pareado.

### Encadeamento adjacente, numeração de competição

As entradas são particionadas primeiro por **trilha** — um sistema `constrained` nunca é classificado contra um `unconstrained`, e cada trilha possui sua própria ordenação, grupos de empate e faixas de classificação, de modo que "posição 1" sempre significa posição 1 *dentro de uma trilha*.

Dentro de uma trilha, as entradas são ordenadas pela métrica primária da competição (chrF++, a menos que a competição tenha registrado uma diferente), depois pelas métricas de superfície restantes e, finalmente, pelo envio mais antigo. Cada par **adjacente** nessa ordem é testado. Um par que o teste não consegue separar compartilha uma posição, e as posições compartilhadas se **encadeiam**: se A empata com B e B empata com C, todos os três caem em um único grupo de empate, mesmo quando A e C nunca foram comparados diretamente.

As classificações usam a numeração de competição — um empate triplo no topo resulta em `1, 1, 1` e a próxima entrada fica em `4`; um empate duplo pelo segundo lugar resulta em `1, 2, 2, 4`.

**O limite real do encadeamento**: a não significância não é transitiva. Uma cadeia longa pode unir duas entradas que um teste direto *separaria*. É por isso que um agrupamento é relatado como um **intervalo**, e não como um ponto fixo.

### Faixas de classificação

Cada entrada traz `rank_min` e `rank_max` — a melhor e a pior posição consistentes com as evidências, no estilo que o WMT usa para suas faixas de classificação. Uma entrada isolada em seu agrupamento possui `rank_min == rank_max`. Uma entrada dentro de um agrupamento de quatro que abrange as posições 2–5 traz `rank_min: 2, rank_max: 5`, e **nenhuma entrada dentro desse agrupamento está "à frente de" outra**. Isolar uma classificação numérica única de um agrupamento é uma interpretação incorreta do resultado.

### A escala de evidências

Nem todo par pode ser testado da mesma forma, de modo que cada par registra o nível de onde o veredito realmente se originou. Esse rótulo é parte do resultado, nunca descartado:

| Nível | Evidência | Quando está disponível | Força |
|---|---|---|---|
| 1 | **Teste pareado por segmento** — randomização aproximada por padrão, bootstrap pareado sob solicitação (o algoritmo descrito acima) | Apenas quando AMBAS as entradas possuem um conjunto completo e alinhado de pontuações por segmento | O teste real |
| 2 | **Sobreposição de IC de 95% do bootstrap** nos limites dos intervalos publicados | Quando a métrica primária possui limites de intervalo de confiança em ambas as entradas (chrF++ possui; BLEU e COMET não têm colunas de intervalo) | Uma aproximação conservadora — intervalos sobrepostos **não** comprovam equivalência, e a não sobreposição é um critério mais rígido do que um teste pareado |
| 3 | **Igualdade pontual** no arredondamento de exibição da métrica | Sempre | O nível mais fraco: diz apenas que os dois números exibidos são idênticos |

### Competições seladas: o nível 1 é executado no nó

O nível 1 precisa de pontuações por segmento de ambos os sistemas. Em uma competição selada, o nó de avaliação do organizador detém as referências e **nunca exporta saídas por segmento**. Esse é todo o propósito da trilha selada, e não é uma configuração que possa ser flexibilizada. Portanto, o teste pareado vai até os dados.

`mt-eval node verdicts` executa o teste pareado da própria competição no nó, sobre as referências seladas e cada par de entradas avaliado, e grava **apenas os vereditos**: para cada par, o método, p-valor, diferença de pontuação, seu intervalo de confiança e a contagem de segmentos. Nenhum segmento, referência ou tradução é incluído no arquivo. O nó assina o arquivo com sua chave de assinatura de pontuação. O organizador então encerra a competição com `mt-eval contest close --node-verdicts <file> --verify-key <node public key>`. A classificação utiliza os vereditos apenas se a assinatura for verificada e se tiverem sido calculados para esta competição, seu conjunto selado, sua métrica, sua política de desempate fixada e sua versão prometida do harness. Caso contrário, o encerramento é recusado.

Quando nenhum veredito é fornecido, os empates de uma competição selada baseiam-se na sobreposição do intervalo de confiança onde a métrica possuir intervalos, e na igualdade pontual onde não possuir. Seus agrupamentos tornam-se, então, mais amplos do que seriam com um teste pareado. A própria classificação indica qual caso se aplica: `ranking_method.evidence_used` indica os níveis efetivamente utilizados, e `ranking_method.node_verdicts` indica o nó cujos vereditos foram adotados, se houver.

### O que a classificação não avalia

- **Entradas contrastivas** são reportadas em sua própria seção e nunca vencem.
- **Tempo de execução, hardware e custo** constam no cartão de execução e são informados, nunca classificados. Não há uma trilha de eficiência.
- **Avaliação humana** não faz parte dessas classificações. Uma *seleção* para avaliação humana — quais sistemas um orçamento fixo cobriria, selecionando grupos de empate inteiros para que um agrupamento nunca seja dividido ao meio — pode ser registrada para uma competição encerrada, mas não existem notas atribuídas; consulte as [Regras de Avaliação de TA](/docs/network/leaderboard/rules#verification-tiers).

---

## Mapa de Módulos

Onde o recurso entregue reside:

| Arquivo | Papel |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` declarado como dependência obrigatória |
| `mt_eval_harness/tester.py` | Importação direta do sacrebleu (sem verificação `HAS_SACREBLEU`); calcula ICs por execução |
| `mt_eval_harness/significance.py` | Testes pareados (`paired_approximate_randomization`, o padrão, e `paired_bootstrap`), `SignificanceResult`, funções de métricas integradas (chrF++, BLEU, spBLEU, TER, COMET a partir de pontuações por segmento em cache, correspondência exata; a pontuação composta descontinuada no nível do segmento é mantida apenas para ler arquivos de comparação antigos), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Intervalos de confiança de bootstrap: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exporta `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Testes de significância integrados à comparação de relatórios |
| `mt_eval_harness/cli.py` | Flags `--significance` / `--method` / `--n-bootstrap` (comparação) e `--no-ci` / `--n-bootstrap-ci` (teste) |
| `mt_eval_harness/dashboard.py` | Exibe a significância na tabela de comparação (aprimoramento opcional) |

---

## Cobertura de Testes

Os suites de significância / confiança / pontuação estão verdes. Cobrem:

1. **Determinístico com seed**: mesmas entradas + mesma seed → mesmo p-valor, toda vez
2. **Teste de resposta conhecida**: dois conjuntos de resultados idênticos → p_value = 1.0
3. **Teste significativo conhecido**: dois conjuntos de resultados onde um é claramente melhor (por exemplo, todos os matches exatos vs todos os erros) → p_value ≈ 0.0
4. **IDs incompatíveis**: lança `ValueError`, ou avisa e calcula na interseção
5. **Entradas vazias**: tratadas graciosamente (p_value = 1.0 ou lança)

---

## Intervalos de Confiança (Recurso Complementar)

> **Status**: ✅ IMPLEMENTADO em `confidence.py`

Intervalos de confiança (CIs) respondem uma pergunta diferente de testes de significância:

- **Teste de significância** (`significance.py`): "A diferença entre o sistema A e o sistema B é real?"
- **Intervalos de confiança** (`confidence.py`): "Quão incerta é a pontuação deste sistema por si só?"

### Implementação: `confidence.py`

Usa o mesmo método de reamostragem bootstrap percentil que testes de significância:

| Parâmetro | Valor | Justificativa |
|---|---|---|
| `n_bootstrap` | 1000 | Padrão SacreBLEU, convenção WMT 2024 |
| `seed` | 12345 | Seed padrão SacreBLEU para reprodutibilidade |
| `alpha` | 0.05 | Nível de confiança padrão de 95% |
| Método | Bootstrap percentil | Koehn (2004), Efron (1979) |

### O Que Recebe CIs

As métricas determinísticas no nível do corpus calculadas pelo harness:
- `corpus_chrf` (pontuação chrF++)
- `corpus_bleu` (pontuação BLEU)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (quando dados FST estiverem presentes)


O intervalo de chrF++ faz parte do indicador principal publicado (`chrF++ 47.5 [45.9, 49.0]`). ICs **também** são calculados para `comet_score`, obtidos por bootstrap a partir de suas pontuações por entrada em cache (sem inferência neural redundante). Nenhum IC composto é calculado para novas execuções; o IC composto armazenado de um cartão legado só é recalculado quando esse cartão for verificado.

### Flags CLI

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Aviso de Amostra Pequena

Quando N < 30 entradas, o módulo emite um aviso de que CIs podem ter cobertura pobre. O bootstrap não pode criar informação ausente da amostra — com muito poucas entradas, os intervalos serão amplos, refletindo corretamente alta incerteza.

### COMET (uma métrica padrão quando calculada, ao lado do chrF++)

COMET é uma **métrica neural exibida ao lado do indicador principal chrF++** sempre que for calculada, acompanhada do ID do seu modelo. Ela nunca é mesclada com o chrF++ e não atua como o indicador principal porque requer um modelo grande e não está calibrada para a maioria dos idiomas com poucos recursos computacionais (consulte a [Especificação de Pontuação §2.3](/docs/network/specifications/scoring#2-metric-inventory)). ICs de bootstrap são calculados sobre suas pontuações por entrada em cache:
- Modelo: `Unbabel/wmt22-comet-da` (modelo baseado em referências WMT 2022); AfriCOMET selecionado automaticamente para idiomas africanos suportados
- Calculado quando `unbabel-comet` estiver instalado
- Pontuações por entrada armazenadas nas entradas do TestReport; o valor do corpus traz uma ressalva de calibração para recursos baixos
- Recalculado pelo verificador — um valor COMET reportado deve ser reproduzível
- Dependência opcional: `python3 -m pip install 'mt-eval-harness[comet]'` (ou `mt-eval setup --comet`)

### Colunas Supabase

A tabela `run_cards` contém as colunas anuláveis correspondentes (consulte [scoring.md §9.1](/docs/network/specifications/scoring)):
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — o indicador principal e seu intervalo de 95%
- `comet_score` (`real`) — exibido ao lado do indicador principal, nunca mesclado
- `corpus_bleu` (`real`)

O conjunto completo de intervalos de confiança é armazenado dentro do JSON `scores` do cartão de execução sob `confidence_intervals` (conforme o esquema do cartão de execução em scoring.md §9); apenas os limites de chrF++ também são desnormalizados como colunas.
