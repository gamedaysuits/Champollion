/**
 * Re-export: the RFC-4180 CSV reader lives in lib/csv.mjs (moved 2026-10-09 so
 * the published package can import community spreadsheets with it —
 * `champollion data add`). One implementation; the data scripts keep this path.
 */
export * from '../../lib/csv.mjs';
