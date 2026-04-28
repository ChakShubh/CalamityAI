/**
 * Live “real world” lookup when the in-app news corpus is not a good match.
 * Uses Wikipedia’s public JSON API (CORS-friendly with origin=*).
 */

export type OpenWebSearchResult = {
  ok: boolean;
  /** Short label for the UI, e.g. Wikipedia article title */
  headline: string;
  body: string;
  urls: string[];
};

type WikiOpenSearchJson = [string, string[], string[], string[]];

type WikiQueryJson = {
  query?: {
    pages?: Record<string, { title?: string; extract?: string; missing?: string }>;
  };
};

function trimBody(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

/**
 * When the user’s full sentence returns no opensearch hits, try a tighter
 * encyclopedia-oriented query (common “who is the president …” style).
 */
export function wikipediaTweakedQuery(original: string): string | null {
  const t = original.trim();
  if (!t) return null;
  const low = t.toLowerCase();
  if (
    /\b(current\s+)?president\b/i.test(t) &&
    /\b(united\s+states|u\.?s\.?a\.?|america)\b/i.test(low)
  ) {
    return 'President of the United States';
  }
  return null;
}

/** True when the local model says the retrieved in-app excerpts / corpus do not answer the question. */
export function modelIndicatesNoCorpusAnswer(modelText: string): boolean {
  if (!modelText || modelText.length < 24) return false;
  const t = modelText.toLowerCase();
  const phrases = [
    'corpus does not cover',
    'corpus does not contain',
    'does not cover this',
    'does not cover the',
    'does not contain any',
    'does not contain the',
    'does not include any',
    "doesn't contain",
    "isn't in the excerpts",
    'not contained in the excerpts',
    'not contained in the retrieved',
    'not in the excerpts',
    'not in the provided excerpts',
    'not in the corpus',
    'no data or excerpts',
    'no relevant excerpts',
    'no relevant information in the',
    'excerpts do not contain',
    'excerpts do not include',
    'retrieved excerpts do not',
    'provided excerpts do not',
    'cannot answer based on the excerpts',
    'cannot be answered from the excerpts',
    'outside the scope of the retrieved',
  ];
  if (phrases.some((p) => t.includes(p))) return true;
  // Loose combo: corpus / excerpts + negation + (answer|information|cover|contain)
  if (
    /\b(corpus|excerpts|retrieved|bulletins|intelligence reports)\b/i.test(modelText) &&
    /\b(doesn'?t|don'?t|does not|do not|cannot|not contain|not cover|no information|not available)\b/i.test(
      modelText
    )
  ) {
    return true;
  }
  return false;
}

/** Shown when RAG retrieved rows but the model says they don’t answer — then Wikipedia succeeded. */
export function formatWebSupplementWhenModelRejectedCorpus(web: OpenWebSearchResult): string {
  const linkLine = web.urls.length ? `\n\n**Read more:** ${web.urls[0]}` : '';
  if (web.ok) {
    return (
      `**The in-app news excerpts were not sufficient** — the local model reported that the archive/corpus does not answer your question. **We searched the internet now** (English Wikipedia, live) and pulled the following.\n\n` +
      `**Topic:** ${web.headline}\n\n${web.body}${linkLine}\n\n` +
      `_Third-party web content: verify before use._`
    );
  }
  return (
    `**The in-app excerpts did not answer your question** (per the local model). **We tried Wikipedia** but could not retrieve useful text:\n\n${web.body}`
  );
}

async function wikiOpenSearchThenExtract(searchTerm: string): Promise<OpenWebSearchResult> {
  const q = searchTerm.trim().slice(0, 280);
  if (!q) {
    return { ok: false, headline: '', body: 'Empty question.', urls: [] };
  }

  try {
    const opUrl =
      `https://en.wikipedia.org/w/api.php?action=opensearch` +
      `&search=${encodeURIComponent(q)}&limit=5&namespace=0&format=json&origin=*`;
    const r1 = await fetch(opUrl);
    if (!r1.ok) {
      return {
        ok: false,
        headline: 'Wikipedia',
        body: `Open web request failed (HTTP ${r1.status}).`,
        urls: [],
      };
    }

    const d1 = (await r1.json()) as WikiOpenSearchJson;
    const titles = d1[1] || [];
    const descriptions = d1[2] || [];
    const urls = d1[3] || [];

    if (titles.length === 0) {
      const alt = wikipediaTweakedQuery(q);
      if (alt && alt.toLowerCase() !== q.toLowerCase()) {
        return wikiOpenSearchThenExtract(alt);
      }
      return {
        ok: false,
        headline: 'Wikipedia',
        body: 'No encyclopedia matches for this wording. Try different keywords or a more specific topic.',
        urls: [],
      };
    }

    const title = titles[0];
    const exUrl =
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts` +
      `&exintro=1&explaintext=1&format=json&origin=*&titles=${encodeURIComponent(title)}`;

    const r2 = await fetch(exUrl);
    if (!r2.ok) {
      const fallbackDesc = (descriptions[0] || '').trim();
      return {
        ok: true,
        headline: title,
        body: fallbackDesc || 'Article found; full extract could not be loaded.',
        urls: urls[0] ? [urls[0]] : [],
      };
    }

    const d2 = (await r2.json()) as WikiQueryJson;
    const pages = d2.query?.pages;
    if (!pages) {
      const fallbackDesc = (descriptions[0] || '').trim();
      return {
        ok: true,
        headline: title,
        body: fallbackDesc || 'No extract returned.',
        urls: urls[0] ? [urls[0]] : [],
      };
    }

    const page = Object.values(pages)[0];
    if (!page || page.missing) {
      return {
        ok: false,
        headline: title,
        body: 'Matched title could not be loaded from Wikipedia.',
        urls: urls[0] ? [urls[0]] : [],
      };
    }

    const extract = (page.extract || '').trim();
    const opener = (descriptions[0] || '').trim();
    const body = extract
      ? trimBody(extract, 2400)
      : opener || 'No introductory text available for this article.';

    const link =
      urls[0] ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

    return {
      ok: true,
      headline: page.title || title,
      body,
      urls: [link],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return {
      ok: false,
      headline: 'Open web',
      body: `Could not complete an internet lookup from this app (network, CORS, or timeout). Details: ${msg}`,
      urls: [],
    };
  }
}

/**
 * Fetches open-web context from English Wikipedia (opensearch + intro extract).
 */
export async function searchOpenWeb(query: string): Promise<OpenWebSearchResult> {
  return wikiOpenSearchThenExtract(query);
}
