import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function safeParseJson<T>(raw: string): T {
  const cleaned = stripJsonFences(raw);
  return JSON.parse(cleaned) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('overloaded') ||
    msg.includes('high demand')
  );
}

async function generateContentWithRetry(
  params: Parameters<typeof ai.models.generateContent>[0]
) {
  const modelsToTry = [params.model, 'gemini-3.1-flash-lite'];
  let lastError: unknown;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          ...params,
          model: modelName,
        });
      } catch (err) {
        lastError = err;
        if (!isTransientError(err)) {
          throw err;
        }
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

interface TidePointInput {
  t?: string;
  time: string;
  height: number;
  type: 'H' | 'L';
}

interface LaunchWindowInput {
  start: string;
  end: string;
  rating: 'Good' | 'Caution' | 'Avoid';
  reason: string;
}

async function createServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/plan-windows', async (req, res) => {
    try {
      const { location, timezoneLabel, harborNote, tides } = req.body as {
        location: string;
        timezoneLabel: string;
        harborNote?: string;
        tides: TidePointInput[];
      };

      if (!location || !Array.isArray(tides) || tides.length === 0) {
        res.status(400).json({ error: 'Missing location or tide predictions.' });
        return;
      }

      const tideSummary = tides
        .map(
          (t) =>
            `${t.time} ${timezoneLabel || ''} — ${t.type === 'H' ? 'High' : 'Low'} tide (${t.height.toFixed(2)} m)`
        )
        .join('\n');

      const prompt = [
        `Location: ${location} (${timezoneLabel || 'local time'})`,
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

      const response = await generateContentWithRetry({
        model: 'gemini-4-hydrogen',
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
                start: {
                  type: Type.STRING,
                  description:
                    'Window start time in 24h HH:MM local station time, e.g. "08:30".',
                },
                end: {
                  type: Type.STRING,
                  description:
                    'Window end time in 24h HH:MM local station time, e.g. "11:15".',
                },
                rating: {
                  type: Type.STRING,
                  description: 'Exactly one of: Good, Caution, Avoid.',
                },
                reason: {
                  type: Type.STRING,
                  description:
                    'One plain-English sentence explaining the rating for beginners.',
                },
              },
              required: ['start', 'end', 'rating', 'reason'],
            },
          },
        },
      });

      const rawText = response.text ?? '[]';
      const parsed = safeParseJson<LaunchWindowInput[]>(rawText);

      if (!Array.isArray(parsed)) {
        res.status(502).json({ error: 'Gemini returned non-array window JSON.' });
        return;
      }

      const normalized = parsed.slice(0, 3).map((item) => ({
        start: String(item.start || '09:00').trim(),
        end: String(item.end || '12:00').trim(),
        rating:
          item.rating === 'Good' || item.rating === 'Caution' || item.rating === 'Avoid'
            ? item.rating
            : 'Caution',
        reason: String(
          item.reason || 'Confirm local water conditions before launching.'
        ).trim(),
      }));

      res.json(normalized);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to plan launch windows.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/write-messages', async (req, res) => {
    try {
      const { location, timezoneLabel, day, windows } = req.body as {
        location: string;
        timezoneLabel: string;
        day?: string;
        windows: LaunchWindowInput[];
      };

      if (!location || !Array.isArray(windows) || windows.length === 0) {
        res.status(400).json({ error: 'Missing location or launch windows.' });
        return;
      }

      const windowsSummary = windows
        .map(
          (w) =>
            `${w.start}–${w.end} ${timezoneLabel || ''}: ${w.rating} — ${w.reason}`
        )
        .join('\n');

      const prompt = [
        `Business: Bay Paddle Co. (${location}, ${timezoneLabel || 'local time'})`,
        `Forecast Day: ${day || 'Today'}`,
        'Planned Launch Windows:',
        windowsSummary,
        '',
        'Task: Write two short communications:',
        '1. staffBriefing: Under 80 words. Actionable morning dock briefing for staff & guides referencing the exact window times with timezone label and reminding staff to confirm on-water conditions.',
        '2. customerMessage: Friendly, under 50 words, suitable for SMS or Instagram, highlighting the calmest launch window times with timezone label.',
        'Return JSON ONLY: { "staffBriefing": "...", "customerMessage": "..." }.',
      ].join('\n');

      const response = await generateContentWithRetry({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You write concise operational dock briefings and warm customer messages for a kayak and paddleboard rental shop. Return valid JSON only.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              staffBriefing: {
                type: Type.STRING,
                description:
                  'Morning dock briefing for staff, strictly under 80 words.',
              },
              customerMessage: {
                type: Type.STRING,
                description:
                  'Friendly SMS or Instagram update for customers, strictly under 50 words.',
              },
            },
            required: ['staffBriefing', 'customerMessage'],
          },
        },
      });

      const rawText = response.text ?? '{}';
      const parsed = safeParseJson<{
        staffBriefing?: string;
        customerMessage?: string;
      }>(rawText);

      if (
        !parsed ||
        typeof parsed.staffBriefing !== 'string' ||
        typeof parsed.customerMessage !== 'string'
      ) {
        res.status(502).json({ error: 'Gemini returned incomplete message JSON.' });
        return;
      }

      res.json({
        staffBriefing: parsed.staffBriefing.trim(),
        customerMessage: parsed.customerMessage.trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to write messages.';
      res.status(500).json({ error: message });
    }
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Launch Window server listening on http://localhost:${PORT}`);
  });
}

createServer();
