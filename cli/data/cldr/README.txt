
Unicode CLDR 48 locale snapshot (cldr-json 48.2.0)
==================================================

One <locale>.json per base-language locale in CLDR common/main
(322 files), each a verbatim byte copy of that locale's layout.json
from the cldr-misc-full npm package (unicode-org/cldr-json, release
48.2.0 — the same release cli/package.json pins for every other CLDR
enrichment script; cards cite it as "cldr-48"). The release is pinned
by cli/package-lock.json (version + sha512 integrity).

Rebuild with:

  node scripts/build-cldr-snapshot.mjs

(run from cli/; reads node_modules/cldr-misc-full + cldr-core,
refuses to build if the installed version disagrees with the
lockfile, cross-checks availableLocales.json, fails loud on any
mismatch).

Consumed by scripts/derive-database-coverage.mjs, which derives
databaseCoverage.cldr by FILENAME only: a card is covered iff
<card.code>.json or <card.iso639_1>.json exists here. Regional and
script variant locales (en-GB, sr-Latn, … — 766 locales total in
common/main) are not materialized: they can never match a card code,
and the builder asserts every variant's base language is present as
its own locale. 'und' (CLDR's root locale, not a language) is
excluded.

Data of the Unicode CLDR is published under the Unicode License v3
(SPDX: Unicode-3.0): https://www.unicode.org/license.txt

It should be cited as

Unicode Consortium. 2025. Unicode Common Locale Data Repository,
version 48. https://cldr.unicode.org/
(JSON distribution: https://github.com/unicode-org/cldr-json,
npm package cldr-misc-full@48.2.0. Accessed on 2026-07-19.)
