/**
 * Fixed lists shared by the UI dropdowns, the API validation and the import template.
 * Kept free of imports so the browser can use them without pulling in the ORM.
 */
export const LOCATION_TYPES = ["Building", "Production area", "Line", "Room", "Other"] as const;
export const ASSET_STATUSES = ["Operational", "Maintenance", "Down", "In Storage", "Loaned Out"] as const;
export const CRITICALITIES = ["A", "B", "C"] as const;
export const PART_UNITS = ["pcs", "m", "mm", "L", "ml", "kg", "g", "box", "pack", "set", "pair", "roll"] as const;
