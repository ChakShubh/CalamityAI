import { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { getEventTemporalPhase } from '../../utils/eventPhase';
import { EXPOSURE_RADIUS_KM_PER_MAGNITUDE } from '../../constants/exposureModel';
import { ShieldAlert, AlertTriangle, CheckCircle, Search, MapPin, Mail, ClipboardList, Filter, ArrowUpDown, Sparkles, Phone } from 'lucide-react';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HighPriorityDashboard() {
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

  const priorityCases = useMemo(() => {
    const cases: any[] = [];
    const pool = dashboardFocusCity
      ? policyHolders.filter((p) => p.city === dashboardFocusCity)
      : policyHolders;

    pool.forEach((p) => {
      const nearestDisaster = disasters.find((d) => d.Location.City === p.city) ?? null;
      const nearestDist = nearestDisaster
        ? getDistance(
            nearestDisaster.Location.Latitude,
            nearestDisaster.Location.Longitude,
            p.latitude,
            p.longitude
          )
        : Infinity;

      const impactRadius = nearestDisaster
        ? nearestDisaster.Magnitude * EXPOSURE_RADIUS_KM_PER_MAGNITUDE
        : 0;
      if (nearestDisaster && nearestDist <= impactRadius) {
         const phase = getEventTemporalPhase(nearestDisaster.Date);
         const isPreCalamity = phase === 'pre';
         const isPostCalamity = phase === 'post';
         const isActive = phase === 'active';
         
         let timingTag = 'Active Calamity';
         if (isPreCalamity) timingTag = 'Pre-Calamity Urgent';
         if (isPostCalamity) timingTag = 'Post-Calamity Review';
         
         const isUltraUrgent = isPreCalamity && (p.policy_type === 'Business' || p.policy_type === 'Homeowners');
         
         const status = isUltraUrgent ? 'ULTRA URGENT: Pre-Event Clear' : 
                        isPreCalamity ? 'Standard Claim Clearing' : 
                        isActive ? 'Direct Disaster Impact' : 'Post-Event Recovery';
         
         const action = isUltraUrgent ? 'AI-Prioritized Review' :
                        isPreCalamity ? 'Accelerate Standard Review' : 
                        isActive ? 'Initiate Disaster Response' : 'Damage Assessment';

         cases.push({
            id: p.policy_id,
            policyHolder: p.name,
            city: p.city,
            policyType: p.policy_type,
            coverAmount: p.max_cover_amount,
            nearestDisaster: nearestDisaster.Disaster_Type,
            distanceKm: Math.round(nearestDist),
            impactRadiusKm: Math.round(impactRadius),
            status,
            timingTag,
            isUltraUrgent,
            action
         });
      }
    });

    return cases.sort((a, b) => a.distanceKm - b.distanceKm); // Sort by closest to epicenter
  }, [policyHolders, disasters, dashboardFocusCity]);

  const [goodwillSentIds, setGoodwillSentIds] = useState<Set<string>>(new Set());

  const handleSendGoodwill = (id: string, holder: string) => {
    if (goodwillSentIds.has(id)) return;
    setGoodwillSentIds(prev => new Set(prev).add(id));
    addToast(`Automated Goodwill & Safety Check email sent to ${holder}.`, 'success');
  };

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const filteredCases = useMemo(() => {
    const sorted = priorityCases.filter(c => {
      const matchesSearch = c.policyHolder.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            c.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRegion = selectedRegion === 'All' || c.city === selectedRegion;
      
      let matchesTiming = true;
      if (timingFilter === 'Pre-Calamity') matchesTiming = c.timingTag === 'Pre-Calamity Urgent';
      if (timingFilter === 'Active') matchesTiming = c.timingTag === 'Active Calamity';
      if (timingFilter === 'Post-Calamity') matchesTiming = c.timingTag === 'Post-Calamity Review';

      return matchesSearch && matchesRegion && matchesTiming;
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
  }, [priorityCases, searchTerm, selectedRegion, timingFilter, sortConfig]);

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
            <ClipboardList className="w-7 h-7 text-rose-500" /> High Priority Cases
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {`Same footprint as Live Intel: inside magnitude × ${EXPOSURE_RADIUS_KM_PER_MAGNITUDE} km of the metro's canonical scenario.`}
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
               <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Critical Exposures</div>
               <div className="text-2xl font-bold text-rose-400 font-mono">{filteredCases.length}</div>
            </div>
         </div>
         <div className="glass rounded-2xl p-6 border border-amber-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
               <ShieldAlert className="w-6 h-6 text-amber-500" />
            </div>
            <div>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Liability Exposed</div>
               <div className="text-2xl font-bold text-amber-400 font-mono">
                 ${filteredCases.reduce((acc, curr) => acc + curr.coverAmount, 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
               </div>
            </div>
         </div>
         <div className="glass rounded-2xl p-6 border border-emerald-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
               <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Goodwill Outreach Sent</div>
               <div className="text-2xl font-bold text-emerald-400 font-mono">{goodwillSentIds.size}</div>
            </div>
         </div>
      </div>

      <div className="glass rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('id')}>
                  Policy ID <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('policyHolder')}>
                  Policyholder <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('distanceKm')}>
                  Proximity to Epicenter <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('coverAmount')}>
                  Max Coverage <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('timingTag')}>
                  Timing <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200" onClick={() => requestSort('status')}>
                  Status <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Goodwill Action</th>
              </tr>
            </thead>
            <tbody>
              {['Pre-Calamity Urgent', 'Active Calamity', 'Post-Calamity Review'].map(category => {
                const casesInCategory = filteredCases.filter(c => c.timingTag === category);
                if (casesInCategory.length === 0) return null;
                
                return (
                  <>
                    <tr key={`header-${category}`} className="bg-slate-800/50">
                      <td colSpan={7} className="p-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        {category} ({casesInCategory.length} cases)
                      </td>
                    </tr>
                    {casesInCategory.slice(0, 100).map((claim) => (
                      <tr key={claim.id} className={`border-b border-slate-800 hover:bg-slate-800/30 transition-colors ${claim.isUltraUrgent ? 'bg-rose-500/5' : ''}`}>
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
                          <div className="text-sm text-rose-400 font-bold">{claim.distanceKm}km from epicenter</div>
                          <div className="text-[10px] text-slate-500 mt-1">Threat: {claim.nearestDisaster}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-mono text-slate-200">${claim.coverAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                          <div className={`text-[10px] font-bold uppercase mt-1 ${claim.isUltraUrgent ? 'text-rose-400 animate-pulse' : 'text-rose-500'}`}>
                            {claim.isUltraUrgent ? 'CRITICAL EXPOSURE' : 'Exposed'}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 border rounded text-[10px] font-bold uppercase ${
                            claim.timingTag === 'Pre-Calamity Urgent' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                            claim.timingTag === 'Post-Calamity Review' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {claim.timingTag}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 border rounded text-xs font-bold ${
                            claim.isUltraUrgent ? 'bg-rose-500 text-white border-rose-600' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {claim.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => addToast(`AI Assistant evaluating claim ${claim.id}. Marking as ${claim.isUltraUrgent ? 'ULTRA' : 'High'} priority.`, 'info')}
                              className={`p-2 rounded-lg transition-colors ${claim.isUltraUrgent ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-cyan-400'}`}
                              title="AI Assistant Analysis"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => addToast(`Dispatching emergency response team to ${claim.policyHolder}'s location...`, 'info')}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg transition-colors" 
                              title="Dispatch Response Team"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => addToast(`Initiating secure line to ${claim.policyHolder}...`, 'info')}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition-colors" 
                              title="Direct Call"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button 
                              disabled={goodwillSentIds.has(claim.id)}
                              onClick={() => handleSendGoodwill(claim.id, claim.policyHolder)}
                              className={`p-2 rounded-lg transition-colors ${
                                goodwillSentIds.has(claim.id) 
                                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed' 
                                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-400'
                              }`}
                              title={goodwillSentIds.has(claim.id) ? "Goodwill Check Sent" : "Send Goodwill Check"}
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 text-sm">
                    No high priority cases found matching your criteria.
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
