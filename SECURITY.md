# Security Policy

Champollion is a non-commercial research project maintained by one person.
This page tells you how to report a vulnerability, what is in scope, and what
to honestly expect in response.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

- **Email:** [security@champollion.dev](mailto:security@champollion.dev)
- **GitHub:** a private report to [@gamedaysuits](https://github.com/gamedaysuits)
  (GitHub's "Report a vulnerability" private advisory flow on this repository,
  if enabled, or a direct message)

Include what you found, where (component + file or endpoint), and how to
reproduce it. A proof of concept helps; a CVSS score is not required.

**Response cadence:** reports are acknowledged **within 72 hours**; general
issues are triaged **weekly**. AI-generated reports are welcome only if a
human has verified the reproduction actually works — reports with fabricated
functions or unreproducible traces are closed without response. There is no
monetary bug bounty; credit is given in the fix's release notes if you want
it.

**Package publishing:** new maintainers or package publishers are always
announced in advance in `GOVERNANCE.md`. A new npm/PyPI publisher that was
never announced there is itself a security signal — report it.

## Scope

| Component | What it is |
|-----------|------------|
| `arena/` — MT eval harness (`mt-eval` on PyPI) | Evaluation harness, leaderboard publishing, corpus fetching |
| `cli/` — Champollion CLI (`champollion` on npm) | i18n translation tool |
| `mcp-server/` — MCP server (`@champollion/mcp-server` on npm) | Model Context Protocol server |
| `cli/website/` — champollion.dev | The public site (Docusaurus, deployed on Vercel) |

Out of scope: third-party services we depend on (Vercel, Supabase, OpenRouter,
GitHub) — report those upstream — and vulnerabilities requiring physical access
to a maintainer's machine.

## Highest severity: data-sovereignty leaks

Champollion's threat model is unusual and you should know about it:
**sovereign community corpus content must never land on platform
infrastructure.** Communities hold their own test sets; the platform is
designed never to see them. Any report showing that corpus content —
translation pairs, reference answers, eval gold — is being exfiltrated to,
stored on, or logged by platform infra (the database, the leaderboard, the
site, run artifacts in git) is treated as the **highest severity class we
have**, above conventional code execution or credential issues. If you find
such a leak, please say so plainly in the first line of your report.

## What to expect

Honestly: this is a solo-maintained research project, not a company with a
security team.

- **Acknowledgment:** I aim to reply within **7 days**.
- **Assessment:** an initial severity read and a fix plan within **30 days**
  for anything confirmed.
- **Fixes:** sovereignty leaks and credential exposure get fixed immediately;
  lower-severity issues are batched into normal releases.
- **Disclosure:** coordinated. Tell me before you publish, and I will not sit
  on a confirmed report to avoid disclosure — if I go silent for more than 90
  days, publishing is fair.

## No bounty

There is no bug bounty program and no payment for reports — nothing here is
monetized, and there is no budget for one. Reports are credited in release
notes (or kept anonymous, your choice), and sovereignty-leak reports earn the
project's genuine gratitude: they protect the communities this project exists
to serve.

## Supported versions

Only the latest published release of each package (npm `champollion`,
npm `@champollion/mcp-server`, PyPI `mt-eval`) and the current `main`
branch receive fixes. There are no maintenance branches for older versions.
