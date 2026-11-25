import React, { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  type ChecklistItemTemplate,
  CUSTOMER_TYPES,
  matchesPlantConfig,
  PI_RANGES,
  type SavedProject,
  VYROBNA_TYPES,
} from '../types';

interface SavedProjectsViewProps {
  projects: SavedProject[];
  allItems: ChecklistItemTemplate[];
  activeProjectId: string | null;
  onSelectProject: (project: SavedProject) => void;
  onDeleteProject: (projectId: string) => void;
  onCreateNewFromCurrent: () => void;
}

export const SavedProjectsView: React.FC<SavedProjectsViewProps> = ({
  projects,
  allItems,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onCreateNewFromCurrent,
}) => {
  const [search, setSearch] = useState('');

  const filtered = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.contractNumber.toLowerCase().includes(q) ||
      p.eanCode.toLowerCase().includes(q)
    );
  });

  return (
    <section aria-label="Uložené projekty">
      <div className="section-head">
        <h2>
          Projekty <span className="count">{projects.length}</span>
        </h2>

        <div className="row">
          {projects.length > 0 && (
            <div className="search-box" style={{ minWidth: 240 }}>
              <Search size={15} />
              <input
                id="input-search-projects"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat projekt…"
              />
            </div>
          )}
          <button
            id="btn-new-project-from-list"
            type="button"
            className="btn btn-accent"
            onClick={onCreateNewFromCurrent}
          >
            <Plus size={15} />
            Nový projekt
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card empty-state">
          <p>{projects.length === 0 ? 'Zatím žádné uložené projekty.' : 'Nic nenalezeno.'}</p>
          {projects.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onCreateNewFromCurrent}
            >
              <Plus size={15} />
              Uložit aktuální konfiguraci
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map((proj) => {
            const relevantItems = allItems.filter((item) =>
              matchesPlantConfig(item, {
                customerType: proj.customerType,
                voltage: proj.voltage,
                pi: proj.pi,
                rv: proj.rv,
                rp: proj.rp,
                svr: proj.svr,
                vyrobnaTypes: proj.vyrobnaTypes,
              })
            );
            const checkedSet = new Set(proj.checkedIds);
            const done = relevantItems.filter((i) => checkedSet.has(i.id)).length;
            const total = relevantItems.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            const customerLabel =
              CUSTOMER_TYPES.find((c) => c.id === proj.customerType)?.label || proj.customerType;
            const piLabel = proj.pi ? PI_RANGES.find((p) => p.id === proj.pi)?.label || proj.pi : null;
            const vyrobnaLabels = proj.vyrobnaTypes.map(
              (vt) => VYROBNA_TYPES.find((t) => t.id === vt)?.label || vt
            );
            const isActive = proj.id === activeProjectId;

            return (
              <article
                key={proj.id}
                id={`open-proj-${proj.id}`}
                className={`project-card ${isActive ? 'active-card' : ''}`}
                onClick={() => onSelectProject(proj)}
              >
                <div>
                  <div className="project-card-head">
                    <h3>{proj.name}</h3>
                    <button
                      id={`del-proj-${proj.id}`}
                      type="button"
                      className="icon-btn sm danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Smazat projekt „${proj.name}“?`)) {
                          onDeleteProject(proj.id);
                        }
                      }}
                      title="Smazat"
                      aria-label="Smazat projekt"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="spec-pills">
                    <span className="spec-pill highlight">{customerLabel}</span>
                    <span className="spec-pill">{proj.voltage}</span>
                    {piLabel && <span className="spec-pill">Pi {piLabel}</span>}
                    {vyrobnaLabels.map((lbl) => (
                      <span key={lbl} className="spec-pill">
                        {lbl}
                      </span>
                    ))}
                    {proj.contractNumber && (
                      <span className="spec-pill">SoP {proj.contractNumber}</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="progress-track" style={{ marginBottom: '0.5rem' }}>
                    <div
                      className={`progress-fill ${pct === 100 && total > 0 ? 'complete' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="project-card-foot">
                    <span>
                      {done}/{total} · {pct} %
                    </span>
                    <span>{new Date(proj.updatedAtIso).toLocaleDateString('cs-CZ')}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
