---
title: "MCP-Server – der Zugang für Agenten"
sidebar_label: "MCP-Server"
description: "Verbinden Sie einen KI-Agenten über das Model Context Protocol mit Champollion. Zwei Profile: Das rails-Profil (die Standardeinstellung) führt mit sechs Werkzeugen durch ein Sprachprojekt; --profile full stellt 34 Werkzeuge bereit, um Sprachen nachzuschlagen, die Benchmark-Warteschlange und das Korpusregister zu durchsuchen, Evaluationen durchzuführen, Modelle zu trainieren und zu exportieren sowie zu übersetzen – und zeigt genau an, welche davon mehr als ein npx install erfordern."
---

# MCP-Server – der Zugang für Agenten

`champollion-mcp-server` stellt Champollion für KI-Agenten über das [Model
Context Protocol](https://modelcontextprotocol.io) über stdio bereit. Es gibt zwei
Profile:

| Profil | Startbefehl | Was es bereitstellt | Entwickelt für |
|---|---|---|---|
| **rails** (Standard) | `npx -y champollion-mcp-server` | sechs Werkzeuge: `start_project`, `project_status`, `run_next_step`, `add_data`, `try_translation`, `explain` | die schrittweise Begleitung eines Sprachprojekts von einem leeren Ordner bis zu einem evaluierten Modell auf dem eigenen Computer |
| **full** | `npx -y champollion-mcp-server --profile full` (oder `CHAMPOLLION_MCP_PROFILE=full`) | 34 Werkzeuge, 3 Ressourcen und 4 Prompts | Erkundung, Benchmarking, schrittweises Training, Übersetzen und das Netzwerk |

Wenn Sie jemandem dabei helfen, ein Übersetzungssystem für dessen Sprache aufzubauen, verwenden Sie das
Profil „rails“; wie Sie es steuern, erfahren Sie unter [Die Rails über
MCP steuern](/docs/agents/mcp), und die Regeln, unter denen Sie arbeiten, finden Sie im [Betriebsvertrag](/docs/agents/contract).

Alles hier ist auch über einfaches HTTP erreichbar – siehe [Maschinenlesbare
Endpunkte](#maschinenlesbare-endpunkte) –, aber der MCP-Server ist die einzige Schnittstelle,
über die ein Agent *handeln* kann (übersetzen, einen Benchmark ausführen, ein Modell trainieren), anstatt
nur zu lesen.

## Installation

```bash
npx -y champollion-mcp-server
```

Registrieren Sie ihn anschließend bei Ihrem Client. Für Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Für Clients, die über eine Datei konfiguriert werden (Claude Desktop, Cursor, Antigravity), fügen Sie Folgendes hinzu:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

Für das vollständige Profil (full) fügen Sie `"--profile", "full"` hinter dem Paketnamen in
`args` ein oder beenden Sie den Befehl `claude mcp add` mit `--profile full`.

## Das Profil „rails“ (Standard)

Die sechs Werkzeuge begleiten ein Sprachprojekt von einem leeren Ordner bis zu einem evaluierten
Modell auf dem eigenen Computer. Jeder Schritt gibt exakt an, welches Werkzeug aufzurufen ist,
und jede Frage, die nur die Person selbst beantworten kann (wer eine Datei besitzt, ob ein
Modell daraus lernen darf, ob der Text den Computer verlassen darf, was erwartet wird,
ob das Ergebnis gut genug ist), wird an sie zurückgegeben. Die Werkzeuge
melden Anzahlen und Spalten, niemals Sätze. Jedes Werkzeug steuert die Befehlszeile `champollion`
als separaten, abgegrenzten Prozess – dieselben Befehle, die auch ein Mensch
eingibt. Dieses Profil ist für kleine Agenten mit kurzen Anweisungen konzipiert.

| Werkzeug | Argumente | Was es tut |
|---|---|---|
| `start_project` | `folder`, `from`, `to`, `target_name?`, `source_name?`, `purpose?`, `parent_dir?`, `confirmed?` | Erstellt ein Projekt (`champollion new`). Der erste Aufruf erstellt nichts und gibt `ask_first` zurück: Geben Sie die Richtung an die Person weiter und führen Sie dann den Aufruf aus, der für ihre Antwort angegeben wird |
| `project_status` | `project_dir`, `wait_seconds?` (bis zu 120) | Der nächste Schritt, aus den Dateien gelesen (`champollion next --json`): dessen Modus, was zu sagen ist, warum, und der genaue Aufruf, der ihn ausführt |
| `run_next_step` | `project_dir`, `step_id`, `answers?`, `confirmed?` | Führt den Schritt aus, den `project_status` gerade genannt hat. Ein Schritt vom Typ `confirm` erfordert `confirmed: true`, nachdem die Person zugestimmt hat; ein Schritt vom Typ `ask_user` benötigt die eigenen Antworten der Person; Schritte vom Typ `human_only` und `wait` werden mit Hinweisen abgelehnt, was stattdessen zu tun ist |
| `add_data` | `project_dir`, `path`, `into?` (`parallel`, `test` oder `lexicon`), `source_col?`, `target_col?`, `sheet?`, `header?`, `usfm_source?`, `replace?` | Bindet eine Datei dort ein, wo sie liegt – eine Tabelle, eine Word-Tabelle, ein Toolbox- oder LIFT-Wörterbuch, eine ELAN-Datei oder USFM-Bibeltexte (`champollion data add`) – und meldet Anzahlen und Spalten, niemals Sätze |
| `try_translation` | `project_dir`, `text` (bis zu 10 Zeilen) | Übersetzt einige Sätze der Person mit dem Modell, das das Projekt bereitstellt. Bei einem Modell, das aus ausschließlich lokalen Sätzen gelernt hat, gibt es die Adresse der projekteigenen Seite zurück, niemals den Text |
| `explain` | `topic`: `rails`, `privacy`, `quality`, `modes`, `improve` oder `off_rails` | Leicht verständliche Erklärungen zum Weitergeben |

## Das vollständige Profil (full)

Alles Folgende beschreibt das **vollständige Profil** – jedes Werkzeug, für Erkundung,
Benchmarking und das Netzwerk:

```bash
npx -y champollion-mcp-server --profile full
```

## Lesen Sie dies, bevor Sie sich darauf verlassen

**Im vollständigen Profil funktionieren vierzehn der 34 Werkzeuge direkt nach einer reinen `npx`-Installation, und `translate` funktioniert,
sobald eine Engine vorhanden ist. Die anderen neunzehn benötigen Python-Pakete, die das npm-Paket
nicht enthält und nicht enthalten kann.** Sie schlagen nicht stillschweigend fehl – jedes gibt einen
Fehler mit Handlungsanweisung zurück, der benennt, was fehlt –, aber Sie sollten die Struktur kennen, bevor
Sie Ihre Abläufe darauf abstimmen.

| Werkzeuge | Funktionieren nach `npx`? | Was zusätzlich benötigt wird |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Ja** – schreibgeschützt, über öffentliche Endpunkte bereitgestellt | nichts |
| `translate` | **Ja**, mit einer Engine | ein API-Schlüssel für die gewählte Engine – oder keiner bei der Methode `local` und einem Modellserver auf Ihrem eigenen Rechner |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Nein | die Evaluationsumgebung – `pipx install mt-eval-harness` |
| die fünfzehn `forge_*`-Werkzeuge | Nein | NMT Forge 0.2.0 oder höher – `python3 -m pip install nmt-forge` (fügen Sie `'nmt-forge[hf]'` hinzu, um zu trainieren und bereitzustellen). Es bringt die Evaluationsumgebung mit und findet Sprachkarten selbstständig; kein Klonen erforderlich |

Für nichts davon ist ein Klonen des Repositorys erforderlich.

## Was die Werkzeuge tun

**Arbeit durchsuchen und Kosten kalkulieren.** `list_queue` und `get_queue_item` durchlaufen die offene
Benchmark-Warteschlange – die nach Priorität geordnete Liste von Messungen, die die
Übersichtskarte am meisten verbessern würden. `estimate_cost` berechnet die Kosten für eine Reihe von Durchläufen, bevor Sie Ausgaben tätigen.

**Informationen nachschlagen.** `search_languages` durchsucht die Sprachkarten nach Name,
Code, Sprachfamilie oder Region und toleriert Tippfehler. Jedes Ergebnis gibt zudem an, wo
die Sprache gesprochen wird (Länder, ein Kartenpunkt, Makroareal) sowie ihre alternativen
Namen – ausschließlich Fakten, für die ihre Karte eine Quelle anführt, jeweils mit dieser Quelle versehen, damit
Sprachen mit ähnlichen Namen unterschieden werden können. Ein Ort ohne Quellenangabe wird
niemals angezeigt; die Zeile weist darauf hin und verlinkt stattdessen auf den Glottolog-Eintrag der Sprache. Karten, die aus den veröffentlichten Kartentabellen von champollion.dev ausgefüllt wurden (bei einer
npm-Installation jede Sprache außerhalb des mitgelieferten Kernbestands), enthalten noch keine
Quellen auf Feldebene – diese folgen mit dem nächsten Upload der Tabellen –, sodass diese
Zeilen statt eines Ortes den Glottolog-Link enthalten. `language_overview` ist der
einseitige Ausgangspunkt für die Entwicklung für eine Sprache: was existiert, was ausgeführt
werden kann und die nächsten Schritte. `get_language` gibt die vollständige Karte mit Quellenangaben zurück.
`list_corpora` listet die registrierten Evaluationskorpora
für ein Sprachpaar oder eine Benchmark-Familie auf – ausschließlich Metadaten (Größe,
Lizenz, Kontaminationsgrad und ob die Testumgebung sie abrufen kann, ein
Zugriffstoken benötigt oder unter Quarantäne hält); Korpusinhalte werden niemals zurückgegeben,
und ein Paar, dessen Korpora sich alle in Quarantäne befinden, weist darauf hin, anstatt
nicht unterstützt zu wirken. `get_results` und `get_run_card` lesen bewertete Durchläufe von
der öffentlichen Bestenliste ab. `get_metric_reliability` beantwortet die Frage, bei der die meisten
Agenten falsch liegen – *welcher Metrik sollte ich für diese Zielsprache vertrauen* –
anhand von Korrelationen mit menschlichen Urteilen pro Sprachfamilie. `list_contests`
und `get_contest` zeigen Wettbewerbe und deren deklarierte Bedingungen an; die Teilnahme an einem solchen Wettbewerb ist ein
von einem Menschen autorisierter CLI-Schritt, niemals ein Werkzeug.

**Handeln.** `translate` leitet Text durch die getestete Pipeline, mit Translation
Memory (Wiederholungen kosten nichts) und einer deterministischen Qualitätsprüfung. Jede Antwort
benennt die Engine, die tatsächlich gelaufen ist, samt Modell und Endpunkt, sofern vorhanden.
`run_benchmark` startet eine Evaluation und gibt **sofort eine Auftrags-ID zurück**,
da reale Durchläufe jedes Client-Timeout überdauern; Sie fragen `get_run_status` mit
dieser ID ab. Ein Auftrag übersteht einen Neustart des Servers: Der Durchlauf läuft weiter, und
das spätere Abfragen derselben ID liefert weiterhin Status und Ergebnisse. Nichts
wird veröffentlicht, es sei denn, Sie übergeben `publish: true`; der Plan gibt dann an, was öffentlich
gemacht werden würde – jede Zeile mit Satztext oder nur Bewertungen; der Prompt oder nur
sein Hash; und wohin –, und eine tatsächliche Veröffentlichung erfordert `publish_ack` im exakten
Wortlaut des Plans, damit der Benutzer sie zuvor gesehen hat. Ein Durchlauf, der ohne diesen Parameter erstellt wurde,
kann später unter derselben Absicherung veröffentlicht werden. `preview_publish` ist schreibgeschützt:
Es zeigt die eigene Veröffentlichungsvorschau der Testumgebung, den exakten Wortlaut und den exakten
`publish_report`-Aufruf, der die Veröffentlichung durchführen würde, und kann selbst nicht veröffentlichen. Es
trägt die MCP-Annotation `readOnlyHint: true`, sodass ein Agenten-Host, der
vor jedem Schreibvorgang nachfragt, dies eigenständig erlauben kann. `publish_report` führt den Schreibvorgang aus
(annotiert mit `destructiveHint` und `openWorldHint`), und `scores_only`
hält den Satztext zurück. Jeder Plan beginnt zudem mit dem
`EVAL PACK:`-Status der Zielsprache – `missing` (mit dem Befehl, der
sie installiert), `ready` oder `none needed` – und nennt die Korpuslizenz sowie deren
`do_not_train`-Bedingung, da der Durchlauf `--yes` besteht. Ein fehlender FST (der
Analysator oder seine pyhfst-Laufzeitumgebung) stoppt den Durchlauf nie: Er wird fortgesetzt, und die
Durchlaufkarte vermerkt, dass die FST-Akzeptanz nicht berechnet wurde. Jeder andere fehlende Teil stoppt den Durchlauf,
bevor übersetzt wird. `skip_fst` und `skip_eval_standard` bewerten ohne diese
Teile, und die Durchlaufkarte vermerkt, was ausgelassen wurde. Der Plan gibt außerdem an, ob
COMET berechnet wird (die Testumgebung berechnet es, sobald `unbabel-comet`
installiert ist; `comet: true` macht es zur Voraussetzung für den Durchlauf), und `metricx` sowie `fuse`
fordern den optionalen MetricX-24- und FUSE-artigen Komparator der Testumgebung an. Für jede
dieser Optionen gibt der Plan aus Sicht der Testumgebung an, ob sie installiert ist, was zu installieren ist
und was heruntergeladen wird. Ein bestätigter Durchlauf, der eine Metrik anfordert, die die Testumgebung
nicht berechnen kann, wird abgelehnt, anstatt ohne sie zu laufen. Die Zeilen `Results:`
und `Cache:` des Plans geben an, wo das Durchlaufprotokoll, der Bericht und der Übersetzungscache abgelegt werden.
Eine Testdatei innerhalb eines Ordners, den `mt-eval contest prepare` als freigabefähig kennzeichnet
(das `public/` eines Wettbewerbs), wird stattdessen in den `runs/`-Ordner des Wettbewerbs ausgeführt, sodass
nichts, was ein Durchlauf schreibt, mit diesem freigegeben wird. Ein Modell auf Ihrem eigenen
Rechner (ein lokaler Server oder `method: "local-model"`, das die Testumgebung
prozessintern ausführt und das keine Bescheinigung benötigt) wird als `$0 API cost (runs on
this machine)` ausgewiesen.

**Trainieren, ohne sich selbst zu täuschen.** `get_training_guardrails` liefert die Regeln zurück,
die aus realen, gemessenen Fehlschlägen abgeleitet wurden. Die fünfzehn `forge_*`-Werkzeuge führen
[NMT Forge](/docs/agents/training) in abgesicherten Einzelschritten
aus – `forge_status` zuerst und nach jedem Schritt (es nennt den nächsten
Befehl und das Werkzeug, das ihn ausführt), `forge_preflight`, um zu sehen, auf welche Schranken ein
Befehl trifft, bevor er abbricht, `forge_prereg_template` und `forge_prereg`,
um Vorhersagen festzuhalten, bevor ein Testergebnis vorliegt (und vor jedem
Benchmark auf dem Testset: ein bewertender Lesevorgang blockiert eine spätere Vorabregistrierung),
`forge_export`, um das Testset einmalig zu bewerten und das trainierte Modell zu paketieren,
`forge_compare` für den A/B-Vergleich zweier Modelle mit dem Vorbehalt bezüglich Fast-Duplikaten neben
dem Gewinner und
`forge_prereg_verdict`, um das eigene Urteil des Benutzers über eine Vorhersage festzuhalten, die Forge
nicht beurteilen kann (ein Freitextbereich) – ausgewiesen als menschliches Urteil, niemals als
berechnetes. `forge_status` listet jeden trainierten Durchlauf mit seiner Dev-Bewertung auf und
meldet, wenn ein Dev-Set saturiert ist (ein perfekter Dev-Score, bei dem die
Checkpoint-Auswahl keine Unterscheidung mehr treffen kann). Wenn die Evaluationsumgebung einen Vorbehalt
zu einem Testscore anbringt (beispielsweise eine nahezu konstante Ausgabe: eine Handvoll Ausgaben,
die für jeden Quellsatz geliefert werden), übernehmen `forge_export`, `forge_status`,
`forge_compare` und `forge_lint` diesen im genauen Wortlaut der Testumgebung, und ein
schwerwiegender Vorbehalt steht im nächsten Schritt an erster Stelle: Die Bewertung wird niemals ohne
ihn zitiert. Eine Ablehnung erfolgt stets
mit Angabe des Fehlers, dessen Relevanz und der Fehlerbehebung. Zwei Schritte dauern länger als jeder
Werkzeugaufruf und laufen stattdessen in einem Terminal: das Training (`nmt-forge run`) und das Bereitstellen des
exportierten Modells (`nmt-forge serve`, wodurch es hinter einem lokalen Endpunkt bereitgestellt wird, den
`translate` und die CLI nutzen können).

### Argumente

`name` ist erforderlich und `name?` ist optional. Jedes Werkzeug, das eine
Sprache entgegennimmt, akzeptiert diese auch als `language`: „`code` oder `language`“ bedeutet, dass
beide Bezeichnungen funktionieren und Sie eine davon übergeben. Die ursprünglichen Bezeichnungen funktionieren weiterhin.

| Werkzeug | Argumente |
|---|---|
| `search_languages` | `query` oder `language`, `limit?` |
| `language_overview` | `code` oder `language`, `source?` |
| `get_language` | `code` oder `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (mindestens eines dieser drei), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` oder `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | keine |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` oder `priority?` (eines davon) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (ein gettext-msgctxt: einer für jeden Text oder einer pro Text), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | ein Modus: `budget?` oder `top?` (Warteschlange), `item_id?` oder `corpus?` mit `model?` (mit `method_dir`, dem Modell, das das Plugin lädt), `method?` oder `method_dir?` (ein Methoden-Plugin-Verzeichnis; `local-model` erfordert `model` – es gibt keinen Standardwert), `allow_model_pair_mismatch?` (`local-model`: Ausführung eines OPUS-MT-Paarmodells, das ein anderes Paar benennt, als Baseline für verwandte Sprachen), `attest_local_transport?` (eine MT-Engine oder ein Plugin; für `local-model` nie erforderlich), `provider?`, `base_url?`, `target_language?`, `script?` (LLM-Durchläufe: die ISO-15924-Schrift, in der die Ausgabe verfasst sein muss, z. B. `Cans` oder `Latn`; der Plan gibt an, wenn die Karte des Ziels mehr als eine auflistet), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` und `skip_eval_standard?` (Element- und Korpus-Durchläufe: Bewertung ohne den FST oder die Standard-Evaluationsmetriken, als nicht berechnet markiert), `comet?` (COMET anfordern: der Durchlauf wird abgelehnt, solange es nicht installiert ist), `metricx?` mit `metricx_model?` und `fuse?` (Element- und Korpus-Durchläufe: der optionale MetricX-24- und FUSE-artige Komparator der Testumgebung, abgelehnt, solange nicht installiert); dann `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (bei einer echten Veröffentlichung: der exakte Wortlaut, den der Plan ausgibt), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (`*_report.json` eines abgeschlossenen Durchlaufs), `scores_only?`, `redact_coaching?`, `anonymous?` (schreibgeschützt: kein `confirm`, Veröffentlichung nicht möglich) |
| `publish_report` | `report` (`*_report.json` eines abgeschlossenen Durchlaufs), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (der exakte Wortlaut, den die Vorschau ausgibt) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (der zu prüfende Befehl), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` oder `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` oder `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (Standard `data/split`, der Pfad, den config.json von `forge_init` liest), `dev?`, `register?` (ein Namenspräfix oder `true` für `project`), `allow_rotate?`, `near_dupe?` (ein Jaccard-Schwellenwert wie 0.6, wenn Forge das Bereinigen von Fast-Duplikaten empfiehlt), `max_group?` (mit `near_dupe`: die größte Gruppe von Fast-Duplikaten), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (mit eigenem `clean_to`, z. B. `corpus.notwins.jsonl` – niemals die Datei mit allen Daten), `companion_config?` (mit `drop_test_twins`: wohin die Konfiguration des duplikatfreien Modells gespeichert wird; Standard `config-notwins.json`), `overwrite?` (eine `clean_to`-Datei ersetzen, die von einer Konfiguration, einem Durchlauf, einem Split oder einem anderen Audit verwendet wird – ohne dies abgelehnt), `full_indices?` (jede Zeilennummernliste vollständig; standardmäßig werden lange Listen als `{count, first}` zurückgegeben), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (auf einen einzelnen Durchlauf festlegen), `allow_after_reads?` (nur für Vorhersagen, die vor den bewerteten Lesevorgängen des Sets geschrieben wurden), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (seine Nummer oder seine eigene ID), `verdict` (`held` oder `missed`), `by` (wer geurteilt hat), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (das Durchlauf-Manifest jedes Modells: dessen Trainingsdaten werden auf Fast-Duplikate geprüft), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Beispielsweise stellen `get_metric_reliability { "language": "crk" }` und
`get_metric_reliability { "target": "crk" }` dieselbe Frage.

### Übersetzen mit einem von Ihnen bereitgestellten Modell

`nmt-forge serve` gibt zwei Adressen für das Modell aus, das es bereitstellt. Verweisen
Sie `translate` auf eine der beiden:

| Argument | Verwenden mit | Beispiel |
|---|---|---|
| `base_url` | `method: "local"` – ein OpenAI-kompatibler Server (auch `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` – der champollion-API-Vertrag | `http://127.0.0.1:8378/translate` |
| `model` | nur LLM-Engines; bei APIs für maschinelle Übersetzung abgelehnt, da diese keine besitzen | `llama3.1` |
| `project_dir` | jede Methode – verwendet das Translation Memory dieses Projekts | `~/my-app` |

Ein Server auf Ihrem eigenen Rechner benötigt keinen Schlüssel. Ein entfernter `api`-Endpunkt liest seinen
Schlüssel aus `CHAMPOLLION_API_KEY` in der Umgebung des Servers. Das Werkzeug lehnt
ein ihm unbekanntes Argument namentlich ab, anstatt es zu ignorieren, sodass ein falsch geschriebenes
Argument Ihren Text nicht unbemerkt an ein anderes Modell senden kann.

### Wo der Server seinen Zustand speichert

Alles liegt in `~/.champollion-mcp/` (setzen Sie `CHAMPOLLION_MCP_HOME`, um
den Speicherort zu ändern):

- **Das Translation Memory von `translate`** ist eine eigene Datei,
  `.champollion/tm.json` in diesem Ordner. Es ist von dem `.champollion/tm.json` eines jeden Projekts
  getrennt. Übergeben Sie `project_dir`, um stattdessen die Datei eines Projekts zu verwenden,
  die `champollion sync` dort nutzt.
- **`run_benchmark`-Aufträge** werden in `jobs.json` erfasst, worin die
  neuesten 50 aufbewahrt werden. Jeder Auftrag besitzt einen Ordner in `jobs/` mit seiner Ausgabe und, bei einem
  Warteschlangenelement oder einem registrierten Korpus, den Ergebnissen der Testumgebung. Ein Durchlauf auf einer Testdatei,
  die Sie vorhalten, schreibt seine Ergebnisse und den Cache neben diese Datei, in
  `results/` – mit Ausnahme einer Datei in einem Ordner, den `mt-eval contest prepare`
  als freigabefähig markiert; dessen Durchlauf schreibt in den Ordner `runs/` des Wettbewerbs. Jeder
  solche Durchlauf erhält dort seinen eigenen `mcp-run-<id>/`-Ordner, und `get_run_status`
  gibt den `mt-eval compare`-Befehl über alle diese Ordner aus
  (`results/mcp-run-*/*_report.json`).
  Warteschlangen-Durchläufe schreiben ihre Berichte nach `eval/logs/harness/queue/` unter dem
  Arbeitsordner des Servers, wie es die Testumgebung immer tut.

:::note[Ausgaben sind absichtlich begrenzt]
`run_benchmark` **lehnt einen unbegrenzten Warteschlangen-Durchlauf ab.** Sie müssen genau eine
Begrenzung übergeben – `budget`, `top` oder ein bestimmtes `item_id`. Es gibt keinen Aufruf, um „einfach die
Warteschlange abzuarbeiten“, da ein Agent, der die Warteschlange missversteht, andernfalls
unbegrenzt Kosten verursachen könnte.
:::

## Protokollversion

Der Transport erfolgt **ausschließlich über stdio** – ein Serverprozess pro Agent.

Die [MCP-Revision vom 28.07.2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
stellte das Protokoll standardmäßig auf Zustandslosigkeit um und verabschiedete den `initialize`-Handshake sowie
den Header `Mcp-Session-Id`. Dieser Server ist in seinem Aufbau davon unberührt: Er nutzt keine
der veralteten Funktionen (Roots, Sampling, Logging), hat nie den veralteten
HTTP+SSE-Transport verwendet und folgt bereits den neuen Leitlinien für aufrufungsübergreifende Zustände –
`run_benchmark` erzeugt ein explizites Auftragshandle, das das Modell zurückgibt,
anstatt sich auf eine Transportsitzung zu stützen.

Er wurde **nicht** auf die neue Revision aktualisiert, da noch kein veröffentlichtes
TypeScript-SDK diese beherrscht. Den [vollständigen
Standpunkt finden Sie in der README des Servers](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server).

## Maschinenlesbare Endpunkte

Für diese ist kein MCP-Client erforderlich:

| Endpunkt | Beschreibung |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | Die [Agenten-Startseite](/for-agents) als unformatiertes Markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Der kuratierte Index dieser Website |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Jede indexierte Seite, direkt eingebettet |
| [`/queue.json`](https://champollion.dev/queue.json) | Die vollständige Benchmark-Warteschlange |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Die obersten Warteschlangenelemente |
| [`/registry.json`](https://champollion.dev/registry.json) | Das Korpusregister |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Der vermessene Sprachgraph |

## Nächste Schritte

- [Die Rails über MCP steuern](/docs/agents/mcp) – das Profil „rails“, Schritt für Schritt
- [Der Betriebsvertrag](/docs/agents/contract) – die Regeln, unter denen ein Agent arbeitet
- [Agenten-Leitfaden – Erstellung & Benchmarking](/docs/agents/measurement)
- [Agenten-Leitfaden – Übersetzen mit der Befehlszeile](/docs/agents/serving)
- [Eine Methode einreichen](/docs/network/getting-started/submit-a-method)
