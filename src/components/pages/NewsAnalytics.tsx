import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper,
  BrainCircuit,
  Loader2,
  RefreshCw,
  Cpu,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import type { LLMItem } from '../../context/DataContext';
import {
  retrieveNewsForRagScored,
  ragChatWithOllama,
  buildLocalRagAnswer,
  RAG_CORPUS_WEAK_THRESHOLD,
} from '../../utils/ragNewsChat';
import {
  searchOpenWeb,
  modelIndicatesNoCorpusAnswer,
  formatWebSupplementWhenModelRejectedCorpus,
  type OpenWebSearchResult,
} from '../../utils/internetSearchFallback';

function formatInternetFallbackMessage(web: OpenWebSearchResult): string {
  const linkLine = web.urls.length ? `\n\n**Read more:** ${web.urls[0]}` : '';
  if (web.ok) {
    return (
      `**Not in this app’s news archive** — we did not find a strong enough match in the RAG corpus for your question, **so we searched the internet now** (live lookup via English Wikipedia) and pulled the following.\n\n` +
      `**Topic:** ${web.headline}\n\n${web.body}${linkLine}\n\n` +
      `_Third-party web content: verify before operational or underwriting use._`
    );
  }
  return (
    `**Not in this app’s news archive** — the RAG corpus did not contain a good match. **We attempted an internet search** (Wikipedia) just now, but could not retrieve useful text:\n\n${web.body}\n\n` +
    `Try different keywords, or check your network / whether the browser allows requests to wikipedia.org.`
  );
}

type LocationFilter = 'All' | 'Managed' | 'Unmanaged';
type TopicFilter =
  | 'All'
  | 'Calamity'
  | 'General'
  | 'Markets'
  | 'Policy'
  | 'Technology'
  | 'Energy'
  | 'Health'
  | 'Legal'
  | 'Climate'
  | 'Insurance'
  | 'Logistics'
  | 'Macro'
  | 'Sports';

function isCalamityCategory(c: string): boolean {
  return c === 'news_alert' || c === 'disaster_forecast';
}

function matchesTopicFilter(item: LLMItem, topic: TopicFilter): boolean {
  if (topic === 'All') return true;
  if (topic === 'Calamity') return isCalamityCategory(item.category);
  if (topic === 'General') return item.category === 'general_news';
  const map: Partial<Record<TopicFilter, string>> = {
    Markets: 'markets',
    Policy: 'policy_regulation',
    Technology: 'technology',
    Energy: 'energy_utilities',
    Health: 'health_science',
    Legal: 'legal',
    Climate: 'climate_environment',
    Insurance: 'insurance_industry',
    Logistics: 'logistics',
    Macro: 'macroeconomics',
    Sports: 'sports_brief',
  };
  const key = map[topic];
  return key ? item.category === key : true;
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    news_alert: 'Calamity',
    general_news: 'General',
    disaster_forecast: 'Forecast',
    markets: 'Markets',
    policy_regulation: 'Policy',
    technology: 'Technology',
    energy_utilities: 'Energy',
    health_science: 'Health',
    legal: 'Legal',
    climate_environment: 'Climate',
    insurance_industry: 'Insurance',
    logistics: 'Logistics',
    macroeconomics: 'Macro',
    sports_brief: 'Sports',
  };
  return labels[cat] || cat.replace(/_/g, ' ');
}

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string };

function chatId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function NewsAnalytics() {
  const { newsAnalyticsCorpus, managedCities } = useData();
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('All');
  const [topicFilter, setTopicFilter] = useState<TopicFilter>('All');

  const newsItems = useMemo(() => {
    return newsAnalyticsCorpus.filter((item) => {
      const managed = managedCities.has(item.city);
      const matchesLoc =
        locationFilter === 'All' ||
        (locationFilter === 'Managed' && managed) ||
        (locationFilter === 'Unmanaged' && !managed);
      return matchesLoc && matchesTopicFilter(item, topicFilter);
    });
  }, [newsAnalyticsCorpus, managedCities, locationFilter, topicFilter]);

  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('llama3');

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask anything about the **full news corpus** (managed metros + global). I retrieve the most relevant articles (lexical RAG), then answer using Ollama when available, or a cited offline synthesis. **If the archive is not a good match**, I will **search the live web** (Wikipedia) and clearly say that the answer was not from the corpus.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleSummarize = async () => {
    setLoading(true);
    setSummary(null);
    try {
      const promptText = `You are an elite risk management AI. Analyze these global incidents:
${newsItems.slice(0, 22).map((n) => `- [${n.city}${n.country ? `, ${n.country}` : ''}] ${n.title} (${n.category}; Severity: ${n.severity})`).join('\n')}

Provide a structured report in 3 sections:
1. RISK CORRELATION: Identify if multiple events are related.
2. RESOURCE ALLOCATION: Which cities need immediate field adjusters?
3. 48-HOUR OUTLOOK: Predictive synthesis of cascading failures.`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: promptText,
          stream: false,
        }),
      });

      if (response.status === 404) {
        setSummary(
          "ERROR 404: The Ollama endpoint was found, but the generation route failed. This often happens if the model is not pulled. \n\nACTION: Run 'ollama pull llama3' in your terminal."
        );
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setSummary(data.response);
    } catch {
      setSummary(
        'CONNECTION ERROR: Local AI Node (Ollama) is unreachable. \n\n1. Ensure Ollama is running.\n2. Run \'OLLAMA_ORIGINS="*" ollama serve\' for CORS.\n3. Check if the model you entered is installed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChatSend = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setChatMessages((m) => [...m, { id: chatId(), role: 'user', content: q }]);
    setChatLoading(true);
    try {
      const { chunks, maxScore } = retrieveNewsForRagScored(q, newsAnalyticsCorpus, 12);
      const corpusStrong = chunks.length > 0 && maxScore >= RAG_CORPUS_WEAK_THRESHOLD;

      if (!corpusStrong) {
        const web = await searchOpenWeb(q);
        setChatMessages((m) => [
          ...m,
          { id: chatId(), role: 'assistant', content: formatInternetFallbackMessage(web) },
        ]);
      } else {
        const ollama = await ragChatWithOllama(q, chunks, model);
        let answer = ollama || buildLocalRagAnswer(q, chunks);
        if (ollama && modelIndicatesNoCorpusAnswer(ollama)) {
          const web = await searchOpenWeb(q);
          if (web.ok) {
            answer = formatWebSupplementWhenModelRejectedCorpus(web);
          } else {
            answer =
              `${ollama}\n\n---\n\n**Internet fallback (Wikipedia):** we tried a live lookup because the model said the corpus did not answer your question, but no article could be loaded.\n\n${web.body}`;
          }
        }
        setChatMessages((m) => [...m, { id: chatId(), role: 'assistant', content: answer }]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden pr-2">
      <div className="w-full lg:w-1/2 flex flex-col gap-3 min-h-[400px] lg:min-h-0 overflow-hidden">
        <div className="glass rounded-2xl p-4 flex flex-col min-h-0 flex-1 border border-slate-700/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold tracking-widest uppercase text-slate-300">
                Global news corpus
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value as LocationFilter)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-slate-200 outline-none focus:border-cyan-500/50"
              >
                <option value="All">All locations</option>
                <option value="Managed">Managed cities</option>
                <option value="Unmanaged">Outside portfolio</option>
              </select>
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value as TopicFilter)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-slate-200 outline-none focus:border-cyan-500/50 max-w-[200px]"
              >
                <option value="All">All topics</option>
                <option value="Calamity">Calamities</option>
                <option value="General">General news</option>
                <option value="Markets">Markets</option>
                <option value="Policy">Policy & regulation</option>
                <option value="Technology">Technology</option>
                <option value="Energy">Energy & utilities</option>
                <option value="Health">Health & science</option>
                <option value="Legal">Legal</option>
                <option value="Climate">Climate & environment</option>
                <option value="Insurance">Insurance industry</option>
                <option value="Logistics">Logistics & trade</option>
                <option value="Macro">Macroeconomics</option>
                <option value="Sports">Sports & venues</option>
              </select>
              <span className="text-[10px] text-slate-500 font-mono bg-slate-800/50 px-2 rounded hidden sm:inline">
                {newsItems.length} items
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {newsItems.map((item, i) => (
              <motion.div
                key={`${item.id}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4)}}
                className="glass-light rounded-xl p-3 border border-slate-700/20 hover:bg-slate-700/20 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.severity === 'Critical'
                        ? 'bg-rose-400 animate-pulse'
                        : item.severity === 'High'
                          ? 'bg-amber-400'
                          : 'bg-cyan-400'
                    }`}
                  />
                  <span className="text-[11px] font-bold text-slate-200 uppercase tracking-tight group-hover:text-cyan-400 transition-colors flex-1 min-w-0">
                    {item.title}
                  </span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded border border-slate-600/50 text-slate-400 font-mono uppercase shrink-0">
                    {categoryLabel(item.category)}
                  </span>
                  <span className="text-[8px] text-slate-500 font-mono shrink-0">{item.timestamp}</span>
                </div>
                <div className="flex gap-2 items-center text-[9px] text-slate-500 font-mono mb-2 flex-wrap">
                  <span className="bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/30">
                    {item.city}
                    {item.country ? ` · ${item.country}` : ''}
                  </span>
                  {managedCities.has(item.city) && (
                    <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 text-[8px] font-bold">
                      Managed
                    </span>
                  )}
                  <span className="bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/30 uppercase truncate max-w-[140px]">
                    {item.source}
                  </span>
                  <span
                    className={`ml-auto px-1.5 py-0.5 rounded border shrink-0 ${
                      item.severity === 'Critical'
                        ? 'border-rose-500/30 text-rose-400 bg-rose-500/5'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">{item.summary}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col gap-3 min-h-[500px] lg:min-h-0 min-h-0">
        <div className="glass rounded-2xl p-4 flex flex-col flex-1 min-h-[240px] relative overflow-hidden border border-emerald-500/20">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <BrainCircuit className="w-48 h-48 text-cyan-400" />
          </div>

          <div className="flex items-center justify-between mb-3 relative z-10 shrink-0">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold tracking-widest uppercase text-slate-300">Predictive report</h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center bg-slate-800/50 rounded-lg px-2 py-1 border border-slate-700/30">
                <Cpu className="w-3 h-3 text-slate-500 mr-2" />
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-transparent text-[10px] text-slate-300 font-mono outline-none w-20"
                />
              </div>
              <button
                onClick={handleSummarize}
                disabled={loading}
                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {loading ? 'Synthesizing...' : 'Run report'}
              </button>
            </div>
          </div>

          <div className="flex-1 glass-light rounded-xl p-4 border border-slate-700/20 overflow-y-auto relative z-10 custom-scrollbar min-h-0">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full min-h-[120px] text-slate-500 space-y-4"
                >
                  <div className="relative">
                    <BrainCircuit className="w-8 h-8 text-emerald-400/50 animate-pulse" />
                    <div className="absolute inset-0 border-t-2 border-emerald-400 rounded-full animate-spin" />
                  </div>
                  <span className="text-xs font-mono tracking-widest uppercase animate-pulse">
                    Running neural inference...
                  </span>
                </motion.div>
              ) : summary ? (
                <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 block">
                      Executive insights
                    </span>
                    <div className="text-[12px] text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                      {summary}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-slate-500 opacity-60 text-center px-6">
                  <BrainCircuit className="w-10 h-10 mb-4 text-slate-700" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Neural analysis pending
                  </h3>
                  <p className="text-[10px] max-w-xs leading-relaxed">
                    Uses the <strong>filtered list</strong> on the left ({newsItems.length} rows). Correlate alerts and
                    generate field guidance when Ollama is running.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 flex flex-col flex-1 min-h-[280px] border border-violet-500/20 overflow-hidden">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <h2 className="text-xs font-bold tracking-widest uppercase text-slate-300">RAG research chat</h2>
              <Sparkles className="w-3.5 h-3.5 text-violet-400/80" />
            </div>
            <span className="text-[9px] text-slate-500 font-mono hidden sm:inline">Full corpus · {newsAnalyticsCorpus.length} docs</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 custom-scrollbar min-h-0">
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-violet-600/15 border border-violet-500/25 text-slate-100 ml-6'
                    : 'bg-slate-900/50 border border-slate-700/40 text-slate-300 mr-4'
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                  {m.role === 'user' ? 'You' : 'Assistant (RAG)'}
                </span>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-[11px] px-2">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                Retrieving sources & drafting…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2 shrink-0">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChatSend())}
              placeholder="Ask about cities, perils, markets, regulation…"
              className="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-violet-500/50 placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={handleChatSend}
              disabled={chatLoading || !chatInput.trim()}
              className="px-3 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
