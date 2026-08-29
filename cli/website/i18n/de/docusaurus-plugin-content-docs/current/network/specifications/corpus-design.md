---
sidebar_position: 7
title: "Corpus Design Framework"
---

# Framework für das Design von Evaluationskorpora

Wenn Sie ein Frontier-Modell auf FLORES+ evaluieren und es einen chrF++-Wert von 85 erzielt, können Sie nicht unterscheiden, ob „das Modell gut im Übersetzen ist“ oder „das Modell diese spezifischen Satzpaare auswendig gelernt hat“. Genau diese Mehrdeutigkeit ist der Grund für die Existenz dieses Frameworks: Der Aufbau eines Evaluierungskorpus lohnt sich nur, wenn seine Ergebnisse das bedeuten, was sie vorgeben, und das erfordert ein bewusstes Design — neue Satzpaare, nachverfolgbare Herkunft, stratifizierte Domänen, abgestufte Schwierigkeitsgrade. Diese Seite ist die maßgebliche Quelle dafür, wie Champollion-Evaluierungsdatensätze entworfen, erstellt und gepflegt werden.

> **Version:** 1.0 · **Status:** Entwurf · Begleitdokument: Der
> [Korpus-Partnerschaft](/docs/network/specifications/corpus-partnership)
> -Workflow setzt diese Methodik in Zusammenarbeit mit einer Forschungsabteilung in die Praxis um.

---

## 1. Designprinzipien

### 1.1 — Warum keine öffentlichen Benchmarks?

Öffentliche Parallelkorpora (FLORES+, Tatoeba, WMT-Testsätze, OPUS) stehen für Entwicklung und Debugging zur Verfügung, sind jedoch **von der offiziellen Leaderboard-Evaluation ausgeschlossen**. Der Grund ist einfach:

**Kontamination.** Frontier-LLMs werden mit enormen Mengen an Web-Scraping-Daten trainiert. Jeder parallele Text, der öffentlich existiert hat — insbesondere in kuratierten, häufig zitierten Benchmark-Datensätzen —, befindet sich wahrscheinlich in ihren Trainingsdaten. Dies ist kein theoretisches Problem — [die Forschung hat](https://arxiv.org/abs/2311.04850) messbare Kontaminationseffekte bei MT-Benchmarks nachgewiesen. (Öffentliche Benchmarks werden hier zwar weiterhin ausgeführt — jedoch nur in einem Bereich für *relative Vergleiche*, der Methoden in eine Rangfolge zueinander setzen kann, niemals als absolutes Qualitätsmaß.)

Für Champollion ist dies von akuter Bedeutung, weil:
- Das Leaderboard LLM-Methoden, klassische MT-Dienste und speziell entwickelte Systeme direkt miteinander vergleicht
- Unser Wertversprechen eine *ehrliche, rigorose Evaluierung* ist
- Unsere Zielnutzer (Sprachgemeinschaften) Bereitstellungsentscheidungen auf der Grundlage dieser Ergebnisse treffen

### 1.2 — Grundanforderungen

Jedes Champollion-Evaluationskorpus muss folgende Bedingungen erfüllen:

| Anforderung | Begründung |
|-------------|-----------|
| **Von Menschen verfasst** | Keine synthetischen Daten. Sämtlicher Ausgangstext und alle Referenzübersetzungen müssen von Menschen geschrieben werden. LLMs dürfen bei Ausrichtung und Formatierung unterstützen, jedoch niemals Inhalte generieren. |
| **Nicht öffentlich in paralleler Form verfügbar** | Der Ausgangstext darf öffentlich sein; die Referenzübersetzungen dürfen öffentlich sein; aber die spezifische *Paarung* darf nicht als herunterladbares Parallelkorpus existieren. |
| **Nachverfolgte Herkunft** | Jeder Eintrag muss eine dokumentierte Herkunft besitzen: Ausgangsdokument, Übersetzer, Lizenz, Datum. |
| **Linguistisch fundiert** | Die Abdeckung muss sich an typologischen Merkmalen orientieren, nicht an Zufallsstichproben. |
| **Domänenstratifiziert** | Einträge müssen definierte Textdomänen mit kontrollierter Repräsentation abdecken. |
| **Schwierigkeitsgestuft** | Einträge müssen auf Basis der strukturellen Komplexität Schwierigkeitsstufen (1–5) zugewiesen werden. |
| **Versionskontrolliert** | Korpusversionen werden inhaltsbasiert gehasht. Werte sind nur innerhalb derselben Version vergleichbar. |
| **Von der Gemeinschaft überprüfbar** | Referenzübersetzungen müssen von Mitgliedern der Sprachgemeinschaft überprüfbar sein. |

### 1.3 — Neutralität bezüglich Korpustyp, Länge und Stil

Champollion ist ein offener Hub zur Übersetzungsevaluation, der **neutral gegenüber der Frage ist, was eine Übersetzungseinheit ausmacht**. Ein Korpuseintrag ist Text beliebiger Länge — ein einzelner kurzer Satz, ein langer mehrgliedriger Satz, ein Absatz oder ein ganzes Dokument — und die Plattform evaluiert sie alle auf dieselbe Weise. **Es besteht keine Beschränkung auf kurzen oder einfachen Text.** Das Harness erlegt keine Längenobergrenze auf (es setzt bewusst großzügigen Spielraum bei den Output-Tokens, um lange Übersetzungen nicht abzuschneiden); Schwierigkeitsstufen (§3) und Domänen (§2.1) sind *konfigurierbare Achsen*, keine Filter, die schwieriges oder langes Material ausschließen.

Der Hub ist neutral und konfigurierbar in folgenden Dimensionen:

| Achse | Bereich |
|------|-------|
| **Granularität** | Satz · langformatiger Satz · Absatz · Dokument (`sizeUnit: entries \| sentences \| segments \| documents`) |
| **Länge & Komplexität** | kurz → lang; einfach → hochkomplex (Schwierigkeitsstufen 1–5) |
| **Stil & Register** | formell, informell, technisch, literarisch, umgangssprachlich, administrativ (Domänentaxonomie, §2.1) |
| **Methode** | beliebige `TranslationMethod` — LLM, neuronales NMT, regelbasiert, hybrid, menschlich |
| **Sprache & Paar** | beliebiges gerichtetes Paar; keine eingebaute Verzerrung zugunsten ressourcenreicher Sprachen |

Ein Korpus deklariert seinen eigenen Typ, seine Granularität, sein Register und seine Schwierigkeit in seiner Card, und das Harness respektiert, was die Card deklariert. Die standardmäßigen, aus Tatoeba stammenden **Entwicklungskorpora** bestehen aus kurzen Sätzen, weil Tatoeba so beschaffen ist — das ist eine Eigenschaft dieser Ausgangskorpora, **nicht** eine Beschränkung der Plattform. Evaluationssätze auf Dokumentebene und im Langformat sind vollwertig; registrieren Sie sie auf dieselbe Weise (und konfigurieren Sie z. B. für sehr lange Einträge eine kleinere Request-Batch).

---

## 2. Auswahl des Ausgangstextes

### 2.1 — Domänentaxonomie

Champollion evaluiert Übersetzung für **praktische Bereitstellungskontexte**, nicht für akademische Übungen. Jeder Korpuseintrag wird mit einer Domäne aus der **kanonischen Domänentaxonomie mit 16 Codes** versehen, die zum Zeitpunkt der Erstellung validiert wird.

Die Taxonomie ist einmalig definiert — in [Benchmark-Spezifikation §2.7](/docs/network/specifications/benchmark#27-domain), der einzigen maßgeblichen Referenz — und wird hier nicht erneut aufgeführt, um Abweichungen zu vermeiden. Die Codes lauten: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech` und `ui`. Siehe §2.7 für die Beschreibung jedes Codes und die typischen Abnehmer. Führen Sie keine Domänencodes außerhalb dieses Satzes ein.

### 2.2 — Domänenverteilung

Ein Standard-Evaluationskorpus sollte eine Streuung über die Domänen anstreben, die für die Zielgemeinschaft am relevantesten sind. Die genauen Codes und Prozentsätze variieren je nach Sprachpaar; die folgende Tabelle ist eine *illustrative* Zielverteilung unter Verwendung der kanonischen Codes aus §2.1:

| Domäne | Code | Ziel-% | Begründung |
|--------|------|----------|-----------|
| Software-UI | `ui` | 25 % | Primärer Bereitstellungskontext für Nutzer der champollion CLI |
| Behörden / Verwaltung | `gov` | 15 % | Übersetzung mit hohem Risiko und rechtlichen Implikationen |
| Bildung | `edu` | 15 % | Kernanwendungsfall für die Sprachrevitalisierung |
| Literarisch / erzählend | `literary` | 10 % | Testet kulturelle Nuancen und literarisches Register |
| Umgangssprachlich | `conv` | 10 % | Testet informelles Register und natürliche Sprachmuster |
| Technisch | `tech` | 10 % | Testet Präzision und Terminologiekonsistenz |
| Medizin / Gesundheit | `medical` | 10 % | Hohes Risiko, testet domänenspezifisches Vokabular |
| Nachrichten / Journalismus | `news` | 5 % | Testet zeitgenössisches Vokabular und neutrales Register |

### 2.3 — Kriterien für die Auswahl des Ausgangstextes

Bei der Auswahl von Ausgangstexten für ein neues Korpus:

1. **Lizenzkompatibilität.** Der Ausgangstext muss unter einer Lizenz stehen, die die Verwendung in einem Evaluationskorpus erlaubt. Bevorzugen Sie CC BY, CC BY-SA oder gemeinfreie Werke. Dokumentieren Sie die Lizenz.

2. **Aktualität.** Bevorzugen Sie Texte, die innerhalb der letzten 10 Jahre veröffentlicht wurden. Sprache entwickelt sich weiter — insbesondere das Vokabular rund um Technologie, Verwaltung und Medizin.

3. **Registervielfalt.** Suchen Sie innerhalb jeder Domäne nach Texten unterschiedlicher Formalitätsgrade. Eine behördliche Pressemitteilung (formell) und ein behördlicher Social-Media-Beitrag (informell) gehören beide zur Domäne `admin`, weisen jedoch unterschiedliche Register auf.

4. **Kulturelle Relevanz.** Priorisieren Sie für indigene und Minderheitensprachen Texte, die für die Gemeinschaft von Bedeutung sind — Dokumente zur Landbewirtschaftung, Bildungsmaterialien in der Sprache, Texte zur Kulturbewahrung — gegenüber Texten, die zufällig parallel vorliegen.

5. **Keine maschinell übersetzten Ausgangstexte.** Wenn ein „paralleles" Dokument dadurch entstanden ist, dass das Original durch Google Translate geführt und anschließend nachbearbeitet wurde, ist es als Referenzübersetzung NICHT akzeptabel. Die Referenz muss eine eigenständige menschliche Übersetzung sein.

---

## 3. System der Schwierigkeitsstufen

### 3.1 — Definitionen der Stufen

Jeder Eintrag wird einer Schwierigkeitsstufe (1–5) auf Basis der strukturellen Komplexität des *Ausgangstextes* zugewiesen, nicht der Übersetzungsschwierigkeit (die je nach Methode variiert).

| Stufe | Bezeichnung | Strukturelle Merkmale |
|------|-------|---------------------------|
| 1 | **Elementar** | Einfache Sätze. Ein Satzglied. Präsens. Geläufiges Vokabular. Keine Idiome. Keine eingebetteten Strukturen. |
| 2 | **Mittel** | Satzgefüge. Zwei durch Konjunktion verbundene Sätze. Vergangenheit/Zukunft. Etwas Domänenvokabular. |
| 3 | **Fortgeschritten** | Komplexe Sätze. Nebensätze, Relativsätze. Gemischte Zeitformen. Domänenspezifische Terminologie. Passiv. |
| 4 | **Experte** | Mehrere eingebettete Sätze. Juristisches/technisches Register. Konditionalstrukturen. Abstrakte Konzepte. Kulturelle Bezüge. |
| 5 | **Extrem** | Dichte Prosa mit mehreren gleichzeitigen Herausforderungen: verschachtelte Unterordnung, mehrdeutige Pronomenbezüge, kulturelle Idiome, gemischtes Register, seltenes Vokabular. |

### 3.2 — Linguistisch fundierte Schwierigkeitsfaktoren

Über die strukturelle Komplexität hinaus wird die Schwierigkeit durch die **typologische Distanz** zwischen Ausgangs- und Zielsprache moduliert. Diese Faktoren stammen aus den typologischen Merkmalen von WALS und den Klassifikationsdaten der Sprachcard:

| Faktor | Geringe Schwierigkeit | Hohe Schwierigkeit |
|--------|---------------|-----------------|
| **Wortstellung** | Gleiche Grundordnung (z. B. SVO→SVO) | Unterschiedliche Grundordnung (z. B. SVO→SOV) |
| **Morphologischer Typ** | Ähnlicher Typ (z. B. analytisch→analytisch) | Unterschiedlicher Typ (z. B. analytisch→polysynthetisch) |
| **Grammatisches Geschlecht** | Gleiches System oder kein Geschlecht | Ausgangssprache hat kein Geschlecht, Zielsprache hat ein komplexes Geschlechtersystem |
| **Honorativ/Register** | Keine Registermarkierung | Zielsprache hat ein komplexes Registersystem (z. B. Japanisch, Koreanisch) |
| **Schrift** | Gleiche Schrift | Unterschiedliche Schrift (Transliteration erforderlich) |
| **Belebtheit** | Keine Belebtheitsunterscheidung | Zielsprache hat belebtheitsbasierte Kongruenz (z. B. Cree) |
| **Evidentialität** | Keine Evidentialität | Zielsprache markiert die Informationsquelle grammatisch |

### 3.3 — Verteilung der Stufen

Ein Standardkorpus sollte ungefähr folgende Verteilung aufweisen:

| Stufe | Ziel-% | Begründung |
|------|----------|-----------|
| 1 | 15 % | Etabliert eine Grundlinie — selbst schlechte Methoden sollten diese bewältigen |
| 2 | 25 % | Alltägliche praktische Übersetzung |
| 3 | 30 % | Hier werden Qualitätsunterschiede der Methoden sichtbar |
| 4 | 20 % | Trennt gute Methoden von hervorragenden |
| 5 | 10 % | Obergrenzentest — nur sehr wenige Methoden werden diese gut bewältigen |

---

## 4. Qualität der Referenzübersetzungen

### 4.1 — Anforderungen an Übersetzer

Referenzübersetzungen müssen von Menschen erstellt werden, die:

1. **Fließend sprechende** Personen der Zielsprache (L1 oder gleichwertig) sind
2. In Ausgangs- und Zielsprache **schriftkundig** sind
3. **Domänenkundig** für die Domäne des Textes sind (ein medizinischer Übersetzer für Gesundheitstexte usw.)
4. **Unabhängig** sind — der Übersetzer darf während der Übersetzung keinen Zugang zu MT-Ausgaben für denselben Text haben

### 4.2 — Übersetzungsbriefing

Jeder Übersetzer erhält ein Briefing, das Folgendes enthält:

- Das zu verwendende **Register** (formell, umgangssprachlich usw.)
- Die **Zielgruppe** (allgemeine Öffentlichkeit, Fachleute, Kinder usw.)
- Etwaige für die Sprachgemeinschaft spezifische **Terminologiekonventionen**
- Eine ausdrückliche Anweisung: „Übersetzen Sie die Bedeutung, nicht die Worte. Eine natürlich klingende Übersetzung ist wertvoller als eine wörtliche."

### 4.3 — Qualitätssicherung

1. **Doppelübersetzung.** Idealerweise hat jeder Eintrag zwei unabhängige Referenzübersetzungen von verschiedenen Übersetzern. Wo dies nicht machbar ist, priorisieren Sie die Doppelübersetzung für die Stufen 4–5.

2. **Gemeinschaftsüberprüfung.** Referenzübersetzungen sollten von mindestens einer zusätzlichen sprechenden Person überprüft werden, die die Übersetzung nicht erstellt hat.

3. **Akzeptable Varianten.** Dokumentieren Sie für jede Referenz bekannte akzeptable Varianten (Wortstellung, orthographische Konventionen, dialektale Formen). Diese fließen in die `equivalent_match_rate`-Metrik ein.

### 4.4 — Was eine schlechte Referenz ausmacht

| Problem | Warum es die Evaluation ungültig macht |
|---------|------------------------------|
| Maschinell übersetzt und dann nachbearbeitet | Die Nachbearbeitung erhält die MT-Struktur; benachteiligt Methoden, die natürlichere Übersetzungen erzeugen |
| Von einem Lernenden statt einer fließend sprechenden Person übersetzt | Die Referenz kann Fehler enthalten, die korrekte MT-Ausgaben benachteiligen |
| Übermäßig wörtlich | Natürliche Übersetzungen schneiden gegenüber wörtlichen Referenzen schlecht ab |
| Einzige gültige Interpretation für mehrdeutigen Ausgangstext | Benachteiligt gültige alternative Interpretationen |

---

## 5. Kontaminationsprävention

### 5.1 — Das Bedrohungsmodell der Kontamination

| Bedrohung | Beschreibung | Gegenmaßnahme |
|--------|-------------|------------|
| **Überschneidung mit Trainingsdaten** | LLMs wurden mit dem Parallelkorpus trainiert | Das Parallelkorpus nicht öffentlich veröffentlichen |
| **Few-Shot-Leck** | Methodenautor verwendet Evaluationseinträge als Few-Shot-Beispiele | Fingerabdruckprüfung: Einträge im Prompt werden erkannt und markiert |
| **Indirekte Kontamination** | Ausgangstext existiert in den LLM-Trainingsdaten (monolingual) | Akzeptabel — monolingualer Ausgangstext ist zu erwarten. Die *Paarung* muss neu sein. |
| **Crowd-Kontamination** | Gemeinschaftsprüfer teilen Einträge öffentlich | Die Lizenzbedingungen untersagen die Weiterverbreitung des Parallelkorpus |

### 5.2 — Geheimhaltungsstufen für Korpora

| Stufe | Sichtbarkeit | Verwendung |
|------|-----------|-----|
| **Öffentlicher Entwicklungssatz** | Vollständig öffentlich | Methodenentwicklung, Debugging, Regressionstests. Werte werden NICHT auf dem Leaderboard veröffentlicht. |
| **Zurückgehaltener Evaluationssatz** | Ausgangstext sichtbar, Referenzen geheim | Offizielle Leaderboard-Evaluation. Methoden erhalten den Ausgangstext und geben Übersetzungen zurück; die Bewertung erfolgt serverseitig. Referenzen werden der Methode niemals offengelegt. |
| **Goldstandard-Satz** | Vollständig geheim, von der Gemeinschaft kontrolliert | Von der Gemeinschaft validierte Evaluation. Wird von der Governance-Organisation verwaltet. Verwendet für die Verifizierungsstufe „Community Validated". |

### 5.3 — Rotationsrichtlinie

Evaluationskorpora sollten regelmäßig **rotiert** werden:

1. Nachdem ein Korpus 12 Monate im Einsatz war, beginnen Sie mit der Erstellung eines Ersatzes
2. Stufen Sie das alte Korpus auf den Status „Entwicklungssatz" zurück (öffentlich)
3. Befördern Sie das neue Korpus zum „zurückgehaltenen Evaluationssatz"
4. Dies verhindert eine schleichende Kontamination durch iterative Optimierung gegen ein festes Ziel

---

## 6. Workflow zur Korpuserstellung

### 6.1 — Schritt-für-Schritt-Prozess

```
Step 1: Language Pair Selection
    └─ Identify target language, read language card
    └─ Review typological features (WALS), contact influences, scripts
    └─ Identify which difficulty factors apply

Step 2: Source Text Curation
    └─ Identify candidate source documents per domain
    └─ Verify licenses
    └─ Extract candidate sentences/segments
    └─ Classify by domain and preliminary difficulty tier

Step 3: Segment Selection
    └─ Sample segments to match domain distribution (§2.2)
    └─ Sample segments to match difficulty distribution (§3.3)
    └─ Ensure linguistic phenomenon coverage (§6.2)
    └─ Target minimum corpus size (§6.3)

Step 4: Reference Translation
    └─ Assign segments to qualified translators
    └─ Provide translation brief
    └─ Collect translations
    └─ Dual-translate Tier 4–5 entries

Step 5: Quality Assurance
    └─ Community review of references
    └─ Document acceptable variants
    └─ Flag and resolve disagreements

Step 6: Metadata & Packaging
    └─ Assign final difficulty tiers
    └─ Add provenance metadata per entry
    └─ Content-hash the corpus for versioning
    └─ Package as corpus JSON per harness spec

Step 7: Registration
    └─ Register in Supabase datasets table
    └─ Add to ATTRIBUTION.md if new sources used
    └─ Document in arena website
```

### 6.2 — Abdeckung linguistischer Phänomene

Jedes Korpus sollte Einträge enthalten, die spezifische, für das Sprachpaar relevante linguistische Phänomene testen. Diese stammen aus den Feldern `linguisticChallenges` und `contactInfluences` der Sprachcard:

**Universelle Phänomene (alle Sprachpaare):**
- Pronomenauflösung (mehrdeutige Antezedenzien)
- Negation (einfach, doppelt, Skopus)
- Quantoren (alle, einige, keine, die meisten)
- Temporalausdrücke (relative Daten, Dauern)
- Eigennamen (Personen, Orte, Organisationen)
- Zahlen und Maßangaben
- Listen und Aufzählungen

**Paarspezifische Phänomene (aus der Sprachcard):**
- Für polysynthetische Zielsprachen: komplexe Verbmorphologie, Inkorporation
- Für genusmarkierende Zielsprachen: Genuskongruenz, neutrale/inklusive Bezugnahme
- Für SOV-Zielsprachen: satzfinale Verben, Postpositionen
- Für Tonsprachen: tonabhängige Bedeutungsunterscheidungen
- Für Honorativsprachen: Registermarker, sozialer Kontext
- Für Kontaktsprachen: Code-Switching-Grenzen, Integration von Lehnwörtern

### 6.3 — Mindestkorpusgröße

Statistische Zuverlässigkeit erfordert Mindesteintragszahlen. Diese basieren auf den Anforderungen an gepaarte Bootstrap-Konfidenzintervalle (aus `significance.py`):

| Zweck | Mindesteinträge | Empfohlen |
|---------|-----------------|-------------|
| Entwicklungssatz | 50 | 100–200 |
| Zurückgehaltener Evaluationssatz | 100 | 200–500 |
| Goldstandard-Satz | 200 | 500+ |
| Mindestmenge pro Domäne | 10 | 25+ |
| Mindestmenge pro Stufe | 10 | 20+ |

**Warum mindestens 100 für die Evaluation?** Mit weniger als ~100 Einträgen können gepaarte Bootstrap-Signifikanztests (1.000 Resamples) Unterschiede, die kleiner als ~5 chrF++-Punkte sind, nicht zuverlässig erkennen. Mit 200+ Einträgen können wir Unterschiede von ~2 Punkten bei p<0,05 erkennen.

---

## 7. JSON-Format des Korpus

Jeder Korpuseintrag folgt der Harness-Spezifikation:

```json
{
  "id": "edtekla-dev-v1-042",
  "source": "The school board will meet on Tuesday to discuss the new curriculum.",
  "reference": "ᑭᓯᑭᓄᐦᐊᒫᑐᐏᓐ ᑲ ᐃᔑ ᐱᒥᐸᔨᐦᑕᐦᒃ ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓇ ᐁ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ ᓂᔓ ᑭᔑᑲᐤ",
  "acceptable_variants": [
    "ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓐ ᓂᔓ ᑭᔑᑲᐤ ᑲ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ"
  ],
  "domain": "edu",
  "difficulty": 3,
  "phenomena": ["temporal_expression", "named_entity", "future_tense"],
  "provenance": {
    "source_doc": "EdTeKLA Module 4, Unit 7",
    "source_license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "translator": "anonymous-speaker-001",
    "translator_qualification": "L1 Plains Cree, certified translator",
    "translation_date": "2025-11-15",
    "reviewer": "anonymous-speaker-002",
    "review_date": "2025-12-01"
  }
}
```

---

## 8. Maßnahmen gegen Manipulation

### 8.1 — Korpusintegrität

| Maßnahme | Umsetzung |
|---------|----------------|
| **Inhaltshashing** | Korpusversion = SHA-256 der sortierten Eintrags-IDs + Referenzen. Jede Änderung erzeugt eine neue Version. |
| **Eintrags-Fingerabdruck** | Jeder Eintrag besitzt eine inhaltsbasierte ID. Wenn jemand Ergebnisse gegen ein modifiziertes Korpus einreicht, stimmt der Fingerabdruck nicht überein. |
| **Durchsetzung der Zurückhaltung** | Für die offizielle Evaluation erhalten Methoden NUR den Ausgangstext. Referenzen werden niemals offengelegt. Die Bewertung erfolgt serverseitig. |
| **Rotationszeitplan** | Korpora rotieren jährlich, um eine langfristige Optimierung gegen ein festes Ziel zu verhindern. |

### 8.2 — Einreichungsintegrität

| Maßnahme | Umsetzung |
|---------|----------------|
| **Deterministischer Fingerabdruck** | Die Lauf-Konfiguration (Modell, Temperatur, Prompt, Korpusversion) wird gehasht. Identische Konfigurationen erzeugen identische Fingerabdrücke. |
| **Cherry-Picking-Erkennung** | Einreichende müssen alle Läufe offenlegen, nicht nur den besten. Mehrere Einreichungen mit demselben Fingerabdruck werden markiert. |
| **Kontaminationsprüfung** | Wenn Evaluationseinträge wortwörtlich im Prompt oder in den Coaching-Daten der Methode erscheinen, wird die Einreichung disqualifiziert. |

---

## 9. Bestehende Korpora

### 9.1 — EDTeKLA-Entwicklungssatz v1

| Eigenschaft | Wert |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Paar** | EN → CRK (Plains Cree, SRO) |
| **Einträge** | Dev-Split mit 436 Einträgen (`textbook_dev.json`). Die vollständige Aufschlüsselung wird einmalig auf der [Seite für Evaluierungsdatensätze](/docs/network/leaderboard/datasets#edtekla-development-set-v1) angegeben. |
| **Domänen** | Bildung (100 %) |
| **Stufen** | 1–5 (Verteilung noch festzulegen durch Eintragsprüfung) |
| **Lizenz** | EdTeKLAs modifizierte CC BY-NC-SA (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, auf Souveränität ausgerichtet) — **ausgenommen von den Leaderboard-, Preis- und kommerziellen/API-Bereichen** (nicht-kommerziell) |
| **Status** | Development-Set (öffentlich) |

**Einschränkungen:** Einzelne Domäne (nur Bildung). Keine Domänenstratifizierung. Stufenzuweisungen müssen möglicherweise auditiert werden. Die geringe Korpusgröße begrenzt die statistische Aussagekraft für Signifikanztests.

### 9.2 — Geplante Korpora

| Korpus | Paar | Status | Verantwortlicher |
|--------|------|--------|-------|
| EN → TL (Filipino) Custom-Korpus | EN → TL | Geplant | Projektverantwortlicher |
| EN → CRK zurückgehaltener Satz | EN → CRK | Zukünftig (benötigt Gemeinschaftspartner) | Gemeinschafts-Governance-Organisation |

---

## 10. Integration der Sprachcard

Das Korpus-Framework ist in das Sprachcard-System integriert:

1. Die **Domänenauswahl** wird durch das Feld `linguisticChallenges` der Card informiert — wenn eine Sprache einzigartige Herausforderungen aufweist (Polysynthese, Ton, Belebtheit), muss das Korpus Einträge enthalten, die diese testen.

2. Die **Schwierigkeitskalibrierung** verwendet das Feld `classification` der Card — die typologische Distanz zwischen Ausgangs- und Zielfamilie beeinflusst, was als „schwierig" gilt.

3. Die **Registerabdeckung** verwendet das Feld `registers` der Card — wenn eine Sprache definierte Register hat (formal-filipino, taglish-professional, taglish-casual), sollte das Korpus Einträge auf jeder Registerebene enthalten.

4. Die **Prüfung des Kontakteinflusses** verwendet das Feld `contactInfluences` der Card — für Sprachen mit umfangreichen Entlehnungsschichten (Filipino: Spanisch + Englisch + Arabisch) sollten Einträge enthalten sein, die testen, ob Methoden Lehnwörter korrekt handhaben, anstatt sie überzusetzen.

5. Die **Schriftbehandlung** verwendet das Feld `scripts[]` der Card — für mehrschriftige Sprachen (Serbisch: Kyrillisch + Lateinisch) sollten Einträge enthalten sein, die die korrekte Schriftauswahl testen.

---

## Referenzen

- **Champollion Scoring Specification** — definiert alle Metriken, Composite-Gewichtungen, Qualitätsstufen
- **Champollion Benchmark Specification** — Evaluationsprotokoll, Korpusformat, Datensouveränität
- **WALS** (World Atlas of Language Structures) — Datenbank typologischer Merkmale
- **Glottolog** — maßgebliche Referenz zur Sprachklassifikation
- **ISO 639-3** — Standard zur Sprachidentifikation
- **EdTeKLA** — Quelle des ersten Evaluationskorpus

---

*Dieses Dokument ist eine lebende Spezifikation. Aktualisieren Sie es, sobald neue Korpora erstellt und Erkenntnisse gewonnen werden.*
