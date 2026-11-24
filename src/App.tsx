import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckSquare,
  Database,
  FolderKanban,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import {
  type ChecklistItemTemplate,
  PLANT_TECHNOLOGIES,
  type PlantConfig,
  type SavedProject,
} from './types';
import {
  connectAndSubscribeFirebase,
  type DbConnectionState,
  disconnectFirebase,
  type FirebaseClientConfig,
  getSavedFirebaseConfig,
  loadLocalItems,
  loadLocalProjects,
  removeChecklistItem,
  removeSavedProject,
  seedDefaultsToFirestore,
  syncLocalItemsAndProjectsToCloud,
  upsertChecklistItem,
  upsertSavedProject,
} from './services/firebaseService';
import { PlantConfigurator } from './components/PlantConfigurator';
import { ChecklistView } from './components/ChecklistView';
import { SavedProjectsView } from './components/SavedProjectsView';
import { TemplateDatabaseView } from './components/TemplateDatabaseView';
import { FirebaseSetupModal } from './components/FirebaseSetupModal';

type ActiveTab = 'CHECKLIST' | 'PROJECTS' | 'DATABASE';

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
  const [projects, setProjects] = useState<SavedProject[]>(() => loadLocalProjects());

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
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

  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [showSaveProjectModal, setShowSaveProjectModal] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [contractNumInput, setContractNumInput] = useState('');
  const [eanInput, setEanInput] = useState('');

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
      onProjectsUpdate: (cloudProjects) => setProjects(cloudProjects),
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

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  // Keep local active project state synced if updated remotely via Firestore snapshot
  useEffect(() => {
    if (!activeProjectId) return;
    const remote = projects.find((p) => p.id === activeProjectId);
    if (remote) {
      setCheckedIds(remote.checkedIds);
      setItemNotes(remote.itemNotes);
    }
  }, [projects, activeProjectId]);

  const persistActiveProjectProgress = useCallback(
    async (
      nextConfig: PlantConfig,
      nextChecked: string[],
      nextNotes: Record<string, string>
    ) => {
      if (!activeProject) return;
      const updated: SavedProject = {
        ...activeProject,
        installedPowerKw: nextConfig.installedPowerKw,
        category: nextConfig.category,
        voltage: nextConfig.voltage,
        technology: nextConfig.technology,
        exportMode: nextConfig.exportMode,
        flags: nextConfig.flags,
        checkedIds: nextChecked,
        itemNotes: nextNotes,
      };
      const saved = await upsertSavedProject(updated, false);
      if (dbState.mode === 'local') {
        setProjects(loadLocalProjects());
      }
      return saved;
    },
    [activeProject, dbState.mode]
  );

  const handleToggleCheck = (itemId: string) => {
    const next = checkedIds.includes(itemId)
      ? checkedIds.filter((x) => x !== itemId)
      : [...checkedIds, itemId];
    setCheckedIds(next);
    if (activeProject) {
      persistActiveProjectProgress(config, next, itemNotes).catch(() => {});
    }
  };

  const handleSaveItemNote = (itemId: string, note: string) => {
    const nextNotes = { ...itemNotes };
    if (note) {
      nextNotes[itemId] = note;
    } else {
      delete nextNotes[itemId];
    }
    setItemNotes(nextNotes);
    if (activeProject) {
      persistActiveProjectProgress(config, checkedIds, nextNotes).catch(() => {});
    }
    showToast('Poznámka u položky uložena.');
  };

  const handleConfigChange = (nextConfig: PlantConfig) => {
    setConfig(nextConfig);
  };

  const handleResetConfigurator = () => {
    setActiveProjectId(null);
    setConfig(DEFAULT_CONFIG);
    setCheckedIds([]);
    setItemNotes({});
    showToast('Konfigurátor obnoven na výchozí hodnoty.');
  };

  const openNewProjectModal = () => {
    const techLabel =
      PLANT_TECHNOLOGIES.find((t) => t.id === config.technology)?.label || config.technology;
    setProjectNameInput(`${techLabel} ${config.installedPowerKw} kW (${config.voltage})`);
    setContractNumInput(activeProject?.contractNumber || '');
    setEanInput(activeProject?.eanCode || '');
    setShowSaveProjectModal(true);
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectNameInput.trim()) return;
    const nowIso = new Date().toISOString();
    const newProj: SavedProject = {
      id: `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: projectNameInput.trim(),
      contractNumber: contractNumInput.trim(),
      eanCode: eanInput.trim(),
      installedPowerKw: config.installedPowerKw,
      category: config.category,
      voltage: config.voltage,
      technology: config.technology,
      exportMode: config.exportMode,
      flags: config.flags,
      checkedIds,
      itemNotes,
      createdBy: dbState.uid || 'local-user',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    const saved = await upsertSavedProject(newProj, true);
    if (dbState.mode === 'local') {
      setProjects(loadLocalProjects());
    }
    setActiveProjectId(saved.id);
    setShowSaveProjectModal(false);
    showToast(
      dbState.connected
        ? `Projekt „${saved.name}“ uložen do sdílené Firebase databáze.`
        : `Projekt „${saved.name}“ uložen.`
    );
  };

  const handleQuickSaveActiveProject = async () => {
    if (!activeProject) return;
    await persistActiveProjectProgress(config, checkedIds, itemNotes);
    showToast(`Projekt „${activeProject.name}“ aktualizován v databázi.`);
  };

  const handleSelectProject = (proj: SavedProject) => {
    setActiveProjectId(proj.id);
    setConfig({
      installedPowerKw: proj.installedPowerKw,
      category: proj.category,
      voltage: proj.voltage,
      technology: proj.technology,
      exportMode: proj.exportMode,
      flags: proj.flags,
    });
    setCheckedIds(proj.checkedIds);
    setItemNotes(proj.itemNotes);
    setActiveTab('CHECKLIST');
    showToast(`Načten projekt „${proj.name}“.`);
  };

  const handleDeleteProject = async (projectId: string) => {
    await removeSavedProject(projectId);
    if (dbState.mode === 'local') {
      setProjects(loadLocalProjects());
    }
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
    showToast('Projekt byl odstraněn z databáze.');
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
      <div className="cez-top-stripe" />

      <header className="app-header">
        <div className="header-inner">
          <div className="brand-group">
            <div className="brand-mark" aria-hidden="true">
              <Zap size={22} fill="#ffffff" />
            </div>
            <div className="brand-titles">
              <span className="brand-eyebrow">ČEZ Distribuce • PPDS Příloha č. 4 &amp; RfG</span>
              <h1 className="brand-heading">Průvodce připojením nového zdroje</h1>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Hlavní navigace">
            <button
              id="nav-tab-checklist"
              type="button"
              className={`nav-tab ${activeTab === 'CHECKLIST' ? 'active' : ''}`}
              onClick={() => setActiveTab('CHECKLIST')}
            >
              <CheckSquare size={16} />
              Konfigurátor &amp; Checklist
            </button>

            <button
              id="nav-tab-projects"
              type="button"
              className={`nav-tab ${activeTab === 'PROJECTS' ? 'active' : ''}`}
              onClick={() => setActiveTab('PROJECTS')}
            >
              <FolderKanban size={16} />
              Uložené projekty
              <span className="nav-badge">{projects.length}</span>
            </button>

            <button
              id="nav-tab-database"
              type="button"
              className={`nav-tab ${activeTab === 'DATABASE' ? 'active' : ''}`}
              onClick={() => setActiveTab('DATABASE')}
            >
              <SlidersHorizontal size={16} />
              Databáze podmínek
              <span className="nav-badge">{items.length}</span>
            </button>
          </nav>

          <div className="header-actions">
            <button
              id="btn-open-firebase-modal"
              type="button"
              className="db-status-btn"
              onClick={() => setShowFirebaseModal(true)}
            >
              <span
                className={`status-dot ${
                  dbState.mode === 'firebase' && dbState.connected ? 'connected' : 'local'
                }`}
              />
              <Database size={14} />
              <span>
                {dbState.mode === 'firebase' && dbState.connected
                  ? `Firebase: ${dbState.projectId}`
                  : 'Připojit Firebase DB'}
              </span>
            </button>
          </div>
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
              activeProject={activeProject}
              onToggleCheck={handleToggleCheck}
              onSaveItemNote={handleSaveItemNote}
              onClearChecks={() => {
                setCheckedIds([]);
                if (activeProject) {
                  persistActiveProjectProgress(config, [], itemNotes).catch(() => {});
                }
              }}
              onOpenSaveProjectModal={openNewProjectModal}
              onQuickSaveActiveProject={handleQuickSaveActiveProject}
              onEditTemplateItem={(item) => {
                setEditingTemplateFromChecklist(item);
                setActiveTab('DATABASE');
              }}
            />
          </div>
        )}

        {activeTab === 'PROJECTS' && (
          <SavedProjectsView
            projects={projects}
            allItems={items}
            activeProjectId={activeProjectId}
            onSelectProject={handleSelectProject}
            onDeleteProject={handleDeleteProject}
            onCreateNewFromCurrent={openNewProjectModal}
          />
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
        Zpracováno dle platných Připojovacích podmínek NN/VN/VVN společnosti ČEZ Distribuce, a. s.,
        Pravidel provozování distribuční soustavy (PPDS Příloha č. 4 a č. 6), vyhlášky č. 16/2016 Sb.
        a Nařízení Komise (EU) 2016/631 (RfG). Nástroj slouží jako praktická pomůcka a nenahrazuje
        závazné podmínky konkrétní Smlouvy o připojení.
      </footer>

      {/* Save Project Modal */}
      {showSaveProjectModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel" style={{ maxWidth: 500 }} onSubmit={handleCreateProjectSubmit}>
            <div className="modal-header">
              <h3>Uložit výrobnu / zakázku do sdílené databáze</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSaveProjectModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="field-group">
                <label className="field-label" htmlFor="input-proj-name">
                  Označení projektu / výrobny * (neuvádějte citlivé osobní údaje)
                </label>
                <input
                  id="input-proj-name"
                  type="text"
                  required
                  maxLength={140}
                  className="text-input"
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  placeholder="Např. FVE Hala Plzeň-Bory 99 kWp"
                  autoFocus
                />
              </div>

              <div className="form-row-2 field-group">
                <div>
                  <label className="field-label" htmlFor="input-proj-contract">
                    Číslo žádosti / SoP (volitelné)
                  </label>
                  <input
                    id="input-proj-contract"
                    type="text"
                    maxLength={30}
                    className="text-input"
                    value={contractNumInput}
                    onChange={(e) => setContractNumInput(e.target.value)}
                    placeholder="4120000000"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="input-proj-ean">
                    EAN místa (volitelné)
                  </label>
                  <input
                    id="input-proj-ean"
                    type="text"
                    maxLength={25}
                    className="text-input"
                    value={eanInput}
                    onChange={(e) => setEanInput(e.target.value)}
                    placeholder="859182400..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSaveProjectModal(false)}
              >
                Zrušit
              </button>
              <button type="submit" className="btn btn-primary">
                Uložit projekt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Firebase Cloud Setup Modal */}
      {showFirebaseModal && (
        <FirebaseSetupModal
          dbState={dbState}
          onClose={() => setShowFirebaseModal(false)}
          onConnectConfig={async (cfg) => {
            await establishFirebase(cfg);
          }}
          onDisconnect={async () => {
            await disconnectFirebase();
            setDbState({
              mode: 'local',
              connected: false,
              projectId: '',
              uid: '',
              authEmail: '',
              error: '',
            });
          }}
          onSyncLocalToCloud={async () => {
            await syncLocalItemsAndProjectsToCloud(items, projects);
          }}
          onShowToast={showToast}
        />
      )}

      {toastMsg && (
        <div className="toast-banner" role="status" aria-live="polite">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}

export default App;
