const TICKER_ITEMS = [
  'HURRICANE WATCH -- Miami-Dade & Broward, FL (demo portfolio)',
  'MONSOON CELL -- Mumbai MMR heavy rain, BMC war room active',
  'DAM OPERATIONS -- Citarum headwater releases monitored, Greater Jakarta',
  'FIRE WEATHER -- NSW RFS elevated readiness, Sydney basin',
  'SYSTEM STATUS -- 4-city demo feed online',
  'API GATEWAY -- Latency nominal at 45ms avg',
  'ADJUSTER POOL -- Regional surge slots open',
  'SATELLITE -- GOES / Himawari refresh aligned to active events only',
  'CLAIMS PIPELINE -- Portfolio-scoped to demo metros',
];

export default function TickerTape() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="glass border-t border-slate-700/30 px-0 py-1.5 overflow-hidden relative">
      <div className="flex animate-ticker whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="text-[10px] text-slate-500 font-mono mx-8 flex-shrink-0">
            <span className="text-cyan-500 mr-1.5">|</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
