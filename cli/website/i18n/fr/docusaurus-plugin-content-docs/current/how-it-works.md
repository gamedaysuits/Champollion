---
title: "Comment cela fonctionne"
slug: /how-it-works
description: "Ce que signifie « sur des rails avec des garde-fous » : chaque étape de la création d’un traducteur est organisée dans l’ordre, avec des vérifications qui évitent les erreurs courantes et vous permettent de garder le contrôle de vos mots."
---

# Comment cela fonctionne : sur des rails avec des garde-fous

Imaginez deux lignes côte à côte : une phrase dans une langue, et la
même phrase dans l'autre. C'est à partir de cela qu'un traducteur apprend, et c'est ce qu'il
écrit.

En construire un nécessitait autrefois un spécialiste. Il fallait savoir préparer les
phrases, comment entraîner un traducteur et — le plus difficile de tout — comment l'évaluer
sans s'illusionner. La plupart de ces leçons ont été apprises à la dure.

Champollion organise tout cela sous la forme de **rails** : chaque étape dans l'ordre, et une place
pour chaque chose. Le long des rails se trouvent des **garde-fous** : des vérifications qui empêchent les
erreurs habituelles et maintiennent vos mots sous votre contrôle. Vous — ou un assistant
IA de confiance — suivez les rails. C'est vous qui prenez les décisions.

## Qui décide de quoi

Les rails exécutent les étapes. Les personnes décident. Chaque étape appartient à l'une de ces quatre catégories :

- **Seule une personne peut le faire** — rédiger des phrases et vérifier des traductions.
  Aucun outil ne prétend être un locuteur.
- **Vous seul pouvez répondre** — à qui appartiennent vos mots, si un traducteur
  peut apprendre à partir d'eux, ce que vous attendez avant de voir le moindre résultat. Votre
  assistant vous consulte ; il ne répond jamais à votre place.
- **Votre assistant demande d'abord l'autorisation** — tout ce qui installe quelque chose, entraîne un
  traducteur, coûte de l'argent ou met quoi que ce soit en ligne attend votre accord. *Pas
  maintenant* est aussi une réponse : les rails ne reposeront pas la question durant cette session.
- **Votre assistant l'exécute directement** — comme vérifier si des phrases posent problème ou
  en mettre certaines de côté.

## Les rails : une place pour chaque chose

Un projet est un dossier unique sur votre ordinateur, comprenant une étagère pour chaque type de chose :

| Étagère | Ce qu'on y met |
|---|---|
| Phrases d'apprentissage | Paires de phrases, une dans chaque langue |
| Phrases de test | Phrases vérifiées par un locuteur fluide. Utilisées uniquement pour évaluer, jamais pour apprendre |
| Listes de mots | Dictionnaires et listes de mots |
| Notes de grammaire | Tout écrit sur le fonctionnement de la langue |
| Accords | Notes consignant qui a accepté quoi, et quand |
| Boîte de réception | Vos fichiers, tels quels, en attente de traitement |

Les traducteurs que vous construisez, leurs résultats et l'historique de chaque étape disposent
de leurs propres étagères.

Vos phrases se retrouvent dans trois piles. La plupart servent à **l'apprentissage**. Certaines — un
quart au début, une sur dix dès que vous en avez beaucoup — deviennent des **phrases
d'entraînement** — comme des questions d'entraînement, utilisées à chaque cycle
pour voir comment il progresse. Quelques-unes, vérifiées par un locuteur, constituent les **phrases
de test**, utilisées seulement de temps en temps. Le traducteur n'apprend jamais à partir des
deux dernières.

Comme chaque chose a sa place, les outils peuvent toujours voir ce qui est fait et
ce qui vient ensuite. Interrogez-les à tout moment et ils indiqueront **la prochaine étape**, lue
directement depuis le dossier. Votre assistant n'a pas besoin d'être un expert, ni de
se souvenir de l'endroit où vous vous êtes arrêté. Il suit les rails.

Les étapes se déroulent dans cet ordre :

1. **Démarrer le projet** — nommer les deux langues et le sens de traduction.
2. **Rassembler vos données** — importer ce dont vous disposez, puis consigner à qui
   elles appartiennent et comment elles peuvent être utilisées.
3. **Protéger votre jeu de test** — mettre de côté les phrases sur lesquelles vous
   évaluerez chaque traducteur.
4. **Installer les outils d'entraînement** — une seule fois, avec votre accord.
5. **Construire et tester un traducteur** — l'entraîner, puis évaluer ses performances sur
   les phrases de test.
6. **L'améliorer, cycle après cycle** — un locuteur vérifie ses ébauches, et chaque
   cycle cible ses erreurs.

Vous pouvez toujours effectuer une étape à votre manière — à la main ou avec d'autres outils — et
les rails reprennent là où le dossier indique que vous en êtes.

## Les garde-fous

Il existe deux sortes de garde-fous.

**Certains vous empêchent de vous illusionner.** Un traducteur testé sur des phrases qu'il
a déjà apprises paraît brillant alors qu'il ne l'est pas. Un cycle chanceux ressemble à un progrès.
C'est pourquoi les rails :

- mettent de côté les phrases de test avant le début de tout apprentissage,
- retirent les phrases qui en sont de quasi-copies,
- vous demandent d'écrire ce que vous attendez avant de voir un résultat,
- et ne considèrent un nouveau traducteur comme meilleur que s'il surpasse l'ancien au-delà
  du simple hasard.

**D'autres maintiennent vos mots sous votre contrôle.** Chaque fichier est accompagné d'une note précisant ce que
les personnes à qui il appartient ont décidé — peut-il quitter cet ordinateur, un
traducteur peut-il apprendre à partir de lui — et chaque outil respecte cette note.

Les outils refusent d'ignorer la plupart de ces vérifications. Quelques-unes dépendent de vous et de votre
assistant, et [la page sur les garde-fous](/docs/guardrails) précise lesquelles.

**Suivant :** [Les garde-fous, un par un →](/docs/guardrails)

## Approfondir

- [Le contrat opérationnel pour les agents IA](/docs/agents/contract) — les règles qu'un
  assistant suit sur les rails, et celles que les outils appliquent d'eux-mêmes.
- [Chaque commande, étape par étape](/docs/agents/shell) — le parcours
  technique complet.
- [Comment fonctionne le pipeline de traduction d'application](/docs/concepts/how-sync-works) —
  si vous êtes venu ici pour traduire le texte d'une application ou d'un site web.
