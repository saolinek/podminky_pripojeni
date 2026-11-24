import React, { useState } from 'react';
import { FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import {
  type ChecklistItemTemplate,
  matchesPlantConfig,
  PLANT_TECHNOLOGIES,
  POWER_CATEGORIES,
  type SavedProject,
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
    <section aria-label="Uložené projekty výroben ve sdílené databázi">
      <div className="surface-card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <div className="card-title-group">
            <h2>Rozpracované projekty a výrobny</h2>
            <p>
              Sdílený přehled připojovaných zdrojů s uloženým postupem odškrtávání a poznámkami
            </p>
          </div>
          <button
            id="btn-new-project-from-list"
            type="button"
            className="btn btn-primary"
            onClick={onCreateNewFromCurrent}
          >
            <Plus size={16} />
            Uložit aktuální konfiguraci jako projekt
          </button>
        </div>

        <div className="card-body">
          <div className="search-box" style={{ maxWidth: 460 }}>
            <Search size={16} />
            <input
              id="input-search-projects"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat podle názvu stavby, čísla smlouvy (412…) nebo EAN…"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>
                {projects.length === 0
                  ? 'Zatím nemáte uloženou žádnou zakázku ve sdílené databázi.'
                  : 'Žádný projekt neodpovídá hledanému výrazu.'}
              </p>
              {projects.length === 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onCreateNewFromCurrent}
                >
                  <Plus size={15} />
                  Uložit první výrobnu
                </button>
              )}
            </div>
          ) : (
            <div className="projects-grid">
              {filtered.map((proj) => {
                const relevantItems = allItems.filter((item) =>
                  matchesPlantConfig(item, {
                    installedPowerKw: proj.installedPowerKw,
                    category: proj.category,
                    voltage: proj.voltage,
                    technology: proj.technology,
                    exportMode: proj.exportMode,
                    flags: proj.flags,
                  })
                );
                const checkedSet = new Set(proj.checkedIds);
                const done = relevantItems.filter((i) => checkedSet.has(i.id)).length;
                const total = relevantItems.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                const catLabel =
                  POWER_CATEGORIES.find((c) => c.id === proj.category)?.label || proj.category;
                const techLabel =
                  PLANT_TECHNOLOGIES.find((t) => t.id === proj.technology)?.label ||
                  proj.technology;
                const isActive = proj.id === activeProjectId;

                return (
                  <article
                    key={proj.id}
                    className={`project-card ${isActive ? 'active-card' : ''}`}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                          {proj.name}
                        </h3>
                        {isActive && (
                          <span className="meta-tag deadline">Právě otevřeno</span>
                        )}
                      </div>

                      <div className="spec-pills" style={{ marginTop: '0.55rem' }}>
                        <span className="spec-pill highlight">{catLabel}</span>
                        <span className="spec-pill">{proj.installedPowerKw} kW</span>
                        <span className="spec-pill">{proj.voltage}</span>
                        <span className="spec-pill">{techLabel}</span>
                      </div>

                      {(proj.contractNumber || proj.eanCode) && (
                        <div
                          style={{
                            marginTop: '0.6rem',
                            fontSize: '0.77rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--ink-secondary)',
                          }}
                        >
                          {proj.contractNumber && <div>SoP / Žádost: {proj.contractNumber}</div>}
                          {proj.eanCode && <div>EAN: {proj.eanCode}</div>}
                        </div>
                      )}

                      <div style={{ marginTop: '0.85rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            marginBottom: '0.3rem',
                          }}
                        >
                          <span>Splněno podmínek</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cez-orange)' }}>
                            {done}/{total} ({pct} %)
                          </span>
                        </div>
                        <div className="progress-track" style={{ height: 7 }}>
                          <div
                            className={`progress-fill ${pct === 100 && total > 0 ? 'complete' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontSize: '0.73rem', color: 'var(--ink-muted)' }}>
                        Upraveno {new Date(proj.updatedAtIso).toLocaleDateString('cs-CZ')}
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          id={`open-proj-${proj.id}`}
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => onSelectProject(proj)}
                        >
                          <FolderOpen size={14} />
                          Otevřít checklist
                        </button>
                        <button
                          id={`del-proj-${proj.id}`}
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (window.confirm(`Opravdu smazat projekt „${proj.name}“?`)) {
                              onDeleteProject(proj.id);
                            }
                          }}
                          title="Smazat projekt"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
