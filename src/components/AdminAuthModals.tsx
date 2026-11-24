import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Info, KeyRound, Lock, X } from 'lucide-react';
import {
  type AdminRole,
  MIN_ADMIN_PASSWORD_LENGTH,
} from '../services/adminAuthService';

interface AdminLoginModalProps {
  onClose: () => void;
  onAuthenticate: (password: string) => Promise<{ ok: boolean; error?: string }>;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  onClose,
  onAuthenticate,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Zadejte heslo.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await onAuthenticate(password);
      if (!res.ok) {
        setError(res.error || 'Nesprávné heslo.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se ověřit heslo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal-panel modal-panel-sm" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 id="admin-login-title" className="modal-title-with-icon">
            <Lock size={17} />
            Přístup do záložky Podmínky
          </h3>
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
          <p className="modal-lead">
            Úprava podmínek připojení je vyhrazena pouze pro správce. Zadejte heslo admina.
          </p>

          <div className="field-group">
            <label className="field-label" htmlFor="input-admin-login-password">
              Heslo
            </label>
            <div className="password-input-wrap">
              <input
                id="input-admin-login-password"
                type={showPassword ? 'text' : 'password'}
                className="text-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Zadejte heslo…"
                autoComplete="current-password"
                autoFocus
                required
              />
              <button
                type="button"
                className="icon-btn password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="reg-alert danger" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Zrušit
          </button>
          <button
            id="btn-admin-login-submit"
            type="submit"
            className="btn btn-accent"
            disabled={submitting || !password}
          >
            {submitting ? 'Ověřuji…' : 'Přihlásit se'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface ChangePasswordModalProps {
  role: AdminRole;
  onClose: () => void;
  onChangePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  role,
  onClose,
  onChangePassword,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (role !== 'superadmin' && !currentPassword) {
      setError('Zadejte současné heslo admina nebo heslo superadmina.');
      return;
    }

    if (newPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
      setError(`Nové heslo musí mít alespoň ${MIN_ADMIN_PASSWORD_LENGTH} znaky.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Nové heslo a jeho potvrzení se neshodují.');
      return;
    }

    setSaving(true);
    try {
      const res = await onChangePassword(currentPassword, newPassword);
      if (res.ok) {
        onClose();
      } else {
        setError(res.error || 'Nepodařilo se změnit heslo.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání hesla.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal-panel modal-panel-sm" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 id="change-password-title" className="modal-title-with-icon">
            <KeyRound size={17} />
            Změnit heslo admina
          </h3>
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
          {role === 'superadmin' && (
            <div className="reg-alert info" style={{ marginBottom: '1rem' }}>
              <Info size={15} />
              <span>
                Přihlášen jako <strong>superadmin</strong>. Můžete přímo nastavit nové heslo admina
                (heslo superadmina je neměnné).
              </span>
            </div>
          )}

          {role !== 'superadmin' && (
            <div className="field-group">
              <label className="field-label" htmlFor="input-current-admin-password">
                Současné heslo (admin nebo superadmin)
              </label>
              <input
                id="input-current-admin-password"
                type={showPasswords ? 'text' : 'password'}
                className="text-input"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Současné heslo…"
                autoComplete="current-password"
                autoFocus
                required
              />
            </div>
          )}

          <div className="field-group">
            <label className="field-label" htmlFor="input-new-admin-password">
              Nové heslo admina
            </label>
            <input
              id="input-new-admin-password"
              type={showPasswords ? 'text' : 'password'}
              className="text-input"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder={`Alespoň ${MIN_ADMIN_PASSWORD_LENGTH} znaky…`}
              autoComplete="new-password"
              autoFocus={role === 'superadmin'}
              minLength={MIN_ADMIN_PASSWORD_LENGTH}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="input-confirm-admin-password">
              Potvrzení nového hesla
            </label>
            <input
              id="input-confirm-admin-password"
              type={showPasswords ? 'text' : 'password'}
              className="text-input"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Zadejte nové heslo znovu…"
              autoComplete="new-password"
              minLength={MIN_ADMIN_PASSWORD_LENGTH}
              required
            />
          </div>

          <label className="flag-toggle" style={{ marginTop: '-0.4rem', marginBottom: '0.6rem' }}>
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
            />
            <span>Zobrazit hesla</span>
          </label>

          {error && (
            <div className="reg-alert danger" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Zrušit
          </button>
          <button
            id="btn-save-new-admin-password"
            type="submit"
            className="btn btn-accent"
            disabled={saving}
          >
            {saving ? 'Ukládám…' : 'Uložit heslo'}
          </button>
        </div>
      </form>
    </div>
  );
};
