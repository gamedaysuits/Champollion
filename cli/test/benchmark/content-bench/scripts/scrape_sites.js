#!/usr/bin/env node
/**
 * scrape_sites.js — Content-Bench Web Scraper
 *
 * Crawls the 100 commercial websites in config/sites.json, fetching each
 * locale variant and saving the raw markdown content to raw/{siteId}/{locale}.md.
 *
 * Handles: rate limiting, timeouts, 403s, redirects. Logs a validation
 * report showing which sites/locales succeeded.
 *
 * Usage:
 *   node scripts/scrape_sites.js [options]
 *
 * Options:
 *   --concurrency N   Max parallel fetches (default: 5)
 *   --timeout N       Request timeout in ms (default: 15000)
 *   --delay N         Delay between requests per domain in ms (default: 1500)
 *   --resume          Skip sites that already have raw files
 *   --only ID         Only scrape a specific site ID
 *   --industry X      Only scrape sites in a specific industry
 *   --dry-run         Show plan without fetching
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BENCH_DIR = path.resolve(import.meta.dirname, '..');
const CONFIG_DIR = path.join(BENCH_DIR, 'config');
const RAW_DIR = path.join(BENCH_DIR, 'raw');
const REPORT_FILE = path.join(BENCH_DIR, 'config', 'scrape_report.json');

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_DELAY = 1500;

// User-Agent that identifies us as a research bot
const USER_AGENT = 'champollion-bench/1.0 (translation-research; +https://github.com/gamedaysuits/champollion)';

// ---------------------------------------------------------------------------
// URL resolution — handles subdirectory vs ccTLD patterns
// ---------------------------------------------------------------------------

/**
 * Resolve a locale path to a full URL.
 *
 * Sites use two patterns:
 *   1. Subdirectory: "/fr/iphone/" → "https://www.apple.com/fr/iphone/"
 *   2. ccTLD/subdomain: "sephora.fr" → "https://www.sephora.fr"
 *
 * We detect the pattern by checking if the path contains a dot (domain).
 */
function resolveUrl(domain, localePath) {
  // If the path looks like a full domain (contains a dot and no leading /)
  if (localePath && !localePath.startsWith('/') && localePath.includes('.')) {
    return `https://www.${localePath}`;
  }
  return `https://www.${domain}${localePath}`;
}

// ---------------------------------------------------------------------------
// HTTP fetch with redirect following and timeout
// ---------------------------------------------------------------------------

function fetchPage(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: timeoutMs,
    }, (res) => {
      // Follow redirects (up to 5)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        fetchPage(redirectUrl, timeoutMs).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf-8');
        resolve(html);
      });
      res.on('error', reject);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// HTML → clean text extraction
// ---------------------------------------------------------------------------

/**
 * Strip HTML to extract readable text content.
 *
 * Strategy:
 *   1. Remove <script>, <style>, <nav>, <footer>, <header> blocks entirely
 *   2. Remove cookie consent / popup divs (common patterns)
 *   3. Convert headings to markdown-style markers
 *   4. Strip remaining HTML tags
 *   5. Collapse whitespace, remove empty lines
 *   6. Remove navigation link lists (lines that are just short link text)
 */
function htmlToCleanText(html) {
  let text = html;

  // Remove entire blocks we don't want
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // Remove common cookie/consent/popup patterns
  text = text.replace(/<div[^>]*(?:cookie|consent|popup|modal|overlay|banner)[^>]*>[\s\S]*?<\/div>/gi, '');

  // Convert headings to markers so we can identify them later
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n## H1: $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## H2: $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n## H3: $1\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n## H4: $1\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n## H5: $1\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n## H6: $1\n');

  // Convert paragraphs to double newlines
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  text = text.replace(/<\/li>/gi, '');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&hellip;/g, '…');
  text = text.replace(/&copy;/g, '©');
  text = text.replace(/&reg;/g, '®');
  text = text.replace(/&trade;/g, '™');
  text = text.replace(/&#\d+;/g, ''); // remove remaining numeric entities

  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  // Clean up common scraping artifacts:
  // - Stray bullet/dot characters used as icon placeholders
  // - Footnote reference numbers (standalone digits like "10", "11")
  // - "Learn more" / "Buy" / "Shop" standalone CTA links
  text = text.replace(/•/g, '');
  text = text.replace(/\s\d{1,2}\s/g, ' '); // standalone footnote refs
  text = text.replace(/\*\s*/g, '');

  // Split into lines and clean each
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2); // drop very short noise lines

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Content segmentation — split clean text into aligned blocks
// ---------------------------------------------------------------------------

/**
 * Segment cleaned text into typed content blocks.
 *
 * Each block has:
 *   - type: "heading", "paragraph", "tagline", "list_item"
 *   - text: the actual content
 *   - index: position in the page (for alignment)
 *
 * WHY segment: We need to align EN blocks with locale blocks by position.
 * Headings and paragraphs in the same position on both pages should
 * correspond to each other since the page structure is identical.
 */
function segmentContent(cleanText) {
  const lines = cleanText.split('\n');
  const blocks = [];
  let currentParagraph = [];

  for (const line of lines) {
    // Heading marker from our HTML conversion
    const headingMatch = line.match(/^## H(\d): (.+)$/);
    if (headingMatch) {
      // Flush any accumulated paragraph
      if (currentParagraph.length > 0) {
        const paraText = currentParagraph.join(' ').trim();
        if (paraText.length > 0) {
          blocks.push({
            type: classifyBlock(paraText),
            text: paraText,
          });
        }
        currentParagraph = [];
      }
      // Add the heading
      const headingText = headingMatch[2].trim();
      if (headingText.length > 0) {
        blocks.push({
          type: 'heading',
          text: headingText,
        });
      }
      continue;
    }

    // List items
    if (line.startsWith('• ')) {
      if (currentParagraph.length > 0) {
        const paraText = currentParagraph.join(' ').trim();
        if (paraText.length > 0) {
          blocks.push({ type: classifyBlock(paraText), text: paraText });
        }
        currentParagraph = [];
      }
      blocks.push({ type: 'list_item', text: line.replace(/^• /, '').trim() });
      continue;
    }

    // Empty line = paragraph break
    if (line.length === 0) {
      if (currentParagraph.length > 0) {
        const paraText = currentParagraph.join(' ').trim();
        if (paraText.length > 0) {
          blocks.push({ type: classifyBlock(paraText), text: paraText });
        }
        currentParagraph = [];
      }
      continue;
    }

    // Accumulate paragraph text
    currentParagraph.push(line);
  }

  // Flush remaining
  if (currentParagraph.length > 0) {
    const paraText = currentParagraph.join(' ').trim();
    if (paraText.length > 0) {
      blocks.push({ type: classifyBlock(paraText), text: paraText });
    }
  }

  // Add indices
  return blocks.map((b, i) => ({ ...b, index: i }));
}

/**
 * Classify a non-heading block by length and content.
 * Short phrases (<10 words) = taglines (marketing punch lines).
 * Longer text = paragraphs (feature descriptions, body copy).
 */
function classifyBlock(text) {
  const wordCount = text.split(/\s+/).length;
  if (wordCount <= 8) return 'tagline';
  return 'paragraph';
}

// ---------------------------------------------------------------------------
// Domain rate limiter — prevents hammering a single domain
// ---------------------------------------------------------------------------

class DomainThrottle {
  constructor(delayMs) {
    this.delayMs = delayMs;
    this.lastRequest = {};
  }

  async wait(domain) {
    const now = Date.now();
    const last = this.lastRequest[domain] || 0;
    const elapsed = now - last;
    if (elapsed < this.delayMs) {
      await sleep(this.delayMs - elapsed);
    }
    this.lastRequest[domain] = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Main scraping pipeline
// ---------------------------------------------------------------------------

async function scrapeSite(site, throttle, timeoutMs) {
  const results = {};
  const siteDir = path.join(RAW_DIR, site.id);
  fs.mkdirSync(siteDir, { recursive: true });

  for (const [locale, localePath] of Object.entries(site.locales)) {
    const url = resolveUrl(site.domain, localePath);

    try {
      // Throttle per domain to be polite
      await throttle.wait(site.domain);

      const html = await fetchPage(url, timeoutMs);
      const cleanText = htmlToCleanText(html);
      const blocks = segmentContent(cleanText);

      // Save raw cleaned text
      fs.writeFileSync(path.join(siteDir, `${locale}.md`), cleanText);

      // Save segmented blocks
      fs.writeFileSync(
        path.join(siteDir, `${locale}.blocks.json`),
        JSON.stringify(blocks, null, 2)
      );

      results[locale] = {
        status: 'ok',
        url,
        blocks: blocks.length,
        words: cleanText.split(/\s+/).length,
      };
    } catch (err) {
      results[locale] = {
        status: 'error',
        url,
        error: err.message,
      };
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// CLI + main
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    concurrency: DEFAULT_CONCURRENCY,
    timeout: DEFAULT_TIMEOUT,
    delay: DEFAULT_DELAY,
    resume: false,
    dryRun: false,
    only: null,
    industry: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--concurrency': opts.concurrency = parseInt(args[++i], 10); break;
      case '--timeout': opts.timeout = parseInt(args[++i], 10); break;
      case '--delay': opts.delay = parseInt(args[++i], 10); break;
      case '--resume': opts.resume = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--only': opts.only = args[++i]; break;
      case '--industry': opts.industry = args[++i]; break;
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs();

  // Load site registry
  const sitesPath = path.join(CONFIG_DIR, 'sites.json');
  if (!fs.existsSync(sitesPath)) {
    console.error('[ERR] sites.json not found in config/');
    process.exit(1);
  }

  let sites = JSON.parse(fs.readFileSync(sitesPath, 'utf-8'));

  // Apply filters
  if (opts.only) {
    sites = sites.filter(s => s.id === opts.only);
    if (sites.length === 0) {
      console.error(`[ERR] No site found with id: ${opts.only}`);
      process.exit(1);
    }
  }
  if (opts.industry) {
    sites = sites.filter(s => s.industry === opts.industry);
    if (sites.length === 0) {
      console.error(`[ERR] No sites found for industry: ${opts.industry}`);
      process.exit(1);
    }
  }

  // Resume: skip sites that already have raw data
  if (opts.resume) {
    const before = sites.length;
    sites = sites.filter(s => {
      const siteDir = path.join(RAW_DIR, s.id);
      if (!fs.existsSync(siteDir)) return true;
      // Check if EN file exists
      const enFile = path.join(siteDir, 'en.md');
      return !fs.existsSync(enFile);
    });
    const skipped = before - sites.length;
    if (skipped > 0) {
      console.log(`⏭  Skipping ${skipped} already-scraped sites (--resume)`);
    }
  }

  // Count total locale fetches
  const totalFetches = sites.reduce((sum, s) => sum + Object.keys(s.locales).length, 0);

  // Industry breakdown
  const industries = {};
  for (const s of sites) {
    industries[s.industry] = (industries[s.industry] || 0) + 1;
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  champollion content-bench: Web Scraper');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Sites:           ${sites.length}`);
  console.log(`  Total fetches:   ${totalFetches}`);
  console.log(`  Concurrency:     ${opts.concurrency}`);
  console.log(`  Timeout:         ${opts.timeout}ms`);
  console.log(`  Delay/domain:    ${opts.delay}ms`);
  console.log(`  Industries:      ${Object.entries(industries).map(([k,v]) => `${k}(${v})`).join(', ')}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (opts.dryRun) {
    console.log('DRY RUN — no requests will be made.\n');
    for (const site of sites) {
      const locales = Object.keys(site.locales).join(', ');
      console.log(`  ${site.id} [${site.industry}] → ${locales}`);
    }
    return;
  }

  // Set up throttle and run
  const throttle = new DomainThrottle(opts.delay);
  const report = {};
  let completed = 0;
  let totalOk = 0;
  let totalErr = 0;

  // Process sites with concurrency pool
  const tasks = sites.map(site => async () => {
    const results = await scrapeSite(site, throttle, opts.timeout);
    report[site.id] = {
      domain: site.domain,
      industry: site.industry,
      locales: results,
    };

    // Count successes/failures
    for (const [locale, r] of Object.entries(results)) {
      if (r.status === 'ok') totalOk++;
      else totalErr++;
    }

    completed++;
    const okCount = Object.values(results).filter(r => r.status === 'ok').length;
    const errCount = Object.values(results).filter(r => r.status === 'error').length;
    const symbol = errCount === 0 ? '✓' : (okCount > 0 ? '◐' : '✗');
    console.log(
      `  ${symbol} [${completed}/${sites.length}] ${site.id}` +
      ` — ${okCount} ok, ${errCount} err` +
      ` (${Object.keys(results).filter(k => results[k].status === 'ok').join(',')})`
    );

    // Save report incrementally
    fs.writeFileSync(REPORT_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalSites: sites.length,
      completed,
      totalOk,
      totalErr,
      sites: report,
    }, null, 2));
  });

  await pooled(tasks, opts.concurrency);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Scraping complete.');
  console.log(`  Successful:    ${totalOk} locale pages`);
  console.log(`  Failed:        ${totalErr} locale pages`);
  console.log(`  Success rate:  ${((totalOk / (totalOk + totalErr)) * 100).toFixed(1)}%`);
  console.log(`  Report:        ${path.relative(process.cwd(), REPORT_FILE)}`);
  console.log(`  Raw data:      ${path.relative(process.cwd(), RAW_DIR)}/`);
  console.log('═══════════════════════════════════════════════════════\n');
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pooled(tasks, concurrency) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      await tasks[i]();
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, tasks.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
