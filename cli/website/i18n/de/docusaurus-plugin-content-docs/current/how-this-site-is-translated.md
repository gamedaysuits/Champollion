---
id: how-this-site-is-translated
title: "Wie diese Website übersetzt wird"
description: "Jedes Locale auf dieser Website wird von Champollion selbst maschinell übersetzt – derselben CLI, die in dieser Dokumentation beschrieben wird. Wir nutzen unser eigenes Tool selbst."
---

# Wie diese Website übersetzt wird

Diese Website ist in 13 Sprachen verfügbar. Jedes Gebietsschema (Locale) außer Englisch wird
**von Champollion selbst maschinell übersetzt** – derselben CLI, die diese Dokumentation
beschreibt (`npx champollion sync`). Wir setzen unser eigenes Tool ein.

Derzeit verwendet jedes Sprachpaar ein einziges Modell:
**`google/gemini-3.1-pro-preview`**, das mit den unten beschriebenen sprachspezifischen
Vorgaben für Register und Terminologie übersetzt. Wir haben uns
bewusst für ein Modell als ehrlichen Standard entschieden, während wir unsere auf Benchmarks basierende
Modellauswahl neu aufbauen (siehe unten) – es handelt sich also um eine einfache, dokumentierte Entscheidung und nicht um ein
Ergebnis, das wir als etwas ausgeben, das es nicht ist.

Zwei Dinge, die Sie als Leser wissen sollten:

1. **Diese Seiten sind maschinelle Übersetzungen.** Sie werden mit den
   unten beschriebenen Vorgaben für Register und Terminologie erstellt, aber kein Mensch hat
   jeden Satz überprüft. Wenn sich etwas falsch liest, ist die englische Version
   maßgeblich – und wir würden uns über eine Korrektur freuen.
2. **Das Modell ist heute ein Standard, morgen wird es per Benchmark ausgewählt.**
   Das Design von Champollion sieht vor, das Übersetzungsmodell *für jedes Sprachpaar*
   anhand eines Benchmarks auszuwählen – jedes Kandidatenmodell wird auf einem Entwicklungskorpus bewertet und
   dieses Gebietsschema wird mit der Methode übersetzt, die die höchste Punktzahl erzielt (bei statistischem Gleichstand
   entscheiden die Kosten). Wir führen diese Auswahl erneut durch unsere eigene
   Integritätsprüfung, bevor wir hier die Gewinner pro Sprachpaar festlegen. **Bis diese Durchläufe
   auf der [Network-Bestenliste](/leaderboard) veröffentlicht sind, wird diese Seite
   keine durch Benchmarks belegte Herkunft beanspruchen, die sie Ihnen nicht zeigen kann.**

## Herkunft nach Gebietsschema

| Gebietsschema | Sprache | Methode | Modell | Register | Zuletzt synchronisiert |
|--------|----------|--------|-------|----------|-------------|
| fr | Français | llm | `google/gemini-3.1-pro-preview` | formelles *vous* | 2026-07-18 |
| de | Deutsch | llm | `google/gemini-3.1-pro-preview` | Sie-Form | 2026-07-18 |
| nl | Nederlands | llm | `google/gemini-3.1-pro-preview` | u-vorm | 2026-07-18 |
| fil | Filipino | llm | `google/gemini-3.1-pro-preview` | formell | 2026-07-18 |
| es | Español | llm | `google/gemini-3.1-pro-preview` | neutrales Lateinamerikanisch | 2026-07-18 |
| zh | 简体中文 | llm | `google/gemini-3.1-pro-preview` | professionell technisch | 2026-07-18 |
| ja | 日本語 | llm | `google/gemini-3.1-pro-preview` | です/ます (höflich) | 2026-07-18 |
| ko | 한국어 | llm | `google/gemini-3.1-pro-preview` | 해요체 (höflich) | 2026-07-18 |
| pt | Português | llm | `google/gemini-3.1-pro-preview` | professionell | 2026-07-18 |
| th | ไทย | llm | `google/gemini-3.1-pro-preview` | neutral professionell | 2026-07-18 |
| vi | Tiếng Việt | llm | `google/gemini-3.1-pro-preview` | neutrale *bạn*-Form | 2026-07-18 |
| ar | العربية | llm | `google/gemini-3.1-pro-preview` | MSA, professionell | 2026-07-18 |

## Die Benchmark-Auswahl, die wir neu aufbauen

Die vorgesehene Methode – und wie die Konfiguration strukturiert ist – ist
eine Modellauswahl pro Sprachpaar, die durch unsere eigene Evaluierung gesteuert wird: Jedes
Kandidatenmodell wird auf dem Entwicklungskorpus des Paares bewertet, die höchste
Gesamtpunktzahl wird herangezogen und statistische Gleichstände werden durch die Kosten aufgelöst. Der vollständige Ablauf ist
für jeden dokumentiert, der ihn reproduzieren möchte.

Wir veröffentlichen heute auf dieser Seite **keine** Gesamtpunktzahlen oder einen „Benchmark-Gewinner“ pro
Sprache, da der Auswahldurchlauf, der diese Zahlen belegen würde, zunächst
erneut durch die Integritätsprüfung der Testumgebung läuft.
Sobald dies abgeschlossen ist, werden die Durchläufe auf der öffentlichen Bestenliste stehen, diese Tabelle wird
das Gewinner-Modell jedes Paares mit dem zitierten Durchlauf enthalten, und die Website-Konfiguration
wird die Gewinner pro Paar neu festlegen. Bis dahin: ein ehrlicher Standard.

Die *Gesamtpunktzahl* (Composite Score) ist die gemischte Qualitätsmetrik des Netzwerks (chrF++, exakte
Übereinstimmung und geladene Metrik-Plugins, Bootstrap-CI-verifiziert). Die Punktzahlen sind nur
**innerhalb eines Sprachpaares** vergleichbar, niemals zwischen verschiedenen Paaren – Unterschiede in Schrift und
Korpus machen einen Vergleich zwischen Paaren bedeutungslos.

## Register und Tonfall

Jede Sprache wird mit einem expliziten Register übersetzt, das aus
den Sprachkarten von Champollion ausgewählt wird, sodass die Formalität auf der gesamten Website konsistent ist:

- **Français** — vouvoiement (formelles *vous*)
- **Deutsch** — Sie-Form
- **Nederlands** — u-vorm
- **Filipino** — formell, mit technischen Standardbegriffen
- **Español** — neutrales lateinamerikanisches Spanisch
- **简体中文** — professionelles technisches Register
- **日本語** — です/ます (höfliche Form)
- **한국어** — 해요체 (höflich)
- **Português** — professionelles Register
- **ไทย** — neutral professionell
- **Tiếng Việt** — neutrale *bạn*-Form
- **العربية** — Modernes Hocharabisch (MSA), professionelles Register

## Was nicht maschinell übersetzt wird

Codeblöcke, CLI-Befehle, Konfigurationsschlüssel, Paketnamen, URLs und
Eigennamen werden während der Übersetzung geschützt und bleiben absichtlich
auf Englisch.

## Einen Übersetzungsfehler gefunden?

Eröffnen Sie ein Issue oder einen PR – die Quelle jeder übersetzten Seite ist das englische
Original. Korrekturen an einer übersetzten Seite bleiben bei zukünftigen Synchronisierungen erhalten, solange
die englische Quelle dieser Seite unverändert bleibt (die Synchronisierung übersetzt eine
Seite nur dann neu, wenn sich ihre englische Quelle ändert).

*Diese Seite ist selbst nach der oben beschriebenen Methode maschinell übersetzt – sie
beschreibt ihre eigene Übersetzung.*
