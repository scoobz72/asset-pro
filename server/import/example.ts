/**
 * Example data for a fictional food-manufacturing site, used to build the downloadable
 * example workbook (plan section 4). Every company, person and phone number is invented;
 * emails use the reserved .invalid domain and phone numbers the Ofcom drama range.
 */
import type { ExampleRows, ExampleCell } from "./template";

type Row = Record<string, ExampleCell>;
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

const SITE = "FFF-CHT";

const sites: Row[] = [
  { id: SITE, name: "Fenland Fine Foods – Chatteris", address: "Unit 4, Fenmere Business Park, Chatteris", postcode: "PE16 0ZZ" },
];

const locations: Row[] = [
  { id: "HALL-A", name: "Production Hall A (high care)", siteId: SITE, type: "Production area" },
  { id: "HALL-B", name: "Production Hall B (low risk)", siteId: SITE, type: "Production area" },
  { id: "PACK", name: "Packing Hall", siteId: SITE, type: "Production area" },
  { id: "L1", name: "Line 1 – Sliced meats", siteId: SITE, type: "Line" },
  { id: "L2", name: "Line 2 – Sliced meats", siteId: SITE, type: "Line" },
  { id: "L3", name: "Line 3 – Cooked poultry", siteId: SITE, type: "Line" },
  { id: "L4", name: "Line 4 – Ready meals", siteId: SITE, type: "Line" },
  { id: "CHILL", name: "Chillers", siteId: SITE, type: "Room" },
  { id: "PLANT", name: "Plant Room", siteId: SITE, type: "Room" },
  { id: "WORKSHOP", name: "Engineering Workshop", siteId: SITE, type: "Building" },
];

const storeRooms: Row[] = [
  { id: "STORE-ENG", name: "Engineering Stores", siteId: SITE },
  { id: "STORE-HYG", name: "Hygiene & Consumables Store", siteId: SITE },
];

const bins: Row[] = [
  ...["A", "B", "C"].flatMap((rack) =>
    Array.from({ length: rack === "C" ? 4 : 6 }, (_, i) => ({
      id: `ENG-${rack}${String(i + 1).padStart(2, "0")}`,
      storeRoomId: "STORE-ENG",
      description: `Rack ${rack}, shelf ${i + 1}`,
    }))),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `HYG-${String(i + 1).padStart(2, "0")}`,
    storeRoomId: "STORE-HYG",
    description: `Bay ${i + 1}`,
  })),
];

const sup = (id: string, name: string, categories: string, contactName: string, slug: string, phoneEnd: string, leadTimeDays: number, rating: number): Row =>
  ({ id, name, categories, contactName, email: `orders@${slug}.example.invalid`, phone: `01632 960${phoneEnd}`, leadTimeDays, rating });

const suppliers: Row[] = [
  sup("SUP-BRG", "Fenmarsh Bearings & Drives", "Bearings; Gearboxes; Couplings", "Gary Holt", "fenmarsh", "101", 2, 4.5),
  sup("SUP-BLT", "Holloway Belting Services", "Belts; Conveyor", "Mandy Price", "holloway", "102", 5, 4.2),
  sup("SUP-PNE", "Westry Pneumatics", "Pneumatics; Valves; Fittings", "Raj Patel", "westry", "103", 2, 4.0),
  sup("SUP-ELE", "Ouseway Electrical Wholesale", "Electrical; Motors; Sensors", "Kerry Doyle", "ouseway", "104", 1, 4.6),
  sup("SUP-HYG", "Clearbrook Hygiene Supplies", "Hygiene; Lubricants; PPE", "Lee Marshall", "clearbrook", "105", 3, 3.9),
  sup("SUP-SEN", "Sentry Inspection Systems", "Metal detection; Checkweighers", "Helen Ford", "sentry", "106", 10, 4.4),
  sup("SUP-BLD", "Keenedge Blades", "Blades; Slicer spares", "Owen Clarke", "keenedge", "107", 7, 4.1),
  sup("SUP-PKG", "Packform Spares", "Thermoformer spares; Heaters; Seals", "Nina Brooks", "packform", "108", 14, 3.8),
  sup("SUP-AIR", "Lindale Compressed Air", "Compressors; Filters; Dryers", "Steve Rowe", "lindale", "109", 3, 4.3),
  sup("SUP-GEN", "Fen Engineering Supplies", "General; Fixings; Tools", "Amy Lund", "fenengineering", "110", 1, 4.0),
];

// [id, name, category, unit, cost, stock, min, reorder, bin, lead, primary, secondary, mpn]
type P = [string, string, string, string, number, number, number, number, string, number, string, string | null, string];
const partRows: P[] = [
  ["BRG-6204", "Bearing 6204-2RS", "Bearings", "pcs", 4.2, 24, 10, 20, "ENG-A01", 2, "SUP-BRG", "SUP-GEN", "6204-2RS"],
  ["BRG-6205", "Bearing 6205-2RS", "Bearings", "pcs", 4.85, 18, 10, 20, "ENG-A01", 2, "SUP-BRG", "SUP-GEN", "6205-2RS"],
  ["BRG-6206", "Bearing 6206-2RS", "Bearings", "pcs", 6.1, 12, 8, 16, "ENG-A01", 2, "SUP-BRG", null, "6206-2RS"],
  ["BRG-UCP205", "Pillow block UCP205 (stainless)", "Bearings", "pcs", 38.5, 6, 4, 6, "ENG-A02", 3, "SUP-BRG", null, "SUCP205"],
  ["BRG-UCF204", "Flange unit UCF204 (stainless)", "Bearings", "pcs", 34.0, 5, 4, 6, "ENG-A02", 3, "SUP-BRG", null, "SUCF204"],
  ["BRG-6305", "Bearing 6305-2RS", "Bearings", "pcs", 7.4, 3, 6, 12, "ENG-A01", 2, "SUP-BRG", "SUP-GEN", "6305-2RS"],
  ["BLT-L1-INF", "Infeed belt, modular, 600 wide", "Belts", "m", 92.0, 6, 4, 6, "ENG-B01", 5, "SUP-BLT", null, "MB-600-FG"],
  ["BLT-L1-OUT", "Outfeed belt, PU, 400 wide", "Belts", "m", 64.0, 8, 4, 8, "ENG-B01", 5, "SUP-BLT", null, "PU-400-W"],
  ["BLT-CW", "Checkweigher belt, 300 wide", "Belts", "pcs", 145.0, 2, 2, 2, "ENG-B02", 10, "SUP-SEN", "SUP-BLT", "CW-BELT-300"],
  ["BLT-MD", "Metal detector belt, 350 wide", "Belts", "pcs", 160.0, 2, 2, 2, "ENG-B02", 10, "SUP-SEN", "SUP-BLT", "MD-BELT-350"],
  ["BLT-SPROCKET", "Drive sprocket, 12T, 40mm bore", "Belts", "pcs", 22.5, 10, 6, 10, "ENG-B03", 5, "SUP-BLT", null, "SPR-12-40"],
  ["BLT-LACE", "Belt lacing kit", "Belts", "pack", 18.0, 4, 2, 4, "ENG-B03", 3, "SUP-BLT", null, "LACE-K1"],
  ["MTR-0.75", "Geared motor 0.75 kW, washdown", "Motors", "pcs", 385.0, 2, 1, 1, "ENG-C01", 7, "SUP-ELE", null, "GM075-WD"],
  ["MTR-1.5", "Geared motor 1.5 kW, washdown", "Motors", "pcs", 520.0, 1, 1, 1, "ENG-C01", 7, "SUP-ELE", null, "GM150-WD"],
  ["MTR-INV-1.5", "Inverter 1.5 kW", "Electrical", "pcs", 240.0, 2, 1, 1, "ENG-C02", 3, "SUP-ELE", null, "INV-150"],
  ["ELE-PROX-M12", "Proximity sensor M12, PNP", "Sensors", "pcs", 28.0, 14, 6, 10, "ENG-C02", 1, "SUP-ELE", null, "PX-M12-PNP"],
  ["ELE-PHOTO", "Photo-eye, retro-reflective", "Sensors", "pcs", 46.0, 8, 4, 6, "ENG-C02", 1, "SUP-ELE", null, "PE-RR-01"],
  ["ELE-ESTOP", "E-stop button, IP69K", "Electrical", "pcs", 31.0, 6, 3, 6, "ENG-C03", 1, "SUP-ELE", null, "ES-69K"],
  ["ELE-CONT-9A", "Contactor 9 A, 24 V DC coil", "Electrical", "pcs", 19.5, 10, 4, 8, "ENG-C03", 1, "SUP-ELE", null, "CT-09-24"],
  ["ELE-FUSE-10", "Fuse 10 A, 10x38", "Electrical", "box", 6.5, 5, 2, 4, "ENG-C03", 1, "SUP-ELE", "SUP-GEN", "F10-1038"],
  ["ELE-CABLE-4C", "Cable 4-core 1.5mm SY", "Electrical", "m", 2.1, 80, 50, 100, "ENG-C04", 1, "SUP-ELE", null, "SY4-15"],
  ["PNE-CYL-32", "Cylinder 32 bore, 100 stroke", "Pneumatics", "pcs", 58.0, 4, 2, 4, "ENG-A03", 2, "SUP-PNE", null, "CY32-100"],
  ["PNE-CYL-20", "Cylinder 20 bore, 50 stroke (reject)", "Pneumatics", "pcs", 41.0, 4, 3, 4, "ENG-A03", 2, "SUP-PNE", null, "CY20-50"],
  ["PNE-VALVE-5/2", "Solenoid valve 5/2, 24 V DC", "Pneumatics", "pcs", 49.0, 6, 3, 6, "ENG-A03", 2, "SUP-PNE", null, "SV52-24"],
  ["PNE-FRL", "Filter regulator lubricator 1/2\"", "Pneumatics", "pcs", 72.0, 2, 1, 2, "ENG-A04", 3, "SUP-PNE", null, "FRL-12"],
  ["PNE-TUBE-8", "PU tube 8 mm, blue", "Pneumatics", "roll", 21.0, 3, 2, 3, "ENG-A04", 2, "SUP-PNE", "SUP-GEN", "PU8-BL"],
  ["PNE-FIT-8", "Push-in fitting 8 mm, straight", "Pneumatics", "pack", 9.5, 6, 3, 6, "ENG-A04", 2, "SUP-PNE", "SUP-GEN", "PF8-S"],
  ["SLC-BLADE-I", "Involute slicer blade 400 mm", "Blades", "pcs", 310.0, 3, 2, 2, "ENG-A05", 7, "SUP-BLD", null, "INV-400"],
  ["SLC-BLADE-C", "Circular slicer blade 350 mm", "Blades", "pcs", 265.0, 2, 2, 2, "ENG-A05", 7, "SUP-BLD", null, "CIRC-350"],
  ["SLC-GRIPPER", "Slicer gripper claw set", "Slicer spares", "set", 190.0, 2, 1, 1, "ENG-A05", 7, "SUP-BLD", null, "GRP-SET"],
  ["SLC-SHARPEN", "Blade sharpening stone", "Slicer spares", "pcs", 38.0, 4, 2, 2, "ENG-A06", 7, "SUP-BLD", null, "SH-STN"],
  ["TF-HEATER", "Thermoformer forming heater plate", "Thermoformer spares", "pcs", 640.0, 1, 1, 1, "ENG-B04", 14, "SUP-PKG", null, "TF-HP-01"],
  ["TF-SEAL-GASKET", "Sealing tool gasket", "Thermoformer spares", "pcs", 85.0, 4, 2, 4, "ENG-B04", 14, "SUP-PKG", null, "TF-SG-02"],
  ["TF-KNIFE", "Cross-cut knife", "Thermoformer spares", "pcs", 120.0, 3, 2, 2, "ENG-B05", 14, "SUP-PKG", null, "TF-CK-03"],
  ["TF-CHAIN-CLIP", "Gripper chain clip", "Thermoformer spares", "pack", 55.0, 6, 4, 6, "ENG-B05", 14, "SUP-PKG", null, "TF-CC-04"],
  ["TF-SILICONE", "Silicone seal strip", "Thermoformer spares", "m", 14.0, 10, 5, 10, "ENG-B06", 14, "SUP-PKG", null, "TF-SS-05"],
  ["VP-OIL-5L", "Vacuum pump oil, 5 L", "Lubricants", "pcs", 48.0, 6, 4, 6, "HYG-02", 3, "SUP-HYG", "SUP-AIR", "VPO-5"],
  ["VP-EXH-FILTER", "Vacuum pump exhaust filter", "Filters", "pcs", 36.0, 6, 4, 8, "ENG-B06", 5, "SUP-PKG", "SUP-AIR", "VP-EF-01"],
  ["VP-INLET-FILTER", "Vacuum pump inlet filter", "Filters", "pcs", 24.0, 4, 4, 8, "ENG-B06", 5, "SUP-PKG", "SUP-AIR", "VP-IF-01"],
  ["MD-REJECT-ARM", "Metal detector reject arm", "Metal detection", "pcs", 135.0, 2, 1, 1, "ENG-C01", 10, "SUP-SEN", null, "MD-RA-01"],
  ["MD-TEST-FE", "Test piece Fe 2.0 mm", "Metal detection", "pcs", 18.0, 6, 4, 4, "ENG-C04", 10, "SUP-SEN", null, "TP-FE20"],
  ["MD-TEST-SS", "Test piece SS 3.0 mm", "Metal detection", "pcs", 18.0, 6, 4, 4, "ENG-C04", 10, "SUP-SEN", null, "TP-SS30"],
  ["CW-LOADCELL", "Checkweigher load cell", "Checkweighers", "pcs", 420.0, 1, 1, 1, "ENG-C01", 10, "SUP-SEN", null, "CW-LC-01"],
  ["LAB-PRINTHEAD", "Labeller print head 107 mm", "Labelling", "pcs", 380.0, 1, 1, 1, "ENG-C02", 7, "SUP-PKG", null, "PH-107"],
  ["LAB-RIBBON", "Thermal transfer ribbon 110x450", "Labelling", "box", 62.0, 10, 6, 10, "HYG-03", 3, "SUP-PKG", "SUP-GEN", "TTR-110"],
  ["LAB-PLATEN", "Labeller platen roller", "Labelling", "pcs", 45.0, 2, 2, 2, "ENG-C02", 7, "SUP-PKG", null, "PR-107"],
  ["AIR-FILTER-SEP", "Compressor air/oil separator", "Filters", "pcs", 96.0, 2, 1, 2, "ENG-C03", 3, "SUP-AIR", null, "AOS-30"],
  ["AIR-FILTER-IN", "Compressor intake filter", "Filters", "pcs", 28.0, 3, 2, 2, "ENG-C03", 3, "SUP-AIR", null, "AIF-30"],
  ["AIR-OIL-20L", "Compressor oil, 20 L", "Lubricants", "pcs", 145.0, 2, 1, 1, "HYG-02", 3, "SUP-AIR", null, "CO-20"],
  ["AIR-DRYER-ELEM", "Dryer filter element", "Filters", "pcs", 54.0, 2, 2, 2, "ENG-C03", 3, "SUP-AIR", null, "DFE-01"],
  ["REF-CONTACTOR", "Refrigeration compressor contactor", "Electrical", "pcs", 68.0, 2, 1, 1, "ENG-C03", 3, "SUP-ELE", null, "RC-32"],
  ["REF-FAN-MOTOR", "Evaporator fan motor", "Motors", "pcs", 155.0, 1, 2, 2, "ENG-C01", 5, "SUP-ELE", null, "EFM-01"],
  ["GRS-FOOD-H1", "Food-grade grease H1, cartridge", "Lubricants", "pcs", 9.8, 24, 12, 24, "HYG-01", 2, "SUP-HYG", "SUP-GEN", "H1-400"],
  ["LUB-CHAIN-H1", "Food-grade chain oil H1, 400 ml", "Lubricants", "pcs", 11.5, 12, 6, 12, "HYG-01", 2, "SUP-HYG", null, "CO-H1-400"],
  ["HYG-DET-25L", "Foam detergent, 25 L", "Hygiene", "pcs", 58.0, 6, 4, 6, "HYG-04", 3, "SUP-HYG", null, "FD-25"],
  ["HYG-SAN-25L", "Sanitiser, 25 L", "Hygiene", "pcs", 64.0, 5, 4, 6, "HYG-04", 3, "SUP-HYG", null, "SN-25"],
  ["PPE-GLOVES-BL", "Blue nitrile gloves (L)", "PPE", "box", 7.5, 40, 20, 40, "HYG-03", 2, "SUP-HYG", "SUP-GEN", "NG-BL-L"],
  ["GEN-CABLE-TIE", "Cable ties, detectable blue", "General", "pack", 8.0, 15, 10, 20, "ENG-C04", 1, "SUP-GEN", "SUP-HYG", "CT-DET"],
  ["GEN-FIX-M8", "M8 stainless bolts & nuts", "Fixings", "box", 16.0, 6, 3, 6, "ENG-C04", 1, "SUP-GEN", null, "M8-SS"],
  ["GEN-THREADLOCK", "Threadlock, medium, 50 ml", "General", "pcs", 12.0, 6, 3, 6, "ENG-C04", 1, "SUP-GEN", null, "TL-243"],
];
const parts: Row[] = partRows.map(([id, name, category, unit, unitCost, stock, minStock, reorderQty, binId, leadTime, primarySupplierId, secondarySupplierId, manufacturerPartNo]) =>
  ({ id, name, category, unit, unitCost, stock, minStock, reorderQty, binId, leadTime, primarySupplierId, secondarySupplierId, manufacturerPartNo }));

const assets: Row[] = [];
const spares: Row[] = [];
const machine = (id: string, name: string, locationId: string, category: string, manufacturer: string, model: string, criticality: string, installDate: Date, partIds: (string | [string, number])[], parentAssetId?: string, status = "Operational") => {
  assets.push({ id, name, locationId, category, manufacturer, model, serialNumber: `SN-${id}`, criticality, status, installDate, parentAssetId });
  for (const p of partIds) {
    const [partId, quantity] = Array.isArray(p) ? p : [p, 1];
    spares.push({ assetId: id, partId, quantity });
  }
};

for (const n of [1, 2, 3, 4]) {
  const line = `L${n}`;
  const year = 2016 + n;
  const isSliceLine = n <= 2;
  machine(`${line}-INFEED`, `Line ${n} infeed conveyor`, line, "Conveyor", "Fenline", "MC-600", "B", d(year, 3, 1),
    ["BLT-L1-INF", ["BRG-UCP205", 2], ["BRG-UCF204", 2], "MTR-0.75", "BLT-SPROCKET", "ELE-PROX-M12"]);
  if (isSliceLine) {
    machine(`${line}-SLICER`, `Line ${n} slicer`, line, "Slicer", "Keenline", "KS-800", "A", d(year, 3, 1),
      ["SLC-BLADE-I", "SLC-GRIPPER", "SLC-SHARPEN", ["BRG-6205", 4], "ELE-ESTOP"]);
  } else {
    machine(`${line}-DEPOSITOR`, `Line ${n} depositor`, line, "Depositor", "Portiomatic", "PD-4", "A", d(year, 6, 1),
      [["PNE-CYL-32", 2], ["PNE-VALVE-5/2", 2], "ELE-PROX-M12", "ELE-ESTOP"]);
  }
  machine(`${line}-THERMO`, `Line ${n} thermoformer`, line, "Thermoformer", "Packform", "TF-560", "A", d(year, 4, 15),
    ["TF-HEATER", ["TF-SEAL-GASKET", 2], "TF-KNIFE", "TF-CHAIN-CLIP", "TF-SILICONE", ["PNE-VALVE-5/2", 3]]);
  machine(`${line}-VACPUMP`, `Line ${n} thermoformer vacuum pump`, line, "Vacuum pump", "Vaclux", "VX-100", "A", d(year, 4, 15),
    ["VP-OIL-5L", "VP-EXH-FILTER", "VP-INLET-FILTER"], `${line}-THERMO`);
  machine(`${line}-METALDET`, `Line ${n} metal detector`, line, "Metal detector", "Sentry", "SD-350", "A", d(year, 5, 1),
    ["BLT-MD", "MD-REJECT-ARM", "PNE-CYL-20", "MD-TEST-FE", "MD-TEST-SS", "ELE-PHOTO"]);
  machine(`${line}-CHECKWEIGH`, `Line ${n} checkweigher`, line, "Checkweigher", "Sentry", "CW-300", "B", d(year, 5, 1),
    ["BLT-CW", "CW-LOADCELL", "PNE-CYL-20", "ELE-PHOTO"]);
  machine(`${line}-LABELLER`, `Line ${n} labeller`, line, "Labeller", "Labelwise", "LW-107", "B", d(year, 5, 20),
    ["LAB-PRINTHEAD", "LAB-PLATEN", "LAB-RIBBON"], undefined, n === 3 ? "Maintenance" : "Operational");
  machine(`${line}-OUTFEED`, `Line ${n} outfeed conveyor`, line, "Conveyor", "Fenline", "MC-400", "C", d(year, 3, 1),
    ["BLT-L1-OUT", ["BRG-6204", 4], "MTR-0.75", "BLT-LACE"]);
}
machine("AIR-COMP-1", "Air compressor 1 (30 kW)", "PLANT", "Compressor", "Lindale", "LC-30", "A", d(2015, 9, 1),
  ["AIR-FILTER-SEP", "AIR-FILTER-IN", "AIR-OIL-20L"]);
machine("AIR-COMP-2", "Air compressor 2 (30 kW, standby)", "PLANT", "Compressor", "Lindale", "LC-30", "B", d(2015, 9, 1),
  ["AIR-FILTER-SEP", "AIR-FILTER-IN", "AIR-OIL-20L"]);
machine("AIR-DRYER", "Refrigerant air dryer", "PLANT", "Air dryer", "Lindale", "RD-40", "B", d(2015, 9, 1),
  ["AIR-DRYER-ELEM"], "AIR-COMP-1");
machine("REF-COMP-1", "Refrigeration compressor rack 1", "PLANT", "Refrigeration", "Coldline", "CR-3", "A", d(2014, 11, 1),
  ["REF-CONTACTOR"]);
machine("REF-COMP-2", "Refrigeration compressor rack 2", "PLANT", "Refrigeration", "Coldline", "CR-3", "A", d(2014, 11, 1),
  ["REF-CONTACTOR"], undefined, "Down");
for (const n of [1, 2, 3]) {
  machine(`CHILL-${n}`, `Chiller ${n} evaporator`, "CHILL", "Refrigeration", "Coldline", "EV-12", n === 1 ? "A" : "B", d(2014, 11, 1),
    [["REF-FAN-MOTOR", 2]], `REF-COMP-${n === 3 ? 2 : 1}`);
}
machine("WS-PILLAR-DRILL", "Workshop pillar drill", "WORKSHOP", "Workshop", "Bench Pro", "PD-25", "C", d(2019, 1, 10), []);
machine("WS-WELDER", "Workshop TIG welder", "WORKSHOP", "Workshop", "Arcwell", "TIG-200", "C", d(2020, 2, 3), []);

/** Users get a per-company "+c<id>" tag so the example can be imported into several test companies. */
function users(companyId: number): Row[] {
  const u = (name: string, role: string) =>
    ({ name, role, email: `${name.toLowerCase().replace(/\s+/g, ".")}+c${companyId}@example.invalid` });
  return [
    u("Priya Shah", "Manager"),
    u("Tom Fletcher", "Lead"),
    u("Dan Webb", "Technician"),
    u("Lucy Ward", "Technician"),
  ];
}

export function exampleRows(companyId: number): ExampleRows {
  return { sites, locations, storeRooms, bins, suppliers, parts, assets, assetSpares: spares, users: users(companyId) };
}
