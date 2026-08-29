---
sidebar_position: 7
title: "Kochbuch: Hybrid aus regelbasiert und LLM"
---

# Regelbasiert + LLM-Hybrid

> **Die Idee:** Verwenden Sie deterministische linguistische Regeln für Muster, von denen Sie wissen, dass sie korrekt sind (morphologische Affigierung, Zahlenformatierung, bekannte Phrasenstrukturen), und überlassen Sie dem LLM die kreative Übersetzung für alles Übrige. Regeln setzen sich gegenüber dem LLM dort durch, wo sie zutreffen; das LLM füllt die Lücken.

:::info[Dies ist ein Rezeptbuch, keine fertige Implementierung]
Dieser Leitfaden skizziert die Hybridarchitektur. Die konkreten Regeln hängen vollständig von der Grammatik Ihrer Zielsprache und den verfügbaren linguistischen Ressourcen ab.
:::

## Wann Sie dies verwenden sollten

- Sie verfügen über **tiefgehende linguistische Expertise** in der Zielsprache (oder haben Zugang zu einer Linguistin oder einem Linguisten)
- Einige Übersetzungsmuster sind **deterministisch** — Sie kennen die korrekte Ausgabe mit Sicherheit
- Das LLM **scheitert durchgängig** an bestimmten Mustern (Zahlenformatierung, Höflichkeitsformen, Agglutination)
- Sie möchten **Korrektheit garantieren** für Muster mit hohem Risiko und zugleich die Flüssigkeit für den Rest erhalten

## Funktionsweise

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **Regeln definieren** — Regex-Muster, FST-Abfragen, Nachschlagetabellen für bekannte Übersetzungen
2. **Vorverarbeiten** — durch Regeln erfasste Segmente im Ausgangstext identifizieren und extrahieren
3. **LLM übersetzt** — den verbleibenden Text, mit den Regelausgaben als Vorgaben
4. **Zusammenführen** — die Übersetzung wieder zusammensetzen, wobei die Regelausgabe bevorzugt wird, sofern vorhanden
5. **Validieren** — optionale FST-/Regelprüfung des zusammengeführten Ergebnisses

## Beispiel: Zahlen- und Datumsregeln

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## Zentrale Designentscheidungen

**Regelpriorität:** Wenn sowohl eine Regel als auch das LLM eine Ausgabe für dasselbe Segment erzeugen, welche setzt sich durch? Regeln sollten sich für **korrektheitskritische** Muster durchsetzen. Das LLM sollte sich für **flüssigkeitskritische** Muster durchsetzen.

**Granularität:** Regeln auf Wortebene (Wörterbuchabfrage) vs. Regeln auf Phrasenebene (Idiom-Zuordnung) vs. strukturelle Regeln (Satzumstellung). Beginnen Sie auf Wortebene; ergänzen Sie die Phrasenebene, sobald Sie Muster identifizieren.

**Regelpflege:** Jede Regel ist eine Pflegeverpflichtung. Bevorzugen Sie eine kleine Menge zuverlässiger Regeln gegenüber einer großen Menge approximativer Regeln. Wenn Sie sich nicht sicher sind, ob eine Regel korrekt ist, überlassen Sie sie dem LLM.

## Vor- und Nachteile

| | |
|---|---|
| ✅ Garantierte Korrektheit dort, wo Regeln zutreffen | ❌ Erfordert tiefgehende linguistische Expertise |
| ✅ Transparent — Regeln sind lesbar und überprüfbar | ❌ Die Naht zwischen Regel und LLM kann zu unnatürlichen Ausgaben führen |
| ✅ Regeln sind schnell (keine API-Kosten) | ❌ Der Pflegeaufwand wächst mit der Anzahl der Regeln |
| ✅ Progressiv — ergänzen Sie Regeln, während Sie dazulernen | ❌ Flexion an Regelgrenzen ist schwer zu handhaben |

## Lässt sich gut kombinieren mit

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST als eine bestimmte Art von Regel-Engine
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — Wörterbuchabfrage ist eine einfache Regel
- **[Coached LLM Prompting](./coached-llm-prompting)** — Coaching behandelt weiche Präferenzen, Regeln behandeln harte Anforderungen

## Siehe auch

- [GiellaLT](https://giellalt.github.io/) — quelloffene FST-Infrastruktur für mehr als 100 Sprachen
- [Apertium](https://www.apertium.org/) — regelbasierte MT-Plattform mit zweisprachigen Wörterbüchern
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
