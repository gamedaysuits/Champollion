
PHOIBLE snapshot — pinned fetch recipe (data intentionally untracked)
=====================================================================

phoible-raw.csv is data/phoible.csv from the PHOIBLE development
repository (https://github.com/phoible/dev) at commit

  7030ae02863f0e1ddaf67f0f950c0ea1477cd4ee   (2023-04-16)

— the last commit to touch that file ("Fix various feature bugs
#365"); the master tip still carried the identical blob when verified
on 2026-07-19. This is the post-2.0 aggregate (PHOIBLE 2.0, 2019, plus
upstream fixes through 2023-04-16): 105,484 data rows, 2,176
glottocodes, 2,095 ISO 639-3 codes.

The file is 24,578,868 bytes — above this repo's track-in-git size
line — so it is NOT committed. THIS README is the durability artifact:
restore the exact bytes with

  curl -fsSL https://raw.githubusercontent.com/phoible/dev/7030ae02863f0e1ddaf67f0f950c0ea1477cd4ee/data/phoible.csv -o phoible-raw.csv

  phoible-raw.csv  (24,578,868 bytes)
    sha256 395e0977c3a5402af9cd5effd4ffdf0e47396336241fac534a4706e3cd8a7ecf

(Note the rename: upstream calls it phoible.csv; this directory keeps
it as phoible-raw.csv, the name the scripts expect.)

WARNING — dead stub files: languages.csv / parameters.csv / values.csv
may exist here locally as 14-byte "404: Not Found" artifacts of an old
bad fetch (values.csv was never a valid URL for this dataset). They
are garbage; delete them on sight. phoible-raw.csv is the only real
data file in this directory.

Consumed by scripts/derive-database-coverage.mjs (Glottocode + ISO6393
-> databaseCoverage.phoible; 'NA' cells are PHOIBLE's explicit
not-available marker), enrich-phoible-phonemes.mjs,
enrich-phoible-v2.mjs and enrich-from-linguameta-phoible.mjs.

License: PHOIBLE Online publishes the dataset under CC BY-SA 3.0
(https://creativecommons.org/licenses/by-sa/3.0/, per
https://phoible.org); the dev repository additionally ships
data/LICENSE (MIT, (c) 2015 PHOIBLE). Champollion treats the data
conservatively as CC BY-SA 3.0 and does not redistribute the file —
this directory carries a pointer and recipe only.

It should be cited as

Moran, Steven & McCloy, Daniel (eds.) 2019. PHOIBLE 2.0. Jena: Max
Planck Institute for the Science of Human History.
(Available online at https://phoible.org; snapshot is the dev
repository's post-2.0 aggregate at the commit pinned above. Accessed
on 2026-06-07; pinned and verified on 2026-07-19.)
