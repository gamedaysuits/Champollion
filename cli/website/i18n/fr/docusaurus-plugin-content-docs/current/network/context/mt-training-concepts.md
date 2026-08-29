---
sidebar_position: 0
title: "Formation en IA de traduction en langage simple"
description: "Un glossaire sans prérequis des termes nécessaires pour entraîner un modèle de traduction — chaque terme défini avec un exemple concret, rédigé pour les personnes qui pilotent un agent de codage."
related:
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on walkthrough these words are for"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The suite that turns every rule here into a guardrail"
  - label: "MT Field Briefing"
    to: /docs/network/context/mt-field-briefing
    kind: doc
    note: "Broader context on where machine translation stands"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind error bars — why one number is never enough"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Which score to believe for your language"
---

# Formation en MT en langage clair

La formation d'un modèle de traduction automatique (TA) possède son propre vocabulaire, et la plupart de celui-ci n'est jamais expliqué aux nouveaux venus — on suppose que vous le connaissez. Cette page ne suppose rien. Chaque terme ci-dessous est défini en termes simples et ancré à un exemple concret, afin que lorsque vous lisiez la [procédure pas à pas de formation](/docs/network/tutorials/train-your-own-model) ou regardiez votre agent de codage exécuter une commande, vous sachiez ce que les mots signifient et, plus important encore, **lesquels d'entre eux cachent les erreurs qui ruinent silencieusement les résultats.**

:::info[À qui s'adresse cette page]
Vous n'avez pas besoin d'écrire du Python. La façon attendue de faire ce travail maintenant est de **diriger un agent de codage** — Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity, ou similaire — qui exécute les outils pour vous. Votre travail consiste à comprendre les concepts suffisamment bien pour donner de bonnes instructions et à lire les résultats honnêtement. C'est exactement à cela que sert cette page. Lorsque nous mentionnons un outil, nous parlons de [**nmt-forge**](/docs/network/getting-started/training-honestly), la suite de formation dans laquelle ces idées sont intégrées ; les mots, cependant, appartiennent à l'ensemble du domaine, pas seulement à nous.
:::

Un exemple en cours de route lie la page ensemble. Supposons que vous vouliez construire un modèle qui traduit **l'anglais → une langue peu dotée en ressources** — appelez-la votre *langue cible* — pour laquelle presque aucun texte traduit n'existe. Tout ce qui suit est une partie de ce projet.

---

## 1. Les deux piles : données d'entraînement et données d'évaluation

Les **données parallèles** sont du texte associé à sa traduction — le même sens dans deux langues, aligné phrase par phrase.

> `The children are playing.` → `awâsisak mêtawêwak.`

Un modèle apprend en étudiant des milliers de telles paires. Mais vous devez garder les paires dans **deux piles qui ne se touchent jamais** :

- **Données d'entraînement** — les paires que le modèle est *autorisé à étudier*. Il les lit encore et encore et s'ajuste pour les reproduire.
- **Données d'évaluation** (ou **données d'eval**) — des paires que le modèle n'est *jamais autorisé à voir pendant l'entraînement*. Vous cachez les traductions, demandez au modèle de traduire le côté source à froid, et comparez sa réponse à la vérité cachée. C'est la seule mesure honnête de savoir s'il a appris à *traduire* plutôt qu'à *mémoriser*.

:::tip[La version en une phrase de tout ce qui se trouve sur cette page]
Un test n'a de sens que si le modèle n'a jamais vu les réponses. Presque chaque erreur ci-dessous est une façon différente dont les réponses s'échappent de la pile d'eval vers la pile d'entraînement sans que personne ne le remarque.
:::

### Données parallèles réelles par rapport aux données synthétiques

- Les **données parallèles réelles** (ou *or*) sont faites par l'homme : un manuel bilingue, des documents gouvernementaux traduits par des personnes, des histoires archivées par la communauté. Elles sont fiables mais, pour la plupart des langues, terriblement rares — souvent seulement quelques centaines de paires de phrases.
- Les **données parallèles synthétiques** sont *fabriquées* par un programme plutôt qu'écrites par une personne. Lorsque vous n'avez que 400 paires réelles, vous ne pouvez pas entraîner un modèle utilisable — vous générez donc des centaines de milliers de paires supplémentaires à partir de règles (plus de détails sur la façon de le faire dans [§7](#7-manufacturing-data-when-you-dont-have-enough)).

La relation importe énormément :

> **Exemple travaillé.** Un projet dispose de 435 paires réelles anglais→cri et en fabrique ~1 000 000 synthétiques. Le modèle s'entraîne sur la grande pile synthétique *plus* les quelques centaines de paires réelles. Les données synthétiques achètent la couverture ; les données réelles ancrent le modèle à la façon dont la langue est réellement utilisée. Tout l'art consiste à (a) faire en sorte que la pile synthétique couvre autant que possible la langue, et (b) mesurer uniquement sur du texte réel que le modèle n'a jamais touché.

:::danger[Ne testez jamais sur des données synthétiques]
Un ensemble d'évaluation doit être **composé uniquement de données réelles**. Si vous testez sur des phrases fabriquées, vous mesurez si le modèle correspond à votre *générateur* — pas s'il peut traduire. Une bonne suite de formation refuse d'enregistrer les lignes synthétiques comme ensemble de test.
:::

---

## 2. Division : entraînement, développement et test

Vous commencez avec une pile de paires réelles et vous la **divisez** en trois rôles.

| Division | Aussi appelé | À quoi ça sert | Le modèle le voit-il pendant l'entraînement ? |
|---|---|---|---|
| **train** | ensemble d'entraînement | Les paires que le modèle étudie | Oui |
| **dev** | ensemble de validation, retenu | Décider *quand arrêter* et *quelle version est la meilleure* | Non (seulement *noté*, jamais étudié) |
| **test** | retenu, ensemble d'évaluation | La note finale honnête | **Jamais** |

Deux idées se cachent dans ce tableau :

- **Retenu** signifie simplement « mis de côté et tenu à l'écart de l'entraînement ». Un ensemble de test est retenu à dessein.
- L'**ensemble de dev** est l'enfant du milieu intelligent. Le modèle ne l'*étudie* jamais, mais vous *regardez* comment le modèle se comporte pendant l'entraînement pour prendre des décisions — comme un examen blanc qui vous dit si vous devez continuer à étudier, sans être l'examen réel. Utiliser l'ensemble de dev de cette façon est légitime ; utiliser l'ensemble de *test* de cette façon est de la triche (voir [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).

### Ensembles scellés et re-divisions

- Un **ensemble scellé** est un ensemble de test qui peut être noté **exactement une fois**. Au moment où vous regardez votre score, il est « dépensé » — car une fois que vous connaissez le nombre, chaque décision ultérieure que vous prenez est subtilement façonnée par lui. Les ensembles scellés sont la façon dont les compétitions et les communautés gardent une note finale vraiment finale.
- Une **re-division** est lorsque vous reconstruisez la division train/dev/test à partir de zéro — généralement parce que vous avez découvert que l'ancienne division était contaminée. Vous ne pouvez pas corriger une division qui fuit en supprimant quelques lignes ; vous regroupez tout et découpez à nouveau ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results) explique pourquoi).

---

## 3. Ce que « l'entraînement » fait réellement : la perte et ses deux visages

L'entraînement est une boucle. Le modèle fait une prédiction, voit à quel point il s'est trompé, et ajuste légèrement ses nombres internes pour être un peu moins trompé la prochaine fois — des millions de fois.

La **perte** est le nombre unique qui mesure « à quel point c'est faux ». Plus bas est mieux. Mais il y a *deux* pertes, et les confondre est un piège classique :

- **Perte d'entraînement** — à quel point le modèle se trompe sur les paires qu'il étudie activement. Cela baisse presque toujours, car le modèle peut, à la limite, simplement *mémoriser* les paires d'entraînement.
- **Perte de dev** (perte de validation) — à quel point le modèle se trompe sur l'ensemble de dev retenu qu'il n'*étudie pas*. C'est le signal honnête. Lorsque la perte de dev cesse de s'améliorer tandis que la perte d'entraînement continue de baisser, le modèle a cessé d'*apprendre la langue* et a commencé à *mémoriser l'ensemble d'entraînement*.

> **Exemple travaillé.** Après un certain temps, vous voyez la perte d'entraînement à 0,8 et en baisse, mais la perte de dev bloquée à 1,9 et qui *monte*. Cet écart est révélateur : le modèle devient meilleur pour réciter ses paires d'entraînement et pas mieux — pire même — pour traduire quoi que ce soit de nouveau.

### La perte est un proxy. Le décodage est la vraie chose.

Voici une subtilité qui trompe presque tout le monde. La perte mesure si le modèle attribue une probabilité élevée au mot suivant correct *lorsque la bonne réponse est déjà devant lui*. Ce n'est **pas** la même chose que le modèle produisant réellement une bonne traduction de lui-même.

- Le **décodage** (aussi *génération* ou *inférence*) est le modèle **traduisant réellement** : étant donné seulement la phrase source, il émet une phrase cible mot par mot, sans rien sur quoi s'appuyer.
- La **perte** est un *proxy* bon marché calculé pendant l'entraînement. Elle corrèle avec la qualité, mais imparfaitement.

> **Exemple travaillé.** Deux points de contrôle ont une perte de dev presque identique, mais lorsque vous *décodez* les phrases de dev et notez les traductions réelles, l'une est clairement plus fluide. La perte n'a pas pu voir cette différence ; le décodage a pu. C'est pourquoi la sélection sérieuse de points de contrôle décode l'ensemble de dev et note la sortie réelle, plutôt que de faire confiance à la perte seule.

:::note[« La perte de dev suit-elle la qualité ? » est une question ouverte, pas du folklore]
Vous entendrez des affirmations confiantes selon lesquelles « la perte d'eval ment ». Traitez cela comme **indéterminé**, non prouvé — une grande partie de ce folklore provenait d'expériences contaminées. La position honnête : la perte de dev est un signal utile et bon marché ; une métrique de *génération* de dev (décodage, puis notation) en est une plus directe. Préférez la directe pour les décisions finales, et ne répétez pas « la perte ment » comme un fait.
:::

---

## 4. Contamination et fuite : l'erreur qui dévore les résultats

La **contamination** (ou **fuite**) signifie que les réponses d'eval se sont secrètement retrouvées dans la pile d'entraînement. Le modèle « réussit alors le test » par mémoire, votre score semble excellent, et le résultat est sans valeur. C'est la façon la plus courante dont les résultats de TA pour les langues peu dotées en ressources s'avèrent être faux — et la chose la plus importante que cette page entière vous avertit.

La forme classique et sournoise est une **paire minimale à cible partagée** :

> **Exemple travaillé — « Feed him » / « Feed her ».** Un manuel de langue mappe de nombreux exercices anglais différents sur **un** mot cible. *« Feed him »* et *« Feed her »* se traduisent tous deux par la même forme, `asam`. Une division aléatoire naïve met *« Feed him »* → `asam` dans l'**entraînement** et *« Feed her »* → `asam` dans l'**ensemble de test**. La réponse cible, `asam`, est maintenant dans les deux piles. Le modèle a mémorisé `asam` à partir de l'entraînement et « l'obtient correctement » au test — mais il n'a rien appris. Dans un vrai projet, 17 des 54 lignes « test » ont fui de cette façon, et ces lignes ont marqué **83** sur la métrique de qualité par rapport à **44** pour les lignes propres. Chaque conclusion construite sur ce nombre a dû être jetée.

La fuite a plusieurs visages, et un **audit de fuite** approprié les vérifie tous :

- **Chevauchement exact** — la même source *ou* la même cible apparaît des deux côtés (l'exemple ci-dessus).
- **Chevauchement quasi-dupliqué** — pas identique, mais une version *reformulée* d'une phrase de test se trouve dans l'entraînement. Les documents du même domaine partagent des paraphrases ; la correspondance exacte les manque, donc les audits mesurent également la similarité du chevauchement de mots.
- **Chevauchement de fichier entier** — quelqu'un a accidentellement entraîné sur une copie du fichier de test lui-même. (Cela arrive vraiment : une récolte « d'entraînement » s'est avérée *être* le manuel d'or, 489 des 489 lignes correspondant.)

### Division disjointe par groupe — la solution

Vous ne pouvez pas corriger la fuite en supprimant les lignes offensantes une par une ; le motif réapparaît simplement. La solution est la **division disjointe par groupe** : avant de diviser, liez ensemble chaque paire qui partage une source *ou* une cible dans un **groupe**, puis envoyez chaque *groupe entier* exactement d'un côté. Maintenant `asam` et tout ce qui le partage vivent entièrement dans l'entraînement *ou* entièrement dans le test — jamais les deux. Après la découpe, vous **vérifiez zéro chevauchement** et refusez de procéder s'il en reste.

:::tip[C'est ce que « le split-guard » fait pour vous]
Lorsque votre agent exécute le diviseur, il effectue une division disjointe par groupe par défaut et vérifie automatiquement zéro chevauchement. Vous n'avez pas à vous souvenir du piège « Feed him / Feed her » — l'outil rend son engagement difficile, et si vous le contournez, il refuse avec un message nommant la solution.
:::

---

## 5. Surapprentissage, arrêt précoce et le plateau

Le **surapprentissage** est ce qui se passe lorsqu'un modèle continue à étudier au-delà du point d'apprentissage et commence à *mémoriser*. Sa perte d'entraînement semble merveilleuse ; sa qualité de traduction réelle s'aggrave. L'écart de perte du [§3](#3-what-training-actually-does-loss-and-its-two-faces) est comment vous le repérez.

L'**arrêt précoce** est la défense : regardez le signal de dev, et lorsqu'il cesse de s'améliorer pendant un nombre défini de vérifications (sa **patience**), arrêtez l'entraînement et gardez la meilleure version antérieure — le meilleur **point de contrôle** (un instantané sauvegardé du modèle à mi-entraînement). L'arrêt précoce prévient le calcul gaspillé et le surapprentissage à la fois.

Mais l'arrêt précoce a un mode de défaillance célèbre lorsque vous entraînez principalement sur des données synthétiques — le **plateau de transfert synthétique→réel** :

> **Exemple travaillé — la mort de la demi-époque.** Un modèle s'entraîne sur un mélange qui est 97,5 % synthétique et est jugé sur un ensemble de dev *réel* de 42 phrases. Au début, le modèle devient rapidement bon à la masse synthétique, donc la perte de dev sur les phrases réelles baisse rapidement, atteint un creux autour de l'étape 8 000 — puis dérive *vers le haut*. L'arrêt précoce naïf voit « la perte de dev a augmenté pendant 6 vérifications d'affilée » et déclare la victoire à l'époque 0,52, un vingtième de l'entraînement prévu. Mais le modèle n'était pas terminé ; il avait simplement terminé l'apprentissage *facile* synthétique et n'avait pas encore commencé le lent **transfert** vers la qualité du langage réel. Il a été arrêté au plateau, avant le gain.

La leçon : avec un mélange lourd en synthétique, un *creux précoce et une montée* dans la perte de dev est **attendu**, pas une convergence. La règle d'arrêt doit être assez intelligente pour maintenir l'entraînement à travers le plateau — un plancher dérivé de la taille de votre mélange, pas un nombre magique que vous êtes censé connaître.

:::note[Les configurations honnêtes font surface les vrais bugs]
Ce bug du plateau était invisible pendant des mois — car les exécutions antérieures avaient (illégitimement) utilisé l'ensemble de *test* comme ensemble de dev, ce qui l'a caché. La première exécution *propre* est ce qui l'a exposé. C'est le thème récurrent : le faire honnêtement ne vous garde pas seulement honnête, cela rend les vrais problèmes visibles.
:::

---

## 6. Mesurer la qualité : métriques, batteries, registres

Lorsque le modèle *décode* une phrase de test, comment notez-vous sa réponse par rapport à la traduction de référence ?

### Métriques de crédit partiel : chrF++ et BLEU

Une traduction est rarement exactement la référence mot pour mot, mais elle peut être parfaitement bonne. Donc la TA utilise des **métriques de crédit partiel** qui récompensent le *chevauchement* plutôt que d'exiger une correspondance exacte :

- **chrF++** note le chevauchement de **séquences de caractères** (plus certaines séquences de mots) entre la sortie du modèle et la référence. Parce qu'il fonctionne au niveau des caractères, il donne un crédit partiel pour obtenir un mot *presque* correctement — la racine correcte avec une mauvaise terminaison gagne toujours quelque chose. Cela le rend bien adapté aux langues morphologiquement riches, où une racine prend de nombreuses formes. Plus haut est mieux ; il est généralement rapporté sur une échelle 0–100.
- **BLEU** est la norme plus ancienne. Il note le chevauchement de **chunks de mots entiers** (n-grammes). Il est toujours largement rapporté, mais il est dur pour les langues où les mots ont de nombreuses formes fléchies, car une quasi-erreur sur une terminaison compte comme une erreur complète.

> **Exemple travaillé.** Référence : `awâsisak mêtawêwak`. Sortie du modèle :
> `awâsisak mêtawêw` (racine correcte, mauvaise syllabe finale). BLEU voit le deuxième mot comme simplement faux. chrF++ voit que la plupart des caractères correspondent et accorde un crédit partiel. Même sortie, score très différent — c'est pourquoi la métrique que vous choisissez change l'histoire.

:::tip[Quelle métrique croire est une question mesurée]
Pas chaque métrique ne suit le jugement humain également pour chaque langue. Pour certaines familles, BLEU corrèle à peine avec ce que les humains pensent ; pour d'autres, une métrique neurale sophistiquée est celle qui n'est pas fiable. Avant d'optimiser vers *n'importe quelle* métrique, vérifiez les preuves de [Fiabilité des métriques](/docs/network/specifications/metric-reliability) pour votre famille de langues — et si la réponse honnête est « non mesurée », dites-le plutôt que de faire confiance à un nombre.
:::

### Métriques neurales : COMET, MetricX

Au-delà du chevauchement de caractères/mots, les **métriques neurales** (COMET, COMET-QE, MetricX) utilisent un modèle entraîné pour *juger* les traductions plus comme un humain le ferait. Elles peuvent être beaucoup plus fiables — mais seulement pour les langues pour lesquelles elles ont été entraînées à juger, ce qui exclut la plupart des langues peu dotées en ressources. Elles fonctionnent également de manière dépendante de la direction : **MetricX** est **plus bas est mieux**, l'opposé de chrF++ — un détail qui vaut la peine de connaître avant de comparer les nombres.

### Barres d'erreur : ne faites jamais confiance à un seul nombre

Un score unique sans incertitude est un piège. Sur de petits ensembles de test, les différences ne sont souvent que du bruit.

> **Exemple travaillé.** « Le modèle s'est amélioré de 16,7 à 18,1 sur l'ensemble d'histoires orales » semble être un progrès — jusqu'à ce que vous remarquiez que l'ensemble a 37 phrases. Avec si peu de données, une variation de ±3 points est du pur hasard. Le rapport honnête est `17.4 [15.1, 19.8] 95% CI` : le nombre, plus l'**intervalle de confiance (IC)**
— la plage dans laquelle la vraie valeur tombe plausiblement. Si les intervalles de deux modèles se chevauchent fortement, vous ne pouvez pas affirmer que l'un est meilleur.

Un bon outillage refuse d'imprimer un score sans son IC, et utilise un [test de signification](/docs/network/specifications/significance) avant de déclarer une victoire A-bat-B.

### Batteries et registres

Le langage réel n'est pas une seule chose plate. Un **registre** (ou **domaine**) est une *sorte* de langage : conversation décontractée, exercice de manuel, article d'actualité, histoire orale, prose gouvernementale formelle. Un modèle peut être excellent dans l'un et faible dans l'autre.

Une **batterie** est un ensemble d'évaluation délibérément divisé en plusieurs registres, noté **séparément**, afin qu'une moyenne unique ne puisse pas cacher une faiblesse.

> **Exemple travaillé.** Un modèle marque 46 au total — respectable. Mais la ventilation de la batterie montre 58 sur les exercices de manuel et 22 sur les histoires orales. La moyenne cachait un échec quasi-total sur la parole naturelle. Seule la batterie par registre l'a révélé.

---

## 7. Fabriquer des données quand vous n'en avez pas assez

Lorsque les paires réelles sont rares, vous en fabriquez des synthétiques. Deux techniques dominent, et les deux vivent ou meurent sur un mot : **vérification**.

### FST et analyseurs morphologiques

Un **analyseur morphologique** est un outil qui connaît la grammaire des mots d'une langue : comment les racines se combinent avec les préfixes et suffixes pour faire des mots valides. Beaucoup sont construits comme des **FST** — *transducteurs à états finis*, une technologie précise et basée sur des règles (pas un réseau de neurones) qui peut fonctionner dans deux directions :

- **analyser** : étant donné un mot, le décomposer en racine + étiquettes grammaticales
  (`nipâw` → « dormir, troisième personne du singulier »).
- **générer** : étant donné une racine + étiquettes, épeler la forme correcte du mot
  (`sleep + 3sg` → `nipâw`).

Pour une langue polysynthétique — où un seul mot peut porter ce que l'anglais a besoin d'une phrase entière pour — un FST est de l'or : il peut épeler *n'importe quelle* forme valide de *n'importe quelle* racine connue, ce qui est exactement la matière première pour fabriquer des données d'entraînement.

### Vérification aller-retour — la règle qui rend les données synthétiques fiables

Fabriquer des données est dangereux : un générateur peut silencieusement émettre des absurdités. La discipline qui l'empêche est la **loi aller-retour** : chaque mot fabriqué doit survivre à *générer → analyser → la même analyse dont vous êtes parti*. Si vous demandez au FST d'épeler une forme et que vous la réintroduisez ensuite et que vous ne récupérez pas vos étiquettes, le mot est rejeté. Rien qui échoue le voyage aller-retour n'est jamais autorisé dans les données d'entraînement.

> **Exemple travaillé — la fuite d'un caractère.** Un dictionnaire a épelé un son avec la lettre `ý` ; l'analyseur attendait un simple `y`. Parce que personne n'a réconcilié les deux orthographes à la limite, *1 375 verbes* ont été silencieusement jugés « inconnus » et supprimés de la génération — pendant des semaines, invisiblement. La solution est un **canonicaliseur** : une fonction qui normalise l'orthographe à une seule convention *partout* où deux composants se rencontrent, plus un **audit d'entonnoir** qui compte combien d'éléments survivent à chaque étape du pipeline afin qu'une baisse silencieuse de 1 375 éléments ne puisse jamais se cacher à nouveau.

### Couverture, pas seulement volume

Un million de phrases fabriquées semblent complètes. Elles ne le sont pas, si ce sont un million de variations des mêmes quelques formes.

> **Exemple travaillé.** Un corpus synthétique de 1 000 000 paires s'est avéré contenir **aucun impératif** (« Vote ! »), **aucune question en wh** (« qui/où/quand »), **aucune possession** (« mon chien »), et **aucune forme inverse** (« elle me voit » — grammaire centrale dans de nombreuses langues). L'analyseur pouvait tous les générer ; les modèles ne les ont jamais demandés. Le volume cachait un trou structurel.

La défense est une **liste de contrôle de couverture** transcrite à partir d'une grammaire publiée : les phénomènes grammaticaux requis, chacun cité, afin que la construction échoue si l'un des requis a zéro exemples. Et un **plafond par type** empêche n'importe quelle forme de modèle de dominer — dans un corpus, deux formes représentaient 54 % des données, donc la moitié de l'« expérience » du modèle était deux motifs de phrases.

### Rétrotraduction

La **rétrotraduction** est l'autre grande technique synthétique, et elle est intelligente. Si vous avez du texte simple, *non traduit* dans votre langue cible (un corpus **monolingue** — beaucoup plus facile à trouver que du texte parallèle), vous pouvez :

1. prendre un modèle *inverse* (cible → anglais),
2. traduire automatiquement votre texte cible monolingue *en* anglais,
3. associer chaque phrase machine-anglais à la phrase cible **réelle** dont vous êtes parti, et
4. entraîner votre modèle avant (anglais → cible) sur ces paires.

Le côté cible est un langage authentique ; seul le côté anglais est synthétique — généralement un bon échange.

> **Exemple travaillé.** Vous avez 50 000 phrases réelles dans votre langue cible mais seulement 400 paires parallèles. Rétrotraduisez les 50 000 en anglais approximatif, et vous avez transformé du texte monolingue en 50 000 paires d'entraînement dont le côté *cible* est authentique.

:::danger[Auditez aussi votre texte monolingue pour les fuites]
La rétrotraduction semble sûre parce que « c'est juste du texte monolingue » — mais ce texte peut *être* vos données d'eval en déguisement. Dans un projet, l'audit de fuite a attrapé une récolte monolingue qui correspondait exactement à l'ensemble de test d'or. Auditez **chaque** entrée contre **chaque** ensemble d'eval, synthétique et monolingue inclus — pas seulement votre corpus parallèle évident.
:::

### Étiquetage des données synthétiques

Une dernière pratique : **étiquetez** les sources synthétiques avec un marqueur (comme `<synth>` ou `<bt>`) et laissez les données réelles (or) sans étiquette. Cela permet au modèle de distinguer le « matériel d'entraînement » de « la vraie chose », afin que les données authentiques ancrent son style de sortie ; au moment de la traduction, vous n'ajoutez pas l'étiquette, et le modèle s'appuie sur ce qu'il a appris de l'or. (Voir le [Livre de recettes de rétrotraduction](/docs/network/tutorials/back-translation) pour cette technique en profondeur.)

---

## 8. Comment les pièces se connectent

Lue de haut en bas, c'est un flux de travail :

1. Rassemblez les **données parallèles réelles** ([§1](#1-the-two-piles-training-data-and-evaluation-data)) — généralement trop peu.
2. **Divisez-les** de manière disjointe par groupe en train / dev / test ([§2](#2-splitting-train-dev-and-test), [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).
3. **Fabriquez** des données synthétiques pour combler l'écart — vérifiées aller-retour, couverture vérifiée, audit de fuite ([§7](#7-manufacturing-data-when-you-dont-have-enough)).
4. **Entraînez** sur le mélange, en regardant la **perte de dev / génération de dev** pour éviter le **surapprentissage** et survivre au **plateau** ([§3](#3-what-training-actually-does-loss-and-its-two-faces), [§5](#5-overfitting-early-stopping-and-the-plateau)).
5. **Décodez** la **batterie de test** retenue et notez-la avec des **métriques de crédit partiel + intervalles de confiance**, par **registre** ([§6](#6-measuring-quality-metrics-batteries-registers)).
6. Faites tout cela sans jamais laisser les réponses d'eval toucher l'entraînement ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)) — la règle que les cinq autres servent.

Chaque règle ici correspond à une vraie erreur mesurée qu'un vrai projet a commise et documentée. Vous n'avez pas à les mémoriser : la suite de formation mécanise chacune afin que le chemin honnête soit le défaut et les chemins malhonnêtes refusent avec une explication. C'est le sujet de la page suivante.

## Diriger votre agent avec ce vocabulaire

Parce que vous travaillerez par le biais d'un agent de codage, le gain pratique de cette page est que vous pouvez maintenant donner — et vérifier — des instructions comme celles-ci :

- *« Divisez le corpus de manière disjointe par groupe et vérifiez zéro chevauchement avant l'entraînement. »*
- *« Découpez un ensemble de dev du côté entraînement ; ne sélectionnez jamais les points de contrôle sur l'ensemble de test. »*
- *« Auditez chaque entrée contre chaque ensemble d'eval pour les fuites, y compris les données synthétiques et monolingues. »*
- *« Rapportez chrF++ avec des intervalles de confiance de 95 %, ventilés par registre. »*
- *« Vérifiez la fiabilité des métriques pour cette famille de langues avant d'optimiser vers n'importe quel score. »*

Si votre agent a le serveur Champollion MCP disponible, il peut appeler
`get_training_guardrails` pour extraire ces règles — et l'erreur que chacune tue — directement dans son contexte avant d'écrire une seule commande.

**Suivant :** mettez-le en pratique dans
[**Donc vous voulez entraîner votre propre modèle**](/docs/network/tutorials/train-your-own-model),
la procédure pas à pas — ou lisez
[**Entraîner un modèle honnêtement**](/docs/network/getting-started/training-honestly)
pour savoir comment la suite transforme chaque concept ici en garde-fou automatique.

Si des termes comme *tokenizer* sont encore flous, le guide d'initiation pour débutants est [Tokenizers](/docs/learn/tokenizers) — lisez-le une fois et tout ce qui précède deviendra plus facile.
