# ISO 639-3 code tables

Official ISO 639-3 Registration Authority distribution files (SIL International).

**`SNAPSHOT.json` is the authority for what these files are.** It records the
dated release they came from, the URL, a sha256 per file and the date we
retrieved them. This README is prose about that record, not a substitute for it.

Refresh with:

```bash
node cli/scripts/fetch-source.mjs sil-iso639-3
```

The fetcher reads SIL's download page, takes the newest **dated** release zip
(`iso-639-3_Code_Tables_YYYYMMDD.zip`), and reports which files changed. It
deliberately does not use the undated `/downloads/*.tab` URLs the earlier import
took: those serve whatever the registry has today, so two runs a month apart
produce different tables with nothing to tell them apart. A dated release names
one thing, which is what makes it a pin.

| File | Contents |
|---|---|
| `iso-639-3.tab` | Full code table: Id, Part2b/t, Part1, Scope (I/M/S), Language_Type (L/E/A/H/C/S), Ref_Name |
| `iso-639-3-macrolanguages.tab` | Macrolanguage mappings: M_Id, I_Id, I_Status (A active / R retired) |
| `iso-639-3_Retirements.tab` | Retired codes: Id, Ref_Name, Ret_Reason (C change / D duplicate / N non-existent / S split / M merge), Change_To, Ret_Remedy, Effective |
| `iso-639-3_Name_Index.tab` | All names per code (inverted name index) |

## Why the pin matters — what the first pinned refresh found

These tables had been sitting at a 2026-06 import. Pinning and refreshing them
moved the registry to release **20260715** and changed five languages we publish
cards for:

| code | was | now |
|---|---|---|
| `cey` | Ekai Chin | Laoktu Chin |
| `mgp` | Eastern Magar | Magar |
| `mrh` | Mara Chin | Mara |
| `mrd` | Western Magar | **retired** — merged into `mgp` |
| `shl` | Shendu | **retired** — duplicate of `mrh` |

Three wrong names, and two languages that no longer exist as separate codes —
one of them a duplicate of another card we also publish. None of it was
detectable before, because nothing recorded which release we were on.

`ingest-base.mjs` reports retired-but-still-carried codes under **ISO-RETIRED**
on every run. Whether such a code keeps a card, redirects, or goes away is a
scope decision (Phase D), not the loader's.

ISO 639-3 changes annually, so a stale registry means a stale language spine —
and the retirement merges resolved during ingestion are resolved against
whichever release happens to be on disk.

Consumers: `cli/scripts/ingest-base.mjs` (the language spine),
`cli/scripts/generate-all-cards.mjs`, `cli/scripts/derive-taxonomy-fields.mjs`,
`cli/scripts/lint-language-cards.mjs`, `cli/scripts/build-language-tree.mjs`,
`arena/scripts/iso_resolution.py` (registry language-resolution stamps).

Sibling: `cli/data/iso639-5/` (collective codes; separate standard, separate
registration authority).
