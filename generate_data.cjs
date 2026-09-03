const fs = require('fs');
const path = require('path');

const landmarksByCity = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src/data/city_landmarks.json'), 'utf8')
);

const cities = [
  { name: 'Miami', lat: 25.7617, lon: -80.1918, country: 'USA', crossKm: 15, fracMin: 0.03, fracMax: 1.34 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777, country: 'India', crossKm: 16, fracMin: 0.03, fracMax: 1.3 },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8456, country: 'Indonesia', crossKm: 17, fracMin: 0.03, fracMax: 1.3 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, country: 'Australia', crossKm: 18, fracMin: 0.03, fracMax: 1.36 },
];

const policyTypes = ['Homeowners', 'Renters', 'Commercial Property', 'Auto', 'Flood Premium', 'Life', 'Health'];

const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Michael', 'Linda', 'David', 'Barbara', 'Robert', 'Elizabeth',
  'William', 'Jennifer', 'Richard', 'Maria', 'Joseph', 'Susan', 'Thomas', 'Jessica', 'Charles', 'Sarah',
  'Daniel', 'Karen', 'Matthew', 'Nancy', 'Anthony', 'Betty', 'Mark', 'Linda', 'Steven', 'Sandra',
  'Priya', 'Arjun', 'Ananya', 'Rahul', 'Sofia', 'Carlos', 'Elena', 'Yuki', 'Hans', 'Amara'
];
const lastNames = [
  'Smith', 'Johnson', 'Garcia', 'Patel', 'Kim', 'Nguyen', 'Silva', 'Müller', 'Okafor', 'Tan',
  'Brown', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Thomas', 'Jackson', 'Lee', 'Clark',
  'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Lopez', 'Hill', 'Green', 'Baker'
];

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cosLatDeg(lat) {
  return Math.max(0.32, Math.abs(Math.cos((lat * Math.PI) / 180)));
}

/** Conservative demo bounds so omnidirectional jitter does not spill into adjacent water. */
function withinSafeLandBox(cityName, lat, lon) {
  const BOX = {
    Miami: { minLat: 25.23, maxLat: 26.34, minLon: -80.82, maxLon: -80.06 },
    Mumbai: { minLat: 18.86, maxLat: 19.58, minLon: 72.80, maxLon: 73.30 },
    Jakarta: { minLat: -6.70, maxLat: -6.09, minLon: 106.54, maxLon: 107.42 },
    Sydney: { minLat: -34.55, maxLat: -33.54, minLon: 150.50, maxLon: 151.16 },
  };
  const b = BOX[cityName];
  if (!b) return true;
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

function clampToSafeLandBox(cityName, lat, lon) {
  const BOX = {
    Miami: { minLat: 25.23, maxLat: 26.34, minLon: -80.82, maxLon: -80.06 },
    Mumbai: { minLat: 18.86, maxLat: 19.58, minLon: 72.80, maxLon: 73.30 },
    Jakarta: { minLat: -6.70, maxLat: -6.09, minLon: 106.54, maxLon: 107.42 },
    Sydney: { minLat: -34.55, maxLat: -33.54, minLon: 150.50, maxLon: 151.16 },
  };
  const b = BOX[cityName];
  if (!b) return [lat, lon];
  return [
    Math.min(b.maxLat, Math.max(b.minLat, lat)),
    Math.min(b.maxLon, Math.max(b.minLon, lon)),
  ];
}

/**
 * Omnidirectional spread: each holder samples along a ray from the CBD toward a **land** landmark
 * (different bearings), plus small cross-track jitter so clusters fill the metro without ocean bias.
 */
function onLandJitter(city, index, attempt = 0) {
  const h = hashString(attempt ? `${city.name}-${index}-r${attempt}` : `${city.name}-${index}`);
  const lms = landmarksByCity[city.name];
  if (!lms || lms.length === 0) throw new Error(`Missing landmarks for ${city.name}`);

  const li = h % lms.length;
  const LM = lms[li];
  const cl = cosLatDeg(city.lat);

  const dN0 = (LM[0] - city.lat) * 111;
  const dE0 = (LM[1] - city.lon) * 111 * cl;
  const len0 = Math.hypot(dN0, dE0) || 1;
  const un = dN0 / len0;
  const ue = dE0 / len0;
  const pn = -ue;
  const pe = un;

  const frac = city.fracMin + ((h >> 7) % 10000) / 10000 * (city.fracMax - city.fracMin);
  let northKm = dN0 * frac;
  let eastKm = dE0 * frac;

  const cross = (((h >> 15) % 2000) / 2000 - 0.5) * 2 * city.crossKm;
  northKm += pn * cross;
  eastKm += pe * cross;

  const j = ((h >> 11) % 2048) / 2048 - 0.5;
  const j2 = ((h >> 21) % 2048) / 2048 - 0.5;
  northKm += j * 2.2 * un + j2 * 0.9 * pn;
  eastKm += j * 2.2 * ue + j2 * 0.9 * pe;

  const lat = city.lat + northKm / 111;
  const lon = city.lon + eastKm / (111 * cl);
  if (withinSafeLandBox(city.name, lat, lon)) return [lat, lon];
  if (attempt < 28) return onLandJitter(city, index, attempt + 1);
  const fb = landmarksByCity[city.name][index % landmarksByCity[city.name].length];
  const dNfb = (fb[0] - city.lat) * 111 * 0.42;
  const dEfb = (fb[1] - city.lon) * 111 * cl * 0.42;
  return clampToSafeLandBox(city.name, city.lat + dNfb / 111, city.lon + dEfb / (111 * cl));
}

const holders = [];
const perCity = 1250;
let idx = 0;
for (const city of cities) {
  for (let j = 0; j < perCity; j++) {
    const [lat, lon] = onLandJitter(city, j);
    const name = `${firstNames[(idx + j) % firstNames.length]} ${lastNames[(idx * 3 + j) % lastNames.length]}`;
    const policyType = policyTypes[(idx + j) % policyTypes.length];
    const coverAmount = 120000 + ((hashString(`${name}-${j}`) % 800) * 1000);

    holders.push({
      policy_id: `POL-${21000 + idx * perCity + j}`,
      name,
      city: city.name,
      country: city.country,
      latitude: lat,
      longitude: lon,
      policy_type: policyType,
      max_cover_amount: coverAmount,
      status: 'Active',
    });
  }
  idx++;
}

fs.writeFileSync('src/data/policy_holders.json', JSON.stringify(holders, null, 2));
console.log('Generated ' + holders.length + ' policy holders in ' + cities.length + ' cities.');
