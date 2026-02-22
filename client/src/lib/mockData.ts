import { addDays, subDays, format } from "date-fns";

export const users = [
  { id: 1, name: "John Doe", role: "Manager", status: "Active", avatar: "https://i.pravatar.cc/150?u=1" },
  { id: 2, name: "Sarah Smith", role: "Technician", status: "Busy", avatar: "https://i.pravatar.cc/150?u=2" },
  { id: 3, name: "Mike Johnson", role: "Technician", status: "Available", avatar: "https://i.pravatar.cc/150?u=3" },
  { id: 4, name: "Emily Davis", role: "Technician", status: "Offline", avatar: "https://i.pravatar.cc/150?u=4" },
];

export const sites = [
  { id: "SITE-001", name: "Main Production Facility" },
  { id: "SITE-002", name: "Logistics Hub" }
];

export const locations = [
  { id: "LOC-101", name: "Building A", siteId: "SITE-001" },
  { id: "LOC-102", name: "Roof", siteId: "SITE-001" },
  { id: "LOC-103", name: "Basement", siteId: "SITE-001" },
  { id: "LOC-104", name: "Workshop", siteId: "SITE-001" },
  { id: "LOC-201", name: "Zone 1", siteId: "SITE-002" },
  { id: "LOC-202", name: "Building B", siteId: "SITE-002" },
];

export const assets = [
  { id: "A-101", name: "Hydraulic Press #4", location: "Building A", status: "Operational", health: 98, lastService: "2023-10-15", partsUsed: ["PART-002", "PART-003"] },
  { id: "A-102", name: "Conveyor Belt Main", location: "Building A", status: "Maintenance", health: 45, lastService: "2023-11-01", partsUsed: ["PART-004", "PART-001"] },
  { id: "A-201", name: "Cooling Tower B", location: "Roof", status: "Operational", health: 92, lastService: "2023-09-20", partsUsed: ["PART-001"] },
  { id: "A-205", name: "Generator Backup", location: "Basement", status: "Down", health: 0, lastService: "2023-08-10", partsUsed: ["PART-005", "PART-002", "PART-003"] },
  { id: "A-301", name: "CNC Machine X1", location: "Workshop", status: "Operational", health: 88, lastService: "2023-10-25", partsUsed: ["PART-002"] },
];

export const jobs = [
  { id: "JOB-1001", title: "Monthly Inspection", asset: "A-101", priority: "Medium", status: "Open", assignee: 2, dueDate: addDays(new Date(), 2) },
  { id: "JOB-1002", title: "Belt Replacement", asset: "A-102", priority: "High", status: "In Progress", assignee: 3, dueDate: addDays(new Date(), 0) },
  { id: "JOB-1003", title: "Oil Change", asset: "A-301", priority: "Low", status: "Completed", assignee: 2, dueDate: subDays(new Date(), 2) },
  { id: "JOB-1004", title: "Emergency Repair", asset: "A-205", priority: "Critical", status: "Open", assignee: null, dueDate: subDays(new Date(), 1) },
  { id: "JOB-1005", title: "Filter Cleaning", asset: "A-201", priority: "Medium", status: "Scheduled", assignee: 3, dueDate: addDays(new Date(), 5) },
];

export const inventory = [
  { id: "PART-001", name: "Filter Type A", category: "Consumables", stock: 45, minStock: 10, unit: "pcs", location: "Shelf A1", lastUsed: "2023-11-10", lastStockTaken: "2023-11-01", usedOnAssets: ["A-102", "A-201"], primarySupplier: "SUP-001", secondarySupplier: "SUP-005" },
  { id: "PART-002", name: "Hydraulic Fluid", category: "Fluids", stock: 120, minStock: 50, unit: "L", location: "Cabinet B", lastUsed: "2023-11-12", lastStockTaken: "2023-10-25", usedOnAssets: ["A-101", "A-205", "A-301"], primarySupplier: "SUP-002", secondarySupplier: "SUP-001" },
  { id: "PART-003", name: "Bearing 6204", category: "Spares", stock: 4, minStock: 10, unit: "pcs", location: "Shelf C3", lastUsed: "2023-11-05", lastStockTaken: "2023-11-05", usedOnAssets: ["A-101", "A-205"], primarySupplier: "SUP-003", secondarySupplier: "SUP-001" },
  { id: "PART-004", name: "V-Belt B52", category: "Spares", stock: 8, minStock: 5, unit: "pcs", location: "Shelf C4", lastUsed: "2023-10-28", lastStockTaken: "2023-11-01", usedOnAssets: ["A-102"], primarySupplier: "SUP-001", secondarySupplier: "SUP-005" },
  { id: "PART-005", name: "Safety Gloves", category: "PPE", stock: 200, minStock: 50, unit: "pairs", location: "Locker 1", lastUsed: "2023-11-14", lastStockTaken: "2023-11-10", usedOnAssets: ["A-205"], primarySupplier: "SUP-004", secondarySupplier: "SUP-005" },
];

export const templates = [
  { 
    id: "TPL-001", 
    name: "Standard Breakdown Report", 
    type: "Breakdown",
    description: "Generic template for unexpected equipment failures.",
    steps: [
      { id: 1, text: "Isolate equipment and apply LOTO (Lockout/Tagout)", required: true },
      { id: 2, text: "Identify root cause of failure", required: true },
      { id: 3, text: "Perform necessary repairs/part replacements", required: true },
      { id: 4, text: "Test equipment functionality post-repair", required: true },
      { id: 5, text: "Remove LOTO and return to service", required: true },
      { id: 6, text: "Clean work area", required: false }
    ],
    signOffs: ["Lead Engineer"]
  },
  { 
    id: "TPL-002", 
    name: "Hydraulic Press PM - Monthly", 
    type: "Planned",
    description: "Specific monthly maintenance steps for all hydraulic presses.",
    steps: [
      { id: 1, text: "Check fluid levels and top up if necessary", required: true },
      { id: 2, text: "Inspect all hoses for leaks or wear", required: true },
      { id: 3, text: "Verify pressure gauge readings match specifications", required: true },
      { id: 4, text: "Lubricate guide rails and moving parts", required: true },
      { id: 5, text: "Test emergency stop mechanism", required: true }
    ],
    signOffs: ["Technician", "Safety Officer"]
  },
  { 
    id: "TPL-003", 
    name: "HVAC Filter Replacement", 
    type: "Planned",
    description: "Quarterly filter replacement for HVAC systems.",
    steps: [
      { id: 1, text: "Turn off HVAC unit power", required: true },
      { id: 2, text: "Remove old filters and bag for disposal", required: true },
      { id: 3, text: "Vacuum filter housing unit", required: false },
      { id: 4, text: "Install new filters (ensure correct airflow direction)", required: true },
      { id: 5, text: "Restore power and verify airflow", required: true }
    ],
    signOffs: ["Technician"]
  }
];

export const stockTransactions = [
  { id: "TXN-001", date: "2023-11-15T08:30:00", partId: "PART-001", partName: "Filter Type A", type: "Job Book Out", quantity: -2, user: "Sarah Smith", reference: "JOB-1002" },
  { id: "TXN-002", date: "2023-11-14T14:15:00", partId: "PART-005", partName: "Safety Gloves", type: "Stock Adjustment", quantity: -5, user: "John Doe", reference: "Damaged stock" },
  { id: "TXN-003", date: "2023-11-12T10:00:00", partId: "PART-002", partName: "Hydraulic Fluid", type: "Purchase Order", quantity: 50, user: "System", reference: "PO-2023-089" },
  { id: "TXN-004", date: "2023-11-10T09:45:00", partId: "PART-003", partName: "Bearing 6204", type: "Transfer In", quantity: 10, user: "Mike Johnson", reference: "From Factory B" },
  { id: "TXN-005", date: "2023-11-08T16:20:00", partId: "PART-004", partName: "V-Belt B52", type: "Job Book Out", quantity: -1, user: "Sarah Smith", reference: "JOB-0988" },
];

export const purchaseOrders = [
  { id: "PO-2023-090", vendor: "Industrial Supply Co", status: "Pending Approval", total: 1250.00, requestedBy: "Emily Davis (Lead)", date: "2023-11-16", items: 3 },
  { id: "PO-2023-089", vendor: "Fluid Dynamics Inc", status: "Received", total: 450.00, requestedBy: "Mike Johnson (Lead)", date: "2023-11-10", items: 1 },
  { id: "PO-2023-088", vendor: "Safety First Gear", status: "Approved", total: 890.50, requestedBy: "Admin User", date: "2023-11-15", items: 4 },
  { id: "PO-2023-087", vendor: "Global Bearings", status: "Draft", total: 320.00, requestedBy: "Sarah Smith (Lead)", date: "2023-11-17", items: 2 },
];

export const suppliers = [
  { id: "SUP-001", name: "Industrial Supply Co", categories: ["Consumables", "Spares", "Tools"], rating: 4.8, leadTime: "2-3 days", contact: "sales@industrialsupply.com" },
  { id: "SUP-002", name: "Fluid Dynamics Inc", categories: ["Fluids", "Lubricants", "Pumps"], rating: 4.5, leadTime: "1-2 days", contact: "orders@fluiddynamics.com" },
  { id: "SUP-003", name: "Global Bearings", categories: ["Spares", "Bearings", "Motors"], rating: 4.9, leadTime: "3-5 days", contact: "support@globalbearings.com" },
  { id: "SUP-004", name: "Safety First Gear", categories: ["PPE", "Safety", "Uniforms"], rating: 4.2, leadTime: "1 day", contact: "sales@safetyfirst.com" },
  { id: "SUP-005", name: "FastParts Logistics", categories: ["Consumables", "Electrical", "Spares"], rating: 3.9, leadTime: "1-2 days", contact: "urgent@fastparts.com" }
];

export const assetAudits = [
  { id: "AUD-001", assetId: "A-101", status: "Pending", scheduledDate: "2023-11-20", assignedTo: "John Doe", expectedLocation: "Building A" },
  { id: "AUD-002", assetId: "A-201", status: "Completed", scheduledDate: "2023-11-15", assignedTo: "Sarah Smith", expectedLocation: "Roof", verifiedLocation: "Roof", completionDate: "2023-11-15T10:30:00" },
  { id: "AUD-003", assetId: "A-205", status: "Discrepancy", scheduledDate: "2023-11-18", assignedTo: "Mike Johnson", expectedLocation: "Basement", verifiedLocation: "Building B", completionDate: "2023-11-18T14:45:00", notes: "Asset was moved without updating system." },
  { id: "AUD-004", assetId: "A-301", status: "Scheduled", scheduledDate: "2023-12-05", assignedTo: "Emily Davis", expectedLocation: "Workshop" },
];
