import React, { useMemo, useState } from 'react';
import { Download, Edit3, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
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
  onResetDefaults: () => Promise<void>;
}

function createEmptyItem(): ChecklistItemTemplate {
  return {
    id: `vlastni-${Date.now().toString(36)}`,
    title: '',
    description: '',
    phase: 'FAZE_1_PRIPRAVA',
    order: 150,
    reference: 'Interní metodika / PPDS ČEZ Distribuce',
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
  onResetDefaults,
}) => {
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [modalItem, setModalItem] = useState<ChecklistItemTemplate | null>(editingInitialItem);
  const [isNewModal, setIsNewModal] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (editingInitialItem) {
      setModalItem({ ...editingInitialItem });
      setIsNewModal(false);
      onClearInitialEdit();
    }
  }, [editingInitialItem, onClearInitialEdit]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (phaseFilter !== 'ALL' && item.phase !== phaseFilter) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.reference.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.order - b.order);
  }, [items, search, phaseFilter]);

  const toggleInArray = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalItem || !modalItem.title.trim() || !modalItem.description.trim()) return;
    setSaving(true);
    try {
      await onSaveItem(
        {
          ...modalItem,
          title: modalItem.title.trim(),
          description: modalItem.description.trim(),
          reference: modalItem.reference.trim(),
          deadlineBadge: modalItem.deadlineBadge.trim(),
        },
        isNewModal
      );
      setModalItem(null);
    } finally {
      setSaving(false);
    }
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
            onClick={() => {
              setModalItem(createEmptyItem());
              setIsNewModal(true);
            }}
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
          <option value="ALL">Všechny fáze</option>
          {PHASES.map((ph) => (
            <option key={ph.id} value={ph.id}>
              {ph.step}. {ph.title}
            </option>
          ))}
        </select>
      </div>

      <div className="surface-card">
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <p>Nic nenalezeno.</p>
          </div>
        ) : (
          <div className="db-items-list">
            {filteredItems.map((item) => {
              const phaseMeta = PHASES.find((p) => p.id === item.phase);
              return (
                <div key={item.id} className="db-item-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="item-meta-row">
                      <span className="meta-tag deadline">
                        {phaseMeta?.step}. {phaseMeta?.title}
                      </span>
                      {item.reference && <span className="meta-tag">{item.reference}</span>}
                      {item.categories.length > 0 && (
                        <span className="meta-tag">{item.categories.join(', ')}</span>
                      )}
                      {item.voltages.length > 0 && (
                        <span className="meta-tag">{item.voltages.join(', ')}</span>
                      )}
                      {item.technologies.length > 0 && (
                        <span className="meta-tag">{item.technologies.join(', ')}</span>
                      )}
                      {item.requiredFlags.length > 0 && (
                        <span className="meta-tag">{item.requiredFlags.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  <div className="row-actions">
                    <button
                      id={`btn-edit-template-${item.id}`}
                      type="button"
                      className="icon-btn sm"
                      onClick={() => {
                        setModalItem({ ...item });
                        setIsNewModal(false);
                      }}
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
              );
            })}
          </div>
        )}
      </div>

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
                  placeholder="Kontrola nastavení ochran dle VP_05"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="edit-item-desc">
                  Popis *
                </label>
                <textarea
                  id="edit-item-desc"
                  required
                  maxLength={1500}
                  className="textarea-input"
                  value={modalItem.description}
                  onChange={(e) => setModalItem({ ...modalItem, description: e.target.value })}
                  placeholder="Postup, přílohy nebo lhůty…"
                />
              </div>

              <div className="form-row-2 field-group">
                <div>
                  <label className="field-label" htmlFor="edit-item-phase">
                    Fáze
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

                <div>
                  <label className="field-label" htmlFor="edit-item-order">
                    Pořadí
                  </label>
                  <input
                    id="edit-item-order"
                    type="number"
                    min={0}
                    max={10000}
                    className="text-input"
                    value={modalItem.order}
                    onChange={(e) =>
                      setModalItem({ ...modalItem, order: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="form-row-2 field-group">
                <div>
                  <label className="field-label" htmlFor="edit-item-ref">
                    Předpis / norma
                  </label>
                  <input
                    id="edit-item-ref"
                    type="text"
                    maxLength={150}
                    className="text-input"
                    value={modalItem.reference}
                    onChange={(e) => setModalItem({ ...modalItem, reference: e.target.value })}
                    placeholder="PPDS Příloha č. 4"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="edit-item-badge">
                    Lhůta / štítek
                  </label>
                  <input
                    id="edit-item-badge"
                    type="text"
                    maxLength={60}
                    className="text-input"
                    value={modalItem.deadlineBadge}
                    onChange={(e) => setModalItem({ ...modalItem, deadlineBadge: e.target.value })}
                    placeholder="Lhůta 30 dnů"
                  />
                </div>
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

              <label className="flag-toggle">
                <input
                  type="checkbox"
                  checked={modalItem.mandatory}
                  onChange={(e) => setModalItem({ ...modalItem, mandatory: e.target.checked })}
                />
                <span>Povinný požadavek</span>
              </label>
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
