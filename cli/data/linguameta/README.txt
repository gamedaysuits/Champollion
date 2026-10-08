
LinguaMeta snapshot (google-research/url-nlp @ 452a21ad)
========================================================

linguameta.tsv is a verbatim byte copy of linguameta/linguameta.tsv
from https://github.com/google-research/url-nlp at commit

  452a21ad3dae5668c06ceeac21ff073e1e40f9be   (2025-08-01)

— the most recent commit to touch the file. Blob-verified
byte-identical on 2026-07-19 (originally fetched 2026-06-07). 7,511
data rows, one per language, all with iso_639_3_code populated.

Tracked in git:

  linguameta.tsv  (687,926 bytes)
    sha256 dfd9e3c05be012ecdb42852fa9fd198649a8f61e4dde3927c3d78c770c57ad07

cli/data/ is gitignored — this file was force-added (git add -f); new
files in this directory need -f too.

Re-fetch exactly with:

  curl -fsSL https://raw.githubusercontent.com/google-research/url-nlp/452a21ad3dae5668c06ceeac21ff073e1e40f9be/linguameta/linguameta.tsv -o linguameta.tsv

The data/ subdirectory (7,513 per-language JSON files, ~48 MB, NOT
tracked) is the upstream linguameta/data/ directory — the full
metadata; the TSV is upstream's convenience overview. It feeds
enrich-native-names.mjs, validate-endonyms.mjs and
fix-endonym-authenticity.mjs. Restore it at the same pin with:

  git clone https://github.com/google-research/url-nlp.git
  git -C url-nlp checkout 452a21ad3dae5668c06ceeac21ff073e1e40f9be
  cp -R url-nlp/linguameta/data <this directory>/data

Consumers of linguameta.tsv:

- scripts/derive-database-coverage.mjs (iso_639_3_code ->
  databaseCoverage.linguameta)
- scripts/derive-orthographic-status.mjs (cldr_official_status,
  writing_systems). CAUTION: when this file is absent that script only
  warns and then re-derives from degraded inputs, flattening
  orthographicStatus — never run it without this snapshot present.
- enrich-vitality-from-linguameta.mjs,
  enrich-scripts-from-linguameta.mjs,
  enrich-descriptions-from-linguameta.mjs,
  enrich-from-linguameta-phoible.mjs, enrich-alternate-names.mjs.

License: CC BY-SA 4.0 — the LICENSE file shipped in linguameta/ at the
pinned commit (Attribution-ShareAlike 4.0 International):
https://creativecommons.org/licenses/by-sa/4.0/
LinguaMeta is a compilation; upstream's README documents per-source
terms for individual fields (Unicode CLDR license, SIL ISO 639 terms
of use, Glottolog CC BY 4.0, Wikidata CC0 / CC BY-SA 3.0, Wikipedia
and Wiktionary CC BY-SA). Attribution and share-alike honored here:
verbatim copy, cited below.

It should be cited as

Ritchie, Sandy, Daan van Esch, Uche Okonkwo, Shikhar Vashishth &
Emily Drummond. 2024. LinguaMeta: Unified Metadata for Thousands of
Languages. In Proceedings of LREC-COLING 2024.
https://aclanthology.org/2024.lrec-main.921/
(Repository: https://github.com/google-research/url-nlp, commit
452a21ad. Accessed on 2026-06-07; pinned and byte-verified on
2026-07-19.)
