---
sidebar_position: 2
title: "Propriété et conditions"
---

# Propriété et conditions

> **Résumé exécutif.** Champollion ne dispose d'aucun accord universel, par conception.
> Les conditions sont définies par corpus, par langue et par prix par le gestionnaire qui possède
> les données — le rôle de la plateforme est de respecter les conditions ainsi établies, quelles qu'elles soient. Cette
> page décrit les dimensions couvertes par une feuille de conditions et le **Modèle de
> transfert communautaire** : un point de départ que l'organe de gouvernance d'une communauté peut
> adopter et réviser lorsqu'il organise un prix et choisit la condition
> `pass_to_holders`.

## Le cadre des conditions

Champollion est conçu pour être flexible dans ses conditions afin que toutes les licences soient
respectées — et pour qu'il puisse soutenir des arrangements novateurs : corpus secrets,
ensembles de test détenus par la communauté, et exigences de déploiement souverain. Différentes
langues auront des accords différents. Un corpus CC0, un corpus communautaire réservé à la recherche, et un ensemble scellé de référence gouverné par un conseil tribal
peuvent tous participer, chacun selon ses propres conditions.

Ce qui est uniforme, c'est la machinerie qui honore ces conditions : les couloirs d'exposition,
les portes de licence, la mise en quarantaine, et l'enregistrement de récupération à la source (voir
[Enregistrement des corpus](/docs/network/sovereignty/registering-corpora)). Ce qui n'est
*jamais* uniforme, c'est l'accord lui-même.

Lorsqu'un intendant de corpus définit des conditions — pour la participation à un benchmark, pour un prix parrainé, ou pour toute autre chose — la feuille de conditions répond à un petit ensemble de questions :

| Dimension | La question |
|---|---|
| **Exposition du corpus** | Quelle voie — publique, réservée à la recherche ou privée ? Les références sont-elles jamais affichées ? |
| **Propriété de la méthode** | Si un prix est remporté, qui possède la méthode gagnante — le développeur, la communauté ou en partage ? |
| **Déploiement** | Qui peut déployer la méthode, où et sous quelles conditions ? |
| **Auto-hébergement** | La méthode doit-elle s'exécuter entièrement sur une infrastructure contrôlée par la communauté ? |
| **Confidentialité** | Le jeu de test est-il scellé ? Qui détient les clés ? Qui autorise chaque exécution d'évaluation ? |
| **Rémunération** | Combien les créateurs, validateurs et réviseurs sont-ils rémunérés ? (Valeurs par défaut publiées : [Travailler avec des locuteurs](/docs/working-with-speakers)) |

Aucune de ces questions n'a de réponses imposées par la plateforme. Les valeurs par défaut ci-dessous sont un modèle,
pas une règle.

## Le modèle de transfert communautaire

L'organisateur d'un concours scellé choisit l'une des trois conditions de prix — `pass_to_holders`,
`retain_ip` ou `release_open` — et la publie avant que quiconque ne participe
([Spécification des prix](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three)).
Une place sur le tableau de classement ouvert ne transfère aucun droit dans aucun de ces cas. Ce
modèle détaille `pass_to_holders` pour un corpus en langue autochtone,
proposé comme point de départ à réviser par l'organe de gouvernance d'une communauté. Il
fonctionne de la manière suivante :

### 1. Développement de la méthode
Un chercheur, un étudiant ou un développeur construit une méthode de traduction — un pipeline avec porte FST,
un LLM entraîné, un modèle affiné, ou toute autre approche — en utilisant
ses propres ressources et des données sous licence ouverte.

### 2. Évaluation réseau
La méthode est évaluée par rapport au [harnais d'évaluation](/docs/network/specifications/harness).
Chaque soumission est empreinte à un commit Git spécifique et une version d'ensemble de données.
Les scores sont reproductibles.

### 3. Examen communautaire
Les résultats sont examinés par les travailleurs linguistiques de la communauté. Un score élevé au classement
prouve que la méthode *fonctionne* ; cela ne prouve pas qu'elle est *appropriée*. Des locuteurs bilingues
valident un échantillon de résultats, et les examinateurs de la communauté peuvent rejeter
une méthode pour n'importe quelle raison.

### 4. Transfert de propriété
Lorsqu'une méthode atteint le seuil du prix (métriques automatisées **et** validation humaine),
le développeur transfère la méthode — code source, poids entraînés,
configuration, données d'entraînement — à l'organisme de gouvernance de la communauté
(un conseil tribal, une autorité linguistique, ou un organisme similaire choisi par la communauté,
jamais par Champollion). La communauté possède l'artefact entièrement : elle peut
l'inspecter, le modifier, le déployer, l'archiver, ou le concédier sous licence, sans réclamation continue du
développeur ou de Champollion.

Les composants tiers que le développeur ne possède pas (un modèle de base à poids ouvert,
un FST AGPL) ne peuvent pas avoir leur propriété transférée — ils passent à la
communauté selon leurs propres licences ouvertes, c'est pourquoi l'admissibilité au prix
exige que chaque dépendance porte des droits que la communauté peut réellement recevoir.
Voir les classes de dépendance dans la
[spécification de l'interface de méthode](/docs/network/specifications/methods#method-validity-and-dependency-classes).

Le développeur conserve ce que les chercheurs devraient conserver : le droit sans restriction de
publier l'approche et les résultats, de réutiliser ses techniques n'importe où, et
l'attribution permanente en tant que créateur de la méthode.

### 5. Déploiement — si et comment la communauté le choisit
La communauté décide si la méthode est déployée du tout, par qui, et selon
quelles conditions. Le déploiement indépendant est entièrement l'affaire de la communauté :
**Champollion ne prend aucune part de ce qu'une communauté gagne d'un actif qu'elle
possède**, et ne détient aucun droit de déploiement propre.

:::note[Statut : modèle, non un précédent]
Aucun prix n'a encore été ouvert et aucun transfert n'a encore eu lieu. Ce modèle est documenté afin que les conditions
visées soient transparentes avant que quiconque n'investisse des efforts, et pour que l'organe
de gouvernance d'une communauté dispose d'un projet concret sur lequel réagir plutôt que d'une page blanche.
Un acte signé, rédigé avec des conseillers juridiques pour les parties concernées, est ce qui
rendrait tout cela contraignant.
:::

## Pour les chercheurs

Si vous développez une méthode pour une langue autochtone :

1. **Établissez une relation** avec la communauté linguistique avant de commencer
2. **Utilisez des données sous licence ouverte** pour le développement (pas des ressources restreintes à la communauté)
3. **Documentez la provenance** dans votre [fiche d'exécution](/docs/network/specifications/run-card) — chaque ressource, sa licence, et son origine
4. **Lisez les conditions du prix avant de construire pour celui-ci** — si les conditions incluent
   un transfert, votre contribution est l'architecture et la technique (vôtres à
   publier et réutiliser) ; la contribution de la communauté est la connaissance
   linguistique qui la rend efficace pour leur langue

## Voir aussi

- [Vos mots, vos règles](/docs/your-words-your-rules) — la position que ces conditions mettent en œuvre
- [Comment le travail est financé](/docs/getting-started/who-may-use-this) — la circulation des fonds, et ce que Champollion prélève (rien)
- [Enregistrer des corpus](/docs/network/sovereignty/registering-corpora) — voies d'exposition et récupération à la source
- [Spécification des prix](/docs/network/specifications/prizes) — conditions de seuil et processus de réclamation
