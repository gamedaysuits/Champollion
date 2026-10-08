# Governance

Champollion is founder-maintained. This page says how changes land, how
maintainer access is granted, and how that will evolve — written down **in
advance** so that decisions about access are policy, not improvisation.

## How changes land

- All changes land by **pull request**, reviewed and merged by a maintainer.
  There are no direct-push rights beyond the maintainer team.
- The local gate suite (quarantine gate, card-integrity lint, SSOT parity,
  full test suites) is the mandatory pre-merge discipline. CI is
  deliberately disabled in this repository; the gates run locally and their
  code is public in `scripts/` so anyone can verify what they enforce.
- Data and sovereignty rules are **not negotiable in code review**: the
  license boundaries, the no-hosting doctrine, and the
  [Derived-Artifacts Commitment](https://champollion.dev/docs/network/sovereignty/derived-artifacts)
  bind every contribution, including the maintainer's own.

## Maintainer access

- **Commit, npm, PyPI, and organization rights are granted only to people
  the founder knows personally and has verified directly** — never in
  response to an online request, however helpful the requester's
  contribution history. This is a security posture, not a judgment of any
  contributor: the xz-utils and event-stream incidents both began as
  patient, friendly volunteers asking a tired solo maintainer for access.
  Declining is procedure here, so it never needs to be personal.
- Any maintainer addition is **announced publicly in advance** in the
  repository, with the person named and their role stated. Quiet handovers
  do not happen; if you ever observe a new publisher on our packages that
  was not announced here first, treat it as a compromise and report it (see
  `SECURITY.md`).
- The project **expects to add co-maintainers** drawn from people the
  founder works with directly, and is **actively looking for qualified
  board members** — particularly people with expertise in Indigenous data
  governance, machine translation evaluation, and open-source
  sustainability. If that's you and we haven't met: open a discussion or
  reach out via the site — the path in is a working relationship, not a
  rights request.

## Community authority

Decisions about a community's language data are not governance decisions of
this project at all — they belong to the community, under the sovereignty
rules published on the site. Where a community body exercises authority
(sovereign benchmarks, consent-gated listings, community validation tiers),
this project's role is to implement their decision, not to vote on it.

## Response expectations

Solo-maintained today: issues are **triaged weekly**; security reports are
acknowledged **within 72 hours** (see `SECURITY.md`). Silence past those
windows is a miss, not a policy — ping the thread.

## Changing this document

Changes to governance are made by dated commit to this file, announced in
the release notes of the next published version. The access rules above
only ever tighten silently; loosening them is announced in advance.
