// retrieval_test.ts — deno test suite for the docent's lexical retrieval + FAQ
// matching.  deno test retrieval_test.ts

import {
  buildIndex,
  type Chunk,
  faqMatch,
  type FaqEntry,
  renderContext,
  search,
  tokenize,
} from "./retrieval.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals(a: unknown, b: unknown, msg = ""): void {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}\n  actual:   ${JSON.stringify(a)}\n  expected: ${JSON.stringify(b)}`);
  }
}

const CHUNKS: Chunk[] = [
  {
    id: "a::0",
    docTitle: "Getting Started",
    sectionTitle: "Install the CLI",
    url: "https://champollion.dev/docs/getting-started#install",
    text: "Install the Champollion translation CLI with npm install champollion. It is a Node.js command line tool.",
  },
  {
    id: "b::0",
    docTitle: "The Network",
    sectionTitle: "Submit a run",
    url: "https://champollion.dev/docs/network/getting-started/submit-a-method#run",
    text: "You can submit a benchmark run to the leaderboard. The Network evaluates machine translation methods across many languages.",
  },
  {
    id: "c::0",
    docTitle: "Data Sovereignty",
    sectionTitle: "Sovereignty-aspirant",
    url: "https://champollion.dev/docs/network/sovereignty/data-sovereignty",
    text: "The project is sovereignty-aspirant: designed with Indigenous data-sovereignty principles in mind — community ownership and control of language data. Communities decide whether it achieves sovereignty.",
  },
];

Deno.test("tokenize: lowercases, drops stopwords + 1-char, keeps numbers", () => {
  const t = tokenize("Install the CLI v2 for 436 languages");
  assert(t.includes("install"), "keeps content word");
  assert(t.includes("cli"), "keeps CLI");
  assert(t.includes("436"), "keeps numbers");
  assert(!t.includes("the"), "drops stopword");
  assert(!t.includes("for"), "drops stopword");
});

Deno.test("search: finds the install chunk for an install query", () => {
  const idx = buildIndex(CHUNKS);
  const hits = search(idx, "how do I install the cli with npm", 3);
  assert(hits.length > 0, "some hit");
  assertEquals(hits[0].id, "a::0", "install chunk ranks first");
});

Deno.test("search: finds the sovereignty chunk for a sovereignty query", () => {
  const idx = buildIndex(CHUNKS);
  const hits = search(idx, "what does sovereignty aspirant mean for my community", 3);
  assertEquals(hits[0].id, "c::0", "sovereignty chunk ranks first");
});

Deno.test("search: no query terms -> no hits (never fabricate context)", () => {
  const idx = buildIndex(CHUNKS);
  assertEquals(search(idx, "the a an of to", 3), []);
  assertEquals(search(idx, "", 3), []);
});

Deno.test("search: deterministic ordering", () => {
  const idx = buildIndex(CHUNKS);
  const a = search(idx, "translation languages network run", 5);
  const b = search(idx, "translation languages network run", 5);
  assertEquals(a.map((c) => c.id), b.map((c) => c.id), "stable across calls");
});

Deno.test("renderContext: includes source URLs, or an honest empty note", () => {
  const idx = buildIndex(CHUNKS);
  const rendered = renderContext(search(idx, "submit a run to the leaderboard", 2));
  assert(rendered.includes("SOURCE: https://champollion.dev"), "carries a source url");
  assertEquals(
    renderContext([]),
    "(no matching documentation found)",
    "empty context is explicit",
  );
});

// ---- FAQ matching ------------------------------------------------------------

const FAQ: FaqEntry[] = [
  {
    id: "faq-install",
    question: "How do I install the Champollion CLI?",
    answer: "Run npm install champollion. See Getting Started.",
    sources: ["/docs/getting-started"],
    keywords: ["install", "cli", "npm"],
  },
  {
    id: "faq-sovereignty",
    question: "What does sovereignty-aspirant mean?",
    answer: "It means the design is built with Indigenous data-sovereignty principles in mind; communities decide.",
    sources: ["/docs/network/sovereignty/data-sovereignty"],
    keywords: ["aspirant", "sovereignty"],
  },
];

Deno.test("faqMatch: strong match returns the canned answer", () => {
  const m = faqMatch("how do I install the champollion cli", FAQ);
  assert(m, "should match");
  assertEquals(m!.entry.id, "faq-install");
});

Deno.test("faqMatch: weak / unrelated match returns null (fall through to model)", () => {
  assertEquals(faqMatch("what is the weather today", FAQ), null, "unrelated");
  // a vaguely related but not close question should NOT short-circuit
  assertEquals(
    faqMatch("tell me about your history and mission", FAQ),
    null,
    "not close enough to any FAQ",
  );
});
