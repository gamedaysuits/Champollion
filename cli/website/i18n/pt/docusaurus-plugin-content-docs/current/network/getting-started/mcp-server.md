---
title: "MCP Server — a porta de acesso para o agente"
sidebar_label: "MCP Server"
description: "Conecte um agente de IA ao Champollion através do Model Context Protocol: 23 ferramentas para traduzir, navegar na fila de benchmark, executar avaliações e treinar modelos — além de saber exatamente quais delas exigem mais do que um npx install."
---

# Servidor MCP — a porta de entrada para agentes

`champollion-mcp-server` expõe o Champollion a agentes de IA através do [Model Context Protocol](https://modelcontextprotocol.io). Se você é um agente, ou está configurando um, esta é a porta de entrada: **23 ferramentas, 3 recursos e 3 prompts** via stdio.

Tudo aqui também é acessível como HTTP simples — veja [Endpoints legíveis por máquina](#machine-readable-endpoints) — mas o servidor MCP é a única superfície que permite que um agente *aja* (traduza, execute um benchmark, treine um modelo) em vez de apenas ler.

## Instalação

```bash
npx -y champollion-mcp-server
```

Em seguida, registre-o no seu cliente. Para o Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Para clientes configurados por arquivo (Claude Desktop, Cursor, Antigravity), adicione:

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

## Leia isto antes de depender dele

**Nove das 23 ferramentas funcionam a partir de uma instalação básica do `npx`. As outras quatorze precisam de software que o pacote npm não inclui e não pode incluir.** Elas não falham silenciosamente — cada uma retorna um erro acionável nomeando o que está faltando — mas você deve conhecer a estrutura antes de planejar em torno dela.

| Ferramentas | Funcionam após `npx`? | O que mais elas precisam |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **Sim** — somente leitura, servidas a partir de endpoints públicos | nada |
| `translate` | Não | a CLI do `champollion` (`npm i -g champollion`) e uma chave de API |
| `run_benchmark`, `get_run_status` | Não | o framework de avaliação (eval harness) — `pipx install mt-eval-harness` |
| as onze ferramentas `forge_*` | Não | um clone do monorepo com `CHAMPOLLION_FORGE_DIR` definido para o seu diretório `forge/`; a pontuação também precisa do `mt-eval` |

Se você quiser toda a superfície, clone o repositório em vez de depender do `npx`.

## O que as ferramentas fazem

**Navegar e orçar o trabalho.** `list_queue` e `get_queue_item` percorrem a fila de benchmarks abertos — a lista classificada de medições que mais melhorariam o mapa. `estimate_cost` precifica um conjunto de execuções antes de você gastar qualquer coisa.

**Pesquisar informações.** `search_languages` pesquisa os cartões de idioma por nome, código, família ou região. `get_results` e `get_run_card` leem execuções pontuadas do placar público. `get_metric_reliability` responde à pergunta que a maioria dos agentes erra — *em qual métrica devo confiar para este idioma de destino* — a partir de correlações com julgamentos humanos por família de idiomas.

**Agir.** `translate` executa o texto através do pipeline testado, com Memória de Tradução (repetições não custam nada) e um portão de qualidade determinístico. `run_benchmark` inicia uma avaliação e retorna um **ID de trabalho imediatamente**, porque execuções reais duram mais do que qualquer tempo limite do cliente; você consulta o `get_run_status` com esse ID.

**Treinar sem se enganar.** `get_training_guardrails` retorna as regras extraídas de falhas reais medidas. As onze ferramentas `forge_*` executam o [NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status` primeiro e após cada etapa, `forge_preflight` para ver quais portões um comando atingirá antes de recusar.

:::note[Os gastos são limitados por design]
`run_benchmark` **recusa uma execução de fila ilimitada.** Você deve passar exatamente um limite — `budget`, `top` ou um `item_id` específico. Não há uma chamada "apenas execute a fila", porque um agente que entenda mal a fila poderia, de outra forma, gastar sem limites.
:::

## Versão do protocolo

O transporte é **apenas stdio** — um processo de servidor por agente.

A [revisão de 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) do MCP tornou o protocolo sem estado (stateless) por padrão, aposentando o handshake `initialize` e o cabeçalho `Mcp-Session-Id`. Este servidor não é afetado em seu design: ele não usa nenhuma das capacidades descontinuadas (Roots, Sampling, Logging), nunca usou o transporte legado HTTP+SSE e já segue as novas diretrizes para estado entre chamadas — `run_benchmark` cria um identificador de trabalho explícito que o modelo devolve, em vez de depender de uma sessão de transporte.

Ele **não** foi atualizado para a nova revisão, porque nenhum SDK TypeScript publicado fala essa versão ainda. Veja o [README do servidor](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) para o posicionamento completo.

## Endpoints legíveis por máquina

Nenhum cliente MCP é necessário para estes:

| Endpoint | O que é |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | A [porta de entrada para agentes](/for-agents), como markdown bruto |
| [`/llms.txt`](https://champollion.dev/llms.txt) | O índice curado deste site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Todas as páginas indexadas, embutidas |
| [`/queue.json`](https://champollion.dev/queue.json) | A fila completa de benchmarks |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Os principais itens da fila |
| [`/registry.json`](https://champollion.dev/registry.json) | O registro do corpus |
| [`/mesh.json`](https://champollion.dev/mesh.json) | O grafo de idiomas medidos |

## A seguir

- [Guia do Agente — construção e benchmarking](/docs/network/getting-started/agent-guide)
- [Guia do Agente — traduzindo com a CLI](/docs/guides/agent-guide)
- [Enviar um Método](/docs/network/getting-started/submit-a-method)
