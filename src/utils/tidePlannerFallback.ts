import { DayChoice, StationMeta, TidePoint } from '../data/stations';

export interface RawPlannedWindow {
  start: string;
  end: string;
  rating: 'Good' | 'Caution' | 'Avoid';
  reason: string;
}

function parseHour(time: string): number {
  const part = time.includes(' ') ? time.split(' ').pop() ?? time : time;
  const [h, m] = part.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 12;
  return h + m / 60;
}

function roundQuarterHour(hourDecimal: number): number {
  return Math.round(hourDecimal * 4) / 4;
}

function formatHHMM(hourDecimal: number): string {
  const clamped = Math.max(0, Math.min(23.75, roundQuarterHour(hourDecimal)));
  const totalMinutes = Math.round(clamped * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

/**
 * Computes 2-3 daylight launch windows directly from live NOAA high/low tide predictions.
 * Used as a resilient fallback when deployed to a static-only host (where /api/* returns 404)
 * or when GEMINI_API_KEY is not configured on an external host.
 */
export function computeFallbackWindowsFromTides(
  station: Pick<StationMeta, 'id' | 'timezoneLabel'>,
  tides: TidePoint[]
): RawPlannedWindow[] {
  const tz = station.timezoneLabel;
  const sorted = [...tides]
    .map((t) => ({ ...t, hour: parseHour(t.time) }))
    .sort((a, b) => a.hour - b.hour);

  const candidates: Array<RawPlannedWindow & { sortHour: number }> = [];

  // 1. Evaluate daylight slack-water periods around High and Low tide turns (06:00 - 19:30)
  for (const tide of sorted) {
    if (tide.hour < 6.0 || tide.hour > 19.25) continue;

    const startH = Math.max(7.0, roundQuarterHour(tide.hour - 1.0));
    const endH = Math.min(19.0, roundQuarterHour(tide.hour + 1.25));
    if (endH - startH < 1.25) continue;

    const tideTimeLabel = `${format12h(tide.time)} ${tz}`;
    const heightLabel = `${tide.height.toFixed(2)} m`;

    if (tide.type === 'L' && tide.height < -0.15) {
      candidates.push({
        sortHour: startH,
        start: formatHHMM(startH),
        end: formatHHMM(endH),
        rating: 'Avoid',
        reason: `Negative low tide (${heightLabel} at ${tideTimeLabel}) exposes shallow shore hazards and steep dock ramps for beginners.`,
      });
    } else if (tide.type === 'L' && tide.height < 0.3) {
      candidates.push({
        sortHour: startH,
        start: formatHHMM(startH),
        end: formatHHMM(endH),
        rating: 'Caution',
        reason: `Currents ease near the ${tideTimeLabel} low tide (${heightLabel}), but shallow water near the ramp requires careful entry.`,
      });
    } else {
      const turnWord = tide.type === 'H' ? 'high tide' : 'low tide';
      candidates.push({
        sortHour: startH,
        start: formatHHMM(startH),
        end: formatHHMM(endH),
        rating: 'Good',
        reason: `Slack water around the ${tideTimeLabel} ${turnWord} (${heightLabel}) offers the slowest currents and easiest paddling for beginners.`,
      });
    }
  }

  // 2. Evaluate mid-tide flood/ebb transitions during daylight hours
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const transitionStart = Math.max(7.0, roundQuarterHour(a.hour + 1.5));
    const transitionEnd = Math.min(19.0, roundQuarterHour(b.hour - 1.25));

    if (transitionEnd - transitionStart >= 1.5) {
      const swing = Math.abs(b.height - a.height);
      const direction = b.height > a.height ? 'incoming flood' : 'outgoing ebb';
      const rating: 'Caution' | 'Avoid' = swing >= 2.2 ? 'Avoid' : 'Caution';

      const reason =
        rating === 'Avoid'
          ? `Steep ${direction} tide (${swing.toFixed(1)} m change toward ${format12h(b.time)} ${tz}) drives strong currents; hold unguided launches.`
          : `Active ${direction} current builds between ${format12h(a.time)} and ${format12h(b.time)} ${tz}; keep beginners in sheltered water.`;

      candidates.push({
        sortHour: transitionStart,
        start: formatHHMM(transitionStart),
        end: formatHHMM(transitionEnd),
        rating,
        reason,
      });
    }
  }

  // Sort chronologically and remove overlaps
  candidates.sort((a, b) => a.sortHour - b.sortHour);
  const nonOverlapping: Array<RawPlannedWindow & { sortHour: number; endHour: number }> = [];

  for (const c of candidates) {
    const cEnd = parseHour(c.end);
    const prev = nonOverlapping[nonOverlapping.length - 1];
    if (!prev || c.sortHour >= prev.endHour) {
      nonOverlapping.push({ ...c, endHour: cEnd });
    }
  }

  // Ensure at least 2 windows in daylight even if tides occurred just outside 06:00-19:30
  if (nonOverlapping.length < 2) {
    return [
      {
        start: '08:30',
        end: '11:00',
        rating: 'Good',
        reason: `Morning water conditions in ${station.id} provide gentle tidal flow suitable for beginner kayak and SUP launches.`,
      },
      {
        start: '12:00',
        end: '15:00',
        rating: 'Caution',
        reason: `Midday tidal exchange increases channel drift; keep unguided renters within sight of the main dock.`,
      },
    ];
  }

  return nonOverlapping.slice(0, 3).map(({ start, end, rating, reason }) => ({
    start,
    end,
    rating,
    reason,
  }));
}

export function composeFallbackMessages(
  station: Pick<StationMeta, 'id' | 'timezoneLabel'>,
  windows: RawPlannedWindow[],
  day: DayChoice = 'Today'
): { staffBriefing: string; customerMessage: string } {
  const tz = station.timezoneLabel;
  const good = windows.filter((w) => w.rating === 'Good');
  const caution = windows.filter((w) => w.rating === 'Caution');
  const avoid = windows.filter((w) => w.rating === 'Avoid');

  const dayLabel = day === 'Tomorrow' ? 'Tomorrow' : 'Today';

  const parts: string[] = [`Bay Paddle Co. (${station.id}) ${dayLabel.toLowerCase()} briefing:`];
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

  const primaryGood = good[0] ?? windows[0];
  const bestRange = `${format12h(primaryGood.start)}–${format12h(primaryGood.end)} ${tz}`;

  const customerMessage =
    good.length > 0
      ? `Planning to paddle in ${station.id} ${dayLabel.toLowerCase()}? Our calmest slack-tide window is ${bestRange} — smooth water and easy dock launch for kayaks & paddleboards. Book online or reply to reserve your gear!`
      : `Bay Paddle Co. ${station.id} update: ${dayLabel}'s tides are moving briskly, so we're running guided sheltered-cove launches from ${bestRange}. Reply or stop by the dock to join!`;

  return {
    staffBriefing: parts.join(' '),
    customerMessage,
  };
}
