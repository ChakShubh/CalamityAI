const fs = require('fs');

const data = [
  {
    "id": 1,
    "city": "Tokyo",
    "title": "Severe Seismic Activity Report",
    "text": "A major 7.5 magnitude earthquake struck Tokyo Bay area 12 hours ago. Power outages are widespread. Recovery efforts are expected to last for 5 days.",
    "summary": "7.5 mag earthquake struck Tokyo; recovery underway.",
    "category": "news_alert",
    "severity": "Critical",
    "source": "Global Seismic Network",
    "timestamp": "2026-05-08T10:00:00Z",
    "date": "2026-05-08",
    "duration_days": 5,
    "isPostEvent": true
  },
  {
    "id": 2,
    "city": "Miami",
    "title": "Category 4 Hurricane Approach",
    "text": "Hurricane Zeta has rapidly intensified over the Atlantic and is currently tracking directly towards the Florida coast. Landfall is expected near Miami in exactly 72 hours. Storm surges of up to 12 feet are predicted, leading to extreme flooding that could take 10 days to recede.",
    "summary": "Category 4 Hurricane tracking towards Miami, landfall in 72h.",
    "category": "news_alert",
    "severity": "High",
    "source": "National Hurricane Center",
    "timestamp": "2026-05-09T08:15:00Z",
    "date": "2026-05-09",
    "predicted_time": "2026-05-12T08:00:00Z",
    "duration_days": 10
  },
  {
    "id": 3,
    "city": "Sydney",
    "title": "Unprecedented Bushfire Risk",
    "text": "Extreme temperatures and dry winds have elevated the bushfire risk in the Greater Sydney region to catastrophic levels. Experts predict massive fire fronts to form by tomorrow afternoon, fueled by expected 80km/h winds. The crisis is expected to last 14 days until significant rainfall arrives.",
    "summary": "Catastrophic bushfire risk for Sydney due to extreme heat and winds tomorrow.",
    "category": "news_alert",
    "severity": "Critical",
    "source": "Aus Fire Command",
    "timestamp": "2026-05-09T04:30:00Z",
    "date": "2026-05-09",
    "predicted_time": "2026-05-10T16:00:00Z",
    "duration_days": 14
  },
  {
    "id": 4,
    "city": "Jakarta",
    "title": "Imminent Tsunami Threat",
    "text": "Following a massive deep-sea tremor in the Java Trench, a tsunami warning has been issued for the Jakarta coastline. Waves up to 5 meters are predicted to hit the shores in just 14 hours. Evacuation protocols are underway. Coastal inundation might take 3 days to fully drain.",
    "summary": "Tsunami warning for Jakarta coastline, expected in 14 hours.",
    "category": "news_alert",
    "severity": "Critical",
    "source": "Pacific Tsunami Warning",
    "timestamp": "2026-05-09T12:00:00Z",
    "date": "2026-05-09",
    "predicted_time": "2026-05-10T02:00:00Z",
    "duration_days": 3
  },
  {
    "id": 5,
    "city": "London",
    "title": "Severe Financial District Flooding",
    "text": "Unprecedented continuous rainfall over the past 48 hours has breached the Thames Barrier defenses. Extensive flooding is expected to hit the London financial district by early morning tomorrow, causing billions in commercial damage. The waters are predicted to take 7 days to recede.",
    "summary": "Thames Barrier breached, extensive flooding expected in London by tomorrow.",
    "category": "news_alert",
    "severity": "High",
    "source": "UK Environment Agency",
    "timestamp": "2026-05-09T11:45:00Z",
    "date": "2026-05-09",
    "predicted_time": "2026-05-10T06:00:00Z",
    "duration_days": 7
  },
  {
    "id": 6,
    "city": "Berlin",
    "title": "Cyber Infrastructure Attack",
    "text": "A coordinated cyberattack is currently targeting major utilities in Berlin. Intelligence suggests a complete grid failure could occur within the next 24 hours if the breach is not contained. Recovery of systems could take up to 4 days.",
    "summary": "Cyberattack targeting Berlin utilities, potential grid failure in 24h.",
    "category": "news_alert",
    "severity": "High",
    "source": "EU Cyber Command",
    "timestamp": "2026-05-09T13:20:00Z",
    "date": "2026-05-09",
    "predicted_time": "2026-05-10T13:00:00Z",
    "duration_days": 4
  },
  {
    "id": 7,
    "city": "Mumbai",
    "title": "Super Cyclone Forming",
    "text": "A low-pressure system in the Arabian Sea has rapidly intensified into a Super Cyclone. It is projected to make landfall near Mumbai in 96 hours, bringing destructive winds and severe flooding. The impact zone will likely be disrupted for 12 days.",
    "summary": "Super Cyclone expected to make landfall in Mumbai in 96 hours.",
    "category": "news_alert",
    "severity": "Critical",
    "source": "India Met Dept",
    "timestamp": "2026-05-09T09:00:00Z",
    "date": "2026-05-09",
    "predicted_time": "2026-05-13T09:00:00Z",
    "duration_days": 12
  },
  {
    "id": 8,
    "city": "New York",
    "title": "Blizzard Warning",
    "text": "A massive winter storm is advancing towards New York City, promising record snowfall. The blizzard is predicted to begin at midnight tomorrow, bringing the city to a standstill for at least 3 days.",
    "summary": "Record snowfall blizzard warning for NYC starting tomorrow midnight.",
    "category": "news_alert",
    "severity": "Medium",
    "source": "National Weather Service",
    "timestamp": "2026-05-09T14:00:00Z",
    "date": "2026-05-09",
    "predicted_time": "2026-05-11T00:00:00Z",
    "duration_days": 3
  },
  {
    "id": 9,
    "city": "Sao Paulo",
    "title": "Grid Collapse Warning",
    "text": "Record heatwaves have pushed the power grid in Sao Paulo to the breaking point. Rolling blackouts are scheduled to begin in 5 hours to prevent total collapse. The heatwave is expected to persist for 6 days.",
    "summary": "Grid collapse warning for Sao Paulo due to heatwave, blackouts in 5h.",
    "category": "news_alert",
    "severity": "High",
    "source": "Brazil Energy Ministry",
    "timestamp": "2026-05-09T15:00:00Z",
    "date": "2026-05-09",
    "predicted_time": "2026-05-09T20:00:00Z",
    "duration_days": 6
  },
  {
    "id": 10,
    "city": "Tokyo",
    "title": "Tech Conference 2026",
    "text": "The annual Global Tech Summit will be held in Tokyo next month, expecting over 50,000 attendees.",
    "summary": "Global Tech Summit in Tokyo next month.",
    "category": "general_news",
    "severity": "Low",
    "source": "TechDaily",
    "timestamp": "2026-04-25T10:00:00Z",
    "date": "2026-05-08"
  }
];

const existingData = JSON.parse(fs.readFileSync('src/data/LLM_DATA.json', 'utf8'));
const combinedData = [...existingData, ...data];
fs.writeFileSync('src/data/LLM_DATA.json', JSON.stringify(combinedData, null, 2));
console.log('Appended LLM data to LLM_DATA.json');
