#!/usr/bin/env node
/**
 * Champollion MCP Server — entry point.
 *
 * Starts the MCP server on stdio transport. Designed to be launched by
 * an AI agent's MCP client (Claude Code, Antigravity, Cursor, etc.)
 * or run directly for testing:
 *
 *   node bin/server.js
 *
 * The server exposes read-only tools for discovering what exists for a
 * language (cited cards, benchmarks, results, contests), plus action tools
 * that run benchmarks, drive nmt-forge training and translate — every one
 * that spends or publishes requires the user's explicit confirmation.
 */

import { createServer } from '../src/index.js';

const server = await createServer();
await server.start();
