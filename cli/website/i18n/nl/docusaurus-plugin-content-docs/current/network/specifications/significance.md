---
sidebar_position: 7
title: "Statistische significantietoetsing"
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

# Statistische Significantietesting

> **Status**: ✅ Uitgebracht. Gepaarde significantietoetsing (standaard benaderende randomisatie; de gepaarde bootstrap op verzoek) en bootstrap-betrouwbaarheidsintervallen zijn geïmplementeerd in `mt_eval_harness/significance.py` en `mt_eval_harness/confidence.py`, geëxporteerd vanuit het pakket, beschikbaar gemaakt via de CLI en gedekt door de testsuites voor significantie / betrouwbaarheid / scoring.
> **Codebase**: `arena` — gekoppeld aan `tester.py` (betrouwbaarheidsintervallen per run) en `compare.py` (significantie tussen runs).
> **Doel**: Onderzoekers in staat stellen te bepalen of het verschil tussen twee evaluatieruns statistisch significant is of louter ruis.

Deze pagina documenteert het **geïmplementeerde gedrag** — het is beschrijvend, geen takenlijst.

---

## Waarom Dit Belangrijk Is

Bij het vergelijken van twee runs (illustratief: Systeem A chrF++ 42,96 vs. Systeem B chrF++ 41,80 op 92 invoeren) zegt een enkel puntsverschil op zichzelf niets over of het reëel is of ruis. Met slechts ~92 testinvoeren kan willekeurige variatie gemakkelijk schommelingen van 1–2 punten veroorzaken. Experts vragen om significantietests — daarom berekent het harnas deze.

**Onder de scoringsstandaard (`standard/1`) bepaalt de gepaarde toets op chrF++ of de ene run beter is dan de andere.** chrF++ is de vooraf vastgelegde primaire metriek ([Scoringsspecificatie](/docs/network/specifications/scoring#how-runs-are-scored)). BLEU, spBLEU, TER en COMET (wanneer beide runs COMET-scores per segment van hetzelfde model bevatten) worden getoetst en getoond als secundaire standaardmetrieken, en exacte overeenkomsten (exact match) en plugin-percentages als diagnostiek; geen daarvan geeft de doorslag. Dit volgt Kocmi et al. (2021, "To Ship or Not to Ship"), die over duizenden menselijke beoordelingen heen ontdekten dat een metriekverschil in combinatie met de significantie ervan voorspelt wat de menselijke voorkeur is.

---

## Algoritme: Gepaarde benaderende randomisatie (standaard)

`mt-eval compare --significance` gebruikt de **gepaarde benaderende randomisatie (AR)**-toets van Riezler & Maxwell (2005). Dit is tevens de standaard van SacreBLEU voor het vergelijken van systemen.

### Hoe Het Werkt

Gegeven twee systemen A en B geëvalueerd op dezelfde N testinvoeren:

1. Bereken het waargenomen verschil op corpusniveau: `Δ = metric(A) - metric(B)`.
2. Herhaal dit `n_trials` keer (standaard 1000):
   a. Verwissel voor elk item de outputs van A en B met een kans van ½.
   b. Herbereken de corpusmetriek op de twee gehusselde stapels.
   c. Registreer of `|Δ_shuffled| ≥ |Δ|`.
3. De p-waarde is het tweezijdige behaalde significantieniveau:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. De +1 telt de waargenomen toewijzing als één geldige trekking mee, zodat p nooit exact 0 is.
4. Als p < α (standaard 0,05), wordt het verschil gerapporteerd als significant.

Het betrouwbaarheidsinterval voor Δ is een bootstrap-percentielinterval (AR levert een p-waarde op, geen interval). Het wordt berekend op een afzonderlijke willekeurige stroom, zodat het de AR-trekkingen niet verstoort.

### Belangrijkste Eigenschappen

- **Een echte hypothesétoets:** de husselingen worden getrokken onder de nulhypothese dat het geen verschil maakt welk systeem een bepaald item heeft geproduceerd.
- **Gepaard:** beide systemen worden item voor item vergeleken, waardoor de correlatie op itemniveau behouden blijft.
- **Niet-parametrisch:** er wordt geen aanname gedaan over hoe scores zijn verdeeld.

### De gepaarde bootstrap (beschikbaar, niet de standaard)

`paired_bootstrap()` implementeert Koehns (2004) gepaarde bootstrap: deze herhaalt de steekproeftrekking van items met teruglegging en telt hoe vaak het teken van Δ omslaat. Dit wordt aangeboden voor vergelijkbaarheid met oudere publicaties, maar het is een heuristiek voor tekenrobuustheid, geen tekstboek-significantieniveau. De verdeling ervan is gecentreerd rond de waargenomen Δ, niet rond de nulhypothese, waardoor het de significantie kan overschatten vergeleken met AR. Selecteer dit op de opdrachtregel met `mt-eval compare <reports…> --significance --method paired_bootstrap`, of met `method="paired_bootstrap"` in `run_significance_tests`.

---

## sacrebleu Is een Harde Afhankelijkheid

sacrebleu is een harde afhankelijkheid. Een MT-evaluatieharnas dat geen chrF++ of BLEU kan berekenen, is geen MT-evaluatieharnas, dus:

1. `sacrebleu>=2.3` is gedeclareerd onder `[project.dependencies]` in `pyproject.toml` (niet `[project.optional-dependencies]`).
2. Het wordt direct geïmporteerd in `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — zonder `try/except`-beveiliging.
3. Het wordt direct geïmporteerd in `significance.py`.

Er zijn nergens `HAS_SACREBLEU`-conditionele paden: uitvoeren zonder sacrebleu is geen ondersteunde configuratie.

---

## Implementatie

### 1. sacrebleu als harde afhankelijkheid

`pyproject.toml` declareert `sacrebleu>=2.3` onder `[project.dependencies]`, en `tester.py` importeert het direct:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

Er zijn geen `if HAS_SACREBLEU:`-beveiligingen in `tester.py` — de conditionele importpaden zijn verwijderd.

---

### 2. Module: `mt_eval_harness/significance.py`

De significantie-implementatie (standaard benaderende randomisatie, gepaarde bootstrap op verzoek). De publieke interface:

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

### 3. Ingebouwde metriekfuncties

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

### 4. Integratie in `compare.py`

`compare.py` voert een rechtstreekse vergelijking uit van meerdere TestReports en voert significantietoetsen ertussen uit. `run_significance_tests()` stuurt de toetsen aan over twee rapporten en `format_significance_table()` rendert ze. Elk resultaat bevat zijn `role`: `primary` (chrF++ — de enige toets die de doorslag geeft), `secondary` (de andere standaardmetrieken) of `diagnostic`. Het toetst, in deze volgorde:

| Metriek | Rol | Berekend per hersteekproef op basis van |
|---|---|---|
| `corpus_chrf` | primair | sacreBLEU-statistieken per segment |
| `corpus_bleu` | secundair | sacreBLEU-statistieken per segment |
| `corpus_spbleu` | secundair | sacreBLEU-statistieken per segment, op de FLORES-200 SentencePiece-tokenizer (spBLEU is BLEU met die tokenizer, de waarde die FLORES/NLLB-tabellen rapporteren). Wanneer de tokenizer niet beschikbaar is (geen `sentencepiece`, of offline waarbij het model nog niet is gedownload), wordt deze vermeld als niet getoetst, nooit geruisloos weggelaten |
| `corpus_ter` | secundair | sacreBLEU-statistieken per segment. TER is een bewerkingspercentage (edit rate), dus **lager is beter**: een negatieve Δ is in het voordeel van A |
| `comet_score` | secundair | de COMET-scores per segment die beide rapporten al bevatten (hun gemiddelde is de systeemscore van COMET; het model wordt nooit opnieuw uitgevoerd). Vermeld als niet getoetst, met de reden, wanneer slechts één run met COMET is gescoord of de twee verschillende COMET-modellen gebruikten |
| `exact_match_rate` | diagnostisch | de markering voor exacte overeenkomst (exact match) van elk item |
| Plugin-percentages in beide rapporten, bijv. `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate` | diagnostisch | de eigen resultaten per item van de plugin, geaggregeerd op dezelfde manier als de hoofdscore |

**De vervallen samengestelde score (composite) wordt niet getoetst.** De gewogen samengestelde score en de `segment_composite`-rij die hier voorheen werden getoetst, zijn komen te vervallen door de scoringsstandaard ([Scoringsspecificatie §4](/docs/network/specifications/scoring#4-composite-score)). Een vergelijkings-JSON die vóór de standaard is geschreven, toont nog steeds de rijen `segment_composite` (of `composite_score`), gelabeld als een verouderde samengestelde score die niets beslist. Wanneer een vergeleken rapport verouderd is, meldt `compare` dat de samengestelde score is vervallen en vergelijkt deze niet.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Wanneer meer dan 2 rapporten worden vergeleken, worden paarsgewijze significantietoetsen uitgevoerd voor alle paren: `significance` is dan een lijst van `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}`-objecten, één per paar, waarbij elke `tests`-lijst dezelfde vorm heeft als bij twee rapporten. `letters` zijn de letters van de twee runs in de runtabel, en Δ is de eerste minus de tweede.

Naast `significance` bevat de vergelijkings-JSON `significance_settings`: de `method`, `n_resamples`, `alpha`, `seed`, welke run bij elke letter hoort (`runs`), wat `ci_lower`/`ci_upper` zijn, `multiple_testing_correction: "none"`, hoeveel metrieken per paar zijn getoetst en over hoeveel paren, de toelichting in duidelijke bewoordingen over ongecorrigeerde p-waarden (hieronder), en eventuele opmerkingen die tijdens de toetsen naar voren kwamen (items uitgesloten van een koppeling, niet-getoetste metrieken).

### 5. CLI-integratie

`mt-eval compare` biedt een `--significance`-vlag, met `--method` om de gepaarde toets te kiezen (`approximate_randomization`, de standaard, of `paired_bootstrap`) en `--n-bootstrap` om het aantal iteraties in te stellen:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` accepteert de `*_report.json`-bestanden die `mt-eval run` schrijft (of de runlogs, waarvan het het bijbehorende rapport gebruikt). Het toont de runtabel met één rij per metriek en één kolom per run, vervolgens de significantietabel, en schrijft de vergelijkings-JSON naar een neutrale locatie tenzij `-o` een ander bestand specificeert: `comparison-<hash>.json` naast de rapporten wanneer ze een map delen, anders in `comparisons/` in hun dichtstbijzijnde gemeenschappelijke map (in rapporten in de eigen map van elke run, zoals de mappen `mcp-run-<id>/` van `run_benchmark`, wordt nooit een vergelijking geschreven). De `<hash>` bestaat uit de eerste tien hexadecimale tekens van een sha256 over de id's van de vergeleken runs in de opgegeven volgorde, zodat een andere vergelijking in dezelfde map deze nooit overschrijft; het opnieuw vergelijken van dezelfde runs herschrijft hun eigen bestand. Het opgeven van een bestandsnaam met `-o` overschrijft wat daar staat, en de uitvoer vermeldt dat. Het toont het pad dat is geschreven. Een vergelijking van runs op een lokaal, verzegeld of toestemmingsvereist corpus citeert hun zinnen, en bevat daarom de markering van dat corpus in een `<file>.champollion.json`-sidecar waar deze ook wordt geschreven.

De **Avg latency (s/entry)** van de runtabel toont `—` voor een run die geen tijd heeft geregistreerd, met een opmerking onder de tabel die uitlegt waarom: elk item kwam uit de cache, de outputs zijn buiten het testkader gegenereerd, of de methode heeft er geen gerapporteerd. Een waarde onder 0,01 s wordt weergegeven met vier decimalen (een klein model op een CPU decodeert een zin in enkele milliseconden), nooit afgerond op 0,00.

### 6. Uitvoerformaat

`format_significance_table()` geeft de consoleweergave weer; dezelfde gegevens worden toegevoegd aan de vergelijkings-JSON.

De rapporten krijgen een letter in de opgegeven volgorde: de eerste is run **A**, de tweede **B**, vervolgens **C**, **D** enzovoort, dezelfde letters als in de bovenstaande runtabel. Elke paarsgewijze tabel benoemt zijn twee runs aan de hand van die letters en hun run-id's, bijvoorbeeld `--- A (baseline) vs C (nllb-ft) ---`, en de kolommen en Δ gebruiken dezelfde letters (`Δ (A−C)`). Δ is altijd **eerste − tweede**. De toelichting op de tabel en elke opmerking eronder worden **één keer** afgedrukt, ongeacht het aantal paren. Elke rij toont ook het 95% **CI on Δ**: het bootstrap-percentielinterval in `ci_lower`/`ci_upper` van de JSON, dat aangeeft hoe groot het verschil aannemelijk is, niet alleen het teken ervan. Elke metriek is gemarkeerd met de richting vanuit het metriekregister (↑ hoger is beter, ↓ lager is beter), en een kolom **Better** noemt de run met de betere score, rekening houdend met de richting, met `(n.s.)` wanneer het verschil niet significant is. Dus een percentage waarbij lager beter is, zoals TER, codeswitching of hallucinatie, dat is gestegen, toont een positieve Δ met **B** als de betere run, en een getraind model dat als tweede wordt meegegeven en zijn baseline met 63,5 chrF++ verslaat, toont Δ −63,52 met **B** als betere. Een metriek waarvan het register de richting niet specificeert, wordt weergegeven met `?`. Scores, Δ en het interval worden afgedrukt met twee decimalen, en met meer (tot zes) op een rij waar dat een reëel verschil zou verbergen: een spBLEU van 0,0684 tegen 0,0673 toont Δ +0,0011 [+0,0001, +0,0021], nooit +0,00 [+0,00, +0,00] naast **Yes**, en de tabel vermeldt dat die rijen meer decimalen bevatten. De JSON bewaart vier decimalen, en vier significante cijfers voor een niet-nulwaarde die kleiner is dan dat, zodat een reëel verschil nooit als 0 wordt opgeslagen. Identieke outputs leveren een Δ van exact 0 en p = 1 op, waardoor ze nooit significant zijn. Als p onder α daalt terwijl het bootstrap-interval op Δ exact [0, 0] is (te weinig segmenten verschillen om het verschil te schatten), toont **Sig?** `?†` en **Better** `—†`, met een opmerking: er wordt geen run als beter aangemerkt. Voor een plugin-percentage waarbij lager beter is, houdt de JSON-`winner` ook rekening met de richting (het lagere percentage wint), zoals het altijd al was voor `corpus_ter`; een plugin-percentage zonder voorkeursrichting (neutraal, zoals `morph_coverage`, of niet-aangegeven) heeft `winner: null`. Elk resultaat bevat tevens zijn `direction`.

**Console-uitvoer** (illustratieve getallen):
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

In dit voorbeeld luidt het oordeel **geen significant verschil**: chrF++, de primaire metriek, maakt geen onderscheid tussen A en B (p = 0,142), dus wordt geen van beide runs als beter aangemerkt — hoewel BLEU, spBLEU en TER in het voordeel van A zijn en codeswitching in het voordeel van B. Die rijen worden getoond, en een lezer wil er wellicht nader naar kijken, maar ze geven niet de doorslag. De tabel vermeldt eerst chrF++, daarna de andere standaardmetrieken en vervolgens de diagnostiek.

Bij meer dan twee runs volgt de ene `--- X (run) vs Y (run) ---`-tabel op de andere onder de enkele koptekst, en de opmerking telt elke uitgevoerde toets (`6 metrics were tested per pair (36 tests over 6 pairs)`).

**JSON-uitvoer** (toegevoegd aan vergelijkingsrapport):
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

### 7. Dashboard-integratie (optionele uitbreiding)

Wanneer significantiegegevens aanwezig zijn in de vergelijkings-JSON, kan het dashboard deze tonen — een vergelijkingstabelrij met significantie-indicatoren (`*` voor p < 0,05, `**` voor p < 0,01). Dit is een presentatielaag bovenop de geïmplementeerde berekening en maakt geen deel uit van de kernfunctionaliteit.

---

## Randgevallen en Validatie

1. **Niet-overeenkomende invoeren**: De twee TestReports moeten dezelfde invoer-ID's hebben. Als dat niet het geval is (bijv. één is uitgevoerd op een subset), voer de significantietest dan alleen uit op de doorsnede. Waarschuw over uitgesloten invoeren.

2. **Te weinig invoeren**: Als N < 10, waarschuw dan dat significantietests onbetrouwbaar zijn met zo weinig invoeren. Voer ze toch uit, maar toon de waarschuwing.

3. **Identieke scores**: Als beide systemen identieke resultaten per invoer produceren, moet p_value 1,0 zijn (helemaal geen verschil).

4. **Plugin-metrieken**: Een plugin-percentage dat in BEIDE rapporten voorkomt, wordt alleen getoetst op basis van waarden per segment die het rapport daadwerkelijk bevat. Dat betekent de eigen aggregatie van de plugin over de resultaten per item (de FST-metriek), of het gemiddelde van de waarde per item die een `avg_<name>`-aggregaat middelt (de gedragsmetrieken). Een plugin-percentage zonder waarden per segment wordt vermeld als niet getoetst, nooit weergegeven als 0.00 vs 0.00. Tellingenaantallen zoals `total_words_checked` worden niet getoetst.

5. **Reproduceerbaarheid**: De RNG-seed moet worden gelogd in de uitvoer zodat resultaten exact reproduceerbaar zijn. Standaard 12345 (overeenkomstig de SacreBLEU-conventie).

---

## Wat NIET te Bouwen

- **Geen hernieuwde COMET-inferentie in de toets**: COMET wordt gepaard getoetst op basis van de scores per segment die beide rapporten al bevatten; het model wordt nooit opnieuw uitgevoerd per hersteekproef. Twee runs die zijn gescoord met verschillende COMET-modellen worden niet tegen elkaar getoetst.
- **Geen Bayesiaanse analyse**: Houd vast aan de frequentistische bootstrap. Dat is wat de MT-gemeenschap verwacht en begrijpt.
- **Geen correctie voor meervoudig toetsen**: Pas bij het toetsen van meerdere metrieken geen Bonferroni- of vergelijkbare correcties toe. De conventie bij MT-evaluatie is om ruwe p-waarden per metriek te rapporteren en de interpretatie aan de lezer over te laten. `mt-eval compare` **vermeldt dit uitdrukkelijk** in de uitvoer en in `comparison.json` (`significance_settings.multiple_testing_correction: "none"` met een toelichting in duidelijke bewoordingen): wanneer meerdere metrieken worden getoetst, kan één resultaat met p < 0,05 louter op basis van toeval ontstaan, en kan een kleine Δ significant zijn zonder van belang te zijn. Raadpleeg daarom het betrouwbaarheidsinterval op Δ en de betrouwbaarheid van de metriek voor de taal voordat u afgaat op een enkel "significant" resultaat.

---

## Rangschikkingsclusters {#ranking-clusters}

> **Status**: ✅ Uitgebracht, voor competities. Een rangschikking in een competitie is een set **clusters**, geen strikte volgorde — de significantietoets bepaalt welke aangrenzende inzendingen daadwerkelijk van elkaar te onderscheiden zijn. Dit gedeelte beschrijft wat er wordt geleverd, inclusief situaties waarin het bewijs zwakker is dan een gepaarde toets.

### Aangrenzende ketenvorming, competitienummering

Inzendingen worden eerst onderverdeeld per **track** — een `constrained`-systeem wordt nooit gerangschikt tegen een `unconstrained`-systeem, en elk track heeft zijn eigen rangorde, gelijkstandgroepen en rangbereiken, zodat "rang 1" altijd rang 1 *binnen een track* betekent.

Binnen een track worden inzendingen gerangschikt op de primaire metriek van de competitie (chrF++ tenzij de competitie een andere heeft geregistreerd), vervolgens op de overige oppervlaktemetrieken en ten slotte op vroegste inzending. Elk **aangrenzend** paar in die volgorde wordt getoetst. Een paar dat de toets niet van elkaar kan onderscheiden, deelt een rang, en gedeelde rangen **vormen een keten**: als A gelijk eindigt met B en B gelijk eindigt met C, belanden alle drie in één gelijkstandgroep, zelfs wanneer A en C nooit direct zijn vergeleken.

Rangen gebruiken competitienummering — een drievoudige gelijkstand aan de top is `1, 1, 1` en de volgende inzending is `4`; een tweevoudige gelijkstand voor de tweede plaats is `1, 2, 2, 4`.

**De eerlijke beperking van ketenvorming**: niet-significantie is niet transitief. Een lange keten kan twee inzendingen samenvoegen die een directe toets *wel* van elkaar zou scheiden. Daarom wordt een cluster gerapporteerd als een **bereik**, niet als een punt.

### Rangbereiken

Elke inzending bevat `rank_min` en `rank_max` — de beste en slechtste positie consistent met het bewijs, in de stijl die WMT gebruikt voor zijn rangbereiken. Een inzending die alleen in zijn cluster staat, heeft `rank_min == rank_max`. Een inzending binnen een cluster van vier die de posities 2–5 beslaat, heeft `rank_min: 2, rank_max: 5`, en **geen enkele inzending binnen dat cluster staat "vóór" een andere**. Een rang bestaande uit een enkel getal halen uit een cluster is een verkeerde interpretatie van het resultaat.

### De bewijsladder

Niet elk paar kan op dezelfde manier worden getoetst, dus registreert elk paar de trede waar het oordeel daadwerkelijk vandaan kwam. Het label maakt deel uit van het resultaat en wordt nooit weggelaten:

| Trede | Bewijs | Wanneer het beschikbaar is | Kracht |
|---|---|---|---|
| 1 | **Gepaarde toets per segment** — standaard benaderende randomisatie, gepaarde bootstrap op verzoek (het hierboven beschreven algoritme) | Alleen wanneer BEIDE inzendingen een volledige, uitgelijnde set scores per segment bevatten | De echte toets |
| 2 | **95% bootstrap-CI-overlap** op de gepubliceerde intervalgrenzen | Wanneer de primaire metriek betrouwbaarheidsintervalgrenzen heeft voor beide inzendingen (chrF++ heeft dat; BLEU en COMET hebben geen intervalkolommen) | Een conservatieve benadering — overlappende intervallen bewijzen **geen** gelijkwaardigheid, en niet-overlap is een strengere maatstaf dan een gepaarde toets |
| 3 | **Puntgelijkheid** bij de weergaveafronding van de metriek | Altijd | De zwakste trede: het zegt alleen dat de twee getoonde getallen identiek zijn |

### Verzegelde competities: trede 1 draait op de node

Trede 1 vereist scores per segment van beide systemen. In een verzegelde competitie bewaart de evaluatie-node van de organisator de referenties en **exporteert nooit uitvoer per segment**. Dat is de hele essentie van de verzegelde lane, en het is geen instelling die versoepeld kan worden. Dus gaat de gepaarde toets in plaats daarvan naar de gegevens toe.

`mt-eval node verdicts` voert de eigen gepaarde toets van de competitie uit op de node, over de verzegelde referenties en elk paar inzendingen dat is gescoord, en schrijft **uitsluitend oordelen**: voor elk paar de methode, p-waarde, scoreverschil, het betrouwbaarheidsinterval en het aantal segmenten. Er bevindt zich geen segment, referentie of vertaling in het bestand. De node ondertekent het met zijn score-ondertekeningssleutel. De organisator sluit vervolgens af met `mt-eval contest close --node-verdicts <file> --verify-key <node public key>`. De rangschikking gebruikt de oordelen alleen als de handtekening geverifieerd wordt en ze berekend zijn voor deze competitie, de verzegelde set, de metriek, het bevroren beleid voor gelijkstand en de toegezegde versie van het testkader. Anders weigert de afsluiting.

Wanneer er geen oordelen worden geleverd, berusten de gelijke standen van een verzegelde competitie op betrouwbaarheidsintervaloverlap waar de metriek intervallen heeft, en op puntgelijkheid waar dat niet het geval is. De clusters zijn dan breder dan bij een gepaarde toets het geval zou zijn. De rangschikking zelf vermeldt welke situatie van toepassing is: `ranking_method.evidence_used` vermeldt de daadwerkelijk gebruikte treden, en `ranking_method.node_verdicts` vermeldt de node waarvan de oordelen zijn gebruikt, indien van toepassing.

### Wat de rangschikking niet rangschikt

- **Contrastieve inzendingen** worden gerapporteerd in hun eigen sectie en winnen nooit.
- **Uitvoeringstijd, hardware en kosten** staan op de runkaart en worden gerapporteerd, nooit gerangschikt. Er is geen efficiëntietrack.
- **Menselijke beoordeling** komt helemaal niet voor in deze rangschikkingen. Een *selectie* voor menselijke evaluatie — welke systemen binnen een vast budget zouden vallen, waarbij volledige gelijkstandgroepen worden meegenomen zodat een cluster nooit in tweeën wordt gesplitst — kan worden vastgelegd voor een afgesloten competitie, maar er bestaan geen beoordelingen; zie de [MT-evaluatieregels](/docs/network/leaderboard/rules#verification-tiers).

---

## Moduleoverzicht

Waar de geïmplementeerde functionaliteit zich bevindt:

| Bestand | Rol |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` gedeclareerd als een harde afhankelijkheid |
| `mt_eval_harness/tester.py` | Directe import van sacrebleu (geen `HAS_SACREBLEU`-beveiliging); berekent CI's per run |
| `mt_eval_harness/significance.py` | Gepaarde toetsen (`paired_approximate_randomization`, de standaard, en `paired_bootstrap`), `SignificanceResult`, ingebouwde metriekfuncties (chrF++, BLEU, spBLEU, TER, COMET op basis van gecachete scores per segment, exacte overeenkomst; de vervallen samengestelde score op segmentniveau wordt alleen bewaard om oude vergelijkingsbestanden te lezen), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap-betrouwbaarheidsintervallen: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exporteert `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Significantietoetsen gekoppeld aan rapportvergelijking |
| `mt_eval_harness/cli.py` | Vlaggen `--significance` / `--method` / `--n-bootstrap` (vergelijken) en `--no-ci` / `--n-bootstrap-ci` (toetsen) |
| `mt_eval_harness/dashboard.py` | Toont significantie in de vergelijkingstabel (optionele verbetering) |

---

## Testdekking

De testsuites voor significantie / betrouwbaarheid / scoring zijn groen. Ze dekken:

1. **Deterministisch met seed**: zelfde invoer + zelfde seed → zelfde p-waarde, elke keer
2. **Test met bekend antwoord**: twee identieke resultaatsets → p_value = 1,0
3. **Test met bekende significantie**: twee resultaatsets waarbij één duidelijk beter is (bijv. alle exacte overeenkomsten vs. alle missers) → p_value ≈ 0,0
4. **Niet-overeenkomende ID's**: geeft `ValueError` terug, of waarschuwt en berekent op de doorsnede
5. **Lege invoer**: wordt netjes afgehandeld (p_value = 1,0 of uitzondering)

---

## Betrouwbaarheidsintervallen (Aanvullende Functionaliteit)

> **Status**: ✅ GEÏMPLEMENTEERD in `confidence.py`

Betrouwbaarheidsintervallen (CI's) beantwoorden een andere vraag dan significantietesting:

- **Significantietesting** (`significance.py`): "Is het verschil tussen systeem A en systeem B reëel?"
- **Betrouwbaarheidsintervallen** (`confidence.py`): "Hoe onzeker is de score van dit systeem op zichzelf?"

### Implementatie: `confidence.py`

Maakt gebruik van dezelfde percentiel-bootstrap-resamplingmethode als significantietesting:

| Parameter | Waarde | Onderbouwing |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU-standaard, WMT 2024-conventie |
| `seed` | 12345 | SacreBLEU-standaardseed voor reproduceerbaarheid |
| `alpha` | 0,05 | Standaard betrouwbaarheidsniveau van 95% |
| Methode | Percentiel-bootstrap | Koehn (2004), Efron (1979) |

### Waarvoor CI's Worden Berekend

De deterministische metrieken op corpusniveau die door het testkader worden berekend:
- `corpus_chrf` (chrF++-score)
- `corpus_bleu` (BLEU-score)
- `exact_match_rate` (0,0–1,0)
- `fst_acceptance_rate` (wanneer FST-gegevens aanwezig zijn)


Het chrF++-interval maakt deel uit van de gepubliceerde hoofdscore (`chrF++ 47.5 [45.9, 49.0]`). CI's worden **ook** berekend voor `comet_score`, gebootstrapt vanuit de gecachete scores per item (geen redundante neurale inferentie). Er wordt geen samengesteld CI berekend voor nieuwe runs; een opgeslagen samengesteld CI van een verouderde kaart wordt alleen opnieuw afgeleid wanneer die kaart wordt geverifieerd.

### CLI-vlaggen

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Waarschuwing bij Kleine Steekproef

Wanneer N < 30 invoeren, geeft de module een waarschuwing dat CI's mogelijk een slechte dekking hebben. De bootstrap kan geen informatie creëren die afwezig is in de steekproef — met zeer weinig invoeren zullen de intervallen breed zijn, wat de hoge onzekerheid correct weerspiegelt.

### COMET (een standaardmetriek wanneer berekend, naast chrF++)

COMET is een **neurale metriek die naast de chrF++-hoofdscore wordt getoond** wanneer deze is berekend, met het bijbehorende model-id. Het wordt nooit vermengd met chrF++, en het is niet de hoofdscore omdat het een groot model vereist en ongekalibreerd is voor de meeste talen met weinig middelen (low-resource talen; zie [Scoringsspecificatie §2.3](/docs/network/specifications/scoring#2-metric-inventory)). Bootstrap-CI's worden berekend over de gecachete scores per item:
- Model: `Unbabel/wmt22-comet-da` (op referenties gebaseerd model van WMT 2022); AfriCOMET wordt automatisch geselecteerd voor ondersteunde Afrikaanse talen
- Berekend wanneer `unbabel-comet` is geïnstalleerd
- Scores per item opgeslagen in TestReport-items; de corpuswaarde bevat een voorbehoud met betrekking tot kalibratie voor low-resource talen
- Opnieuw afgeleid door de verificateur — een gerapporteerde COMET-waarde moet reproduceerbaar zijn
- Optionele afhankelijkheid: `python3 -m pip install 'mt-eval-harness[comet]'` (of `mt-eval setup --comet`)

### Supabase-kolommen

De `run_cards`-tabel bevat de corresponderende null-toegankelijke (nullable) kolommen (zie [scoring.md §9.1](/docs/network/specifications/scoring)):
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — de hoofdscore en het bijbehorende 95%-interval
- `comet_score` (`real`) — getoond naast de hoofdscore, nooit vermengd
- `corpus_bleu` (`real`)

De volledige set betrouwbaarheidsintervallen wordt opgeslagen in de runkaart-JSON `scores` onder `confidence_intervals` (volgens het runkaartschema in scoring.md §9); alleen de chrF++-grenzen zijn tevens gedenormaliseerd als kolommen.
