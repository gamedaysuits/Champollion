---
sidebar_position: 8
title: "L'engagement sur les artefacts dérivés"
description: "À qui appartiennent les modèles, les mémoires de traduction et les standards d'évaluation construits à partir des données linguistiques des communautés : pas à nous. Champollion est une infrastructure permettant aux communautés de construire et de posséder les leurs."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The corpus-side position: data stays with its stewards"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
    note: "How infrastructure custody hands over to communities"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
    note: "The ground rules, in plain language"
---

# L'Engagement sur les Artéfacts Dérivés

La position sur la [Gouvernance des données](/docs/network/sovereignty/data-sovereignty)
couvre les *entrées* : les corpus restent avec leurs gardiens, nous n'hébergeons ni ne
redistribuons jamais les données de la communauté. Cette page couvre les *sorties* — les éléments qui
sont **construits à partir** des données linguistiques : les modèles entraînés et leurs poids,
les mémoires de traduction, les ajustements fins (fine-tunes), les ensembles d'entraînement, les normes d'évaluation et
les artéfacts d'exécution.

L'engagement, en une phrase :

> **Nous ne revendiquons aucune propriété sur aucun modèle linguistique ou artéfact dérivé
> de la langue construit à partir des données d'une communauté — et nous n'en avons aucunement le désir. Le
> but même de ce projet est de remettre le contrôle de ces technologies, tant au niveau du développement
> que de la propriété, entre les mains des locuteurs.**

Champollion est une **infrastructure**. Une route ne possède pas les marchandises qui y
transitent.

## Ce que cela signifie concrètement

**Les modèles appartiennent aux personnes dont ils parlent la langue.** Si un modèle est
entraîné sur les données d'une communauté — avec nos outils ou ceux de quiconque — les
poids, les ajustements fins et chaque dérivé suivent les conditions de la communauté, et non les nôtres.
Nous ne prenons pas de copies, nous ne modifions pas les licences, et nous ne considérons pas le fait
d'avoir « écrit le script d'entraînement » comme un droit de propriété sur ce qu'il a produit.
La leçon est historique, et non hypothétique : les communautés linguistiques ont
vu à maintes reprises des organisations extérieures enregistrer, compiler ou s'entraîner sur leur
langue, puis conserver les résultats — droits d'auteur sur les enregistrements des aînés,
modèles entraînés sur des données vocales extraites (scraped) — alors que les locuteurs eux-mêmes devaient demander
la permission pour utiliser leurs propres voix. C'est ce type d'échec que cet
engagement vise à exclure.

**Le travail sur le cri des plaines (nêhiyawêwin) est le cas test, et la réponse est
déjà fixée.** Rien de ce qui est construit pour le cri dans ce projet ne nous appartient — ni le
corpus d'entraînement (utilisé avec la permission de ses détenteurs et jamais
redistribué), ni les pipelines entraînés, ni aucun modèle entraîné. Tout modèle cri
produit dans le cadre de ce travail sera diffusé **uniquement à une autorité communautaire reconnue**
— une autorité éducative, un conseil des Aînés, ou tout autre organisme que la communauté
elle-même désignera — selon les propres conditions de la communauté, et à personne d'autre.
Il n'existe aucune version de ce projet où un modèle cri serait distribué comme un produit.
Le travail d'évaluation du cri est également **entièrement non commercial** :
tout au plus, Champollion maintient la méthodologie d'évaluation *générique*
(la norme LYSS — l'idée d'une notation intensionnelle, sensible à la morphologie et
transparente en cas d'échec). L'**instanciation crie** de cette norme — les
connaissances linguistiques qu'elle encode et par rapport auxquelles elle valide — n'est pas quelque chose que nous
possédons ; son utilisation commerciale est réservée dans l'attente d'une consultation avec la
communauté linguistique nêhiyaw, et les conditions de la communauté prévalent.

**Les scores voyagent ; les artéfacts, non.** Le classement publie des *mesures*
— une valeur chrF++, un taux de validation, un intervalle de confiance — avec la méthode
et le corpus identifiés. Il ne publie, n'héberge ni n'exige jamais le modèle
lui-même, le contenu du corpus ou les sorties au-delà de ce que les conditions du gardien
autorisent. Si une communauté souhaite que la ligne de sa langue soit retirée de la vue du public,
les [voies d'enregistrement](/docs/network/sovereignty/registering-corpora) existent
précisément pour que l'exposition soit leur curseur, et non le nôtre.

## L'infrastructure signifie : vos données, votre construction, vos clés

Trois formes concrètes de ce à quoi ressemble en pratique l'affirmation « nous ne sommes qu'une infrastructure » :

1. **Une communauté construit son propre corpus.** Elle utilise la CLI sur ses propres
   machines ; le corpus réside là où elle le place. Si elle choisit de l'enregistrer
   pour l'évaluation des performances, le registre stocke un *pointeur et une somme de contrôle* —
   récupération depuis la source, sous sa licence, retirable à sa demande. Le
   corpus n'entre jamais dans notre dépôt ou notre stockage. Cela est appliqué par
   des mécanismes que vous pouvez inspecter : le dépôt public intègre les barrières de quarantaine et
   les déclencheurs de base de données qui rendent l'hébergement du contenu de la communauté structurellement
   impossible, et pas seulement impoli.

2. **Une communauté entraîne son propre modèle.** La suite d'entraînement
   ([nmt-forge](https://github.com/gamedaysuits/Champollion)) s'exécute sur son
   matériel ; les points de contrôle et les poids n'existent que là-bas. Le harnais d'évaluation
   le note ; le classement enregistre le score. Nous ne possédons jamais le modèle. Si
   elle souhaite qu'il reste privé pour toujours, il le reste — une ligne de score est la seule trace
   publique, et uniquement si elle en publie une.

3. **Une communauté exécute sa propre évaluation.** Avec les
   [concours souverains](/docs/network/sovereignty/run-a-sovereign-contest),
   l'ensemble de test reste scellé sur une infrastructure contrôlée par la communauté ; les méthodes
   viennent *aux* données ; seuls les scores agrégés en sortent. La communauté décide
   qui peut évaluer, à quelles conditions, et peut arrêter à tout moment.

Dans tous les cas, la direction du mouvement est la même : la capacité se déplace vers
la communauté ; les données et leurs dérivés ne s'en éloignent pas.

## Les cadres de référence dont nous nous inspirons

Nous sommes **inspirés par, et aspirons à suivre,** les cadres de gouvernance des données autochtones
que les communautés elles-mêmes ont construits. Il ne nous appartient pas de nous
juger conformes à l'un d'entre eux — ce jugement appartient aux communautés et aux institutions
qui en sont les auteurs. Ce que nous pouvons faire, c'est concevoir dans leur direction,
les désigner comme les références en la matière, et dire clairement que nous apprécierions
profondément l'opportunité d'écouter et de travailler avec ces experts pour améliorer ce système dans leur esprit :

- **Les principes de souveraineté des données des Premières Nations** — la propriété, le contrôle,
  l'accès et la possession par une communauté de ses propres informations :
  précisément les quatre capacités que cette page s'engage à maintenir entre les mains de la communauté.
- **Les principes CARE pour la gouvernance des données autochtones** (Bénéfice Collectif,
  Autorité de Contrôle, Responsabilité, Éthique), de la Global Indigenous Data Alliance —
  la lentille correctrice des données purement « ouvertes » : l'ouverture n'est pas une vertu
  lorsqu'elle dépouille un peuple de l'autorité sur ses propres connaissances.
- **Te Mana Raraunga**, la charte du réseau de souveraineté des données maories —
  les données en tant que taonga (trésor) vivant, avec les droits et responsabilités qui
  les accompagnent.
- **La licence Kaitiakitanga** (Te Hiku Media) — à notre connaissance,
  l'exemple fonctionnel le plus clair de souveraineté des artéfacts dérivés dans les technologies
  linguistiques : Te Hiku a construit des modèles vocaux *à partir de* et *pour* le te reo Māori et
  en concède l'accès sous des conditions de tutelle, afin que les modèles profitent aux Maoris et
  restent sous gouvernance maorie. Lorsque nous disons que « les modèles appartiennent aux locuteurs »,
  Te Hiku est la preuve existante que cela fonctionne.
- **Le modèle de recherche participative de Masakhane** — le TAL africain construit par des
  locuteurs-chercheurs en tant que co-auteurs et propriétaires plutôt que comme sources de données ; la
  démonstration que le *processus* de construction de technologies linguistiques peut
  lui-même constituer le transfert de capacité.

Il s'agit de cadres différents issus de peuples différents avec des positions juridiques
et culturelles différentes — nous les nommons côte à côte plutôt que de les regrouper
sous une seule étiquette. Là où notre conception n'est pas à la hauteur de leur esprit, il s'agit
d'un défaut à corriger, et nous préférerions l'entendre de la part des experts plutôt que de le découvrir
lors d'une analyse a posteriori (postmortem). Si vous travaillez dans ce domaine et êtes prêt à nous dire
ce que nous avons mal fait : **cette conversation est la contribution la plus précieuse
que ce projet puisse recevoir.** Contactez-nous via
[Participer](/get-involved).

## Ce que nous possédons

Par souci de clarté, les éléments que Champollion revendique *effectivement* : le code de l'infrastructure
(CLI, harnais, suite d'entraînement — chacun sous sa licence publiée), la méthodologie
d'évaluation générique, et les *mesures dérivées* de l'index (qui portent la provenance `champollion-derived`
précisément pour qu'elles ne soient jamais attribuées à tort à une communauté ou à une source en amont). C'est
la boîte à outils. Ce que vous construisez avec vous appartient.

