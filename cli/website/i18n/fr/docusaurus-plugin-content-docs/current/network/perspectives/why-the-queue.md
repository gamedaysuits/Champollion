---
sidebar_position: 5
title: "Pourquoi la file d'attente est construite de cette manière"
slug: '/network/perspectives/why-the-queue'
description: "La philosophie derrière la file d'attente de calcul communautaire : les tokens donnés constituent un budget, le maillage est la mission, et une liste de priorités est un ensemble de convictions qui doivent être documentées, critiquées et réfutables."
related:
  - label: "Queue Construction Specification"
    to: /docs/network/specifications/queue-construction
    kind: spec
    note: "The formula this philosophy commits us to"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Pourquoi la file d'attente est construite de cette manière

La file d'attente est l'artefact éditorial le plus conséquent que nous publions.
Chaque élément qu'elle contient dit : *si vous êtes disposé à dépenser quelques centimes de crédit API pour la traduction automatique vers des langues peu dotées en ressources, c'est le meilleur endroit que nous connaissions pour les dépenser.* Cette phrase porte des obligations. Cette page traite de ce qu'elles sont et de la manière dont la
[formule de construction de la file d'attente](/docs/network/specifications/queue-construction)
s'en acquitte.

## Une liste de priorités est un ensemble de convictions

Tout ordonnancement du travail encode les réponses à trois questions, qu'elles aient été écrites ou non :

1. **Qu'est-ce que nous valorisons ?** Qu'est-ce qu'une exécution complétée vaut réellement ?
2. **Qu'est-ce que nous croyons ?** Qu'attendons-nous qu'il se passe lorsqu'une exécution que nous n'avons pas encore essayée est exécutée ?
3. **Qu'admettons-nous ne pas savoir ?** Où la curiosité devrait-elle prévaloir sur la prédiction ?

La plupart des files d'attente de référence répondent à ces questions implicitement — « l'écart le plus grand en premier », « le modèle le plus récent en premier », la feuille de calcul de quelqu'un. Nous pensons qu'un projet demandant à des étrangers de dépenser de l'argent mérite des réponses explicites, dans une formule que quiconque peut recalculer, avec chaque entrée publiée. Non pas parce que les formules sont neutres — elles ne le sont pas, la nôtre encode notre mission et nos intuitions — mais parce que **un biais écrit peut être contesté, et un biais non écrit ne peut pas l'être.**

## Ce que nous valorisons : les chaînes, pas les cases cochées

Notre mission est *chaque langue vers chaque langue par des chaînes de paires mesurées individuellement*. L'infrastructure mondiale de traduction est centrée sur l'anglais ; la nôtre a commencé de la même manière — une étoile de repères eng→X. Mais une étoile ne mesure jamais qu'une seule chose : la distance par rapport à l'anglais. Les langues du monde méritent un *maillage* : quand aucun repère direct n'existe entre deux langues, une chaîne de paires mesurées devrait — et sa qualité devrait être quelque chose que nous pouvons estimer à partir de mesures plutôt que d'affirmer.

Ainsi, la valeur d'une exécution complétée n'est pas « une ligne de plus au classement ». C'est **à quel point le maillage entier s'améliore** : le gain dans notre objectif de capacité de chaîne pondérée par la qualité Φ, qui demande, pour chaque paire ordonnée de langues sur Terre que nous suivons, *à quel point la meilleure chaîne entre elles est-elle bonne en ce moment ?* Une exécution qui connecte une langue isolée vaut des centaines d'exécutions qui polissent un coin déjà brillant — et la formule dit exactement combien de centaines, au lieu de le laisser aux intuitions. C'est le même instinct qui a conduit M2M-100 à exploiter les « langues de pont » entre les familles plutôt que davantage de données appariées à l'anglais (Fan et al. 2021) — rendu continu, et pointé vers l'évaluation au lieu de l'entraînement.

Deux conséquences que nous acceptons délibérément :

- **Une exécution petite et bon marché sur une paire non mesurée bat généralement une exécution coûteuse sur une paire mesurée.** Le calcul contribué est un budget ; nous classons par gain de maillage *par dollar* (la règle gloutonne classique pour couvrir le plus sous un budget — Khuller, Moss & Naor 1999). Éclairer le centième bord fait plus pour la mission que dorer le premier.
- **Les chaînes estimées valent moins que les bords mesurés.** Notre modèle de chaîne multiplie les qualités des bords et applique une remise de fidélité par jonction de pivot, parce que quarante ans de résultats de traduction par pivot disent que le routage par une langue intermédiaire perd plus que la composition naïve ne le suggère (Utiyama & Isahara 2007 ; Wu & Wang 2007). La remise est l'incitation permanente de la formule à *mesurer la paire directe* plutôt que de se reposer sur une chaîne plausible.

## Ce que nous croyons : des prédictions assez simples pour être auditées

Pour valoriser une expérience non exécutée, vous devez prédire son résultat. Il y a un spectre ici, allant de « ne rien supposer » à « entraîner un modèle pour deviner ». Nous nous arrêtons délibérément tôt sur ce spectre : notre prédiction est une somme qu'un contributeur peut vérifier sur un coin de table — *comment cette paire de langues marque-t-elle généralement, comment ce modèle dévie-t-il généralement, existe-t-il des preuves d'entraînement pour cette langue exacte* — et rien d'autre. Pas de poids appris, pas d'embeddings, pas de modèle dont les propres biais auraient besoin d'être auditées.

Cela nous coûte en précision. Un prédicteur amélioré par gradient sur les caractéristiques linguistiques devinerait mieux. Nous échangeons cette précision pour une propriété que nous valorisons davantage : **chaque rang de la file d'attente est re-dérivable à la main à partir de nombres imprimés sur l'élément lui-même.** Quand quelqu'un demande « pourquoi cette exécution féroïenne est-elle #1 ? », la réponse est quatre nombres publiés et une phrase, pas « le modèle l'a dit ». La recherche en apprentissage actif a longtemps équilibré la sophistication de la sélection contre la confiance et l'inspectabilité (Haffari, Roy & Sarkar 2009 ont apporté exactement ce compromis à la traduction automatique) ; un repère financé par des bénévoles devrait être du côté inspectable.

## Ce que nous ne savons pas : la curiosité avec un budget

Une file d'attente pilotée purement par des prédictions a un mode de défaillance : elle affame avec confiance tout ce qu'elle prédit mal, et ne découvre jamais qu'elle avait tort. La réponse classique de la littérature sur les bandits est *l'optimisme face à l'incertitude* : donner à chaque option non essayée un bonus qui rétrécit à mesure que les preuves s'accumulent (Auer, Cesa-Bianchi & Fischer 2002). Notre file d'attente porte exactement ce bonus — mis à l'échelle, non par coïncidence, au plancher de bruit de nos instruments : l'optimisme ne dépasse jamais les ~5 points chrF++ que les petits corpus de développement ne peuvent pas distinguer de toute façon ([Corpus Design §6.3](/docs/network/specifications/corpus-design)).

La même humilité apparaît dans deux asymétries qui méritent d'être nommées :

- **Tout ce qui est publié est une preuve ; seuls les corpus ouverts sont des actions.** Les résultats sur les corpus à licence restreinte informent la connaissance du maillage, mais la file d'attente ne demande jamais aux contributeurs d'exécuter que ce que quiconque peut librement exécuter.
- **Les preuves d'entraînement ne voyagent pas.** Quand les exécutions entraînées battent les exécutions naïves, c'est un fait mesuré pour cette langue — et le silence sur toutes les autres. La file d'attente maintient l'ordonnancement de base en premier partout où l'entraînement n'est pas mesuré, plutôt que de supposer que les gains d'une langue se généralisent.

## Ce que nous refusons de faire

- **Pas d'optimisation de l'engagement.** Les éléments ne sont jamais ordonnés pour maximiser les clics, les séries ou la satisfaction d'achèvement. L'objectif du maillage est le seul objectif.
- **Pas de coup de pouce éditorial caché.** Si nous avons jamais besoin de booster une paire (un partenariat communautaire, une date limite), cela apparaîtra comme un terme nommé et versionné dans la spécification — pas comme un re-tri silencieux.
- **Pas de verrouillage de réclamation.** Quiconque peut exécuter n'importe quel élément à n'importe quel moment ; les exécutions identiques se dédupliquent par empreinte digitale et les réplications indépendantes sont les bienvenues comme preuves. Une position de file d'attente est un conseil, pas une permission.
- **Pas de théâtre de capacité.** Φ et chaque score l'alimentant sont des nombres d'ensemble de développement avec des mises en garde connues (limites supérieures de contamination, différences d'échelle entre langues). Ils orientent les dépenses ; ils ne sont jamais cités comme ce qu'un modèle « peut faire ».

## Construit pour se tromper en public

La formule est versionnée (`ecv-v2`), ses paramètres sont répétés dans chaque file d'attente publiée, et son hypothèse de modélisation centrale — que la qualité de la chaîne se compose multiplicativement avec une remise par jonction — est maintenant *testable avec nos propres données* : le maillage contient des triangles mesurés (deu→fra direct aux côtés de deu→eng et eng→fra), donc nous pouvons évaluer les traductions chaînées réelles par rapport aux prédictions du modèle et adapter la remise empiriquement au lieu de la choisir. Quand cela se produira, v3 le dira, et cette page expliquera ce qui a changé et pourquoi. C'est la norme à laquelle nous voulons être tenus : non pas une file d'attente qui a toujours raison, mais une dont le raisonnement est toujours consigné.

*Les mathématiques, les valeurs par défaut, l'exemple travaillé et les citations complètes se trouvent dans la [Spécification de construction de la file d'attente](/docs/network/specifications/queue-construction).*
