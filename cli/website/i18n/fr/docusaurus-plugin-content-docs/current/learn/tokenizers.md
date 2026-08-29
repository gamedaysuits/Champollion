---
title: "Comment un tokenizer décide quelles langues sont peu coûteuses"
sidebar_label: "Tokenizers"
description: "Avant qu'un modèle de langage ne lise un mot, quelque chose le découpe en morceaux. Cette étape est apprise à partir des données, optimise la compression plutôt que le sens, et décide discrètement quelles langues sont coûteuses à utiliser. Une introduction pour les lecteur·rice·s qui partent de zéro."
---

# Comment un tokeniseur décide quelles langues sont peu coûteuses

:::info[À qui s'adresse cette page]
À tout le monde. Cette page ne présuppose aucune connaissance en apprentissage automatique ni en linguistique.
Si vous savez ce qu'est un modèle de langage — un logiciel qui prend du texte et
produit du texte — cela suffit.
:::

Chaque modèle de langage comporte une première étape invisible. Avant de lire un mot, un
logiciel découpe ce mot en fragments. Ces fragments sont ce que le
modèle voit réellement.

Cette étape s'appelle la **tokenisation**, et presque personne ne s'y intéresse. Elle mérite
pourtant qu'on s'y attarde, car c'est à ce stade que certaines langues deviennent plusieurs fois
plus coûteuses à utiliser que d'autres — et la décision est prise avant même que quiconque
ne pense à la qualité, à l'équité ou à la couverture.

---

## 1. Un modèle ne sait pas lire

Un réseau de neurones effectue des opérations arithmétiques sur des nombres. Il n'a aucune notion de lettres ou
de mots. Le texte doit donc d'abord devenir des nombres.

Un **tokeniseur** est le logiciel qui effectue cette conversion, et l'inverse
à la fin. Il transforme une chaîne de caractères en une liste d'entiers, chaque entier pointant
vers une ligne dans une grande table de correspondance.

Il prend deux décisions :

**Le vocabulaire** — l'inventaire fixe des morceaux que le modèle est autorisé à voir.
Pas des mots : des *morceaux*. Les plus courants sont des mots entiers, mais les éléments plus rares sont décomposés.
L'inventaire a une taille fixe, choisie à l'avance — souvent des dizaines de
milliers d'entrées.

**La segmentation** — pour toute chaîne de caractères réelle, quels morceaux, dans quel ordre. Le
mot *unbelievable* pourrait devenir `un` + `believ` + `able`, ou un seul morceau, ou
onze lettres individuelles. Le résultat obtenu dépend entièrement de ce qui se trouve dans le
vocabulaire.

> **Exemple pratique.** Si `believ` est dans le vocabulaire, *unbelievable* coûte
> trois morceaux. S'il n'y est pas, le tokeniseur se rabat sur des fragments de plus en plus
> petits jusqu'à ce qu'il puisse couvrir le mot — potentiellement un morceau par lettre. Même
> mot, même sens, trois fois plus de morceaux ou onze fois plus de morceaux,
> selon une décision prise bien avant que vous ne l'ayez tapé.

---

## 2. Le vocabulaire est *appris*, et il optimise la mauvaise chose

Voici la partie qui surprend les gens.

Le vocabulaire n'est pas conçu par un linguiste. Il est **appris à partir d'un amas de
textes**, par un algorithme dont le but est la **compression** — couvrir ce texte avec le
moins de morceaux possible.

Le sens ne joue aucun rôle. L'algorithme n'a aucune idée de ce qu'est un mot, de ce qu'est un préfixe,
ni même de l'existence d'une langue. Il compte ce qui apparaît souvent ensemble, et donne
aux séquences fréquentes leur propre entrée car cela raccourcit le texte.

La conséquence en découle mécaniquement. Les morceaux sont alloués à une langue à peu près
en proportion de **la quantité de cette langue présente dans l'amas**. Une langue qui
représentait une part importante obtient de nombreux morceaux dédiés, et ses mots ressortent entiers
ou presque entiers. Une langue qui n'y figurait presque pas n'obtient presque aucun morceau
propre, et ses mots sont couverts par les fragments génériques qui s'y adaptent par hasard.

Une langue qui n'était pas du tout dans l'amas obtient **zéro** morceau dédié. Cela
fonctionne quand même — le tokeniseur trouvera toujours un *certain* moyen de représenter le texte,
car il peut se rabattre sur des caractères individuels ou des octets bruts. Il en coûte simplement
beaucoup plus cher pour dire quoi que ce soit.

:::note[Ce n'est pas un bug]
Rien n'a mal fonctionné. L'algorithme de compression a fait exactement ce qu'on lui a
demandé. Le problème est que « rendre le texte d'entraînement court » a été accepté comme un
substitut pour « bien représenter la langue », et pour les langues absentes de ce texte, ce
substitut échoue complètement.
:::

---

## 3. La fertilité : le nombre qui nomme les dégâts

La **fertilité** est le nombre moyen de tokens que coûte un mot.

Pour une langue sur laquelle le tokeniseur a été massivement entraîné, la fertilité est proche de 1 —
la plupart des mots constituent un seul morceau. Pour une langue qu'il n'a jamais vue, cette même mesure peut
être plusieurs fois supérieure, car chaque mot doit être assemblé à partir de fragments.

Ce seul nombre se répercute en quatre taxes distinctes :

| Taxe | Ce que cela signifie |
|---|---|
| **Coût** | La plupart des modèles commerciaux facturent au token. Plus de tokens par mot signifie que la même phrase coûte plus d'argent à traduire, à résumer ou à générer. |
| **Contexte** | Les modèles ont une fenêtre fixe. Une fertilité élevée signifie qu'une plus petite partie de votre document réel peut y tenir. |
| **Calcul** | Les séquences plus longues sont plus lentes, partout, pour toujours. |
| **Apprentissage** | La plus difficile. Le sens est désormais étalé sur de nombreux fragments à faible teneur en information, le modèle a donc un problème plus difficile à résoudre — même avec des données identiques. |

Les trois premières sont injustes. La quatrième est celle qui nuit à la qualité.

**Ceci est mesuré, et non affirmé.** Petrov, La Malfa, Torr et Bibi ont découvert que
le même texte, traduit dans différentes langues, peut différer en longueur tokenisée
de **jusqu'à 15 fois**, et que la disparité persiste dans les tokeniseurs
construits délibérément pour un usage multilingue.

Leur découverte complique la solution évidente : les modèles au niveau des caractères et des octets
— la réponse intuitive, « utilisez simplement des lettres, ainsi chaque langue est égale » —
ont tout de même montré **plus de 4 fois** la différence pour certaines paires de langues. Se rabattre
sur des unités plus petites réduit l'écart. Cela ne le comble pas.

> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.
> *Language Model Tokenizers Introduce Unfairness Between Languages.*
> [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/74bb24dca8334adce292883b4b651eda-Abstract-Conference.html).

---

## 4. Pourquoi cela frappe certaines langues structurellement, et non seulement statistiquement

La sous-représentation dans l'amas d'entraînement est une cause. Il y en a une seconde, et
elle ne disparaît pas en ajoutant des données.

Les langues diffèrent quant à la quantité de travail qu'accomplit un seul mot.

En anglais, une phrase est principalement constituée de mots séparés à la suite : *I saw them*. Trois
mots, trois concepts, des espaces entre eux. Les tokeniseurs ont été construits par des personnes
travaillant sur des langues qui se comportent de cette manière, et ils le présupposent — la plupart d'entre eux
traitent littéralement un espace comme une limite de morceau.

D'autres langues intègrent une proposition entière dans **un seul mot**, en empilant des parties
porteuses de sens. Les linguistes appellent ces langues des langues **polysynthétiques**, et elles sont
courantes parmi les langues autochtones des Amériques, et ailleurs.

> **Exemple pratique.** En Plains Cree (nêhiyawêwin), *nikî-wâpamâwak* signifie
> approximativement « je les ai vus ». C'est un seul mot. À l'intérieur se trouvent plusieurs parties porteuses de sens :
> qui agit, le fait que l'action est au passé, l'action de voir elle-même, et qui est
> vu.
>
> Un anglophone utilise quatre mots pour cela, et un tokeniseur entraîné sur
> l'anglais dépensera probablement quatre morceaux. Un tokeniseur qui n'a jamais vu le Plains Cree
> n'a d'entrée pour aucune de ces parties, il déchiquette donc ce mot unique en
> fragments qui ne respectent aucune des limites porteuses de sens.

Deux choses sont brisées à la fois. Le mot coûte beaucoup plus de morceaux qu'il ne le devrait —
et les morceaux **coupent à travers les unités de sens**, le modèle doit donc
réassembler une structure que le tokeniseur vient de détruire.

Ajouter davantage de texte en Cree à l'amas d'entraînement améliore le premier problème. Cela n'aide
qu'en partie pour le second, car l'algorithme optimise toujours la compression,
et la compression ignore qu'une limite est porteuse de sens.

---

## 5. De la tokenisation à une mauvaise réponse

La chaîne allant d'une « mauvaise segmentation » à un « résultat erroné » est courte.

1. Le tokeniseur coupe un mot à des limites qui ne portent aucun sens.
2. Le modèle apprend des associations plus faibles, car le même concept apparaît sous
   de nombreuses orthographes de fragments différentes au lieu d'un seul morceau cohérent.
3. Lors de la génération, le modèle assemble le résultat fragment par fragment.
4. Des fragments qui sont individuellement plausibles peuvent se combiner en un mot qui **n'existe
   pas** dans la langue.

Cette dernière étape est celle qu'il faut retenir. Dans une langue où les mots sont construits à partir de
parties, un modèle peut produire quelque chose qui semble bien formé pour quiconque ne
la parle pas — des morceaux d'apparence correcte, assemblés en un mot qu'aucun locuteur ne
dirait jamais.

L'évaluation automatique standard ne le détectera souvent pas, car ces scores mesurent principalement
le chevauchement avec une réponse de référence, et un mot erroné composé de fragments d'apparence correcte
peut tout de même présenter un chevauchement.

:::danger[Pourquoi cela importe au-delà des scores de qualité]
Un résultat qui est fluide et erroné est plus dangereux qu'un résultat qui est manifestement
cassé. Un lecteur qui ne parle pas la langue n'a aucun moyen de le savoir. C'est en
grande partie pourquoi Champollion insiste sur la validation par des personnes qui parlent la
langue, et sur des vérifications structurelles qui demandent « est-ce un vrai mot ? » plutôt que
seulement « cela ressemble-t-il à la réponse attendue ? »
:::

---

## 6. Qui décide, et pourquoi c'est le véritable enjeu

Tout ce qui précède découle d'un seul choix : **quel texte a été inclus dans l'amas à partir duquel le
tokeniseur a appris.**

Quiconque fait ce choix décide de la manière dont chaque langue sera découpée, de ce qu'il
en coûtera pour l'utiliser, et des efforts que le modèle devra fournir pour la représenter. Cette
décision est prise une seule fois, très tôt, généralement par un petit groupe, et elle est effectivement
permanente pour la durée de vie de ce modèle — le tokeniseur n'est pas quelque chose que vous pouvez
ajuster par la suite.

Elle n'est par ailleurs presque jamais discutée. Les débats sur les technologies linguistiques portent généralement
sur les données, la taille des modèles et les scores de qualité. L'étape qui décide si une
langue est représentable ou non se situe en dessous de tout cela, et est traitée comme de la
plomberie.

C'est pourquoi cette page existe. Si une communauté souhaite un véritable contrôle sur la façon dont sa
langue est traitée par les machines, contrôler les données n'est pas suffisant. La
question *"qui a décidé comment nos mots sont découpés en morceaux ?"* a une réponse, et
pour la plupart des langues du monde, cette réponse est actuellement : quelqu'un d'autre, comme
effet secondaire de la compression d'un amas de textes qui contenait à peine la langue en
question.

---

## Où aller ensuite

- [Ce qu'est Champollion](/docs/what-is-champollion) — le projet auquel appartient cette page, et ce qu'il fait concernant ce qui précède.
- [Comment les modèles sont entraînés](/docs/network/context/mt-training-concepts) — le vocabulaire pour l'étape *après* la tokenisation, avec la même approche en partant de zéro.
- [Limites honnêtes](/docs/network/honest-limitations) — ce que ce projet ne prétend **pas** faire.
- [Gouvernance des données](/docs/network/sovereignty/data-sovereignty) — qui détient les clés d'un corpus, et ce que cela signifie en pratique.
