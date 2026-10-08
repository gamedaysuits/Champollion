/**
 * Command: fonts
 *
 * Manages PUA web fonts for script converters that require them.
 *
 * Subcommands:
 *   list    — Show which fonts are needed by configured languages
 *   install — Download PUA fonts into the project's static assets directory
 *
 * HOW IT WORKS:
 *   1. Reads the project config to find target languages
 *   2. For each language, checks getConverterInfo() for a fontNote
 *   3. fontNote presence means that language's script converter outputs
 *      PUA characters that require a custom web font to render
 *   4. Downloads the font from its source repository and writes it to
 *      a local directory (auto-detected or user-specified via --dir)
 *
 * WHY this exists:
 *   champollion does NOT bundle PUA fonts — they add binary weight to the
 *   npm package and have varied licenses (SIL OFL, GPL). This command
 *   lets users opt-in to downloading only the fonts they need, with
 *   clear license attribution at install time.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { getConverterInfo, SCRIPT_CONVERTERS, resolveTargetScript } from '../scripts.js';
import { getLanguageCard } from '../registers.js';
import { resolveConfig, detectDocusaurus } from '../config.js';
import { output } from '../output.js';

// ── Font Registry ────────────────────────────────────────────────
//
// Each entry maps a locale code to its font metadata.
// Source URLs point to open-source repositories with verified licenses.
// Both pIqaD and Tengwar are distributed as ZIP archives containing TTFs.

const FONT_REGISTRY = {
  tlh: {
    family: 'pIqaD',
    displayName: 'pIqaD qolqoS',
    filename: 'pIqaDqolqoS.ttf',
    // The compiled TTF is only in the release ZIP, not in the repo tree
    source: 'https://github.com/dadap/pIqaD-fonts/releases/download/pIqaD-fonts-r1/pIqaD-fonts.zip',
    archiveType: 'zip',
    archiveInnerPath: 'pIqaD-fonts/pIqaD-qolqoS.ttf',
    license: 'SIL Open Font License 1.1',
    licenseUrl: 'https://github.com/dadap/pIqaD-fonts/blob/master/LICENSE',
    unicodeRange: 'U+F8D0-F8FF',
    cssSelector: ':lang(tlh), [data-script="piqad"]',
    scriptLabel: 'Klingon pIqaD',
  },
  'x-elvish-s': {
    family: 'Tengwar',
    displayName: 'FreeMonoTengwar',
    filename: 'FreeMonoTengwar.ttf',
    // SourceForge "latest download" redirects to the ZIP
    source: 'https://sourceforge.net/projects/freetengwar/files/latest/download',
    archiveType: 'zip',
    archiveInnerPath: 'FreeMonoTengwar.2013-07-21/FreeMonoTengwar.ttf',
    license: 'GNU GPL v3 (with font exception)',
    licenseUrl: 'https://sourceforge.net/projects/freetengwar/',
    unicodeRange: 'U+E000-E07F',
    cssSelector: ':lang(x-elvish-s), [data-script="tengwar"]',
    scriptLabel: 'Tolkien Tengwar',
  },
  'x-kryptonian': {
    family: 'Kryptonian',
    displayName: '(user-provided)',
    filename: 'kryptonian.ttf',
    source: null, // No open-source PUA font available
    sourceNote: 'No open-source PUA Kryptonian font exists. See kryptonian.info or create one with FontForge.',
    license: 'Varies — must be sourced by user',
    licenseUrl: null,
    unicodeRange: 'U+E100-E119',
    cssSelector: ':lang(x-kryptonian), [data-script="kryptonian"]',
    scriptLabel: 'Kryptonian',
  },
};

/**
 * Detect the best output directory for fonts based on project structure.
 *
 * Priority:
 *   1. --dir flag (user override)
 *   2. Docusaurus project → static/fonts/ (or website/static/fonts/)
 *   3. Hugo project → static/fonts/
 *   4. Default → public/fonts/
 */
function detectFontsDir(cwd, args) {
  if (args.dir) {
    return path.resolve(cwd, args.dir);
  }

  // Check for Docusaurus in cwd
  if (detectDocusaurus(cwd)) {
    return path.join(cwd, 'static', 'fonts');
  }

  // Check for Docusaurus in a website/ subdirectory
  const websiteDir = path.join(cwd, 'website');
  if (fs.existsSync(websiteDir) && detectDocusaurus(websiteDir)) {
    return path.join(websiteDir, 'static', 'fonts');
  }

  // Check for Hugo (config.toml or hugo.toml)
  const hugoConfigs = ['config.toml', 'hugo.toml', 'config.yaml', 'hugo.yaml'];
  if (hugoConfigs.some(f => fs.existsSync(path.join(cwd, f)))) {
    return path.join(cwd, 'static', 'fonts');
  }

  // Default: public/fonts/ (React, Next.js, Vite)
  return path.join(cwd, 'public', 'fonts');
}

/**
 * Get locale codes from the project config that need PUA fonts.
 */
function getNeededFonts(config) {
  const needed = [];
  const declined = [];

  let codes = [];
  if (Array.isArray(config.languages)) {
    codes = config.languages;
  } else if (config.languages && typeof config.languages === 'object') {
    codes = Object.keys(config.languages);
  }

  for (const code of codes) {
    const info = getConverterInfo(code);
    if (!info || !info.fontNote) continue;
    const font = FONT_REGISTRY[code];
    if (!font) continue;

    // A font is only NEEDED when this project's script resolution actually
    // emits the PUA script. A declined (default romanization) locale is
    // listed separately so the user learns the opt-in exists — but is not
    // told to download a font nothing will use.
    let converts = false;
    try {
      const langConfig = config.resolvedLanguages?.[code] || {};
      const resolution = resolveTargetScript(code, langConfig, getLanguageCard(code));
      converts = !!resolution.converterKey;
    } catch {
      // Invalid script config — sync will fail loud; fonts stays quiet.
    }

    if (converts) needed.push({ code, info, font });
    else declined.push({ code, info, font });
  }

  return Object.assign(needed, { declined });
}

/**
 * Get ALL registered PUA fonts (for listing when no config exists).
 */
function getAllPuaFonts() {
  const fonts = [];
  for (const [code] of Object.entries(SCRIPT_CONVERTERS)) {
    const info = getConverterInfo(code);
    if (info && info.fontNote) {
      const font = FONT_REGISTRY[code];
      if (font) {
        fonts.push({ code, info, font });
      }
    }
  }
  return fonts;
}

/**
 * Download a file from a URL using Node.js built-in fetch.
 */
async function downloadFile(url, destPath) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      output.error(`  HTTP ${response.status} from ${url}`);
      return false;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length < 512) {
      output.error(`  Downloaded file is too small (${buffer.length} bytes).`);
      return false;
    }

    fs.writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    output.error(`  Download failed: ${err.message}`);
    return false;
  }
}

/**
 * Extract a single file from a ZIP archive using the system `unzip` command.
 * Falls back to manual instructions if `unzip` isn't available.
 *
 * @param {string} zipPath - Path to the ZIP file
 * @param {string} innerPath - Path inside the ZIP (e.g., "pIqaD-fonts/pIqaD-qolqoS.ttf")
 * @param {string} destPath - Where to write the extracted file
 * @returns {boolean} true on success
 */
function extractFromZip(zipPath, innerPath, destPath) {
  const destDir = path.dirname(destPath);
  const destFilename = path.basename(destPath);
  const extractedName = path.basename(innerPath);

  try {
    // -j: junk paths (flatten directory structure)
    // -o: overwrite without prompting
    execSync(`unzip -j -o "${zipPath}" "${innerPath}" -d "${destDir}"`, {
      stdio: 'pipe',
    });

    // Rename if the extracted filename differs from our target
    const extractedPath = path.join(destDir, extractedName);
    if (extractedName !== destFilename && fs.existsSync(extractedPath)) {
      fs.renameSync(extractedPath, destPath);
    }

    return fs.existsSync(destPath);
  } catch {
    output.error(`  Could not extract automatically (unzip not found or failed).`);
    output.raw(`     Manual steps:`);
    output.raw(`       unzip "${zipPath}" "${innerPath}" -d "${destDir}"`);
    output.raw(`       mv "${path.join(destDir, extractedName)}" "${destPath}"`);
    return false;
  }
}

/**
 * Download and install a single font.
 * Handles both direct TTF downloads and ZIP archive extraction.
 */
async function installFont(font, destPath) {
  const fontsDir = path.dirname(destPath);

  if (font.archiveType === 'zip') {
    // Download ZIP to temp, extract the TTF, clean up
    const tempZip = path.join(fontsDir, `_temp_${font.filename}.zip`);
    const ok = await downloadFile(font.source, tempZip);
    if (!ok) return false;

    const extracted = extractFromZip(tempZip, font.archiveInnerPath, destPath);

    // Clean up temp ZIP regardless of extraction result
    if (fs.existsSync(tempZip)) {
      fs.unlinkSync(tempZip);
    }

    return extracted;
  }

  // Direct download (no ZIP)
  return await downloadFile(font.source, destPath);
}

/**
 * Generate a CSS snippet with @font-face declarations for installed fonts.
 */
function generateCssSnippet(fonts) {
  const lines = [
    '/* PUA Conlang Fonts — generated by `champollion fonts install --css` */',
    '/* Add this to your stylesheet or import it. */',
    '',
  ];

  for (const { font } of fonts) {
    lines.push(`@font-face {`);
    lines.push(`  font-family: '${font.family}';`);
    lines.push(`  src: url('/fonts/${font.filename}') format('truetype');`);
    lines.push(`  font-display: swap;`);
    lines.push(`  unicode-range: ${font.unicodeRange};`);
    lines.push(`}`);
    lines.push('');
    lines.push(`${font.cssSelector} {`);
    lines.push(`  font-family: '${font.family}', sans-serif;`);
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Subcommands ──────────────────────────────────────────────────

/**
 * `champollion fonts list` — show which fonts are needed.
 */
async function subList(args, cwd) {
  let fonts;
  let fromConfig = false;

  try {
    const config = resolveConfig({ config: args.config }, cwd);
    fonts = getNeededFonts(config);
    fromConfig = true;
  } catch {
    fonts = getAllPuaFonts();
  }

  if (fonts.length === 0) {
    if (fromConfig) {
      output.raw('\n  No configured languages require PUA web fonts.');
      output.raw('  Script converters for crk (Cree) and sr (Serbian) use native Unicode.');
      for (const { code, info } of fonts.declined || []) {
        output.raw(`  ${code}: script conversion not enabled (writes ${info.from}) — set "script": "${info.toScript || code}" to emit ${info.to}, which needs a font.`);
      }
      output.raw('');
    } else {
      output.raw('\n  No PUA fonts registered.\n');
    }
    return 0;
  }

  const fontsDir = detectFontsDir(cwd, args);

  output.raw('');
  output.raw(fromConfig
    ? `  PUA Fonts Needed (from config):\n`
    : `  All PUA Font-Requiring Scripts:\n`
  );

  for (const { code, font } of fonts) {
    const installed = fs.existsSync(path.join(fontsDir, font.filename));
    const status = installed ? '✅ installed' : '⬜ not installed';
    const source = font.source ? 'downloadable' : 'user-provided';

    output.raw(`    ${code.padEnd(14)} ${font.scriptLabel}`);
    output.raw(`                 Font: ${font.displayName}  [${font.license}]`);
    output.raw(`                 PUA:  ${font.unicodeRange}  |  ${status}  |  ${source}`);
    output.raw('');
  }

  for (const { code, info } of fonts.declined || []) {
    output.raw(`    ${code.padEnd(14)} conversion not enabled — writes ${info.from}, no font required.`);
    output.raw(`                 Set "script": "${info.toScript || code}" to emit ${info.to}.`);
    output.raw('');
  }

  output.raw(`  Font directory: ${fontsDir}`);
  output.raw(`  Run \`champollion fonts install\` to download available fonts.\n`);

  return 0;
}

/**
 * `champollion fonts install` — download fonts into the project.
 */
async function subInstall(args, cwd) {
  let fonts;

  try {
    const config = resolveConfig({ config: args.config }, cwd);
    fonts = getNeededFonts(config);
  } catch {
    output.raw('  No project config found — installing all available PUA fonts.\n');
    fonts = getAllPuaFonts();
  }

  if (fonts.length === 0) {
    output.raw('\n  No configured languages require PUA web fonts.\n');
    return 0;
  }

  const fontsDir = detectFontsDir(cwd, args);

  // Ensure output directory exists
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
    output.raw(`  Created: ${fontsDir}`);
  }

  output.raw('');
  let installed = 0;
  let skipped = 0;
  const installedFonts = [];

  for (const entry of fonts) {
    const { font } = entry;
    const destPath = path.join(fontsDir, font.filename);

    // Skip if already installed
    if (fs.existsSync(destPath)) {
      output.raw(`  ✅ ${font.scriptLabel} — already installed (${font.filename})`);
      installedFonts.push(entry);
      skipped++;
      continue;
    }

    // Skip if no source URL (user must provide manually)
    if (!font.source) {
      output.raw(`  ⬜ ${font.scriptLabel} — no auto-download available`);
      if (font.sourceNote) output.raw(`     ${font.sourceNote}`);
      output.raw(`     Place your font file at: ${destPath}`);
      output.raw('');
      continue;
    }

    // Download and install (handles both direct downloads and ZIP extraction)
    output.raw(`  ⬇  ${font.scriptLabel} — downloading...`);
    const ok = await installFont(font, destPath);
    if (ok) {
      const size = fs.statSync(destPath).size;
      const sizeKB = (size / 1024).toFixed(0);
      output.raw(`  ✅ ${font.scriptLabel} — installed (${font.filename}, ${sizeKB}KB)`);
      output.raw(`     License: ${font.license}`);
      installedFonts.push(entry);
      installed++;
    }
  }

  output.raw('');
  output.raw(`  ${installed} font(s) installed, ${skipped} already present.`);
  output.raw(`  Location: ${fontsDir}`);

  // Generate CSS snippet if requested
  if (args.css && installedFonts.length > 0) {
    const css = generateCssSnippet(installedFonts);
    const cssPath = path.join(fontsDir, 'conlang-fonts.css');
    fs.writeFileSync(cssPath, css, 'utf-8');
    output.raw(`  CSS snippet: ${cssPath}`);
  }

  // Show usage guidance
  if (installedFonts.length > 0) {
    output.raw('');
    output.raw('  Add to your CSS:');
    output.raw('');
    for (const { font } of installedFonts) {
      output.raw(`    @font-face {`);
      output.raw(`      font-family: '${font.family}';`);
      output.raw(`      src: url('/fonts/${font.filename}') format('truetype');`);
      output.raw(`      unicode-range: ${font.unicodeRange};`);
      output.raw(`    }`);
      output.raw('');
    }
  }

  return 0;
}

// ── Main Entry Point ─────────────────────────────────────────────

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  const subcommand = args._[1];

  if (subcommand === 'list') {
    return await subList(args, cwd);
  }

  if (subcommand === 'install') {
    return await subInstall(args, cwd);
  }

  // No valid subcommand — show help
  output.raw(`
  Font Commands:

    champollion fonts list               Show which PUA fonts are needed
    champollion fonts install             Download fonts for configured languages
    champollion fonts install --dir .     Override output directory
    champollion fonts install --css       Also generate a CSS snippet file

  PUA (Private Use Area) fonts are needed for script converters that
  output characters outside standard Unicode:

    tlh          Klingon pIqaD       (U+F8D0–F8FF)
    x-elvish-s   Tolkien Tengwar     (U+E000–E07F)
    x-kryptonian Kryptonian          (U+E100–E119)

  Native Unicode converters (crk → Cree Syllabics, sr → Cyrillic)
  do NOT require font installation.
  `);
  return 0;
}

export { run, FONT_REGISTRY };
