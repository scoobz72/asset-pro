import Layout from "@/components/Layout";
import { useInventory, useSuppliers, useAssets, useTransactions, useBins, useStoreRooms, useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/use-data";
import { PART_UNITS } from "@shared/constants";
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
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Plus, 
  AlertCircle, 
  ShoppingCart,
  Image as ImageIcon,
  MoreHorizontal,
  Building2,
  History,
  Loader2,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Link } from "wouter";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import type { InventoryItem, Supplier, Asset, StockTransaction, Bin, StoreRoom } from "@shared/schema";

export default function Inventory() {
  const { data: inventoryData = [], isLoading: inventoryLoading } = useInventory();
  const { data: suppliersData = [] } = useSuppliers();
  const { data: assetsData = [] } = useAssets();
  const { data: transactionsData = [] } = useTransactions();
  const { data: binsData = [] } = useBins();
  const { data: storeRoomsData = [] } = useStoreRooms();
  const binsList = binsData as Bin[];
  const storeRoomsList = storeRoomsData as StoreRoom[];

  const inventoryItems = inventoryData as InventoryItem[];
  const suppliersList = suppliersData as Supplier[];
  const assetsList = assetsData as Asset[];
  const transactionsList = transactionsData as StockTransaction[];

  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [adjustStockDialogOpen, setAdjustStockDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const { toast } = useToast();

  const [newItem, setNewItem] = useState({
    id: "",
    name: "",
    category: "",
    stock: 0,
    minStock: 0,
    unit: "pcs",
    binId: "",
    unitCost: "",
    reorderQty: "",
    manufacturerPartNo: "",
    leadTime: 1,
    primarySupplierId: "",
    secondarySupplierId: "",
  });

  const [editItem, setEditItem] = useState({
    name: "",
    category: "",
    minStock: 0,
    unit: "pcs",
    binId: "",
    unitCost: "",
    reorderQty: "",
    manufacturerPartNo: "",
    leadTime: 1,
    primarySupplierId: "",
    secondarySupplierId: "",
  });

  const [stockAdjustment, setStockAdjustment] = useState({
    quantity: 0,
    type: "Stock In",
    reference: "",
  });

  const createMutation = useCreateMutation("/api/inventory", ["/api/inventory"]);
  const updateMutation = useUpdateMutation("/api/inventory", ["/api/inventory"]);
  const deleteMutation = useDeleteMutation("/api/inventory", ["/api/inventory"]);

  const adjustStockMutation = useMutation({
    mutationFn: async ({ item, adjustment }: { item: InventoryItem; adjustment: typeof stockAdjustment }) => {
      const qty = adjustment.type.includes("Out") || adjustment.type.includes("Book Out") ? -Math.abs(adjustment.quantity) : Math.abs(adjustment.quantity);
      const newStock = item.stock + qty;

      await apiRequest("PATCH", `/api/inventory/${item.id}`, { stock: newStock });

      const txnId = `TXN-${Date.now()}`;
      await apiRequest("POST", "/api/transactions", {
        id: txnId,
        date: new Date().toISOString(),
        partId: item.id,
        partName: item.name,
        type: adjustment.type,
        quantity: qty,
        userId: "Current User",
        reference: adjustment.reference || "Manual Adjustment",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setAdjustStockDialogOpen(false);
      setSelectedItem(null);
      toast({ title: "Stock adjusted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error adjusting stock", description: err.message, variant: "destructive" });
    },
  });

  const binLabel = (binId: string | null) => {
    if (!binId) return <span className="text-muted-foreground">—</span>;
    const bin = binsList.find(b => b.id === binId);
    const room = bin && storeRoomsList.find(r => r.id === bin.storeRoomId);
    return (
      <div>
        <div className="font-mono text-xs">{binId}</div>
        {room && <div className="text-xs text-muted-foreground">{room.name}</div>}
      </div>
    );
  };

  const filteredInventory = inventoryItems
    .filter(i => !filterLowStock || i.stock < i.minStock)
    .filter(i => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
    });

  const totalItems = inventoryItems.reduce((acc, item) => acc + item.stock, 0);
  const lowStockCount = inventoryItems.filter(i => i.stock < i.minStock).length;

  const handleAddItem = () => {
    if (!newItem.id || !newItem.name || !newItem.category) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(cleanPart(newItem) as any, {
      onSuccess: () => {
        setAddDialogOpen(false);
        setNewItem({ id: "", name: "", category: "", stock: 0, minStock: 0, unit: "pcs", binId: "", unitCost: "", reorderQty: "", manufacturerPartNo: "", leadTime: 1, primarySupplierId: "", secondarySupplierId: "" });
        toast({ title: "Item added successfully" });
      },
      onError: (err: Error) => {
        toast({ title: "Error adding item", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleEditItem = () => {
    if (!selectedItem) return;
    updateMutation.mutate({ id: selectedItem.id, data: cleanPart(editItem) } as any, {
      onSuccess: () => {
        setEditDialogOpen(false);
        setSelectedItem(null);
        toast({ title: "Item updated successfully" });
      },
      onError: (err: Error) => {
        toast({ title: "Error updating item", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleDeleteItem = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Item deleted successfully" });
      },
      onError: (err: Error) => {
        toast({ title: "Error deleting item", description: err.message, variant: "destructive" });
      },
    });
  };

  const openEditDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditItem({
      name: item.name,
      category: item.category,
      minStock: item.minStock,
      unit: item.unit,
      binId: item.binId || "",
      unitCost: item.unitCost ?? "",
      reorderQty: item.reorderQty == null ? "" : String(item.reorderQty),
      manufacturerPartNo: item.manufacturerPartNo || "",
      leadTime: item.leadTime || 1,
      primarySupplierId: item.primarySupplierId || "",
      secondarySupplierId: item.secondarySupplierId || "",
    });
    setEditDialogOpen(true);
  };

  const openAdjustStockDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setStockAdjustment({ quantity: 0, type: "Stock In", reference: "" });
    setAdjustStockDialogOpen(true);
  };

  if (inventoryLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-inventory-title">Inventory</h1>
          <p className="text-muted-foreground mt-1">Track parts, stock levels, and requisitions.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock-take">
            <Button variant="outline" className="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10" data-testid="link-stock-take">
              <ClipboardList className="mr-2 size-4" />
              Cycle Check
            </Button>
          </Link>
          <Button variant="outline" data-testid="button-purchase-order">
            <ShoppingCart className="mr-2 size-4" />
            Purchase Order
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-item">
                <Plus className="mr-2 size-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Inventory Item</DialogTitle>
                <DialogDescription>Add a new part or consumable to inventory.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Part ID *</Label>
                    <Input data-testid="input-new-item-id" value={newItem.id} onChange={e => setNewItem({...newItem, id: e.target.value})} placeholder="PART-006" />
                  </div>
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input data-testid="input-new-item-name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="Item name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Input data-testid="input-new-item-category" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="Spares" />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <UnitSelect value={newItem.unit} onChange={v => setNewItem({...newItem, unit: v})} testId="input-new-item-unit" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Initial Stock</Label>
                    <Input data-testid="input-new-item-stock" type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Stock</Label>
                    <Input data-testid="input-new-item-min-stock" type="number" value={newItem.minStock} onChange={e => setNewItem({...newItem, minStock: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Time (days)</Label>
                    <Input data-testid="input-new-item-lead-time" type="number" value={newItem.leadTime} onChange={e => setNewItem({...newItem, leadTime: parseInt(e.target.value) || 1})} />
                  </div>
                </div>
                <PartExtraFields value={newItem} onChange={setNewItem} prefix="input-new-item" bins={binsList} storeRooms={storeRoomsList} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Supplier</Label>
                    <Select value={newItem.primarySupplierId || NONE} onValueChange={v => setNewItem({...newItem, primarySupplierId: v === NONE ? "" : v})}>
                      <SelectTrigger data-testid="select-new-item-primary-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {suppliersList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Supplier</Label>
                    <Select value={newItem.secondarySupplierId || NONE} onValueChange={v => setNewItem({...newItem, secondarySupplierId: v === NONE ? "" : v})}>
                      <SelectTrigger data-testid="select-new-item-secondary-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {suppliersList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button data-testid="button-submit-add-item" onClick={handleAddItem} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Add Item
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 my-6">
        <div className="bg-card p-4 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <ShoppingCart className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Items</p>
            <h3 className="text-2xl font-bold" data-testid="text-total-items">{totalItems}</h3>
          </div>
        </div>
        <div 
          className={cn(
            "bg-card p-4 rounded-lg border shadow-sm flex items-center gap-4 cursor-pointer transition-colors hover:bg-muted/50",
            filterLowStock && "border-red-500 ring-1 ring-red-500 bg-red-50/50 dark:bg-red-950/20"
          )}
          onClick={() => setFilterLowStock(!filterLowStock)}
          data-testid="button-filter-low-stock"
        >
          <div className="p-3 bg-red-100 rounded-full text-red-600">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Low Stock Alerts</p>
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-500" data-testid="text-low-stock-count">{lowStockCount}</h3>
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full text-green-600">
            <ShoppingCart className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Value</p>
            <h3 className="text-2xl font-bold" data-testid="text-inventory-value">$12,450</h3>
          </div>
        </div>
      </div>

      <div className="flex items-center py-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            data-testid="input-search-inventory"
            placeholder="Search inventory..."
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {filterLowStock && (
          <Button variant="ghost" onClick={() => setFilterLowStock(false)} className="text-sm text-muted-foreground h-9" data-testid="button-clear-filter">
            Clear filter
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]"></TableHead>
              <TableHead className="w-[100px]">Part #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Bin</TableHead>
              <TableHead>Stock Level</TableHead>
              <TableHead>Criticality</TableHead>
              <TableHead>Suppliers</TableHead>
              <TableHead>Used On</TableHead>
              <TableHead>Audit Log</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.map((item) => {
              const stockPercentage = Math.min((item.stock / (item.minStock * 3)) * 100, 100);
              const isLow = item.stock < item.minStock;
              const isCriticalLeadTime = (item.leadTime || 0) > 3;
              const itemTransactions = transactionsList.filter(t => t.partId === item.id);
              const usedOnAssets = assetsList.filter(a => {
                return false;
              });

              const primarySupplier = suppliersList.find(s => s.id === item.primarySupplierId);
              const secondarySupplier = suppliersList.find(s => s.id === item.secondarySupplierId);

              return (
                <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                  <TableCell>
                    <div className="size-10 rounded bg-muted/50 border flex items-center justify-center relative group overflow-hidden cursor-pointer">
                      <ImageIcon className="size-4 text-muted-foreground/50" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Plus className="size-3 text-white" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium font-mono text-xs text-muted-foreground">
                    {item.id}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{binLabel(item.binId)}</TableCell>
                  <TableCell className="w-[180px]">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{item.stock} {item.unit}</span>
                        <span className="text-muted-foreground">Min: {item.minStock}</span>
                      </div>
                      <Progress value={stockPercentage} className={cn(
                        "h-1.5",
                        isLow ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"
                      )} />
                    </div>
                  </TableCell>
                  <TableCell>
                    {isLow ? (
                      <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isCriticalLeadTime ? (
                        <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
                          High (&gt;{item.leadTime}d)
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          Low ({item.leadTime}d)
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(primarySupplier || secondarySupplier) ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground flex items-center" data-testid={`button-suppliers-${item.id}`}>
                            <Building2 className="mr-1 size-3" />
                            {primarySupplier && secondarySupplier ? '2 Suppliers' : '1 Supplier'}
                          </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold">Approved Suppliers</h4>
                            <div className="space-y-2">
                              {primarySupplier && (
                                <div className="border rounded-md p-2 bg-primary/5 border-primary/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <Badge variant="outline" className="text-[10px] uppercase bg-primary text-primary-foreground border-transparent">Primary</Badge>
                                    <span className="text-xs font-mono text-muted-foreground">{primarySupplier.id}</span>
                                  </div>
                                  <div className="font-medium text-sm">{primarySupplier.name}</div>
                                </div>
                              )}
                              {secondarySupplier && (
                                <div className="border rounded-md p-2 bg-muted/30">
                                  <div className="flex items-center justify-between mb-1">
                                    <Badge variant="secondary" className="text-[10px] uppercase">Secondary</Badge>
                                    <span className="text-xs font-mono text-muted-foreground">{secondarySupplier.id}</span>
                                  </div>
                                  <div className="font-medium text-sm">{secondarySupplier.name}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="w-[180px]">
                    <UsedOnAssetsCell itemId={item.id} assetsList={assetsList} />
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" data-testid={`button-audit-log-${item.id}`}>
                          <History className="mr-1 size-3" /> View Log
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                          <DialogTitle>Audit Log: {item.name}</DialogTitle>
                          <DialogDescription>
                            Recent history for {item.id}. Lead Time: {item.leadTime} days.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-3 gap-4 pb-4 border-b">
                            <div>
                              <p className="text-xs text-muted-foreground">Last Used</p>
                              <p className="text-sm font-medium">{item.lastUsed || "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Last Stock Taken</p>
                              <p className="text-sm font-medium">{item.lastStockTaken || "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Last Replenished</p>
                              <p className="text-sm font-medium">{item.lastReplenished || "N/A"}</p>
                            </div>
                          </div>
                          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                            <h4 className="text-sm font-semibold">Transaction History</h4>
                            {itemTransactions.length > 0 ? (
                              itemTransactions.map(tx => (
                                <div key={tx.id} className="flex justify-between items-start pb-4 border-b last:border-0 last:pb-0">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{tx.type}</span>
                                      <Badge variant="outline" className="text-[10px]">{tx.reference}</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      By {tx.userId} on {new Date(tx.date).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <div className={cn(
                                    "text-sm font-bold",
                                    tx.quantity > 0 ? "text-green-600" : "text-destructive"
                                  )}>
                                    {tx.quantity > 0 ? "+" : ""}{tx.quantity} {item.unit}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground italic py-2">
                                No recent transactions found for this item.
                              </div>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${item.id}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Item Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem data-testid={`button-edit-${item.id}`} onClick={() => openEditDialog(item)}>Edit Item</DropdownMenuItem>
                        <DropdownMenuItem>Upload Image</DropdownMenuItem>
                        <DropdownMenuItem data-testid={`button-adjust-stock-${item.id}`} onClick={() => openAdjustStockDialog(item)}>Adjust Stock</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Order More</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          data-testid={`button-delete-${item.id}`}
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete Item
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Item: {selectedItem?.id}</DialogTitle>
            <DialogDescription>Update inventory item details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input data-testid="input-edit-item-name" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input data-testid="input-edit-item-category" value={editItem.category} onChange={e => setEditItem({...editItem, category: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Min Stock</Label>
                <Input data-testid="input-edit-item-min-stock" type="number" value={editItem.minStock} onChange={e => setEditItem({...editItem, minStock: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <UnitSelect value={editItem.unit} onChange={v => setEditItem({...editItem, unit: v})} testId="input-edit-item-unit" />
              </div>
              <div className="space-y-2">
                <Label>Lead Time (days)</Label>
                <Input data-testid="input-edit-item-lead-time" type="number" value={editItem.leadTime} onChange={e => setEditItem({...editItem, leadTime: parseInt(e.target.value) || 1})} />
              </div>
            </div>
            <PartExtraFields value={editItem} onChange={setEditItem} prefix="input-edit-item" bins={binsList} storeRooms={storeRoomsList} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Supplier</Label>
                <Select value={editItem.primarySupplierId || NONE} onValueChange={v => setEditItem({...editItem, primarySupplierId: v === NONE ? "" : v})}>
                  <SelectTrigger data-testid="select-edit-item-primary-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {suppliersList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Secondary Supplier</Label>
                <Select value={editItem.secondarySupplierId || NONE} onValueChange={v => setEditItem({...editItem, secondarySupplierId: v === NONE ? "" : v})}>
                  <SelectTrigger data-testid="select-edit-item-secondary-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {suppliersList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button data-testid="button-submit-edit-item" onClick={handleEditItem} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustStockDialogOpen} onOpenChange={setAdjustStockDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock: {selectedItem?.name}</DialogTitle>
            <DialogDescription>
              Current stock: {selectedItem?.stock} {selectedItem?.unit}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select value={stockAdjustment.type} onValueChange={v => setStockAdjustment({...stockAdjustment, type: v})}>
                <SelectTrigger data-testid="select-adjust-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stock In">Stock In</SelectItem>
                  <SelectItem value="Stock Out - Damaged">Stock Out - Damaged</SelectItem>
                  <SelectItem value="Stock Out - Missing">Stock Out - Missing</SelectItem>
                  <SelectItem value="Job Book Out">Job Book Out</SelectItem>
                  <SelectItem value="Transfer In">Transfer In</SelectItem>
                  <SelectItem value="Purchase Order">Purchase Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input data-testid="input-adjust-quantity" type="number" min="0" value={stockAdjustment.quantity} onChange={e => setStockAdjustment({...stockAdjustment, quantity: parseInt(e.target.value) || 0})} />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input data-testid="input-adjust-reference" value={stockAdjustment.reference} onChange={e => setStockAdjustment({...stockAdjustment, reference: e.target.value})} placeholder="JOB-XXXX or note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustStockDialogOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-submit-adjust-stock"
              onClick={() => selectedItem && adjustStockMutation.mutate({ item: selectedItem, adjustment: stockAdjustment })}
              disabled={adjustStockMutation.isPending || stockAdjustment.quantity === 0}
            >
              {adjustStockMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function UsedOnAssetsCell({ itemId, assetsList }: { itemId: string; assetsList: Asset[] }) {
  const { data: allAssetParts } = useAllAssetParts(assetsList, itemId);
  const matchedAssets = allAssetParts || [];

  if (matchedAssets.length === 0) {
    return <span className="text-xs text-muted-foreground">None</span>;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-xs" data-testid={`button-used-on-${itemId}`}>
          {matchedAssets.length} Asset(s)
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Used on Assets</h4>
          <div className="text-sm">
            {matchedAssets.map(asset => (
              <div key={asset.id} className="flex justify-between items-center py-1 border-b last:border-0">
                <span>{asset.name}</span>
                <span className="text-xs text-muted-foreground">{asset.id}</span>
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

import { useQuery } from "@tanstack/react-query";

/** Assets that list this part as a spare. One request for the whole company, shared by every row. */
function useAllAssetParts(assetsList: Asset[], partId: string) {
  const { data: links = [], ...rest } = useQuery<{ assetId: string; partId: string; quantity: number }[]>({
    queryKey: ["/api/asset-parts"],
    staleTime: 60000,
  });
  const assetIds = new Set(links.filter(l => l.partId === partId).map(l => l.assetId));
  return { ...rest, data: assetsList.filter(a => assetIds.has(a.id)) };
}

const NONE = "__none__";

type PartForm = {
  binId: string; unitCost: string; reorderQty: string; manufacturerPartNo: string;
  primarySupplierId: string; secondarySupplierId: string; [key: string]: any;
};

/** Turns form strings into what the API expects: blanks become null, numbers become numbers. */
function cleanPart<T extends PartForm>(form: T) {
  const blank = (v: string) => (v ?? "").toString().trim() === "";
  return {
    ...form,
    binId: blank(form.binId) ? null : form.binId,
    primarySupplierId: blank(form.primarySupplierId) ? null : form.primarySupplierId,
    secondarySupplierId: blank(form.secondarySupplierId) ? null : form.secondarySupplierId,
    manufacturerPartNo: blank(form.manufacturerPartNo) ? null : form.manufacturerPartNo.trim(),
    unitCost: blank(form.unitCost) ? null : String(form.unitCost).replace(/[£,\s]/g, ""),
    reorderQty: blank(form.reorderQty) ? null : Math.max(0, parseInt(form.reorderQty, 10) || 0),
  };
}

function UnitSelect({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId: string }) {
  const units: string[] = (PART_UNITS as readonly string[]).includes(value) ? [...PART_UNITS] : [value, ...PART_UNITS];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}><SelectValue /></SelectTrigger>
      <SelectContent>
        {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Bin, cost, reorder quantity and manufacturer part number, shared by the add and edit dialogs. */
function PartExtraFields<T extends PartForm>({ value, onChange, prefix, bins, storeRooms }: {
  value: T; onChange: (next: T) => void; prefix: string; bins: Bin[]; storeRooms: StoreRoom[];
}) {
  return (
    <>
      <div className="space-y-2">
        <Label>Bin</Label>
        <Select value={value.binId || NONE} onValueChange={v => onChange({ ...value, binId: v === NONE ? "" : v })}>
          <SelectTrigger data-testid={`${prefix}-bin`}><SelectValue placeholder="Select bin" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No bin</SelectItem>
            {storeRooms.map(room => {
              const roomBins = bins.filter(b => b.storeRoomId === room.id);
              if (roomBins.length === 0) return null;
              return (
                <SelectGroup key={room.id}>
                  <SelectLabel>{room.name}</SelectLabel>
                  {roomBins.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.id}{b.description ? ` – ${b.description}` : ""}</SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
        {bins.length === 0 && (
          <p className="text-xs text-muted-foreground">Add store rooms and bins on the Locations page.</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Unit Cost (£)</Label>
          <Input data-testid={`${prefix}-unit-cost`} inputMode="decimal" value={value.unitCost} onChange={e => onChange({ ...value, unitCost: e.target.value })} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label>Reorder Qty</Label>
          <Input data-testid={`${prefix}-reorder-qty`} type="number" min={0} value={value.reorderQty} onChange={e => onChange({ ...value, reorderQty: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Mfr Part No</Label>
          <Input data-testid={`${prefix}-mpn`} value={value.manufacturerPartNo} onChange={e => onChange({ ...value, manufacturerPartNo: e.target.value })} />
        </div>
      </div>
    </>
  );
}
