---
title: "Ce que signifie la souveraineté des données lorsqu'on l'intègre dans un logiciel"
sidebar_label: "Souveraineté des données"
description: "La souveraineté des données autochtones est un ensemble de principes concernant la propriété, le contrôle, l'accès et la possession des données. Voici à quoi ressemblent ces principes lorsqu'on essaie de les intégrer dans un logiciel fonctionnel — et ce que cette tentative ne peut pas prétendre accomplir."
---

# Ce que signifie la souveraineté des données lorsqu'elle est inscrite dans un logiciel

:::info[À qui s'adresse ce document]
À tout le monde. Aucune connaissance préalable en droit, en apprentissage automatique ou en gouvernance autochtone n'est
présumée. Si vous vous êtes déjà demandé ce qu'il faudrait réellement pour qu'une communauté
conserve le contrôle de ses propres données linguistiques une fois que les ordinateurs entrent en jeu, cette page
en est la réponse détaillée.
:::

La plupart des discussions sur les données et le consentement s'arrêtent à la permission : quelqu'un a-t-il dit oui.
La souveraineté des données pose un ensemble de questions plus complexes. À qui **appartient** ceci ? Qui décide
de ce qu'il en advient ? Qui peut y accéder ? Où cela se trouve-t-il physiquement ?

Ces questions ne sont pas apparues de nulle part. Elles ont été formulées en premier et avec la plus grande force par les peuples autochtones.

---

## 1. Les questions — et qui les a posées en premier

Les Premières Nations au Canada ont formulé les principes de souveraineté des données que sont la **propriété, le contrôle, l'accès et la possession** comme une affirmation de compétence sur leurs propres informations — nés d'une histoire documentée de recherches menées *sur* les communautés plutôt qu'*avec* elles, et dont les données qui en résultaient ne revenaient jamais.

Cette origine n'est pas anecdotique. Il ne s'agit pas d'une liste de contrôle éthique à usage général que quiconque peut s'approprier ; ce sont des affirmations de compétence, formulées par des peuples précis dans des contextes juridiques et culturels précis, et elles appartiennent aux communautés qui les ont établies.

Les quatre questions, brièvement :

| | La question à laquelle il répond |
|---|---|
| **Ownership** (Propriété) | À qui appartiennent ces informations ? Une communauté possède collectivement ses connaissances culturelles et ses données — de la même manière qu'une personne possède ses propres informations personnelles. |
| **Control** (Contrôle) | Qui décide de ce qu'il en advient ? Les communautés contrôlent chaque étape de tout ce qui les concerne : ce qui est collecté, comment, par qui, pour quoi, et ce qui en est fait par la suite. |
| **Access** (Accès) | Qui peut y accéder ? Les communautés doivent pouvoir accéder aux informations les concernant, où qu'elles soient conservées et quel que soit leur détenteur. |
| **Possession** (Possession) | Où cela se trouve-t-il physiquement ? Ce n'est pas la même chose que la propriété — la possession est le fait concret de la garde, et c'est le mécanisme qui rend les trois autres principes applicables plutôt que simplement promis. |

Des cadres distincts existent et ne sont pas interchangeables : **CARE** (*Collective Benefit, Authority to Control, Responsibility, Ethics* — Bénéfice collectif, Autorité de contrôle, Responsabilité, Éthique) pour la gouvernance des données autochtones au sens large, et **Te Mana Raraunga** pour la souveraineté des données maories, entre autres. Chacun a émergé dans son propre cadre juridique et culturel. Utiliser le nom d'un cadre pour désigner les principes d'un autre constitue une forme d'effacement en soi.

---

## 2. Pourquoi les logiciels rendent cette question cruciale

Un principe peut survivre sur papier en tant que bonne intention. Les logiciels forcent la
question, car un ordinateur n'agit pas selon des intentions — il agit selon ce qui a été
construit.

Considérez la manière ordinaire dont un système de traduction est évalué. Pour savoir
si un système traduit bien votre langue, quelqu'un a besoin d'un **test set** :
des phrases dans votre langue, associées à leur signification. Presque toutes les plateformes d'évaluation
vous demandent de **téléverser** ce test set afin qu'il puisse servir de base de notation.

Relisez cela en gardant les quatre questions à l'esprit. Le téléversement transfère la
possession. Il transfère généralement le contrôle pratique — une fois qu'une copie existe sur
la machine de quelqu'un d'autre, votre capacité à dire « stop » est une requête, et non une
capacité. L'accès devient quelque chose qui vous est accordé plutôt que quelque chose que vous
possédez. La propriété survit sur le papier et perd une grande partie de son sens.

Pour une communauté dont les données linguistiques ont déjà été extraites par le passé, « téléversez-les et faites-nous
confiance » n'est pas une demande neutre. Cela prend la même forme que ce qui s'est déjà
produit.

---

## 3. Quels sont réellement les mécanismes

La position de ce projet est que si la souveraineté est réelle, elle doit être une propriété
du logiciel, et non un paragraphe dans une politique. Voici à quoi cela ressemble
concrètement. Ces mécanismes sont décrits afin que vous puissiez les évaluer et en débattre.

**Enregistrement sans cession.** Un test set est enregistré en décrivant
*où il réside* et en épinglant un hachage cryptographique de son contenu exact — et non en
téléversant les phrases. Au moment de l'évaluation, le système récupère les données depuis la source,
vérifie que le hachage correspond, et attribue une note. Rien n'est stocké. Si le détenteur met la
source hors ligne, le corpus cesse simplement d'être évaluable. Le contrôle reste là où il
a commencé, car la possession n'a jamais été transférée.

**Chiffrement avant départ, pour le niveau le plus strict.** Lorsqu'un corpus doit être utilisable sans jamais être lisible, il est chiffré **sur l'appareil même de son détenteur**, et le texte chiffré reste chez le détenteur. Ce que ce projet reçoit est une description ne contenant aucun contenu.

**Aucune partie ne peut déchiffrer seule.** La clé est conçue pour être partagée entre un groupe de dépositaires de sorte qu'un certain nombre d'entre eux — disons trois sur cinq — doivent agir conjointement pour autoriser quoi que ce soit. Aucun dépositaire ne peut agir seul, pas plus que ce projet : par conception, **Champollion ne détient aucune part**, et ne pourrait donc déchiffrer avec ou sans la coopération de quiconque. Une exécution aurait lieu parce qu'un quorum de dépositaires a décidé qu'elle devait avoir lieu.

> **Où en sont réellement les choses.** Le mécanisme est conçu et testable, mais il n'a pas encore été exécuté avec de véritables dépositaires. *Aucun dépositaire n'a été nommé* — la composition relève des communautés concernées, et aucun groupe n'a encore consenti à détenir des parts. En attendant, il n'existe pas d'ensemble actif de dépositaires, et ce projet ne désignera aucun candidat publiquement. Considérez donc le paragraphe ci-dessus comme un mécanisme fonctionnel en attente des relations qui le feraient opérer, et non comme quelque chose d'actif aujourd'hui.

**Résultats sans exposition.** Ce qui revient d'une évaluation scellée, ce sont
des scores, pas des phrases. Il est possible de prouver qu'une méthode fonctionne sur un corpus que
l'auteur de la méthode, ainsi que ce projet, n'ont jamais lu.

**Consentement avant transmission.** L'envoi de texte à l'API d'un modèle externe est en soi
une divulgation. Les corpus sous licences communautaires, sur mesure ou non spécifiées **refusent**
l'évaluation à distance jusqu'à ce que le détenteur des droits en ait explicitement enregistré la permission.
Ce refus est appliqué dans le code, et aucun processus automatisé ne peut accorder la
permission au nom d'une communauté.

**Réversibilité dans une seule direction.** L'exposition peut être assouplie par une
décision délibérée du détenteur. Elle ne s'assouplit jamais par défaut, par accident, ou
pour la convenance de quelqu'un d'autre.

---

## 4. Ce que ceci n'est pas

**Ce projet n'est ni validé, ni certifié, ni approuvé au regard d'aucun cadre de souveraineté des données autochtones. Aucune évaluation n'a eu lieu, aucune n'est en attente, et aucune n'est implicite.**

Ce qui existe est une **tentative de mettre en œuvre la souveraineté des données dans le code** — de prendre des principes formulés par des peuples autochtones et de les exprimer sous forme de mécanismes fonctionnels plutôt que d'engagements. Cette tentative est la nôtre. Il ne nous appartient pas d'affirmer qu'elle réussit. Les décisions de conformité reviennent aux communautés concernées, et un projet revendiquant sa propre conformité reproduirait en miniature la posture exacte que ces principes visent à corriger : la personne extérieure décidant de ce qui constitue un traitement adéquat des informations d'une communauté.

Rien de tout cela n'est non plus une garantie d'impossibilité. Les logiciels ont des défauts. Les opérateurs
font des erreurs. Une partie déterminée détenant suffisamment de rôles clés constitue un
risque résiduel qu'aucune architecture ne peut éliminer. L'affirmation est plus restreinte et, nous le pensons,
plus utile : **les voies faciles sont fermées, et les voies difficiles laissent des traces.**

Il existe également des écarts entre les principes et les mécanismes, et nous préférons
les nommer plutôt que de vous laisser les découvrir. La possession est le principe que ces
mécanismes servent le mieux — le code est véritablement efficace pour ne pas détenir les choses.
La propriété et le contrôle vont plus loin que ce que le logiciel peut accomplir seul, s'étendant aux conditions,
à la gouvernance et aux relations qu'aucune quantité de cryptographie ne peut régler. De plus, chaque
mécanisme ci-dessus présuppose une communauté qui possède déjà la capacité et
l'infrastructure nécessaires pour détenir ses propres données, ce qui n'est pas une hypothèse neutre.

---

## 5. Nous vous invitons à en débattre

Cette tentative est ouverte à la critique, et cette invitation n'est pas une simple formule de politesse.

Si vous travaillez sur la gouvernance des données autochtones, CARE, Te Mana Raraunga ou les technologies pour les langues autochtones — ou si vous êtes membre ou représentant d'une communauté dont la langue figure dans cet index —, nous souhaitons savoir ce qui est inexact ici. Plus précisément :

- lorsqu'un mécanisme ne fait pas ce que le principe exige ;
- lorsque la formulation dénature les principes d'une communauté ou s'approprie indûment leur autorité ;
- lorsque quelque chose est décrit comme protecteur alors qu'il ne vous protégerait pas ;
- lorsqu'une communauté aurait besoin de quelque chose que nous n'avons pas conçu ;
- lorsque le vocabulaire lui-même est inapproprié.

Les objections et les corrections peuvent être soulevées via la
[voie de contact et de retrait](/docs/network/community/contact-objections-takedown),
qui couvre également les demandes de suppression de tout élément concernant une langue que vous
représentez. Il n'est nullement nécessaire de faire preuve de diplomatie à ce sujet.

Le fait de ne pas avoir été révisé est une réalité de ce travail, et non une défense de celui-ci. Une tentative qui
invite à la révision est honnête ; celle qui ne le fait pas est une simple allégation.

> Cette page décrit une tentative d'aller vers des principes dont les auteurs sont les communautés elles-mêmes — consultez ces principes tels que leurs auteurs les énoncent ; cette tentative n'est approuvée par aucune des organisations qui en assurent la garde.

---

## Pour aller plus loin

- [Gérance des données](/docs/network/sovereignty/data-sovereignty) — la position opérationnelle, plus en profondeur.
- [Enregistrement de corpus](/docs/network/sovereignty/registering-corpora) — les quatre niveaux d'exposition, et ce qui quitte votre machine pour chacun d'eux.
- [Exécuter un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) — la cérémonie des gardiens, de bout en bout.
- [Limites honnêtes](/docs/network/honest-limitations) — ce que ce projet ne prétend pas faire.
- [Pour les communautés linguistiques](/docs/network/community/for-language-communities) — le point de départ pratique.
