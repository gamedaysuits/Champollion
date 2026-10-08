/**
 * "Who may use this" — the one plain-language license page (release blocker
 * for 0.4.0; the shop, clinic and Django-clinic personas, every round: users
 * could not tell from "noncommercial" alone whether they were covered).
 *
 * The page quotes PolyForm Noncommercial's own permitted purposes, gives the
 * examples (a school, a public hospital or clinic, a charity, a personal or
 * research project: covered; a for-profit business's product: not), states the
 * harness's AGPL-3.0 terms, and says it is a summary, not legal advice. Every
 * place a user meets the license links to it. Founder policy: non-commercial
 * for good — no page offers, invites or describes a commercial license route.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const PAGE = read('../website/docs/getting-started/who-may-use-this.md');
const URL_PATH = '/docs/getting-started/who-may-use-this';
const URL_FULL = `https://champollion.dev${URL_PATH}`;
const flat = (s) => s.replace(/\s+/g, ' ');

/** A commercial-license route: an offer, an invitation, a contact for one. */
const COMMERCIAL_ROUTE = /talk to us|contact us|commercial licen[cs]es? (is |are |can be )?(available|granted)|commercial use requires|commercial (use )?by permission|case-by-case|get-involved/i;

describe('the page', () => {
  it('quotes PolyForm Noncommercial\'s two permitted-purpose clauses word for word', () => {
    const license = flat(read('../LICENSE'));
    for (const clause of ['Personal Uses', 'Noncommercial Organizations']) {
      const body = new RegExp(`## ${clause} (.+?) ##`).exec(license)[1].trim();
      assert.ok(flat(PAGE).includes(`> **${clause}.** ${body}`), `${clause}: ${body}`);
    }
    assert.match(PAGE, /regardless of the source of funding/);
  });

  it('gives the examples: covered and not covered', () => {
    for (const row of [
      /\| A school [^|]*\| ✓ Yes \|/, /\| A public hospital or a public health clinic [^|]*\| ✓ Yes \|/,
      /\| A charity [^|]*\| ✓ Yes \|/, /\| You, on a personal or research project [^|]*\| ✓ Yes \|/,
      /\| A shop translating its storefront \| ✗ No \| A for-profit business's product is commercial use/,
      /\| A for-profit private clinic [^|]*\| ✗ No \| A for-profit business's product is commercial use/,
    ]) assert.match(PAGE, row);
  });

  it('states the harness is AGPL-3.0, commercial use allowed on its terms, with the network-use obligation', () => {
    assert.match(PAGE, /AGPL-3\.0-or-later/);
    assert.match(PAGE, /The AGPL allows commercial use, on its own terms/);
    assert.match(PAGE, /over a network, you must offer those people the source of your changed version \(section 13/);
  });

  it('says it is a summary, not legal advice, and that the license text governs — and links the texts', () => {
    assert.match(PAGE, /This is a summary, not legal advice\. The license text governs\./);
    for (const dir of ['cli', 'mcp-server', 'forge', 'arena']) {
      assert.ok(PAGE.includes(`https://github.com/gamedaysuits/Champollion/blob/main/${dir}/LICENSE`), dir);
    }
    assert.ok(PAGE.includes('https://pypi.org/project/champollion-lyss/'));
  });

  it('agrees with each package\'s own metadata (the package files win)', () => {
    assert.equal(JSON.parse(read('../package.json')).license, 'PolyForm-Noncommercial-1.0.0');
    assert.equal(JSON.parse(read('../../mcp-server/package.json')).license, 'PolyForm-Noncommercial-1.0.0');
    assert.match(read('../../forge/pyproject.toml'), /^license = "PolyForm-Noncommercial-1\.0\.0"$/m);
    assert.match(read('../../arena/pyproject.toml'), /^license = "AGPL-3\.0-or-later"$/m);
    assert.match(read('../../lyss/pyproject.toml'), /LicenseRef-Champollion-Interim-Permission-Required/);
    for (const [pkg, lic] of [['champollion', 'PolyForm Noncommercial 1.0.0'], ['champollion-mcp-server', 'PolyForm Noncommercial 1.0.0'],
      ['nmt-forge', 'PolyForm Noncommercial 1.0.0'], ['mt-eval-harness', 'AGPL-3.0-or-later']]) {
      assert.match(PAGE, new RegExp(`\\| \`${pkg}\`[^\\n]*\\| \\[${lic.replace(/\./g, '\\.')}\\]`), pkg);
    }
  });

  it('offers no commercial-license route', () => {
    assert.doesNotMatch(PAGE, COMMERCIAL_ROUTE);
  });

  it('is in the sidebar and the agents\' index', () => {
    assert.match(read('../website/sidebars.js'), /'getting-started\/who-may-use-this'/);
    assert.ok(read('../website/static/llms.txt').includes(URL_FULL));
  });
});

describe('every place a user meets the license links to it, and none offers a commercial route', () => {
  const pages = {
    installation: '../website/docs/getting-started/installation.mdx',
    'quick start': '../website/docs/getting-started/quick-start.md',
    enterprise: '../website/docs/guides/enterprise.md',
    'cli README': '../README.md',
    'MCP server README': '../../mcp-server/README.md',
    'forge README': '../../forge/README.md',
    'harness README': '../../arena/README.md',
    'root README': '../../README.md',
  };
  for (const [name, rel] of Object.entries(pages)) {
    it(name, () => {
      const text = read(rel);
      assert.ok(text.includes(URL_PATH), `${name} links ${URL_PATH}`);
      assert.doesNotMatch(text, COMMERCIAL_ROUTE, name);
    });
  }

  it('the localized enterprise pages no longer carry the old "commercial use needs permission — contact us" clause', () => {
    const i18n = new URL('../website/i18n/', import.meta.url);
    for (const loc of fs.readdirSync(i18n)) {
      const f = new URL(`${loc}/docusaurus-plugin-content-docs/current/guides/enterprise.md`, i18n);
      if (fs.existsSync(f)) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /get-involved/, loc);
    }
  });

  it('the localized READMEs no longer call the CLI Apache-2.0', () => {
    for (const f of fs.readdirSync(new URL('../docs/', import.meta.url)).filter((n) => /^README\.[a-z]+\.md$/.test(n))) {
      const text = read(`../docs/${f}`);
      assert.doesNotMatch(text, /Apache/, f);
      assert.ok(text.includes(URL_FULL), f);
    }
  });
});
