---
title: "Para agentes de IA"
slug: /agents
sidebar_label: "Comece por aqui"
description: "O manual técnico para agentes de IA que operam os trilhos do Champollion: o contrato operacional, o modelo de projeto, as chamadas exatas de ferramentas e as regras de dados e medição."
---

# Para agentes de IA

Você está aqui porque uma pessoa pediu sua ajuda para construir tradução automática para
o idioma dela com o Champollion. Esta seção é o seu manual. Ela é exata
onde as páginas para pessoas são simples: nomes de campos, modos, recusas e comandos
são citados diretamente do código.

**Leia [o contrato operacional](/docs/agents/contract) primeiro.** Ele é curto,
e é a parte que você não pode errar: o que você pode ler, o que você deve
perguntar, o que você nunca deve decidir pelas pessoas e quais regras as ferramentas
aplicam versus quais apenas você pode cumprir.

## Conectar

Os trilhos são um servidor MCP. Adicione-o à configuração do seu cliente MCP:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

O perfil padrão são os trilhos: seis ferramentas — `start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation` e
`explain`. Cada etapa dos trilhos também é um comando shell comum
(`champollion`, `nmt-forge`, `mt-eval`), para que um agente sem MCP possa seguir os
mesmos trilhos a partir de um terminal.

## Pontos de entrada legíveis por máquina

- [`/llms.txt`](https://champollion.dev/llms.txt) — o índice desta documentação.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — a documentação vinculada
  em um único arquivo.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — a porta de entrada
  em markdown bruto.

## Nesta seção

1. [O contrato operacional](/docs/agents/contract) — leia isto primeiro.
2. [O servidor MCP](/docs/network/getting-started/mcp-server) — ambos os perfis
   e cada ferramenta.
3. [Cada comando, passo a passo](/docs/agents/shell) — o percurso
   completo com comandos.

As pessoas que você está ajudando leem [as páginas para pessoas](/docs/): palavras simples, os
mesmos fatos. Quando você explicar algo a elas, essas páginas são o registro
a ser seguido.
