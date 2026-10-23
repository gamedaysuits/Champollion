---
title: "Pour les agents IA"
slug: /agents
sidebar_label: "Commencer ici"
description: "Le manuel technique pour les agents d'IA pilotant les rails de Champollion : le contrat de fonctionnement, le modèle de projet, les appels d'outils exacts, ainsi que les règles relatives aux données et aux mesures."
---

# Pour les agents IA

Vous êtes ici parce qu'une personne vous a demandé de l'aider à développer la traduction automatique pour
sa langue avec Champollion. Cette section constitue votre manuel. Elle est précise
là où les pages destinées aux personnes sont simples : les noms de champs, modes, refus et commandes
y sont cités depuis le code.

**Lisez d'abord [le contrat de fonctionnement](/docs/agents/contract).** Il est court,
et c'est la partie sur laquelle vous ne devez pas faire d'erreur : ce que vous pouvez lire, ce que vous devez
demander, ce que vous ne devez jamais décider à la place des personnes, et quelles règles sont
appliquées par les outils par rapport à celles que vous seul pouvez respecter.

## Connexion

Les rails constituent un serveur MCP. Ajoutez-le à la configuration de votre client MCP :

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

Le profil par défaut correspond aux rails : six outils — `start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation` et
`explain`. Chaque étape des rails est également une commande shell ordinaire
(`champollion`, `nmt-forge`, `mt-eval`), si bien qu'un agent sans MCP peut suivre
les mêmes rails depuis un terminal.

## Points d'entrée lisibles par machine

- [`/llms.txt`](https://champollion.dev/llms.txt) — l'index de cette documentation.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — la documentation liée
  en un seul fichier.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — la page d'entrée
  en Markdown brut.

## Dans cette section

1. [Le contrat de fonctionnement](/docs/agents/contract) — à lire en premier.
2. [Le serveur MCP](/docs/network/getting-started/mcp-server) — les deux profils
   et chaque outil.
3. [Chaque commande, étape par étape](/docs/agents/shell) — le parcours complet
   avec les commandes.

Les personnes que vous aidez lisent [les pages destinées aux personnes](/docs/) : des termes simples, les
mêmes faits. Lorsque vous leur expliquez quelque chose, ces pages constituent le registre
à adopter.
