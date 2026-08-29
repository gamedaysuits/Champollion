---
sidebar_position: 3
title: "Contrôle de qualité"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Portail de Qualité

Chaque traduction passe par un portail de validation déterministe avant d'être écrite sur le disque. Le portail de qualité détecte les modes de défaillance courants de la traduction automatique — pas de replis silencieux, pas de contenu indésirable écrit dans vos fichiers de locale.

## Contrôles de Validation

| Vérification | Ce qu'elle détecte | Étiquette du portail |
|-------|----------------|-----------|
| **Vide/blanc** | Le modèle a renvoyé une chaîne vide ou des espaces | `[GATE] empty` |
| **Écho de la source** | Le modèle a renvoyé l'entrée originale en anglais | `[GATE] source-echo` |
| **Boucle d'hallucination** | Motifs de trigrammes répétés (par ex., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Inflation de la longueur** | La sortie est significativement plus longue que la source | `[GATE] length` |
| **Suppression de contenu** | La sortie est la source dont les lettres ont été retirées | `[GATE] content` |
| **Conformité du script** | Mauvais système d'écriture pour la locale cible | `[GATE] script` |
| **Catégories de pluriel ICU** | Formes plurielles requises manquantes pour la locale | `[GATE] icu-plural` |

Les clés déclarées [`noTranslate`](/docs/getting-started/configuration#no-translate) n'atteignent jamais le portail — elles sont copiées de la source textuellement, il n'y a donc rien à valider.

### Vide/Blanc

Rejette les traductions qui sont des chaînes vides, contiennent uniquement des espaces blancs, ou `null`. Cela détecte les modèles qui ne retournent rien pour les clés difficiles.

### Écho Source

Détecte quand le modèle retourne le texte source anglais au lieu de le traduire. Courant avec les chaînes courtes et les invites sous-spécifiées.

Les chaînes courtes composées principalement de caractères ASCII (≤ 30 caractères) sont exemptées — `"Blog"`, `"GitHub"`, `"npm"` restent légitimement en anglais partout, et les rejeter provoquerait une boucle infinie.

Les valeurs plus longues qui sont également correctes sans modification — URL, chemins de dépôt, identifiants de produits — ne constituent pas un problème lié au portail et ne peuvent pas être corrigées en ajustant ce dernier : la bonne réponse *est* l'écho, donc toute sortie possible du modèle est fausse. Déclarez ces clés avec [`noTranslate`](/docs/getting-started/configuration#no-translate) et elles contourneront entièrement le pipeline. Les clés dont la valeur est une URL sont traitées de cette manière par défaut.

### Boucle d'Hallucination

Analyse les motifs de trigrammes (3 caractères) dans la sortie. Si un trigramme se répète plus qu'un seuil donné par rapport à la longueur de la sortie, la traduction est rejetée. Cela détecte les sorties dégénérées comme `"Qo' Qo' Qo' Qo' Qo'"`.

### Inflation de Longueur

Rejette les traductions où la longueur de la sortie dépasse `maxLengthRatio × source length` (par défaut : 4×). Cela détecte les hallucinations de modèle qui produisent des murs de texte pour une courte entrée.

Configurable via `maxLengthRatio` dans votre configuration.

### Suppression de contenu

Le pendant de l'inflation de la longueur. Un modèle ne disposant d'aucun vocabulaire pour une chaîne peut supprimer chaque lettre qu'il ne peut pas traduire et laisser intacts la ponctuation et les espacements de la source :

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Rien d'autre ne détecte cela. Ce n'est ni vide, ni un écho, ni répétitif, et à 33 % de la *longueur* de la source, cela passe confortablement `minLengthRatio`.

La vérification compare les **caractères de contenu** — lettres et chiffres, en ignorant la ponctuation, les espaces et le formatage invisible — entre la source et la sortie. Mais la densité seule ne peut pas être la règle, car les scripts denses légitimes se situent exactement au même niveau :

| Source | Sortie | Contenu conservé | Verdict |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **rejeté** |
| `Getting started` | `入门` | 14% | accepté |
| `Frequently asked questions` | `常见问题` | 17% | accepté |

Tout seuil qui détecte le premier rejette d'emblée le chinois, le japonais et le coréen. Ce qui les sépare n'est pas la quantité qui a survécu, mais *d'où elle provient* : la sortie évidée est une **sous-séquence** de sa propre source — qui peut être produite en y supprimant des caractères — tandis qu'une véritable traduction ne partage essentiellement rien avec la source. Un signalement nécessite **les deux** signaux, la vérification est donc nécessaire mais non suffisante, de la même manière que l'est le détecteur de répétition.

Configurable via `minContentRetention` (par défaut `0.35`), par paire ou par langue. L'augmenter rend la vérification plus sensible ; elle ne se déclenche qu'en conjonction avec le signal de sous-séquence.

:::note[Il s'agit d'un signal de vocabulaire, pas d'un curseur de qualité]
Lorsque cela se déclenche de manière répétée pour une langue cible, le modèle n'a pas de mots pour ce texte — généralement des chaînes courtes et denses en jargon dans une langue au lexique fermé. Assouplir le seuil restaure la corruption silencieuse ; cela ne produit pas une traduction. Corrigez le prompt, les données d'entraînement ou la paire.
:::

### Conformité du Script

Pour les locales dont la fiche de langue indique un script non latin (arabe, CJK, cyrillique, …), valide que la sortie contient effectivement des caractères non ASCII — une sortie uniquement latine pour ces locales est rejetée pour cause de script incorrect.

Deux précisions sur ce que cette vérification n'est *pas* :

- Elle n'est **pas pilotée par le champ de configuration `script:`.** Ce champ sélectionne l'orthographe de sortie pour la [conversion de script](/docs/getting-started/configuration#script-conversion) ; l'attente du portail provient des fiches de langue.
- Elle valide toujours le **script de travail émis par le modèle**, *avant* toute conversion de script. Les locales disposant d'un convertisseur de script (crk, sr, tlh, …) produisent correctement une sortie en script de travail latin, elles sont donc exemptées de cette vérification ; la conversion — si la configuration l'active — se produit après le portail.

## Ce qui se passe en cas d'Échec

1. La traduction défaillante est enregistrée sur stderr avec un préfixe `[GATE]`, le nom de la clé, la raison, et un aperçu de la valeur
2. La clé n'est **pas** écrite dans le fichier de locale
3. La cascade de nouvelle tentative s'active (voir ci-dessous)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Nouvelle tentative avec feedback et cascade de nouvelles tentatives

Une clé rejetée par le portail bénéficie d'**une nouvelle tentative avec feedback** : la raison du rejet est injectée dans le prompt en tant que contexte spécifique à la clé (une nouvelle tentative à l'aveugle à basse température renverrait une sortie identique à l'octet près). Si la nouvelle tentative réussit, la clé est écrite et la synchronisation est **au vert** — un rejet du portail qui s'auto-corrige n'est pas un échec, et c'est la sémantique prévue. Seules les clés qui échouent encore après la nouvelle tentative sont ignorées, signalées (la synchronisation se termine avec un code non nul) et réessayées lors de la synchronisation suivante.

La nouvelle tentative passe par la méthode de traduction propre à la paire, quelle qu'elle soit — LLM, Google Translate, DeepL ou un fournisseur direct. Cela s'applique également aux correspondances de la mémoire de traduction : une valeur en cache que le portail rejette est expulsée et retraduite lors de la même exécution, de sorte qu'un cache empoisonné s'auto-corrige.

Séparément, lorsqu'un lot entier échoue (erreur d'analyse JSON), Champollion effectue de nouvelles tentatives avec des lots de plus en plus petits :

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Le budget de nouvelle tentative est plafonné par `maxRetries` (par défaut : 3, configurable par langue). Cela prévient les dépenses de jetons incontrôlées sur les clés qui échouent régulièrement.

Après épuisement des tentatives, les clés problématiques sont enregistrées et ignorées. Elles seront réessayées lors de la prochaine exécution `sync`.

## Mise en Cache des Invites

Le message système (registre, règles de grammaire, notes de style) est séparé du message utilisateur (les clés à traduire). Cette séparation est intentionnelle :

- Le message système est **identique entre les lots** pour une locale donnée
- Les fournisseurs comme Anthropic et Google mettent en cache les messages système répétés
- Résultat : le premier lot paie le coût complet des jetons, les lots suivants ne paient que pour le message utilisateur

Cela peut réduire considérablement les coûts en jetons pour les projets avec de nombreux lots.

## Validation du Format de Message ICU

La commande `integrity` valide les motifs pluriels du Format de Message ICU par rapport aux règles plurielles CLDR. Si votre fichier source utilise la syntaxe ICU comme :

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion vérifie que les versions traduites incluent toutes les catégories plurielles requises pour la locale cible. Par exemple, l'arabe nécessite six catégories (`zero`, `one`, `two`, `few`, `many`, `other`) — pas seulement `one` et `other`.

Exécutez `champollion integrity` pour vérifier l'exhaustivité des pluriels dans toutes les locales.

## Application de la Terminologie

Pour les paires coachées avec un dictionnaire, champollion exécute une vérification de terminologie post-traduction. Après que le portail de qualité soit passé, il vérifie si le LLM a réellement utilisé les termes de dictionnaire requis.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Les violations de terminologie sont des **avertissements, pas des erreurs bloquantes**. La traduction est toujours écrite sur le disque. C'est intentionnel — le LLM peut avoir des raisons valables de choisir une alternative (contexte, grammaire), et bloquer sur les non-concordances de termes causerait plus de mal que de bien.

Pour corriger les violations, mettez à jour le dictionnaire de coaching ou modifiez manuellement le fichier de locale.

---

## Voir aussi

- [Comment fonctionne la Synchronisation](/docs/concepts/how-sync-works) — où le portail de qualité s'inscrit dans le pipeline
- [Méthodes de Traduction](/docs/guides/translation-methods) — méthodes qui alimentent le portail
- [Convertisseurs de Script](/docs/concepts/script-converters) — conversion de script post-portail
- [Données de Coaching](/docs/concepts/coaching-data) — amélioration de la qualité de traduction en amont
- [Mémoire de Traduction](/docs/concepts/translation-memory) — mise en cache des traductions validées
- [Référence CLI — sync](/docs/reference/cli#sync) — drapeaux de synchronisation incluant le comportement de nouvelle tentative
- [Référence CLI — integrity](/docs/reference/cli#integrity) — audit pluriel ICU
