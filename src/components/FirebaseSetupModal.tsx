import React, { useState } from 'react';
import { CheckCircle2, Cloud, Copy, LogIn, RefreshCw, Unplug, X } from 'lucide-react';
import {
  buildShareableUrlWithFirebase,
  type DbConnectionState,
  type FirebaseClientConfig,
  getActiveConfig,
  parseFirebaseConfigSnippet,
  signInWithGoogleFirebase,
} from '../services/firebaseService';

interface FirebaseSetupModalProps {
  dbState: DbConnectionState;
  onClose: () => void;
  onConnectConfig: (cfg: FirebaseClientConfig) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSyncLocalToCloud: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const FirebaseSetupModal: React.FC<FirebaseSetupModalProps> = ({
  dbState,
  onClose,
  onConnectConfig,
  onDisconnect,
  onSyncLocalToCloud,
  onShowToast,
}) => {
  const existing = getActiveConfig();
  const [rawSnippet, setRawSnippet] = useState(
    existing ? JSON.stringify(existing, null, 2) : ''
  );
  const [databaseId, setDatabaseId] = useState(existing?.databaseId || '');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const parsed = parseFirebaseConfigSnippet(rawSnippet, databaseId);
      setBusy(true);
      await onConnectConfig(parsed);
      onShowToast(`Připojeno k Firebase projektu: ${parsed.projectId}`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyShareLink = async () => {
    const cfg = getActiveConfig();
    if (!cfg) return;
    const shareUrl = buildShareableUrlWithFirebase(cfg);
    await navigator.clipboard.writeText(shareUrl);
    onShowToast('Sdílený odkaz s konfigurací Firebase zkopírován do schránky!');
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Cloud size={20} color="var(--cez-orange)" />
            <h3>Sdílená cloudová databáze Firebase Firestore</h3>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Status Banner */}
          {dbState.mode === 'firebase' && dbState.connected ? (
            <div
              className="reg-alert"
              style={{
                background: 'var(--status-ok-bg)',
                border: '1px solid var(--status-ok-border)',
                color: 'var(--status-ok)',
                marginBottom: '1rem',
              }}
            >
              <CheckCircle2 size={18} />
              <div style={{ flex: 1 }}>
                <strong>Připojeno k Firebase Firestore ({dbState.projectId})</strong>
                <div style={{ fontSize: '0.76rem', marginTop: '0.2rem' }}>
                  Veškeré úpravy šablon i uložených projektů se v reálném čase synchronizují do
                  sdílené databáze.{' '}
                  {dbState.authEmail
                    ? `Přihlášen: ${dbState.authEmail}`
                    : dbState.uid
                    ? `Relace ověřena (UID: ${dbState.uid.slice(0, 8)}…)`
                    : ''}
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyShareLink}
                  >
                    <Copy size={13} />
                    Kopírovat sdílený odkaz pro kolegy
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onSyncLocalToCloud();
                        onShowToast('Lokální položky a projekty nahrány do Firestore!');
                      } catch (err: unknown) {
                        setFormError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    <RefreshCw size={13} />
                    Nahrát lokální data do cloudu
                  </button>
                  {!dbState.authEmail && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        try {
                          await signInWithGoogleFirebase();
                          onShowToast('Přihlášení přes Google účet proběhlo úspěšně.');
                        } catch (err: unknown) {
                          setFormError(err instanceof Error ? err.message : String(err));
                        }
                      }}
                    >
                      <LogIn size={13} />
                      Přihlásit Google účtem
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="reg-alert info" style={{ marginBottom: '1rem' }}>
              <Cloud size={18} />
              <div>
                <strong>Aplikace je plně připravena pro Firebase Firestore:</strong> Dokud níže
                nevložíte konfiguraci <code>firebaseConfig</code> vašeho projektu (nebo proměnné{' '}
                <code>VITE_FIREBASE_*</code>), ukládají se úpravy bezpečně v prohlížeči. Po vložení
                konfigurace se databáze <strong>automaticky naplní všemi podmínkami ČEZ Distribuce</strong>!
              </div>
            </div>
          )}

          {(dbState.error || formError) && (
            <div
              className="reg-alert warn"
              style={{ marginBottom: '1rem', background: 'var(--status-danger-bg)', borderColor: 'var(--status-danger-border)', color: 'var(--status-danger)' }}
            >
              <span>{formError || dbState.error}</span>
            </div>
          )}

          <form id="firebase-config-form" onSubmit={handleConnect}>
            <div className="field-group">
              <label className="field-label" htmlFor="textarea-firebase-cfg">
                Vložte objekt <code>firebaseConfig</code> z Firebase Console (Project Settings → Web App)
              </label>
              <textarea
                id="textarea-firebase-cfg"
                className="textarea-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', minHeight: 150 }}
                value={rawSnippet}
                onChange={(e) => setRawSnippet(e.target.value)}
                placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "vas-projekt.firebaseapp.com",\n  projectId: "vas-projekt",\n  appId: "1:123456789:web:abcdef"\n};`}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="input-firestore-db-id">
                ID Firestore databáze (volitelné – ponechte prázdné pro výchozí <code>(default)</code>)
              </label>
              <input
                id="input-firestore-db-id"
                type="text"
                className="text-input"
                value={databaseId}
                onChange={(e) => setDatabaseId(e.target.value)}
                placeholder="(default)"
              />
            </div>
          </form>

          <div style={{ marginTop: '1rem' }}>
            <div className="field-label" style={{ marginBottom: '0.35rem' }}>
              Rychlé nasazení pravidel a hostingu z tohoto repozitáře (CLI):
            </div>
            <pre className="code-snippet">
{`npx -y firebase-tools@latest use <VASE_PROJECT_ID>
npx -y firebase-tools@latest deploy --only auth,firestore:rules,firestore:indexes`}
            </pre>
          </div>
        </div>

        <div className="modal-footer">
          {dbState.mode === 'firebase' && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                await onDisconnect();
                onShowToast('Odpojeno od Firebase – přepnuto na lokální úložiště.');
                onClose();
              }}
            >
              <Unplug size={15} />
              Odpojit Firebase
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Zavřít
          </button>
          <button
            type="submit"
            form="firebase-config-form"
            className="btn btn-primary"
            disabled={busy || !rawSnippet.trim()}
          >
            {busy ? 'Připojuji…' : 'Uložit a připojit Firestore'}
          </button>
        </div>
      </div>
    </div>
  );
};
