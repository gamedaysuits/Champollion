---
sidebar_position: 3
title: "Evaluierungsdatensätze"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# Evaluierungsdatensätze

> **Kurzübersicht.** Diese Seite beschreibt die für Benchmarks verfügbaren Evaluationsdatensätze, einschließlich des Korpus-Eintragsschemas, der Schwierigkeitsstufen (1–5) und der Provenienzanforderungen. Der Katalog umfasst **~4.700 quellbasierte Evaluationsdatensätze aus 19 Korpusfamilien** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, die WMT newstest/General Blind-Sets 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) zuzüglich FLORES+ — Korpus*inhalte* werden hier niemals gehostet; jeder Datensatz ist eine SHA-gepinnte Metadaten-Karte, die deterministisch aus dem jeweils gepinnten Upstream-Archiv neu erstellt wird. Eine **nicht-kommerzielle / reine Forschungs-Lane** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k und die WMT-Forschungssets) ist von jeglichen kommerziellen, Preis- oder API-Pfaden ausgeschlossen; innerhalb dieser Lane sind Korpora unter modifizierten, maßgeschneiderten oder nicht spezifizierten Bedingungen zusätzlich **zustimmungsgebunden (consent-gated)** — die Evaluation über Remote-Modell-APIs wird verweigert, es sei denn, der Lizenztext selbst gewährt die Nutzung zur Evaluation (erfasst als explizite Entscheidung pro Datensatz, wie bei den WMT-Forschungssets) oder die Erlaubnis des Rechteinhabers ist im Datensatz-Eintrag hinterlegt. Die beiden manuell kuratierten Referenzdatensätze — EDTeKLA Dev v1 (Plains Cree) und FLORES+ Devtest (870 katalogisierte Sprachpaare mit jeweils 1.012 Sätzen) — werden weiter unten ausführlich beschrieben; die vollständige Aufschlüsselung der Eintragszahlen von EdTeKLA wird einmalig in [seinem Abschnitt](#edtekla-development-set-v1) dargelegt.

Datensätze sind die festen Ziele, gegen die das Harness ausgeführt wird. Jeder Datensatz ist eine JSON-Datei, die Quell→Ziel-Paare mit Goldstandard-Referenzen enthält. Das Harness bewertet Modellausgaben anhand dieser Referenzen — es verändert sie niemals.

:::danger[Trainieren Sie NICHT mit Evaluationsdaten]

⚠️ **Diese Datensätze dienen ausschließlich der Evaluierung.** Methoden, die mit Evaluierungsdaten trainiert, feinabgestimmt, mit Few-Shot-Prompts versehen oder anderweitig damit in Kontakt gebracht wurden, erzeugen künstlich überhöhte Werte und werden **von der Bestenliste ausgeschlossen.**

Verwenden Sie separate Korpora für das Training. Evaluierungssätze müssen während der Entwicklung für Ihr Modell ungesehen bleiben.
:::

---

## Datensatzformat {#dataset-format}

Jeder Datensatz folgt demselben JSON-Schema:

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[Kanonisches Schema]
Die [Benchmark-Spezifikation](/docs/network/specifications/benchmark) definiert das kanonische Korpus- und Eintragsschema. Diese Seite dokumentiert die verfügbaren Datensätze und wie neue erstellt werden.
:::

### Oberster `dataset`-Block

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `id` | `string` | Eindeutige Datensatzkennung (verwendet in Run-Cards und Bestenliste) |
| `version` | `string` | Semantische Version. Das Erhöhen dieses Werts macht frühere Run-Card-Vergleiche ungültig |
| `language_pair` | `string` | Anzeigebezeichnung (z. B. `EN→CRK`) |
| `description` | `string` | Optional. Menschenlesbare Zusammenfassung |
| `source_language` | `string` | BCP-47-Quellsprachcode |
| `target_language` | `string` | BCP-47-Zielsprachcode |
| `created` | `string` | ISO-8601-Erstellungsdatum |
| `license` | `string` | SPDX-Lizenzkennung |
| `provenance` | `string[]` | Liste der über die Einträge hinweg verwendeten Herkunfts-Tags |

### Eintragsfelder

| Feld | Typ | Erforderlich | Beschreibung |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | Eindeutige Eintragskennung innerhalb des Korpus |
| `source` | `string` | ✅ | Der zu übersetzende Quelltext |
| `reference` | `string` | ✅ | Die Goldstandard-Referenzübersetzung |
| `difficulty` | `integer` | ✅ | Schwierigkeitsstufe 1–5 (siehe unten) |
| `provenance` | `string` | ✅ | Ursprung dieses Eintrags (z. B. `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | Register-/Formalitätsebene (z. B. `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | Kommunikative Funktion (z. B. `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | Optionaler Kontext für menschliche Prüfer |
| `morphological_analysis` | `string` | ❌ | Goldstandard-morphologische Aufschlüsselung |
| `variant_class` | `string` | ❌ | Klassenbezeichnung zur Gruppierung akzeptabler Übersetzungsvarianten |

---

## Verfügbare Datensätze

Der Katalog umfasst **~4.700 quellbasierte Evaluationsdatensätze aus 19 Korpusfamilien**,
zuzüglich der beiden weiter unten ausführlich beschriebenen, manuell kuratierten
Referenzdatensätze (EDTeKLA + FLORES) — insgesamt **5.601 Datensätze** im Register
mit Stand vom 06.09.2026. Jedes Korpus ist eine **SHA-gepinnte Metadaten-Karte** —
Korpusinhalte werden hier niemals gehostet; sie werden zum Evaluationszeitpunkt
deterministisch aus ihrem gepinnten Upstream-Archiv neu erstellt. Alle Datensätze tragen
`do_not_train`. Eine Quellkarte fächert sich in viele pro Sprachpaar spezifische Datensätze auf,
weshalb die Gesamtzahl im Register die ~1.417 Quellkarten übersteigt; die Datensätze der
offenen Lane speisen direkt die Sweep-Warteschlange; die rein forschungsbezogene Lane läuft
auf Abruf, sofern deren Lizenz dies eindeutig zulässt (modifizierte/maßgeschneiderte/nicht spezifizierte
Berechtigungen sind für die Evaluation über Remote-Modell-APIs zustimmungsgebunden).

| Familie | Datensätze | Ersteller / Quelle | Lizenz | Lane |
|---------|-----------:|-------------------|--------|------|
| **TICO-19** | 1.260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | offen |
| **IN22** (Conv + Gen) | 1.012 | AI4Bharat / IIT Madras | CC-BY-4.0 | offen (HF-gated Download) |
| **Tatoeba** | 874 | [Tatoeba-Community](https://tatoeba.org), über die Tatoeba Challenge | CC-BY-2.0 | offen |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | offen |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | offen |
| **WMT newstest / General** (Blind-Sets 2014–2025) | 178 | WMT (Conference on Machine Translation), über sacreBLEU | `LicenseRef-WMT-Research-Use` | **Forschungsnutzung** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | offen |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | offen |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | offen |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **nicht-kommerziell / nur Forschung** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | offen (Share-Alike) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **nur Forschung** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (Organisatoren der Shared Task) | CC-BY-NC-SA-4.0 | **nicht-kommerziell / nur Forschung** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (Organisatoren) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **nur Forschung** |
| **Gamayun** | 8 | CLEAR Global (ehemals Translators without Borders) | `LicenseRef-TWB-Gamayun` | **nicht-kommerziell / nur Forschung** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **nicht-kommerziell / nur Forschung** |
| **EDTeKLA / Preis** | 2 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **unter Quarantäne: niemals ausführbar oder gerankt** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **nicht-kommerziell / nur Forschung** |
| **MENYO-20k** | 2 | Masakhane / Universität des Saarlandes (uds-lsv) | CC-BY-NC-4.0 | **nicht-kommerziell / nur Forschung** |

*(FLORES+ Devtest — 870 katalogisierte Paare, CC-BY-SA-4.0 — ist der unten
ausführlich beschriebene Referenzdatensatz, womit die Gesamtzahl im Register 5.601 beträgt.)*

:::info[Die nicht-kommerzielle, reine Forschungs-Lane]
Der Großteil des Katalogs ist unter permissiven Lizenzen veröffentlicht (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) und über jede Lane hinweg nutzbar. Eine kleine Gruppe — **Gamayun** (die maßgeschneiderte
Lizenz von TWB) und **EDTeKLA** (eine modifizierte, auf Datensouveränität ausgerichtete CC BY-NC-SA) — ist **nicht-kommerziell**: Sie ist
von jeglichen kommerziellen, Preis- oder API-Pfaden ausgeschlossen. Für Korpora unter
modifizierten, maßgeschneiderten oder nicht spezifizierten Bedingungen ist die Evaluation über Remote-Modell-APIs
zusätzlich **zustimmungsgebunden (consent-gated)**: Das Evaluation Harness verweigert das Senden der Texte an
Modell-APIs von Drittanbietern, es sei denn, der Lizenztext selbst gestattet die Nutzung zur Evaluation
(erfasst als explizite Entscheidung pro Datensatz — die WMT-Forschungssets enthalten
eine solche) oder die ausdrückliche Genehmigung des Rechteinhabers ist im
Datensatz-Eintrag hinterlegt (lokale Evaluation bleibt weiterhin möglich). Die Zulässigkeit ist **nutzungsbasiert**: Die kommerzielle Lane ist strikt,
die Forschungs-Lane nachsichtig und die Quarantäne hat stets Vorrang (die Korpora von EdTeKLA werden
vollständig unter Quarantäne gestellt, und die Datenbank lehnt jedes für sie eingereichte Score-Ergebnis ab). Siehe
[Registrieren von Korpora & Freigabe-Lanes](/docs/network/sovereignty/registering-corpora) dazu,
wie für ein Korpus dessen Lane ausgewählt wird.
:::

Die Referenzdatensätze werden unten näher beschrieben; die Familienkorpora folgen demselben
JSON-Schema und sind in der Datensatzregistrierung aufgeführt.

:::note[Ein Katalog ist keine befüllte Tafel]
Ein umfangreicher Korpuskatalog ist das, wogegen Methoden benchmarkt werden *können* — er ist
keine Bestenliste voller Ergebnisse. Die Tafel selbst befindet sich im Seeding-Stadium; siehe die
[Bestenlisten-Regeln](/docs/network/leaderboard/rules) und
[Ehrliche Einschränkungen](/docs/network/honest-limitations).
:::

### EDTeKLA Development Set v1 {#edtekla-development-set-v1}

Der erste Evaluierungsdatensatz, erstellt für die Übersetzung Englisch→Plains Cree (SRO). Erstellt von der [EdTeKLA-Forschungsgruppe](https://spaces.facsci.ualberta.ca/edtekla/) an der University of Alberta.

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `eval-eng-crk-edtekla-dev-v1` (und `eval-eng-crk-edtekla-textbook`) |
| **Version** | `1.0` |
| **Sprachpaar** | EN → CRK (Plains Cree, SRO-Orthografie) |
| **Anzahl der Einträge** | Dev-Split mit 436 Einträgen (`textbook_dev.json`). Kette: 589 unbearbeitete ausgerichtete Zeilen upstream → 486 eindeutige gültige Paare nach Normalisierung/Deduplizierung (eine von Champollion abgeleitete Zählung) → 436 Dev + 50 Held-out (Champollions deterministischer Seed-42-Split — EdTeKLA veröffentlicht die Rohdateien, keinen Split). Ein separater Gold-Standard-Satz mit 62 Einträgen (manuell kuratiert, nur für die Forschung, **kein** EdTeKLA-Material) bringt die gesamte Plains-Cree-Evaluationssammlung des Projekts auf 548. |
| **Schwierigkeitsverteilung** | Einfach, Mittel, Schwer |
| **Provenienz** | `gold_standard` (von Sprechern verifiziert), `textbook` (veröffentlichte Lehrmaterialien) |
| **Lizenz** | [EdTeKLAs modifizierte CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — auf Datensouveränität ausgerichtet; das zugrundeliegende Lehrbuch steht unter CC BY-NC-ND 4.0) — **unter Quarantäne**: katalogisiert, aber niemals ausführbar, und ein dafür eingereichtes Score-Ergebnis wird von der Datenbank abgewiesen; aus Bestenliste, Preis- und kommerziellen/API-Lanes ausgeschlossen (nicht-kommerziell) |

> **Dies ist die maßgebliche Angabe der Zählungen für das Plains-Cree-Evaluationsset.** Andere
> Seiten verlinken hierher, anstatt sie erneut aufzuführen. Die Zahlen 486/436/50 wurden
> durch Champollion aus den unformatierten ausgerichteten Dateien von EdTeKLA abgeleitet (EdTeKLA selbst
> veröffentlicht weder Zählungen noch Splits); das Gold-Standard-Set mit 62 Einträgen besitzt eine
> separate Provenienz außerhalb von EdTeKLA. Die obige Zählung ist stets an ihre Lane gekoppelt: EdTeKLA
> unterliegt einer modifizierten, auf Datensouveränität ausgerichteten CC BY-NC-SA und ist **von der
> Bestenliste, Preisen sowie dem kommerziellen/API-Pfad ausgeschlossen**.

**Was es testet:**

- Grundlegende Begrüßungen und gängige Redewendungen
- Nomen-Belebtheit und Obviation
- Verbkonjugation über Personen und Zeitformen hinweg
- Lokativkonstruktionen
- Possessivparadigmen
- Komplexe Satzstrukturen

:::tip[Korpusstruktur]
Das von EdTeKLA abgeleitete Material unterteilt sich in ein öffentliches Dev-Set und ein Held-out-Set (Champollions Aufteilung der unformatierten Lehrbuch-Angleichung von EdTeKLA — Zahlenangaben in der obigen Tabelle). Das separate Gold-Standard-Set mit 62 Einträgen wurde manuell aus anderen Quellen kuratiert und ist nicht Bestandteil des EdTeKLA-Korpus. Ein kleinerer, hochwertiger Datensatz mit verifizierten Gold-Standards ist nützlicher als ein großer, verrauschter Datensatz — insbesondere für eine ressourcenarme Sprache (Low-Resource Language), bei der Übersetzungen nach dem Prinzip „nah genug dran“ morphologisch oft ungültig sind.
:::

---

## Erstellen eines neuen Datensatzes

So erstellen Sie einen Datensatz für ein neues Sprachpaar oder eine neue Domäne:

### 1. Die JSON strukturieren

Folgen Sie dem Schema des [Datensatzformats](#dataset-format). Jeder Eintrag muss über `source`, `reference`, `difficulty`, `provenance`, `register` und `context` verfügen.

### 2. Eine eindeutige ID zuweisen

Verwenden Sie einen aussagekräftigen Slug: `{project}-{split}-v{version}` (z. B. `edtekla-dev-v1`, `quechua-test-v1`).

### 3. Goldstandards verifizieren

Jeder `reference`-Wert muss von einer fließend sprechenden Person verifiziert oder aus einer veröffentlichten, begutachteten Quelle bezogen werden. Maschinell erzeugte Referenzen verfehlen den Zweck der Evaluierung.

### 4. Schwierigkeitsstufen festlegen

Weisen Sie jedem Eintrag eine ganzzahlige Schwierigkeitsstufe zu:

| Stufe | Beschreibung | Beispiele |
|------|-------------|----------|
| 1 — Grundwortschatz | Einzelne Wörter, gängige Begrüßungen, Zahlen | „hello“ → „tânisi“ |
| 2 — Einfache Sätze | Subjekt-Verb oder SVO, Präsens | „Ich sehe den Hund“ |
| 3 — Mittlere Komplexität | Vergangenheits-/Zukunftsform, Possessive, Belebtheit | „Ich sah gestern seinen Hund“ |
| 4 — Komplexe Morphologie | Obviation, Passiv, Konjunkt-Reihenfolge | „die Frau, deren Sohn zum Laden ging“ |
| 5 — Fortgeschritten | Mehrgliedrig, formelles Register, zeremoniell, idiomatisch | Ganzer Absatz mit registergerechtem Tonfall |

### 5. Herkunft kennzeichnen

Jeder Eintrag sollte angeben, woher er stammt. Gängige Tags:

- `gold_standard` — Von fließend sprechenden Personen verifiziert
- `textbook` — Aus veröffentlichten Lehrmaterialien
- `elicited` — Durch strukturierte Elizitationssitzungen erzeugt
- `corpus` — Aus einem Parallelkorpus extrahiert

### 6. Die Datei validieren

Führen Sie das Harness mit einem beliebigen Modell gegen Ihren Datensatz aus, um zu überprüfen, ob die JSON wohlgeformt ist und alle erforderlichen Felder vorhanden sind:

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

Das Harness gibt bei fehlenden Feldern, doppelten Indizes oder Schemaverletzungen einen Fehler aus.

### 7. Zur Aufnahme einreichen

Öffnen Sie einen Pull Request gegen das [Eval-Harness-Repository](https://github.com/gamedaysuits/Champollion), der eine **Fetch-from-Source-Metadatenkarte** hinzufügt — einen Registrierungseintrag, der das Harness auf die Upstream-Quelle verweist (Loader/URL, SHA-Fixierung, Lizenz und Herkunft). **Übertragen Sie niemals den Korpusinhalt selbst.** Champollion hostet oder verfolgt keinen Text aus Drittkorpora; das Harness ruft die Referenzen zur Laufzeit von der Upstream-Quelle ab und bewertet anhand der frisch abgerufenen Daten. Validieren Sie zuerst lokal (Schritt 6), reichen Sie dann nur die Karte ein. Fügen Sie eine Dokumentation Ihrer Verifizierungsmethodik und Herkunftsquellen bei.

---

## FLORES+ Devtest

Ein breit abdeckender mehrsprachiger Benchmark, gepflegt von der [Open Language Data Initiative (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus). Verwendet für die Multi-Modell-Frontier-Vergleiche von Champollion.

| Eigenschaft | Wert |
|----------|-------|
| **ID** | Eine Karte pro Paar: `eval-flores-devtest-v1-<src>-<tgt>` (z. B. `eval-flores-devtest-v1-amh-fra`) |
| **Sprachpaare** | 870 katalogisierte und ausführbare Paare (812 davon zwischen zwei nicht-englischen Sprachen) |
| **Eintragszahl** | 1.012 Sätze pro Paar |
| **Lizenz** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **Quelle** | Meta FLORES-200, jetzt OLDI-gepflegt — von der Quelle abgerufen, SHA-fixiert pro Paar (Korpusinhalte werden hier niemals verfolgt) |
| **Kontamination** | **HOCH** — nur relativ, ausschließlich Test / Illustration (siehe Hinweis) |

:::warning[HOHE Kontamination — nur relativ, niemals ein absoluter Benchmark]
FLORES+ sind öffentliche, aus dem Web gecrawlte Daten, die Frontier-Modelle sehr wahrscheinlich bereits
gesehen haben. Champollion betreibt sie in einer **rein relativen** Spur: nutzbar, um Methoden
direkt gegeneinander zu vergleichen, aber **niemals als absoluter Qualitätswert ausgewiesen** und **niemals
als Kettenkante** auf der [Übersetzungskarte](https://champollion.dev) verwendet.
Sie dienen **ausschließlich zu Test- und Veranschaulichungszwecken**.
:::

:::danger[Nur zur Evaluation]
FLORES+ ist ausschließlich zur Evaluation gedacht. Die Kuratoren bitten ausdrücklich darum, es **nicht als Trainingsdaten zu verwenden**. Stellen Sie sicher, dass dessen Inhalte aus jeglichen Trainingskorpora ausgeschlossen werden.
:::

---

## Siehe auch

- [MT-Evaluierung](/docs/network/leaderboard/rules) — Überblick über das Evaluierungsframework und die Bestenliste
- [Eval-Harness](/docs/network/specifications/harness) — wie Evaluierungen gegen diese Datensätze ausgeführt werden
- [Run-Card-Spezifikation](/docs/network/specifications/run-card) — das JSON-Schema zur Aufzeichnung von Ergebnissen
- [Methoden-Bestenliste](https://champollion.dev/leaderboard) — Live-Benchmark-Werte
- [EdTeKLA Project](https://spaces.facsci.ualberta.ca/edtekla/) — die Forschungsgruppe der University of Alberta hinter dem Cree-Datensatz
