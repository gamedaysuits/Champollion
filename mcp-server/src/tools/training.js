/**
 * get_training_guardrails — how to train an NMT model without fooling
 * yourself, as a tool answer agents discover BEFORE re-inventing the
 * catalogued mistakes.
 *
 * Every rule below is the mechanization of a real, measured failure from
 * Champollion's Plains Cree development work (the 2026-07-12 mistake
 * ledger). The programmatic enforcement lives in the monorepo's `forge/`
 * package (nmt-forge: guards, synthesis engine, fenced training loop); this
 * tool is the discovery surface, so the content is useful even where forge
 * isn't installed.
 *
 * Static, self-contained, no I/O — the guidance IS the data.
 */

const GUARDRAILS = [
  {
    id: 'discovery',
    name: 'Start from the language card (SSOT discovery)',
    rule: 'Before designing anything, read the language\'s card: '
      + '`nmt-forge discover <iso639-3>` reports what EXISTS (scripts, '
      + 'analyzers, dictionaries, corpora, eval datasets with '
      + 'do_not_train/quarantine flags, LYSS referee plugin specs) and where '
      + 'the language sits on the asset ladder: (1) parallel text → guarded '
      + 'training; (2) +monolingual → tagged backtranslation; (3) '
      + '+dictionary+grammar → cited template pack; (4) +morphological '
      + 'analyzer → round-trip-VERIFIED synthesis; (5) +LYSS referee → the '
      + 'language\'s own metric in scoring and checkpoint selection. '
      + 'Absence on a card means UNKNOWN, never zero. `nmt-forge init <code>` '
      + 'scaffolds a project (workspace + starter config + NEXT_STEPS brief) '
      + 'from the card. The tool is fully general: a bare card still gets '
      + 'every guard and the full training loop — only the upper rungs wait '
      + 'on assets.',
    mistake: 'Designing for one language\'s asset mix and silently assuming '
      + 'it generalizes — or reading a sparse card as "this language has '
      + 'nothing" and giving up, when the card is an index that may simply '
      + 'not record the resource yet.',
    forge: 'nmt-forge discover <code> [--json] / nmt-forge init <code> '
      + '--pair SRC-TGT; library: nmt_forge.cards.discover().',
  },
  {
    id: 'split',
    name: 'Group-disjoint splits (split-guard)',
    rule: 'Never row-level random-split a corpus with repeated sources or '
      + 'targets. Union-find every pair sharing a SOURCE or TARGET into one '
      + 'group; whole groups land on one side; verify zero overlap and '
      + 'hard-fail otherwise.',
    mistake: 'A textbook mapped many English drills to one Cree word '
      + '("Feed him"/"Feed her" → asam). Random split put one copy in train, '
      + 'its twin in test: 17/54 test answers were literally in training '
      + '(leaked rows scored 83 chrF++ vs 44 clean).',
    forge: 'nmt-forge split … / nmt_forge.guards.split_guard.group_split(); '
      + 'verify any existing split with verify_disjoint().',
  },
  {
    id: 'dev-fence',
    name: 'Checkpoint selection never sees the test set (dev-fence)',
    rule: 'Early stopping / best-checkpoint selection runs on a DEV slice '
      + 'carved from the TRAIN side (also group-disjoint) — never on the '
      + 'test set. Refuse to train without a dev set.',
    mistake: 'Every run before 2026-07-12 kept the checkpoint that scored '
      + 'best ON THE TEST SET — like peeking at the final exam after every '
      + 'study session. Consequence: there was NO valid baseline.',
    forge: 'nmt_forge.guards.dev_fence.DevFence — content-checks dev rows '
      + 'against every registered test set (catches file-copies too).',
  },
  {
    id: 'leak-audit',
    name: 'Screen every corpus against every eval set (leak-audit)',
    rule: 'Before training on ANY corpus or harvest (including monolingual '
      + 'text for backtranslation): exact canonical-key check on BOTH sides, '
      + 'near-duplicate screen (token Jaccard ≥ 0.6), whole-file identity '
      + 'check. Keep the audit manifest next to the corpus.',
    mistake: 'A harvested "training" text WAS the gold textbook — the screen '
      + 'caught 489/489 lines. Two more harvests were partial eval sets '
      + '(27/27, 46/46). Same-domain documents share reworded lines exact '
      + 'matching misses.',
    forge: 'nmt-forge leak-audit --strict / nmt_forge.guards.leak_audit.',
  },
  {
    id: 'funnel',
    name: 'Count every pipeline stage (funnel-audit)',
    rule: 'Decompose data-pipeline yield stage by stage (dictionary → '
      + 'canonicalized → parsed → emitted) with drop reasons. Canonicalize '
      + 'orthography AT EVERY ADAPTER BOUNDARY, and check whether dropped '
      + 'items would survive canonicalized.',
    mistake: 'A one-character orthography mismatch (dictionary ý vs analyzer '
      + 'y) silently deleted 1,375 verbs from generation for WEEKS. Nobody '
      + 'was counting.',
    forge: 'nmt_forge.guards.funnel_audit.Funnel + assert_none_recoverable() '
      + '(the ý-bug detector).',
  },
  {
    id: 'conventions',
    name: 'One output orthography (convention-lint)',
    rule: 'Canonicalize training targets ONCE at data-build time; train on a '
      + 'single spelling convention; normalize refs the same way at scoring; '
      + 'keep a mixed-convention output metric in the battery.',
    mistake: 'Targets deliberately duplicated across four orthographies '
      + 'taught the model they were interchangeable — it MIXED conventions '
      + 'within single sentences.',
    forge: 'nmt_forge.guards.convention_lint.assert_single_convention() / '
      + 'mixed_convention_rate().',
  },
  {
    id: 'coverage',
    name: 'Structural coverage vs a cited grammar checklist (coverage-map)',
    rule: 'Account template kinds against a checklist transcribed from '
      + 'published grammars (work-level citations). Volume must not hide '
      + 'structural gaps; required phenomena with zero pairs refuse the build.',
    mistake: 'One million manufactured pairs in ~23 shapes: no imperatives, '
      + 'no wh-questions, no possession, no inverse — core grammar the '
      + 'generator COULD produce; the templates never asked.',
    forge: 'nmt_forge.guards.coverage_map; packs ship cited checklists.',
  },
  {
    id: 'strata',
    name: 'Cap per-kind dominance (sample-strata)',
    rule: 'Sample synthetic corpora with a per-kind cap (default 15%) via '
      + 'capped reservoir; record per-kind seen/kept in a manifest.',
    mistake: 'Two template kinds (conditionals) were 54% of the corpus and a '
      + 'uniform sample kept that ratio — half the training signal on two '
      + 'shapes.',
    forge: 'nmt-forge sample / nmt_forge.guards.sample_strata.',
  },
  {
    id: 'ci',
    name: 'Error bars always, full referee stack (ci-scoring)',
    rule: 'Never report a score without its 95% bootstrap CI; use paired '
      + 'approximate randomization for A/B claims. Delegate ALL metric math '
      + 'to mt-eval-harness — never re-implement scoring. forge speaks the '
      + 'harness\'s WHOLE stack: chrF++/BLEU/exact-match, the neural lanes '
      + '(comet, comet-qe, metricx — inference once, bootstrap over cached '
      + 'per-entry scores; MetricX is LOWER-is-better and the direction '
      + 'rides the score through selection and A/B winners; missing extras '
      + 'report an install fix, never a number), LYSS plugin lanes, and the '
      + 'harness\'s own plugin discovery (--card-plugins CODE). Before '
      + 'selecting checkpoints on ANY automatic metric, check metric trust '
      + '(`nmt-forge discover <code>` shows the WMT meta-eval correlations; '
      + 'get_metric_reliability serves the same data): for some families '
      + 'BLEU barely tracks humans while COMET works (Inuktitut r=0.16 vs '
      + '0.86), and for most low-resource families the honest answer is '
      + 'UNMEASURED.',
    mistake: '"Oral-story improved 16.7 → 18.1" on 37 sentences was noise '
      + 'dressed as signal; a bespoke evaluator (battery.py) drifted from '
      + 'the maintained referee; and selecting on a metric no human judgment '
      + 'ever validated optimizes the wrong thing invisibly.',
    forge: 'nmt_forge.guards.ci_scoring (wraps mt_eval_harness.confidence / '
      + '.significance / .metrics_comet / .metrics_metricx); '
      + '--metric comet --target-lang <code> on score/compare.',
  },
  {
    id: 'ledger',
    name: 'Adaptive use is visible (eval-ledger)',
    rule: 'Log every read of every registered eval file (purpose-tagged, '
      + 'config-bound, append-only, hash-chained). Sealed sets are ONE-SHOT: '
      + 'spent once; a respend needs a loud, ledgered override.',
    mistake: 'Eval pairs quietly guided development decisions, so they were '
      + 'partly spent as a test — and nothing recorded it.',
    forge: 'nmt-forge ledger show --set <name> for the spend report.',
  },
  {
    id: 'prereg',
    name: 'Predictions before results (preregister)',
    rule: 'Write falsifiable predictions (metric, direction, margin, '
      + 'rationale) BEFORE scoring a test set; the comparison table refuses '
      + 'to render without a preregistration that predates the first scoring '
      + 'read.',
    mistake: 'The "champion" and the findings built on it were selected via '
      + 'test-set peeking; what made honest recovery possible was the '
      + 'pre-registration habit — including the predictions that failed.',
    forge: 'nmt-forge prereg new … / nmt_forge.guards.preregister.',
  },
  {
    id: 'synthesis',
    name: 'Verified, cited, provenance-stamped synthetic data',
    rule: 'Every generated word must round-trip through the language\'s '
      + 'morphological analyzer (generate → analyze → same analysis). Every '
      + 'template kind cites a published grammar. Plausibility filters are '
      + 'named and counted. Rows carry champollion-derived provenance and '
      + 'synthetic: true. Test sets are REAL DATA ONLY — synthetic rows in a '
      + 'test set are refused at registration.',
    mistake: 'Unverified generation emits garbage silently; uncited '
      + 'templates drift from the grammar; and testing on synthetic data '
      + 'measures the generator, not translation.',
    forge: 'nmt_forge.synthesis (engine enforces the emit law); '
      + 'nmt-forge synth <pack>.',
  },
  {
    id: 'schedule',
    name: 'Derived stopping schedule (schedule-sanity)',
    rule: 'Never let raw early stopping govern a synthetic-heavy run. When '
      + 'the mix is dominated by tagged synthetic data and the dev set is '
      + 'real, dev loss bottoming early and drifting up is the model '
      + 'fitting the synthetic mass — EXPECTED, not convergence. The '
      + 'stopping floor must be DERIVED from the config (forge: max of one '
      + 'full pass over the mix and 30% of planned steps, capped at 60%; '
      + 'auto-activated in the synthetic-heavy regime), never a magic '
      + '--min-steps flag the user must know. Regimes are named presets '
      + '("synthetic-heavy", "balanced", or "auto"); every intervention '
      + 'prints the dev-loss trajectory and the reason in plain language. '
      + 'Prefer a dev GENERATION metric over loss for checkpoint selection '
      + 'in this regime.',
    mistake: 'The first CLEAN-protocol crk run (2026-07-12) died at epoch '
      + '0.52 of 115k steps: 97.5% synthetic mix, honest 42-row real dev, '
      + 'dev loss bottomed at step ~8k, patience-6 declared convergence. '
      + 'Invisible in all prior runs because their dev was (illegitimately) '
      + 'the test set — the honest protocol surfaced the real bug.',
    forge: 'automatic in nmt-forge run (config "regime": "auto"; '
      + 'nmt_forge.training.schedule.plan_schedule); the run manifest '
      + 'carries the derived floor, the reason, and any stop/suppress '
      + 'events with trajectories.',
  },
  {
    id: 'training',
    name: 'Training-loop defaults',
    rule: 'Tag synthetic sources (<synth>, <bt> — Caswell et al. 2019, '
      + 'adapted); keep gold untagged so it anchors style. Write the gold '
      + 'exposure math down (upweight × detected augmentation multiplier). '
      + 'Give decode caps headroom (≥ 1.5× the longest reference in tokens). '
      + 'Never train on datasets the mt-eval registry marks do_not_train or '
      + 'quarantined (that is ALL registry benchmark sets). Select '
      + 'checkpoints on dev loss or a dev GENERATION metric — "eval-loss is '
      + 'enough" is an open question, not a fact.',
    mistake: 'Silent ×20-is-really-×54 exposure differences broke A/B '
      + 'fairness; a 160-token cap sat next to a 107-token max reference; '
      + 'and benchmark sets are one download away from being training data.',
    forge: 'nmt-forge run config.json — all of these are the defaults.',
  },
];

/**
 * The command order a driving agent follows, and the forge_* tool that runs
 * each step. Pairs with the guardrails (the "why") — this is the "how", so
 * the rulebook and the hands reference each other.
 */
const COMMAND_ORDER = [
  { step: 'orient', tool: 'forge_status',
    what: 'WHERE AM I + THE next command. Call first and after every step.' },
  { step: 'discover', tool: 'forge_discover',
    what: 'what the language has (asset ladder). Absence = unknown, not zero.' },
  { step: 'scaffold', tool: 'forge_init', what: 'workspace + starter config.' },
  { step: 'split', tool: 'forge_split',
    what: 'group-disjoint train/dev/test carve.' },
  { step: 'register', tool: 'forge_register_eval',
    what: 'name dev/test/sealed sets so guards can key off roles.' },
  { step: 'screen', tool: 'forge_leak_audit',
    what: 'target-side leakage is fatal; source-only near-dupe is kept.' },
  { step: 'prereg', tool: 'forge_prereg',
    what: 'predictions BEFORE results, or scoring is refused.' },
  { step: 'preflight', tool: 'forge_preflight',
    what: 'every gate a command will hit, with fixes — before you run it.' },
  { step: 'train', tool: '(terminal) nmt-forge run config.json',
    what: 'the GPU job — not an MCP tool. Run it in the BACKGROUND with '
      + 'output to a log; do NOT poll on a timer — watch the log only for '
      + 'refused|Error|wall-clock|continuity|RUN EXIT (everything else is '
      + 'progress noise that burns your user\'s budget). A live GUI panel '
      + 'auto-opens for the human (port 8377) — it is theirs, not yours. '
      + 'Never invent a time budget: set model.time_budget_hours from what '
      + 'the user says and let the wall-clock gate refuse what cannot fit.' },
  { step: 'evaluate', tool: 'forge_evaluate',
    what: 'decode battery with the selected checkpoint + score + diagnose.' },
  { step: 'diagnose', tool: 'forge_lint',
    what: 'weak registers → likeliest cause → the lever to pull next.' },
];

const TAXONOMY_POINTER =
  'Full failure taxonomy (failure → symptom an agent sees → the guard/lint '
  + 'that catches it → fix, plus a ranked GAP list): forge/docs/'
  + 'FAILURE_TAXONOMY.md in the monorepo. The forge_* MCP tools drive each '
  + 'guard; get_training_guardrails (this tool) is the rulebook behind them.';

/**
 * @param {string} [topic]  Optional filter: a guardrail id or a substring of
 *                          its name/rule (case-insensitive).
 * @returns {{status: string, matched: number, guardrails: Array}}
 */
export function trainingGuardrails(topic) {
  if (!topic || !String(topic).trim()) {
    return {
      status: 'ok',
      matched: GUARDRAILS.length,
      guardrails: GUARDRAILS,
      command_order: COMMAND_ORDER,
      taxonomy: TAXONOMY_POINTER,
    };
  }
  const q = String(topic).trim().toLowerCase();
  const hits = GUARDRAILS.filter((g) =>
    g.id === q
    || g.name.toLowerCase().includes(q)
    || g.rule.toLowerCase().includes(q)
    || g.mistake.toLowerCase().includes(q));
  return {
    status: hits.length ? 'ok' : 'no-match',
    matched: hits.length,
    topic: q,
    guardrails: hits,
    known_topics: hits.length ? undefined : GUARDRAILS.map((g) => g.id),
  };
}

/**
 * Render a guardrails answer as agent-readable text.
 *
 * @param {{status: string, guardrails: Array, known_topics?: string[]}} answer
 * @returns {string}
 */
export function formatTrainingGuardrails(answer) {
  if (answer.status === 'no-match') {
    return `No guardrail matches "${answer.topic}". Known topics: `
      + `${answer.known_topics.join(', ')}. Call without a topic for all.`;
  }
  const parts = [
    'NMT training guardrails — each rule mechanizes a real, measured mistake',
    '(crk-translate ledger, 2026-07-12). Enforcement: the forge/ package',
    '(nmt-forge) in the Champollion monorepo.',
    '',
  ];
  for (const g of answer.guardrails) {
    parts.push(`## ${g.name}`);
    parts.push(`RULE: ${g.rule}`);
    parts.push(`THE MISTAKE IT KILLS: ${g.mistake}`);
    parts.push(`TOOLING: ${g.forge}`);
    parts.push('');
  }
  if (answer.command_order) {
    parts.push('# The loop — call forge_status first, then follow its '
      + 'next_command; the forge_* tools run each guard:');
    for (const c of answer.command_order) {
      parts.push(`  ${c.step.padEnd(10)} ${c.tool} — ${c.what}`);
    }
    parts.push('');
  }
  if (answer.taxonomy) {
    parts.push(answer.taxonomy);
  }
  parts.push('DOCS (human-readable — share these with the user driving you):');
  parts.push(
    '- Vocabulary, zero background: '
    + 'https://champollion.dev/docs/network/context/mt-training-concepts');
  parts.push(
    '- Step-by-step, agent-forward walkthrough: '
    + 'https://champollion.dev/docs/network/tutorials/train-your-own-model');
  parts.push(
    '- The guardrails on one page: '
    + 'https://champollion.dev/docs/network/getting-started/training-honestly');
  return parts.join('\n').trim();
}
