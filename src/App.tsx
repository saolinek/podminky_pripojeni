import { useCallback, useEffect, useState } from 'react';
import {
  CheckSquare,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import {
  type ChecklistItemTemplate,
  type PlantConfig,
} from './types';
import {
  connectAndSubscribeFirebase,
  type DbConnectionState,
  type FirebaseClientConfig,
  getSavedFirebaseConfig,
  loadLocalItems,
  removeChecklistItem,
  seedDefaultsToFirestore,
  upsertChecklistItem,
} from './services/firebaseService';
import { PlantConfigurator } from './components/PlantConfigurator';
import { ChecklistView } from './components/ChecklistView';
import { TemplateDatabaseView } from './components/TemplateDatabaseView';

type ActiveTab = 'CHECKLIST' | 'DATABASE';

const DEFAULT_CONFIG: PlantConfig = {
  installedPowerKw: 9.9,
  category: 'MIKROZDROJ',
  voltage: 'NN',
  technology: 'FVE_BESS',
  exportMode: 'STANDARD_PRETOKY',
  flags: [],
};

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('CHECKLIST');
  const [config, setConfig] = useState<PlantConfig>(DEFAULT_CONFIG);
  const [items, setItems] = useState<ChecklistItemTemplate[]>(() => loadLocalItems());

  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const [dbState, setDbState] = useState<DbConnectionState>({
    mode: 'local',
    connected: false,
    projectId: '',
    uid: '',
    authEmail: '',
    error: '',
  });

  const [editingTemplateFromChecklist, setEditingTemplateFromChecklist] =
    useState<ChecklistItemTemplate | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3600);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const establishFirebase = useCallback(async (cfg: FirebaseClientConfig) => {
    await connectAndSubscribeFirebase(cfg, {
      onStateChange: (st) => setDbState(st),
      onItemsUpdate: (cloudItems) => setItems(cloudItems),
      onProjectsUpdate: () => {},
    });
  }, []);

  useEffect(() => {
    const savedCfg = getSavedFirebaseConfig();
    if (savedCfg) {
      establishFirebase(savedCfg).catch((err) => {
        setDbState({
          mode: 'local',
          connected: false,
          projectId: savedCfg.projectId,
          uid: '',
          authEmail: '',
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }, [establishFirebase]);

  const handleToggleCheck = (itemId: string) => {
    const next = checkedIds.includes(itemId)
      ? checkedIds.filter((x) => x !== itemId)
      : [...checkedIds, itemId];
    setCheckedIds(next);
  };

  const handleSaveItemNote = (itemId: string, note: string) => {
    const nextNotes = { ...itemNotes };
    if (note) {
      nextNotes[itemId] = note;
    } else {
      delete nextNotes[itemId];
    }
    setItemNotes(nextNotes);
    showToast('Poznámka u položky uložena.');
  };

  const handleConfigChange = (nextConfig: PlantConfig) => {
    setConfig(nextConfig);
  };

  const handleResetConfigurator = () => {
    setConfig(DEFAULT_CONFIG);
    setCheckedIds([]);
    setItemNotes({});
    showToast('Konfigurátor obnoven na výchozí hodnoty.');
  };

  const handleSaveTemplateItem = async (item: ChecklistItemTemplate, isNew: boolean) => {
    await upsertChecklistItem(item, isNew);
    if (dbState.mode === 'local') {
      setItems(loadLocalItems());
    }
    showToast(
      isNew
        ? `Nová podmínka „${item.title}“ přidána do databáze.`
        : `Podmínka „${item.title}“ byla aktualizována.`
    );
  };

  const handleDeleteTemplateItem = async (id: string) => {
    await removeChecklistItem(id);
    if (dbState.mode === 'local') {
      setItems(loadLocalItems());
    }
    showToast('Podmínka odstraněna z databáze.');
  };

  const handleResetDefaults = async () => {
    await seedDefaultsToFirestore();
    if (dbState.mode === 'local') {
      setItems(loadLocalItems());
    }
    showToast('Výchozí podmínky připojení ČEZ Distribuce byly obnoveny.');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-group">
            <div className="brand-mark" aria-hidden="true">
              <Zap size={16} fill="#ffffff" />
            </div>
            <h1 className="brand-heading">Připojení zdroje · ČEZ</h1>
          </div>

          <nav className="nav-tabs" aria-label="Hlavní navigace">
            <button
              id="nav-tab-checklist"
              type="button"
              className={`nav-tab ${activeTab === 'CHECKLIST' ? 'active' : ''}`}
              onClick={() => setActiveTab('CHECKLIST')}
            >
              <CheckSquare size={15} />
              Checklist
            </button>

            <button
              id="nav-tab-database"
              type="button"
              className={`nav-tab ${activeTab === 'DATABASE' ? 'active' : ''}`}
              onClick={() => setActiveTab('DATABASE')}
            >
              <SlidersHorizontal size={15} />
              Podmínky
              <span className="nav-badge">{items.length}</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="main-container">
        {activeTab === 'CHECKLIST' && (
          <div className="workspace-grid">
            <PlantConfigurator
              config={config}
              onChange={handleConfigChange}
              onResetConfig={handleResetConfigurator}
            />

            <ChecklistView
              config={config}
              allItems={items}
              checkedIds={checkedIds}
              itemNotes={itemNotes}
              onToggleCheck={handleToggleCheck}
              onSaveItemNote={handleSaveItemNote}
              onEditTemplateItem={(item) => {
                setEditingTemplateFromChecklist(item);
                setActiveTab('DATABASE');
              }}
            />
          </div>
        )}

        {activeTab === 'DATABASE' && (
          <TemplateDatabaseView
            items={items}
            editingInitialItem={editingTemplateFromChecklist}
            onClearInitialEdit={() => setEditingTemplateFromChecklist(null)}
            onSaveItem={handleSaveTemplateItem}
            onDeleteItem={handleDeleteTemplateItem}
            onResetDefaults={handleResetDefaults}
          />
        )}
      </main>

      <footer className="app-footer">
        ČEZ Distribuce · PPDS Příloha č. 4 &amp; RfG · Orientační pomůcka
      </footer>

      {toastMsg && (
        <div className="toast-banner" role="status" aria-live="polite">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}

export default App;
