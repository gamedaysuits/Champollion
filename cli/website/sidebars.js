// @ts-check

/**
 * The docs sidebar, organised BY JOURNEY STOP (2026-10 rails rewrite): start
 * here → gather & protect your data → measure → build → prove → deploy →
 * connect → sovereignty → background. Before that it was organised by tool
 * (history below); the tool names stay in each label.
 *
 * Until 2026-07-31 this file mirrored the history of the codebase rather than
 * the shape of the project: everything the merged Arena site brought over
 * (2026-06-20) sat under one collapsed "The Network" twisty that hid 65 of 104
 * pages — every specification, every tutorial, and the whole sovereignty
 * argument. A first-time visitor could reach exactly two doc pages from the
 * homepage, and neither of them said what Champollion is.
 *
 * The rules now:
 *   1. `what-is-champollion` is the front door. It is first, always.
 *   2. Each tool gets a top-level section with the same shape:
 *      what it is → how to use it → reference/specs.
 *   3. Nothing is nested more than two deep.
 *   4. Cross-cutting concerns (sovereignty, communities, background) are their
 *      own sections, not buried inside a tool.
 *
 * NOTE: `sidebar_position:` frontmatter is NOT consulted — this sidebar is
 * fully explicit. 98 doc files still carry inert `sidebar_position` values
 * (fourteen of them all claiming position 3). Ignore them; edit this file.
 */

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // ── For people (2026-10-12 docs redraft) ───────────────────────────
  // A story in the order a newcomer asks: what is this → how does it work →
  // what stops the common mistakes → what can't it do yet. Written for two
  // speakers with no technical background; every page ends with "Go deeper"
  // links into the agents' manual and the reference.
  peopleSidebar: [
    'index',
    {
      type: 'category',
      label: 'The idea',
      collapsible: false,
      items: ['what-is-champollion', 'how-it-works', 'guardrails', 'what-it-cant-do-yet'],
    },
    {
      type: 'category',
      label: 'Building one',
      collapsible: false,
      items: [
        'before-you-begin',
        'start',
        'bring-your-data',
        'your-test-sentences',
        'your-first-translator',
        'reading-the-numbers',
        'make-it-better',
        'how-many-sentences',
        'put-it-to-work',
      ],
    },
    {
      type: 'category',
      label: 'Doing it right',
      collapsible: false,
      items: ['your-words-your-rules', 'working-with-speakers', 'getting-started/who-may-use-this'],
    },
    {
      type: 'category',
      label: 'Other things you can do',
      collapsible: false,
      items: ['getting-help', 'join-a-project', 'translate-an-app-or-website', 'host-a-sealed-test'],
    },
    {
      type: 'category',
      label: 'Background',
      collapsed: true,
      items: [
        'network/context/mt-training-concepts',
        'learn/tokenizers',
        'learn/data-sovereignty',
        'network/perspectives/translation-is-not-revitalization',
        'the-name',
        'how-this-site-is-translated',
      ],
    },
  ],

  // ── For AI agents ──────────────────────────────────────────────────
  // The technical operating manual: exact field names, modes and refusals.
  agentsSidebar: [
    'agents/index',
    'agents/contract',
    'agents/rails-model',
    'agents/mcp',
    'agents/shell',
    'agents/data-rules',
    'agents/measurement',
    'agents/training',
    'agents/methods',
    'agents/serving',
    'agents/hosting-and-joining',
    'agents/coaching',
  ],

  // ── Reference ───────────────────────────────────────────────────────
  // Complete and technical; both tracks link in. Pages that moved here as
  // they were keep their URLs (docs/DOCS_REDRAFT_2026-10-12.md, "Final
  // routes") — the sidebar does the organizing.
  referenceSidebar: [
    'reference/index',
    {
      type: 'category',
      label: 'Commands',
      items: [
        'reference/cli',
        'reference/mt-eval',
        'network/getting-started/forge-command-reference',
        'network/getting-started/mcp-server',
      ],
    },
    {
      type: 'category',
      label: 'Formats',
      items: [
        'reference/formats',
        'network/specifications/run-card',
        'concepts/coaching-data',
        'reference/plugin-spec',
      ],
    },
    {
      type: 'category',
      label: 'Specifications',
      items: [
        'network/specifications/scoring',
        'network/specifications/significance',
        'network/specifications/methods',
        'network/specifications/metric-reliability',
        'network/specifications/benchmark-spec',
        'network/specifications/harness',
        'network/specifications/speaker-validation',
        'network/specifications/corpus-design',
        'network/honest-limitations',
      ],
    },
    {
      type: 'category',
      label: 'Hosting a sealed test',
      items: [
        'network/sovereignty/run-a-sovereign-contest',
        'network/sovereignty/sovereign-eval-node',
        'network/sovereignty/registering-corpora',
        'network/specifications/prize-spec',
        'network/sovereignty/ownership-transfer',
        'network/sovereignty/terms-templates',
      ],
    },
    {
      type: 'category',
      label: 'Leaderboard and publishing',
      items: [
        'reference/leaderboard',
        'network/leaderboard/rules',
        'network/leaderboard/datasets',
        'network/getting-started/submit-a-method',
        'network/getting-started/faq',
      ],
    },
    {
      type: 'category',
      label: 'App and site translation',
      items: [
        'intro',
        'getting-started/quick-start',
        'getting-started/installation',
        'getting-started/configuration',
        'integrations/frameworks',
        'guides/ci-cd',
        'guides/translation-methods',
        'concepts/how-sync-works',
        'concepts/translation-memory',
        'concepts/quality-gate',
        'concepts/security',
        'guides/content-translation',
        'guides/professional-translators',
        'concepts/script-converters',
        'guides/conlangs-scripts-orthography',
        'guides/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'The Atlas',
      items: [
        'atlas',
        'reference/language-card-spec',
        'reference/language-card-citation-procedure',
        'network/context/what-counts-as-a-language',
        'network/getting-started/submit-to-the-index',
        'network/perspectives/reporting-errors-and-owning-corrections',
      ],
    },
    {
      type: 'category',
      label: 'Network infrastructure',
      items: [
        'network/specifications/queue-construction',
        'network/perspectives/why-the-queue',
        'network/specifications/connection-strength',
        'network/getting-started/contributing-compute',
      ],
    },
  ],
};

export default sidebars;
