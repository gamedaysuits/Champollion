---
sidebar_position: 7
title: "Gouvernance des données"
description: "La position de Champollion sur les données linguistiques : les corpus restent avec leurs gestionnaires, chaque licence est respectée, et les conditions communautaires régissent les données communautaires."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Intendance des données

> **Résumé exécutif.** Champollion est un ensemble d'outils de recherche et
> développement en traduction automatique — à source disponible et gratuit pour
> un usage non commercial, son banc d'évaluation étant open source. Cette page
> expose l'intégralité de sa position sur les données linguistiques : les corpus
> appartiennent aux personnes dont ils sont issus, chaque licence et condition
> communautaire est respectée de manière mécanique et non par simple promesse,
> et la plateforme n'impose aucune condition qui lui soit propre sur la langue
> de quiconque.

:::info[Les données linguistiques sont des données biologiques]
Les données linguistiques sont des **données biologiques**. Comme les données génétiques ou sanitaires, une langue porte l'identité, la parenté et les relations des personnes qui la parlent — et comme un génome, elle ne peut pas être anonymisée de manière significative : même en supprimant les noms, la langue encode toujours qui sont ses locuteurs. Ainsi, les personnes qui fournissent un corpus en détiennent les clés, et par extension, les clés de tout ce qui est mesuré par rapport à celui-ci. C'est le principe sur lequel repose tout ce qui suit.
:::

De cette prémisse découle la conception. Champollion traite chaque contributeur de corpus comme un **intendant** : le corpus reste le sien — légalement, physiquement et pratiquement — tandis que l'infrastructure le rend *mesurable*.

## Les engagements

1. **Nous ne détenons jamais les données.** Les corpus sont enregistrés sous forme de fiches de métadonnées avec hash épinglé et récupérés depuis l'hébergement propre de l'intendant au moment de l'évaluation. Rien n'est copié dans ce référentiel ni servi depuis notre infrastructure. Mettez votre archive hors ligne et l'évaluation par rapport à celle-ci s'arrête simplement. Voir [Registering Corpora](/docs/network/sovereignty/registering-corpora).

2. **Chaque licence est respectée — par verrouillage technique, non par simple
   promesse.** Les corpus non commerciaux et réservés à la recherche sont
   mécaniquement exclus de toute utilisation que leur licence n'autorise pas. Les
   restrictions revendiquées par une communauté au-delà de la licence sont
   consignées avec leur source et respectées de la même manière. L'application de
   ces règles repose sur des contrôles pré-push exécutés localement avant chaque
   push (le CI étant actuellement désactivé) et sur des déclencheurs de base de
   données, et non sur un code de conduite.

3. **Les conditions sont celles de l'intendant, et elles varient.** Différentes langues auront des accords différents — un corpus CC0 public, un corpus communautaire réservé à la recherche, et un ensemble de test scellé avec des exigences de déploiement souverain peuvent tous participer, chacun selon ses propres conditions. Il n'y a pas de contrat universel ici et aucune revendication par défaut sur quoi que ce soit. Voir le [Terms Framework](/docs/network/sovereignty/ownership-transfer).

4. **Les corpus secrets sont soutenus en tant qu'architecture, non exception.** Une communauté peut garder un ensemble de test scellé — détenu sur sa propre infrastructure, jamais vu par Champollion ou par les développeurs — et avoir néanmoins des méthodes évaluées par rapport à celui-ci. La mesurabilité sans extractibilité est un objectif de conception, non une solution de contournement.

5. **L'attribution et le crédit accompagnent les données.** La mention des
   créateurs et des linguistes est obligatoire sur chaque interface où un
   corpus apparaît. Lorsqu'une communauté a appliqué des labels TK ou BC de
   [Local Contexts](https://localcontexts.org/), nous prévoyons de les afficher
   et de respecter le protocole qu'ils encodent ; la prise en charge des labels
   n'est pas encore implémentée. Nous transmettrons les labels ; nous n'en
   émettrons jamais.

6. **Les contributeurs seront rémunérés.** La constitution et la validation de
   corpus constituent un travail professionnel, destiné à être rémunéré selon des
   tarifs publiés dès que des fonds seront disponibles (aucun fonds n'est détenu
   à ce jour) — voir
   [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid).
   Le paiement n'achète pas le corpus : le créateur est rémunéré *et* demeure le
   dépositaire des données.

## Comment une licence devient une règle exécutoire

L'engagement 2 prend une forme bien précise, et il convient de l'énoncer dans son
intégralité — voici comment le principe « chaque licence est respectée »
s'applique concrètement, et non sous forme d'une simple déclaration de bonnes
intentions.

**Chaque benchmark entre en rétention.** Tout jeu de test nouvellement catalogué
est mis en quarantaine par défaut : visible dans l'index, mais exclu de la file
d'évaluation, des concours et de tout classement. Rien n'est présumé au sujet
d'un corpus lors de son intégration — pas même une licence d'apparence permissive
— tant que ses termes n'ont pas été vérifiés par rapport au texte réel de la
licence, à une révision amont figée.

**Les verdicts de révision sont mécaniques, et les cas difficiles restent en
rétention.** Une licence permissive clairement formulée ouvre l'accès du corpus
à toutes les voies. Une licence non commerciale clairement formulée le dirige
vers une voie de recherche exclue de toute exploitation commerciale, de tout prix
et de toute API. Enfin, une licence non précisée, modifiée, mixte ou sur mesure
n'est **jamais interprétée au nom du détenteur des droits** : le corpus reste
catalogué mais retenu — hors de la file, des concours et des classements —
jusqu'à ce que le détenteur des droits précise ses conditions ou enregistre une
cession. Le verdict, sa date, sa voie d'attribution et son fondement sont inscrits
de manière lisible par machine sur la fiche du corpus et dans ses entrées de
registre, de sorte que la question « pourquoi ceci est-il exécutable ? » reçoive
toujours une réponse citable, tout comme « pourquoi ceci ne l'est-il pas ? ».

**L'envoi de texte à un modèle constitue une transmission soumise à un contrôle.**
Évaluer un modèle implique de lui transmettre des phrases sources — c'est le
corpus qui quitte son environnement d'origine, et cette opération est régie par
sa licence. Les corpus sous licence permissive peuvent emprunter les canaux
standards. Les corpus soumis à une licence non commerciale déclarée ne transitent
que par des canaux qui s'engagent contractuellement à ne pas entraîner leurs
modèles sur les entrées fournies — stipulé très exactement ainsi : une garantie
de non-entraînement, et non une simple absence de rétention. Les corpus faisant
l'objet d'autorisations non précisées ou modifiées se voient refuser purement et
simplement toute évaluation distante jusqu'à ce que le consentement soit consigné,
et les jeux de données communautaires verrouillés ne quittent jamais
l'infrastructure de leur dépositaire. Lorsque le mécanisme de contrôle oppose un
refus, son message cite le verdict de la révision de licence.

**L'application des règles s'exécute sous chaque client.** Les retenues sont
imposées par un déclencheur de base de données qu'aucun client ne peut contourner,
la règle de non-hébergement est assurée par un contrôle pré-push, exécuté
localement avant chaque push (le CI étant actuellement désactivé), qui analyse
chaque chemin suivi et envoyé à la recherche de contenu de corpus, et le contrôle
de transmission s'exécute au sein même du banc d'évaluation. Chacun de ces
mécanismes peut s'opposer à nous, et c'est précisément le but recherché.

## Ce que ce n'est pas

Champollion n'est pas un courtier de données, pas un fournisseur de traduction, et pas une plateforme commerciale. C'est un outil de recherche. Un score élevé au classement prouve qu'une méthode fonctionne techniquement ; ce n'est pas une licence pour publier des traductions, redistribuer un corpus, ou déployer quoi que ce soit contre les souhaits d'une communauté. Ces décisions appartiennent à l'intendant, toujours.

## Les cadres qui ont façonné cette conception

Cette posture n'a pas été inventée ici. Elle est informée par, et redevable à, le travail de gouvernance des données autochtones des deux dernières décennies :

- **Principes de souveraineté des données des Premières Nations** — les
  Premières Nations du Canada ont articulé la propriété, le contrôle, l'accès
  et la possession par la communauté de ses propres informations ; le modèle de
  gouvernance présenté ici est conçu pour être compatible avec ces revendications.
- **[Principes CARE](https://www.gida-global.org/care)** (Bénéfice collectif,
  Autorité de contrôle, Responsabilité, Éthique) — Global Indigenous Data
  Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — le réseau de
  souveraineté des données maories.
- **La [licence Kaitiakitanga](https://tehiku.nz/)** — la licence de Te Hiku
  Media basée sur la tutelle pour les données en te reo Māori, source d'influence
  directe du modèle de garde « le dépositaire détient les clés » employé ici.

Nous orientons quiconque conçoit la gouvernance pour les données de sa propre langue vers ces sources directement — ce sont les autorités, pas nous. Lorsqu'une communauté adopte l'un de ces cadres pour son corpus, la fiche de corpus enregistre cette affirmation et l'outillage l'honore.

Champollion a l'intention d'adopter la mention **« Open to Collaborate »** et les
labels de Local Contexts ; ni l'une ni les autres ne sont encore implémentés.
Lorsqu'ils le seront, les labels rédigés par la communauté prévaudront sur tout
ce que nous pourrions déclarer concernant les données d'une communauté.

## Voir aussi

- [La souveraineté des données, de zéro](/docs/learn/data-sovereignty) — la version d'initiation de cette page, destinée aux lecteurs découvrant ce concept

- [Registering Corpora & Exposure Lanes](/docs/network/sovereignty/registering-corpora) — la mécanique
- [For Language Communities](/docs/network/community/for-language-communities) — un guide en langage clair
- [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid) — tarifs et conditions publiés
- [Translation Methods](https://champollion.dev/docs/guides/translation-methods) — la méthode `api`, qui garde les invites, dictionnaires et données de coaching d'une communauté sur ses propres serveurs
