import React, {useState, useCallback} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';
import styles from './DonateCard.module.css';

/**
 * DonateCard — "Run the queue" CTA card.
 *
 * Placed immediately after ZipperSeam on the landing page. Lets visitors
 * copy a single curl command to run a benchmark contribution. The budget
 * slider and advanced configurator update the command live so the user
 * sees exactly what they'll paste into their terminal.
 *
 * State:
 *   budget     — 1..10 (slider), controls --budget flag
 *   provider   — 'openai' | 'anthropic' | 'google' (advanced)
 *   model      — free-text model slug (advanced)
 *   apiKey     — masked password field (advanced)
 *   pair       — '' (let network decide) or 'eng-xxx' (advanced)
 *   isAdvOpen  — toggles advanced configurator visibility
 *   hasCopied  — brief true flash for copy-confirmation UX
 */

// ====================================================================
// HELPERS
// ====================================================================

/**
 * Builds the full curl command string from the current configurator state.
 * Only appends flags that differ from their defaults so the basic command
 * stays clean (just --budget).
 */
function buildCommand({budget, provider, model, apiKey, pair}) {
  const parts = [
    'curl -fsSL https://champollion.dev/run_queue | bash -s --',
    `--budget ${budget}`,
  ];

  // Only append advanced flags when they have non-default values.
  // This keeps the basic view's command short and approachable.
  if (provider && provider !== 'openai') {
    parts.push(`--provider ${provider}`);
  }
  if (model) {
    parts.push(`--model ${model}`);
  }
  if (apiKey) {
    parts.push(`--key ${apiKey}`);
  }
  if (pair) {
    parts.push(`--pair ${pair}`);
  }

  return parts.join(' \\\n  ');
}

/**
 * Computes the slider fill percentage for the CSS gradient trick.
 * Budget range is 1–10, so we map to 0%–100%.
 */
function sliderPercent(budget) {
  return `${((budget - 1) / 9) * 100}%`;
}

// ====================================================================
// SUB-COMPONENTS (inlined — too small and tightly coupled to extract)
// ====================================================================

/** Clipboard icon (idle state) — 14×14 SVG */
function ClipboardIcon() {
  return (
    <svg
      className={styles.copyIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Clipboard body */}
      <rect x="4" y="4" width="10" height="11" rx="1.5" />
      {/* Behind-page peek */}
      <path d="M2 12V2.5A1.5 1.5 0 013.5 1H10" />
    </svg>
  );
}

/** Check icon (copied state) — same 14×14 bounding box */
function CheckIcon() {
  return (
    <svg
      className={styles.copyIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5L6.5 12L13 4" />
    </svg>
  );
}

/** Chevron-down icon for the advanced toggle */
function ChevronDown({isOpen}) {
  return (
    <svg
      className={clsx(styles.toggleChevron, isOpen && styles.toggleChevronOpen)}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

// ====================================================================
// MAIN COMPONENT
// ====================================================================

export default function DonateCard() {
  // --- Basic state ---
  const [budget, setBudget] = useState(2);
  const [hasCopied, setHasCopied] = useState(false);

  // --- Advanced configurator state ---
  const [isAdvOpen, setIsAdvOpen] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [pair, setPair] = useState('');

  // Build the command from current state
  const command = buildCommand({budget, provider, model, apiKey, pair});

  // The raw command without line-continuation chars, for clipboard
  const commandFlat = command.replace(/\s*\\\n\s*/g, ' ');

  // --- Handlers ---

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(commandFlat);
      setHasCopied(true);
      // Reset the "Copied!" flash after 2 seconds
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Fallback: some browsers block clipboard in non-HTTPS contexts.
      // We fail silently — the user can still manually select + copy.
    }
  }, [commandFlat]);

  const handleBudgetChange = useCallback((e) => {
    setBudget(Number(e.target.value));
  }, []);

  const handleProviderChange = useCallback((e) => {
    setProvider(e.target.value);
  }, []);

  const handleModelChange = useCallback((e) => {
    setModel(e.target.value);
  }, []);

  const handleKeyChange = useCallback((e) => {
    setApiKey(e.target.value);
  }, []);

  const handlePairChange = useCallback((e) => {
    setPair(e.target.value);
  }, []);

  const toggleAdvanced = useCallback(() => {
    setIsAdvOpen((prev) => !prev);
  }, []);

  // --- Render ---

  return (
    <section
      className={clsx('labV4', styles.donateCard)}
      aria-label={translate({
        id: 'donate.section.aria',
        message: 'Run the public eval queue with your API credits to push the translation map forward',
      })}
    >
      <div className={styles.inner}>

        {/* ---- Headline + sub-copy ---- */}
        <h2 className={styles.headline}>
          <Translate id="donate.headline">
            Run the queue
          </Translate>
        </h2>
        <p className={styles.subCopy}>
          <Translate id="donate.subCopy">
            Have API credits? Run a benchmark. Push the map forward.
          </Translate>
        </p>

        {/* ---- Code block (curl command) ---- */}
        <div className={styles.codeBlock}>
          <button
            type="button"
            className={clsx(styles.copyBtn, hasCopied && styles.copied)}
            onClick={handleCopy}
            aria-label={
              hasCopied
                ? translate({id: 'donate.copied', message: 'Copied to clipboard'})
                : translate({id: 'donate.copy', message: 'Copy command to clipboard'})
            }
          >
            {hasCopied ? <CheckIcon /> : <ClipboardIcon />}
            {hasCopied
              ? <Translate id="donate.copiedLabel">Copied!</Translate>
              : <Translate id="donate.copyLabel">Copy</Translate>
            }
          </button>

          <code className={styles.codeText}>
            <span className={styles.codePrompt} aria-hidden="true">$</span>
            {renderCommandHighlighted({budget, provider, model, apiKey, pair})}
          </code>
        </div>

        {/* ---- Budget slider ---- */}
        <div className={styles.sliderRow}>
          <label htmlFor="donate-budget" className={styles.sliderLabel}>
            <Translate id="donate.budgetLabel">Budget</Translate>
          </label>
          <input
            id="donate-budget"
            type="range"
            min={1}
            max={10}
            step={1}
            value={budget}
            onChange={handleBudgetChange}
            className={styles.slider}
            style={{'--slider-pct': sliderPercent(budget)}}
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={budget}
            aria-label={translate({
              id: 'donate.budget.aria',
              message: 'Budget in dollars',
            })}
          />
          <span className={styles.sliderValue} aria-hidden="true">
            ${budget}
          </span>
        </div>

        {/* ---- Advanced options toggle ---- */}
        <button
          type="button"
          className={styles.advancedToggle}
          onClick={toggleAdvanced}
          aria-expanded={isAdvOpen}
          aria-controls="donate-advanced-panel"
        >
          <Translate id="donate.advancedToggle">Advanced options</Translate>
          <ChevronDown isOpen={isAdvOpen} />
        </button>

        {/* ---- Advanced configurator panel ---- */}
        <div
          id="donate-advanced-panel"
          className={clsx(
            styles.advancedPanel,
            isAdvOpen && styles.advancedPanelOpen,
          )}
          /* aria-hidden so screen readers skip collapsed content */
          aria-hidden={!isAdvOpen}
        >
          <div className={styles.advancedInner}>

            {/* Provider selector */}
            <div className={styles.fieldGroup}>
              <label htmlFor="donate-provider" className={styles.fieldLabel}>
                <Translate id="donate.provider.label">Provider</Translate>
              </label>
              <select
                id="donate-provider"
                className={styles.fieldSelect}
                value={provider}
                onChange={handleProviderChange}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
            </div>

            {/* Model slug */}
            <div className={styles.fieldGroup}>
              <label htmlFor="donate-model" className={styles.fieldLabel}>
                <Translate id="donate.model.label">Model</Translate>
              </label>
              <input
                id="donate-model"
                type="text"
                className={styles.fieldInput}
                value={model}
                onChange={handleModelChange}
                placeholder="my-org/my-model-v2"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {/* API key (masked) */}
            <div className={styles.fieldGroup}>
              <label htmlFor="donate-key" className={styles.fieldLabel}>
                <Translate id="donate.key.label">API Key</Translate>
              </label>
              <input
                id="donate-key"
                type="password"
                className={styles.fieldInput}
                value={apiKey}
                onChange={handleKeyChange}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>

            {/* Target pair — either let the network decide or specify */}
            <div className={styles.fieldGroup}>
              <label htmlFor="donate-pair" className={styles.fieldLabel}>
                <Translate id="donate.pair.label">Target pair</Translate>
              </label>
              <input
                id="donate-pair"
                type="text"
                className={styles.fieldInput}
                value={pair}
                onChange={handlePairChange}
                placeholder={translate({
                  id: 'donate.pair.placeholder',
                  message: 'eng-pam (or leave empty)',
                })}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          </div>
        </div>

        {/* ---- Learn more link ---- */}
        <Link to="/contribute" className={styles.moreLink}>
          <Translate id="donate.moreLink">
            Learn more about contributing
          </Translate>
          <span className={styles.moreLinkArrow} aria-hidden="true">→</span>
        </Link>

      </div>
    </section>
  );
}

// ====================================================================
// SYNTAX-HIGHLIGHTED COMMAND RENDERER
// ====================================================================

/**
 * Renders the curl command with syntax highlighting.
 * Flags (--budget, --provider, etc.) get the electric accent color,
 * and their values get the amber accent. This makes the command
 * scannable at a glance — you can immediately see what each flag does.
 *
 * Returns an array of React elements (spans) with appropriate classes.
 */
function renderCommandHighlighted({budget, provider, model, apiKey, pair}) {
  const parts = [];

  // Base command — plain white
  parts.push('curl -fsSL https://champollion.dev/run_queue | bash -s --');

  // Budget — always shown
  parts.push(' \\\n  ');
  parts.push(<span key="bf" className={styles.codeFlag}>--budget</span>);
  parts.push(' ');
  parts.push(<span key="bv" className={styles.codeValue}>{budget}</span>);

  // Conditional advanced flags
  if (provider && provider !== 'openai') {
    parts.push(' \\\n  ');
    parts.push(<span key="pf" className={styles.codeFlag}>--provider</span>);
    parts.push(' ');
    parts.push(<span key="pv" className={styles.codeValue}>{provider}</span>);
  }

  if (model) {
    parts.push(' \\\n  ');
    parts.push(<span key="mf" className={styles.codeFlag}>--model</span>);
    parts.push(' ');
    parts.push(<span key="mv" className={styles.codeValue}>{model}</span>);
  }

  if (apiKey) {
    parts.push(' \\\n  ');
    parts.push(<span key="kf" className={styles.codeFlag}>--key</span>);
    parts.push(' ');
    parts.push(<span key="kv" className={styles.codeValue}>{apiKey}</span>);
  }

  if (pair) {
    parts.push(' \\\n  ');
    parts.push(<span key="tf" className={styles.codeFlag}>--pair</span>);
    parts.push(' ');
    parts.push(<span key="tv" className={styles.codeValue}>{pair}</span>);
  }

  return parts;
}
