# Champollion Method Submission — Terms Framework

> **Version:** 2.0 (supersedes the 1.x draft agreement)
> **Status:** framework, not a contract. Nothing in this document is binding on
> anyone. A binding instrument, if one is ever needed, is drafted with legal
> counsel for the specific parties — a specific developer, a specific
> community governance body, a specific prize — and executed by them.
>
> Last updated: 2026-07-05

## Why there is no universal agreement

Champollion is non-commercial, open-source machine-translation research
tooling. It has **no universal submission agreement, by design**: different
languages, corpora, and prizes will have different terms, and those terms
belong to the corpus steward — the community or builder who owns the data —
not to the platform. Publishing one 7,000-word contract before any community
had set its terms would get the relationship exactly backwards.

What Champollion provides instead is the machinery that makes any chosen terms
enforceable in practice — exposure lanes, license gates, quarantine,
fetch-from-source corpus registration, sealed test sets, and sandboxed
evaluation — plus the template below as a transparent starting point.

## What a prize term sheet covers

When a governance organization opens a prize on its corpus, its term sheet
answers, at minimum:

1. **Admissibility** — what a method may depend on. The mechanical test is the
   dependency-class system (S / O / A1 / A2 / X) defined in the
   [Method Interface specification](https://champollion.dev/docs/network/specifications/methods#method-validity-and-dependency-classes):
   every dependency must carry rights the community can actually receive.
   Self-hosting requirements, if any, are set here.
2. **Evaluation protocol** — sealed test segments, steward authorization of
   each run, sandbox execution, aggregate-scores-only return, and human
   validation. The technical design is in the
   [Benchmark Specification](https://champollion.dev/docs/network/specifications/benchmark)
   and the [sandbox evaluation spec](../docs/sandbox-evaluation-spec.md).
3. **Ownership of a winning method** — the default template transfers the
   method (code, weights, configuration, coaching data) to the community's
   governance organization outright, while the developer keeps publication
   rights, technique reuse, and permanent attribution. Third-party open
   components pass under their own licenses — a developer cannot transfer
   ownership of what they do not own.
4. **Deployment** — whether, where, and by whom the method may be deployed is
   the owning community's decision. **Champollion holds no deployment rights
   and takes no share of anything.** There is no platform revenue split; if a
   community deploys a method it owns, everything it earns is its own.
5. **Consent and revocation** — each evaluation run requires the steward's
   authorization, which may be refused for any reason; a community may withdraw
   its corpus or its method from the platform at any time.

The public-facing description of this framework lives at
[Ownership & Terms](https://champollion.dev/docs/network/sovereignty/ownership-transfer)
and [Data Stewardship](https://champollion.dev/docs/network/sovereignty/data-sovereignty).

## Non-commercial corpus content

A method submitted for a prize must not embed content from a
non-commercially-licensed corpus (as coaching data, embedded examples, lookup
tables, or fine-tuning data whose license restricts derivatives) if the prize's
terms convey deployment rights the license would prohibit. NC-licensed corpora
remain fully available for development and self-evaluation — the restriction
applies to what ships in the submitted artifact. The same logic applies to
base models: a base model whose license forbids the uses the term sheet
requires makes the method inadmissible for that prize, whatever its class.

## Versioning

Submissions reference this framework by version (`agreementVersion`). Term
sheets for specific prizes are published alongside the prize when one opens —
none is open today, and no score on any Champollion surface has cleared a
prize bar.
