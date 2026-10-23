---
sidebar_position: 7
title: "Pagsusuri ng Estadistikal na Kabuluhan"
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

# Pagsubok sa Estadistikal na Kabuluhan

> **Katayuan**: ✅ Nailabas na. Ang paired significance testing (approximate randomization bilang default; paired bootstrap kapag hiniling) at mga bootstrap confidence interval ay ipinapatupad sa `mt_eval_harness/significance.py` at `mt_eval_harness/confidence.py`, na-export mula sa package, nakalantad sa CLI, at sakop ng mga test suite ng significance / confidence / scoring.
> **Codebase**: `arena` — ikinonekta sa `tester.py` (mga confidence interval bawat run) at `compare.py` (significance sa pagitan ng mga run).
> **Layunin**: Bigyang-daan ang mga mananaliksik na matukoy kung ang pagkakaiba sa pagitan ng dalawang evaluation run ay statistically significant o ingay lamang (noise).

Idinodokumento ng pahinang ito ang **nailabas na pag-uugali** — ito ay paglalarawan, hindi listahan ng gagawin.

---

## Bakit Ito Mahalaga

Kapag naghahambing ng dalawang run (halimbawa: System A chrF++ 42.96 vs System B chrF++ 41.80 sa 92 entry), ang raw point difference ay walang sinasabi sa sarili nito kung ito ba ay tunay o ingay lamang. Sa ~92 test entry lamang, madaling makalikha ang random variation ng 1–2 point na pagbabago. Humihiling ang mga eksperto ng significance tests — kaya kinakalkula ito ng harness.

**Sa ilalim ng pamantayan ng pagmamarka (`standard/1`), ang paired test sa chrF++ ang nagpapasiya kung ang isang run ay mas mahusay kaysa sa isa pa.** Ang chrF++ ang paunang idineklarang pangunahing sukatan ([Pagtukoy ng Pagmamarka](/docs/network/specifications/scoring#how-runs-are-scored)). Sinusuri at ipinapakita ang BLEU, spBLEU, TER, at COMET (kapag ang parehong run ay may mga per-segment COMET score mula sa parehong modelo) bilang mga pangalawang karaniwang sukatan (secondary standard metrics), at ang exact match at mga rate ng plugin bilang mga diagnostic; wala sa mga ito ang nagpapasiya. Sumusunod ito kay Kocmi et al. (2021, "To Ship or Not to Ship"), na natuklasan sa libo-libong paghuhusga ng tao na ang pagkakaiba sa sukatan kasama ang significance nito ang siyang humuhula sa kagustuhan ng tao.

---

## Algoritmo: Paired Approximate Randomization (naka-default)

Ginagamit ng `mt-eval compare --significance` ang pagsusuring **paired approximate randomization
(AR)** nina Riezler & Maxwell (2005). Ito rin ang default ng SacreBLEU para sa
paghahambing ng mga sistema.

### Paano Ito Gumagana

Kung may dalawang system na A at B na sinusuri sa parehong N test entry:

1. Kuhanin ang naobserbahang pagkakaiba sa antas ng corpus: `Δ = metric(A) - metric(B)`.
2. Ulitin nang `n_trials` na beses (default na 1000):
   a. Para sa bawat entry, pagpalitin ang mga output ng A at B na may probability na ½.
   b. Muling kalkulahin ang corpus metric sa dalawang pinagbalasang bunton (shuffled piles).
   c. Itala kung `|Δ_shuffled| ≥ |Δ|`.
3. Ang p-value ay ang two-sided achieved significance level:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. Binibilang ng +1 ang
   naobserbahang pagtatalaga bilang isang wastong draw, kaya ang p ay hindi kailanman eksaktong 0.
4. Kung p < α (default na 0.05), iuulat ang pagkakaiba bilang significant.

Ang confidence interval sa Δ ay isang bootstrap percentile interval (nagbibigay ang AR ng
p-value, hindi interval). Kinakalkula ito sa isang hiwalay na random stream upang
hindi nito maabala ang mga draw ng AR.

### Mahahalagang Katangian

- **Isang tunay na hypothesis test:** ang mga shuffle ay kinukuha sa ilalim ng null hypothesis
  na walang pagkakaiba kung aling sistema ang gumawa ng isang partikular na entry.
- **Paired:** inihahambing ang parehong sistema nang bawat entry (entry by entry), na nagpapanatili
  ng korelasyon sa antas ng entry.
- **Non-parametric:** wala itong ipinapalagay tungkol sa kung paano naipapamahagi ang mga score.

### Ang paired bootstrap (magagamit, hindi ang default)

Ipinapatupad ng `paired_bootstrap()` ang paired bootstrap ni Koehn (2004): nagre-resample ito ng
mga entry nang may pagpapalit (with replacement) at binibilang kung gaano kadalas magbago ang sign ng Δ. Iniaalok
ito para sa paghahambing sa mga mas lumang papel, ngunit isa itong sign-robustness
heuristic, hindi isang karaniwang antas ng significance ayon sa aklat-aralin (textbook significance level). Nakasentro ang distribusyon nito sa
naobserbahang Δ, hindi sa null, kaya maaari nitong labis na ipahayag (overstate) ang significance kumpara
sa AR. Piliin ito sa command line gamit ang
`mt-eval compare <reports…> --significance --method paired_bootstrap`, o gamit ang
`method="paired_bootstrap"` sa `run_significance_tests`.

---

## Ang sacrebleu ay Hard Dependency

Ang sacrebleu ay hard dependency. Ang MT eval harness na hindi makakakalkula ng chrF++ o BLEU ay hindi MT eval harness, kaya:

1. Idinedeklara ang `sacrebleu>=2.3` sa ilalim ng `[project.dependencies]` sa `pyproject.toml` (hindi `[project.optional-dependencies]`).
2. Direkta itong ini-import sa `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — nang walang `try/except` guard.
3. Direkta itong ini-import sa `significance.py`.

Walang anumang `HAS_SACREBLEU` conditional path saanman: hindi suportadong configuration ang pagpapatakbo nang walang sacrebleu.

---

## Implementasyon

### 1. sacrebleu bilang hard dependency

Idinedeklara ng `pyproject.toml` ang `sacrebleu>=2.3` sa ilalim ng `[project.dependencies]`, at direkta itong ini-import ng `tester.py`:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

Walang mga `if HAS_SACREBLEU:` guard sa `tester.py` — inalis na ang mga conditional import path.

---

### 2. Module: `mt_eval_harness/significance.py`

Ang pagpapatupad ng significance (approximate randomization bilang default, paired bootstrap kapag hiniling). Ang pampublikong surface nito:

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

### 3. Mga built-in metric function

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

### 4. Integrasyon sa `compare.py`

Nagsasagawa ang `compare.py` ng magkatabing paghahambing (side-by-side comparison) ng maraming TestReport at nagpapatakbo ng significance testing sa pagitan ng mga ito. Pinangangasiwaan ng `run_significance_tests()` ang mga pagsusuri sa dalawang ulat at inire-render ang mga ito ng `format_significance_table()`. Bawat resulta ay nagtataglay ng `role` nito: `primary` (chrF++ — ang nag-iisang pagsusuri na nagpapasiya), `secondary` (ang iba pang karaniwang sukatan) o `diagnostic`. Sinusuri nito, sa ganitong pagkakasunod-sunod:

| Sukatan | Tungkulin | Kinakalkula bawat resample mula sa |
|---|---|---|
| `corpus_chrf` | pangunahin | mga estadistika ng sacreBLEU bawat segment |
| `corpus_bleu` | pangalawa | mga estadistika ng sacreBLEU bawat segment |
| `corpus_spbleu` | pangalawa | mga estadistika ng sacreBLEU bawat segment, sa FLORES-200 SentencePiece tokenizer (ang spBLEU ay BLEU na may ganoong tokenizer, ang bilang na iniuulat ng mga talahanayan ng FLORES/NLLB). Kapag hindi available ang tokenizer (walang `sentencepiece`, o offline kung saan hindi pa naida-download ang modelo) nakatala ito bilang hindi sinuri, hindi kailanman tahimik na inaalis |
| `corpus_ter` | pangalawa | mga estadistika ng sacreBLEU bawat segment. Ang TER ay isang edit rate, kaya **mas mababa ay mas maganda**: ang negatibong Δ ay pumapabor sa A |
| `comet_score` | pangalawa | ang bawat segment na mga score ng COMET na taglay na ng parehong ulat (ang mean ng mga ito ay ang system score ng COMET; hindi na muling pinapatakbo ang modelo). Nakatala bilang hindi sinuri, kasama ang dahilan, kapag isang run lamang ang namarkahan gamit ang COMET o magkaibang mga modelo ng COMET ang ginamit ng dalawa |
| `exact_match_rate` | diagnostic | exact-match flag ng bawat entry |
| Mga plugin rate sa parehong ulat, hal. `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate` | diagnostic | sariling mga resulta bawat entry ng plugin, pinagsama-sama (aggregated) sa paraan tulad ng headline |

**Hindi sinusuri ang retiradong composite.** Ang weighted composite at ang hilera ng `segment_composite` na dating sinusuri rito ay niretiro na ng pamantayan ng pagmamarka ([Pagtukoy ng Pagmamarka §4](/docs/network/specifications/scoring#4-composite-score)). Ang isang comparison JSON na isinulat bago ang pamantayan ay nagpapakita pa rin ng mga hilera ng `segment_composite` (o `composite_score`) nito, na may label bilang legacy composite na walang pinagpapasyahan. Kapag ang isang inihambing na ulat ay luma (legacy), sinasabi ng `compare` na retirado na ang composite nito at hindi ito inihahambing.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Kapag higit sa 2 ulat ang inihambing, tatakbo ang mga pairwise significance test para sa lahat ng pares: ang `significance` ay magiging listahan ng mga `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}` object, isa bawat pares, kung saan ang bawat listahan ng `tests` ay may hugis tulad ng kaso ng dalawang ulat. Ang `letters` ay ang mga titik ng dalawang run sa talahanayan ng mga run, at ang Δ ay ang una bawas ang ikalawa.

Bukod sa `significance`, taglay ng comparison JSON ang `significance_settings`: ang `method`, `n_resamples`, `alpha`, `seed`, kung aling run ang bawat titik (`runs`), kung ano ang `ci_lower`/`ci_upper`, `multiple_testing_correction: "none"`, ilang sukatan ang sinuri bawat pares at sa ilang pares, ang simpleng paliwanag na tala tungkol sa uncorrected p-values (sa ibaba), at anumang mga tala na idinulog ng mga pagsusuri (mga entry na ibinukod sa isang pagpapares, mga sukatang hindi sinuri).

### 5. Integrasyon sa CLI

Naglalahad ang `mt-eval compare` ng flag na `--significance`, na may `--method` upang piliin ang paired test (`approximate_randomization`, ang default, o `paired_bootstrap`) at `--n-bootstrap` upang itakda ang bilang ng pag-ulit (iteration count):

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

Tinatanggap ng `compare` ang mga file na `*_report.json` na isinusulat ng `mt-eval run` (o ang mga run log, na ang kapatid na ulat nito ang ginagamit nito). Ipiniprint nito ang talahanayan ng run na may isang hilera bawat sukatan at isang hanay bawat run, pagkatapos ay ang talahanayan ng significance, at isinusulat ang comparison JSON sa isang neutral na lokasyon maliban kung magtakda ang `-o` ng isa pang file: `comparison-<hash>.json` katabi ng mga ulat kapag magkasama ang mga ito sa isang folder, kung hindi ay sa `comparisons/` sa pinakamalapit na karaniwang folder ng mga ito (ang mga ulat sa sariling folder ng bawat run, tulad ng mga `mcp-run-<id>/` folder ng `run_benchmark`, ay hindi kailanman sinusulatan ng paghahambing sa alinman sa mga ito). Ang `<hash>` ay ang unang sampung hex character ng sha256 sa mga id ng inihambing na run ayon sa ibinigay na pagkakasunod-sunod, kaya ang isa pang paghahambing sa parehong folder ay hindi kailanman magpapatong (overwrite) dito; ang paghahambing muli sa parehong mga run ay muling magsusulat sa sariling file ng mga ito. Ang pagpapangalan ng file gamit ang `-o` ay nagpapalit sa anumang naroon, at isinasaad ito ng output. Ipiniprint nito ang path na isinulat nito. Ang paghahambing ng mga run sa isang local-only, sealed, o consent-required na corpus ay sumisipi sa mga pangungusap ng mga ito, kaya nagtataglay ito ng marka ng corpus na iyon sa isang sidecar na `<file>.champollion.json` saanman ito isulat.

Ipinapakita ng **Avg latency (s/entry)** ng talahanayan ng run ang `—` para sa isang run na hindi nagtala ng oras, na may tala sa ilalim ng talahanayan na nagpapaliwanag kung bakit: bawat entry ay nanggaling sa cache, ginawa ang mga output sa labas ng harness, o walang iniulat ang paraan. Ang value na mas mababa sa 0.01 s ay ipinapakita hanggang apat na decimal (ang isang maliit na modelo sa isang CPU ay nagde-decode sa loob ng ilang millisecond bawat pangungusap), hindi kailanman ini-round sa 0.00.

### 6. Format ng output

Nire-render ng `format_significance_table()` ang console view; idinaragdag din ang parehong data sa comparison JSON.

Nilalagyan ng titik ang mga ulat ayon sa ibinigay na pagkakasunod-sunod: ang una ay run **A**, ang ikalawa ay **B**, pagkatapos ay **C**, **D** at iba pa, ang parehong mga titik tulad ng sa talahanayan ng run sa itaas. Pinapangalanan ng bawat pairwise na talahanayan ang dalawang run nito gamit ang mga titik na iyon at ang kanilang mga run id, halimbawa `--- A (baseline) vs C (nllb-ft) ---`, at ginagamit ng mga hanay nito at ng Δ ang parehong mga titik (`Δ (A−C)`). Ang Δ ay palaging **una − ikalawa**. Ang paliwanag sa talahanayan at bawat tala sa ilalim nito ay ipiniprint nang **isang beses**, gaano man karami ang mga pares. Ipiniprint din ng bawat hilera ang 95% **CI on Δ**: ang bootstrap percentile interval sa `ci_lower`/`ci_upper` ng JSON, na nagsasaad kung gaano kalaki ang posibleng pagkakaiba, hindi lamang ang sign nito. Minamarkahan ang bawat sukatan ng direksyon nito mula sa registry ng sukatan (↑ mas mataas ay mas maganda, ↓ mas mababa ay mas maganda), at pinapangalanan ng hanay na **Better** ang run na may mas magandang score, na isinasaalang-alang ang direksyon (direction-aware), na may `(n.s.)` kapag hindi significant ang pagkakaiba. Kaya ang isang rate kung saan mas mababa ay mas maganda tulad ng TER, code switching, o hallucination na tumaas ay nagpiprint ng positibong Δ na may **B** bilang mas magandang run, at ang isang sinanay na modelo na ipinasa nang pangalawa na tumalo sa baseline nito nang 63.5 chrF++ ay nagpiprint ng Δ −63.52 kung saan mas maganda ang **B**. Ang isang sukatan na ang direksyon ay hindi idineklara ng registry ay ipinapakita nang may `?`. Ang mga score, Δ, at ang interval ay ipiniprint nang hanggang dalawang decimal, at nang higit pa (hanggang anim) sa isang hilera kung saan maitatago nito ang isang tunay na pagkakaiba: ang spBLEU na 0.0684 laban sa 0.0673 ay nagpiprint ng Δ +0.0011 [+0.0001, +0.0021], hindi kailanman +0.00 [+0.00, +0.00] katabi ng **Yes**, at sinasabi ng talahanayan na ang mga hilerang iyon ay may higit pang mga decimal. Pinapanatili ng JSON ang apat na decimal, at apat na significant figure para sa isang non-zero value na mas maliit kaysa roon, kaya ang isang tunay na pagkakaiba ay hindi kailanman iniimbak bilang 0. Ang magkaparehong mga output ay nagbibigay ng Δ na eksaktong 0 at p = 1, kaya hindi kailanman significant ang mga ito. Kung ang p ay bumaba sa ilalim ng α habang ang bootstrap interval sa Δ ay eksaktong [0, 0] (napakakaunting segment ang nagkakaiba upang matantiya ang pagkakaiba), ipinapakita ng **Sig?** ang `?†` at ang **Better** ay `—†`, na may tala: walang run ang tinatawag na mas maganda rito. Para sa isang plugin rate kung saan mas mababa ay mas maganda, ang JSON `winner` ay direction-aware din (ang mas mababang rate ang nananalo), tulad ng dati para sa `corpus_ter`; ang isang plugin rate na walang mas magandang direksyon (neutral, tulad ng `morph_coverage`, o hindi idineklara) ay may `winner: null`. Nagtataglay din ang bawat resulta ng `direction` nito.

**Output sa console** (mga numerong pang-ilustrasyon):
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

Sa halimbawang ito, ang hatol ay **walang significant na pagkakaiba**: hindi pinaghihiwalay ng chrF++, ang pangunahing sukatan, ang A at B (p = 0.142), kaya walang run ang tinatawag na mas maganda — kahit na pinapaboran ng BLEU, spBLEU, at TER ang A at pinapaboran ng code-switching ang B. Ipinapakita ang mga hilerang iyon, at maaaring nais ng isang mambabasa na suriin ang mga ito, ngunit hindi ang mga ito ang nagpapasiya. Inililista muna ng talahanayan ang chrF++, pagkatapos ay ang iba pang mga karaniwang sukatan, kasunod ang mga diagnostic.

Kung higit sa dalawang run, sunod-sunod ang mga talahanayan ng `--- X (run) vs Y (run) ---` sa ilalim ng iisang header, at binibilang ng tala ang bawat pagsusuring ginawa (`6 metrics were tested per pair (36 tests over 6 pairs)`).

**Output sa JSON** (idinagdag sa ulat ng paghahambing):
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

### 7. Integrasyon sa dashboard (opsyonal na enhancement)

Kapag may significance data sa comparison JSON, maaari itong ipakita ng dashboard — isang row sa comparison-table na may significance indicators (`*` para sa p < 0.05, `**` para sa p < 0.01). Isa itong presentation layer sa ibabaw ng nailabas na computation, hindi bahagi ng core feature.

---

## Mga Edge Case at Validation

1. **Hindi magkatugmang mga entry**: Dapat may parehong entry ID ang dalawang TestReport. Kung wala (hal., tumakbo ang isa sa subset), subukan lamang ang significance sa intersection. Magbigay ng babala tungkol sa mga entry na hindi isinama.

2. **Masyadong kaunting entry**: Kung N < 10, magbigay ng babala na hindi maaasahan ang significance tests sa napakakaunting entry. Patakbuhin pa rin ang mga ito, ngunit i-print ang babala.

3. **Magkakaparehong score**: Kung parehong identical per-entry results ang ginagawa ng dalawang system, dapat 1.0 ang p_value (walang anumang pagkakaiba).

4. **Mga plugin metric**: Ang isang plugin rate na lumalabas sa PAREHONG ulat ay sinusuri lamang mula sa bawat segment na mga value na aktwal na hawak ng ulat. Nangangahulugan iyon ng sariling aggregation ng plugin sa mga per-entry na resulta nito (ang sukatang FST), o ang mean ng per-entry value na ina-average ng isang `avg_<name>` aggregate (ang mga behavioural metric). Ang isang plugin rate na walang mga value bawat segment ay nakatala bilang hindi sinuri, hindi kailanman ipinapakita bilang 0.00 vs 0.00. Ang mga bilang tulad ng `total_words_checked` ay hindi sinusuri.

5. **Reproducibility**: Dapat i-log sa output ang RNG seed upang eksaktong ma-reproduce ang mga resulta. Gamitin ang default na 12345 (tugma sa convention ng SacreBLEU).

---

## Ano ang HINDI Dapat Buuin

- **Walang muling pag-inference ng COMET sa pagsusuri**: Sinusuri nang nakapares (paired-tested) ang COMET mula sa bawat segment na mga score na taglay na ng parehong ulat; hindi na kailanman muling pinapatakbo ang modelo bawat resample. Ang dalawang run na minarkahan gamit ang magkaibang mga modelo ng COMET ay hindi sinusuri laban sa isa't isa.
- **Walang Bayesian analysis**: Manatili sa frequentist bootstrap. Ito ang inaasahan at nauunawaan ng komunidad ng MT.
- **Walang multi-test correction**: Kapag sumusuri ng maraming sukatan, huwag maglapat ng Bonferroni o mga katulad na pagwawasto. Ang nakagawian sa pagsusuri ng MT ay mag-ulat ng mga raw p-value bawat sukatan at hayaan ang mambabasa na magpaliwanag. **Isinasaad ito** ng `mt-eval compare` sa output nito at sa `comparison.json` (`significance_settings.multiple_testing_correction: "none"` na may simpleng paliwanag na tala): sa ilang sukatang sinuri, maaaring lumabas ang isang resulta sa p < 0.05 dahil lamang sa tsamba (chance alone), at ang isang maliit na Δ ay maaaring maging significant nang walang tunay na kabuluhan, kaya basahin ang CI sa Δ at ang pagiging maaasahan ng sukatan para sa wika bago kumilos batay sa iisang "significant".

---

## Mga ranking cluster {#ranking-clusters}

> **Katayuan**: ✅ Nailabas na, para sa mga contest. Ang pagraranggo sa contest ay isang hanay ng mga **cluster**, hindi isang mahigpit na pagkakasunod-sunod — ang significance test ang nagpapasiya kung aling magkatabing mga entry ang aktwal na mapag-iiba. Inilalarawan ng seksyong ito ang inilalabas, kabilang ang mga sitwasyon kung saan mas mahina ang ebidensya kaysa sa isang paired test.

### Pagkakadenang magkatabi (adjacent chaining), pagnunumero sa kompetisyon

Hinahati muna ang mga entry ayon sa **track** — ang isang `constrained` na sistema ay hindi kailanman iniraranggo laban sa isang `unconstrained`, at bawat track ay may sariling pagkakasunod-sunod, mga tie group, at mga rank range, kaya ang "rank 1" ay palaging nangangahulugang rank 1 *sa loob ng isang track*.

Sa loob ng isang track, inaayos ang mga entry ayon sa pangunahing sukatan ng contest (chrF++ maliban kung nagtala ang contest ng iba), pagkatapos ay ayon sa natitirang mga surface metric at panghuli ay ayon sa pinakamaagang pagsusumite. Sinusuri ang bawat **magkatabing (adjacent)** pares sa pagkakasunod-sunod na iyon. Ang pares na hindi mapaghiwalay ng pagsusuri ay nagbabahagi ng isang ranggo, at ang mga ibinahaging ranggo ay **nagkakadena (chain)**: kung tabla ang A sa B at tabla ang B sa C, mapupunta ang tatlo sa iisang tie group kahit na hindi kailanman direktang inihambing ang A at C.

Gumagamit ang mga ranggo ng pagnunumero sa kompetisyon (competition numbering) — ang tatlong-paraang tabla sa itaas ay `1, 1, 1` at ang susunod na entry ay `4`; ang dalawang-paraang tabla para sa pangalawa ay `1, 2, 2, 4`.

**Ang tapat na limitasyon ng pagkakadena**: ang kawalan ng significance (non-significance) ay hindi transitive. Maaaring pag-ugnayin ng isang mahabang kadena ang dalawang entry na *paghihiwalayin* sana ng isang direktang pagsusuri. Iyon ang dahilan kung bakit iniuulat ang isang cluster bilang isang **saklaw (range)**, hindi isang punto.

### Mga saklaw ng ranggo (Rank ranges)

Bawat entry ay nagtataglay ng `rank_min` at `rank_max` — ang pinakamaganda at pinakamasamang posisyon na naaayon sa ebidensya, sa estilong ginagamit ng WMT para sa mga rank range nito. Ang isang entry na nag-iisa sa cluster nito ay may `rank_min == rank_max`. Ang isang entry sa loob ng isang cluster ng apat na sumasaklaw sa mga posisyong 2–5 ay nagtataglay ng `rank_min: 2, rank_max: 5`, at **walang entry sa loob ng cluster na iyon ang "nauuna sa" isa pa**. Ang pagkuha ng isang solong-numerong ranggo mula sa isang cluster ay maling pagbasa sa resulta.

### Ang hagdan ng ebidensya (The evidence ladder)

Hindi bawat pares ay maaaring masuri sa parehong paraan, kaya itinatala ng bawat pares ang baytang (rung) kung saan aktwal na nagmula ang hatol. Bahagi ng resulta ang label, hindi kailanman inaalis:

| Baytang | Ebidensya | Kailan ito available | Lakas |
|---|---|---|---|
| 1 | **Per-segment paired test** — approximate randomization bilang default, paired bootstrap kapag hiniling (ang algorithm na inilarawan sa itaas) | Tanging kapag ang PAREHONG entry ay nagtataglay ng kumpleto at nakahanay na set ng score bawat segment | Ang tunay na pagsusuri |
| 2 | **95% bootstrap-CI overlap** sa na-publish na mga hangganan ng interval | Kapag ang pangunahing sukatan ay may mga hangganan ng confidence-interval sa parehong entry (mayroon ang chrF++; walang mga hanay ng interval ang BLEU at COMET) | Isang konserbatibong proxy — ang mga nag-o-overlap na interval ay **hindi** nagpapatunay ng pagkakatulad, at ang hindi pag-overlap ay mas mahigpit na pamantayan kaysa sa isang paired test |
| 3 | **Point equality** sa display rounding ng sukatan | Palagi | Ang pinakamahinang baytang: sinasabi lamang nito na ang dalawang naka-print na numero ay magkapareho |

### Mga selyadong contest: tumatakbo ang baytang 1 sa node

Kailangan ng baytang 1 ng mga score bawat segment mula sa parehong sistema. Sa isang selyadong contest, hawak ng evaluation node ng organizer ang mga sanggunian (references) at **hindi kailanman nag-e-export ng output bawat segment**. Iyon ang buong punto ng selyadong lane (sealed lane), at hindi ito isang setting na maaaring luwagan. Kaya ang paired test ang pupunta sa data sa halip.

Pinapatakbo ng `mt-eval node verdicts` ang sariling paired test ng contest sa node, sa ibabaw ng mga selyadong sanggunian at bawat pares ng mga entry na minarkahan nito, at nagsusulat ng **mga hatol lamang (verdicts only)**: para sa bawat pares, ang paraan, p-value, pagkakaiba ng score, ang confidence interval nito, at ang bilang ng segment. Walang segment, reference, o salin sa file. Nilalagdaan ito ng node gamit ang score-sign key nito. Isinasara pagkatapos ng organizer gamit ang `mt-eval contest close --node-verdicts <file> --verify-key <node public key>`. Ginagamit lamang ng pagraranggo ang mga hatol kung napatunayan ang lagda at kinakalkula ang mga ito para sa contest na ito, ang selyadong set nito, ang sukatan nito, ang naka-freeze nitong patakaran sa tabla, at ang ipinangakong bersyon ng harness nito. Kung hindi, tatanggi ang pagsasara.

Kapag walang ibinigay na mga hatol, ang mga tabla ng isang selyadong contest ay nakabatay sa pag-overlap ng confidence-interval kung saan may mga interval ang sukatan, at sa point equality kung saan wala. Dahil dito, magiging mas malawak ang mga cluster nito kaysa sa kung paired test ang ginamit. Isinasaad mismo ng pagraranggo kung aling kaso ang nalalapat: pinapangalanan ng `ranking_method.evidence_used` ang mga baytang na aktwal na ginamit, at pinapangalanan ng `ranking_method.node_verdicts` ang node kung kaninong mga hatol ang ginamit, kung mayroon man.

### Ang hindi iniraranggo ng pagraranggo

- Ang **mga contrastive entry** ay iniuulat sa kanilang sariling seksyon at hindi kailanman nananalo.
- Ang **runtime, hardware, at gastos** ay kasama sa run card at iniuulat, hindi kailanman iniraranggo. Walang efficiency track.
- Ang **paghuhusga ng tao (human judgment)** ay wala sa mga pagraranggong ito. Ang isang *pagpili* sa human-evaluation — kung aling mga sistema ang masasakop ng isang nakapirming badyet, na kumukuha ng buong mga tie group upang hindi kailanman mahati ang isang cluster — ay maaaring maitala laban sa isang saradong contest, ngunit walang mga rating na umiiral; tingnan ang [Mga Panuntunan sa Pagsusuri ng MT](/docs/network/leaderboard/rules#verification-tiers).

---

## Module Map

Kung saan matatagpuan ang nailabas na feature:

| File | Tungkulin |
|---|---|
| `pyproject.toml` | Idineklara ang `sacrebleu>=2.3` bilang isang hard dependency |
| `mt_eval_harness/tester.py` | Direktang sacrebleu import (walang `HAS_SACREBLEU` guard); kinakalkula ang mga CI bawat run |
| `mt_eval_harness/significance.py` | Mga paired test (`paired_approximate_randomization`, ang default, at `paired_bootstrap`), `SignificanceResult`, mga built-in na metric fn (chrF++, BLEU, spBLEU, TER, COMET mula sa mga naka-cache na per-segment score, exact match; ang retiradong segment-level composite ay pinapanatili lamang upang magbasa ng mga lumang comparison file), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Mga bootstrap confidence interval: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Nag-e-export ng `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Mga significance test na ikinonekta sa paghahambing ng ulat |
| `mt_eval_harness/cli.py` | Mga flag ng `--significance` / `--method` / `--n-bootstrap` (compare) at `--no-ci` / `--n-bootstrap-ci` (test) |
| `mt_eval_harness/dashboard.py` | Inilalantad ang significance sa talahanayan ng paghahambing (opsyonal na pagpapahusay) |

---

## Saklaw ng Test

Pumapasa ang significance / confidence / scoring suites. Sinasaklaw ng mga ito ang:

1. **Deterministic sa seed**: parehong inputs + parehong seed → parehong p-value, sa bawat pagkakataon
2. **Known-answer test**: dalawang identical result set → p_value = 1.0
3. **Known-significant test**: dalawang result set kung saan malinaw na mas mahusay ang isa (hal., lahat exact matches vs lahat misses) → p_value ≈ 0.0
4. **Hindi magkatugmang IDs**: nagra-raise ng `ValueError`, o nagbababala at kumakalkula sa intersection
5. **Empty inputs**: maayos na hinahandle (p_value = 1.0 o raise)

---

## Confidence Intervals (Kasamang Feature)

> **Katayuan**: ✅ IPINATUPAD sa `confidence.py`

Ang confidence intervals (CIs) ay sumasagot sa ibang tanong kaysa significance testing:

- **Significance testing** (`significance.py`): "Totoo ba ang pagkakaiba sa pagitan ng system A at system B?"
- **Confidence intervals** (`confidence.py`): "Gaano kalaki ang uncertainty sa score ng system na ito sa sarili nito?"

### Implementation: `confidence.py`

Gumagamit ng parehong percentile bootstrap resampling method gaya ng significance testing:

| Parameter | Halaga | Katwiran |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU default, WMT 2024 convention |
| `seed` | 12345 | SacreBLEU default seed para sa reproducibility |
| `alpha` | 0.05 | Standard na 95% confidence level |
| Paraan | Percentile bootstrap | Koehn (2004), Efron (1979) |

### Ano ang Nilalagyan ng CIs

Ang mga deterministikong sukatang pang-antas ng corpus (corpus-level metrics) na kinakalkula ng harness:
- `corpus_chrf` (chrF++ score)
- `corpus_bleu` (BLEU score)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (kapag mayroong FST data)


Ang chrF++ interval ay bahagi ng na-publish na headline (`chrF++ 47.5 [45.9, 49.0]`). Kinakalkula **rin** ang mga CI para sa `comet_score`, na na-bootstrap mula sa mga naka-cache na per-entry score nito (walang redundant na neural inference). Walang composite CI na kinakalkula para sa mga bagong run; ang nakaimbak na composite CI ng isang legacy card ay muling kinukuha (re-derived) lamang kapag na-verify ang card na iyon.

### Mga CLI Flag

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Babala sa Maliit na Sample

Kapag N < 30 entry, naglalabas ang module ng babala na maaaring mahina ang coverage ng CIs. Hindi makakalikha ang bootstrap ng impormasyong wala sa sample — sa napakakaunting entry, magiging malalapad ang intervals, na wastong sumasalamin sa mataas na uncertainty.

### COMET (isang karaniwang sukatan kapag kinakalkula, katabi ng chrF++)

Ang COMET ay isang **neural metric na ipinapakita katabi ng headline ng chrF++** tuwing kinakalkula ito, kasama ang model id nito. Hindi ito kailanman inihahalo sa chrF++, at hindi ito ang headline dahil nangangailangan ito ng malaking modelo at hindi naka-calibrate para sa karamihan ng mga low-resource na wika (tingnan ang [Pagtukoy ng Pagmamarka §2.3](/docs/network/specifications/scoring#2-metric-inventory)). Kinakalkula ang mga bootstrap CI sa mga naka-cache na score bawat entry nito:
- Modelo: `Unbabel/wmt22-comet-da` (modelong nakabatay sa sanggunian ng WMT 2022); awtomatikong pinipili ang AfriCOMET para sa mga sinusuportahang wikang Aprikano
- Kinakalkula kapag naka-install ang `unbabel-comet`
- Ang mga per-entry score ay nakaimbak sa mga TestReport entry; ang corpus value ay may kalakip na paalala sa pagkaka-calibrate sa low-resource
- Muling kinukuha ng verifier — ang isang iniulat na COMET value ay dapat na muling magagawa (must reproduce)
- Opsyonal na dependency: `python3 -m pip install 'mt-eval-harness[comet]'` (o `mt-eval setup --comet`)

### Mga column ng Supabase

Nagtataglay ang talahanayan ng `run_cards` ng mga kaukulang nullable na hanay (tingnan ang [scoring.md §9.1](/docs/network/specifications/scoring)):
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — ang headline at ang 95% interval nito
- `comet_score` (`real`) — ipinapakita katabi ng headline, hindi kailanman inihahalo
- `corpus_bleu` (`real`)

Ang buong hanay ng mga confidence interval ay nakaimbak sa loob ng `scores` JSON ng run-card sa ilalim ng `confidence_intervals` (alinsunod sa schema ng run-card sa scoring.md §9); tanging ang mga hangganan ng chrF++ ang na-denormalize rin bilang mga hanay.
