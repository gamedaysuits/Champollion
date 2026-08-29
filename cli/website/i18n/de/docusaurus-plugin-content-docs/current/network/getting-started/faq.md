---
sidebar_position: 2
title: "FAQ"
related:
  - label: "How It Works"
    to: /docs/network/how-it-works
    kind: doc
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Glossary"
    to: https://champollion.dev/glossary
    kind: glossary
    note: "Plain-language definitions for every technical term"
---

# Häufig gestellte Fragen

> **Zusammenfassung.** Antworten auf häufige Fragen zum Champollion Network — wie die Bewertung funktioniert, was zur Disqualifikation führt, wie mit Sprachen ohne FSTs umzugehen ist, Empfehlungen zu Modellen und Parametern sowie der Einreichungsprozess.

---

## Bewertung & Metriken

### Welche Metriken berechnet das Harness?

Das Harness berechnet fünf Metriken. Drei sind sprachunabhängig und funktionieren für jedes Sprachpaar; zwei stützen sich derzeit auf CRK-spezifische Plugins und werden verallgemeinert, sobald wir auf weitere Sprachen ausweiten. Die heute ausführbaren Referenzkorpora sind offen lizenzierte öffentliche Sammlungen — Global Voices, Tatoeba, TICO-19, IN22, SMOL und weitere (siehe [Datasets](/docs/network/leaderboard/datasets)) — und das Leaderboard steht für Einreichungen über jedes registrierte Sprachpaar offen. Plains Cree ist schlicht der Ort, an dem die beiden sprachspezifischen (FST-gestützten) Metriken zuerst implementiert wurden.

| Metrik | Skala | Was gemessen wird | Status |
|--------|-------|-----------------|--------|
| **chrF++** | 0–100 | Überlappung von Zeichen-n-Grammen zwischen vorhergesagten und Referenzübersetzungen. Beste Oberflächenmetrik für morphologisch reiche Sprachen. Verwendet die native Bewertung von sacrebleu. | ✅ Alle Sprachen |
| **Exact Match** | 0.0–1.0 | Anteil der Einträge, bei denen die Vorhersage nach Normalisierung exakt mit der Referenz übereinstimmt. | ✅ Alle Sprachen |
| **FST-Akzeptanz** | 0.0–1.0 | Anteil der Ausgabewörter, die von einem endlichen Zustandsübersetzer (morphologischer Analysator) akzeptiert werden. Wird nur berechnet, wenn ein FST-Binary bereitgestellt wird. | ✅ Alle Sprachen mit FST |
| **Equivalent Match** | 0.0–1.0 | Anteil der Einträge, die mit der Referenz oder einer akzeptablen Variante übereinstimmen — unter Berücksichtigung von Wortstellung, orthografischer Konvention und dialektalen Unterschieden. | ⚡ CRK (in Verallgemeinerung) |
| **Semantische Bewertung** | 0.0–1.0 | Bewertung der Bedeutungserhaltung — wie gut erfasst die Übersetzung die beabsichtigte Bedeutung unabhängig von der Oberflächenform? | ⚡ CRK (in Verallgemeinerung) |

Weitere Metriken sind geplant: **morphologische Genauigkeit**, **Code-Switching-Erkennung**, **Terminologietreue** und **Halluzinationserkennung**. Siehe [Bewertungsspezifikation §2](/docs/network/specifications/scoring#2-metric-inventory) für das vollständige Metrikinventar (sechs Kategorien).

### Wie wird die Gesamtbewertung berechnet?

Die Gesamtbewertung ist ein gewichteter Durchschnitt der verfügbaren Metriken, normalisiert auf eine Skala von 0.0–1.0. Gewichte sind in zwei Profilen definiert:

- **Profil A** (Sprachen mit FST): 9 Metriken, strukturelle Metriken (FST + morphologische Genauigkeit) machen 40 % der Gesamtgewichtung aus
- **Profil B** (Sprachen ohne FST): 8 Metriken, semantische Bewertung und chrF++ tragen gleiche Spitzengewichtung

Wenn eine Metrik nicht verfügbar ist, wird ihr Gewicht proportional auf die verbleibenden Metriken umverteilt. Das bedeutet, dass Benchmarks im Frühstadium (mit nur chrF++ und Exact Match verfügbar) dennoch gültige Gesamtbewertungen erzeugen — die effektiven Gewichte spiegeln lediglich wider, was verfügbar ist.

**Die vollständigen Gewichtungstabellen, Normalisierungsregeln und die Begründung für Ausschlüsse finden Sie in [Bewertungsspezifikation §4](/docs/network/specifications/scoring#4-composite-score).** Der Harness-Code spiegelt diese Tabellen in `mt_eval_harness/scoring.py` wider. chrF++ wird vor der Gewichtung durch 100 geteilt normalisiert; Code-Switching- und Halluzinationsraten werden invertiert (niedriger = besser).

### Was sind Qualitätsstufen?

Qualitätsstufen sind heuristische Bezeichnungen, die auf Bereiche der Gesamtbewertung abgebildet werden. Sie helfen zu vermitteln, was eine Bewertung praktisch *bedeutet*:

| Stufe | Bewertungsbereich | Interpretation |
|------|----------------|----------------|
| **Baseline** | 0.00 – 0.30 | Unterhalb brauchbarer Qualität. Methode bedarf erheblicher Verbesserung. |
| **Emerging** | 0.30 – 0.50 | Vielversprechend. Einige Übersetzungen sind korrekt, aber inkonsistent. |
| **Functional** | 0.50 – 0.70 | Als Referenz mit menschlicher Prüfung nutzbar. Nicht geeignet für ungeprüften Einsatz. |
| **Deployable** | 0.70 – 0.85 | Bereit für den Produktiveinsatz mit regelmäßiger Prüfung. Löst Berechtigung zur Eigentumsübertragung aus. |
| **Fluent** | 0.85 – 1.00 | Nahezu muttersprachliche Qualität. Geeignet für unbeaufsichtigten Einsatz. |

### Was ist der Unterschied zwischen Qualitätsstufen und Verifizierungsstufen?

**Qualitätsstufen** beschreiben, *was die automatisierte Bewertung bedeutet* (Baseline → Fluent). **Verifizierungsstufen** beschreiben, *wer das Ergebnis validiert hat*:

| Verifizierungsstufe | Bedeutung |
|-------------------|---------------|
| **Self-benchmarked** | Der Einreicher hat die Testumgebung selbst ausgeführt. Die Ergebnisse sind plausibel, aber unbestätigt. |
| **Champollion Verified** | Ein Maintainer hat das Ergebnis unter Verwendung der eingereichten Methodenkonfiguration reproduziert. |
| **Community Validated** | Zweisprachige Sprecher der Zielsprache, die nach dem eigenen Protokoll der Community qualifiziert sind, haben eine geschichtete Stichprobe der Ausgabe überprüft (≥30 Einträge, ≥2 Prüfer) und ≥70 % haben die Anforderungen der Community erfüllt. Wird nur durch die eigenen Tests der Community verliehen; eine Herabstufung durch Stichprobenprüfungen erfolgt symmetrisch und ebenso öffentlich. |

Eine Methode kann von der Qualität her „Deployable" sein, aber nur eine „Self-benchmarked"-Verifizierung aufweisen — das heißt, die Bewertung sieht hervorragend aus, aber niemand hat sie unabhängig bestätigt.

---

## Einreichung & Disqualifikation

### Was führt zur Disqualifikation meiner Einreichung?

Ihre Einreichung wird abgelehnt oder markiert, wenn:

1. **Ihre Methode Evaluierungsdaten ausgesetzt war.** Wenn Sie mit Einträgen aus dem Evaluierungsdatensatz trainiert, feingetunt, Few-Shot-Prompting durchgeführt oder diese anderweitig verwendet haben, sind Ihre Bewertungen künstlich überhöht. Dazu zählt auch die Verwendung der Referenzübersetzungen in Ihrem Prompt.
2. **Ihre Run Card die Integritätsprüfungen nicht besteht.** Der Fingerabdruck muss mit der Konfiguration übereinstimmen. Manipulierte Run Cards werden abgelehnt.
3. **Ihre Methode das TranslationMethod-Protokoll nicht implementiert.** Das Harness erwartet `translate(entries, config) → results`. Individuelle Integrationen, die das Harness umgehen, werden nicht akzeptiert.

### Kann ich mehrfach einreichen?

Ja. Das Leaderboard erfasst alle Einreichungen. Sie können iterieren — Dutzende Experimente durchführen und nur Ihr bestes einreichen. Jede Einreichung erfasst einen eindeutigen Fingerabdruck, sodass keine Unklarheit darüber besteht, welcher Lauf welche Bewertung erzeugt hat.

### Wie lasse ich meine Bewertung verifizieren?

1. **Self-benchmarked (automatisch):** Jede Einreichung beginnt hier.
2. **Champollion Verified (automatisch):** Der Server bewertet Ihre eingereichten Ausgaben erneut anhand des SHA-gepinnten Referenzkorpus mit der Metrik der Testumgebung. Wenn Ihr Ergebnis reproduziert wird, steigt der Durchlauf auf Champollion Verified auf — die einzige Stufe, die in der Rangliste gewertet wird. Wenn es nicht reproduziert wird oder eine gespeicherte Referenz geändert wurde, wird der Durchlauf disqualifiziert.
3. **Community Validated:** Zweisprachige Sprecher der Zielsprache, die nach dem eigenen Protokoll der Community qualifiziert sind, überprüfen eine geschichtete Stichprobe der Ausgabe Ihrer Methode — mindestens 30 Einträge, mindestens 2 Prüfer — und mindestens 70 % müssen die Anforderungen der Community erfüllen. Die Stufe wird nur durch Tests verliehen, die die Community nach eigenem Ermessen selbst durchführt, und kann auf dieselbe Weise entzogen werden: Eine fehlgeschlagene Stichprobenprüfung stuft die Methode ebenso öffentlich herab. Dies kann nicht automatisiert werden — es erfordert das Engagement der Community.

### Warum führen Sie nicht die Methode aller Teilnehmer erneut aus, um sie zu verifizieren?

Weil wir es uns nicht leisten können und es auch nicht müssen. Der Server bewertet die eingereichten Ausgaben *aller* Teilnehmer kostenlos neu (das deckt manuell eingegebene oder manipulierte Ergebnisse auf). Ein Modell tatsächlich erneut auszuführen, kostet reale Rechenleistung, daher tun wir dies bei einer **Stichprobe**, die durch **reputationsgewichtete Prüfung** ausgewählt wird: Ein Durchlauf wird immer erneut ausgeführt, wenn viel auf dem Spiel steht (er schlägt die erste Brücke zu einer ganzen Sprachfamilie) oder wenn er anomal ist (ein zu-schön-um-wahr-zu-sein-Sprung über den bisherigen Bestwert); bei bewährten Mitwirkenden wird er hingegen nur selten stichprobenartig geprüft. Reputation wird nur durch das Bestehen dieser Prüfungen erworben (oder indem ein unabhängiger Mitwirkender Ihr Ergebnis bestätigt) — niemals durch schiere Menge —, sodass neue Wegwerf-Identitäten keinen Vorteil erlangen. Eine aufgedeckte Fälschung setzt die Reputation eines Mitwirkenden auf null, führt zu einer erneuten Prüfung seiner gesamten verifizierten Historie und wird öffentlich dokumentiert, ähnlich wie ein Widerruf. Wir behaupten **nicht**, dass Ihr Durchlauf „die Testumgebung durchlaufen hat“ — bei selbst gehosteter Rechenleistung, die nicht serverseitig verifizierbar ist —, daher beruht die Gültigkeit auf *Reproduzierbarkeit + Reputationsrisiko + Bestätigung*, nicht auf reiner Bezeugung. Weitere Informationen zum vollständigen Modell finden Sie in den [MT-Evaluierungsregeln](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing).

### Ist die Einreichungs-API aktiv?

Noch nicht. Der `https://champollion.dev/api/leaderboard/submit`-Endpunkt ist eine Zielvorstellung. Der aktuelle Einreichungspfad ist `mt-eval publish` — er lädt eine Run Card aus dem Ausgabeverzeichnis des Harness (`eval/logs/harness/`) direkt als *self-benchmarked (unverified)* auf das Leaderboard hoch.

---

## Modelle & Parameter

### Welches Modell sollte ich verwenden?

Es gibt kein einzelnes bestes Modell — es hängt vom Sprachpaar, Ihrem Budget und Ihrem Ansatz ab. Allgemeine Richtlinien:

| Sprachtyp | Empfohlener Ausgangspunkt | Warum |
|---------------|---------------------------|-----|
| **Ressourcenreich** (Französisch, Spanisch, Japanisch) | `google/gemini-2.5-flash` oder `gpt-4o-mini` | Schnell, günstig, solide Baseline |
| **Ressourcenarm mit etwas LLM-Abdeckung** (Quechua, Yoruba) | `google/gemini-2.5-pro` oder `anthropic/claude-sonnet-4` | Größere Modelle verfügen über besseres latentes Wissen |
| **Polysynthetisch / sehr ressourcenarm** (Plains Cree, Inuktitut) | `google/gemini-2.5-pro` mit Coaching | Coaching-Daten sind wichtiger als die Modellwahl. OMT-1600 umfasst einige polysynthetische Sprachen (z. B. CRK auf R1-Stufe), jedoch mit Standard-BPE-Tokenisierung — benchmarken Sie es als Baseline im Network. |

Das Eval-Harness verwendet OpenRouter, sodass jedes auf OpenRouter verfügbare Modell als Benchmark getestet werden kann. Die verfügbare Liste finden Sie unter [openrouter.ai/models](https://openrouter.ai/models).

### Welche Temperatur sollte ich verwenden?

Niedriger ist für Übersetzungen im Allgemeinen besser:

| Temperatur | Wirkung | Empfohlen für |
|-------------|--------|-----------------|
| **0.0 – 0.2** | Hochgradig deterministische, konsistente Ausgabe | Produktionsmethoden, finale Benchmarks |
| **0.3 – 0.5** | Etwas Variation, gelegentlich kreativer | Erkundung, frühe Iteration |
| **0.6+** | Hohe Variation, unvorhersehbar | Nicht empfohlen für MT-Benchmarking |

Die Temperatur wird in der Run Card erfasst, sodass unterschiedliche Temperaturen unterschiedliche Fingerabdrücke erzeugen — sie werden als unterschiedliche Experimente behandelt.

### Helfen Coaching-Daten?

Ja, erheblich — bei ressourcenarmen Sprachen. Coaching-Daten (Grammatikregeln, Wörterbucheinträge, Stilhinweise) werden in den System-Prompt des LLM eingespeist. Für Plains Cree übertreffen gecoachte Methoden bei polysynthetischen Sprachen durchweg reine LLM-Methoden, da allgemeine LLMs nur begrenzt mit polysynthetischen Sprachen in Berührung kommen und über kein morphologisches Bewusstsein verfügen. Selbst OMT-1600, das speziell für CRK trainiert wurde, verwendet eine Standard-BPE-Tokenisierung, die polysynthetische Morphologie nicht strukturell abbilden kann. Die Coaching-Daten liefern den sprachlichen Kontext, der dem Modell fehlt.

Bei ressourcenreichen Sprachen (Französisch, Spanisch) hat Coaching weniger Wirkung, da das Modell bereits über solides Basiswissen verfügt.

Siehe [Coaching-Daten](https://champollion.dev/docs/concepts/coaching-data) für die vollständige Spezifikation.

---

## FST & Morphologische Validierung

### Was, wenn es für meine Sprache keinen FST gibt?

Viele Sprachen verfügen über keinen endlichen Zustandsübersetzer. Das ist in Ordnung — das Harness funktioniert auch ohne. Die Gesamtbewertung verwendet die Gewichte von Profil B (siehe [Bewertungsspezifikation §4.3](/docs/network/specifications/scoring#43-weight-tables)), die das Gewicht auf semantische und Oberflächenmetriken verlagern. FST-Akzeptanz wird in der Run Card als `null` markiert.

Die wichtigsten Register für bestehende FSTs:

| Verzeichnis | Abdeckung | URL |
|----------|----------|-----|
| **GiellaLT** | Über 100 Sprachen — die samischen Sprachen, Cree, Inuktitut und viele weitere uralische und Minderheitensprachen | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 Sprachpaare, hauptsächlich europäisch | [apertium.org](https://apertium.org/) |
| **UniMorph** | Morphologische Paradigmen für über 150 Sprachen | [unimorph.github.io](https://unimorph.github.io/) |

### Kann ich einen FST erstellen?

Ja, aber es ist nicht trivial. Ein FST kodiert die morphologischen Regeln einer Sprache — alle gültigen Wortformen. Der Aufbau eines solchen erfordert tiefgreifende linguistische Kenntnisse der Sprache. Wenn Sie Zugang zu einer morphologischen Grammatik haben (z. B. von einem linguistischen Institut), kann diese mit Werkzeugen wie [HFST](https://hfst.github.io/) oder [Foma](https://fomafst.github.io/) zu einem FST kompiliert werden.

### Wie funktioniert FST-Gating in der Praxis?

Die FST-gegatterte Pipeline funktioniert folgendermaßen:

1. Das LLM generiert eine Übersetzung
2. Jedes Wort in der Ausgabe wird gegen den FST geprüft
3. Vom FST abgelehnte Wörter werden als morphologisch ungültig markiert
4. Die Methode kann mit Feedback erneut ausgeführt werden („das Wort X ist nicht gültig, versuchen Sie es erneut")
5. Nach den Wiederholungen werden verbleibende ungültige Wörter protokolliert

Die FST-Akzeptanzrate misst, wie viele Wörter die Validierung bestehen. Siehe das [Tutorial zur FST-gegatterten Pipeline](/docs/network/tutorials/fst-gated-pipeline) für ein vollständiges durchgearbeitetes Beispiel.

---

## Daten & Datensätze

### Kann ich einen Datensatz für eine neue Sprache beitragen?

Ja. Mindestanforderungen aus [Benchmark-Spezifikation §11](/docs/network/specifications/benchmark#11-extending-to-new-languages):

- **50 Gold-Standard-Einträge** (Quelle + verifizierte Referenzübersetzung)
- **30 Entwicklungseinträge** (können sich bei kleinen Korpora mit dem Gold-Standard überschneiden)
- **Zustimmung der Gemeinschaft** (bei indigenen Sprachen ausdrückliche Autorisierung durch ein Governance-Gremium)
- **Herkunftsdokumentation** (woher die Daten stammen, welche Lizenz gilt)

Neue Datensätze eröffnen automatisch neue Leaderboard-Tracks. Siehe [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) für den Leitfaden für Beitragende.

### In welchem Format sollte mein Datensatz vorliegen?

JSON mit den kanonischen Feldnamen:

```json
{
  "name": "my-language-dev-v1",
  "language_pair": "en-xxx",
  "segment": "development",
  "version": "1.0",
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "[translation in target language]",
      "difficulty": 1,
      "domain": "general"
    }
  ]
}
```

Siehe [Datensätze](/docs/network/leaderboard/datasets) für das vollständige Schema und die Definitionen der Schwierigkeitsstufen.

---

## Souveränität & Eigentum

### Wem gehört eine für eine indigene Sprache entwickelte Methode?

Bei indigenen Sprachen lösen Methoden, die die Deployable-Stufe (Gesamtbewertung ≥ 0.70) erreichen UND die Community-Validierung bestehen, den Prozess der [Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer) aus. Das Code-Eigentum geht vom Forschenden auf die Governance-Organisation der Sprachgemeinschaft über.

Der Forschende behält:
- Veröffentlichungsrechte (akademische Arbeiten über die Methode)
- Nennung auf dem Leaderboard
- Das Recht, dieselben *Techniken* auf andere Sprachen anzuwenden

Die Governance-Organisation erhält:
- Vollständiges Eigentum am Methodencode und den Coaching-Daten
- Kontrolle über den Einsatz (wann, wo, wie) — und alles, was ein Einsatz einbringt. Champollion ist nicht-kommerziell und nimmt keinen Anteil

### Kann ich Champollion für nicht-indigene Sprachen ohne jegliche Souveränitätsbedenken verwenden?

Ja. Bei Standardsprachen (Französisch, Japanisch, Spanisch usw.) gibt es keine Souveränitätsüberlegungen. Verwenden Sie Champollion normal — übersetzen, synchronisieren und veröffentlichen Sie nach Belieben. Das Souveränitäts-Rahmenwerk gilt speziell für indigene und gemeinschaftlich verwaltete Sprachen, bei denen Datenverwaltungsgrundsätze — Eigentum und Kontrolle der Gemeinschaft über ihre Sprachdaten, CARE, Te Mana Raraunga — besondere Berücksichtigung erfordern.

---

## Siehe auch

- **[Wie es funktioniert](https://champollion.dev/how-it-works)** — die vollständige Erläuterung der Lösung
- **[Bewertungsspezifikation](/docs/network/specifications/scoring)** — die SSOT für die gesamte Bewertungslogik (Metriken, Gewichte, Stufen)
- **[Benchmark-Spezifikation](/docs/network/specifications/benchmark)** — Evaluierungsprotokoll, Korpusformat, Souveränität
- **[Eine Methode einreichen](/docs/network/getting-started/submit-a-method)** — Schritt-für-Schritt-Schnellstart
- **[Leaderboard-Regeln](/docs/network/leaderboard/rules)** — Einreichungskriterien
- **[Datenverwaltung](/docs/network/sovereignty/data-sovereignty)** — Korpora verbleiben bei ihren Verwaltern; jede Lizenz wird respektiert
