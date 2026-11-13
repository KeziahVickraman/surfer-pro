import {
  buildNoaaRequestUrl,
  DayChoice,
  LOCATIONS,
  LocationId,
  MOCK_TIDES,
  StationMeta,
  TidePoint,
} from '../data/mockTides';

export type WindowRating = 'Good' | 'Caution' | 'Avoid';

export interface LaunchWindow {
  id: string;
  timeRange: string;
  startHour: number; // 0 - 24 decimal for chart overlay
  endHour: number;
  rating: WindowRating;
  reason: string;
}

export interface TideResult {
  station: StationMeta;
  day: DayChoice;
  tides: TidePoint[];
  requestUrl: string;
}

export interface MessagesResult {
  staffBriefing: string;
  customerMessage: string;
}

export class MockApiError extends Error {
  url: string;
  constructor(message: string, url: string) {
    super(message);
    this.name = 'MockApiError';
    this.url = url;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseHour(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr} ${suffix}`;
}

export async function getTides(
  location: LocationId,
  day: DayChoice,
  options?: { simulateError?: boolean }
): Promise<TideResult> {
  const requestUrl = buildNoaaRequestUrl(location, day);
  await delay(320);

  if (options?.simulateError) {
    throw new MockApiError(
      'Unable to reach NOAA Tides & Currents station feed (503 Service Temporarily Unavailable).',
      requestUrl
    );
  }

  const station = LOCATIONS.find((l) => l.id === location) ?? LOCATIONS[0];
  const tides = MOCK_TIDES[location][day];

  return {
    station,
    day,
    tides,
    requestUrl,
  };
}

export async function planWindows(
  location: LocationId,
  day: DayChoice,
  tides: TidePoint[]
): Promise<LaunchWindow[]> {
  await delay(260);
  const station = LOCATIONS.find((l) => l.id === location) ?? LOCATIONS[0];
  const tz = station.timezoneLabel;

  const lowTide = tides.find((t) => t.type === 'L') ?? tides[1];
  const afternoonHigh = tides.find((t) => t.type === 'H' && parseHour(t.time) >= 12) ?? tides[2];

  if (location === 'San Francisco') {
    if (day === 'Today') {
      return [
        {
          id: 'sf-1',
          timeRange: `08:30 – 11:15 ${tz}`,
          startHour: 8.5,
          endHour: 11.25,
          rating: 'Good',
          reason: `Slack water around ${formatTime12h(lowTide.time)} low tide (${lowTide.height} ft) keeps bay currents gentle for all skill levels.`,
        },
        {
          id: 'sf-2',
          timeRange: `11:30 – 14:30 ${tz}`,
          startHour: 11.5,
          endHour: 14.5,
          rating: 'Caution',
          reason: 'Incoming flood tide accelerates past 1.8 knots; keep beginners inside the sheltered cove.',
        },
        {
          id: 'sf-3',
          timeRange: `15:00 – 17:30 ${tz}`,
          startHour: 15.0,
          endHour: 17.5,
          rating: 'Avoid',
          reason: `Peak ${afternoonHigh.height} ft high tide collides with afternoon westerly gusts, creating choppy dock wake.`,
        },
      ];
    }
    return [
      {
        id: 'sf-tm-1',
        timeRange: `09:00 – 12:00 ${tz}`,
        startHour: 9.0,
        endHour: 12.0,
        rating: 'Good',
        reason: `Calm morning slack through ${formatTime12h(lowTide.time)} (${lowTide.height} ft); ideal for first-time SUP and tandem kayak tours.`,
      },
      {
        id: 'sf-tm-2',
        timeRange: `12:30 – 15:15 ${tz}`,
        startHour: 12.5,
        endHour: 15.25,
        rating: 'Caution',
        reason: 'Strong mid-flood pull toward inner bay; require guide escort beyond breakwater.',
      },
      {
        id: 'sf-tm-3',
        timeRange: `15:45 – 18:00 ${tz}`,
        startHour: 15.75,
        endHour: 18.0,
        rating: 'Good',
        reason: `Water levels stabilize near ${formatTime12h(afternoonHigh.time)} high tide (${afternoonHigh.height} ft) with smooth ramp access.`,
      },
    ];
  }

  if (location === 'San Diego') {
    return [
      {
        id: 'sd-1',
        timeRange: `08:00 – 11:30 ${tz}`,
        startHour: 8.0,
        endHour: 11.5,
        rating: 'Good',
        reason: `Glassy morning water through ${formatTime12h(lowTide.time)} low tide (${lowTide.height} ft) with minimal boat traffic.`,
      },
      {
        id: 'sd-2',
        timeRange: `12:00 – 14:45 ${tz}`,
        startHour: 12.0,
        endHour: 14.75,
        rating: 'Good',
        reason: 'Steady incoming tide keeps channel depth comfortable over sandbars for all paddleboards.',
      },
      {
        id: 'sd-3',
        timeRange: `15:00 – 17:30 ${tz}`,
        startHour: 15.0,
        endHour: 17.5,
        rating: 'Caution',
        reason: `High tide at ${formatTime12h(afternoonHigh.time)} (${afternoonHigh.height} ft) coincides with 12 kt thermal breeze; advise shorter loop.`,
      },
    ];
  }

  if (location === 'Seattle') {
    return [
      {
        id: 'sea-1',
        timeRange: `07:30 – 09:45 ${tz}`,
        startHour: 7.5,
        endHour: 9.75,
        rating: 'Good',
        reason: 'Ample water over pier pilings on gentle morning ebb; clean launch from main floating dock.',
      },
      {
        id: 'sea-2',
        timeRange: `10:00 – 12:30 ${tz}`,
        startHour: 10.0,
        endHour: 12.5,
        rating: 'Avoid',
        reason: `Extreme low tide (${lowTide.height} ft at ${formatTime12h(lowTide.time)}) exposes sharp barnacle rocks along shore launch.`,
      },
      {
        id: 'sea-3',
        timeRange: `14:00 – 17:15 ${tz}`,
        startHour: 14.0,
        endHour: 17.25,
        rating: 'Caution',
        reason: `Rapid flood back toward ${afternoonHigh.height} ft high tide; brief dock hands on steep ramp angles.`,
      },
    ];
  }

  // New York
  return [
    {
      id: 'ny-1',
      timeRange: `08:00 – 10:30 ${tz}`,
      startHour: 8.0,
      endHour: 10.5,
      rating: 'Avoid',
      reason: 'Fast mid-ebb Hudson River current exceeds 2.5 knots; suspend beginner unguided rentals.',
    },
    {
      id: 'ny-2',
      timeRange: `10:45 – 13:15 ${tz}`,
      startHour: 10.75,
      endHour: 13.25,
      rating: 'Good',
      reason: `Slack water around ${formatTime12h(lowTide.time)} low tide (${lowTide.height} ft) creates the calmest crossing window of the day.`,
    },
    {
      id: 'ny-3',
      timeRange: `13:45 – 16:45 ${tz}`,
      startHour: 13.75,
      endHour: 16.75,
      rating: 'Caution',
      reason: `Building flood current toward ${formatTime12h(afternoonHigh.time)} (${afternoonHigh.height} ft); keep groups north of ferry lane.`,
    },
  ];
}

export async function writeMessages(
  location: LocationId,
  day: DayChoice,
  windows: LaunchWindow[],
  tides: TidePoint[]
): Promise<MessagesResult> {
  await delay(240);
  const station = LOCATIONS.find((l) => l.id === location) ?? LOCATIONS[0];
  const goodWindows = windows.filter((w) => w.rating === 'Good');
  const avoidWindows = windows.filter((w) => w.rating === 'Avoid');
  const cautionWindows = windows.filter((w) => w.rating === 'Caution');

  const bestWindow = goodWindows[0] ?? windows[0];
  const lowTide = tides.find((t) => t.type === 'L') ?? tides[1];
  const highTide = tides.find((t) => t.type === 'H' && parseHour(t.time) >= 12) ?? tides[2];

  const dayWord = day === 'Today' ? 'today' : 'tomorrow';
  const dayCap = day === 'Today' ? 'Today' : 'Tomorrow';

  const cautionNote =
    cautionWindows.length > 0
      ? `During ${cautionWindows[0].timeRange}, keep first-time paddlers inside the sheltered zone and double-check PFD fit at the dock.`
      : 'All open windows show smooth water conditions.';

  const avoidNote =
    avoidWindows.length > 0
      ? `Hold unguided launches during ${avoidWindows[0].timeRange} (${avoidWindows[0].reason.toLowerCase()}).`
      : 'No full launch holds scheduled.';

  const staffBriefing = [
    `${dayCap}'s Dock Plan — ${station.stationName} (${station.timezoneLabel}):`,
    `• Best launch window: ${bestWindow.timeRange} (${bestWindow.rating}).`,
    `• Key tide turns: Low ${lowTide.height} ft at ${formatTime12h(lowTide.time)} ${station.timezoneLabel} / High ${highTide.height} ft at ${formatTime12h(highTide.time)} ${station.timezoneLabel}.`,
    `• Dock guidance: ${avoidNote} ${cautionNote}`,
  ].join('\n');

  const customerMessage =
    goodWindows.length > 0
      ? `Hey paddlers! 🌊 Planning to get on the water ${dayWord} at ${location}? Our calmest kayak & paddleboard launch window is ${goodWindows.map((w) => w.timeRange).join(' and ')} — smooth slack tide and easy dock entry. Reply or book online to grab your board before spots fill up!`
      : `Good morning from Bay Paddle Co.! Today's tide in ${location} is moving quickly, so we're running guided small-group launches during ${windows[0].timeRange}. Stop by the dock or text us back and we'll get you fitted safely!`;

  return {
    staffBriefing,
    customerMessage,
  };
}
