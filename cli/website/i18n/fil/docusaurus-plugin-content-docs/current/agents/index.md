---
title: "Para sa mga AI agent"
slug: /agents
sidebar_label: "Magsimula rito"
description: "Ang teknikal na manwal para sa mga AI agent na nagpapatakbo sa mga riles ng Champollion: ang kontrata sa pagpapatakbo, ang modelo ng proyekto, ang eksaktong mga tool call, at ang mga panuntunan sa data at pagsukat."
---

# Para sa mga AI agent

Nandito kayo dahil hiniling ng isang tao na tumulong kayong bumuo ng machine translation para
sa kanilang wika gamit ang Champollion. Ang seksiyong ito ang inyong manwal. Tiyak ito
kung saan payak naman ang mga pahina para sa mga tao: ang mga pangalan ng field, mga mode, mga refusal, at mga command
ay sinipi mula sa code.

**Basahin muna [ang operating contract](/docs/agents/contract).** Maikli ito,
at ito ang bahaging hindi ninyo dapat ipagkamali: kung ano ang maaari ninyong basahin, kung ano ang dapat ninyong
itanong, kung ano ang hindi ninyo dapat kailanman pagpasiyahan para sa mga tao, at kung aling mga tuntunin ang
ipinatutupad ng mga tool kumpara sa kung alin ang kayo lamang ang makasusunod.

## Kumonekta

Ang rails ay isang MCP server. Idagdag ito sa configuration ng inyong MCP client:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

Ang default na profile ay ang rails: anim na tool — `start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation` at
`explain`. Ang bawat hakbang sa rails ay isa ring karaniwang shell command
(`champollion`, `nmt-forge`, `mt-eval`), kaya ang isang agent na walang MCP ay maaaring tahakin ang
parehong rails mula sa isang terminal.

## Mga machine-readable na entry point

- [`/llms.txt`](https://champollion.dev/llms.txt) — ang index ng mga doc na ito.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — ang mga naka-link na doc
  sa iisang file.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — ang pambungad
  bilang raw markdown.

## Sa seksiyong ito

1. [Ang operating contract](/docs/agents/contract) — basahin muna ito.
2. [Ang MCP server](/docs/network/getting-started/mcp-server) — ang parehong profile
   at bawat tool.
3. [Bawat command, bawat hakbang](/docs/agents/shell) — ang buong
   proseso kasama ang mga command.

Binabasa ng mga taong tinutulungan ninyo [ang mga pahina para sa mga tao](/docs/): mga payak na salita, ang
parehong mga katotohanan. Kapag nagpapaliwanag kayo ng anuman sa kanila, ang mga pahinang iyon ang register
na dapat tularan.
