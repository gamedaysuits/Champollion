/**
 * The ONE `champollion network register-corpus` command this server suggests
 * for a community's own test file — used by language_overview's "protect your
 * data" step and the private-test-set training guardrail, so the two cannot
 * drift apart.
 *
 * Round 7: the guardrail's copy left out --domain, which the CLI requires
 * ("A domain is required (--domain)"), so the suggested command failed as
 * printed; and without --yes a user who pastes it into a terminal gets the
 * interactive wizard, which ignores the flags. With --data the CLI writes the
 * `<file>.champollion.json` sidecar ({"transmission": "local-only"}) itself,
 * beside a metadata card; the file's text is read only to count and hash it.
 * test/register-corpus-hint.test.js runs this exact command through the real
 * CLI when the monorepo's cli/ is present.
 *
 * Round 12 (synthetic hospital persona): every copy of the command left out
 * --role, so the test set it registered was saved with "Role: not stated" and
 * an id that names no role. Every caller registers the community's TEST set,
 * so the command says so (`--role test`); the CLI never guesses a role.
 */

/** What every caller of registerLocalOnlyCommand registers: the community's held-out test set. */
export const REGISTERED_ROLE = 'test';

/**
 * @param {object} [o]
 * @param {string} [o.file]     the test file
 * @param {string} [o.name]     a name for the set
 * @param {string} [o.pair]     the pair, dash form (eng-crk) — no quoting needed
 * @param {string} [o.license]  a licence id (`champollion network register-corpus --list`)
 * @param {string} [o.domain]   news, conversational, educational, medical, …
 * @returns {string}
 */
export function registerLocalOnlyCommand({
  file = '<file>', name = '<name>', pair = '<src>-<tgt>', license = '<licence id>', domain = '<domain>',
} = {}) {
  const data = /\s/.test(file) ? `"${file}"` : file;
  return `champollion network register-corpus --yes --tier local-only --data ${data} `
    + `--name "${name}" --pair ${pair} --license "${license}" --domain ${domain} --role ${REGISTERED_ROLE}`;
}

/** What that command does, in one clause. */
export const REGISTER_LOCAL_ONLY_EFFECT = 'it writes the sidecar `<file>.champollion.json` = '
  + '{"transmission":"local-only"} itself (plus a metadata card beside the file; the text is read only '
  + 'to count and checksum it); `--list` shows the licence ids';

/**
 * What comes right after that command when a model may be trained — the
 * guide's "register, screen, predict — before any score" step, as one line.
 *
 * Round 10 (school + hospital personas): register-corpus's own `Next:` line
 * and language_overview's numbered steps both went straight to a benchmark of
 * the test file. A benchmark is a scoring read, and forge refuses a
 * preregistration written after one, so an agent that followed the numbers
 * in order lost the predictions. Every MCP text that names a baseline on the
 * user's own test set says this first, from here, so they cannot drift.
 *
 * @param {object} [o]
 * @param {string} [o.code]   the language code forge_init gets
 * @param {boolean} [o.noCard] a private-use code (qaa–qtz): forge_init with no_card
 * @param {string} [o.name]   the language's name (no_card only)
 * @returns {string}
 */
export function forgeBeforeBaselineSteps({ code = '<code>', noCard = false, name = '<the language\'s name>' } = {}) {
  const init = noCard
    ? `forge_init { "code": "${code}", "no_card": true, "name": "${name}" }`
    : `forge_init { "code": "${code}" }`;
  return `${init} → forge_register_eval { "name": "project-test", "path": "<test file>", "role": "test", "project_dir": "<dir>" } `
    + '→ forge_leak_audit { "corpus": "<training corpus>", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" } '
    + '(its reads are audit reads, never scoring ones; a SEVERE verdict means two models — all data, and a twin-free one '
    + 'from drop_test_twins with its OWN clean_to, "corpus.notwins.jsonl") → forge_prereg_template → '
    + 'forge_prereg { id, eval_set, predictions } with the user, one per planned model, named after it';
}

/** Why that comes before any benchmark, in one clause. */
export const BENCHMARK_IS_A_SCORING_READ = 'a benchmark of the test file is a scoring read, and forge refuses a '
  + 'preregistration written after one';
