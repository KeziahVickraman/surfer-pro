import React from 'react';
import { ArrowRight, Check } from 'lucide-react';

interface PricingTabProps {
  activePlanName: string;
  onSelectPlan: (planLabel: string) => void;
}

interface PricingTier {
  id: string;
  name: string;
  planLabel: string;
  price: string;
  summary: string;
  popular?: boolean;
  audience: string;
  limits: string[];
  ctaText: string;
}

const TIERS: PricingTier[] = [
  {
    id: 'single',
    name: 'Single Spot',
    planLabel: 'Single Spot plan',
    price: '$19',
    summary: '1 location',
    audience: 'For solo beach kiosks & single-dock outfitters',
    limits: [
      '1 NOAA tide station connected',
      'Daily 24-hour horizontal tide timeline',
      'Automated Good / Caution / Avoid launch windows',
      'Today & tomorrow morning planning',
    ],
    ctaText: 'Start with Single Spot',
  },
  {
    id: 'pro',
    name: 'Pro',
    planLabel: 'Pro plan',
    price: '$49',
    summary: '3 locations, staff briefing + customer messages',
    popular: true,
    audience: 'Most popular · For active kayak, SUP & boat rentals',
    limits: [
      'Up to 3 harbor or bay locations',
      'Daily 24-hour horizontal tide timeline & ratings',
      'Morning staff briefing with one-click copy',
      'Customer-ready SMS & Instagram updates',
    ],
    ctaText: 'Start free trial on Pro',
  },
  {
    id: 'fleet',
    name: 'Fleet',
    planLabel: 'Fleet plan',
    price: '$149',
    summary: 'unlimited locations, for multi-site operators',
    audience: 'For regional outfitters & multi-harbor fleets',
    limits: [
      'Unlimited coastal locations & stations',
      'Team-wide morning briefings & custom dock notes',
      'Customer-ready updates across every site',
      'Priority support for peak summer season',
    ],
    ctaText: 'Choose Fleet',
  },
];

export const PricingTab: React.FC<PricingTabProps> = ({
  activePlanName,
  onSelectPlan,
}) => {
  return (
    <div className="space-y-12 pt-4">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-sky-700 mb-3">
          Simple monthly plans for seasonal and year-round operators
        </p>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight text-balance">
          Pricing built for independent water-rental teams.
        </h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">
          Start with a free trial in the Workspace. Switch locations or upgrade as
          you add docks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {TIERS.map((tier) => {
          const isCurrent = activePlanName === tier.planLabel;
          return (
            <article
              key={tier.id}
              className={`rounded-xl p-7 flex flex-col justify-between bg-white border transition-colors ${
                tier.popular
                  ? 'border-sky-600 ring-1 ring-sky-600'
                  : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {tier.name}
                  </h2>
                  {tier.popular && (
                    <span className="text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0">
                      Most popular
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm font-medium text-slate-600">
                  {tier.audience}
                </p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                    {tier.price}
                  </span>
                  <span className="text-base font-medium text-slate-500">
                    /month
                  </span>
                </div>

                <p className="mt-2 text-base font-semibold text-sky-800">
                  {tier.summary}
                </p>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <ul className="space-y-3.5">
                    {tier.limits.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-base text-slate-700"
                      >
                        <Check
                          className="w-5 h-5 text-sky-700 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectPlan(tier.planLabel)}
                  className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-base font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    tier.popular
                      ? 'bg-sky-700 text-white hover:bg-sky-800'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isCurrent ? 'Open in Workspace' : tier.ctaText}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
