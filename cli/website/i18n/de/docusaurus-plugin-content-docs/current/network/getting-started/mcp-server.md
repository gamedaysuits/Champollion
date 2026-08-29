---
title: "MCP Server — die Schnittstelle für Agenten"
sidebar_label: "MCP Server"
description: "Verbinden Sie einen KI-Agenten über das Model Context Protocol mit Champollion: 23 Werkzeuge zum Übersetzen, Durchsuchen der Benchmark-Warteschlange, Ausführen von Evaluierungen und Trainieren von Modellen — sowie genaue Informationen darüber, welche davon mehr als ein npx install erfordern."
---

# MCP-Server — der Zugang für Agenten

`champollion-mcp-server` macht Champollion für KI-Agenten über das [Model Context Protocol](https://modelcontextprotocol.io) zugänglich. Wenn Sie ein Agent sind oder einen solchen anbinden, ist dies der Zugang: **23 Werkzeuge, 3 Ressourcen und 3 Prompts** über stdio.

Alles hier ist auch als einfaches HTTP erreichbar — siehe [Maschinenlesbare Endpunkte](#machine-readable-endpoints) —, aber der MCP-Server ist die einzige Oberfläche, die es einem Agenten ermöglicht, zu *handeln* (übersetzen, einen Benchmark ausführen, ein Modell trainieren), anstatt nur zu lesen.

## Installation

```bash
npx -y champollion-mcp-server
```

Registrieren Sie es anschließend bei Ihrem Client. Für Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Für Clients, die per Datei konfiguriert werden (Claude Desktop, Cursor, Antigravity), fügen Sie Folgendes hinzu:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## Lesen Sie dies, bevor Sie sich darauf verlassen

**Neun der 23 Werkzeuge funktionieren mit einer reinen `npx`-Installation. Die anderen vierzehn benötigen Software, die das npm-Paket nicht mitliefert und nicht mitliefern kann.** Sie schlagen nicht stillschweigend fehl — jedes gibt einen handlungsorientierten Fehler zurück, der benennt, was fehlt —, aber Sie sollten die Rahmenbedingungen kennen, bevor Sie damit planen.

| Werkzeuge | Funktionieren nach `npx`? | Was sie sonst noch benötigen |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **Ja** — schreibgeschützt, bereitgestellt über öffentliche Endpunkte | nichts |
| `translate` | Nein | die `champollion`-CLI (`npm i -g champollion`) und einen API-Schlüssel |
| `run_benchmark`, `get_run_status` | Nein | die Evaluierungsumgebung (eval harness) — `pipx install mt-eval-harness` |
| die elf `forge_*`-Werkzeuge | Nein | einen Klon des Monorepos, bei dem `CHAMPOLLION_FORGE_DIR` auf dessen `forge/`-Verzeichnis gesetzt ist; für die Bewertung wird außerdem `mt-eval` benötigt |

Wenn Sie die gesamte Oberfläche nutzen möchten, klonen Sie das Repository, anstatt sich auf `npx` zu verlassen.

## Was die Werkzeuge tun

**Die Arbeit durchsuchen und kalkulieren.** `list_queue` und `get_queue_item` durchlaufen die offene Benchmark-Warteschlange — die nach Rang geordnete Liste von Messungen, welche die Karte am meisten verbessern würden. `estimate_cost` berechnet die Kosten für eine Reihe von Durchläufen, bevor Sie etwas ausgeben.

**Dinge nachschlagen.** `search_languages` durchsucht die Sprachkarten nach Name, Code, Sprachfamilie oder Region. `get_results` und `get_run_card` lesen bewertete Durchläufe aus der öffentlichen Rangliste aus. `get_metric_reliability` beantwortet die Frage, die die meisten Agenten falsch verstehen — *welcher Metrik sollte ich für diese Zielsprache vertrauen* —, basierend auf Korrelationen mit menschlichen Beurteilungen pro Sprachfamilie.

**Handeln.** `translate` leitet Text durch die getestete Pipeline, mit Translation Memory (Wiederholungen kosten nichts) und einem deterministischen Quality Gate. `run_benchmark` startet eine Evaluierung und gibt **sofort eine Job-ID** zurück, da echte Durchläufe jedes Client-Timeout überdauern; Sie fragen `get_run_status` mit dieser ID ab.

**Trainieren, ohne sich selbst zu täuschen.** `get_training_guardrails` gibt die Regeln zurück, die aus echten, gemessenen Fehlern extrahiert wurden. Die elf `forge_*`-Werkzeuge führen [NMT Forge](/docs/network/getting-started/training-honestly) aus — `forge_status` zuerst und nach jedem Schritt, `forge_preflight`, um zu sehen, auf welche Gates ein Befehl stößt, bevor er abgelehnt wird.

:::note[Ausgaben sind konzeptionsbedingt begrenzt]
`run_benchmark` **lehnt einen unbegrenzten Warteschlangen-Durchlauf ab.** Sie müssen genau eine Begrenzung übergeben — `budget`, `top` oder eine spezifische `item_id`. Es gibt keinen Aufruf, der "einfach die Warteschlange ausführt", da ein Agent, der die Warteschlange missversteht, sonst unbegrenzt Geld ausgeben könnte.
:::

## Protokollversion

Der Transport erfolgt **ausschließlich über stdio** — ein Serverprozess pro Agent.

Die [Revision vom 28.07.2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/) von MCP machte das Protokoll standardmäßig zustandslos und musterte den `initialize`-Handshake sowie den `Mcp-Session-Id`-Header aus. Dieser Server ist in seinem Design davon nicht betroffen: Er nutzt keine der veralteten Funktionen (Roots, Sampling, Logging), hat nie den veralteten HTTP+SSE-Transport verwendet und befolgt bereits die neuen Richtlinien für den Status über mehrere Aufrufe hinweg (cross-call state) — `run_benchmark` generiert ein explizites Job-Handle, das das Modell zurückgibt, anstatt sich auf eine Transportsitzung zu stützen.

Er wurde **nicht** auf die neue Revision aktualisiert, da noch kein veröffentlichtes TypeScript-SDK diese unterstützt. Siehe die [Server-README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) für die vollständige Stellungnahme.

## Maschinenlesbare Endpunkte

Für diese wird kein MCP-Client benötigt:

| Endpunkt | Was es ist |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | Der [Zugang für Agenten](/for-agents), als reines Markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Das kuratierte Verzeichnis dieser Website |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Jede indizierte Seite, eingebettet |
| [`/queue.json`](https://champollion.dev/queue.json) | Die vollständige Benchmark-Warteschlange |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Die obersten Einträge der Warteschlange |
| [`/registry.json`](https://champollion.dev/registry.json) | Die Korpus-Registrierung |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Der gemessene Sprachgraph |

## Nächste Schritte

- [Agenten-Leitfaden — Erstellen & Benchmarking](/docs/network/getting-started/agent-guide)
- [Agenten-Leitfaden — Übersetzen mit der CLI](/docs/guides/agent-guide)
- [Eine Methode einreichen](/docs/network/getting-started/submit-a-method)
