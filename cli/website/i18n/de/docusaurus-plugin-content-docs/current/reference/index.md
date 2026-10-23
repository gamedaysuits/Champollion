---
title: "Referenz"
slug: /reference
description: "Alle technischen Details in einer Übersicht: die Befehle, die Dateiformate, die Spezifikationen, die technischen Grenzen, die Bereitstellung eines versiegelten Tests, die Bestenliste, die Übersetzung von Apps und Websites, der Atlas und die Netzwerkinfrastruktur."
---

# Referenz

Die vollständige technische Dokumentation für Entwickler, Forschende und KI-Agenten.
Die [Seiten für Menschen](/docs/) erzählen dieselbe Geschichte in einfachen Worten, und
[das Agenten-Handbuch](/docs/agents) beschreibt, wie ein Agent sie steuert; jede unten
aufgeführte Seite stellt dies mit voller Präzision dar.

## Befehle

- [`champollion`](/docs/reference/cli) — jeder Befehl und jedes Flag des Projektwerkzeugs
  und des App- und Website-Übersetzers.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — jeder
  Befehl der Modell-Trainingssuite, generiert aus ihrem Parser.
- [`mt-eval`](/docs/reference/mt-eval) — jeder Befehl der Evaluierungs-
  Testumgebung, generiert aus ihrem Parser.
- [Der MCP-Server](/docs/network/getting-started/mcp-server) — beide Profile,
  jedes Werkzeug und jedes Argument.

## Formate

- [Framework-Formate](/docs/reference/formats) — project/1, set/1, method/1,
  gate-chain/1, deployment/1 und service-api/1, aus ihren Schemata.
- [Durchlaufkarte](/docs/network/specifications/run-card) — was ein bewerteter Durchlauf
  aufzeichnet und veröffentlicht.
- [Coaching-Daten](/docs/concepts/coaching-data) — die Grammatiknotizen und Wortlisten,
  die einer LLM-Methode übergeben werden.
- [Plugin-Spezifikation](/docs/reference/plugin-spec) — das Methoden-Plugin-Manifest
  (`method.json`), als das eine Übersetzungsmethode ausgeliefert wird.
- [Sprachkarte](/docs/reference/language-card-spec) — das Schema einer Karte
  im Atlas.

## Spezifikationen

- [Bewertung](/docs/network/specifications/scoring) — Bewertungsstandard/1: das
  Korpus-chrF++-Hauptergebnis mit seinem 95-%-Bootstrap-Intervall, die Standardmetriken
  daneben und die separat gehaltenen Diagnosen.
- [Signifikanz](/docs/network/specifications/significance) — gepaarte Tests
  und wann ein Durchlauf besser ist als ein anderer.
- [Methodenschnittstelle](/docs/network/specifications/methods) — was eine Methode ist,
  ihre Klassen und Abhängigkeiten.
- [Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability) —
  welcher Metrik bei welcher Art von Sprache zu vertrauen ist, basierend auf menschlichen Bewertungen.
- [Benchmark](/docs/network/specifications/benchmark) — das Protokoll, dem jeder
  gültige Durchlauf folgt.
- [Testumgebung](/docs/network/specifications/harness) — wie `mt-eval` Durchläufe ausführt,
  bewertet und veröffentlicht.
- [Sprecher-Validierung](/docs/network/specifications/speaker-validation) — die
  menschliche Prüfung, für die automatische Bewertungen als Stellvertreter dienen.

## Technische Grenzen

- [Technische Grenzen](/docs/network/honest-limitations) — was nicht behauptet wird:
  selbstdeklarierte Vertrauensstufen, noch keine Prüfung durch Sprechende, Verwahrung versiegelter Tests und keine
  Konfidenz auf Satzebene.

## Einen versiegelten Test hosten

- [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest)
  — der durchgängige Leitfaden für einen Testsatz, der das System des Hosts nie verlässt.
- [Souveräner Evaluierungsknoten](/docs/network/sovereignty/sovereign-eval-node) — das
  Bewertungssystem: Hardware, Air-Gap und Schlüsselzeremonie.
- [Korpora registrieren](/docs/network/sovereignty/registering-corpora) —
  Offenlegungsstufen und Lizenzkategorien für einen Korpus, den Sie besitzen.
- [Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer) und
  [Bedingungsvorlagen](/docs/network/sovereignty/terms-templates) — was ein Beitrag
  überträgt, deklariert, bevor jemand teilnimmt.
- [Preise](/docs/network/specifications/prizes) — was ein Preis erfordert, falls ein
  Sponsor einen solchen ausschreibt.

## Bestenliste und Veröffentlichung

- [Bestenliste und Veröffentlichung](/docs/reference/leaderboard) — was die Bestenliste
  ist, die zwei Arten von Benchmarks und was ein veröffentlichter Durchlauf enthält.
- [Einreichungsregeln](/docs/network/leaderboard/rules) — was akzeptiert wird,
  was disqualifiziert wird, und die Verifizierungsstufen.
- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) — die registrierten
  Datensätze und ihre Lizenzkategorien.
- [Eine Methode einreichen](/docs/network/getting-started/submit-a-method) — die
  Testumgebung ausführen und eine Durchlaufkarte veröffentlichen.
- [Rechenleistung beisteuern](/docs/network/getting-started/contributing-compute) —
  Aufgaben aus der öffentlichen Warteschlange mit Ihrem eigenen Schlüssel ausführen.
- [FAQ](/docs/network/getting-started/faq) — Metriken, Modelle, FSTs und
  Disqualifikation.

## App- und Website-Übersetzung

- [App- und Website-Übersetzung](/docs/intro) — was `champollion sync` leistet und
  eine Übersicht zu jeder Seite darüber: Schnellstart, Installation, Konfiguration,
  Frameworks, CI/CD, Methoden, Inhalte, Übersetzungsspeicher, das Qualitätsgate,
  Sicherheit, Skripte, Übersetzer und Fehlerbehebung.

## Der Atlas

- [Der Atlas](/docs/atlas) — was der Sprachindex ist und woher seine Fakten
  stammen.
- [Sprachkarten-Spezifikation](/docs/reference/language-card-spec) und das
  [Zitierverfahren](/docs/reference/language-card-citation-procedure) —
  jedes Feld und wie jedes zitiert wird.
- [Was als Sprache zählt](/docs/network/context/what-counts-as-a-language)
  — die Antworten, die der Index gibt, und warum.
- [Zum Index einreichen](/docs/network/getting-started/submit-to-the-index) und
  [Fehler melden](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — Vorschlagen eines Eintrags oder einer Korrektur.

## Netzwerkinfrastruktur

- [Aufbau der Warteschlange](/docs/network/specifications/queue-construction) und
  [warum die Warteschlange so aufgebaut ist](/docs/network/perspectives/why-the-queue)
  — wie die öffentliche Arbeitswarteschlange priorisiert, was als Nächstes gemessen wird.
- [Verbindungsstärke](/docs/network/specifications/connection-strength) —
  was eine Kante auf der Netzwerkkarte über ein Sprachpaar aussagt und die Stärkeskala,
  die eingestellt wurde.
- [Rechenleistung beisteuern](/docs/network/getting-started/contributing-compute) —
  die Warteschlange abarbeiten.
