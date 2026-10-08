---
title: "MCP Server — die Schnittstelle für Agenten"
sidebar_label: "MCP Server"
description: "Verbinden Sie einen KI-Agenten über das Model Context Protocol mit Champollion: 34 Tools zum Nachschlagen von Sprachen, Durchsuchen der Benchmark-Warteschlange und des Korpusregisters, Ausführen von Evaluierungen, Trainieren und Exportieren von Modellen sowie Übersetzen – inklusive der genauen Angabe, welche davon mehr als ein npx install erfordern."
---

# MCP-Server — der Zugang für Agenten

`champollion-mcp-server` macht Champollion für KI-Agenten über das [Model
Context Protocol](https://modelcontextprotocol.io) verfügbar. Wenn Sie ein Agent sind oder einen
anbinden, ist dies der Zugang: **34 Tools, 3 Ressourcen und 4 Prompts**
über stdio.

Alles hier ist auch als einfaches HTTP erreichbar — siehe [Maschinenlesbare Endpunkte](#machine-readable-endpoints) —, aber der MCP-Server ist die einzige Oberfläche, die es einem Agenten ermöglicht, zu *handeln* (übersetzen, einen Benchmark ausführen, ein Modell trainieren), anstatt nur zu lesen.

## Installation

```bash
npx -y champollion-mcp-server
```

Registrieren Sie es anschließend bei Ihrem Client. Für Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Für Clients, die per Datei konfiguriert werden (Claude Desktop, Cursor, Antigravity), fügen Sie Folgendes hinzu:

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

## Lesen Sie dies, bevor Sie sich darauf verlassen

**Vierzehn der 34 Tools funktionieren direkt nach einer reinen `npx`-Installation, und `translate` funktioniert,
sobald eine Engine vorhanden ist. Die anderen neunzehn benötigen Python-Pakete, die das npm-Paket
nicht mitliefert und nicht mitliefern kann.** Sie schlagen nicht stillschweigend fehl – jedes gibt einen
umsetzbaren Fehler zurück, der benennt, was fehlt –, aber Sie sollten die Rahmenbedingungen kennen, bevor
Sie darauf aufbauend planen.

| Tools | Nach `npx` funktionsfähig? | Was zusätzlich benötigt wird |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Ja** – schreibgeschützt, bereitgestellt über öffentliche Endpunkte | nichts |
| `translate` | **Ja**, mit einer Engine | ein API-Schlüssel für die gewählte Engine – oder keiner, mit Methode `local` und einem Modellserver auf Ihrem eigenen Rechner |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Nein | die Evaluationsumgebung – `pipx install mt-eval-harness` |
| die fünfzehn `forge_*`-Tools | Nein | NMT Forge 0.2.0 oder neuer – `python3 -m pip install nmt-forge` (fügen Sie `'nmt-forge[hf]'` hinzu, um zu trainieren und bereitzustellen). Es bringt die Evaluationsumgebung mit und findet Sprachkarten eigenständig; kein Klonen erforderlich |

Für nichts davon ist ein Klon des Repositorys erforderlich.

## Was die Werkzeuge tun

**Die Arbeit durchsuchen und kalkulieren.** `list_queue` und `get_queue_item` durchlaufen die offene Benchmark-Warteschlange — die nach Rang geordnete Liste von Messungen, welche die Karte am meisten verbessern würden. `estimate_cost` berechnet die Kosten für eine Reihe von Durchläufen, bevor Sie etwas ausgeben.

**Informationen nachschlagen.** `search_languages` durchsucht die Sprachkarten nach Name,
Code, Familie oder Region und toleriert Tippfehler. Jedes Ergebnis gibt zudem an, wo
die Sprache gesprochen wird (Länder, ein Kartenpunkt, Makroregion), sowie ihre weiteren
Namen – ausschließlich Fakten, für die ihre Karte eine Quelle anführt, jeweils mit dieser Quelle, damit
Sprachen mit ähnlichen Namen unterschieden werden können. Ein Ort ohne Quellenangabe wird
nie angezeigt; die Zeile weist darauf hin und verlinkt stattdessen den Glottolog-Eintrag
der Sprache. Karten, die aus den veröffentlichten Kartentabellen von champollion.dev ausgefüllt wurden (bei einer
npm-Installation jede Sprache außerhalb des gebündelten Kernsatzes), enthalten noch keine
Quellen pro Feld – diese folgen mit dem nächsten Upload der Tabellen –, sodass diese
Zeilen den Glottolog-Link anstelle eines Ortes enthalten. `language_overview` ist der
einseitige Ausgangspunkt für die Entwicklung für eine Sprache: was vorhanden ist, was ausgeführt
werden kann und welche Schritte als Nächstes anstehen. `get_language` gibt die vollständige Karte mit Zitaten zurück.
`list_corpora` listet die registrierten Evaluationskorpora
für ein Sprachpaar oder eine Benchmark-Familie auf – ausschließlich Metadaten (Größe,
Lizenz, Kontaminationsgrad und ob die Evaluationsumgebung sie abrufen kann, ein
Zugriffstoken benötigt oder sie in Quarantäne hält); Korpusinhalte werden niemals zurückgegeben,
und ein Paar, dessen Korpora sich alle in Quarantäne befinden, weist darauf hin, anstatt
nicht unterstützt zu wirken. `get_results` und `get_run_card` lesen bewertete Durchläufe
aus der öffentlichen Bestenliste aus. `get_metric_reliability` beantwortet die Frage, die die meisten
Agenten falsch beantworten – *welcher Metrik sollte ich für diese Zielsprache vertrauen?* –
anhand von Korrelationen mit menschlichen Urteilen pro Sprachfamilie. `list_contests`
und `get_contest` zeigen Wettbewerbe und deren deklarierte Bedingungen an; die Teilnahme an einem Wettbewerb ist ein
von einem Menschen autorisierter CLI-Schritt, niemals ein Tool.

**Aktionen ausführen.** `translate` leitet Text durch die getestete Pipeline, mit Translation
Memory (Wiederholungen kosten nichts) und einem deterministischen Quality Gate. Jede Antwort
nennt die Engine, die tatsächlich ausgeführt wurde, inklusive Modell und Endpunkt, sofern vorhanden.
`run_benchmark` startet eine Evaluation und gibt **sofort eine Job-ID** zurück,
da echte Durchläufe jedes Client-Timeout überdauern; Sie fragen `get_run_status` mit
dieser ID ab. Ein Job übersteht einen Neustart des Servers: Der Durchlauf läuft weiter, und
das Abfragen derselben ID liefert auch danach weiterhin Status und Ergebnisse zurück. Nichts
wird veröffentlicht, es sei denn, Sie übergeben `publish: true`; der Plan gibt dann an, was öffentlich
gemacht werden würde – jede Zeile mit ihrem Satztext oder nur Punktwerte; der Prompt oder nur
sein Hash; und wohin – und eine tatsächliche Veröffentlichung erfordert `publish_ack` im exakten
Wortlaut, den der Plan vorgibt, damit der Benutzer ihn zuerst gesehen hat. Ein ohne diesen Parameter durchgeführter Durchlauf
kann später veröffentlicht werden, hinter derselben Schranke. `preview_publish` ist schreibgeschützt:
Es zeigt die Veröffentlichungsvorschau der Evaluationsumgebung selbst, den genauen Wortlaut und den exakten
Aufruf von `publish_report`, der die Veröffentlichung durchführen würde, und kann selbst nicht veröffentlichen. Es
trägt die MCP-Annotation `readOnlyHint: true`, sodass ein Agenten-Host, der vor jedem
Schreibvorgang nachfragt, dies eigenständig erlauben kann. `publish_report` führt den Schreibvorgang durch
(annotiert mit `destructiveHint` und `openWorldHint`), und `scores_only`
hält den Satztext zurück. Jeder Plan beginnt zudem mit dem
`EVAL PACK:`-Status der Zielsprache – `missing` (mit dem Befehl zu seiner
Installation), `ready` oder `none needed` – und nennt die Korpuslizenz sowie deren
`do_not_train`-Bedingung, da der Durchlauf `--yes` übergibt. Ein fehlender FST (der
Analysator oder seine pyhfst-Laufzeit) bricht den Durchlauf nie ab: Er wird fortgesetzt und die
Durchlaufkarte vermerkt, dass die FST-Akzeptanz nicht berechnet wurde. Jede andere fehlende Komponente bricht den Durchlauf
ab, bevor übersetzt wird. `skip_fst` und `skip_eval_standard` bewerten ohne diese
Komponenten, und die Durchlaufkarte vermerkt, was ausgelassen wurde. Der Plan gibt außerdem an, ob
COMET berechnet wird (die Evaluationsumgebung berechnet es, wann immer `unbabel-comet`
installiert ist; `comet: true` setzt dies für den Durchlauf voraus), und `metricx` sowie `fuse`
fordern die optionalen MetricX-24- und FUSE-ähnlichen Komparatoren der Evaluationsumgebung an. Für jedes
davon gibt der Plan anhand der Evaluationsumgebung an, ob es installiert ist, was zu installieren ist
und was heruntergeladen wird. Ein bestätigter Durchlauf, der eine Metrik anfordert, die die Evaluationsumgebung
nicht berechnen kann, wird abgelehnt, anstatt ohne sie ausgeführt zu werden. Die Zeilen `Results:`
und `Cache:` des Plans geben an, wo Durchlaufprotokoll, Bericht und Übersetzungscache abgelegt werden.
Eine Testdatei innerhalb eines Ordners, den `mt-eval contest prepare` als veröffentlichbar kennzeichnet
(das `public/` eines Wettbewerbs), wird stattdessen in den `runs/`-Ordner des Wettbewerbs ausgeführt, sodass
nichts, was ein Durchlauf schreibt, damit freigegeben wird. Ein Modell auf Ihrem eigenen
Rechner (ein lokaler Server oder `method: "local-model"`, das die Evaluationsumgebung
prozessintern ausführt und das keine Bescheinigung benötigt) wird als `$0 API cost (runs on
this machine)` gemeldet.

**Trainieren ohne Selbsttäuschung.** `get_training_guardrails` gibt die Regeln zurück,
die aus echten, gemessenen Fehlschlägen abgeleitet wurden. Die fünfzehn `forge_*`-Tools führen
[NMT Forge](/docs/network/getting-started/training-honestly) Schritt für Schritt
unter kontrollierten Bedingungen aus – `forge_status` zuerst und nach jedem Schritt (es benennt den nächsten
Befehl und das Tool, das ihn ausführt), `forge_preflight`, um zu sehen, auf welche Gates ein
Befehl stößt, bevor er abgelehnt wird, `forge_prereg_template` und `forge_prereg`,
um Vorhersagen festzuhalten, bevor ein Test-Score existiert (und vor jedem
Benchmark auf dem Testdatensatz: ein lesender Bewertungsvorgang blockiert eine spätere Vorabregistrierung),
`forge_export`, um den Testdatensatz einmalig zu bewerten und das trainierte Modell zu paketieren,
`forge_compare`, um zwei Modelle einem A/B-Vergleich zu unterziehen, wobei der Near-Twin-Vorbehalt für jedes Modell neben
dem Gewinner ausgewiesen wird, und
`forge_prereg_verdict`, um das eigene Urteil des Benutzers zu einer Vorhersage festzuhalten, die Forge
nicht beurteilen kann (ein Freitextbereich) – dargestellt als menschliches Urteil, niemals als ein
berechnetes. `forge_status` listet jeden trainierten Durchlauf mit seinem Dev-Score auf und
gibt an, wenn ein Dev-Set saturiert ist (ein perfekter Dev-Score, bei dem der Checkpoint-Auswahl keine Unterscheidungsgrundlage mehr bleibt). Wenn die Evaluationsumgebung einen Vorbehalt
zu einem Test-Score vermerkt (beispielsweise eine nahezu konstante Ausgabe: eine Handvoll Ausgaben,
die für jeden Quellsatz geliefert werden), übernehmen `forge_export`, `forge_status`,
`forge_compare` und `forge_lint` diesen im genauen Wortlaut der Evaluationsumgebung, und ein
schwerwiegender Vorbehalt steht im nächsten Schritt an erster Stelle: Der Score wird niemals ohne
ihn zitiert. Eine Ablehnung wird mit der Erklärung
zurückgegeben, was schiefgelaufen ist, warum es von Bedeutung ist und wie der Fehler behoben werden kann. Zwei Schritte überdauern jeden Tool-Aufruf
und werden stattdessen in einem Terminal ausgeführt: das Training (`nmt-forge run`) und das Bereitstellen des
exportierten Modells (`nmt-forge serve`, wodurch es hinter einem lokalen Endpunkt bereitgestellt wird, den
`translate` und die CLI nutzen können).

### Argumente

`name` ist erforderlich und `name?` ist optional. Jedes Tool, das eine
Sprache entgegennimmt, akzeptiert diese auch als `language`: „`code` oder `language`“ bedeutet, dass beide
Namen funktionieren und Sie einen davon übergeben. Die ursprünglichen Namen funktionieren weiterhin.

| Tool | Argumente |
|---|---|
| `search_languages` | `query` oder `language`, `limit?` |
| `language_overview` | `code` oder `language`, `source?` |
| `get_language` | `code` oder `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (mindestens einer dieser drei), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` oder `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | keine |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` oder `priority?` (einer von ihnen) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (ein gettext msgctxt: einer für alle Texte oder einer pro Text), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | ein Modus: `budget?` oder `top?` (Queue), `item_id?` oder `corpus?` mit `model?` (mit `method_dir`, dem Modell, das das Plugin lädt), `method?` oder `method_dir?` (ein Methoden-Plugin-Verzeichnis; `local-model` benötigt `model` – es gibt keinen Standardwert), `allow_model_pair_mismatch?` (`local-model`: ein OPUS-MT-Paarmodell ausführen, das ein anderes Paar benennt, als Baseline für verwandte Sprachen), `attest_local_transport?` (eine MT-Engine oder ein Plugin; wird für `local-model` nie benötigt), `provider?`, `base_url?`, `target_language?`, `script?` (LLM-Durchläufe: die ISO-15924-Schrift, in der die Ausgabe verfasst sein muss, wie etwa `Cans` oder `Latn`; der Plan gibt an, wenn auf der Karte der Zielsprache mehr als eine aufgeführt ist), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` und `skip_eval_standard?` (Element- und Korpus-Durchläufe: Bewertung ohne den FST oder die Standard-Evaluationsmetriken, gekennzeichnet als nicht berechnet), `comet?` (COMET voraussetzen: der Durchlauf wird verweigert, solange es nicht installiert ist), `metricx?` mit `metricx_model?` und `fuse?` (Element- und Korpus-Durchläufe: die optionalen MetricX-24- und FUSE-ähnlichen Komparatoren der Evaluationsumgebung, verweigert, solange nicht installiert); dann `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (bei einer tatsächlichen Veröffentlichung: der genaue Wortlaut, den der Plan ausgibt), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (die `*_report.json` eines abgeschlossenen Durchlaufs), `scores_only?`, `redact_coaching?`, `anonymous?` (schreibgeschützt: kein `confirm`, Veröffentlichung nicht möglich) |
| `publish_report` | `report` (die `*_report.json` eines abgeschlossenen Durchlaufs), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (der exakte Wortlaut, den die Vorschau ausgibt) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (der zu prüfende Befehl), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` oder `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` oder `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (Standardwert `data/split`, der Pfad, den die config.json von `forge_init` einliest), `dev?`, `register?` (ein Namenspräfix oder `true` für `project`), `allow_rotate?`, `near_dupe?` (ein Jaccard-Schwellenwert wie etwa 0,6, wenn Forge das Ausgliedern von Fast-Duplikaten empfiehlt), `max_group?` (mit `near_dupe`: die größte Gruppe von Fast-Duplikaten), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (mit eigener `clean_to`, z. B. `corpus.notwins.jsonl` – niemals die Datei mit allen Daten), `companion_config?` (mit `drop_test_twins`: Zielort der Konfiguration für das duplikatfreie Modell; Standardwert `config-notwins.json`), `overwrite?` (eine `clean_to`-Datei ersetzen, die von einer Konfiguration, einem Durchlauf, einem Split oder einem anderen Audit verwendet wird – ohne dies verweigert), `full_indices?` (jede Zeilennummernliste vollständig; standardmäßig werden lange Listen als `{count, first}` zurückgegeben), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (an einen Durchlauf binden), `allow_after_reads?` (nur für Vorhersagen, die vor den bewertenden Lesevorgängen des Sets festgehalten wurden), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (seine Nummer oder seine eigene ID), `verdict` (`held` oder `missed`), `by` (wer geurteilt hat), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (Run-Manifest jedes Modells: dessen Trainingsdaten werden auf Fast-Duplikate geprüft), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Beispielsweise fragen `get_metric_reliability { "language": "crk" }` und
`get_metric_reliability { "target": "crk" }` dasselbe ab.

### Übersetzen mit einem von Ihnen bereitgestellten Modell

`nmt-forge serve` gibt zwei Adressen für das von ihm bereitgestellte Modell aus. Verweisen Sie mit
`translate` auf eine der beiden:

| Argument | Verwendung mit | Beispiel |
|---|---|---|
| `base_url` | `method: "local"` – ein OpenAI-kompatibler Server (auch `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` – der API-Vertrag von Champollion | `http://127.0.0.1:8378/translate` |
| `model` | Nur LLM-Engines; abgewiesen bei APIs für maschinelle Übersetzung, die keine besitzen | `llama3.1` |
| `project_dir` | Beliebige Methode – Translation Memory dieses Projekts verwenden | `~/my-app` |

Ein Server auf Ihrem eigenen Rechner benötigt keinen Schlüssel. Ein entfernter `api`-Endpunkt liest seinen
Schlüssel aus `CHAMPOLLION_API_KEY` in der Umgebung des Servers. Das Tool weist
ein ihm unbekanntes Argument namentlich ab, anstatt es zu ignorieren, sodass ein falsch geschriebenes
Argument Ihren Text nicht unbemerkt an ein anderes Modell senden kann.

### Wo der Server seinen Zustand speichert

Alles befindet sich in `~/.champollion-mcp/` (setzen Sie `CHAMPOLLION_MCP_HOME`, um den Pfad
zu ändern):

- **Das Translation Memory von `translate`** ist eine eigene Datei,
  `.champollion/tm.json` in diesem Ordner. Es ist von der `.champollion/tm.json` eines jeden Projekts
  getrennt. Übergeben Sie `project_dir`, um stattdessen die Datei eines Projekts zu verwenden,
  die `champollion sync` dort nutzt.
- **`run_benchmark`-Jobs** werden in `jobs.json` erfasst, worin die
  neuesten 50 aufbewahrt werden. Jeder Job besitzt einen Ordner in `jobs/` mit seiner Ausgabe und, bei einem
  Queue-Element oder einem registrierten Korpus, den Ergebnissen der Evaluationsumgebung. Ein Durchlauf auf einer Testdatei,
  die Sie vorhalten, schreibt seine Ergebnisse und den Cache neben diese Datei in
  `results/` – mit Ausnahme einer Datei in einem Ordner, den `mt-eval contest prepare`
  als veröffentlichbar kennzeichnet, deren Durchlauf in den Ordner `runs/` des Wettbewerbs schreibt.
  Queue-Durchläufe schreiben ihre Berichte nach `eval/logs/harness/queue/` unter dem
  Arbeitsordner des Servers, wie es die Evaluationsumgebung stets tut.

:::note[Ausgaben sind konzeptionsbedingt begrenzt]
`run_benchmark` **lehnt einen unbegrenzten Warteschlangen-Durchlauf ab.** Sie müssen genau eine Begrenzung übergeben — `budget`, `top` oder eine spezifische `item_id`. Es gibt keinen Aufruf, der "einfach die Warteschlange ausführt", da ein Agent, der die Warteschlange missversteht, sonst unbegrenzt Geld ausgeben könnte.
:::

## Protokollversion

Der Transport erfolgt **ausschließlich über stdio** — ein Serverprozess pro Agent.

Die [Revision vom 28.07.2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/) von MCP machte das Protokoll standardmäßig zustandslos und musterte den `initialize`-Handshake sowie den `Mcp-Session-Id`-Header aus. Dieser Server ist in seinem Design davon nicht betroffen: Er nutzt keine der veralteten Funktionen (Roots, Sampling, Logging), hat nie den veralteten HTTP+SSE-Transport verwendet und befolgt bereits die neuen Richtlinien für den Status über mehrere Aufrufe hinweg (cross-call state) — `run_benchmark` generiert ein explizites Job-Handle, das das Modell zurückgibt, anstatt sich auf eine Transportsitzung zu stützen.

Er wurde **nicht** auf die neue Revision aktualisiert, da noch kein veröffentlichtes TypeScript-SDK diese unterstützt. Siehe die [Server-README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) für die vollständige Stellungnahme.

## Maschinenlesbare Endpunkte

Für diese wird kein MCP-Client benötigt:

| Endpunkt | Was es ist |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | Der [Zugang für Agenten](/for-agents), als reines Markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Das kuratierte Verzeichnis dieser Website |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Jede indizierte Seite, eingebettet |
| [`/queue.json`](https://champollion.dev/queue.json) | Die vollständige Benchmark-Warteschlange |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Die obersten Einträge der Warteschlange |
| [`/registry.json`](https://champollion.dev/registry.json) | Die Korpus-Registrierung |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Der gemessene Sprachgraph |

## Nächste Schritte

- [Agenten-Leitfaden — Erstellen & Benchmarking](/docs/network/getting-started/agent-guide)
- [Agenten-Leitfaden — Übersetzen mit der CLI](/docs/guides/agent-guide)
- [Eine Methode einreichen](/docs/network/getting-started/submit-a-method)
