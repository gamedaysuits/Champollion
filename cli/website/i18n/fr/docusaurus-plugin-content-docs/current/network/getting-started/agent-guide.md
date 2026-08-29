---
sidebar_position: 3
title: "Guide de l'agent : Développement et évaluation sur le réseau"
description: "Comment les agents IA peuvent développer des méthodes de traduction, évaluer leurs performances et les soumettre au classement."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Agent Guide: Using champollion"
    to: https://champollion.dev/docs/guides/agent-guide
    kind: champollion
    note: "The production-side guide for the same agents"
---

# Guide de l'agent : Développement et évaluation sur le réseau

Le réseau Champollion (Champollion Network) est une infrastructure ouverte permettant de créer des ensembles de tests de traduction fiables et d'évaluer toute méthode par rapport à ceux-ci, qu'elle soit humaine ou automatique. Vous n'avez rien à « gagner » : chaque méthode que vous développez et évaluez ajoute un point à une carte partagée indiquant qui peut traduire quoi, avec quelle qualité, et où se situent encore les lacunes. Développez une méthode, évaluez-la de manière reproductible sur des corpus réels et contribuez à compléter cette carte. Les méthodes performantes — et que les communautés choisissent de déployer — peuvent passer en production, générant ainsi des revenus pour la communauté linguistique qu'elles servent.

:::tip[Pourquoi est-ce important ?]
Le plus grand service de traduction commercial, Cloud Translation de Google, répertorie 194 langues. Le modèle OMT-1600 de Meta en revendique 1 600 de plus — mais pour les quelque 1 200 langues de sa longue traîne (selon nos calculs : 1 600 moins les plus de 400 langues que les auteurs déclarent comme étant « suffisamment bien comprises » par les modèles), la qualité n'est pas vérifiée par une évaluation indépendante et les poids du modèle ne sont pas disponibles. Le réseau fournit l'infrastructure de test indépendante. Si votre méthode fonctionne, elle peut passer en production pour des langues où aucune traduction automatique (MT) vérifiée de manière indépendante n'existe.
:::

---

## Configuration de l'environnement

```bash
# Create a virtual environment (do NOT install into global Python)
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

**Clé API** — le banc d'essai (harness) utilise OpenRouter pour appeler les modèles LLM. Configurez votre clé :

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."

# Option 2: .env file (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Obtenez une clé sur [openrouter.ai/keys](https://openrouter.ai/keys). Les modèles du niveau gratuit (free-tier) fonctionnent pour l'expérimentation.

---

## Exécuter votre premier benchmark

```bash
# Run a baseline LLM against a registered evaluation corpus
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Or specify a model explicitly
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
```

Le banc d'essai produit un **journal d'exécution** (run log) — un fichier JSON enregistré dans `eval/logs/` contenant chaque traduction, chaque score de métrique et une empreinte cryptographique liant les résultats à la configuration exacte de l'expérience.

**Flags utiles :**

| Flag | Description |
|------|-------------|
| `-m <model>` | Identifiant (slug) du modèle OpenRouter (séparés par des virgules pour des exécutions parallèles multi-modèles) |
| `-n, --name <name>` | Étiquette lisible par l'homme pour votre exécution (apparaît sur le classement) |
| `--temperature <float>` | Température d'échantillonnage (plus basse = plus déterministe) |
| `--batch-size <n>` | Entrées par appel API (par défaut : 25) |
| `--dry-run` | Valider la configuration sans effectuer d'appels API |
| `--ids 0,1,2,3` | Exécuter uniquement des identifiants d'entrée spécifiques |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash,claude-sonnet-4,gpt-4.1

# Dry run to validate config
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --dry-run
```

Autres commandes : `mt-eval test <log.json>` (évaluer une exécution terminée), `mt-eval compare <log1> <log2>` (comparer des exécutions), `mt-eval dashboard <logs/*.json>` (générer un tableau de bord HTML), `mt-eval list models --live` (parcourir les modèles disponibles).

---

## Développer votre propre méthode

Le banc d'essai accepte toute classe Python implémentant le protocole `TranslationMethod` :

```python
from mt_eval_harness.config import RunConfig

class YourMethod:
    """Build whatever you want inside. The harness only sees this interface."""

    async def translate(
        self,
        entries: list[dict],
        config: RunConfig,
    ) -> list[dict]:
        """
        Args:
            entries: [{"id": 1, "source": "Hello"}, ...]
            config:  RunConfig with source_locale, target_locale, model, etc.

        Returns: one result dict per entry, each containing:
            - id: int          — entry ID from the corpus
            - predicted: str   — the translated text
            - latency_s: float — time taken in seconds
            - usage: dict      — token usage {prompt_tokens, completion_tokens}
            - error: str|None  — error message if failed
            - metadata: dict   — any process-specific metadata
        """
        results = []
        for entry in entries:
            # Your translation logic here — LLM prompting, FST pipeline,
            # dictionary lookup, fine-tuned model, anything.
            translated = await self._my_translate(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translated,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 20},
                "error": None,
                "metadata": {"method": "my-custom-pipeline"},
            })
        return results
```

**Typage structurel** — votre classe n'a pas besoin d'hériter de quoi que ce soit. Si elle possède la bonne signature de méthode `translate`, elle fonctionnera. Cela signifie que les pipelines existants peuvent être adaptés avec un simple wrapper (encapsuleur).

**L'intégrer au banc d'essai :**

```python
import asyncio
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run

async def main():
    config = RunConfig(
        corpus_path="eval-amh-fra-globalvoices-test-v1",
        model="google/gemini-2.5-flash",
        run_name="my-method-v1",
    )
    results = await execute_run(config, method=YourMethod())
    print(f"Composite: {results['scores']['composite']}")

asyncio.run(main())
```

---

## Idées de méthodes

Chacune d'entre elles dispose d'un guide pratique (cookbook) complet avec des conseils d'implémentation :

| Approche | Description | Guide pratique |
|----------|-------------|---------|
| **Pipeline filtré par FST** | La validation morphologique détecte ce que les LLM manquent | [Tutoriel](/docs/network/tutorials/fst-gated-pipeline) |
| **LLM coaché** | Injecter des règles de grammaire et des dictionnaires dans les prompts | [Tutoriel](/docs/network/tutorials/coached-llm-prompting) |
| **Augmenté par dictionnaire** | Forcer la cohérence terminologique | [Tutoriel](/docs/network/tutorials/dictionary-augmented-llm) |
| **Prompting few-shot** | Inclure des exemples de traduction dans le prompt | [Tutoriel](/docs/network/tutorials/few-shot-prompting) |
| **Modèle affiné (fine-tuned)** | Entraîner sur des données parallèles (mais pas sur l'ensemble d'évaluation) | [Tutoriel](/docs/network/tutorials/fine-tuned-model) |
| **Modèles enchaînés** | Multi-passes : brouillon → affinage → validation | [Tutoriel](/docs/network/tutorials/chained-models) |
| **Hybride basé sur des règles** | Combiner des règles déterministes avec la flexibilité des LLM | [Tutoriel](/docs/network/tutorials/rule-based-hybrid) |

---

## Comprendre vos scores

Après l'exécution d'un benchmark, vous verrez une sortie similaire à :

```
══════════════════════════════════════════════════
  Composite Score: 0.67 (Functional)
──────────────────────────────────────────────────
  chrF++:              0.72
  FST acceptance:      0.82
  Exact match:         0.31
  Morphological acc.:  0.88
  Semantic score:      0.64
══════════════════════════════════════════════════
```

*À titre illustratif uniquement — les chiffres ci-dessus sont un exemple de présentation, et non un résultat réel.*

Le score composite combine plusieurs métriques — précision au niveau des caractères (chrF++), validité morphologique (acceptation FST), correspondance exacte, précision morphologique et préservation sémantique — chacune ayant un poids défini. **Les poids et la formule exacte du score composite se trouvent à un seul endroit : la [Spécification de notation](/docs/network/specifications/scoring), l'unique source de vérité.** Consultez-les dans la spécification plutôt que de copier les chiffres d'une page de guide — ils peuvent changer, et la spécification fait autorité.

**Niveaux de qualité** (également définis dans la [Spécification de notation](/docs/network/specifications/scoring)) :

| Niveau | Plage composite | Signification |
|------|----------------|---------------|
| Référence (Baseline) | 0.00–0.30 | Inférieur au [hasard pour la langue](/docs/network/specifications/connection-strength) — chaque orthographe a un seuil de hasard non nul, qui diffère selon la langue |
| Émergent | 0.30–0.50 | Prometteur mais inutilisable |
| Fonctionnel | 0.50–0.70 | Utilisable avec post-édition |
| **Déployable** | **0.70–0.85** | **Prêt pour la production avec révision par un locuteur** |
| Courant (Fluent) | 0.85–1.00 | Qualité quasi-native |

Détails complets : [Spécification de notation](/docs/network/specifications/scoring)

---

## Soumettre au classement (Leaderboard)

Lorsque vous êtes satisfait de votre score :

1. **Évaluez votre exécution** — `mt-eval test eval/logs/your_run.json` produit un rapport de test (TestReport) noté
2. **Examinez vos scores** — `mt-eval dashboard eval/logs/your_run.json` génère un tableau de bord visuel
3. **Soumettez** — suivez le guide [Soumettre une méthode](/docs/network/getting-started/submit-a-method)

Chaque soumission est associée par empreinte numérique à une configuration et une version de jeu de données spécifiques. Il n'y a aucune ambiguïté sur ce qui a été testé.

---

## Contributions et prix

La chose la plus utile que vous puissiez faire actuellement est de **compléter la carte** : exécutez des benchmarks à partir de la file d'attente publique. Chaque exécution ajoute un point de données au classement et au maillage de traduction, qu'un prix soit actif ou non. Voir [Contribuer à la puissance de calcul](/docs/network/getting-started/contributing-compute).

:::note[Les prix, lorsqu'ils existent, sont secondaires]
Le réseau soutient parfois des cagnottes sponsorisées pour attirer l'attention sur des paires de langues spécifiques mal desservies. C'est un moyen de diriger les efforts là où ils sont le plus nécessaires — ce n'est pas le but de la plateforme, ni un tournoi. Consultez la [Spécification des prix](/docs/network/specifications/prizes) pour connaître le statut actuel ; les prix peuvent être actifs ou non à un moment donné.
:::

### Architecture anti-manipulation

Que ce soit pour concourir pour des prix ou pour s'évaluer pour le classement, l'architecture d'évaluation empêche toute manipulation :

- **Corpus de test secrets.** L'évaluation finale s'exécute sur des données de référence (gold-standard) que les développeurs ne voient jamais. L'ensemble de développement (dev set) sur lequel vous vous entraînez est *différent* de l'ensemble de test secret. Le surajustement (overfitting) sur l'ensemble de développement ne sera pas transférable.
- **Exécution en bac à sable (sandbox).** L'organisation de gouvernance exécute votre méthode dans un environnement contrôlé. Vous soumettez la méthode, pas les scores.
- **Validation par la communauté.** Même si vos métriques sont parfaites, des locuteurs bilingues doivent confirmer que le résultat est réellement utilisable.
- **Vérification de la reproductibilité.** L'organisation de gouvernance doit reproduire vos scores à ±2 % près. Les exécutions chanceuses isolées ne comptent pas.

### Développer une méthode robuste

:::tip[Où se situe l'opportunité]
Le problème central est l'**hallucination morphologique** — les LLM produisent des chaînes de caractères qui ressemblent au cri (Cree) mais qui ne sont pas de vraies formes de mots. Les méthodes actuelles obtiennent un score d'acceptation FST de 70 à 85 %. Les seuils de qualité exigent plus de 99 %. Cet écart peut être comblé avec la bonne approche.
:::

1. **Commencez par l'ensemble de développement.** Exécutez des références (baselines) sur un corpus d'évaluation enregistré pour comprendre la qualité actuelle :
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **Étudiez ce qui échoue.** Observez les mots rejetés par le FST — ce sont les formes hallucinées. Comprenez les modèles morphologiques sur lesquels le modèle se trompe.

3. **Développez un pipeline hybride.** Les approches les plus prometteuses combinent :
   - **Génération par LLM** — pour la qualité de traduction et la précision sémantique
   - **Validation FST** — le FST GiellaLT détecte les formes de mots invalides ; utilisez-le comme filtre
   - **Nouvelle tentative sur rejet** — régénérez les mots que le FST rejette, éventuellement avec des indices morphologiques
   - **Données de coaching** — injectez des règles linguistiques, des tables de paradigmes et des entrées de dictionnaire dans le prompt
   - **Augmentation par dictionnaire** — croisez avec un dictionnaire bilingue pour valider ou remplacer les choix du LLM

4. **Itérez sur l'ensemble de développement.** L'ensemble de développement est à votre disposition pour expérimenter librement. Suivez vos scores composites, d'acceptation FST et chrF++.

5. **Soumettez au classement** — même sans prix, de bons résultats gagnent en visibilité et font progresser le domaine.

### Que se passe-t-il si vous gagnez un prix ?

- **Vous conservez :** L'attribution, les droits de publication, votre nom sur le classement
- **La communauté obtient :** Le droit d'utiliser, de modifier, de déployer et de monétiser votre méthode pour sa langue
- **Ce qui est transféré :** Tous les prompts, les données de coaching, le code du pipeline, la configuration — la recette complète. Si votre méthode utilise un LLM commercial (Classe A1), seule la recette est transférée ; la communauté peut l'orienter vers n'importe quel modèle compatible.

Détails complets : [Spécification des prix](/docs/network/specifications/prizes) | [Interface de méthode](/docs/network/specifications/methods#method-validity-and-dependency-classes)

---

## Déployer en production

Les méthodes éprouvées peuvent être déployées via [champollion](https://champollion.dev), l'interface en ligne de commande (CLI) de traduction en production. La même interface que le banc d'essai évalue devient un plugin qui traduit du contenu réel.

```bash
# Export your benchmark as a champollion plugin
mt-eval export --report eval/logs/report.json --name crk-v1 --type llm-coached --locales crk
```

**[→ Déployer en production](/docs/network/getting-started/deploy-to-production)** — faites passer votre méthode du réseau à la production.

---

## Dépannage

| Problème | Solution |
|---------|-----|
| `OPENROUTER_API_KEY not set` | Exportez la clé ou ajoutez-la à `.env` (voir la configuration ci-dessus) |
| `Model not found` | Exécutez `mt-eval list models --live` pour parcourir les modèles disponibles |
| Toutes les traductions sont vides | Vérifiez que votre clé API dispose de crédits. Essayez d'abord `--dry-run` |
| `ModuleNotFoundError` | Assurez-vous d'avoir activé l'environnement virtuel (venv) et exécuté `pip install -e .` |
| Journal d'exécution non enregistré | Vérifiez `eval/logs/` — les journaux sont nommés par horodatage |

---

## Voir aussi

- [Spécification des prix](/docs/network/specifications/prizes) — cadre de la cagnotte, seuils et processus de réclamation
- [Soumettre une méthode](/docs/network/getting-started/submit-a-method) — guide de soumission étape par étape
- [Spécification de notation](/docs/network/specifications/scoring) — définitions complètes des métriques et des poids
- [Spécification du banc d'essai](/docs/network/specifications/harness) — référence de l'architecture et de la configuration
- [Règles du classement](/docs/network/leaderboard/rules) — exigences de soumission
- [Souveraineté des données](/docs/network/sovereignty/data-sovereignty) — les principes autochtones de souveraineté des données, CARE et la gouvernance communautaire
- **Vous souhaitez utiliser une méthode existante ?** Consultez le [Guide de l'agent champollion](https://champollion.dev/docs/guides/agent-guide) — installez et traduisez en une seule commande.
