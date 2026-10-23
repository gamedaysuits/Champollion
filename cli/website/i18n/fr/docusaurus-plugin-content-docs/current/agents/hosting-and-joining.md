---
title: "Héberger un test scellé et rejoindre un projet"
slug: /agents/hosting-and-joining
description: "Deux manières de s'impliquer au-delà du développement : héberger un test scellé avec mt-eval contest et mt-eval node (cela fonctionne, ce n'est pas encore sur les rails, et les dépositaires choisi·e·s par l'organisateur·rice détiennent les parts de clé), et rejoindre un projet enregistré avec mt-eval project — chaque commande, ce qu'elle envoie, où, et ce qu'elle ne montre jamais."
---

# Héberger un test scellé et rejoindre un projet

Deux voies aux côtés des rails de construction. Toutes deux sont de simples commandes `mt-eval` ; aucune n'est une étape que `champollion next` nomme.

## Héberger un test scellé

**État réel des lieux.**

- Cela fonctionne : la préparation d'un ensemble scellé, une cérémonie de clés, l'exécution des soumissions sur un nœud isolé du réseau (air-gap), les verdicts et le classement sont tous des commandes disposant de tests.
- **Ce n'est pas encore intégré aux rails.** `champollion new --kind task` est refusé ; le seul parcours disponible est celui de la langue. Attendez-vous à un cheminement manuel plus long, et suivez le [guide opérationnel du concours](/docs/network/sovereignty/run-a-sovereign-contest).
- **Les parts de clé sont détenues par des gardiens désignés par l'organisateur.** Rien dans le code ne les nomme ni ne les valide. Aucun gardien de clé communautaire n'a été désigné pour quelque test que ce soit.
- **Champollion ne détient aucune part de clé ni aucune clé privée.** La cérémonie s'exécute sur la machine de l'organisateur, et l'enregistrement ne transmet que des identifiants, des condensats et le seuil de qualification — jamais une clé, une part ou les phrases.

**Remarque.** L'hébergement détermine ce qu'il advient des phrases des personnes et qui peut les déverrouiller. Chaque étape ci-dessous relève de la décision de l'organisateur ; n'exécutez chacune d'elles que lorsqu'il en fait la demande.

### Ce qui est généré

`mt-eval contest prepare` divise le corpus de l'organisateur :

| Option | Ensemble | Qui y a accès |
|---|---|---|
| `--dev-size` (requis) | Le jeu de qualification : source et références | Public, diffusé depuis `<out>/public/` |
| `--secret-size` | Le test scellé sur lequel le concours est enregistré | Personne : scellé dans `<out>/local/` |
| `--sealed-holdout-size` (nécessite `--secret-size`) | Un second sous-ensemble scellé, évalué mais retenu jusqu'à la clôture | Personne |

`--seed`, `--qualifier-threshold` (supérieur à 0) et `--license` sont requis — aucune licence n'est présumée. `--custodian-group` et `--threshold-pubkey` sont requis (la clé avec laquelle les ensembles scellés sont chiffrés). Le texte en clair de chaque ensemble scellé est supprimé après le scellement ; `<out>/local/manifest.json` conserve la recette et ne quitte jamais la machine. Le scellement exécute `champollion network seal-corpus seal`, l'interface en ligne de commande (CLI) de `champollion` doit donc être installée.

### Garde des clés

**Garde à seuil (M sur N).** Sur le nœud isolé du réseau :

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` génère la clé, la divise selon le schéma de Shamir et l'efface de la mémoire en un seul appel ; il écrit `ceremony.json` (le registre public) et un fichier de part par gardien. `--set` doit être l'identifiant de l'ensemble secret et `--group` le `--custodian-group` que prepare utilisera — prepare ne les vérifie pas, et une non-concordance n'est détectée que lorsqu'une exécution est refusée. Fournissez à prepare le registre de la cérémonie : `--threshold-pubkey <ceremony>/ceremony.json`.

**Verrouillage.** Un ensemble scellé n'est déchiffré que par `mt-eval node run-method <id>
--offline --share … --share …` avec au moins M parts provenant de gardiens distincts dont les identifiants correspondent à l'ensemble. La garde à seuil fonctionne uniquement sur cette voie hors ligne.

**Clé unique.** `champollion network seal-corpus keygen --out <dir>` génère une paire de clés ; quiconque détient son fichier de clé peut déchiffrer seul. C'est ce qu'utilise la voie avec nœud connecté.

### Le cheminement de l'organisateur (garde à seuil)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

`node init --from-contest` configure la garde à seuil lorsque l'ensemble a été scellé avec une clé de cérémonie. Les participants se qualifient sur l'ensemble de développement public (`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`,
`mt-eval contest submit-model`, tous deux avec un chemin `--offline --bundle-out`).
Le [guide du nœud](/docs/network/sovereignty/sovereign-eval-node) détaille chaque commande de nœud.

### Ce qui nécessite une connexion, et de qui

| Fonctionne hors ligne | Nécessite une authentification | Nécessite la clé de service de la base de données |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (avec `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, chaque `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, `submit-*` en ligne, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` sans `--no-register` ou `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, `node run-method` en ligne, `node relay`, et `contest close` lorsque les résultats ont été retenus |

La clé de service appartient à l'entité qui gère la base de données. Un organisateur externe exécute ces commandes sur sa propre base de données (`MT_EVAL_SUPABASE_URL` et ses clés), ou s'en tient à la voie hors ligne — dont les scores sont vérifiables à partir de leurs manifestes signés mais n'apparaissent sur aucun tableau de classement public. **Remarque.** Ne définissez jamais `MT_EVAL_ALLOW_PROD` : cela lève le refus des outils d'écrire dans la base de données de production par défaut, et cette décision ne relève pas d'un agent.

## Rejoindre un projet

Un **projet enregistré** est un projet linguistique répertorié par son propriétaire afin que d'autres puissent y contribuer, à l'aide de fichiers : phrases, listes de mots ou méthodes (le temps de relecture et la puissance de calcul ne sont pas encore proposés). Les commandes `mt-eval
project` ci-dessous communiquent avec la base de données du projet
(`MT_EVAL_SUPABASE_URL`). Chaque sous-commande, à l'exception de `list` (anonyme) et
de `review` (celle de l'opérateur), requiert une authentification (une session
en cache, `MT_EVAL_REFRESH_TOKEN` ou une connexion interactive via GitHub ou Google) ;
le compte correspond à l'adresse e-mail de connexion.

**Les règles.**

- **Examiné avant publication.** Un nouveau projet débute à l'état `pending_review` ; il n'est répertorié qu'après examen. Un propriétaire peut clore un projet sans jamais le publier.
- **Le propriétaire est désigné selon son choix** (`--owner-name`). La ligne du projet ne contient aucune adresse e-mail ; le compte du propriétaire est conservé séparément et n'est consultable que par lui-même.
- **Aucune adresse e-mail dans les listes publiques.** `project list` est anonyme et affiche des noms et des décomptes ; `project offers` affiche les contributeurs sous le nom qu'ils ont fourni (`--as`). Le compte du propriétaire peut toujours lire l'adresse e-mail du compte d'un contributeur dans l'enregistrement de l'offre, et la note de consentement consigne les deux comptes.
- **Les offres engagent les deux parties.** L'acceptation génère une note de consentement précisant qui l'a soumise et qui l'a autorisée.
- **Aucun extrait de fichier n'est affiché.** Seuls les noms, les décomptes et les états apparaissent.

### Propriétaire

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` lit la paire depuis `champollion.project.json` (ainsi que la finalité, sauf si `--purpose`) ; options facultatives : `--slug`, `--domain`, `--register`, `--about`. Au maximum 5 enregistrements par compte par période de 24 heures.
- `ask` : `--kind` prend la valeur `sentences`, `word-list` ou `method` ; les demandes ne s'affichent que tant que le projet est répertorié.
- `accept` télécharge le fichier, **vérifie son sha256** (refusé en cas de non-concordance), écrit `inbox/offer-<offer id>-<file name>` et `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`, `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`), puis marque l'offre comme acceptée. Le fichier est ensuite intégré comme n'importe quel autre — `champollion data add inbox/<file>` — et les conditions de ses détenteurs sont demandées.
- **Remarque.** Les `--terms` du contributeur figurent dans la note de consentement. Les réponses que vous enregistrez avec `champollion data mark` ne doivent pas les assouplir.

### Contributeur

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` téléverse un fichier non vide d'au maximum 50 Mo vers le stockage privé du projet, avec son sha256, uniquement vers un projet répertorié. Au maximum 24 offres par contributeur par période de 24 heures.
- Une offre ne change d'état qu'une fois : `offered` → `accepted`, `declined` ou `withdrawn`.
- **Remarque.** Retirer ou refuser une offre modifie son état ; cela ne supprime pas le fichier téléversé du stockage. Précisez-le avant qu'un contributeur ne propose un élément qu'il pourrait souhaiter récupérer.
- **Verrouillage.** `offer` lit le fichier auxiliaire (sidecar) avant tout téléversement. Il refuse un fichier `local-only`, un jeu `sealed` et un fichier dont `speakers_agreed` vaut `not-yet` ou `some-said-no` ; un fichier auxiliaire illisible interrompt l'offre. Il n'existe aucune dérogation : la marque ne peut être modifiée que par les détenteurs. Une condition `training: not-allowed` est ajoutée aux conditions de l'offre afin que le propriétaire la voie.
- **Remarque.** Une offre transfère le fichier depuis l'ordinateur du contributeur vers le stockage de la base de données du projet. Demandez l'accord du contributeur et ne proposez jamais un fichier à sa place.

`mt-eval project review` est réservé à l'opérateur de la base de données (il utilise la clé de service). Ce n'est pas une commande destinée aux agents.

## Pour aller plus loin

- [Héberger un test scellé](/docs/host-a-sealed-test) et
  [Rejoindre un projet](/docs/join-a-project) — les versions grand public.
- [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest)
  et [le nœud d'évaluation souverain](/docs/network/sovereignty/sovereign-eval-node).
- [Transfert de propriété](/docs/network/sovereignty/ownership-transfer) et
  [modèles de conditions](/docs/network/sovereignty/terms-templates).
- [Règles relatives aux données et à la transmission](/docs/agents/data-rules) — ensembles scellés et
  fichiers strictement locaux.
- [Référence `mt-eval`](/docs/reference/mt-eval).
