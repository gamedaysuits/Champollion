---
sidebar_position: 5
title: "Prendre en charge une langue peu dotée"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# Prendre en charge une langue à faibles ressources

> **Résumé analytique.** Un guide complet pour concevoir la traduction automatique destinée aux langues peu dotées et polysynthétiques. Couvre les raisons pour lesquelles ces langues sont difficiles (complexité morphologique, rareté des données, hallucination), les ressources informatiques existantes (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), plus de 10 stratégies d'approche, le système d'encadrement (coaching) de champollion et la boucle d'évaluation. Commencez ici si vous souhaitez contribuer à une méthode pour une langue mal desservie.

:::info[Statut : En développement actif]
La prise en charge du cri des plaines (nêhiyawêwin) est actuellement en cours de développement. Les outils, le harnais d'évaluation et le classement décrits ici sont réels et utilisables dès aujourd'hui, mais le pipeline de traduction pour le cri n'a pas encore été publié. Lorsqu'il le sera, il servira de modèle pour d'autres langues polysynthétiques et peu dotées disposant d'une infrastructure FST.
:::

## Le problème non résolu

Le service Cloud Translation de Google répertorie 194 langues ([liste publiée par Google](https://docs.cloud.google.com/translate/docs/languages)). Le modèle OMT-1600 de Meta (mars 2026) revendique une couverture de 1 600 langues — le plus grand système de traduction automatique jamais publié. Mais pour les quelque 1 200 langues de sa longue traîne — selon nos calculs : les 1 600 qu'il couvre moins les plus de 400 dont les auteurs affirment que les modèles les « comprennent suffisamment bien » —, la qualité est inférieure aux seuils d'utilisabilité, les données d'entraînement sont dominées par des textes bibliques, les poids du modèle ne sont pas disponibles au téléchargement, et il n'existe aucune évaluation indépendante ni aucun cadre de gouvernance communautaire. Pour les quelque 5 400 langues restantes, aucun modèle préentraîné ne produit le moindre résultat.

Le paysage a considérablement évolué — les géants de la technologie investissent désormais dans la couverture des langues peu dotées. Mais la couverture n'est pas la qualité, et la qualité sans vérification indépendante n'inspire pas confiance. Les langues peu dotées ont besoin de bien plus qu'un modèle qui prétend les couvrir : elles nécessitent une évaluation indépendante avec une validation morphologique, des corpus constitués par la communauté et une gouvernance respectueuse de la souveraineté.

**champollion a été conçu pour changer cela.**

Le [Classement des méthodes](https://champollion.dev/leaderboard) (Method Leaderboard) est un défi ouvert : concevez la meilleure méthode de traduction pour une langue mal desservie, prouvez-le par une évaluation reproductible et obtenez le meilleur score. N'importe qui dans le monde peut y contribuer — linguistes, chercheurs en apprentissage automatique, travailleurs linguistiques communautaires, étudiants, passionnés. Le problème reste non résolu. L'infrastructure est en place. Le classement vous attend.

---

## Pourquoi est-ce difficile : la morphologie polysynthétique

La plupart des systèmes commerciaux de traduction automatique ont été conçus pour des langues comme l'anglais, le français et le chinois — des langues où les mots sont relativement courts et où les phrases sont construites à partir de jetons (tokens) distincts. Cependant, de nombreuses langues autochtones, dont le cri des plaines, sont **polysynthétiques** : un seul mot peut encoder ce que l'anglais ou le français exprime par une phrase entière.

### L'exemple du cri

Considérez le mot en cri des plaines :

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"quand je suis allé à l'école"*

Il s'agit d'**un seul mot**. Il encode le temps (passé), la direction (aller vers), la racine (apprendre), la voix (passive/réfléchie) et la personne (première du singulier). Un grand modèle de langage (LLM) entraîné principalement sur l'anglais n'a aucune intuition pour ce type de densité morphologique.

Les défis s'accumulent :

| Défi | Signification |
|-----------|--------------|
| **Complexité morphologique** | Une seule racine verbale peut générer des milliers de formes fléchies valides par préfixation, suffixation et circonfixation |
| **Distinction animé/inanimé** | Les noms sont grammaticalement animés ou inanimés — cela affecte la conjugaison des verbes, les démonstratifs et la pluralisation. La classification ne suit pas toujours l'animation biologique (*askiy* « terre » est animé ; *maskisin* « chaussure » est également animé) |
| **Obviation** | Les références à la troisième personne sont classées par proximité/saillance. La distinction entre « proximatif » et « obviatif » n'a pas d'équivalent en français ou en anglais |
| **Rareté des données d'entraînement** | Les LLM ont vu très peu de textes en cri des plaines. Ce qu'ils ont vu peut mélanger des dialectes (dialecte en Y, dialecte en TH) ou des orthographes (SRO contre caractères syllabiques) |
| **Faible base de référence commerciale** | OMT-1600 inclut le CRK au niveau R1 (Très faibles ressources) avec un entraînement sur le domaine biblique et une tokenisation BPE standard. Google Traduction ne prend pas en charge le cri. L'évaluation indépendante avec des métriques morphologiques est ce qui donne du sens à ces bases de référence. |

La traduction des langues polysynthétiques demeure un **problème de recherche ouvert** — OMT-1600 inclut des langues polysynthétiques mais utilise une tokenisation BPE standard (vocabulaire de 256K) sans aucune conscience morphologique, ce qui signifie qu'il déchiquette les mots compositionnels en fragments d'octets dénués de sens.

---

## État de l'art : comment ce problème a été abordé

### Le FST d'ALTLab

La ressource informatique la plus importante pour le cri des plaines est le **transducteur à états finis (FST)** développé par l'[Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) de l'Université de l'Alberta, en collaboration avec [Giellatekno](https://giellatekno.uit.no/) de l'UiT, l'Université arctique de Norvège.

Le FST d'ALTLab est un **analyseur et générateur morphologique** : à partir d'un mot cri fléchi, il peut le décomposer en sa racine et ses balises grammaticales, et à partir d'une racine accompagnée de balises, il peut générer la forme fléchie correcte. Ce processus est déterministe — aucun réseau de neurones, aucune hallucination, aucune probabilité. Si le FST accepte un mot, ce mot est morphologiquement valide.

C'est pourquoi le classement de champollion suit le **Taux d'acceptation FST** (FST Acceptance Rate) comme métrique. Une méthode de traduction qui produit des mots rejetés par le FST génère du cri morphologiquement invalide — peu importe ce qu'indique le score chrF++.

**Ressources clés d'ALTLab :**
- [itwêwina](https://itwewina.altlab.app/) — un dictionnaire intelligent cri des plaines–anglais propulsé par le FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — plateforme open-source de dictionnaire sensible à la morphologie
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — base de données lexicale du cri des plaines
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — le contexte plus large du projet

### Registres morphologiques et FST mondiaux

Le cri des plaines n'est pas la seule langue dotée d'une infrastructure FST de haute qualité. Si vous souhaitez développer des pipelines de traduction pour d'autres langues peu dotées ou morphologiquement complexes, vous pouvez exploiter ces pôles mondiaux établis :

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT, l'Université arctique de Norvège) :** Le plus grand dépôt open-source d'analyseurs et de générateurs morphologiques FST, couvrant plus de 100 langues. Les domaines d'intérêt incluent les langues sames (`sme`, `smj`, `sma`, etc.), les langues ouraliennes (komi, erzya, oudmourte, etc.) et d'autres langues minoritaires/autochtones. Ils hébergent des corpus de textes traités publics (`corpus-xxx`) dans leur [Organisation GitHub](https://github.com/giellalt/).
* **[The Apertium Project](https://www.apertium.org/) :** Une plateforme open-source de traduction automatique basée sur des règles. Apertium maintient des analyseurs morphologiques FST hautement optimisés (utilisant `lttoolbox` et `hfst`) et des dictionnaires bilingues pour des dizaines de langues, y compris un vaste ensemble de langues turciques (kazakh, tatar, kirghize, etc.) et de langues européennes minoritaires. Toutes les ressources sont publiques sur le [GitHub d'Apertium](https://github.com/apertium).
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/) :** Un projet collaboratif fournissant des paradigmes morphologiques standardisés pour plus de 150 langues. Le jeu de données est hébergé sur Hugging Face à l'adresse [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies). Si un binaire FST compilé n'est pas disponible pour une langue, les tables UniMorph peuvent être utilisées comme porte de recherche de base de données statique.
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/) :** Propose des outils pour les langues autochtones canadiennes, notamment l'analyseur morphologique FST inuktitut **Uqailaut** et le vaste **Corpus parallèle du Hansard du Nunavut** (1,3 million de paires de phrases alignées anglais-inuktitut).

### Le corpus EdTeKLA

Le [groupe de recherche EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) (également à l'Université de l'Alberta) a constitué un corpus de la langue crie des plaines à partir de supports éducatifs, de transcriptions audio et de sources communautaires. Le jeu de données d'évaluation de champollion [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) est dérivé de ce travail, publié sous la [licence CC BY-NC-SA modifiée d'EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (conditions non commerciales, axées sur la souveraineté).

### Autres approches essayées ou envisageables

Le classement est agnostique quant à la méthode. Voici des stratégies qui ont été explorées ou proposées pour la traduction automatique à faibles ressources, et qui pourraient toutes être soumises :

| Approche | Fonctionnement | Avantages | Inconvénients |
|----------|-------------|------|------|
| **[Prompting de LLM encadré](/docs/network/tutorials/coached-llm-prompting)** | Injecter des règles de grammaire, des dictionnaires et des paires d'exemples dans le prompt système | Itération rapide, aucun entraînement requis | Plafond de qualité limité par les connaissances de base du LLM |
| **[Prompting few-shot](/docs/network/tutorials/few-shot-prompting)** | Inclure des traductions vérifiées comme exemples en contexte | Bon pour un style cohérent | Fenêtre de contexte restreinte ; les exemples ne doivent PAS provenir des données d'évaluation |
| **[Pipeline validé par FST](/docs/network/tutorials/fst-gated-pipeline)** | Le LLM génère → le FST valide → rejette et réessaie en cas de morphologie invalide | Garantit la validité morphologique | Nécessite une infrastructure FST ; les boucles de réessai ajoutent de la latence et des coûts |
| **[Recherche dans un dictionnaire + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | Forcer les termes connus à partir d'un dictionnaire bilingue, laisser le LLM gérer le reste | Réduit les hallucinations pour les termes connus | La couverture du dictionnaire est toujours incomplète |
| **[Modèle affiné (fine-tuned)](/docs/network/tutorials/fine-tuned-model)** | Affiner un modèle ouvert (Llama, Mistral) sur des textes parallèles — mais pas sur les données d'évaluation | Qualité potentiellement la plus élevée | Nécessite un corpus parallèle (rare) ; coûteux ; risque de surapprentissage (overfitting) |
| **[Modèles enchaînés](/docs/network/tutorials/chained-models)** | Le modèle A génère une traduction brute → le modèle B post-édite → le modèle C évalue | Peut combiner les forces des spécialistes | Complexe ; lent ; coûteux |
| **[Hybride basé sur des règles + LLM](/docs/network/tutorials/rule-based-hybrid)** | Utiliser des règles linguistiques pour les modèles connus, le LLM pour tout le reste | Précis là où les règles s'appliquent | Nécessite une expertise linguistique approfondie |
| **[Augmentation par rétro-traduction](/docs/network/tutorials/back-translation)** | Générer des données parallèles synthétiques en traduisant du cri vers l'anglais, puis s'entraîner sur l'inverse | Élargit les données d'entraînement à moindre coût | Amplifie les erreurs existantes du modèle |
| **[Approche évolutive](/docs/network/tutorials/evolutionary-approach)** | Générer des traductions candidates, les évaluer, muter les plus performantes, répéter | Peut découvrir de nouvelles solutions ; parallélisable | Coûteux en calcul ; nécessite une bonne fonction d'aptitude (fitness function) |
| **[Traduction partielle](/docs/network/tutorials/partial-translation)** | Traduire manuellement un échantillon représentatif, prouver que votre méthode correspond à votre style sur celui-ci, puis traduire automatiquement le reste | Combine la qualité humaine avec l'échelle de la machine | Nécessite un effort humain initial |
| **JSON manuel / notation d'examen** | Créer manuellement un fichier JSON de jeu de données pour tester les réponses des étudiants à un examen de langue, ou noter un lot de traductions humaines par rapport à une référence (gold standard) | Aucun apprentissage automatique requis ; fonctionne pour l'éducation et l'assurance qualité | Ne s'adapte pas aux besoins de traduction continus |

### Ce n'est que du JSON

Le harnais prend du JSON en entrée et produit du JSON évalué en sortie. Le [format du jeu de données](/docs/network/leaderboard/datasets) est simple :

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

Vous pouvez le construire à la main. Vous pouvez l'exporter depuis une feuille de calcul. Vous pouvez le générer à partir d'un corpus. Un professeur de langue pourrait l'utiliser pour noter les traductions de ses étudiants. Une agence de traduction pourrait l'utiliser pour évaluer des pigistes. Un laboratoire de recherche pourrait l'utiliser pour comparer des architectures de modèles. Le harnais ne se soucie pas de la provenance du JSON — il se contente de l'évaluer.

Et parce que le framework de déploiement en production utilise la même interface de plugin, une méthode qui obtient un bon score dans le harnais se déploie sur votre site web avec une seule modification de configuration. **Prouvez-le et utilisez-le.**

Les possibilités sont véritablement infinies. **Si vous avez une idée, concevez-la, exécutez le harnais et soumettez vos scores.**

---

## La place de champollion

champollion fournit la couche d'infrastructure — vous apportez la méthode.

### Le système d'encadrement

La méthode `llm-coached` de champollion vous permet d'injecter des connaissances linguistiques directement dans le prompt du LLM :

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

Les données d'encadrement sont injectées dans chaque prompt de LLM pour la paire `en:crk`, offrant au modèle un contexte linguistique structuré qu'il n'aurait pas autrement. Consultez [Données d'encadrement](https://champollion.dev/docs/concepts/coaching-data) pour les spécifications complètes.

### Registres

Le registre fait partie du prompt système qui oriente le ton, la formalité et les conventions orthographiques. champollion est livré avec un registre pour le cri des plaines :

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

Vous pouvez remplacer cela dans votre configuration pour expérimenter différentes stratégies de prompting :

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

Différents registres produisent différents styles de traduction — et différents scores dans le classement. Chaque soumission enregistre le registre exact et le prompt système utilisés (sous forme de hachage SHA-256 dans la [fiche d'exécution](/docs/network/specifications/run-card)), de sorte que les expériences sont reproductibles.

### Conversion d'écriture

Le cri des plaines s'écrit dans deux systèmes : l'**Orthographe romaine standard (SRO)** et les **Caractères syllabiques autochtones canadiens**. Le pipeline de champollion :

1. Le LLM traduit en SRO (basé sur l'alphabet latin, que les LLM gèrent mieux)
2. La porte de qualité valide la sortie SRO
3. Un convertisseur déterministe transforme le SRO → Caractères syllabiques
4. Le texte converti est écrit sur le disque

Le convertisseur gère tous les signes diacritiques SRO (ê, î, ô, â pour les voyelles longues) et les associe aux caractères syllabiques corrects. Consultez [Convertisseurs d'écriture](https://champollion.dev/docs/concepts/script-converters) pour les détails techniques.

### La boucle d'évaluation

Le [harnais d'évaluation](/docs/network/specifications/harness) exécute votre méthode sur le jeu de données d'évaluation et produit une [fiche d'exécution](/docs/network/specifications/run-card) notée :

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

L'indicateur `--name` est une étiquette que vous choisissez. Il apparaît dans le classement afin que les utilisateurs puissent voir quelle stratégie de prompt vous avez utilisée. Le harnais enregistre le prompt système complet dans la fiche d'exécution, de sorte que votre approche exacte est reproductible.

:::tip[Expérimentez librement, soumettez votre meilleur résultat]
Le harnais est conçu pour une itération rapide. Exécutez des dizaines d'expériences avec différents modèles, données d'encadrement, registres et conditions. Ne soumettez au classement que lorsque vous avez un résultat dont vous êtes fier.
:::

---

## Principes de souveraineté des données {#data-sovereignty-principles}

champollion est conçu pour soutenir la souveraineté des données autochtones. La propriété, le contrôle, l'accès et la possession communautaires des données linguistiques guident notre approche des technologies linguistiques pour les communautés autochtones :

| Principe | Comment champollion le soutient |
|-----------|------------------------|
| **Propriété** (Ownership) | Les communautés linguistiques sont propriétaires de leurs données linguistiques. champollion ne communique jamais avec l'extérieur et ne transmet aucune donnée à nos serveurs |
| **Contrôle** (Control) | La [méthode API](https://champollion.dev/docs/guides/serving-a-method) permet aux communautés d'héberger leur propre pipeline de traduction — nous fournissons l'interface, elles contrôlent l'implémentation |
| **Accès** (Access) | Les communautés décident qui peut utiliser leur méthode. L'API peut être restreinte par une authentification |
| **Possession** (Possession) | Toutes les données de traduction restent dans le système de fichiers de votre projet. Le [système de provenance](https://champollion.dev/docs/concepts/security) suit l'origine de chaque traduction |

L'architecture par plugins signifie qu'une communauté peut concevoir une méthode qui intègre des connaissances sacrées ou restreintes en interne, n'exposer que l'API de traduction et conserver un contrôle total sur ses ressources linguistiques.

---

## La vision : les prochaines étapes

Le cri des plaines est la première cible. Une fois le pipeline validé et la communauté satisfaite de la qualité, la même architecture s'étendra à d'autres langues polysynthétiques dotées d'une infrastructure FST :

- **Autres langues algonquiennes** : cri des bois, cri des marais, ojibwé, pied-noir
- **Langues inuites** : inuktitut, inuinnaqtun (qui utilisent également des écritures syllabiques)
- **Autres familles de langues** : toute langue disposant d'un analyseur FST peut utiliser le pipeline validé par FST

Le classement est défini par paire de langues. À mesure que de nouveaux jeux de données d'évaluation sont fournis par les communautés linguistiques, de nouvelles catégories de classement s'ouvrent automatiquement.

**Ceci est une invitation ouverte.** Si vous travaillez avec une langue peu dotée — en tant que chercheur, membre de la communauté, étudiant ou simplement en tant que personne concernée —, champollion vous donne les outils pour concevoir quelque chose de concret, le mesurer honnêtement et le partager avec le monde. Le [Classement des méthodes](https://champollion.dev/leaderboard) attend votre soumission.

---

## Voir aussi

- **[Classement des méthodes](https://champollion.dev/leaderboard)** — soumettez vos scores et comparez les méthodes
- **[Évaluation de la TA](/docs/network/leaderboard/rules)** — ce qui fait une bonne méthode, ce qui entraîne une disqualification
- **[Harnais d'évaluation](/docs/network/specifications/harness)** — comment mener des expériences
- **[Jeux de données d'évaluation](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 et FLORES+
- **[Données d'encadrement](https://champollion.dev/docs/concepts/coaching-data)** — comment structurer les connaissances linguistiques pour le LLM
- **[Convertisseurs d'écriture](https://champollion.dev/docs/concepts/script-converters)** — le pipeline SRO→Caractères syllabiques
- **[Servir une méthode via API](https://champollion.dev/docs/guides/serving-a-method)** — héberger une traduction contrôlée par la communauté
- **[ALTLab](https://altlab.ualberta.ca/)** — l'Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — le groupe de recherche Educational Technology, Knowledge & Language
- **[Dictionnaire itwêwina](https://itwewina.altlab.app/)** — dictionnaire cri des plaines–anglais propulsé par FST

