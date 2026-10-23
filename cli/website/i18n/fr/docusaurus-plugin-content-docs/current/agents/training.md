---
title: "Entraînement avec nmt-forge"
slug: /agents/training
description: "Comment nmt-forge entraîne et teste un modèle sur les rails : les préréglages de modèle et ce que --model auto sélectionne en fonction de la mémoire, la boucle sécurisée commande par commande, le décodage et les limites de longueur, les tâches en arrière-plan et la file d'attente à un seul entraînement à la fois, l'espace disque (points de contrôle conservés, vérification du disque, tidy), l'exportation et le service, les cycles d'amélioration (le verdict du cycle, le verdict du·de la locuteur·rice) et la proposition d'un modèle plus puissant, les données synthétiques, un tableau vérifié symptôme → cause → solution, et la taxonomie des défaillances."
---

# Entraîner avec nmt-forge

`nmt-forge` entraîne un modèle sur les paires de la communauté, à l'intérieur de garde-fous : il
refuse ce qui corromprait un résultat, et chaque refus indique quoi, pourquoi et le
correctif. Il n'implémente aucune métrique propre — chaque score provient du
moteur d'évaluation (`mt-eval`), le même code qui évalue tout le reste.

Sur les rails, vous tapez rarement ces commandes : `champollion next` les nomme,
et à partir de l'étape `forge`, il relaie le propre conseiller de forge
(`nmt-forge status`). Cette page décrit ce que font ces étapes.

## Modèles

`nmt-forge init --model <preset>` écrit un préréglage dans `config.json` sous forme de
nombres explicites (hachés dans l'identité de chaque exécution : une version ultérieure de forge
ne modifie jamais les exécutions d'un projet existant). `nmt-forge use-model <preset>`
change le modèle d'un projet.

| Préréglage | Ce que c'est | Nécessite | Ce que forge indique d'attendre |
|---|---|---|---|
| `cpu-tiny` | Un petit transformer entraîné à partir de zéro sur les paires, avec un vocabulaire de 4 000 fragments appris à partir des lignes d'entraînement | CPU uniquement · aucun téléchargement | « sur ~1–2k paires : chrF++ d'environ 5–30 (la borne supérieure uniquement pour des données très répétitives) — phrases mémorisées et patrons de vos données, non une traduction générale » |
| `byt5-small` | ByT5-small de Google (300M de paramètres, lit les octets — aucun vocabulaire à ajuster), affiné | téléchargement de ~1,2 Go · Apple silicon ou GPU CUDA recommandé | « dans les propres essais de forge, il a appris bien plus à partir des mêmes paires que cpu-tiny — mesurez-le tout de même par rapport à votre modèle en service sur votre jeu de dév » |
| `byt5-small-lowmem` | Le même modèle, taux d'apprentissage et limites de longueur, configuré pour un ordinateur disposant de 8 à 15 Go de mémoire : Adafactor, gradient checkpointing et lots de 4 paires accumulés 4 fois (les mêmes 16 paires par étape) — moins de mémoire par étape, plus de temps. Pas encore mesuré sur un ordinateur de 8 Go | comme `byt5-small` | comme `byt5-small` |
| `cpu-finetune` | Un petit modèle Marian/opus-mt préentraîné, affiné sur CPU. Vous indiquez la base (`--base`) ; elle n'est jamais devinée | CPU uniquement · téléchargement de ~300 Mo | « dépend de la proximité de la langue cible de la base — mesurez-le par rapport à cpu-tiny sur votre jeu de dév » |
| `nllb-600m` | NLLB-200 distillé 600M avec LoRA | un GPU CUDA (8 Go+) · téléchargement de ~2,5 Go | « le plus robuste des trois lorsque NLLB couvre une langue apparentée ; mesurez-le tout de même — ne tenez jamais rien pour acquis » |

Chaque préréglage s'entraîne avec l'extra d'entraînement de forge (`nmt-forge[hf]`), avec la graine 42.
Aucun préréglage ne définit de budget de temps : ce chiffre appartient à la communauté.

- **Sans `--model`**, `init` écrit `cpu-tiny`.
- **`--model auto`** (ce que transmettent les rails) lit la mémoire du GPU sur lequel forge
  peut s'entraîner — sur un Mac avec Apple silicon, la mémoire de l'ordinateur (partagée
  avec le GPU) ; avec `nvidia-smi` sur `PATH`, celle de la plus grande carte NVIDIA :
  16 Go ou plus (ou une mémoire qu'il ne peut pas lire) → `byt5-small` ; 8–15 Go →
  `byt5-small-lowmem` ; moins de 8 Go → `cpu-tiny`. Sans aucun GPU, `cpu-tiny`.
  La raison, accompagnée de la mémoire détectée, est affichée (`chosen: …`) et renvoyée
  sous forme de `model_choice` dans `--json`. Cela ne vérifie pas le bon fonctionnement du GPU.
  `NMT_FORGE_AUTO_PRESET` passe outre (il doit nommer un préréglage).
- **Le modèle plus puissant proposé par les cycles** ne s'adresse qu'à un projet dont le modèle
  en service est `cpu-tiny` : `byt5-small-lowmem` là où `--model auto` le choisirait,
  sinon `byt5-small` — y compris sur un ordinateur où `auto` choisirait
  `cpu-tiny` ; le `why` de la proposition indique ce dont il a besoin.

**Remarque.** Ne décrivez jamais ce qu'indique d'attendre un préréglage comme une promesse. Mesurez sur le
jeu de dév.

## La boucle sécurisée

Chaque commande accepte `--json` ; `--workspace <dir>` (par défaut `.forge`) se place
avant la sous-commande. Forge refuse les options abrégées.

| Étape | Commande | Ce qu'elle fait | Ce qu'elle refuse |
|---|---|---|---|
| Atelier | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | Écrit `.forge/`, `config.json`, `NEXT_STEPS.md` | Un fichier `--pair` illisible ; `cpu-finetune` sans `--base` |
| Jeu de test | `nmt-forge registry add project-test <file> --role test` | Fige le sha256 du fichier ; démarre son journal de lecture | Des lignes synthétiques dans un jeu de test ou scellé ; un nom déjà enregistré avec un autre contenu (sauf `--allow-rotate`) |
| Filtrage | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | Crible chaque paire par rapport à chaque jeu de dev, de test et scellé enregistré ; écrit une copie propre | L'écrasement d'un fichier en cours d'utilisation (sauf `--overwrite`) ; un résultat sans aucune donnée d'entraînement restante |
| Prédire | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | Écrit la prédiction des personnes avant tout score | Un identifiant existant ; l'écriture après toute lecture d'évaluation du jeu, par forge ou `mt-eval` (sauf `--allow-after-reads`, consigné dans le registre) |
| Jeu de dev | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | Une extraction de dev disjointe par groupe, enregistrée sous `project-dev`. Le `<n>` des rails : une paire filtrée sur dix, au moins 50, au plus 500 — un quart d'entre elles en dessous de 200 paires ([shell](/docs/agents/shell#build-and-test-a-model)). `--near-dupe 0.6` conserve les quasi-copies (chevauchement de mots ≥ 0,6) du même côté, seuil que le filtrage de chaque cycle ultérieur applique ; les rails définissent `--max-group` à la moitié de la taille du jeu de dev plus un, afin qu'un fichier issu de gabarits puisse quand même être scindé | Un sous-ensemble dépassant 1,5× sa demande, ou un entraînement conservant moins de la moitié des lignes |
| Plancher | `nmt-forge floor <word lists>` | Traduit le jeu de dev mot à mot à partir du dictionnaire et l'évalue de la même manière que le score de dev d'une exécution | Aucun jeu de dev enregistré |
| Vérification | `nmt-forge preflight run --config config.json` | Exécute chaque contrôle que rencontrera l'exécution, avec des correctifs ; code de sortie 2 en cas d'échec | — |
| Entraîner | `nmt-forge run config.json --detach` | Entraîne, sélectionne le point de contrôle sur le jeu de dev, supprime les autres points de contrôle de l'exécution ([espace disque](#disk-space)), écrit `.forge/runs/<run name>-<8 hex>/` avec `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl` | Une exécution qui existe déjà (mêmes configuration, fichiers d'entraînement et jeu de dev) ; un disque sans espace suffisant (`disk-room`, avant toute écriture ; `--skip-disk-check` passe outre) ; une exécution en cours ; des lignes d'entraînement qui fuient dans un jeu de test ou scellé ; des lignes de dev dans l'entraînement ; des données marquées do-not-train ou mises en quarantaine ; `terms.training: not-allowed` ; des données synthétiques dépassant leur plafond ; un plafond de décodage trop court pour les références ; des clés de configuration inconnues |
| Score de test | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | Évalue le jeu de test une fois, par rapport à la prédiction ; empaquette le modèle, avec `input-words.json` à côté de son dossier — les mots sur lesquels il a été entraîné, afin qu'un serveur puisse nommer ceux qu'il n'a jamais vus ([mise en service](/docs/agents/serving#what-an-export-holds)) | Aucun pré-enregistrement, ou plusieurs et pas de `--prereg` ; un jeu scellé épuisé ; un `--out` non vide sans `--force` |
| Choisir | `nmt-forge choose <export>/model` | Enregistre le choix de modèle fait par les personnes | Un dossier qui n'est pas un export enregistré avec un modèle |
| Servir | `nmt-forge serve <export>/model --detach` | Sert le modèle sur cet ordinateur ([mise en service](/docs/agents/serving#nmt-forge-serve)) | Hors boucle locale sans jeton, ou un modèle exclusivement local sans `--holders-agreed-by` |

Tout ce qui importe est consigné dans le registre chaîné par hachage
(`.forge/ledger.jsonl`) : enregistrements, lectures avec leur finalité, prédictions,
scores, consommations de jeux scellés, dérogations, verdicts d'audit, plancher, exportations,
choix, mises en service, ainsi que démarrages et sorties de tâches. Le manifeste d'exécution constitue l'enregistrement d'une
exécution.

**Barrières préliminaires :** configuration (affiche le hachage complet de la configuration), correspondance de l'espace de travail, aucune
exécution en cours, clôture de dév, données d'entraînement, backend installé, greffons de sélection,
quasi-doublons de test et quasi-doublons de dév (avertissements), audit de fuite,
mélange d'entraînement, marge de génération, cohérence du calendrier.

**Décodage.** Le décodage final de dév, la lecture du test (`export`), un modèle en service
traduisant à nouveau le jeu de dév, et le modèle mis en service utilisent la recherche par faisceau avec
`decode.num_beams` (4 sauf si `config.json` indique le contraire) ; la sélection
du point de contrôle, qui classe de nombreux points de contrôle, décode de manière gloutonne. Une exportation
enregistre `beams_applied`, et `nmt-forge serve` décode de la manière dont le modèle a été
mesuré : une exportation plus ancienne qui en est dépourvue est servie de manière gloutonne.

**Limites de longueur.** Un modèle apprend à partir d'au plus `model.max_src` jetons d'une
phrase source et `model.max_tgt` de sa traduction, lit au plus
`model.max_src` lorsqu'il traduit, et écrit au plus
`decode.max_new_tokens` (`byt5-small` : 320 octets chacun — environ 320 lettres d'une
écriture latine, environ 100 de syllabaire ; `cpu-tiny` : 256 fragments en entrée, 384 en sortie).
Rien n'est tronqué silencieusement : l'entraînement compte les paires dépassant l'une ou l'autre limite avant
de les couper, et le décodage final de dév compte les phrases tronquées à l'entrée et
les traductions arrêtées au plafond. Les deux figurent dans le manifeste d'exécution
(`length_limits`), et `status` avertit, avec le correctif : scinder les phrases longues, ou
augmenter `model.max_src` et `model.max_tgt` (ainsi que `decode.max_new_tokens`) dans
`config.json` — l'entraînement prend alors plus de temps.

**Remarque.** `nmt-forge run` lui-même n'exige pas de prédiction ; les rails la
demandent d'abord. N'entraînez pas avant que l'étape de prédiction ne soit terminée.

**Remarque.** `export` est l'étape qui lit le jeu de test. Son exécution est un
jalon, avec la prédiction de la communauté déjà consignée — jamais une simple vérification
de routine.

## Tâches en arrière-plan

`run --detach` et `serve --detach` lancent une tâche supervisée et rendent la main.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- États : `running`, `finished`, `refused`, `crashed`, `stalled`,
  `deadline`, `interrupted`, `lost`. `lost` correspond à une tâche dont le superviseur s'est terminé
  sans laisser d'enregistrement — y compris après un redémarrage, lorsque son numéro de processus
  appartient désormais à un autre processus.
- **Un seul entraînement à la fois sur cet ordinateur.** Les tâches d'entraînement sont mises en file d'attente
  à l'échelle de la machine, premier arrivé premier servi (`~/.nmt-forge/machine/train-queue`),
  tous projets confondus. Une tâche en attente reste à l'état `running`, avec `queued_behind`
  (la tâche qu'elle attend) dans `nmt-forge jobs --json` ; `status` vaut `training`
  et indique qui elle attend, et elle démarre d'elle-même. Un arrêt pendant qu'elle
  attend y met fin sans démarrage (`interrupted`) ; une attente de 24 heures y met fin
  (`deadline`).
- **Limites** (tâches d'entraînement) : aucun signe de vie pendant 15 minutes au démarrage
  (`--startup-minutes`) ; aucune progression pendant la durée la plus longue entre 10 minutes et 30 fois
  le temps médian par étape (`--stall-minutes`) ; une date limite de `--deadline-hours`,
  sinon le budget de temps de la configuration × 1,25, sinon 24 heures. Une tâche dépassant une limite est
  interrompue et consignée.
- **Arrêt** : l'exécution s'interrompt à sa prochaine étape ; le superviseur passe à
  un signal de fin (terminate) après 60 s et force l'arrêt (kill) 10 s plus tard.
- **La barrière d'horloge réelle** (backends Hugging Face) : après la phase de préchauffage, forge chronomètre
  les étapes, projette l'exécution et refuse celle qui ne rentrera pas dans le budget
  (`wall-clock budget exceeded: …`). Sans budget défini, la limite est un
  plafond de 24 heures.
- Pendant qu'une tâche d'entraînement s'exécute, `status` vaut `training` et l'étape des rails est
  `wait`. Une tâche qui a échoué constitue un avertissement sur chaque état ultérieur.
- **Reprise.** Lorsque la dernière tâche d'entraînement s'est terminée par `lost`, `crashed`, `stalled`
  ou `deadline` après avoir enregistré un point de contrôle, `status` indique `nmt-forge preflight
  run --config config.json && nmt-forge run config.json --resume --detach` :
  une nouvelle exécution qui repart du dernier point de contrôle de l'exécution interrompue (ses
  poids, un optimiseur réinitialisé, les époques qu'il lui restait), et dont le manifeste indique
  d'où elle a repris (`resumed_from`). Elle n'est jamais proposée après un arrêt
  manuel.
- Les tâches détachées ne fonctionnent que sous POSIX (macOS, Linux).

## Espace disque

L'entraînement écrit des points de contrôle : jusqu'à `model.save_total_limit` simultanément
(4 sauf si `config.json` indique le contraire), d'environ 1,4 Go chacun pour ByT5-small.
Avant ces règles, chaque cycle d'amélioration d'un projet ByT5-small conservait environ
5,6 Go, rien ne supprimait le modèle d'un cycle antérieur, et un disque plein interrompait
l'exécution lors de la sauvegarde. Le Go de forge équivaut à 1024³ octets.

- **Une exécution terminée ne conserve que son point de contrôle sélectionné.** Tous les autres
  dossiers `checkpoint-*` de l'exécution sont supprimés une fois le point de contrôle choisi :
  plus rien ne les lit (`export` copie celui sélectionné ; le cycle suivant
  commence à partir du modèle utilisé). Le manifeste consigne `checkpoints_pruned`
  (`removed`, `bytes`, `kept`). `"keep_checkpoints": "all"` dans le bloc
  `model` de `config.json` les conserve tous. Toute autre valeur est refusée lors de la lecture
  de la configuration, avant tout entraînement (`ConfigError` ; ici pour la valeur `x`) :
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **Verrou.** Une exécution que le disque ne peut pas accueillir est refusée avant que quoi que ce soit
  ne soit écrit (garde `disk-room`) ; une exécution détachée est refusée immédiatement, avant le démarrage
  de sa tâche. L'estimation : la taille d'un point de contrôle — le point de contrôle conservé d'une
  exécution antérieure de la même base dans cet espace de travail, sinon les propres fichiers de poids
  de la base (un dossier local ou le cache de Hugging Face) — multipliée par
  `model.save_total_limit`, plus 1 Go pour terminer ; jamais moins de 2 Go. Le
  refus indique
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  — ou, lorsqu'aucune taille n'est connue, *« (au moins cette quantité doit rester libre quel que soit le modèle) »* — puis
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`,
  ainsi qu'un `fix` qui mentionne ce que `nmt-forge tidy` peut libérer ici (lorsqu'il peut
  libérer quelque chose), le déplacement d'autres fichiers hors du disque, et `--skip-disk-check`.
- `nmt-forge run … --skip-disk-check` (avec ou sans `--detach`) démarre
  malgré tout. Le champ `disk_room` du manifeste enregistre la vérification — `free_bytes`,
  `checkpoint_bytes` (`null` lorsqu'elle est inconnue), `checkpoints_at_once`,
  `need_bytes` — ou `{"skipped": "--skip-disk-check"}`. **Remarque.** L'estimation
  peut être inexacte ; la décision d'ignorer la vérification appartient à la personne.
- **`nmt-forge tidy`** liste les poids de modèle des cycles antérieurs que plus rien
  n'utilise — chaque exécution avec sa taille, le total, l'espace libre — et ne supprime
  rien. `nmt-forge tidy --yes` les supprime. Il ne supprime jamais le modèle
  utilisé, la plus récente exécution ni le modèle que celui en cours d'utilisation a remplacé (la feuille
  de révision à l'aveugle prépare des brouillons avec lui) ; la ligne `Kept:` de la sortie nomme chacun d'eux, avec
  le motif. Une exécution nettoyée conserve ses enregistrements — manifeste, traductions de dev, rapport —
  et son manifeste acquiert `model_removed` (`at`, `by`, `bytes`, `why`) ; le
  registre reçoit une entrée `tidy` (`runs`, `bytes`). Une exécution nettoyée à laquelle on demande
  de traduire (`compare-runs` retraduisant le jeu de dev avec elle) est refusée :
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`.
  **Remarque.** `--yes` supprime des fichiers : montrez la liste à la personne et ne l'exécutez
  qu'avec son accord.
- **`status` avertit** — par une ligne dans `warnings`, relayée par les rails — lorsque le
  disque contenant l'espace de travail a moins de 10 Go libres, ou que le nettoyage pourrait libérer 5 Go
  ou plus : *« cet ordinateur dispose de X Go libres ; les modèles de N cycle(s) antérieur(s)
  que rien n'utilise occupent Y Go — `nmt-forge tidy` les liste,
  `nmt-forge tidy --yes` libère l'espace (le modèle utilisé, le plus récent et
  celui qu'il a remplacé sont conservés) »* (la partie après le point-virgule uniquement lorsque
  le nettoyage libérerait quelque chose).

## Les cycles d'amélioration

Une fois qu'un modèle est en service, chaque cycle entraîne une nouvelle exécution sur davantage de données avec le
même jeu de dév.

**Comment s'entraîne un cycle.** `champollion improve prepare` exécute `nmt-forge
round-plan --config config.json`, which rewrites `config.json` de l'une des deux
manières suivantes et consigne le plan dans le registre (`round-plan`) :

- **Poursuite à partir du modèle en service** (`init_from` son dossier de modèle) : 4 passes
  (époques) sur toutes les phrases jusqu'ici — les anciennes l'empêchent
  d'oublier — à la moitié du taux d'apprentissage. Bien plus court qu'un entraînement depuis
  le début. L'ensemble des paramètres attend dans `config.json` sous `model_full`.
- **Depuis le début**, avec l'ensemble des paramètres rétabli, lorsqu'aucun modèle n'est encore
  en service ; lorsque le modèle a été modifié (`use-model`, ce qui supprime également
  `model_full`) ; pour `cpu-tiny`, dont le vocabulaire provient des phrases
  d'entraînement (il s'entraîne en quelques minutes) ; pour un modèle à adaptateur (LoRA) ; et tous
  les 4 cycles, afin que de multiples courtes suites ne dérivent pas.

`prepare` affiche le plan et sa justification, et consigne `training` (`mode`,
`epochs`) dans `improve/round-<k>/prepared.json`. Dans les deux cas, la nouvelle exécution est
évaluée par rapport au modèle en cours d'utilisation sur les mêmes phrases de dev. Ensuite (1, 3 et
4 sont des états nommés par le conseiller de forge ; 2 est consigné par les rails) :

1. **`improve-compare`** (`auto`) : `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` — les deux modèles, appariés
   phrase par phrase sur le jeu de dev. Avec moins de 50 phrases de dev, le
   verdict est **too-few**, quels que soient les scores : *« trop peu de phrases de dev pour se
   prononcer : en dessous de 50, une différence ne se distingue pas du hasard de manière fiable, quelle
   que soit sa taille »*. À partir de 50 : **better** uniquement lorsque le p du test apparié est < 0,05
   **et** que l'intervalle à 95 % de la différence est supérieur à zéro ; **worse** lorsque
   p < 0,05 et qu'il est inférieur à zéro ; sinon **no-change**. Chaque verdict indique
   la plus petite différence que son jeu de dev met en évidence de manière fiable. Le jeu de test n'est jamais
   lu. Refusé (`improve-loop`) pour les exécutions sur des jeux de dev différents, une exécution
   sans traductions de dev enregistrées, ou un jeu de dev modifié depuis la nouvelle exécution.
2. **Le verdict du locuteur**, lorsque le jeu de dev n'a pas pu trancher. Le modèle d'un cycle
   qui n'a pas été mis en service rédige les brouillons de la moitié des lignes rédigées de la prochaine
   feuille de révision, à l'aveugle (`draft-newer`, ci-dessous), et `champollion improve
   marks` enregistre les décomptes du locuteur auprès de forge :
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   Forge n'intervient à ce sujet qu'après un verdict **too-few** ou **no-change**. Un
   test bilatéral de comparaison de deux proportions combinées à 5 % (|z| > 1,96) donne `clear` :
   `newer`, `in-use` ou `neither` ; l'entrée `improve-speaker` du registre conserve
   les noms des deux exécutions, les quatre décomptes, `z` et `clear` — les décomptes uniquement. Il
   refuse les décomptes inférieurs à 0, un nombre de traductions correctes supérieur au nombre évalué, ainsi qu'un modèle sans
   brouillon évalué. Son texte indique : *« En évaluant à l'aveugle lors de la même visite, le locuteur
   a jugé le modèle le plus récent correct sur A nouvelles phrases sur B (P %) et le modèle
   utilisé sur C sur D (Q %) »*, puis *« le modèle le plus récent est nettement meilleur sur
   ces phrases — forge propose de le mettre en service »*, *« le modèle utilisé est
   nettement meilleur sur ces phrases — il est conservé »* ou *« aucune différence nette
   sur ces phrases — le modèle utilisé est conservé »*.
3. **`improve-promote`** (`confirm`), en cas de **better** — ou en cas de **too-few** ou
   **no-change** lorsque le plus récent `speaker-verdict` sur cette exécution indique
   `clear: newer` (jamais en cas de **worse**). Il s'agit d'une proposition : un verdict à lui seul ne met
   rien en service. En cas d'accord des personnes, il exporte la nouvelle exécution sans lire
   le jeu de test (`--no-eval`), l'enregistre comme choisie (`choose`), arrête le
   serveur en cours d'exécution et dessert le nouveau modèle sur le même port. Seuls ce
   `export` et ce `choose` comptent comme une mise en service d'un modèle : jusque-là, le
   rapport de cycle indique *« mesurablement meilleur : non mis en service — les personnes ne
   l'ont pas choisi »*, et sa progression, sa projection et sa vérification de surapprentissage laissent le
   modèle de côté. Sur les évaluations du locuteur, son `why` ajoute leurs décomptes et *« une
   nette différence : le modèle le plus récent est meilleur sur les phrases dont la famille
   a besoin »*. Sur la feuille suivante, la moitié des lignes rédigées provient du modèle qu'il a
   remplacé, de sorte que le locuteur vérifie la promotion à l'aveugle (ci-dessous).
4. Sinon, le modèle utilisé reste en place et le cycle suivant commence — à moins que les
   verdicts des deux derniers cycles depuis le dernier changement de modèle ne soient tous deux
   **no-change** ou **worse**, avec `cpu-tiny` en cours d'utilisation. Le dernier changement de
   modèle correspond à la plus récente entrée `model-change` (un changement de préréglage ou un `not-now`) ou
   `choose` dans le registre — tout modèle mis en service par les personnes, y compris
   une promotion issue des évaluations du locuteur. Un cycle **too-few** n'est pas un
   cycle jugé : lorsque l'un des deux derniers est too-few, aucune proposition n'est faite.
   Puis **`improve-stronger-model`** (`ask_user`) :
   `nmt-forge use-model <preset> --config config.json --answer yes` (ou
   `not-now`), le préréglage `byt5-small` ou `byt5-small-lowmem`
   ([models](#models)). Le champ de réponse est `try_it`. `yes` réécrit le
   modèle de la configuration (en conservant le budget temps des personnes) et l'étape suivante l'entraîne ;
   `not-now` ne change rien. Les deux sont consignés dans le registre
   (`model-change`), et la proposition ne réapparaît qu'après deux autres cycles semblables.
   Via MCP, « pas maintenant » correspond ici à la réponse `try_it: "not-now"` ;
   `declined: true` est refusé à cette étape
   ([MCP](/docs/agents/mcp#not-now)). Son `why` ne dit jamais que l'ajout de phrases
   n'aide pas : lorsque le jeu de dev est trop restreint pour déceler le gain d'un cycle, *« de faibles
   gains peuvent passer inaperçus »* ; sinon, les cycles n'ont apporté *« aucun changement décelable
   par les phrases de dev (environ X points chrF++ ou plus) : les cycles apportent peut-être
   moins que cela, ou rien »* — près du sommet de la courbe, un cycle apporte environ un demi-point
   chrF++, en deçà de ce que 200 phrases de dev permettent de déceler.
   **Remarque.** `--answer` prend `yes` par défaut : transmettez toujours explicitement
   la réponse des personnes.

Les rails pilotent le reste d'un cycle (`champollion improve …`) : `nmt-forge
wishlist` rédige la feuille de ce qui aiderait le plus (40 invites par défaut, dont
au moins un quart laissé ouvert ; ses mots que le modèle n'a jamais vus demandent deux ou
trois phrases chacun, chacune exprimant quelque chose de différent — un mot vu une seule fois pendant
l'entraînement est rarement assimilé
([mesure](/docs/agents/measurement#what-the-wishlist-steers-on))), `nmt-forge analyze` ventile le chrF++ de dev par type
de phrase, et `nmt-forge grow-dev` ajoute les phrases d'exercice du locuteur au
jeu de dev sous le même nom — jamais une ligne déjà présente dans dev, jamais une
dont la source figure dans un jeu de test ou scellé. Un type de phrase n'oriente la
liste de souhaits que lorsque son score est nettement inférieur au reste
([mesure](/docs/agents/measurement#what-the-wishlist-steers-on)).
`nmt-forge draft-newer` (exécuté par `champollion improve sheet`) génère une moitié
aléatoire des lignes de la feuille de révision suivante avec l'autre modèle, sans indication, afin que
le locuteur évalue les deux modèles à l'aveugle
([mesure](/docs/agents/measurement#the-speakers-marks)) : le modèle entraîné le plus récent
lorsqu'il n'est pas celui en cours d'utilisation (son cycle n'a pas été mis en
service), ou, après une promotion, le modèle que celui en cours a remplacé. Sa ligne `--json`
indique lequel (`relation` : `newer` ou `replaced`, `null` lorsqu'il n'y a pas d'autre
modèle et que chaque ligne provient de celui en cours d'utilisation), avec `other`, `in_use`, les
paires d'entraînement associées à chacun (`other_pairs`, `in_use_pairs`) et `n` ; l'entrée
`draft-newer` du registre consigne la même chose. Comment relayer un cycle :
[coaching](/docs/agents/coaching).

## Données synthétiques et rétro-traduction

- `nmt-forge synth <pack> --out <file>` exécute le générateur d'un pack linguistique.
  Forge ne fournit aucun pack. Chaque ligne est vérifiée et estampillée `synthetic: true`.
- Un fichier synthétique s'entraîne comme une voie balisée dans `config.json`
  (`data.synthetic`, `{"path", "tag": "<synth>"}`). Au-delà de 15 % d'un type, l'exécution
  est refusée sauf si la configuration mentionne `mix.synthetic_sample` ;
  `nmt-forge sample --cap 0.15 --key kind` extrait un échantillon plafonné.
- **La rétro-traduction n'a pas de commande.** Il s'agit d'une fonction de bibliothèque
  (`nmt_forge.training.backtranslation.backtranslate`) : vous fournissez le
  modèle inverse ; il filtre d'abord le texte monolingue par rapport à chaque jeu enregistré
  et balise sa sortie comme `<bt>` ; la sortie s'entraîne ensuite comme une voie
  synthétique. Aucun filtre de qualité ne s'y applique. `config.data.monolingual` est refusé.
- **Remarque.** Le texte monolingue est une donnée de la communauté comme une autre : ses conditions
  associées s'appliquent, et un modèle inverse consistant en un grand modèle de langage hébergé le transmet à un fournisseur
  ([règles sur les données](/docs/agents/data-rules)).

## Symptôme → cause → correctif

| Symptôme | Cause probable | Solution |
|---|---|---|
| `cpu-tiny` obtient un score compris entre 5 et 30 chrF++ sur dev | Il est faible par conception : un guide de conversation pour des phrases semblables à ses données d'entraînement | Davantage de paires réelles ; sur Apple Silicon ou un GPU, `byt5-small` (`nmt-forge use-model byt5-small` ; `byt5-small-lowmem` lorsque le GPU dispose de 8 à 15 Go) |
| « Bon sur les gabarits, mauvais sur le texte réel » | Règle R7 (plateau de transfert) : la perte sur dev a atteint un minimum avant le dernier point de contrôle et a augmenté de 5 % ou plus. Elle se déclenche lors de toute hausse de ce type, quelle que soit l'évolution du chrF++ sur dev — à interpréter avec les scores de dev | Davantage de paires réelles. Indiqué par `nmt-forge lint <run-manifest.json>`, pas par l'export |
| Le score semble trop bon | Des copies ou quasi-copies de test dans l'entraînement ; ou la plupart des lignes de test ont un jumeau dans l'entraînement (R4-recall-not-translation, à la moitié ou plus) | `leak-audit --drop-test-twins` pour obtenir un fichier exempt de jumeaux ; communiquer les scores avec et sans les jumeaux |
| Une faible différence entre deux modèles | L'intervalle est large (R5-low-power, intervalle supérieur à 8 points) | `nmt-forge compare` (test apparié) ; pour les cycles, `compare-runs`. Augmenter la taille du jeu de dev |
| Un cycle indique « trop peu de phrases de dev pour se prononcer » (`too-few`) | Le jeu de dev contient moins de 50 phrases : aucune comparaison ne permet de trancher à ce niveau | Rien à corriger : la feuille suivante mélange à l'aveugle les ébauches des deux modèles et les évaluations du locuteur tranchent ; une ligne de feuille sur deux est une ligne d'exercice jusqu'à ce que le jeu de dev atteigne 50 phrases |
| Un cycle indique « aucun changement mesurable » | Le jeu de dev est trop petit pour déceler le gain d'un cycle | Agrandissez-le à partir des phrases d'exercice du locuteur (`grow-dev`, piloté par `champollion improve prepare`) |
| Entraînement refusé : `[disk-room] this computer has … free` | Le disque ne peut pas accueillir les points de contrôle de l'exécution | `nmt-forge tidy` liste ce que les modèles des cycles antérieurs libéreraient ; `nmt-forge tidy --yes` avec l'accord de la personne ; ou libérer de l'espace ailleurs. `--skip-disk-check` uniquement lorsque la personne décide que l'estimation est inexacte |
| Une exécution ne dépasse pas le plancher du dictionnaire | L'entraînement n'a rien appris de plus que ce que fournit la liste de mots | Davantage de paires ; vérifier la couverture du plancher ; en informer les personnes |
| Le jeu de dev est saturé | La borne inférieure de l'intervalle atteint 99 % du plafond | Un jeu de dev plus difficile ; le score ne peut plus progresser |
| Refusé avant l'entraînement | Voir la ligne « Entraîner » ci-dessus ; `preflight run` nomme chaque contrôle en échec et son correctif | Appliquer le correctif. Un extra d'entraînement manquant : `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'` (ou `pip` dans le Python propre de forge) |
| Interrompu par la limite de temps réel | L'exécution projetée dépasse le budget (24 heures en l'absence de budget spécifié) | Un modèle plus petit ou moins d'époques, ou un budget défini par les personnes (`model.time_budget_hours`) |
| Une tâche en arrière-plan a échoué | `nmt-forge jobs` indique `crashed`, `stalled`, `deadline`, `lost` ou `refused` | Lisez son `stderr.log` dans `.forge/jobs/<name>/` et corrigez-le ; puis relancez l'entraînement, ou reprenez à partir de son dernier point de contrôle lorsque `status` nomme `--resume` |
| L'entraînement est en attente et ne démarre pas | Un autre entraînement est en cours d'exécution sur cet ordinateur ; celui-ci est mis en file d'attente derrière lui (`queued_behind`) | Patientez : il démarrera automatiquement. N'en lancez pas d'autre |
| Les phrases longues ressortent tronquées | Les limites de longueur : `status` avertit avec les décomptes (paires tronquées à l'entraînement, phrases de dev tronquées en entrée, traductions interrompues au plafond) | Scindez les phrases longues ; ou augmentez `model.max_src`, `model.max_tgt` et `decode.max_new_tokens` (entraînement plus long) |
| Les mots ressortent sous forme d'éléments inconnus (`cpu-tiny`) | Le vocabulaire est appris uniquement à partir des lignes d'entraînement | Davantage de paires utilisant ces mots ; ou `byt5-small`, qui lit des octets |

## La taxonomie des défaillances

Forge a été conçu à partir d'un catalogue des manières dont un projet d'entraînement s'illusionne. En
résumé — « imposé » signifie que les outils le refusent :

| Famille | Défaillances | Dans le code |
|---|---|---|
| Fuite | La réponse dans le jeu d'entraînement ; quasi-copies ; paraphrases chevauchant le découpage ; patrons enchaînés | Imposé (audit de fuite, garde de découpage). Les variantes d'un même patron sont conservées et comptées |
| Contamination dév/test | Choix de points de contrôle sur le jeu de test ; consommation d'un jeu scellé à deux reprises ; score de test sans prédiction ; prédiction après lecture | Imposé (clôture de dév, registre d'évaluation, préenregistrement) |
| Tokeniseur et orthographe | Un tokeniseur incapable d'écrire l'écriture ; conventions orthographiques mixtes | Non vérifié pour les tokeniseurs ; les conventions mixtes font l'objet d'un contrôle de forme, uniquement lorsque la configuration les nomme |
| Données synthétiques | Maîtrise du mélange synthétique ; arrêt précoce interrompant prématurément une exécution riche en données synthétiques ; effondrement ; rétro-traduction s'alimentant de ses propres erreurs | Le plancher d'arrêt précoce est imposé ; le reste relève de contrôles de forme ou de balises |
| Couverture | Mots manquants pour le registre | Un contrôle de forme, lorsqu'un greffon signale la couverture |
| Mesure | Un écart inférieur à son intervalle ; un nombre opaque unique ; calcul de métrique hors du moteur | Imposé : chaque score comporte son intervalle et provient du moteur |
| Décodage | Sortie tronquée ; points de contrôle choisis selon la perte au lieu de la sortie | Imposé : marge de décodage, sélection par métrique de génération ; coupures de longueur comptées et signalées |
| Processus | Clés de configuration inconnues ; données marquées do-not-train ; exécutions incontrôlées | Imposé |

Lacunes connues, sans code à ce jour : couverture du tokeniseur, qualité de la rétro-traduction,
troncature selon le registre, ratio données de référence / données synthétiques, variance selon les graines.

## Sortie destinée aux programmes

`--json` place exactement un document JSON sur stdout. Un refus correspond à
`{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}`
et au code de sortie 2 (`details` est ajouté pour les refus liés au découpage et à la clôture de dév). Le code de sortie 1 correspond à un
plantage inattendu. `nmt-forge run` se termine par `RUN EXIT <code>` (0, 1, 2 ou
130) ; `run --detach` renvoie 0 avec le document de tâche. `nmt-forge status
--json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready",
"blockers", "warnings", "answers"}}`.

## Approfondir

- [La référence des commandes `nmt-forge`](/docs/network/getting-started/forge-command-reference)
  — chaque sous-commande et option.
- [Règles de mesure](/docs/agents/measurement) — ce que signifient les scores.
- [Votre premier traducteur](/docs/your-first-translator) et
  [L'améliorer](/docs/make-it-better) — les versions destinées à la communauté.
- [Mise en service et déploiement](/docs/agents/serving) — ce que contient une exportation.
