---
sidebar_position: 1
title: "Pour les communautés linguistiques"
---

# Pour les communautés linguistiques

> **Résumé exécutif.** Votre communauté peut posséder son propre ensemble de test — la « clé de correction » par rapport à laquelle toute méthode de traduction est mesurée — et organiser son propre concours selon ses propres conditions, sans jamais transférer les données. Cette page explique ce que le Réseau demande aux communautés linguistiques (traductions de référence, révision de traduction, données d'entraînement), ce que vous recevez en retour (travail rémunéré aux tarifs publiés, propriété du code, contrôle complet du déploiement), et les garanties de souveraineté qui viennent en premier. Aucune compétence en programmation n'est requise, et rien ici ne vous oblige à nous faire confiance : les garanties sont structurelles, non des promesses.

Vous n'avez pas besoin d'être programmeur pour contribuer au Réseau. Si vous parlez une langue autochtone ou peu dotée en ressources, vous êtes la personne la plus importante dans cet écosystème.

---

## La souveraineté d'abord

Avant de vous demander quoi que ce soit, la règle fondamentale : **vos données linguistiques vous appartiennent.** Les données linguistiques sont des *données biologiques* — elles portent l'identité et les relations de votre communauté et ne peuvent pas être anonymisées de manière significative — donc les personnes qui les fournissent en détiennent les clés, ainsi que de tout ce qui est mesuré par rapport à elles. Le Réseau est construit selon les [principes autochtones de souveraineté des données](/docs/network/sovereignty/data-sovereignty) :

- Nous ne collectons ni ne stockons jamais vos données linguistiques sur nos serveurs
- Les méthodes de traduction utilisent l'architecture `api` — toutes les données d'entraînement, dictionnaires et règles grammaticales restent sur l'infrastructure que vous contrôlez
- Vous décidez qui peut développer des méthodes pour votre langue
- Les scores du classement prouvent qu'une méthode fonctionne ; ils n'accordent pas la permission de la déployer

:::note[État actuel des choses]
Le modèle de transfert de propriété décrit ci-dessous est un **design engagé, pas encore un programme en fonctionnement.** Le classement est ouvert aux soumissions et n'a actuellement aucune exécution publiée, et aucune méthode n'a encore été transférée à une communauté. Nous décrivons comment il est construit pour fonctionner afin que vous puissiez nous en tenir responsables — non pour suggérer qu'il est déjà en cours. La relation, et votre autorité sur vos données, viennent en premier ; le reste en découle.
:::

---

## Posséder votre ensemble de test

La position la plus forte qu'une communauté peut occuper dans ce système est de **posséder l'indice de référence lui-même**. Un ensemble de test est la clé de correction : celui qui le détient décide ce que signifie « bonne traduction » pour la langue, et toute méthode — la nôtre, celle d'une entreprise, celle de n'importe qui — est mesurée par rapport à *votre* standard.

- **L'enregistrement est des métadonnées, pas du contenu.** Enregistrer un corpus auprès du Réseau signifie publier une fiche descriptive — jamais télécharger le corpus. Vous choisissez sa [voie d'exposition](/docs/network/sovereignty/registering-corpora) : ouverte, contrôlée ou entièrement souveraine.
- **Les indices de référence souverains restent secrets.** Dans la voie souveraine, l'ensemble de test ne quitte jamais l'infrastructure communautaire et nous ne le voyons jamais. Les méthodes sont évaluées par rapport à celui-ci de votre côté ; seul le score voyage.
- **Vous pouvez organiser votre propre concours.** Le guide étape par étape — [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) — vous guide dans l'organisation d'une évaluation contrôlée par la communauté selon vos propres conditions : votre ensemble de test, vos règles, votre décision sur ce qui (le cas échéant) est publié.

Les garanties derrière tout cela sont écrites, non implicites :
[Intendance des données](/docs/network/sovereignty/data-sovereignty) (la position souveraineté-des-données/CARE et ce qu'elle nous interdit de faire) et
[Propriété et conditions](/docs/network/sovereignty/ownership-transfer) (ce qui se passe, contractuellement, quand une méthode gagne).

---

## Ce que nous avons besoin de vous

### Traductions de référence

Nous avons besoin de paires de traduction curées pour l'évaluation — l'anglais d'un côté, votre langue de l'autre. Celles-ci deviennent la « clé de correction » par rapport à laquelle toutes les méthodes de traduction sont évaluées.

Vous pourriez les créer à partir de :
- **Matériel pédagogique** — exercices de manuel, plans de cours, feuilles de travail
- **Documents communautaires** — procès-verbaux de réunion, bulletins d'information, annonces
- **Expressions courantes** — chaînes d'interface utilisateur, étiquettes d'application, expressions communes
- **Contenu culturel** — histoires, chansons ou descriptions (avec les permissions appropriées)

Le format est un simple JSON :
```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

### Révision de traduction

Toute méthode qui prétend produire des traductions fonctionnelles a besoin d'une validation humaine. Les locuteurs bilingues examinent les résultats et nous disent si l'ordinateur a eu raison — et plus important encore, *pourquoi* il s'est trompé.

### Données d'entraînement

Règles grammaticales, entrées de dictionnaire, modèles morphologiques — ce sont les ressources linguistiques qui font fonctionner les méthodes de traduction. Votre connaissance du fonctionnement de votre langue est irremplaçable par n'importe quel modèle d'IA.

---

## Ce que vous recevez en retour

### Propriété

Quand une méthode de traduction est construite pour votre langue et validée sur le Réseau, la [propriété est transférée](/docs/network/sovereignty/ownership-transfer) à l'organisation de gouvernance de votre communauté. Vous possédez le code, les poids du modèle et le déploiement.

### Travail rémunéré, pas extraction

La construction de corpus et la révision de traduction sont un travail professionnel, rémunéré aux
[tarifs publiés](/docs/network/perspectives/how-speakers-get-paid) — et le paiement n'achète pas vos données. Vous êtes payé pour le travail *et* restez propriétaire de ce que vous construisez. Champollion est un projet de recherche non commercial : il ne vend rien, ne mesure rien, et [ne prend aucune part](/docs/network/sovereignty/economic-model)
de tout ce que votre communauté gagne jamais d'une méthode qu'elle possède.

### Contrôle

Votre organisation de gouvernance contrôle :
- Qui peut accéder à la méthode
- Si elle peut être utilisée commercialement — et si oui, selon vos conditions, en conservant tout ce qu'elle gagne
- Quand et comment elle est mise à jour
- Quelles données sont utilisées pour un développement ultérieur

---

## Comment s'impliquer

:::tip[Quelque chose que les locuteurs peuvent faire dès aujourd'hui]
Champollion ne construit ni n'héberge de corpus — les données de test sont toujours récupérées
à partir de leur source. Si les locuteurs de votre communauté souhaitent contribuer des phrases
*dès maintenant*, [Tatoeba](https://tatoeba.org) accepte les contributions phrase par phrase
dans n'importe quelle langue, et les collections ouvertes comme
[OPUS](https://opus.nlpl.eu/) agrègent le texte parallèle à partir duquel le Réseau construit
les repères. Les phrases ajoutées là peuvent devenir des données d'évaluation ici à
la prochaine construction de corpus. Une application de contribution directe des locuteurs et un générateur de corpus
sont l'étape suivante prévue sur notre feuille de route.
:::

1. **Contactez-nous** — Ouvrez un problème sur le [dépôt du Réseau](https://github.com/gamedaysuits/Champollion) ou envoyez un e-mail à [info@champollion.dev](mailto:info@champollion.dev)
2. **Décrivez votre langue** — À quelle famille appartient-elle ? Combien de locuteurs ? Quels systèmes d'écriture sont utilisés ? Quelles ressources informatiques existent (FST, dictionnaires, corpus) ?
3. **Commencez petit** — Même 50 paires de traduction curées suffisent pour créer un ensemble de données d'évaluation et ouvrir une nouvelle piste de classement. Le travail de corpus est [rémunéré aux tarifs publiés](/docs/network/perspectives/how-speakers-get-paid)
4. **Gardez-le vôtre** — Enregistrez le corpus en tant que métadonnées dans la voie que vous choisissez ([Enregistrement de corpus](/docs/network/sovereignty/registering-corpora)) ; si vous voulez que l'ensemble de test soit entièrement secret, le [guide de concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) est le chemin
5. **Connectez-nous à la gouvernance** — Qui dans votre communauté a autorité sur les données linguistiques et la technologie ? Le modèle de souveraineté du Réseau nécessite un partenaire de gouvernance

---

## Voir aussi

- [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) — le guide pour une évaluation contrôlée par la communauté
- [Modèles de conditions](/docs/network/sovereignty/terms-templates) — conditions légalement simples, penchant vers la confiance zéro, que votre communauté peut adapter, avec les risques de cheval de Troie expliqués
- [Intendance des données](/docs/network/sovereignty/data-sovereignty) — la position et les cadres (souveraineté des données autochtones, CARE, Te Mana Raraunga) qui l'ont façonnée
- [Propriété et conditions](/docs/network/sovereignty/ownership-transfer) — conditions par langue et ce qui se passe quand une méthode gagne
- [Comment le travail est financé](/docs/network/sovereignty/economic-model) — où l'argent circule dans un projet non commercial
- [Soutenir une langue peu dotée en ressources](/docs/network/community/low-resource-languages) — contexte technique pour les chercheurs travaillant aux côtés des communautés

