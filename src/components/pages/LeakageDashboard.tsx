import { Fragment, useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { getEventTemporalPhase } from '../../utils/eventPhase';
import { hashString } from '../../utils/regionScale';
import { EXPOSURE_RADIUS_KM_PER_MAGNITUDE } from '../../constants/exposureModel';
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle, Search, MapPin, Filter, ArrowUpDown } from 'lucide-react';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LeakageDashboard() {
  const {
    policyHolders,
    disasters,
    addToast,
    managedCities,
    selectedDisaster,
    dashboardFocusCity,
    setUnifiedDashboardRegion,
  } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [timingFilter, setTimingFilter] = useState<'All' | 'Pre-Calamity' | 'Active' | 'Post-Calamity'>('All');
  const selectedRegion = dashboardFocusCity ?? 'All';
  const setSelectedRegion = setUnifiedDashboardRegion;

  // Generate simulated "claims" from policy holders, and flag ones outside impact zones
  const flaggedClaims = useMemo(() => {
    const pool = dashboardFocusCity
      ? policyHolders.filter((p) => p.city === dashboardFocusCity)
      : policyHolders;
    const filedClaims = pool.slice(0, 1500).map((p, i) => {
      const nearestDisaster =
        disasters.find((d) => d.Location.City === p.city) ?? null;
      const phase = nearestDisaster ? getEventTemporalPhase(nearestDisaster.Date) : 'active';
      const isPreCalamity = phase === 'pre';
      const isPostCalamity = phase === 'post';
      const nearestDist = nearestDisaster
        ? getDistance(
            nearestDisaster.Location.Latitude,
            nearestDisaster.Location.Longitude,
            p.latitude,
            p.longitude
          )
        : Infinity;

      const h = hashString(String(p.policy_id ?? `${p.name}-${i}`));
      const impactRadiusKm = nearestDisaster
        ? nearestDisaster.Magnitude * EXPOSURE_RADIUS_KM_PER_MAGNITUDE
        : 72;
      const geoLeak = nearestDisaster ? nearestDist > impactRadiusKm : false;
      const duplicatePattern = h % 40 === 0;
      const inflatedClaim = h % 100 < 30;
      /** Timing anomaly is only meaningful in pre-calamity forecasting workflows. */
      const timingMismatch = isPreCalamity && h % 50 < 15;
      const isFlagged = geoLeak || duplicatePattern || inflatedClaim || timingMismatch;

      let leakReason = '';
      if (geoLeak) leakReason = 'Geospatial: Outside impact radius';
      else if (timingMismatch) leakReason = 'Temporal: Speculative pre-event filing';
      else if (inflatedClaim) leakReason = 'AI Audit: Over-claiming vs local avg';
      else if (duplicatePattern) leakReason = 'Systemic: Duplicate filing signature';

      let timingTag = 'Active Calamity';
      if (isPreCalamity) timingTag = 'Pre-Calamity';
      if (isPostCalamity) timingTag = 'Post-Calamity';

      const status = isPreCalamity ? 'Predicted Leakage Risk' : 
                     timingTag === 'Active Calamity' ? 'Active Calamity Leakage' : 'Post-Event Recovery Fraud Check';
      const action = isPreCalamity ? 'Speculative Filing Audit' : 
                     timingTag === 'Active Calamity' ? 'Confirm Claim Validity' : 'Historical Recovery Audit';

      const amountClaimed = p.max_cover_amount * (0.12 + (h % 55) / 100);

      return {
        id: p.policy_id || `CLM-${1000 + i}`,
        policyHolder: p.name,
        city: p.city,
        policyType: p.policy_type,
        amountClaimed,
        nearestDisaster: nearestDisaster ? nearestDisaster.Disaster_Type : 'Unknown',
        distanceKm: Math.round(nearestDist),
        impactRadiusKm: Math.round(impactRadiusKm),
        isFlagged,
        timingTag,
        status,
        action,
        leakReason
      };
    });

    // 2. Synthesize post-calamity forensic recovery audit flags for resolved impact zones
    const postCalamityCities = ['Miami', 'Jakarta'];
    const extraFlags: typeof filedClaims = [];
    const reasons = [
      'Geospatial: Outside verified impact radius',
      'Systemic: Duplicate filing signature detected',
      'AI Audit: Inflated structural damage estimate',
      'Temporal: Claim filed prior to landfall'
    ];

    pool.forEach((p, i) => {
      if (postCalamityCities.includes(p.city) && extraFlags.length < 15 && i % 4 === 0) {
        const h = hashString(p.policy_id || `${p.name}-${i}`);
        const amount = p.max_cover_amount * (0.3 + (h % 50) / 100);
        extraFlags.push({
          id: p.policy_id || `CLM-P-${1000 + i}`,
          policyHolder: p.name,
          city: p.city,
          policyType: p.policy_type,
          amountClaimed: amount,
          nearestDisaster: p.city === 'Miami' ? 'Hurricane' : 'Storm Surge',
          distanceKm: 85 + (h % 150),
          impactRadiusKm: 60,
          isFlagged: true,
          timingTag: 'Post-Calamity',
          status: 'Post-Event Recovery Fraud Check',
          action: 'Historical Recovery Audit',
          leakReason: reasons[h % reasons.length]
        });
      }
    });

    return [...filedClaims.filter(c => c.isFlagged), ...extraFlags].sort((a, b) => b.amountClaimed - a.amountClaimed);
  }, [policyHolders, disasters, dashboardFocusCity]);

  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const handleResolve = (id: string) => {
    setResolvedIds(prev => new Set(prev).add(id));
    addToast(`Claim ${id} verified and resolved. Capital risk cleared.`, 'success');
  };

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const filteredFlags = useMemo(() => {
    const sorted = flaggedClaims.filter(c => {
      const matchesSearch = c.policyHolder.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            c.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRegion = selectedRegion === 'All' || c.city === selectedRegion;
      
      let matchesTiming = true;
      if (timingFilter === 'Pre-Calamity') matchesTiming = c.timingTag === 'Pre-Calamity';
      if (timingFilter === 'Active') matchesTiming = c.timingTag === 'Active Calamity';
      if (timingFilter === 'Post-Calamity') matchesTiming = c.timingTag === 'Post-Calamity';

      return matchesSearch && matchesRegion && matchesTiming && !resolvedIds.has(c.id);
    });

    if (sortConfig !== null) {
      sorted.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sorted;
  }, [flaggedClaims, searchTerm, selectedRegion, timingFilter, sortConfig, resolvedIds]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-rose-500" /> Claims Leakage Detection
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Flagging claims vs the <strong>same-city</strong> scenario footprint used on Live Intel and Priority (radius = magnitude × {EXPOSURE_RADIUS_KM_PER_MAGNITUDE} km).
          </p>
          {(dashboardFocusCity || selectedDisaster) && (
            <p className="text-xs text-cyan-500/90 mt-2">
              Unified focus:{' '}
              {selectedDisaster
                ? `${selectedDisaster.Disaster_Type} · ${selectedDisaster.Location?.City}`
                : dashboardFocusCity}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
             <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
             <select 
               value={timingFilter}
               onChange={(e) => setTimingFilter(e.target.value as typeof timingFilter)}
               className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-rose-500/50 transition-colors appearance-none"
             >
               <option value="All">All Phases</option>
               <option value="Pre-Calamity">Pre-Calamity</option>
               <option value="Active">Active Calamity</option>
               <option value="Post-Calamity">Post-Calamity</option>
             </select>
          </div>

          <div className="relative">
             <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
             <select 
               value={selectedRegion}
               onChange={(e) => setSelectedRegion(e.target.value)}
               className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-rose-500/50 transition-colors appearance-none"
             >
               <option value="All">All Regions (Global)</option>
               {Array.from(managedCities).map(city => (
                 <option key={city} value={city}>{city}</option>
               ))}
             </select>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-48 bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-rose-500/50 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="glass rounded-2xl p-6 border border-rose-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
               <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <div>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Flagged Claims</div>
               <div className="text-2xl font-bold text-rose-400 font-mono">{filteredFlags.length}</div>
            </div>
         </div>
         <div className="glass rounded-2xl p-6 border border-emerald-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
               <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved Capital (Est.)</div>
               <div className="text-2xl font-bold text-emerald-400 font-mono">
                 ${filteredFlags.reduce((acc, curr) => acc + curr.amountClaimed, 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
               </div>
            </div>
         </div>
         <div className="glass rounded-2xl p-6 border border-amber-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
               <XCircle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Contact</div>
               <div className="text-2xl font-bold text-amber-400 font-mono">{filteredFlags.length}</div>
            </div>
         </div>
      </div>

      <div className="glass rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('id')}>
                  Claim ID <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('policyHolder')}>
                  Policyholder <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('timingTag')}>
                  Timing <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('distanceKm')}>
                  Location Variance <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('amountClaimed')}>
                  Amount <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('action')}>
                  Recommended Action <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Resolve</th>
              </tr>
            </thead>
            <tbody>
              {['Pre-Calamity', 'Active Calamity', 'Post-Calamity'].map(category => {
                const flagsInCategory = filteredFlags.filter(f => f.timingTag === category);
                if (flagsInCategory.length === 0) return null;

                return (
                  <Fragment key={category}>
                    <tr className="bg-slate-800/50">
                      <td colSpan={7} className="p-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        {category} ({flagsInCategory.length} flags)
                      </td>
                    </tr>
                    {flagsInCategory.map((claim) => (
                      <tr key={`${category}-${claim.id}`} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <span className="text-sm font-mono text-slate-300">{claim.id}</span>
                          <div className="text-[10px] text-slate-500 mt-1">{claim.policyType}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-bold text-slate-200">{claim.policyHolder}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" /> {claim.city}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 border rounded text-[10px] font-bold uppercase ${
                            claim.timingTag === 'Pre-Calamity' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 
                            claim.timingTag === 'Post-Calamity' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {claim.timingTag}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-rose-400 font-bold">{claim.distanceKm}km away</div>
                          <div className="text-[10px] text-slate-500 mt-1">Max Impact Radius: {claim.impactRadiusKm}km</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-mono text-slate-200">${claim.amountClaimed.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                          <div className={`text-[10px] font-bold uppercase mt-1 ${claim.status.includes('Active') ? 'text-rose-500' : 'text-amber-500'}`}>
                            {claim.status}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-1">{claim.leakReason}</div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs font-bold">
                            {claim.action}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => addToast(`Initiating detailed investigation for claim ${claim.id}...`, 'info')}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg transition-colors" 
                              title="Flag for Manual Review"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleResolve(claim.id)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition-colors" 
                              title="Mark as Resolved"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {filteredFlags.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 text-sm">
                    No leakage cases found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
