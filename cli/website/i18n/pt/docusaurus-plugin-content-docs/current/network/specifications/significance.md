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

> **Status**: ✅ Entregue. Testes de significância com bootstrap pareado e intervalos de confiança com bootstrap estão implementados em `mt_eval_harness/significance.py` e `mt_eval_harness/confidence.py`, exportados do pacote, expostos na CLI e cobertos pelos suites de testes de significância / confiança / pontuação.
> **Base de código**: `arena` — integrado em `tester.py` (intervalos de confiança por execução) e `compare.py` (significância entre execuções).
> **Propósito**: Permitir que pesquisadores determinem se a diferença entre duas execuções de avaliação é estatisticamente significativa ou apenas ruído.

Esta página documenta o **comportamento entregue** — é descritiva, não uma lista de tarefas.

---

## Por Que Isso Importa

Ao comparar duas execuções (ilustrativo: Sistema A chrF++ 42.96 vs Sistema B chrF++ 41.80 em 92 entradas), uma diferença de ponto bruto não diz nada por si só sobre se é real ou ruído. Com apenas ~92 entradas de teste, variação aleatória pode facilmente produzir oscilações de 1–2 pontos. Especialistas pedem testes de significância — então o harness os calcula.

---

## Algoritmo: Reamostragem com Bootstrap Pareado

Este é o método padrão usado por SacreBLEU, MT-Lens e tarefas compartilhadas da WMT. É bem compreendido por pesquisadores de MT e produz resultados em que confiam.

### Como Funciona

Dados dois sistemas A e B avaliados nas mesmas N entradas de teste:

1. Calcule a diferença de métrica real: `Δ = metric(A) - metric(B)`
2. Repita `n_bootstrap` vezes (padrão 1000):
   a. Amostre N entradas **com reposição** do conjunto de teste compartilhado
   b. Calcule a métrica para A e B nesta amostra bootstrap
   c. Calcule a diferença bootstrap: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. O p-valor = fração de amostras bootstrap onde `Δ_boot` tem sinal oposto a `Δ`
4. Se p-valor < α (padrão 0.05), a diferença é estatisticamente significativa

### Propriedades-Chave

- **Pareado**: Ambos os sistemas são avaliados na mesma amostra bootstrap, preservando correlação no nível de entrada
- **Não-paramétrico**: Sem suposição sobre a distribuição de pontuações
- **Padrão**: Isto é exatamente o que `sacrebleu --paired-bs` faz internamente

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

A implementação central de bootstrap pareado. Sua superfície pública:

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

`compare.py` faz comparação lado a lado de múltiplos TestReports e executa testes de significância entre eles. `significance.py` também fornece `fst_acceptance_rate()` e `composite_score()` (para que diferenças FST e compostas possam ser testadas quanto à significância), `run_significance_tests()` (conduz todas as métricas em dois relatórios) e `format_significance_table()` (renderização de console).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Quando mais de 2 relatórios são comparados, testes de significância pareados são executados para todos os pares, indexados por `"(run_a_id, run_b_id)"`.

### 5. Integração CLI

`mt-eval compare` expõe uma flag `--significance`, com `--n-bootstrap` para definir a contagem de iterações:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. Formato de saída

`format_significance_table()` renderiza a visualização de console; os mesmos dados são adicionados ao relatório de comparação JSON.

**Saída de console:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

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
      "ci_upper": 3.12
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

4. **Métricas de plugin**: O módulo de significância também deve testar qualquer métrica de plugin que apareça em AMBOS os relatórios. Use uma abordagem genérica: se ambos os relatórios têm `plugin_metrics.crk_fst_validity.avg_fst_validity`, teste-a.

5. **Reprodutibilidade**: A seed do RNG deve ser registrada na saída para que os resultados sejam exatamente reproduzíveis. Padrão 12345 (correspondendo à convenção SacreBLEU).

---

## O Que NÃO Construir

- **Sem significância COMET separada**: COMET é computado e reportado em uma **lane neural separada** — nunca é **incorporado em nenhuma composição** (a composição é determinística; veja [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) e §2). CIs bootstrap *podem* ser computados sobre suas pontuações por entrada em cache, mas o harness não executa um teste de significância pareado integrado para COMET. Para significância COMET pareada entre dois sistemas, use `comet-compare` da Unbabel.
- **Sem análise Bayesiana**: Mantenha-se com bootstrap frequentista. É o que a comunidade de MT espera e compreende.
- **Sem correção multi-teste**: Ao testar múltiplas métricas, não aplique correções de Bonferroni ou similares. A convenção em avaliação de MT é reportar p-valores brutos por métrica e deixar o leitor interpretar.

---

## Mapa de Módulos

Onde o recurso entregue reside:

| Arquivo | Papel |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` declarado como dependência obrigatória |
| `mt_eval_harness/tester.py` | Importação direta de sacrebleu (sem proteção `HAS_SACREBLEU`); calcula CIs por execução |
| `mt_eval_harness/significance.py` | Core de bootstrap pareado: `paired_bootstrap`, `SignificanceResult`, funções de métrica integradas, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Intervalos de confiança bootstrap: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exporta `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Testes de significância integrados em comparação de relatório |
| `mt_eval_harness/cli.py` | Flags `--significance` / `--n-bootstrap` (comparar) e `--no-ci` / `--n-bootstrap-ci` (testar) |
| `mt_eval_harness/dashboard.py` | Expõe significância na tabela de comparação (aprimoramento opcional) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Testes unitários (parte do suite aprovado) |

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

As métricas determinísticas no nível de corpus calculadas pelo harness:
- `corpus_chrf` (pontuação chrF++)
- `corpus_bleu` (pontuação BLEU)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (quando dados FST estão presentes)
- `composite` (quando chrF++ e match exato estão disponíveis)

CIs também são **computados** para o `comet_score` neural, reamostrando de suas pontuações por entrada em cache (sem inferência neural redundante). Ter um CI não torna COMET uma métrica composta: é reportado em uma **lane neural separada** e nunca é incorporado na composição (veja [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

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

### COMET (reportado separadamente, nunca composto)

O COMET é uma **métrica neural reportada de forma independente** — ela **nunca é incorporada a nenhum composto** (o composto é mantido determinístico; consulte [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) e §2). Os ICs de bootstrap *são* calculados sobre suas pontuações por entrada em cache, mas ela não é uma métrica composta de "primeira classe":
- Modelo: `Unbabel/wmt22-comet-da` (modelo baseado em referência do WMT 2022); AfriCOMET selecionado automaticamente para idiomas africanos suportados
- Calculado quando o `unbabel-comet` está instalado
- Pontuações por entrada armazenadas nas entradas do TestReport; o valor do corpus carrega uma ressalva de calibração para poucos recursos
- Rederivado pelo verificador — um valor COMET reportado deve ser reproduzível
- Dependência opcional: `pip install mt-eval-harness[comet]`

### Colunas Supabase

A tabela `run_cards` carrega as colunas anuláveis correspondentes (veja [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — a pontuação neural reportada separadamente, nunca composta
- `corpus_bleu` (`real`)

Os limites de intervalo de confiança são armazenados dentro do JSON `scores` do cartão de execução sob `confidence_intervals` (conforme o esquema de cartão de execução em scoring.md §9), não como colunas de nível superior desnormalizadas.
