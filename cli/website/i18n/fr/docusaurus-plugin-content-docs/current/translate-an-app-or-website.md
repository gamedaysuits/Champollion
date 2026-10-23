---
title: "Traduire une application ou un site web"
slug: /translate-an-app-or-website
description: "Traduisez les mots sur les écrans d'une application ou d'un site web dans votre langue, maintenez-les à jour à mesure que l'original change, et choisissez quel·le traducteur·rice prend en charge chaque langue."
---

# Traduire une application ou un site web

Les applications et les sites web conservent leurs mots — boutons, menus, messages, pages — dans
des fichiers, à raison d'un par langue. Champollion peut renseigner le fichier de votre langue
pour vous et le maintenir à jour dès que l'original change. Une seule commande suffit :

```bash
npx champollion sync
```

Il détecte les fichiers de langue de votre application, traduit uniquement ce qui manque ou a
changé, vérifie chaque traduction avant de l'écrire et ne touche pas au reste.

## Quel traducteur effectue le travail

Vous choisissez, pour chaque langue :

- **Votre propre traducteur**, construit sur les rails — les outils le connectent à votre
  application. S'il a appris à partir de phrases privées, il ne se connecte qu'une fois que
  vous avez indiqué qui, parmi les personnes dépositaires des mots, a donné son accord.
- **Un modèle d'IA ou un service de traduction** — pour les langues qu'ils prennent déjà
  bien en charge. Ceux-ci transmettent les mots de votre application à l'entreprise qui les exploite ;
  utilisez-les donc pour des textes qu'il est tout à fait possible de partager.
- **Votre propre service**, à une adresse que vous indiquez.

## Ce dont il s'occupe

- **Uniquement ce qui a changé.** Il mémorise ce qu'il a déjà traduit, afin que vous ne
  payiez jamais deux fois pour la même phrase.
- **Vérifications avant écriture.** Les réponses vides, la copie conforme de l'original, les mots
  qui se répètent en boucle, les textes bien plus longs qu'ils ne devraient l'être, les éléments manquants ou
  le mauvais alphabet sont interceptés et refusés. Ces contrôles détectent les résultats défectueux,
  non les erreurs de sens — la personne locutrice conserve toujours le dernier mot.
- **Vos fichiers, votre format.** Les fichiers JSON, YAML, TOML et les pages Markdown, ainsi que les
  frameworks courants d'applications et de sites web.

## Qui peut l'utiliser

Gratuit pour un usage non commercial — l'application d'une école, le site web d'une communauté, un
service public. Le produit d'une entreprise n'est pas couvert par la licence gratuite ; si une communauté
de locuteurs souhaite l'utiliser à des fins commerciales, demandez-le, et la licence est gratuite.
La page [Qui peut utiliser ces outils](/docs/getting-started/who-may-use-this) contient tous les détails.

**Étape suivante :** [Héberger un test scellé →](/docs/host-a-sealed-test)

## Approfondir

- [Traduction d'applications et de sites web](/docs/intro) — la référence complète : prise en main rapide,
  configuration, frameworks, mémoire de traduction, contrôles de qualité, CI.
- [Mise à disposition et déploiement](/docs/agents/serving) — connecter votre propre
  traducteur.
