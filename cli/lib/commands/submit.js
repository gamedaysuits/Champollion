/**
 * Command: submit
 *
 * The low-friction CLI front door to Champollion's REVIEW-GATED community
 * submission path. It gathers the fields for a chosen submission type and
 * prints a PRE-FILLED GitHub issue URL (optionally also writing a local
 * submission JSON). The GitHub issue IS the human-review queue: a maintainer
 * reviews each one against IP / license / sovereignty rules before adding the
 * entry to the relevant source-of-truth. Nothing here is auto-approved, and
 * this command never writes to a registry, a card, or a database.
 *
 * Six submission types (see lib/submit.mjs / .github/ISSUE_TEMPLATE/):
 *   dataset · resource · method · human-service · external-result · card-correction
 *
 * Interactive wizard when stdin is a TTY; fully scriptable via flags otherwise
 * (--type + --values/--field + --attest, or --yes). See `champollion submit --help`.
 *
 * Exit codes: 0 = URL produced (or cancelled); 1 = invalid/incomplete request.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { output } from '../output.js';
import {
  SUBMISSION_TYPES,
  ATTESTATION_TEXT,
  DEFAULT_REPO_BASE,
  resolveType,
  repoBaseFromRepository,
  validateSubmission,
  buildIssueUrl,
  buildSubmissionRecord,
} from '../submit.mjs';

function isInteractive() {
  return process.stdin.isTTY === true;
}

function ask(rl, question, defaultValue) {
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/** Resolve the repo base from cli/package.json, falling back to the default. */
function resolveRepoBase(args) {
  if (args.repo) return repoBaseFromRepository(args.repo);
  try {
    const pkgUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgUrl, 'utf-8'));
    const repoUrl = pkg?.repository?.url || pkg?.repository;
    return repoBaseFromRepository(repoUrl);
  } catch {
    return DEFAULT_REPO_BASE;
  }
}

const BOOL_RE = /^(true|yes|1|y|on)$/i;

/** Coerce any string-y bool field values (from --values/--field) to real booleans. */
function coerceBools(type, values) {
  for (const f of type.fields) {
    if (f.kind === 'bool' && typeof values[f.id] === 'string') {
      values[f.id] = BOOL_RE.test(values[f.id].trim());
    }
  }
  return values;
}

// ── Interactive wizard ──────────────────────────────────────────────────────

async function pickType(rl, args) {
  const pre = resolveType(args.type);
  if (pre) return pre;
  console.log('');
  console.log('  What are you submitting?');
  console.log('');
  SUBMISSION_TYPES.forEach((t, i) => {
    console.log(`    ${i + 1}. ${t.label}`);
    console.log(`       ${t.blurb}`);
  });
  console.log('');
  const choice = await ask(rl, 'Choose a type (number or name)', '1');
  return resolveType(choice) || SUBMISSION_TYPES[0];
}

async function runInteractive(rl, args) {
  console.log('');
  console.log('  champollion — Submit to the index');
  console.log('  ════════════════════════════════════════════════');
  console.log('');
  console.log('  Every submission is HUMAN-REVIEWED for IP / license / sovereignty');
  console.log('  compliance before anything is added — nothing is auto-approved. This');
  console.log('  command just gathers the fields and hands you a pre-filled GitHub issue.');

  const type = await pickType(rl, args);
  console.log('');
  console.log(`  ${type.label}`);
  console.log('  ────────────────────────────────────────────────');

  const values = {};
  for (const f of type.fields) {
    if (f.kind === 'bool') continue; // handled together at the end
    if (f.kind === 'choice') {
      console.log('');
      console.log(`  ${f.label}${f.required ? '  (required)' : ''}`);
      f.choices.forEach((c, i) => console.log(`    ${i + 1}. ${c}`));
      const pick = await ask(rl, 'Choose', '');
      if (pick) {
        const idx = /^\d+$/.test(pick) ? Number(pick) - 1 : f.choices.findIndex((c) => c.toLowerCase() === pick.toLowerCase());
        values[f.id] = f.choices[idx] != null ? f.choices[idx] : pick;
      }
    } else {
      let v = await ask(rl, `${f.label}${f.required ? '  (required)' : ''}`, '');
      if (!v && f.required) v = await ask(rl, `↳ ${f.id} is required`, '');
      if (v) values[f.id] = v;
    }
  }

  // Confirmations (attestation + any per-type consent) — must be affirmative.
  console.log('');
  console.log('  Confirmation');
  console.log('  ────────────────────────────────────────────────');
  for (const f of type.fields) {
    if (f.kind !== 'bool') continue;
    const yn = await ask(rl, `${f.label}\n    Confirm? (y/N)`, 'N');
    values[f.id] = BOOL_RE.test(yn.trim());
  }
  return { type, values };
}

// ── Non-interactive (flags) ─────────────────────────────────────────────────

function gatherFromFlags(type, args) {
  const values = {};
  if (args.values) {
    try {
      const parsed = JSON.parse(args.values);
      if (parsed && typeof parsed === 'object') Object.assign(values, parsed);
    } catch {
      // Surface as a validation error path: leave values empty so required
      // fields are reported missing rather than silently swallowing bad JSON.
      output.warn('--values was not valid JSON; ignoring it.');
    }
  }
  const fieldFlags = args.field == null ? [] : (Array.isArray(args.field) ? args.field : [args.field]);
  for (const pair of fieldFlags) {
    const s = String(pair);
    const eq = s.indexOf('=');
    if (eq === -1) continue;
    values[s.slice(0, eq).trim()] = s.slice(eq + 1);
  }
  // --attest confirms every required confirmation at once; --consent is a
  // narrower alias for the human-service provider-consent box.
  if (args.attest) for (const f of type.fields) if (f.kind === 'bool') values[f.id] = true;
  if (args.consent) values.consent = true;
  return coerceBools(type, values);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run(args, cwd) {
  if (args.help) {
    showHelp();
    return 0;
  }
  if (args.list) {
    if (args.json) {
      console.log(JSON.stringify({
        types: SUBMISSION_TYPES.map((t) => ({
          key: t.key, label: t.label, template: t.template,
          target_ssot: t.ssot,
          fields: t.fields.map((f) => ({ id: f.id, kind: f.kind, required: !!f.required })),
        })),
        attestation: ATTESTATION_TEXT,
      }, null, 2));
      return 0;
    }
    console.log('');
    console.log('  Submission types (champollion submit --type <key>):');
    console.log('');
    SUBMISSION_TYPES.forEach((t, i) => {
      console.log(`    ${i + 1}. ${t.key} — ${t.label}`);
      console.log(`       ${t.blurb}`);
      console.log(`       → reviewed, then added to: ${t.ssot}`);
    });
    console.log('');
    console.log('  Every submission is human-reviewed; nothing is auto-approved.');
    console.log('');
    return 0;
  }

  const repoBase = resolveRepoBase(args);

  // Gather the submission (interactive wizard or flags).
  let type;
  let values;
  if (!args.yes && isInteractive()) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      ({ type, values } = await runInteractive(rl, args));
    } finally {
      rl.close();
    }
  } else {
    type = resolveType(args.type);
    if (!type) {
      output.error('Choose a submission type with --type (run `champollion submit --list`).');
      return 1;
    }
    values = gatherFromFlags(type, args);
  }

  // Validate — collect every problem, fail loud.
  const v = validateSubmission(type, values);
  if (!v.ok) {
    console.error('[ERR] Cannot build this submission:');
    for (const e of v.errors) console.error(`      • ${e}`);
    console.error('');
    console.error('      The compliance attestation is required. Re-run and confirm it');
    console.error('      (interactively, or pass --attest with the other fields).');
    return 1;
  }

  const issueUrl = buildIssueUrl({ type, values, repoBase });
  const generatedAt = new Date().toISOString();
  const record = buildSubmissionRecord({ type, values, repoBase, generatedAt });

  // Optionally save a local content-free copy.
  let localPath = null;
  if (args.out) {
    localPath = path.resolve(cwd, args.out);
    try {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, JSON.stringify(record, null, 2) + '\n', 'utf-8');
    } catch (e) {
      output.error(`Could not write the local submission file to ${localPath}: ${e.message}`);
      return 1;
    }
  }

  // ── Report ──
  if (args.json) {
    console.log(JSON.stringify({
      ok: true,
      type: type.key,
      target_ssot: type.ssot,
      title: `${type.titlePrefix}${values[type.fields.find((f) => f.primary)?.id] ?? ''}`.trimEnd(),
      labels: type.labels,
      attestationConfirmed: values.attestation === true,
      issueUrl,
      localPath,
      review: 'human-reviewed — not auto-approved',
    }, null, 2));
    return 0;
  }

  console.log('');
  output.ok(`Submission ready: ${type.label}`);
  console.log('');
  console.log('  This will be HUMAN-REVIEWED for IP / license / sovereignty compliance');
  console.log('  before anything is added to the index — nothing is auto-approved.');
  console.log('');
  console.log('  Open this pre-filled GitHub issue to file it (review the attestation box');
  console.log('  in the browser, then submit):');
  console.log('');
  console.log(`    ${issueUrl}`);
  console.log('');
  if (localPath) {
    console.log(`  Saved a local copy: ${localPath}`);
    console.log('');
  }
  return 0;
}

function showHelp() {
  console.log(`
  champollion submit — Propose an entry for the Champollion index (review-gated)

  USAGE
    champollion submit [options]

  DESCRIPTION
    Gather the fields for a submission and print a PRE-FILLED GitHub issue URL
    (optionally writing a local submission JSON). The GitHub issue is the
    human-review queue: a maintainer reviews every submission against IP /
    license / sovereignty rules before adding it to a source-of-truth. Nothing
    is auto-approved, and this command never writes to a registry or database.

    Interactive when run in a terminal; fully scriptable with flags (or --yes).

  SUBMISSION TYPES  (--type)
    dataset           A benchmark / evaluation corpus (metadata + fetch pointer only).
    resource          A dictionary / archive / app / FST / tool (a pointer, not a copy).
    method            A translation method / MT engine / LLM provider.
    human-service     An opt-in human translation provider (contact PII stays out-of-band).
    external-result   A published result from another system/paper (cited, never re-hosted).

  OPTIONS
    --type <key>      Submission type (see --list). Required when non-interactive.
    --values <json>   JSON object of field id → value (e.g. '{"dataset-name":"X"}').
    --field <id=val>  Set one field (repeatable): --field source-url=https://…
    --attest          Confirm the required compliance attestation (and consent).
    --consent         human-service: confirm the provider's listing consent.
    --out <path>      Also write a local content-free submission JSON here.
    --repo <url>      Override the GitHub repo for the issue URL (advanced/testing).
    --list            List the submission types (add --json for JSON).
    --json            Machine-readable output (for agents).
    --yes             Non-interactive; take values from flags.

  ATTESTATION (required on every submission)
    "${ATTESTATION_TEXT}"

  EXAMPLES
    champollion submit                                   # interactive wizard
    champollion submit --list                            # see the types
    # A dataset submission, fully from flags:
    champollion submit --yes --type dataset --attest \\
      --field dataset-name="GlobalVoices eng-amh" \\
      --field pairs=eng-amh --field license=CC-BY-4.0 \\
      --field source-url=https://globalvoices.org
    # An external result, with a saved local copy:
    champollion submit --yes --type external-result --attest --out ./submission.json \\
      --values '{"system-name":"NLLB-200","pairs":"eng-crk","dataset":"FLORES-200","metric":"chrF++","score":"28.4","citation":"https://arxiv.org/abs/2207.04672"}'
  `);
}

export { run };
