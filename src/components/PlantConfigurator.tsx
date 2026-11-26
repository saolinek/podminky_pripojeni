import React from 'react';
import { RotateCcw } from 'lucide-react';
import {
  CUSTOMER_TYPES,
  type CustomerType,
  PI_RANGES,
  type PiRange,
  type PlantConfig,
  RP_RANGES,
  type RpRange,
  RV_RANGES,
  type RvRange,
  VOLTAGE_LEVELS,
  type VoltageLevel,
  type VyrobnaType,
} from '../types';

interface PlantConfiguratorProps {
  config: PlantConfig;
  onChange: (next: PlantConfig) => void;
  onResetConfig: () => void;
}

type VyrobnaMainChoice = 'FVE' | 'ZUE' | 'KGJ';

const KGJ_TYPES: readonly VyrobnaType[] = ['KGJ_SYNCHRONNI', 'KGJ_KOMBINACE', 'KGJ_NESYNCHRONNI'];

function normalizeVyrobnaTypes(types: Iterable<VyrobnaType>): VyrobnaType[] {
  const set = new Set<VyrobnaType>(types);
  const hasFve = set.has('FVE');
  const hasZue = set.has('ZUE');
  const hasKgj = KGJ_TYPES.some((t) => set.has(t));

  if (hasFve && hasZue) {
    if (!set.has('FVE_ZUE_SPOLECNY') && !set.has('FVE_ZUE_SAMOSTATNE')) {
      set.add('FVE_ZUE_SPOLECNY');
    }
  } else {
    set.delete('FVE_ZUE_SPOLECNY');
    set.delete('FVE_ZUE_SAMOSTATNE');
  }

  if (hasKgj) {
    if (set.has('KGJ_NESYNCHRONNI')) {
      set.delete('KGJ_SYNCHRONNI');
      set.delete('KGJ_KOMBINACE');
    } else if (hasFve || hasZue) {
      set.add('KGJ_KOMBINACE');
      set.delete('KGJ_SYNCHRONNI');
    } else {
      set.add('KGJ_SYNCHRONNI');
      set.delete('KGJ_KOMBINACE');
    }
  }

  return Array.from(set);
}

export const PlantConfigurator: React.FC<PlantConfiguratorProps> = ({
  config,
  onChange,
  onResetConfig,
}) => {
  const hasFve = config.vyrobnaTypes.includes('FVE');
  const hasZue = config.vyrobnaTypes.includes('ZUE');
  const hasFveAndZue = hasFve && hasZue;
  const hasKgj = KGJ_TYPES.some((t) => config.vyrobnaTypes.includes(t));
  const hasVyrobna = config.vyrobnaTypes.length > 0;
  const kgjCombinedWithOther = hasKgj && (hasFve || hasZue);

  const handleCustomerTypeChange = (customerType: CustomerType) => {
    onChange({ ...config, customerType });
  };

  const handleVoltageChange = (voltage: VoltageLevel) => {
    onChange({ ...config, voltage });
  };

  const handleRpChange = (rp: RpRange) => {
    onChange({ ...config, rp });
  };

  const handlePiChange = (pi: PiRange) => {
    onChange({ ...config, pi });
  };

  const handleRvChange = (rv: RvRange) => {
    onChange({ ...config, rv });
  };

  const handleVyrobnaMainToggle = (main: VyrobnaMainChoice) => {
    const next = new Set<VyrobnaType>(config.vyrobnaTypes);
    if (main === 'FVE') {
      if (next.has('FVE')) {
        next.delete('FVE');
      } else {
        next.add('FVE');
      }
    } else if (main === 'ZUE') {
      if (next.has('ZUE')) {
        next.delete('ZUE');
      } else {
        next.add('ZUE');
      }
    } else if (main === 'KGJ') {
      if (hasKgj) {
        KGJ_TYPES.forEach((t) => next.delete(t));
      } else {
        next.add(hasFve || hasZue ? 'KGJ_KOMBINACE' : 'KGJ_SYNCHRONNI');
      }
    }
    const nextTypes = normalizeVyrobnaTypes(next);
    const nextHasVyrobna = nextTypes.length > 0;
    onChange({
      ...config,
      vyrobnaTypes: nextTypes,
      pi: nextHasVyrobna ? (config.pi ?? 'DO_100') : null,
      rv: nextHasVyrobna ? (config.rv ?? 'DO_1MW') : null,
    });
  };

  const handleFveZueSubChange = (sub: 'FVE_ZUE_SPOLECNY' | 'FVE_ZUE_SAMOSTATNE') => {
    const next = new Set<VyrobnaType>(config.vyrobnaTypes);
    next.delete('FVE_ZUE_SPOLECNY');
    next.delete('FVE_ZUE_SAMOSTATNE');
    next.add(sub);
    onChange({ ...config, vyrobnaTypes: normalizeVyrobnaTypes(next) });
  };

  const handleKgjSubChange = (sub: 'KGJ_SYNCHRONNI' | 'KGJ_KOMBINACE' | 'KGJ_NESYNCHRONNI') => {
    const next = new Set<VyrobnaType>(config.vyrobnaTypes);
    KGJ_TYPES.forEach((t) => next.delete(t));
    next.add(sub);
    onChange({ ...config, vyrobnaTypes: normalizeVyrobnaTypes(next) });
  };

  const kgjPrimaryType: 'KGJ_SYNCHRONNI' | 'KGJ_KOMBINACE' = kgjCombinedWithOther
    ? 'KGJ_KOMBINACE'
    : 'KGJ_SYNCHRONNI';
  const kgjPrimaryLabel = kgjCombinedWithOther ? 'Kombinace' : 'Synchronní';

  return (
    <aside className="surface-card config-sticky" aria-label="Konfigurátor zdroje">
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
          <span className="field-label">Typ odběratele</span>
          <div className="segmented-2">
            {CUSTOMER_TYPES.map((ct) => (
              <button
                key={ct.id}
                id={`customer-btn-${ct.id}`}
                type="button"
                className={`choice-btn ${config.customerType === ct.id ? 'selected' : ''}`}
                onClick={() => handleCustomerTypeChange(ct.id)}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <span className="field-label">Napěťová hladina</span>
          <div className="segmented-2">
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
          <span className="field-label">Rp</span>
          <div className="choice-grid-3">
            {RP_RANGES.map((r) => (
              <button
                key={r.id}
                id={`rp-btn-${r.id}`}
                type="button"
                className={`choice-btn ${config.rp === r.id ? 'selected' : ''}`}
                onClick={() => handleRpChange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <span className="field-label">SVR</span>
          <div className="segmented-2">
            <button
              id="svr-btn-ANO"
              type="button"
              className={`choice-btn ${config.svr ? 'selected' : ''}`}
              onClick={() => onChange({ ...config, svr: true })}
            >
              Ano
            </button>
            <button
              id="svr-btn-NE"
              type="button"
              className={`choice-btn ${!config.svr ? 'selected' : ''}`}
              onClick={() => onChange({ ...config, svr: false })}
            >
              Ne
            </button>
          </div>
        </div>

        <div className="field-group">
          <span className="field-label">Výrobna</span>
          <div className="vyrobna-subpanel">
            <span className="field-label">Typ výrobny</span>
            <div className="vyrobna-type-list">
              <button
                id="vyrobna-type-FVE"
                type="button"
                aria-pressed={hasFve}
                className={`choice-btn ${hasFve ? 'selected' : ''}`}
                onClick={() => handleVyrobnaMainToggle('FVE')}
              >
                FVE
              </button>
              <button
                id="vyrobna-type-ZUE"
                type="button"
                aria-pressed={hasZue}
                className={`choice-btn ${hasZue ? 'selected' : ''}`}
                onClick={() => handleVyrobnaMainToggle('ZUE')}
              >
                ZUE
              </button>
              <button
                id="vyrobna-type-KGJ"
                type="button"
                aria-pressed={hasKgj}
                className={`choice-btn ${hasKgj ? 'selected' : ''}`}
                onClick={() => handleVyrobnaMainToggle('KGJ')}
              >
                KGJ / bioplyn / diesel
              </button>
            </div>

            {hasFveAndZue && (
              <div className="vyrobna-subtype-wrap">
                <span className="field-label">Zapojení FVE + ZUE</span>
                <div className="segmented-2">
                  <button
                    id="vyrobna-sub-FVE_ZUE_SPOLECNY"
                    type="button"
                    className={`choice-btn ${
                      config.vyrobnaTypes.includes('FVE_ZUE_SPOLECNY') ? 'selected' : ''
                    }`}
                    onClick={() => handleFveZueSubChange('FVE_ZUE_SPOLECNY')}
                  >
                    Společný střídač
                  </button>
                  <button
                    id="vyrobna-sub-FVE_ZUE_SAMOSTATNE"
                    type="button"
                    className={`choice-btn ${
                      config.vyrobnaTypes.includes('FVE_ZUE_SAMOSTATNE') ? 'selected' : ''
                    }`}
                    onClick={() => handleFveZueSubChange('FVE_ZUE_SAMOSTATNE')}
                  >
                    Samostatně
                  </button>
                </div>
              </div>
            )}

            {hasKgj && (
              <div className="vyrobna-subtype-wrap">
                <span className="field-label">Typ generátoru</span>
                <div className="segmented-2">
                  <button
                    id={`vyrobna-sub-${kgjPrimaryType}`}
                    type="button"
                    className={`choice-btn ${
                      config.vyrobnaTypes.includes(kgjPrimaryType) ? 'selected' : ''
                    }`}
                    onClick={() => handleKgjSubChange(kgjPrimaryType)}
                  >
                    {kgjPrimaryLabel}
                  </button>
                  <button
                    id="vyrobna-sub-KGJ_NESYNCHRONNI"
                    type="button"
                    className={`choice-btn ${
                      config.vyrobnaTypes.includes('KGJ_NESYNCHRONNI') ? 'selected' : ''
                    }`}
                    onClick={() => handleKgjSubChange('KGJ_NESYNCHRONNI')}
                  >
                    Nesynchronní
                  </button>
                </div>
              </div>
            )}

            {hasVyrobna && (
              <>
                <div className="vyrobna-subtype-wrap">
                  <span className="field-label">Pi</span>
                  <div className="segmented-grid-2">
                    {PI_RANGES.map((p) => (
                      <button
                        key={p.id}
                        id={`pi-btn-${p.id}`}
                        type="button"
                        className={`choice-btn ${config.pi === p.id ? 'selected' : ''}`}
                        onClick={() => handlePiChange(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="vyrobna-subtype-wrap">
                  <span className="field-label">Rv</span>
                  <div className="segmented-2">
                    {RV_RANGES.map((r) => (
                      <button
                        key={r.id}
                        id={`rv-btn-${r.id}`}
                        type="button"
                        className={`choice-btn ${config.rv === r.id ? 'selected' : ''}`}
                        onClick={() => handleRvChange(r.id)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
