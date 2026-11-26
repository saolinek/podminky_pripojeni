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
  type CustomerType,
  type FeedbackCategory,
  type FeedbackEntry,
  PHASES,
  type PhaseGroup,
  type PhaseId,
  type PiRange,
  type RpRange,
  type RvRange,
  type SavedProject,
  type VoltageLevel,
  type VyrobnaType,
  type YesNo,
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
const LS_ITEMS_KEY = 'cez_pripojeni_items_v2';
const LS_GROUPS_KEY = 'cez_pripojeni_groups_v1';
const LS_PROJECTS_KEY = 'cez_pripojeni_projects_v1';
const LS_FEEDBACK_KEY = 'cez_pripojeni_feedback_v1';
const ADMIN_CONFIG_DOC_ID = 'sys_admin_config';
const FEEDBACK_DOC_PREFIX = 'fb-';

const GROUPS_META_DOC_ID = 'meta_groups_v1';
const CUSTOM_GROUP_PREFIX = 'grp:';
const FILTER_V2_PREFIX = 'f2:';

const CT_ENC: Record<CustomerType, string> = { LDS: 'L', ODBERATEL: 'O' };
const CT_DEC: Record<string, CustomerType> = { L: 'LDS', O: 'ODBERATEL' };

const PI_ENC: Record<PiRange, string> = {
  DO_100: '0',
  NAD_100: '1',
  NAD_400: '4',
  NAD_1000: 'k',
};
const PI_DEC: Record<string, PiRange> = {
  '0': 'DO_100',
  '1': 'NAD_100',
  '4': 'NAD_400',
  k: 'NAD_1000',
};

const RV_ENC: Record<RvRange, string> = { DO_1MW: '0', NAD_1MW: '1' };
const RV_DEC: Record<string, RvRange> = { '0': 'DO_1MW', '1': 'NAD_1MW' };

const RP_ENC: Record<RpRange, string> = { DO_100: '0', NAD_100: '1', NAD_1000: 'k' };
const RP_DEC: Record<string, RpRange> = { '0': 'DO_100', '1': 'NAD_100', k: 'NAD_1000' };

const YN_ENC: Record<YesNo, string> = { ANO: 'A', NE: 'N' };
const YN_DEC: Record<string, YesNo> = { A: 'ANO', N: 'NE' };

const VT_ENC: Record<VyrobnaType, string> = {
  FVE: 'F',
  ZUE: 'Z',
  FVE_ZUE_SPOLECNY: 'S',
  FVE_ZUE_SAMOSTATNE: 'M',
  KGJ_SYNCHRONNI: 'Y',
  KGJ_NESYNCHRONNI: 'N',
  KGJ_KOMBINACE: 'K',
};
const VT_DEC: Record<string, VyrobnaType> = {
  F: 'FVE',
  Z: 'ZUE',
  S: 'FVE_ZUE_SPOLECNY',
  M: 'FVE_ZUE_SAMOSTATNE',
  Y: 'KGJ_SYNCHRONNI',
  N: 'KGJ_NESYNCHRONNI',
  K: 'KGJ_KOMBINACE',
};

function encodeFiltersForFirestore(item: ChecklistItemTemplate): string {
  const parts: string[] = [];
  if (item.customerTypes.length > 0) {
    parts.push(`ct=${item.customerTypes.map((x) => CT_ENC[x]).join(',')}`);
  }
  if (item.piRanges.length > 0) {
    parts.push(`pi=${item.piRanges.map((x) => PI_ENC[x]).join(',')}`);
  }
  if (item.rvRanges.length > 0) {
    parts.push(`rv=${item.rvRanges.map((x) => RV_ENC[x]).join(',')}`);
  }
  if (item.rpRanges.length > 0) {
    parts.push(`rp=${item.rpRanges.map((x) => RP_ENC[x]).join(',')}`);
  }
  if (item.svrFilter.length > 0) {
    parts.push(`svr=${item.svrFilter.map((x) => YN_ENC[x]).join(',')}`);
  }
  if (item.vyrobnaTypes.length > 0) {
    parts.push(`vt=${item.vyrobnaTypes.map((x) => VT_ENC[x]).join(',')}`);
  }
  return `${FILTER_V2_PREFIX}${parts.join(';')}`.slice(0, 200);
}

function decodeFiltersFromFirestore(rawRef: unknown): {
  customerTypes: CustomerType[];
  piRanges: PiRange[];
  rvRanges: RvRange[];
  rpRanges: RpRange[];
  svrFilter: YesNo[];
  vyrobnaTypes: VyrobnaType[];
  reference: string;
} {
  const str = String(rawRef || '');
  const empty = {
    customerTypes: [] as CustomerType[],
    piRanges: [] as PiRange[],
    rvRanges: [] as RvRange[],
    rpRanges: [] as RpRange[],
    svrFilter: [] as YesNo[],
    vyrobnaTypes: [] as VyrobnaType[],
    reference: str.startsWith(FILTER_V2_PREFIX) ? '' : str,
  };
  if (!str.startsWith(FILTER_V2_PREFIX)) {
    return empty;
  }
  const body = str.slice(FILTER_V2_PREFIX.length);
  if (!body) return empty;

  for (const seg of body.split(';')) {
    const eq = seg.indexOf('=');
    if (eq < 0) continue;
    const key = seg.slice(0, eq);
    const vals = seg.slice(eq + 1).split(',').filter(Boolean);
    if (key === 'ct') {
      empty.customerTypes = vals.map((v) => CT_DEC[v]).filter((x): x is CustomerType => Boolean(x));
    } else if (key === 'pi') {
      empty.piRanges = vals.map((v) => PI_DEC[v]).filter((x): x is PiRange => Boolean(x));
    } else if (key === 'rv') {
      empty.rvRanges = vals.map((v) => RV_DEC[v]).filter((x): x is RvRange => Boolean(x));
    } else if (key === 'rp') {
      empty.rpRanges = vals.map((v) => RP_DEC[v]).filter((x): x is RpRange => Boolean(x));
    } else if (key === 'svr') {
      empty.svrFilter = vals.map((v) => YN_DEC[v]).filter((x): x is YesNo => Boolean(x));
    } else if (key === 'vt') {
      empty.vyrobnaTypes = vals.map((v) => VT_DEC[v]).filter((x): x is VyrobnaType => Boolean(x));
    }
  }
  return empty;
}

function filterValidVoltages(raw: unknown): VoltageLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is VoltageLevel => v === 'NN' || v === 'VN');
}

function normalizeChecklistItem(raw: Partial<ChecklistItemTemplate>): ChecklistItemTemplate {
  return {
    id: String(raw.id || ''),
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    phase: String(raw.phase || 'FAZE_1_PRIPRAVA'),
    order: Number(raw.order ?? 100),
    reference: String(raw.reference || ''),
    deadlineBadge: String(raw.deadlineBadge || ''),
    mandatory: Boolean(raw.mandatory ?? true),
    customerTypes: Array.isArray(raw.customerTypes) ? raw.customerTypes : [],
    voltages: filterValidVoltages(raw.voltages),
    piRanges: Array.isArray(raw.piRanges) ? raw.piRanges : [],
    rvRanges: Array.isArray(raw.rvRanges) ? raw.rvRanges : [],
    rpRanges: Array.isArray(raw.rpRanges) ? raw.rpRanges : [],
    svrFilter: Array.isArray(raw.svrFilter) ? raw.svrFilter : [],
    vyrobnaTypes: Array.isArray(raw.vyrobnaTypes) ? raw.vyrobnaTypes : [],
    createdBy: String(raw.createdBy || 'system'),
    updatedAtIso: String(raw.updatedAtIso || new Date().toISOString()),
  };
}

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
      const parsed = JSON.parse(raw) as Partial<ChecklistItemTemplate>[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeChecklistItem).sort((a, b) => a.order - b.order);
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

export function loadLocalFeedback(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(LS_FEEDBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FeedbackEntry[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

export function saveLocalFeedback(entries: FeedbackEntry[]): void {
  localStorage.setItem(LS_FEEDBACK_KEY, JSON.stringify(entries));
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
    onFeedbackUpdate?: (entries: FeedbackEntry[]) => void;
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
        const decodedFilters = decodeFiltersFromFirestore(d.reference);
        items.push({
          id: docSnap.id,
          title: String(d.title || ''),
          description: String(d.description || ''),
          phase: decoded.phase,
          order: Number(d.order ?? 100),
          reference: decodedFilters.reference,
          deadlineBadge: decoded.deadlineBadge,
          mandatory: Boolean(d.mandatory ?? true),
          customerTypes: decodedFilters.customerTypes,
          voltages: filterValidVoltages(d.voltages),
          piRanges: decodedFilters.piRanges,
          rvRanges: decodedFilters.rvRanges,
          rpRanges: decodedFilters.rpRanges,
          svrFilter: decodedFilters.svrFilter,
          vyrobnaTypes: decodedFilters.vyrobnaTypes,
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
      const feedbackEntries: FeedbackEntry[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id === ADMIN_CONFIG_DOC_ID) return;
        const d = docSnap.data();
        if (docSnap.id.startsWith(FEEDBACK_DOC_PREFIX)) {
          const notes = d.itemNotes && typeof d.itemNotes === 'object' ? d.itemNotes : {};
          const rawCat = String(d.contractNumber || '');
          const validCategory: FeedbackCategory =
            rawCat === 'NAPAD' || rawCat === 'CHYBA' || rawCat === 'PODMINKA' || rawCat === 'JINE'
              ? rawCat
              : 'JINE';
          feedbackEntries.push({
            id: docSnap.id,
            category: validCategory,
            rating: Number.isFinite(Number(d.installedPowerKw)) ? Number(d.installedPowerKw) : 0,
            message: String((notes as Record<string, unknown>).message || ''),
            authorName: String((notes as Record<string, unknown>).authorName || ''),
            createdBy: String(d.createdBy || ''),
            createdAtIso: timestampToIso(d.createdAt),
          });
          return;
        }
        projects.push({
          id: docSnap.id,
          name: String(d.name || 'Nepojmenovaný zdroj'),
          contractNumber: String(d.contractNumber || ''),
          eanCode: String(d.eanCode || ''),
          customerType: d.customerType === 'LDS' ? 'LDS' : 'ODBERATEL',
          voltage: d.voltage === 'VN' ? 'VN' : 'NN',
          pi:
            d.pi === 'DO_100' || d.pi === 'NAD_100' || d.pi === 'NAD_400' || d.pi === 'NAD_1000'
              ? d.pi
              : null,
          rv: d.rv === 'DO_1MW' || d.rv === 'NAD_1MW' ? d.rv : null,
          rp:
            d.rp === 'DO_100' || d.rp === 'NAD_100' || d.rp === 'NAD_1000'
              ? d.rp
              : 'DO_100',
          svr: Boolean(d.svr),
          vyrobnaTypes: Array.isArray(d.vyrobnaTypes)
            ? d.vyrobnaTypes
            : d.vyrobnaType
              ? [d.vyrobnaType]
              : [],
          checkedIds: Array.isArray(d.checkedIds) ? d.checkedIds : [],
          itemNotes: d.itemNotes && typeof d.itemNotes === 'object' ? d.itemNotes : {},
          createdBy: String(d.createdBy || ''),
          createdAtIso: timestampToIso(d.createdAt),
          updatedAtIso: timestampToIso(d.updatedAt),
        });
      });
      saveLocalProjects(projects);
      saveLocalFeedback(feedbackEntries);
      callbacks.onProjectsUpdate(projects);
      callbacks.onFeedbackUpdate?.(feedbackEntries);
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
    const encoded = encodePhaseForFirestore(item.phase, item.deadlineBadge);
    batch.set(ref, {
      title: item.title,
      description: item.description,
      phase: encoded.phase,
      order: item.order,
      reference: encodeFiltersForFirestore(item),
      deadlineBadge: encoded.deadlineBadge,
      mandatory: item.mandatory,
      categories: [],
      voltages: item.voltages,
      technologies: [],
      exportModes: [],
      requiredFlags: [],
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
    const encodedFilters = encodeFiltersForFirestore(updated);
    if (isNew) {
      await setDoc(ref, {
        title: updated.title,
        description: updated.description,
        phase: encoded.phase,
        order: updated.order,
        reference: encodedFilters,
        deadlineBadge: encoded.deadlineBadge,
        mandatory: updated.mandatory,
        categories: [],
        voltages: updated.voltages,
        technologies: [],
        exportModes: [],
        requiredFlags: [],
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
        reference: encodedFilters,
        deadlineBadge: encoded.deadlineBadge,
        mandatory: updated.mandatory,
        categories: [],
        voltages: updated.voltages,
        technologies: [],
        exportModes: [],
        requiredFlags: [],
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
        installedPowerKw: 0,
        category: 'MIKROZDROJ',
        voltage: saved.voltage,
        technology: 'FVE',
        exportMode: 'STANDARD_PRETOKY',
        flags: [],
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
        installedPowerKw: 0,
        category: 'MIKROZDROJ',
        voltage: saved.voltage,
        technology: 'FVE',
        exportMode: 'STANDARD_PRETOKY',
        flags: [],
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
    const encoded = encodePhaseForFirestore(item.phase, item.deadlineBadge);
    batch.set(ref, {
      title: item.title,
      description: item.description,
      phase: encoded.phase,
      order: item.order,
      reference: encodeFiltersForFirestore(item),
      deadlineBadge: encoded.deadlineBadge,
      mandatory: item.mandatory,
      categories: [],
      voltages: item.voltages,
      technologies: [],
      exportModes: [],
      requiredFlags: [],
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
      installedPowerKw: 0,
      category: 'MIKROZDROJ',
      voltage: p.voltage,
      technology: 'FVE',
      exportMode: 'STANDARD_PRETOKY',
      flags: [],
      checkedIds: p.checkedIds,
      itemNotes: p.itemNotes,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function submitFeedback(input: {
  category: FeedbackCategory;
  rating: number;
  message: string;
  authorName: string;
}): Promise<FeedbackEntry> {
  const trimmedMessage = input.message.trim().slice(0, 2000);
  if (!trimmedMessage) {
    throw new Error('Zpráva zpětné vazby nesmí být prázdná.');
  }

  const trimmedAuthor = input.authorName.trim().slice(0, 120);
  const safeRating = Math.max(0, Math.min(5, Math.round(input.rating)));
  const id = `${FEEDBACK_DOC_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();

  if (currentDb) {
    const uid = currentAuth?.currentUser?.uid;
    if (!uid) {
      throw new Error('Databáze není přihlášena, zpětnou vazbu nelze odeslat.');
    }
    const ref = doc(currentDb, 'projects', id);
    await setDoc(ref, {
      name: '__feedback__',
      contractNumber: input.category,
      eanCode: '',
      installedPowerKw: safeRating,
      category: 'MIKROZDROJ',
      voltage: 'NN',
      technology: 'FVE',
      exportMode: 'STANDARD_PRETOKY',
      flags: [],
      checkedIds: [],
      itemNotes: {
        message: trimmedMessage,
        authorName: trimmedAuthor,
      },
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id,
      category: input.category,
      rating: safeRating,
      message: trimmedMessage,
      authorName: trimmedAuthor,
      createdBy: uid,
      createdAtIso: nowIso,
    };
  }

  const entry: FeedbackEntry = {
    id,
    category: input.category,
    rating: safeRating,
    message: trimmedMessage,
    authorName: trimmedAuthor,
    createdBy: 'local-user',
    createdAtIso: nowIso,
  };
  const current = loadLocalFeedback();
  saveLocalFeedback([entry, ...current]);
  return entry;
}

export async function removeFeedback(id: string): Promise<void> {
  if (currentDb) {
    await deleteDoc(doc(currentDb, 'projects', id));
  } else {
    const next = loadLocalFeedback().filter((f) => f.id !== id);
    saveLocalFeedback(next);
  }
}
