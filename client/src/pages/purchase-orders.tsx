import Layout from "@/components/Layout";
import { usePurchaseOrders, useSuppliers, useInventory } from "@/hooks/use-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Search, 
  Plus, 
  FileText,
  CheckCircle2,
  MoreHorizontal,
  Clock,
  Ban,
  Building2,
  ShieldAlert
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { cn } from "@/lib/utils";

type UserRole = "Admin" | "Manager" | "Lead";

export default function PurchaseOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Admin");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");

  const { data: purchaseOrders, isLoading } = usePurchaseOrders();
  const { data: suppliers } = useSuppliers();

  const createPOMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/purchase-orders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setDialogOpen(false);
      setSelectedVendor("");
    },
  });

  const updatePOMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/purchase-orders/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
    },
  });

  const poList = (purchaseOrders as any[] || []);
  const supplierList = (suppliers as any[] || []);

  const filteredPOs = poList.filter((po: any) => 
    (po.vendor || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (po.id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canCreatePO = currentUserRole === "Admin" || currentUserRole === "Lead";
  const canApprovePO = currentUserRole === "Admin" || currentUserRole === "Manager";

  const handleCreatePO = () => {
    if (!selectedVendor) return;
    const vendor = supplierList.find((s: any) => s.id === selectedVendor);
    const newId = `PO-${Date.now()}`;
    createPOMutation.mutate({
      id: newId,
      vendor: vendor?.name || selectedVendor,
      status: "Pending Approval",
      total: "0",
      requestedBy: currentUserRole + " User",
      date: new Date().toISOString().split("T")[0],
      items: 0,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft":
        return <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200"><FileText className="mr-1 size-3" /> Draft</Badge>;
      case "Pending Approval":
        return <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200"><Clock className="mr-1 size-3" /> Pending</Badge>;
      case "Approved":
        return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200"><CheckCircle2 className="mr-1 size-3" /> Approved</Badge>;
      case "Received":
        return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200"><BoxIcon className="mr-1 size-3" /> Received</Badge>;
      case "Rejected":
        return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200"><Ban className="mr-1 size-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const BoxIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
  );

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Manage vendor orders and approvals.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border">
            <span className="text-xs font-medium text-muted-foreground ml-2">Simulate Role:</span>
            <Select value={currentUserRole} onValueChange={(v) => setCurrentUserRole(v as UserRole)}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Lead">Lead User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canCreatePO} className={cn(!canCreatePO && "opacity-50 cursor-not-allowed")}>
                <Plus className="mr-2 size-4" />
                Raise PO
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Raise Purchase Order</DialogTitle>
                <DialogDescription>
                  Create a new purchase order request. It will require manager approval.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {!canCreatePO && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-start gap-2 text-sm border border-red-200 mb-2">
                    <ShieldAlert className="size-4 mt-0.5 shrink-0" />
                    <p>Your current role ({currentUserRole}) does not have permission to create purchase orders.</p>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Select disabled={!canCreatePO} value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierList.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="items">Order Items</Label>
                  <div className="border rounded-md p-4 bg-muted/20 flex flex-col items-center justify-center text-muted-foreground h-32">
                    <Button variant="outline" size="sm" disabled={!canCreatePO}>
                      <Plus className="mr-2 size-3" /> Add Item from Inventory
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Save Draft</Button>
                <Button 
                  type="submit" 
                  disabled={!canCreatePO || !selectedVendor || createPOMutation.isPending}
                  onClick={handleCreatePO}
                >
                  {createPOMutation.isPending ? "Submitting..." : "Submit for Approval"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search POs, Vendors..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9" 
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPOs.map((po: any) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium font-mono text-xs">
                  {po.id}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {po.date}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <span className="font-medium">{po.vendor}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {po.requestedBy}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {po.items}
                </TableCell>
                <TableCell className="text-right font-medium">
                  ${parseFloat(po.total || "0").toFixed(2)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(po.status)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>PO Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem><FileText className="mr-2 size-4" /> View Details</DropdownMenuItem>
                      
                      {po.status === "Pending Approval" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            disabled={!canApprovePO} 
                            className={cn("text-green-600 focus:text-green-600", !canApprovePO && "opacity-50")}
                            onClick={() => canApprovePO && updatePOMutation.mutate({ id: po.id, status: "Approved" })}
                          >
                            <CheckCircle2 className="mr-2 size-4" /> Approve Order
                            {!canApprovePO && <span className="ml-2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Admin/Mgr Only</span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            disabled={!canApprovePO} 
                            className={cn("text-red-600 focus:text-red-600", !canApprovePO && "opacity-50")}
                            onClick={() => canApprovePO && updatePOMutation.mutate({ id: po.id, status: "Rejected" })}
                          >
                            <Ban className="mr-2 size-4" /> Reject
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredPOs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No purchase orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
