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

> **Zusammenfassung.** Diese Seite beschreibt die für das Benchmarking verfügbaren Evaluierungsdatensätze, einschließlich des Schemas für Korpuseinträge, der Schwierigkeitsgrade (1–5) und der Anforderungen an die Herkunft (Provenance). Der Katalog umfasst **~4.700 Fetch-from-Source-Evaluierungsdatensätze aus 19 Korpusfamilien** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, die WMT newstest/General Blind Sets 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) plus FLORES+ — der *Inhalt* der Korpora wird hier niemals gehostet; jeder Datensatz ist eine SHA-gepinnte Metadatenkarte, die deterministisch aus ihrem gepinnten Upstream-Archiv neu erstellt wird. Ein **nicht-kommerzieller / reiner Forschungsbereich (Lane)** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k und die WMT-Forschungsdatensätze) ist von jeglichen kommerziellen / Preis- / API-Pfaden ausgeschlossen; innerhalb dieses Bereichs sind Korpora mit modifizierten, maßgeschneiderten oder nicht angegebenen Lizenzen zusätzlich **zustimmungspflichtig (consent-gated)** — die Evaluierung über Remote-Modell-APIs wird verweigert, es sei denn, der Lizenztext selbst gestattet die Nutzung zur Evaluierung (erfasst als explizite Entscheidung pro Datensatz, wie bei den WMT-Forschungsdatensätzen) oder die Erlaubnis des Rechteinhabers ist im Datensatzeintrag vermerkt. Die beiden von Menschen kuratierten Referenzdatensätze — EDTeKLA Dev v1 (Plains Cree) und FLORES+ Devtest (870 katalogisierte Sprachpaare, jeweils 1.012 Sätze) — werden unten detailliert beschrieben; die vollständige Aufschlüsselung der Eintragszahlen von EdTeKLA wird einmalig in [seinem Abschnitt](#edtekla-development-set-v1) angegeben.

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

Der Katalog umfasst **~4.700 Fetch-from-Source-Evaluierungsdatensätze aus 19 Korpusfamilien**, plus die zwei unten detailliert beschriebenen, von Menschen kuratierten Referenzdatensätze (EDTeKLA + FLORES) — insgesamt **5.602 Datensätze** in der Registrierung (Stand: 12.07.2026). Jedes Korpus ist eine **SHA-gepinnte Metadatenkarte** — der Korpusinhalt wird hier niemals gehostet; er wird zum Zeitpunkt der Evaluierung deterministisch aus seinem gepinnten Upstream-Archiv neu erstellt. Alle Datensätze enthalten `do_not_train`. Eine Quellkarte fächert sich in viele Datensätze pro Sprachpaar auf, sodass die Gesamtzahl in der Registrierung die ~1.417 Quellkarten übersteigt; die Datensätze der Open-Lane speisen die Sweep-Warteschlange direkt; die Research-only-Lane wird bei Bedarf ausgeführt, sofern ihre Lizenz dies eindeutig zulässt (modifizierte/maßgeschneiderte/nicht angegebene Lizenzen sind für die Evaluierung über Remote-Modell-APIs zustimmungspflichtig).

| Familie | Datensätze | Ersteller / Quelle | Lizenz | Lane |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1.260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | open |
| **IN22** (Conv + Gen) | 1.012 | AI4Bharat / IIT Madras | CC-BY-4.0 | open (HF-gated Download) |
| **Tatoeba** | 874 | [Tatoeba community](https://tatoeba.org), über die Tatoeba Challenge | CC-BY-2.0 | open |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | open |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | open |
| **WMT newstest / General** (2014–2025 Blind Sets) | 178 | WMT (Conference on Machine Translation), über sacreBLEU | `LicenseRef-WMT-Research-Use` | **research use** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | open |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | open |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | open |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **non-commercial / research-only** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | open (share-alike) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **research-only** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (Shared-Task-Organisatoren) | CC-BY-NC-SA-4.0 | **non-commercial / research-only** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (Organisatoren) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **research-only** |
| **Gamayun** | 8 | CLEAR Global (ehemals Translators without Borders) | `LicenseRef-TWB-Gamayun` | **non-commercial / research-only** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **non-commercial / research-only** |
| **EDTeKLA / prize** | 3 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **non-commercial / research-only (in Quarantäne)** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **non-commercial / research-only** |
| **MENYO-20k** | 2 | Masakhane / Universität des Saarlandes (uds-lsv) | CC-BY-NC-4.0 | **non-commercial / research-only** |

*(FLORES+ devtest — 870 katalogisierte Paare, CC-BY-SA-4.0 — ist der nachstehend detailliert beschriebene
Referenzdatensatz, wodurch sich die Gesamtzahl im Register auf 5.602 erhöht.)*

:::info[Die nicht-kommerzielle Research-only-Lane]
Der Großteil des Katalogs ist permissiv lizenziert (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) und in jeder Lane nutzbar. Eine kleine Gruppe — **Gamayun** (die
maßgeschneiderte Lizenz von TWB) und **EDTeKLA** (eine modifizierte, souveränitätsbezogene CC BY-NC-SA) — ist **nicht-kommerziell**: Sie ist
von jeglichen kommerziellen, Preis- oder API-Pfaden ausgenommen. Für Korpora mit
modifizierten, maßgeschneiderten oder nicht angegebenen Lizenzen ist die Evaluierung über Remote-Modell-APIs
zusätzlich **zustimmungspflichtig (consent-gated)**: Das Harness weigert sich, deren Text an
Modell-APIs von Drittanbietern zu senden, es sei denn, der Lizenztext selbst gestattet die Nutzung zur Evaluierung
(erfasst als explizite Entscheidung pro Datensatz — die WMT-Forschungsdatensätze
verfügen über eine solche) oder die ausdrückliche Erlaubnis des Rechteinhabers ist im
Datensatzeintrag vermerkt (eine lokale Evaluierung bleibt möglich). Die Berechtigung ist **nutzungsbasiert**: Die kommerzielle Lane ist streng,
die Forschungs-Lane ist nachsichtig, und die Quarantäne hat immer Vorrang (sodass die unzulässigen EdTeKLA-Slices niemals im Ranking erscheinen können). Siehe
[Registrierung von Korpora & Exposure Lanes](/docs/network/sovereignty/registering-corpora) für Informationen darüber,
wie ein Korpus seine Lane wählt.
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
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Version** | `1.0` |
| **Sprachpaar** | EN → CRK (Plains Cree, SRO-Orthografie) |
| **Anzahl der Einträge** | 436-Einträge-Dev-Split (`textbook_dev.json`). Kette: 589 rohe, ausgerichtete Zeilen Upstream → 486 eindeutige, gültige Paare nach Normalisierung/Deduplizierung (eine von Champollion abgeleitete Zählung) → 436 Dev + 50 zurückgehalten (Champollions deterministischer Seed-42-Split — EdTeKLA veröffentlicht die Rohdateien, keinen Split). Ein separates Goldstandard-Set mit 62 Einträgen (handkuratiert, nur für Forschungszwecke, **kein** EdTeKLA-Material) bringt die kombinierte Plains-Cree-Evaluierungssammlung des Projekts auf 548. |
| **Schwierigkeitsverteilung** | Leicht, Mittel, Schwer |
| **Herkunft** | `gold_standard` (von Sprechern verifiziert), `textbook` (veröffentlichte Lehrmaterialien) |
| **Lizenz** | [EdTeKLAs modifizierte CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — souveränitätsbezogen; das zugrunde liegende Lehrbuch ist CC BY-NC-ND 4.0) — **ausgenommen von den Leaderboard-, Preis- und kommerziellen/API-Lanes** (nicht-kommerziell) |

> **Dies ist die kanonische Angabe der Zählungen für das Plains-Cree-Evaluierungsset.** Andere
> Seiten verlinken hierher, anstatt sie zu wiederholen. Die Zahlen 486/436/50 sind
> von Champollion aus den rohen, ausgerichteten Dateien von EdTeKLA abgeleitet (EdTeKLA selbst veröffentlicht
> keine Zählungen oder Splits); das Goldstandard-Set mit 62 Einträgen hat eine separate Herkunft, die nicht von EdTeKLA stammt.
> Die obige Zählung ist immer mit ihrer Lane gekoppelt: EdTeKLA verfügt über eine modifizierte,
> souveränitätsbezogene CC BY-NC-SA und ist **von den Leaderboard-, Preis- und
> kommerziellen/API-Pfaden ausgenommen**.

**Was es testet:**

- Grundlegende Begrüßungen und gängige Redewendungen
- Nomen-Belebtheit und Obviation
- Verbkonjugation über Personen und Zeitformen hinweg
- Lokativkonstruktionen
- Possessivparadigmen
- Komplexe Satzstrukturen

:::tip[Korpusstruktur]
Das von EdTeKLA abgeleitete Material teilt sich in ein öffentliches Dev-Set und ein zurückgehaltenes Set (Held-out Set) auf (Champollions Split der rohen Lehrbuch-Ausrichtung von EdTeKLA — Zählungen in der Tabelle oben). Das separate Goldstandard-Set mit 62 Einträgen ist aus anderen Quellen handkuratiert und nicht Teil des EdTeKLA-Korpus. Ein kleinerer, qualitativ hochwertiger Datensatz mit verifizierten Goldstandards ist nützlicher als ein großer, verrauschter — insbesondere für eine ressourcenarme Sprache (Low-Resource Language), bei der „nahezu richtige“ Übersetzungen oft morphologisch ungültig sind.
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
