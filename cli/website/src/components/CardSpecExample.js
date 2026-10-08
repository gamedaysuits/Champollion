import React from 'react';
import CodeBlock from '@theme/CodeBlock';
import example from '@site/src/data/card-spec-example.json';

/**
 * CardSpecExample — renders the Language Card Specification page's canonical
 * example straight from the build-time artifact derived from the LIVE corpus
 * (plugins/shared-data/generateCardSpecExample.js). House standard (CLAUDE.md
 * "Data over code"; the SSOTCount pattern): the spec page never hand-types a
 * card — it renders the real one, so the example cannot drift from the
 * corpus again.
 *
 * FAIL LOUD: a missing artifact fails the webpack import; a malformed one
 * throws during SSR, which fails the production build. No fallbacks.
 *
 * Usage (MDX):
 *   import CardSpecExample from '@site/src/components/CardSpecExample';
 *   <CardSpecExample variant="language" />   — the full crk card, verbatim
 *   <CardSpecExample variant="locale" />     — the fra-CA locale-identity excerpt
 */

function fail(message) {
  throw new Error(`[CardSpecExample] ${message} — regenerate src/data/card-spec-example.json (site build does this when the card corpus is present)`);
}

/** Resolve a display value from a flat value or an attribution envelope. */
function displayValue(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof v.consensus === 'string') return v.consensus;
  return null;
}

export default function CardSpecExample({variant}) {
  if (!example || !example._meta || !example.language) {
    fail('artifact is missing its _meta/language sections');
  }

  if (variant === 'language') {
    const card = example.language;
    const meta = example._meta.language;
    const name = displayValue(card.name);
    if (!name || !meta.sourceCard || !meta.revision) {
      fail('language example lacks a resolvable name/source/revision');
    }
    return (
      <>
        <p>
          <strong>
            The live <code>{card.code}</code> ({name}) card, verbatim
          </strong>{' '}
          — re-derived from <code>{meta.sourceCard}</code> on every site build
          (card revision <code>{meta.revision}</code>).
        </p>
        <CodeBlock language="json" title={meta.sourceCard} showLineNumbers>
          {JSON.stringify(card, null, 2)}
        </CodeBlock>
      </>
    );
  }

  if (variant === 'locale') {
    const excerpt = example.localeExcerpt;
    const meta = example._meta.locale;
    if (!excerpt || !excerpt.locale || !meta.sourceCard || !meta.revision) {
      fail('locale excerpt lacks its locale block/source/revision');
    }
    return (
      <>
        <p>
          <strong>
            Locale-identity fields of the live <code>{excerpt.code}</code> card
          </strong>{' '}
          — an excerpt ({meta.excerptFields.map((f) => (
            <code key={f}>{f}</code>
          )).reduce((acc, el) => (acc === null ? [el] : [...acc, ', ', el]), null)}) of{' '}
          <code>{meta.sourceCard}</code>, re-derived on every site build (card
          revision <code>{meta.revision}</code>). The rest of the card carries
          French&apos;s facts, resolved for Canada.
        </p>
        <CodeBlock language="json" title={`${meta.sourceCard} (excerpt)`}>
          {JSON.stringify(excerpt, null, 2)}
        </CodeBlock>
      </>
    );
  }

  return fail(`unknown variant "${variant}" (expected "language" or "locale")`);
}
