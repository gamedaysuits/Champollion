---
sidebar_position: 4
title: "Diagnostic d'une exécution d'entraînement"
description: "Dépannage orienté symptômes pour l'entraînement de traduction automatique à faibles ressources — commencez par ce que vous observez, identifiez la cause probable, et trouvez le levier de configuration qui la résout."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
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

Votre modèle a terminé son entraînement. Les chiffres ne correspondent pas à vos attentes. Cette page part de
**ce que vous observez** pour vous guider vers la cause probable et l'outil forge capable d'y
remédier. La plupart de ces étapes sont automatisées — `nmt-forge export` (ainsi que son pendant
réservé aux scores, `nmt-forge evaluate`) ajoute une section **Diagnostic et recommandations**
qui indique le constat et le levier d'action ; ce guide en est la version vulgarisée,
avec en prime les quelques éléments pour lesquels forge ne peut qu'émettre un *avertissement* (signalés par ⚠ **à surveiller**).

Indiquez à votre agent : *« Exécutez `nmt-forge lint <battery-manifest.json> --json` et traitez
l'anomalie dont le niveau de gravité est le plus élevé. »* Après un export, le manifeste de la batterie est
`export/evaluation/battery-hyps-battery.json`. Rapprochez ensuite les éléments signalés des
sections ci-dessous.

---

## « Le score du modèle par défaut est faible »

Vous avez effectué l'entraînement avec le préréglage par défaut `cpu-tiny` et le score de test se situe
entre 5 et 30 chrF++.

**Ce qui se passe :** c'est le comportement attendu pour ce préréglage. Il s'agit d'un petit transformeur
entraîné à partir de zéro (*from scratch*) uniquement sur vos paires ; ainsi, sur 1 000 à 2 000 paires, il apprend
les tournures et les structures de phrases de vos données, et non la langue en général — le
haut de cette fourchette n'est atteint que lorsque les données reposent fortement sur des gabarits. Son rôle est de
rendre concrète l'intégralité de la boucle (jeu de dev cloisonné, données auditées, jeu de test pré-enregistré, modèle
interrogeable par le CLI), et non de constituer le modèle déployé en production.

**Solution :** modifiez un seul paramètre et mesurez-en l'impact sur le jeu de dev, selon un ordre approximatif
de rentabilité :

1. **Davantage de paires réelles.** À cette échelle, les données priment sur n'importe quel paramètre.
2. **Un point de départ pré-entraîné.** `nmt-forge init <code> --model cpu-finetune --base
   <hf-id>` affine un petit modèle pré-entraîné Marian/opus-mt sur CPU — choisissez-en
   un pour une paire de langues *apparentée*, et comparez-le avec `cpu-tiny` sur le jeu de dev
   au lieu de supposer qu'il l'emportera systématiquement. `--model nllb-600m` constitue le point de départ
   le plus performant et nécessite un GPU.
3. **Tirer plus de données de l'existant** — rétro-traduction de texte monolingue, ou
   synthèse vérifiée si votre langue dispose d'un analyseur (consultez
   [Vous souhaitez entraîner votre propre modèle](/docs/network/tutorials/train-your-own-model)).

⚠ **à surveiller :** un score élevé issu de `cpu-tiny` doit éveiller la méfiance avant
d'être célébré — voir [« Le score semble trop beau »](#the-score-looks-too-good).

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

1. **Fuite de données (leakage).** `nmt-forge leak-audit <corpus>` — une phrase de test s'est-elle retrouvée dans
   l'entraînement ? L'outil élimine les lignes dont l'invite est identique à une invite de test (même avec
   une traduction différente), les lignes dont la réponse est identique à une réponse de test,
   et les lignes qui contiennent une réponse de test, en sont un fragment ou lui sont identiques à ≥ 90 %. `nmt-forge run` refuse les lignes d'entraînement qui fuient dans un jeu de test
   ou un jeu scellé enregistré ; cela concerne donc principalement les données ou un pipeline externe à
   forge — ou un jeu de test que vous n'avez jamais enregistré.
2. **Sélection du point de contrôle (checkpoint).** Le point de contrôle a-t-il été sélectionné sur un **jeu de dev cloisonné**,
   et non sur le jeu de test ? forge refuse de s'entraîner sans jeu de dev précisément pour empêcher
   cela, alors qu'un pipeline développé sur mesure ne le fera pas.
3. **Optimisme dû aux quasi-doublons.** `R4-optimism-bound` : si le score de la batterie « complète »
   dépasse de plusieurs points le score « strict », cet écart provient de l'optimisme lié aux variations de gabarits (drill-siblings). `leak-audit` *conserve* volontairement les variantes issues de gabarits (*« I see the
   dog »* à l'entraînement, *« I see the cat »* dans le jeu de test) et répertorie les lignes de test
   qui en possèdent une ; lorsque `eval.near_dupe_corpus` pointe vers votre fichier d'entraînement (ce que fait la
   configuration initiale), le rapport évalue séparément les lignes de test *dépourvues* de
   variante, signalées par la mention « (strict) ». **Citez le score strict** pour toute
   revendication de généralisation. Si *chaque* ligne de test possède une variante (`R4-recall-not-translation` :
   le sous-ensemble strict est vide, le score mesure donc le rappel des
   phrases d'entraînement), et que le jeu de test est figé, écrivez un corpus sans doublons dans un fichier distinct
   avec `nmt-forge leak-audit <train> --clean-to <train>.notwins.jsonl
   --drop-test-twins` et entraînez un second modèle sans doublons à partir de celui-ci (leak-audit
   n'écrasera pas le fichier utilisé pour l'entraînement du premier modèle) — ou bien obtenez des phrases de test
   rédigées indépendamment des gabarits d'entraînement.
4. **Les sorties ne correspondent pas aux entrées.** `R9-harness-score-caveat` : le
   rapport de mt-eval indique que le score fait l'objet d'une réserve — le plus souvent une **sortie quasi-constante** :
   de nombreuses phrases de test distinctes ont généré les mêmes quelques sorties (un
   modèle hospitalier a répondu à 150 phrases différentes avec seulement 9 sorties ; il a pourtant
   obtenu un score chrF++ de 48, car une phrase fréquente partage de nombreux caractères avec
   de multiples références). Le modèle sans doublons est le suspect habituel : privés de ses
   gabarits d'entraînement, un petit modèle peut se rabattre sur ses phrases les plus
   fréquentes. forge répercute cette réserve selon les termes exacts du banc de test —
   dans le résumé de l'export, `DEPLOY.md`, `status`, `report`, `compare` et
   `lint` — et ne qualifie jamais un tel score de « chiffre de référence » sans cette mention.
   Examinez quelques sorties (`<export>/evaluation/battery-hyps.jsonl`, sur
   la machine hébergeant le jeu de test) avant de communiquer le score comme représentatif de la
   qualité de traduction ; disposer de davantage de paires d'entraînement réelles et variées constitue le levier adapté.

---

## « L'entraînement s'est arrêté presque immédiatement »

L'exécution s'est terminée après quelques centaines d'étapes ; le modèle a à peine vu ses données.

**Ce qui se passe :** l'arrêt anticipé a pris le vacillement attendu de l'ensemble de développement riche en synthétique
pour une convergence.

**Comportement de forge :** ceci est *évité* par défaut — `nmt-forge run` calcule un
**seuil minimal** d'arrêt à partir de votre mix et neutralise les arrêts précoces en dessous de celui-ci, en consignant la
raison dans les lignes `[schedule-sanity]`. La fréquence d'évaluation du jeu de dev est
également dérivée de la taille de l'exécution, de sorte qu'une petite exécution ne reste pas sans évaluation. Si
vous constatez un arrêt inattendu, lisez ces lignes ; le manifeste d'exécution consigne
exactement ce qui s'est produit et pourquoi. (Une exécution qui a simplement atteint sa dernière étape planifiée
est signalée comme terminée, et non comme un arrêt précoce.)

---

## « L'exécution a été refusée avant même de commencer »

**Ce qui se passe :** un mécanisme de contrôle (gate) s'est déclenché — ce qui est bien moins coûteux qu'une exécution échouant
après plusieurs heures. Les plus fréquents :

- **L'extra d'entraînement est manquant** — `nmt-forge preflight run --config
  config.json` shows `✗ backend-installed` accompagné de la solution,
  `python3 -m pip install 'nmt-forge[hf]'`.
- **Aucun jeu de dev, ou un jeu incorrect** — le cloisonnement de dev refuse toute exécution dont
  `data.dev` n'est pas un jeu enregistré avec le rôle `dev`. Isolez-en un avec
  `nmt-forge split … --register project`.
- **Fuite de données (leakage)** — un fichier d'entraînement partage des invites ou des réponses avec un jeu
  de test ou un jeu scellé enregistré. Nettoyez-le avec `nmt-forge leak-audit <file> --clean-to
  <file.clean.jsonl>` et faites pointer la configuration vers le fichier nettoyé.
- **Temps réel d'exécution (wall-clock)** — au cours des premières minutes, forge mesure la vitesse d'entraînement et
  refuse une exécution estimée devoir dépasser `model.time_budget_hours`. Sur CPU, cela
  signifie généralement que le préréglage requiert un GPU (`nllb-600m`), ou que le mix est bien plus volumineux
  que prévu. Le message indique les leviers : un mix plus restreint, des séquences plus courtes,
  ou un budget supérieur si vous acceptez ce délai d'attente.

**Solution :** exécutez `nmt-forge preflight run --config config.json` avant chaque exécution ;
il répertorie chaque point de contrôle, ✓/✗, avec la solution pour chaque ✗.

---

## « Une métrique que je voulais est simplement… absente du rapport »

Le rapport est honnête mais vide sur un axe (COMET, une vérification de validité FST).

**Diagnostic forge :** `R6-referee-unavailable` — la voie est nommée comme indisponible
avec la raison. **Levier : REFEREE.**

**Solution :** installez/configurez l'arbitre désigné et recalculez les scores. Lorsque la fiche
de langue déclare l'arbitre, le message de forge indique la commande d'installation
(`mt-eval setup --lang <code>`). Les scores dont vous disposez restent fidèles — ils
sont simplement aveugles sur cet axe particulier tant que l'arbitre n'est pas présent.

---

## « Le modèle émet `<unk>` ou des caractères brouillés »

Particulièrement sur un script syllabique ou latin étendu.

**Cela dépend du préréglage.**

- **`cpu-tiny`** apprend son propre vocabulaire à partir de vos lignes d'entraînement ; ainsi, chaque
  caractère présent dans l'entraînement est pris en compte. `<unk>` signifie ici que l'entrée
  contient un caractère qui n'est jamais apparu lors de l'entraînement — une lettre rare ou
  un signe diacritique, ou une forme Unicode différente de celui-ci (le texte est normalisé en NFC, de sorte
  que les accents composés et décomposés sont traités de manière identique). Vérifiez que vos données d'entraînement
  et de test utilisent la même orthographe.
- **`cpu-finetune` et `nllb-600m`** utilisent le tokenizer du modèle de base pré-entraîné.

⚠ **à surveiller — pas encore automatisé (bases pré-entraînées).** Le **tokenizer** du modèle
de base **peut ne pas prendre en charge votre système d'écriture cible**. forge n'audite pas encore la
couverture du tokenizer avant l'entraînement. Vérifiez le tokenizer de votre modèle de base sur
des échantillons de votre écriture cible ; privilégiez une base dont le vocabulaire couvre cette écriture
(de nombreuses langues à faibles ressources sont prises en charge par les modèles de la famille NLLB) ou étendez le
tokenizer avant l'entraînement.

---

## Quand forge a refusé et vous ne comprenez pas pourquoi

Un refus énonce toujours **ce** qui s'est passé, **pourquoi** cela corrompt les résultats, et la
**correction**. Si c'est toujours flou :

- `nmt-forge status` — où vous vous situez et l'unique commande suivante.
- `nmt-forge preflight <command>` — chaque contrôle que cette commande rencontrera, ✓/✗, avec
  la solution pour chaque ✗, afin de tous les résoudre d'un coup plutôt qu'un par un
  (pour `run`, `evaluate` et `export`, ajoutez `--config config.json`).
- Ajoutez `--json` à n'importe quelle commande lorsqu'un agent analyse le résultat : un refus
  est alors renvoyé sous la forme d'un objet JSON unique — `{"error": {"type", "guard", "message",
  "why", "fix", …}}` — avec le code de sortie 2.

Un refus n'est pas une erreur dans votre configuration — c'est l'outil qui attrape une erreur avant
qu'elle n'atteigne vos résultats. C'est tout le design.
