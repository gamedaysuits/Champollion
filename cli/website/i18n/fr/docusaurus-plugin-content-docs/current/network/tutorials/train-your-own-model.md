---
sidebar_position: 0
title: "Vous souhaitez entraîner votre propre modèle"
description: "Un guide complet orienté agent, de bout en bout, pour entraîner un modèle de traduction à faibles ressources avec nmt-forge — vous dirigez un agent de codage, les garde-fous capturent automatiquement les erreurs d'amateur."
related:
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

Ceci est une procédure complète pour entraîner un modèle de traduction automatique pour une langue peu dotée en ressources — de « je parle cette langue et il y a à peine de données » à un modèle que vous pouvez honnêtement signaler et soumettre au [Réseau](/docs/network/). Il est écrit pour les débutants, et il suppose la façon moderne de faire ce travail : **vous dirigez un agent de codage** (Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity, ou similaire), et l'agent exécute les outils.

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

- **Un agent de codage** avec accès au terminal et au système de fichiers. C'est le pilote.
- **Quelques phrases réellement traduites** pour votre paire de langues — même quelques centaines de paires faites par l'homme est un bon début. Manuels bilingues, archives communautaires, documents publics traduits, matériel éducatif. La qualité plutôt que la quantité.
- **Optionnel mais puissant :** texte monolingue dans votre langue cible, un dictionnaire bilingue, une grammaire de référence publiée, et un analyseur morphologique (FST). Vous n'avez **pas** besoin de tous ces éléments pour commencer — l'outil vous dit exactement lesquels sont présents et lesquels déverrouillent quelles capacités.
- **Calcul :** les barrières de sécurité, le fractionnement, la synthèse, l'audit et la notation s'exécutent sur un ordinateur portable. Seule l'étape d'entraînement du modèle réel a besoin d'un GPU (et un petit modèle avec LoRA tient sur du matériel modeste).

> 🗣️ **Dites à votre agent :** *« Installez nmt-forge à partir du package `forge/` du monorepo Champollion et confirmez que la commande `nmt-forge` s'exécute. Nous allons entraîner un modèle de traduction English → \<your language\>, honnêtement. »*

Votre agent peut appeler l'outil `get_training_guardrails` du serveur MCP Champollion pour charger l'ensemble complet des règles — les dix barrières de sécurité et l'erreur que chacune élimine — dans son propre contexte avant d'écrire des commandes. Si vous pilotez un agent, demandez-lui de le faire d'abord.

---

## Étape 1 — Choisissez une langue et voyez ce qui existe réellement

Chaque projet commence par demander à l'index ce que la langue *a*, honnêtement.

> 🗣️ **Dites à votre agent :** *« Exécutez `nmt-forge discover` pour le code ISO 639-3 de ma langue cible et résumez quelles données existent et ce qui manque. »*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Ce que l'outil fait.** Il lit la **carte** Champollion de la langue — la source unique de vérité pour ce qui est connu sur cette langue — et signale les scripts, analyseurs morphologiques, dictionnaires, corpus et ensembles d'évaluation qu'il enregistre, puis place la langue sur l'**échelle des actifs** :

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Comment lire le résultat.** Les marques `✓` sont ce que vous pouvez faire maintenant ; les marques `?` sont des échelons en attente d'un actif. De manière cruciale, **l'absence sur une carte signifie *inconnu*, jamais « cette langue n'a rien ». ** Une carte clairsemée est une invitation à ajouter ce que vous savez, pas une impasse — et même une carte vide vous donne la boucle d'entraînement complète gardée sur l'échelon 1. Une carte riche (comme le Cri des Plaines) câble les échelons supérieurs automatiquement : ses ensembles d'évaluation arrivent marqués **NEVER TRAIN ON THIS**, et son arbitre spécifique à la langue est prêt à se brancher.

Ensuite, échafaudez un projet :

> 🗣️ **Dites à votre agent :** *« Échafaudez un projet avec `nmt-forge init` pour cette paire de langues et lisez-moi le `NEXT_STEPS.md` qu'il génère. »*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ Cela crée un espace de travail (un répertoire `.forge/` que chaque barrière de sécurité consulte), une **configuration de démarrage**, et un résumé `NEXT_STEPS.md` écrit pour *vous et votre agent* — l'ordre des commandes, l'échelle des actifs pour votre langue, et les non-négociables. C'est la carte pour tout ce qui suit.

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

:::tip[Pas d'analyseur ? Utilisez la rétrotraduction à la place]
Si vous ne pouvez pas synthétiser à partir de règles mais que vous avez du texte **monolingue** dans la langue cible, demandez à votre agent d'exécuter la **rétrotraduction** : `nmt-forge backtranslate` traduit automatiquement votre texte monolingue *en* anglais et apparie chaque résultat avec la phrase cible **réelle**. Le côté cible reste authentique. L'outil **audit de fuite le texte monolingue d'abord** — parce que ce texte peut secrètement *être* vos données d'évaluation. Voir le [Cookbook Back-Translation](/docs/network/tutorials/back-translation).
:::

---

## Étape 4 — Fractionnez vos données réelles en toute sécurité

Maintenant, prenez vos paires **réelles** et divisez-les en train / dev / test. C'est là que se cache l'erreur la plus destructrice de résultats en TA peu dotée en ressources, et c'est là que la barrière de sécurité gagne son salaire.

> 🗣️ **Dites à votre agent :** *« Fractionnez le corpus réel en un ensemble de test et de dev avec `nmt-forge split`, disjoint par groupe, et enregistrez-les. Utilisez une graine fixe pour que ce soit reproductible. »*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **Ce que l'outil fait — la garde de fractionnement.** Il effectue un **fractionnement disjoint par groupe** : chaque paire partageant une source *ou* une cible est liée dans un groupe, et chaque groupe entier atterrit entièrement d'un côté. Ensuite, il **vérifie le chevauchement zéro** et refuse de continuer s'il en existe.

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Cela tue la fuite **« Feed him » / « Feed her »** : un manuel mappe les deux exercices anglais à un mot cible (`asam`) ; un fractionnement aléatoire naïf met une copie en train et son jumeau en test, donc le modèle « réussit » par mémoire. Dans un vrai projet, 17 des 54 lignes de test ont fui de cette façon et ont marqué 83 vs 44 pour les lignes propres — et chaque conclusion construite sur ce nombre était nulle. `--register textbook` enregistre les ensembles de dev et de test (comme `textbook-dev` et `textbook-test`) dans l'espace de travail pour que chaque commande ultérieure sache qu'ils sont des *ensembles d'évaluation sur lesquels vous ne devez jamais entraîner*.

👀 **Comment lire le résultat.** Vous voulez voir la ligne **verified: 0 shared**. Si à la place vous obtenez un `SplitLeakageError`, ne supprimez pas les lignes à la main — cela ne fait que réorganiser le problème. Réexécutez le fractionnement disjoint par groupe ; c'est la correction, et le message d'erreur le dit.

:::danger[Ne jamais entraîner sur un benchmark]
Si vous extrayez un ensemble de données d'évaluation du registre partagé (`nmt-forge registry add-harness`), l'outil l'estampille et le traite comme hors limites pour l'entraînement — **chaque** benchmark de registre est marqué *do-not-train*. Affinez sur tout ce que vous pouvez légitimement ; ne jamais sur l'ensemble de test. C'est [la seule règle](/docs/network/leaderboard/rules) de tout le Réseau.
:::

---

## Étape 5 — Entraînez

Un fichier de configuration décrit l'exécution entière ; une commande l'exécute, de manière reproductible.

> 🗣️ **Dites à votre agent :** *« Remplissez la configuration d'entraînement — pointez `dev` vers notre ensemble de dev enregistré, listez les voies de données or et synthétiques, choisissez un petit modèle de base avec LoRA — puis exécutez `nmt-forge run` et regardez les diagnostics de planification. »*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **Ce que l'outil fait — quatre barrières de sécurité à la fois.**

- **Audit de fuite avant l'entraînement.** *Chaque* voie — or, synthétique, et tout texte rétrotraduit — est criblée par rapport à *chaque* ensemble d'évaluation enregistré. Les correspondances exactes, les correspondances quasi-dupliquées (reformulées) et les correspondances de fichier entier sur un ensemble de test sont fatales. Rien n'entraîne jusqu'à ce que le mélange soit propre.
- **Clôture de dev.** L'entraînement **refuse de commencer sans un ensemble de dev enregistré**, et il ne sélectionnera jamais les points de contrôle que sur cet ensemble de dev — jamais l'ensemble de test. (Il vérifie même le contenu des lignes de dev par rapport aux ensembles de test, pour attraper le tour `cp test.jsonl dev.jsonl`.) La sélection de points de contrôle peut utiliser la **perte** de dev ou une **métrique de génération** de dev — décoder l'ensemble de dev et noter la sortie réelle, le signal plus honnête.
- **Santé de planification.** Si votre mélange est lourd en synthétique, l'outil *dérive* un plancher d'arrêt à partir de la taille de votre mélange et maintient l'entraînement à travers le **plateau** — la phase où le modèle a terminé l'apprentissage synthétique facile et n'a pas encore transféré à la qualité réelle. Cela prévient la « mort à mi-époque », où l'arrêt précoce naïf quitte à un vingtième du plan. Chaque intervention imprime la trajectoire de perte de dev et la raison, en langage courant.
- **Mathématiques d'exposition + synthétique marqué.** Les données or sont surpondérées (répétées) pour que les petites données réelles ne soient pas noyées ; le manifeste note l'**exposition effective par phrase unique** pour qu'un A/B reste équitable. Les sources synthétiques portent une étiquette ; l'or reste sans étiquette pour qu'il ancre le style de sortie.

👀 **Comment lire le résultat.** L'exécution imprime un **rapport de dev avec des intervalles de confiance** — il n'y a pas de sortie de score nu :

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

Si vous voyez un message `schedule-sanity` expliquant qu'il a *maintenu* l'entraînement au-delà d'un arrêt prématuré, c'est la garde du plateau qui fonctionne — bien. L'exécution écrit également un **manifeste** : hash de configuration, hashs de fichiers de données, graines, et la planification dérivée, pour que l'exécution entière soit reproductible.

---

## Étape 6 — Évaluez honnêtement

Vous avez un modèle. Avant de le noter sur l'ensemble de test, vous écrivez ce que vous attendez — *d'abord*.

> 🗣️ **Dites à votre agent :** *« Écrivez une préenregistrement pour la notation de l'ensemble de test — notre métrique prédite, direction et marge — puis décodez l'ensemble de test et notez-le. »*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **Ce que l'outil fait — les gardes anti-narration.**

- **Préenregistrement.** Noter un ensemble de **test** enregistré nécessite une préenregistrement écrite *avant* le premier regard. Sans elle, le tableau de comparaison **refuse simplement de s'afficher** :

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  C'est la garde contre l'habillage des postdictions (« bien sûr, c'est amélioré sur les histoires orales ») comme prédictions. Écrire les suppositions qui *échouent* est ce qui rend celles qui réussissent dignes de confiance.
- **Intervalles de confiance, toujours.** Chaque score s'affiche avec son IC de bootstrap à 95 % ; il n'y a pas de sortie sans IC. Un bump `+0.5` dont les intervalles se chevauchent n'est pas une victoire.
- **Le registre d'évaluation.** Chaque lecture de chaque ensemble d'évaluation est enregistrée (ajout uniquement, à l'épreuve des altérations). Demandez `nmt-forge ledger show --set textbook-test` combien un ensemble est « dépensé ». Les ensembles **scellés** sont à usage unique — notés une fois, puis fermés.

👀 **Comment lire le résultat.** Lisez le nombre **avec son intervalle et par registre**, et vérifiez **quelle métrique croire** avant de célébrer :

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` montre la **fiabilité mesurée** de chaque métrique pour votre famille de langues (à partir des méta-évaluations WMT). Pour certaines familles, une métrique comme BLEU suit à peine le jugement humain tandis que COMET le fait ; pour de nombreuses familles peu dotées en ressources, la réponse honnête est *non mesurée* — auquel cas le jugement des locuteurs natifs, pas n'importe quel nombre automatique, est le vrai signal. Voir [Metric Reliability](/docs/network/specifications/metric-reliability).

:::tip[L'arbitre propre de votre langue]
Si votre langue a une norme d'évaluation LYSS (un linter qui sait, par exemple, que deux orthographes ne diffèrent que par une convention de voyelle longue documentée), branchez-la avec `--plugin` et elle note aux côtés de chrF++ — et peut même *sélectionner* des points de contrôle, pour que le modèle qui gagne soit celui que l'arbitre propre de la langue préfère. Chaque numéro de plugin obtient également un intervalle de confiance.
:::

---

## Étape 7 — Itérez

Maintenant, vous améliorez — et chaque amélioration est mesurée de la même manière honnête.

> 🗣️ **Dites à votre agent :** *« Changez une chose — ajoutez un type de modèle / plus de données rétrotraduites / un modèle de base différent — réentraînez, et faites un A/B par rapport à l'exécution précédente sur l'ensemble de dev, avec signification. »*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
```

🛠️ **Ce que l'outil fait.** `compare` exécute un **test de signification appairé**, pas seulement une soustraction, donc « B bat A » est une affirmation que les statistiques soutiennent — pas du bruit. Itérez sur l'ensemble de **dev** (c'est à quoi il sert) ; gardez l'ensemble de **test** pour des vérifications peu fréquentes et préenregistrées ; gardez tout ensemble **scellé** pour la toute fin.

👀 **Comment lire le résultat.** Une vraie amélioration efface son intervalle de confiance *et* le test de signification. Si ce n'est pas le cas, vous avez quand même appris quelque chose — ce levier est plus faible que vous l'espériez, ce qui vaut la peine de savoir. Les gardes de plateau/couverture/fuite signifient que les nombres que vous comparez sont dignes de confiance, pour que vous puissiez réellement croire à votre propre boucle d'itération.

Leviers courants suivants, à peu près dans l'ordre de rendement pour une langue affamée de données :

1. **Plus de couverture** en synthèse — ajoutez les phénomènes grammaticaux manquants que le rapport de couverture a signalés.
2. **Rétrotraduction** — transformez le texte cible monolingue en plus de paires d'entraînement.
3. **Un modèle de base plus grand ou mieux adapté**, ou réglage fin du rang LoRA/hyperparamètres.
4. **Curriculum** — préentraînez sur du synthétique, puis affinez sur les paires réelles.

---

## Étape 8 — Portez-le au Réseau

Un modèle entraîné honnêtement est exactement ce que le [Réseau Champollion](/docs/network/) est construit pour recevoir.

> 🗣️ **Dites à votre agent :** *« Emballez ce modèle comme une méthode et soumettez-le au classement pour notre paire de langues. »*

- **[Soumettre une Méthode](/docs/network/getting-started/submit-a-method)** transforme votre modèle en une entrée Réseau, notée sur des corpus de référence publics et vous est attribuée.
- Parce que votre évaluation était propre — disjoint par groupe, clôturé par dev, audité pour les fuites, avec IC, préenregistré — votre soumission survit à l'examen qui coule la plupart des affirmations de TA peu dotée en ressources. L'architecture anti-jeu (ensembles de test secrets appartenant à la communauté, vérifications de reproductibilité, validation par des locuteurs natifs) n'est pas un obstacle pour un modèle construit de cette façon ; c'est un sceau de crédibilité.
- Si un **prix** est ouvert pour votre langue, une méthode debout, meilleure que la ligne de base, construite honnêtement est exactement ce qu'un pool sponsorisé récompense. Et quand une méthode fonctionne pour une langue autochtone, **la propriété peut être transférée à la communauté** — vous la construisez ici et ils la déploient, à leurs conditions. Voir la [Spécification des Prix](/docs/network/specifications/prizes) et [Transfert de Propriété](/docs/network/sovereignty/ownership-transfer).

---

## L'arc entier, en un souffle

1. **Découvrez** ce que la langue a (`discover`, `init`) — l'absence est inconnue, pas zéro.
2. **Pointez vers** un analyseur + dictionnaire s'ils existent (échelons 3–4), en respectant leurs licences.
3. **Synthétisez** des données d'entraînement vérifiées, citées, couverture vérifiée (`synth`) — ou **rétrotraduisez** du texte monolingue.
4. **Fractionnez** les données réelles disjoint par groupe et enregistrez les ensembles d'évaluation (`split`).
5. **Entraînez** une configuration, clôturé par dev, audité pour les fuites, conscient du plateau (`run`).
6. **Évaluez** avec les prédictions écrites d'abord, IC toujours, la bonne métrique (`prereg`, `score`).
7. **Itérez** avec A/Bs testés pour la signification (`compare`).
8. **Soumettez** au Réseau — où le travail honnête est le point.

Vous n'aviez jamais besoin de mémoriser les dix façons dont les résultats de TA peu dotée en ressources tournent mal. L'outil a rendu le chemin honnête le défaut et a refusé les raccourcis avec une explication. C'est toute l'idée : **les barrières de sécurité attrapent les erreurs amateurs pour que vous puissiez vous concentrer sur la langue.**

## Continuez

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — chaque terme ici, défini avec un exemple.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — les dix barrières de sécurité sur une page, chacune avec son histoire mesurée.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) et [**Back-Translation**](/docs/network/tutorials/back-translation) — des cookbooks plus profonds sur des techniques spécifiques.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — construire les données réelles sur lesquelles tout le reste repose.
