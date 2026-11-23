import { useCallback, useEffect, useState } from 'react';
import { Bike as BikeIcon, LogOut, ClipboardList, UserCheck, Warehouse } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import KpiCards from '../components/admin/KpiCards';
import OccurrencesTab from '../components/admin/OccurrencesTab';
import ApprovalsTab from '../components/admin/ApprovalsTab';
import FleetTab from '../components/admin/FleetTab';

type TabId = 'occurrences' | 'approvals' | 'fleet';

const TABS: { id: TabId; label: string; icon: typeof ClipboardList }[] = [
  { id: 'occurrences', label: 'Ocorrências', icon: ClipboardList },
  { id: 'approvals', label: 'Aprovações', icon: UserCheck },
  { id: 'fleet', label: 'Frota', icon: Warehouse },
];

interface KpiCounts {
  activeCount: number;
  totalCapacity: number;
  pendingCount: number;
  openIncidentCount: number;
  settingsId: string | null;
}

const EMPTY_KPI_COUNTS: KpiCounts = {
  activeCount: 0,
  totalCapacity: 0,
  pendingCount: 0,
  openIncidentCount: 0,
  settingsId: null,
};

function AdminPage() {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('occurrences');
  const [kpiCounts, setKpiCounts] = useState<KpiCounts>(EMPTY_KPI_COUNTS);

  // refreshKpiCounts: refetches the four KPI numbers from Supabase.
  // Tasks 8/9 should call this (e.g. via an onApproved callback) whenever
  // an action changes bike/incident counts, so the KPI cards stay accurate.
  const refreshKpiCounts = useCallback(async () => {
    const [activeRes, pendingRes, settingsRes, openIncidentRes] = await Promise.all([
      supabase.from('bikes').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('bikes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('condo_settings').select('id, total_capacity').single(),
      supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ]);

    setKpiCounts({
      activeCount: activeRes.count ?? 0,
      totalCapacity: settingsRes.data?.total_capacity ?? 0,
      pendingCount: pendingRes.count ?? 0,
      openIncidentCount: openIncidentRes.count ?? 0,
      settingsId: settingsRes.data?.id ?? null,
    });
  }, []);

  // Re-fetch on every tab switch, not just on mount — otherwise the KPI
  // cards go stale the moment data changes outside of an onApproved/
  // onCapacityChanged callback (e.g. a resident submits a new registration
  // while the admin is already on the page).
  useEffect(() => {
    refreshKpiCounts();
  }, [activeTab, refreshKpiCounts]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 border border-emerald-500/40 p-2 rounded-xl text-emerald-400">
              <BikeIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight">BikeCondo</span>
              <p className="hidden sm:block text-xs text-slate-400">Painel Administrativo</p>
            </div>
          </div>

          <nav className="flex-1 md:flex-none flex items-center justify-center gap-1 overflow-x-auto bg-slate-800/90 p-1 rounded-xl border border-slate-700/70">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-label={tab.label}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => signOut()}
            aria-label="Sair"
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <KpiCards
          activeCount={kpiCounts.activeCount}
          totalCapacity={kpiCounts.totalCapacity}
          pendingCount={kpiCounts.pendingCount}
          openIncidentCount={kpiCounts.openIncidentCount}
        />

        {activeTab === 'occurrences' && <OccurrencesTab onResolved={refreshKpiCounts} />}
        {activeTab === 'approvals' && <ApprovalsTab onApproved={refreshKpiCounts} />}
        {activeTab === 'fleet' && (
          <FleetTab
            currentCapacity={kpiCounts.totalCapacity}
            settingsId={kpiCounts.settingsId ?? undefined}
            onCapacityChanged={refreshKpiCounts}
          />
        )}
      </main>
    </div>
  );
}

export default AdminPage;
