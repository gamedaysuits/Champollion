---
sidebar_position: 7
title: "Verbindungsstärke (cchrF++)"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Verbindungsstärke

Wenn die Netzwerkkarte einen Bogen zwischen zwei Sprachen zeichnet, beantwortet
ihre Farbe eine Frage: **Wie gut ist die beste gemessene Übersetzung zwischen
ihnen — ehrlich betrachtet?**

Der ehrliche Teil ist schwieriger, als es klingt. Diese Seite erklärt in
einfacher Sprache die Zahl hinter der Farbe.

## Das Problem: Rohwerte sind bei null nicht gleich null

Die meisten unserer Werte sind **chrF++** (Character-n-Gram-F-Score, [Popović
2017](https://aclanthology.org/W17-4770/)) — dieser misst, wie stark sich die
Zeichen und Wörter einer Übersetzung mit einer Referenzübersetzung überschneiden,
auf einer Skala von 0 bis 100.

Aber *zufälliger Text ist nicht gleich null*. Jedes Schriftsystem liefert eine
gewisse Überschneidung „umsonst": Eine Orthografie mit wenigen unterschiedlichen
Zeichen oder langen, vorhersehbaren Wörtern erzielt messbar mehr als null, selbst
wenn die „Übersetzung" Unsinn ist. Diese kostenlose Überschneidung — der
**Zufallsboden** — unterscheidet sich je nach Sprache. In unseren Messungen reicht
sie von etwa 1,6 (chinesische Schrift) bis zu mehr als 13 (einige Sprachen mit
lateinischer und arabischer Schrift). Ein roher chrF++-Wert von 14 ist in einer
Sprache nahezu zufälliges Rauschen und in einer anderen ein echtes Signal — daher
ist roher chrF++ **nicht sprachübergreifend vergleichbar**, und eine danach
eingefärbte Karte würde manche Schriften stillschweigend begünstigen.

## Die Lösung: den Boden abziehen

**Zufallskorrigierter chrF++ (cchrF++)** skaliert den Wert so um, dass 0 „nicht
besser als der Zufall" *in dieser Sprache* bedeutet und 1 für perfekt steht:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Die Böden werden gemessen, nicht angenommen: Für jede Sprache führen wir eine
Monte-Carlo-Schätzung durch — Tausende zufällige Baselines mit derselben
Orthografie, gegen echte Referenzen bewertet — wobei ausschließlich öffentlich
verfügbarer einsprachiger Text verwendet wird (FLORES-200 dev, aus der Quelle
abgerufen, niemals weiterverbreitet). Die Bodentabelle umfasst derzeit 196 Sprachen
und ist ein von Champollion abgeleitetes Artefakt (`champollion-derived` Herkunft; neu
erzeugt durch `cli/website/scripts/build-cchrf-floors.mjs`).

Zwei konservative Regeln halten die Korrektur ehrlich:

- **Ein Paar wird nur korrigiert, wenn BEIDE Seiten einen gemessenen Boden
  haben.** Fehlt eine der beiden, wird der Bogen in neutralem Schiefergrau
  angezeigt — *gemessen, Boden unbekannt* — und erscheint niemals auf der
  Farbskala.
- **Das Paar verwendet den HÖHEREN der beiden Böden.** Die Korrektur kann die
  Stärke unterschätzen, aber niemals aufblähen.

## Wo cchrF++ in der Hierarchie steht

cchrF++ ist unser bestes *automatisches* Stärkemaß — es steht nicht an der Spitze
der Hierarchie. Von am vertrauenswürdigsten bis am wenigsten vertrauenswürdig:

1. **Menschliche Verifizierung** — fließende Sprecher beurteilen die Ausgabe
   ([Sprecher-Validierung](/docs/network/specifications/speaker-validation)).
   Nichts Automatisches übertrifft dies.
2. **MQM-artige Expertenannotation** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — das
   Protokoll, das WMT für seine Goldstandard-Bewertungen verwendet; teuer, selten,
   sehr gut.
3. **cchrF++** — zufallskorrigiert, sprachübergreifend vergleichbar, überall
   günstig zu berechnen.
4. **Roher chrF++ / BLEU / neuronale Metriken** — nützlich innerhalb eines
   Datensatzes; siehe [Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability),
   um zu erfahren, wie schlecht jede Metrik das menschliche Urteil bei Ihrem Paar
   nachbilden kann.

Sobald menschlich verifizierte und MQM-taugliche Ergebnisse in die Tafel eingehen,
haben sie für dasselbe Paar Vorrang vor automatischen Werten.

## Wie die Karte es darstellt

Jeder visuelle Kanal trägt genau eine Bedeutung:

| Kanal | Bedeutung |
|---------|---------|
| **Farbe** | cchrF++-Band — fünf Stufen, von Rot bis sanftem Grün: *nahe am Boden* (&lt; 0,15), *schwach* (0,15–0,35), *in Entwicklung* (0,35–0,55), *brauchbar* (0,55–0,75), *stark* (≥ 0,75) |
| **Neutrales Schiefergrau** | gemessen, aber der Zufallsboden ist für mindestens eine Seite unbekannt — niemals auf der Farbskala platziert |
| **Gestrichelt + gedimmt** | vorläufig: Das Testset liegt unter dem [Signifikanzboden](/docs/network/specifications/significance) (n &lt; 100), wo Wertunterschiede innerhalb von ~5 chrF++ Rauschen sind |
| **Breite** | wiederholt das Farbband (Redundanz zur Barrierefreiheit, keine zweite Variable) |

Nur **gemessene** Paare erscheinen auf der Stärkeskala. Registrierte Paare — die
für eine Messung eingereiht, aber noch nicht bewertet wurden — erscheinen als
blasse, einfarbige Haarlinien, deren Farbe nur besagt, *wie das Paar heute
erreichbar ist* (kommerzielle API · Open-Source-Modell · Frontier, kein Anbieter),
niemals aber, wie gut etwas übersetzt wird. Die beiden Vokabulare sind bewusst
getrennt: gedämpfte, einfarbige Fäden = Erreichbarkeit, die Rot→Grün-Skala =
gemessene Stärke. Der einem Bogen zugrunde liegende Wert ist der beste gemessene
Durchlauf für dieses Paar auf der öffentlichen Tafel, der automatisch
aktualisiert wird, sobald neue Durchläufe eintreffen.

## Das Kleingedruckte

- Böden sind Metrik-×-Orthografie-Eigenschaften, die ausschließlich aus
  einsprachigem Text geschätzt werden; kein Inhalt aus Parallelkorpora ist
  beteiligt oder wird gespeichert.
- cchrF++ sagt Ihnen, dass eine Übersetzung den Zufall übertrifft und um wie viel
  — es validiert **nicht** Bedeutung, Register oder kulturelle Passung. Diese
  bleiben menschliche Urteile ([ehrliche
  Einschränkungen](/docs/network/honest-limitations)).
- Die Methodik des Zufallsbodens ist Champollion-Forschung; der Bodenatlas und die
  Korrektur werden hier gerade deshalb veröffentlicht, damit sie überprüft und
  hinterfragt werden können.
