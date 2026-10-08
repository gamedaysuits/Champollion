/**
 * Counts that agree with their nouns and verbs — "1 corpus is", "2 corpora
 * are" — instead of "1 are marked" or "report(s)" (Round 7 synthetic user).
 */

/** The word that agrees with `n`: plural(1, 'item') → 'item'; plural(2, 'item') → 'items'. */
export function plural(n, singular, pluralForm = `${singular}s`) {
  return Number(n) === 1 ? singular : pluralForm;
}

/** `n` and the noun that agrees with it: count(1, 'row') → '1 row'; count(3, 'corpus', 'corpora') → '3 corpora'. */
export function count(n, singular, pluralForm = `${singular}s`) {
  return `${n} ${plural(n, singular, pluralForm)}`;
}
