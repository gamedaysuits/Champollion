---
title: "Für KI-Agenten"
slug: /agents
sidebar_label: "Hier beginnen"
description: "Das technische Handbuch für KI-Agenten, die die Rails von Champollion steuern: der operative Vertrag, das Projektmodell, die genauen Werkzeugaufrufe sowie die Daten- und Messregeln."
---

# Für KI-Agenten

Sie sind hier, weil eine Person Sie gebeten hat, beim Aufbau maschineller Übersetzung
für ihre Sprache mit Champollion zu helfen. Dieser Abschnitt ist Ihr Handbuch. Er ist
präzise, wo die Seiten für Menschen einfach gehalten sind: Feldnamen, Modi, Verweigerungen
und Befehle werden exakt aus dem Code zitiert.

**Lesen Sie zuerst [den Betriebsvertrag](/docs/agents/contract).** Er ist kurz
und stellt den Teil dar, bei dem Sie keine Fehler machen dürfen: was Sie lesen dürfen,
was Sie erfragen müssen, was Sie niemals anstelle der Menschen entscheiden dürfen und
welche Regeln die Werkzeuge durchsetzen im Vergleich zu jenen, die nur Sie einhalten können.

## Verbinden

Die Leitplanken sind ein MCP-Server. Fügen Sie ihn zur Konfiguration Ihres MCP-Clients hinzu:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

Das Standardprofil bildet die Leitplanken: sechs Werkzeuge — `start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation` und
`explain`. Jeder Schritt der Leitplanken ist zugleich ein gewöhnlicher Shell-Befehl
(`champollion`, `nmt-forge`, `mt-eval`), sodass ein Agent ohne MCP denselben
Leitplanken über ein Terminal folgen kann.

## Maschinenlesbare Einstiegspunkte

- [`/llms.txt`](https://champollion.dev/llms.txt) — der Index dieser Dokumentation.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — die verlinkte Dokumentation
  in einer einzigen Datei.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — der Einstieg
  als reines Markdown.

## In diesem Abschnitt

1. [Der Betriebsvertrag](/docs/agents/contract) — lesen Sie diesen zuerst.
2. [Der MCP-Server](/docs/network/getting-started/mcp-server) — beide Profile
   und jedes Werkzeug.
3. [Jeder Befehl, Schritt für Schritt](/docs/agents/shell) — der vollständige
   Ablauf mit Befehlen.

Die Menschen, denen Sie helfen, lesen [die Seiten für Menschen](/docs/): einfache Worte,
dieselben Fakten. Wenn Sie ihnen etwas erklären, entspricht dieses Register demjenigen,
an dem Sie sich orientieren sollten.
