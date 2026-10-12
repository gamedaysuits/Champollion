---
sidebar_position: 0
title: "Vous souhaitez entraîner votre propre modèle"
description: "Un guide complet de bout en bout, axé sur les agents, pour l’entraînement d’un modèle de traduction pour langues à faibles ressources avec nmt-forge — de python3 -m pip install à un modèle mis à disposition du CLI champollion. Vous dirigez un agent de programmation ; les garde-fous interceptent automatiquement les erreurs de débutant·e."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Vous voulez entraîner votre propre modèle

Voici un guide complet pour entraîner un modèle de traduction automatique pour une
langue à faibles ressources — depuis « Je parle cette langue et il n'y a presque aucune donnée »
jusqu'à un modèle dont vous pouvez rendre compte en toute honnêteté, que vous pouvez servir à votre propre application via la
CLI champollion et soumettre au [Network](/docs/network/). L'entraînement n'est qu'une
étape d'un parcours plus vaste (trouver ce qui existe, évaluer les options, construire
quelque chose de meilleur, le prouver, le déployer) ; [Créer une TA pour votre
langue](/docs/build-mt-for-your-language) en propose la vue d'ensemble.
Ce guide est conçu pour les personnes néophytes et adopte l'approche moderne de ce travail :
**vous pilotez un agent de codage** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity ou similaire), et l'agent exécute les outils.

Ainsi, chaque étape ci-dessous a la même structure :

- 🗣️ **Dites à votre agent** — ce qu'il faut demander, en langage courant.
- 🛠️ **Ce que l'outil fait** — ce que [nmt-forge](/docs/network/getting-started/training-honestly) exécute en votre nom, et la **barrière de sécurité** qui intercepte l'erreur classique avant qu'elle ne vous coûte cher.
- 👀 **Comment lire le résultat** — ce que « bon » signifie et ce dont il faut se préoccuper.

:::info[D'abord, le vocabulaire]
Si des termes comme *dev set*, *decoding*, *chrF++*, *leakage*, ou *round-trip verification* ne vous sont pas familiers, lisez d'abord [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — il définit chaque mot utilisé ici avec un exemple travaillé. Cette page s'appuiera sur tous ces termes.
:::

:::note[L'honnêteté est la fonctionnalité, non le frottement]
L'outil est volontairement dogmatique. Ses barrières de sécurité mécanisent des erreurs réelles et mesurées qu'un vrai projet a commises — donc le chemin honnête est le défaut, et les raccourcis malhonnêtes **refusent avec un message qui nomme la correction**. Là où vous voyez un refus dans ce guide, c'est l'outil qui fait son travail. Vous le voulez.
:::

---

## Ce dont vous avez besoin avant de commencer

- **Un agent de codage** disposant d'un terminal et d'un accès au système de fichiers. C'est le pilote.
- **Quelques phrases réelles traduites** pour votre paire de langues — même quelques
  centaines de paires produites par des humains constituent un bon point de départ. Manuels bilingues, archives
  communautaires, registres publics traduits, matériel pédagogique. La qualité avant
  la quantité.
- **Optionnel mais puissant :** du texte monolingue dans votre langue cible, un
  dictionnaire bilingue, une grammaire de référence publiée et un analyseur
  morphologique (FST). Vous n'avez **pas** besoin de tout cela pour commencer — l'outil vous indique
  exactement ce qui est présent et quelles capacités cela débloque.
- **Calcul :** un ordinateur portable. Les garde-fous, le découpage, la synthèse, l'audit et
  l'évaluation s'exécutent tous sur processeur (CPU), tout comme l'entraînement du modèle par défaut (un petit
  transformer entraîné à partir de zéro). Un GPU n'est nécessaire que si vous choisissez le
  préréglage le plus grand (`nllb-600m`) — voir l'[Étape 5](#step-5--train).

> 🗣️ **Dites à votre agent :** *« Installez nmt-forge avec son extra d'entraînement
> (`python3 -m pip install 'nmt-forge[hf]'`) et confirmez que la commande `nmt-forge` fonctionne.
> Nous allons entraîner un modèle de traduction anglais → \<your language\>,
> en toute honnêteté. »*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

L'extra `[hf]` constitue la pile d'entraînement (torch, transformers, accelerate,
tokenizers, sentencepiece, peft) ; les wheels pour CPU seul conviennent parfaitement. Rien d'autre n'est
nécessaire — aucun clone du dépôt Champollion. Chaque commande prend en charge `--json`
(un document JSON sur stdout ; un refus est retourné sous la forme `{"error": {…, "why",
"fix"}}` with exit code 2), and `nmt-forge status` indique la commande suivante à
tout moment.

Votre agent peut appeler l'outil `get_training_guardrails` du serveur MCP de Champollion (aucun argument ; `topic` optionnel)
pour charger l'ensemble des règles — les dix garde-fous et l'erreur que chacun neutralise —
dans son propre contexte avant d'écrire la moindre commande. Si vous pilotez un agent,
demandez-lui de commencer par là.

---

## Étape 1 — Choisissez une langue et voyez ce qui existe réellement

Chaque projet commence par demander à l'index ce que la langue *a*, honnêtement.

> 🗣️ **Dites à votre agent :** *« Exécutez `nmt-forge discover` pour le code ISO 639-3 de ma langue cible et résumez quelles données existent et ce qui manque. »*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Ce que fait l'outil.** Il lit la **fiche** Champollion de la langue — la
source unique de vérité sur ce qui est connu au sujet de cette langue — et signale les
écritures, analyseurs morphologiques, dictionnaires, corpus et jeux de données d'évaluation qu'elle
consigne, puis positionne la langue sur l'**échelle des ressources**. (Les fiches proviennent d'un
répertoire que vous indiquez avec `--cards-dir`, d'une copie locale ou de
`node_modules/champollion`, ou de l'index public des fiches — mis en cache, de sorte qu'il fonctionne
hors ligne après la première récupération. Hors ligne et sans cache, exportez la fiche avec
`champollion network card <code> --json` dans un répertoire et passez `--cards-dir`.)

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Comment interpréter le résultat.** Les marques `✓` indiquent ce que vous pouvez faire dès maintenant ; les marques `?`
représentent des échelons en attente d'une ressource. Point crucial : **l'absence sur une fiche signifie
*inconnu*, et jamais « cette langue ne dispose de rien ».** Une fiche clairsemée est une invitation
à ajouter ce que vous savez, et non une impasse — et même une fiche vierge vous donne accès à l'intégralité
de la boucle d'entraînement sécurisée au niveau 1. Une fiche riche (comme pour le cri des plaines) connecte
automatiquement les échelons supérieurs : ses ensembles d'évaluation arrivent étiquetés **NEVER TRAIN ON THIS**, et
son arbitre spécifique à la langue est prêt à être intégré. L'échelon 5 n'est coché que lorsque
le paquet de cet arbitre est installé ici ; sinon, il affiche ✗ *UNAVAILABLE*
accompagné de la commande d'installation — et l'arbitre n'est jamais chargé pour un ensemble de test scellé ou
exclusivement local, car il peut rechercher des mots sur un service externe.

Ensuite, échafaudez un projet :

> 🗣️ **Dites à votre agent :** *« Échafaudez un projet avec `nmt-forge init` pour cette paire de langues et lisez-moi le `NEXT_STEPS.md` qu'il génère. »*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ Cela crée un espace de travail (un répertoire `.forge/` que chaque garde-fou
consulte), une **configuration de départ** et un document de synthèse `NEXT_STEPS.md` rédigé pour *vous
et votre agent* — l'ordre des commandes, l'échelle des ressources pour votre langue et
les éléments non négociables. C'est la feuille de route de tout ce qui suit. Les chemins de la configuration sont
relatifs, exécutez donc forge depuis le répertoire du projet.

`init` sélectionne également le **modèle** que vous allez entraîner (`--model`, transcrit sous forme de
valeurs explicites dans `config.json`) : `cpu-tiny` par défaut, `cpu-finetune --base
<hf-id>`, or `nllb-600m`. L'[Étape 5](#step-5--train) explique ce choix. Si votre
langue n'a pas encore de fiche, `nmt-forge init <code> --no-card --name "<name>"`
génère tout de même la structure du projet — chaque fait de la fiche est consigné comme inconnu, rien
n'est inventé.

---

## Étape 2 — Pointez vers un analyseur et un dictionnaire (si vous les avez)

Cette étape concerne les **échelons 3–4** de l'échelle. Si votre langue n'a pas d'analyseur, passez à l'[Étape 4](#step-4--split-your-real-data-safely) — vous entraînerez sur des données réelles (et rétrotraduites) seules, ce qui est un chemin complètement légitime.

Si un analyseur et un dictionnaire *existent*, ils déverrouillent la capacité à *fabriquer* des données d'entraînement vérifiées — le plus grand levier pour une langue avec peu de texte parallèle.

> 🗣️ **Dites à votre agent :** *« La carte liste un analyseur morphologique et un dictionnaire pour cette langue. Récupérez-les selon les instructions d'installation sur la carte, pointez le pack de langue vers eux via les variables d'environnement documentées, et confirmez que l'analyseur fait un aller-retour sur quelques mots connus. »*

🛠️ **Ce que l'outil fait — et une limite qu'il ne franchira pas.** Les analyseurs (FST) et les dictionnaires sont des **outils séparés récupérés par l'utilisateur sous leurs propres licences**. La suite **ne les regroupe ni ne les redistribue jamais** — elle vous pointe vers leur provenance et leur licence, et vous les récupérez. Ce n'est pas de la bureaucratie : de nombreuses ressources linguistiques portent des contraintes réelles de permission et de souveraineté, et l'outil les respecte par construction.

Le tissu conjonctif est un **pack de langue** : un petit plugin qui adapte *votre* analyseur, dictionnaire, règles d'orthographe et modèles de phrases cités par la grammaire au moteur. La suite n'expédie **aucun** pack elle-même — les packs vivent avec leurs langues (le pack Cri des Plaines, par exemple, vit dans son propre projet et se branche par chemin de module).

👀 **Comment lire le résultat.** Vous voulez que l'analyseur **fasse un aller-retour** : épeler une forme, réinjecter l'orthographe, obtenir les mêmes étiquettes grammaticales. S'il ne le fait pas, le **canonicaliseur** du pack — la seule fonction qui normalise l'orthographe partout où deux composants se rencontrent — a probablement besoin d'une règle. Bien faire cela compte : un seul caractère non réconcilié (`ý` vs `y`) a une fois silencieusement supprimé 1 375 verbes d'un pipeline de génération pendant des semaines. L'**audit d'entonnoir** de l'outil compte les survivants à chaque étape précisément pour qu'une chute silencieuse comme celle-ci ne puisse pas se cacher.

---

## Étape 3 — Synthétisez les données d'entraînement à partir des règles de grammaire

Avec un analyseur + dictionnaire + un pack de modèles de phrases cités par la grammaire, vous pouvez fabriquer des centaines de milliers de paires vérifiées.

> 🗣️ **Dites à votre agent :** *« Générez des données d'entraînement synthétiques avec `nmt-forge synth` en utilisant notre pack de langue, puis montrez-moi le rapport de couverture. »*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Ce que l'outil fait — la loi d'émission.** Chaque ligne qui atteint la sortie doit satisfaire des règles qu'aucun pack ne peut refuser :

- **Vérifiée par aller-retour** — chaque mot généré passe *générer → analyser → même analyse*, ou la ligne est rejetée. Aucune forme non vérifiée n'est jamais émise.
- **Citée par la grammaire** — chaque type de modèle cite la grammaire publiée qu'il transcrit. Les modèles non cités n'existent pas ; le code refuse de les charger.
- **Couverture vérifiée** — les modèles sont comptabilisés par rapport à une liste de contrôle des phénomènes grammaticaux requis (impératifs, questions, possession, formes inverses…). Si un phénomène *requis* a zéro exemples, la construction échoue. C'est la garde contre le piège « un million de phrases, toutes les mêmes quelques formes » — du volume qui cache des trous structurels.
- **Estampillée de provenance** — chaque ligne synthétique est marquée `synthetic: true`. Cet estampille est porteur de charge : le registre **refusera** d'enregistrer les lignes synthétiques comme ensemble de test. Les tests sont des données réelles uniquement.

👀 **Comment lire le résultat.** Regardez le rapport de couverture pour les **éléments requis à couverture zéro** (un phénomène grammatical que vos modèles n'ont jamais produit) et la **distribution des types** — si deux formes de modèle dominent, le plafond par type de l'échantillonneur (défaut 15 %) les rééquilibrera pour qu'aucun motif unique ne devienne la moitié de l'expérience du modèle.

:::tip[Pas d'analyseur ? Utilisez plutôt la rétro-traduction]
Si vous ne pouvez pas effectuer de synthèse à partir de règles mais disposez de texte **monolingue** dans la
langue cible, demandez à votre agent d'utiliser la voie de **rétro-traduction** : elle traduit automatiquement
votre texte monolingue *vers* l'anglais à l'aide d'un modèle inverse que vous fournissez et associe
chaque résultat à la phrase cible **réelle**. Le côté cible reste authentique.
Il s'agit d'un appel à une bibliothèque Python (`nmt_forge.training.backtranslation.backtranslate`),
et non d'une sous-commande de la CLI : votre agent rédige un court script autour de celui-ci et ajoute le
fichier de sortie balisé aux voies `data.synthetic` de la configuration. L'appel
**audite d'abord les fuites du texte monolingue** — car ce texte peut secrètement *être*
vos données d'évaluation. Consultez le
[guide pratique de la rétro-traduction](/docs/network/tutorials/back-translation).
:::

---

## Étape 4 — Fractionnez vos données réelles en toute sécurité

Prenez maintenant vos paires **réelles** et mettez de côté les phrases sur lesquelles
vous jugerez l'ensemble des résultats. C'est ici que se cache l'erreur la plus destructrice de résultats en
TA pour langues à faibles ressources, et c'est là que le garde-fou prend tout son sens.

Vos fichiers peuvent être au format `.tsv` (source, une tabulation, puis la traduction, une paire par
ligne ; les lignes commençant par `# ` sont des commentaires) ou `.jsonl` (`{"source": …,
"target": …}` par ligne).

**Si vous disposez déjà d'un ensemble de test** — vérifié par des enseignants, par des soignants, privé —
conservez-le dans un fichier séparé, enregistrez-le, contrôlez le corpus par rapport à celui-ci et ne découpez
que les ensembles train et dev :

> 🗣️ **Dites à votre agent :** *« Enregistrez notre ensemble de test, auditez les fuites du corpus
> par rapport à celui-ci, puis découpez le corpus nettoyé en train et dev avec
> `nmt-forge split`, de manière disjointe par groupes, avec une graine fixe. »*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**Si ce n'est pas le cas**, extrayez l'ensemble de test à partir du corpus au cours de la même étape :

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **Ce que fait l'outil — la protection du découpage.** Il effectue un **découpage
disjoint par groupes** : chaque paire partageant une source *ou* une cible est regroupée au sein d'un même groupe,
et chaque groupe complet se retrouve intégralement d'un seul côté. Ensuite, il **vérifie l'absence totale
de chevauchement** et refuse de continuer s'il en existe un :

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

Cela élimine la **fuite « Feed him » / « Feed her »** : un manuel associe ces deux
exercices anglais à un même mot cible (`asam`) ; un découpage aléatoire naïf place une copie dans le train
et sa jumelle dans le test, de sorte que le modèle « réussit » par simple mémorisation. Dans un projet réel, 17
lignes de test sur 54 ont ainsi fuité et obtenu un score de 83 contre 44 pour les lignes saines — et chaque
conclusion fondée sur ce chiffre était nulle et non avenue. `--register project` enregistre l'ensemble de
dev (ainsi que l'ensemble de test, lorsqu'il est extrait) sous les noms `project-dev` / `project-test` — les
noms que la configuration de départ cible déjà — afin que chaque commande ultérieure sache qu'il s'agit
*d'ensembles d'évaluation sur lesquels vous ne devez jamais vous entraîner*. Lorsqu'un ensemble de test est déjà
enregistré, `split` contrôle également sur-le-champ les nouveaux fichiers train et dev par rapport à lui.

🛠️ **Et l'audit des fuites.** `leak-audit` examine les lignes par rapport à chaque ensemble
d'évaluation enregistré et indique, avec des exemples issus de votre propre corpus, ce qu'il va **rejeter** —
une ligne dont la source est identique à une invite de test (même si sa traduction
diffère), une ligne dont la cible est identique à une réponse de test, et une ligne dont la
cible est un quasi-doublon d'une réponse de test (elle contient la réponse, en est un
fragment ou est identique à au moins 90 % sans tenir compte des accents) — et ce qu'il
**conserve délibérément** : les *variantes de modèles* qui partagent la structure d'une phrase mais changent
un mot (*« I see the dog »* / *« I see the cat »*), ainsi que les invites quasi-doublons ayant
une réponse différente. Les lignes de test qui possèdent une variante de modèle dans l'entraînement sont
listées, et — puisque la configuration de départ définit `eval.near_dupe_corpus` sur votre
fichier d'entraînement — le rapport final évalue séparément les lignes de test *dépourvues* de variante,
sous la forme d'un score « (strict) », afin de rendre visible
l'optimisme apporté par ces variantes. Lorsque la plupart des lignes de test ont une variante et que l'ensemble de test est figé,
`--clean-to <file> --drop-test-twins` supprime également ces doublons d'entraînement (il
indique le sous-ensemble strict avant et après, et refuse de vider l'entraînement).
Attribuez-lui un fichier distinct (`corpus.notwins.jsonl`) : il s'agit du corpus
du modèle sans doublons, aux côtés de celui contenant toutes les données, et leak-audit refuse d'écraser
un fichier qu'une configuration, une exécution ou un découpage lit déjà.
Le résultat est déterministe, et le texte même
du fichier de test n'est jamais affiché.

👀 **Comment lire le résultat.** Vous voulez voir la ligne **verified: 0 shared**. Si à la place vous obtenez un `SplitLeakageError`, ne supprimez pas les lignes à la main — cela ne fait que réorganiser le problème. Réexécutez le fractionnement disjoint par groupe ; c'est la correction, et le message d'erreur le dit.

:::danger[Ne jamais entraîner sur un benchmark]
Si vous extrayez un ensemble de données d'évaluation du registre partagé (`nmt-forge registry add-harness`), l'outil l'estampille et le traite comme hors limites pour l'entraînement — **chaque** benchmark de registre est marqué *do-not-train*. Affinez sur tout ce que vous pouvez légitimement ; ne jamais sur l'ensemble de test. C'est [la seule règle](/docs/network/leaderboard/rules) de tout le Réseau.
:::

---

## Étape 5 — Entraînez

Un seul fichier de configuration décrit l'ensemble de l'exécution ; une seule commande l'exécute,
de manière reproductible. `nmt-forge init` l'a déjà généré.

> 🗣️ **Dites à votre agent :** *« Lisez `config.json`, ajoutez notre voie synthétique si nous
> en avons créé une, exécutez `nmt-forge preflight run --config config.json`, corrigez tout ce qu'elle
> signale, puis exécutez `nmt-forge run config.json` et observez les
> diagnostics de planification. »*

Un extrait de la configuration de départ, avec le modèle `cpu-tiny` par défaut et une
voie synthétique ajoutée :

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**Quel modèle choisir ?** Sélectionnez-le lorsque vous exécutez `init` (`--model`) ; chaque valeur est enregistrée dans
`config.json` :

| préréglage | description | prérequis | attentes réalistes |
|---|---|---|---|
| `cpu-tiny` (par défaut) | un petit transformer (~6M de paramètres) entraîné de zéro ; son vocabulaire est appris uniquement à partir de vos lignes d'**entraînement** | un CPU d'ordinateur portable, aucun téléchargement | faibles : sur 1 000 à 2 000 paires, score chrF++ d'environ 5 à 30 (la fourchette haute uniquement pour des données très répétitives/à patrons) — les phrases et motifs de vos données, pas de la traduction générale |
| `cpu-finetune --base <hf-id>` | affine un petit modèle préentraîné Marian/opus-mt que vous spécifiez — choisissez-en un pour une paire de langues *apparentée* | un CPU, téléchargement d'environ 300 Mo | généralement meilleur que `cpu-tiny` lorsqu'une paire apparentée existe — mesurez-le sur le dev, ne faites pas de suppositions |
| `nllb-600m` | NLLB-200 distillé 600M avec LoRA | un GPU, téléchargement d'environ 2,5 Go | le point de départ le plus solide ; sur CPU, le contrôle du temps réel écoulé le refuse en quelques minutes |

L'intérêt de `cpu-tiny` ne réside pas dans son score. Il concrétise l'**ensemble** de la boucle —
le cloisonnement, les audits, le test préenregistré, un modèle que la CLI peut appeler — afin qu'un
modèle plus performant puisse ultérieurement s'intégrer au même projet et être évalué de la même manière.

`preflight` liste chaque barrière que l'exécution rencontrera, ✓ ou ✗, avec la solution pour chaque ✗
— y compris si l'extra d'entraînement est installé
(`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`).

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **Ce que l'outil fait — quatre barrières de sécurité à la fois.**

- **Audit des fuites avant l'entraînement.** *Chaque* voie — données de référence (gold), synthétiques et
  tout texte rétro-traduit — est contrôlée par rapport à *chaque* ensemble de test et ensemble scellé
  enregistré. Les fuites de réponses (invites ou réponses identiques, quasi-doublons de réponses) et
  les correspondances de fichiers entiers sont éliminatoires ; les variantes de modèles sont conservées et signalées
  (`--drop-test-twins` les supprime pour un ensemble de test fixé).
  Rien n'est entraîné tant que le mélange n'est pas propre.
- **Cloisonnement du dev.** L'entraînement **refuse de démarrer sans un ensemble de dev enregistré**, et
  il ne sélectionnera jamais de points de contrôle (checkpoints) que sur cet ensemble de dev — jamais sur l'ensemble de test.
  (Il vérifie même le contenu des lignes de dev par rapport aux ensembles de test, pour déjouer l'astuce
  `cp test.jsonl dev.jsonl`.) La sélection des points de contrôle peut utiliser la **perte** (loss) sur le dev ou
  une **métrique de génération** sur le dev — décoder l'ensemble de dev et évaluer la sortie réelle,
  ce qui constitue le signal le plus honnête (la configuration de départ utilise chrF++ sur la sortie de dev décodée).
- **Cohérence de la planification.** Si votre mélange est très chargé en données synthétiques, l'outil *calcule* un
  seuil d'arrêt minimal à partir de la taille de votre mélange et maintient l'entraînement tout au long du
  **plateau** — la phase où le modèle a terminé l'apprentissage facile des données synthétiques et n'a pas
  encore transféré ces acquis vers une qualité réelle. Cela évite « l'abandon à mi-époque », où un arrêt précoce
  naïf s'interrompt à un vingtième de ce qui était prévu. La fréquence d'évaluation de l'ensemble de dev est également
  dérivée de la taille de l'exécution, de sorte qu'une petite exécution reste évaluée. Chaque intervention affiche la
  trajectoire de perte sur le dev et la raison, en langage clair.
- **Calcul d'exposition + synthétique balisé.** Les données de référence sont surpondérées (répétées) afin
  que la faible quantité de données réelles ne soit pas noyée ; le manifeste consigne l'**exposition
  effective par phrase unique** afin qu'un test A/B reste équitable. Les sources synthétiques portent une
  balise ; les données de référence restent non balisées afin d'ancrer le style de sortie.

L'entraînement est la seule étape qui prend du temps. Votre agent devrait l'exécuter en
arrière-plan avec redirection de la sortie vers un fichier journal et surveiller les lignes importantes
(`refused`, `Error`, `wall-clock`, `RUN EXIT`) au lieu de scruter en boucle. Un panneau en direct
avec les courbes de perte et un bouton d'arrêt s'ouvre pour **vous** (à l'adresse
`http://127.0.0.1:8377` lorsque ce port est disponible). Dans les premières minutes, forge mesure la vitesse
d'entraînement et affiche une projection du temps réel nécessaire, d'abord une première estimation, puis
une estimation en régime permanent. `init` ne définit aucun budget de temps, car un budget est votre chiffre,
et non un chiffre inventé par l'outil. Consultez la projection, décidez de la durée que vous acceptez,
et ajoutez `"time_budget_hours": <hours>` à `config.json` sous `model`. Dès
lors, forge refuse toute exécution qui ne peut s'achever dans ce délai, ce qui permet à une exécution mal dimensionnée
d'échouer rapidement. Tant que vous n'en définissez pas, seul le plafond de sécurité de forge s'applique : il interrompt
une exécution qui prendrait des jours, et chaque projection l'indique par « no budget set;
… ceiling », et non comme un budget choisi par quiconque.

👀 **Comment interpréter le résultat.** L'exécution affiche un **rapport de dev avec
intervalles de confiance** — il n'y a aucun affichage de score brut — puis la commande suivante (les
chiffres ci-dessous sont donnés à titre indicatif) :

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

Si vous voyez un message `schedule-sanity` expliquant qu'il a *maintenu* l'entraînement au-delà d'un arrêt prématuré, c'est la garde du plateau qui fonctionne — bien. L'exécution écrit également un **manifeste** : hash de configuration, hashs de fichiers de données, graines, et la planification dérivée, pour que l'exécution entière soit reproductible.

---

## Étape 6 — Évaluez honnêtement

Vous avez un modèle. Avant de le noter sur l'ensemble de test, vous écrivez ce que vous attendez — *d'abord*.

> 🗣️ **Dites à votre agent :** *« Rédigez un préenregistrement pour l'évaluation de l'ensemble de test —
> notre métrique prédite, la direction et la marge, avec une justification en une ligne — puis
> exportez l'exécution, ce qui évalue l'ensemble de test une seule fois. »*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg` indique le préenregistrement qui évalue ce modèle. S'il n'en existe qu'un sur
l'ensemble de test, export le trouve tout seul ; avec un second modèle et son propre
préenregistrement sur le même ensemble de test, export refuse de deviner : il faut donc nommer chacun d'eux.

(Le préenregistrement peut avoir lieu à tout moment avant le premier calcul de score sur le test — `nmt-forge
status` le demande avant l'entraînement.)

🛠️ **Ce que l'outil fait — les gardes anti-narration.**

- **Préenregistrement.** L'évaluation d'un ensemble de **test** enregistré nécessite un
  préenregistrement rédigé *avant* le premier examen. Un fichier de prédictions est un tableau
  JSON : chaque prédiction précise une métrique et une justification, ainsi qu'une direction
  par rapport à une référence (vérifiée automatiquement par `nmt-forge prereg check`) ou une
  attente en texte libre qu'une personne vérifie. Le modèle non modifié, le Markdown et
  la prose sont refusés avec l'indication du format attendu et la solution. Sans préenregistrement,
  l'évaluation **refuse** tout simplement de s'exécuter :

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  C'est le garde-fou contre le maquillage de postdictions (« évidemment que cela s'est amélioré sur les
  récits oraux ») en prédictions. Consigner par écrit les hypothèses qui *échouent* est précisément ce qui
  rend crédibles celles qui réussissent.
- **Des intervalles de confiance, toujours.** Chaque score est restitué avec son IC bootstrap
  à 95 % ; il n'existe aucune sortie sans intervalle de confiance. Un gain de `+0.5` dont les intervalles se chevauchent n'est pas
  une victoire.
- **Le registre d'évaluation.** Chaque lecture de chaque ensemble d'évaluation est consignée (en ajout seul,
  infalsifiable). Demandez à `nmt-forge ledger show --set project-test` à quel point un
  ensemble est « épuisé ». Les ensembles **scellés** sont à usage unique — évalués une seule fois, puis clos (une deuxième
  exécution de `export` est refusée ; `--no-eval` prépare le paquet sans réévaluer).

`export` décode l'ensemble de test avec le point de contrôle sélectionné sur le dev, calcule son score et
ajoute une section **Diagnostic et recommandations** en langage clair. Il consigne également
le résultat sous la forme d'un **rapport mt-eval** (`export/evaluation/`), afin que `mt-eval
compare` place votre modèle aux côtés de toute autre méthode mesurée avec le banc de test sur
le même ensemble de test, et empaquette le modèle lui-même (Étape 8) dans `export/model/`,
qui ne contient aucune phrase de test. `export/evaluation/` contient vos phrases
de test : ne le copiez jamais avec le modèle, et conservez-le avec l'ensemble de test. `nmt-forge evaluate <run-manifest>` représente la partie évaluation seule,
lorsque vous ne souhaitez pas créer de paquet.

👀 **Comment interpréter le résultat.** Lisez le chiffre **avec son intervalle et par
registre**, observez le score « (strict) » si vos données d'entraînement partagent des structures de
phrases avec l'ensemble de test, et vérifiez **à quelle métrique se fier** avant de
crier victoire. Pour évaluer le fichier de sortie d'un autre système sur le même ensemble enregistré,
avec davantage de métriques :

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` montre la **fiabilité mesurée** de chaque métrique pour votre famille de langues (à partir des méta-évaluations WMT). Pour certaines familles, une métrique comme BLEU suit à peine le jugement humain tandis que COMET le fait ; pour de nombreuses familles peu dotées en ressources, la réponse honnête est *non mesurée* — auquel cas le jugement des locuteurs natifs, pas n'importe quel nombre automatique, est le vrai signal. Voir [Metric Reliability](/docs/network/specifications/metric-reliability).

:::tip[L'arbitre propre de votre langue]
Si votre langue a une norme d'évaluation LYSS (un linter qui sait, par exemple, que deux orthographes ne diffèrent que par une convention de voyelle longue documentée), branchez-la avec `--plugin` et elle note aux côtés de chrF++ — et peut même *sélectionner* des points de contrôle, pour que le modèle qui gagne soit celui que l'arbitre propre de la langue préfère. Chaque numéro de plugin obtient également un intervalle de confiance.
:::

---

## Étape 7 — Itérez

Maintenant, vous améliorez — et chaque amélioration est mesurée de la même manière honnête.

> 🗣️ **Dites à votre agent :** *« Modifiez une seule chose — ajoutez un type de modèle / plus de
> données rétro-traduites / un préréglage de modèle différent — réentraînez, et comparez en A/B avec
> l'exécution précédente sur l'ensemble de dev, tests de significativité à l'appui. »*

Chaque exécution affiche déjà son score sur le dev avec un intervalle de confiance. Pour un
test apparié, décodez l'ensemble de dev avec chaque exécution — `nmt-forge evaluate <run-manifest>
--config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` est une
copie de votre configuration dont `eval.battery` est `project-dev` — puis :

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **Ce que l'outil fait.** `compare` exécute un **test de signification appairé**, pas seulement une soustraction, donc « B bat A » est une affirmation que les statistiques soutiennent — pas du bruit. Itérez sur l'ensemble de **dev** (c'est à quoi il sert) ; gardez l'ensemble de **test** pour des vérifications peu fréquentes et préenregistrées ; gardez tout ensemble **scellé** pour la toute fin.

👀 **Comment lire le résultat.** Une vraie amélioration efface son intervalle de confiance *et* le test de signification. Si ce n'est pas le cas, vous avez quand même appris quelque chose — ce levier est plus faible que vous l'espériez, ce qui vaut la peine de savoir. Les gardes de plateau/couverture/fuite signifient que les nombres que vous comparez sont dignes de confiance, pour que vous puissiez réellement croire à votre propre boucle d'itération.

Leviers courants suivants, à peu près dans l'ordre de rendement pour une langue affamée de données :

1. **Davantage de paires réelles** — sur quelques milliers de phrases, chaque paire réelle
   supplémentaire compte plus que n'importe quel paramètre.
2. **Une meilleure couverture** lors de la synthèse — ajoutez les phénomènes grammaticaux manquants que le
   rapport de couverture a signalés.
3. **La rétro-traduction** — transformez du texte cible monolingue en paires d'entraînement supplémentaires.
4. **Un point de départ plus robuste** — `cpu-finetune` avec un modèle de base pour une
   paire apparentée, ou `nllb-600m` sur GPU — mesuré par rapport à `cpu-tiny` sur le
   même ensemble de dev.
5. **L'apprentissage progressif (curriculum)** — préentraînez sur des données synthétiques, puis affinez sur les paires réelles.

---

## Étape 8 — L'exploiter et le soumettre au Network

Un modèle entraîné en toute honnêteté est un outil que vous pouvez utiliser dès aujourd'hui, et exactement ce que le
[Champollion Network](/docs/network/) a été conçu pour accueillir.

**Utilisez-le vous-même.** `export` a déjà préparé le paquet du modèle : un répertoire
de modèle autonome, `forge-model.json` (ce qu'il est et comment il a été mesuré), un
manifeste de plugin champollion (`method.json`) et `DEPLOY.md` contenant les commandes
exactes.

> 🗣️ **Dites à votre agent :** *« Servez le modèle exporté et utilisez-le pour traduire
> les chaînes de notre application avec la CLI champollion. »*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` respecte le contrat de **méthode api** de champollion (`POST /translate`) ainsi
qu'un point de terminaison `/v1/chat/completions` **compatible OpenAI** — ce dernier étant ce que
`--method local` utilise ; `DEPLOY.md` fournit l'extrait `champollion.config.json` pour
le premier. Il écoute uniquement sur `127.0.0.1` ; l'exposer sur un réseau nécessite un
jeton (`--token` ou `NMT_FORGE_SERVE_TOKEN`). Un modèle de TA traduit du texte et
ignore les instructions : les invites de tonalité, fichiers de directives et glossaires que la CLI
transmet aux méthodes de LLM n'ont aucun effet sur lui — et sa sortie doit être révisée par une personne
locutrice fluide avant d'atteindre les lecteurs.

**Le soumettre au Network.**

> 🗣️ **Dites à votre agent :** *« Emballez ce modèle comme une méthode et soumettez-le au classement pour notre paire de langues. »*

- **[Soumettre une Méthode](/docs/network/getting-started/submit-a-method)** transforme votre modèle en une entrée Réseau, notée sur des corpus de référence publics et vous est attribuée.
- Parce que votre évaluation était propre — disjoint par groupe, clôturé par dev, audité pour les fuites, avec IC, préenregistré — votre soumission survit à l'examen qui coule la plupart des affirmations de TA peu dotée en ressources. L'architecture anti-jeu (ensembles de test secrets appartenant à la communauté, vérifications de reproductibilité, validation par des locuteurs natifs) n'est pas un obstacle pour un modèle construit de cette façon ; c'est un sceau de crédibilité.
- Si un **prix** est ouvert pour votre langue, une méthode debout, meilleure que la ligne de base, construite honnêtement est exactement ce qu'un pool sponsorisé récompense. Et quand une méthode fonctionne pour une langue autochtone, **la propriété peut être transférée à la communauté** — vous la construisez ici et ils la déploient, à leurs conditions. Voir la [Spécification des Prix](/docs/network/specifications/prizes) et [Transfert de Propriété](/docs/network/sovereignty/ownership-transfer).

---

## L'arc entier, en un souffle

1. **Découvrez** les ressources dont dispose la langue (`discover`, `init`) — l'absence signifie inconnu, pas néant.
2. **Ciblez** un analyseur et un dictionnaire s'ils existent (échelons 3–4), en respectant leurs licences.
3. **Synthétisez** des données d'entraînement vérifiées, sourcées et au taux de couverture contrôlé (`synth`) — ou **rétro-traduisez** du texte monolingue.
4. **Découpez** les données réelles de façon disjointe par groupes, filtrez-les par rapport à votre ensemble de test et enregistrez les ensembles d'évaluation (`registry add`, `leak-audit`, `split`).
5. **Entraînez** une seule configuration — sur processeur (CPU) par défaut — avec cloisonnement du dev, audit des fuites et gestion du plateau (`preflight`, `run`).
6. **Évaluez** avec des prédictions formulées au préalable, des intervalles de confiance systématiques et la métrique appropriée (`prereg`, `export`).
7. **Itérez** grâce à des tests A/B validés par des tests de significativité (`compare`).
8. **Utilisez** le modèle via la CLI (`serve`) et **soumettez-le** au Network — où le travail honnête est la raison d'être.

Vous n'aviez jamais besoin de mémoriser les dix façons dont les résultats de TA peu dotée en ressources tournent mal. L'outil a rendu le chemin honnête le défaut et a refusé les raccourcis avec une explication. C'est toute l'idée : **les barrières de sécurité attrapent les erreurs amateurs pour que vous puissiez vous concentrer sur la langue.**

## Continuez

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — chaque terme ici, défini avec un exemple.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — les dix barrières de sécurité sur une page, chacune avec son histoire mesurée.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) et [**Back-Translation**](/docs/network/tutorials/back-translation) — des cookbooks plus profonds sur des techniques spécifiques.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — construire les données réelles sur lesquelles tout le reste repose.
