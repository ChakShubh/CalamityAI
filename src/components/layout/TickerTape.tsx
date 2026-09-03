const TICKER_ITEMS = [
  'HURRICANE WATCH -- Miami-Dade & Broward County, FL (Active Ingress Sector)',
  'MONSOON CELL -- Mumbai MMR heavy precipitation, BMC disaster war room active',
  'DAM OPERATIONS -- Citarum headwater releases monitored, Greater Jakarta',
  'FIRE WEATHER -- NSW RFS elevated operational readiness, Sydney basin perimeter',
  'SYSTEM STATUS -- Multi-Metro Satellite Telemetry Link Online',
  'API GATEWAY -- Latency nominal at 42ms avg across edge nodes',
  'ADJUSTER POOL -- Regional emergency deployment slots open',
  'SATELLITE TELEMETRY -- GOES-16 & Himawari-9 synchronized to active tracking grids',
  'CLAIMS PIPELINE -- High-Velocity Ingestion & Real-Time Fraud Triage Active',
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
