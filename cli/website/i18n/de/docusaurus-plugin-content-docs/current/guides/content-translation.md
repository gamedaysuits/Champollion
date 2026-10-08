---
sidebar_position: 5
title: "Inhaltsübersetzung"
---

# Inhaltsübersetzung (Markdown)

Champollion übersetzt Markdown- und MDX-Dateien – sowohl die Front-Matter-Felder als auch den Fließtext. Codeblöcke, Shortcodes und andere strukturierte Elemente sind vor einer Übersetzung geschützt.

Die Dateien befinden sich in einem **Inhaltsverzeichnis** (`contentDir`). Das kann jeder beliebige Ordner mit Markdown-Dateien sein: das `content/` einer Hugo-Website oder ein Newsletter-Ordner innerhalb einer Next.js-App. Eine Docusaurus-Website (eine mit einer `docusaurus.config.js`) verhält sich anders: Ihre `docs/` und `blog/` werden ohne `contentDir` in `i18n/<locale>/`-Ordner übersetzt. Siehe [Framework-Integration](/docs/guides/framework-integration).

## Einrichtung

Legen Sie `contentDir` in Ihrer Konfiguration fest oder übergeben Sie `--content-dir` über die Befehlszeile:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

Zu Beginn eines Durchlaufs nennt sync den Ordner und gibt an, wohin die Übersetzungen geschrieben werden:

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

Bei einer Hugo-Website nennt es zudem die gefundenen Anhaltspunkte, beispielsweise `Detected framework: Hugo (hugo.toml)`. Hugo gilt als erkannt, wenn eine `hugo.toml`/`.yaml`/`.yml`/`.json`-Datei, Hugos `config/_default/`-Ordner, eine `config.toml` oder `config.yaml` mit einer Hugo-spezifischen Einstellung wie `baseURL`, ein `archetypes/`-Ordner oder ein `layouts/`-Ordner mit Hugo-Templates vorhanden ist. Ob Hugo oder nicht: Die Dateien werden auf dieselbe Weise übersetzt und benannt.

## Speicherort der Übersetzungen

Jede Übersetzung wird **neben ihrer Quelldatei** abgelegt, wobei das Ziel-Gebietsschema vor der Dateiendung ergänzt wird. Dies entspricht Hugos Konvention der Übersetzung anhand des Dateinamens:

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

Unterordner werden ebenfalls durchsucht, und jede Übersetzung verbleibt im Ordner ihrer Quelldatei. Ihre Anwendung wählt die Datei für ein Gebietsschema anhand dieses Namens aus. Eine Next.js-Seite liest beispielsweise `newsletters/2026-10.crk.md` für Plains Cree.

**Welche Dateien als Quelldateien zählen.** Jede `.md`- und `.mdx`-Datei im Ordner ist eine Quelldatei, es sei denn, ihr Name endet auf `.<code>.md` (oder `.mdx`) und `<code>` sieht wie ein Sprachcode aus. Ein Sprachcode besteht hierbei aus zwei oder drei Kleinbuchstaben, optional gefolgt von einem Schriftsystem wie `-Hant` und/oder einer Region wie `-BR` oder `-419`. Diese Dateien werden als Übersetzungen angesehen und übersprungen. Ein Suffix der Ausgangssprache (`launch.en.md`) zählt weiterhin als Quelldatei. Ein Fallstrick: Eine Quelldatei mit dem Namen `guide.faq.md` endet ebenfalls auf ein Suffix aus zwei bis drei Buchstaben; sie wird daher fälschlicherweise für eine Übersetzung nach „faq“ gehalten und nicht übersetzt. Benennen Sie sie um, beispielsweise in `guide-faq.md`.

## Was übersetzt wird

### Front Matter

Sowohl YAML- (`---`) als auch TOML-Trennzeichen (`+++`) werden unterstützt. Standardmäßig werden diese Felder übersetzt:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

Alle anderen Felder (`date`, `draft`, `tags`, `weight`, `slug` usw.) werden unverändert aus der Quelle übernommen. Sie können diese Liste mit `translatableFields` in Ihrer Konfiguration anpassen.

### Textinhalt

Standardmäßig wird der Fließtext in Absätze und andere Blöcke der obersten Ebene unterteilt, und jeder Block wird einzeln übersetzt. Strukturierte Elemente werden vor der Übersetzung durch Platzhalter geschützt und danach wiederhergestellt. Mit `contentSegmentation: "page"` wird der Fließtext als Ganzes übersetzt.

## Blockschutz

Diese Elemente werden unverändert durch die Übersetzung geleitet:

| Element | Beispiel | Schutz |
|---------|---------|-----------|
| Code-Blöcke | ``````` ```js ... ``` ``````` | Vollständiger Block abgeschirmt |
| Inline-Code | `` `variable` `` | Abgeschirmt |
| Hugo-Shortcodes | `{{< figure >}}`, `{{% note %}}` | Vollständiger Block abgeschirmt |
| Rohes HTML | `<div>`, `<table>` | Abgeschirmt |
| Links (URLs) | `[text](https://...)` | URL beibehalten, Text übersetzt |
| Interpolation | `{{ .Count }}` | Abgeschirmt |

## Wann eine Datei erneut übersetzt wird

Sync speichert einen Fingerabdruck (SHA-256) jeder Quelldatei in `.champollion-content.lock`. Committen Sie diese Datei zusammen mit Ihren Übersetzungen.

- **Quelle unverändert:** Die Übersetzung wird nicht angetastet.
- **Quelle geändert:** Die Datei wird aktualisiert. Absätze, deren englischer Text unverändert ist, stammen ohne zusätzliche Kosten aus dem [Translation Memory](/docs/concepts/translation-memory), sodass Sie nur für die geänderten Absätze zahlen.
- **Eine Übersetzungsdatei ohne Lock-Eintrag** (eine von Hand verfasste Datei) wird unverändert beibehalten und als Ihre eigene erfasst. Die Ausnahme bildet eine Datei, die noch `[EN] `-Markierungen enthält, welche von einer CLI-Version vor 0.5.0 geschrieben wurden; diese wird erneut übersetzt.
- **Ein Block, der vom Quality-Gate abgelehnt wurde – auch nach erneuter Anfrage unter Angabe des Grundes –** behält seinen Quelltext bei, ohne Markierung auf der Seite. Der Lock-Eintrag der Seite lautet `pending:<hash>`, und die Ablehnung wird in `.champollion-content.lock` protokolliert. Spätere Synchronisierungen senden diesen Block nicht erneut an dasselbe Modell, sodass er nicht noch einmal abgerechnet wird. `status` und `verify` listen die Seite auf. Fragen Sie mit `--redo files:<page>` erneut an, fügen Sie eine `fallback`-Methode hinzu oder schreiben Sie den Absatz selbst (er bleibt erhalten). Ein abgewiesenes Front-Matter-Feld behält seinen Quelltext auf dieselbe Weise, und der Rest der Seite wird geschrieben. Siehe [Abgelehnte Markdown-Blöcke und Front-Matter-Felder](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields).

Um eine Datei gezielt erneut zu übersetzen, geben Sie diese namentlich an. Der Pfad entspricht der Ausgabe von sync, relativ zum Inhaltsverzeichnis:

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## Überprüfen und Bearbeiten von Übersetzungen {#reviewing-and-editing-translations}

Ein Reviewer kann übersetztes Markdown direkt in der übersetzten Datei korrigieren. Champollion behält diese Korrekturen bei, wenn sich die Quelle später ändert.

1. Führen Sie `champollion sync` aus und committen Sie die Übersetzungen zusammen mit `.champollion-content.lock`.
2. Der Reviewer öffnet die übersetzte Datei, beispielsweise `newsletters/2026-10.crk.md`, und bearbeitet sie. Dabei kann jeder Absatz oder ein übersetztes Front-Matter-Feld wie `title` oder `description` geändert werden.
3. Der Reviewer committet die Datei. Es ist kein Befehl erforderlich, um die Änderungen zu „akzeptieren“.

Was mit den Änderungen beim nächsten `champollion sync` geschieht:

| Situation | Was sync tut |
|---|---|
| Die Quelle hat sich nicht geändert | Nichts. Die Übersetzung bleibt exakt so erhalten, wie der Reviewer sie hinterlassen hat. |
| Die Quelle hat sich in **anderen** Absätzen geändert | Die Absätze und Felder des Reviewers werden **Wort für Wort beibehalten** und die geänderten Absätze werden übersetzt. Der Durchlauf weist darauf hin, beispielsweise mit `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`. Der Text des Reviewers bleibt bei jeder späteren Synchronisierung erhalten. |
| Der vom Reviewer bearbeitete Quellabsatz hat sich **ebenfalls** geändert | Dieser Absatz wird erneut übersetzt, da die Version des Reviewers ein Englisch übersetzt, das nicht mehr existiert. Der Durchlauf gibt eine Warnung mit dem Wortlaut des Reviewers aus, damit dieser erneut angewendet werden kann, falls er noch passt. |
| Der Reviewer hat Absätze hinzugefügt, entfernt oder zusammengeführt, oder das Paar verwendet `contentSegmentation: "page"` | Die Änderungen können nicht Absatz für Absatz zugeordnet werden. Wenn sich die Quelle ändert, wird die Datei **genau so belassen, wie sie ist**, und jede Synchronisierung warnt und listet sie auf, bis das Problem behoben ist. Bringen Sie sie entweder manuell auf den neuesten Stand (die nächste Synchronisierung übernimmt die bearbeitete Datei dann als aktuell) oder ersetzen Sie sie mithilfe von `--redo files:<path>` durch eine maschinelle Übersetzung. |

Bearbeitungen an Codeblöcken, Leerraum zwischen Absätzen und Front-Matter-Feldern, die nicht übersetzt werden (`date`, `tags` usw.), bleiben beim Neuschreiben der Datei nicht erhalten. Diese Bestandteile stammen immer aus der Quelle.

**Gezieltes Überschreiben der Bearbeitungen.** Bearbeitungen werden nur ersetzt, wenn Sie die Datei namentlich angeben. `--redo files:2026-10.md` stellt die zwischengespeicherte maschinelle Übersetzung wieder her. `--redo files:2026-10.md --fresh` (oder `--retranslate 2026-10.md`) übersetzt sie von Grund auf neu. Ein Durchlauf, der alle Inhalte neu verarbeitet, ohne Dateien explizit zu benennen (`--redo content`, `--force-content`), behält die Bearbeitungen bei.

**Wie Bearbeitungen erkannt werden.** Jedes Mal, wenn sync eine Übersetzung schreibt, speichert es in `.champollion-content.lock` auch einen kurzen Fingerabdruck jedes geschriebenen Absatzes. Ein Absatz auf dem Datenträger, der nicht mehr übereinstimmt, wurde von einem Menschen geändert. Geht die Lock-Datei verloren, können Bearbeitungen nicht erkannt werden; bewahren Sie sie daher in der Versionsverwaltung auf. Eine von einer älteren Champollion-Version erstellte Übersetzung wird bei der nächsten Synchronisierung erfasst. Wenn sich Ihre Bearbeitungen daran von dem unterscheiden, was im Translation Memory gespeichert ist, werden sie als Ihre eigenen erkannt.

Der Text des Reviewers wird im Translation Memory niemals als maschinelle Ausgabe gespeichert.

:::note[XLIFF deckt nur String-Dateien ab]
`champollion xliff export` übergibt die **String-Dateien** (Schlüssel und Werte) Ihrer Anwendung an das CAT-Tool eines Übersetzers. Siehe [Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators). Für Markdown-Inhalte gibt es noch keinen XLIFF-Export, daher wird übersetztes Markdown direkt in den Dateien selbst überprüft, wie oben beschrieben.
:::

## Methoden nur für Markdown

:::warning[Google Translate und Markdown]
Google Translate **berücksichtigt weder** Codeblöcke, Shortcodes noch Interpolationsvariablen. Dadurch wird strukturierter Markdown-Inhalt beschädigt. Verwenden Sie für die Inhaltsübersetzung LLM-Methoden (`llm` oder `llm-coached`), da diese strukturierte Elemente explizit abschirmen.
:::

Wenn die Inhaltsübersetzung von Google Translate auf eine LLM-Methode zurückfällt, protokolliert champollion eine Warnung mit einer Erklärung der Ursache.
