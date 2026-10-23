---
title: "Classement et publication"
slug: /reference/leaderboard
description: "Ce qu'est le classement public, les deux types de bancs d'essai (public et scellé), ce qu'il couvre et ne couvre pas, et ce que comporte exactement une exécution publiée."
---

# Classement et publication

Le [classement](/leaderboard) est un registre public d'exécutions de traduction évaluées.
Tout le monde peut y contribuer : vous exécutez le banc d'évaluation (`mt-eval`) sur votre propre
machine, par rapport à un jeu de données enregistré, et vous publiez le résultat sous forme d'une **fiche
d'exécution**. Le tableau conserve la fiche ; il n'exécute pas votre méthode à votre place. Il
ne conserve le texte par phrase que pour les jeux de données sous licence libre et redistribuables —
jamais pour ceux non commerciaux, restreints, scellés, mis en quarantaine ou strictement locaux,
et jamais lorsque vous publiez avec `--scores-only`.

Il s'agit d'un registre de mesures, non d'un verdict sur un traducteur quelconque. Une position dans
ce classement indique comment une méthode a été notée sur un jeu de données selon une métrique donnée. Elle n'indique pas
que la traduction est bonne, et elle n'accorde à personne l'autorisation d'utiliser une méthode sur la
langue d'une communauté.

## Trois éléments distincts

| | Ce que c'est | Où il s'exécute |
|---|---|---|
| **Le banc d'évaluation** ([`mt-eval`](/docs/network/specifications/harness)) | L'évaluateur. À partir d'une méthode et d'un ensemble de test, il produit un score et une fiche d'exécution | Votre machine |
| **Le classement** | Le point de soumission et le registre des fiches d'exécution, indexé par jeu de données et direction de paire | champollion.dev |
| **La carte du réseau** | Ce que représentent l'ensemble des exécutions publiées : quelles paires ont été mesurées, et lesquelles ne l'ont pas été | Une vue du registre, pas un composant |

Rien n'entre dans la carte sans passer par le tableau, et rien n'entre dans le tableau
si ce n'est sous la forme d'une exécution évaluée et dotée d'une empreinte numérique. Une mesure dépourvue de provenance ne peut
en faire partie.

## Deux types de tests de référence

Les **tests de référence publics** utilisent des jeux de données ouverts. Chaque jeu de données est enregistré sous forme
d'une fiche de métadonnées avec un pointeur de récupération à la source : le banc télécharge les
références en amont au moment de l'exécution, les vérifie par rapport à un SHA-256 figé,
et calcule le score par rapport à ce qu'il a récupéré. Les données publiques peuvent déjà figurer dans les données
d'entraînement d'un modèle ; les jeux de données comportent donc un niveau de contamination. Un jeu classé `HIGH`
ou `MEDIUM` (FLORES+ est `HIGH`), ou non classé du tout, est **uniquement relatif** :
utilisable pour comparer les méthodes exécutées sur lui, jamais rapporté comme une qualité absolue.
Seul un ensemble classé `LOW` permet d'établir un classement en qualité absolue. Un jeu de données mis en quarantaine
n'est jamais classé : la base de données refuse tout score soumis à son encontre.
Les jeux de données enregistrés et leurs régimes de licence sont répertoriés dans
[Jeux de données d'évaluation](/docs/network/leaderboard/datasets).

Les **tests de référence scellés** sont des ensembles de test réservés que leur hôte conserve sur sa propre
machine. Les participants ne les voient jamais. Une participation est un modèle ou une méthode que le
propre nœud d'évaluation de l'hôte exécute sur l'ensemble scellé ; seuls les scores en ressortent, et
chaque exécution scellée nécessite l'autorisation de l'hôte. Les clés de ces ensembles sont aujourd'hui
détenues par les organisateurs. Dépositaires communautaires des clés — aucun n'a encore été nommé ;
Champollion ne détient aucune part de clé. Les prix n'existent que sur les concours scellés, selon
des modalités que l'hôte déclare avant que quiconque ne participe. Comment en héberger un :
[Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest).

## Portée

- **Texte écrit.** Le tableau mesure la traduction de texte écrit : documents,
  matériel pédagogique et officiel, chaînes d'interface utilisateur. Il ne mesure pas la parole,
  l'interprétation en temps réel ou le dialogue ouvert.
- **Langues textuelles.** La traduction automatique des langues des signes est un problème
  différent ; les entrées relatives aux langues des signes dans l'index indiquent « pas encore pris en charge »
  ([Ce qui compte comme une langue](/docs/network/context/what-counts-as-a-language)).
- **Un seul jeu de données à la fois.** Un score n'est comparable qu'avec des scores portant sur la
  même version d'un jeu de données. Les classements ne croisent jamais les jeux de données ni les langues.
- **Des méthodes, pas des phrases.** Un score décrit une méthode sur un test de référence. Aucun
  indice de confiance par phrase n'est publié pour une traduction quelconque
  ([Limites techniques](/docs/network/honest-limitations#system-vs-output)).

## Ce que comporte une exécution publiée

Chaque nouvelle fiche est évaluée selon le **standard de notation/1**
([Spécification de notation](/docs/network/specifications/scoring)) :

- **Le résultat principal :** le chrF++ au niveau du corpus (0–100) avec son intervalle de
  confiance bootstrap à 95 % et sa signature sacreBLEU, afin que chacun puisse le recalculer.
- **À côté :** BLEU, spBLEU et TER, ainsi que COMET lorsqu'il a été calculé. Ils sont
  affichés, jamais combinés dans le résultat principal.
- **À part :** des diagnostics tels que l'acceptation FST et la correspondance exacte, lorsque leurs
  outils existent. Ils n'entrent jamais dans le résultat principal et ne classent pas une exécution.
- **Champs retirés :** `composite`, `quality_tier` et `cost_adjusted` sont
  `null` sur chaque nouvelle fiche. Une ancienne fiche conserve son score composite enregistré, affiché comme
  « score composite hérité (retiré) ». Aucun score automatique ne porte de label de qualité.
- **Provenance :** l'identifiant du jeu de données et son SHA-256, l'identifiant exact du modèle, la
  condition, ce qui a été transmis au modèle (le SHA-256 de l'invite, et son texte
  sauf si vous le masquez), le coût, la version du banc et une empreinte numérique de
  la configuration. Les exécutions identiques sont dédupliquées lors de la publication, et une réplication
  indépendante compte comme une preuve.
- **Niveau de confiance :** chaque ligne arrive en tant qu'*auto-évaluée*. *Vérifié par Champollion*
  signifie que le score a été recalculé à partir des sorties que vous avez soumises par rapport aux
  références figées ; ce réévaluateur est une commande exécutée manuellement par les mainteneurs, de sorte
  qu'aujourd'hui aucune ligne n'est promue dès son arrivée. *Validé par la communauté* n'est attribué
  que par l'examen propre à une communauté ([niveaux de vérification](/docs/network/leaderboard/rules#verification-tiers)).

Le schéma complet est disponible dans la [Spécification de la fiche d'exécution](/docs/network/specifications/run-card).

## Publication

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- `--prod` (ou `MT_EVAL_ALLOW_PROD=1`) est requis pour écrire sur le tableau
  en direct ; sans cela, le banc refuse.
- `--anonymous` publie sans connexion ; le tableau affiche « anonyme ».
- `--scores-only` publie les scores agrégés ainsi que le hachage et la taille du jeu de données,
  jamais le texte source ou de référence — pour votre propre corpus ou un corpus privé.
- `--redact-coaching` remplace le texte de l'invite par un marqueur et en conserve le
  hachage. L'invite guidée d'un corpus strictement local est masquée par défaut.

Le guide pas à pas se trouve sur [Soumettre une méthode](/docs/network/getting-started/submit-a-method).

## Les règles qui s'appliquent partout

- **Ne jamais s'entraîner sur les données d'évaluation.** Une méthode exposée à un ensemble de référence — en tant
  que données d'entraînement, exemples few-shot, entrées de dictionnaire ou matériel d'invite — est
  disqualifiée ([Règles de soumission](/docs/network/leaderboard/rules)).
- **La supériorité se décide par un test, pas par deux nombres.** Déterminer si une exécution en surpasse
  une autre relève d'un test de significativité apparié sur chrF++ ; les voisins que le test ne peut
  départager partagent le même rang ([Significativité](/docs/network/specifications/significance)).
- **Les corpus ne sont pas hébergés ici.** L'enregistrement n'est constitué que de métadonnées ; les corpus sont
  récupérés depuis leur source. Une exécution publiée d'un ensemble sous licence libre peut
  comporter son texte par phrase (voir ci-dessus).
- **Les régimes de licence sont structurels.** Les corpus non commerciaux sont exclus de
  tout prix, API et circuit commercial. Un corpus sous une licence modifiée, sur mesure ou
  non précisée (`LicenseRef-*`) refuse toute évaluation par API de modèle distant tant
  que le consentement de son ayant droit n'est pas consigné sur sa fiche ; les licences non commerciales
  standards ne sont transmises aux modèles distants que par des canaux sans entraînement ; les segments scellés
  ne sont jamais transmis à distance. Les ensembles en cri des plaines d'EdTeKLA sont répertoriés avec des étiquettes
  de mise en quarantaine, et la base de données refuse tout score publié à leur encontre.

## Ce qui fonctionne aujourd'hui

- Le tableau est actif, public et ouvert aux soumissions. Son contenu est constitué de données
  en direct, cette page ne le décrit donc pas — [consultez le classement](/leaderboard).
- Chaque ligne est aujourd'hui auto-évaluée (voir les niveaux de confiance ci-dessus).
- Aucun prix n'est ouvert, et aucun score n'a franchi le seuil d'un prix
  ([Spécification des prix](/docs/network/specifications/prizes)).
- Aucune évaluation par des locuteurs de la communauté n'a été menée
  ([Validation par les locuteurs](/docs/network/specifications/speaker-validation)).
- Aucune méthode n'a été transmise à une communauté selon les modalités d'un concours.

La page [Limites techniques](/docs/network/honest-limitations) contient la liste complète de ce qui
n'est pas revendiqué ; en cas de divergence entre cette page et celle-là, c'est cette dernière qui prévaut.

## Voir aussi

- [Règles de soumission](/docs/network/leaderboard/rules) — ce qui est accepté,
  disqualification, vérification et réputation.
- [Jeux de données d'évaluation](/docs/network/leaderboard/datasets) — le registre et
  ses régimes de licence.
- [Soumettre une méthode](/docs/network/getting-started/submit-a-method) et la
  [FAQ](/docs/network/getting-started/faq).
- [Notation](/docs/network/specifications/scoring),
  [Significativité](/docs/network/specifications/significance) et la
  [Fiche d'exécution](/docs/network/specifications/run-card).
- [Contribuer en puissance de calcul](/docs/network/getting-started/contributing-compute) —
  traitez des éléments de la file d'attente publique avec votre propre clé.
