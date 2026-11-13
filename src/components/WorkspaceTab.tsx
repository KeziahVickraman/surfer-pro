import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  MapPin,
  OctagonAlert,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { DayChoice, LOCATIONS, LocationId } from '../data/mockTides';
import {
  getTides,
  LaunchWindow,
  MessagesResult,
  MockApiError,
  planWindows,
  TideResult,
  WindowRating,
  writeMessages,
} from '../services/launchService';
import { TideTimelineChart } from './TideTimelineChart';

interface WorkspaceTabProps {
  selectedPlanName: string;
}

const RATING_STYLE: Record<
  WindowRating,
  {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    cardBorder: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  Good: {
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    cardBorder: 'border-slate-200',
    Icon: CheckCircle2,
  },
  Caution: {
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    cardBorder: 'border-slate-200',
    Icon: ShieldAlert,
  },
  Avoid: {
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-200',
    cardBorder: 'border-slate-200',
    Icon: OctagonAlert,
  },
};

export const WorkspaceTab: React.FC<WorkspaceTabProps> = ({ selectedPlanName }) => {
  const [location, setLocation] = useState<LocationId>('San Francisco');
  const [day, setDay] = useState<DayChoice>('Today');
  const [simulateError, setSimulateError] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<{ message: string; url: string } | null>(null);

  const [tideData, setTideData] = useState<TideResult | null>(null);
  const [windows, setWindows] = useState<LaunchWindow[]>([]);
  const [messages, setMessages] = useState<MessagesResult | null>(null);

  const [copiedBriefing, setCopiedBriefing] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);

  const runPlan = useCallback(
    async (
      targetLocation: LocationId,
      targetDay: DayChoice,
      shouldFail: boolean
    ) => {
      setIsLoading(true);
      setErrorState(null);

      try {
        const tidesResult = await getTides(targetLocation, targetDay, {
          simulateError: shouldFail,
        });
        const plannedWindows = await planWindows(
          targetLocation,
          targetDay,
          tidesResult.tides
        );
        const generatedMessages = await writeMessages(
          targetLocation,
          targetDay,
          plannedWindows,
          tidesResult.tides
        );

        setTideData(tidesResult);
        setWindows(plannedWindows);
        setMessages(generatedMessages);
      } catch (err) {
        if (err instanceof MockApiError) {
          setErrorState({ message: err.message, url: err.url });
        } else {
          setErrorState({
            message: 'Unexpected error generating daily launch plan.',
            url: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    runPlan(location, day, simulateError);
  }, [location, day, simulateError, runPlan]);

  const handleCopy = async (text: string, target: 'briefing' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback ignored in restricted iframe if clipboard API is blocked
    }
    if (target === 'briefing') {
      setCopiedBriefing(true);
      setTimeout(() => setCopiedBriefing(false), 2000);
    } else {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Top Bar */}
      <section className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Bay Paddle Co.
          </h1>
          <span aria-hidden="true" className="text-slate-300 text-lg">
            ·
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-sky-200 bg-sky-50 text-sky-800 text-xs font-semibold whitespace-nowrap shrink-0">
            {selectedPlanName}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="location-select" className="sr-only">
            Harbor location
          </label>
          <div className="relative flex items-center">
            <MapPin
              className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="location-select"
              value={location}
              onChange={(e) => setLocation(e.target.value as LocationId)}
              className="pl-9 pr-8 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm sm:text-base font-medium hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-sky-700 cursor-pointer"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.id} ({loc.timezoneLabel})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSimulateError((prev) => !prev)}
            aria-pressed={simulateError}
            className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              simulateError
                ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {simulateError ? 'Error mode: On' : 'Simulate error'}
          </button>
        </div>
      </section>

      {/* Date Toggle & Plan My Day Controls */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div
          className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg self-start"
          role="group"
          aria-label="Select forecast day"
        >
          {(['Today', 'Tomorrow'] as DayChoice[]).map((choice) => {
            const active = day === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => setDay(choice)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm sm:text-base font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-4 h-4" aria-hidden="true" />
                {choice}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => runPlan(location, day, simulateError)}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-lg bg-sky-700 text-white text-base font-semibold hover:bg-sky-800 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          )}
          Plan my day
        </button>
      </section>

      {/* Error Banner State */}
      {errorState && !isLoading && (
        <section
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="w-5 h-5 text-red-700 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-lg font-bold text-red-900">
                  Could not load tide forecast
                </h2>
                <p className="mt-1 text-base text-red-800">{errorState.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSimulateError(false);
                runPlan(location, day, false);
              }}
              className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Retry connection
            </button>
          </div>
          <div className="bg-white/90 border border-red-200 rounded-lg px-4 py-2.5 text-xs sm:text-sm font-mono text-red-900 break-all">
            URL called: {errorState.url}
          </div>
        </section>
      )}

      {/* Loading Spinner State */}
      {isLoading && (
        <section
          aria-live="polite"
          className="bg-white border border-slate-200 rounded-xl py-20 px-6 flex flex-col items-center justify-center text-center"
        >
          <Loader2
            className="w-9 h-9 text-sky-700 animate-spin mb-4"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold text-slate-900">
            Planning {day.toLowerCase()}&apos;s launch windows for {location}
          </h2>
          <p className="mt-1.5 text-base text-slate-600">
            Reading high &amp; low tide turns and drafting dock briefings...
          </p>
        </section>
      )}

      {/* Populated Workspace State */}
      {!isLoading && !errorState && tideData && messages && (
        <div className="space-y-6">
          {/* Tide Timeline */}
          <TideTimelineChart
            tides={tideData.tides}
            windows={windows}
            station={tideData.station}
          />

          {/* Launch Windows Cards */}
          <section aria-labelledby="windows-heading">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-4">
              <h2
                id="windows-heading"
                className="text-xl font-bold text-slate-900 tracking-tight"
              >
                Recommended Launch Windows
              </h2>
              <p className="text-sm text-slate-600">{tideData.station.harborNote}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {windows.map((win) => {
                const style = RATING_STYLE[win.rating];
                const RatingIcon = style.Icon;
                return (
                  <article
                    key={win.id}
                    className={`bg-white border ${style.cardBorder} rounded-xl p-6 flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                          {win.timeRange}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm font-semibold whitespace-nowrap shrink-0 ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                        >
                          <RatingIcon className="w-4 h-4" aria-hidden="true" />
                          {win.rating}
                        </span>
                      </div>
                      <p className="text-base text-slate-700 leading-relaxed">
                        {win.reason}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Staff Briefing & Customer Message Panels */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Staff Briefing Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      Morning Staff Briefing
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      For dock team &amp; tour guides
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(messages.staffBriefing, 'briefing')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedBriefing ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        Copy briefing
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-base text-slate-800 leading-relaxed whitespace-pre-line">
                  {messages.staffBriefing}
                </div>
              </div>
            </div>

            {/* Customer Message Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      Customer-Ready Update
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Ready for SMS reminder or Instagram story
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(messages.customerMessage, 'message')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedMessage ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        Copy message
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-sky-50/60 border border-sky-200 rounded-lg p-5 text-base text-slate-800 leading-relaxed">
                  {messages.customerMessage}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
