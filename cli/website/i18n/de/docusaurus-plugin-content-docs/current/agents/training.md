---
title: "Training mit nmt-forge"
slug: /agents/training
description: "Wie nmt-forge ein Modell auf Schienen trainiert und testet: die Modellvoreinstellungen und was --model auto anhand des Speichers auswählt, die abgesicherte Schleife Befehl für Befehl, Decodierungs- und Längenbegrenzungen, Hintergrundaufträge und die Warteschlange für jeweils nur ein Training, Festplattenspeicher (behaltene Checkpoints, die Speicherplatzprüfung, tidy), Export und Bereitstellung, die Verbesserungsrunden (das Rundenurteil, das Urteil der Sprecher:innen) und das Angebot eines stärkeren Modells, synthetische Daten, eine verifizierte Tabelle zu Symptom → Ursache → Behebung sowie die Fehlertaxonomie."
---

# Training mit nmt-forge

`nmt-forge` trainiert ein Modell anhand der Paare der Gemeinschaft, innerhalb von Schutzplanken: Es weist zurück, was ein Ergebnis verfälschen würde, und jede Zurückweisung nennt das Was, das Warum und die Behebung. Es implementiert keine eigene Metrik – jede Bewertung stammt von der Evaluierungs-Engine (`mt-eval`), demselben Code, der auch alles andere bewertet.

Auf den Führungsschienen geben Sie diese Befehle selten selbst ein: `champollion next` nennt sie, und ab dem Schritt `forge` leitet es den forge-eigenen Ratgeber (`nmt-forge status`) weiter. Diese Seite beschreibt, was diese Schritte tun.

## Modelle

`nmt-forge init --model <preset>` schreibt eine Voreinstellung als explizite Zahlen in `config.json` (gehasht in die Identität jedes Durchlaufs: eine spätere forge-Veröffentlichung ändert niemals die Durchläufe eines bestehenden Projekts). `nmt-forge use-model <preset>` wechselt ein Projekt.

| Voreinstellung | Beschreibung | Erfordert | Was forge zu den Erwartungen sagt |
|---|---|---|---|
| `cpu-tiny` | Ein kleiner Transformer, der von Grund auf anhand der Paare trainiert wurde, mit einem Vokabular aus 4.000 Teilen, das aus den Trainingszeilen gelernt wurde | Nur CPU · kein Download | „bei ~1–2k Paaren: chrF++ etwa 5–30 (das obere Ende nur bei stark schablonenbasierten Daten) – auswendig gelernte Phrasen und Vorlagen Ihrer Daten, keine allgemeine Übersetzung“ |
| `byt5-small` | Googles ByT5-small (300 Mio. Parameter, liest Bytes – kein Vokabular anzupassen), feinabgestimmt | ~1,2 GB Download · Apple Silicon oder eine CUDA-GPU empfohlen | „in den forge-eigenen Tests lernte es aus denselben Paaren weit mehr als cpu-tiny – messen Sie es dennoch an Ihrem verwendeten Modell auf Ihrem Dev-Set“ |
| `byt5-small-lowmem` | Dasselbe Modell, dieselbe Lernrate und dieselben Längenbegrenzungen, eingerichtet für einen Rechner mit 8–15 GB Speicher: Adafactor, Gradient Checkpointing und Batches von 4 Paaren, 4-mal akkumuliert (dieselben 16 Paare pro Schritt) – weniger Speicher pro Schritt, mehr Zeit. Auf einem 8-GB-Rechner noch nicht gemessen | wie `byt5-small` | wie `byt5-small` |
| `cpu-finetune` | Ein kleines vortrainiertes Marian/opus-mt-Modell, auf der CPU feinabgestimmt. Sie geben die Basis an (`--base`); sie wird niemals erraten | Nur CPU · ~300 MB Download | „hängt davon ab, wie verwandt die Zielsprache der Basis ist – messen Sie es an cpu-tiny auf Ihrem Dev-Set“ |
| `nllb-600m` | NLLB-200 distilled 600M mit LoRA | eine CUDA-GPU (8 GB+) · ~2,5 GB Download | „das stärkste der drei, wenn NLLB eine verwandte Sprache abdeckt; messen Sie es dennoch – gehen Sie nie von Annahmen aus“ |

Jede Voreinstellung trainiert mit dem Trainings-Extra von forge (`nmt-forge[hf]`), mit Seed 42. Keine Voreinstellung legt ein Zeitbudget fest: Diese Zahl bestimmt die Gemeinschaft.

- **Ohne `--model`** schreibt `init` `cpu-tiny`.
- **`--model auto`** (was die Führungsschienen übergeben) liest den Speicher der GPU aus, auf der forge trainieren kann – auf einem Mac mit Apple Silicon den Arbeitsspeicher des Rechners (der mit der GPU geteilt wird); mit `nvidia-smi` auf `PATH` den der größten NVIDIA-Karte: 16 GB oder mehr (oder Speicher, den es nicht lesen kann) → `byt5-small`; 8–15 GB → `byt5-small-lowmem`; unter 8 GB → `cpu-tiny`. Ohne eine der beiden GPUs: `cpu-tiny`. Die Begründung wird mitsamt dem gefundenen Speicher ausgegeben (`chosen: …`) und als `model_choice` in `--json` zurückgegeben. Es prüft nicht, ob die GPU funktioniert. `NMT_FORGE_AUTO_PRESET` überschreibt dies (es muss eine Voreinstellung benennen).
- **Das stärkere Modell, das die Runden anbieten,** geht nur an ein Projekt, dessen verwendetes Modell `cpu-tiny` ist: `byt5-small-lowmem`, wo `--model auto` es wählen würde, andernfalls `byt5-small` – auch auf einem Rechner, auf dem `auto` `cpu-tiny` wählen würde; das `why` des Angebots nennt, was dafür benötigt wird.

**Hinweis.** Beschreiben Sie die Erwartung einer Voreinstellung niemals als Versprechen. Messen Sie auf dem Dev-Set.

## Die abgesicherte Schleife

Jeder Befehl akzeptiert `--json`; `--workspace <dir>` (Standard: `.forge`) steht vor dem Unterbefehl. Forge weist abgekürzte Flags zurück.

| Schritt | Befehl | Was er tut | Was er verweigert |
|---|---|---|---|
| Workshop | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | Schreibt `.forge/`, `config.json`, `NEXT_STEPS.md` | Eine unlesbare `--pair`; `cpu-finetune` ohne `--base` |
| Testsatz | `nmt-forge registry add project-test <file> --role test` | Fixiert den sha256 der Datei; startet ihr Leseprotokoll | Synthetische Zeilen in einem Test- oder versiegelten Satz; ein Name, der bereits mit anderem Inhalt registriert ist (außer `--allow-rotate`) |
| Überprüfung | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | Prüft jedes Paar gegen jeden registrierten Dev-, Test- und versiegelten Satz; schreibt eine bereinigte Kopie | Das Überschreiben einer verwendeten Datei (außer `--overwrite`); ein Ergebnis, bei dem keine Trainingsdaten verbleiben |
| Vorhersage | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | Schreibt die Vorhersage der Beteiligten vor jeder Bewertung | Eine bestehende ID; das Schreiben nach einem bewertenden Lesen des Satzes durch Forge oder `mt-eval` (außer `--allow-after-reads`, im Hauptbuch erfasst) |
| Dev-Satz | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | Ein gruppen-disjunkter Dev-Ausschnitt, registriert als `project-dev`. `<n>` der Rails: jedes zehnte der geprüften Paare, mindestens 50, höchstens 500 – ein Viertel davon unter 200 Paaren ([Shell](/docs/agents/shell#build-and-test-a-model)). `--near-dupe 0.6` behält Fast-Duplikate (Wortüberschneidung ≥ 0,6) auf einer Seite, der Schwellenwert, den die Überprüfung jeder späteren Runde anwendet; die Rails setzen `--max-group` auf die Hälfte der Dev-Größe plus eins, sodass eine aus Vorlagen erstellte Datei dennoch aufgeteilt wird | Eine Seite über dem 1,5-Fachen ihrer Anforderung oder wenn beim Training weniger als die Hälfte der Zeilen verbleibt |
| Untergrenze | `nmt-forge floor <word lists>` | Übersetzt den Dev-Satz Wort für Wort aus dem Wörterbuch und bewertet ihn genauso wie die Dev-Bewertung eines Durchlaufs | Kein Dev-Satz registriert |
| Prüfung | `nmt-forge preflight run --config config.json` | Führt jedes Gate aus, auf das der Durchlauf treffen wird, mit Korrekturen; Exit-Code 2, falls eines fehlschlägt | — |
| Training | `nmt-forge run config.json --detach` | Trainiert, wählt den Checkpoint anhand des Dev-Satzes aus, entfernt die übrigen Checkpoints des Durchlaufs ([Speicherplatz](#disk-space)), schreibt `.forge/runs/<run name>-<8 hex>/` mit `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl` | Einen bereits existierenden Durchlauf (gleiche Konfiguration, Trainingsdateien und Dev-Satz); eine Festplatte ohne ausreichenden Speicherplatz (`disk-room`, bevor etwas geschrieben wird; `--skip-disk-check` überschreibt dies); einen laufenden Durchlauf; Trainingszeilen, die in einen Test- oder versiegelten Satz durchsickern; Dev-Zeilen im Training; Daten, die als do-not-train markiert oder unter Quarantäne gestellt wurden; `terms.training: not-allowed`; synthetische Daten über ihrer Obergrenze; eine Dekodierobergrenze, die zu kurz für die Referenzen ist; unbekannte Konfigurationsschlüssel |
| Test-Bewertung | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | Bewertet den Testsatz einmalig anhand der Vorhersage; paketiert das Modell mit `input-words.json` neben seinem Ordner – den Wörtern, auf denen es trainiert wurde, damit ein Server diejenigen benennen kann, die er nie gesehen hat ([Bereitstellung](/docs/agents/serving#what-an-export-holds)) | Keine Vorregistrierung oder mehrere ohne `--prereg`; einen aufgebrauchten versiegelten Satz; ein nicht-leeres `--out` ohne `--force` |
| Auswählen | `nmt-forge choose <export>/model` | Erfasst die Wahl des Modells durch die Gemeinschaft | Einen Ordner, der kein erfasster Export mit einem Modell ist |
| Bereitstellen | `nmt-forge serve <export>/model --detach` | Stellt es auf diesem Computer bereit ([Bereitstellung](/docs/agents/serving#nmt-forge-serve)) | Außerhalb des Loopbacks ohne Token oder ein rein lokales Modell ohne `--holders-agreed-by` |

Alles Wichtige wird in das hash-verkettete Hauptbuch (`.forge/ledger.jsonl`) geschrieben: Registrierungen, Lesevorgänge samt Zweck, Vorhersagen, Bewertungen, Verwendungen versiegelter Sets, Überschreibungen, Audit-Urteile, die Basismessung, Exporte, Entscheidungen, Bereitstellungen sowie Auftragsstarts und -beendigungen. Das Durchlauf-Manifest ist der Nachweis eines Durchlaufs.

**Vorflug-Prüftore:** Konfiguration (gibt den vollständigen Konfigurations-Hash aus), Arbeitsbereich-Übereinstimmung, kein laufender Durchlauf, Dev-Abgrenzung, Trainingsdaten, installiertes Backend, Auswahl-Plugins, Beinahe-Zwillinge im Test- und Dev-Set (Warnungen), Leakage-Audit, Trainingsmischung, Generationsspielraum, Zeitplan-Plausibilität.

**Dekodierung.** Die finale Dev-Dekodierung, der Test-Lesevorgang (`export`), ein verwendetes Modell, das das Dev-Set erneut übersetzt, und das bereitgestellte Modell verwenden Beam-Search mit `decode.num_beams` (4, sofern `config.json` nichts anderes festlegt); die Checkpoint-Auswahl, die viele Checkpoints einordnet, dekodiert gierig. Ein Export erfasst `beams_applied`, und `nmt-forge serve` dekodiert so, wie das Modell gemessen wurde: Ein älterer Export ohne diesen Eintrag wird gierig bereitgestellt.

**Längenbegrenzungen.** Ein Modell lernt aus höchstens `model.max_src` Token eines Ausgangssatzes und `model.max_tgt` seiner Übersetzung, liest beim Übersetzen höchstens `model.max_src` und schreibt höchstens `decode.max_new_tokens` (`byt5-small`: jeweils 320 Bytes – etwa 320 Buchstaben einer lateinischen Schrift, etwa 100 in Silbenschrift; `cpu-tiny`: 256 Teile hinein, 384 heraus). Nichts wird stillschweigend abgeschnitten: Das Training zählt die Paare jenseits beider Grenzen, bevor es sie abschneidet, und die finale Dev-Dekodierung zählt Sätze, die eingangs beschnitten wurden, sowie Übersetzungen, die an der Obergrenze abbrachen. Beides gelangt in das Durchlauf-Manifest (`length_limits`), und `status` warnt mitsamt der Behebung: Lange Sätze aufteilen oder `model.max_src` und `model.max_tgt` (sowie `decode.max_new_tokens`) in `config.json` anheben – das Training dauert dann länger.

**Hinweis.** `nmt-forge run` selbst erfordert keine Vorhersage; die Führungsschienen verlangen sie zuerst. Trainieren Sie nicht, bevor der Vorhersageschritt abgeschlossen ist.

**Hinweis.** `export` ist der Schritt, der das Test-Set liest. Seine Ausführung ist ein Meilenstein, bei dem die Vorhersage der Gemeinschaft bereits schriftlich vorliegt – niemals eine Routineprüfung.

## Hintergrundaufträge

`run --detach` und `serve --detach` starten einen überwachten Auftrag und kehren zurück.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- Zustände: `running`, `finished`, `refused`, `crashed`, `stalled`, `deadline`, `interrupted`, `lost`. `lost` ist ein Auftrag, dessen Überwachung ohne Aufzeichnung endete – einschließlich nach einem Neustart, wenn seine Prozessnummer nun zu einem anderen Prozess gehört.
- **Jeweils nur ein Training auf diesem Rechner.** Trainingsaufträge reihen sich rechnerweit in eine Warteschlange ein, wer zuerst kommt, mahlt zuerst (`~/.nmt-forge/machine/train-queue`), über alle Projekte hinweg. Ein eingereihter Auftrag bleibt `running`, mit `queued_behind` (dem Auftrag, auf den er wartet) in `nmt-forge jobs --json`; `status` ist `training` und besagt, hinter wem er wartet, und er startet von selbst. Ein Stopp während des Wartens beendet ihn ungestartet (`interrupted`); eine Wartezeit von 24 Stunden beendet ihn (`deadline`).
- **Grenzen** (Trainingsaufträge): kein Lebenszeichen für 15 Minuten beim Start (`--startup-minutes`); kein Fortschritt für die längere Zeitspanne aus 10 Minuten und dem 30-Fachen der medianen Schrittzeit (`--stall-minutes`); eine Frist von `--deadline-hours`, sonst das Zeitbudget der Konfiguration × 1,25, andernfalls 24 Stunden. Ein Auftrag jenseits einer Grenze wird gestoppt und vermerkt.
- **Stoppen:** Der Durchlauf hält bei seinem nächsten Schritt an; die Überwachung eskaliert nach 60 Sekunden zu Beenden (terminate) und 10 Sekunden später zu Abwürgen (kill).
- **Das Echtzeit-Prüftor** (Hugging-Face-Backends): Nach dem Aufwärmen misst forge die Schrittzeiten, projiziert den Durchlauf und weist einen Durchlauf zurück, der nicht in das Budget passt (`wall-clock budget exceeded: …`). Ist kein Budget festgelegt, gilt eine Obergrenze von 24 Stunden.
- Während ein Trainingsauftrag läuft, ist `status` `training` und der Schritt der Führungsschienen ist `wait`. Ein fehlgeschlagener Auftrag erscheint als Warnung bei jedem späteren Status.
- **Fortsetzen.** Wenn der letzte Trainingsauftrag mit `lost`, `crashed`, `stalled` oder `deadline` endete, nachdem ein Checkpoint gespeichert wurde, nennt `status` `nmt-forge preflight run --config config.json && nmt-forge run config.json --resume --detach`: einen neuen Durchlauf, der beim letzten Checkpoint des unterbrochenen Durchlaufs beginnt (seinen Gewichten, einem frischen Optimizer, den verbliebenen Epochen), und dessen Manifest angibt, von wo aus er fortgesetzt wurde (`resumed_from`). Er wird nach einem manuellen Stopp niemals angeboten.
- Losgelöste (detached) Aufträge gibt es nur unter POSIX (macOS, Linux).

## Speicherplatz

Beim Training werden Checkpoints geschrieben: bis zu `model.save_total_limit` davon gleichzeitig
(4, sofern `config.json` nichts anderes angibt), jeweils etwa 1,4 GB für ByT5-small.
Vor diesen Regeln behielt jede Verbesserungsrunde eines ByT5-small-Projekts etwa
5,6 GB, nichts entfernte das Modell einer früheren Runde und eine volle Festplatte brach einen
Durchlauf während des Speicherns ab. Das GB von Forge entspricht 1024³ Bytes.

- **Ein abgeschlossener Durchlauf behält nur seinen ausgewählten Checkpoint.** Jeder andere
  `checkpoint-*`-Ordner des Durchlaufs wird entfernt, sobald der Checkpoint ausgewählt ist:
  Nichts liest sie mehr (`export` kopiert den ausgewählten; die nächste Runde
  startet vom verwendeten Modell). Das Manifest erfasst `checkpoints_pruned`
  (`removed`, `bytes`, `kept`). `"keep_checkpoints": "all"` im `model`-Block
  von `config.json` behält sie alle. Jeder andere Wert wird beim Einlesen der Konfiguration
  vor jedem Training abgelehnt (`ConfigError`; hier für den Wert `x`):
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **Sperre.** Ein Durchlauf, für den der Speicherplatz auf dem Datenträger nicht ausreicht, wird abgelehnt,
  bevor etwas geschrieben wird (Guard `disk-room`); ein losgelöster Durchlauf wird sofort abgelehnt,
  bevor sein Auftrag startet. Die Schätzung: die Größe eines Checkpoints – der behaltene Checkpoint
  eines früheren Durchlaufs derselben Basis in diesem Arbeitsbereich, andernfalls die basiseigenen
  Gewichtsdateien (ein lokaler Ordner oder der Hugging-Face-Cache) – multipliziert mit
  `model.save_total_limit`, plus 1 GB für den Abschluss; niemals unter 2 GB. Die
  Ablehnung lautet
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  – oder, wenn keine Größe bekannt ist, *„(mindestens so viel muss unabhängig vom
  Modell frei bleiben)“* – danach
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`
  und ein `fix`, das nennt, was `nmt-forge tidy` hier freigeben kann (wenn es
  etwas freigeben kann), das Verschieben anderer Dateien vom Datenträger sowie `--skip-disk-check`.
- `nmt-forge run … --skip-disk-check` (mit oder ohne `--detach`) startet
  trotzdem. Das `disk_room` des Manifests zeichnet die Prüfung auf – `free_bytes`,
  `checkpoint_bytes` (`null`, wenn unbekannt), `checkpoints_at_once`,
  `need_bytes` – oder `{"skipped": "--skip-disk-check"}`. **Hinweis.** Die
  Schätzung kann falsch sein; ob die Prüfung übersprungen werden soll, liegt im Ermessen der Person.
- **`nmt-forge tidy`** listet die Modellgewichte früherer Runden auf, die von nichts
  verwendet werden – jeder Durchlauf mit seiner Größe, der Gesamtsumme, dem freien Speicherplatz – und
  entfernt nichts. `nmt-forge tidy --yes` entfernt sie. Es entfernt niemals das verwendete
  Modell, den neuesten Durchlauf oder das Modell, das durch das verwendete ersetzt wurde (der
  Bogen zur Blindbegutachtung erstellt Entwürfe damit); die Zeile `Kept:` der Ausgabe nennt jedes davon mit
  Begründung. Ein bereinigter Durchlauf behält seine Aufzeichnungen – Manifest, Entwicklungsübersetzungen, Bericht –
  und sein Manifest erhält `model_removed` (`at`, `by`, `bytes`, `why`); das
  Protokoll erhält einen `tidy`-Eintrag (`runs`, `bytes`). Wird ein bereinigter Durchlauf
  zum Übersetzen aufgefordert (`compare-runs`, das das Entwicklungsset damit erneut übersetzt), wird dies abgelehnt:
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`.
  **Hinweis.** `--yes` löscht Dateien: Zeigen Sie der Person die Liste und führen Sie es nur
  nach deren Zustimmung aus.
- **`status` warnt** – eine Zeile in `warnings`, weitergeleitet über die Rails –, wenn der
  Datenträger mit dem Arbeitsbereich weniger als 10 GB frei hat oder Bereinigen 5 GB
  oder mehr freigeben könnte: *„Auf diesem Computer sind X GB frei; die Modelle aus N früheren Runde(n),
  die von nichts verwendet werden, belegen Y GB – `nmt-forge tidy` listet sie auf,
  `nmt-forge tidy --yes` gibt den Speicherplatz frei (das verwendete Modell, das neueste und
  das ersetzte Modell werden behalten)“* (der Teil nach dem Semikolon nur, wenn
  Bereinigen etwas freigeben würde).

## Die Verbesserungsrunden

Sobald ein Modell im Einsatz ist, trainiert jede Runde einen neuen Durchlauf mit mehr Daten und demselben Dev-Set.

**Wie eine Runde trainiert.** `champollion improve prepare` führt `nmt-forge round-plan --config config.json`, which rewrites `config.json` auf eine von zwei Arten aus und trägt den Plan ins Hauptbuch ein (`round-plan`):

- **Weiterführung anhand des verwendeten Modells** (`init_from` seines Modellordners): 4 Durchgänge (Epochen) über alle bisherigen Sätze – die alten bewahren es vor dem Vergessen – bei halber Lernrate. Viel kürzer als ein Training von Beginn an. Die vollständigen Einstellungen warten in `config.json` unter `model_full`.
- **Von Beginn an**, mit wiederhergestellten vollständigen Einstellungen, wenn noch kein Modell im Einsatz ist; wenn das Modell geändert wurde (`use-model`, wodurch auch `model_full` entfällt); für `cpu-tiny`, dessen Vokabular aus den Trainingssätzen stammt (es trainiert in Minuten); für ein Adapter-Modell (LoRA); und jede 4. Runde, damit viele kurze Fortführungen nicht abdriften.

`prepare` gibt den Plan und seine Begründung aus und erfasst `training` (`mode`,
`epochs`) in `improve/round-<k>/prepared.json`. In jedem Fall wird der neue Durchlauf
anhand derselben Dev-Sätze mit dem verwendeten Modell verglichen. Danach (1, 3 und
4 sind Zustände, die der Advisor von Forge benennt; 2 wird von den Rails erfasst):

1. **`improve-compare`** (`auto`): `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` – die beiden Modelle,
   Satz für Satz auf dem Entwicklungsset einander zugeordnet. Bei weniger als 50 Entwicklungssätzen lautet
   das Urteil **too-few**, unabhängig von den Punktwerten: *„zu wenige Entwicklungssätze zur
   Beurteilung: unter 50 lässt sich ein Unterschied unabhängig von seiner Größe nicht zuverlässig vom
   Zufall unterscheiden“*. Ab 50: **better** nur, wenn p < 0,05 beim gepaarten Test ist
   **und** das 95-%-Intervall der Differenz über null liegt; **worse**, wenn
   p < 0,05 ist und es unter null liegt; andernfalls **no-change**. Jedes Urteil gibt
   den kleinsten Unterschied an, den sein Entwicklungsset zuverlässig erkennen lässt. Das Testset wird niemals
   eingelesen. Abgelehnt (`improve-loop`) bei Durchläufen auf unterschiedlichen Entwicklungssets, einem Durchlauf
   ohne gespeicherte Entwicklungsübersetzungen oder einem Entwicklungsset, das seit dem neuen Durchlauf geändert wurde.
2. **Das Urteil der sprechenden Person**, falls das Entwicklungsset nicht entscheiden konnte. Das Modell
   einer Runde, das nicht in den Einsatz übernommen wurde, entwirft die Hälfte der Entwurfszeilen des
   nächsten Prüfbogens, verblindet (`draft-newer`, unten), und `champollion improve
   marks` erfasst die Zählwerte der sprechenden Person bei forge:
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   Forge reagiert darauf nur nach einem Urteil **too-few** oder **no-change**. Ein
   gepoolter Zwei-Stichproben-Test auf Anteilswerte, zweiseitig bei 5 % (|z| > 1,96), liefert `clear`:
   `newer`, `in-use` oder `neither`; der `improve-speaker`-Eintrag des Protokolls speichert
   die beiden Durchlaufnamen, die vier Zählwerte, `z` und `clear` – ausschließlich Zählwerte. Er
   lehnt Zählwerte unter 0 ab, mehr richtige als beurteilte sowie ein Modell ohne
   beurteilten Entwurf. Sein Text lautet: *„Bei der Blindbewertung während desselben Besuchs
   bewertete die sprechende Person das neuere Modell bei A von B neuen Sätzen als richtig (P %) und das
   verwendete Modell bei C von D (Q %)“*, danach *„das neuere Modell ist bei diesen Sätzen deutlich
   besser – forge bietet an, es in den Einsatz zu übernehmen“*, *„das verwendete Modell ist bei diesen Sätzen
   deutlich besser – es verbleibt“* oder *„kein klarer Unterschied bei diesen Sätzen – das verwendete
   Modell verbleibt“*.
3. **`improve-promote`** (`confirm`), bei **better** – oder bei **too-few** bzw.
   **no-change**, wenn der neueste `speaker-verdict` zu diesem Durchlauf
   `clear: newer` meldet (niemals bei **worse**). Es ist ein Angebot: Ein Urteil allein nimmt
   nichts in den Einsatz. Nach Zustimmung der Beteiligten exportiert es den neuen Durchlauf, ohne das
   Testset einzulesen (`--no-eval`), zeichnet ihn als ausgewählt auf (`choose`), stoppt den
   laufenden Server und stellt das neue Modell über denselben Port bereit. Nur dieses
   `export` und `choose` gelten als Einsatz eines Modells: Bis dahin heißt es im
   Rundenbericht *„messbar besser: nicht im Einsatz – die Beteiligten haben es
   nicht ausgewählt“*, und sein Fortschritt, seine Projektion sowie die Overfitting-Prüfung klammern das
   Modell aus. Bei den Bewertungen der sprechenden Person fügt sein `why` deren Zählwerte und *„ein
   deutlicher Unterschied: das neuere Modell ist bei den Sätzen besser, die die Familie
   benötigt“* hinzu. Auf dem nächsten Bogen stammt die Hälfte der Entwurfszeilen aus dem Modell, das es
   ersetzt hat, sodass die sprechende Person die Hochstufung verblindet prüft (unten).
4. Andernfalls verbleibt das verwendete Modell und die nächste Runde beginnt – es sei denn, die
   letzten beiden Rundenurteile seit dem letzten Modellwechsel lauten beide
   **no-change** oder **worse**, während `cpu-tiny` verwendet wird. Der letzte Modellwechsel
   ist der neueste `model-change`- (ein Preset-Wechsel oder ein `not-now`) oder
   `choose`-Eintrag im Protokoll – jedes Modell, das die Beteiligten in den Einsatz übernommen haben,
   einschließlich einer Hochstufung anhand der Bewertungen der sprechenden Person. Eine **too-few**-Runde ist keine
   bewertete Runde: Wenn eine der letzten beiden „too-few“ war, gibt es kein Angebot.
   Dann **`improve-stronger-model`** (`ask_user`):
   `nmt-forge use-model <preset> --config config.json --answer yes` (oder
   `not-now`), das Preset `byt5-small` oder `byt5-small-lowmem`
   ([Modelle](#models)). Der Antwortplatz ist `try_it`. `yes` schreibt das
   Modell der Konfiguration neu (wobei das Zeitbudget der Beteiligten beibehalten wird) und der nächste Schritt trainiert
   es; `not-now` ändert nichts. Beides wird in das Protokoll geschrieben
   (`model-change`), und das Angebot erscheint erst nach zwei weiteren solchen Runden wieder.
   Über MCP ist „nicht jetzt“ hier die Antwort `try_it: "not-now"`;
   `declined: true` wird bei diesem Schritt abgelehnt
   ([MCP](/docs/agents/mcp#not-now)). Sein `why` besagt niemals, dass mehr Sätze
   nichts nützen: Wenn das Entwicklungsset zu klein ist, um den Zuwachs einer Runde zu erkennen, *„könnten sich
   kleine Zuwächse verbergen“*; andernfalls brachten die Runden *„keine Veränderung, die die
   Entwicklungssätze erkennen können (etwa X chrF++-Punkte oder mehr): Die Runden fügen möglicherweise
   weniger als das oder gar nichts hinzu“* – nahe dem oberen Ende der Kurve bringt eine Runde
   etwa einen halben chrF++-Punkt, was unter dem liegt, was 200 Entwicklungssätze abbilden.
   **Hinweis.** `--answer` ist standardmäßig `yes`: Übergeben Sie die Antwort der Beteiligten
   immer explizit.

Die Rails steuern den Rest einer Runde (`champollion improve …`): `nmt-forge wishlist` schreibt den Bogen dessen, was am meisten helfen würde (standardmäßig 40 Vorgaben, mindestens ein Viertel davon offengelassen; Wörter darin, die das Modell noch nie gesehen hat, fordern jeweils zwei oder drei Sätze an, von denen jeder etwas anderes aussagt – ein im Training nur einmal gesehenes Wort wird selten gelernt ([Messung](/docs/agents/measurement#what-the-wishlist-steers-on))), `nmt-forge analyze` schlüsselt den Dev-chrF++ nach Satzart auf und `nmt-forge grow-dev` fügt die Übungssätze der sprechenden Person unter demselben Namen dem Dev-Satz hinzu – niemals eine Zeile, die bereits im Dev-Satz enthalten ist, niemals eine, deren Ausgangstext in einem Test- oder versiegelten Satz liegt. Eine Satzart steuert die Wunschliste nur dann, wenn sie deutlich schlechter abschneidet als der Rest ([Messung](/docs/agents/measurement#what-the-wishlist-steers-on)).
`nmt-forge draft-newer` (ausgeführt von `champollion improve sheet`) entwirft eine zufällige Hälfte der Zeilen des nächsten Prüfungsbogens unmarkiert mit dem anderen Modell, sodass die sprechende Person beide Modelle blind beurteilt ([Messung](/docs/agents/measurement#the-speakers-marks)): das neueste trainierte Modell, wenn es nicht das aktuell verwendete ist (seine Runde kam nicht zum Einsatz), oder nach einer Hochstufung das Modell, das durch das aktuell verwendete ersetzt wurde. Sein `--json` gibt an, um welches es sich handelt (`relation`: `newer` oder `replaced`, `null`, wenn es kein anderes Modell gibt und jede Zeile vom aktuell verwendeten Modell stammt), zusammen mit `other`, `in_use`, den Trainingspaaren hinter jedem (`other_pairs`, `in_use_pairs`) und `n`; der Eintrag `draft-newer` des Hauptbuchs zeichnet dasselbe auf. Wie eine Runde vermittelt wird: [Coaching](/docs/agents/coaching).

## Synthetische Daten und Rückübersetzung

- `nmt-forge synth <pack> --out <file>` führt den Generator eines Sprachpakets aus. Forge liefert keine Pakete mit. Jede Zeile wird verifiziert und mit `synthetic: true` gekennzeichnet.
- Eine synthetische Datei wird als gekennzeichnete Spur in `config.json` trainiert (`data.synthetic`, `{"path", "tag": "<synth>"}`). Bei mehr als 15 % einer Art wird der Durchlauf verweigert, es sei denn, die Konfiguration nennt `mix.synthetic_sample`; `nmt-forge sample --cap 0.15 --key kind` zieht eine gedeckelte Stichprobe.
- **Für die Rückübersetzung gibt es keinen Befehl.** Sie ist eine Bibliotheksfunktion (`nmt_forge.training.backtranslation.backtranslate`): Sie stellen das Rückübersetzungsmodell bereit; es gleicht den einsprachigen Text zunächst mit jedem registrierten Set ab und kennzeichnet seine Ausgabe mit `<bt>`; die Ausgabe wird dann als synthetische Spur trainiert. Es wird kein Qualitätsfilter darauf angewendet. `config.data.monolingual` wird zurückgewiesen.
- **Hinweis.** Einsprachiger Text sind Daten der Gemeinschaft wie alle anderen: Seine Sidecar-Bedingungen gelten, und ein Rückübersetzungsmodell, das ein gehostetes LLM ist, sendet ihn an einen Anbieter ([Datenregeln](/docs/agents/data-rules)).

## Symptom → Ursache → Behebung

| Symptom | Wahrscheinliche Ursache | Behebung |
|---|---|---|
| `cpu-tiny` erzielt zwischen 5 und 30 chrF++ auf dem Dev-Satz | Es ist konzeptbedingt schwach: ein Sprachführer für Wendungen wie in seinen Trainingsdaten | Mehr echte Paare; auf Apple Silicon oder einer GPU `byt5-small` (`nmt-forge use-model byt5-small`; `byt5-small-lowmem`, wenn die GPU über 8–15 GB verfügt) |
| „Gut bei Vorlagen, schlecht bei echtem Text“ | Regel R7 (Transfer-Plateau): Der Dev-Loss hat vor dem letzten Checkpoint seinen Tiefststand erreicht und stieg um 5 % oder mehr an. Sie greift bei jedem solchen Anstieg, unabhängig vom Verlauf des Dev-chrF++ – lesen Sie dies zusammen mit den Dev-Bewertungen | Mehr echte Paare. Wird von `nmt-forge lint <run-manifest.json>` angezeigt, nicht durch Export |
| Das Ergebnis wirkt zu gut | Test-Kopien oder Fast-Duplikate im Training; oder die meisten Testzeilen haben einen Trainings-Zwilling (R4-recall-not-translation, bei der Hälfte oder mehr) | `leak-audit --drop-test-twins` für eine datei ohne Zwillinge; berichten Sie Ergebnisse mit und ohne die Zwillinge |
| Ein geringer Unterschied zwischen zwei Modellen | Das Intervall ist breit (R5-low-power, Intervall breiter als 8 Punkte) | `nmt-forge compare` (gepaarter Test); für Runden `compare-runs`. Vergrößern Sie den Dev-Satz |
| Eine Runde meldet „zu wenige Dev-Sätze zur Beurteilung“ (`too-few`) | Der Dev-Satz umfasst weniger als 50 Sätze: Hier trifft kein Vergleich eine Entscheidung | Nichts zu beheben: Der nächste Bogen mischt die Entwürfe beider Modelle blind und die Bewertungen der sprechenden Person entscheiden; jede zweite Bogenzeile ist eine Übungszeile, bis der Dev-Satz 50 umfasst |
| Eine Runde meldet „keine messbare Veränderung“ | Der Dev-Satz ist zu klein, um den Zuwachs einer Runde zu erkennen | Vergrößern Sie ihn anhand der Übungssätze der sprechenden Person (`grow-dev`, gesteuert durch `champollion improve prepare`) |
| Training verweigert: `[disk-room] this computer has … free` | Die Festplatte kann die Checkpoints des Durchlaufs nicht fassen | `nmt-forge tidy` listet auf, was Modelle früherer Runden freigeben würden; `nmt-forge tidy --yes` nach Zustimmung der Person; oder geben Sie anderswo Speicherplatz frei. `--skip-disk-check` nur dann, wenn die Person entscheidet, dass die Schätzung falsch ist |
| Ein Durchlauf übertrifft die Wörterbuch-Untergrenze nicht | Das Training hat nichts gelernt, was die Wortliste nicht bereits liefert | Mehr Paare; prüfen Sie die Abdeckung der Untergrenze; teilen Sie dies den Beteiligten mit |
| Der Dev-Satz ist saturiert | Die Untergrenze des Intervalls liegt bei 99 % des Maximalwerts | Ein anspruchsvollerer Dev-Satz; die Punktzahl kann nicht weiter steigen |
| Vor dem Training abgelehnt | Siehe die Zeile „Training“ oben; `preflight run` nennt jedes fehlgeschlagene Gate und seine Behebung | Befolgen Sie die Behebung. Ein fehlendes Trainings-Extra: `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'` (oder `pip` im Python von Forge selbst) |
| Durch die Echtzeitbegrenzung (Wall Clock) gestoppt | Der prognostizierte Durchlauf überschreitet das Budget (24 Stunden ohne Vorgabe) | Ein kleineres Modell oder weniger Epochen, oder ein von den Beteiligten festgelegtes Budget (`model.time_budget_hours`) |
| Ein Hintergrundauftrag ist fehlgeschlagen | `nmt-forge jobs` zeigt `crashed`, `stalled`, `deadline`, `lost` oder `refused` | Lesen Sie sein `stderr.log` in `.forge/jobs/<name>/` und beheben Sie den Fehler; trainieren Sie dann erneut oder setzen Sie ab dem letzten Checkpoint fort, wenn `status` `--resume` nennt |
| Das Training wartet und startet nicht | Ein anderes Training auf diesem Computer läuft bereits; dieses ist dahinter eingereiht (`queued_behind`) | Warten Sie: Es startet von selbst. Starten Sie kein weiteres |
| Lange Sätze werden abgeschnitten ausgegeben | Die Längenbegrenzungen: `status` warnt mit Zählwerten (im Training gekürzte Paare, beim Eingang gekürzte Dev-Sätze, an der Obergrenze gestoppte Übersetzungen) | Teilen Sie lange Sätze auf; oder erhöhen Sie `model.max_src`, `model.max_tgt` und `decode.max_new_tokens` (längeres Training) |
| Wörter werden als unbekannte Fragmente ausgegeben (`cpu-tiny`) | Das Vokabular wird ausschließlich aus den Trainingszeilen gelernt | Mehr Paare, die diese Wörter verwenden; oder `byt5-small`, das Bytes einliest |

## Die Fehlertaxonomie

Forge entstand aus einem Katalog von Wegen, auf denen sich ein Trainingsprojekt selbst täuscht. Zusammenfassend – erzwungen bedeutet, dass die Werkzeuge es zurückweisen:

| Familie | Fehler | Im Code |
|---|---|---|
| Datenleck (Leakage) | Die Antwort im Trainingsset; Beinahe-Kopien; Paraphrasen, die die Trennung überspannen; verkettete Vorlagen | Erzwungen (Leak-Audit, Split-Schutz). Vorlagengeschwister werden beibehalten und gezählt |
| Dev-/Test-Kontamination | Auswählen von Checkpoints anhand des Test-Sets; zweimaliges Verbrauchen eines versiegelten Sets; ein Testergebnis ohne Vorhersage; Vorhersagen nach dem Lesen | Erzwungen (Dev-Abgrenzung, Evaluierungs-Hauptbuch, Vorabregistrierung) |
| Tokenizer und Orthographie | Ein Tokenizer, der die Schrift nicht schreiben kann; gemischte Rechtschreibkonventionen | Nicht geprüft bei Tokenizern; gemischte Konventionen sind ein Linting-Hinweis, nur wenn die Konfiguration sie nennt |
| Synthetische Daten | Beherrschen der synthetischen Mischung; vorzeitiger Abbruch (Early Stopping) beendet einen Durchlauf mit hohem Synthetikanteil; Kollaps; Rückübersetzung nährt sich von ihren eigenen Fehlern | Die Mindestgrenze für vorzeitigen Abbruch ist erzwungen; der Rest sind Linting-Hinweise oder Tags |
| Abdeckung | Fehlende Wörter für das Register | Ein Linting-Hinweis, wenn ein Plugin Abdeckung meldet |
| Messung | Ein Delta, das kleiner als sein Intervall ist; eine undurchsichtige Zahl; Metrik-Berechnungen außerhalb der Engine | Erzwungen: Jedes Ergebnis trägt sein Intervall und stammt aus der Engine |
| Dekodierung | Abgeschnittene Ausgabe; Checkpoints nach Loss statt nach Ausgabe ausgewählt | Erzwungen: Dekodierungsspielraum, Auswahl nach Generierungsmetrik; Längenbeschneidungen gezählt und davor gewarnt |
| Prozess | Unbekannte Konfigurationsschlüssel; Do-not-train-Daten; außer Kontrolle geratene Durchläufe | Erzwungen |

Bekannte Lücken, für die es noch keinen Code gibt: Tokenizer-Abdeckung, Qualität der Rückübersetzung, Kürzung nach Register, das Gold-/Synthetik-Verhältnis, Varianz über verschiedene Seeds.

## Ausgabe für Programme

`--json` gibt genau ein JSON-Dokument auf stdout aus. Eine Zurückweisung ist `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` und Exit 2 (`details` wird bei Zurückweisungen wegen Split- oder Dev-Abgrenzung hinzugefügt). Exit 1 ist ein unerwarteter Absturz. `nmt-forge run` endet mit `RUN EXIT <code>` (0, 1, 2 oder 130); `run --detach` gibt 0 mit dem Auftragsdokument zurück. `nmt-forge status --json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready", "blockers", "warnings", "answers"}}`.

## Weiterführende Informationen

- [Die `nmt-forge`-Befehlsreferenz](/docs/network/getting-started/forge-command-reference) – alle Unterbefehle und Flags.
- [Messregeln](/docs/agents/measurement) – was die Ergebnisse bedeuten.
- [Ihr erster Übersetzer](/docs/your-first-translator) und [Machen Sie es besser](/docs/make-it-better) – die Versionen für die Gemeinschaft.
- [Bereitstellung und Einsatz](/docs/agents/serving) – was ein Export enthält.
