export type LocationId = 'San Francisco' | 'San Diego' | 'Seattle' | 'New York';
export type DayChoice = 'Today' | 'Tomorrow';

export interface TidePoint {
  time: string; // 24-hour local time HH:MM e.g. "06:15"
  height: number; // feet MLLW
  type: 'H' | 'L';
}

export interface StationMeta {
  id: LocationId;
  stationName: string;
  noaaStationId: string;
  timezoneLabel: 'PT' | 'ET';
  harborNote: string;
}

export const LOCATIONS: StationMeta[] = [
  {
    id: 'San Francisco',
    stationName: 'San Francisco Bay (Presidio)',
    noaaStationId: '9414290',
    timezoneLabel: 'PT',
    harborNote: 'Strong ebb currents near Golden Gate channel; sheltered cove inside Crissy Field.',
  },
  {
    id: 'San Diego',
    stationName: 'San Diego Bay (Mission Entrance)',
    noaaStationId: '9410170',
    timezoneLabel: 'PT',
    harborNote: 'Gentle inner-bay tidal exchange; afternoon sea breeze builds after 13:30 PT.',
  },
  {
    id: 'Seattle',
    stationName: 'Elliott Bay (Pier 52)',
    noaaStationId: '9447130',
    timezoneLabel: 'PT',
    harborNote: 'Large tidal swing exposes rocky shoreline below 1.5 ft; watch ferry wake midday.',
  },
  {
    id: 'New York',
    stationName: 'New York Harbor (The Battery)',
    noaaStationId: '8518750',
    timezoneLabel: 'ET',
    harborNote: 'Fast Hudson River ebb currents; slack water windows provide calmest beginner launches.',
  },
];

// Mock tide data strictly shaped as [{ time, height, type }] where type is "H" or "L"
export const MOCK_TIDES: Record<LocationId, Record<DayChoice, TidePoint[]>> = {
  'San Francisco': {
    Today: [
      { time: '03:18', height: 5.7, type: 'H' },
      { time: '09:42', height: 0.8, type: 'L' },
      { time: '16:05', height: 6.1, type: 'H' },
      { time: '22:14', height: 1.4, type: 'L' },
    ],
    Tomorrow: [
      { time: '04:05', height: 5.9, type: 'H' },
      { time: '10:28', height: 0.5, type: 'L' },
      { time: '16:52', height: 6.3, type: 'H' },
      { time: '23:02', height: 1.2, type: 'L' },
    ],
  },
  'San Diego': {
    Today: [
      { time: '02:45', height: 5.2, type: 'H' },
      { time: '08:54', height: 1.1, type: 'L' },
      { time: '15:10', height: 5.6, type: 'H' },
      { time: '21:30', height: 1.6, type: 'L' },
    ],
    Tomorrow: [
      { time: '03:32', height: 5.4, type: 'H' },
      { time: '09:40', height: 0.9, type: 'L' },
      { time: '15:58', height: 5.8, type: 'H' },
      { time: '22:18', height: 1.3, type: 'L' },
    ],
  },
  Seattle: {
    Today: [
      { time: '04:12', height: 11.2, type: 'H' },
      { time: '10:36', height: 1.4, type: 'L' },
      { time: '17:04', height: 10.6, type: 'H' },
      { time: '23:15', height: 3.1, type: 'L' },
    ],
    Tomorrow: [
      { time: '05:02', height: 11.5, type: 'H' },
      { time: '11:24', height: 0.8, type: 'L' },
      { time: '17:55', height: 10.9, type: 'H' },
      { time: '23:58', height: 2.7, type: 'L' },
    ],
  },
  'New York': {
    Today: [
      { time: '05:30', height: 4.8, type: 'H' },
      { time: '11:48', height: 0.4, type: 'L' },
      { time: '17:56', height: 5.1, type: 'H' },
      { time: '23:54', height: 0.7, type: 'L' },
    ],
    Tomorrow: [
      { time: '06:18', height: 5.0, type: 'H' },
      { time: '12:34', height: 0.3, type: 'L' },
      { time: '18:45', height: 5.3, type: 'H' },
      { time: '23:59', height: 0.9, type: 'L' },
    ],
  },
};

export function buildNoaaRequestUrl(location: LocationId, day: DayChoice): string {
  const station = LOCATIONS.find((l) => l.id === location) ?? LOCATIONS[0];
  const dateStr = day === 'Today' ? 'today' : 'tomorrow';
  return `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${station.noaaStationId}&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json&range=24&date=${dateStr}`;
}
