---
title: "Para agentes de IA"
slug: /agents
sidebar_label: "Comience aquí"
description: "El manual técnico para los agentes de IA que operan los rieles de Champollion: el contrato operativo, el modelo del proyecto, las llamadas exactas a herramientas y las reglas de datos y medición."
---

# Para agentes de IA

Usted está aquí porque una persona le pidió ayuda para construir traducción automática para
su idioma con Champollion. Esta sección es su manual. Es exacta
donde las páginas para las personas son sencillas: los nombres de campos, modos, rechazos y comandos
se citan desde el código.

**Lea primero [el contrato operativo](/docs/agents/contract).** Es breve,
y es la parte en la que no debe equivocarse: lo que puede leer, lo que debe
preguntar, lo que nunca debe decidir por las personas, y qué reglas hacen cumplir
las herramientas frente a cuáles solo usted puede cumplir.

## Conectar

Los rieles son un servidor MCP. Agréguelo a la configuración de su cliente MCP:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

El perfil predeterminado son los rieles: seis herramientas — `start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation` y
`explain`. Cada paso de los rieles también es un comando de shell común
(`champollion`, `nmt-forge`, `mt-eval`), por lo que un agente sin MCP puede recorrer
los mismos rieles desde una terminal.

## Puntos de entrada legibles por máquina

- [`/llms.txt`](https://champollion.dev/llms.txt) — el índice de esta documentación.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — la documentación enlazada
  en un solo archivo.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — la puerta de entrada
  como Markdown sin procesar.

## En esta sección

1. [El contrato operativo](/docs/agents/contract) — lea esto primero.
2. [El servidor MCP](/docs/network/getting-started/mcp-server) — ambos perfiles
   y cada herramienta.
3. [Cada comando, paso a paso](/docs/agents/shell) — el recorrido
   completo con comandos.

Las personas a las que ayuda leen [las páginas para las personas](/docs/): palabras sencillas, los
mismos hechos. Cuando les explique algo, esas páginas son el registro
que debe igualar.
