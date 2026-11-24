import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  Lock,
  MessageSquare,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import {
  type ChecklistItemTemplate,
  type FeedbackCategory,
  type FeedbackEntry,
  type PhaseGroup,
  type PhaseId,
  type PlantConfig,
} from './types';
import {
  connectAndSubscribeFirebase,
  type DbConnectionState,
  fetchAdminPasswordHash,
  type FirebaseClientConfig,
  getSavedFirebaseConfig,
  isFirebaseConnected,
  loadLocalFeedback,
  loadLocalGroups,
  loadLocalItems,
  removeChecklistItem,
  removeChecklistItemsByIds,
  removeFeedback,
  reorderChecklistItems,
  saveAdminPasswordHash,
  saveGroups,
  submitFeedback,
  upsertChecklistItem,
} from './services/firebaseService';
import {
  type AdminRole,
  clearAdminSession,
  hashPassword,
  loadAdminSession,
  loadCachedAdminHash,
  saveAdminSession,
  verifyCanChangeAdminPassword,
  verifyLoginPassword,
} from './services/adminAuthService';
import { PlantConfigurator } from './components/PlantConfigurator';
import { ChecklistView } from './components/ChecklistView';
import { TemplateDatabaseView } from './components/TemplateDatabaseView';
import { FeedbackView } from './components/FeedbackView';
import { AdminLoginModal, ChangePasswordModal } from './components/AdminAuthModals';

type ActiveTab = 'CHECKLIST' | 'DATABASE' | 'FEEDBACK';
type LoginIntent = 'DATABASE' | 'FEEDBACK';

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
  const [groups, setGroups] = useState<PhaseGroup[]>(() => loadLocalGroups());
  const [items, setItems] = useState<ChecklistItemTemplate[]>(() => loadLocalItems());
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>(() =>
    loadLocalFeedback()
  );

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

  const [adminHash, setAdminHash] = useState<string | null>(() => loadCachedAdminHash());
  const adminHashSyncedRef = useRef(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(() =>
    loadAdminSession(loadCachedAdminHash())
  );
  const adminRoleRef = useRef<AdminRole | null>(adminRole);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [loginIntent, setLoginIntent] = useState<LoginIntent>('DATABASE');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const [editingTemplateFromChecklist, setEditingTemplateFromChecklist] =
    useState<ChecklistItemTemplate | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    adminRoleRef.current = adminRole;
  }, [adminRole]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const handleAdminHashSync = useCallback(
    (cloudHash: string | null) => {
      adminHashSyncedRef.current = true;
      setAdminHash(cloudHash);
      if (adminRoleRef.current === 'admin' && loadAdminSession(cloudHash) !== 'admin') {
        clearAdminSession();
        setAdminRole(null);
        setShowChangePasswordModal(false);
        setActiveTab((prev) => (prev === 'DATABASE' ? 'CHECKLIST' : prev));
        showToast('Heslo admina bylo změněno. Přihlaste se prosím znovu.');
      }
    },
    [showToast]
  );

  const establishFirebase = useCallback(
    async (cfg: FirebaseClientConfig) => {
      await connectAndSubscribeFirebase(cfg, {
        onStateChange: (st) => setDbState(st),
        onItemsUpdate: (cloudItems) => setItems(cloudItems),
        onGroupsUpdate: (cloudGroups) => setGroups(cloudGroups),
        onProjectsUpdate: () => {},
        onAdminHashUpdate: handleAdminHashSync,
        onFeedbackUpdate: (cloudFeedback) => setFeedbackEntries(cloudFeedback),
      });
    },
    [handleAdminHashSync]
  );

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

  const handleOpenDatabaseTab = () => {
    if (adminRole) {
      setActiveTab('DATABASE');
    } else {
      setLoginIntent('DATABASE');
      setShowAdminLoginModal(true);
    }
  };

  const handleOpenFeedbackSuperadminLogin = () => {
    setLoginIntent('FEEDBACK');
    setShowAdminLoginModal(true);
  };

  const handleAdminLogin = async (
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    let latestHash = adminHash;
    if (!adminHashSyncedRef.current && isFirebaseConnected()) {
      try {
        latestHash = await fetchAdminPasswordHash();
        adminHashSyncedRef.current = true;
        setAdminHash(latestHash);
      } catch {
        // Fallback to cached hash if fetch transiently fails
      }
    }

    const role = verifyLoginPassword(password, latestHash);
    if (!role) {
      return { ok: false, error: 'Nesprávné heslo.' };
    }

    if (loginIntent === 'FEEDBACK' && role !== 'superadmin') {
      return {
        ok: false,
        error: 'Zobrazení přijaté zpětné vazby vyžaduje heslo superadmina.',
      };
    }

    saveAdminSession(role, latestHash);
    setAdminRole(role);
    setShowAdminLoginModal(false);
    if (loginIntent === 'DATABASE') {
      setActiveTab('DATABASE');
    } else {
      setActiveTab('FEEDBACK');
    }
    showToast(role === 'superadmin' ? 'Přihlášen jako superadmin.' : 'Přihlášen jako admin.');
    return { ok: true };
  };

  const handleChangeAdminPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!adminRole) {
      return { ok: false, error: 'Nejste přihlášen jako správce.' };
    }

    let latestHash = adminHash;
    if (!adminHashSyncedRef.current && isFirebaseConnected()) {
      try {
        latestHash = await fetchAdminPasswordHash();
        adminHashSyncedRef.current = true;
        setAdminHash(latestHash);
      } catch {
        // Keep current hash
      }
    }

    if (!verifyCanChangeAdminPassword(adminRole, currentPassword, latestHash)) {
      return { ok: false, error: 'Současné heslo není správné.' };
    }

    const nextHash = hashPassword(newPassword);
    await saveAdminPasswordHash(nextHash);
    setAdminHash(nextHash);
    saveAdminSession(adminRole, nextHash);
    showToast('Heslo admina bylo úspěšně změněno.');
    return { ok: true };
  };

  const handleAdminLogout = () => {
    clearAdminSession();
    setAdminRole(null);
    setEditingTemplateFromChecklist(null);
    setShowChangePasswordModal(false);
    setActiveTab((prev) => (prev === 'DATABASE' ? 'CHECKLIST' : prev));
    showToast('Správce byl odhlášen.');
  };

  const handleToggleCheck = (itemId: string) => {
    setCheckedIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]
    );
  };

  const handleSaveItemNote = (itemId: string, note: string) => {
    const nextNotes = { ...itemNotes };
    if (note) {
      nextNotes[itemId] = note;
    } else {
      delete nextNotes[itemId];
    }
    setItemNotes(nextNotes);
    showToast('Poznámka uložena.');
  };

  const handleConfigChange = (nextConfig: PlantConfig) => {
    setConfig(nextConfig);
  };

  const handleResetConfigurator = () => {
    setConfig(DEFAULT_CONFIG);
    setCheckedIds([]);
    setItemNotes({});
    showToast('Konfigurátor obnoven.');
  };

  const handleSaveTemplateItem = async (item: ChecklistItemTemplate, isNew: boolean) => {
    if (!adminRole) {
      showToast('Úpravy podmínek vyžadují přihlášení správce.');
      return;
    }
    try {
      await upsertChecklistItem(item, isNew);
      if (dbState.mode === 'local') {
        setItems(loadLocalItems());
      }
      showToast(isNew ? `Přidáno: „${item.title}“` : `Uloženo: „${item.title}“`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Chyba při ukládání podmínky: ${msg}`);
      throw err;
    }
  };

  const handleDeleteTemplateItem = async (id: string) => {
    if (!adminRole) {
      showToast('Úpravy podmínek vyžadují přihlášení správce.');
      return;
    }
    try {
      await removeChecklistItem(id);
      if (dbState.mode === 'local') {
        setItems(loadLocalItems());
      }
      showToast('Podmínka odstraněna.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Chyba při mazání podmínky: ${msg}`);
    }
  };

  const handleReorderTemplateItems = async (
    updates: { id: string; phase: PhaseId; order: number }[]
  ) => {
    if (!adminRole) {
      showToast('Úpravy podmínek vyžadují přihlášení správce.');
      return;
    }
    if (updates.length === 0) return;
    const byId = new Map(updates.map((u) => [u.id, u]));
    setItems((prev) =>
      prev
        .map((it) => {
          const u = byId.get(it.id);
          return u ? { ...it, phase: u.phase, order: u.order } : it;
        })
        .sort((a, b) => a.order - b.order)
    );
    await reorderChecklistItems(updates);
    if (dbState.mode === 'local') {
      setItems(loadLocalItems());
    }
  };

  const handleSaveGroups = async (nextGroups: PhaseGroup[], toastText?: string) => {
    if (!adminRole) {
      showToast('Úpravy skupin vyžadují přihlášení správce.');
      return;
    }
    try {
      setGroups(nextGroups);
      await saveGroups(nextGroups);
      if (toastText) showToast(toastText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Chyba při ukládání skupin: ${msg}`);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!adminRole) {
      showToast('Úpravy skupin vyžadují přihlášení správce.');
      return;
    }
    try {
      const itemIdsToDelete = items.filter((i) => i.phase === groupId).map((i) => i.id);
      const nextGroups = groups.filter((g) => g.id !== groupId);
      setGroups(nextGroups);
      setItems((prev) => prev.filter((i) => i.phase !== groupId));
      await removeChecklistItemsByIds(itemIdsToDelete);
      await saveGroups(nextGroups);
      if (dbState.mode === 'local') {
        setItems(loadLocalItems());
      }
      showToast('Skupina odstraněna.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Chyba při mazání skupiny: ${msg}`);
    }
  };

  const handleSubmitFeedback = async (input: {
    category: FeedbackCategory;
    rating: number;
    message: string;
    authorName: string;
  }) => {
    await submitFeedback(input);
    if (dbState.mode === 'local') {
      setFeedbackEntries(loadLocalFeedback());
    }
    showToast('Děkujeme! Zpětná vazba byla uložena.');
  };

  const handleDeleteFeedback = async (id: string) => {
    if (adminRole !== 'superadmin') {
      showToast('Odstranění zpětné vazby je vyhrazeno pouze pro superadmina.');
      return;
    }
    await removeFeedback(id);
    if (dbState.mode === 'local') {
      setFeedbackEntries(loadLocalFeedback());
    }
    showToast('Zpětná vazba byla odstraněna.');
  };

  const isSuperadmin = adminRole === 'superadmin';
  const showingDatabase = activeTab === 'DATABASE' && adminRole !== null;
  const showingFeedback = activeTab === 'FEEDBACK';
  const showingChecklist = !showingDatabase && !showingFeedback;

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
              className={`nav-tab ${showingChecklist ? 'active' : ''}`}
              onClick={() => setActiveTab('CHECKLIST')}
            >
              <CheckSquare size={15} />
              Checklist
            </button>

            <button
              id="nav-tab-database"
              type="button"
              className={`nav-tab ${showingDatabase ? 'active' : ''}`}
              onClick={handleOpenDatabaseTab}
            >
              {adminRole ? <SlidersHorizontal size={15} /> : <Lock size={14} />}
              Podmínky
              <span className="nav-badge">{items.length}</span>
            </button>

            <button
              id="nav-tab-feedback"
              type="button"
              className={`nav-tab ${showingFeedback ? 'active' : ''}`}
              onClick={() => setActiveTab('FEEDBACK')}
            >
              <MessageSquare size={15} />
              Zpětná vazba
              {isSuperadmin && feedbackEntries.length > 0 && (
                <span className="nav-badge">{feedbackEntries.length}</span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main className="main-container">
        {showingChecklist && (
          <div className="workspace-grid">
            <PlantConfigurator
              config={config}
              onChange={handleConfigChange}
              onResetConfig={handleResetConfigurator}
            />

            <ChecklistView
              config={config}
              groups={groups}
              allItems={items}
              checkedIds={checkedIds}
              itemNotes={itemNotes}
              isAdmin={adminRole !== null}
              onToggleCheck={handleToggleCheck}
              onSaveItemNote={handleSaveItemNote}
              onEditTemplateItem={(item) => {
                if (!adminRole) {
                  setLoginIntent('DATABASE');
                  setShowAdminLoginModal(true);
                  return;
                }
                setEditingTemplateFromChecklist(item);
                setActiveTab('DATABASE');
              }}
            />
          </div>
        )}

        {showingDatabase && adminRole && (
          <TemplateDatabaseView
            groups={groups}
            items={items}
            adminRole={adminRole}
            editingInitialItem={editingTemplateFromChecklist}
            onClearInitialEdit={() => setEditingTemplateFromChecklist(null)}
            onSaveItem={handleSaveTemplateItem}
            onDeleteItem={handleDeleteTemplateItem}
            onReorderItems={handleReorderTemplateItems}
            onSaveGroups={handleSaveGroups}
            onDeleteGroup={handleDeleteGroup}
            onOpenChangePassword={() => setShowChangePasswordModal(true)}
            onLogout={handleAdminLogout}
          />
        )}

        {showingFeedback && (
          <FeedbackView
            isSuperadmin={isSuperadmin}
            entries={feedbackEntries}
            onSubmitFeedback={handleSubmitFeedback}
            onDeleteFeedback={handleDeleteFeedback}
            onOpenSuperadminLogin={handleOpenFeedbackSuperadminLogin}
            onLogout={handleAdminLogout}
          />
        )}
      </main>

      {showAdminLoginModal && (
        <AdminLoginModal
          title={
            loginIntent === 'FEEDBACK'
              ? 'Přehled zpětné vazby'
              : 'Přístup do záložky Podmínky'
          }
          description={
            loginIntent === 'FEEDBACK'
              ? 'Zobrazení přijaté zpětné vazby je vyhrazeno pouze pro superadmina. Zadejte heslo superadmina.'
              : 'Úprava podmínek připojení je vyhrazena pouze pro správce. Zadejte heslo admina.'
          }
          onClose={() => setShowAdminLoginModal(false)}
          onAuthenticate={handleAdminLogin}
        />
      )}

      {showChangePasswordModal && adminRole && (
        <ChangePasswordModal
          role={adminRole}
          onClose={() => setShowChangePasswordModal(false)}
          onChangePassword={handleChangeAdminPassword}
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
