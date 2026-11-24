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
    <section aria-label="Editor sdílené databáze připojovacích podmínek">
      <div className="surface-card">
        <div className="card-header">
          <div className="card-title-group">
            <h2>Sdílená databáze připojovacích podmínek ({items.length} položek)</h2>
            <p>
              Upravujte stávající body ČEZ Distribuce, měňte pro jaké výrobny platí, nebo přidávejte vlastní firemní kroky
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              id="btn-add-db-item"
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setModalItem(createEmptyItem());
                setIsNewModal(true);
              }}
            >
              <Plus size={15} />
              Přidat novou podmínku
            </button>

            <button
              id="btn-export-db-json"
              type="button"
              className="btn btn-secondary"
              onClick={handleExportJson}
            >
              <Download size={15} />
              Export JSON
            </button>

            <button
              id="btn-reset-db-defaults"
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (
                  window.confirm(
                    'Chcete do databáze znovu nahrát výchozí sadu připojovacích podmínek ČEZ Distribuce? Vaše vlastní přidané položky s odlišným ID zůstanou zachovány.'
                  )
                ) {
                  onResetDefaults();
                }
              }}
            >
              <RotateCcw size={15} />
              Obnovit výchozí ČEZ
            </button>
          </div>
        </div>

        <div className="card-body" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="search-box" style={{ flex: 2 }}>
              <Search size={16} />
              <input
                id="input-search-db-templates"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrovat databázi podmínek podle názvu, popisu nebo normy…"
              />
            </div>
            <select
              id="select-filter-phase"
              className="select-input"
              style={{ flex: 1, minWidth: 220 }}
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
            >
              <option value="ALL">Všechny fáze připojení (1–6)</option>
              {PHASES.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  Fáze {ph.step}: {ph.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="db-items-list">
          {filteredItems.map((item) => {
            const phaseMeta = PHASES.find((p) => p.id === item.phase);
            return (
              <div key={item.id} className="db-item-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="meta-tag ref">Pořadí #{item.order}</span>
                    <span className="meta-tag deadline">
                      Fáze {phaseMeta?.step}: {phaseMeta?.title}
                    </span>
                    {item.reference && <span className="meta-tag ref">{item.reference}</span>}
                  </div>
                  <h3 style={{ margin: '0.45rem 0 0.25rem', fontSize: '0.95rem', fontWeight: 700 }}>
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                    {item.description}
                  </p>
                  <div className="spec-pills" style={{ marginTop: '0.5rem' }}>
                    <span className="spec-pill">
                      Kategorie:{' '}
                      {item.categories.length === 0 ? 'Všechny' : item.categories.join(', ')}
                    </span>
                    <span className="spec-pill">
                      Hladina: {item.voltages.length === 0 ? 'NN/VN/VVN' : item.voltages.join(', ')}
                    </span>
                    <span className="spec-pill">
                      Technologie:{' '}
                      {item.technologies.length === 0 ? 'Všechny' : item.technologies.join(', ')}
                    </span>
                    {item.requiredFlags.length > 0 && (
                      <span className="spec-pill">
                        Příznak: {item.requiredFlags.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button
                    id={`btn-edit-template-${item.id}`}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setModalItem({ ...item });
                      setIsNewModal(false);
                    }}
                  >
                    <Edit3 size={14} />
                    Upravit
                  </button>
                  <button
                    id={`btn-del-template-${item.id}`}
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (window.confirm(`Smazat podmínku „${item.title}“ ze sdílené databáze?`)) {
                        onDeleteItem(item.id);
                      }
                    }}
                    title="Smazat položku"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Editor */}
      {modalItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel" onSubmit={handleSubmit}>
            <div className="modal-header">
              <h3>{isNewModal ? 'Nová podmínka připojení' : 'Upravit podmínku v databázi'}</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setModalItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="field-group">
                <label className="field-label" htmlFor="edit-item-title">
                  Název požadavku / dokumentu *
                </label>
                <input
                  id="edit-item-title"
                  type="text"
                  required
                  maxLength={200}
                  className="text-input"
                  value={modalItem.title}
                  onChange={(e) => setModalItem({ ...modalItem, title: e.target.value })}
                  placeholder="Např. Kontrola nastavení ochran dle VP_05"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="edit-item-desc">
                  Podrobný popis z připojovacích podmínek *
                </label>
                <textarea
                  id="edit-item-desc"
                  required
                  maxLength={1500}
                  className="textarea-input"
                  value={modalItem.description}
                  onChange={(e) => setModalItem({ ...modalItem, description: e.target.value })}
                  placeholder="Uveďte přesný postup, požadované přílohy nebo lhůty ČEZ Distribuce…"
                />
              </div>

              <div className="form-row-2 field-group">
                <div>
                  <label className="field-label" htmlFor="edit-item-phase">
                    Fáze procesu připojení
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
                    Pořadí zobrazení (číslo)
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
                    Odkaz na předpis / normu
                  </label>
                  <input
                    id="edit-item-ref"
                    type="text"
                    maxLength={150}
                    className="text-input"
                    value={modalItem.reference}
                    onChange={(e) => setModalItem({ ...modalItem, reference: e.target.value })}
                    placeholder="Např. PPDS Příloha č. 4"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="edit-item-badge">
                    Štítek lhůty / upozornění
                  </label>
                  <input
                    id="edit-item-badge"
                    type="text"
                    maxLength={60}
                    className="text-input"
                    value={modalItem.deadlineBadge}
                    onChange={(e) => setModalItem({ ...modalItem, deadlineBadge: e.target.value })}
                    placeholder="Např. Lhůta 30 dnů"
                  />
                </div>
              </div>

              {/* Applicable Categories */}
              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Platí pro kategorie výkonu</span>
                  <span className="field-hint">Nevybráno nic = platí pro VŠECHNY kategorie</span>
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

              {/* Applicable Voltages */}
              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Platí pro napěťové hladiny</span>
                  <span className="field-hint">Nevybráno nic = platí pro NN, VN i VVN</span>
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

              {/* Applicable Technologies */}
              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Platí pro technologie zdroje</span>
                  <span className="field-hint">Nevybráno nic = platí pro všechny zdroje</span>
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

              {/* Applicable Export Modes */}
              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Platí pro režim přetoků</span>
                  <span className="field-hint">Nevybráno nic = platí pro všechny režimy</span>
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
                        {m.id === 'STANDARD_PRETOKY'
                          ? 'S přetoky (Pr > 0)'
                          : m.id === 'MIKROZDROJ_BEZ_PRETOKU'
                          ? 'Mikrozdroj bez přetoků (§ 16)'
                          : 'Nulový Pr = 0 kW'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Special Flags */}
              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Zobrazit jen při aktivním příznaku</span>
                  <span className="field-hint">Nevybráno nic = zobrazí se vždy</span>
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
                        {f.id}
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
                <span>Povinný požadavek (při odškrtnutí se zobrazí jako doporučený krok)</span>
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
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Ukládám…' : 'Uložit do databáze'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
