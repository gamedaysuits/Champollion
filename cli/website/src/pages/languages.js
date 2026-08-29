import React, { useState, useMemo, useEffect, useRef } from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';

import styles from './trading-cards.module.css';
import LanguageCard from '../components/LanguageCard';
import DetailPanel from '../components/DetailPanel';
import { loadTradingCardIndex } from '../utils/languageLoader';
import { getFamilyTheme } from '../utils/tradingCardStats';
import { loadContests, getContestInfo } from '../utils/contestLoader';
import { fold } from '../utils/humanize';
import { VITALITY_LEVELS, getVitalityLabel } from '../utils/vitality';
// Canonical "languages cataloged" count, built from the git-tracked language
// cards (languages.json). Used for the headline so the number matches the hero
// everywhere — the browse index (tc-index) also carries family/variant hub
// nodes, which shouldn't inflate the headline "languages" figure.
import poster from '../data/graph-poster.json';

/* ============================================================================
   The Language Atlas (/languages) — the ONE language-browse surface.

   Merged 2026-06-28: the former /languages "Atlas" and /trading-cards "Index"
   were ~95% the same browse (grid + search + filters + detail) with a circular
   link between them. This is the surviving page (the richer implementation:
   live stats, sorts, contests, and the full DetailPanel). /trading-cards now
   301s here, preserving ?q= deep links.
   ========================================================================== */

/** Number of cards to render per batch (initial + each scroll trigger) */
const BATCH_SIZE = 40;

/** Filter options for complexity tiers (formerly "rarity") */
const complexityFilters = () => [
  { key: 'all',       label: translate({id: 'page.atlas.fAll', message: 'All Complexity', description: 'complexity filter'}) },
  { key: 'mythic',    label: translate({id: 'page.atlas.fExtreme', message: '🔮 Extreme', description: 'complexity filter'}) },
  { key: 'legendary', label: translate({id: 'page.atlas.fSevere', message: '⭐ Severe', description: 'complexity filter'}) },
  { key: 'epic',      label: translate({id: 'page.atlas.fHigh', message: '💎 High', description: 'complexity filter'}) },
  { key: 'rare',      label: translate({id: 'page.atlas.fModerate', message: '🔷 Moderate', description: 'complexity filter'}) },
  { key: 'uncommon',  label: translate({id: 'page.atlas.fLow', message: '🟢 Low', description: 'complexity filter'}) },
  { key: 'common',    label: translate({id: 'page.atlas.fMinimal', message: '⚪ Minimal', description: 'complexity filter'}) },
];

/** Sort options for the card collection */
const sortOptions = () => [
  { key: 'name',       label: translate({id: 'page.atlas.sortName', message: 'Name (A–Z)', description: 'sort option'}) },
  { key: 'rarity',     label: translate({id: 'page.atlas.sortComplexity', message: 'Complexity (Highest)', description: 'sort option'}) },
  { key: 'challenge',  label: translate({id: 'page.atlas.sortChallenge', message: 'Challenge Rating (Hardest)', description: 'sort option'}) },
  { key: 'toolkit',    label: translate({id: 'page.atlas.sortToolkit', message: 'Digital Toolkit (Fewest)', description: 'sort option'}) },
  { key: 'speakers',   label: translate({id: 'page.atlas.sortSpeakers', message: 'Speakers (Fewest)', description: 'sort option'}) },
];

/** Contest filter options */
const contestFilters = () => [
  { key: 'all',    label: translate({id: 'page.atlas.cAll', message: 'All Languages', description: 'contest filter'}) },
  { key: 'open',   label: translate({id: 'page.atlas.cOpen', message: '🔥 Open Contests', description: 'contest filter'}) },
  { key: 'past',   label: translate({id: 'page.atlas.cPast', message: '📜 Past Contests', description: 'contest filter'}) },
];

/**
 * Complexity tier ordering for sort comparisons (higher = more complex).
 * The underlying data still uses the legacy "rarity" tier keys.
 */
const RARITY_ORDER = {
  mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1,
};

/** Vitality-badge level of a card — the badge may be an object or a bare key. */
function vitalityLevelOf(card) {
  const vb = card?.vitalityBadge;
  return (typeof vb === 'string' ? vb : vb?.level) || null;
}

export default function LanguagesPage() {
  const location = useLocation();
  // Deep-link support: /languages?q=<code or name> pre-fills the search
  // (used by the homepage wall, the hero, the mesh). An exact code match
  // auto-opens the card. /trading-cards?q=… 301s here, preserving the query.
  const initialQuery = useMemo(() => {
    const q = new URLSearchParams(location.search).get('q');
    return q ? q.trim() : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [languages, setLanguages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Streaming-load state: the grid renders from the FIRST index page while
  // the rest of the catalog arrives; a hard failure gets a retry door.
  const [indexComplete, setIndexComplete] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [contestMap, setContestMap] = useState({});
  const [search, setSearch] = useState(initialQuery);
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [contestFilter, setContestFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [vitalityFilter, setVitalityFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  // Genealogical drill-down: set by clicking an ancestry node in the detail
  // panel. Filters the atlas to every language whose lineage CONTAINS that node
  // (grouping on ancestry-contains, so a whole family/branch surfaces together).
  const [ancestryFilter, setAncestryFilter] = useState(null);
  const [sortKey, setSortKey] = useState('rarity');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [selectedCard, setSelectedCard] = useState(null);
  const sentinelRef = useRef(null);

  // Lock body scroll when detail panel is open
  useEffect(() => {
    document.body.style.overflow = selectedCard ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedCard]);

  // Load the language index (stats, rarity, abilities pre-computed at
  // build). STREAMING: the progress callback delivers rows as pages land,
  // so the grid paints from page one instead of waiting for all ~8,000.
  // A hard failure is LOUD (retry door), never a silent empty atlas.
  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    setIndexComplete(false);
    loadTradingCardIndex((partial) => {
      if (cancelled || !partial.length) return;
      setLanguages(partial);
      setIsLoading(false);
    })
      .then((cards) => {
        if (cancelled) return;
        setLanguages(cards);
        setIsLoading(false);
        setIndexComplete(true);
      })
      .catch((err) => {
        console.error('[languages] Failed to load index:', err);
        if (!cancelled) {
          setIsLoading(false);
          setLoadError(true);
        }
      });
    loadContests().then((m) => {
      if (!cancelled) setContestMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Deep-linked exact code (?q=crk) opens that card once the index loads.
  // Fires ONCE: the index now streams in pages, and re-running on every
  // batch would re-open a card the reader already closed.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || !initialQuery || languages.length === 0) return;
    const exact = languages.find(
      (card) => card.code?.toLowerCase() === initialQuery.toLowerCase()
    );
    if (exact) {
      autoOpenedRef.current = true;
      setSelectedCard(exact);
    }
  }, [initialQuery, languages]);

  // Merge contest info into cards. Stats and rarity come pre-computed.
  const enrichedCards = useMemo(() => {
    return languages.map((card) => {
      const contest = getContestInfo(card.code, contestMap);
      return { card, stats: card.stats, rarity: card.rarity, contest };
    });
  }, [languages, contestMap]);

  // Region + family filter options, derived from the loaded catalog (data over
  // code): regions are the handful of Glottolog macroareas; families are sorted
  // most-common-first so the big families sit at the top of the dropdown.
  const regionOptions = useMemo(() => {
    const set = new Set();
    for (const card of languages) if (card.macroarea) set.add(card.macroarea);
    return [...set].sort();
  }, [languages]);

  const familyOptions = useMemo(() => {
    const counts = new Map();
    for (const card of languages) {
      const fam = card.family;
      if (fam) counts.set(fam, (counts.get(fam) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [languages]);

  // code → display name, so a member card is findable by its macrolanguage's
  // common name (a search for "Arabic" reaches the ara member varieties).
  const nameByCode = useMemo(() => {
    const m = new Map();
    for (const card of languages) if (card.code) m.set(card.code, card.name);
    return m;
  }, [languages]);

  // Filter and sort the collection
  const displayCards = useMemo(() => {
    let filtered = enrichedCards;

    if (complexityFilter !== 'all') {
      filtered = filtered.filter((item) => item.rarity.tier === complexityFilter);
    }

    if (contestFilter !== 'all') {
      filtered = filtered.filter((item) => {
        if (contestFilter === 'open') return item.contest.hasOpenContest;
        if (contestFilter === 'past') return item.contest.hasClosedContest && !item.contest.hasOpenContest;
        return true;
      });
    }

    if (regionFilter !== 'all') {
      filtered = filtered.filter((item) => item.card.macroarea === regionFilter);
    }

    if (vitalityFilter !== 'all') {
      filtered = filtered.filter((item) => vitalityLevelOf(item.card) === vitalityFilter);
    }

    if (familyFilter !== 'all') {
      filtered = filtered.filter((item) => item.card.family === familyFilter);
    }

    // Genealogical drill-down (from a clicked ancestry node): keep every card
    // whose lineage array contains the node, matched case/diacritic-insensitively.
    if (ancestryFilter) {
      const target = fold(ancestryFilter);
      filtered = filtered.filter((item) => {
        const anc = Array.isArray(item.card.ancestry) ? item.card.ancestry : [];
        return anc.some((n) => n && fold(n) === target) ||
          (item.card.family && fold(item.card.family) === target);
      });
    }

    if (search.trim()) {
      // Fold the query and every candidate field to the same normalized form
      // (diacritics/case/punctuation stripped) so a language is findable by any
      // of its documented names — endonym, exonym, or spelling variant — and by
      // its code, glottocode, family, genus, or region. Plain codes match on a
      // raw lowercase basis (they contain no diacritics and fold identically).
      const q = fold(search);
      filtered = filtered.filter((item) => {
        const { card } = item;
        if (!q) return true;
        const names = [
          card.name,
          card.nativeName,
          card.family,
          card.genus,
          card.macroarea,
          card.macrolanguage && nameByCode.get(card.macrolanguage),
          ...(Array.isArray(card.aliases) ? card.aliases : []),
          ...(Array.isArray(card.regions) ? card.regions : []),
          ...(Array.isArray(card.ancestry) ? card.ancestry : []),
        ];
        if (names.some((n) => n && fold(n).includes(q))) return true;
        const codes = [card.code, card.iso639_1, card.glottocode, card.macrolanguage];
        return codes.some((c) => c && String(c).toLowerCase().includes(q));
      });
    }

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      // Open contests float to top regardless of sort key
      const aOpen = a.contest.hasOpenContest ? 1 : 0;
      const bOpen = b.contest.hasOpenContest ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;

      switch (sortKey) {
        case 'name':
          return (a.card.name || '').localeCompare(b.card.name || '');
        case 'rarity':
          return (RARITY_ORDER[b.rarity.tier] || 0) - (RARITY_ORDER[a.rarity.tier] || 0);
        case 'challenge':
          return (b.stats?.score || 0) - (a.stats?.score || 0);
        case 'toolkit':
          return (a.card.digitalToolkit?.count || 0) - (b.card.digitalToolkit?.count || 0);
        case 'speakers':
          return (a.card.speakerCount || 0) - (b.card.speakerCount || 0);
        default:
          return 0;
      }
    });

    return sorted;
  }, [enrichedCards, complexityFilter, contestFilter, regionFilter, vitalityFilter, familyFilter, ancestryFilter, search, sortKey, nameByCode]);

  // Reset visible count when filters/sort change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [complexityFilter, contestFilter, regionFilter, vitalityFilter, familyFilter, ancestryFilter, search, sortKey]);

  // IntersectionObserver on the sentinel — loads the next batch
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, displayCards.length));
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayCards.length]);

  const visibleCards = useMemo(
    () => displayCards.slice(0, visibleCount),
    [displayCards, visibleCount]
  );

  // Collection-level stats for the header
  const collectionStats = useMemo(() => {
    const tierCounts = {};
    let openContestCount = 0;
    for (const item of enrichedCards) {
      tierCounts[item.rarity.tier] = (tierCounts[item.rarity.tier] || 0) + 1;
      if (item.contest.hasOpenContest) openContestCount++;
    }
    return {
      total: enrichedCards.length,
      mythic: tierCounts.mythic || 0,
      legendary: tierCounts.legendary || 0,
      epic: tierCounts.epic || 0,
      openContests: openContestCount,
    };
  }, [enrichedCards]);

  // Canonical languages-cataloged count (from the git-tracked cards), falling
  // back to the loaded index length only if the poster stat is unavailable.
  const canonicalTotal =
    (poster.stats && (poster.stats.catalogTotal || poster.stats.total)) ||
    collectionStats.total ||
    0;
  const totalLabel = canonicalTotal ? canonicalTotal.toLocaleString('en-US') : '7,900+';

  return (
    <Layout
      title={translate({id: 'page.atlas.seoTitle', message: 'The Language Atlas', description: '/languages SEO title'})}
      description={translate({id: 'page.atlas.seoDesc', message: 'Browse every language Champollion catalogs — search, filter by machine-translation difficulty, sort by speakers or resources, and open any card for its full, cited profile.', description: '/languages SEO description'})}
    >
      {/* ---- HEADER ---- */}
      <header className={styles.pageHeader}>
        <div className="container">
          <Heading as="h1" className={styles.pageTitle}>
            <Translate id="page.atlas.title" description="h1">The Language Atlas</Translate>
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.atlas.subtitle" description="page subtitle; {n} is the language count" values={{n: totalLabel}}>{'{n} languages, every fact cited to its source. Search, filter by machine-translation difficulty, sort by speakers or resources — open any card for the full profile.'}</Translate>
          </p>
          <div className={styles.statsBar}>
            <span className={styles.statPill}>
              <strong>{totalLabel}</strong> <Translate id="page.atlas.pillLanguages" description="stat pill">Languages</Translate>
            </span>
            <span className={styles.statPill}>
              <strong>{collectionStats.mythic}</strong> <Translate id="page.atlas.pillExtreme" description="stat pill">🔮 Extreme</Translate>
            </span>
            <span className={styles.statPill}>
              <strong>{collectionStats.legendary}</strong> <Translate id="page.atlas.pillSevere" description="stat pill">⭐ Severe</Translate>
            </span>
            <span className={styles.statPill}>
              <strong>{collectionStats.epic}</strong> <Translate id="page.atlas.pillHigh" description="stat pill">💎 High</Translate>
            </span>
            {collectionStats.openContests > 0 && (
              <span className={`${styles.statPill} ${styles.statPillContest}`}>
                <strong>{collectionStats.openContests}</strong> <Translate id="page.atlas.pillContests" description="stat pill">🔥 Open Contests</Translate>
              </span>
            )}
            {/* Contextual doors for the pages that left the pared-down nav
                (IA 2026-07-17): the Atlas is their natural home. */}
            <Link className={styles.statPill} to="/route">
              <Translate id="page.atlas.findRoute" description="door pill">🧭 Find a route</Translate>
            </Link>
            <Link className={styles.statPill} to="/glossary">
              <Translate id="page.atlas.glossary" description="door pill">📖 Glossary</Translate>
            </Link>
          </div>
        </div>
      </header>

      {/* ---- FILTERS + GRID ---- */}
      <main className={styles.contentWrapper}>
        <div className="container">
          <div className={styles.filtersBar}>
            <div className={styles.filterGroup}>
              {complexityFilters().map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`${styles.filterPill} ${complexityFilter === filter.key ? styles.filterPillActive : ''}`}
                  onClick={() => setComplexityFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className={styles.contestFilterGroup}>
              {contestFilters().map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`${styles.contestFilterBtn} ${filter.key === 'open' ? styles.contestFilterBtnOpen : ''} ${contestFilter === filter.key ? styles.contestFilterBtnActive : ''}`}
                  onClick={() => setContestFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className={styles.filterGroup}>
              <select
                className={styles.sortSelect}
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                aria-label="Filter by region"
              >
                <option value="all">{translate({id: 'page.atlas.allRegions', message: '🌍 All Regions', description: 'filter option'})}</option>
                {regionOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                className={styles.sortSelect}
                value={vitalityFilter}
                onChange={(e) => setVitalityFilter(e.target.value)}
                aria-label="Filter by vitality"
              >
                <option value="all">{translate({id: 'page.atlas.allVitality', message: '🫀 All Vitality', description: 'filter option'})}</option>
                {VITALITY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{getVitalityLabel(lvl)}</option>
                ))}
              </select>
              <select
                className={styles.sortSelect}
                value={familyFilter}
                onChange={(e) => setFamilyFilter(e.target.value)}
                aria-label="Filter by language family"
              >
                <option value="all">{translate({id: 'page.atlas.allFamilies', message: '🌳 All Families', description: 'filter option'})}</option>
                {familyOptions.map((f) => (
                  <option key={f.name} value={f.name}>{f.name} ({f.count})</option>
                ))}
              </select>
              <select
                className={styles.sortSelect}
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                aria-label="Sort"
              >
                {sortOptions().map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <div className={styles.searchWrapper}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder={translate({id: 'page.atlas.searchPh', message: 'Search languages...', description: 'search placeholder'})}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search languages"
                />
                {search && (
                  <button className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear search">
                    &times;
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active genealogical drill-down chip (from a clicked ancestry node). */}
          {ancestryFilter && (
            <div className={styles.ancestryFilterBar} role="status">
              <span className={styles.ancestryFilterLabel}><Translate id="page.atlas.lineage" description="ancestry chip label">🌳 Lineage:</Translate></span>
              <span className={styles.ancestryFilterValue}>{ancestryFilter}</span>
              <span className={styles.ancestryFilterCount}>
                {displayCards.length === 1
                  ? <Translate id="page.atlas.oneLang" description="singular count; {n} is 1" values={{n: displayCards.length.toLocaleString()}}>{'{n} language'}</Translate>
                  : <Translate id="page.atlas.manyLangs" description="plural count; {n} number" values={{n: displayCards.length.toLocaleString()}}>{'{n} languages'}</Translate>}
              </span>
              <button
                type="button"
                className={styles.ancestryFilterClear}
                onClick={() => setAncestryFilter(null)}
              >
                <Translate id="page.atlas.clearChip" description="clear chip">Clear ✕</Translate>
              </button>
            </div>
          )}

          {/* Streaming progress: the catalog is still arriving behind the
              already-rendered grid. Count is live so the wait reads as
              progress, not a hang. */}
          {!isLoading && !indexComplete && !loadError && (
            <p role="status" style={{ textAlign: 'center', opacity: 0.65, padding: '0.25rem 0 0.75rem' }}>
              <Translate id="page.atlas.streaming" description="streaming progress; {n} count so far" values={{n: languages.length.toLocaleString()}}>{'Loading the atlas — {n} languages so far…'}</Translate>
            </p>
          )}

          {/* Cards Grid */}
          {loadError ? (
            <div className={styles.emptyState} role="alert">
              <div className={styles.emptyIcon}>⚠️</div>
              <p><Translate id="page.atlas.loadFail" description="error state">The language index failed to load.</Translate></p>
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={() => {
                  setIsLoading(true);
                  setReloadKey((k) => k + 1);
                }}
              >
                <Translate id="page.atlas.tryAgain" description="retry button">Try again</Translate>
              </button>
            </div>
          ) : isLoading ? (
            <div className={styles.loadingContainer} role="status" aria-label="Loading the language atlas">
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.65 }}>
                <Translate id="page.atlas.loading" description="loading state">Loading the atlas…</Translate>
              </p>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard} />
              ))}
            </div>
          ) : displayCards.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <p><Translate id="page.atlas.noMatch" description="empty state">No cards match your filters.</Translate></p>
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={() => {
                  setSearch('');
                  setComplexityFilter('all');
                  setContestFilter('all');
                  setRegionFilter('all');
                  setVitalityFilter('all');
                  setFamilyFilter('all');
                  setAncestryFilter(null);
                }}
              >
                <Translate id="page.atlas.resetFilters" description="reset button">Reset Filters</Translate>
              </button>
            </div>
          ) : (
            <>
              <div className={styles.cardsGrid}>
                {visibleCards.map(({ card }) => (
                  <LanguageCard
                    key={card.code}
                    card={card}
                    isSelected={selectedCard?.code === card.code}
                    onClick={() => setSelectedCard(card)}
                    familyTheme={getFamilyTheme(card)}
                  />
                ))}
              </div>
              {visibleCount < displayCards.length && (
                <div
                  ref={sentinelRef}
                  style={{ height: '1px', margin: '2rem 0' }}
                  aria-hidden="true"
                />
              )}
              {visibleCount < displayCards.length && (
                <p style={{ textAlign: 'center', opacity: 0.5, padding: '1rem' }}>
                  <Translate id="page.atlas.showing" description="pagination; {a} shown, {b} total" values={{a: visibleCount, b: displayCards.length}}>{'Showing {a} of {b} cards — scroll for more'}</Translate>
                </p>
              )}
            </>
          )}
        </div>
      </main>

      {/* Detail panel — handles its own data loading + macrolanguage hub nav. */}
      {selectedCard && (
        <DetailPanel
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSelectCard={setSelectedCard}
          onFilterAncestry={(node) => {
            if (!node) return;
            // Drill into the family/branch: clear competing filters, set the
            // lineage filter, close the panel, and jump to the top of the grid.
            setSearch('');
            setComplexityFilter('all');
            setContestFilter('all');
            setRegionFilter('all');
            setVitalityFilter('all');
            setFamilyFilter('all');
            setAncestryFilter(node);
            setSelectedCard(null);
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </Layout>
  );
}
