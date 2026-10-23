---
title: "Serveur MCP — la porte d'entrée dédiée aux agents"
sidebar_label: "Serveur MCP"
description: "Connectez un agent IA à Champollion via le Model Context Protocol. Deux profils : le profil rails (par défaut) accompagne un projet linguistique unique grâce à six outils ; --profile full met à disposition 34 outils pour rechercher des langues, parcourir la file d'attente des benchmarks et le registre des corpus, exécuter des évaluations, entraîner et exporter des modèles, et traduire — tout en précisant exactement ceux qui nécessitent plus qu'un simple npx install."
---

# Serveur MCP — la porte d'entrée pour les agents

`champollion-mcp-server` expose Champollion aux agents IA via le [Model
Context Protocol](https://modelcontextprotocol.io), sur stdio. Il comporte deux
profils :

| Profil | Démarrage | Ce qu'il fournit | Conçu pour |
|---|---|---|---|
| **rails** (par défaut) | `npx -y champollion-mcp-server` | six outils : `start_project`, `project_status`, `run_next_step`, `add_data`, `try_translation`, `explain` | guider un projet linguistique depuis un dossier vide jusqu'à un modèle évalué sur l'ordinateur de la personne, étape par étape |
| **full** | `npx -y champollion-mcp-server --profile full` (ou `CHAMPOLLION_MCP_PROFILE=full`) | 34 outils, 3 ressources et 4 prompts | la découverte, l'évaluation comparative, l'entraînement pas à pas, la traduction et le réseau |

Si vous aidez quelqu'un à concevoir un traducteur pour sa langue, utilisez le
profil rails ; la manière de le piloter est détaillée dans [Piloter les rails via
MCP](/docs/agents/mcp), et les règles auxquelles vous êtes soumis figurent dans [le
contrat d'exploitation](/docs/agents/contract).

Tout ce qui figure ici est également accessible en simple HTTP — voir les [Points de
terminaison lisibles par machine](#machine-readable-endpoints) — mais le serveur MCP est la seule interface
qui permet à un agent d'*agir* (traduire, exécuter un banc d'essai, entraîner un modèle) plutôt que de
simplement lire.

## Installation

```bash
npx -y champollion-mcp-server
```

Enregistrez-le ensuite auprès de votre client. Pour Claude Code :

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

Pour le profil complet (full), ajoutez `"--profile", "full"` après le nom du paquet dans
`args`, ou terminez la commande `claude mcp add` par `--profile full`.

## Le profil rails (par défaut)

Les six outils guident un projet linguistique depuis un dossier vide jusqu'à un
modèle évalué sur l'ordinateur de la personne. Chaque étape indique précisément quel outil appeler,
et chaque question à laquelle seule la personne peut répondre (qui détient un fichier, si un
modèle peut s'entraîner à partir de celui-ci, si son texte peut quitter l'ordinateur, ce que
la personne attend, si le résultat est satisfaisant) lui est soumise en retour. Les outils
rapportent des décomptes et des colonnes, jamais des phrases. Chaque outil pilote la
ligne de commande `champollion` sous la forme d'un processus distinct et borné — les mêmes commandes qu'une
personne saisit. Ce profil est conçu pour de petits agents, avec des instructions courtes.

| Outil | Arguments | Description |
|---|---|---|
| `start_project` | `folder`, `from`, `to`, `target_name?`, `source_name?`, `purpose?`, `parent_dir?`, `confirmed?` | Crée un projet (`champollion new`). Le premier appel ne crée rien et renvoie `ask_first` : répétez la direction à la personne, puis effectuez l'appel qu'il indique en fonction de sa réponse |
| `project_status` | `project_dir`, `wait_seconds?` (jusqu'à 120) | L'étape suivante, lue à partir des fichiers (`champollion next --json`) : son mode, ce qu'il faut dire, pourquoi, et l'appel exact qui l'exécute |
| `run_next_step` | `project_dir`, `step_id`, `answers?`, `confirmed?` | Exécute l'étape que `project_status` vient de désigner. Une étape `confirm` nécessite `confirmed: true` après que la personne a accepté ; une étape `ask_user` requiert les propres réponses de la personne ; les étapes `human_only` et `wait` sont refusées en indiquant la marche à suivre alternative |
| `add_data` | `project_dir`, `path`, `into?` (`parallel`, `test` ou `lexicon`), `source_col?`, `target_col?`, `sheet?`, `header?`, `usfm_source?`, `replace?` | Importe un fichier là où il se trouve — une feuille de calcul, un tableau Word, un dictionnaire Toolbox ou LIFT, un fichier ELAN ou des écritures USFM (`champollion data add`) — et rapporte des décomptes et des colonnes, jamais des phrases |
| `try_translation` | `project_dir`, `text` (jusqu'à 10 lignes) | Traduit quelques phrases de la personne avec le modèle fourni par le projet. Pour un modèle entraîné sur des phrases strictement locales, il renvoie l'adresse de la propre page du modèle, jamais le texte |
| `explain` | `topic` : `rails`, `privacy`, `quality`, `modes`, `improve` ou `off_rails` | Explications en langage simple à transmettre |

## Le profil complet (full)

Tout ce qui suit décrit le **profil complet (full)** — l'ensemble des outils, pour la découverte,
l'évaluation comparative et le réseau :

```bash
npx -y champollion-mcp-server --profile full
```

## À lire avant de vous y fier

**Dans le profil complet, quatorze des 34 outils fonctionnent à partir d'une simple installation `npx`, et `translate` fonctionne
dès qu'il dispose d'un moteur. Les dix-neuf autres nécessitent des paquets Python que le paquet npm
ne fournit pas et ne peut pas fournir.** Ils n'échouent pas silencieusement — chacun renvoie une
erreur exploitable précisant ce qui manque — mais vous devez en connaître la configuration avant
d'organiser votre travail en conséquence.

| Outils | Fonctionnent après `npx` ? | Ce dont ils ont besoin en plus |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Oui** — en lecture seule, servis depuis des points de terminaison publics | rien |
| `translate` | **Oui**, avec un moteur | une clé d'API pour le moteur choisi — ou aucune, avec la méthode `local` et un serveur de modèles sur votre propre machine |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Non | le banc d'évaluation — `pipx install mt-eval-harness` |
| les quinze outils `forge_*` | Non | NMT Forge 0.2.0 ou ultérieur — `python3 -m pip install nmt-forge` (ajoutez `'nmt-forge[hf]'` pour entraîner et servir). Il intègre le banc d'évaluation et repère les fiches de langues par lui-même ; aucun clonage requis |

Aucun clonage du dépôt n'est nécessaire pour tout cela.

## Rôle des outils

**Explorer et estimer le coût des travaux.** `list_queue` et `get_queue_item` parcourent la file
d'attente ouverte d'évaluation comparative — la liste ordonnée des mesures qui amélioreraient le plus
la cartographie. `estimate_cost` chiffre un ensemble d'exécutions avant toute dépense.

**Consulter les informations.** `search_languages` recherche dans les fiches de langues par nom,
code, famille ou région, et tolère les fautes d'orthographe. Chaque résultat indique également où
la langue est parlée (pays, point sur la carte, macrorégion) ainsi que ses autres
noms — uniquement les faits pour lesquels sa fiche cite une source, chacun avec cette source, afin
de pouvoir distinguer les langues aux noms similaires. Une localisation sans source n'est
jamais affichée ; la ligne l'indique et renvoie vers la notice Glottolog de la langue
à la place. Les fiches renseignées à partir des tables de fiches publiées de champollion.dev (dans une
installation npm, toute langue hors du jeu de base fourni) ne comportent pas encore
de sources champ par champ — celles-ci arriveront avec la prochaine mise en ligne des tables — si bien que ces
lignes contiennent le lien Glottolog plutôt qu'une localisation. `language_overview` constitue le
point de départ sur une page pour développer un modèle pour une langue : ce qui existe, ce qui peut
s'exécuter et les étapes suivantes. `get_language` renvoie la fiche complète avec ses sources.
`list_corpora` répertorie les corpus d'évaluation enregistrés pour une paire de langues ou une famille
d'évaluation comparative — métadonnées uniquement (taille, licence, degré de contamination, et si le banc
peut le récupérer, nécessite un jeton d'accès ou le conserve en quarantaine) ; le contenu du corpus n'est
jamais renvoyé, et une paire dont tous les corpus sont en quarantaine l'indique au lieu de paraître
non prise en charge. `get_results` et `get_run_card` lisent les exécutions évaluées depuis
le classement public. `get_metric_reliability` répond à la question sur laquelle la plupart des agents
se trompent — *à quelle métrique dois-je me fier pour cette langue cible* — à partir des corrélations
avec les jugements humains par famille linguistique. `list_contests` et `get_contest` affichent les
concours et leurs conditions déclarées ; s'inscrire à un concours est une étape en CLI autorisée par un
humain, jamais un outil.

**Agir.** `translate` soumet le texte au pipeline testé, avec mémoire de traduction
(les répétitions ne coûtent rien) et un contrôle de qualité déterministe. Chaque réponse
nomme le moteur qui a réellement tourné, avec son modèle et son point de terminaison lorsqu'il en dispose.
`run_benchmark` lance une évaluation et renvoie **immédiatement un identifiant de tâche**,
car les exécutions réelles dépassent tout délai d'expiration côté client ; vous interrogez `get_run_status` avec
cet identifiant. Une tâche survit à un redémarrage du serveur : l'exécution se poursuit, et
interroger le même identifiant par la suite renvoie toujours son état et ses résultats. Rien
n'est publié à moins de transmettre `publish: true` ; le plan indique alors ce qui serait rendu
public — chaque ligne avec le texte de sa phrase, ou seulement les scores ; l'invite, ou seulement
son empreinte ; et où — et une publication réelle exige `publish_ack` selon les termes exacts
fournis par le plan, afin que l'utilisateur les ait d'abord vus. Une exécution effectuée sans ce paramètre
peut être publiée ultérieurement, derrière le même contrôle. `preview_publish` est en lecture seule :
il affiche l'aperçu de publication propre au banc, les mots exacts et l'appel `publish_report`
précis qui la publierait, et il ne peut pas publier. Il porte l'annotation MCP `readOnlyHint: true`,
afin qu'un hôte d'agent qui demande confirmation avant chaque écriture puisse l'autoriser de lui-même. `publish_report` effectue l'écriture
(avec les annotations `destructiveHint` et `openWorldHint`), et `scores_only`
omet le texte des phrases. Chaque plan commence également par l'état `EVAL PACK:`
de la langue cible — `missing` (avec la commande qui l'installe), `ready` ou `none needed` — et mentionne la licence du corpus ainsi que sa
condition `do_not_train`, car l'exécution transmet `--yes`. L'absence de FST (l'analyseur
ou son environnement d'exécution pyhfst) n'interrompt jamais l'exécution : elle se poursuit, et la fiche
d'exécution indique que l'acceptation FST n'a pas été calculée. Tout autre élément manquant interrompt l'exécution
avant la traduction. `skip_fst` et `skip_eval_standard` calculent les scores sans ces
éléments, et la fiche d'exécution indique ce qui a été omis. Le plan précise également si
COMET sera calculé (le banc le calcule dès que `unbabel-comet` est
installé ; `comet: true` rend son calcul obligatoire pour l'exécution), et `metricx` et `fuse`
demandent l'activation optionnelle de MetricX-24 et du comparateur de type FUSE du banc. Pour chacun
d'eux, le plan indique, d'après le banc, s'il est installé, ce qu'il faut installer
et ce qu'il télécharge. Une exécution confirmée qui demande une métrique que le banc
ne peut pas calculer est refusée plutôt que lancée sans elle. Les lignes `Results:`
et `Cache:` du plan précisent où aboutissent le journal d'exécution, le rapport et le cache de traduction.
Un fichier de test situé dans un dossier que `mt-eval contest prepare` marque comme publiable
(le `public/` d'un concours) s'exécute plutôt dans le dossier `runs/` du concours, de sorte que
rien de ce qu'une exécution écrit n'est publié avec lui. Un modèle présent sur votre propre
machine (un serveur local, ou `method: "local-model"`, que le banc exécute
au sein du processus et qui n'exige aucune attestation) est signalé comme `$0 API cost (runs on
this machine)`.

**S'entraîner sans se faire d'illusions.** `get_training_guardrails` renvoie les règles
extraites d'échecs réels mesurés. Les quinze outils `forge_*` exécutent
[NMT Forge](/docs/agents/training) une étape sécurisée
à la fois — `forge_status` en premier et après chaque étape (il indique la prochaine
commande et l'outil qui l'exécute), `forge_preflight` pour voir quels garde-fous une
commande rencontrera avant de refuser, `forge_prereg_template` et `forge_prereg`
pour consigner les prédictions avant qu'aucun score de test n'existe (et avant toute
évaluation sur le jeu de test : une lecture de score bloque tout pré-enregistrement ultérieur),
`forge_export` pour évaluer le jeu de test une seule fois et empaqueter le modèle entraîné,
`forge_compare` pour comparer deux modèles en test A/B en affichant l'avertissement de quasi-doublon de chacun aux côtés
du vainqueur, et
`forge_prereg_verdict` pour enregistrer le propre verdict de l'utilisateur sur une prédiction que forge
ne peut pas juger (un intervalle de texte libre) — présenté comme un verdict humain, jamais comme un
verdict calculé. `forge_status` liste chaque exécution entraînée avec son score de dev et
indique quand un jeu de dev est saturé (un score de dev parfait sans rien pour
départager les points de contrôle). Lorsque le banc d'évaluation assortit un score de test d'une réserve
(par exemple une sortie quasi constante : une poignée de sorties
fournies pour chaque phrase source), `forge_export`, `forge_status`,
`forge_compare` et `forge_lint` la transmettent dans les termes propres du banc, et une
réserve majeure apparaît en tête de l'étape suivante : le score n'est jamais cité sans
celle-ci. Tout refus est renvoyé
avec ce qui a échoué, pourquoi cela importe et la solution. Deux étapes dépassent la durée d'un
appel d'outil et s'exécutent plutôt dans un terminal : l'entraînement (`nmt-forge run`) et le déploiement du
modèle exporté (`nmt-forge serve`, qui le place derrière un point de terminaison local que
`translate` et le CLI peuvent utiliser).

### Arguments

`name` est obligatoire et `name?` est facultatif. Tout outil qui accepte une
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
| `get_queue_item` | `id?` ou `priority?` (l'un d'eux) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (un msgctxt gettext : un pour tous les textes, ou un par texte), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | un mode : `budget?` ou `top?` (file d'attente), `item_id?`, ou `corpus?` avec `model?` (avec `method_dir`, le modèle chargé par le plugin), `method?` ou `method_dir?` (un répertoire de plugin de méthode ; `local-model` nécessite `model` — il n'a pas de valeur par défaut), `allow_model_pair_mismatch?` (`local-model` : exécuter un modèle de paire OPUS-MT désignant une autre paire, comme référence de langue apparentée), `attest_local_transport?` (un moteur de TA ou un plugin ; jamais requis pour `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (exécutions LLM : l'écriture ISO 15924 dans laquelle la sortie doit être rédigée, telle que `Cans` ou `Latn` ; le plan indique quand la fiche de la cible en liste plusieurs), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` et `skip_eval_standard?` (exécutions d'éléments et de corpus : calculer les scores sans le FST ni les métriques d'évaluation standard, marqués comme non calculés), `comet?` (exiger COMET : l'exécution est refusée tant qu'il n'est pas installé), `metricx?` avec `metricx_model?`, et `fuse?` (exécutions d'éléments et de corpus : activation optionnelle de MetricX-24 et du comparateur de type FUSE du banc, refusés tant qu'ils ne sont pas installés) ; puis `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (avec une publication réelle : les mots exacts affichés par le plan), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (le `*_report.json` d'une exécution terminée), `scores_only?`, `redact_coaching?`, `anonymous?` (lecture seule : aucun `confirm`, il ne peut pas publier) |
| `publish_report` | `report` (le `*_report.json` d'une exécution terminée), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (les mots exacts affichés par l'aperçu) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (la commande à vérifier), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` ou `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` ou `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (par défaut `data/split`, le chemin lu par le config.json de `forge_init`), `dev?`, `register?` (un préfixe de nom, ou `true` pour `project`), `allow_rotate?`, `near_dupe?` (un seuil de Jaccard tel que 0,6, quand forge recommande l'extraction des quasi-doublons), `max_group?` (avec `near_dupe` : le plus grand groupe de quasi-doublons), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (avec son propre `clean_to`, par ex. `corpus.notwins.jsonl` — jamais le fichier de toutes les données), `companion_config?` (avec `drop_test_twins` : emplacement où va la configuration du modèle sans doublons ; par défaut `config-notwins.json`), `overwrite?` (remplace un fichier `clean_to` utilisé par une configuration, une exécution, une division ou un autre audit — refusé sans ce paramètre), `full_indices?` (chaque liste de numéros de lignes au complet ; par défaut, les longues listes sont renvoyées sous la forme `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (le rattacher à une seule exécution), `allow_after_reads?` (uniquement pour les prédictions enregistrées avant les lectures de scores du jeu), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (son numéro, ou son propre identifiant), `verdict` (`held` ou `missed`), `by` (qui a jugé), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (le manifeste d'exécution de chaque modèle : ses données d'entraînement sont analysées à la recherche de quasi-doublons), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Par exemple, `get_metric_reliability { "language": "crk" }` et
`get_metric_reliability { "target": "crk" }` posent la même question.

### Traduire avec un modèle que vous avez déployé

`nmt-forge serve` affiche deux adresses pour le modèle qu'il dessert. Pointez
`translate` vers l'une ou l'autre :

| Argument | À utiliser avec | Exemple |
|---|---|---|
| `base_url` | `method: "local"` — un serveur compatible OpenAI (également `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — le contrat d'API champollion | `http://127.0.0.1:8378/translate` |
| `model` | moteurs LLM uniquement ; refusé pour les API de traduction automatique, qui n'en ont pas | `llama3.1` |
| `project_dir` | toute méthode — utilise la mémoire de traduction de ce projet | `~/my-app` |

Un serveur situé sur votre propre machine ne nécessite aucune clé. Un point de terminaison distant `api` lit sa
clé depuis `CHAMPOLLION_API_KEY` dans l'environnement du serveur. L'outil refuse
tout argument qu'il ne reconnaît pas, en le nommant, au lieu de l'ignorer, évitant ainsi qu'une
erreur d'orthographe dans un argument n'envoie discrètement votre texte à un autre modèle.

### Emplacement de l'état du serveur

Tout réside dans `~/.champollion-mcp/` (définissez `CHAMPOLLION_MCP_HOME` pour le
déplacer) :

- **La mémoire de traduction de `translate`** est un fichier distinct,
  `.champollion/tm.json` dans ce dossier. Elle est séparée du `.champollion/tm.json` de tout
  projet. Transmettez `project_dir` pour utiliser à la place le fichier d'un projet,
  celui que `champollion sync` y utilise.
- **Les tâches de `run_benchmark`** sont enregistrées dans `jobs.json`, qui conserve les
  50 plus récentes. Chaque tâche dispose d'un dossier dans `jobs/` contenant sa sortie et, pour un
  élément de file d'attente ou un corpus enregistré, les résultats du banc. Une exécution sur un fichier
  de test que vous détenez écrit ses résultats et son cache à côté de ce fichier, dans
  `results/` — sauf pour un fichier situé dans un dossier que `mt-eval contest prepare`
  marque comme publiable, dont l'exécution écrit dans le dossier `runs/` du concours. Chaque
  exécution de ce type y reçoit son propre dossier `mcp-run-<id>/`, et `get_run_status`
  affiche la commande `mt-eval compare` portant sur l'ensemble d'entre eux
  (`results/mcp-run-*/*_report.json`).
  Les exécutions de file d'attente écrivent leurs rapports dans `eval/logs/harness/queue/` sous le
  dossier de travail du serveur, comme le fait toujours le banc.

:::note[Les dépenses sont plafonnées par conception]
`run_benchmark` **refuse toute exécution de file d'attente sans limite.** Vous devez définir exactement une
limite — `budget`, `top` ou un `item_id` précis. Il n'existe aucun appel « lance simplement la
file d'attente », car un agent qui comprendrait mal la file d'attente pourrait sinon
dépenser sans limite.
:::

## Version du protocole

Le transport se fait **exclusivement via stdio** — un processus serveur par agent.

La [révision du 28/07/2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
de MCP a rendu le protocole sans état par défaut, supprimant le handshake `initialize` et
l'en-tête `Mcp-Session-Id`. La conception de ce serveur n'en est pas affectée : il n'utilise aucune
des fonctionnalités obsolètes (Roots, Sampling, Logging), n'a jamais employé le transport
hérité HTTP+SSE et suit déjà les nouvelles recommandations relatives à l'état entre les appels —
`run_benchmark` génère un identifiant de tâche explicite que le modèle renvoie, plutôt que
de s'appuyer sur une session de transport.

Il n'a **pas** été mis à niveau vers la nouvelle révision, car aucun SDK TypeScript
publié ne la prend encore en charge. Consultez le [README du
serveur](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) pour
connaître l'ensemble des détails.

## Points de terminaison lisibles par machine

Aucun client MCP n'est requis pour ceux-ci :

| Point de terminaison | Description |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | La [porte d'entrée pour les agents](/for-agents), en markdown brut |
| [`/llms.txt`](https://champollion.dev/llms.txt) | L'index sélectionné de ce site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Chaque page indexée, intégrée en ligne |
| [`/queue.json`](https://champollion.dev/queue.json) | La file d'attente complète d'évaluation comparative |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Principaux éléments de la file d'attente |
| [`/registry.json`](https://champollion.dev/registry.json) | Le registre des corpus |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Le graphe des langues évaluées |

## Étapes suivantes

- [Piloter les rails via MCP](/docs/agents/mcp) — le profil rails, étape par étape
- [Le contrat d'exploitation](/docs/agents/contract) — les règles selon lesquelles un agent opère
- [Guide de l'agent — construction et évaluation comparative](/docs/agents/measurement)
- [Guide de l'agent — traduire avec le CLI](/docs/agents/serving)
- [Soumettre une méthode](/docs/network/getting-started/submit-a-method)
