import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import {
  BUILTIN_PHASE_IDS,
  type BuiltInPhaseId,
  type ChecklistItemTemplate,
  PHASES,
  type PhaseGroup,
  type PhaseId,
  type SavedProject,
} from '../types';
import { CEZ_DEFAULT_ITEMS } from '../data/cezDefaultItems';
import { saveCachedAdminHash } from './adminAuthService';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  databaseId?: string;
}

export interface DbConnectionState {
  mode: 'firebase' | 'local';
  connected: boolean;
  projectId: string;
  uid: string;
  authEmail: string;
  error: string;
}

const LS_FIREBASE_CFG = 'cez_pripojeni_firebase_cfg_v1';
const LS_ITEMS_KEY = 'cez_pripojeni_items_v1';
const LS_GROUPS_KEY = 'cez_pripojeni_groups_v1';
const LS_PROJECTS_KEY = 'cez_pripojeni_projects_v1';
const ADMIN_CONFIG_DOC_ID = 'sys_admin_config';

const GROUPS_META_DOC_ID = 'meta_groups_v1';
const CUSTOM_GROUP_PREFIX = 'grp:';

let currentApp: FirebaseApp | null = null;
let currentAuth: Auth | null = null;
let currentDb: Firestore | null = null;
let currentConfig: FirebaseClientConfig | null = null;
let unsubItems: (() => void) | null = null;
let unsubProjects: (() => void) | null = null;
let unsubAdminConfig: (() => void) | null = null;
let groupsDocExistsInFirestore = false;

function isBuiltInPhase(phase: string): phase is BuiltInPhaseId {
  return (BUILTIN_PHASE_IDS as readonly string[]).includes(phase);
}

function encodePhaseForFirestore(
  phase: PhaseId,
  existingBadge = ''
): { phase: BuiltInPhaseId; deadlineBadge: string } {
  if (isBuiltInPhase(phase)) {
    return {
      phase,
      deadlineBadge: existingBadge.startsWith(CUSTOM_GROUP_PREFIX) ? '' : existingBadge,
    };
  }
  return {
    phase: 'FAZE_1_PRIPRAVA',
    deadlineBadge: `${CUSTOM_GROUP_PREFIX}${phase}`.slice(0, 100),
  };
}

function decodePhaseFromFirestore(
  rawPhase: unknown,
  rawBadge: unknown
): { phase: PhaseId; deadlineBadge: string } {
  const badge = String(rawBadge || '');
  if (badge.startsWith(CUSTOM_GROUP_PREFIX)) {
    return { phase: badge.slice(CUSTOM_GROUP_PREFIX.length), deadlineBadge: '' };
  }
  return { phase: String(rawPhase || 'FAZE_1_PRIPRAVA'), deadlineBadge: badge };
}

export function getDefaultGroups(): PhaseGroup[] {
  return PHASES.map(({ id, title }) => ({ id, title }));
}

export function loadLocalGroups(): PhaseGroup[] {
  try {
    const raw = localStorage.getItem(LS_GROUPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PhaseGroup[];
      if (Array.isArray(parsed) && parsed.every((g) => g && typeof g.id === 'string' && typeof g.title === 'string')) {
        return parsed;
      }
    }
  } catch {
    // Ignore corrupted storage
  }
  return getDefaultGroups();
}

export function saveLocalGroups(groups: PhaseGroup[]): void {
  localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(groups));
}

const DEFAULT_FIREBASE_CONFIG: FirebaseClientConfig = {
  apiKey: 'AIzaSyD1fby84nt24fZEF2MUYs793KFOc-fWfrU',
  authDomain: 'cez-podminky-pripojeni.firebaseapp.com',
  projectId: 'cez-podminky-pripojeni',
  storageBucket: 'cez-podminky-pripojeni.firebasestorage.app',
  messagingSenderId: '401109942749',
  appId: '1:401109942749:web:621f4ee4bcbb67f3b2b634',
};

function readEnvFirebaseConfig(): FirebaseClientConfig | null {
  const env = import.meta.env;
  if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID) {
    return {
      apiKey: String(env.VITE_FIREBASE_API_KEY),
      authDomain: String(
        env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`
      ),
      projectId: String(env.VITE_FIREBASE_PROJECT_ID),
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
        ? String(env.VITE_FIREBASE_STORAGE_BUCKET)
        : undefined,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID
        ? String(env.VITE_FIREBASE_MESSAGING_SENDER_ID)
        : undefined,
      appId: String(env.VITE_FIREBASE_APP_ID),
      databaseId: env.VITE_FIREBASE_DATABASE_ID
        ? String(env.VITE_FIREBASE_DATABASE_ID)
        : undefined,
    };
  }
  return null;
}

function readUrlFirebaseConfig(): FirebaseClientConfig | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('fb');
    if (!encoded) return null;
    const json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json) as Partial<FirebaseClientConfig>;
    if (parsed.apiKey && parsed.projectId && parsed.appId) {
      const cfg: FirebaseClientConfig = {
        apiKey: parsed.apiKey,
        authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
        projectId: parsed.projectId,
        storageBucket: parsed.storageBucket,
        messagingSenderId: parsed.messagingSenderId,
        appId: parsed.appId,
        databaseId: parsed.databaseId,
      };
      localStorage.setItem(LS_FIREBASE_CFG, JSON.stringify(cfg));
      return cfg;
    }
  } catch {
    // Ignore malformed URL parameter
  }
  return null;
}

export function getSavedFirebaseConfig(): FirebaseClientConfig | null {
  const fromUrl = readUrlFirebaseConfig();
  if (fromUrl) return fromUrl;

  try {
    const raw = localStorage.getItem(LS_FIREBASE_CFG);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FirebaseClientConfig>;
      if (parsed.apiKey && parsed.projectId && parsed.appId) {
        return {
          apiKey: parsed.apiKey,
          authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
          projectId: parsed.projectId,
          storageBucket: parsed.storageBucket,
          messagingSenderId: parsed.messagingSenderId,
          appId: parsed.appId,
          databaseId: parsed.databaseId,
        };
      }
    }
  } catch {
    // Ignore storage read error
  }

  return readEnvFirebaseConfig() ?? DEFAULT_FIREBASE_CONFIG;
}

export function buildShareableUrlWithFirebase(cfg: FirebaseClientConfig): string {
  const json = JSON.stringify(cfg);
  const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = new URL(window.location.href);
  url.searchParams.set('fb', b64);
  return url.toString();
}

/**
 * Parses either JSON or a copied JS snippet (`const firebaseConfig = { apiKey: "...", ... }`)
 */
export function parseFirebaseConfigSnippet(input: string, databaseId?: string): FirebaseClientConfig {
  const trimmed = input.trim();
  const extractField = (key: string): string | undefined => {
    const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`);
    const match = trimmed.match(regex);
    return match ? match[1].trim() : undefined;
  };

  let parsed: Partial<FirebaseClientConfig> = {};
  try {
    parsed = JSON.parse(trimmed) as Partial<FirebaseClientConfig>;
  } catch {
    parsed = {
      apiKey: extractField('apiKey'),
      authDomain: extractField('authDomain'),
      projectId: extractField('projectId'),
      storageBucket: extractField('storageBucket'),
      messagingSenderId: extractField('messagingSenderId'),
      appId: extractField('appId'),
      databaseId: extractField('databaseId'),
    };
  }

  if (!parsed.apiKey || !parsed.projectId || !parsed.appId) {
    throw new Error(
      'Nepodařilo se najít povinná pole apiKey, projectId a appId. Zkopírujte prosím celý objekt firebaseConfig z Firebase Console.'
    );
  }

  return {
    apiKey: parsed.apiKey,
    authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
    projectId: parsed.projectId,
    storageBucket: parsed.storageBucket,
    messagingSenderId: parsed.messagingSenderId,
    appId: parsed.appId,
    databaseId: databaseId?.trim() || parsed.databaseId || undefined,
  };
}

// ============================================================================
// Local Storage Fallback Helpers
// ============================================================================
export function loadLocalItems(): ChecklistItemTemplate[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChecklistItemTemplate[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [...parsed].sort((a, b) => a.order - b.order);
      }
    }
  } catch {
    // Fallback to defaults
  }
  localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(CEZ_DEFAULT_ITEMS));
  return [...CEZ_DEFAULT_ITEMS];
}

export function saveLocalItems(items: ChecklistItemTemplate[]): void {
  localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(items));
}

export function loadLocalProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(LS_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedProject[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

export function saveLocalProjects(projects: SavedProject[]): void {
  localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(projects));
}

function timestampToIso(val: unknown): string {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

// ============================================================================
// Firebase Connection & Real-time Listeners
// ============================================================================
export async function disconnectFirebase(): Promise<void> {
  if (unsubItems) {
    unsubItems();
    unsubItems = null;
  }
  if (unsubProjects) {
    unsubProjects();
    unsubProjects = null;
  }
  if (unsubAdminConfig) {
    unsubAdminConfig();
    unsubAdminConfig = null;
  }
  localStorage.removeItem(LS_FIREBASE_CFG);
  const url = new URL(window.location.href);
  if (url.searchParams.has('fb')) {
    url.searchParams.delete('fb');
    window.history.replaceState({}, '', url.toString());
  }
  if (currentApp) {
    await deleteApp(currentApp);
    currentApp = null;
    currentAuth = null;
    currentDb = null;
    currentConfig = null;
  }
}

export async function connectAndSubscribeFirebase(
  cfg: FirebaseClientConfig,
  callbacks: {
    onStateChange: (state: DbConnectionState) => void;
    onItemsUpdate: (items: ChecklistItemTemplate[]) => void;
    onProjectsUpdate: (projects: SavedProject[]) => void;
    onAdminHashUpdate?: (hash: string | null) => void;
    onGroupsUpdate?: (groups: PhaseGroup[]) => void;
  }
): Promise<void> {
  if (unsubItems) {
    unsubItems();
    unsubItems = null;
  }
  if (unsubProjects) {
    unsubProjects();
    unsubProjects = null;
  }
  if (unsubAdminConfig) {
    unsubAdminConfig();
    unsubAdminConfig = null;
  }
  groupsDocExistsInFirestore = false;

  for (const existing of getApps()) {
    await deleteApp(existing);
  }

  currentConfig = cfg;
  localStorage.setItem(LS_FIREBASE_CFG, JSON.stringify(cfg));

  currentApp = initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  });

  currentAuth = getAuth(currentApp);
  currentDb =
    cfg.databaseId && cfg.databaseId !== '(default)'
      ? getFirestore(currentApp, cfg.databaseId)
      : getFirestore(currentApp);

  let authUser: User | null = currentAuth.currentUser;
  let authWarning = '';

  if (!authUser) {
    try {
      const cred = await signInAnonymously(currentAuth);
      authUser = cred.user;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      authWarning = msg.includes('admin-restricted-operation') || msg.includes('configuration-not-found')
        ? 'Anonymní přihlášení není ve Firebase Console povoleno (zapněte Authentication → Sign-in method → Anonymous nebo Google).'
        : `Upozornění přihlášení: ${msg}`;
    }
  }

  onAuthStateChanged(currentAuth, (user) => {
    callbacks.onStateChange({
      mode: 'firebase',
      connected: Boolean(currentDb),
      projectId: cfg.projectId,
      uid: user?.uid || '',
      authEmail: user?.email || '',
      error: user ? '' : authWarning,
    });
  });

  const db = currentDb;

  // Check if checklist_items collection is empty; if so, seed ČEZ Distribuce defaults
  try {
    const existingSnap = await getDocs(collection(db, 'checklist_items'));
    if (existingSnap.empty) {
      await seedDefaultsToFirestore();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onStateChange({
      mode: 'firebase',
      connected: false,
      projectId: cfg.projectId,
      uid: currentAuth.currentUser?.uid || '',
      authEmail: currentAuth.currentUser?.email || '',
      error: authWarning || `Chyba přístupu do Firestore: ${msg}`,
    });
    return;
  }

  // Real-time listener on checklist_items
  const itemsQuery = query(collection(db, 'checklist_items'), orderBy('order', 'asc'));
  unsubItems = onSnapshot(
    itemsQuery,
    (snapshot) => {
      const items: ChecklistItemTemplate[] = [];
      let foundGroupsMeta = false;

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (docSnap.id === GROUPS_META_DOC_ID) {
          foundGroupsMeta = true;
          try {
            const parsed = JSON.parse(String(d.description || '')) as PhaseGroup[];
            if (
              Array.isArray(parsed) &&
              parsed.every((g) => g && typeof g.id === 'string' && typeof g.title === 'string')
            ) {
              saveLocalGroups(parsed);
              callbacks.onGroupsUpdate?.(parsed);
            }
          } catch {
            // Ignore malformed groups metadata
          }
          return;
        }

        const decoded = decodePhaseFromFirestore(d.phase, d.deadlineBadge);
        items.push({
          id: docSnap.id,
          title: String(d.title || ''),
          description: String(d.description || ''),
          phase: decoded.phase,
          order: Number(d.order ?? 100),
          reference: String(d.reference || ''),
          deadlineBadge: decoded.deadlineBadge,
          mandatory: Boolean(d.mandatory ?? true),
          categories: Array.isArray(d.categories) ? d.categories : [],
          voltages: Array.isArray(d.voltages) ? d.voltages : [],
          technologies: Array.isArray(d.technologies) ? d.technologies : [],
          exportModes: Array.isArray(d.exportModes) ? d.exportModes : [],
          requiredFlags: Array.isArray(d.requiredFlags) ? d.requiredFlags : [],
          createdBy: String(d.createdBy || 'system'),
          updatedAtIso: timestampToIso(d.updatedAt),
        });
      });

      groupsDocExistsInFirestore = foundGroupsMeta;
      saveLocalItems(items);
      callbacks.onItemsUpdate(items);
      callbacks.onStateChange({
        mode: 'firebase',
        connected: true,
        projectId: cfg.projectId,
        uid: currentAuth?.currentUser?.uid || '',
        authEmail: currentAuth?.currentUser?.email || '',
        error: '',
      });
    },
    (err) => {
      callbacks.onStateChange({
        mode: 'firebase',
        connected: false,
        projectId: cfg.projectId,
        uid: currentAuth?.currentUser?.uid || '',
        authEmail: currentAuth?.currentUser?.email || '',
        error: `Firestore posluchač (checklist_items): ${err.message}`,
      });
    }
  );

  // Real-time listener on shared admin password hash
  const adminDocRef = doc(db, 'projects', ADMIN_CONFIG_DOC_ID);
  unsubAdminConfig = onSnapshot(
    adminDocRef,
    (docSnap) => {
      const notes = docSnap.exists() ? docSnap.data()?.itemNotes : null;
      const hash =
        notes && typeof notes === 'object' && typeof notes.adminPasswordHash === 'string'
          ? notes.adminPasswordHash
          : null;
      saveCachedAdminHash(hash);
      callbacks.onAdminHashUpdate?.(hash);
    },
    () => {
      // Ignore transient listener errors; login falls back to cached/fetched hash
    }
  );

  // Real-time listener on projects
  const projectsQuery = query(collection(db, 'projects'), orderBy('updatedAt', 'desc'));
  unsubProjects = onSnapshot(
    projectsQuery,
    (snapshot) => {
      const projects: SavedProject[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id === ADMIN_CONFIG_DOC_ID) return;
        const d = docSnap.data();
        projects.push({
          id: docSnap.id,
          name: String(d.name || 'Nepojmenovaný zdroj'),
          contractNumber: String(d.contractNumber || ''),
          eanCode: String(d.eanCode || ''),
          installedPowerKw: Number(d.installedPowerKw ?? 0),
          category: d.category,
          voltage: d.voltage,
          technology: d.technology,
          exportMode: d.exportMode,
          flags: Array.isArray(d.flags) ? d.flags : [],
          checkedIds: Array.isArray(d.checkedIds) ? d.checkedIds : [],
          itemNotes: d.itemNotes && typeof d.itemNotes === 'object' ? d.itemNotes : {},
          createdBy: String(d.createdBy || ''),
          createdAtIso: timestampToIso(d.createdAt),
          updatedAtIso: timestampToIso(d.updatedAt),
        });
      });
      saveLocalProjects(projects);
      callbacks.onProjectsUpdate(projects);
    },
    (err) => {
      callbacks.onStateChange({
        mode: 'firebase',
        connected: false,
        projectId: cfg.projectId,
        uid: currentAuth?.currentUser?.uid || '',
        authEmail: currentAuth?.currentUser?.email || '',
        error: `Firestore posluchač (projects): ${err.message}`,
      });
    }
  );
}

export async function signInWithGoogleFirebase(): Promise<void> {
  if (!currentAuth) throw new Error('Firebase není inicializován.');
  const provider = new GoogleAuthProvider();
  await signInWithPopup(currentAuth, provider);
}

export function isFirebaseConnected(): boolean {
  return Boolean(currentDb && currentConfig);
}

export function getActiveConfig(): FirebaseClientConfig | null {
  return currentConfig;
}

// ============================================================================
// CRUD Operations (Cloud Firestore + Local Storage Dual Support)
// ============================================================================
export async function seedDefaultsToFirestore(): Promise<void> {
  if (!currentDb) {
    saveLocalItems([...CEZ_DEFAULT_ITEMS]);
    return;
  }
  const uid = currentAuth?.currentUser?.uid || 'system';
  const batch = writeBatch(currentDb);
  for (const item of CEZ_DEFAULT_ITEMS) {
    const ref = doc(currentDb, 'checklist_items', item.id);
    batch.set(ref, {
      title: item.title,
      description: item.description,
      phase: item.phase,
      order: item.order,
      reference: item.reference,
      deadlineBadge: item.deadlineBadge,
      mandatory: item.mandatory,
      categories: item.categories,
      voltages: item.voltages,
      technologies: item.technologies,
      exportModes: item.exportModes,
      requiredFlags: item.requiredFlags,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function upsertChecklistItem(
  item: ChecklistItemTemplate,
  isNew: boolean
): Promise<ChecklistItemTemplate> {
  const nowIso = new Date().toISOString();
  const uid = currentAuth?.currentUser?.uid || item.createdBy || 'local-user';
  const safeTitle = item.title.trim();
  const safeDescription = item.description.trim() || safeTitle;
  const updated: ChecklistItemTemplate = {
    ...item,
    title: safeTitle,
    description: safeDescription,
    createdBy: isNew ? uid : item.createdBy || uid,
    updatedAtIso: nowIso,
  };

  if (currentDb) {
    const ref = doc(currentDb, 'checklist_items', updated.id);
    const encoded = encodePhaseForFirestore(updated.phase, updated.deadlineBadge);
    if (isNew) {
      await setDoc(ref, {
        title: updated.title,
        description: updated.description,
        phase: encoded.phase,
        order: updated.order,
        reference: updated.reference,
        deadlineBadge: encoded.deadlineBadge,
        mandatory: updated.mandatory,
        categories: updated.categories,
        voltages: updated.voltages,
        technologies: updated.technologies,
        exportModes: updated.exportModes,
        requiredFlags: updated.requiredFlags,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title: updated.title,
        description: updated.description,
        phase: encoded.phase,
        order: updated.order,
        reference: updated.reference,
        deadlineBadge: encoded.deadlineBadge,
        mandatory: updated.mandatory,
        categories: updated.categories,
        voltages: updated.voltages,
        technologies: updated.technologies,
        exportModes: updated.exportModes,
        requiredFlags: updated.requiredFlags,
        updatedAt: serverTimestamp(),
      });
    }
  } else {
    const current = loadLocalItems();
    const idx = current.findIndex((i) => i.id === updated.id);
    if (idx >= 0) {
      current[idx] = updated;
    } else {
      current.push(updated);
    }
    current.sort((a, b) => a.order - b.order);
    saveLocalItems(current);
  }

  return updated;
}

export async function reorderChecklistItems(
  updates: { id: string; phase: PhaseId; order: number }[]
): Promise<void> {
  if (updates.length === 0) return;

  if (currentDb) {
    const batch = writeBatch(currentDb);
    for (const u of updates) {
      const ref = doc(currentDb, 'checklist_items', u.id);
      const encoded = encodePhaseForFirestore(u.phase);
      batch.update(ref, {
        phase: encoded.phase,
        deadlineBadge: encoded.deadlineBadge,
        order: u.order,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } else {
    const byId = new Map(updates.map((u) => [u.id, u]));
    const nowIso = new Date().toISOString();
    const next = loadLocalItems()
      .map((item) => {
        const u = byId.get(item.id);
        return u ? { ...item, phase: u.phase, order: u.order, updatedAtIso: nowIso } : item;
      })
      .sort((a, b) => a.order - b.order);
    saveLocalItems(next);
  }
}

export async function removeChecklistItem(id: string): Promise<void> {
  if (currentDb) {
    await deleteDoc(doc(currentDb, 'checklist_items', id));
  } else {
    const next = loadLocalItems().filter((i) => i.id !== id);
    saveLocalItems(next);
  }
}

export async function fetchAdminPasswordHash(): Promise<string | null> {
  if (!currentDb) return null;
  const ref = doc(currentDb, 'projects', ADMIN_CONFIG_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const notes = snap.data()?.itemNotes;
  const hash =
    notes && typeof notes === 'object' && typeof notes.adminPasswordHash === 'string'
      ? notes.adminPasswordHash
      : null;
  saveCachedAdminHash(hash);
  return hash;
}

export async function saveAdminPasswordHash(newHash: string): Promise<void> {
  if (!currentDb) {
    saveCachedAdminHash(newHash);
    return;
  }
  const uid = currentAuth?.currentUser?.uid;
  if (!uid) {
    throw new Error('Databáze není přihlášena, heslo nelze uložit.');
  }
  const ref = doc(currentDb, 'projects', ADMIN_CONFIG_DOC_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, {
      itemNotes: { adminPasswordHash: newHash },
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      name: '__admin_auth__',
      contractNumber: '',
      eanCode: '',
      installedPowerKw: 0,
      category: 'MIKROZDROJ',
      voltage: 'NN',
      technology: 'FVE',
      exportMode: 'STANDARD_PRETOKY',
      flags: [],
      checkedIds: [],
      itemNotes: { adminPasswordHash: newHash },
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  saveCachedAdminHash(newHash);
}

export async function removeChecklistItemsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (currentDb) {
    const batch = writeBatch(currentDb);
    for (const id of ids) {
      batch.delete(doc(currentDb, 'checklist_items', id));
    }
    await batch.commit();
  } else {
    const idSet = new Set(ids);
    const next = loadLocalItems().filter((i) => !idSet.has(i.id));
    saveLocalItems(next);
  }
}

export async function saveGroups(groups: PhaseGroup[]): Promise<void> {
  saveLocalGroups(groups);
  if (!currentDb) return;

  const ref = doc(currentDb, 'checklist_items', GROUPS_META_DOC_ID);
  const serialized = JSON.stringify(groups);
  const uid = currentAuth?.currentUser?.uid || 'local-user';

  if (groupsDocExistsInFirestore) {
    await updateDoc(ref, {
      description: serialized,
      updatedAt: serverTimestamp(),
    });
  } else {
    try {
      await setDoc(ref, {
        title: '__groups__',
        description: serialized,
        phase: 'FAZE_1_PRIPRAVA',
        order: 0,
        reference: '',
        deadlineBadge: '',
        mandatory: true,
        categories: [],
        voltages: [],
        technologies: [],
        exportModes: [],
        requiredFlags: [],
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      groupsDocExistsInFirestore = true;
    } catch {
      // Document may have been created concurrently by another user; fall back to updateDoc
      await updateDoc(ref, {
        description: serialized,
        updatedAt: serverTimestamp(),
      });
      groupsDocExistsInFirestore = true;
    }
  }
}

export async function upsertSavedProject(
  project: SavedProject,
  isNew: boolean
): Promise<SavedProject> {
  const nowIso = new Date().toISOString();
  const uid = currentAuth?.currentUser?.uid || project.createdBy || 'local-user';
  const saved: SavedProject = {
    ...project,
    createdBy: isNew ? uid : project.createdBy || uid,
    createdAtIso: isNew ? nowIso : project.createdAtIso || nowIso,
    updatedAtIso: nowIso,
  };

  if (currentDb) {
    const ref = doc(currentDb, 'projects', saved.id);
    if (isNew) {
      await setDoc(ref, {
        name: saved.name,
        contractNumber: saved.contractNumber,
        eanCode: saved.eanCode,
        installedPowerKw: saved.installedPowerKw,
        category: saved.category,
        voltage: saved.voltage,
        technology: saved.technology,
        exportMode: saved.exportMode,
        flags: saved.flags,
        checkedIds: saved.checkedIds,
        itemNotes: saved.itemNotes,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: saved.name,
        contractNumber: saved.contractNumber,
        eanCode: saved.eanCode,
        installedPowerKw: saved.installedPowerKw,
        category: saved.category,
        voltage: saved.voltage,
        technology: saved.technology,
        exportMode: saved.exportMode,
        flags: saved.flags,
        checkedIds: saved.checkedIds,
        itemNotes: saved.itemNotes,
        updatedAt: serverTimestamp(),
      });
    }
  } else {
    const current = loadLocalProjects();
    const idx = current.findIndex((p) => p.id === saved.id);
    if (idx >= 0) {
      current[idx] = saved;
    } else {
      current.unshift(saved);
    }
    saveLocalProjects(current);
  }

  return saved;
}

export async function removeSavedProject(id: string): Promise<void> {
  if (currentDb) {
    await deleteDoc(doc(currentDb, 'projects', id));
  } else {
    const next = loadLocalProjects().filter((p) => p.id !== id);
    saveLocalProjects(next);
  }
}

export async function syncLocalItemsAndProjectsToCloud(
  items: ChecklistItemTemplate[],
  projects: SavedProject[]
): Promise<void> {
  if (!currentDb) throw new Error('Firebase Firestore není připojen.');
  const uid = currentAuth?.currentUser?.uid || 'system';
  const batch = writeBatch(currentDb);

  for (const item of items) {
    const ref = doc(currentDb, 'checklist_items', item.id);
    batch.set(ref, {
      title: item.title,
      description: item.description,
      phase: item.phase,
      order: item.order,
      reference: item.reference,
      deadlineBadge: item.deadlineBadge,
      mandatory: item.mandatory,
      categories: item.categories,
      voltages: item.voltages,
      technologies: item.technologies,
      exportModes: item.exportModes,
      requiredFlags: item.requiredFlags,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const p of projects) {
    const ref = doc(currentDb, 'projects', p.id);
    batch.set(ref, {
      name: p.name,
      contractNumber: p.contractNumber,
      eanCode: p.eanCode,
      installedPowerKw: p.installedPowerKw,
      category: p.category,
      voltage: p.voltage,
      technology: p.technology,
      exportMode: p.exportMode,
      flags: p.flags,
      checkedIds: p.checkedIds,
      itemNotes: p.itemNotes,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}
