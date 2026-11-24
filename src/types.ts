export type PowerCategory = 'MIKROZDROJ' | 'A1' | 'A2' | 'B1' | 'B2' | 'C_D';
export type VoltageLevel = 'NN' | 'VN' | 'VVN';
export type PlantTechnology = 'FVE' | 'FVE_BESS' | 'BESS' | 'KGJ' | 'MVE' | 'VTE';
export type ExportMode =
  | 'STANDARD_PRETOKY'
  | 'MIKROZDROJ_BEZ_PRETOKU'
  | 'NULOVY_REZERVOVANY_VYKON';

export type BuiltInPhaseId =
  | 'FAZE_1_PRIPRAVA'
  | 'FAZE_2_ZADOST_SOP'
  | 'FAZE_3_PROJEKT_POVOLENI'
  | 'FAZE_4_REALIZACE_MERENI'
  | 'FAZE_5_UVEDENI_DO_PROVOZU'
  | 'FAZE_6_OTE_OBCHODNIK';

export const BUILTIN_PHASE_IDS: readonly BuiltInPhaseId[] = [
  'FAZE_1_PRIPRAVA',
  'FAZE_2_ZADOST_SOP',
  'FAZE_3_PROJEKT_POVOLENI',
  'FAZE_4_REALIZACE_MERENI',
  'FAZE_5_UVEDENI_DO_PROVOZU',
  'FAZE_6_OTE_OBCHODNIK',
];

export type PhaseId = string;

export interface PhaseGroup {
  id: PhaseId;
  title: string;
}

export type SpecialFlag =
  | 'CIZI_NEMOVITOST'
  | 'PLNA_MOC'
  | 'OSTROVNI_PROVOZ'
  | 'NAD_50_KW_LICENCE'
  | 'NEPRIME_MERENI';

export interface PlantConfig {
  installedPowerKw: number;
  category: PowerCategory;
  voltage: VoltageLevel;
  technology: PlantTechnology;
  exportMode: ExportMode;
  flags: SpecialFlag[];
}

export interface ChecklistItemTemplate {
  id: string;
  title: string;
  description: string;
  phase: PhaseId;
  order: number;
  reference: string;
  deadlineBadge: string;
  mandatory: boolean;
  categories: PowerCategory[];
  voltages: VoltageLevel[];
  technologies: PlantTechnology[];
  exportModes: ExportMode[];
  requiredFlags: SpecialFlag[];
  createdBy: string;
  updatedAtIso: string;
}

export interface SavedProject {
  id: string;
  name: string;
  contractNumber: string;
  eanCode: string;
  installedPowerKw: number;
  category: PowerCategory;
  voltage: VoltageLevel;
  technology: PlantTechnology;
  exportMode: ExportMode;
  flags: SpecialFlag[];
  checkedIds: string[];
  itemNotes: Record<string, string>;
  createdBy: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export const POWER_CATEGORIES: {
  id: PowerCategory;
  label: string;
  rangeLabel: string;
  rfgDoc: string;
}[] = [
  {
    id: 'MIKROZDROJ',
    label: 'Mikrozdroj',
    rangeLabel: '≤ 10,8 kW (NN)',
    rfgDoc: 'VM A1',
  },
  {
    id: 'A1',
    label: 'A1',
    rangeLabel: '≤ 11 kW',
    rfgDoc: 'VM A1',
  },
  {
    id: 'A2',
    label: 'A2',
    rangeLabel: '11–100 kW',
    rfgDoc: 'VM A2',
  },
  {
    id: 'B1',
    label: 'B1',
    rangeLabel: '100 kW – 1 MW',
    rfgDoc: 'VM B1 + UPOS',
  },
  {
    id: 'B2',
    label: 'B2',
    rangeLabel: '1–30 MW',
    rfgDoc: 'VM B2 + UPOS',
  },
  {
    id: 'C_D',
    label: 'C / D',
    rangeLabel: '≥ 30 MW / 110 kV',
    rfgDoc: 'VM C/D + UPOS',
  },
];

export const VOLTAGE_LEVELS: {
  id: VoltageLevel;
  label: string;
  sub: string;
}[] = [
  { id: 'NN', label: 'NN', sub: '0,4 kV' },
  { id: 'VN', label: 'VN', sub: '22 / 35 kV' },
  { id: 'VVN', label: 'VVN', sub: '110 kV' },
];

export const PLANT_TECHNOLOGIES: {
  id: PlantTechnology;
  label: string;
  sub: string;
}[] = [
  { id: 'FVE', label: 'FVE', sub: 'Fotovoltaika' },
  { id: 'FVE_BESS', label: 'FVE + BESS', sub: 'Hybridní s baterií' },
  { id: 'BESS', label: 'BESS', sub: 'Bateriové úložiště' },
  { id: 'KGJ', label: 'KGJ / Bioplyn', sub: 'Kogenerace' },
  { id: 'MVE', label: 'MVE', sub: 'Malá vodní' },
  { id: 'VTE', label: 'VTE', sub: 'Větrná' },
];

export const EXPORT_MODES: {
  id: ExportMode;
  label: string;
  sub: string;
}[] = [
  {
    id: 'STANDARD_PRETOKY',
    label: 'S přetoky (Pr > 0 kW)',
    sub: 'Standardní připojení s dodávkou do DS',
  },
  {
    id: 'MIKROZDROJ_BEZ_PRETOKU',
    label: 'Mikrozdroj bez přetoků (§ 16)',
    sub: 'Do 10,8 kW na NN, Pr = 0 kW',
  },
  {
    id: 'NULOVY_REZERVOVANY_VYKON',
    label: 'Bez přetoků (Pr = 0 kW)',
    sub: 'Standardní připojení s nulovým Pr',
  },
];

export const PHASES: {
  id: PhaseId;
  step: number;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'FAZE_1_PRIPRAVA',
    step: 1,
    title: 'Příprava a podklady',
    subtitle: 'Kapacita sítě, vlastnictví, schémata',
  },
  {
    id: 'FAZE_2_ZADOST_SOP',
    step: 2,
    title: 'Žádost a Smlouva o připojení',
    subtitle: 'Distribuční portál, SoP / SoBS',
  },
  {
    id: 'FAZE_3_PROJEKT_POVOLENI',
    step: 3,
    title: 'Projekt a povolení',
    subtitle: 'PD, telemetrie, stavební řízení, licence ERÚ',
  },
  {
    id: 'FAZE_4_REALIZACE_MERENI',
    step: 4,
    title: 'Realizace, měření a revize',
    subtitle: 'Rozváděč, ochrany, HDO / ŘJ, výchozí revize',
  },
  {
    id: 'FAZE_5_UVEDENI_DO_PROVOZU',
    step: 5,
    title: 'RfG a uvedení do provozu',
    subtitle: 'Dokument VM, zkoušky, 4Q elektroměr, UPOS / UTP',
  },
  {
    id: 'FAZE_6_OTE_OBCHODNIK',
    step: 6,
    title: 'OTE a obchodník',
    subtitle: 'Výrobní EAN, odchylka, trvalý provoz',
  },
];

export const SPECIAL_FLAGS: {
  id: SpecialFlag;
  label: string;
  hint: string;
}[] = [
  {
    id: 'CIZI_NEMOVITOST',
    label: 'Cizí pozemek / budova',
    hint: 'Souhlas vlastníka nemovitosti',
  },
  {
    id: 'PLNA_MOC',
    label: 'Zastoupení na plnou moc',
    hint: 'Plná moc pro ČEZ Distribuce',
  },
  {
    id: 'OSTROVNI_PROVOZ',
    label: 'Ostrovní provoz (backup)',
    hint: 'Vazební spínač a ochrany TN-S',
  },
  {
    id: 'NAD_50_KW_LICENCE',
    label: 'Nad 50 kW (licence ERÚ)',
    hint: 'Automaticky při Pi > 50 kW',
  },
  {
    id: 'NEPRIME_MERENI',
    label: 'Nepřímé měření (MTP / MTN)',
    hint: 'Nad 80 A nebo VN/VVN',
  },
];

export function inferCategoryAndDefaults(
  powerKw: number,
  prev: PlantConfig
): PlantConfig {
  const safePower = Number.isFinite(powerKw) && powerKw >= 0 ? powerKw : 0;
  let category: PowerCategory = 'MIKROZDROJ';
  let voltage: VoltageLevel = prev.voltage;
  let exportMode: ExportMode = prev.exportMode;
  const flags = new Set<SpecialFlag>(prev.flags);

  if (safePower <= 10.8) {
    category = prev.exportMode === 'MIKROZDROJ_BEZ_PRETOKU' ? 'MIKROZDROJ' : 'MIKROZDROJ';
    voltage = 'NN';
  } else if (safePower <= 11) {
    category = 'A1';
    voltage = 'NN';
  } else if (safePower < 100) {
    category = 'A2';
    if (voltage === 'VVN') voltage = 'NN';
  } else if (safePower < 1000) {
    category = 'B1';
    if (safePower >= 150 && voltage === 'NN') {
      voltage = 'VN';
    }
  } else if (safePower < 30000) {
    category = 'B2';
    if (voltage === 'NN') voltage = 'VN';
  } else {
    category = 'C_D';
    voltage = 'VVN';
  }

  // Simplified § 16 microsource is strictly ≤ 10.8 kW on NN
  if ((safePower > 10.8 || voltage !== 'NN') && exportMode === 'MIKROZDROJ_BEZ_PRETOKU') {
    exportMode = 'STANDARD_PRETOKY';
  }

  if (safePower > 50) {
    flags.add('NAD_50_KW_LICENCE');
  } else {
    flags.delete('NAD_50_KW_LICENCE');
  }

  if (voltage !== 'NN' || safePower >= 55) {
    flags.add('NEPRIME_MERENI');
  } else if (safePower < 50 && voltage === 'NN') {
    flags.delete('NEPRIME_MERENI');
  }

  return {
    ...prev,
    installedPowerKw: safePower,
    category,
    voltage,
    exportMode,
    flags: Array.from(flags),
  };
}

export function matchesPlantConfig(
  item: ChecklistItemTemplate,
  config: PlantConfig
): boolean {
  if (item.categories.length > 0 && !item.categories.includes(config.category)) {
    return false;
  }
  if (item.voltages.length > 0 && !item.voltages.includes(config.voltage)) {
    return false;
  }
  if (item.technologies.length > 0 && !item.technologies.includes(config.technology)) {
    return false;
  }
  if (item.exportModes.length > 0 && !item.exportModes.includes(config.exportMode)) {
    return false;
  }
  if (item.requiredFlags.length > 0) {
    const hasMatchingFlag = item.requiredFlags.some((f) => config.flags.includes(f));
    if (!hasMatchingFlag) return false;
  }
  return true;
}
