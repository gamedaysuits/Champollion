---
sidebar_position: 7
title: "Comparaison"
---

# Comment Champollion se compare

champollion occupe une catégorie différente de celle de la plupart des outils de localisation. Voici une comparaison honnête.

## Le paysage

La plupart des outils de localisation se répartissent en trois catégories :

| Catégorie | Exemples | Modèle |
|----------|----------|-------|
| **Plateformes TMS cloud** | Crowdin, Phrase, Locize, Tolgee | Tableau de bord SaaS + traducteurs humains + abonnement mensuel |
| **Outils d'extraction de clés** | i18next-scanner, FormatJS CLI | Analyse le code source pour les appels de fonction de traduction |
| **Moteurs de traduction CLI** | **champollion** | Exécution dans votre projet, traduction directe des fichiers, pas de compte cloud |

Champollion est un **moteur de traduction CLI** — il traduit directement vos fichiers de locale en utilisant des backends configurables (LLM, Google Translate, plugins personnalisés). Pas de tableau de bord cloud, pas de flux de travail de traducteur humain, pas de frais mensuels.

---

## Comparaison des fonctionnalités

| Fonctionnalité | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **Exécution locale (sans compte cloud)** | ✅ | ❌ | ❌ | ❌ |
| **Dépendances minimales** | ✅ | ❌ | ❌ | ❌ |
| **Configuration de la méthode par paire** | ✅ | ❌ | ❌ | ❌ |
| **Registres de langue personnalisés** | ✅ | ❌ | ❌ | ❌ |
| **Sensible au contenu (protège les blocs de code)** | ✅ | ❌ | ❌ | ❌ |
| **Langues construites et conversion d'écriture** | ✅ | ❌ | ❌ | ❌ |
| **Architecture de plugins** | ✅ | ❌ | ❌ | ❌ |
| **Traduction de Markdown / contenu** | ✅ | ✅ | ✅ | ❌ |
| **Mémoire de traduction** | ✅ | ✅ | ✅ | ✅ |
| **Export/import XLIFF** | ✅ | ✅ | ✅ | ❌ |
| **Validation des pluriels ICU** | ✅ | ✅ | ✅ | ❌ |
| **Respect de la terminologie** | ✅ | ✅ | ✅ | ❌ |
| **Flux de travail pour traducteurs humains** | Basé sur XLIFF | ✅ | ✅ | ✅ |
| **Édition en contexte (visuelle)** | ❌ | ✅ | ✅ | ✅ |
| **Collaboration en équipe** | ❌ | ✅ | ✅ | ✅ |
| **Formats de fichiers pris en charge** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **Tarification** | Gratuit pour un usage non commercial (vous payez votre LLM) | À partir de 0 $/mois | À partir de 0 $/mois | À partir de 0 $/mois |

---

## Quand utiliser Champollion

**Champollion est un bon choix quand :**

- Vous voulez intégrer la traduction automatique dans votre pipeline de compilation — et non dans un flux de travail séparé
- Vous avez besoin d'un contrôle de méthode par langue (LLM pour certaines, Google Translate pour d'autres, plugins personnalisés pour le reste)
- Vous traduisez vers des langues sans couverture API (autochtones, en danger, construites)
- Vous voulez une sortie de script déterministe (Syllabaires du Cree, pIqaD Klingon, Tengwar)
- Vous voulez zéro verrouillage fournisseur et zéro dépendances cloud
- Vous êtes un développeur solo ou une petite équipe qui n'a pas besoin d'un tableau de bord TMS complet
- Vous voulez un transfert basé sur XLIFF aux traducteurs professionnels sans abonnement cloud

**Un TMS cloud est un meilleur choix quand :**

- Vous avez des traducteurs humains professionnels qui examinent chaque chaîne (le flux de travail XLIFF de champollion est plus simple qu'un TMS complet)
- Vous avez besoin d'une mémoire de traduction et d'une gestion de glossaire inter-projets
- Vous avez besoin d'une édition visuelle en contexte (aperçu des traductions dans votre interface utilisateur)
- Vous avez une grande équipe avec des besoins de contrôle d'accès basés sur les rôles
- Vous avez besoin du support de 50+ formats de fichier

---

## Ce que Champollion fait que personne d'autre ne fait

### 1. Registres personnalisés

Chaque paire de langues reçoit des instructions de ton culturellement appropriées pour le LLM :

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

Aucun autre outil ne propose 47 registres de langue préconfigurés, ou ne vous permet d'en définir des personnalisés par projet.

### 2. Convertisseurs de script déterministes

Champollion est livré avec cinq convertisseurs de script intégrés qui s'exécutent en tant que crochets post-traduction — aucun LLM nécessaire :

| Locale | Conversion | Exemple |
|--------|-----------|---------|
| `crk` | SRO → Syllabaires du Cree | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latin → Cyrillique | `Beograd` → `Београд` |
| `tlh` | Romanisation → pIqaD | `tlhIngan Hol` → (glyphes pIqaD) |
| `x-elvish-s` | Latin → Tengwar | Sindarin → Tengwar (Mode de Beleriand) |
| `x-kryptonian` | Latin → Kryptonien | Substitution de chiffre (nécessite une police) |

Ce sont des convertisseurs de table de consultation pure — déterministes, vérifiables, zéro risque d'hallucination LLM.

### 3. Protection sensible au contenu

Lors de la traduction de Markdown ou de contenu riche, Champollion protège :

- Les blocs de code délimités (` ``` `)
- Le code en ligne (`` ` ` ``)
- Les shortcodes Hugo (`{{</* */>}}`, `{{%/* */%}}`)
- Les variables d'interpolation (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Les blocs HTML bruts

Ceux-ci sont remplacés par des jetons sentinelles Unicode avant la traduction et restaurés après. Le LLM ne voit jamais votre code, vos shortcodes ou vos variables.

### 4. Plugins de méthode coachée

Pour les langues sans couverture API, vous pouvez créer une méthode de traduction coachée :

1. Écrivez des données de coaching linguistique (règles de grammaire, vocabulaire, exemples)
2. Regroupez-les en tant que plugin
3. Comparez-les par rapport aux traductions de référence en utilisant le [harnais d'évaluation](https://github.com/gamedaysuits/Champollion)
4. Installez-le dans votre projet avec `champollion plugin install`

C'est ainsi que champollion gère le Cree des Plaines — et comment vous pouvez gérer n'importe quelle langue, y compris celles qui n'existent pas encore.

---

## Le résumé

Champollion n'est pas un remplacement pour Crowdin. C'est un outil différent pour un flux de travail différent. Si vous avez besoin de traducteurs humains, utilisez un TMS. Si vous avez besoin d'une CLI qui traduit vos fichiers en une seule commande et vous donne un contrôle par langue sur les méthodes, les modèles et les registres — utilisez champollion.
