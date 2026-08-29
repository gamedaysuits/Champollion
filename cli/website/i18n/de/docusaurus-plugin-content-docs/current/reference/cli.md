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
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

Führen Sie `champollion <command> --help` aus, um ausführliche Hilfe zu einem beliebigen Befehl zu erhalten.

## Globale Optionen

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

Interaktiver Einrichtungsassistent, der `champollion.config.json` erstellt. Führt Sie durch die Quell-Locale, Zielsprachen, das Dateiformat und das Übersetzungsmodell.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**Option `--langs`**: Kommagetrennte Liste von Zielsprachcodes. Überspringt die Sprachabfrage und wendet die Standard-Register-Voreinstellungen für jede Sprache an. Kombinieren Sie sie mit `--yes` für eine vollständig nicht-interaktive Einrichtung.

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
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: Standardmäßig lädt `sync` `.champollion/tm.json` und liefert zwischengespeicherte Übersetzungen für unveränderte Quellwerte. Verwenden Sie `--no-tm`, um den Cache zu umgehen (nützlich beim Wechsel von Übersetzungsanbietern oder beim Debugging der Qualität). Siehe [Translation Memory](/docs/concepts/translation-memory).

**Änderungserkennung**: champollion speichert SHA-256-Hashes in `.champollion.lock`. Wenn sich Quellwerte ändern, übersetzt der nächste Sync diese Schlüssel automatisch neu. Committen Sie die Lock-Datei, damit alle Entwickler dieselbe Baseline teilen.

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

Fortschrittsbalken werden nach jedem Batch (~80 Schlüssel) an Ort und Stelle aktualisiert. Verwenden Sie `--quiet` nur für Fehler/Warnungen oder `--json` für maschinenlesbare NDJSON-Ausgabe. Beide unterdrücken den Fortschrittsbalken und das Banner.

---

## watch

Automatische Synchronisierung, wenn sich die Quell-Locale-Datei ändert. Läuft, bis der Vorgang mit `Ctrl+C` unterbrochen wird.

```bash
champollion watch
```

---

## audit

Listet alle nicht übersetzten Fallback-Werte mit dem Präfix `[EN]` aus früheren Durchläufen auf. Beendet sich mit Code 1, falls welche gefunden werden — verwenden Sie dies als CI-Gate, um Builds mit unvollständigen Übersetzungen fehlschlagen zu lassen.

```bash
champollion audit
```

---

## verify

Liest alle Locale-Dateien erneut von der Festplatte und überprüft, ob die Übersetzungen tatsächlich vorhanden und korrekt sind. Dies ist dieselbe Verifizierung, die am Ende jedes `sync` automatisch ausgeführt wird (sofern nicht `--no-verify` übergeben wird).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**Was geprüft wird:**
- Schlüssel-Parität — alle Quellschlüssel in jedem Ziel vorhanden
- `[EN]`-Fallback-Markierungen aus früheren Durchläufen
- Leere Übersetzungen
- Skript-Konformität — nicht-lateinische Locales sollten nicht-ASCII-Übersetzungen aufweisen
- Platzhalter-Erhaltung — ICU-Platzhalter stimmen mit der Quelle überein
- Kodierungsprobleme — BOM-Markierungen, unsichtbare Zeichen
- Quell-Echos — Werte identisch mit der Quelle (Warnung)

---

## lint

Durchsucht den Quellcode nach hartcodierten, für Benutzer sichtbaren Zeichenketten, die i18n-Übersetzungsaufrufe verwenden sollten. Erkennt Ihr Framework automatisch (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found
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

**Was überprüft wird:**
- Beschädigte Platzhalter (z. B. `{name}` in der Quelle vorhanden, aber im Ziel fehlend)
- Kodierungsprobleme (Mojibake, ungültiger Unicode)
- Unübersetzte Kopien (Zielwert ist identisch mit der Quelle) — [`noTranslate`](/docs/getting-started/configuration#no-translate)-Schlüssel sind ausgenommen, ebenso wie Echos, die das Translation Memory als von der Pipeline erzeugt und vom Gate genehmigt bestätigt. Was markiert bleibt, ist genau das, was `sync` erneut in die Warteschlange stellen würde — die beiden Werkzeuge können bei einer fehlerfreien Datei nicht unterschiedlicher Meinung sein
- No-Translate-Abweichung (ein `noTranslate`-Schlüssel, der *nicht* mit der Quelle identisch ist) — wird mit erwarteten/tatsächlichen Werten und maskierten unsichtbaren Zeichen gemeldet; führen Sie `champollion sync` zur Reparatur aus
- Unerwartete PUA (Private Use Area-Codepoints in einem Gebietsschema, dessen [Skriptkonvertierung](/docs/getting-started/configuration#script-conversion) deaktiviert ist — wird ohne spezielle Schriftart leer angezeigt); führen Sie `champollion repair-script` zur Reparatur aus
- Ausgehöhlte Werte (ein Ziel, das seiner Quelle entspricht, bei dem jedoch die Buchstaben gelöscht wurden — ein Schaden durch eine Pipeline, die älter ist als das Content-Preservation-Gate); übersetzen Sie neu mit `sync --force-keys <key>` oder `sync --pair <pair> --force`
- Verwaiste Schlüssel (Schlüssel im Ziel, die in der Quelle nicht existieren)
- Vollständigkeit der Plural-Kategorien im ICU MessageFormat (z. B. benötigt Arabisch 6 Kategorien)

---

## repair-script

Macht Skriptkonvertierungen rückgängig, die niemals hätten stattfinden dürfen: PUA-kodierte Werte (pIqaD, Tengwar, Kryptonisch) in Gebietsschemata, deren Konfiguration besagt, dass die Konvertierung deaktiviert ist, werden über die eigene Umkehrtabelle des Konverters wieder in die Romanisierung überführt.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Option | Auswirkung |
|--------|--------|
| `--dry` | Vorschau der Reparaturen ohne Schreibvorgang |
| `--locale <code>` | Nur ein Gebietsschema reparieren |
| `--json` | Maschinenlesbare JSON-Ausgabe |
| `--warn-only` | Exit-Code 0, auch wenn nicht umkehrbare PUA verbleiben |

pIqaD lässt sich exakt umkehren. Bei Tengwar- und kryptonischen Umkehrungen kann die Groß-/Kleinschreibung nicht wiederhergestellt werden (als verlustbehaftet bei der Groß-/Kleinschreibung markiert). Das Translation Memory benötigt keine Reparatur — es speichert die Werte vor der Konvertierung. Gibt Exit-Code 1 zurück, wenn PUA verbleiben, die kein registrierter Konverter umkehren kann.

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

Zeigt die Paar-Konfiguration, installierte Plugins, Qualitätsstufen und Benchmark-Werte an.

```bash
champollion status
```

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
champollion plugin remove crk-coached-v1     # remove a plugin
```

Siehe [Plugin-Spezifikation](/docs/reference/plugin-spec) für das Format des Plugin-Manifests.

---

## leaderboard

Durchsuchen, suchen und installieren Sie Übersetzungsmethoden aus dem Network-Leaderboard. Vom Leaderboard installierte Methoden werden mit Benchmark-Werten und der vollständigen kanonischen MethodConfig geliefert — der genauen Konfiguration, die während der Evaluierung verwendet wurde.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| Option | Wirkung |
|--------|--------|
| `--pair <code>` | Leaderboard nach Sprachpaar filtern (z. B. `en:fr`) |
| `--install <name>` | Ein Methoden-Plugin aus dem Leaderboard installieren |
| `--apply` | Nach der Installation automatisch `methodPlugin` zu `champollion.config.json` hinzufügen |

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
