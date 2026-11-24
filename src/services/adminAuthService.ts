export type AdminRole = 'admin' | 'superadmin';

const HASH_SALT = 'cez-podminky-pripojeni-v1:';
const SS_ADMIN_SESSION_KEY = 'cez_pripojeni_admin_session_v1';
const LS_ADMIN_HASH_CACHE_KEY = 'cez_pripojeni_admin_hash_v1';

// Immutable superadmin password hash (cannot be changed in the app)
export const SUPERADMIN_PASSWORD_HASH =
  'eaef78e31db62fd633c1e89b33554a52c74cc537c34f2ae768b796e23ea6bfbd';

// Initial admin password hash used before an admin/superadmin sets a custom password in DB
export const DEFAULT_ADMIN_PASSWORD_HASH =
  '878c7b86e74feab4bb672aaf27d5c807a75505ac6b70b51ec63b89d8425eef7c';

export const MIN_ADMIN_PASSWORD_LENGTH = 4;

interface StoredAdminSession {
  role: AdminRole;
  adminHash: string;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const buffer = new Uint8Array(paddedLen);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;

  const view = new DataView(buffer.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => x.toString(16).padStart(8, '0'))
    .join('');
}

export function hashPassword(password: string): string {
  return sha256Hex(`${HASH_SALT}${password}`);
}

export function getEffectiveAdminHash(storedAdminHash: string | null): string {
  return storedAdminHash && /^[a-f0-9]{64}$/.test(storedAdminHash)
    ? storedAdminHash
    : DEFAULT_ADMIN_PASSWORD_HASH;
}

export function verifyLoginPassword(
  password: string,
  storedAdminHash: string | null
): AdminRole | null {
  if (!password) return null;
  const candidateHash = hashPassword(password);
  // Always check superadmin first so immutable superadmin access can never be shadowed
  if (candidateHash === SUPERADMIN_PASSWORD_HASH) {
    return 'superadmin';
  }
  if (candidateHash === getEffectiveAdminHash(storedAdminHash)) {
    return 'admin';
  }
  return null;
}

export function verifyCanChangeAdminPassword(
  role: AdminRole,
  currentPasswordInput: string,
  storedAdminHash: string | null
): boolean {
  if (role === 'superadmin') return true;
  return verifyLoginPassword(currentPasswordInput, storedAdminHash) !== null;
}

export function loadCachedAdminHash(): string | null {
  try {
    const val = localStorage.getItem(LS_ADMIN_HASH_CACHE_KEY);
    if (val && /^[a-f0-9]{64}$/.test(val)) return val;
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function saveCachedAdminHash(hash: string | null): void {
  try {
    if (hash && /^[a-f0-9]{64}$/.test(hash)) {
      localStorage.setItem(LS_ADMIN_HASH_CACHE_KEY, hash);
    } else {
      localStorage.removeItem(LS_ADMIN_HASH_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function saveAdminSession(role: AdminRole, storedAdminHash: string | null): void {
  try {
    const payload: StoredAdminSession = {
      role,
      adminHash: getEffectiveAdminHash(storedAdminHash),
    };
    sessionStorage.setItem(SS_ADMIN_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore sessionStorage errors
  }
}

export function loadAdminSession(storedAdminHash: string | null): AdminRole | null {
  try {
    const raw = sessionStorage.getItem(SS_ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAdminSession>;
    if (parsed.role === 'superadmin') {
      return 'superadmin';
    }
    if (parsed.role === 'admin' && parsed.adminHash === getEffectiveAdminHash(storedAdminHash)) {
      return 'admin';
    }
  } catch {
    // Ignore sessionStorage errors
  }
  return null;
}

export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(SS_ADMIN_SESSION_KEY);
  } catch {
    // Ignore sessionStorage errors
  }
}
