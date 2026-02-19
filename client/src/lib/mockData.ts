import { addDays, subDays, format } from "date-fns";

export const users = [
  { id: 1, name: "John Doe", role: "Manager", status: "Active", avatar: "https://i.pravatar.cc/150?u=1" },
  { id: 2, name: "Sarah Smith", role: "Technician", status: "Busy", avatar: "https://i.pravatar.cc/150?u=2" },
  { id: 3, name: "Mike Johnson", role: "Technician", status: "Available", avatar: "https://i.pravatar.cc/150?u=3" },
  { id: 4, name: "Emily Davis", role: "Technician", status: "Offline", avatar: "https://i.pravatar.cc/150?u=4" },
];

export const assets = [
  { id: "A-101", name: "Hydraulic Press #4", location: "Building A", status: "Operational", health: 98, lastService: "2023-10-15" },
  { id: "A-102", name: "Conveyor Belt Main", location: "Building A", status: "Maintenance", health: 45, lastService: "2023-11-01" },
  { id: "A-201", name: "Cooling Tower B", location: "Roof", status: "Operational", health: 92, lastService: "2023-09-20" },
  { id: "A-205", name: "Generator Backup", location: "Basement", status: "Down", health: 0, lastService: "2023-08-10" },
  { id: "A-301", name: "CNC Machine X1", location: "Workshop", status: "Operational", health: 88, lastService: "2023-10-25" },
];

export const jobs = [
  { id: "JOB-1001", title: "Monthly Inspection", asset: "A-101", priority: "Medium", status: "Open", assignee: 2, dueDate: addDays(new Date(), 2) },
  { id: "JOB-1002", title: "Belt Replacement", asset: "A-102", priority: "High", status: "In Progress", assignee: 3, dueDate: addDays(new Date(), 0) },
  { id: "JOB-1003", title: "Oil Change", asset: "A-301", priority: "Low", status: "Completed", assignee: 2, dueDate: subDays(new Date(), 2) },
  { id: "JOB-1004", title: "Emergency Repair", asset: "A-205", priority: "Critical", status: "Open", assignee: null, dueDate: subDays(new Date(), 1) },
  { id: "JOB-1005", title: "Filter Cleaning", asset: "A-201", priority: "Medium", status: "Scheduled", assignee: 3, dueDate: addDays(new Date(), 5) },
];

export const inventory = [
  { id: "PART-001", name: "Filter Type A", category: "Consumables", stock: 45, minStock: 10, unit: "pcs", location: "Shelf A1" },
  { id: "PART-002", name: "Hydraulic Fluid", category: "Fluids", stock: 120, minStock: 50, unit: "L", location: "Cabinet B" },
  { id: "PART-003", name: "Bearing 6204", category: "Spares", stock: 4, minStock: 10, unit: "pcs", location: "Shelf C3" },
  { id: "PART-004", name: "V-Belt B52", category: "Spares", stock: 8, minStock: 5, unit: "pcs", location: "Shelf C4" },
  { id: "PART-005", name: "Safety Gloves", category: "PPE", stock: 200, minStock: 50, unit: "pairs", location: "Locker 1" },
];
