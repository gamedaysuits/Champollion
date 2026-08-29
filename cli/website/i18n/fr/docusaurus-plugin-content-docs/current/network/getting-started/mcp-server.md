---
title: "Serveur MCP — le point d'entrée pour les agents"
sidebar_label: "Serveur MCP"
description: "Connectez un agent IA à Champollion via le Model Context Protocol : 23 outils pour traduire, parcourir la file d'attente des benchmarks, exécuter des évaluations et entraîner des modèles — avec des précisions sur ceux qui nécessitent plus qu'un npx install."
---

# Serveur MCP — la porte d'entrée pour les agents

`champollion-mcp-server` expose Champollion aux agents d'IA via le [Model Context Protocol](https://modelcontextprotocol.io). Si vous êtes un agent, ou si vous en configurez un, voici la porte d'entrée : **23 outils, 3 ressources et 3 prompts** via stdio.

Tout ce qui se trouve ici est également accessible en HTTP simple — voir [Points de terminaison lisibles par machine](#machine-readable-endpoints) — mais le serveur MCP est la seule surface qui permet à un agent d'*agir* (traduire, exécuter un benchmark, entraîner un modèle) plutôt que de simplement lire.

## Installation

```bash
npx -y champollion-mcp-server
```

Ensuite, enregistrez-le auprès de votre client. Pour Claude Code :

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Pour les clients configurés par fichier (Claude Desktop, Cursor, Antigravity), ajoutez :

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

## À lire avant de vous y fier

**Neuf des 23 outils fonctionnent à partir d'une installation `npx` de base. Les quatorze autres nécessitent des logiciels que le paquet npm ne fournit pas et ne peut pas fournir.** Ils n'échouent pas silencieusement — chacun renvoie une erreur exploitable indiquant ce qui manque — mais vous devez en connaître la structure avant de planifier en conséquence.

| Outils | Fonctionnent après `npx` ? | Ce dont ils ont besoin en plus |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **Oui** — en lecture seule, servis depuis des points de terminaison publics | rien |
| `translate` | Non | la CLI `champollion` (`npm i -g champollion`) et une clé d'API |
| `run_benchmark`, `get_run_status` | Non | le harnais d'évaluation — `pipx install mt-eval-harness` |
| les onze outils `forge_*` | Non | un clone du monorepo avec `CHAMPOLLION_FORGE_DIR` défini sur son répertoire `forge/` ; l'évaluation nécessite également `mt-eval` |

Si vous souhaitez disposer de toute la surface, clonez le dépôt plutôt que de vous fier à `npx`.

## Ce que font les outils

**Parcourir et chiffrer le travail.** `list_queue` et `get_queue_item` parcourent la file d'attente des benchmarks ouverts — la liste classée des mesures qui amélioreraient le plus la carte. `estimate_cost` évalue le coût d'un ensemble d'exécutions avant que vous ne dépensiez quoi que ce soit.

**Rechercher des informations.** `search_languages` recherche les fiches de langues par nom, code, famille ou région. `get_results` et `get_run_card` lisent les exécutions évaluées à partir du classement public. `get_metric_reliability` répond à la question sur laquelle la plupart des agents se trompent — *à quelle métrique dois-je me fier pour cette langue cible* — à partir des corrélations avec les jugements humains par famille de langues.

**Agir.** `translate` fait passer le texte par le pipeline testé, avec une mémoire de traduction (les répétitions ne coûtent rien) et une barrière de qualité déterministe. `run_benchmark` lance une évaluation et renvoie **immédiatement un identifiant de tâche (job id)**, car les exécutions réelles durent plus longtemps que n'importe quel délai d'attente du client ; vous interrogez `get_run_status` avec cet identifiant.

**S'entraîner sans se leurrer.** `get_training_guardrails` renvoie les règles extraites des échecs réels mesurés. Les onze outils `forge_*` exécutent [NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status` en premier et après chaque étape, `forge_preflight` pour voir quelles barrières une commande va heurter avant qu'elle ne refuse.

:::note[Les dépenses sont limitées par conception]
`run_benchmark` **refuse une exécution de file d'attente non limitée.** Vous devez transmettre exactement une limite — `budget`, `top`, ou un `item_id` spécifique. Il n'y a pas d'appel du type "exécuter simplement la file d'attente", car un agent qui comprendrait mal la file d'attente pourrait autrement dépenser sans limite.
:::

## Version du protocole

Le transport se fait **uniquement via stdio** — un processus serveur par agent.

La [révision du 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) de MCP a rendu le protocole sans état par défaut, retirant le handshake `initialize` et l'en-tête `Mcp-Session-Id`. La conception de ce serveur n'est pas affectée : il n'utilise aucune des capacités obsolètes (Roots, Sampling, Logging), n'a jamais utilisé le transport hérité HTTP+SSE, et suit déjà les nouvelles directives pour l'état inter-appels — `run_benchmark` crée un identifiant de tâche explicite que le modèle renvoie, plutôt que de s'appuyer sur une session de transport.

Il n'a **pas** été mis à niveau vers la nouvelle révision, car aucun SDK TypeScript publié ne la prend encore en charge. Consultez le [README du serveur](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) pour connaître la position complète.

## Points de terminaison lisibles par machine

Aucun client MCP n'est nécessaire pour ceux-ci :

| Point de terminaison | Description |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | La [porte d'entrée pour les agents](/for-agents), en markdown brut |
| [`/llms.txt`](https://champollion.dev/llms.txt) | L'index organisé de ce site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Chaque page indexée, intégrée |
| [`/queue.json`](https://champollion.dev/queue.json) | La file d'attente complète des benchmarks |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Les premiers éléments de la file d'attente |
| [`/registry.json`](https://champollion.dev/registry.json) | Le registre des corpus |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Le graphe des langues mesurées |

## Prochaines étapes

- [Guide de l'agent — construction et benchmarking](/docs/network/getting-started/agent-guide)
- [Guide de l'agent — traduction avec la CLI](/docs/guides/agent-guide)
- [Soumettre une méthode](/docs/network/getting-started/submit-a-method)
