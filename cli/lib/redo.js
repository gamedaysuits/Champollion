/**
 * --redo / --fresh: one way to say "translate this again".
 *
 * Six flags had grown up around re-translation, each with its own cache
 * rule (--force, --force-keys, --force-content, --retranslate, --no-tm,
 * --fresh-on-model-change), and people could not tell which one cost money.
 * Two words now carry the whole idea:
 *
 *   --redo <scope>   queue this again. The cache still serves anything it
 *                    already holds (gate-checked), so a redo is cheap.
 *                    all | keys:<k1,k2> | content | files:<glob> | gaps
 *                    (gaps: every plural message on disk that lacks a form
 *                    its language uses for ordinary counts — asked from the
 *                    model, never the cache, which holds the incomplete
 *                    answer; lib/plural-gap-redo.js)
 *                    (repeatable: --redo keys:a.b --redo files:docs/**)
 *   --fresh          do not use the cache: what is queued is paid for again.
 *
 * `--redo files:X --fresh` is exactly the old `--retranslate X`. The old
 * flags still work as written; this module only translates the new words
 * into them, so sync itself has one set of semantics.
 * --fresh-on-model-change stays separate: it is a policy for model
 * switches, not a redo.
 */

const SCOPES = 'all | keys:<k1,k2> | content | files:<glob> | gaps';

/**
 * Split a comma-separated key list, honouring `\,` for a comma INSIDE a key.
 * gettext keys are whole sentences ("Welcome, %(name)s"), so a plain split
 * made them impossible to name in --force-keys / --redo keys:.
 * @param {string} list
 * @returns {string[]}
 */
export function splitKeyList(list) {
  return String(list ?? '')
    .split(/(?<!\\),/)
    .map((k) => k.replace(/\\,/g, ',').trim())
    .filter(Boolean);
}

/** Inverse of splitKeyList for one key. */
const escapeKey = (k) => k.replace(/,/g, '\\,');

/**
 * Rewrite args in place. Returns an error message, or null.
 * @param {object} args parsed CLI args
 * @returns {string|null}
 */
export function applyRedo(args) {
  const scopes = [].concat(args.redo || []).map((s) => String(s).trim()).filter(Boolean);
  if (args.redo !== undefined && scopes.length === 0) {
    return `--redo needs a scope: ${SCOPES}`;
  }
  const fresh = Boolean(args.fresh);
  let keyScope = false;

  for (const scope of scopes) {
    const m = /^(all|content|keys|files|gaps)(?::(.*))?$/.exec(scope);
    if (!m) return `--redo ${scope}: unknown scope. Use ${SCOPES}`;
    const [, kind, value] = m;
    if ((kind === 'keys' || kind === 'files') && !value) {
      return `--redo ${kind}: needs a value, e.g. --redo ${kind === 'keys' ? 'keys:nav.home,nav.about' : 'files:docs/intro.md'}`;
    }
    if ((kind === 'all' || kind === 'content' || kind === 'gaps') && value) {
      return `--redo ${kind} takes no value (got "${scope}")`;
    }
    if (kind === 'all') {
      args.force = true;
      keyScope = true;
    } else if (kind === 'keys') {
      const keys = [...splitKeyList(args['force-keys']), ...splitKeyList(value)];
      args['force-keys'] = keys.map(escapeKey).join(',');
      keyScope = true;
    } else if (kind === 'gaps') {
      args['redo-gaps'] = true;
      keyScope = true;
    } else if (kind === 'content') {
      args['force-content'] = true;
      keyScope = true; // content blocks are cache-served too; --fresh bills them
    } else if (kind === 'files') {
      if (fresh) {
        args.retranslate = [...[].concat(args.retranslate || []), value];
      } else {
        args.files = [...[].concat(args.files || []), value];
        args['force-content'] = true;
      }
    }
  }

  // --fresh on its own, or with a key/content scope: bypass the cache for
  // this run. (A files scope under --fresh is already --retranslate.)
  if (fresh && (scopes.length === 0 || keyScope)) args['no-tm'] = true;
  return null;
}
