export type PowerCategory = 'MIKROZDROJ' | 'A1' | 'A2' | 'B1' | 'B2' | 'C_D';
export type VoltageLevel = 'NN' | 'VN' | 'VVN';
export type PlantTechnology = 'FVE' | 'FVE_BESS' | 'BESS' | 'KGJ' | 'MVE' | 'VTE';
export type ExportMode =
  | 'STANDARD_PRETOKY'
  | 'MIKROZDROJ_BEZ_PRETOKU'
  | 'NULOVY_REZERVOVANY_VYKON';

export type PhaseId =
  | 'FAZE_1_PRIPRAVA'
  | 'FAZE_2_ZADOST_SOP'
  | 'FAZE_3_PROJEKT_POVOLENI'
  | 'FAZE_4_REALIZACE_MERENI'
  | 'FAZE_5_UVEDENI_DO_PROVOZU'
  | 'FAZE_6_OTE_OBCHODNIK';

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
    rangeLabel: 'do 10,8 kW (max. 16 A/fázi na NN)',
    rfgDoc: 'Instalační dokument VM A1',
  },
  {
    id: 'A1',
    label: 'Kategorie A1',
    rangeLabel: 'do 11 kW vč.',
    rfgDoc: 'Instalační dokument VM A1',
  },
  {
    id: 'A2',
    label: 'Kategorie A2',
    rangeLabel: 'nad 11 kW do 100 kW',
    rfgDoc: 'Instalační dokument VM A2',
  },
  {
    id: 'B1',
    label: 'Kategorie B1',
    rangeLabel: 'od 100 kW vč. do 1 MW',
    rfgDoc: 'Dokument VM B1 + UPOS',
  },
  {
    id: 'B2',
    label: 'Kategorie B2',
    rangeLabel: 'od 1 MW vč. do 30 MW',
    rfgDoc: 'Dokument VM B2 + UPOS',
  },
  {
    id: 'C_D',
    label: 'Kategorie C / D',
    rangeLabel: 'od 30 MW vč. (nebo 110 kV)',
    rfgDoc: 'Dokument VM C/D + UPOS',
  },
];

export const VOLTAGE_LEVELS: {
  id: VoltageLevel;
  label: string;
  sub: string;
}[] = [
  { id: 'NN', label: 'NN', sub: '0,4 kV (nízké)' },
  { id: 'VN', label: 'VN', sub: '22 / 35 kV (vysoké)' },
  { id: 'VVN', label: 'VVN', sub: '110 kV (velmi vysoké)' },
];

export const PLANT_TECHNOLOGIES: {
  id: PlantTechnology;
  label: string;
  sub: string;
}[] = [
  { id: 'FVE', label: 'FVE bez baterie', sub: 'Fotovoltaika se střídačem' },
  { id: 'FVE_BESS', label: 'FVE + akumulace', sub: 'Hybridní FVE s BESS' },
  { id: 'BESS', label: 'Samostatná BESS', sub: 'Bateriové úložiště (BSAE)' },
  { id: 'KGJ', label: 'KGJ / Bioplyn', sub: 'Motorgenerátor / kogenerace' },
  { id: 'MVE', label: 'MVE', sub: 'Malá vodní elektrárna' },
  { id: 'VTE', label: 'VTE', sub: 'Větrná elektrárna' },
];

export const EXPORT_MODES: {
  id: ExportMode;
  label: string;
  sub: string;
}[] = [
  {
    id: 'STANDARD_PRETOKY',
    label: 'Standardní připojení s přetoky do DS (Pr > 0 kW)',
    sub: 'Možnost dodávky přetoků do sítě, výrobní EAN a výkup obchodníkem',
  },
  {
    id: 'MIKROZDROJ_BEZ_PRETOKU',
    label: 'Zjednodušené připojení mikrozdroje bez přetoků (§ 16)',
    sub: 'Pouze do 10,8 kW na NN ve stávajícím OM, Pr = 0 kW, měření impedance smyčky',
  },
  {
    id: 'NULOVY_REZERVOVANY_VYKON',
    label: 'Standardní připojení s nulovým rezervovaným výkonem (Pr = 0 kW)',
    sub: 'Pro zdroje s technickým omezením přetoků mimo zjednodušený režim § 16',
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
    title: 'Příprava záměru a podklady před žádostí',
    subtitle: 'Ověření kapacity sítě, vlastnických vztahů, schémat a parametrů odběrného místa',
  },
  {
    id: 'FAZE_2_ZADOST_SOP',
    step: 2,
    title: 'Žádost o připojení a Smlouva o připojení (SoP / SoBS)',
    subtitle: 'Podání v Distribučním portálu, posouzení sítě, podpis smlouvy a úhrada podílu',
  },
  {
    id: 'FAZE_3_PROJEKT_POVOLENI',
    step: 3,
    title: 'Projektová dokumentace, legislativa a povolení',
    subtitle: 'Schválení PD ze strany ČEZ Distribuce, tabulka telemetrie, stavební řízení a licence ERÚ',
  },
  {
    id: 'FAZE_4_REALIZACE_MERENI',
    step: 4,
    title: 'Technická realizace, měření, HDO / ŘJ a revize',
    subtitle: 'Úprava elektroměrového rozváděče, ochrany, HDO nebo řídicí jednotka se SIM a výchozí revize',
  },
  {
    id: 'FAZE_5_UVEDENI_DO_PROVOZU',
    step: 5,
    title: 'Ověření souladu (RfG) a Umožnění trvalého provozu (UPOS / UTP)',
    subtitle: 'Instalační dokument / Dokument VM, zkoušky, montáž 4Q elektroměru a Konečné provozní oznámení',
  },
  {
    id: 'FAZE_6_OTE_OBCHODNIK',
    step: 6,
    title: 'Registrace OTE, smlouva s obchodníkem a trvalý provoz',
    subtitle: 'Výrobní EAN, přenesení odpovědnosti za odchylku a povolení dodávky do distribuční sítě',
  },
];

export const SPECIAL_FLAGS: {
  id: SpecialFlag;
  label: string;
  hint: string;
}[] = [
  {
    id: 'CIZI_NEMOVITOST',
    label: 'Výrobna na cizím pozemku / budově (nájem, věcné břemeno)',
    hint: 'Vyžaduje Souhlas vlastníka nemovitosti dle vzoru ČEZ Distribuce',
  },
  {
    id: 'PLNA_MOC',
    label: 'Podání vyřizuje zástupce / realizační firma na plnou moc',
    hint: 'Vyžaduje Plnou moc pro zastupování u ČEZ Distribuce',
  },
  {
    id: 'OSTROVNI_PROVOZ',
    label: 'Umožňuje ostrovní provoz (backup při výpadku DS)',
    hint: 'Vyžaduje vazební spínač s ochranou a TN-S s proudovými chrániči',
  },
  {
    id: 'NAD_50_KW_LICENCE',
    label: 'Instalovaný výkon nad 50 kW (licence ERÚ + stavební záměr)',
    hint: 'Automaticky aktivováno při výkonu Pi > 50 kW',
  },
  {
    id: 'NEPRIME_MERENI',
    label: 'Nepřímé fakturační měření přes MTP / MTN (nad 80 A nebo VN/VVN)',
    hint: 'Vyžaduje úředně ověřené měřicí transformátory proudu/napětí',
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
