---
sidebar_position: 0
title: "Sie möchten also Ihr eigenes Modell trainieren"
description: "Eine agentengestützte End-to-End-Anleitung zum Trainieren eines Übersetzungsmodells für ressourcenarme Sprachen mit nmt-forge – Sie steuern einen Coding-Agenten, während die Schutzmechanismen Anfängerfehler automatisch abfangen."
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Sie möchten also Ihr eigenes Modell trainieren

Dies ist eine vollständige Anleitung zum Trainieren eines maschinellen Übersetzungsmodells für eine
ressourcenarme Sprache — von „Ich spreche diese Sprache, und es gibt kaum Daten"
bis zu einem Modell, das Sie ehrlich berichten und beim [Network](/docs/network/) einreichen können.
Sie ist für Einsteiger geschrieben und setzt die moderne Arbeitsweise voraus:
**Sie steuern einen Coding-Agenten** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity oder Ähnliches), und der Agent führt die Werkzeuge aus.

Jeder Schritt unten hat also dieselbe Form:

- 🗣️ **Weisen Sie Ihren Agenten an** — worum Sie in einfacher Sprache bitten sollen.
- 🛠️ **Was das Werkzeug tut** — was [nmt-forge](/docs/network/getting-started/training-honestly)
  in Ihrem Auftrag ausführt und welches **Schutzgeländer** den klassischen Fehler abfängt,
  bevor er Sie etwas kosten kann.
- 👀 **Wie Sie das Ergebnis lesen** — wie „gut" aussieht und worüber Sie sich Sorgen machen sollten.

:::info[Zunächst das Vokabular]
Wenn Ihnen Begriffe wie *dev set*, *decoding*, *chrF++*, *leakage* oder *round-trip
verification* noch nicht in Fleisch und Blut übergegangen sind, lesen Sie zuerst
[**MT-Training in einfacher Sprache**](/docs/network/context/mt-training-concepts) —
dort wird jedes hier verwendete Wort mit einem durchgearbeiteten Beispiel definiert. Diese Seite
stützt sich auf alle davon.
:::

:::note[Ehrlichkeit ist das Feature, nicht die Reibung]
Das Werkzeug ist absichtlich eigensinnig. Seine Schutzgeländer mechanisieren echte, gemessene
Fehler, die ein echtes Projekt gemacht hat — sodass der ehrliche Weg die Voreinstellung ist und die
unehrlichen Abkürzungen **mit einer Meldung verweigern, die die Lösung benennt**. Wo Sie in dieser
Anleitung eine Verweigerung sehen, macht das Werkzeug nur seine Arbeit. Und das ist gut so.
:::

---

## Was Sie brauchen, bevor Sie beginnen

- **Einen Coding-Agenten** mit Terminal- und Dateisystemzugriff. Das ist der Steuermann.
- **Einige echte übersetzte Sätze** für Ihr Sprachenpaar — selbst ein paar
  hundert von Menschen erstellte Paare sind ein tragfähiger Anfang. Zweisprachige Lehrbücher,
  Gemeinschaftsarchive, übersetzte öffentliche Aufzeichnungen, Bildungsmaterial. Qualität vor
  Quantität.
- **Optional, aber wirkungsvoll:** einsprachiger Text in Ihrer Zielsprache, ein
  zweisprachiges Wörterbuch, eine veröffentlichte Referenzgrammatik und ein
  morphologischer Analysator (FST). Sie brauchen zum Beginnen **nicht** alle davon — das Werkzeug sagt
  Ihnen genau, welche vorhanden sind und welche welche Fähigkeiten freischalten.
- **Rechenleistung:** die Schutzgeländer, das Aufteilen, die Synthese, das Auditieren und das Bewerten laufen
  auf einem Laptop. Nur der eigentliche Modelltrainingsschritt verlangt nach einer GPU (und ein kleines
  Modell mit LoRA passt auf bescheidene Hardware).

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Installiere nmt-forge aus dem
> `forge/`-Paket des Champollion-Monorepos und bestätige, dass der `nmt-forge`-Befehl läuft. Wir werden
> ein Übersetzungsmodell Englisch → \<your language\> trainieren, und zwar ehrlich."*

Ihr Agent kann das `get_training_guardrails`-Werkzeug des Champollion-MCP-Servers aufrufen,
um das vollständige Regelwerk — die zehn Schutzgeländer und den Fehler, den jedes einzelne beseitigt —
in seinen eigenen Kontext zu laden, bevor er irgendwelche Befehle schreibt. Wenn Sie einen Agenten
steuern, bitten Sie ihn, dies zuerst zu tun.

---

## Schritt 1 — Wählen Sie eine Sprache und sehen Sie, was tatsächlich existiert

Jedes Projekt beginnt damit, den Index ehrlich zu fragen, was die Sprache *hat*.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Führe `nmt-forge discover` für den
> ISO-639-3-Code meiner Zielsprache aus und fasse zusammen, welche Daten existieren und was fehlt."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Was das Werkzeug tut.** Es liest die Champollion-**Karte** der Sprache — die
einzige Quelle der Wahrheit für das, was über diese Sprache bekannt ist — und berichtet über die
Schriften, morphologischen Analysatoren, Wörterbücher, Korpora und Evaluationsdatensätze, die es
erfasst, und ordnet die Sprache dann auf der **Asset-Leiter** ein:

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Wie Sie das Ergebnis lesen.** Die `✓`-Markierungen sind das, was Sie jetzt tun können; die `?`-
Markierungen sind Sprossen, die auf ein Asset warten. Entscheidend ist: **Abwesenheit auf einer Karte bedeutet
*unbekannt*, niemals „diese Sprache hat nichts".** Eine spärliche Karte ist eine Einladung,
das hinzuzufügen, was Sie wissen, keine Sackgasse — und selbst eine leere Karte verschafft Ihnen die vollständige
geschützte Trainingsschleife auf Sprosse 1. Eine reichhaltige Karte (wie bei Plains Cree) verdrahtet die oberen
Sprossen automatisch: Ihre Evaluationssätze kommen mit dem Vermerk **NIEMALS DARAUF TRAINIEREN** an, und
ihr sprachspezifischer Schiedsrichter ist einsatzbereit.

Erstellen Sie dann das Gerüst eines Projekts:

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Erstelle mit `nmt-forge init` ein Projektgerüst für dieses
> Sprachenpaar und lies mir die `NEXT_STEPS.md` vor, die dabei erzeugt wird."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ Dies erstellt einen Arbeitsbereich (ein `.forge/`-Verzeichnis, das jedes Schutzgeländer
konsultiert), eine **Startkonfiguration** und eine `NEXT_STEPS.md`-Kurzanleitung, geschrieben für *Sie
und Ihren Agenten* — die Befehlsreihenfolge, die Asset-Leiter für Ihre Sprache und
die nicht verhandelbaren Punkte. Sie ist die Landkarte für alles Folgende.

---

## Schritt 2 — Auf einen Analysator und ein Wörterbuch verweisen (falls Sie welche haben)

In diesem Schritt geht es um die **Sprossen 3–4** der Leiter. Wenn Ihre Sprache keinen
Analysator hat, springen Sie zu [Schritt 4](#step-4--split-your-real-data-safely) — Sie trainieren
dann allein auf echten (und rückübersetzten) Daten, was ein völlig legitimer Weg ist.

Wenn ein Analysator und ein Wörterbuch *doch* existieren, schalten sie die Fähigkeit frei,
verifizierte Trainingsdaten zu *fertigen* — der mit Abstand größte Hebel für eine Sprache
mit wenig parallelem Text.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Die Karte listet einen morphologischen Analysator und ein
> Wörterbuch für diese Sprache auf. Hole sie gemäß den Installationsanweisungen auf der
> Karte, richte das Language Pack über die dokumentierten Umgebungsvariablen darauf aus und
> bestätige, dass der Analysator bei einigen bekannten Wörtern round-trippt."*

🛠️ **Was das Werkzeug tut — und eine Grenze, die es nicht überschreitet.** Analysatoren (FSTs)
und Wörterbücher sind **separate, vom Nutzer beschaffte Werkzeuge unter ihren eigenen Lizenzen**.
Die Suite **bündelt oder verbreitet sie niemals** — sie verweist Sie darauf, woher sie
kommen und welche Lizenz sie haben, und Sie beschaffen sie. Das ist keine
Bürokratie: viele Sprachressourcen tragen echte Erlaubnis- und Souveränitätseinschränkungen,
und das Werkzeug respektiert sie von Grund auf.

Das Bindegewebe ist ein **Language Pack**: ein kleines Plugin, das *Ihren*
Analysator, Ihr Wörterbuch, Ihre Orthographieregeln und Ihre grammatik-belegten Satzvorlagen an die
Engine anpasst. Die Suite liefert **keine** Packs selbst mit — Packs leben bei ihren
Sprachen (das Plains-Cree-Pack etwa lebt in seinem eigenen Projekt und
klinkt sich per Modulpfad ein).

👀 **Wie Sie das Ergebnis lesen.** Sie wollen, dass der Analysator **round-trippt**: eine
Form buchstabieren, die Schreibweise zurückgeben, dieselben grammatischen Markierungen erhalten. Wenn das nicht klappt,
braucht der **Canonicalizer** des Packs — die eine Funktion, die die Schreibweise überall dort normalisiert, wo
zwei Komponenten aufeinandertreffen — wahrscheinlich eine Regel. Das richtig hinzubekommen ist wichtig: ein
einzelnes nicht abgeglichenes Zeichen (`ý` vs. `y`) hat einmal wochenlang stillschweigend 1.375 Verben
aus einer Generierungspipeline gelöscht. Das **Funnel-Audit** des Werkzeugs zählt
Überlebende in jeder Phase, genau damit ein solcher stiller Ausfall sich nicht verbergen kann.

---

## Schritt 3 — Trainingsdaten aus Grammatikregeln synthetisieren

Mit einem Analysator + Wörterbuch + einem Pack grammatik-belegter Vorlagen können Sie
Hunderttausende verifizierter Paare fertigen.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Generiere synthetische Trainingsdaten mit
> `nmt-forge synth` unter Verwendung unseres Language Packs und zeige mir dann den Abdeckungsbericht."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Was das Werkzeug tut — das Emit-Gesetz.** Jede Zeile, die die Ausgabe erreicht,
muss Regeln erfüllen, aus denen sich kein Pack ausklinken kann:

- **Round-trip-verifiziert** — jedes generierte Wort besteht *generieren → analysieren →
  gleiche Analyse*, andernfalls wird die Zeile verworfen. Keine unverifizierte Form wird jemals ausgegeben.
- **Grammatik-belegt** — jede Vorlagenart zitiert die veröffentlichte Grammatik, die sie
  transkribiert. Unbelegte Vorlagen existieren nicht; der Code verweigert deren Laden.
- **Abdeckungsgeprüft** — Vorlagen werden gegen eine Checkliste erforderlicher grammatischer
  Phänomene abgerechnet (Imperative, Fragen, Besitz, inverse
  Formen …). Wenn ein *erforderliches* Phänomen null Beispiele hat, schlägt der Build fehl. Das
  ist die Absicherung gegen die Falle „eine Million Sätze, alle in denselben paar
  Formen" — Volumen, das strukturelle Lücken verbirgt.
- **Herkunfts-gestempelt** — jede synthetische Zeile wird mit `synthetic: true` markiert.
  Dieser Stempel ist tragend: die Registry wird es **verweigern**, synthetische Zeilen
  als Testsatz zu registrieren. Tests bestehen ausschließlich aus echten Daten.

👀 **Wie Sie das Ergebnis lesen.** Achten Sie im Abdeckungsbericht auf **erforderliche Punkte mit
Null-Abdeckung** (ein Grammatikphänomen, das Ihre Vorlagen nie erzeugt haben) und auf die
**Artenverteilung** — wenn zwei Vorlagenformen dominieren, wird die Obergrenze des Samplers pro Art
(Standard 15 %) sie neu ausbalancieren, sodass kein einzelnes Muster zur Hälfte der
Erfahrung des Modells wird.

:::tip[Kein Analysator? Verwenden Sie stattdessen Rückübersetzung]
Wenn Sie nicht aus Regeln synthetisieren können, aber **einsprachigen** Text in der Zielsprache
haben, bitten Sie Ihren Agenten, die **Rückübersetzungs**-Spur auszuführen: `nmt-forge
backtranslate` übersetzt Ihren einsprachigen Text maschinell *ins* Englische und paart
jedes Ergebnis mit dem **echten** Zielsatz. Die Zielseite bleibt authentisch.
Das Werkzeug **auditiert zuerst den einsprachigen Text auf Leckagen** — denn dieser Text kann
insgeheim Ihre Evaluationsdaten *sein*. Siehe das
[Rückübersetzungs-Kochbuch](/docs/network/tutorials/back-translation).
:::

---

## Schritt 4 — Teilen Sie Ihre echten Daten sicher auf

Nehmen Sie nun Ihre **echten** Paare und teilen Sie sie in Train / Dev / Test auf. Hier
verbirgt sich der ergebniszerstörendste Fehler in der ressourcenarmen MT, und hier
verdient sich das Schutzgeländer seinen Lohn.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Teile das echte Korpus mit `nmt-forge split` in einen Test- und Dev-Satz auf,
> gruppendisjunkt, und registriere sie. Verwende einen festen Seed, damit
> es reproduzierbar ist."*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **Was das Werkzeug tut — das Split-Guard.** Es führt eine **gruppendisjunkte
Aufteilung** durch: jedes Paar, das eine Quelle *oder* ein Ziel teilt, wird zu einer Gruppe
verbunden, und jede vollständige Gruppe landet gänzlich auf einer Seite. Dann **verifiziert es keine
Überschneidung** und verweigert die Fortsetzung, falls es welche gibt.

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Das beseitigt die **„Feed him" / „Feed her"-Leckage**: ein Lehrbuch bildet beide englischen
Übungen auf ein Zielwort ab (`asam`); eine naive zufällige Aufteilung setzt eine Kopie in Train
und ihren Zwilling in Test, sodass das Modell aus dem Gedächtnis „besteht". In einem echten Projekt sind 17
von 54 Testzeilen auf diese Weise durchgesickert und erzielten 83 gegenüber 44 bei sauberen Zeilen — und jede
Erkenntnis, die auf dieser Zahl aufbaute, war null und nichtig. `--register textbook` erfasst die Dev- und
Testsätze (als `textbook-dev` und `textbook-test`) im Arbeitsbereich, sodass jeder
spätere Befehl weiß, dass es sich um *Evaluationssätze handelt, auf denen Sie niemals trainieren dürfen*.

👀 **Wie Sie das Ergebnis lesen.** Sie wollen die Zeile **verified: 0 shared** sehen.
Wenn Sie stattdessen ein `SplitLeakageError` erhalten, löschen Sie keine Zeilen von Hand — das
mischt das Problem nur neu. Führen Sie die gruppendisjunkte Aufteilung erneut aus; das ist die Lösung, und die
Fehlermeldung sagt das.

:::danger[Trainieren Sie niemals auf einem Benchmark]
Wenn Sie einen Evaluationsdatensatz aus der geteilten Registry ziehen (`nmt-forge registry
add-harness`), stempelt das Werkzeug ihn und behandelt ihn als tabu für das Training —
**jeder** Registry-Benchmark ist als *nicht-trainieren* gekennzeichnet. Führen Sie ein Fine-Tuning auf allem durch,
was Sie legitim können; nur niemals auf dem Testsatz. Dies ist
[die eine Regel](/docs/network/leaderboard/rules) des gesamten Networks.
:::

---

## Schritt 5 — Trainieren

Eine Konfigurationsdatei beschreibt den gesamten Lauf; ein Befehl führt ihn
reproduzierbar aus.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Fülle die Trainingskonfiguration aus — richte `dev` auf unseren
> registrierten Dev-Satz aus, liste die Gold- und synthetischen Datenspuren auf, wähle ein kleines Basis-
> modell mit LoRA — führe dann `nmt-forge run` aus und beobachte die Zeitplan-Diagnostik."*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **Was das Werkzeug tut — vier Schutzgeländer auf einmal.**

- **Leckage-Audit vor dem Training.** *Jede* Spur — Gold, synthetisch und jeder
  rückübersetzte Text — wird gegen *jeden* registrierten Evaluationssatz geprüft. Exakte
  Treffer, Beinahe-Duplikat-Treffer (umformuliert) und Ganzdatei-Übereinstimmungen mit einem Testsatz sind
  fatal. Nichts wird trainiert, bis die Mischung sauber ist.
- **Dev-Zaun.** Das Training **weigert sich, ohne einen registrierten Dev-Satz zu starten**, und
  es wird Checkpoints immer nur auf diesem Dev-Satz auswählen — niemals auf dem Testsatz.
  (Es prüft sogar den Inhalt der Dev-Zeilen gegen die Testsätze, um den
  `cp test.jsonl dev.jsonl`-Trick zu erwischen.) Die Checkpoint-Auswahl kann den Dev-**Loss** oder
  eine Dev-**Generierungsmetrik** verwenden — den Dev-Satz decodieren und die echte Ausgabe bewerten,
  das ehrlichere Signal.
- **Zeitplan-Vernunft.** Wenn Ihre Mischung synthetiklastig ist, *leitet* das Werkzeug eine
  Stopp-Untergrenze aus der Größe Ihrer Mischung ab und hält das Training durch das
  **Plateau** — die Phase, in der das Modell das leichte synthetische Lernen abgeschlossen hat und noch
  nicht zu echter Qualität übergegangen ist. Das verhindert den
  „Halb-Epochen-Tod", bei dem naives Early Stopping bei einem Zwanzigstel des
  Plans aufhört. Jeder Eingriff druckt die Dev-Loss-Verlaufskurve und den Grund in
  einfacher Sprache.
- **Expositions-Mathematik + getaggte Synthetik.** Golddaten werden höher gewichtet (wiederholt),
  damit die wenigen echten Daten nicht ertrinken; das Manifest hält die **effektive
  Exposition pro einzigartigem Satz** fest, sodass ein A/B fair bleibt. Synthetische Quellen tragen ein
  Tag; Gold bleibt ungetaggt, damit es den Ausgabestil verankert.

👀 **Wie Sie das Ergebnis lesen.** Der Lauf druckt einen **Dev-Bericht mit Konfidenz-
intervallen** — es gibt keine bloße Score-Ausgabe:

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

Wenn Sie eine `schedule-sanity`-Meldung sehen, die erklärt, dass es das Training über einen
vorzeitigen Stopp hinaus *gehalten* hat, ist das der Plateau-Schutz bei der Arbeit — gut. Der Lauf schreibt außerdem
ein **Manifest**: Konfigurations-Hash, Datei-Hashes der Daten, Seeds und den abgeleiteten Zeitplan, sodass
der gesamte Lauf reproduzierbar ist.

---

## Schritt 6 — Ehrlich evaluieren

Sie haben ein Modell. Bevor Sie es auf dem Testsatz bewerten, schreiben Sie auf, was Sie
erwarten — *zuerst*.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Schreibe eine Präregistrierung für die Testsatz-Bewertung —
> unsere vorhergesagte Metrik, Richtung und Marge — decodiere dann den Testsatz und
> bewerte ihn."*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **Was das Werkzeug tut — die Anti-Geschichtenerzähl-Schutzgeländer.**

- **Präregistrierung.** Das Bewerten eines registrierten **Test**-Satzes erfordert eine
  Präregistrierung, die *vor* dem ersten Blick geschrieben wird. Ohne sie **weigert sich** die
  Vergleichstabelle schlicht zu rendern:

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  Dies ist die Absicherung dagegen, Nachhersagen („natürlich hat es sich bei mündlichen Geschichten
  verbessert") als Vorhersagen zu verkleiden. Das Aufschreiben der Vermutungen, die *scheitern*, ist es,
  was die erfolgreichen vertrauenswürdig macht.
- **Konfidenzintervalle, immer.** Jeder Score wird mit seinem 95%-Bootstrap-
  CI gerendert; es gibt keine Ausgabe ohne CI. Ein `+0.5`-Anstieg, dessen Intervalle sich überlappen, ist kein
  Gewinn.
- **Das Evaluations-Hauptbuch.** Jeder Lesevorgang jedes Evaluationssatzes wird protokolliert (nur anfügend,
  manipulationssicher). Fragen Sie `nmt-forge ledger show --set textbook-test`, wie „aufgebraucht" ein
  Satz ist. **Versiegelte** Sätze sind einmalig — einmal bewertet, dann geschlossen.

👀 **Wie Sie das Ergebnis lesen.** Lesen Sie die Zahl **mit ihrem Intervall und pro
Register** und prüfen Sie, **welcher Metrik zu glauben ist**, bevor Sie feiern:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` zeigt die **gemessene Zuverlässigkeit** jeder Metrik für Ihre
Sprachfamilie (aus den WMT-Meta-Evaluationen). Für manche Familien folgt eine Metrik wie
BLEU dem menschlichen Urteil kaum, während COMET es tut; für viele ressourcenarme
Familien lautet die ehrliche Antwort *ungemessen* — in diesem Fall ist das Urteil von
Muttersprachlern, nicht irgendeine automatische Zahl, das echte Signal. Siehe
[Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability).

:::tip[Der eigene Schiedsrichter Ihrer Sprache]
Wenn Ihre Sprache einen LYSS-Evaluationsstandard hat (einen Linter, der etwa weiß, dass sich zwei
Schreibweisen nur durch eine dokumentierte Langvokal-Konvention unterscheiden), binden Sie ihn mit
`--plugin` ein, und er bewertet neben chrF++ — und kann sogar Checkpoints *auswählen*,
sodass das Modell, das gewinnt, dasjenige ist, das der Schiedsrichter der Sprache selbst bevorzugt. Jede
Plugin-Zahl bekommt ebenfalls ein Konfidenzintervall.
:::

---

## Schritt 7 — Iterieren

Jetzt verbessern Sie — und jede Verbesserung wird auf dieselbe ehrliche Weise gemessen.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Ändere eine Sache — füge eine Vorlagenart / mehr
> rückübersetzte Daten / ein anderes Basismodell hinzu — trainiere neu und mache ein A/B gegen den
> vorherigen Lauf auf dem Dev-Satz, mit Signifikanz."*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
```

🛠️ **Was das Werkzeug tut.** `compare` führt einen **gepaarten Signifikanztest** durch, nicht
nur eine Subtraktion, sodass „B schlägt A" eine Behauptung ist, die die Statistik stützt — kein
Rauschen. Iterieren Sie auf dem **Dev**-Satz (dafür ist er da); behalten Sie den **Test**-Satz
für seltene, präregistrierte Prüfungen; behalten Sie jeden **versiegelten** Satz für das allerletzte Ende.

👀 **Wie Sie das Ergebnis lesen.** Eine echte Verbesserung überwindet ihr Konfidenzintervall
*und* den Signifikanztest. Wenn nicht, haben Sie trotzdem etwas gelernt — dieser Hebel ist schwächer als
Sie gehofft haben, was zu wissen sich lohnt. Die Plateau-/Abdeckungs-/Leckage-Schutzgeländer bedeuten,
dass die Zahlen, die Sie vergleichen, vertrauenswürdig sind, sodass Sie Ihrer eigenen Iterationsschleife
tatsächlich glauben können.

Häufige nächste Hebel, grob nach Ertrag geordnet für eine datenarme Sprache:

1. **Mehr Abdeckung** in der Synthese — fügen Sie die fehlenden Grammatikphänomene hinzu, die der
   Abdeckungsbericht markiert hat.
2. **Rückübersetzung** — verwandeln Sie einsprachigen Zieltext in mehr Trainingspaare.
3. **Ein größeres oder besser geeignetes Basismodell** oder LoRA-Rang-/Hyperparameter-Feineinstellung.
4. **Curriculum** — auf Synthetik vortrainieren, dann auf den echten Paaren feineinstellen.

---

## Schritt 8 — Bringen Sie es ins Network

Ein ehrlich trainiertes Modell ist genau das, was das [Champollion Network](/docs/network/)
zu empfangen gebaut ist.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Verpacke dieses Modell als Methode und reiche es beim
> Leaderboard für unser Sprachenpaar ein."*

- **[Eine Methode einreichen](/docs/network/getting-started/submit-a-method)** verwandelt
  Ihr Modell in einen Network-Eintrag, bewertet auf öffentlichen Referenzkorpora und
  Ihnen zugeschrieben.
- Weil Ihre Evaluation sauber war — gruppendisjunkt, dev-gezäunt, leckage-auditiert,
  mit CIs versehen, präregistriert — übersteht Ihre Einreichung die Prüfung, an der die meisten
  ressourcenarmen MT-Behauptungen scheitern. Die Anti-Manipulations-Architektur (geheime, gemeinschaftseigene
  Testsätze, Reproduzierbarkeitsprüfungen, Muttersprachler-Validierung) ist kein
  Hindernis für ein so gebautes Modell; sie ist ein Gütesiegel der Glaubwürdigkeit.
- Wenn ein **Preis** für Ihre Sprache offen ist, ist eine dauerhafte, besser-als-Baseline-
  Methode, die ehrlich gebaut wurde, genau das, was ein gesponserter Pool belohnt. Und wenn eine
  Methode für eine indigene Sprache funktioniert, **kann das Eigentum an die
  Gemeinschaft übergehen** — Sie bauen es hier und sie setzen es ein, zu ihren Bedingungen. Siehe die
  [Preis-Spezifikation](/docs/network/specifications/prizes) und den
  [Eigentumsübergang](/docs/network/sovereignty/ownership-transfer).

---

## Der gesamte Bogen, in einem Atemzug

1. **Entdecken** Sie, was die Sprache hat (`discover`, `init`) — Abwesenheit ist unbekannt, nicht null.
2. **Verweisen** Sie auf einen Analysator + ein Wörterbuch, falls sie existieren (Sprossen 3–4), unter Achtung ihrer Lizenzen.
3. **Synthetisieren** Sie verifizierte, belegte, abdeckungsgeprüfte Trainingsdaten (`synth`) — oder **rückübersetzen** Sie einsprachigen Text.
4. **Teilen** Sie echte Daten gruppendisjunkt auf und registrieren Sie die Evaluationssätze (`split`).
5. **Trainieren** Sie eine Konfiguration, dev-gezäunt, leckage-auditiert, plateau-bewusst (`run`).
6. **Evaluieren** Sie mit zuerst geschriebenen Vorhersagen, stets mit CIs, der richtigen Metrik (`prereg`, `score`).
7. **Iterieren** Sie mit signifikanzgeprüften A/Bs (`compare`).
8. **Reichen** Sie beim Network ein — wo ehrliche Arbeit der Sinn der Sache ist.

Sie mussten sich nie die zehn Arten merken, auf die ressourcenarme MT-Ergebnisse schiefgehen. Das
Werkzeug hat den ehrlichen Weg zur Voreinstellung gemacht und die Abkürzungen mit einer
Erklärung verweigert. Das ist die ganze Idee: **die Schutzgeländer fangen die Anfängerfehler ab,
sodass Sie sich auf die Sprache konzentrieren können.**

## Weiter geht's

- [**MT-Training in einfacher Sprache**](/docs/network/context/mt-training-concepts) — jeder Begriff hier, mit einem Beispiel definiert.
- [**Ein Modell ehrlich trainieren**](/docs/network/getting-started/training-honestly) — die zehn Schutzgeländer auf einer Seite, jedes mit seiner gemessenen Vorgeschichte.
- [**Feineingestelltes Modell**](/docs/network/tutorials/fine-tuned-model) und [**Rückübersetzung**](/docs/network/tutorials/back-translation) — tiefergehende Kochbücher zu bestimmten Techniken.
- [**Korpuserstellung**](/docs/network/tutorials/corpus-creation) — der Aufbau der echten Daten, auf denen alles andere ruht.
