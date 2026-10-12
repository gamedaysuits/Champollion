---
sidebar_position: 1
title: "Pour les communautés linguistiques"
---

# Pour les communautés linguistiques

> **Résumé exécutif.** Votre communauté peut détenir son propre jeu de test — le « corrigé » auquel chaque méthode de traduction est comparée — et organiser son propre concours selon ses propres modalités, sans jamais transmettre ses données. Cette page explique ce que le Réseau demande aux communautés linguistiques (traductions de référence, révision de traductions, données de guidage), ce que vous recevez en retour (un travail rémunéré selon des tarifs publiés une fois le travail financé — aucun fonds n'est détenu à ce jour — ainsi que la propriété du code et le contrôle total du déploiement), et les protections de souveraineté qui prévalent avant tout. Aucune compétence en programmation n'est requise. Certaines protections sont intégrées au logiciel et à la base de données ; d'autres constituent encore des engagements, et [Limites honnêtes](/docs/network/honest-limitations) précise lesquelles.

Vous n'avez pas besoin d'être programmeur pour contribuer au Réseau. Si vous parlez une langue autochtone ou peu dotée en ressources, vous êtes la personne la plus importante dans cet écosystème.

---

## La souveraineté d'abord

Avant de vous demander quoi que ce soit, la règle fondamentale : **vos données linguistiques vous appartiennent.** Les données linguistiques sont des *données biologiques (biodata)* — elles portent l'identité et les relations de votre communauté et ne peuvent pas être anonymisées de manière significative — ainsi, les personnes qui les fournissent en détiennent les clés, ainsi que de tout ce qui est évalué par rapport à elles. Le Réseau est fondé sur les [principes de souveraineté des données autochtones](/docs/network/sovereignty/data-sovereignty) :

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

Les garanties qui sous-tendent tout cela sont écrites noir sur blanc et non implicites :
[Gouvernance des données](/docs/network/sovereignty/data-sovereignty) (la position sur la souveraineté des données et les principes CARE, ainsi que ce qu'elle nous interdit de faire) et
[Propriété et conditions](/docs/network/sovereignty/ownership-transfer) (ce qui
se passe, contractuellement, lorsqu'une méthode l'emporte).

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

La constitution de corpus et la révision de traductions constituent un travail professionnel, devant être rémunéré aux
[tarifs publiés](/docs/network/perspectives/how-speakers-get-paid) une fois le financement obtenu
(aucun fonds n'est détenu à ce jour) — et la rémunération n'achète pas vos données. Vous êtes rémunéré pour votre travail *et* vous demeurez
propriétaire de ce que vous créez. Champollion est un projet de recherche non commercial : il
ne vend rien, ne facture rien à l'usage et [ne prélève aucune part](/docs/network/sovereignty/economic-model)
sur ce que votre communauté pourrait percevoir grâce à une méthode qu'elle détient.

### Contrôle

Votre organisation de gouvernance contrôle :
- Qui peut accéder à la méthode
- Si elle peut être utilisée commercialement — et si oui, selon vos conditions, en conservant tout ce qu'elle gagne
- Quand et comment elle est mise à jour
- Quelles données sont utilisées pour un développement ultérieur

---

## Comment s'impliquer

:::tip[Ce que les locuteurs peuvent faire dès aujourd'hui — si la communauté est d'accord]
Champollion ne crée ni n'héberge de corpus — les données de test sont toujours récupérées
depuis leur source. Si des locuteurs de votre communauté souhaitent contribuer des phrases
*dès maintenant*, [Tatoeba](https://tatoeba.org) accepte les contributions
phrase par phrase dans n'importe quelle langue, et des collections ouvertes comme
[OPUS](https://opus.nlpl.eu/) regroupent des textes parallèles à partir desquels le Réseau construit
des benchmarks. Les phrases ajoutées sur ces plateformes peuvent devenir des données d'évaluation ici.

Mesurez d'abord les contreparties : Tatoeba publie les phrases sous une licence libre
(CC BY 2.0 FR par défaut), de sorte que n'importe qui peut les copier — y compris pour entraîner des modèles
d'IA — et les copies déjà réalisées ne peuvent pas être révoquées. Cela peut être le bon
choix pour des phrases du quotidien. Pour tout ce que votre communauté souhaite garder
sous son propre contrôle, conservez vous-mêmes les données et utilisez plutôt un
[jeu de test scellé](/docs/network/sovereignty/run-a-sovereign-contest).
Une application de contribution directe pour les locuteurs ainsi qu'un outil de création de corpus sont prévus, mais pas encore
développés.
:::

1. **Prenez contact** — Ouvrez un ticket sur le [dépôt du Réseau](https://github.com/gamedaysuits/Champollion) ou envoyez un e-mail à [info@champollion.dev](mailto:info@champollion.dev)
2. **Décrivez votre langue** — À quelle famille appartient-elle ? Combien de locuteurs compte-t-elle ? Quels systèmes d'écriture sont utilisés ? Quelles ressources computationnelles existent (FST, dictionnaires, corpus) ?
3. **Commencez modestement** — Même 50 paires de traduction soigneusement sélectionnées suffisent pour créer un jeu de données d'évaluation et ouvrir une nouvelle catégorie dans le classement. Le travail sur le corpus est [rémunéré selon des tarifs publiés](/docs/network/perspectives/how-speakers-get-paid) une fois financé ; aucun fonds n'est détenu à ce jour
4. **Préservez votre propriété** — Enregistrez le corpus sous forme de métadonnées dans la voie de votre choix ([Enregistrement de corpus](/docs/network/sovereignty/registering-corpora)) ; si vous souhaitez que le jeu de test reste totalement secret, le [guide pratique du concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) est la marche à suivre
5. **Mettez-nous en relation avec la gouvernance** — Qui, dans votre communauté, a autorité sur les données linguistiques et la technologie ? Le modèle de souveraineté du Réseau exige un partenaire de gouvernance

---

## Voir aussi

- [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) — le guide pratique pour une évaluation contrôlée par la communauté
- [Modèles de conditions](/docs/network/sovereignty/terms-templates) — des conditions juridiquement simples, axées sur la minimisation de la confiance (trustless), que votre communauté peut adapter, avec les risques de cheval de Troie clairement explicités
- [Gouvernance des données](/docs/network/sovereignty/data-sovereignty) — la position adoptée et les cadres de référence (CARE, Te Mana Raraunga et d'autres instruments de souveraineté des données autochtones) qui l'ont façonnée
- [Propriété et conditions](/docs/network/sovereignty/ownership-transfer) — les conditions par langue et ce qui se passe lorsqu'une méthode l'emporte
- [Comment le travail est financé](/docs/network/sovereignty/economic-model) — les flux financiers au sein d'un projet non commercial
- [Soutenir une langue à faibles ressources](/docs/network/community/low-resource-languages) — contexte technique pour les chercheurs travaillant aux côtés des communautés
