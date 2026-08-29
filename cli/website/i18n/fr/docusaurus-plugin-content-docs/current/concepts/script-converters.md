---
sidebar_position: 6
title: "Convertisseurs de script"
---

# Convertisseurs de Script

Les convertisseurs de script sont des crochets de post-traduction déterministes et sans LLM qui convertissent le texte d'un système d'écriture à un autre. Ils permettent un flux de travail « traduire une fois, afficher dans plusieurs scripts » — vous traduisez dans un script de travail (généralement Latin), puis convertissez automatiquement au script d'affichage.

## Pourquoi les Convertisseurs de Script ?

Certaines langues utilisent plusieurs scripts pour la même langue parlée :

- **Plains Cree** : SRO (Latin) pour l'édition → Syllabiques Cree (ᓀᐦᐃᔭᐍᐏᐣ) pour l'affichage
- **Serbe** : Latin pour l'usage international → Cyrillique pour l'usage domestique
- **Klingon** : Romanisation pour la saisie → pIqaD (  ) pour l'affichage

Traduire directement dans des scripts non-Latin crée des problèmes : les LLM hallucinent des caractères, les fichiers JSON deviennent difficiles à contrôler en version, et les outils de diff ne peuvent pas comparer les modifications. Les convertisseurs de script résolvent ce problème en conservant les traductions dans un script compatible avec le contrôle de version et en convertissant de manière déterministe au moment de la synchronisation.

## Convertisseurs Disponibles

Champollion est livré avec cinq convertisseurs de script intégrés :

| Locale | De | À | Type | Police Requise ? |
|--------|------|----|------|----------------|
| `crk` | SRO (Standard Roman Orthography) | Syllabiques Cree | Déterministe | Non — Unicode natif |
| `sr` | Latin | Cyrillique | Déterministe | Non — Unicode natif |
| `tlh` | Romanisation | pIqaD | Déterministe | Oui — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latin | Tengwar (Mode de Beleriand) | Déterministe | Oui — PUA U+E000–E07F |
| `x-kryptonian` | Latin | Kryptonian | Chiffre basé sur police | Oui — PUA U+E100–E119 |

### Déterministe vs. Basé sur Police

- **Les convertisseurs déterministes** (Cree, Serbe, Klingon, Tengwar) effectuent un véritable mappage caractère-par-caractère en utilisant des règles linguistiques. La sortie contient des caractères Unicode réels.
- **Les convertisseurs basés sur police** (Kryptonian) sont des chiffres de substitution 1:1 où la sortie est constituée de caractères Unicode PUA qui ne s'affichent correctement que si une police spécifique est chargée.

## Comment Ils Fonctionnent

Les convertisseurs de script s'exécutent **après** la traduction en tant qu'étape de post-traitement. Le pipeline est :

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

Par exemple, Plains Cree :
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### Correspondance Gourmande de Gauche à Droite

Tous les convertisseurs utilisent le même algorithme : à chaque position de caractère, essayez d'abord la correspondance la plus longue possible, puis progressivement les correspondances plus courtes. Les caractères qui ne correspondent à aucun motif (espaces, ponctuation, chiffres) passent inchangés.

Cela gère correctement les digrammes et trigrammes :
- Klingon : `tlh` → caractère pIqaD unique (pas `t` + `l` + `h`)
- Serbe : `nj` → `њ` (pas `н` + `ј`)
- Cree : `twê` → syllabique unique (pas `t` + `w` + `ê`)

## Utiliser les Convertisseurs de Script

La conversion est une **décision de configuration, jamais automatique** (depuis la version 0.3.0 — les versions antérieures convertissaient inconditionnellement, ce qui livrait du texte PUA non affichable aux projets dont les polices attendaient une translittération latine) :

- **crk et sr ont deux véritables orthographes** (SRO/Syllabique, Latin/Cyrillique). Il n'y a pas de valeur par défaut : `champollion init` demande laquelle écrire, et `sync` refuse de s'exécuter tant que la configuration ne l'indique pas. Champollion ne choisit pas le système d'écriture d'une communauté.
- **tlh, x-elvish-s et x-kryptonian utilisent la romanisation par défaut** — leurs scripts d'affichage se trouvent dans la zone à usage privé (Private Use Area), impossibles à afficher sans une police spéciale. Vous devez l'activer explicitement.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Lorsque champollion synchronise `en:crk` avec `"script": "Cans"`, les traductions sont produites en SRO (le script de travail que la porte valide), puis converties en syllabique avant d'être écrites dans `crk.json`. Avec `"script": "Latn"` — ou pour tlh sans aucun `script:` — le script de travail est le livrable et rien n'est converti.

Les lettres que le convertisseur ne peut pas mapper (le klingon n'a pas de `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z` — donc "GitHub" ne peut pas être entièrement converti) conservent la **valeur complète** dans le script de travail plutôt que de mélanger les scripts, avec un avertissement nommant les lettres. Déclarez vos propres règles de translittération avec [`scriptFallback`](/docs/getting-started/configuration#script-fallback).

Pour annuler une conversion qui s'est produite lorsqu'elle était inconditionnelle, exécutez [`champollion repair-script`](/docs/getting-started/configuration#repair-script) ; `champollion integrity` échoue si du texte PUA est trouvé là où la conversion est désactivée.

### Vérifier l'État du Convertisseur

```bash
npx champollion status
```

La sortie d'état affiche la décision de script résolue pour chaque paire — ce qui sera écrit, et si un convertisseur est disponible mais non activé.

## Exigences de Police Web

Trois convertisseurs produisent des caractères Unicode de la Zone d'Usage Privé (PUA) qui nécessitent des polices web personnalisées :

### Klingon (pIqaD)

Installez une police pIqaD compatible CSUR (par exemple, « pIqaD qolqoS » ou « Klingon pIqaD HaSta ») :

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar (Sindarin)

Installez une police Tengwar compatible CSUR (par exemple, « Tengwar Formal CSUR », « Tengwar Annatar ») :

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### Kryptonian

Installez une police Kryptonian mappée aux points de code PUA U+E100–E119 :

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[Approche alternative pour le Kryptonien]
Puisque le Kryptonien est un simple chiffre A-Z, vous pouvez ignorer complètement le convertisseur de script et appliquer la police au texte Latin via CSS. C'est souvent plus simple pour les déploiements web — servez simplement la police Kryptonienne et définissez `font-family` sur les éléments pertinents.
:::

## Ajouter un Convertisseur Personnalisé

Pour ajouter un convertisseur pour une nouvelle langue, modifiez `lib/scripts.js` :

1. **Créez la carte de conversion** — un tableau ordonné de paires `[from, to]`, les séquences les plus longues en premier
2. **Créez la fonction de convertisseur** — un scanner gourmand de gauche à droite (utilisez `sroToSyllabics` comme modèle)
3. **Enregistrez-le** dans l'objet `SCRIPT_CONVERTERS` avec le code de locale comme clé
4. **Ajoutez le champ `script`** à l'entrée de registre de la langue dans `registers.js`

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## Voir aussi

- [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) — polices PUA, Unicode, ajouter de nouveaux convertisseurs
- [Quality Gate](/docs/concepts/quality-gate) — validation qui s'exécute avant la conversion de script
- [Supported Languages](/docs/reference/supported-languages) — quelles langues ont des convertisseurs de script
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — SRO→Syllabics en contexte
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — conversion de script dans un pipeline multi-étapes
