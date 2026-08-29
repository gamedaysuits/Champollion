---
sidebar_position: 4
title: "Cookbook: Dictionary-Augmented LLM"
---

# Wörterbuch-erweitertes LLM

> **Die Idee:** Erzwingen Sie bekannte, verifizierte Übersetzungen für bestimmte Begriffe aus einem zweisprachigen Wörterbuch und überlassen Sie dem LLM die Satzstruktur sowie unbekanntes Vokabular. Das Wörterbuch liefert die Anker der Korrektheit; das LLM sorgt für die Flüssigkeit.

:::info[Dies ist ein Kochbuch, keine fertige Implementierung]
Diese Anleitung skizziert den Ansatz. Die konkrete Strategie für den Wörterbuchabgleich und die Einfügung hängt von Ihrem Sprachpaar und den verfügbaren lexikalischen Ressourcen ab.
:::

## Wann Sie dies verwenden sollten

- Ein **zweisprachiges Wörterbuch existiert** für Ihr Sprachpaar (auch ein kleines)
- Das LLM **halluziniert durchgängig Schlüsselbegriffe** — es erfindet Wörter, die nicht existieren
- Sie benötigen **terminologische Konsistenz** über Übersetzungen hinweg (dasselbe Wort wird überall gleich übersetzt)
- Sie übersetzen **domänenspezifische Inhalte**, bei denen Standard-LLM-Übersetzungen falsch sind (Recht, Medizin, Bildung)

## Wie es funktioniert

1. **Laden Sie ein zweisprachiges Wörterbuch** — Schlüssel-Wert-Paare, die Quellbegriffe auf verifizierte Zielübersetzungen abbilden
2. **Gleichen Sie den Quelltext mit dem Wörterbuch ab** — identifizieren Sie Begriffe in der Eingabe, für die bekannte Übersetzungen vorliegen
3. **Fügen Sie die Treffer in den Prompt ein** — teilen Sie dem LLM mit, dass „diese Begriffe wie folgt übersetzt werden MÜSSEN“
4. **Das LLM generiert die Übersetzung** — mit den Wörterbuch-Vorgaben als harte Anforderungen
5. **Nachbearbeitung** — überprüfen Sie, ob die Wörterbuchbegriffe in der Ausgabe erscheinen; wiederholen Sie den Vorgang, falls nicht

## Wörterbuchformat

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## Prompt-Struktur

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## Zentrale Designentscheidungen

**Abgleichstrategie:** Der exakte Abgleich ist am einfachsten. Ein lemmatisierter Abgleich („teachers“ passt zu „teacher“) erfasst mehr, erfordert jedoch einen Lemmatisierer für die Quellsprache. Ein unscharfer Abgleich birgt das Risiko falsch-positiver Ergebnisse.

**Behandlung von Flexion:** In polysynthetischen Sprachen muss die Wörterbuchform möglicherweise flektiert werden, um in den Satz zu passen. Sie können den Wortstamm bereitstellen und das LLM flektieren lassen oder mehrere flektierte Formen angeben. Ein [FST](./fst-gated-pipeline) kann das Ergebnis validieren.

**Konfliktlösung:** Was geschieht, wenn das LLM einen Wörterbuchbegriff ignoriert? Möglichkeiten: (a) Wiederholung mit einer stärkeren Anweisung, (b) Nachbearbeitung durch Ersetzung von Zeichenketten, (c) Akzeptieren und zur Überprüfung markieren.

## Vor- und Nachteile

| | |
|---|---|
| ✅ Beseitigt Halluzinationen für bekannte Begriffe | ❌ Die Abdeckung des Wörterbuchs ist immer unvollständig |
| ✅ Garantiert Konsistenz für Schlüsselvokabular | ❌ Flexion/Konjugation passt möglicherweise nicht zum Satzkontext |
| ✅ Einfach zu prüfen und zu aktualisieren | ❌ Übermäßige Einschränkung kann zu unnatürlichen Ausgaben führen |
| ✅ Das Wörterbuch ist ein wiederverwendbares Gut | ❌ Setzt voraus, dass überhaupt ein Wörterbuch existiert |

## Wo Sie Wörterbücher finden

- **[itwêwina](https://itwewina.altlab.app/)** — Plains Cree–Englisch (FST-basiert; die morphodict-Plattform ist Open Source — der Wörterbuchinhalt selbst ist nicht offen lizenziert)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — umfassendes Nachschlagewerk für Plains Cree (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — zweisprachige Wörterbücher für Dutzende von Sprachpaaren
- **[Giellatekno](https://giellalt.github.io/)** — Wörterbücher für samische, uralische und andere Minderheitensprachen
- Von der Community erstellte Glossare, Lehrmaterialien, Terminologielisten

## Lässt sich gut kombinieren mit

- **[Coached LLM Prompting](./coached-llm-prompting)** — Wörterbucheinträge sind eine Form von Coaching-Daten
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — der FST validiert, dass Wörterbuchbegriffe korrekt flektiert sind
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — deterministische Wörterbuchsuche als eine Regelschicht

## Siehe auch

- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) — der vollständige Kontext
- [Method Interface](/docs/network/specifications/methods) — wie Methoden strukturiert sind
