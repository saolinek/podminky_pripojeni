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
      <div className="modal-panel" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Firebase Firestore</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Zavřít"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {dbState.mode === 'firebase' && dbState.connected ? (
            <div className="reg-alert ok" style={{ marginBottom: '1rem' }}>
              <CheckCircle2 size={16} />
              <div style={{ flex: 1 }}>
                <div>
                  <strong>{dbState.projectId}</strong>
                  {dbState.authEmail ? ` · ${dbState.authEmail}` : ''}
                </div>
                <div className="row" style={{ marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyShareLink}
                  >
                    <Copy size={13} />
                    Sdílet odkaz
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onSyncLocalToCloud();
                        onShowToast('Lokální data nahrána do cloudu.');
                      } catch (err: unknown) {
                        setFormError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    <RefreshCw size={13} />
                    Synchronizovat
                  </button>
                  {!dbState.authEmail && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        try {
                          await signInWithGoogleFirebase();
                          onShowToast('Přihlášeno přes Google.');
                        } catch (err: unknown) {
                          setFormError(err instanceof Error ? err.message : String(err));
                        }
                      }}
                    >
                      <LogIn size={13} />
                      Google účet
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="reg-alert info" style={{ marginBottom: '1rem' }}>
              <Cloud size={16} />
              <span>Lokální režim. Vložte firebaseConfig pro sdílení v cloudu.</span>
            </div>
          )}

          {(dbState.error || formError) && (
            <div className="reg-alert danger" style={{ marginBottom: '1rem' }}>
              <span>{formError || dbState.error}</span>
            </div>
          )}

          <form id="firebase-config-form" onSubmit={handleConnect}>
            <div className="field-group">
              <label className="field-label" htmlFor="textarea-firebase-cfg">
                firebaseConfig
              </label>
              <textarea
                id="textarea-firebase-cfg"
                className="textarea-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', minHeight: 130 }}
                value={rawSnippet}
                onChange={(e) => setRawSnippet(e.target.value)}
                placeholder={`{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  "appId": "..."\n}`}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="input-firestore-db-id">
                Database ID (volitelné)
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
        </div>

        <div className="modal-footer">
          {dbState.mode === 'firebase' && (
            <>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await onDisconnect();
                  onShowToast('Odpojeno od Firebase.');
                  onClose();
                }}
              >
                <Unplug size={15} />
                Odpojit
              </button>
              <div className="spacer" />
            </>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Zavřít
          </button>
          <button
            type="submit"
            form="firebase-config-form"
            className="btn btn-accent"
            disabled={busy || !rawSnippet.trim()}
          >
            {busy ? 'Připojuji…' : 'Připojit'}
          </button>
        </div>
      </div>
    </div>
  );
};
