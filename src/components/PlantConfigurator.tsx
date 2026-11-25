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
  VOLTAGE_LEVELS,
  type VoltageLevel,
  type VyrobnaType,
} from '../types';

interface PlantConfiguratorProps {
  config: PlantConfig;
  onChange: (next: PlantConfig) => void;
  onResetConfig: () => void;
}

type VyrobnaMainChoice = 'FVE' | 'ZUE' | 'FVE_ZUE' | 'KGJ';

function getVyrobnaMainChoice(type: VyrobnaType | null): VyrobnaMainChoice | null {
  if (!type) return null;
  if (type === 'FVE') return 'FVE';
  if (type === 'ZUE') return 'ZUE';
  if (type === 'FVE_ZUE_SPOLECNY' || type === 'FVE_ZUE_SAMOSTATNE') return 'FVE_ZUE';
  if (type === 'KGJ_SYNCHRONNI' || type === 'KGJ_NESYNCHRONNI') return 'KGJ';
  return null;
}

export const PlantConfigurator: React.FC<PlantConfiguratorProps> = ({
  config,
  onChange,
  onResetConfig,
}) => {
  const vyrobnaMain = getVyrobnaMainChoice(config.vyrobnaType);

  const handleCustomerTypeChange = (customerType: CustomerType) => {
    onChange({ ...config, customerType });
  };

  const handleVoltageChange = (voltage: VoltageLevel) => {
    onChange({ ...config, voltage });
  };

  const handlePiChange = (pi: PiRange) => {
    onChange({ ...config, pi });
  };

  const handleRpToggle = (rp: RpRange) => {
    onChange({ ...config, rp: config.rp === rp ? null : rp });
  };

  const handleVyrobnaToggle = (vyrobna: boolean) => {
    onChange({
      ...config,
      vyrobna,
      vyrobnaType: vyrobna ? config.vyrobnaType : null,
    });
  };

  const handleVyrobnaMainClick = (main: VyrobnaMainChoice) => {
    if (main === 'FVE') {
      onChange({ ...config, vyrobnaType: 'FVE' });
    } else if (main === 'ZUE') {
      onChange({ ...config, vyrobnaType: 'ZUE' });
    } else if (main === 'FVE_ZUE') {
      const next: VyrobnaType =
        config.vyrobnaType === 'FVE_ZUE_SAMOSTATNE' ? 'FVE_ZUE_SAMOSTATNE' : 'FVE_ZUE_SPOLECNY';
      onChange({ ...config, vyrobnaType: next });
    } else if (main === 'KGJ') {
      const next: VyrobnaType =
        config.vyrobnaType === 'KGJ_NESYNCHRONNI' ? 'KGJ_NESYNCHRONNI' : 'KGJ_SYNCHRONNI';
      onChange({ ...config, vyrobnaType: next });
    }
  };

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
          <span className="field-label">Pi</span>
          <div className="choice-grid-2">
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

        <div className="field-group">
          <div className="field-label-row">
            <span className="field-label">Rp</span>
            <span className="field-hint">nepovinné</span>
          </div>
          <div className="choice-grid-2">
            {RP_RANGES.map((r) => (
              <button
                key={r.id}
                id={`rp-btn-${r.id}`}
                type="button"
                className={`choice-btn ${config.rp === r.id ? 'selected' : ''}`}
                onClick={() => handleRpToggle(r.id)}
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
          <span className="field-label">ZUE</span>
          <div className="segmented-2">
            <button
              id="zue-btn-ANO"
              type="button"
              className={`choice-btn ${config.zue ? 'selected' : ''}`}
              onClick={() => onChange({ ...config, zue: true })}
            >
              Ano
            </button>
            <button
              id="zue-btn-NE"
              type="button"
              className={`choice-btn ${!config.zue ? 'selected' : ''}`}
              onClick={() => onChange({ ...config, zue: false })}
            >
              Ne
            </button>
          </div>
        </div>

        <div className="field-group">
          <span className="field-label">Výrobna</span>
          <div className="segmented-2">
            <button
              id="vyrobna-btn-ANO"
              type="button"
              className={`choice-btn ${config.vyrobna ? 'selected' : ''}`}
              onClick={() => handleVyrobnaToggle(true)}
            >
              Ano
            </button>
            <button
              id="vyrobna-btn-NE"
              type="button"
              className={`choice-btn ${!config.vyrobna ? 'selected' : ''}`}
              onClick={() => handleVyrobnaToggle(false)}
            >
              Ne
            </button>
          </div>

          {config.vyrobna && (
            <div className="vyrobna-subpanel">
              <span className="field-label">Typ výrobny</span>
              <div className="vyrobna-type-list">
                <button
                  id="vyrobna-type-FVE"
                  type="button"
                  className={`choice-btn ${vyrobnaMain === 'FVE' ? 'selected' : ''}`}
                  onClick={() => handleVyrobnaMainClick('FVE')}
                >
                  FVE
                </button>
                <button
                  id="vyrobna-type-ZUE"
                  type="button"
                  className={`choice-btn ${vyrobnaMain === 'ZUE' ? 'selected' : ''}`}
                  onClick={() => handleVyrobnaMainClick('ZUE')}
                >
                  ZUE
                </button>
                <button
                  id="vyrobna-type-FVE_ZUE"
                  type="button"
                  className={`choice-btn ${vyrobnaMain === 'FVE_ZUE' ? 'selected' : ''}`}
                  onClick={() => handleVyrobnaMainClick('FVE_ZUE')}
                >
                  FVE + ZUE
                </button>
                <button
                  id="vyrobna-type-KGJ"
                  type="button"
                  className={`choice-btn ${vyrobnaMain === 'KGJ' ? 'selected' : ''}`}
                  onClick={() => handleVyrobnaMainClick('KGJ')}
                >
                  KGJ / bioplyn / diesel
                </button>
              </div>

              {vyrobnaMain === 'FVE_ZUE' && (
                <div className="vyrobna-subtype-wrap">
                  <span className="field-label">Zapojení FVE + ZUE</span>
                  <div className="segmented-2">
                    <button
                      id="vyrobna-sub-FVE_ZUE_SPOLECNY"
                      type="button"
                      className={`choice-btn ${
                        config.vyrobnaType === 'FVE_ZUE_SPOLECNY' ? 'selected' : ''
                      }`}
                      onClick={() => onChange({ ...config, vyrobnaType: 'FVE_ZUE_SPOLECNY' })}
                    >
                      Společný střídač
                    </button>
                    <button
                      id="vyrobna-sub-FVE_ZUE_SAMOSTATNE"
                      type="button"
                      className={`choice-btn ${
                        config.vyrobnaType === 'FVE_ZUE_SAMOSTATNE' ? 'selected' : ''
                      }`}
                      onClick={() => onChange({ ...config, vyrobnaType: 'FVE_ZUE_SAMOSTATNE' })}
                    >
                      Samostatně
                    </button>
                  </div>
                </div>
              )}

              {vyrobnaMain === 'KGJ' && (
                <div className="vyrobna-subtype-wrap">
                  <span className="field-label">Typ generátoru</span>
                  <div className="segmented-2">
                    <button
                      id="vyrobna-sub-KGJ_SYNCHRONNI"
                      type="button"
                      className={`choice-btn ${
                        config.vyrobnaType === 'KGJ_SYNCHRONNI' ? 'selected' : ''
                      }`}
                      onClick={() => onChange({ ...config, vyrobnaType: 'KGJ_SYNCHRONNI' })}
                    >
                      Synchronní
                    </button>
                    <button
                      id="vyrobna-sub-KGJ_NESYNCHRONNI"
                      type="button"
                      className={`choice-btn ${
                        config.vyrobnaType === 'KGJ_NESYNCHRONNI' ? 'selected' : ''
                      }`}
                      onClick={() => onChange({ ...config, vyrobnaType: 'KGJ_NESYNCHRONNI' })}
                    >
                      Nesynchronní
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
