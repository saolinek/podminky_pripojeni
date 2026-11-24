import React from 'react';
import { AlertTriangle, Info, RotateCcw, Zap } from 'lucide-react';
import {
  EXPORT_MODES,
  type ExportMode,
  inferCategoryAndDefaults,
  PLANT_TECHNOLOGIES,
  type PlantConfig,
  type PlantTechnology,
  POWER_CATEGORIES,
  type PowerCategory,
  SPECIAL_FLAGS,
  type SpecialFlag,
  VOLTAGE_LEVELS,
  type VoltageLevel,
} from '../types';

interface PlantConfiguratorProps {
  config: PlantConfig;
  onChange: (next: PlantConfig) => void;
  onResetConfig: () => void;
}

const POWER_PRESETS = [
  { label: '3,7 kW (1f)', value: 3.7 },
  { label: '9,9 kW', value: 9.9 },
  { label: '10,8 kW', value: 10.8 },
  { label: '29,9 kW', value: 29.9 },
  { label: '49,9 kW', value: 49.9 },
  { label: '99 kW', value: 99 },
  { label: '250 kW', value: 250 },
  { label: '1 500 kW', value: 1500 },
];

export const PlantConfigurator: React.FC<PlantConfiguratorProps> = ({
  config,
  onChange,
  onResetConfig,
}) => {
  const handlePowerChange = (raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    if (Number.isNaN(parsed)) {
      onChange({ ...config, installedPowerKw: 0 });
      return;
    }
    onChange(inferCategoryAndDefaults(parsed, config));
  };

  const handleCategoryChange = (category: PowerCategory) => {
    let nextExport = config.exportMode;
    let nextVoltage = config.voltage;
    if (category !== 'MIKROZDROJ' && nextExport === 'MIKROZDROJ_BEZ_PRETOKU') {
      nextExport = 'STANDARD_PRETOKY';
    }
    if (category === 'MIKROZDROJ') {
      nextVoltage = 'NN';
    }
    onChange({
      ...config,
      category,
      voltage: nextVoltage,
      exportMode: nextExport,
    });
  };

  const handleVoltageChange = (voltage: VoltageLevel) => {
    const nextFlags = new Set<SpecialFlag>(config.flags);
    let nextExport = config.exportMode;
    let nextCat = config.category;

    if (voltage !== 'NN') {
      nextFlags.add('NEPRIME_MERENI');
      if (nextExport === 'MIKROZDROJ_BEZ_PRETOKU') {
        nextExport = 'STANDARD_PRETOKY';
      }
      if (nextCat === 'MIKROZDROJ') {
        nextCat = 'A1';
      }
    }

    onChange({
      ...config,
      voltage,
      category: nextCat,
      exportMode: nextExport,
      flags: Array.from(nextFlags),
    });
  };

  const handleTechChange = (technology: PlantTechnology) => {
    onChange({ ...config, technology });
  };

  const handleExportModeChange = (exportMode: ExportMode) => {
    if (exportMode === 'MIKROZDROJ_BEZ_PRETOKU') {
      const clampedPower = config.installedPowerKw > 10.8 ? 10.8 : config.installedPowerKw;
      const flags = config.flags.filter((f) => f !== 'NAD_50_KW_LICENCE' && f !== 'NEPRIME_MERENI');
      onChange({
        ...config,
        installedPowerKw: clampedPower,
        category: 'MIKROZDROJ',
        voltage: 'NN',
        exportMode,
        flags,
      });
      return;
    }
    onChange({ ...config, exportMode });
  };

  const toggleFlag = (flag: SpecialFlag) => {
    const has = config.flags.includes(flag);
    const nextFlags = has
      ? config.flags.filter((f) => f !== flag)
      : [...config.flags, flag];
    onChange({ ...config, flags: nextFlags });
  };

  return (
    <aside className="surface-card config-sticky" aria-label="Konfigurátor výrobny">
      <div className="card-header">
        <div className="card-title-group">
          <h2>Parametry připojovaného zdroje</h2>
          <p>Zadejte výrobnu – seznam se ihned přizpůsobí dle PPDS ČEZ Distribuce</p>
        </div>
        <button
          id="btn-reset-configurator"
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onResetConfig}
          title="Obnovit výchozí parametry zdroje"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="card-body">
        {/* 1. Druh technologie */}
        <div className="field-group">
          <div className="field-label-row">
            <span className="field-label">1. Technologie zdroje / akumulace</span>
          </div>
          <div className="choice-grid-2">
            {PLANT_TECHNOLOGIES.map((tech) => {
              const selected = config.technology === tech.id;
              return (
                <button
                  key={tech.id}
                  id={`tech-btn-${tech.id}`}
                  type="button"
                  className={`choice-btn ${selected ? 'selected' : ''}`}
                  onClick={() => handleTechChange(tech.id)}
                >
                  <span className="choice-btn-title">{tech.label}</span>
                  <span className="choice-btn-sub">{tech.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Instalovaný výkon Pi */}
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="input-installed-power" className="field-label">
              2. Celkový instalovaný výkon Pi
            </label>
            <span className="field-hint">Automaticky určí kategorii RfG</span>
          </div>
          <div className="power-input-wrap">
            <input
              id="input-installed-power"
              type="number"
              min={0.1}
              max={500000}
              step="0.1"
              className="power-input"
              value={config.installedPowerKw || ''}
              onChange={(e) => handlePowerChange(e.target.value)}
              placeholder="např. 9.9"
            />
            <span className="power-unit">kW</span>
          </div>
          <div className="preset-chips">
            {POWER_PRESETS.map((preset) => (
              <button
                key={preset.value}
                id={`preset-kw-${preset.value}`}
                type="button"
                className={`preset-chip ${
                  Math.abs(config.installedPowerKw - preset.value) < 0.01 ? 'active' : ''
                }`}
                onClick={() => onChange(inferCategoryAndDefaults(preset.value, config))}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Napěťová hladina */}
        <div className="field-group">
          <div className="field-label-row">
            <span className="field-label">3. Napěťová hladina připojení</span>
          </div>
          <div className="choice-grid-3">
            {VOLTAGE_LEVELS.map((v) => {
              const selected = config.voltage === v.id;
              return (
                <button
                  key={v.id}
                  id={`voltage-btn-${v.id}`}
                  type="button"
                  className={`choice-btn ${selected ? 'selected' : ''}`}
                  onClick={() => handleVoltageChange(v.id)}
                >
                  <span className="choice-btn-title">
                    <Zap size={13} />
                    {v.label}
                  </span>
                  <span className="choice-btn-sub">{v.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Kategorie výrobního modulu (PPDS P4 / RfG) */}
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="select-rfg-category" className="field-label">
              4. Kategorie výrobního modulu (PPDS Příloha č. 4)
            </label>
          </div>
          <select
            id="select-rfg-category"
            className="select-input"
            value={config.category}
            onChange={(e) => handleCategoryChange(e.target.value as PowerCategory)}
          >
            {POWER_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label} — {cat.rangeLabel}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Režim přetoků */}
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="select-export-mode" className="field-label">
              5. Režim dodávky (přetoků) do sítě ČEZ Distribuce
            </label>
          </div>
          <select
            id="select-export-mode"
            className="select-input"
            value={config.exportMode}
            onChange={(e) => handleExportModeChange(e.target.value as ExportMode)}
          >
            {EXPORT_MODES.map((m) => (
              <option
                key={m.id}
                value={m.id}
                disabled={m.id === 'MIKROZDROJ_BEZ_PRETOKU' && (config.installedPowerKw > 10.8 || config.voltage !== 'NN')}
              >
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 6. Specifické okolnosti */}
        <div className="field-group">
          <div className="field-label-row">
            <span className="field-label">6. Doplňující podmínky místa připojení</span>
          </div>
          <div className="flags-list">
            {SPECIAL_FLAGS.map((flag) => {
              const checked = config.flags.includes(flag.id);
              return (
                <label
                  key={flag.id}
                  htmlFor={`flag-chk-${flag.id}`}
                  className={`flag-toggle ${checked ? 'checked' : ''}`}
                  title={flag.hint}
                >
                  <input
                    id={`flag-chk-${flag.id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFlag(flag.id)}
                  />
                  <span>{flag.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Dynamická upozornění dle pravidel ČEZ Distribuce */}
        <div className="reg-alerts">
          {config.installedPowerKw <= 3.7 && config.voltage === 'NN' && (
            <div className="reg-alert info">
              <Info size={16} />
              <span>
                <strong>Jednofázové připojení povoleno:</strong> Do výkonu střídače 3,7 kVA / fázi lze zdroj na NN připojit i jednofázově (kap. 4.1.7 PP NN).
              </span>
            </div>
          )}

          {config.exportMode === 'MIKROZDROJ_BEZ_PRETOKU' && (
            <div className="reg-alert warn">
              <AlertTriangle size={16} />
              <span>
                <strong>Zjednodušený mikrozdroj (§ 16):</strong> Nulový rezervovaný výkon (Pr = 0 kW). Jakákoliv nechtěná dodávka přetoků do DS je penalizována dle Cenového rozhodnutí ERÚ.
              </span>
            </div>
          )}

          {config.installedPowerKw > 50 && config.installedPowerKw < 100 && (
            <div className="reg-alert warn">
              <AlertTriangle size={16} />
              <span>
                <strong>Výkon nad 50 kW (Kategorie A2):</strong> Vyžaduje licenci ERÚ na výrobu elektřiny a stavební povolení, ale řízení výkonu na NN stále řeší přijímač HDO (bez ŘJ se SIM).
              </span>
            </div>
          )}

          {(config.installedPowerKw >= 100 || ['B1', 'B2', 'C_D'].includes(config.category)) && (
            <div className="reg-alert warn">
              <AlertTriangle size={16} />
              <span>
                <strong>Povinné dispečerské řízení a UPOS (od 100 kW):</strong> Nutná vlastní Řídicí jednotka se SIM kartou ČEZ Distribuce (optikou na VVN), schválení PD + Tabulky telemetrie, MPP, zkoušky bod–bod a ověření souladu RfG v režimu UPOS.
              </span>
            </div>
          )}

          {(config.technology === 'FVE_BESS' || config.technology === 'BESS') && (
            <div className="reg-alert info">
              <Info size={16} />
              <span>
                <strong>Pravidlo pro akumulaci (BESS):</strong> Mají-li FVE a baterie společný hybridní střídač, počítá se za Pi vyšší z hodnot panelů nebo střídače; u samostatných střídačů se výkony sčítají.
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
