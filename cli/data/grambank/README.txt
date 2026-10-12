
Grambank v1.0.3 CLDF snapshot
=============================

languages.csv is a verbatim byte copy of cldf/languages.csv from the
Grambank CLDF StructureDataset, GitHub release v1.0.3
(https://github.com/grambank/grambank, tag v1.0.3). Blob-verified
byte-identical to the upstream release file on 2026-07-19 (originally
fetched 2026-06-07; the file is unchanged upstream since v1.0).

Tracked in git:

  languages.csv  (403,607 bytes)
    sha256 25042195d5fb84806fba3877fd47ad47b4946c84e32a822adcf5bb4832a5b416

cli/data/ is gitignored — this file was force-added (git add -f); new
files in this directory need -f too.

Sibling release files consumed by other enrichment scripts are NOT
tracked (values.csv alone is 51 MB). Re-fetch any of them exactly from
the pinned tag and verify against these checksums:

  curl -fsSL https://raw.githubusercontent.com/grambank/grambank/v1.0.3/cldf/<file> -o <file>

  codes.csv       (9,404 bytes)
    sha256 cdcf17f53d56c6b58d52a76cb82c77fe6fd919abb3b9ac836c80f97c537f3263
  parameters.csv  (947,121 bytes)
    sha256 ff5a675e6e2417b6e1746230b6649429be688f4e16df0da99bbabe4eff52dc80
  values.csv      (51,545,673 bytes)
    sha256 b5ad64804fb092496c4447938a1a5143f502c95e0799833db97b064c13d22363

ISO639P3code NOTE: the ISO639P3code column in languages.csv exists in
the header but is empty for all 2,467 rows. That is upstream-faithful
for the v1.0.3 release (verified by byte-identity with the official
release file on 2026-07-19), not a local defect — Grambank coverage
matching is glottocode-only in practice
(scripts/derive-database-coverage.mjs reads both columns; the ISO set
is simply empty).

Consumed by scripts/derive-database-coverage.mjs (languages.csv:
Glottocode + ISO639P3code -> databaseCoverage.grambank). The untracked
values.csv / parameters.csv / codes.csv feed enrich-grambank-v2.mjs,
enrich-gender-from-grambank.mjs, decontaminate-grambank-fields.mjs and
build-explainers.mjs — restore them with the recipe above before
running those.

Data of Grambank is published under CC BY 4.0:
https://creativecommons.org/licenses/by/4.0/

It should be cited as

Skirgård, Hedvig, Hannah J. Haynie, Damián E. Blasi, Harald
Hammarström, Jeremy Collins, Jay J. Latarche, et al. 2023.
Grambank v1.0.3 [Data set]. Zenodo.
https://doi.org/10.5281/zenodo.7844558
(Full author list at the DOI. Available online at
https://grambank.clld.org, accessed on 2026-06-07; release pinned and
byte-verified on 2026-07-19.)
