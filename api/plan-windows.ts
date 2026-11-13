import { GoogleGenAI, Type } from '@google/genai';

interface TidePointInput {
  t?: string;
  time: string;
  height: number;
  type: 'H' | 'L';
}

interface LaunchWindowOutput {
  start: string;
  end: string;
  rating: 'Good' | 'Caution' | 'Avoid';
  reason: string;
}

interface ServerlessRequest {
  method?: string;
  body?: unknown;
}

interface ServerlessResponse {
  status: (code: number) => ServerlessResponse;
  json: (payload: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function parseHour(time: string): number {
  const part = time.includes(' ') ? time.split(' ').pop() ?? time : time;
  const [h, m] = part.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 12;
  return h + m / 60;
}

function roundQuarter(h: number): number {
  return Math.round(h * 4) / 4;
}

function formatHHMM(hourDec: number): string {
  const clamped = Math.max(0, Math.min(23.75, roundQuarter(hourDec)));
  const mins = Math.round(clamped * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function format12h(time24: string): string {
  const part = time24.includes(' ') ? time24.split(' ').pop() ?? time24 : time24;
  const [hStr, mStr] = part.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function fallbackWindows(
  location: string,
  tz: string,
  tides: TidePointInput[]
): LaunchWindowOutput[] {
  const sorted = [...tides]
    .map((t) => ({ ...t, hour: parseHour(t.time) }))
    .sort((a, b) => a.hour - b.hour);

  const candidates: Array<LaunchWindowOutput & { sortHour: number }> = [];

  for (const tide of sorted) {
    if (tide.hour < 6.0 || tide.hour > 19.25) continue;
    const startH = Math.max(7.0, roundQuarter(tide.hour - 1.0));
    const endH = Math.min(19.0, roundQuarter(tide.hour + 1.25));
    if (endH - startH < 1.25) continue;

    const label = `${format12h(tide.time)} ${tz}`;
    const hStr = `${tide.height.toFixed(2)} m`;

    if (tide.type === 'L' && tide.height < -0.15) {
      candidates.push({
        sortHour: startH,
        start: formatHHMM(startH),
        end: formatHHMM(endH),
        rating: 'Avoid',
        reason: `Negative low tide (${hStr} at ${label}) exposes shallow shore hazards and steep dock ramps for beginners.`,
      });
    } else if (tide.type === 'L' && tide.height < 0.3) {
      candidates.push({
        sortHour: startH,
        start: formatHHMM(startH),
        end: formatHHMM(endH),
        rating: 'Caution',
        reason: `Currents ease near the ${label} low tide (${hStr}), but shallow ramp depth requires careful launch supervision.`,
      });
    } else {
      candidates.push({
        sortHour: startH,
        start: formatHHMM(startH),
        end: formatHHMM(endH),
        rating: 'Good',
        reason: `Slack water around the ${label} ${tide.type === 'H' ? 'high' : 'low'} tide (${hStr}) brings gentle currents for beginner paddlers.`,
      });
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const sH = Math.max(7.0, roundQuarter(a.hour + 1.5));
    const eH = Math.min(19.0, roundQuarter(b.hour - 1.25));
    if (eH - sH >= 1.5) {
      const swing = Math.abs(b.height - a.height);
      const dir = b.height > a.height ? 'incoming flood' : 'outgoing ebb';
      const rating: 'Caution' | 'Avoid' = swing >= 2.2 ? 'Avoid' : 'Caution';
      candidates.push({
        sortHour: sH,
        start: formatHHMM(sH),
        end: formatHHMM(eH),
        rating,
        reason:
          rating === 'Avoid'
            ? `Steep ${dir} tide (${swing.toFixed(1)} m swing) creates strong channel currents; hold unguided beginner rentals.`
            : `Active ${dir} current builds between ${format12h(a.time)} and ${format12h(b.time)} ${tz}; keep beginners near sheltered shore.`,
      });
    }
  }

  candidates.sort((a, b) => a.sortHour - b.sortHour);
  const picked: Array<LaunchWindowOutput & { endHour: number }> = [];
  for (const c of candidates) {
    const prev = picked[picked.length - 1];
    if (!prev || c.sortHour >= prev.endHour) {
      picked.push({
        start: c.start,
        end: c.end,
        rating: c.rating,
        reason: c.reason,
        endHour: parseHour(c.end),
      });
    }
  }

  if (picked.length < 2) {
    return [
      {
        start: '08:30',
        end: '11:00',
        rating: 'Good',
        reason: `Morning water conditions in ${location} provide gentle tidal flow suitable for beginner launches.`,
      },
      {
        start: '12:00',
        end: '15:00',
        rating: 'Caution',
        reason: `Midday tidal exchange increases channel drift; keep newer paddlers inside the sheltered launch zone.`,
      },
    ];
  }

  return picked.slice(0, 3).map(({ start, end, rating, reason }) => ({
    start,
    end,
    rating,
    reason,
  }));
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const parsedBody =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});

  const { location, timezoneLabel, harborNote, tides } = parsedBody as {
    location?: string;
    timezoneLabel?: string;
    harborNote?: string;
    tides?: TidePointInput[];
  };

  if (!location || !Array.isArray(tides) || tides.length === 0) {
    res.status(400).json({ error: 'Missing location or tide predictions.' });
    return;
  }

  const tz = timezoneLabel || 'PT';

  if (!process.env.GEMINI_API_KEY) {
    res.status(200).json(fallbackWindows(location, tz, tides));
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const tideSummary = tides
      .map(
        (t) =>
          `${t.time} ${tz} — ${t.type === 'H' ? 'High' : 'Low'} tide (${Number(t.height).toFixed(2)} m)`
      )
      .join('\n');

    const prompt = [
      `Location: ${location} (${tz})`,
      harborNote ? `Local harbor context: ${harborNote}` : '',
      'Today/Target date NOAA High/Low Tide Predictions (metric meters MLLW):',
      tideSummary,
      '',
      'Task: Produce 2 to 3 daytime launch windows between roughly 07:00 and 19:00 local station time for a kayak, paddleboard, and small boat rental business.',
      'Rules:',
      '- Return JSON ONLY: an array of 2–3 objects with { start, end, rating, reason }.',
      '- Use 24-hour "HH:MM" strings for start and end in the station local timezone (e.g. "08:30", "11:15").',
      '- rating must be exactly "Good", "Caution", or "Avoid".',
      '- Prefer "Good" windows around slack water near high or low tide when currents are slowest.',
      '- Prefer "Caution" or "Avoid" during peak mid-tide flood/ebb transitions or extreme low water.',
      '- Keep each reason to ONE plain-English sentence explaining the dock decision for beginners.',
    ]
      .filter(Boolean)
      .join('\n');

    const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    let rawText = '';

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction:
              'You are a coastal paddling safety planner. Always respond with valid JSON matching the requested schema. No markdown fences or extra commentary.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.STRING },
                  end: { type: Type.STRING },
                  rating: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['start', 'end', 'rating', 'reason'],
              },
            },
          },
        });
        rawText = response.text ?? '';
        if (rawText) break;
      } catch {
        // Try fallback model
      }
    }

    if (!rawText) {
      res.status(200).json(fallbackWindows(location, tz, tides));
      return;
    }

    const parsed = JSON.parse(stripJsonFences(rawText)) as LaunchWindowOutput[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      res.status(200).json(fallbackWindows(location, tz, tides));
      return;
    }

    const normalized = parsed.slice(0, 3).map((item) => ({
      start: String(item.start || '09:00').trim(),
      end: String(item.end || '12:00').trim(),
      rating:
        item.rating === 'Good' || item.rating === 'Caution' || item.rating === 'Avoid'
          ? item.rating
          : ('Caution' as const),
      reason: String(item.reason || 'Confirm local water conditions before launching.').trim(),
    }));

    res.status(200).json(normalized);
  } catch {
    res.status(200).json(fallbackWindows(location, tz, tides));
  }
}
