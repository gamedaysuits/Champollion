---
sidebar_position: 8
title: "Spécification du Prix"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Spécification des Prix

Un prix constitue le volet incitatif de l'accord axé sur l'évaluation. Une communauté ou un groupe de recherche constitue un petit ensemble d'évaluation scellé — quelques centaines de paires, chacune étant vérifiée (le [Partenariat de corpus](/docs/network/specifications/corpus-partnership) correspond à ce flux de travail). Un sponsor offre un prix pour l'atteinte d'un score cible sur cet ensemble. À partir de ce moment, la langue représente un défi permanent : tout concepteur de méthode dans le monde peut s'y attaquer, le classement évalue chaque tentative publiquement, et le seuil de réussite est défini par la clé de correction de la communauté elle-même, plutôt que par celui qui se fait le plus entendre. Ce document précise le fonctionnement d'un tel prix — conditions de seuil, processus de réclamation, classes de dépendances et règles — afin que le niveau d'exigence soit sans ambiguïté et indépendant de la méthode lorsqu'un prix est lancé.

Les prix sont **financés et détenus par les sponsors** : l'argent reste auprès de l'organisation sponsor, ou d'une fiducie communautaire désignée par le sponsor — **Champollion ne détient, ne place en séquestre, ni n'achemine jamais les fonds des prix.** Toute communauté ou organisation peut en organiser un de manière autonome via [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest), en conservant son propre corpus et ses propres fonds.

> **Statut : PROPOSÉ — aucun prix n'est ouvert, et rien ici ne peut encore être réclamé.**
> Ce qui conditionne l'*ouverture* d'un prix relève de la mesure : un corpus de référence (gold-standard) approuvé par la communauté, le bac à sable d'évaluation isolé (air-gapped) (spécifié, mais pas encore construit), et l'étape de révision par les locuteurs. Aucun score sur ce site n'a encore franchi le seuil d'un prix. Voir [Limites honnêtes](/docs/network/honest-limitations). Référence des métriques : la [Spécification de notation](/docs/network/specifications/scoring) ; protocole : la [Spécification du benchmark](/docs/network/specifications/benchmark).

---

## Vous souhaitez aider à intégrer une langue au réseau ?

Vous n'avez pas besoin d'attendre un prix. Les actions à plus fort impact que vous pouvez entreprendre aujourd'hui :

- **Commanditer un prix de réussite en traduction automatique.** Financez une barre ciblée — par exemple, une méthode fiable anglais → cri des Plaines. Champollion coordonne la mesure ; les fonds restent auprès de **vous** (votre organisation, ou une fiducie communautaire que vous désignez) et sont attribués selon les conditions de la communauté (voir [Souveraineté des Données](/docs/network/sovereignty/data-sovereignty) et le [Modèle Économique](/docs/network/sovereignty/economic-model)). Le chemin autonome de bout en bout est documenté dans [Gérer un Concours Souverain](/docs/network/sovereignty/run-a-sovereign-contest) ; l'introduction d'une nouvelle paire linguistique commence par un [partenariat de corpus](/docs/network/specifications/corpus-partnership).
- **Coordonner un don de calcul.** Mettez en commun des crédits API / jetons afin que la file d'attente publique puisse cartographier davantage de paires et mettre en évidence où la traduction est — et n'est pas — encore fiable.
- **Soutenir directement les initiatives open-source sur lesquelles nous nous appuyons.** Champollion est une tuyauterie qui relie le travail ouvert d'autres personnes ; les soutenir, c'est soutenir cette carte (nous préférerions vous orienter en amont plutôt que de nous approprier leur travail) :
  - [Tatoeba](https://tatoeba.org) — phrases parallèles contribuées par la communauté
  - [Catalogue des Langues en Danger (ELCat)](https://www.endangeredlanguages.com) — données sur le danger
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — catalogues de langues et typologie
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — les transducteurs morphologiques (FST)
  - [Masakhane](https://www.masakhane.io) — communauté de traduction automatique pour les langues africaines
  - [OPUS](https://opus.nlpl.eu) — corpus parallèles ouverts

> Pour commanditer un prix, organiser un don de calcul, ou discuter d'un partenariat, contactez le projet via [GitHub](https://github.com/gamedaysuits). Les gardiens clés de la communauté sont en cours de confirmation ; aucune nation ou organisation n'est nommée comme partenaire avant d'avoir consenti.

---

## 1. Philosophie

> **L'accord en une ligne : craquez une langue, gagnez, redonnez-la.** Champollion est une opération d'évaluation comparative en apprentissage automatique à dessein — la compétition est la façon dont les paires difficiles se résolvent. Nous invitons les chercheurs en apprentissage automatique et tout constructeur capable à construire la meilleure méthode pour une paire linguistique difficile spécifique, remporter le prix, **et** remettre la méthode résultante à l'organisation de souveraineté qui possède cette langue (§1.3). L'énergie compétitive est réelle, et elle est dirigée vers la mission — faire traduire chaque langue, selon les conditions que son peuple fixe — et non vers l'escalade d'un classement pour son propre compte.

### 1.1 Les Prix Récompensent les Percées, Pas la Participation

L'argent du prix n'est versé que lorsqu'une méthode démontre clairement qu'elle atteint un seuil de capacité défini. Il n'y a pas de prix de participation, de prix pour les finalistes, ni de paiements de consolation. Si personne ne franchit la barre, personne n'est payé. C'est intentionnel — cela signifie que les sponsors ne paient que pour les résultats qui fonctionnent réellement.

### 1.2 La Validation Communautaire Est Non-Négociable

Les métriques automatisées sont des approximations (SCORING_SPEC §1.1). Une méthode peut obtenir un bon score en chrF++ et en acceptation FST tout en produisant un résultat qu'aucun locuteur n'accepterait. **Chaque réclamation de prix nécessite une validation communautaire** — les locuteurs bilingues doivent confirmer que le résultat est utilisable. C'est la porte de validation humaine (BENCHMARK_SPEC §7).

### 1.3 Le Transfert de Propriété Fait Partie de l'Accord

Les méthodes qui réclament un prix sont soumises à la clause de transfert de propriété (BENCHMARK_SPEC §8.3). Le développeur conserve les droits d'attribution et de publication. L'organisation de gouvernance obtient le droit d'utiliser, de modifier, de distribuer et de monétiser la méthode pour sa langue. Ce n'est pas une pénalité — c'est l'objectif. L'argent du prix finance la création de technologie qui appartient à la communauté linguistique.

### 1.4 Anti-Triche

Les seuils des prix sont définis par rapport à l'**évaluation de référence** (ensemble de test secret, exécuté par l'organisation de gouvernance dans un bac à sable). Les développeurs ne voient jamais les données de test. C'est architecturalement appliqué — pas une politique qui repose sur l'honneur. Voir BENCHMARK_SPEC §8.2.

### 1.5 Licences de Corpus : Les Corpus Non-Commerciaux Restent Hors de la Voie des Prix

Certains corpus utilisés lors du développement de méthodes sont sous licences non commerciales — par exemple, le corpus du manuel de langue crie EdTeKLA est sous la licence **CC BY-NC-SA modifiée d'EdTeKLA** (à portée de souveraineté, non commerciale ; le manuel d'origine est sous CC BY-NC-ND 4.0). Ces corpus sont **exclusivement réservés à la voie de recherche/développement** :

1. **Les corpus de référence des prix ne doivent pas intégrer de contenu de corpus sous licence NC.** Les segments de test de référence sont des originaux commandés par la communauté (voir Stratégie de Partenariat de Corpus) — rédigés par des humains pour le prix, avec droits dégagés pour l'évaluation et le déploiement commercial dès le départ.
2. **Une méthode qui réclame un prix ne doit pas intégrer de contenu de corpus sous licence NC** (par exemple, comme données d'entraînement, exemples intégrés, ou tables de consultation). La méthode transférée doit être déployable par l'organisation de gouvernance selon les conditions qu'elle choisit — y compris commercialement, si la communauté le décide (BENCHMARK_SPEC §8.3) ; le contenu sous licence NC à l'intérieur l'empoisonnerait cette liberté.
3. **Les développeurs peuvent librement utiliser des corpus sous licence NC pour développer et auto-évaluer** — c'est à cela que sert la voie de développement. La restriction s'applique à ce qui est soumis et à ce qui est déployé, pas à la façon dont un développeur apprend.

### 1.6 Les Classes de Dépendances Conditionnent l'Admissibilité aux Prix

Toute évaluation de prix se déroule dans un bac à sable (§1.4), et les méthodes gagnantes se transfèrent à l'organisation de gouvernance (§1.3). Les deux faits imposent la même contrainte : **tout ce dont une méthode dépend doit être quelque chose que le développeur a le droit de mettre dans le bac à sable et de transférer à la communauté.** Chaque soumission déclare une classe de dépendance — définie dans la [spécification de l'Interface de Méthode](/docs/network/specifications/methods#method-validity-and-dependency-classes) — et l'admissibilité suit la classe :

| Classe de dépendance | Admissible au prix ? | Conditions |
|----------------------|---------------------|-----------|
| **S** — autonome | ✅ Oui | Aucune au-delà des conditions de seuil dans §2 |
| **O** — externe ouvert (par exemple, FST AGPL miroir à la soumission) | ✅ Oui | Artefacts épinglés et vendus dans la soumission ; les licences permettent le transfert communautaire ; les conditions copyleft préservées (la communauté reçoit les mêmes droits que la licence accorde à tous) |
| **A1** — inférence LLM substitutable | ⚠️ Conditionnel | Modèle déclaré, épinglé et substitutable (doit s'exécuter contre un modèle de poids ouvert hébergé par la communauté) ; l'évaluation acheminée via la passerelle LLM du bac à sable (🔲 planifié — les méthodes A1 ne peuvent pas produire de scores de référence jusqu'à ce que la passerelle soit opérationnelle) ; le transfert transmet la recette complète (invites, entraînement, code), pas le modèle |
| **A2** — API de service/données externe non-substitutable | ❌ Pas encore | Inadmissible jusqu'à ce que le détenteur des droits accorde les permissions d'inclusion dans le bac à sable et de transfert. Autorisé sur le classement ouvert avec un drapeau visible « dépendance externe » |
| **X** — contenu groupé sans droits | ❌ Jamais | Inadmissible dans chaque voie |

La classe d'une méthode est la classe la plus restrictive parmi ses dépendances déclarées. Les dépendances non déclarées de toute classe sont disqualifiantes (§5).

---

## 2. Pools de Prix Proposés (aucun n'est ouvert pour le moment)

### 2.1 Le Prix du Fondateur — EN→Cri des Plaines (nêhiyawêwin)

| Champ | Valeur |
|-------|--------|
| **Pool de prix** | **10 000 $ CAD** (proposé) |
| **Paire linguistique** | Anglais → Cri des Plaines (EN→CRK) |
| **Sponsor prévu** | Fondateur du projet Champollion — un engagement prévu, **aucun fonds n'est détenu nulle part pour le moment.** Lorsqu'engagés, les fonds resteraient auprès du sponsor ou d'une fiducie communautaire désignée — jamais auprès de Champollion. |
| **Statut** | **PROPOSÉ — non ouvert.** N'accepte pas les soumissions. |
| **Ouverture** | Uniquement lorsque le corpus de référence, le bac à sable d'évaluation, et la porte d'examen par les locuteurs existent tous (aucun n'existe pour le moment), et que les fonds du sponsor sont vérifiablement détenus selon §4.2. |
| **Expiration** | Pas d'expiration une fois ouvert. |

#### Conditions de Seuil

Une méthode réclame le Prix du Fondateur en satisfaisant **TOUTES** les conditions suivantes simultanément :

| # | Condition | Métrique | Seuil | Justification |
|---|-----------|----------|-------|---------------|
| 1 | **Score composite** | `composite` (SCORING_SPEC §4) | **≥ 0,80** | Entre Déployable (0,70) et Fluide (0,85). Nécessite une qualité élevée dans toutes les dimensions de métrique — pas seulement la validité morphologique. |
| 2 | **Acceptation FST** | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99%+)** | Effectivement tous les mots de sortie doivent être des formes morphologiquement valides reconnues par le FST GiellaLT. La tolérance de 1% tient compte des cas limites (noms propres, néologismes, emprunts) que le FST peut légitimement ne pas couvrir. C'est la porte de qualité définissante pour la traduction automatique polysynthétique — si le FST rejette plus de 1% des mots, la méthode produit des formes qui n'existent pas dans la langue. Tout l'objectif de ce prix est d'acheter un système qui ne massacre pas les choses. |
| 3 | **chrF++** | `chrf_plus_plus` (SCORING_SPEC §2.1) | **≥ 55,0** | Le chevauchement des n-grammes de caractères doit dépasser 55 sur l'échelle 0–100. Assure la similarité au niveau de la surface avec les traductions de référence, pas seulement la validité morphologique. |
| 4 | **Validation communautaire** | Examen humain (BENCHMARK_SPEC §7) | **≥ 70% « acceptable » ou « excellent »** | Un échantillon stratifié de résultats (≥30 entrées dans les niveaux de difficulté 2–5) est examiné par ≥2 locuteurs bilingues du CRK. Au moins 70% des entrées examinées doivent recevoir une note « acceptable » ou « excellent ». |
| 5 | **Évaluation de référence** | Exécution du bac à sable (BENCHMARK_SPEC §8.2) | **Obligatoire** | Toutes les métriques automatisées doivent être calculées par rapport au segment de corpus `gold_standard`, exécuté par l'organisation de gouvernance dans un environnement en bac à sable. Les scores sur l'ensemble de développement ne comptent pas. |
| 6 | **Reproductibilité** | Correspondance d'empreinte (BENCHMARK_SPEC §3.8) | **±2%** | L'organisation de gouvernance doit pouvoir réexécuter la méthode et atteindre des scores dans les ±2% de la carte d'exécution soumise. |

> **Pourquoi 99+% FST ?** Le problème central de la traduction automatique pour les langues polysynthétiques est l'hallucination — les LLM produisent des chaînes qui *ressemblent* à la langue cible mais sont morphologiquement invalides. Une méthode qui produit 95% de résultats valides a toujours 5% de mots fabriqués — du bruit inacceptable pour tout usage en production. Le seuil de 99%+ exige une hallucination quasi-nulle tout en permettant le cas rare (un nom propre que le FST ne connaît pas, un néologisme légitime). Si une méthode ne peut pas atteindre 99%+ d'acceptation FST, elle n'a pas résolu le problème.
>
> **Pourquoi 0,80 composite ?** Cela se situe entre Déployable (0,70) et Fluide (0,85). Une méthode à 0,80 avec 99%+ d'acceptation FST produit un résultat où pratiquement chaque mot est un vrai mot cri *et* la qualité globale de la traduction est élevée dans les dimensions de surface, structurelle et sémantique. La porte de validation communautaire (condition #4) assure que ce n'est pas juste du jeu de métrique — les locuteurs doivent confirmer que le résultat est véritablement utilisable.

#### Ce Que Ce Seuil Signifie en Pratique

À composite ≥ 0,80 avec FST ≥ 0,99 et chrF++ ≥ 55, un locuteur bilingue verrait généralement :

- **Pratiquement chaque** mot de sortie est un vrai mot cri (FST valide 99%+ — hallucinations de formes quasi-nulles)
- Les catégories grammaticales majeures (personne, nombre, temps) sont correctes dans la plupart des entrées
- L'ordre des mots est généralement naturel
- Le sens est préservé de manière fiable
- Les erreurs restantes sont des erreurs de vraie langue (mauvaise inflexion, obviation incorrecte, erreurs d'animacité) — pas des mots fabriqués
- Un locuteur fluide pourrait utiliser le résultat comme un brouillon de haute qualité et le corriger significativement plus rapidement que de traduire à partir de zéro

C'est un système qui **ne massacre pas la langue.** Il peut ne pas être parfait, mais chaque mot qu'il produit est un vrai mot. C'est la barre minimale pour une traduction automatique respectueuse d'une langue polysynthétique.

---

## 3. Processus de Réclamation du Prix

### 3.1 Soumission

1. Le développeur soumet sa méthode complète et exécutable à l'organisation de gouvernance :
   - Tout le code source
   - Toutes les dépendances (données d'entraînement, dictionnaires, configurations FST, invites)
   - Instructions d'installation et d'exécution
   - Un README décrivant l'approche de la méthode
   - Une carte d'exécution sur l'ensemble de développement montrant les scores approximatifs (pour le pré-filtrage)

2. Le développeur signe les conditions de participation, y compris :
   - Clause de transfert de propriété (BENCHMARK_SPEC §8.3)
   - Déclaration de non-entraînement sur les données d'évaluation
   - Engagement de reproductibilité

### 3.2 Évaluation

1. L'organisation de gouvernance installe et exécute la méthode dans un harnais en bac à sable par rapport au corpus `gold_standard`
2. Les métriques automatisées sont calculées (composite, FST, chrF++, etc.)
3. Si les seuils automatisés sont atteints (conditions 1–3), l'organisation de gouvernance procède à l'examen communautaire
4. Si les seuils automatisés ne sont PAS atteints, le développeur reçoit les scores et les commentaires. Aucun examen communautaire n'est déclenché.

### 3.3 Examen Communautaire

1. Un échantillon stratifié de résultats (≥30 entrées, couvrant les niveaux de difficulté 2–5) est présenté aux locuteurs bilingues
2. Au minimum 2 examinateurs indépendants évaluent chaque entrée
3. Échelle d'évaluation : **rejeter** / **gist** / **acceptable** / **excellent**
4. Si ≥70% des entrées reçoivent « acceptable » ou « excellent » des deux examinateurs, la validation communautaire réussit

### 3.4 Paiement

1. Les 6 conditions sont toutes satisfaites
2. L'organisation de gouvernance confirme le résultat
3. Le prix est payé dans les 30 jours suivant la confirmation
4. La propriété de la méthode se transfère selon BENCHMARK_SPEC §8.3
5. Le résultat est publié sur le classement avec le niveau de vérification « Validé par la Communauté »

### 3.5 Soumissions Multiples

- Le même développeur/équipe peut soumettre plusieurs fois
- Chaque soumission est évaluée indépendamment
- Si une méthode est améliorée et re-soumise, seule la dernière carte d'exécution compte
- Le prix est attribué à la **première** méthode qui franchit tous les seuils — il n'est pas divisé

### 3.6 Soumissions d'Équipe

- Les équipes et les paires Aîné-jeunesse sont admissibles
- La distribution du prix au sein d'une équipe est la responsabilité de l'équipe
- Tous les membres de l'équipe doivent signer les conditions de participation
- L'attribution sur le classement énumère tous les membres de l'équipe

---

## 4. Pools de Prix Futurs {#4-future-prize-pools}

Le Prix du Fondateur est la graine. Des pools de prix supplémentaires sont financés par les sponsors. Chaque nouveau pool de prix est documenté comme une nouvelle sous-section de §2 avec ses propres :

- Montant et devise du prix
- Paire linguistique
- Attribution du sponsor
- Conditions de seuil (qui peuvent différer du Prix du Fondateur)
- Date d'expiration (le cas échéant)
- Toute condition spéciale

### 4.1 Modèle de Prix du Sponsor

Les sponsors financent des pools de prix à tout montant. Niveaux suggérés :

| Niveau | Montant | Seuil Suggéré |
|--------|---------|---------------|
| **Graine** | 5 000–15 000 $ | Déployable (composite ≥ 0,70) + validation communautaire |
| **Percée** | 25 000–50 000 $ | Fluide (composite ≥ 0,85) + validation communautaire |
| **Grand Prix** | 100 000 $+ | Fluide + couverture multi-registre + intégration de déploiement |

Les sponsors peuvent également financer :
- **Primes d'amélioration** — paiement fixe pour chaque amélioration de 5 points en chrF++ par rapport au meilleur actuel
- **Prix de registre** — prix séparés pour des registres spécifiques (formel, cérémoniel, éducatif)
- **Prix de vitesse** — meilleur score ajusté au coût (SCORING_SPEC §6.3)

### 4.2 Où Les Fonds des Prix Sont Détenus

Les fonds des prix sont **détenus par le sponsor** : ils restent auprès de l'organisation commanditaire, ou auprès d'une fiducie communautaire que le sponsor désigne — **jamais auprès de Champollion**, qui coordonne la mesure et ne touche pas l'argent. Un prix crédible publie, avant son ouverture : **qui détient les fonds**, selon quel arrangement (compte organisationnel, fiducie, ou tiers dépositaire du choix du sponsor), et le seuil d'attribution — de sorte que franchir la barre soit vérifiable à partir des scores publiés plus le verdict de validation des locuteurs de la communauté, et qu'un défaut de paiement serait publiquement visible comme tel. Aucun fonds de prix n'est détenu nulle part aujourd'hui. Si un prix devait expirer sans être réclamé, les fonds restent où ils ont toujours été — auprès du sponsor — pour être redirigés ou retirés à la discrétion du sponsor. La mécanique autonome, y compris le risque de défaut du sponsor et ses atténuations, est documentée dans [Gérer un Concours Souverain](/docs/network/sovereignty/run-a-sovereign-contest) et les [Modèles de Conditions](/docs/network/sovereignty/terms-templates).

---

## 5. Disqualification

Une soumission est disqualifiée si :

1. **Entraînement sur les données d'évaluation.** La méthode a été exposée aux entrées du corpus `gold_standard` ou `held_out`. (Architecturalement prévenu par l'exécution en bac à sable — mais si des preuves de contamination sont trouvées, le résultat est annulé.)
2. **Non-reproductible.** L'organisation de gouvernance ne peut pas reproduire les scores dans les ±2%.
3. **Dépendances non déclarées ou inadmissibles.** La méthode nécessite un accès à l'exécution à des services externes au-delà de ce que son manifeste de dépendance déclare, ou sa classe de dépendance effective est A2 ou X (§1.6). L'inférence LLM de classe A1 déclarée acheminée via la passerelle d'évaluation est autorisée ; toute autre dépendance réseau à l'exécution — et toute dépendance non déclarée de toute classe — est disqualifiante.
4. **Conditions de participation non signées.** Tous les membres de l'équipe doivent accepter le transfert de propriété.
5. **Triche détectée.** Le résultat est optimisé pour la métrique plutôt que pour la qualité de traduction (détecté par l'examen communautaire et/ou les vérifications anti-triche selon BENCHMARK_SPEC §9.3).

---

## 6. Relation aux Autres Spécifications

| Ce Document | Références | Pour |
|-------------|-----------|------|
| §2 conditions de seuil | SCORING_SPEC §4 (composite), §2.1–2.2 (métriques), §5 (niveaux) | Définitions de métriques et échelle |
| §2 validation communautaire | BENCHMARK_SPEC §7 | Protocole d'examen humain |
| §3 exécution du bac à sable | BENCHMARK_SPEC §8.2 | Mécanisme de souveraineté |
| §3 transfert de propriété | BENCHMARK_SPEC §8.3 | Conditions de transfert de propriété intellectuelle |
| §1.6 classes de dépendances | Spécification de l'Interface de Méthode ; BENCHMARK_SPEC §8.6 | Définitions de classe, conditions d'admissibilité, politique réseau du bac à sable |
| §4 prix ajustés au coût | SCORING_SPEC §6.3 | Formule ajustée au coût |

---

## 7. Synchronisation Code–Spécification

### 7.1 Source Canonique

Ce document (`cli/website/docs/network/specifications/prize-spec.md`) est la source canonique pour :
- Définitions des pools de prix (§2)
- Conditions de seuil (§2.x)
- Processus de réclamation (§3)
- Règles de disqualification (§5)

### 7.2 Exigences de Mise en Œuvre

Lorsqu'un pool de prix est activé :
1. L'interface utilisateur du classement doit afficher les prix actifs et leurs conditions de seuil
2. Les cartes d'exécution qui satisfont aux seuils automatisés (conditions 1–3) doivent être signalées pour examen communautaire
3. Le champ `quality_tier` dans le schéma de carte d'exécution capture déjà le niveau (« déployable », « fluide »)
4. Aucune nouvelle modification de code du harnais n'est nécessaire — la spécification des prix est une couche de politique au-dessus de la notation existante

---

*Les structures de prix doivent être compatibles avec les conditions de transfert de propriété. Le gagnant peut réclamer le prix, mais la méthode devient la propriété de l'organisation de gouvernance si elle atteint le niveau Déployable. C'est intentionnel — le prix finance la création de technologie qui appartient à la communauté linguistique.*
