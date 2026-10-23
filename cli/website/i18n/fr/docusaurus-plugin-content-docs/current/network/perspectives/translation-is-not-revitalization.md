---
sidebar_position: 1
title: "La traduction n'est pas la revitalisation"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "Ce que la traduction automatique peut et ne peut pas faire pour les langues en danger — énoncé clairement. La TA est une infrastructure pour les communautés linguistiques. Elle ne remplace jamais la communication entre personnes."
related:
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/put-it-to-work
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who decides what happens to language data, and consent before deployment"
---

# La traduction n'est pas la revitalisation

> **Position.** La traduction automatique convertit du texte entre les langues. La revitalisation crée de nouveaux locuteurs. Ce sont des activités différentes avec des critères de succès différents, et aucun score de classement ne change cela. Nous construisons la TA comme une infrastructure qui sert les objectifs d'une communauté — jamais comme un substitut à la transmission intergénérationnelle. Les enfants apprennent la langue auprès de personnes, pas auprès de machines.

En 2026, il est facile de croire que le logiciel peut résoudre n'importe quel problème, y compris une langue qui perd ses locuteurs. Nous voulons être précis sur les raisons pour lesquelles cette croyance est erronée — et sur ce que la technologie de traduction *peut* honnêtement contribuer.

Ce texte existe parce qu'une critique de ce projet, formulée du point de vue d'un linguiste, a fait valoir avec force cet argument : un système parfait de traduction anglais→cri ne résoudrait ni le problème de la transmission (les enfants n'apprenant pas la langue à la maison), ni le problème du prestige (l'anglais en tant que langue du pouvoir économique), ni le problème pédagogique (le manque d'écoles d'immersion et d'enseignants formés). Cela pourrait même aggraver la situation, en créant l'illusion que « l'ordinateur sait parler le cri » et en atténuant l'urgence de la transmission humaine. Nous avons accepté la majeure partie de cette critique, et nous publions notre réponse ici plutôt que de l'enterrer.

---

## Ce que la revitalisation exige réellement

La littérature de recherche sur la revitalisation des langues est cohérente sur un point : les langues survivent lorsqu'elles sont transmises entre les générations — lorsque les parents, les grands-parents et les communautés les parlent aux enfants, et que les enfants grandissent en les parlant en retour (Fishman 1991 ; Hinton & Hale 2001). Tout le reste — les écoles, les médias, les dictionnaires, les applications — soutient cette transmission ou ne soutient rien.

Aucun système de traduction ne participe à cet échange. Un modèle qui convertit un document anglais en cri des Plaines ne crée pas un locuteur. Il ne pourvoit pas une classe d'immersion, ne forme pas un enseignant, et ne s'assoit pas avec un enfant à une table de cuisine. Si notre travail est jamais décrit comme « sauver les langues », cette description est erronée et nous le dirons.

## Ce que la TA ne peut pas faire

Énoncé clairement, pour qu'il n'y ait aucune ambiguïté plus tard :

- **Elle ne peut pas remplacer les locuteurs.** Une production qu'aucun locuteur fluide n'a révisée est un brouillon, non un texte. Nos propres [règles d'évaluation](/docs/network/specifications/scoring) traitent chaque score automatisé comme une approximation ; seule une révision humaine confirme l'utilisabilité.
- **Elle ne peut pas enseigner une langue maternelle.** Les enfants acquièrent une langue par la relation et l'immersion, non par des documents traduits.
- **Elle peut créer une illusion néfaste.** Une démonstration qui « parle » une langue peut laisser penser que celle-ci est hors de danger, alors que ce n'est pas le cas. Ce risque de prestige est réel, et nous le considérons comme une question ouverte à examiner *avec* les communautés, et non comme un élément de langage à gérer.
- **Elle ne peut rien décider.** Savoir si un système de traduction doit exister pour une langue et où il peut être utilisé relève de la décision de la communauté — y compris la décision de ne pas le déployer du tout. Ce contrôle est intégré dans l'architecture de [transfert de propriété](/docs/network/sovereignty/ownership-transfer) et de [souveraineté des données](/docs/your-words-your-rules), et il prend en compte les contextes : une communauté peut accepter la TA pour des documents officiels et la refuser pour du matériel pédagogique.

## Ce que la TA peut honnêtement faire

Sur cette base, il existe des choses concrètes et délimitées que l'infrastructure de traduction contribue — chacune servant les personnes qui font déjà le vrai travail.

**1. Du débit pour les traducteurs surchargés.** Les bureaux de traduction communautaires sont confrontés à davantage de documents qui *devraient* exister dans la langue que ce que les traducteurs humains peuvent produire à partir de zéro. Un brouillon automatique transforme la tâche : au lieu de « tout traduire », il s'agit désormais de « réviser et corriger » — et des études contrôlées ont montré que la post-édition est nettement plus rapide que la traduction à partir de zéro, tout en maintenant ou en améliorant la qualité (Plitt & Masselot 2010 ; Green, Heer & Manning 2013). Nous décrivons ce flux de travail en détail dans [Mettre en œuvre](/docs/put-it-to-work). La nuance : ces études portaient sur des paires de langues à fortes ressources ; nous ne disposons pas encore de preuves équivalentes pour les langues polysynthétiques, ce que ce projet vise précisément, en partie, à mesurer.

**2. Levier pratique pour les droits linguistiques.** Le droit aux services gouvernementaux dans les langues autochtones existe en droit dans plusieurs juridictions. Ce qui manque souvent, c'est la capacité pratique de produire des traductions à la vitesse que la bureaucratie exige. Une communauté qui peut transformer un document politique de cinquante pages en une traduction examinée en jours plutôt qu'en mois est dans une position de négociation plus forte. La technologie ne crée pas le droit ; elle rend le droit plus difficile à ignorer.

**3. Infrastructure linguistique réutilisable.** L'analyseur morphologique (FST) que nous utilisons pour vérifier que la sortie de traduction contient des mots réels — pas des mots hallucinez — encode *pourquoi* chaque forme de mot est valide. Cette même machinerie est la base des outils d'apprentissage : entraîneurs de conjugaison, aides à la rédaction corrigeant les erreurs, explorateurs morphologiques. Le moteur de vérification et le moteur pédagogique sont le même artefact. C'est une voie, pas une promesse — les outils d'apprentissage nécessitent d'être construits, et le fait qu'ils soient construits est une décision communautaire.

**4. Soutien pour les apprenants de langue seconde.** La revitalisation n'est pas seulement les enfants acquérant une première langue. C'est aussi les adultes apprenant comme langue seconde — des personnes qui ne peuvent jamais atteindre une fluidité au niveau des Aînés mais qui peuvent lire les documents communautaires, participer avec compréhension, et augmenter la présence publique de la langue en l'utilisant. Pour cette population, une aide à la traduction est un véritable outil, comme un dictionnaire est un outil.

**5. Une raison pour que le travail soit financé et détenu localement.** Dans notre modèle, les méthodes éprouvées [sont intégralement transférées sous la propriété de la communauté](/docs/network/sovereignty/ownership-transfer), et tout ce qu'une communauté tire d'un actif qu'elle possède lui revient entièrement ([Qui peut l'utiliser et quel en est le coût](/docs/getting-started/who-may-use-this)). Les locuteurs sont [rémunérés pour leur expertise](/docs/working-with-speakers), et non sollicités bénévolement. Rien de tout cela ne relève non plus de la revitalisation — mais cela oriente les ressources vers les personnes qui œuvrent à la revitalisation, plutôt que de les en détourner.

## Le cadrage honnête

Le domaine a un long historique de projets technologiques qui arrivent avec des récits de sauvetage et repartent avec des publications (Bird 2020). Nous essayons de tenir une affirmation plus étroite : **la TA est une infrastructure.** L'infrastructure sert les objectifs fixés par d'autres personnes. Les routes ne décident pas où vous voyagez ; cette technologie ne décide pas si une langue vit. Les locuteurs, les familles et les communautés le font — et le cadrage de la [Décennie internationale des langues autochtones de l'UNESCO](https://idil2022-2032.org/) a raison de placer les peuples autochtones, pas les outils, au centre.

Si une communauté conclut que la technologie de traduction aide ses objectifs, nous voulons que ce soit la meilleure version possible, la plus responsable — possédée par elle, validée par ses locuteurs, déployée selon ses conditions. Si une communauté conclut que cela n'aide pas, cette conclusion est un résultat valide de ce projet, pas un échec de celui-ci. Les deux moitiés de cette phrase sont des engagements.

---

## Ce que cela signifie pour vous

:::info[Si vous êtes membre d'une communauté]
Ce projet ne vous dira pas qu'une application peut sauver votre langue — elle ne le peut pas. Ce qu'il propose est circonscrit : une traduction de documents plus rapide sous la révision de locuteurs fluides, une infrastructure que votre communauté peut posséder pleinement, et une rémunération pour l'expertise des locuteurs. Savoir si et comment ces éléments sont utilisés relève de la décision de votre communauté, y compris la décision de ne pas les utiliser. Voir [Vos mots, vos règles](/docs/your-words-your-rules) et [Signaler les erreurs et s'approprier les corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Si vous êtes chercheur]
Considérez la « TA pour les langues en danger » comme une affirmation d'infrastructure, et non comme une promesse de revitalisation, et votre question d'évaluation change : non pas « le score BLEU est-il élevé ? », mais « cela réduit-il de manière mesurable la charge de travail des personnes effectuant le véritable travail, selon leurs propres conditions ? » C'est dans la [spécification du banc d'essai](/docs/network/specifications/benchmark) et dans [Classement et publication](/docs/reference/leaderboard) que nous nous astreignons à cette exigence.
:::

:::info[Si vous êtes concepteur]
Développez pour le flux de travail de post-édition, et non pour la démonstration. L'utilisateur de votre méthode est un locuteur fluide qui corrige un brouillon, et le pire mode de défaillance réside dans les mots hallucinés qui semblent plausibles aux non-locuteurs — c'est pourquoi la validation morphologique conditionne l'ensemble du processus ici. Commencez par [Soumettre une méthode](/docs/network/getting-started/submit-a-method) et [Mettre en œuvre](/docs/put-it-to-work).
:::

---

## Sources

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Article](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Article](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## Voir aussi

- [Travailler avec les locuteurs](/docs/working-with-speakers) — le modèle de rémunération, en chiffres
- [Mettre en œuvre](/docs/put-it-to-work) — le parcours de post-édition
- [Classement et publication](/docs/reference/leaderboard) — l'architecture complète de la plateforme, y compris le § 8 sur les tensions que nous n'avons pas résolues
