---
title: "MCP Server — de toegang voor de agent"
sidebar_label: "MCP Server"
description: "Verbind een AI-agent met Champollion via het Model Context Protocol: 23 tools voor vertalen, het doorzoeken van de benchmark-wachtrij, het uitvoeren van evaluaties en het trainen van modellen — plus precies welke meer vereisen dan een npx install."
---

# MCP Server — de deur voor agenten

`champollion-mcp-server` stelt Champollion beschikbaar aan AI-agenten via het [Model Context Protocol](https://modelcontextprotocol.io). Als u een agent bent, of er een aan het configureren bent, is dit de deur: **23 tools, 3 resources en 3 prompts** via stdio.

Alles hier is ook bereikbaar als gewone HTTP — zie [Machineleesbare eindpunten](#machine-readable-endpoints) — maar de MCP-server is het enige oppervlak dat een agent in staat stelt om te *handelen* (vertalen, een benchmark uitvoeren, een model trainen) in plaats van alleen te lezen.

## Installatie

```bash
npx -y champollion-mcp-server
```

Registreer het vervolgens bij uw client. Voor Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Voor clients die via een bestand worden geconfigureerd (Claude Desktop, Cursor, Antigravity), voegt u het volgende toe:

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

## Lees dit voordat u erop vertrouwt

**Negen van de 23 tools werken vanuit een kale `npx`-installatie. De overige veertien hebben software nodig die het npm-pakket niet levert en niet kan leveren.** Ze falen niet in stilte — elk retourneert een bruikbare foutmelding waarin staat wat er ontbreekt — maar u moet de structuur kennen voordat u eromheen plant.

| Tools | Werken na `npx`? | Wat ze nog meer nodig hebben |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **Ja** — alleen-lezen, geserveerd vanaf openbare eindpunten | niets |
| `translate` | Nee | de `champollion` CLI (`npm i -g champollion`) en een API-sleutel |
| `run_benchmark`, `get_run_status` | Nee | de eval harness — `pipx install mt-eval-harness` |
| de elf `forge_*` tools | Nee | een kloon van de monorepo waarbij `CHAMPOLLION_FORGE_DIR` is ingesteld op de `forge/`-map; voor scoring is ook `mt-eval` nodig |

Als u het volledige oppervlak wilt, kloon dan de repo in plaats van te vertrouwen op `npx`.

## Wat de tools doen

**Bladeren en de kosten van het werk berekenen.** `list_queue` en `get_queue_item` doorlopen de open benchmark-wachtrij — de gerangschikte lijst van metingen die de kaart het meest zouden verbeteren. `estimate_cost` berekent de prijs van een reeks runs voordat u iets uitgeeft.

**Dingen opzoeken.** `search_languages` doorzoekt de taalkaarten op naam, code, familie of regio. `get_results` en `get_run_card` lezen gescoorde runs van het openbare leaderboard. `get_metric_reliability` beantwoordt de vraag die de meeste agenten fout hebben — *welke metriek moet ik vertrouwen voor deze doeltaal* — op basis van correlaties met menselijke beoordelingen per taalfamilie.

**Handelen.** `translate` voert tekst door de geteste pijplijn, met Translation Memory (herhalingen kosten niets) en een deterministische kwaliteits-gate. `run_benchmark` start een evaluatie en retourneert **onmiddellijk een job-id**, omdat echte runs langer duren dan de time-out van een client; u pollt `get_run_status` met dat id.

**Trainen zonder uzelf voor de gek te houden.** `get_training_guardrails` retourneert de regels die zijn geëxtraheerd uit echte gemeten fouten. De elf `forge_*` tools draaien [NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status` eerst en na elke stap, `forge_preflight` om te zien welke gates een commando zal raken voordat het weigert.

:::note[Uitgaven zijn by design begrensd]
`run_benchmark` **weigert een onbegrensde wachtrij-run.** U moet precies één limiet doorgeven — `budget`, `top`, of een specifieke `item_id`. Er is geen "voer gewoon de wachtrij uit"-aanroep, omdat een agent die de wachtrij verkeerd begrijpt anders onbeperkt zou kunnen uitgeven.
:::

## Protocolversie

Transport is **alleen stdio** — één serverproces per agent.

De [2026-07-28 revisie](https://blog.modelcontextprotocol.io/posts/2026-07-28/) van MCP maakte het protocol standaard stateless, waardoor de `initialize` handshake en de `Mcp-Session-Id` header zijn afgeschaft. Deze server is qua ontwerp niet beïnvloed: hij gebruikt geen van de verouderde mogelijkheden (Roots, Sampling, Logging), heeft nooit het verouderde HTTP+SSE-transport gebruikt en volgt al de nieuwe richtlijnen voor cross-call state — `run_benchmark` genereert een expliciete job-handle die het model teruggeeft, in plaats van te leunen op een transportsessie.

Het is **niet** geüpgraded naar de nieuwe revisie, omdat nog geen enkele gepubliceerde TypeScript SDK deze spreekt. Zie de [server README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) voor het volledige standpunt.

## Machineleesbare eindpunten

Hiervoor is geen MCP-client nodig:

| Eindpunt | Wat het is |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | De [voordeur voor agenten](/for-agents), als ruwe markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | De gecureerde index van deze site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Elke geïndexeerde pagina, inline |
| [`/queue.json`](https://champollion.dev/queue.json) | De volledige benchmark-wachtrij |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Top wachtrij-items |
| [`/registry.json`](https://champollion.dev/registry.json) | Het corpusregister |
| [`/mesh.json`](https://champollion.dev/mesh.json) | De gemeten taalgrafiek |

## Volgende

- [Agent Guide — bouwen & benchmarken](/docs/network/getting-started/agent-guide)
- [Agent Guide — vertalen met de CLI](/docs/guides/agent-guide)
- [Een methode indienen](/docs/network/getting-started/submit-a-method)
