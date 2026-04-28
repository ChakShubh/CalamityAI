/** Minimal news row shape for retrieval + RAG prompts (matches LLMItem fields used here). */
export interface RagCorpusItem {
  id: number;
  city: string;
  country?: string;
  title: string;
  text: string;
  summary: string;
  category: string;
  severity: string;
  source: string;
}

function tokenize(s: string): string[] {
  const m = s.toLowerCase().match(/\b[\w'-]{2,}\b/g);
  return m || [];
}

/** Lexical overlap score for lightweight client-side “embedding-free” retrieval. */
export function scoreNewsRelevance(query: string, item: RagCorpusItem): number {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;
  const doc = `${item.title} ${item.summary} ${item.text} ${item.city} ${item.country || ''} ${item.source} ${item.category}`;
  const docTokens = tokenize(doc);
  const freq = new Map<string, number>();
  for (const t of docTokens) freq.set(t, (freq.get(t) || 0) + 1);
  let score = 0;
  for (const t of q) {
    const c = freq.get(t);
    if (c) score += 1 + Math.log(1 + c) * 0.25;
  }
  return score;
}

/** Below this lexical score we treat the in-app corpus as not containing a useful answer. */
export const RAG_CORPUS_WEAK_THRESHOLD = 1.35;

export function retrieveNewsForRagScored(
  query: string,
  corpus: RagCorpusItem[],
  topK = 10
): { chunks: RagCorpusItem[]; maxScore: number } {
  const scored = corpus
    .map((item) => ({ item, s: scoreNewsRelevance(query, item) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (scored.length === 0) {
    return { chunks: [], maxScore: 0 };
  }

  const maxScore = scored[0].s;
  const out: RagCorpusItem[] = [];
  const seen = new Set<number>();
  for (const { item } of scored) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= topK) break;
  }
  return { chunks: out, maxScore };
}

/** Returns only matched chunks (may be empty). Prefer `retrieveNewsForRagScored` when deciding web fallback. */
export function retrieveNewsForRag(query: string, corpus: RagCorpusItem[], topK = 10): RagCorpusItem[] {
  return retrieveNewsForRagScored(query, corpus, topK).chunks;
}

export function buildLocalRagAnswer(query: string, chunks: RagCorpusItem[]): string {
  if (chunks.length === 0) {
    return 'No articles were available to retrieve. Expand the feed filters or try again later.';
  }
  const lines = chunks.map(
    (c, i) =>
      `[${i + 1}] ${c.city}${c.country ? ` (${c.country})` : ''} · ${c.title}\n    ${c.source} · ${c.severity} · ${c.summary}`
  );
  return (
    `**Retrieval (RAG-style, no live model)** — question: “${query.slice(0, 200)}${query.length > 200 ? '…' : ''}”\n\n` +
    `**Sources used:**\n${lines.join('\n\n')}\n\n` +
    `**Synthesis:** These excerpts are the ranked lexical matches from the full analytics corpus (managed and non-managed cities). ` +
    `Treat **Critical / High** calamity rows as potential exposure drivers; other categories are contextual (markets, policy, technology, etc.). ` +
    `For binding decisions, verify against official bulletins and your portfolio filters.`
  );
}

export async function ragChatWithOllama(
  query: string,
  chunks: RagCorpusItem[],
  model: string
): Promise<string | null> {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.city} | ${c.title}\nSummary: ${c.summary}\nExcerpt: ${(c.text || '').slice(0, 450)}`
    )
    .join('\n\n---\n\n');
  const prompt =
    `You are an insurance and catastrophe intelligence assistant.\n` +
    `Answer ONLY using the RETRIEVED excerpts below. Cite sources as [1], [2]. ` +
    `If the excerpts do not contain the answer, say clearly that the corpus does not cover it.\n\n` +
    `RETRIEVED EXCERPTS:\n${context}\n\nUSER QUESTION:\n${query}`;
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.response === 'string' ? data.response : null;
  } catch {
    return null;
  }
}
