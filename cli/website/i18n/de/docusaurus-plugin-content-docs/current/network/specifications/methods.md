---
sidebar_position: 4
title: "Methoden-Schnittstelle"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# Gemeinsame Methodenschnittstelle

> **Zusammenfassung.** Diese Seite spezifiziert das `TranslationMethod`-Protokoll, das alle Network-Methoden implementieren müssen, die sechs Methodenklassen (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), die orthogonale **Paradigmen**-Achse (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …), die *die Art und Weise, wie eine Methode übersetzt* systemübergreifend vergleichbar macht, das Format der Methoden-Plugins sowie die **Abhängigkeitsklassen** (S/O/A1/A2/X), die bestimmen, ob eine Methode in der Evaluations-Sandbox ausgeführt werden und sich für Preise qualifizieren kann. Dies sind drei unabhängige Achsen. Jeder Ansatz, der dieses Protokoll implementiert, kann bewertet werden; wovon er abhängt, bestimmt, wo er antreten kann.

Das Eval-Harness und champollion teilen ein gemeinsames Konzept der **Übersetzungsmethode**. Eine Methode ist jedes Verfahren, das Quelltext entgegennimmt und übersetzten Text erzeugt — sei es ein direkter LLM-Aufruf, eine mehrstufige Pipeline, eine Drittanbieter-API oder eine menschliche Übersetzerin bzw. ein menschlicher Übersetzer.

## Architektur

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

Geladen über `--method path/to/dir`. Das Harness erkennt nichts automatisch.

## Zwei Systeme, eine Schnittstelle

| | Eval-Harness | champollion |
|---|---|---|
| **Sprache** | Python | Node.js |
| **Einstiegspunkt** | `translate.py` | `translate.js` |
| **Schnittstelle** | `TranslationMethod`-Protokoll | `methodPlugin`-Konfiguration |
| **Zweck** | Batch-Evaluation mit Bewertung | Live-Lokalisierung in Dev/CI |
| **Ausgabe** | Run-Card mit Metriken | Übersetzte Locale-Dateien |

Eine Methode, die beide Systeme unterstützt, stellt zwei Einstiegspunkte bereit — einen für jede Sprachlaufzeitumgebung. Die **Method-Card** ist das Bindeglied: Sie beschreibt die Methode in einem Format, das beide Systeme verstehen.

## Method-Card {#method-card}

Eine Method-Card beschreibt, *was* eine Übersetzungsmethode ist, ohne proprietäre Details wie den vollständigen System-Prompt preiszugeben. Sie beantwortet folgende Fragen:

- Welche Klasse von Methode ist dies? (Raw-LLM, Coached-LLM, Pipeline, API usw.)
- Welches **Paradigma** verwendet sie? (rule-based, statistical, neural-nmt, llm, hybrid)
- Welche Werkzeuge verwendet sie? (FST-Analyzer, Wörterbuch usw.)
- Ist die Implementierung Open Source?
- Welche Sprachpaare unterstützt sie?

Das vollständige JSON-Schema finden Sie in der [Method-Card-Spezifikation](/docs/network/specifications/methods#method-card).

### Beispiel

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

Das Feld `dependency_class` fasst zusammen, was die Methode zur Ausführung und Übertragung benötigt — siehe [Methodengültigkeit und Abhängigkeitsklassen](#method-validity-and-dependency-classes) weiter unten. Das Feld `paradigm` ordnet die Methode auf der **Paradigmen-Achse** ein (hier `hybrid`: ein LLM, das durch ein regelbasiertes FST gesteuert wird) — siehe [Paradigmen](#paradigms) weiter unten.

### Methodenklassen

| Klasse | Beschreibung |
|-------|-------------|
| `raw-llm` | Direkter LLM-Aufruf mit minimaler Anweisung |
| `coached-llm` | LLM mit strukturiertem Prompt, Beispielen, Einschränkungen |
| `pipeline` | Mehrstufige Pipeline mit deterministischen Komponenten |
| `custom-plugin` | Externer Prozess, der das `TranslationMethod`-Protokoll implementiert |
| `api` | Drittanbieter-Übersetzungs-API (Google Translate, DeepL usw.) |
| `human` | Menschliche Übersetzung (zur Festlegung von Baselines) |

### Paradigmen {#paradigms}

Das **Paradigma** ist eine dritte, unabhängige Achse: *wie eine Methode auf algorithmischer Ebene übersetzt*. Es ist orthogonal sowohl zur Methodenklasse als auch zur Abhängigkeitsklasse. Die Methodenklasse allein ist LLM-zentriert — ein regelbasiertes [Apertium](https://www.apertium.org/)-System und Google Translate landen beide in `pipeline`/`api`, sodass „rule-based vs. neural“ ohne sie unsichtbar bleibt. Die Paradigmen-Achse macht diesen Vergleich erstklassig und auf der Bestenliste filterbar.

| Paradigma | Beschreibung | Beispiele |
|----------|-------------|----------|
| `rule-based` | Endliche Transduktoren, handgeschriebene Grammatiken, morphologischer Transfer | Apertium, GiellaLT-FST-Generierung |
| `statistical` | Phrasenbasierte / statistische MT (SMT), gelernt aus parallelen Korpora | klassisches Moses |
| `neural-nmt` | Ein dediziertes neuronales Encoder-Decoder-MT-Modell | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | Ein universell einsetzbares großes Sprachmodell, das zum Übersetzen aufgefordert wird | ein Raw- oder Coached-Aufruf von GPT / Claude / Gemini |
| `hybrid` | Kombiniert zwei oder mehr Paradigmen in einer Methode | ein LLM, das durch ein regelbasiertes FST gesteuert wird (crk-translate); NMT + regelbasiertes Post-Editing |
| `human` | Menschliche Übersetzung (Baseline auf Paradigmen-Ebene) | Baseline von Community-Übersetzenden |
| `unknown` | Nicht angegeben — die Card deklarierte kein Paradigma | Abwärtskompatibilitäts-Standard für Cards aus der Zeit vor den Paradigmen |

Die Achsen sind unabhängig. Einige ausgearbeitete Beispiele:

| Methode | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (selbst gehostet, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-gesteuert, LLM-gecoacht) | `pipeline` | `hybrid` | A2 |
| Raw-GPT-Aufruf | `raw-llm` | `llm` | A1 |

Das Paradigma ist auf einer Method-Card **optional**; ein fehlendes Paradigma wird als `unknown` erfasst (es blockiert niemals die Veröffentlichung — die Achse ist additiv). Das obige Enum ist das kanonische, unterstützte Vokabular, das vom Harness durchgesetzt wird (`config.VALID_PARADIGMS`). Da die Durchsetzung anwendungsseitig statt als Datenbankeinschränkung erfolgt, können später neue Paradigmen ohne Migration hinzugefügt werden; nur das Umbenennen oder Entfernen eines Werts, sobald Methoden darauf angewiesen sind, ist kostspielig.

## Methodengültigkeit und Abhängigkeitsklassen {#method-validity-and-dependency-classes}

Eine Methode ist nur so ausführbar und nur so übertragbar wie ihre am wenigsten verfügbare Abhängigkeit. Zwei Network-Mechanismen sind darauf angewiesen, genau zu wissen, was eine Methode benötigt:

1. **Sandbox-Evaluation** ([Benchmark-Spezifikation §8.2](/docs/network/specifications/benchmark)) — offizielle Gold-Standard-Bewertungen stammen aus einer Sandbox, deren Netzwerkrichtlinie **standardmäßig verweigernd** ist. Eine Methode, die stillschweigend einen externen Dienst benötigt, kann keine offizielle Bewertung erzeugen.
2. **Preisübertragung** ([Preis-Spezifikation](/docs/network/specifications/prizes)) — preisgekrönte Methoden werden an die Governance-Organisation der Sprachgemeinschaft übertragen. Eine Methode, die Inhalte bündelt, die einzureichen die einreichende Person kein Recht hatte, kann nicht rechtmäßig übertragen werden. Die einreichende Person muss die Rechte an allem, was in der Box enthalten ist, besitzen (oder gewährt bekommen).

Um beide Prüfungen mechanisch statt ad hoc zu gestalten, deklariert jede Methode eine **Abhängigkeitsklasse**, die aus einem **Abhängigkeitsmanifest** in `method.json` abgeleitet wird.

> **Hinweis zur Benennung — drei unabhängige Achsen.** Die *Methodenklasse* (§oben: `raw-llm`, `pipeline`, …) beschreibt die *Form* einer Methode — den Schnittstellenvertrag, den sie präsentiert. Das *Paradigma* ([§Paradigmen](#paradigms): `rule-based`, `neural-nmt`, `llm`, …) beschreibt, *wie sie algorithmisch übersetzt*. Die *Abhängigkeitsklasse* (dieser Abschnitt) beschreibt, *was sie zur Ausführung und Übertragung benötigt*. Die drei sind orthogonal: Eine `pipeline`-Methode kann `rule-based` oder `hybrid` sein und kann jede beliebige Abhängigkeitsklasse haben. (Klasse und Paradigma sind absichtlich getrennt, da die Klasse allein LLM-zentriert ist — sie kann ein regelbasiertes System nicht von einem neuronalen unterscheiden, wenn beide sich als `pipeline` oder `api` präsentieren.)

### Die fünf Abhängigkeitsklassen

| Klasse | Name | Definition | Sandbox-ausführbar? | Preisberechtigt? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Eigenständig | Sämtlicher Code, Daten, Modelle und Gewichte werden im Methodenverzeichnis mitgeliefert, unter Lizenzen, die eine Weitergabe und Community-Übertragung erlauben. | ✅ Ja, unverändert | ✅ Ja |
| **O** | Offen extern | Hängt von extern gehosteten Artefakten unter offenen Lizenzen ab, die eine Weitergabe erlauben (einschließlich Copyleft-Lizenzen wie AGPL) — z. B. ein FST, das zur Installationszeit heruntergeladen wird. | ✅ Ja — Artefakte werden gepinnt und **in die Einreichung gespiegelt** | ✅ Ja, mit Bedingungen zur Lizenzkompatibilität: Copyleft-Bedingungen bleiben durch die Übertragung erhalten, und die Community erhält dieselben Rechte, die die Lizenz allen gewährt |
| **A1** | API-abhängig, ersetzbar | Erfordert LLM-Inferenz zur Laufzeit, wobei das Modell **ersetzbare Konfiguration** ist — jedes hinreichend leistungsfähige Modell kann eingesetzt werden. Der Wert der Methode liegt in ihren Prompts, Coaching-Daten und ihrem Code, nicht im Modell eines bestimmten Anbieters. | ⚠️ Nur über das **LLM-Gateway**, das die Sandbox-Spezifikation definiert (🔲 geplant — siehe unten) | ⚠️ Bedingt — siehe unten |
| **A2** | API-abhängig, nicht ersetzbar | Erfordert Laufzeitaufrufe an eine externe Daten- oder Dienst-API, die nicht gespiegelt oder ersetzt werden kann — typischerweise, weil die bereitgestellten Inhalte proprietär oder nicht lizenziert sind (z. B. eine Wörterbuch-API, deren zugrunde liegendes Wörterbuch keine öffentliche Lizenz hat). | ❌ Nein — die Abhängigkeit kann in der Sandbox ohne Genehmigung des Rechteinhabers nicht existieren | ❌ Nicht, bis der Rechteinhaber die Sandbox-Aufnahme **und** die Übertragungsberechtigungen gewährt. Auf der offenen Bestenliste (Entwicklungssegment) mit einem sichtbaren **„externe Abhängigkeit“**-Kennzeichen erlaubt |
| **X** | Geschlossen | Bündelt Inhalte, die die einreichende Person nicht weitergeben darf — nicht lizenzierte Datensätze, gescrapte proprietäre Inhalte, lizenzinkompatible Komponenten. | ❌ | ❌ In jeder Kategorie unzulässig. Das Bündeln von Inhalten ohne Rechte ist eine Lizenzverletzung, unabhängig davon, wo die Methode ausgeführt wird |

**Effektive Klasse.** Die Abhängigkeitsklasse einer Methode ist die *restriktivste* Klasse unter all ihren deklarierten Abhängigkeiten, in der Reihenfolge S < O < A1 < A2 < X. Ein einziges nicht lizenziertes Wörterbuch macht eine ansonsten eigenständige Pipeline zur Klasse A2 (bei Laufzeitzugriff) oder Klasse X (bei Bündelung ohne Rechte).

### Die A1/A2-Unterscheidung: Ersetzbarkeit

Die meisten Methoden rufen LLMs auf. Das Network gibt nicht vor, dass es anders wäre — aber es unterscheidet zwei sehr unterschiedliche Arten von API-Abhängigkeit:

- **A1 (ersetzbar):** Die API stellt handelsübliche LLM-Inferenz bereit. Der Modellbezeichner ist Konfiguration: Die Methode muss durchgängig gegen jeden kompatiblen Inferenz-Endpunkt laufen, einschließlich eines von der Community gehosteten Open-Weight-Modells. Die Ausgabequalität kann zwischen Modellen variieren — das ist das Risiko der entwickelnden Person, und offizielle Bewertungen sind an das gepinnte Modell gebunden, das bei der Evaluation verwendet wird. Eine Methode, die von **anbieterseitigem Zustand** abhängt (ein nur beim Anbieter gehostetes Fine-Tune, anbieterseitige Dateispeicher, anbieterspezifische Assistenten), ist *nicht* ersetzbar: Dieser Zustand kann nicht ausgetauscht werden, sodass die Abhängigkeit A2 ist, es sei denn, die zugrunde liegenden Gewichte oder Daten sind in der Einreichung enthalten.
- **A2 (nicht ersetzbar):** Die API stellt etwas Einzigartiges bereit — typischerweise proprietäre oder nicht lizenzierte Daten. Kein alternativer Endpunkt kann sie liefern, und die Inhalte können ohne Genehmigung des Rechteinhabers nicht in die Sandbox gespiegelt werden. Die Methode funktioniert auf der offenen Bestenliste (gekennzeichnet), kann aber keine offiziellen Sandbox-Bewertungen erzeugen oder sich für Preise qualifizieren, bis Berechtigungen vorliegen.

**Was eine A1-Preisübertragung tatsächlich vermittelt.** Die Community erhält nicht das Modell — niemand kann die Gewichte von Anthropic, Google oder OpenAI übertragen. Die Übertragung umfasst das vollständige Rezept *um* das Modell herum: alle Prompts, Coaching-Daten, Pipeline-Code, Wiederholungslogik, Konfiguration und dokumentierte Modellanforderungen. Da das Modell konstruktionsbedingt ersetzbar ist, kann die Community die übertragene Methode auf jeden beliebigen Anbieter richten — oder auf ein Open-Weight-Modell auf ihrer eigenen Hardware — ohne die Beteiligung der entwickelnden Person. Das Rezept gehört ihr; die Engine ist gemietet und ersetzbar.

### Abhängigkeitsmanifest (`method.json`)

Jede Methode deklariert ihre Abhängigkeiten im `method.json`-Manifest. Jeder Eintrag erfasst, was das Artefakt ist, woher es stammt, welche Lizenz es abdeckt und wie die Methode darauf zugreift:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| Feld | Erforderlich | Beschreibung |
|-------|----------|-------------|
| `id` | ✅ | Stabiler Bezeichner für die Abhängigkeit |
| `kind` | ✅ | `data`, `model`, `software` oder `service` |
| `license` | ✅ | SPDX-Bezeichner, `proprietary` oder `none`. `none` bedeutet, dass keine öffentliche Lizenz existiert — wird als alle Rechte vorbehalten behandelt |
| `access` | ✅ | `bundled` (wird im Methodenverzeichnis mitgeliefert), `mirrored` (bei der Installation abgerufen, gepinnt, in die Einreichung eingebunden), `gateway` (LLM-Inferenz zur Laufzeit über das Evaluations-Gateway), `external-api` (jeder andere Netzwerkaufruf zur Laufzeit) |
| `source` | ✅ | Kanonische URL oder `provider:slug`-Bezeichner |
| `pin` | für `mirrored` | Version, Commit oder Content-Hash, der das exakte Artefakt pinnt |
| `substitutable` | für `gateway`/`external-api` | Ob ein beliebiger kompatibler Endpunkt diese Abhängigkeit bedienen kann |
| `redistributable` | ✅ | Ob die Lizenz die Weitergabe des Artefakts erlaubt |
| `transferable` | ✅ | Ob das Artefakt (oder die Rechte daran) unter Preisübertragungsbedingungen an eine Community übertragen werden kann |
| `notes` | ❌ | Freiformkontext |

**Klassenableitung.** Jede Abhängigkeit trägt eine Klasse bei; die `dependency_class` der Methode ist die restriktivste:

| Abhängigkeitsprofil | Trägt bei |
|--------------------|-------------|
| `bundled` + Lizenz erlaubt Weitergabe und Übertragung | S |
| `mirrored` + offene Lizenz, die die Weitergabe erlaubt (Copyleft eingeschlossen) | O |
| `gateway` + `substitutable: true` (LLM-Inferenz) | A1 |
| `external-api` oder `gateway` mit `substitutable: false` | A2 |
| `bundled` + `license: none` oder weitergabeinkompatible Lizenz | X |

Die deklarierte `dependency_class` muss mit der Klasse übereinstimmen, die das Harness aus dem Manifest ableitet. Eine Nichtübereinstimmung ist ein Validierungsfehler.

Eine Methode **ohne** externe Abhängigkeiten deklariert `"dependency_class": "S"` und `"dependencies": []`. Das leere Array ist eine bejahende Aussage, die wie jede andere geprüft wird.

### Wie die Gültigkeit überprüft wird

Drei Ebenen, von der kostengünstigsten zur maßgeblichsten:

1. **Manifest-Prüfung.** Das Harness leitet die effektive Klasse aus dem Manifest ab und weist Nichtübereinstimmungen zurück. Prüfende gleichen jede deklarierte Abhängigkeit mit ihrer angegebenen Lizenz und Quelle ab — eine als `redistributable: true` deklarierte Abhängigkeit, deren Upstream-Lizenz etwas anderes besagt, besteht die Prüfung nicht.
2. **Statische Analyse.** Eingereichter Code wird auf Netzwerkaufrufe, dynamische Downloads und Dateisystemzugriffe untersucht, die das Manifest nicht berücksichtigt. Eine bei der Prüfung gefundene *nicht deklarierte* Abhängigkeit ist ein Ablehnungsgrund, unabhängig davon, welche Klasse sie gewesen wäre — das Manifest muss vollständig sein, nicht nur zutreffend.
3. **Sandbox-Netzwerkrichtlinie.** Die Sandbox-Spezifikation erfordert **standardmäßig verweigernden ausgehenden Datenverkehr**: Methodencontainer erhalten keinen Netzwerkzugriff, sofern ein Pfad nicht explizit auf einer Zulassungsliste steht. Der einzige ausgehende Pfad, den die Spezifikation definiert, ist das **LLM-Gateway** — ein Inferenz-Proxy, der von der Evaluationsinfrastruktur betrieben wird, beschränkt auf eine explizite Zulassungsliste gepinnter Modelle, wobei jede Anfrage und Antwort für die Prüfung nach dem Lauf protokolliert wird. Alles, was nicht auf der Zulassungsliste steht, scheitert auf der Netzwerkebene, nicht auf der Richtlinienebene. Siehe [Benchmark-Spezifikation §8.6](/docs/network/specifications/benchmark) für die Netzwerkrichtlinie und das Gateway-Design.

> **Zwei verschiedene Sandboxes — eine geplant, eine live.** Lesen Sie dies aufmerksam, denn das Wort „Sandbox“ umfasst zwei unterschiedliche Dinge:
>
> - 🔲 **Geplant: die Plattform-Sandbox und ihr LLM-Gateway.** Die in diesem Abschnitt beschriebene, von der Evaluierungsinfrastruktur betriebene Umgebung — jene, deren LLM-Gateway es Methoden der Klasse A1 ermöglichen würde, offizielle Gold-Standard-Bewertungen zu erzeugen — ist spezifiziert, aber noch nicht gebaut. Bis dahin sind Methoden der Klasse A1 *im Prinzip* preisberechtigt, können jedoch noch keine offiziellen Gold-Standard-Bewertungen erzeugen.
> - ✅ **Live: die Methodenausführungsspur des Organisator-Knotens.** Der eigene Bewertungsknoten eines Wettbewerbsorganisators führt vorgeschlagene Methoden-Bundles bereits innerhalb eines netzwerkisolierten Containers aus (`mt-eval node run-method`): gebaut und ausgeführt mit `--network=none`, schreibgeschütztem Root, mit einbezogenen Abhängigkeiten (vendored) — was ihn auf Methoden beschränkt, die kein Laufzeitnetzwerk benötigen (Klasse S/O per Konstruktion). Er kann auf einer echten Air-Gap-Maschine laufen, wobei signierte Bundles mit ausschließlich Bewertungsdaten über Wechselmedien übertragen werden. Siehe [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) für den durchgängigen Ablauf.
>
> Dieser Abschnitt beschreibt, was die Plattformspezifikation erfordert, nicht das, was derzeit auf der Plattform ausgeführt wird.

### Anzeige auf der Bestenliste

- Die Bestenliste zeigt die Abhängigkeitsklasse jeder Methode neben ihrem Methodenklassen-Badge an.
- Methoden der Klasse A2 auf der offenen Bestenliste tragen ein sichtbares **„externe Abhängigkeit“**-Kennzeichen: Ihre Bewertungen hängen von einem Drittanbieterdienst ab, der sich ändern oder verschwinden kann, und sie sind derzeit nicht preisberechtigt.
- Methoden der Klasse X werden nicht aufgeführt.

## Eval-Harness: TranslationMethod-Protokoll {#eval-harness-translationmethod-protocol}

Das Eval-Harness verwendet Pythons strukturelle Typisierung (`Protocol`) für Plugins. Jede Klasse mit den richtigen Mitgliedern funktioniert — keine Vererbung erforderlich. Das Protokoll hat **drei** erforderliche Mitglieder, nicht nur `translate`:

1. **`name`** (`str`) — menschenlesbarer Methodenname, verwendet in Run-IDs und Logs.
2. **`method_card()`** (`-> dict | None`) — Methodenmetadaten für die Herkunftsverfolgung, eingebettet im Run-Log und in der veröffentlichten Run-Card. Geben Sie `None` zurück, wenn die Methode keine Card besitzt.
3. **`async translate(entries, config)`** (`-> list[dict]`) — die Übersetzung selbst: ein Stapel von Einträgen hinein, ein Ergebnis-Dict pro Eintrag hinaus.

Wenn das Harness ein Plugin über `--method path/to/dir` lädt, validiert es, dass `translate` aufrufbar ist, und liest anschließend `method.name` und ruft `method.method_card()` bedingungslos auf — ein Plugin, dem eines von beiden fehlt, stürzt zur Ladezeit ab, statt kontrolliert fehlzuschlagen.

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

Das Plugin-Verzeichnis benötigt ein `method.json`-Manifest mit mindestens `name` und `entry_point` (`"module_name:ClassName"` — das Modul wird aus dem Plugin-Verzeichnis geladen und die Klasse instanziiert). Wenn eine zurückgegebene Method-Card ein `class` oder `paradigm` deklariert, muss sie das oben genannte kanonische Vokabular verwenden — eine Card außerhalb der Taxonomie schlägt zur Ladezeit bei der Validierung fehl, anstatt stillschweigend aus den Filtern der Bestenliste zu fallen.

Für ein vollständig ausgearbeitetes Beispiel — das Erstellen, Ausführen und Einreichen eines Plugins von Anfang bis Ende — siehe [Eine Methode einreichen](/docs/network/getting-started/submit-a-method) und das [Cookbook zur FST-gesteuerten Pipeline](/docs/network/tutorials/fst-gated-pipeline).

## champollion: methodPlugin-Konfiguration

In champollion werden Methoden pro Sprachpaar in `champollion.config.json` registriert:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

Siehe die [Plugin-Spezifikation](https://champollion.dev/docs/reference/plugin-spec) für die champollion-seitige Schnittstelle.

## Integration in die Bestenliste

Wenn eine Method-Card an einen Lauf angehängt wird (über `--method-card`), wird sie in die Run-Card eingebettet und auf der Bestenliste angezeigt:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

Wenn keine `--method-card` bereitgestellt wurde, startet `mt-eval publish` einen interaktiven Assistenten, der Sie durch die Beschreibung Ihrer Methode führt.

Die Bestenliste zeigt:
- **Klassen-Badge** — visueller Indikator (z. B. „pipeline“, „coached-llm“)
- **Paradigma** — das algorithmische Paradigma (z. B. „rule-based“, „neural-nmt“, „llm“, „hybrid“), eine filterbare Spalte (siehe [Paradigmen](#paradigms))
- **Abhängigkeitsklasse** — S/O/A1/A2 (siehe [Methodengültigkeit und Abhängigkeitsklassen](#method-validity-and-dependency-classes)); A2-Methoden tragen ein „externe Abhängigkeit“-Kennzeichen
- **Methodenname** — aus der Method-Card
- **Verwendete Werkzeuge** — aus der Method-Card aufgelistet
- **Open-Source-Indikator**

Wenn keine Method-Card angehängt ist, zeigt die Bestenliste die Harness-native Konfiguration (Modell, Prompt-Version, Temperatur, aktivierte Werkzeuge).

:::danger[TRAINIEREN SIE NICHT mit Evaluierungsdaten]
Methoden, deren Entwicklungsprozess eine Berührung mit dem Evaluierungsdatensatz umfasste — als Trainingsdaten, Few-Shot-Beispiele, Wörterbucheinträge oder Prompt-Tuning-Material — werden von der Bestenliste **disqualifiziert**. Siehe [MT-Evaluierung](/docs/network/leaderboard/rules) dafür, was eine gute Methode von einer schlechten unterscheidet.
:::

---

## Siehe auch

- [MT-Evaluation](/docs/network/leaderboard/rules) — Überblick, Wert der Bestenliste und Leitfaden zu guten/schlechten Methoden
- [Eval-Harness](/docs/network/specifications/harness) — wie Evaluationen ausgeführt werden
- [Evaluationsdatensätze](/docs/network/leaderboard/datasets) — verfügbare Datensätze (EDTeKLA, FLORES+)
- [Run-Card-Spezifikation](/docs/network/specifications/run-card) — das JSON-Schema der Run-Card
- [Plugin-Spezifikation](https://champollion.dev/docs/reference/plugin-spec) — champollion-seitige Plugin-Schnittstelle
- [Methoden-Bestenliste](https://champollion.dev/leaderboard) — Live-Benchmark-Bewertungen
- [Benchmark-Spezifikation](/docs/network/specifications/benchmark) — Evaluationsprotokoll, Korpusformat, Run-Card-Schema
- [Bewertungsspezifikation](/docs/network/specifications/scoring) — SSOT für Metriken, zusammengesetzte Gewichte und Qualitätsstufen
