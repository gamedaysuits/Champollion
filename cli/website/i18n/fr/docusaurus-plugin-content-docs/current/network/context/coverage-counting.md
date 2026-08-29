---
sidebar_position: 6
title: "Décomptes de couverture : comment nous les calculons"
description: "Comment Champollion comptabilise les « langues avec traduction automatique » — les deux niveaux (tout moteur confondu vs service déployé), la source unique de vérité (SSOT) dont est extrait chaque chiffre affiché, et la discipline d'actualisation. Toute correction est la bienvenue."
---

# Décomptes de couverture : comment nous les comptabilisons

> **Résumé analytique.** Lorsque le site indique que **552 langues vivantes disposent d'une traduction automatique** et que **196 sont prises en charge par un service déployé**, il s'agit de deux décomptes différents et délibérément distincts. Cette page définit les deux niveaux, nomme la source unique de vérité à partir de laquelle chaque nombre est lu au moment de la compilation, et décrit comment les listes sont actualisées. La couverture est une *déclaration d'existence*, jamais une déclaration de qualité.

## Les deux niveaux

**Niveau 1 — tout moteur de TA dédié (« couverte »).** Une langue vivante est considérée comme couverte si elle figure sur la liste publiée des langues prises en charge par *n'importe quel* moteur de TA dédié suivi — qu'il s'agisse de services grand public/API déployés (Google Translate, Microsoft Translator, DeepL, LibreTranslate, …) **ou** de modèles de recherche ouverts (NLLB-200, OPUS-MT, M2M-100, MADLAD-400, …). C'est cette union qui allume un point vert sur la carte du réseau.

**Niveau 2 — service déployé (« desservie »).** Le critère le plus strict : la langue figure sur la liste d'un moteur que n'importe qui peut réellement *utiliser aujourd'hui* en tant que service grand public ou API. Un point de contrôle de recherche ouvert que vous devriez télécharger, héberger et servir vous-même n'est pas comptabilisé ici. C'est le nombre qui répond à la question : « un locuteur pourrait-il traduire une page web en ce moment même, sans travail d'ingénierie ? »

Les deux niveaux existent car ils répondent à des questions différentes, et les fusionner surestimerait la couverture mondiale. Les deux sont comptabilisés uniquement sur les **langues vivantes individuelles ISO 639-3** (`isoType: 'L'`).

## D'où proviennent les nombres (aucune saisie manuelle)

Chaque décompte affiché est une **lecture lors de la compilation** des sources uniques de vérité (SSOT) de la machine — aucun chiffre sur le site n'est saisi dans le texte et laissé tel quel jusqu'à devenir obsolète :

1. **Les listes par moteur** se trouvent dans `cli/shared/catalogue/method-coverage.json` —
   une entrée par moteur, importée *à titre de citation uniquement* depuis la propre liste publiée
   des langues prises en charge par ce fournisseur, avec son `source_url` et une date `asOf`. Champollion
   n'audite ni ne reproduit ces listes ; il s'agit des propres déclarations des fournisseurs.
2. **La compilation croise** ces listes avec l'index des langues vivantes et émet les
   décomptes de niveaux dans les statistiques de compilation du site (`stats.coverage.dedicatedLiving` pour
   le niveau 1, `stats.coverage.serviceLiving` pour le niveau 2, sur `stats.livingTotal`
   langues vivantes).
3. **Les pages affichent les statistiques**, et un contrôle de parité pré-push fait échouer la compilation si le texte
   et les statistiques venaient à diverger.

## « 194 langues » et « 187 langues » peuvent tous deux être vrais

La liste d'un fournisseur et un décompte de *langues* ne sont pas le même objet, c'est pourquoi chaque entrée dans la SSOT déclare à quoi correspond son nombre :

- **`publisher-list-rows`** — la longueur de la propre liste publiée par le fournisseur,
  exactement telle qu'il la publie. La page Cloud Translation de Google répertorie **194** lignes
  pour son modèle NMT ; c'est le chiffre que ce site attribue nommément à Google.
- **`champollion-derived-enumeration`** — *notre* réduction de cette liste aux langues
  de base ISO 639-3 distinctes. Ces mêmes 194 lignes de Google correspondent à **187** langues,
  car `zh-CN` et `zh-TW` constituent une seule langue dans deux écritures, tout comme `pt-PT`
  et `pt-BR`, et ainsi de suite. Ce nombre est le nôtre, jamais celui du fournisseur.
- **`publisher-stated-headline`** — un total affirmé par le fournisseur sans aucune liste
  publiée pour l'étayer. Rien ne peut en être déduit.

L'écart entre les deux premiers est arithmétique, et non un désaccord, et il se retrouve chez chaque fournisseur : Microsoft 135 lignes → 128 langues, LibreTranslate 49 → 47, les 200 variantes FLORES de NLLB-200 → 196. La carte et les décomptes de niveaux lisent la *liste énumérée*, jamais le titre. Un contrôle pré-push fait échouer la compilation si la base déclarée d'une entrée et sa liste se contredisent.

Notez également qu'un fournisseur peut publier plusieurs listes. La page de Google comporte un tableau distinct pour son niveau Translation LLM (127 lignes au 2026-08-16) et n'indique aucun total combiné — ainsi, la question « combien de langues Google prend-il en charge ? » n'a pas de réponse unique publiée, et ce site n'en invente aucune.

## La couverture revendiquée n'est pas la qualité — et n'est pas toujours déployable

Une langue figurant sur la liste d'un fournisseur signifie que le fournisseur *revendique sa prise en charge*, rien de plus. Deux notes de transparence que le site applique partout où ces décomptes apparaissent :

- **Couverture ≠ qualité.** Savoir si les traductions sont bonnes est une question distincte
  et mesurée — c'est tout l'intérêt du réseau d'évaluation (benchmark). Les revendications
  de qualité se trouvent dans le classement, classées par (méthode, jeu de données, métrique) ; les revendications
  de couverture se trouvent ici.
- **Revendiquée ≠ déployable.** Les modèles de recherche à large spectre peuvent revendiquer des nombres
  de langues très élevés alors que leur propre documentation fait état d'une qualité utilisable pour un sous-ensemble
  beaucoup plus restreint. Lorsqu'un fournisseur publie une telle auto-évaluation, le site affiche le
  décompte revendiqué *et* le propre chiffre de qualité/déployabilité du fournisseur, chacun étant cité à partir
  des documents du fournisseur.

## La discipline d'actualisation

Les listes des fournisseurs changent ; les décomptes doivent suivre, mécaniquement :

- Chaque entrée dans `method-coverage.json` porte sa propre date `asOf`, et le fichier
  comporte un `asOf` de niveau supérieur — la date du dernier balayage. Les surfaces qui affichent
  les décomptes de couverture affichent ou lient cette date.
- Un **balayage SOTA** (revérification de la liste publiée de chaque fournisseur, ajout de nouveaux
  moteurs suivis) est une tâche de maintenance périodique ; le balayage met à jour la SSOT, et
  chaque décompte sur le site suit lors de la compilation suivante. Rien ne doit être « mémorisé »
  dans le texte de la page.
- Entre les balayages, les décomptes sont exactement aussi récents que leurs dates `asOf` — c'est
  pourquoi ces dates font partie des données, et non d'une convention de note de bas de page.

## Corrections et débats bienvenus

Si la liste d'un fournisseur a changé, si une langue est mal classée, ou si vous pensez qu'une limite de niveau est mal définie, dites-le-nous — ouvrez un ticket sur
[github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues)
ou envoyez un e-mail à [info@champollion.dev](mailto:info@champollion.dev).

---

## Sources

- **Listes par moteur** — `cli/shared/catalogue/method-coverage.json` : la propre liste publiée
  des langues prises en charge par chaque moteur (à titre de citation uniquement ; `source_url` + `asOf` par entrée).
- **Ensemble des langues vivantes** — langues vivantes individuelles ISO 639-3 (`isoType: 'L'`)
  dans l'index des langues construit à partir des fiches de langues citées.
- **Décomptes de niveaux** — émis lors de la compilation `stats.coverage.dedicatedLiving` (niveau 1),
  `stats.coverage.serviceLiving` (niveau 2), `stats.livingTotal`. Dérivés de Champollion.
- **L'estimation de la population basée sur ces décomptes** — voir
  [L'écart de couverture : comment nous l'estimons](/docs/network/context/coverage-gap-estimate).
