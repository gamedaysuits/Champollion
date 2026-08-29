---
sidebar_position: 4
title: "Diagnostic d'une exécution d'entraînement"
description: "Dépannage orienté symptômes pour l'entraînement de traduction automatique à faibles ressources — commencez par ce que vous observez, identifiez la cause probable, et trouvez le levier de configuration qui la résout."
related:
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Diagnostiquer une exécution d'entraînement

Votre modèle a été entraîné. Les chiffres ne sont pas ce que vous espériez. Cette page part de
**ce que vous observez** et vous guide vers la cause probable et l'outil forge qui
la corrige. La plupart de ces cas sont automatisés — `nmt-forge evaluate` ajoute une
section **Diagnostic & Recommandations** qui nomme le problème et le levier ;
ce guide en est la version en langage courant, plus les quelques éléments que forge ne peut que
*signaler* (marqués ⚠ **à surveiller**).

Dites à votre agent : *« Exécutez `nmt-forge lint <battery-manifest.json> --json` et agissez sur
le problème de plus haute sévérité. »* Puis comparez ce qu'il rapporte aux sections
ci-dessous.

---

## « Excellent sur mes exemples de manuel, terrible sur des phrases réelles »

**Le piège le plus courant des ressources limitées.** Vos données synthétiques/basées sur des modèles
obtiennent d'excellents scores ; le texte réel s'effondre.

**Ce qui se passe :** un **plateau de transfert**. Pendant l'entraînement, la perte sur votre
ensemble de développement réel a atteint un minimum tôt, puis a augmenté tandis que la perte d'entraînement continuait
à diminuer — le modèle maîtrisait la *masse* synthétique, non pas l'apprentissage de la
traduction. Plus de données synthétiques ne **pas** aider.

**Diagnostic forge :** `R7-transfer-plateau` (du récit d'horaire du manifeste d'exécution).
**Levier : REAL-DATA.**

**Correction :** ajoutez du texte réel. Rétrotraduisez les données monolingues en langue cible
(`nmt_forge.training.backtranslation`), ou acquérez des phrases parallèles réelles.
Le volume de données synthétiques n'est pas le levier — la variété des données *réelles* l'est.

⚠ **À surveiller :** si votre mélange est ~99 % synthétique par rapport à un petit ensemble de développement réel,
vous êtes à risque de cela *avant* de le voir dans les scores. Il n'existe pas encore de vérification préalable
pour un ratio pathologique — vérifiez les comptes or/synthétique de votre manifeste de mélange.

---

## « Un registre est beaucoup plus mauvais que les autres »

Regardez le tableau par registre. Un seul registre (par exemple, gouvernemental ou juridique) est
bien en dessous des autres.

**Deux causes différentes — le diagnostic les distingue en examinant la *couverture*
et si les sorties sont *inachevées* :**

- **Le modèle manque les mots** (`R1-vocabulary-gap` : couverture faible **et** taux
  d'inachèvement élevé). **Levier : VOCABULARY.** Agrandissez le lexique (dictionnaire /
  récolte d'attestations), puis exécutez `nmt-forge` pour la comptabilité de l'entonnoir afin de confirmer que les nouvelles
  entrées atteignent réellement le corpus — une inadéquation orthographique d'un seul caractère a
  silencieusement supprimé des milliers de mots auparavant.
- **Le modèle a les mots mais pas les formes de phrases** (`R2-structure-gap` :
  couverture OK, toujours inachevé). **Levier : STRUCTURE.** Exécutez la carte de couverture
  par rapport à votre liste de contrôle grammaticale et ajoutez les constructions manquantes
  (impératifs, questions en wh-, possession, inverse — tout ce que vos modèles n'ont jamais demandé).

---

## « Les sorties mélangent les orthographes dans une phrase »

Le modèle écrit le même son de deux façons, parfois dans une même phrase.

**Ce qui se passe :** vos cibles d'entraînement lui ont appris que les conventions sont
interchangeables — le corpus contenait le même contenu dans plusieurs
orthographies.

**Diagnostic forge :** `R3-mixed-convention`. **Levier : ORTHOGRAPHY.**

**Correction :** `convention-lint` le corpus, normalisez à **une** convention
canonique unique à la limite des données, et réentraînez. Conservez un taux de convention mixte dans votre batterie
afin de pouvoir le voir diminuer.

---

## « Le modèle B surpasse le modèle A — mais seulement d'un peu »

Vous avez comparé deux modèles et l'un est en avance d'une fraction de point.

**Ce qui se passe :** la différence peut être plus petite que le bruit. Sur 80
phrases, un écart chrF++ de 0,4 est un pile ou face.

**Diagnostic forge :** `R5-low-power` (l'intervalle de confiance est plus large que le
delta). **Levier : MEASUREMENT.**

**Correction :** n'agissez pas sur des deltas plus petits que l'IC. Agrandissez l'ensemble d'évaluation pour ce
registre, ou utilisez `nmt-forge compare` qui rapporte un test de signification
*appairé* plutôt que deux intervalles qui se chevauchent. forge ne rend jamais un score nu — l'intervalle
est toujours là précisément pour que vous puissiez voir cela.

⚠ **À surveiller :** un résultat d'une **seule graine** ne porte pas de bande
de variance entre graines. Un gain qui ne survit pas à un ré-ensemencement n'est pas réel.
Si une décision importe, réexécutez avec 2–3 graines.

---

## « Le score semble trop bon »

Suspecte ment élevé, surtout tôt ou sur peu de données. Faites confiance à votre suspicion.

**Vérifiez, dans l'ordre :**

1. **Fuite.** `nmt-forge leak-audit <corpus>` — une réponse de test s'est-elle retrouvée dans
   l'entraînement ? Les correspondances côté cible sont fatales pour une raison.
2. **Sélection du point de contrôle.** Le point de contrôle a-t-il été choisi sur un **ensemble de développement clôturé**,
   et non sur l'ensemble de test ? forge refuse de s'entraîner sans un ensemble de développement précisément pour prévenir
   cela, mais un pipeline fait à la main ne le fera pas.
3. **Optimisme des quasi-jumeaux.** `R4-optimism-bound` : si le score de batterie « complète »
   est plusieurs points au-dessus du score « strict » (quasi-doublons exclus), l'écart est
   l'optimisme des frères de forage. **Citez le nombre strict** pour toute
   affirmation de généralisation.

---

## « L'entraînement s'est arrêté presque immédiatement »

L'exécution s'est terminée après quelques centaines d'étapes ; le modèle a à peine vu ses données.

**Ce qui se passe :** l'arrêt anticipé a pris le vacillement attendu de l'ensemble de développement riche en synthétique
pour une convergence.

**Comportement forge :** cela est *prévenu* par défaut — `nmt-forge run` dérive un
**plancher** d'arrêt de votre mélange et supprime les arrêts anticipés en dessous, en enregistrant la
raison dans les lignes `[schedule-sanity]`. Si vous voyez un arrêt inattendu,
lisez ces lignes ; le manifeste d'exécution enregistre exactement ce qui s'est passé et pourquoi.

---

## « Une métrique que je voulais est simplement… absente du rapport »

Le rapport est honnête mais vide sur un axe (COMET, une vérification de validité FST).

**Diagnostic forge :** `R6-referee-unavailable` — la voie est nommée comme indisponible
avec la raison. **Levier : REFEREE.**

**Correction :** installez/configurez l'arbitre nommé et re-notez. Les scores que vous avez
sont toujours honnêtes — ils sont juste aveugles sur cet axe jusqu'à ce que l'arbitre soit
présent.

---

## « Le modèle émet `<unk>` ou des caractères brouillés »

Particulièrement sur un script syllabique ou latin étendu.

⚠ **À surveiller — pas encore automatisé.** Le **tokeniseur du modèle de base peut ne pas
représenter votre script cible**. forge n'audite pas encore la couverture du tokeniseur avant
l'entraînement (c'est l'élément principal de notre liste de lacunes). Vérifiez le tokeniseur de votre modèle de base
par rapport à des échantillons de votre script cible ; préférez une base dont le vocabulaire couvre le
script (de nombreuses langues à ressources limitées sont couvertes par les bases de la famille NLLB) ou étendez
le tokeniseur avant l'entraînement.

---

## Quand forge a refusé et vous ne comprenez pas pourquoi

Un refus énonce toujours **ce** qui s'est passé, **pourquoi** cela corrompt les résultats, et la
**correction**. Si c'est toujours flou :

- `nmt-forge status` — où vous êtes et la seule commande suivante.
- `nmt-forge preflight <command>` — chaque porte que cette commande frappera, ✓/✗, avec
  la correction pour chaque ✗, afin que vous les résolviez toutes à la fois au lieu d'une à la fois.

Un refus n'est pas une erreur dans votre configuration — c'est l'outil qui attrape une erreur avant
qu'elle n'atteigne vos résultats. C'est tout le design.
