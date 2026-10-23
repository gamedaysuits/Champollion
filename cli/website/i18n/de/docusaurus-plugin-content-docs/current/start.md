---
title: "Projekt starten"
slug: /start
description: "Beginnen Sie damit, einen Übersetzer für Ihre Sprache zu erstellen – mit einem KI-Assistenten auf Ihrem Computer oder indem Sie selbst vier Befehle eingeben."
---

# Ein Projekt starten

Es gibt zwei Möglichkeiten zu beginnen. In beiden Fällen laufen die Werkzeuge auf Ihrem eigenen Computer und führen Sie Schritt für Schritt.

## Mit einem KI-Assistenten

Das ist der einfachste Weg. Ihr Assistent übernimmt das Tippen; Sie beantworten die Fragen, die Ihnen gestellt werden.

**Was Sie benötigen:** einen KI-Assistenten, der als Anwendung auf Ihrem Computer läuft – nicht nur als Smartphone-App – und dort Werkzeuge verwenden kann.

### 1. Die Leitplanken zu Ihrem Assistenten hinzufügen

Kopieren Sie die kurze Einstellung unten, fügen Sie sie in Ihren Assistenten ein und sagen Sie:
*„Bitte richte das für mich ein.“* Viele Assistenten können das. Wenn Ihrer es nicht kann, bitten Sie jemanden, der sich mit Computern auskennt, dies einmalig zu tun – die Schritte dazu finden Sie direkt darunter.

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

<details>
<summary>Manuelle Einrichtung</summary>

Assistenten verbinden sich über einen gemeinsamen Standard namens MCP mit Werkzeugen; die Einstellung oben erklärt Ihrem Assistenten, wie er die Leitplanken startet. Ihr Computer benötigt außerdem Node.js 20.11 oder neuer, ein kostenloses Programm.

- **Desktop-App von Claude:** Settings → Developer → Edit Config. Fügen Sie die
  Einstellung zu dieser Datei hinzu, speichern Sie sie und starten Sie die App neu.
- **Claude Code:** Führen Sie dies einmal in einem Terminal aus:
  `claude mcp add champollion -- npx -y champollion-mcp-server`
- **Cursor:** Fügen Sie die Einstellung zur Datei `mcp.json` im Ordner
  `.cursor` Ihres Projekts oder im Ordner `.cursor` in Ihrem Benutzerverzeichnis hinzu.

</details>

### 2. Erklären Sie es mit Ihren eigenen Worten

Etwa so:

> *Wir möchten einen Übersetzer aus dem Englischen in unsere Sprache bauen – nutze champollion.*

### 3. Beantworten Sie die Fragen

Zunächst wird er Ihnen die Richtung noch einmal bestätigen – *„Sie geben Englisch ein, und Ihre Sprache kommt heraus. Ist die Richtung so gewünscht?“* – denn dies zu vertauschen ist ein leichtes Versehen. Danach erstellt er einen Projektordner und bittet um Ihre Dateien.

Von da an fragt er immer dann nach, wenn eine Entscheidung bei Ihnen liegt: wem Ihre Wörter gehören, ob ein Übersetzer aus ihnen lernen darf, ob etwas installiert werden soll. Entscheiden Sie selbst. Wenn Sie es noch nicht wissen, sagen Sie es einfach – die Leitplanken können warten. Und *nicht jetzt* ist immer eine gültige Antwort: Die Leitplanken werden in dieser Sitzung nicht noch einmal danach fragen.

**Eines sollten Sie vorab wissen.** Die meisten Assistenten senden das, was sie lesen, an das Unternehmen, das sie betreibt. Bei Dateien auf diesem Computer teilen die Werkzeuge Ihrem Assistenten nur mit, *wie viele* Sätze Sie haben, niemals die Sätze selbst – doch ein Assistent, der Ihren Computer nutzen kann, kann jede Datei öffnen, auf die auch Sie zugreifen können. Wenn Sie Wörter privat halten möchten, weisen Sie ihn an, dies nicht zu tun, oder nutzen Sie einen Assistenten, der auf Ihrem eigenen Computer läuft. [Ihre Wörter, Ihre Regeln](/docs/your-words-your-rules) erklärt dies näher.

## Auf eigene Faust

Wenn Sie sich beim Eingeben von Befehlen sicher fühlen, sind es nur vier Zeilen. Installieren Sie das Projektwerkzeug (es benötigt Node.js 20.11 oder neuer), starten Sie ein Projekt und fragen Sie, was als Nächstes zu tun ist:

```bash
npm install -g champollion
champollion new family --from English --to qaa --target-name "Our language"
cd family
champollion next
```

`qaa` bedeutet „eine Sprache, die noch keinen Code hat“ – das funktioniert problemlos; die Werkzeuge füllen lediglich Angaben wie Ihr Alphabet nicht automatisch für Sie aus. Der Name in Anführungszeichen ist die Bezeichnung, die Sie verwenden. Wenn Ihre Sprache einen Code oder einen Namen hat, den die Werkzeuge kennen, verwenden Sie stattdessen diesen. Falls ein Name für mehrere Sprachen stehen könnte, fragen Sie Ihre Sprachgemeinschaft, welche gesprochen wird, bevor Sie einen Code wählen; bis zur Klärung funktioniert `qaa`, hat aber keine Sprachkarte, sodass keine Pluralregeln oder Schriften daraus übernommen werden.

Von da an nennt `champollion next` immer den nächsten Schritt und den genauen Befehl dafür. Wenn es an der Zeit ist, einen Übersetzer anzulernen, fragen die Leitplanken nach, bevor sie die Trainingswerkzeuge installieren.

## Ohne Internet arbeiten

Bleiben Sie während der Installation und Ihres ersten Trainings online: Die Trainingswerkzeuge und das leistungsstärkere Übersetzungsmodell (etwa 1,2 GB) werden dabei heruntergeladen. Danach erfolgt die Arbeit auf Ihrem Computer. Um die Abfragen der Werkzeuge selbst zu unterbinden – sie rufen unter Umständen eine öffentliche Informationskarte zur Sprache ab und senden dabei nur den Sprachcode –, tragen Sie Folgendes in Ihrem Terminal und in den Einstellungen Ihres Assistenten ein:

```bash
export CHAMPOLLION_OFFLINE=1
```

Ein KI-Assistent, der auf den Computern eines Unternehmens läuft, benötigt weiterhin eine Internetverbindung. Für vollständig netzunabhängiges Arbeiten nutzen Sie einen Assistenten, der auf Ihrem eigenen Computer läuft.

## Was Sie erwartet

Ihr erster Übersetzer wird wahrscheinlich wie ein Sprachführer sein: treffsicher bei Sätzen wie jenen, anhand derer er gelernt hat, und darüber hinaus noch nicht viel mehr. So beginnt jedes Projekt. [Was es noch nicht kann](/docs/what-it-cant-do-yet) erklärt ungeschminkt, was Sie erwarten können, und [Besser machen](/docs/make-it-better) zeigt, wie er sich weiterentwickelt.

**Nächster Schritt:** [Bringen Sie mit, was Sie haben →](/docs/bring-your-data)

## Weiterführende Informationen

- [Die Leitplanken über MCP steuern](/docs/agents/mcp) – die sechs Werkzeuge, die Schleife und die Einrichtung je Assistent im Detail.
- [Die Leitplanken über die Shell steuern](/docs/agents/shell) – alle Befehle, die die Leitplanken ausführen.
- [Der Betriebsvertrag](/docs/agents/contract) – die Regeln, an die sich Ihr Assistent hält.
- [Wer dies nutzen darf](/docs/getting-started/who-may-use-this) – die Lizenz.
