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

## 1. La validation morphologique approfondie couvre actuellement une seule paire

La validation morphologique basée sur FST — vérifier que chaque mot de sortie est
un mot bien formé dans la langue cible — est en pratique configurée pour
**l'anglais → le cri des Plaines uniquement**. Le `GiellaLTFSTMetric` lui-même est
**générique** : il évalue toute langue disposant d'un analyseur GiellaLT
`.hfstol` publié (le cri des Plaines, les langues sámi, le finnois, le
norvégien bokmål, l'inuktitut et d'autres), de sorte que la capacité est large.
Mais **les corpus d'évaluation n'existent aujourd'hui que pour le cri des
Plaines**, donc crk est la seule paire qui est évaluée par FST en pratique.
Toutes les autres paires du classement sont évaluées avec des métriques de
surface (chrF++, BLEU) et des vérifications comportementales. Ce sont des signaux
utiles, mais ils ne **garantissent pas** la validité morphologique. Nous ne
revendiquons pas la validation morphologique pour une langue sans à la fois un
FST et un corpus d'évaluation.

## 2. Les niveaux de confiance sont auto-déclarés au lancement

La plupart des scores sont calculés par des contributeurs exécutant eux-mêmes
l'infrastructure et publiant le résultat. La **vérification** côté serveur —
réévaluer une soumission par rapport au corpus canonique épinglé par SHA — existe
et s'étend, mais « vérifié » n'est pas encore universel. Lisez le badge de
confiance sur chaque ligne : **« auto-déclaré signifie exactement cela »**, et
c'est la valeur par défaut.

## 3. La validation par des locuteurs de la communauté n'a pas encore eu lieu

Notre prix exige **≥ 70 % d'acceptation de la part de locuteurs bilingues**. Cette
condition est spécifiée, et l'outillage pour l'exécuter est en construction —
mais **aucun examen par des locuteurs de la communauté n'a été mené**, et **aucun
score sur ce site n'a franchi la barrière des locuteurs**. Les nombres composites
et chrF++ sont des signaux informatiques, pas un verdict communautaire.

## 4. Le bac à sable d'évaluation existe ; sa cérémonie de garde n'existe pas encore

Nous récupérons les corpus depuis leur source et les épinglons par SHA, et les partitions réservées (held-out splits) sont scellées. Lorsqu'une communauté détient un jeu de test secret, une méthode peut être évaluée sur celui-ci sans que le jeu ne quitte jamais ses mains — et cette évaluation dispose désormais de **deux voies**. La voie privilégiée, pour les modèles neuronaux standards, est **déclarative** : le participant soumet uniquement des données — des poids safetensors + un tokenizer déclaratif + une configuration — et l'organisateur l'exécute dans son propre moteur d'inférence de confiance (`trust_remote_code=False`, hors ligne ; permissif quant à l'architecture car la sécurité réside dans le format sans code, et non dans le nom de l'architecture). Aucun code du participant n'est exécuté, il n'y a donc rien à isoler (sandbox) ; la vérification de sécurité est une validation de format décidable (s'agit-il de safetensors et non d'un pickle ? aucun `trust_remote_code` ?), et non une tentative de prouver la sécurité d'un code arbitraire. Pour les méthodes qui constituent véritablement du code (pipelines, hybrides assistés par LLM), la solution de repli est la **sandbox** isolée du réseau (vérifications statiques, conteneurs `--network=none`, sortie limitée aux seuls scores, transport de fichiers optionnel avec véritable isolation physique / airgap). La sandbox confine le code non fiable au lieu de refuser de l'exécuter, il s'agit donc en toute honnêteté de la voie la plus faible — sa garantie fondamentale est `--network=none` (une analyse statique heuristique ne peut pas valider un modèle binaire), et un durcissement plus poussé (seccomp, microVMs) est différé. Consultez [organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) pour savoir exactement ce qui est actif et ce qui ne l'est pas. Ce qui n'est **pas** développé dans les deux cas : l'aspect de la conservation des clés par la communauté — signature à seuil, cérémonies de clés et attestation des nœuds. L'autorisation actuelle repose sur un processus documenté (gardiens uniques, clés uniques, étiquetage honnête), de sorte que l'évaluation de **prix** de référence reste fermée jusqu'à ce que le travail de conservation et le consentement de la communauté soient à niveau.

## 5. La garde des clés est décidée ; les gardiens communautaires sont en confirmation

Le *mécanisme* de garde est décidé : un schéma de seuil/multisig dans lequel
**Champollion ne détient aucune part de clé**. Les gardiens eux-mêmes sont
choisis par les communautés, et ces conversations sont en cours — donc nous
disons **« gardiens de clés communautaires (en confirmation) »**. La garde n'est
pas le consentement : le processus relationnel de consentement communautaire est le sien, plus lent, et
plus important.

---

Ces limites évolueront avec le travail. Quand l'une d'elles change, cette page
change avec elle — et le changement devrait être visible dans l'historique de la
page, pas discrètement supprimé.

