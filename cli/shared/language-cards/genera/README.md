# genera/ — the hand-authored parents

These ~38 cards are the **declared exception** to "never hand-edit a card":
abstract genus/family parents (`genus-cree`, `family-algonquian`, …) that
concrete cards inherit via their `extends` chain. They are NOT atlas build
output — `cutover-cards.mjs` deliberately preserves this directory across
cutovers, they carry no `_atlas` stamp, and the corpus-wide
`_atlas.version` integrity rule skips `genera/` for exactly that reason.

Shape: the OLD flat vocabulary (`name`, `script`, `dir` as plain values, no
attribution envelopes). Consumers that read them raw rely on that:

- `extends` resolution in every card loader (JS `registers.js`, Python
  `language_cards.py`, the website plugin's `resolveCard`)
- `cli/website/scripts/build-hub-names.mjs`

A `.md` file here is invisible to every loader — they glob `*.json` only.

Also in the PARENT directory but not a card: `language-tree.json`, the
generated Glottolog classification tree (excluded by name in `reader.js`
`listCodes` and the Python loader). It is BUILD OUTPUT of
`cli/scripts/build-language-tree.mjs` and must be regenerated after any
cutover:

```bash
node cli/scripts/build-language-tree.mjs
```

If genera ever become atlas-projected, delete this file, enroll them in the
`_atlas.version` lint rule, and give `build-hub-names.mjs` the adapter.
