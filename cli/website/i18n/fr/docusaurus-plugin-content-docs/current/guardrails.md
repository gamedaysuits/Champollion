---
title: "Les garde-fous"
slug: /guardrails
description: "Les erreurs qui ruinent silencieusement les projets de traduction, et ce que font les garde-fous pour chacune d'entre elles — en termes simples."
---

# Les garde-fous, un par un

La plupart des projets de traduction n'échouent pas avec éclat. Ils échouent en silence. Des mots confiés de bonne foi se retrouvent là où ils ne devraient pas être. Un traducteur paraît remarquable — parce qu'il est évalué sur des phrases qu'il a déjà mémorisées. Une série chanceuse ressemble à un progrès.

Chaque garde-fou ci-dessous prévient l'une de ces défaillances. Les outils appliquent la plupart d'entre eux de manière autonome ; quelques-uns dépendent de vous et de votre assistant, et chacun est expressément signalé.

Un terme que vous rencontrerez ci-dessous : un **score** est une valeur numérique indiquant à quel point les phrases d'un traducteur se rapprochent de la façon dont un locuteur les a prononcées. Plus le score est élevé, plus la proximité est grande.

## 1. Vos mots qui quittent leur foyer

**Ce qui fait défaut.** Des mots confiés de bonne foi se retrouvent sur l'ordinateur d'un tiers, ou au sein de l'IA d'un tiers.

**Ce que font les rails.** Chaque fichier s'accompagne d'une notice, conservée juste à ses côtés, indiquant ce que les personnes auxquelles il appartient ont décidé : peut-il un jour quitter cet ordinateur, et un traducteur peut-il apprendre à partir de lui. Chaque outil se conforme à cette notice.

- Les fichiers sont d'abord privés, jusqu'à ce que les personnes auxquelles ils appartiennent apportent une réponse.
- Une fois leur réponse obtenue, les outils peuvent rendre les règles plus strictes, jamais plus souples. Seule une personne peut les assouplir, délibérément, à la main. Si quelqu'un qui n'avait pas été consulté donne ensuite son accord, ce consentement est ajouté.
- Les mots de quiconque ne sont utilisés pour instruire un traducteur que lorsque les responsables indiquent que ces locuteurs ont donné leur accord. Les mots provenant de locuteurs qui n'ont pas encore accepté, ou qui ont refusé, sont écartés.
- Un traducteur ayant appris à partir de phrases privées est lui aussi traité comme privé, car il peut reproduire ce qu'il a appris.
- Pour les fichiers conservés sur cet ordinateur, les outils présentent à votre assistant IA des décomptes, et non des phrases.

**Ce qui dépend de vous.** La plupart des assistants IA s'exécutent sur les serveurs d'une entreprise et transmettent à cette dernière tout ce qu'ils lisent. Si vous demandez à l'un d'eux d'ouvrir vos fichiers, il peut le faire — aucun outil ne peut s'y opposer. Pour les mots que vous souhaitez garder privés, utilisez un assistant qui fonctionne sur votre propre ordinateur, ou ne lui demandez pas d'ouvrir ces fichiers. De plus, les outils ne peuvent pas vérifier qui a répondu à une question ; il incombe donc aux personnes à qui appartiennent les mots de répondre elles-mêmes. La page [Vos mots, vos règles](/docs/your-words-your-rules) présente l'ensemble des détails.

## 2. Le test qui dissimule les devoirs

**Ce qui fait défaut.** Vous évaluez un traducteur sur des phrases à partir desquelles il a appris. Il s'en souvient et paraît brillant — puis trébuche sur la moindre nouveauté. Cela revient à noter un élève exactement sur les questions des devoirs de la veille.

**Ce que font les rails.** Avant tout apprentissage, vous mettez de côté des phrases de test vérifiées par un locuteur fluide. Elles sont marquées de telle sorte qu'aucun traducteur n'apprenne jamais d'elles, et les outils les excluent de ce qu'ils affichent, sauf si une personne demande explicitement à les consulter.

## 3. Les quasi-copies

**Ce qui fait défaut.** La phrase de test exacte ne figure pas parmi les phrases que le traducteur a apprises — mais une phrase presque identique s'y trouve. *« Nous allons au magasin »* fait l'objet du test, et *« Nous allons au magasin maintenant »* a été apprise. Le traducteur est alors récompensé pour sa mémoire, non pour sa capacité à traduire.

**Ce que font les rails.** Avant que l'apprentissage ne commence, chaque phrase à partir de laquelle le traducteur apprendrait est comparée aux phrases de test. Les copies conformes et les quasi-copies sont écartées. Les phrases qui ne partagent qu'une structure sont conservées mais comptabilisées, afin que vous puissiez évaluer dans quelle mesure elles risquent de surévaluer artificiellement le score.

## 4. Jeter un œil aux réponses

**Ce qui fait défaut.** Vérifiez votre traducteur par rapport aux phrases de test après chaque petite modification, et vous l'ajusterez peu à peu à ces phrases précises. Le test cesse alors de vous apporter le moindre enseignement nouveau.

**Ce que font les rails.** Les progrès quotidiens sont évalués sur un ensemble distinct de **phrases d'entraînement**, mises à l'écart de vos données. Chaque fois que les outils d'entraînement notent les phrases de test, cela est consigné par écrit, et ils n'afficheront aucun score de test tant qu'une prédiction n'aura pas été rédigée.

## 5. Décider de vos attentes après avoir vu le résultat

**Ce qui fait défaut.** Une fois le résultat affiché à l'écran, il est tentant de déclarer : *« c'est à peu près ce que nous pensions. »* Le résultat ne peut alors plus vous surprendre, ni rien vous apprendre.

**Ce que font les rails.** Avant que le premier traducteur ne soit instruit, les personnes qui le conçoivent formulent leurs attentes par écrit, dans leurs propres termes. Les rails ne poursuivent pas leur exécution tant que cela n'a pas été consigné, et le résultat final y est ultérieurement confronté.

## 6. Confondre le hasard avec le progrès

**Ce qui fait défaut.** Deux traducteurs peuvent obtenir des scores légèrement différents par simple effet du hasard, en particulier sur un petit volume de phrases. Une série chanceuse prend l'apparence d'un progrès, tandis qu'un gain réel peut se noyer dans le bruit de fond.

**Ce que font les garde-fous.** Un nouveau traducteur est comparé à celui que
vous utilisez, phrase par phrase, sur les mêmes phrases d'exercice. Il ne vous
est proposé que si son score est supérieur à ce que le simple hasard expliquerait
habituellement — et même dans ce cas, il ne prend le relais que si vous donnez
votre accord. Autrement, les outils indiquent *« aucun changement mesurable »* —
et précisent quel gain est trop faible pour être perceptible avec autant de phrases
d'exercice. Avec moins de 50 phrases d'exercice, aucun score ne permet de se prononcer,
de sorte que les outils ne décident de rien : ce sont les notes du locuteur,
portant sur les brouillons de l'un et de l'autre sans savoir lequel est lequel,
qui tranchent à la place.

## 7. Est-ce plus efficace qu'un dictionnaire ?

**Ce qui fait défaut.** Un score pris isolément ne signifie pas grand-chose. Un traducteur peut très bien ne pas faire mieux qu'une simple recherche mot à mot dans une liste de termes.

**Ce que font les rails.** Si vous disposez d'une liste de mots, les outils mesurent d'abord jusqu'où vous mène la recherche mot à mot. Un traducteur ne mérite d'être employé que là où il surpasse ce procédé.

## 8. Deux traducteurs dissimulés derrière un même score

**Ce qui fait défaut.** Lorsqu'un traducteur ne parvient pas à traiter une phrase, un second traducteur de secours peut intervenir. Cela convient parfaitement en cours d'utilisation. Toutefois, si un score de test fusionne les deux, il devient impossible de savoir lequel vous avez mesuré.

**Ce que font les rails.** Un score de test émane toujours d'un seul et même traducteur. Un modèle de secours est admis lorsque vous employez le traducteur, jamais lorsque vous le mesurez.

## 9. Prétendre plus que ce qui est vrai

**Ce qui fait défaut.** Un assistant trop empressé annonce : *« votre traducteur est prêt ! »* alors qu'il a à peine été instruit.

**Ce que font les rails.** Les outils conservent un enregistrement fidèle de ce qui s'est réellement produit. Votre assistant a pour instruction de ne rendre compte que de ces faits, et de relayer chaque avertissement mot pour mot. Ce point dépend du respect de ses instructions par l'assistant.

---

Rien de tout cela ne garantit à lui seul qu'un traducteur soit bon. Cela vous assure en revanche d'en connaître toujours précisément l'état — et permet aux personnes à qui appartient la langue d'en garder l'entière maîtrise.

**Étape suivante :** [Ce qu'il ne peut pas encore faire →](/docs/what-it-cant-do-yet)

## Approfondir

- [Le contrat de fonctionnement pour les agents IA](/docs/agents/contract) — chaque règle, et si les outils l'appliquent d'eux-mêmes ou si seul l'assistant peut la respecter.
- [Chaque commande, pas à pas](/docs/agents/shell) — où chaque vérification s'exécute, avec le détail exact des commandes.
- Ce que signifie ici « au-delà du hasard » : le score chrF++ du nouveau traducteur sur l'ensemble d'entraînement (dev) doit être supérieur lors d'un test apparié et son intervalle doit rester strictement au-dessus de zéro. L'ensemble d'entraînement a également servi à retenir le meilleur point de contrôle du nouveau traducteur, ce qui l'avantage légèrement.
- [Gestion des données](/docs/your-words-your-rules) — la manière dont les données sont exploitées sans jamais être cédées.
