---
sidebar_position: 5
title: "Traduction de contenu"
---

# Traduction de contenu Hugo Markdown

Champollion traduit les fichiers Hugo Markdown — à la fois les champs de front matter et le contenu du corps — avec une protection complète des blocs de code, des shortcodes et des éléments structurés.

## Configuration

Définissez `contentDir` dans votre configuration pour activer la traduction de contenu Markdown :

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## Ce qui est traduit

### Front Matter

Les délimiteurs YAML (`---`) et TOML (`+++`) sont tous deux pris en charge. Par défaut, ces champs sont traduits :

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

Tous les autres champs (`date`, `draft`, `tags`, `weight`, `slug`, etc.) sont conservés tels quels. Personnalisez avec `translatableFields` dans votre configuration.

### Contenu du corps

Le corps Markdown complet est traduit avec protection des blocs — les éléments structurés sont protégés à l'aide de marqueurs sentinelles Unicode avant la traduction et restaurés après.

## Protection des blocs

Ces éléments passent la traduction sans modification :

| Élément | Exemple | Protection |
|---------|---------|-----------|
| Blocs de code | ``````` ```js ... ``` ``````` | Bloc entièrement protégé |
| Code en ligne | `` `variable` `` | Protégé |
| Shortcodes Hugo | `{{< figure >}}`, `{{% note %}}` | Bloc entièrement protégé |
| HTML brut | `<div>`, `<table>` | Protégé |
| Liens (URLs) | `[text](https://...)` | URL conservée, texte traduit |
| Interpolation | `{{ .Count }}` | Protégé |

## Convention de nommage des fichiers

Suit le modèle de traduction par nom de fichier de Hugo :

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## Comportement de saut

Les fichiers traduits existants ne sont **jamais écrasés**. Si `my-post.fr.md` existe déjà, il est ignoré. Supprimez le fichier cible pour forcer une re-traduction.

## Méthodes Markdown uniquement

:::warning[Google Translate et Markdown]
Google Translate n'a **aucune conscience** des blocs de code, des shortcodes ou des variables d'interpolation. Il corrompra le contenu Markdown structuré. Utilisez les méthodes LLM (`llm` ou `llm-coached`) pour la traduction de contenu — elles protègent explicitement les éléments structurés.
:::

Lorsque la traduction de contenu bascule de Google Translate vers une méthode LLM, champollion enregistre un avertissement expliquant pourquoi.
