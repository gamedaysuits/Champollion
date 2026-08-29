---
sidebar_position: 6
title: "Spezifikation zur Metrikzuverlässigkeit"
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

# Spezifikation der Metrik-Zuverlässigkeit

> **Zusammenfassung.** Ein Benchmark-Wert ist nur so aussagekräftig wie die
> Metrik, die dahintersteht — und automatische Metriken stimmen nicht in allen
> Sprachen gleichermaßen gut mit dem menschlichen Urteil überein. Dieses Dokument
> spezifiziert, wie Champollion die **Metrik-Zuverlässigkeit** misst: Für jede
> Sprachfamilie, wie stark jede automatische Metrik (BLEU, spBLEU, chrF, chrF++,
> COMET, MetricX) mit menschlichen Qualitätsurteilen korreliert, berechnet aus
> den Archiven der WMT-Metrics-Shared-Task (2019–2025). Das Ergebnis ist ein
> veröffentlichtes, maschinenlesbares Evidenzartefakt, das der Harness, die CLI
> und der MCP-Server konsultieren, bevor sie einen Wert als vertrauenswürdig
> darstellen. Nach unserem Kenntnisstand veröffentlicht keine andere
> Evaluationsinfrastruktur diese Evidenz je Sprache; sie ist es, die aus „wir
> haben eine Metrik ausgeführt" ein „so sehr ist ihr zu trauen" macht.
>
> **Geltungsbereich.** Dieses Dokument definiert, *was die Zuverlässigkeitsevidenz
> ist, woher sie stammt, wie genau sie berechnet wird und was sie bewusst
> ausschließt*. Die Metrikdefinitionen selbst finden sich in der
> [Scoring-Spezifikation](/docs/network/specifications/scoring); die statistische
> Prüfung von Score-Unterschieden findet sich unter
> [Signifikanz](/docs/network/specifications/significance). Der Importer, der das
> Artefakt neu erzeugt, ist `arena/scripts/import_wmt_metaeval.py` im
> Harness-Repository — der Code ist das letzte Wort in Sachen
> Implementierungsdetail und steht zur Überprüfung offen.

---

## 1. Das Problem, das dies löst

Die Qualität maschineller Übersetzung ist letztlich ein menschliches Urteil.
Automatische Metriken existieren, weil menschliche Evaluation langsam und teuer
ist; jeder automatische Wert ist ein *Stellvertreter* für das, was ein
kompetenter Zweisprachiger sagen würde. Das Kürzel des gesamten Fachgebiets —
„System A schlägt System B um 2 BLEU" — setzt stillschweigend voraus, dass der
Stellvertreter treu ist.

Diese Annahme wird seit Jahren von der WMT-Metrics-Shared-Task geprüft, aber
fast immer *im Aggregat*: Metriken werden nach der durchschnittlichen
Korrelation mit dem menschlichen Urteil über diejenigen Sprachpaare gerankt, die
die jeweilige Kampagne des Jahres abdeckte — überwiegend europäische Paare mit
hoher Ressourcenausstattung sowie Chinesisch und Japanisch. Das Detail je
Sprache existiert in den Rohdaten und in den jährlichen Findings-Papieren, aber
es wird nirgendwo als abfragbare Evidenzschicht je Sprachfamilie veröffentlicht,
die eine Evaluationspipeline konsultieren könnte.

Das Detail ist für Sprachen mit geringer Ressourcenausstattung und
morphologisch reiche Sprachen von enormer Bedeutung. Zwei Erkenntnisse aus
unserem eigenen Import verdeutlichen, was auf dem Spiel steht (§7 enthält die
vollständige Tabelle):

- **Englisch→Inuktitut (wmt20).** Die Korrelation von BLEU auf Systemebene mit
  dem menschlichen Urteil beträgt **+0,16** — im Wesentlichen nicht aussagekräftig.
  chrF erreicht +0,35. COMET erreicht +0,86. Ein nach BLEU gerangtes Leaderboard
  für dieses Paar würde Rauschen ranken; dasselbe nach COMET gerangte Leaderboard
  trägt Signal.
- **Englisch→Maasai (wmt25).** Das umgekehrte Versagen: Die Korrelation von
  MetricX-25 beträgt **−0,09** — eine hochmoderne *gelernte* Metrik, die eine in
  ihren Trainingsdaten fehlende Sprache bewertet, liefert Zahlen, die
  unkorreliert mit dem menschlichen Urteil sind, während das berechnete chrF++
  (eine „dumme" String-Metrik, der keine Trainingsdaten fehlen können) +0,50
  erreicht.

Keiner der beiden Fehlermodi ist in einem globalen Durchschnitt sichtbar, und
sie weisen in entgegengesetzte Richtungen: Für die eine Sprache ist die gelernte
Metrik die einzig brauchbare; für die andere ist sie die einzig *unbrauchbare*.
Jede Infrastruktur, die Hunderte von Sprachpaaren mit einer festen Metriksuite
bewertet — wie Champollion es tut — schuldet ihren Nutzern diese Evidenz.

## 2. Definitionen

Die folgenden Definitionen sind das Minimum, das nötig ist, um den Rest des
Dokuments präzise zu lesen. Mit MT-Evaluation vertraute Leser können zu §3
überspringen.

**Automatische Metrik.** Eine Funktion von (Systemausgabe, Referenzübersetzung
und manchmal der Quelle) auf eine Zahl. *String-Metriken* — BLEU, spBLEU, chrF,
chrF++ — vergleichen die Oberflächenüberschneidung zwischen Ausgabe und
Referenz. *Gelernte Metriken* — COMET, MetricX, BLEURT — sind neuronale Modelle,
die auf vergangenen menschlichen Urteilen trainiert wurden, um Qualität
vorherzusagen. Die kanonischen Bezeichner für alle Metriken in diesem Dokument
stammen aus Champollions Metrik-Registry
(`shared/metric-registry.json`): `bleu`, `spbleu`, `chrf_plain`,
`chrf_plus_plus`, `comet_score`, `metricx_score`.

**Protokolle für menschliche Urteile.** Die WMT-Kampagnen sammelten menschliche
Qualitätswerte unter mehreren Protokollen, die dieses Artefakt getrennt hält:

- **DA (Direct Assessment)** — Crowdworker oder Forscher bewerten eine
  Übersetzung von 0–100. *z-normalisiertes* DA (geschrieben `wmt-z`)
  standardisiert die Werte jedes Bewerters auf Mittelwert 0, Varianz 1 und
  entfernt so Effekte der Bewerter-Großzügigkeit.
- **DA+SQM** (`da-sqm`, `wmt`) — DA, gesammelt auf einer Skala von
  0–100, annotiert mit Ankerbeschreibungen der Scalar Quality Metric; verwendet
  ab WMT22.
- **MQM (Multidimensional Quality Metrics)** (`mqm`) — professionelle
  Annotatoren markieren und klassifizieren einzelne Fehlerbereiche mit
  Schweregraden; die gewichtete Fehleranzahl wird zu einem Segmentwert. Langsam,
  teuer und das vertrauenswürdigste verfügbare Signal; nur für einige wenige
  Paare mit hoher Ressourcenausstattung pro Jahr gesammelt (die Annotationen
  stammen aus Googles `wmt-mqm-human-evaluation`-Releases).
- **ESA (Error Span Annotation)** (`esa`, `esa-merged`) — das Protokoll
  von WMT24 und WMT25, das die Markierung von Fehlerbereichen mit einer skalaren
  Bewertung kombiniert; günstiger als MQM, aussagekräftiger als DA.

**Meta-Evaluation.** Die Evaluation der Evaluatoren: Messen, wie gut die Werte
jeder automatischen Metrik mit den menschlichen Werten über dieselben
Übersetzungen übereinstimmen. Die Übereinstimmung wird auf zwei Ebenen gemessen:

- **Systemebene** (`sys`): Jedes MT-System erhält einen aggregierten
  menschlichen Wert und einen aggregierten Metrikwert für einen Testsatz; die
  Übereinstimmung wird über die Systeme hinweg berechnet. Diese Ebene fragt:
  *Rankt die Metrik ganze Systeme so, wie es Menschen tun?* — die Frage, die ein
  Leaderboard interessiert.
- **Segmentebene** (`seg`): Übereinstimmung über einzelne (System,
  Satz)-Paare hinweg. Diese Ebene fragt: *Kann die Metrik einen guten Satz von
  einem schlechten unterscheiden?* — die Frage, die für Quality Estimation und
  Datenfilterung von Belang ist. Sie ist deutlich schwieriger, und die
  Korrelationen sind systematisch niedriger.

**Korrelationsstatistiken.** Vier Standardstatistiken, hier genau so definiert,
wie sie berechnet werden:

- **Pearsons r** — lineare Korrelation zwischen den beiden Wertvektoren.
- **Spearmans ρ** — Pearsons r, berechnet auf durchschnittlichen Rängen; misst
  monotone Übereinstimmung, unempfindlich gegenüber der Skala.
- **Kendalls τ-b** — unter allen Paaren von Elementen der (bindungsbereinigte)
  Überschuss konkordant geordneter Paare gegenüber diskordant geordneten. Wir
  verwenden die standardmäßige bindungsbereinigte τ-b-Formulierung (äquivalent zu
  `scipy.stats.kendalltau`; unsere Implementierung ist abhängigkeitsfrei und wird in der
  Testsuite gegen eine Brute-Force-Referenz gegengeprüft).
- **Paarweise Ranking-Genauigkeit** (nur Systemebene) — von allen Systempaaren,
  die Menschen *strikt* ordnen, der Anteil, den die Metrik gleich ordnet, wobei
  eine Metrik-Bindung als Versagen bei der Reproduktion der Ordnung gezählt wird.
  Dies ist die Genauigkeitsstatistik von Kocmi et al. (2021), die die jüngsten
  WMT-Kampagnen als ihre wichtigste Kennzahl auf Systemebene verwenden.

**Sprachfamilie.** Die genealogische Gruppierung der *Ziel*sprache (die Sprache,
in die übersetzt wird), wie in Champollions Sprachdatenbank verzeichnet
(`languages.family`, abgeleitet aus Glottolog). §5 erörtert, warum die Zielseite und
wofür eine Familie stehen kann und wofür nicht.

## 3. Daten

### 3.1 Quellen, festgesetzt

| Quelle | Was sie bereitstellt | Festsetzung |
|---|---|---|
| `google-research/mt-metrics-eval` (Datenarchiv v2) | Menschliche Werte, Metrikwerte, Systemausgaben, Quellen und Referenzen für jeden Testsatz der WMT-Metrics-Task, wmt19–wmt25 | Code-Commit `68a481ae…`; Daten-Tarball `mt-metrics-eval-v2.tgz` von `data.statmt.org`, festgesetzt **sha256 `6708eec9aaa8a9deca5e370bdd0e23db4881aeca129f29d5281575eaa66c7e10`**, ETag `36579a46-64ff8bb1d3080`, Last-Modified 2026-04-21, 911.710.790 Bytes |
| `google/wmt-mqm-human-evaluation` | Der vorgelagerte Ursprung der MQM-Expertenannotationen, die mt-metrics-eval in zusammengeführter Form weiterverteilt; Apache-2.0 | Commit `7fadea28…` |

Zwei Fakten zur Datenintegrität prägen die Festsetzungsdisziplin. Erstens ist
**der Daten-Tarball nicht unveränderlich** — er wird vor Ort neu veröffentlicht,
wenn Kampagnen hinzugefügt werden — sodass das Artefakt die Prüfsumme, den ETag
und den Zeitstempel genau der Kopie aufzeichnet, aus der die Zahlen berechnet
wurden, und der Importer die Ausführung ohne Prüfsumme verweigert. Zweitens
deckt die Apache-2.0-Lizenz des Toolkits dessen *Code* ab; **die gebündelten
Daten zu menschlichen Urteilen und Testsätzen tragen keine ausdrückliche
Lizenzerklärung**. Die Konsequenzen daraus finden sich in §8.

Der Archivinhalt (≈4,2 GB unkomprimiert: menschliche Urteile, Referenzen und
vollständige Systemausgaben für jede Kampagne) wird **niemals in diesem
Repository gespeichert oder von Champollion weiterverteilt**. Er wird aus der
Quelle in einen lokalen Cache abgerufen; nur abgeleitete Korrelationszahlen
werden veröffentlicht. Dies ist dieselbe Fetch-from-Source-Haltung, der jeder
Champollion-Benchmark folgt.

### 3.2 Was jede Kampagne beiträgt

| Testsatz | Paare mit menschlichen Urteilen | Hier verwendete(s) menschliche(s) Protokoll(e) |
|---|---|---|
| wmt19 | 18 | DA-z |
| wmt20 | 18 (inkl. en→iu, en→ta, km→en, ps→en) | DA-z; MQM (en→de, zh→en) |
| wmt21.news | 16 (inkl. en→ha, en→is) | DA-z; MQM (en→de, zh→en, en→ru) |
| wmt21.tedtalks | 3 | MQM |
| wmt21.flores | 4 (bn↔hi, xh↔zu) | DA-z |
| wmt22 | 17 (inkl. en→liv, sah→ru, cs↔uk) | DA-SQM; MQM (en→de, zh→en, en→ru) |
| wmt23 | 9 (inkl. he→en) | DA-SQM; MQM |
| wmt23.sent | 1 | MQM |
| wmt24 | 11 (inkl. en→is, en→hi) | ESA; MQM |
| wmt25 | 16 (inkl. en→bho, en→mas, en→ar) | ESA-merged; MQM |

**Ausgeschlossen: wmt24pp.** Das WMT24++-Release erweitert die Abdeckung auf 55
Sprachpaare, liefert aber *nur Referenzen und Systemausgaben* — keine
menschlichen Urteile — sodass daraus keine Korrelation berechnet werden kann. Es
ist im Ausschlussverzeichnis des Artefakts aufgeführt, statt stillschweigend
weggelassen zu werden.

## 4. Methode

Der Importer durchläuft jedes (Testsatz, Sprachpaar) und berechnet eine
**Zelle** je (Bahn menschlicher Urteile, Ebene, Metrik):

1. **Menschliche Bahnen ermitteln.** Alle verfügbaren Dateien mit menschlichen
   Werten für das Paar werden gegen eine explizite Positivliste (§4.1)
   abgeglichen. Dateien auf Bewerterebene, rohe Fehlerbereichsdateien sowie Werte
   auf Dokument-/Domänenebene liegen außerhalb des Geltungsbereichs.
2. **Menschliche „Systeme" ausschließen.** WMT-Wertdateien enthalten die
   Referenzübersetzungen selbst als bewertete Systeme (`refA`,
   `refb`, `HUMAN.0`…). Eine Metrik gegen ihre eigene Referenz zu
   korrelieren ist sinnlos, sodass jedes System, das dem Referenzsatz des Paares
   oder den Präfixen `ref`/`human`/`synthetic` entspricht,
   durchgängig ausgeschlossen wird.
3. **Ausrichten.** Systemebene: die Schnittmenge der Systeme, die sowohl einen
   menschlichen als auch einen Metrikwert halten (fehlende Werte werden
   verworfen, niemals auf null gezwungen). Segmentebene: jedes (System,
   Segment) mit beiden Werten, über die Systeme hinweg gepoolt ohne Gruppierung
   — dies ist die „keine Mittelung"-Abflachung von mt-metrics-eval. Ungleichmäßige
   Dateien (nicht übereinstimmende Segmentanzahlen) lassen die Zelle scheitern,
   statt näherungsweise auszurichten.
4. **Berechnen.** Pearson, Spearman und Kendall τ-b auf beiden Ebenen; paarweise
   Ranking-Genauigkeit auf Systemebene. Zellen mit weniger als 3 ausgerichteten
   Systemen (sys) oder weniger als 10 ausgerichteten Punkten über mindestens 2
   Systeme hinweg (seg) oder mit null Varianz auf einer der Seiten werden im
   Ausschlussverzeichnis als degeneriert aufgezeichnet (20 Zellen im aktuellen
   Build).
5. **Aggregieren.** Je Zielsprachfamilie, je Metrik, je Ebene: der n-gewichtete
   Mittelwert jeder Statistik über die *bevorzugten* Zellen (§4.1), wobei die
   beitragende Liste von (Testsatz, Paar) erhalten bleibt, sodass jedes Aggregat
   auf seine Eingaben zurückgeführt werden kann.

### 4.1 Präferenz der menschlichen Bahn

Wo ein Paar mehrere Bahnen menschlicher Urteile hat, werden alle berechnet, aber
genau eine wird als **bevorzugt** gekennzeichnet, und nur bevorzugte Zellen gehen
in die Familienaggregation ein — andernfalls würde ein Paar, das sowohl unter
MQM als auch DA beurteilt wurde, doppelt gezählt. Die Präferenzordnung richtet
sich nach der Signalqualität:

```
mqm > esa-merged > esa > da-sqm > wmt-z > wmt-appraise-z > wmt-appraise > wmt > wmt-raw
```

Experten-Fehlerannotation (MQM) rangiert über Fehlerbereichsprotokollen (ESA),
die über skalarem Direct Assessment rangieren; innerhalb von DA rangieren
z-normalisierte Bahnen über rohen. Die nicht bevorzugten Zellen verbleiben im
Artefakt für alle, die Protokolleffekte untersuchen möchten.

### 4.2 Metrik-Identität und -Versionierung

Gelernte Metriken ändern sich von Jahr zu Jahr (COMET-20, COMET-22,
MetricX-23/24/25 sind unterschiedliche Modelle), und sie als eine Metrik zu
behandeln würde genau die Unterscheidung verwischen, um deretwillen die
Meta-Evaluation existiert. Jede Zelle zeichnet daher den **wortgetreuen
vorgelagerten Wertnamen** (`COMET-22`, `MetricX-25-Ref`,
`metricx_xxl_MQM_2020`…) neben der kanonischen Registry-ID auf, und das Artefakt listet
auf, welche vorgelagerten Namen jede ID gespeist haben. Wo eine Kampagne eine
Metrik gegen mehrere Referenzen bewertete, wird auch der verwendete
Referenzstrom je Zelle aufgezeichnet.

Die Werte werden genau so verwendet, wie sie das Archiv verteilt (alle Bahnen
höher-ist-besser; MQM-Fehlerwerte und MetricX werden vorgelagert negiert
gespeichert). Es wird keine Vorzeichenumkehr oder Neuskalierung angewandt;
Korrelationen sind gegenüber der Skala invariant, und die
Orientierungskonvention wurde vor dem Import empirisch verifiziert.

### 4.3 Die berechnete chrF++-Bahn

chrF++ — die primäre String-Metrik des Harness — wurde nur bei der wmt20-Kampagne
eingereicht, sodass vorgelagerte Werte für ein Jahr existieren. Für jeden anderen
Testsatz berechnet der Importer chrF++ selbst (sacreBLEU, `word_order=2`) aus den
gecachten Systemausgaben gegen die aufgezeichnete Referenz. Diese Zellen sind
mit `computed: true` gekennzeichnet, und ihr vorgelagerter Name sagt es aus: Ein
von Champollion berechneter Wert wird niemals als WMT-Einreichung dargestellt.
Alle anderen Metrikzellen sind wortgetreue vorgelagerte Werte; das Einzige, was
Champollion ihnen hinzufügt, ist die Korrelationsarithmetik.

## 5. Designentscheidungen, Alternativen und Begründung

Dies sind die Entscheidungen, die ein Prüfer hinterfragen sollte. Jede führt
auf, was gewählt wurde, was nicht, und warum.

**Verschlüsselt nach Zielsprachfamilie.** *Gewählt:* Aggregieren nach der
Familie der Sprache, *in die* übersetzt wird. *Alternativen:* nur je Paar (keine
Aggregation); quellseitige oder paarweise Typologie; typologische
Merkmalsvektoren statt Genealogie. *Begründung:* Die Metrik-Zuverlässigkeit wird
davon dominiert, wie schwer die *Ausgabe*sprache zu bewerten ist —
morphologischer Reichtum bläht die Oberflächenabweichung für String-Metriken
auf, und die Knappheit an Trainingsdaten verschlechtert gelernte Metriken —
beides Eigenschaften des Ziels. Die Familie ist ein grober, aber allgemein
verfügbarer Schlüssel (jede Sprache in Champollions Datenbank hat einen);
typologische Merkmale wären feinkörniger, fehlen aber oder sind umstritten für
genau die Sprachen mit geringer Ressourcenausstattung, für die dies existiert.
Die Zellen je Paar bleiben vollständig erhalten, sodass feinere
Neuaggregationen (nach Genus, nach morphologischem Typ) aus dem Artefakt
aufgebaut werden können, ohne neu zu importieren.

**Abgeflachte Korrelation auf Segmentebene.** *Gewählt:* Kendall τ-b über den
gepoolten (System, Segment)-Vektor. *Alternativen:* elementgruppierte paarweise
Genauigkeit mit Bindungskalibrierung (das acc*-eq der jüngsten WMT-Findings); je
Segment gemittelte τ über die Segmente hinweg. *Begründung:* Die abgeflachte
Statistik ist die einfachste vertretbare Wahl, ist aus ihrer Definition heraus
exakt reproduzierbar ohne ein Bindungskalibrierungsverfahren und bewahrt die
sprachübergreifende Vergleichbarkeit, die dieses Artefakt benötigt. Sie ist
*nicht* die neueste WMT-Hauptstatistik, und §8 führt dies als Einschränkung auf,
statt Äquivalenz vorzutäuschen.

**Metrik-Bindungen zählen gegen die Metrik** bei der paarweisen Genauigkeit.
Eine Metrik, die zwei Systeme nicht trennen kann, die Menschen trennen, hat es
versäumt, die menschliche Ordnung zu reproduzieren; halbe Anrechnung zu geben
würde die Score-Quantisierung belohnen.

**Gewichtete Mittelwerte in der Aggregation.** Familienaggregate gewichten jede
Zelle nach ihrer Stichprobengröße (Systeme auf sys-Ebene, Punkte auf seg-Ebene),
sodass ein 17-System-MQM-Paar mehr zählt als ein 6-System-DA-Paar. Die
ungewichteten Werte je Zelle bleiben verfügbar.

**Schwellenwerte.** Zellen benötigen ≥3 ausgerichtete Systeme (eine Korrelation
über 2 Punkte ist bedeutungslos) oder ≥10 ausgerichtete Segmentpunkte über ≥2
Systeme. Dies sind Untergrenzen gegen degenerierte Arithmetik, keine
Signifikanzaussagen — §8.

**Wortgetreue-Vorgelagert-Disziplin.** Champollion berechnet nichts neu, was es
zitieren kann (außer der gekennzeichneten chrF++-Bahn), weil neu bewertete
gelernte Metriken eine Versions- und Umgebungsdrift einführen würden, die die
vorgelagerten Namen je Zelle gerade verhindern sollen. Der Kompromiss —
Abdeckungslücken, wo eine Kampagne eine Metrik nicht ausführte — ist als
fehlende Zellen sichtbar, statt überdeckt zu werden.

**Ehrlich scheiternde Ausschlüsse.** Alles Übersprungene (ein Testsatz ohne
menschliche Urteile, ein nicht auflösbarer Sprachcode, eine degenerierte Zelle)
wird mit einem Grund in ein Ausschlussverzeichnis geschrieben. Ein Leser des
Artefakts kann aufzählen, was *nicht* darin enthalten ist — die Eigenschaft, die
den meisten aggregierten Berichten fehlt.

## 6. Das veröffentlichte Artefakt

Die Evidenz wird als eine maschinenlesbare JSON-Datei ausgeliefert, im Monorepo
verfolgt (bewusst nicht in die npm-/PyPI-Pakete gebündelt):

```
shared/catalogue/metric-reliability.json    # the artifact (≈0.6 MB)
shared/schemas/metric-reliability.schema.json  # its JSON-Schema contract
```

Aktueller Build: **1.810 Zellen** (1.052 bevorzugt) über **57 Sprachpaare**, **10
Testsätze**, **11 Zielfamilien**, mit 21 Verzeichnisausschlüssen. Blöcke der
obersten Ebene: festgesetzte `sources` und `provenance` (jeder
abgeleitete Wert trägt `champollion-derived`-Provenienz, die die Vorgelagerten benennt
— die Korrelationen sind unsere, die Urteile nicht); `correlation_definitions` (die exakten
Statistikdefinitionen aus §2); `metrics` (Registry-ID ↔ vorgelagerte
Namen); `languages` (Code → Familie/Genus); `families` (die
Aggregation); `cells` (jede Korrelation, vollständig attribuiert);
`excluded` (das Verzeichnis).

Drei Konsumentenoberflächen lesen es heute:

- **Harness-CLI:** `mt-eval recommend SRC TGT` rendert einen Block „Metrik-Vertrauen für das
  Ziel" neben der Methodenverfügbarkeit und zitierten Ergebnissen.
- **Champollion-CLI:** `champollion recommend SRC TGT` (derselbe Nutzlast-Vertrag; das Artefakt
  ist monorepo-verfolgt, sodass gepackte Installationen zu einem expliziten
  Hinweis „Index nicht verfügbar" degradieren).
- **MCP-Server:** Das `get_metric_reliability`-Tool beantwortet „welcher Metrik sollte ich
  für Sprache X vertrauen?" für jeden verbundenen KI-Agenten, einschließlich
  einer expliziten UNMEASURED-Antwort für Sprachen, die keine WMT-Kampagne
  beurteilt hat.

## 7. Ergebnisübersicht

Pearson-Korrelation auf Systemebene mit der bevorzugten menschlichen Bahn,
gewichteter Mittelwert je Zielfamilie (aktueller Build; Zahlen auf Segmentebene,
Spearman, τ-b und paarweise Genauigkeit sind im Artefakt):

| Zielfamilie | Paare | BLEU | spBLEU | chrF | chrF++ | COMET | MetricX |
|---|---|---|---|---|---|---|---|
| Afroasiatisch | 2 | +0,88 | +0,95 | +0,85 | +0,87 | +0,67 | **−0,62** |
| Dravidisch | 1 | +0,88 | — | +0,94 | +0,93 | +0,94 | — |
| Eskimo-Aleutisch | 1 | **+0,16** | — | +0,35 | +0,33 | **+0,86** | — |
| Indogermanisch | 42 | +0,75 | +0,76 | +0,79 | +0,76 | +0,81 | +0,84 |
| Japonisch | 1 | +0,52 | +0,89 | +0,93 | +0,84 | +0,73 | +0,74 |
| Koreanisch | 1 | +0,89 | +0,87 | +0,87 | +0,88 | +0,55 | +0,77 |
| Niger-Kongo | 2 | +0,94 | — | +1,00 | +1,00 | +1,00 | — |
| Nilotisch | 1 | — | — | — | +0,50 | — | **−0,09** |
| Sino-Tibetisch | 2 | +0,49 | +0,68 | +0,68 | +0,62 | +0,72 | +0,82 |
| Turksprachen | 1 | +0,85 | — | +0,97 | +0,97 | — | — |
| Uralisch | 3 | +0,85 | +0,88 | +0,91 | +0,91 | +0,75 | +0,81 |

Wie dies zu lesen ist — und wie nicht:

- **Das breite Muster stimmt mit den aggregierten Erkenntnissen des Fachgebiets
  überein.** Auf der 42-Paar-Masse Indogermanisch führen gelernte Metriken
  (MetricX +0,84, COMET +0,81), mit chrF dahinter und BLEU zuletzt — das
  standardmäßige WMT-Ergebnis, hier aus Rohdaten als Plausibilitätsanker
  reproduziert.
- **Die Abweichungen je Familie sind die Nutzlast.** Für das polysynthetische
  Inuktitut kollabieren die String-Metriken, und COMET ist das einzig brauchbare
  Signal. Für Maasai und für Englisch→Arabisch in wmt25 korreliert MetricX
  *negativ*, während die String-Metriken brauchbar bleiben — eine gelernte
  Metrik, die über ihre Trainingsverteilung hinaus extrapoliert, versagt
  stillschweigend, mit selbstsicher aussehenden Werten. Dies sind genau die
  Fälle, die ein globaler Durchschnitt auslöscht.
- **Einzelpaar-Familien sind Evidenz, keine Schlussfolgerungen.** Acht von elf
  Familien beruhen auf ein oder zwei Paaren aus einer einzigen Kampagne. Die
  ehrliche Lesart von „Eskimo-Aleutisch: BLEU +0,16" ist *„in der einen
  Kampagne, in der Menschen en→iu beurteilten, war BLEU nicht aussagekräftig"* —
  eine dokumentierte Messung, ein Warnsignal und ein Grund, mehr zu sammeln,
  kein Gesetz über die Familie.
- **Eine negative Zelle bedeutet nicht, dass die Metrik überall kaputt ist.**
  Sie bedeutet: Bei diesem Paar, in diesem Systempool der Kampagne, ordnete die
  Metrik Systeme gegen das menschliche Urteil. Bereichseinschränkung (siehe §8)
  kann jede Korrelation dämpfen, wenn Systeme in ihrer Qualität eng
  zusammenrücken.

## 8. Einschränkungen

Klar ausgesprochen, weil der Wert des Artefakts in seiner Ehrlichkeit liegt:

1. **Die Familie ist ein Stellvertreter, kein Mechanismus.** Die genealogische
   Familie korreliert mit den morphologischen Eigenschaften, die das
   Metrikverhalten treiben, bestimmt sie aber nicht. Die Zellen je Paar (mit je
   Sprache aufgezeichnetem Genus) ermöglichen ein feineres Zerlegen; der
   Familienschlüssel ist ein abfragbarer Standard, keine Behauptung
   typologischer Kausalität.
2. **Die Abdeckung ist das, was WMT beurteilt hat, nicht das, was die Welt
   spricht.** 57 Paare, stark europalastig; jedes xx→Englisch-Paar geht in
   Indogermanisch ein; ganze Makrofamilien (Algonkinisch, Austronesisch,
   Quechua, …) haben *überhaupt keine Abdeckung durch menschliche Urteile*. Für
   diese antworten Champollions Oberflächen UNMEASURED, statt die Zahl eines
   Nachbarn zu entlehnen. Champollions eigenes souveränes Benchmark-Programm —
   von der Gemeinschaft kontrollierte Testsätze mit Validierung durch
   Muttersprachler — ist die langfristige Lösung für genau diese Lücke.
3. **Der Transfer innerhalb einer Familie ist eine Annahme.** Wenn eine
   abgefragte Sprache nie direkt beurteilt wurde, stammt die Evidenz auf
   Familienebene von *anderen* Sprachen der Familie, und jede konsumierende
   Oberfläche sagt dies ausdrücklich.
4. **Noch keine Konfidenzintervalle.** Zellen tragen Stichprobengrößen, aber
   keine Bootstrap-Intervalle; insbesondere Einzelpaar-Familienaggregate sollten
   mit den Breiten gelesen werden, die §7 impliziert. Das Hinzufügen von
   Bootstrap-KIs je Zelle (der Harness hat bereits die Maschinerie für Score-KIs)
   ist geplante Arbeit.
5. **Bereichseinschränkung.** Korrelationen werden über die eingereichten Systeme
   jeder Kampagne berechnet. Jüngste Kampagnen gruppieren viele starke Systeme
   eng zusammen, was die Korrelationen für alle Metriken dämpft — Teil des
   Grundes, warum aus wmt25 abgeleitete Zellen (Maasai, Arabisch) extreme Werte
   zeigen. Die Testsatz-Attribution auf jeder Zelle hält dies überprüfbar.
6. **Wahl der Statistik auf Segmentebene.** Das abgeflachte τ-b ist einfach und
   reproduzierbar, ist aber nicht die bindungskalibrierte gruppierte Genauigkeit
   der jüngsten WMT-Findings-Papiere; die Zahlen hier sollten nicht ziffernweise
   gegen jene Veröffentlichungen verglichen werden.
7. **Datenlizenz.** Die vorgelagerten Daten zu menschlichen Urteilen tragen keine
   ausdrückliche Lizenzerklärung (§3.1). Champollion verteilt nichts davon
   weiter, veröffentlicht nur abgeleitete Statistiken mit vollständiger
   Attribution und hält dieses Artefakt in einer **nichtkommerziellen
   Evidenzbahn** (`license_lane.commercial_ok: false`), bis die Haltung geklärt ist. Die MQM-Bahnen
   führen zusätzlich zu Googles Apache-2.0-Annotationsreleases zurück.
8. **Das Archiv ist ein bewegliches Ziel.** Neue Kampagnen werden derselben
   Tarball-URL hinzugefügt. Die Festsetzungen identifizieren unseren Snapshot
   exakt; die Neuerzeugung gegen einen neueren Snapshot ist eine neue
   Artefaktversion mit neuen Festsetzungen, niemals eine stillschweigende
   Aktualisierung.

## 9. Reproduktion

Das Artefakt ist von jedem aus der Quelle neu erzeugbar:

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

Beachten Sie, dass die README des Archivs selbst auf eine stillgelegte
storage.googleapis.com-URL verweist; `data.statmt.org` ist der Live-Host. Der
Importer ist reine Python-Standardbibliothek (sacreBLEU nur für die berechnete
chrF++-Bahn); seine Korrelationsimplementierungen werden gegen
Brute-Force-Referenzen in `arena/tests/test_wmt_metaeval.py` gegengeprüft, und der strukturelle
Vertrag des Artefakts wird durch sein JSON-Schema sowie Integritätstests in
beiden Laufzeitumgebungen durchgesetzt.

## 10. Danksagungen und Zitierung

Die hier zusammengefassten menschlichen Urteile sind das Werk der **Organisatoren
und Annotatoren der WMT-Metrics-Shared-Task** — darunter Markus Freitag, Nitika
Mathur, Tom Kocmi und viele Mitarbeiter über die Kampagnen von 2019–2025 hinweg —
und des **Google-MQM-Annotationsprogramms** (Freitag et al., *Experts, Errors,
and Context*, TACL 2021; `google/wmt-mqm-human-evaluation`). Das Archiv und Toolkit werden als
`google-research/mt-metrics-eval` gepflegt. Die paarweise Ranking-Genauigkeit folgt Kocmi,
Federmann et al. (2021), *To Ship or Not to Ship*. Champollions Beitrag ist die
Organisation je Sprachfamilie, die Korrelationsberechnung und das
Ehrlichkeitsgerüst darum herum — jede Zahl im Artefakt trägt
`champollion-derived`-Provenienz, die die Vorgelagerte benennt, aus der sie abgeleitet
ist, und keiner ihrer Texte, Urteile oder Werte wird weiterverteilt.

Beim Zitieren von Zuverlässigkeitszahlen aus diesem Artefakt zitieren Sie sowohl
die WMT-Kampagne(n), denen die Zellen zugeordnet sind, als auch Champollions
Artefaktversion (der `sources`-Block trägt die exakten Daten-Festsetzungen),
und respektieren Sie die in §8 beschriebene nichtkommerzielle Evidenzbahn.
