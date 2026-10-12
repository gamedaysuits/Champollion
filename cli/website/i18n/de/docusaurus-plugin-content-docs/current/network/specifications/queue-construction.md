---
sidebar_position: 8
title: "Spezifikation der Warteschlangenkonstruktion"
slug: '/network/specifications/queue-construction'
description: "Die transparente Formel hinter der Community-Compute-Warteschlange: Rangfolge nach erwartetem Kettenwert, jede Komponente veröffentlicht, jeder Rang von Hand nachvollziehbar."
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

# Spezifikation der Warteschlangenkonstruktion

**Formelversion: `ecv-v3` (erwarteter Kettenwert mit
Brückenzuverlässigkeit).** Dieses Dokument ist die normative Definition
dafür, wie
[champollion.dev/queue.json](https://champollion.dev/queue.json)
geordnet wird. Die Implementierung
(`arena/scripts/generate_sweep_queue.py` im öffentlichen Harness-Repository)
spiegelt diese Seite Abschnitt für Abschnitt wider; die Metadaten der
Warteschlange geben die exakten Parameterwerte wieder, die zum
Generierungszeitpunkt verwendet wurden, und **jedes Element trägt seine
vollständige Formelaufschlüsselung**, sodass jeder Rang allein aus dem
veröffentlichten JSON von Hand neu abgeleitet werden kann. Sollten diese
Seite und die Warteschlange jemals voneinander abweichen, handelt es
sich um einen Fehler — bitte melden Sie ihn.

**Die Warteschlange heute, in einem Absatz.** Die öffentliche Warteschlange führt sowohl LLM-Elemente (naive und angeleitete Prompting-Bedingungen) als auch MT-Service-Engine-Elemente auf einem einzigen Board, geordnet nach der Erhebungsreihenfolge (`map`, §2.2): erste Messungen (First Light) über Paare, Sprachen und Sprachfamilien hinweg pro Dollar, mit einem Erstmessungs-Boost (First-Reading Boost) für Sprachen, die noch nie gemessen wurden (§2.2), im Preview veröffentlichten Budgetstufen (§2.1.1) und dem vollständigen Ranking, das aus der Datenbank bereitgestellt wird (die statische Datei enthält den obersten Teil, wenn das vollständige Ranking ihr Größenlimit überschreitet, und weist darauf hin). Die folgenden Abschnitte bilden die normative Definition, die mit ihrer datierten Entscheidungshistorie aufbewahrt wird — die Metadaten jeder bereitgestellten Warteschlange benennen die genauen Parameter, nach denen sie geordnet wurde.

> **v3 (2026-06-13).** Jede Kante ist nun eine *Brücke* mit zwei Zahlen —
> Qualität und Zuverlässigkeit — und die Kettenmatrix arbeitet mit deren
> Produkt (§1.5). 62 einmal ausgeführte Vokabeleinträge aus jeweils einem
> Wort können nicht länger wie ein Pfad aussehen; Replikationen, größere
> Korpora, reichhaltigere Korpora und engere Konfidenzintervalle tragen
> allesamt bewerteten Wert. v2-Warteschlangen (nur Qualität) bleiben über
> ihre eigenen Metadaten interpretierbar.

## 1. Das Ziel: ein qualitätsgewichtetes Netz

Die Mission lautet: *jede Sprache in jede Sprache durch gemessene
einzelne Paarketten*. Eine Übersetzung zwischen zwei Sprachen ohne
direkten Benchmark wird durch **Verkettung** von gebenchmarkten Paaren
bedient (X→Pivot→Y), sodass der Wert eines Benchmarks nicht durch die
Anzahl seiner Korpora bestimmt wird, sondern durch die
**Kettenkapazität seines Graphen**.

**Definitionen.** Der *Benchmark-Graph* habe einen Knoten pro Sprache
und für jedes Sprachpaar mit mindestens einem veröffentlichten, nicht
disqualifizierten Lauf eine **Kantenstärke**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

Der chrF++-Wert auf Korpusebene ist die kanonische veröffentlichte Zahl
(siehe die [Bewertungsspezifikation](/docs/network/specifications/scoring));
*best*, weil eine Kette pro Sprung durch das beste demonstrierte System
geleitet würde. Paare ohne veröffentlichte Läufe haben s(e) = 0.

Die **geschätzte Kettenstärke** eines Pfads P zwischen zwei Sprachen ist

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— Kantenqualitäten verknüpfen sich multiplikativ, und jeder *Knotenpunkt*
(jeder dazwischenliegende Pivot) kostet einen zusätzlichen
Treuefaktor **λ < 1**.
Beide Entscheidungen sind in der Literatur zur Pivot-Übersetzung
begründet: Die Übersetzung durch einen Pivot verliert zuverlässig an
Qualität gegenüber der Direktübersetzung, und zwar stärker, als es die
naive Komposition nahelegt (Utiyama & Isahara
2007; Wu & Wang 2007); das Ausmaß des Verlusts hängt vom gewählten Pivot
ab (Paul et al. 2009), und der Aufbau *direkter*, nicht
englischzentrierter Paare schlägt das Englisch-Pivoting im großen
Maßstab messbar — um ~10 BLEU im Many-to-Many-Setting von M2M-100 (Fan
et al. 2021). λ ist die ständige Erinnerung der Formel daran, dass eine
geschätzte Kette keine Messung ist: nur ein direkter Lauf hebt den
Abschlag auf.

Die **Bestketten-Matrix** und das **Netzziel** lauten dann

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Q wird exakt als Kürzeste-Pfade-Problem unter der Standard-Log-Transformation
berechnet (Kantengewicht −ln(λ·s(e)) ≥ 0, Dijkstra, dann
Q = exp(−d)/λ). Φ ist die Konstruktion der *globalen Effizienz* nach
[Latora & Marchiori
(2001)](https://arxiv.org/abs/cond-mat/0101396), wobei der
1/Distanz-Kern durch multiplikative Kettentreue ersetzt wird — der
natürliche Kern, wenn Kanten eine Qualitätserhaltung pro Sprung statt
Einheitslängen tragen. (Warteschlange v1 reihte nach ungewichtetem
Zuwachs an globaler Effizienz — der Spezialfall dieser Familie, in dem
man über eine Kante nur weiß, ob sie existiert.)

### 1.5 Zuverlässigkeit: eine Brücke ist (q, r)

Ein auffälliger Wert auf einem winzigen, dünnen, nie replizierten
Korpus ist keine Brücke. v3 teilt daher jede gemessene Kante auf in:

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| Faktor | Definition | Volle Anrechnung bei | Verankerung |
|---|---|---|---|
| `f_size` | min(1, n/100), n = bewertete Einträge des besten Laufs | 100 Einträge | die Signifikanzuntergrenze des [Korpusdesigns](/docs/network/specifications/corpus-design); Koehn (2004) validiert Bootstrap-Tests an ~300-Satz-Mengen — selbst 300 ist „klein“, also mindert die Größe die Zuverlässigkeit, statt nur die Anzeige zu steuern |
| `f_rich` | min(1, L̄/5), L̄ = mittlere *effektive* Quelllänge | 5 effektive Wörter | AmericasNLP (Mager et al. 2021) übernahm chrF, weil Wort-Einheiten bei reicher Morphologie versagen; Mager et al. (2022) dokumentieren Whitespace-Token als die falsche Einheit |
| `f_conf` | min(1, 5/h), h = die chrF-95%-KI-Halbbreite des besten Laufs (Proxy `50/√n`, wenn unveröffentlicht) | KI ≤ ±5 chrF | die Rauschuntergrenze, unterhalb derer Deltas auf kleinen Korpora nicht unterscheidbar sind; Kocmi et al. (2021) zeigen, dass Deltas innerhalb des KI häufig der menschlichen Präferenz widersprechen |
| `f_repl` | min(1, runs/2) | 2 veröffentlichte Läufe | Marie, Fujita & Rubino (2021), Meta-Evaluation von 769 Arbeiten: unreplizierte Einzelvergleiche sind das dokumentierte Glaubwürdigkeitsversagen des Felds |

**Effektive Länge** wird in Inhaltseinheiten gemessen, nicht in
Whitespace-getrennten Wörtern: `L̄ = mean source chars / c(L)`, wobei die
*Zeichenökonomie* `c(L)` die Medianzahl der Zeichen auf der
Seite von Sprache L pro englischem Wort auf der ausgerichteten Seite
ist, gemessen aus den eigenen Parallelkorpora dieses Projekts (über
7.400 ausgerichtete Einträge zum Zeitpunkt der v3-Auslieferung: cmn 1.6,
jpn 2.3, kor 2.6; eng-Basiswert 5.0; deu 6.0; crk 4.7 — polysynthetische
Wörter, bewertet nach dem Inhalt, den sie tragen). Keine
Typologie-Nachschlagetabellen; die Schätzung schärft sich, während die
Korpora wachsen; Sprachen ohne eng-gepaarte Daten verwenden die
Standardökonomie. Pro Korpus in der Registry gestempelt
(`richness`-Block).

**Brückenstufen** (Anzeigevokabular): **established** — n ≥ 100,
L̄ ≥ 5, h ≤ 5, runs ≥ 2; **provisional** — gemessen, aber bei
mindestens einem Kriterium durchfallend;
**registered** — keine veröffentlichten Läufe. Eine Kettenaussage
(„man kann von X nach Y gelangen“) ist nur so stark wie die Stufe ihres
schwächsten Sprungs, und die Netzvisualisierung zeigt die
Zuverlässigkeit als Kantendeckkraft.

**Durchgerechnete Prüfungen** (aus dem eingecheckten
Verifizierungsskript, ausgeführt vor der v3-Auslieferung): *62
Vokabeleinträge aus jeweils einem Wort, ein Lauf* → r ≈ **0.04** (kein
Pfad); *200 Sätze, ±3 KI, 3 Läufe* → r = **1.00**; ein japanisches
Korpus mit 101 Einträgen, dessen naive Wortzahl 1.0 beträgt
(Skript-Artefakt), erholt sich auf 6.5 effektive Wörter und volles
`f_rich`. Grenzen und Monotonie pro Faktor werden
eigenschaftsgetestet.

**Wert eines Laufs unter v3.** Ein Lauf kann eine Brücke auf zwei Arten
verbessern, und ΔΦ nimmt die bessere von: **(a)** er wird zum besten
Lauf der Kante —
`ŝ_eff = vorhergesagte Qualität × r(n des Korpus, Reichhaltigkeit, KI-Proxy,
runs+1)`; oder **(b)** er repliziert lediglich — der aktuelle beste Lauf
bleibt, `f_repl` steigt. Replikation auf einer Kante mit nur einem
Lauf ist daher echter, bewerteter Wert, und ein größeres oder
reichhaltigeres Korpus auf einem gemessenen Paar übertrifft eine
Wiederholung des kleinen. Elemente legen `edge_quality`,
`edge_reliability`, `edge_tier`, `effective_strength`,
`post_run_reliability` und `predicted_effective` neben den v2-Vorhersagefeldern offen.

**Was Φ nicht ist.** Φ ist die interne Priorisierungswährung der
Warteschlange, keine Fähigkeitsaussage. Seine Eingaben sind
Entwicklungs-Set-Werte mit allen Vorbehalten des [Korpusdesign-Rahmens](/docs/network/specifications/corpus-design):
Eine mögliche Kontamination der Trainingsdaten macht jeden Wert zu einer
Obergrenze, chrF++-Werte sind über Sprachen hinweg nicht streng
vergleichbar, und kleine Korpora tragen weite Konfidenzintervalle. Die
Formel benötigt Φ nur, um *Läufe nach Nützlichkeit zu ordnen*; es wird
niemals als Qualitätsgarantie veröffentlicht.

## 2. Das Entscheidungsproblem

Die offenen Elemente der Warteschlange sind alle (Korpus, Modell, Bedingung)-Kombinationen, die zulässig sind (Development-Split, weiterverbreitbare Lizenz, nicht in Quarantäne, übertragungsfähig und **Benchmark-auflösbar** — siehe das Sprachidentitäts-Gate in §2.2) und sich noch nicht auf dem Leaderboard befinden. Identische Wiederholungen bereits abgedeckter Kombinationen sind ausgeschlossen — Run-Card-Fingerabdrücke deduplizieren sie bei der Veröffentlichung —, aber neue Modelle oder Bedingungen für ein bereits gemessenes Paar bleiben offene Elemente.

Beigesteuerte Rechenleistung ist ein Budget. Die Wahl, welches offene
Element als Nächstes ausgeführt wird, damit sich das Netz am schnellsten
verbessert, ist eine budgetierte Maximierung im Stil der
Abdeckungsprobleme, und der kanonische Ansatz ist die gierige Auswahl
nach **marginalem Wert pro Kosteneinheit**: Für monotone submodulare
Ziele trägt die gierige Regel die klassische (1 − 1/e)-Garantie
(Nemhauser, Wolsey & Fisher 1978), und ihre Nutzen/Kosten-Verhältnis-Form
ist der Standardalgorithmus unter Budgets (Khuller, Moss & Naor 1999).
Wir verwenden die Verhältnisregel als unser Reihungsprinzip.
(Ehrlichkeitshinweis: Unser Ziel weist abnehmende Erträge im Stil der
Abdeckungsprobleme in seinem deterministischen Kern auf, aber wegen der
stochastischen Vorhersageschicht zitieren wir die gierige Garantie als
*Motivation*, nicht als Theorem über genau dieses System.)

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

Elemente werden absteigend nach ECV gereiht. Gleichstände werden
aufgelöst: naiv vor gecoacht, günstiger zuerst, dann Element-ID.

### 2.1 Ranking-Korrekturen — 2026-07-12

Vier Anpassungen, die auf die gierige ECV-Regel aufgesetzt werden, jeweils
in den Metadaten der Queue widergespiegelt (`priority_parameters.contamination_ecv_factors`,
`priority_parameters.frontier_interleave`, `metadata.preview_policy`):

1. **Kontaminationsmultiplikator.** Der ECV jedes Elements wird mit einem
   Faktor aus dem Kontaminationsgrad seines Korpus multipliziert: **LOW 1.0 / MEDIUM
   0.4 / HIGH 0.1**, wobei ein unbekannter oder fehlender Grad als
   MEDIUM behandelt wird (niemals von sauberen Daten ausgehen). Begründung: Der saubere Kettengraph lässt nur
   LOW-Kontaminationskanten zu, sodass ein Nicht-LOW-Durchlauf ihn nicht betreten
   kann und bei gleichen Kosten nicht höher als saubere Mesh-Arbeit eingestuft werden darf.
   Nicht-LOW-Elemente bleiben in der Warteschlange — Vergleiche innerhalb relativer Bahnen
   besitzen realen Wert — sie werden lediglich hinter sauberer Arbeit eingeordnet.
2. **Frontier-Verschachtelung.** Nach der gierigen Sortierung trägt jeder 5. Prioritäts-
   platz das am höchsten eingestufte, noch nicht platzierte Element aus der
   Frontier-Modell-Menge (im Generator als Daten gepflegt und in den
   Metadaten widergespiegelt), sodass Frontier-Evidenz frühzeitig die Vorhersage-
   Priors erreicht, statt erst nachdem die günstigen Stufen gesättigt sind. Reine
   Umsortierung: Nichts wird entfernt oder dupliziert, ein Frontier-Element, das
   einen natürlichen Platz verdient hat, behält ihn, und die Prioritäten werden ausgehend
   von der verwobenen Reihenfolge nummeriert — das veröffentlichte Ranking ist die Wahrheit.
3. **Preview-Source-Hub-Obergrenze.** Die öffentliche Top-25-Vorschau zeigt höchstens
   **6** Elemente, die sich eine Quellsprache teilen, sodass ein einzelner
   gut ausgestatteter Hub das Schaufenster nicht monopolisieren kann. Elemente
   über der Obergrenze behalten ihre reale Priorität in der vollständigen Warteschlange; die Vorschau
   holt einfach das nächste geeignete Element in Ranking-Reihenfolge nach.
4. **Preview-Ausschluss konstruierter Sprachen.** Elemente, deren Quelle oder
   Ziel eine konstruierte Sprache ist, werden von der Vorschau übersprungen. Die
   Bestimmung erfolgt kartenfamiliengesteuert (Glottologs Kategorie „Artificial
   Language“, aus den Sprachkarten ausgelesen — niemals eine fest verdrahtete
   Sprachmenge), und die abgeleitete Codeliste wird in
   `metadata.preview_policy` veröffentlicht, sodass serverseitige Aktualisierungen dieselbe
   Auswahl anwenden.

(3) und (4) sind **ausschließlich Darstellungsrichtlinie**: Die vollständige `queue.json`,
ihr Ranking und ihre Prioritäten bleiben unberührt.

### 2.1.1 Budgetstufen — "Was bekommt man für X $?" (2026-08-24)

`queue-preview.json` enthält ein `budget_tiers`-Array, das für Budgets von **1 $ / 10 $ / 100 $ / 1000 $** das gierige (greedy), erschwingliche Präfix des veröffentlichten Rankings zusammenfasst: Gehen Sie die Elemente in Prioritätsreihenfolge durch, nehmen Sie jedes Element, dessen geschätzte Kosten noch in das Budget passen, überspringen Sie diejenigen, bei denen dies nicht der Fall ist, und füllen Sie weiter mit späteren, günstigeren Elementen auf. Jede Stufe berichtet, wie viele Elemente damit gekauft werden, wie hoch ihre geschätzten Gesamtkosten sind, wie viele verschiedene Sprachpaare und Modelle sie berühren und wie tief das Budget in das Ranking reicht (`max_priority`).

Da das Ranking bereits nach Grenznutzen pro Kosten (marginal-value-per-cost) geordnet ist (§2), **ist** das gierige, erschwingliche Präfix genau die Zuweisung, die dieses Modell für diese Ausgaben empfiehlt — ein kleiner und ein großer Beitragsleistender lesen jeweils eine konkrete, optimale Antwort aus demselben veröffentlichten Ranking ab, anstatt aus einer Liste, die implizit auf niemanden zugeschnitten ist. Die Stufen sind lediglich Zusammenfassungen: Die Zuweisung selbst ist einfach das Ranking, das der Reihe nach gegen Ihr eigenes Budget abgearbeitet wird. Serverseitige Aktualisierungen berechnen die Stufen über die verbleibenden Elemente mit demselben Durchlauf neu (der Generator und die Aktualisierungsfunktion implementieren dies als Zwillinge, die auf beiden Seiten getestet werden).

### 2.2 Lanes und Ranking-Modi — 2026-07-19

Die bereitgestellte Warteschlange deklariert in ihren eigenen Metadaten, welche **Lane** sie führt und welcher **Ranking-Modus** sie geordnet hat. Die Metadaten sind maßgeblich; dieser Abschnitt definiert das Vokabular.

**Lanes** (`metadata.lane`, `metadata.lane_policy`). Seit dem 2026-08-27 führt die öffentliche Warteschlange die **both**-Lane: LLM-Elemente (Modell × Prompting-Bedingung) **und** MT-Service-Elemente (Bedingung `engine` — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde; jedes reiht sich nur für Paare innerhalb seiner eigenen veröffentlichten Abdeckungsliste ein). Die **llm**-Lane vom 2026-07-19 — nur LLM-Elemente, beschränkt auf Paare, bei denen mindestens eine Seite außerhalb der veröffentlichten Abdeckung jedes MT-Services liegt — reservierte das Service-Benchmarking für von Organisatoren durchgeführte Kampagnen, die nie stattfanden, was den Großteil des Katalogs parkte; die Messung der Services *ist* das Rückgrat der Abdeckungskarte, daher befinden sich nun beide Arten von Arbeit auf einem Board. Die Abdeckungsvereinigung (über die Sprachkarten als Makrosprache aliasiert) wird weiterhin als `service_coverage_methods` und `service_covered_languages` ausgegeben, und eine llm-Lane-Warteschlange meldet ihre ausgeschlossenen Paare weiterhin als `pairs_dropped_fully_covered`.

**Blob-Größenlimit** (2026-08-27). Die bereitgestellte `queue.json` ist eine statische Datei mit einer harten Hosting-Obergrenze. Wenn das vollständige Ranking diese überschreitet, enthält die Datei daher den **obersten Teil** (Top Slice) des Rankings und weist in `metadata.blob_truncated {kept, total}` darauf hin — niemals eine stille Kappung. Die Datenbank-Warteschlange (`queue_top()` / `queue_pairs()`) stellt immer das **vollständige** Ranking bereit und ist die maßgebliche Arbeitsliste; die Paar-Aggregation und die Budgetstufen der Vorschau beschreiben das Artefakt, mit dem sie ausgeliefert werden.

**Sprachidentitäts-Gate** (2026-07-19). Warteschlangen-Elemente zielen nur auf **aktive individuelle ISO 639-3-Codes** ab — eine Bewertung gegen eine Makrosprache ("Arabisch") oder einen kollektiven Familiencode ("Berbersprachen") wäre eine nicht falsifizierbare Behauptung über Varietäten, die nie evaluiert wurden (derselben Logik folgen FLORES-200/NLLB, indem sie Daten als `arb`/`quy`/`zsm` codieren). Upstream-Korpus-Labels werden *aufgelöst*, niemals blind befolgt oder verworfen: Skript-Tags werden mechanisch entfernt (ein `eng→cmn-Hans`-Korpus reiht sich für `eng→cmn` ein, das Skript wird als Element-Anzeigemetadaten `source_script`/ `target_script` beibehalten); sauber zurückgezogene Codes folgen ihrem offiziellen ISO-Nachfolger; und ein makro-gelabeltes Korpus reiht sich nur unter einer aufgezeichneten, zitierten **Varietäten-Auflösung** in seinem Registrierungseintrag ein (z. B. dokumentiert FLORES+ sein Quechua als `quy`). Korpora, die auf keinem der beiden Wege aufgelöst werden können, werden mit maschinenlesbaren Gründen ausgeschlossen, die in `metadata.doctrine_exclusions` veröffentlicht (Gesamtzahl, Zählungen pro Grund, Gründe pro Korpus) und im Desert-Ledger (`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`) gezählt werden — sichtbare Ausschlüsse, niemals stillschweigende Verwerfungen. Historische Ergebnisse auf Korpora mit Schirm-Labels behalten ihren eigenen, ehrlich benannten Mesh-Knoten (Knoten `scope`: `macrolanguage` / `collective` / `retired`) und werden niemals in eine Mitgliedsvarietät zusammengeführt. Die Auflösungseingaben werden alle veröffentlicht: Die `language_resolution`-Stempel pro Eintrag in der Registrierung enthalten die aufgelösten Codes, Geltungsbereiche und Pin-Zitate.

**Ranking-Modi** (`metadata.rank_mode`, beschrieben in `metadata.priority_model`). Zwei Reihenfolgen derselben Elemente:

- **ecv** — die gierige Expected-Chain-Value-Regel aus §2–§3: Mesh-Verbesserung pro geschätztem Dollar. Die Exploitation-Reihenfolge; richtig, wenn das Board dicht genug für Vorhersagen ist und ΔΦ ein Signal trägt.
- **map** (Map-Value v2) — die Erhebungsreihenfolge:
  `MapValue = novelty × uncertainty × promise × connectivity ×
  corpus-quality × contamination ÷ cost`, zusammengestellt durch einen exakten gierigen Trace. *Novelty* (Neuheit) ist ein positionaler First-Light-Credit, der abnimmt, wenn bereits platzierte Elemente dasselbe gerichtete Paar (1/(1+n)), dieselbe Zielsprache, Zielfamilie, Methode × Zielfamilien-Zelle und Ziel × Domänen-Zelle belegen (jeweils 1/√(1+n); Familien aus den Sprachkarten, Domänen aus der Taxonomie der Korpus-Registrierung — die frühe Abdeckung eines Ziels sollte sich über Register verteilen und nicht die erste gemessene Domäne wiederholen). *Uncertainty* (Unsicherheit) ist die Back-off-Tiefe der Vorhersage aus §3.1 (Paar 0,25 · Zielsprache 0,55 · Quellsprache 0,75 · global 1,0) × 1/(1+veröffentlichte Runs auf der Kante). *Promise* (Versprechen) ist die in §3.1 vorhergesagte Stärke mit einer Untergrenze von 0,25 — wahrscheinlich funktionierende Unbekannte führen, und die Kartierung einer wahrscheinlichen Wüste (Desert) hat immer noch Wert. *Connectivity* (Konnektivität) stuft Paare höher ein, die **das gemessene Netzwerk mit einer Sprache verbinden, die es noch nicht erreichen kann**: Ein Endpunkt ist *etabliert*, wenn er auf einer gemessenen Mesh-Kante (`mesh.json`, Status `measured`) oder innerhalb der veröffentlichten Abdeckungsliste eines beliebigen MT-Services liegt (Makrosprache aliasiert, dasselbe Aliasing wie beim Lane-Gate oben); **Brücken** (genau ein etablierter Endpunkt) und **Inseln** (keiner von beiden) erzielen beide eine Punktzahl von 1,0 — seit dem 2026-08-27 zählt die erste Messung einer unverbundenen Wüste voll (Inseln erzielten unter der Grow-out-of-the-Network-Dimensionierung vom 2026-07-19 0,5 Punkte, was den tiefsten Tail strukturell herabstufte) —, während die **innere** Verdichtung (beide etabliert) 0,5 Punkte erzielt: Die Stärkung zwischen bekannten Punkten ist die Aufgabe des ecv-Modus. Ein **Erstmessungs-Boost** (×2,0) multipliziert zusätzlich den Erhebungswert jedes Elements, dessen Quell- oder Zielsprache NULL veröffentlichte Messungen irgendwo aufweist — das neunte Prinzip, klar formuliert: **Die erste Messung einer Sprache hat Vorrang vor der Verfeinerung**. Der Unsicherheitsfaktor allein kann dies nicht ausdrücken (er bewertet ein ungemessenes Paar zwischen zwei gut gemessenen Sprachen identisch mit einer noch nie gemessenen Sprache); der Boost macht die erste Messung des Long Tails zu einem erklärten Ziel und nicht zu einem emergenten Zufall. Beide Faktoren nutzen `metadata.map_value_parameters` und gelten identisch innerhalb der Erhebungskomponente von edv (§2.3).

  Die andere Hälfte des neunten Prinzips lebt AUSSERHALB des Rankings: Keine Sortierung bestehender Elemente kann eine Sprache erreichen, für die überhaupt kein Korpus existiert (heute ca. 7.500 lebende Sprachen mit individuellem Code). Die **Korpus-Wunschliste** (`/corpus-wishlist.json`, neben der Warteschlange neu generiert) veröffentlicht diese Akquisitionsgrenze: jede lebende Sprache mit individuellem Code und ohne Korpus, geordnet nach ihrer besten zitierten Sprecherzahl — die Sprecherzahl als Machbarkeits-Proxy für eine Gemeinschaft, die tatsächlich ein Korpus aufbauen könnte —, wobei jede Zählung ihrer Quelle zugeordnet und niemals arbitriert wird.
  *Corpus-quality* (Korpusqualität) ist das intrinsische Zuverlässigkeitspotenzial des Korpus `f_size × f_rich` aus §1.5 — die Erhebung sollte auf Korpora landen, die Gewicht tragen können, sodass eine Einzelwort-Vokabularliste mit 62 Einträgen nicht mehr an erster Stelle steht, nur weil sie billig ist; eine fehlende Reichhaltigkeitsmessung bleibt neutral (das Fehlen einer Messung ist kein Beweis für Armut). Kosten- und Kontaminationsdisziplin sind identisch mit ecv. Das Frontier-Interleave und die Tie-Breaks (§2.1) gelten unverändert. Richtig für die Erhebungsphase: Es maximiert das, was die *Karte lernt* pro Dollar — erste Messungen über Paare, Sprachen, Familien, Methodenzellen und Domänen hinweg, die aus dem gemessenen Netzwerk herauswachsen, anstatt sich zu verstreuen —, um den bewussten Preis eines langsameren Wachstums der Mesh-Stärke.

> **Map-Value v2 (2026-07-19).** Zwei vom Gründer gesteuerte Ergänzungen zur Erhebungsreihenfolge: Paare, die *eine Brücke in das gemessene Netzwerk schlagen*, rangieren nun vor unverbundenen Proben und innerer Verdichtung, und die Korpusqualität (Größenuntergrenze × effektive Reichhaltigkeit, §1.5) plus die Domänenverteilung pro Ziel gewichten das Ranking — die Rechenleistung der Beitragsleistenden sollte etablierte Pfade mit neuen verbinden, auf Korpora, die gut genug sind, um das Gewicht zu halten. Die Lizenz bleibt ein **Gate, kein Gewicht**: Lizenzierungs- und Übertragungskanalregeln entscheiden darüber, was überhaupt in die Warteschlange aufgenommen werden darf (§2 und die `transmission_note` der Warteschlange); unter den zulässigen Korpora ist das Ranking lizenzblind, sodass eingeschränkte, aber angeheftete (pinned) Forschungsdatensätze — oft das einzige Korpus eines Paares — niemals systematisch ausgehungert werden. v1-Warteschlangen (nur Novelty × Uncertainty × Promise) bleiben über ihre eigenen Metadaten interpretierbar.

Die genauen Faktorwerte, die bei der Generierung verwendet werden, werden in `metadata.map_value_parameters` ausgeliefert; die Konnektivitäts- und Qualitätseingaben sind aus den veröffentlichten `mesh.json` (gemessene Kanten), der in den Metadaten ausgegebenen Service-Abdeckungsvereinigung und `registry.json` (Eintragszahlen + Reichhaltigkeit) ableitbar. Jedes Element behält zusätzlich die vollständigen ecv-v3-Diagnosefelder unabhängig vom Modus bei, sodass jede Reihenfolge aus denselben Artefakten neu abgeleitet werden kann.

### 2.3 Ranking-Modus `edv` — Expected Decision Value (2026-08-27)

*Status: implementiert, standardmäßig deaktiviert bis zum gemessenen Vergleich in §2.3.6. Der veröffentlichte Standard bleibt bis dahin `map`.*

Die Warteschlange kauft genau zwei Produkte: die **Fähigkeitskarte** (Capability Map: welche Methode worin gut ist, mit ehrlicher Unsicherheit) und das **Routing-Mesh** (gemessene Paare, die sich zu Routen verketten). `edv` bewertet jedes Kandidatenelement danach, wie sehr es beide voranbringt, als gewichtetes Portfolio:

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

mit den Standardwerten `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40`
(vom Gründer einstellbar; jede Generierung gibt die tatsächlich verwendeten Gewichte in `metadata.edv_parameters` aus). Der Kontaminationsfaktor (§2.1 Abhilfe 1) wird genau einmal als äußerer Multiplikator angewendet. Lizenzierung und Übertragung bleiben **Gates, keine Gewichte** — die Zulässigkeit wird entschieden, bevor ein Wert berechnet wird, und das Ranking ist unter den zulässigen Korpora lizenzblind.

#### 2.3.1 Ĵ — Method-Judgment-Wert

Bewertet, wie sehr der Run die **Klärung von Methodenvergleichen auf demselben Korpus** voranbringt — die einzige methodenübergreifende Behauptung, die die eigene Messforschung dieses Projekts zulässt. (Die W2-Schwierigkeitstransfer-Studie lehnte die sprachübergreifende Verknüpfung von Fähigkeiten ab; ihr zugelassenes positives Ergebnis — die innersprachliche additive Methode × Korpus-Anpassung — ist genau das, was diese Komponente verwendet. Scores werden nur zur Sortierung und Trennung verwendet und gemäß dem Kalibrierungspiloten niemals in Akzeptanzwahrscheinlichkeiten umgewandelt.)

Für einen Kandidaten (Korpus C, Methode M, Bedingung): Die **Kontrastpartner** sind die Methoden M′, die bereits einen veröffentlichten Run auf (C, selbe Bedingung) haben. Für jeden Partner, wobei `sep` die Score-Trennung in chrF-Punkten über gepoolte KI-Halbwertsbreiten (aufgezeichnete KIs; Proxy `50/√n`, wenn unveröffentlicht) ist, und `sep_pred` dasselbe, berechnet gegen den in §3.1 vorhergesagten Score:

| Kontraststatus von {M, M′} auf dem Paar | Credit |
|---|---|
| **unmet** (unerfüllt) — noch kein gemeinsames Korpus | `JUDGE_FIRST = 1.0` |
| **contested** (umstritten) — gemeinsame Korpora existieren, alle `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **decided** (entschieden) — einige `sep ≥ Z_DEC`, n_dec Korpora entscheiden es | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

jeweils multipliziert mit `w_top = 1/√(rank(M)·rank(M′))` — die Entscheidung über den ersten Platz gegen den zweiten ist mehr wert als die über den siebten gegen den achten. Das Methoden-Ranking pro Paar verwendet den zugelassenen additiven Methode × Korpus-Fit (Alternating Least Squares über beobachtete Zellen), wenn für das Paar ≥2 Methoden × ≥2 Korpora gemessen wurden, andernfalls den besten Score pro Methode; der Fit erfolgt **streng pro Paar, niemals sprachübergreifend gepoolt**. `Z_DEC = 1.96`.

Ein Kontrast zwischen angeleitet und naiv (coached-vs-naive) auf demselben (C, M) fügt `JUDGE_COND = 0.5 / (1 + n_cond)` hinzu. Die Kontraste eines Elements werden mit abnehmendem Ertrag summiert (`JUDGE_GAMMA = 0.7` pro zusätzlichem Kontrast, absteigend sortiert), plus einem **Seed-Term**
`JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality` (m_C = andere
Lineup-Methoden mit einem Warteschlangen-Element auf C), sodass ein leeres Board immer noch Korpora bevorzugt, bei denen zukünftige Vergleiche beurteilt werden können — Venue-Wert, niemals ein geliehener Score. Während der Zusammenstellung nimmt die Judge-Komponente um
`1/(1 + items already placed on the same pair and condition lane)` ab.

#### 2.3.2 M̂ und Ŝ

`M̂` ist der erwartete Mesh-Gewinn (ΔΦ) aus §3, unverändert, wobei die Kettenmatrix zum Zeitpunkt der Generierung eingefroren wird. `Ŝ` ist der Map-Value v2-Kern aus §2.2 —
`uncertainty × promise × connectivity × corpus-quality` mit dem
positionalen Novelty-Decay — unverändert. Das *Niveau* des vorhergesagten Scores (Promise) existiert nur in Ŝ; Ĵ verwendet nur Score-*Trennungen* — die beiden Komponenten können denselben Optimismus nicht doppelt zählen.

#### 2.3.3 Normalisierung

Die drei Komponenten existieren auf inkommensurablen Skalen, daher wird jede statische Komponente durch ihr 95. Perzentil über das Kandidatenset geteilt (gedeckelt bei `EDV_NORM_CAP = 4.0`); die drei Normalisierer werden in
`metadata.edv_parameters.normalizers` ausgeliefert, wodurch jeder veröffentlichte EDV-Wert aus seinen eigenen Artefakten neu abgeleitet werden kann.

#### 2.3.4 Zusammenstellung

Die Reihenfolge ist genau derselbe Lazy-Greedy-Trace wie im Map-Modus: Jeder reihenfolgeabhängige Multiplikator (Survey-Novelty, Judge-Placement-Decay) ist monoton nicht-steigend, während Elemente platziert werden, sodass ein veralteter Heap-Eintrag nur überschätzen kann — die Lazy-Greedy-Invariante gilt und der Trace entspricht Brute-Force-Greedy. Frontier-Interleave, Preview-Richtlinie und Budgetstufen gelten unverändert.

#### 2.3.5 Erklärbarkeit

Jedes Element behält in seinen Diagnosedaten: die Kontrastliste, für die es angerechnet wurde (Partner, Status, vorhergesagte Trennung, Ranggewichtung), die Seed- und Decay-Terme, alle Felder aus §2.2 und §3, die Gewichte und Normalisierer — der veröffentlichte EDV-Wert ist aus der Zeile exakt neu berechenbar. Die Frage "Wie hat dieses Element diesen Rang erhalten?" ist ohne externen Status beantwortbar.

#### 2.3.6 Adoptionskriterium

`edv` wird erst nach einem gemessenen Vergleich gegen `map` und `ecv` auf demselben Board zum veröffentlichten Standard: innerhalb von 10 % von Map bei jeder Erhebungsmetrik (First-Light-Tiefenperzentile, verschiedene Paare/Sprachen/Familien in der Tiefe, marginale Rate neuer Paare), strikt besser bei beiden Judge-Metriken (gelöste umstrittene Kontraste pro simulierten 1.000 $; Wiederherstellung des Methoden-Rankings bei festen Ausgaben) und Mesh-Wachstum pro Dollar nicht schlechter als Map. Der Vergleichsbericht wird zusammen mit der Umstellung veröffentlicht.

## 3. Der Wert eines Laufs

### 3.1 Vorhersage des Werts vor der Ausführung

Der erwartete Wert eines nicht ausgeführten (Paar, Modell,
Bedingung) ist eine bewusst einfache, vollständig prüfbare Summe — eine
zweiseitige Vorhersage der Haupteffekte plus strukturierter Optimismus,
wobei jeder Term am Element veröffentlicht wird:

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — hierarchischer Rückfall über veröffentlichte
  Stärken: Mittelwert auf diesem Paar → Mittelwert auf dieser
  Zielsprache → Mittelwert auf dieser Quellsprache → globaler
  Mittelwert → `S0_FALLBACK`. Die verwendete Ebene wird als
  `prior_basis` veröffentlicht.
- **`model_offset`** — wie dieses Modell im Verhältnis zu den *anderen*
  Modellen auf demselben Paar abschneidet, gemittelt über alle Paare,
  bei denen ein Vergleich existiert. Null für nie gesehene Modelle.
- **`condition_offset`** — das beobachtete Delta gecoacht-minus-naiv auf
  demselben Paar (mit Rückfall auf dieselbe Zielsprache) und **andernfalls
  null**: Coaching-Gewinne sind dort real, wo sie gemessen werden, aber
  es wird nicht angenommen, dass sie sich über Sprachen hinweg
  übertragen, sodass auf nicht belegten Paaren die
  Basislinie-zuerst-Konvention gilt.
- **`exploration_bonus`** — Optimismus angesichts der Unsicherheit, mit dem
  UCB1-Schema (Auer, Cesa-Bianchi & Fischer 2002):
  `κ·sqrt(2·ln(1+N)/(1+n))`, wobei N die Gesamtzahl der veröffentlichten
  bewerteten Läufe und n die Anzahl auf diesem (Paar, Modell) ist. Nie
  ausprobierte Zellen erhalten den größten Bonus; gut gemessene Zellen
  klingen gegen null ab. Wir borgen das Schema — die Form, die
  untererkundete Arme im richtigen Tempo wieder auftauchen lässt —
  nicht das Bedauerns-Theorem, das einen stationären Banditen
  voraussetzt, was dieses System nicht ist.

### 3.2 Der Netzgewinn in geschlossener Form

Ein Lauf kann das Netz nur verbessern, indem er die Kante seines Paars
auf `s' = max(s(e), ŝ)` anhebt. Bei einer Einzelkantenänderung ignoriert die
neue beste Kette zwischen zwei beliebigen Sprachen entweder die neue
Kante oder verwendet sie genau einmal, sodass die aktualisierte Matrix —
und damit ΔΦ — eine exakte einzeilige Form hat (ohne den gesamten
Graphen neu zu lösen):

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

E ist „die beste Kette zum Endpunkt der neuen Kante, wobei der
Knotenpunkt zum Anspleißen bezahlt wird“; die beiden Terme sind die
beiden Richtungen der Kantenüberquerung. Dies wird in der
Harness-Testreihe gegen eine Brute-Force-Neuberechnung von Φ getestet.

Eine Vorhersage, die die aktuelle Kantenstärke nicht übertreffen kann,
ergibt ΔΦ = 0: Die Formel gibt das Geld der Spender dafür aus, das
Unbekannte zu bestätigen, nicht das Demonstrierte erneut zu messen.
(Der Erkundungsbonus verhindert, dass schwache oder unterabgetastete
Zellen für immer ausgehungert werden.)

### 3.3 Was als Evidenz zählt vs. was in die Warteschlange darf

Zwei verschiedene Tore, bewusst asymmetrisch:

- **Evidenz** stammt aus *jedem* veröffentlichten, nicht
  disqualifizierten Lauf — einschließlich Läufen auf Korpora, die nicht
  öffentlich in die Warteschlange aufgenommen werden können (z. B.
  nicht-kommerziell lizenzierte Mengen). Eine veröffentlichte Messung
  eines Paars ist Wissen, unabhängig davon, ob man sie erneut ausführen
  könnte.
- **Aktionen** (Warteschlangenelemente) stammen nur aus offen
  ausführbaren Korpora: Entwicklungs-Split, Lizenz der CC-BY-Familie,
  von jedem abrufbar.

Sprachen, die nur über nicht in die Warteschlange aufnehmbare Korpora
erreichbar sind, sitzen dennoch im Graphen: Die Verbesserung von Kanten
*um sie herum* ändert ihre Kettenwerte, und die Formel berücksichtigt
das.

## 4. Parameter

| Parameter | Standardwert | Bedeutung und Begründung |
|---|---|---|
| `λ` (`lambda_junction_discount`) | **0.9** | Treueerhaltung pro Knotenpunkt einer *geschätzten* Kette. Kodiert „Direktmessung schlägt produktgleiche Verkettung“ (Utiyama & Isahara 2007; Wu & Wang 2007; Fan et al. 2021). Der ~10%-Abschlag ist eine Kalibrierungswahl, die überprüft wird, sobald sich gemessene Kettendreiecke ansammeln (§6). |
| `κ` (`kappa_exploration_scale`) | **0.05** | Skala des Erkundungsbonus, in Stärkeeinheiten. 0.05 ≡ 5 chrF++-Punkte — die Rauschuntergrenze, unterhalb derer Wertunterschiede auf Korpora mit unter 100 Einträgen nicht unterscheidbar sind ([Korpusdesign §6.3](/docs/network/specifications/corpus-design)). Der Optimismus ist auf die Auflösung des Instruments begrenzt. |
| `S_CAP` | **0.95** | Vorhersageobergrenze — keine geschätzte Kante darf eine nahezu perfekte Treue beanspruchen, die sie nicht demonstriert hat. |
| `S0_FALLBACK` | **0.5** | Paar-Prior als letztes Mittel, nur verwendet, wenn es überhaupt keine veröffentlichten Ergebnisse gibt (der beobachtete globale Mittelwert — ≈ 0.54 über die ersten 429 Läufe — wird bevorzugt, sobald irgendein Ergebnis existiert). |
| `COST_FLOOR` | **$0.01** | Untergrenze für den ECV-Nenner, sodass nahezu kostenlose Läufe keinen unbegrenzten Wert pro Dollar beanspruchen können. |
| `N_FULL` | **100** | Bewertete Einträge für volle Größenanrechnung (§1.5). |
| `L_HEALTHY` | **5.0** | Effektive Wörter für volle Reichhaltigkeitsanrechnung (§1.5). |
| `H_NOISE` | **±5 chrF** | KI-Halbbreite für volle Konfidenzanrechnung; fehlende KIs werden als 50/√n proxyiert (verankert bei ±5 bei n=100). |
| `RUNS_FULL` | **2** | Veröffentlichte Läufe für volle Replikationsanrechnung. |

**Versionierung.** Parameter- oder Formeländerungen erhöhen
`formula_version` (Metadaten) und die Versionszeile dieser Seite. Die
Warteschlange gibt stets die exakten verwendeten Werte unter
`metadata.priority_parameters` wieder, einschließlich des aktuellen Φ, sodass historische
Warteschlangen interpretierbar bleiben. Sensitivitätsläufe sind nur ein
Flag entfernt: `generate_sweep_queue.py --lam 0.8 --kappa 0.1`.

## 5. Durchgerechnetes Beispiel (Live-Werte, 2026-06-12)

Generierung gegen 424 bewertete Läufe, 59 gemessene Kanten, 60 Sprachen;
**Φ = 0.272**. Das oberste Element:

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

Lesen Sie es zurück: Färöisch ist nur über Dänisch mit dem Netz
verbunden, sodass eine gemessene eng→fao-Kante eine riesige Familie von
Ketten abkürzt (das große ΔΦ); das Modell wird auf einem solchen Paar im
Mittelfeld vorhergesagt (Prior + Offset), niemand hat diese Zelle je
ausprobiert (großer Bonus), und der Lauf kostet einen Cent. Nichts
anderes in der Warteschlange erkauft mehr Netz pro Dollar. Dieselbe
Arithmetik, mit jeder veröffentlichten Eingabe, erzeugt jeden anderen
Rang.

## 6. Bekannte Einschränkungen (und was sie beheben würde)

1. **chrF++ ist über Sprachen hinweg nicht vergleichbar.** Die
   Morphologie verschiebt die Skala; eine 0.5-Kante ins Baskische ist
   nicht dieselbe Leistung wie ins Niederländische. Abschwächung:
   Prioritäten werden von *Struktur* dominiert (Übergänge s = 0 →
   s > 0), bei denen Skaleneffekte zweiter Ordnung sind. Behebung:
   Normalisierung der Werte pro Sprache oder Metriken mit besserer
   sprachübergreifender Kalibrierung, sobald sie für diese Sprachen
   verfügbar werden.
2. **Das Produkt-λ-Kettenmodell ist ein Prior, keine Messung.** Es
   wird durch die Pivot-Literatur richtungsmäßig gestützt, ist aber für
   die LLM-Übersetzung unkalibriert. Behebung (geplant): Das Netz
   enthält nun gemessene Dreiecke (z. B. deu→fra direkt neben
   deu→eng→fra), sodass verkettete Ausgaben direkt bewertet und λ an
   Daten angepasst statt gewählt werden kann.
3. **Kontamination und Entwicklungs-Set-Status.** Kantenstärken erben
   jeden Vorbehalt öffentlicher Entwicklungs-Sets — behandeln Sie Φ als
   Planungssignal mit Obergrenze, niemals als Fähigkeitsaussage
   ([Korpusdesign](/docs/network/specifications/corpus-design)).
4. **Domänenblindheit.** Eine auf Konversationstext gemessene Kante wird
   als eine Zahl behandelt; Ketten, die Domänen überqueren, werden
   stärker degradieren, als λ vorhersagt.
5. **Direktionalität.** Kanten sind derzeit ungerichtet (X→Y-Evidenz
   beleuchtet X↔Y). Sobald die Kettenkomposition in der Praxis
   richtungssensitiv wird, teilen sich die Stärken nach Richtung — die
   Formel bleibt unverändert, der Graph verdoppelt sich lediglich.

## 7. Literaturverzeichnis

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
