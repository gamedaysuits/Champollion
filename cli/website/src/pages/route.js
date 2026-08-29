/**
 * /route — the route finder: best current path between any two languages,
 * with the predicted loss, or a loud honest "no mapping yet" plus the real
 * command that grows the network.
 *
 * HONESTY RAILS (all inherited from src/utils/meshChains.js):
 *   • Chains traverse only CLEAN measured edges (clean === true, fail-safe).
 *   • A chain quality is a PREDICTION (product of measured hops), never a
 *     measured end-to-end score — the UI says so, loudly.
 *   • A direct measured edge displays with its cchrF++ band exactly like the
 *     homepage arcs (src/utils/arcStrength.mjs — one system, one meaning).
 *   • Empty board → no fabricated numbers, just the real next action.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import {
  bestMeasuredChain,
  buildEdgeIndex,
  hopsFromNodes,
  pairKey,
} from '../utils/meshChains';
import {arcStyle, BIN_LABELS} from '../utils/arcStrength.mjs';
import FLOORS from '../data/cchrf-floors.json';
import styles from './route.module.css';

const PROVIDERS = ['auto-detect', 'openrouter', 'anthropic', 'openai', 'gemini'];

function runQueueCommand(budget, provider) {
  const b = Number(budget);
  const budgetStr = !Number.isFinite(b) || b <= 0 ? '2' : String(b);
  const providerStr =
    provider && provider !== 'auto-detect' ? ` --provider ${provider}` : '';
  return `curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget ${budgetStr}${providerStr}`;
}

/** Searchable language picker over /data/lang-index.json (7,927 entries). */
function LangPicker({label, langs, value, onPick}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return langs
      .filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.code === q ||
          (l.nativeName && l.nativeName.toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [query, langs]);
  return (
    <div className={styles.picker}>
      <label className={styles.pickerLabel}>{label}</label>
      <input
        className={styles.pickerInput}
        type="text"
        placeholder={translate({id: 'page.route.pickerPh', message: 'Type a language name…', description: 'picker placeholder'})}
        value={value ? `${value.name} (${value.code})` : query}
        onChange={(ev) => {
          onPick(null);
          setQuery(ev.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          // Focusing a filled picker starts a fresh search (combobox norm).
          if (value) {
            onPick(null);
            setQuery('');
          }
          setOpen(true);
        }}
      />
      {open && matches.length > 0 && !value && (
        <ul className={styles.pickerList}>
          {matches.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                className={styles.pickerItem}
                onClick={() => {
                  onPick(l);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {l.name}
                {l.nativeName ? ` · ${l.nativeName}` : ''}
                <span className={styles.pickerCode}>{l.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** cchrF++ band chip for a measured edge — same mapping as the homepage arcs. */
function StrengthChip({edge}) {
  const style = arcStyle(edge, FLOORS.floors);
  if (!style) return null;
  if (!style.corrected) {
    return (
      <span className={styles.chip} style={{borderColor: style.color, color: style.color}}>
        <Translate id="page.route.floorUnknown" description="strength chip; {v} is the score" values={{v: edge.best_chrf.toFixed(1)}}>{'chrF++ {v} · floor unknown (uncorrected)'}</Translate>
      </span>
    );
  }
  return (
    <span className={styles.chip} style={{borderColor: style.color, color: style.color}}>
      cchrF++ {style.cchrf.toFixed(2)} · {BIN_LABELS[style.bin]}
      {style.provisional ? <> · <Translate id="page.route.provisional" description="chip marker">provisional (n&lt;100)</Translate></> : ''}
    </span>
  );
}

export default function RoutePage() {
  const [langs, setLangs] = useState([]);
  const [mesh, setMesh] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [budget, setBudget] = useState('2');
  const [provider, setProvider] = useState('auto-detect');

  useEffect(() => {
    fetch('/data/lang-index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLangs(Array.isArray(d) ? d : []))
      .catch(() => setLangs([]));
    fetch('/mesh.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setMesh(m && Array.isArray(m.edges) ? m : {edges: []}))
      .catch(() => setMesh({edges: []}));
  }, []);

  // Deep link: /route?from=eng&to=pam preselects the pair (the map's
  // per-pair connection card links here; also makes routes shareable).
  // Applied once, after the language index loads; unknown codes are
  // silently ignored — the pickers just stay empty.
  const appliedParamsRef = useRef(false);
  useEffect(() => {
    if (appliedParamsRef.current || !langs.length) return;
    appliedParamsRef.current = true;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const byCode = (code) =>
      code ? langs.find((l) => l.code === code) || null : null;
    const f = byCode(params.get('from'));
    const t = byCode(params.get('to'));
    if (f) setFrom(f);
    if (t) setTo(t);
  }, [langs]);

  const nameOf = useMemo(() => {
    const map = new Map(langs.map((l) => [l.code, l.name]));
    return (code) => map.get(code) || code;
  }, [langs]);

  const result = useMemo(() => {
    if (!from || !to || !mesh) return null;
    if (from.code === to.code) return {state: 'same'};
    const edgeIndex = buildEdgeIndex(mesh.edges);
    const direct = edgeIndex.get(pairKey(from.code, to.code)) || null;
    const directMeasured =
      direct && direct.status === 'measured' && typeof direct.best_chrf === 'number'
        ? direct
        : null;
    const chain = bestMeasuredChain(mesh.edges, from.code, to.code);
    if (chain) {
      const hops = hopsFromNodes(chain.nodes, edgeIndex);
      const quality = hops.reduce(
        (p, h) => (h.quality != null ? p * h.quality : p),
        1,
      );
      return {state: 'chain', hops, nodes: chain.nodes, quality, directMeasured};
    }
    if (directMeasured) {
      return {
        state: 'chain',
        hops: hopsFromNodes([from.code, to.code], edgeIndex),
        nodes: [from.code, to.code],
        quality: directMeasured.best_chrf / 100,
        directMeasured,
      };
    }
    return {state: 'unmapped', registered: !!direct, direct};
  }, [from, to, mesh]);

  return (
    <Layout
      title={translate({id: 'page.route.seoTitle', message: 'Find a route', description: '/route SEO title'})}
      description={translate({id: 'page.route.seoDesc', message: 'The best measured translation route between any two languages — or the command that maps it.', description: '/route SEO description'})}
    >
      <main className={styles.main}>
        <h1 className={styles.title}><Translate id="page.route.title" description="h1">Find a route</Translate></h1>
        <p className={styles.sub}>
          <Translate id="page.route.sub" description="page subtitle">Pick any two languages. If measured, clean translation data connects them — directly or through pivot languages — this shows the loss-minimizing route and its predicted quality. If not, it shows you the honest truth and the exact command that starts mapping it.</Translate>
        </p>

        <div className={styles.pickers}>
          <LangPicker label={translate({id: 'page.route.from', message: 'From', description: 'picker label'})} langs={langs} value={from} onPick={setFrom} />
          <span className={styles.arrow}>→</span>
          <LangPicker label={translate({id: 'page.route.to', message: 'To', description: 'picker label'})} langs={langs} value={to} onPick={setTo} />
        </div>

        {result && result.state === 'same' && (
          <p className={styles.note}><Translate id="page.route.samePair" description="same-pair note">Pick two different languages.</Translate></p>
        )}

        {result && result.state === 'chain' && (
          <section className={styles.result}>
            <h2 className={styles.resultTitle}>
              <Translate id="page.route.resultTitle" description="route result; {q}/{loss} are bold percentages" values={{
                q: <b>{Math.round(result.quality * 100)}%</b>,
                loss: <b>{Math.round((1 - result.quality) * 100)}%</b>,
              }}>{'Best current route · {q} predicted meaning retained · expected loss {loss}'}</Translate>
            </h2>
            <p className={styles.disclaimer}>
              <Translate id="page.route.disclaimer" description="prediction disclaimer; {pred} bold, {spec} a link" values={{
                pred: <b><Translate id="page.route.predWord" description="bold">prediction</Translate></b>,
                spec: <a href="/docs/network/specifications/connection-strength"><Translate id="page.route.strengthLink" description="link text">how strength is measured</Translate></a>,
              }}>{'This is a {pred} — the product of each hop\'s measured chrF++, compounded. It is not a measured end-to-end score. Chains traverse only clean (LOW-contamination) measured corpora; {spec}.'}</Translate>
            </p>
            <ol className={styles.hops}>
              {result.hops.map((h) => (
                <li key={`${h.from}-${h.to}`} className={styles.hop}>
                  <span className={styles.hopPair}>
                    {nameOf(h.from)} → {nameOf(h.to)}
                  </span>
                  {h.edge ? <StrengthChip edge={h.edge} /> : null}
                  {h.chrf != null ? (
                    <span className={styles.hopChrf}>chrF++ {h.chrf.toFixed(1)}</span>
                  ) : (
                    <span className={styles.hopChrf}><Translate id="page.route.awaiting" description="hop state">awaiting measurement</Translate></span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {result && result.state === 'unmapped' && (
          <section className={styles.unmapped}>
            <h2 className={styles.unmappedTitle}><Translate id="page.route.unmapped" description="unmapped heading">⚠ NO MEASURED MAPPING YET</Translate></h2>
            <p>
              <Translate id="page.route.noData" description="unmapped body; {a}/{b} are language names" values={{a: <b>{from.name}</b>, b: <b>{to.name}</b>}}>{'No measured, clean translation data connects {a} and {b} on the public board today — directly or through any pivot.'}</Translate>{' '}
              {result.registered ? (
                <Translate id="page.route.registered" description="corpus registered note; {reg} is bold" values={{reg: <b><Translate id="page.route.isRegistered" description="bold">is registered</Translate></b>}}>{'A corpus for this pair {reg} and sits in the open queue — it just hasn\'t been run.'}</Translate>
              ) : (
                <Translate id="page.route.notRegistered" description="no corpus note">No evaluation corpus is registered for this pair yet.</Translate>
              )}
            </p>
            <div className={styles.mapIt}>
              <p className={styles.mapItLabel}>
                <Translate id="page.route.mapIt" description="map-it lead; {b} is the bold lead" values={{b: <b><Translate id="page.route.mapItLead" description="bold lead">Map it.</Translate></b>}}>{'{b} This command runs the highest-value open benchmarks up to your budget — every completed run lights new edges on the map and shortens routes like this one:'}</Translate>
              </p>
              <div className={styles.controls}>
                <label>
                  <Translate id="page.route.budget" description="budget label">Budget $</Translate>
                  <input
                    className={styles.budget}
                    type="number"
                    min="1"
                    step="1"
                    value={budget}
                    onChange={(ev) => setBudget(ev.target.value)}
                  />
                </label>
                <label>
                  <Translate id="page.route.provider" description="provider label">Provider</Translate>{' '}
                  <select
                    value={provider}
                    onChange={(ev) => setProvider(ev.target.value)}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <pre className={styles.cmd}>
                <code>{runQueueCommand(budget, provider)}</code>
              </pre>
              {!result.registered && (
                <p className={styles.note}>
                  <Translate id="page.route.openPair" description="open-this-pair note; {tatoeba}/{register} are links" values={{
                    tatoeba: <a href="https://tatoeba.org">Tatoeba</a>,
                    register: <a href="/docs/network/sovereignty/registering-corpora"><Translate id="page.route.registerLink" description="link text">register a corpus</Translate></a>,
                  }}>{'To open this exact pair: speakers can add sentences to {tatoeba} today (our dev corpora rebuild from Tatoeba releases), or {register} — 50 curated pairs are enough to open a track.'}</Translate>
                </p>
              )}
            </div>
          </section>
        )}

        <p className={styles.registerNote}>
          <Translate id="page.route.registerNote" description="register-routing note">Register-level routing (formal / informal / traditional narrative…) arrives when register-tagged runs reach the board — the scoring lane already records register per run; routes will trace it the moment the first tagged runs land.</Translate>
        </p>
      </main>
    </Layout>
  );
}
