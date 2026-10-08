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

> **Estado**: ✅ Implementado. Las pruebas de significancia pareadas (aleatorización aproximada por defecto; el bootstrap pareado bajo solicitud) y los intervalos de confianza bootstrap están implementados en `mt_eval_harness/significance.py` y `mt_eval_harness/confidence.py`, exportados desde el paquete, expuestos en la CLI y cubiertos por las suites de pruebas de significancia / confianza / puntuación.
> **Base de código**: `arena` — conectado a `tester.py` (intervalos de confianza por ejecución) y `compare.py` (significancia entre ejecuciones).
> **Propósito**: Permitir que los investigadores determinen si la diferencia entre dos ejecuciones de evaluación es estadísticamente significativa o solo ruido.

Esta página documenta el **comportamiento entregado** — es descriptiva, no una lista de tareas pendientes.

---

## Por Qué Esto Importa

Al comparar dos ejecuciones (ilustrativo: Sistema A chrF++ 42.96 vs Sistema B chrF++ 41.80 en 92 entradas), una diferencia de punto bruto no dice nada por sí sola sobre si es real o ruido. Con solo ~92 entradas de prueba, la variación aleatoria puede producir fácilmente oscilaciones de 1–2 puntos. Los expertos solicitan pruebas de significancia — por lo que el arnés las calcula.

**Bajo el estándar de puntuación (`standard/1`), la prueba pareada sobre chrF++ es la que decide si una ejecución es mejor que otra.** chrF++ es la métrica principal predeclarada ([Especificación de puntuación](/docs/network/specifications/scoring#how-runs-are-scored)). BLEU, spBLEU, TER y COMET (cuando ambas ejecuciones contienen puntuaciones COMET por segmento del mismo modelo) se prueban y muestran como métricas estándar secundarias, y la coincidencia exacta (exact match) y las tasas de plugins como diagnósticos; ninguna de ellas decide. Esto sigue a Kocmi et al. (2021, "To Ship or Not to Ship"), quienes hallaron a través de miles de juicios humanos que una diferencia en la métrica junto con su significancia es lo que predice la preferencia humana.

---

## Algoritmo: Aleatorización aproximada pareada (por defecto)

`mt-eval compare --significance` utiliza la prueba de **aleatorización aproximada (AR) pareada** de Riezler & Maxwell (2005). Este es también el valor por defecto de SacreBLEU para comparar sistemas.

### Cómo Funciona

Dados dos sistemas A y B evaluados en las mismas N entradas de prueba:

1. Calcular la diferencia observada a nivel de corpus: `Δ = metric(A) - metric(B)`.
2. Repetir `n_trials` veces (por defecto 1000):
   a. Para cada entrada, intercambiar las salidas de A y B con probabilidad ½.
   b. Recalcular la métrica del corpus sobre las dos pilas reorganizadas.
   c. Registrar si `|Δ_shuffled| ≥ |Δ|`.
3. El valor p es el nivel de significancia alcanzado de dos colas:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. El +1 cuenta la
   asignación observada como una extracción válida, por lo que p nunca es exactamente 0.
4. Si p < α (por defecto 0.05), la diferencia se reporta como significativa.

El intervalo de confianza sobre Δ es un intervalo percentil de bootstrap (la AR produce un
valor p, no un intervalo). Se calcula en un flujo aleatorio independiente para que
no altere las extracciones de AR.

### Propiedades Clave

- **Una prueba de hipótesis real:** las mezclas se extraen bajo la hipótesis nula
  de que no hace ninguna diferencia qué sistema produjo una entrada determinada.
- **Pareada:** ambos sistemas se comparan entrada por entrada, lo que preserva
  la correlación a nivel de entrada.
- **No paramétrica:** no asume nada sobre cómo se distribuyen las puntuaciones.

### El bootstrap pareado (disponible, no por defecto)

`paired_bootstrap()` implementa el bootstrap pareado de Koehn (2004): remuestrea
entradas con reemplazo y cuenta con qué frecuencia cambia el signo de Δ. Se
ofrece para mantener comparabilidad con artículos más antiguos, pero es una heurística
de robustez de signo, no un nivel de significancia formal de libro de texto. Su distribución está centrada en
el Δ observado, no en la hipótesis nula, por lo que puede exagerar la significancia en comparación
con la AR. Selecciónelo en la línea de comandos con
`mt-eval compare <reports…> --significance --method paired_bootstrap`, o con
`method="paired_bootstrap"` en `run_significance_tests`.

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

La implementación de la significancia (aleatorización aproximada por defecto, bootstrap pareado bajo solicitud). Su superficie pública:

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

`compare.py` realiza una comparación lado a lado de múltiples TestReports y ejecuta pruebas de significancia entre ellos. `run_significance_tests()` dirige las pruebas a través de dos reportes y `format_significance_table()` las renderiza. Cada resultado incluye su `role`: `primary` (chrF++ — la única prueba que decide), `secondary` (las otras métricas estándar) o `diagnostic`. Prueba, en este orden:

| Métrica | Rol | Calculado por remuestreo a partir de |
|---|---|---|
| `corpus_chrf` | principal | estadísticas de sacreBLEU por segmento |
| `corpus_bleu` | secundario | estadísticas de sacreBLEU por segmento |
| `corpus_spbleu` | secundario | estadísticas de sacreBLEU por segmento, en el tokenizador SentencePiece de FLORES-200 (spBLEU es BLEU con ese tokenizador, la cifra que reportan las tablas de FLORES/NLLB). Cuando el tokenizador no está disponible (sin `sentencepiece`, o sin conexión y con el modelo aún no descargado), se lista como no probado, nunca se omite silenciosamente |
| `corpus_ter` | secundario | estadísticas de sacreBLEU por segmento. TER es una tasa de edición, por lo que **menor es mejor**: un Δ negativo favorece a A |
| `comet_score` | secundario | las puntuaciones COMET por segmento que ambos reportes ya contienen (su media es la puntuación de sistema de COMET; el modelo nunca se vuelve a ejecutar). Se lista como no probado, indicando el motivo, cuando solo una ejecución se evaluó con COMET o si las dos usaron modelos de COMET diferentes |
| `exact_match_rate` | diagnóstico | la bandera de coincidencia exacta de cada entrada |
| Tasas de plugins en ambos reportes, p. ej. `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate` | diagnóstico | los propios resultados por entrada del plugin, agregados de la misma manera que el valor principal |

**El valor compuesto retirado no se prueba.** El valor compuesto ponderado y la fila `segment_composite` que solían probarse aquí fueron retirados por el estándar de puntuación ([Especificación de puntuación §4](/docs/network/specifications/scoring#4-composite-score)). Un JSON de comparación escrito antes del estándar todavía muestra sus filas `segment_composite` (o `composite_score`), etiquetadas como un compuesto heredado que no decide nada. Cuando un reporte comparado es heredado, `compare` indica que su compuesto está retirado y no lo compara.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Cuando se comparan más de 2 reportes, se ejecutan pruebas de significancia por pares para todos los pares: `significance` es entonces una lista de objetos `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}`, uno por par, con cada lista `tests` estructurada como en el caso de dos reportes. `letters` son las letras de las dos ejecuciones en la tabla de ejecuciones, y Δ es la primera menos la segunda.

Junto a `significance`, el JSON de comparación incluye `significance_settings`: el `method`, `n_resamples`, `alpha`, `seed`, qué ejecución corresponde a cada letra (`runs`), qué son `ci_lower`/`ci_upper`, `multiple_testing_correction: "none"`, cuántas métricas se probaron por par y sobre cuántos pares, la nota en lenguaje sencillo sobre los valores p no corregidos (abajo), y cualquier nota que hayan generado las pruebas (entradas excluidas de un emparejamiento, métricas no probadas).

### 5. Integración CLI

`mt-eval compare` expone una bandera `--significance`, con `--method` para elegir la prueba pareada (`approximate_randomization`, por defecto, o `paired_bootstrap`) y `--n-bootstrap` para definir el conteo de iteraciones:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` toma los archivos `*_report.json` que escribe `mt-eval run` (o los registros de ejecución, cuyo reporte hermano utiliza). Imprime la tabla de ejecuciones con una fila por métrica y una columna por ejecución, luego la tabla de significancia, y escribe el JSON de comparación en una ubicación neutral a menos que `-o` especifique otro archivo: `comparison-<hash>.json` junto a los reportes cuando comparten carpeta; de lo contrario, en `comparisons/` en su carpeta común más cercana (los reportes en la propia carpeta de cada ejecución, como las carpetas `mcp-run-<id>/` de `run_benchmark`, nunca reciben una comparación escrita en una de ellas). El `<hash>` son los primeros diez caracteres hexadecimales de un sha256 sobre los id de las ejecuciones comparadas en el orden dado, de modo que otra comparación en la misma carpeta nunca sobrescribe esta; comparar las mismas ejecuciones nuevamente reescribe su propio archivo. Especificar un archivo con `-o` reemplaza lo que esté allí, y la salida así lo indica. Imprime la ruta que escribió. Una comparación de ejecuciones sobre un corpus solo local, sellado o que requiera consentimiento cita sus oraciones, por lo que lleva la marca de ese corpus en un archivo adjunto (sidecar) `<file>.champollion.json` dondequiera que se escriba.

La fila **Avg latency (s/entry)** de la tabla de ejecuciones muestra `—` para una ejecución que no registró tiempo, con una nota debajo de la tabla explicando por qué: cada entrada provino de la caché, las salidas se generaron fuera del entorno de evaluación (harness), o el método no reportó ninguno. Un valor inferior a 0.01 s se muestra con cuatro decimales (un modelo pequeño en una CPU decodifica en pocos milisegundos por oración), nunca redondeado a 0.00.

### 6. Formato de salida

`format_significance_table()` renderiza la vista de consola; los mismos datos se agregan al reporte de comparación.

Los reportes se identifican con letras en el orden dado: el primero es la ejecución **A**, el segundo **B**, luego **C**, **D** y así sucesivamente, las mismas letras que la tabla de ejecuciones anterior. Cada tabla por pares nombra a sus dos ejecuciones mediante esas letras y sus ID de ejecución, por ejemplo `--- A (baseline) vs C (nllb-ft) ---`, y sus columnas y Δ usan las mismas letras (`Δ (A−C)`). Δ es siempre **primera − segunda**. La explicación de la tabla y cada nota debajo de ella se imprimen **una sola vez**, sin importar cuántos pares haya. Cada fila también imprime el **CI on Δ** del 95%: el intervalo percentil de bootstrap en `ci_lower`/`ci_upper` del JSON, que indica cuán grande es plausiblemente la diferencia, no solo su signo. Cada métrica está marcada con su dirección del registro de métricas (↑ más alto es mejor, ↓ más bajo es mejor), y una columna **Better** nombra la ejecución con la mejor puntuación, teniendo en cuenta la dirección, con `(n.s.)` cuando la diferencia no es significativa. De este modo, una tasa donde menor es mejor, como TER, cambio de código o alucinación, que subió imprime un Δ positivo con **B** como la mejor ejecución, y un modelo entrenado pasado en segundo lugar que supera a su línea base por 63.5 chrF++ imprime Δ −63.52 con **B** mejor. Una métrica cuya dirección no declara el registro se muestra con `?`. Las puntuaciones, Δ y el intervalo se imprimen con dos decimales, y con más (hasta seis) en una fila donde eso ocultaría una diferencia real: un spBLEU de 0.0684 frente a 0.0673 imprime Δ +0.0011 [+0.0001, +0.0021], nunca +0.00 [+0.00, +0.00] junto a **Yes**, y la tabla indica que esas filas llevan más decimales. El JSON conserva cuatro decimales, y cuatro cifras significativas para un valor distinto de cero menor que eso, de modo que una diferencia real nunca se almacene como 0. Las salidas idénticas dan un Δ exactamente de 0 y p = 1, por lo que nunca son significativas. Si p cae por debajo de α mientras el intervalo de bootstrap sobre Δ es exactamente [0, 0] (muy pocos segmentos difieren para estimar la diferencia), **Sig?** muestra `?†` y **Better** `—†`, con una nota: no se califica a ninguna ejecución como mejor en ella. Para una tasa de plugin donde menor es mejor, `winner` del JSON también tiene en cuenta la dirección (la tasa más baja gana), como siempre lo fue para `corpus_ter`; una tasa de plugin sin mejor dirección (neutral, como `morph_coverage`, o no declarada) tiene `winner: null`. Cada resultado también incluye su `direction`.

**Salida de consola** (números ilustrativos):
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

En este ejemplo, el veredicto es **sin diferencia significativa**: chrF++, la métrica principal, no separa A y B (p = 0.142), por lo que ninguna ejecución se considera mejor — aunque BLEU, spBLEU y TER favorezcan a A y el cambio de código favorezca a B. Esas filas se muestran, y un lector podría querer examinarlas, pero no deciden. La tabla enumera primero chrF++, luego las demás métricas estándar y después los diagnósticos.

Con más de dos ejecuciones, una tabla `--- X (run) vs Y (run) ---` sigue a otra bajo el encabezado único, y la nota contabiliza cada prueba realizada (`6 metrics were tested per pair (36 tests over 6 pairs)`).

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
      "ci_upper": 3.12,
      "method": "approximate_randomization",
      "direction": "higher",
      "role": "primary"
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

4. **Métricas de plugins**: Una tasa de plugin que aparece en AMBOS reportes se prueba únicamente a partir de los valores por segmento que el reporte contiene en realidad. Eso significa la propia agregación del plugin sobre sus resultados por entrada (la métrica FST), o la media del valor por entrada que promedia un agregado `avg_<name>` (las métricas conductuales). Una tasa de plugin sin valores por segmento se lista como no probada, nunca mostrada como 0.00 frente a 0.00. Los conteos como `total_words_checked` no se prueban.

5. **Reproducibilidad**: La semilla RNG debe registrarse en la salida para que los resultados sean exactamente reproducibles. Predeterminado a 12345 (coincidiendo con la convención de SacreBLEU).

---

## Qué NO Construir

- **Sin reinferencia de COMET en la prueba**: COMET se prueba de forma pareada a partir de las puntuaciones por segmento que ambos reportes ya contienen; el modelo nunca se vuelve a ejecutar por remuestreo. Dos ejecuciones puntuadas con diferentes modelos de COMET no se prueban entre sí.
- **Sin análisis bayesiano**: Apéguese al bootstrap frecuentista. Es lo que la comunidad de TA espera y comprende.
- **Sin corrección para pruebas múltiples**: Al probar múltiples métricas, no aplique correcciones de Bonferroni ni similares. La convención en la evaluación de TA es reportar valores p brutos por métrica y dejar que el lector interprete. `mt-eval compare` **lo indica** en su salida y en `comparison.json` (`significance_settings.multiple_testing_correction: "none"` con una nota en palabras sencillas): con varias métricas probadas, un resultado con p < 0.05 puede surgir por puro azar, y un Δ pequeño puede ser significativo sin ser relevante, por lo que se debe leer el CI sobre Δ y la fiabilidad de la métrica para el idioma antes de actuar sobre un único resultado "significativo".

---

## Agrupaciones de clasificación (ranking clusters) {#ranking-clusters}

> **Estado**: ✅ Implementado, para concursos. Una clasificación de concurso es un conjunto de **grupos (clusters)**, no un orden estricto — la prueba de significancia decide qué entradas vecinas son realmente distinguibles. Esta sección describe lo que se incluye, abarcando los casos donde la evidencia es más débil que una prueba pareada.

### Encadenamiento adyacente, numeración de competición

Las entradas se dividen primero por **track** — un sistema `constrained` nunca se clasifica contra uno `unconstrained`, y cada track tiene su propio ordenamiento, grupos de empate y rangos de clasificación, por lo que el "rango 1" siempre significa el rango 1 *dentro de un track*.

Dentro de un track, las entradas se ordenan por la métrica principal del concurso (chrF++ a menos que el concurso haya registrado una diferente), luego por las métricas de superficie restantes y finalmente por la entrega más temprana. Cada par **adyacente** en ese orden se prueba. Un par que la prueba no pueda separar comparte un rango, y los rangos compartidos se **encadenan**: si A empata con B y B empata con C, los tres caen en un solo grupo de empate, incluso cuando A y C nunca se compararon directamente.

Los rangos utilizan la numeración de competición — un empate triple en el primer lugar es `1, 1, 1` y la siguiente entrada es `4`; un empate de dos vías para el segundo lugar es `1, 2, 2, 4`.

**El límite honesto del encadenamiento**: la no significancia no es transitiva. Una cadena larga puede unir dos entradas que una prueba directa *sí* separaría. Por esa razón, un cluster se reporta como un **rango**, no como un punto.

### Rangos de clasificación

Cada entrada incluye `rank_min` y `rank_max` — la mejor y peor posición compatible con la evidencia, al estilo que WMT utiliza para sus rangos de clasificación. Una entrada solitaria en su cluster tiene `rank_min == rank_max`. Una entrada dentro de un cluster de cuatro que abarca las posiciones 2–5 tiene `rank_min: 2, rank_max: 5`, y **ninguna entrada dentro de ese cluster está "por delante de" otra**. Extraer un rango de un solo número a partir de un cluster es una interpretación errónea del resultado.

### La escala de evidencia

No todos los pares se pueden probar de la misma manera, por lo que cada par registra el peldaño del que provino realmente el veredicto. La etiqueta forma parte del resultado, nunca se omite:

| Peldaño | Evidencia | Cuándo está disponible | Fuerza |
|---|---|---|---|
| 1 | **Prueba pareada por segmento** — aleatorización aproximada por defecto, bootstrap pareado bajo solicitud (el algoritmo descrito arriba) | Solo cuando AMBAS entradas contienen un conjunto completo y alineado de puntuaciones por segmento | La prueba real |
| 2 | **Superposición del 95% de CI de bootstrap** en los límites de intervalo publicados | Cuando la métrica principal tiene límites de intervalo de confianza en ambas entradas (chrF++ los tiene; BLEU y COMET no tienen columnas de intervalos) | Un indicador conservador — los intervalos superpuestos **no** prueban equivalencia, y la no superposición es un umbral más estricto que una prueba pareada |
| 3 | **Igualdad puntual** al redondeo de visualización de la métrica | Siempre | El peldaño más débil: solo indica que los dos números impresos son idénticos |

### Concursos sellados: el peldaño 1 se ejecuta en el nodo

El peldaño 1 necesita puntuaciones por segmento de ambos sistemas. En un concurso sellado, el nodo de evaluación del organizador conserva las referencias y **nunca exporta salidas por segmento**. Ese es todo el propósito de la vía sellada y no es una configuración que se pueda relajar. Por lo tanto, la prueba pareada se traslada a los datos.

`mt-eval node verdicts` ejecuta la propia prueba pareada del concurso en el nodo, sobre las referencias selladas y cada par de entradas que calificó, y escribe **únicamente los veredictos**: para cada par, el método, el valor p, la diferencia de puntuación, su intervalo de confianza y el conteo de segmentos. En el archivo no se incluye ningún segmento, referencia ni traducción. El nodo lo firma con su clave score-sign. Luego, el organizador cierra con `mt-eval contest close --node-verdicts <file> --verify-key <node public key>`. La clasificación utiliza los veredictos solo si la firma se verifica y fueron calculados para este concurso, su conjunto sellado, su métrica, su política de empates congelada y su versión prometida del entorno de evaluación. De lo contrario, el cierre se rechaza.

Cuando no se proporcionan veredictos, los empates de un concurso sellado se basan en la superposición de intervalos de confianza donde la métrica tenga intervalos, y en la igualdad puntual donde no los tenga. Sus clusters son entonces más amplios de lo que serían con una prueba pareada. La clasificación en sí misma declara qué caso corresponde: `ranking_method.evidence_used` nombra los peldaños realmente utilizados y `ranking_method.node_verdicts` nombra el nodo cuyos veredictos se usaron, si los hubo.

### Lo que la clasificación no clasifica

- **Las entradas contrastivas** se reportan en su propia sección y nunca ganan.
- **El tiempo de ejecución, el hardware y el costo** se registran en la tarjeta de ejecución y se reportan, nunca se clasifican. No hay un track de eficiencia.
- **El juicio humano** no está presente en lo absoluto en estas clasificaciones. Se puede registrar una *selección* de evaluación humana frente a un concurso cerrado —qué sistemas cubriría un presupuesto fijo, tomando grupos de empate completos para no dividir nunca un cluster a la mitad—, pero no existen calificaciones; consulte las [Reglas de evaluación de TA](/docs/network/leaderboard/rules#verification-tiers).

---

## Mapa de Módulos

Dónde vive la característica entregada:

| Archivo | Rol |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` declarado como dependencia estricta |
| `mt_eval_harness/tester.py` | Importación directa de sacrebleu (sin protección `HAS_SACREBLEU`); calcula los CI por ejecución |
| `mt_eval_harness/significance.py` | Pruebas pareadas (`paired_approximate_randomization`, por defecto, y `paired_bootstrap`), `SignificanceResult`, funciones de métricas integradas (chrF++, BLEU, spBLEU, TER, COMET a partir de puntuaciones por segmento en caché, coincidencia exacta; el compuesto a nivel de segmento retirado se mantiene solo para leer archivos de comparación antiguos), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Intervalos de confianza bootstrap: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exporta `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Pruebas de significancia integradas en la comparación de reportes |
| `mt_eval_harness/cli.py` | Banderas `--significance` / `--method` / `--n-bootstrap` (compare) y `--no-ci` / `--n-bootstrap-ci` (test) |
| `mt_eval_harness/dashboard.py` | Expone la significancia en la tabla de comparación (mejora opcional) |

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

Las métricas deterministas a nivel de corpus calculadas por el entorno de evaluación:
- `corpus_chrf` (puntuación chrF++)
- `corpus_bleu` (puntuación BLEU)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (cuando hay datos de FST presentes)


El intervalo de chrF++ es parte del valor principal publicado (`chrF++ 47.5 [45.9, 49.0]`). Los CI **también** se calculan para `comet_score`, mediante bootstrap a partir de sus puntuaciones por entrada almacenadas en caché (sin inferencia neuronal redundante). No se calcula ningún CI compuesto para ejecuciones nuevas; el CI compuesto almacenado de una tarjeta heredada solo se vuelve a derivar cuando dicha tarjeta se verifica.

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

### COMET (una métrica estándar cuando se calcula, junto a chrF++)

COMET es una **métrica neuronal que se muestra junto al valor principal de chrF++** siempre que se haya calculado, con su ID de modelo. Nunca se combina con chrF++, y no es el valor principal porque requiere un modelo grande y no está calibrada para la mayoría de las lenguas de bajos recursos (consulte la [Especificación de puntuación §2.3](/docs/network/specifications/scoring#2-metric-inventory)). Los CI de bootstrap se calculan sobre sus puntuaciones por entrada almacenadas en caché:
- Modelo: `Unbabel/wmt22-comet-da` (modelo basado en referencias de WMT 2022); AfriCOMET se selecciona automáticamente para las lenguas africanas admitidas
- Calculado cuando `unbabel-comet` está instalado
- Puntuaciones por entrada almacenadas en las entradas de TestReport; el valor del corpus incluye una advertencia de calibración para bajos recursos
- Vuelto a derivar por el verificador — un valor COMET reportado debe reproducirse
- Dependencia opcional: `python3 -m pip install 'mt-eval-harness[comet]'` (o `mt-eval setup --comet`)

### Columnas de Supabase

La tabla `run_cards` contiene las columnas que admiten valores nulos correspondientes (consulte [scoring.md §9.1](/docs/network/specifications/scoring)):
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — el valor principal y su intervalo del 95%
- `comet_score` (`real`) — mostrado junto al valor principal, nunca combinado
- `corpus_bleu` (`real`)

El conjunto completo de intervalos de confianza se almacena dentro del JSON `scores` de la tarjeta de ejecución bajo `confidence_intervals` (según el esquema de la tarjeta de ejecución en scoring.md §9); solo los límites de chrF++ también están desnormalizados como columnas.
