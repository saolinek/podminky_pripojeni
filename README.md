# Průvodce připojením nového zdroje – ČEZ Distribuce

Interaktivní webová aplikace v barvách **ČEZ Distribuce** pro generování odškrtávacího seznamu (checklistu) při připojování nové výrobny elektřiny nebo bateriového úložiště (BESS) k distribuční soustavě dle **PPDS Přílohy č. 4 a č. 6**, **Připojovacích podmínek NN/VN/VVN**, **vyhlášky č. 16/2016 Sb.** a **Nařízení Komise (EU) 2016/631 (RfG)**.

## Hlavní funkce

- **Podrobný konfigurátor zdroje:**
  - Volba technologie: **FVE**, **FVE + akumulace (BESS)**, **Samostatná BESS**, **KGJ / Bioplyn**, **MVE**, **VTE**
  - Zadání instalovaného výkonu $P_i$ (kW) s automatickým určením kategorie výrobního modulu (**Mikrozdroj ≤ 10,8 kW**, **A1**, **A2**, **B1**, **B2**, **C/D**)
  - Napěťová hladina (**NN**, **VN**, **VVN**) a režim přetoků (**Standardní s přetoky**, **Zjednodušený mikrozdroj § 16 bez přetoků**, **Nulový rezervovaný výkon**)
  - Doplňující příznaky místa připojení (*cizí pozemek*, *plná moc*, *ostrovní provoz*, *licence ERÚ a stavební řízení nad 50 kW*, *nepřímé měření přes MTP/MTN*)
- **Odškrtávací seznam v 6 fázích připojení ČEZ Distribuce:**
  - Sledování postupu v %, vyhledávání, filtrování (*Vše / Zbývá / Splněno*), vlastní poznámky k jednotlivým bodům a čistý tisk do PDF protokolu.
- **Sdílená cloudová databáze Firebase Firestore:**
  - **Uložené projekty (`projects`):** ukládání rozpracovaných zakázek a sdílení odškrtaného postupu v reálném čase.
  - **Editor podmínek (`checklist_items`):** úprava stávajících bodů ČEZ Distribuce, přidávání vlastních firemních kroků, mazání i jednorázové obnovení výchozích podmínek.

## Lokální spuštění

```bash
npm install
npm run dev
```

## Propojení s Firebase Firestore

1. V [Firebase Console](https://console.firebase.google.com/) založte projekt, aktivujte **Firestore Database** a v sekci **Authentication → Sign-in method** zapněte **Anonymous** (případně i **Google**).
2. Nasaďte bezpečnostní pravidla a konfiguraci z tohoto repozitáře:
   ```bash
   npx -y firebase-tools@latest use <VASE_PROJECT_ID>
   npx -y firebase-tools@latest deploy --only auth,firestore:rules,firestore:indexes
   ```
3. V hlavičce webu klikněte na **Připojit Firebase DB** a vložte objekt `firebaseConfig` (nebo jej uložte do `.env` dle `.env.example`). Při prvním připojení aplikace automaticky naplní Firestore databázi kompletní sadou podmínek ČEZ Distribuce a vygeneruje sdílený odkaz pro kolegy.
