---
title: "Eine App oder Website übersetzen"
slug: /translate-an-app-or-website
description: "Übersetzen Sie die Wörter auf den Bildschirmen einer App oder Website in Ihre Sprache, halten Sie sie auf dem neuesten Stand, wenn sich das Original ändert, und wählen Sie aus, welcher Übersetzer welche Sprache übernimmt."
---

# Eine App oder Website übersetzen

Apps und Websites speichern ihre Wörter – Schaltflächen, Menüs, Meldungen, Seiten – in
Dateien, eine pro Sprache. Champollion kann die Datei für Ihre Sprache für
Sie ausfüllen und sie auf dem neuesten Stand halten, wann immer sich das Original ändert. Ein einziger Befehl
genügt:

```bash
npx champollion sync
```

Es findet die Sprachdateien Ihrer App, übersetzt nur das, was fehlt oder
geändert wurde, prüft jede Übersetzung vor dem Schreiben und lässt den Rest
unberührt.

## Welcher Übersetzer die Arbeit übernimmt

Sie wählen für jede Sprache:

- **Ihr eigener Übersetzer**, gebaut auf den Schienen – die Werkzeuge verbinden ihn mit Ihrer
  App. Wenn er anhand privater Sätze gelernt hat, verbindet er sich erst, sobald Sie
  benannt haben, wer von den Personen, die die Wörter hüten, zugestimmt hat.
- **Ein KI-Modell oder ein Übersetzungsdienst** – für Sprachen, die diese bereits
  gut beherrschen. Diese senden die Wörter Ihrer App an das Unternehmen, das sie betreibt;
  nutzen Sie sie daher für Texte, die geteilt werden dürfen.
- **Ihr eigener Dienst**, unter einer von Ihnen angegebenen Adresse.

## Worum es sich kümmert

- **Nur das, was sich geändert hat.** Es merkt sich, was zuvor übersetzt wurde, sodass Sie
  nie zweimal für denselben Satz zahlen.
- **Prüfungen vor dem Schreiben.** Leere Antworten, das zurückkopierte Original, Wörter,
  die sich in einer Endlosschleife wiederholen, Texte, die viel zu lang geraten sind, fehlende Teile oder
  das falsche Alphabet werden abgefangen und abgewiesen. Diese Prüfungen erkennen fehlerhafte
  Ausgaben, keine falschen Bedeutungen – ein Sprecher hat weiterhin das letzte Wort.
- **Ihre Dateien, Ihr Format.** JSON-, YAML-, TOML- und Markdown-Seiten sowie die
  gängigen App- und Website-Frameworks.

## Wer es nutzen darf

Kostenlos für die nichtkommerzielle Nutzung – die App einer Schule, die Website einer
Gemeinschaft, ein öffentlicher Dienst. Das Produkt eines Unternehmens ist von der
kostenlosen Lizenz nicht abgedeckt; wenn eine Sprachgemeinschaft es kommerziell nutzen
möchte: fragen Sie nach, und die Lizenz ist kostenlos.
[Wer dies nutzen darf](/docs/getting-started/who-may-use-this) enthält die Einzelheiten.

**Weiter:** [Einen versiegelten Test bereitstellen →](/docs/host-a-sealed-test)

## Weiterführende Informationen

- [App- und Website-Übersetzung](/docs/intro) – die vollständige Referenz: Schnellstart,
  Konfiguration, Frameworks, Übersetzungsspeicher, die Qualitätsprüfungen, CI.
- [Bereitstellung und Betrieb](/docs/agents/serving) – Ihren eigenen
  Übersetzer anbinden.
