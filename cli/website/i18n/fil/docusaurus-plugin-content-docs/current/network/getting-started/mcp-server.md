---
title: "MCP Server — ang pintuan para sa agent"
sidebar_label: "MCP Server"
description: "Ikonekta ang isang AI agent sa Champollion gamit ang Model Context Protocol: 23 tools para sa pagsasalin, pag-browse sa benchmark queue, pagpapatakbo ng mga evaluation, at pagsasanay ng mga model — kasama na kung alin mismo sa mga ito ang nangangailangan ng higit pa sa isang npx install."
---

# MCP Server — ang pintuan para sa mga agent

Inilalantad ng `champollion-mcp-server` ang Champollion sa mga AI agent sa pamamagitan ng [Model Context Protocol](https://modelcontextprotocol.io). Kung kayo po ay isang agent, o nag-aayos ng isa, ito ang pintuan: **23 tools, 3 resources at 3 prompts** sa pamamagitan ng stdio.

Ang lahat ng narito ay maaari ring ma-access bilang plain HTTP — tingnan ang [Mga machine-readable endpoint](#machine-readable-endpoints) — ngunit ang MCP server ang tanging surface na nagpapahintulot sa isang agent na *kumilos* (magsalin, magpatakbo ng benchmark, mag-train ng model) sa halip na magbasa lamang.

## I-install

```bash
npx -y champollion-mcp-server
```

Pagkatapos ay i-register ito sa inyong client. Para sa Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Para sa mga client na naka-configure sa pamamagitan ng file (Claude Desktop, Cursor, Antigravity), idagdag ang:

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

## Basahin ito bago kayo umasa rito

**Siyam sa 23 tools ang gumagana mula sa isang bare na `npx` install. Ang natitirang labing-apat ay nangangailangan ng software na hindi kasama at hindi maaaring isama ng npm package.** Hindi sila tahimik na pumapalya — ang bawat isa ay nagbabalik ng isang actionable error na tumutukoy kung ano ang kulang — ngunit dapat ninyong malaman ang kabuuan nito bago kayo magplano batay rito.

| Tools | Gumagana ba pagkatapos ng `npx`? | Ano pa ang kailangan nila |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **Oo** — read-only, sineserve mula sa mga public endpoint | wala |
| `translate` | Hindi | ang `champollion` CLI (`npm i -g champollion`) at isang API key |
| `run_benchmark`, `get_run_status` | Hindi | ang eval harness — `pipx install mt-eval-harness` |
| ang labing-isang `forge_*` tools | Hindi | isang clone ng monorepo na may `CHAMPOLLION_FORGE_DIR` na naka-set sa `forge/` directory nito; ang pag-score ay nangangailangan din ng `mt-eval` |

Kung gusto ninyo ang buong surface, i-clone ang repo sa halip na umasa sa `npx`.

## Ano ang ginagawa ng mga tool

**I-browse at alamin ang gastos ng trabaho.** Ang `list_queue` at `get_queue_item` ay naglalakad sa open benchmark queue — ang naka-rank na listahan ng mga sukat na higit na magpapabuti sa mapa. Ang `estimate_cost` ay nagpepresyo ng isang set ng mga run bago kayo gumastos ng anuman.

**Maghanap ng mga impormasyon.** Ang `search_languages` ay naghahanap sa mga language card ayon sa pangalan, code, pamilya o rehiyon. Ang `get_results` at `get_run_card` ay nagbabasa ng mga na-score na run mula sa public leaderboard. Sinasagot ng `get_metric_reliability` ang tanong na madalas pagkamalian ng karamihan sa mga agent — *aling metric ang dapat kong pagkatiwalaan para sa target language na ito* — mula sa mga correlation sa mga human judgment bawat pamilya ng wika.

**Kumilos.** Ang `translate` ay nagpapatakbo ng text sa nasubok na pipeline, na may Translation Memory (walang bayad ang mga pag-uulit) at isang deterministic na quality gate. Ang `run_benchmark` ay nagsisimula ng isang evaluation at nagbabalik ng isang **job id kaagad**, dahil ang mga totoong run ay mas tumatagal kaysa sa anumang client timeout; ipa-poll ninyo ang `get_run_status` gamit ang id na iyon.

**Mag-train nang hindi niloloko ang inyong sarili.** Ang `get_training_guardrails` ay nagbabalik ng mga rule na nakuha mula sa mga totoong nasukat na pagkabigo. Ang labing-isang `forge_*` tools ay nagpapatakbo ng [NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status` muna at pagkatapos ng bawat hakbang, `forge_preflight` upang makita kung aling mga gate ang tatamaan ng isang command bago ito tumanggi.

:::note[Ang paggastos ay may limitasyon ayon sa disenyo]
Ang `run_benchmark` ay **tumatanggi sa isang walang limitasyong queue run.** Dapat kayong magpasa ng eksaktong isang limitasyon — `budget`, `top`, o isang partikular na `item_id`. Walang "patakbuhin lang ang queue" na tawag, dahil ang isang agent na hindi nakakaunawa sa queue ay maaaring gumastos nang walang limitasyon.
:::

## Bersyon ng protocol

Ang transport ay **stdio lamang** — isang server process bawat agent.

Ginawa ng [2026-07-28 revision](https://blog.modelcontextprotocol.io/posts/2026-07-28/) ng MCP na stateless ang protocol bilang default, na nag-retire sa `initialize` handshake at sa `Mcp-Session-Id` header. Ang server na ito ay hindi apektado sa disenyo: hindi ito gumagamit ng anuman sa mga deprecated na kakayahan (Roots, Sampling, Logging), hindi kailanman gumamit ng legacy na HTTP+SSE transport, at sumusunod na sa bagong gabay para sa cross-call state — ang `run_benchmark` ay gumagawa ng isang tahasang job handle na ibinabalik ng model, sa halip na umasa sa isang transport session.

**Hindi** pa ito na-upgrade sa bagong revision, dahil wala pang na-publish na TypeScript SDK na gumagamit nito. Tingnan ang [server README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) para sa buong posisyon.

## Mga machine-readable endpoint

Walang MCP client na kailangan para sa mga ito:

| Endpoint | Ano ito |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | Ang [agent front door](/for-agents), bilang raw markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Ang curated index ng site na ito |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Bawat naka-index na pahina, inlined |
| [`/queue.json`](https://champollion.dev/queue.json) | Ang buong benchmark queue |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Mga nangungunang item sa queue |
| [`/registry.json`](https://champollion.dev/registry.json) | Ang corpus registry |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Ang nasukat na language graph |

## Susunod

- [Gabay sa Agent — pagbuo at pag-benchmark](/docs/network/getting-started/agent-guide)
- [Gabay sa Agent — pagsasalin gamit ang CLI](/docs/guides/agent-guide)
- [Magsumite ng Paraan](/docs/network/getting-started/submit-a-method)
