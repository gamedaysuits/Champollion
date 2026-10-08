import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import ProvenanceTip from '../components/ProvenanceTip';
import { fetchQueueTop, fetchQueuePairs } from '../utils/liveQueue';
import { AGENT_PROMPT } from '../utils/seamStory.mjs';
import Translate, {translate} from '@docusaurus/Translate';

import styles from './spoke.module.css';
import local from './contribute.module.css';

/* ====================================================================
   /contribute — "Run the queue" spoke.
   Community compute: a public sweep queue anyone can run through with
   their own API key. Agent fast path up front, the contribution ladder,
   a live queue preview, provider notes, and the honest trust framing.
   All numbers sourced in cli/website/CLAIMS.md ("/contribute" section).
   ==================================================================== */

// AGENT_PROMPT is imported from seamStory.mjs — one string, shared with the
// homepage beta strip, so the two can never drift apart again.

const RUN_QUEUE_CMD = 'curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2';

// Provider metadata for the command configurator
const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter', envVar: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/keys',   note: 'proxies all models — one key for everything' },
  { value: 'openai',     label: 'OpenAI',     envVar: 'OPENAI_API_KEY',     url: 'https://platform.openai.com/api-keys', note: 'GPT-4o, GPT-5.5, o4-mini' },
  { value: 'anthropic',  label: 'Anthropic',   envVar: 'ANTHROPIC_API_KEY',  url: 'https://console.anthropic.com/settings/keys', note: 'Claude Sonnet, Haiku, Opus' },
  { value: 'gemini',     label: 'Google Gemini', envVar: 'GOOGLE_API_KEY',   url: 'https://aistudio.google.com/apikey', note: 'Gemini Flash, Pro' },
];

function giveCommand(budget, provider) {
  const b = Number(budget);
  // Budget is always explicit — the /give script requires it.
  const budgetStr = (!Number.isFinite(b) || b <= 0) ? '2' : String(b);
  // Provider is only included when it's not the default (openrouter)
  const providerStr = (provider && provider !== 'openrouter')
    ? ` --provider ${provider}`
    : '';
  return `curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget ${budgetStr}${providerStr}`;
}

function GiveCommand() {
  const [budget, setBudget] = useState('2');
  const [provider, setProvider] = useState('openrouter');
  const cmd = giveCommand(budget, provider);
  const prov = PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0];
  return (
    <div className={local.promptBlock}>
      <div className={local.promptHead}>
        <span className={local.promptControls}>
          <span className={local.giveInputWrap}>
            <Translate id="page.contribute.provider" description="configurator label">Provider:</Translate>{' '}
            <select
              className={local.giveSelect}
              value={provider}
              aria-label="API provider"
              onChange={(e) => setProvider(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </span>
          <span className={local.giveInputWrap}>
            <Translate id="page.contribute.budget" description="configurator label">Budget:</Translate>{' '}
            $
            <input
              className={local.giveInput}
              type="number"
              min="0.50"
              step="0.50"
              value={budget}
              aria-label="Budget in US dollars"
              onChange={(e) => setBudget(e.target.value)}
            />
          </span>
        </span>
        <CopyButton text={cmd} label={translate({id: 'page.contribute.copyCmd', message: 'Copy command', description: 'copy button'})} />
      </div>
      <pre className={local.promptPre}>{cmd}</pre>
      <p className={local.providerHint}>
        <Translate id="page.contribute.requires" description="provider hint; {env} code span, {link} a link, {note} provider note" values={{
          env: <code>{prov.envVar}</code>,
          link: <a href={prov.url} target="_blank" rel="noopener noreferrer"><Translate id="page.contribute.getKey" description="get a key link">get a key</Translate></a>,
          note: prov.note,
        }}>{'Requires {env} — {link} ({note})'}</Translate>
      </p>
    </div>
  );
}

function CopyButton({ text, label }) {
  const fallbackLabel = translate({id: 'page.contribute.copy', message: 'Copy', description: 'copy button default'});
  label = label || fallbackLabel;
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }, [text]);
  return (
    <button
      type="button"
      className={local.copyBtn}
      onClick={onCopy}
      aria-label={copied ? 'Copied to clipboard' : `${label} to clipboard`}
    >
      {copied ? translate({id: 'page.contribute.copied', message: 'Copied ✓', description: 'copied state'}) : label}
    </button>
  );
}

function QueuePreview() {
  const [queue, setQueue] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The static preview is BOTH the metadata scaffold (corpora, generated_at,
      // full_queue size — not carried by the RPCs) AND the fallback. Fetch it
      // first: it's small (never the multi-MB work-list, which is gated behind
      // the sized download link below and consumed only by the harness).
      let preview;
      try {
        const resp = await fetch('/queue-preview.json');
        if (!resp.ok) throw new Error(String(resp.status));
        preview = await resp.json();
      } catch {
        if (!cancelled) setFailed(true);
        return;
      }
      if (!preview?.items?.length) {
        if (!cancelled) setFailed(true);
        return;
      }

      // Base view = the static preview (fallback-safe if the DB is unreachable).
      let view = {
        items: preview.items,
        openItems: preview.metadata?.open_items ?? null,
        corpora: preview.metadata?.corpora ?? null,
        generatedAt: preview.metadata?.generated_at ?? null,
        fullQueue: preview.full_queue ?? null,
        live: false,
      };

      // Strangler-fig (B1 / DB-as-queue): overlay the LIVE queue from Postgres —
      // the top items from queue_top and the open-item total from queue_pairs
      // (SUM of per-pair counts, coverage-filtered against VERIFIED runs). So the
      // shop window reflects the current board (covered combos gone, count live),
      // not the last ranker snapshot. Any failure keeps the static preview.
      try {
        const rankMode = preview.metadata?.rank_mode || 'map';
        const [topItems, pairs] = await Promise.all([
          fetchQueueTop({ rankMode, limit: 50 }),
          fetchQueuePairs({ rankMode }),
        ]);
        if (Array.isArray(topItems) && topItems.length && Array.isArray(pairs)) {
          const liveOpen = pairs.reduce((n, p) => n + (Number(p.count) || 0), 0);
          view = { ...view, items: topItems, openItems: liveOpen, live: true };
        }
      } catch {
        /* DB unreachable — keep the static preview view built above. */
      }

      if (!cancelled) setQueue(view);
    })();
    return () => { cancelled = true; };
  }, []);

  if (failed) {
    return (
      <p className={styles.note}>
        <Translate id="page.contribute.queueFail" description="queue load failure; {link} is queue.json link" values={{link: <Link href="pathname:///queue.json">queue.json</Link>}}>{'Couldn’t load the live queue in this browser — see the full list at {link}.'}</Translate>
      </p>
    );
  }
  if (!queue) {
    return <p className={styles.note}><Translate id="page.contribute.queueLoading" description="loading state">Loading the queue…</Translate></p>;
  }

  // One row per PAIR: the queue holds every (model × condition) combination,
  // but the shop window shows each pair once — its top-ranked naive item
  // (coached items need your own coaching file; that lane lives in the
  // ladder below, not the first-contact preview).
  const seen = new Set();
  const top = [];
  for (const it of queue.items) {
    if (it.condition !== 'naive') continue;
    if (seen.has(it.language_pair)) continue;
    seen.add(it.language_pair);
    top.push(it);
    if (top.length >= 5) break;
  }
  const fmtCost = (c) =>
    c == null ? '—' : c < 0.01 ? '<$0.01' : `~$${c.toFixed(2)}`;
  const fullMB = queue.fullQueue?.bytes
    ? Math.round(queue.fullQueue.bytes / 1e6)
    : null;
  const pairNames = (it) =>
    it.source_language
      ? `${it.source_language} → ${it.target_language}`
      : `(${it.target_language})`;

  return (
    <>
      <p className={styles.note}>
        {queue.openItems != null
          ? <Translate id="page.contribute.openItems" description="open item count; {n} is the number" values={{n: queue.openItems.toLocaleString()}}>{'{n} open items'}</Translate>
          : <Translate id="page.contribute.openItemsBare" description="open items label">open items</Translate>}
        {queue.corpora != null ? <> <Translate id="page.contribute.acrossCorpora" description="corpora count; {n} is the number" values={{n: queue.corpora}}>{'across {n} corpora'}</Translate></> : ''}
        {queue.generatedAt ? <> · <Translate id="page.contribute.generated" description="generation date; {d} is the date" values={{d: queue.generatedAt.slice(0, 10)}}>{'generated {d}'}</Translate></> : ''}
        {' · '}<Translate id="page.contribute.queueNote" description="queue preview note">one row per pair, top of the ranking first · no claim-locking — pick any item</Translate>
      </p>
      <ol className={local.queueList}>
        {top.map((it) => (
          <li key={it.id} className={local.queueItem}>
            <div className={local.queueItemHead}>
              <span className={local.queuePair}>
                {pairNames(it)}{' '}
                <span className={local.queueLang}>
                  {it.language_pair.replace('>', ' → ')}
                </span>
              </span>
              <span className={local.queueMeta}>
                <code className={local.queueModel}>{it.model}</code>
                <span className={local.queueCost}>{fmtCost(it.est_cost_usd)}</span>
              </span>
            </div>
            <div className={local.queueCmdRow}>
              <code className={local.queueCmd}>{it.run_command}</code>
              <CopyButton text={it.run_command} />
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        <Translate id="page.contribute.cmdExplain" description="what each command does">Each command runs exactly that benchmark: the harness fetches the named corpus, translates it with the named model (both languages spelled out), scores it, and writes a local report you can publish. Estimates come from our baseline sweep; your price depends on provider rates.</Translate>{' '}
        <Link href="pathname:///queue.json">
          <Translate id="page.contribute.fullQueue" description="full queue link; {mb} is e.g. ' (86 MB)' or empty" values={{mb: fullMB ? ` (${fullMB} MB)` : ''}}>{'Full queue{mb} →'}</Translate>
        </Link>
      </p>
    </>
  );
}

const tiers = () => [
  {
    name: translate({id: 'page.contribute.tier1', message: 'Run a benchmark', description: 'tier name'}),
    effort: translate({id: 'page.contribute.tier1Effort', message: '~10 minutes · most items under $0.55, median ≈ $0.09', description: 'tier effort line'}),
    body: (
      <>
        <Translate id="page.contribute.tier1Body" description="tier body">Install the harness, pick any open queue item, paste its command, and publish the report. That’s a real, fingerprinted data point on a language pair nobody has measured yet. No MT background needed.</Translate>
      </>
    ),
    links: [
      { label: translate({id: 'page.contribute.linkGuide', message: 'Contributing Compute guide', description: 'tier link'}), href: '/docs/network/getting-started/contributing-compute' },
    ],
  },
  {
    name: translate({id: 'page.contribute.tier2', message: 'Craft coached prompts', description: 'tier name'}),
    effort: translate({id: 'page.contribute.tier2Effort', message: 'an afternoon · same per-run cost as a baseline', description: 'tier effort line'}),
    body: (
      <>
        <Translate id="page.contribute.tier2Body" description="tier body; {flag} is a code span" values={{flag: <code>--coaching-file</code>}}>{'Write a coaching file — grammar rules, a small glossary, style notes for the target language — and pass it with {flag}. The harness injects it as the system prompt and records the full text in the run card, so your prompt craft is reproducible. Beating the naive baseline on a low-resource pair is a genuine finding.'}</Translate>
      </>
    ),
    links: [
      { label: translate({id: 'page.contribute.linkCoached', message: 'Cookbook: Coached LLM Prompting', description: 'tier link'}), href: '/docs/network/tutorials/coached-llm-prompting' },
    ],
  },
  {
    name: translate({id: 'page.contribute.tier3', message: 'Build a method', description: 'tier name'}),
    effort: translate({id: 'page.contribute.tier3Effort', message: 'days to weeks · you set the budget', description: 'tier effort line'}),
    body: (
      <>
        <Translate id="page.contribute.tier3Body" description="tier body; {sig} is a code span" values={{sig: <code>translate(entries, config)</code>}}>{'Implement {sig} and the harness will benchmark anything inside it: FST-gated generation, dictionary lookup, retrieval, chained models. Declared dependency classes (S/O/A1/A2) keep methods comparable and auditable.'}</Translate>
      </>
    ),
    links: [
      { label: translate({id: 'page.contribute.linkMethods', message: 'Method interface & dependency classes', description: 'tier link'}), href: '/docs/network/specifications/methods' },
      { label: translate({id: 'page.contribute.linkFst', message: 'Cookbook: FST-Gated Pipeline', description: 'tier link'}), href: '/docs/network/tutorials/fst-gated-pipeline' },
      { label: translate({id: 'page.contribute.linkDict', message: 'Cookbook: Dictionary-Augmented LLM', description: 'tier link'}), href: '/docs/network/tutorials/dictionary-augmented-llm' },
    ],
  },
];

export default function ContributePage() {
  return (
    <Layout
      title={translate({id: 'page.contribute.seoTitle', message: 'Contribute Compute', description: '/contribute SEO title'})}
      description={translate({id: 'page.contribute.seoDesc', message: 'Run the public eval queue: run open MT benchmarks on low-resource language pairs with your own API key and publish the results to a public leaderboard.', description: '/contribute SEO description'})}
    >
      <header className={styles.pageHeader}>
        <div className="container">
          <p className={styles.eyebrow}><Translate id="page.contribute.eyebrow" description="eyebrow">RUN THE QUEUE</Translate></p>
          <Heading as="h1" className={styles.pageTitle}>
            <Translate id="page.contribute.title" description="h1">Contribute Compute</Translate>
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.contribute.subtitle" description="page subtitle">The queue is a ranked list of benchmarks nobody has run yet — LLMs on language pairs no commercial service covers. One command runs the top of it with your API key, up to a budget you set, and publishes each result to the open board. No account needed.</Translate>
          </p>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        {/* The business-card command — one paste, end to end */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.contribute.oneCommand" description="section heading">One command</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.contribute.oneCommandBody" description="section body">Paste into a terminal. It asks before doing anything, installs the harness if needed, and shows you the exact runs and cost before a token is spent.</Translate>
          </p>
          <GiveCommand />
          <p className={styles.note}>
            <Translate id="page.contribute.keyNote" description="key/trust note; {anon}/{uninstall} code spans, {script}/{guide} links" values={{
              anon: <code>anonymous</code>,
              uninstall: <code>pipx uninstall mt-eval-harness</code>,
              script: <Link href="pathname:///run_queue">champollion.dev/run_queue</Link>,
              guide: <Link href="/docs/network/getting-started/contributing-compute"><Translate id="page.contribute.guideLink" description="contributor guide link">contributor guide</Translate></Link>,
            }}>{'Your key stays on your machine — we never see it. Results publish as {anon}, or sign in once to be credited. No sudo; {uninstall} removes everything. The script is plain bash: {script} · full walkthrough in the {guide}.'}</Translate>
          </p>
        </section>

        {/* Agent fast path — front and center */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.contribute.fastPath" description="section heading">The fast path: hand it to your agent</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.contribute.fastPathBody" description="section body">Using Claude Code or another coding agent? Paste one prompt — the agent installs the harness, runs an item with your key, and publishes the report.</Translate>
          </p>
          <div className={local.promptBlock}>
            <div className={local.promptHead}>
              <span><Translate id="page.contribute.pasteAgent" description="prompt block label">Paste into Claude Code / your agent</Translate></span>
              <CopyButton text={AGENT_PROMPT} label={translate({id: 'page.contribute.copyPrompt', message: 'Copy prompt', description: 'copy button'})} />
            </div>
            <pre className={local.promptPre}>{AGENT_PROMPT}</pre>
          </div>
        </section>

        {/* Live queue preview */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.contribute.queueNow" description="section heading">The queue, right now</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.contribute.queueNowBody" description="section body">Each row is one benchmark nobody has run: a language pair, a model, and the exact command that runs it. Ranked by how much the result strengthens the whole map per dollar — the formula is public and re-derivable. Duplicates are harmless (fingerprints deduplicate; replications are data).</Translate>
          </p>
          <QueuePreview />
        </section>

        {/* The ladder */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.contribute.ladder" description="section heading">The contribution ladder</Translate>
          </Heading>
          <div className={local.tierList}>
            {tiers().map((tier, i) => (
              <div key={tier.name} className={local.tier}>
                <div className={local.tierRung}><Translate id="page.contribute.tierRung" description="tier rung; {n} is the tier number" values={{n: i + 1}}>{'Tier {n}'}</Translate></div>
                <div className={local.tierBody}>
                  <div className={local.tierName}>{tier.name}</div>
                  <div className={local.tierEffort}>
                    {tier.effort}
                    {i === 0 && (
                      <ProvenanceTip
                        source="cli/website/static/queue.json est_cost_usd distribution — extrapolated from arena/eval/logs/sweep_manifest.json (457 successful runs): naive-item estimates $0.0034–$0.51, median $0.089"
                        date="2026-06-12"
                      />
                    )}
                  </div>
                  <p className={local.tierText}>{tier.body}</p>
                  <div className={local.tierLinks}>
                    {tier.links.map((l) => (
                      <Link key={l.href} href={l.href} className={local.tierLink}>
                        {l.label} ↗
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Provider notes */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.contribute.whichKey" description="section heading">Which API key do I need?</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.contribute.whichKeyBody" description="providers body; {or} is the OpenRouter link, {flag} a code span" values={{
              or: <Link href="https://openrouter.ai/keys">OpenRouter</Link>,
              flag: <code>--provider</code>,
            }}>{'Any one of four: {or} (recommended — one key reaches every model in the lineup), OpenAI, Anthropic, or Google Gemini, via {flag} or auto-detection from your environment. Keys stay on your machine; the run cost the leaderboard reports is what your key was billed.'}</Translate>
          </p>
        </section>

        {/* Trust framing */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.contribute.counts" description="section heading">What your run counts as</Translate>
          </Heading>
          <div className={styles.principleList}>
            <div className={styles.principle}>
              <div className={styles.principleTitle}>
                <Translate id="page.contribute.trust1" description="principle title">Self-benchmarked is the trust model working</Translate>
              </div>
              <p className={styles.principleText}>
                <Translate id="page.contribute.trust1Body" description="principle body; {tier} is the bold tier name" values={{tier: <strong><Translate id="page.contribute.selfBench" description="tier name">self-benchmarked</Translate></strong>}}>{'Community submissions publish at the {tier} tier — plainly labeled as “submitted by the person who ran it.” That’s not a caveat; it’s the design. Every run card carries the dataset hash, model, condition, full system prompt, and cost, so anyone can re-run your exact configuration and check the result. Elevated tiers (verification) are granted by review, not by self-assertion.'}</Translate>
              </p>
            </div>
            <div className={styles.principle}>
              <div className={styles.principleTitle}>
                <Translate id="page.contribute.trust2" description="principle title">Attribution is the reward</Translate>
              </div>
              <p className={styles.principleText}>
                <Translate id="page.contribute.trust2Body" description="principle body">Your submitter name appears on the leaderboard row. That is the recognition on offer today — we won’t promise badges, bounties, or programs that don’t exist yet.</Translate>
              </p>
            </div>
            <div className={styles.principle}>
              <div className={styles.principleTitle}>
                <Translate id="page.contribute.trust3" description="principle title">Duplicates can’t pollute the board</Translate>
              </div>
              <p className={styles.principleText}>
                <Translate id="page.contribute.trust3Body" description="principle body">Each run card is fingerprinted (SHA-256 over dataset hash, model, condition, and system prompt). Identical re-runs deduplicate on publish; near-duplicates with different prompts are separate, comparable experiments.</Translate>
              </p>
            </div>
            <div className={styles.principle}>
              <div className={styles.principleTitle}>
                <Translate id="page.contribute.trust4" description="principle title">Eval sets, not training data</Translate>
              </div>
              <p className={styles.principleText}>
                <Translate id="page.contribute.trust4Body" description="principle body; {flag} is a code span" values={{flag: <code>do_not_train</code>}}>{'Every queued corpus is marked {flag} and carries its license (CC-BY family, Tatoeba-derived) in the run card. Non-commercially-licensed corpora are excluded from the open queue entirely.'}</Translate>
              </p>
            </div>
          </div>
          <p className={styles.note}>
            <Translate id="page.contribute.specNote" description="closing note; {rules}/{board} are links" values={{
              rules: <Link href="/docs/network/leaderboard/rules">champollion.dev</Link>,
              board: <Link to="/leaderboard"><Translate id="page.contribute.boardLink" description="leaderboard link">leaderboard</Translate></Link>,
            }}>{'Trust tiers, dataset rules, and scoring are specified on {rules}. See your result on the {board} after publishing.'}</Translate>
          </p>
        </section>
      </main>
    </Layout>
  );
}
