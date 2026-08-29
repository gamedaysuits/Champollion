# ISO 639-5 collective language codes (pinned upstream snapshot)

`iso639-5.tsv` — the complete official ISO 639-5 code list (language
FAMILIES and GROUPS, e.g. `ber` "Berber languages"), from the ISO 639-5
Registration Authority, the Library of Congress:
https://id.loc.gov/vocabulary/iso639-5.tsv (retrieved 2026-07-19).
Pinned snapshot — never hand-edited; refresh by re-downloading and
reviewing the diff.

Why it is here: upstream corpora occasionally label data with a
collective code (Tatoeba's `ber`). A collective is not a language — it
can never be a benchmark target — but classifying it as such requires
positive membership in this table, never mere absence from ISO 639-3
(an absent code could equally be a typo or a newly assigned element).
Consumer: `arena/scripts/iso_resolution.py`.
