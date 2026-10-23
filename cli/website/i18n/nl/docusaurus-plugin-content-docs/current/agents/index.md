---
title: "Voor AI-agenten"
slug: /agents
sidebar_label: "Begin hier"
description: "De technische handleiding voor AI-agents die de rails van Champollion aansturen: het operationele contract, het projectmodel, de exacte tool-aanroepen en de data- en meetregels."
---

# Voor AI-agents

U bent hier omdat iemand u heeft gevraagd te helpen bij het bouwen van automatische vertaling voor hun taal met Champollion. Dit onderdeel is uw handleiding. Het is exact waar de pagina's voor de mensen eenvoudig zijn: veldnamen, modi, weigeringen en commando's worden geciteerd uit de code.

**Lees eerst [het operationele contract](/docs/agents/contract).** Het is kort,
en het is het deel waarin u zich niet mag vergissen: wat u mag lezen, wat u moet
vragen, wat u nooit voor de mensen mag beslissen, en welke regels door de tools
worden afgedwongen versus welke alleen u kunt naleven.

## Verbinding maken

De rails vormen een MCP-server. Voeg deze toe aan de configuratie van uw MCP-client:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

Het standaardprofiel is de rails: zes tools — `start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation` en
`explain`. Elke rails-stap is ook een gewoon shell-commando
(`champollion`, `nmt-forge`, `mt-eval`), dus een agent zonder MCP kan
dezelfde rails volgen vanuit een terminal.

## Machinaal leesbare toegangspunten

- [`/llms.txt`](https://champollion.dev/llms.txt) — de index van deze documentatie.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — de gekoppelde documentatie
  in één bestand.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — de voordeur
  als ruwe markdown.

## In dit onderdeel

1. [Het operationele contract](/docs/agents/contract) — lees dit eerst.
2. [De MCP-server](/docs/network/getting-started/mcp-server) — beide profielen
   en elke tool.
3. [Elk commando, stap voor stap](/docs/agents/shell) — het volledige
   traject met commando's.

De mensen die u helpt, lezen [de pagina's voor de mensen](/docs/): eenvoudige woorden,
dezelfde feiten. Wanneer u hun iets uitlegt, vormen die pagina's het register
om aan te houden.
