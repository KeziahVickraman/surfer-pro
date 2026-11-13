import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ProductTab } from './components/ProductTab';
import { WorkspaceTab } from './components/WorkspaceTab';
import { PricingTab } from './components/PricingTab';

type TabId = 'product' | 'workspace' | 'pricing';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('product');
  const [selectedPlanName, setSelectedPlanName] = useState<string>('Pro plan');

  const handleStartTrial = () => {
    setActiveTab('workspace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPlan = (planLabel: string) => {
    setSelectedPlanName(planLabel);
    setActiveTab('workspace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('product')}
            className="text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-700 rounded"
          >
            Launch Window
          </button>

          {/* Zone 2: Clean single-line navigation tabs */}
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-6 sm:gap-8"
          >
            {(
              [
                { id: 'product', label: 'Product' },
                { id: 'workspace', label: 'Workspace' },
                { id: 'pricing', label: 'Pricing' },
              ] as Array<{ id: TabId; label: string }>
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-2 text-sm sm:text-base font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-700 rounded ${
                    isActive
                      ? 'text-sky-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <motion.span
                      layoutId="active-tab-underline"
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-sky-700"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="hidden sm:flex items-center shrink-0">
            <button
              type="button"
              onClick={handleStartTrial}
              className="px-4 py-2 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            >
              Start free trial
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'product' && (
              <ProductTab
                onStartTrial={handleStartTrial}
                onViewPricing={() => {
                  setActiveTab('pricing');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
            {activeTab === 'workspace' && (
              <WorkspaceTab selectedPlanName={selectedPlanName} />
            )}
            {activeTab === 'pricing' && (
              <PricingTab
                activePlanName={selectedPlanName}
                onSelectPlan={handleSelectPlan}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mandatory Disclaimer Footer on All Tabs */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-slate-600">
          <p>
            Tide data: NOAA Tides &amp; Currents. Planning aid only; staff must
            confirm on-water conditions before launch.
          </p>
          <span className="text-slate-400 whitespace-nowrap shrink-0">
            Launch Window
          </span>
        </div>
      </footer>
    </div>
  );
}
