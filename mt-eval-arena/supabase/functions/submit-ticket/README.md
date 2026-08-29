# submit-ticket

Visitor contact / objection / **takedown** intake for champollion.dev (founder
direction 2026-07-20). The site docent's ticket form (and any client) POSTs one
message; the function validates it, rate-limits per IP against the `tickets`
table (migration 065), inserts it with the service role, and emails a
notification to `info@champollion.dev` via [Resend](https://resend.com).

**The DB row is the record of record.** If the email send fails — or Resend
isn't configured yet — the ticket is still saved and the caller is told so.
Email is a notification, never the source of truth (no silent failure).

## Deploy

```bash
# migration first (dev/staging branch — never prod without founder go-ahead)
supabase db push            # applies 065_tickets_intake.sql

# then the function, JWT verification OFF (unauthenticated visitors)
supabase functions deploy submit-ticket --no-verify-jwt
```

## Environment (function secrets)

| Var | Required | Default | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | yes | — | (platform-provided) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — | (platform-provided) service-role insert |
| `RESEND_API_KEY` | for email | — | Resend API key. **If unset, tickets are still saved (`emailed=false`); email is skipped.** |
| `TICKET_EMAIL_TO` | no | `info@champollion.dev` | notification recipient |
| `TICKET_EMAIL_FROM` | no | `Champollion Tickets <tickets@champollion.dev>` | must be a Resend-verified domain sender |
| `TICKET_IP_HOURLY_CAP` | no | `3` | per-IP sliding hourly cap |
| `TICKET_GLOBAL_DAILY_CAP` | no | `100` | global daily cap |
| `TICKET_IP_SALT` | no | `champollion-ticket-intake-v1` | salt for the stored IP hash |
| `TICKET_ALLOWED_ORIGINS` | no | `https://champollion.dev,https://www.champollion.dev` | CORS allowlist |

Set secrets with:
`supabase secrets set RESEND_API_KEY=... TICKET_EMAIL_FROM="..."`

### Founder one-time setup for email

1. Create a Resend account; add and verify the `champollion.dev` domain (Resend
   gives you the DKIM/SPF DNS records to add at the domain registrar).
2. Use a `From` on that domain (e.g. `tickets@champollion.dev`).
3. Confirm `info@champollion.dev` actually delivers to a mailbox you read (per
   `docs/PLAN_BRIDGE_HEALTH_AND_FUNNELS.md` it "forwards to" — verify the MX /
   forward target at the registrar; likely a personal Gmail).
4. `supabase secrets set RESEND_API_KEY=...` and redeploy.

## Request / response

```bash
curl -X POST "$SUPABASE_URL/functions/v1/submit-ticket" \
  -H 'content-type: application/json' \
  -d '{"kind":"takedown","message":"Please remove the citation on /languages/crk.","contact_email":"steward@example.org","locale":"en","page_url":"https://champollion.dev/languages/crk"}'
```

```json
{ "ok": true, "id": 42, "emailed": true, "message": "Thank you — your message has been recorded and we'll reply if a response is needed." }
```

- `message` is the only required field. `kind` ∈
  `takedown | objection | correction | question | other` (default `question`).
- `contact_email` is optional — omit it to file anonymously (no reply possible).
- Errors: `400` validation, `405` non-POST, `413` oversized (>64 KB), `429`
  rate-limited (with `retry_after_seconds`), `503` ledger unavailable (fails
  closed), `500` unexpected.

## Privacy & security

- The raw client IP is **never stored** — only a salted SHA-256 (`ip_hash`),
  used solely for the rate-limit window (same discipline as `submit-run`).
- The rate-limit IP is the **last public** `x-forwarded-for` hop / connection
  peer, never the client-spoofable leftmost hop.
- The function has **no tools and takes no free-form actions** — it only
  validates and stores a message and sends a fixed-shape notification. Control
  characters are stripped from single-line fields (email-header-injection
  guard); the message body keeps newlines but drops other control chars.
- `tickets` is service-role-only (RLS deny-all); ticket content is never public
  and never joined to the leaderboard.

## Tests

```bash
deno test lib_test.ts    # 16 pure unit tests, dependency-free
```

## Acting on tickets

Triage doctrine and takedown-execution recipes live in the internal
`docs/TICKETS.md`.
