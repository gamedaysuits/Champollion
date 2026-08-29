#!/usr/bin/env node

/**
 * sync-lyss-ip-notice.mjs
 * ────────────────────────────────────────────────────────────────
 * Stamps `evalStandard.ipNotice` on every card whose eval standard is
 * champollion-lyss, from the template below — so the card copy of the
 * Plains Cree data-sovereignty notice is GENERATED, never hand-edited.
 *
 * SSOT: the runtime notice lives in
 *   lyss/champollion_lyss/crk/_ip_notice.py  (IP_NOTICE_TEXT)
 * The card carries a prose rendering of the same commitments. To keep the
 * two from drifting on the governed phrases, this script ASSERTS that the
 * lyss source still contains each phrase in GOVERNED_PHRASES and fails
 * loudly if not (then update both texts together, deliberately).
 *
 * House terminology rule: the posture is "sovereignty-aspirant" — Indigenous
 * data-sovereignty principles (community ownership and control of language
 * data) are aspired to, never claimed as compliance with any named framework.
 *
 * Usage:
 *   node scripts/sync-lyss-ip-notice.mjs            # apply
 *   node scripts/sync-lyss-ip-notice.mjs --dry-run  # preview
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(CLI_ROOT, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const LYSS_NOTICE_PY = path.join(REPO_ROOT, 'lyss', 'champollion_lyss', 'crk', '_ip_notice.py');
const DRY_RUN = process.argv.includes('--dry-run');

const CARD_IP_NOTICE = `Plains Cree (nêhiyawêwin) data sovereignty — please read.

The Cree LYSS validation standard and any Plains Cree language data are treated as the property of the nêhiyaw language community and are offered for NON-COMMERCIAL, community-benefit use (relational-trust governance in progress).

Gloss data is fetched live from the public itwêwina API (itwewina.altlab.app) and cached locally for your own use only. The underlying dictionary content (Wolvengrey CW, Maskwacîs MD, AECD) is NOT openly licensed — do not commit, redistribute, publish, or bundle the cache. The Cree FST (GiellaLT/ALTLab, AGPL) is downloaded and invoked as a separate tool, never bundled.

By installing and running this standard you agree to respect these terms. Set CHAMPOLLION_LYSS_ACCEPT_IP=1 to acknowledge in automation.`;

// Phrases that must appear in BOTH the lyss runtime notice and the card
// rendering. If the lyss text changes one of these, this script fails until
// the template above is updated in the same commit.
const GOVERNED_PHRASES = [
  'NON-COMMERCIAL',
  'relational-trust governance in progress',
  'nêhiyaw',
];

// Whitespace-tolerant containment: the lyss notice box hard-wraps lines,
// so a governed phrase may span a newline + indent.
const squash = (s) => s.replace(/\s+/g, ' ');
const lyssSource = squash(fs.readFileSync(LYSS_NOTICE_PY, 'utf-8'));
const missing = GOVERNED_PHRASES.filter((p) => !lyssSource.includes(squash(p)));
if (missing.length) {
  console.error(
    `✗ lyss _ip_notice.py no longer contains governed phrase(s): ${missing.join(', ')}\n` +
    '  Update CARD_IP_NOTICE in this script and the lyss text together, then re-run.',
  );
  process.exit(1);
}
const missingInCard = GOVERNED_PHRASES.filter((p) => !squash(CARD_IP_NOTICE).includes(squash(p)));
if (missingInCard.length) {
  console.error(`✗ CARD_IP_NOTICE missing governed phrase(s): ${missingInCard.join(', ')}`);
  process.exit(1);
}

let stamped = 0;
let unchanged = 0;
for (const f of fs.readdirSync(CARDS_DIR)) {
  if (!f.endsWith('.json')) continue;
  const p = path.join(CARDS_DIR, f);
  let card;
  try {
    card = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    continue;
  }
  if (card.evalStandard?.package !== 'champollion-lyss') continue;
  if (card.evalStandard.ipNotice === CARD_IP_NOTICE) {
    unchanged++;
    continue;
  }
  card.evalStandard.ipNotice = CARD_IP_NOTICE;
  stamped++;
  if (!DRY_RUN) {
    fs.writeFileSync(p, JSON.stringify(card, null, 2) + '\n');
  }
  console.log(`${DRY_RUN ? '[dry-run] would stamp' : '✓ stamped'} ${f}`);
}
console.log(`done: ${stamped} stamped, ${unchanged} already current`);
