---
sidebar_position: 6
title: "Benchmark-Spezifikation"
slug: '/network/specifications/benchmark'
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The corpora currently in play"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
---

# Benchmark-Spezifikation

> **Zusammenfassung.** Dieses Dokument definiert das Evaluierungsprotokoll für das Champollion-MT-Evaluierungsökosystem: Korpusformat (§2), Run-Card-Schema (§3), Benchmark-Protokoll (§6), Anforderungen an die menschliche Validierung (§7), Souveränitätsmechanismen (§8), Leaderboard- und Einreichungsmodell (§9), Kostenrahmen (§10) und Erweiterbarkeit auf neue Sprachen (§11). Wie Durchläufe bewertet werden (die chrF++-Hauptmetrik, die Standardmetriken daneben, die Diagnosemetriken) und Formeln für Kosten-/Geschwindigkeitsmetriken finden Sie in `SCORING_SPEC.md` – der zentralen Referenz für sämtliche Bewertungslogik. Dieses Dokument verweist für diese Details auf SCORING_SPEC, anstatt sie zu duplizieren.


---

## 1. Grundsätze

### 1.1 Sprachen sind Biodaten

Eine Sprache ist kein neutrales Testmaterial. Wie genetische oder gesundheitsbezogene Daten sind Sprachdaten **Biodaten**: Sie tragen die Identität, Verwandtschaft und Beziehungen der Menschen in sich, die sie sprechen, und sie lassen sich nicht sinnvoll anonymisieren — entfernt man die Metadaten, kodiert die Sprache dennoch, wer ihre Menschen sind. Die Konsequenz für diese Spezifikation ist konkret: Die Menschen, die ein Korpus bereitstellen, halten die Schlüssel dazu und zu allem, was daran gemessen wird. Souveränität (§8) ist daher kein Zusatz zum Protokoll; sie ist dessen Voraussetzung, und jeder andere nachfolgende Grundsatz wirkt innerhalb ihrer.

### 1.2 Automatisierte Metriken sind Näherungswerte

Jede in diesem Dokument definierte Metrik wird maschinell berechnet. chrF++, FST-Akzeptanz, morphologische Genauigkeit, semantische Ähnlichkeit — sie alle sind automatisierte Näherungswerte für die Übersetzungsqualität. Sie sind nützlich für schnelle Iteration, systematischen Vergleich und das Erkennen von Regressionen. Sie sind **kein Ersatz für menschliches Urteilsvermögen**.

Die Evaluierungshierarchie:

```
Automated metrics (run cards, benchmarks)
    ↓ proxy for
Human review (bilingual speakers validate output)
    ↓ proxy for
Actual utility (does this help a language community?)
```

Kein automatisierter Wert, egal wie hoch er ausfällt, kann eine fließend sprechende Person ersetzen, die die Ausgabe liest und bestätigt, dass sie korrekt, natürlich und kulturell angemessen ist. Aus diesem Grund trägt keine automatische Bewertung eine Qualitätsbezeichnung (§5): Automatische Metriken sind nützlich, um den Fortschritt zu verfolgen, reichen für sich allein jedoch niemals aus.

### 1.3 Methoden, nicht Modelle

Wir benchmarken **Methoden**, nicht Modelle. Ein Modell ist eine Komponente. Eine Methode ist das vollständige Rezept: Modellauswahl, Prompt-Design, Werkzeugeinsatz, Vor-/Nachverarbeitung, Coaching-Daten, Wiederholungsstrategien, alles. Zwei Teams, die dasselbe Modell mit unterschiedlichen Methoden verwenden, erhalten unterschiedliche Bewertungen. Das ist der Sinn der Sache.

### 1.4 Reproduzierbarkeit

Jedes Benchmark-Ergebnis muss reproduzierbar sein. Die Run Card (§3) erfasst die vollständige Konfiguration eines Experiments. Der Fingerprint (§3.5) identifiziert den experimentellen Aufbau. Der Run-Card-Hash (§3.6) verifiziert die Integrität des Ergebnisses. Jede Person mit derselben Methode, demselben Korpus und derselben Konfiguration sollte Bewertungen innerhalb von ±2 % erreichen (unter Berücksichtigung der Nicht-Determiniertheit des LLM-Samplings bei Temperatur > 0).

### 1.5 Keine synthetischen Evaluierungsdaten

**Dieses Projekt erzeugt, verwendet oder befürwortet keine synthetischen Evaluierungsdaten.** Alle Korpora müssen aus echtem, von Menschen verfasstem Text stammen — veröffentlichte Übersetzungen, Lehrbücher, zweisprachige Dokumente oder elizitierte Übersetzungen von sprachkundigen Personen.

LLMs dürfen unterstützen bei:
- Satzausrichtung (Auffinden paralleler Passagen in bestehenden zweisprachigen Texten)
- Formatkonvertierung (Überführung veröffentlichter Materialien in das Korpusschema)
- Metadaten-Anreicherung (Vorschlagen von Schwierigkeitsstufen, Registerbezeichnungen)
- Vorschlagen von Ausgangssätzen für die menschliche Übersetzung (§11.3 — der Übersetzungsschritt erfolgt stets durch Menschen)

LLMs dürfen **niemals** Referenzübersetzungen oder Evaluierungspaare erzeugen.

**Wir verhalten uns entwicklungsneutral gegenüber Trainingsdaten.** Wenn eine Methodenentwicklerin oder ein Methodenentwickler synthetische Trainingsdaten, Rückübersetzung oder Datenerweiterung in ihrer bzw. seiner Methode verwendet, ist das ihre bzw. seine Entscheidung — wir evaluieren die Ausgabe, nicht den Trainingsprozess. Metas OMT-1600 verwendet etwa 270 Millionen synthetische Parallelsätze, die per Rückübersetzung erzeugt wurden. Wir haben keine Einwände gegen so trainierte Methoden. Wir testen ausschließlich anhand menschlicher Kuratierung.

> **Warum kein Bibeltext zur Evaluierung?** OMT-1600 evaluiert 1.560 von 1.600 Sprachen anhand von Text aus der Bibeldomäne (Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026). Bibelübersetzungen haben ein archaisches Register, liturgisches Vokabular und formelhafte Satzstruktur. Unsere Evaluierungskorpora stammen aus gemeinschaftlich kuratiertem, domänenvielfältigem Text — aus den Bereichen Gesundheit, Recht, Bildung, Verwaltung, Konversation und Technik (siehe §2.7). Dies ist eine bewusste Designentscheidung. Gemeinschaften benötigen Übersetzungen für die Domänen, in denen sie tatsächlich leben und arbeiten, nicht ein einzelnes religiöses Register. Eine Methode, die bei Genesis 1,1 gut abschneidet, sagt Ihnen fast nichts über ihre Leistung bei einer Tagesordnung eines Band Council oder einem Aufnahmeformular einer Klinik.

---

## 2. Korpusschema

Ein Korpus ist ein kuratierter Satz paralleler Textpaare mit strukturierten Metadaten. Es ist die Grundwahrheit (Ground Truth), an der alle Methoden gemessen werden.

### 2.1 Datensatz-Umschlag

Die oberste Struktur einer Korpusdatei:

```json
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-05-01",
    "license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [ ... ]
}
```

| Feld | Typ | Erforderlich | Beschreibung |
|-------|------|----------|-------------|
| `id` | string | ✅ | Eindeutige Datensatzkennung, verwendet in Run Cards und im Leaderboard |
| `version` | string | ✅ | Semantische Version. Ein Hochzählen macht vorherige Run-Card-Vergleiche ungültig |
| `language_pair` | string | ✅ | Anzeigebezeichnung (z. B. `EN→CRK`) |
| `source_language` | string | ✅ | BCP-47-Ausgangssprachcode |
| `target_language` | string | ✅ | BCP-47-Zielsprachcode |
| `created` | string | ✅ | ISO-8601-Erstellungsdatum |
| `license` | string | ✅ | SPDX-Lizenzkennung |
| `provenance` | string[] | ✅ | Liste der über alle Einträge verwendeten Provenienz-Tags |

### 2.2 Eintragsschema

Jeder Eintrag im Korpus stellt eine Übersetzungsherausforderung dar:

```json
{
  "id": 42,
  "source": "I see the dog",
  "reference": "niwâpamâw atim",
  "segment": "gold_standard",
  "difficulty": 2,
  "provenance": "gold_standard",
  "register": "conversational",
  "context": "declaration",
  "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
  "notes": "Animate noun (atim); direct form because speaker is proximate",
  "variant_class": "simple-ta-direct"
}
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `id` | integer | ✅ | Eindeutige Kennung innerhalb des Korpus |
| `source` | string | ✅ | Ausgangstext in der Ausgangssprache |
| `reference` | string | ✅ | Goldstandard-Referenzübersetzung in der Zielsprache |
| `segment` | string | 📎 | Korpus-Partition: `gold_standard`, `held_out`, `development` oder `diagnostic` |
| `difficulty` | integer | 📎 | Schwierigkeitsgrad 1–5 (siehe §2.4) |
| `provenance` | string | 📎 | Herkunft dieses Eintrags (siehe §2.5) |
| `register` | string | 📎 | Register/Formalitätsstufe (siehe §2.6) |
| `context` | string | 📎 | Kommunikative Funktion (siehe §2.6) |
| `domain` | string | 📎 | Anwendungsbereich aus der 16-Code-Taxonomie (siehe §2.7). Muss einer der folgenden Werte sein: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech`, `ui`. Wird bei der Erstellung validiert. |
| `morphological_analysis` | string | ❌ | Morphologische Aufschlüsselung des Goldstandards |
| `notes` | string | ❌ | Anmerkungen des Übersetzers, dialektale Varianten, Mehrdeutigkeitskennzeichnungen |
| `variant_class` | string | ❌ | Klassenbezeichnung zur Gruppierung akzeptabler Übersetzungsvarianten |

> **📎 = EMPFOHLEN.** Das Harness behandelt fehlende optionale Felder reibungslos anhand von Standardwerten. Korpora von Drittanbietern müssen pro Eintrag lediglich `id`, `source` und `reference` bereitstellen.


### 2.3 Korpussegmente

Das Korpus ist in Segmente mit unterschiedlichen Zugriffsebenen unterteilt:

| Segment | Zweck | Zugriff | Mindestgröße |
|---------|---------|--------|-------------|
| `development` | Methodenentwicklung und Iteration. Entwickler nutzen diese frei. | **Öffentlich** | 30 Einträge |
| `diagnostic` | Gezielte Tests für spezifische linguistische Phänomene. | **Öffentlich** | 10 Einträge |
| `gold_standard` | Offizielle Benchmark-Evaluierung. Leaderboard-Bewertungen stammen hierher. | **Geheim** — verwahrt von der Governance-Organisation | 50 Einträge |
| `held_out` | Reserviert für zukünftige Evaluierung. Wird bis zur Aktivierung nie verwendet. | **Geheim** — verwahrt von der Governance-Organisation | 10 Einträge |

> **Aktueller Stand:** Nur das Segment `development` existiert in ausgelieferten Datensätzen. Die Segmente `diagnostic`, `gold_standard` und `held_out` sind für die zukünftige Verwendung definiert, wenn die Korpora wachsen.

Die Segmente `gold_standard` und `held_out` sind vollständig geheim. Sowohl die Ausgangssätze als auch die Referenzübersetzungen werden auf einer Governance-kontrollierten Infrastruktur verwahrt. Methodenentwickler sehen weder die Fragen noch die Antworten. Siehe §8 für den Souveränitätsmechanismus.

### 2.4 Schwierigkeitsstufen

| Stufe | Beschreibung | Beispiele |
|------|-------------|----------|
| 1 — Grundwortschatz | Einzelne Wörter, gängige Begrüßungen, Zahlen | „hello" → „tânisi", „dog" → „atim" |
| 2 — Einfache Sätze | Subjekt-Verb oder SVO, Präsens | „I see the dog" → „niwâpamâw atim" |
| 3 — Mittlere Komplexität | Vergangenheits-/Zukunftsform, Possessiva, Belebtheit | „I saw his dog yesterday" |
| 4 — Komplexe Morphologie | Obviation, Passiv, Konjunktordnung, Relativsätze | „the woman whose son went to the store" |
| 5 — Fortgeschritten | Mehrsätzig, formelles Register, zeremoniell, idiomatisch | Ganzer Absatz mit registergerechtem Ton |

Ein gut konstruiertes Korpus sollte Einträge über alle fünf Schwierigkeitsstufen hinweg enthalten, mit Schwerpunkt auf den Stufen 2–4, in die die meisten realen Übersetzungsherausforderungen fallen.

### 2.5 Provenienz-Tags

Jeder Eintrag muss seine Herkunft angeben:

| Tag | Bedeutung |
|-----|---------|
| `gold_standard` | Von sprachkundigen Personen verifiziert |
| `textbook` | Aus veröffentlichten Bildungsmaterialien |
| `elicited` | Durch strukturierte Elizitationssitzungen erzeugt |
| `corpus` | Aus einem Parallelkorpus extrahiert |

> **Hinweis:** In der Praxis sind Provenienzwerte frei formulierte Zeichenketten. Die obigen Tags sind Konventionen, kein validiertes Enum — Datensätze können andere beschreibende Provenienz-Zeichenketten verwenden.

### 2.6 Register und Kontext

**Register** beschreibt die Formalität und den sozialen Kontext:

| Register | Beschreibung |
|----------|-------------|
| `conversational` | Alltagssprache zwischen Gleichrangigen |
| `formal` | Amtliche oder institutionelle Sprache |
| `technical` | Domänenspezifisches Vokabular |
| `ceremonial` | Traditioneller oder sakraler Sprachgebrauch |
| `educational` | Sprachlehrmaterialien |

**Kontext** beschreibt die kommunikative Funktion:

> 🔲 **Geplant.** Das Feld `context` ist im Schema definiert, aber in aktuellen Datensätzen noch nicht befüllt. Es ist für die zukünftige Korpusanreicherung reserviert.

| Kontext | Beschreibung |
|---------|-------------|
| `greeting` | Soziale Begrüßung oder Verabschiedung |
| `declaration` | Tatsachenfeststellung |
| `question` | Interrogativ |
| `instruction` | Befehl oder Anweisung |
| `narrative` | Erzählung oder Beschreibung |
| `label` | UI-Bezeichnung, Schaltflächentext oder Überschrift |
| `error` | Fehlermeldung oder Warnung |

### 2.7 Domäne {#27-domain}

**Domäne** beschreibt den realen Anwendungsfall — die Art des zu übersetzenden Inhalts. Dies ist orthogonal zu Register und Kontext:

- **Register** beantwortet: *Wie formell ist dies?*
- **Kontext** beantwortet: *Was tut dieser Satz?*
- **Domäne** beantwortet: *Für welche Branche/welchen Anwendungsfall ist dies?*

Ein Rechtsvertrag (Domäne: `legal`) könnte formell sein (Register: `formal`) und eine Erklärung enthalten (Kontext: `declaration`). Ein Chatbot-Transkript im Rechtsbereich (Domäne: `legal`) könnte konversationell sein (Register: `conversational`) und Fragen enthalten (Kontext: `question`). Dieselbe Domäne, unterschiedliches Register und Kontext.

| Domänencode | Beschreibung | Typische Abnehmer |
|-------------|-------------|-------------------|
| `ui` | Zeichenketten von Softwareoberflächen | App-Entwickler, Lokalisierungsteams |
| `legal` | Verträge, Gesetze, Gerichtsakten, Einwanderungsdokumente | Anwaltskanzleien, Gerichte, Compliance-Teams, IP-Anwälte |
| `medical` | Klinische Notizen, Arzneimitteletiketten, Patientenkommunikation, Studienprotokolle | Krankenhäuser, Pharmaunternehmen, klinische Studien, Patientenportale |
| `financial` | Bankwesen, Versicherung, Aufsichtsmeldungen, Prüfberichte | Banken, Versicherer, Aufsichtsbehörden, Prüfer |
| `edu` | Lehrbücher, Lehrpläne, Unterrichtsplanungen, akademische Materialien | Schulen, Universitäten, Lehrbuchverlage |
| `ecommerce` | Produktbeschreibungen, Rezensionen, Marktplatzangebote | Online-Händler, Marktplatzverkäufer |
| `marketing` | Werbetexte, Markenbotschaften, Kampagnen, Slogans | Werbeagenturen, Markenteams |
| `gov` | Grundsatzdokumente, Verordnungen, öffentliche Bekanntmachungen, Gesetzgebung | Behörden, Compliance-Teams |
| `scientific` | Forschungsarbeiten, Abstracts, Methodik, Förderanträge | Forschende, Fachzeitschriften, Förderorganisationen |
| `religious` | Heilige Schriften, liturgische Texte, theologische Kommentare | Glaubensgemeinschaften, liturgische Verlage |
| `support` | FAQs, Fehlermeldungen, Fehlerbehebungsanleitungen, Chatbot-Skripte | SaaS-Unternehmen, Helpdesks |
| `subtitles` | Film-, Fernseh-, Streaming- und Gaming-Dialoge | Streaming-Plattformen, Studios, Gaming-Unternehmen |
| `news` | Journalismus, Agenturmeldungen, Redaktionelles, Pressemitteilungen | Medienorganisationen, Nachrichtenagenturen |
| `literary` | Belletristik, Poesie, Erzählung, kulturelle Texte | Verlage, Organisationen zur kulturellen Bewahrung |
| `conv` | Informelle Konversation, soziale Medien, Nachrichtenaustausch | Verbraucher-Apps, soziale Plattformen |
| `tech` | API-Dokumentation, Handbücher, technische Spezifikationen, technische Leitfäden | Dokumentationsteams, Engineering-Organisationen |

> **Domänenspezifische Benchmarks.** Der allgemeine Benchmark evaluiert eine Methode über alle Domänen hinweg. Das Network unterstützt jedoch auch **domänengefilterte Benchmarks** — bei denen Bewertungen nur für Einträge berechnet werden, die mit einer bestimmten Domäne getaggt sind. So können Nutzer folgende Frage beantworten: „Welche Methode ist am besten für die Übersetzung von Rechtsdokumenten ins Französische?" im Vergleich zu „Welche Methode hat die beste Gesamtbewertung für Französisch?"
>
> Domänengefilterte Leaderboard-Rankings ermöglichen es Nutzern, Methoden innerhalb eines einzelnen Anwendungsfalls zu vergleichen. Unterschiedliche Methoden schneiden über verschiedene Domänen hinweg unterschiedlich ab — eine auf Rechtsterminologie feinabgestimmte Methode kann bei Rechtstext weitaus besser abschneiden als bei Konversationstext. Das Network hilft Nutzern, die Methode zu finden, die für ihren spezifischen Anwendungsfall am besten funktioniert.

> **Zukünftig: Network-Assistent.** Ein konversationeller Assistent, der Nutzern hilft, ihren MT-Anwendungsfall zu beschreiben (Domäne, Sprachpaar, Qualitätsanforderungen) und relevante gemeinschaftsvalidierte Methoden aus dem Leaderboard hervorhebt — etwa „welche Methode erzielt die höchste Bewertung bei EN→JA-Benchmarks der medizinischen Domäne?" — ist eine Navigationshilfe, die wir in Erwägung ziehen, abhängig von ausreichend domänengetaggten Evaluierungsdaten und Methodenvielfalt.

---

## 3. Run-Card-Schema {#3-run-card-schema}

Die Run Card ist die atomare Einheit der Evaluierung. Sie ist ein eigenständiges JSON-Dokument, das die vollständige Konfiguration und die Ergebnisse eines einzelnen Evaluierungslaufs aufzeichnet: eine Methode, ein Modell, eine Konfiguration, ein Datensatz.

Jede Run Card erfasst drei Dimensionen:
- **Qualität** — wie gut sind die Übersetzungen?
- **Kosten** — wie viel hat ihre Erstellung gekostet?
- **Geschwindigkeit** — wie lange hat es gedauert?

### 3.1 Felder der obersten Ebene

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `run_id` | string | Zu Beginn des Durchlaufs generierte UUID v4 |
| `harness_version` | string | Semantische Version des Harness (z. B. `2.0`) |
| `timestamp` | string | ISO-8601-UTC-Zeitstempel für den Beginn des Durchlaufs |
| `elapsed_seconds` | number | Gesamte reale Laufzeit (Wall-Clock) des Durchlaufs |
| `score_caveats` | array | Nur vorhanden, wenn Einschränkungen für die Werte vorliegen: eine Liste von `{kind, source, severity, message, …}`-Objekten, z. B. ein Testset, dessen Zeilen nahezu identische Zwillinge in den Trainingsdaten haben, Ausgaben, die viel länger oder viel kürzer als ihre Referenzen sind, Ausgaben, die ihre Quelle kopieren, oder eine einzelne Ausgabe, die für viele verschiedene Quellen ausgegeben wurde. Dient zur Information: verändert niemals ein Ergebnis und wird neben der chrF++-Hauptmetrik angezeigt, wo immer die Bewertungen aufgeführt sind. Siehe [Run-Card-Spezifikation](/docs/network/specifications/run-card#score_caveats) |

### 3.2 Methodenkonfiguration

Diese Felder definieren den experimentellen Aufbau — was getestet wurde und wie.

| Feld | Typ | Erforderlich | Beschreibung |
|-------|------|----------|-------------|
| `model_slug` | string | ✅ | Modellkennung (z. B. `google/gemini-2.5-flash`) |
| `model_id` | string | ❌ | Aufgelöste Modellkennung, die von der API zurückgegeben wird |
| `condition` | string | ✅ | Experimentbezeichnung (z. B. `baseline`, `coached-v3`, `few-shot`) |
| `temperature` | number | ✅ | Sampling-Temperatur |
| `system_prompt_sha256` | string | ✅ | SHA-256-Hash des vollständigen System-Prompts |
| `system_prompt_used` | string | ✅ | Der vollständige System-Prompt-Text |
| `coaching_data_sha256` | string | ❌ | SHA-256-Hash der Coaching-Datendatei, falls verwendet |
| `fst_version` | string | ❌ | Version des FST-Analysators, falls verwendet |
| `tools_enabled` | string[] | ❌ | Liste der der Methode verfügbaren Werkzeuge |
| `batch_size` | number | ❌ | Einträge pro nebenläufigem API-Batch |
| `max_retries` | number | ❌ | Maximale Wiederholungen bei FST-Ablehnung, falls zutreffend |

:::info[Veröffentlichte Run Cards enthalten method_config]
Wenn eine Run Card auf dem Leaderboard veröffentlicht wird (über `mt-eval publish`), enthält sie auch einen `method_config`-Block mit der kanonischen 8-Felder-MethodConfig (`model`, `temperature`, `batchSize`, `register`, `coachingFile`, `coachingPrompt`, `promptContext`, `qualityTier` – alle in camelCase; `qualityTier` ist bei einer neuen Karte immer null, da Qualitätsstufen nicht mehr verwendet werden). Dies ermöglicht einen Import ohne Rekonstruktion: `champollion leaderboard --install` liest `method_config` direkt ein und schreibt es als Plugin-Manifest. Die Telemetriefelder oben (§3.2) zeichnen auf, was das Harness beobachtet hat; `method_config` hält fest, was der Entwickler beabsichtigt hat.
:::

### 3.3 Datensatzreferenz

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `dataset.id` | string | Datensatzkennung |
| `dataset.version` | string | Datensatzversion |
| `dataset.language_pair` | string | Anzeigebezeichnung |
| `dataset.sha256` | string | SHA-256-Hash des Datensatzdateiinhalts |
| `dataset.entry_count` | number | Anzahl der evaluierten Einträge |

Der SHA-256 des Datensatzes verankert das Ergebnis an einer bestimmten Version der Daten. Wenn sich der Datensatz ändert, sind alte Run Cards nicht vergleichbar.

### 3.4 Bewertungen (Qualität)

Aggregierte Metriken für den gesamten Lauf. Alle Qualitätsmetriken sind **automatisiert** — siehe §1.2.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `scores.total` | number | Gesamtzahl der ausgewerteten Einträge |
| `scores.exact_matches` | number | Einträge, bei denen die Ausgabe exakt mit der Referenz übereinstimmte |
| `scores.exact_match_rate` | number | 0.0–1.0 |
| `scores.equivalent_matches` | number | Einträge, die mit einer akzeptablen Variante übereinstimmen |
| `scores.equivalent_match_rate` | number | 0.0–1.0 |
| `scores.fst_accepted` | number | Vom FST-Analysator akzeptierte Ausgabewörter, summiert über alle Einträge (eine Wortanzahl, keine Eintragsanzahl) |
| `scores.fst_acceptance_rate` | number | 0.0–1.0, der Mittelwert der Akzeptanzraten pro Eintrag (akzeptierte Wörter jedes Eintrags ÷ Gesamtwörter des Eintrags); `null`, falls kein FST konfiguriert ist |
| `scores.morphological_accuracy` | number | 0.0–1.0, FST-abgeleitet (Lemma-abgeglichen), `null`, falls kein FST / keine Lemma-abgeglichenen Wörter vorhanden sind. Beratend bis zur Aktivierung – siehe Scoring-Spezifikation §2.2 |
| `scores.morph_coverage` | number | 0.0–1.0, Anteil der analysierbaren vorhergesagten Wörter, die per Lemma mit der Referenz abgeglichen wurden (gibt an, wie spärlich `morphological_accuracy` besetzt ist) |
| `scores.chrf_plus_plus` | number | **Die Haupt- und Ranking-Metrik:** chrF++ auf Korpus-Ebene (0–100). Das 95%-Bootstrap-Konfidenzintervall ist `scores.confidence_intervals.corpus_chrf` und die sacreBLEU-Signatur `scores.sacrebleu_signatures.chrf` |
| `scores.scoring_standard` | string | `"standard/1"` auf jeder neuen Karte. Fehlt auf Karten, die vor dem Standard veröffentlicht wurden und als `legacy-composite` gelesen werden |
| `scores.primary_metric` | string | `"chrf_plus_plus"` |
| `scores.spbleu` | number | spBLEU (FLORES-200 SentencePiece), neben chrF++ dargestellt |
| `scores.sacrebleu_signatures` | object | Signatur jeder berechneten sacreBLEU-Metrik (`chrf`, `chrf_plain`, `bleu`, `spbleu`, `ter`) |
| `scores.semantic_score` | number | Embedding-basierte semantische Ähnlichkeit (0.0–1.0) |
| `scores.ter` | number | Translation Edit Rate (0–∞, niedriger ist besser) |
| `scores.length_ratio` | number | avg(len(vorhergesagt)/len(Referenz)), ideal = 1.0 |
| `scores.code_switching_rate` | number | 0.0–1.0, Anteil der Einträge mit Durchscheinen der Ausgangssprache (Source-Language Leakage) |
| `scores.hallucination_rate` | number | 0.0–1.0, Anteil der Einträge mit halluziniertem Inhalt |
| `scores.terminology_adherence` | number | 0.0–1.0, Einhaltung von Glossarbegriffen (`null`, falls kein Glossar vorhanden) |
| `scores.tokens_per_second` | number | total_tokens / elapsed_seconds |
| `scores.entries_per_minute` | number | Übersetzte Einträge pro Minute |
| `scores.composite` | number \| null | **Eingestellt.** `null` auf jeder neuen Karte; eine Legacy-Karte behält ihren gespeicherten Composite-Wert, der als „Legacy-Composite (eingestellt)“ angezeigt wird. Siehe SCORING_SPEC §4 |
| `scores.quality_tier` | string \| null | **Eingestellt.** `null` auf jeder neuen Karte. Siehe SCORING_SPEC §5 |
| `scores.cost_adjusted` | number \| null | Zusammen mit dem Composite **eingestellt**; `null` auf jeder neuen Karte |
| `scores.errors` | number | Fehlgeschlagene Einträge (API-Fehler, Timeout usw.) |
| `scores.by_difficulty` | object | Ergebnisse aufgeschlüsselt nach Schwierigkeitsgrad |
| `scores.by_provenance` | object | Ergebnisse aufgeschlüsselt nach Herkunftskennzeichnung (Provenance Tag) |
| `scores.by_domain` | object | ✅ Implementiert – Ergebnisse aufgeschlüsselt nach Domäne (§2.7). Ermöglicht nach Domänen gefilterte Leaderboard-Rankings. Berechnet durch tester.py und durchgereicht von publish.py. |

### 3.5 Summen (Kosten)

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `totals.prompt_tokens` | number | Gesamtzahl der Eingabe-Token über alle API-Aufrufe |
| `totals.completion_tokens` | number | Gesamtzahl der Ausgabe-Token |
| `totals.reasoning_tokens` | number | Für Chain-of-Thought verwendete Token (0 bei den meisten Modellen) |
| `totals.cached_tokens` | number | Aus dem Prompt-Cache des Anbieters bereitgestellte Token |
| `totals.total_cost_usd` | number | Gesamtkosten in USD |
| `totals.cost_per_entry_usd` | number | `total_cost_usd / entry_count` |
| `totals.cost_per_source_char` | number | USD pro Ausgangszeichen — sprachübergreifend vergleichbar |

### 3.6 Zeitmessung (Geschwindigkeit)

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `elapsed_seconds` | number | Reale Dauer (Wall-Clock) des gesamten Laufs (oberste Ebene) |
| `scores.avg_latency_seconds` | number | Mittlere Antwortzeit pro Eintrag |
| `scores.median_latency_seconds` | number | Median-Antwortzeit pro Eintrag |
| `scores.p95_latency_seconds` | number | 95. Perzentil der Antwortzeit pro Eintrag |

### 3.7 Ergebnisse pro Eintrag

Jeder Eintrag im `results[]`-Array zeichnet eine Übersetzung auf. Die Daten pro Eintrag werden in der `run_card_entries`-Tabelle (Migration 005) mit denormalisierten LYSS-Verdikten (Migration 006) persistiert.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `entry_id` | string | Entspricht `entries[].id` im Korpus |
| `source` | string | Übersetzter Ausgangstext |
| `expected` | string | Goldstandard-Referenzübersetzung |
| `raw_predicted` | string \| null | Rohe Modellausgabe vor der Nachverarbeitung |
| `predicted` | string | Tatsächliche Ausgabe der Methode (nachverarbeitet) |
| `segment` | string | Segmentkennung (z. B. Satzindex) |
| `difficulty` | string \| null | Schwierigkeitsstufe aus dem Korpus |
| `domain` | string | Domänen-Tag aus dem Korpus (§2.7) |
| `exact_match` | boolean | Ob die Ausgabe exakt mit der Referenz übereinstimmte |
| `chrf_score` | number \| null | chrF++ auf Satzebene (0–100) |
| `bleu_score` | number \| null | BLEU auf Satzebene (0–100) |
| `latency_s` | number \| null | Antwortzeit in Sekunden |
| `cost_usd` | number \| null | Kosten in USD für diesen Eintrag |
| `tool_call_count` | integer | Anzahl der verwendeten Werkzeugaufrufe (0, falls keine) |
| `error` | string \| null | Fehlermeldung, falls dieser Eintrag fehlgeschlagen ist |
| `plugin_metrics` | object | Vollständige Plugin-Ausgabe pro Eintrag (JSONB) |
| `fst_valid` | boolean \| null | GiellaLT-FST hat die Vorhersage akzeptiert (denormalisiertes LYSS-fst) |
| `equivalent_match` | boolean \| null | CRK-Linter hat strukturelle Äquivalenz bestätigt (denormalisiertes LYSS-eq) |
| `semantic_verdict` | string \| null | LYSS-sem-Verdikt: `VALID`, `MISMATCH`, `UNKNOWN`, `ERROR` |
| `code_switching_detected` | boolean \| null | Ausgangssprachen-Token in der Ausgabe erkannt |
| `hallucination_detected` | boolean \| null | Erfundener Inhalt in der Ausgabe erkannt |



### 3.8 Fingerprint

Eine Kennung zur Reproduzierbarkeit. Zwei Läufe mit identischen Fingerprints verwendeten dasselbe experimentelle Setup.

Der Fingerprint ist der SHA-256-Hash des kanonischen JSON (sortierte Schlüssel) von:
- `dataset.sha256`
- `model_slug`
- `condition`
- `system_prompt_sha256`
- `temperature`
- `harness_version`
- `batch_size`
- `tools_enabled`

> **Warum 8 Komponenten?** Batch-Größe und Werkzeugaufrufe beeinflussen die Ausgabequalität wesentlich und müssen in die Identität einbezogen werden. Zwei Läufe mit unterschiedlichen Batch-Größen oder unterschiedlichen aktivierten Werkzeugen sind unterschiedliche experimentelle Aufbauten, selbst wenn alle anderen Parameter übereinstimmen.

**Version 2 (Harness 0.2.0 und neuer)** fügt fünf Komponenten hinzu:
- `api_provider`: der Kanal, den der Text durchlaufen hat (OpenRouter, die eigene API eines Anbieters, ein lokaler Endpunkt; die ID einer MT-Engine; für ein Methoden-Plugin `local` unter `--attest-local-transport`, andernfalls `method-plugin`). Plugin- und Engine-Ausführungsprotokolle, die vor dieser Korrektur geschrieben wurden, weisen `openrouter` auf – einen Standardwert, über den sie nie gesendet wurden; publish erfasst auch für diese den korrigierten Wert, was ihre Version-2-Identität ändert – ganz bewusst, da der alte Wert falsch war
- `endpoint_host_sha256`: der SHA-256-Hash des Hosts des Endpunkts, niemals die unverarbeitete URL, die interne Hostnamen oder Zugangsdaten enthalten kann
- `max_tokens`
- `method_version`: die Version der Method Card, andernfalls die Version, die die `method.json` eines Methoden-Plugins deklariert
- `method_sha256`: der Hash des ausgeführten Bundles für eine Methode, die ein Contest-Knoten ausgeführt hat, andernfalls der Hash über die Dateien eines Methoden-Plugins (`method.json` und dessen `.py`-Dateien)

Ein Durchlauf eines **Methoden-Plugins** (`mt-eval run --method <plugin dir>`) fügt zwei weitere hinzu:
- `method_model`: das Modell, das dem Plugin mit `-m/--model` übergeben wurde (das Plugin liest es als `config.method_model` ein), oder `null`, wenn keines angegeben wurde
- `method_dependencies_sha256`: der SHA-256-Hash der `dependencies`-Liste, die im `method.json` des Plugins deklariert ist (kanonisches JSON), oder `null`, wenn es keine deklariert

Ohne diese teilte sich dasselbe Plugin, das auf zwei verschiedenen Modellen ausgeführt wurde, eine einzige Identität. Harness 0.2.0 fügt sie vor der Veröffentlichung hinzu, sodass sich die Identität eines Plugin-Durchlaufs hier einmalig ändert; keine andere Art von Durchlauf ist betroffen.

Ein Durchlauf einer MT-Engine, die ein Modell ausführt, das ihr **übergeben** wird (`mt-eval run --method local-model -m <model>`), fügt ebenfalls zwei hinzu:
- `method_model`: das geladene Modell – seine Hugging-Face-ID oder der Name des Modellverzeichnisses
- `method_model_sha256`: bei einem Verzeichnis der SHA-256-Hash über eine Liste seiner Dateien im `sha256sum`-Stil (eine `<sha256>  <relative path>`-Zeile pro Datei, nach Pfad sortiert, Punkt-Verzeichnisse ausgelassen); bei einer Hugging-Face-ID die geladene Revision

Zwei Modelle durch dieselbe Engine sind zwei verschiedene Experimente. Ein `local-model`-Ausführungsprotokoll, das kein Modell benennt (frühere 0.2.0-Builds übergaben `-m` nicht an die Engine, die dann ein Fallback-Modell ausführte, `Helsinki-NLP/opus-mt-en-es`), kann nicht belegen, wodurch die Zahlen zustande kamen: `mt-eval publish` lehnt es ab und `contest qualify` wird daraus keinen Beleg (Receipt) erstellen.

Unter Version 1 teilte sich dasselbe Modell, das über zwei verschiedene Kanäle aufgerufen wurde, eine Identität. Da eine veröffentlichte Karte unveränderlich ist, wurde die zweite als Duplikat abgelehnt. Die Run Card zeichnet `fingerprint.version` auf. Ein Ausführungsprotokoll aus einem früheren Harness behält Version 1 bei, sodass eine erneute Veröffentlichung die ursprüngliche Identität exakt reproduziert.

Zwei Läufe mit identischen Fingerprints sollten vergleichbare Ergebnisse liefern. Unterschiede sind auf API-Nicht-Determiniertheit (Temperatur > 0) oder anbieterseitige Modellaktualisierungen zurückzuführen.

### 3.9 Run-Card-Hash

Der SHA-256-Hash der gesamten Run-Card-JSON (wobei das Feld `run_card_hash` selbst während des Hashens auf `""` gesetzt wird). Dies ist das Manipulationserkennungssiegel. Wenn sich irgendein Feld ändert, bricht der Hash.

---

## 4. Automatisierte Metriken

Alle Metriken in diesem Abschnitt werden maschinell berechnet. Siehe §1.2.

### 4.1 Metrikdefinitionen

| Metrik | Status | Was gemessen wird | Bereich |
|--------|--------|-------------------|---------|
| **chrF++** | ✅ Implementiert | Zeichen-n-Gramm-F-Score. Arbeitet auf Zeichenebene und ist daher robuster als Metriken auf Wortebene (BLEU) für morphologisch reichhaltige Sprachen, in denen Wörter lang und stark flektiert sind. Berechnet durch sacrebleu. | 0–100 (native Skala). **Die Haupt- und Ranking-Metrik**, veröffentlicht mit ihrem 95%-KI und der sacreBLEU-Signatur. |
| **FST-Akzeptanzrate** | ✅ Implementiert (Diagnose) | Anteil der vorhergesagten Wörter, die vom morphologischen Analysator (GiellaLT HFST) als gültige Formen in der Zielsprache akzeptiert wurden. Ein vom FST akzeptiertes Wort ist ein echtes, strukturell gültiges Wort – keine Halluzination. | 0.0–1.0 |
| **Exakte Übereinstimmung** | ✅ Implementiert (Diagnose) | Anteil der Vorhersagen, die nach Unicode-Normalisierung exakt mit der Referenz übereinstimmen. Streng, aber eindeutig – nützlich als Obergrenzenprüfung. | 0.0–1.0 |
| **Morphologische Genauigkeit** | ✅ Implementiert (Diagnose) | FST-abgeleitet und Lemma-abgeglichen: prüft für jedes vorhergesagte Wort, dessen Stamm in der Referenz vorkommt, ob seine Flexion übereinstimmt. Granularer als die FST-Akzeptanz – ein Wort kann FST-gültig sein, aber die falsche Flexion aufweisen (richtiger Stamm, falsche Zeitform). Erfordert einen FST-Analysator, keinen rechtschreibprüfenden Akzeptor; siehe SCORING_SPEC §2.2. | 0.0–1.0 |
| **Äquivalente Übereinstimmung** | ⚡ Teilweise (Diagnose) | Anteil, der mit einer akzeptablen Variante der Referenz übereinstimmt – unter Berücksichtigung von Wortstellung, dialektalen Unterschieden und orthografischen Konventionen. Derzeit für CRK über `CrkLinterMetric` des CRK-Evaluierungsstandards implementiert (in `eval_standards/crk/`); wird automatisch über die `evalMetrics`-Deklaration der CRK-Sprachkarte geladen. Eine generische Implementierung erfordert ein eintragsspezifisches `variants[]` im Korpus. | 0.0–1.0 |
| **Semantische Bewertung** | ⚡ Teilweise (Diagnose) | Bedeutungserhalt unabhängig von der Oberflächenform. Derzeit für CRK über `CrkSemanticMetric` des CRK-Evaluierungsstandards implementiert (in `eval_standards/crk/`, urteilsgewichteter Proxy). Eine universelle Embedding-basierte Kosinus-Ähnlichkeit ist geplant – siehe SCORING_SPEC §2.3. | 0.0–1.0 |

### 4.2 Die Hauptmetrik und der Standard daneben

Durchläufe werden nach dem Bewertungsstandard `standard/1` bewertet, so wie WMT, FLORES-200 und die AmericasNLP Shared Tasks über MT-Evaluierungen berichten:

- **Eine Haupt- und Ranking-Metrik:** Korpus-chrF++ mit dem 95%-Bootstrap-Konfidenzintervall und der sacreBLEU-Signatur, geschrieben als `chrF++ 47.5 [45.9, 49.0]`.
- **Die anderen Standardmetriken daneben, niemals vermischt:** BLEU, spBLEU, TER und COMET, sofern berechnet (mit der jeweiligen Modell-ID).
- **Separat ausgewiesene Diagnosemetriken:** Exakte Übereinstimmung, FST-Akzeptanz, morphologische Genauigkeit, äquivalente Übereinstimmung, semantische Bewertung, Code-Switching, Halluzination, Terminologie, Schreibstil und jeder Score-Vorbehalt. Sie erklären ein Ergebnis; sie stellen selbst keines dar.
- **Was „besser“ ist, entscheidet ein gepaarter Signifikanztest** auf chrF++ ([Signifikanz](/docs/network/specifications/significance)), nicht der bloße Vergleich zweier Zahlen.

**Die vollständige Definition befindet sich in `SCORING_SPEC.md`** ([Wie Durchläufe bewertet werden](/docs/network/specifications/scoring#how-runs-are-scored)). Der Code des Harness bildet dies in `mt_eval_harness/scoring.py` ab.

> **Warum nicht BLEU als Hauptmetrik?** BLEU arbeitet auf Wortebene und straft morphologische Variationen ab. Bei polysynthetischen Sprachen kann ein einzelnes Wort einen ganzen Teilsatz darstellen – BLEU würde geringfügige Flexionsunterschiede als vollständige Fehlschläge werten. chrF++ bewältigt dies besser, indem es auf Zeichenebene arbeitet. BLEU wird daneben ausgewiesen. Siehe SCORING_SPEC Anhang A.

### 4.3 Der eingestellte Composite-Score

Vor diesem Standard wurden Durchläufe nach einem gewichteten Composite-Score aus chrF++, exakter Übereinstimmung, FST-Akzeptanz, morphologischer Genauigkeit und Verhaltensmetriken eingestuft. Dieser ist **eingestellt**: Neue Karten veröffentlichen `composite: null` und `cost_adjusted: null`. Er konnte manipuliert werden – ein untrainiertes Modell, das für jede Eingabe denselben gültigen Satz auf Nordsamisch wiederholte, erreichte einen Wert von 0,6244 bei einem chrF++ von 5,5 – und eine Mischung von Signalen, die für verschiedene Sprachen Unterschiedliches bedeuten, ist nicht aussagekräftig. Legacy-Karten behalten ihren gespeicherten Composite-Wert und bleiben überprüfbar; siehe [SCORING_SPEC §4](/docs/network/specifications/scoring#4-composite-score).

---

## 5. Qualitätsstufen (eingestellt) {#5-quality-tiers}

**Keine automatische Bewertung trägt eine Qualitätsbezeichnung.** Die Qualitätsstufen (Baseline, Emerging, Functional, Deployable, Fluent), die aus dem Composite-Wert abgeleitet wurden, sind zusammen mit diesem eingestellt: Neue Karten veröffentlichen `quality_tier: null`, und keine Ausgabe gibt eine Stufe aus. Eine Bezeichnung wie „funktional“ bei einer automatischen Bewertung behauptet etwas, das nur Sprechende bestätigen können – und die eingestellten Stufen bezeichneten ein System, das für jede Eingabe denselben Satz wiederholte, als „funktional“. Qualität wird durch menschliche Validierung zertifiziert (§7). Legacy-Karten speichern weiterhin eine Stufe; [SCORING_SPEC §5](/docs/network/specifications/scoring#5-quality-tiers) behält die alten Schwellenwerte lediglich bei, damit diese Karten lesbar bleiben.

---

## 6. Benchmark-Protokoll

Ein **Benchmark** ist die systematische Erzeugung von Run Cards über einen deklarierten Parameterraum auf einem gegebenen Datensatz. Es handelt sich nicht um einen einzelnen Lauf — es ist eine strukturierte Erkundung dessen, wie verschiedene Konfigurationen abschneiden.

### 6.1 Was ein Benchmark erzeugt

Ein Benchmark erzeugt eine **Matrix von Run Cards** — eine für jede Kombination von Parameterwerten. Die Matrix ermöglicht einen facettenreichen Vergleich über:

- **Qualität** – chrF++ mit Konfidenzintervall, die weiteren Standardmetriken und Diagnosemetriken
- **Kosten** – Gesamt- und Pro-Eintrag-Kosten für jede Konfiguration
- **Geschwindigkeit** – Reale Laufzeit (Wall-Clock-Time) und Latenz pro Eintrag

Es gibt keinen einzelnen „Benchmark-Score“. Der Benchmark ist die gesamte Matrix. Verschiedene Interessengruppen achten auf unterschiedliche Facetten: Forschende suchen nach einer signifikanten chrF++-Verbesserung, Bereitstellungsingenieure optimieren die Kosten pro Eintrag, eine Sprachgemeinschaft prüft die Qualität.

### 6.2 Parameterraum

Ein Benchmark deklariert, welche Parameter permutiert werden:

| Achse | Typische Werte | Zweck |
|------|---------------|-------|
| `model` | 4–12 Modelle (Frontier + Mittelklasse + Budget) | Wie sehr zählt die Modellfähigkeit? |
| `temperature` | 0.0, 0.3, 0.7 | Hilft oder schadet die Sampling-Zufälligkeit? |
| `prompt_version` | 2–3 Prompt-Strategien | Wie empfindlich ist die Methode gegenüber dem Prompt-Design? |
| `coaching_config` | mit/ohne Coaching-Daten | Verbessert das Einspeisen linguistischen Wissens die Ausgabe? |
| `tool_config` | mit/ohne FST, mit/ohne Wörterbuch | Verbessern linguistische Werkzeuge die Ausgabe? |

Der vollständige Permutationsraum:
```
runs = |models| × |temperatures| × |prompts| × |coaching| × |tools|
```

Ein typischer anfänglicher Benchmark: 12 Modelle × 3 Temperaturen × 2 Prompts × 2 Coaching = 144 Läufe.

### 6.3 Baselining vs. Methodenevaluierung

Ein Benchmark dient zwei unterschiedlichen Zwecken:

**Baselining** — Kartierung der Landschaft mit naiven Ansätzen. „Was können bestehende Modelle für diese Sprache ohne jegliches sprachspezifisches Engineering leisten?" Dies legt die Messlatte fest. Die Baseline-Matrix sagt Ihnen: welche Modelle am wenigsten halluzinieren, welche Temperaturen die konsistenteste Ausgabe erzeugen, ob Coaching-Daten überhaupt helfen, wo alle Modelle einheitlich versagen (was schwierige linguistische Probleme offenbart).

**Methodenevaluierung** — Testen einer spezifischen konstruierten Methode. „Schlägt meine FST-gesteuerte, gecoachte Pipeline die Baselines?" Die Run Card der Methode wird mit der Baseline-Matrix verglichen. Eine Methode ist interessant, wenn sie die beste Baseline übertrifft — wenn Engineering einen Mehrwert gegenüber naiven Modellaufrufen schafft.

Beide Aktivitäten erzeugen Run Cards mit demselben Schema. Der Unterschied liegt in der Absicht und im Parameterraum: Baselines permutieren über Modelle und Konfigurationen; die Methodenevaluierung testet eine Methode gegen die besten Konfigurationen.

### 6.4 Dev- vs. Goldstandard-Evaluierung

Methodenentwickler iterieren frei gegen die Korpussegmente `development` und `diagnostic`. Dies ist informell — keine Grenzen, keine Einreichungen, keine Beteiligung der Governance. Die Entwicklerin oder der Entwickler lernt, was funktioniert.

Offizielle Leaderboard-Bewertungen stammen ausschließlich aus der `gold_standard`-Evaluierung. Dies ist formell:
1. Die Entwicklerin oder der Entwickler reicht ihre bzw. seine vollständige, ausführbare Methode ein (Code + Konfiguration + Coaching-Daten)
2. Die Governance-Organisation führt sie in einem gesandboxten Harness gegen den geheimen Testsatz aus
3. Es kommen nur Bewertungen zurück

Siehe §8 für den vollständigen Souveränitätsmechanismus.

---

## 7. Menschliche Validierung {#7-human-validation}

Automatisierte Metriken sind Näherungswerte. Menschliche Validierung ist die Grundwahrheit.

### 7.1 Was menschliche Überprüfung erfasst, das Metriken entgeht

- **Morphologisch gültig, aber semantisch falsch** — das FST akzeptiert das Wort, chrF++ ist hoch, aber die Übersetzung bedeutet etwas anderes
- **Kulturell unangemessen** — die Übersetzung ist technisch korrekt, verwendet aber ein Register oder eine Rahmung, die eine Gemeinschaft ablehnen würde
- **Halluzinierte Plausibilität** — die Ausgabe sieht für eine nicht sprachkundige Person wie die Zielsprache aus, ist aber für eine sprachkundige Person Kauderwelsch
- **Akzeptable, aber nicht markierte Variation** — die Ausgabe ist korrekt, aber die automatisierten Metriken markieren sie als falsch, weil sie eine dialektale Variante verwendet, die nicht in der Referenz enthalten ist

### 7.2 Das Validierungstor

Keine Methode kann als praxistauglich bezeichnet werden, ohne dass eine menschliche Validierung bestätigt, dass zweisprachige Sprechende die Ausgabe als brauchbar einstufen. Dies ist keine Formalität – es ist der eigentliche Kern. Die automatisierten Metriken existieren, um das Ausgabevolumen zu reduzieren, das einer menschlichen Überprüfung bedarf. Sie können diese nicht ersetzen.

### 7.3 Protokoll zur Gemeinschaftsüberprüfung

> 🔲 **Geplant**: Die Oberfläche zur Gemeinschaftsüberprüfung ist noch nicht in Betrieb. Dieser Abschnitt beschreibt den beabsichtigten Prozess.

1. Eine Methode wird zur Überprüfung vorgelegt – von ihren Entwicklern oder weil sie die automatischen Schwellenwerte eines Contests erfüllt hat (eine chrF++-Hürde und alle vom Contest deklarierten Diagnose-Gates)
2. Eine Stichprobe von Ausgaben (stratifiziert nach Schwierigkeitsgrad) wird zweisprachigen Sprechenden vorgelegt
3. Die Sprechenden bewerten jede Übersetzung auf einer Skala: **reject** (ablehnen), **gist** (Kernbedeutung verständlich, Formulierung jedoch falsch), **acceptable** (korrekt mit kleineren Mängeln), **excellent** (von einer menschlichen Übersetzung nicht zu unterscheiden)
4. Die Governance-Organisation prüft die aggregierten Bewertungen
5. Akzeptiert die Sprachgemeinschaft die Methode, geht sie in das über, was die deklarierten Preisbedingungen des Contests vorsehen (§8.3), und wird bereitgestellt

Die Überprüfung weist eine Mindestform auf, bevor sie die Stufe **Community Validated**
(§9.4) verleihen kann: Die geschichtete Stichprobe umfasst **mindestens 30 Einträge**, **mindestens 2
Prüfer** — beide gemäß dem eigenen Protokoll der Community qualifiziert — und **mindestens 70 %**
der Einträge müssen die Akzeptanzschwelle der Community erfüllen. Die Stufe wird
ausschließlich durch die Community verliehen, die die Läufe selbst nach eigenem Ermessen testet,
und die Herabstufung ist symmetrisch: Dasselbe Protokoll, das als Stichprobenprüfung durchgeführt wird, entzieht die Stufe
ebenso öffentlich, wie sie verliehen wurde.

---

## 8. Souveränität

Evaluierungsdatensätze enthalten kuratiertes linguistisches Wissen, das der Sprachgemeinschaft gehört. Dieser Abschnitt definiert den technischen und rechtlichen Rahmen zum Schutz dieser Daten.

### 8.1 Das Problem

Herkömmliche Benchmarks veröffentlichen Testsätze offen. Einmal veröffentlicht, können die Daten nicht wieder zurückgezogen werden. Für indigene und Minderheitensprachgemeinschaften schafft dies eine extraktive Dynamik — linguistische Daten werden ohne fortlaufende Zustimmung verwendet. Der pragmatischen Sicht Dheins auf die Souveränität von Biodaten folgend, behandeln wir linguistische Daten als eine „unbeständige Ressource mit unabsehbarem Potenzial", die eine dynamische, beziehungsorientierte Governance erfordert.

### 8.2 Gesandboxte Ausführung

Der primäre Durchsetzungsmechanismus: Die Entwicklerin oder der Entwickler übergibt ihr bzw. sein Methodenmodul, die Governance-Organisation führt es gegen den vollständig geheimen Testsatz auf ihrer eigenen Infrastruktur aus, und es werden nur Bewertungen zurückgegeben. Die Entwicklerin oder der Entwickler sieht niemals die Ausgangssätze oder die Referenzübersetzungen.

```mermaid
graph TD
    A["Developer builds method\nusing public development corpus"] --> B["Developer submits\nmethod module\n(code + config + coaching)"]
    B --> C["Governance org runs method\nin sandboxed harness\nagainst secret test set"]
    C --> D["Scores returned\nto developer"]
    D --> E{"Meets the contest's\nchrF++ bar and gates?"}
    E -->|Yes| F["Community review\n+ the contest's declared terms"]
    E -->|No| G["Developer iterates"]
    G --> A
```

Der Ablauf:
1. **Das Entwicklungskorpus ist öffentlich.** Keine Einschränkungen für die Segmente `development` und `diagnostic`.
2. **Das Goldstandard-Testset ist streng geheim.** Sowohl Ausgangssätze als auch Referenzübersetzungen verbleiben auf einer von der Governance kontrollierten Infrastruktur.
3. **Um eine offizielle Bewertung zu erhalten, übergeben Sie Ihre Methode.** Die Governance-Organisation führt sie in einer Sandbox aus. Es werden ausschließlich die Bewertungsergebnisse zurückgegeben.
4. **Die Governance-Organisation besitzt die Methode bereits.** Die Einreichung IST das Modell oder die Methode; dieser Besitz macht eine souveräne Bewertung überhaupt erst möglich. Was danach damit geschieht, bestimmen die deklarierten Preisbedingungen des Contests (§8.3).
5. **Die Einreichung erfordert die Zustimmung zu den Bedingungen.** Die Bedingungen für die Methodeneinreichung gelten immer, und – sofern der Contest Preisbedingungen festlegt – eine explizite Annahme dieser Bedingungen per Hash (§8.3).
6. **Die Governance-Organisation kontrolliert den Zugriff vollständig.** Sie kann die Evaluierung jederzeit verweigern oder widerrufen. Dynamische Einwilligung (Dynamic Consent).
7. **Verschlüsselung im Ruhezustand (Encryption at rest) dient der mehrschichtigen Absicherung (Defense-in-Depth).** Die primäre Durchsetzung erfolgt architektonisch.

### 8.3 Was anschließend mit einer Methode geschieht {#8-3-method-transfer}

Ein Punkt ist struktureller Natur und nicht verhandelbar: Eine souveräne Evaluierung bedeutet, dass sich das Ausgeführte im **physischen Besitz der Governance-Organisation** befindet – das Modell oder die Methode hat deren Knotenpunkt erreicht, um überhaupt bewertet werden zu können. Alles, was über diesen Besitz hinausgeht, richtet sich nach den **deklarierten Preisbedingungen des Contests**, die vom Veranstalter festgelegt und vor der Teilnahme veröffentlicht werden.

Diese Bedingung ist eine von drei Optionen, die pro Contest festgelegt werden: `pass_to_holders` (die Methode geht an die souveränen Benchmark-Inhaber über, die sie bewerten und in jedem Fall behalten), `retain_ip` (die entwickelnde Partei behält das Eigentum; der Host behält höchstens eine versiegelte Kopie für Auditzwecke) oder `release_open` (die entwickelnde Partei behält das Eigentum, muss die Methode jedoch unter einer offenen Lizenz veröffentlichen, wobei diese Veröffentlichung die Bedingung für den Preis darstellt). Was die einzelnen Optionen im Detail bedeuten – was einbehalten wird, ob Rechte übertragen werden, wofür der Host sie nutzen darf, wann eine Veröffentlichung fällig ist –, leitet sich aus der Option ab; wie jede Option vor einer Auszahlung verifiziert wird, ist in der [Preis-Spezifikation §1.3](/docs/network/specifications/prizes#1-3-declared-terms) beschrieben. Ein Contest, der keine Preisbedingungen festlegt, vergibt keinen Preis, und es werden keinerlei Rechte an der Einreichung übertragen.

**In jedem Fall behält der Entwickler:**
- Namensnennung und Anerkennung (der Name verbleibt auf dem Leaderboard)
- Das Recht, Veröffentlichungen über die Methode zu verfassen
- Das Recht, die Methode für andere Sprachpaare zu nutzen

**Was die Governance-Organisation erhält**, entspricht exakt den von ihr deklarierten Bedingungen – dies reicht von „nichts; das Artefakt wurde nach der Bewertung gelöscht“ bis hin zu einer vollständigen Rechteübertragung mit dem Recht, die Methode für ihre Sprache zu nutzen, zu modifizieren, zu verbreiten, zu monetarisieren und unterzulizenzieren. Das Erreichen der vom Contest festgelegten Schwellenwerte (eine chrF++-Hürde und eventuelle Diagnose-Gates) bei der Goldstandard-Evaluierung sowie das Bestehen der menschlichen Validierung (§7) machen eine Methode *preisberechtigt*; dies allein überträgt noch keine Rechte.

### 8.4 Anforderungen an die Governance-Organisation

Um als Schlüsselverwahrer für einen Sprach-Benchmark zu dienen:

1. **Die Sprachgemeinschaft vertreten** – nachweisbare Beziehung zu Sprechenden und kulturellen Instanzen
2. **Fähigkeit zum Schlüsselmanagement** – technische Kompetenz zur Verwaltung kryptografischer Schlüssel
3. **Zusicherung der Evaluierungsverfügbarkeit** – der Benchmark muss evaluierbar bleiben
4. **Teilnahmebedingungen veröffentlichen** – transparente Dokumentation dessen, worauf sich Entwickler einlassen
5. **Handeln nach anerkannten Datensouveränitätsprinzipien** – Eigentum und Kontrolle der Sprachgemeinschaft über die Sprachdaten, CARE oder gleichwertige Standards

### 8.5 Berücksichtigung von Datensouveränitäts- und CARE-Prinzipien

**Was die Sprachgemeinschaft innehat.** Die Sprachdaten gehören der Gemeinschaft,
und die Governance-Organisation betreibt die Evaluierungsinfrastruktur, auf der sie
gemessen werden. Diese Organisation entscheidet, wer zu welchen Bedingungen einreichen
darf, und die Ausführung in einer Sandbox sorgt dafür, dass diese Entscheidung
*durchgesetzt* und nicht bloß formuliert wird. Die Gemeinschaft hat uneingeschränkten
Zugriff auf ihre eigenen Daten, auf die Ergebnisse und auf die Methoden, die auf
dieser Grundlage entwickelt wurden. Das versiegelte Testset verlässt niemals die
eigene Infrastruktur der Governance-Organisation; die Verschlüsselung im Ruhezustand
stellt die zweite Absicherungslinie dar.

**CARE-Prinzipien.**

| Prinzip | Umsetzung |
|---------|-----------|
| **Kollektiver Nutzen (Collective Benefit)** | Der Veranstalter legt die Preisbedingungen fest. Eine Gemeinschaft, die verlangt, dass Einreichungen ihr zugutekommen, kann genau dies einfordern – und behält die Methode sowie alle daraus resultierenden Erträge; die Plattform behält in keinem Fall Anteile ein. |
| **Kontrollbefugnis (Authority to Control)** | Die Ausführung in einer Sandbox ist die technische Umsetzung hiervon. |
| **Verantwortung (Responsibility)** | Entwickler übernehmen Verantwortung durch die Zustimmung zu den Teilnahmebedingungen. |
| **Ethik (Ethics)** | Rechte der Sprachgemeinschaft stehen über der Bequemlichkeit der Forschenden. |

### 8.6 Abhängigkeitsklassen und die Sandbox-Netzwerkrichtlinie

Gesandboxte Ausführung (§8.2) und Eigentumsübertragung (§8.3) hängen beide davon ab, genau zu wissen, was eine Methode zur Laufzeit benötigt. Die [Method-Interface-Spezifikation](/docs/network/specifications/methods#method-validity-and-dependency-classes) definiert fünf **Abhängigkeitsklassen** — S (self-contained), O (open external), A1 (substituierbare LLM-Inferenz), A2 (nicht substituierbare externe API), X (closed) — sowie das Abhängigkeitsmanifest, das jede Methode deklarieren muss. Dieser Unterabschnitt hält fest, wie die Sandbox-Netzwerkrichtlinie sie durchsetzt.

**Standardmäßiges Verweigern des Egress.** Die Sandbox-Spezifikation verlangt, dass Methoden-Container standardmäßig keinen Netzwerkzugriff haben. Dies ist keine Firewall-Regel — die Spezifikation entfernt das Netzwerk aus der Ausführungsumgebung, sodass eine nicht deklarierte Netzwerkabhängigkeit auf der Architekturebene fehlschlägt, nicht auf der Richtlinienebene. Methoden der Klasse S und O laufen vollständig aus Artefakten, die in die Einreichung eingebettet (vendored) sind (Artefakte der Klasse O werden zum Einreichungszeitpunkt gepinnt und gespiegelt).

**Das LLM-Gateway (🔲 geplant).** Die meisten Methoden rufen LLMs auf, daher definiert die Sandbox-Spezifikation genau eine Egress-Ausnahme: ein **LLM-Gateway**, das von der Evaluierungsinfrastruktur betrieben wird. Das Gateway:

- leitet Inferenzanfragen per Proxy an eine **explizite Allowlist festgelegter (gepinnter) Modelle** weiter – die Modellkennungen, die im Manifest und in der Run Card der Methode erfasst sind;
- **protokolliert jede Anfrage und Antwort** im manipulationssicheren, hash-verketteten Audit-Protokoll (Append-only), damit der Gateway-Datenverkehr vor der Freigabe von Ergebnissen auf Versuche zur Datenexfiltration überprüft werden kann;
- bildet den *einzigen* Netzwerkpfad – es gibt keinen allgemeinen ausgehenden Datenverkehr (Egress), kein DNS und keine weiteren Endpunkte.

Dies ist es, was Methoden der Klasse A1 evaluierbar macht, ohne die Verifizierbarkeitsgarantien von §8.2 aufzugeben — aber es ist ein echter Kompromiss, und die Spezifikation benennt ihn klar: Das Übersetzen eines geheimen Ausgangssatzes durch ein externes Modell **offenbart diesen Ausgangssatz gegenüber dem Modellanbieter**. Referenzübersetzungen verlassen niemals das System (sie werden vom Harness außerhalb des Containers verwahrt; siehe §8.2), und die Methode selbst kann nach wie vor nichts über das hinaus exfiltrieren, was die protokollierten, in der Allowlist enthaltenen Inferenzaufrufe beinhalten. Ob diese begrenzte Offenlegung für ein bestimmtes Korpus akzeptabel ist, ist eine Entscheidung des Verwahrers: Die Autorisierung einer Evaluierung der Klasse A1 bedeutet, sie wissentlich zu autorisieren, pro Lauf, wie jede andere Nutzung der Daten.

**Status.** Die netzwerkisolierte Methoden-Ausführungs-**Sandbox ist implementiert** für von Veranstaltern durchgeführte Contests (veröffentlicht am 08.07.2026; siehe [Ehrliche Einschränkungen](/docs/network/honest-limitations) für Details darüber, was bereits realisiert wurde und was nicht). Das **LLM-Gateway ist spezifiziert, aber noch nicht gebaut.** Bis das Gateway betriebsbereit ist, können nur Methoden der Klassen S und O Goldstandard-Bewertungen generieren; Methoden der Klasse A1 bleiben im Prinzip preisberechtigt (siehe [Preis-Spezifikation §1.6](/docs/network/specifications/prizes)), können jedoch noch nicht anhand geheimer Segmente evaluiert werden. Abhängigkeiten der Klasse A2 können die Sandbox überhaupt nicht betreten, solange der Rechteinhaber keine Genehmigung erteilt hat – das Artefakt muss in der Sandbox überhaupt *existieren* dürfen, bevor sich Netzwerkfragen stellen.

---

## 9. Leaderboard & Einreichung

### 9.1 Einreichungsanforderungen

Eine gültige **Leaderboard**-Einreichung ist eine vollständige Run Card (§3) mit allen
erforderlichen Feldern und einer auflösbaren Datensatz-Referenz. Das ist alles, was
`mt-eval publish` sendet, und Ihr Code bleibt in Ihrem Besitz.

Ein **souveräner** Eintrag (`gold_standard`) ist etwas anderes – es handelt sich um das Modell
oder die Methode selbst, und er muss Folgendes umfassen:

1. Den Methodencode – vollständig ausführbar, mit Installationsanweisungen – oder das
   Modell in Form deklarativer Gewichte
2. Sämtliche Abhängigkeiten, vendored – Trainingsdaten (Coaching Data), Wörterbücher, FST-Binärdateien, Prompts
3. Einen Kostenbericht
4. Eine Beschreibung des methodischen Ansatzes und der Einschränkungen

Siehe §9.5 und den [Leitfaden für souveräne Contests](/docs/network/sovereignty/run-a-sovereign-contest).

### 9.2 Legitimitätskriterien

1. **Kein Training mit Evaluierungsdaten.** Methoden dürfen nicht mit `gold_standard`- oder `held_out`-Einträgen in Kontakt gekommen sein. (Architektonisch durchgesetzt — man kann nicht mit Daten trainieren, die man nie gesehen hat.)
2. **Nutzung von Entwicklungsdaten deklarieren.** Die Verwendung von `development`-Einträgen für Few-Shot-Prompting ist erlaubt, muss aber deklariert werden.
3. **Reproduzierbarkeit.** Die Governance-Organisation muss in der Lage sein, den Lauf zu wiederholen und Bewertungen innerhalb von ±2 % zu erreichen.
4. **Generalisierung.** Methoden müssen bei ungesehenen Einträgen funktionieren, nicht nur bei auswendig gelernten Beispielen.

### 9.3 Anti-Gaming

1. **Variantenklassen-Linting** — verdächtig perfekte Leistung bei Einträgen mit bekannten Varianten wird gekennzeichnet
2. **Korpusrotation** — die Governance-Organisation kann Einträge ohne Vorankündigung zwischen Segmenten rotieren
3. **Gemeinschaftsüberprüfung** — das menschliche Validierungstor (§7) erfasst Methoden, die Metriken austricksen, aber schlechte Ausgaben produzieren

### 9.4 Verifizierungsstufen

Verifizierungsstufen beschreiben, **wer das Ergebnis validiert hat**. (Sie stehen in keinem Zusammenhang mit den eingestellten Qualitätsstufen, §5.)

| Stufe | Bedeutung | Erreichung |
|-------|-----------|------------|
| **Self-benchmarked** | Entwickler hat das Harness ausgeführt und die Run Card eingereicht | `mt-eval publish` für das `development`-Segment |
| **Champollion Verified** | Das Projekt hat Ihre eingereichten Ausgaben anhand des SHA-gepinnten Referenzkorpus neu bewertet und Ihr Ergebnis reproduziert | Veröffentlichen Sie eine Run Card; der Re-Score-Batch der Maintainer stuft sie hoch, sobald das Ergebnis reproduziert werden kann. Das erneute *Ausführen* der Methode ist eine separate Ebene, die noch nicht implementiert ist |
| **Community Validated** | Zweisprachige Sprechende der Zielsprache, qualifiziert nach dem Protokoll der Gemeinschaft, haben eine stratifizierte Stichprobe der Ausgabe geprüft (≥30 Einträge, ≥2 Prüfende) und ≥70 % entsprachen den Anforderungen der Gemeinschaft. Wird ausschließlich durch eigene Tests der Gemeinschaft verliehen; eine Abstufung durch Stichproben-Audits erfolgt symmetrisch | Reichen Sie den Methodencode bei der Governance-Organisation ein (§8.2); diese führt ihn gegen `gold_standard` aus und die Ausgabe besteht die menschliche Validierung (§7) |


### 9.5 Geschichtetes Einreichungsmodell

Der Einreichungsmechanismus hängt davon ab, gegen welches Korpussegment Sie evaluieren:

| Segment | Einreichungsweg | Verifizierung | Methodencode erforderlich? |
|---------|-----------------|---------------|----------------------------|
| `development` | Self-Service: Harness ausführen, Run Card mit `mt-eval publish` veröffentlichen | Self-benchmarked | Nein – Sie behalten Ihren Code |
| `development` | Der Re-Score-Batch der Maintainer leitet Ihre Bewertung aus den eingereichten Ausgaben anhand des SHA-gepinnten Korpus erneut ab | Champollion Verified | Nein – Ausgaben werden neu bewertet, die Methode wird nicht erneut ausgeführt |
| `gold_standard` | Modell oder Methode an die Governance-Organisation übergeben; deren Knoten führt sie aus | Champollion Verified (vom Knoten bewertet). **Community Validated** nur dann, wenn die Gemeinschaft anschließend eine eigene Überprüfung durchführt (§7) – bislang hat eine solche Überprüfung noch nicht stattgefunden | Ja – der Eintrag wird eingereicht und für die Ausführung einbehalten |

Der Self-Service-Pfad (Entwicklungssegment) unterliegt keinen Einschränkungen. Der souveräne Pfad (Goldstandard-Segment) erfordert die vollständige Einreichung der Methode, da der Entwickler das Testset niemals zu Gesicht bekommt: Der einzige Weg zu einer Bewertung besteht darin, dass der eigene Knoten der Governance-Organisation die Methode ausführt. Was die Organisation anschließend damit tun darf, wird durch die deklarierten Preisbedingungen des Contests festgelegt (§8.3).

### 9.6 Methodenklassen

Methoden werden nach Typ klassifiziert. Das kanonische Enum ist in der Harness-Codebasis definiert (`VALID_METHOD_CLASSES` in `config.py`):

| Klasse | Beschreibung |
|-------|-------------|
| `raw-llm` | Direkter LLM-Aufruf ohne sprachspezifisches Engineering |
| `coached-llm` | LLM mit Coaching-Daten (Beispiele, Grammatiknotizen, Wörterbucheinträge) |
| `pipeline` | Mehrstufige Pipeline (z. B. übersetzen → FST validieren → wiederholen) |
| `custom-plugin` | Benutzerdefiniertes `TranslationMethod`-Plugin |
| `api` | Externe Übersetzungs-API (Google Translate, DeepL usw.) |
| `human` | Menschliche Übersetzer-Baseline |

### 9.7 Leaderboard-Felder

| Feld | Beschreibung |
|------|--------------|
| Rang | Position nach chrF++ auf diesem Evaluierungsset |
| Methodenname | Vom Entwickler gewählte Kennung |
| chrF++ | Die Hauptmetrik: Korpus-chrF++ (0–100) mit 95%-KI und sacreBLEU-Signatur (§4.2) |
| BLEU / spBLEU / TER / COMET | Standardmetriken neben der Hauptmetrik (COMET, sofern berechnet, mit Modell-ID) |
| FST-Akzeptanz | Diagnose: morphologische Validitätsrate (0.0–1.0) |
| Exakte Übereinstimmung | Diagnose: strikte Übereinstimmungsrate (0.0–1.0) |
| Semantische Bewertung | Diagnose: Bedeutungserhalt (0.0–1.0) – 🔲 sobald verfügbar |
| Score-Vorbehalte | Neben der Hauptmetrik angezeigt, falls zutreffend |
| Kosten pro Eintrag | USD pro Korpuseintrag |
| Geschwindigkeit | Durchschn. Latenz pro Eintrag (Sekunden) |
| Methodenklasse | Aus dem Enum in §9.6 |
| Modell | Verwendetes LLM / verwendete Engine |
| Verifizierungsstufe | Wer validiert hat (§9.4) |
| Datum | Zeitpunkt der Evaluierung |

> [!NOTE]
> **Alle auf dem Leaderboard angezeigten Bewertungen sind automatisierte Näherungsmessungen.** Sie zeigen die relative Methodenleistung unter kontrollierten Bedingungen an, stellen aber keine Qualitätsgarantien dar. Gemeinschaftsvalidierte Methoden werden separat über die Spalte der Verifizierungsstufe gekennzeichnet. Für Methodikdetails siehe [SCORING_SPEC.md](/docs/network/specifications/scoring).

---

## 10. Kostenrahmen {#10-cost-framework}

### 10.1 Kosten pro Lauf

```
run_cost = entries × api_calls_per_entry × cost_per_api_call
```

Typische Kosten pro Lauf für ein Korpus mit 150 Einträgen:

| Methode | Modell | Geschätzte Kosten |
|--------|-------|---------------|
| Naives LLM | Gemini 2.5 Flash | 0,15–0,30 $ |
| Gecoachtes LLM | Gemini 2.5 Flash | 0,30–0,60 $ |
| FST-gesteuert (3 Wiederholungen) | Gemini 2.5 Flash | 0,45–1,20 $ |
| Naives LLM | Claude Sonnet 4 | 0,45–0,90 $ |
| Gecoachtes LLM | GPT-4.1 | 0,60–1,50 $ |

### 10.2 Benchmark-(Sweep-)Kosten

```
sweep_cost = Σ run_cost(i)   for each parameter combination i
```

Typischer Sweep: 12 Modelle × 3 Temperaturen × 2 Prompts × 2 Coaching = 144 Läufe bei ~0,50 $ Durchschnitt = **~72 $ pro Sweep**.

### 10.3 Etablierung pro Sprache

| Komponente | Kostenbereich | Anmerkungen |
|-----------|-----------|-------|
| Vergütung der Sprecher (Korpus) | 2.500–6.000 $ | 50–150 Einträge zu 50–65 $/Std. |
| Vergütung der Sprecher (Überprüfung) | 500–1.500 $ | Überprüfung der Methodenausgabe |
| Rechenleistung (Benchmark-Sweeps) | 100–500 $ | Mehrere Sweeps während der Entwicklung |
| Rechenleistung (laufendes Leaderboard) | 50–200 $/Jahr | Ausführung eingereichter Methoden |
| Infrastruktur (Sandbox) | 200–500 $/Jahr | Eval-Infrastruktur der Governance-Organisation |
| **Etablierung insgesamt** | **3.350–8.500 $** | |

### 10.4 Programmumfang

| Umfang | Jährliche Kosten | Anmerkungen |
|-------|------------|-------|
| 1 Sprache (Wartung) | 1.000–3.000 $ | Nach der Etablierung |
| 5 Sprachen (Etablierung + Wartung) | 25.000–65.000 $ | Erstes Jahr |
| 10 Sprachen (stationärer Zustand) | 15.000–40.000 $ | Pro Jahr nach der Etablierung |

---

## 11. Erweiterung auf neue Sprachen {#11-extending-to-new-languages}

### 11.1 Mindestanforderungen

1. **50+ Einträge** im `gold_standard`-Segment
2. **30+ Einträge** im `development`-Segment
3. **10+ Einträge** im `diagnostic`-Segment, die auf spezifische linguistische Phänomene abzielen
4. **Provenienz** für jeden Eintrag
5. **Schwierigkeitsverteilung** — mindestens 3 von 5 Stufen
6. **Registerverteilung** — mindestens 2 Register
7. **Gemeinschaftszustimmung** — dokumentierte Vereinbarung der Sprachgemeinschaft

### 11.2 Optional, aber wertvoll

- **Morphologischer FST-Analysator** – ermöglicht die aussagekräftigste Metrik für polysynthetische Sprachen
- **Zweisprachiges Wörterbuch** – ermöglicht wörterbuchbasierte Methoden, reduziert Halluzinationen
- **Morphologische Goldstandard-Analyse** – ermöglicht die Metrik für morphologische Genauigkeit
- **Variantenklassen** – ermöglichen die Metrik für äquivalente Übereinstimmung und Linting gegen Manipulationen
- **Governance-Organisation** – ermöglicht kryptografische Souveränität und legt die Preisbedingungen fest

### 11.3 Der agentengestützte Pfad

> 🔲 **Geplant**: Die agentengestützte Korpuserstellung ist eine zukünftige Fähigkeit.

Für Sprachen ohne umfangreiche bestehende Ressourcen:

1. Ein Agent generiert Kandidaten-Ausgangssätze über Schwierigkeitsstufen und Register hinweg
2. Eine zweisprachige Person übersetzt sie (dieser Schritt erfolgt stets durch Menschen)
3. Der Agent schlägt eine morphologische Analyse vor (validiert durch FST, falls verfügbar, andernfalls durch die sprechende Person)
4. Der Agent formatiert alles in das Korpusschema
5. Eine Linguistin bzw. ein Linguist oder eine sprechende Person überprüft das endgültige Korpus

Dies reduziert die Sprecherzeit von ~80 Stunden auf ~30–40 Stunden pro Sprache.

---

*Diese Spezifikation ist ein lebendiges Dokument. Während wir Benchmarks für weitere Sprachen etablieren, werden wir lernen, was funktioniert, und entsprechend nachbessern. Das Ziel ist, streng genug zu sein, um glaubwürdig zu sein, flexibel genug, um nützlich zu sein, und offen genug, dass jeder teilnehmen kann — zu den Bedingungen der Gemeinschaft.*
