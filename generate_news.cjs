const fs = require('fs');

const cities = ['Miami', 'Mumbai', 'Jakarta', 'Sydney', 'Tokyo', 'London', 'Berlin', 'New York', 'Sao Paulo'];
// No Earthquakes
const calamities = [
  { type: 'Hurricane', phrases: ['strong winds', 'storm surges', 'heavy rainfall'], leadTimes: [24, 48, 72], durations: [3, 5, 10] },
  { type: 'Flood', phrases: ['rising water levels', 'overflowing rivers', 'flash floods'], leadTimes: [6, 12, 24], durations: [2, 4, 7] },
  { type: 'Wildfire', phrases: ['smoke plumes', 'rapid fire spread', 'catastrophic fire risk'], leadTimes: [12, 24, 48], durations: [7, 10, 14] },
  { type: 'Tsunami', phrases: ['massive waves', 'coastal inundation', 'deep-sea tremors'], leadTimes: [1, 3, 8], durations: [1, 2, 3] },
  { type: 'Cyclone', phrases: ['rotating wind systems', 'low pressure centers', 'destructive gusts'], leadTimes: [48, 72, 96], durations: [5, 8, 12] }
];

const data = [];
let id = 6000;

// Read existing scenarios to avoid logical conflicts
const scenarios = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8'));
const cityStatus = {};
scenarios.forEach(s => {
  const date = new Date(s.Date);
  const now = new Date('2026-05-09'); // Anchor to system date
  let phase = 'pre';
  if (Math.abs(now.getTime() - date.getTime()) < 48 * 3600000) phase = 'active';
  else if (now > date) phase = 'post';
  
  if (!cityStatus[s.Location.City]) cityStatus[s.Location.City] = {};
  cityStatus[s.Location.City][s.Disaster_Type] = phase;
});

// 1. Generate many Past News from varying dates (last 10 days)
console.log('Generating past news...');
for (let dayOffset = 1; dayOffset <= 10; dayOffset++) {
  const countPerDay = 15 + Math.floor(Math.random() * 10);
  for (let i = 0; i < countPerDay; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const calamity = calamities[Math.floor(Math.random() * calamities.length)];
    const timestamp = new Date(Date.now() - 86400000 * dayOffset - Math.random() * 86400000).toISOString();
    
    // Only generate past news if it doesn't conflict with an UPCOMING event in data.json
    if (cityStatus[city]?.[calamity.type] === 'pre') continue;

    const isOld = dayOffset > 2;
    data.push({
      id: id++,
      city,
      title: isOld ? `${calamity.type} Impact in ${city}` : `${calamity.type} Impact Report: ${city}`,
      text: `Historical data review for ${city} regarding the ${calamity.type} event on day -${dayOffset}. Recovery complete. All claims resolved.`,
      summary: `Past ${calamity.type} in ${city} (${dayOffset} days ago).`,
      category: 'news_alert',
      severity: 'Low',
      source: 'Global Risk Archive',
      timestamp: timestamp,
      date: timestamp.split('T')[0],
      isPostEvent: true
    });
  }
}

// 2. Generate present event news (Mumbai Flood)
console.log('Generating present news...');
const nowIso = new Date().toISOString();
for (let i = 0; i < 5; i++) {
  data.push({
    id: id++,
    city: 'Mumbai',
    title: i === 0 ? 'Severe Monsoon Flooding in Mumbai' : `Update #${i}: Mumbai Flood Situation`,
    text: i === 0 
      ? 'The city of Mumbai is currently facing severe flooding due to record-breaking monsoon rainfall. The Mithi river has breached its banks.' 
      : `Rescue teams are reporting more progress in the ${i}th district of Mumbai. Water levels are being monitored closely.`,
    summary: 'Active flood emergency in Mumbai.',
    category: 'news_alert',
    severity: 'Critical',
    source: 'Mumbai Emergency Ops',
    timestamp: new Date(Date.now() - i * 3600000).toISOString(), 
    date: nowIso.split('T')[0]
  });
}

// 3. Generate Future Forecasts (Upcoming - NO Earthquake)
console.log('Generating upcoming news...');
const futureCities = ['Jakarta', 'Sydney', 'Miami', 'Tokyo'];
for (let i = 0; i < 50; i++) {
  const city = futureCities[Math.floor(Math.random() * futureCities.length)];
  const calamity = calamities[Math.floor(Math.random() * calamities.length)];
  
  // LOGIC: Don't predict something that is already happening or has happened
  if (cityStatus[city]?.[calamity.type] === 'active' || cityStatus[city]?.[calamity.type] === 'post') {
    continue;
  }

  const leadTime = 36 + Math.floor(Math.random() * 120);
  const timestamp = new Date(Date.now() - Math.random() * 3600000).toISOString();
  const predicted_time = new Date(Date.now() + leadTime * 3600000).toISOString();

  data.push({
    id: id++,
    city,
    title: `${calamity.type} approaching ${city}`,
    text: `Satellite models indicate a ${calamity.type} is forming and will impact ${city} in approximately ${leadTime} hours. High probability of disruption.`,
    summary: `Upcoming ${calamity.type} for ${city}.`,
    category: 'news_alert',
    severity: 'High',
    source: 'Predictive Analytics Wing',
    timestamp: timestamp,
    predicted_time: predicted_time,
    date: timestamp.split('T')[0]
  });
}

// 4. Industry-Specific News
console.log('Generating industry news...');
const categories = [
  { id: 'markets', label: 'Markets', topics: ['Equity shift', 'Bond yield volatility', 'Commodity price surge'] },
  { id: 'policy_regulation', label: 'Policy', topics: ['New insurance mandate', 'Regulatory audit', 'Cross-border compliance'] },
  { id: 'technology', label: 'Technology', topics: ['AI model deployment', 'Cybersecurity breach', 'Infrastructure upgrade'] },
  { id: 'energy_utilities', label: 'Energy', topics: ['Grid stabilization', 'Renewable pivot', 'Supply chain strain'] },
  { id: 'health_science', label: 'Health', topics: ['Public health alert', 'Biotech breakthrough', 'Resource allocation'] },
  { id: 'legal', label: 'Legal', topics: ['Class action suit', 'Policy dispute', 'Arbitration ruling'] },
  { id: 'climate_environment', label: 'Climate', topics: ['Carbon emission report', 'Sustainability goal', 'Environmental impact'] },
  { id: 'insurance_industry', label: 'Insurance', topics: ['Reinsurance pricing', 'Claims processing speed', 'Risk pool analysis'] },
  { id: 'logistics', label: 'Logistics', topics: ['Port congestion', 'Freight rate spike', 'Route optimization'] },
  { id: 'macroeconomics', label: 'Macro', topics: ['Inflation hedge', 'GDP growth forecast', 'Interest rate outlook'] },
  { id: 'sports_brief', label: 'Sports', topics: ['Venue security', 'Major tournament prep', 'Player safety protocol'] }
];

categories.forEach(cat => {
  for (let i = 0; i < 15; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const topic = cat.topics[Math.floor(Math.random() * cat.topics.length)];
    const timestamp = new Date(Date.now() - Math.random() * 86400000 * 5).toISOString();
    data.push({
      id: id++,
      city,
      title: `${cat.label}: ${topic} in ${city}`,
      text: `Professional analysis of ${topic.toLowerCase()} within the ${city} region. Experts suggest monitoring for operational impact.`,
      summary: `Industry report on ${topic.toLowerCase()} regarding ${cat.label}.`,
      category: cat.id,
      severity: Math.random() > 0.8 ? 'High' : 'Low',
      source: `${cat.label} Intelligence Unit`,
      timestamp: timestamp,
      date: timestamp.split('T')[0]
    });
  }
});

// 5. General News
for (let i = 0; i < 50; i++) {
  const city = cities[Math.floor(Math.random() * cities.length)];
  const timestamp = new Date(Date.now() - Math.random() * 86400000 * 3).toISOString();
  data.push({
    id: id++,
    city,
    title: `City Update: ${city} infrastructure`,
    text: `Routine maintenance reports for ${city} are within normal parameters.`,
    summary: `Status check for ${city}.`,
    category: 'general_news',
    severity: 'Low',
    source: 'Urban Intelligence',
    timestamp: timestamp,
    date: timestamp.split('T')[0]
  });
}

fs.writeFileSync('src/data/LLM_DATA.json', JSON.stringify(data, null, 2));
console.log(`Generated ${data.length} news articles and saved to LLM_DATA.json`);
