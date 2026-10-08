---
sidebar_position: 2
title: "Comment les locuteur·rice·s sont rémunéré·e·s"
slug: '/network/perspectives/how-speakers-get-paid'
description: "Ce que les validateur·rice·s communautaires et les traducteur·rice·s reçoivent pour le travail de référence, pourquoi rémunérer les locuteur·rice·s est non négociable, et comment la compensation évolue à mesure que le Réseau se développe. Tous les chiffres proviennent des spécifications publiées."
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# Comment les locuteurs sont rémunérés

> **Note de transparence.** Chaque chiffre de cette page figure déjà dans une spécification publiée — la [Spécification de référence §10](/docs/network/specifications/benchmark#10-cost-framework), le [Protocole de validation des locuteurs](/docs/network/specifications/speaker-validation), et la [Spécification des prix](/docs/network/specifications/prizes). Cette page les rassemble en un seul endroit, en langage clair, afin que personne n'ait besoin de lire une spécification pour découvrir la valeur du temps de locuteur ici. Elle ne s'engage à rien au-delà de ce que ces documents énoncent déjà.

Un locuteur bilingue capable de juger si une phrase produite par une machine est réelle, fluide et signifie la bonne chose est le participant le plus rare et le plus précieux de tout ce système. Tout le reste — harnais, métriques, classements — existe pour faire en sorte qu'une petite quantité du temps de cette personne aille très loin.

Ainsi, la première règle est simple : **les locuteurs sont rémunérés pour leur temps, à des tarifs professionnels, indépendamment de ce que révèlent les résultats** — dès lors que ce travail sera financé. Aucun fonds n'est détenu à ce jour, aucun travail avec des locuteurs n'est donc en cours.

---

## Pourquoi rémunérer les locuteurs est non négociable

La recherche en technologie linguistique a longtemps eu l'habitude de traiter les locuteurs fluides comme une ressource gratuite — un « engagement communautaire » qui produit des ensembles de données, des articles et des carrières pour tous sauf pour les locuteurs. Nous considérons ce modèle comme extractif, et les personnes les plus qualifiées pour faire ce travail sont précisément celles dont le temps est déjà réclamé par le travail urgent d'enseigner, de traduire et d'élever des enfants dans la langue.

Trois conséquences de conception en découlent :

1. **Pas de recours au bénévolat.** Nous ne demandons pas aux locuteurs d'effectuer bénévolement des travaux d'évaluation pour rendre service à la recherche. La participation est un engagement rémunéré, et la refuser ne coûte rien au locuteur.
2. **Le paiement est inconditionnel.** Les locuteurs seront rémunérés, que leurs évaluations soient utilisées ou non, et le paiement n'est pas subordonné aux résultats. Le protocole publié s'engage à effectuer le paiement dans les deux semaines suivant l'achèvement de chaque bloc de tâches.
3. **La rémunération ne résume pas tout l'accord.** Les locuteurs qui apportent leurs évaluations reçoivent également une reconnaissance explicite (nommée ou anonyme, selon leur choix), la possibilité d'une co-paternité sur les publications exploitant leurs évaluations, le droit de retirer leurs contributions à tout moment, ainsi qu'un droit de veto sur la publication de résultats qu'ils jugeraient problématiques. Ces conditions figurent dans le [protocole de validation par les locuteurs §5–6](/docs/network/specifications/speaker-validation), et non dans un accord annexe.

## Les tarifs publiés

Le cadre de coûts de référence fixe la rémunération des locuteurs bilingues à **50–65 CAD par heure** pour le travail de corpus et de validation. Voici ce que cela signifie par rôle :

### Construire un corpus de référence

Créer les traductions de référence par rapport auxquelles chaque méthode est évaluée est la tâche fondamentale du locuteur. Budget d'établissement publié par langue :

| Travail | Plage publiée | Base |
|---------|---------------|------|
| Curation de corpus (50–150 entrées) | 2 500–6 000 $ | 50–65 $/h, temps de locuteur bilingue |
| Examen de la sortie de la méthode | 500–1 500 $ | Mêmes tarifs horaires |

Un corpus complet prend traditionnellement environ 80 heures à un locuteur ; le flux de travail assisté par agent prévu (rédaction et formatage des phrases gérés par des outils, traduction toujours par un humain) est conçu pour ramener cela vers 30–40 heures — moins d'heures de travail répétitif, même tarif horaire, le locuteur ne faisant que les parties qui nécessitent véritablement un humain.

### Valider les métriques

Avant que les scores automatisés ne signifient quelque chose, les locuteurs doivent les vérifier par rapport au jugement humain. Le [Protocole de validation des locuteurs](/docs/network/specifications/speaker-validation) publie les tâches exactes, les heures et le paiement :

| Tâche | Temps | Paiement par locuteur |
|-------|-------|----------------------|
| A — Évaluer 200 traductions automatiques pour l'adéquation et la fluidité | ~8 heures | 400–520 CAD |
| B — Examiner 50 paires de traductions « équivalentes » | ~2 heures | 100–130 CAD |
| C — Examiner 100 mots que l'analyseur morphologique a rejetés | ~1,5 heures | 75–100 CAD |

Un locuteur effectuant les trois tâches s'engage pour environ 11,5 heures sur deux à quatre semaines pour **575–750 CAD**. Le cycle complet de validation à trois locuteurs coûte au projet 1 475–1 920 $ — c'est le point : la validation des locuteurs est un petit poste budgétaire pour le projet et ne devrait jamais être l'endroit où les coûts sont « économisés ».

### Examiner les réclamations de prix

Aucun prix n'est attribué sur la seule base de scores automatisés. Le [Prix du fondateur](/docs/network/specifications/prizes) proposé (10 000 $ CAD, anglais → cri des plaines — non ouvert, et aucun fonds n'est détenu) exigerait qu'au moins deux locuteurs bilingues évaluent de manière indépendante un échantillon stratifié d'au moins 30 résultats, et que 70 % ou plus soient jugés « acceptables » ou « excellents ». Cette évaluation constitue un travail de locuteur rémunéré selon les mêmes tarifs — et fait également office de verrou : les locuteurs ont le pouvoir d'invalider une demande de prix, et cela est délibéré.

## Comment cela s'adapte aux concours

Le modèle est construit de sorte que la rémunération des locuteurs augmente avec la plateforme au lieu d'être diluée par elle :

- **Chaque nouvelle langue commence par un engagement de corpus rémunéré.** Le coût d'établissement publié par langue (3 350–8 500 $ au total) est principalement une rémunération de locuteur — le plus grand composant unique, délibérément.
- **Chaque nouveau pool de prix apporte son propre examen rémunéré.** Chaque concours parrainé qui suit le [modèle de prix](/docs/network/specifications/prizes#4-future-prize-pools) porte la même exigence de validation communautaire, ce qui signifie que chaque concours finance le travail d'examen des locuteurs pour cette langue.
- **Les méthodes détenues par la communauté restent des actifs financés par la communauté.** Une méthode transférée appartient entièrement à l'organisation de gouvernance — tout ce qu'elle gagne en la déployant est entièrement celui de la communauté ([Comment le travail est financé](/docs/network/sovereignty/economic-model)), disponible pour l'examen continu, la croissance du corpus et les programmes linguistiques selon ce qu'elle juge approprié. Cette allocation est la décision de la communauté, pas la nôtre.

## Ce que nous n'avons *pas* promis

L'honnêteté exige de marquer les limites :

- Les tarifs ci-dessus correspondent à ce que nous avons l'intention de verser pour les travaux sur le cri des plaines dès lors qu'ils seront financés ; aucun travail de ce type n'est financé ni en cours aujourd'hui. Les tarifs pour les futures langues seront établis avec la communauté partenaire et publiés de la même manière — dans les spécifications, avant le début des travaux.
- Champollion est un projet non commercial, ne génère aucun revenu propre et est actuellement **autofinancé par son fondateur** — les subventions et financements de sponsors représentent ce que nous recherchons, et non ce dont nous disposons actuellement. [Comment les travaux sont financés](/docs/network/sovereignty/economic-model) en décrit le mécanisme, sans constituer une garantie.
- Être « équitablement rémunéré » est nécessaire mais non suffisant. Le paiement ne suffit pas, à lui seul, à rendre un projet non extractif — la propriété et le contrôle le permettent, c'est pourquoi la rémunération s'inscrit au sein du [modèle d'intendance](/docs/network/sovereignty/data-sovereignty) plutôt que de s'y substituer.

---

## Ce que cela signifie pour vous

:::info[Si vous êtes un membre de la communauté]
Si vous êtes bilingue dans une langue sous-desservie et l'anglais, votre jugement est l'apport le plus précieux dans ce système, et les conditions publiées sont : 50–65 CAD/heure, horaires flexibles, paiement dans les deux semaines, crédit selon vos conditions, et le droit de retirer vos contributions. Aucune compétence en programmation n'est requise. Commencez par [Pour les communautés linguistiques](/docs/network/community/for-language-communities) ou le [Protocole de validation des locuteurs §7](/docs/network/specifications/speaker-validation#7-how-to-get-started).
:::

:::info[Si vous êtes un chercheur]
Budgétisez la rémunération des locuteurs comme un coût de recherche de première classe — les chiffres publiés (1 475–1 920 $ pour une ronde de validation métrique ; 2 500–6 000 $ pour la curation de corpus) sont modestes selon les normes de subvention et c'est ce qui rend les scores automatisés défendables. La [Stratégie de partenariat de corpus](/docs/network/specifications/corpus-partnership) montre comment un département universitaire s'intègre à cela avec un travail de locuteur financé intégré.
:::

:::info[Si vous êtes un développeur]
Vous bénéficiez du travail rémunéré des locuteurs même si vous ne le financez jamais : les métriques validées sont ce qui rend votre score de classement significatif, et l'examen communautaire rémunéré est ce qui se dresse entre votre méthode et un prix. Si vous gagnez, attendez-vous à ce que les locuteurs aient été payés pour examiner attentivement votre résultat — et attendez-vous à ce que la [propriété de votre méthode soit transférée](/docs/network/sovereignty/ownership-transfer) à la communauté dont elle sert la langue.
:::

## Voir aussi

- [La traduction n'est pas la revitalisation](/docs/network/perspectives/translation-is-not-revitalization) — pourquoi l'autorité des locuteurs encadre tout le reste
- [Signaler les erreurs et posséder les corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — autorité des locuteurs après la référence aussi
- [Spécification de référence §10](/docs/network/specifications/benchmark#10-cost-framework) — le cadre de coûts complet d'où proviennent ces chiffres
