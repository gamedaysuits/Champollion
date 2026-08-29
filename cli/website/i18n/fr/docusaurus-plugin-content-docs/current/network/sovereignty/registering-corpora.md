---
sidebar_position: 8
title: "Enregistrement des corpus et des voies d'exposition"
slug: /network/sovereignty/registering-corpora
description: "Enregistrez un corpus d'évaluation sans le céder. Voies d'exposition publiques, réservées à la recherche non commerciale, et privées — et comment fetch-from-source maintient le contenu du corpus hors de notre portée."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Enregistrement des corpus et voies d'exposition

> **Résumé exécutif.** Vous pouvez enregistrer un corpus d'évaluation auprès du Réseau afin que les méthodes puissent être comparées à celui-ci **sans nous transmettre les données**. Chaque corpus est enregistré sous la forme d'une *fiche de métadonnées* épinglée par sha, non du contenu — les phrases réelles sont récupérées à partir de leur source au moment de l'évaluation. Lors de l'enregistrement, vous choisissez une **voie d'exposition** : **publique** (licence ouverte, peut figurer au classement public), **recherche non commerciale uniquement** (comparable, mais exclue de tous les chemins commerciaux / prix / API), ou **privée** (enregistrée pour vos propres exécutions notées, références jamais publiées). C'est le mécanisme qui permet à une communauté de rendre sa langue *mesurable* sans la rendre *extractible*.

L'évaluation de la traduction automatique exige généralement l'inverse de la souveraineté des données : « téléchargez votre ensemble de test pour que nous puissions le noter ». C'est inacceptable pour les corpus de langues autochtones et autres corpus communautaires, où les données appartiennent aux personnes dont elles proviennent. Le Réseau est construit de sorte que vous n'ayez jamais à faire ce compromis.

---

## 1. L'enregistrement est des métadonnées, pas du contenu {#1-registration-is-metadata-not-content}

Un corpus enregistré est une **fiche** : un petit enregistrement JSON décrivant *où* le corpus se trouve et *ce qu'il est*, avec un hachage de contenu pour que les octets exacts puissent être vérifiés — mais **pas de phrases**. Une fiche contient :

| Champ | Ce que c'est |
|-------|-----------|
| `url` | Où le corpus est récupéré (l'archive en amont que vous contrôlez) |
| `sha256` | Hachage de contenu de l'archive épinglée — prouve que personne n'a échangé les données |
| `license` | Identifiant SPDX (ou `LicenseRef-…` pour une licence personnalisée) |
| `language_pair` | Source → cible, par exemple `eng-crk` |
| `do_not_train` | Toujours défini — les données d'évaluation ne doivent jamais être entraînées |
| `attribution` | Le crédit du constructeur/linguiste affiché partout où le corpus apparaît |

Au moment de l'évaluation, le harnais **récupère à partir de la source**, vérifie le `sha256`, et note par rapport aux références fraîchement récupérées. Le Réseau ne stocke, n'héberge ni ne redistribue jamais le contenu du corpus. Si vous mettez hors ligne l'archive en amont, le corpus cesse simplement d'être exécutable — le contrôle reste avec vous. C'est la même discipline de récupération à partir de la source appliquée à tout le catalogue (voir [Datasets d'évaluation](/docs/network/leaderboard/datasets)).

:::info[Pourquoi un hash plutôt qu'une copie]
Un hash de contenu permet à un score auto-déclaré d'être **revérifié** par rapport au corpus réel,
non modifié, sans que nous ne possédions jamais ce corpus. Une exécution dont les chiffres ne
se reproduisent pas par rapport à la source épinglée au hash est rejetée. La vérifiabilité et
la non-possession ne sont pas en tension ici — le hash est ce qui rend les deux possibles.
:::

---

## 2. Les trois voies d'exposition

Lors de l'enregistrement, vous choisissez le degré de visibilité du corpus et de ses références.

### Publique

Un corpus sous licence ouverte (par exemple CC0, CC-BY) dont les références peuvent apparaître sur des surfaces publiques et dont les exécutions peuvent figurer au classement public. Le contenu est toujours récupéré à partir de la source — « public » régit l'*exposition des références et des classements*, non l'hébergement. La plupart du catalogue (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT, Turkic-x-WMT, WMT24++) se trouve dans cette voie.

### Recherche non commerciale uniquement

Un corpus sous licence non commerciale (par exemple CC BY-NC-SA, ou une licence personnalisée communautaire/ONG telle que celle des kits Gamayun `LicenseRef-TWB-Gamayun`). Il peut être **comparé à des fins de recherche** — les méthodes s'exécutent sur celui-ci, les scores sont calculés — mais il est **exclu de tous les chemins commerciaux, prix et API.** L'admissibilité est **basée sur l'utilisation**, non sur le corpus :

- la **voie commerciale est stricte** — tout ce qui n'est pas clairement sous licence commerciale est exclu ;
- la **voie de recherche est indulgente** — les corpus non commerciaux sont les bienvenus ;
- la **quarantaine l'emporte toujours** — un corpus signalé comme un sous-ensemble impropre (ou autrement interdit) ne peut jamais figurer dans *aucune* voie, indépendamment de la licence.

C'est ainsi qu'une communauté peut laisser son corpus stimuler les progrès de la recherche tout en le tenant à l'écart de tout produit.

### Privée

Un corpus enregistré pour **vos propres exécutions notées**, où les références ne sont jamais publiées. Vous tenez la source ; vous exécutez l'évaluation ; vous décidez ce qui, le cas échéant, est jamais montré. Un corpus privé peut être rendu public ou non commercial ultérieurement — l'exposition ne s'assouplit que par une décision explicite et dirigée par le propriétaire, jamais silencieusement.

| Voie | Comparable | Références affichées publiquement | Peut figurer au classement public | Dans le chemin commercial / prix / API |
|------|:---:|:---:|:---:|:---:|
| **Publique** | ✅ | ✅ | ✅ | ✅ (si la licence le permet) |
| **Recherche non commerciale uniquement** | ✅ | dépend de la licence | voie de recherche uniquement | ❌ |
| **Privée** | ✅ (vos exécutions) | ❌ | ❌ | ❌ |

:::note[La lane commerciale est une barrière de sécurité, non une activité commerciale]
Champollion lui-même est non-commercial — il n'existe pas d'API payante ou de produit commercial derrière
tout cela. La lane commerciale/prix existe comme une barrière *prospective* : elle enregistre,
mécaniquement, quels corpus pourraient jamais légalement apparaître dans un contexte de prix ou
commercial, de sorte qu'aucun usage futur — par quiconque — ne puisse dériver au-delà d'une
licence ou des conditions d'un intendant.
:::

---

## 3. Garanties de souveraineté

L'enregistrement est conçu autour de la [position d'intendance des données](/docs/network/sovereignty/data-sovereignty). Concrètement :

- **La possession reste à la source.** Nous tenons un hachage et une URL, pas les données.
- **Le contrôle appartient au propriétaire.** La voie est le choix du propriétaire, et l'exposition ne s'assouplit que par une décision explicite. Retirer l'archive en amont révoque l'exécutabilité.
- **Non commercial signifie non commercial.** Les corpus NC sont mécaniquement exclus des voies commerciales, prix et API — non par promesse, par porte.
- **Les sous-ensembles impropres ne peuvent jamais figurer.** La quarantaine remplace la licence, de sorte qu'un corpus interdit de classement reste interdit partout.
- **L'attribution est obligatoire.** Le crédit du constructeur/linguiste accompagne la fiche à chaque surface où le corpus apparaît.

Pour savoir comment les conditions par langue sont définies — y compris le transfert de propriété des méthodes pour les prix parrainés — voir [Propriété et conditions](/docs/network/sovereignty/ownership-transfer).

---

## 4. Comment enregistrer

Le schéma de fiche de corpus et les outils de construction/vérification sont documentés dans le [Cadre de conception de corpus](/docs/network/specifications/corpus-design) et le [Livre de recettes de création de corpus](/docs/network/tutorials/corpus-creation). En bref :

1. Hébergez l'archive de corpus quelque part que vous contrôlez (elle y reste — elle n'est jamais copiée dans le Réseau).
2. Écrivez une fiche : `url`, `sha256`, `license`, `language_pair`, `attribution`, `do_not_train`.
3. Choisissez la voie d'exposition (publique / non commerciale / privée).
4. Enregistrez la fiche. Les méthodes peuvent maintenant être comparées au corpus récupéré à partir de la source, selon les règles de la voie.

Vous ne téléchargez jamais les phrases. Vous pouvez arrêter à tout moment.
