---
sidebar_position: 9
title: "Corpus-Partnerschaftsstrategie"
slug: '/network/specifications/corpus-partnership'
---

# Korpus-Partnerschaftsstrategie: Aufbau von Evaluationskorpora durch akademische linguistische Fachbereiche

Der Aufbau eines *Trainingskorpus* für eine ressourcenarme Sprache erfordert Hunderttausende
von Satzpaaren — viel zu viele, um sie zu überprüfen, sodass die Qualität auf eine Weise schwankt,
die niemand bemerkt, bis ein damit trainiertes Modell versagt. Ein *Evaluationskorpus*
benötigt einige hundert Paare, von denen jedes einzelne von jemandem überprüft wird, der
die Sprache beherrscht, und es veraltet nie: Jedes neue Modell oder jede neue Methode, die
erscheint, wird daran gemessen. Dieses Dokument beschreibt den Arbeitsablauf für den Aufbau
dieser zweiten, weitaus kostengünstigeren Variante — das einzige Arbeitsergebnis, bei dem die
Expertise einer Abteilung jeden einzelnen Satz erreicht — und für das, was danach geschieht:
Sobald ein Evaluationsstandard etabliert ist, macht ein
[ausgeschriebener Preis](/docs/network/specifications/prizes) Ihre Sprache
zu einem Ziel, auf das jeder Methodenentwickler weltweit hinarbeiten kann, und die
öffentliche Rangliste misst jeden Versuch.

> **Zweck.** Der vollständige Arbeitsablauf zur Erstellung eines Evaluationskorpus für maschinelle Übersetzung durch eine Partnerschaft mit einer linguistischen Abteilung: was die Abteilung liefert, wie das Korpus aussehen muss, wie es kryptografisch versiegelt wird, wie die Sandbox-Evaluation funktioniert und was die Abteilung im Gegenzug erhält. Dies ist das Dokument, das Sie zu einem Treffen mit einem potenziellen akademischen Partner mitbringen.
>
> **Zielgruppe.** Abteilungsleiter, Principal Investigators, Forschungskoordinatoren und Direktoren von Programmen für indigene Sprachen an Universitäten mit aktiven Sprachdokumentations- oder NLP-Programmen.
>
> **Begleitdokumente:**
> - [Framework für das Korpusdesign](/docs/network/specifications/corpus-design) — die Methodik hinter validen, zuverlässigen Evaluationskorpora
> - [Preisspezifikation](/docs/network/specifications/prizes) — der Anreizteil: die Ausschreibung eines Preises für Ihr versiegeltes Set
> - [Registrierung von Korpora](/docs/network/sovereignty/registering-corpora) — wie ein Korpus dem Netzwerk beitritt, ohne Ihre Hände zu verlassen
> - [Protokoll zur Sprechervalidierung](/docs/network/specifications/speaker-validation) — die Bitte an zweisprachige Sprecher, bestehende Übersetzungen zu *markieren* (Qualitätsbewertung, Linter-Validierung, FST-Überprüfung)
> - [Benchmark-Spezifikation](/docs/network/specifications/benchmark) — die vollständige technische Spezifikation für Korpora, Run Cards und Evaluationsprotokolle
> - [Datenhoheit](/docs/network/sovereignty/data-sovereignty) — indigene Prinzipien der Datensouveränität, CARE und warum die Übertragung von Eigentumsrechten wichtig ist

---

## 1. Was diese Partnerschaft hervorbringt

Ein **versiegeltes Evaluationskorpus**: eine kuratierte Sammlung paralleler Textpaare (Ausgangssprache → Zielsprache), die zur Referenzgrundlage (Ground Truth) für die Messung der Qualität maschineller Übersetzung wird. Methoden werden in einer Sandbox gegen dieses Korpus getestet — Entwickler bekommen die Testdaten niemals zu sehen.

Die Partnerschaft bringt drei Artefakte hervor:

| Artefakt | Was es ist | Wer es kontrolliert |
|----------|-----------|-----------------|
| **Entwicklungskorpus** | 100–200+ öffentliche parallele Textpaare für die Methodenentwicklung | Offen veröffentlicht (CC BY-NC-SA 4.0 oder gleichwertig) |
| **Gold-Standard-Testsatz** | 50–150 geheime parallele Textpaare für die offizielle Evaluation | Community-Governance-Organisation (kryptografisch versiegelt) |
| **Diagnostische Testsuite** | 10–50 gezielte kontrastive Paare zur Prüfung spezifischer linguistischer Phänomene | Offen veröffentlicht |

Zusammen sind das 160–400 Paare — ein Korpus, das eine Forschungsgruppe tatsächlich
auf professionellem Niveau kuratieren kann, im Gegensatz zu den Hunderttausenden, die ein
Trainingskorpus erfordern würde. Das Entwicklungskorpus ermöglicht es jedem,
Übersetzungsmethoden zu entwickeln. Das Goldstandard-Set stellt sicher, dass diese Methoden
ehrlich getestet werden. Die Diagnostik-Suite erfasst spezifische Fehlermodi
(z. B. „kann dieses System mit Obviation umgehen?“).

---

## 2. Was der Fachbereich tun muss

### Phase 1: Korpusentwurf (2–4 Wochen, Zeitaufwand der Forschenden)

**Leitung:** Verantwortliche Forschende oder Postdoc mit Fachwissen in der Zielsprache.

1. **Auswahl der Domänen des Ausgangsmaterials.** Wählen Sie 4–6 reale Domänen aus, in denen die Sprachgemeinschaft tatsächlich Übersetzungen benötigt. Unsere Taxonomie unterstützt 16 Domänen (siehe Benchmark-Spezifikation §2.7):

   | Priorität | Domäne | Warum |
   |----------|--------|-----|
   | 🔴 Hoch | `edu` — Bildung | Lehrbücher, Lehrpläne — unmittelbarer Bedarf der Gemeinschaft |
   | 🔴 Hoch | `gov` — Verwaltung | Dokumente des Bandrats, Richtlinien — praktischer täglicher Bedarf |
   | 🔴 Hoch | `medical` — Gesundheit | Aufnahmeformulare von Kliniken, Gesundheitsinformationen — sicherheitskritisch |
   | 🟡 Mittel | `conv` — Umgangssprache | Alltagssprache — legt eine grundlegende Sprachkompetenz fest |
   | 🟡 Mittel | `legal` — Recht | Rechtedokumente, Verträge — Bedeutung für die Gemeinschaft |
   | 🟢 Niedriger | `literary` — Literarisch/Kulturell | Geschichten, mündliche Überlieferungen — kulturelle Bewahrung |

2. **Erstellen Sie ein Korpusentwurfsdokument**, das Folgendes festlegt:
   - Zielgröße pro Segment (development, gold_standard, diagnostic)
   - Verteilung der Schwierigkeitsstufen (siehe §3.3 unten)
   - Register- und Domänenabdeckung
   - Auswahlkriterien für Ausgangssätze (kein synthetischer Text, nicht ausschließlich biblische Texte)
   - Plan zur Sprecherrekrutierung

3. **Reichen Sie den Entwurf zur Überprüfung bei uns ein.** Wir validieren ihn gegen das Korpusschema (Benchmark-Spezifikation §2) und geben innerhalb einer Woche Rückmeldung.

### Phase 2: Erstellung der Ausgangssätze (4–8 Wochen, Zeitaufwand der Sprecher)

**Leitung:** Forschungskoordinator in Zusammenarbeit mit zweisprachigen Sprechern.

1. **Generieren oder wählen Sie Ausgangssätze** über die geplanten Domänen und Schwierigkeitsstufen hinweg aus. Quellen können sein:
   - Bestehende veröffentlichte zweisprachige Materialien (Lehrbücher, Verwaltungsdokumente)
   - Neu erhobene Sätze, die zur Abdeckung spezifischer linguistischer Phänomene konzipiert wurden
   - Adaptiert aus realen Dokumenten (Tagesordnungen des Bandrats, Klinikformulare, Bildungsmaterialien)

2. **Jeder Ausgangssatz muss Folgendes aufweisen:**
   - Domänen-Tag (aus der Taxonomie mit 16 Codes)
   - Register-Tag (umgangssprachlich, formell, technisch, zeremoniell, bildungsbezogen)
   - Kontext-Tag (Begrüßung, Erklärung, Frage, Anweisung, Erzählung, Beschriftung, Fehler)
   - Geschätzte Schwierigkeitsstufe (1–5, siehe §3.3)
   - Herkunfts-Tag (textbook, elicited, corpus, gold_standard)

3. **Übersetzen Sie jeden Ausgangssatz** in die Zielsprache, durchgeführt von zweisprachigen Sprechern. Mehrere Referenzübersetzungen pro Eintrag sind wertvoll, aber nicht erforderlich.

4. **Optional können Sie eine morphologische Analyse hinzufügen** für jede Referenzübersetzung:
   - Interlineare Glossierung (Morphem-für-Morphem-Aufschlüsselung)
   - FST-Tag-Zeichenkette (falls ein FST für die Sprache existiert)
   - Anmerkungen des Übersetzers zu dialektalen Varianten, Mehrdeutigkeit oder kulturellem Kontext

### Phase 3: Qualitätssicherung (2–4 Wochen)

**Leitung:** Linguist mit Fachwissen in der Zielsprache.

1. **Gegenprüfung.** Jede Übersetzung sollte von mindestens einem weiteren zweisprachigen Sprecher überprüft werden, der die ursprüngliche Übersetzung nicht angefertigt hat. Der Prüfer kontrolliert:
   - Ist die Übersetzung korrekt?
   - Klingt sie natürlich?
   - Ist die Schwierigkeitsbewertung korrekt?
   - Gibt es akzeptable Varianten, die vermerkt werden sollten?

2. **Durchlauf durch unseren Schema-Validator.** Wir stellen ein Skript bereit, das das Korpus gegen das Eintragsschema (Benchmark-Spezifikation §2.2) validiert. Es prüft:
   - Vorhandensein erforderlicher Felder
   - Gültigkeit der Domänen-Codes
   - Schwierigkeitsstufen sind ganze Zahlen von 1–5
   - Keine doppelten IDs
   - Zeichenkodierung (UTF-8-NFC-Normalisierung)

3. **Falls ein FST für die Sprache existiert,** lassen Sie die Referenzübersetzungen durch dieses laufen. Jedes Wort in der Referenz sollte FST-gültig sein. Wörter, die es nicht sind (Lehnwörter, Neologismen, Eigennamen), sollten in einer Erlaubnisliste (Allowlist) dokumentiert werden.

### Phase 4: Segmentierung und Versiegelung (1 Woche, unser Engineering)

**Leitung:** Champollion-Team, mit Überprüfung durch den Fachbereich.

1. **Stratifizierte Aufteilung.** Wir teilen das Korpus in Segmente auf, wobei wir deterministische Zufallsstichproben verwenden (Seed dokumentiert, reproduzierbar):

   | Segment | Zielgröße | Zugriff |
   |---------|------------|--------|
   | `development` | 60 % der Einträge (mind. 100) | Öffentlich |
   | `gold_standard` | 30 % der Einträge (mind. 50) | Geheim, versiegelt |
   | `held_out` | 10 % der Einträge (mind. 10) | Geheim, versiegelt, wird bis zur Aktivierung nie verwendet |

   Die Aufteilung bewahrt die Verteilung der Schwierigkeitsstufen (stratifizierte Stichprobe), sodass jedes Segment eine proportionale Repräsentation über alle Stufen hinweg aufweist.

2. **Kryptografische Versiegelung** der Segmente gold_standard und held_out:

   ```
   1. SHA-256 hash of each entry (source + reference + metadata)
   2. SHA-256 hash of the complete segment file
   3. Segment file encrypted with AES-256-GCM
   4. Encryption key split using Shamir Secret Sharing (2-of-3 threshold)
   5. Key shares distributed to:
        - Share 1: Community governance organization
        - Share 2: Academic department partner
        - Share 3: Champollion project (escrow)
   6. Hash manifest published to a public commit (proves the corpus existed
      at a specific time without revealing its contents)
   ```

3. **Das development-Segment** wird in das öffentliche Repository übernommen und mit vollständiger Lizenzierung veröffentlicht.

4. **Das diagnostic-Segment** ist ebenfalls öffentlich — es testet spezifische linguistische Phänomene (siehe §3.4).

### Phase 5: Integration und Start (1–2 Wochen, unser Engineering)

1. **Harness-Konfiguration.** Wir fügen die Sprache zum Evaluations-Harness hinzu:
   - Sprachkarte erstellt oder verifiziert
   - Korpus im Dataset-Registry registriert
   - LYSS-Metriken konfiguriert (LYSS-fst, falls FST verfügbar, LYSS-eq, falls Linter-Regeln existieren)
   - Standard-Bewertungsprofil ausgewählt (Profil A, falls FST verfügbar, sonst Profil B)

2. **Baseline-Benchmark.** Wir führen einen Durchlauf mit 12 Modellen gegen das development-Segment durch, um die Rangliste mit initialen Werten zu füllen.

3. **Öffentliche Ankündigung.** Die Sprache erscheint auf der Network-Rangliste mit einem live geschalteten development-Segment-Benchmark. Der Fachbereich wird als Korpus-Partner genannt.

---

## 3. Wie das Korpus beschaffen sein muss

### 3.1 Format

Jede Korpusdatei ist ein JSON-Dokument, das dem Schema in Benchmark-Spezifikation §2.1–§2.2 folgt:

```json
{
  "dataset": {
    "id": "crk-ualberta-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-09-15",
    "license": "CC-BY-NC-SA-4.0",
    "provenance": ["textbook", "elicited", "gold_standard"]
  },
  "entries": [
    {
      "id": 1,
      "source": "I see the dog",
      "reference": "niwâpamâw atim",
      "segment": "development",
      "difficulty": 2,
      "provenance": "textbook",
      "register": "conversational",
      "context": "declaration",
      "domain": "edu",
      "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
      "notes": "Animate noun (atim); direct form because speaker is proximate"
    }
  ]
}
```

### 3.2 Mindestgrößenanforderungen

| Segment | Mindesteinträge | Empfohlen |
|---------|----------------|-----------|
| `development` | 100 | 200–300 |
| `gold_standard` | 50 | 100–150 |
| `diagnostic` | 10 | 30–50 |
| `held_out` | 10 | 20–30 |
| **Gesamt** | **170** | **350–530** |

### 3.3 Schwierigkeitsverteilung

Das Korpus muss Einträge über alle fünf Schwierigkeitsstufen hinweg enthalten, gewichtet zugunsten der Stufen 2–4:

| Stufe | Beschreibung | Zielverteilung |
|------|-------------|-------------------|
| 1 — Grundwortschatz | Einzelne Wörter, gängige Begrüßungen, Zahlen | 10–15 % |
| 2 — Einfache Sätze | SVO, Präsens | 25–30 % |
| 3 — Mittlere Komplexität | Vergangenheit/Zukunft, Possessive, Belebtheit | 30–35 % |
| 4 — Komplexe Morphologie | Obviation, Passiv, Konjunkt-Ordnung, Relativsätze | 15–20 % |
| 5 — Fortgeschritten | Mehrsatz, formelles Register, zeremoniell, idiomatisch | 5–10 % |

### 3.4 Diagnostische Testsuite

Das diagnostic-Segment testet spezifische linguistische Phänomene anhand von **kontrastiven Paaren**: eine korrekte Übersetzung und eine minimal abweichende falsche Übersetzung. Wenn die Metrik eines Systems die korrekte höher bewertet, ist der Test bestanden.

Bei polysynthetischen Sprachen sollte die diagnostische Suite Folgendes anvisieren:

| Phänomen | Beispiel (Cree) | Was es testet |
|-----------|----------------|--------------|
| **Belebtheitskongruenz** | atim (AN) vs. maskisin (IN) — unterschiedliche Verbformen | Weiß das System, welche Nomen belebt sind? |
| **Obviation** | Proximate vs. obviative dritte Person | Verfolgt es die Hierarchie der dritten Person? |
| **Inverse Markierung** | Direkte vs. inverse Verbformen | Kann es mit „Patiens überragt Agens" umgehen? |
| **Konjunkt/Independent** | Verbstellung in Haupt- vs. Nebensatz | Verwendet es das richtige Verbparadigma? |
| **Inklusiv/Exklusiv** | „Wir (einschließlich dir)" vs. „Wir (ausschließlich dir)" | Unterscheidet es die Formen der ersten Person Plural? |

Für andere Sprachfamilien identifizieren Sie die 3–5 diagnostisch aussagekräftigsten Phänomene, die eine kompetente von einer inkompetenten Übersetzung unterscheiden. Das linguistische Fachwissen des Fachbereichs ist hier von wesentlicher Bedeutung — dies sind die Tests, von denen nur ein Spezialist wüsste, dass er sie schreiben muss.

### 3.5 Was wir NICHT wollen

| Antimuster | Warum |
|-------------|-----|
| **Ausschließlich biblische Texte** | Archaisches Register, liturgischer Wortschatz, formelhafte Struktur. OMT-1600 hat 1.560 Sprachen auf diese Weise evaluiert — wir vermeiden dies bewusst. |
| **Synthetische Evaluationspaare** | Von LLMs generierte Referenzen unterlaufen den Zweck der Evaluation. Die Referenz muss von Menschen verfasst sein. |
| **Korpora mit nur einem Register** | Alles formell oder alles umgangssprachlich. Reale Übersetzung umfasst mehrere Register. |
| **Nur Schwierigkeit 1** | Einzelne Wörter und Begrüßungen testen keine Übersetzung — sie testen das Nachschlagen von Vokabeln. |
| **Maschinell übersetzte Referenzen** | Die Verwendung von Google-Translate-Ausgaben als „Referenz" ist zirkulär. |
| **Sätze ohne Kontext-Tag** | Wir müssen die kommunikative Funktion für die diagnostische Analyse kennen. |

---

## 4. Kryptografische Versiegelung und Sandbox-Tests {#4-cryptographic-sealing-and-sandbox-testing}

### 4.1 Warum den Testsatz versiegeln?

Herkömmliche ML-Benchmarks veröffentlichen Testsätze offen. Nach der Veröffentlichung werden Frontier-LLMs schließlich darauf trainiert (absichtlich oder durch Web-Scraping), wodurch die Werte unzuverlässig werden. Bei Daten indigener Sprachen kommt ein zusätzliches Bedenken hinzu: veröffentlichte linguistische Daten können ohne Einwilligung der Gemeinschaft verwendet werden.

Die Versiegelung stellt Folgendes sicher:
- **Integrität des Testsatzes:** Methoden können sich nicht an Daten überanpassen, die sie nie gesehen haben
- **Datensouveränität:** Die Gemeinschaft kontrolliert, wer gegen ihre Daten evaluiert
- **Dauerhafte Aktualität:** Der Testsatz wird niemals kontaminiert

### 4.2 Wie Sandbox-Tests funktionieren

```
Developer workflow:
  1. Developer builds a translation method using the PUBLIC development corpus
  2. Developer tests locally against the development segment (unlimited, self-serve)
  3. When ready, developer submits their complete method (code + config + coaching data)
  4. Governance org installs the method in the evaluation sandbox
  5. Sandbox runs the method against the SEALED gold-standard test set
  6. Only scores are returned to the developer
  7. Developer never sees the source sentences or reference translations

The sandbox:
  - Runs on governance-controlled infrastructure
  - Has selective network access (LLM APIs only, no exfiltration)
  - Produces a tamper-proof run card (SHA-256 hash of all inputs and outputs)
  - Logs all execution for audit purposes
  - Can be inspected by the governance org at any time
```

### 4.3 Schlüsselverwaltung

Der Verschlüsselungsschlüssel für den versiegelten Testsatz wird mittels Shamir Secret Sharing mit einem Schwellenwert von 2 aus 3 aufgeteilt:

| Anteilsinhaber | Rolle | Widerrufsbefugnis |
|-------------|------|-----------------|
| **Community-Governance-Organisation** | Primärer Verwahrer | Kann den Evaluationszugriff einseitig widerrufen |
| **Partner-Fachbereich der Hochschule** | Mitverwahrer | Kann an der Schlüsselrekonstruktion teilnehmen |
| **Champollion-Projekt** | Treuhand | Kann nicht allein auf Daten zugreifen; gewährleistet Kontinuität, falls andere Parteien nicht verfügbar sind |

Je 2 von 3 Anteilen rekonstruieren den Schlüssel. Das bedeutet:
- Die Gemeinschaft + der Fachbereich können ohne Champollion auf die Daten zugreifen
- Die Gemeinschaft + Champollion können ohne den Fachbereich auf die Daten zugreifen
- Champollion allein kann NIEMALS auf die Daten zugreifen

### 4.4 Hash-Manifeste

Wenn das Korpus versiegelt wird, wird ein **Hash-Manifest** in einem öffentlichen Git-Commit veröffentlicht:

```json
{
  "corpus_id": "crk-ualberta-v1",
  "seal_date": "2026-09-15T00:00:00Z",
  "segments": {
    "development": {
      "entry_count": 200,
      "sha256": "a3f7c...",
      "access": "public"
    },
    "gold_standard": {
      "entry_count": 100,
      "sha256": "b8d2e...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "held_out": {
      "entry_count": 20,
      "sha256": "c9e4f...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "diagnostic": {
      "entry_count": 30,
      "sha256": "d1a3b...",
      "access": "public"
    }
  },
  "total_entries": 350,
  "manifest_sha256": "e2b5c..."
}
```

Dies beweist:
- Das Korpus existierte zu einem bestimmten Datum
- Es hat eine bekannte Größe und Struktur
- Jede Änderung an den versiegelten Segmenten würde die Hash-Kette brechen
- Die Gemeinschaft kann überprüfen, dass ihre Daten nicht manipuliert wurden

---

## 5. Was der Fachbereich erhält

### 5.1 Forschungsinfrastruktur

| Ressource | Beschreibung |
|-------|------------|
| **Evaluations-Harness** | Ein funktionierendes, getestetes Evaluations-Framework für ihre Sprache — spart Monate an Werkzeugentwicklung |
| **LYSS-Metriken** | Sprachspezifische Evaluationsmetriken (LYSS-fst, LYSS-eq, LYSS-sem), konfiguriert für ihre Sprache — falls FST- und Wörterbuchressourcen existieren |
| **Rangliste** | Eine öffentliche, live geschaltete Rangliste, die den Stand der Technik für ihr Sprachpaar zeigt |
| **Baseline-Benchmark** | Durchlauf mit 12 Modellen, der unmittelbare, veröffentlichungsfähige Baselines liefert |
| **Diagnostische Testsuite** | Gezielte Tests für spezifische linguistische Phänomene — wiederverwendbar für andere Evaluationen |

### 5.2 Publikationen

Der Korpusaufbau und die Evaluationsergebnisse unterstützen mehrere Publikationen:

| Beitrag | Veranstaltungsort | Rolle des Fachbereichs |
|-------|-------|-----------------|
| Methodik des Korpusaufbaus | LREC, ComputEL | Federführend oder Mitautor |
| Baseline-Evaluationsergebnisse | ACL, EMNLP | Mitautor |
| Validierung der LYSS-Metrik | WMT Metrics Shared Task | Mitautor |
| Entwurf der diagnostischen Testsuite | SIGMORPHON, NAACL | Federführend oder Mitautor |
| Sprachspezifische NLP-Ressourcen | Sprachspezifische Veranstaltungsorte | Federführender Autor |

### 5.3 Positionierung für Fördermittel

Die Partnerschaft liefert konkrete Ergebnisse für Förderanträge:

- „Open-Source-Evaluationsinfrastruktur für MÜ von [Sprache]" — nachweisbares Ergebnis
- „Kryptografische Datensouveränität für indigene linguistische Daten" — wendet etablierte indigene Datensouveränitäts-Frameworks (CARE, Kaitiakitanga, TK Labels) auf die MÜ-Evaluation an; veröffentlichungsfähig
- „Von der Gemeinschaft verwalteter Benchmark mit Live-Rangliste" — fortlaufende Wirkungskennzahl
- „Unabhängige Evaluation von OMT-1600 / Google Translate für [Sprache]" — aktuell, hohe Sichtbarkeit

### 5.4 Wirkung auf die Gemeinschaft

- Die Sprachgemeinschaft erhält eine **unabhängige Evaluationsfähigkeit** — sie kann beurteilen, ob ein beliebiges MÜ-System (Google, Meta oder maßgeschneidert) für ihre Sprache tatsächlich funktioniert
- Die Gemeinschaft **kontrolliert die Testdaten** über die kryptografische Schlüsselverwahrung
- Alle durch den Benchmark bewährten Methoden **übertragen das Eigentum** an die Gemeinschaft (siehe Benchmark-Spezifikation §8.3), die alles behält, was ein Einsatz jemals erwirtschaftet — Champollion ist nicht-kommerziell und behält keinen Anteil

### 5.5 Was es den Fachbereich kostet

| Komponente | Geschätzte Kosten | Wer bezahlt |
|-----------|---------------|----------|
| Zeit von verantwortlichen Forschenden/Postdoc (Entwurf, Aufsicht) | ~40 Stunden | Fachbereich (oder fördermittelfinanziert) |
| Sprechervergütung (Übersetzung) | 2.500–6.000 $ | Fördermittelfinanziert oder Champollion-finanziert |
| Sprechervergütung (Überprüfung) | 500–1.500 $ | Fördermittelfinanziert oder Champollion-finanziert |
| Zeit des Forschungskoordinators | ~20 Stunden | Fachbereich |
| **Engineering, Infrastruktur, Harness** | **0 $** | **Champollion-Projekt** |

Wir stellen das gesamte Engineering, die Harness-Konfiguration, die Einrichtung der LYSS-Metrik, die Ranglistenintegration und die laufende Infrastruktur ohne Kosten für den Fachbereich bereit. Der Beitrag des Fachbereichs besteht in linguistischem Fachwissen und dem Zugang zu Sprechern.

---

## 6. Zeitplan

| Phase | Dauer | Wichtiger Meilenstein |
|-------|----------|--------------|
| 1: Korpusentwurf | 2–4 Wochen | Entwurfsdokument genehmigt |
| 2: Ausgangssätze + Übersetzung | 4–8 Wochen | Rohkorpus fertiggestellt |
| 3: Qualitätssicherung | 2–4 Wochen | Gegengeprüft, schemavalidiert |
| 4: Versiegelung | 1 Woche | Gold-Standard versiegelt, Hash-Manifest veröffentlicht |
| 5: Integration | 1–2 Wochen | Sprache live auf der Rangliste mit Baselines |
| **Gesamt** | **10–19 Wochen** | **Live-Rangliste mit versiegelter Evaluation** |

---

## 7. Wie man beginnt {#7-how-to-get-started}

1. **Kontaktieren Sie uns** — [Projekt-E-Mail/Kontakt]. Wir vereinbaren einen 30-minütigen Anruf, um Ihre Sprache, verfügbare Ressourcen und die Logistik der Partnerschaft zu besprechen.

2. **Wir stellen bereit:**
   - Dieses Dokument
   - Das Korpusschema und die Validierungswerkzeuge
   - Beispiele aus unserem bestehenden Cree-Korpus (CRK)
   - Eine Vorlage für einen Korpusentwurf

3. **Sie stellen bereit:**
   - Einen Principal Investigator (PI) oder Postdoc zur Leitung der linguistischen Arbeit
   - Zugang zu zweisprachigen Sprechern (oder einen Plan zu deren Rekrutierung)
   - Informationen über verfügbare Ressourcen (FST, Wörterbuch, bestehende Korpora)
   - Institutionelle Genehmigung für die Datenverwaltung (in Übereinstimmung mit den Datensouveränitätsprinzipien der First Nations oder dem eigenen Rahmenwerk der Gemeinschaft)

4. **Wir entwerfen das Korpus gemeinsam** — Domänenauswahl, Schwierigkeitsverteilung, diagnostische Tests, Zeitplan und Budget.

5. **Die Arbeit beginnt.** Wir sprechen uns wöchentlich ab. Der Fachbereich hat volle Autonomie über linguistische Entscheidungen; wir kümmern uns um das gesamte Engineering.

---

## 8. Häufig gestellte Fragen

### „Wir haben bereits ein Parallelkorpus. Können wir es verwenden?"

Ja — sofern das Korpus eine klare Herkunft hat, von Menschen verfasst ist und die Lizenz die Verwendung in der Evaluation erlaubt. Wir helfen Ihnen dabei, es in unser Schema zu formatieren, fehlende Metadaten hinzuzufügen und es zu integrieren. Bestehende Korpora können den Zeitplan drastisch beschleunigen (Phase 2 überspringen oder auf eine Lückenfüllübung reduzieren).

### „Wir haben kein FST für unsere Sprache."

Das ist in Ordnung. LYSS-fst (morphologische Gültigkeit) erfordert ein FST, aber der Harness funktioniert auch ohne dieses unter Verwendung der Gewichtungen von Profil B (chrF++, BLEU, COMET, verhaltensbezogene Metriken). Falls ein GiellaLT-FST für eine verwandte Sprache existiert, können wir es möglicherweise anpassen. Falls nicht, ermöglicht das Korpus dennoch eine wertvolle Evaluation — nur ohne das Gate für die morphologische Gültigkeit.

### „Unsere Sprecher verwenden eine nicht-lateinische Schrift."

Vollständig unterstützt. Das Korpusschema unterstützt jede Unicode-Schrift. Wir haben für SRO (Standard Roman Orthography) und Silbenschrift für Cree entworfen, aber dieselbe Infrastruktur funktioniert für Devanagari, arabische Schrift, CJK, Äthiopisch oder jedes andere Schriftsystem.

### „Was ist mit dialektaler Variation?"

Kennzeichnen Sie sie. Das Korpuseintragsschema enthält ein `notes`-Feld für dialektale Informationen. Falls mehrere Dialekte vertreten sind, dokumentieren Sie diese. Die Äquivalenzklassen des Linters (LYSS-eq) können so konfiguriert werden, dass sie dialektale Varianten als gleichwertig akzeptieren. Die diagnostische Testsuite kann dialektspezifische Kontraste enthalten.

### „Wem gehört das Korpus?"

Der Sprachgemeinschaft, über die Governance-Organisation. Der Fachbereich wird als Forschungspartner genannt. Champollion hält einen Treuhand-Schlüsselanteil zur betrieblichen Kontinuität, kann aber nicht allein auf die versiegelten Daten zugreifen. Das development-Segment wird unter einer von der Gemeinschaft festgelegten Creative-Commons-Lizenz veröffentlicht.

### „Was ist, wenn wir aufhören möchten?"

Die Gemeinschaft kann den Evaluationszugriff jederzeit widerrufen, indem sie sich weigert, den Verschlüsselungsschlüssel zu rekonstruieren. Die versiegelten Daten werden niemals offengelegt. Das bereits veröffentlichte development-Segment bleibt öffentlich unter seiner Lizenz. Die Forschungsergebnisse des Fachbereichs (Publikationen, Präsentationen) verbleiben ungeachtet dessen bei ihm.

### „Was ist, wenn die Governance-Organisation noch nicht existiert?"

Wir können mit den Phasen 1–3 (Korpusentwurf, -erstellung, QS) ohne eine Governance-Organisation beginnen. Die Versiegelung (Phase 4) erfordert die Bestimmung eines Schlüsselverwahrers. In der Zwischenzeit kann der Fachbereich als Mitverwahrer neben dem Champollion-Projekt fungieren, mit dem Verständnis, dass die Verwahrung an die Community-Governance-Organisation übergeht, sobald eine solche eingerichtet ist.

---

## Anhang: Kennzeichnung vs. Korpusaufbau

Dieses Dokument behandelt den **Korpusaufbau** — die Erstellung der parallelen Textpaare, die die Evaluationsgrundlage (Ground Truth) bilden. Die Kennzeichnung (morphologische Annotation, interlineare Glossierung, FST-Tag-Zeichenketten) ist eine separate Tätigkeit, die das Korpus anreichert, aber für die grundlegende Evaluation nicht erforderlich ist.

| Tätigkeit | Erforderlich? | Was sie ermöglicht |
|----------|-----------|-----------------|
| **Korpusaufbau** (dieses Dokument) | ✅ Erforderlich | Grundlegende Evaluation: chrF++, exakte Übereinstimmung, COMET, verhaltensbezogene Metriken |
| **FST-Abdeckungsprüfung** | 🟡 Optional | LYSS-fst-Metrik für morphologische Gültigkeit **und** das FST-abgeleitete `morphological_accuracy` (Lemma-abgeglichen — keine Annotation erforderlich; Scoring-Spezifikation §2.2) |
| **Morphologische Annotation** | 🟡 Optional | Würde zukünftig ein *gold-validiertes* Upgrade von `morphological_accuracy` ermöglichen; die (obige) FST-abgeleitete Version benötigt keines |
| **Linter-Äquivalenzregeln** | 🟡 Optional | LYSS-eq-Metrik für äquivalente Übereinstimmung |
| **Regeln für semantische Validierung** | 🟡 Optional | LYSS-sem-Metrik für semantische Validierung |
| **Sprecher-Qualitätsbewertungen** | Separate Tätigkeit | Metrik-Validierung (siehe [Sprecher-Validierungsprotokoll](/docs/network/specifications/speaker-validation)) |

Kennzeichnung und Sprecher-Validierung werden in separaten Dokumenten behandelt und können parallel zum oder nach dem Korpusaufbau erfolgen.
