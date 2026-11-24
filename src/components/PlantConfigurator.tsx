import React from 'react';
import { AlertTriangle, Info, RotateCcw } from 'lucide-react';
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
        <h2 className="card-title">Parametry zdroje</h2>
        <button
          id="btn-reset-configurator"
          type="button"
          className="icon-btn"
          onClick={onResetConfig}
          title="Obnovit výchozí"
          aria-label="Obnovit výchozí"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <div className="card-body">
        <div className="field-group">
          <span className="field-label">Technologie</span>
          <div className="choice-grid-2">
            {PLANT_TECHNOLOGIES.map((tech) => (
              <button
                key={tech.id}
                id={`tech-btn-${tech.id}`}
                type="button"
                className={`choice-btn ${config.technology === tech.id ? 'selected' : ''}`}
                onClick={() => handleTechChange(tech.id)}
                title={tech.sub}
              >
                {tech.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="input-installed-power" className="field-label">
            Instalovaný výkon (Pi)
          </label>
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
              placeholder="9.9"
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

        <div className="field-group">
          <span className="field-label">Napěťová hladina</span>
          <div className="choice-grid-3">
            {VOLTAGE_LEVELS.map((v) => (
              <button
                key={v.id}
                id={`voltage-btn-${v.id}`}
                type="button"
                className={`choice-btn ${config.voltage === v.id ? 'selected' : ''}`}
                onClick={() => handleVoltageChange(v.id)}
                title={v.sub}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="select-rfg-category" className="field-label">
            Kategorie RfG
          </label>
          <select
            id="select-rfg-category"
            className="select-input"
            value={config.category}
            onChange={(e) => handleCategoryChange(e.target.value as PowerCategory)}
          >
            {POWER_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label} · {cat.rangeLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="select-export-mode" className="field-label">
            Přetoky do sítě
          </label>
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
                disabled={
                  m.id === 'MIKROZDROJ_BEZ_PRETOKU' &&
                  (config.installedPowerKw > 10.8 || config.voltage !== 'NN')
                }
              >
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <span className="field-label">Další podmínky</span>
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

        <div className="reg-alerts">
          {config.installedPowerKw <= 3.7 && config.voltage === 'NN' && (
            <div className="reg-alert info">
              <Info size={15} />
              <span>Do 3,7 kVA lze připojit jednofázově.</span>
            </div>
          )}

          {config.exportMode === 'MIKROZDROJ_BEZ_PRETOKU' && (
            <div className="reg-alert warn">
              <AlertTriangle size={15} />
              <span>Pr = 0 kW — přetoky do DS jsou penalizovány.</span>
            </div>
          )}

          {config.installedPowerKw > 50 && config.installedPowerKw < 100 && (
            <div className="reg-alert warn">
              <AlertTriangle size={15} />
              <span>Nad 50 kW nutná licence ERÚ; řízení na NN přes HDO.</span>
            </div>
          )}

          {(config.installedPowerKw >= 100 || ['B1', 'B2', 'C_D'].includes(config.category)) && (
            <div className="reg-alert warn">
              <AlertTriangle size={15} />
              <span>Od 100 kW povinná ŘJ se SIM, telemetrie, MPP a UPOS.</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
