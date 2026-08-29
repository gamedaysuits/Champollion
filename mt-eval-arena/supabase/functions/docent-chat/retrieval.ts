// docent-chat/retrieval.ts — pure, dependency-free lexical retrieval + FAQ
// matching over the bundled corpus. No I/O, no model calls: unit-tested by
// retrieval_test.ts (deno test retrieval_test.ts).
//
// Retrieval is deliberately lexical (BM25) for v1 — no embeddings, no vendor,
// deterministic and offline-testable. If the eval shows recall gaps, an
// embedding stage can be added later without changing the function's contract.

export interface Chunk {
  id: string;
  docTitle: string;
  sectionTitle: string;
  url: string;
  text: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  keywords: string[];
}

export interface ScoredChunk extends Chunk {
  score: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "is",
  "are", "was", "were", "be", "been", "it", "this", "that", "these", "those",
  "with", "as", "at", "by", "from", "how", "what", "why", "when", "where",
  "who", "do", "does", "did", "can", "i", "you", "we", "they", "my", "your",
  "me", "us", "if", "so", "not", "no", "yes", "please", "about", "into",
]);

/** Lowercase, split on non-alphanumeric (Unicode-aware), drop stopwords and
 * 1-char tokens. Numbers are kept (versions, "436"). */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])) {
    if (raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    out.push(raw);
  }
  return out;
}

export interface Bm25Index {
  chunks: Chunk[];
  tokens: string[][]; // per-chunk token list
  df: Map<string, number>; // document frequency per term
  docLen: number[]; // token count per chunk
  avgdl: number;
  n: number;
}

/** Build the BM25 index once (cold start) over the corpus chunks. */
export function buildIndex(chunks: Chunk[]): Bm25Index {
  const tokens: string[][] = [];
  const df = new Map<string, number>();
  const docLen: number[] = [];
  for (const c of chunks) {
    // Index the section title with a little extra weight by prepending it once.
    const toks = tokenize(`${c.sectionTitle} ${c.docTitle} ${c.text}`);
    tokens.push(toks);
    docLen.push(toks.length);
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const total = docLen.reduce((a, b) => a + b, 0);
  return {
    chunks,
    tokens,
    df,
    docLen,
    avgdl: chunks.length ? total / chunks.length : 0,
    n: chunks.length,
  };
}

const K1 = 1.5;
const B = 0.75;

/** BM25 top-k over the index for a query. Deterministic; ties broken by id. */
export function search(index: Bm25Index, query: string, k = 6): ScoredChunk[] {
  const qToks = tokenize(query);
  if (qToks.length === 0 || index.n === 0) return [];
  const qSet = new Set(qToks);
  const scored: ScoredChunk[] = [];
  for (let i = 0; i < index.n; i++) {
    const toks = index.tokens[i];
    if (toks.length === 0) continue;
    // term frequencies in this chunk (only for query terms)
    const tf = new Map<string, number>();
    for (const t of toks) if (qSet.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1);
    if (tf.size === 0) continue;
    let s = 0;
    for (const [t, f] of tf) {
      const dfT = index.df.get(t) ?? 0;
      // BM25 idf with the standard +0.5 smoothing (floored at 0)
      const idf = Math.log(1 + (index.n - dfT + 0.5) / (dfT + 0.5));
      const denom = f + K1 * (1 - B + B * (index.docLen[i] / (index.avgdl || 1)));
      s += idf * ((f * (K1 + 1)) / denom);
    }
    if (s > 0) scored.push({ ...index.chunks[i], score: s });
  }
  scored.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : 1));
  return scored.slice(0, k);
}

// ---- FAQ short-circuit -------------------------------------------------------

/** Jaccard overlap of two token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface FaqMatch {
  entry: FaqEntry;
  score: number;
}

/** Conservative FAQ match: returns a canned answer ONLY on a strong match, so
 * a misfire can't serve the wrong answer. Score combines question-token
 * Jaccard with keyword coverage; both must clear a floor. Returns null to fall
 * through to retrieval + the model. */
export function faqMatch(
  query: string,
  faq: FaqEntry[],
  threshold = 0.55,
): FaqMatch | null {
  const qToks = new Set(tokenize(query));
  if (qToks.size === 0) return null;
  let best: FaqMatch | null = null;
  for (const entry of faq) {
    const qSet = new Set(tokenize(entry.question));
    const jac = jaccard(qToks, qSet);
    const kw = (entry.keywords ?? []).map((k) => k.toLowerCase());
    const kwHits = kw.filter((k) => {
      const kt = tokenize(k);
      return kt.length > 0 && kt.every((t) => qToks.has(t));
    }).length;
    const kwCoverage = kw.length ? kwHits / kw.length : 0;
    // weighted blend; question similarity dominates
    const score = 0.7 * jac + 0.3 * kwCoverage;
    if (score > (best?.score ?? 0)) best = { entry, score };
  }
  if (best && best.score >= threshold) return best;
  return null;
}

/** Render retrieved chunks into the prompt's RETRIEVED CONTEXT block. Each item
 * carries its source URL so the model can (and is told to) cite it. */
export function renderContext(chunks: ScoredChunk[]): string {
  if (chunks.length === 0) {
    return "(no matching documentation found)";
  }
  return chunks
    .map((c, i) =>
      `[${i + 1}] ${c.docTitle} — ${c.sectionTitle}\nSOURCE: ${c.url}\n${c.text}`
    )
    .join("\n\n");
}
