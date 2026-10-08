---
sidebar_position: 1
title: "CLI-Referenz"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLI-Referenz

## Befehle

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

Die Befehle, die mit dem gemeinsamen Index und der Bestenliste statt mit Ihrem
Projekt arbeiten, sind unter `champollion network` gruppiert. Jeder funktioniert auch ohne das
Präfix:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

Führen Sie `champollion <command> --help` aus, um ausführliche Hilfe zu einem beliebigen Befehl zu erhalten
(`champollion network` listet die Netzwerkbefehle auf).

## Globale Optionen

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### Ein Sprachpaar angeben

Ein Projektpaar wird so geschrieben, wie `champollion.config.json` es schlüsselt: `en:fr`. `sync`, `verify` und `serve` lesen auch `en>fr` und `en-fr`, und `en-pt-BR` wird mit den von Ihnen konfigurierten Paaren abgeglichen. Die Netzwerkbefehle (`network register-corpus`, `leaderboard`, `recommend`, `submit`) schreiben ein Paar als `eng>crk`, das Format, das die Bestenliste speichert und `mt-eval` verwendet, und lesen `eng-crk` sowie `eng:crk` auf dieselbe Weise. Nur mit Bindestrichen besteht ein Paar aus zwei Codes mit zwei oder drei Buchstaben (`eng-crk`). Ein Code mit einem eigenen Bindestrich erfordert `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` wird abgelehnt, niemals erraten. Setzen Sie die `>`-Form in einer Shell in Anführungszeichen: Ohne Anführungszeichen leitet `--pair eng>crk` die Ausgabe in eine Datei namens `crk` um.

---

## init

Interaktiver Einrichtungsassistent, der `champollion.config.json` erstellt. Führt Sie durch die Quell-Locale, Zielsprachen, das Dateiformat und das Übersetzungsmodell.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**`--content-dir`-Option**: Ein Ordner mit Markdown-/MDX-Dateien, der zusätzlich zu Ihren Locale-Dateien übersetzt werden soll (angegeben als `contentDir`). Der Ordner muss existieren; `init` bricht ab, ohne etwas zu schreiben, falls er nicht existiert.

**Ein Projekt mit einer rein lokalen Datei verwendet standardmäßig `local`**: Die Standardmethode ist `llm` (OpenRouter, ein gehosteter Dienst). Wenn eine Datei irgendwo im Projekt als rein lokal markiert ist – ein `<file>.champollion.json` daneben mit `"transmission": "local-only"`, wie `champollion network register-corpus --data <file> --tier local-only` es schreibt –, verwendet `init` (ebenso wie `--yes`) standardmäßig stattdessen die `local`-Methode: ein Modell, das auf dieser Maschine bereitgestellt wird (Ollamas Standard `http://localhost:11434/v1` oder der Server, den `LOCAL_API_BASE` nennt). Es erklärt den Grund, nennt die markierte Datei und erklärt, wie man bewusst eine gehostete Methode auswählt: `champollion init --force --method llm --model <model>`. Ein explizites `--method` hat immer Vorrang; `init` weist dann neben der Textausgabe auf die markierte Datei hin.

**Erneutes Ausführen von `init` (`--force`)**: Ohne `--force` bricht `init` ab, wenn `champollion.config.json` bereits existiert. Damit geht `init` von dieser Datei aus und überschreibt nur das, was die Flags angeben: `--langs` legt die Zielliste fest (eine bereits vorhandene Sprache behält ihren Eintrag – Register, Schrift, Name), `--method` die Standardmethode (und das Modell dazu, sofern `--model` keines nennt), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name` und `--method api` die genannten Paare. Das Locale-Layout wird nur dann neu erkannt, wenn die Datei Ihre Quelldateien nicht mehr findet (oder `--dir` einen anderen Ordner angibt). Jede andere Einstellung – `batchSize`, `pairs`, `glossary`, Fallbacks, von Ihnen gewählte Register – bleibt unverändert. Es gibt jedes geänderte sowie die beibehaltenen Felder aus und kopiert die vorherige Datei zuerst nach `champollion.config.json.bak` (wenn dieses Backup bereits eine ältere Datei enthält, lautet das nächste `.bak.2`, `.bak.3` …; ein älteres Backup wird niemals überschrieben). Eine Datei, die kein gültiges JSON ist, kann nicht beibehalten werden: Sie wird gesichert und eine neue geschrieben. Um eine einzelne Einstellung zu ändern, bearbeiten Sie diese in der Datei – `init` muss dafür nie erneut ausgeführt werden.

**Auffinden Ihrer Locale-Dateien**: `init` sucht nach der Datei Ihrer Quellsprache, bevor etwas geschrieben wird. Es prüft zuerst den üblichen Ordner Ihres Frameworks (next-intl `messages/`, i18next `public/locales/<lang>/` dann `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), dann `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` und `src/i18n`, und gibt das Gefundene aus. Es schreibt niemals ein `localesDir`, das nicht existiert. Siehe [Locale File Layouts](/docs/getting-started/configuration#locale-layouts).

**`--langs`-Option**: Kommagetrennte Liste von Zielsprachcodes. Überspringt die Sprachabfrage und wendet die Standard-Registervorgabe jeder Sprache an – in die Konfiguration geschrieben, sodass die Auswahl sichtbar und bearbeitbar ist: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (ändern Sie einen Eintrag in eine andere Vorgabe oder in Ihre eigenen Worte, die den Tonfall beschreiben; eine Sprache ohne Vorgaben wird als `{}` geschrieben). Zudem werden die leeren Zieldateien in Ihrem Layout erstellt (`fr.json` oder `fr/common.json` für jeden Namespace). Kombinieren Sie dies mit `--yes` für eine vollständig nicht-interaktive Einrichtung.

**`--method api --endpoint <url>`**: Ein Server, der den Champollion-API-Vertrag erfüllt – zum Beispiel ein von Ihnen trainiertes Modell, das über `nmt-forge serve` bereitgestellt wird. `init` schreibt ein Paar pro Ziel, denselben Eintrag wie `DEPLOY.md` neben dem Modell: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. `--accepts-instructions true|false` gibt an, ob der Endpunkt schlüsselspezifische Anweisungen befolgt (ein mit nmt-forge trainiertes Modell tut dies nicht); ohne diese Angabe übernimmt `init` den Wert aus einem installierten Plugin-Manifest für denselben Endpunkt (`.champollion/methods/<name>/method.json`) oder lässt ihn unbestimmt. Er benötigt `--langs` (der Endpunkt wird pro Paar festgelegt) und einen Schlüssel nur für einen Endpunkt außerhalb dieser Maschine (`CHAMPOLLION_API_KEY`). Fügen Sie dem Paar manuell eine `fallback`-Methode hinzu, wie `DEPLOY.md` zeigt.

**`--script`-Option**: Einige wenige Sprachen werden in mehr als einer echten Orthografie geschrieben – Plains Cree (`crk`: `Latn` = Standard Roman Orthography, `Cans` = Silbenschrift/Syllabics), Serbisch (`sr`: `Latn`, `Cyrl`). Champollion trifft keine Wahl für eine Sprachgemeinschaft: `sync` weigert sich, eine solche Sprache zu übersetzen, bis die Konfiguration eine festlegt. Der Assistent fragt danach; übergeben Sie bei `--yes` den Parameter `--script crk=Cans` (mehrere: `--script crk=Cans,sr=Latn`; bei einer einzelnen Zielsprache genügt `--script Cans`), wodurch `"languages": { "crk": { "script": "Cans" } }` geschrieben wird. Ohne diesen Parameter gibt `init --yes` an, welche Sprachen eine Auswahl erfordern, listet die Optionen auf und gibt die Zeile `"script"` aus, die dem Eintrag dieser Sprache in der Konfiguration hinzugefügt werden muss.

**`--name`-Option**: Ein Code für den privaten Gebrauch (`qaa`–`qtz`, für eine Varietät ohne bestätigten Code) besitzt keine Sprachkarte, daher weist `init` darauf hin, anstatt Sie aufzufordern, die Schreibweise zu überprüfen. `--name qaa="Ayta (variety not yet confirmed)"` weist ihr den Anzeigenamen zu, den Prompts und Berichte verwenden, geschrieben als `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (mehrere: `--name "qaa=…;qab=…"`). Neben jedem Register gibt `init` auch die Geschlechterhinweise (Gender Guidance) aus, die LLM-Prompts für die Sprache enthalten ([Gender guidance](/docs/getting-started/configuration#gender-guidance)).

**Sprach-Voreinstellungen**: Wenn Sie zur Angabe der Zielsprachen aufgefordert werden, können Sie Voreinstellungsnamen eingeben:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Kombinieren Sie Voreinstellungen und einzelne Codes: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Übersetzt fehlende und veraltete Schlüssel in allen Locale-Dateien. Führt standardmäßig eine Post-Sync-Verifizierung durch.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: Standardmäßig lädt `sync` die Datei `.champollion/tm.json` und liefert zwischengespeicherte Übersetzungen für unveränderte Quellwerte aus. Ein Modellwechsel verwirft dies nicht: Bereits unter dem vorherigen Modell übersetzter Text wird kostenlos wiederverwendet, und sync weist vor dem Kostenvoranschlag darauf hin. Um sie stattdessen durch das neue Modell übersetzen zu lassen: `--redo all --fresh-on-model-change` – dies sendet die Schlüssel, die ein früheres Modell übersetzt hat, während das, was das neue Modell bereits übersetzt hat, weiterhin aus dem Cache stammt (für sich genommen betrifft `--fresh-on-model-change` nur Schlüssel, die der Durchlauf ohnehin übersetzt). Verwenden Sie `--no-tm`, um den Cache vollständig zu umgehen (nützlich beim Debuggen der Qualität). Siehe [Translation Memory](/docs/concepts/translation-memory).

**Kostenvoranschlag und `--max-cost`**: Die Schätzung bepreist nur das, was der Durchlauf abrechnen wird. Schlüssel, Front-Matter-Felder und Markdown-Blöcke, die sich bereits im Translation Memory befinden, werden mit 0 $ angesetzt, und die Tabelle zeigt, was der Cache einspart. Ein Modell, das auf dieser Maschine bereitgestellt wird (`local` oder ein `api`-Endpunkt unter `localhost`/`127.0.0.1`/`::1`), zeigt `$0 (local)` – keine API-Kosten; Ihre Hardware und Ihr Stromverbrauch werden nicht eingerechnet. `--max-cost` vergleicht mit diesem Betrag. Wird die Obergrenze überschritten oder liegt keine Schätzung vor (eine Methode ohne veröffentlichten Preis, wie etwa `local`, das auf eine andere Maschine verweist), stoppt sync vor jedem API-Aufruf und wird mit `2` beendet; es wird nichts übersetzt oder geschrieben. Die Abschlusszeile gibt an, wie viele Schlüssel an das Modell gesendet wurden und wie viele aus dem Cache stammten.

Unter der Tabelle gibt eine Zeile den Tarif an, zu dem der Betrag berechnet wurde, sowie dessen Herkunft – bei einem gehosteten Modell der Preis pro 1 Mio. Eingabe- und Ausgabetoken aus der öffentlichen Preisliste von OpenRouter und wann diese ausgelesen wurde (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`); bei einem direkten Anbieter (`openai`, `anthropic`, `gemini`) dient dieselbe Liste als Stellvertreter für die anbietereigenen Preise, und falls die Liste nicht gelesen werden kann (oder keinen Preis für das Modell enthält), wird eine in Champollion hinterlegte Kopie verwendet, zusammen mit dem Datum der letzten Überprüfung und dem Grund dafür; DeepL, Google und Microsoft anhand ihrer veröffentlichten Preise pro Zeichen inklusive Datum. Es handelt sich um eine Schätzung: Die Zeile nennt die angenommene Anzahl von Token (oder Zeichen) pro Schlüssel, und die tatsächliche Rechnung hängt von den realen Längen ab. Mit `--json` enthält die Schätzung die Details: `rate` jedes Paars und `rates` des Durchlaufs (`inputPerMillion`, `outputPerMillion` oder `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` oder `verified`).

**Die Anfrage einsehen**: `sync --dry --show-prompt [key]` gibt die genaue Anfrage aus, die an die Methode des Paars gesendet werden würde – die System- und Benutzernachrichten (oder bei einem `api`-Endpunkt der Request-Body), erstellt durch den eigenen Code der Methode, mit geschwärzten API-Schlüsseln – und sendet nichts ab. Bei Angabe eines Schlüssels (benannt wie `--redo keys:` ihn benennt: `verb␄Open`, `common::nav.home`; eine gettext-msgid mit Komma kann vollständig angegeben werden) wird die Anfrage für diesen Schlüssel angezeigt, unabhängig davon, ob er sich in der Warteschlange befindet. Wenn ein echter Durchlauf dafür nichts senden würde (weil er aktuell ist, aus dem Cache bedient wird oder zurückgehalten wird), wird dies mitgeteilt und der `--redo keys:<key> --fresh`-Befehl genannt, der ihn senden würde. Ohne Schlüssel wird der erste Batch angezeigt, den jede Datei senden würde, oder gemeldet, dass nichts gesendet werden würde. So lässt sich überprüfen, ob ein gettext-`msgctxt`, ein `#.`-Kommentar oder eine ARB-Beschreibung das Modell erreicht. Maschinelle Übersetzungsdienste (DeepL, Google …) erhalten ausschließlich den Quelltext; die Vorschau weist darauf hin. Mit `--json` wird jede Anfrage als `{"level": "event", "event": "request", …}`-Zeile ausgegeben.

**Testläufe (Dry Runs)**: `--dry` übersetzt nichts und schreibt nichts, prüft jedoch vorab das, was auch ein realer Durchlauf prüfen würde: Fehlt ein von der Methode benötigter Schlüssel (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …), warnt es davor, dass der reale Durchlauf stoppen würde, und nennt die Variable. Es wird lediglich geprüft, ob der Schlüssel gesetzt ist, nicht ob er funktioniert: Da nichts gesendet wird, genügt ein Platzhalter. Der Exit-Code ist dennoch `0` – eine Vorschau schlägt niemals fehl (siehe [Exit-Codes](#sync-exit-codes)). Dasselbe gilt für `--max-cost`: Ein Testlauf bricht an der Obergrenze nicht ab, aber wenn die Schätzung darüber liegt (oder unbekannt ist), weist er am Ende einmal darauf hin, dass der reale Durchlauf dort stoppen und mit `2` enden würde. Mit `--json` ist jede Zeile ein JSON-Objekt mit einem `level` (`info`, `ok`, `event` auf stdout; `warn`, `error` auf stderr), und die letzte stdout-Zeile ist die Zusammenfassung, `{"level": "summary", "command": "sync", …}`, welche `preflight: { ready, failures }`, bei einer Obergrenze `maxCost: { cap, estimatedCost, wouldStop, exitCode }`, und `realRun: { exitCode, wouldStop, reasons }` enthält – den Exit-Code, mit dem der reale Durchlauf enden würde, soweit eine Vorschau dies vorhersehen kann (siehe [Exit-Codes](#sync-exit-codes)). Führen Sie ihn mit den Flags aus, die der reale Sync nutzt (`--method`, `--model`): Ohne diese prüft er die in der Konfiguration angegebene Methode. Der eigene Exit-Code eines Testlaufs lässt einen CI-Schritt niemals fehlschlagen; daher erklärt die Warnung `--max-cost`, wie sich eine CI-Bedingung einrichten lässt: Lesen Sie `maxCost.wouldStop` (oder `realRun.exitCode`) aus der `--json`-Zusammenfassung aus – zum Beispiel `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. Der [Prüfschritt im CI-Leitfaden](/docs/guides/ci-cd#check-before-sync) tut genau dies und gibt bei einem Fehler die Ursache aus (`realRun.reasons`) statt eines bloßen `false`. Das `totalPluralGaps` des Testlaufs zählt die Pluralnachrichten auf der Festplatte ohne eine von der Sprache verwendete Form, die der reale Durchlauf nicht erneut anfordern würde, und `verify` ist `{ "ran": false }` (da nichts geschrieben wurde, wurde auch nichts verifiziert).

**Erneutes Übersetzen**: `--redo` bestimmt, *was* erneut übersetzt werden soll, und `--fresh` bestimmt, *ob dafür bezahlt werden soll*. Ohne `--fresh` wird alles, was der Cache bereits enthält, kostenlos zurückgegeben (und durchläuft dennoch das Quality Gate); damit wird alles in der Warteschlange neu übersetzt und abgerechnet. Die älteren Flags (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) funktionieren weiterhin und bedeuten genau das, was in der Tabelle angegeben ist.

**Auf Dateien eingrenzen**: `--files` beschränkt den Content-Schritt auf passende Dateien, und `--redo files:<glob> --fresh` erzwingt neue Übersetzungen für passende Dateien (die einzige bewusste Neuausgabe). Muster werden mit den Pfaden abgeglichen, die sync ausgibt (relativ zu `contentDir`, `2026-10.md`), sowie mit demselben Pfad ab dem Projektstamm (`newsletter/2026-10.md`): `*` bleibt innerhalb eines Ordners und `**` ordnerübergreifend. Beide Flags können mehrfach angegeben werden. Ein Muster, das auf keine Datei zutrifft, bricht den Durchlauf ab, bevor Kosten entstehen. Der Key-Value-Schritt ist bereits inkrementell und läuft wie gewohnt ab.

**Fehler**: Das Fehlschlagen einer Inhaltsdatei stoppt die anderen nicht. Erfolgreich verarbeitete Dateien werden protokolliert und ihre Übersetzungen zwischengespeichert. Der Durchlauf endet mit einer Liste der fehlgeschlagenen Dateien und deren jeweiligem Restzustand. Eine Dateizeile lautet niemals `[OK]`, wenn Schlüssel darin nicht übersetzt wurden. Die Fehlerzusammenfassung gibt pro Schlüssel an, was der nächste Sync tut: erneut anfragen (keine brauchbare Antwort), noch einmal anfragen (ausstehend nach einer Wiederholung) oder zurückhalten (vom Quality Gate abgelehnt). Markdown-Blöcke und Front-Matter-Felder, die das Gate abgelehnt hat, werden pro Seite auf dieselbe Weise zurückgehalten; `--redo files:<page>` oder `--redo content` fragt erneut an ([Quality Gate](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Der Exit-Code ist `0` (alles in Ordnung), `2` (teilweise: ein Teil der Arbeit wurde erledigt, etwas ist fehlgeschlagen, wurde zurückgehalten oder konnte nicht verifiziert werden, eine Pluralnachricht wurde ohne eine von der Sprache für normale Zählungen verwendete Form geschrieben – oder durch `--max-cost` gestoppt, bevor Kosten entstanden sind) oder `1` (nichts war erfolgreich).

**Änderungserkennung**: Champollion speichert SHA-256-Hashes in `.champollion.lock`. Wenn sich Quellwerte ändern, übersetzt der nächste Sync diese Schlüssel automatisch neu. Committen Sie die Lock-Datei, damit alle Entwickler dieselbe Ausgangsbasis teilen. Die Lock-Datei zeichnet außerdem pro Ziel-Locale einen Fingerabdruck jedes von Sync geschriebenen Werts auf (sodass ein manuell bearbeiteter Wert erkannt und bei Massenwiederholungen beibehalten wird – [Übersetzungen bearbeiten](/docs/guides/professional-translators#editing-key-value-files)), die Schlüssel, die eine Wiederholung nicht abschließen konnte (**ausstehend / pending**: der nächste Sync fragt sie noch einmal an) und die Schlüssel, die das Quality Gate abgelehnt hat (**zurückgehalten / held back**: werden bei einem normalen Sync nicht erneut an dasselbe Modell gesendet – [Quality Gate](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**Manuelle Bearbeitungen und Wiederholungen**: `--redo all`, `--force` und ein Modellwechsel behalten manuell bearbeitete Werte bei und geben an, welche dies sind; `--redo keys:<key>` unter Angabe eines Schlüssels ersetzt diesen; ein Schlüssel, dessen Quelltext geändert wurde, wird erneut übersetzt. Eine ersetzte Bearbeitung wird ausgegeben und an `.champollion-replaced-edits.jsonl` angehängt (nachverfolgt – committen Sie dies zusammen mit der Lock-Datei).

**gettext-Schlüssel mit Kontext**: Ein Schlüssel setzt sich zusammen aus `msgctxt` + U+0004 + `msgid`. Berichte geben das Trennzeichen als `␄` aus, was `--redo keys:` und `--force-keys` wieder akzeptieren; um ein solches Zeichen einzugeben, schreiben Sie `\x04`: `--redo 'keys:django::verb\x04Open'` (einfache Anführungszeichen erhalten den Backslash). Beide Schreibweisen funktionieren. Reparaturbefehle geben die `␄`-Form aus, gefolgt von einem Shell-Kommentar, der `\x04` nennt.

**Ein angegebener Schlüssel, der auf nichts zutrifft**: `--redo keys:` / `--force-keys` mit einem Namen, den kein Quellschlüssel besitzt (ein Tippfehler oder eine msgid, die nur mit einem Kontext existiert), schlägt mit Exit-Code 1 fehl. Der Fehler listet die ähnlichsten Schlüssel auf, einschließlich jeder Kontextvariante dieser msgid, in beiden Schreibweisen. Wenn keiner der Namen übereinstimmt, wird nichts ausgeführt. Wenn einige übereinstimmen, werden diese wiederholt, und anschließend schlägt der Durchlauf unter Nennung der restlichen fehl.

**Ein aus dem Cache bedienter benannter Schlüssel**: Ohne `--fresh` liefert eine Wiederholung den Inhalt des Caches aus (erneut geprüft, ohne Kosten) und weist darauf hin, zusammen mit dem `--fresh`-Befehl, der das Modell erneut anfragt, und dessen Kosten.

**Parallelität**: Sowohl die Übersetzung von JSON-Schlüsseln als auch die Übersetzung von Inhalten laufen parallel. JSON-Locales werden gleichzeitig übersetzt (Standard: 200 parallele Locales), wobei auch die Batches innerhalb jeder Locale parallelisiert werden (4 parallele Batches). Die Inhaltsübersetzung (Markdown, MDX, Blog-Beiträge) läuft in einem flachen Arbeitspaket-Pool (Standard: 48 parallele API-Aufrufe). Überschreiben Sie dies mit `--json-concurrency`, `--content-concurrency` oder `--concurrency` (setzt beides).

**Ausgabe**: Sync zeigt ein Versions-Banner, Format-/Framework-Erkennung, eine Kostenschätzung und Fortschrittsbalken pro Locale an:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Fortschrittsbalken aktualisieren sich nach jedem Batch (~80 Schlüssel) direkt an Ort und Stelle. Verwenden Sie `--quiet` nur für Fehler/Warnungen oder `--json` für maschinenlesbare NDJSON-Ausgabe. Beides unterdrückt den Fortschrittsbalken und das Banner. Mit `--json` wird vor dem `--max-cost`-Gate ein `cost`-Ereignis ausgegeben, für jede Inhaltsdatei und jedes Locale ein `file`-Ereignis, und ein `summary` schließt jeden Durchlauf ab.

### Exit-Codes {#sync-exit-codes}

| Code | Reeller Durchlauf | Testlauf (`--dry`) |
|------|------------|---------------------|
| `0` | Alles in der Warteschlange wurde übersetzt und verifiziert, oder es befand sich nichts in der Warteschlange. | Wurde ausgeführt – selbst wenn gemeldet wird, dass der reale Durchlauf stoppen würde. |
| `2` | Teilweise: Ein Teil der Arbeit wurde erledigt, aber etwas ist fehlgeschlagen, wurde zurückgehalten oder konnte nicht verifiziert werden, oder eine Pluralnachricht wurde ohne eine Form geschrieben, die die Sprache für gewöhnliche Zählungen verwendet. Ebenso: `--max-cost` hat den Durchlauf gestoppt, bevor etwas gesendet wurde. | Niemals. |
| `1` | Nichts war erfolgreich oder der Durchlauf konnte nicht starten: Ein von der Methode benötigter Schlüssel fehlt, ein vom Durchlauf benötigter Modellserver antwortet nicht, ein für eine Wiederholung angegebener Schlüssel stimmt mit keinem überein, ein `--files`-Muster passt auf keine Datei oder die Konfiguration ist ungültig. | Der Testlauf selbst konnte nicht ausgeführt werden: Ein für eine Wiederholung benannter Schlüssel stimmt mit keinem überein, ein `--files`-Muster passt auf keine Datei oder die Konfiguration ist ungültig. |

Ein Testlauf endet absichtlich mit `0`: Es handelt sich um die Vorschau, die Sie vor einer Entscheidung ausführen, und ein CI-Schritt, der nur prüft, darf nicht fehlschlagen. Was der reale Durchlauf tun würde, steht in den letzten Zeilen des Testlaufs und in seiner `--json`-Zusammenfassung: `preflight.ready: false` bedeutet, dass der reale Durchlauf vor dem Übersetzen stoppen und mit `1` enden würde (`preflight.failures` gibt den Grund an); `maxCost.wouldStop: true` bedeutet, dass er an der Obergrenze stoppen und mit `2` enden würde (`maxCost.exitCode: 2`); `maxCost.exitCode: 1` bedeutet zusammen mit `maxCost.stopsEarlier`, dass der Preflight-Check ihn stoppen würde, bevor die Obergrenze geprüft wird. `realRun.exitCode` fasst diese zusammen, ergänzt um das, was den realen Durchlauf unvollständig machen würde: zurückgehaltene Schlüssel oder Pluralnachrichten auf der Festplatte ohne eine von der Sprache verwendete Form, die er nicht erneut anfordern würde (`2`; `realRun.reasons` nennt diese, und die letzte Zeile des Testlaufs weist darauf hin). Eine Ablehnung durch das Quality Gate oder eine fehlgeschlagene Verifizierung, die nur der reale Durchlauf feststellen kann, kann ein prognostiziertes `0` dennoch in ein `2` verwandeln. Der [Prüfschritt im CI-Leitfaden](/docs/guides/ci-cd#check-before-sync) wandelt diese in einen fehlschlagenden CI-Schritt um, der den Grund ausgibt.

---

## watch

Automatische Synchronisierung, wenn sich die Quell-Locale-Datei ändert. Läuft, bis der Vorgang mit `Ctrl+C` unterbrochen wird.

```bash
champollion watch
```

---

## audit

Das Vollständigkeits-Gate. Listet jeden Schlüssel auf, der nicht übersetzt ist – fehlend, leer oder noch ein `[EN]`-Fallback – sowie jede Übersetzung, die **veraltet** ist: basierend auf einem älteren Quelltext als dem aktuellen (gemäß `.champollion.lock`; eine Quelltextänderung, deren Neuübersetzung fehlschlug, hinterlässt genau dies). Jede Liste veralteter Einträge endet mit dem Befehl, der sie neu übersetzt. Endet mit Exit-Code 1, falls Treffer gefunden werden – nutzen Sie dies als CI-Gate, um Builds mit unvollständigen oder veralteten Übersetzungen fehlschlagen zu lassen.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

Liest alle Locale-Dateien erneut von der Festplatte und überprüft, ob die Übersetzungen tatsächlich vorhanden und korrekt sind. Dies ist dieselbe Verifizierung, die am Ende jedes `sync` automatisch ausgeführt wird (sofern nicht `--no-verify` übergeben wird).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**Was geprüft wird:**
- Schlüsselparität – alle Quellschlüssel sind in jedem Ziel vorhanden (bei i18next-Pluralschlüsseln die Schlüssel der eigenen CLDR-Pluralformen des Locales: Französisch benötigt auch `count_many`)
- `[EN]`-Fallback-Marker aus früheren Durchläufen
- Leere Übersetzungen
- Schrift-Konformität – ein nicht-lateinisches Locale darf keinen reinen Latein-Text enthalten; Buchstaben werden nach Unicode-Schrift klassifiziert, akzentuierte und vollbreite lateinische Buchstaben zählen also als Latein. Vollbreite lateinische Buchstaben sind in jedem Locale außerhalb der CJK-Typografie ein Fehler
- Platzhalter, wobei jeder Befund nach der beteiligten Syntax benannt wird – ICU MessageFormat-Struktur (`ICU structure error`: ein `{name}`-Argument, ein übersetztes plural/select-Schlüsselwort oder ein Selektor, ein verloren gegangenes `#`), printf-Konvertierungen (`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` – ein verloren gegangenes `%(name)s` eines gettext-Katalogs wird als printf und nicht als ICU bezeichnet), i18next-Interpolation (`i18next {{…}} placeholder mismatch`: `{{name}}`, einschließlich `{{name}}` geschrieben als `{name}`, was i18next unverändert ausgibt) und ein einzelnes geschweiftes Klammerpaar `{name}` außerhalb einer ICU-Nachricht (`{…} placeholder mismatch`)
- Markup – pro Tag-Name dieselben öffnenden, schließenden und selbstschließenden Tags wie in der Quelle, in gleicher Verschachtelung (ein verloren gegangenes `</strong>` ist ein Fehler)
- Kodierungsprobleme – BOM-Marker, unsichtbare Zeichen
- Quelltext-Echos – Werte, die mit der Quelle identisch sind (Warnung)
- Pluralformen – eine Pluralnachricht ohne eine Form, die die Sprache für gewöhnliche Zählungen verwendet (Russisch `few`/`many`), ein gettext-Eintrag, dessen Formen lediglich `other` wiederholen (sync markiert diese mit einem `# champollion:`-Kommentar), ein i18next-Schlüssel oder `msgstr[n]` für eine Form, die die Sprache nicht besitzt (Warnungen)
- Identische Locales – zwei Ziel-Locales mit demselben Text für die meisten Schlüssel: Eines ist wahrscheinlich in der Sprache des anderen verfasst (Warnung)
- Gleicher Text, unterschiedliche Quellen – ein einziger Text wurde für mehrere unterschiedliche Quellzeichenfolgen ausgegeben (ein Modell wiederholt einen auswendig gelernten Satz): zwei deutlich unterschiedliche Mehrwort-Zeichenfolgen werden mit demselben Text aus vier oder mehr Wörtern beantwortet (oder drei oder mehr andernfalls); ein Satz, bei dem ein früherer Sync das Modell beim Wiederholen erfasst hat, zählt bereits beim ersten Auftreten. Dies wird über Schlüsselwerte, jeden ICU-plural/select-Zweig (die Zweige eines Plurals zählen als eine Quelle) und die Markdown-Seiten des Locales gezählt (Front-Matter-Felder und Blöcke; abgesehen von `# ` und Satzzeichen am Ende), nach derselben Regel, mit der das Gate von `sync` ihn ablehnt (Fehler)
- Veraltet – eine Übersetzung, die aus einem älteren Quelltext als dem aktuellen erstellt wurde (hier eine Warnung; `audit` schlägt dabei fehl)
- Ein ausgelassenes Frage- oder Ausrufezeichen – die Quelle endet auf `?` oder `!` und die Übersetzung endet weder darauf noch auf das Äquivalent der Zielschrift (`？`, `؟`, Griechisch `;`, …). Eine Warnung: Einige Sprachen kennzeichnen Fragen stattdessen mit einem Wort oder einer Partikel

Es prüft die Struktur, nicht die Bedeutung: Ein erfolgreicher Durchlauf bedeutet, dass Schlüssel, Platzhalter, Plurale, Markup und Schrift intakt sind, nicht aber, dass der Text inhaltlich korrekt ist – lassen Sie ihn von einem Muttersprachler prüfen, bevor Sie sich darauf verlassen.

**Welche Locales.** `verify` prüft jedes Locale; `verify --pair en:fr` prüft
ausschließlich Französisch. Nach `sync --pair en:fr` umfasst die Prüfung nach dem Sync die Paare,
die ausgeführt wurden, keine anderen. Eine eingegrenzte Prüfung weist in ihrer Abschlusszeile darauf hin – `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json`. Diese Zeile enthält
`checked` (die geprüften Locales) und `scope`.

**Pluralabdeckung.** Der Block jedes Locales enthält eine Zeile pro Pluralart,
die seine Dateien enthalten – Schlüssel mit i18next-Suffix, ICU-Pluralnachrichten, gettext-`msgid_plural`-Einträge –,
in der die Formen benannt werden, die das Locale voraussichtlich aufweisen muss
(die CLDR-Pluralkategorien dafür; in einem gettext-Katalog diejenigen, für die dessen
`Plural-Forms` einen Platz vorsieht) und ob jeder Plural diese aufweist:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` nennt die Plurale, denen eine Form fehlt. Eine Form, die nur Zahlen über 1000 oder
Bruchzahlen verwenden (französisches `many` in einer ICU-Nachricht), wird separat ausgewiesen: Die `other`-Form
vertritt sie, was keinen Befund darstellt. Die Zeile ist eine Zusammenfassung – eine
fehlende Form ist zugleich ein Befund darüber (ein fehlender Schlüssel, eine Plural-Warnung).

**`--json`** schreibt ein JSON-Objekt pro Zeile. Jedes Locale erhält einen Datensatz auf
stdout – `{"level": "event", "event": "verify", "locale": "fr", …}` – mit
`ok`, `keys` (`expected`, `present`, `missing`, `extra`), dessen `errors`,
`warnings` und `infos`, `placeholders` (jeder Befund mit dessen `syntax`: `icu`,
`printf`, `i18next`, `brace` oder `markup`) und `plurals` (nach Art und Typ:
`categories`, `total`, `complete`, `incomplete`). Die Befunde erscheinen auch als
`error`/`warn`-Zeilen auf stderr, und die Abschlusszeile behält ihr Level und ihre
Nachricht (`ok` auf stdout, wenn die Prüfung bestanden wird, `error` auf stderr, wenn dies nicht
der Fall ist) und enthält die Zähler `errors` und `warnings`. Nach einem Sync erscheinen dieselben
Datensätze vor der eigentlichen Sync-Zusammenfassung. (Die Datensätze eines Docusaurus-Projekts
enthalten weder `keys` noch `plurals`: Seine UI-Strings werden Datei für Datei geprüft.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**Exit-Code:** `1`, wenn ein Fehler gefunden wurde – oder wenn überhaupt nichts
geprüft werden konnte (die Quelldatei oder der Locales-Ordner befindet sich nicht dort, wohin die Konfiguration zeigt;
die Fehlerzeile nennt den Pfad und die Einstellung), andernfalls `0`. Warnungen führen nicht
zu einem Fehler, es sei denn, Sie übergeben `--strict`, was bei jeder Warnung mit `1` abbricht (eine CI,
die beispielsweise russische Plurale nicht ohne ihre `few`/`many`-Formen ausliefern darf) und
mit einer `[FAIL]`-Zeile endet, niemals mit einer `[OK]`-Zeile; `--warn-only` führt dazu, dass Fehler
ebenfalls mit `0` enden. Ein Locale, dessen Schlüsselanzahl abweicht, meldet dies anstelle von `[OK]`:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

Durchsucht den Quellcode nach hartcodierten, für Benutzer sichtbaren Zeichenketten, die i18n-Übersetzungsaufrufe verwenden sollten. Erkennt Ihr Framework automatisch (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Was erkannt wird:**
- Hartcodierte Zeichenketten in JSX-Text, `placeholder`, `alt`, `aria-label`, `title`
- Dateien mit für Benutzer sichtbaren Inhalten, aber ohne i18n-Framework-Import
- Tote Schlüssel — Locale-Schlüssel, auf die keine Quelldatei verweist
- Abdeckungswert — Prozentsatz der Zeichenketten, die über i18n laufen

**Ausschlüsse**: Erstellen Sie `.champollionignore` im Stammverzeichnis Ihres Projekts (Glob-Muster, wie `.gitignore`).

**Nichts zu linten gilt als Fehler**: Wenn keine Quelldatei übereinstimmt (die Standardordner des Frameworks – `src/`, `app/`, `pages/`, `components/` für Webprojekte – oder Ihr `--src`), bricht lint mit `1` ab und nennt die Ordner sowie Dateiendungen, nach denen gesucht wurde. Ein Linting, das nichts geprüft hat, darf ein CI-Gate nicht passieren; verweisen Sie es mit `--src <dir>` oder `"lint": { "srcDir": "<dir>" }` auf Ihren Code.

---

## wrap

Umschließt automatisch hartcodierte Zeichenketten, die von `lint` erkannt wurden, in `t()`-Aufrufen. Erstellt automatische Backups, bevor Dateien geändert werden.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Sicherheits-Gates:**
1. Git-Clean-Prüfung (im Dry-Run übersprungen)
2. Automatisches Backup nach `.champollion-backup/`
3. Diff-Vorschau vor jedem Dateischreibvorgang
4. Unterstützung für `--undo` zur Wiederherstellung aus dem Backup

---

## seo

Erzeugt SEO-Artefakte für mehrsprachige Websites.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Unterbefehl | Ausgabe |
|------------|--------|
| `hreflang` | `<link rel="alternate" hreflang>`-Tags |
| `sitemap` | Mehrsprachige `sitemap.xml` |
| `jsonld` | JSON-LD-WebSite-Sprachschema |

---

## integrity

Erkennt Beschädigungen und Abweichungen in übersetzten Locale-Dateien.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Was geprüft wird:**
- Beschädigte Platzhalter (z. B. `{name}` in der Quelle vorhanden, im Ziel jedoch fehlend)
- Kodierungsprobleme (Mojibake, ungültiges Unicode)
- Unübersetzte Kopien (Zielwert identisch mit Quellwert) – [`noTranslate`](/docs/getting-started/configuration#no-translate)-Schlüssel sind ausgenommen, ebenso Echos, die das Translation Memory als durch die Pipeline erzeugt und vom Gate genehmigt bestätigt. Was markiert bleibt, ist genau das, was `sync` erneut einreihen würde – die beiden Werkzeuge können bei einer intakten Datei nicht uneins sein
- No-Translate-Drift (ein `noTranslate`-Schlüssel, der *nicht* mit der Quelle identisch ist) – gemeldet mit erwarteten/tatsächlichen Werten und maskierten unsichtbaren Zeichen; führen Sie `champollion sync` zur Reparatur aus
- Unerwartete PUA (Codepunkte der Private Use Area in einem Locale, dessen [Schriftkonvertierung](/docs/getting-started/configuration#script-conversion) deaktiviert ist – wird ohne spezielle Schriftart leer dargestellt); führen Sie `champollion repair-script` zur Reparatur aus
- Ausgehöhlte Werte (ein Zielwert, der aus der Quelle mit gelöschten Buchstaben besteht – Beschädigung durch eine Pipeline, die älter ist als das Content-Preservation-Gate); übersetzen Sie neu mit `sync --force-keys <key>` oder `sync --pair <pair> --force`
- Verwaiste Schlüssel (Schlüssel im Ziel, die in der Quelle nicht existieren)
- Vollständigkeit der ICU MessageFormat-Pluralkategorien (z. B. benötigt Arabisch 6 Kategorien) – nach derselben Regel, die auch `sync` und `verify` anwenden: Eine fehlende Form, die bei gewöhnlichen Zählungen vorkommt (Russisch `few`/`many`), ist eine Warnung; eine Form, die nur bei Zahlen über 1000 oder Bruchzahlen vorkommt (Französisch `many`, verwendet für 1 000 000), ist ein Hinweis, da dort die `other`-Form verwendet wird

---

## repair-script

Macht Schriftkonvertierungen rückgängig, die niemals hätten stattfinden dürfen: PUA-kodierte Werte (pIqaD, Tengwar, Kryptonisch) in Locales, deren Konfiguration besagt, dass die Konvertierung deaktiviert ist, werden über die eigene Umkehrtabelle des Konverters wieder in Lateinschrift (Romanisierung) zurückgeführt.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Option | Auswirkung |
|--------|--------|
| `--dry` | Vorschau der Reparaturen anzeigen, ohne zu schreiben |
| `--locale <code>` | Nur ein einzelnes Locale reparieren |
| `--json` | Maschinenlesbare JSON-Ausgabe |
| `--warn-only` | Exit-Code 0, selbst wenn nicht umkehrbare PUA-Zeichen verbleiben |

pIqaD lässt sich exakt umkehren. Tengwar- und kryptonische Umkehrungen können die Groß-/Kleinschreibung nicht wiederherstellen (als case-lossy markiert). Das Translation Memory benötigt keine Reparatur – es speichert Werte vor der Konvertierung. Endet mit Exit-Code 1, wenn PUA-Zeichen verbleiben, die kein registrierter Konverter umkehren kann.

---

## tm

Verwaltet den Translation-Memory-Cache (`.champollion/tm.json`). TM speichert frühere Übersetzungen und liefert sie bei nachfolgenden Syncs aus, anstatt die API aufzurufen.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Unterbefehl | Ausgabe |
|------------|--------|
| `stats` | Anzahl der Einträge, Dateigröße, Aufschlüsselung pro Locale |
| `clear` | Cache-Datei löschen (vollständig oder pro Locale) |

| Option | Wirkung |
|--------|--------|
| `--locale <code>` | Nur Einträge für eine Locale löschen |
| `--yes` | Bestätigungsabfrage überspringen |

Siehe [Translation Memory](/docs/concepts/translation-memory) für die Funktionsweise von TM und wann es geleert werden sollte.

---

## xliff

Exportiert und importiert XLIFF-1.2-Dateien für die professionelle Übersetzerprüfung. XLIFF ist das universelle Austauschformat, das von CAT-Tools wie memoQ, SDL Trados und Phrase unterstützt wird.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Unterbefehl | Ausgabe |
|------------|--------|
| `export` | `.xliff` aus Quell- und Ziel-Locale-Dateien erzeugen |
| `import` | Geprüfte `.xliff`-Übersetzungen in Locale-Dateien zusammenführen |

| Option | Wirkung |
|--------|--------|
| `--locale <code>` | Ziel-Locale für den Export (erforderlich) |
| `--out <path>` | Benutzerdefinierter Ausgabepfad oder Verzeichnis |
| `--dry` | Import ohne Schreiben in der Vorschau anzeigen |

Siehe [Arbeiten mit professionellen Übersetzern](/docs/guides/professional-translators) für den vollständigen Workflow.

---

## status

Zeigt die Konfiguration der Paare, installierte Plugins und Benchmark-Ergebnisse an.

Ein Paar, dessen Konfiguration `qualityTier` festlegt (`standard`, `high`, `research` oder
`verified`), zeigt dies an, und zwar als das, was es ist: eine von Ihnen gewählte Bezeichnung, keine
Messung – sync übersetzt unabhängig von dieser Angabe identisch, und `serve`
macht dies öffentlich bekannt. Ein Paar, das keine festlegt, zeigt keine an (`--json` besitzt weiterhin
`qualityTier`, mit `qualityTierSet: false`).

```bash
champollion status
```

Nach einem Modellwechsel wird zudem angegeben, wenn die Dateien eines Locales Text von mehr
als einem Modell mischen (aus dem Translation Memory: welches Modell jeden Wert
auf der Festplatte erzeugt hat), zusammen mit dem Befehl, der das aktuelle Modell veranlasst, diejenigen zu übersetzen, die ein
früheres Modell geschrieben hat – `sync --pair <pair> --redo all --fresh-on-model-change`.
Für eine Methode, die ein von Ihnen gewähltes Modell ausführt (`local`, `api`, `external`), wiederholt
es den Lizenzhinweis, den der erste Sync einmalig ausgegeben hat. Für eine OpenAI-kompatible
Methode (`local`, `openai`) zeigt es die Adresse an, an die Anfragen gesendet werden, sowie die Einstellung,
durch die sie ausgewählt wurde: `LOCAL_API_BASE` in der Umgebung oder in `.env`, oder den Standardwert
(Ollama, `http://localhost:11434/v1`). Mit einem `contentDir` listet es den Content-Ordner
neben den Key-Value-Dateien auf, zusammen mit der Anzahl der enthaltenen Quellseiten und,
pro Sprache, wie viele Übersetzungen aktuell, veraltet oder ausstehend (pending) sind.
Ausstehend bedeutet: noch keine Übersetzung vorhanden oder vom Quality Gate abgelehnte Teile, die in der Quellsprache belassen wurden (der Content-Lock meldet `pending:<hash>`).
Unter jedem Register wird angezeigt, welche Geschlechterhinweise LLM-Prompts enthalten und woher
diese stammen (Champollions Standard für die Sprache, Ihre Konfiguration oder deaktiviert –
siehe [Gender guidance](/docs/getting-started/configuration#gender-guidance)).
Für ein Paar mit einem Fallback zählt es, wie viele Werte in den Dateien durch das Fallback
geschrieben wurden, und nennt die ersten davon.
`--json` enthält dasselbe wie `requestsGoTo` (bei einem Paar oder Fallback mit einem solchen Endpunkt), `content`, `genderGuidance` und `fallback.valuesInFiles`.

---

## provenance

Prüft die Lizenzierung von Übersetzungsressourcen für alle installierten Plugins.

```bash
champollion provenance
```

---

## plugin

Verwaltet Übersetzungsmethoden-Plugins. Plugins sind vorgefertigte Übersetzungsrezepte, die in `.champollion/methods/` installiert werden.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

Siehe [Plugin-Spezifikation](/docs/reference/plugin-spec) für das Format des Plugin-Manifests.

---

## leaderboard

`champollion network leaderboard` (funktioniert auch als `champollion leaderboard`). Übersetzungsmethoden aus der Netzwerk-Bestenliste durchsuchen, finden und installieren. Über die Bestenliste installierte Methoden enthalten Benchmark-Ergebnisse und die vollständige kanonische MethodConfig – die exakte Konfiguration, die bei der Evaluierung verwendet wurde.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| Option | Auswirkung |
|--------|--------|
| `--pair <pair>` | Nach Sprachpaar filtern, wie die Bestenliste es schreibt: `"eng>fra"` (ISO 639-3; setzen Sie das `>` in Anführungszeichen). `eng-fra` und `eng:fra` funktionieren ebenfalls, und ein zweistelliger Code wird aufgelöst (`en` → `eng`) |
| `--install <rank>` | Die Methode auf diesem Rang (wie aufgelistet) als Plugin installieren |
| `--apply` | Nach der Installation `methodPlugin` automatisch zu `champollion.config.json` hinzufügen |

**`--apply`-Workflow:** Wenn Sie mit `--apply` installieren, schreibt champollion das Methoden-Plugin nach `.champollion/methods/` **und** patcht Ihre `champollion.config.json`, um es für das entsprechende Paar zu verwenden. Dies ist der schnellste Weg von „Was schneidet am besten ab?“ zu „Ich verwende es in der Produktion.“

---

## fonts

Lädt und verwaltet PUA-Web-Schriftarten für Skript-Konverter konstruierter Sprachen. Sprachen, die Private-Use-Area-Zeichen verwenden (Klingonisch, Sindarin, Kryptonisch), benötigen benutzerdefinierte Web-Schriftarten, um ihre Skripte darzustellen. Dieser Befehl lädt sie aus verifizierten Open-Source-Repositorys herunter.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Unterbefehl | Ausgabe |
|------------|--------|
| `list` | Zeigt, welche PUA-Schriftarten benötigt werden und ihren Installationsstatus |
| `install` | Lädt Schriftarten für konfigurierte Sprachen herunter |

| Option | Wirkung |
|--------|--------|
| `--dir <path>` | Schriftart-Ausgabeverzeichnis überschreiben (automatisch aus dem Projekttyp erkannt) |
| `--css` | Ein `conlang-fonts.css`-Snippet zusammen mit den Schriftarten erzeugen |
| `--config <path>` | Pfad zur Konfigurationsdatei (verwendet, um zu erkennen, welche Sprachen Schriftarten benötigen) |

**Automatische Erkennung:** Das Ausgabeverzeichnis wird aus Ihrer Projektstruktur abgeleitet:
- **Docusaurus** → `static/fonts/` oder `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Standard** → `public/fonts/`

**Native Unicode-Konverter** (`crk` → Cree-Silbenschrift, `sr` → serbisches Kyrillisch) erfordern KEINE Schriftart-Installation.

Siehe [Conlangs, Skripte & Orthographie](/docs/guides/conlangs-scripts-orthography) für vollständige Details zu PUA-Schriftarten.

## Dreischichtige Pipeline

Verwenden Sie `lint`, `sync` und `audit` zusammen für ein kugelsicheres i18n:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Schicht | Befehl | Wann | Zweck |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-Commit | Commits mit hartcodierten Zeichenketten blockieren |
| **Sync** | `sync` | Post-Commit / CI | Fehlende und geänderte Schlüssel übersetzen |
| **Verify** | `verify` | Post-Sync / CI | Bestätigen, dass Übersetzungen vorhanden und korrekt sind |
| **Audit** | `audit` | Build-Schritt | Deployment fehlschlagen lassen, wenn eine Locale `[EN]`-Markierungen aufweist |

---

## Siehe auch

- [Konfiguration](/docs/getting-started/configuration) — Referenz zur Konfigurationsdatei
- [Übersetzungsmethoden](/docs/guides/translation-methods) — Methodenauswahl pro Paar
- [Translation Memory](/docs/concepts/translation-memory) — Caching und Kosteneinsparungen
- [Arbeiten mit professionellen Übersetzern](/docs/guides/professional-translators) — XLIFF-Workflow
- [Plugin-Spezifikation](/docs/reference/plugin-spec) — Format des Plugin-Manifests
- [CI/CD-Leitfaden](/docs/guides/ci-cd) — Automatisierung von CLI-Befehlen in Ihrer Pipeline
- [Wie Sync funktioniert](/docs/concepts/how-sync-works) — die Sync-Pipeline verstehen
- [Quality Gate](/docs/concepts/quality-gate) — wie Übersetzungen validiert werden
