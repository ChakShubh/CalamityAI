import type { RagCorpusItem } from './ragNewsChat';
import cityLandmarks from '../data/city_landmarks.json';

type TextNerResult = {
  city: string;
  landmarks: string[];
};

type OllamaGenerateResponse = {
  response?: string;
};

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const REQUEST_TIMEOUT_MS = 14000;

const CITY_COUNTRY: Record<string, string> = {
  Miami: 'USA',
  Mumbai: 'India',
  Jakarta: 'Indonesia',
  Sydney: 'Australia',
};

const LANDMARKS = cityLandmarks as Record<string, number[][]>;
const KNOWN_CITIES = Object.keys(LANDMARKS);
const CITY_ALIASES: Record<string, string> = {
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  miami: 'Miami',
  jakarta: 'Jakarta',
  sydney: 'Sydney',
};

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectCityFromText(postText: string): string {
  const text = postText.toLowerCase();
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    const re = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
    if (re.test(text)) return canonical;
  }
  for (const city of KNOWN_CITIES) {
    const re = new RegExp(`\\b${escapeRegExp(city)}\\b`, 'i');
    if (re.test(postText)) return city;
  }
  return '';
}

function normalizeCityName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  const known = Object.keys(LANDMARKS).find((k) => k.toLowerCase() === lower);
  if (known) return known;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractCsvLikeList(raw: string): string[] {
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.toLowerCase() !== 'none')
    .slice(0, 12);
}

async function ollamaGenerate(
  model: string,
  prompt: string,
  opts?: { images?: string[]; format?: 'json' }
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: opts?.format,
        images: opts?.images,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[Aegis Ingestion] Ollama ${model} returned ${response.status}`);
      return null;
    }
    const data = (await response.json()) as OllamaGenerateResponse;
    return typeof data.response === 'string' ? data.response : null;
  } catch (error) {
    console.warn(`[Aegis Ingestion] Ollama ${model} call failed`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Agent 1: Extract city + landmarks from social text via llama3.
 */
export async function runTextNerAgent(postText: string): Promise<TextNerResult> {
  console.log('1. Running Text NER...');
  const deterministicCity = detectCityFromText(postText);
  const prompt =
    `You are a strict JSON extraction engine.\n` +
    `Extract the likely city and landmark entities from this social post.\n` +
    `Valid city must be one of: ${KNOWN_CITIES.join(', ')}.\n` +
    `Return ONLY valid JSON with this exact shape:\n` +
    `{"city":"<city name or empty string>","landmarks":["<landmark1>","<landmark2>"]}\n\n` +
    `POST:\n${postText}`;

  const raw = await ollamaGenerate('llama3', prompt, { format: 'json' });
  if (!raw) return { city: deterministicCity, landmarks: [] };

  const parsed = safeJsonParse<{ city?: string; landmarks?: string[] }>(raw);
  if (!parsed) return { city: deterministicCity, landmarks: [] };

  const parsedCity = normalizeCityName(typeof parsed.city === 'string' ? parsed.city : '');
  const city = parsedCity && parsedCity in LANDMARKS ? parsedCity : deterministicCity;
  const landmarks = Array.isArray(parsed.landmarks)
    ? parsed.landmarks.map((x) => String(x).trim()).filter(Boolean).slice(0, 10)
    : [];

  return { city, landmarks };
}

/**
 * Agent 2: Extract visible landmarks from image via llava.
 */
export async function runVisionExtractionAgent(base64Image: string): Promise<string[]> {
  console.log('2. Running Vision...');
  if (!base64Image || base64Image.trim().length < 24) return [];

  const prompt =
    `Read the image and extract visible street signs, shop names, building names, landmarks.\n` +
    `Output ONLY a comma-separated list. If none, output: none`;

  const raw = await ollamaGenerate('llava', prompt, { images: [base64Image] });
  if (!raw) return [];
  return extractCsvLikeList(raw);
}

function inferSeverity(text: string): string {
  const t = text.toLowerCase();
  if (/(collapsed|fatal|explosion|major fire|flash flood|massive)/.test(t)) return 'Critical';
  if (/(flood|storm|wildfire|earthquake|landslide|evacuation|damaged)/.test(t)) return 'High';
  if (/(warning|heavy rain|traffic disruption|power outage)/.test(t)) return 'Medium';
  return 'Low';
}

function inferHazardType(text: string): string {
  const t = text.toLowerCase();
  if (/(earthquake|tremor|seismic)/.test(t)) return 'Earthquake';
  if (/(hurricane|cyclone|typhoon)/.test(t)) return 'Cyclone';
  if (/(flash flood|flood|inundation|water logging|waterlogging)/.test(t)) return 'Flood';
  if (/(wildfire|forest fire|bushfire)/.test(t)) return 'Wildfire';
  if (/(landslide|mudslide)/.test(t)) return 'Landslide';
  if (/(heatwave|extreme heat)/.test(t)) return 'Heatwave';
  if (/(blizzard|snowstorm)/.test(t)) return 'Blizzard';
  if (/(tsunami)/.test(t)) return 'Tsunami';
  if (/(storm|thunderstorm|severe weather)/.test(t)) return 'Storm';
  return 'Hazard';
}

function buildEventTitle(input: {
  cityLabel: string;
  hazard: string;
  severity: string;
  landmarks: string[];
  postText: string;
}): string {
  const stage = /imminent|next few hours|rising|escalat|watch|warning/i.test(input.postText)
    ? 'Watch'
    : 'Advisory';
  const landmarkHint = input.landmarks[0] ? ` near ${input.landmarks[0]}` : '';
  return `${input.severity} ${input.hazard} ${stage}: ${input.cityLabel}${landmarkHint}`;
}

/**
 * Agent 3 Supervisor: Orchestrates text + vision agents and compiles a RagCorpusItem.
 * Fails gracefully and always returns a structured object for downstream ingestion.
 */
export async function processSocialMediaSignal(
  postText: string,
  base64Image: string
): Promise<RagCorpusItem> {
  console.log('0. Starting Multi-Modal Verification Engine...');
  try {
    const [textNer, visualLandmarks] = await Promise.all([
      runTextNerAgent(postText),
      runVisionExtractionAgent(base64Image),
    ]);

    console.log('3. Running Supervisor / Compiler...');

    const city = normalizeCityName(textNer.city || detectCityFromText(postText));
    const cityExists = city in LANDMARKS;
    const mappedCity = cityExists ? city : '';
    const epicenter = cityExists && LANDMARKS[mappedCity].length > 0 ? LANDMARKS[mappedCity][0] : null;
    const mergedLandmarks = Array.from(new Set([...textNer.landmarks, ...visualLandmarks])).slice(0, 10);

    const contextText = `${postText} ${mergedLandmarks.join(' ')}`;
    const severity = inferSeverity(contextText);
    const hazard = inferHazardType(contextText);
    const cityLabel = mappedCity || 'Unknown city';
    const title = buildEventTitle({
      cityLabel,
      hazard,
      severity,
      landmarks: mergedLandmarks,
      postText,
    });
    const epicenterNote = epicenter ? `Epicenter hint (${epicenter[0].toFixed(4)}, ${epicenter[1].toFixed(4)})` : 'Epicenter unavailable';
    const text =
      `Social signal intake: ${postText}\n` +
      `Extracted landmarks: ${mergedLandmarks.length > 0 ? mergedLandmarks.join(', ') : 'none'}\n` +
      `${epicenterNote}\n` +
      `Verification pipeline: text(llama3) + vision(llava).`;
    const summary =
      `${severity} early warning for ${cityLabel}. ` +
      `${mergedLandmarks.length > 0 ? `Landmarks: ${mergedLandmarks.slice(0, 3).join(', ')}.` : 'No reliable landmarks extracted.'}`;

    return {
      id: Date.now(),
      city: mappedCity || 'Unknown',
      country: mappedCity ? CITY_COUNTRY[mappedCity] || 'Unknown' : 'Unknown',
      title,
      text,
      summary,
      category: 'early_warning',
      severity,
      source: 'Aegis Multi-Modal Engine',
    };
  } catch (error) {
    console.warn('[Aegis Ingestion] Supervisor failed, returning graceful fallback', error);
    return {
      id: Date.now(),
      city: 'Unknown',
      country: 'Unknown',
      title: 'Early warning signal: intake degraded',
      text: `Failed to verify social signal due to local model/API issue.\nRaw post: ${postText}`,
      summary: 'Early-warning intake fallback generated due to local model timeout or unavailability.',
      category: 'early_warning',
      severity: 'Medium',
      source: 'Aegis Multi-Modal Engine',
    };
  }
}
