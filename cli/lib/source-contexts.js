/**
 * source-contexts.js — which gettext contexts (msgctxt) a project's source
 * gives each text.
 *
 * Sync keys a gettext entry with a context as `msgctxt\u0004msgid`, and caches
 * its translation under the context folded into the text (lib/tm-evict.js
 * tmSourceText): "Cancel" the button and "Cancel" the verb are two entries.
 * A caller that translates a bare text in a project (the MCP translate tool
 * with project_dir) needs to know when that text exists there ONLY with a
 * context: a context-free cache entry for it is never read by sync, and only
 * shadows the context-keyed ones (Round 13, Django persona).
 */

import { discoverLocaleLayout, loadSourceUnits } from './locale-layout.js';
import { CONTEXT_SEPARATOR } from './tm-evict.js';

/**
 * Every source text of the project, with whether it has an entry without a
 * context and the contexts it has.
 *
 * @param {object} config - A resolved config (lib/config.js resolveConfig)
 * @param {{ cwd: string }} options
 * @returns {Map<string, { plain: boolean, contexts: string[] }>} source text → its entries
 */
export function sourceTextContexts(config, { cwd }) {
  const layout = discoverLocaleLayout(config, { cwd });
  const out = new Map();
  for (const unit of loadSourceUnits(layout)) {
    for (const [key, value] of Object.entries(unit.flat)) {
      if (typeof value !== 'string') continue;
      if (!out.has(value)) out.set(value, { plain: false, contexts: [] });
      const entry = out.get(value);
      const at = key.indexOf(CONTEXT_SEPARATOR);
      if (at < 0) entry.plain = true;
      else if (!entry.contexts.includes(key.slice(0, at))) entry.contexts.push(key.slice(0, at));
    }
  }
  return out;
}
