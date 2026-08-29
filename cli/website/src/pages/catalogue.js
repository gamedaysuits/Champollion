import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import Tip from '../components/Tip';
import { termAnchor } from '../utils/explainerLoader';
import { titleCase } from '../utils/humanize';
import { getUnescoVitalityLabel } from '../utils/vitality';
import styles from './catalogue.module.css';

// Turn a raw enum slug ("dictionary-platform", "open-web") into a readable
// label — hyphens/underscores to spaces, first letter capitalized. Only the
// DISPLAY text changes; the underlying slug stays the filter value/key.
function humanizeSlug(s) {
  if (!s) return s;
  return titleCase(String(s).replace(/[-_]/g, ' '));
}

// Plain-language tooltips for the badges newcomers stumble on. Each links to
// its glossary entry for the full definition.
const contamTip = () => ({
  term: translate({id: 'page.catalogue.contamTerm', message: 'Contamination posture', description: 'tooltip term'}),
  body: translate({id: 'page.catalogue.contamTip', message: 'Whether this corpus has likely been seen in models’ training data. “High” = likely-seen, so a result is read as a RELATIVE comparison between systems, not an absolute quality claim (“relative-only”). Low / sealed sets can support absolute rankings.', description: 'tooltip body'}),
  href: `/glossary#${termAnchor('data contamination')}`,
});
const signalTip = () => ({
  term: translate({id: 'page.catalogue.signalTerm', message: 'Signal strength (A–F)', description: 'tooltip term'}),
  body: translate({id: 'page.catalogue.signalTip', message: 'An objective grade of the TEST CORPUS — its size, example length, domain breadth, and contamination — separate from where the number came from. A = strong signal, F = weak. It rates the benchmark, not the model.', description: 'tooltip body'}),
  href: `/glossary#${termAnchor('data contamination')}`,
});

/* ====================================================================
   /catalogue — the public Index ("the Catalogue").
   A browsable, filterable map of EVERYTHING in the Network — benchmarks
   we run, per-language resources, methods, human translation services,
   and a clearly-partitioned cite-only "unverified" tier of externally
   published results — plus an honest "what we don't index, and why".

   Reads the build-time SSOT distillations:
     /data/catalogue.json       (small; loaded on mount)
     /data/catalogue-langs.json (per-language resources; lazy on demand)
   No scores required: this delivers value on day one. The page is a pure
   reader — it auto-improves as the SSOTs change (domain retags, new
   corpora, fresh grades flow straight through with no code change).
   ==================================================================== */

const CATALOGUE_URL = '/data/catalogue.json';
const LANGS_URL = '/data/catalogue-langs.json';

const TAB_IDS = ['overview', 'benchmarks', 'languages', 'methods', 'services', 'external', 'excluded'];
const tabs = () => [
  { id: 'overview', label: translate({id: 'page.catalogue.tabOverview', message: 'Overview', description: 'tab'}), hint: translate({id: 'page.catalogue.tabOverviewHint', message: 'Global summary', description: 'tab hint'}) },
  { id: 'benchmarks', label: translate({id: 'page.catalogue.tabBenchmarks', message: 'Benchmarks', description: 'tab'}), hint: translate({id: 'page.catalogue.tabBenchmarksHint', message: 'Datasets we run', description: 'tab hint'}) },
  { id: 'languages', label: translate({id: 'page.catalogue.tabLanguages', message: 'By language', description: 'tab'}), hint: translate({id: 'page.catalogue.tabLanguagesHint', message: 'Per-language resources', description: 'tab hint'}) },
  { id: 'methods', label: translate({id: 'page.catalogue.tabMethods', message: 'Methods', description: 'tab'}), hint: translate({id: 'page.catalogue.tabMethodsHint', message: 'MT engines & providers', description: 'tab hint'}) },
  { id: 'services', label: translate({id: 'page.catalogue.tabServices', message: 'Human translation', description: 'tab'}), hint: translate({id: 'page.catalogue.tabServicesHint', message: 'Translation services', description: 'tab hint'}) },
  { id: 'external', label: translate({id: 'page.catalogue.tabExternal', message: 'External results', description: 'tab'}), hint: translate({id: 'page.catalogue.tabExternalHint', message: 'Cite-only · unverified', description: 'tab hint'}) },
  { id: 'excluded', label: translate({id: 'page.catalogue.tabExcluded', message: "What we don't index", description: 'tab'}), hint: translate({id: 'page.catalogue.tabExcludedHint', message: 'And why', description: 'tab hint'}) },
];

const LANG_PAGE_SIZE = 50;

// ── small presentational helpers ─────────────────────────────────────
function Badge({ children, tone = 'neutral', title, tip }) {
  const span = (
    <span className={`${styles.badge} ${styles[`tone_${tone}`] || ''}`} title={tip ? undefined : title}>
      {children}
    </span>
  );
  if (!tip) return span;
  return (
    <Tip term={tip.term} body={tip.body} href={tip.href} placement={tip.placement || 'top'}>
      {span}
    </Tip>
  );
}

function licenseTone(license) {
  if (!license) return 'neutral';
  const l = license.toLowerCase();
  if (l.includes('nc') || l.includes('noncommercial')) return 'warn';
  if (l.includes('proprietary') || l.includes('tos')) return 'warn';
  if (l.includes('agpl') || l.includes('gpl')) return 'info';
  if (l.startsWith('cc0') || l.includes('apache') || l.includes('mit') || l.includes('cc-by')) return 'good';
  return 'neutral';
}

function contamTone(posture) {
  if (!posture) return 'neutral';
  const p = posture.toLowerCase();
  if (p.startsWith('high')) return 'warn';
  if (p.startsWith('low')) return 'good';
  return 'info';
}

function Stat({ value, label }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function ExtLink({ href, children }) {
  if (!href) return <span className={styles.muted}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.extLink}>
      {children} ↗
    </a>
  );
}

// ── tab content ──────────────────────────────────────────────────────
function OverviewTab({ data, onPivot }) {
  const s = data.summary || {};
  return (
    <div className={styles.tabBody}>
      <p className={styles.lede}>
        <Translate id="page.catalogue.lede" description="overview lede; {run}/{has}/{cite}/{out} are bold spans" values={{
          run: <strong><Translate id="page.catalogue.ledeRun" description="bold word">run</Translate></strong>,
          has: <strong><Translate id="page.catalogue.ledeHas" description="bold word">has</Translate></strong>,
          cite: <strong><Translate id="page.catalogue.ledeCite" description="bold phrase">cite but haven't reproduced</Translate></strong>,
          out: <strong><Translate id="page.catalogue.ledeOut" description="bold phrase">leave out</Translate></strong>,
        }}>{'The Index is a catalogue of the whole machine-translation field as the Network sees it — what we {run}, what each language already {has}, what we {cite}, and what we deliberately {out}. It needs no leaderboard scores to be useful, and it improves on its own as the data behind it grows.'}</Translate>
      </p>

      <div className={styles.browseBy}>
        <span className={styles.browseByLabel}><Translate id="page.catalogue.fourWays" description="browse label">Four ways in:</Translate></span>
        <button className={styles.browseChip} onClick={() => onPivot('overview')}><Translate id="page.catalogue.wayGlobal" description="browse chip">Global</Translate></button>
        <button className={styles.browseChip} onClick={() => onPivot('languages')}><Translate id="page.catalogue.wayLanguage" description="browse chip">By language</Translate></button>
        <button className={styles.browseChip} onClick={() => onPivot('benchmarks')}><Translate id="page.catalogue.wayDomain" description="browse chip">By domain</Translate></button>
        <button className={styles.browseChip} onClick={() => onPivot('languages')}><Translate id="page.catalogue.wayType" description="browse chip">By type</Translate></button>
      </div>

      <div className={styles.statStrip}>
        <Stat value={s.benchmarkFamilies ?? '—'} label={translate({id: 'page.catalogue.statFamilies', message: 'benchmark families we run', description: 'stat label'})} />
        <Stat value={(s.datasets ?? 0).toLocaleString()} label={translate({id: 'page.catalogue.statDatasets', message: 'evaluation datasets', description: 'stat label'})} />
        <Stat value={s.benchmarkLanguages ?? '—'} label={translate({id: 'page.catalogue.statLangs', message: 'languages benchmarked', description: 'stat label'})} />
        <Stat value={(s.languagesWithResources ?? 0).toLocaleString()} label={translate({id: 'page.catalogue.statResources', message: 'languages with indexed resources', description: 'stat label'})} />
        <Stat value={s.methods ?? '—'} label={translate({id: 'page.catalogue.statMethods', message: 'methods & providers', description: 'stat label'})} />
        <Stat value={s.externalResults ?? '—'} label={translate({id: 'page.catalogue.statExternal', message: 'external results (cited)', description: 'stat label'})} />
        <Stat value={s.externalIndexedPairs ? s.externalIndexedPairs.toLocaleString() : '—'} label={translate({id: 'page.catalogue.statPairs', message: 'published pairs indexed', description: 'stat label'})} />
      </div>

      <section className={styles.section}>
        <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.byType" description="section heading">By type — resources across languages</Translate></Heading>
        <p className={styles.sectionNote}>
          <Translate id="page.catalogue.byTypeNote" description="section note">Concrete, named resources indexed from the language cards. Click a type to browse the languages that have it.</Translate>
        </p>
        <div className={styles.chipRow}>
          {(data.resourceTypes || []).map((t) => (
            <button key={t.type} className={styles.dataChip} onClick={() => onPivot('languages', { type: t.type })}>
              {humanizeSlug(t.type)} <span className={styles.chipCount}>{t.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
        <h3 className={styles.h3}><Translate id="page.catalogue.archives" description="subheading">Language archives</Translate></h3>
        <p className={styles.sectionNote}>
          <Translate id="page.catalogue.archivesNote" description="section note">Endangered-language and documentation archives recorded per language (counts are holdings, not corpora we host).</Translate>
        </p>
        <div className={styles.chipRow}>
          {(data.archives || []).map((a) => (
            <ExtLink key={a.archive} href={a.url}>
              {a.label} <span className={styles.chipCount}><Translate id="page.catalogue.langsCount" description="archive chip count; {n} is a number" values={{n: a.languageCount.toLocaleString()}}>{'{n} langs'}</Translate></span>
            </ExtLink>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.byDomain" description="section heading">By domain — what the benchmarks cover</Translate></Heading>
        <p className={styles.sectionNote}><Translate id="page.catalogue.byDomainNote" description="section note">Click a domain to see the benchmark families in it.</Translate></p>
        <div className={styles.chipRow}>
          {(data.domains || []).map((d) => (
            <button key={d.domain} className={styles.dataChip} onClick={() => onPivot('benchmarks', { domain: d.domain })}>
              {d.domain} <span className={styles.chipCount}>{d.datasetCount.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.provenance" description="section heading">Provenance</Translate></Heading>
        <p className={styles.sectionNote}><Translate id="page.catalogue.provenanceNote" description="section note">Every row in the Index is distilled at build time from an in-repo source of truth:</Translate></p>
        <ul className={styles.provList}>
          <li><strong><Translate id="page.catalogue.provBench" description="provenance row">Benchmarks</Translate></strong> — <code>arena/datasets/registry.json</code></li>
          <li><strong><Translate id="page.catalogue.provRes" description="provenance row">Language resources</Translate></strong> — <Translate id="page.catalogue.provResCards" description="the language cards; {path} is a code span" values={{path: <code>cli/shared/language-cards/</code>}}>{'the language cards ({path})'}</Translate></li>
          <li><strong><Translate id="page.catalogue.provMethods" description="provenance row">Methods</Translate></strong> — <code>shared/method-registry.json</code></li>
          <li><strong><Translate id="page.catalogue.provServices" description="provenance row">Human services</Translate></strong> — <code>shared/human-services.json</code></li>
          <li><strong><Translate id="page.catalogue.provExternal" description="provenance row">External results</Translate></strong> — <code>shared/catalogue/external-results.json</code> (<Translate id="page.catalogue.citeOnly" description="cite-only marker">cite-only</Translate>)</li>
        </ul>
        {data.degraded && (
          <p className={styles.warnNote}>
            <Translate id="page.catalogue.degraded" description="degraded-build warning">⚠️ The corpora registry was unavailable at build time, so the benchmark sections are empty in this deploy. The manifest, methods, services and external tiers still render.</Translate>
          </p>
        )}
      </section>
    </div>
  );
}

function BenchmarksTab({ data, domainFilter, setDomainFilter }) {
  const [licenseFilter, setLicenseFilter] = useState('');
  const families = data.benchmarks || [];

  const domains = useMemo(() => (data.domains || []).map((d) => d.domain), [data]);
  const licenses = useMemo(() => (data.licenses || []).map((l) => l.license), [data]);

  const filtered = useMemo(() => {
    return families.filter((f) => {
      if (domainFilter && !f.domains.some((d) => d.domain === domainFilter)) return false;
      if (licenseFilter && !f.licenses.includes(licenseFilter)) return false;
      return true;
    });
  }, [families, domainFilter, licenseFilter]);

  return (
    <div className={styles.tabBody}>
      <p className={styles.lede}>
        <Translate id="page.catalogue.benchLede" description="benchmarks lede; {rel} is a bold span" values={{rel: <strong><Translate id="page.catalogue.relOnly" description="bold phrase">relative-only</Translate></strong>}}>{'Versioned evaluation corpora the Network runs in its own harness — fetched from source, never re-hosted. Each family shows its license and contamination posture: most public benchmarks are broadly trained on, so they score on a {rel} lane rather than as an absolute quality claim.'}</Translate>
      </p>

      <div className={styles.filterBar}>
        <label>
          <Translate id="page.catalogue.filterDomain" description="filter label">Domain</Translate>&nbsp;
          <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} className={styles.select}>
            <option value="">all</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label>
          <Translate id="page.catalogue.filterLicense" description="filter label">License</Translate>&nbsp;
          <select value={licenseFilter} onChange={(e) => setLicenseFilter(e.target.value)} className={styles.select}>
            <option value="">all</option>
            {licenses.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        {(domainFilter || licenseFilter) && (
          <button className={styles.clearBtn} onClick={() => { setDomainFilter(''); setLicenseFilter(''); }}><Translate id="page.catalogue.clear" description="clear filters">clear</Translate></button>
        )}
        <span className={styles.resultCount}><Translate id="page.catalogue.familiesCount" description="result count; {a} shown, {b} total" values={{a: filtered.length, b: families.length}}>{'{a} of {b} families'}</Translate></span>
      </div>

      <div className={styles.familyGrid}>
        {filtered.map((f) => (
          <div key={f.family} className={styles.familyCard}>
            <div className={styles.familyHead}>
              <h3 className={styles.familyName}>{f.name}</h3>
              <Badge tone={contamTone(f.contaminationPosture)} tip={contamTip()}>{f.contaminationPosture}</Badge>
            </div>
            <div className={styles.familyMeta}>
              <Badge tone="info"><Translate id="page.catalogue.nDatasets" description="badge; {n} is a number" values={{n: f.datasetCount.toLocaleString()}}>{'{n} datasets'}</Translate></Badge>
              <Badge tone="info"><Translate id="page.catalogue.nLanguages" description="badge; {n} is a number" values={{n: f.languageCount}}>{'{n} languages'}</Translate></Badge>
              {f.gatedCount > 0 && <Badge tone="warn" title={translate({id: 'page.catalogue.gatedTitle', message: 'Require a gated / token download', description: 'badge title'})}><Translate id="page.catalogue.nGated" description="badge; {n} is a number" values={{n: f.gatedCount}}>{'{n} gated'}</Translate></Badge>}
              {f.licenses.map((l) => <Badge key={l} tone={licenseTone(l)}>{l}</Badge>)}
            </div>
            <div className={styles.familyDomains}>
              {f.domains.map((d) => (
                <span key={d.domain} className={styles.domainPill}>{d.domain} · {d.count}</span>
              ))}
            </div>
            {f.examples && f.examples.length > 0 && (
              <details className={styles.examples}>
                <summary><Translate id="page.catalogue.examples" description="details summary">Example datasets</Translate></summary>
                <ul className={styles.exampleList}>
                  {f.examples.map((ex) => (
                    <li key={ex.id}>
                      <span className={styles.mono}>{(ex.source || '?')}→{(ex.target || '?')}</span>{' '}
                      {ex.name}
                      {ex.size != null && <span className={styles.muted}> · {ex.size.toLocaleString()} seg</span>}
                      {ex.gated && <span className={styles.muted}> · gated</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <p className={styles.footNote}>
        <Translate id="page.catalogue.benchFoot" description="benchmarks footnote; {reg} is a link, {tab} the excluded-tab name" values={{
          reg: <ExtLink href="/registry.json">registry.json</ExtLink>,
          tab: <em><Translate id="page.catalogue.excludedRef" description="tab reference">What we don't index</Translate></em>,
        }}>{'The full machine-readable catalogue of every dataset is served at {reg}. Quarantined "improper subset" slices are excluded here by design — see {tab}.'}</Translate>
      </p>
    </div>
  );
}

function LanguagesTab({ langs, loading, typeFilter, setTypeFilter, resourceTypes }) {
  const [query, setQuery] = useState('');
  const [macroFilter, setMacroFilter] = useState('');
  const [archiveFilter, setArchiveFilter] = useState('');
  const [benchOnly, setBenchOnly] = useState(false);
  const [limit, setLimit] = useState(LANG_PAGE_SIZE);

  const macroareas = useMemo(() => {
    const set = new Set();
    for (const l of langs) if (l.macroarea) set.add(l.macroarea);
    return [...set].sort();
  }, [langs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return langs.filter((l) => {
      if (q && !(l.name.toLowerCase().includes(q) || l.code.includes(q) || (l.endonym || '').toLowerCase().includes(q))) return false;
      if (macroFilter && l.macroarea !== macroFilter) return false;
      if (benchOnly && (!l.benchmarks || !l.benchmarks.length)) return false;
      if (typeFilter && !l.resources.some((r) => (r.type || r.cat) === typeFilter)) return false;
      if (archiveFilter && !l.archives.some((a) => a.archive === archiveFilter)) return false;
      return true;
    });
  }, [langs, query, macroFilter, benchOnly, typeFilter, archiveFilter]);

  useEffect(() => { setLimit(LANG_PAGE_SIZE); }, [query, macroFilter, benchOnly, typeFilter, archiveFilter]);

  if (loading) return <div className={styles.tabBody}><p className={styles.loading}><Translate id="page.catalogue.langsLoading" description="loading state">Loading the per-language resource directory…</Translate></p></div>;

  return (
    <div className={styles.tabBody}>
      <p className={styles.lede}>
        <Translate id="page.catalogue.langsLede" description="languages lede">What every language already has: corpora, models, morphological transducers (FSTs), dictionaries and tools, plus presence in documentation archives (OLAC, PARADISEC, AILLA, Rosetta, Kaipuleohone) and data platforms (OPUS, HuggingFace, Lexibank). Each resource shows its type, license and access level and links to the source. Sorted by how much each language already has.</Translate>
      </p>

      <div className={styles.filterBar}>
        <input
          className={styles.search}
          type="search"
          placeholder={translate({id: 'page.catalogue.searchPh', message: 'Search name, endonym or ISO code…', description: 'search placeholder'})}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label>
          <Translate id="page.catalogue.filterRegion" description="filter label">Region</Translate>&nbsp;
          <select value={macroFilter} onChange={(e) => setMacroFilter(e.target.value)} className={styles.select}>
            <option value="">all</option>
            {macroareas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          <Translate id="page.catalogue.filterType" description="filter label">Resource type</Translate>&nbsp;
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={styles.select}>
            <option value="">all</option>
            {(resourceTypes || []).map((t) => <option key={t.type} value={t.type}>{humanizeSlug(t.type)}</option>)}
          </select>
        </label>
        <label>
          <Translate id="page.catalogue.filterArchive" description="filter label">Archive</Translate>&nbsp;
          <select value={archiveFilter} onChange={(e) => setArchiveFilter(e.target.value)} className={styles.select}>
            <option value="">all</option>
            <option value="OLAC">OLAC</option>
            <option value="paradisec">PARADISEC</option>
            <option value="ailla">AILLA</option>
            <option value="rosettaProjectItems">Rosetta</option>
            <option value="kaipuleohoneItems">Kaipuleohone</option>
          </select>
        </label>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={benchOnly} onChange={(e) => setBenchOnly(e.target.checked)} /> <Translate id="page.catalogue.benchOnly" description="checkbox label">benchmarked only</Translate>
        </label>
        {(query || macroFilter || typeFilter || archiveFilter || benchOnly) && (
          <button className={styles.clearBtn} onClick={() => { setQuery(''); setMacroFilter(''); setTypeFilter(''); setArchiveFilter(''); setBenchOnly(false); }}><Translate id="page.catalogue.clear2" description="clear filters">clear</Translate></button>
        )}
        <span className={styles.resultCount}><Translate id="page.catalogue.nLangsCount" description="result count; {n} is a number" values={{n: filtered.length.toLocaleString()}}>{'{n} languages'}</Translate></span>
      </div>

      <div className={styles.langList}>
        {filtered.slice(0, limit).map((l) => <LanguageRow key={l.code} l={l} />)}
      </div>
      {filtered.length > limit && (
        <button className={styles.moreBtn} onClick={() => setLimit((n) => n + LANG_PAGE_SIZE)}>
          <Translate id="page.catalogue.showMore" description="pagination; {n} remaining" values={{n: (filtered.length - limit).toLocaleString()}}>{'Show more ({n} more)'}</Translate>
        </button>
      )}
    </div>
  );
}

function LanguageRow({ l }) {
  const [open, setOpen] = useState(false);
  const total = l.resources.length + l.archives.length + l.availability.length + l.benchmarks.length;
  return (
    <div className={styles.langRow}>
      <button className={styles.langHead} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={styles.langName}>
          {l.name}
          {l.endonym && <span className={styles.endonym}> · {l.endonym}</span>}
        </span>
        <span className={styles.langCode}>{l.code}</span>
        {l.macroarea && <span className={styles.langArea}>{l.macroarea}</span>}
        {l.vitality && <Badge tone="info">{getUnescoVitalityLabel(l.vitality)}</Badge>}
        <span className={styles.langCounts}>
          {l.resources.length > 0 && <span><Translate id="page.catalogue.rowResources" description="row count; {n} number" values={{n: l.resources.length}}>{'{n} resources'}</Translate></span>}
          {l.benchmarks.length > 0 && <span><Translate id="page.catalogue.rowBenchmarks" description="row count; {n} number" values={{n: l.benchmarks.length}}>{'{n} benchmarks'}</Translate></span>}
          {l.archives.length > 0 && <span><Translate id="page.catalogue.rowArchives" description="row count; {n} number" values={{n: l.archives.length}}>{'{n} archives'}</Translate></span>}
          {l.externalMt && <span><Translate id="page.catalogue.rowPairs" description="row count; {n} number" values={{n: l.externalMt.pairs}}>{'{n} published pairs'}</Translate></span>}
        </span>
        <span className={styles.caret}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className={styles.langDetail}>
          {l.resources.length > 0 && (
            <div className={styles.detailBlock}>
              <h4 className={styles.detailH}><Translate id="page.catalogue.dResources" description="detail heading">Resources</Translate></h4>
              <ul className={styles.resList}>
                {l.resources.map((r, i) => (
                  <li key={i}>
                    <Badge tone="neutral">{humanizeSlug(r.type || r.cat)}</Badge>{' '}
                    {r.url ? <ExtLink href={r.url}>{r.name || r.url}</ExtLink> : <span>{r.name || '—'}</span>}
                    {r.license && <span className={styles.muted}> · {r.license}</span>}
                    <span className={styles.access}> · {humanizeSlug(r.access)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {l.benchmarks.length > 0 && (
            <div className={styles.detailBlock}>
              <h4 className={styles.detailH}><Translate id="page.catalogue.dBench" description="detail heading">Benchmark coverage</Translate></h4>
              <div className={styles.chipRow}>
                {l.benchmarks.map((b) => (
                  <span key={b.family} className={styles.domainPill}>{b.family} · <Translate id="page.catalogue.nPairs" description="{n} pairs" values={{n: b.pairs}}>{'{n} pairs'}</Translate></span>
                ))}
              </div>
            </div>
          )}
          {l.externalMt && (
            <div className={styles.detailBlock}>
              <h4 className={styles.detailH}><Translate id="page.catalogue.dPublished" description="detail heading">Best published results (public benchmarks)</Translate></h4>
              <p className={styles.muted}>
                <Translate id="page.catalogue.dPublishedNote" description="detail note">Indexed from the Helsinki-NLP leaderboards — published numbers, not reproduced here; public test sets, so an orientation signal, never an absolute quality claim.</Translate>
              </p>
              <ul className={styles.resList}>
                {l.externalMt.best.map((b, i) => (
                  <li key={i}>
                    <Badge tone="neutral">{b.pair}</Badge>{' '}
                    <strong>chrF++ {b.value}</strong>
                    <span className={styles.muted}> · {b.family} · {b.testset}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.muted}><Translate id="page.catalogue.pairsCarry" description="published-pairs note; {n} number" values={{n: l.externalMt.pairs}}>{'{n} language pairs carry a published score for this language.'}</Translate></p>
            </div>
          )}
          {l.archives.length > 0 && (
            <div className={styles.detailBlock}>
              <h4 className={styles.detailH}><Translate id="page.catalogue.dArchives" description="detail heading">Archives</Translate></h4>
              <div className={styles.chipRow}>
                {l.archives.map((a) => (
                  <ExtLink key={a.archive} href={a.url}>
                    {a.label}{a.count != null ? ` · ${a.count}` : <> · <Translate id="page.catalogue.present" description="archive presence marker">present</Translate></>}
                  </ExtLink>
                ))}
              </div>
            </div>
          )}
          {l.availability.length > 0 && (
            <div className={styles.detailBlock}>
              <h4 className={styles.detailH}><Translate id="page.catalogue.dAvail" description="detail heading">Data availability</Translate></h4>
              <div className={styles.chipRow}>
                {l.availability.map((a, i) => (
                  <ExtLink key={i} href={a.url}>
                    {a.platform}{a.count != null ? ` · ${a.count}` : ' · present'}{a.names && a.names.length ? ` (${a.names.join(', ')})` : ''}
                  </ExtLink>
                ))}
              </div>
            </div>
          )}
          {total === 0 && <p className={styles.muted}><Translate id="page.catalogue.noRes" description="empty state">No indexed resources yet.</Translate></p>}
        </div>
      )}
    </div>
  );
}

function MethodsTab({ data }) {
  const methods = data.methods || [];
  return (
    <div className={styles.tabBody}>
      <p className={styles.lede}>
        <Translate id="page.catalogue.methodsLede" description="methods lede; {sig} is a code span" values={{sig: <code>translate(entries, config)</code>}}>{'Translation methods the harness and CLI can dispatch — LLM providers, neural MT APIs, rule-based engines and local models. Any method that implements {sig} can be added.'}</Translate>
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th><Translate id="page.catalogue.thMethod" description="th">Method</Translate></th><th><Translate id="page.catalogue.thKind" description="th">Kind</Translate></th><th><Translate id="page.catalogue.thParadigm" description="th">Paradigm</Translate></th><th><Translate id="page.catalogue.thLicense" description="th">License</Translate></th><th><Translate id="page.catalogue.thCommercial" description="th">Commercial</Translate></th><th><Translate id="page.catalogue.thCost" description="th">Cost</Translate></th></tr>
          </thead>
          <tbody>
            {methods.map((m) => (
              <tr key={m.name}>
                <td className={styles.mono}>{m.homepage ? <ExtLink href={m.homepage}>{m.name}</ExtLink> : m.name}</td>
                <td>{m.kind}</td>
                <td>{m.paradigm}</td>
                <td><Badge tone={licenseTone(m.license)}>{m.license || '—'}</Badge></td>
                <td>{m.commercialReady ? <Badge tone="good"><Translate id="page.catalogue.ready" description="badge">ready</Translate></Badge> : <Badge tone="warn"><Translate id="page.catalogue.restricted" description="badge">restricted</Translate></Badge>}</td>
                <td className={styles.muted}>{m.costNote || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServicesTab({ data }) {
  const services = data.humanServices || [];
  const live = services.filter((s) => s.consentAttested && s.status === 'approved');
  return (
    <div className={styles.tabBody}>
      <p className={styles.lede}>
        <Translate id="page.catalogue.servicesLede" description="services lede">Human translation providers — community organisations, agencies and individual translators — indexed by language pair. Listing is opt-in and consent-gated: a provider appears as live only once they have explicitly consented.</Translate>
      </p>
      {live.length === 0 && (
        <p className={styles.warnNote}>
          <Translate id="page.catalogue.servicesEmpty" description="empty state; {hub} is a link" values={{hub: <Link to="/human-services"><Translate id="page.catalogue.hubLink" description="hub link">See the human-translation hub →</Translate></Link>}}>{'No consented providers are listed live yet — this directory populates as providers opt in. The entries below are intake templates showing the shape of a listing. {hub}'}</Translate>
        </p>
      )}
      <div className={styles.serviceGrid}>
        {services.map((s) => (
          <div key={s.serviceId} className={styles.serviceCard}>
            <div className={styles.familyHead}>
              <h3 className={styles.familyName}>{s.displayName}</h3>
              <Badge tone={s.status === 'approved' ? 'good' : 'neutral'}>{s.status}</Badge>
            </div>
            <div className={styles.familyMeta}>
              {s.providerType && <Badge tone="info">{s.providerType}</Badge>}
              {s.source && s.target && <Badge tone="neutral">{s.source}→{s.target}</Badge>}
              {s.variety && <Badge tone="neutral">{s.variety}</Badge>}
              <Badge tone={s.consentAttested ? 'good' : 'warn'}>{s.consentAttested ? translate({id: 'page.catalogue.consented', message: 'consented', description: 'badge'}) : translate({id: 'page.catalogue.consentPending', message: 'consent pending', description: 'badge'})}</Badge>
            </div>
            {s.domains && s.domains.length > 0 && (
              <div className={styles.familyDomains}>
                {s.domains.map((d) => <span key={d} className={styles.domainPill}>{d}</span>)}
              </div>
            )}
            {s.ncTerms && <p className={styles.sectionNote}>{s.ncTerms}</p>}
          </div>
        ))}
      </div>
      <p className={styles.footNote}>
        <Translate id="page.catalogue.listService" description="services footnote; {link} is a link" values={{link: <Link to="/contribute"><Translate id="page.catalogue.listServiceLink" description="link text">List a service →</Translate></Link>}}>{'Provide translation in a language pair? {link}'}</Translate>
      </p>
    </div>
  );
}

function gradeTone(grade) {
  switch (grade) {
    case 'A': return 'good';
    case 'B': return 'good';
    case 'C': return 'info';
    case 'D': return 'warn';
    case 'F': return 'warn';
    default: return 'neutral';
  }
}

function MethodAvailabilityIndex({ methodIndex }) {
  if (!methodIndex || methodIndex.length === 0) return null;
  return (
    <section className={styles.section}>
      <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.mai" description="section heading">Method availability index</Translate></Heading>
      <p className={styles.sectionNote}>
        <Translate id="page.catalogue.maiNote" description="section note; {tab} is the Methods tab name, {badge} the runnable badge" values={{
          tab: <em><Translate id="page.catalogue.maiTabRef" description="tab name">Methods</Translate></em>,
          badge: <Badge tone="good"><Translate id="page.catalogue.runnable" description="badge">runnable</Translate></Badge>,
        }}>{'Every method behind these results — whether or not Champollion can dispatch it yet. We index how available each system is so we can point you to it now and implement it for you later. This is a superset of the runnable {tab} tab: {badge} entries are dispatchable today; the rest are cited-only.'}</Translate>
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th><Translate id="page.catalogue.thMethod2" description="th">Method</Translate></th><th><Translate id="page.catalogue.thOrg" description="th">Org</Translate></th><th><Translate id="page.catalogue.thWeights" description="th">Weights</Translate></th><th><Translate id="page.catalogue.thAccess" description="th">Access</Translate></th><th><Translate id="page.catalogue.thLicense2" description="th">License</Translate></th><th><Translate id="page.catalogue.thCommercial2" description="th">Commercial</Translate></th><th>Champollion</th></tr>
          </thead>
          <tbody>
            {methodIndex.map((m) => (
              <tr key={m.id}>
                <td className={styles.mono}>{m.homepage ? <ExtLink href={m.homepage}>{m.name}</ExtLink> : m.name}</td>
                <td>{m.org || '—'}</td>
                <td>
                  <Badge tone={m.weights === 'open' ? 'good' : m.weights === 'gated' ? 'warn' : 'neutral'}>
                    {m.weights}{m.weightsUrl ? '' : ''}
                  </Badge>
                  {m.weightsUrl && <> <ExtLink href={m.weightsUrl}><Translate id="page.catalogue.weightsLink" description="weights link">weights</Translate></ExtLink></>}
                </td>
                <td className={styles.muted}>{(m.access || []).join(', ') || '—'}</td>
                <td><Badge tone={licenseTone(m.license)}>{m.license || '—'}</Badge></td>
                <td>{m.commercialUse === false ? <Badge tone="warn"><Translate id="page.catalogue.nonCommercial" description="badge">non-commercial</Translate></Badge> : m.commercialUse === true ? <Badge tone="good">ok</Badge> : <Badge tone="neutral">—</Badge>}</td>
                <td>{m.runnable ? <Badge tone="good"><Translate id="page.catalogue.runnable2" description="badge">runnable</Translate></Badge> : <Badge tone="neutral"><Translate id="page.catalogue.citedOnly" description="badge">cited-only</Translate></Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExternalIndexSummary({ index }) {
  if (!index) return null;
  const wins = index.familyWins && index.familyWins.wins ? index.familyWins.wins : {};
  const winEntries = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  const winTotal = winEntries.reduce((n, [, c]) => n + c, 0);
  return (
    <div className={styles.detailBlock}>
      <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.pubIndex" description="section heading">The published-results index</Translate></Heading>
      <div className={styles.statRow}>
        <Stat value={index.pairs.toLocaleString()} label={translate({id: 'page.catalogue.statPairsIdx', message: 'language pairs indexed', description: 'stat label'})} />
        <Stat value={index.cells.toLocaleString()} label={translate({id: 'page.catalogue.statCells', message: 'pair × test-set cells', description: 'stat label'})} />
        <Stat value={index.models.toLocaleString()} label={translate({id: 'page.catalogue.statSystems', message: 'published systems', description: 'stat label'})} />
      </div>
      <p className={styles.sectionNote}>{index.note}</p>
      {winEntries.length > 0 && (
        <p className={styles.sectionNote}>
          <strong><Translate id="page.catalogue.whoHolds" description="family-wins question; {metric}/{testset} are values" values={{metric: index.familyWins.metric === 'chrf_pp' ? 'chrF++' : index.familyWins.metric, testset: index.familyWins.testset}}>{'Who holds the best published {metric} on {testset}?'}</Translate></strong>{' '}
          {winEntries.map(([fam, n], i) => (
            <span key={fam}>
              {i > 0 && ' · '}
              {fam} <strong>{((n / winTotal) * 100).toFixed(1)}%</strong> (<Translate id="page.catalogue.nPairs2" description="{n} pairs" values={{n: n.toLocaleString()}}>{'{n} pairs'}</Translate>)
            </span>
          ))}
        </p>
      )}
      {Array.isArray(index.sources) && index.sources.length > 0 && (
        <p className={styles.muted}>
          <Translate id="page.catalogue.sourcesPinned" description="sources label">Sources (commit-pinned):</Translate>{' '}
          {index.sources.map((s, i) => (
            <span key={s.repo}>
              {i > 0 && ' · '}
              <ExtLink href={s.repo}>{s.name}</ExtLink> @ <code>{(s.commit || '').slice(0, 8)}</code>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function ExternalTab({ data }) {
  const results = data.external || [];
  const methodIndex = data.methodIndex || [];
  const [catFilter, setCatFilter] = useState('');
  const cats = useMemo(() => [...new Set(results.map((r) => r.category).filter(Boolean))], [results]);
  const filtered = catFilter ? results.filter((r) => r.category === catFilter) : results;

  return (
    <div className={styles.tabBody}>
      <div className={styles.unverifiedBanner}>
        <Translate id="page.catalogue.extBanner" description="cite-only banner; {lead} bold lead, {noncomp} emphasized phrase" values={{
          lead: <strong><Translate id="page.catalogue.extBannerLead" description="bold lead">Cite-only · not reproduced by Champollion.</Translate></strong>,
          noncomp: <em><Translate id="page.catalogue.extBannerNoncomp" description="emphasized">these are not directly comparable</Translate></em>,
        }}>{'{lead} These are numbers other people published. We record the citation, the metric variant and the coverage — we never re-host the underlying corpus. Different sources report different metric variants (legacy BLEU vs FLORES spBLEU vs chrF vs chrF++ vs a specific COMET version) — {noncomp}, and each record says which variant it uses. Read every number with the badge.'}</Translate>
      </div>

      <ExternalIndexSummary index={data.externalIndex} />

      <p className={styles.sectionNote}>
        <Translate id="page.catalogue.provSignal" description="provenance/signal note; {lead} bold lead, {flag}/{not} emphasized, {signal} bold" values={{
          lead: <strong><Translate id="page.catalogue.provSignalLead" description="bold lead">Provenance and signal strength are separate.</Translate></strong>,
          flag: <em><Translate id="page.catalogue.notReproduced" description="emphasized">not reproduced</Translate></em>,
          not_: <em><Translate id="page.catalogue.notWord" description="emphasized">not</Translate></em>,
          signal: <strong><Translate id="page.catalogue.signalWord" description="bold">signal</Translate></strong>,
        }}>{'{lead} An external number is flagged {flag}, but it is {not_} penalised on grade for being external. The {signal} grade (A–F) reflects the objective strength of the corpus the number was measured on — size, example length, domain breadth and contamination — so a high model score on a tiny or broadly-memorised test set is still a weak edge.'}</Translate>
      </p>

      <MethodAvailabilityIndex methodIndex={methodIndex} />

      <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.reported" description="section heading">Reported results</Translate></Heading>
      <div className={styles.filterBar}>
        <label>
          <Translate id="page.catalogue.filterTypeExt" description="filter label">Type</Translate>&nbsp;
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={styles.select}>
            <option value="">all</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {catFilter && <button className={styles.clearBtn} onClick={() => setCatFilter('')}><Translate id="page.catalogue.clear3" description="clear filters">clear</Translate></button>}
        <span className={styles.resultCount}><Translate id="page.catalogue.nResults" description="{n} results" values={{n: filtered.length}}>{'{n} results'}</Translate></span>
      </div>

      <div className={styles.extList}>
        {filtered.map((r) => {
          const sig = r.signal_strength;
          return (
          <div key={r.id} className={styles.extCard}>
            <div className={styles.extHead}>
              <h3 className={styles.familyName}>{r.model || r.source}</h3>
              <Badge
                tone="info"
                title={translate({id: 'page.catalogue.citedTitle', message: 'The cited number was verified against its published source; it was NOT independently reproduced in the Champollion harness.', description: 'badge title'})}
              >
                <Translate id="page.catalogue.citedBadge" description="badge">cited · not reproduced</Translate>
              </Badge>
            </div>
            <div className={styles.familyMeta}>
              {r.org && <Badge tone="info">{r.org}</Badge>}
              {r.year && <Badge tone="neutral">{r.year}</Badge>}
              {r.category && <Badge tone="neutral">{r.category}</Badge>}
              {r.benchmark && <Badge tone="neutral">{r.benchmark}</Badge>}
              {r.pair && <Badge tone="neutral">{r.pair.source}→{r.pair.target}</Badge>}
              {sig && (
                <Badge tone={gradeTone(sig.grade)} tip={signalTip()}>
                  <Translate id="page.catalogue.signalGrade" description="badge; {g} is the grade letter" values={{g: sig.grade}}>{'signal {g}'}</Translate>
                </Badge>
              )}
            </div>
            {r.headline && <p className={styles.extHeadline}>{r.headline}</p>}
            <dl className={styles.extDl}>
              <dt><Translate id="page.catalogue.dtScore" description="dt">Score</Translate></dt>
              <dd>
                <strong>{r.metric} = {r.value}</strong>{' '}
                <span className={styles.muted}>({r.lower_is_better ? translate({id: 'page.catalogue.lowerBetter', message: 'lower is better', description: 'score direction'}) : translate({id: 'page.catalogue.higherBetter', message: 'higher is better', description: 'score direction'})})</span>
              </dd>
              {sig && (<><dt><Translate id="page.catalogue.dtSignal" description="dt; {g} grade" values={{g: sig.grade}}>{'Signal {g}'}</Translate></dt><dd className={styles.muted}>{sig.rationale}</dd></>)}
              {r.metric_variant_flag && (<><dt><Translate id="page.catalogue.dtCaveat" description="dt">Caveat</Translate></dt><dd className={styles.caveat}>{r.metric_variant_flag}</dd></>)}
              {r.langs_or_pairs && (<><dt><Translate id="page.catalogue.dtCoverage" description="dt">Coverage</Translate></dt><dd>{r.langs_or_pairs}</dd></>)}
              {r.notes && (<><dt><Translate id="page.catalogue.dtNotes" description="dt">Notes</Translate></dt><dd className={styles.muted}>{r.notes}</dd></>)}
            </dl>
            <p className={styles.extCite}>{r.citation}</p>
            <ExtLink href={r.source_url || r.url}><Translate id="page.catalogue.sourceLink" description="source link">Source</Translate></ExtLink>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function ExcludedTab({ data }) {
  const m = data.manifest || { run: [], cite: [], exclude: [] };
  return (
    <div className={styles.tabBody}>
      <p className={styles.lede}>
        <Translate id="page.catalogue.exclLede" description="excluded lede">An honest index says what it leaves out. These are families we deliberately don't index — not oversights, but field literacy. Knowing why a benchmark is excluded is part of reading the field correctly.</Translate>
      </p>

      <section className={styles.section}>
        <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.exclWhy" description="section heading">Excluded — and why</Translate></Heading>
        <div className={styles.excludeList}>
          {m.exclude.map((e) => (
            <div key={e.name} className={styles.excludeCard}>
              <div className={styles.familyHead}>
                <h3 className={styles.familyName}>{e.name}</h3>
                {e.reason_code && <Badge tone="warn">{e.reason_code}</Badge>}
              </div>
              <p className={styles.sectionNote}>{e.reason}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.citedNot" description="section heading">Cited, not reproduced</Translate></Heading>
        <p className={styles.sectionNote}>
          <Translate id="page.catalogue.citedNotNote" description="section note; {tab} is the External-results tab name" values={{tab: <em><Translate id="page.catalogue.extTabRef" description="tab name">External results</Translate></em>}}>{'Sources we point to but do not re-run — see the {tab} tab for the records.'}</Translate>
        </p>
        <ul className={styles.provList}>
          {m.cite.map((c) => (
            <li key={c.source}><strong>{c.source}</strong> — {c.note}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <Heading as="h2" className={styles.h2}><Translate id="page.catalogue.runOwn" description="section heading">Run — our own held benchmarks</Translate></Heading>
        <p className={styles.sectionNote}>
          <Translate id="page.catalogue.runOwnNote" description="section note; {tab} is the Benchmarks tab name" values={{tab: <em><Translate id="page.catalogue.benchTabRef" description="tab name">Benchmarks</Translate></em>}}>{'For contrast: the families we run ourselves, fetch-from-source, with their contamination posture. See the {tab} tab for the live counts.'}</Translate>
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th><Translate id="page.catalogue.thFamily" description="th">Family</Translate></th><th><Translate id="page.catalogue.thLicense3" description="th">License</Translate></th><th><Translate id="page.catalogue.thPosture" description="th">Posture</Translate></th><th><Translate id="page.catalogue.thNote" description="th">Note</Translate></th></tr></thead>
            <tbody>
              {m.run.map((r) => (
                <tr key={r.family}>
                  <td className={styles.mono}>{r.name}</td>
                  <td><Badge tone={licenseTone(r.license)}>{r.license || '—'}</Badge></td>
                  <td><Badge tone={contamTone(r.contamination_posture)} tip={contamTip()}>{r.contamination_posture || '—'}</Badge></td>
                  <td className={styles.muted}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────
export default function CataloguePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [langs, setLangs] = useState(null);
  const [langsLoading, setLangsLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [domainFilter, setDomainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // main catalogue
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(CATALOGUE_URL);
        if (!resp.ok) throw new Error('fetch failed');
        const json = await resp.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // honor #hash to deep-link a tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hash.replace('#', '');
    if (TAB_IDS.includes(h)) setTab(h);
  }, []);

  // lazy-load the per-language directory the first time the tab is opened
  const loadLangs = useCallback(() => {
    if (langs || langsLoading) return;
    setLangsLoading(true);
    fetch(LANGS_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setLangs((j && j.langs) || []))
      .catch(() => setLangs([]))
      .finally(() => setLangsLoading(false));
  }, [langs, langsLoading]);

  useEffect(() => { if (tab === 'languages') loadLangs(); }, [tab, loadLangs]);

  const pivot = useCallback((toTab, opts = {}) => {
    if (opts.domain != null) setDomainFilter(opts.domain);
    if (opts.type != null) setTypeFilter(opts.type);
    setTab(toTab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${toTab}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  return (
    <Layout
      title={translate({id: 'page.catalogue.seoTitle', message: 'The Index', description: '/catalogue SEO title'})}
      description={translate({id: 'page.catalogue.seoDesc', message: "A browsable catalogue of the machine-translation field: benchmarks we run, per-language resources, methods, human translation services, and a cite-only tier of externally published results — plus an honest account of what we don't index, and why.", description: '/catalogue SEO description'})}
    >
      <header className={styles.pageHeader}>
        <div className="container">
          <p className={styles.eyebrow}><Translate id="page.catalogue.eyebrow" description="eyebrow">THE CHAMPOLLION NETWORK</Translate></p>
          <Heading as="h1" className={styles.pageTitle}><Translate id="page.catalogue.title" description="h1">The Index</Translate></Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.catalogue.subtitle" description="page subtitle">An index of the computational-linguistics resources behind machine translation — the corpora, models, transducers, dictionaries and benchmarks that language communities, professional linguists and volunteers built, gathered in one place and credited to their sources. We catalogue the field; we don't own it.</Translate>
          </p>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        <div className="container">
          {error && (
            <p className={styles.warnNote}>
              <Translate id="page.catalogue.loadError" description="load error">The catalogue data couldn't be loaded. It is generated at build time from the in-repo sources of truth; if you're running locally, build the site first.</Translate>
            </p>
          )}
          {!data && !error && <p className={styles.loading}><Translate id="page.catalogue.loading" description="loading state">Loading the Index…</Translate></p>}

          {data && (
            <>
              <nav className={styles.tabBar} aria-label="Index sections">
                {tabs().map((t) => (
                  <button
                    key={t.id}
                    className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ''}`}
                    onClick={() => pivot(t.id)}
                    title={t.hint}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>

              {tab === 'overview' && <OverviewTab data={data} onPivot={pivot} />}
              {tab === 'benchmarks' && <BenchmarksTab data={data} domainFilter={domainFilter} setDomainFilter={setDomainFilter} />}
              {tab === 'languages' && (
                <LanguagesTab
                  langs={langs || []}
                  loading={langsLoading || langs === null}
                  typeFilter={typeFilter}
                  setTypeFilter={setTypeFilter}
                  resourceTypes={data.resourceTypes}
                />
              )}
              {tab === 'methods' && <MethodsTab data={data} />}
              {tab === 'services' && <ServicesTab data={data} />}
              {tab === 'external' && <ExternalTab data={data} />}
              {tab === 'excluded' && <ExcludedTab data={data} />}
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}
