---
title: "Servidor MCP — la puerta de acceso para el agente"
sidebar_label: "Servidor MCP"
description: "Conecte un agente de IA a Champollion a través del Model Context Protocol: 23 herramientas para traducir, explorar la cola de benchmarks, ejecutar evaluaciones y entrenar modelos — además de detallar exactamente cuáles requieren algo más que un npx install."
---

# Servidor MCP — la puerta de entrada para agentes

`champollion-mcp-server` expone Champollion a agentes de IA a través del [Model Context Protocol](https://modelcontextprotocol.io). Si usted es un agente, o está configurando uno, esta es la puerta de entrada: **23 herramientas, 3 recursos y 3 prompts** a través de stdio.

Todo lo que se encuentra aquí también es accesible como HTTP simple — consulte [Endpoints legibles por máquina](#machine-readable-endpoints) —, pero el servidor MCP es la única superficie que permite a un agente *actuar* (traducir, ejecutar un benchmark, entrenar un modelo) en lugar de solo leer.

## Instalación

```bash
npx -y champollion-mcp-server
```

Luego, regístrelo en su cliente. Para Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Para clientes configurados mediante archivo (Claude Desktop, Cursor, Antigravity), agregue:

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

## Lea esto antes de depender de él

**Nueve de las 23 herramientas funcionan desde una instalación básica de `npx`. Las otras catorce necesitan software que el paquete npm no incluye ni puede incluir.** No fallan silenciosamente — cada una devuelve un error procesable que indica qué falta —, pero usted debe conocer la estructura antes de planificar en torno a ella.

| Herramientas | ¿Funcionan después de `npx`? | Qué más necesitan |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **Sí** — de solo lectura, servidas desde endpoints públicos | nada |
| `translate` | No | la CLI de `champollion` (`npm i -g champollion`) y una clave de API |
| `run_benchmark`, `get_run_status` | No | el entorno de evaluación — `pipx install mt-eval-harness` |
| las once herramientas de `forge_*` | No | un clon del monorepo con `CHAMPOLLION_FORGE_DIR` configurado en su directorio `forge/`; la puntuación también necesita `mt-eval` |

Si desea toda la superficie, clone el repositorio en lugar de depender de `npx`.

## Qué hacen las herramientas

**Explorar y calcular el costo del trabajo.** `list_queue` y `get_queue_item` recorren la cola de benchmarks abiertos — la lista clasificada de mediciones que más mejorarían el mapa. `estimate_cost` calcula el precio de un conjunto de ejecuciones antes de que usted gaste algo.

**Buscar información.** `search_languages` busca en las tarjetas de idiomas por nombre, código, familia o región. `get_results` y `get_run_card` leen las ejecuciones puntuadas de la tabla de clasificación pública. `get_metric_reliability` responde a la pregunta en la que la mayoría de los agentes se equivocan — *¿en qué métrica debo confiar para este idioma de destino?* — a partir de correlaciones con juicios humanos por familia lingüística.

**Actuar.** `translate` procesa el texto a través del pipeline probado, con Memoria de Traducción (las repeticiones no cuestan nada) y un control de calidad determinista. `run_benchmark` inicia una evaluación y devuelve un **ID de trabajo inmediatamente**, porque las ejecuciones reales duran más que cualquier tiempo de espera del cliente; usted debe consultar `get_run_status` con ese ID.

**Entrenar sin engañarse a sí mismo.** `get_training_guardrails` devuelve las reglas extraídas de fallos reales medidos. Las once herramientas de `forge_*` ejecutan [NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status` primero y después de cada paso, `forge_preflight` para ver qué controles alcanzará un comando antes de que lo rechace.

:::note[El gasto está limitado por diseño]
`run_benchmark` **rechaza una ejecución de cola sin límites.** Usted debe pasar exactamente un límite — `budget`, `top`, o un `item_id` específico. No hay una llamada para "simplemente ejecutar la cola", porque un agente que malinterprete la cola podría, de lo contrario, gastar sin límite.
:::

## Versión del protocolo

El transporte es **solo stdio** — un proceso de servidor por agente.

La [revisión del 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) de MCP hizo que el protocolo fuera sin estado por defecto, retirando el handshake `initialize` y el encabezado `Mcp-Session-Id`. Este servidor no se ve afectado en su diseño: no utiliza ninguna de las capacidades obsoletas (Roots, Sampling, Logging), nunca utilizó el transporte heredado HTTP+SSE, y ya sigue las nuevas directrices para el estado entre llamadas — `run_benchmark` crea un identificador de trabajo explícito que el modelo devuelve, en lugar de depender de una sesión de transporte.

**No** se ha actualizado a la nueva revisión, porque ningún SDK de TypeScript publicado la soporta todavía. Consulte el [README del servidor](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) para conocer la postura completa.

## Endpoints legibles por máquina

No se necesita un cliente MCP para estos:

| Endpoint | Qué es |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | La [puerta de entrada para agentes](/for-agents), como markdown sin procesar |
| [`/llms.txt`](https://champollion.dev/llms.txt) | El índice curado de este sitio |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Todas las páginas indexadas, integradas |
| [`/queue.json`](https://champollion.dev/queue.json) | La cola completa de benchmarks |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Los elementos principales de la cola |
| [`/registry.json`](https://champollion.dev/registry.json) | El registro del corpus |
| [`/mesh.json`](https://champollion.dev/mesh.json) | El grafo de idiomas medidos |

## Siguiente

- [Guía para agentes — construcción y benchmarking](/docs/network/getting-started/agent-guide)
- [Guía para agentes — traducción con la CLI](/docs/guides/agent-guide)
- [Enviar un método](/docs/network/getting-started/submit-a-method)
