// @ts-check

/**
 * The docs sidebar, organised BY TOOL.
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
  docsSidebar: [
    // ── Start here ───────────────────────────────────────────────
    'what-is-champollion',
    // The anti-overclaim ledger sits at the top on purpose: what we do NOT
    // claim, read before anything else.
    'network/honest-limitations',
    'network/who-benefits',

    // ── Champollion CLI — translate ──────────────────────────────
    {
      type: 'category',
      label: 'Champollion CLI — translate',
      collapsed: false,
      link: {type: 'doc', id: 'intro'},
      items: [
        'getting-started/quick-start',
        'getting-started/installation',
        'getting-started/configuration',
        'how-it-works',
        'guides/translation-methods',
        'guides/troubleshooting',
        {
          type: 'category',
          label: 'Walkthroughs',
          items: [
            'tutorials/hugo-multilingual-site',
            'tutorials/translate-30-languages',
            'tutorials/build-a-plugin',
            'guides/serving-a-method',
            'guides/content-translation',
            'guides/conlangs-scripts-orthography',
            'guides/professional-translators',
            'guides/enterprise',
          ],
        },
        {
          type: 'category',
          label: 'Integrations',
          items: [
            'guides/framework-integration',
            'integrations/frameworks',
            'guides/bridge',
            'guides/ci-cd',
          ],
        },
        {
          type: 'category',
          label: 'How it works inside',
          items: [
            'concepts/architecture',
            'concepts/how-sync-works',
            'concepts/translation-memory',
            'concepts/coaching-data',
            'concepts/quality-gate',
            'concepts/script-converters',
            'concepts/content-resilience',
            'concepts/context-rollover',
            'concepts/security',
            'concepts/research-papers-feed',
          ],
        },
        {
          type: 'category',
          label: 'Reference',
          items: [
            'reference/cli',
            'reference/plugin-spec',
            'reference/supported-languages',
            'guides/comparison',
          ],
        },
      ],
    },

    // ── MT-Eval Harness — measure ────────────────────────────────
    // The Python engine. Every number on this site comes out of it.
    {
      type: 'category',
      label: 'MT-Eval Harness — measure',
      link: {type: 'doc', id: 'network/specifications/harness'},
      items: [
        'network/specifications/methods',
        'network/specifications/run-card',
        'network/specifications/scoring',
        'network/specifications/significance',
        'network/specifications/metric-reliability',
        'network/context/microeval-methodology',
      ],
    },

    // ── The Arena — submit & compete ─────────────────────────────
    // The INFRASTRUCTURE: submission door, database, contests, prizes.
    // Distinct from "the Network", which is the map that emerges from it.
    {
      type: 'category',
      label: 'The Arena — submit & compete',
      link: {type: 'doc', id: 'arena'},
      items: [
        'network/getting-started/submit-a-method',
        'network/getting-started/submit-to-the-index',
        'network/getting-started/deploy-to-production',
        'network/getting-started/contributing-compute',
        'network/leaderboard/rules',
        'network/leaderboard/datasets',
        'network/specifications/prize-spec',
        'network/specifications/benchmark-spec',
        'network/specifications/speaker-validation',
        'network/getting-started/faq',
      ],
    },

    // ── The Network — the measured map ───────────────────────────
    // The abstraction of linkages from the evals we run and collect: the sum
    // total of our measurements, and the thing routing traverses.
    {
      type: 'category',
      label: 'The Network — the map',
      link: {type: 'doc', id: 'network/intro'},
      items: [
        'network/how-it-works',
        'network/perspectives/why-the-queue',
        'network/specifications/connection-strength',
        'network/specifications/queue-construction',
        'network/context/coverage-gap-estimate',
        'network/context/coverage-counting',
      ],
    },

    // ── The Atlas — the languages ────────────────────────────────
    {
      type: 'category',
      label: 'The Atlas — languages',
      link: {type: 'doc', id: 'atlas'},
      items: [
        'reference/language-card-spec',
        'reference/language-card-citation-procedure',
        'network/context/what-counts-as-a-language',
        'network/community/low-resource-languages',
      ],
    },

    // ── NMT Forge — train ────────────────────────────────────────
    {
      type: 'category',
      label: 'NMT Forge — train honestly',
      link: {type: 'doc', id: 'network/getting-started/training-honestly'},
      items: [
        'network/context/mt-training-concepts',
        'network/getting-started/train-your-first-model',
        'network/tutorials/train-your-own-model',
        'network/getting-started/diagnosing-training',
        'network/getting-started/forge-command-reference',
      ],
    },

    // ── Sovereignty & data stewardship ───────────────────────────
    // Cross-cutting: applies to every tool above.
    {
      type: 'category',
      label: 'Sovereignty & Data Stewardship',
      link: {type: 'doc', id: 'network/sovereignty/data-sovereignty'},
      items: [
        // The corpus-building journey leads (eval-first wedge: partnership →
        // design → registration), then the sovereignty machinery around it.
        'network/specifications/corpus-partnership',
        'network/specifications/corpus-design',
        'network/sovereignty/registering-corpora',
        'network/sovereignty/run-a-sovereign-contest',
        'network/sovereignty/sovereign-eval-node',
        'network/sovereignty/derived-artifacts',
        'network/sovereignty/ownership-transfer',
        'network/sovereignty/terms-templates',
        'network/sovereignty/economic-model',
      ],
    },

    // ── For language communities ─────────────────────────────────
    {
      type: 'category',
      label: 'For Language Communities',
      link: {type: 'doc', id: 'network/community/for-language-communities'},
      items: [
        'network/community/contact-objections-takedown',
        'network/perspectives/how-speakers-get-paid',
        'network/perspectives/translation-is-not-revitalization',
        'network/perspectives/from-benchmark-to-daily-use',
        'network/perspectives/reporting-errors-and-owning-corrections',
      ],
    },

    // ── Method cookbook ──────────────────────────────────────────
    // One recipe per translation approach. These are the "how would I actually
    // build a method for this pair" pages.
    {
      type: 'category',
      label: 'Method Cookbook',
      link: {
        type: 'generated-index',
        title: 'Method Cookbook',
        description:
          'Eleven working recipes for building a translation method — from '
          + 'coached prompting to FST-gated pipelines. Each recipe runs on '
          + 'the same harness and publishes to the same board.',
      },
      items: [
        'network/tutorials/coached-llm-prompting',
        'network/tutorials/few-shot-prompting',
        'network/tutorials/dictionary-augmented-llm',
        'network/tutorials/fst-gated-pipeline',
        'network/tutorials/rule-based-hybrid',
        'network/tutorials/fine-tuned-model',
        'network/tutorials/chained-models',
        'network/tutorials/back-translation',
        'network/tutorials/partial-translation',
        'network/tutorials/evolutionary-approach',
        'network/tutorials/corpus-creation',
      ],
    },

    // ── For AI agents ────────────────────────────────────────────
    // Agents were previously step 4 of *human* onboarding. They get their own
    // section: machine entry points are /llms.txt and /llms-full.txt.
    {
      type: 'category',
      label: 'For AI Agents',
      link: {type: 'doc', id: 'network/getting-started/mcp-server'},
      items: [
        'network/getting-started/agent-guide',
        'guides/agent-guide',
      ],
    },

    // ── Learn — primers for readers starting from zero ───────────
    // Derived OUTWARD from references/, which reads inward. The derived
    // public copy is canonical once it exists (CLAUDE.md §The Doc-Set Rule).
    {
      type: 'category',
      label: 'Learn — start from zero',
      items: [
        'learn/tokenizers',
        'learn/data-sovereignty',
      ],
    },

    // ── Background — the reading room ────────────────────────────
    // Long-form context. Deliberately last: valuable, but not on anyone's
    // task path.
    {
      type: 'category',
      label: 'Background — the reading room',
      items: [
        'network/context/mt-field-briefing',
        'network/context/history-of-language-and-computation',
        'network/context/mt-evaluation-landscape',
        'the-name',
        'how-this-site-is-translated',
      ],
    },
  ],
};

export default sidebars;
