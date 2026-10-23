import React from 'react';
import REC from '@site/src/data/rails-demo/recording.json';
import {facts} from '@site/src/utils/railsDemo.mjs';

/**
 * WalkFact — one number from the recorded walk, read, never typed.
 *
 * The people's docs follow the homepage's invented family through the rails.
 * Their numbers are what the tools printed in that recorded walk
 * (src/data/rails-demo/recording.json, via railsDemo.facts — which throws
 * when the recording changes shape). `of` is a dotted path into facts(), e.g.
 * "trainingFiles.0.pairs" or "twins.n". A path that finds nothing throws, so
 * a page can never show a stale or invented figure.
 */
const F = facts(REC);

export function walkFact(of) {
  const v = of.split('.').reduce((o, k) => (o == null ? undefined : o[k]), F);
  if (v === undefined || v === null || typeof v === 'object') {
    throw new Error(`WalkFact: "${of}" is not a number or word in the recorded walk`);
  }
  return v;
}

/** `round` shows a whole number ("about 19" reads better than "19.34"). */
export default function WalkFact({of, round}) {
  const v = walkFact(of);
  return <span translate="no">{String(round && typeof v === 'number' ? Math.round(v) : v)}</span>;
}
