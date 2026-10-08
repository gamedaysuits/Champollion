---
title: "Serveur MCP — le point d'entrée pour les agents"
sidebar_label: "Serveur MCP"
description: "Connectez un agent IA à Champollion via le Model Context Protocol : 34 outils pour rechercher des langues, parcourir la file d'attente des benchmarks et le registre de corpus, exécuter des évaluations, entraîner et exporter des modèles, et traduire — ainsi que le détail exact de ceux qui requièrent plus qu'un simple npx install."
---

# Serveur MCP — la porte d'entrée pour les agents

`champollion-mcp-server` expose Champollion aux agents IA via le [Model
Context Protocol](https://modelcontextprotocol.io). Si vous êtes un agent, ou si
vous en configurez un, voici la porte d'entrée : **34 outils, 3 ressources et 4 prompts**
via stdio.

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

**Quatorze des 34 outils fonctionnent dès une installation minimale de `npx`, et `translate` fonctionne
dès qu'il dispose d'un moteur. Les dix-neuf autres nécessitent des paquets Python que le paquet npm
n'embarque pas et ne peut pas embarquer.** Ils n'échouent pas silencieusement — chacun renvoie une
erreur exploitable indiquant ce qui manque — mais vous devez en connaître la structure avant
de concevoir votre intégration.

| Outils | Fonctionnent après `npx` ? | Ce dont ils ont besoin en plus |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Oui** — en lecture seule, servis depuis des points de terminaison publics | rien |
| `translate` | **Oui**, avec un moteur | une clé d'API pour le moteur choisi — ou aucune, avec la méthode `local` et un serveur de modèles sur votre propre machine |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Non | le banc d'évaluation — `pipx install mt-eval-harness` |
| les quinze outils `forge_*` | Non | NMT Forge 0.2.0 ou ultérieur — `python3 -m pip install nmt-forge` (ajoutez `'nmt-forge[hf]'` pour entraîner et servir). Il inclut le banc d'évaluation et trouve les fiches de langues par lui-même ; aucun clone requis |

Aucun clone du dépôt n'est requis pour tout cela.

## Ce que font les outils

**Parcourir et chiffrer le travail.** `list_queue` et `get_queue_item` parcourent la file d'attente des benchmarks ouverts — la liste classée des mesures qui amélioreraient le plus la carte. `estimate_cost` évalue le coût d'un ensemble d'exécutions avant que vous ne dépensiez quoi que ce soit.

**Consulter les informations.** `search_languages` recherche dans les fiches de langues par nom,
code, famille ou région, et tolère les fautes d'orthographe. Chaque résultat indique également où
la langue est parlée (pays, point sur la carte, macrorégion) ainsi que ses autres
noms — uniquement les faits pour lesquels sa fiche cite une source, chacun avec cette source, afin
que les langues aux noms similaires puissent être distinguées. Une localisation sans source n'est
jamais affichée ; la ligne l'indique et fournit à la place un lien vers la notice Glottolog de la langue.
Les fiches complétées à partir des tables de fiches publiées de champollion.dev (dans une
installation npm, chaque langue en dehors de l'ensemble de base fourni) ne comportent pas encore
de sources champ par champ — elles arriveront avec la prochaine mise en ligne des tables — ces
lignes comportent donc le lien Glottolog plutôt qu'une localisation. `language_overview` est le
point de départ en une page pour concevoir pour une langue : ce qui existe, ce qui peut
s'exécuter et les étapes suivantes. `get_language` renvoie la fiche sourcée complète.
`list_corpora` liste les corpus d'évaluation
enregistrés pour une paire de langues ou une famille de benchmarks — métadonnées uniquement (taille,
licence, niveau de contamination, et si le banc d'évaluation peut le récupérer, a besoin d'un
jeton d'accès ou le place en quarantaine) ; le contenu du corpus n'est jamais renvoyé,
et une paire dont tous les corpus sont en quarantaine le signale au lieu de paraître
non prise en charge. `get_results` et `get_run_card` lisent les exécutions scorées
depuis le classement public. `get_metric_reliability` répond à la question à laquelle la plupart
des agents échouent — *à quelle métrique dois-je faire confiance pour cette langue cible* —
à partir des corrélations avec les jugements humains par famille de langues. `list_contests`
et `get_contest` affichent les concours et leurs conditions déclarées ; s'inscrire à l'un d'eux est une
étape CLI autorisée par un humain, jamais un outil.

**Agir.** `translate` soumet le texte au pipeline testé, avec mémoire de
traduction (les répétitions ne coûtent rien) et une barrière de qualité déterministe. Chaque réponse
nomme le moteur qui s'est réellement exécuté, avec son modèle et son point de terminaison lorsqu'il en dispose.
`run_benchmark` démarre une évaluation et renvoie **immédiatement un identifiant de tâche**,
car les véritables exécutions dépassent tout délai d'expiration client ; vous interrogez `get_run_status` avec
cet identifiant. Une tâche survit à un redémarrage du serveur : l'exécution se poursuit, et
interroger le même identifiant par la suite renvoie toujours son statut et ses résultats. Rien
n'est publié à moins de passer `publish: true` ; le plan indique alors ce qui serait rendu
public — chaque ligne avec le texte de sa phrase, ou seulement les scores ; l'invite, ou seulement
son hachage ; et où — et une publication réelle requiert `publish_ack` avec les mots
exacts fournis par le plan, afin que l'utilisateur les ait vus au préalable. Une exécution effectuée sans cela
peut être publiée ultérieurement, derrière la même barrière. `preview_publish` est en lecture seule :
il affiche l'aperçu de publication propre au banc d'évaluation, les mots exacts et l'appel
`publish_report` exact qui le publierait, et il ne peut pas publier. Il
porte l'annotation MCP `readOnlyHint: true`, de sorte qu'un hôte d'agent qui demande confirmation
avant chaque écriture peut l'autoriser de manière autonome. `publish_report` effectue l'écriture
(annoté `destructiveHint` et `openWorldHint`), et `scores_only`
retient le texte des phrases. Chaque plan s'ouvre également sur le statut
`EVAL PACK:` de la langue cible — `missing` (avec la commande qui
l'installe), `ready` ou `none needed` — et nomme la licence du corpus ainsi que sa
clause `do_not_train`, car l'exécution transmet `--yes`. Un FST manquant (l'analyseur
ou son runtime pyhfst) n'interrompt jamais l'exécution : elle se poursuit, et la fiche
d'exécution indique que l'acceptation FST n'est pas calculée. Tout autre élément manquant interrompt l'exécution
avant qu'elle ne traduise. `skip_fst` et `skip_eval_standard` évaluent sans ces
éléments, et la fiche d'exécution signale ce qui a été omis. Le plan indique également si
COMET sera calculé (le banc d'évaluation le calcule dès que `unbabel-comet` est
installé ; `comet: true` impose que l'exécution l'exige), et `metricx` et `fuse`
demandent MetricX-24 et le comparateur de type FUSE optionnels du banc d'évaluation. Pour chacun
d'eux, le plan indique, d'après le banc d'évaluation, s'il est installé, ce qu'il faut installer
et ce qu'il télécharge. Une exécution confirmée qui demande une métrique que le banc d'évaluation
ne peut pas calculer est refusée plutôt qu'exécutée sans elle. Les lignes `Results:`
et `Cache:` du plan indiquent où aboutissent le journal d'exécution, le rapport et le cache de traduction.
Un fichier de test situé dans un dossier que `mt-eval contest prepare` marque comme publiable
(le `public/` d'un concours) s'exécute à la place dans le dossier `runs/` du concours, afin
que rien de ce qu'une exécution écrit ne soit publié avec lui. Un modèle sur votre propre
machine (un serveur local ou `method: "local-model"`, que le banc d'évaluation exécute
dans le processus et qui ne nécessite aucune attestation) est signalé comme `$0 API cost (runs on
this machine)`.

**Entraîner sans se leurrer.** `get_training_guardrails` renvoie les règles
extraites de défaillances réelles et mesurées. Les quinze outils `forge_*` exécutent
[NMT Forge](/docs/network/getting-started/training-honestly) une étape contrôlée
à la fois — `forge_status` d'abord et après chaque étape (il indique la commande
suivante et l'outil qui l'exécute), `forge_preflight` pour voir quelles barrières de contrôle une
commande rencontrera avant de refuser, `forge_prereg_template` et `forge_prereg`
pour consigner les prédictions avant qu'un quelconque score de test n'existe (et avant tout
benchmark sur le jeu de test : une lecture de score bloque tout pré-enregistrement ultérieur),
`forge_export` pour évaluer le jeu de test une seule fois et packager le modèle entraîné,
`forge_compare` pour comparer en A/B deux modèles avec la mise en garde relative aux quasi-doublons de chacun à côté
du vainqueur, et
`forge_prereg_verdict` pour consigner le verdict de l'utilisateur sur une prédiction que Forge
ne peut pas juger (une plage de texte libre) — affiché comme un verdict humain, jamais comme un
verdict calculé. `forge_status` liste chaque exécution entraînée avec son score de dev et
indique lorsqu'un jeu de dev est saturé (un score de dev parfait ne laissant rien pour
départager lors de la sélection des points de contrôle). Lorsque le banc d'évaluation émet une réserve
sur un score de test (par exemple une sortie quasi constante : une poignée de sorties
fournies pour chaque phrase source), `forge_export`, `forge_status`,
`forge_compare` et `forge_lint` la transmettent dans les termes mêmes du banc, et une
réserve majeure apparaît en premier à l'étape suivante : le score n'est jamais cité sans
celle-ci. Un refus est renvoyé
avec ce qui n'a pas fonctionné, pourquoi cela importe et la solution. Deux étapes dépassent la durée de vie de tout appel
d'outil et s'exécutent plutôt dans un terminal : l'entraînement (`nmt-forge run`) et la mise à disposition du
modèle exporté (`nmt-forge serve`, qui le place derrière un point de terminaison local utilisable
par `translate` et la CLI).

### Arguments

`name` est obligatoire et `name?` est facultatif. Chaque outil qui prend une
langue l'accepte également sous le nom de `language` : « `code` ou `language` » signifie que l'un ou l'autre
nom fonctionne, et vous en transmettez un seul. Les noms d'origine continuent de fonctionner.

| Outil | Arguments |
|---|---|
| `search_languages` | `query` ou `language`, `limit?` |
| `language_overview` | `code` ou `language`, `source?` |
| `get_language` | `code` ou `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (au moins l'un de ces trois), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` ou `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | aucun |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` ou `priority?` (l'un d'entre eux) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (un msgctxt gettext : un pour chaque texte, ou un par texte), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | un mode : `budget?` ou `top?` (file d'attente), `item_id?`, ou `corpus?` avec `model?` (avec `method_dir`, le modèle chargé par le plugin), `method?` ou `method_dir?` (un répertoire de plugin de méthode ; `local-model` nécessite `model` — il n'a pas de valeur par défaut), `allow_model_pair_mismatch?` (`local-model` : exécuter un modèle de paire OPUS-MT qui nomme une autre paire, comme référence de langue apparentée), `attest_local_transport?` (un moteur de TA ou un plugin ; jamais requis pour `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (exécutions LLM : l'écriture ISO 15924 dans laquelle la sortie doit être rédigée, telle que `Cans` ou `Latn` ; le plan indique quand la fiche de la cible en liste plusieurs), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` et `skip_eval_standard?` (exécutions d'éléments et de corpus : évaluer sans le FST ou les métriques standard d'évaluation, marqués non calculés), `comet?` (exiger COMET : l'exécution est refusée tant qu'il n'est pas installé), `metricx?` avec `metricx_model?`, et `fuse?` (exécutions d'éléments et de corpus : MetricX-24 et le comparateur de type FUSE optionnels du banc d'évaluation, refusés tant qu'ils ne sont pas installés) ; puis `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (avec une publication réelle : les mots exacts affichés par le plan), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (le `*_report.json` d'une exécution terminée), `scores_only?`, `redact_coaching?`, `anonymous?` (en lecture seule : pas de `confirm`, il ne peut pas publier) |
| `publish_report` | `report` (le `*_report.json` d'une exécution terminée), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (les mots exacts affichés par l'aperçu) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (la commande à vérifier), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` ou `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` ou `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (par défaut `data/split`, le chemin lu par le config.json de `forge_init`), `dev?`, `register?` (un préfixe de nom, ou `true` pour `project`), `allow_rotate?`, `near_dupe?` (un seuil de Jaccard tel que 0,6, lorsque Forge recommande l'extraction des quasi-doublons), `max_group?` (avec `near_dupe` : le plus grand groupe de quasi-doublons), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (avec son propre `clean_to`, par ex. `corpus.notwins.jsonl` — jamais le fichier de toutes les données), `companion_config?` (avec `drop_test_twins` : emplacement de la configuration du modèle sans doublons ; par défaut `config-notwins.json`), `overwrite?` (remplace un fichier `clean_to` utilisé par une configuration, une exécution, un split ou un autre audit — refusé sans cela), `full_indices?` (chaque liste de numéros de ligne au complet ; par défaut, les longues listes sont renvoyées sous la forme `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (l'épingler à une seule exécution), `allow_after_reads?` (uniquement pour les prédictions écrites avant les lectures scorées de l'ensemble), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (son numéro ou son propre identifiant), `verdict` (`held` ou `missed`), `by` (qui a jugé), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (le manifeste d'exécution de chaque modèle : ses données d'entraînement sont vérifiées pour détecter les quasi-doublons), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Par exemple, `get_metric_reliability { "language": "crk" }` et
`get_metric_reliability { "target": "crk" }` posent la même question.

### Traduire avec un modèle déployé par vos soins

`nmt-forge serve` affiche deux adresses pour le modèle qu'il sert. Pointez
`translate` vers l'une ou l'autre :

| Argument | À utiliser avec | Exemple |
|---|---|---|
| `base_url` | `method: "local"` — un serveur compatible OpenAI (également `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — le contrat d'API Champollion | `http://127.0.0.1:8378/translate` |
| `model` | Moteurs LLM uniquement ; refusé pour les API de traduction automatique, qui n'en ont pas | `llama3.1` |
| `project_dir` | Toute méthode — utiliser la mémoire de traduction de ce projet | `~/my-app` |

Un serveur sur votre propre machine ne nécessite aucune clé. Un point de terminaison distant `api` lit sa
clé depuis `CHAMPOLLION_API_KEY` dans l'environnement du serveur. L'outil refuse
tout argument qu'il ne reconnaît pas, en le nommant, au lieu de l'ignorer, évitant ainsi qu'une faute
de frappe dans un argument n'envoie discrètement votre texte à un autre modèle.

### Où le serveur conserve son état

Tout réside dans `~/.champollion-mcp/` (définissez `CHAMPOLLION_MCP_HOME` pour le
déplacer) :

- **La mémoire de traduction de `translate`** dispose de son propre fichier,
  `.champollion/tm.json` dans ce dossier. Elle est distincte du fichier `.champollion/tm.json`
  de tout projet. Passez `project_dir` pour utiliser à la place le fichier d'un projet,
  celui que `champollion sync` y utilise.
- **Les tâches de `run_benchmark`** sont enregistrées dans `jobs.json`, qui conserve les
  50 plus récentes. Chaque tâche dispose d'un dossier dans `jobs/` contenant sa sortie et, pour un
  élément de file d'attente ou un corpus enregistré, les résultats du banc d'évaluation. Une exécution sur un fichier
  de test en votre possession écrit ses résultats et son cache à côté de ce fichier, dans
  `results/` — à l'exception d'un fichier situé dans un dossier que `mt-eval contest prepare`
  marque comme publiable, dont l'exécution écrit dans le dossier `runs/` du concours.
  Les exécutions de file d'attente écrivent leurs rapports dans `eval/logs/harness/queue/` sous le
  dossier de travail du serveur, comme le fait toujours le banc d'évaluation.

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

## Étapes suivantes

- [Guide de l'agent — construction et benchmarking](/docs/network/getting-started/agent-guide)
- [Guide de l'agent — traduction avec la CLI](/docs/guides/agent-guide)
- [Soumettre une méthode](/docs/network/getting-started/submit-a-method)
