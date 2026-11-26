/**
 * Purchasing rules (docs/asset-stock-jobs-plan.md P.2): which action is allowed from which
 * status, who may approve, and delivery status. Pure, so they can be unit-tested.
 */
import { PRIVILEGED_ROLES, ADMIN_ROLES } from "@shared/schema";
import type { PoStatus } from "@shared/constants";

export type PoAction = "edit" | "submit" | "withdraw" | "approve" | "reject" | "recall" | "send" | "receive" | "close" | "cancel";

export const ALLOWED_FROM: Record<PoAction, readonly PoStatus[]> = {
  edit: ["Draft", "Rejected"],
  submit: ["Draft", "Rejected"],
  withdraw: ["Pending Approval"],
  approve: ["Pending Approval"],
  reject: ["Pending Approval"],
  recall: ["Approved"],
  send: ["Approved"],
  receive: ["Sent", "Partially Received"],
  close: ["Partially Received"],
  cancel: ["Draft", "Pending Approval", "Approved", "Rejected", "Sent"],
};

const ACTION_LABEL: Record<PoAction, string> = {
  edit: "edited", submit: "submitted", withdraw: "withdrawn", approve: "approved", reject: "rejected",
  recall: "recalled", send: "marked as sent", receive: "received against", close: "closed", cancel: "cancelled",
};

/** Returns an error message if `action` isn't allowed while the PO is in `status`. */
export function checkTransition(status: string, action: PoAction): string | null {
  if ((ALLOWED_FROM[action] as readonly string[]).includes(status)) return null;
  if (action === "recall" && (status === "Sent" || status === "Partially Received" || status === "Received")) {
    return "This PO has already been sent to the supplier, so it can't be recalled. Cancel it with the supplier instead.";
  }
  return `A PO that is ${status} can't be ${ACTION_LABEL[action]}.`;
}

export interface PoActor { id: number; name: string; role: string }

export const isPrivilegedRole = (role: string) => (PRIVILEGED_ROLES as readonly string[]).includes(role);
export const isAdminRole = (role: string) => (ADMIN_ROLES as readonly string[]).includes(role);

/** Creator or Manager/Admin: may edit, submit, withdraw, send and cancel. */
export function canManage(actor: PoActor, createdById: number | null): boolean {
  return isPrivilegedRole(actor.role) || (createdById !== null && createdById === actor.id);
}

/**
 * Approval rule: nobody approves a PO they raised. An Admin may approve any other PO
 * whatever its value; everyone else needs a limit covering the PO's home-currency total.
 * Returns an error message, or null if allowed.
 */
export function checkApprover(input: {
  approverId: number; approverRole?: string; approverLimit: string | number | null; createdById: number | null; totalHome: string | number | null;
}): string | null {
  if (input.createdById !== null && input.createdById === input.approverId) {
    return "You can't approve a PO you raised. Ask another approver.";
  }
  if (input.approverRole && isAdminRole(input.approverRole)) return null;
  if (input.approverLimit === null || input.approverLimit === undefined || input.approverLimit === "") {
    return "You don't have approval rights for purchase orders.";
  }
  if (input.totalHome === null || input.totalHome === undefined) return "This PO has no home-currency total yet.";
  const limit = Number(input.approverLimit);
  const total = Number(input.totalHome);
  if (total > limit) {
    return `This PO is £${total.toFixed(2)} GBP; your approval limit is £${limit.toFixed(2)} GBP.`;
  }
  return null;
}

export interface LineQuantities { quantity: number; quantityReceived: number; quantityCancelled: number }

export const outstanding = (l: LineQuantities) => l.quantity - l.quantityReceived - l.quantityCancelled;

export type DeliveryStatus = "Not received" | "Part received" | "Received" | "Closed short" | "Cancelled";

export function lineDeliveryStatus(l: LineQuantities): DeliveryStatus {
  if (l.quantityReceived >= l.quantity) return "Received";
  if (l.quantityCancelled > 0 && outstanding(l) === 0) return l.quantityReceived > 0 ? "Closed short" : "Cancelled";
  return l.quantityReceived > 0 ? "Part received" : "Not received";
}

/** Status after a delivery: Received when nothing is outstanding, else Partially Received. */
export function statusAfterReceipt(lines: LineQuantities[]): "Received" | "Partially Received" {
  return lines.every((l) => outstanding(l) === 0) ? "Received" : "Partially Received";
}

/** Suggested order quantity for a part at or below its reorder level. */
export function suggestedQuantity(p: { stock: number; onOrder: number; minStock: number; reorderQty: number | null }): number {
  if (p.reorderQty && p.reorderQty > 0) return p.reorderQty;
  return Math.max(1, p.minStock - (p.stock + p.onOrder) + 1);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** PO total (ex-VAT, PO currency) from its lines. */
export function poTotal(lines: { quantity: number; unitPrice: number }[]): number {
  return round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
}
