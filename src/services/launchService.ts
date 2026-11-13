import {
  DayChoice,
  getStationById,
  LocationId,
  StationMeta,
  TidePoint,
} from '../data/stations';

export type WindowRating = 'Good' | 'Caution' | 'Avoid';

export interface LaunchWindow {
  id: string;
  start: string;
  end: string;
  timeRange: string;
  startHour: number;
  endHour: number;
  rating: WindowRating;
  reason: string;
}

export interface TideResult {
  station: StationMeta;
  day: DayChoice;
  dateYYYYMMDD: string;
  tides: TidePoint[];
  requestUrl: string;
}

export interface MessagesResult {
  staffBriefing: string;
  customerMessage: string;
}

export interface CachedWorkspacePlan {
  tideData: TideResult;
  windows: LaunchWindow[];
  messages: MessagesResult | null;
  aiWarning: string | null;
}

export class NoaaApiError extends Error {
  url: string;
  constructor(message: string, url: string) {
    super(message);
    this.name = 'NoaaApiError';
    this.url = url;
  }
}

// In-memory cache keyed by `${noaaStationId}:${YYYYMMDD}`
const planCache = new Map<string, CachedWorkspacePlan>();

export function getStationDateYYYYMMDD(ianaTimezone: string, day: DayChoice): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '2026');
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
  const dayNum = Number(parts.find((p) => p.type === 'day')?.value ?? '1');

  const offsetDays = day === 'Tomorrow' ? 1 : 0;
  const target = new Date(Date.UTC(year, month - 1, dayNum + offsetDays));

  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function getCacheKey(stationIdOrLocation: string, day: DayChoice): string {
  const station = getStationById(stationIdOrLocation);
  const dateStr = getStationDateYYYYMMDD(station.ianaTimezone, day);
  return `${station.noaaStationId}:${dateStr}`;
}

export function getCachedPlan(
  stationIdOrLocation: string,
  day: DayChoice
): CachedWorkspacePlan | undefined {
  return planCache.get(getCacheKey(stationIdOrLocation, day));
}

export function setCachedPlan(
  stationIdOrLocation: string,
  day: DayChoice,
  plan: CachedWorkspacePlan
): void {
  planCache.set(getCacheKey(stationIdOrLocation, day), plan);
}

export function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

export function safeParseJson<T>(raw: unknown): T | null {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(stripJsonFences(raw)) as T;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === 'object') {
    return raw as T;
  }
  return null;
}

export function parseTimeToHour(timeStr: string): number {
  const trimmed = timeStr.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = Number(match12[1]);
    const m = Number(match12[2]);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h + m / 60;
  }

  const timePart = trimmed.includes(' ') ? trimmed.split(' ').pop() ?? trimmed : trimmed;
  const [hStr, mStr] = timePart.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 12;
  return h + m / 60;
}

export function formatTime12h(timeStr: string): string {
  const trimmed = timeStr.trim();
  if (/\b(AM|PM)\b/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const timePart = trimmed.includes(' ') ? trimmed.split(' ').pop() ?? trimmed : trimmed;
  const [hStr, mStr] = timePart.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return trimmed;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export async function getTides(
  stationId: string,
  day: DayChoice,
  options?: { simulateError?: boolean }
): Promise<TideResult> {
  const station = getStationById(stationId);
  const dateYYYYMMDD = getStationDateYYYYMMDD(station.ianaTimezone, day);
  const effectiveStationId = options?.simulateError ? '0000000' : station.noaaStationId;

  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
    `?product=predictions` +
    `&station=${encodeURIComponent(effectiveStationId)}` +
    `&begin_date=${dateYYYYMMDD}` +
    `&end_date=${dateYYYYMMDD}` +
    `&datum=MLLW` +
    `&units=metric` +
    `&time_zone=lst_ldt` +
    `&format=json` +
    `&interval=hilo` +
    `&application=LaunchWindowDemo`;

  let response: Response;
  try {
    // Public NOAA API: intentionally send NO API key or Authorization header
    response = await fetch(url);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Network error reaching NOAA API.';
    throw new NoaaApiError(reason, url);
  }

  let data: {
    error?: { message?: string } | string;
    predictions?: Array<{ t: string; v: string; type: 'H' | 'L' }>;
  };

  try {
    data = await response.json();
  } catch {
    throw new NoaaApiError(
      `Invalid JSON response from NOAA (HTTP ${response.status}).`,
      url
    );
  }

  // NOAA can return an "error" field inside a 200 OK JSON body
  if (data && data.error) {
    const errorMsg =
      typeof data.error === 'string'
        ? data.error
        : data.error.message || 'NOAA API returned an error response.';
    throw new NoaaApiError(errorMsg, url);
  }

  if (!response.ok) {
    throw new NoaaApiError(`NOAA API returned HTTP ${response.status}.`, url);
  }

  if (!Array.isArray(data.predictions) || data.predictions.length === 0) {
    throw new NoaaApiError(
      'NOAA returned no tide predictions for this station and date.',
      url
    );
  }

  const tides: TidePoint[] = data.predictions.map((item) => {
    const timeOnly = item.t.includes(' ') ? item.t.split(' ')[1] : item.t;
    return {
      t: item.t,
      time: timeOnly,
      height: Number(item.v),
      type: item.type === 'H' ? 'H' : 'L',
    };
  });

  return {
    station,
    day,
    dateYYYYMMDD,
    tides,
    requestUrl: url,
  };
}

export async function planWindows(
  location: LocationId,
  tides: TidePoint[]
): Promise<LaunchWindow[]> {
  const station = getStationById(location);

  const response = await fetch('/api/plan-windows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: station.id,
      timezoneLabel: station.timezoneLabel,
      harborNote: station.harborNote,
      tides,
    }),
  });

  const textBody = await response.text();
  if (!response.ok) {
    const errObj = safeParseJson<{ error?: string }>(textBody);
    throw new Error(errObj?.error || `Failed to plan launch windows (HTTP ${response.status}).`);
  }

  const parsed = safeParseJson<
    Array<{ start?: string; end?: string; rating?: string; reason?: string }>
  >(textBody);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Could not parse launch windows JSON from Gemini response.');
  }

  return parsed.slice(0, 3).map((item, idx) => {
    const start = String(item.start || '09:00').trim();
    const end = String(item.end || '12:00').trim();
    const rating: WindowRating =
      item.rating === 'Good' || item.rating === 'Caution' || item.rating === 'Avoid'
        ? item.rating
        : 'Caution';

    return {
      id: `${station.noaaStationId}-win-${idx}`,
      start,
      end,
      timeRange: `${formatTime12h(start)} – ${formatTime12h(end)} ${station.timezoneLabel}`,
      startHour: parseTimeToHour(start),
      endHour: parseTimeToHour(end),
      rating,
      reason: String(item.reason || 'Confirm local water conditions before launch.').trim(),
    };
  });
}

export async function writeMessages(
  location: LocationId,
  windows: LaunchWindow[],
  day: DayChoice = 'Today'
): Promise<MessagesResult> {
  const station = getStationById(location);

  const response = await fetch('/api/write-messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: station.id,
      timezoneLabel: station.timezoneLabel,
      day,
      windows: windows.map((w) => ({
        start: w.start,
        end: w.end,
        rating: w.rating,
        reason: w.reason,
      })),
    }),
  });

  const textBody = await response.text();
  if (!response.ok) {
    const errObj = safeParseJson<{ error?: string }>(textBody);
    throw new Error(errObj?.error || `Failed to generate messages (HTTP ${response.status}).`);
  }

  const parsed = safeParseJson<{ staffBriefing?: string; customerMessage?: string }>(textBody);

  if (
    !parsed ||
    typeof parsed.staffBriefing !== 'string' ||
    typeof parsed.customerMessage !== 'string'
  ) {
    throw new Error('Could not parse messages JSON from Gemini response.');
  }

  return {
    staffBriefing: parsed.staffBriefing.trim(),
    customerMessage: parsed.customerMessage.trim(),
  };
}
