/**
 * communityProjects — the roster for the seam's `communities` beat (R7).
 *
 * WHY THIS EXISTS
 * The scroll's second act says the industry's coverage claims outrun their own
 * quality numbers. On its own that is a complaint. This beat is the answer to
 * it: people are ALREADY doing the work — speaker communities, computational
 * linguists, humanitarian orgs, university labs — and they have been for years.
 *
 * FOUNDER BRIEF (2026-07-25): "there must be a lot more projects than we have
 * listed … communities and comp linguists on LRL MT, even if only aspirational
 * or currently unsuccessful. This can include dictionaries, FSTs, AfriCOMET —
 * it doesn't need to just be restricted to finished and finalized and deployed
 * MT. Make sure there are links to these projects." Hence the deliberate spread
 * of `kind`: morphology and dictionaries and metrics and shared tasks count.
 *
 * ── THE RULES. Do not relax these to make the beat read better. ─────────────
 *
 * 1. EXTERNAL TRUTH ONLY. "You can mine the repo but you must reference truth
 *    externally" (founder). Our own catalogues may point at a project, but the
 *    `url` here must be the project's OWN site, repo or paper — that is the
 *    citation, and it is what the rendered name links to. Every entry needs one.
 *
 * 2. NO ENDORSEMENT, NO AFFILIATION, NO PARTNERSHIP. These are published,
 *    self-organised efforts that we cite. Nothing here may imply any of them
 *    use, endorse, or are associated with Champollion. Never place Champollion
 *    branding adjacent to a project's name.
 *
 * 3. NAME PROJECTS, NOT PRIVATE INDIVIDUALS. No researcher's name, nation, or
 *    citizenship appears on the page. Credit goes to the work. Institutional
 *    actors — a government department, a university lab — are fine to name.
 *
 * 4. UNDERCLAIM. `what` must not exceed what the cited source actually
 *    supports. If a source only supports "they built a corpus", it says corpus,
 *    not MT. See the ChoCo entry: its paper does not mention machine
 *    translation at all, so neither do we.
 *
 * 5. NO CUSTODIANSHIP CLAIMS. CLAUDE.md forbids naming a nation or organisation
 *    publicly as a key custodian before they have consented. Citing published
 *    work is not a custodianship claim; nothing here asserts one.
 *
 * Ledger rows for every entry live in cli/website/CLAIMS.md.
 *
 * @typedef {Object} CommunityProject
 * @property {string} key
 * @property {string} name      as the project styles itself
 * @property {string} what      one clause, underclaimed, in our own words
 * @property {string} kind      what sort of work it is (see KINDS)
 * @property {string} region    which cluster it lights on the map
 * @property {string} url       the project's OWN site / repo / paper
 * @property {string[]} langs   ISO 639-3 codes to bloom — guard-checked against
 *                              the language cards, so a typo can't ship a
 *                              language that doesn't exist
 */

/** The spread the founder asked for — deployed MT is only one row of it. */
export const KINDS = [
  'shared task',
  'community',
  'morphology',
  'rule-based MT',
  'corpus',
  'metric',
  'benchmark',
  'deployed (vendor)',
];

/** @type {CommunityProject[]} */
export const COMMUNITY_PROJECTS = [
  {
    key: 'americasnlp',
    name: 'AmericasNLP',
    what: 'MT shared tasks for Indigenous languages of the Americas',
    kind: 'shared task',
    region: 'Americas',
    url: 'https://turing.iimas.unam.mx/americasnlp/',
    langs: ['quy', 'aym', 'bzd', 'cni', 'hch', 'ote', 'shp', 'tar', 'gug'],
  },
  {
    key: 'masakhane',
    name: 'Masakhane',
    what: 'grassroots African NLP — MAFAND-MT, and AfriCOMET for evaluation',
    kind: 'community',
    region: 'Africa',
    url: 'https://www.masakhane.io/',
    langs: ['yor', 'hau', 'ibo', 'swh', 'zul', 'amh', 'lug', 'wol', 'nya'],
  },
  {
    key: 'giellalt',
    name: 'GiellaLT · Divvun · Giellatekno',
    what: 'open finite-state morphologies, dictionaries and MT for Sámi and other minority languages',
    kind: 'morphology',
    region: 'Arctic',
    url: 'https://github.com/giellalt',
    langs: ['sme', 'sma', 'smj', 'smn', 'sms', 'sjd', 'kpv', 'myv', 'udm', 'olo'],
  },
  {
    key: 'apertium',
    name: 'Apertium',
    what: 'long-running open rule-based MT for minoritised language pairs',
    kind: 'rule-based MT',
    region: 'Europe',
    url: 'https://www.apertium.org/',
    langs: ['cat', 'glg', 'eus', 'oci', 'cym', 'bre', 'srd', 'epo', 'kaz', 'tat'],
  },
  {
    key: 'gamayun',
    name: 'Gamayun · CLEAR Global',
    what: 'humanitarian language kits for crisis-affected communities',
    kind: 'corpus',
    region: 'Africa',
    url: 'https://huggingface.co/datasets/CLEAR-Global/Gamayun-kits',
    langs: ['hau', 'knc', 'lin', 'rhg', 'tir', 'nnb', 'swc'],
  },
  {
    key: 'ai4bharat',
    name: 'AI4Bharat',
    what: 'Indic MT models and benchmarks',
    kind: 'benchmark',
    region: 'South Asia',
    url: 'https://ai4bharat.iitm.ac.in/',
    langs: ['hin', 'ben', 'tam', 'tel', 'mar', 'guj', 'kan', 'mal', 'ory', 'asm'],
  },
  {
    key: 'nusax',
    name: 'IndoNLP · NusaX',
    what: 'parallel corpora for Indonesian local languages',
    kind: 'corpus',
    region: 'Southeast Asia',
    url: 'https://github.com/IndoNLP/nusax',
    langs: ['ace', 'ban', 'bjn', 'bug', 'jav', 'mad', 'min', 'nij', 'sun', 'bbc'],
  },
  {
    key: 'menyo20k',
    name: 'MENYO-20k',
    what: 'a multi-domain English–Yorùbá parallel corpus',
    kind: 'corpus',
    region: 'Africa',
    url: 'https://github.com/uds-lsv/menyo-20k_MT',
    langs: ['yor'],
  },
  {
    key: 'loresmt',
    name: 'LoResMT',
    what: 'a recurring shared-task series for low-resource MT',
    kind: 'shared task',
    region: 'Europe',
    url: 'https://github.com/loresmt',
    langs: ['gle', 'mlt', 'hsb', 'lij'],
  },
  {
    key: 'oldi',
    name: 'FLORES+ · Open Language Data Initiative',
    what: 'community-governed evaluation data many of these efforts share',
    kind: 'benchmark',
    region: 'Global',
    url: 'https://github.com/openlanguagedata/flores',
    langs: ['fuv', 'kea', 'lij', 'mni', 'nqo', 'taq'],
  },
  {
    key: 'opus',
    name: 'OPUS · Tatoeba',
    what: 'the community-contributed parallel corpora most of this work stands on',
    kind: 'corpus',
    region: 'Global',
    url: 'https://opus.nlpl.eu/',
    langs: ['epo', 'isl', 'kat', 'hye', 'mkd', 'cym'],
  },
  {
    key: 'edtekla',
    name: 'EdTeKLA',
    what: 'Indigenous-language corpora, including Plains Cree',
    kind: 'corpus',
    region: 'Americas',
    url: 'https://github.com/EdTeKLA/IndigenousLanguages_Corpora',
    langs: ['crk'],
  },
  {
    /* VERIFIED FROM THE PAPER ITSELF (Brixey & Traum, "ChoCo: A Multimodal
     * Corpus for the Choctaw Language", LT4All — lt4all.elra.info/media/papers/
     * P6/109.pdf). The paper does NOT mention machine translation anywhere —
     * not as done work, not as future work; its stated current/future work is
     * OCR correction, audio processing and a morphology generator. Masheli is
     * response SELECTION over bilingual stories, not translation. So this entry
     * says corpus and dialogue system, and must never be upgraded to "Choctaw
     * MT" without a source that actually supports it. (A popular-press essay
     * gives a much larger word count than the paper; we cite the paper.) */
    key: 'choco',
    name: 'ChoCo · Masheli',
    what: 'a multimodal Choctaw corpus, a bilingual dialogue system, and a morphology generator in progress',
    kind: 'corpus',
    region: 'Americas',
    url: 'https://lt4all.elra.info/media/papers/P6/109.pdf',
    langs: ['cho'],
  },
  {
    /* VERIFIED against the Government of Nunavut's own newsroom: the GN's
     * Department of Culture and Heritage leads the project, Microsoft supplies
     * the models, and the voices were trained on recorded audio from proficient
     * speakers who "donated their knowledge and expertise". Translator 2021 →
     * Inuinnaqtun + romanized 2022 → text-to-speech Dec 2024.
     * FRAMING: this is the one entry whose DEPLOYED system is closed and
     * commercial. It belongs here because coverage FOLLOWED community effort —
     * a territorial government directed the work and community speakers supplied
     * the data. Never imply the deployed system is open, and never stage it as
     * a community that built its own model. */
    key: 'inuktut',
    name: 'Government of Nunavut — Inuktut language technology',
    what: 'Inuktut translation and speech built on community-donated recordings',
    kind: 'deployed (vendor)',
    region: 'Arctic',
    url: 'https://www.gov.nu.ca/en/culture-language-heritage-and-art/language-preservation-and-promotion-through-technology-ms',
    langs: ['ike', 'ikt', 'iku'],
  },
];

/** Regions in the order the camera drifts across them during the beat. */
export const PROJECT_REGIONS = ['Americas', 'Arctic', 'Africa', 'Europe', 'South Asia', 'Southeast Asia', 'Global'];

/** Every ISO 639-3 code the beat wants to light, de-duplicated. */
export const PROJECT_LANGS = [...new Set(COMMUNITY_PROJECTS.flatMap((p) => p.langs))];
