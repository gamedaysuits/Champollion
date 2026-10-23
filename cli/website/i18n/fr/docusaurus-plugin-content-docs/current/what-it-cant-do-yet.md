---
title: "Ce qu'il ne peut pas encore faire"
slug: /what-it-cant-do-yet
description: "En toute franchise, en des termes simples : votre premier traducteur sera modeste, un modèle fonctionnel demande beaucoup de phrases, et aucun outil ne peut promettre la qualité — seulement vous permettre de savoir où vous en êtes."
---

# Ce qu'il ne peut pas encore faire

Votre premier traducteur sera probablement un **recueil de phrases**. Il sera efficace avec les phrases similaires à celles à partir desquelles il a appris, et hésitant face à toute nouveauté. C'est normal : chaque projet commence ainsi.

Ce qui le fait progresser, c'est l'ajout de phrases — les bons types de phrases, vérifiées par une personne qui parle la langue. À chaque itération, les outils vous indiquent s'il s'est réellement amélioré et suggèrent ce qui serait le plus utile pour la suite. Cette page vous expose clairement ce à quoi vous attendre en cours de route.

## Obtenir un traducteur fonctionnel nécessite beaucoup de phrases

Combien ? Nous ne le savons pas encore pour une véritable langue. Voici ce que nous savons.

Nous avons conçu une langue d'entraînement afin qu'un ordinateur puisse vérifier chaque réponse : environ 2 000 mots, une grammaire parfaitement régulière, des données propres. Un traducteur entraîné sur un ordinateur portable a ensuite traduit de nouvelles phrases du quotidien qu'il n'avait jamais vues, et un ordinateur a vérifié si chacune d'elles correspondait exactement au sens de la phrase en anglais :

- après 6 400 phrases d'exemple, **environ 79 sur 100** étaient parfaitement exactes ;
- après 25 600, **environ 96 sur 100**.

Chaque phrase contenant un mot qu'il n'avait jamais vu s'est révélée erronée — soit environ un tiers de ses échecs à 6 400 exemples ; le reste relevait d'une grammaire qu'il n'avait pas encore apprise. C'est la première chose à savoir : **un traducteur ne peut pas traduire un mot qu'il n'a jamais appris.** C'est pourquoi les outils vous le signalent : lorsqu'une phrase contient un mot que votre traducteur n'a jamais rencontré lors de son apprentissage, ils précisent de quel mot il s'agit — cette ligne est très probablement incorrecte, quelle que soit la fluidité apparente du texte.

Une langue réelle est bien plus riche que notre langue d'entraînement : beaucoup plus de mots du quotidien, des termes aux sens multiples, une grammaire qui exprime des aspects que l'anglais laisse sous-entendus. Ces chiffres constituent donc un seuil minimal, non une estimation. Une langue réelle nécessitera davantage de phrases, et nous ignorons encore combien de plus. Nous procédons actuellement à ces mesures.

Ce que cela représente en temps : nous n'avons pas encore mesuré le temps requis par un locuteur réel. Si la rédaction ou la vérification d'une phrase prenait environ une minute, 6 400 phrases représenteraient une centaine d'heures. En répartissant le travail au sein d'une famille ou d'une classe, à raison d'une heure ou deux par semaine chacun, le volume s'accumule — et un petit traducteur se révèle utile pour vos phrases les plus courantes bien avant d'atteindre ce seuil. Le document [Combien de phrases faut-il ?](/docs/how-many-sentences) approfondit cette question.

## Il ne peut garantir un traducteur de qualité — seulement vous permettre de le savoir

Un score mesure à quel point le traducteur se rapproche de la formulation d'un locuteur. Une traduction de qualité formulée différemment peut recevoir un score faible, tandis qu'une traduction fluide mais incorrecte peut obtenir un score assez élevé. C'est pourquoi la vérification des ébauches par un locuteur importe davantage que n'importe quel chiffre.

De plus, un score ne vaut que pour des phrases semblables à celles sur lesquelles il a été mesuré, et sur un petit nombre de phrases, il demeure approximatif — les outils affichent une plage de valeurs, non un chiffre unique. Il ne peut pas vous indiquer si la *prochaine* phrase produite par le traducteur sera exacte. C'est à un locuteur compétent qu'il revient de décider de ce qui est prêt à être utilisé.

## Personne n'a encore mené une langue réelle jusqu'au bout du processus

Nous avons parcouru chaque étape du cadre à de nombreuses reprises, avec des langues inventées et différents assistants d'IA, depuis un dossier vide jusqu'à un traducteur utilisable dans votre navigateur. Lors de nos derniers essais — des assistants d'IA aidant une famille fictive —, plus de la moitié ont échoué à un moment donné. Nous avons corrigé ces étapes et poursuivons les tests.

Aucune communauté n'a encore mené une langue réelle jusqu'à un traducteur fonctionnel sur ce cadre. Si vous commencez maintenant, vous faites partie des pionniers.

## Certains éléments ne sont pas encore prêts

- **Les outils pas-à-pas arriveront avec la prochaine version.** D'ici là, ces pages décrivent leur fonctionnement futur. [Avant de commencer](/docs/before-you-begin) présente ce que vous pouvez faire dès aujourd'hui.
- **Permettre à des tiers d'évaluer des traducteurs sur vos phrases** — sans jamais les voir — fonctionne, mais n'est pas encore intégré au cadre. Aujourd'hui, cela implique de suivre un manuel plus détaillé.
- **Votre ordinateur a son importance.** Un Mac récent (M1 ou ultérieur) doté de 16 Go de mémoire, ou un ordinateur dont la carte graphique NVIDIA dispose de 16 Go de mémoire dédiée, peut construire le type de traducteur le plus performant ; avec 8 Go, une version plus légère, qui n'a pas encore été testée sur une machine de 8 Go. Sous Windows, les outils d'entraînement requièrent WSL (l'environnement Linux intégré de Windows). Les autres ordinateurs construisent un modèle beaucoup plus modeste, dont les performances sont restées nettement en retrait lors de nos tests.
- **Les cycles d'entraînement mobilisent l'ordinateur.** La plupart des cycles poursuivent l'apprentissage à partir du traducteur existant plutôt que de repartir de zéro, mais avec le traducteur le plus robuste, un cycle peut néanmoins durer plusieurs heures, et un seul traducteur peut être entraîné à la fois sur un ordinateur donné.
- **Privilégiez des phrases courtes.** Le traducteur le plus performant ne lit qu'une longueur limitée de phrase — encore moins si votre langue utilise son propre alphabet. Les outils dénombrent les phrases trop longues et vous les signalent afin que vous puissiez les scinder.
- **L'orthographe n'est pas vérifiée automatiquement.** Si la langue s'écrit de plusieurs manières, convenez d'une norme commune pour le projet avant de commencer.

## Il ne peut empêcher toutes les fuites

Pour les fichiers conservés sur cet ordinateur — l'option par défaut —, les outils ne transmettent à votre assistant d'IA que des totaux, jamais les phrases elles-mêmes. Cependant, un assistant ayant accès à votre ordinateur peut ouvrir n'importe quel fichier auquel vous avez vous-même accès, qu'on le lui demande ou non, et la plupart envoient ce qu'ils lisent à l'entreprise qui les exploite.
[Vos mots, vos règles](/docs/your-words-your-rules) explique la marche à suivre.

## Un traducteur n'est pas une langue vivante

Un traducteur peut soutenir un programme linguistique, une école ou une famille. La langue vit à travers ses locuteurs et son usage quotidien.
[Traduire ne signifie pas revitaliser](/docs/network/perspectives/translation-is-not-revitalization) développe ce point.

---

Ces limites évolueront au fil de nos travaux. Dès qu'une limite sera franchie, cette page sera mise à jour.

**Suivant :** [Avant de commencer →](/docs/before-you-begin)

## Approfondir

- [Les garde-fous, un par un](/docs/guardrails) — fonctionnement de chaque vérification.
- [Les limites techniques](/docs/network/honest-limitations) — ce que les mesures couvrent ou non, les niveaux de confiance des scores publiés, la garde des tests scellés, et la raison pour laquelle aucun indice de confiance n'est fourni par phrase.
- À propos des chiffres obtenus avec la langue d'entraînement : une seule exécution par taille d'échantillon, la dispersion entre exécutions n'est donc pas mesurée. L'expression « parfaitement exacte » renvoie à un contrôle automatisé de chaque composante du sens — verbe, temps, personne, négation, sujet, objet, etc. — par rapport à la grammaire propre à cette langue inventée, et non au jugement d'un évaluateur humain. Le traducteur était un modèle préentraîné au niveau de l'octet, affiné sur un ordinateur portable Apple Silicon. La durée d'entraînement influe considérablement sur le résultat (le même modèle avec 6 400 phrases a obtenu environ 27 sur 100 avec un quart du temps d'entraînement) ; il ne s'agit donc pas de plafonds infranchissables. À 6 400 phrases, environ 9 traductions sur 100 étaient fluides, comprenaient de vrais mots, mais exprimaient un sens différent. Le modèle plus petit qu'utilisent les outils sur d'autres ordinateurs n'a atteint qu'environ 6 réponses exactes sur 100 à 6 400 phrases.
- Le traducteur le plus performant lit au maximum 320 octets d'une phrase — soit environ 100 caractères syllabiques, dans la mesure où les lettres accentuées et les caractères d'autres alphabets occupent chacun de deux à quatre octets. L'entraînement comptabilise les paires dépassant la limite avant de les tronquer, et le traducteur en service indique ce qui a été coupé.
