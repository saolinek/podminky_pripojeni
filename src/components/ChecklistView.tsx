import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  FilePlus2,
  FolderCheck,
  MessageSquarePlus,
  Printer,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react';
import {
  type ChecklistItemTemplate,
  EXPORT_MODES,
  matchesPlantConfig,
  PHASES,
  type PhaseId,
  PLANT_TECHNOLOGIES,
  type PlantConfig,
  POWER_CATEGORIES,
  type SavedProject,
} from '../types';

interface ChecklistViewProps {
  config: PlantConfig;
  allItems: ChecklistItemTemplate[];
  checkedIds: string[];
  itemNotes: Record<string, string>;
  activeProject: SavedProject | null;
  onToggleCheck: (itemId: string) => void;
  onSaveItemNote: (itemId: string, note: string) => void;
  onClearChecks: () => void;
  onOpenSaveProjectModal: (saveAsNew: boolean) => void;
  onQuickSaveActiveProject: () => void;
  onEditTemplateItem: (item: ChecklistItemTemplate) => void;
}

type StatusFilter = 'ALL' | 'TODO' | 'DONE';

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  config,
  allItems,
  checkedIds,
  itemNotes,
  activeProject,
  onToggleCheck,
  onSaveItemNote,
  onClearChecks,
  onOpenSaveProjectModal,
  onQuickSaveActiveProject,
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

  const categoryMeta = POWER_CATEGORIES.find((c) => c.id === config.category);
  const techMeta = PLANT_TECHNOLOGIES.find((t) => t.id === config.technology);
  const exportMeta = EXPORT_MODES.find((e) => e.id === config.exportMode);

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
    <section aria-label="Odškrtávací seznam pro připojení zdroje">
      {/* Summary Header Card */}
      <div className="summary-banner">
        <div className="summary-top">
          <div>
            {activeProject && (
              <div className="active-project-pill">
                <FolderCheck size={14} />
                <span>
                  Uložený projekt: {activeProject.name}
                  {activeProject.contractNumber ? ` • SoP č. ${activeProject.contractNumber}` : ''}
                </span>
              </div>
            )}
            <h2 className="summary-heading">
              {activeProject
                ? activeProject.name
                : `Checklist připojení: ${techMeta?.label || config.technology} (${config.installedPowerKw} kW)`}
            </h2>
            <div className="spec-pills">
              <span className="spec-pill highlight">{categoryMeta?.label}</span>
              <span className="spec-pill">Hladina {config.voltage}</span>
              <span className="spec-pill">Pi = {config.installedPowerKw} kW</span>
              <span className="spec-pill">{categoryMeta?.rfgDoc}</span>
              <span className="spec-pill">
                {config.exportMode === 'MIKROZDROJ_BEZ_PRETOKU'
                  ? 'Bez přetoků (§ 16)'
                  : config.exportMode === 'NULOVY_REZERVOVANY_VYKON'
                  ? 'Pr = 0 kW'
                  : 'S přetoky do DS'}
              </span>
            </div>
            {exportMeta && (
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                Režim: {exportMeta.label}
              </p>
            )}
          </div>

          <div className="summary-actions">
            {activeProject ? (
              <>
                <button
                  id="btn-quick-save-project"
                  type="button"
                  className="btn btn-primary"
                  onClick={onQuickSaveActiveProject}
                >
                  <Save size={15} />
                  Uložit změny projektu
                </button>
                <button
                  id="btn-save-as-new-project"
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onOpenSaveProjectModal(true)}
                >
                  <FilePlus2 size={15} />
                  Uložit jako kopii
                </button>
              </>
            ) : (
              <button
                id="btn-save-project-db"
                type="button"
                className="btn btn-primary"
                onClick={() => onOpenSaveProjectModal(true)}
              >
                <Save size={15} />
                Uložit zakázku do databáze
              </button>
            )}

            <button
              id="btn-print-checklist"
              type="button"
              className="btn btn-secondary"
              onClick={() => window.print()}
              title="Vytisknout nebo uložit jako PDF protokol"
            >
              <Printer size={15} />
              Tisk / PDF
            </button>

            {completedCount > 0 && (
              <button
                id="btn-clear-checks"
                type="button"
                className="btn btn-ghost"
                onClick={onClearChecks}
                title="Odškrtnout všechny položky"
              >
                <RotateCcw size={15} />
                Vynulovat
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-section">
          <div className="progress-stats-row">
            <span className="progress-label">
              Postup splnění připojovacích podmínek ČEZ Distribuce
            </span>
            <span className="progress-fraction">
              {completedCount} / {totalCount} bodů ({progressPct} %)
            </span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`progress-fill ${progressPct === 100 && totalCount > 0 ? 'complete' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="checklist-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            id="input-search-checklist"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat v bodech (např. HDO, UTP, revize, SIM, 412, OTE…)"
          />
        </div>

        <div className="filter-pills" role="tablist" aria-label="Filtr stavu úkolů">
          <button
            id="filter-btn-all"
            type="button"
            className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Vše ({matchingItems.length})
          </button>
          <button
            id="filter-btn-todo"
            type="button"
            className={`filter-pill ${statusFilter === 'TODO' ? 'active' : ''}`}
            onClick={() => setStatusFilter('TODO')}
          >
            Zbývá ({matchingItems.length - completedCount})
          </button>
          <button
            id="filter-btn-done"
            type="button"
            className={`filter-pill ${statusFilter === 'DONE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DONE')}
          >
            Splněno ({completedCount})
          </button>
        </div>
      </div>

      {/* Phases List */}
      {filteredItems.length === 0 ? (
        <div className="surface-card empty-state">
          <p style={{ margin: 0, fontWeight: 600 }}>
            Žádné položky neodpovídají aktuálnímu filtru nebo vyhledávání.
          </p>
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
                      {phaseAllDone ? <Check size={15} strokeWidth={3} /> : phase.step}
                    </span>
                    <div>
                      <h3 className="phase-title">{phase.title}</h3>
                      <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                        {phase.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="phase-header-right">
                    <span className={`phase-count-pill ${phaseAllDone ? 'done' : ''}`}>
                      {doneInPhase}/{allPhaseMatching.length}
                    </span>
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
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
                            {isChecked && <Check size={15} strokeWidth={3} />}
                          </button>

                          <div className="item-content">
                            <div className="item-top-line">
                              <span
                                className="item-title"
                                onClick={() => onToggleCheck(item.id)}
                              >
                                {item.title}
                              </span>

                              <button
                                id={`edit-db-item-${item.id}`}
                                type="button"
                                className="item-note-btn no-print"
                                onClick={() => onEditTemplateItem(item)}
                                title="Upravit tuto podmínku ve sdílené databázi"
                              >
                                <Edit3 size={13} />
                                Upravit v DB
                              </button>
                            </div>

                            <p className="item-desc">{item.description}</p>

                            <div className="item-meta-row">
                              {item.reference && (
                                <span className="meta-tag ref">{item.reference}</span>
                              )}
                              {item.deadlineBadge && (
                                <span className="meta-tag deadline">{item.deadlineBadge}</span>
                              )}
                              {!item.mandatory && (
                                <span className="meta-tag optional">Doporučené / podmíněné</span>
                              )}
                              <button
                                id={`note-btn-${item.id}`}
                                type="button"
                                className="item-note-btn"
                                onClick={() => startEditingNote(item.id)}
                              >
                                <MessageSquarePlus size={13} />
                                {savedNote ? 'Upravit poznámku' : 'Přidat poznámku'}
                              </button>
                            </div>

                            {isEditingThisNote ? (
                              <div className="item-note-box no-print">
                                <input
                                  id={`note-input-${item.id}`}
                                  type="text"
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  placeholder="Např. č. revize 2026/48, podáno v DIP 12. 11., technik p. Dvořák…"
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
                                <div className="item-note-saved">
                                  <span>
                                    <strong>Poznámka:</strong> {savedNote}
                                  </span>
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
