---
sidebar_position: 1
slug: /intro
title: "Traduction d'applications et de sites"
description: "La référence pour traduire les propres fichiers d'une application ou d'un site web avec `champollion sync` : son fonctionnement, quand l'utiliser et un guide de chaque page qui lui est consacrée."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# Traduction d'applications et de sites

`champollion sync` maintient les traductions d'une application ou d'un site web en phase
avec sa langue source. Il lit vos fichiers de paramètres régionaux (ou vos pages Markdown),
identifie ce qui est manquant ou obsolète, traduit uniquement ces éléments, vérifie chaque
résultat et le réécrit dans le format propre au fichier.

```bash
npx champollion sync
```

Cette section constitue la référence pour ce volet. Si vous préférez d'abord
consulter la version simplifiée, lisez [Traduire une application ou un site web](/docs/translate-an-app-or-website).

## Ce que fait `sync`

1. **Localise vos fichiers.** Il détecte le dossier de paramètres régionaux et son format
   (JSON, TOML, YAML, gettext PO, Flutter ARB), ou un dossier de pages Markdown/MDX (Hugo,
   Docusaurus, ou tout dossier désigné avec `--content-dir`).
2. **Détermine ce qui a changé.** Chaque valeur source est consignée sous la forme de
   son empreinte SHA-256 dans `.champollion.lock`. Les clés manquantes, vides ou dont le texte source
   a changé sont mises en file d'attente ; tout le reste est laissé intact.
3. **Traduit selon la méthode choisie pour chaque paire.** Un unique fichier de configuration
   peut confier une paire à un LLM, une autre à une API de traduction automatique et une troisième
   à un modèle que vous avez entraîné et hébergez vous-même. Les méthodes fondées sur un LLM traduisent
   par défaut à une température de 0 (la seule valeur par défaut de `shared/model-defaults.json`) ; un modèle hébergé
   peut néanmoins varier légèrement d'une exécution à l'autre, ce qui explique en partie pourquoi
   la mémoire de traduction conserve ce qu'elle a déjà obtenu.
4. **Réutilise ce qui a déjà été produit.** La mémoire de traduction met en cache chaque
   traduction selon le texte source, les paramètres régionaux et la méthode : tout texte récurrent
   (une chaîne rétablie, la même phrase dans un autre fichier, une réexécution) ne génère aucun coût.
5. **Vérifie chaque résultat avant son écriture.** La barrière de qualité refuse les sorties vides,
   les copies à l'identique de la source, les boucles de répétition, les écritures dans un système d'écriture
   inapproprié, les balises de substitution altérées et toute anomalie semblable, en accordant une tentative
   supplémentaire avec retour d'information. Elle intercepte les résultats corrompus, non les contresens.
6. **Vérifie après l'écriture.** Une phase postérieure à la synchronisation relit les fichiers écrits et
   contrôle la parité des clés, les valeurs vides, le système d'écriture et les balises de substitution ;
   `champollion verify` et `champollion audit` exécutent le même genre de vérifications sous forme de barrières de CI.

Rien n'est écrit de manière silencieuse. Une clé que la barrière de contrôle refuse toujours
après sa nouvelle tentative demeure non traduite et fait l'objet d'un rapport, et la synchronisation
se termine par `2`. Ce refus est conservé en mémoire afin qu'une synchronisation ordinaire
ultérieure ne rémunère pas le même modèle pour obtenir la même réponse : vous pouvez renouveler
la demande avec `--redo`, associer une méthode `fallback` à la paire, ou rédiger la valeur manuellement.

## Quand l'utiliser

- Vous disposez d'une application ou d'un site web dont les textes se trouvent dans des fichiers
  de paramètres régionaux ou en Markdown, et vous souhaitez maintenir ses autres langues à jour
  au fil de l'évolution de la source.
- Vous souhaitez employer une méthode différente par paire de langues au sein d'un même projet,
  avec des dépenses plafonnées (`--max-cost`) et visibles avant toute facturation (`--dry`).
- Vous avez développé un traducteur sur le socle et souhaitez l'exploiter dans une application :
  `champollion connect` intègre un modèle hébergé dans un projet d'application, puis `sync`
  traduit à l'aide de celui-ci. Un modèle entraîné sur des données strictement locales n'est
  connecté qu'avec le consentement de ses détenteurs.

`sync` n'est pas le moyen de concevoir un traducteur pour une langue qu'aucun
service ne traite convenablement. Pour cette démarche, commencez par [Démarrer un projet](/docs/start).

## Les pages de cette section

**Pour commencer**

- [Démarrage rapide](/docs/getting-started/quick-start) — une première synchronisation en quelques minutes.
- [Installation](/docs/getting-started/installation) — prérequis, clés d'API et licence.
- [Configuration](/docs/getting-started/configuration) — chaque champ de `champollion.config.json`,
  paramètres par paire, agencements des paramètres régionaux et solutions de repli.

**Votre framework et votre pipeline**

- [Intégrations de frameworks](/docs/integrations/frameworks) — Hugo, next-intl,
  react-i18next, Flutter et Django avec gettext.
- [CI/CD](/docs/guides/ci-cd) — `lint`, `sync`, `verify` et `audit` en guise de barrières de contrôle.
- [Traduction de contenus](/docs/guides/content-translation) — pages Markdown et MDX,
  front matter et éléments préservés.

**Choisir la méthode de traduction**

- [Méthodes de traduction](/docs/guides/translation-methods) — chaque méthode,
  sa clé et quand y recourir.
- [Données d'accompagnement](/docs/concepts/coaching-data) — notes de grammaire et listes de termes
  fournies à un LLM lors de chaque requête.
- [Convertisseurs d'écriture](/docs/concepts/script-converters) et
  [Idiolangues, écritures et orthographe](/docs/guides/conlangs-scripts-orthography)
  — systèmes d'écriture, polices et langues construites.

**Fonctionnement interne**

- [Fonctionnement de la synchronisation](/docs/concepts/how-sync-works) — le pipeline, étape par étape.
- [Mémoire de traduction](/docs/concepts/translation-memory) — le cache et ses critères d'indexation.
- [Barrière de qualité](/docs/concepts/quality-gate) — chaque vérification et le sort réservé
  à une clé ou un bloc rejeté.
- [Sécurité](/docs/concepts/security) — clés et chemins forgés, blocs de code protégés
  et signalement explicite des erreurs.

**Intervenants et difficultés**

- [Collaborer avec des traducteurs professionnels](/docs/guides/professional-translators)
  — export et import XLIFF pour révision.
- [Dépannage](/docs/guides/troubleshooting) — erreurs courantes et résolutions.

L'ensemble des commandes et options se trouve dans la [Référence du CLI](/docs/reference/cli), et le
format des greffons de méthode est décrit dans la [Spécification des greffons](/docs/reference/plugin-spec).

## Licence

Le CLI `champollion` est disponible avec accès au code source sous la
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) ;
la page [Qui peut l'utiliser](/docs/getting-started/who-may-use-this) précise qui est couvert.
Vous rencontrez des difficultés ou souhaitez de l'aide pour votre projet ? [Contactez-nous](/docs/getting-help).
