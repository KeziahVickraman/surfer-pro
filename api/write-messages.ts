import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

interface LaunchWindowInput {
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
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
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

function fallbackMessages(
  location: string,
  tz: string,
  day: string,
  windows: LaunchWindowInput[]
): { staffBriefing: string; customerMessage: string } {
  const good = windows.filter((w) => w.rating === 'Good');
  const caution = windows.filter((w) => w.rating === 'Caution');
  const avoid = windows.filter((w) => w.rating === 'Avoid');
  const dayLabel = day === 'Tomorrow' ? 'Tomorrow' : 'Today';

  const parts: string[] = [`Bay Paddle Co. (${location}) ${dayLabel.toLowerCase()} briefing:`];
  if (good.length > 0) {
    parts.push(
      `Open all rentals ${good.map((w) => `${format12h(w.start)}–${format12h(w.end)} ${tz}`).join(' & ')} around slack water.`
    );
  }
  if (caution.length > 0) {
    parts.push(
      `Keep beginners sheltered ${caution.map((w) => `${format12h(w.start)}–${format12h(w.end)} ${tz}`).join(', ')}.`
    );
  }
  if (avoid.length > 0) {
    parts.push(
      `Hold unguided launches ${avoid.map((w) => `${format12h(w.start)}–${format12h(w.end)} ${tz}`).join(', ')}.`
    );
  }
  parts.push('Confirm live wind and on-water conditions before launch.');

  const primary = good[0] ?? windows[0];
  const bestRange = `${format12h(primary.start)}–${format12h(primary.end)} ${tz}`;

  const customerMessage =
    good.length > 0
      ? `Planning to paddle in ${location} ${dayLabel.toLowerCase()}? Our calmest slack-tide window is ${bestRange} — smooth water and easy dock launch for kayaks & paddleboards. Book online or reply to reserve your spot!`
      : `Bay Paddle Co. ${location} update: ${dayLabel}'s tides are moving briskly, so we're running guided sheltered-cove launches from ${bestRange}. Reply or stop by the dock to join!`;

  return {
    staffBriefing: parts.join(' '),
    customerMessage,
  };
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const parsedBody =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});

  const { location, timezoneLabel, day, windows } = parsedBody as {
    location?: string;
    timezoneLabel?: string;
    day?: string;
    windows?: LaunchWindowInput[];
  };

  if (!location || !Array.isArray(windows) || windows.length === 0) {
    res.status(400).json({ error: 'Missing location or launch windows.' });
    return;
  }

  const tz = timezoneLabel || 'PT';
  const dayStr = day || 'Today';

  if (!process.env.GEMINI_API_KEY) {
    res.status(200).json(fallbackMessages(location, tz, dayStr, windows));
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

    const windowsSummary = windows
      .map((w) => `${w.start}–${w.end} ${tz}: ${w.rating} — ${w.reason}`)
      .join('\n');

    const prompt = [
      `Business: Bay Paddle Co. (${location}, ${tz})`,
      `Forecast Day: ${dayStr}`,
      'Planned Launch Windows:',
      windowsSummary,
      '',
      'Task: Write two short communications:',
      '1. staffBriefing: Under 80 words. Actionable morning dock briefing for staff & guides referencing the exact window times with timezone label and reminding staff to confirm on-water conditions.',
      '2. customerMessage: Friendly, under 50 words, suitable for SMS or Instagram, highlighting the calmest launch window times with timezone label.',
      'Return JSON ONLY: { "staffBriefing": "...", "customerMessage": "..." }.',
    ].join('\n');

    const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    let rawText = '';

    for (const model of modelsToTry) {
      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction:
                'You write concise operational dock briefings and warm customer messages for a kayak and paddleboard rental shop. Return valid JSON only.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  staffBriefing: { type: Type.STRING },
                  customerMessage: { type: Type.STRING },
                },
                required: ['staffBriefing', 'customerMessage'],
              },
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini request timeout')), 7500)
          ),
        ]);
        rawText = response.text ?? '';
        if (rawText) break;
      } catch {
        // Try fallback model
      }
    }

    if (!rawText) {
      res.status(200).json(fallbackMessages(location, tz, dayStr, windows));
      return;
    }

    const parsed = JSON.parse(stripJsonFences(rawText)) as {
      staffBriefing?: string;
      customerMessage?: string;
    };

    if (typeof parsed.staffBriefing !== 'string' || typeof parsed.customerMessage !== 'string') {
      res.status(200).json(fallbackMessages(location, tz, dayStr, windows));
      return;
    }

    res.status(200).json({
      staffBriefing: parsed.staffBriefing.trim(),
      customerMessage: parsed.customerMessage.trim(),
    });
  } catch {
    res.status(200).json(fallbackMessages(location, tz, dayStr, windows));
  }
}
