# 📦 ARCHIVED — Research Documentation

**This directory (`test/benchmark/content-bench/`) is archived as of 2026-05-23.**

## What this documents

A research experiment testing whether commercial website translations
could be harvested as evaluation data by aligning EN↔locale blocks by
DOM position.

## The result: Negative

**Position-based alignment doesn't work.** Commercial websites are
*localized*, not *translated*. Apple France shows different promos than
Apple US at the same DOM position. McDonald's Japan has news updates
where McDonald's US has loyalty info.

The quality audit showed only **56.3% plausible pair rate** — the rest
was misaligned content, untranslated strings, or CTA contamination.

## Why this is preserved

This is a documented negative result. It proved:

1. **Localization ≠ translation.** Without CMS-level keys, there is no
   reliable way to map EN block #7 to FR block #7 on a commercial site.

2. **Position-based alignment is unreliable** for building evaluation
   corpora from the wild web.

3. **The contamination-aware weighting concept** (3× weight for fresh
   scrapes vs. memorizable open-source data) developed during V2 design
   may be valuable for future evaluation work.

## V2 was designed but intentionally never built

The V2 hybrid approach (curate surviving web pairs + augment with
key-aligned open-source locale files) was designed but not implemented.
The research question — "can we cheaply harvest evaluation data from
commercial sites?" — was answered: no. The effort was redirected to
the eval harness's native dataset support.

## Files preserved

All files (scrape scripts, raw data, audit results, V2 design docs)
are preserved as research documentation. They should not be modified
or used as the basis for new evaluation work.
