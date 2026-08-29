/**
 * submit — declarative model behind `champollion submit`.
 *
 * The CLI front door to Champollion's REVIEW-GATED community submission path.
 * It gathers the fields a submission needs and hands the contributor a
 * pre-filled GitHub issue URL (and, optionally, a local submission JSON). The
 * GitHub issue IS the review queue: a maintainer reads it and — only after an
 * IP / license / sovereignty review — adds the entry to the relevant
 * source-of-truth. Nothing here writes to a registry, a card, or a database,
 * and nothing is auto-approved. See docs/SUBMISSION_REVIEW.md.
 *
 * This module is the single source of truth for the submission TYPES and their
 * fields. The field `id`s MUST stay in lockstep with the GitHub issue forms in
 * .github/ISSUE_TEMPLATE/*.yml — the issue-form pre-fill query params are keyed
 * by these ids. A parity test (cli/test/submit.test.js) checks that alignment.
 *
 * Pure + side-effect-free: every export is a plain function over plain data, so
 * it is trivially unit-testable and reused by the interactive wizard, the
 * non-interactive flag path, the URL builder, and the local-JSON writer alike.
 *
 * @see cli/lib/commands/submit.js
 * @see .github/ISSUE_TEMPLATE/
 */

/**
 * The compliance attestation every submission must carry. A single source of
 * truth so the CLI, the issue forms, and the docs all say the SAME thing.
 */
export const ATTESTATION_TEXT =
  'I confirm this is publicly listable, contains NO corpus content or personal data, ' +
  "and respects the source's license and any community/sovereignty restrictions.";

/** Repo the issue forms live in. Overridable, but this is the real default. */
export const DEFAULT_REPO_BASE = 'https://github.com/gamedaysuits/Champollion';

// Field-kind cheat sheet:
//   input  — single-line free text
//   text   — multi-line free text (textarea)
//   choice — one-of a fixed list (`choices`)
//   bool   — a required confirmation (attestation / consent); never sent in the
//            pre-fill URL (GitHub can't pre-check a checkbox), only recorded
//            locally and enforced by validation.

/**
 * The six submission types. Each maps to exactly one GitHub issue form and one
 * downstream source-of-truth (recorded in `ssot` for the maintainer doc, not
 * touched here). `primary: true` marks the field used to build the issue title.
 */
export const SUBMISSION_TYPES = [
  {
    key: 'dataset',
    label: 'Benchmark / dataset',
    template: '01-dataset.yml',
    titlePrefix: '[Dataset] ',
    labels: ['submission', 'submission:dataset', 'needs-review'],
    ssot: 'arena/datasets/registry.json (+ a corpora-card)',
    blurb: 'An evaluation corpus or benchmark — metadata + a fetch-from-source pointer only, never the corpus content.',
    fields: [
      { id: 'dataset-name', label: 'Dataset name', kind: 'input', required: true, primary: true },
      { id: 'pairs', label: 'Language pair(s) (ISO 639-3, e.g. eng-crk; one per line)', kind: 'text', required: true },
      { id: 'license', label: 'License', kind: 'choice', required: true,
        choices: ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'CC-BY-NC-4.0', 'Proprietary / all rights reserved', 'Other / unsure'] },
      { id: 'license-url', label: 'License URL', kind: 'input' },
      { id: 'source-url', label: 'Source / canonical URL', kind: 'input', required: true },
      { id: 'fetch-url', label: 'Fetch-from-source pointer (archive/repo URL)', kind: 'input' },
      { id: 'size', label: 'Size (number of sentence pairs)', kind: 'input' },
      { id: 'domain', label: 'Domain (news, conversational, educational, …)', kind: 'input' },
      { id: 'contamination', label: 'Contamination risk', kind: 'choice',
        choices: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'Unsure'] },
      { id: 'held-out', label: 'Held-out / test split?', kind: 'choice',
        choices: ['No — public / dev split', 'Yes — held-out test split', 'Unsure'] },
      { id: 'notes', label: 'Anything else', kind: 'text' },
      { id: 'attestation', label: ATTESTATION_TEXT, kind: 'bool', required: true },
    ],
  },
  {
    key: 'resource',
    label: 'Resource (dictionary / archive / app / FST / tool)',
    template: '02-resource.yml',
    titlePrefix: '[Resource] ',
    labels: ['submission', 'submission:resource', 'needs-review'],
    ssot: 'a language card / resource entry',
    blurb: 'A dictionary, archive, app, morphological analyzer (FST), or tool — listed as a pointer, never copied.',
    fields: [
      { id: 'resource-name', label: 'Resource name', kind: 'input', required: true, primary: true },
      { id: 'resource-type', label: 'Resource type', kind: 'choice', required: true,
        choices: ['Dictionary / lexicon', 'Archive / corpus collection', 'App / web service', 'FST / morphological analyzer', 'Tool / library', 'Other'] },
      { id: 'languages', label: 'Language(s) (ISO 639-3, one per line)', kind: 'text', required: true },
      { id: 'license', label: 'License', kind: 'choice', required: true,
        choices: ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'CC-BY-NC-4.0', 'GPL / AGPL', 'Apache-2.0 / MIT / permissive', 'Proprietary / all rights reserved', 'Other / unsure'] },
      { id: 'license-url', label: 'License URL', kind: 'input' },
      { id: 'source-url', label: 'Source / homepage URL', kind: 'input', required: true },
      { id: 'access-level', label: 'Access level', kind: 'choice', required: true,
        choices: ['open — freely accessible', 'restricted — login / request / paywall', 'consent-required — community / custodian permission needed'] },
      { id: 'description', label: 'Description', kind: 'text' },
      { id: 'notes', label: 'Anything else', kind: 'text' },
      { id: 'attestation', label: ATTESTATION_TEXT, kind: 'bool', required: true },
    ],
  },
  {
    key: 'method',
    label: 'Translation method',
    template: '03-method.yml',
    titlePrefix: '[Method] ',
    labels: ['submission', 'submission:method', 'needs-review'],
    ssot: 'shared/method-registry.json (+ a runtime adapter)',
    blurb: 'A translation method / MT engine / LLM provider for the method registry.',
    fields: [
      { id: 'method-name', label: 'Method / engine name (kebab-case id)', kind: 'input', required: true, primary: true },
      { id: 'kind', label: 'Kind', kind: 'choice', required: true,
        choices: ['mt-api', 'llm-provider', 'local-model', 'plugin'] },
      { id: 'method-class', label: 'Method class', kind: 'choice', required: true,
        choices: ['raw-llm', 'coached-llm', 'pipeline', 'custom-plugin', 'api', 'human'] },
      { id: 'paradigm', label: 'Paradigm', kind: 'choice', required: true,
        choices: ['rule-based', 'statistical', 'neural-nmt', 'llm', 'hybrid', 'human', 'unknown'] },
      { id: 'languages', label: 'Languages / pairs supported (one per line; "any" is fine)', kind: 'text' },
      { id: 'license', label: 'License (the real one — Apache-2.0, AGPL-3.0, proprietary ToS, …)', kind: 'input', required: true },
      { id: 'homepage', label: 'Homepage / source URL', kind: 'input', required: true },
      { id: 'env', label: 'API-key environment variable(s) — names only, never a key', kind: 'input' },
      { id: 'commercial-ready', label: 'Commercial-ready?', kind: 'choice',
        choices: ['yes', 'no', 'unknown'] },
      { id: 'description', label: 'Description', kind: 'text' },
      { id: 'attestation', label: ATTESTATION_TEXT, kind: 'bool', required: true },
    ],
  },
  {
    key: 'human-service',
    label: 'Human translation service',
    template: '04-human-service.yml',
    titlePrefix: '[Human service] ',
    labels: ['submission', 'submission:human-service', 'needs-review'],
    ssot: 'shared/human-services.json',
    blurb: 'An opt-in human translation provider keyed by language pair. Contact PII is supplied out-of-band, never in the issue.',
    fields: [
      { id: 'display-name', label: 'Provider display name (consented public name)', kind: 'input', required: true, primary: true },
      { id: 'provider-type', label: 'Provider type', kind: 'choice', required: true,
        choices: ['community_org', 'agency', 'individual'] },
      { id: 'pairs', label: 'Language pair(s) (ISO 639-3 source→target, one per line)', kind: 'text', required: true },
      { id: 'variety', label: 'Variety / script (e.g. SRO, Latn)', kind: 'input' },
      { id: 'dispatch-channel', label: 'Dispatch channel (the address itself is PII — omit it)', kind: 'choice',
        choices: ['email', 'webhook', 'api'] },
      { id: 'turnaround-days', label: 'Typical turnaround (days)', kind: 'input' },
      { id: 'rate-per-word', label: 'Rate per source word', kind: 'input' },
      { id: 'domains', label: 'Domains served', kind: 'input' },
      { id: 'nc-terms', label: 'Non-commercial / community-set terms (if any)', kind: 'input' },
      { id: 'sovereignty-notes', label: 'Sovereignty / data-handling notes', kind: 'text' },
      { id: 'consent', label: 'The provider has explicitly consented to be listed publicly.', kind: 'bool', required: true },
      { id: 'attestation', label: ATTESTATION_TEXT, kind: 'bool', required: true },
    ],
  },
  {
    key: 'external-result',
    label: 'External published result',
    template: '05-external-result.yml',
    titlePrefix: '[External result] ',
    labels: ['submission', 'submission:external-result', 'needs-review'],
    ssot: 'the external-results catalogue (shared/external-results.json — created on first acceptance)',
    blurb: 'A published result from another system/paper — cited, never re-hosted or re-ranked as our own measurement.',
    fields: [
      { id: 'system-name', label: 'System / method name', kind: 'input', required: true, primary: true },
      { id: 'pairs', label: 'Language pair(s) (ISO 639-3 source→target, one per line)', kind: 'text', required: true },
      { id: 'dataset', label: 'Dataset / benchmark', kind: 'input', required: true },
      { id: 'metric', label: 'Metric', kind: 'choice', required: true,
        choices: ['chrF++', 'chrF', 'BLEU', 'COMET', 'TER', 'Other'] },
      { id: 'metric-variant', label: 'Metric variant / signature (e.g. a sacreBLEU signature)', kind: 'input' },
      { id: 'score', label: 'Score', kind: 'input', required: true },
      { id: 'citation', label: 'Citation / paper URL', kind: 'input', required: true },
      { id: 'notes', label: 'Anything else', kind: 'text' },
      { id: 'attestation', label: ATTESTATION_TEXT, kind: 'bool', required: true },
    ],
  },
  {
    key: 'card-correction',
    label: 'Language-card correction',
    template: '06-card-correction.yml',
    titlePrefix: '[Card] ',
    labels: ['submission', 'submission:card-correction', 'needs-review'],
    ssot: 'the feeding data source / generator (cards are regenerated, never hand-edited)',
    blurb: 'A language card shows something wrong, outdated, or missing — corrections are applied at the data source and cite their own source.',
    fields: [
      { id: 'language', label: 'Language (name and code, e.g. Plains Cree (crk))', kind: 'input', required: true, primary: true },
      { id: 'card-field', label: 'Which part of the card (field or section)', kind: 'input', required: true },
      { id: 'current-value', label: 'What the card shows now', kind: 'text', required: true },
      { id: 'proposed-value', label: 'What it should show', kind: 'text', required: true },
      { id: 'source', label: 'Source for the correction (URL / reference / knowledge-holder with consent)', kind: 'text', required: true },
      { id: 'relationship', label: 'Your relationship to this language (optional)', kind: 'choice',
        choices: ['Speaker / community member', 'Community organization / language authority', 'Researcher / linguist', 'Resource maintainer / publisher', 'Other / prefer not to say'] },
      { id: 'notes', label: 'Anything else (incl. removal/restriction requests)', kind: 'text' },
      { id: 'attestation', label: ATTESTATION_TEXT, kind: 'bool', required: true },
    ],
  },
];

/** Aliases that resolve to a canonical type key (forgiving CLI input). */
const TYPE_ALIASES = {
  dataset: 'dataset', benchmark: 'dataset', corpus: 'dataset', data: 'dataset',
  resource: 'resource', dictionary: 'resource', archive: 'resource', app: 'resource', fst: 'resource', tool: 'resource',
  method: 'method', engine: 'method', model: 'method',
  'human-service': 'human-service', human: 'human-service', 'human-translation': 'human-service', service: 'human-service', translator: 'human-service',
  'external-result': 'external-result', external: 'external-result', result: 'external-result', published: 'external-result',
  'card-correction': 'card-correction', card: 'card-correction', correction: 'card-correction', fix: 'card-correction',
};

/**
 * Resolve a free-form type token (key, alias, label, or 1-based list number)
 * to its submission-type object. Returns null when nothing matches.
 *
 * @param {string|number} input
 * @returns {object|null}
 */
export function resolveType(input) {
  if (input == null || input === '') return null;
  const raw = String(input).trim().toLowerCase();
  // 1-based list number
  if (/^\d+$/.test(raw)) {
    const idx = Number(raw) - 1;
    return SUBMISSION_TYPES[idx] || null;
  }
  const canon = TYPE_ALIASES[raw];
  if (canon) return SUBMISSION_TYPES.find((t) => t.key === canon) || null;
  // direct key or label match
  return SUBMISSION_TYPES.find(
    (t) => t.key === raw || t.label.toLowerCase() === raw,
  ) || null;
}

/**
 * Normalize a package.json `repository.url` (or any GitHub URL) to the
 * `https://github.com/<owner>/<repo>` base used to build issue links. Falls
 * back to DEFAULT_REPO_BASE for anything unrecognizable (never throws).
 *
 * @param {string} [repoUrl]
 * @returns {string}
 */
export function repoBaseFromRepository(repoUrl) {
  if (!repoUrl) return DEFAULT_REPO_BASE;
  // Matches both https (git+https://github.com/o/r.git) and ssh
  // (git@github.com:o/r.git) forms.
  const m = String(repoUrl).match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/i);
  if (!m) return DEFAULT_REPO_BASE;
  return `https://github.com/${m[1]}/${m[2]}`;
}

/**
 * Validate a gathered submission: every required field present, and the
 * attestation (and, for human services, consent) affirmatively checked.
 * Collects ALL problems and fails loud — never silently drops a field.
 *
 * @param {object} type   one of SUBMISSION_TYPES
 * @param {Record<string,*>} values
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateSubmission(type, values = {}) {
  const errors = [];
  if (!type) return { ok: false, errors: ['unknown submission type — run `champollion submit --list`'] };
  for (const f of type.fields) {
    const v = values[f.id];
    if (f.kind === 'bool') {
      // Required confirmations must be an affirmative true.
      if (f.required && v !== true) {
        errors.push(`you must confirm: "${f.label}"`);
      }
      continue;
    }
    if (f.required) {
      const empty = v == null || String(v).trim() === '';
      if (empty) errors.push(`missing required field: ${f.id} (${f.label})`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** The field whose value seeds the issue title (the `primary` one). */
function primaryField(type) {
  return type.fields.find((f) => f.primary) || null;
}

/**
 * Build the pre-filled GitHub issue-form URL. The query is keyed by issue-form
 * field `id` (so the ids here MUST match the .yml forms). Empty values and
 * `bool` fields are omitted — GitHub cannot pre-check a checkbox, and the human
 * must tick the attestation themselves in the browser.
 *
 * @param {object}  args
 * @param {object}  args.type      one of SUBMISSION_TYPES
 * @param {Record<string,*>} args.values
 * @param {string} [args.repoBase] defaults to DEFAULT_REPO_BASE
 * @returns {string} an absolute https URL
 */
export function buildIssueUrl({ type, values = {}, repoBase = DEFAULT_REPO_BASE }) {
  const params = new URLSearchParams();
  params.set('template', type.template);
  params.set('labels', type.labels.join(','));

  const pf = primaryField(type);
  const primaryVal = pf ? String(values[pf.id] ?? '').trim() : '';
  params.set('title', `${type.titlePrefix}${primaryVal}`.trimEnd());

  for (const f of type.fields) {
    if (f.kind === 'bool') continue; // checkboxes can't be pre-checked via URL
    const v = values[f.id];
    if (v == null || String(v).trim() === '') continue;
    params.set(f.id, String(v));
  }
  return `${repoBase}/issues/new?${params.toString()}`;
}

/**
 * Build a content-free local submission record (what `--out` writes). Carries
 * the gathered metadata + the issue URL — never corpus content or PII; the
 * contributor is responsible for honoring the attestation they confirmed.
 *
 * @param {object} args
 * @param {object} args.type
 * @param {Record<string,*>} args.values
 * @param {string} [args.repoBase]
 * @param {string} [args.generatedAt] ISO timestamp (caller supplies; this module stays clock-free)
 * @returns {object}
 */
export function buildSubmissionRecord({ type, values = {}, repoBase = DEFAULT_REPO_BASE, generatedAt = null }) {
  const fields = {};
  for (const f of type.fields) {
    if (f.kind === 'bool') continue;
    const v = values[f.id];
    if (v == null || String(v).trim() === '') continue;
    fields[f.id] = String(v);
  }
  return {
    champollion_submission: 1,
    type: type.key,
    target_ssot: type.ssot,
    fields,
    attestation: {
      text: ATTESTATION_TEXT,
      confirmed: values.attestation === true,
      ...(type.fields.some((f) => f.id === 'consent')
        ? { provider_consent: values.consent === true }
        : {}),
    },
    review: 'human-reviewed — not auto-approved',
    issueUrl: buildIssueUrl({ type, values, repoBase }),
    ...(generatedAt ? { generatedAt } : {}),
  };
}
