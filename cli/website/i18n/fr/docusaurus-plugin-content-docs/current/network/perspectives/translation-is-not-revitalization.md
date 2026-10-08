---
sidebar_position: 1
title: "La traduction n'est pas la revitalisation"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "Ce que la traduction automatique peut et ne peut pas faire pour les langues en danger — énoncé clairement. La TA est une infrastructure pour les communautés linguistiques. Elle ne remplace jamais la communication entre personnes."
related:
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/network/perspectives/from-benchmark-to-daily-use
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Data-sovereignty principles, CARE, and consent before deployment"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# La traduction n'est pas la revitalisation

> **Position.** La traduction automatique convertit du texte entre les langues. La revitalisation crée de nouveaux locuteurs. Ce sont des activités différentes avec des critères de succès différents, et aucun score de classement ne change cela. Nous construisons la TA comme une infrastructure qui sert les objectifs d'une communauté — jamais comme un substitut à la transmission intergénérationnelle. Les enfants apprennent la langue auprès de personnes, pas auprès de machines.

En 2026, il est facile de croire que le logiciel peut résoudre n'importe quel problème, y compris une langue qui perd ses locuteurs. Nous voulons être précis sur les raisons pour lesquelles cette croyance est erronée — et sur ce que la technologie de traduction *peut* honnêtement contribuer.

Ce texte existe parce qu'une linguiste que nous avons invitée à critiquer ce projet a formulé l'argument avec force : un système de traduction parfait anglais→cri ne résoudrait pas le problème de transmission (les enfants n'apprenant pas la langue à la maison), le problème de prestige (l'anglais comme langue du pouvoir économique), ou le problème pédagogique (pas assez d'écoles d'immersion et d'enseignants formés). Cela pourrait même aggraver les choses, en créant l'illusion que « l'ordinateur peut parler le cri » et en atténuant l'urgence de la transmission humaine. Nous avons accepté la majeure partie de cette critique, et nous publions notre réponse ici plutôt que de la cacher.

---

## Ce que la revitalisation exige réellement

La littérature de recherche sur la revitalisation des langues est cohérente sur un point : les langues survivent lorsqu'elles sont transmises entre les générations — lorsque les parents, les grands-parents et les communautés les parlent aux enfants, et que les enfants grandissent en les parlant en retour (Fishman 1991 ; Hinton & Hale 2001). Tout le reste — les écoles, les médias, les dictionnaires, les applications — soutient cette transmission ou ne soutient rien.

Aucun système de traduction ne participe à cet échange. Un modèle qui convertit un document anglais en cri des Plaines ne crée pas un locuteur. Il ne pourvoit pas une classe d'immersion, ne forme pas un enseignant, et ne s'assoit pas avec un enfant à une table de cuisine. Si notre travail est jamais décrit comme « sauver les langues », cette description est erronée et nous le dirons.

## Ce que la TA ne peut pas faire

Énoncé clairement, pour qu'il n'y ait aucune ambiguïté plus tard :

- **Elle ne peut pas remplacer les locuteurs.** Un résultat qu'aucun locuteur courant n'a examiné est un brouillon, pas un texte. Nos propres [règles de notation](/docs/network/specifications/scoring) traitent chaque score automatisé comme un proxy ; seul l'examen humain confirme l'utilisabilité.
- **Elle ne peut pas enseigner une première langue.** Les enfants acquièrent la langue par la relation et l'immersion, pas par des documents traduits.
- **Elle peut créer une illusion nuisible.** Une démonstration qui « parle » une langue peut suggérer que la langue est sûre alors qu'elle ne l'est pas. Ce risque de prestige est réel, et nous le traitons comme une question ouverte à examiner *avec* les communautés, pas comme un argument à gérer.
- **Elle ne peut rien décider.** Le fait qu'un système de traduction devrait exister pour une langue, et où il peut être utilisé, est l'affaire de la communauté — y compris la décision de ne pas le déployer du tout. Ce contrôle est intégré dans l'architecture de [transfert de propriété](/docs/network/sovereignty/ownership-transfer) et de [souveraineté des données](/docs/network/sovereignty/data-sovereignty), et il inclut les contextes : une communauté pourrait accepter la TA pour les documents officiels et la refuser pour les matériels de classe.

## Ce que la TA peut honnêtement faire

Sur cette base, il existe des choses concrètes et délimitées que l'infrastructure de traduction contribue — chacune servant les personnes qui font déjà le vrai travail.

**1. Débit pour les traducteurs surchargés.** Les bureaux de traduction communautaires font face à plus de documents qui *devraient* exister dans la langue que les traducteurs humains ne peuvent en produire à partir de zéro. Un brouillon machine change le travail de « traduire tout » à « examiner et corriger » — et les études contrôlées ont trouvé la post-édition significativement plus rapide que la traduction à partir de zéro, avec une qualité maintenue ou améliorée (Plitt & Masselot 2010 ; Green, Heer & Manning 2013). Nous décrivons ce flux de travail en détail dans [De l'évaluation à l'utilisation quotidienne](/docs/network/perspectives/from-benchmark-to-daily-use). La réserve : ces études couvraient des paires de langues à ressources élevées ; nous n'avons pas encore de preuves équivalentes pour les langues polysynthétiques, ce qui fait partie de ce que ce projet est conçu pour mesurer.

**2. Levier pratique pour les droits linguistiques.** Le droit aux services gouvernementaux dans les langues autochtones existe en droit dans plusieurs juridictions. Ce qui manque souvent, c'est la capacité pratique de produire des traductions à la vitesse que la bureaucratie exige. Une communauté qui peut transformer un document politique de cinquante pages en une traduction examinée en jours plutôt qu'en mois est dans une position de négociation plus forte. La technologie ne crée pas le droit ; elle rend le droit plus difficile à ignorer.

**3. Infrastructure linguistique réutilisable.** L'analyseur morphologique (FST) que nous utilisons pour vérifier que la sortie de traduction contient des mots réels — pas des mots hallucinez — encode *pourquoi* chaque forme de mot est valide. Cette même machinerie est la base des outils d'apprentissage : entraîneurs de conjugaison, aides à la rédaction corrigeant les erreurs, explorateurs morphologiques. Le moteur de vérification et le moteur pédagogique sont le même artefact. C'est une voie, pas une promesse — les outils d'apprentissage nécessitent d'être construits, et le fait qu'ils soient construits est une décision communautaire.

**4. Soutien pour les apprenants de langue seconde.** La revitalisation n'est pas seulement les enfants acquérant une première langue. C'est aussi les adultes apprenant comme langue seconde — des personnes qui ne peuvent jamais atteindre une fluidité au niveau des Aînés mais qui peuvent lire les documents communautaires, participer avec compréhension, et augmenter la présence publique de la langue en l'utilisant. Pour cette population, une aide à la traduction est un véritable outil, comme un dictionnaire est un outil.

**5. Une raison pour que le travail soit financé et possédé localement.** Dans notre modèle, les méthodes éprouvées [se transfèrent à la propriété communautaire](/docs/network/sovereignty/ownership-transfer) purement et simplement, et tout ce qu'une communauté gagne d'un actif qu'elle possède lui appartient entièrement ([comment le travail est financé](/docs/network/sovereignty/economic-model)). Les locuteurs sont [payés pour leur expertise](/docs/network/perspectives/how-speakers-get-paid), pas invités à la bénévolat. Rien de cela n'est non plus la revitalisation — mais cela dirige les ressources vers les personnes qui font la revitalisation, au lieu de les en éloigner.

## Le cadrage honnête

Le domaine a un long historique de projets technologiques qui arrivent avec des récits de sauvetage et repartent avec des publications (Bird 2020). Nous essayons de tenir une affirmation plus étroite : **la TA est une infrastructure.** L'infrastructure sert les objectifs fixés par d'autres personnes. Les routes ne décident pas où vous voyagez ; cette technologie ne décide pas si une langue vit. Les locuteurs, les familles et les communautés le font — et le cadrage de la [Décennie internationale des langues autochtones de l'UNESCO](https://idil2022-2032.org/) a raison de placer les peuples autochtones, pas les outils, au centre.

Si une communauté conclut que la technologie de traduction aide ses objectifs, nous voulons que ce soit la meilleure version possible, la plus responsable — possédée par elle, validée par ses locuteurs, déployée selon ses conditions. Si une communauté conclut que cela n'aide pas, cette conclusion est un résultat valide de ce projet, pas un échec de celui-ci. Les deux moitiés de cette phrase sont des engagements.

---

## Ce que cela signifie pour vous

:::info[Si vous êtes un membre de la communauté]
Ce projet ne vous dira pas qu'une application peut sauver votre langue — elle ne le peut pas. Ce qu'il offre est limité : une traduction de documents plus rapide sous révision de locuteurs courants, une infrastructure que votre communauté peut posséder entièrement, et une rémunération pour l'expertise des locuteurs. La question de savoir si et comment l'un ou l'autre sera utilisé relève de la décision de votre communauté, y compris la décision de ne pas l'utiliser. Consultez [Pour les communautés linguistiques](/docs/network/community/for-language-communities) et [Signaler les erreurs et posséder les corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Si vous êtes un chercheur]
Traitez « la TA pour les langues en danger » comme une affirmation d'infrastructure, non comme une affirmation de revitalisation, et votre question d'évaluation change : non pas « le score BLEU est-il élevé ? » mais « cela réduit-il mesurément la charge de travail des personnes qui font le vrai travail, selon leurs conditions ? » La [spécification de référence](/docs/network/specifications/benchmark) et [Comment cela fonctionne §8 (Tensions et limitations)](/docs/network/how-it-works#8-tensions-and-limitations) sont l'endroit où nous nous tenons à cette norme.
:::

:::info[Si vous êtes un développeur]
Construisez pour le flux de travail de post-édition, non pour la démonstration. L'utilisateur de votre méthode est un locuteur courant corrigeant un brouillon, et le pire mode de défaillance est les mots hallucinez qui semblent plausibles pour les non-locuteurs — c'est pourquoi la validation morphologique contrôle tout ici. Commencez par [Soumettre une méthode](/docs/network/getting-started/submit-a-method) et [De la référence à l'utilisation quotidienne](/docs/network/perspectives/from-benchmark-to-daily-use).
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

- [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid) — le modèle de compensation, en chiffres
- [De l'évaluation à l'utilisation quotidienne](/docs/network/perspectives/from-benchmark-to-daily-use) — la voie de la post-édition
- [Comment cela fonctionne](/docs/network/how-it-works) — l'architecture complète de la plateforme, y compris §8 sur les tensions que nous n'avons pas résolues
