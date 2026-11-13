export type LocationId = 'San Francisco' | 'San Diego' | 'Seattle' | 'New York';
export type DayChoice = 'Today' | 'Tomorrow';

export interface TidePoint {
  t: string; // Full NOAA timestamp e.g. "2026-11-12 03:18"
  time: string; // Local 24h HH:MM e.g. "03:18"
  height: number; // Meters MLLW (converted from NOAA string v)
  type: 'H' | 'L';
}

export interface StationMeta {
  id: LocationId;
  stationName: string;
  noaaStationId: string;
  ianaTimezone: string;
  timezoneLabel: 'PT' | 'ET';
  harborNote: string;
}

export const LOCATIONS: StationMeta[] = [
  {
    id: 'San Francisco',
    stationName: 'San Francisco Bay (Presidio)',
    noaaStationId: '9414290',
    ianaTimezone: 'America/Los_Angeles',
    timezoneLabel: 'PT',
    harborNote: 'Strong ebb currents near Golden Gate channel; sheltered cove inside Crissy Field.',
  },
  {
    id: 'San Diego',
    stationName: 'San Diego Bay (Mission Entrance)',
    noaaStationId: '9410170',
    ianaTimezone: 'America/Los_Angeles',
    timezoneLabel: 'PT',
    harborNote: 'Gentle inner-bay tidal exchange; afternoon sea breeze builds after 13:30 PT.',
  },
  {
    id: 'Seattle',
    stationName: 'Elliott Bay (Pier 52)',
    noaaStationId: '9447130',
    ianaTimezone: 'America/Los_Angeles',
    timezoneLabel: 'PT',
    harborNote: 'Large tidal swing exposes rocky shoreline at low tide; watch ferry wake midday.',
  },
  {
    id: 'New York',
    stationName: 'New York Harbor (The Battery)',
    noaaStationId: '8518750',
    ianaTimezone: 'America/New_York',
    timezoneLabel: 'ET',
    harborNote: 'Fast Hudson River ebb currents; slack water windows provide calmest beginner launches.',
  },
];

export function getStationById(stationId: string): StationMeta {
  return (
    LOCATIONS.find((l) => l.noaaStationId === stationId || l.id === stationId) ??
    LOCATIONS[0]
  );
}
