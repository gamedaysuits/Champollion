---
sidebar_position: 0
title: "Soumettre à l'Index"
description: "Proposez un jeu de données, une ressource, une méthode, un service de traduction humaine ou un résultat externe — ou suggérez une correction pour une fiche linguistique. Chaque soumission fait l’objet d’un examen humain afin de vérifier sa conformité en matière de propriété intellectuelle, de licence et de souveraineté — rien n’est approuvé automatiquement."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# Soumettre à l'Index

> **Résumé exécutif.** Proposez quelque chose pour l'index Champollion — un benchmark, une ressource, une méthode de traduction, un service de traduction humaine, ou un résultat publié externe. Vous remplissez un formulaire structuré court (dans votre navigateur ou depuis la CLI) ; un **responsable examine chaque soumission à la main** pour la propriété intellectuelle, la licence et la conformité communautaire/souveraineté avant que quoi que ce soit soit ajouté. **Rien n'est approuvé automatiquement.**

L'index est la carte partagée : les ensembles de données sur lesquels les méthodes sont évaluées, les dictionnaires et outils qui aident, les méthodes elles-mêmes, les personnes qui traduisent à la main, et les résultats que d'autres ont publiés. N'importe qui peut proposer un ajout. Parce que c'est une infrastructure pour les communautés linguistiques, chaque proposition passe d'abord par une porte d'examen humain.

---

## Ce que vous pouvez soumettre

| Type | Description | Ce que nous ajoutons |
|---|---|---|
| **Benchmark / jeu de données** | Un corpus d'évaluation ou un benchmark | Une fiche de métadonnées + un pointeur *fetch-from-source* — jamais le contenu du corpus |
| **Ressource** | Un dictionnaire, une archive, une application, un FST (analyseur morphologique) ou un outil | Une entrée avec un pointeur + le niveau d'accès (ouvert / restreint / consentement requis) |
| **Méthode de traduction** | Un moteur de TA, un fournisseur de LLM ou un pipeline | Une entrée dans le registre des méthodes afin de pouvoir l'exécuter et l'évaluer |
| **Service de traduction humaine** | Un bureau communautaire volontaire, une agence ou un traducteur individuel | Une entrée par paire de langues (les coordonnées restent hors bande — jamais dans l'issue publique) |
| **Résultat externe publié** | Un score rapporté par un autre système ou article | Une **citation** — les résultats externes sont cités, jamais réhébergés ni reclassés comme notre propre mesure |
| **Correction d'une fiche de langue** | Un élément d'une [fiche de langue](/catalogue) est erroné, obsolète ou manquant — une estimation de locuteurs, un statut, un système d'écriture, une ressource non listée | Une **correction avec citation appliquée à la source de données** (les fiches étant générées, la correction est pérenne) ; lorsque les sources divergent, la fiche les affiche toutes, avec attribution |

Chaque fiche de langue comporte également un lien **« Suggérer une correction ou un ajout »**
qui ouvre le formulaire de correction avec la langue préremplie.

**Demandes de retrait et de restriction émanant des communautés.** Si vous êtes membre
ou autorité d'une communauté et souhaitez que les données relatives à votre langue soient restreintes ou retirées, utilisez le
formulaire de correction (ou contactez le mainteneur hors bande si vous préférez que cela ne soit pas
public). Ces demandes sont traitées en priorité dans le cadre de l'[examen de souveraineté](/docs/network/sovereignty/data-sovereignty) — aucune citation n'est requise.

---

## Comment fonctionne l'examen

C'est la partie importante : **les soumissions sont examinées par un humain, pas un robot.** Quand vous soumettez, vous ouvrez un problème GitHub. Ce problème est la file d'attente d'examen. Un responsable le lit et le vérifie par rapport aux règles du projet avant d'ajouter quoi que ce soit :

- **Propriété intellectuelle et licence.** Nous devons avoir l'autorisation de répertorier la ressource. Le contenu à usage non commercial, interdit à la redistribution ou dont la licence n'est pas claire peut toujours être *catalogué*, mais il est exclu de toute filière commerciale, de prix ou de récupération publique.
- **Communauté et souveraineté.** Les données relatives aux langues autochtones et communautaires ne sont répertoriées qu'avec le consentement de la communauté. Un fournisseur ou un responsable n'est jamais nommé publiquement avant d'avoir confirmé son accord.
- **Nous n'hébergeons jamais le contenu des corpus.** Les jeux de données sont répertoriés sous forme de métadonnées accompagnées d'un pointeur vers l'emplacement d'où les données sont récupérées. **Ne collez pas de phrases sources ou de référence dans une soumission.**
- **Aucune donnée personnelle.** Aucun e-mail, numéro de téléphone ou autre information personnelle identifiable (PII) dans une issue publique. Pour les services de traduction humaine, les coordonnées sont fournies au mainteneur hors bande.
- **Périmètre.** Les corpus bibliques ou liturgiques et autres corpus issus de l'imposition coloniale sont hors périmètre et seront refusés.

Chaque formulaire se termine par une attestation obligatoire :

> *« Je confirme que ceci est publiquement listable, ne contient PAS de contenu de corpus ou de données personnelles, et respecte la licence de la source et toute restriction communautaire/souveraineté. »*

---

## Deux façons de soumettre

### Depuis votre navigateur

Ouvrez le sélecteur de problème et choisissez le formulaire qui correspond à ce que vous soumettez :

➡️ **[Ouvrir un formulaire de soumission sur GitHub](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Chaque formulaire ne demande que ce dont l'index correspondant a besoin (nom, langues/paires, licence, URL source, etc.) et la case à cocher d'attestation.

### Depuis la CLI

Si vous avez la [CLI Champollion](/docs/network/getting-started/submit-a-method), `champollion submit` rassemble les champs et vous remet une version **pré-remplie** du même formulaire GitHub :

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

La CLI affiche une URL — ouvrez-la, vérifiez l'attestation dans le navigateur, et soumettez. Ajoutez `--out submission.json` pour également enregistrer une copie locale, sans contenu, de ce que vous proposez. La CLI ne télécharge jamais rien elle-même et n'écrit jamais dans l'index.

---

## Ce qui se passe après votre soumission

1. Votre soumission arrive sous forme de problème GitHub — la file d'attente d'examen.
2. Un responsable l'examine par rapport aux règles de propriété intellectuelle / licence / souveraineté ci-dessus.
3. **Si acceptée :** le responsable ajoute l'entrée à la source de vérité pertinente (le registre des ensembles de données, une fiche, le registre des méthodes ou services humains, ou le catalogue des résultats externes) via une modification normale, et étiquette le problème **accepté**.
4. **Si elle ne peut pas être listée telle quelle :** le responsable l'étiquette **refusée** (ou demande plus d'informations) avec la raison.

Il n'y a pas de fusion automatique et pas de publication automatique. Une personne prend la décision à chaque fois.

---

## Voir aussi

- [Soumettre une Méthode](/docs/network/getting-started/submit-a-method) — vous avez déjà une exécution de benchmark ? Publiez la fiche d'exécution directement.
- [Enregistrement des Corpus](/docs/network/sovereignty/registering-corpora) — niveaux d'exposition (local / privé / public / scellé) pour les corpus que vous possédez.
- [Souveraineté des Données](/docs/network/sovereignty/data-sovereignty) — comment le contrôle communautaire des données linguistiques fonctionne ici.
- [Pour les Communautés Linguistiques](/docs/network/community/for-language-communities) — partenariat, consentement, et garde des clés.
