---
sidebar_position: 10
title: "Cookbook: Teilweise Übersetzung (Mensch + Maschine)"
---

# Teilübersetzung (Mensch + Maschine)

> **Die Idee:** Übersetzen Sie eine repräsentative Stichprobe manuell, weisen Sie nach, dass Ihre maschinelle Methode dem menschlichen Stil bei dieser Stichprobe entspricht, und übersetzen Sie anschließend die verbleibende Masse automatisch. Dies verbindet menschliche Qualität mit maschineller Skalierbarkeit — der Mensch setzt den Standard, die Maschine folgt ihm.

:::info[Dies ist ein Kochbuch, keine fertige Implementierung]
Dieser Leitfaden skizziert den hybriden Mensch-Maschine-Arbeitsablauf. Er ist besonders relevant für Übersetzungsagenturen, kommunale Sprachmitarbeiter und Bildungskontexte.
:::

## Wann Sie dies verwenden sollten

- Sie haben **Zugang zu fließend sprechenden Personen**, aber deren Zeit ist begrenzt
- Sie müssen ein **großes Volumen** übersetzen, aber nur ein kleiner Teil muss perfekt sein
- Sie möchten mit menschlicher Übersetzung eine **Qualitätsgrundlage etablieren** und anschließend mit maschineller Übersetzung skalieren
- Sie arbeiten in einem **Bildungs- oder Gemeinschaftskontext**, in dem eine menschliche Überprüfung einer Teilmenge möglich ist

## Funktionsweise

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **Wählen Sie eine repräsentative Stichprobe** — decken Sie verschiedene Satztypen, Längen und Themen ab
2. **Übersetzen Sie die Stichprobe manuell** — etablieren Sie den Goldstandard für Stil, Register und Terminologie
3. **Konfigurieren Sie Ihre maschinelle Methode** — verwenden Sie die menschlichen Übersetzungen als Coaching-Daten, Few-Shot-Beispiele oder Fine-Tuning-Daten
4. **Bewerten Sie die Maschine anhand der menschlichen Stichprobe** — entspricht die Maschine dem Stil des Menschen?
5. **Übersetzen Sie den Rest automatisch** — wenn die maschinelle Qualität bei der Stichprobe akzeptabel ist
6. **Optionale menschliche Überprüfung** — markieren Sie Ausgaben mit geringer Konfidenz zur Überprüfung durch sprechende Personen

## Qualitätssicherung: Der Stilabgleich-Test

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## Auswahl der Stichprobe

**Decken Sie die Verteilung ab.** Ihre 100 Einträge sollten Folgendes umfassen:
- Kurze Phrasen (1–3 Wörter) und vollständige Sätze
- Allgemeines Vokabular und fachspezifische Begriffe
- Einfache und komplexe Strukturen
- Verschiedene grammatikalische Merkmale (Fragen, Imperative, Konditionalsätze)

**Wählen Sie nicht nur die einfachen aus.** Die Stichprobe muss Einträge enthalten, mit denen Ihre Methode wahrscheinlich Schwierigkeiten haben wird — denn genau dort ist menschliche Qualität am wichtigsten.

## Der Arbeitsablauf zur Gemeinschaftsüberprüfung

Für indigene Sprachgemeinschaften respektiert dieser Ansatz die Zeit der sprechenden Personen:

1. **Eine sprechende Person übersetzt 50–100 Einträge** (2–4 Stunden konzentrierter Arbeit)
2. **Die Maschine übersetzt die verbleibenden 900** unter Verwendung der Arbeit der sprechenden Person als Coaching-Daten
3. **Die sprechende Person überprüft die markierten Einträge** — nur diejenigen, bei denen die Maschine am wenigsten zuversichtlich war (weitere 1–2 Stunden)
4. **Ergebnis:** 1.000 Übersetzungen in nahezu menschlicher Qualität, mit etwa 5 Stunden Zeitaufwand der sprechenden Person statt etwa 50

## Vor- und Nachteile

| | |
|---|---|
| ✅ Verbindet menschliche Qualität mit maschineller Skalierbarkeit | ❌ Erfordert anfängliche menschliche Investition |
| ✅ Respektiert die begrenzte Verfügbarkeit sprechender Personen | ❌ Die Maschine erfasst möglicherweise nicht alle stilistischen Nuancen |
| ✅ Natürlicher Arbeitsablauf zur Qualitätssicherung | ❌ Die Auswahl der Stichprobe beeinflusst die Gesamtqualität |
| ✅ Hervorragend für Gemeinschafts-/Bildungskontexte geeignet | ❌ Engpass bei der menschlichen Überprüfung markierter Einträge |

## Lässt sich gut kombinieren mit

- **[Coached LLM Prompting](./coached-llm-prompting)** — menschliche Übersetzungen fließen in die Coaching-Daten ein
- **[Few-Shot Prompting](./few-shot-prompting)** — menschliche Übersetzungen als kontextbezogene Beispiele
- **[Corpus Creation](./corpus-creation)** — die menschliche Stichprobe IST Corpus-Erstellung

## Siehe auch

- [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) — Modell zur Gemeinschaftseinbindung
- [Datensouveränität](/docs/network/sovereignty/data-sovereignty) — Eigentum an Übersetzungsdaten
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages)
