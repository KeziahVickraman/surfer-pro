import React, { useState } from 'react';
import { StationMeta, TidePoint } from '../data/stations';
import { formatTime12h, LaunchWindow, WindowRating } from '../services/launchService';

interface TideTimelineChartProps {
  tides: TidePoint[];
  windows: LaunchWindow[];
  station: StationMeta;
}

function parseHour(time: string): number {
  const timePart = time.includes(' ') ? time.split(' ')[1] : time;
  const [h, m] = timePart.split(':').map(Number);
  return h + m / 60;
}

// Smooth cosine interpolation across a 24-hour tidal cycle
function interpolateTideHeight(hour: number, tides: TidePoint[]): number {
  if (tides.length === 0) return 0;

  const points = tides.map((t) => ({ hour: parseHour(t.time), height: t.height, type: t.type }));

  const first = points[0];
  const second = points[1] ?? first;
  const last = points[points.length - 1];
  const prevToLast = points[points.length - 2] ?? last;

  const extended = [
    { hour: first.hour - 6.2, height: second.height },
    ...points.map((p) => ({ hour: p.hour, height: p.height })),
    { hour: last.hour + 6.2, height: prevToLast.height },
  ];

  for (let i = 0; i < extended.length - 1; i++) {
    const a = extended[i];
    const b = extended[i + 1];
    if (hour >= a.hour && hour <= b.hour) {
      const span = b.hour - a.hour || 1;
      const t = (hour - a.hour) / span;
      const mu = (1 - Math.cos(t * Math.PI)) / 2;
      return a.height * (1 - mu) + b.height * mu;
    }
  }

  return first.height;
}

const RATING_BAND_STYLE: Record<WindowRating, { fill: string; text: string; label: string }> = {
  Good: { fill: 'rgba(22, 163, 74, 0.11)', text: '#15803D', label: 'Good' },
  Caution: { fill: 'rgba(217, 119, 6, 0.12)', text: '#B45309', label: 'Caution' },
  Avoid: { fill: 'rgba(220, 38, 38, 0.11)', text: '#B91C1C', label: 'Avoid' },
};

export const TideTimelineChart: React.FC<TideTimelineChartProps> = ({
  tides,
  windows,
  station,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 960;
  const height = 270;
  const padLeft = 54;
  const padRight = 28;
  const padTop = 44;
  const padBottom = 46;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const heights = tides.map((t) => t.height);
  const rawMin = Math.min(...heights, 0);
  const rawMax = Math.max(...heights, 2);
  const yMin = Math.floor(rawMin);
  const yMax = Math.ceil(rawMax + 0.4);
  const ySpan = Math.max(yMax - yMin, 1);

  const xForHour = (h: number) => padLeft + (h / 24) * chartW;
  const yForHeight = (mVal: number) => padTop + chartH - ((mVal - yMin) / ySpan) * chartH;

  // Sample 96 points (every 15 min) for a smooth SVG spline path
  const sampleCount = 96;
  const curveCoords: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= sampleCount; i++) {
    const hr = (i / sampleCount) * 24;
    const val = interpolateTideHeight(hr, tides);
    curveCoords.push({ x: xForHour(hr), y: yForHeight(val) });
  }

  const linePath = curveCoords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${xForHour(24).toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${xForHour(0).toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;

  const xTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const yTickStep = ySpan > 5 ? 2 : 1;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v += yTickStep) {
    yTicks.push(v);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            24-Hour Tide Timeline
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {station.stationName} · Station {station.noaaStationId} · Local time ({station.timezoneLabel})
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600/25 border border-emerald-600 inline-block" />
            Good
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-600/25 border border-amber-600 inline-block" />
            Caution
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600/25 border border-red-600 inline-block" />
            Avoid
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[640px] h-auto select-none"
          role="img"
          aria-label={`Horizontal tide timeline for ${station.stationName} in ${station.timezoneLabel}`}
        >
          <defs>
            <linearGradient id="tideAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284C7" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines */}
          {yTicks.map((tick) => {
            const y = yForHeight(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px] font-mono tabular-nums"
                >
                  {tick} m
                </text>
              </g>
            );
          })}

          {/* Launch window vertical bands */}
          {windows.map((win) => {
            const x1 = xForHour(win.startHour);
            const x2 = xForHour(win.endHour);
            const bandW = Math.max(x2 - x1, 0);
            const style = RATING_BAND_STYLE[win.rating];
            return (
              <g key={win.id}>
                <rect
                  x={x1}
                  y={padTop}
                  width={bandW}
                  height={chartH}
                  fill={style.fill}
                  rx="4"
                />
                <text
                  x={x1 + bandW / 2}
                  y={padTop - 10}
                  textAnchor="middle"
                  fill={style.text}
                  className="text-[11px] font-semibold"
                >
                  {style.label}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={width - padRight}
            y2={padTop + chartH}
            stroke="#CBD5E1"
            strokeWidth="1.5"
          />

          {/* Tide area + curve */}
          <path d={areaPath} fill="url(#tideAreaGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="#0369A1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-axis time ticks */}
          {xTicks.map((hr) => {
            const x = xForHour(hr);
            const label =
              hr === 0 || hr === 24
                ? '12a'
                : hr === 12
                ? '12p'
                : hr < 12
                ? `${hr}a`
                : `${hr - 12}p`;
            return (
              <g key={hr}>
                <line
                  x1={x}
                  y1={padTop + chartH}
                  x2={x}
                  y2={padTop + chartH + 5}
                  stroke="#94A3B8"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padTop + chartH + 22}
                  textAnchor="middle"
                  className="fill-slate-600 text-[12px] font-mono tabular-nums"
                >
                  {label}
                </text>
              </g>
            );
          })}

          <text
            x={width - padRight}
            y={padTop + chartH + 39}
            textAnchor="end"
            className="fill-slate-500 text-[11px] font-medium"
          >
            All times in {station.timezoneLabel}
          </text>

          {/* High / Low inflection markers */}
          {tides.map((tide, idx) => {
            const hr = parseHour(tide.time);
            const cx = xForHour(hr);
            const cy = yForHeight(tide.height);
            const isHigh = tide.type === 'H';
            const isHovered = hoveredIndex === idx;
            const labelY = isHigh ? cy - 14 : cy + 20;

            return (
              <g
                key={`${tide.time}-${tide.type}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 8 : 6}
                  fill={isHigh ? '#0369A1' : '#0F172A'}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                />
                <text
                  x={cx}
                  y={labelY}
                  textAnchor="middle"
                  className="fill-slate-900 text-[12px] font-semibold font-mono tabular-nums"
                >
                  {tide.type} {tide.height.toFixed(2)}m
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Projector-friendly high/low summary strip */}
      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tides.map((tide, idx) => {
          const isHigh = tide.type === 'H';
          return (
            <div
              key={`${tide.time}-${idx}`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`px-3.5 py-2.5 rounded-lg border transition-colors ${
                hoveredIndex === idx
                  ? 'border-sky-300 bg-sky-50/70'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="text-xs font-medium text-slate-500">
                {isHigh ? 'High Tide' : 'Low Tide'}
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="text-base font-bold text-slate-900 tabular-nums">
                  {formatTime12h(tide.time)} {station.timezoneLabel}
                </span>
                <span className="text-sm font-mono font-semibold text-sky-700 tabular-nums">
                  {tide.height.toFixed(2)} m
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
