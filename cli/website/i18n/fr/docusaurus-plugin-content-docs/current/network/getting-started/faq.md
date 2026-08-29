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

Le harnais calcule cinq métriques. Trois sont indépendantes de la langue et fonctionnent pour n'importe quelle paire de langues ; deux reposent actuellement sur des modules externes spécifiques au CRK et seront généralisées à mesure que nous étendrons à d'autres langues. Les corpus de référence exécutables actuels sont des ensembles publics sous licence ouverte — Global Voices, Tatoeba, TICO-19, IN22, SMOL, et autres (voir [Datasets](/docs/network/leaderboard/datasets)) — et le leaderboard est ouvert aux soumissions pour chaque paire enregistrée. Le cri des Plaines est simplement le lieu où les deux métriques spécifiques à la langue (basées sur FST) ont d'abord été implémentées.

| Métrique | Échelle | Ce qu'elle mesure | Statut |
|--------|--------|-----------------|--------|
| **chrF++** | 0–100 | Chevauchement des n-grammes de caractères entre les traductions prédites et de référence. Meilleure métrique de surface pour les langues morphologiquement riches. Utilise la notation native de sacrebleu. | ✅ Toutes les langues |
| **Correspondance exacte** | 0,0–1,0 | Proportion d'entrées où la prédiction correspond exactement à la référence après normalisation. | ✅ Toutes les langues |
| **Acceptation FST** | 0,0–1,0 | Proportion de mots de sortie acceptés par un transducteur à états finis (analyseur morphologique). Calculée uniquement lorsqu'un binaire FST est fourni. | ✅ Toutes les langues avec FST |
| **Correspondance équivalente** | 0,0–1,0 | Fraction d'entrées correspondant à la référence ou à une variante acceptable — tenant compte de l'ordre des mots, de la convention orthographique et des différences dialectales. | ⚡ CRK (généralisation en cours) |
| **Score sémantique** | 0,0–1,0 | Score de préservation du sens — dans quelle mesure la traduction capture-t-elle le sens prévu indépendamment de la forme de surface ? | ⚡ CRK (généralisation en cours) |

Des métriques supplémentaires sont prévues : **précision morphologique**, **détection du code-switching**, **respect de la terminologie** et **détection des hallucinations**. Voir [Spécification de notation §2](/docs/network/specifications/scoring#2-metric-inventory) pour l'inventaire complet des métriques (six catégories).

### Comment le score composite est-il calculé ?

Le composite est une moyenne pondérée des métriques disponibles, normalisée à une échelle 0,0–1,0. Les poids sont définis dans deux profils :

- **Profil A** (langues avec FST) : 9 métriques, les métriques structurelles (FST + précision morphologique) représentent 40 % du poids composite
- **Profil B** (langues sans FST) : 8 métriques, le sémantique et chrF++ ont un poids égal au sommet

Lorsqu'une métrique n'est pas disponible, son poids est redistribué proportionnellement entre les métriques restantes. Cela signifie que les benchmarks en phase précoce (avec seulement chrF++ et correspondance exacte disponibles) produisent toujours des composites valides — les poids effectifs reflètent simplement ce qui est disponible.

**Les tableaux de poids complets, les règles de normalisation et la justification des exclusions se trouvent dans [Spécification de notation §4](/docs/network/specifications/scoring#4-composite-score).** Le code du harness reflète ces tableaux dans `mt_eval_harness/scoring.py`. chrF++ est normalisé en divisant par 100 avant la pondération ; les taux de code-switching et d'hallucination sont inversés (inférieur = meilleur).

### Que sont les niveaux de qualité ?

Les niveaux de qualité sont des étiquettes heuristiques mappées à des plages de scores composites. Ils aident à communiquer ce qu'un score *signifie* pratiquement :

| Niveau | Plage composite | Interprétation |
|------|----------------|----------------|
| **Baseline** | 0,00 – 0,30 | Qualité insuffisante. La méthode nécessite une amélioration significative. |
| **Émergent** | 0,30 – 0,50 | Montre des promesses. Certaines traductions sont correctes mais incohérentes. |
| **Fonctionnel** | 0,50 – 0,70 | Utilisable comme référence avec révision humaine. Non adapté au déploiement sans révision. |
| **Déployable** | 0,70 – 0,85 | Prêt pour une utilisation en production avec révision périodique. Déclenche l'admissibilité au transfert de propriété. |
| **Fluide** | 0,85 – 1,00 | Qualité quasi native. Adapté au déploiement sans supervision. |

### Quelle est la différence entre les niveaux de qualité et les niveaux de vérification ?

**Les niveaux de qualité** décrivent *ce que le score automatisé signifie* (Baseline → Fluide). **Les niveaux de vérification** décrivent *qui a validé le résultat* :

| Niveau de vérification | Signification |
|-------------------|---------------|
| **Auto-évalué** | Le contributeur a exécuté le banc d'évaluation (harness) lui-même. Les scores sont plausibles mais non vérifiés. |
| **Vérifié par Champollion** | Un mainteneur a reproduit le résultat en utilisant la configuration de la méthode soumise. |
| **Validé par la communauté** | Des locuteurs bilingues de la langue cible, qualifiés selon le propre protocole de la communauté, ont examiné un échantillon stratifié des résultats (≥ 30 entrées, ≥ 2 évaluateurs) et ≥ 70 % ont satisfait au niveau d'exigence de la communauté. Attribué uniquement par les propres tests de la communauté ; la rétrogradation par audit ponctuel est symétrique et tout aussi publique. |

Une méthode peut être de qualité « Déployable » mais seulement « Auto-benchmarkée » en vérification — ce qui signifie que le score semble excellent mais personne ne l'a confirmé indépendamment.

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

1. **Auto-évalué (automatique) :** Toute soumission commence ici.
2. **Vérifié par Champollion (automatique) :** Le serveur recalcule les scores de vos résultats soumis par rapport au corpus de référence verrouillé par SHA avec la métrique du banc d'évaluation. Lorsque votre score est reproduit, l'exécution est promue au niveau Vérifié par Champollion — le seul niveau classé par le tableau de classement. Si le score ne peut être reproduit, ou si une référence stockée a été altérée, l'exécution est disqualifiée.
3. **Validé par la communauté :** Des locuteurs bilingues de la langue cible, qualifiés selon le propre protocole de la communauté, examinent un échantillon stratifié des résultats de votre méthode — au moins 30 entrées, au moins 2 évaluateurs — et au moins 70 % doivent atteindre le niveau d'exigence de la communauté. Ce niveau est attribué uniquement par les tests que la communauté mène elle-même, à sa discrétion, et peut être révoqué de la même manière : un audit ponctuel échoué rétrograde la méthode de manière tout aussi publique. Cela ne peut pas être automatisé — cela nécessite l'engagement de la communauté.

### Pourquoi ne réexécutez-vous pas la méthode de tout le monde pour la vérifier ?

Parce que nous n'en avons ni les moyens ni le besoin. Le serveur recalcule gratuitement les scores des résultats soumis par *tout le monde* (ce qui permet de détecter les scores saisis manuellement ou modifiés). Réexécuter réellement un modèle coûte de la véritable puissance de calcul, nous le faisons donc sur un **échantillon** choisi par **audit pondéré par la réputation** : une exécution est toujours réexécutée si l'enjeu est élevé (elle établit le premier pont vers toute une famille de langues) ou si elle est anormale (un bond en avant trop beau pour être vrai par rapport au meilleur résultat précédent), et pour les contributeurs confirmés, elle est rarement soumise à des contrôles ponctuels. La réputation s'acquiert uniquement en réussissant ces audits (ou si un contributeur indépendant corrobore votre résultat) — jamais par le volume — de sorte que les nouvelles identités jetables n'y gagnent rien. Une falsification découverte réduit à zéro la réputation d'un contributeur, déclenche un nouvel audit de tout son historique vérifié et est enregistrée publiquement, comme une rétractation. Nous ne prétendons **pas** que votre exécution « est passée par le banc d'évaluation » — pour la puissance de calcul auto-hébergée qui n'est pas vérifiable par le serveur — la validité repose donc sur la *reproductibilité + l'enjeu de réputation + la corroboration*, et non sur une attestation. Consultez les [règles d'évaluation de la TA](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) pour le modèle complet.

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

De nombreuses langues n'ont pas de transducteur à états finis. C'est OK — le harness fonctionne sans. Le score composite utilise les poids du profil B (voir [Spécification de notation §4.3](/docs/network/specifications/scoring#43-weight-tables)) qui décalent le poids vers les métriques sémantiques et de surface. L'acceptation FST est marquée comme `null` dans la carte d'exécution.

Les principaux registres pour les FST existants :

| Registre | Couverture | URL |
|----------|----------|-----|
| **GiellaLT** | Plus de 100 langues — les langues sames, le cri, l'inuktitut, et de nombreuses autres langues ouraliennes et minoritaires | [giellalt.uit.no](https://giellalt.uit.no/) |
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

Pour les langues autochtones, les méthodes qui atteignent le niveau Déployable (composite ≥ 0,70) ET passent la validation communautaire déclenchent le processus de [transfert de propriété](/docs/network/sovereignty/ownership-transfer). La propriété du code est transférée du chercheur à l'organisme de gouvernance de la communauté linguistique.

Le chercheur conserve :
- Les droits de publication (articles académiques sur la méthode)
- Le crédit sur le classement
- Le droit d'appliquer les mêmes *techniques* à d'autres langues

L'organisme de gouvernance obtient :
- La propriété complète du code de la méthode et des données de coaching
- Le contrôle du déploiement (quand, où, comment) — et tout ce qu'un déploiement génère. Champollion est non commercial et ne prend aucune part

### Puis-je utiliser champollion pour les langues non autochtones sans aucune préoccupation de souveraineté ?

Oui. Pour les langues standard (français, japonais, espagnol, etc.), il n'y a aucune considération de souveraineté. Utilisez champollion normalement — traduisez, synchronisez, publiez comme vous le souhaitez. Le cadre de souveraineté s'applique spécifiquement aux langues autochtones et gouvernées par la communauté où les principes de gouvernance des données — la propriété et le contrôle communautaires des données linguistiques, CARE, Te Mana Raraunga — nécessitent une considération particulière.

---

## Voir aussi

- **[Comment ça marche](https://champollion.dev/how-it-works)** — l'explication complète de la solution
- **[Spécification de notation](/docs/network/specifications/scoring)** — la source unique de vérité pour toute la logique de notation (métriques, poids, niveaux)
- **[Spécification de benchmark](/docs/network/specifications/benchmark)** — protocole d'évaluation, format de corpus, souveraineté
- **[Soumettre une méthode](/docs/network/getting-started/submit-a-method)** — guide de démarrage rapide étape par étape
- **[Règles du classement](/docs/network/leaderboard/rules)** — critères de soumission
- **[Intendance des données](/docs/network/sovereignty/data-sovereignty)** — les corpus restent avec leurs intendants ; chaque licence respectée

