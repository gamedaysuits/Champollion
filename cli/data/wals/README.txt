
WALS Online v2020.4 CLDF snapshot
=================================

languages.csv is a verbatim byte copy of cldf/languages.csv from the
WALS Online CLDF dataset, GitHub release v2020.4
(https://github.com/cldf-datasets/wals, tag v2020.4). Blob-verified
byte-identical to the upstream release file on 2026-07-19 (originally
fetched 2026-06-07). v2020.4 is the discriminating release for this
file: languages.csv differs in both v2020.3 and v2020.5.

Tracked in git:

  languages.csv  (471,656 bytes)
    sha256 f802b0993bb0769a877e307e14bdb9ae471f06806a96e292e6ad6aec351b3060

cli/data/ is gitignored — this file was force-added (git add -f); new
files in this directory need -f too.

languages.csv holds 3,573 data rows; 2,662 carry an ISO639P3code (the
remainder are WALS languoids without ISO codes). Both Glottocode and
ISO639P3code are consumed.

Sibling release files sometimes present locally are NOT tracked. All
were blob-verified byte-identical to v2020.4 on 2026-07-19. Re-fetch
exactly from the pinned tag:

  curl -fsSL https://raw.githubusercontent.com/cldf-datasets/wals/v2020.4/cldf/<file> -o <file>

  areas.csv       (443 bytes)
    sha256 21505070342ba4546c6e4c2ea735a6317ac020c351d18103bbe92bf83f2ebf7c
  chapters.csv    (87,323 bytes)
    sha256 6bce4c27fd1ee9ee5f859e580fc14736fb1ae2b82153df1efa3befb431ba9e68
  codes.csv       (83,272 bytes)
    sha256 88c402d840ddeaf08545aea8395b593e9a1c44fe18353306a01dc839ea6a49b9
  parameters.csv  (8,184 bytes)
    sha256 8f84ecf07e67ec59a750c52544cc2654e461a1ff6fed44bd4a7259579c7cd894
  values.csv      (4,641,862 bytes)
    sha256 2d672f80dbe8cf1839061af0301650bde60c326bbb486835c93ab7304b5b06cd

Consumed by scripts/derive-database-coverage.mjs (languages.csv:
Glottocode + ISO639P3code -> databaseCoverage.wals). The untracked
values.csv / codes.csv / parameters.csv / chapters.csv feed
enrich-formality-from-wals.mjs, enrich-wals-typology-supplement.mjs,
derive-word-order-dominant.mjs and build-explainers.mjs — restore them
with the recipe above before running those.

Data of WALS Online v2020.4 is published under CC BY 4.0:
https://creativecommons.org/licenses/by/4.0/

It should be cited as

Dryer, Matthew S. & Haspelmath, Martin (eds.) 2013. The World Atlas of
Language Structures Online (v2020.4) [Data set]. Zenodo.
https://doi.org/10.5281/zenodo.13950591
(Available online at https://wals.info/, accessed on 2026-06-07;
release pinned and byte-verified on 2026-07-19.)
