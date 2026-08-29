---
sidebar_position: 3
title: "Cookbook: Few-Shot-Prompting"
---

# Few-Shot Prompting

> **Die Idee:** Binden Sie verifizierte, hochwertige Übersetzungspaare als In-Context-Beispiele ein, sodass das LLM die Muster, den Stil und die Konventionen der Zielsprache durch Demonstration statt durch Anweisung erlernt.

:::info[Dies ist ein Kochbuch, keine fertige Implementierung]
Dieser Leitfaden skizziert den Ansatz und seine wesentlichen Designentscheidungen. Passen Sie ihn an Ihr Sprachpaar und die verfügbaren Ressourcen an.
:::

## Wann Sie dies verwenden sollten

- Sie verfügen über eine **kleine Menge verifizierter Übersetzungen** (bereits 5–10 Goldpaare helfen)
- Sie möchten, dass das LLM einen **bestimmten Stil oder ein bestimmtes Register** anhand von Beispielen statt anhand von Regeln nachbildet
- Ihre Zielsprache weist Muster auf, die **leichter zu zeigen als zu beschreiben** sind (Wortstellung, Affigierungsmuster, Formalitätsmarker)

## Funktionsweise

1. **Beispielpaare kuratieren** — wählen Sie hochwertige Quell-→Ziel-Übersetzungen aus, die zentrale Muster veranschaulichen
2. **Als In-Context-Beispiele formatieren** — fügen Sie sie vor der eigentlichen Übersetzungsanfrage in den System- oder Benutzer-Prompt ein
3. **Das Harness ausführen** — messen Sie, ob die Beispiele die Metriken gegenüber Zero-Shot verbessern
4. **Bei der Beispielauswahl iterieren** — tauschen Sie Beispiele aus, um verschiedene Fehlermodi abzudecken

## Beispielhafte Prompt-Struktur

```
You are translating English to Plains Cree (SRO orthography).

Examples of correct translations:
- "Hello" → "tânisi"
- "Thank you" → "kinanâskomitin"  
- "I am going home" → "nikîwân"
- "The children are playing" → "awâsisak mêtawêwak"

Now translate the following:
- "Welcome to the school"
```

## Kritische Regel: Keine Kontamination durch Evaluierungsdaten

:::danger[Verwenden Sie KEINE Evaluationsdaten als Few-Shot-Beispiele]
Wenn Ihre Beispiele aus dem Evaluationsdatensatz stammen, wird Ihre Methode für die Bestenliste **disqualifiziert**. Few-Shot-Beispiele müssen aus unabhängigen Quellen stammen — Wörterbüchern, Lehrbüchern, von der Community verifizierten Paaren oder einem separaten Entwicklungsdatensatz. Das Harness erstellt einen Fingerabdruck Ihres exakten Prompts; Kontamination ist erkennbar.
:::

## Zentrale Designentscheidungen

**Wie viele Beispiele?** 3–8 sind der optimale Bereich. Weniger liefert dem LLM zu wenig Signal; mehr beansprucht das Kontextfenster bei abnehmendem Nutzen.

**Welche Beispiele?** Priorisieren Sie Vielfalt vor Schwierigkeitsgrad. Decken Sie verschiedene Satzstrukturen, Wortlängen und grammatikalische Merkmale ab. Häufen Sie die Beispiele nicht um ein einziges Muster an.

**Statische vs. dynamische Auswahl?** Statische Beispiele sind einfacher. Dynamische Auswahl (das Auswählen von Beispielen, die dem aktuellen Input ähneln) kann die Qualität verbessern, erhöht jedoch die Komplexität — ziehen Sie [verkettete Modelle](./chained-models) für den Retrieval-Schritt in Betracht.

## Vor- und Nachteile

| | |
|---|---|
| ✅ Leistungsstark für die Stilanpassung | ❌ Kleines Kontextfenster begrenzt die Anzahl der Beispiele |
| ✅ Kein Training erforderlich | ❌ Die Beispielauswahl ist eine Kunst, keine Wissenschaft |
| ✅ Funktioniert mit jedem LLM | ❌ Risiko der Kontamination durch Evaluierungsdaten (Disqualifikation) |
| ✅ Verschiedene Beispielmengen lassen sich leicht per A/B-Test vergleichen | ❌ Beispiele lassen sich möglicherweise nicht auf alle Input-Typen verallgemeinern |

## Lässt sich gut kombinieren mit

- **[Coached LLM Prompting](./coached-llm-prompting)** — Regeln + Beispiele zusammen übertreffen jeweils das Einzelne
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — erzwungene Begriffe + Stilbeispiele
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — Beispiele für den Stil, FST für die morphologische Korrektheit

## Siehe auch

- [MT-Evaluierungsregeln](/docs/network/leaderboard/rules) — was zur Disqualifikation führt
- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) — wissen Sie, was Sie NICHT als Beispiele verwenden dürfen
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages)
