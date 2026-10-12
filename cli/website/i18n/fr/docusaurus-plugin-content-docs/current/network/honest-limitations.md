---
title: "Limitations Honnêtes"
description: "Ce que Champollion ne prétend pas (encore) faire. Les limites vérifiables de notre évaluation, nos niveaux de confiance, la validation communautaire et l'infrastructure réservée."
---

# Limitations honnêtes

> Ce sont les affirmations que nous ne **dépasserons pas**. Si quoi que ce soit
> d'autre sur ce site implique davantage que ce qui est écrit ici, considérez-le
> comme un bogue et [signalez-le-nous](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Une infrastructure d'évaluation ne gagne la confiance qu'en étant honnête quant à
ses limites. Voici les nôtres, énoncées clairement pour que vous puissiez les
vérifier.

## 1. La validation morphologique approfondie dépend d'un FST *et* d'un jeu de test classable

La validation morphologique basée sur les FST — qui consiste à vérifier que chaque mot produit est un
mot bien formé dans la langue cible — nécessite deux éléments pour une paire de
langues : un FST épinglé par le banc d'évaluation, et un jeu d'évaluation pour la paire qui
permette d'établir un classement. Le `GiellaLTFSTMetric` lui-même est **générique** : il évalue toute
langue disposant d'un FST GiellaLT épinglé (cri des Plaines, langues sames,
finnois, norvégien bokmål, inuktitut, entre autres). Plusieurs de ces langues
disposent de jeux d'évaluation ouverts (Tatoeba, WMT, WMT24++) — la
[page des jeux de données](/docs/network/leaderboard/datasets) répertorie le catalogue,
`mt-eval corpora --source eng --target <code>` liste ce qui peut être exécuté pour une paire,
et `mt-eval corpora --with-fst` ne liste que les paires dont la cible dispose d'un
FST épinglé, en indiquant s'il est installé sur votre machine.
Le cri des Plaines, la langue avec laquelle le travail sur les FST a débuté, fait exception : ses
deux jeux d'évaluation (EdTeKLA) sont répertoriés avec des étiquettes en quarantaine, et la
base de données refuse tout score publié pour ceux-ci.

Deux limites supplémentaires s'appliquent. Lorsque le FST épinglé n'est qu'un
**accepteur** orthographique (same du Nord, amharique, basque), il indique si un mot existe
mais pas s'il est correctement fléchi, de sorte que `morphological_accuracy` n'est pas
calculé — et un accepteur admet certains mots anglais et mots commençant par une majuscule, de sorte que
l'acceptation FST peut créditer du texte non traduit (la fiche d'exécution affiche alors un
avertissement de copie de source ; voir [avertissements sur les scores](/docs/network/specifications/scoring#2-8-score-caveats)). L'acceptation FST est un diagnostic : elle n'entre jamais dans le score chrF++ principal ni ne classe une exécution.
Elle crédite également une phrase valide répétée pour chaque entrée ; la fiche d'exécution
affiche alors un avertissement de sortie quasi constante.
Et toute paire sans FST est évaluée avec des métriques de surface (chrF++, BLEU)
et des vérifications comportementales. Ce sont des signaux utiles, mais ils ne
garantissent **pas** la validité morphologique. Nous ne revendiquons aucune validation morphologique
pour une langue sans disposer à la fois d'un FST et d'un jeu d'évaluation permettant d'établir un classement.

## 2. Les niveaux de confiance sont auto-déclarés au lancement

La plupart des scores sont calculés par des contributeurs exécutant eux-mêmes
l'infrastructure et publiant le résultat. La **vérification** côté serveur —
réévaluer une soumission par rapport au corpus canonique épinglé par SHA — existe
et s'étend, mais « vérifié » n'est pas encore universel. Lisez le badge de
confiance sur chaque ligne : **« auto-déclaré signifie exactement cela »**, et
c'est la valeur par défaut.

## 3. La validation par des locuteurs de la communauté n'a pas encore eu lieu

Notre prix exige **≥ 70 % d'acceptation par des locuteurs bilingues**. Ce critère d'admissibilité est
spécifié, et l'outillage pour l'appliquer est en cours de développement — mais **aucune
évaluation par des locuteurs de la communauté n'a été menée**, et **aucun score sur ce site n'a franchi le
filtre des locuteurs**. Le chrF++ et tout autre indicateur automatique sont des signaux machine,
non un verdict communautaire, raison pour laquelle aucun score ici ne porte de label de qualité.

## 4. Le bac à sable d'évaluation et la cérémonie des clés existent ; aucun dépositaire ne les a encore utilisés

Nous récupérons les corpus depuis leur source et les épinglons par empreinte SHA, et les découpages réservés sont
scellés. Lorsqu'une communauté détient un jeu de test secret, une méthode peut être évaluée
par rapport à celui-ci sans que le jeu ne quitte jamais ses mains — et cette évaluation
comporte désormais **deux voies**. La
voie privilégiée, pour les modèles neuronaux standards, est **déclarative** : le participant
soumet uniquement des données — poids safetensors + un tokenizer déclaratif + une configuration —
et l'organisateur l'exécute dans son propre moteur d'inférence de confiance
(`trust_remote_code=False`, hors ligne ; souple quant à l'architecture car
la sécurité réside dans le format sans code, et non dans le nom de l'architecture). Aucun code de participant n'est exécuté,
il n'y a donc rien à isoler en bac à sable ; le contrôle de sécurité est une validation de format
décidable (s'agit-il de safetensors et non d'un pickle ? pas de `trust_remote_code` ?), et non
une tentative de prouver qu'un code arbitraire est sûr. Pour les méthodes qui sont véritablement du code
(pipelines, hybrides guidés par LLM), la solution de repli est le **bac à sable**
isolé du réseau (vérifications statiques, conteneurs `--network=none`, sortie limitée aux scores seuls,
transport de fichiers optionnel avec véritable barrière physique). Le bac à sable n'ayant pas d'accès réseau, une
méthode n'y fonctionne que si chaque modèle qu'elle appelle se trouve dans son bundle : un
hybride guidé par LLM doit intégrer son LLM sous forme de poids ouverts, puisqu'une API LLM hébergée
est inaccessible. Le bac à sable isole le code non fiable plutôt
que de refuser de l'exécuter, ce qui en fait la voie intrinsèquement plus fragile — sa garantie
fondamentale repose sur `--network=none` (une analyse statique heuristique ne peut valider un
modèle binaire), et un durcissement plus poussé (seccomp, microVM) est différé. Consultez
[organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest)
pour savoir exactement ce qui est actif et ce qui ne l'est pas. La **cérémonie des clés** du nœud hors ligne est
**implémentée** — la clé du jeu est fractionnée en M-sur-N et réassemblée uniquement en mémoire lors d'une
exécution autorisée par quorum — mais elle n'a jamais été utilisée avec un véritable dépositaire, et
les parts sont de simples fichiers dans cette première version. Ce qui n'est **pas** implémenté : la signature
à seuil (un score est signé par une seule clé de nœud) et l'attestation matérielle (les manifestes
de scores sont signés de manière logicielle uniquement). Aucun dépositaire n'ayant été désigné,
l'évaluation du **prix** de référence reste fermée tant que les dépositaires et
le consentement de la communauté ne sont pas en place.

## 5. La garde des clés est conçue ; aucun dépositaire n'a encore été désigné

Le *mécanisme* de garde est conçu : un schéma à seuil dans lequel **Champollion
est conçu pour ne détenir aucune part de clé**. Il n'a pas encore été exécuté avec de véritables
dépositaires. Les dépositaires sont choisis par les communautés elles-mêmes, et aucun n'a
été désigné, c'est pourquoi nous indiquons **« dépositaires communautaires des clés — aucun désigné pour le moment »**.
La garde n'équivaut pas au consentement : le processus relationnel de consentement communautaire constitue son propre
volet, plus lent et plus important.

## 6. Nous évaluons des méthodes sur des bancs d'essai ; nous ne notons pas les traductions individuelles {#system-vs-output}

Deux notions distinctes sont qualifiées de « traduction automatique digne de confiance ». Nous ne faisons que l'une
d'entre elles.

**Niveau système — ce que nous faisons.** Pour une paire de langues, un jeu de test et une méthode donnés :
quel score obtient cette méthode, selon quelle métrique, sur quel domaine, dans quelle
voie de contamination, à quel niveau de confiance ? Il s'agit d'une affirmation sur une *méthode sur un
banc d'essai*, assortie d'une affirmation sur qui a fixé la barre. Les règles d'évaluation sont
publiées, les corpus sont épinglés, et pour un banc d'essai souverain, la communauté
propriétaire du jeu de test décide de ce qui est validé. Le tableau de classement, la carte, les fiches
d'exécution et `mt-eval` représentent tout cela, et uniquement cela.

**Niveau sortie — ce que nous ne faisons pas.** Pour une phrase source et une
traduction de celle-ci données : quelle est la probabilité que *cette* traduction soit correcte ? En TA et en TAL,
cela relève de l'estimation de la qualité et de la quantification de l'incertitude, qui constituent un champ de recherche
à part entière. Nous ne publions **aucun indice de confiance par segment sur aucune traduction**,
et rien ici ne constitue une probabilité calibrée qu'une sortie donnée soit correcte. Une
ligne affichant un score élevé ne garantit en rien la phrase suivante produite par une méthode.

L'erreur inverse est plus facile à commettre, et elle nous engage également. Lorsqu'une interface indique ici
qu'aucune méthode sur une paire n'obtient un score suffisant pour être déployée — comme le fait la page
[services de traduction humaine](/human-services) —, il s'agit d'un constat concernant des
méthodes mesurées sur des jeux de test mesurés. C'est une bonne raison de ne pas livrer de sorties
automatiques pour cette paire. Ce n'est pas un verdict sur une phrase en particulier.

**L'estimation de la qualité est un emplacement ouvert, non une lacune dissimulée.** Le banc d'évaluation
calcule déjà un score neuronal sans référence, AfriCOMET-QE (`qe_score`), comme signal
d'adéquation pour les exécutions sans référence étalon. Il est rapporté sous forme de valeur
**au niveau du corpus** dans la voie neuronale distincte, est recalculé par le
vérificateur et n'entre jamais dans le score chrF++ principal
([Spécification de l'évaluation](/docs/network/specifications/scoring#how-runs-are-scored)). Les métriques sont
des greffons ([Spécification des plugins](/docs/reference/plugin-spec)), de sorte qu'une métrique d'estimation de la qualité au niveau du segment est une fonctionnalité que ce banc d'évaluation peut intégrer. Tant qu'aucune métrique de ce type n'est connectée,
publiée et méta-évaluée par langue de la même manière que le sont les métriques basées sur des références
([Fiabilité des métriques](/docs/network/specifications/metric-reliability)), nous
ne nous prononçons aucunement sur les sorties individuelles.

---

Ces limites évolueront avec le travail. Quand l'une d'elles change, cette page
change avec elle — et le changement devrait être visible dans l'historique de la
page, pas discrètement supprimé.
