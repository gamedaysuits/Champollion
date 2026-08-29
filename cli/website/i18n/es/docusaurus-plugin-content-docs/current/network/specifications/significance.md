---
sidebar_position: 7
title: "Prueba de Significancia Estadística"
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

# Pruebas de Significancia Estadística

> **Estado**: ✅ Entregado. Las pruebas de significancia bootstrap pareadas e intervalos de confianza bootstrap están implementadas en `mt_eval_harness/significance.py` y `mt_eval_harness/confidence.py`, exportadas del paquete, expuestas en la CLI, y cubiertas por los conjuntos de pruebas de significancia / confianza / puntuación.
> **Base de código**: `arena` — conectada a `tester.py` (intervalos de confianza por ejecución) y `compare.py` (significancia entre ejecuciones).
> **Propósito**: Permitir que los investigadores determinen si la diferencia entre dos ejecuciones de evaluación es estadísticamente significativa o solo ruido.

Esta página documenta el **comportamiento entregado** — es descriptiva, no una lista de tareas pendientes.

---

## Por Qué Esto Importa

Al comparar dos ejecuciones (ilustrativo: Sistema A chrF++ 42.96 vs Sistema B chrF++ 41.80 en 92 entradas), una diferencia de punto bruto no dice nada por sí sola sobre si es real o ruido. Con solo ~92 entradas de prueba, la variación aleatoria puede producir fácilmente oscilaciones de 1–2 puntos. Los expertos solicitan pruebas de significancia — por lo que el arnés las calcula.

---

## Algoritmo: Remuestreo Bootstrap Pareado

Este es el método estándar utilizado por SacreBLEU, MT-Lens y tareas compartidas de WMT. Es bien entendido por investigadores de MT y produce resultados en los que confían.

### Cómo Funciona

Dados dos sistemas A y B evaluados en las mismas N entradas de prueba:

1. Calcular la diferencia de métrica real: `Δ = metric(A) - metric(B)`
2. Repetir `n_bootstrap` veces (predeterminado 1000):
   a. Muestrear N entradas **con reemplazo** del conjunto de prueba compartido
   b. Calcular la métrica para A y B en esta muestra bootstrap
   c. Calcular la diferencia bootstrap: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. El valor p = fracción de muestras bootstrap donde `Δ_boot` tiene el signo opuesto a `Δ`
4. Si valor p < α (predeterminado 0.05), la diferencia es estadísticamente significativa

### Propiedades Clave

- **Pareada**: Ambos sistemas se evalúan en la misma muestra bootstrap, preservando la correlación a nivel de entrada
- **No paramétrica**: Sin suposición sobre la distribución de puntuaciones
- **Estándar**: Esto es exactamente lo que `sacrebleu --paired-bs` hace internamente

---

## sacrebleu Es una Dependencia Obligatoria

sacrebleu es una dependencia obligatoria. Un arnés de evaluación de MT que no puede calcular chrF++ o BLEU no es un arnés de evaluación de MT, por lo que:

1. `sacrebleu>=2.3` se declara bajo `[project.dependencies]` en `pyproject.toml` (no `[project.optional-dependencies]`).
2. Se importa directamente en `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — sin protección `try/except`.
3. Se importa directamente en `significance.py`.

No hay rutas condicionales `HAS_SACREBLEU` en ningún lugar: ejecutar sin sacrebleu no es una configuración compatible.

---

## Implementación

### 1. sacrebleu como dependencia obligatoria

`pyproject.toml` declara `sacrebleu>=2.3` bajo `[project.dependencies]`, e `tester.py` lo importa directamente:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

No hay protecciones `if HAS_SACREBLEU:` en `tester.py` — las rutas de importación condicional fueron eliminadas.

---

### 2. Módulo: `mt_eval_harness/significance.py`

La implementación central de bootstrap pareado. Su superficie pública:

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

### 3. Funciones de métrica integradas

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

### 4. Integración en `compare.py`

`compare.py` realiza comparación lado a lado de múltiples TestReports y ejecuta pruebas de significancia entre ellos. `significance.py` también envía `fst_acceptance_rate()` y `composite_score()` (para que las diferencias FST y compuestas puedan ser probadas por significancia), `run_significance_tests()` (impulsa todas las métricas en dos reportes), y `format_significance_table()` (renderizado de consola).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Cuando se comparan más de 2 reportes, las pruebas de significancia pareadas se ejecutan para todos los pares, indexadas por `"(run_a_id, run_b_id)"`.

### 5. Integración CLI

`mt-eval compare` expone una bandera `--significance`, con `--n-bootstrap` para establecer el recuento de iteraciones:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. Formato de salida

`format_significance_table()` renderiza la vista de consola; los mismos datos se agregan al reporte de comparación.

**Salida de consola:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**Salida JSON** (agregada al reporte de comparación):
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

### 7. Integración del panel (mejora opcional)

Cuando los datos de significancia están presentes en el JSON de comparación, el panel puede exponerlos — una fila de tabla de comparación con indicadores de significancia (`*` para p < 0.05, `**` para p < 0.01). Esta es una capa de presentación sobre la computación entregada, no parte de la característica principal.

---

## Casos Extremos y Validación

1. **Entradas no coincidentes**: Los dos TestReports deben tener los mismos IDs de entrada. Si no es así (p. ej., uno se ejecutó en un subconjunto), solo pruebe significancia en la intersección. Advierta sobre entradas excluidas.

2. **Muy pocas entradas**: Si N < 10, advierta que las pruebas de significancia no son confiables con tan pocas entradas. Aún así ejecútelas, pero imprima la advertencia.

3. **Puntuaciones idénticas**: Si ambos sistemas producen resultados idénticos por entrada, p_value debe ser 1.0 (sin diferencia en absoluto).

4. **Métricas de complemento**: El módulo de significancia también debe probar cualquier métrica de complemento que aparezca en AMBOS reportes. Use un enfoque genérico: si ambos reportes tienen `plugin_metrics.crk_fst_validity.avg_fst_validity`, pruébelo.

5. **Reproducibilidad**: La semilla RNG debe registrarse en la salida para que los resultados sean exactamente reproducibles. Predeterminado a 12345 (coincidiendo con la convención de SacreBLEU).

---

## Qué NO Construir

- **Sin significancia COMET separada**: COMET se calcula y se reporta en un **carril neural separado** — nunca se pliega en ningún compuesto (el compuesto es determinista; ver [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) y §2). Los IC bootstrap *pueden* calcularse sobre sus puntuaciones por entrada en caché, pero el arnés no ejecuta una prueba de significancia pareada integrada para COMET. Para significancia COMET pareada entre dos sistemas, use `comet-compare` de Unbabel.
- **Sin análisis bayesiano**: Manténgase en bootstrap frecuentista. Es lo que la comunidad de MT espera y entiende.
- **Sin corrección de pruebas múltiples**: Al probar múltiples métricas, no aplique correcciones de Bonferroni o similares. La convención en evaluación de MT es reportar valores p brutos por métrica y dejar que el lector interprete.

---

## Mapa de Módulos

Dónde vive la característica entregada:

| Archivo | Rol |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` declarada como dependencia obligatoria |
| `mt_eval_harness/tester.py` | Importación directa de sacrebleu (sin protección `HAS_SACREBLEU`); calcula IC por ejecución |
| `mt_eval_harness/significance.py` | Núcleo de bootstrap pareado: `paired_bootstrap`, `SignificanceResult`, funciones de métrica integradas, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Intervalos de confianza bootstrap: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exporta `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Pruebas de significancia conectadas a comparación de reportes |
| `mt_eval_harness/cli.py` | Banderas `--significance` / `--n-bootstrap` (comparar) y `--no-ci` / `--n-bootstrap-ci` (probar) |
| `mt_eval_harness/dashboard.py` | Expone significancia en la tabla de comparación (mejora opcional) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Pruebas unitarias (parte del conjunto de pruebas aprobadas) |

---

## Cobertura de Pruebas

Los conjuntos de pruebas de significancia / confianza / puntuación están en verde. Cubren:

1. **Determinista con semilla**: mismas entradas + misma semilla → mismo valor p, cada vez
2. **Prueba de respuesta conocida**: dos conjuntos de resultados idénticos → p_value = 1.0
3. **Prueba de significancia conocida**: dos conjuntos de resultados donde uno es claramente mejor (p. ej., todas las coincidencias exactas vs todos los fallos) → p_value ≈ 0.0
4. **IDs no coincidentes**: genera `ValueError`, o advierte y calcula en la intersección
5. **Entradas vacías**: manejadas correctamente (p_value = 1.0 o genera)

---

## Intervalos de Confianza (Característica Complementaria)

> **Estado**: ✅ IMPLEMENTADO en `confidence.py`

Los intervalos de confianza (IC) responden una pregunta diferente de la prueba de significancia:

- **Prueba de significancia** (`significance.py`): "¿Es la diferencia entre el sistema A y el sistema B real?"
- **Intervalos de confianza** (`confidence.py`): "¿Qué tan incierta es la puntuación de este sistema por sí sola?"

### Implementación: `confidence.py`

Utiliza el mismo método de remuestreo bootstrap de percentil que la prueba de significancia:

| Parámetro | Valor | Justificación |
|---|---|---|
| `n_bootstrap` | 1000 | Predeterminado de SacreBLEU, convención WMT 2024 |
| `seed` | 12345 | Semilla predeterminada de SacreBLEU para reproducibilidad |
| `alpha` | 0.05 | Nivel de confianza estándar del 95% |
| Método | Bootstrap de percentil | Koehn (2004), Efron (1979) |

### Qué Obtiene IC

Las métricas deterministas a nivel de corpus calculadas por el arnés:
- `corpus_chrf` (puntuación chrF++)
- `corpus_bleu` (puntuación BLEU)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (cuando hay datos FST presentes)
- `composite` (cuando chrF++ y coincidencia exacta están disponibles)

Los IC **también** se calculan para el `comet_score` neural, remuestreado desde sus puntuaciones por entrada en caché (sin inferencia neural redundante). Tener un IC no hace que COMET sea una métrica compuesta: se reporta en un **carril neural separado** y nunca se pliega en el compuesto (ver [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

### Banderas CLI

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Advertencia de Muestra Pequeña

Cuando N < 30 entradas, el módulo emite una advertencia de que los IC pueden tener cobertura deficiente. El bootstrap no puede crear información ausente de la muestra — con muy pocas entradas, los intervalos serán amplios, reflejando correctamente la alta incertidumbre.

### COMET (reportado por separado, nunca compuesto)

COMET es una **métrica neuronal reportada por separado** — **nunca se integra en ningún compuesto** (el compuesto se mantiene determinista; consulte [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) y §2). Los IC bootstrap *sí* se calculan sobre sus puntuaciones por entrada almacenadas en caché, pero no es una métrica compuesta de "primera clase":
- Modelo: `Unbabel/wmt22-comet-da` (modelo basado en referencias de WMT 2022); AfriCOMET se selecciona automáticamente para los idiomas africanos compatibles
- Se calcula cuando `unbabel-comet` está instalado
- Las puntuaciones por entrada se almacenan en las entradas de TestReport; el valor del corpus conlleva una advertencia de calibración para recursos bajos
- Vuelto a derivar por el verificador — un valor COMET reportado debe poder reproducirse
- Dependencia opcional: `pip install mt-eval-harness[comet]`

### Columnas de Supabase

La tabla `run_cards` lleva las columnas anulables correspondientes (ver [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — la puntuación neural reportada por separado, nunca compuesta
- `corpus_bleu` (`real`)

Los límites del intervalo de confianza se almacenan dentro del JSON `scores` de la tarjeta de ejecución bajo `confidence_intervals` (según el esquema de tarjeta de ejecución en scoring.md §9), no como columnas de nivel superior desnormalizadas.
