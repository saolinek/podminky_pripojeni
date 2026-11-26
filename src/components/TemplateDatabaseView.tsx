import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  FolderPlus,
  GripVertical,
  KeyRound,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  type ChecklistItemTemplate,
  CUSTOMER_TYPES,
  type CustomerType,
  type PhaseGroup,
  type PhaseId,
  PI_RANGES,
  type PiRange,
  RP_RANGES,
  type RpRange,
  RV_RANGES,
  type RvRange,
  VOLTAGE_LEVELS,
  type VoltageLevel,
  VYROBNA_TYPES,
  type VyrobnaType,
  YES_NO_OPTIONS,
  type YesNo,
} from '../types';
import type { AdminRole } from '../services/adminAuthService';

interface TemplateDatabaseViewProps {
  groups: PhaseGroup[];
  items: ChecklistItemTemplate[];
  adminRole: AdminRole;
  editingInitialItem: ChecklistItemTemplate | null;
  onClearInitialEdit: () => void;
  onSaveItem: (item: ChecklistItemTemplate, isNew: boolean) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onReorderItems: (updates: { id: string; phase: PhaseId; order: number }[]) => Promise<void>;
  onSaveGroups: (groups: PhaseGroup[], toastText?: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

function getGroupBaseOrder(groups: PhaseGroup[], phaseId: PhaseId): number {
  const idx = groups.findIndex((g) => g.id === phaseId);
  return (idx >= 0 ? idx : 0) * 1000;
}

function getNextOrderInPhase(
  groups: PhaseGroup[],
  items: ChecklistItemTemplate[],
  phaseId: PhaseId
): number {
  const inPhase = items.filter((i) => i.phase === phaseId);
  if (inPhase.length === 0) {
    return getGroupBaseOrder(groups, phaseId) + 10;
  }
  const maxOrder = Math.max(...inPhase.map((i) => i.order));
  return Math.min(maxOrder + 10, 100000);
}

export const TemplateDatabaseView: React.FC<TemplateDatabaseViewProps> = ({
  groups,
  items,
  adminRole,
  editingInitialItem,
  onClearInitialEdit,
  onSaveItem,
  onDeleteItem,
  onReorderItems,
  onSaveGroups,
  onDeleteGroup,
  onOpenChangePassword,
  onLogout,
}) => {
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const [filterCustomerTypes, setFilterCustomerTypes] = useState<CustomerType[]>([]);
  const [filterVoltages, setFilterVoltages] = useState<VoltageLevel[]>([]);
  const [filterPiRanges, setFilterPiRanges] = useState<PiRange[]>([]);
  const [filterRvRanges, setFilterRvRanges] = useState<RvRange[]>([]);
  const [filterRpRanges, setFilterRpRanges] = useState<RpRange[]>([]);
  const [filterSvr, setFilterSvr] = useState<YesNo[]>([]);
  const [filterVyrobnaTypes, setFilterVyrobnaTypes] = useState<VyrobnaType[]>([]);

  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [modalItem, setModalItem] = useState<ChecklistItemTemplate | null>(editingInitialItem);
  const [originalPhase, setOriginalPhase] = useState<PhaseId | null>(
    editingInitialItem ? editingInitialItem.phase : null
  );
  const [isNewModal, setIsNewModal] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  // Group create / rename modal state
  const [groupModal, setGroupModal] = useState<{ id: PhaseId | null; title: string } | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);

  // Drag-and-drop state
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

  const activeTagFilterCount =
    filterCustomerTypes.length +
    filterVoltages.length +
    filterPiRanges.length +
    filterRvRanges.length +
    filterRpRanges.length +
    filterSvr.length +
    filterVyrobnaTypes.length;

  const hasActiveFilter = search.trim().length > 0 || activeTagFilterCount > 0;

  const toggleInArray = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const clearTagFilters = () => {
    setFilterCustomerTypes([]);
    setFilterVoltages([]);
    setFilterPiRanges([]);
    setFilterRvRanges([]);
    setFilterRpRanges([]);
    setFilterSvr([]);
    setFilterVyrobnaTypes([]);
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (phaseFilter !== 'ALL' && item.phase !== phaseFilter) return false;
        if (q && !item.title.toLowerCase().includes(q)) return false;

        if (
          filterCustomerTypes.length > 0 &&
          item.customerTypes.length > 0 &&
          !item.customerTypes.some((c) => filterCustomerTypes.includes(c))
        ) {
          return false;
        }
        if (
          filterVoltages.length > 0 &&
          item.voltages.length > 0 &&
          !item.voltages.some((v) => filterVoltages.includes(v))
        ) {
          return false;
        }
        if (
          filterPiRanges.length > 0 &&
          item.piRanges.length > 0 &&
          !item.piRanges.some((p) => filterPiRanges.includes(p))
        ) {
          return false;
        }
        if (
          filterRvRanges.length > 0 &&
          item.rvRanges.length > 0 &&
          !item.rvRanges.some((r) => filterRvRanges.includes(r))
        ) {
          return false;
        }
        if (
          filterRpRanges.length > 0 &&
          item.rpRanges.length > 0 &&
          !item.rpRanges.some((r) => filterRpRanges.includes(r))
        ) {
          return false;
        }
        if (
          filterSvr.length > 0 &&
          item.svrFilter.length > 0 &&
          !item.svrFilter.some((s) => filterSvr.includes(s))
        ) {
          return false;
        }
        if (
          filterVyrobnaTypes.length > 0 &&
          !item.vyrobnaTypes.some((t) => filterVyrobnaTypes.includes(t))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [
    items,
    search,
    phaseFilter,
    filterCustomerTypes,
    filterVoltages,
    filterPiRanges,
    filterRvRanges,
    filterRpRanges,
    filterSvr,
    filterVyrobnaTypes,
  ]);

  const visibleGroups = useMemo(() => {
    return groups.filter((g) => {
      if (phaseFilter !== 'ALL' && g.id !== phaseFilter) return false;
      if (hasActiveFilter) {
        return filteredItems.some((i) => i.phase === g.id);
      }
      return true;
    });
  }, [groups, phaseFilter, hasActiveFilter, filteredItems]);

  const togglePhase = (phaseId: PhaseId) => {
    setCollapsedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const openNewInPhase = (phaseId?: PhaseId) => {
    const targetPhase =
      phaseId ||
      (phaseFilter !== 'ALL' && groups.some((g) => g.id === phaseFilter)
        ? phaseFilter
        : groups[0]?.id);
    if (!targetPhase) {
      setGroupModal({ id: null, title: '' });
      return;
    }
    const nextOrder = getNextOrderInPhase(groups, items, targetPhase);
    setModalItem({
      id: `vlastni-${Date.now().toString(36)}`,
      title: '',
      description: '',
      phase: targetPhase,
      order: nextOrder,
      reference: '',
      deadlineBadge: '',
      mandatory: true,
      customerTypes: [...filterCustomerTypes],
      voltages: [...filterVoltages],
      piRanges: [...filterPiRanges],
      rvRanges: [...filterRvRanges],
      rpRanges: [...filterRpRanges],
      svrFilter: [...filterSvr],
      vyrobnaTypes: [...filterVyrobnaTypes],
      createdBy: 'user',
      updatedAtIso: new Date().toISOString(),
    });
    setOriginalPhase(null);
    setIsNewModal(true);
  };

  const openEditItem = (item: ChecklistItemTemplate) => {
    setModalItem({ ...item });
    setOriginalPhase(item.phase);
    setIsNewModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalItem || !modalItem.title.trim()) return;
    setSaving(true);
    try {
      const nextOrder =
        isNewModal || (originalPhase && originalPhase !== modalItem.phase)
          ? getNextOrderInPhase(
              groups,
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

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupModal || !groupModal.title.trim()) return;
    setSavingGroup(true);
    try {
      const title = groupModal.title.trim();
      if (groupModal.id) {
        const nextGroups = groups.map((g) => (g.id === groupModal.id ? { ...g, title } : g));
        await onSaveGroups(nextGroups, `Skupina přejmenována na „${title}“.`);
      } else {
        const newGroup: PhaseGroup = {
          id: `skupina-${Date.now().toString(36)}`,
          title,
        };
        await onSaveGroups([...groups, newGroup], `Skupina „${title}“ vytvořena.`);
      }
      setGroupModal(null);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroupClick = async (group: PhaseGroup) => {
    const count = items.filter((i) => i.phase === group.id).length;
    const msg =
      count > 0
        ? `Smazat skupinu „${group.title}“ včetně ${count} podmínek uvnitř?`
        : `Smazat skupinu „${group.title}“?`;
    if (!window.confirm(msg)) return;
    if (phaseFilter === group.id) {
      setPhaseFilter('ALL');
    }
    await onDeleteGroup(group.id);
  };

  const buildPhaseOrderUpdates = (
    phaseId: PhaseId,
    orderedList: ChecklistItemTemplate[]
  ): { id: string; phase: PhaseId; order: number }[] => {
    const base = getGroupBaseOrder(groups, phaseId);
    const updates: { id: string; phase: PhaseId; order: number }[] = [];
    orderedList.forEach((item, index) => {
      const nextOrder = base + (index + 1) * 10;
      if (item.phase !== phaseId || item.order !== nextOrder) {
        updates.push({ id: item.id, phase: phaseId, order: nextOrder });
      }
    });
    return updates;
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

  return (
    <section aria-label="Databáze podmínek">
      <div className="section-head">
        <div className="row">
          <h2>
            Podmínky <span className="count">{filteredItems.length}</span>
          </h2>
          <span
            className={`role-badge ${adminRole === 'superadmin' ? 'superadmin' : ''}`}
            title={
              adminRole === 'superadmin'
                ? 'Přihlášen jako superadmin (neměnné heslo)'
                : 'Přihlášen jako admin'
            }
          >
            <ShieldCheck size={13} />
            {adminRole === 'superadmin' ? 'Superadmin' : 'Admin'}
          </span>
        </div>

        <div className="row">
          <button
            id="btn-change-admin-password"
            type="button"
            className="btn btn-secondary"
            onClick={onOpenChangePassword}
            title="Změnit heslo admina"
          >
            <KeyRound size={14} />
            Změnit heslo
          </button>

          <button
            id="btn-admin-logout"
            type="button"
            className="icon-btn bordered"
            onClick={onLogout}
            title="Odhlásit správce"
            aria-label="Odhlásit správce"
          >
            <LogOut size={15} />
          </button>

          <button
            id="btn-add-group"
            type="button"
            className="btn btn-secondary"
            onClick={() => setGroupModal({ id: null, title: '' })}
          >
            <FolderPlus size={15} />
            Nová skupina
          </button>

          <button
            id="btn-add-db-item"
            type="button"
            className="btn btn-accent"
            onClick={() => openNewInPhase()}
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
          style={{ width: 'auto', minWidth: 210 }}
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
        >
          <option value="ALL">Všechny skupiny</option>
          {groups.map((g, idx) => (
            <option key={g.id} value={g.id}>
              {idx + 1}. {g.title}
            </option>
          ))}
        </select>

        <button
          id="btn-toggle-tag-filters"
          type="button"
          className={`btn ${showFilters || activeTagFilterCount > 0 ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal size={14} />
          Filtry
          {activeTagFilterCount > 0 && <span className="btn-badge">{activeTagFilterCount}</span>}
        </button>

        {activeTagFilterCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearTagFilters}
          >
            Vymazat
          </button>
        )}
      </div>

      {showFilters && (
        <div className="surface-card filter-panel">
          <div className="filter-row">
            <span className="filter-row-label">Typ odběratele</span>
            <div className="tag-picker">
              {CUSTOMER_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  className={`tag-chip ${filterCustomerTypes.includes(ct.id) ? 'selected' : ''}`}
                  onClick={() => setFilterCustomerTypes((prev) => toggleInArray(prev, ct.id))}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-row-label">Napěťová hladina</span>
            <div className="tag-picker">
              {VOLTAGE_LEVELS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`tag-chip ${filterVoltages.includes(v.id) ? 'selected' : ''}`}
                  onClick={() => setFilterVoltages((prev) => toggleInArray(prev, v.id))}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-row-label">Rp</span>
            <div className="tag-picker">
              {RP_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`tag-chip ${filterRpRanges.includes(r.id) ? 'selected' : ''}`}
                  onClick={() => setFilterRpRanges((prev) => toggleInArray(prev, r.id))}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-row-label">SVR</span>
            <div className="tag-picker">
              {YES_NO_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`tag-chip ${filterSvr.includes(opt.id) ? 'selected' : ''}`}
                  onClick={() => setFilterSvr((prev) => toggleInArray(prev, opt.id))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-subpanel">
            <div className="filter-row">
              <span className="filter-row-label">Typ výrobny</span>
              <div className="tag-picker">
                {VYROBNA_TYPES.map((vt) => (
                  <button
                    key={vt.id}
                    type="button"
                    className={`tag-chip ${filterVyrobnaTypes.includes(vt.id) ? 'selected' : ''}`}
                    onClick={() => setFilterVyrobnaTypes((prev) => toggleInArray(prev, vt.id))}
                  >
                    {vt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-row">
              <span className="filter-row-label">Pi</span>
              <div className="tag-picker">
                {PI_RANGES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`tag-chip ${filterPiRanges.includes(p.id) ? 'selected' : ''}`}
                    onClick={() => setFilterPiRanges((prev) => toggleInArray(prev, p.id))}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-row">
              <span className="filter-row-label">Rv</span>
              <div className="tag-picker">
                {RV_RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`tag-chip ${filterRvRanges.includes(r.id) ? 'selected' : ''}`}
                    onClick={() => setFilterRvRanges((prev) => toggleInArray(prev, r.id))}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {visibleGroups.length === 0 ? (
        <div className="surface-card empty-state">
          <p>{groups.length === 0 ? 'Zatím žádné skupiny.' : 'Nic nenalezeno.'}</p>
        </div>
      ) : (
        <div className="phases-stack">
          {visibleGroups.map((group) => {
            const stepNum = groups.findIndex((g) => g.id === group.id) + 1;
            const phaseItems = filteredItems.filter((i) => i.phase === group.id);
            const isCollapsed = Boolean(collapsedPhases[group.id]);
            const isPhaseDropTarget = dropTargetPhaseId === group.id && !dropTargetItemId;

            return (
              <div
                key={group.id}
                className={`phase-block ${isPhaseDropTarget ? 'drop-target' : ''}`}
                onDragOver={(e) => {
                  if (!draggedId) return;
                  e.preventDefault();
                  if (dropTargetPhaseId !== group.id) {
                    setDropTargetPhaseId(group.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    if (dropTargetPhaseId === group.id) setDropTargetPhaseId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnPhase(group.id);
                }}
              >
                <div className="phase-header-bar">
                  <button
                    id={`db-phase-toggle-${group.id}`}
                    type="button"
                    className={`phase-header ${isCollapsed ? 'collapsed' : ''}`}
                    onClick={() => togglePhase(group.id)}
                  >
                    <div className="phase-header-left">
                      <span className="phase-step-num">{stepNum}</span>
                      <h3 className="phase-title">{group.title}</h3>
                    </div>
                    <div className="phase-header-right">
                      <span className="phase-count-pill">{phaseItems.length}</span>
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  <div className="phase-group-actions">
                    <button
                      id={`btn-add-in-phase-${group.id}`}
                      type="button"
                      className="icon-btn sm phase-add-btn"
                      onClick={() => openNewInPhase(group.id)}
                      title={`Přidat podmínku do „${group.title}“`}
                      aria-label={`Přidat podmínku do ${group.title}`}
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      id={`btn-rename-group-${group.id}`}
                      type="button"
                      className="icon-btn sm"
                      onClick={() => setGroupModal({ id: group.id, title: group.title })}
                      title="Přejmenovat skupinu"
                      aria-label="Přejmenovat skupinu"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      id={`btn-del-group-${group.id}`}
                      type="button"
                      className="icon-btn sm danger"
                      onClick={() => handleDeleteGroupClick(group)}
                      title="Smazat skupinu"
                      aria-label="Smazat skupinu"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="items-list">
                    {phaseItems.length === 0 ? (
                      <div className="phase-empty-drop">
                        Žádné podmínky · přetáhněte sem nebo přidejte přes +
                      </div>
                    ) : (
                      phaseItems.map((item) => (
                        <div
                          key={item.id}
                          className={`db-item-row ${draggedId === item.id ? 'dragging' : ''} ${
                            dropTargetItemId === item.id ? 'drop-before' : ''
                          }`}
                          draggable
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
                            setDropTargetPhaseId(group.id);
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
                          <span className="drag-handle" aria-hidden="true" title="Přetáhnout">
                            <GripVertical size={15} />
                          </span>

                          <h3 className="db-item-title">{item.title}</h3>

                          <div className="row-actions">
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

      {/* Create / Rename Group Modal */}
      {groupModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form
            className="modal-panel"
            style={{ maxWidth: 420 }}
            onSubmit={handleGroupSubmit}
          >
            <div className="modal-header">
              <h3>{groupModal.id ? 'Přejmenovat skupinu' : 'Nová skupina'}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setGroupModal(null)}
                aria-label="Zavřít"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="field-group">
                <label className="field-label" htmlFor="input-group-title">
                  Název skupiny *
                </label>
                <input
                  id="input-group-title"
                  type="text"
                  required
                  maxLength={120}
                  className="text-input"
                  value={groupModal.title}
                  onChange={(e) => setGroupModal({ ...groupModal, title: e.target.value })}
                  placeholder="Např. Dokumentace"
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setGroupModal(null)}
              >
                Zrušit
              </button>
              <button type="submit" className="btn btn-accent" disabled={savingGroup}>
                {savingGroup ? 'Ukládám…' : 'Uložit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create / Edit Condition Modal */}
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
                  onChange={(e) => setModalItem({ ...modalItem, phase: e.target.value })}
                >
                  {groups.map((g, idx) => (
                    <option key={g.id} value={g.id}>
                      {idx + 1}. {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Typ odběratele</span>
                  <span className="field-hint">prázdné = vše</span>
                </div>
                <div className="tag-picker">
                  {CUSTOMER_TYPES.map((ct) => {
                    const active = modalItem.customerTypes.includes(ct.id);
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        className={`tag-chip ${active ? 'selected' : ''}`}
                        onClick={() =>
                          setModalItem({
                            ...modalItem,
                            customerTypes: toggleInArray<CustomerType>(
                              modalItem.customerTypes,
                              ct.id
                            ),
                          })
                        }
                      >
                        {ct.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">Napěťová hladina</span>
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
                  <span className="field-label">Rp</span>
                  <span className="field-hint">prázdné = vše</span>
                </div>
                <div className="tag-picker">
                  {RP_RANGES.map((r) => {
                    const active = modalItem.rpRanges.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`tag-chip ${active ? 'selected' : ''}`}
                        onClick={() =>
                          setModalItem({
                            ...modalItem,
                            rpRanges: toggleInArray<RpRange>(modalItem.rpRanges, r.id),
                          })
                        }
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <span className="field-label">SVR</span>
                  <span className="field-hint">prázdné = vše</span>
                </div>
                <div className="tag-picker">
                  {YES_NO_OPTIONS.map((opt) => {
                    const active = modalItem.svrFilter.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`tag-chip ${active ? 'selected' : ''}`}
                        onClick={() =>
                          setModalItem({
                            ...modalItem,
                            svrFilter: toggleInArray<YesNo>(modalItem.svrFilter, opt.id),
                          })
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group vyrobna-subpanel">
                <div className="field-group">
                  <div className="field-label-row">
                    <span className="field-label">Typ výrobny</span>
                    <span className="field-hint">prázdné = bez výrobny</span>
                  </div>
                  <div className="tag-picker">
                    {VYROBNA_TYPES.map((vt) => {
                      const active = modalItem.vyrobnaTypes.includes(vt.id);
                      return (
                        <button
                          key={vt.id}
                          type="button"
                          className={`tag-chip ${active ? 'selected' : ''}`}
                          onClick={() =>
                            setModalItem({
                              ...modalItem,
                              vyrobnaTypes: toggleInArray<VyrobnaType>(
                                modalItem.vyrobnaTypes,
                                vt.id
                              ),
                            })
                          }
                        >
                          {vt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="field-group">
                  <div className="field-label-row">
                    <span className="field-label">Pi</span>
                    <span className="field-hint">prázdné = vše</span>
                  </div>
                  <div className="tag-picker">
                    {PI_RANGES.map((p) => {
                      const active = modalItem.piRanges.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`tag-chip ${active ? 'selected' : ''}`}
                          onClick={() =>
                            setModalItem({
                              ...modalItem,
                              piRanges: toggleInArray<PiRange>(modalItem.piRanges, p.id),
                            })
                          }
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="field-group">
                  <div className="field-label-row">
                    <span className="field-label">Rv</span>
                    <span className="field-hint">prázdné = vše</span>
                  </div>
                  <div className="tag-picker">
                    {RV_RANGES.map((r) => {
                      const active = modalItem.rvRanges.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={`tag-chip ${active ? 'selected' : ''}`}
                          onClick={() =>
                            setModalItem({
                              ...modalItem,
                              rvRanges: toggleInArray<RvRange>(modalItem.rvRanges, r.id),
                            })
                          }
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
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
