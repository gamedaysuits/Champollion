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

Der Hauptwert – und die einzige Zahl, nach der ein Durchlauf eingestuft wird – ist **Korpus-chrF++** mit seinem 95%-Konfidenzintervall. Daneben meldet das Harness die weiteren Standardmetriken – **BLEU, spBLEU und TER** sowie **COMET**, sofern installiert –, jeweils für sich allein, niemals vermischt. Alles andere ist eine **Diagnose**: separat ausgewiesen, um einen Score zu erklären, aber niemals Teil davon. Die nachstehende Tabelle deckt chrF++ und die wichtigsten Diagnosen ab; drei davon sind sprachunabhängig und zwei stützen sich derzeit auf CRK-spezifische Plugins, die verallgemeinert werden, sobald wir weitere Sprachen unterstützen. Die lauffähigen Referenzkorpora sind heute öffentlich unter freien Lizenzen verfügbare Datensätze – Global Voices, Tatoeba, TICO-19, IN22, SMOL und weitere (siehe [Datensätze](/docs/network/leaderboard/datasets)) – und die Bestenliste ist für Einreichungen für jedes registrierte Sprachenpaar geöffnet. Plains Cree ist lediglich die Sprache, für die die beiden sprachspezifischen (FST-gestützten) Metriken zuerst implementiert wurden.

| Metrik | Skala | Was gemessen wird | Status |
|--------|-------|-------------------|--------|
| **chrF++** (Hauptmetrik) | 0–100 | Zeichen-n-Gramm-Überlappung zwischen vorhergesagten und Referenzübersetzungen, berechnet über das gesamte Korpus mit sacreBLEU (die Signatur wird protokolliert). Die standardmäßige Oberflächenmetrik für morphologisch reiche Sprachen. | ✅ Alle Sprachen |
| **Exact match** (Diagnose) | 0,0–1,0 | Anteil der Einträge, bei denen die Vorhersage nach Normalisierung exakt mit der Referenz übereinstimmt. | ✅ Alle Sprachen |
| **FST-Akzeptanz** (Diagnose) | 0,0–1,0 | Anteil der Ausgabewörter, die von einem Transduktor mit endlichen Zuständen (morphologischer Analysator) akzeptiert werden. Wird nur berechnet, wenn eine FST-Binärdatei bereitgestellt wird. | ✅ Alle Sprachen mit FST |
| **Equivalent match** (Diagnose) | 0,0–1,0 | Anteil der Einträge, die mit der Referenz oder einer akzeptablen Variante übereinstimmen – unter Berücksichtigung von Wortstellung, orthografischen Konventionen und dialektalen Unterschieden. | ⚡ CRK (wird verallgemeinert) |
| **Semantischer Score** (Diagnose) | 0,0–1,0 | Score zur Bedeutungserhaltung – wie gut erfasst die Übersetzung die beabsichtigte Bedeutung ungeachtet der Oberflächenform? | ⚡ CRK (wird verallgemeinert) |

Weitere Diagnosen – **morphologische Genauigkeit**, **Code-Switching**, **Terminologietreue**, **Halluzination** und **Schreibstil** – sowie der Implementierungsstatus der einzelnen Metriken finden sich in [Bewertungsspezifikation § 2](/docs/network/specifications/scoring#2-metric-inventory), dem vollständigen Metrikeninventar.

### Wie wird ein Durchlauf bewertet?

Jeder neue Durchlauf wird nach dem Bewertungsstandard `standard/1` bewertet, so wie das Fachgebiet MT-Evaluierungen berichtet (WMT, FLORES-200, AmericasNLP):

- **Hauptmetrik:** Korpus-chrF++, angegeben mit dem 95%-Bootstrap-KI und der sacreBLEU-Signatur – beispielsweise `chrF++ 47.5 [45.9, 49.0]`.
- **Daneben:** BLEU, spBLEU, TER und COMET, sofern berechnet. Niemals vermischt.
- **Diagnosen:** Exact Match, FST-Akzeptanz, morphologische Genauigkeit, Code-Switching, Halluzination, Terminologie, Schreibstil. Werden separat ausgewiesen; sie stufen einen Durchlauf niemals ein.
- **Score-Vorbehalte** werden direkt neben der Hauptmetrik ausgegeben, wenn das Harness ein Muster erkennt, das den Wert irreführend macht.

Ob ein Durchlauf **besser** ist als ein anderer, wird durch einen gepaarten Signifikanztest auf chrF++ entschieden (`mt-eval compare --significance`), nicht durch den bloßen Vergleich zweier Zahlen. Vollständige Regeln: [Wie Durchläufe bewertet werden](/docs/network/specifications/scoring#how-runs-are-scored) und die [Signifikanzspezifikation](/docs/network/specifications/significance).

### Was ist mit dem zusammengesetzten Score und den Qualitätsstufen geschehen?

Beide wurden für neue Durchläufe **eingestellt**. Der zusammengesetzte Score war eine gewichtete Mischung aus chrF++, Exact Match, FST-Akzeptanz und anderen Signalen, und die Stufen (Baseline → Fluent) waren daraus abgeleitete Bezeichnungen. Mehrere seiner Eingangsgrößen vergleichen die Ausgabe niemals mit der Quelle oder Referenz, sodass ein System den Großteil davon erzielen konnte, ohne überhaupt zu übersetzen: Ein untrainiertes Englisch→Nordsamisch-Modell, das für jede Eingabe denselben gültigen Satz wiederholte, erzielte 0,6244 – bezeichnet als „functional“ – bei einem chrF++ von 5,5. Neue Durchlaufkarten veröffentlichen `composite: null` und `quality_tier: null`.

Karten, die vor dem Standard veröffentlicht wurden, behalten ihren gespeicherten zusammengesetzten Score und bleiben verifizierbar; wo immer ein solcher angezeigt wird, ist er als **Legacy-Zusammensetzung (eingestellt)** gekennzeichnet. Siehe [Warum der zusammengesetzte Score eingestellt wurde](/docs/network/specifications/scoring#why-the-composite-was-retired).

Ein automatischer Score ist kein Qualitätsurteil. Nur eine menschliche Evaluierung durch Sprecherinnen und Sprecher der Sprache zertifiziert Qualität.

### Was sind Verifizierungsstufen?

**Verifizierungsstufen** beschreiben, *wer das Ergebnis validiert hat*, nicht wie gut es ist:

| Verifizierungsstufe | Bedeutung |
|---------------------|-----------|
| **Self-benchmarked** | Die einreichende Person hat das Harness selbst ausgeführt. Scores sind plausibel, aber unbestätigt. |
| **Champollion Verified** | Ein Maintainer hat das Ergebnis unter Verwendung der eingereichten Methodenkonfiguration reproduziert. |
| **Community Validated** | Zweisprachige Sprecherinnen und Sprecher der Zielsprache, die nach dem Protokoll der Community selbst qualifiziert sind, haben eine geschichtete Stichprobe der Ausgabe geprüft (≥30 Einträge, ≥2 Prüfende) und ≥70 % erfüllten die Anforderungen der Community. Wird ausschließlich durch eigene Prüfungen der Community vergeben; eine Herabstufung durch Stichprobenaudits erfolgt symmetrisch und ebenso öffentlich. |

Ein Durchlauf kann einen hohen chrF++-Wert aufweisen und dennoch nur „Self-benchmarked“ sein – was bedeutet, dass niemand den Score unabhängig bestätigt hat und keine sprechende Person die Ausgabe beurteilt hat.

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

1. **Self-benchmarked:** Jede Einreichung beginnt hier, und heute befindet sich jede Zeile auf der Bestenliste noch auf dieser Stufe.
2. **Champollion Verified:** Das Projekt bewertet Ihre eingereichten Ausgaben anhand des per SHA fixierten Referenzkorpus mit den Metriken des Harness neu. Lässt sich Ihr Score reproduzieren, wird der Durchlauf zu Champollion Verified hochgestuft – die Stufe, die ein Wettbewerbs-Ranking standardmäßig verwendet, und die einzige Stufe, die für einen Preis infrage kommt; die öffentliche Bestenliste führt auch selbst gebenchmarkte Zeilen auf, die entsprechend gekennzeichnet sind. Lässt sich der Score nicht reproduzieren oder wurde eine gespeicherte Referenz verändert, wird der Durchlauf disqualifiziert. Die Neubewertung ist ein Maintainer-Batch, der manuell ausgeführt wird: Bei der Einreichung wird nichts automatisch ausgeführt oder eingeplant.
3. **Community Validated:** Zweisprachige Sprecherinnen und Sprecher der Zielsprache, die nach dem eigenen Protokoll der Community qualifiziert sind, begutachten eine geschichtete Stichprobe der Ausgabe Ihrer Methode – mindestens 30 Einträge, mindestens 2 Prüfende – und mindestens 70 % müssen den Maßstab der Community erfüllen. Diese Stufe wird ausschließlich durch Prüfungen verliehen, die die Community selbst nach eigenem Ermessen durchführt, und kann auf demselben Weg wieder aberkannt werden: Ein nicht bestandenes Stichprobenaudit stuft die Methode ebenso öffentlich herab. Dies lässt sich nicht automatisieren – es erfordert das Engagement der Community.

### Warum führen Sie nicht die Methode jedes Einzelnen erneut aus, um sie zu verifizieren?

Weil wir es uns weder leisten können noch müssen. Die Neubewertung der eingereichten Ausgaben *aller* Beteiligten ist kostenlos (dadurch werden manuell eingegebene oder manipulierte Scores aufgedeckt). Die tatsächliche erneute Ausführung eines Modells kostet jedoch echte Rechenleistung, weshalb sie nur für eine **Stichprobe** erfolgt, die durch **reputationsgewichtete Prüfungen** ausgewählt wird – die Stichprobenrichtlinie ist implementiert und getestet, der Re-Runner, den sie steuern würde, jedoch noch nicht, weshalb bislang noch keine stichprobenartige Neuausführung ausgelöst wurde und ein ausgewählter Durchlauf als *L2-pending* erfasst wird. Nach dieser Richtlinie wird ein Durchlauf stets dann ausgewählt, wenn er von hoher Tragweite ist (er schlägt die erste Brücke zu einer ganzen Sprachfamilie) oder auffällig ist (ein zu gut klingender Sprung gegenüber dem bisherigen Bestwert); bei bewährten Beitragenden erfolgen Stichproben nur selten. Reputation wird ausschließlich durch das Bestehen dieser Audits erworben (oder dadurch, dass eine unabhängige beitragende Person Ihr Ergebnis bestätigt) – niemals durch Quantität –, sodass neue Wegwerf-Identitäten keinen Vorteil erlangen. Eine aufgedeckte Fälschung setzt die Reputation einer beitragenden Person auf null zurück, führt zu einer erneuten Prüfung ihrer gesamten verifizierten Historie und wird öffentlich vermerkt, ähnlich einem wissenschaftlichen Widerruf. Wir behaupten **nicht**, dass Ihr Durchlauf „durch das Harness gelaufen ist“ – bei selbst gehosteten Rechenressourcen ist dies serverseitig nicht verifizierbar –, sodass die Gültigkeit auf *Reproduzierbarkeit + Reputationsrisiko + Bestätigung* beruht, nicht auf einer Beglaubigung. Siehe die [Regeln zur MT-Evaluierung](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) für das vollständige Modell.

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

Viele Sprachen verfügen über keinen Transduktor mit endlichen Zuständen (FST). Das ist in Ordnung – das Harness funktioniert auch ohne einen solchen. Die Hauptmetrik ist in jedem Fall chrF++, weshalb Durchläufe mit und ohne FST gleich bewertet werden; die FST-Akzeptanz ist eine Diagnose und wird in der Durchlaufkarte mit `null` gekennzeichnet, wenn kein FST verwendet wurde.

Die wichtigsten Register für bestehende FSTs:

| Register | Abdeckung | URL |
|----------|-----------|-----|
| **GiellaLT** | 100+ Sprachen – die samischen Sprachen, Cree, Inuktitut und viele weitere uralische sowie Minderheitensprachen | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 Sprachenpaare, überwiegend europäische | [apertium.org](https://apertium.org/) |
| **UniMorph** | Morphologische Paradigmen für 150+ Sprachen | [unimorph.github.io](https://unimorph.github.io/) |

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

Bei indigenen Sprachen löst eine Methode, die die Anforderungen eines Preises erfüllt – seinen automatisierten Schwellenwert sowie die Community-Validierung durch Sprecherinnen und Sprecher –, den Prozess der [Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer) gemäß der Standardvorlage aus. Das Eigentum am Code geht von der forschenden Person auf die Governance-Organisation der Sprachgemeinschaft über.

Der Forschende behält:
- Veröffentlichungsrechte (akademische Arbeiten über die Methode)
- Nennung auf dem Leaderboard
- Das Recht, dieselben *Techniken* auf andere Sprachen anzuwenden

Die Governance-Organisation erhält:
- Vollständiges Eigentum am Methodencode und den Coaching-Daten
- Kontrolle über den Einsatz (wann, wo, wie) — und alles, was ein Einsatz einbringt. Champollion ist nicht-kommerziell und nimmt keinen Anteil

### Kann ich Champollion für nicht-indigene Sprachen ohne jegliche Souveränitätsbedenken verwenden?

Ja. Für Standardsprachen (Französisch, Japanisch, Spanisch usw.) gibt es keine Souveränitätsüberlegungen. Verwenden Sie champollion ganz normal – übersetzen, synchronisieren und veröffentlichen Sie nach Belieben. Das Souveränitäts-Framework gilt speziell für indigene und von Gemeinschaften verwaltete Sprachen, bei denen Prinzipien der Daten-Governance – gemeinschaftliches Eigentum und Kontrolle über Sprachdaten, CARE, Te Mana Raraunga – besondere Berücksichtigung erfordern.

---

## Siehe auch

- **[Wie es funktioniert](https://champollion.dev/how-it-works)** — die vollständige Erläuterung der Lösung
- **[Bewertungsspezifikation](/docs/network/specifications/scoring)** — die SSOT für die gesamte Bewertungslogik (Metriken, Gewichte, Stufen)
- **[Benchmark-Spezifikation](/docs/network/specifications/benchmark)** — Evaluierungsprotokoll, Korpusformat, Souveränität
- **[Eine Methode einreichen](/docs/network/getting-started/submit-a-method)** — Schritt-für-Schritt-Schnellstart
- **[Leaderboard-Regeln](/docs/network/leaderboard/rules)** — Einreichungskriterien
- **[Datenverwaltung](/docs/network/sovereignty/data-sovereignty)** — Korpora verbleiben bei ihren Verwaltern; jede Lizenz wird respektiert
