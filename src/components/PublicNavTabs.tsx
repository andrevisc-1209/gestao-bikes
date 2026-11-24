import { useNavigate } from 'react-router-dom';

type PublicNavTab = 'cadastro' | 'ocorrencia';

interface PublicNavTabsProps {
  active: PublicNavTab;
}

const TABS: { id: PublicNavTab; label: string; path: string }[] = [
  { id: 'cadastro', label: 'Cadastro', path: '/cadastro' },
  { id: 'ocorrencia', label: 'Ocorrência', path: '/ocorrencia' },
];

function PublicNavTabs({ active }: PublicNavTabsProps) {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              if (isActive) return;
              navigate(tab.path);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export default PublicNavTabs;
