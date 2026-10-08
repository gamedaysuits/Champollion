---
sidebar_position: 2
title: "FAQ"
related:
  - label: "How It Works"
    to: /docs/network/how-it-works
    kind: doc
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Glossary"
    to: https://champollion.dev/glossary
    kind: glossary
    note: "Plain-language definitions for every technical term"
---

# Questions fréquemment posées

> **Résumé exécutif.** Réponses aux questions courantes sur le Champollion Network — comment fonctionne la notation, ce qui entraîne une disqualification, comment gérer les langues sans FST, recommandations de modèles et de paramètres, et le processus de soumission.

---

## Notation et métriques

### Quelles métriques le harness calcule-t-il ?

La métrique principale, et le seul chiffre qui classe une exécution, est le **chrF++ de corpus** avec son intervalle de confiance à 95 %. À ses côtés, le banc d'évaluation rapporte les autres métriques standard — **BLEU, spBLEU et TER**, ainsi que **COMET** lorsqu'il est installé — chacune individuellement, sans jamais les combiner. Tout le reste relève du **diagnostic** : rapporté séparément pour éclairer un score, sans jamais en faire partie. Le tableau ci-dessous présente le chrF++ et les principaux diagnostics ; trois sont indépendants de la langue et deux reposent actuellement sur des greffons spécifiques au cri des plaines (CRK) et seront généralisés au fur et à mesure de l'ajout de nouvelles langues. Les corpus de référence exécutables actuels sont des jeux de données publics sous licence libre — Global Voices, Tatoeba, TICO-19, IN22, SMOL, entre autres (voir [Jeux de données](/docs/network/leaderboard/datasets)) — et le tableau de classement est ouvert aux soumissions pour chaque paire enregistrée. Le cri des plaines est simplement la langue pour laquelle les deux métriques spécifiques à la langue (adossées à un FST) ont été implémentées en premier.

| Métrique | Échelle | Ce qu'elle mesure | État |
|----------|---------|-------------------|------|
| **chrF++** (métrique principale) | 0–100 | Chevauchement de n-grammes de caractères entre les traductions prédites et de référence, calculé sur l'ensemble du corpus avec sacreBLEU (sa signature est enregistrée). La métrique de surface standard pour les langues à morphologie riche. | ✅ Toutes les langues |
| **Correspondance exacte** (diagnostic) | 0.0–1.0 | Proportion d'entrées où la prédiction correspond exactement à la référence après normalisation. | ✅ Toutes les langues |
| **Acceptation FST** (diagnostic) | 0.0–1.0 | Proportion de mots en sortie acceptés par un transducteur à états finis (analyseur morphologique). Calculée uniquement lorsqu'un binaire FST est fourni. | ✅ Toutes les langues avec FST |
| **Correspondance équivalente** (diagnostic) | 0.0–1.0 | Fraction d'entrées correspondant à la référence ou à une variante acceptable — tenant compte de l'ordre des mots, des conventions orthographiques et des variations dialectales. | ⚡ CRK (en cours de généralisation) |
| **Score sémantique** (diagnostic) | 0.0–1.0 | Score de préservation du sens — dans quelle mesure la traduction restitue-t-elle le sens visé, indépendamment de la forme de surface ? | ⚡ CRK (en cours de généralisation) |

D'autres diagnostics — **précision morphologique**, **alternance codique**, **respect de la terminologie**, **hallucination** et **style d'écriture** — ainsi que l'état d'implémentation de chaque métrique se trouvent dans la [Spécification de l'évaluation §2](/docs/network/specifications/scoring#2-metric-inventory), l'inventaire complet des métriques.

### Comment une exécution est-elle évaluée ?

Chaque nouvelle exécution est évaluée selon le standard d'évaluation `standard/1`, conformément aux pratiques de publication de l'évaluation en TA (WMT, FLORES-200, AmericasNLP) :

- **Métrique principale :** chrF++ de corpus, indiqué avec son intervalle de confiance bootstrap à 95 % et sa signature sacreBLEU — par exemple `chrF++ 47.5 [45.9, 49.0]`.
- **À ses côtés :** BLEU, spBLEU, TER et COMET lorsqu'il est calculé. Jamais combinés.
- **Diagnostics :** correspondance exacte, acceptation FST, précision morphologique, alternance codique, hallucination, terminologie, style d'écriture. Rapportés séparément ; ils ne classent jamais une exécution.
- **Mises en garde sur le score :** affichées juste à côté de la métrique principale lorsque le banc d'évaluation détecte un motif rendant le chiffre trompeur.

Déterminer si une exécution est **meilleure** qu'une autre se décide par un test de significativité apparié sur chrF++ (`mt-eval compare --significance`), et non en comparant deux chiffres. Règles complètes : [Comment les exécutions sont évaluées](/docs/network/specifications/scoring#how-runs-are-scored) et la [Spécification de significativité](/docs/network/specifications/significance).

### Qu'est-il advenu du score composite et des niveaux de qualité ?

Tous deux ont été **abandonnés** pour les nouvelles exécutions. Le composite était une combinaison pondérée de chrF++, de correspondance exacte, d'acceptation FST et d'autres signaux, et les niveaux (Baseline → Fluent) étaient des labels qui en découlaient. Plusieurs de ses composantes ne comparent jamais la sortie à la source ou à la référence, de sorte qu'un système pouvait obtenir la majeure partie du score sans traduire : un modèle anglais→same du Nord non entraîné qui répétait une unique phrase valide pour chaque entrée a obtenu 0,6244 — étiqueté « fonctionnel » — avec un chrF++ de 5,5. Les nouvelles fiches d'exécution publient `composite: null` et `quality_tier: null`.

Les fiches publiées avant l'introduction de ce standard conservent leur composite enregistré et restent vérifiables ; lorsqu'il est affiché, il porte la mention **composite hérité (abandonné)**. Voir [pourquoi le composite a été abandonné](/docs/network/specifications/scoring#why-the-composite-was-retired).

Un score automatique n'est pas un verdict sur la qualité. Seule une évaluation humaine par des locuteurs de la langue en certifie la qualité.

### Que sont les niveaux de vérification ?

Les **niveaux de vérification** indiquent *qui a validé le résultat*, et non sa qualité intrinsèque :

| Niveau de vérification | Signification |
|-------------------|---------------|
| **Auto-évalué** | L'auteur de la soumission a exécuté le banc d'évaluation lui-même. Les scores sont plausibles mais non vérifiés. |
| **Vérifié par Champollion** | Un mainteneur a reproduit le résultat à l'aide de la configuration de méthode soumise. |
| **Validé par la communauté** | Des locuteurs bilingues de la langue cible, qualifiés selon le propre protocole de la communauté, ont examiné un échantillon stratifié de la sortie (≥30 entrées, ≥2 évaluateurs) et ≥70 % ont satisfait aux exigences de la communauté. Attribué uniquement par les tests menés par la communauté ; une rétrogradation lors d'un audit ponctuel est symétrique et tout aussi publique. |

Une exécution peut présenter un chrF++ élevé tout en restant au niveau « Auto-évalué » — ce qui signifie que personne n'a confirmé indépendamment le score, et qu'aucun locuteur n'a évalué le résultat.

---

## Soumission et disqualification

### Qu'est-ce qui entraîne la disqualification de ma soumission ?

Votre soumission sera rejetée ou signalée si :

1. **Votre méthode a été exposée aux données d'évaluation.** Si vous avez entraîné, affiné, utilisé des invites few-shot ou autrement utilisé des entrées de l'ensemble de données d'évaluation, vos scores sont artificiellement gonflés. Cela inclut l'utilisation des traductions de référence dans votre invite.
2. **Votre carte d'exécution échoue les vérifications d'intégrité.** L'empreinte doit correspondre à la configuration. Les cartes d'exécution falsifiées sont rejetées.
3. **Votre méthode n'implémente pas le protocole TranslationMethod.** Le harness s'attend à `translate(entries, config) → results`. Les intégrations personnalisées qui contournent le harness ne sont pas acceptées.

### Puis-je soumettre plusieurs fois ?

Oui. Le classement suit toutes les soumissions. Vous pouvez itérer — exécuter des dizaines d'expériences, soumettre uniquement la meilleure. Chaque soumission enregistre une empreinte unique, il n'y a donc aucune ambiguïté sur la soumission qui a produit quel score.

### Comment faire vérifier mon score ?

1. **Auto-évalué :** Chaque soumission commence ici, et aujourd'hui, chaque ligne du tableau s'y trouve encore.
2. **Vérifié par Champollion :** Le projet réévalue vos sorties soumises par rapport au corpus de référence verrouillé par SHA à l'aide de la métrique du banc d'évaluation. Lorsque votre score est reproduit, l'exécution passe au statut Vérifié par Champollion — le niveau utilisé par défaut dans les classements de concours, et le seul éligible à un prix ; le tableau public liste également les lignes auto-évaluées, étiquetées comme telles. Si le score n'est pas reproduit ou si une référence enregistrée a été modifiée, l'exécution est disqualifiée. La réévaluation est un traitement par lots manuel effectué par les mainteneurs : rien ne l'exécute à la soumission, et rien ne la planifie de façon automatique.
3. **Validé par la communauté :** Des locuteurs bilingues de la langue cible, qualifiés selon le protocole de la communauté elle-même, examinent un échantillon stratifié des sorties de votre méthode — au moins 30 entrées, au moins 2 évaluateurs — et au moins 70 % doivent satisfaire au niveau d'exigence de la communauté. Ce niveau est accordé uniquement à la suite de tests menés par la communauté elle-même, à sa discrétion, et peut être révoqué de la même manière : un audit ponctuel échoué rétrograde la méthode tout aussi publiquement. Cela ne peut pas être automatisé — cela exige une implication de la communauté.

### Pourquoi ne réexécutez-vous pas la méthode de chacun pour la vérifier ?

Parce que nous n'en avons ni les moyens financiers ni le besoin. La réévaluation des sorties soumises de *tout le monde* ne coûte rien (cela permet de détecter les scores saisis à la main ou modifiés). En revanche, réexécuter réellement un modèle représente un coût de calcul bien réel ; cela se ferait donc sur un **échantillon** sélectionné par un **audit pondéré par la réputation** — la politique d'échantillonnage est développée et testée, mais le moteur de réexécution qu'elle doit piloter ne l'est pas encore, de sorte qu'aucune réexécution échantillonnée n'a encore été déclenchée et qu'une exécution sélectionnée est enregistrée avec le statut *L2-pending*. Dans le cadre de cette politique, une exécution est systématiquement sélectionnée si elle présente un enjeu élevé (elle établit la première passerelle vers toute une famille de langues) ou si elle est anormale (un bond trop beau pour être vrai par rapport au record précédent), tandis que les contributeurs confirmés ne font que rarement l'objet de vérifications ponctuelles. La réputation ne s'acquiert qu'en réussissant ces audits (ou lorsqu'un contributeur indépendant corrobore vos résultats) — jamais par le volume —, de sorte que des identités éphémères créées pour l'occasion n'y gagnent rien. Une seule falsification avérée remet à zéro la réputation d'un contributeur, déclenche un nouvel audit de l'ensemble de son historique vérifié, et est consignée publiquement, à l'image d'une rétractation. Nous **ne** prétendons **pas** que votre exécution « est passée par le banc d'évaluation » — pour du calcul auto-hébergé, ce n'est pas vérifiable côté serveur — ; la validité repose donc sur *reproductibilité + mise en jeu de la réputation + corroboration*, et non sur une attestation. Consultez les [règles d'évaluation de la TA](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) pour le modèle complet.

### L'API de soumission est-elle en direct ?

Pas encore. Le point de terminaison `https://champollion.dev/api/leaderboard/submit` est aspirationnel. Le chemin de soumission actuel est `mt-eval publish` — il télécharge une carte d'exécution du répertoire de sortie du harnais (`eval/logs/harness/`) directement sur le leaderboard en tant que *auto-évalué (non vérifié)*.

---

## Modèles et paramètres

### Quel modèle dois-je utiliser ?

Il n'y a pas de meilleur modèle unique — cela dépend de la paire de langues, de votre budget et de votre approche. Conseils généraux :

| Type de langue | Point de départ recommandé | Pourquoi |
|---------------|---------------------------|-----|
| **Haute ressource** (français, espagnol, japonais) | `google/gemini-2.5-flash` ou `gpt-4o-mini` | Rapide, bon marché, ligne de base solide |
| **Basse ressource avec une certaine couverture LLM** (quechua, yoruba) | `google/gemini-2.5-pro` ou `anthropic/claude-sonnet-4` | Les modèles plus grands ont une meilleure connaissance latente |
| **Polysynthétique / très basse ressource** (cri des Plaines, inuktitut) | `google/gemini-2.5-pro` avec coaching | Les données de coaching importent plus que le choix du modèle. OMT-1600 inclut certaines langues polysynthétiques (par exemple, CRK au niveau R1) mais avec une tokenisation BPE standard — benchmarkez-le comme ligne de base dans le Network. |

Le harnais d'évaluation utilise OpenRouter, donc n'importe quel modèle disponible sur OpenRouter peut être évalué. Consultez [openrouter.ai/models](https://openrouter.ai/models) pour la liste des modèles disponibles.

### Quelle température dois-je utiliser ?

Inférieur est généralement meilleur pour la traduction :

| Température | Effet | Recommandé pour |
|-------------|--------|-----------------|
| **0,0 – 0,2** | Sortie hautement déterministe et cohérente | Méthodes de production, benchmarks finaux |
| **0,3 – 0,5** | Certaines variations, occasionnellement plus créatif | Exploration, itération précoce |
| **0,6+** | Variation élevée, imprévisible | Non recommandé pour le benchmarking MT |

La température est enregistrée dans la carte d'exécution, donc différentes températures produisent différentes empreintes — elles sont traitées comme des expériences différentes.

### Les données de coaching aident-elles ?

Oui, significativement — pour les langues basse ressource. Les données de coaching (règles de grammaire, entrées de dictionnaire, notes de style) sont injectées dans l'invite système du LLM. Pour le cri des Plaines, les méthodes coachées surpassent systématiquement les méthodes LLM brutes pour les langues polysynthétiques car les LLM à usage général ont une exposition polysynthétique limitée et aucune conscience morphologique. Même OMT-1600, qui a été spécifiquement entraîné pour CRK, utilise une tokenisation BPE standard qui ne peut pas représenter la morphologie polysynthétique structurellement. Les données de coaching fournissent le contexte linguistique que le modèle n'a pas.

Pour les langues haute ressource (français, espagnol), le coaching a moins d'impact car le modèle a déjà une connaissance de base solide.

Voir [Données de coaching](https://champollion.dev/docs/concepts/coaching-data) pour la spécification complète.

---

## FST et validation morphologique

### Que faire s'il n'y a pas de FST pour ma langue ?

Beaucoup de langues ne disposent pas d'un transducteur à états finis. Ce n'est pas un problème — le banc d'évaluation fonctionne sans. La métrique principale reste chrF++ dans les deux cas, de sorte que les exécutions avec ou sans FST sont évaluées de la même manière ; l'acceptation FST est un diagnostic, et elle est marquée `null` dans la fiche d'exécution lorsqu'aucun FST n'a été utilisé.

Les principaux registres pour les FST existants :

| Registre | Couverture | URL |
|----------|------------|-----|
| **GiellaLT** | Plus de 100 langues — les langues sames, le cri, l'inuktitut et de nombreuses autres langues ouraliennes et minoritaires | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Cri des plaines, tsuut'ina, odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 paires de langues, principalement européennes | [apertium.org](https://apertium.org/) |
| **UniMorph** | Paradigmes morphologiques pour plus de 150 langues | [unimorph.github.io](https://unimorph.github.io/) |

### Puis-je construire un FST ?

Oui, mais ce n'est pas trivial. Un FST encode les règles morphologiques d'une langue — toutes les formes de mots valides. En construire un nécessite une connaissance linguistique approfondie de la langue. Si vous avez accès à une grammaire morphologique (par exemple, d'un département de linguistique), elle peut être compilée en FST en utilisant des outils comme [HFST](https://hfst.github.io/) ou [Foma](https://fomafst.github.io/).

### Comment fonctionne le gating FST en pratique ?

Le pipeline avec gating FST fonctionne comme ceci :

1. Le LLM génère une traduction
2. Chaque mot de la sortie est vérifié par rapport au FST
3. Les mots que le FST rejette sont signalés comme morphologiquement invalides
4. La méthode peut réessayer avec rétroaction (« le mot X n'est pas valide, réessayez »)
5. Après les tentatives, les mots invalides restants sont enregistrés

Le taux d'acceptation FST mesure combien de mots passent la validation. Voir le [Tutoriel du pipeline avec gating FST](/docs/network/tutorials/fst-gated-pipeline) pour un exemple complet travaillé.

---

## Données et ensembles de données

### Puis-je contribuer un ensemble de données pour une nouvelle langue ?

Oui. Exigences minimales de [Spécification de benchmark §11](/docs/network/specifications/benchmark#11-extending-to-new-languages) :

- **50 entrées d'or standard** (source + traduction de référence vérifiée)
- **30 entrées de développement** (peuvent chevaucher l'or standard pour les petits corpus)
- **Consentement communautaire** (pour les langues autochtones, autorisation explicite d'un organisme de gouvernance)
- **Documentation de provenance** (d'où proviennent les données, quelle licence s'applique)

Les nouveaux ensembles de données ouvrent automatiquement de nouvelles pistes de classement. Voir [Pour les communautés linguistiques](/docs/network/community/for-language-communities) pour le guide du contributeur.

### Quel format mon ensemble de données doit-il avoir ?

JSON avec les noms de champs canoniques :

```json
{
  "name": "my-language-dev-v1",
  "language_pair": "en-xxx",
  "segment": "development",
  "version": "1.0",
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "[translation in target language]",
      "difficulty": 1,
      "domain": "general"
    }
  ]
}
```

Voir [Ensembles de données](/docs/network/leaderboard/datasets) pour le schéma complet et les définitions des niveaux de difficulté.

---

## Souveraineté et propriété

### Qui possède une méthode construite pour une langue autochtone ?

Pour les langues autochtones, une méthode qui satisfait aux critères d'un prix — son seuil automatisé et la validation communautaire par des locuteurs — déclenche le processus de [transfert de propriété](/docs/network/sovereignty/ownership-transfer) selon le modèle standard. La propriété du code est transférée du chercheur à l'organisation de gouvernance de la communauté linguistique.

Le chercheur conserve :
- Les droits de publication (articles académiques sur la méthode)
- Le crédit sur le classement
- Le droit d'appliquer les mêmes *techniques* à d'autres langues

L'organisme de gouvernance obtient :
- La propriété complète du code de la méthode et des données de coaching
- Le contrôle du déploiement (quand, où, comment) — et tout ce qu'un déploiement génère. Champollion est non commercial et ne prend aucune part

### Puis-je utiliser champollion pour les langues non autochtones sans aucune préoccupation de souveraineté ?

Oui. Pour les langues standard (français, japonais, espagnol, etc.), il n'y a aucune considération de souveraineté. Utilisez champollion normalement — traduisez, synchronisez, publiez comme vous le souhaitez. Le cadre de souveraineté s'applique spécifiquement aux langues autochtones et gouvernées par une communauté pour lesquelles les principes de gouvernance des données — propriété et contrôle communautaires des données linguistiques, CARE, Te Mana Raraunga — exigent une attention particulière.

---

## Voir aussi

- **[Comment ça marche](https://champollion.dev/how-it-works)** — l'explication complète de la solution
- **[Spécification de notation](/docs/network/specifications/scoring)** — la source unique de vérité pour toute la logique de notation (métriques, poids, niveaux)
- **[Spécification de benchmark](/docs/network/specifications/benchmark)** — protocole d'évaluation, format de corpus, souveraineté
- **[Soumettre une méthode](/docs/network/getting-started/submit-a-method)** — guide de démarrage rapide étape par étape
- **[Règles du classement](/docs/network/leaderboard/rules)** — critères de soumission
- **[Intendance des données](/docs/network/sovereignty/data-sovereignty)** — les corpus restent avec leurs intendants ; chaque licence respectée
