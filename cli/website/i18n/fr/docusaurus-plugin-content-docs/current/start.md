---
title: "Démarrer un projet"
slug: /start
description: "Commencez à créer un traducteur pour votre langue — avec un assistant IA sur votre ordinateur, ou en saisissant vous-même quatre commandes."
---

# Démarrer un projet

Il existe deux façons de commencer. Dans les deux cas, les outils s'exécutent sur votre propre ordinateur
et vous guident pas à pas.

## Avec un assistant IA

C'est la méthode la plus simple. Votre assistant se charge de la saisie ; vous répondez aux
questions qui vous reviennent.

**Ce dont vous avez besoin :** un assistant IA qui fonctionne comme une application sur votre ordinateur — et pas
seulement une application sur téléphone — et qui peut y utiliser des outils.

### 1. Ajoutez les rails à votre assistant

Copiez la courte configuration ci-dessous, collez-la dans votre assistant et dites :
*« Veuillez configurer ceci pour moi. »* De nombreux assistants en sont capables. Si le vôtre ne l'est pas, demandez
à une personne à l'aise avec l'informatique de le faire une fois — les étapes sont détaillées juste en dessous.

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

<details>
<summary>Configuration manuelle</summary>

Les assistants se connectent aux outils par l'intermédiaire d'un standard courant appelé MCP ; la configuration
ci-dessus indique au vôtre comment démarrer les rails. Votre ordinateur nécessite également Node.js
20.11 ou une version plus récente, un programme gratuit.

- **Application de bureau de Claude :** Paramètres → Développeur → Modifier la configuration. Ajoutez la
  configuration à ce fichier, enregistrez-le et redémarrez l'application.
- **Claude Code :** exécutez ceci une fois dans un terminal :
  `claude mcp add champollion -- npx -y champollion-mcp-server`
- **Cursor :** ajoutez la configuration au fichier `mcp.json` dans le dossier
  `.cursor` de votre projet, ou dans le dossier `.cursor` de votre dossier personnel.

</details>

### 2. Dites-lui, avec vos propres mots

Quelque chose comme :

> *Nous voulons concevoir un traducteur de l'anglais vers notre langue — utilise
> champollion.*

### 3. Répondez à ses questions

Tout d'abord, il vous reformulera la direction de traduction — *« vous fournissez de l'anglais en entrée, et votre
langue est produite en sortie. Est-ce bien dans ce sens ? »* — car se tromper de
sens est une erreur facile à commettre. Ensuite, il crée un dossier de projet et vous demande vos
fichiers.

Dès lors, il vous sollicite chaque fois qu'une décision vous revient : à qui appartiennent vos mots,
si un traducteur peut apprendre à partir d'eux, ou s'il convient d'installer quelque chose. Répondez
par vous-même. Si vous ne savez pas encore, dites-le — les rails peuvent attendre. Et *pas
maintenant* est toujours une réponse valable : les rails ne reposeront pas la question au cours de cette session.

**Une chose à savoir avant de commencer.** La plupart des assistants transmettent ce qu'ils lisent à l'entreprise
qui les exploite. Pour les fichiers conservés sur cet ordinateur, les outils indiquent seulement au vôtre
*combien* de phrases vous possédez, jamais les phrases elles-mêmes — mais un assistant capable
d'utiliser votre ordinateur peut ouvrir n'importe quel fichier auquel vous avez accès. Pour les mots que vous souhaitez garder confidentiels,
demandez-lui de ne pas y accéder, ou utilisez un assistant qui s'exécute sur votre propre ordinateur. La page [Vos mots, vos règles](/docs/your-words-your-rules) apporte des explications détaillées.

## Par vous-même

Si vous êtes à l'aise avec la saisie de commandes, cela tient en quatre lignes. Installez l'outil
de projet (il nécessite Node.js 20.11 ou une version plus récente), démarrez un projet et demandez la suite :

```bash
npm install -g champollion
champollion new family --from English --to qaa --target-name "Our language"
cd family
champollion next
```

`qaa` signifie « une langue qui n'a pas encore de code » — cela fonctionne très bien ; simplement, les outils
ne renseigneront pas automatiquement des éléments tels que votre alphabet. Le nom entre guillemets est celui
que vous lui donnerez. Si votre langue possède un code, ou un nom connu des outils,
utilisez-le plutôt. Si un nom peut désigner plusieurs langues, demandez à vos
locuteurs laquelle ils parlent avant de choisir un code ; en attendant leur réponse, `qaa`
fonctionne, mais ne dispose d'aucune fiche linguistique, si bien qu'aucune règle de pluriel ni système d'écriture n'en proviendra.

Dès lors, `champollion next` indique systématiquement l'étape suivante ainsi que la commande
exacte pour l'effectuer. Lorsqu'il est temps d'entraîner un traducteur, les rails demandent confirmation avant
d'installer les outils d'entraînement.

## Travailler sans connexion Internet

Restez en ligne tout au long de l'installation et de votre premier entraînement : les outils d'entraînement
ainsi que le traducteur le plus performant (environ 1,2 Go) sont téléchargés à ce moment-là. Ensuite, le
travail s'effectue sur votre ordinateur. Pour bloquer les requêtes propres aux outils — ils peuvent récupérer la fiche
d'information publique d'une langue, en n'envoyant que son code — définissez ceci dans votre
terminal et dans les paramètres de votre assistant :

```bash
export CHAMPOLLION_OFFLINE=1
```

Un assistant IA qui s'exécute sur les serveurs d'une entreprise a toujours besoin d'Internet.
Pour un travail entièrement hors ligne, utilisez-en un qui tourne sur votre propre ordinateur.

## À quoi s'attendre

Votre premier traducteur s'apparentera probablement à un guide de conversation : efficace pour des phrases semblables
à celles sur lesquelles il s'est entraîné, et pas grand-chose d'autre pour l'instant. C'est ainsi que chaque projet
commence. La page [Ce qu'il ne sait pas encore faire](/docs/what-it-cant-do-yet) expose clairement ce à quoi vous
pouvez vous attendre, et [L'améliorer](/docs/make-it-better) montre comment il progresse.

**Étape suivante :** [Apportez ce que vous avez →](/docs/bring-your-data)

## Approfondir

- [Piloter les rails via MCP](/docs/agents/mcp) — les six outils, la boucle
  et la configuration détaillée par assistant.
- [Piloter les rails depuis le shell](/docs/agents/shell) — toutes les commandes que
  les rails exécutent.
- [Le contrat de fonctionnement](/docs/agents/contract) — les règles que votre assistant
  suit.
- [Qui peut utiliser ceci](/docs/getting-started/who-may-use-this) — la licence.
