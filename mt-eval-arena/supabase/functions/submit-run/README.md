# `submit-run` — anonymous run-card intake

Lets a contributor publish a benchmark result **without an account** (founder
directive 2026-07-13: OAuth is optional, not required, for contributing
through the site's `curl … | bash` queue flow).

The mt-eval harness POSTs one run-card payload here when publishing
anonymously (`mt-eval queue` continuing without sign-in, `--anonymous`, or
`mt-eval publish --anonymous`). The function:

1. **Validates strictly** (`lib.ts`): column allowlists mirroring the Python
   row builders (`publish.py build_run_card_row` / `_build_entry_rows` —
   change them together), required NOT-NULL fields, id shape, finite
   numerics, body ≤ 10 MB, ≤ 2,000 entries, ≤ 20k chars per text field.
2. **Forces the identity** regardless of what the caller sent:
   `submitter='anonymous'`, `owner_uid=NULL`, `trust='unverified'`, and a
   server-built affirmation naming the anonymous intake. Attribution is never
   fabricated; an anonymous submission can never claim a name, a trust tier,
   or someone's uid.
3. **Rate-limits** via `anon_intake_log` (migration 050): a per-IP sliding
   hour window (default **5 cards/hour**) plus a global daily cap (default
   **200/day**). Only a salted SHA-256 of the IP is ever stored. 429 responses
   point at sign-in as the unlimited path and at the on-disk report so no
   work is lost. The ledger being unreachable fails **closed** (503), never
   open. **The IP is the LAST public `X-Forwarded-For` hop (or the
   connection peer) — never the leftmost hop**, which is client-supplied: a
   spoofed leftmost hop would mint a fresh bucket per request, bypassing the
   per-IP cap and burning the community's global daily cap (audit 2026-07-18
   H2; `lib.ts clientIpFrom`). Headerless callers share one fail-contained
   `unknown` bucket.
4. **Inserts with the service role.** RLS is bypassed (that's what lets
   `owner_uid` be NULL — the same verifier/CI pattern migration 027
   documents) but **triggers are not**: quarantine (022), score integrity
   (023), sha parity (026), the per-entry content guard (033), and the
   run-card aggregate content guard (051 — strict aggregate-only JSONB shape
   for corpora that are not redistribution-cleared) all still fire, and
   their rejections are returned to the caller verbatim. If the content
   guard withholds entries, the run card still publishes scores-only —
   exactly like the authed path.
5. Duplicate submissions (same deterministic fingerprint UUID) return
   `{ok:true, already_published:true}` — idempotent, no second row.

Anonymous rows display on the leaderboard exactly like self-benchmarked rows,
with submitter `anonymous`. Moderation: they are purgeable through the
existing audit lane — any service-role UPDATE/DELETE on `run_cards` is
captured by the migration-017 audit trigger; `owner_uid IS NULL AND
submitter='anonymous'` is the lane's queryable marker.

## Deploy (founder runs; prod-write rule)

```bash
# 1. Apply migrations 050 (anon_intake_log) AND 051 (run-card content guard —
#    the audit-H1 precondition for opening this lane):
supabase db push          # or apply the two files individually

# 2. Deploy the function WITHOUT JWT verification (the whole point):
cd mt-eval-arena/supabase
supabase functions deploy submit-run --no-verify-jwt
```

Deployed to prod 2026-07-19 (founder-authorized launch-hardening session).

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
Optional overrides (`supabase secrets set KEY=value`):

| Secret | Default | Meaning |
|---|---|---|
| `ANON_IP_HOURLY_CAP` | `5` | published cards per IP per sliding hour |
| `ANON_GLOBAL_DAILY_CAP` | `200` | published cards across all IPs per 24 h |
| `ANON_IP_SALT` | fixed default | salt for the stored IP hash (set to rotate) |

## Smoke test

```bash
curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/submit-run" \
  -H "Content-Type: application/json" \
  -d '{"run_card_row": {"id": "00000000-0000-4000-8000-000000000000",
       "model_slug": "test/model", "condition": "naive",
       "dataset_id": "nonexistent-smoke-dataset", "language_pair": "eng>zul",
       "harness_version": "0.0.0", "run_card": {"overall": {"evaluated": 1}},
       "fingerprint_hash": "smoke"}}'
# → 400 from a run_cards trigger/constraint is a PASS for the smoke test:
#   it proves the function is deployed, validating, and the DB rails fire.
#   (A clean 200 would put a fake smoke row on the board — don't send real-
#   looking payloads at prod.)
```

The harness side fails honestly until this function is deployed: the
anonymous publish path reports "anonymous publishing not yet enabled on this
host", keeps the report on disk, and names the re-publish command.

## Tests

```bash
deno check index.ts lib.ts && deno test lib_test.ts
```

The Python twins for the client side live in
`arena/tests/test_anonymous_publish.py`.
