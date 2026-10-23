---
sidebar_position: 4
title: "Signaler les erreurs et assumer les corrections"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Comment un·e locuteur·rice signale un fait erroné ou une mauvaise traduction, qui décide de la suite, comment les corrections conservent leur provenance, et pourquoi les communautés détiennent un droit de veto sur leurs données linguistiques."
related:
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
---

# Signaler des erreurs et assumer les corrections

> **Position.** Se tromper est inévitable pour une plateforme qui publie des faits et des évaluations concernant de nombreuses langues. Ce qui n'est *pas* inévitable, c'est de savoir qui est cru lorsqu'une erreur est signalée, et à qui appartient la correction. Notre réponse : le signalement d'un locuteur parlant couramment la langue prévaut sur nos mécanismes automatisés, chaque correction comporte une traçabilité indiquant qui a modifié quoi et pourquoi, et une communauté peut retirer ses données linguistiques ou opposer son veto à leur utilisation — non pas à titre de courtoisie, mais comme une propriété strictement appliquée de l'architecture.

La plupart des plateformes de données traitent les signalements d'erreurs comme des tickets d'assistance : un utilisateur se plaint, un responsable décide, l'enregistrement change silencieusement. Pour les données de langues autochtones, ce modèle est à l'envers. La personne signalant l'erreur est généralement plus autorisée que la plateforme — un locuteur nous disant qu'un mot est incorrect n'est pas un « utilisateur », c'est la vérité de terrain corrigeant un intermédiaire. La conception ci-dessous découle de la prise au sérieux de cette réalité.

---

## Deux types d'erreurs, un principe

La plateforme publie deux types d'affirmations qui peuvent être erronées :

1. **Faits concernant une langue** — les fiches de langue qui guident l'évaluation : données de classification, orthographe, caractéristiques linguistiques, métriques applicables. Une fiche peut comporter une estimation erronée du nombre de locuteurs, une mauvaise relation dialectale ou un statut inexact du système d'écriture.
2. **Jugements sur les traductions** — une traduction de référence dans un corpus qu'un locuteur juge incorrecte ou peu naturelle ; une métrique automatisée qui rejette un mot valide ou en accepte un invalide ; un score automatique élevé attribué à un résultat que les locuteurs n'accepteraient pas.

Le principe couvrant les deux, déjà contraignant dans la [Spécification de notation](/docs/network/specifications/scoring) et la [Spécification de benchmark §7](/docs/network/specifications/benchmark#7-human-validation) : **les sorties automatisées sont des intermédiaires ; les locuteurs sont la vérité de terrain.** L'engagement publié dans le [Protocole de validation des locuteurs §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) le dit sans détour : si un locuteur dit que le linter se trompe sur quelque chose, nous corrigeons le linter.

## Comment un signalement circule

Voici le chemin qu'emprunte un signalement, avec des marqueurs de statut honnêtes — certains de ces éléments fonctionnent aujourd'hui, certains sont spécifiés mais pas encore construits.

**Signaler une mauvaise traduction ou une évaluation métrique erronée (en vigueur aujourd'hui, par canal direct).** Un locuteur qui constate une traduction de référence erronée, un mot rejeté à tort ou un « équivalent » inacceptable peut le signaler via le gestionnaire de tickets du dépôt public du projet ou en contactant directement le projet. La version structurée de ce processus — des écrans d'évaluation comportant les options *rejet / idée générale / acceptable / excellent* ainsi que des notes libres — correspond à l'interface d'évaluation communautaire, spécifiée dans la [Spécification du benchmark §7.3](/docs/network/specifications/benchmark#7-human-validation), mais qui n'est pas encore opérationnelle. En attendant qu'elle le soit, les signalements sont traités directement de personne à personne, et les tâches de validation elles-mêmes (évaluation structurée et rémunérée par des locuteurs — voir [Travailler avec des locuteurs](/docs/working-with-speakers)) constituent la filière principale de correction.

**Signaler un fait incorrect sur une fiche de langue (fonctionnant aujourd'hui, mêmes canaux).** Les corrections de fiche suivent le même chemin : signalement, examen, changement versionnné. Parce que les fiches pilotent le comportement d'évaluation — quelles métriques se chargent, quels modèles sont recommandés — une correction de fiche peut modifier les scores, donc les corrections sont appliquées comme des changements de données enregistrées, jamais des modifications silencieuses.

**Ce qui se passe ensuite — qui décide :**

- **Les arbitrages linguistiques appartiennent aux locuteurs de cette langue.** Qu'une forme soit valide, que deux formulations soient équivalentes, qu'un registre soit approprié — la plateforme applique la réponse ; elle ne la fournit pas. Lorsque les locuteurs sont en désaccord (dialectes, conventions orthographiques), la réponse est consignée sous forme de variation et non arbitrée par nos soins — les schémas de corpus et du linter permettent de marquer les variantes dialectales comme des alternatives acceptables plutôt que d'imposer une forme unique.
- **Les décisions relatives aux données d'une communauté appartiennent à son organisation de gouvernance.** Pour les langues disposant d'un organisme de gouvernance, les modifications apportées aux corpus d'évaluation, l'acceptation de corrections dans les jeux de test scellés et les conséquences sur le déploiement passent par lui — il s'agit du contrôle communautaire des données linguistiques — voir [Vos mots, vos règles](/docs/your-words-your-rules) — mis en œuvre comme un processus, et non comme une simple déclaration d'intention.
- **Les erreurs matérielles sont simplement corrigées.** Une faute de frappe, un lien brisé, un champ mal analysé — signalés, corrigés, enregistrés. Tout ne nécessite pas la tenue d'un conseil.

## Les corrections portent une provenance

Une correction que vous ne pouvez pas retracer n'est qu'une opinion plus récente. Trois règles de provenance s'appliquent à chaque fait et à chaque correction :

1. **Chaque fait mentionne sa source.** Les fiches linguistiques et les entrées de corpus indiquent la provenance de chaque valeur — un jeu de données publié, une contribution communautaire, l'évaluation d'un locuteur.
2. **Les valeurs dérivées sont étiquetées comme étant les nôtres, et non celles de la source amont.** Lorsque la plateforme calcule un élément — un agrégat, un réencodage, un score composite —, celui-ci est consigné comme une dérivation de la plateforme *à partir* de la source amont, et n'est jamais présenté sous le nom de cette dernière. Un jeu de données en amont ne doit jamais être blâmé pour un chiffre qu'il n'a pas publié, ni s'en voir attribuer le mérite.
3. **Les corrections font partie intégrante du registre.** La correction apportée par un locuteur est enregistrée comme une nouvelle affirmation attribuée (nominative ou anonyme, au choix du locuteur — selon les mêmes modalités que le travail de validation) qui remplace l'ancienne valeur ; l'historique des modifications demeure vérifiable. Les versions de corpus font l'objet d'un manifeste par hachage ([Enregistrement des corpus](/docs/network/sovereignty/registering-corpora)), de sorte qu'un corpus corrigé constitue visiblement une nouvelle version, et chaque fiche d'exécution consigne précisément la version sur laquelle elle a été évaluée — les anciens scores demeurent interprétables, les nouveaux scores reflètent la correction.

## Le veto, concrètement

« Le contrôle communautaire » est facile à affirmer. Voici ce qu'il signifie concrètement dans l'architecture publiée :

- **Les locuteurs peuvent retirer leurs contributions.** Un locuteur peut retirer ses évaluations à tout moment, et ce retrait les supprime de toutes les analyses ([Validation par les locuteurs §5](/docs/network/specifications/speaker-validation#5-data-governance)). Les locuteurs disposent également d'un droit de veto sur la publication de résultats qu'ils jugent problématiques.
- **Les communautés peuvent interrompre totalement l'évaluation.** Les jeux de test scellés sont chiffrés, et Champollion ne détient aucun fragment de clé, si bien que la plateforme ne peut jamais les reconstruire seule. À ce jour, les clés d'un jeu scellé sont détenues par les organisateurs — dépositaires communautaires des clés : aucun n'a encore été désigné. Dès lors que des dépositaires désignés par une communauté détiennent des fragments de la clé d'un jeu, ils peuvent interrompre l'évaluation en refusant de participer à la reconstruction de la clé ([Enregistrement des corpus](/docs/network/sovereignty/registering-corpora)). La question « Et si nous voulons arrêter ? » a une réponse explicitement définie : les données scellées ne sont jamais exposées, et l'évaluation prend fin.
- **Aucun score ne prévaut sur une décision communautaire.** Une place sur le tableau de classement ne confère à personne l'autorisation de déployer une méthode sur la langue d'une communauté ([Transfert de propriété](/docs/network/sovereignty/ownership-transfer)) — et une communauté qui décide que la traduction automatique ne devrait pas du tout être déployée pour sa langue fait usage du système tel qu'il a été conçu, sans enfreindre son fonctionnement (voir [Traduire n'est pas revitaliser](/docs/network/perspectives/translation-is-not-revitalization)).

## Ce que nous n'avons pas encore construit

Dans l'esprit du reste de cette section : l'interface de révision communautaire est planifiée, mais pas encore active. Aucun organisme de gouvernance n'est encore établi pour les langues actuelles — aucun gardien communautaire n'a été désigné pour quelque benchmark que ce soit, y compris pour le cri des plaines, et nous ne divulguons publiquement aucun nom de gardien avant d'avoir obtenu son consentement. En attendant que ces éléments existent, les corrections transitent par des canaux directs et traçables, et les spécifications publiées — et non cette page — demeurent la description faisant foi du processus. En cas de divergence entre cette page et une spécification, la spécification prévaut, et nous considérerions également cette divergence comme un bug méritant d'être signalé.

---

## Ce que cela signifie pour vous

:::info[Si vous êtes membre d'une communauté]
Si un élément concernant votre langue sur cette plateforme est erroné — un fait, une traduction, une étiquette —, votre signalement constitue un témoignage émanant de la réalité du terrain, et non une réclamation à trier. Vous décidez si votre correction vous est attribuée nominativement ; votre contribution peut être retirée ultérieurement ; et votre communauté peut interrompre purement et simplement l'utilisation de ses données. Commencez par [Vos mots, vos règles](/docs/your-words-your-rules), ou ouvrez simplement un ticket sur le dépôt public.
:::

:::info[Si vous êtes un chercheur]
Les corrections ici sont des données avec provenance, non des modifications silencieuses : les versions de corpus sont hachées, les cartes d'exécution épinglent la version exacte par rapport à laquelle elles ont été évaluées, et les valeurs dérivées sont étiquetées comme des dérivations. Si vous vous appuyez sur les scores ou les corpus du Network, citez la version — et traitez une vague de correction menée par des locuteurs comme une conclusion sur la validité des métriques, car c'est ce qu'elle est.
:::

:::info[Si vous êtes un développeur]
Le score de votre méthode peut légitimement changer sans que votre code change — un mot faussement rejeté est mis en liste blanche, une traduction de référence est corrigée, une classe de variante est corrigée. Concevez en fonction de cela : épinglez les versions de corpus dans vos cartes d'exécution ([Spécification Run Card](/docs/network/specifications/run-card)), surveillez les journaux de modification des ensembles de données, et traitez les corrections des locuteurs comme le signal d'erreur le plus fiable que vous obtiendrez gratuitement.
:::

## Voir aussi

- [Travailler avec les locuteurs](/docs/working-with-speakers) — la même autorité des locuteurs, au stade du banc d'essai
- [Mettre en pratique](/docs/put-it-to-work) — là où les corrections rencontrent le flux de publication
- [Vos mots, vos règles](/docs/your-words-your-rules) — qui décide de ce qu'il advient des données linguistiques, ce que les outils font respecter et ce qu'aucun outil ne peut empêcher
