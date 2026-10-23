#!/usr/bin/env node
/**
 * Champollion MCP Server — entry point.
 *
 * Starts the MCP server on stdio transport. Designed to be launched by
 * an AI agent's MCP client (Claude Code, Antigravity, Cursor, etc.)
 * or run directly for testing:
 *
 *   node bin/server.js                  # the rails profile (the default)
 *   node bin/server.js --profile full   # every tool
 *
 * The rails profile walks one language project end to end with six tools.
 * The full profile exposes read-only tools for discovering what exists for a
 * language (cited cards, benchmarks, results, contests), plus action tools
 * that run benchmarks, drive nmt-forge training and translate — every one
 * that spends or publishes requires the user's explicit confirmation.
 */

import { createServer } from '../src/index.js';

// --profile rails (the default): the six-tool rails profile (src/rails.js);
// --profile full: every tool.
const i = process.argv.indexOf('--profile');
const profile = i >= 0 ? process.argv[i + 1] : undefined;
const server = await createServer(profile ? { profile } : undefined);
await server.start();
