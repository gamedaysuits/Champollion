/**
 * The MCP server drives the champollion CLI it depends on (the rails profile
 * runs `champollion new`, `next`, `data add`, `connect` …). Its dependency
 * floor names the CLI it was built and tested against — the CLI in this
 * tree — so a release that bumps the CLI (npm never republishes a version)
 * moves the floor with it, and no install pairs this server with an older
 * CLI that lacks the commands it calls. Skips outside the monorepo.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_PKG = join(HERE, '..', '..', 'cli', 'package.json');

describe('the CLI this server depends on', { skip: existsSync(CLI_PKG) ? false : 'no cli/ beside it' }, () => {
  it('is floored at the CLI in this tree', () => {
    const cli = JSON.parse(readFileSync(CLI_PKG, 'utf-8')).version;
    const range = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf-8')).dependencies.champollion;
    assert.equal(range, `^${cli}`, `champollion-mcp-server depends on champollion ${range}, but it is built `
      + `against champollion ${cli} — set "champollion": "^${cli}" in mcp-server/package.json`);
  });
});
