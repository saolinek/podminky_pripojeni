import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  GripVertical,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  type ChecklistItemTemplate,
  EXPORT_MODES,
  type ExportMode,
  PHASES,
  type PhaseId,
  PLANT_TECHNOLOGIES,
  type PlantTechnology,
  POWER_CATEGORIES,
  type PowerCategory,
  SPECIAL_FLAGS,
  type SpecialFlag,
  VOLTAGE_LEVELS,
  type VoltageLevel,
} from '../types';

interface TemplateDatabaseViewProps {
  items: ChecklistItemTemplate[];
  editingInitialItem: ChecklistItemTemplate | null;
  onClearInitialEdit: () => void;
  onSaveItem: (item: ChecklistItemTemplate, isNew: boolean) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onReorderItems: (updates: { id: string; phase: PhaseId; order: number }[]) => Promise<void>;
  onResetDefaults: () => Promise<void>;
}

function getPhaseBaseOrder(phaseId: PhaseId): number {
  const step = PHASES.find((p) => p.id === phaseId)?.step ?? 1;
  return (step - 1) * 1000;
}

function getNextOrderInPhase(items: ChecklistItemTemplate[], phaseId: PhaseId): number {
  const inPhase = items.filter((i) => i.phase === phaseId);
  if (inPhase.length === 0) {
    return getPhaseBaseOrder(phaseId) + 10;
  }
  const maxOrder = Math.max(...inPhase.map((i) => i.order));
  return Math.min(maxOrder + 10, 100000);
}

function createEmptyItem(phase: PhaseId, order: number): ChecklistItemTemplate {
  return {
    id: `vlastni-${Date.now().toString(36)}`,
    title: '',
    description: '',
    phase,
    order,
    reference: '',
    deadlineBadge: '',
    mandatory: true,
    categories: [],
    voltages: [],
    technologies: [],
    exportModes: [],
    requiredFlags: [],
    createdBy: 'user',
    updatedAtIso: new Date().toISOString(),
  };
}

export const TemplateDatabaseView: React.FC<TemplateDatabaseViewProps> = ({
  items,
  editingInitialItem,
  onClearInitialEdit,
  onSaveItem,
  onDeleteItem,
  onReorderItems,
  onResetDefaults,
}) => {
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [modalItem, setModalItem] = useState<ChecklistItemTemplate | null>(editingInitialItem);
  const [originalPhase, setOriginalPhase] = useState<PhaseId | null>(
    editingInitialItem ? editingInitialItem.phase : null
  );
  const [isNewModal, setIsNewModal] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetItemId, setDropTargetItemId] = useState<string | null>(null);
  const [dropTargetPhaseId, setDropTargetPhaseId] = useState<PhaseId | null>(null);

  React.useEffect(() => {
    if (editingInitialItem) {
      setModalItem({ ...editingInitialItem });
      setOriginalPhase(editingInitialItem.phase);
      setIsNewModal(false);
      onClearInitialEdit();
    }
  }, [editingInitialItem, onClearInitialEdit]);

  const isSearching = search.trim().length > 0;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (phaseFilter !== 'ALL' && item.phase !== phaseFilter) return false;
        if (!q) return true;
        return item.title.toLowerCase().includes(q);
      })
      .sort((a, b) => a.order - b.order);
  }, [items, search, phaseFilter]);

  const visiblePhases = useMemo(() => {
    return PHASES.filter((ph) => {
      if (phaseFilter !== 'ALL' && ph.id !== phaseFilter) return false;
      if (isSearching) {
        return filteredItems.some((i) => i.phase === ph.id);
      }
      return true;
    });
  }, [phaseFilter, isSearching, filteredItems]);

  const togglePhase = (phaseId: PhaseId) => {
    setCollapsedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const openNewInPhase = (phaseId: PhaseId) => {
    const nextOrder = getNextOrderInPhase(items, phaseId);
    setModalItem(createEmptyItem(phaseId, nextOrder));
    setOriginalPhase(null);
    setIsNewModal(true);
  };

  const openEditItem = (item: ChecklistItemTemplate) => {
    setModalItem({ ...item });
    setOriginalPhase(item.phase);
    setIsNewModal(false);
  };

  const toggleInArray = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalItem || !modalItem.title.trim()) return;
    setSaving(true);
    try {
      const nextOrder =
        isNewModal || (originalPhase && originalPhase !== modalItem.phase)
          ? getNextOrderInPhase(
              items.filter((i) => i.id !== modalItem.id),
              modalItem.phase
            )
          : modalItem.order;

      await onSaveItem(
        {
          ...modalItem,
          title: modalItem.title.trim(),
          order: nextOrder,
        },
        isNewModal
      );
      setModalItem(null);
      setOriginalPhase(null);
    } finally {
      setSaving(false);
    }
  };

  const buildPhaseOrderUpdates = (
    phaseId: PhaseId,
    orderedList: ChecklistItemTemplate[]
  ): { id: string; phase: PhaseId; order: number }[] => {
    const base = getPhaseBaseOrder(phaseId);
    const updates: { id: string; phase: PhaseId; order: number }[] = [];
    orderedList.forEach((item, index) => {
      const nextOrder = base + (index + 1) * 10;
      if (item.phase !== phaseId || item.order !== nextOrder) {
        updates.push({ id: item.id, phase: phaseId, order: nextOrder });
      }
    });
    return updates;
  };

  const handleMoveWithinPhase = async (
    phaseId: PhaseId,
    itemId: string,
    direction: -1 | 1
  ) => {
    const phaseItems = items
      .filter((i) => i.phase === phaseId)
      .sort((a, b) => a.order - b.order);
    const idx = phaseItems.findIndex((i) => i.id === itemId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= phaseItems.length) return;

    const reordered = [...phaseItems];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);

    const updates = buildPhaseOrderUpdates(phaseId, reordered);
    await onReorderItems(updates);
  };

  const clearDragState = () => {
    setDraggedId(null);
    setDropTargetItemId(null);
    setDropTargetPhaseId(null);
  };

  const handleDropOnItem = async (targetItem: ChecklistItemTemplate) => {
    if (!draggedId || draggedId === targetItem.id) {
      clearDragState();
      return;
    }
    const draggedItem = items.find((i) => i.id === draggedId);
    if (!draggedItem) {
      clearDragState();
      return;
    }

    const sourcePhase = draggedItem.phase;
    const targetPhase = targetItem.phase;

    const targetList = items
      .filter((i) => i.phase === targetPhase && i.id !== draggedItem.id)
      .sort((a, b) => a.order - b.order);

    const targetIdx = targetList.findIndex((i) => i.id === targetItem.id);
    if (targetIdx < 0) {
      clearDragState();
      return;
    }

    targetList.splice(targetIdx, 0, { ...draggedItem, phase: targetPhase });
    const updates = buildPhaseOrderUpdates(targetPhase, targetList);

    if (sourcePhase !== targetPhase) {
      const sourceList = items
        .filter((i) => i.phase === sourcePhase && i.id !== draggedItem.id)
        .sort((a, b) => a.order - b.order);
      updates.push(...buildPhaseOrderUpdates(sourcePhase, sourceList));
    }

    clearDragState();
    await onReorderItems(updates);
  };

  const handleDropOnPhase = async (targetPhase: PhaseId) => {
    if (!draggedId) {
      clearDragState();
      return;
    }
    const draggedItem = items.find((i) => i.id === draggedId);
    if (!draggedItem) {
      clearDragState();
      return;
    }

    const sourcePhase = draggedItem.phase;
    const targetList = items
      .filter((i) => i.phase === targetPhase && i.id !== draggedItem.id)
      .sort((a, b) => a.order - b.order);
    targetList.push({ ...draggedItem, phase: targetPhase });

    const updates = buildPhaseOrderUpdates(targetPhase, targetList);
    if (sourcePhase !== targetPhase) {
      const sourceList = items
        .filter((i) => i.phase === sourcePhase && i.id !== draggedItem.id)
        .sort((a, b) => a.order - b.order);
      updates.push(...buildPhaseOrderUpdates(sourcePhase, sourceList));
    }

    clearDragState();
    await onReorderItems(updates);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cez-distribuce-podminky-pripojeni.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Databáze podmínek">
      <div className="section-head">
        <h2>
          Podmínky <span className="count">{items.length}</span>
        </h2>

        <div className="row">
          <button
            id="btn-export-db-json"
            type="button"
            className="icon-btn bordered"
            onClick={handleExportJson}
            title="Export JSON"
            aria-label="Export JSON"
          >
            <Download size={15} />
          </button>

          <button
            id="btn-reset-db-defaults"
            type="button"
            className="icon-btn bordered"
            onClick={() => {
              if (window.confirm('Obnovit výchozí sadu podmínek ČEZ Distribuce?')) {
                onResetDefaults();
              }
            }}
            title="Obnovit výchozí ČEZ"
            aria-label="Obnovit výchozí ČEZ"
          >
            <RotateCcw size={15} />
          </button>

          <button
            id="btn-add-db-item"
            type="button"
            className="btn btn-accent"
            onClick={() =>
              openNewInPhase(phaseFilter === 'ALL' ? 'FAZE_1_PRIPRAVA' : (phaseFilter as PhaseId))
            }
          >
            <Plus size={15} />
            Přidat podmínku
          </button>
        </div>
      </div>

      <div className="checklist-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            id="input-search-db-templates"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat…"
          />
        </div>
        <select
          id="select-filter-phase"
          className="select-input"
          style={{ width: 'auto', minWidth: 220 }}
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
        >
          <option value="ALL">Všechny skupiny</option>
          {PHASES.map((ph) => (
            <option key={ph.id} value={ph.id}>
              {ph.step}. {ph.title}
            </option>
          ))}
        </select>
      </div>

      {visiblePhases.length === 0 ? (
        <div className="surface-card empty-state">
          <p>Nic nenalezeno.</p>
        </div>
      ) : (
        <div className="phases-stack">
          {visiblePhases.map((phase) => {
            const phaseItems = filteredItems.filter((i) => i.phase === phase.id);
            const isCollapsed = Boolean(collapsedPhases[phase.id]);
            const isPhaseDropTarget = dropTargetPhaseId === phase.id && !dropTargetItemId;

            return (
              <div
                key={phase.id}
                className={`phase-block ${isPhaseDropTarget ? 'drop-target' : ''}`}
                onDragOver={(e) => {
                  if (!draggedId) return;
                  e.preventDefault();
                  if (dropTargetPhaseId !== phase.id) {
                    setDropTargetPhaseId(phase.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    if (dropTargetPhaseId === phase.id) setDropTargetPhaseId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnPhase(phase.id);
                }}
              >
                <div className="phase-header-bar">
                  <button
                    id={`db-phase-toggle-${phase.id}`}
                    type="button"
                    className={`phase-header ${isCollapsed ? 'collapsed' : ''}`}
                    onClick={() => togglePhase(phase.id)}
                  >
                    <div className="phase-header-left">
                      <span className="phase-step-num">{phase.step}</span>
                      <h3 className="phase-title">{phase.title}</h3>
                    </div>
                    <div className="phase-header-right">
                      <span className="phase-count-pill">{phaseItems.length}</span>
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  <button
                    id={`btn-add-in-phase-${phase.id}`}
                    type="button"
                    className="icon-btn sm phase-add-btn"
                    onClick={() => openNewInPhase(phase.id)}
                    title={`Přidat podmínku do „${phase.title}“`}
                    aria-label={`Přidat podmínku do ${phase.title}`}
                  >
                    <Plus size={15} />
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="items-list">
                    {phaseItems.length === 0 ? (
                      <div className="phase-empty-drop">
                        Žádné podmínky · přetáhněte sem nebo přidejte přes +
                      </div>
                    ) : (
                      phaseItems.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`db-item-row ${draggedId === item.id ? 'dragging' : ''} ${
                            dropTargetItemId === item.id ? 'drop-before' : ''
                          }`}
                          draggable={!isSearching}
                          onDragStart={(e) => {
                            setDraggedId(item.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', item.id);
                          }}
                          onDragEnd={clearDragState}
                          onDragOver={(e) => {
                            if (!draggedId || draggedId === item.id) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setDropTargetPhaseId(phase.id);
                            setDropTargetItemId(item.id);
                          }}
                          onDragLeave={() => {
                            if (dropTargetItemId === item.id) setDropTargetItemId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDropOnItem(item);
                          }}
                        >
                          {!isSearching && (
                            <span className="drag-handle" aria-hidden="true" title="Přetáhnout">
                              <GripVertical size={15} />
                            </span>
                          )}

                          <h3 className="db-item-title">{item.title}</h3>

                          <div className="row-actions">
                            {!isSearching && (
                              <>
                                <button
                                  type="button"
                                  className="icon-btn sm"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveWithinPhase(phase.id, item.id, -1)}
                                  title="Posunout nahoru"
                                  aria-label="Posunout nahoru"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn sm"
                                  disabled={idx === phaseItems.length - 1}
                                  onClick={() => handleMoveWithinPhase(phase.id, item.id, 1)}
                                  title="Posunout dolů"
                                  aria-label="Posunout dolů"
                                >
                                  <ArrowDown size={14} />
                                </button>
                              </>
                            )}
                            <button
                              id={`btn-edit-template-${item.id}`}
                              type="button"
                              className="icon-btn sm"
                              onClick={() => openEditItem(item)}
                              title="Upravit"
                              aria-label="Upravit"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              id={`btn-del-template-${item.id}`}
                              type="button"
                              className="icon-btn sm danger"
                              onClick={() => {
                                if (window.confirm(`Smazat „${item.title}“?`)) {
                                  onDeleteItem(item.id);
                                }
                              }}
                              title="Smazat"
                              aria-label="Smazat"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel" onSubmit={handleSubmit}>
            <div className="modal-header">
              <h3>{isNewModal ? 'Nová podmínka' : 'Upravit podmínku'}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setModalItem(null)}
                aria-label="Zavřít"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="field-group">
                <label className="field-label" htmlFor="edit-item-title">
                  Název *
                </label>
                <input
                  id="edit-item-title"
                  type="text"
                  required
                  maxLength={200}
                  className="text-input"
                  value={modalItem.title}
                  onChange={(e) => setModalItem({ ...modalItem, title: e.target.value })}
                  placeholder="Název podmínky"
                  autoFocus
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="edit-item-phase">
                  Skupina
                </label>
                <select
                  id="edit-item-phase"
                  className="select-input"
                  value={modalItem.phase}
                  onChange={(e) =>
                    setModalItem({ ...modalItem, phase: e.target.value as PhaseId })
                  }
                >
                  {PHASES.map((ph) => (
                    <option key={ph.id} value={ph.id}>
                      {ph.step}. {ph.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Kategorie</span>
                  <span className="field-hint">prázdné = vše</span>
                </div>
                <div className="tag-picker">
                  {POWER_CATEGORIES.map((c) => {
                    const active = modalItem.categories.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`tag-chip ${active ? 'selected' : ''}`}
                        onClick={() =>
                          setModalItem({
                            ...modalItem,
                            categories: toggleInArray<PowerCategory>(modalItem.categories, c.id),
                          })
                        }
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Napětí</span>
                  <span className="field-hint">prázdné = vše</span>
                </div>
                <div className="tag-picker">
                  {VOLTAGE_LEVELS.map((v) => {
                    const active = modalItem.voltages.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={`tag-chip ${active ? 'selected' : ''}`}
                        onClick={() =>
                          setModalItem({
                            ...modalItem,
                            voltages: toggleInArray<VoltageLevel>(modalItem.voltages, v.id),
                          })
                        }
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Technologie</span>
                  <span className="field-hint">prázdné = vše</span>
                </div>
                <div className="tag-picker">
                  {PLANT_TECHNOLOGIES.map((t) => {
                    const active = modalItem.technologies.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`tag-chip ${active ? 'selected' : ''}`}
                        onClick={() =>
                          setModalItem({
                            ...modalItem,
                            technologies: toggleInArray<PlantTechnology>(
                              modalItem.technologies,
                              t.id
                            ),
                          })
                        }
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Přetoky</span>
                  <span className="field-hint">prázdné = vše</span>
                </div>
                <div className="tag-picker">
                  {EXPORT_MODES.map((m) => {
                    const active = modalItem.exportModes.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`tag-chip ${active ? 'selected' : ''}`}
                        onClick={() =>
                          setModalItem({
                            ...modalItem,
                            exportModes: toggleInArray<ExportMode>(modalItem.exportModes, m.id),
                          })
                        }
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Příznaky</span>
                  <span className="field-hint">prázdné = vždy</span>
                </div>
                <div className="tag-picker">
                  {SPECIAL_FLAGS.map((f) => {
                    const active = modalItem.requiredFlags.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`tag-chip ${active ? 'selected' : ''}`}
                        onClick={() =>
                          setModalItem({
                            ...modalItem,
                            requiredFlags: toggleInArray<SpecialFlag>(
                              modalItem.requiredFlags,
                              f.id
                            ),
                          })
                        }
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalItem(null)}
              >
                Zrušit
              </button>
              <button type="submit" className="btn btn-accent" disabled={saving}>
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
