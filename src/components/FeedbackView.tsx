import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  LogOut,
  MessageSquare,
  Send,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type FeedbackEntry,
} from '../types';

interface FeedbackViewProps {
  isSuperadmin: boolean;
  entries: FeedbackEntry[];
  onSubmitFeedback: (input: {
    category: FeedbackCategory;
    rating: number;
    message: string;
    authorName: string;
  }) => Promise<void>;
  onDeleteFeedback: (id: string) => Promise<void>;
  onOpenSuperadminLogin: () => void;
  onLogout: () => void;
}

type CategoryFilter = 'ALL' | FeedbackCategory;

const CATEGORY_MAP = new Map(FEEDBACK_CATEGORIES.map((c) => [c.id, c]));

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const FeedbackView: React.FC<FeedbackViewProps> = ({
  isSuperadmin,
  entries,
  onSubmitFeedback,
  onDeleteFeedback,
  onOpenSuperadminLogin,
  onLogout,
}) => {
  const [category, setCategory] = useState<FeedbackCategory>('NAPAD');
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedNotice, setSubmittedNotice] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('ALL');

  const filteredEntries = useMemo(() => {
    if (filter === 'ALL') return entries;
    return entries.filter((e) => e.category === filter);
  }, [entries, filter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<FeedbackCategory, number> = {
      NAPAD: 0,
      CHYBA: 0,
      PODMINKA: 0,
      JINE: 0,
    };
    for (const e of entries) {
      counts[e.category] = (counts[e.category] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const activeStars = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    setSubmitError('');
    setSubmittedNotice(false);
    try {
      await onSubmitFeedback({
        category,
        rating,
        message,
        authorName,
      });
      setMessage('');
      setRating(0);
      setHoverRating(0);
      setSubmittedNotice(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: FeedbackEntry) => {
    const ok = window.confirm('Opravdu chcete odstranit tento záznam zpětné vazby?');
    if (!ok) return;
    setDeleteError('');
    try {
      await onDeleteFeedback(entry.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteError(msg);
    }
  };

  if (!isSuperadmin) {
    return (
      <div className="feedback-centered">
        <section className="surface-card" aria-label="Formulář zpětné vazby">
          <div className="card-header">
            <h2 className="card-title">Zpětná vazba</h2>
            <button
              id="btn-feedback-superadmin-login"
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onOpenSuperadminLogin}
              title="Zobrazit přijatou zpětnou vazbu (pouze superadmin)"
            >
              <Lock size={13} />
              Superadmin
            </button>
          </div>

          <form className="card-body" onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label">Typ zpětné vazby</label>
              <div className="choice-grid-2" role="group" aria-label="Typ zpětné vazby">
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`choice-btn ${category === cat.id ? 'selected' : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label">Hodnocení aplikace</label>
                <span className="field-hint">
                  {rating > 0 ? `${rating} / 5` : 'Volitelné'}
                </span>
              </div>
              <div
                className="star-rating"
                role="radiogroup"
                aria-label="Hodnocení aplikace 1 až 5 hvězdiček"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= activeStars;
                  return (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={`${star} z 5 hvězdiček`}
                      className={`star-btn ${filled ? 'filled' : ''}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onClick={() => setRating((prev) => (prev === star ? 0 : star))}
                    >
                      <Star size={20} fill={filled ? 'currentColor' : 'none'} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="feedback-message">
                  Zpráva
                </label>
                <span className="field-hint">{message.length} / 2000</span>
              </div>
              <textarea
                id="feedback-message"
                className="textarea-input"
                rows={5}
                maxLength={2000}
                required
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (submittedNotice) setSubmittedNotice(false);
                }}
                placeholder="Co funguje dobře, co chybí nebo co by šlo vylepšit…"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="feedback-author">
                Jméno (volitelné)
              </label>
              <input
                id="feedback-author"
                type="text"
                className="text-input"
                maxLength={120}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Anonymní"
              />
            </div>

            {submitError && (
              <div className="reg-alert danger feedback-alert" role="alert">
                <AlertTriangle size={15} />
                <span>{submitError}</span>
              </div>
            )}

            {submittedNotice && !submitError && (
              <div className="reg-alert ok feedback-alert" role="status">
                <CheckCircle2 size={15} />
                <span>Děkujeme! Zpětná vazba byla uložena.</span>
              </div>
            )}

            <button
              id="btn-submit-feedback"
              type="submit"
              className="btn btn-accent feedback-submit-btn"
              disabled={submitting || !message.trim()}
            >
              <Send size={15} />
              {submitting ? 'Odesílám…' : 'Odeslat zpětnou vazbu'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <section aria-label="Přehled zpětné vazby">
      <div className="section-head">
        <div className="row">
          <h2>
            Přijatá zpětná vazba
            <span className="count">{entries.length}</span>
          </h2>
          <span className="role-badge superadmin" title="Přihlášen jako superadmin">
            <ShieldCheck size={13} />
            Superadmin
          </span>
        </div>

        <div className="row">
          <button
            id="btn-feedback-superadmin-logout"
            type="button"
            className="icon-btn bordered"
            onClick={onLogout}
            title="Odhlásit superadmina"
            aria-label="Odhlásit superadmina"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <div className="feedback-toolbar">
        <div className="filter-pills" role="tablist" aria-label="Filtr typu zpětné vazby">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'ALL'}
            className={`filter-pill ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            Vše
            <span className="count">{entries.length}</span>
          </button>
          {FEEDBACK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={filter === cat.id}
              className={`filter-pill ${filter === cat.id ? 'active' : ''}`}
              onClick={() => setFilter(cat.id)}
            >
              {cat.shortLabel}
              {categoryCounts[cat.id] > 0 && (
                <span className="count">{categoryCounts[cat.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {deleteError && (
        <div className="reg-alert danger feedback-alert" role="alert">
          <AlertTriangle size={15} />
          <span>{deleteError}</span>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div className="surface-card empty-state">
          <MessageSquare size={24} className="empty-icon" aria-hidden="true" />
          <p>
            {entries.length === 0
              ? 'Zatím tu není žádná zpětná vazba.'
              : 'Pro vybraný filtr nejsou žádné záznamy.'}
          </p>
        </div>
      ) : (
        <div className="feedback-list">
          {filteredEntries.map((entry) => {
            const catInfo = CATEGORY_MAP.get(entry.category);
            const dateLabel = formatDateTime(entry.createdAtIso);
            return (
              <article key={entry.id} className="surface-card feedback-card">
                <div className="feedback-card-head">
                  <div className="row">
                    <span
                      className={`feedback-cat-pill cat-${entry.category.toLowerCase()}`}
                    >
                      {catInfo?.shortLabel ?? 'Ostatní'}
                    </span>

                    {entry.rating > 0 && (
                      <span
                        className="feedback-stars-display"
                        aria-label={`Hodnocení ${entry.rating} z 5`}
                      >
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={13}
                            className={s <= entry.rating ? 'filled' : 'empty'}
                            fill={s <= entry.rating ? 'currentColor' : 'none'}
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  <div className="feedback-card-meta">
                    {dateLabel && <time dateTime={entry.createdAtIso}>{dateLabel}</time>}
                    <button
                      type="button"
                      className="icon-btn sm danger feedback-delete-btn"
                      title="Odstranit zpětnou vazbu"
                      aria-label="Odstranit zpětnou vazbu"
                      onClick={() => handleDelete(entry)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <p className="feedback-message">{entry.message}</p>

                <div className="feedback-author">{entry.authorName || 'Anonymní'}</div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
