import React, { useState } from 'react';
import { ArrowRight, Compass, MessageSquareText, Waves } from 'lucide-react';
import coastalDockImg from '../assets/images/coastal_kayak_dock_1794549515364.jpg';

interface ProductTabProps {
  onStartTrial: () => void;
  onViewPricing: () => void;
}

const BENEFITS = [
  {
    number: '01',
    title: 'Tide-based launch windows',
    description:
      'Turns daily high and low tide tables into clear Good, Caution, and Avoid launch periods tailored to beginner and guided paddle routes.',
  },
  {
    number: '02',
    title: 'Morning staff briefing',
    description:
      'Produces a concise 30-second dock plan each morning with key tide turn times, ramp advisories, and safety notes ready to copy.',
  },
  {
    number: '03',
    title: 'Customer-ready updates',
    description:
      'Writes warm, plain-language SMS and Instagram updates pointing guests toward the calmest water hours of the day.',
  },
];

export const ProductTab: React.FC<ProductTabProps> = ({
  onStartTrial,
  onViewPricing,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="space-y-16">
      {/* Hero Split Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch pt-4">
        <div className="lg:col-span-7 flex flex-col justify-center">
          <p className="text-sm font-medium text-sky-700 tracking-tight mb-4">
            Built for kayak, paddleboard, and boat-rental operators
          </p>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.35rem] font-extrabold text-slate-900 tracking-tight leading-[1.08] text-balance">
            Plan today&apos;s safe launch windows in one click.
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
            Every morning, Launch Window translates public NOAA tide tables into
            rated launch hours, a staff dock briefing, and customer updates—so your
            crew opens safely and guests paddle in calmer water.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStartTrial}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-sky-700 text-white text-base font-semibold hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Start free trial
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onViewPricing}
              className="inline-flex items-center px-5 py-3.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-base font-semibold hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              View pricing
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            <span>Public-domain NOAA tide stations</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>No hardware sensors required</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>Ready in under 10 seconds</span>
          </div>
        </div>

        <div className="lg:col-span-5 flex">
          <div className="w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative min-h-[280px] lg:min-h-[380px]">
            {!imgFailed ? (
              <img
                src={coastalDockImg}
                alt="Touring kayaks and stand-up paddleboards lined up along a cedar dock on calm morning bay water"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-sky-50 to-slate-100 text-slate-700">
                <Waves className="w-12 h-12 text-sky-700 mb-3" />
                <p className="text-base font-semibold">Morning Dock Operations</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Three Benefit Cards */}
      <section aria-labelledby="benefits-heading" className="pt-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h2
              id="benefits-heading"
              className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight"
            >
              From raw tide numbers to daily dock decisions
            </h2>
            <p className="mt-2 text-base sm:text-lg text-slate-600 max-w-2xl">
              Built for busy rental counters where dock hands and guests need clear
              answers, not marine spreadsheets.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BENEFITS.map((benefit) => (
            <article
              key={benefit.number}
              className="bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="text-sm font-mono font-semibold text-sky-700 tabular-nums mb-3">
                  {benefit.number}.
                </div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  {benefit.title}
                </h3>
                <p className="mt-3 text-base text-slate-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Clean Value Chain Strip (great for classroom business walkthrough) */}
      <section className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <div className="pt-2 md:pt-0 md:pr-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Waves className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
              Free Public Data Input
            </div>
            <p className="mt-2 text-base text-slate-600">
              Pulls official local high and low tide predictions directly from
              NOAA coastal stations.
            </p>
          </div>

          <div className="pt-6 md:pt-0 md:px-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Compass className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
              Operational Planning Logic
            </div>
            <p className="mt-2 text-base text-slate-600">
              Evaluates slack water, flood/ebb speed, and ramp depth into simple
              green, amber, and red windows.
            </p>
          </div>

          <div className="pt-6 md:pt-0 md:pl-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquareText
                className="w-4 h-4 text-sky-700 shrink-0"
                aria-hidden="true"
              />
              Ready-to-Send Output
            </div>
            <p className="mt-2 text-base text-slate-600">
              Delivers one-click staff briefings and customer updates that reduce
              cancellations and dock bottlenecks.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
