import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useUsers, useCreateMutation, useUpdateMutation } from "@/hooks/use-data";
import { useCurrentUser, ADMIN_ROLES, PLATFORM_ADMIN_ROLE, PRIVILEGED_ROLES } from "@/hooks/use-auth";
import { ShiftsDialog } from "@/components/ShiftsDialog";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, MoreVertical, Plus } from "lucide-react";

const ROLES = ["Manager", "Admin", "Lead", "Technician"];

type TeamUser = { id: number; name: string; role: string; status: string; avatar: string | null; email: string | null; poApprovalLimit: string | null; hourlyRate?: string | null };

/** Stored as the largest value the column holds; shown as "Unlimited". */
const UNLIMITED = 999999999999.99;
type LimitMode = "none" | "amount" | "unlimited";
const limitMode = (v: string | null): LimitMode => v === null ? "none" : Number(v) >= UNLIMITED ? "unlimited" : "amount";
export function approvalLimitText(v: string | null): string {
  const mode = limitMode(v);
  if (mode === "none") return "No PO approval";
  if (mode === "unlimited") return "Approves POs: unlimited";
  return `Approves POs up to £${Number(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP`;
}

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.startsWith("409")) return "That email address is already in use.";
  if (msg.startsWith("403")) return "Only Managers and Admins can do this.";
  if (msg.startsWith("400")) return "Please check the details and try again.";
  return "Something went wrong. Please try again.";
}

function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const create = useCreateMutation("/api/users", ["/api/users"]);
  const [form, setForm] = useState({ name: "", email: "", role: "Technician", password: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ name: "", email: "", role: "Technician", password: "" });
      setError(null);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(form, {
      onSuccess: () => {
        toast({ title: `${form.name} added`, description: "Give them their email and temporary password to sign in." });
        onOpenChange(false);
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>They'll sign in with this email and temporary password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" required maxLength={200} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-email">Email</Label>
            <Input id="m-email" type="email" required maxLength={320} value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(role) => setForm((f) => ({ ...f, role }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-pass">Temporary password</Label>
            <Input id="m-pass" type="text" required minLength={8} maxLength={200} autoComplete="off" value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Adding..." : "Add member"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ user, onClose, selfId }: { user: TeamUser | null; onClose: () => void; selfId?: number }) {
  const { toast } = useToast();
  const update = useUpdateMutation("/api/users", ["/api/users"]);
  const [role, setRole] = useState("Technician");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LimitMode>("none");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (user) {
      setRate(user.hourlyRate == null ? "" : Number(user.hourlyRate).toFixed(2));
      setRole(user.role);
      setPassword("");
      setError(null);
      setMode(limitMode(user.poApprovalLimit));
      setAmount(limitMode(user.poApprovalLimit) === "amount" ? Number(user.poApprovalLimit).toFixed(2) : "");
    }
  }, [user]);

  if (!user) return null;
  const isPlatformAdmin = user.role === PLATFORM_ADMIN_ROLE;
  const isSelf = user.id === selfId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const data: Record<string, string | number | null> = {};
    if (!isPlatformAdmin && role !== user.role) data.role = role;
    if (password) data.password = password;
    const limit = mode === "none" ? null : mode === "unlimited" ? UNLIMITED : Number(amount.replace(/[£,\s]/g, ""));
    if (mode === "amount" && (!Number.isFinite(limit) || (limit as number) < 0)) {
      return setError("Enter the approval limit as an amount in GBP, e.g. 2500.");
    }
    const current = user.poApprovalLimit === null ? null : Number(user.poApprovalLimit);
    if (limit !== current) data.poApprovalLimit = limit;
    const rateText = rate.replace(/[£,\s]/g, "");
    const newRate = rateText === "" ? null : Number(rateText);
    if (newRate !== null && (!Number.isFinite(newRate) || newRate < 0)) {
      return setError("Enter the hourly labour rate in GBP, e.g. 32.50, or leave it blank.");
    }
    const curRate = user.hourlyRate == null ? null : Number(user.hourlyRate);
    if (newRate !== curRate) data.hourlyRate = newRate;
    if (Object.keys(data).length === 0) return onClose();
    update.mutate({ id: user.id, data }, {
      onSuccess: () => {
        toast({ title: `${user.name} updated` });
        onClose();
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.name}</DialogTitle>
          <DialogDescription>Change their role, PO approval limit, labour rate or password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!isPlatformAdmin && isSelf && (
            <p className="text-sm text-muted-foreground">You can't change your own role. Ask another Admin.</p>
          )}
          {!isPlatformAdmin && !isSelf && (
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Purchase order approval (GBP, ex-VAT)</Label>
            <div className="flex gap-2">
              <Select value={mode} onValueChange={(v) => setMode(v as LimitMode)}>
                <SelectTrigger className="w-44" data-testid="select-approval-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Can't approve</SelectItem>
                  <SelectItem value="amount">Up to a limit</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
              {mode === "amount" && (
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-sm text-muted-foreground">£</span>
                  <Input className="pl-7 pr-12" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500.00" data-testid="input-approval-limit" />
                  <span className="absolute right-3 top-2 text-xs text-muted-foreground">GBP</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Nobody can approve a PO they raised themselves.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-rate">Labour rate per hour (GBP)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-muted-foreground">£</span>
              <Input id="e-rate" className="pl-7 pr-12" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Not set" data-testid="input-hourly-rate" />
              <span className="absolute right-3 top-2 text-xs text-muted-foreground">GBP</span>
            </div>
            <p className="text-xs text-muted-foreground">Used to cost hours booked to jobs. Only Managers and Admins see rates and labour costs. Changing it doesn't re-cost hours already booked.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-pass">New password (leave blank to keep the current one)</Label>
            <Input id="e-pass" type="text" minLength={8} maxLength={200} autoComplete="off" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Team() {
  const { data: users, isLoading } = useUsers();
  const { data: currentUser } = useCurrentUser();
  // Only Admins manage people: add users, change roles, reset passwords, set approval limits.
  const canManage = !!currentUser && ADMIN_ROLES.includes(currentUser.role);
  const userList = (users as TeamUser[] | undefined) ?? [];
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [shifts, setShifts] = useState<TeamUser | null>(null);
  // Managers and Admins keep shift patterns and absences (they feed engineer utilisation).
  const canShifts = !!currentUser && PRIVILEGED_ROLES.includes(currentUser.role);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1">The people in your company who can sign in.</p>
        </div>
        {canManage && (
          <Button className="gap-2" onClick={() => setAddOpen(true)} data-testid="button-add-member">
            <Plus className="size-4" /> Add Member
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {userList.map((user) => (
          <Card key={user.id} className="overflow-hidden" data-testid={`card-user-${user.id}`}>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={user.avatar ?? undefined} />
                <AvatarFallback>{(user.name || "").split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <CardDescription>{user.role === PLATFORM_ADMIN_ROLE ? "Platform admin" : user.role}</CardDescription>
                <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-approval-${user.id}`}>{approvalLimitText(user.poApprovalLimit)}</p>
              </div>
              {(canManage || canShifts) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Manage ${user.name}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManage && <DropdownMenuItem onClick={() => setEditing(user)}>Edit role, approval limit, rate or password</DropdownMenuItem>}
                    {canShifts && <DropdownMenuItem onClick={() => setShifts(user)} data-testid={`menu-shifts-${user.id}`}>Shift hours & absences</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant={
                  user.status === "Available" ? "default" :
                  user.status === "Busy" ? "destructive" :
                  "secondary"
                } className={
                  user.status === "Available" ? "bg-green-500 hover:bg-green-600" :
                  user.status === "Busy" ? "bg-red-500 hover:bg-red-600" :
                  "bg-slate-500 hover:bg-slate-600"
                }>
                  {user.status}
                </Badge>
              </div>
              {user.email && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="mr-2 h-4 w-4" />
                  {user.email}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditMemberDialog user={editing} onClose={() => setEditing(null)} selfId={currentUser?.id} />
      <ShiftsDialog user={shifts} onClose={() => setShifts(null)} />
    </Layout>
  );
}
