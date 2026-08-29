# Changelog

## 0.1.1 (2026-08-27)

Fixes the queue-tool timeouts found by live testing of the 0.1.0 npm release:
with the queue at 211k+ open items, `list_queue`, `estimate_cost`,
`get_project_info`, and `run_benchmark` all exceeded MCP clients' default 60s
request timeout, because the DB fetch path drained the entire `queue_top`
ranking (~423 sequential pages ≈ 3 minutes) before answering anything.

- **Bounded, purpose-fit queue fetching.** Metadata comes from
  queue-preview.json plus a live open-item count from the unpaged
  `queue_pairs` RPC; ranked items are paged from `queue_top` only as deep as
  the caller's selection needs (fetch-until-satisfied, bounded by
  `CHAMPOLLION_QUEUE_MAX_PAGES`, default 20 pages / 10,000 rows); single
  items are read by primary key over PostgREST with a verified-coverage
  probe. When a bound truncates a search, the tool says how deep it looked —
  no silent caps.
- **`get_queue_item` / `run_benchmark(item_id)`** now do a direct by-id (or
  mode+priority) lookup instead of scanning a full drain, and refuse items
  already covered by a VERIFIED run instead of re-spending on them.
- **Queue-mode `dry_run` is backgrounded** like a real run (the installed
  harness loads the full queue before printing its plan): it returns a job id
  immediately; the plan arrives via `get_run_status`.
- **Failure ladder hardened.** A slow-but-alive DB degrades to a
  truncated-but-honest prefix; a dead DB falls back to the static queue.json
  blob; when both are down the error names both causes.
- Harness (mt-eval, monorepo): `--top N` runs now page the DB queue only as
  deep as selection needs, and `CHAMPOLLION_QUEUE_SOURCE=blob` is accepted as
  a sentinel (previously read as a literal file path).

## 0.1.0 (2026-08-27)

Initial npm release.
