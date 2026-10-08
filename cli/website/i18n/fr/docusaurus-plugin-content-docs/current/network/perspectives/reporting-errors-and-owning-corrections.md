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

1. **Faits concernant une langue** — les fiches de langue qui guident l'évaluation : données de classification, orthographe, caractéristiques linguistiques, métriques applicables. Une fiche peut comporter une estimation erronée du nombre de locuteurs, une mauvaise relation dialectale ou un statut inexact du système d'écriture.
2. **Jugements sur les traductions** — une traduction de référence dans un corpus qu'un locuteur juge incorrecte ou peu naturelle ; une métrique automatisée qui rejette un mot valide ou en accepte un invalide ; un score automatique élevé attribué à un résultat que les locuteurs n'accepteraient pas.

Le principe couvrant les deux, déjà contraignant dans la [Spécification de notation](/docs/network/specifications/scoring) et la [Spécification de benchmark §7](/docs/network/specifications/benchmark#7-human-validation) : **les sorties automatisées sont des intermédiaires ; les locuteurs sont la vérité de terrain.** L'engagement publié dans le [Protocole de validation des locuteurs §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) le dit sans détour : si un locuteur dit que le linter se trompe sur quelque chose, nous corrigeons le linter.

## Comment un signalement circule

Voici le chemin qu'emprunte un signalement, avec des marqueurs de statut honnêtes — certains de ces éléments fonctionnent aujourd'hui, certains sont spécifiés mais pas encore construits.

**Signaler une mauvaise traduction ou un jugement de métrique (fonctionnant aujourd'hui, par canal direct).** Un locuteur qui voit une mauvaise traduction de référence, un mot faussement rejeté, ou un « équivalent » inacceptable peut le signaler via le suivi des problèmes du référentiel public du projet ou en contactant directement le projet. La version structurée de ceci — des écrans d'évaluation avec les options *rejeter / essence / acceptable / excellent* et des notes en texte libre — est l'interface d'examen communautaire, qui est spécifiée dans la [Spécification de benchmark §7.3](/docs/network/specifications/benchmark#7-human-validation) mais pas encore en ligne. En attendant, les signalements sont traités de personne à personne, et les tâches de validation elles-mêmes (examen structuré des locuteurs rémunéré — voir [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid)) constituent le principal pipeline de correction.

**Signaler un fait incorrect sur une fiche de langue (fonctionnant aujourd'hui, mêmes canaux).** Les corrections de fiche suivent le même chemin : signalement, examen, changement versionnné. Parce que les fiches pilotent le comportement d'évaluation — quelles métriques se chargent, quels modèles sont recommandés — une correction de fiche peut modifier les scores, donc les corrections sont appliquées comme des changements de données enregistrées, jamais des modifications silencieuses.

**Ce qui se passe ensuite — qui décide :**

- **Les jugements d'ordre linguistique appartiennent aux locuteurs de cette langue.** Qu'une forme soit valide, que deux formulations soient équivalentes ou qu'un registre soit approprié — la plateforme applique la réponse ; elle ne la fournit pas. Lorsque les locuteurs ne s'accordent pas (dialectes, conventions orthographiques), la réponse est consignée sous forme de variante et n'est pas arbitrée par nos soins — les schémas du corpus et du linter prennent en charge l'étiquetage des variantes dialectales comme des alternatives acceptables plutôt que d'imposer un choix unique.
- **Les décisions relatives aux données d'une communauté appartiennent à son organisme de gouvernance.** Pour les langues dotées d'un organisme de gouvernance, les modifications apportées aux corpus d'évaluation, la validation de corrections dans les jeux de test scellés et les répercussions sur le déploiement passent par eux — voilà ce qu'est le contrôle communautaire des données linguistiques — voir [Souveraineté des données](/docs/network/sovereignty/data-sovereignty) — mis en œuvre sous la forme d'un processus, et non comme un simple affichage.
- **Les erreurs mécaniques sont simplement corrigées.** Une faute de frappe, un lien brisé, un champ mal analysé — signalés, corrigés, consignés dans le journal. Tout ne nécessite pas la tenue d'un conseil.

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

Dans l'esprit du reste de cette section : l'interface de révision communautaire est planifiée, mais pas encore active. Aucun organisme de gouvernance n'est encore établi pour les langues actuelles — aucun gardien communautaire n'a été désigné pour quelque benchmark que ce soit, y compris pour le cri des plaines, et nous ne divulguons publiquement aucun nom de gardien avant d'avoir obtenu son consentement. En attendant que ces éléments existent, les corrections transitent par des canaux directs et traçables, et les spécifications publiées — et non cette page — demeurent la description faisant foi du processus. En cas de divergence entre cette page et une spécification, la spécification prévaut, et nous considérerions également cette divergence comme un bug méritant d'être signalé.

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
- [Du benchmark à l'usage quotidien](/docs/network/perspectives/from-benchmark-to-daily-use) — le point de rencontre entre les corrections et le flux de publication
- [Souveraineté des données](/docs/network/sovereignty/data-sovereignty) — principes de souveraineté des données autochtones, principes CARE et Te Mana Raraunga — les principes qui sous-tendent cette conception
