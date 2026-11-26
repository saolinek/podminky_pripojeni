export type CustomerType = 'LDS' | 'ODBERATEL';
export type VoltageLevel = 'NN' | 'VN';
export type PiRange = 'DO_100' | 'NAD_100' | 'NAD_400' | 'NAD_1000';
export type RvRange = 'DO_1MW' | 'NAD_1MW';
export type RpRange = 'DO_100' | 'NAD_100' | 'NAD_1000';
export type YesNo = 'ANO' | 'NE';
export type VyrobnaType =
  | 'FVE'
  | 'ZUE'
  | 'FVE_ZUE_SPOLECNY'
  | 'FVE_ZUE_SAMOSTATNE'
  | 'KGJ_SYNCHRONNI'
  | 'KGJ_NESYNCHRONNI'
  | 'KGJ_KOMBINACE';

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

export interface PlantConfig {
  customerType: CustomerType;
  voltage: VoltageLevel;
  rp: RpRange;
  svr: boolean;
  vyrobnaTypes: VyrobnaType[];
  pi: PiRange | null;
  rv: RvRange | null;
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
  customerTypes: CustomerType[];
  voltages: VoltageLevel[];
  piRanges: PiRange[];
  rvRanges: RvRange[];
  rpRanges: RpRange[];
  svrFilter: YesNo[];
  vyrobnaTypes: VyrobnaType[];
  createdBy: string;
  updatedAtIso: string;
}

export interface SavedProject {
  id: string;
  name: string;
  contractNumber: string;
  eanCode: string;
  customerType: CustomerType;
  voltage: VoltageLevel;
  pi: PiRange | null;
  rv: RvRange | null;
  rp: RpRange;
  svr: boolean;
  vyrobnaTypes: VyrobnaType[];
  checkedIds: string[];
  itemNotes: Record<string, string>;
  createdBy: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export type FeedbackCategory = 'NAPAD' | 'CHYBA' | 'PODMINKA' | 'JINE';

export interface FeedbackEntry {
  id: string;
  category: FeedbackCategory;
  rating: number;
  message: string;
  authorName: string;
  createdBy: string;
  createdAtIso: string;
}

export const FEEDBACK_CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'NAPAD', label: 'Nápad na vylepšení', shortLabel: 'Nápad' },
  { id: 'CHYBA', label: 'Chyba / problém', shortLabel: 'Chyba' },
  { id: 'PODMINKA', label: 'Chybějící podmínka', shortLabel: 'Podmínka' },
  { id: 'JINE', label: 'Obecná zpráva', shortLabel: 'Ostatní' },
];

export const CUSTOMER_TYPES: {
  id: CustomerType;
  label: string;
}[] = [
  { id: 'LDS', label: 'LDS' },
  { id: 'ODBERATEL', label: 'Odběratel' },
];

export const VOLTAGE_LEVELS: {
  id: VoltageLevel;
  label: string;
  sub: string;
}[] = [
  { id: 'NN', label: 'NN', sub: '0,4 kV' },
  { id: 'VN', label: 'VN', sub: '22 / 35 kV' },
];

export const PI_RANGES: {
  id: PiRange;
  label: string;
}[] = [
  { id: 'DO_100', label: 'do 100 kW' },
  { id: 'NAD_100', label: 'nad 100 kW' },
  { id: 'NAD_400', label: 'nad 400 kW' },
  { id: 'NAD_1000', label: 'nad 1000 kW' },
];

export const RV_RANGES: {
  id: RvRange;
  label: string;
}[] = [
  { id: 'DO_1MW', label: 'do 1 MW' },
  { id: 'NAD_1MW', label: 'nad 1 MW' },
];

export const RP_RANGES: {
  id: RpRange;
  label: string;
}[] = [
  { id: 'DO_100', label: 'do 100 kW' },
  { id: 'NAD_100', label: 'nad 100 kW' },
  { id: 'NAD_1000', label: 'nad 1000 kW' },
];

export const YES_NO_OPTIONS: {
  id: YesNo;
  label: string;
}[] = [
  { id: 'ANO', label: 'Ano' },
  { id: 'NE', label: 'Ne' },
];

export const VYROBNA_TYPES: {
  id: VyrobnaType;
  label: string;
  group: 'FVE' | 'ZUE' | 'FVE_ZUE' | 'KGJ';
}[] = [
  { id: 'FVE', label: 'FVE', group: 'FVE' },
  { id: 'ZUE', label: 'ZUE', group: 'ZUE' },
  { id: 'FVE_ZUE_SPOLECNY', label: 'FVE + ZUE · společný střídač', group: 'FVE_ZUE' },
  { id: 'FVE_ZUE_SAMOSTATNE', label: 'FVE + ZUE · samostatně', group: 'FVE_ZUE' },
  { id: 'KGJ_SYNCHRONNI', label: 'KGJ / bioplyn / diesel · synchronní', group: 'KGJ' },
  { id: 'KGJ_KOMBINACE', label: 'KGJ / bioplyn / diesel · kombinace', group: 'KGJ' },
  { id: 'KGJ_NESYNCHRONNI', label: 'KGJ / bioplyn / diesel · nesynchronní', group: 'KGJ' },
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

export function matchesPlantConfig(
  item: ChecklistItemTemplate,
  config: PlantConfig
): boolean {
  if (item.customerTypes.length > 0 && !item.customerTypes.includes(config.customerType)) {
    return false;
  }
  if (item.voltages.length > 0 && !item.voltages.includes(config.voltage)) {
    return false;
  }
  if (item.rpRanges.length > 0 && !item.rpRanges.includes(config.rp)) {
    return false;
  }
  if (item.svrFilter.length > 0 && !item.svrFilter.includes(config.svr ? 'ANO' : 'NE')) {
    return false;
  }
  if (item.vyrobnaTypes.length === 0) {
    if (config.vyrobnaTypes.length > 0) {
      return false;
    }
  } else if (!item.vyrobnaTypes.some((t) => config.vyrobnaTypes.includes(t))) {
    return false;
  }
  if (item.piRanges.length > 0) {
    if (!config.pi || !item.piRanges.includes(config.pi)) {
      return false;
    }
  }
  if (item.rvRanges.length > 0) {
    if (!config.rv || !item.rvRanges.includes(config.rv)) {
      return false;
    }
  }
  return true;
}
