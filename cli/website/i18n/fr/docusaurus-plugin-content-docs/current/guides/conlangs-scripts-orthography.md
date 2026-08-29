---
sidebar_position: 3
title: "Langues construites, Systèmes d'écriture et Orthographie"
---

# Conlangs, Scripts et Orthographe

champollion offre un support de première classe pour les langues construites via des registres LLM et des convertisseurs de script déterministes. Ce guide couvre le fonctionnement du support des conlangs, les polices dont vous avez besoin, et comment en ajouter vos propres.

:::tip[Pourquoi les conlangs sont importants]
Les conlangs ne sont pas qu'une curiosité — ils exercent exactement la même infrastructure utilisée pour les langues réelles sous-desservies. La porte de qualité, le système de coaching et le pipeline de conversion de scripts fonctionnent de manière identique pour le Klingon et le Cree des Plaines. Si votre pipeline conlang fonctionne, votre pipeline de langue à faibles ressources fonctionnera aussi.
:::

---

## Langues Construites Supportées

| Langue | Code | Convertisseur de Script | Police Requise |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ Romanisation → pIqaD | Police PUA (p. ex., pIqaD qolqoS) |
| Sindarin (Elfique Tolkien) | `x-elvish-s` | ✅ Latin → Tengwar | Police PUA CSUR |
| Kryptonien | `x-kryptonian` | ✅ Latin → Kryptonian | Police PUA |
| Pirate English | `x-pirate` | ❌ registre uniquement | Aucune |
| Shakespearean English | `x-shakespeare` | ❌ registre uniquement | Aucune |
| Yoda-speak | `x-yoda` | ❌ registre uniquement | Aucune |

Les codes conlang utilisent le préfixe `x-` selon la convention BCP-47 d'usage privé, sauf le klingon (`tlh`) qui possède un code [ISO 639-3](https://iso639-3.sil.org/code/tlh) assigné par SIL International.

---

## Unicode, PUA et Exigences de Police

### La Zone d'Usage Privé

Le klingon (pIqaD), le sindarin (Tengwar) et le kryptonien utilisent des caractères **Zone d'Usage Privé (PUA)** Unicode. La PUA est la plage U+E000–U+F8FF — ces points de code n'ont **aucune assignation standard**. Le [Registre Unicode ConScript (CSUR)](https://www.evertype.com/standards/csur/) maintient des mappages convenus par la communauté pour les scripts fictifs, mais ceux-ci ne font pas partie de la norme Unicode.

Ce que cela signifie en pratique :

- Le texte PUA s'affiche sous forme de **boîtes vides** (□□□) sans la police correcte chargée
- Différentes polices peuvent mapper différents glyphes aux mêmes points de code PUA
- champollion ne regroupe PAS les polices PUA — vous devez les charger vous-même
- Les polices système ne rendront jamais ces caractères

### Plages PUA par Script

| Script | Plage PUA | Référence CSUR |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elfique) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonien | Varie selon la police | Aucune norme CSUR |

### Chargement des Polices Web PUA

champollion inclut une commande intégrée pour télécharger et gérer les polices web PUA :

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

La commande `fonts install` télécharge depuis des dépôts open-source vérifiés :

| Police | Script | Licence | Source |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (avec exception de police) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(fournie par l'utilisateur)* | Kryptonien | Varie | Aucune police PUA open-source disponible |

Le répertoire de sortie est auto-détecté à partir de votre structure de projet (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, défaut → `public/fonts/`). Remplacez avec `--dir`.

Si vous préférez gérer les polices manuellement, ajoutez des règles `@font-face` dans votre CSS :

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[Le support Unicode n'est PAS garanti]
Le Unicode Consortium a [explicitement refusé](https://www.unicode.org/faq/private_use.html) d'encoder les scripts fictifs dans la norme. Les assignations PUA sont maintenues par la communauté et peuvent entrer en conflit entre les implémentations de polices. Spécifiez toujours la police exacte que votre projet utilise et testez le rendu dans les navigateurs.
:::

---

## Convertisseurs de Script

### Comment Ils Fonctionnent

La conversion d'écriture de champollion est un **hook post-traduction, appliqué uniquement lorsque la configuration le demande** :

1. Le LLM traduit le texte dans une **écriture de travail** (généralement latine ou SRO)
2. Le [contrôle qualité](/docs/concepts/quality-gate) valide la sortie
3. Si le paramètre `script:` de la paire sélectionne l'écriture d'affichage, le convertisseur déterministe transforme le texte validé — les valeurs contenant des lettres que le convertisseur ne peut pas mapper restent intactes dans l'écriture de travail, avec un avertissement par clé
4. Le résultat est écrit sur le disque

Cette approche en deux étapes fonctionne parce que les LLM produisent une meilleure sortie lorsqu'ils travaillent dans des scripts basés sur le latin. Le convertisseur déterministe garantit une sortie de script correcte sans dépendre de la connaissance du script du modèle (souvent peu fiable).

L'exécution même de l'étape 3 est une décision propre à chaque projet — voir [Conversion d'écriture](/docs/getting-started/configuration#script-conversion). Les écritures d'affichage PUA (pIqaD, Tengwar, Kryptonian) sont désactivées par défaut car elles ne produisent aucun rendu sans une police spécialement conçue ; crk et sr n'ont aucune valeur par défaut, car leurs deux orthographes sont réelles et le choix appartient au projet.

### Les Cinq Convertisseurs

champollion est livré avec cinq convertisseurs de script intégrés :

#### Cri des Plaines : SRO → Syllabiques (`crk`)

Orthographe Romane Standard vers Syllabiques Autochtones Canadiennes.

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

Les voyelles longues utilisent macron/circonflexe : ê, î, ô, â. Le convertisseur gère tous les diacritiques SRO et les mappe aux caractères syllabiques corrects. Voir [Support a Low-Resource Language](/docs/network/community/low-resource-languages) pour le pipeline cri complet.

#### Serbe : Latin → Cyrillique (`sr`)

Conversion déterministe Latin-Cyrillique pour le serbe.

```
Input:  "zdravo"
Output: "здраво"
```

Cela gère le mappage complet de l'alphabet serbe incluant les digraphes (lj → љ, nj → њ, dž → џ).

#### Klingon : Romanisation → pIqaD (`tlh`)

Système de romanisation de Marc Okrand vers les caractères pIqaD PUA.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin : Latin → Tengwar (`x-elvish-s`)

Mappage Tengwar mode Sindarin de Tolkien.

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonien : Latin → Kryptonian (`x-kryptonian`)

Mappage de script kryptonien du lexique fan.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### Déclencher un Convertisseur

Définissez le champ `script` sur le code ISO 15924 de l'orthographe que vous souhaitez produire :

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Aucune conversion ne s'effectue sans cela. Pour `crk` et `sr`, le champ est **obligatoire** — leurs deux orthographes sont réelles, et `sync` refuse d'en choisir une pour vous. Pour les locales PUA, il s'agit d'une option d'activation (opt-in) par rapport à la romanisation par défaut. Voir [Conversion d'écriture](/docs/getting-started/configuration#script-conversion).

---

## Langues Multi-Script

Certaines langues réelles utilisent plusieurs scripts actifs :

| Langue | Écritures | Approche de champollion |
|----------|---------|-----------------|
| Serbe | Latin + Cyrillique | Une seule locale, choix explicite : `"script": "Cyrl"` convertit, `"script": "Latn"` conserve le latin |
| Cri des plaines | SRO (Latin) + Syllabaire | Une seule locale, choix explicite : `"script": "Cans"` ou `"script": "Latn"` |
| Chinois | Simplifié + Traditionnel | Codes de locale distincts (`zh` vs `zh-TW`) avec des registres distincts |

Pour les langues où les deux écritures s'adressent au même public (Serbe, Cri des plaines), une seule locale plus un choix explicite de `script` permet de conserver un pipeline de traduction unique. Pour les langues où les écritures s'adressent à des publics différents (Chinois simplifié pour la Chine continentale, Traditionnel pour Taïwan/HK), utilisez des codes de locale distincts.

---

## Notes sur l'Orthographe

Les registres ne sont pas seulement un ton — ils portent des **instructions orthographiques** qui orientent le LLM vers les conventions d'écriture correctes.

### Formes d'Adresse Formelle

Les registres intégrés de champollion incluent la forme d'adresse formelle culturellement appropriée pour chaque langue :

| Langue | Forme Formelle | Instruction de Registre |
|----------|------------|---------------------|
| Allemand | Sie | `Use Sie-form for formal address` |
| Français | vous | `Use vous-form` |
| Russe | вы | `Professional register with вы-form` |
| Turc | siz | `Professional register with siz-form` |
| Coréen | 합쇼체 | `Formal Korean (합쇼체)` |
| Japonais | です/ます | `Polite professional register (です/ます form)` |
| Polonais | Pan/Pani | `Professional register with Pan/Pani form` |

### Écriture Inclusive du Genre

Chaque fiche de langue a un champ `gender.inclusiveGuidance` avec des conseils spécifiques à la langue. Ceci est injecté dans l'invite de traduction LLM séparément du préréglage de registre, donc il s'applique de manière cohérente quel que soit le préréglage de formalité que l'utilisateur choisit :

- **Français** : Écriture inclusive avec notation interpunct (p. ex., « Connecté·e »)
- **Allemand** : Notation Doppelpunkt (p. ex., « Benutzer:innen »)
- **Espagnol** : Restructuration neutre du genre préférée ; notation slash (p. ex., « usuario/a ») comme solution de secours

Pour les langues sans conseils spécifiques dans leur fiche (p. ex., coréen, conlangs), le système revient à une règle générique : *« préférer les formes neutres du genre ou l'option la plus inclusive disponible ».*

### Exigences de Script RTL

Les registres arabe, hébreu, persan et ourdou notent tous les exigences droite-à-gauche : `Ensure text reads naturally in RTL layout contexts.`

### Remplacer N'Importe Quel Registre

Chaque registre est une valeur de configuration — remplacez-le pour correspondre à la voix de votre projet :

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

Voir [Configuration](/docs/getting-started/configuration) pour la référence de configuration complète.

---

## Ajouter un Nouveau Conlang

### Étape par étape

1. **Choisissez un code BCP-47 d'usage privé** : Utilisez le préfixe `x-` (p. ex., `x-dothraki`, `x-valyrian`).

2. **Ajoutez à votre configuration** :

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(Optionnel) Ajoutez un convertisseur de script** : Si votre conlang utilise un script d'affichage non-latin, ajoutez un convertisseur dans `lib/scripts.js` et enregistrez-le dans `SCRIPT_CONVERTERS`.

4. **Testez** : Exécutez `champollion sync --dry` pour prévisualiser les traductions sans écrire les fichiers.

5. **Vérifiez la porte de qualité** : La [porte de qualité](/docs/concepts/quality-gate) peut nécessiter un ajustement pour votre conlang — particulièrement la vérification `requireNonLatin` si votre conlang utilise des caractères PUA.

:::note[La qualité des conlangs dépend des connaissances du LLM]
Le LLM ne peut traduire que dans un conlang qu'il a vu dans les données d'entraînement. Les conlangs bien documentés (Klingon, Sindarin, Dothraki) fonctionnent bien. Les conlangs obscurs ou nouvellement inventés peuvent produire des résultats incohérents. Utilisez les [données de coaching](/docs/concepts/coaching-data) pour améliorer la qualité.
:::

---

## Voir aussi

- [Langues Supportées](/docs/reference/supported-languages) — tableau de langue complet avec disponibilité des méthodes
- [Convertisseurs de Script](/docs/concepts/script-converters) — détails techniques du pipeline de conversion
- [Méthodes de Traduction](/docs/guides/translation-methods) — comment chaque méthode de traduction fonctionne
- [Configuration](/docs/getting-started/configuration) — référence de configuration incluant la configuration de langue et de registre
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — la même infrastructure appliquée aux langues réelles mal desservies
