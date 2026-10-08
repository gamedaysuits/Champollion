#!/usr/bin/env node
/**
 * generate-social-cards.mjs — render the og:image PNGs from their SVG
 * sources with headless Chrome (the documented pipeline: DESIGN.md §6,
 * "Regenerate with headless Chrome: --headless --screenshot
 * --window-size=1200,630").
 *
 * Sources → outputs (both 1200×630):
 *   cli/website/static/img/champollion-social-card.svg → .png
 *
 * The SVGs reference the self-hosted woff2 fonts via ../fonts/, so they
 * must be rendered from their on-disk location (file:// URL), not from
 * a copy. Run:  node scripts/generate-social-cards.mjs
 */
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const websiteDir = path.resolve(here, '..');

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error(
    'No Chrome/Chromium binary found. Set CHROME_BIN to a headless-capable browser.',
  );
  process.exit(1);
}

const CARDS = [
  {
    svg: path.join(websiteDir, 'static/img/champollion-social-card.svg'),
    png: path.join(websiteDir, 'static/img/champollion-social-card.png'),
  },
  // (The Arena had its own social card; arena/website was retired 2026-06-20
  // when the Arena merged into this site, so only the champollion card remains.)
];

for (const {svg, png} of CARDS) {
  if (!existsSync(svg)) {
    console.error(`Missing SVG source: ${svg}`);
    process.exit(1);
  }
  execFileSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--screenshot=${png}`,
      '--window-size=1200,630',
      pathToFileURL(svg).href,
    ],
    {stdio: ['ignore', 'ignore', 'inherit']},
  );
  console.log(`rendered ${path.relative(websiteDir, png)}`);
}
