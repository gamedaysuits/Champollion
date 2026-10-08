---
sidebar_position: 2
title: "Propriété et conditions"
---

# Propriété et conditions

> **Résumé exécutif.** Champollion n'a pas d'accord universel, par conception.
> Les conditions sont définies par corpus, par langue et par prix par l'intendant qui possède
> les données — le rôle de la plateforme est de respecter quelles que soient ces conditions. Cette
> page décrit les dimensions qu'une feuille de conditions couvre et le **modèle de transfert communautaire**, le point de départ par défaut pour les prix parrainés sur
> les corpus de langues autochtones.

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
| **Exposition du corpus** | Quel couloir — public, réservé à la recherche, ou privé ? Les références sont-elles jamais affichées ? |
| **Propriété de la méthode** | Si un prix est remporté, qui possède la méthode gagnante — le développeur, la communauté, ou partagée ? |
| **Déploiement** | Qui peut déployer la méthode, où, et sous quelles conditions ? |
| **Auto-hébergement** | La méthode doit-elle s'exécuter entièrement sur une infrastructure contrôlée par la communauté ? |
| **Secret** | L'ensemble de test est-il scellé ? Qui détient les clés ? Qui autorise chaque exécution d'évaluation ? |
| **Compensation** | Que sont payés les constructeurs, les validateurs et les examinateurs ? (Valeurs par défaut publiées : [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid)) |

Aucune de ces questions n'a de réponses imposées par la plateforme. Les valeurs par défaut ci-dessous sont un modèle,
pas une règle.

## Le modèle de transfert communautaire

Pour les prix parrainés sur les corpus de langues autochtones, le modèle par défaut —
proposé comme point de départ pour qu'un organisme de gouvernance communautaire le révise —
fonctionne comme suit :

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

:::note[Statut : modèle, non historique]
Aucun prix n'a été ouvert et aucun transfert n'a eu lieu — le classement n'a actuellement aucune exécution publiée. Ce modèle est documenté afin que les conditions prévues soient transparentes avant que quiconque n'investisse des efforts, et afin que l'organe de gouvernance d'une communauté dispose d'un projet concret auquel réagir plutôt qu'une page vierge. Un instrument signé, rédigé avec l'assistance juridique pour les parties spécifiques, est ce qui rendrait tout cela contraignant.
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

- [Intendance des données](/docs/network/sovereignty/data-sovereignty) — la position que ces conditions mettent en œuvre
- [Comment le travail est financé](/docs/network/sovereignty/economic-model) — où l'argent se déplace, et ce que Champollion prend (rien)
- [Enregistrement des corpus](/docs/network/sovereignty/registering-corpora) — couloirs d'exposition et récupération à la source
- [Spécification des prix](/docs/network/specifications/prizes) — conditions de seuil et processus de réclamation
