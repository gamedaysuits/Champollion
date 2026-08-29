---
sidebar_position: 5
title: "Eine ressourcenarme Sprache unterstützen"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# Unterstützung einer ressourcenarmen Sprache

> **Zusammenfassung.** Ein umfassender Leitfaden zur Entwicklung maschineller Übersetzung für ressourcenarme und polysynthetische Sprachen. Behandelt, warum diese Sprachen schwierig sind (morphologische Komplexität, spärliche Daten, Halluzinationen), bestehende computerlinguistische Ressourcen (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), über 10 Lösungsansätze, das champollion-Coaching-System und die Evaluierungsschleife. Beginnen Sie hier, wenn Sie eine Methode für eine unterrepräsentierte Sprache beisteuern möchten.

:::info[Status: In aktiver Entwicklung]
Die Unterstützung für Plains Cree (nêhiyawêwin) befindet sich derzeit in der Entwicklung. Die hier beschriebenen Werkzeuge, die Evaluierungsumgebung und das Leaderboard sind real und bereits heute nutzbar, aber die Cree-Übersetzungspipeline wurde noch nicht veröffentlicht. Sobald dies geschieht, wird sie als Blaupause für andere polysynthetische und ressourcenarme Sprachen mit FST-Infrastruktur dienen.
:::

## Das ungelöste Problem

Googles Cloud Translation-Dienst listet 194 Sprachen auf ([Googles veröffentlichte Liste](https://docs.cloud.google.com/translate/docs/languages)). Metas OMT-1600 (März 2026) beansprucht eine Abdeckung von 1.600 Sprachen — das größte jemals veröffentlichte MÜ-System (Maschinelle Übersetzung). Aber für die ~1.200 Sprachen in seinem "Long Tail" — unsere Rechnung: die 1.600 abgedeckten Sprachen abzüglich der über 400, von denen die Autoren berichten, dass die Modelle sie "ausreichend gut verstehen" — liegt die Qualität unterhalb brauchbarer Schwellenwerte, die Trainingsdaten werden von Bibeltexten dominiert, die Modellgewichte stehen nicht zum Download zur Verfügung, und es gibt keine unabhängige Evaluierung oder ein Community-Governance-Framework. Für die verbleibenden ~5.400 Sprachen liefert kein vortrainiertes Modell überhaupt eine Ausgabe.

Die Landschaft hat sich erheblich verändert — große Technologieunternehmen (Big Tech) investieren nun in die Abdeckung ressourcenarmer Sprachen (LRL). Aber Abdeckung ist nicht gleich Qualität, und Qualität ohne unabhängige Überprüfung schafft kein Vertrauen. Ressourcenarme Sprachen benötigen mehr als ein Modell, das behauptet, sie abzudecken — sie benötigen eine unabhängige Evaluierung mit morphologischer Validierung, von der Gemeinschaft gepflegte Korpora und eine Governance, die die Souveränität respektiert.

**champollion wurde entwickelt, um das zu ändern.**

Das [Method Leaderboard](https://champollion.dev/leaderboard) ist eine offene Herausforderung: Entwickeln Sie die beste Übersetzungsmethode für eine unterrepräsentierte Sprache, beweisen Sie dies durch eine reproduzierbare Evaluierung und sichern Sie sich die höchste Punktzahl. Jeder auf der Welt kann einen Beitrag leisten — Linguisten, ML-Forscher, Spracharbeiter aus der Gemeinschaft, Studenten, Hobbyisten. Das Problem ist ungelöst. Die Infrastruktur ist vorhanden. Das Leaderboard wartet.

---

## Warum dies schwierig ist: Polysynthetische Morphologie

Die meisten kommerziellen MÜ-Systeme wurden für Sprachen wie Englisch, Französisch und Chinesisch entwickelt — Sprachen, in denen Wörter relativ kurz sind und Sätze aus diskreten Token gebildet werden. Viele indigene Sprachen, einschließlich Plains Cree, sind jedoch **polysynthetisch**: Ein einziges Wort kann das ausdrücken, wofür im Englischen ein ganzer Satz benötigt wird.

### Das Cree-Beispiel

Betrachten Sie das folgende Wort auf Plains Cree:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"als ich zur Schule ging"*

Das ist **ein einziges Wort**. Es kodiert Tempus (Vergangenheit), Richtung (hingehen), die Wurzel (lernen), Genus Verbi (Passiv/Reflexiv) und Person (erste Person Singular). Ein LLM, das überwiegend mit englischen Texten trainiert wurde, hat keine Intuition für diese Art von morphologischer Dichte.

Die Herausforderungen summieren sich:

| Herausforderung | Bedeutung |
|-----------|--------------|
| **Morphologische Komplexität** | Eine einzige Verbwurzel kann durch Präfigierung, Suffigierung und Zirkumfigierung Tausende von gültigen flektierten Formen erzeugen |
| **Belebt/Unbelebt-Unterscheidung** | Substantive sind grammatikalisch belebt oder unbelebt — dies beeinflusst die Verbkonjugation, Demonstrativpronomina und die Pluralbildung. Die Klassifizierung folgt nicht immer der biologischen Belebtheit (*askiy* "Erde" ist belebt; *maskisin* "Schuh" ist ebenfalls belebt) |
| **Obviation** | Verweise auf die dritte Person werden nach Nähe/Bedeutung (Salienz) eingestuft. Die Unterscheidung zwischen "proximat" (näher) und "obviativ" (ferner) hat keine Entsprechung im Englischen (bzw. Deutschen) |
| **Spärliche Trainingsdaten** | LLMs haben sehr wenig Text auf Plains Cree gesehen. Was sie gesehen haben, vermischt möglicherweise Dialekte (Y-Dialekt, TH-Dialekt) oder Orthografien (SRO vs. Silbenschrift) |
| **Schwache kommerzielle Basislinie** | OMT-1600 stuft CRK in die Kategorie R1 (Sehr ressourcenarm) ein, mit Training im Bibel-Bereich und Standard-BPE-Tokenisierung. Google Translate unterstützt Cree nicht. Eine unabhängige Evaluierung mit morphologischen Metriken ist das, was diese Basislinien aussagekräftig macht. |

Die Übersetzung polysynthetischer Sprachen bleibt ein **offenes Forschungsproblem** — OMT-1600 schließt polysynthetische Sprachen ein, verwendet jedoch eine Standard-BPE-Tokenisierung (256K Vokabular) ohne morphologisches Bewusstsein, was bedeutet, dass es zusammengesetzte Wörter in bedeutungslose Byte-Fragmente zerschreddert.

---

## Stand der Technik: Bisherige Lösungsansätze

### Der ALTLab FST

Die bedeutendste computerlinguistische Ressource für Plains Cree ist der **Endliche Transduktor (Finite-State Transducer, FST)**, der vom [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) an der University of Alberta in Zusammenarbeit mit [Giellatekno](https://giellatekno.uit.no/) an der UiT The Arctic University of Norway entwickelt wurde.

Der ALTLab FST ist ein **morphologischer Analysator und Generator**: Wenn ihm ein flektiertes Cree-Wort übergeben wird, kann er es in seine Wurzel und grammatikalischen Tags zerlegen, und wenn ihm eine Wurzel plus Tags übergeben wird, kann er die korrekte flektierte Form generieren. Dies ist deterministisch — kein neuronales Netzwerk, keine Halluzination, keine Wahrscheinlichkeit. Wenn der FST ein Wort akzeptiert, ist dieses Wort morphologisch gültig.

Aus diesem Grund erfasst das champollion-Leaderboard die **FST-Akzeptanzrate (FST Acceptance Rate)** als Metrik. Eine Übersetzungsmethode, die Wörter produziert, die der FST ablehnt, erzeugt morphologisch ungültiges Cree — unabhängig davon, was der chrF++-Wert besagt.

**Wichtige ALTLab-Ressourcen:**
- [itwêwina](https://itwewina.altlab.app/) — ein intelligentes Plains Cree–Englisch-Wörterbuch, das vom FST angetrieben wird
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — eine quelloffene, morphologisch bewusste Wörterbuchplattform
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — lexikalische Datenbank für Plains Cree
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — der breitere Projektkontext

### Globale FST- & Morphologie-Register

Plains Cree ist nicht die einzige Sprache mit einer hochwertigen FST-Infrastruktur. Wenn Sie Übersetzungspipelines für andere ressourcenarme oder morphologisch komplexe Sprachen entwickeln möchten, können Sie auf diese etablierten globalen Knotenpunkte zurückgreifen:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT The Arctic University of Norway):** Das größte Repository für quelloffene morphologische FST-Analysatoren und -Generatoren, das über 100 Sprachen abdeckt. Zu den Schwerpunkten gehören samische Sprachen (`sme`, `smj`, `sma`, etc.), uralische Sprachen (Komi, Ersjanisch, Udmurtisch, etc.) und andere Minderheiten-/indigene Sprachen. Sie hosten öffentliche verarbeitete Textkorpora (`corpus-xxx`) in ihrer [GitHub-Organisation](https://github.com/giellalt/).
* **[The Apertium Project](https://www.apertium.org/):** Eine quelloffene, regelbasierte Plattform für maschinelle Übersetzung. Apertium pflegt hochoptimierte morphologische FST-Analysatoren (unter Verwendung von `lttoolbox` und `hfst`) und zweisprachige Wörterbücher für Dutzende von Sprachen, darunter eine große Auswahl an Turksprachen (Kasachisch, Tatarisch, Kirgisisch, etc.) und europäischen Minderheitensprachen. Alle Ressourcen sind öffentlich auf [Apertiums GitHub](https://github.com/apertium) zugänglich.
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** Ein Gemeinschaftsprojekt, das standardisierte morphologische Paradigmen für über 150 Sprachen bereitstellt. Der Datensatz wird auf Hugging Face unter [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies) gehostet. Wenn für eine Sprache keine kompilierte FST-Binärdatei verfügbar ist, können UniMorph-Tabellen als statisches Datenbank-Lookup-Gate verwendet werden.
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/):** Bietet Werkzeuge für kanadische indigene Sprachen, einschließlich des morphologischen FST-Analysators **Uqailaut** für Inuktitut und des massiven **Nunavut Hansard Parallel Corpus** (1,3 Millionen abgeglichene englisch-inuktitutische Satzpaare).

### Das EdTeKLA-Korpus

Die [EdTeKLA-Forschungsgruppe](https://spaces.facsci.ualberta.ca/edtekla/) (ebenfalls an der UAlberta) hat ein Plains Cree-Sprachkorpus aus Lehrmaterialien, Audiotranskriptionen und Quellen aus der Gemeinschaft zusammengestellt. Der champollion-Evaluierungsdatensatz [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) ist aus dieser Arbeit abgeleitet und unter [EdTeKLAs modifizierter CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (souveränitätsbezogene, nicht-kommerzielle Bedingungen) veröffentlicht.

### Andere Ansätze, die ausprobiert wurden oder werden könnten

Das Leaderboard ist methodenunabhängig. Hier sind Strategien, die für ressourcenarme MÜ untersucht oder vorgeschlagen wurden und von denen jede eingereicht werden könnte:

| Ansatz | Funktionsweise | Vorteile | Nachteile |
|----------|-------------|------|------|
| **[Gecoachtes LLM-Prompting](/docs/network/tutorials/coached-llm-prompting)** | Injizieren von Grammatikregeln, Wörterbüchern und Beispielpaaren in den System-Prompt | Schnelle Iteration, kein Training erforderlich | Qualitätsgrenze durch das Basiswissen des LLMs limitiert |
| **[Few-Shot-Prompting](/docs/network/tutorials/few-shot-prompting)** | Einbeziehen verifizierter Übersetzungen als In-Context-Beispiele | Gut für einen konsistenten Stil | Kleines Kontextfenster; Beispiele dürfen NICHT aus den Evaluierungsdaten stammen |
| **[FST-gesteuerte Pipeline](/docs/network/tutorials/fst-gated-pipeline)** | LLM generiert → FST validiert → lehnt ab und wiederholt bei ungültiger Morphologie | Garantiert morphologische Gültigkeit | Erfordert FST-Infrastruktur; Wiederholungsschleifen erhöhen Latenz und Kosten |
| **[Wörterbuch-Lookup + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | Erzwingen bekannter Begriffe aus einem zweisprachigen Wörterbuch, das LLM übernimmt den Rest | Reduziert Halluzinationen bei bekannten Begriffen | Wörterbuchabdeckung ist immer unvollständig |
| **[Feinabgestimmtes Modell (Fine-Tuning)](/docs/network/tutorials/fine-tuned-model)** | Feinabstimmung eines offenen Modells (Llama, Mistral) mit parallelen Texten — nur nicht mit den Evaluierungsdaten | Potenziell höchste Qualität | Erfordert paralleles Korpus (selten); teuer; Risiko der Überanpassung (Overfitting) |
| **[Verkettete Modelle (Chained Models)](/docs/network/tutorials/chained-models)** | Modell A generiert Rohübersetzung → Modell B führt Post-Editing durch → Modell C bewertet | Kann Stärken von Spezialisten kombinieren | Komplex; langsam; teuer |
| **[Regelbasiert + LLM-Hybrid](/docs/network/tutorials/rule-based-hybrid)** | Verwendung linguistischer Regeln für bekannte Muster, LLM für alles andere | Präzise dort, wo Regeln greifen | Erfordert tiefgreifende linguistische Expertise |
| **[Rückübersetzungs-Augmentierung (Back-Translation)](/docs/network/tutorials/back-translation)** | Generierung synthetischer paralleler Daten durch Übersetzung Cree→Englisch, anschließendes Training in umgekehrter Richtung | Erweitert Trainingsdaten kostengünstig | Verstärkt bestehende Modellfehler |
| **[Evolutionärer Ansatz](/docs/network/tutorials/evolutionary-approach)** | Generierung von Übersetzungs-Kandidaten, Bewertung, Mutation der besten Ergebnisse, Wiederholung | Kann neuartige Lösungen entdecken; parallelisierbar | Rechenintensiv; benötigt eine gute Fitnessfunktion |
| **[Partielle Übersetzung](/docs/network/tutorials/partial-translation)** | Manuelle Übersetzung einer repräsentativen Stichprobe, Nachweis, dass die Methode den Stil trifft, dann automatische Übersetzung des restlichen Volumens | Kombiniert menschliche Qualität mit maschineller Skalierung | Erfordert anfänglichen menschlichen Aufwand |
| **Manuelle JSON- / Prüfungsbewertung** | Manuelle Erstellung einer JSON-Datensatzdatei zum Testen von Schülerantworten in einer Sprachprüfung oder Bewertung einer Charge menschlicher Übersetzungen gegen einen Goldstandard | Kein ML erforderlich; funktioniert für Bildung und Qualitätssicherung | Skaliert nicht für fortlaufenden Übersetzungsbedarf |

### Es ist nur JSON

Die Evaluierungsumgebung nimmt JSON entgegen und gibt bewertetes JSON aus. Das [Datensatzformat](/docs/network/leaderboard/datasets) ist einfach:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

Sie können dies von Hand erstellen. Sie können es aus einer Tabellenkalkulation exportieren. Sie können es aus einem Korpus generieren. Ein Sprachlehrer könnte es verwenden, um die Übersetzungen von Schülern zu bewerten. Eine Übersetzungsagentur könnte es nutzen, um Freiberufler zu vergleichen. Ein Forschungslabor könnte damit Modellarchitekturen vergleichen. Der Evaluierungsumgebung ist es egal, woher das JSON stammt — sie bewertet es einfach.

Und da das Framework für den produktiven Einsatz dieselbe Plugin-Schnittstelle verwendet, lässt sich eine Methode, die in der Evaluierungsumgebung gut abschneidet, mit einer einzigen Konfigurationsänderung auf Ihrer Website bereitstellen. **Beweisen Sie es und nutzen Sie es.**

Die Möglichkeiten sind wirklich endlos. **Wenn Sie eine Idee haben, setzen Sie sie um, führen Sie die Evaluierungsumgebung aus und reichen Sie Ihre Ergebnisse ein.**

---

## Wie champollion ins Bild passt

champollion stellt die Infrastrukturebene bereit — Sie bringen die Methode mit.

### Das Coaching-System

Die `llm-coached`-Methode von champollion ermöglicht es Ihnen, linguistisches Wissen direkt in den LLM-Prompt zu injizieren:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

Die Coaching-Daten werden in jeden LLM-Prompt für das `en:crk`-Paar injiziert, wodurch das Modell einen strukturierten linguistischen Kontext erhält, den es sonst nicht hätte. Siehe [Coaching-Daten](https://champollion.dev/docs/concepts/coaching-data) für die vollständige Spezifikation.

### Register

Das Register ist Teil des System-Prompts, der Tonfall, Formalität und orthografische Konventionen steuert. champollion wird mit einem Plains Cree-Register ausgeliefert:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

Sie können dies in Ihrer Konfiguration überschreiben, um mit verschiedenen Prompting-Strategien zu experimentieren:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

Unterschiedliche Register erzeugen unterschiedliche Übersetzungsstile — und unterschiedliche Punktzahlen auf dem Leaderboard. Jede Einreichung zeichnet das genaue Register und den verwendeten System-Prompt auf (als SHA-256-Hash in der [Run Card](/docs/network/specifications/run-card)), sodass Experimente reproduzierbar sind.

### Schriftkonvertierung

Plains Cree wird in zwei Schriften geschrieben: **Standard Roman Orthography (SRO)** und **Canadian Aboriginal Syllabics** (kanadische indigene Silbenschrift). Die Pipeline von champollion:

1. Das LLM übersetzt in SRO (lateinbasiert, womit LLMs besser umgehen können)
2. Ein Quality Gate validiert die SRO-Ausgabe
3. Ein deterministischer Konverter wandelt SRO → Silbenschrift um
4. Der konvertierte Text wird auf die Festplatte geschrieben

Der Konverter verarbeitet alle SRO-Diakritika (ê, î, ô, â für lange Vokale) und ordnet sie den korrekten Silbenzeichen zu. Siehe [Schriftkonverter](https://champollion.dev/docs/concepts/script-converters) für technische Details.

### Die Evaluierungsschleife

Die [Evaluierungsumgebung (Eval Harness)](/docs/network/specifications/harness) führt Ihre Methode gegen den Evaluierungsdatensatz aus und erstellt eine bewertete [Run Card](/docs/network/specifications/run-card):

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

Das Flag `--name` ist ein von Ihnen gewähltes Label. Es erscheint auf dem Leaderboard, damit andere sehen können, welche Prompt-Strategie Sie verwendet haben. Die Evaluierungsumgebung zeichnet den vollständigen System-Prompt in der Run Card auf, sodass Ihr genauer Ansatz reproduzierbar ist.

:::tip[Experimentieren Sie frei, reichen Sie Ihr Bestes ein]
Die Evaluierungsumgebung ist für schnelle Iterationen konzipiert. Führen Sie Dutzende von Experimenten mit verschiedenen Modellen, Coaching-Daten, Registern und Bedingungen durch. Reichen Sie erst dann etwas beim Leaderboard ein, wenn Sie ein Ergebnis haben, auf das Sie stolz sind.
:::

---

## Prinzipien der Datensouveränität {#data-sovereignty-principles}

champollion wurde entwickelt, um die indigene Datensouveränität zu unterstützen. Eigentum, Kontrolle, Zugang und Besitz der Gemeinschaften an ihren Sprachdaten leiten unseren Ansatz für Sprachtechnologie für indigene Gemeinschaften:

| Prinzip | Wie champollion es unterstützt |
|-----------|------------------------|
| **Ownership (Eigentum)** | Sprachgemeinschaften besitzen ihre linguistischen Daten. champollion telefoniert niemals nach Hause oder überträgt Daten an unsere Server |
| **Control (Kontrolle)** | Die [API-Methode](https://champollion.dev/docs/guides/serving-a-method) ermöglicht es Gemeinschaften, ihre eigene Übersetzungspipeline zu hosten — wir stellen die Schnittstelle bereit, sie kontrollieren die Implementierung |
| **Access (Zugang)** | Die Gemeinschaften entscheiden, wer ihre Methode nutzen darf. Die API kann durch Authentifizierung geschützt werden |
| **Possession (Besitz)** | Alle Übersetzungsdaten verbleiben im Dateisystem Ihres Projekts. Das [Provenienzsystem](https://champollion.dev/docs/concepts/security) verfolgt, woher jede Übersetzung stammt |

Die Plugin-Architektur bedeutet, dass eine Gemeinschaft eine Methode entwickeln kann, die heiliges oder vertrauliches Wissen intern einbezieht, nur die Übersetzungs-API nach außen freigibt und die volle Kontrolle über ihre linguistischen Ressourcen behält.

---

## Die Vision: Was als Nächstes kommt

Plains Cree ist das erste Ziel. Sobald die Pipeline validiert ist und die Gemeinschaft mit der Qualität zufrieden ist, lässt sich dieselbe Architektur auf andere polysynthetische Sprachen mit FST-Infrastruktur ausweiten:

- **Andere Algonkin-Sprachen**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **Inuit-Sprachen**: Inuktitut, Inuinnaqtun (die ebenfalls Silbenschriften verwenden)
- **Andere Sprachfamilien**: Jede Sprache mit einem FST-Analysator kann die FST-gesteuerte Pipeline nutzen

Das Leaderboard ist auf Sprachpaare beschränkt. Wenn Sprachgemeinschaften neue Evaluierungsdatensätze beisteuern, werden automatisch neue Leaderboard-Kategorien (Tracks) eröffnet.

**Dies ist eine offene Einladung.** Wenn Sie mit einer ressourcenarmen Sprache arbeiten — als Forscher, Mitglied einer Gemeinschaft, Student oder einfach als jemand, dem das Thema am Herzen liegt — gibt Ihnen champollion die Werkzeuge an die Hand, um etwas Reales zu erschaffen, es ehrlich zu messen und es mit der Welt zu teilen. Das [Method Leaderboard](https://champollion.dev/leaderboard) wartet auf Ihre Einreichung.

---

## Siehe auch

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — Reichen Sie Ihre Ergebnisse ein und sehen Sie, wie Methoden im Vergleich abschneiden
- **[MÜ-Evaluierung](/docs/network/leaderboard/rules)** — Was eine gute Methode ausmacht, was zur Disqualifikation führt
- **[Evaluierungsumgebung (Eval Harness)](/docs/network/specifications/harness)** — Wie man Experimente durchführt
- **[Evaluierungsdatensätze](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 und FLORES+
- **[Coaching-Daten](https://champollion.dev/docs/concepts/coaching-data)** — Wie man linguistisches Wissen für das LLM strukturiert
- **[Schriftkonverter](https://champollion.dev/docs/concepts/script-converters)** — Die SRO→Silbenschrift-Pipeline
- **[Bereitstellung einer Methode via API](https://champollion.dev/docs/guides/serving-a-method)** — Hosting von gemeinschaftskontrollierter Übersetzung
- **[ALTLab](https://altlab.ualberta.ca/)** — Das Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — Die Forschungsgruppe Educational Technology, Knowledge & Language
- **[itwêwina-Wörterbuch](https://itwewina.altlab.app/)** — FST-gestütztes Plains Cree–Englisch-Wörterbuch
