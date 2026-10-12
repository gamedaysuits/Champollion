---
sidebar_position: 5
title: "Traduction de contenu"
---

# Traduction de contenu (Markdown)

Champollion traduit les fichiers Markdown et MDX, aussi bien les champs du front matter que le corps du texte. Les blocs de code, les shortcodes et les autres éléments structurés sont protégés contre la traduction.

Les fichiers résident dans un **répertoire de contenu** (`contentDir`). Il peut s'agir de n'importe quel dossier contenant du Markdown : le `content/` d'un site Hugo ou un dossier d'infolettres au sein d'une application Next.js. Un site Docusaurus (avec un `docusaurus.config.js`) fonctionne différemment : ses répertoires `docs/` et `blog/` sont traduits dans des dossiers `i18n/<locale>/` sans `contentDir`. Consultez [Intégration de frameworks](/docs/guides/framework-integration).

## Configuration

Définissez `contentDir` dans votre configuration, ou transmettez `--content-dir` sur la ligne de commande :

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

Au début d'une exécution, sync indique le dossier et précise où iront les traductions :

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

Dans un site Hugo, il indique également les éléments de détection trouvés, par exemple `Detected framework: Hugo (hugo.toml)`. Hugo est considéré comme détecté en présence d'un fichier `hugo.toml`/`.yaml`/`.yml`/`.json`, du dossier `config/_default/` de Hugo, d'un `config.toml` ou `config.yaml` contenant un paramètre propre à Hugo tel que `baseURL`, d'un dossier `archetypes/` ou d'un dossier `layouts/` contenant des gabarits Hugo. Que le site utilise Hugo ou non, les fichiers sont traduits et nommés de la même manière.

## Emplacement des traductions

Chaque traduction est écrite **à côté de sa source**, avec la locale cible ajoutée avant l'extension. Il s'agit de la convention de Hugo de traduction par nom de fichier :

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

Les sous-dossiers sont également analysés, et chaque traduction reste dans le dossier de sa source. Votre application sélectionne le fichier correspondant à une locale d'après ce nom. Une page Next.js, par exemple, lit `newsletters/2026-10.crk.md` pour le cri des plaines.

**Quels fichiers sont considérés comme des sources.** Chaque fichier `.md` et `.mdx` présent dans le dossier est une source, à moins que son nom ne se termine par `.<code>.md` (ou `.mdx`) et que `<code>` ressemble à un code de langue. Un code de langue correspond ici à deux ou trois lettres minuscules, éventuellement suivies d'une écriture telle que `-Hant` et/ou d'une région telle que `-BR` ou `-419`. Ces fichiers sont considérés comme des traductions et ignorés. Un suffixe correspondant à la langue source (`launch.en.md`) compte toujours comme une source. Piège à éviter : un fichier source nommé `guide.faq.md` se termine également par un suffixe de deux ou trois lettres ; il est donc considéré comme une traduction vers « faq » et n'est pas traduit. Renommez-le, par exemple en `guide-faq.md`.

## Ce qui est traduit

### Front Matter

Les délimiteurs YAML (`---`) et TOML (`+++`) sont tous deux pris en charge. Par défaut, ces champs sont traduits :

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

Tous les autres champs (`date`, `draft`, `tags`, `weight`, `slug`, etc.) sont copiés tels quels depuis la source. Vous pouvez modifier cette liste à l'aide de `translatableFields` dans votre configuration.

### Contenu du corps

Par défaut, le corps du texte est découpé en paragraphes et autres blocs de premier niveau, et chaque bloc est traduit. Les éléments structurés sont protégés par des balises génériques avant la traduction et restaurés ensuite. Avec `contentSegmentation: "page"`, le corps du texte est traduit d'un seul bloc.

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

## Quand un fichier est-il retraduit ?

Sync enregistre une empreinte numérique (SHA-256) de chaque fichier source dans `.champollion-content.lock`. Committez ce fichier avec vos traductions.

- **Source inchangée :** la traduction n'est pas modifiée.
- **Source modifiée :** le fichier est mis à jour. Les paragraphes dont le texte source en anglais n'a pas changé proviennent de la [mémoire de traduction](/docs/concepts/translation-memory) sans frais supplémentaires ; vous ne payez donc que pour les paragraphes modifiés.
- **Un fichier de traduction sans entrée de verrouillage** (que vous avez rédigé manuellement) est conservé tel quel et enregistré comme étant le vôtre. Seule exception : un fichier contenant encore des marqueurs `[EN] ` générés par une version du CLI antérieure à 0.5.0, qui sera retraduit.
- **Un bloc refusé par le quality gate, y compris après une nouvelle tentative motivée,** conserve son texte source, sans aucun marqueur sur la page. L'entrée de verrouillage de la page indique `pending:<hash>`, et le refus est consigné dans `.champollion-content.lock`. Les synchronisations ultérieures ne renverront pas ce bloc au même modèle, évitant ainsi toute nouvelle facturation. `status` et `verify` listent la page. Relancez la demande avec `--redo files:<page>`, ajoutez une méthode `fallback`, ou rédigez vous-même le paragraphe (il sera conservé). Un champ du front matter refusé conserve son texte source de la même manière, et le reste de la page est écrit. Consultez [Blocs Markdown et champs de front matter refusés](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields).

Pour forcer la retraduction d'un fichier, spécifiez son nom. Le chemin correspond à celui affiché par sync, relatif au répertoire de contenu :

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## Révision et modification des traductions {#reviewing-and-editing-translations}

Un réviseur peut corriger le Markdown traduit directement dans le fichier traduit. Champollion conserve ces corrections lorsque la source est modifiée ultérieurement.

1. Exécutez `champollion sync` et committez les traductions avec `.champollion-content.lock`.
2. Le réviseur ouvre le fichier traduit, par exemple `newsletters/2026-10.crk.md`, et le modifie. Il peut modifier n'importe quel paragraphe ou champ de front matter traduit tel que `title` ou `description`.
3. Le réviseur committe le fichier. Aucune commande n'est requise pour « accepter » les modifications.

Ce qu'il advient des modifications lors du prochain `champollion sync` :

| Situation | Ce que fait sync |
|---|---|
| La source n'a pas changé | Rien. La traduction est conservée exactement telle que le réviseur l'a laissée. |
| La source a changé dans **d'autres** paragraphes | Les paragraphes et les champs du réviseur sont **conservés mot pour mot** et les paragraphes modifiés sont traduits. L'exécution le signale, par exemple `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`. Le texte du réviseur reste intact à chaque synchronisation ultérieure. |
| Le paragraphe source modifié par le réviseur a **également** changé | Ce paragraphe est retraduit, car la version du réviseur traduit un texte anglais qui n'existe plus. L'exécution affiche un avertissement contenant la formulation du réviseur afin qu'elle puisse être réappliquée si elle convient toujours. |
| Le réviseur a ajouté, supprimé ou fusionné des paragraphes, ou la paire utilise `contentSegmentation: "page"` | Les modifications ne peuvent pas être associées paragraphe par paragraphe. Lorsque la source change, le fichier est **laissé exactement en l'état**, et chaque synchronisation émet un avertissement et le liste jusqu'à ce que la situation soit résolue. Mettez-le à jour manuellement (la synchronisation suivante considérera alors le fichier modifié comme actuel) ou remplacez-le par la traduction automatique à l'aide de `--redo files:<path>`. |

Les modifications apportées aux blocs de code, aux espaces entre les paragraphes et aux champs du front matter non traduits (`date`, `tags`, etc.) ne sont pas conservées lors de la réécriture du fichier. Ces éléments proviennent systématiquement de la source.

**Remplacer délibérément les modifications.** Les modifications ne sont remplacées que si vous nommez explicitement le fichier. `--redo files:2026-10.md` rétablit la traduction automatique en cache. `--redo files:2026-10.md --fresh` (ou `--retranslate 2026-10.md`) le retraduit intégralement depuis le début. Une exécution qui retraite l'ensemble du contenu sans nommer de fichiers (`--redo content`, `--force-content`) conserve les modifications.

**Comment les modifications sont reconnues.** Chaque fois que sync écrit une traduction, il enregistre également dans `.champollion-content.lock` une courte empreinte de chaque paragraphe généré. Tout paragraphe sur le disque qui ne correspond plus a été modifié par une personne. Si le fichier de verrouillage est perdu, les modifications ne peuvent plus être reconnues ; veillez donc à le conserver sous contrôle de version. Une traduction générée par une ancienne version de Champollion est enregistrée lors de la synchronisation suivante. Si les modifications que vous y avez apportées diffèrent du contenu de la mémoire de traduction, elles sont reconnues comme étant les vôtres.

Le texte du réviseur n'est jamais stocké dans la mémoire de traduction comme une sortie machine.

:::note[Le format XLIFF ne concerne que les fichiers de chaînes]
`champollion xliff export` transmet les **fichiers de chaînes** (clés et valeurs) de votre application à l'outil de TAO d'un traducteur. Consultez [Collaborer avec des traducteurs professionnels](/docs/guides/professional-translators). Il n'existe pas encore d'export XLIFF pour le contenu Markdown ; le Markdown traduit est donc révisé directement dans les fichiers eux-mêmes, comme décrit ci-dessus.
:::

## Méthodes Markdown uniquement

:::warning[Google Translate et Markdown]
Google Translate ne **prend pas en compte** les blocs de code, les shortcodes ou les variables d'interpolation. Il corrompra le contenu Markdown structuré. Utilisez des méthodes basées sur des LLM (`llm` ou `llm-coached`) pour la traduction de contenu, car elles protègent explicitement les éléments structurés.
:::

Lorsque la traduction de contenu bascule de Google Translate vers une méthode LLM, champollion enregistre un avertissement expliquant pourquoi.
