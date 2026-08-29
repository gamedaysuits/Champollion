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
 * The server exposes read-only tools for exploring the Champollion
 * benchmark queue and language metadata, plus an action tool for
 * running benchmarks (which requires user confirmation in the agent).
 */

import { createServer } from '../src/index.js';

const server = await createServer();
await server.start();
