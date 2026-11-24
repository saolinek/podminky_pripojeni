import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  MessageSquare,
  Search,
} from 'lucide-react';
import {
  type ChecklistItemTemplate,
  matchesPlantConfig,
  PHASES,
  type PhaseId,
  type PlantConfig,
} from '../types';

interface ChecklistViewProps {
  config: PlantConfig;
  allItems: ChecklistItemTemplate[];
  checkedIds: string[];
  itemNotes: Record<string, string>;
  isAdmin: boolean;
  onToggleCheck: (itemId: string) => void;
  onSaveItemNote: (itemId: string, note: string) => void;
  onEditTemplateItem: (item: ChecklistItemTemplate) => void;
}

type StatusFilter = 'ALL' | 'TODO' | 'DONE';

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  config,
  allItems,
  checkedIds,
  itemNotes,
  isAdmin,
  onToggleCheck,
  onSaveItemNote,
  onEditTemplateItem,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const matchingItems = useMemo(() => {
    return allItems
      .filter((item) => matchesPlantConfig(item, config))
      .sort((a, b) => a.order - b.order);
  }, [allItems, config]);

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  const completedCount = useMemo(() => {
    return matchingItems.filter((i) => checkedSet.has(i.id)).length;
  }, [matchingItems, checkedSet]);

  const totalCount = matchingItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matchingItems.filter((item) => {
      const isDone = checkedSet.has(item.id);
      if (statusFilter === 'TODO' && isDone) return false;
      if (statusFilter === 'DONE' && !isDone) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        (itemNotes[item.id] || '').toLowerCase().includes(q)
      );
    });
  }, [matchingItems, checkedSet, statusFilter, searchQuery, itemNotes]);

  const togglePhase = (phaseId: PhaseId) => {
    setCollapsedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const startEditingNote = (itemId: string) => {
    setEditingNoteId(itemId);
    setNoteDraft(itemNotes[itemId] || '');
  };

  const commitNote = (itemId: string) => {
    onSaveItemNote(itemId, noteDraft.trim());
    setEditingNoteId(null);
  };

  return (
    <section aria-label="Checklist připojení">
      <div className="summary-banner sticky-progress">
        <div className="progress-section">
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`progress-fill ${progressPct === 100 && totalCount > 0 ? 'complete' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="progress-fraction">
            {completedCount}/{totalCount} · {progressPct} %
          </span>
        </div>
      </div>

      <div className="checklist-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            id="input-search-checklist"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat…"
          />
        </div>

        <div className="filter-pills" role="tablist" aria-label="Filtr">
          <button
            id="filter-btn-all"
            type="button"
            className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Vše <span className="count">{matchingItems.length}</span>
          </button>
          <button
            id="filter-btn-todo"
            type="button"
            className={`filter-pill ${statusFilter === 'TODO' ? 'active' : ''}`}
            onClick={() => setStatusFilter('TODO')}
          >
            Zbývá <span className="count">{matchingItems.length - completedCount}</span>
          </button>
          <button
            id="filter-btn-done"
            type="button"
            className={`filter-pill ${statusFilter === 'DONE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DONE')}
          >
            Hotovo <span className="count">{completedCount}</span>
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="surface-card empty-state">
          <p>Nic nenalezeno.</p>
        </div>
      ) : (
        <div className="phases-stack">
          {PHASES.map((phase) => {
            const phaseItems = filteredItems.filter((i) => i.phase === phase.id);
            if (phaseItems.length === 0) return null;

            const allPhaseMatching = matchingItems.filter((i) => i.phase === phase.id);
            const doneInPhase = allPhaseMatching.filter((i) => checkedSet.has(i.id)).length;
            const phaseAllDone =
              allPhaseMatching.length > 0 && doneInPhase === allPhaseMatching.length;
            const isCollapsed = Boolean(collapsedPhases[phase.id]);

            return (
              <div key={phase.id} className="phase-block">
                <button
                  id={`phase-toggle-${phase.id}`}
                  type="button"
                  className={`phase-header ${isCollapsed ? 'collapsed' : ''}`}
                  onClick={() => togglePhase(phase.id)}
                >
                  <div className="phase-header-left">
                    <span className={`phase-step-num ${phaseAllDone ? 'done' : ''}`}>
                      {phaseAllDone ? <Check size={13} strokeWidth={3} /> : phase.step}
                    </span>
                    <h3 className="phase-title">{phase.title}</h3>
                  </div>
                  <div className="phase-header-right">
                    <span className={`phase-count-pill ${phaseAllDone ? 'done' : ''}`}>
                      {doneInPhase}/{allPhaseMatching.length}
                    </span>
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="items-list">
                    {phaseItems.map((item) => {
                      const isChecked = checkedSet.has(item.id);
                      const savedNote = itemNotes[item.id] || '';
                      const isEditingThisNote = editingNoteId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`checklist-row ${isChecked ? 'is-checked' : ''}`}
                        >
                          <button
                            id={`chk-item-${item.id}`}
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            aria-label={item.title}
                            className={`custom-checkbox ${isChecked ? 'checked' : ''}`}
                            onClick={() => onToggleCheck(item.id)}
                          >
                            {isChecked && <Check size={13} strokeWidth={3} />}
                          </button>

                          <div className="item-content">
                            <div className="item-top-line">
                              <span
                                className="item-title"
                                onClick={() => onToggleCheck(item.id)}
                              >
                                {item.title}
                              </span>

                              <div className="item-actions no-print">
                                <button
                                  id={`note-btn-${item.id}`}
                                  type="button"
                                  className="icon-btn sm"
                                  onClick={() => startEditingNote(item.id)}
                                  title={savedNote ? 'Upravit poznámku' : 'Poznámka'}
                                  aria-label={savedNote ? 'Upravit poznámku' : 'Přidat poznámku'}
                                >
                                  <MessageSquare size={14} />
                                </button>
                                {isAdmin && (
                                  <button
                                    id={`edit-db-item-${item.id}`}
                                    type="button"
                                    className="icon-btn sm"
                                    onClick={() => onEditTemplateItem(item)}
                                    title="Upravit podmínku"
                                    aria-label="Upravit podmínku"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {isEditingThisNote ? (
                              <div className="item-note-box no-print">
                                <input
                                  id={`note-input-${item.id}`}
                                  type="text"
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  placeholder="Poznámka…"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitNote(item.id);
                                    if (e.key === 'Escape') setEditingNoteId(null);
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => commitNote(item.id)}
                                >
                                  Uložit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setEditingNoteId(null)}
                                >
                                  Zrušit
                                </button>
                              </div>
                            ) : (
                              savedNote && (
                                <div
                                  className="item-note-saved"
                                  onClick={() => startEditingNote(item.id)}
                                  title="Kliknutím upravíte poznámku"
                                >
                                  {savedNote}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
