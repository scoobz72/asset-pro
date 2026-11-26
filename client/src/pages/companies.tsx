import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, Plus, Inbox } from "lucide-react";
import Layout from "@/components/Layout";
import { useCreateMutation, useUpdateMutation } from "@/hooks/use-data";
import { useCurrentUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type CompanyRow = { id: number; name: string; status: string; createdAt: string; userCount: number };
type AccessRequestRow = {
  id: number; name: string; company: string; email: string;
  phone: string | null; message: string | null; status: string; createdAt: string;
};

const COMPANIES_KEY = "/api/platform/companies";
const REQUESTS_KEY = "/api/platform/access-requests";

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.startsWith("409")) return "That email address is already in use.";
  if (msg.startsWith("400")) return "Please check the details and try again.";
  return "Something went wrong. Please try again.";
}

function NewCompanyDialog({
  open, onOpenChange, prefill, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: { name: string; managerName: string; managerEmail: string };
  onCreated?: () => void;
}) {
  const { toast } = useToast();
  const create = useCreateMutation(COMPANIES_KEY, [COMPANIES_KEY]);
  const [form, setForm] = useState({ name: "", managerName: "", managerEmail: "", managerPassword: "" });
  const [error, setError] = useState<string | null>(null);

  // Start from a clean form (or the access request's details) each time it opens.
  useEffect(() => {
    if (open) {
      setForm({ name: prefill?.name ?? "", managerName: prefill?.managerName ?? "", managerEmail: prefill?.managerEmail ?? "", managerPassword: "" });
      setError(null);
    }
  }, [open, prefill]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(form, {
      onSuccess: () => {
        toast({ title: `${form.name} created`, description: `${form.managerEmail} can now sign in with the temporary password.` });
        onCreated?.();
        onOpenChange(false);
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>
            Creates the company and its first Manager. Give the Manager the temporary password;
            they can then add the rest of their team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">Company name</Label>
            <Input id="c-name" required maxLength={200} value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-mname">Manager's name</Label>
            <Input id="c-mname" required maxLength={200} value={form.managerName} onChange={set("managerName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-memail">Manager's email</Label>
            <Input id="c-memail" type="email" required maxLength={320} value={form.managerEmail} onChange={set("managerEmail")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-mpass">Temporary password</Label>
            <Input id="c-mpass" type="text" required minLength={8} maxLength={200} autoComplete="off"
              value={form.managerPassword} onChange={set("managerPassword")} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating..." : "Create company"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Companies() {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: companies, isLoading } = useQuery<CompanyRow[]>({ queryKey: [COMPANIES_KEY] });
  const { data: requests } = useQuery<AccessRequestRow[]>({ queryKey: [REQUESTS_KEY] });
  const updateCompany = useUpdateMutation(COMPANIES_KEY, [COMPANIES_KEY]);
  const updateRequest = useUpdateMutation(REQUESTS_KEY, [REQUESTS_KEY]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; managerName: string; managerEmail: string } | undefined>();
  const [fromRequest, setFromRequest] = useState<AccessRequestRow | undefined>();

  const openRequests = (requests ?? []).filter((r) => r.status === "New");

  const toggleStatus = (c: CompanyRow) => {
    const status = c.status === "Active" ? "Suspended" : "Active";
    updateCompany.mutate(
      { id: c.id, data: { status } },
      {
        onSuccess: () => toast({ title: `${c.name} ${status === "Active" ? "reactivated" : "suspended"}` }),
        onError: () => toast({ title: "Could not update the company", variant: "destructive" }),
      },
    );
  };

  const setRequestStatus = (r: AccessRequestRow, status: "Done" | "Dismissed") => {
    updateRequest.mutate({ id: r.id, data: { status } });
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground mt-1">Create and manage customer companies.</p>
        </div>
        <Button className="gap-2" onClick={() => { setPrefill(undefined); setFromRequest(undefined); setDialogOpen(true); }} data-testid="button-new-company">
          <Plus className="size-4" /> New company
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Inbox className="size-5" /> Access requests</CardTitle>
          <CardDescription>Sent from the "Request access" form on the home page.</CardDescription>
        </CardHeader>
        <CardContent>
          {openRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No new requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openRequests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(r.createdAt), "d MMM yyyy")}</TableCell>
                    <TableCell className="font-medium">{r.company}</TableCell>
                    <TableCell>
                      <div>{r.name}</div>
                      <a className="text-xs text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a>
                      {r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground whitespace-pre-wrap">{r.message}</TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Button size="sm" onClick={() => {
                        setPrefill({ name: r.company, managerName: r.name, managerEmail: r.email });
                        setFromRequest(r);
                        setDialogOpen(true);
                      }}>Create company</Button>
                      <Button size="sm" variant="outline" onClick={() => setRequestStatus(r, "Dismissed")}>Dismiss</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="size-5" /> All companies</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(companies ?? []).map((c) => (
                  <TableRow key={c.id} data-testid={`row-company-${c.id}`}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.userCount}</TableCell>
                    <TableCell>{format(new Date(c.createdAt), "d MMM yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "Active" ? "default" : "destructive"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.id !== currentUser?.companyId && (
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(c)} disabled={updateCompany.isPending}>
                          {c.status === "Active" ? "Suspend" : "Reactivate"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewCompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefill={prefill}
        onCreated={() => { if (fromRequest) setRequestStatus(fromRequest, "Done"); }}
      />
    </Layout>
  );
}
