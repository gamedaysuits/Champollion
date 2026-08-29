---
sidebar_position: 4
title: "Signaler les erreurs et assumer les corrections"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Comment un·e locuteur·rice signale un fait erroné ou une mauvaise traduction, qui décide de la suite, comment les corrections conservent leur provenance, et pourquoi les communautés détiennent un droit de veto sur leurs données linguistiques."
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# Signaler des erreurs et assumer les corrections

> **Position.** Se tromper est inévitable pour une plateforme qui publie des faits et des évaluations sur des milliers de langues. Ce qui n'est *pas* inévitable, c'est qui est cru quand une erreur est signalée, et qui assume la correction. Notre réponse : le rapport d'un locuteur courant surclasse notre automatisation, chaque correction porte une provenance indiquant qui a changé quoi et pourquoi, et une communauté peut retirer ou opposer son veto à l'utilisation de ses données linguistiques — non pas par courtoisie, mais comme propriété imposée par l'architecture.

La plupart des plateformes de données traitent les signalements d'erreurs comme des tickets d'assistance : un utilisateur se plaint, un responsable décide, l'enregistrement change silencieusement. Pour les données de langues autochtones, ce modèle est à l'envers. La personne signalant l'erreur est généralement plus autorisée que la plateforme — un locuteur nous disant qu'un mot est incorrect n'est pas un « utilisateur », c'est la vérité de terrain corrigeant un intermédiaire. La conception ci-dessous découle de la prise au sérieux de cette réalité.

---

## Deux types d'erreurs, un principe

La plateforme publie deux types d'affirmations qui peuvent être erronées :

1. **Des faits sur une langue** — les fiches de langue qui pilotent l'évaluation : données de classification, orthographe, caractéristiques linguistiques, quelles métriques s'appliquent. Une fiche pourrait affirmer une mauvaise estimation du nombre de locuteurs, une mauvaise relation dialectale, un mauvais statut du système d'écriture.
2. **Des jugements sur les traductions** — une traduction de référence dans un corpus qu'un locuteur considère comme incorrecte ou peu naturelle ; une métrique automatisée qui rejette un mot valide ou en accepte un invalide ; un badge « Déployable » sur une sortie que les locuteurs n'accepteraient pas.

Le principe couvrant les deux, déjà contraignant dans la [Spécification de notation](/docs/network/specifications/scoring) et la [Spécification de benchmark §7](/docs/network/specifications/benchmark#7-human-validation) : **les sorties automatisées sont des intermédiaires ; les locuteurs sont la vérité de terrain.** L'engagement publié dans le [Protocole de validation des locuteurs §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) le dit sans détour : si un locuteur dit que le linter se trompe sur quelque chose, nous corrigeons le linter.

## Comment un signalement circule

Voici le chemin qu'emprunte un signalement, avec des marqueurs de statut honnêtes — certains de ces éléments fonctionnent aujourd'hui, certains sont spécifiés mais pas encore construits.

**Signaler une mauvaise traduction ou un jugement de métrique (fonctionnant aujourd'hui, par canal direct).** Un locuteur qui voit une mauvaise traduction de référence, un mot faussement rejeté, ou un « équivalent » inacceptable peut le signaler via le suivi des problèmes du référentiel public du projet ou en contactant directement le projet. La version structurée de ceci — des écrans d'évaluation avec les options *rejeter / essence / acceptable / excellent* et des notes en texte libre — est l'interface d'examen communautaire, qui est spécifiée dans la [Spécification de benchmark §7.3](/docs/network/specifications/benchmark#7-human-validation) mais pas encore en ligne. En attendant, les signalements sont traités de personne à personne, et les tâches de validation elles-mêmes (examen structuré des locuteurs rémunéré — voir [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid)) constituent le principal pipeline de correction.

**Signaler un fait incorrect sur une fiche de langue (fonctionnant aujourd'hui, mêmes canaux).** Les corrections de fiche suivent le même chemin : signalement, examen, changement versionnné. Parce que les fiches pilotent le comportement d'évaluation — quelles métriques se chargent, quels modèles sont recommandés — une correction de fiche peut modifier les scores, donc les corrections sont appliquées comme des changements de données enregistrées, jamais des modifications silencieuses.

**Ce qui se passe ensuite — qui décide :**

- **Les jugements linguistiques appartiennent aux locuteurs de cette langue.** Qu'une forme soit valide, que deux formulations soient équivalentes, qu'un registre soit approprié — la plateforme implémente la réponse ; elle ne la fournit pas. Là où les locuteurs ne sont pas d'accord (dialectes, conventions orthographiques), la réponse est enregistrée comme variation, non pas arbitrée par nous — les schémas de corpus et de linter supportent l'étiquetage des variantes dialectales comme alternatives acceptables plutôt que de forcer un seul gagnant.
- **Les décisions concernant les données d'une communauté appartiennent à son organisation de gouvernance.** Pour les langues avec une organisation de gouvernance, les changements aux corpus d'évaluation, l'acceptation des corrections dans les ensembles de test scellés, et les conséquences de déploiement passent par elle — c'est le contrôle communautaire des données linguistiques — voir [Souveraineté des données](/docs/network/sovereignty/data-sovereignty) — implémenté comme processus, pas comme affiche.
- **Les erreurs mécaniques sont simplement corrigées.** Une faute de frappe, un lien cassé, un champ mal analysé — signalé, corrigé, enregistré. Pas tout ne nécessite un conseil.

## Les corrections portent une provenance

Une correction que vous ne pouvez pas retracer n'est qu'une opinion plus récente. Trois règles de provenance s'appliquent à chaque fait et à chaque correction :

1. **Chaque fait nomme sa source.** Les fiches de langue et les entrées de corpus enregistrent d'où provient chaque valeur — un ensemble de données publié, une contribution communautaire, l'examen d'un locuteur.
2. **Les valeurs dérivées sont étiquetées comme les nôtres, pas celles de l'amont.** Quand la plateforme calcule quelque chose — un agrégat, un recodage, un composite — c'est enregistré comme une dérivation de plateforme *à partir de* la source amont, jamais écrit sous le nom de l'amont. Un ensemble de données amont ne devrait jamais être blâmé pour, ou crédité de, un nombre qu'il n'a pas publié.
3. **Les corrections deviennent partie du dossier.** La correction d'un locuteur est enregistrée comme une nouvelle assertion attribuée (nommée ou anonyme, au choix du locuteur — les mêmes conditions que le travail de validation) qui remplace l'ancienne valeur ; l'historique de ce qui a changé reste vérifiable. Les versions de corpus sont manifestées par hachage ([Partenariat de corpus §4.4](/docs/network/specifications/corpus-partnership)), donc un corpus corrigé est une version visiblement nouvelle, et chaque fiche d'exécution enregistre exactement quelle version a été utilisée pour le notation — les anciens scores restent interprétables, les nouveaux scores reflètent la correction.

## Le veto, concrètement

« Le contrôle communautaire » est facile à affirmer. Voici ce qu'il signifie concrètement dans l'architecture publiée :

- **Les locuteurs peuvent retirer leurs contributions.** Un locuteur peut retirer ses évaluations à tout moment, et le retrait les supprime de toutes les analyses ([Validation des locuteurs §5](/docs/network/specifications/speaker-validation#5-data-governance)). Les locuteurs détiennent également un pouvoir de veto sur la publication de résultats qu'ils trouvent problématiques.
- **Les communautés peuvent arrêter complètement l'évaluation.** Les ensembles de test scellés sont chiffrés, avec des clés détenues de sorte que la plateforme seule ne puisse jamais les reconstruire ; une communauté peut révoquer l'accès à l'évaluation en refusant de participer à la reconstruction des clés ([Partenariat de corpus §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)). « Et si nous voulions arrêter ? » a une réponse spécifiée : les données scellées ne sont jamais exposées, et l'évaluation s'arrête.
- **Aucun score ne surpasse une décision communautaire.** Une méthode qui domine le classement ne se déploie que si l'organisation de gouvernance le dit ([Transfert de propriété](/docs/network/sovereignty/ownership-transfer)) — et une communauté qui décide que la TA ne devrait pas être déployée pour sa langue du tout exerce le système tel que conçu, ne le casse pas (voir [La traduction n'est pas la revitalisation](/docs/network/perspectives/translation-is-not-revitalization)).

## Ce que nous n'avons pas encore construit

Dans l'esprit du reste de cette section : l'interface d'examen communautaire est planifiée, pas en ligne. Les organisations de gouvernance ne sont établies pour aucune des langues actuelles — la garde communautaire pour le benchmark Plains Cree est en confirmation, et nous ne nommons pas publiquement les gardiens avant qu'ils n'aient consenti. Jusqu'à ce que ces éléments existent, les corrections passent par des canaux directs et attribuables, et les spécifications publiées — pas cette page — restent la description contraignante du processus. Là où cette page et une spécification ne sont pas d'accord, la spécification gagne, et nous considérerions le désaccord comme un bug qui vaut la peine d'être signalé aussi.

---

## Ce que cela signifie pour vous

:::info[Si vous êtes un membre de la communauté]
Si quelque chose concernant votre langue sur cette plateforme est inexact — un fait, une traduction, une étiquette — votre signalement est un témoignage de la vérité sur le terrain, non une plainte à être traitée. Vous décidez si votre correction est créditée par votre nom ; votre contribution peut être retirée ultérieurement ; et votre communauté peut arrêter l'utilisation de ses données complètement. Commencez à [Pour les communautés linguistiques](/docs/network/community/for-language-communities), ou ouvrez simplement un problème sur le dépôt public.
:::

:::info[Si vous êtes un chercheur]
Les corrections ici sont des données avec provenance, non des modifications silencieuses : les versions de corpus sont hachées, les cartes d'exécution épinglent la version exacte par rapport à laquelle elles ont été évaluées, et les valeurs dérivées sont étiquetées comme des dérivations. Si vous vous appuyez sur les scores ou les corpus du Network, citez la version — et traitez une vague de correction menée par des locuteurs comme une conclusion sur la validité des métriques, car c'est ce qu'elle est.
:::

:::info[Si vous êtes un développeur]
Le score de votre méthode peut légitimement changer sans que votre code change — un mot faussement rejeté est mis en liste blanche, une traduction de référence est corrigée, une classe de variante est corrigée. Concevez en fonction de cela : épinglez les versions de corpus dans vos cartes d'exécution ([Spécification Run Card](/docs/network/specifications/run-card)), surveillez les journaux de modification des ensembles de données, et traitez les corrections des locuteurs comme le signal d'erreur le plus fiable que vous obtiendrez gratuitement.
:::

## Voir aussi

- [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid) — la même autorité des locuteurs, au stade du benchmark
- [Du benchmark à l'utilisation quotidienne](/docs/network/perspectives/from-benchmark-to-daily-use) — où les corrections rencontrent le flux de travail de publication
- [Souveraineté des données](/docs/network/sovereignty/data-sovereignty) — les principes autochtones de souveraineté des données, CARE et Te Mana Raraunga — les principes derrière cette conception
